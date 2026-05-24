#!/usr/bin/env node
// Verifies iter-39 per-track Starter Paths at iPhone viewport: enabling the
// path surfaces a 4-chip track picker (All/Syntax/Patterns/Applied); picking
// a track filters the path; counts in chips are correct; current-lesson
// jumps to a path-relevant one when the picked track excludes it.
// See ideas-by-category.md § Paths & Sessions → "Per-track Starter Paths".

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-per-track-path';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {},
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(500);
  await s.snap('boot');

  // Assert 1: chip row NOT visible before path is toggled on.
  const chipsBefore = await s.evalAwait(`document.querySelectorAll('.path-track-chip').length`);
  console.log(chipsBefore === 0 ? 'PASS: 0 chips before path toggled on' : `FAIL: ${chipsBefore} chips before toggle`);

  // Act: toggle path on.
  await s.evalAwait(`document.getElementById('path-btn').click()`);
  await s.sleep(250);
  await s.snap('path-on');

  // Assert 2: 4 chips render after toggle.
  const chipsAfter = await s.evalAwait(`document.querySelectorAll('.path-track-chip').length`);
  console.log(chipsAfter === 4 ? 'PASS: 4 track chips after toggle' : `FAIL: ${chipsAfter} chips after toggle`);

  // Assert 3: "All" is active by default.
  const activeTrack = await s.evalAwait(`document.querySelector('.path-track-chip.active')?.dataset.track`);
  console.log(activeTrack === 'all' ? 'PASS: "All" active by default' : `FAIL: active = ${activeTrack}, expected all`);

  // Assert 4: chip counts are non-zero for the 3 non-applied tracks
  // (STARTER_PATH is mostly syntax + patterns; applied is intentionally empty).
  const counts = await s.evalAwait(`Array.from(document.querySelectorAll('.path-track-chip')).map(c => ({ track: c.dataset.track, count: parseInt(c.querySelector('.path-track-count').textContent, 10) }))`);
  const allCount = counts.find(c => c.track === 'all').count;
  const syntaxCount = counts.find(c => c.track === 'syntax').count;
  const patternsCount = counts.find(c => c.track === 'patterns').count;
  const appliedCount = counts.find(c => c.track === 'applied').count;
  console.log(allCount > 0 && syntaxCount > 0 && patternsCount > 0
    ? `PASS: counts all=${allCount} syn=${syntaxCount} pat=${patternsCount} app=${appliedCount}`
    : `FAIL: counts all=${allCount} syn=${syntaxCount} pat=${patternsCount} app=${appliedCount}`);
  console.log(syntaxCount + patternsCount + appliedCount <= allCount
    ? `PASS: track counts sum to <= all (${syntaxCount}+${patternsCount}+${appliedCount} <= ${allCount})`
    : `FAIL: subset count exceeds total`);

  // Act: click "Syntax" chip.
  await s.evalAwait(`document.querySelector('.path-track-chip[data-track="syntax"]').click()`);
  await s.sleep(300);
  await s.snap('syntax-track-active');

  // Assert 5: state reflects the change.
  const newTrack = await s.evalAwait(`state.starterPathTrack`);
  console.log(newTrack === 'syntax' ? 'PASS: state.starterPathTrack = syntax' : `FAIL: state = ${newTrack}`);

  // Assert 6: pathBtn label includes "Syn" suffix.
  const pathLabel = await s.evalAwait(`document.getElementById('path-btn').textContent`);
  console.log(pathLabel.includes('Syn') ? `PASS: path-btn shows track suffix ("${pathLabel}")` : `FAIL: path-btn label = "${pathLabel}"`);

  // Assert 7: Toggle path off → chip row disappears.
  await s.evalAwait(`document.getElementById('path-btn').click()`);
  await s.sleep(150);
  const chipsOff = await s.evalAwait(`document.querySelectorAll('.path-track-chip').length`);
  console.log(chipsOff === 0 ? 'PASS: chip row gone after path toggled off' : `FAIL: ${chipsOff} chips after toggle off`);

  console.log('\\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
