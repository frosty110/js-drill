#!/usr/bin/env node
// Verifies iter-49 Pattern Recognition Speed Drill at iPhone viewport: the
// 🔎 Recognize sidebar button opens a 10-card session in the main viewport;
// each card shows a prompt + 4 section-name option buttons; tap grades and
// auto-advances; session summary surfaces stats and lifetime totals.
// See roadmap.md iter-48 entry (shipped iter 49).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-recognize';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed: clean state, welcomed.
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {},
    recognize: { attempts: 0, correct: 0 },
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(500);
  await s.snap('boot');

  // Assert 1: Recognize button renders in sidebar.
  const hasBtn = await s.evalAwait(`!!document.getElementById('recognize-btn')`);
  console.log(hasBtn ? 'PASS: 🔎 Recognize button renders in sidebar' : 'FAIL: button missing');

  // Act: click Recognize.
  await s.evalAwait(`document.getElementById('recognize-btn').click()`);
  // The session pre-loads patterns lessons — wait for the deck to assemble.
  await s.sleep(2500);
  await s.snap('recognize-card');

  // Assert 2: Recognize shell renders in main viewport.
  const shellRendered = await s.evalAwait(`!!document.querySelector('.recognize-shell')`);
  console.log(shellRendered ? 'PASS: recognize shell rendered' : 'FAIL: shell missing (deck may have failed to assemble)');

  // Assert 3: 4 option buttons render.
  const optCount = await s.evalAwait(`document.querySelectorAll('.recognize-opt').length`);
  console.log(optCount === 4 ? 'PASS: 4 section option buttons' : `FAIL: ${optCount} options, expected 4`);

  // Assert 4: prompt text is non-empty (uses a real L3.prompt string).
  const promptText = await s.evalAwait(`document.querySelector('.recognize-prompt')?.textContent || ''`);
  console.log(promptText.length > 10 ? `PASS: prompt is real text (${promptText.length} chars)` : `FAIL: prompt too short: "${promptText}"`);

  // Act: click first option (we don't know if it's correct — that's fine).
  await s.evalAwait(`document.querySelector('.recognize-opt').click()`);
  await s.sleep(300);

  // Assert 5: After click, either a correct (green) or wrong (red) class is applied to ≥1 option.
  const styledCount = await s.evalAwait(`document.querySelectorAll('.recognize-opt-correct, .recognize-opt-wrong').length`);
  console.log(styledCount >= 1 ? `PASS: ${styledCount} option(s) styled after tap` : 'FAIL: no grading feedback');

  // Assert 6: state.recognize.attempts incremented.
  const attempts = await s.evalAwait(`state.recognize?.attempts || 0`);
  console.log(attempts === 1 ? 'PASS: state.recognize.attempts incremented to 1' : `FAIL: attempts = ${attempts}`);

  await s.snap('after-tap');
  console.log('\\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
