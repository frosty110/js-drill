#!/usr/bin/env node
// Iter 15 regression probe: the generated cheatsheet's header pitch
// mentions all three tracks (syntax / patterns / applied), not just the
// first two. Same drift pattern as iter 10's welcome banner, found during
// the iter-15 selection-functions audit.
//
// Scenarios:
//   A. Call generateCheatsheet() — the returned markdown contains
//      "applied" in the header summary line.
//   B. The cheatsheet still emits all 3 track sections in the body
//      (positive regression — body iteration was already correct, but
//      worth asserting in case a future refactor breaks it).

const { ensureServer, ensureChrome, connect } = require('../lib');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-iter15-cheatsheet';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Ensure the page has loaded its manifest before we invoke generateCheatsheet.
  await s.waitFor(`window.CURRICULUM ? true : !!document.querySelector('#sidebar-nav .lesson-link')`, { timeoutMs: 5000 });

  // generateCheatsheet is a top-level async function in app.js (no IIFE) → window-global.
  const md = await s.evalAwait(`window.generateCheatsheet()`);
  console.log('Cheatsheet preview (first 400 chars):', md.slice(0, 400));

  // Scenario A — header pitch mentions all three tracks.
  const headerLine = md.split('\n').find(line => line.startsWith('>'));
  console.log('Header line:', JSON.stringify(headerLine));
  s.assert(headerLine && /applied/i.test(headerLine),
    `[A] header pitch mentions "applied" (got: ${JSON.stringify(headerLine)})`);
  s.assert(headerLine && /syntax/i.test(headerLine),
    `[A] header pitch still mentions "syntax" (regression check; got: ${JSON.stringify(headerLine)})`);
  s.assert(headerLine && /pattern/i.test(headerLine),
    `[A] header pitch still mentions "pattern" (regression check; got: ${JSON.stringify(headerLine)})`);

  // Scenario B — body emits all three Track sections.
  s.assert(/Track A — Syntax Fundamentals/.test(md), '[B] cheatsheet has Track A section');
  s.assert(/Track B — Canonical Patterns/.test(md), '[B] cheatsheet has Track B section');
  s.assert(/Track C — Applied Problems/.test(md), '[B] cheatsheet has Track C section');

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
