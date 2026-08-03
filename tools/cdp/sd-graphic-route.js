// Probe: the study-sheet (infographic) route on system-design.html.
//
// Opening a PNG used to leave the URL sitting on the unit, so a sheet had no
// address: it could not be linked, shared, or handed to an agent. The viewer
// now announces open/close and the page owns the hash, giving every sheet
// #/<topic>/<unit>/graphic/<sheetId>.
//
// Covers: the URL follows a sheet open, the hash names the image actually on
// screen, closing restores the unit URL, a pasted deep link opens that exact
// sheet, and an unknown sheet id degrades to the unit instead of throwing.
//
// Usage: node tools/cdp/sd-graphic-route.js [url] [outDir]

const { ensureServer, ensureChrome, connect } = require('./lib');
const BASE = (process.argv[2] || 'http://localhost:8765/').replace(/\/$/, '') + '/';
const OUT = process.argv[3] || '/tmp/sd-graphic-route';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} — ${m}`); };

(async () => {
  await ensureServer(); await ensureChrome();

  // 1. Opening a sheet from the unit screen must move the URL.
  const p = await connect({ url: `${BASE}system-design.html#/design-problems/p06`, outDir: OUT, waitForLoadMs: 4500 });
  ok(await p.eval(`location.hash`) === '#/design-problems/p06', 'unit screen hash');
  ok(await p.eval(`document.querySelectorAll('drill-infographic').length`) === 4, 'four sheet cards rendered');
  await p.eval(`document.querySelectorAll('drill-infographic')[1].querySelector('.infographic-card__open').click()`);
  await sleep(900);
  const openHash = await p.eval(`location.hash`);
  ok(/^#\/design-problems\/p06\/graphic\/.+$/.test(openHash), `URL tracks the open PNG: ${openHash}`);
  ok(await p.eval(`!document.querySelector('.infographic-viewer').hidden`), 'workspace visible');
  const shown = await p.eval(`document.querySelector('.infographic-viewer img').src.split('/').pop()`);
  ok(openHash.endsWith(shown.replace('.png','')), `hash names the image on screen (${shown})`);

  // 2. Closing restores the unit URL.
  await p.eval(`document.querySelector('.infographic-viewer [data-action="close"]').click()`);
  await sleep(700);
  ok(await p.eval(`location.hash`) === '#/design-problems/p06', 'closing restores the unit URL');

  // 3. Back/forward and a pasted link: the deep link opens that exact sheet.
  const d = await connect({ url: `${BASE}system-design.html#/design-problems/p06/graphic/send-deliver-flow`, outDir: OUT, waitForLoadMs: 5000 });
  const src = await d.eval(`((document.querySelector('.infographic-viewer img')||{}).src)||''`);
  ok(/send-deliver-flow\.png$/.test(src), `deep link opens the named sheet (${src.split('/').pop()})`);
  ok(await d.eval(`location.hash`) === '#/design-problems/p06/graphic/send-deliver-flow', 'deep-link hash preserved');
  ok(await d.eval(`!document.querySelector('.infographic-viewer').hidden`), 'deep link renders the workspace open');

  // 4. A bogus sheet id must degrade to the unit, not blow up.
  const b = await connect({ url: `${BASE}system-design.html#/design-problems/p06/graphic/not-a-real-sheet`, outDir: OUT, waitForLoadMs: 4500 });
  ok(await b.eval(`document.querySelector('.infographic-viewer') === null || document.querySelector('.infographic-viewer').hidden`), 'unknown sheet id degrades to the unit screen');
  ok(await b.eval(`document.querySelectorAll('drill-infographic').length`) === 4, 'unit still renders after a bad sheet id');

  console.log(`\n${fail ? '✗' : '✓'} graphic route: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERROR:', e.message); process.exit(1); });
