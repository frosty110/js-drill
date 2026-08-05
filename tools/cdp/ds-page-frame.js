// tools/cdp/ds-page-frame.js — page-frame + nav invariants across the three
// full-page destinations (Home · Library · Progress), at both viewports.
//
// This is the executable half of docs/ui-ux-guide.md § 3 (Page frame) and
// § 2 (Navigation model). Every full-page surface must:
//   · render into #lesson-shell inside .ds-root.ds-page
//   · carry exactly ONE <h1>, inside .ds-page__head
//   · use the shared column width (--ds-page-w) — no per-page max-width
//   · never scroll horizontally at 390px
//   · keep the nav mounted with ≥44px targets and a truthful aria-current
//
// When you add a destination, append it to PAGES — that's the whole change.
//
// Usage: node tools/cdp/ds-page-frame.js [outDir]
//   Requires a devtools Chrome on :9222 (see the guide § 16 for the Linux
//   launch line) and serves the repo on :8765 itself.

const { ensureServer, ensureChrome, connect } = require('./lib');

const OUT = process.argv[2] || '/tmp/jsdrill-ds-page-frame';

// [label, launcher button, expected nav aria-current key]
//
// `['today', '#today-home-btn', 'today']` used to lead this list and was the
// probe's one red assertion on both viewports: Today-home rendered a page but
// the nav mapped it to the `home` key, so aria-current could never say "today"
// (audit F5). That page is retired — #today-home-btn now delegates to Home.
//
// D15 phase 2 renamed and re-rooted the rest. The nav closes at THREE
// destinations (Home · Library · Design), so:
//   · Browse is the `library` key — same page, the name the IA settled on.
//   · Progress is no longer a destination at all. It is the header's scoped
//     meter, opened from wherever you are, so the surface at #/m/dashboard is
//     an appMode — and every appMode is launched from Home and returns there,
//     which is why Home stays lit while one is open. Asserting `home` here is
//     asserting that rule, not conceding a miss.
// Both keys are DERIVED from the route registry's `parent` chain now
// (ds/shell.js currentKey), not from sniffing page classes, which is what
// makes the same nav correct on system-design.html too.
const PAGES = [
  ['home', '#home-btn', 'home'],
  ['browse', '#browse-btn', 'library'],
  ['progress', '#dashboard-btn', 'home'],
];

// The nav is closed at three destinations plus the aux items the page can
// service (docs/information-architecture.md §4). A fourth rung appearing is a
// regression whichever direction it came from.
const NAV_DESTINATIONS = 3;

// A returning user with reps, so the pages render populated and the first-run
// welcome modal never covers the surface under test.
const SEED = `(async () => {
  const m = await (await fetch('data/manifest.json')).json();
  const ids = m.sections.flatMap(s => s.lessons.filter(l => l.status === 'full').map(l => l.id));
  const day = 86400000, now = Date.now();
  const progress = {}, reviews = {}, weakness = {}, history = {};
  ids.slice(0, 14).forEach((id, i) => {
    progress[id] = i % 4 === 3 ? { L1: 'passed' } : { L1: 'passed', L2: 'passed', L3: 'passed' };
    reviews[id] = { lastPassedAt: now - (i + 1) * day, interval: 1 + i, dueAt: now - (i - 4) * day };
  });
  ids.slice(14, 17).forEach(id => { weakness[id] = true; });
  // state.history is keyed by lesson id: { [id]: [{ at, event }] } — see
  // _streakMapBuckets in js/app/08-drills-bughunt-constraint.js.
  for (let d = 0; d < 40; d++) {
    const n = (d * 7) % 5;
    for (let k = 0; k < n; k++) {
      const id = ids[(d + k) % ids.length];
      (history[id] = history[id] || []).push({
        at: now - d * day + k * 60000,
        event: k % 3 === 2 ? 'L1-miss' : 'L1-pass',
      });
    }
  }
  localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 5, welcomed: true, progress, reviews, weakness, history,
    bestTimes: {}, mockHistory: {}, revealed: {}, sidebarTrack: 'patterns'
  }));
})()`;

