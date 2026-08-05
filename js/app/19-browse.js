// ── 19: Browse — first-class lesson browser (design-loop P4, parts 1+3) ────
// The nav's "Browse" destination: search + track segments + FIRST-CLASS power
// filters (Plan View / Hide Mastered / Needs-work / tag facets) + section
// accordion + tappable lesson rows, rendered into #lesson-shell from ds/
// components (page classes in css/08-ds-browse.css). Deep link: #/m/browse.
//
// P4 part 3 migrated the off-canvas drawer's power tools INTO this page and
// retired the drawer itself (D10 — the aside stays in the DOM as a synthetic-
// click target + palette index source; it just never renders). Every filter
// reads/writes the SAME persisted state fields the drawer used, so nothing
// resets: starterPath / starterPathTrack (Plan view + scope), hideMastered,
// repairFilter, tagFilter / tagFilterOpen (facets + panel disclosure).
//
// Filter semantics (drawer parity, one deliberate widening):
//   · Needs work (repair) WINS: shows every lesson in buildRepairIndex()
//     across ALL tracks (the drawer scoped it to the active surface — the
//     page-level view drops that hidden scoping; strictly more reachable).
//   · Plan view shows the subscribed plan's lessons in path order with step
//     numbers; the scope chips (All/Syntax/Patterns/Applied) reuse
//     starterPathTrack. Track segments yield while it's on.
//   · Hide mastered keeps due-for-review lessons visible (focus-mode rule).
//   · Facets apply to Problems-track lessons only (Reference/Syntax is never
//     tag-filtered — same rule the merged Problems list used). AND across
//     facets, OR within one; counts come from the stable problems corpus.
//   · Search spans ALL tracks (a rusty user hunting "two sum" shouldn't have
//     to know which track owns it) and composes with the active filters.
//
// Status dots: ds-status colors (good = mastered · warn = in progress ·
// hollow = untouched). Attention chips derive from the repair index rank:
// overdue (bad) > due (accent) > weak (bad) > reveal (warn).

// Derived from the one track registry (js/app/01-state-content.js), so Browse
// and Home can never disagree about what tracks exist. Browse still shows the
// three tracks rather than the two AREAS Home groups them into — that is a
// deliberate difference in altitude for a search-and-filter surface, not a
// second taxonomy — and the Type facet crosses the two the other way.
const _BROWSE_TRACKS = TRACKS.map(t => ({ key: t.key, label: t.label }));

// Repair-rank → row chip (label + ds-chip modifier). Ranks come from
// buildRepairIndex (09-stats): 0 overdue · 1 due · 2 weak · 3 reveal.
const _BROWSE_REP_CHIP = [
  { label: 'overdue', cls: 'ds-chip--bad' },
  { label: 'due', cls: 'ds-chip--accent' },
  { label: 'weak', cls: 'ds-chip--bad' },
  { label: 'reveal', cls: 'ds-chip--warn' },
];

let _browseQ = ''; // transient search text (not persisted — a fresh Browse starts clean)

function _browseIsProblem(l) { return isProblemsTrack(l.track); }

// Count of active filters for the disclosure badge (view toggles + facet picks).
function _browseFilterCount() {
  return (state.starterPath ? 1 : 0)
    + (state.hideMastered ? 1 : 0)
    + (state.repairFilter ? 1 : 0)
    + tagFilterActiveCount();
}

// The filtered, ordered lesson pool the list renders. Also returns the
// path-position map so rows can carry plan step numbers.
function _browsePool(repIdx) {
  const q = _browseQ.trim().toLowerCase();
  const match = (l) => !q
    || l.title.toLowerCase().includes(q)
    || l.section.toLowerCase().includes(q)
    || l.id.toLowerCase().includes(q);
  const hideOk = (l) => !state.hideMastered
    || isDueForReview(l.id)
    || lessonOverallStatus(l.id) !== 'mastered';
  const facetOk = (l) => !_browseIsProblem(l) || tagMatch(l);

  const base = CURRICULUM.filter(l => l.status === 'full' && match(l) && facetOk(l));

  if (state.repairFilter) {
    return { pool: base.filter(l => repIdx.has(l.id)), pathPos: null };
  }
  if (state.starterPath) {
    const order = getActiveStarterPath();
    const pathPos = new Map(order.map((id, i) => [id, i]));
    const pool = base.filter(l => pathPos.has(l.id) && hideOk(l))
      .sort((a, b) => pathPos.get(a.id) - pathPos.get(b.id));
    return { pool, pathPos };
  }
  const pool = base.filter(l => hideOk(l) && (q ? true : l.track === state.sidebarTrack));
  return { pool, pathPos: null };
}

