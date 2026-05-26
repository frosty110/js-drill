#!/usr/bin/env node
// iter 123 — verifies 🎹 L3 keyboard chips (Cat 5 UX, ideas-by-category
// promotion shortlist #1). One-tap insertion for high-cost JS tokens
// above the CodeMirror editor on L3. Bypassed during Mock Interview.
//
// 1) Chip row renders on L3 (Patterns lesson), with all 12 expected chips.
// 2) Chips are tap-target sized (min-height ≥ 32px) — PROFILE mobile threshold.
// 3) Click on a chip inserts its `data-chip-insert` value into the CM editor.
// 4) Second click on a different chip appends — both tokens present in editor.
// 5) Chip row is HIDDEN during Mock Interview (no-scaffolding invariant).

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-l3-chips';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);

  // Nav into a Patterns lesson's L3 tab.
  const lessonId = 'two-sum';
  await s.evalAwait(`selectLesson('${lessonId}')`);
  for (let i = 0; i < 10; i++) {
    await s.sleep(300);
    if (await s.evalAwait(`!!CONTENT['${lessonId}'] && !!CONTENT['${lessonId}'].L3`)) break;
  }
  await s.evalAwait(`selectTab('L3')`);
  await s.sleep(500);
  await s.snap('01-l3-chips-rendered');

  // Phase 1: chip row + all 12 chips present with expected labels.
  const chipInfo = await s.evalAwait(`(() => {
    const row = document.querySelector('[data-l3-chips]');
    const chips = document.querySelectorAll('[data-l3-chips] .l3-chip');
    const labels = Array.from(chips).map(c => c.textContent.trim());
    const inserts = Array.from(chips).map(c => c.dataset.chipInsert);
    const minHeight = chips[0] ? parseFloat(getComputedStyle(chips[0]).minHeight) : 0;
    return { rowPresent: !!row, count: chips.length, labels, inserts, minHeight };
  })()`);
  s.assert(chipInfo.rowPresent, '.l3-chips row rendered on L3');
  s.assert(chipInfo.count === 12, `Exactly 12 chips rendered (got ${chipInfo.count})`);
  const EXPECTED = ['const', 'let', 'return', 'if (', 'for (', '=>', '===', '&&', '||', '[]', '{}', '.length'];
  for (const want of EXPECTED) {
    s.assert(chipInfo.labels.includes(want), `Chip label "${want}" present`);
  }
  s.assert(chipInfo.minHeight >= 32, `Chip min-height ≥ 32px (got ${chipInfo.minHeight})`);

  // Phase 2: editor starts empty (clean state); tap "const " chip.
  await s.evalAwait(`(() => {
    const ed = document.querySelector('.CodeMirror');
    if (ed && ed.CodeMirror) ed.CodeMirror.setValue('');
  })()`);
  await s.sleep(150);
  const constChipIdx = chipInfo.labels.indexOf('const');
  await s.evalAwait(`document.querySelectorAll('[data-l3-chips] .l3-chip')[${constChipIdx}].click()`);
  await s.sleep(180);
  const afterConst = await s.evalAwait(`(() => {
    const ed = document.querySelector('.CodeMirror');
    return ed && ed.CodeMirror ? ed.CodeMirror.getValue() : null;
  })()`);
  s.assert(afterConst === 'const ', `Editor contains "const " after first chip tap (got ${JSON.stringify(afterConst)})`);
  await s.snap('02-after-const-chip');

  // Phase 3: tap "=>" chip; editor appends.
  const arrowIdx = chipInfo.labels.indexOf('=>');
  await s.evalAwait(`document.querySelectorAll('[data-l3-chips] .l3-chip')[${arrowIdx}].click()`);
  await s.sleep(180);
  const afterArrow = await s.evalAwait(`(() => {
    const ed = document.querySelector('.CodeMirror');
    return ed && ed.CodeMirror ? ed.CodeMirror.getValue() : null;
  })()`);
  s.assert(afterArrow === 'const  => ', `Editor contains "const  => " after second tap (got ${JSON.stringify(afterArrow)})`);
  // Above shows that the second chip's leading-space insert (' => ') appends
  // without word-collision — exactly the behavior we want for fluid mobile
  // typing chains.

  // Phase 4: tap "[]" chip — bracket-pair test.
  const bracketIdx = chipInfo.labels.indexOf('[]');
  await s.evalAwait(`document.querySelectorAll('[data-l3-chips] .l3-chip')[${bracketIdx}].click()`);
  await s.sleep(180);
  const afterBracket = await s.evalAwait(`(() => {
    const ed = document.querySelector('.CodeMirror');
    return ed && ed.CodeMirror ? ed.CodeMirror.getValue() : null;
  })()`);
  s.assert(afterBracket.includes('[]'), `Editor contains "[]" after bracket-chip tap (got ${JSON.stringify(afterBracket)})`);
  await s.snap('03-after-bracket-chip');

  // Phase 5: chip row HIDDEN during Mock Interview.
  // Trigger mock interview programmatically (state.mock.active = true).
  await s.evalAwait(`startMockInterview()`);
  await s.sleep(800);
  const mockState = await s.evalAwait(`(() => {
    return {
      mockActive: state.mock.active === true,
      chipsRendered: !!document.querySelector('[data-l3-chips]')
    };
  })()`);
  s.assert(mockState.mockActive, 'Mock Interview active after startMockInterview()');
  s.assert(!mockState.chipsRendered, 'Chip row HIDDEN during Mock (no-scaffolding invariant)');
  await s.snap('04-mock-no-chips');

  // End mock to clean up.
  await s.evalAwait(`endMockInterview(false)`);

  await s.close();
  const r = s.report();
  process.exit(r.failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
