// ── 25: breadcrumb wiring (D15 phase 1) ─────────────────────────────────────
// js/breadcrumb.js paints the trail; js/routes.js derives its shape from each
// row's `parent`. Neither knows what a lesson is called. This slice is the
// adapter: it hands the renderer this page's display titles, splices in the
// one level of real hierarchy that has no address yet (a lesson's section),
// and says when there is nothing to show.
//
// Everything here is a lookup. If you find yourself adding structure, it
// belongs in routes.js as a `parent` — see docs/information-architecture.md §5.

(() => {
  // Modes whose crumb should read as the destination, not the slug. Only the
  // ones a user can actually be LOOKING at need an entry; the fallback
  // title-cases the slug, so a new mode is legible without being registered.
  //
  // Not a second nav registry: these are labels, and the nav's own list is
  // still js/app/16-ds-nav.js. `browse` is absent on purpose — it parses as
  // the lessonIndex surface, which carries its own crumbLabel.
  const MODE_LABELS = {
    home: 'Home',
    dashboard: 'Progress',
    progress: 'Progress',
    today: "Today's plan",
    'today-home': "Today's plan",
    'practice-launcher': 'Practice',
    practice: 'Practice',
    mock: 'Mock interview',
    diagnostic: 'Diagnostic',
    settings: 'Settings',
    'at-risk': 'At risk',
    resurrect: 'Resurrect queue',
    'streak-map': 'Streak map',
    mechanics: 'Mechanics',
    cheatsheet: 'Cheatsheet',
    'system-design': 'System Design'
  };

  const titleCase = s => String(s || '')
    .split('-').filter(Boolean)
    .map((w, i) => (i ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

  // `#/m/review/<scope>` arrives as one mode string ('review/trees') because
  // appMode's appParams joins the tail. Split it back so the crumb names the
  // scope the session is actually over — "Review · Trees" beats "Review/trees".
  function modeLabel(mode) {
    const [head, ...rest] = String(mode || '').split('/');
    const base = MODE_LABELS[head] || titleCase(head);
    if (!rest.length) return base;
    const scope = rest.join('/');
    return `${base} · ${scope === 'all' ? 'Everything' : titleCase(scope)}`;
  }

  function title(kind, params) {
    if (kind === 'lesson') {
      // CURRICULUM is empty until the manifest lands; returning null falls back
      // to the row's crumbLabel (the id), and boot's first render() fixes it.
      const l = typeof findLesson === 'function' ? findLesson(params.id) : null;
      return l ? l.title : null;
    }
    if (kind === 'appMode') return modeLabel(params.mode);
    return null;
  }

  // A lesson sits in a section, and a section is real hierarchy — but it has no
  // route, so routes.js cannot model it (§5). Splice it in unlinked. When
  // sections become addressable this whole hook disappears and the crumb gets
  // the level back as a link, with no change here or in the renderer.
  function extra(kind, params) {
    if (kind !== 'lesson') return [];
    const l = typeof findLesson === 'function' ? findLesson(params.id) : null;
    return l && l.section ? [{ label: l.section }] : [];
  }

  // The root shows no crumb: "Home" alone is noise, and the header's left edge
  // is the most contested space on a 390px screen.
  function hidden(kind, params) {
    return kind === 'appMode' && (params.mode === 'home' || params.mode === 'today-home');
  }

  function start() {
    const mount = document.getElementById('ds-crumbs');
    if (!mount || !window.DrillBreadcrumb) return;
    DrillBreadcrumb.mount({ page: 'index.html', mount, title, extra, hidden });

    // Two things move the user without touching the hash: a surface swap
    // (Browse → Progress both go through #lesson-shell), and a lesson painted
    // before the manifest resolved, whose crumb therefore held an id instead of
    // a title. Both are the same childList mutation the nav already observes
    // for aria-current, so observe it here too rather than sprinkling
    // refresh() calls through 26 slices.
    const shell = document.getElementById('lesson-shell');
    if (shell) new MutationObserver(() => DrillBreadcrumb.refresh()).observe(shell, { childList: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
