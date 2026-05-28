// Mobile pass for Font Scale: snap at md/lg/xl on the Reference tab so
// we can visually verify text scales, and CM/code-block stay locked.
const path = require('path');
const { ensureServer, ensureChrome, connect } = require('./lib');

const OUT = '/tmp/jsdrill-font-scale-mobile';

async function snapAtScale(s, scale, label) {
  await s.eval(`(() => { window.__jsdrillState.fontScale = '${scale}'; document.getElementById('font-size-btn').click(); document.getElementById('font-size-btn').click(); document.getElementById('font-size-btn').click(); })()`);
  // The triple-click trick is messy — easier: set fontScale directly via the button's cycle.
}

async function setScale(s, target) {
  // Cycle the button until state.fontScale matches target.
  for (let i = 0; i < 4; i++) {
    const cur = await s.eval(`window.__jsdrillState.fontScale`);
    if (cur === target) return cur;
    await s.eval(`document.getElementById('font-size-btn').click()`);
    await s.sleep(150);
  }
  return await s.eval(`window.__jsdrillState.fontScale`);
}

async function measure(s, label) {
  return await s.eval(`(() => {
    return {
      label: ${JSON.stringify(label)},
      stateFontScale: window.__jsdrillState?.fontScale,
      cssVar: getComputedStyle(document.documentElement).getPropertyValue('--font-scale').trim(),
      htmlFontSize: getComputedStyle(document.documentElement).fontSize,
      // Sidebar lesson link on mobile (explicit 14px in media query — should stay fixed).
      lessonLinkFontSize: (() => {
        const el = document.querySelector('.lesson-link');
        return el ? getComputedStyle(el).fontSize : null;
      })(),
      // Lesson title (Tailwind text-2xl = 1.5rem — should scale).
      lessonTitleFontSize: (() => {
        const el = document.querySelector('#lesson-shell h2');
        return el ? getComputedStyle(el).fontSize : null;
      })(),
      // Code-block (explicit 13px mobile / 13.5px desktop — should stay fixed).
      codeBlockFontSize: (() => {
        const el = document.querySelector('.code-block');
        return el ? getComputedStyle(el).fontSize : null;
      })(),
      // Reference notes bullet (no explicit px — should scale via Tailwind text-sm = 0.875rem).
      refNoteFontSize: (() => {
        const el = document.querySelector('.ref-note');
        return el ? getComputedStyle(el).fontSize : null;
      })(),
    };
  })()`);
}

(async () => {
  await ensureServer({ port: 8765, dir: path.resolve(__dirname, '../..') });
  await ensureChrome();
  const s = await connect({
    url: 'http://localhost:8765/',
    mobile: true,
    outDir: OUT
  });
  await s.seedLocalStorage('jsdrill.progress.v1', {
    __v: 5, welcomed: true, syncHintShown: true,
    lastLessonId: 'two-sum', lastTab: 'reference'
  });
  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await s.eval(`window.selectLesson('two-sum')`);
  await s.eval(`window.selectTab('reference')`);
  await s.waitFor(`document.querySelector('#lesson-shell h2') !== null`, { timeoutMs: 6000 });
  await s.sleep(500);

  for (const scale of ['md', 'lg', 'xl']) {
    await setScale(s, scale);
    await s.sleep(200);
    await s.snap(`mobile-${scale}`);
    const m = await measure(s, `mobile-${scale}`);
    console.log(`\n[mobile / ${scale}]:`, JSON.stringify(m, null, 2));
    s.assert(m.stateFontScale === scale, `[mobile ${scale}] state.fontScale set correctly`);
  }

  // Compute final invariants by sampling all three scales' measurements.
  const md = await (async () => { await setScale(s, 'md'); await s.sleep(150); return measure(s, 'md'); })();
  const lg = await (async () => { await setScale(s, 'lg'); await s.sleep(150); return measure(s, 'lg'); })();
  const xl = await (async () => { await setScale(s, 'xl'); await s.sleep(150); return measure(s, 'xl'); })();

  console.log('\n=== Summary: what scales vs what stays fixed ===');
  console.log('htmlFontSize:        ', md.htmlFontSize, '→', lg.htmlFontSize, '→', xl.htmlFontSize, '(should scale 16/18/20)');
  console.log('codeBlockFontSize:   ', md.codeBlockFontSize, '→', lg.codeBlockFontSize, '→', xl.codeBlockFontSize, '(should stay 13px — mobile explicit)');
  console.log('lessonLinkFontSize:  ', md.lessonLinkFontSize, '→', lg.lessonLinkFontSize, '→', xl.lessonLinkFontSize, '(should stay 14px — touch density)');
  console.log('lessonTitleFontSize: ', md.lessonTitleFontSize, '→', lg.lessonTitleFontSize, '→', xl.lessonTitleFontSize, '(should scale — Tailwind rem)');
  console.log('refNoteFontSize:     ', md.refNoteFontSize, '→', lg.refNoteFontSize, '→', xl.refNoteFontSize, '(should scale — Tailwind rem)');

  // Assertions on the invariants
  s.assert(md.htmlFontSize === '16px' && lg.htmlFontSize === '18px' && xl.htmlFontSize === '20px',
    `[mobile] html font-size scales 16/18/20`);
  s.assert(md.codeBlockFontSize === lg.codeBlockFontSize && lg.codeBlockFontSize === xl.codeBlockFontSize,
    `[mobile] .code-block font-size LOCKED across scales (got ${md.codeBlockFontSize}/${lg.codeBlockFontSize}/${xl.codeBlockFontSize})`);
  s.assert(md.lessonLinkFontSize === lg.lessonLinkFontSize && lg.lessonLinkFontSize === xl.lessonLinkFontSize,
    `[mobile] .lesson-link font-size LOCKED across scales (got ${md.lessonLinkFontSize}/${lg.lessonLinkFontSize}/${xl.lessonLinkFontSize})`);
  // Lesson title should scale: parse the px value, lg should be > md, xl should be > lg.
  const titlePx = x => parseFloat(x);
  s.assert(titlePx(md.lessonTitleFontSize) < titlePx(lg.lessonTitleFontSize) && titlePx(lg.lessonTitleFontSize) < titlePx(xl.lessonTitleFontSize),
    `[mobile] lesson title SCALES md(${md.lessonTitleFontSize}) < lg(${lg.lessonTitleFontSize}) < xl(${xl.lessonTitleFontSize})`);
  s.assert(titlePx(md.refNoteFontSize) < titlePx(lg.refNoteFontSize) && titlePx(lg.refNoteFontSize) < titlePx(xl.refNoteFontSize),
    `[mobile] reference note SCALES md(${md.refNoteFontSize}) < lg(${lg.refNoteFontSize}) < xl(${xl.refNoteFontSize})`);

  s.report();
  await s.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
