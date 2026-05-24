#!/usr/bin/env node
// iter 21 ship — verifies switching tabs (Reference / L1 / L2 / L3) within
// the same lesson preserves in-flight work (BS-12), AND switching to a
// different lesson clears the cache (no cross-lesson leakage).
//
// Runs at iPhone viewport (PROFILE.md: ~80% mobile) so the L2-mobile chip
// path is exercised. Picks a target lesson with ≥1 L1 question and ≥1 L2
// exercise with ≥1 blank, then walks the full state-preservation matrix.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-iter21-tab-cache';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Clean slate.
  await s.evalAwait(`(async () => {
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({ __v: 5, welcomed: true, progress: {}, reviews: {} }));
  })()`);
  await s.reload();
  await s.sleep(500);

  const lessonId = 's-variables';

  // -------- A. Pick first L1 option (deliberately make it WRONG when
  //              possible) so the lock state is observable + non-default.
  //              Then switch to Reference and back; verify lock survived.
  await s.evalAwait(`(async () => {
    if (typeof selectLesson === 'function') selectLesson('${lessonId}');
    await new Promise(r => setTimeout(r, 200));
    if (typeof selectTab === 'function') selectTab('L1');
    await new Promise(r => setTimeout(r, 200));
  })()`);
  await s.snap('01-l1-fresh');

  // Click the FIRST option of question 0 regardless of correctness — that
  // exercises the "locked + visual replay" path which is the whole point.
  const l1ClickRes = await s.evalAwait(`(async () => {
    const opts = document.querySelectorAll('#lesson-shell [data-qi="0"] .mc-option');
    if (!opts.length) return 'no L1 options';
    const ans = CONTENT['${lessonId}'].L1.questions[0].answer;
    const clickIdx = ans === 0 ? 1 : 0;
    opts[clickIdx].click();
    await new Promise(r => setTimeout(r, 200));
    return { clicked: clickIdx, expected: ans };
  })()`);
  s.assert(l1ClickRes && typeof l1ClickRes === 'object', `[A] L1 click ran (got: ${JSON.stringify(l1ClickRes)})`);

  const l1BeforeSwitch = await s.eval(`(() => {
    const opts = document.querySelectorAll('#lesson-shell [data-qi="0"] .mc-option');
    return Array.from(opts).map(el => ({
      disabled: el.classList.contains('disabled'),
      correct: el.classList.contains('correct'),
      incorrect: el.classList.contains('incorrect')
    }));
  })()`);
  const l1Locked = l1BeforeSwitch.some(o => o.disabled);
  s.assert(l1Locked, `[A] L1 question 0 locked after click (got: ${JSON.stringify(l1BeforeSwitch)})`);

  // Switch to Reference (the bug's trigger), then back to L1.
  await s.eval(`(() => { selectTab('reference'); })()`);
  await s.sleep(250);
  await s.eval(`(() => { selectTab('L1'); })()`);
  await s.sleep(250);
  await s.snap('02-l1-after-tab-roundtrip');

  const l1AfterSwitch = await s.eval(`(() => {
    const opts = document.querySelectorAll('#lesson-shell [data-qi="0"] .mc-option');
    return Array.from(opts).map(el => ({
      disabled: el.classList.contains('disabled'),
      correct: el.classList.contains('correct'),
      incorrect: el.classList.contains('incorrect')
    }));
  })()`);
  s.assert(
    JSON.stringify(l1BeforeSwitch) === JSON.stringify(l1AfterSwitch),
    `[A] L1 lock/correct/incorrect state survived Reference round-trip (before: ${JSON.stringify(l1BeforeSwitch)}; after: ${JSON.stringify(l1AfterSwitch)})`
  );
  const explainVisible = await s.eval(`!document.querySelector('#lesson-shell [data-qi="0"]').parentElement.querySelector('.explain').classList.contains('hidden')`);
  s.assert(explainVisible, `[A] explain panel re-rendered visible after tab round-trip`);

  // -------- B. Type into L2 mobile chip (via the bottom sheet), switch to
  //              Reference and back; verify the typed text restores.
  await s.eval(`(() => { selectTab('L2'); })()`);
  await s.sleep(300);
  await s.snap('03-l2-mobile-fresh');

  const l2Fill = await s.evalAwait(`(async () => {
    // Tap the first chip of exercise 0 to open the bottom sheet.
    const chip = document.querySelector('#lesson-shell [data-exi="0"][data-bi="0"]');
    if (!chip) return 'no chip';
    chip.click();
    await new Promise(r => setTimeout(r, 200));
    // Type into the bottom-sheet input.
    const inp = document.querySelector('[data-sheet-input]');
    if (!inp) return 'no sheet input found';
    inp.focus();
    inp.value = 'hello';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    // Hit Done in the bottom sheet.
    const done = document.querySelector('[data-sheet-done]') ||
      Array.from(document.querySelectorAll('.l2-sheet-actions button')).find(b => /done/i.test(b.textContent));
    if (done) done.click();
    await new Promise(r => setTimeout(r, 250));
    const chipVal = chip.querySelector('.chip-value')?.textContent;
    return { chipVal, hasValue: chip.classList.contains('has-value') };
  })()`);
  s.assert(
    l2Fill && l2Fill.chipVal === 'hello' && l2Fill.hasValue,
    `[B] L2 chip filled with "hello" before tab switch (got: ${JSON.stringify(l2Fill)})`
  );

  // Switch away and back.
  await s.eval(`(() => { selectTab('reference'); })()`);
  await s.sleep(250);
  await s.eval(`(() => { selectTab('L2'); })()`);
  await s.sleep(300);
  await s.snap('04-l2-mobile-after-roundtrip');

  const l2After = await s.eval(`(() => {
    const chip = document.querySelector('#lesson-shell [data-exi="0"][data-bi="0"]');
    if (!chip) return null;
    return {
      chipVal: chip.querySelector('.chip-value')?.textContent,
      hasValue: chip.classList.contains('has-value')
    };
  })()`);
  s.assert(
    l2After && l2After.chipVal === 'hello' && l2After.hasValue,
    `[B] L2 chip value "hello" survived Reference round-trip (got: ${JSON.stringify(l2After)})`
  );

  // -------- C. Type into L3 editor, switch tabs, verify text restored.
  await s.eval(`(() => { selectTab('L3'); })()`);
  await s.sleep(400);
  const l3Set = await s.eval(`(() => {
    const cmEl = document.querySelector('.CodeMirror');
    if (!cmEl || !cmEl.CodeMirror) return 'no CodeMirror';
    cmEl.CodeMirror.setValue('// in-progress drill\\nconst hello = "world";');
    return cmEl.CodeMirror.getValue();
  })()`);
  s.assert(
    typeof l3Set === 'string' && l3Set.includes('in-progress drill'),
    `[C] L3 editor accepted typed code (got: ${JSON.stringify(l3Set?.slice(0, 60))})`
  );

  await s.eval(`(() => { selectTab('reference'); })()`);
  await s.sleep(250);
  await s.eval(`(() => { selectTab('L3'); })()`);
  await s.sleep(400);
  await s.snap('05-l3-after-roundtrip');

  const l3After = await s.eval(`(() => {
    const cmEl = document.querySelector('.CodeMirror');
    return cmEl?.CodeMirror?.getValue() || '';
  })()`);
  s.assert(
    l3After.includes('in-progress drill') && l3After.includes('const hello'),
    `[C] L3 editor text survived Reference round-trip (got: ${JSON.stringify(l3After.slice(0, 80))})`
  );

  // -------- D. Switch to a DIFFERENT lesson; verify the original lesson's
  //              cache is cleared (no cross-lesson leakage). Then switch back
  //              and verify everything is reset (fresh L1, empty chips, empty editor).
  await s.eval(`(() => { selectLesson('s-numbers'); })()`);
  await s.sleep(300);
  await s.eval(`(() => { selectLesson('${lessonId}'); })()`);
  await s.sleep(300);

  await s.eval(`(() => { selectTab('L1'); })()`);
  await s.sleep(200);
  const l1AfterLessonSwitch = await s.eval(`(() => {
    const opts = document.querySelectorAll('#lesson-shell [data-qi="0"] .mc-option');
    return Array.from(opts).some(el => el.classList.contains('disabled'));
  })()`);
  s.assert(
    l1AfterLessonSwitch === false,
    `[D] L1 lock state CLEARED after lesson switch (cache reset on selectLesson; got disabled=${l1AfterLessonSwitch})`
  );

  await s.eval(`(() => { selectTab('L3'); })()`);
  await s.sleep(400);
  const l3AfterLessonSwitch = await s.eval(`(() => {
    const cmEl = document.querySelector('.CodeMirror');
    return cmEl?.CodeMirror?.getValue() || '';
  })()`);
  s.assert(
    !l3AfterLessonSwitch.includes('in-progress drill'),
    `[D] L3 editor CLEARED after lesson switch (got first 60 chars: ${JSON.stringify(l3AfterLessonSwitch.slice(0, 60))})`
  );

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error('ERR:', e); process.exit(2); });
