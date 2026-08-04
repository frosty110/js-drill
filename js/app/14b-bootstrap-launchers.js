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
  if (hashRoute && hashRoute.mode) {
    // Boot mode-route (#/m/<mode>, e.g. a new tab opened via cmd+click). The
    // surface's button isn't wired until the sub-inits run after bootstrap, and
    // _updateHash() below would clobber the hash — so stash it and dispatch at
    // the very end of init(), once every button exists.
    _pendingBootMode = hashRoute.mode;
    _pendingBootModeArg = hashRoute.modeArg;
  }
  // Boot policy: a bare URL (no hash at all) opens HOME, not a lesson. The
  // root URL used to resume lastLessonId — or, for a first-time visitor, drop
  // them inside Basics lesson 1 — which meant the app had no front door and
  // no map. The resume still happens below (it seeds currentLessonId, so
  // Home's hero can offer "Continue where you left off"); it just no longer
  // decides what the user sees first. Any explicit hash — a shared lesson
  // link, a mode route — still wins.
  if (!hashRoute) _pendingBootMode = 'home';
  if (hashRoute && hashRoute.lessonId) {
    const target = findLesson(hashRoute.lessonId);
    if (target && target.status === 'full') {
      state.currentLessonId = hashRoute.lessonId;
      if (hashRoute.tab) state.currentTab = hashRoute.tab;
      resumed = true;
      // audit F9: a shared lesson link must land on the drill, not behind the
      // first-run plan chooser. renderLesson reads this to skip the auto-open.
      _bootedOnLessonDeepLink = true;
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
  // audit F12: booting on a hash whose lesson id doesn't resolve used to fall
  // back to lastLessonId and then rewrite the URL, so a dead shared link landed
  // the recipient on an unrelated lesson with no signal that anything was
  // wrong. Must run BEFORE _updateHash — the page it paints carries no
  // [data-lesson-root], which is what makes the F10 guard leave the bad id in
  // the URL for the user to see. Self-checking: no-op unless the id is dead.
  showLessonNotFoundIfDeadLink(hashRoute);
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
      state.revealedAt = {};
      state.revealedClearedAt = {};
      state.weakness = {};
      state.lastLessonId = null;
      state.lastTab = null;
      saveProgress();
      // Synced user: make the reset cloud-authoritative. resetCloud() cancels
      // the 500ms debounce (so a poll can't union the old data back before the
      // push lands), pushes immediately, and stamps data.resetAt so every
      // OTHER device replaces its local copy instead of merge-resurrecting.
      if (window.DrillSync && window.DrillSync.getCurrentUser && window.DrillSync.getCurrentUser()) {
        window.DrillSync.resetCloud().catch(err => console.warn('cloud reset push failed:', err));
      }
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

