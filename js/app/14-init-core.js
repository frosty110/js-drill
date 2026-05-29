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
  initHeatstrip();
  initStatsModal();
  initTodaysPlanModal();
  initPathSwitcher();
  initMechanicsWiring();
  initHelpModal();
  initBackupRestore();
  initCheatsheetWiring();
  initBootTail();
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
    _paletteFiltered = [
      ...byKind.mode.sort(byUse).slice(0, 12),
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

// ──────────────────────────────────────────────────────────────────────────
//  BOOTSTRAP — load data, GC stale state, resolve current lesson, first paint
// ──────────────────────────────────────────────────────────────────────────
async function initBootstrap() {
  // iter 125: load PATHS registry from data/paths.json BEFORE loadProgress —
  // loadProgress validates state.subscribedPathId against PATHS, so the registry
  // must be populated first. loadPaths() never throws (defensive fallback inside).
  await loadPaths();
  loadProgress();
  try { await loadManifest(); } catch (e) {
    document.getElementById('lesson-shell').innerHTML = '<div class="p-6 text-red-300">Failed to load lesson data: ' + (e && e.message ? e.message : e) + '</div>';
    return false;
  }
  // Tag registry is tiny and the sidebar facet row needs it on first paint —
  // await it (vs the fire-and-forget mechanics modal which loads on demand).
  await loadTagRegistry();
  // Fire-and-forget — modal will await its own load if user clicks before
  // this resolves. Keeps boot snappy on slow connections.
  loadMechanicsRegistry();
  // Re-run GC now that CURRICULUM is populated.
  {
    let mutated = false;
    for (const id of Object.keys(state.progress)) {
      if (!findLesson(id)) { delete state.progress[id]; mutated = true; }
    }
    if (mutated) saveProgress();
  }
  // URL deep-link takes precedence over lastLessonId resume. Sharing a URL
  // like #/two-sum/L1 should land the recipient on that exact surface even
  // if their localStorage points elsewhere.
  let resumed = false;
  const hashRoute = _parseHash();
  if (hashRoute) {
    const target = findLesson(hashRoute.lessonId);
    if (target && target.status === 'full') {
      state.currentLessonId = hashRoute.lessonId;
      if (hashRoute.tab) state.currentTab = hashRoute.tab;
      resumed = true;
    }
  }
  // Fall back to the last lesson + tab if no valid hash, then to the first
  // full lesson if no resume state.
  if (!resumed && state.lastLessonId) {
    const last = findLesson(state.lastLessonId);
    if (last && last.status === 'full') {
      state.currentLessonId = state.lastLessonId;
      if (state.lastTab && ['conversation','walkthrough','reference','L1','L2','L3'].includes(state.lastTab)) {
        state.currentTab = state.lastTab;
      }
      resumed = true;
    }
  }
  if (!resumed) {
    const firstFull = CURRICULUM.find(l => l.status === 'full');
    if (firstFull) state.currentLessonId = firstFull.id;
  }
  if (state.currentLessonId) syncBinderToLesson(state.currentLessonId);
  renderSidebar();
  renderLesson();
  _updateHash();
  // Listen for browser back/forward + paste-new-URL navigation. replaceState
  // (used internally by selectLesson/selectTab) does NOT fire this event, so
  // no infinite-loop risk.
  window.addEventListener('hashchange', _handleHashChange);
  return true;
}

// ──────────────────────────────────────────────────────────────────────────
//  DRILL LAUNCHERS — 25 sidebar buttons that each open a drill session.
//  Adding a new drill: append [btn-id, startSessionFn] to the registry
//  and add the button markup in index.html. No code change in init() needed.
//  Iter-history per drill lives in git log; the inline single-line tag is
//  the breadcrumb. `?.addEventListener` no-ops on absent buttons.
// ──────────────────────────────────────────────────────────────────────────
const DRILL_LAUNCHERS = [
  // iter 49 — 🔎 Recognize: diagnose the pattern from a problem prompt
  ['recognize-btn',        startRecognizeSession],
  // iter 76 — 🎯 Reverse: output → problem (sibling to Recognize)
  ['reverse-btn',          startReverseSession],
  // iter 77 — 🔮 Predict: mental-execution from same-type distractors
  ['crystal-btn',          startCrystalSession],
  // iter 79 — 📐 Claim: smell-test stated complexity vs the code
  ['claim-btn',            startClaimSession],
  // iter 83 — 🎰 Gotcha Roulette: reference.notes recall stream
  ['gotcha-btn',           startGotchaSession],
  // iter 86 — 🔀 Swap-Bench: pairwise idiom-equivalence ("same behavior?")
  ['swap-btn',             startSwapBenchSession],
  // iter 91 — 🎬 Conversation Drill: classify section by interview-arc phase
  ['conv-drill-btn',       startConvDrillSession],
  // iter 93 — 🧬 Trace-Hop: pick the middle state of 3 consecutive frames
  ['trace-hop-btn',        startTraceHopSession],
  // iter 97 — 📝 Notes Cloze: keyword-blank MC over reference.notes[]
  ['notes-drill-btn',      startNotesDrillSession],
  // iter 98 — 🪐 Mechanic Constellation: multi-select lessons by tag
  ['constellation-btn',    startConstellationSession],
  // iter 99 — ⏪ Reverse-Walkthrough: final state → which input produced it
  ['reverse-walk-btn',     startReverseWalkSession],
  // iter 102 — 🗂 Notes Locate: cross-corpus note → which lesson
  ['notes-locate-btn',     startNotesLocateSession],
  // iter 122 — 🧪 What-If: input → output prediction over walkthrough examples
  ['whatif-btn',           startWhatifSession],
  // iter 142 — 🔀 Mutate-and-Predict: name the failure class of a mutation
  ['mutate-btn',           startMutateSession],
  // iter 147 — 📞 Phone Screen: chained 3-card session under one timer
  ['phone-screen-btn',     startPhoneScreenSession],
  // iter 148 — 🚧 Constraint-Shift: rewrite under a swapped constraint
  ['constraint-shift-btn', startConstraintShiftSession],
  // iter 109 — 🔖 Match: bidirectional title ↔ description matcher
  ['match-btn',            startMatchSession],
  // iter 111 — 🌈 Sections: section mastery heatmap (28-cell grid)
  ['sections-grid-btn',    startSectionGrid],
  // iter 88 — 🤖 AI Coach Export: clipboard payload for paste-into-LLM tutoring
  ['ai-coach-btn',         startAiCoachExport],
  // iter 54 — ⚡ Rapid-Fire L1: cross-lesson interleaved tap stream
  ['rapid-fire-btn',       startRapidFireSession],
  // iter 75 — ⏱ Big-O: complexity-filtered L1 stream
  ['big-o-btn',            startBigOSession],
  // iter 57 — 🌅 Warmup: 3-card micro-session over Today's Plan mix
  ['warmup-btn',           startWarmupSession],
  // iter 71 — 🏁 Section Speedrun: pick a section, race its L1 stream
  ['speedrun-btn',         startSpeedrunPicker],
  // iter 125 — 🥊 Gauntlet: chained all-L1 untimed across one section
  ['gauntlet-btn',         startGauntletPicker],
  // iter 73 — 🪲 Bug-Hunt: tap the buggy line on a mutated canonical
  ['bug-hunt-btn',         startBugHuntSession],
];

function initDrillLaunchers() {
  for (const [id, fn] of DRILL_LAUNCHERS) {
    document.getElementById(id)?.addEventListener('click', fn);
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  NAV HELPER — used by the 5 sidebar buttons that jump to a specific
//  (lessonId, tab) pair (review / weak / resurrect / bridge / reveal-replay).
//  selectLesson() is the primary nav path elsewhere — it sets tab='auto' so
//  the default-tab-per-track resolver picks. These 5 buttons land on a
//  specific tab, so they bypass selectLesson and mutate currentTab directly.
//
//  Opts default to FALSE so callers are explicit about whether to push hash
//  state and whether to collapse the mobile drawer; awaitContent gates a
//  fetch of the lesson JSON before renderLesson (used by review-btn to
//  avoid a flash-of-stub on slow connections).
// ──────────────────────────────────────────────────────────────────────────
async function navToLesson(id, opts = {}) {
  const { tab, updateHash = false, collapseMobile = false, awaitContent = false } = opts;
  state.currentLessonId = id;
  if (tab) state.currentTab = tab;
  syncBinderToLesson(id);
  saveProgress();
  renderSidebar();
  if (awaitContent) {
    await loadLessonContent(id);
    // User may have navigated away while content was loading — bail.
    if (state.currentLessonId !== id) return;
  }
  renderLesson();
  if (updateHash) _updateHash();
  if (collapseMobile && window.matchMedia('(max-width: 767px)').matches) {
    document.body.classList.remove('sidebar-open');
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  SIDEBAR ACTIONS — non-drill buttons (reset, shuffle/lucky/mock,
//  review/repair/weak/resurrect/bridge/reveal-replay, path, hide-mastered)
// ──────────────────────────────────────────────────────────────────────────
function initSidebarActions() {
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset ALL progress, reviews, best times, and weak-spot history? This cannot be undone (use Backup first if you want to save).')) {
      state.progress = {};
      state.streak = 0;
      state.bestTimes = {};
      state.mockHistory = {};
      state.reviews = {};
      state.revealed = {};
      state.weakness = {};
      state.lastLessonId = null;
      state.lastTab = null;
      saveProgress();
      updateStreakUI();
      updateReviewBadge();
      renderSidebar();
      renderLesson();
    }
  });

  // Shuffle button
  document.getElementById('shuffle-btn').addEventListener('click', () => {
    const id = pickShuffleReview();
    if (id) selectLesson(id);
  });

  // iter 108: 🍀 Lucky — random not-yet-mastered lesson dropped at the first
  // incomplete level so the user is drilling, not reading. Land on L1 by
  // default; skip to L2/L3 if those earlier levels are already passed.
  document.getElementById('lucky-btn').addEventListener('click', () => {
    const id = pickLuckyUnmastered();
    if (!id) return;
    const lesson = findLesson(id);
    let tab = 'L1';
    if (levelStatus(id, 'L1') === 'passed') tab = 'L2';
    if (levelStatus(id, 'L2') === 'passed') tab = 'L3';
    selectLesson(id);
    // selectLesson set currentTab='auto' (Conversation/Reference) — override
    // to land on the drill tab; renderLesson handles cache-miss re-render.
    selectTab(tab);
    if (lesson) _showLuckyToast(lesson.title);
  });

  // Mock interview button
  document.getElementById('mock-btn').addEventListener('click', () => {
    startRandomMockInterview();
  });

  // Review-Due button — jump to the most-overdue lesson.
  // On touch devices, land on L2 (cued recall via fill-in) — desirable
  // difficulty without the mechanical friction of typing free-recall code
  // on a phone keyboard. On fine-pointer devices, keep L3 (blank editor) —
  // the at-desk tier that actually advances the SR interval on pass.
  // See docs/learning-strategies/desirable-difficulty.md.
  document.getElementById('review-btn').addEventListener('click', async () => {
    const due = dueReviewIds();
    if (!due.length) return;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    await navToLesson(due[0], { tab: coarse ? 'L2' : 'L3', awaitContent: true });
  });

  // Hide-mastered toggle
  document.getElementById('hide-mastered-btn').addEventListener('click', () => {
    state.hideMastered = !state.hideMastered;
    const btn = document.getElementById('hide-mastered-btn');
    btn.classList.toggle('text-emerald-300', state.hideMastered);
    btn.classList.toggle('text-slate-500', !state.hideMastered);
    saveProgress();
    renderSidebar();
  });

  // Phase E: 🛠 Repair filter — show only lessons needing work.
  document.getElementById('repair-filter-btn')?.addEventListener('click', () => {
    state.repairFilter = !state.repairFilter;
    saveProgress();
    renderSidebar();
  });

  // Plan View toggle — filters the sidebar to the subscribed path's lessons.
  document.getElementById('path-btn').addEventListener('click', () => {
    // No-op when the subscribed path has no drill-lesson sequence (button is
    // also visually disabled, but guard here too for keyboard/programmatic clicks).
    if (!subscribedPathHasLessons()) return;
    state.starterPath = !state.starterPath;
    _invalidateStarterPathCache();
    saveProgress();
    // iter 45: review badge depends on path scope — refresh after toggle.
    updateReviewBadge();
    renderSidebar();
    // If toggling ON and current lesson isn't in the path, jump to next un-mastered in path
    if (state.starterPath && !getActiveStarterPath().includes(state.currentLessonId)) {
      const next = starterPathNextId();
      if (next) { selectLesson(next); return; }
    }
    // Toggled but stayed on the same lesson — re-render so the path-step
    // pill in the header reflects the new state.
    if (state.currentLessonId) renderLesson();
  });

  // Weak-spot button — jump to the lesson with the most L1 misses
  document.getElementById('weak-btn').addEventListener('click', () => {
    const id = topWeakLessonId();
    if (id) navToLesson(id, { tab: 'L1' });
  });

  // iter 65: 💀 Resurrect — jump to most-overdue mastered lesson at L1.
  // On touch devices land on L2 (mirror Review-button pattern); on fine
  // pointer land on L3 — same recall calibration the SR ladder uses.
  document.getElementById('resurrect-btn').addEventListener('click', () => {
    const ids = resurrectIds();
    if (!ids.length) return;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    navToLesson(ids[0], { tab: coarse ? 'L2' : 'L3', updateHash: true, collapseMobile: true });
  });

  // iter 94: 🧠 Bridge — route to a cross-track transfer-gap lesson. Picks
  // the first candidate from `_bridgeCandidates()` (one per gap-mechanic,
  // deterministic by MECHANIC_INDEX iteration order). Lands on L1 with a
  // 2.2-sec fuchsia toast prefacing the transfer context. Closes iter-90
  // roadmap #3 (the last queued entry).
  document.getElementById('bridge-btn')?.addEventListener('click', () => {
    const candidates = _bridgeCandidates();
    if (!candidates.length) return;
    const pick = candidates[0];
    navToLesson(pick.targetLessonId, { tab: 'L1', updateHash: true, collapseMobile: true });
    _showBridgeToast(pick);
  });

  document.getElementById('reveal-replay-btn').addEventListener('click', () => {
    const queue = _revealedQueue();
    if (!queue.length) return;
    // Drop the current lesson's reveal tracker BEFORE routing so the user
    // gets a clean attempt window on arrival (lets the clean-pass invariant
    // fire even if they were just on this lesson). Also drop the arriving
    // lesson's tracker so a stale flag doesn't pre-mark the new attempt.
    if (state.currentLessonId) delete _revealedInCurrentAttempt[state.currentLessonId];
    const next = queue[0];
    delete _revealedInCurrentAttempt[next.lessonId];
    navToLesson(next.lessonId, { tab: next.level, updateHash: true, collapseMobile: true });
  });
}

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
      searchInput.focus();
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
      const modals = ['help-modal', 'today-modal', 'stats-modal', 'mechanics-modal', 'cheatsheet-modal', 'path-modal', 'at-risk-modal', 'streak-map-modal', 'heatstrip-modal'];
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
//  MOBILE DRAWER — hamburger + backdrop
// ──────────────────────────────────────────────────────────────────────────
function initMobileDrawer() {
  document.getElementById('hamburger').addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
  });
  document.getElementById('sidebar-backdrop').addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  AT-RISK MODAL — decay-radar union of dueAt + weakness + revealed flags
// ──────────────────────────────────────────────────────────────────────────
function initAtRiskModal() {
  // iter 60: 📡 At Risk — opens decay-radar modal with union-of-3-signals
  // list. Closes iter-59 roadmap entry #1. The modal lists up to 7 rows;
  // each row is tap-to-jump to that lesson at the appropriate tab.
  const atRiskModal = document.getElementById('at-risk-modal');
  function openAtRisk() {
    const rows = _atRiskRows(7);
    const body = document.getElementById('at-risk-body');
    if (!rows.length) {
      body.innerHTML = `<div style="color:#94a3b8;text-align:center;padding:24px 0;">All clear — no wobbly or revealed lessons! 🎉</div>`;
    } else {
      // iter 33 (refine): urgency-shape inventory above the cards. ADHD/phone
      // user sees the distribution upfront ("2 DUE NOW · 1 SOON · 1 NO-SR")
      // instead of constructing it from per-card pills. Only non-zero buckets
      // render. Same iter-21/iter-28/iter-30 section-divider hex palette as
      // the codebase's other in-context inventory rows (iter-22 today-plan).
      const dueNow = rows.filter(r => r.isDue).length;
      const soon   = rows.filter(r => !r.isDue && r.daysTilDue !== null).length;
      const noSr   = rows.filter(r => r.daysTilDue === null).length;
      const invParts = [];
      if (dueNow) invParts.push(`<span style="color:#fca5a5;">${dueNow} DUE NOW</span>`);
      if (soon)   invParts.push(`<span style="color:#fdba74;">${soon} SOON</span>`);
      if (noSr)   invParts.push(`<span style="color:#94a3b8;">${noSr} NO-SR</span>`);
      const inventoryHtml = invParts.length >= 1
        ? `<div data-at-risk-inventory style="display:flex;gap:10px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:12px;padding:6px 0 6px 10px;border-left:2px solid rgba(165,180,252,0.4);color:#a5b4fc;">${invParts.join(`<span style="color:#475569;">·</span>`)}</div>`
        : '';
      body.innerHTML = inventoryHtml + rows.map(r => {
        const dueChip = r.isDue
          ? `<span style="color:#fca5a5; font-size:11px; background:rgba(248,113,113,0.12); border:1px solid rgba(248,113,113,0.3); border-radius:999px; padding:2px 8px; font-weight:600;">DUE NOW</span>`
          : r.daysTilDue !== null
            ? `<span style="color:#fdba74; font-size:11px; background:rgba(251,146,60,0.12); border:1px solid rgba(251,146,60,0.3); border-radius:999px; padding:2px 8px;">in ${r.daysTilDue}d</span>`
            : `<span style="color:#64748b; font-size:11px;">no SR</span>`;
        const missBadge = r.weaknessCount > 0
          ? `<span style="color:#fdba74; font-size:11px;">⚠ ${r.weaknessCount}×</span>`
          : '';
        const revealDot = r.revealedLevels.length > 0
          ? `<span style="color:#e9d5ff; font-size:11px; background:rgba(192,132,252,0.12); border:1px solid rgba(192,132,252,0.3); border-radius:999px; padding:2px 8px;" title="Mastered with reveal — drill clean to clear">🃏 ${escapeHtml(r.revealedLevels.join('+'))}</span>`
          : '';
        return `<button data-lesson-id="${escapeHtml(r.lessonId)}" style="text-align:left; padding:12px 14px; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#e2e8f0; cursor:pointer; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span style="font-size:14px; font-weight:500; color:#e2e8f0;">${escapeHtml(r.title)}</span>
            ${dueChip}
          </div>
          <div style="display:flex; gap:8px; align-items:center; font-size:11px; color:#94a3b8;">
            <span>${escapeHtml(r.section)}</span>
            ${missBadge ? `<span style="color:#475569;">·</span>${missBadge}` : ''}
            ${revealDot ? `<span style="color:#475569;">·</span>${revealDot}` : ''}
          </div>
        </button>`;
      }).join('');
      body.querySelectorAll('[data-lesson-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-lesson-id');
          atRiskModal.style.display = 'none';
          selectLesson(id);
        });
      });
    }
    atRiskModal.style.display = 'block';
  }
  document.getElementById('at-risk-btn').addEventListener('click', openAtRisk);
  document.getElementById('at-risk-close').addEventListener('click', () => atRiskModal.style.display = 'none');
  atRiskModal.addEventListener('click', (e) => {
    if (e.target === atRiskModal) atRiskModal.style.display = 'none';
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  STREAK MAP MODAL — 60-day calendar density heatmap
// ──────────────────────────────────────────────────────────────────────────
function initStreakMapModal() {
  // iter 62: 📅 Streak Map — 60-day calendar density heatmap. Closes iter-59
  // roadmap entry #3. The modal renders a 9-column grid of 60 day-cells
  // (oldest top-left → today bottom-right with empty padding cells where
  // 60 doesn't fill a 9-col row evenly). Cell color depth reflects events
  // that day; tooltip below the grid shows date + breakdown on hover/tap.
  // Read-only v1 — no day-tap filter (deferred to a future iter if useful).
  const streakMapModal = document.getElementById('streak-map-modal');
  function openStreakMap() {
    const buckets = _streakMapBuckets(60);
    const max = buckets.reduce((m, b) => Math.max(m, b.total), 0);
    const grid = document.getElementById('streak-map-grid');
    const tooltip = document.getElementById('streak-map-tooltip');
    const legend = document.getElementById('streak-map-legend');
    // 5-tier color scale based on relative density (no absolute thresholds —
    // a user with 50 events/day max gets a different scale than one with 5).
    const tier = (count) => {
      if (count === 0) return 0;
      if (max <= 1) return count > 0 ? 4 : 0;
      const pct = count / max;
      if (pct < 0.25) return 1;
      if (pct < 0.5) return 2;
      if (pct < 0.75) return 3;
      return 4;
    };
    const tierColors = ['#1e293b', '#064e3b', '#065f46', '#10b981', '#34d399'];
    const tierTitles = ['none', 'light', 'medium', 'heavy', 'peak'];
    grid.innerHTML = buckets.map((b, idx) => {
      const t = tier(b.total);
      return `<button class="streak-cell" data-streak-idx="${idx}" type="button" title="${escapeHtml(b.dateLabel)} · ${b.total} event${b.total === 1 ? '' : 's'}" aria-label="${escapeHtml(b.dateLabel)}: ${b.total} events" style="aspect-ratio: 1; background: ${tierColors[t]}; border: 1px solid #0f172a; border-radius: 3px; cursor: ${b.total > 0 ? 'pointer' : 'default'}; padding: 0;"></button>`;
    }).join('');
    // Legend swatches.
    legend.innerHTML = `<span>Less</span>` + tierColors.map((c, i) => `<span style="display:inline-block; width:12px; height:12px; background:${c}; border:1px solid #0f172a; border-radius:3px;" title="${tierTitles[i]}"></span>`).join('') + `<span>More</span>`;
    // Default tooltip: total events this window.
    const totalAll = buckets.reduce((s, b) => s + b.total, 0);
    const activeDays = buckets.filter(b => b.total > 0).length;
    tooltip.innerHTML = totalAll > 0
      ? `<strong style="color:#cbd5e1;">${totalAll}</strong> events across <strong style="color:#cbd5e1;">${activeDays}</strong> of 60 days. Hover a cell for that day's detail.`
      : `<span style="color:#475569;">No history yet — drill anything to start the map.</span>`;
    // Per-cell hover/tap: replace the tooltip with that day's detail.
    grid.querySelectorAll('[data-streak-idx]').forEach(cell => {
      const detail = (e) => {
        const b = buckets[+cell.dataset.streakIdx];
        if (b.total === 0) {
          tooltip.innerHTML = `<span style="color:#475569;">${escapeHtml(b.dateLabel)} — no activity</span>`;
        } else {
          tooltip.innerHTML = `<strong style="color:#cbd5e1;">${escapeHtml(b.dateLabel)}</strong> · ${b.total} event${b.total === 1 ? '' : 's'} · <span style="color:#34d399;">${b.passes} pass</span>${b.misses > 0 ? ` · <span style="color:#f87171;">${b.misses} miss</span>` : ''}`;
        }
      };
      cell.addEventListener('mouseenter', detail);
      cell.addEventListener('click', detail);
    });
    streakMapModal.style.display = 'block';
  }
  document.getElementById('streak-map-btn').addEventListener('click', openStreakMap);
  document.getElementById('streak-map-close').addEventListener('click', () => streakMapModal.style.display = 'none');
  streakMapModal.addEventListener('click', (e) => {
    if (e.target === streakMapModal) streakMapModal.style.display = 'none';
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  HEATSTRIP — 30-minute activity timeline + modal + auto-tick
// ──────────────────────────────────────────────────────────────────────────
function initHeatstrip() {
  // iter 107: ⏱ Session Heatstrip — sidebar-top 4px activity timeline.
  // renderHeatstrip rebuilds the 30 minute-cells from state.history and
  // toggles the wrap visibility based on whether any non-idle cell exists.
  // Auto-hide on cold-start / no-recent-activity keeps the strip from
  // appearing as decoration before the user has done anything.
  const heatstripWrap = document.getElementById('heatstrip-wrap');
  const heatstripGrid = document.getElementById('heatstrip');
  const heatstripModal = document.getElementById('heatstrip-modal');
  window.renderHeatstrip = function renderHeatstrip() {
    if (!heatstripWrap || !heatstripGrid) return;
    const cells = _heatstripCells(HEATSTRIP_LOOKBACK_MIN);
    const hasActivity = cells.some(c => c.kind !== 'idle');
    if (!hasActivity) {
      heatstripWrap.hidden = true;
      heatstripGrid.innerHTML = '';
      return;
    }
    heatstripWrap.hidden = false;
    heatstripGrid.innerHTML = cells.map(c => {
      const minLabel = c.minutesAgo === 0 ? 'now' : `${c.minutesAgo}m ago`;
      const evLabel = c.kind === 'idle' ? 'no activity' : c.kind.toUpperCase();
      return `<span class="heatstrip-cell ${c.kind}" aria-hidden="true" title="${minLabel} · ${evLabel}${c.count > 1 ? ` (${c.count} events)` : ''}"></span>`;
    }).join('');
  };
  function openHeatstripModal() {
    const sum = _heatstripSessionSummary();
    const body = document.getElementById('heatstrip-modal-body');
    if (!body) return;
    if (!sum.eventCount) {
      body.innerHTML = `<div style="color:#64748b;">No session active. Tap any lesson to start.</div>`;
    } else {
      const minLabel = sum.minActive === 1 ? '1 minute' : `${sum.minActive} minutes`;
      const lessLabel = sum.lessonsTouched === 1 ? '1 lesson' : `${sum.lessonsTouched} lessons`;
      const passLabel = sum.passes === 1 ? '1 pass' : `${sum.passes} passes`;
      const missLine = sum.missCount > 0
        ? `<div><span style="color:#94a3b8;">L1 misses recorded:</span> <span style="color:#cbd5e1;">${sum.missCount}</span></div>`
        : '';
      body.innerHTML = `
        <div><span style="color:#94a3b8;">Active for:</span> <span style="color:#cbd5e1;">${minLabel}</span></div>
        <div><span style="color:#94a3b8;">Lessons touched:</span> <span style="color:#cbd5e1;">${lessLabel}</span></div>
        <div><span style="color:#94a3b8;">Passes (L1+L2+L3):</span> <span style="color:#cbd5e1;">${passLabel}</span></div>
        ${missLine}
      `;
    }
    heatstripModal.style.display = 'block';
  }
  if (heatstripWrap) {
    heatstripWrap.addEventListener('click', openHeatstripModal);
    heatstripWrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openHeatstripModal(); }
    });
  }
  document.getElementById('heatstrip-close')?.addEventListener('click', () => heatstripModal.style.display = 'none');
  heatstripModal?.addEventListener('click', (e) => {
    if (e.target === heatstripModal) heatstripModal.style.display = 'none';
  });
  // Initial render on boot (show recent activity from a prior session in the
  // last 30 min) + a slow tick so the strip ages out without requiring a new
  // event. 60-sec interval matches the cell-grain — never refreshes mid-cell.
  renderHeatstrip();
  setInterval(renderHeatstrip, HEATSTRIP_MINUTE_MS);
}

// ──────────────────────────────────────────────────────────────────────────
//  STATS MODAL — track balance, drill lifetime tiles, retention, mock PBs
// ──────────────────────────────────────────────────────────────────────────
function initStatsModal() {
  // Stats modal
  const statsModal = document.getElementById('stats-modal');
  function openStats() {
    const fullLessons = CURRICULUM.filter(l => l.status === 'full');
    const mastered = fullLessons.filter(l => lessonOverallStatus(l.id) === 'mastered').length;
    const inProgress = fullLessons.filter(l => lessonOverallStatus(l.id) === 'in_progress').length;
    const notStarted = fullLessons.length - mastered - inProgress;
    const due = dueReviewIds().length;
    const weakCount = Object.keys(state.weakness).length;
    const bestTimesEntries = Object.entries(state.bestTimes);
    const totalMockMs = bestTimesEntries.reduce((s, [,ms]) => s + ms, 0);
    const avgMockMs = bestTimesEntries.length ? Math.floor(totalMockMs / bestTimesEntries.length) : 0;
    const tally = (track) => ({
      mastered: CURRICULUM.filter(l => l.track === track && lessonOverallStatus(l.id) === 'mastered').length,
      total:    CURRICULUM.filter(l => l.track === track).length,
    });
    const syntaxStats   = tally('syntax');
    const patternsStats = tally('patterns');
    const appliedStats  = tally('applied');

    // iter 66: Track Balance Compass — 3-bar widget showing % mastered per
    // track + a one-line nudge naming the least-covered. Closes iter-64
    // roadmap #3 (constraint-aware B#5 — allocation balance across track
    // axis). Pure tally over progress × manifest.track; zero new state.
    const compassRows = [
      { id: 'syntax',   label: 'Syntax',   color: '#67e8f9', ...syntaxStats },
      { id: 'patterns', label: 'Pattern',  color: '#a78bfa', ...patternsStats },
      { id: 'applied',  label: 'Applied',  color: '#fbcfe8', ...appliedStats }
    ].map(r => ({ ...r, pct: r.total > 0 ? Math.round((r.mastered / r.total) * 100) : 0 }));
    const leastCovered = compassRows.filter(r => r.total > 0).sort((a, b) => a.pct - b.pct)[0];
    const compassNudge = leastCovered
      ? `<div style="font-size:11px; color:#94a3b8; margin-top:6px;">Least covered: <strong style="color:${leastCovered.color};">${escapeHtml(leastCovered.label)}</strong> · ${leastCovered.mastered}/${leastCovered.total} (${leastCovered.pct}%)</div>`
      : '';
    const compassHtml = `
      <div style="margin-bottom: 14px; padding: 12px 14px; background: #0f172a; border: 1px solid #1e293b; border-radius: 8px;">
        <div style="font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">🧭 Track Balance</div>
        ${compassRows.map(r => `
          <div style="display:grid; grid-template-columns: 70px 1fr 70px; gap:8px; align-items:center; padding:3px 0;">
            <span style="font-size:12px; color:${r.color}; font-weight:600;">${escapeHtml(r.label)}</span>
            <div style="height:8px; background:#1e293b; border-radius:4px; overflow:hidden;">
              <div style="width:${r.pct}%; height:100%; background:${r.color};"></div>
            </div>
            <span style="font-size:11px; color:#94a3b8; font-variant-numeric:tabular-nums; text-align:right;">${r.mastered}/${r.total} · ${r.pct}%</span>
          </div>
        `).join('')}
        ${compassNudge}
      </div>
    `;

    document.getElementById('stats-body').innerHTML = `${compassHtml}
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="background: #1e293b; padding: 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Mastered</div>
          <div style="font-size: 28px; color: #10b981; font-weight: 700;">${mastered} / ${fullLessons.length}<span style="font-size: 14px; color: #6ee7b7; font-weight: 500; margin-left: 6px;">· ${fullLessons.length ? Math.round(mastered / fullLessons.length * 100) : 0}%</span></div>
        </div>
        <div style="background: #1e293b; padding: 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">In Progress</div>
          <div style="font-size: 28px; color: #f59e0b; font-weight: 700;">${inProgress}</div>
        </div>
      </div>
      <div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
        <div data-track-stat="syntax" style="background: #1e293b; padding: 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Syntax</div>
          <div style="font-size: 22px; color: #93c5fd; font-weight: 700;">${syntaxStats.mastered} / ${syntaxStats.total}</div>
        </div>
        <div data-track-stat="patterns" style="background: #1e293b; padding: 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Patterns</div>
          <div style="font-size: 22px; color: #c4b5fd; font-weight: 700;">${patternsStats.mastered} / ${patternsStats.total}</div>
        </div>
        <div data-track-stat="applied" style="background: #1e293b; padding: 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Applied</div>
          <div style="font-size: 22px; color: #fcd34d; font-weight: 700;">${appliedStats.mastered} / ${appliedStats.total}</div>
        </div>
      </div>
      <div style="margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 12px;">
        <div style="background: rgba(34,211,238,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(34,211,238,0.2);">
          <div style="color: #94a3b8;">Due for review</div>
          <div style="color: #67e8f9; font-size: 18px; font-weight: 600;">${due}</div>
        </div>
        <div style="background: rgba(251,146,60,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(251,146,60,0.2);">
          <div style="color: #94a3b8;">Weak spots</div>
          <div style="color: #fdba74; font-size: 18px; font-weight: 600;">${weakCount}</div>
        </div>
        <div style="background: rgba(244,114,182,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(244,114,182,0.2);">
          <div style="color: #94a3b8;">Avg mock time</div>
          <div style="color: #fbcfe8; font-size: 18px; font-weight: 600;">${avgMockMs ? formatTime(avgMockMs) : '—'}</div>
        </div>
      </div>
      ${(state.recognize?.attempts || 0) > 0 ? `
        <div style="margin-top: 8px;">
          <div style="background: rgba(251,191,36,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(251,191,36,0.2); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="color: #94a3b8; font-size: 12px;">🔎 Recognize lifetime <span style="color: #64748b; font-weight: 400;">(incl. 🎯 Reverse)</span></div>
              <div style="color: #fcd34d; font-size: 16px; font-weight: 600; margin-top: 2px;">${state.recognize.correct} / ${state.recognize.attempts} <span style="color: #94a3b8; font-size: 12px; font-weight: 400;">(${Math.round(state.recognize.correct / state.recognize.attempts * 100)}%)</span></div>
            </div>
            <button data-action="open-recognize-from-stats" style="background: rgba(251,191,36,0.16); color: #fcd34d; border: 1px solid rgba(251,191,36,0.4); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer;">Drill →</button>
          </div>
        </div>
      ` : ''}
      ${(state.gotcha?.attempts || 0) > 0 ? `
        <div style="margin-top: 8px;">
          <div style="background: rgba(244,114,182,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(244,114,182,0.25); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="color: #94a3b8; font-size: 12px;">🎰 Gotcha lifetime <span style="color: #64748b; font-weight: 400;">(reference.notes recall)</span></div>
              <div style="color: #fbcfe8; font-size: 16px; font-weight: 600; margin-top: 2px;">${state.gotcha.correct} / ${state.gotcha.attempts} <span style="color: #94a3b8; font-size: 12px; font-weight: 400;">(${Math.round(state.gotcha.correct / state.gotcha.attempts * 100)}%)</span></div>
            </div>
            <button data-action="open-gotcha-from-stats" style="background: rgba(244,114,182,0.16); color: #fbcfe8; border: 1px solid rgba(244,114,182,0.4); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer;">Spin →</button>
          </div>
        </div>
      ` : ''}
      ${(state.claim?.attempts || 0) > 0 ? `
        <div style="margin-top: 8px;">
          <div style="background: rgba(20,184,166,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(20,184,166,0.25); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="color: #94a3b8; font-size: 12px;">📐 Claim lifetime <span style="color: #64748b; font-weight: 400;">(smell-test complexity)</span></div>
              <div style="color: #5eead4; font-size: 16px; font-weight: 600; margin-top: 2px;">${state.claim.correct} / ${state.claim.attempts} <span style="color: #94a3b8; font-size: 12px; font-weight: 400;">(${Math.round(state.claim.correct / state.claim.attempts * 100)}%)</span></div>
            </div>
            <button data-action="open-claim-from-stats" style="background: rgba(20,184,166,0.16); color: #5eead4; border: 1px solid rgba(20,184,166,0.4); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer;">Spin →</button>
          </div>
        </div>
      ` : ''}
      ${(state.crystal?.attempts || 0) > 0 ? `
        <div style="margin-top: 8px;">
          <div style="background: rgba(168,85,247,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(168,85,247,0.25); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="color: #94a3b8; font-size: 12px;">🔮 Predict lifetime <span style="color: #64748b; font-weight: 400;">(mental-execution)</span></div>
              <div style="color: #d8b4fe; font-size: 16px; font-weight: 600; margin-top: 2px;">${state.crystal.correct} / ${state.crystal.attempts} <span style="color: #94a3b8; font-size: 12px; font-weight: 400;">(${Math.round(state.crystal.correct / state.crystal.attempts * 100)}%)</span></div>
            </div>
            <button data-action="open-crystal-from-stats" style="background: rgba(168,85,247,0.16); color: #d8b4fe; border: 1px solid rgba(168,85,247,0.4); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer;">Predict →</button>
          </div>
        </div>
      ` : ''}
      ${(state.bugHunt?.attempts || 0) > 0 ? `
        <div style="margin-top: 8px;">
          <div style="background: rgba(103,232,249,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(103,232,249,0.25); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="color: #94a3b8; font-size: 12px;">🪲 Bug-Hunt lifetime <span style="color: #64748b; font-weight: 400;">(spot the operator flip)</span></div>
              <div style="color: #67e8f9; font-size: 16px; font-weight: 600; margin-top: 2px;">${state.bugHunt.correct} / ${state.bugHunt.attempts} <span style="color: #94a3b8; font-size: 12px; font-weight: 400;">(${Math.round(state.bugHunt.correct / state.bugHunt.attempts * 100)}%)</span></div>
            </div>
            <button data-action="open-bughunt-from-stats" style="background: rgba(103,232,249,0.16); color: #67e8f9; border: 1px solid rgba(103,232,249,0.4); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer;">Hunt →</button>
          </div>
        </div>
      ` : ''}
      ${(() => {
        // iter 101: 🎯 Self-rescue rate tile. Aggregates L3-pass events across
        // all lessons, counts ones that completed with zero hints used. First
        // surface that measures QUALITY-OF-PASS (not pass/fail). Closes the
        // iter-37 deferred metric. Hidden when no L3-pass history yet so the
        // tile stays quiet for users new to L3.
        const sr = _selfRescueRateGlobal();
        if (sr.total === 0) return '';
        const tone = sr.rate >= 70 ? '#86efac' : sr.rate >= 40 ? '#fcd34d' : '#fdba74';
        const borderTone = sr.rate >= 70 ? 'rgba(134,239,172,0.3)' : sr.rate >= 40 ? 'rgba(252,211,77,0.3)' : 'rgba(253,186,116,0.3)';
        const bgTone = sr.rate >= 70 ? 'rgba(134,239,172,0.08)' : sr.rate >= 40 ? 'rgba(252,211,77,0.08)' : 'rgba(253,186,116,0.08)';
        return `
        <div style="margin-top: 8px;">
          <div style="background: ${bgTone}; padding: 10px; border-radius: 6px; border: 1px solid ${borderTone};">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="color: #94a3b8; font-size: 12px;">🎯 Self-rescue rate <span style="color: #64748b; font-weight: 400;">(zero-hint L3 passes)</span></div>
                <div style="color: ${tone}; font-size: 16px; font-weight: 600; margin-top: 2px;">${sr.zeroHint} / ${sr.total} <span style="color: #94a3b8; font-size: 12px; font-weight: 400;">(${sr.rate}%)</span></div>
              </div>
            </div>
            <div style="color: #64748b; font-size: 10px; margin-top: 4px;">since you started L3 drilling — hint events captured per attempt</div>
          </div>
        </div>
        `;
      })()}
      ${(() => {
        // iter 58: Mistake Tagging top-5 tile. Only renders when the user
        // has tagged ≥1 miss — keeps Stats quiet for users who never opt in.
        const top = _aggregateMissTags(5);
        if (!top.length) return '';
        const total = top.reduce((s, r) => s + r.count, 0);
        return `
        <div style="margin-top: 8px;">
          <div style="background: rgba(192,132,252,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(192,132,252,0.2);">
            <div style="color: #94a3b8; font-size: 12px; margin-bottom: 6px;">🏷 Top miss patterns <span style="color: #64748b; font-weight: 400;">(${total} tagged)</span></div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${top.map(row => `<span style="background: rgba(192,132,252,0.15); color: #e9d5ff; border: 1px solid rgba(192,132,252,0.3); border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 500;">${escapeHtml(row.label)} <span style="color: #a78bfa; margin-left: 2px;">×${row.count}</span></span>`).join('')}
            </div>
          </div>
        </div>
        `;
      })()}
      ${(() => {
        // iter 106: 📈 Mastery Half-Life tile. Per-lesson longitudinal SR
        // signal — buckets each lesson's median L3-pass gap into Sticky /
        // Normal / Slippery. Tap-routed top-5 slippery lessons list lets
        // the user jump straight to "what's slipping." Hidden when no
        // lesson has ≥2 L3-passes yet (graceful empty state).
        const hl = _masteryHalfLife(5);
        const total = hl.sticky + hl.normal + hl.slippery;
        if (total === 0) return '';
        const fmtGap = (ms) => {
          const days = ms / HALF_LIFE_DAY_MS;
          if (days < 1) return `${Math.round(days * 24)}h`;
          if (days < 14) return `${days.toFixed(1)}d`;
          return `${Math.round(days)}d`;
        };
        return `
        <div style="margin-top: 8px;">
          <div style="background: rgba(125,211,252,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(125,211,252,0.2);">
            <div style="color: #94a3b8; font-size: 12px; margin-bottom: 6px;">📈 Mastery Half-Life <span style="color: #64748b; font-weight: 400;">(${total} lesson${total === 1 ? '' : 's'} with ≥2 L3 passes)</span></div>
            <div class="half-life-buckets">
              <div class="half-life-bucket"><span class="half-life-dot sticky"></span><span class="half-life-label">Sticky</span><span class="half-life-count">${hl.sticky}</span><span class="half-life-range">&gt;${HALF_LIFE_STICKY_DAYS}d</span></div>
              <div class="half-life-bucket"><span class="half-life-dot normal"></span><span class="half-life-label">Normal</span><span class="half-life-count">${hl.normal}</span><span class="half-life-range">${HALF_LIFE_NORMAL_DAYS}-${HALF_LIFE_STICKY_DAYS}d</span></div>
              <div class="half-life-bucket"><span class="half-life-dot slippery"></span><span class="half-life-label">Slippery</span><span class="half-life-count">${hl.slippery}</span><span class="half-life-range">&lt;${HALF_LIFE_NORMAL_DAYS}d</span></div>
            </div>
            ${hl.slipperyList.length ? `
              <div class="half-life-list">
                <div class="half-life-list-header">Top slippery — tap to drill</div>
                ${hl.slipperyList.map(row => {
                  const lesson = findLesson(row.lessonId);
                  if (!lesson) return '';
                  return `<div class="half-life-row" data-action="open-slippery" data-lesson-id="${escapeHtml(row.lessonId)}"><span class="half-life-row-title">${escapeHtml(lesson.title)}</span><span class="half-life-row-gap">${fmtGap(row.medianGapMs)}</span></div>`;
                }).join('')}
              </div>
            ` : ''}
            <div style="color: #64748b; font-size: 10px; margin-top: 6px;">since you started L3 drilling — median gap between consecutive passes</div>
          </div>
        </div>
        `;
      })()}
      ${_renderSectionRetentionBlock(14)}
      ${state.calibrateOn === false ? `
        <div data-calibration-hint style="margin-top: 18px; padding: 10px 12px; background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.3); border-radius: 8px; font-size: 12px; color: #fde68a; line-height: 1.5;">
          💡 <strong>⏱ Calibration</strong> not tracking yet — turn on from <strong>⚙️ Settings → ⏱ Calibrate</strong> to log your time-to-solve per mechanic and see your top miscalibrated patterns here.
        </div>
      ` : ''}
      ${_renderCalibrationTile()}
      ${_renderTimeInvestedTile()}
      ${bestTimesEntries.length ? `
        <div style="margin-top: 18px;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Mock interview personal bests</div>
          <div style="max-height: 200px; overflow-y: auto; font-family: 'SF Mono', monospace; font-size: 12px;">
            ${bestTimesEntries
              .sort((a, b) => a[1] - b[1])
              .map(([id, ms]) => {
                const l = findLesson(id);
                return `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #1e293b;"><span style="color: #cbd5e1;">${escapeHtml(l?.title || id)}</span><span style="color: #fbcfe8;">${formatTime(ms)}</span></div>`;
              }).join('')}
          </div>
        </div>
      ` : ''}
      <div style="margin-top: 16px; text-align: center; color: #64748b; font-size: 11px;">Streak this session: ${state.streak}</div>
    `;
    // iter 51: wire the Recognize Drill-from-Stats button (only present when lifetime attempts > 0).
    document.getElementById('stats-body').querySelector('[data-action="open-recognize-from-stats"]')?.addEventListener('click', () => {
      statsModal.style.display = 'none';
      startRecognizeSession();
    });
    // iter 84: wire the Gotcha + Claim Drill-from-Stats buttons (only present when lifetime > 0).
    document.getElementById('stats-body').querySelector('[data-action="open-gotcha-from-stats"]')?.addEventListener('click', () => {
      statsModal.style.display = 'none';
      startGotchaSession();
    });
    document.getElementById('stats-body').querySelector('[data-action="open-claim-from-stats"]')?.addEventListener('click', () => {
      statsModal.style.display = 'none';
      startClaimSession();
    });
    // iter 85: Crystal + Bug-Hunt Drill-from-Stats buttons. Same pattern.
    document.getElementById('stats-body').querySelector('[data-action="open-crystal-from-stats"]')?.addEventListener('click', () => {
      statsModal.style.display = 'none';
      startCrystalSession();
    });
    document.getElementById('stats-body').querySelector('[data-action="open-bughunt-from-stats"]')?.addEventListener('click', () => {
      statsModal.style.display = 'none';
      startBugHuntSession();
    });
    // iter 106: 📈 Mastery Half-Life — wire each slippery-list row to deep-link
    // to its lesson. Each row carries data-lesson-id; selectLesson handles the
    // rest (default tab = Reference, so the user lands on the canonical they
    // need to re-encode before re-attempting L3).
    document.getElementById('stats-body').querySelectorAll('[data-action="open-slippery"]').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-lesson-id');
        if (!id) return;
        statsModal.style.display = 'none';
        selectLesson(id);
      });
    });
    statsModal.style.display = 'block';
  }
  document.getElementById('stats-btn').addEventListener('click', openStats);
  document.getElementById('stats-close').addEventListener('click', () => statsModal.style.display = 'none');
  statsModal.addEventListener('click', (e) => {
    if (e.target === statsModal) statsModal.style.display = 'none';
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  TODAY'S PLAN MODAL — daily plan view, cram-day routing, topbar progress click
// ──────────────────────────────────────────────────────────────────────────
function initTodaysPlanModal() {
  // Today's plan modal
  const todayModal = document.getElementById('today-modal');
  function openToday() {
    const plan = dailyPlan();
    const body = document.getElementById('today-body');
    if (!plan.length) {
      body.innerHTML = `<div style="color:#94a3b8;text-align:center;padding:24px 0;">Nothing queued — you're caught up! 🎉<br><br>Pick a lesson from the sidebar or try Mock Interview.</div>`;
    } else {
      // Iter 10: PRIMARY autopilot CTA. Surfaces the smartest pick (plan[0]
      // — dailyPlan ranks SR-due first, then weak, then path) as a single
      // emerald button above the 6-card list. PROFILE.md line 76-78 ("press
      // one thing → drilling") + line 48-50 (ADHD single-focus surfaces) +
      // line 53-54 ("Default actions matter more than option exhaustiveness").
      const first = plan[0];
      const firstLesson = findLesson(first.id);
      const firstTitle = firstLesson?.title || first.id;
      // iter 22: inventory of today's session — converts the modal from
      // "unknown queue" to "named bundle" for the ADHD/phone user. Counts
      // are derived from plan[].why; only renders when ≥2 buckets are active
      // (a single-bucket plan's CTA tag already tells the story). Colors
      // match the per-card why-tag pills below for cross-visual consistency.
      const whyCounts = plan.reduce((acc, p) => { acc[p.why] = (acc[p.why] || 0) + 1; return acc; }, {});
      const invParts = [];
      if (whyCounts['review due']) invParts.push(`<span style="color:#67e8f9;">${whyCounts['review due']} due</span>`);
      if (whyCounts['weak spot'])  invParts.push(`<span style="color:#fdba74;">${whyCounts['weak spot']} weak</span>`);
      if (whyCounts['next on plan']) invParts.push(`<span style="color:#93c5fd;">${whyCounts['next on plan']} on path</span>`);
      const inventoryHtml = invParts.length >= 2
        ? `<div data-today-inventory style="display:flex;justify-content:center;gap:10px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;margin:-8px 0 10px;color:#94a3b8;">${invParts.join(`<span style="color:#475569;">·</span>`)}</div>`
        : '';
      const primaryCta = `
        <button data-action="start-first" data-lesson-id="${escapeHtml(first.id)}" style="text-align:left;width:100%;padding:14px 16px;border-radius:8px;background:rgba(52,211,153,0.14);border:1px solid rgba(52,211,153,0.55);color:#ecfdf5;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;font-family:inherit;margin-bottom:14px;">
          <span style="display:flex;flex-direction:column;gap:3px;min-width:0;">
            <span style="font-size:11px;color:#34d399;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">🎯 Start</span>
            <span style="font-size:15px;font-weight:600;color:#f0fdf4;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(firstTitle)}</span>
            <span style="font-size:11px;color:#86efac;">${escapeHtml(first.why)}</span>
          </span>
          <span style="color:#34d399;font-size:18px;flex-shrink:0;">➜</span>
        </button>
        ${inventoryHtml}
        <div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.08em;text-align:center;margin:0 0 8px;">— Or pick another —</div>
      `;
      body.innerHTML = primaryCta + plan.map(({ id, why }) => {
        const lesson = findLesson(id);
        const colors = { 'review due': '#67e8f9', 'next on plan': '#93c5fd', 'weak spot': '#fdba74' };
        const tint =   { 'review due': 'rgba(103,232,249,0.12)', 'next on plan': 'rgba(147,197,253,0.12)', 'weak spot': 'rgba(253,186,116,0.14)' };
        const tagColor = colors[why] || '#94a3b8';
        const tagBg = tint[why] || 'rgba(148,163,184,0.10)';
        // Stack title + why-tag vertically so the tag stays visible on mobile —
        // the prior `flex justify-between` row clipped long titles' tags off
        // the right edge on 375px viewports (PROFILE-stated 80% phone use).
        return `<button data-lesson-id="${escapeHtml(id)}" data-why="${escapeHtml(why)}" style="text-align:left; padding:12px 14px; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#e2e8f0; cursor:pointer; display:flex; flex-direction:column; align-items:stretch; gap:6px;">
          <span style="display:block;"><span style="color:#94a3b8; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; margin-right:8px;">${escapeHtml((TRACK_PILLS[lesson?.track] || TRACK_PILLS.patterns).label)}</span>${escapeHtml(lesson?.title || id)}</span>
          <span data-why-tag style="align-self:flex-start; color:${tagColor}; background:${tagBg}; font-size:11px; font-weight:500; padding:2px 8px; border-radius:999px; letter-spacing:0.01em;">${escapeHtml(why)}</span>
        </button>`;
      }).join('');
      // Iter 10: PRIMARY autopilot CTA click handler. The same data-lesson-id
      // selector catches BOTH the primary [data-action="start-first"] button
      // AND the existing 6-card list — both have data-lesson-id, so the
      // single forEach below wires them all.
      body.querySelectorAll('[data-lesson-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-lesson-id');
          todayModal.style.display = 'none';
          selectLesson(id);
        });
      });
    }
    todayModal.style.display = 'block';
  }
  function openCramToday(path) {
    const dayIdx = getCramDayIndex(path);
    if (dayIdx < 0) { openToday(); return; }
    const day = path.days[dayIdx];
    const totalDays = path.days.length;
    const heading = document.getElementById('today-heading');
    const sub = document.getElementById('today-sub');
    const body = document.getElementById('today-body');
    if (heading) heading.textContent = `⏱ Day ${dayIdx + 1} of ${totalDays} — ${day.title}`;
    if (sub) sub.textContent = `${day.date}. Tasks auto-tick when you master the linked lesson. Earlier-day lessons resurface below as SR comes due.`;

    let totalTasks = 0, doneTasks = 0;
    for (const b of day.blocks) for (const t of b.tasks) { totalTasks++; if (isCramTaskDone(t)) doneTasks++; }
    const pct = totalTasks ? Math.round(100 * doneTasks / totalTasks) : 0;

    const blocksHtml = day.blocks.map(block => {
      const blockDone = block.tasks.filter(isCramTaskDone).length;
      const blockTotal = block.tasks.length;
      const blockComplete = blockDone === blockTotal && blockTotal > 0;
      const tasksHtml = block.tasks.map(t => {
        const done = isCramTaskDone(t);
        const lesson = t.lessonId ? findLesson(t.lessonId) : null;
        const lessonTitle = lesson ? lesson.title : '';
        const minsBadge = t.mins != null ? `<span style="font-size:11px;color:#64748b;">~${t.mins} min</span>` : '';
        const checkAttr = t.lessonId ? 'disabled' : '';
        const checkTitle = t.lessonId ? 'Ticks automatically when you master the linked lesson' : 'Tap to mark done';
        const lessonBtn = t.lessonId
          ? `<button data-cram-open="${escapeHtml(t.lessonId)}" style="background:#1e293b;color:#67e8f9;border:none;border-radius:5px;padding:3px 9px;font-size:11px;cursor:pointer;font-weight:500;">Open →</button>`
          : '';
        const lessonBadge = lessonTitle ? `: <strong style="color:#e2e8f0;">${escapeHtml(lessonTitle)}</strong>` : '';
        return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-top:1px solid #1e293b;${done ? 'opacity:0.55;' : ''}">
          <input type="checkbox" data-cram-check="${escapeHtml(t.id)}" ${done ? 'checked' : ''} ${checkAttr} title="${escapeHtml(checkTitle)}" style="margin-top:3px;cursor:${t.lessonId ? 'default' : 'pointer'};" />
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;line-height:1.5;color:#cbd5e1;${done ? 'text-decoration:line-through;' : ''}">${escapeHtml(t.label)}${lessonBadge}</div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap;">${minsBadge}${lessonBtn}</div>
          </div>
        </div>`;
      }).join('');
      return `<details ${blockComplete ? '' : 'open'} style="background:#0b1220;border:1px solid #1e293b;border-radius:8px;margin-bottom:8px;">
        <summary style="padding:10px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;list-style:none;">
          <span style="display:flex;flex-direction:column;min-width:0;">
            <span style="font-size:14px;font-weight:600;color:#e2e8f0;">${escapeHtml(block.title)}</span>
            <span style="font-size:11px;color:#64748b;">${escapeHtml(block.duration || '')}</span>
          </span>
          <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;background:${blockComplete ? '#34d399' : '#1e293b'};color:${blockComplete ? '#0f172a' : '#cbd5e1'};font-variant-numeric:tabular-nums;flex-shrink:0;">${blockDone}/${blockTotal}</span>
        </summary>
        <div style="padding:0 14px 12px;">${tasksHtml}</div>
      </details>`;
    }).join('');

    const dueIds = dueReviewIds().slice(0, 6);
    const cramLessonSet = new Set(path.lessons || []);
    const reviewIds = dueIds.filter(id => cramLessonSet.has(id));
    const reviewHtml = reviewIds.length
      ? `<div style="margin-top:14px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#67e8f9;font-weight:600;margin-bottom:8px;">Review from earlier days · ${reviewIds.length} due</div>
          ${reviewIds.map(id => {
            const l = findLesson(id);
            return `<button data-cram-open="${escapeHtml(id)}" style="text-align:left;padding:10px 12px;border-radius:6px;background:#0b1220;border:1px solid #1e293b;color:#e2e8f0;cursor:pointer;display:flex;justify-content:space-between;align-items:center;width:100%;margin-bottom:6px;font-family:inherit;">
              <span style="font-size:13px;">${escapeHtml(l?.title || id)}</span>
              <span style="color:#67e8f9;font-size:11px;">SR due</span>
            </button>`;
          }).join('')}
        </div>`
      : '';

    const weakId = (typeof topWeakLessonId === 'function') ? topWeakLessonId() : null;
    const weakHtml = (weakId && !reviewIds.includes(weakId))
      ? (() => { const l = findLesson(weakId); return `<div style="margin-top:14px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#fdba74;font-weight:600;margin-bottom:8px;">Weak spot</div>
          <button data-cram-open="${escapeHtml(weakId)}" style="text-align:left;padding:10px 12px;border-radius:6px;background:#0b1220;border:1px solid #1e293b;color:#e2e8f0;cursor:pointer;display:flex;justify-content:space-between;align-items:center;width:100%;font-family:inherit;">
            <span style="font-size:13px;">${escapeHtml(l?.title || weakId)}</span>
            <span style="color:#fdba74;font-size:11px;">L1 miss</span>
          </button>
        </div>`; })()
      : '';

    const checkpointsHtml = (day.checkpoints && day.checkpoints.length)
      ? `<div style="margin-top:14px;background:#0b1220;border-left:3px solid #34d399;border-radius:8px;padding:12px 14px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#34d399;font-weight:600;margin-bottom:6px;">End-of-day checkpoints</div>
          <ul style="margin:0;padding-left:18px;color:#94a3b8;font-size:13px;line-height:1.5;">${day.checkpoints.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
        </div>`
      : '';

    body.innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="flex:1;height:8px;background:#1e293b;border-radius:4px;overflow:hidden;"><div style="height:100%;background:linear-gradient(90deg,#38bdf8,#34d399);width:${pct}%;border-radius:4px;"></div></div>
        <div style="font-size:12px;color:#94a3b8;font-variant-numeric:tabular-nums;min-width:60px;text-align:right;">${doneTasks}/${totalTasks} · ${pct}%</div>
      </div>
      ${blocksHtml}
      ${reviewHtml}
      ${weakHtml}
      ${checkpointsHtml}`;

    body.querySelectorAll('[data-cram-check]').forEach(cb => {
      cb.addEventListener('click', (e) => {
        const id = cb.getAttribute('data-cram-check');
        if (cb.disabled) { e.preventDefault(); return; }
        if (cb.checked) state.cramTaskChecks[id] = true;
        else delete state.cramTaskChecks[id];
        saveProgress();
        updateCramProgressStrip();
        openCramToday(path);
      });
    });
    body.querySelectorAll('[data-cram-open]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cram-open');
        todayModal.style.display = 'none';
        selectLesson(id);
      });
    });
    todayModal.style.display = 'block';
  }

  // Today's Plan routes by the subscribed study plan. A 'cram' path navigates
  // to the full Cram Home view (Phase 2); any other kind opens the modal.
  function openTodaysPlan() {
    const path = getSubscribedPath();
    if (path && path.kind === 'cram') {
      state.cramView = { mode: 'today', dayIndex: -1 };
      goToCramHome();
      return;
    }
    const heading = document.getElementById('today-heading');
    const sub = document.getElementById('today-sub');
    if (heading) heading.textContent = `📅 Today's session`;
    if (sub) sub.textContent = `Curated from your due reviews, starter path, and weak spots. Click any item to start.`;
    openToday();
  }
  document.getElementById('today-btn').addEventListener('click', openTodaysPlan);
  document.getElementById('today-close').addEventListener('click', () => todayModal.style.display = 'none');
  document.getElementById('topbar-cram-progress').addEventListener('click', () => openTodaysPlan());
  todayModal.addEventListener('click', (e) => {
    if (e.target === todayModal) todayModal.style.display = 'none';
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  PATH SWITCHER + CRAM REFS — path modal, sidebar curation, cram reference
//  modals (Cheat/Glossary/Behavior/Shapes/Review)
// ──────────────────────────────────────────────────────────────────────────
function initPathSwitcher() {
  // Path switcher — sidebar chip opens the modal; picking a path is handled
  // inside openPathModal (sets subscription, saves, updates chip, closes).
  const pathModal = document.getElementById('path-modal');
  document.getElementById('path-chip').addEventListener('click', openPathModal);
  document.getElementById('path-close').addEventListener('click', () => pathModal.style.display = 'none');
  pathModal.addEventListener('click', (e) => {
    if (e.target === pathModal) pathModal.style.display = 'none';
  });
  updatePathChip();
  applySidebarCuration();
  updateCramProgressStrip();

  // Phase 3 — cram reference modals
  const cramRefModal = document.getElementById('cram-ref-modal');
  document.getElementById('cram-cheat-btn')?.addEventListener('click', openCramCheatModal);
  document.getElementById('cram-glossary-btn')?.addEventListener('click', openCramGlossaryModal);
  document.getElementById('cram-behavior-btn')?.addEventListener('click', openCramBehaviorModal);
  document.getElementById('cram-shapes-btn')?.addEventListener('click', openCramShapesModal);
  document.getElementById('cram-review-btn')?.addEventListener('click', openCramReviewModal);
  document.getElementById('cram-ref-close')?.addEventListener('click', () => cramRefModal.style.display = 'none');
  cramRefModal?.addEventListener('click', (e) => { if (e.target === cramRefModal) cramRefModal.style.display = 'none'; });
  updateCramReviewCount();
}

// ──────────────────────────────────────────────────────────────────────────
//  MECHANICS MODAL WIRING — open/close/back + list/matrix view toggles
// ──────────────────────────────────────────────────────────────────────────
function initMechanicsWiring() {
  // Mechanics modal — cross-cutting drill surface
  const mechanicsModal = document.getElementById('mechanics-modal');
  document.getElementById('mechanics-btn').addEventListener('click', openMechanicsModal);
  document.getElementById('mechanics-close').addEventListener('click', closeMechanicsModal);
  document.getElementById('mechanics-back').addEventListener('click', () => {
    // iter 63: back button returns to whichever non-detail view was active
    // when the user dove into detail. Default 'list' for legacy users who
    // never visited matrix view.
    _mechanicsView = _mechanicsPrevView || 'list';
    _mechanicsSelectedId = null;
    renderMechanicsModal();
  });
  // iter 63: View-toggle handlers (List ↔ Matrix). Both also reset detail state
  // so a stale _mechanicsSelectedId doesn't leak between switches.
  document.getElementById('mechanics-view-list').addEventListener('click', () => {
    _mechanicsView = 'list';
    _mechanicsPrevView = 'list';
    _mechanicsSelectedId = null;
    renderMechanicsModal();
  });
  document.getElementById('mechanics-view-matrix').addEventListener('click', () => {
    _mechanicsView = 'matrix';
    _mechanicsPrevView = 'matrix';
    _mechanicsSelectedId = null;
    renderMechanicsModal();
  });
  mechanicsModal.addEventListener('click', (e) => {
    if (e.target === mechanicsModal) closeMechanicsModal();
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  HELP MODAL — close + backdrop (open is in the `?` keydown handler)
// ──────────────────────────────────────────────────────────────────────────
function initHelpModal() {
  // Help modal close (open is wired in the keydown handler with `?`)
  const helpModal = document.getElementById('help-modal');
  document.getElementById('help-close').addEventListener('click', () => helpModal.style.display = 'none');
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.style.display = 'none';
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  BACKUP / RESTORE — JSON download + file-input replace
// ──────────────────────────────────────────────────────────────────────────
function initBackupRestore() {
  // Backup — JSON download of all progress / reviews / bestTimes
  document.getElementById('backup-btn').addEventListener('click', () => {
    const raw = localStorage.getItem(LS_KEY) || JSON.stringify({ __v: 4, progress: state.progress });
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `js-drill-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Restore — read a JSON backup and replace localStorage
  document.getElementById('restore-btn').addEventListener('click', () => {
    document.getElementById('restore-input').click();
  });
  document.getElementById('restore-input').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        // Sanity-check the shape before writing
        if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid backup shape');
        if (!confirm('Restore this backup? Your current progress will be replaced.')) return;
        localStorage.setItem(LS_KEY, ev.target.result);
        alert('Backup restored. Reloading…');
        location.reload();
      } catch (err) {
        alert('Could not restore backup: ' + err.message);
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be picked again later
    e.target.value = '';
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  CHEATSHEET WIRING — overlay open/close, search, expand-all, PDF export
// ──────────────────────────────────────────────────────────────────────────
function initCheatsheetWiring() {
  // Cheatsheet — in-app quick-reference overlay (no download).
  const cheatsheetModal = document.getElementById('cheatsheet-modal');
  document.getElementById('export-btn').addEventListener('click', openCheatsheetModal);
  document.getElementById('cheatsheet-close').addEventListener('click', closeCheatsheetModal);
  cheatsheetModal.addEventListener('click', (e) => {
    if (e.target === cheatsheetModal) closeCheatsheetModal();
  });
  document.getElementById('cheatsheet-search').addEventListener('input', (e) => {
    _cheatsheetSearch = e.target.value.toLowerCase().trim();
    renderCheatsheetBody();
  });
  document.getElementById('cheatsheet-expand-all').addEventListener('click', toggleCheatsheetExpandAll);
  // iter 126: 📱 Save — printable PDF export. window.open() must fire synchronously
  // from this click handler (no await before it) to preserve iOS Safari popup-allow.
  document.getElementById('cheatsheet-save-pdf').addEventListener('click', exportCheatsheetToPdf);
}

// ──────────────────────────────────────────────────────────────────────────
//  BOOT TAIL — paint initial badge state, mount cross-tab + interval +
//  service-worker listeners, reflect persisted hide-mastered onto the button.
//  Runs LAST because some of these read state that initBootstrap loaded and
//  paint UI that the wiring sub-inits attached handlers to.
// ──────────────────────────────────────────────────────────────────────────
function initBootTail() {
  updateStreakUI();
  updateReviewBadge();

  // Multi-tab sync: when another tab writes progress, reload ours
  // (don't blindly re-render — only if the key we care about changed).
  window.addEventListener('storage', (e) => {
    if (e.key !== LS_KEY) return;
    loadProgress();
    updateStreakUI();
    updateReviewBadge();
    renderSidebar();
    // Don't re-render the current lesson — that wipes the editor.
    // Just refresh the header indicators in place.
    if (state.currentLessonId) updateLessonHeaderInPlace();
  });
  // Reflect persisted hide-mastered toggle on its button
  if (state.hideMastered) {
    const btn = document.getElementById('hide-mastered-btn');
    btn.classList.add('text-emerald-300');
    btn.classList.remove('text-slate-500');
  }
  // Refresh review badge every 60s so freshly-due items show up without a reload.
  // Skip the sidebar re-render when the user is typing or when nothing has
  // changed — re-rendering steals focus and destroys input state.
  let lastDueCount = dueReviewIds().length;
  setInterval(() => {
    const focusInSearch = document.activeElement?.id === 'search-input';
    const dueNow = dueReviewIds().length;
    updateReviewBadge();
    if (!focusInSearch && dueNow !== lastDueCount) {
      renderSidebar();
      lastDueCount = dueNow;
    }
  }, 60 * 1000);
  // iter 113: 📦 Offline Drill Pack — paint chip from last-known stats
  // immediately so cold-start has no blank flash, then ask the SW for fresh
  // stats (round-trip is sub-second once SW is active).
  updateOfflinePackChip();
  pollOfflinePackStats();
  window.addEventListener('focus', pollOfflinePackStats);
  if (navigator.serviceWorker) {
    // The first install on a fresh visit takes a few seconds while
    // ~143 lesson JSONs precache. Repoll a couple times to catch the
    // populated state without busy-waiting.
    navigator.serviceWorker.addEventListener('controllerchange', pollOfflinePackStats);
    setTimeout(pollOfflinePackStats, 3000);
    setTimeout(pollOfflinePackStats, 8000);
  }
}
