#!/usr/bin/env node
// Verifies iter-41 "What's missing?" critical-line fill at iPhone viewport:
// the 🎯 button is present on lessons with `L3.criticalLines`, missing on
// lessons without; clicking it pre-fills the editor with the canonical with
// the marked lines replaced by FILL markers.
// See ideas-by-category.md § Drilling Surfaces → "What's missing?".

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL_BASE = (process.argv[2] || 'http://localhost:8765/').replace(/\/$/, '');
const OUT = process.argv[3] || '/tmp/jsdrill-critical-lines';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL_BASE + '/', mobile: true, outDir: OUT });

  // Seed: dismiss welcome.
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {},
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);

  // Reconnect via deep-link to two-sum L3 (we know this lesson has criticalLines).
  const s2 = await connect({ url: URL_BASE + '/#/two-sum/L3', mobile: true, outDir: OUT });
  await s2.sleep(700);
  await s2.snap('two-sum-L3');

  // Assert 1: 🎯 button renders on a lesson with criticalLines.
  const hasBtn = await s2.evalAwait(`!!document.querySelector('[data-critical-btn]')`);
  console.log(hasBtn ? 'PASS: 🎯 button renders on two-sum L3' : 'FAIL: 🎯 button missing on lesson with criticalLines');

  // Assert 2: Editor starts empty (no pre-fill before click).
  const beforeText = await s2.evalAwait(`document.querySelector('.CodeMirror')?.CodeMirror?.getValue() || ''`);
  console.log(beforeText.length === 0 || !beforeText.includes('FILL LINE')
    ? 'PASS: editor has no FILL markers before click'
    : `FAIL: FILL markers present before click`);

  // Act: click the 🎯 button.
  await s2.evalAwait(`document.querySelector('[data-critical-btn]').click()`);
  await s2.sleep(200);
  await s2.snap('after-critical-click');

  // Assert 3: Editor now contains the canonical with FILL markers on the 2 critical lines.
  const afterText = await s2.evalAwait(`document.querySelector('.CodeMirror')?.CodeMirror?.getValue() || ''`);
  const fillCount = (afterText.match(/\/\* ___ FILL LINE \d+ ___ \*\//g) || []).length;
  console.log(fillCount === 2
    ? `PASS: 2 FILL markers in editor (two-sum has criticalLines [6, 8])`
    : `FAIL: ${fillCount} FILL markers, expected 2`);

  // Assert 4: Editor contains the rest of the canonical scaffold (e.g., the function signature).
  const hasFnSig = afterText.includes('function twoSum');
  console.log(hasFnSig ? 'PASS: canonical scaffold (function signature) preserved' : 'FAIL: function signature missing from pre-fill');

  // Assert 5: Navigate to a lesson WITHOUT criticalLines — button should be absent.
  // Pick `s-variables` (a basics syntax lesson with no criticalLines).
  await s2.evalAwait(`window.location.hash = '#/s-variables/L3'`);
  await s2.sleep(400);
  const btnOnPlainLesson = await s2.evalAwait(`!!document.querySelector('[data-critical-btn]')`);
  console.log(!btnOnPlainLesson ? 'PASS: 🎯 button absent on lesson without criticalLines' : 'FAIL: 🎯 button present where it should not be');

  await s2.snap('plain-lesson-no-btn');
  console.log('\\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
