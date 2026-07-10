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

  await check('normalize: new bundle shape passes through (incl. systemdesign)',
    `const n = window.DrillSync._testInternals.normalizeCloudBundle({
       progress: {__v: 6}, prep: {__v: 1, completed: {a: true}}, diagnostic: {__v: 1},
       systemdesign: {__v: 1, boxes: {'ddia/ch01/0': {box: 2}}}
     });
     return { hasAll: !!n.progress && !!n.prep && !!n.diagnostic && !!n.systemdesign,
              prepCompleted: n.prep.completed.a, sdBox: n.systemdesign.boxes['ddia/ch01/0'].box };`,
    { hasAll: true, prepCompleted: true, sdBox: 2 });

  await check('normalize: legacy __v-shape yields systemdesign null',
    `const n = window.DrillSync._testInternals.normalizeCloudBundle({__v: 6, progress: {}});
     return n.systemdesign;`,
    null);

  await check('normalize: null input returns quad-null bundle',
    `const n = window.DrillSync._testInternals.normalizeCloudBundle(null);
     return { p: n.progress, pr: n.prep, d: n.diagnostic, s: n.systemdesign };`,
    { p: null, pr: null, d: null, s: null });

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
  // Additive lifetime drill stats: MAX counters (idempotent — SUM inflated on
  // every cross-device round-trip, audit P1-1), MAX timestamps/records.
  // ============================================================================
  await check('additive: recognize MAX attempts+correct (not SUM)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, recognize: { attempts: 10, correct: 7 } },
       { __v: 6, recognize: { attempts: 4, correct: 3 } });
     return m.recognize;`,
    { attempts: 10, correct: 7 });

  await check('additive: merge is IDEMPOTENT (re-merging cloud is a no-op)',
    `const T = window.DrillSync._testInternals;
     const a = { __v: 6, recognize: { attempts: 10, correct: 7, lastRunAt: 100 } };
     const b = { __v: 6, recognize: { attempts: 4, correct: 3, lastRunAt: 50 } };
     const once = T.mergeProgress(a, b);
     const twice = T.mergeProgress(once, b);   // device pulls the same cloud again
     const thrice = T.mergeProgress(b, twice); // and the other direction
     return { stable: JSON.stringify(once.recognize) === JSON.stringify(twice.recognize)
                   && JSON.stringify(once.recognize) === JSON.stringify(thrice.recognize),
              val: once.recognize };`,
    { stable: true, val: { attempts: 10, correct: 7, lastRunAt: 100 } });

  await check('additive: lastRunAt MAX, bestStreak MAX, counters MAX',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, rapidFire: { attempts: 5, correct: 2, bestStreak: 8, lastRunAt: 100 } },
       { __v: 6, rapidFire: { attempts: 3, correct: 3, bestStreak: 12, lastRunAt: 50 } });
     return m.rapidFire;`,
    { attempts: 5, correct: 3, bestStreak: 12, lastRunAt: 100 });

  await check('additive: speedrun.bests per-section MIN (fastest time)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, speedrun: { sessions: 1, bests: { arrays: 9000 } } },
       { __v: 6, speedrun: { sessions: 2, bests: { arrays: 7000, trees: 5000 } } });
     return m.speedrun;`,
    { sessions: 2, bests: { arrays: 7000, trees: 5000 } });

  await check('additive: glossaryQuiz.session prefers local (active session)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, glossaryQuiz: { attempts: 2, correct: 1, session: { index: 4 } } },
       { __v: 6, glossaryQuiz: { attempts: 1, correct: 1, session: { index: 9 } } });
     return { a: m.glossaryQuiz.attempts, idx: m.glossaryQuiz.session.index };`,
    { a: 2, idx: 4 });

  await check('additive: commandUsage MAX per command',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, commandUsage: { open_stats: 3, open_mock: 1 } },
       { __v: 6, commandUsage: { open_stats: 2, open_recognize: 5 } });
     return m.commandUsage;`,
    { open_stats: 3, open_mock: 1, open_recognize: 5 });

  await check('additive: walkthrough per-lesson counters MAX, scrubbed OR',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, walkthrough: { x: { quizAttempts: 2, quizCorrect: 1, scrubbed: false, lastRunAt: 10 } } },
       { __v: 6, walkthrough: { x: { quizAttempts: 1, quizCorrect: 1, scrubbed: true, lastRunAt: 99 } } });
     return m.walkthrough.x;`,
    { quizAttempts: 2, quizCorrect: 1, scrubbed: true, lastRunAt: 99 });

  // ============================================================================
  // P1-2: previously-unregistered fields now merge (clarify / hotseat /
  // timeCalibration → additive; cramTaskChecks → OR).
  // ============================================================================
  await check('clarify: counters MAX, lastRunAt MAX (was prefer-local clobber)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, clarify: { attempts: 0, correct: 0, completed: 0, sessions: 0, lastRunAt: 0 } },
       { __v: 6, clarify: { attempts: 8, correct: 6, completed: 5, sessions: 3, lastRunAt: 500 } });
     return m.clarify;`,
    { attempts: 8, correct: 6, completed: 5, sessions: 3, lastRunAt: 500 });

  await check('hotseat: counters MAX across devices',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, hotseat: { attempts: 4, correct: 2, sessions: 1, lastRunAt: 90 } },
       { __v: 6, hotseat: { attempts: 2, correct: 2, sessions: 2, lastRunAt: 40 } });
     return m.hotseat;`,
    { attempts: 4, correct: 2, sessions: 2, lastRunAt: 90 });

  await check('timeCalibration: byMechanic recurses per-mechanic, meta MAX',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, timeCalibration: { byMechanic: { reduce: { estimates: 3, passes: 2 } }, meta: { estimates: 3, skips: 1, passes: 2 } } },
       { __v: 6, timeCalibration: { byMechanic: { reduce: { estimates: 1, passes: 4 }, heap: { estimates: 2 } }, meta: { estimates: 4, skips: 0, passes: 4 } } });
     return m.timeCalibration;`,
    { byMechanic: { reduce: { estimates: 3, passes: 4 }, heap: { estimates: 2 } }, meta: { estimates: 4, skips: 1, passes: 4 } });

  await check('cramTaskChecks: OR across devices (laptop check shows on phone)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, cramTaskChecks: { t1: true } },
       { __v: 6, cramTaskChecks: { t2: true } });
     return m.cramTaskChecks;`,
    { t1: true, t2: true });

  // ============================================================================
  // P1-3: revealed — timestamped clear beats a stale flag; a newer re-reveal
  // beats a stale clear; legacy untimestamped flags still OR.
  // ============================================================================
  await check('revealed: newer CLEAR survives merge with stale flag (clean-pass invariant)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, revealed: {}, revealedAt: { x: { L3: 100 } }, revealedClearedAt: { x: { L3: 200 } } },
       { __v: 6, revealed: { x: { L3: true } }, revealedAt: { x: { L3: 100 } } });
     return { flag: !!(m.revealed.x && m.revealed.x.L3), clearedAt: m.revealedClearedAt.x.L3 };`,
    { flag: false, clearedAt: 200 });

  await check('revealed: newer RE-REVEAL beats a stale clear',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, revealed: { x: { L3: true } }, revealedAt: { x: { L3: 300 } }, revealedClearedAt: { x: { L3: 200 } } },
       { __v: 6, revealed: {}, revealedClearedAt: { x: { L3: 200 } } });
     return m.revealed.x;`,
    { L3: true });

  await check('revealed: legacy untimestamped flags still OR (no timestamps anywhere)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, revealed: { a: { L2: true } } },
       { __v: 6, revealed: { a: { L3: true }, b: { L2: true } } });
     return m.revealed;`,
    { a: { L2: true, L3: true }, b: { L2: true } });

  await check('revealed: clear beats a LEGACY untimestamped flag (set-at-0)',
    `const m = window.DrillSync._testInternals.mergeProgress(
       { __v: 6, revealed: {}, revealedClearedAt: { x: { L2: 50 } } },
       { __v: 6, revealed: { x: { L2: true } } });
     return m.revealed.x === undefined;`,
    true);

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

  // ============================================================================
  // P0-1: mergeSystemDesign — the fourth blob (jsdrill.systemdesign.v1).
  // ============================================================================
  await check('sysdesign: boxes UNION across different keys (phone+laptop)',
    `const m = window.DrillSync._testInternals.mergeSystemDesign(
       { __v: 1, boxes: { 'ddia/ch01/0': { box: 1, seen: 1, good: 1, again: 0, due: 10, last: 5 } } },
       { __v: 1, boxes: { 'ddia/ch02/3': { box: 3, seen: 4, good: 3, again: 1, due: 90, last: 80 } } });
     return { a: m.boxes['ddia/ch01/0'].box, b: m.boxes['ddia/ch02/3'].box };`,
    { a: 1, b: 3 });

  await check('sysdesign: same key — greater last wins box/due as a unit (miss-reset is the truth)',
    `const m = window.DrillSync._testInternals.mergeSystemDesign(
       { __v: 1, boxes: { k: { box: 2, seen: 1, good: 0, again: 1, due: 900, last: 200 } } },
       { __v: 1, boxes: { k: { box: 4, seen: 1, good: 1, again: 0, due: 500, last: 100 } } });
     return { box: m.boxes.k.box, due: m.boxes.k.due };`,
    { box: 2, due: 900 });

  await check('sysdesign: seen/good/again take MAX not SUM (+ idempotence)',
    `const T = window.DrillSync._testInternals;
     const l = { __v: 1, boxes: { k: { box: 3, seen: 10, good: 7, again: 3, due: 50, last: 200 } } };
     const c = { __v: 1, boxes: { k: { box: 2, seen: 6, good: 5, again: 1, due: 40, last: 100 } } };
     const once = T.mergeSystemDesign(l, c);
     const twice = T.mergeSystemDesign(once, c);
     const thrice = T.mergeSystemDesign(c, once);
     return { seen: once.boxes.k.seen, good: once.boxes.k.good, again: once.boxes.k.again,
              stable: JSON.stringify(once.boxes) === JSON.stringify(twice.boxes)
                   && JSON.stringify(once.boxes) === JSON.stringify(thrice.boxes) };`,
    { seen: 10, good: 7, again: 3, stable: true });

  await check('sysdesign: lastTopic/lastChapter prefer local',
    `const m = window.DrillSync._testInternals.mergeSystemDesign(
       { __v: 1, boxes: {}, lastTopic: 'ddia', lastChapter: 'ch03' },
       { __v: 1, boxes: {}, lastTopic: 'blocks', lastChapter: 'c01' });
     return { t: m.lastTopic, c: m.lastChapter };`,
    { t: 'ddia', c: 'ch03' });

  await check('sysdesign: local null passes cloud through',
    `const m = window.DrillSync._testInternals.mergeSystemDesign(null,
       { __v: 1, boxes: { k: { box: 2 } } });
     return m.boxes.k.box;`,
    2);

  await check('sysdesign: cloud null passes local through',
    `const m = window.DrillSync._testInternals.mergeSystemDesign(
       { __v: 1, boxes: { k: { box: 5 } } }, null);
     return m.boxes.k.box;`,
    5);

  await check('sysdesign: both null returns null; __v MAX otherwise',
    `const T = window.DrillSync._testInternals;
     const n = T.mergeSystemDesign(null, null);
     const m = T.mergeSystemDesign({ __v: 1, boxes: {} }, { __v: 3, boxes: {} });
     return { n: n, v: m.__v };`,
    { n: null, v: 3 });

  // ============================================================================
  // P0-2: cross-account guard decision function.
  // ============================================================================
  await check('signin-guard: same owner → merge; null owner → merge (bootstrap)',
    `const d = window.DrillSync._testInternals.decideSignInAction;
     return { same: d('uid-a', 'uid-a', true), fresh: d(null, 'uid-a', true) };`,
    { same: 'merge', fresh: 'merge' });

  await check('signin-guard: DIFFERENT owner with local data → confirm-replace (never auto-merge)',
    `return window.DrillSync._testInternals.decideSignInAction('uid-a', 'uid-b', true);`,
    'confirm-replace');

  await check('signin-guard: different owner but NO local data → merge (nothing to bleed)',
    `return window.DrillSync._testInternals.decideSignInAction('uid-a', 'uid-b', false);`,
    'merge');

  s.report();
  await s.close();
  const failed = s.assertions.filter(a => !a.ok).length;
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
