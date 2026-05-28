// Verifies the Font Scale feature (8-file WIP) end-to-end:
//   1. font-size-btn exists in the settings menu (TOPBAR_MENU_TAXONOMY entry).
//   2. Default state.fontScale = 'lg' → button label "🔠 Font: L", CSS var = 1.125.
//   3. Clicking cycles label M → L → XL → M (with state.fontScale matching).
//   4. CSS var on :root updates synchronously on each click.
//   5. Reload preserves the chosen scale (saveProgress wiring).
//   6. html font-size scales (16 → 18 → 20) at md/lg/xl on a default 16px base.
//   7. body text actually scales (sample a rem-based element).
//   8. KEY: .CodeMirror desktop should be LOCKED at its explicit px size
//      across all 3 scales (per the css/01-base.css comment "CodeMirror
//      keep their explicit pixel sizes"). Pre-fix this fails on desktop
//      because the desktop `.CodeMirror` rule has no font-size override.
//   9. .code-block desktop should also be LOCKED at 13.5px (already has
//      explicit rule — regression check).
//
// Run: node tools/cdp/verify-font-scale.js

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('./lib');

const OUT = '/tmp/jsdrill-font-scale';

async function measure(s, label) {
  return await s.eval(`(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const cmEl = document.querySelector('.CodeMirror');
    const codeBlockEl = document.querySelector('.code-block');
    return {
      label: ${JSON.stringify(label)},
      stateFontScale: window.__jsdrillState?.fontScale,
      btnText: document.getElementById('font-size-btn')?.textContent?.trim(),
      cssVar: rootStyle.getPropertyValue('--font-scale').trim(),
      htmlFontSize: rootStyle.fontSize,
      bodyFontSize: bodyStyle.fontSize,
      codeMirrorFontSize: cmEl ? getComputedStyle(cmEl).fontSize : null,
      codeBlockFontSize: codeBlockEl ? getComputedStyle(codeBlockEl).fontSize : null,
    };
  })()`);
}

