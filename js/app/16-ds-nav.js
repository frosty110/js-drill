// ── 16: ds-nav — adaptive navigation shell (design-loop P1 + P4b) ───────────
// The redesign's primary navigation (decision D01): a bottom tab bar ≤767px,
// a left rail ≥768px. The rail carries the same 4 destinations plus two aux
// items at its foot — Search (⌘K → command palette) and Settings — replacing
// the desktop topbar dropdown menus and the permanent sidebar (which becomes
// an off-canvas drawer for its power filters; see css/06-ds-nav.css).
//
// Wiring: each item synthetically clicks the canonical launcher button — the
// same contract the command palette uses:
//   Home     → #home-btn         (Home — the front door, js/app/22-home.js)
//   Browse   → #browse-btn       (Browse page — js/app/19-browse.js)
//   Practice → #practice-launcher-btn (ds-sheet launcher — 18-practice-launcher.js)
//   Progress → #dashboard-btn    (unified Dashboard — becomes P5 Progress)
//   Search   → #palette-trigger  (command palette, rail only)
//   Settings → #topbar-settings  (opens the ds Settings sheet — P6/D11;
//              js/app/21-settings.js openSettings)
//
// Interop rules (see css/06-ds-nav.css):
//   · Mobile: L3's sticky Run bar owns the bottom edge → the bar hides there
//     (immersive-rep pattern; L3 is the at-desk tier per PROFILE.md). The
//     audio dock lifts above the bar (mini-player-above-tabs pattern).
//   · Desktop: the rail slots under the topbar; the audio dock yields the
//     rail's width; the drawer/backdrop cover the rail when open.
//   · Retired chrome (#hamburger, mobile topbar icons, desktop dropdown
//     menus) STAYS in the DOM as synthetic-click targets; capability is
//     unchanged (D05).
//
// No state, no saveProgress — pure chrome. Active-item highlight is CSS over
// aria-current (kept truthful by the #lesson-shell observer below).

(() => {
  // Icons are NAMES, resolved against ds/icons.js at render time. They used to
  // be inlined path strings here — byte-identical copies of five DS_ICONS
  // entries — which is the drift invariant 5 exists to stop: editing the set
  // would have left the primary navigation on the old drawing, and nothing
  // would have looked broken.
  const NAV_ITEMS = [
    // Home — the front door (js/app/22-home.js). Replaced the "Today"
    // destination in the nav, and since audit F5 there is no Today page left
    // to compete with it: #/m/today-home delegates here. Today's Plan (the
    // modal, #today-btn) is one tap away in Home's More list.
    { key: 'home', label: 'Home', target: 'home-btn',
      title: 'Home — continue any track, review what’s due', icon: 'home' },
    { key: 'browse', label: 'Browse', target: 'browse-btn', icon: 'grid' },
    { key: 'practice', label: 'Practice', target: 'practice-launcher-btn', icon: 'zap' },
    { key: 'progress', label: 'Progress', target: 'dashboard-btn', icon: 'chart' },
    // System Design — the standalone drill (separate page). No in-shell page to
    // highlight (it navigates away), so it never takes aria-current; that's
    // correct — you've left the SPA. The same `sysdesign` mark the standalone
    // page wears as its wordmark, so arriving there shows one glyph.
    { key: 'sysdesign', label: 'Design', target: 'system-design-btn',
      title: 'System Design — standalone memorization drill (DDIA, building blocks, design problems)',
      icon: 'sysdesign' },
  ];

  // Rail-only aux items (ds/components.css hides them in bottom-bar mode —
  // the phone reaches search/settings from the topbar icon strip instead).
  const AUX_ITEMS = [
    { key: 'palette', label: 'Search', hint: '⌘K', target: 'palette-trigger',
      title: 'Command palette · ⌘K / Ctrl-K · search modes, lessons, sections',
      icon: 'search' },
    { key: 'settings', label: 'Settings', target: 'topbar-settings',
      title: 'Settings — toggles, data, reset', icon: 'sliders' },
  ];

  function navButton(item, extraClass) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ds-navitem' + (extraClass ? ' ' + extraClass : '');
    btn.dataset.nav = item.key;
    if (item.title) btn.title = item.title;
    // Sized by .ds-navitem svg in ds/components.css, not by the attribute —
    // dsIcon's default is fine and the rule wins either way.
    btn.innerHTML =
      `${typeof dsIcon === 'function' ? dsIcon(item.icon) : ''}${item.label}` +
      (item.hint ? `<span class="ds-navitem__hint" aria-hidden="true">${item.hint}</span>` : '');
    btn.addEventListener('click', (e) => {
      // Don't let this event bubble to document-level close-on-outside
      // handlers — they'd instantly close whatever the synthetic click
      // below just opened (bit the Practice → topbar dropdown flow).
      e.stopPropagation();
      const target = document.getElementById(item.target);
      if (target) target.click();
    });
    return btn;
  }

  function mountDsNav() {
    if (document.getElementById('ds-appnav')) return;
    const nav = document.createElement('nav');
    nav.id = 'ds-appnav';
    nav.className = 'ds-appnav';
    nav.setAttribute('aria-label', 'Primary');
    for (const item of NAV_ITEMS) nav.appendChild(navButton(item));
    const spacer = document.createElement('div');
    spacer.className = 'ds-appnav__spacer';
    nav.appendChild(spacer);
    for (const item of AUX_ITEMS) nav.appendChild(navButton(item, 'ds-navitem--aux'));
    document.body.appendChild(nav);

    // Programmatic active state (a11y) — the highlight is CSS over
    // aria-current (css/06-ds-nav.css); aria-current must track the RENDERED
    // page, not the last nav tap (the hero Start button, palette, and sidebar
    // all swap the page without touching the nav). A childList observer on
    // #lesson-shell fires on exactly those swaps — cheap, and keeps the
    // attribute truthful.
    //
    // One page class per nav key — no aliases. `.today-home-page` used to map
    // here too, so the Today page highlighted "Home" (audit F5); that page is
    // retired and delegates to Home, so the special case is gone with it.
    const syncCurrent = () => {
      const current = document.querySelector('.home-page') ? 'home'
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

  // System Design launcher target: the single click-sink shared by the rail/bar
  // "Design" item, the Practice launcher's Study row, Home's System Design
  // track card, the command palette, and the #/m/system-design deep-link
  // route. It leaves the SPA for the standalone drill page.
  const sysBtn = document.getElementById('system-design-btn');
  if (sysBtn) sysBtn.addEventListener('click', () => { window.location.href = 'system-design.html'; });

  // Slices are deferred so the DOM is parsed by the time this runs.
  mountDsNav();
  upgradeTopbarIcons();
})();
