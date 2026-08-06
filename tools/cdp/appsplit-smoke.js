// Smoke test for the app.js → js/app/*.js split.
// Concat-equivalence already proves behavior is identical IF the slices load in
// order; this verifies exactly that: no 404 on any slice, no boot exception,
// globals defined, and the DOM rendered. Also clicks the first lesson to confirm
// the render path runs end-to-end.
//   node tools/cdp/appsplit-smoke.js
const { ensureChrome, ensureServer, connect } = require('./lib');

(async () => {
  await ensureChrome();
  await ensureServer({ port: 8765, dir: process.cwd() });
  const s = await connect({ url: 'http://localhost:8765/', waitForLoadMs: 3500 });

  const fails = [];
  const exc = s.consoleMsgs.filter(m => m.type === 'exception');
  const errs = s.consoleMsgs.filter(m => m.type === 'error');
  const netErr = s.networkErrors;
  if (exc.length) fails.push('boot exceptions: ' + JSON.stringify(exc.slice(0, 5)));
  if (netErr.length) fails.push('network errors (missing slice?): ' + JSON.stringify(netErr.slice(0, 8)));
  // console.error at boot is a FAILURE, not a note. This probe printed the
  // count and passed anyway, so the app's own "something is wrong" channel was
  // the one signal CI ignored — and with no client-side error reporting, an
  // error nobody's console is watching is an error nobody ever learns about.
  if (errs.length) fails.push('console errors at boot: ' + JSON.stringify(errs.slice(0, 5)));

  const curr = await s.eval('(typeof CURRICULUM!=="undefined"&&CURRICULUM)?(CURRICULUM.length||(CURRICULUM.sections&&CURRICULUM.sections.length)||Object.keys(CURRICULUM).length):0');
  if (!curr) fails.push('CURRICULUM not loaded (' + curr + ')');
  const initType = await s.eval('typeof init');                 // from slice 14
  if (initType !== 'function') fails.push('init() missing (' + initType + ')');
  // Canary for "the last slice evaluated". Was initTopbarDropdowns until the
  // topbar menubar and its 377 lines of machinery were removed (D15 phase 2) —
  // pick a function the slice still defines, or this asserts that dead code is
  // still shipping.
  const lastFn = await s.eval('typeof _topbarItemFromButton');    // from slice 15 (last)
  if (lastFn !== 'function') fails.push('last-slice fn missing (' + lastFn + ')');
  const btns = await s.eval('document.querySelectorAll("button").length');
  if (btns < 20) fails.push('too few buttons rendered: ' + btns);

  const shellBoot = await s.eval('(document.getElementById("lesson-shell")||{}).innerHTML?document.getElementById("lesson-shell").innerHTML.length:0');

  // best-effort: click first lesson, confirm the lesson render path runs
  const sel = await s.eval(`(()=>{for(const c of ['[data-lesson-id]','aside button.lesson','aside li button','aside button']){if(document.querySelector(c))return c;}return null;})()`);
  let shellAfter = shellBoot;
  if (sel) {
    await s.eval(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})];const t=e.find(x=>x.dataset&&x.dataset.lessonId)||e[0];t&&t.click();})()`).catch(()=>{});
    await new Promise(r => setTimeout(r, 900));
    shellAfter = await s.eval('document.getElementById("lesson-shell").innerHTML.length').catch(() => shellBoot);
  }

  console.log('--- app.js split smoke ---');
  console.log('CURRICULUM size :', curr);
  console.log('typeof init     :', initType, '| _topbarItemFromButton:', lastFn);
  console.log('buttons         :', btns);
  console.log('lesson-shell len :', shellBoot, '→ after lesson click:', shellAfter, sel ? `(sel ${sel})` : '(no lesson selector found)');
  console.log('console: errors', errs.length, '/ exceptions', exc.length, '/ net-errors', netErr.length);
  if (errs.length) console.log('  errors:', JSON.stringify(errs.slice(0, 8)));

  if (fails.length) { console.log('\n❌ FAIL\n - ' + fails.join('\n - ')); process.exit(1); }
  console.log('\n✅ PASS — boots, all slices load, no exceptions/404s, CURRICULUM + DOM render');
  process.exit(0);
})().catch(e => { console.error('smoke harness error:', e.message); process.exit(2); });
