//  SIDEBAR RENDER
// ──────────────────────────────────────────────────────────────────────────

// audit F9: true when this page load arrived on an explicit lesson deep link
// (a shared `#/two-sum/L1`), which suppresses the first-run plan-picker modal
// so the link resolves to the drill it names. Declared HERE rather than beside
// the other boot flags in slice 14 because that slice loads after this one —
// a `let` there would be in its TDZ during this file's first render pass.
// Assigned once, by initBootstrap().
let _bootedOnLessonDeepLink = false;

// Re-renders the vertical binder tab strip. Counts reflect the *full*
// curriculum per track — they don't react to search / focus / starter-path
// filters, so a user can always see how many lessons each binder holds.
function renderBinderTabs(tracks) {
  const host = document.getElementById('binder-tabs');
  if (!host) return;
  host.innerHTML = '';
  for (const track of tracks) {
    const total = CURRICULUM.filter(l => l.track === track.id).length;
    const tab = document.createElement('div');
    tab.className = 'binder-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('tabindex', '0');
    tab.setAttribute('aria-selected', state.sidebarTrack === track.id ? 'true' : 'false');
    tab.setAttribute('aria-label', `${track.label} (${total} lessons)`);
    if (state.sidebarTrack === track.id) tab.classList.add('active');
    const labelSpan = document.createElement('span');
    labelSpan.textContent = track.label;
    tab.appendChild(labelSpan);
    const countSpan = document.createElement('span');
    countSpan.className = 'binder-tab-count';
    countSpan.textContent = String(total);
    tab.appendChild(countSpan);
    const switchTo = () => {
      if (state.sidebarTrack === track.id) return;
      state.sidebarTrack = track.id;
      saveProgress();
      renderSidebar();
    };
    tab.addEventListener('click', switchTo);
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchTo(); }
    });
    host.appendChild(tab);
  }
}

// ── Faceted tag filter (merged Problems list) ───────────────────────────────
// Type/Topic are derived (track/section); Difficulty/Company are authored on the
// manifest entry. Selecting values filters the merged list (AND across facets,
// OR within one). 0-count values stay clickable-but-muted so a future-facing
// facet (e.g. Company before any lesson is tagged) is still discoverable.
function clearTagFilter() {
  state.tagFilter = {};
  saveProgress();
  renderSidebar();
}
function toggleTagValue(facetId, valueId) {
  const sel = state.tagFilter[facetId] ? state.tagFilter[facetId].slice() : [];
  const i = sel.indexOf(valueId);
  if (i === -1) sel.push(valueId); else sel.splice(i, 1);
  if (sel.length) state.tagFilter[facetId] = sel; else delete state.tagFilter[facetId];
  saveProgress();
  renderSidebar();
}
function renderTagFacets(nav) {
  if (!TAG_FACETS.length) return;
  // Problems corpus drives per-value counts (stable: ignores the active filter).
  const corpus = CURRICULUM.filter(l => l.track === 'patterns' || l.track === 'applied');
  const countFor = (facet, valueId) => corpus.filter(l => {
    const v = facetValueOf(facet, l);
    return Array.isArray(v) ? v.includes(valueId) : v === valueId;
  }).length;

  const activeN = tagFilterActiveCount();
  const wrap = document.createElement('div');
  wrap.className = 'tag-facets';

  const header = document.createElement('button');
  header.className = 'tag-facets-toggle' + (activeN ? ' has-active' : '');
  header.setAttribute('aria-expanded', state.tagFilterOpen ? 'true' : 'false');
  header.innerHTML = `<span>🏷 Filter${activeN ? ` <span class="tag-facets-count">${activeN}</span>` : ''}</span>`
    + `<span class="tag-facets-chevron">${state.tagFilterOpen ? '▾' : '▸'}</span>`;
  header.addEventListener('click', () => {
    state.tagFilterOpen = !state.tagFilterOpen;
    saveProgress();
    renderSidebar();
  });
  wrap.appendChild(header);

  if (state.tagFilterOpen) {
    const panel = document.createElement('div');
    panel.className = 'tag-facets-panel';
    for (const facet of TAG_FACETS) {
      const values = facet.id === 'topic'
        ? problemsTopics().map(s => ({ id: s, label: s }))
        : (Array.isArray(facet.values) ? facet.values : []);
      if (!values.length) continue;
      const sel = state.tagFilter[facet.id] || [];
      const chips = values.map(v => {
        const n = countFor(facet, v.id);
        const active = sel.includes(v.id) ? ' active' : '';
        const muted = n === 0 ? ' muted' : '';
        return `<button class="facet-chip${active}${muted}" data-facet="${escapeHtml(facet.id)}" data-value="${escapeHtml(String(v.id))}">${escapeHtml(v.label)}<span class="facet-chip-n">${n}</span></button>`;
      }).join('');
      const group = document.createElement('div');
      group.className = 'facet-group';
      group.innerHTML = `<div class="facet-label">${escapeHtml(facet.label)}</div><div class="facet-chips">${chips}</div>`;
      panel.appendChild(group);
    }
    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-facet]');
      if (!btn) return;
      toggleTagValue(btn.dataset.facet, btn.dataset.value);
    });
    if (activeN) {
      const clear = document.createElement('button');
      clear.className = 'tag-facets-clear';
      clear.textContent = 'Clear all';
      clear.addEventListener('click', clearTagFilter);
      panel.appendChild(clear);
    }
    wrap.appendChild(panel);
  }

  nav.insertBefore(wrap, nav.firstChild);
}