const PROBE = `(() => {
  const page = document.querySelector('#lesson-shell .ds-page');
  if (!page) return { ok: false, reason: 'no .ds-page in #lesson-shell' };
  const head = page.querySelector(':scope > .ds-page__head');
  const h1s = page.querySelectorAll('h1');
  const cs = getComputedStyle(page);
  const nav = document.getElementById('ds-appnav');
  // Only VISIBLE items are measurable: the two rail-aux items (Search /
  // Settings) are display:none in bottom-bar mode by design.
  const items = nav ? [...nav.querySelectorAll('.ds-navitem')].filter(b => b.offsetParent !== null) : [];
  const small = items.filter(b => b.getBoundingClientRect().height < 44).length;
  const current = items.find(b => b.getAttribute('aria-current') === 'page');
  return {
    ok: true,
    isRoot: page.classList.contains('ds-root'),
    hasHead: !!head,
    h1Count: h1s.length,
    h1InHead: !!(h1s[0] && head && head.contains(h1s[0])),
    maxWidth: cs.maxWidth,
    pageWidthToken: getComputedStyle(document.documentElement).getPropertyValue('--ds-page-w').trim(),
    // Horizontal overflow can hide inside the real scroll container: .app-main
    // is overflow-y:auto, which computes overflow-x to auto — a too-wide child
    // scrolls THERE without ever growing documentElement.scrollWidth. Measure
    // the document, the scroll owner, and the page box, and take the worst.
    overflow: Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ...[document.querySelector('main.app-main'), page]
        .filter(Boolean).map(el => el.scrollWidth - el.clientWidth)
    ),
    navMounted: !!nav,
    navItems: items.length,
    navSmallTargets: small,
    ariaCurrent: current ? current.dataset.nav : null,
    // Any section that is NOT the shared primitive is page-local rhythm drift.
    unlabeledSections: [...page.querySelectorAll(':scope > section')]
      .filter(s => !s.classList.contains('ds-section')).length,
  };
})()`;

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  let failed = 0;
  for (const [vp, opts] of [
    ['mobile390', { mobile: true }],
    ['desktop1280', { viewport: { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false } }],
  ]) {
    const s = await connect({
      url: `http://localhost:8765/?cb=${Date.now()}`,
      ...opts,
      outDir: `${OUT}/${vp}`,
    });
    await s.evalAwait(SEED);
    await s.reload();

    for (const [label, sel, navKey] of PAGES) {
      await s.click(sel);
      await s.sleep(800);
      await s.snap(label);
      const r = await s.eval(PROBE);
      const at = `${vp}/${label}`;
      if (!s.assert(r && r.ok, `${at}: renders a .ds-page (${r && r.reason || 'ok'})`)) continue;
      s.assert(r.isRoot, `${at}: page carries .ds-root`);
      s.assert(r.hasHead, `${at}: has a .ds-page__head`);
      s.assert(r.h1Count === 1, `${at}: exactly one <h1> (got ${r.h1Count})`);
      s.assert(r.h1InHead, `${at}: the <h1> lives in the head`);
      s.assert(r.maxWidth === r.pageWidthToken,
        `${at}: column = --ds-page-w (${r.pageWidthToken}), got ${r.maxWidth}`);
      s.assert(r.overflow <= 0, `${at}: no horizontal overflow (got ${r.overflow}px)`);
      s.assert(r.navMounted && r.navItems >= NAV_DESTINATIONS, `${at}: nav mounted with its destinations (${r.navItems})`);
      s.assert(r.navSmallTargets === 0, `${at}: every nav target ≥44px (${r.navSmallTargets} too small)`);
      s.assert(r.ariaCurrent === navKey, `${at}: aria-current="${navKey}" (got ${r.ariaCurrent})`);
      s.assert(r.unlabeledSections === 0,
        `${at}: top-level sections use .ds-section (${r.unlabeledSections} off-system)`);
    }

    const rep = s.report();
    failed += rep.failed + rep.errors;
    await s.close();
  }

  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
