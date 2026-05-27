// Probe: 🧭 Path View + 👁 Hide Mastered are sidebar filters; the 6 straggler
// launchers left the sidebar; menus still host them; filters left ⚙️ Settings.
const { ensureServer, ensureChrome, connect } = require('./lib');
const vis = id => `(()=>{const e=document.getElementById('${id}');if(!e)return 'MISSING';const cs=getComputedStyle(e);const r=e.getBoundingClientRect();return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0;})()`;
(async () => {
  await ensureServer({ port: 8765 }); await ensureChrome();
  const s = await connect({ url: 'http://localhost:8765/', mobile: false, outDir: '/tmp/jsdrill-filters' });
  await s.evalAwait(`(async()=>{localStorage.setItem('jsdrill.progress.v1',JSON.stringify({__v:5,welcomed:true}));})()`);
  await s.reload(); await s.sleep(900);
  await s.snap('01-sidebar');

  // Filters visible on the sidebar, inside a Filters row.
  s.assert(await s.eval(vis('path-btn')), '🧭 Path View should be visible on the sidebar');
  s.assert(await s.eval(vis('hide-mastered-btn')), '👁 Hide Mastered should be visible on the sidebar');
  s.assert(await s.eval(`!!document.getElementById('path-btn').closest('[aria-label="Lesson list filters"]')`), 'Path View should sit in the Filters row');
  s.assert(await s.eval(`!!document.getElementById('hide-mastered-btn').closest('[aria-label="Lesson list filters"]')`), 'Hide Mastered should sit in the Filters row');

  // The 6 stragglers no longer render in the sidebar.
  for (const id of ['mutate-btn','constraint-shift-btn','install-btn','pace-bar-btn','haptic-btn','phone-screen-btn']) {
    const shown = await s.eval(vis(id));
    s.assert(shown !== true, `${id} should NOT be visible in the sidebar (got ${JSON.stringify(shown)})`);
  }

  // Path View toggles the filter (active text-blue-300 + path step pill appears).
  await s.click('#path-btn'); await s.sleep(500);
  s.assert(await s.eval(`document.getElementById('path-btn').classList.contains('text-blue-300')`), 'Path View should show active (blue) after click');
  await s.snap('02-pathview-on');
  await s.click('#path-btn'); await s.sleep(300); // toggle back

  // Hide Mastered toggles active emerald.
  await s.click('#hide-mastered-btn'); await s.sleep(300);
  s.assert(await s.eval(`document.getElementById('hide-mastered-btn').classList.contains('text-emerald-300')`), 'Hide Mastered should show active (emerald) after click');
  await s.click('#hide-mastered-btn'); await s.sleep(200);

  // ⚙️ Settings menu must NOT list Path View / Hide Mastered anymore.
  await s.click('#topbar-settings'); await s.sleep(250);
  await s.snap('03-settings-menu');
  const settingsTxt = await s.eval(`document.querySelector('.topbar-dropdown-body')?.textContent || ''`);
  s.assert(!/Path View/.test(settingsTxt), 'Settings menu should NOT contain Path View');
  s.assert(!/Hide Mastered/.test(settingsTxt), 'Settings menu should NOT contain Hide Mastered');
  s.assert(/Pace-Bar/i.test(settingsTxt), 'Settings menu should still contain Pace-Bar (straggler now menu-only)');

  // Drills menu still hosts Mutate + Shift; Train hosts Phone Screen.
  await s.click('.topbar-menu[data-menu="drills"]'); await s.sleep(250);
  const drillsTxt = await s.eval(`document.querySelector('.topbar-dropdown-body')?.textContent || ''`);
  s.assert(/Mutate/.test(drillsTxt), 'Drills menu should contain Mutate');
  s.assert(/Shift/.test(drillsTxt), 'Drills menu should contain Shift (constraint-shift)');
  await s.click('.topbar-menu[data-menu="train"]'); await s.sleep(250);
  const trainTxt = await s.eval(`document.querySelector('.topbar-dropdown-body')?.textContent || ''`);
  s.assert(/Phone Screen/.test(trainTxt), 'Train menu should contain Phone Screen');

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
