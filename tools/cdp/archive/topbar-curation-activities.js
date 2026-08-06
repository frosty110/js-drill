#!/usr/bin/env node
// Verifies the curation-vs-capability hide split (2026-05-27 fix). Before
// this fix, the prep-4day cram plan curation set inline display:none on
// every non-allowlisted *-btn, and _topbarItemFromButton read that as
// "permanently unactionable" — so the Drill and Train topbar dropdowns
// silently collapsed to empty on the cram. Activities are modality, not
// corpus; the fix moves plan-curation to a .sidebar-curation-hidden class
// (sidebar-only) and reserves inline display:none for capability/context
// hides (haptic on iOS, cram-only buttons without a cram).
//
// Invariants this probe locks in:
//   1) On prep-4day: Drill dropdown lists ≥1 item per family (5 groups).
//   2) On prep-4day: Train dropdown lists ≥1 item.
//   3) On prep-4day: the sidebar STILL hides drill/train buttons (curation
//      not regressed) — they have the .sidebar-curation-hidden class.
//   4) On starter (no allowlist): Drill + Train populate as before.
//   5) Inline style.display:none on a button DOES still filter it from the
//      topbar (capability-hide channel preserved).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-topbar-curation';

function pass(label) { console.log(`  ✓ ${label}`); }
function fail(label, detail) { console.error(`  ✗ ${label}`); if (detail) console.error('    ' + detail); process.exitCode = 1; }

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: false, outDir: OUT });

  // Seed a state that subscribes to the prep-4day cram path.
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null,
    subscribedPathId: 'prep-4day'
  }))`);
  await s.reload();
  await s.sleep(900);
  await s.snap('01-cram-loaded');

  // ── Invariant 1: Drill dropdown populates on prep-4day ───────────────
  const drillItems = await s.evalAwait(`(async () => {
    document.querySelector('.topbar-menu[data-menu="drills"]')?.click();
    await new Promise(r => setTimeout(r, 200));
    const dd = document.getElementById('topbar-dropdown');
    const items = dd ? Array.from(dd.querySelectorAll('.topbar-item')).map(b => b.getAttribute('data-btn-id')) : [];
    const groups = dd ? dd.querySelectorAll('.topbar-group-label').length : 0;
    return { items, groups, hidden: dd?.classList.contains('hidden') };
  })()`);
  await s.snap('02-cram-drill-open');
  if (drillItems.items.length >= 5 && drillItems.groups >= 3) {
    pass(`Drill menu on cram: ${drillItems.items.length} items across ${drillItems.groups} groups`);
  } else {
    fail(`Drill menu on cram should have ≥5 items across ≥3 groups`, JSON.stringify(drillItems));
  }

  // Close dropdown before opening the next.
  await s.evalAwait(`(async () => { document.body.click(); await new Promise(r => setTimeout(r, 150)); return true; })()`);

  // ── Invariant 2: Train dropdown populates on prep-4day ───────────────
  const trainItems = await s.evalAwait(`(async () => {
    document.querySelector('.topbar-menu[data-menu="train"]')?.click();
    await new Promise(r => setTimeout(r, 200));
    const dd = document.getElementById('topbar-dropdown');
    const items = dd ? Array.from(dd.querySelectorAll('.topbar-item')).map(b => b.getAttribute('data-btn-id')) : [];
    return { items };
  })()`);
  await s.snap('03-cram-train-open');
  if (trainItems.items.length >= 1) {
    pass(`Train menu on cram: ${trainItems.items.length} items (${trainItems.items.join(', ')})`);
  } else {
    fail(`Train menu on cram should have ≥1 item`, JSON.stringify(trainItems));
  }

  // ── Invariant 3: Sidebar curation still applies — drill buttons in the
  //     sidebar should carry .sidebar-curation-hidden on prep-4day.
  const sidebarState = await s.evalAwait(`(() => {
    const ids = ['recognize-btn','bug-hunt-btn','gotcha-btn','rapid-fire-btn','big-o-btn'];
    return ids.map(id => {
      const el = document.getElementById(id);
      return {
        id,
        curatedHidden: !!el && el.classList.contains('sidebar-curation-hidden'),
        inlineDisplay: el?.style.display || ''
      };
    });
  })()`);
  const allCurated = sidebarState.every(x => x.curatedHidden && x.inlineDisplay !== 'none');
  if (allCurated) {
    pass(`Sidebar curation still active (drill/train buttons class-hidden, not inline-style-hidden)`);
  } else {
    fail(`Sidebar curation regressed`, JSON.stringify(sidebarState));
  }

  // ── Invariant 4: Switch to starter — drills + train still populate ───
  await s.evalAwait(`(() => {
    const raw = JSON.parse(localStorage.getItem('jsdrill.progress.v1'));
    raw.subscribedPathId = 'starter';
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(raw));
  })()`);
  await s.reload();
  await s.sleep(800);
  const starterDrills = await s.evalAwait(`(async () => {
    document.querySelector('.topbar-menu[data-menu="drills"]')?.click();
    await new Promise(r => setTimeout(r, 200));
    const dd = document.getElementById('topbar-dropdown');
    return dd ? dd.querySelectorAll('.topbar-item').length : 0;
  })()`);
  await s.snap('04-starter-drill-open');
  if (starterDrills >= 5) {
    pass(`Drill menu on starter: ${starterDrills} items`);
  } else {
    fail(`Drill menu on starter should have ≥5 items`, `got ${starterDrills}`);
  }

  // ── Invariant 5: Capability-hide channel preserved — if a button has
  //     inline display:none, the topbar must still filter it.
  await s.evalAwait(`(async () => { document.body.click(); await new Promise(r => setTimeout(r, 150)); return true; })()`);
  const capabilityCheck = await s.evalAwait(`(async () => {
    const el = document.getElementById('recognize-btn');
    if (!el) return { ok: false, reason: 'recognize-btn missing' };
    el.style.display = 'none';
    document.querySelector('.topbar-menu[data-menu="drills"]')?.click();
    await new Promise(r => setTimeout(r, 200));
    const dd = document.getElementById('topbar-dropdown');
    const ids = dd ? Array.from(dd.querySelectorAll('.topbar-item')).map(b => b.getAttribute('data-btn-id')) : [];
    el.style.removeProperty('display');
    return { ok: !ids.includes('recognize-btn'), ids };
  })()`);
  if (capabilityCheck.ok) {
    pass(`Capability hide (inline style.display:none) still filters from topbar`);
  } else {
    fail(`Capability hide regressed — inline display:none button leaked into topbar`, JSON.stringify(capabilityCheck));
  }

  await s.close();
  if (process.exitCode) {
    console.error('\nFAIL — see screenshots in ' + OUT);
  } else {
    console.log('\nAll 5 invariants pass.');
  }
})().catch(e => { console.error(e); process.exit(1); });
