#!/usr/bin/env node
// Probe: the Walkthrough tab on p-longest-sub.
// Verifies that a lesson with a `walkthrough` block gets a Walkthrough tab
// (between Conversation and Reference), trace function compiles and runs
// without error, Next/Prev/Reset stepping works, the highlighted code line
// updates per step, the state panel renders, and switching the example
// dropdown resets to step 0 of the new trace.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-probe-walkthrough';

async function runOne({ mobile, label }) {
  const s = await connect({ url: URL, mobile, outDir: `${OUT}-${label}` });

  // ARRANGE — land on p-longest-sub directly on the Walkthrough tab
  await s.evalAwait(`(async () => {
    const data = { __v: 5, welcomed: true, lastLessonId: 'p-longest-sub', lastTab: 'walkthrough' };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  })()`);
  await s.reload();
  await s.sleep(900);

  // ASSERT — Walkthrough tab is rendered as a tab option
  await s.snap('01-walkthrough-loaded');
  const tabLabels = await s.eval(`Array.from(document.querySelectorAll('#lesson-shell .tab-btn')).map(b => b.textContent)`);
  s.assert(tabLabels.some(t => /Walkthrough/.test(t)), `[${label}] Walkthrough tab exists (got: ${JSON.stringify(tabLabels)})`);

  const activeLevel = await s.eval(`document.querySelector('#lesson-shell .tab-btn.active')?.dataset?.level || ''`);
  s.assert(activeLevel === 'walkthrough', `[${label}] Walkthrough is active (got: ${JSON.stringify(activeLevel)})`);

  // Tab order: Conversation, Walkthrough, Reference, L1, L2, L3
  const orderedLevels = await s.eval(`Array.from(document.querySelectorAll('#lesson-shell .tab-btn')).map(b => b.dataset.level)`);
  s.assert(
    JSON.stringify(orderedLevels) === JSON.stringify(['conversation','walkthrough','reference','L1','L2','L3']),
    `[${label}] Tab order (got: ${JSON.stringify(orderedLevels)})`
  );

  // ASSERT — controls + initial render
  const initialCounter = await s.eval(`document.querySelector('[data-walk-counter]')?.textContent || ''`);
  s.assert(/Step 1 of \d+/.test(initialCounter), `[${label}] Counter shows "Step 1 of N" initially (got: ${JSON.stringify(initialCounter)})`);

  const initialActiveLine = await s.eval(`document.querySelector('.walk-line.active')?.dataset?.lineNo || ''`);
  s.assert(initialActiveLine === '1', `[${label}] Step 1 highlights line 1 (got: ${JSON.stringify(initialActiveLine)})`);

  const stateRows = await s.eval(`document.querySelectorAll('.walk-state-row').length`);
  s.assert(stateRows >= 1, `[${label}] State panel shows at least one row (got: ${stateRows})`);

  const prevDisabledAtStart = await s.eval(`document.querySelector('[data-walk-prev]')?.disabled === true`);
  s.assert(prevDisabledAtStart, `[${label}] Prev disabled at step 1`);

  // ACT — click Next a few times, verify counter + active line change
  await s.click('[data-walk-next]');
  await s.sleep(120);
  await s.click('[data-walk-next]');
  await s.sleep(120);
  await s.click('[data-walk-next]');
  await s.sleep(150);
  await s.snap('02-after-3-nexts');
  const counterAfter3 = await s.eval(`document.querySelector('[data-walk-counter]')?.textContent || ''`);
  s.assert(/Step 4 of \d+/.test(counterAfter3), `[${label}] Counter advances to step 4 after 3 Next clicks (got: ${JSON.stringify(counterAfter3)})`);

  const lineAfter3 = await s.eval(`document.querySelector('.walk-line.active')?.dataset?.lineNo || ''`);
  s.assert(lineAfter3 !== '1' && lineAfter3 !== '', `[${label}] Active line moved off line 1 after stepping (got: ${JSON.stringify(lineAfter3)})`);

  // ACT — Prev should walk back
  await s.click('[data-walk-prev]');
  await s.sleep(150);
  const counterAfterPrev = await s.eval(`document.querySelector('[data-walk-counter]')?.textContent || ''`);
  s.assert(/Step 3 of \d+/.test(counterAfterPrev), `[${label}] Prev returns to step 3 (got: ${JSON.stringify(counterAfterPrev)})`);

  // ACT — Reset
  await s.click('[data-walk-reset]');
  await s.sleep(150);
  const counterAfterReset = await s.eval(`document.querySelector('[data-walk-counter]')?.textContent || ''`);
  s.assert(/Step 1 of \d+/.test(counterAfterReset), `[${label}] Reset returns to step 1 (got: ${JSON.stringify(counterAfterReset)})`);

  // ACT — switch example to the second one ("bbbbb")
  await s.eval(`(() => {
    const sel = document.querySelector('[data-walk-example]');
    sel.value = '1';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await s.sleep(200);
  await s.snap('03-example-bbbbb');
  const counterAfterSwitch = await s.eval(`document.querySelector('[data-walk-counter]')?.textContent || ''`);
  s.assert(/Step 1 of \d+/.test(counterAfterSwitch), `[${label}] Example switch resets to step 1 (got: ${JSON.stringify(counterAfterSwitch)})`);

  // Verify the trace length matches what the dry-run showed (bbbbb → 31 steps)
  const totalSteps = await s.eval(`(() => {
    const m = document.querySelector('[data-walk-counter]')?.textContent.match(/of (\\d+)/);
    return m ? Number(m[1]) : 0;
  })()`);
  s.assert(totalSteps === 31, `[${label}] bbbbb has 31 steps (got: ${totalSteps})`);

  // ACT — step to the END of the trace and verify return state shows up
  await s.eval(`(() => {
    const btn = document.querySelector('[data-walk-next]');
    let safety = 100;
    while (btn && !btn.disabled && safety-- > 0) btn.click();
  })()`);
  await s.sleep(200);
  await s.snap('04-end-of-trace');
  const finalCounter = await s.eval(`document.querySelector('[data-walk-counter]')?.textContent || ''`);
  s.assert(/Step 31 of 31/.test(finalCounter), `[${label}] Stepped to the end (got: ${JSON.stringify(finalCounter)})`);
  const nextDisabledAtEnd = await s.eval(`document.querySelector('[data-walk-next]')?.disabled === true`);
  s.assert(nextDisabledAtEnd, `[${label}] Next disabled at end`);

  // State panel should now show `returns: 1` for bbbbb
  const finalStateText = await s.eval(`document.querySelector('[data-walk-state]')?.textContent || ''`);
  s.assert(/returns/.test(finalStateText) && /1/.test(finalStateText),
    `[${label}] Final state shows returns value (got: ${JSON.stringify(finalStateText.slice(0, 200))})`);

  // ACT — switch to a lesson without walkthrough; Walkthrough tab should not appear
  await s.evalAwait(`(async () => {
    const data = { __v: 5, welcomed: true, lastLessonId: 's-variables' };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  })()`);
  await s.reload();
  await s.sleep(800);
  const otherLevels = await s.eval(`Array.from(document.querySelectorAll('#lesson-shell .tab-btn')).map(b => b.dataset.level)`);
  s.assert(!otherLevels.includes('walkthrough'), `[${label}] Non-walkthrough lesson omits the Walkthrough tab (got: ${JSON.stringify(otherLevels)})`);

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
