#!/usr/bin/env node
// Probe: walkthrough + conversation rendering across diverse shapes.
// Picks one lesson from each major shape family and asserts both tabs
// render correctly and the walkthrough engine can run their traces.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-probe-cross-shapes';

// One representative per shape family
const TARGETS = [
  { id: 'two-sum',                   shape: 'hash-map' },
  { id: 'valid-palindrome',          shape: 'two-pointers' },
  { id: 'p-min-stack',               shape: 'class-based stack' },
  { id: 'binary-search',             shape: 'binary-search' },
  { id: 'p-reverse-list',            shape: 'linked-list' },
  { id: 'p-max-depth',               shape: 'tree-recursion' },
  { id: 'p-islands',                 shape: 'graph-matrix-DFS' },
  { id: 'p-climbing-stairs',         shape: 'DP-1d' },
  { id: 'p-edit-distance',           shape: 'DP-2d' },
  { id: 'p-subsets',                 shape: 'backtracking' },
  { id: 'p-single-number',           shape: 'bit-manipulation' },
  { id: 'p-lru-cache',               shape: 'class-based design' },
  { id: 'a-debounce',                shape: 'applied/timing' },
  { id: 'a-game-of-life',            shape: 'applied/board-evolution' },
];

async function runOne({ mobile, label }) {
  const s = await connect({ url: URL, mobile, outDir: `${OUT}-${label}` });

  for (const t of TARGETS) {
    // Land on the lesson
    await s.evalAwait(`(async () => {
      const data = { __v: 5, welcomed: true, lastLessonId: '${t.id}', lastTab: 'conversation' };
      localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
    })()`);
    await s.reload();
    await s.sleep(700);

    // Check Conversation tab renders with >= 3 sections
    const convSections = await s.eval(`document.querySelectorAll('.conv-section').length`);
    s.assert(convSections >= 3, `[${label}] ${t.id} (${t.shape}) — Conversation has >= 3 sections (got: ${convSections})`);

    // Switch to Walkthrough
    await s.eval(`document.querySelector('.tab-btn[data-level="walkthrough"]')?.click()`);
    await s.sleep(400);

    // Confirm walkthrough rendered (code pane + state panel)
    const codeLines = await s.eval(`document.querySelectorAll('.walk-line').length`);
    s.assert(codeLines >= 3, `[${label}] ${t.id} (${t.shape}) — Walkthrough code pane has >= 3 lines (got: ${codeLines})`);

    const stateRows = await s.eval(`document.querySelectorAll('.walk-state-row').length`);
    s.assert(stateRows >= 1, `[${label}] ${t.id} (${t.shape}) — Walkthrough state panel has >= 1 row (got: ${stateRows})`);

    const counter = await s.eval(`document.querySelector('[data-walk-counter]')?.textContent || ''`);
    s.assert(/Step 1 of \d+/.test(counter), `[${label}] ${t.id} (${t.shape}) — Counter shows "Step 1 of N" (got: ${JSON.stringify(counter)})`);

    // Step to the end and check returns is rendered
    await s.eval(`(() => {
      const btn = document.querySelector('[data-walk-next]');
      let safety = 100;
      while (btn && !btn.disabled && safety-- > 0) btn.click();
    })()`);
    await s.sleep(150);
    const finalState = await s.eval(`document.querySelector('[data-walk-state]')?.textContent || ''`);
    s.assert(/returns/.test(finalState), `[${label}] ${t.id} (${t.shape}) — Final state includes returns (got first 80: ${JSON.stringify(finalState.slice(0, 80))})`);
  }

  // Take one composite screenshot at the last lesson for visual sanity
  await s.snap('99-final-lesson');

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  return { failed, errors, networkErrors };
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  console.log('\n=== DESKTOP ===');
  const desktop = await runOne({ mobile: false, label: 'desktop' });
  console.log('\n=== MOBILE ===');
  const mobile = await runOne({ mobile: true, label: 'mobile' });

  const total = desktop.failed + desktop.errors + desktop.networkErrors
              + mobile.failed + mobile.errors + mobile.networkErrors;
  console.log(`\n=== TOTAL: ${total === 0 ? 'PASS' : 'FAIL'} ===`);
  process.exit(total > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
