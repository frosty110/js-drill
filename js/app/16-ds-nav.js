// ── 16: ds-nav — adaptive navigation shell (design-loop P1, slice 1) ────────
// The redesign's primary navigation (decision D01: bottom tab bar on mobile,
// left rail on desktop). THIS SLICE SHIPS THE MOBILE BOTTOM BAR ONLY —
// css/06-ds-nav.css hides it ≥900px until the desktop rail lands alongside the
// P4 Browse surface (the rail needs a surface to sit next to; the current
// 320px sidebar already fills that slot).
//
// Interim wiring (until P2/P3/P4/P5 build the real destinations, each tab
// synthetically clicks the existing launcher for the closest current
// equivalent — the same contract the command palette uses):
//   Today    → #today-home-btn   (Today home page — js/app/17-today-home.js)
//   Browse   → #browse-btn       (Browse page — js/app/19-browse.js)
//   Practice → #practice-launcher-btn (ds-sheet launcher — 18-practice-launcher.js)
//   Progress → #dashboard-btn    (unified Dashboard — becomes P5 Progress)
//
// Interop rules (see css/06-ds-nav.css):
//   · L3 tab renders a sticky bottom Run bar → the nav hides there
//     (immersive-rep pattern; L3 is the at-desk tier per PROFILE.md).
//   · The audio dock lifts above the bar (mini-player-above-tabs pattern).
//   · Redundant mobile topbar chrome (#hamburger, #topbar-dashboard-mobile,
//     #topbar-mobile-menu) is hidden — the buttons STAY in the DOM as
//     synthetic-click targets; capability is unchanged (D05).
//
// No state, no saveProgress — pure chrome. Active-tab highlight is pure CSS
// (body.sidebar-open → Browse; body:has(.dashboard-page) → Progress).

(() => {
  const NAV_ITEMS = [
    { key: 'today', label: 'Today', target: 'today-home-btn',
      icon: '<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-6h6v6"/>' },
    { key: 'browse', label: 'Browse', target: 'browse-btn',
      icon: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="15" width="7" height="5" rx="1.5"/><rect x="14" y="15" width="7" height="5" rx="1.5"/>' },
    { key: 'practice', label: 'Practice', target: 'practice-launcher-btn',
      icon: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>' },
    { key: 'progress', label: 'Progress', target: 'dashboard-btn',
      icon: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3.5-4 3 2.5L20 7"/>' },
  ];

  function mountDsNav() {
    if (document.getElementById('ds-appnav')) return;
    const nav = document.createElement('nav');
    nav.id = 'ds-appnav';
    nav.className = 'ds-appnav';
    nav.setAttribute('aria-label', 'Primary');
    for (const item of NAV_ITEMS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ds-navitem';
      btn.dataset.nav = item.key;
      btn.innerHTML =
        `<svg viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg>${item.label}`;
      btn.addEventListener('click', (e) => {
        // Don't let this event bubble to document-level close-on-outside
        // handlers — they'd instantly close whatever the synthetic click
        // below just opened (bit the Practice → topbar dropdown flow).
        e.stopPropagation();
        const target = document.getElementById(item.target);
        if (target) target.click();
      });
      nav.appendChild(btn);
    }
    document.body.appendChild(nav);

    // Programmatic active state (a11y) — the visual highlight is pure CSS
    // (body:has(.today-home-page/.dashboard-page) in css/06-ds-nav.css);
    // aria-current must track the RENDERED page, not the last nav tap (the
    // hero Start button, palette, and sidebar all swap the page without
    // touching the nav). A childList observer on #lesson-shell fires on
    // exactly those swaps — cheap, and keeps the attribute truthful.
    const syncCurrent = () => {
      const current = document.querySelector('.today-home-page') ? 'today'
        : document.querySelector('.browse-page') ? 'browse'
        : document.querySelector('.dashboard-page') ? 'progress' : null;
      nav.querySelectorAll('.ds-navitem').forEach(b => {
        if (b.dataset.nav === current) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
    };
    const shell = document.getElementById('lesson-shell');
    if (shell) new MutationObserver(syncCurrent).observe(shell, { childList: true });
    syncCurrent();
  }

  // Topbar chrome: swap emoji glyphs for the ds stroke icon set (D07 — emoji
  // is banned from chrome). Labels/tooltips are untouched; only the glyph
  // span / button face changes. Legacy surfaces (sidebar buttons, palette)
  // convert when their phases land — they retire or migrate anyway.
  function upgradeTopbarIcons() {
    if (typeof dsIcon !== 'function') return;
    const swaps = [
      ['.surface-seg[data-surface="problems"] [aria-hidden]', 'code', 15],
      ['.surface-seg[data-surface="reference"] [aria-hidden]', 'book-open', 15],
      ['#topbar-plan [aria-hidden]', 'clipboard-list', 15],
      ['#palette-trigger', 'search', 19],
      ['#topbar-help', 'help', 19],
      ['#topbar-settings', 'sliders', 19],
      ['#topbar-dashboard-mobile', 'chart', 19],
      ['#topbar-mobile-menu', 'grid', 19],
    ];
    for (const [sel, name, size] of swaps) {
      const el = document.querySelector(sel);
      if (el) el.innerHTML = dsIcon(name, size);
    }
  }

  // Slices are deferred so the DOM is parsed by the time this runs.
  mountDsNav();
  upgradeTopbarIcons();
})();
