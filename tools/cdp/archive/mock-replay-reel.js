#!/usr/bin/env node
// Verifies iter-61 Mock Replay Reel at iPhone viewport: existing chrono
// trendBadge cells become individually tappable; tap reveals a per-attempt
// detail tile with attempt index + time + delta-vs-best. A slope badge
// shows "→ holding" / "↓ Xs faster vs first" / "↑ Ys slower vs first".
// Sourced from iter-59 roadmap entry #2 (shipped iter 61).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-mock-reel';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed a clean state with mock history on one syntax lesson (3 attempts).
  // Need a full lesson with L3 present; use the first full lesson.
  const lessonId = await s.evalAwait(`(CURRICULUM.find(l => l.status === 'full') || {}).id || null`);
  if (!lessonId) { console.log('FAIL: no full lesson available'); process.exit(1); }

  // Seed: 4 attempts on this lesson — 5:00, 4:30, 4:00, 4:10 (improving overall).
  // bestTimes = 4:00 = 240000 ms; mockHistory = [300000, 270000, 240000, 250000].
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: { '${lessonId}': { L1: 'passed', L2: 'passed', L3: 'passed' } },
    bestTimes: { '${lessonId}': 240000 },
    mockHistory: { '${lessonId}': [300000, 270000, 240000, 250000] },
    revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: '${lessonId}', lastTab: 'L3'
  }))`);
  await s.reload();
  await s.sleep(800);
  // Navigate to L3 tab (boot may resolve 'auto' differently if conversation/walkthrough present).
  await s.evalAwait(`selectLesson('${lessonId}'); selectTab('L3');`);
  await s.sleep(800);
  await s.snap('l3-with-history');

  // Assert 1: 4 reel cells render.
  const cellCount = await s.evalAwait(`document.querySelectorAll('.mock-reel-cell').length`);
  console.log(cellCount === 4 ? 'PASS: 4 mock-reel cells render (one per attempt)' : `FAIL: ${cellCount} cells, expected 4`);

  // Assert 2: slope badge shows ↓ improving (last 250000 vs first 300000 = 50000 ms faster, 16.6% of first).
  const slopeText = await s.evalAwait(`Array.from(document.querySelectorAll('.pill')).map(p => p.textContent).join(' | ')`);
  console.log(slopeText.includes('↓') && /faster vs first/i.test(slopeText) ? 'PASS: ↓ improving slope badge rendered' : `FAIL: slope text "${slopeText.slice(0,150)}"`);

  // Assert 3: best-time cell has the ★ marker (3rd attempt = 240000 = bestMs).
  const thirdCellText = await s.evalAwait(`document.querySelectorAll('.mock-reel-cell')[2]?.textContent || ''`);
  console.log(thirdCellText.includes('★') ? 'PASS: best-time cell shows ★ marker' : `FAIL: 3rd cell "${thirdCellText}"`);

  // Assert 4: tap the first cell — tile appears with "Attempt 1 of 4".
  await s.evalAwait(`document.querySelectorAll('.mock-reel-cell')[0].click()`);
  await s.sleep(200);
  await s.snap('tile-attempt-1');

  const tileVisible = await s.evalAwait(`!document.querySelector('[data-mock-reel-tile]')?.classList.contains('hidden')`);
  console.log(tileVisible ? 'PASS: reel tile visible after tap' : 'FAIL: tile still hidden');

  const tileText = await s.evalAwait(`document.querySelector('[data-mock-reel-tile]')?.textContent || ''`);
  console.log(tileText.includes('Attempt 1 of 4') ? 'PASS: tile shows "Attempt 1 of 4"' : `FAIL: tile "${tileText.slice(0,120)}"`);

  // Assert 5: tile shows delta-from-best for non-best attempt.
  console.log(tileText.includes('from best') ? 'PASS: tile shows delta from best' : `FAIL: no delta in tile`);

  // Assert 6: tap third cell (the best) — tile shows ★ Personal best.
  await s.evalAwait(`document.querySelectorAll('.mock-reel-cell')[2].click()`);
  await s.sleep(200);
  const tileBestText = await s.evalAwait(`document.querySelector('[data-mock-reel-tile]')?.textContent || ''`);
  console.log(tileBestText.includes('Personal best') ? 'PASS: best-attempt tile shows ★ Personal best' : `FAIL: best tile "${tileBestText.slice(0,120)}"`);

  // Assert 7: tap same cell again — tile hides (toggle behavior).
  await s.evalAwait(`document.querySelectorAll('.mock-reel-cell')[2].click()`);
  await s.sleep(200);
  const tileHiddenAfterRetap = await s.evalAwait(`document.querySelector('[data-mock-reel-tile]')?.classList.contains('hidden')`);
  console.log(tileHiddenAfterRetap ? 'PASS: re-tap same cell hides tile (toggle off)' : 'FAIL: tile still visible after re-tap');

  // Assert 8: active-cell class is removed when tile hides.
  const noActive = await s.evalAwait(`document.querySelectorAll('.mock-reel-cell-active').length === 0`);
  console.log(noActive ? 'PASS: active-cell class cleared after tile toggle-off' : 'FAIL: active class persists');

  // Assert 9: history with only 1 attempt → no reel (existing behavior preserved).
  await s.evalAwait(`(() => {
    state.mockHistory['${lessonId}'] = [300000];
    saveProgress();
    selectTab('L3');
  })()`);
  await s.sleep(400);
  const noReelOneAttempt = await s.evalAwait(`document.querySelectorAll('.mock-reel-cell').length === 0`);
  console.log(noReelOneAttempt ? 'PASS: ≤1 attempt → no reel rendered (matches existing threshold)' : 'FAIL: reel visible with only 1 attempt');

  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
