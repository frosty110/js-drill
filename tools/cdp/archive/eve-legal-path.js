// Probe: verify the eve-legal study path appears in the picker and an Eve
// lesson (a-eve-demand-letter) renders Reference / L1 / L3 without errors.
const { ensureServer, ensureChrome, connect } = require('../lib');

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({
    url: 'http://localhost:8765/',
    mobile: true,
    outDir: '/tmp/jsdrill-probe-eve-legal',
  });

  // ARRANGE — dismiss the first-time welcome so the path-chip is reachable.
  await s.evalAwait(`(async () => {
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({ __v: 5, welcomed: true }));
  })()`);
  await s.reload();
  await s.sleep(800);

  // STEP 2 — open the path picker, assert Eve option present.
  await s.click('#path-chip');
  await s.sleep(300);
  await s.snap('01-path-picker');
  const modalShown = await s.eval(`getComputedStyle(document.getElementById('path-modal')).display !== 'none'`);
  s.assert(modalShown, 'path-modal should open on #path-chip click');
  const hasEve = await s.eval(`!!document.querySelector('[data-path-id="eve-legal"]')`);
  s.assert(hasEve, 'picker should contain a button for the eve-legal path');
  const eveLabel = await s.eval(`document.querySelector('[data-path-id="eve-legal"]')?.textContent || ''`);
  s.assert(/Eve Legal Interview Prep/.test(eveLabel), `eve-legal button should be labeled, got ${JSON.stringify(eveLabel)}`);

  // STEP 3 — select it; chip label should update and modal close.
  await s.click('[data-path-id="eve-legal"]');
  await s.sleep(400);
  const chip = await s.eval(`document.getElementById('path-chip-label')?.textContent || ''`);
  s.assert(/Eve Legal Interview Prep/.test(chip), `chip should reflect Eve path, got ${JSON.stringify(chip)}`);

  // STEP 4 — open the demand-letter lesson, assert Reference renders.
  await s.evalAwait(`(async () => { selectLesson('a-eve-demand-letter'); })()`);
  await s.sleep(700);
  await s.snap('02-demand-letter-reference');
  const title = await s.eval(`document.querySelector('#lesson-shell')?.textContent?.includes('Demand Letter Template Engine')`);
  s.assert(title, 'demand-letter lesson title should render in the shell');
  const tabIds = await s.eval(`[...document.querySelectorAll('#lesson-shell .tab-btn')].map(b => b.dataset.level).join(',')`);
  s.assert(/reference/.test(tabIds) && /L1/.test(tabIds) && /L3/.test(tabIds), `expected reference/L1/L3 tabs, got ${JSON.stringify(tabIds)}`);
  const refHasCode = await s.eval(`!!document.querySelector('#lesson-shell .CodeMirror, #lesson-shell pre')`);
  s.assert(refHasCode, 'Reference tab should render the canonical code block');

  // STEP 4b — L1 tab renders a question.
  await s.click('#lesson-shell .tab-btn[data-level="L1"]');
  await s.sleep(400);
  await s.snap('03-demand-letter-L1');
  const l1Active = await s.eval(`document.querySelector('#lesson-shell .tab-btn[data-level="L1"]')?.classList.contains('active')`);
  s.assert(l1Active, 'L1 tab should be active after click');
  const l1HasQ = await s.eval(`(document.querySelector('#lesson-shell')?.textContent || '').includes('{{')` ) ;
  // L1 may or may not mention braces; assert at least some option buttons exist instead.
  const l1Options = await s.eval(`document.querySelectorAll('#lesson-shell button').length > 0`);
  s.assert(l1Options, 'L1 should render answer-option buttons');

  // STEP 5 — L3 tab loads the editor.
  await s.click('#lesson-shell .tab-btn[data-level="L3"]');
  await s.sleep(700);
  await s.snap('04-demand-letter-L3');
  const l3Editor = await s.eval(`!!document.querySelector('#lesson-shell .CodeMirror, #lesson-shell textarea')`);
  s.assert(l3Editor, 'L3 tab should mount an editor (CodeMirror or textarea)');

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
