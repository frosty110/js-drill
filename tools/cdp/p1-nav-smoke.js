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
    // Rail-only aux items (Search/Settings, P4b) are display:none in bar mode —
    // measure the VISIBLE items only.
    const items = [...nav.querySelectorAll('.ds-navitem')]
      .filter(b => getComputedStyle(b).display !== 'none')
      .map(b => b.getBoundingClientRect());
    return { visible: r.height > 0 && r.bottom <= innerHeight + 1, count: items.length,
             minH: Math.min(...items.map(i => i.height)), minW: Math.min(...items.map(i => i.width)) };
  })()`);
  m.assert(bar.visible, `nav bar visible & pinned to viewport bottom (${JSON.stringify(bar)})`);
  m.assert(bar.count === 4, `4 visible nav items (got ${bar.count})`);
  m.assert(bar.minH >= 44 && bar.minW >= 44, `items ≥44px targets (minH=${bar.minH}, minW=${bar.minW})`);

  // Redundant legacy chrome hidden.
  const legacyHidden = await m.eval(`['hamburger','topbar-dashboard-mobile','topbar-mobile-menu']
    .every(id => getComputedStyle(document.getElementById(id)).display === 'none')`);
  m.assert(legacyHidden, 'hamburger + mobile topbar icons hidden (replaced by the bar)');

  // No horizontal overflow.
  const noHScroll = await m.eval(`document.documentElement.scrollWidth <= window.innerWidth`);
  m.assert(noHScroll, 'no horizontal scroll at 390px');
  await m.snap('01-reference-with-nav');

  // Browse tab opens the Browse PAGE (P4a): search + track segments +
  // section accordion + tappable lesson rows.
  await m.click('[data-nav="browse"]'); await m.sleep(600);
  const browse = await m.eval(`(() => {
    const page = document.querySelector('.browse-page');
    if (!page) return { page: false };
    return {
      page: true,
      search: !!page.querySelector('[data-browse-search]'),
      tracks: page.querySelectorAll('[data-browse-track]').length,
      sections: page.querySelectorAll('.browse-section').length,
      rows: page.querySelectorAll('[data-browse-lesson]').length,
    };
  })()`);
  m.assert(browse.page, 'Browse opens the Browse page');
  m.assert(browse.search && browse.tracks === 3, `Browse has search + 3 track segments (${JSON.stringify(browse)})`);
  m.assert(browse.sections >= 3 && browse.rows >= 10, `Browse lists sections + lessons (${browse.sections} sections, ${browse.rows} rows)`);
  await m.snap('02-browse-page');

  // Search narrows across tracks; a row tap routes into the lesson.
  await m.eval(`(() => {
    const s = document.querySelector('[data-browse-search]');
    s.value = 'two sum';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await m.sleep(400);
  const found = await m.eval(`(() => {
    const rows = [...document.querySelectorAll('[data-browse-lesson]')];
    return { count: rows.length, hasTwoSum: rows.some(r => r.dataset.browseLesson === 'two-sum') };
  })()`);
  m.assert(found.hasTwoSum && found.count < 10, `search narrows to matches (${JSON.stringify(found)})`);
  await m.click('[data-browse-lesson="two-sum"]'); await m.sleep(800);
  const browsed = await m.eval(`state.currentLessonId`);
  m.assert(browsed === 'two-sum', `Browse row routes into the lesson (got ${browsed})`);
  await m.eval(`document.getElementById('browse-btn').click()`); await m.sleep(400);

  // "All filters" keeps the drawer's power tools one tap away.
  await m.click('[data-browse-more]'); await m.sleep(500);
  const drawerOpen = await m.eval(`document.body.classList.contains('sidebar-open')`);
  m.assert(drawerOpen, 'All-filters row opens the legacy drawer (capability preserved)');
  await m.snap('02b-browse-drawer-via-filters');
  await m.click('#sidebar-backdrop'); await m.sleep(400);

  // Today tab opens the Today HOME page (P2) with a one-tap next rep.
  await m.click('[data-nav="today"]'); await m.sleep(700);
  const home = await m.eval(`(() => {
    const page = document.querySelector('.today-home-page');
    if (!page) return { page: false };
    return {
      page: true,
      greeting: /Good (morning|afternoon|evening)/.test(page.querySelector('.ds-title')?.textContent || ''),
      hero: !!page.querySelector('[data-today-start]'),
      stats: page.querySelectorAll('.ds-stat').length,
      ariaCurrent: document.querySelector('[data-nav="today"]')?.getAttribute('aria-current') === 'page',
    };
  })()`);
  m.assert(home.page, 'Today opens the Today home page');
  m.assert(home.greeting, 'home shows a time-of-day greeting');
  m.assert(home.hero, 'home shows the hero Start CTA');
  m.assert(home.stats === 3, `home shows 3 stat tiles (got ${home.stats})`);
  m.assert(home.ariaCurrent, 'Today nav item carries aria-current="page"');
  await m.snap('03-today-home');

  // Hero Start routes into the picked lesson (one tap → drilling).
  const heroId = await m.eval(`document.querySelector('[data-today-start]')?.getAttribute('data-lesson-id')`);
  await m.click('[data-today-start]'); await m.sleep(900);
  const landed = await m.eval(`typeof state !== 'undefined' && state.currentLessonId`);
  m.assert(landed === heroId, `Start routes into the picked lesson (${landed} === ${heroId})`);
  await m.snap('03b-hero-landed');
  await m.eval(`document.getElementById('today-home-btn').click()`); await m.sleep(400);

  // Practice tab opens the ds-sheet launcher (P3) — grouped, bottom-anchored.
  await m.click('[data-nav="practice"]'); await m.sleep(500);
  const launcher = await m.eval(`(() => {
    const sc = document.getElementById('practice-launcher');
    if (!sc || !sc.classList.contains('is-open')) return { open: false };
    const sheet = sc.querySelector('.ds-sheet');
    const r = sheet.getBoundingClientRect();
    const rows = [...sc.querySelectorAll('[data-btn-id], [data-action]')];
    const groups = sc.querySelectorAll('.ds-label').length;
    return { open: true, bottomAnchored: r.bottom >= innerHeight - 2, groups,
             rowCount: rows.length,
             minRowH: Math.min(...rows.map(x => x.getBoundingClientRect().height || 999)) };
  })()`);
  m.assert(launcher.open, 'Practice opens the launcher sheet');
  m.assert(launcher.bottomAnchored, `launcher is bottom-anchored (${JSON.stringify(launcher)})`);
  m.assert(launcher.groups >= 3, `launcher has grouped sections (got ${launcher.groups})`);
  m.assert(launcher.rowCount >= 8 && launcher.minRowH >= 44,
    `launcher rows present + ≥44px (${launcher.rowCount} rows, minH ${launcher.minRowH})`);
  await m.snap('04-practice-launcher');

  // A concrete row launches its mode and closes the sheet (Rapid-Fire).
  const hasRapid = await m.eval(`!!document.querySelector('#practice-launcher [data-btn-id="rapid-fire-btn"]')`);
  if (hasRapid) {
    await m.click('#practice-launcher [data-btn-id="rapid-fire-btn"]'); await m.sleep(700);
    const launched = await m.eval(`(() => ({
      closed: !document.getElementById('practice-launcher').classList.contains('is-open'),
      rapid: !!document.querySelector('.rapid-fire-page, [data-rapid], #rapid-fire-modal') ||
             (document.getElementById('lesson-shell')?.textContent || '').includes('Rapid'),
    }))()`);
    m.assert(launched.closed, 'sheet closes after launching a mode');
    m.assert(launched.rapid, 'tapped row actually launches its mode (Rapid-Fire)');
    await m.snap('04b-rapid-launched');
  } else {
    m.assert(false, 'rapid-fire row missing from launcher');
  }
  await m.reload();
  await m.waitFor(`document.querySelector('#ds-appnav')`, { timeoutMs: 6000 });

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

  // Chrome carries stroke icons, not emoji (D07). Check the VISIBLE chrome:
  // topbar controls, bottom nav, launcher sheet, Today home page.
  const emojiScan = await m.eval(`(() => {
    const EMOJI = /[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{FE0F}]/u;
    const visText = (root) => {
      let out = '';
      const walk = (n) => {
        if (n.nodeType === 3) { out += n.textContent; return; }
        if (n.nodeType !== 1) return;
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        for (const c of n.childNodes) walk(c);
      };
      if (root) walk(root);
      return out;
    };
    document.getElementById('today-home-btn').click();
    const zones = {
      topbar: visText(document.getElementById('topbar')),
      nav: visText(document.getElementById('ds-appnav')),
      today: visText(document.querySelector('.today-home-page')),
    };
    document.getElementById('practice-launcher-btn').click();
    zones.launcher = visText(document.querySelector('#practice-launcher .ds-sheet'));
    document.querySelector('[data-launcher-close]')?.click();
    const offenders = Object.entries(zones).filter(([, t]) => EMOJI.test(t || '')).map(([k, t]) => k + ':' + (t.match(EMOJI) || [])[0]);
    return { offenders };
  })()`);
  m.assert(emojiScan.offenders.length === 0,
    `no emoji in visible chrome (offenders: ${JSON.stringify(emojiScan.offenders)})`);

  // Streak grace rule (contrarian catch): a mid-streak user who hasn't
  // drilled TODAY yet still sees their streak — with "keep it today" copy —
  // not "Start a streak".
  await m.evalAwait(`(async () => {
    const day = 86400000, now = Date.now();
    const seed = JSON.parse(localStorage.getItem('jsdrill.progress.v1'));
    seed.history = { 'two-sum': [
      { at: now - day, event: 'L1-pass' },
      { at: now - 2 * day, event: 'L1-pass' },
    ]};
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(seed));
  })()`);
  await m.eval(`history.replaceState(null, '', location.pathname)`);
  await m.reload();
  await m.waitFor(`document.querySelector('#ds-appnav')`, { timeoutMs: 6000 });
  await m.click('[data-nav="today"]'); await m.sleep(600);
  const graceChip = await m.eval(`document.querySelector('.today-home-page .ds-chip--accent')?.textContent || ''`);
  m.assert(/2-day · keep it today/.test(graceChip),
    `pre-drill mid-streak shows grace copy (got ${JSON.stringify(graceChip)})`);

  console.log('\n===== mobile =====');
  const mr = m.report();
  await m.close();

  // ── Desktop ───────────────────────────────────────────────────────────────
  const d = await connect({ url: 'http://localhost:8765/', mobile: false,
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
    outDir: path.join(OUT, 'desktop'), waitForLoadMs: 2600 });
  // P4b: desktop now renders the ds RAIL (deep coverage in p4b-rail.js).
  const desktop = await d.eval(`(() => {
    const nav = document.getElementById('ds-appnav');
    const r = nav.getBoundingClientRect();
    const menus = [...document.querySelectorAll('.topbar-menu[data-menu]')];
    const aside = document.querySelector('aside.app-sidebar').getBoundingClientRect();
    return { rail: getComputedStyle(nav).display !== 'none' && r.left === 0 && r.width >= 200 && r.height >= 400,
             menusHidden: menus.every(m => getComputedStyle(m).display === 'none'),
             sidebarOffCanvas: aside.right <= 0 };
  })()`);
  d.assert(desktop.rail, `desktop shows the ds rail (P4b) (${JSON.stringify(desktop)})`);
  d.assert(desktop.menusHidden, 'topbar dropdown menus retired on desktop');
  d.assert(desktop.sidebarOffCanvas, 'permanent sidebar retired to off-canvas drawer');
  await d.snap('01-desktop-rail');
  console.log('\n===== desktop =====');
  const dr = d.report();
  await d.close();

  process.exit(mr.failed + mr.errors + dr.failed + dr.errors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
