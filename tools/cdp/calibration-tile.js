#!/usr/bin/env node
// iter 131 — verifies the ⏱ Calibration v2 Stats tile (iter-119 deferred
// follow-on). The iter-119 v1 ship captured calibration data per mechanic
// into state.timeCalibration.byMechanic[id].predictions[]; v2 is the
// visualization surface that shows top-5 most-miscalibrated mechanics by
// median errorSec. Auto-hides when no mechanic has ≥5 predictions yet.
//
// Phases:
// 1) Clean-progress state → Stats modal opens with NO calibration tile
//    (auto-hide invariant for empty data).
// 2) Seeded state with 5 predictions on one mechanic → tile renders with
//    1 row containing the mechanic label + median errorSec.
// 3) Seeded state with predictions on >5 mechanics → tile renders top-5
//    only, sorted by median errorSec descending (most-miscalibrated first).

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-calibration-tile';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // ── Phase 1: clean state → no calibration tile ────────────────────────
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null,
    timeCalibration: { byMechanic: {}, meta: { estimates: 0, skips: 0, passes: 0 } }
  }))`);
  await s.reload();
  await s.sleep(800);

  // Stats modal opens via topbar Insights → Stats (iter-128 path) — but
  // simpler/more direct: synth-click the existing #stats-btn (iter-129
  // kept all sidebar buttons in DOM, just visually hidden — they're
  // still .click()-able).
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(400);
  await s.snap('01-clean-state-no-tile');
  const cleanState = await s.evalAwait(`(() => {
    const modal = document.getElementById('stats-modal');
    const tile = document.querySelector('[data-calibration-tile]');
    return {
      modalOpen: modal && modal.style.display !== 'none' && modal.style.display !== '',
      tilePresent: !!tile
    };
  })()`);
  s.assert(cleanState.modalOpen, 'Stats modal opens via #stats-btn click');
  s.assert(!cleanState.tilePresent, 'Phase 1: Clean state → NO calibration tile (auto-hide invariant)');
  // iter 138: discovery hint surfaces when calibrateOn=false (the iter-131
  // tile auto-hide otherwise leaves the feature invisible to non-toggled
  // users; this hint tells them how to enable it).
  const hint = await s.evalAwait(`(() => {
    const el = document.querySelector('[data-calibration-hint]');
    return { present: !!el, text: el?.textContent.trim().slice(0, 60) || '' };
  })()`);
  s.assert(hint.present, 'iter 138: discovery hint rendered when calibrateOn=false');
  s.assert(/Calibration/.test(hint.text), `iter 138: hint mentions "Calibration" (got "${hint.text}")`);
  await s.evalAwait(`document.getElementById('stats-close').click()`);
  await s.sleep(200);

  // ── Phase 2: seed 5 predictions on one mechanic → tile shows 1 row ────
  // Pick a mechanic ID that's known to exist via the mechanics registry.
  // 'hash-complement' is the iter-72 canonical idiom tag for Two Sum.
  await s.evalAwait(`(() => {
    const seedPredictions = (n, baseError) => Array.from({length: n}, (_, i) => ({
      bucket: '<2', actualSec: 90 + i * 10, errorSec: baseError + i * 2, at: Date.now() - i * 60000
    }));
    state.timeCalibration.byMechanic['hash-complement'] = { predictions: seedPredictions(5, 30) };
    saveProgress();
  })()`);
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(400);
  await s.snap('02-one-mechanic-seeded');
  const oneMech = await s.evalAwait(`(() => {
    const tile = document.querySelector('[data-calibration-tile]');
    if (!tile) return { tilePresent: false };
    const rows = Array.from(tile.querySelectorAll('[data-cal-row]'));
    return {
      tilePresent: true,
      rowCount: rows.length,
      firstMechId: rows[0]?.dataset.mechId || null,
      firstRowText: rows[0]?.textContent.trim().replace(/\\s+/g, ' ') || ''
    };
  })()`);
  s.assert(oneMech.tilePresent, 'Phase 2: Calibration tile RENDERS with one mechanic at 5+ predictions');
  s.assert(oneMech.rowCount === 1, `Phase 2: Exactly 1 row in tile (got ${oneMech.rowCount})`);
  s.assert(oneMech.firstMechId === 'hash-complement', `Phase 2: row data-mech-id matches seeded ID (got "${oneMech.firstMechId}")`);
  s.assert(/\d+\s*[ms]\s*·\s*5×/.test(oneMech.firstRowText),
    `Phase 2: row shows median + "5×" count (got "${oneMech.firstRowText}")`);
  await s.evalAwait(`document.getElementById('stats-close').click()`);
  await s.sleep(200);

  // ── Phase 3: seed predictions on 7 mechanics with varying error magnitudes
  // → tile shows top-5 sorted by median errorSec descending ───────────────
  await s.evalAwait(`(() => {
    // Seed 7 mechanics with median errors 10, 20, 30, 40, 50, 60, 70 seconds.
    // Each gets 5 identical predictions so median equals the input.
    const mechs = ['mech-a', 'mech-b', 'mech-c', 'mech-d', 'mech-e', 'mech-f', 'mech-g'];
    const errors = [10, 20, 30, 40, 50, 60, 70];
    state.timeCalibration.byMechanic = {};
    for (let i = 0; i < mechs.length; i++) {
      state.timeCalibration.byMechanic[mechs[i]] = {
        predictions: Array.from({length: 5}, () => ({
          bucket: '<2', actualSec: 90, errorSec: errors[i], at: Date.now()
        }))
      };
    }
    saveProgress();
  })()`);
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(400);
  await s.snap('03-seven-mechanics-top-5');
  const topN = await s.evalAwait(`(() => {
    const tile = document.querySelector('[data-calibration-tile]');
    const rows = Array.from(tile.querySelectorAll('[data-cal-row]'));
    return {
      rowCount: rows.length,
      orderedIds: rows.map(r => r.dataset.mechId)
    };
  })()`);
  s.assert(topN.rowCount === 5, `Phase 3: Tile capped at top-5 even with 7 seeded mechanics (got ${topN.rowCount})`);
  // Highest errors first → mech-g (70s), mech-f (60s), mech-e (50s), mech-d (40s), mech-c (30s)
  const expectedOrder = ['mech-g', 'mech-f', 'mech-e', 'mech-d', 'mech-c'];
  s.assert(JSON.stringify(topN.orderedIds) === JSON.stringify(expectedOrder),
    `Phase 3: rows sorted by median errorSec DESC (most-miscalibrated first). Expected ${JSON.stringify(expectedOrder)}, got ${JSON.stringify(topN.orderedIds)}`);
  await s.evalAwait(`document.getElementById('stats-close').click()`);
  await s.sleep(200);

  // ── Phase 4: <5 predictions → tile still hides ───────────────────────
  // Re-seed all mechanics to have only 4 predictions each (under threshold).
  await s.evalAwait(`(() => {
    state.timeCalibration.byMechanic = {
      'mech-a': { predictions: Array.from({length: 4}, () => ({ bucket: '<2', actualSec: 90, errorSec: 50, at: Date.now() })) },
      'mech-b': { predictions: Array.from({length: 4}, () => ({ bucket: '<2', actualSec: 90, errorSec: 30, at: Date.now() })) }
    };
    saveProgress();
  })()`);
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(400);
  const underThreshold = await s.evalAwait(`!!document.querySelector('[data-calibration-tile]')`);
  s.assert(!underThreshold, 'Phase 4: <5 predictions per mechanic → tile auto-hides (threshold invariant)');

  await s.close();
  const r = s.report();
  process.exit(r.failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
