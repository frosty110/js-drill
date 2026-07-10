// before-shots.js — capture BEFORE/AFTER screenshots of every major surface
// for the design-loop redesign (iter-artifacts/design-loop/).
//
// Usage:
//   node tools/cdp/before-shots.js [outRoot]
//   default outRoot: iter-artifacts/design-loop/shots/00-before
//
// Writes <outRoot>/mobile/*.png (390×844) and <outRoot>/desktop/*.png (1440×900).
// This is a CAPTURE probe, not a regression probe — it asserts only that the
// app booted on each page; visual judgment happens by reading the images.

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('./lib');

const BASE = 'http://localhost:8765';
const OUT = process.argv[2] || path.join(__dirname, '..', '..', 'iter-artifacts', 'design-loop', 'shots', '00-before');

// Seed: a returning user with some progress, resumed into a 6-tab patterns lesson.
const SEED = `(async () => {
  const m = await fetch('./data/manifest.json').then(r => r.json());
  const all = m.sections.flatMap(s => s.lessons).filter(l => l.status === 'full');
  const pat = all.find(l => l.id === 'two-sum') || all.find(l => l.track === 'patterns');
  const done = all.slice(0, 12);
  const now = Date.now();
  const data = {
    __v: 5, welcomed: true, lastLessonId: pat.id, lastTab: 'reference',
    sidebarTrack: 'patterns',
    progress: Object.fromEntries(done.map(l => [l.id, { L1: 'passed', L2: 'passed', L3: 'passed' }])),
    reviews: Object.fromEntries(done.slice(0, 4).map((l, i) => [l.id, {
      lastPassedAt: now - (i + 2) * 86400000, interval: 86400000, dueAt: now - (i + 1) * 3600000 }])),
    weakness: { [done[2].id]: true },
  };
  localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  return pat.id;
})()`;

async function bootedOk(s, label) {
  const ok = await s.eval(`!!document.querySelector('#lesson-shell, .sd-root, body')`);
  s.assert(ok, `${label}: page booted`);
}

async function captureApp(s, { mobile }) {
  // 1) first-run home (fresh storage)
  await s.eval(`localStorage.clear()`);
  await s.reload();
  await s.snap('home-firstrun');

  // 2) returning-user home (seeded)
  await s.evalAwait(SEED);
  await s.reload();
  await s.waitFor(`document.querySelector('.tab-btn')`, { timeoutMs: 6000 }).catch(() => {});
  await s.snap('home-returning-reference');
  await bootedOk(s, 'app');

  // 3) lesson tabs
  for (const lvl of ['L1', 'L2', 'L3']) {
    const has = await s.eval(`!!document.querySelector('.tab-btn[data-level="${lvl}"]')`);
    if (has) { await s.click(`.tab-btn[data-level="${lvl}"]`); await s.sleep(600); await s.snap(`tab-${lvl}`); }
  }
  const hasConv = await s.eval(`!!document.querySelector('.tab-btn[data-level="conversation"]')`);
  if (hasConv) { await s.click('.tab-btn[data-level="conversation"]'); await s.sleep(600); await s.snap('tab-conversation'); }
  const hasWalk = await s.eval(`!!document.querySelector('.tab-btn[data-level="walkthrough"]')`);
  if (hasWalk) { await s.click('.tab-btn[data-level="walkthrough"]'); await s.sleep(600); await s.snap('tab-walkthrough'); }

  // 4) sidebar / drawer
  await s.reload();
  if (mobile) {
    await s.click('#hamburger'); await s.sleep(500); await s.snap('sidebar-drawer');
  } else {
    await s.snap('sidebar-desktop'); // visible by default on desktop
  }

  // 5) nav menus — reload before each overlay so states don't stack
  if (mobile) {
    await s.reload();
    await s.click('#topbar-mobile-menu'); await s.sleep(400); await s.snap('mobile-browse-menu');
  } else {
    for (const menu of ['practice', 'drills', 'train', 'insights']) {
      await s.reload();
      await s.click(`.topbar-menu[data-menu="${menu}"]`); await s.sleep(400); await s.snap(`menu-${menu}`);
    }
  }

  // 6) settings dropdown
  await s.reload();
  await s.click('#topbar-settings'); await s.sleep(400); await s.snap('settings-dropdown');

  // 7) command palette
  await s.reload();
  await s.click('#palette-trigger'); await s.sleep(400); await s.snap('palette');

  // 8) Today's Plan modal (hidden launcher button, synthetic click is the contract)
  await s.reload();
  await s.click('#today-btn'); await s.sleep(600); await s.snap('today-plan');

  // 9) Dashboard
  await s.reload();
  await s.eval(`location.hash = '#/m/dashboard'`); await s.sleep(900); await s.snap('dashboard');
  // dashboard is long — bottom half too
  await s.eval(`window.scrollTo(0, document.body.scrollHeight); document.querySelector('.app-main')?.scrollTo(0, 99999)`);
  await s.sleep(300); await s.snap('dashboard-bottom');
}

async function capturePage(s, url, label) {
  await s.eval(`location.href = ${JSON.stringify(url)}`);
  await s.sleep(2200);
  await s.snap(label);
  await bootedOk(s, label);
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  let totalFailed = 0;
  for (const mode of [{ name: 'mobile', mobile: true }, { name: 'desktop', mobile: false, viewport: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false } }]) {
    const s = await connect({
      url: `${BASE}/`, mobile: mode.mobile, viewport: mode.viewport,
      outDir: path.join(OUT, mode.name), waitForLoadMs: 2600,
    });
    await captureApp(s, { mobile: mode.mobile });
    await capturePage(s, `${BASE}/system-design.html`, 'system-design-landing');
    await capturePage(s, `${BASE}/diagnostic.html`, 'diagnostic');
    console.log(`\n===== ${mode.name} =====`);
    const r = s.report();
    totalFailed += r.failed;
    await s.close();
  }
  process.exit(totalFailed > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
