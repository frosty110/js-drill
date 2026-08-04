// ============================================================================
//  ds/shell.js — the app shell (D15 phase 2)
// ============================================================================
// ONE chrome, mounted by every page: the primary nav, the header (breadcrumb +
// scoped progress + what's due), and nothing else. Both index.html and
// system-design.html call mount(); neither owns a private copy.
//
// The rule this file exists to hold:
//
//     A component that reaches for an element it does not create is not a
//     component. It is a script with an undeclared dependency on one page.
//
// The nav used to break that rule in the most literal way — every item was a
// DOM id it clicked (`target: 'browse-btn'`), and six of the seven ids exist
// only on index.html. The seventh, `home-btn`, exists on BOTH pages meaning
// two different things, so copy-pasting the rail onto system-design.html would
// not have failed loudly; "Home" would have quietly gone to the topics list.
// That is why System Design lost the rail and the header the moment you
// arrived: there was nothing reusable to arrive with.
//
// So: a destination declares a ROUTE (js/routes.js), never an id. The active
// highlight derives from the `parent` chain, not from sniffing page classes.
// Anything genuinely page-local — opening the command palette, opening
// Settings, opening Progress — is a CAPABILITY the page passes in. The shell
// asks; the page answers; an unanswered capability simply isn't rendered.
// Nothing here can reach into a page it wasn't given.
//
//   DrillShell.mount({
//     page: 'index.html',
//     actions: { search, settings, progress },   // optional, page-local
//     scope:   (kind, params) => ({ done, total }) | null,  // header meter
//     due:     () => number | null,                          // global chip
//     crumb:   { title, extra, hidden },                     // js/breadcrumb.js
//   });
//   DrillShell.refresh();   // after any state change the header should reflect
//
// Depends on: js/routes.js, js/breadcrumb.js, ds/icons.js. Load after all three.
// Styles: ds/components.css (.ds-appnav/.ds-navitem) + css/15-ds-shell.css.
// ============================================================================

