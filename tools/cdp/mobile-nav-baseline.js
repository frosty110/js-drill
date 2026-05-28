// Capture baseline mobile screenshots of the topbar + sidebar nav for the
// 2026-05-28 deep mobile UI/UX review. Probes:
//   - topbar at viewport top (sidebar closed)
//   - sidebar drawer open (hamburger tapped) — full drawer + lesson list
//   - topbar dropdown opened on mobile (📂 Browse)
//   - command palette open (🔍)
//   - settings dropdown (⚙️) open
// Also dumps measured topbar height, hamburger button rect, and surface-toggle
// rect so we can reason about alignment + tap-target areas off-screen.

const { ensureServer, ensureChrome, connect } = require('./lib');

(async () => {
  const outDir = process.argv[2] || '/tmp/mobile-nav-baseline';
  await ensureServer({ port: 8765, dir: process.cwd() });
  await ensureChrome();
  // Append a cache-buster so a previously-cached CSS/HTML doesn't persist across runs.
  const cb = Date.now();
  const s = await connect({ url: `http://localhost:8765/?_=${cb}`, mobile: true, outDir });
  // Seed welcomed=true so the first-time picker doesn't cover the topbar/sidebar.
  await s.seedLocalStorage('jsdrill.progress.v1', { __v: 5, welcomed: true, progress: {}, reviews: {}, weakness: {}, revealed: {}, bestTimes: {}, mockHistory: {}, sidebarTrack: 'patterns' });

  await s.waitFor('document.getElementById("topbar") && document.getElementById("hamburger")');
  // Dismiss any plan-picker if it shows.
  await s.eval(`document.querySelectorAll('#path-modal, #plan-picker, .plan-picker-overlay').forEach(el => el.style.display = 'none')`);

  // 1. Topbar with sidebar closed — what the user sees on first paint.
  await s.snap('01-topbar-closed');

  // Dump measurements that the screenshots can't surface.
  const metrics = await s.eval(`(() => {
    const r = el => el ? el.getBoundingClientRect() : null;
    const h = r(document.getElementById('hamburger'));
    const tb = r(document.getElementById('topbar'));
    const st = r(document.querySelector('.surface-toggle'));
    const plan = r(document.getElementById('topbar-plan'));
    const right = r(document.querySelector('.topbar-right'));
    const icons = [...document.querySelectorAll('.topbar-icon')].filter(b => getComputedStyle(b).display !== 'none').map(b => ({ id: b.id, rect: r(b) }));
    return { vw: innerWidth, vh: innerHeight, hamburger: h, topbar: tb, surfaceToggle: st, plan, right, icons };
  })()`);
  console.log('METRICS:', JSON.stringify(metrics, null, 2));

  // 2. Open sidebar drawer
  await s.click('#hamburger');
  await s.sleep(400);
  await s.snap('02-sidebar-open');

  // Sidebar contents — scroll a bit to see the lesson list
  await s.eval(`document.querySelector('#sidebar-nav')?.scrollTo(0, 0)`);
  await s.snap('03-sidebar-top');

  // Filter chip state
  const filterState = await s.eval(`(() => {
    const fs = ['#path-btn','#hide-mastered-btn','#repair-filter-btn'].map(sel => {
      const b = document.querySelector(sel); if (!b) return null;
      const r = b.getBoundingClientRect();
      return { sel, text: b.textContent.trim(), rect: { w: r.width, h: r.height } };
    });
    return fs;
  })()`);
  console.log('FILTER CHIPS:', JSON.stringify(filterState, null, 2));

  // Close sidebar
  await s.click('#sidebar-backdrop');
  await s.sleep(300);

  // 3. Open Browse menu
  await s.click('#topbar-mobile-menu');
  await s.sleep(300);
  await s.snap('04-browse-open');

  // 4. Drill into a category
  const firstCat = await s.eval(`document.querySelector('.topbar-item-mobile-cat')?.dataset.cat || null`);
  console.log('First mobile cat:', firstCat);
  if (firstCat) {
    await s.click('.topbar-item-mobile-cat');
    await s.sleep(300);
    await s.snap('05-browse-category');
  }

  // Close dropdown
  await s.eval(`document.getElementById('topbar-dropdown').classList.add('hidden')`);
  await s.sleep(150);

  // 5. Settings dropdown
  await s.click('#topbar-settings');
  await s.sleep(300);
  await s.snap('06-settings-open');
  await s.eval(`document.getElementById('topbar-dropdown').classList.add('hidden')`);
  await s.sleep(150);

  // 6. Command palette
  await s.click('#palette-trigger');
  await s.sleep(300);
  await s.snap('07-palette-open');
  await s.eval(`document.getElementById('palette-overlay').classList.add('hidden')`);
  await s.sleep(150);

  await s.close();
  s.report();
})().catch(e => { console.error(e); process.exit(1); });
