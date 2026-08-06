// Verifies the unified Dashboard + #/m/<mode> open-in-new-tab routing.
// Scenarios: (1) top-nav Dashboard opens the merged 3-section view; (2) boot
// at #/m/dashboard opens it; (3) boot at #/m/mock starts mock; (4) Review menu
// no longer lists Stats/Streak and items are routable <a href="#/m/…">;
// (5) existing lesson deep-link still resolves; (6) mobile 📊 icon opens it.
const { ensureServer, ensureChrome, connect } = require('../lib');

const ROOT = 'http://localhost:8765/';

async function clearSWAndReload(s, hash = '') {
  await s.evalAwait(`(async () => {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (self.caches) { const k = await caches.keys(); await Promise.all(k.map(x => caches.delete(x))); }
    if (${JSON.stringify(!!hash)}) location.hash = ${JSON.stringify(hash)};
  })()`);
  await s.reload();
  await s.waitFor(`typeof openDashboard === 'function' && !!state.currentLessonId`, { timeoutMs: 8000 });
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // ── Desktop scenarios 1-5 ────────────────────────────────────────────────
  const s = await connect({ url: ROOT, mobile: false, viewport: { width: 1100, height: 800, deviceScaleFactor: 1, mobile: false }, outDir: '/tmp/jsdrill-dashboard-desktop' });
  await clearSWAndReload(s);

  // (1) Top-nav Dashboard → merged 3-section view.
  await s.click('#topbar-dashboard');
  await s.sleep(300);
  const dash = await s.eval(`(() => {
    const m = document.getElementById('dashboard-modal');
    const open = m && getComputedStyle(m).display !== 'none';
    const b = document.getElementById('dashboard-body');
    return {
      open,
      daily: !!b?.querySelector('[data-dash-daily]')?.textContent.trim(),
      cells: b?.querySelectorAll('[data-dash-activity] [data-streak-idx]').length || 0,
      stats: /Track Balance/.test(b?.querySelector('[data-dash-stats]')?.textContent || ''),
    };
  })()`);
  s.assert(dash.open, 'S1: #dashboard-modal should be visible after clicking Dashboard');
  s.assert(dash.daily, 'S1: daily-progress section should render');
  s.assert(dash.cells === 60, `S1: activity heatmap should have 60 cells (got ${dash.cells})`);
  s.assert(dash.stats, 'S1: stats section should contain the Track Balance compass');
  await s.snap('01-dashboard-desktop');

  // (1b) Escape closes the Dashboard (parity with every other modal).
  await s.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await s.sleep(200);
  const escClosed = await s.eval(`(() => { const m = document.getElementById('dashboard-modal'); return getComputedStyle(m).display === 'none'; })()`);
  s.assert(escClosed, 'S1b: Escape should close the Dashboard');

  // (1c) Dashboard is discoverable in the Cmd-K palette by name.
  const inPalette = await s.eval(`typeof _paletteBuildIndex === 'function' && _paletteBuildIndex().some(i => i.label === 'Dashboard' && i.kind === 'mode')`);
  s.assert(inPalette, 'S1c: command palette index should contain a "Dashboard" mode entry');

  // (4) Review menu: no Stats/Streak items; items are routable anchors.
  await s.sleep(150);
  await s.click('.topbar-menu[data-menu="insights"]');
  await s.sleep(250);
  const menu = await s.eval(`(() => {
    const body = document.querySelector('#topbar-dropdown .topbar-dropdown-body') || document.getElementById('topbar-dropdown');
    const items = [...body.querySelectorAll('.topbar-item')];
    return {
      hasStats: items.some(i => i.dataset.btnId === 'stats-btn'),
      hasStreak: items.some(i => i.dataset.btnId === 'streak-map-btn'),
      anchors: items.filter(i => i.tagName === 'A' && (i.getAttribute('href') || '').startsWith('#/m/')).length,
      total: items.length,
    };
  })()`);
  s.assert(!menu.hasStats && !menu.hasStreak, `S4: Review menu must not list Stats/Streak (stats=${menu.hasStats}, streak=${menu.hasStreak})`);
  s.assert(menu.anchors > 0 && menu.anchors === menu.total, `S4: every Review item should be an <a href="#/m/…"> (${menu.anchors}/${menu.total})`);
  await s.snap('02-review-menu-desktop');

  // (2) Boot directly at #/m/dashboard → dashboard open on load.
  await clearSWAndReload(s, '#/m/dashboard');
  await s.sleep(300);
  const bootDash = await s.eval(`(() => { const m = document.getElementById('dashboard-modal'); return m && getComputedStyle(m).display !== 'none'; })()`);
  s.assert(bootDash, 'S2: booting at #/m/dashboard should open the Dashboard');
  await s.snap('03-boot-dashboard');

  // (3) Boot at #/m/mock → mock interview active.
  await clearSWAndReload(s, '#/m/mock');
  await s.sleep(400);
  const mock = await s.eval(`!!(state.mock && state.mock.active)`);
  s.assert(mock, 'S3: booting at #/m/mock should start a mock interview (state.mock.active)');

  // (5) Existing lesson deep-link still resolves.
  await clearSWAndReload(s, '#/two-sum/L1');
  await s.sleep(300);
  const lesson = await s.eval(`({ id: state.currentLessonId, tab: state.currentTab })`);
  s.assert(lesson.id === 'two-sum', `S5: #/two-sum/L1 should resolve to two-sum (got ${JSON.stringify(lesson.id)})`);
  s.assert(lesson.tab === 'L1', `S5: tab should be L1 (got ${JSON.stringify(lesson.tab)})`);

  const r1 = s.report();
  await s.close();

  // ── Mobile scenario: 📊 icon opens the Dashboard ─────────────────────────
  const m = await connect({ url: ROOT, mobile: true, viewport: { width: 390, height: 844 }, outDir: '/tmp/jsdrill-dashboard-mobile' });
  await clearSWAndReload(m);
  const iconVisible = await m.eval(`(() => { const b = document.getElementById('topbar-dashboard-mobile'); if (!b) return false; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()`);
  m.assert(iconVisible, 'M1: mobile 📊 Dashboard icon should be visible at 390px');
  await m.click('#topbar-dashboard-mobile');
  await m.sleep(300);
  const mOpen = await m.eval(`(() => { const el = document.getElementById('dashboard-modal'); return el && getComputedStyle(el).display !== 'none'; })()`);
  m.assert(mOpen, 'M1: mobile 📊 icon should open the Dashboard');
  const noOverflow = await m.eval(`document.documentElement.scrollWidth <= window.innerWidth + 1`);
  m.assert(noOverflow, 'M1: no horizontal overflow at 390px with Dashboard open');
  await m.snap('01-dashboard-mobile');
  const r2 = m.report();
  await m.close();

  const totalFail = (r1.failed + r1.errors + r1.networkErrors) + (r2.failed + r2.errors + r2.networkErrors);
  process.exit(totalFail > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