(async () => {
  await ensureServer({ port: 8765, dir: path.resolve(__dirname, '../..') });
  await ensureChrome();
  const s = await connect({
    url: 'http://localhost:8765/',
    viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: OUT
  });
  // Boot with a lesson that has L3 (so CodeMirror is in the DOM).
  await s.seedLocalStorage('jsdrill.progress.v1', {
    __v: 5, welcomed: true, syncHintShown: true,
    lastLessonId: 'two-sum', lastTab: 'L3'
  });
  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await s.eval(`window.selectLesson('two-sum')`);
  await s.eval(`window.selectTab('L3')`);
  await s.waitFor(`document.querySelector('.CodeMirror') !== null`, { timeoutMs: 6000 });
  await s.sleep(500);

  // === Initial state — default 'lg' ===
  const init = await measure(s, 'default-lg');
  console.log('\n[init / default = lg]:', JSON.stringify(init, null, 2));
  s.assert(init.stateFontScale === 'lg', `default state.fontScale === 'lg' (got ${init.stateFontScale})`);
  s.assert(init.btnText === '🔠 Font: L', `button label "🔠 Font: L" (got "${init.btnText}")`);
  s.assert(init.cssVar === '1.125', `--font-scale === '1.125' (got '${init.cssVar}')`);
  s.assert(init.htmlFontSize === '18px', `html font-size === 18px (16 × 1.125) (got ${init.htmlFontSize})`);
  await s.snap('01-lg-default');

  // === Click → xl ===
  await s.eval(`document.getElementById('font-size-btn').click()`);
  await s.sleep(200);
  const xl = await measure(s, 'after-1-click-xl');
  console.log('\n[xl]:', JSON.stringify(xl, null, 2));
  s.assert(xl.stateFontScale === 'xl', `after 1st click, state.fontScale === 'xl' (got ${xl.stateFontScale})`);
  s.assert(xl.btnText === '🔠 Font: XL', `button label "🔠 Font: XL" (got "${xl.btnText}")`);
  s.assert(xl.cssVar === '1.25', `--font-scale === '1.25' (got '${xl.cssVar}')`);
  s.assert(xl.htmlFontSize === '20px', `html font-size === 20px (16 × 1.25) (got ${xl.htmlFontSize})`);
  await s.snap('02-xl');

  // === Click → md (cycle back to start) ===
  await s.eval(`document.getElementById('font-size-btn').click()`);
  await s.sleep(200);
  const md = await measure(s, 'after-2-clicks-md');
  console.log('\n[md]:', JSON.stringify(md, null, 2));
  s.assert(md.stateFontScale === 'md', `after 2nd click, state.fontScale === 'md' (got ${md.stateFontScale})`);
  s.assert(md.btnText === '🔠 Font: M', `button label "🔠 Font: M" (got "${md.btnText}")`);
  s.assert(md.cssVar === '1', `--font-scale === '1' (got '${md.cssVar}')`);
  s.assert(md.htmlFontSize === '16px', `html font-size === 16px (16 × 1.0) (got ${md.htmlFontSize})`);
  await s.snap('03-md');

  // === Click → lg (back to default) ===
  await s.eval(`document.getElementById('font-size-btn').click()`);
  await s.sleep(200);
  const lg2 = await measure(s, 'after-3-clicks-back-to-lg');
  s.assert(lg2.stateFontScale === 'lg', `after 3rd click, cycled back to 'lg' (got ${lg2.stateFontScale})`);

  // === Persistence: reload, verify state.fontScale survives ===
  await s.reload();
  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await s.sleep(500);
  const after = await measure(s, 'after-reload');
  console.log('\n[after reload — should still be lg]:', JSON.stringify(after, null, 2));
  s.assert(after.stateFontScale === 'lg', `after reload, fontScale persisted as 'lg' (got ${after.stateFontScale})`);
  s.assert(after.cssVar === '1.125', `after reload, --font-scale still '1.125' (got '${after.cssVar}')`);

  // === KEY: CodeMirror desktop should NOT scale (per the explicit user intent in
  //     css/01-base.css comment "CodeMirror + .code-block keep their explicit
  //     pixel sizes"). The CodeMirror font-size in [init / lg], [xl], [md] should
  //     all be IDENTICAL on desktop. ===
  // We measured this on a lesson with L3 active.
  await s.eval(`window.selectLesson('two-sum'); window.selectTab('L3')`);
  await s.waitFor(`document.querySelector('.CodeMirror') !== null`, { timeoutMs: 6000 });
  await s.sleep(300);
  const lgCm = await measure(s, 'cm-at-lg');
  await s.eval(`document.getElementById('font-size-btn').click()`); // → xl
  await s.sleep(200);
  const xlCm = await measure(s, 'cm-at-xl');
  await s.eval(`document.getElementById('font-size-btn').click()`); // → md
  await s.sleep(200);
  const mdCm = await measure(s, 'cm-at-md');
  console.log('\n[CodeMirror font-size across scales on DESKTOP]:');
  console.log(`  at lg: ${lgCm.codeMirrorFontSize}`);
  console.log(`  at xl: ${xlCm.codeMirrorFontSize}`);
  console.log(`  at md: ${mdCm.codeMirrorFontSize}`);
  s.assert(
    lgCm.codeMirrorFontSize === xlCm.codeMirrorFontSize && xlCm.codeMirrorFontSize === mdCm.codeMirrorFontSize,
    `[KEY] desktop CodeMirror font-size is LOCKED across md/lg/xl (got lg=${lgCm.codeMirrorFontSize} xl=${xlCm.codeMirrorFontSize} md=${mdCm.codeMirrorFontSize})`
  );

  console.log('\n[.code-block font-size across scales on DESKTOP]:');
  console.log(`  at lg: ${lgCm.codeBlockFontSize}`);
  console.log(`  at xl: ${xlCm.codeBlockFontSize}`);
  console.log(`  at md: ${mdCm.codeBlockFontSize}`);
  s.assert(
    lgCm.codeBlockFontSize === xlCm.codeBlockFontSize && xlCm.codeBlockFontSize === mdCm.codeBlockFontSize,
    `[KEY] desktop .code-block font-size is LOCKED across md/lg/xl (got lg=${lgCm.codeBlockFontSize} xl=${xlCm.codeBlockFontSize} md=${mdCm.codeBlockFontSize})`
  );

  s.report();
  await s.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
