#!/usr/bin/env node
// Iter 5 regression probe: the lesson header shows a "🧭 Step N of M" pill
// when starter-path mode is on AND the current lesson is in STARTER_PATH;
// the pill is absent otherwise. Mobile viewport because the pill row uses
// flex-wrap and the visual constraint is tightest at iPhone width.
//
// Scenarios:
//   A. Fresh user → starter path off, no pill in header.
//   B. Engage starter path → first path lesson loads, pill says "Step 1 of M".
//   C. Toggle path OFF while on the same lesson → pill disappears.
//   D. Toggle path back ON → pill returns.

const { ensureServer, ensureChrome, connect } = require('./lib');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-iter5-pill';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Fresh state — no progress, no path mode.
  await s.eval(`localStorage.removeItem('jsdrill.progress.v1')`);
  await s.reload();
  await s.snap('A-fresh');

  // Scenario A: no path pill in the header.
  const aHasPill = await s.eval(`!!document.querySelector('#lesson-shell .pill-path')`);
  s.assert(!aHasPill, '[A] no path pill on fresh load (path mode off)');

  // Engage starter path via the welcome banner CTA.
  await s.click('[data-action="start-path"]');
  await s.sleep(600);
  await s.snap('B-after-start-path');

  // Scenario B: path pill present, says "Step 1 of M" (M = STARTER_PATH length).
  const bPill = await s.eval(`(() => {
    const el = document.querySelector('#lesson-shell .pill-path');
    return el ? el.textContent.trim() : null;
  })()`);
  s.assert(bPill !== null, `[B] path pill present after starting path (got: ${JSON.stringify(bPill)})`);
  s.assert(/Step 1 of \d+/.test(bPill || ''),
    `[B] path pill reads "Step 1 of M" (got: ${JSON.stringify(bPill)})`);

  // Scenario C: open sidebar drawer, toggle path off, pill should disappear.
  await s.click('#hamburger');
  await s.sleep(300);
  await s.click('#path-btn');
  await s.sleep(400);
  // Close drawer for the snap
  await s.eval(`document.getElementById('sidebar-backdrop')?.click()`);
  await s.sleep(200);
  await s.snap('C-path-off');
  const cHasPill = await s.eval(`!!document.querySelector('#lesson-shell .pill-path')`);
  s.assert(!cHasPill, '[C] no path pill after toggling path mode OFF on the same lesson');

  // Scenario D: toggle back on, pill returns.
  await s.click('#hamburger');
  await s.sleep(300);
  await s.click('#path-btn');
  await s.sleep(400);
  await s.eval(`document.getElementById('sidebar-backdrop')?.click()`);
  await s.sleep(200);
  await s.snap('D-path-on-again');
  const dPill = await s.eval(`(() => {
    const el = document.querySelector('#lesson-shell .pill-path');
    return el ? el.textContent.trim() : null;
  })()`);
  s.assert(dPill !== null, `[D] path pill returns after toggling path ON again (got: ${JSON.stringify(dPill)})`);
  s.assert(/Step \d+ of \d+/.test(dPill || ''),
    `[D] path pill reads "Step N of M" (got: ${JSON.stringify(dPill)})`);

  // Pill row uses flex-wrap so it can't blow out viewport on mobile.
  const overflow = await s.eval(`document.documentElement.scrollWidth > window.innerWidth`);
  s.assert(!overflow, 'No horizontal overflow at mobile width with path pill present');

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
