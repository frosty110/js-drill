// ── 16: the main app's shell adapter (D15 phase 2) ──────────────────────────
// ds/shell.js renders the chrome — the three-destination nav and the header
// (breadcrumb · scoped progress · what's due) — for BOTH pages, from the route
// registry. This file is everything about that chrome that is specific to
// index.html, and nothing else:
//
//   capabilities  what "Search" / "Settings" / "open Progress" DO here
//   scope         how many reps are done in the scope the user is looking at
//   due           how many are due right now
//   crumb         how to turn a lesson id into a lesson title
//
// It replaced js/app/16-ds-nav.js, which was the same chrome written *at* this
// page: every nav item was a DOM id it synthetically clicked, so the nav could
// not be mounted anywhere else — which is exactly why System Design had no
// rail and no header. Nothing below reaches into the shell; the shell asks,
// this file answers. (It also absorbed js/app/25-breadcrumb.js: one adapter
// per page beats two files answering questions for the same component.)

(() => {
  // ── Capabilities ─────────────────────────────────────────────────────────
  // Deliberately late-bound: these fire on user intent, long after boot, so
  // they can name functions defined in later slices.
  const actions = {
    search: () => (typeof _paletteOpen === 'function' ? _paletteOpen() : null),
    settings: () => (typeof openSettings === 'function' ? openSettings() : null),
    progress: () => (typeof openProgress === 'function' ? openProgress() : null)
  };

  // ── Scoped progress ──────────────────────────────────────────────────────
  // The contract (docs/information-architecture.md §3 rule 2): the number is
  // about the scope named in the breadcrumb beside it. So each surface answers
  // for ITS OWN altitude — one lesson reports its three levels, a section
  // reports its lessons, the root reports the corpus — and the meter re-scopes
  // as the user moves without anything here tracking "where they are".
  const ALL = { kind: 'area', key: 'all' };

  function scope(kind, params) {
    if (typeof CURRICULUM === 'undefined' || !CURRICULUM.length) return null;

    if (kind === 'lesson') {
      const p = (state.progress || {})[params.id] || {};
      return { done: ['L1', 'L2', 'L3'].filter(l => p[l] === 'passed').length, total: 3 };
    }

    if (kind === 'appMode') {
      // A scoped review session (#/m/review/trees) is ABOUT that scope, so the
      // meter follows it there rather than falling back to the corpus.
      const [head, ...rest] = String(params.mode || '').split('/');
      if (head === 'review' && rest.length && rest[0] !== 'all') {
        const sc = typeof homeScopeFromSlug === 'function' ? homeScopeFromSlug(rest[0]) : null;
        if (sc) return statsFor(sc);
      }
      return statsFor(ALL);
    }

    // lessonIndex (Library) and anything else that lives under it: the corpus.
    return statsFor(ALL);
  }

  function statsFor(sc) {
    if (typeof homeScopeStats !== 'function') return null;
    const st = homeScopeStats(sc);
    return st && st.total ? { done: st.mastered, total: st.total } : null;
  }

  function due() {
    return typeof dueReviewIds === 'function' ? dueReviewIds().length : null;
  }

  // ── Breadcrumb resolvers ─────────────────────────────────────────────────
  // Modes whose crumb should read as the destination, not the slug. Only the
  // ones a user can be LOOKING at need an entry; the fallback title-cases the
  // slug, so a new mode is legible without being registered here.
  const MODE_LABELS = {
    home: 'Home', dashboard: 'Progress', progress: 'Progress',
    today: "Today's plan", 'today-home': "Today's plan",
    'practice-launcher': 'Practice', practice: 'Practice',
    mock: 'Mock interview', diagnostic: 'Diagnostic', settings: 'Settings',
    'at-risk': 'At risk', resurrect: 'Resurrect queue', 'streak-map': 'Streak map',
    mechanics: 'Mechanics', cheatsheet: 'Cheatsheet', 'system-design': 'System Design'
  };

  const titleCase = s => String(s || '').split('-').filter(Boolean)
    .map((w, i) => (i ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

  // `#/m/review/<scope>` arrives as one mode string because appMode's
  // appParams joins the tail. Split it back so the crumb names the scope the
  // session is over — "Review · Trees" beats "Review/trees".
  function modeLabel(mode) {
    const [head, ...rest] = String(mode || '').split('/');
    const base = MODE_LABELS[head] || titleCase(head);
    if (!rest.length) return base;
    const s = rest.join('/');
    return `${base} · ${s === 'all' ? 'Everything' : titleCase(s)}`;
  }

  function crumbTitle(kind, params) {
    if (kind === 'lesson') {
      // CURRICULUM is empty until the manifest lands; null falls back to the
      // registry's crumbLabel (the id) and the shell repaints when it arrives.
      const l = typeof findLesson === 'function' ? findLesson(params.id) : null;
      return l ? l.title : null;
    }
    if (kind === 'appMode') return modeLabel(params.mode);
    return null;
  }

  // A lesson sits in a section, and a section is real hierarchy — but it has no
  // route, so routes.js cannot model it (§5). Spliced in unlinked. When
  // sections become addressable this hook disappears and the crumb gains a
  // link, with no change to the shell or the renderer.
  function crumbExtra(kind, params) {
    if (kind !== 'lesson') return [];
    const l = typeof findLesson === 'function' ? findLesson(params.id) : null;
    return l && l.section ? [{ label: l.section }] : [];
  }

  // The root shows no crumb: "Home" alone is noise, and the header's left edge
  // is the most contested space on a 390px screen.
  function crumbHidden(kind, params) {
    return kind === 'appMode' && (params.mode === 'home' || params.mode === 'today-home');
  }

  function start() {
    if (!window.DrillShell) return;
    DrillShell.mount({
      page: 'index.html',
      actions, scope, due,
      crumb: { title: crumbTitle, extra: crumbExtra, hidden: crumbHidden }
    });

    // Two things move the user without touching the hash: a surface swap
    // (Browse → Progress both go through #lesson-shell), and a lesson painted
    // before the manifest resolved, whose crumb therefore held an id. Both are
    // the same childList mutation, so one observer keeps the whole header
    // truthful rather than sprinkling refresh() calls through 26 slices.
    const shell = document.getElementById('lesson-shell');
    if (shell) new MutationObserver(() => DrillShell.refresh()).observe(shell, { childList: true });

    // Passing a level changes the meter under the user's cursor; storage is the
    // one signal every write path already goes through (js/storage.js).
    window.addEventListener('drill:storage-written', () => DrillShell.refresh());

    // This page's overlays predate ds/ and are plain `.modal` elements toggled
    // by inline display, so the shell cannot know about them — it announces the
    // navigation and we close our own (docs/information-architecture.md §5
    // rule 4). Without this, a sheet opened over Browse was still on top after
    // navigating to Progress.
    window.addEventListener('drill:navigated', () => {
      document.querySelectorAll('.modal').forEach(m => {
        if (m.style.display && m.style.display !== 'none') m.style.display = 'none';
      });
    });
  }

  // Topbar chrome: swap the emoji glyphs for the ds stroke icon set (D07).
  function upgradeTopbarIcons() {
    if (typeof dsIcon !== 'function') return;
    for (const [sel, name, size] of [
      ['#palette-trigger', 'search', 19],
      ['#topbar-help', 'help', 19],
      ['#topbar-settings', 'sliders', 19]
    ]) {
      const el = document.querySelector(sel);
      if (el) el.innerHTML = dsIcon(name, size);
    }
  }

  start();
  upgradeTopbarIcons();
})();
