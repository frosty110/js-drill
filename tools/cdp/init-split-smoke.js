// init-split-smoke.js — verifies the init() refactor preserved button wiring.
// Boots the app, then exercises ~10 specific interactions across feature areas
// that init() wires (modals, toggles, palette, drill launchers, settings). Each
// assertion confirms a sub-init's listeners are attached and fire correctly.
//
// Run BEFORE the refactor to capture baseline expected outputs, then AFTER to
// confirm nothing regressed.
//
//   node tools/cdp/init-split-smoke.js
const { ensureChrome, ensureServer, connect } = require('./lib');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await ensureChrome();
  await ensureServer({ port: 8765, dir: process.cwd() });
  const s = await connect({ url: 'http://localhost:8765/', waitForLoadMs: 3500 });

  // Bust service-worker cache. Without this, a prior probe run's SW serves
  // stale slices and edits to app code aren't reflected. Unregister all SWs,
  // clear all caches, then force-reload with ignoreCache.
  await s.eval(`(async () => {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  })()`, { awaitPromise: true }).catch(() => {});
  await s.reload();
  await sleep(500);

  const fails = [];
  const exc = s.consoleMsgs.filter(m => m.type === 'exception');
  if (exc.length) fails.push('boot exceptions: ' + JSON.stringify(exc.slice(0, 3)));

  // 0. Level renderers — confirm renderL1/L2/L2Mobile/L3 still resolve as
  // top-level globals after 12-levels.js → 12a/12b/12c split. Then click
  // each level tab on the current lesson and assert active-tab + non-empty
  // shell (proves each renderer ran end-to-end). MUST run before any drill
  // launcher click, which takes over lesson-shell with a deck UI.
  const renderers = await s.eval(`JSON.stringify({
    L1: typeof renderL1, L2: typeof renderL2,
    L2m: typeof renderL2Mobile, L3: typeof renderL3
  })`);
  if (!/L1":"function"/.test(renderers))  fails.push('renderL1 not global: ' + renderers);
  if (!/L2":"function"/.test(renderers))  fails.push('renderL2 not global: ' + renderers);
  if (!/L2m":"function"/.test(renderers)) fails.push('renderL2Mobile not global: ' + renderers);
  if (!/L3":"function"/.test(renderers))  fails.push('renderL3 not global: ' + renderers);

  const clickTab = level => s.eval(`(()=>{const b=[...document.querySelectorAll('.tab-btn[data-level]')].find(x=>x.dataset.level===${JSON.stringify(level)});if(!b)return false;b.click();return true;})()`);

  for (const level of ['L1', 'L2', 'L3']) {
    const clicked = await clickTab(level);
    if (!clicked) { fails.push(`${level} tab not found on current lesson`); continue; }
    await sleep(400);
    const activeLevel = await s.eval('document.querySelector(".tab-btn.active[data-level]")?.dataset.level');
    if (activeLevel !== level) fails.push(`${level} click: active tab is ${activeLevel}, want ${level}`);
    const shellLen = await s.eval('document.getElementById("lesson-shell").innerHTML.length');
    if (!shellLen) fails.push(`${level} click: lesson-shell empty after render`);
  }

  const click = id => s.eval(`(()=>{const b=document.getElementById(${JSON.stringify(id)});if(!b)return false;b.click();return true;})()`);
  const visible = id => s.eval(`(()=>{const m=document.getElementById(${JSON.stringify(id)});if(!m)return null;return m.style.display==='block';})()`);
  const close = id => s.eval(`(()=>{const m=document.getElementById(${JSON.stringify(id)});if(m)m.style.display='none';return true;})()`);

  // 1. Stats modal
  const statsClicked = await click('stats-btn');
  await sleep(200);
  const statsOpen = await visible('stats-modal');
  if (!statsClicked) fails.push('stats-btn not found');
  if (!statsOpen) fails.push('stats-modal did not open after stats-btn click');
  await close('stats-modal');

  // 2. Cheatsheet modal (export-btn opens it)
  await click('export-btn');
  await sleep(300);
  const cheatOpen = await visible('cheatsheet-modal');
  if (!cheatOpen) fails.push('cheatsheet-modal did not open after export-btn click');
  await close('cheatsheet-modal');

  // 3. At-risk modal
  await click('at-risk-btn');
  await sleep(200);
  const atRiskOpen = await visible('at-risk-modal');
  if (!atRiskOpen) fails.push('at-risk-modal did not open after at-risk-btn click');
  await close('at-risk-modal');

  // 4. Streak map modal
  await click('streak-map-btn');
  await sleep(200);
  const streakOpen = await visible('streak-map-modal');
  if (!streakOpen) fails.push('streak-map-modal did not open after streak-map-btn click');
  await close('streak-map-modal');

  // 5. Mechanics modal
  await click('mechanics-btn');
  await sleep(300);
  const mechOpen = await visible('mechanics-modal');
  if (!mechOpen) fails.push('mechanics-modal did not open after mechanics-btn click');
  await close('mechanics-modal');

  // 6. Today's Plan modal (only when NOT on a cram path, otherwise it routes
  // to Cram Home — we accept either: modal visible OR cram-home rendered).
  await click('today-btn');
  await sleep(250);
  const todayOpen = await visible('today-modal');
  const cramHomeRendered = await s.eval('!!document.querySelector("[data-cram-home],.cram-home,#cram-home")');
  if (!todayOpen && !cramHomeRendered) fails.push('today-btn neither opened today-modal nor rendered cram-home');
  await close('today-modal');

  // 7. Hide-mastered toggle — flip state, then flip back.
  const hideBefore = await s.eval('!!state.hideMastered');
  await click('hide-mastered-btn');
  await sleep(150);
  const hideAfter = await s.eval('!!state.hideMastered');
  if (hideBefore === hideAfter) fails.push('hide-mastered-btn did not flip state.hideMastered');
  await click('hide-mastered-btn');  // restore
  await sleep(100);

  // 8. Command palette via Cmd-K (synthetic keydown).
  await s.eval(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',metaKey:true,bubbles:true}))`);
  await sleep(150);
  const paletteOpen = await s.eval('!document.getElementById("palette-overlay").classList.contains("hidden")');
  if (!paletteOpen) fails.push('Cmd-K did not open palette-overlay');
  // Close it via Escape.
  await s.eval(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await sleep(100);

  // 9. Drill launcher — rapid-fire should at minimum not throw on click. We
  // don't assert downstream state since the deck builder may pick anything.
  const rapidFireBefore = await s.eval('JSON.stringify(state.rapidFire||{})');
  await click('rapid-fire-btn');
  await sleep(400);
  const rapidExc = s.consoleMsgs.filter(m => m.type === 'exception').length;
  if (rapidExc > 0) fails.push('rapid-fire-btn click triggered ' + rapidExc + ' exception(s)');

  // 10. Settings toggle — calibrate-btn flips state.calibrateOn.
  const calBefore = await s.eval('!!state.calibrateOn');
  await click('calibrate-btn');
  await sleep(150);
  const calAfter = await s.eval('!!state.calibrateOn');
  if (calBefore === calAfter) fails.push('calibrate-btn did not flip state.calibrateOn');
  await click('calibrate-btn');  // restore

  // 11. navToLesson() helper — directly invoke and assert state mutates.
  // Covers review/weak/resurrect/bridge/reveal-replay button paths, which
  // can't be exercised generically (they depend on per-user state).
  const beforeNav = await s.eval('JSON.stringify({id:state.currentLessonId,tab:state.currentTab})');
  const navTarget = await s.eval('CURRICULUM.find(l=>l.status==="full"&&l.id!==state.currentLessonId)?.id || null');
  if (!navTarget) {
    fails.push('navToLesson probe: no second full lesson available');
  } else {
    await s.eval(`navToLesson(${JSON.stringify(navTarget)}, {tab:'L1', updateHash:true})`);
    await sleep(300);
    const after = await s.eval('JSON.stringify({id:state.currentLessonId,tab:state.currentTab})');
    const expected = JSON.stringify({ id: navTarget, tab: 'L1' });
    if (after !== expected) fails.push('navToLesson did not mutate state: got ' + after + ' want ' + expected);
    // Also confirm hash was pushed (updateHash:true).
    const hash = await s.eval('location.hash');
    if (!hash.includes(navTarget)) fails.push('navToLesson updateHash did not push lessonId into URL: ' + hash);
  }

  // Confirm no new boot/runtime exceptions surfaced during the probe.
  const finalExc = s.consoleMsgs.filter(m => m.type === 'exception').length;
  if (finalExc > 0) fails.push('total exceptions during probe: ' + finalExc);

  console.log('--- init() split smoke ---');
  console.log('stats-modal           :', statsOpen ? 'opened' : 'FAIL');
  console.log('cheatsheet-modal      :', cheatOpen ? 'opened' : 'FAIL');
  console.log('at-risk-modal         :', atRiskOpen ? 'opened' : 'FAIL');
  console.log('streak-map-modal      :', streakOpen ? 'opened' : 'FAIL');
  console.log('mechanics-modal       :', mechOpen ? 'opened' : 'FAIL');
  console.log('today-btn route       :', todayOpen ? 'opened today-modal' : cramHomeRendered ? 'routed to cram-home' : 'FAIL');
  console.log('hide-mastered flip    :', hideBefore !== hideAfter ? 'OK' : 'FAIL');
  console.log('Cmd-K palette         :', paletteOpen ? 'opened' : 'FAIL');
  console.log('rapid-fire-btn click  :', rapidExc === 0 ? 'no exceptions' : 'FAIL');
  console.log('calibrate-btn flip    :', calBefore !== calAfter ? 'OK' : 'FAIL');
  console.log('navToLesson helper    :', navTarget ? 'invoked' : 'SKIPPED (no second lesson)');
  console.log('renderL1/L2/L2m/L3    :', renderers);
  console.log('exceptions total      :', finalExc);

  if (fails.length) { console.log('\n❌ FAIL\n - ' + fails.join('\n - ')); process.exit(1); }
  console.log('\n✅ PASS — every wired init() interaction fires correctly');
  process.exit(0);
})().catch(e => { console.error('smoke harness error:', e.message); process.exit(2); });
