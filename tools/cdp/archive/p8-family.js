// p8-family.js — verify P8 (design-loop): the two standalone pages
// (system-design.html + diagnostic.html) are unified onto the ds/ system.
//
// Checks: ds/tokens.css + ds/components.css load; the MC drill renders ds .ds-opt
// options (not the retired hand-rolled .opt); zero console errors; no horizontal
// scroll @390px; a return path into the app (link to index.html) exists; the
// retired root tokens.css 404s nowhere (net-errors 0).
//
//   node tools/cdp/p8-family.js [outDir]

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('../lib');

const OUT = process.argv[2] || '/tmp/jsdrill-probe-p8-family';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // ── system-design.html — desktop 1280: drive into an MC drill ─────────────
  const d = await connect({ url: 'http://localhost:8765/system-design.html', mobile: false,
    viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: path.join(OUT, 'system-design-desktop'), waitForLoadMs: 2200 });
  await d.waitFor(`document.querySelector('.topic-card')`, { timeoutMs: 6000 });

  const wired = await d.eval(`(() => {
    const sheets = [...document.styleSheets].map(s => s.href || '').join(' ');
    return {
      dsTokens: /ds\\/tokens\\.css/.test(sheets),
      dsComponents: /ds\\/components\\.css/.test(sheets),
      noLegacyTokens: !/[^/]tokens\\.css/.test(sheets.replace(/ds\\/tokens\\.css/g, '')),
      returnLink: !!document.querySelector('a[href="index.html"]'),
    };
  })()`);
  d.assert(wired.dsTokens && wired.dsComponents, `system-design links ds tokens + components (${JSON.stringify(wired)})`);
  d.assert(wired.returnLink, 'system-design has a return path into the app (link to index.html)');
  await d.snap('01-landing');

  // topic → chapter → Drill all
  await d.eval(`document.querySelector('.topic-card').click()`); await d.sleep(600);
  await d.eval(`(document.querySelector('.ch-card') || {}).click && document.querySelector('.ch-card').click()`); await d.sleep(600);
  await d.eval(`(document.getElementById('drill-all') || {}).click && document.getElementById('drill-all').click()`); await d.sleep(700);
  const drill = await d.eval(`(() => {
    const opts = [...document.querySelectorAll('.ds-opt')];
    if (!opts.length) return { opts: 0 };
    const cs = getComputedStyle(opts[0]);
    return {
      opts: opts.length,
      hasKey: !!opts[0].querySelector('.ds-opt__key'),
      borderPx: parseInt(cs.borderTopWidth),          // ds .ds-opt = 2px border
      oldOpt: document.querySelectorAll('.opt:not(.ds-opt)').length,
    };
  })()`);
  d.assert(drill.opts >= 2 && drill.hasKey, `MC drill renders ds .ds-opt options with letter chips (${JSON.stringify(drill)})`);
  d.assert(drill.oldOpt === 0, 'no legacy .opt options remain');
  await d.snap('02-mc-drill');
  d.assert(await d.eval(`document.documentElement.scrollWidth <= innerWidth`), 'no horizontal scroll @1280');

  console.log('\n===== system-design desktop 1280 =====');
  const dr = d.report();
  await d.close();

  // ── system-design.html — mobile 390 (landing + drill target sizes) ────────
  const sm = await connect({ url: 'http://localhost:8765/system-design.html', mobile: true,
    outDir: path.join(OUT, 'system-design-mobile'), waitForLoadMs: 2200 });
  await sm.waitFor(`document.querySelector('.topic-card')`, { timeoutMs: 6000 });
  await sm.snap('03-landing-mobile');
  await sm.eval(`document.querySelector('.topic-card').click()`); await sm.sleep(500);
  await sm.eval(`(document.querySelector('.ch-card') || {}).click && document.querySelector('.ch-card').click()`); await sm.sleep(500);
  await sm.eval(`(document.getElementById('drill-all') || {}).click && document.getElementById('drill-all').click()`); await sm.sleep(600);
  const mob = await sm.eval(`(() => {
    const opts = [...document.querySelectorAll('.ds-opt')];
    return {
      opts: opts.length,
      minH: opts.length ? Math.min(...opts.map(o => o.getBoundingClientRect().height)) : 0,
      noHScroll: document.documentElement.scrollWidth <= innerWidth,
    };
  })()`);
  sm.assert(mob.opts >= 2 && mob.minH >= 44, `mobile MC options are ≥44px targets (${JSON.stringify(mob)})`);
  sm.assert(mob.noHScroll, 'no horizontal scroll @390 (system-design)');
  await sm.snap('04-mc-drill-mobile');
  console.log('\n===== system-design mobile 390 =====');
  const smr = sm.report();
  await sm.close();

  // ── diagnostic.html — mobile 390: loads clean on ds, return path ──────────
  const dg = await connect({ url: 'http://localhost:8765/diagnostic.html', mobile: true,
    outDir: path.join(OUT, 'diagnostic-mobile'), waitForLoadMs: 2200 });
  await dg.sleep(800);
  const diag = await dg.eval(`(() => {
    const sheets = [...document.styleSheets].map(s => s.href || '').join(' ');
    return {
      dsTokens: /ds\\/tokens\\.css/.test(sheets),
      dsComponents: /ds\\/components\\.css/.test(sheets),
      returnLink: !!document.querySelector('a[href="index.html"]'),
      dsBtn: document.querySelectorAll('.ds-btn').length,
      oldOpt: document.querySelectorAll('.opt:not(.ds-opt)').length,
      noHScroll: document.documentElement.scrollWidth <= innerWidth,
    };
  })()`);
  dg.assert(diag.dsTokens && diag.dsComponents, `diagnostic links ds tokens + components (${JSON.stringify(diag)})`);
  dg.assert(diag.returnLink && diag.dsBtn >= 1, 'diagnostic has a return path + uses ds buttons');
  dg.assert(diag.oldOpt === 0, 'diagnostic has no legacy .opt options');
  dg.assert(diag.noHScroll, 'no horizontal scroll @390 (diagnostic)');
  await dg.snap('05-diagnostic-intro-mobile');
  console.log('\n===== diagnostic mobile 390 =====');
  const dgr = dg.report();
  await dg.close();

  const failed = dr.failed + dr.errors + dr.networkErrors
    + smr.failed + smr.errors + smr.networkErrors
    + dgr.failed + dgr.errors + dgr.networkErrors;
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
