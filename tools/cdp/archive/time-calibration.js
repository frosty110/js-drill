#!/usr/bin/env node
// iter 119 — verifies ⏱ Time-to-Solve Calibration at iPhone viewport.
// Opt-in pre-L3 estimate strip + post-pass per-mechanic delta capture.
//
// 1) Toggle defaults OFF; sidebar button present.
// 2) Toggle ON, navigate to a Patterns lesson L3 → estimate strip renders.
// 3) Tap a bucket → strip removed + state.timeCalibration.meta.estimates++.
// 4) L3 pass → state.timeCalibration.byMechanic[id].predictions appended for each mechanic tag + meta.passes++.
// 5) Skip path: re-engage strip via toggle reset, then tap Skip → meta.skips++ + strip gone + no prediction recorded.
// 6) Toggle OFF → no strip on subsequent L3 visit.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-calibration';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    calibrateOn: false,
    timeCalibration: { byMechanic: {}, meta: { estimates: 0, skips: 0, passes: 0 } },
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);

  console.log(await s.evalAwait(`!!document.getElementById('calibrate-btn')`) ? 'PASS: ⏱ Calibrate sidebar button present' : 'FAIL: button missing');
  console.log(await s.evalAwait(`state.calibrateOn === false`) ? 'PASS: calibrateOn defaults false' : 'FAIL: default wrong');

  // Toggle ON.
  await s.evalAwait(`document.getElementById('calibrate-btn').click()`);
  await s.sleep(100);
  console.log(await s.evalAwait(`state.calibrateOn === true`) ? 'PASS: toggle flips flag to true' : 'FAIL: toggle did not flip');

  // Navigate to two-sum L3.
  const lessonId = 'two-sum';
  await s.evalAwait(`selectLesson('${lessonId}')`);
  for (let i = 0; i < 10; i++) {
    await s.sleep(400);
    if (await s.evalAwait(`!!CONTENT['${lessonId}']`)) break;
  }
  await s.evalAwait(`selectTab('L3')`);
  await s.sleep(600);

  const stripState = await s.evalAwait(`(() => {
    const strip = document.querySelector('.calib-strip');
    const buckets = document.querySelectorAll('.calib-bucket');
    return { stripPresent: !!strip, bucketCount: buckets.length, hasSkip: !!document.querySelector('.calib-skip') };
  })()`);
  console.log(stripState.stripPresent ? 'PASS: .calib-strip renders on L3 visit' : 'FAIL: strip missing');
  console.log(stripState.bucketCount === 4 ? 'PASS: 4 estimate buckets rendered' : `FAIL: ${stripState.bucketCount} buckets (expected 4)`);
  console.log(stripState.hasSkip ? 'PASS: Skip button present' : 'FAIL: Skip missing');
  await s.snap('strip-shown');

  // Tap bucket "2to5" → strip removed + estimates++ + active entry set.
  await s.evalAwait(`document.querySelector('.calib-bucket[data-bucket="2to5"]').click()`);
  await s.sleep(150);
  const afterTap = await s.evalAwait(`({
    stripGone: !document.querySelector('.calib-strip'),
    estimates: state.timeCalibration.meta.estimates,
    activeBucket: _calibrationActive['${lessonId}']?.bucket || null
  })`);
  console.log(afterTap.stripGone ? 'PASS: strip removed after bucket tap' : 'FAIL: strip persisted');
  console.log(afterTap.estimates === 1 ? `PASS: meta.estimates = 1` : `FAIL: estimates = ${afterTap.estimates}`);
  console.log(afterTap.activeBucket === '2to5' ? 'PASS: _calibrationActive recorded "2to5"' : `FAIL: activeBucket = ${afterTap.activeBucket}`);

  // Mark L3 pass → predictions appended per mechanic.
  await s.evalAwait(`markPassed('${lessonId}', 'L3')`);
  await s.sleep(200);
  const afterPass = await s.evalAwait(`(() => {
    const byMech = state.timeCalibration.byMechanic;
    const keys = Object.keys(byMech);
    const totalPreds = keys.reduce((acc, k) => acc + (byMech[k].predictions?.length || 0), 0);
    return {
      mechCount: keys.length,
      totalPreds,
      passes: state.timeCalibration.meta.passes,
      activeCleared: !_calibrationActive['${lessonId}']
    };
  })()`);
  console.log(afterPass.mechCount >= 1 ? `PASS: ${afterPass.mechCount} mechanics recorded predictions` : `FAIL: ${afterPass.mechCount} mechanics`);
  console.log(afterPass.totalPreds >= 1 ? `PASS: ≥1 prediction stored (got ${afterPass.totalPreds})` : `FAIL: ${afterPass.totalPreds} predictions`);
  console.log(afterPass.passes === 1 ? `PASS: meta.passes = 1` : `FAIL: passes = ${afterPass.passes}`);
  console.log(afterPass.activeCleared ? 'PASS: _calibrationActive cleared after pass' : 'FAIL: active entry leaked');

  // Skip path: clear session memory + reset progress so strip re-engages.
  // Easiest: toggle OFF/ON, which clears the in-memory Set.
  await s.evalAwait(`document.getElementById('calibrate-btn').click()`);  // OFF
  await s.sleep(80);
  await s.evalAwait(`document.getElementById('calibrate-btn').click()`);  // ON, clears Sets
  await s.sleep(80);
  // selectTab to re-render L3 with strip re-engaged.
  await s.evalAwait(`selectTab('reference')`);
  await s.sleep(150);
  await s.evalAwait(`selectTab('L3')`);
  await s.sleep(400);
  console.log(await s.evalAwait(`!!document.querySelector('.calib-strip')`) ? 'PASS: strip re-engages after toggle reset' : 'FAIL: strip did not re-engage');

  await s.evalAwait(`document.querySelector('.calib-skip').click()`);
  await s.sleep(150);
  const afterSkip = await s.evalAwait(`({
    stripGone: !document.querySelector('.calib-strip'),
    skips: state.timeCalibration.meta.skips
  })`);
  console.log(afterSkip.stripGone ? 'PASS: strip removed after Skip' : 'FAIL: strip persisted on skip');
  console.log(afterSkip.skips === 1 ? `PASS: meta.skips = 1` : `FAIL: skips = ${afterSkip.skips}`);

  // Toggle OFF → no strip on a fresh lesson.
  await s.evalAwait(`document.getElementById('calibrate-btn').click()`);  // OFF
  await s.sleep(80);
  await s.evalAwait(`selectLesson('p-contains-dup')`);
  for (let i = 0; i < 8; i++) {
    await s.sleep(400);
    if (await s.evalAwait(`!!CONTENT['p-contains-dup']`)) break;
  }
  await s.evalAwait(`selectTab('L3')`);
  await s.sleep(400);
  console.log(!await s.evalAwait(`!!document.querySelector('.calib-strip')`) ? 'PASS: toggle OFF skips strip on fresh lesson' : 'FAIL: strip showed with toggle OFF');

  await s.snap('end');
  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
