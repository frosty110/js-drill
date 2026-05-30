function getActiveStarterPath() {
  const base = getPathLessonOrder(getSubscribedPath()) || [];
  const track = (state && state.starterPathTrack) || 'all';
  const cacheKey = (state && state.subscribedPathId || 'starter') + '|' + track;
  if (cacheKey === _activeStarterPathCacheKey && _activeStarterPathCache) return _activeStarterPathCache;
  _activeStarterPathCacheKey = cacheKey;
  if (track === 'all') { _activeStarterPathCache = base; return _activeStarterPathCache; }
  _activeStarterPathCache = base.filter(id => {
    const lesson = findLesson(id);
    return lesson && lesson.track === track;
  });
  return _activeStarterPathCache;
}
function _invalidateStarterPathCache() {
  _activeStarterPathCache = null;
  _activeStarterPathCacheKey = null;
}

// I/O is delegated to window.DrillStorage (js/storage.js) — single source of
// truth for localStorage access across main app + prep + diagnostic. Domain
// logic (migration backfill, GC, defaults) stays here.
function loadProgress() {
  try {
    const parsed = window.DrillStorage ? window.DrillStorage.loadAppProgress() : null;
    if (!parsed) return;
    // DrillStorage already validated __v ∈ MAIN_APP_ACCEPTED_VERSIONS (2..6).
    // Hydrate state from the parsed shape, then apply app-domain migrations + GC.
    state.progress = parsed.progress || {};
    state.bestTimes = parsed.bestTimes || {};
    state.mockHistory = parsed.mockHistory || {};
    state.revealed = parsed.revealed || {};
    state.lastLessonId = parsed.lastLessonId || null;
    state.lastTab = parsed.lastTab || null;
    state.starterPath = !!parsed.starterPath;
    // iter 39: track-scoped path. Legacy users (no field) default to 'all' = existing behavior.
    state.starterPathTrack = ['all','syntax','patterns','applied'].includes(parsed.starterPathTrack) ? parsed.starterPathTrack : 'all';
    // iter 49: Recognize lifetime stats. Legacy users get 0/0.
    state.recognize = parsed.recognize && typeof parsed.recognize === 'object'
      ? { attempts: +parsed.recognize.attempts || 0, correct: +parsed.recognize.correct || 0 }
      : { attempts: 0, correct: 0 };
    // iter 54: Rapid-Fire lifetime stats. Legacy users get zeroed defaults.
    state.rapidFire = parsed.rapidFire && typeof parsed.rapidFire === 'object'
      ? {
          attempts: +parsed.rapidFire.attempts || 0,
          correct: +parsed.rapidFire.correct || 0,
          bestStreak: +parsed.rapidFire.bestStreak || 0,
          lastRunAt: +parsed.rapidFire.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 };
    // iter 57: 3-Card Warmup lifetime stats. Legacy users get zeroed defaults.
    state.warmup = parsed.warmup && typeof parsed.warmup === 'object'
      ? {
          sessions: +parsed.warmup.sessions || 0,
          completions: +parsed.warmup.completions || 0,
          lastRunAt: +parsed.warmup.lastRunAt || 0
        }
      : { sessions: 0, completions: 0, lastRunAt: 0 };
    // iter 71: Section Speedrun stats + per-section best times. Legacy users
    // get an empty bests map; bests[sectionSlug] = ms (lower=better).
    state.speedrun = parsed.speedrun && typeof parsed.speedrun === 'object'
      ? {
          bests: parsed.speedrun.bests && typeof parsed.speedrun.bests === 'object' ? parsed.speedrun.bests : {},
          sessions: +parsed.speedrun.sessions || 0,
          completions: +parsed.speedrun.completions || 0,
          lastRunAt: +parsed.speedrun.lastRunAt || 0
        }
      : { bests: {}, sessions: 0, completions: 0, lastRunAt: 0 };
    // iter 125: 🥊 Pattern-Family Gauntlet — chained all-L1 untimed session.
    state.gauntlet = parsed.gauntlet && typeof parsed.gauntlet === 'object'
      ? {
          sessions: +parsed.gauntlet.sessions || 0,
          completions: +parsed.gauntlet.completions || 0,
          lastRunAt: +parsed.gauntlet.lastRunAt || 0,
          bySection: parsed.gauntlet.bySection && typeof parsed.gauntlet.bySection === 'object' ? parsed.gauntlet.bySection : {}
        }
      : { sessions: 0, completions: 0, lastRunAt: 0, bySection: {} };
    // iter 73: Bug-Hunt lifetime stats. Legacy users get zeroed defaults.
    state.bugHunt = parsed.bugHunt && typeof parsed.bugHunt === 'object'
      ? {
          attempts: +parsed.bugHunt.attempts || 0,
          correct: +parsed.bugHunt.correct || 0,
          sessions: +parsed.bugHunt.sessions || 0,
          lastRunAt: +parsed.bugHunt.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 77: 🔮 Predict mental-execution lifetime stats. Legacy users get zeros.
    state.crystal = parsed.crystal && typeof parsed.crystal === 'object'
      ? {
          attempts: +parsed.crystal.attempts || 0,
          correct: +parsed.crystal.correct || 0,
          sessions: +parsed.crystal.sessions || 0,
          lastRunAt: +parsed.crystal.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 79: Smell-Test Complexity-Claim lifetime stats. Legacy users get zeros.
    state.claim = parsed.claim && typeof parsed.claim === 'object'
      ? {
          attempts: +parsed.claim.attempts || 0,
          correct: +parsed.claim.correct || 0,
          sessions: +parsed.claim.sessions || 0,
          lastRunAt: +parsed.claim.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 83: 🎰 Gotcha Roulette lifetime stats. Legacy users get zeros.
    state.gotcha = parsed.gotcha && typeof parsed.gotcha === 'object'
      ? {
          attempts: +parsed.gotcha.attempts || 0,
          correct: +parsed.gotcha.correct || 0,
          sessions: +parsed.gotcha.sessions || 0,
          lastRunAt: +parsed.gotcha.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 86: 🔀 Swap-Bench lifetime stats. Legacy users get zeros.
    state.swapBench = parsed.swapBench && typeof parsed.swapBench === 'object'
      ? {
          attempts: +parsed.swapBench.attempts || 0,
          correct: +parsed.swapBench.correct || 0,
          sessions: +parsed.swapBench.sessions || 0,
          lastRunAt: +parsed.swapBench.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 91: 🎬 Conversation Drill lifetime stats. Legacy users get zeros.
    state.convDrill = parsed.convDrill && typeof parsed.convDrill === 'object'
      ? {
          attempts: +parsed.convDrill.attempts || 0,
          correct: +parsed.convDrill.correct || 0,
          sessions: +parsed.convDrill.sessions || 0,
          lastRunAt: +parsed.convDrill.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 93: 🧬 Trace-Hop lifetime stats. Legacy users get zeros.
    state.traceHop = parsed.traceHop && typeof parsed.traceHop === 'object'
      ? {
          attempts: +parsed.traceHop.attempts || 0,
          correct: +parsed.traceHop.correct || 0,
          sessions: +parsed.traceHop.sessions || 0,
          lastRunAt: +parsed.traceHop.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 97: 📝 Notes Cloze Tap-Drill lifetime stats. Legacy users get zeros.
    state.notesDrill = parsed.notesDrill && typeof parsed.notesDrill === 'object'
      ? {
          attempts: +parsed.notesDrill.attempts || 0,
          correct: +parsed.notesDrill.correct || 0,
          sessions: +parsed.notesDrill.sessions || 0,
          lastRunAt: +parsed.notesDrill.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 98: 🪐 Mechanic Constellation lifetime stats. Legacy users get zeros.
    state.mechConstellation = parsed.mechConstellation && typeof parsed.mechConstellation === 'object'
      ? {
          attempts: +parsed.mechConstellation.attempts || 0,
          correct: +parsed.mechConstellation.correct || 0,
          sessions: +parsed.mechConstellation.sessions || 0,
          lastRunAt: +parsed.mechConstellation.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 99: ⏪ Reverse-Walkthrough lifetime stats. Legacy users get zeros.
    state.reverseWalk = parsed.reverseWalk && typeof parsed.reverseWalk === 'object'
      ? {
          attempts: +parsed.reverseWalk.attempts || 0,
          correct: +parsed.reverseWalk.correct || 0,
          sessions: +parsed.reverseWalk.sessions || 0,
          lastRunAt: +parsed.reverseWalk.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 102: 🗂 Notes→Lesson Reverse Lookup lifetime stats. Legacy users get zeros.
    state.notesLocate = parsed.notesLocate && typeof parsed.notesLocate === 'object'
      ? {
          attempts: +parsed.notesLocate.attempts || 0,
          correct: +parsed.notesLocate.correct || 0,
          sessions: +parsed.notesLocate.sessions || 0,
          lastRunAt: +parsed.notesLocate.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 109: 🔖 Match — bidirectional title ↔ description matcher lifetime stats.
    state.match = parsed.match && typeof parsed.match === 'object'
      ? {
          attempts: +parsed.match.attempts || 0,
          correct: +parsed.match.correct || 0,
          sessions: +parsed.match.sessions || 0,
          lastRunAt: +parsed.match.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 113: 📦 Offline Drill Pack — last-known cache stats for the
    // sidebar chip. Polled from the service worker on init/focus; stored
    // so the chip can paint immediately on cold-start without waiting for
    // the SW message round-trip.
    state.offlinePack = parsed.offlinePack && typeof parsed.offlinePack === 'object'
      ? {
          lessonCount: +parsed.offlinePack.lessonCount || 0,
          totalCount: +parsed.offlinePack.totalCount || 0,
          lastCheckedAt: +parsed.offlinePack.lastCheckedAt || 0
        }
      : { lessonCount: 0, totalCount: 0, lastCheckedAt: 0 };
    // iter 114: ☁️ Sync Onboarding — one-time flag preventing the
    // post-L3-pass-on-desktop hint banner from re-showing. Set by either
    // Dismiss or Tap-Sync; once true, never re-prompted in this profile.
    state.syncHintShown = !!parsed.syncHintShown;
    // iter 117: 🎤 Clarify-First Ritual — opt-in toggle (default OFF).
    state.clarifyRitualOn = !!parsed.clarifyRitualOn;
    state.clarify = parsed.clarify && typeof parsed.clarify === 'object'
      ? {
          attempts: +parsed.clarify.attempts || 0,
          correct: +parsed.clarify.correct || 0,
          completed: +parsed.clarify.completed || 0,
          sessions: +parsed.clarify.sessions || 0,
          lastRunAt: +parsed.clarify.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, completed: 0, sessions: 0, lastRunAt: 0 };
    // iter 118: 🔥 Hot-Seat Follow-Up — opt-in toggle (default OFF).
    state.hotseatOn = !!parsed.hotseatOn;
    state.hotseat = parsed.hotseat && typeof parsed.hotseat === 'object'
      ? {
          attempts: +parsed.hotseat.attempts || 0,
          correct: +parsed.hotseat.correct || 0,
          sessions: +parsed.hotseat.sessions || 0,
          lastRunAt: +parsed.hotseat.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 122: 🧪 What-If Output Predictor lifetime stats. Legacy users get zeros.
    state.whatif = parsed.whatif && typeof parsed.whatif === 'object'
      ? {
          attempts: +parsed.whatif.attempts || 0,
          correct: +parsed.whatif.correct || 0,
          sessions: +parsed.whatif.sessions || 0,
          lastRunAt: +parsed.whatif.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 142: 🔀 Mutate-and-Predict lifetime stats. Legacy users get zeros.
    state.mutate = parsed.mutate && typeof parsed.mutate === 'object'
      ? {
          attempts: +parsed.mutate.attempts || 0,
          correct: +parsed.mutate.correct || 0,
          sessions: +parsed.mutate.sessions || 0,
          lastRunAt: +parsed.mutate.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 147: 📞 Phone Screen Simulator lifetime stats. Legacy users get zeros.
    state.phoneScreen = parsed.phoneScreen && typeof parsed.phoneScreen === 'object'
      ? {
          sessions: +parsed.phoneScreen.sessions || 0,
          completions: +parsed.phoneScreen.completions || 0,
          lastRunAt: +parsed.phoneScreen.lastRunAt || 0
        }
      : { sessions: 0, completions: 0, lastRunAt: 0 };
    // iter 148: 🚧 Constraint-Shift Drill lifetime stats. Legacy users get zeros.
    state.constraintShift = parsed.constraintShift && typeof parsed.constraintShift === 'object'
      ? {
          attempts: +parsed.constraintShift.attempts || 0,
          correct: +parsed.constraintShift.correct || 0,
          sessions: +parsed.constraintShift.sessions || 0,
          lastRunAt: +parsed.constraintShift.lastRunAt || 0
        }
      : { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };
    // iter 119: ⏱ Time-to-Solve Calibration — opt-in toggle (default OFF).
    state.calibrateOn = !!parsed.calibrateOn;
    // iter 140: ⏲ Pace-Bar — opt-in toggle (default OFF).
    state.paceBarOn = !!parsed.paceBarOn;
    // iter 141: 📳 Haptic Tap-Pulse — opt-in toggle (default OFF).
    state.hapticOn = !!parsed.hapticOn;
    // 🖍 ADHD Mode — opt-in toggle (default OFF) restyles Conversation prose.
    state.adhdMode = !!parsed.adhdMode;
    // 🔠 App-wide font scale. Legacy users get 'lg' (the new baseline) so the
    // bump applies on first reload after this ships; explicit 'md' restores
    // the original size.
    state.fontScale = ['md','lg','xl'].includes(parsed.fontScale) ? parsed.fontScale : 'lg';
    state.timeCalibration = parsed.timeCalibration && typeof parsed.timeCalibration === 'object'
      ? {
          byMechanic: (parsed.timeCalibration.byMechanic && typeof parsed.timeCalibration.byMechanic === 'object') ? parsed.timeCalibration.byMechanic : {},
          meta: {
            estimates: +(parsed.timeCalibration.meta?.estimates) || 0,
            skips: +(parsed.timeCalibration.meta?.skips) || 0,
            passes: +(parsed.timeCalibration.meta?.passes) || 0
          }
        }
      : { byMechanic: {}, meta: { estimates: 0, skips: 0, passes: 0 } };
    // iter 104: 🗺 Command Palette use-counter. Legacy users get empty map.
    state.commandUsage = parsed.commandUsage && typeof parsed.commandUsage === 'object' && !Array.isArray(parsed.commandUsage)
      ? parsed.commandUsage : {};
    // iter 58: Mistake Tagging Postmortem — schema-additive opt-in tag log.
    // Bounded shape: { lessonId: [{ at, level, tag }] } — no migration; legacy
    // users with no entries get an empty object.
    state.misses = parsed.misses && typeof parsed.misses === 'object' ? parsed.misses : {};
    // Subscribed study plan. Legacy users (no field) default to 'starter' = existing behavior.
    // Validate against the registry so a stale/removed path id falls back gracefully.
    state.subscribedPathId = (typeof PATHS !== 'undefined' && PATHS.some(p => p.id === parsed.subscribedPathId))
      ? parsed.subscribedPathId : 'starter';
    state.cramTaskChecks = parsed.cramTaskChecks && typeof parsed.cramTaskChecks === 'object' ? parsed.cramTaskChecks : {};
    state.cramView = parsed.cramView && typeof parsed.cramView === 'object'
      ? { mode: ['today','day','all','open-from'].includes(parsed.cramView.mode) ? parsed.cramView.mode : 'today',
          dayIndex: Number.isInteger(parsed.cramView.dayIndex) ? parsed.cramView.dayIndex : -1 }
      : { mode: 'today', dayIndex: -1 };
    state.cramReview = parsed.cramReview && typeof parsed.cramReview === 'object'
      ? { items: (parsed.cramReview.items && typeof parsed.cramReview.items === 'object') ? parsed.cramReview.items : {},
          session: parsed.cramReview.session || null }
      : { items: {}, session: null };
    state.glossaryQuiz = parsed.glossaryQuiz && typeof parsed.glossaryQuiz === 'object'
      ? {
          sessions: +parsed.glossaryQuiz.sessions || 0,
          attempts: +parsed.glossaryQuiz.attempts || 0,
          correct: +parsed.glossaryQuiz.correct || 0,
          lastRunAt: +parsed.glossaryQuiz.lastRunAt || 0,
          perTerm: (parsed.glossaryQuiz.perTerm && typeof parsed.glossaryQuiz.perTerm === 'object') ? parsed.glossaryQuiz.perTerm : {},
          session: parsed.glossaryQuiz.session || null
        }
      : { sessions: 0, attempts: 0, correct: 0, lastRunAt: 0, perTerm: {}, session: null };
    state.welcomed = !!parsed.welcomed;
    state.hideMastered = !!parsed.hideMastered;
    state.repairFilter = !!parsed.repairFilter;
    // Faceted tag filter (additive). Keep only array-valued facets to harden
    // against malformed/legacy blobs.
    state.tagFilter = {};
    if (parsed.tagFilter && typeof parsed.tagFilter === 'object') {
      for (const k of Object.keys(parsed.tagFilter)) {
        if (Array.isArray(parsed.tagFilter[k])) state.tagFilter[k] = parsed.tagFilter[k].slice();
      }
    }
    state.tagFilterOpen = !!parsed.tagFilterOpen;
    state.reviews = parsed.reviews || {};
    state.weakness = parsed.weakness || {};
    state.history = parsed.history || {};
    if (parsed.sidebarTrack === 'syntax' || parsed.sidebarTrack === 'patterns' || parsed.sidebarTrack === 'applied') {
      state.sidebarTrack = parsed.sidebarTrack;
    }
    // Surface follows the resumed track (kept consistent); restore per-surface
    // position memory if present (forward-compatible — absent for legacy users).
    state.surface = SURFACE_OF_TRACK[state.sidebarTrack] || 'reference';
    if (parsed.surfaceCtx && typeof parsed.surfaceCtx === 'object') {
      state.surfaceCtx = {
        problems: parsed.surfaceCtx.problems || null,
        reference: parsed.surfaceCtx.reference || null
      };
    }
    // Backfill: if a lesson is mastered but has no review schedule (legacy
    // v<4 data), seed it with the first interval so spaced-rep starts working
    // for existing users.
    if (parsed.__v < 4) {
      const now = Date.now();
      for (const id of Object.keys(state.progress)) {
        const p = state.progress[id];
        if (p?.L1 === 'passed' && p?.L2 === 'passed' && p?.L3 === 'passed') {
          if (!state.reviews[id]) {
            state.reviews[id] = {
              lastPassedAt: now,
              interval: REVIEW_INTERVALS[0],
              dueAt: now + REVIEW_INTERVALS[0]
            };
          }
        }
      }
    }
    // Garbage-collect stale lesson ids — skip until manifest is loaded
    // (CURRICULUM may be empty during the first boot-time loadProgress call).
    if (CURRICULUM.length) {
      let mutated = false;
      for (const id of Object.keys(state.progress)) {
        if (!findLesson(id)) { delete state.progress[id]; mutated = true; }
      }
      if (mutated) saveProgress();
    }
  } catch (e) {
    state.progress = {}; state.bestTimes = {}; state.revealed = {}; state.mockHistory = {}; state.history = {};
  }
}
function saveProgress() {
  if (!window.DrillStorage) return; // storage.js not loaded — degrade silently
  window.DrillStorage.saveAppProgress({
    __v: 6,
    progress: state.progress,
    bestTimes: state.bestTimes,
    mockHistory: state.mockHistory,
    revealed: state.revealed,
    lastLessonId: state.currentLessonId,
    lastTab: state.currentTab,
    starterPath: state.starterPath,
    starterPathTrack: state.starterPathTrack,
    recognize: state.recognize,
    rapidFire: state.rapidFire,
    warmup: state.warmup,
    speedrun: state.speedrun,
    gauntlet: state.gauntlet,
    bugHunt: state.bugHunt,
    crystal: state.crystal,
    claim: state.claim,
    gotcha: state.gotcha,
    swapBench: state.swapBench,
    convDrill: state.convDrill,
    traceHop: state.traceHop,
    notesDrill: state.notesDrill,
    mechConstellation: state.mechConstellation,
    reverseWalk: state.reverseWalk,
    notesLocate: state.notesLocate,
    match: state.match,
    offlinePack: state.offlinePack,
    syncHintShown: state.syncHintShown,
    clarifyRitualOn: state.clarifyRitualOn,
    clarify: state.clarify,
    hotseatOn: state.hotseatOn,
    hotseat: state.hotseat,
    calibrateOn: state.calibrateOn,
    timeCalibration: state.timeCalibration,
    paceBarOn: state.paceBarOn,
    hapticOn: state.hapticOn,
    adhdMode: state.adhdMode,
    fontScale: state.fontScale,
    whatif: state.whatif,
    mutate: state.mutate,
    phoneScreen: state.phoneScreen,
    constraintShift: state.constraintShift,
    commandUsage: state.commandUsage,
    misses: state.misses,
    subscribedPathId: state.subscribedPathId,
    cramTaskChecks: state.cramTaskChecks,
    cramView: state.cramView,
    cramReview: state.cramReview,
    glossaryQuiz: state.glossaryQuiz,
    welcomed: state.welcomed,
    hideMastered: state.hideMastered,
    repairFilter: state.repairFilter,
    tagFilter: state.tagFilter,
    tagFilterOpen: state.tagFilterOpen,
    reviews: state.reviews,
    weakness: state.weakness,
    sidebarTrack: state.sidebarTrack,
    surface: state.surface,
    surfaceCtx: state.surfaceCtx,
    history: state.history
  });
}
function scheduleReview(lessonId, { advance = true } = {}) {
  // L3 pass → advance to the next interval bucket.
  // L2 pass on a due lesson → hold the bucket, push dueAt forward by the
  // current interval. Mobile users can keep the due list manageable from a
  // phone (where L3 is high-friction) without inflating intervals they
  // haven't proven free-recall on. See desirable-difficulty.md.
  const now = Date.now();
  const prev = state.reviews[lessonId];
  let nextIntervalIdx = 0;
  if (prev && prev.interval) {
    const currentIdx = REVIEW_INTERVALS.indexOf(prev.interval);
    nextIntervalIdx = advance
      ? Math.min(currentIdx + 1, REVIEW_INTERVALS.length - 1)
      : currentIdx;
  }
  const interval = REVIEW_INTERVALS[nextIntervalIdx];
  state.reviews[lessonId] = { lastPassedAt: now, interval, dueAt: now + interval };
  saveProgress();
}
function isDueForReview(lessonId) {
  const r = state.reviews[lessonId];
  if (!r) return false;
  if (lessonOverallStatus(lessonId) !== 'mastered') return false;
  return Date.now() >= r.dueAt;
}
// Soft SR/weakness-weighted shuffle for recognition-tier drills
// (notes-drill, recognize, trace-hop, reverse). Groups items into 4
// priority buckets: 3=due+weak, 2=due, 1=weak, 0=neither. Fisher-Yates
// within each bucket, then concatenates high-to-low — so cards from
// lessons the user owes attention surface first within a session, but
// the order inside each bucket is still randomized. A cold-start user
// with no SR/weakness state degrades to a uniform shuffle (everything
// lands in bucket 0). getLessonId is a callback that pulls the lessonId
// off whatever item shape the caller uses (CURRICULUM entries, deck
// items, etc.).
function _srPriorityShuffle(items, getLessonId) {
  const buckets = [[], [], [], []];
  for (const item of items) {
    const id = getLessonId(item);
    const overdue = id ? isDueForReview(id) : false;
    const weak = id ? (state.weakness[id] || 0) > 0 : false;
    const bucket = (overdue ? 2 : 0) + (weak ? 1 : 0);
    buckets[bucket].push(item);
  }
  for (let b = 0; b < 4; b++) {
    for (let i = buckets[b].length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [buckets[b][i], buckets[b][j]] = [buckets[b][j], buckets[b][i]];
    }
  }
  return [...buckets[3], ...buckets[2], ...buckets[1], ...buckets[0]];
}
function dueReviewIds() {
  // iter 45: path-aware SR. When Starter Plan is on AND scoped to a single
  // track, only surface reviews from lessons in that track-path — closes
  // the gap that per-track paths (iter 39) filtered the sidebar LIST but
  // not the REVIEW QUEUE. Off-path or track='all' → unchanged global queue.
  // Lessons outside scope are still tracked in localStorage; flipping to
  // 'all' or toggling path off re-surfaces them. See iter-43 SR walkthrough
  // gap #2; ideas-by-category.md § Paths & Sessions.
  const scoped = state.starterPath && state.starterPathTrack && state.starterPathTrack !== 'all';
  const inScope = scoped ? new Set(getActiveStarterPath()) : null;
  return CURRICULUM
    .filter(l => l.status === 'full' && isDueForReview(l.id))
    .filter(l => !inScope || inScope.has(l.id))
    .sort((a, b) => state.reviews[a.id].dueAt - state.reviews[b.id].dueAt)
    .map(l => l.id);
}
// iter 65: Resurrect Queue — lessons that are not just due but *long*-overdue
// (`now - dueAt > 2 * interval`). Closes iter-64 roadmap #1. The existing 🕒
// Review badge surfaces ALL due lessons without differentiating staleness;
// this helper isolates the decay-magnitude tail — lessons that have rotted
// past one full bucket interval and silently regressed. Pure derivation
// from existing `state.reviews[id].{dueAt, interval}`; no new schema.
function resurrectIds() {
  const now = Date.now();
  return CURRICULUM
    .filter(l => l.status === 'full')
    .filter(l => {
      const r = state.reviews[l.id];
      if (!r || !r.interval) return false;
      if (lessonOverallStatus(l.id) !== 'mastered') return false;
      return (now - r.dueAt) > (2 * r.interval);
    })
    .sort((a, b) => (now - state.reviews[b.id].dueAt) - (now - state.reviews[a.id].dueAt))
    .map(l => l.id);
}
// iter 94: 🧠 Mechanic-Bridge — cross-track transfer routing. Closes iter-90
// roadmap #3 (last entry from the iter-90 vision queue). The existing 🧩
// Mechanics × Track Matrix (iter 63) *shows* transfer gaps with a ⚠ marker
// but never *closes* them — the user sees the gap and does nothing. Bridge
// converts the diagnostic into a 1-tap routing action: for each mechanic
// mastered in one track but unmastered in another, surface a candidate
// {sourceLesson, targetLesson} pair so the user can ride the transfer.
// Pure derivation from MECHANIC_INDEX × state.progress × manifest.track.
// Empty when MECHANIC_INDEX hasn't been built yet (kick off async load in
// updateReviewBadge; subsequent saves see it populated).
function _bridgeCandidates() {
  if (!MECHANIC_INDEX || MECHANIC_INDEX.size === 0) return [];
  const candidates = [];
  for (const [mechId, lessonSet] of MECHANIC_INDEX) {
    if (lessonSet.size < 2) continue;
    const mech = MECHANICS.find(m => m.id === mechId);
    if (!mech) continue;
    // Bucket by track — first mastered per track, first unmastered per track.
    const mastered = { syntax: null, patterns: null, applied: null };
    const unmastered = { syntax: null, patterns: null, applied: null };
    for (const lid of lessonSet) {
      const lesson = findLesson(lid);
      if (!lesson || lesson.status !== 'full') continue;
      const t = lesson.track;
      if (!(t in mastered)) continue;
      const s = lessonOverallStatus(lid);
      if (s === 'mastered' && !mastered[t]) mastered[t] = lesson;
      else if ((s === 'not_started' || s === 'in_progress') && !unmastered[t]) unmastered[t] = lesson;
    }
    // Find a cross-track pair. One candidate per mechanic.
    let emitted = false;
    for (const tA of Object.keys(mastered)) {
      if (!mastered[tA] || emitted) continue;
      for (const tB of Object.keys(unmastered)) {
        if (tA === tB || !unmastered[tB]) continue;
        candidates.push({
          mechId,
          mechLabel: mech.label,
          sourceLessonId: mastered[tA].id,
          sourceLessonTitle: mastered[tA].title,
          sourceTrack: tA,
          targetLessonId: unmastered[tB].id,
          targetLessonTitle: unmastered[tB].title,
          targetTrack: tB
        });
        emitted = true;
        break;
      }
    }
  }
  return candidates;
}
// Toast shown on arrival at the bridged-to lesson. 2.2-sec fuchsia accent —
// reuses .reveal-cleared-toast styling family (iter-56 precedent) with a
// .bridge-toast variant. No actions; pure preface.
function _showBridgeToast(candidate) {
  const existing = document.querySelector('.reveal-cleared-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'reveal-cleared-toast bridge-toast';
  toast.innerHTML = `🧠 You know <strong>${escapeHtml(candidate.mechLabel)}</strong> from <strong>${escapeHtml(candidate.sourceLessonTitle)}</strong> — try it here.`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('reveal-cleared-toast-show'));
  setTimeout(() => {
    toast.classList.remove('reveal-cleared-toast-show');
    setTimeout(() => toast.remove(), 250);
  }, 2200);
}
// iter 108: 🍀 Lucky — arrival toast prefacing the random pick so the user
// understands why they landed on this lesson. 1.8-sec green accent reusing the
// .reveal-cleared-toast slide-in mechanics.
function _showLuckyToast(lessonTitle) {
  const existing = document.querySelector('.reveal-cleared-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'reveal-cleared-toast lucky-toast';
  toast.innerHTML = `🍀 Lucky pick: <strong>${escapeHtml(lessonTitle)}</strong>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('reveal-cleared-toast-show'));
  setTimeout(() => {
    toast.classList.remove('reveal-cleared-toast-show');
    setTimeout(() => toast.remove(), 250);
  }, 1800);
}
// Track whether updateReviewBadge has fired the mechanic-index lazy load
// already. The badge stays hidden on first paint (MECHANIC_INDEX empty);
// once the registry + content load finish, the second updateReviewBadge
// call paints the count.
let _bridgeIndexKick = false;

// Iter 45 — true global due count, ignoring path-scope. Used by the Review
// button's scope-aware label so the user can see "3 due in scope (12 total)"
// instead of having the broader pool silently hidden.
function allDueReviewIds() {
  return CURRICULUM
    .filter(l => l.status === 'full' && isDueForReview(l.id))
    .sort((a, b) => state.reviews[a.id].dueAt - state.reviews[b.id].dueAt)
    .map(l => l.id);
}
// SR-impact text appended after pass/reveal feedback. `kind`:
//   'pass'   → "Next review in Nd."         (any time a reviews entry exists)
//   'demote' → "Interval shortened — next review in Nd."  (after a demote)
// Empty if the lesson has no reviews entry yet (first-mastery L2 surface).
// The muted gray matches the surrounding small-text styling without
// stealing emphasis from the "✓ passed" message.
function srBadgeHtml(lessonId, kind) {
  const r = state.reviews[lessonId];
  if (!r) return '';
  const when = formatDueRelative(lessonId);
  const text = kind === 'demote'
    ? `Interval shortened — next review ${when}.`
    : `Next review ${when}.`;
  return ` <span style="color:#94a3b8">${escapeHtml(text)}</span>`;
}
function formatDueRelative(lessonId) {
  const r = state.reviews[lessonId];
  if (!r) return '';
  const diff = r.dueAt - Date.now();
  if (diff <= 0) {
    const overdue = -diff;
    const days = Math.floor(overdue / (24 * 60 * 60 * 1000));
    if (days >= 1) return `due (${days}d overdue)`;
    const hours = Math.floor(overdue / (60 * 60 * 1000));
    if (hours >= 1) return `due (${hours}h overdue)`;
    return 'due now';
  }
  // Round near boundaries — async drift between scheduleReview() writing
  // dueAt and formatDueRelative() reading it would otherwise show
  // "Next review in 23h" right after the system set the interval to
  // exactly 1d. Rounding gives the user-facing estimate the bucket
  // semantics they expect ("1d" not "23h59m").
  const days = Math.round(diff / (24 * 60 * 60 * 1000));
  if (days >= 1) return `in ${days}d`;
  const hours = Math.round(diff / (60 * 60 * 1000));
  if (hours >= 1) return `in ${hours}h`;
  return 'in <1h';
}
// iter 56: in-memory tracker so we can tell a "clean pass" (passed without
// re-revealing in this attempt) from a "pass after reveal" (revealed flag
// stays set). Keyed by lessonId; cleared in selectLesson when the user
// switches lessons. Not persisted — every fresh page load starts clean
// and the existing revealed flag is what survives.
const _revealedInCurrentAttempt = {};
function markRevealed(lessonId, level) {
  state.revealed[lessonId] = state.revealed[lessonId] || {};
  state.revealed[lessonId][level] = true;
  _revealedInCurrentAttempt[lessonId] = _revealedInCurrentAttempt[lessonId] || {};
  _revealedInCurrentAttempt[lessonId][level] = true;
  // Loss-side SR gradient: revealing the answer on a due lesson means the
  // user couldn't produce it from memory. Demote the bucket so the
  // schedule reflects actual recall strength rather than ratcheting up.
  // See docs/learning-strategies/spaced-repetition.md.
  let demoted = false;
  if ((level === 'L2' || level === 'L3') && isDueForReview(lessonId)) {
    demoteReview(lessonId);
    demoted = true;
  }
  saveProgress();
  updateReviewBadge();
  return { demoted };
}
function demoteReview(lessonId) {
  const prev = state.reviews[lessonId];
  if (!prev || !prev.interval) return;
  const currentIdx = REVIEW_INTERVALS.indexOf(prev.interval);
  const nextIdx = Math.max(currentIdx - 1, 0);
  const interval = REVIEW_INTERVALS[nextIdx];
  state.reviews[lessonId] = {
    lastPassedAt: prev.lastPassedAt,
    interval,
    dueAt: Date.now() + interval,
  };
  saveProgress();
}
function wasRevealed(lessonId, level) {
  return !!(state.revealed && state.revealed[lessonId] && state.revealed[lessonId][level]);
}
// iter 56: Reveal Replay queue. Walk state.revealed and return an ordered
// list of {lessonId, lessonTitle, level} entries for lessons that still
// exist in CURRICULUM. Sort: L2 entries before L3 entries (L2 is cued recall
// — easier to clean first), then by section order in CURRICULUM (groups
// related drills). Closes iter-55 roadmap #2 (Reveal Replay). Sourced from
// vision iter-55 subagent B#5 (constraint-aware).
function _revealedQueue() {
  const queue = [];
  for (const lessonId of Object.keys(state.revealed || {})) {
    const levels = state.revealed[lessonId];
    if (!levels || typeof levels !== 'object') continue;
    const lesson = findLesson(lessonId);
    if (!lesson || lesson.status !== 'full') continue;
    for (const level of ['L2', 'L3']) {  // L2 first per sort policy
      if (levels[level]) queue.push({ lessonId, lessonTitle: lesson.title, level });
    }
  }
  return queue;
}
// iter 60: 📡 Weak-Spot Decay Radar. Returns up to N lesson rows that join
// THREE previously-independent signals: state.weakness (L1-miss count),
// state.reviews[id].dueAt (SR schedule), state.revealed[id] (mastered-with-
// reveal integrity flag). Today the user must mentally cross-reference
// Review badge + Weak Spots button + Reveal Replay to figure out the
// highest-priority drill of the day. The union of "wobbly + about to slip
// + cheated last time" IS that list, and no current surface joins it.
// Closes iter-59 roadmap entry #1 (B#4 — risk intersection dimension).
// Sort policy: due-now lessons first (dueAt < now); then by smallest
// dueAt-now diff; then by weakness count desc; then by revealed-flag.
function _atRiskRows(limit = 7) {
  const now = Date.now();
  // Union: any lesson in weakness OR with at least one revealed level.
  // We don't include due-only lessons because the existing Review badge
  // already surfaces those — At Risk is for lessons WHERE the user has a
  // measured-pain signal (miss or reveal) on top of any SR data.
  const ids = new Set();
  for (const id of Object.keys(state.weakness || {})) {
    if ((state.weakness[id] || 0) > 0) ids.add(id);
  }
  for (const id of Object.keys(state.revealed || {})) {
    const levels = state.revealed[id];
    if (levels && Object.keys(levels).length > 0) ids.add(id);
  }
  const rows = [];
  for (const id of ids) {
    const lesson = findLesson(id);
    if (!lesson || lesson.status !== 'full') continue;
    const review = state.reviews[id];
    const weaknessCount = state.weakness[id] || 0;
    const revealedLevels = state.revealed[id]
      ? Object.keys(state.revealed[id]).filter(k => state.revealed[id][k])
      : [];
    const dueAt = review && lessonOverallStatus(id) === 'mastered' ? review.dueAt : null;
    const daysTilDue = dueAt !== null ? Math.round((dueAt - now) / 86400000) : null;
    rows.push({
      lessonId: id,
      title: lesson.title,
      section: lesson.section,
      track: lesson.track,
      daysTilDue,
      isDue: dueAt !== null && dueAt <= now,
      weaknessCount,
      revealedLevels  // ['L2'] or ['L3'] or both
    });
  }
  // Sort: due-now (dueAt elapsed) → soonest-due → highest-weakness → revealed-flag-presence
  rows.sort((a, b) => {
    if (a.isDue !== b.isDue) return a.isDue ? -1 : 1;
    if (a.daysTilDue !== null && b.daysTilDue !== null) {
      if (a.daysTilDue !== b.daysTilDue) return a.daysTilDue - b.daysTilDue;
    } else if (a.daysTilDue !== null) return -1;
    else if (b.daysTilDue !== null) return 1;
    if (a.weaknessCount !== b.weaknessCount) return b.weaknessCount - a.weaknessCount;
    return b.revealedLevels.length - a.revealedLevels.length;
  });
  return rows.slice(0, limit);
}
// iter 56: ephemeral toast — surfaces a 2-second confirmation when a clean
// pass clears a reveal flag. Auto-removes; no state. Mirrors existing toast
// pattern (e.g., L3 mastery banner) but simpler — pure overlay, no actions.
function _showRevealClearedToast(lessonId, level) {
  const lesson = findLesson(lessonId);
  if (!lesson) return;
  const existing = document.querySelector('.reveal-cleared-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'reveal-cleared-toast';
  toast.innerHTML = `🃏 ✨ ${escapeHtml(level)} drilled clean — reveal flag cleared on <strong>${escapeHtml(lesson.title)}</strong>`;
  document.body.appendChild(toast);
  // Slide-in via CSS class; remove after 2.2s.
  requestAnimationFrame(() => toast.classList.add('reveal-cleared-toast-show'));
  setTimeout(() => {
    toast.classList.remove('reveal-cleared-toast-show');
    setTimeout(() => toast.remove(), 250);
  }, 2200);
}
function recordWrong(lessonId) {
  state.weakness[lessonId] = (state.weakness[lessonId] || 0) + 1;
  appendHistory(lessonId, 'L1-miss');
  saveProgress();
}
// iter 58: Mistake Tagging Postmortem (iter-48 roadmap #3). Opt-in concept-
// level metacognition layer. Closes the gap noted in ideas-by-category.md
// § Paths & Sessions → Cross-cutting concerns: weak-spot tracker is lesson-
// grain, not concept-grain. After an L1 miss, an unobtrusive chip strip
// asks "what tripped you?"; tap a chip stores `{at, level, tag}` against
// the lesson id; aggregated view in Stats modal surfaces top miss tags.
// PROFILE-grounded: need #5 (memorization tooling exploits active recall +
// elaboration); the iter-48 reframe sidesteps the iter-26 Amendment B
// governance dependency by framing the surface as a pure USER affordance
// (no claim that metacognitive ownership is a stated need).
const MISTAKE_TAGS = [
  { id: 'off-by-one', label: 'off-by-one' },
  { id: 'wrong-method', label: 'wrong method' },
  { id: 'edge-case', label: 'edge case' },
  { id: 'semantics', label: 'semantics' },
  { id: 'misread', label: 'misread' },
  { id: 'syntax', label: 'syntax' }
];
function recordMiss(lessonId, level, tagId) {
  if (!MISTAKE_TAGS.some(t => t.id === tagId)) return;  // ignore unknown tags
  state.misses[lessonId] = state.misses[lessonId] || [];
  state.misses[lessonId].push({ at: Date.now(), level, tag: tagId });
  // Bound the per-lesson log so a hyperactive tagger doesn't bloat localStorage.
  if (state.misses[lessonId].length > 50) {
    state.misses[lessonId] = state.misses[lessonId].slice(-50);
  }
  saveProgress();
}
// Aggregate top-N miss tags across all lessons. Returns sorted [{tag, count}].
function _aggregateMissTags(topN = 5) {
  const counts = {};
  for (const lessonId of Object.keys(state.misses || {})) {
    const log = state.misses[lessonId];
    if (!Array.isArray(log)) continue;
    for (const entry of log) {
      if (!entry || !entry.tag) continue;
      counts[entry.tag] = (counts[entry.tag] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count, label: MISTAKE_TAGS.find(t => t.id === tag)?.label || tag }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}
function clearWeakness(lessonId) {
  if (state.weakness[lessonId]) {
    delete state.weakness[lessonId];
    saveProgress();
  }
}
function topWeakLessonId() {
  const entries = Object.entries(state.weakness)
    .filter(([id]) => {
      const lesson = findLesson(id);
      return lesson && lesson.status === 'full';
    })
    .sort((a, b) => b[1] - a[1]);
  return entries.length ? entries[0][0] : null;
}
// iter-32 scaffold for roadmap entry iter-31 #6 (per-lesson sparkline).
// Returns '' when window.__sparklineEnabled is falsy — so the surface is
// off by default. Iter-33 ship iter flips the default + adds mobile probe.
// Until then the function is exercised only via `window.__sparklineEnabled =
// true; renderLesson()` in DevTools.
// iter-33: default flag to true so the surface lands for all users.
if (typeof window !== 'undefined' && window.__sparklineEnabled === undefined) {
  window.__sparklineEnabled = true;
}
function renderSparkline(lessonId) {
  if (!window.__sparklineEnabled) return '';
  const events = state.history[lessonId] || [];
  if (!events.length) {
    return '<span class="sparkline-empty text-xs text-slate-600">no history yet</span>';
  }
  const now = Date.now();
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  const recent = events.filter(e => e.at >= cutoff);
  if (!recent.length) {
    return '<span class="sparkline-empty text-xs text-slate-600">no recent events</span>';
  }
  const colorMap = {
    'L1-pass': '#34d399', // emerald — concept correct
    'L1-miss': '#f87171', // rose — concept miss
    'L2-pass': '#34d399', // emerald — fill correct
    'L3-pass': '#60a5fa'  // sky — full implementation
  };
  const ticks = recent.map(e => {
    const color = colorMap[e.event] || '#64748b';
    const day = new Date(e.at).toISOString().slice(0, 10);
    return `<span class="sparkline-tick" style="display:inline-block;width:3px;height:10px;margin:0 1px;background:${color}" title="${day} ${e.event}"></span>`;
  }).join('');
  return `<div class="sparkline" title="Last 30 days of L1/L2/L3 events">${ticks}</div>`;
}
// Expose for E2E probes / DevTools toggling.
window.__renderSparkline = renderSparkline;

// iter 49: Pattern Recognition Speed Drill. Diagnose-the-pattern session.
// Shows random patterns-lesson `L3.prompt` (no title, no section badge)
// with 4 SECTION-name buttons — correct + 3 sibling sections. Tap to grade
// + auto-advance. 10 cards per session, summary at end. Reuses existing
// `L3.prompt` strings (no authoring) + 17-section pool (no per-lesson
// distractor leak — sidesteps iter-30 adversary's data-contamination
// concern). See roadmap.md iter-48 entry (top of queue).
const RECOGNIZE_SESSION_LEN = 10;