function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';
  const q = state.searchQuery.trim().toLowerCase();
  const matches = (lesson) => {
    if (!q) return true;
    return lesson.title.toLowerCase().includes(q)
        || lesson.section.toLowerCase().includes(q)
        || lesson.id.toLowerCase().includes(q);
  };
  const activeStarter = getActiveStarterPath();
  const inStarter = (lesson) => !state.starterPath || activeStarter.includes(lesson.id);
  const starterIndex = (id) => activeStarter.indexOf(id) + 1;  // 1-based for display
  const hideMasteredOk = (lesson) => {
    if (!state.hideMastered) return true;
    // Always keep due-for-review items even in focus mode.
    if (isDueForReview(lesson.id)) return true;
    return lessonOverallStatus(lesson.id) !== 'mastered';
  };
  const _repairIdx = buildRepairIndex();

  // Reflect the Plan View toggle on the button itself. The button filters the
  // sidebar to whichever path the user is subscribed to (see PATHS registry).
  // If the subscribed path has no drill-lesson sequence, the button is visible
  // but disabled — there's nothing to filter to.
  const pathBtn = document.getElementById('path-btn');
  if (pathBtn) {
    const hasLessons = subscribedPathHasLessons();
    // Auto-clear a stale active filter if we somehow ended up on a path with
    // no lessons (e.g. switched paths while the filter was on).
    if (!hasLessons && state.starterPath) state.starterPath = false;
    pathBtn.disabled = !hasLessons;
    pathBtn.style.opacity = hasLessons ? '' : '0.4';
    pathBtn.style.cursor = hasLessons ? '' : 'not-allowed';
    pathBtn.title = hasLessons
      ? 'Filter the sidebar to your current study plan’s lessons, in order'
      : 'Your current study plan has no drillable lesson sequence to filter to';
    pathBtn.classList.toggle('text-blue-300', state.starterPath && hasLessons);
    pathBtn.classList.toggle('text-slate-500', !(state.starterPath && hasLessons));
    // Show "🧭 Plan View · Syn" etc. when a track sub-filter is selected, so the
    // user always sees which scope is active without opening the chip row.
    if (state.starterPath && state.starterPathTrack && state.starterPathTrack !== 'all') {
      const shortLabel = state.starterPathTrack[0].toUpperCase() + state.starterPathTrack.slice(1, 3);
      pathBtn.textContent = '🧭 Plan View · ' + shortLabel;
    } else {
      pathBtn.textContent = '🧭 Plan View';
    }
  }

  // Paint the 👁 Hide Mastered filter's active state on every render (not just
  // on click) so a saved hideMastered:true shows as active on load.
  const hideBtn = document.getElementById('hide-mastered-btn');
  if (hideBtn) {
    hideBtn.classList.toggle('text-emerald-300', state.hideMastered);
    hideBtn.classList.toggle('text-slate-500', !state.hideMastered);
    hideBtn.style.opacity = state.repairFilter ? '0.4' : '';   // auto-disabled under Repair
    hideBtn.title = state.repairFilter ? 'Repair already filters to lessons needing work' : "Hide lessons you've fully mastered";
  }
  // Phase E: 🛠 Repair filter chip — active paint + live count.
  const repBtn = document.getElementById('repair-filter-btn');
  if (repBtn) {
    repBtn.classList.toggle('text-rose-300', state.repairFilter);
    repBtn.classList.toggle('text-slate-500', !state.repairFilter);
    const cntEl = repBtn.querySelector('#repair-filter-count');
    if (cntEl) {
      cntEl.textContent = String(_repairIdx.size);
      // iter 44 (refine): when the filter is OFF and there's work to do,
      // paint the COUNT (not the label) rose so the chip announces the
      // live decay signal at rest. Without this the chip reads identical
      // for N=0 vs N=5 — invisible diagnostic. When the filter is ON the
      // whole button is already rose; when N=0 the count stays muted.
      cntEl.classList.toggle('text-rose-300', !state.repairFilter && _repairIdx.size > 0);
    }
  }

  const _allTracks = [
    { id: 'syntax',   label: 'Syntax Fundamentals' },
    { id: 'patterns', label: 'Canonical Patterns' },
    { id: 'applied',  label: 'Applied Problems' }
  ];
  // Scope the binder to the active surface: Reference→Syntax, Problems→Patterns+Applied.
  const _surfIds = tracksForSurface(state.surface);
  if (!_surfIds.includes(state.sidebarTrack)) state.sidebarTrack = _surfIds[0];
  const tracks = _allTracks.filter(t => _surfIds.includes(t.id));

  // Render the binder tab strip (independent of which lessons are visible).
  // On the PROBLEMS surface, Patterns + Applied are merged into one list, so
  // there are no per-track sub-tabs — the Type tag facet recovers the split.
  renderBinderTabs(state.surface === 'problems' ? [] : tracks);

  // When Plan View is on, surface a track-picker chip row above the lesson
  // list. Lets the user scope the active path to one track (Syntax-only,
  // Patterns-only, Applied-only) or keep "All". No new authoring — the active
  // path is just the subscribed path's lessonOrder filtered by the picked track.
  if (state.starterPath) {
    const pathBase = getPathLessonOrder(getSubscribedPath()) || [];
    const trackRow = document.createElement('div');
    trackRow.className = 'path-track-row';
    const choices = [
      { id: 'all', label: 'All' },
      { id: 'syntax', label: 'Syntax' },
      { id: 'patterns', label: 'Patterns' },
      { id: 'applied', label: 'Applied' }
    ];
    const cur = state.starterPathTrack || 'all';
    trackRow.innerHTML = choices.map(c => {
      const count = c.id === 'all'
        ? pathBase.length
        : pathBase.filter(id => {
            const l = findLesson(id);
            return l && l.track === c.id;
          }).length;
      const active = cur === c.id ? ' active' : '';
      const disabled = count === 0 ? ' disabled' : '';
      return `<button class="path-track-chip${active}${disabled}" data-track="${c.id}" ${count === 0 ? 'disabled' : ''} title="${count} lessons in this track-path">${c.label} <span class="path-track-count">${count}</span></button>`;
    }).join('');
    trackRow.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-track]');
      if (!btn || btn.disabled) return;
      const newTrack = btn.dataset.track;
      if (newTrack === state.starterPathTrack) return;
      state.starterPathTrack = newTrack;
      _invalidateStarterPathCache();
      saveProgress();
      // iter 45: review badge depends on path scope — refresh after track change.
      updateReviewBadge();
      // If current lesson is no longer in the new track-path, jump to next un-mastered.
      if (!getActiveStarterPath().includes(state.currentLessonId)) {
        const next = starterPathNextId();
        if (next) { selectLesson(next); return; }
      }
      renderSidebar();
      if (state.currentLessonId) renderLesson();
    });
    nav.appendChild(trackRow);
  }

  // Which tracks render? On the PROBLEMS surface, patterns + applied MERGE into
  // one section-grouped list (the Type tag facet recovers the split); REFERENCE
  // is the single Syntax track. Search is global: if the active surface has zero
  // hits but the other does, flip surface so a query never feels "stuck". Tag
  // facets only scope the Problems surface.
  const _problemsTracks = () => _allTracks.filter(t => t.id === 'patterns' || t.id === 'applied');
  const _surfaceHits = (surf) => CURRICULUM.filter(l =>
    SURFACE_OF_TRACK[l.track] === surf && matches(l) && inStarter(l) && hideMasteredOk(l)
    && (surf === 'problems' ? tagMatch(l) : true)
  ).length;
  if (q && _surfaceHits(state.surface) === 0) {
    const other = state.surface === 'problems' ? 'reference' : 'problems';
    if (_surfaceHits(other) > 0) {
      state.surface = other;
      state.sidebarTrack = tracksForSurface(other)[0];
      saveProgress();
      renderBinderTabs(other === 'problems' ? [] : _allTracks.filter(t => t.id === 'syntax'));
    }
  }
  const tracksToRender = state.surface === 'problems'
    ? _problemsTracks()
    : _allTracks.filter(t => t.id === 'syntax');
  // Faceted tag filter panel — only over the merged Problems list. Inserted at
  // the top of the nav (above the lesson list / any Plan-View track row).
  if (state.surface === 'problems') renderTagFacets(nav);

  let visibleCount = 0;
  for (const track of tracksToRender) {
    let lessons = CURRICULUM.filter(l => l.track === track.id && matches(l)
      && (state.repairFilter ? _repairIdx.has(l.id) : (inStarter(l) && hideMasteredOk(l)))
      && (state.surface === 'problems' ? tagMatch(l) : true));
    if (!lessons.length) continue;

    // In path mode, sort by active-path index so the visible step numbers
    // read monotonically top-to-bottom. Sections then appear in the order
    // of their first path-step (because `[...new Set(...)]` preserves
    // first-occurrence order). Without this, HASH STRUCTURES could read
    // "22, 20, 21" because intra-section order tracks manifest order, not
    // path order. Non-path mode is unaffected.
    if (state.starterPath) {
      lessons = [...lessons].sort((a, b) =>
        activeStarter.indexOf(a.id) - activeStarter.indexOf(b.id));
    }

    const sections = [...new Set(lessons.map(l => l.section))];
    for (const section of sections) {
      const sectionLessons = lessons.filter(l => l.section === section);
      // iter 40: per-section mastery progress. Counts only full (non-stub)
      // lessons in this section that are currently visible (respects path-
      // mode + search + hide-mastered filters), so the bar reflects the
      // user's view rather than the global section size. See
      // ideas-by-category.md § Metacognition & Visibility → "Section-level
      // progress bar in sidebar".
      const fullCount = sectionLessons.filter(l => l.status === 'full').length;
      const masteredCount = sectionLessons.filter(l =>
        l.status === 'full' && lessonOverallStatus(l.id) === 'mastered'
      ).length;
      const pct = fullCount === 0 ? 0 : Math.round((masteredCount / fullCount) * 100);

      const secEl = document.createElement('div');
      secEl.className = 'section-header';
      if (fullCount > 0) {
        secEl.innerHTML = `
          <span class="section-title">${escapeHtml(section)}</span>
          <span class="section-progress" title="${masteredCount} of ${fullCount} mastered (${pct}%)">
            <span class="section-progress-bar"><span class="section-progress-fill" style="width:${pct}%"></span></span>
            <span class="section-progress-count">${masteredCount}/${fullCount}</span>
          </span>
        `;
      } else {
        secEl.textContent = section;
      }
      nav.appendChild(secEl);

      for (const lesson of sectionLessons) {
        visibleCount++;
        const link = document.createElement('div');
        const overall = lessonOverallStatus(lesson.id);
        link.className = 'lesson-link';
        // Test affordance — also makes future skills cleaner.
        link.setAttribute('data-lesson-id', lesson.id);
        if (lesson.status === 'stub') link.classList.add('stub');
        if (state.currentLessonId === lesson.id) link.classList.add('active');

        const dot = document.createElement('span');
        dot.className = 'dot';
        if (overall === 'mastered') {
          dot.classList.add('mastered');
          if (wasRevealed(lesson.id, 'L2') || wasRevealed(lesson.id, 'L3')) {
            dot.classList.add('revealed');
            dot.title = 'Mastered with a reveal — retry from scratch to clear';
          }
          if (isDueForReview(lesson.id)) {
            dot.classList.add('due');
            dot.title = `Due for review (${formatDueRelative(lesson.id)})`;
          }
        }
        if (overall === 'in_progress') dot.classList.add('in-progress');
        if (overall === 'stub')        dot.classList.add('stub');
        link.appendChild(dot);

        const label = document.createElement('span');
        label.className = 'lesson-label';
        if (state.starterPath) {
          const num = starterIndex(lesson.id);
          label.innerHTML = `<span class="text-slate-500 text-xs mr-1">${num}.</span>${escapeHtml(lesson.title)}`;
        } else {
          label.textContent = lesson.title;
        }
        link.appendChild(label);

        const _rep = _repairIdx.get(lesson.id);
        if (_rep) {
          const repIcon = document.createElement('span');
          repIcon.className = 'lesson-repair';
          repIcon.textContent = _rep.icon;
          repIcon.title = _rep.title;
          link.appendChild(repIcon);
        }

        if (lesson.status === 'full') {
          link.addEventListener('click', () => selectLesson(lesson.id));
        }
        nav.appendChild(link);
      }
    }
  }

  if (visibleCount === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-xs text-slate-500 px-3 py-6 text-center';
    if (state.searchQuery) {
      empty.textContent = 'No lessons match “' + state.searchQuery + '”.';
    } else if (state.surface === 'problems' && tagFilterActiveCount() > 0) {
      empty.innerHTML = 'No problems match the active tag filter. ' +
        '<button id="tag-empty-clear" class="text-blue-300 underline">Clear filter</button>';
      empty.querySelector('#tag-empty-clear').addEventListener('click', clearTagFilter);
    } else {
      empty.textContent = 'No lessons in this track yet.';
    }
    nav.appendChild(empty);
  }

  // progress summary
  const fullLessons = CURRICULUM.filter(l => l.status === 'full');
  const mastered = fullLessons.filter(l => lessonOverallStatus(l.id) === 'mastered').length;
  document.getElementById('progress-summary').textContent = `${mastered} / ${fullLessons.length} lessons mastered`;
  const pct = Math.round((mastered / fullLessons.length) * 100);
  document.getElementById('progress-pct').textContent = pct + '%';
  document.getElementById('progress-bar').style.width = pct + '%';
}

