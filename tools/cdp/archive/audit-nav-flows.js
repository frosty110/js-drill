// audit-nav-flows.js — AUDIT PROBE (2026-07-10 navigation audit).
// Part 3+4+5 of the audit: limbo chrome, dead ends / escapes / keyboard,
// first-run empty states. Mobile 390 focus + desktop spot checks.
//   node tools/cdp/audit-nav-flows.js <out.json> <shotsDir>

const path = require('path');
const fs = require('fs');
const { ensureServer, ensureChrome, connect } = require('../lib');

const OUT_JSON = process.argv[2] || '/tmp/audit-flows.json';
const SHOTS = process.argv[3] || '/tmp/audit-flows-shots';

const DAY = 86400000;
const now = Date.now();
const SEED = {
  __v: 5, welcomed: true, lastLessonId: 'two-sum', lastTab: 'reference', sidebarTrack: 'patterns',
  progress: { 'two-sum': { L1: 'passed', L2: 'passed', L3: 'passed' }, 'p-contains-dup': { L1: 'passed' } },
  reviews: { 'two-sum': { lastPassedAt: now - 40 * DAY, interval: 7, dueAt: now - 33 * DAY } },
  weakness: { 'p-contains-dup': true },
  history: { 'two-sum': [{ at: now - DAY, event: 'L1-pass' }] },
};

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  fs.mkdirSync(SHOTS, { recursive: true });
  const out = {};

  // ═══ MOBILE 390 ═══════════════════════════════════════════════════════════
  const m = await connect({ url: 'http://localhost:8765/', mobile: true, outDir: path.join(SHOTS, 'mobile'), waitForLoadMs: 2400 });
  await m.eval(`localStorage.clear(); localStorage.setItem('jsdrill.progress.v1', ${JSON.stringify(JSON.stringify(SEED))})`);
  await m.eval(`history.replaceState(null,'',location.pathname)`);
  await m.reload();
  await m.waitFor(`typeof state !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 8000 });
  await m.sleep(400);

  // ── Escape / exit coverage on modals & sheets (mobile: no Esc key, so also
  //    check a visible close/back affordance ≥44px) ──────────────────────────
  const modalChecks = [];
  const tryModal = async (label, openExpr, modalSel, closeSel) => {
    try {
      await m.eval(openExpr);
      await m.sleep(500);
      const st = await m.eval(`(() => {
        const modal = document.querySelector(${JSON.stringify(modalSel)});
        const open = modal && (modal.style.display === 'block' || modal.classList.contains('is-open') || !modal.classList.contains('hidden'));
        const close = modal ? modal.querySelector(${JSON.stringify(closeSel)}) : null;
        const r = close ? close.getBoundingClientRect() : null;
        return { open: !!open, closeVisible: !!(r && r.width > 0), closeW: r ? Math.round(r.width) : 0, closeH: r ? Math.round(r.height) : 0 };
      })()`);
      // Escape key
      await m.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
      await m.sleep(300);
      st.escClosed = await m.eval(`(() => {
        const modal = document.querySelector(${JSON.stringify(modalSel)});
        if (!modal) return true;
        if (modal.style.display === 'block') return false;
        if (modal.classList.contains('is-open')) return false;
        if (modal.id === 'palette-overlay') return modal.classList.contains('hidden');
        return true;
      })()`);
      // force-close leftovers
      await m.eval(`(() => { const el = document.querySelector(${JSON.stringify(modalSel)}); if (el) { el.style.display='none'; el.classList.remove('is-open'); el.classList.add(el.id==='palette-overlay'?'hidden':'x-noop'); } })()`);
      modalChecks.push({ label, ...st });
    } catch (e) { modalChecks.push({ label, error: String(e.message).slice(0, 120) }); }
  };

  await tryModal('today-modal', `document.getElementById('today-btn').click()`, '#today-modal', '#today-close');
  await tryModal('mechanics-modal', `document.getElementById('mechanics-btn').click()`, '#mechanics-modal', '#mechanics-close');
  await tryModal('cheatsheet-modal', `document.getElementById('export-btn').click()`, '#cheatsheet-modal', '#cheatsheet-close');
  await tryModal('audio-modal', `document.getElementById('audio-btn').click()`, '#audio-modal', '#audio-modal-close');
  await tryModal('path-modal', `document.getElementById('path-chip').click()`, '#path-modal', '#path-close');
  await tryModal('help-modal', `document.getElementById('topbar-help').click()`, '#help-modal', '#help-close');
  await tryModal('palette', `_paletteOpen()`, '#palette-overlay', '.palette-input');
  await tryModal('practice-launcher', `document.getElementById('practice-launcher-btn').click()`, '#practice-launcher', '[data-launcher-close]');
  out.mobileModals = modalChecks;

  // ── Settings dropdown escape/close on mobile ───────────────────────────────
  await m.eval(`document.getElementById('topbar-settings').click()`);
  await m.sleep(300);
  const ddOpen = await m.eval(`!document.getElementById('topbar-dropdown').classList.contains('hidden')`);
  await m.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await m.sleep(200);
  const ddEscClosed = await m.eval(`document.getElementById('topbar-dropdown').classList.contains('hidden')`);
  out.settingsDropdown = { open: ddOpen, escClosed: ddEscClosed,
    hasVisibleCloseAffordance: await m.eval(`!!document.querySelector('#topbar-dropdown [aria-label*="lose"], #topbar-dropdown .close, #topbar-dropdown [data-close]')`) };
  await m.eval(`document.body.click()`); await m.sleep(200);

  // ── Keyboard on the new surfaces ───────────────────────────────────────────
  // Today home: '/' should open palette (no browse search on page)
  await m.eval(`document.getElementById('today-home-btn').click()`); await m.sleep(400);
  await m.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))`);
  await m.sleep(300);
  const slashOnToday = await m.eval(`!document.getElementById('palette-overlay').classList.contains('hidden')`);
  await m.eval(`_paletteClose()`);
  // Today home: 'j' — does it silently leave the page into a lesson?
  const lessonBefore = await m.eval(`state.currentLessonId`);
  await m.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }))`);
  await m.sleep(500);
  const afterJ = await m.eval(`({ id: state.currentLessonId, stillToday: !!document.querySelector('.today-home-page') })`);
  out.todayKeyboard = { slashOpensPalette: slashOnToday, jBefore: lessonBefore, jAfter: afterJ };

  // Browse: '/' focuses page search; Escape in search
  await m.eval(`document.getElementById('browse-btn').click()`); await m.sleep(500);
  await m.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))`);
  await m.sleep(200);
  const browseSlash = await m.eval(`document.activeElement && document.activeElement.matches('[data-browse-search]')`);
  out.browseKeyboard = { slashFocusesSearch: browseSlash };

  // ── Lesson tab strip visible + L3 immersive exit path ─────────────────────
  await m.eval(`selectLesson('two-sum')`); await m.sleep(700);
  await m.eval(`selectTab('L3')`); await m.sleep(700);
  out.l3Immersive = await m.eval(`(() => {
    const nav = document.getElementById('ds-appnav');
    const tabs = document.querySelectorAll('.tab-btn[data-level]');
    const firstTab = tabs[0] ? tabs[0].getBoundingClientRect() : null;
    return {
      navHidden: getComputedStyle(nav).display === 'none',
      tabCount: tabs.length,
      tabStripVisible: !!(firstTab && firstTab.width > 0 && firstTab.top >= 0),
    };
  })()`);
  await m.snap('l3-immersive');

  // ── Mock mode: exit affordance on mobile ──────────────────────────────────
  await m.eval(`document.getElementById('mock-btn').click()`); await m.sleep(900);
  out.mock = await m.eval(`(() => {
    const active = state.mock && state.mock.active;
    const banner = document.querySelector('[data-mock-banner], .mock-banner, #mock-banner');
    const giveUp = [...document.querySelectorAll('button')].filter(b => /give up|end|exit|abandon|cancel/i.test(b.textContent || '') && b.getClientRects().length);
    const nav = document.getElementById('ds-appnav');
    return {
      active: !!active,
      bannerPresent: !!banner,
      exitButtons: giveUp.map(b => ({ text: (b.textContent || '').trim().slice(0, 30), h: Math.round(b.getBoundingClientRect().height) })),
      navVisible: getComputedStyle(nav).display !== 'none',
    };
  })()`);
  await m.snap('mock-active');
  await m.eval(`if (state.mock && state.mock.active) endMockInterview(false)`); await m.sleep(300);

  // ── Session drill: exit affordance + Escape ────────────────────────────────
  await m.eval(`history.replaceState(null,'',location.pathname)`);
  await m.eval(`document.getElementById('rapid-fire-btn').click()`); await m.sleep(900);
  out.sessionDrill = await m.eval(`(() => {
    const exit = document.querySelector('[data-action^="exit-"]');
    const r = exit ? exit.getBoundingClientRect() : null;
    return {
      inSession: document.body.classList.contains('in-session'),
      exitPresent: !!exit, exitText: exit ? (exit.textContent || '').trim().slice(0, 30) : null,
      exitSize: r ? { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) } : null,
      navVisible: getComputedStyle(document.getElementById('ds-appnav')).display !== 'none',
      topbarVisible: getComputedStyle(document.getElementById('topbar')).display !== 'none',
    };
  })()`);
  await m.snap('rapid-fire-session');
  await m.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await m.sleep(400);
  out.sessionDrill.escExits = await m.eval(`!document.body.classList.contains('in-session')`);
  await m.eval(`document.querySelector('[data-action^="exit-"]')?.click()`); await m.sleep(400);

  // ── z-order: audio dock + bottom bar + launcher sheet ─────────────────────
  await m.eval(`document.getElementById('audio-dock').style.display = 'flex'`);
  await m.eval(`document.getElementById('practice-launcher-btn').click()`); await m.sleep(500);
  out.zOrder = await m.eval(`(() => {
    const z = sel => { const el = document.querySelector(sel); return el ? { z: getComputedStyle(el).zIndex, visible: el.getClientRects().length > 0 } : null; };
    return { dock: z('#audio-dock'), nav: z('#ds-appnav'), launcher: z('#practice-launcher'), scrimCovers: (() => {
      const sc = document.getElementById('practice-launcher');
      const dock = document.getElementById('audio-dock');
      if (!sc || !dock) return null;
      return parseInt(getComputedStyle(sc).zIndex || 0, 10) > parseInt(getComputedStyle(dock).zIndex || 0, 10);
    })() };
  })()`);
  await m.snap('zorder-dock-launcher');
  await m.eval(`document.querySelector('[data-launcher-close]')?.click(); document.getElementById('audio-dock').style.display = 'none';`);
  await m.sleep(200);

  console.log('mobile flows done');
  const mErrs = m.consoleMsgs.filter(x => x.type === 'error' || x.type === 'exception').map(x => x.text.slice(0, 160));
  out.mobileConsoleErrors = mErrs;
  await m.close();

  // ═══ FIRST-RUN (empty localStorage) @390 ══════════════════════════════════
  const f = await connect({ url: 'http://localhost:8765/', mobile: true, outDir: path.join(SHOTS, 'firstrun'), waitForLoadMs: 2400 });
  await f.eval(`localStorage.clear()`);
  await f.eval(`history.replaceState(null,'',location.pathname)`);
  await f.reload();
  await f.waitFor(`typeof state !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 8000 });
  await f.sleep(800);
  out.firstRun = await f.eval(`(() => {
    const pm = document.getElementById('path-modal');
    return {
      pathModalOpen: pm && pm.style.display === 'block',
      diagnosticLinkVisible: !!document.querySelector('#path-modal a[href="diagnostic.html"]') && pm.style.display === 'block',
      surface: document.querySelector('.home-page') ? 'home'
        : document.querySelector('.today-home-page') ? 'today-home'
        : (state.currentLessonId ? 'lesson:' + state.currentLessonId : 'empty'),
      navVisible: getComputedStyle(document.getElementById('ds-appnav')).display !== 'none',
    };
  })()`);
  await f.snap('firstrun-boot');
  // dismiss welcome by picking browse-on-own, then check the 4 destinations
  await f.eval(`document.querySelector('#path-modal [data-action="browse-on-own"]')?.click()`); await f.sleep(400);
  for (const [key, btn] of [['today', 'today-home-btn'], ['browse', 'browse-btn'], ['practice', 'practice-launcher-btn'], ['progress', 'dashboard-btn']]) {
    await f.eval(`document.getElementById('${btn}').click()`); await f.sleep(600);
    out['firstRun_' + key] = await f.eval(`(() => {
      const shell = document.getElementById('lesson-shell');
      const txt = (shell.textContent || '').trim();
      return {
        surface: document.querySelector('.home-page') ? 'home'
          : document.querySelector('.today-home-page') ? 'today' : document.querySelector('.browse-page') ? 'browse'
          : document.querySelector('.progress-page, .dashboard-page') ? 'progress'
          : document.getElementById('practice-launcher')?.classList.contains('is-open') ? 'launcher' : 'other',
        hasNaN: /NaN|undefined|null/.test(txt.slice(0, 3000)),
        excerpt: txt.slice(0, 120),
      };
    })()`);
    await f.snap('firstrun-' + key);
    await f.eval(`document.querySelector('[data-launcher-close]')?.click()`); await f.sleep(200);
  }
  const fErrs = f.consoleMsgs.filter(x => x.type === 'error' || x.type === 'exception').map(x => x.text.slice(0, 160));
  out.firstRunConsoleErrors = fErrs;
  await f.close();

  // ═══ DESKTOP 1280 spot-checks: settings anchor vs rail; duplicate search ══
  const d = await connect({ url: 'http://localhost:8765/', mobile: false,
    viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: path.join(SHOTS, 'desktop'), waitForLoadMs: 2400 });
  await d.eval(`localStorage.clear(); localStorage.setItem('jsdrill.progress.v1', ${JSON.stringify(JSON.stringify(SEED))})`);
  await d.eval(`history.replaceState(null,'',location.pathname)`);
  await d.reload();
  await d.waitFor(`typeof state !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 8000 });
  await d.sleep(400);

  // rail Settings → dropdown anchor distance
  await d.eval(`document.querySelector('#ds-appnav [data-nav="settings"]').click()`); await d.sleep(400);
  out.desktopSettings = await d.eval(`(() => {
    const railBtn = document.querySelector('#ds-appnav [data-nav="settings"]').getBoundingClientRect();
    const dd = document.getElementById('topbar-dropdown');
    const open = !dd.classList.contains('hidden');
    const r = dd.getBoundingClientRect();
    return { open, railBtn: { x: Math.round(railBtn.left), y: Math.round(railBtn.top) },
             panel: { x: Math.round(r.left), y: Math.round(r.top) },
             distancePx: Math.round(Math.hypot(r.left - railBtn.left, r.top - railBtn.top)) };
  })()`);
  await d.snap('settings-spatial-disconnect');
  await d.eval(`document.body.click()`); await d.sleep(200);

  // duplicate search affordances on desktop
  out.desktopSearchAffordances = await d.eval(`(() => {
    const vis = sel => { const el = document.querySelector(sel); return !!(el && el.getClientRects().length && getComputedStyle(el).display !== 'none'); };
    return {
      topbarMagnifier: vis('#palette-trigger'),
      railSearch: vis('#ds-appnav [data-nav="palette"]'),
      browsePageSearch: false, // (page not open)
      slashKey: true, cmdK: true,
    };
  })()`);
  await d.snap('desktop-baseline');

  // Problems⇄Reference toggle: what does it do now?
  const surfBefore = await d.eval(`({ surface: state.surface, lesson: state.currentLessonId })`);
  await d.eval(`document.querySelector('.surface-seg[data-surface="reference"]').click()`); await d.sleep(600);
  const surfAfter = await d.eval(`({ surface: state.surface, lesson: state.currentLessonId, page: document.querySelector('.browse-page') ? 'browse' : 'lesson' })`);
  out.surfaceToggle = { before: surfBefore, after: surfAfter };

  const dErrs = d.consoleMsgs.filter(x => x.type === 'error' || x.type === 'exception').map(x => x.text.slice(0, 160));
  out.desktopConsoleErrors = dErrs;
  await d.close();

  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  console.log('wrote', OUT_JSON);
})().catch(e => { console.error(e); process.exit(2); });
