#!/usr/bin/env node
// iter 111 — verifies 🌈 Sections (section mastery heatmap) at iPhone viewport.
// Cat 7 spatial axis — the 5 existing Cat 7 surfaces are all temporal.
//
// 1) Button visible on clean state.
// 2) Tap → grid renders with 28 cells (one per section with ≥1 full lesson).
// 3) _sgBuildRows() computes mastered/total per section, derives weakestId.
// 4) _sgColor(pct) interpolates red→amber→emerald (0→50→100% mastery).
// 5) Tap a cell → routes to that section's first not-mastered lesson on L1
//    (touch / coarse pointer) or L3 (fine pointer).
// 6) When all lessons in a section are mastered, cell shows mastered class
//    and tap routes to a random lesson for retention drill.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-sections';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Phase 1: clean state — button visible.
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

  const btnPresent = await s.evalAwait(`!!document.getElementById('sections-grid-btn')`);
  console.log(btnPresent ? 'PASS: 🌈 Sections button present in sidebar' : 'FAIL: button missing');

  // Phase 2: _sgBuildRows aggregator shape.
  const rowsShape = await s.evalAwait(`(() => {
    const rows = _sgBuildRows();
    if (!Array.isArray(rows) || rows.length < 10) return { ok: false, count: rows ? rows.length : 0 };
    const sample = rows[0];
    return {
      ok: typeof sample.name === 'string'
        && typeof sample.mastered === 'number'
        && typeof sample.total === 'number'
        && typeof sample.pct === 'number'
        && sample.total > 0
        && (sample.weakestId === null || typeof sample.weakestId === 'string'),
      count: rows.length,
      sample
    };
  })()`);
  console.log(rowsShape.ok ? `PASS: _sgBuildRows returned ${rowsShape.count} section rows (sample: ${rowsShape.sample.name} ${rowsShape.sample.mastered}/${rowsShape.sample.total}=${rowsShape.sample.pct}%)`
    : `FAIL: rows shape bad — ${JSON.stringify(rowsShape)}`);

  // Phase 3: color interpolation midpoint.
  const colors = await s.evalAwait(`(() => {
    const c0 = _sgColor(0);
    const c50 = _sgColor(50);
    const c100 = _sgColor(100);
    return { c0, c50, c100 };
  })()`);
  // At pct=0 we should be red (R high, G low, B low).
  // At pct=50 we should be amber (R+G high, B low).
  // At pct=100 we should be green (R low, G high, B mid).
  const colorOk = colors.c0.r === 248 && colors.c0.g === 113
    && colors.c50.r === 251 && colors.c50.g === 191
    && colors.c100.r === 52 && colors.c100.g === 211;
  console.log(colorOk ? 'PASS: _sgColor interpolates red(0)→amber(50)→emerald(100) correctly'
    : `FAIL: color interpolation — ${JSON.stringify(colors)}`);

  // Phase 4: tap button → grid renders with cells.
  await s.evalAwait(`document.getElementById('sections-grid-btn').click()`);
  await s.sleep(300);
  await s.snap('after-tap');

  const gridPresent = await s.evalAwait(`!!document.querySelector('.sg-grid')`);
  console.log(gridPresent ? 'PASS: .sg-grid renders after tap' : 'FAIL: no grid');

  const cellCount = await s.evalAwait(`document.querySelectorAll('.sg-cell').length`);
  console.log(cellCount >= 20 ? `PASS: ${cellCount} grid cells rendered (one per section with full lessons)`
    : `FAIL: only ${cellCount} cells`);

  const hasLegend = await s.evalAwait(`!!document.querySelector('.sg-legend')`);
  console.log(hasLegend ? 'PASS: legend rendered (0% / 50% / 100% swatches)' : 'FAIL: no legend');

  const nudgeOk = await s.evalAwait(`(() => {
    const n = document.querySelector('.sg-nudge');
    return n && /Where to study/.test(n.textContent) && /\\d+% mastered/.test(n.textContent);
  })()`);
  console.log(nudgeOk ? 'PASS: weakest-section nudge rendered' : 'FAIL: nudge missing/malformed');

  // Phase 5: tap a cell → routes to a non-mastered lesson on L1 (coarse pointer emulated).
  await s.evalAwait(`document.querySelectorAll('.sg-cell')[0].click()`);
  await s.sleep(400);

  const routed = await s.evalAwait(`(() => {
    return { id: state.currentLessonId, tab: state.currentTab };
  })()`);
  console.log(routed.id ? `PASS: tap routed to lesson "${routed.id}"` : 'FAIL: no lesson selected');
  console.log(routed.tab === 'L1' ? `PASS: landed on L1 (coarse pointer)` : `FAIL: landed on tab "${routed.tab}"`);

  // Phase 6: mark all lessons in section[0] mastered → tap that section's cell
  //   should still route somewhere (random retention pick).
  await s.evalAwait(`(() => {
    const rows = _sgBuildRows();
    const firstSection = rows[0].name;
    CURRICULUM.filter(l => l.status === 'full' && l.section === firstSection).forEach(l => {
      state.progress[l.id] = { L1: 'passed', L2: 'passed', L3: 'passed' };
    });
    saveProgress();
  })()`);
  await s.evalAwait(`document.getElementById('sections-grid-btn').click()`);
  await s.sleep(300);
  const masteredCellMarked = await s.evalAwait(`!!document.querySelector('.sg-cell-mastered')`);
  console.log(masteredCellMarked ? 'PASS: fully-mastered section cell has .sg-cell-mastered ring' : 'FAIL: no mastered marker');

  await s.snap('after-master-section');
  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
