// p1-nav-smoke.js — verify the P1 mobile bottom-nav shell (design-loop).
// Mobile @390px: bar visible, 4 items ≥44px, each tap routes to the right
// surface, L3 hides the bar (immersive rep), no horizontal scroll, no boot
// errors. Desktop @1440px: bar hidden, topbar intact.
//
//   node tools/cdp/p1-nav-smoke.js [outDir]

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('./lib');

const OUT = process.argv[2] || '/tmp/jsdrill-probe-p1-nav';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // ── Mobile ────────────────────────────────────────────────────────────────
  const m = await connect({ url: 'http://localhost:8765/', mobile: true, outDir: path.join(OUT, 'mobile'), waitForLoadMs: 2600 });

  // Seed a returning user resumed into a lesson (the common case).
  await m.evalAwait(`(async () => {
    const mf = await fetch('./data/manifest.json').then(r => r.json());
    const pat = mf.sections.flatMap(s => s.lessons).find(l => l.id === 'two-sum');
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
      __v: 5, welcomed: true, lastLessonId: pat.id, lastTab: 'reference', sidebarTrack: 'patterns' }));
  })()`);
  // The app mirrors lesson+tab into the URL hash, and a hash route WINS over
  // localStorage on boot (deep-link semantics). Strip any hash a previous
  // render left so the seeded lastTab actually drives the resumed surface.
  await m.eval(`history.replaceState(null, '', location.pathname)`);
  await m.reload();
  await m.waitFor(`document.querySelector('#ds-appnav')`, { timeoutMs: 6000 });

  // Bar visible with 4 items, all ≥44px tall, inside the viewport bottom.
  const bar = await m.eval(`(() => {
    const nav = document.getElementById('ds-appnav');
    const r = nav.getBoundingClientRect();
    const items = [...nav.querySelectorAll('.ds-navitem')].map(b => b.getBoundingClientRect());
    return { visible: r.height > 0 && r.bottom <= innerHeight + 1, count: items.length,
             minH: Math.min(...items.map(i => i.height)), minW: Math.min(...items.map(i => i.width)) };
  })()`);
  m.assert(bar.visible, `nav bar visible & pinned to viewport bottom (${JSON.stringify(bar)})`);
  m.assert(bar.count === 4, `4 nav items (got ${bar.count})`);
  m.assert(bar.minH >= 44 && bar.minW >= 44, `items ≥44px targets (minH=${bar.minH}, minW=${bar.minW})`);

  // Redundant legacy chrome hidden.
  const legacyHidden = await m.eval(`['hamburger','topbar-dashboard-mobile','topbar-mobile-menu']
    .every(id => getComputedStyle(document.getElementById(id)).display === 'none')`);
  m.assert(legacyHidden, 'hamburger + mobile topbar icons hidden (replaced by the bar)');

  // No horizontal overflow.
  const noHScroll = await m.eval(`document.documentElement.scrollWidth <= window.innerWidth`);
  m.assert(noHScroll, 'no horizontal scroll at 390px');
  await m.snap('01-reference-with-nav');

  // Browse tab opens the drawer (and highlights).
  await m.click('[data-nav="browse"]'); await m.sleep(500);
  const drawerOpen = await m.eval(`document.body.classList.contains('sidebar-open')`);
  m.assert(drawerOpen, 'Browse opens the lesson drawer');
  await m.snap('02-browse-drawer');
  await m.click('#sidebar-backdrop'); await m.sleep(400);

  // Today tab opens Today's Plan.
  await m.click('[data-nav="today"]'); await m.sleep(500);
  const todayOpen = await m.eval(`getComputedStyle(document.getElementById('today-modal')).display !== 'none'`);
  m.assert(todayOpen, "Today opens Today's Plan");
  await m.snap('03-today');
  await m.click('#today-close'); await m.sleep(300);

  // Practice tab opens the category launcher.
  await m.click('[data-nav="practice"]'); await m.sleep(500);
  const practiceOpen = await m.eval(`(() => {
    const d = document.getElementById('topbar-dropdown');
    return d && !d.classList.contains('hidden');
  })()`);
  m.assert(practiceOpen, 'Practice opens the mode launcher');
  await m.snap('04-practice');
  await m.eval(`document.body.click()`); await m.sleep(300);

  // Progress tab opens the Dashboard.
  await m.click('[data-nav="progress"]'); await m.sleep(800);
  const dashOpen = await m.eval(`!!document.querySelector('.dashboard-page')`);
  m.assert(dashOpen, 'Progress opens the Dashboard');
  const progressActive = await m.eval(`getComputedStyle(document.querySelector('[data-nav="progress"]')).color`);
  m.assert(/245, 182, 43/.test(progressActive), `Progress tab highlights amber when active (got ${progressActive})`);
  await m.snap('05-progress-dashboard');

  // Audio dock lifts ABOVE the nav during playback (contrarian catch: an
  // inline bottom:0 on the dock used to beat the stylesheet and bury the bar).
  const dock = await m.eval(`(() => {
    const d = document.getElementById('audio-dock');
    d.style.display = 'flex';
    const dr = d.getBoundingClientRect();
    const nr = document.getElementById('ds-appnav').getBoundingClientRect();
    d.style.display = 'none';
    return { dockBottom: dr.bottom, navTop: nr.top, above: dr.bottom <= nr.top + 1 };
  })()`);
  m.assert(dock.above, `audio dock sits above the nav bar (${JSON.stringify(dock)})`);

  // L3 hides the nav (immersive rep) and the Run bar owns the bottom.
  await m.eval(`location.hash = ''`); await m.reload();
  await m.waitFor(`document.querySelector('.tab-btn[data-level="L3"]')`, { timeoutMs: 6000 });
  await m.click('.tab-btn[data-level="L3"]'); await m.sleep(700);
  const l3 = await m.eval(`(() => {
    const nav = document.getElementById('ds-appnav');
    const bar = document.querySelector('.l3-actions');
    return { navHidden: getComputedStyle(nav).display === 'none',
             runBarAtBottom: bar ? bar.getBoundingClientRect().bottom >= innerHeight - 8 : null };
  })()`);
  m.assert(l3.navHidden, 'nav hides on L3 (immersive rep)');
  m.assert(l3.runBarAtBottom, `L3 Run bar owns the viewport bottom (${JSON.stringify(l3)})`);
  await m.snap('06-l3-immersive');

  console.log('\n===== mobile =====');
  const mr = m.report();
  await m.close();

  // ── Desktop ───────────────────────────────────────────────────────────────
  const d = await connect({ url: 'http://localhost:8765/', mobile: false,
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
    outDir: path.join(OUT, 'desktop'), waitForLoadMs: 2600 });
  const desktop = await d.eval(`(() => {
    const nav = document.getElementById('ds-appnav');
    const menus = document.querySelectorAll('.topbar-menu');
    return { navHidden: getComputedStyle(nav).display === 'none', menuCount: menus.length };
  })()`);
  d.assert(desktop.navHidden, 'bar hidden on desktop (rail lands with P4)');
  d.assert(desktop.menuCount >= 4, `desktop topbar intact (${desktop.menuCount} menus)`);
  await d.snap('01-desktop-unchanged');
  console.log('\n===== desktop =====');
  const dr = d.report();
  await d.close();

  process.exit(mr.failed + mr.errors + dr.failed + dr.errors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