(function (root) {
  'use strict';

  // ── The primary nav — closed at three destinations (D15 §4) ───────────────
  // A new mode is a launcher entry, never a rung. Each declares the route it
  // goes to; the href, the cross-page link and the active state all follow.
  const DESTINATIONS = [
    { key: 'home', label: 'Home', icon: 'home',
      title: 'Home — continue any track, review what’s due',
      route: { kind: 'appMode', params: { mode: 'home' } } },
    { key: 'library', label: 'Library', icon: 'grid',
      title: 'Library — every lesson, by track and section',
      route: { kind: 'lessonIndex', params: {} } },
    { key: 'design', label: 'Design', icon: 'sysdesign',
      title: 'System Design — DDIA, building blocks, design problems',
      route: { kind: 'sdIndex', params: {} } }
  ];

  // Rail-only, and only where the page can actually service them.
  const AUX = [
    { key: 'search', label: 'Search', icon: 'search', hint: '⌘K',
      title: 'Command palette · ⌘K', action: 'search' },
    { key: 'settings', label: 'Settings', icon: 'sliders',
      title: 'Settings — toggles, data, reset', action: 'settings' }
  ];

  const CFG = { page: null, actions: {}, scope: null, due: null, crumb: null };

  const R = () => root.DrillRoutes;
  const icon = (name, px) => (typeof root.dsIcon === 'function' ? root.dsIcon(name, px) : '');
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── Where am I? ───────────────────────────────────────────────────────────
  // The current surface, from the hash, via the registry. Null means "this page
  // is at its own root", which every page renders as its first destination.
  function here() {
    if (!R()) return null;
    return R().parseAppHash(root.location.hash, CFG.page);
  }

  // Which destination owns the current surface. Derived from the `parent`
  // chain: a surface's TOP-LEVEL ancestor is the destination that contains it,
  // so a lesson lights up Library and a system-design unit lights up Design —
  // on either page, with no page-class sniffing and no per-surface wiring.
  // This is the whole payoff of D15 phase 1.
  function currentKey() {
    const hit = here();
    if (!hit) return CFG.page === 'system-design.html' ? 'design' : 'home';
    let rootKind;
    try { rootKind = R().ancestors(hit.kind)[0] || hit.kind; } catch (_) { return null; }
    // appMode is one row standing in for ~40 modes; they are all launched from
    // Home and return there, so Home stays lit while one is open.
    if (rootKind === 'appMode') return 'home';
    const d = DESTINATIONS.find(x => x.route.kind === rootKind);
    return d ? d.key : null;
  }

  function href(dest) {
    try { return R().hrefFrom(dest.route.kind, dest.route.params, CFG.page); }
    catch (_) { return null; }
  }

  // ── The nav ───────────────────────────────────────────────────────────────
  function navItem(d, extraClass) {
    const cls = 'ds-navitem' + (extraClass ? ' ' + extraClass : '');
    const body = `${icon(d.icon, 22)}${esc(d.label)}` +
      (d.hint ? `<span class="ds-navitem__hint" aria-hidden="true">${esc(d.hint)}</span>` : '');
    const title = d.title ? ` title="${esc(d.title)}"` : '';
    // Destinations are links: cmd+click, middle-click and "open in new tab"
    // are navigation affordances users expect from a nav, and a <button> has
    // none of them. Capabilities are buttons — they open something here.
    if (d.route) {
      const h = href(d);
      return h ? `<a class="${cls}" data-nav="${d.key}" href="${esc(h)}"${title}>${body}</a>` : '';
    }
    return `<button type="button" class="${cls}" data-nav="${d.key}" data-action="${d.action}"${title}>${body}</button>`;
  }

  function renderNav() {
    let nav = document.getElementById('ds-appnav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'ds-appnav';
      nav.className = 'ds-appnav';
      nav.setAttribute('aria-label', 'Primary');
      document.body.appendChild(nav);
      nav.addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        e.stopPropagation();
        const fn = CFG.actions[btn.dataset.action];
        if (fn) fn();
      });
    }
    // An aux item the page can't service is not rendered — a nav that offers
    // something it cannot do is worse than a shorter nav.
    const aux = AUX.filter(a => typeof CFG.actions[a.action] === 'function');
    nav.innerHTML =
      DESTINATIONS.map(d => navItem(d)).join('') +
      '<div class="ds-appnav__spacer"></div>' +
      aux.map(a => navItem(a, 'ds-navitem--aux')).join('');
    syncCurrent(nav);
  }

  function syncCurrent(nav) {
    const cur = currentKey();
    (nav || document.getElementById('ds-appnav') || document).querySelectorAll('.ds-navitem')
      .forEach(el => {
        if (el.dataset.nav === cur) el.setAttribute('aria-current', 'page');
        else el.removeAttribute('aria-current');
      });
  }

  // ── The header ────────────────────────────────────────────────────────────
  // Progress is ambient context, not a destination (D15 §3): the meter reports
  // the scope named in the breadcrumb beside it, so it re-scopes by altitude
  // for free — corpus at the root, a section inside a section, one lesson's
  // three levels inside a lesson. The page supplies the numbers; the shell
  // supplies the contract that they must be about THIS scope.
  function renderHeader() {
    const bar = document.getElementById('ds-shellbar');
    if (!bar) return;
    const hit = here();

    let meter = '';
    if (typeof CFG.scope === 'function' && hit) {
      let st = null;
      try { st = CFG.scope(hit.kind, hit.params); } catch (_) { st = null; }
      if (st && st.total > 0) {
        const pct = Math.max(0, Math.min(100, Math.round((st.done / st.total) * 100)));
        const label = `${st.done} of ${st.total} done`;
        const inner =
          `<span class="ds-meter__bar" aria-hidden="true"><span style="width:${pct}%"></span></span>` +
          `<span class="ds-meter__n">${st.done}<span class="ds-meter__sep">/</span>${st.total}</span>`;
        meter = typeof CFG.actions.progress === 'function'
          ? `<button type="button" class="ds-meter" data-action="progress" title="${esc(label)} — open Progress" aria-label="${esc(label)}. Open Progress">${inner}</button>`
          : `<span class="ds-meter" title="${esc(label)}" aria-label="${esc(label)}">${inner}</span>`;
      }
    }

    // Actionable numbers only (§3 rule 1): "3 due" implies a next action, a
    // streak count does not. Zero due is not news, so it is not shown.
    let due = '';
    if (typeof CFG.due === 'function') {
      let n = null;
      try { n = CFG.due(); } catch (_) { n = null; }
      if (typeof n === 'number' && n > 0) {
        const h = R() ? R().hrefFrom('appMode', { mode: 'review/all' }, CFG.page) : null;
        const txt = `${n} due`;
        due = h ? `<a class="ds-duechip" href="${esc(h)}" title="Review everything that's due">${txt}</a>`
                : `<span class="ds-duechip">${txt}</span>`;
      }
    }

    bar.querySelector('.ds-shellbar__right').innerHTML = meter + due;
  }

  function refresh() {
    syncCurrent();
    renderHeader();
    if (root.DrillBreadcrumb) root.DrillBreadcrumb.refresh();
  }

  // ── Navigating dismisses what was open over you ───────────────────────────
  // Measured: tapping Progress while the Practice sheet was open swapped the
  // page underneath and left the sheet on top of it. An overlay is scoped to
  // the surface it was opened from; outliving that surface makes it a second,
  // stale screen the user has to dismiss to discover where they now are.
  //
  // The shell closes the ds/ overlays because those are its own components. It
  // does NOT go hunting for a page's bespoke modals — that is the coupling this
  // file exists to prevent — so it announces the navigation and each page
  // closes its own. (docs/information-architecture.md §5 rule 4.)
  function dismissOverlays() {
    document.querySelectorAll('.ds-scrim.is-open').forEach(el => el.classList.remove('is-open'));
    root.dispatchEvent(new CustomEvent('drill:navigated'));
  }

  function mount(cfg) {
    CFG.page = cfg.page;
    CFG.actions = cfg.actions || {};
    CFG.scope = cfg.scope || null;
    CFG.due = cfg.due || null;

    const bar = document.getElementById('ds-shellbar');
    if (bar && !bar.querySelector('.ds-shellbar__right')) {
      bar.innerHTML =
        '<nav id="ds-crumbs" class="ds-crumbs" hidden></nav>' +
        '<div class="ds-shellbar__right"></div>';
      bar.addEventListener('click', e => {
        const b = e.target.closest('[data-action]');
        if (!b) return;
        const fn = CFG.actions[b.dataset.action];
        if (fn) fn();
      });
    }

    if (root.DrillBreadcrumb) {
      const c = cfg.crumb || {};
      root.DrillBreadcrumb.mount({
        page: CFG.page,
        mount: document.getElementById('ds-crumbs'),
        title: c.title, extra: c.extra, hidden: c.hidden
      });
    }

    renderNav();
    renderHeader();
    root.addEventListener('hashchange', () => { dismissOverlays(); refresh(); });
  }

  root.DrillShell = { mount, refresh, dismissOverlays, DESTINATIONS, AUX, currentKey };
})(typeof globalThis !== 'undefined' ? globalThis : this);