// ── Controls region: context row (segments / plan scope) + filter panel ────

function _browseControlsHtml(repIdx) {
  const q = _browseQ.trim();
  const nFilters = _browseFilterCount();
  const canPlan = typeof subscribedPathHasLessons === 'function' && subscribedPathHasLessons();
  const plan = getSubscribedPath();

  // Context row: what scopes the list right now.
  let ctxHtml;
  if (state.repairFilter) {
    ctxHtml = `<p class="browse-ctx-note">Every lesson that needs work — overdue, due, weak, or passed with a reveal — across all tracks.</p>`;
  } else if (state.starterPath) {
    const baseOrder = getPathLessonOrder(plan) || [];
    const cur = state.starterPathTrack || 'all';
    const choices = [{ id: 'all', label: 'All' }, ..._BROWSE_TRACKS.map(t => ({ id: t.key, label: t.label }))];
    ctxHtml = `<div class="browse-segs" role="group" aria-label="Plan scope">` + choices.map(c => {
      const count = c.id === 'all'
        ? baseOrder.length
        : baseOrder.filter(id => findLesson(id)?.track === c.id).length;
      const on = cur === c.id;
      return `<button class="ds-btn${on ? ' ds-btn--primary' : ' ds-btn--subtle'}" data-bf-plan-track="${c.id}" ${count === 0 ? 'disabled' : ''}>${c.label} <span class="browse-seg-n">${count}</span></button>`;
    }).join('') + `</div>`;
  } else {
    ctxHtml = `<div class="browse-segs" role="group" aria-label="Track">` + _BROWSE_TRACKS.map(t => `
      <button class="ds-btn${t.key === state.sidebarTrack && !q ? ' ds-btn--primary' : ' ds-btn--subtle'}" data-browse-track="${t.key}">${t.label}</button>`).join('') + `</div>`;
  }

  // Disclosure toggle.
  const icon = typeof dsIcon === 'function' ? dsIcon('funnel', 17) : '';
  const toggleHtml = `
    <button class="browse-filter-toggle" data-bf="toggle-panel" aria-expanded="${state.tagFilterOpen ? 'true' : 'false'}">
      ${icon}<span>Filters</span>
      ${nFilters ? `<span class="browse-fcount">${nFilters}</span>` : ''}
      <span class="browse-caret" aria-hidden="true">›</span>
    </button>`;

  let panelHtml = '';
  if (state.tagFilterOpen) {
    // View toggles.
    const viewChips = [
      { key: 'plan', label: 'Plan view', on: state.starterPath, disabled: !canPlan,
        title: canPlan ? 'Show only your study plan’s lessons, in order' : 'Your current study plan has no drillable lesson sequence' },
      { key: 'hide-mastered', label: 'Hide mastered', on: state.hideMastered, disabled: state.repairFilter,
        title: state.repairFilter ? 'Needs work already filters to lessons needing attention' : 'Hide lessons you’ve fully mastered (due reviews stay visible)' },
      { key: 'repair', label: 'Needs work', n: repIdx.size, on: state.repairFilter,
        title: 'Show only lessons that need attention — overdue, due, weak, or reveal-flagged' },
    ];
    const viewHtml = `
      <div class="browse-fgroup">
        <span class="ds-label">View</span>
        <div class="browse-chips">${viewChips.map(c => `
          <button class="browse-chip${c.on ? ' is-on' : ''}" data-bf="${c.key}" ${c.disabled ? 'disabled' : ''} aria-pressed="${c.on ? 'true' : 'false'}" title="${escapeHtml(c.title)}">${c.label}${c.n != null ? ` <span class="n">${c.n}</span>` : ''}</button>`).join('')}
        </div>
      </div>`;

    // Tag facets — over the Problems corpus (drawer parity). Shown whenever
    // problems lessons are in scope, or a facet is active (so it can be cleared).
    const facetsInScope = state.repairFilter || state.starterPath || !!q
      || state.sidebarTrack !== 'syntax' || tagFilterActiveCount() > 0;
    let facetsHtml = '';
    if (facetsInScope && Array.isArray(TAG_FACETS) && TAG_FACETS.length) {
      const corpus = CURRICULUM.filter(_browseIsProblem);
      const countFor = (facet, valueId) => corpus.filter(l => {
        const v = facetValueOf(facet, l);
        return Array.isArray(v) ? v.includes(valueId) : v === valueId;
      }).length;
      facetsHtml = TAG_FACETS.map(facet => {
        const values = facet.id === 'topic'
          ? problemsTopics().map(s => ({ id: s, label: s }))
          : (Array.isArray(facet.values) ? facet.values : []);
        if (!values.length) return '';
        const sel = state.tagFilter[facet.id] || [];
        const counts = values.map(v => countFor(facet, v.id));
        // audit F17: a facet whose EVERY value matches zero lessons is a dead
        // control — today `company` ships 8 registry chips and 0/171 lessons
        // carry the tag, so a phone user scrolls past a row of noughts that
        // can only ever empty the list. Hide the whole group until at least
        // one value has stock. The registry (data/tags.json) is untouched:
        // tag one lesson and the facet reappears by itself. A facet with an
        // ACTIVE selection always renders, or the pick would be unclearable.
        if (!sel.length && counts.every(n => n === 0)) return '';
        const chips = values.map((v, i) => {
          const n = counts[i];
          const on = sel.includes(v.id);
          return `<button class="browse-chip${on ? ' is-on' : ''}${n === 0 ? ' is-muted' : ''}" data-facet="${escapeHtml(facet.id)}" data-value="${escapeHtml(String(v.id))}" aria-pressed="${on ? 'true' : 'false'}">${escapeHtml(v.label)} <span class="n">${n}</span></button>`;
        }).join('');
        return `<div class="browse-fgroup"><span class="ds-label">${escapeHtml(facet.label)}</span><div class="browse-chips">${chips}</div></div>`;
      }).join('');
    }

    // Plan row — the study-plan switcher lives here now (the drawer's Plan
    // chip retired with it). openPathModal is the same modal as always.
    const planHtml = `
      <div class="browse-plan-row">
        <span class="ds-label">Plan</span>
        <b>${escapeHtml(plan?.label || 'Starter Plan')}</b>
        <button class="ds-btn ds-btn--ghost ds-btn--pill" data-bf="switch-plan">Switch</button>
      </div>`;

    const clearHtml = nFilters
      ? `<button class="ds-btn ds-btn--ghost ds-btn--pill" data-bf="clear">Clear all filters</button>` : '';

    panelHtml = `<div class="browse-filter-panel">${viewHtml}${facetsHtml}${planHtml}${clearHtml}</div>`;
  }

  return ctxHtml + toggleHtml + panelHtml;
}

