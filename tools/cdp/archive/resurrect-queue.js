#!/usr/bin/env node
// Verifies iter-65 💀 Resurrect Queue at iPhone viewport: button hidden when
// no mastered lesson is past 2× its SR interval; visible with count after
// seeding a long-overdue lesson; tap routes to that lesson.
// Sourced from iter-64 roadmap entry #1 (shipped iter 65).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-resurrect';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Phase 1: clean state → button HIDDEN.
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(500);

  const cleanHidden = await s.evalAwait(`document.getElementById('resurrect-btn')?.classList.contains('hidden')`);
  console.log(cleanHidden ? 'PASS: 💀 button HIDDEN with no overdue mastered lessons' : 'FAIL: button visible on clean state');

  // Phase 2: seed two lessons — one mastered + long-overdue, one mastered + only-just-due.
  // Only the long-overdue one should populate the Resurrect Queue.
  const ids = await s.evalAwait(`CURRICULUM.filter(l => l.status === 'full').slice(0, 2).map(l => l.id)`);
  if (!ids || ids.length < 2) { console.log('FAIL: need 2 full lessons'); process.exit(1); }
  const [overdueId, justDueId] = ids;
  const now = Date.now();
  await s.evalAwait(`(() => {
    state.progress['${overdueId}'] = { L1: 'passed', L2: 'passed', L3: 'passed' };
    state.reviews['${overdueId}'] = { lastPassedAt: ${now - 100*86400000}, interval: 86400000, dueAt: ${now - 5*86400000} };
    state.progress['${justDueId}'] = { L1: 'passed', L2: 'passed', L3: 'passed' };
    state.reviews['${justDueId}'] = { lastPassedAt: ${now - 2*86400000}, interval: 86400000, dueAt: ${now - 100} };
    saveProgress();
    updateReviewBadge();
  })()`);
  await s.sleep(200);
  await s.snap('after-seed');

  const visible = await s.evalAwait(`!document.getElementById('resurrect-btn')?.classList.contains('hidden')`);
  console.log(visible ? 'PASS: 💀 button visible after seeding overdue lesson' : 'FAIL: still hidden');

  const count = await s.evalAwait(`document.getElementById('resurrect-count')?.textContent`);
  console.log(count === '1' ? 'PASS: count = 1 (only the long-overdue one)' : `FAIL: count = "${count}"`);

  // Phase 3: tap → jumps to overdue lesson.
  await s.evalAwait(`document.getElementById('resurrect-btn').click()`);
  await s.sleep(500);
  const routed = await s.evalAwait(`state.currentLessonId`);
  console.log(routed === overdueId ? 'PASS: tap routed to overdue lesson' : `FAIL: routed to "${routed}", expected "${overdueId}"`);

  // Phase 4: pass the lesson → resurrect ids no longer include it (mastered + scheduleReview updates dueAt forward).
  await s.evalAwait(`markPassed('${overdueId}', 'L3')`);
  await s.sleep(200);
  const drained = await s.evalAwait(`resurrectIds().length === 0`);
  console.log(drained ? 'PASS: queue drains after L3 pass on the overdue lesson' : 'FAIL: still in queue after pass');

  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
