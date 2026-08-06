// audit-nav-matrix.js — AUDIT PROBE (2026-07-10 navigation audit).
// Collects, per viewport (390 mobile / 1280 desktop), the set of modes
// reachable via each VISIBLE channel of the new IA:
//   - Practice launcher sheet rows (direct data-btn-id + shuffle families)
//   - Settings dropdown (⚙) rows
//   - Browse page filter controls
//   - Progress page action rows / drill buttons
//   - Today home controls
//   - Topbar visible controls
//   - Command palette index (_paletteBuildIndex)
// Writes JSON to the path in argv[2]; screenshots to argv[3].
//   node tools/cdp/audit-nav-matrix.js <out.json> <shotsDir>

const path = require('path');
const fs = require('fs');
const { ensureServer, ensureChrome, connect } = require('../lib');

const OUT_JSON = process.argv[2] || '/tmp/audit-matrix.json';
const SHOTS = process.argv[3] || '/tmp/audit-matrix-shots';

const DAY = 86400000;
function seedState(now) {
  return {
    __v: 5, welcomed: true, lastLessonId: 'two-sum', lastTab: 'reference', sidebarTrack: 'patterns',
    progress: {
      'two-sum': { L1: 'passed', L2: 'passed', L3: 'passed' },
      'p-contains-dup': { L1: 'passed' },
      'p-valid-anagram': { L1: 'passed', L2: 'passed', L3: 'passed' },
      's-variables': { L1: 'passed', L2: 'passed', L3: 'passed' },
    },
    reviews: {
      'two-sum': { lastPassedAt: now - 40 * DAY, interval: 7, dueAt: now - 33 * DAY },
      'p-valid-anagram': { lastPassedAt: now - 2 * DAY, interval: 1, dueAt: now - 1 * DAY },
      's-variables': { lastPassedAt: now - 3 * DAY, interval: 1, dueAt: now - 2 * DAY },
    },
    weakness: { 'p-contains-dup': true },
    revealed: { 'p-valid-anagram': { L3: true } },
    history: {
      'two-sum': [{ at: now - DAY, event: 'L1-pass' }, { at: now - 2 * DAY, event: 'L1-pass' }],
      'p-valid-anagram': [{ at: now - DAY, event: 'L3-pass' }],
    },
  };
}

async function bootSeeded(s) {
  await s.eval(`localStorage.clear(); localStorage.setItem('jsdrill.progress.v1', ${JSON.stringify(JSON.stringify(seedState(Date.now())))})`);
  await s.eval(`history.replaceState(null,'',location.pathname)`);
  await s.reload();
  await s.waitFor(`typeof state !== 'undefined' && !!document.getElementById('ds-appnav') && CURRICULUM.length > 0`, { timeoutMs: 8000 });
  await s.sleep(500);
}