function _renderBrowseControls(shell) {
  const host = shell.querySelector('[data-browse-controls]');
  if (!host) return;
  host.innerHTML = _browseControlsHtml(buildRepairIndex());
}

// ── List region: section accordion + lesson rows ───────────────────────────

function _renderBrowseList(shell) {
  const host = shell.querySelector('[data-browse-list]');
  if (!host) return;
  const repIdx = buildRepairIndex();
  const q = _browseQ.trim();
  const { pool, pathPos } = _browsePool(repIdx);

  // Group into ordered sections (pool order is preserved — manifest order, or
  // path order under Plan view, which also orders sections by first step).
  const sections = [];
  const byName = new Map();
  for (const l of pool) {
    let s = byName.get(l.section);
    if (!s) { s = { name: l.section, lessons: [] }; byName.set(l.section, s); sections.push(s); }
    s.lessons.push(l);
  }

  const currentSection = findLesson(state.currentLessonId)?.section;
  const openAll = !!q || state.starterPath || state.repairFilter;

  const rowHtml = (l) => {
    const st = lessonOverallStatus(l.id);
    const dotCls = st === 'mastered' ? 'browse-dot--mastered'
      : st === 'in_progress' ? 'browse-dot--progress' : 'browse-dot--none';
    const rep = repIdx.get(l.id);
    const chip = rep && _BROWSE_REP_CHIP[rep.rank]
      ? `<span class="ds-chip ${_BROWSE_REP_CHIP[rep.rank].cls}">${_BROWSE_REP_CHIP[rep.rank].label}</span>` : '';
    const step = pathPos ? `<span class="browse-step">${pathPos.get(l.id) + 1}.</span>` : '';
    return `
      <button class="browse-row" data-browse-lesson="${escapeHtml(l.id)}">
        <span class="browse-dot ${dotCls}"></span>
        ${step}
        <span class="browse-row-title">${escapeHtml(l.title)}</span>
        ${chip}
        <span class="browse-row-chev" aria-hidden="true">›</span>
      </button>`;
  };

  const sectionsHtml = sections.map(s => {
    const done = s.lessons.filter(l => lessonOverallStatus(l.id) === 'mastered').length;
    const open = openAll || s.name === currentSection ? ' open' : '';
    const pct = s.lessons.length ? Math.round(100 * done / s.lessons.length) : 0;
    return `
      <details class="browse-section"${open}>
        <summary>
          <b class="browse-sec-name">${escapeHtml(s.name)}</b>
          <span class="ds-num ds-mute browse-sec-count">${done}/${s.lessons.length}</span>
          <span class="ds-progress browse-sec-meter"><i style="width:${pct}%"></i></span>
        </summary>
        <div class="browse-sec-body">${s.lessons.map(rowHtml).join('')}</div>
      </details>`;
  }).join('');

  let emptyHtml = '';
  if (!sections.length) {
    const why = q ? `No lessons match “${escapeHtml(q)}”.`
      : state.repairFilter ? 'Nothing needs work right now — everything is on schedule.'
        : 'No lessons match the active filters.';
    const clear = _browseFilterCount()
      ? `<button class="ds-btn ds-btn--ghost ds-btn--pill" data-bf="clear" style="margin-top: var(--ds-s3);">Clear all filters</button>` : '';
    emptyHtml = `<div class="ds-card" style="text-align:center;"><p class="ds-dim" style="margin:0;">${why}</p>${clear}</div>`;
  }

  host.innerHTML = sectionsHtml || emptyHtml;
}

