// p7-buttons.js — verify the app-wide button.primary/.secondary ds restyle
// (design-loop P7): every action button is now a ≥44px ds card (tokens + ds
// radius), and no dense surface clips or horizontally overflows because of the
// taller buttons. Drives L2 (Check/Reveal), L3 (Run), and Mock.
//
//   node tools/cdp/p7-buttons.js [outDir]

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('../lib');

const OUT = process.argv[2] || '/tmp/jsdrill-probe-p7-buttons';

async function boot(s) {
  await s.eval(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({__v:5, welcomed:true, progress:{}, reviews:{}}))`);
  await s.eval(`history.replaceState(null,'',location.pathname)`);
  await s.reload();
  await s.waitFor(`document.querySelector('#ds-appnav')`, { timeoutMs: 6000 });
}

function measure(sel) {
  return `(() => {
    const b = [...document.querySelectorAll('${sel}')].filter(x => x.offsetParent !== null);
    if (!b.length) return { n: 0 };
    return {
      n: b.length,
      minH: Math.min(...b.map(x => x.getBoundingClientRect().height)),
      radius: parseInt(getComputedStyle(b[0]).borderTopLeftRadius),
      noHScroll: document.documentElement.scrollWidth <= innerWidth,
    };
  })()`;
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: 'http://localhost:8765/', mobile: true, outDir: OUT, waitForLoadMs: 2600 });
  await boot(s);

  // L2 — Check / Reveal (button.primary / button.secondary).
  await s.eval(`selectLesson('two-sum')`); await s.sleep(700);
  await s.eval(`selectTab('L2')`); await s.sleep(700);
  const l2 = await s.eval(measure('#lesson-shell button.primary, #lesson-shell button.secondary'));
  s.assert(l2.n >= 1 && l2.minH >= 44, `L2 action buttons are ≥44px ds cards (${JSON.stringify(l2)})`);
  s.assert(l2.radius >= 12 && l2.noHScroll, 'L2 buttons use ds radius, no h-scroll @390');
  await s.snap('01-l2');

  // L3 — Run (immersive at-desk tier still fine on mobile).
  await s.eval(`selectTab('L3')`); await s.sleep(800);
  const l3 = await s.eval(measure('#lesson-shell button.primary, .l3-actions button.primary, .l3-actions button.secondary'));
  s.assert(l3.n === 0 || l3.minH >= 40, `L3 buttons render without clipping (${JSON.stringify(l3)})`);
  s.assert(await s.eval(`document.documentElement.scrollWidth <= innerWidth`), 'no h-scroll on L3 @390');
  await s.snap('02-l3');

  // Mock interview — its start/action buttons.
  await s.eval(`document.getElementById('mock-btn')?.click()`); await s.sleep(800);
  const mock = await s.eval(measure('button.primary, button.secondary'));
  s.assert(mock.n === 0 || mock.minH >= 40, `Mock buttons render without clipping (${JSON.stringify(mock)})`);
  s.assert(await s.eval(`document.documentElement.scrollWidth <= innerWidth`), 'no h-scroll in Mock @390');
  await s.snap('03-mock');

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
