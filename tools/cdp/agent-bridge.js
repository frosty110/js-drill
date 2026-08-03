#!/usr/bin/env node
// Durable probe: the no-JS agent bridge must never reach a real user.
//
// system-design.html ships its own fallback inside #app — the directions an
// agent needs to find sd/. A browser must blank it before first paint, so this
// asserts both halves: the app boots normally, and no bridge text survives.
const { ensureServer, ensureChrome, connect } = require('./lib');

const URL_BASE = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-probe-agent-bridge';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  const s = await connect({
    url: `${URL_BASE}system-design.html#/design-problems/p03`,
    mobile: true,
    outDir: OUT
  });

  await s.sleep(1200);
  await s.snap('01-app-mobile');

  const text = await s.eval(`document.body.innerText`);
  s.assert(!/static text version/i.test(text),
    'bridge text must not be visible once JS runs');
  s.assert(/Photo-Sharing/i.test(text),
    `app should render the p03 unit (got: ${JSON.stringify(String(text).slice(0, 120))})`);

  // The fallback still has to exist in the served bytes — that is the point.
  const served = await s.evalAwait(
    `fetch('${URL_BASE}system-design.html').then(r => r.text())`);
  s.assert(/sd\/design-problems\/p03\//.test(served),
    'served HTML must carry the hash→path rule');

  // The static page an agent lands on.
  await s.eval(`location.href = '${URL_BASE}sd/design-problems/p03/'`);
  await s.sleep(2000);
  await s.snap('02-static-page');
  // The sheets are loading="lazy", so they only decode once scrolled to.
  await s.eval(`document.querySelector('#diagrams').scrollIntoView()`);
  await s.sleep(1500);
  await s.eval(`window.scrollTo(0, document.body.scrollHeight)`);
  await s.sleep(2500);
  await s.eval(`document.querySelector('.sharepage__sheet').scrollIntoView()`);
  await s.sleep(600);
  await s.snap('03-visuals');
  const shots = await s.eval(`(() => {
    const imgs = [...document.querySelectorAll('.sharepage__sheet img')];
    return {
      n: imgs.length,
      loaded: imgs.filter(i => i.naturalWidth > 0).length,
      mermaid: document.querySelectorAll('.sharepage__diagram code').length
    };
  })()`);
  s.assert(shots.n === 3, `expected 3 study sheets, got ${shots.n}`);
  s.assert(shots.loaded === 3, `all sheets should load, got ${shots.loaded}/${shots.n}`);
  s.assert(shots.mermaid >= 4, `expected >=4 mermaid sources, got ${shots.mermaid}`);

  // The route round-trip (open → URL names the sheet → close → URL restores) is
  // owned by tools/cdp/sd-graphic-route.js. This probe covers what that one
  // does not: the bridge, and the sheet's own JS-free page.
  // And the sheet's own static page.
  await s.eval(`location.href = '${URL_BASE}sd/design-problems/p06/presence-and-websockets/'`);
  await s.sleep(1800);
  const sheetPage = await s.eval(`(() => {
    const img = document.querySelector('.sharepage__sheet img');
    return { h1: document.querySelector('h1')?.textContent, loaded: !!img && img.naturalWidth > 0 };
  })()`);
  s.assert(sheetPage.loaded, 'the sheet page should render its image');
  s.assert(/presence/i.test(sheetPage.h1 || ''),
    `sheet page should be titled for the sheet, got ${JSON.stringify(sheetPage.h1)}`);
  await s.snap('05-sheet-page');

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
