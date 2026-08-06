#!/usr/bin/env node
// Verify the new primary-approach header (reference.approach + reference.complexity)
// renders on the Reference tab alongside the existing alternates, matching the same
// label-on-left + complexity-chip-on-right pattern. Also confirms the "time / space"
// legend renders above both primary and alternate chips.
//
// Lesson under test: p-word-break (pilot lesson — first to get reference.approach
// and reference.complexity fields populated).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT_BASE = process.argv[3] || '/tmp/jsdrill-complexity-chip';

async function runScenario({ mobile, outSuffix }) {
  const s = await connect({
    url: URL,
    mobile,
    outDir: `${OUT_BASE}-${outSuffix}`,
  });

  // ARRANGE — clear service-worker caches first so CSS/JS edits land on this
  // run (SW is cache-first; without this, edits to css/*.css or js/app/*.js
  // are served stale from the precache until CACHE_VERSION bumps).
  await s.evalAwait(`(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) { await r.unregister(); }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const k of keys) { await caches.delete(k); }
    }
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
      __v: 5,
      welcomed: true,
      progress: {},
      reviews: {},
      lastLessonId: 'p-word-break',
      lastTab: 'reference',
      sidebarTrack: 'patterns',
    }));
  })()`);
  await s.reload();
  await s.sleep(800);

  // ACT — click the Reference tab explicitly (lastTab seeding is unreliable
  // because the init logic may default to a different tab in some flows).
  await s.evalAwait(`(async () => {
    const ref = document.querySelector('.tab-btn[data-level="reference"]');
    if (ref) ref.click();
    await new Promise(r => setTimeout(r, 600));
    // Open the alternate accordion so its row is visible in the same shot.
    const alt = document.querySelector('.ref-alternate');
    if (alt && !alt.open) alt.open = true;
    await new Promise(r => setTimeout(r, 200));
  })()`);
  await s.sleep(700);

  // Confirm Reference is actually active before snapping
  const activeTab = await s.eval(`document.querySelector('.tab-btn.active')?.dataset?.level || null`);
  s.assert(activeTab === 'reference', `[${outSuffix}] Reference tab is active (got: ${JSON.stringify(activeTab)})`);

  await s.snap(`01-default-scroll-${outSuffix}`);

  // Shot 2: scroll the primary header to mid-viewport so the Sync chip
  // doesn't visually overlap it (Sync is position:fixed top-right of window;
  // header is in normal flow, so any time the header is near viewport top
  // the chips visually collide even though the layout is fine)
  await s.evalAwait(`(async () => {
    const header = document.querySelector('.ref-primary-header');
    if (header) header.scrollIntoView({ block: 'center' });
  })()`);
  await s.sleep(400);
  await s.snap(`02-primary-header-${outSuffix}`);

  // Shot 3: show the alternate row
  await s.evalAwait(`(async () => {
    const alt = document.querySelector('.ref-alternate');
    if (alt) alt.scrollIntoView({ block: 'start' });
  })()`);
  await s.sleep(400);
  await s.snap(`03-alternate-${outSuffix}`);

  // ASSERT — primary header exists, with approach label + complexity chip
  const primary = await s.eval(`(() => {
    const header = document.querySelector('.ref-primary-header');
    if (!header) return { exists: false };
    const label = header.querySelector('.ref-alt-label')?.textContent?.trim();
    const chip = header.querySelector('.ref-alt-complexity');
    const chipText = chip?.textContent?.trim();
    const legend = header.querySelector('.ref-complexity-legend')?.textContent?.trim();
    return { exists: true, label, chipText, legend };
  })()`);
  s.assert(primary.exists, `[${outSuffix}] .ref-primary-header renders`);
  s.assert(primary.label === 'Bottom-up DP (tabulation)',
    `[${outSuffix}] primary label is "Bottom-up DP (tabulation)" (got: ${JSON.stringify(primary.label)})`);
  s.assert(primary.chipText && primary.chipText.includes('O(n²·k) / O(n)'),
    `[${outSuffix}] primary chip contains "O(n²·k) / O(n)" (got: ${JSON.stringify(primary.chipText)})`);
  s.assert(primary.legend === 'time / space',
    `[${outSuffix}] primary legend is "time / space" (got: ${JSON.stringify(primary.legend)})`);

  // ASSERT — alternate row renders with the same shape (label + chip + legend)
  const alt = await s.eval(`(() => {
    const summary = document.querySelector('.ref-alt-summary');
    if (!summary) return { exists: false };
    return {
      exists: true,
      label: summary.querySelector('.ref-alt-label')?.textContent?.trim(),
      chipText: summary.querySelector('.ref-alt-complexity')?.textContent?.trim(),
      legend: summary.querySelector('.ref-complexity-legend')?.textContent?.trim(),
    };
  })()`);
  s.assert(alt.exists, `[${outSuffix}] alternate .ref-alt-summary renders`);
  s.assert(alt.label === 'Top-down memoization (recursive)',
    `[${outSuffix}] alternate label is "Top-down memoization (recursive)" (got: ${JSON.stringify(alt.label)})`);
  s.assert(alt.chipText && alt.chipText.includes('O(n²·k) / O(n)'),
    `[${outSuffix}] alternate chip contains complexity (got: ${JSON.stringify(alt.chipText)})`);
  s.assert(alt.legend === 'time / space',
    `[${outSuffix}] alternate legend renders too (got: ${JSON.stringify(alt.legend)})`);

  // ASSERT — primary header sits above the canonical code block (DOM order)
  const ordering = await s.eval(`(() => {
    const header = document.querySelector('.ref-primary-header');
    const code = document.querySelector('[data-ref-code]');
    if (!header || !code) return null;
    return Boolean(header.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING);
  })()`);
  s.assert(ordering === true, `[${outSuffix}] header precedes code block in DOM`);

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  return { failed, errors, networkErrors };
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const desktop = await runScenario({ mobile: false, outSuffix: 'desktop' });
  const mobile  = await runScenario({ mobile: true,  outSuffix: 'mobile' });
  const total = desktop.failed + desktop.errors + desktop.networkErrors
              + mobile.failed  + mobile.errors  + mobile.networkErrors;
  process.exit(total > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