// ── Interaction wiring (delegated once per openBrowse) ─────────────────────

function _browseClearFilters(shell) {
  state.starterPath = false;
  state.hideMastered = false;
  state.repairFilter = false;
  state.tagFilter = {};
  if (typeof _invalidateStarterPathCache === 'function') _invalidateStarterPathCache();
  saveProgress();
  if (typeof updateReviewBadge === 'function') updateReviewBadge();
  _renderBrowseControls(shell);
  _renderBrowseList(shell);
}

function _browseToggleFacet(facetId, valueId) {
  const sel = state.tagFilter[facetId] ? state.tagFilter[facetId].slice() : [];
  const i = sel.indexOf(valueId);
  if (i === -1) sel.push(valueId); else sel.splice(i, 1);
  if (sel.length) state.tagFilter[facetId] = sel; else delete state.tagFilter[facetId];
  saveProgress();
}

function _browseControlClick(e, shell) {
  const rerender = () => { _renderBrowseControls(shell); _renderBrowseList(shell); };

  const seg = e.target.closest('[data-browse-track]');
  if (seg) {
    state.sidebarTrack = seg.dataset.browseTrack;
    // Keep the Problems⇄Reference surface consistent — renderSidebar reverts
    // any surface-inconsistent track (contrarian, iter 7).
    if (typeof SURFACE_OF_TRACK !== 'undefined' && SURFACE_OF_TRACK[state.sidebarTrack]) {
      state.surface = SURFACE_OF_TRACK[state.sidebarTrack];
    }
    saveProgress();
    // Segment tap starts a fresh in-track view (search spans tracks, so a
    // stale query would make the pick look ignored).
    _browseQ = '';
    const search = shell.querySelector('[data-browse-search]');
    if (search) search.value = '';
    rerender();
    return;
  }

  const planScope = e.target.closest('[data-bf-plan-track]');
  if (planScope && !planScope.disabled) {
    const t = planScope.dataset.bfPlanTrack;
    if (t !== state.starterPathTrack) {
      state.starterPathTrack = t;
      if (typeof _invalidateStarterPathCache === 'function') _invalidateStarterPathCache();
      saveProgress();
      if (typeof updateReviewBadge === 'function') updateReviewBadge(); // badge is path-scope-aware (iter 45)
    }
    rerender();
    return;
  }

  const facet = e.target.closest('[data-facet]');
  if (facet) {
    _browseToggleFacet(facet.dataset.facet, facet.dataset.value);
    rerender();
    return;
  }

  const bf = e.target.closest('[data-bf]');
  if (!bf || bf.disabled) return;
  const action = bf.dataset.bf;
  if (action === 'toggle-panel') {
    state.tagFilterOpen = !state.tagFilterOpen;
    saveProgress();
    _renderBrowseControls(shell);
  } else if (action === 'plan') {
    if (typeof subscribedPathHasLessons === 'function' && !subscribedPathHasLessons()) return;
    state.starterPath = !state.starterPath;
    if (typeof _invalidateStarterPathCache === 'function') _invalidateStarterPathCache();
    saveProgress();
    if (typeof updateReviewBadge === 'function') updateReviewBadge();
    rerender();
  } else if (action === 'hide-mastered') {
    state.hideMastered = !state.hideMastered;
    saveProgress();
    rerender();
  } else if (action === 'repair') {
    state.repairFilter = !state.repairFilter;
    saveProgress();
    rerender();
  } else if (action === 'switch-plan') {
    if (typeof openPathModal === 'function') openPathModal();
  } else if (action === 'clear') {
    _browseClearFilters(shell);
  }
}