async function collect(s, viewportName) {
  const out = { viewport: viewportName };

  // ── Raw button inventory ──────────────────────────────────────────────────
  out.buttons = await s.eval(`(() => {
    const res = {};
    document.querySelectorAll('button[id$="-btn"]').forEach(b => {
      res[b.id] = {
        exists: true,
        hiddenClass: b.classList.contains('hidden'),
        inlineNone: b.style.display === 'none',
        curationHidden: b.classList.contains('sidebar-curation-hidden'),
        visible: !!(b.offsetParent),
        text: (b.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60),
      };
    });
    return res;
  })()`);

  // ── Topbar visible controls ───────────────────────────────────────────────
  out.topbar = await s.eval(`(() => {
    const vis = id => { const el = document.getElementById(id) || document.querySelector(id); return el ? getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0 : false; };
    return {
      wordmark: !!document.querySelector('.topbar-wordmark'),
      surfaceToggle: vis('.surface-toggle'),
      plan: vis('topbar-plan'),
      cramWidget: (() => { const el = document.getElementById('topbar-cram-progress'); return el && !el.hidden; })(),
      menus: [...document.querySelectorAll('.topbar-menu[data-menu]')].some(m => getComputedStyle(m).display !== 'none'),
      dashboardLink: vis('topbar-dashboard'),
      systemDesignLink: vis('topbar-system-design'),
      dashboardMobile: vis('topbar-dashboard-mobile'),
      mobileMenu: vis('topbar-mobile-menu'),
      paletteTrigger: vis('palette-trigger'),
      help: vis('topbar-help'),
      settings: vis('topbar-settings'),
    };
  })()`);

  // ── Command palette index ─────────────────────────────────────────────────
  out.palette = await s.eval(`(() => {
    const items = _paletteBuildIndex();
    return {
      count: items.length,
      modeIds: items.filter(i => i.id.startsWith('btn:')).map(i => i.id.slice(4)),
      extra: items.filter(i => i.kind === 'mode' && !i.id.startsWith('btn:')).map(i => i.id),
      lessons: items.filter(i => i.kind === 'lesson').length,
      sections: items.filter(i => i.kind === 'section').length,
    };
  })()`);

  // ── Practice launcher contents ────────────────────────────────────────────
  await s.eval(`document.getElementById('practice-launcher-btn').click()`);
  await s.sleep(400);
  out.launcher = await s.eval(`(() => {
    const sc = document.getElementById('practice-launcher');
    if (!sc || !sc.classList.contains('is-open')) return { open: false };
    const direct = [...sc.querySelectorAll('[data-btn-id]')].map(r => r.dataset.btnId);
    const shuffles = [...sc.querySelectorAll('[data-action="shuffle"]')].map(r => (r.dataset.shuffleIds || '').split(',').filter(Boolean));
    const pickSmart = !!sc.querySelector('[data-action="pick-smart"]');
    return { open: true, direct, shuffles, pickSmart };
  })()`);
  await s.snap(`${viewportName}-launcher`);
  await s.eval(`document.querySelector('#practice-launcher [data-launcher-close]')?.click()`);
  await s.sleep(200);

  // ── Settings dropdown contents ────────────────────────────────────────────
  await s.eval(`document.getElementById('topbar-settings').click()`);
  await s.sleep(400);
  out.settingsMenu = await s.eval(`(() => {
    const dd = document.getElementById('topbar-dropdown');
    const open = dd && !dd.classList.contains('hidden');
    if (!open) return { open: false };
    const rect = dd.getBoundingClientRect();
    return {
      open: true,
      ids: [...dd.querySelectorAll('[data-btn-id]')].map(r => r.dataset.btnId),
      rect: { top: rect.top, left: rect.left, right: rect.right, width: rect.width },
    };
  })()`);
  await s.snap(`${viewportName}-settings-dropdown`);
  await s.eval(`document.body.click()`);
  await s.sleep(200);

  // ── Browse page controls ──────────────────────────────────────────────────
  await s.eval(`document.getElementById('browse-btn').click()`);
  await s.sleep(500);
  await s.eval(`document.querySelector('[data-bf="toggle-panel"]')?.click()`);
  await s.sleep(400);
  out.browse = await s.eval(`(() => {
    const page = document.querySelector('.browse-page');
    if (!page) return { page: false };
    return {
      page: true,
      search: !!page.querySelector('[data-browse-search]'),
      bfControls: [...page.querySelectorAll('[data-bf]')].map(el => el.dataset.bf),
      facetGroups: page.querySelectorAll('.browse-filter-panel .ds-label, .browse-filter-panel [data-bf-facet]').length,
      switchPlan: !!page.querySelector('[data-bf="switch-plan"]'),
    };
  })()`);
  await s.snap(`${viewportName}-browse-filters`);

  // ── Progress page controls ────────────────────────────────────────────────
  await s.eval(`document.getElementById('dashboard-btn').click()`);
  await s.sleep(700);
  out.progress = await s.eval(`(() => {
    const page = document.querySelector('.progress-page, .dashboard-page');
    if (!page) return { page: false };
    return {
      page: true,
      cls: page.className,
      actions: [...page.querySelectorAll('[data-prog-action]')].map(el => el.getAttribute('data-prog-action')),
      drills: [...page.querySelectorAll('[data-prog-drill]')].map(el => el.getAttribute('data-prog-drill')),
      fixFirstRows: page.querySelectorAll('[data-prog-lesson]').length,
    };
  })()`);
  await s.snap(`${viewportName}-progress`);

  // ── Today home controls ───────────────────────────────────────────────────
  await s.eval(`document.getElementById('today-home-btn').click()`);
  await s.sleep(500);
  out.today = await s.eval(`(() => {
    const page = document.querySelector('.today-home-page');
    if (!page) return { page: false };
    return {
      page: true,
      hero: !!page.querySelector('[data-today-start]'),
      modes: [...page.querySelectorAll('[data-today-mode]')].map(el => el.getAttribute('data-today-mode')),
      thenRows: page.querySelectorAll('[data-today-row]').length,
    };
  })()`);
  await s.snap(`${viewportName}-today`);

  return out;
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  fs.mkdirSync(SHOTS, { recursive: true });
  const results = {};

  for (const [name, opts] of [
    ['mobile390', { mobile: true }],
    ['desktop1280', { mobile: false, viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false } }],
  ]) {
    const s = await connect({ url: 'http://localhost:8765/', ...opts, outDir: path.join(SHOTS, name), waitForLoadMs: 2400 });
    await bootSeeded(s);
    results[name] = await collect(s, name);
    results[name].consoleErrors = s.consoleMsgs.filter(m => m.type === 'error' || m.type === 'exception').map(m => m.text.slice(0, 200));
    await s.close();
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));
  console.log('wrote', OUT_JSON);
})().catch(e => { console.error(e); process.exit(2); });
