// ──────────────────────────────────────────────────────────────────────────
//  SETTINGS TOGGLES — 5 opt-in feature toggles (Clarify, Hotseat, Calibrate,
//  Pace-Bar, Haptic). Each mirrors state to button class on mount + toggles
//  on click. Some force a render on flip to engage/disengage immediately.
// ──────────────────────────────────────────────────────────────────────────
function initSettingsToggles() {
  // iter 117: 🎤 Clarify-First Ritual — opt-in toggle (default OFF).
  // ON state painted sky-200 (matches button hover color). Toggling resets
  // the in-memory per-session completion set so flipping ON immediately
  // gates the current lesson's L3 (no need to re-navigate).
  const clarifyBtn = document.getElementById('clarify-ritual-btn');
  if (clarifyBtn) {
    if (state.clarifyRitualOn) {
      clarifyBtn.classList.add('text-sky-200');
      clarifyBtn.classList.remove('text-slate-500');
    }
    clarifyBtn.addEventListener('click', () => {
      state.clarifyRitualOn = !state.clarifyRitualOn;
      clarifyBtn.classList.toggle('text-sky-200', state.clarifyRitualOn);
      clarifyBtn.classList.toggle('text-slate-500', !state.clarifyRitualOn);
      _clarifySessionCompleted.clear();
      saveProgress();
      // Re-render the active lesson so the gate engages/disengages on the fly.
      if (state.currentLessonId && state.currentTab === 'L3') renderLesson();
    });
  }

  // iter 118: 🔥 Hot-Seat Follow-Up — opt-in toggle (default OFF).
  // Rose-200 hover when ON. No re-render needed on flip — only affects
  // the next L3-pass moment.
  const hotseatBtn = document.getElementById('hotseat-btn');
  if (hotseatBtn) {
    if (state.hotseatOn) {
      hotseatBtn.classList.add('text-rose-200');
      hotseatBtn.classList.remove('text-slate-500');
    }
    hotseatBtn.addEventListener('click', () => {
      state.hotseatOn = !state.hotseatOn;
      hotseatBtn.classList.toggle('text-rose-200', state.hotseatOn);
      hotseatBtn.classList.toggle('text-slate-500', !state.hotseatOn);
      saveProgress();
    });
  }

  // iter 119: ⏱ Time-to-Solve Calibration — opt-in toggle (default OFF).
  // Amber-200 hover when ON. Flipping clears in-memory session-state
  // tracking so the next L3 visit can re-engage the strip.
  const calibBtn = document.getElementById('calibrate-btn');
  if (calibBtn) {
    if (state.calibrateOn) {
      calibBtn.classList.add('text-amber-200');
      calibBtn.classList.remove('text-slate-500');
    }
    calibBtn.addEventListener('click', () => {
      state.calibrateOn = !state.calibrateOn;
      calibBtn.classList.toggle('text-amber-200', state.calibrateOn);
      calibBtn.classList.toggle('text-slate-500', !state.calibrateOn);
      _calibrationEstimated.clear();
      _calibrationSkipped.clear();
      saveProgress();
      if (state.currentLessonId && state.currentTab === 'L3') renderLesson();
    });
  }

  // iter 140: ⏲ Pace-Bar — opt-in toggle (default OFF). Emerald-200 hover
  // when ON. Flipping re-renders an active L3 so the bar appears/disappears
  // immediately. Clearing window._paceBarInterval prevents a stale tick from
  // outliving the bar element when the user toggles OFF while on L3.
  const paceBarBtn = document.getElementById('pace-bar-btn');
  if (paceBarBtn) {
    if (state.paceBarOn) {
      paceBarBtn.classList.add('text-emerald-200');
      paceBarBtn.classList.remove('text-slate-500');
    }
    paceBarBtn.addEventListener('click', () => {
      state.paceBarOn = !state.paceBarOn;
      paceBarBtn.classList.toggle('text-emerald-200', state.paceBarOn);
      paceBarBtn.classList.toggle('text-slate-500', !state.paceBarOn);
      if (window._paceBarInterval) {
        clearInterval(window._paceBarInterval);
        window._paceBarInterval = null;
      }
      saveProgress();
      if (state.currentLessonId && state.currentTab === 'L3') renderLesson();
    });
  }

  // iter 141: 📳 Haptic Tap-Pulse — opt-in toggle (default OFF). Fuchsia-200
  // hover when ON. Auto-hides on platforms without the Vibration API (iOS
  // Safari, desktop without vibration motor) so the user never sees a toggle
  // that does nothing. The capability check is at MOUNT time, not click time
  // — the toggle is either present + functional or absent, never present-but-
  // broken. Test pulse on enable confirms the channel works on this device.
  const hapticBtn = document.getElementById('haptic-btn');
  if (hapticBtn) {
    const hapticSupported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    if (!hapticSupported) {
      hapticBtn.style.display = 'none';
    } else {
      if (state.hapticOn) {
        hapticBtn.classList.add('text-fuchsia-200');
        hapticBtn.classList.remove('text-slate-500');
      }
      hapticBtn.addEventListener('click', () => {
        state.hapticOn = !state.hapticOn;
        hapticBtn.classList.toggle('text-fuchsia-200', state.hapticOn);
        hapticBtn.classList.toggle('text-slate-500', !state.hapticOn);
        saveProgress();
        // Test pulse on enable so the user feels it work immediately —
        // closes the "did I actually turn it on?" confirmation gap.
        if (state.hapticOn) _hapticPulse('L1-pass');
      });
    }
  }

  // 🖍 ADHD Mode — opt-in toggle (default OFF). Purple-200 hover when ON.
  // Restyles the Conversation tab with bionic word-heads + marker highlight
  // on backtick code terms + looser spacing. The body.adhd-mode class drives
  // the CSS for marker + spacing; bionic markup is render-time gated, so we
  // re-render the active lesson when toggled while on the Conversation tab
  // (markup only emitted when ON, keeps off-users' DOM clean).
  const adhdBtn = document.getElementById('adhd-mode-btn');
  if (adhdBtn) {
    if (state.adhdMode) {
      adhdBtn.classList.add('text-purple-200');
      adhdBtn.classList.remove('text-slate-500');
      document.body.classList.add('adhd-mode');
    }
    adhdBtn.addEventListener('click', () => {
      state.adhdMode = !state.adhdMode;
      adhdBtn.classList.toggle('text-purple-200', state.adhdMode);
      adhdBtn.classList.toggle('text-slate-500', !state.adhdMode);
      document.body.classList.toggle('adhd-mode', state.adhdMode);
      saveProgress();
      if (state.currentLessonId && state.currentTab === 'conversation') renderLesson();
    });
  }

  // 🔠 Font scale — cycles md (1.0×) → lg (1.125×, default) → xl (1.25×) → md.
  // The --font-scale CSS variable on :root drives html font-size so every
  // rem-based value scales uniformly. Button label reflects the current step
  // ("🔠 Font: M / L / XL") so users see the state without opening a menu.
  // No re-render needed — CSS picks up the variable change instantly.
  const fontBtn = document.getElementById('font-size-btn');
  if (fontBtn) {
    const FONT_SCALE_FACTOR = { md: 1.0, lg: 1.125, xl: 1.25 };
    const FONT_SCALE_LABEL  = { md: 'M',  lg: 'L',     xl: 'XL'  };
    const FONT_SCALE_NEXT   = { md: 'lg', lg: 'xl',    xl: 'md'  };
    function _applyFontScale() {
      const k = state.fontScale in FONT_SCALE_FACTOR ? state.fontScale : 'lg';
      document.documentElement.style.setProperty('--font-scale', FONT_SCALE_FACTOR[k]);
      fontBtn.textContent = '🔠 Font: ' + FONT_SCALE_LABEL[k];
      fontBtn.classList.toggle('text-teal-200', k !== 'md');
      fontBtn.classList.toggle('text-slate-500', k === 'md');
    }
    _applyFontScale();
    fontBtn.addEventListener('click', () => {
      state.fontScale = FONT_SCALE_NEXT[state.fontScale] || 'lg';
      _applyFontScale();
      saveProgress();
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  PWA INSTALL — beforeinstallprompt capture + button + appinstalled cleanup
// ──────────────────────────────────────────────────────────────────────────
function initPwaInstall() {
  // iter 145: 📲 PWA Install button. Hidden by default (.hidden class on
  // the HTML element). Listens for the browser's `beforeinstallprompt` event
  // (fires on Chrome/Edge/Android when the PWA install criteria are met:
  // manifest present + service worker registered + valid scope). When the
  // event fires, we (a) stash the deferred prompt for later, (b) unhide the
  // sidebar button, (c) unhide the topbar Settings menu entry too (next
  // topbar render picks it up via _topbarItemFromButton, which respects
  // .hidden + style.display per iter-141 fix).
  // iOS Safari and desktop browsers without PWA install heuristics never
  // fire the event; the button stays hidden — users go through the native
  // Share → Add to Home Screen flow there (no app surface needed). Once
  // the user dismisses or accepts the prompt, the button re-hides (a
  // second install prompt only fires after browser-defined cooldown).
  let _deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();  // Suppress the browser's automatic mini-infobar.
    _deferredInstallPrompt = e;
    const btn = document.getElementById('install-btn');
    if (btn) btn.classList.remove('hidden');
  });
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!_deferredInstallPrompt) return;
      _deferredInstallPrompt.prompt();
      try { await _deferredInstallPrompt.userChoice; } catch (_) { /* ignore */ }
      _deferredInstallPrompt = null;
      installBtn.classList.add('hidden');
    });
  }
  // Capture the `appinstalled` event so we hide the button when install
  // completes via a path other than our button (e.g. browser address-bar
  // install icon on desktop). Belt + suspenders cleanup.
  window.addEventListener('appinstalled', () => {
    _deferredInstallPrompt = null;
    const btn = document.getElementById('install-btn');
    if (btn) btn.classList.add('hidden');
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  SEARCH + GLOBAL KEYBOARD — sidebar search input + non-modifier keyboard
//  nav (j/k/1-9/s/?/Escape, `/` to focus search). Cmd-K is in initCommandPalette.
// ──────────────────────────────────────────────────────────────────────────
function initSearchAndKeyboard() {
  // Search input
  const searchInput = document.getElementById('search-input');
  // iter 31 (refine): drop the "(press /)" keyboard-shortcut cue on coarse-
  // pointer (touch) devices where there's no / key. Same matchMedia idiom
  // used by review-btn's L2-vs-L3 tab routing. The global / hotkey handler
  // (below) stays wired in case the device somehow delivers it.
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
    searchInput.placeholder = 'Search lessons…';
  }
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderSidebar();
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      state.searchQuery = '';
      searchInput.blur();
      renderSidebar();
    }
  });

  // Keyboard nav (global)
  document.addEventListener('keydown', (e) => {
    // All in-app shortcuts are bare keys. If a modifier is held, defer to the
    // browser/OS — otherwise we'd hijack Cmd+C (copy), Cmd+1-9 (browser tabs),
    // Cmd+/ (devtools-style), etc.
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // Skip when typing into inputs / editors
    const target = e.target;
    const inEditable = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      (target.closest && target.closest('.CodeMirror'))
    );

    if (e.key === '/' && !inEditable) {
      e.preventDefault();
      // When the Browse page is open, `/` targets ITS search field (the
      // page's own filterable list). Everywhere else it opens the command
      // palette — the redesign's search surface. (The drawer that used to
      // own `/` retired in P4 part 3; Browse carries its filters now.)
      const browseSearch = document.querySelector('.browse-page [data-browse-search]');
      if (browseSearch) { browseSearch.focus(); return; }
      if (typeof _paletteOpen === 'function') _paletteOpen();
      return;
    }
    if (e.key === '?' && !inEditable) {
      e.preventDefault();
      document.getElementById('help-modal').style.display = 'block';
      return;
    }
    if (e.key === 'Escape') {
      // Close any open modal on Escape
      const palette = document.getElementById('palette-overlay');
      if (palette && !palette.classList.contains('hidden')) {
        _paletteClose();
        e.preventDefault();
        return;
      }
      const modals = ['help-modal', 'today-modal', 'mechanics-modal', 'cheatsheet-modal', 'path-modal', 'at-risk-modal', 'heatstrip-modal', 'audio-modal'];
      for (const id of modals) {
        const m = document.getElementById(id);
        if (m && m.style.display === 'block') { m.style.display = 'none'; e.preventDefault(); return; }
      }
    }
    if (inEditable) return;

    if (e.key === 'j' || e.key === 'ArrowDown') {
      const n = nextLessonId(state.currentLessonId);
      if (n) { e.preventDefault(); selectLesson(n); }
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      const p = prevLessonId(state.currentLessonId);
      if (p) { e.preventDefault(); selectLesson(p); }
    } else if (/^[1-9]$/.test(e.key)) {
      // Number keys map to the Nth tab in current render order. Patterns/Applied
      // lessons expose up to 6 tabs (Conversation, Walkthrough, Reference,
      // L1, L2, L3); Syntax lessons expose 4. The visible "N. " prefix on each
      // tab label makes the mapping discoverable.
      const tabBtns = document.querySelectorAll('.tab-btn[data-level]');
      const idx = parseInt(e.key, 10) - 1;
      const btn = tabBtns[idx];
      if (btn && btn.dataset.level) selectTab(btn.dataset.level);
    }
    else if (e.key === 's') {
      const id = pickShuffleReview();
      if (id) { e.preventDefault(); selectLesson(id); }
    }
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  COMMAND PALETTE WIRING — connect the module-level _palette* functions
//  to the palette DOM (input, overlay click, trigger button, Cmd-K binding).
// ──────────────────────────────────────────────────────────────────────────
function initCommandPalette() {
  // iter 104: 🗺 Command Palette — Cmd-K / Ctrl-K opens overlay with fuzzy
  // search across sidebar buttons + lessons + sections. Closes the 33-button
  // discoverability decay the recent ship-spree caused. First REORGANIZE-not-
  // ADD surface. Results ranked by recent-use frequency from state.commandUsage.
  const paletteOverlay = document.getElementById('palette-overlay');
  const paletteInput = document.getElementById('palette-input');
  const paletteTrigger = document.getElementById('palette-trigger');
  // iter 34 (refine): touch-aware palette footer. Default footer is keyboard-
  // only ("↑↓ navigate ↵ open Esc close") — none of those work on touch.
  // Replace with tap-equivalents on coarse-pointer. Same matchMedia idiom as
  // iter 31's search-input placeholder fix. Arrow/Enter/Esc handlers below
  // stay wired in case a touch device delivers those events.
  if (paletteOverlay && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
    const footer = paletteOverlay.querySelector('.palette-footer');
    if (footer) footer.innerHTML = '<span>Tap a row to open · Tap outside to close</span>';
  }
  if (paletteInput) {
    paletteInput.addEventListener('input', _paletteRender);
    paletteInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _paletteCursor = Math.min(_paletteFiltered.length - 1, _paletteCursor + 1);
        _paletteRender();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _paletteCursor = Math.max(0, _paletteCursor - 1);
        _paletteRender();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        _paletteSelect(_paletteCursor);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        _paletteClose();
      }
    });
  }
  if (paletteOverlay) {
    paletteOverlay.addEventListener('click', (e) => {
      if (e.target === paletteOverlay) _paletteClose();
    });
  }
  if (paletteTrigger) {
    paletteTrigger.addEventListener('click', _paletteOpen);
  }
  // Cmd-K / Ctrl-K binding — modifier-required so bare `k` lesson-nav is preserved.
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      _paletteOpen();
    }
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  DRAWER — retired (design-loop P4 part 3, D10). The Browse page carries the
//  sidebar's search / filters / lesson list as first-class ds controls at
//  every viewport, so the off-canvas drawer never opens. #hamburger stays in
//  the DOM (display:none, css/06-ds-nav.css) and redirects any residual
//  synthetic click to Browse; the backdrop handler is a defensive
//  close-if-somehow-open.
// ──────────────────────────────────────────────────────────────────────────
function initMobileDrawer() {
  document.getElementById('hamburger').addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
    if (typeof openBrowse === 'function') openBrowse();
  });
  document.getElementById('sidebar-backdrop').addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
  });
}

