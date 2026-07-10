// ── 19: Browse — first-class lesson browser (design-loop P4, part 1) ───────
// The bottom nav's "Browse" destination: search + track segments + section
// accordion (mastery per section) + tappable lesson rows, rendered into
// #lesson-shell from ds/ components. Replaces the cramped drawer as the
// primary "find a lesson" surface (JOURNEYS J5: ≤2 taps to any lesson).
//
// The legacy drawer keeps its power tools (Plan View, Hide Mastered, Repair,
// faceted tag filter) — reachable via the page's "All filters" row until P4
// part 2 migrates them here properly. Deep link: #/m/browse.
//
// Status dots: ds-status colors (good = mastered · warn = in progress ·
// hollow = untouched). Due lessons carry an amber "due" chip; weak a red one.

const _BROWSE_TRACKS = [
  { key: 'syntax', label: 'Syntax' },
  { key: 'patterns', label: 'Patterns' },
  { key: 'applied', label: 'Applied' },
];

function openBrowse() {
  const shell = document.getElementById('lesson-shell');
  if (!shell) return;
  const track = _BROWSE_TRACKS.some(t => t.key === state.sidebarTrack) ? state.sidebarTrack : 'patterns';
  _renderBrowse(shell, { track, q: '' });
}

function _renderBrowse(shell, view) {
  const due = new Set(dueReviewIds());
  const q = view.q.trim().toLowerCase();
  // Searching spans ALL tracks (the drawer behaves the same way) — a rusty
  // user hunting "two sum" shouldn't have to know which track owns it.
  const pool = CURRICULUM.filter(l => l.status === 'full')
    .filter(l => q ? l.title.toLowerCase().includes(q) : l.track === view.track);

  // Group into ordered sections (manifest order is preserved in CURRICULUM).
  const sections = [];
  const byName = new Map();
  for (const l of pool) {
    let s = byName.get(l.section);
    if (!s) { s = { name: l.section, lessons: [] }; byName.set(l.section, s); sections.push(s); }
    s.lessons.push(l);
  }

  const currentSection = findLesson(state.currentLessonId)?.section;

  const rowHtml = (l) => {
    const st = lessonOverallStatus(l.id);
    const dot = st === 'mastered'
      ? `<span style="width:10px;height:10px;border-radius:50%;background:var(--ds-good);flex:none;"></span>`
      : st === 'in_progress'
        ? `<span style="width:10px;height:10px;border-radius:50%;background:var(--ds-warn);flex:none;"></span>`
        : `<span style="width:10px;height:10px;border-radius:50%;border:1.5px solid var(--ds-line-strong);flex:none;"></span>`;
    const flags = [
      due.has(l.id) ? `<span class="ds-chip ds-chip--accent" style="padding:1px 8px;">due</span>` : '',
      state.weakness?.[l.id] ? `<span class="ds-chip ds-chip--bad" style="padding:1px 8px;">weak</span>` : '',
    ].join('');
    return `
      <button class="ds-row" data-browse-lesson="${escapeHtml(l.id)}" style="width:100%; text-align:left; background:none; border:0; cursor:pointer; min-height: var(--ds-tap); gap: var(--ds-s3);">
        ${dot}
        <div class="ds-row__main"><b style="font-weight: var(--ds-fw-med); color: var(--ds-text);">${escapeHtml(l.title)}</b></div>
        ${flags}
        <span class="ds-row__chev">›</span>
      </button>`;
  };

  const sectionsHtml = sections.map(s => {
    const done = s.lessons.filter(l => lessonOverallStatus(l.id) === 'mastered').length;
    const open = q ? ' open' : (s.name === currentSection ? ' open' : '');
    return `
      <details class="browse-section"${open} style="background: var(--ds-surface); border: 1px solid var(--ds-line); border-radius: var(--ds-r-md); overflow: hidden;">
        <summary style="list-style:none; cursor:pointer; display:flex; align-items:center; gap: var(--ds-s3); padding: var(--ds-s3) var(--ds-s4); min-height: var(--ds-tap);">
          <b style="flex:1; font-size: var(--ds-fs-base); font-weight: var(--ds-fw-semi); color: var(--ds-text-strong);">${escapeHtml(s.name)}</b>
          <span class="ds-num ds-mute" style="font-size: var(--ds-fs-xs);">${done}/${s.lessons.length}</span>
          <span class="ds-progress" style="width: 44px;"><i style="width:${s.lessons.length ? Math.round(100 * done / s.lessons.length) : 0}%"></i></span>
        </summary>
        <div style="padding: 0 var(--ds-s4) var(--ds-s2); border-top: 1px solid var(--ds-line);">
          ${s.lessons.map(rowHtml).join('')}
        </div>
      </details>`;
  }).join('');

  const segsHtml = _BROWSE_TRACKS.map(t => `
    <button class="ds-btn${t.key === view.track && !q ? ' ds-btn--primary' : ' ds-btn--subtle'}" data-browse-track="${t.key}" style="flex:1; min-height: 40px; font-size: var(--ds-fs-sm);">${t.label}</button>`).join('');

  shell.innerHTML = `
    <div class="ds-root browse-page" style="max-width: 560px; margin: 0 auto; background: transparent;">
      <h1 class="ds-title" style="margin: 0 0 var(--ds-s4);">Browse</h1>
      <input class="ds-field" data-browse-search type="search" placeholder="Search lessons…" value="${escapeHtml(view.q)}" autocomplete="off" spellcheck="false" style="margin-bottom: var(--ds-s3);" />
      <div style="display:flex; gap: var(--ds-s2); margin-bottom: var(--ds-s4);">${segsHtml}</div>
      <div style="display:flex; flex-direction:column; gap: var(--ds-s2);">
        ${sectionsHtml || `<div class="ds-card" style="text-align:center;"><p class="ds-dim" style="margin:0;">No lessons match “${escapeHtml(view.q)}”.</p></div>`}
      </div>
      <button class="ds-btn ds-btn--ghost ds-btn--block" data-browse-more style="margin-top: var(--ds-s4);">All filters &amp; plan view…</button>
    </div>`;

  // Wiring. Search re-renders on input (debounced a touch) preserving focus.
  const search = shell.querySelector('[data-browse-search]');
  let deb = null;
  search.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(() => {
      const pos = search.selectionStart;
      _renderBrowse(shell, { ...view, q: search.value });
      const s2 = shell.querySelector('[data-browse-search]');
      s2.focus({ preventScroll: true });
      try { s2.setSelectionRange(pos, pos); } catch (_) {}
    }, 140);
  });
  shell.querySelectorAll('[data-browse-track]').forEach(b => b.addEventListener('click', () => {
    state.sidebarTrack = b.dataset.browseTrack;
    // Keep the Problems⇄Reference surface consistent — renderSidebar reverts
    // any surface-inconsistent track, which silently discarded a Syntax pick
    // the next time the drawer rendered (contrarian, iter 7).
    if (typeof SURFACE_OF_TRACK !== 'undefined' && SURFACE_OF_TRACK[state.sidebarTrack]) {
      state.surface = SURFACE_OF_TRACK[state.sidebarTrack];
    }
    saveProgress();
    _renderBrowse(shell, { track: b.dataset.browseTrack, q: '' });
  }));
  shell.querySelectorAll('[data-browse-lesson]').forEach(b => b.addEventListener('click', () => {
    selectLesson(b.dataset.browseLesson);
  }));
  shell.querySelector('[data-browse-more]').addEventListener('click', () => {
    // The drawer still owns Plan View / Hide Mastered / Repair / tag facets
    // until P4 part 2 — one tap deeper, nothing lost.
    const ham = document.getElementById('hamburger');
    if (ham) ham.click();
  });

  const main = document.querySelector('.app-main');
  if (main) main.scrollTop = 0;
}

(() => {
  const btn = document.getElementById('browse-btn');
  if (btn) btn.addEventListener('click', openBrowse);
})();
