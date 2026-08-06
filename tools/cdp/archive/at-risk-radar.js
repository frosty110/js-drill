#!/usr/bin/env node
// Verifies iter-60 📡 At Risk decay-radar at iPhone viewport: button hidden
// in clean state; appears with count after seeding weakness OR revealed;
// modal opens with sorted rows (due-now first, then by daysTilDue ascending);
// tap row routes to lesson; modal closes; button auto-hides when union
// drains. Sourced from iter-59 roadmap entry #1 (shipped iter 60).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-at-risk';

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
    reviews: {}, weakness: {}, history: {}, misses: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(500);
  await s.snap('boot-clean');

  const btnHiddenClean = await s.evalAwait(`document.getElementById('at-risk-btn')?.classList.contains('hidden')`);
  console.log(btnHiddenClean ? 'PASS: 📡 At Risk button HIDDEN with empty union' : 'FAIL: button visible with no risks');

  // ─────────────────────────────────────────────────────────────
  // Phase 2: seed 3 entries with different urgency profiles.
  //   - lesson A: weakness only (no SR)
  //   - lesson B: weakness + due-now SR
  //   - lesson C: revealed flag only
  // ─────────────────────────────────────────────────────────────
  const seedIds = await s.evalAwait(`(() => {
    const full = CURRICULUM.filter(l => l.status === 'full').slice(0, 3);
    return full.map(l => l.id);
  })()`);
  if (!seedIds || seedIds.length < 3) {
    console.log('FAIL: need 3 full lessons to seed test cases');
    process.exit(1);
  }
  const [A, B, C] = seedIds;
  const now = Date.now();
  await s.evalAwait(`(() => {
    state.weakness['${A}'] = 2;
    state.weakness['${B}'] = 1;
    state.progress['${B}'] = { L1: 'passed', L2: 'passed', L3: 'passed' };
    state.reviews['${B}'] = { lastPassedAt: ${now} - 5*86400000, interval: 86400000, dueAt: ${now} - 86400000 };  // due-now
    state.revealed['${C}'] = { L2: true };
    state.progress['${C}'] = { L1: 'passed', L2: 'passed', L3: 'passed' };
    saveProgress();
    updateReviewBadge();
  })()`);
  await s.sleep(200);
  await s.snap('after-seed');

  // Assert 1: button visible.
  const btnVisible = await s.evalAwait(`!document.getElementById('at-risk-btn')?.classList.contains('hidden')`);
  console.log(btnVisible ? 'PASS: button visible after seeding' : 'FAIL: button stayed hidden');

  // Assert 2: count shows 3.
  const count = await s.evalAwait(`document.getElementById('at-risk-count')?.textContent || '0'`);
  console.log(count === '3' ? 'PASS: count shows 3' : `FAIL: count = "${count}"`);

  // Assert 3: open modal.
  await s.evalAwait(`document.getElementById('at-risk-btn').click()`);
  await s.sleep(300);
  await s.snap('modal-open');

  const modalOpen = await s.evalAwait(`document.getElementById('at-risk-modal')?.style.display === 'block'`);
  console.log(modalOpen ? 'PASS: modal opened on click' : 'FAIL: modal not visible');

  // Assert 4: 3 rows present.
  const rowCount = await s.evalAwait(`document.querySelectorAll('#at-risk-body [data-lesson-id]').length`);
  console.log(rowCount === 3 ? 'PASS: 3 rows rendered' : `FAIL: ${rowCount} rows, expected 3`);

  // Assert 5: first row is the due-now lesson (B).
  const firstRowId = await s.evalAwait(`document.querySelector('#at-risk-body [data-lesson-id]')?.getAttribute('data-lesson-id')`);
  console.log(firstRowId === B ? `PASS: due-now lesson sorted first (${firstRowId})` : `FAIL: first row "${firstRowId}", expected "${B}"`);

  // Assert 6: first row shows "DUE NOW" chip.
  const firstRowText = await s.evalAwait(`document.querySelector('#at-risk-body [data-lesson-id]')?.textContent || ''`);
  console.log(firstRowText.includes('DUE NOW') ? 'PASS: due-now chip rendered on first row' : `FAIL: due chip missing in "${firstRowText.slice(0,100)}"`);

  // Assert 7: revealed lesson row shows 🃏 marker.
  const hasRevealMarker = await s.evalAwait(`(document.getElementById('at-risk-body')?.textContent || '').includes('🃏')`);
  console.log(hasRevealMarker ? 'PASS: 🃏 reveal marker rendered for revealed lesson' : 'FAIL: no 🃏 marker found');

  // Assert 8: tap first row routes to that lesson.
  await s.evalAwait(`document.querySelector('#at-risk-body [data-lesson-id]').click()`);
  await s.sleep(500);
  const routedId = await s.evalAwait(`state.currentLessonId`);
  console.log(routedId === B ? `PASS: tap routed to ${routedId}` : `FAIL: routed to "${routedId}", expected "${B}"`);

  // Assert 9: modal closed after tap.
  const modalClosed = await s.evalAwait(`document.getElementById('at-risk-modal')?.style.display === 'none'`);
  console.log(modalClosed ? 'PASS: modal closed after row tap' : 'FAIL: modal still open');

  // Assert 10: drain weakness + revealed → button hides.
  await s.evalAwait(`(() => {
    state.weakness = {};
    state.revealed = {};
    saveProgress();
    updateReviewBadge();
  })()`);
  await s.sleep(200);
  const btnHiddenDrained = await s.evalAwait(`document.getElementById('at-risk-btn')?.classList.contains('hidden')`);
  console.log(btnHiddenDrained ? 'PASS: button hides when union drains' : 'FAIL: button still visible after drain');

  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
