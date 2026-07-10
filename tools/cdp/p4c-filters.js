// p4c-filters.js — verify P4 part 3 (design-loop): the Browse page carries the
// retired drawer's power filters as first-class ds controls.
//
// Desktop @1280px: filter disclosure (Plan view / Hide mastered / Needs work +
// tag facets + plan switcher + clear-all) renders in-page; each toggle filters
// the list AND persists to localStorage (same state fields the drawer used);
// Plan view shows step numbers + scope chips; `/` focuses the page search on
// Browse and opens the palette elsewhere; the drawer never renders and the
// residual #hamburger synthetic click redirects to Browse.
// Mobile @390px: same controls via the bottom bar, ≥44px targets, no h-scroll.
//
//   node tools/cdp/p4c-filters.js [outDir]

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('./lib');

const OUT = process.argv[2] || '/tmp/jsdrill-probe-p4c-filters';

// Seeded fixture: one due (two-sum), one mastered-not-due (p-contains-dup),
// one overdue/resurrect (p-anagrams), one weak (p-valid-anagram), one
// reveal-flagged (s-variables) → repair index size 4.
function seedState() {
  const now = Date.now();
  const DAY = 86400000;
  const done = { L1: 'passed', L2: 'passed', L3: 'passed' };
  return {
    __v: 5, welcomed: true, lastLessonId: 'two-sum', lastTab: 'reference',
    sidebarTrack: 'patterns', surface: 'problems',
    progress: { 'two-sum': done, 'p-contains-dup': done, 'p-anagrams': done },
    reviews: {
      'two-sum': { lastPassedAt: now - 2 * DAY, interval: DAY, dueAt: now - 3600000 },
      'p-contains-dup': { lastPassedAt: now, interval: DAY, dueAt: now + DAY },
      'p-anagrams': { lastPassedAt: now - 5 * DAY, interval: DAY, dueAt: now - 3 * DAY },
    },
    weakness: { 'p-valid-anagram': 1 },
    revealed: { 's-variables': { L3: true } },
  };
}

