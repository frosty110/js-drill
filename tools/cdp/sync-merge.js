// Merge-logic unit tests for js/sync.js. Drives the pure merge functions
// via Sync._testInternals (exposed for testing). These are the load-bearing
// correctness pieces — every conflict resolution rule documented in
// sync.js's header comment is asserted here, plus the legacy-shape
// normalizeCloudBundle reader for the row format we already shipped.
//
// Run: node tools/cdp/sync-merge.js  (assumes server on :8765, Chrome on :9222)

const { ensureServer, ensureChrome, connect } = require('./lib');

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: 'http://localhost:8765/' });

  // The service worker is cache-first; a prior run can pin a stale js/sync.js
  // (missing newly-added merge policies). Unregister it + clear CacheStorage,
  // then reload so the tests run against the on-disk sync.js.
  await s.evalAwait(`(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); }
  })()`);
  await s.reload();

  await s.waitFor(`window.DrillSync && window.DrillSync._testInternals`);

  // Helper: run a JS expression in the page that returns JSON-safe data.
  async function check(label, expr, expected) {
    const got = await s.eval(`JSON.stringify((function() { ${expr} })())`);
    const want = JSON.stringify(expected);
    s.assert(got === want, `${label} — got ${got}, want ${want}`);
  }

  // ============================================================================
  // normalizeCloudBundle: must read both legacy (single blob with __v) and new
  // ({progress, prep, diagnostic}) shapes.
  // ============================================================================
  await check('normalize: legacy main-app blob wraps as {progress}',
    `const n = window.DrillSync._testInternals.normalizeCloudBundle({__v: 6, progress: {x: {L1:'passed'}}, bestTimes: {}});
     return { hasProgress: !!n.progress, vMatch: n.progress.__v === 6, prepNull: n.prep === null };`,
    { hasProgress: true, vMatch: true, prepNull: true });

  await check('normalize: new bundle shape passes through',
    `const n = window.DrillSync._testInternals.normalizeCloudBundle({
       progress: {__v: 6}, prep: {__v: 1, completed: {a: true}}, diagnostic: {__v: 1}
     });
     return { hasAll: !!n.progress && !!n.prep && !!n.diagnostic, prepCompleted: n.prep.completed.a };`,
    { hasAll: true, prepCompleted: true });

  await check('normalize: null input returns triple-null bundle',
    `const n = window.DrillSync._testInternals.normalizeCloudBundle(null);
     return { p: n.progress, pr: n.prep, d: n.diagnostic };`,
    { p: null, pr: null, d: null });

  // ============================================================================
  // mergeProgress: spot-check the levels that mattered most in design
  // ============================================================================
  await check('progress: L1/L2/L3 OR across devices',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, progress: { two_sum: { L1: 'passed' } } },
       { __v: 6, progress: { two_sum: { L2: 'passed' } } });
     return m.progress.two_sum;`,
    { L1: 'passed', L2: 'passed' });

  await check('progress: bestTimes MIN',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, bestTimes: { x: 5000 } }, { __v: 6, bestTimes: { x: 3000 } });
     return m.bestTimes.x;`,
    3000);

  await check('progress: device-state scalars prefer local',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, lastLessonId: 'on-phone', lastTab: 'L1' },
       { __v: 6, lastLessonId: 'on-laptop', lastTab: 'L3' });
     return { l: m.lastLessonId, t: m.lastTab };`,
    { l: 'on-phone', t: 'L1' });

  await check('progress: welcomed OR (cloud true wins)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, welcomed: false }, { __v: 6, welcomed: true });
     return m.welcomed;`,
    true);

  await check('progress: partialL1 OR (amber-pass on either device → flagged)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, partialL1: { two_sum: true } },
       { __v: 6, partialL1: { reverse_list: true } });
     return m.partialL1;`,
    { two_sum: true, reverse_list: true });

  // ============================================================================
  // mergePrep: completed OR, reviewed by lastReviewedAt, currentTab prefers local
  // ============================================================================
  await check('prep: completed OR across devices',
    `const m = window.DrillSync._testInternals.mergePrep(
       { __v: 1, completed: { task1: true } },
       { __v: 1, completed: { task2: true } });
     return m.completed;`,
    { task1: true, task2: true });

  await check('prep: reviewed[id] — greater lastReviewedAt wins',
    `const m = window.DrillSync._testInternals.mergePrep(
       { __v: 1, reviewed: { 'g:foo': { familiarity: 3, lastReviewedAt: 100 } } },
       { __v: 1, reviewed: { 'g:foo': { familiarity: 0, lastReviewedAt: 200 } } });
     return m.reviewed['g:foo'];`,
    { familiarity: 0, lastReviewedAt: 200 });

  await check('prep: currentTab + currentDayId prefer local',
    `const m = window.DrillSync._testInternals.mergePrep(
       { __v: 1, currentTab: 'glossary', currentDayId: 'day-2' },
       { __v: 1, currentTab: 'days',     currentDayId: 'day-4' });
     return { t: m.currentTab, d: m.currentDayId };`,
    { t: 'glossary', d: 'day-2' });

  await check('prep: expanded OR',
    `const m = window.DrillSync._testInternals.mergePrep(
       { __v: 1, expanded: { a: true } }, { __v: 1, expanded: { b: true } });
     return m.expanded;`,
    { a: true, b: true });

  // ============================================================================
  // mergeDiagnostic: answers by lastAnsweredAt, timeOnStep MAX, startedAt MIN
  // ============================================================================
  await check('diag: answers — greater lastAnsweredAt wins',
    `const m = window.DrillSync._testInternals.mergeDiagnostic(
       { __v: 1, answers: { q1: { value: 'A', lastAnsweredAt: 100 } } },
       { __v: 1, answers: { q1: { value: 'B', lastAnsweredAt: 200 } } });
     return m.answers.q1;`,
    { value: 'B', lastAnsweredAt: 200 });

  await check('diag: timeOnStep MAX (cumulative across devices undefined)',
    `const m = window.DrillSync._testInternals.mergeDiagnostic(
       { __v: 1, timeOnStep: { 5: 120 } }, { __v: 1, timeOnStep: { 5: 90 } });
     return m.timeOnStep[5];`,
    120);

  await check('diag: startedAt MIN (earliest start wins)',
    `const m = window.DrillSync._testInternals.mergeDiagnostic(
       { __v: 1, startedAt: '2026-05-20T10:00:00Z' },
       { __v: 1, startedAt: '2026-05-25T10:00:00Z' });
     return m.startedAt;`,
    '2026-05-20T10:00:00Z');

  await check('diag: currentStep prefers local',
    `const m = window.DrillSync._testInternals.mergeDiagnostic(
       { __v: 1, currentStep: 12 }, { __v: 1, currentStep: 30 });
     return m.currentStep;`,
    12);

  await check('diag: pre — local non-empty wins over cloud non-empty',
    `const m = window.DrillSync._testInternals.mergeDiagnostic(
       { __v: 1, pre: { goal: 'land an interview' } },
       { __v: 1, pre: { goal: 'something else' } });
     return m.pre.goal;`,
    'land an interview');

  // ============================================================================
  // Edge cases: one side null should pass the other through.
  // ============================================================================
  await check('progress: local-null returns cloud',
    `const m = window.DrillSync._testInternals.mergeProgress(null, { __v: 6, welcomed: true });
     return { v: m.__v, w: m.welcomed };`,
    { v: 6, w: true });

  await check('prep: cloud-null returns local',
    `const m = window.DrillSync._testInternals.mergePrep({ __v: 1, completed: { a: true } }, null);
     return m.completed;`,
    { a: true });

  // ============================================================================
  // history / misses: per-lesson event-log UNION (the consistency-map fix).
  // ============================================================================
  await check('history: UNION events across devices, sorted by at',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, history: { two_sum: [{ at: 30, event: 'L1-pass' }] } },
       { __v: 6, history: { two_sum: [{ at: 10, event: 'L3-pass' }] } });
     return m.history.two_sum;`,
    [{ at: 10, event: 'L3-pass' }, { at: 30, event: 'L1-pass' }]);

  await check('history: dedupes identical events (re-pulled cloud no-op)',
    `const e = { at: 5, event: 'L2-pass' };
     const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, history: { x: [e] } }, { __v: 6, history: { x: [e] } });
     return m.history.x;`,
    [{ at: 5, event: 'L2-pass' }]);

  await check('history: union across DIFFERENT lessons (phone+laptop)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, history: { a: [{ at: 1, event: 'L1-pass' }] } },
       { __v: 6, history: { b: [{ at: 2, event: 'L1-pass' }] } });
     return { a: m.history.a.length, b: m.history.b.length };`,
    { a: 1, b: 1 });

  await check('history: NOT dropped when only one side has it (was the bug)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, history: { x: [{ at: 1, event: 'L3-pass' }] } },
       { __v: 6, progress: { x: { L1: 'passed' } } });
     return m.history.x.length;`,
    1);

  await check('misses: UNION + cap reflected (mistake tagging totals)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, misses: { x: [{ at: 1, level: 'L1', tag: 'off-by-one' }] } },
       { __v: 6, misses: { x: [{ at: 2, level: 'L2', tag: 'edge case' }] } });
     return m.misses.x.length;`,
    2);

  // ============================================================================
  // Additive lifetime drill stats: SUM counters, MAX timestamps/records.
  // ============================================================================
  await check('additive: recognize SUM attempts+correct across devices',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, recognize: { attempts: 10, correct: 7 } },
       { __v: 6, recognize: { attempts: 4, correct: 3 } });
     return m.recognize;`,
    { attempts: 14, correct: 10 });

  await check('additive: lastRunAt MAX, bestStreak MAX, counters SUM',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, rapidFire: { attempts: 5, correct: 2, bestStreak: 8, lastRunAt: 100 } },
       { __v: 6, rapidFire: { attempts: 3, correct: 3, bestStreak: 12, lastRunAt: 50 } });
     return m.rapidFire;`,
    { attempts: 8, correct: 5, bestStreak: 12, lastRunAt: 100 });

  await check('additive: speedrun.bests per-section MIN (fastest time)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, speedrun: { sessions: 1, bests: { arrays: 9000 } } },
       { __v: 6, speedrun: { sessions: 2, bests: { arrays: 7000, trees: 5000 } } });
     return m.speedrun;`,
    { sessions: 3, bests: { arrays: 7000, trees: 5000 } });

  await check('additive: glossaryQuiz.session prefers local (active session)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, glossaryQuiz: { attempts: 2, correct: 1, session: { index: 4 } } },
       { __v: 6, glossaryQuiz: { attempts: 1, correct: 1, session: { index: 9 } } });
     return { a: m.glossaryQuiz.attempts, idx: m.glossaryQuiz.session.index };`,
    { a: 3, idx: 4 });

  await check('additive: commandUsage SUM per command',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, commandUsage: { open_stats: 3, open_mock: 1 } },
       { __v: 6, commandUsage: { open_stats: 2, open_recognize: 5 } });
     return m.commandUsage;`,
    { open_stats: 5, open_mock: 1, open_recognize: 5 });

  await check('additive: walkthrough per-lesson counters SUM, scrubbed OR',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, walkthrough: { x: { quizAttempts: 2, quizCorrect: 1, scrubbed: false, lastRunAt: 10 } } },
       { __v: 6, walkthrough: { x: { quizAttempts: 1, quizCorrect: 1, scrubbed: true, lastRunAt: 99 } } });
     return m.walkthrough.x;`,
    { quizAttempts: 3, quizCorrect: 2, scrubbed: true, lastRunAt: 99 });

  // ============================================================================
  // Carry-over base: settings/device scalars NOT explicitly policied survive.
  // ============================================================================
  await check('carry-over: subscribedPathId survives (prefer local)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, subscribedPathId: 'prep-4day' },
       { __v: 6, subscribedPathId: 'starter' });
     return m.subscribedPathId;`,
    'prep-4day');

  await check('carry-over: settings survive from whichever side has them',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, adhdMode: true },
       { __v: 6, fontScale: 1.2 });
     return { a: m.adhdMode, f: m.fontScale };`,
    { a: true, f: 1.2 });

  s.report();
  await s.close();
  const failed = s.assertions.filter(a => !a.ok).length;
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
