// 🖍 ADHD Mode probe — verifies the toggle restyles the Conversation tab.
//
// Steps:
//   1. boot, click a known patterns lesson (two-sum)
//   2. switch to Conversation tab, expand the first section
//   3. snap BEFORE
//   4. click the #adhd-mode-btn toggle
//   5. snap AFTER + assert state.adhdMode true, body.adhd-mode class on,
//      <b.adhd-fix> nodes present, <code.conv-code> nodes present
//   6. flip toggle off, assert reverted; reload, assert persistence
//
// Run:  node tools/cdp/adhd-mode.js
const { ensureChrome, ensureServer, connect } = require('./lib');

(async () => {
  await ensureChrome();
  await ensureServer({ port: 8765, dir: process.cwd() });
  const s = await connect({
    url: 'http://localhost:8765/',
    mobile: true,
    outDir: '/tmp/adhd-mode-shots',
    waitForLoadMs: 3500,
  });

  // Reset to a known state: clear adhdMode + dismiss welcome banner so its
  // modal doesn't intercept clicks. saveProgress persists for the assertion
  // at the end.
  await s.eval(`(()=>{ state.adhdMode = false; state.welcomed = true; document.body.classList.remove('adhd-mode'); saveProgress(); })()`);
  await new Promise(r => setTimeout(r, 200));

  // 1. Navigate to two-sum programmatically (sidebar may be in a different
  //    track on first boot — selectLesson works regardless of view state).
  await s.eval(`selectLesson('two-sum')`);
  await new Promise(r => setTimeout(r, 700));
  // Close any welcome modal that may have rendered before we set welcomed=true.
  await s.eval(`document.querySelectorAll('[data-action="dismiss-welcome"],[data-dismiss="welcome"],.welcome-close,#welcome-banner button').forEach(b=>b.click())`);
  await new Promise(r => setTimeout(r, 200));

  // 2. Switch to Conversation tab — call selectTab directly to avoid relying
  //    on mobile-collapsed tab buttons.
  await s.eval(`selectTab('conversation')`);
  await new Promise(r => setTimeout(r, 500));
  // Expand the first conversation section
  await s.eval(`document.querySelector('.conv-section')?.setAttribute('open','')`);
  await new Promise(r => setTimeout(r, 200));

  // Sanity: conversation rendered + at least one .conv-code from backtick→code baseline
  const codeCount = await s.eval(`document.querySelectorAll('.conv-code').length`);
  s.assert(codeCount > 0, `expected ≥1 .conv-code (baseline backtick→code), got ${codeCount}`);

  // 3. BEFORE snapshot
  await s.snap('01-before-toggle');

  // 4. Click ADHD toggle
  await s.eval(`document.getElementById('adhd-mode-btn')?.click()`);
  await new Promise(r => setTimeout(r, 350));
  await s.eval(`document.querySelector('.conv-section')?.setAttribute('open','')`);
  await new Promise(r => setTimeout(r, 150));

  // 5. AFTER snapshot + assertions
  await s.snap('02-after-toggle-on');
  const adhdOn = await s.eval(`state.adhdMode === true`);
  s.assert(adhdOn, 'expected state.adhdMode === true after toggle');
  const bodyClass = await s.eval(`document.body.classList.contains('adhd-mode')`);
  s.assert(bodyClass, 'expected body.adhd-mode class after toggle');
  const bionicCount = await s.eval(`document.querySelectorAll('.conv-body .adhd-fix').length`);
  s.assert(bionicCount > 10, `expected many .adhd-fix bionic spans (got ${bionicCount})`);

  // 6. Toggle off + verify reverted
  await s.eval(`document.getElementById('adhd-mode-btn')?.click()`);
  await new Promise(r => setTimeout(r, 300));
  await s.eval(`document.querySelector('.conv-section')?.setAttribute('open','')`);
  await new Promise(r => setTimeout(r, 150));
  await s.snap('03-after-toggle-off');
  const adhdOff = await s.eval(`state.adhdMode === false`);
  s.assert(adhdOff, 'expected state.adhdMode === false after second toggle');
  const bionicCountOff = await s.eval(`document.querySelectorAll('.conv-body .adhd-fix').length`);
  s.assert(bionicCountOff === 0, `expected 0 .adhd-fix after toggle off (got ${bionicCountOff})`);
  const codeStillThere = await s.eval(`document.querySelectorAll('.conv-code').length`);
  s.assert(codeStillThere > 0, `expected .conv-code to remain (baseline always-on), got ${codeStillThere}`);

  // 7. Persistence — flip on, reload, assert restored
  await s.eval(`document.getElementById('adhd-mode-btn')?.click()`);
  await new Promise(r => setTimeout(r, 200));
  const savedAdhd = await s.eval(`JSON.parse(localStorage.getItem('jsdrill.progress.v1')).adhdMode === true`);
  s.assert(savedAdhd, 'expected adhdMode persisted to localStorage after toggle ON');

  await s.close();
  s.report();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