function openBrowse() {
  const shell = document.getElementById('lesson-shell');
  if (!shell) return;
  // audit F10: Browse owns the URL while it is the rendered surface — the same
  // replaceState contract Home (22-home.js) and the scoped review session
  // (23-review.js) already honour. Without it the address bar kept whatever
  // lesson hash _updateHash() last wrote, so reload / copy-link / cmd+click
  // from Browse all resolved to a lesson the user wasn't looking at.
  // `#/m/browse` is the slug that round-trips: _dispatchModeRoute's generic
  // `<mode>-btn` lookup finds #browse-btn, which calls straight back here.
  // Written inside openBrowse (not on the button handler like Home) because
  // the drawer redirect in 14-init-core also calls this function directly.
  try { history.replaceState(null, '', '#/m/browse'); } catch (_) {}
  if (!_BROWSE_TRACKS.some(t => t.key === state.sidebarTrack)) state.sidebarTrack = 'patterns';
  _browseQ = '';

  shell.innerHTML = `
    <div class="ds-root ds-page browse-page">
      <header class="ds-page__head">
        <div class="ds-page__titlerow"><h1 class="ds-title">Browse</h1></div>
      </header>
      <input class="ds-field" data-browse-search type="search" placeholder="Search lessons…" autocomplete="off" spellcheck="false" />
      <div data-browse-controls></div>
      <div data-browse-list class="browse-list"></div>
    </div>`;

  // Search: input stays in the DOM across re-renders (IME-safe — composition
  // is never interrupted, focus/selection persist); only the LIST re-renders.
  const search = shell.querySelector('[data-browse-search]');
  let deb = null;
  search.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(() => {
      _browseQ = search.value;
      _renderBrowseList(shell);
      _renderBrowseControls(shell); // segment active-state reflects "searching all tracks"
    }, 120);
  });

  // Delegated wiring survives region re-renders (hosts persist; innerHTML swaps).
  shell.querySelector('[data-browse-controls]').addEventListener('click', (e) => _browseControlClick(e, shell));
  shell.querySelector('[data-browse-list]').addEventListener('click', (e) => {
    const row = e.target.closest('[data-browse-lesson]');
    if (row) { selectLesson(row.dataset.browseLesson); return; }
    if (e.target.closest('[data-bf="clear"]')) _browseClearFilters(shell);
  });

  _renderBrowseControls(shell);
  _renderBrowseList(shell);

  const main = document.querySelector('.app-main');
  if (main) main.scrollTop = 0;
}

(() => {
  const btn = document.getElementById('browse-btn');
  if (btn) btn.addEventListener('click', openBrowse);
})();
