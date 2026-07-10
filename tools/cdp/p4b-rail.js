// p4b-rail.js — verify the P4b desktop rail (design-loop, D01 completed).
// Desktop @1280px: ds rail visible under the topbar (4 destinations + Search/
// Settings aux items), topbar dropdown menus + permanent sidebar retired,
// every destination routes, the drawer (power filters) slides OVER the rail,
// `/` falls back to the palette, System Design stays reachable, L3 keeps the
// rail (desktop is the at-desk tier — no immersive hide). Mid-width @820px:
// same rail (breakpoints unified at 768). Mobile @390px: bottom bar unchanged,
// aux items hidden.
//
//   node tools/cdp/p4b-rail.js [outDir]

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('./lib');

const OUT = process.argv[2] || '/tmp/jsdrill-probe-p4b-rail';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // ── Desktop ───────────────────────────────────────────────────────────────
  const d = await connect({ url: 'http://localhost:8765/', mobile: false,
    viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: path.join(OUT, 'desktop'), waitForLoadMs: 2600 });

  // Seed a returning user resumed into a lesson.
  await d.evalAwait(`(async () => {
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
      __v: 5, welcomed: true, lastLessonId: 'two-sum', lastTab: 'reference', sidebarTrack: 'patterns' }));
  })()`);
  await d.eval(`history.replaceState(null, '', location.pathname)`); // hash beats seeded state on boot
  await d.reload();
  await d.waitFor(`document.querySelector('#ds-appnav')`, { timeoutMs: 6000 });

  // 1 · Rail geometry: fixed left column under the topbar, full stage height.
  const rail = await d.eval(`(() => {
    const nav = document.getElementById('ds-appnav');
    const r = nav.getBoundingClientRect();
    const topbar = document.getElementById('topbar').getBoundingClientRect();
    const items = [...nav.querySelectorAll('.ds-navitem')].filter(b => getComputedStyle(b).display !== 'none');
    const aux = [...nav.querySelectorAll('.ds-navitem--aux')].filter(b => getComputedStyle(b).display !== 'none');
    return {
      left: r.left, width: r.width, top: Math.round(r.top), topbarBottom: Math.round(topbar.bottom),
      bottom: Math.round(r.bottom), vh: innerHeight,
      visibleItems: items.length, auxItems: aux.length,
      minH: Math.min(...items.map(i => i.getBoundingClientRect().height)),
      auxAtFoot: aux.length ? aux[0].getBoundingClientRect().top > innerHeight / 2 : false,
    };
  })()`);
  d.assert(rail.left === 0 && rail.width >= 200, `rail is a fixed left column (${JSON.stringify(rail)})`);
  d.assert(rail.top === rail.topbarBottom, `rail starts at the topbar's bottom edge (top=${rail.top}, topbar=${rail.topbarBottom})`);
  d.assert(rail.bottom >= rail.vh - 1, 'rail runs to the viewport bottom');
  d.assert(rail.visibleItems === 6 && rail.auxItems === 2, `4 destinations + 2 aux items (${rail.visibleItems} visible, ${rail.auxItems} aux)`);
  d.assert(rail.minH >= 44, `rail items ≥44px (minH=${rail.minH})`);
  d.assert(rail.auxAtFoot, 'aux items pushed to the rail foot (spacer works)');

  // 2 · Legacy chrome retired; System Design link survives.
  const chrome = await d.eval(`(() => {
    const menus = [...document.querySelectorAll('.topbar-menu[data-menu]')];
    const aside = document.querySelector('aside.app-sidebar').getBoundingClientRect();
    return {
      menusHidden: menus.length >= 4 && menus.every(m => getComputedStyle(m).display === 'none'),
      dashboardHidden: getComputedStyle(document.getElementById('topbar-dashboard')).display === 'none',
      systemDesignVisible: getComputedStyle(document.getElementById('topbar-system-design')).display !== 'none',
      sidebarOffCanvas: aside.right <= 0,
      stagePad: getComputedStyle(document.querySelector('.app-stage')).paddingLeft,
      noHScroll: document.documentElement.scrollWidth <= innerWidth,
    };
  })()`);
  const topbarClean = await d.eval(`(() => {
    const gone = id => { const el = document.getElementById(id); return !el || getComputedStyle(el).display === 'none'; };
    return gone('topbar-dashboard-mobile') && gone('topbar-mobile-menu') && gone('topbar-cram-progress');
  })()`);
  d.assert(topbarClean, 'mobile-only icons + hidden cram chip do not leak into the desktop topbar');
  d.assert(chrome.menusHidden, 'topbar dropdown menus (Practice/Drills/Train/Review) retired');
  d.assert(chrome.dashboardHidden, 'topbar Dashboard link retired (rail Progress covers it)');
  d.assert(chrome.systemDesignVisible, 'System Design topbar link kept (capability preserved)');
  d.assert(chrome.sidebarOffCanvas, 'permanent sidebar off-canvas (drawer mode)');
  d.assert(chrome.stagePad === '240px', `stage clears the rail (padding-left=${chrome.stagePad})`);
  d.assert(chrome.noHScroll, 'no horizontal scroll at 1280px');
  await d.snap('01-rail-lesson');

  // 3 · Destinations route + active state tracks the rendered page.
  await d.click('#ds-appnav [data-nav="today"]'); await d.sleep(700);
  const today = await d.eval(`(() => ({
    page: !!document.querySelector('.today-home-page'),
    current: document.querySelector('#ds-appnav [data-nav="today"]')?.getAttribute('aria-current') === 'page',
    bg: getComputedStyle(document.querySelector('#ds-appnav [data-nav="today"]')).backgroundColor,
  }))()`);
  d.assert(today.page, 'rail Today opens the Today home');
  d.assert(today.current, 'Today carries aria-current="page"');
  d.assert(today.bg !== 'rgba(0, 0, 0, 0)', `active rail item gets the accent-soft fill (got ${today.bg})`);
  await d.snap('02-rail-today');

  await d.click('#ds-appnav [data-nav="browse"]'); await d.sleep(700);
  const browse = await d.eval(`(() => ({
    page: !!document.querySelector('.browse-page'),
    rows: document.querySelectorAll('[data-browse-lesson]').length,
    current: document.querySelector('#ds-appnav [data-nav="browse"]')?.getAttribute('aria-current') === 'page',
  }))()`);
  d.assert(browse.page && browse.rows >= 10, `rail Browse opens the Browse page (${browse.rows} rows)`);
  d.assert(browse.current, 'Browse carries aria-current="page"');
  await d.snap('03-rail-browse');

  // 4 · The power filters are first-class on the Browse page (P4 part 3);
  // the drawer they lived in is retired and never renders.
  await d.click('[data-bf="toggle-panel"]'); await d.sleep(400);
  const filters = await d.eval(`(() => {
    const chip = k => document.querySelector('[data-bf="' + k + '"]');
    return {
      panel: !!document.querySelector('.browse-filter-panel'),
      viewChips: ['plan', 'hide-mastered', 'repair'].every(k => !!chip(k)),
      facets: document.querySelectorAll('.browse-filter-panel [data-facet]').length,
      planRow: !!chip('switch-plan'),
      drawerRetired: !document.body.classList.contains('sidebar-open')
        && getComputedStyle(document.querySelector('aside.app-sidebar')).display === 'none',
    };
  })()`);
  d.assert(filters.panel && filters.viewChips, `power filters (Plan View / Hide Mastered / Needs work) live on the page (${JSON.stringify(filters)})`);
  d.assert(filters.facets >= 4, `tag facets render in the filter panel (${filters.facets} chips)`);
  d.assert(filters.planRow, 'study-plan switcher reachable from the filter panel');
  d.assert(filters.drawerRetired, 'legacy drawer retired (never renders)');
  await d.snap('04-filters-in-page');
  await d.click('[data-bf="toggle-panel"]'); await d.sleep(300);

  // 5 · Practice launcher + Progress.
  await d.click('#ds-appnav [data-nav="practice"]'); await d.sleep(500);
  const launcher = await d.eval(`(() => {
    const sc = document.getElementById('practice-launcher');
    return { open: !!sc && sc.classList.contains('is-open'),
             rows: sc ? sc.querySelectorAll('[data-btn-id], [data-action]').length : 0 };
  })()`);
  d.assert(launcher.open && launcher.rows >= 8, `rail Practice opens the launcher (${launcher.rows} rows)`);
  await d.snap('05-rail-launcher');
  await d.eval(`document.querySelector('[data-launcher-close]').click()`); await d.sleep(300);

  await d.click('#ds-appnav [data-nav="progress"]'); await d.sleep(800);
  d.assert(await d.eval(`!!document.querySelector('.dashboard-page')`), 'rail Progress opens the Dashboard');

  // 6 · Aux items: Search opens the palette; Settings opens the settings menu.
  await d.click('#ds-appnav [data-nav="palette"]'); await d.sleep(400);
  const palette = await d.eval(`!document.getElementById('palette-overlay').classList.contains('hidden')`);
  d.assert(palette, 'rail Search opens the command palette');
  // System Design reachable via palette (its dropdown home retired).
  await d.eval(`(() => {
    const inp = document.getElementById('palette-input');
    inp.value = 'system design';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await d.sleep(300);
  const sdHit = await d.eval(`[...document.querySelectorAll('.palette-result')].some(r => /System Design/.test(r.textContent))`);
  d.assert(sdHit, 'palette finds System Design (reachability preserved)');
  await d.snap('06-rail-palette-systemdesign');
  await d.eval(`document.querySelector('#palette-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await d.sleep(300);
  await d.eval(`(() => { const p = document.getElementById('palette-overlay'); if (!p.classList.contains('hidden') && typeof _paletteClose === 'function') _paletteClose(); })()`);

  await d.click('#ds-appnav [data-nav="settings"]'); await d.sleep(400);
  const settings = await d.eval(`(() => {
    const dd = document.getElementById('topbar-dropdown');
    return { open: !dd.classList.contains('hidden'),
             items: dd.querySelectorAll('.topbar-item').length };
  })()`);
  d.assert(settings.open && settings.items >= 5, `rail Settings opens the settings menu (${settings.items} items)`);
  await d.snap('07-rail-settings');
  await d.eval(`document.body.click()`); await d.sleep(300);

  // 7 · `/` with the drawer closed falls back to the palette (search parity).
  await d.eval(`document.getElementById('today-home-btn').click()`); await d.sleep(500);
  await d.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))`);
  await d.sleep(300);
  const slashPalette = await d.eval(`!document.getElementById('palette-overlay').classList.contains('hidden')`);
  d.assert(slashPalette, '`/` opens the palette when the sidebar search is off-canvas');
  await d.eval(`typeof _paletteClose === 'function' && _paletteClose()`);

  // 8 · L3 keeps the rail on desktop (immersive hide is mobile-only).
  await d.eval(`selectLesson('two-sum')`); await d.sleep(700);
  await d.click('.tab-btn[data-level="L3"]'); await d.sleep(700);
  const l3Rail = await d.eval(`getComputedStyle(document.getElementById('ds-appnav')).display !== 'none'`);
  d.assert(l3Rail, 'rail stays visible on L3 at desktop (at-desk tier)');
  await d.snap('08-rail-l3');

  console.log('\n===== desktop 1280 =====');
  const dr = d.report();
  await d.close();

  // ── Mid-width (768–899 was the old dead zone; breakpoints now unified) ────
  const t = await connect({ url: 'http://localhost:8765/', mobile: false,
    viewport: { width: 820, height: 1180, deviceScaleFactor: 1, mobile: false },
    outDir: path.join(OUT, 'tablet'), waitForLoadMs: 2600 });
  // Reset the state the desktop session left behind (shared origin — it ended
  // on L3, whose immersive rule would hide the nav on the next boot).
  await t.eval(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 5, welcomed: true, lastLessonId: 'two-sum', lastTab: 'reference', sidebarTrack: 'patterns' }))`);
  await t.eval(`history.replaceState(null, '', location.pathname)`);
  await t.reload();
  await t.waitFor(`document.querySelector('#ds-appnav')`, { timeoutMs: 6000 });
  const tablet = await t.eval(`(() => {
    const nav = document.getElementById('ds-appnav');
    const r = nav.getBoundingClientRect();
    return { rail: getComputedStyle(nav).display !== 'none' && r.left === 0 && r.width >= 200 && r.height >= 400,
             sidebarOffCanvas: document.querySelector('aside.app-sidebar').getBoundingClientRect().right <= 0,
             noHScroll: document.documentElement.scrollWidth <= innerWidth };
  })()`);
  t.assert(tablet.rail, `rail shows at 820px (unified breakpoint) (${JSON.stringify(tablet)})`);
  t.assert(tablet.sidebarOffCanvas, 'no permanent sidebar at 820px');
  t.assert(tablet.noHScroll, 'no horizontal scroll at 820px');
  await t.snap('01-tablet-rail');
  console.log('\n===== tablet 820 =====');
  const tr = t.report();
  await t.close();

  // ── Mobile (unchanged contract) ───────────────────────────────────────────
  const m = await connect({ url: 'http://localhost:8765/', mobile: true,
    outDir: path.join(OUT, 'mobile'), waitForLoadMs: 2600 });
  await m.eval(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 5, welcomed: true, lastLessonId: 'two-sum', lastTab: 'reference', sidebarTrack: 'patterns' }))`);
  await m.eval(`history.replaceState(null, '', location.pathname)`);
  await m.reload();
  await m.waitFor(`document.querySelector('#ds-appnav')`, { timeoutMs: 6000 });
  const mob = await m.eval(`(() => {
    const nav = document.getElementById('ds-appnav');
    const r = nav.getBoundingClientRect();
    const aux = [...nav.querySelectorAll('.ds-navitem--aux')];
    const visible = [...nav.querySelectorAll('.ds-navitem')].filter(b => getComputedStyle(b).display !== 'none');
    return { bar: r.bottom >= innerHeight - 1 && r.width >= innerWidth - 1 && r.height < 120,
             visibleCount: visible.length,
             auxHidden: aux.length === 2 && aux.every(b => getComputedStyle(b).display === 'none'),
             noHScroll: document.documentElement.scrollWidth <= innerWidth };
  })()`);
  m.assert(mob.bar, `bottom bar unchanged at 390px (${JSON.stringify(mob)})`);
  m.assert(mob.visibleCount === 4, `bar shows exactly the 4 destinations (got ${mob.visibleCount})`);
  m.assert(mob.auxHidden, 'aux items (Search/Settings) hidden in bar mode');
  m.assert(mob.noHScroll, 'no horizontal scroll at 390px');
  await m.snap('01-mobile-bar-unchanged');
  console.log('\n===== mobile 390 =====');
  const mr = m.report();
  await m.close();

  process.exit(dr.failed + dr.errors + tr.failed + tr.errors + mr.failed + mr.errors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
