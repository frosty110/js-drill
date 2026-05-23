#!/usr/bin/env node
// Scenario-script template for the JS Drill browser-test skill.
//
// Copy this file when you need to verify a UI/UX change. Edit the marked
// sections. Run it directly:  node tools/cdp/<your-probe>.js
//
// Pattern: arrange → act → assert + snap. Keep scenario scripts short —
// the heavy lifting lives in lib.js.
//
// The default below targets the mobile experience (iPhone 13 viewport,
// coarse pointer) because PROFILE.md says ~80% of usage is on a phone.
// For a desktop check, set `mobile: false` and pass `viewport: { ... }`.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-probe-template';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // -------- ARRANGE -----------------------------------------------------
  // Seed any localStorage state your scenario needs. Example: a due review.
  // Comment this out if your scenario doesn't need seeded state.
  await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const sample = m.sections.flatMap(s => s.lessons).find(l => l.status === 'full');
    if (!sample) return;
    const data = { __v: 4, welcomed: true, progress: {}, reviews: {} };
    data.progress[sample.id] = { L1: 'passed', L2: 'passed', L3: 'passed' };
    data.reviews[sample.id] = {
      lastPassedAt: Date.now() - 2*86400000,
      interval: 86400000,
      dueAt: Date.now() - 86400000,
    };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  })()`);
  await s.reload();

  // -------- ACT + SNAP --------------------------------------------------
  await s.snap('home');                              // before
  await s.click('#hamburger');                       // open mobile drawer
  await s.sleep(350);
  await s.snap('sidebar-open');

  // Click the 🕒 Review button if it's visible
  await s.click('#review-btn');
  await s.sleep(800);
  await s.snap('after-review-click');

  // -------- ASSERT ------------------------------------------------------
  const activeTab = await s.eval(`document.querySelector('.tab-btn.active')?.textContent || ''`);
  s.assert(/L2|Fill/.test(activeTab), `Review CTA lands on L2 (got: ${JSON.stringify(activeTab)})`);

  const coarse = await s.eval(`matchMedia('(pointer: coarse)').matches`);
  s.assert(coarse === true, 'pointer:coarse media query is active (mobile emulation OK)');

  // -------- REPORT + CLEANUP -------------------------------------------
  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