async function openBrowse(s) {
  await s.eval(`document.getElementById('browse-btn').click()`);
  await s.sleep(500);
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // ── Desktop 1280 ──────────────────────────────────────────────────────────
  const d = await connect({ url: 'http://localhost:8765/', mobile: false,
    viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: path.join(OUT, 'desktop'), waitForLoadMs: 2600 });

  await d.eval(`localStorage.setItem('jsdrill.progress.v1', ${JSON.stringify(JSON.stringify(seedState()))})`);
  await d.eval(`history.replaceState(null, '', location.pathname)`); // hash beats seeded state on boot
  await d.reload();
  await d.waitFor(`document.querySelector('#ds-appnav')`, { timeoutMs: 6000 });

  // 1 · Browse page + filter disclosure.
  await openBrowse(d);
  const page = await d.eval(`(() => {
    const p = document.querySelector('.browse-page');
    return {
      page: !!p,
      search: !!p?.querySelector('[data-browse-search]'),
      segs: p ? p.querySelectorAll('[data-browse-track]').length : 0,
      toggle: !!p?.querySelector('[data-bf="toggle-panel"]'),
      rows: p ? p.querySelectorAll('[data-browse-lesson]').length : 0,
    };
  })()`);
  d.assert(page.page && page.search && page.toggle, `Browse page renders with search + filter toggle (${JSON.stringify(page)})`);
  d.assert(page.segs === 3, `3 track segments (got ${page.segs})`);
  d.assert(page.rows >= 10, `lesson rows render (${page.rows})`);

  await d.eval(`(() => { const t = document.querySelector('[data-bf="toggle-panel"]'); if (t.getAttribute('aria-expanded') !== 'true') t.click(); })()`);
  await d.sleep(400);
  const panel = await d.eval(`(() => {
    const p = document.querySelector('.browse-filter-panel');
    if (!p) return { panel: false };
    const labels = [...p.querySelectorAll('.ds-label')].map(l => l.textContent.trim());
    return {
      panel: true,
      viewChips: ['plan', 'hide-mastered', 'repair'].every(k => !!p.querySelector('[data-bf="' + k + '"]')),
      repairN: p.querySelector('[data-bf="repair"] .n')?.textContent,
      facetGroups: labels.filter(l => /Type|Topic|Difficulty|Company/.test(l)).length,
      planRow: !!p.querySelector('[data-bf="switch-plan"]'),
      planLabel: p.querySelector('.browse-plan-row b')?.textContent.trim(),
      noEmoji: !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(p.textContent),
    };
  })()`);
  d.assert(panel.panel && panel.viewChips, `filter panel opens with the 3 view toggles (${JSON.stringify(panel)})`);
  d.assert(panel.repairN === '4', `Needs-work count = repair index size (got ${panel.repairN})`);
  d.assert(panel.facetGroups >= 3, `tag facet groups render (${panel.facetGroups})`);
  d.assert(panel.planRow && /Starter/.test(panel.planLabel || ''), `plan switcher row shows the subscribed plan (${panel.planLabel})`);
  d.assert(panel.noEmoji, 'no emoji in the filter chrome (D07)');
  await d.snap('01-filter-panel');

  // 2 · Row attention chips derive from the repair index.
  const chips = await d.eval(`(() => {
    const chipOf = id => document.querySelector('[data-browse-lesson="' + id + '"] .ds-chip')?.textContent.trim() || null;
    return { due: chipOf('two-sum'), overdue: chipOf('p-anagrams'), weak: chipOf('p-valid-anagram'), clean: chipOf('p-contains-dup') };
  })()`);
  d.assert(chips.due === 'due' && chips.overdue === 'overdue' && chips.weak === 'weak' && chips.clean === null,
    `row chips rank correctly (${JSON.stringify(chips)})`);

  // 3 · Hide mastered: mastered-not-due drops, due survives; persists.
  await d.eval(`document.querySelector('[data-bf="hide-mastered"]').click()`); await d.sleep(400);
  const hide = await d.eval(`(() => ({
    on: document.querySelector('[data-bf="hide-mastered"]').classList.contains('is-on'),
    contains: !!document.querySelector('[data-browse-lesson="p-contains-dup"]'),
    twoSum: !!document.querySelector('[data-browse-lesson="two-sum"]'),
    saved: JSON.parse(localStorage.getItem('jsdrill.progress.v1')).hideMastered === true,
    badge: document.querySelector('.browse-fcount')?.textContent,
  }))()`);
  d.assert(hide.on && !hide.contains && hide.twoSum, `Hide mastered drops mastered-not-due, keeps due (${JSON.stringify(hide)})`);
  d.assert(hide.saved, 'hideMastered persists to localStorage');
  d.assert(hide.badge === '1', `filter count badge shows 1 (got ${hide.badge})`);
  await d.snap('02-hide-mastered');
  await d.eval(`document.querySelector('[data-bf="hide-mastered"]').click()`); await d.sleep(400);

  // 4 · Needs work: exactly the repair set, across tracks; Hide-mastered chip disables.
  await d.eval(`document.querySelector('[data-bf="repair"]').click()`); await d.sleep(400);
  const rep = await d.eval(`(() => {
    const ids = [...document.querySelectorAll('[data-browse-lesson]')].map(r => r.dataset.browseLesson).sort();
    return {
      ids,
      hmDisabled: document.querySelector('[data-bf="hide-mastered"]').disabled,
      note: !!document.querySelector('.browse-ctx-note'),
      saved: JSON.parse(localStorage.getItem('jsdrill.progress.v1')).repairFilter === true,
    };
  })()`);
  d.assert(JSON.stringify(rep.ids) === JSON.stringify(['p-anagrams', 'p-valid-anagram', 's-variables', 'two-sum']),
    `Needs work shows exactly the 4 repair lessons across tracks (${rep.ids.join(', ')})`);
  d.assert(rep.hmDisabled && rep.note, 'Hide-mastered yields while Needs work is on; context note explains the view');
  d.assert(rep.saved, 'repairFilter persists to localStorage');
  await d.snap('03-needs-work');
  await d.eval(`document.querySelector('[data-bf="repair"]').click()`); await d.sleep(400);

  // 5 · Facets: Difficulty=easy narrows problems rows; badge counts; clear-all resets.
  await d.eval(`document.querySelector('[data-facet="difficulty"][data-value="easy"]').click()`); await d.sleep(400);
  const facet = await d.eval(`(() => ({
    on: document.querySelector('[data-facet="difficulty"][data-value="easy"]').classList.contains('is-on'),
    medium: !!document.querySelector('[data-browse-lesson="p-anagrams"]'),
    easy: !!document.querySelector('[data-browse-lesson="two-sum"]'),
    saved: (JSON.parse(localStorage.getItem('jsdrill.progress.v1')).tagFilter?.difficulty || []).includes('easy'),
    badge: document.querySelector('.browse-fcount')?.textContent,
  }))()`);
  d.assert(facet.on && !facet.medium && facet.easy, `Difficulty=easy filters the list (${JSON.stringify(facet)})`);
  d.assert(facet.saved && facet.badge === '1', 'facet selection persists + badges');
  await d.snap('04-facet-easy');

  // 6 · Plan view: ordered steps + scope chips; scope to Syntax; persistence.
  await d.eval(`document.querySelector('[data-bf="plan"]').click()`); await d.sleep(400);
  const plan = await d.eval(`(() => {
    const steps = [...document.querySelectorAll('.browse-step')].map(s => s.textContent.trim());
    return {
      on: document.querySelector('[data-bf="plan"]').classList.contains('is-on'),
      scopeChips: document.querySelectorAll('[data-bf-plan-track]').length,
      segsGone: document.querySelectorAll('[data-browse-track]').length === 0,
      firstStep: steps[0],
      monotonic: steps.slice(0, 10).every((s, i, a) => i === 0 || parseInt(a[i - 1]) < parseInt(s)),
      saved: JSON.parse(localStorage.getItem('jsdrill.progress.v1')).starterPath === true,
    };
  })()`);
  d.assert(plan.on && plan.scopeChips === 4 && plan.segsGone, `Plan view swaps segments for 4 scope chips (${JSON.stringify(plan)})`);
  d.assert(plan.firstStep === '1.' && plan.monotonic, `plan rows carry monotonic step numbers (first=${plan.firstStep})`);
  d.assert(plan.saved, 'starterPath persists to localStorage');
  await d.snap('05-plan-view');

  await d.eval(`document.querySelector('[data-bf-plan-track="syntax"]').click()`); await d.sleep(400);
  const scope = await d.eval(`(() => {
    const ids = [...document.querySelectorAll('[data-browse-lesson]')].map(r => r.dataset.browseLesson);
    return {
      allSyntax: ids.length > 0 && ids.every(id => (typeof findLesson === 'function' ? findLesson(id)?.track : null) === 'syntax'),
      saved: JSON.parse(localStorage.getItem('jsdrill.progress.v1')).starterPathTrack === 'syntax',
    };
  })()`);
  d.assert(scope.allSyntax && scope.saved, `plan scope chip narrows to Syntax + persists (${JSON.stringify(scope)})`);
  await d.snap('06-plan-scope-syntax');

  // 7 · Clear all resets every filter (incl. the facet from §5).
  await d.eval(`document.querySelector('[data-bf="clear"]').click()`); await d.sleep(400);
  const cleared = await d.eval(`(() => {
    const s = JSON.parse(localStorage.getItem('jsdrill.progress.v1'));
    return {
      state: !s.starterPath && !s.hideMastered && !s.repairFilter && Object.keys(s.tagFilter || {}).length === 0,
      badge: !document.querySelector('.browse-fcount'),
      segsBack: document.querySelectorAll('[data-browse-track]').length === 3,
    };
  })()`);
  d.assert(cleared.state && cleared.badge && cleared.segsBack, `Clear all resets every filter (${JSON.stringify(cleared)})`);

  // 8 · Plan switcher opens the study-plan modal.
  await d.eval(`document.querySelector('[data-bf="switch-plan"]').click()`); await d.sleep(400);
  const modal = await d.eval(`document.getElementById('path-modal').style.display === 'block'`);
  d.assert(modal, 'Switch opens the study-plan modal');
  await d.snap('07-plan-modal');
  await d.eval(`document.getElementById('path-close').click()`); await d.sleep(300);

  // 9 · Search filters in place without recreating the input (IME/focus-safe).
  await d.eval(`(() => {
    const s = document.querySelector('[data-browse-search]');
    s.focus(); s.value = 'two sum';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await d.sleep(400);
  const search = await d.eval(`(() => ({
    rows: document.querySelectorAll('[data-browse-lesson]').length,
    hasTwoSum: !!document.querySelector('[data-browse-lesson="two-sum"]'),
    focusKept: document.activeElement === document.querySelector('[data-browse-search]'),
  }))()`);
  d.assert(search.hasTwoSum && search.rows < 10, `search narrows the list (${JSON.stringify(search)})`);
  d.assert(search.focusKept, 'search keeps focus across list re-render (input never recreated)');

  // 10 · `/` focuses Browse search on the page, opens the palette elsewhere.
  await d.eval(`document.querySelector('[data-browse-search]').blur()`);
  await d.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))`);
  await d.sleep(300);
  const slashBrowse = await d.eval(`document.activeElement === document.querySelector('[data-browse-search]')`);
  d.assert(slashBrowse, '`/` on Browse focuses the page search');
  await d.eval(`document.getElementById('today-home-btn').click()`); await d.sleep(600);
  await d.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))`);
  await d.sleep(300);
  const slashPalette = await d.eval(`!document.getElementById('palette-overlay').classList.contains('hidden')`);
  d.assert(slashPalette, '`/` off Browse opens the command palette');
  await d.eval(`typeof _paletteClose === 'function' && _paletteClose()`); await d.sleep(200);

  // 11 · Drawer retired: aside never renders; hamburger redirects to Browse.
  const retired = await d.eval(`(() => ({
    asideHidden: getComputedStyle(document.querySelector('aside.app-sidebar')).display === 'none',
    backdropHidden: getComputedStyle(document.getElementById('sidebar-backdrop')).display === 'none',
    noOpenClass: !document.body.classList.contains('sidebar-open'),
  }))()`);
  d.assert(retired.asideHidden && retired.backdropHidden && retired.noOpenClass, `drawer chrome never renders (${JSON.stringify(retired)})`);
  await d.eval(`document.getElementById('hamburger').click()`); await d.sleep(500);
  const hamRedirect = await d.eval(`!!document.querySelector('.browse-page') && !document.body.classList.contains('sidebar-open')`);
  d.assert(hamRedirect, 'residual #hamburger click redirects to the Browse page');

  // 12 · No horizontal scroll.
  d.assert(await d.eval(`document.documentElement.scrollWidth <= innerWidth`), 'no horizontal scroll at 1280px');

  console.log('\n===== desktop 1280 =====');
  const dr = d.report();
  await d.close();

  // ── Mobile 390 ────────────────────────────────────────────────────────────
  const m = await connect({ url: 'http://localhost:8765/', mobile: true,
    outDir: path.join(OUT, 'mobile'), waitForLoadMs: 2600 });
  await m.eval(`localStorage.setItem('jsdrill.progress.v1', ${JSON.stringify(JSON.stringify(seedState()))})`);
  await m.eval(`history.replaceState(null, '', location.pathname)`);
  await m.reload();
  await m.waitFor(`document.querySelector('#ds-appnav')`, { timeoutMs: 6000 });

  await m.click('[data-nav="browse"]'); await m.sleep(600);
  await m.eval(`(() => { const t = document.querySelector('[data-bf="toggle-panel"]'); if (t.getAttribute('aria-expanded') !== 'true') t.click(); })()`);
  await m.sleep(400);
  const mob = await m.eval(`(() => {
    const p = document.querySelector('.browse-filter-panel');
    if (!p) return { panel: false };
    const targets = [...p.querySelectorAll('button')].filter(b => getComputedStyle(b).display !== 'none');
    return {
      panel: true,
      viewChips: ['plan', 'hide-mastered', 'repair'].every(k => !!p.querySelector('[data-bf="' + k + '"]')),
      minTarget: Math.min(...targets.map(b => b.getBoundingClientRect().height)),
      toggleH: document.querySelector('[data-bf="toggle-panel"]').getBoundingClientRect().height,
      noHScroll: document.documentElement.scrollWidth <= innerWidth,
    };
  })()`);
  m.assert(mob.panel && mob.viewChips, `mobile filter panel renders the power filters (${JSON.stringify(mob)})`);
  m.assert(mob.minTarget >= 44 && mob.toggleH >= 44, `all filter targets ≥44px (min=${mob.minTarget}, toggle=${mob.toggleH})`);
  m.assert(mob.noHScroll, 'no horizontal scroll at 390px with the panel open');
  await m.snap('01-mobile-filter-panel');

  await m.eval(`document.querySelector('[data-bf="repair"]').click()`); await m.sleep(400);
  const mrep = await m.eval(`(() => ({
    rows: document.querySelectorAll('[data-browse-lesson]').length,
    chip: !!document.querySelector('[data-browse-lesson="p-anagrams"] .ds-chip'),
    noHScroll: document.documentElement.scrollWidth <= innerWidth,
  }))()`);
  m.assert(mrep.rows === 4 && mrep.chip, `mobile Needs work filters to the repair set (${JSON.stringify(mrep)})`);
  m.assert(mrep.noHScroll, 'no horizontal scroll in the filtered list');
  await m.snap('02-mobile-needs-work');
  await m.eval(`document.querySelector('[data-bf="repair"]').click()`); await m.sleep(300);

  // Drawer retired on mobile too.
  const mret = await m.eval(`getComputedStyle(document.querySelector('aside.app-sidebar')).display === 'none' && !document.body.classList.contains('sidebar-open')`);
  m.assert(mret, 'drawer never renders at 390px');
  await m.snap('03-mobile-browse');

  console.log('\n===== mobile 390 =====');
  const mr = m.report();
  await m.close();

  process.exit(dr.failed + dr.errors + mr.failed + mr.errors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
