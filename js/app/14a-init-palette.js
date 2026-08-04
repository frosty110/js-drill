//  INIT
// ──────────────────────────────────────────────────────────────────────────
// init() is the boot orchestrator. Every line below `await initBootstrap()`
// wires one feature area; each sub-init owns its own DOM references and
// listeners. Reading top-to-bottom = reading the boot sequence.
//
// Order rules:
//   1. initBootstrap MUST be awaited first. It loads PATHS → progress →
//      manifest → mechanics, GC's stale state, resolves the resume target,
//      and paints the first render. If loadManifest fails it returns false
//      and we abort — the UI shell already shows the error message.
//   2. After bootstrap, the wiring sub-inits run in any order. They only
//      add event listeners — no data mutations, no renders.
//   3. initBootTail runs last. It paints initial badge counts, mounts
//      cross-tab + interval + service-worker listeners, and reflects
//      persisted toggle state onto already-wired buttons.
// Mode-route stashed during initBootstrap (#/m/<mode>), dispatched at the end
// of init() once every surface button is wired. See initBootstrap + init tail.
let _pendingBootMode = null;
let _pendingBootModeArg = null;

async function init() {
  if (!(await initBootstrap())) return;

  initDrillLaunchers();
  initSidebarActions();
  initSettingsToggles();
  initPwaInstall();
  initSearchAndKeyboard();
  initCommandPalette();
  initMobileDrawer();
  initAtRiskModal();
  initStreakMapModal();
  initAudioPlayer();
  initHeatstrip();
  initStatsModal();
  initDashboardModal();
  initTodaysPlanModal();
  initPathSwitcher();
  initMechanicsWiring();
  initHelpModal();
  initBackupRestore();
  initCheatsheetWiring();
  initBootTail();
  // Boot mode-route dispatch — runs AFTER every surface button is wired, so a
  // new tab opened at #/m/<mode> lands straight on that surface.
  if (_pendingBootMode) {
    _dispatchModeRoute(_pendingBootMode, _pendingBootModeArg);
    _pendingBootMode = null;
    _pendingBootModeArg = null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  COMMAND PALETTE — module-level state (cross-sub-init: the global keydown
//  handler in initSearchAndKeyboard calls _paletteClose on Escape, and the
//  Cmd-K binding in initCommandPalette calls _paletteOpen. Lexically hoisting
//  these out of init() is what lets them live in separate sub-inits.)
// ──────────────────────────────────────────────────────────────────────────
let _paletteItems = [];     // [{ id, label, kind, hint?, action }]
let _paletteFiltered = [];
let _paletteCursor = 0;

function _paletteBuildIndex() {
  const items = [];
  // (0-) Home — the front door (js/app/22-home.js). Reachable from the nav,
  // but the palette is the keyboard route back to it from anywhere.
  items.push({
    id: 'btn:home',
    label: 'Home',
    kind: 'mode',
    hint: 'Continue any track · review what’s due',
    action: () => { const b = document.getElementById('home-btn'); if (b) b.click(); }
  });
  // (0) Dashboard — lives in the topbar (not the sidebar scan below), so add it
  // explicitly. "stats" / "streak" still resolve via their retired sidebar
  // buttons (which now route to the Dashboard).
  items.push({
    id: 'btn:dashboard',
    label: 'Dashboard',
    kind: 'mode',
    hint: 'Daily progress, activity, and mastery in one view',
    action: () => { if (typeof openDashboard === 'function') openDashboard(); }
  });
  // (0b) System Design — a separate page whose only other entry point is the
  // desktop topbar link (hidden ≤767px, and the dropdown menus retired with
  // the P4b rail). The palette keeps it reachable from every viewport.
  items.push({
    id: 'link:system-design',
    label: 'System Design',
    kind: 'mode',
    hint: 'Standalone memorization drill — DDIA, building blocks, design problems',
    action: () => { window.location.href = 'system-design.html'; }
  });
  // (0c) Diagnostic — nav-audit P1-2: its only other in-app link renders in
  // the one-time welcome modal, so returning users had zero doors to the
  // page that feeds the autopilot's gap signal (PROFILE § Study intent #2).
  items.push({
    id: 'link:diagnostic',
    label: 'Diagnostic (43 questions)',
    kind: 'mode',
    hint: 'Baseline your gaps — feeds the autopilot pick',
    action: () => { window.location.href = 'diagnostic.html'; }
  });
  // (1) Sidebar buttons — synthetic click invokes existing handlers.
  document.querySelectorAll('aside button[id], #sidebar-main-buttons button[id]').forEach(btn => {
    const id = btn.id;
    if (!id || id === 'palette-trigger' || id === 'hamburger') return;
    const text = (btn.textContent || '').trim().replace(/\s+/g, ' ');
    if (!text || text.length > 60) return;
    const hint = btn.title || '';
    items.push({
      id: 'btn:' + id,
      label: text,
      kind: 'mode',
      hint: hint.length > 80 ? hint.slice(0, 78) + '…' : hint,
      action: () => btn.click()
    });
  });
  // (2) Lessons — direct selectLesson.
  for (const lesson of CURRICULUM) {
    if (lesson.status !== 'full') continue;
    items.push({
      id: 'lesson:' + lesson.id,
      label: lesson.title,
      kind: 'lesson',
      hint: lesson.section,
      action: () => { if (typeof selectLesson === 'function') selectLesson(lesson.id); }
    });
  }
  // (3) Sections — collect from manifest + jump-to-first-lesson-in-section.
  const seenSections = new Set();
  for (const lesson of CURRICULUM) {
    if (seenSections.has(lesson.section)) continue;
    seenSections.add(lesson.section);
    const firstId = lesson.id;
    items.push({
      id: 'section:' + lesson.section,
      label: lesson.section,
      kind: 'section',
      hint: 'jump to first lesson in section',
      action: () => { if (typeof selectLesson === 'function') selectLesson(firstId); }
    });
  }
  return items;
}
function _paletteScore(item, q) {
  // Substring + use-count blend. Use-count breaks ties. Matches against
  // BOTH the visible label AND the underlying id (so users who know
  // lesson ids like "two-sum" can search by id). Treats hyphen / space /
  // dot / underscore as word separators for normalization.
  const usage = +(state.commandUsage[item.id] || 0);
  if (!q) return usage; // empty query: rank purely by recent use
  const norm = s => s.toLowerCase().replace(/[\s\-_.·:]+/g, ' ');
  const label = norm(item.label);
  const idStr = item.id ? norm(item.id) : '';
  const qNorm = norm(q);
  if (label.startsWith(qNorm)) return 1000 + usage;
  if (idStr && idStr.includes(qNorm)) return 950 + usage;
  if (label.includes(qNorm)) return 500 + usage;
  // Match by token initials (e.g., "rwk" matches "Reverse-Walk")
  const tokens = label.split(' ').filter(Boolean);
  const initials = tokens.map(t => t[0] || '').join('');
  if (initials.startsWith(qNorm.replace(/\s/g, ''))) return 200 + usage;
  return 0;
}
function _paletteRender() {
  const paletteInput = document.getElementById('palette-input');
  const paletteResults = document.getElementById('palette-results');
  const q = paletteInput.value.toLowerCase().trim();
  if (!q) {
    // Empty-query default: interleave kinds so the user sees a representative
    // mix of modes + lessons + sections rather than 24 mode rows in a row.
    // Within each kind, sort by recent-use (state.commandUsage). Caps: 12
    // modes / 8 lessons / 4 sections = 24 total.
    const byKind = { mode: [], lesson: [], section: [] };
    for (const item of _paletteItems) {
      if (byKind[item.kind]) byKind[item.kind].push(item);
    }
    const byUse = (a, b) => (+(state.commandUsage[b.id] || 0)) - (+(state.commandUsage[a.id] || 0));
    // iter 53 (refine): hide zero-count modes from the empty-default — modes
    // whose label ends with "(0)" or trailing " 0" are non-actionable for the
    // user RIGHT NOW; they remain discoverable via typed query (else branch).
    const isZeroCountMode = item => /\(0\)$|\s0$/.test(item.label);
    _paletteFiltered = [
      ...byKind.mode.filter(item => !isZeroCountMode(item)).sort(byUse).slice(0, 12),
      ...byKind.lesson.sort(byUse).slice(0, 8),
      ...byKind.section.sort(byUse).slice(0, 4)
    ];
    // Re-sort the combined 24 by score (use-count) so the most-recently-used
    // items float to top regardless of kind.
    _paletteFiltered.sort(byUse);
  } else {
    const scored = _paletteItems.map(item => ({ item, score: _paletteScore(item, q) }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);
    _paletteFiltered = scored.slice(0, 24).map(s => s.item);
  }
  if (_paletteCursor >= _paletteFiltered.length) _paletteCursor = 0;
  paletteResults.innerHTML = _paletteFiltered.map((item, i) => `
    <div class="palette-result ${i === _paletteCursor ? 'palette-result-active' : ''}" data-idx="${i}" role="option">
      <span class="palette-result-kind palette-result-kind-${item.kind}">${item.kind}</span>
      <span class="palette-result-label">${escapeHtml(item.label)}</span>
      ${item.hint ? `<span class="palette-result-hint">${escapeHtml(item.hint)}</span>` : ''}
    </div>
  `).join('') || '<div class="palette-empty">No matches.</div>';
  paletteResults.querySelectorAll('.palette-result').forEach(el => {
    el.addEventListener('click', () => {
      const i = +el.dataset.idx;
      _paletteSelect(i);
    });
    el.addEventListener('mouseenter', () => {
      _paletteCursor = +el.dataset.idx;
      paletteResults.querySelectorAll('.palette-result').forEach((n, j) =>
        n.classList.toggle('palette-result-active', j === _paletteCursor));
    });
  });
}
function _paletteSelect(i) {
  const item = _paletteFiltered[i];
  if (!item) return;
  state.commandUsage[item.id] = (state.commandUsage[item.id] || 0) + 1;
  saveProgress();
  _paletteClose();
  setTimeout(() => { try { item.action(); } catch (_) {} }, 0);
}
function _paletteOpen() {
  const paletteOverlay = document.getElementById('palette-overlay');
  const paletteInput = document.getElementById('palette-input');
  if (!paletteOverlay || !paletteInput) return;
  _paletteItems = _paletteBuildIndex();
  paletteInput.value = '';
  _paletteCursor = 0;
  paletteOverlay.classList.remove('hidden');
  _paletteRender();
  setTimeout(() => paletteInput.focus(), 0);
}
function _paletteClose() {
  const paletteOverlay = document.getElementById('palette-overlay');
  const paletteInput = document.getElementById('palette-input');
  if (paletteOverlay) paletteOverlay.classList.add('hidden');
  if (paletteInput) paletteInput.value = '';
  _paletteFiltered = [];
}

