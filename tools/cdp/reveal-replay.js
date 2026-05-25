#!/usr/bin/env node
// Verifies iter-56 🃏 Reveal Replay at iPhone viewport: the sidebar button
// appears only when state.revealed has entries; tap routes to the next
// revealed lesson at the revealed level; the clean-pass invariant in
// markPassed clears the reveal flag when the user passes a previously-
// revealed level without re-revealing in the current attempt.
// Sourced from iter-55 roadmap entry #2 (constraint-aware reframe, shipped iter 56).

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-reveal-replay';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // ─────────────────────────────────────────────────────────────
  // Phase 1: clean state — button must be HIDDEN.
  // ─────────────────────────────────────────────────────────────
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(500);
  await s.snap('boot-clean-no-reveals');

  const btnHiddenClean = await s.evalAwait(`document.getElementById('reveal-replay-btn')?.classList.contains('hidden')`);
  console.log(btnHiddenClean ? 'PASS: 🃏 Reveal Replay button HIDDEN when revealed map is empty' : 'FAIL: button visible with no reveals');

  // ─────────────────────────────────────────────────────────────
  // Phase 2: seed a revealed entry — button must appear with count 1.
  // ─────────────────────────────────────────────────────────────
  // Pick the first full Syntax lesson via the in-page CURRICULUM so we know
  // it exists and is reachable.
  const targetId = await s.evalAwait(`(CURRICULUM.find(l => l.track === 'syntax' && l.status === 'full') || {}).id || null`);
  if (!targetId) {
    console.log('FAIL: no syntax full lesson available to seed');
    process.exit(1);
  }
  await s.evalAwait(`state.revealed['${targetId}'] = { L2: true }; saveProgress(); state.progress['${targetId}'] = state.progress['${targetId}'] || {}; state.progress['${targetId}'].L1 = 'passed'; state.progress['${targetId}'].L2 = 'passed'; state.progress['${targetId}'].L3 = 'passed'; saveProgress(); updateReviewBadge();`);
  await s.sleep(200);
  await s.snap('after-seed');

  const btnVisible = await s.evalAwait(`!document.getElementById('reveal-replay-btn')?.classList.contains('hidden')`);
  console.log(btnVisible ? 'PASS: 🃏 button visible after seeding 1 reveal' : 'FAIL: button stayed hidden');

  const count = await s.evalAwait(`document.getElementById('reveal-replay-count')?.textContent || '0'`);
  console.log(count === '1' ? 'PASS: count shows 1' : `FAIL: count = "${count}"`);

  // ─────────────────────────────────────────────────────────────
  // Phase 3: tap the button — should route to the revealed lesson at L2.
  // ─────────────────────────────────────────────────────────────
  await s.evalAwait(`document.getElementById('reveal-replay-btn').click()`);
  await s.sleep(700);
  await s.snap('after-tap-routed');

  const routedId = await s.evalAwait(`state.currentLessonId`);
  console.log(routedId === targetId ? `PASS: routed to seeded lesson (${routedId})` : `FAIL: routed to "${routedId}", expected "${targetId}"`);

  const routedTab = await s.evalAwait(`state.currentTab`);
  console.log(routedTab === 'L2' ? 'PASS: routed to L2 tab (the revealed level)' : `FAIL: currentTab = "${routedTab}"`);

  // ─────────────────────────────────────────────────────────────
  // Phase 4: clean-pass invariant — markPassed(id, 'L2') without prior
  // markRevealed in this attempt must clear the revealed flag and demote
  // the dot. Toast should appear.
  // ─────────────────────────────────────────────────────────────
  await s.evalAwait(`markPassed('${targetId}', 'L2')`);
  await s.sleep(400);
  await s.snap('after-clean-pass');

  const stillRevealed = await s.evalAwait(`!!(state.revealed['${targetId}'] && state.revealed['${targetId}'].L2)`);
  console.log(!stillRevealed ? 'PASS: reveal flag cleared on clean pass' : 'FAIL: reveal flag still set after clean pass');

  const toastPresent = await s.evalAwait(`!!document.querySelector('.reveal-cleared-toast')`);
  console.log(toastPresent ? 'PASS: clean-pass toast rendered' : 'FAIL: toast not visible');

  const btnHiddenAfterClear = await s.evalAwait(`document.getElementById('reveal-replay-btn')?.classList.contains('hidden')`);
  console.log(btnHiddenAfterClear ? 'PASS: 🃏 button hidden again after queue drained' : 'FAIL: button still visible after clear');

  // ─────────────────────────────────────────────────────────────
  // Phase 5: negative case — markRevealed in current attempt MUST suppress
  // the clean-pass clear (revealed flag survives the next pass).
  // ─────────────────────────────────────────────────────────────
  await s.evalAwait(`markRevealed('${targetId}', 'L3'); markPassed('${targetId}', 'L3');`);
  await s.sleep(200);
  const flagSurvived = await s.evalAwait(`!!(state.revealed['${targetId}'] && state.revealed['${targetId}'].L3)`);
  console.log(flagSurvived ? 'PASS: reveal-in-attempt suppresses clean-pass clear (flag survives)' : 'FAIL: clean-pass cleared a flag the user re-revealed');

  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
