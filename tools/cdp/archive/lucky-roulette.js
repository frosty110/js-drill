#!/usr/bin/env node
// iter 108 — verifies 🍀 Lucky button at iPhone viewport.
// 1) Button is always visible (no auto-hide).
// 2) Tap routes to a not-yet-fully-mastered lesson at the first incomplete level.
// 3) Toast appears with the chosen lesson title.
// 4) Pool excludes mastered (mastering everything but one → that one always picks).
// 5) Mastered-only fallback — when all lessons are mastered, picks from any.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-lucky';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Phase 1: clean state → button visible (no auto-hide on this surface).
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

  const visible = await s.evalAwait(`(() => {
    const b = document.getElementById('lucky-btn');
    if (!b) return 'missing';
    const cs = getComputedStyle(b);
    return (cs.display !== 'none' && !b.classList.contains('hidden')) ? 'visible' : 'hidden';
  })()`);
  console.log(visible === 'visible' ? 'PASS: 🍀 Lucky button visible on clean state (always-on)' : `FAIL: button ${visible}`);

  // Phase 2: tap → routes to a not-yet-mastered lesson at L1.
  await s.evalAwait(`document.getElementById('lucky-btn').click()`);
  await s.sleep(400);

  const routed = await s.evalAwait(`(() => {
    const id = state.currentLessonId;
    const lesson = id ? findLesson(id) : null;
    return { id, tab: state.currentTab, mastered: lesson ? lessonOverallStatus(id) === 'mastered' : null };
  })()`);
  console.log(routed.id && !routed.mastered ? `PASS: routed to non-mastered lesson "${routed.id}"` : `FAIL: routed=${JSON.stringify(routed)}`);
  console.log(routed.tab === 'L1' ? `PASS: landed on L1 (first incomplete level)` : `FAIL: landed on tab "${routed.tab}"`);

  const toastShown = await s.evalAwait(`!!document.querySelector('.lucky-toast')`);
  console.log(toastShown ? 'PASS: 🍀 toast rendered after tap' : 'FAIL: no toast appeared');
  await s.snap('after-tap');

  // Phase 3: pool excludes mastered — when only ONE lesson is unmastered,
  // pickLuckyUnmastered should pick it deterministically across many tries.
  const ids = await s.evalAwait(`CURRICULUM.filter(l => l.status === 'full').slice(0, 3).map(l => l.id)`);
  if (!ids || ids.length < 3) { console.log('FAIL: need 3 full lessons'); process.exit(1); }
  const [keepUnmasteredId] = ids;
  await s.evalAwait(`(() => {
    // Mark every full lesson mastered EXCEPT the first one.
    CURRICULUM.filter(l => l.status === 'full').forEach(l => {
      if (l.id !== '${keepUnmasteredId}') {
        state.progress[l.id] = { L1: 'passed', L2: 'passed', L3: 'passed' };
      }
    });
    saveProgress();
  })()`);
  await s.sleep(150);

  const exclusionOk = await s.evalAwait(`(() => {
    // 20 tries — should land on keepUnmasteredId every time since it's the only unmastered.
    for (let i = 0; i < 20; i++) {
      const id = pickLuckyUnmastered();
      if (id !== '${keepUnmasteredId}') return { ok: false, badPick: id, iter: i };
    }
    return { ok: true };
  })()`);
  console.log(exclusionOk.ok ? 'PASS: pool excludes mastered (20/20 picks landed on the single unmastered)' : `FAIL: picked "${exclusionOk.badPick}" on iter ${exclusionOk.iter}`);

  // Phase 4: First-incomplete-level routing — when L1 is already passed on the
  // picked lesson, the click handler should land on L2 (or L3 if L2 also passed).
  // Mark L1 of keepUnmasteredId passed → next tap should land on L2.
  await s.evalAwait(`state.progress['${keepUnmasteredId}'] = { L1: 'passed' }; saveProgress();`);
  await s.evalAwait(`document.getElementById('lucky-btn').click()`);
  await s.sleep(400);
  const tabAfterL1Done = await s.evalAwait(`state.currentTab`);
  console.log(tabAfterL1Done === 'L2' ? 'PASS: landed on L2 when L1 already passed' : `FAIL: landed on "${tabAfterL1Done}"`);

  // Phase 5: All mastered → fallback to any authored lesson (graceful).
  await s.evalAwait(`(() => {
    CURRICULUM.filter(l => l.status === 'full').forEach(l => {
      state.progress[l.id] = { L1: 'passed', L2: 'passed', L3: 'passed' };
    });
    saveProgress();
  })()`);
  const fallbackId = await s.evalAwait(`pickLuckyUnmastered()`);
  console.log(fallbackId ? `PASS: graceful fallback when all mastered (picked "${fallbackId}")` : 'FAIL: returned null when all mastered');

  await s.snap('end');
  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