// ──────────────────────────────────────────────────────────────────────────
//  MAIN LESSON RENDER
// ──────────────────────────────────────────────────────────────────────────
// URL deep-linking. Hash format: #/<lesson-id>/<tab>
// Tab is optional; if absent, the lesson resolves to its default tab.
// `history.replaceState` is used to update the URL on selectLesson/selectTab
// so the URL stays shareable but doesn't pollute browser history with one
// entry per tap. `hashchange` (fired on back/forward and paste) re-routes
// via selectLesson + selectTab. See ideas-by-category.md § UI/UX Experience
// → "URL deep linking" entry.
const _VALID_TABS = new Set(['conversation', 'walkthrough', 'reference', 'L1', 'L2', 'L3']);

function _parseHash() {
  const raw = (window.location.hash || '').replace(/^#\/?/, '');
  if (!raw) return null;
  const parts = raw.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  // Mode route: #/m/<mode> — opens a launchable surface (Dashboard, Mock, a
  // drill, …) by clicking its hidden <mode>-btn. The `m/` namespace keeps a
  // mode slug from ever colliding with a lesson id.
  if (parts[0] === 'm') {
    const mode = parts[1] ? parts[1].replace(/[^a-z0-9-]/gi, '') : '';
    // Optional third segment = the mode's argument. Used by the scoped review
    // routes (#/m/review/trees, #/m/review/all — js/app/23-review.js); modes
    // that take no argument simply ignore it.
    let modeArg = null;
    if (parts[2]) {
      try { modeArg = decodeURIComponent(parts[2]).replace(/[^a-z0-9-]/gi, ''); } catch (_) { modeArg = null; }
    }
    return mode ? { mode, modeArg } : null;
  }
  let lessonId;
  try { lessonId = decodeURIComponent(parts[0]); } catch (_) { return null; }
  const tab = parts[1] && _VALID_TABS.has(parts[1]) ? parts[1] : null;
  return { lessonId, tab };
}

// Mode-route dispatch: resolve #<mode>-btn and click it. The topbar menu
// already wires every launchable surface to a hidden <id>-btn, and the route
// slug is that id minus the '-btn' suffix (mock-btn → mock). Fire-and-forget:
// opening the surface is enough; the URL normalizes back to the lesson on the
// next selectLesson/_updateHash. Returns true if a surface was opened.
//
// nav-audit P2-5: toggle-like slugs must NOT synth-click their button from a
// URL — a bookmarked / history-recalled `#/m/hide-mastered` silently flipped
// the setting on every visit, `#/m/install` threw (prompt() needs a user
// gesture), and `#/m/reset` presented a data-destruction confirm as the first
// paint. Those routes now open the surface that OWNS the toggle instead:
// Browse (with its filter panel open) for view filters, the ds Settings sheet
// (P6/D11) for everything else. The user lands where the control lives and
// flips it deliberately.
const MODE_ROUTE_SURFACE = {
  'hide-mastered': 'browse',
  'path': 'browse',
  'repair-filter': 'browse',
  'settings': 'settings',
  'clarify-ritual': 'settings',
  'hotseat': 'settings',
  'calibrate': 'settings',
  'pace-bar': 'settings',
  'haptic': 'settings',
  'adhd-mode': 'settings',
  'font-size': 'settings',
  'install': 'settings',
  'offline-pack': 'settings',
  'backup': 'settings',
  'restore': 'settings',
  'reset': 'settings'
};

function _dispatchModeRoute(mode, modeArg) {
  if (!mode) return false;
  // Scoped review (#/m/review/<scope-slug>) takes an argument rather than a
  // hidden button — the queue is built per scope at click time.
  if (mode === 'review' && modeArg) {
    if (typeof startScopedReview === 'function') { startScopedReview(modeArg); return true; }
    return false;
  }
  const surface = MODE_ROUTE_SURFACE[mode];
  if (surface === 'browse') {
    // Open Browse with the Filters disclosure expanded so the toggle the URL
    // named is on screen (tagFilterOpen is the panel's persisted state).
    state.tagFilterOpen = true;
    const browseBtn = document.getElementById('browse-btn');
    if (browseBtn) { browseBtn.click(); return true; }
    return false;
  }
  if (surface === 'settings') {
    // P6/D11: open the ds Settings sheet — the toggle the URL named lives here
    // now (not a silent flip, not the retired top-right dropdown).
    if (typeof openSettings === 'function') { openSettings(); return true; }
    const settingsBtn = document.getElementById('topbar-settings');
    if (settingsBtn) { settingsBtn.click(); return true; }
    return false;
  }
  const btn = document.getElementById(mode + '-btn');
  if (btn) { btn.click(); return true; }
  return false;
}

// audit F10: is the LESSON the surface currently owning #lesson-shell? Read
// from the rendered DOM rather than from a new piece of state, so the answer
// stays truthful no matter which surface swapped the shell (Home, Browse,
// Progress, a full-bleed drill, the dead-link page below). renderLesson marks
// its header with [data-lesson-root]; [data-lesson-loading] counts too — that
// placeholder IS the lesson, mid-fetch.
function _lessonIsRenderedSurface() {
  const shell = document.getElementById('lesson-shell');
  return !!(shell && shell.querySelector('[data-lesson-root], [data-lesson-loading]'));
}

// `push` = this was a NAVIGATION (a different place); everything else is view
// state on the place you are already at.
//
// docs/information-architecture.md §5 rule 3. Every write here used to be a
// replaceState, which is why the browser's own Back button could not retrace
// the hierarchy — the single affordance the phone-first user reaches for most.
// A measured walk went five levels into System Design and one Back left the
// site, because the whole excursion had collapsed into one history entry.
//
// A tab is deliberately NOT a navigation: it is one lesson seen six ways (the
// url-contract calls it view state and the static twin carries it as an
// anchor), so tapping through tabs must not bury the screen you came from
// under six entries you have to press Back through.
function _updateHash(push) {
  if (!state.currentLessonId) return;
  // audit F10: _updateHash used to write the current lesson's hash whenever
  // state.currentLessonId was set, regardless of what was actually on screen.
  // Booting #/m/browse showed Browse but the URL became #/<lesson>/reference
  // within ~300ms, so a reload landed on a lesson and copying the URL shared
  // the wrong thing — the cmd+click-a-mode-into-a-new-tab feature survived
  // exactly one paint. Only the lesson may write the lesson hash.
  if (!_lessonIsRenderedSurface()) return;
  // A boot mode route (#/m/<mode>) is dispatched at the very END of init(),
  // after this runs — the lesson is legitimately in the shell right now but is
  // about to be replaced, so writing here would clobber the route the user
  // asked for. try/catch: `_pendingBootMode` is a `let` in slice 14, which
  // evaluates after this slice (touching a TDZ binding throws).
  try { if (_pendingBootMode) return; } catch (_) {}
  let h = '#/' + encodeURIComponent(state.currentLessonId);
  if (state.currentTab && state.currentTab !== 'auto' && _VALID_TABS.has(state.currentTab)) {
    h += '/' + state.currentTab;
  }
  if (window.location.hash !== h) {
    try {
      if (push) history.pushState(null, '', h);
      else history.replaceState(null, '', h);
    } catch (_) { window.location.hash = h; }
  }
}

// audit F12: a hash naming a lesson id this build doesn't have used to resolve
// SILENTLY — the previously-rendered lesson stayed on screen while the URL kept
// the bad id, and booting on one fell back to lastLessonId and rewrote the URL.
// These links are handed to other people and to AI agents, so a dead one has to
// say so. The page deliberately carries no [data-lesson-root], which is what
// stops _updateHash (F10) from overwriting the bad id the user needs to see.
function renderLessonNotFound(badId) {
  const shell = document.getElementById('lesson-shell');
  if (!shell) return;
  shell.innerHTML = `
    <div class="ds-root ds-page lesson-404-page">
      <div class="ds-page__head">
        <h1 class="ds-title">That lesson doesn’t exist</h1>
        <p class="ds-page__sub">Nothing here answers to <span class="ds-code">${escapeHtml(badId || '')}</span>. The link may be mistyped, or the lesson may have been renamed since it was shared.</p>
      </div>
      <div class="ds-empty">
        <div class="ds-empty__icon">${dsIcon('search', 28)}</div>
        <p class="ds-empty__body">Every lesson has a stable id in its URL — browse the catalogue to find the one you meant.</p>
        <button class="ds-btn ds-btn--primary" data-action="lesson-404-browse">Browse lessons</button>
      </div>
    </div>`;
  shell.querySelector('[data-action="lesson-404-browse"]')?.addEventListener('click', () => {
    document.getElementById('browse-btn')?.click();
  });
}

// Paints the dead-link page when `route` (a _parseHash() result) names a lesson
// id that doesn't resolve to a full lesson. Returns true when it did, so both
// the hashchange path below and the boot path (js/app/14-init-core.js) can
// share one definition of "dead link".
function showLessonNotFoundIfDeadLink(route) {
  if (!route || !route.lessonId) return false;
  const lesson = findLesson(route.lessonId);
  if (lesson && lesson.status === 'full') return false;
  renderLessonNotFound(route.lessonId);
  return true;
}

// hashchange fires for back/forward navigation, pasted URLs, and manual
// hash edits — NOT for replaceState (which we use internally). So this
// listener handles only external URL changes; no infinite-loop risk.
function _handleHashChange() {
  const parsed = _parseHash();
  if (!parsed) return;
  if (parsed.mode) { _dispatchModeRoute(parsed.mode, parsed.modeArg); return; }
  if (showLessonNotFoundIfDeadLink(parsed)) return;   // audit F12
  // The question is "am I SHOWING this lesson?", not "is this a different
  // lesson?". They diverge whenever another surface owns the shell while
  // state.currentLessonId still names the resume target — which is the state
  // the app boots into: Home is rendered, currentLessonId is already the
  // CONTINUE lesson, so navigating to that lesson's hash matched the old
  // guard, skipped selectLesson, and left Home on screen under a URL claiming
  // otherwise. _lessonIsRenderedSurface() reads the DOM, so it cannot drift
  // (the same fix audit F10 applied to _updateHash for the same reason).
  if (state.currentLessonId !== parsed.lessonId || !_lessonIsRenderedSurface()) {
    selectLesson(parsed.lessonId);
  }
  if (parsed.tab && state.currentTab !== parsed.tab) {
    selectTab(parsed.tab);
  }
}

function selectLesson(id) {
  // If the user navigates away from a live mock interview, end it cleanly
  // (don't record best time — they bailed). Otherwise the tickHandle leaks
  // and bestTimes never settles.
  if (state.mock.active && state.mock.lessonId !== id) {
    endMockInterview(false);
  }
  // Drop in-flight per-tab cache for the lesson we're leaving — switching
  // lessons (vs. switching tabs within the same lesson) is when a fresh
  // start makes sense. See BS-12 + inProgressCache.
  if (state.currentLessonId && state.currentLessonId !== id) {
    _cacheClearLesson(state.currentLessonId);
    // iter 56: also drop the leaving lesson's reveal-this-attempt tracker so
    // the next visit starts a fresh attempt window for clean-pass detection.
    delete _revealedInCurrentAttempt[state.currentLessonId];
  }
  state.currentLessonId = id;
  // Sentinel — renderLesson resolves this to the first available tab once
  // content is loaded (Conversation if the lesson has one, otherwise
  // Reference). Keeps the default-tab decision in one place even though
  // content load is async.
  state.currentTab = 'auto';
  // Keep the binder tab in sync — the chosen lesson may belong to the
  // other track (shuffle / mock / review-button paths can pick freely).
  syncBinderToLesson(id);
  saveProgress();
  renderSidebar();
  renderLesson();
  _updateHash(true);
  if (window.matchMedia('(max-width: 767px)').matches) {
    document.body.classList.remove('sidebar-open');
  }
}
function selectTab(tab) {
  state.currentTab = tab;
  saveProgress();
  renderLesson();
  _updateHash();
}

// audit F1: is a scoped review session live ON this lesson? `_reviewSession` is
// a top-level `let` in js/app/23-review.js — these slices are classic scripts
// sharing one global lexical scope, so it reads directly here. try/catch guards
// the TDZ window: slice 23 evaluates AFTER this one, and touching a `let` before
// its declaration throws rather than yielding undefined.
function _reviewSessionOn(lessonId) {
  try {
    return !!(_reviewSession && _reviewSession.ids && _reviewSession.ids[_reviewSession.pos] === lessonId);
  } catch (_) {
    return false;
  }
}

function renderLesson() {
  const shell = document.getElementById('lesson-shell');
  shell.innerHTML = '';
  document.body.classList.remove('l2-mobile-active');
  if (!state.currentLessonId) {
    const subbed = typeof getSubscribedPath === 'function' ? getSubscribedPath() : null;
    if (subbed && subbed.kind === 'cram' && Array.isArray(subbed.days) && subbed.days.length) {
      renderCramHome(subbed);
      return;
    }
    if (subbed) { renderPlanHomeLessons(shell, subbed); return; }
    renderEmpty(shell);
    return;
  }

  const lesson = findLesson(state.currentLessonId);
  if (!lesson || lesson.status === 'stub') { renderEmpty(shell); return; }
  const content = CONTENT[lesson.id];
  if (!content) {
    // Cache miss — kick off fetch and re-render when it lands. Race-safe two
    // ways: if the user navigates to another lesson we drop the result, and
    // if another surface took over the shell meanwhile (a #/m/<mode> boot
    // dispatch rendering Today/Browse/Progress right after this placeholder)
    // the loading marker is gone and we leave that surface alone — without
    // this, the async re-render clobbered every shell-page deep link.
    shell.innerHTML = '<div class="text-slate-500 text-sm p-8 text-center" data-lesson-loading>Loading…</div>';
    loadLessonContent(lesson.id).then(() => {
      if (state.currentLessonId === lesson.id && shell.querySelector('[data-lesson-loading]')) renderLesson();
    }).catch(err => {
      if (!shell.querySelector('[data-lesson-loading]')) return;
      shell.innerHTML = '<div class="p-6 text-red-300 text-sm">Could not load lesson: ' + (err && err.message ? err.message : err) + '</div>';
    });
    return;
  }

  // First-time welcome — the path picker modal becomes the welcome surface
  // (auto-opened once, exposes Starter / Cram / Diagnostic / Browse-on-own).
  // The picker drives `state.welcomed` so the next renderLesson won't reopen it.
  //
  // audit F9: NOT when the visitor arrived on an explicit lesson deep link. A
  // shared `#/two-sum/L1` has to resolve to the drill — that is the whole point
  // of the share-URL work — and PROFILE.md is explicit that any decision placed
  // before the user can start drilling has to justify itself loudly. A
  // five-option plan chooser is the most expensive possible first screen. The
  // picker is still one tap away (Browse's filter panel / the plan chip), and
  // the Starter Plan is already the default, so nobody is left without a plan.
  //
  // Measured, so the next reader doesn't have to: this guard is a no-op for a
  // bare URL (the flag is false there, leaving the condition exactly as it
  // was). A bare URL doesn't raise the picker either, but that predates this
  // change — it followed from Home becoming the front door, which renders
  // instead of a lesson. Whether Home should carry its own first-run plan
  // prompt is a separate product question, not something this guard decided.
  if (!state.welcomed && Object.keys(state.progress).length === 0 && !_bootedOnLessonDeepLink) {
    setTimeout(() => { if (!state.welcomed) openPathModal({ welcome: true }); }, 0);
  }

  // audit F1 + F7: two session-scoped facts the whole header render keys off.
  //   · _inSession — a mock interview OR a scoped review session is live on
  //     THIS lesson. Both own the screen and both ship their own exits (the
  //     mock banner, the review HUD's Skip/✕).
  //   · _isDrillTab — the user is on a tapping/typing rung, so the prose
  //     header is context rather than the task.
  const _isMockHere = state.mock.active && state.mock.lessonId === lesson.id;
  const _isReviewHere = _reviewSessionOn(lesson.id);
  const _inSession = _isMockHere || _isReviewHere;
  const _isDrillTab = state.currentTab === 'L1' || state.currentTab === 'L2' || state.currentTab === 'L3';
  const _narrow = window.matchMedia('(max-width: 767px)').matches;

  // header
  const header = document.createElement('div');
  // [data-lesson-root] is the marker _updateHash() reads to decide whether the
  // lesson is the surface currently on screen (audit F10). Tighter bottom gap
  // on a phone drill tab — every pixel above the first option is a scroll (F7).
  header.setAttribute('data-lesson-root', lesson.id);
  header.className = (_isDrillTab && _narrow) ? 'lesson-head mb-3' : 'lesson-head mb-6';
  const trackPill = TRACK_PILLS[lesson.track] || TRACK_PILLS.patterns;
  const pill = trackPill.cls;
  const pillText = trackPill.label;
  const overall = lessonOverallStatus(lesson.id);
  const masteredPill = overall === 'mastered' ? `<span class="pill pill-mastered ml-2">✓ Mastered</span>` : '';
  // Starter-path step indicator — shown only when path mode is on AND this
  // lesson is part of the path. The sidebar shows step numbers per-lesson
  // but they group by section, so 22 / 20 / 21 can appear adjacent —
  // confusing. The header pill gives the user a stable "Step N of M"
  // anchor in the main viewport.
  const _activePath = state.starterPath ? getActiveStarterPath() : null;
  const pathIdx = _activePath ? _activePath.indexOf(lesson.id) + 1 : 0;
  const _trackLabel = state.starterPath && state.starterPathTrack && state.starterPathTrack !== 'all'
    ? ' (' + state.starterPathTrack[0].toUpperCase() + state.starterPathTrack.slice(1) + ')' : '';
  const _pathName = getSubscribedPath().label;
  const pathPill = pathIdx > 0
    ? `<span class="pill pill-path ml-2" title="${escapeHtml(_pathName)} step ${pathIdx} of ${_activePath.length}${_trackLabel}">🧭 Step ${pathIdx} of ${_activePath.length}${_trackLabel}</span>`
    : '';
  const nextId = nextLessonId(lesson.id);
  const nextLessonObj = nextId ? findLesson(nextId) : null;
  // On a mastered lesson, surface the highest-priority next action:
  //   - Due reviews exist → primary becomes "🕒 Review N due", which jumps
  //     to the most-overdue lesson via the same path as the sidebar Review
  //     button (device-calibrated tab routing). The "Next lesson" choice
  //     drops to secondary. Retention beats new content per dailyPlan.
  //   - No due reviews → keep the original "Next lesson" primary.
  // The sidebar Review CTA is invisible on mobile (behind the drawer);
  // this surface puts the same action in the main viewport.
  const dueDuringMastered = (overall === 'mastered') ? dueReviewIds() : [];
  let nextCta = '';
  if (overall === 'mastered' && dueDuringMastered.length > 0) {
    const reviewLabel = `${dsIcon('clock', 14)}Review ${dueDuringMastered.length} due →`;
    const secondary = nextLessonObj
      ? `<button class="secondary" data-action="goto-next">Next: ${escapeHtml(nextLessonObj.title)}</button>`
      : '';
    nextCta = `<div class="mt-3 flex items-center gap-2 flex-wrap" data-cta-row><button class="primary" data-action="goto-due-review">${reviewLabel}</button>${secondary}<button class="secondary" data-action="shuffle-here">${dsIcon('dice', 14)}Shuffle</button></div>`;
  } else if (overall === 'mastered' && nextLessonObj) {
    nextCta = `<div class="mt-3 flex items-center gap-2" data-cta-row><button class="primary" data-action="goto-next">Next lesson: ${escapeHtml(nextLessonObj.title)} →</button><button class="secondary" data-action="shuffle-here">${dsIcon('dice', 14)}Shuffle review</button></div>`;
  }
  // iter 22 (refine — iter 24 of the refine loop): suppress the abandonment
  // CTAs while a mock interview is active on THIS lesson. The next-lesson /
  // shuffle row is a "go elsewhere" affordance — contradictory above a timed
  // interview banner. Returns automatically once the mock ends.
  //
  // audit F1: a scoped review session gets the SAME suppression. The row's
  // three buttons all call selectLesson(), which is not the review advance
  // path — each one silently abandons the queue the HUD claims to be draining.
  // Worse, "🕒 Review N due" counted the GLOBAL due list and so contradicted
  // the HUD's own n/N ("Review 1 due" next to "1/1"). One session, one count.
  if (_inSession) nextCta = '';

  // audit F1: prev/next arrows go with it — mid-session they mutate
  // currentLessonId out from under the queue (the same broken affordance the
  // mock got fixed for in iter 29). Share STAYS: it copies this lesson plus the
  // user's results, which is a useful thing to do mid-review and navigates
  // nowhere. Mock keeps hiding the whole row, unchanged.
  const _navArrows = _isMockHere ? '' : `
      <!-- iter 29 (refine): prev/next arrows suppressed during active mock —
           clicking them mid-mock calls selectLesson() which silently breaks
           state (currentLessonId changes; banner stays; timer ticks against
           the wrong content). Same broken-affordance pattern as iters 24
           (next-CTA) and 27 (tab strip). j/k keyboard shortcuts unaffected. -->
      <div class="flex items-center gap-1 text-slate-500 text-xs">
        <button class="hover:text-slate-300 px-1" data-action="share-lesson" title="Share this lesson — a link carrying your results, for an AI to tutor you from">${dsIcon('share', 15)}</button>
        ${_isReviewHere ? '' : `<button class="hover:text-slate-300 px-1" data-action="prev-lesson" title="Previous (k)">◀</button>
        <button class="hover:text-slate-300 px-1" data-action="next-lesson" title="Next (j)">▶</button>`}
      </div>`;

  // audit F7 (+ F16): on a 390×844 phone the first tappable L1 option sat at
  // y≈800 of 844 — every lesson open cost a scroll before the primary
  // interaction, on the surface PROFILE.md says is used 80% of the time. On the
  // DRILL tabs the description and the PROBLEM card are context, not the task,
  // so they fold behind one 44px "Problem" disclosure. This generalises the
  // iter-26 precedent that already suppressed the PROBLEM card on L3 (whose own
  // body carries a PROMPT box — still don't print it twice). At ≥768px the
  // disclosure renders OPEN, so desktop hides nothing; on a phone it's one tap.
  const _descHtml = `<p class="lesson-desc text-slate-400 text-sm">${escapeHtml(content.description)}</p>`;
  const _promptHtml = (content.L3?.prompt && state.currentTab !== 'L3') ? `
      <div class="lesson-prompt p-3 rounded-md bg-slate-900/70 border border-slate-800">
        <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Problem</div>
        <div class="text-slate-200 text-sm leading-snug">${escapeHtml(content.L3.prompt)}</div>
      </div>` : '';
  // The disclosure has to name what's actually inside it. On L3 the PROBLEM
  // card is suppressed (iter-26: the L3 body carries its own PROMPT box), so a
  // row labelled "Problem" would open onto nothing but the one-line
  // description — an affordance that lies about its payload.
  const _briefLabel = _promptHtml ? 'Problem' : 'About this lesson';
  const _brief = _isDrillTab
    ? `<details class="lesson-brief"${_narrow ? '' : ' open'}>
      <summary class="lesson-brief__summary"><span>${_briefLabel}</span><span class="lesson-brief__chevron" aria-hidden="true">▾</span></summary>
      <div class="lesson-brief__body">${_descHtml}${_promptHtml}</div>
    </details>`
    : `<div class="lesson-brief-open">${_descHtml}${_promptHtml}</div>`;

  header.innerHTML = `
    <div class="flex items-center justify-between gap-3 mb-1">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="pill ${pill}">${pillText}</span>
        <span class="text-xs text-slate-500">${escapeHtml(lesson.section)}</span>
        <!-- iter 32 (refine): suppress journey-context metadata pills (✓ Mastered
             + 🧭 Step path) during an active mock — neither is actionable mid-
             attempt; sidebar status dots carry the same per-lesson mastery
             signal. Same broken-context-affordance pattern as iters 24/27/29. -->
        ${_isMockHere ? '' : `${masteredPill}${pathPill}`}
      </div>
      ${_navArrows}
    </div>
    <!-- audit F16: the lesson page rendered ZERO <h1> — the title was an <h2>,
         so the app's most-visited destination had no document heading at all.
         Promoted to <h1>; the visual size is unchanged (same class). -->
    <h1 id="lesson-title" class="text-2xl font-bold text-white">${escapeHtml(lesson.title)}</h1>
    ${_brief}
    ${_isMockHere ? '' : `<div data-sparkline-slot class="mt-1">${renderSparkline(lesson.id)}</div>`}
    ${nextCta}
  `;
  shell.appendChild(header);
  // iter 29 (refine): optional-chained because the prev/next arrow buttons
  // are suppressed during an active mock (see title-row template above).
  header.querySelector('[data-action="share-lesson"]')?.addEventListener('click', () => openShareSheet(lesson.id));
  header.querySelector('[data-action="prev-lesson"]')?.addEventListener('click', () => { const p = prevLessonId(lesson.id); if (p) selectLesson(p); });
  header.querySelector('[data-action="next-lesson"]')?.addEventListener('click', () => { const n = nextLessonId(lesson.id); if (n) selectLesson(n); });
  const nextBtn = header.querySelector('[data-action="goto-next"]');
  if (nextBtn) nextBtn.addEventListener('click', () => selectLesson(nextId));
  // "Review N due" — jump to the top due lesson via the same sidebar-button
  // click handler so device-calibrated tab routing (L2 on coarse, L3 on
  // fine) stays consistent across surfaces.
  const dueBtn = header.querySelector('[data-action="goto-due-review"]');
  if (dueBtn) dueBtn.addEventListener('click', () => {
    document.getElementById('review-btn')?.click();
  });
  const shuffleHere = header.querySelector('[data-action="shuffle-here"]');
  if (shuffleHere) shuffleHere.addEventListener('click', () => { const r = pickShuffleReview(); if (r) selectLesson(r); });

  // iter 27 (refine): tabs suppressed during an active mock — the surface is
  // L3-locked by the timer's framing; tabs LOOK like nav but actually break
  // mock state if used (state.currentTab changes, banner stays, editor
  // disappears). Returns automatically once the mock ends because
  // endMockInterview's renderLesson() call re-fires this whole render.
  if (!_isMockHere) {
  // tabs
  // audit F22: the strip is wrapped so the edge-fade overlays have something to
  // anchor to. They live on the WRAPPER, not the scroller, so they stay put
  // while the tabs move under them (and they're pointer-events:none — an
  // affordance must never eat a tap). The bottom margin moves to the wrapper
  // too, so a child margin can't collapse out from under the fades.
  const tabsWrap = document.createElement('div');
  tabsWrap.className = 'lesson-tabs-wrap ' + ((_isDrillTab && _narrow) ? 'mb-3' : 'mb-6');
  const tabs = document.createElement('div');
  // overflow-x-auto so the 6-tab row (Conversation + Walkthrough + Ref + L1 +
  // L2 + L3) stays reachable on a phone — last tab scrolls into view instead
  // of getting cropped behind the viewport edge.
  tabs.className = 'flex border-b border-slate-800 overflow-x-auto lesson-tabs';
  const tabDefs = [];
  // Conversation tab is opt-in per lesson — only Patterns/Applied lessons that
  // ship an `conversation` block (the interview walk-through) get it. Sits
  // first so the user starts in "how would I diagnose this" mode before
  // looking at the canonical solution.
  if (content.conversation) {
    tabDefs.push({ id: 'conversation', label: 'Conversation', status: null });
  }
  // Walkthrough — interactive line-by-line stepper (Jupyter-style). Sits
  // between Conversation and Reference: you diagnose (Conversation), then
  // watch the canonical execute (Walkthrough), then study the polished form
  // (Reference), then drill (L1/L2/L3).
  if (content.walkthrough) {
    tabDefs.push({ id: 'walkthrough', label: 'Walkthrough', status: null });
  }
  tabDefs.push(
    { id: 'reference', label: 'Reference',     status: null },
    { id: 'L1',        label: 'L1 — Concept',  status: levelStatus(lesson.id, 'L1') },
    { id: 'L2',        label: 'L2 — Fill-in',  status: levelStatus(lesson.id, 'L2') },
    { id: 'L3',        label: 'L3 — Drill',    status: levelStatus(lesson.id, 'L3') }
  );
  // If the current tab isn't one this lesson exposes (e.g. came from a lesson
  // that had Conversation, landed on one that doesn't), fall back to the
  // first available tab so we don't render a blank body.
  if (!tabDefs.some(t => t.id === state.currentTab)) {
    state.currentTab = tabDefs[0].id;
    // Reflect the resolved tab in the URL so the hash stays accurate even
    // when selectLesson set state.currentTab = 'auto'.
    _updateHash();
  }
  for (let i = 0; i < tabDefs.length; i++) {
    const t = tabDefs[i];
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.dataset.level = t.id;
    if (state.currentTab === t.id) btn.classList.add('active');
    // Prefix with "N. " so the keyboard shortcut (number key = Nth tab) is
    // discoverable without opening the help modal. audit F23: .tab-num is
    // hidden on coarse-pointer / narrow viewports — there it advertised a
    // shortcut that doesn't exist and ate width where six tabs already
    // overflow. It stays wherever a real keyboard does.
    const num = `<span class="tab-num text-slate-500 mr-1">${i + 1}.</span>`;
    // L1 can pass orange (≥80%/miss-one but not 100%) — render an amber ✓ vs
    // the emerald ✓ for a clean pass, so the remaining gap stays visible.
    let check = '';
    if (t.status === 'passed') {
      const partial = t.id === 'L1' && isPartialL1(lesson.id);
      check = ` <span class="${partial ? 'text-amber-400' : 'text-emerald-400'} ml-1">✓</span>`;
    }
    btn.innerHTML = `${num}${t.label}${check}`;
    btn.addEventListener('click', () => selectTab(t.id));
    tabs.appendChild(btn);
  }
  tabsWrap.appendChild(tabs);
  shell.appendChild(tabsWrap);

  // audit F22: paint the edge fade only on the side that actually has more
  // strip to reveal, so it reads as "there's more that way" rather than as
  // permanent decoration. Auto-centring the active tab used to leave
  // Conversation and Walkthrough off-screen with nothing saying they existed.
  const _syncTabFades = () => {
    const max = tabs.scrollWidth - tabs.clientWidth;
    tabsWrap.classList.toggle('has-left', tabs.scrollLeft > 2);
    tabsWrap.classList.toggle('has-right', tabs.scrollLeft < max - 2);
  };
  tabs.addEventListener('scroll', _syncTabFades, { passive: true });

  // Auto-center the active tab inside the strip on mobile where 6 tabs
  // (Conv/Walk/Ref/L1/L2/L3) overflow the 390px viewport — without this,
  // landing on a tab past tab #2 leaves the active marker off-screen
  // (PROFILE.md line 27, 80% phone). Desktop is a no-op since the strip
  // doesn't scroll there. requestAnimationFrame ensures layout is settled
  // before measuring.
  requestAnimationFrame(() => {
    const activeBtn = tabs.querySelector('.tab-btn.active');
    if (activeBtn && tabs.scrollWidth > tabs.clientWidth) {
      const targetLeft = activeBtn.offsetLeft - (tabs.clientWidth - activeBtn.offsetWidth) / 2;
      tabs.scrollLeft = Math.max(0, Math.min(targetLeft, tabs.scrollWidth - tabs.clientWidth));
    }
    _syncTabFades();
  });
  } // end if (!_isMockHere) — tabs suppressed during mock

  // body
  const body = document.createElement('div');
  body.className = 'fade-in';
  shell.appendChild(body);

  if (state.currentTab === 'conversation') renderConversation(body, content);
  if (state.currentTab === 'walkthrough') renderWalkthrough(body, lesson, content);
  if (state.currentTab === 'reference') renderReference(body, content);
  if (state.currentTab === 'L1') renderL1(body, lesson, content);
  if (state.currentTab === 'L2') renderL2(body, lesson, content);
  if (state.currentTab === 'L3') renderL3(body, lesson, content);
}

function renderHeader() {
  // Re-render only the header section to update the mastered pill, not the whole shell.
  if (state.currentLessonId) renderLesson();
}

function renderEmpty(shell) {
  shell.innerHTML = `
    <div class="text-center py-24 text-slate-400">
      <h2 class="text-2xl font-bold text-white mb-2">Welcome to JS Drill</h2>
      <p class="max-w-md mx-auto text-sm leading-relaxed">
        Pick a lesson on the left. Read the <strong>Reference</strong>, then test recall with
        <span class="text-blue-300">L1 Concept</span>,
        <span class="text-blue-300">L2 Fill-in</span>, and
        <span class="text-blue-300">L3 Drill</span>. Greyed-out lessons are stubbed for v1.
      </p>
      <p class="text-xs text-slate-500 mt-6">Tip: press <kbd>⌘</kbd>+<kbd>↵</kbd> inside the L3 editor to run.</p>
    </div>`;
}

// ──────────────────────────────────────────────────────────────────────────
