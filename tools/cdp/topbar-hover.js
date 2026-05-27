// Probe: topbar menus open on hover (desktop), switch on hover, and close a
// beat after leaving both trigger and panel. Click still opens.
const { ensureServer, ensureChrome, connect } = require('./lib');
const hidden = () => `document.getElementById('topbar-dropdown').classList.contains('hidden')`;
const bodyTxt = () => `document.querySelector('.topbar-dropdown-body')?.textContent || ''`;
const enter = sel => `document.querySelector('${sel}').dispatchEvent(new MouseEvent('mouseenter'))`;
const leave = sel => `document.querySelector('${sel}').dispatchEvent(new MouseEvent('mouseleave'))`;
(async () => {
  await ensureServer({ port: 8765 }); await ensureChrome();
  const s = await connect({ url: 'http://localhost:8765/', mobile: false, outDir: '/tmp/jsdrill-hover' });
  await s.evalAwait(`(async()=>{localStorage.setItem('jsdrill.progress.v1',JSON.stringify({__v:5,welcomed:true}));})()`);
  await s.reload(); await s.sleep(800);

  const hoverCapable = await s.eval(`window.matchMedia('(hover: hover) and (pointer: fine)').matches`);
  s.assert(hoverCapable === true, `headless should report hover-capable (got ${hoverCapable})`);

  // Hover opens Practice.
  await s.eval(enter('.topbar-menu[data-menu="practice"]')); await s.sleep(120);
  s.assert(await s.eval(`!(${hidden()})`), 'hovering Practice should open the dropdown');
  await s.snap('01-hover-open');

  // Hover Drills switches content (Mutate lives in Drills).
  await s.eval(leave('.topbar-menu[data-menu="practice"]'));
  await s.eval(enter('.topbar-menu[data-menu="drills"]')); await s.sleep(120);
  s.assert(/Mutate/.test(await s.eval(bodyTxt())), 'hovering Drills should switch the panel to Drills content');

  // Leaving the trigger (without entering the panel) closes after the delay.
  await s.eval(leave('.topbar-menu[data-menu="drills"]')); await s.sleep(400);
  s.assert(await s.eval(hidden()), 'dropdown should close ~220ms after leaving the trigger');

  // Trigger -> panel handoff keeps it open. Real pointer transit fires
  // mouseleave(trigger) THEN mouseenter(panel), so replay that order.
  await s.eval(enter('.topbar-menu[data-menu="insights"]')); await s.sleep(80);
  await s.eval(leave('.topbar-menu[data-menu="insights"]')); // leaving trigger schedules close
  await s.eval(enter('#topbar-dropdown'));                    // entering panel cancels it
  await s.sleep(400);
  s.assert(await s.eval(`!(${hidden()})`), 'dropdown should stay open while pointer is on the panel');
  // Now leave the panel → closes.
  await s.eval(leave('#topbar-dropdown')); await s.sleep(400);
  s.assert(await s.eval(hidden()), 'dropdown should close after leaving the panel');

  // Click still opens (and on hover devices, re-click keeps it open, not stuck-closed).
  await s.click('.topbar-menu[data-menu="train"]'); await s.sleep(120);
  s.assert(await s.eval(`!(${hidden()})`), 'click should still open a menu');
  await s.click('.topbar-menu[data-menu="train"]'); await s.sleep(120);
  s.assert(await s.eval(`!(${hidden()})`), 'on hover devices, re-clicking the open trigger keeps it open (no stuck-closed trap)');

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
