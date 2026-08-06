// 2026-05-29 Probe: verify the trimmed IA (Practice 5 / Drill 5 / Train 5 /
// Review 6) lands correctly on iPhone viewport. For each topbar menu:
//   - open the desktop menu OR the mobile-browse → category drilldown
//   - count rendered items
//   - screenshot
// Also exercises the new actions:
//   - Drill family shuffle: tap a family row, assert a known mode button got
//     synth-clicked (we listen for clicks on the 4 candidate buttons before
//     tapping, then check which fired).
//   - Practice "Pick one": tap the row, assert one of (review-btn / weak-btn /
//     at-risk-btn / lucky-btn / shuffle-btn) was synth-clicked.

const { ensureServer, ensureChrome, connect } = require('../lib');

(async () => {
  const outDir = process.argv[2] || '/tmp/mobile-menus-trim';
  await ensureServer({ port: 8765, dir: process.cwd() });
  await ensureChrome();
  const cb = Date.now();
  const s = await connect({ url: `http://localhost:8765/?_=${cb}`, mobile: true, outDir });
  await s.seedLocalStorage('jsdrill.progress.v1', { __v: 5, welcomed: true, progress: {}, reviews: {}, weakness: {}, revealed: {}, bestTimes: {}, mockHistory: {}, sidebarTrack: 'patterns' });
  await s.reload();
  await s.waitFor('document.getElementById("topbar-mobile-menu")');

  // Open mobile Browse picker.
  await s.click('#topbar-mobile-menu');
  await s.sleep(300);
  await s.snap('01-browse-picker');
  const catLabels = await s.eval(`[...document.querySelectorAll('.topbar-item-mobile-cat .topbar-item-name')].map(n => n.textContent.trim())`);
  console.log('CATEGORIES:', catLabels);

  // For each category: tap, count items, snapshot, back.
  async function drillCategory(catKey, snapName) {
    await s.eval(`document.querySelector('.topbar-item-mobile-cat[data-mobile-cat="${catKey}"]')?.click()`);
    await s.sleep(280);
    await s.snap(snapName);
    const items = await s.eval(`[...document.querySelectorAll('.topbar-item:not(.topbar-item-mobile-cat) .topbar-item-name')].map(n => n.textContent.trim())`);
    console.log(`${catKey.toUpperCase()} ITEMS (${items.length}):`, items);
    const groupLabels = await s.eval(`[...document.querySelectorAll('.topbar-group-label')].map(n => n.textContent.trim())`);
    console.log(`${catKey.toUpperCase()} GROUPS:`, groupLabels);
    // Back to picker.
    await s.eval(`document.querySelector('[data-cat-back]')?.click()`);
    await s.sleep(180);
    return items;
  }

  const practiceItems = await drillCategory('practice', '02-practice');
  const drillItems = await drillCategory('drills', '03-drills');
  const trainItems = await drillCategory('train', '04-train');
  const reviewItems = await drillCategory('insights', '05-review');

  s.assert(practiceItems.length >= 4 && practiceItems.length <= 6, `Practice item count is reasonable (${practiceItems.length})`);
  s.assert(drillItems.length === 5, `Drill collapsed to 5 family entries (got ${drillItems.length})`);
  s.assert(drillItems.includes('Run it in your head'), `Drill includes 'Run it in your head' family`);
  s.assert(practiceItems.includes('Pick one'), `Practice includes 'Pick one' smart launcher`);
  // Reflect renamed → Review (mobile picker category label).
  s.assert(catLabels.includes('Review'), `Mobile picker shows 'Review' (renamed from Reflect)`);

  // Test the shuffle action: re-open Drills, watch for synth-click on candidate buttons.
  await s.eval(`document.querySelector('.topbar-item-mobile-cat[data-mobile-cat="drills"]')?.click()`);
  await s.sleep(280);
  // Instrument: capture which candidate button got clicked.
  await s.eval(`
    window.__lastSyntheticClick = null;
    ['crystal-btn','whatif-btn','trace-hop-btn','reverse-walk-btn'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', e => { window.__lastSyntheticClick = id; }, { capture: true });
    });
  `);
  // Tap the 🧠 "Run it in your head" row.
  await s.eval(`document.querySelector('.topbar-item[data-action="shuffle"]')?.click()`);
  await s.sleep(220);
  const shuffleResult = await s.eval(`window.__lastSyntheticClick`);
  console.log('SHUFFLE picked button:', shuffleResult);
  s.assert(['crystal-btn','whatif-btn','trace-hop-btn','reverse-walk-btn'].includes(shuffleResult), `Shuffle picked one of the family members (got ${shuffleResult})`);

  // Close any modal/session triggered by the synth-click, then test pick-smart.
  await s.eval(`document.body.classList.remove('in-session'); document.querySelectorAll('.modal, #stats-modal, #today-modal').forEach(m => m.style.display = 'none')`);
  await s.sleep(150);

  await s.click('#topbar-mobile-menu');
  await s.sleep(250);
  await s.eval(`document.querySelector('.topbar-item-mobile-cat[data-mobile-cat="practice"]')?.click()`);
  await s.sleep(280);
  await s.eval(`
    window.__lastSyntheticClick = null;
    ['review-btn','weak-btn','at-risk-btn','lucky-btn','shuffle-btn'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', e => { window.__lastSyntheticClick = id; }, { capture: true });
    });
  `);
  await s.eval(`document.querySelector('.topbar-item[data-action="pick-smart"]')?.click()`);
  await s.sleep(220);
  const pickResult = await s.eval(`window.__lastSyntheticClick`);
  console.log('PICK-SMART routed to:', pickResult);
  s.assert(['review-btn','weak-btn','at-risk-btn','lucky-btn','shuffle-btn'].includes(pickResult), `Pick-smart routed to a triage button (got ${pickResult})`);

  await s.close();
  s.report();
})().catch(e => { console.error(e); process.exit(1); });
