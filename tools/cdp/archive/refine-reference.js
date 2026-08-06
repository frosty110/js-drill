// Captures the Reference tab on a Patterns lesson at desktop + mobile.
// Run: node tools/cdp/refine-reference.js

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('../lib');

const OUT = '/tmp/jsdrill-refine-13';
const LESSON_ID = 'two-sum';

async function setup(s) {
  await s.seedLocalStorage('jsdrill.progress.v1', {
    __v: 5, welcomed: true, syncHintShown: true
  });
  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await s.eval(`window.selectLesson(${JSON.stringify(LESSON_ID)})`);
  await s.waitFor(`document.querySelector('#lesson-shell h2') !== null`, { timeoutMs: 6000 });
  await s.eval(`window.selectTab('reference')`);
  await s.sleep(500);
}

(async () => {
  await ensureServer({ port: 8765, dir: path.resolve(__dirname, '../..') });
  await ensureChrome();

  // Desktop
  const sd = await connect({
    url: 'http://localhost:8765/',
    viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: OUT
  });
  await setup(sd);
  await sd.snap('01-desktop-reference');
  const dr = await sd.eval(`(() => {
    const code = document.querySelector('[data-ref-code]')?.getBoundingClientRect();
    const startBtn = document.querySelector('[data-action="start-l1"]');
    return {
      codeHeight: code ? Math.round(code.height) : null,
      startBtnVisible: startBtn ? (() => {
        const r = startBtn.getBoundingClientRect();
        return r.top >= 0 && r.top <= window.innerHeight;
      })() : null,
      startBtnTop: startBtn?.getBoundingClientRect().top ?? null,
      modeBtns: Array.from(document.querySelectorAll('[data-action$="-toggle"]')).map(b => b.innerText.trim())
    };
  })()`);
  console.log('\n[desktop reference]:');
  console.log(JSON.stringify(dr, null, 2));
  await sd.close();

  // Mobile
  const sm = await connect({
    url: 'http://localhost:8765/',
    mobile: true,
    outDir: OUT
  });
  await setup(sm);
  await sm.snap('02-mobile-reference');
  const mr = await sm.eval(`(() => {
    const code = document.querySelector('[data-ref-code]')?.getBoundingClientRect();
    const startBtns = Array.from(document.querySelectorAll('[data-action="start-l1"]'));
    return {
      codeHeight: code ? Math.round(code.height) : null,
      viewportH: window.innerHeight,
      startBtnCount: startBtns.length,
      startBtns: startBtns.map(b => {
        const r = b.getBoundingClientRect();
        return {
          text: b.innerText.trim(),
          top: Math.round(r.top),
          aboveFold: r.top <= window.innerHeight
        };
      }),
      modeBtns: Array.from(document.querySelectorAll('[data-action$="-toggle"]')).map(b => b.innerText.trim())
    };
  })()`);
  console.log('\n[mobile reference]:');
  console.log(JSON.stringify(mr, null, 2));

  // Iter 13 assertions: two CTAs render, top one moves substantially closer
  // to the fold than the pre-iter-13 bottom-only state (was top=1291 on mobile),
  // top CTA is the new "Drill from blank" link, click navigates to L1.
  // Honest scope note: on mobile, the canonical code is 399px tall + ~585px
  // of header/tab/mode-toggle content above it = ~984px before the new CTA.
  // That's still ~140px below the 844 fold — but it's a 307px improvement
  // from the BEFORE state (1291). Sticky-CTA / header-compaction is the
  // bigger-surgery follow-on, queued to backlog.
  sm.assert(mr.startBtnCount === 2, `[mobile] 2 Start-drills CTAs render (got ${mr.startBtnCount})`);
  const topCta = mr.startBtns?.[0];
  const bottomCta = mr.startBtns?.[1];
  sm.assert(/Drill from blank/i.test(topCta?.text || ''), `[mobile] top CTA text contains "Drill from blank" (got "${topCta?.text}")`);
  // BEFORE state had only the bottom CTA at top=1291. The new top CTA must be
  // at least 200px CLOSER to the fold than that — measured: ~984 (307px closer).
  sm.assert(topCta?.top != null && topCta.top < 1100, `[mobile] top CTA moved substantially up vs pre-iter-13 1291 baseline (got top=${topCta?.top})`);
  // Bottom CTA still below fold (it always was; iter-13 doesn't move it).
  sm.assert(bottomCta?.aboveFold === false, `[mobile] bottom CTA remains where it was — below fold (top=${bottomCta?.top}, viewport=${mr.viewportH})`);

  // Click the new top CTA — verify it navigates to L1.
  await sm.eval(`document.querySelectorAll('[data-action="start-l1"]')[0].click()`);
  await sm.sleep(400);
  const navTab = await sm.eval(`window.__jsdrillState.currentTab`);
  sm.assert(navTab === 'L1', `[mobile] clicking top CTA navigated to L1 (got "${navTab}")`);
  await sm.snap('03-mobile-after-top-cta-click');

  await sm.close();
  sm.report();
  console.log('\nScreenshots:', OUT);
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
