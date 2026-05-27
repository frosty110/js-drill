// ──────────────────────────────────────────────────────────────────────────
//  CORE MODULE IMPORTS — pure leaf utilities extracted to js/core/.
//  Loaded by index.html before this file; we destructure once here so the
//  rest of app.js can call them by the same names as before the split.
//  See js/core/util.js and js/core/runner.js for what lives where.
// ──────────────────────────────────────────────────────────────────────────
const {
  escapeHtml, formatTime, normalize, normalizeLines, outputsMatch,
  stripCommentsForDiff, lcsDiffRows, colorizeInto, renderFlash
} = window.DrillUtil;
const { formatArg, runCode } = window.DrillRunner;

// ──────────────────────────────────────────────────────────────────────────
//  CONTENT LOADER (replaces the inline CURRICULUM + CONTENT data blocks)
//  CURRICULUM is loaded once from data/manifest.json on boot.
//  Per-lesson bodies live in data/<section-slug>/<lesson-id>.json and are
//  fetched lazily on first click, then cached in CONTENT keyed by id.
//  Source of truth for content lives in those JSON files; index.html ships
//  only the app shell + runtime.
// ──────────────────────────────────────────────────────────────────────────
let CURRICULUM = [];                  // populated from manifest on boot
const SECTION_SLUGS = {};             // section display name → URL slug
const CONTENT = {};                   // id → lesson body (lazy cache)
const _lessonInflight = {};           // id → Promise (dedupe concurrent loads)

async function loadManifest() {
  const res = await fetch('data/manifest.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Manifest fetch failed: ' + res.status);
  const manifest = await res.json();
  const flat = [];
  for (const section of manifest.sections) {
    SECTION_SLUGS[section.name] = section.slug;
    for (const l of section.lessons) {
      flat.push({
        id: l.id, title: l.title, track: l.track,
        section: section.name, status: l.status
      });
    }
  }
  CURRICULUM = flat;
}

async function loadLessonContent(lessonId) {
  if (CONTENT[lessonId]) return CONTENT[lessonId];
  if (_lessonInflight[lessonId]) return _lessonInflight[lessonId];
  const lesson = findLesson(lessonId);
  if (!lesson) return null;
  const slug = SECTION_SLUGS[lesson.section];
  if (!slug) return null;
  _lessonInflight[lessonId] = (async () => {
    try {
      const res = await fetch('data/' + slug + '/' + lessonId + '.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('Lesson fetch failed: ' + res.status);
      const body = await res.json();
      CONTENT[lessonId] = body;
      return body;
    } finally {
      delete _lessonInflight[lessonId];
    }
  })();
  return _lessonInflight[lessonId];
}

// Preload every full lesson — used by cheatsheet export, which iterates all.
async function ensureAllContentLoaded() {
  const ids = CURRICULUM.filter(l => l.status === 'full').map(l => l.id);
  await Promise.all(ids.map(loadLessonContent));
}

// ──────────────────────────────────────────────────────────────────────────
//  MECHANICS REGISTRY (cross-cutting code idioms tagged on lessons)
//  Loaded once from data/mechanics.json. MECHANIC_INDEX is built lazily
//  on first modal open by walking the (already-loaded) CONTENT cache.
//  Source of truth for what counts as a mechanic — and which lessons it
//  appears in — lives in data/. App side just renders.
// ──────────────────────────────────────────────────────────────────────────
let MECHANICS = [];                    // [{id, label, category, blurb, snippet}]
let MECHANIC_CATEGORIES = [];          // [{id, label}]
let MECHANIC_INDEX = new Map();        // mechId → Set<lessonId>
let _mechanicsRegistryLoaded = false;

async function loadMechanicsRegistry() {
  if (_mechanicsRegistryLoaded) return;
  try {
    const res = await fetch('data/mechanics.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const reg = await res.json();
    MECHANICS = Array.isArray(reg.mechanics) ? reg.mechanics : [];
    MECHANIC_CATEGORIES = Array.isArray(reg.categories) ? reg.categories : [];
    _mechanicsRegistryLoaded = true;
  } catch (e) {
    // Missing registry just hides the surface; fail soft.
    MECHANICS = [];
  }
}

// Build mechId → set-of-lessonIds index by walking every loaded lesson's
// `mechanics` field. We force-load all content first (same approach as the
// cheatsheet export) so the index is complete on first render — otherwise
// the cross-cutting view would only see lessons the user has visited.
async function ensureMechanicIndex() {
  await loadMechanicsRegistry();
  await ensureAllContentLoaded();
  MECHANIC_INDEX = new Map();
  for (const m of MECHANICS) MECHANIC_INDEX.set(m.id, new Set());
  for (const lesson of CURRICULUM) {
    const content = CONTENT[lesson.id];
    if (!content || !Array.isArray(content.mechanics)) continue;
    for (const mid of content.mechanics) {
      const bucket = MECHANIC_INDEX.get(mid);
      if (bucket) bucket.add(lesson.id);
    }
  }
}
// ──────────────────────────────────────────────────────────────────────────
//  STATE + LOCALSTORAGE
// ──────────────────────────────────────────────────────────────────────────
// Canonical key is owned by js/storage.js (DrillStorage.MAIN_APP_KEY). Mirror
// it here for the few places that still need raw localStorage access (backup
// download bytes, restore replace, multi-tab storage event filter). Fallback
// literal is purely defensive — storage.js is loaded before app.js in index.html.
const LS_KEY = (typeof window !== 'undefined' && window.DrillStorage && window.DrillStorage.MAIN_APP_KEY) || 'jsdrill.progress.v1';
const state = {
  currentLessonId: null,
  // 'auto' = resolve to the first available tab once content loads
  // (Conversation if the lesson has one, else Reference). selectLesson and
  // boot both leave this as 'auto' unless lastTab from localStorage overrides.
  currentTab: 'auto',
  progress: {},   // { lessonId: { L1: 'passed', L2: 'passed', L3: 'passed' } }
  searchQuery: '',
  streak: 0,      // consecutive lessons mastered in this run (resets on reload)
  bestTimes: {},  // { lessonId: ms } — fastest mock-interview pass
  mockHistory: {},  // { lessonId: [ms, ms, ...] } — last N=MOCK_HISTORY_MAX successful mock times, oldest→newest
  mock: { active: false, startTime: 0, lessonId: null, tickHandle: null },
  starterPath: false, // when true, sidebar shows only the linear starter path
  starterPathTrack: 'all', // 'all' | 'syntax' | 'patterns' | 'applied' — track-scope filter for the path (iter 39)
  recognize: { attempts: 0, correct: 0 }, // iter 49: Pattern Recognition Speed Drill lifetime stats (additive)
  rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 }, // iter 54: cross-lesson L1 interleaving stream (additive)
  warmup: { sessions: 0, completions: 0, lastRunAt: 0 }, // iter 57: 3-card daily-plan swipe-stack micro-session (additive)
  speedrun: { bests: {}, sessions: 0, completions: 0, lastRunAt: 0 }, // iter 71: 🏁 Section Speedrun — per-section first mobile timed-pressure surface; bests keyed by section slug (additive, no `__v` bump)
  gauntlet: { sessions: 0, completions: 0, lastRunAt: 0, bySection: {} }, // iter 125: 🥊 Pattern-Family Gauntlet — chained L1 stream over EVERY L1 question of EVERY full lesson in one section. Cousin to Speedrun (1 L1/lesson + timer); Gauntlet is all-L1 untimed for family-grain interleaving. bySection[slug] = { sessions, lastCorrect, lastTotal } (additive, no `__v` bump)
  bugHunt: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 73: 🪲 Bug-Hunt — §9B code-evaluation skill drill (additive, no `__v` bump)
  crystal: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 77: 🔮 Predict — mental-execution drill (additive, no `__v` bump)
  claim: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 79: 📐 Smell-Test Complexity-Claim drill (additive, no `__v` bump)
  gotcha: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 83: 🎰 Gotcha Roulette — reference.notes recall stream (additive, no `__v` bump)
  swapBench: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 86: 🔀 Swap-Bench — pairwise idiom-equivalence drill (additive, no `__v` bump)
  convDrill: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 91: 🎬 Conversation Drill — 6-section interview-arc classifier over conversation.sections[] (additive, no `__v` bump)
  traceHop: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 93: 🧬 Trace-Hop — pick-the-middle-state mobile quiz over walkthrough.trace yields (additive, no `__v` bump)
  notesDrill: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 97: 📝 Notes Cloze Tap-Drill — cloze-MC over reference.notes[] keywords (additive, no `__v` bump)
  mechConstellation: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 98: 🪐 Mechanic Constellation — multi-select recall over mechanics[] tag (additive, no `__v` bump)
  reverseWalk: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 99: ⏪ Reverse-Walkthrough — backward-direction recall over walkthrough.examples (additive, no `__v` bump)
  notesLocate: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 102: 🗂 Notes→Lesson Reverse Lookup — cross-corpus localization (additive, no `__v` bump)
  match: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 109: 🔖 Match — bidirectional title ↔ description matcher (additive, no `__v` bump)
  offlinePack: { lessonCount: 0, totalCount: 0, lastCheckedAt: 0 }, // iter 113: 📦 Offline Drill Pack — last-known SW cache stats for sidebar chip (additive, no `__v` bump)
  syncHintShown: false, // iter 114: ☁️ Sync Onboarding — one-time hint-banner-dismissed flag (additive, no `__v` bump)
  clarifyRitualOn: false, // iter 117: 🎤 Clarify-First Ritual — opt-in toggle gates Patterns/Applied L3 behind clarifier chip drill (default OFF — user must opt in)
  clarify: { attempts: 0, correct: 0, completed: 0, sessions: 0, lastRunAt: 0 }, // iter 117: 🎤 Clarify-First Ritual — lifetime stats (attempts = total chip-taps; correct = right chips tapped; completed = full rituals passed)
  hotseatOn: false, // iter 118: 🔥 Hot-Seat Follow-Up — opt-in toggle surfaces a post-L3-pass tap-card with a mechanic-tag-derived follow-up + 3 distractors (default OFF — user must opt in)
  hotseat: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 118: 🔥 Hot-Seat Follow-Up — lifetime stats (attempts = chip-taps; correct = right chips on first try; sessions = cards shown)
  whatif: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 122: 🧪 What-If Output Predictor — pick the output for a specific walkthrough-example input (additive, no `__v` bump)
  mutate: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 142: 🔀 Mutate-and-Predict — 5-card session showing canonical with ONE line mutated; user picks consequence-class taxonomy (still-correct / wrong-content-same-shape / throws / different-type). §9B forward-simulation drill — distinct from iter-73 Bug-Hunt's locate-the-bug task
  phoneScreen: { sessions: 0, completions: 0, lastRunAt: 0 }, // iter 147: 📞 Phone Screen Simulator — chained 3-card session (syntax warmup + pattern L3 + mechanic-related L2 follow-up) under ONE unbroken timer. Cat 2 Paths & Sessions; distinct from Mock (single lesson) + Gauntlet (same-section L1 chain, no timer) via chained-different-lesson-types + single-timer combination
  constraintShift: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 }, // iter 148: 🚧 Constraint-Shift Drill — multi-card session showing canonical with swapped constraint claim; user rewrites; grade via runCode + per-entry structural-fingerprint regex (must NOT match for passage). First Cat 9 §9C ship ever; 5th sidecar registry (data/constraint-shifts.json)
  calibrateOn: false, // iter 119: ⏱ Time-to-Solve Calibration — opt-in toggle surfaces a pre-L3 estimate strip (default OFF)
  timeCalibration: { byMechanic: {}, meta: { estimates: 0, skips: 0, passes: 0 } }, // iter 119: byMechanic[id] = { predictions: [{bucket, actualMs, errorSec}], median errorSec computed on read }. meta tracks engagement separately (estimates = bucket taps; skips = skip taps; passes = passes-with-estimate)
  paceBarOn: false, // iter 140: ⏲ Pace-Bar — opt-in toggle (default OFF) surfaces a peripheral-vision width-growing bar above the L3 editor against user's OWN median time-to-solve. L75 anti-gamification mitigated: user's own median only (no global benchmark), no timer numerals, no streak, auto-hides when no data.
  hapticOn: false, // iter 141: 📳 Haptic Tap-Pulse — opt-in toggle (default OFF) fires navigator.vibrate on L1 correct (30ms) / L1 miss (2×60ms) / L3 pass (120ms) / Rapid-Fire streak-of-5 (3-pulse roll). Toggle button auto-hides on platforms where the Vibration API is absent (iOS Safari, desktop without vibration motor). Tactile dual-coding channel for mobile-first audience.
  commandUsage: {}, // iter 104: 🗺 Sidebar Command Palette — `{ [commandId]: count }` recent-use counter for fuzzy-search ranking (additive, no `__v` bump)
  misses: {},          // iter 58: { lessonId: [{ at: ms, level: 'L1'|'L2'|'L3', tag: string }] } — Mistake Tagging Postmortem (additive, opt-in)
  subscribedPathId: 'starter', // which study plan the user is on — see PATHS registry. Routes the 📅 button. Progress is shared across paths (keyed by lesson id), so switching never resets mastery.
  cramTaskChecks: {},  // { taskId: true } — non-lesson task ticks for cram-kind paths (e.g. "write BFS on paper"). Lesson-linked tasks auto-check via isLessonFullyDone.
  cramView: { mode: 'today', dayIndex: -1 },  // active Cram Home view. mode: 'today' (live day) | 'day' (specific past/future day, dayIndex set) | 'all' (all days expanded) | 'open-from' (only !done items from dayIndex).
  cramReview: { items: {}, session: null },  // SR over cram glossary/cheat/behavior/code-shapes. items[itemId] = { familiarity 0-3, lastReviewedAt }. session = active queue { queue, index, revealed, gotIt, fuzzy } | null.
  revealed: {},   // { lessonId: { L2: true, L3: true } } — track integrity
  lastLessonId: null, // persisted across sessions for resume
  lastTab: null,
  welcomed: false,    // hide welcome panel after first dismissal
  hideMastered: false, // sidebar filter: when true, drop fully-mastered lessons
  reviews: {},        // { lessonId: { lastPassedAt: ms, interval: ms, dueAt: ms } }
  weakness: {},       // { lessonId: wrongL1Count } — tracks recurring L1 misses
  sidebarTrack: 'syntax', // 'syntax' | 'patterns' — which binder tab is active
  // iter-32 scaffold: per-lesson event history for the sparkline (roadmap entry
  // iter-31 #6). Append-only (capped at HISTORY_MAX per lesson). Flag-gated
  // surface via window.__sparklineEnabled; render is no-op until iter-33 ship.
  history: {}         // { lessonId: [{ at: ms, event: 'L1-pass'|'L1-miss'|'L2-pass'|'L3-pass' }] }
};
// Expose script-scope state on window for E2E probes (tools/cdp/*).
// Production-safe: it's the same object the runtime uses; readers only.
window.__jsdrillState = state;

// In-flight per-tab state cache. Lives in memory only — survives tab
// switches inside the same lesson, cleared when the lesson changes.
// Solves BS-12: a user reaching for the Reference tab mid-attempt would
// otherwise wipe their L1 picks, L2 input values, and L3 editor text on
// every tab switch because each renderX() rebuilds its DOM from scratch.
// The cache holds DATA only (selections, typed values, code text) — never
// DOM refs, since renders create fresh elements.
const inProgressCache = {};   // { [lessonId]: { L1?: array, L2?: array, L3?: string } }
function _cacheGet(lessonId, level) {
  return inProgressCache[lessonId]?.[level];
}
function _cacheSet(lessonId, level, val) {
  inProgressCache[lessonId] = inProgressCache[lessonId] || {};
  inProgressCache[lessonId][level] = val;
}
function _cacheClearLesson(lessonId) {
  if (lessonId) delete inProgressCache[lessonId];
}
function _cacheClearLevel(lessonId, level) {
  if (inProgressCache[lessonId]) delete inProgressCache[lessonId][level];
}
// Expose for probes.
window.__jsdrillCache = inProgressCache;

// Mock interview attempts kept per lesson — enough to see a trend
// (improving / plateaued / regressing) without bloating localStorage.
const MOCK_HISTORY_MAX = 5;

// iter-32 scaffold: per-lesson event history capped at 50 entries (~6 weeks
// at 1 event/day). Larger caps would bloat localStorage; smaller would lose
// the 30-day window the sparkline targets per roadmap entry iter-31 #6.
const HISTORY_MAX = 50;

// iter 123: 🎹 L3 keyboard chips — one-tap insertion for high-cost JS tokens.
// Selection criteria: tokens where (typing cost on phone keyboard) × (frequency
// in canonical solutions) is high — paren/symbol/modifier-heavy beats short
// keywords. Order groups related chips: declarations, control flow, operators,
// collections, then property access. 12 chips wrap to 2 rows on iPhone-mini
// (390px). Insert strings include trailing spaces / parens where the next
// keystroke is almost always after — so `const ` not `const`. Bypassed during
// Mock Interview (no scaffolding by design). PROFILE 80%-phone L3-typing cost
// mitigation. Source: `ideas-by-category.md` § Cat 5 promotion shortlist #1.
const L3_CHIP_TOKENS = [
  { label: 'const', insert: 'const ' },
  { label: 'let', insert: 'let ' },
  { label: 'return', insert: 'return ' },
  { label: 'if (', insert: 'if (' },
  { label: 'for (', insert: 'for (' },
  { label: '=>', insert: ' => ' },
  { label: '===', insert: ' === ' },
  { label: '&&', insert: ' && ' },
  { label: '||', insert: ' || ' },
  { label: '[]', insert: '[]' },
  { label: '{}', insert: '{}' },
  { label: '.length', insert: '.length' }
];
function appendHistory(lessonId, event) {
  if (!lessonId) return;
  if (!state.history[lessonId]) state.history[lessonId] = [];
  state.history[lessonId].push({ at: Date.now(), event });
  if (state.history[lessonId].length > HISTORY_MAX) {
    state.history[lessonId] = state.history[lessonId].slice(-HISTORY_MAX);
  }
  // iter 107: keep the Session Heatstrip live. Cheap (30-cell DOM rebuild
  // + ~50-event walk) and event-driven — no polling.
  if (typeof renderHeatstrip === 'function') renderHeatstrip();
  // iter 141: 📳 Haptic Tap-Pulse — fire tactile feedback in tandem with the
  // event-stream write. Choke-point design means every L1-pass / L1-miss /
  // L3-pass call site (main L1 quiz, Gauntlet, What-If, Recognize, Bug-Hunt,
  // Match, etc.) gets haptic for free. L3-enter (iter 140) deliberately
  // omitted — instrumentation event, not user-graded. Rapid-Fire's L1-pass
  // case is wired DIRECTLY at the wasCorrect branch (line ~4242) because
  // Rapid-Fire intentionally skips appendHistory('L1-pass') to avoid
  // polluting the sparkline.
  _hapticPulse(event);
}

// iter 141: 📳 Haptic Tap-Pulse — single dispatch helper. All pulse patterns
// live in one place so future tweaks don't require touching call sites.
// Capability-guarded with try/catch so a partial-vibrate-implementation
// browser (e.g. one that defines navigator.vibrate but throws on unusual
// patterns) silently no-ops rather than breaking the calling drill-mode.
function _hapticPulse(eventType) {
  if (!state.hapticOn) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  let pattern;
  switch (eventType) {
    case 'L1-pass': pattern = 30; break;
    case 'L1-miss': pattern = [60, 80, 60]; break; // 2× 60ms pulse with 80ms gap
    case 'L3-pass': pattern = 120; break;
    case 'streak-5': pattern = [25, 35, 25, 35, 25]; break; // subtle 3-pulse roll
    default: return; // L3-enter / L2-pass / hint-tier-* / etc. — no haptic
  }
  try { navigator.vibrate(pattern); } catch (e) { /* graceful no-op */ }
}

// iter 107: ⏱ Session Heatstrip — per-minute activity timeline over the last
// 30 minutes. Walks `state.history` events per lesson; each event is bucketed
// into a 60-second cell offset from now. Dominant-event priority within a
// cell is L3-pass > L2-pass > L1-pass > L1-miss > other (richer signal wins
// — a minute that contains both an L1-pass and an L3-pass renders as L3).
// Returns `Array<{ kind, count, minutesAgo }>` where `kind` is one of
// 'l3-pass' | 'l2-pass' | 'l1-pass' | 'l1-miss' | 'other' | 'idle'.
// `count` is the number of events that landed in the cell (>=1 means non-idle).
// Used by renderHeatstrip; pure read-only over state.history.
const HEATSTRIP_LOOKBACK_MIN = 30;
const HEATSTRIP_MINUTE_MS = 60000;
function _heatstripCells(lookbackMinutes = HEATSTRIP_LOOKBACK_MIN) {
  const now = Date.now();
  const start = now - lookbackMinutes * HEATSTRIP_MINUTE_MS;
  const cells = Array.from({ length: lookbackMinutes }, (_, idx) => ({
    kind: 'idle', count: 0, minutesAgo: lookbackMinutes - 1 - idx
  }));
  const hist = state.history || {};
  // Priority table — higher number wins within a cell.
  const PRIORITY = { 'L3-pass': 4, 'L2-pass': 3, 'L1-pass': 2, 'L1-miss': 1 };
  const KIND_OF = { 'L3-pass': 'l3-pass', 'L2-pass': 'l2-pass', 'L1-pass': 'l1-pass', 'L1-miss': 'l1-miss' };
  const cellPriority = new Int8Array(lookbackMinutes);
  for (const lessonId of Object.keys(hist)) {
    const events = hist[lessonId] || [];
    for (const e of events) {
      if (typeof e.at !== 'number' || e.at < start || e.at > now) continue;
      const offsetMin = Math.floor((now - e.at) / HEATSTRIP_MINUTE_MS);
      if (offsetMin < 0 || offsetMin >= lookbackMinutes) continue;
      const cellIdx = lookbackMinutes - 1 - offsetMin;
      cells[cellIdx].count++;
      const p = PRIORITY[e.event] || 0;
      if (p > cellPriority[cellIdx]) {
        cellPriority[cellIdx] = p;
        cells[cellIdx].kind = KIND_OF[e.event] || 'other';
      } else if (p === 0 && cells[cellIdx].kind === 'idle') {
        // No priority match (e.g. 'hint-tier-1') but the cell DID have an
        // event — surface as 'other' so the user sees presence-of-activity.
        cells[cellIdx].kind = 'other';
      }
    }
  }
  return cells;
}

// iter 107: ⏱ Session Heatstrip — current-session summary for the tap-modal.
// Defines "session" as the most recent contiguous block of events with no
// >10-minute idle gap between consecutive events. Walks ALL events across
// ALL lessons, sorts by timestamp, then walks backwards from the most recent
// event including any event whose gap to its successor is ≤10 min. Returns
// `{ minActive, lessonsTouched, passes, missCount, eventCount, startedAt }`
// — facts, no scores (anti-gamification mitigation per iter-103 roadmap).
const HEATSTRIP_IDLE_GAP_MS = 10 * 60000;
function _heatstripSessionSummary() {
  const now = Date.now();
  const hist = state.history || {};
  const all = [];
  for (const lessonId of Object.keys(hist)) {
    for (const e of (hist[lessonId] || [])) {
      if (typeof e.at !== 'number') continue;
      all.push({ lessonId, at: e.at, event: e.event });
    }
  }
  if (!all.length) {
    return { minActive: 0, lessonsTouched: 0, passes: 0, missCount: 0, eventCount: 0, startedAt: null };
  }
  all.sort((a, b) => a.at - b.at);
  // Walk backwards from the latest event, including any event whose gap to
  // its successor is ≤ HEATSTRIP_IDLE_GAP_MS. Also bail if the latest event
  // is itself >10 min stale — no active session.
  const last = all[all.length - 1];
  if (now - last.at > HEATSTRIP_IDLE_GAP_MS) {
    return { minActive: 0, lessonsTouched: 0, passes: 0, missCount: 0, eventCount: 0, startedAt: null };
  }
  const sessionEvents = [last];
  for (let i = all.length - 2; i >= 0; i--) {
    if (sessionEvents[0].at - all[i].at > HEATSTRIP_IDLE_GAP_MS) break;
    sessionEvents.unshift(all[i]);
  }
  const startedAt = sessionEvents[0].at;
  const minActive = Math.max(1, Math.round((last.at - startedAt) / HEATSTRIP_MINUTE_MS));
  const lessonsTouched = new Set(sessionEvents.map(e => e.lessonId)).size;
  const passes = sessionEvents.filter(e => e.event && e.event.endsWith('-pass')).length;
  const missCount = sessionEvents.filter(e => e.event === 'L1-miss').length;
  return {
    minActive, lessonsTouched, passes, missCount,
    eventCount: sessionEvents.length, startedAt
  };
}

// iter 46: counts L3 attempts (windowed to last K) where the user invoked
// any hint tier OR the critical-lines scaffold. An "attempt" is bounded by
// L3-pass events; events between two L3-passes (or after the last L3-pass)
// count as one attempt. Used by renderL3 to surface a metacognitive
// "you needed hints on N of last K attempts" badge — trending DOWN over
// SR intervals is the PROFILE line 65/66 retention signal the iter-37
// hints-used metric was designed to capture (Parking-lotted iter 45,
// reactivated here as a side effect of iter-43 walkthrough gap #3).
function _countHintAttempts(lessonId, lookbackAttempts = 5) {
  const events = state.history?.[lessonId] || [];
  if (events.length === 0) return { hinted: 0, total: 0 };
  // Walk forward, group by attempt (terminated by L3-pass). Attempt = "all
  // events up to and including the next L3-pass." Unfinished trailing
  // attempts (no terminating L3-pass) count too.
  const attempts = [];
  let cur = { hinted: false };
  for (const e of events) {
    if (e.event && (e.event.startsWith('hint-tier-') || e.event === 'critical-lines-used')) {
      cur.hinted = true;
    }
    if (e.event === 'L3-pass') {
      attempts.push(cur);
      cur = { hinted: false };
    }
  }
  // Trailing in-progress attempt only counts if it has hint events (so an
  // unhinted in-progress attempt doesn't deflate the ratio).
  if (cur.hinted) attempts.push(cur);
  const recent = attempts.slice(-lookbackAttempts);
  const hinted = recent.filter(a => a.hinted).length;
  return { hinted, total: recent.length };
}

// iter 101: 📐 Per-attempt hint-cost ribbon helper. Walks `state.history` for
// one lesson and returns per-attempt buckets (most recent last). Each item:
// `{ hintCount, passed }`. `hintCount` is the unique-tier count of `hint-tier-*`
// + `critical-lines-used` events within an attempt window (bounded by L3-pass).
// Powers the L3 trend-chip ribbon (0 hints = green ✓ / 1-2 = amber / 3+ = red).
// Trailing in-progress attempt (no terminating L3-pass) is dropped from the
// ribbon — only completed passes are visualized.
function _perAttemptHintCounts(lessonId, lookbackAttempts = 5) {
  const events = state.history?.[lessonId] || [];
  if (events.length === 0) return [];
  const attempts = [];
  let curTiers = new Set();
  for (const e of events) {
    if (!e.event) continue;
    if (e.event.startsWith('hint-tier-') || e.event === 'critical-lines-used') {
      curTiers.add(e.event);
    } else if (e.event === 'L3-pass') {
      attempts.push({ hintCount: curTiers.size, passed: true });
      curTiers = new Set();
    }
  }
  return attempts.slice(-lookbackAttempts);
}

// iter 101: 🎯 Self-rescue rate — global aggregator across ALL lessons in
// `state.history`. Walks every lesson, groups events into L3-pass-bounded
// attempts, counts attempts that completed with ZERO hints (i.e., the user
// self-rescued through the L3 drill without leaning on a scaffold). Returns
// `{ zeroHint, total, rate }` where rate is 0-100 integer. Used by the
// Stats-modal Self-rescue tile. Quality-of-pass measurement — closes
// the iter-37 deferred metric ("hints-used-per-attempt"). Pre-iter-32
// passes have no `hint-tier-*` events and are silently excluded — the
// tile renders with "since you started tracking" framing.
function _selfRescueRateGlobal() {
  let zeroHint = 0;
  let total = 0;
  const hist = state.history || {};
  for (const lessonId of Object.keys(hist)) {
    const events = hist[lessonId] || [];
    let curTiers = new Set();
    for (const e of events) {
      if (!e.event) continue;
      if (e.event.startsWith('hint-tier-') || e.event === 'critical-lines-used') {
        curTiers.add(e.event);
      } else if (e.event === 'L3-pass') {
        total++;
        if (curTiers.size === 0) zeroHint++;
        curTiers = new Set();
      }
    }
  }
  return {
    zeroHint,
    total,
    rate: total > 0 ? Math.round((zeroHint / total) * 100) : 0
  };
}

// iter 106: 📈 Mastery Half-Life — per-lesson longitudinal SR signal.
// Walks `state.history` for each lesson, extracts L3-pass timestamps, and
// computes the median gap between consecutive passes (= cycle interval the
// user has been holding the lesson at). Buckets each lesson by half-life:
//   Sticky   — median gap >14 days   (holding well)
//   Normal   — median gap 3-14 days  (active rotation)
//   Slippery — median gap <3 days    (slipping; comes back fast)
// Lessons with <2 L3-pass events are silently excluded (need at least one
// gap to compute) — empty bucket counts let the tile auto-hide gracefully.
// Returns `{ sticky, normal, slippery, slipperyList }` where slipperyList
// is the top-N (default 5) slippery lessons sorted by *shortest* median
// gap first — those are the most urgent to re-route into. Closes the
// PROFILE.md L67 measurement gap ("Mastered lessons stay mastered across
// SR intervals") — neither Decay Radar (right-now risk) nor Resurrect
// Queue (overdue) captures the longitudinal personality of a lesson.
const HALF_LIFE_STICKY_DAYS = 14;
const HALF_LIFE_NORMAL_DAYS = 3;
const HALF_LIFE_DAY_MS = 86400000;
function _masteryHalfLife(slipperyTopN = 5) {
  const hist = state.history || {};
  const out = { sticky: 0, normal: 0, slippery: 0, slipperyList: [] };
  const slippery = [];  // [{lessonId, medianGapMs, passCount}]
  for (const lessonId of Object.keys(hist)) {
    const events = hist[lessonId] || [];
    const passTimes = [];
    for (const e of events) {
      if (e.event === 'L3-pass' && typeof e.at === 'number') passTimes.push(e.at);
    }
    if (passTimes.length < 2) continue;
    passTimes.sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < passTimes.length; i++) gaps.push(passTimes[i] - passTimes[i - 1]);
    gaps.sort((a, b) => a - b);
    const mid = Math.floor(gaps.length / 2);
    const medianGapMs = gaps.length % 2 === 0
      ? (gaps[mid - 1] + gaps[mid]) / 2
      : gaps[mid];
    const days = medianGapMs / HALF_LIFE_DAY_MS;
    if (days > HALF_LIFE_STICKY_DAYS) out.sticky++;
    else if (days >= HALF_LIFE_NORMAL_DAYS) out.normal++;
    else { out.slippery++; slippery.push({ lessonId, medianGapMs, passCount: passTimes.length }); }
  }
  slippery.sort((a, b) => a.medianGapMs - b.medianGapMs);
  out.slipperyList = slippery.slice(0, slipperyTopN);
  return out;
}

// iter 140: ⏲ Pace-Bar — per-lesson rolling median time-to-solve for the
// peripheral-vision tempo bar above L3. Returns ms median or null when not
// enough data. Two data sources, in priority order:
//   1. state.mockHistory[lessonId] (≥2 entries) — clean ms durations from
//      timed mock-interview attempts.
//   2. Derived from state.history L3-enter → L3-pass deltas (≥2 deltas).
//      Each delta is capped at PACE_BAR_ATTEMPT_CAP_MS (60 min) so an
//      "I left the tab open overnight" outlier doesn't poison the median.
// If neither source yields ≥2 samples, returns null and the bar auto-hides.
// L75 mitigation: this function never reads or returns a global benchmark —
// only the user's own data.
const PACE_BAR_ATTEMPT_CAP_MS = 60 * 60 * 1000;
function _paceBarMedianMs(lessonId) {
  const median = (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const mock = state.mockHistory?.[lessonId] || [];
  if (mock.length >= 2) return median(mock);
  const events = state.history?.[lessonId] || [];
  const deltas = [];
  let lastEnter = null;
  for (const e of events) {
    if (!e || typeof e.at !== 'number') continue;
    if (e.event === 'L3-enter') {
      lastEnter = e.at;
    } else if (e.event === 'L3-pass' && lastEnter !== null) {
      const d = e.at - lastEnter;
      if (d > 0 && d <= PACE_BAR_ATTEMPT_CAP_MS) deltas.push(d);
      lastEnter = null;
    }
  }
  if (deltas.length < 2) return null;
  return median(deltas);
}

// Per-track pill metadata — keep this in one place so the lesson header,
// Today's plan modal, and any future track-aware surface stay in sync.
// Without it, the header read "Pattern" for applied-track lessons (the
// fallback when track !== 'syntax').
const TRACK_PILLS = {
  syntax:   { cls: 'pill-syntax',  label: 'Syntax' },
  patterns: { cls: 'pill-pattern', label: 'Pattern' },
  applied:  { cls: 'pill-applied', label: 'Applied' },
};

// Study-plan registry. The user subscribes to exactly one (state.subscribedPathId).
// Populated from data/paths.json on boot via loadPaths(). Each entry:
//   { id, label, icon, kind, blurb, lessons: [lessonId, ...], [url] }
// The 📅 Today's Plan button routes by the subscribed path's `kind`:
//   - 'lessons' → opens the in-app Today's Plan modal (curated due/path/weak session)
//   - 'prep'    → navigates to a standalone dashboard page (e.g. prep.html)
// The 🧭 Path View sidebar filter scopes the sidebar to the path's drill-lesson
// sequence (path.lessons). A path with empty lessons[] disables the 🧭 button.
// Progress is keyed by lesson id, NOT by path, so switching plans never resets
// mastery — two-sum stays mastered whether you reach it via Starter or Prep.
// Adding a new path is now a pure-data change: append an entry to data/paths.json.
let PATHS = []; // populated by loadPaths() on boot

async function loadPaths() {
  try {
    const res = await fetch('data/paths.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Paths fetch failed: ' + res.status);
    const data = await res.json();
    PATHS = Array.isArray(data.paths) ? data.paths : [];
  } catch (e) {
    console.warn('[paths] fetch failed, using minimal Starter-only fallback:', e);
    // Defensive fallback so the app still boots into Starter Path mode even when
    // data/paths.json is missing or malformed. lessons:[] disables 🧭 Path View
    // (would otherwise crash trying to filter on an undefined sequence).
    PATHS = [{
      id: 'starter',
      label: 'Starter Path',
      icon: '🧭',
      kind: 'lessons',
      blurb: 'Linear recommended order through the full JS Drill curriculum.',
      lessons: []
    }];
  }
}

function getSubscribedPath() {
  return PATHS.find(p => p.id === state.subscribedPathId) || PATHS[0];
}

// Resolve a path's ordered drill-lesson list from its `lessons` field
// (populated from data/paths.json by loadPaths). Returns null for paths
// with no/empty drill-lesson sequence (→ 🧭 Path View disabled).
function getPathLessonOrder(path) {
  if (!path) return null;
  return Array.isArray(path.lessons) && path.lessons.length ? path.lessons : null;
}

// True when the subscribed path exposes a non-empty drill-lesson sequence the
// sidebar can filter to. Drives the enabled/disabled state of the 🧭 button.
function subscribedPathHasLessons() {
  const order = getPathLessonOrder(getSubscribedPath());
  return Array.isArray(order) && order.length > 0;
}

// For kind:'cram' paths, returns the 0-based index of the day the user is on,
// or -1 when the cycle has ended. Before-start clamps to 0 (preview Day 1);
// after-end returns -1 so callers fall through to pure SR mode.
function getCramDayIndex(path) {
  if (!path || path.kind !== 'cram' || !Array.isArray(path.days) || !path.days.length) return -1;
  if (!path.startIso) return 0;
  const todayIso = new Date().toISOString().slice(0, 10);
  if (todayIso < path.startIso) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = new Date(path.startIso + 'T00:00:00').getTime();
  const today = new Date(todayIso + 'T00:00:00').getTime();
  const diff = Math.floor((today - start) / msPerDay);
  return diff >= path.days.length ? -1 : diff;
}

function isCramTaskDone(task) {
  if (task.lessonId) {
    return window.DrillStorage && window.DrillStorage.isLessonFullyDone(task.lessonId);
  }
  return !!state.cramTaskChecks[task.id];
}

function _cramDayProgress(day) {
  let total = 0, done = 0;
  for (const b of day.blocks) for (const t of b.tasks) { total++; if (isCramTaskDone(t)) done++; }
  return { total, done, pct: total ? Math.round(100 * done / total) : 0 };
}

function _cramRenderTaskRow(task, opts = {}) {
  const done = isCramTaskDone(task);
  if (opts.openOnly && done) return '';
  const lesson = task.lessonId ? findLesson(task.lessonId) : null;
  const lessonTitle = lesson ? lesson.title : '';
  const minsBadge = task.mins != null ? `<span style="font-size:11px;color:#64748b;">~${task.mins} min</span>` : '';
  const checkAttr = task.lessonId ? 'disabled' : '';
  const checkTitle = task.lessonId ? 'Ticks automatically when you master the linked lesson' : 'Tap to mark done';
  const lessonBtn = task.lessonId
    ? `<button data-cram-open="${escapeHtml(task.lessonId)}" style="background:#1e293b;color:#67e8f9;border:none;border-radius:5px;padding:3px 9px;font-size:11px;cursor:pointer;font-weight:500;">Open →</button>`
    : '';
  const redoBtn = (!task.lessonId && done)
    ? `<button data-cram-redo="${escapeHtml(task.id)}" title="Re-open this task" style="background:none;border:none;color:#fdba74;cursor:pointer;font-size:11px;text-decoration:underline;">↻ redo</button>`
    : '';
  const lessonBadge = lessonTitle ? `: <strong style="color:#e2e8f0;">${escapeHtml(lessonTitle)}</strong>` : '';
  return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-top:1px solid #1e293b;${done ? 'opacity:0.55;' : ''}">
    <input type="checkbox" data-cram-check="${escapeHtml(task.id)}" ${done ? 'checked' : ''} ${checkAttr} title="${escapeHtml(checkTitle)}" style="margin-top:3px;cursor:${task.lessonId ? 'default' : 'pointer'};" />
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;line-height:1.5;color:#cbd5e1;${done ? 'text-decoration:line-through;' : ''}">${escapeHtml(task.label)}${lessonBadge}</div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:6px;flex-wrap:wrap;">${minsBadge}${lessonBtn}${redoBtn}</div>
    </div>
  </div>`;
}

function _cramRenderDayBody(day, dayIdx, opts = {}) {
  const p = _cramDayProgress(day);
  const openOnly = !!opts.openOnly;
  const collapseDone = !!opts.collapseDone;
  const blocksHtml = day.blocks.map(block => {
    const blockDone = block.tasks.filter(isCramTaskDone).length;
    const blockTotal = block.tasks.length;
    const blockComplete = blockDone === blockTotal && blockTotal > 0;
    const tasksHtml = block.tasks.map(t => _cramRenderTaskRow(t, { openOnly })).join('');
    if (openOnly && blockDone === blockTotal) return '';
    const expanded = !(collapseDone && blockComplete);
    return `<details ${expanded ? 'open' : ''} style="background:#0b1220;border:1px solid #1e293b;border-radius:8px;margin-bottom:8px;">
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
  const checkpoints = (day.checkpoints && day.checkpoints.length && !openOnly)
    ? `<div style="margin-top:12px;background:#0b1220;border-left:3px solid #34d399;border-radius:8px;padding:12px 14px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#34d399;font-weight:600;margin-bottom:6px;">End-of-day checkpoints</div>
        <ul style="margin:0;padding-left:18px;color:#94a3b8;font-size:13px;line-height:1.5;">${day.checkpoints.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
      </div>`
    : '';
  const header = `<div style="display:flex;align-items:center;gap:10px;margin:14px 0 10px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:16px;font-weight:700;color:#e2e8f0;">Day ${day.day} — ${escapeHtml(day.title)}</div>
        <div style="font-size:12px;color:#94a3b8;">${escapeHtml(day.date || '')}</div>
      </div>
      <div style="flex-shrink:0;display:flex;align-items:center;gap:8px;">
        <div style="width:80px;height:6px;background:#1e293b;border-radius:3px;overflow:hidden;"><div style="height:100%;background:linear-gradient(90deg,#38bdf8,#34d399);width:${p.pct}%;"></div></div>
        <span style="font-size:12px;color:#94a3b8;font-variant-numeric:tabular-nums;">${p.done}/${p.total}</span>
        ${opts.allowRedrill && !openOnly ? `<button data-cram-redrill-day="${dayIdx}" title="Reset this day's manual ticks (lesson mastery stays)" style="background:#1e293b;color:#fdba74;border:none;border-radius:5px;padding:4px 8px;font-size:11px;cursor:pointer;">🎯 Re-drill</button>` : ''}
      </div>
    </div>`;
  return `<div data-cram-day-section="${dayIdx}">${header}${blocksHtml}${checkpoints}</div>`;
}

function renderCramHome(path) {
  const shell = document.getElementById('lesson-shell');
  const view = state.cramView || { mode: 'today', dayIndex: -1 };
  const todayIdx = getCramDayIndex(path);
  const isPastEnd = todayIdx < 0;
  const effectiveTodayIdx = isPastEnd ? path.days.length - 1 : todayIdx;
  const focusIdx = (view.mode === 'today') ? effectiveTodayIdx
    : (view.mode === 'day' || view.mode === 'open-from')
      ? Math.max(0, Math.min(path.days.length - 1, view.dayIndex))
      : effectiveTodayIdx;

  const stripChips = path.days.map((d, i) => {
    const p = _cramDayProgress(d);
    const isToday = i === todayIdx;
    const isActive = (view.mode === 'today' && i === effectiveTodayIdx) ||
                     (view.mode === 'day' && i === view.dayIndex) ||
                     (view.mode === 'open-from' && i === view.dayIndex);
    const border = isActive ? '#34d399' : (isToday ? '#67e8f9' : '#1e293b');
    const bg = isActive ? 'rgba(52,211,153,0.10)' : '#0b1220';
    return `<button data-cram-day="${i}" style="flex-shrink:0;background:${bg};border:1.5px solid ${border};border-radius:8px;padding:8px 12px;cursor:pointer;color:#cbd5e1;font-family:inherit;text-align:left;min-width:84px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;">Day ${i + 1}${isToday ? ' · today' : ''}</div>
      <div style="font-size:12px;font-weight:600;color:#cbd5e1;margin-top:2px;">${escapeHtml(d.title.slice(0, 22))}</div>
      <div style="font-size:11px;color:${p.done === p.total ? '#34d399' : '#94a3b8'};font-variant-numeric:tabular-nums;margin-top:3px;">${p.done}/${p.total} · ${p.pct}%</div>
    </button>`;
  }).join('');
  const allActive = view.mode === 'all';
  const allChip = `<button data-cram-all style="flex-shrink:0;background:${allActive ? 'rgba(52,211,153,0.10)' : '#0b1220'};border:1.5px solid ${allActive ? '#34d399' : '#1e293b'};border-radius:8px;padding:8px 12px;cursor:pointer;color:#cbd5e1;font-family:inherit;min-width:60px;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:600;">View</div>
    <div style="font-size:12px;font-weight:600;margin-top:2px;">All days</div>
  </button>`;
  const stripHtml = `<div style="display:flex;gap:8px;overflow-x:auto;padding:6px 2px 14px;-webkit-overflow-scrolling:touch;">${stripChips}${allChip}</div>`;

  let carryoverHtml = '';
  if ((view.mode === 'today' || (view.mode === 'day' && view.dayIndex >= todayIdx)) && todayIdx > 0) {
    const carryover = [];
    for (let i = 0; i < todayIdx; i++) {
      const d = path.days[i];
      let open = 0;
      for (const b of d.blocks) for (const t of b.tasks) { if (!isCramTaskDone(t)) open++; }
      if (open) carryover.push({ idx: i, open, title: d.title });
    }
    if (carryover.length) {
      carryoverHtml = `<div style="background:rgba(249,115,22,0.10);border:1px solid rgba(249,115,22,0.35);border-radius:10px;padding:12px 14px;margin-bottom:14px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#fdba74;font-weight:700;margin-bottom:8px;">⚠ Carryover · unfinished from earlier days</div>
        ${carryover.map(c => `<button data-cram-open-from="${c.idx}" style="display:block;width:100%;text-align:left;background:#0b1220;border:1px solid #1e293b;border-radius:6px;padding:8px 12px;margin-top:6px;color:#e2e8f0;cursor:pointer;font-family:inherit;">
          <span style="font-size:13px;">${c.open} open from <strong>Day ${c.idx + 1} — ${escapeHtml(c.title)}</strong></span>
          <span style="float:right;color:#fdba74;font-size:11px;">Focus →</span>
        </button>`).join('')}
      </div>`;
    }
  }

  let rocksHtml = '';
  if (Array.isArray(path.bigRocks) && path.bigRocks.length && view.mode !== 'open-from') {
    const openByDefault = todayIdx <= 0 && view.mode === 'today';
    rocksHtml = `<details ${openByDefault ? 'open' : ''} style="background:rgba(249,115,22,0.07);border:1px solid rgba(249,115,22,0.25);border-radius:10px;padding:8px 14px;margin-bottom:14px;">
      <summary style="cursor:pointer;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#fdba74;font-weight:700;list-style:none;">⚠ ${path.bigRocks.length} Big Rocks · the gaps to close</summary>
      <ol style="margin:8px 0 4px;padding-left:22px;font-size:13px;color:#cbd5e1;line-height:1.6;">
        ${path.bigRocks.map(r => `<li><strong style="color:#fdba74;">${escapeHtml(r.rock)}</strong> — ${escapeHtml(r.detail)}</li>`).join('')}
      </ol>
    </details>`;
  }

  let endedHtml = '';
  if (isPastEnd && (view.mode === 'today' || view.mode === 'day')) {
    endedHtml = `<div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.3);border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:13px;color:#cbd5e1;">
      ✓ Cram cycle complete. Spaced review keeps every lesson you covered alive — check 🕒 Review for what's due today.
    </div>`;
  }

  let bodyHtml = '';
  if (view.mode === 'all') {
    bodyHtml = path.days.map((d, i) => _cramRenderDayBody(d, i, { allowRedrill: i < todayIdx, collapseDone: i < todayIdx })).join('');
  } else if (view.mode === 'open-from') {
    bodyHtml = `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#fdba74;font-weight:700;margin-top:8px;">Open items only · Day ${view.dayIndex + 1}</div>` +
      _cramRenderDayBody(path.days[focusIdx], focusIdx, { openOnly: true });
  } else {
    bodyHtml = _cramRenderDayBody(path.days[focusIdx], focusIdx, { allowRedrill: focusIdx < todayIdx });
  }

  shell.innerHTML = `<div style="max-width:760px;margin:0 auto;padding:0;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:6px;">
      <h1 style="font-size:20px;font-weight:700;color:#f8fafc;margin:0;">⏱ ${escapeHtml(path.label)}</h1>
      <span style="font-size:12px;color:#94a3b8;">${isPastEnd ? 'cycle complete' : `Day ${todayIdx + 1} of ${path.days.length}`}</span>
    </div>
    <div style="font-size:13px;color:#94a3b8;margin-bottom:10px;">${escapeHtml(path.blurb || '')}</div>
    ${stripHtml}
    ${endedHtml}
    ${rocksHtml}
    ${carryoverHtml}
    ${bodyHtml}
  </div>`;

  // Wire interactions
  const rerender = () => renderCramHome(path);
  shell.querySelectorAll('[data-cram-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.getAttribute('data-cram-day'), 10);
      state.cramView = { mode: i === todayIdx ? 'today' : 'day', dayIndex: i };
      saveProgress();
      rerender();
    });
  });
  const allBtn = shell.querySelector('[data-cram-all]');
  if (allBtn) allBtn.addEventListener('click', () => {
    state.cramView = { mode: 'all', dayIndex: -1 };
    saveProgress();
    rerender();
  });
  shell.querySelectorAll('[data-cram-open-from]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.getAttribute('data-cram-open-from'), 10);
      state.cramView = { mode: 'open-from', dayIndex: i };
      saveProgress();
      rerender();
    });
  });
  shell.querySelectorAll('[data-cram-check]').forEach(cb => {
    cb.addEventListener('click', (e) => {
      const id = cb.getAttribute('data-cram-check');
      if (cb.disabled) { e.preventDefault(); return; }
      if (cb.checked) state.cramTaskChecks[id] = true;
      else delete state.cramTaskChecks[id];
      saveProgress();
      updateCramProgressStrip();
      rerender();
    });
  });
  shell.querySelectorAll('[data-cram-redo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cram-redo');
      delete state.cramTaskChecks[id];
      saveProgress();
      updateCramProgressStrip();
      rerender();
    });
  });
  shell.querySelectorAll('[data-cram-redrill-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.getAttribute('data-cram-redrill-day'), 10);
      if (!confirm(`Reset Day ${i + 1}'s manual ticks? (Lesson mastery stays put.)`)) return;
      const day = path.days[i];
      for (const b of day.blocks) for (const t of b.tasks) {
        if (!t.lessonId) delete state.cramTaskChecks[t.id];
      }
      saveProgress();
      updateCramProgressStrip();
      rerender();
    });
  });
  shell.querySelectorAll('[data-cram-open]').forEach(btn => {
    btn.addEventListener('click', () => selectLesson(btn.getAttribute('data-cram-open')));
  });
}

// Returns the user to the Cram Home view by clearing the active lesson.
// Phase 2 entry point for the today-btn and topbar-strip clicks when on cram.
function goToCramHome() {
  state.currentLessonId = null;
  saveProgress();
  if (typeof renderSidebar === 'function') renderSidebar();
  renderLesson();
}

// Phase 3: cram-reference content. Loaded lazily on first modal open.
let CRAM_REFS = { glossary: null, cheat: null, behavior: null };
async function loadCramRefs() {
  if (CRAM_REFS.glossary && CRAM_REFS.cheat && CRAM_REFS.behavior) return CRAM_REFS;
  try {
    const [g, c, b] = await Promise.all([
      fetch('data/cram-glossary.json', { cache: 'no-cache' }).then(r => r.json()),
      fetch('data/cram-cheat.json', { cache: 'no-cache' }).then(r => r.json()),
      fetch('data/cram-behavior.json', { cache: 'no-cache' }).then(r => r.json())
    ]);
    CRAM_REFS = { glossary: g.terms || [], cheat: c.rows || [], behavior: b.cards || [] };
  } catch (e) {
    console.warn('[cram-refs] load failed', e);
    CRAM_REFS = { glossary: [], cheat: [], behavior: [] };
  }
  return CRAM_REFS;
}

// 6 Must-Know Code Shapes — interview canonical snippets. Each shape maps to
// a representative lesson in the existing curriculum (the canonical IS the
// lesson — single source of truth). Tap → drill the lesson.
const CRAM_CODE_SHAPES = [
  { title: '1. Binary Search (closed interval)', note: "Invariant: if target exists, it is in arr[lo..hi]. After the loop, lo === hi + 1.", lessonId: 'binary-search' },
  { title: '2. BFS (graph or tree level-order)', note: "Queue + visited Set. For level-order: capture queue.length at the top of each iteration — that's the number of nodes in the current level.", lessonId: 's-bfs-template' },
  { title: '3. DFS (in/pre/post-order)', note: "Pre-order: work BEFORE children. Post-order: work AFTER children — needed when the parent's result depends on the children's results (e.g. tree height).", lessonId: 's-tree-traversals' },
  { title: '4. Sliding Window (variable size)', note: 'Works when the "valid window" condition is monotonic as you grow the window. Breaks if growing can both make it more AND less valid (e.g. sums with negatives — use prefix-sum + deque).', lessonId: 'p-longest-sub' },
  { title: '5. Two Pointers (sorted array)', note: 'Key insight: at each step, you eliminate ALL pairs involving the moved index — that\'s why two pointers is O(n), not O(n²).', lessonId: 'valid-palindrome' },
  { title: '6. Heap-of-K (for "K most ___")', note: "Maintain a min-heap of size K. On each new v: if heap.size < K → push; else if v > heap.top → pop+push v. O(N log K) time, O(K) space.", lessonId: 's-heap-ops' }
];

function _openCramRefModal({ title, sub, searchPlaceholder, bodyHtml, onSearch, onBody }) {
  const modal = document.getElementById('cram-ref-modal');
  const titleEl = document.getElementById('cram-ref-title');
  const subEl = document.getElementById('cram-ref-sub');
  const search = document.getElementById('cram-ref-search');
  const body = document.getElementById('cram-ref-body');
  if (!modal || !body) return;
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub || '';
  if (searchPlaceholder) {
    search.placeholder = searchPlaceholder;
    search.value = '';
    search.hidden = false;
    search.oninput = () => onSearch && onSearch(search.value, body);
  } else {
    search.hidden = true;
    search.oninput = null;
  }
  body.innerHTML = bodyHtml;
  if (onBody) onBody(body);
  modal.style.display = 'block';
}

function _matchesSearch(q, ...fields) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some(f => (f || '').toLowerCase().includes(needle));
}

async function openCramCheatModal() {
  await loadCramRefs();
  const renderRows = (q) => CRAM_REFS.cheat
    .filter(r => _matchesSearch(q, r.trigger, r.pattern))
    .map(r => {
      const lesson = r.lessonId ? findLesson(r.lessonId) : null;
      const lessonBadge = lesson
        ? `<button data-cram-ref-lesson="${escapeHtml(r.lessonId)}" style="background:#1e293b;color:#67e8f9;border:none;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:500;font-family:inherit;">${escapeHtml(lesson.title)} →</button>`
        : '';
      return `<div style="background:#0b1220;border:1px solid #1e293b;border-radius:8px;padding:12px 14px;">
        <div style="font-size:11px;color:#94a3b8;font-style:italic;line-height:1.5;">${escapeHtml(r.trigger)}</div>
        <div style="font-size:14px;color:#e2e8f0;margin-top:6px;font-weight:500;">${escapeHtml(r.pattern)}</div>
        ${lessonBadge ? `<div style="margin-top:8px;">${lessonBadge}</div>` : ''}
      </div>`;
    }).join('') || `<div style="color:#64748b;text-align:center;padding:24px;font-size:13px;">No rows match.</div>`;
  _openCramRefModal({
    title: '⚡ Cheat — which pattern when?',
    sub: 'Cue → pattern → tap to drill the canonical lesson.',
    searchPlaceholder: 'Filter cues or patterns…',
    bodyHtml: renderRows(''),
    onSearch: (q, body) => { body.innerHTML = renderRows(q); wireCramRefLessonBtns(); },
    onBody: wireCramRefLessonBtns
  });
}

async function openCramGlossaryModal() {
  await loadCramRefs();
  const renderTerms = (q) => CRAM_REFS.glossary
    .filter(t => _matchesSearch(q, t.term, t.def, t.where))
    .map(t => `<div style="background:#0b1220;border:1px solid #1e293b;border-radius:8px;padding:12px 14px;">
      <div style="font-size:14px;font-weight:600;color:#67e8f9;margin-bottom:4px;">${escapeHtml(t.term)}</div>
      <div style="font-size:13px;color:#e2e8f0;line-height:1.55;">${escapeHtml(t.def)}</div>
      ${t.where ? `<div style="font-size:11px;color:#94a3b8;margin-top:8px;padding-top:8px;border-top:1px solid #1e293b;"><strong style="color:#64748b;">Where:</strong> ${escapeHtml(t.where)}</div>` : ''}
    </div>`).join('') || `<div style="color:#64748b;text-align:center;padding:24px;font-size:13px;">No terms match.</div>`;
  _openCramRefModal({
    title: `🅰 Glossary — ${CRAM_REFS.glossary.length} interview terms`,
    sub: 'Definitions and where each term shows up in problems.',
    searchPlaceholder: 'Filter terms or definitions…',
    bodyHtml: renderTerms(''),
    onSearch: (q, body) => { body.innerHTML = renderTerms(q); }
  });
}

async function openCramBehaviorModal() {
  await loadCramRefs();
  _openCramRefModal({
    title: '🎤 Interview Behavior',
    sub: 'The 8-step say-this-in-the-interview ritual.',
    bodyHtml: CRAM_REFS.behavior.map(c => `<div style="background:#0b1220;border-left:3px solid #67e8f9;border-radius:8px;padding:12px 14px;">
      <div style="font-size:11px;color:#67e8f9;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:4px;">${escapeHtml(c.num)}</div>
      <div style="font-size:14px;font-weight:600;color:#e2e8f0;margin-bottom:6px;">${escapeHtml(c.title)}</div>
      <div style="font-size:13px;color:#cbd5e1;line-height:1.55;">${escapeHtml(c.body)}</div>
    </div>`).join('')
  });
}

function openCramShapesModal() {
  const path = getSubscribedPath();
  const reviewedSet = new Set((path && path.lessons) ? path.lessons : []);
  _openCramRefModal({
    title: '〈〉 6 Must-Know Code Shapes',
    sub: 'Each shape is a canonical lesson. Tap to drill.',
    bodyHtml: CRAM_CODE_SHAPES.map(s => {
      const lesson = findLesson(s.lessonId);
      const mastered = window.DrillStorage && window.DrillStorage.isLessonFullyDone(s.lessonId);
      const dotColor = mastered ? '#34d399' : '#475569';
      return `<div style="background:#0b1220;border:1px solid #1e293b;border-radius:8px;padding:12px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="width:8px;height:8px;border-radius:50%;background:${dotColor};display:inline-block;flex-shrink:0;"></span>
              <span style="font-size:14px;font-weight:600;color:#e2e8f0;">${escapeHtml(s.title)}</span>
            </div>
            <div style="font-size:13px;color:#94a3b8;margin-top:6px;line-height:1.5;">${escapeHtml(s.note)}</div>
          </div>
          <button data-cram-ref-lesson="${escapeHtml(s.lessonId)}" style="background:#1e293b;color:#67e8f9;border:none;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:500;font-family:inherit;flex-shrink:0;">${lesson ? 'Drill →' : 'Missing'}</button>
        </div>
      </div>`;
    }).join(''),
    onBody: wireCramRefLessonBtns
  });
}

function wireCramRefLessonBtns() {
  document.querySelectorAll('[data-cram-ref-lesson]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cram-ref-lesson');
      document.getElementById('cram-ref-modal').style.display = 'none';
      selectLesson(id);
    });
  });
}

// Phase 4: Daily Review SR over cram reference content.
const CRAM_SR_INTERVAL_DAYS = [0, 1, 2, 4];           // tier → days until next due
const CRAM_SR_SAMPLE = { glossary: 5, cheat: 4, behavior: 2, code: 3 };

function cramReviewableItems() {
  const out = [];
  if (CRAM_REFS.glossary) {
    for (const g of CRAM_REFS.glossary) {
      out.push({ id: 'g:' + g.term, type: 'glossary', prompt: g.term, answer: g.def, where: g.where });
    }
  }
  if (CRAM_REFS.cheat) {
    for (let i = 0; i < CRAM_REFS.cheat.length; i++) {
      const r = CRAM_REFS.cheat[i];
      out.push({ id: 'p:' + i, type: 'cheat', prompt: r.trigger, answer: r.pattern, lessonId: r.lessonId });
    }
  }
  if (CRAM_REFS.behavior) {
    for (let i = 0; i < CRAM_REFS.behavior.length; i++) {
      const c = CRAM_REFS.behavior[i];
      out.push({ id: 'b:' + i, type: 'behavior', prompt: c.title, answer: c.body, where: c.num });
    }
  }
  for (let i = 0; i < CRAM_CODE_SHAPES.length; i++) {
    const s = CRAM_CODE_SHAPES[i];
    out.push({ id: 's:' + i, type: 'code', prompt: s.title, answer: s.note, lessonId: s.lessonId });
  }
  return out;
}

function cramReviewGet(id) {
  return state.cramReview.items[id] || { familiarity: 0, lastReviewedAt: 0 };
}
function cramReviewSet(id, patch) {
  state.cramReview.items[id] = Object.assign({}, cramReviewGet(id), patch);
}

function cramDueItems() {
  const now = Date.now();
  return cramReviewableItems().filter(it => {
    const r = cramReviewGet(it.id);
    const intervalMs = CRAM_SR_INTERVAL_DAYS[Math.min(r.familiarity, 3)] * 86400000;
    return (now - r.lastReviewedAt) >= intervalMs;
  });
}

function buildCramReviewQueue() {
  const due = cramDueItems();
  const buckets = { glossary: [], cheat: [], behavior: [], code: [] };
  for (const it of due) buckets[it.type].push(it);
  for (const t in buckets) buckets[t].sort(() => Math.random() - 0.5);
  const picked = [];
  for (const t in buckets) picked.push(...buckets[t].slice(0, CRAM_SR_SAMPLE[t] || 0));
  picked.sort(() => Math.random() - 0.5);
  return picked;
}

function updateCramReviewCount() {
  const path = getSubscribedPath();
  const onCram = path && path.kind === 'cram';
  const countEl = document.getElementById('cram-review-count');
  const btn = document.getElementById('cram-review-btn');
  if (!btn || !countEl) return;
  if (!onCram) { countEl.textContent = '0'; return; }
  if (!CRAM_REFS.glossary && !CRAM_REFS.cheat && !CRAM_REFS.behavior) {
    countEl.textContent = '?';
    loadCramRefs().then(() => updateCramReviewCount());
    return;
  }
  countEl.textContent = String(cramDueItems().length);
}

async function openCramReviewModal() {
  await loadCramRefs();
  if (!state.cramReview.session) {
    const queue = buildCramReviewQueue();
    if (!queue.length) {
      _openCramRefModal({
        title: '🔁 Cram Review · all caught up',
        sub: 'No items due right now. Items resurface as their interval lapses (0 → 1 → 2 → 4 days).',
        bodyHtml: `<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">✓ Nothing due — come back tomorrow.</div>`
      });
      return;
    }
    state.cramReview.session = { queue, index: 0, revealed: false, gotIt: 0, fuzzy: 0 };
    saveProgress();
  }
  renderCramReviewSession();
}

function renderCramReviewSession() {
  const sess = state.cramReview.session;
  const modal = document.getElementById('cram-ref-modal');
  const titleEl = document.getElementById('cram-ref-title');
  const subEl = document.getElementById('cram-ref-sub');
  const search = document.getElementById('cram-ref-search');
  const body = document.getElementById('cram-ref-body');
  if (!modal || !sess) return;
  if (search) { search.hidden = true; search.value = ''; }
  modal.style.display = 'block';

  if (sess.index >= sess.queue.length) {
    const total = sess.gotIt + sess.fuzzy;
    const pct = total ? Math.round(100 * sess.gotIt / total) : 0;
    titleEl.textContent = '🔁 Cram Review · session done';
    subEl.textContent = 'Fuzzy items resurface tomorrow. Got-it items advance one tier (1 → 2 → 4 days).';
    body.innerHTML = `<div style="text-align:center;padding:30px 12px;">
      <div style="font-size:48px;font-weight:700;color:#34d399;font-variant-numeric:tabular-nums;line-height:1;">${pct}%</div>
      <div style="color:#94a3b8;font-size:14px;margin-top:6px;">recalled</div>
      <div style="display:flex;justify-content:center;gap:18px;margin:18px 0;">
        <div style="text-align:center;"><div style="font-size:22px;color:#34d399;font-weight:600;">${sess.gotIt}</div><div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">got it</div></div>
        <div style="text-align:center;"><div style="font-size:22px;color:#f87171;font-weight:600;">${sess.fuzzy}</div><div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">fuzzy</div></div>
        <div style="text-align:center;"><div style="font-size:22px;font-weight:600;">${sess.queue.length}</div><div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">total</div></div>
      </div>
      <button data-cram-review-done style="background:#34d399;color:#0f172a;border:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Done</button>
    </div>`;
    body.querySelector('[data-cram-review-done]').addEventListener('click', () => {
      state.cramReview.session = null;
      saveProgress();
      updateCramReviewCount();
      modal.style.display = 'none';
    });
    return;
  }

  const it = sess.queue[sess.index];
  const pct = Math.round(100 * sess.index / sess.queue.length);
  const fam = cramReviewGet(it.id).familiarity;
  const tierLabel = fam === 0 ? 'new' : `tier ${fam}`;
  const typeLabel = ({ glossary: 'Glossary', cheat: 'Pattern trigger', behavior: 'Interview behavior', code: 'Code shape' })[it.type] || it.type;

  titleEl.textContent = `🔁 Cram Review · ${sess.index + 1}/${sess.queue.length}`;
  subEl.textContent = `${typeLabel} · ${tierLabel}`;

  const promptSub = ({
    glossary: 'Define this term in 1 sentence + name one place it shows up.',
    cheat: "What's the first pattern you'd reach for?",
    code: "Can you write this from memory? (Picture the code in your head before peeking.)",
    behavior: "Why does this step matter in an interview?"
  })[it.type] || '';

  const answerHtml = sess.revealed
    ? `<div style="background:#0b1220;border-left:3px solid #34d399;border-radius:8px;padding:14px;margin:12px 0;font-size:14px;color:#e2e8f0;line-height:1.6;">
        <div style="font-size:11px;color:#34d399;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:6px;">Answer</div>
        ${escapeHtml(it.answer)}
        ${it.where ? `<div style="font-size:12px;color:#94a3b8;margin-top:8px;padding-top:8px;border-top:1px solid #1e293b;">${escapeHtml(it.where)}</div>` : ''}
        ${it.lessonId ? `<div style="margin-top:10px;"><button data-cram-review-open="${escapeHtml(it.lessonId)}" style="background:#1e293b;color:#67e8f9;border:none;border-radius:5px;padding:4px 12px;font-size:11px;cursor:pointer;font-weight:500;font-family:inherit;">Open the lesson →</button></div>` : ''}
      </div>`
    : '';

  body.innerHTML = `<div style="display:flex;flex-direction:column;min-height:280px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
      <div style="flex:1;height:6px;background:#1e293b;border-radius:3px;overflow:hidden;"><div style="height:100%;background:#67e8f9;width:${pct}%;transition:width .25s;"></div></div>
      <div style="font-size:11px;color:#94a3b8;font-variant-numeric:tabular-nums;min-width:50px;text-align:right;">${sess.index + 1}/${sess.queue.length}</div>
    </div>
    <div style="font-size:17px;font-weight:600;color:#f8fafc;line-height:1.4;margin-bottom:10px;">${escapeHtml(it.prompt)}</div>
    ${promptSub ? `<div style="font-size:12px;color:#94a3b8;margin-bottom:12px;line-height:1.5;">${escapeHtml(promptSub)}</div>` : ''}
    ${answerHtml}
    <div style="margin-top:auto;padding-top:18px;display:flex;gap:10px;flex-wrap:wrap;">
      ${!sess.revealed
        ? `<button data-cram-review-peek style="flex:1;min-width:140px;padding:12px;border-radius:8px;border:none;background:#1e293b;color:#e2e8f0;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Peek 👀</button>`
        : `<button data-cram-review-fuzzy style="flex:1;min-width:120px;padding:12px;border-radius:8px;border:none;background:#7f1d1d;color:#fecaca;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Fuzzy ✗</button>
           <button data-cram-review-gotit style="flex:1;min-width:120px;padding:12px;border-radius:8px;border:none;background:#34d399;color:#0f172a;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Got it ✓</button>`}
    </div>
  </div>`;

  const peek = body.querySelector('[data-cram-review-peek]');
  if (peek) peek.addEventListener('click', () => {
    state.cramReview.session.revealed = true;
    saveProgress();
    renderCramReviewSession();
  });
  const fuzzy = body.querySelector('[data-cram-review-fuzzy]');
  if (fuzzy) fuzzy.addEventListener('click', () => _gradeCramReview(false));
  const got = body.querySelector('[data-cram-review-gotit]');
  if (got) got.addEventListener('click', () => _gradeCramReview(true));
  const openLessonBtn = body.querySelector('[data-cram-review-open]');
  if (openLessonBtn) openLessonBtn.addEventListener('click', () => {
    const id = openLessonBtn.getAttribute('data-cram-review-open');
    modal.style.display = 'none';
    selectLesson(id);
  });
}

function _gradeCramReview(gotIt) {
  const sess = state.cramReview.session;
  if (!sess) return;
  const it = sess.queue[sess.index];
  const prev = cramReviewGet(it.id);
  const nextFam = gotIt ? Math.min(3, prev.familiarity + 1) : 0;
  cramReviewSet(it.id, { familiarity: nextFam, lastReviewedAt: Date.now() });
  if (gotIt) sess.gotIt++; else sess.fuzzy++;
  sess.index++;
  sess.revealed = false;
  saveProgress();
  updateCramReviewCount();
  renderCramReviewSession();
}

function updatePathChip() {
  const label = document.getElementById('path-chip-label');
  if (label) label.textContent = getSubscribedPath().label;
}

// Buttons that should only ever surface when a cram-kind path is active.
// On no-path / Starter / any path without sidebarButtons[], these stay hidden
// (in topbar dropdowns too — _topbarItemFromButton filters display:none).
const CRAM_ONLY_BUTTON_IDS = new Set([
  'cram-cheat-btn', 'cram-glossary-btn', 'cram-behavior-btn',
  'cram-shapes-btn', 'cram-review-btn'
]);

// When a path declares `sidebarButtons[]`, hide every button NOT in the list
// (and show every listed button that exists). Paths without the field render
// the full power-user sidebar, EXCEPT the cram-only buttons which stay hidden
// (their context-of-use is a cram path only).
function applySidebarCuration() {
  const path = getSubscribedPath();
  const list = path && Array.isArray(path.sidebarButtons) ? path.sidebarButtons : null;
  const candidates = document.querySelectorAll('[id$="-btn"], #streak-display');
  if (!list) {
    candidates.forEach(el => {
      if (CRAM_ONLY_BUTTON_IDS.has(el.id)) el.style.display = 'none';
      else el.style.removeProperty('display');
    });
    return;
  }
  const set = new Set(list);
  candidates.forEach(el => {
    if (set.has(el.id)) el.style.removeProperty('display');
    else el.style.display = 'none';
  });
}

// Top-bar cram progress strip: "Day N · ▓▓▓░░ · X/Y". Visible only when the
// subscribed path is kind:'cram' AND the cycle is still active. Tap routes
// to the cram home view (Phase 2 takes over when subscribed; for now opens
// the Today modal).
function updateCramProgressStrip() {
  const wrap = document.getElementById('topbar-cram-progress');
  if (!wrap) return;
  const path = getSubscribedPath();
  if (!path || path.kind !== 'cram') { wrap.hidden = true; return; }
  const dayIdx = getCramDayIndex(path);
  if (dayIdx < 0) { wrap.hidden = true; return; }
  const day = path.days[dayIdx];
  let total = 0, done = 0;
  for (const b of day.blocks) for (const t of b.tasks) { total++; if (isCramTaskDone(t)) done++; }
  const pct = total ? Math.round(100 * done / total) : 0;
  const dayEl = document.getElementById('topbar-cram-day');
  const barEl = document.getElementById('topbar-cram-bar');
  const countEl = document.getElementById('topbar-cram-count');
  if (dayEl) dayEl.textContent = `⏱ Day ${dayIdx + 1}/${path.days.length}`;
  if (barEl) barEl.style.width = pct + '%';
  if (countEl) countEl.textContent = `${done}/${total}`;
  wrap.hidden = false;
}

function openPathModal(opts = {}) {
  const modal = document.getElementById('path-modal');
  const body = document.getElementById('path-body');
  if (!modal || !body) return;
  const welcome = !!opts.welcome;
  const heading = modal.querySelector('h2');
  if (heading) heading.textContent = welcome ? '👋 Welcome to JS Drill' : 'Study plan';
  const sub = modal.querySelector('[data-path-sub]');
  if (sub) {
    sub.textContent = welcome
      ? `${CURRICULUM.filter(l => l.status === 'full').length} lessons across syntax, interview patterns, and applied problems. Pick a plan that fits your situation — you can switch any time.`
      : `Pick the plan that drives your 📅 Today's Plan button. Switching is safe — your lesson progress is shared across every plan.`;
  }
  const currentId = state.subscribedPathId;
  const cardsHtml = PATHS.map(p => {
    const active = !welcome && p.id === currentId;
    const border = active ? '#34d399' : '#1e293b';
    const bg = active ? 'rgba(52,211,153,0.08)' : '#0b1220';
    const tag = active
      ? `<span style="color:#34d399;font-size:13px;">● Current</span>`
      : (welcome
          ? `<span style="color:#64748b;font-size:13px;">Pick →</span>`
          : `<span style="color:#64748b;font-size:13px;">Switch →</span>`);
    return `<button data-path-id="${escapeHtml(p.id)}" style="text-align:left;padding:14px 16px;border-radius:8px;background:${bg};border:1px solid ${border};color:#e2e8f0;cursor:pointer;display:flex;flex-direction:column;gap:6px;">
      <span style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <span style="font-weight:600;font-size:14px;">${escapeHtml(p.icon || '')} ${escapeHtml(p.label)}</span>
        ${tag}
      </span>
      <span style="color:#94a3b8;font-size:12px;line-height:1.5;">${escapeHtml(p.blurb)}</span>
    </button>`;
  }).join('');
  const footerHtml = welcome
    ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid #1e293b;display:flex;flex-direction:column;gap:8px;">
        <a href="diagnostic.html" style="color:#67e8f9;font-size:12px;text-decoration:none;">🩺 Or start with a 43-question diagnostic →</a>
        <button data-action="browse-on-own" style="background:none;border:none;color:#64748b;font-size:12px;cursor:pointer;text-align:left;padding:0;">Browse on my own (no path)</button>
      </div>`
    : '';
  body.innerHTML = cardsHtml + footerHtml;
  body.querySelectorAll('[data-path-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const prevPathId = state.subscribedPathId;
      const newPathId = btn.getAttribute('data-path-id');
      state.subscribedPathId = newPathId;
      _invalidateStarterPathCache();
      if (!subscribedPathHasLessons()) state.starterPath = false;
      if (welcome) state.welcomed = true;
      // Picking a cram path is a *focus-mode switch*, not just a Today's Plan
      // re-target: drop the user on Cram Home so the new shell is visible.
      // Stale currentLessonId would otherwise keep them on a lesson with a
      // tiny topbar strip as the only cue that anything changed.
      const newPath = getSubscribedPath();
      if (newPath && newPath.kind === 'cram' && newPathId !== prevPathId) {
        state.currentLessonId = null;
        state.cramView = { mode: 'today', dayIndex: -1 };
      }
      saveProgress();
      updatePathChip();
      applySidebarCuration();
      updateCramProgressStrip();
      if (typeof updateCramReviewCount === 'function') updateCramReviewCount();
      modal.style.display = 'none';
      if (typeof renderSidebar === 'function') renderSidebar();
      if (typeof renderLesson === 'function') renderLesson();
    });
  });
  const browse = body.querySelector('[data-action="browse-on-own"]');
  if (browse) browse.addEventListener('click', () => {
    state.welcomed = true;
    saveProgress();
    modal.style.display = 'none';
    if (typeof renderLesson === 'function') renderLesson();
  });
  modal.style.display = 'block';
}

// Spaced-repetition intervals (in ms). Each pass advances to the next bucket.
const REVIEW_INTERVALS = [
  1  * 24 * 60 * 60 * 1000,   // 1 day  (after first mastery)
  3  * 24 * 60 * 60 * 1000,   // 3 days
  7  * 24 * 60 * 60 * 1000,   // 1 week
  14 * 24 * 60 * 60 * 1000,   // 2 weeks
  30 * 24 * 60 * 60 * 1000    // 1 month (max — re-pass holds at 30d)
];

// iter 125: STARTER_PATH and PREP_4DAY_PATH lesson sequences moved to
// data/paths.json (the `lessons` field of each path entry). Loaded into the
// PATHS registry by loadPaths() on boot. Adding a new path is now a pure-data
// change: append an entry to data/paths.json.
//
// Source-of-truth note for the prep path: prep.html's PLAN (each item's
// `lesson.id`) remains canonical. tools/validate-data.js re-extracts those
// ids and fails if data/paths.json's prep-4day.lessons drifts from prep.html.

// The 🧭 Path View sidebar filter scopes the sidebar to the *subscribed* path's
// drill-lesson sequence (getPathLessonOrder), then applies the per-track
// sub-filter (`state.starterPathTrack`) so a user can drill Syntax-only or
// Patterns-only without track-mixing distraction. Cache is keyed by
// subscribedPathId + track and invalidated on either change.
// iter 39: per-track sub-filter. Unified across paths: see PATHS registry.
let _activeStarterPathCache = null;
let _activeStarterPathCacheKey = null;
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
    state.welcomed = !!parsed.welcomed;
    state.hideMastered = !!parsed.hideMastered;
    state.reviews = parsed.reviews || {};
    state.weakness = parsed.weakness || {};
    state.history = parsed.history || {};
    if (parsed.sidebarTrack === 'syntax' || parsed.sidebarTrack === 'patterns' || parsed.sidebarTrack === 'applied') {
      state.sidebarTrack = parsed.sidebarTrack;
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
    welcomed: state.welcomed,
    hideMastered: state.hideMastered,
    reviews: state.reviews,
    weakness: state.weakness,
    sidebarTrack: state.sidebarTrack,
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
function dueReviewIds() {
  // iter 45: path-aware SR. When Starter Path is on AND scoped to a single
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
function _recognizeBuildDeck() {
  // Only patterns-track full lessons with a valid prompt.
  const pool = CURRICULUM.filter(l => l.track === 'patterns' && l.status === 'full');
  // Section names with ≥2 lessons (need siblings for distractor pool).
  const sectionCounts = {};
  for (const l of pool) sectionCounts[l.section] = (sectionCounts[l.section] || 0) + 1;
  const eligibleSections = Object.keys(sectionCounts).filter(s => sectionCounts[s] >= 1);
  if (eligibleSections.length < 4) return null;  // need at least 4 sections for 4-option MC
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const cards = [];
  for (const lesson of shuffled) {
    if (cards.length >= RECOGNIZE_SESSION_LEN) break;
    const content = CONTENT[lesson.id];
    const prompt = content?.L3?.prompt;
    if (!prompt) continue;  // skip lessons not yet loaded; we'll backfill
    const correct = lesson.section;
    const others = eligibleSections.filter(s => s !== correct).sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [correct, ...others].sort(() => Math.random() - 0.5);
    cards.push({ lessonId: lesson.id, prompt, correct, options });
  }
  return cards.length >= 3 ? cards : null;
}

async function startRecognizeSession() {
  // Backfill: load content for the first N patterns lessons so the deck builder
  // has prompts to work with (most are stub-loaded). Limit to avoid mass fetch.
  const patternsLessons = CURRICULUM.filter(l => l.track === 'patterns' && l.status === 'full').slice(0, 30);
  for (const l of patternsLessons) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
      if (Object.keys(CONTENT).length >= 12) break;  // enough variety
    }
  }
  const deck = _recognizeBuildDeck();
  if (!deck || deck.length < 3) {
    alert('Recognize needs more loaded patterns lessons. Click around a few patterns first, then try again.');
    return;
  }
  let idx = 0, correct = 0, startedAt = Date.now(), times = [];
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    const cardStarted = Date.now();
    shell.innerHTML = `
      <div class="recognize-shell">
        <div class="recognize-header">
          <span>🔎 Recognize · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-recognize">✕ Exit</button>
        </div>
        <div class="recognize-prompt">${escapeHtml(card.prompt)}</div>
        <div class="recognize-options">
          ${card.options.map(opt => `<button class="recognize-opt" data-opt="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join('')}
        </div>
        <div class="recognize-feedback" data-recognize-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-recognize"]').addEventListener('click', () => { renderLesson(); });
    const opts = shell.querySelectorAll('.recognize-opt');
    let answered = false;
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const picked = btn.dataset.opt;
        const wasCorrect = picked === card.correct;
        if (wasCorrect) correct++;
        times.push(Date.now() - cardStarted);
        state.recognize.attempts++;
        if (wasCorrect) state.recognize.correct++;
        saveProgress();
        opts.forEach(b => {
          b.disabled = true;
          if (b.dataset.opt === card.correct) b.classList.add('recognize-opt-correct');
          else if (b === btn) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-recognize-feedback]');
        fb.innerHTML = wasCorrect
          ? `<span class="recognize-good">✓ ${escapeHtml(card.correct)}</span>`
          : `<span class="recognize-bad">✗ Was: ${escapeHtml(card.correct)}</span>`;
        setTimeout(() => { idx++; renderCard(); }, wasCorrect ? 700 : 1400);
      });
    });
  }
  function renderSummary() {
    const total = Date.now() - startedAt;
    const median = times.slice().sort((a, b) => a - b)[Math.floor(times.length / 2)] || 0;
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell">
        <div class="recognize-header"><span>🔎 Recognize · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} correct</div>
          <div class="recognize-summary-line">Median time per card: ${(median / 1000).toFixed(1)}s</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.recognize.correct} / ${state.recognize.attempts} (${state.recognize.attempts > 0 ? Math.round(state.recognize.correct / state.recognize.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="recognize-again">🔎 Another session</button>
            <button class="secondary" data-action="recognize-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="recognize-again"]').addEventListener('click', () => startRecognizeSession());
    shell.querySelector('[data-action="recognize-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 75: ⏱ Big-O Speed Drill — concentrates the iter-27 audit theme #4
// ("complexity-question fatigue distributed across normal lessons") into a
// trainable surface. Pure recombination of existing L1 questions filtered to
// complexity-flavored q-text (matches /complex|O\(|big.?o/i). Routes through
// startRapidFireSession by passing a pre-built filtered deck so the entire
// shell — letter chips, 7-sec timer, streak counter, summary — is reused
// with zero new render code. From `ideas-by-category.md § 9C Adaptation`.
const BIG_O_SESSION_LEN = 12; // shorter than Rapid (20) — complexity Qs are denser
const BIG_O_FILTER_RE = /\b(complex|O\(|big[\s-]?o|amortized|asymptotic)\b/i;
function _bigOBuildDeck() {
  const pool = [];
  for (const lesson of CURRICULUM) {
    if (lesson.status !== 'full') continue;
    const content = CONTENT[lesson.id];
    if (!content || !content.L1 || !Array.isArray(content.L1.questions)) continue;
    for (const q of content.L1.questions) {
      if (!q || !BIG_O_FILTER_RE.test(q.q || '')) continue;
      if (!Array.isArray(q.options) || q.options.length < 2) continue;
      if (typeof q.answer !== 'number') continue;
      pool.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        sectionName: lesson.section,
        q: q.q,
        options: q.options,
        answerIdx: q.answer,
        explain: q.explain || ''
      });
    }
  }
  if (pool.length < 5) return null;
  // Fisher-Yates shuffle then slice.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, BIG_O_SESSION_LEN);
}

async function startBigOSession() {
  // Preload patterns + algorithms (where complexity Qs concentrate) so the
  // deck has variety beyond just the few lessons the user has clicked.
  const sample = CURRICULUM.filter(l =>
    l.status === 'full' && (l.track === 'patterns' || l.section === 'Algorithms')
  ).slice(0, 24);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  const deck = _bigOBuildDeck();
  if (!deck || deck.length < 5) {
    alert('Big-O drill needs more loaded lessons. Click around a few patterns lessons first, then try again.');
    return;
  }
  // Reuse Rapid-Fire's session shell directly — same deck shape, same
  // letter-chip + 7-sec-timer + streak mechanics. Passing the prebuilt deck
  // skips Rapid-Fire's full-corpus preload (heavier) and shorter session
  // length matches the denser concentration of complexity Qs.
  return _runRapidFireWithDeck(deck, { label: '⏱ Big-O', emoji: '⏱' });
}

// iter 83: 🎰 Gotcha Roulette — standalone recall stream over reference.notes[].
// The `notes[]` corpus (2-5 strings × 143 lessons = ~400 cards) has been
// on-disk since project start and is read by ~zero surfaces — every existing
// surface treats notes as ornamentation around code. This surface treats them
// as the atomic recall unit: one note per card, lesson title hidden; user
// 2-taps "knew it" / "didn't"; reveal shows lesson + deep-link CTA. Trains
// surfacing the half-remembered traps (off-by-one, mutation footguns,
// coercion edges) without the navigation cost of opening each lesson.
// From `ideas-by-category.md § 1 → Gotcha Roulette` (iter-82 vision top pick).
const GOTCHA_DECK_LEN = 8;
async function _gotchaBuildDeck() {
  // Preload a broad sample across all tracks so the pool has variety.
  const sample = CURRICULUM.filter(l => l.status === 'full').slice(0, 60);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
      if (Object.keys(CONTENT).length >= 30) break;
    }
  }
  // Flatten all notes across all loaded lessons.
  const pool = [];
  for (const lesson of CURRICULUM) {
    const c = CONTENT[lesson.id];
    if (!c || !c.reference || !Array.isArray(c.reference.notes)) continue;
    for (let ni = 0; ni < c.reference.notes.length; ni++) {
      const note = c.reference.notes[ni];
      if (typeof note !== 'string' || note.length < 20) continue; // skip thin ornament
      pool.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        sectionName: lesson.section,
        note
      });
    }
  }
  if (pool.length < 4) return null;
  // Fisher-Yates shuffle.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, GOTCHA_DECK_LEN);
}

async function startGotchaSession() {
  const deck = await _gotchaBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Gotcha needs more loaded lessons. Click around a few first, then try again.');
    return;
  }
  state.gotcha.sessions++;
  state.gotcha.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, knew = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell gotcha-shell">
        <div class="recognize-header">
          <span>🎰 Gotcha · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-gotcha">✕ Exit</button>
        </div>
        <div class="gotcha-tag">${escapeHtml(card.sectionName)} · ??? </div>
        <div class="gotcha-note">${escapeHtml(card.note)}</div>
        <div class="gotcha-options">
          <button class="recognize-opt gotcha-opt" data-pick="knew">✓ Knew it</button>
          <button class="recognize-opt gotcha-opt" data-pick="didnt">✗ Didn't</button>
        </div>
        <div class="recognize-feedback" data-gotcha-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-gotcha"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.gotcha-opt');
    let answered = false;
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const wasKnew = btn.dataset.pick === 'knew';
        if (wasKnew) knew++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.gotcha.attempts++;
        if (wasKnew) state.gotcha.correct++;
        saveProgress();
        opts.forEach(b => b.disabled = true);
        btn.classList.add(wasKnew ? 'recognize-opt-correct' : 'recognize-opt-wrong');
        const fb = shell.querySelector('[data-gotcha-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="gotcha-reveal">
              <div class="gotcha-reveal-title">${escapeHtml(card.lessonTitle)}</div>
              <div class="gotcha-reveal-section">${escapeHtml(card.sectionName)}</div>
              <button class="gotcha-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="gotcha-next" data-action="gotcha-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="gotcha-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((knew / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell gotcha-shell">
        <div class="recognize-header"><span>🎰 Gotcha · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${knew} of ${deck.length} traps recognized · ${deck.length - knew} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.gotcha.correct} / ${state.gotcha.attempts} (${state.gotcha.attempts > 0 ? Math.round(state.gotcha.correct / state.gotcha.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="gotcha-again">🎰 Another spin</button>
            <button class="secondary" data-action="gotcha-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="gotcha-again"]').addEventListener('click', () => startGotchaSession());
    shell.querySelector('[data-action="gotcha-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 91: 🎬 Conversation Drill — interview-arc classifier over the 99 Patterns
// + Applied lessons' `conversation.sections[]` corpus. Each card shows ONE
// .say paragraph with the section title HIDDEN; user taps which of the 6
// fixed interview-phase types it is (Restate / Brute force / Spot pattern /
// Trace / Edges / Complexity). Reveal shows actual title + source lesson +
// "Drill this lesson →" deep-link. Misses route to state.weakness via existing
// path. First surface to test the interview-arc skill — recruiters grade the
// arc, not just the code, and 495 authored paragraphs across 99 lessons have
// never been used as a recall corpus. From roadmap.md iter-90 #1 (vision iter
// top promoted entry). Reuses .recognize-* shell base + Gotcha card structure.
const CONV_DRILL_DECK_LEN = 10;
const CONV_DRILL_MIN_SAY_LEN = 100;
const CONV_DRILL_PHASES = [
  { idx: 1, label: '🎯 Restate', hint: 'Clarify the problem' },
  { idx: 2, label: '🧱 Brute force', hint: 'Naive solution first' },
  { idx: 3, label: '💡 Spot pattern', hint: 'Identify the technique' },
  { idx: 4, label: '🔍 Trace', hint: 'Walk through an example' },
  { idx: 5, label: '⚠️ Edge cases', hint: 'Boundary conditions' },
  { idx: 6, label: '📏 Complexity', hint: 'Big-O & wrap-up' }
];
function _convDrillPhaseIdx(title) {
  // Titles like "1. Restate & clarify" / "3. Spot the pattern — API shape…".
  // Extract the leading digit to bucket. Returns 1..6 or 0 if unparseable.
  if (typeof title !== 'string') return 0;
  const m = title.match(/^\s*([1-6])\b/);
  return m ? +m[1] : 0;
}
async function _convDrillBuildDeck() {
  // Preload Patterns/Applied lessons broadly — these are the only tracks with
  // conversation blocks (99/99 per OOB-2026-05-24).
  const candidates = CURRICULUM.filter(l =>
    l.status === 'full' && (l.track === 'patterns' || l.track === 'applied')
  );
  // Fisher-Yates shuffle candidates so the preload sample varies per session.
  const shuffled = candidates.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Cap preloads at 40 to keep session startup fast on first-run.
  const sample = shuffled.slice(0, 40);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  // Flatten all eligible sections across loaded lessons.
  const pool = [];
  for (const lesson of CURRICULUM) {
    if (lesson.track !== 'patterns' && lesson.track !== 'applied') continue;
    const c = CONTENT[lesson.id];
    if (!c || !c.conversation || !Array.isArray(c.conversation.sections)) continue;
    for (const s of c.conversation.sections) {
      const say = (s && typeof s.say === 'string') ? s.say : '';
      if (say.length < CONV_DRILL_MIN_SAY_LEN) continue; // skip empty/thin sections
      const idx = _convDrillPhaseIdx(s.title);
      if (idx < 1 || idx > 6) continue;
      pool.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        sectionName: lesson.section,
        sectionTitle: s.title,
        say,
        phaseIdx: idx
      });
    }
  }
  if (pool.length < 4) return null;
  // Fisher-Yates shuffle the pool.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(CONV_DRILL_DECK_LEN, pool.length));
}

async function startConvDrillSession() {
  const deck = await _convDrillBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Conversation Drill needs more loaded lessons. Click around a few Patterns lessons first, then try again.');
    return;
  }
  state.convDrill.sessions++;
  state.convDrill.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell conv-drill-shell">
        <div class="recognize-header">
          <span>🎬 Conv · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-conv">✕ Exit</button>
        </div>
        <div class="conv-drill-tag">Which phase of the interview is this?</div>
        <div class="conv-drill-say">${escapeHtml(card.say)}</div>
        <div class="conv-drill-options">
          ${CONV_DRILL_PHASES.map(p => `
            <button class="recognize-opt conv-drill-opt" data-phase="${p.idx}" title="${escapeHtml(p.hint)}">
              ${escapeHtml(p.label)}
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-conv-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-conv"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.conv-drill-opt');
    let answered = false;
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const picked = +btn.dataset.phase;
        const wasRight = picked === card.phaseIdx;
        if (wasRight) correct++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.convDrill.attempts++;
        if (wasRight) state.convDrill.correct++;
        saveProgress();
        opts.forEach(b => {
          b.disabled = true;
          const pIdx = +b.dataset.phase;
          if (pIdx === card.phaseIdx) b.classList.add('recognize-opt-correct');
          else if (b === btn) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-conv-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="conv-drill-reveal">
              <div class="conv-drill-reveal-title">${escapeHtml(card.sectionTitle)}</div>
              <div class="conv-drill-reveal-lesson">${escapeHtml(card.lessonTitle)} · ${escapeHtml(card.sectionName)}</div>
              <button class="conv-drill-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="conv-drill-next" data-action="conv-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="conv-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell conv-drill-shell">
        <div class="recognize-header"><span>🎬 Conv · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} phases identified · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.convDrill.correct} / ${state.convDrill.attempts} (${state.convDrill.attempts > 0 ? Math.round(state.convDrill.correct / state.convDrill.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="conv-again">🎬 Another session</button>
            <button class="secondary" data-action="conv-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="conv-again"]').addEventListener('click', () => startConvDrillSession());
    shell.querySelector('[data-action="conv-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 93: 🧬 Trace-Hop — pick-the-middle-state mobile quiz over
// `walkthrough.trace` yields. Each card shows 3 CONSECUTIVE trace frames
// (K-1, K, K+1) with the MIDDLE frame's `state` panel BLANKED; user taps
// which of 4 state-objects fits there. Distractors are sampled from OTHER
// frames of the SAME trace (not other lessons) so the user reasons about
// "which step belongs here" rather than type-matching. Distinct from
// 🪲 Walkthrough Bug-Hunt (which mutates a state value and asks "which row
// is corrupted") — Trace-Hop tests positional state recall, the mental
// model the rusty engineer needs to WRITE the code from scratch.
// From roadmap.md iter-90 #2 (vision iter — 2nd promoted entry). Reuses
// the Walkthrough engine's compiled trace + step-key dedup logic from
// _pickQuizOptions (iter 36) + .recognize-* shell base.
const TRACE_HOP_DECK_LEN = 8;
function _traceHopStepKey(s) {
  try { return JSON.stringify({ line: s.line, label: s.label, state: s.state }); }
  catch (_) { return Math.random().toString(); }
}
function _traceHopBuildCard(lesson, content) {
  // Compile the lesson's walkthrough. Returns { byExample, error }.
  const compiled = _compileWalkthrough(lesson.id, content.walkthrough);
  if (compiled.error || !Array.isArray(compiled.byExample)) return null;
  // Pick a random example with enough steps.
  const usable = compiled.byExample.filter(b => !b.error && Array.isArray(b.steps) && b.steps.length >= 5);
  if (!usable.length) return null;
  const block = usable[Math.floor(Math.random() * usable.length)];
  const steps = block.steps;
  // Pick a middle frame K such that K-1 and K+1 both exist.
  const candidatesK = [];
  for (let K = 1; K < steps.length - 1; K++) {
    // Only K's with at least one state key (so the blanked panel isn't empty).
    if (steps[K].state && typeof steps[K].state === 'object' && Object.keys(steps[K].state).length > 0) {
      candidatesK.push(K);
    }
  }
  if (!candidatesK.length) return null;
  const K = candidatesK[Math.floor(Math.random() * candidatesK.length)];
  const correct = steps[K];
  // Distractor pool: other frames of THE SAME TRACE excluding K-1, K, K+1
  // (K-1 and K+1 are visible in the card → would be trivially-wrong giveaways).
  const seen = new Set([_traceHopStepKey(correct), _traceHopStepKey(steps[K - 1]), _traceHopStepKey(steps[K + 1])]);
  const distractorPool = [];
  for (let i = 0; i < steps.length; i++) {
    if (i === K - 1 || i === K || i === K + 1) continue;
    const s = steps[i];
    if (!s || !s.state || typeof s.state !== 'object') continue;
    const k = _traceHopStepKey(s);
    if (seen.has(k)) continue;
    seen.add(k);
    distractorPool.push({ step: s, idx: i });
  }
  if (distractorPool.length < 3) return null;
  // Fisher-Yates shuffle the pool; take first 3.
  for (let i = distractorPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [distractorPool[i], distractorPool[j]] = [distractorPool[j], distractorPool[i]];
  }
  const distractors = distractorPool.slice(0, 3);
  const options = [
    { step: correct, idx: K, isCorrect: true },
    ...distractors.map(d => ({ step: d.step, idx: d.idx, isCorrect: false }))
  ];
  // Shuffle option positions so correct isn't always first.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    sectionName: lesson.section,
    exampleLabel: block.example && block.example.label ? block.example.label : '',
    framePrev: steps[K - 1],
    frameNext: steps[K + 1],
    correctIdx: K,
    options
  };
}
async function _traceHopBuildDeck() {
  // Preload Patterns/Applied lessons — only those with walkthrough blocks.
  const candidates = CURRICULUM.filter(l =>
    l.status === 'full' && (l.track === 'patterns' || l.track === 'applied')
  );
  // Fisher-Yates shuffle so each session pulls a different sample.
  const shuffled = candidates.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Try lessons one by one until we've built enough cards.
  const deck = [];
  for (const lesson of shuffled) {
    if (deck.length >= TRACE_HOP_DECK_LEN) break;
    if (!CONTENT[lesson.id]) {
      try { await loadLessonContent(lesson.id); } catch (_) { continue; }
    }
    const c = CONTENT[lesson.id];
    if (!c || !c.walkthrough || !Array.isArray(c.walkthrough.examples)) continue;
    const card = _traceHopBuildCard(lesson, c);
    if (card) deck.push(card);
  }
  if (deck.length < 4) return null;
  return deck;
}

function _traceHopFormatState(stateObj) {
  if (!stateObj || typeof stateObj !== 'object') return '<span class="trace-hop-state-empty">(no state)</span>';
  const rows = Object.entries(stateObj).map(([k, v]) =>
    `<div class="trace-hop-state-row"><span class="trace-hop-state-key">${escapeHtml(k)}</span><span class="trace-hop-state-val">${escapeHtml(_formatStateVal(v))}</span></div>`
  );
  return rows.join('');
}

async function startTraceHopSession() {
  const deck = await _traceHopBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Trace-Hop needs more lessons with walkthroughs. Click around a few Patterns lessons first, then try again.');
    return;
  }
  state.traceHop.sessions++;
  state.traceHop.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    const exampleLine = card.exampleLabel
      ? `<div class="trace-hop-meta">Example: <span class="trace-hop-meta-em">${escapeHtml(card.exampleLabel)}</span></div>`
      : '';
    shell.innerHTML = `
      <div class="recognize-shell trace-hop-shell">
        <div class="recognize-header">
          <span>🧬 Trace-Hop · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-trace-hop">✕ Exit</button>
        </div>
        ${exampleLine}
        <div class="trace-hop-tag">Which state fits the middle frame?</div>
        <div class="trace-hop-frames">
          <div class="trace-hop-frame trace-hop-frame-side">
            <div class="trace-hop-frame-head"><span class="trace-hop-frame-pos">Step ${card.correctIdx}</span><span class="trace-hop-frame-line">line ${escapeHtml(String(card.framePrev.line))}</span></div>
            <div class="trace-hop-frame-label">${escapeHtml(card.framePrev.label || '')}</div>
            <div class="trace-hop-frame-state">${_traceHopFormatState(card.framePrev.state)}</div>
          </div>
          <div class="trace-hop-frame trace-hop-frame-middle">
            <div class="trace-hop-frame-head"><span class="trace-hop-frame-pos">Step ${card.correctIdx + 1}</span><span class="trace-hop-frame-line">line ${escapeHtml(String(card.options[0].step.line))}</span></div>
            <div class="trace-hop-frame-label">${escapeHtml(card.options.find(o => o.isCorrect).step.label || '')}</div>
            <div class="trace-hop-frame-state trace-hop-frame-state-blank">?  ?  ?</div>
          </div>
          <div class="trace-hop-frame trace-hop-frame-side">
            <div class="trace-hop-frame-head"><span class="trace-hop-frame-pos">Step ${card.correctIdx + 2}</span><span class="trace-hop-frame-line">line ${escapeHtml(String(card.frameNext.line))}</span></div>
            <div class="trace-hop-frame-label">${escapeHtml(card.frameNext.label || '')}</div>
            <div class="trace-hop-frame-state">${_traceHopFormatState(card.frameNext.state)}</div>
          </div>
        </div>
        <div class="trace-hop-options">
          ${card.options.map((o, i) => `
            <button class="recognize-opt trace-hop-opt" data-opt="${i}">
              <span class="trace-hop-opt-letter">${String.fromCharCode(65 + i)}</span>
              <span class="trace-hop-opt-state">${_traceHopFormatState(o.step.state)}</span>
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-trace-hop-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-trace-hop"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.trace-hop-opt');
    let answered = false;
    optBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const optIdx = +btn.dataset.opt;
        const picked = card.options[optIdx];
        const wasRight = !!picked.isCorrect;
        if (wasRight) correct++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.traceHop.attempts++;
        if (wasRight) state.traceHop.correct++;
        saveProgress();
        optBtns.forEach((b, i) => {
          b.disabled = true;
          if (card.options[i].isCorrect) b.classList.add('recognize-opt-correct');
          else if (i === optIdx) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-trace-hop-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="trace-hop-reveal">
              <div class="trace-hop-reveal-title">${wasRight ? '✓ Got it' : '✗ The middle state was option ' + String.fromCharCode(65 + card.options.findIndex(o => o.isCorrect))}</div>
              <div class="trace-hop-reveal-lesson">${escapeHtml(card.lessonTitle)} · ${escapeHtml(card.sectionName)}</div>
              <button class="trace-hop-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="trace-hop-next" data-action="trace-hop-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="trace-hop-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell trace-hop-shell">
        <div class="recognize-header"><span>🧬 Trace-Hop · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} states identified · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.traceHop.correct} / ${state.traceHop.attempts} (${state.traceHop.attempts > 0 ? Math.round(state.traceHop.correct / state.traceHop.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="trace-hop-again">🧬 Another session</button>
            <button class="secondary" data-action="trace-hop-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="trace-hop-again"]').addEventListener('click', () => startTraceHopSession());
    shell.querySelector('[data-action="trace-hop-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 97: 📝 Notes Cloze Tap-Drill — cloze-MC over `reference.notes[]` text.
// Each card shows ONE note string with one keyword blanked + 4 tap options.
// Distractors sampled from notes in OTHER lessons (preferring same section
// for plausibility). Third recall direction over the notes corpus —
// distinct from 🎰 Gotcha (whole-note yes/no recognition) and 🃏 Flash
// (canonical-code cloze). Forces actual keyword recall (not just affirm
// familiarity), which is closer to interview pressure. From roadmap.md
// iter-95 #1 (vision iter top promoted entry).
const NOTES_DRILL_DECK_LEN = 12;
const NOTES_DRILL_STOP_WORDS = new Set([
  'the','a','an','and','or','but','if','then','else','when','that','this',
  'these','those','it','its','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should',
  'may','might','must','can','to','of','in','on','at','by','for','from',
  'with','as','into','about','over','under','than','so','not','no','yes',
  'you','your','they','their','we','our','my','his','her','one','two',
  'any','all','some','each','every','same','only','other','many','also',
  'use','used','uses','make','makes','take','takes','give','gives','get',
  'gets','put','puts','set','sets','because','while','since','until',
  'where','what','which','who','how','very','much','more','most','less'
]);
// Strip leading + trailing non-alphanumeric/underscore characters (so
// "reduce)." → "reduce", "__v" → "__v"). Internal `.` and `-` survive
// (so "Array.from" and "freq-map" stay intact when surrounded by letters
// because the regex anchors only at start/end).
function _notesStripPunct(token) {
  return token.replace(/^[^a-zA-Z0-9_]+|[^a-zA-Z0-9_]+$/g, '');
}
function _notesIsEligibleWord(token) {
  const stripped = _notesStripPunct(token);
  if (stripped.length < 4) return false;
  if (NOTES_DRILL_STOP_WORDS.has(stripped.toLowerCase())) return false;
  // Require at least one letter (skip pure numbers / pure punctuation).
  if (!/[a-zA-Z]/.test(stripped)) return false;
  return true;
}
// Pick a keyword to blank in a note. Strategy: walk tokens in reverse —
// the LAST eligible distinctive word is usually the load-bearing term
// in a one-line gotcha (e.g., "splice mutates the array" → "array",
// or better "mutates"; tested on real corpus iter-97). Returns null
// when no eligible word found (caller skips the note).
function _notesPickBlank(noteText) {
  if (typeof noteText !== 'string') return null;
  const tokens = noteText.split(/(\s+)/); // keep whitespace tokens for re-join
  // Walk in reverse over non-whitespace tokens.
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (!t || /^\s+$/.test(t)) continue;
    if (!_notesIsEligibleWord(t)) continue;
    const stripped = _notesStripPunct(t);
    // Find the exact position of `stripped` inside the original token
    // (token may have surrounding punctuation we want to keep).
    const startInTok = t.indexOf(stripped);
    if (startInTok < 0) continue;
    // Reconstruct: leading-tokens + leading-punct + ___ + trailing-punct + trailing-tokens
    const lead = tokens.slice(0, i).join('');
    const trail = tokens.slice(i + 1).join('');
    const tokPrefix = t.slice(0, startInTok);
    const tokSuffix = t.slice(startInTok + stripped.length);
    return {
      blankWord: stripped,
      prefix: lead + tokPrefix,
      suffix: tokSuffix + trail
    };
  }
  return null;
}
// Distractor pool — eligible words from OTHER lessons' notes. Prefer same
// section first; fall back to any track if pool too small.
function _notesCollectDistractors(sourceLessonId, sourceSection, blankWord) {
  const blankLower = blankWord.toLowerCase();
  const same = new Set();
  const other = new Set();
  for (const lesson of CURRICULUM) {
    if (lesson.id === sourceLessonId) continue;
    const c = CONTENT[lesson.id];
    if (!c || !c.reference || !Array.isArray(c.reference.notes)) continue;
    for (const note of c.reference.notes) {
      if (typeof note !== 'string') continue;
      const tokens = note.split(/\s+/);
      for (const t of tokens) {
        if (!_notesIsEligibleWord(t)) continue;
        const stripped = _notesStripPunct(t);
        if (stripped.toLowerCase() === blankLower) continue;
        (lesson.section === sourceSection ? same : other).add(stripped);
      }
    }
  }
  const sameArr = Array.from(same);
  const otherArr = Array.from(other);
  // Fisher-Yates shuffle each.
  for (const arr of [sameArr, otherArr]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  // Take from same first; top up from other.
  const pool = sameArr.concat(otherArr);
  return pool.slice(0, 3);
}
async function _notesDrillBuildDeck() {
  // Preload a broad sample so the pool is large enough for distractors.
  const sample = CURRICULUM.filter(l => l.status === 'full').slice(0, 80);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
      if (Object.keys(CONTENT).length >= 40) break;
    }
  }
  // Flatten eligible notes across loaded lessons.
  const pool = [];
  for (const lesson of CURRICULUM) {
    const c = CONTENT[lesson.id];
    if (!c || !c.reference || !Array.isArray(c.reference.notes)) continue;
    for (const note of c.reference.notes) {
      if (typeof note !== 'string' || note.length < 25) continue;
      const picked = _notesPickBlank(note);
      if (!picked) continue;
      pool.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        sectionName: lesson.section,
        note,
        blankWord: picked.blankWord,
        prefix: picked.prefix,
        suffix: picked.suffix
      });
    }
  }
  if (pool.length < 4) return null;
  // Fisher-Yates shuffle.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Build cards with distractors. Skip any card with <3 distractors.
  const deck = [];
  for (const item of pool) {
    if (deck.length >= NOTES_DRILL_DECK_LEN) break;
    const distractors = _notesCollectDistractors(item.lessonId, item.sectionName, item.blankWord);
    if (distractors.length < 3) continue;
    const options = [
      { word: item.blankWord, isCorrect: true },
      ...distractors.map(w => ({ word: w, isCorrect: false }))
    ];
    // Shuffle option order.
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    deck.push({ ...item, options });
  }
  return deck.length >= 4 ? deck : null;
}
async function startNotesDrillSession() {
  const deck = await _notesDrillBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Notes Drill needs more loaded lessons. Click around a few first, then try again.');
    return;
  }
  state.notesDrill.sessions++;
  state.notesDrill.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell notes-drill-shell">
        <div class="recognize-header">
          <span>📝 Notes · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-notes">✕ Exit</button>
        </div>
        <div class="notes-drill-tag">Which word fits the blank?</div>
        <div class="notes-drill-note">${escapeHtml(card.prefix)}<span class="notes-drill-blank">___</span>${escapeHtml(card.suffix)}</div>
        <div class="notes-drill-options">
          ${card.options.map((o, i) => `
            <button class="recognize-opt notes-drill-opt" data-opt="${i}">
              <span class="notes-drill-opt-letter">${String.fromCharCode(65 + i)}</span>
              <span class="notes-drill-opt-word">${escapeHtml(o.word)}</span>
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-notes-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-notes"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.notes-drill-opt');
    let answered = false;
    optBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const optIdx = +btn.dataset.opt;
        const picked = card.options[optIdx];
        const wasRight = !!picked.isCorrect;
        if (wasRight) correct++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.notesDrill.attempts++;
        if (wasRight) state.notesDrill.correct++;
        saveProgress();
        optBtns.forEach((b, i) => {
          b.disabled = true;
          if (card.options[i].isCorrect) b.classList.add('recognize-opt-correct');
          else if (i === optIdx) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-notes-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="notes-drill-reveal">
              <div class="notes-drill-reveal-full"><strong>${escapeHtml(card.blankWord)}</strong> — ${escapeHtml(card.note)}</div>
              <div class="notes-drill-reveal-lesson">${escapeHtml(card.lessonTitle)} · ${escapeHtml(card.sectionName)}</div>
              <button class="notes-drill-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="notes-drill-next" data-action="notes-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="notes-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell notes-drill-shell">
        <div class="recognize-header"><span>📝 Notes · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} keywords recalled · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.notesDrill.correct} / ${state.notesDrill.attempts} (${state.notesDrill.attempts > 0 ? Math.round(state.notesDrill.correct / state.notesDrill.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="notes-again">📝 Another session</button>
            <button class="secondary" data-action="notes-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="notes-again"]').addEventListener('click', () => startNotesDrillSession());
    shell.querySelector('[data-action="notes-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 98: 🪐 Mechanic Constellation — multi-select recall over the
// `mechanics[]` tag. Each card shows ONE mechanic name + 6 lesson titles
// (3 tagged with the mechanic, 3 not); user picks 3 they think are
// tagged. Per-tap immediate-feedback (mirrors iter-93/97 pattern):
// correct → green ✓; wrong → red ✗ + state.weakness[lessonId]++.
// Card ends after 3 taps; reveal shows all 6 marked + drill CTAs.
// First surface drilling mechanics as a recall TARGET (vs Bridge/Matrix/
// modal which all USE mechanics as input). From roadmap.md iter-95 #2.
const CONSTELLATION_DECK_LEN = 10;
const CONSTELLATION_PICKS_PER_CARD = 3;
const CONSTELLATION_OPTIONS_PER_CARD = 6;
function _constellationBuildCard(mechId, mech) {
  const taggedSet = MECHANIC_INDEX.get(mechId);
  if (!taggedSet || taggedSet.size < 3) return null;
  // Pick 3 RANDOM tagged lessons. Filter to full status.
  const tagged = Array.from(taggedSet)
    .map(id => findLesson(id))
    .filter(l => l && l.status === 'full');
  if (tagged.length < 3) return null;
  // Fisher-Yates a copy then take 3.
  for (let i = tagged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
  }
  const correct = tagged.slice(0, 3);
  // Build distractor pool: full lessons NOT tagged with this mechanic.
  // Prefer same-section as one of the correct lessons for plausibility.
  const correctIds = new Set(correct.map(l => l.id));
  const correctSections = new Set(correct.map(l => l.section));
  const sameSection = [];
  const otherSection = [];
  for (const lesson of CURRICULUM) {
    if (lesson.status !== 'full') continue;
    if (correctIds.has(lesson.id)) continue;
    if (taggedSet.has(lesson.id)) continue; // skip lessons that ARE tagged
    if (correctSections.has(lesson.section)) sameSection.push(lesson);
    else otherSection.push(lesson);
  }
  // Shuffle each, then concat (same-section first).
  for (const arr of [sameSection, otherSection]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  const distractors = sameSection.concat(otherSection).slice(0, 3);
  if (distractors.length < 3) return null;
  // Combine + shuffle option order.
  const options = [
    ...correct.map(l => ({ lesson: l, isCorrect: true })),
    ...distractors.map(l => ({ lesson: l, isCorrect: false }))
  ];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    mechId,
    mechLabel: mech.label,
    mechBlurb: mech.blurb || '',
    options
  };
}
async function _constellationBuildDeck() {
  // Lazy-load MECHANIC_INDEX (mirrors iter-94 Bridge pattern).
  await ensureMechanicIndex();
  if (!MECHANIC_INDEX || MECHANIC_INDEX.size === 0) return null;
  // Filter to mechanics with ≥3 tagged lessons.
  const eligible = [];
  for (const [mechId, lessonSet] of MECHANIC_INDEX) {
    if (lessonSet.size < 3) continue;
    const mech = MECHANICS.find(m => m.id === mechId);
    if (!mech) continue;
    eligible.push({ mechId, mech });
  }
  if (eligible.length < 4) return null;
  // Shuffle.
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  // Build cards.
  const deck = [];
  for (const { mechId, mech } of eligible) {
    if (deck.length >= CONSTELLATION_DECK_LEN) break;
    const card = _constellationBuildCard(mechId, mech);
    if (card) deck.push(card);
  }
  return deck.length >= 4 ? deck : null;
}
async function startConstellationSession() {
  const deck = await _constellationBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Constellation needs more loaded lessons + a populated mechanics registry. Try again in a moment.');
    return;
  }
  state.mechConstellation.sessions++;
  state.mechConstellation.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, cardsCompleted = 0, perCardCorrect = [];
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    let picks = 0, cardCorrect = 0;
    const optStates = card.options.map(() => 'unpicked'); // unpicked | correct | wrong
    shell.innerHTML = `
      <div class="recognize-shell constellation-shell">
        <div class="recognize-header">
          <span>🪐 Constellation · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-constellation">✕ Exit</button>
        </div>
        <div class="constellation-tag">Pick the 3 lessons that use this idiom:</div>
        <div class="constellation-mech">
          <div class="constellation-mech-label">${escapeHtml(card.mechLabel)}</div>
          ${card.mechBlurb ? `<div class="constellation-mech-blurb">${escapeHtml(card.mechBlurb)}</div>` : ''}
        </div>
        <div class="constellation-counter">Picks: <span data-picks>0</span> / 3</div>
        <div class="constellation-options">
          ${card.options.map((o, i) => `
            <button class="recognize-opt constellation-opt" data-opt="${i}">
              <span class="constellation-opt-mark" data-mark="${i}"></span>
              <span class="constellation-opt-title">${escapeHtml(o.lesson.title)}</span>
              <span class="constellation-opt-section">${escapeHtml(o.lesson.section)}</span>
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-constellation-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-constellation"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.constellation-opt');
    const counterEl = shell.querySelector('[data-picks]');
    optBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (picks >= CONSTELLATION_PICKS_PER_CARD) return;
        const optIdx = +btn.dataset.opt;
        if (optStates[optIdx] !== 'unpicked') return;
        const picked = card.options[optIdx];
        const wasRight = !!picked.isCorrect;
        optStates[optIdx] = wasRight ? 'correct' : 'wrong';
        picks++;
        if (wasRight) cardCorrect++;
        else { state.weakness[picked.lesson.id] = (state.weakness[picked.lesson.id] || 0) + 1; appendHistory(picked.lesson.id, 'L1-miss'); }
        state.mechConstellation.attempts++;
        if (wasRight) state.mechConstellation.correct++;
        saveProgress();
        btn.disabled = true;
        btn.classList.add(wasRight ? 'recognize-opt-correct' : 'recognize-opt-wrong');
        const mark = shell.querySelector(`[data-mark="${optIdx}"]`);
        if (mark) mark.textContent = wasRight ? '✓' : '✗';
        if (counterEl) counterEl.textContent = String(picks);
        if (picks >= CONSTELLATION_PICKS_PER_CARD) {
          // Reveal phase: mark the remaining untagged-as-wrong + missed-correct.
          cardsCompleted++;
          perCardCorrect.push(cardCorrect);
          optBtns.forEach((b, i) => {
            b.disabled = true;
            if (optStates[i] === 'unpicked') {
              // If correct was missed, mark it "missed-correct"
              if (card.options[i].isCorrect) {
                b.classList.add('constellation-opt-missed');
                const mark = shell.querySelector(`[data-mark="${i}"]`);
                if (mark) mark.textContent = '⊙';
              }
              // Distractor that was NOT picked — keep neutral (no marker).
            }
          });
          const fb = shell.querySelector('[data-constellation-feedback]');
          if (fb) {
            fb.innerHTML = `
              <div class="constellation-reveal">
                <div class="constellation-reveal-score">${cardCorrect} of 3 correct</div>
                <div class="constellation-reveal-hint">⊙ marks the tagged lesson you didn't pick</div>
                <button class="constellation-next" data-action="constellation-next">Next card</button>
              </div>
            `;
            fb.querySelector('[data-action="constellation-next"]').addEventListener('click', () => { idx++; renderCard(); });
          }
        }
      });
    });
  }
  function renderSummary() {
    const totalCorrect = perCardCorrect.reduce((s, n) => s + n, 0);
    const totalPossible = deck.length * 3;
    const pct = Math.round((totalCorrect / totalPossible) * 100);
    const perfectCards = perCardCorrect.filter(n => n === 3).length;
    shell.innerHTML = `
      <div class="recognize-shell constellation-shell">
        <div class="recognize-header"><span>🪐 Constellation · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${totalCorrect} of ${totalPossible} correct picks · ${perfectCards} of ${deck.length} cards perfect (all 3)</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.mechConstellation.correct} / ${state.mechConstellation.attempts} (${state.mechConstellation.attempts > 0 ? Math.round(state.mechConstellation.correct / state.mechConstellation.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="constellation-again">🪐 Another session</button>
            <button class="secondary" data-action="constellation-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="constellation-again"]').addEventListener('click', () => startConstellationSession());
    shell.querySelector('[data-action="constellation-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 99: ⏪ Reverse-Walkthrough — backward-direction recall over walkthrough
// trace data. Each card shows the FINAL `{state, returns}` of one walkthrough
// example + 3 input options (all 3 examples from the SAME lesson); user taps
// which input produced this final state. **Adapted spec** from iter-95
// roadmap entry: the roadmap assumed lessons might have 4+ examples; empirical
// scan (iter-99 feasibility check) found ALL 99 Patterns/Applied lessons have
// EXACTLY 3 walkthrough examples. So distractors are 3-option MC from the
// same lesson — pure cognitive operation, no cross-lesson shape-mismatch
// concerns. Baseline guess rate is 33% but discriminating between 3 examples
// of the same algorithm requires actual trace-execution mental simulation.
// Distinct from Walkthrough (forward stepper) and Trace-Hop (mid-state recall).
const REVERSE_WALK_DECK_LEN = 8;
function _reverseWalkBuildCard(lesson, content) {
  const compiled = _compileWalkthrough(lesson.id, content.walkthrough);
  if (compiled.error || !Array.isArray(compiled.byExample)) return null;
  const usable = compiled.byExample.filter(b => !b.error && Array.isArray(b.steps) && b.steps.length >= 2);
  if (usable.length < 3) return null;
  // Pick a random example as the "correct" one.
  const correctIdx = Math.floor(Math.random() * usable.length);
  const correctBlock = usable[correctIdx];
  const finalStep = correctBlock.steps[correctBlock.steps.length - 1];
  // Build 3 input options (all 3 examples, shuffled).
  const options = usable.map((b, i) => ({
    inputLabel: b.example.label || `Example ${i + 1}`,
    inputJson: _formatStateVal(b.example.input),
    isCorrect: i === correctIdx
  }));
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    sectionName: lesson.section,
    finalState: finalStep.state,
    finalReturns: 'returns' in finalStep ? finalStep.returns : undefined,
    correctLabel: correctBlock.example.label || `Example ${correctIdx + 1}`,
    options
  };
}
async function _reverseWalkBuildDeck() {
  const candidates = CURRICULUM.filter(l =>
    l.status === 'full' && (l.track === 'patterns' || l.track === 'applied')
  );
  const shuffled = candidates.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const sample = shuffled.slice(0, 40);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { continue; }
    }
  }
  const deck = [];
  for (const lesson of shuffled) {
    if (deck.length >= REVERSE_WALK_DECK_LEN) break;
    const c = CONTENT[lesson.id];
    if (!c || !c.walkthrough || !Array.isArray(c.walkthrough.examples)) continue;
    const card = _reverseWalkBuildCard(lesson, c);
    if (card) deck.push(card);
  }
  return deck.length >= 4 ? deck : null;
}
function _reverseWalkRenderFinalState(state) {
  if (!state || typeof state !== 'object') return '<span class="reverse-walk-state-empty">(no state)</span>';
  const rows = Object.entries(state).map(([k, v]) =>
    `<div class="reverse-walk-state-row"><span class="reverse-walk-state-key">${escapeHtml(k)}</span><span class="reverse-walk-state-val">${escapeHtml(_formatStateVal(v))}</span></div>`
  );
  return rows.join('');
}
async function startReverseWalkSession() {
  const deck = await _reverseWalkBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Reverse-Walkthrough needs more lessons with walkthroughs. Click around a few Patterns lessons first, then try again.');
    return;
  }
  state.reverseWalk.sessions++;
  state.reverseWalk.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    const returnsLine = card.finalReturns !== undefined
      ? `<div class="reverse-walk-returns"><span class="reverse-walk-returns-label">returns</span> <span class="reverse-walk-returns-val">${escapeHtml(_formatStateVal(card.finalReturns))}</span></div>`
      : '';
    shell.innerHTML = `
      <div class="recognize-shell reverse-walk-shell">
        <div class="recognize-header">
          <span>⏪ Reverse · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-reverse-walk">✕ Exit</button>
        </div>
        <div class="reverse-walk-lesson-tag">${escapeHtml(card.lessonTitle)} · ${escapeHtml(card.sectionName)}</div>
        <div class="reverse-walk-tag">Which input produced this final state?</div>
        <div class="reverse-walk-final">
          <div class="reverse-walk-final-head">FINAL STATE</div>
          <div class="reverse-walk-state">${_reverseWalkRenderFinalState(card.finalState)}</div>
          ${returnsLine}
        </div>
        <div class="reverse-walk-options">
          ${card.options.map((o, i) => `
            <button class="recognize-opt reverse-walk-opt" data-opt="${i}">
              <span class="reverse-walk-opt-letter">${String.fromCharCode(65 + i)}</span>
              <span class="reverse-walk-opt-input">${escapeHtml(o.inputJson)}</span>
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-reverse-walk-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-reverse-walk"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.reverse-walk-opt');
    let answered = false;
    optBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const optIdx = +btn.dataset.opt;
        const picked = card.options[optIdx];
        const wasRight = !!picked.isCorrect;
        if (wasRight) correct++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.reverseWalk.attempts++;
        if (wasRight) state.reverseWalk.correct++;
        saveProgress();
        optBtns.forEach((b, i) => {
          b.disabled = true;
          if (card.options[i].isCorrect) b.classList.add('recognize-opt-correct');
          else if (i === optIdx) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-reverse-walk-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="reverse-walk-reveal">
              <div class="reverse-walk-reveal-title">${wasRight ? '✓ Got it' : '✗ The correct input was the highlighted one'}</div>
              <div class="reverse-walk-reveal-label">${escapeHtml(card.correctLabel)}</div>
              <button class="reverse-walk-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="reverse-walk-next" data-action="reverse-walk-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="reverse-walk-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell reverse-walk-shell">
        <div class="recognize-header"><span>⏪ Reverse · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} inputs matched · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.reverseWalk.correct} / ${state.reverseWalk.attempts} (${state.reverseWalk.attempts > 0 ? Math.round(state.reverseWalk.correct / state.reverseWalk.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="reverse-walk-again">⏪ Another session</button>
            <button class="secondary" data-action="reverse-walk-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="reverse-walk-again"]').addEventListener('click', () => startReverseWalkSession());
    shell.querySelector('[data-action="reverse-walk-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 122: 🧪 What-If Output Predictor — given the (memorized) canonical
// + ONE input drawn from `walkthrough.examples[].label`, pick the function's
// output from 4 MC options. Inverts the L1/L2/L3 ladder — L1 tests concepts,
// L2/L3 test code production, Crystal Ball (iter 77) tests "what does this
// canonical typically output", and What-If tests "for THIS input, what's the
// output?" — the trace-transfer cognitive direction PROFILE L22-24 names
// ("trace mentally under interview pressure") that no surface drills as pure
// input→output prediction.
//
// **Adapted spec from iter-120 roadmap entry:** the entry envisioned
// SYNTHESIZED fresh inputs + bucket-shift distractors. Empirical scan
// (iter-122 setup) found all 99 Patterns/Applied lessons store inputs in
// `example.label` as a free-form string ("[2,7,11,15] target=9 → [0,1]"),
// not a structured `inputs` field. Adapted to: use the 3 walkthrough
// examples as the input pool (per-lesson recall task), with the OTHER 2
// examples' `expected` as plausible same-lesson distractors + 1 algorithmic
// shift on the correct answer (±1 numeric / flipped boolean / reversed
// array / swapped first-last). v2 candidate: synthesize fresh inputs by
// mutating the label's input portion — requires per-pattern parser, deferred.
const WHATIF_DECK_LEN = 8;
function _whatifStringify(v) {
  if (v === undefined) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch (_) { return undefined; }
}
function _whatifShifts(raw, asStr) {
  // Produce 2-3 plausible-wrong variants of the correct answer. Strategy
  // varies by output shape to avoid type-mismatch giveaways (the iter-30
  // audit's anti-pattern that 🔮 Crystal's same-output-type filter also
  // protects against). Returns an array of string candidates; caller dedups.
  const out = [];
  if (typeof raw === 'number') {
    out.push(String(raw + 1));
    out.push(String(raw - 1));
    if (raw !== 0) out.push('0');
  } else if (typeof raw === 'boolean') {
    out.push(String(!raw));
  } else if (typeof asStr === 'string') {
    const s = asStr.trim();
    if (s === 'true') out.push('false');
    else if (s === 'false') out.push('true');
    else if (/^-?\d+$/.test(s)) {
      const n = parseInt(s, 10);
      out.push(String(n + 1));
      out.push(String(n - 1));
    } else if (s.startsWith('[') && s.endsWith(']')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          if (parsed.length >= 2) {
            const reversed = parsed.slice().reverse();
            out.push(JSON.stringify(reversed));
            const swapped = parsed.slice();
            [swapped[0], swapped[swapped.length - 1]] = [swapped[swapped.length - 1], swapped[0]];
            out.push(JSON.stringify(swapped));
          }
          out.push('[]');
        }
      } catch (_) {}
    }
  }
  return out;
}
function _whatifBuildCard(lesson, content) {
  const examples = content && content.walkthrough && Array.isArray(content.walkthrough.examples)
    ? content.walkthrough.examples : null;
  if (!examples || examples.length < 3) return null;
  // Filter to examples with both an `expected` and a `label` we can split on →.
  const usable = examples
    .map((ex, idx) => {
      const expStr = _whatifStringify(ex.expected);
      if (expStr === undefined) return null;
      const label = typeof ex.label === 'string' ? ex.label : '';
      const arrowIdx = label.indexOf('→');
      const inputPhrase = arrowIdx >= 0 ? label.slice(0, arrowIdx).trim() : label.trim();
      if (!inputPhrase) return null;
      return { idx, raw: ex.expected, expStr, inputPhrase };
    })
    .filter(Boolean);
  if (usable.length < 2) return null;
  // Pick the "correct" example.
  const correct = usable[Math.floor(Math.random() * usable.length)];
  // Build distractor pool from OTHER examples' expected, deduped by string.
  const pool = new Set();
  for (const u of usable) {
    if (u.idx === correct.idx) continue;
    if (u.expStr !== correct.expStr) pool.add(u.expStr);
  }
  // Pad with algorithmic shifts.
  for (const shift of _whatifShifts(correct.raw, correct.expStr)) {
    if (pool.size >= 3) break;
    if (shift !== undefined && shift !== correct.expStr) pool.add(shift);
  }
  // If still short (very rare), pad with em-dash so the card still renders 4-option.
  while (pool.size < 3) pool.add(pool.size === 0 ? '—' : pool.size === 1 ? '(no output)' : 'undefined');
  // Slice to exactly 3 distractors.
  const distractors = Array.from(pool).slice(0, 3);
  const options = [
    { val: correct.expStr, isCorrect: true },
    ...distractors.map(d => ({ val: d, isCorrect: false }))
  ];
  // Fisher-Yates shuffle.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  // Truncate canonical to ≤30 lines for mobile readability — Crystal Ball
  // precedent (iter 77). Long canonicals still render; the editor scrolls.
  const code = (content.reference && content.reference.code) || (content.L3 && content.L3.canonical) || '';
  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    sectionName: lesson.section,
    inputPhrase: correct.inputPhrase,
    canonicalCode: code,
    options,
    correctVal: correct.expStr
  };
}
async function _whatifBuildDeck() {
  const candidates = CURRICULUM.filter(l =>
    l.status === 'full' && (l.track === 'patterns' || l.track === 'applied')
  );
  const shuffled = candidates.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Preload a sample of 40 lessons to keep deck-build under ~1s on first run.
  const sample = shuffled.slice(0, 40);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { continue; }
    }
  }
  const deck = [];
  for (const lesson of shuffled) {
    if (deck.length >= WHATIF_DECK_LEN) break;
    const c = CONTENT[lesson.id];
    if (!c) continue;
    const card = _whatifBuildCard(lesson, c);
    if (card) deck.push(card);
  }
  return deck.length >= 4 ? deck : null;
}
async function startWhatifSession() {
  const deck = await _whatifBuildDeck();
  if (!deck || deck.length < 4) {
    alert('What-If needs more lessons with walkthrough examples. Click around a few Patterns lessons first, then try again.');
    return;
  }
  state.whatif.sessions++;
  state.whatif.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell whatif-shell">
        <div class="recognize-header">
          <span>🧪 What-If · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-whatif">✕ Exit</button>
        </div>
        <div class="whatif-lesson-tag">${escapeHtml(card.lessonTitle)} · ${escapeHtml(card.sectionName)}</div>
        <pre class="whatif-canonical cm-s-dracula" data-whatif-code></pre>
        <div class="whatif-input">
          <span class="whatif-input-label">INPUT</span>
          <span class="whatif-input-val">${escapeHtml(card.inputPhrase)}</span>
        </div>
        <div class="whatif-tag">What does the function output?</div>
        <div class="whatif-options">
          ${card.options.map((o, i) => `
            <button class="recognize-opt whatif-opt" data-opt="${i}">
              <span class="whatif-opt-letter">${String.fromCharCode(65 + i)}</span>
              <span class="whatif-opt-val">${escapeHtml(o.val)}</span>
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-whatif-feedback></div>
      </div>
    `;
    // Syntax-highlight the canonical via existing CodeMirror runMode helper.
    const codeEl = shell.querySelector('[data-whatif-code]');
    if (codeEl && typeof colorizeInto === 'function') colorizeInto(codeEl, card.canonicalCode);
    else if (codeEl) codeEl.textContent = card.canonicalCode;
    shell.querySelector('[data-action="exit-whatif"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.whatif-opt');
    let answered = false;
    optBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const optIdx = +btn.dataset.opt;
        const picked = card.options[optIdx];
        const wasRight = !!picked.isCorrect;
        if (wasRight) correct++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.whatif.attempts++;
        if (wasRight) state.whatif.correct++;
        saveProgress();
        optBtns.forEach((b, i) => {
          b.disabled = true;
          if (card.options[i].isCorrect) b.classList.add('recognize-opt-correct');
          else if (i === optIdx) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-whatif-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="whatif-reveal">
              <div class="whatif-reveal-title">${wasRight ? '✓ Got it' : '✗ The correct output was'}</div>
              <div class="whatif-reveal-val">${escapeHtml(card.correctVal)}</div>
              <button class="whatif-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="whatif-next" data-action="whatif-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="whatif-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell whatif-shell">
        <div class="recognize-header"><span>🧪 What-If · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} outputs correct · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.whatif.correct} / ${state.whatif.attempts} (${state.whatif.attempts > 0 ? Math.round(state.whatif.correct / state.whatif.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="whatif-again">🧪 Another session</button>
            <button class="secondary" data-action="whatif-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="whatif-again"]').addEventListener('click', () => startWhatifSession());
    shell.querySelector('[data-action="whatif-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 102: 🗂 Notes→Lesson Reverse Lookup — cross-corpus localization over
// `reference.notes[]`. Each card shows ONE note string + 4 lesson-title MC
// buttons (1 correct + 3 distractors, same-section-preferred for plausibility);
// user taps which lesson the note belongs to. Reveal shows lesson + drill CTA.
// Third recall direction over the notes corpus: 🎰 Gotcha = whole-note yes/no
// recognition; 📝 Notes Cloze = intra-note keyword cloze; 🗂 Locate = note →
// which lesson localization. Interview-mid-problem retrieval pattern: "I
// remember a gotcha about negative-zero, where was that?" — currently
// unsupported. From roadmap.md iter-100 #2.
const NOTES_LOCATE_DECK_LEN = 10;
const NOTES_LOCATE_OPTIONS = 4;
const NOTES_LOCATE_MIN_NOTE_LEN = 30;
function _notesLocateBuildCard(noteEntry, allFullLessons) {
  // Pick 3 distractors. Prefer same-section lessons; fall back to any
  // full-status lesson if same-section pool is too small.
  const same = [];
  const other = [];
  for (const l of allFullLessons) {
    if (l.id === noteEntry.lessonId) continue;
    if (l.section === noteEntry.sectionName) same.push(l);
    else other.push(l);
  }
  for (const arr of [same, other]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  const distractors = same.concat(other).slice(0, NOTES_LOCATE_OPTIONS - 1);
  if (distractors.length < NOTES_LOCATE_OPTIONS - 1) return null;
  const correctLesson = findLesson(noteEntry.lessonId);
  if (!correctLesson) return null;
  const options = [
    { lesson: correctLesson, isCorrect: true },
    ...distractors.map(l => ({ lesson: l, isCorrect: false }))
  ];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    lessonId: noteEntry.lessonId,
    sectionName: noteEntry.sectionName,
    note: noteEntry.note,
    options
  };
}
async function _notesLocateBuildDeck() {
  // Preload a broad sample so the note pool is large.
  const sample = CURRICULUM.filter(l => l.status === 'full').slice(0, 80);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
      if (Object.keys(CONTENT).length >= 40) break;
    }
  }
  const allFull = CURRICULUM.filter(l => l.status === 'full');
  // Flatten eligible notes — filter by min length (uniqueness proxy per
  // iter-100 roadmap entry; longer notes are more distinctive).
  const pool = [];
  for (const lesson of CURRICULUM) {
    const c = CONTENT[lesson.id];
    if (!c || !c.reference || !Array.isArray(c.reference.notes)) continue;
    for (const note of c.reference.notes) {
      if (typeof note !== 'string' || note.length < NOTES_LOCATE_MIN_NOTE_LEN) continue;
      pool.push({ lessonId: lesson.id, sectionName: lesson.section, note });
    }
  }
  if (pool.length < 4) return null;
  // Fisher-Yates.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Build cards.
  const deck = [];
  for (const noteEntry of pool) {
    if (deck.length >= NOTES_LOCATE_DECK_LEN) break;
    const card = _notesLocateBuildCard(noteEntry, allFull);
    if (card) deck.push(card);
  }
  return deck.length >= 4 ? deck : null;
}
async function startNotesLocateSession() {
  const deck = await _notesLocateBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Notes Locate needs more loaded lessons. Click around a few first, then try again.');
    return;
  }
  state.notesLocate.sessions++;
  state.notesLocate.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell notes-locate-shell">
        <div class="recognize-header">
          <span>🗂 Locate · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-notes-locate">✕ Exit</button>
        </div>
        <div class="notes-locate-tag">Which lesson does this gotcha belong to?</div>
        <div class="notes-locate-note">${escapeHtml(card.note)}</div>
        <div class="notes-locate-options">
          ${card.options.map((o, i) => `
            <button class="recognize-opt notes-locate-opt" data-opt="${i}">
              <span class="notes-locate-opt-letter">${String.fromCharCode(65 + i)}</span>
              <span class="notes-locate-opt-body">
                <span class="notes-locate-opt-title">${escapeHtml(o.lesson.title)}</span>
                <span class="notes-locate-opt-section">${escapeHtml(o.lesson.section)}</span>
              </span>
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-notes-locate-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-notes-locate"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.notes-locate-opt');
    let answered = false;
    optBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const optIdx = +btn.dataset.opt;
        const picked = card.options[optIdx];
        const wasRight = !!picked.isCorrect;
        if (wasRight) correct++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.notesLocate.attempts++;
        if (wasRight) state.notesLocate.correct++;
        saveProgress();
        optBtns.forEach((b, i) => {
          b.disabled = true;
          if (card.options[i].isCorrect) b.classList.add('recognize-opt-correct');
          else if (i === optIdx) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-notes-locate-feedback]');
        if (fb) {
          const correctLesson = card.options.find(o => o.isCorrect).lesson;
          fb.innerHTML = `
            <div class="notes-locate-reveal">
              <div class="notes-locate-reveal-title">${wasRight ? '✓ Got it' : '✗ The note was from'}: <strong>${escapeHtml(correctLesson.title)}</strong></div>
              <div class="notes-locate-reveal-section">${escapeHtml(correctLesson.section)}</div>
              <button class="notes-locate-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="notes-locate-next" data-action="notes-locate-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="notes-locate-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell notes-locate-shell">
        <div class="recognize-header"><span>🗂 Locate · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} lessons identified · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.notesLocate.correct} / ${state.notesLocate.attempts} (${state.notesLocate.attempts > 0 ? Math.round(state.notesLocate.correct / state.notesLocate.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="notes-locate-again">🗂 Another session</button>
            <button class="secondary" data-action="notes-locate-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="notes-locate-again"]').addEventListener('click', () => startNotesLocateSession());
    shell.querySelector('[data-action="notes-locate-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 109: 🔖 Match — bidirectional title ↔ description matcher (Cat 8 first
// ship; algorithm name ↔ description). Drills the name-to-concept retrieval
// direction the L1→L2→L3 ladder doesn't cover: "you've heard of Kadane's —
// what does it do?" and the reverse. Pure recombination over already-loaded
// `title` (manifest) + `description` (per-lesson JSON). 10-card mobile session;
// direction (title-prompt vs description-prompt) coin-flipped per card.
// Sourced from ideas-by-category.md Promotion shortlist #5 (Cat 8 § Modalities).
const MATCH_DECK_LEN = 10;
const MATCH_OPTIONS = 4;
function _matchBuildCard(lesson, direction, allEligible) {
  // Same-section distractors preferred; cross-section fallback. allEligible is
  // the patterns+applied authored set (with CONTENT loaded — i.e. description
  // available). direction ∈ {'title-to-desc', 'desc-to-title'}.
  const correctContent = CONTENT[lesson.id];
  if (!correctContent || !correctContent.description) return null;
  const same = [];
  const other = [];
  for (const l of allEligible) {
    if (l.id === lesson.id) continue;
    const c = CONTENT[l.id];
    if (!c || !c.description) continue;
    if (l.section === lesson.section) same.push(l);
    else other.push(l);
  }
  for (const arr of [same, other]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  const distractors = same.concat(other).slice(0, MATCH_OPTIONS - 1);
  if (distractors.length < MATCH_OPTIONS - 1) return null;
  const buildOpt = (l, isCorrect) => ({
    lesson: l,
    description: (CONTENT[l.id] && CONTENT[l.id].description) || '',
    isCorrect
  });
  const options = [buildOpt(lesson, true), ...distractors.map(l => buildOpt(l, false))];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    lessonId: lesson.id,
    sectionName: lesson.section,
    title: lesson.title,
    description: correctContent.description,
    direction,
    options
  };
}
async function _matchBuildDeck() {
  // Patterns + Applied lessons (descriptions are richest there — Syntax titles
  // double as descriptors already). Preload a sample so CONTENT has enough
  // descriptions for distractor pools.
  const eligible = CURRICULUM.filter(l =>
    l.status === 'full' && (l.track === 'patterns' || l.track === 'applied')
  );
  const sample = eligible.slice(0, 80);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
      if (Object.keys(CONTENT).length >= 40) break;
    }
  }
  const eligibleLoaded = eligible.filter(l => CONTENT[l.id] && CONTENT[l.id].description);
  if (eligibleLoaded.length < MATCH_OPTIONS) return null;
  // Shuffle + slice for the deck. Direction coin-flipped per card so a session
  // mixes both retrieval directions (title→desc and desc→title).
  const shuffled = eligibleLoaded.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const deck = [];
  for (const lesson of shuffled) {
    if (deck.length >= MATCH_DECK_LEN) break;
    const direction = Math.random() < 0.5 ? 'title-to-desc' : 'desc-to-title';
    const card = _matchBuildCard(lesson, direction, eligibleLoaded);
    if (card) deck.push(card);
  }
  return deck.length >= 4 ? deck : null;
}
async function startMatchSession() {
  const deck = await _matchBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Match needs more loaded lessons. Click around a few first, then try again.');
    return;
  }
  state.match.sessions++;
  state.match.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    const isTitleToDesc = card.direction === 'title-to-desc';
    const promptLabel = isTitleToDesc
      ? 'Which description matches this lesson?'
      : 'Which lesson does this describe?';
    const promptBody = isTitleToDesc
      ? `<div class="match-title">${escapeHtml(card.title)}</div>
         <div class="match-section">${escapeHtml(card.sectionName)}</div>`
      : `<div class="match-desc">${escapeHtml(card.description)}</div>`;
    const optBody = isTitleToDesc
      ? (o, i) => `<span class="match-opt-letter">${String.fromCharCode(65 + i)}</span>
                   <span class="match-opt-body match-opt-desc">${escapeHtml(o.description)}</span>`
      : (o, i) => `<span class="match-opt-letter">${String.fromCharCode(65 + i)}</span>
                   <span class="match-opt-body">
                     <span class="match-opt-title">${escapeHtml(o.lesson.title)}</span>
                     <span class="match-opt-section">${escapeHtml(o.lesson.section)}</span>
                   </span>`;
    shell.innerHTML = `
      <div class="recognize-shell match-shell" data-direction="${card.direction}">
        <div class="recognize-header">
          <span>🔖 Match · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-match">✕ Exit</button>
        </div>
        <div class="match-tag">${escapeHtml(promptLabel)}</div>
        <div class="match-prompt">${promptBody}</div>
        <div class="match-options">
          ${card.options.map((o, i) => `
            <button class="recognize-opt match-opt" data-opt="${i}">${optBody(o, i)}</button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-match-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-match"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.match-opt');
    let answered = false;
    optBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const optIdx = +btn.dataset.opt;
        const picked = card.options[optIdx];
        const wasRight = !!picked.isCorrect;
        if (wasRight) correct++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.match.attempts++;
        if (wasRight) state.match.correct++;
        saveProgress();
        optBtns.forEach((b, i) => {
          b.disabled = true;
          if (card.options[i].isCorrect) b.classList.add('recognize-opt-correct');
          else if (i === optIdx) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-match-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="match-reveal">
              <div class="match-reveal-title">${wasRight ? '✓ Got it' : '✗ Correct match'}: <strong>${escapeHtml(card.title)}</strong></div>
              <div class="match-reveal-section">${escapeHtml(card.sectionName)}</div>
              <button class="match-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="match-next" data-action="match-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="match-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell match-shell">
        <div class="recognize-header"><span>🔖 Match · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} matched · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.match.correct} / ${state.match.attempts} (${state.match.attempts > 0 ? Math.round(state.match.correct / state.match.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="match-again">🔖 Another session</button>
            <button class="secondary" data-action="match-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="match-again"]').addEventListener('click', () => startMatchSession());
    shell.querySelector('[data-action="match-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 111: 🌈 Sections — section mastery heatmap (Cat 7 § Metacognition;
// spatial axis vs the 5 existing temporal Cat 7 surfaces — Hint-Cost,
// Half-Life, Heatstrip, At Risk, Resurrect all operate on TIME HORIZONS,
// none aggregates to SECTION grain). 28-cell grid colored by per-section
// mastery %; tap a cell → close grid + drill the first not-mastered lesson
// in that section. Pure derivation over CURRICULUM + state.progress — no
// new state, no `__v` bump. Sourced from ideas-by-category.md Promotion
// shortlist #1.
function _sgBuildRows() {
  // Group full lessons by section, preserving manifest order. Returns
  // [{name, mastered, total, pct, weakestId, allMastered}]; skips empty sections.
  const order = [];
  const groups = new Map();
  for (const l of CURRICULUM) {
    if (l.status !== 'full') continue;
    if (!groups.has(l.section)) { groups.set(l.section, []); order.push(l.section); }
    groups.get(l.section).push(l);
  }
  return order.map(name => {
    const lessons = groups.get(name);
    const total = lessons.length;
    const mastered = lessons.filter(l => lessonOverallStatus(l.id) === 'mastered').length;
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    const allMastered = total > 0 && mastered === total;
    let weakestId = null;
    if (allMastered) {
      // Retention pick — random lesson from the mastered set.
      weakestId = lessons[Math.floor(Math.random() * lessons.length)].id;
    } else {
      // First not-mastered by manifest order.
      const first = lessons.find(l => lessonOverallStatus(l.id) !== 'mastered');
      weakestId = first ? first.id : (lessons[0] ? lessons[0].id : null);
    }
    return { name, mastered, total, pct, weakestId, allMastered };
  });
}
function _sgColor(pct) {
  // Interpolate red-400 (rgb 248,113,113) → amber-400 (251,191,36) →
  // emerald-400 (52,211,153). Cells render with rgba alpha so the colored
  // wash is informational, not over-saturated.
  let r, g, b;
  if (pct <= 50) {
    const t = pct / 50;
    r = 248 + (251 - 248) * t;
    g = 113 + (191 - 113) * t;
    b = 113 + (36 - 113) * t;
  } else {
    const t = (pct - 50) / 50;
    r = 251 + (52 - 251) * t;
    g = 191 + (211 - 191) * t;
    b = 36 + (153 - 36) * t;
  }
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}
function startSectionGrid() {
  const rows = _sgBuildRows();
  if (!rows.length) {
    alert('No sections with authored lessons yet.');
    return;
  }
  const shell = document.getElementById('lesson-shell');
  // Weakest section first in the "where to study tonight?" nudge (lowest pct).
  const weakestSection = rows.slice().sort((a, b) => a.pct - b.pct)[0];
  shell.innerHTML = `
    <div class="recognize-shell sg-shell">
      <div class="recognize-header">
        <span>🌈 Sections · mastery heatmap</span>
        <button class="recognize-exit" data-action="exit-sg">✕ Exit</button>
      </div>
      <div class="sg-nudge">Where to study tonight? Try <strong>${escapeHtml(weakestSection.name)}</strong> (${weakestSection.pct}% mastered).</div>
      <div class="sg-grid">
        ${rows.map(r => {
          const c = _sgColor(r.pct);
          const bg = `rgba(${c.r},${c.g},${c.b},0.18)`;
          const border = `rgba(${c.r},${c.g},${c.b},0.55)`;
          const ringClass = r.allMastered ? 'sg-cell-mastered' : '';
          return `<button class="sg-cell ${ringClass}" data-section="${escapeHtml(r.name)}" data-lesson="${escapeHtml(r.weakestId || '')}" style="background:${bg};border-color:${border};">
            <div class="sg-cell-name">${escapeHtml(r.name)}</div>
            <div class="sg-cell-pct">${r.pct}%</div>
            <div class="sg-cell-counts">${r.mastered}/${r.total}</div>
          </button>`;
        }).join('')}
      </div>
      <div class="sg-legend">
        <span class="sg-legend-swatch" style="background:rgba(248,113,113,0.6);"></span> 0% mastered
        <span class="sg-legend-swatch" style="background:rgba(251,191,36,0.6);"></span> 50%
        <span class="sg-legend-swatch" style="background:rgba(52,211,153,0.6);"></span> 100%
      </div>
    </div>
  `;
  shell.querySelector('[data-action="exit-sg"]').addEventListener('click', () => renderLesson());
  shell.querySelectorAll('.sg-cell').forEach(btn => {
    btn.addEventListener('click', () => {
      const lessonId = btn.dataset.lesson;
      if (!lessonId) return;
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const wantedTab = coarse ? 'L1' : 'L3';
      selectLesson(lessonId);
      // selectLesson set currentTab='auto'; override for the drill-tier
      // calibration matching Resurrect/Bridge precedent.
      selectTab(wantedTab);
    });
  });
}

// iter 86: 🔀 Swap-Bench — pairwise idiom-equivalence drill. Loads a curated
// data/idiom-pairs.json of {a, b, sameBehavior, explain, sourceLessonId?}.
// Each card stacks two snippets vertically (mobile-first; PROFILE.md 80%-phone)
// and asks "Same behavior?". Forces transfer-of-mental-model — the rusty
// engineer recognizes that two different idioms reach the same result, or
// that two near-identical-looking idioms diverge. From `roadmap.md iter 82
// entry #3 (Idiom Swap-Bench)`. Single-iter MVP; expandable by appending to
// the JSON file (same pattern as Claim iter 79→80).
const SWAP_DECK_LEN = 6;
let SWAP_PAIRS = null; // [{id, title, a, b, sameBehavior, explain, sourceLessonId?}]
let _swapPairsLoaded = false;
async function _loadSwapPairsRegistry() {
  if (_swapPairsLoaded) return;
  try {
    const res = await fetch('data/idiom-pairs.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const reg = await res.json();
    SWAP_PAIRS = Array.isArray(reg && reg.pairs) ? reg.pairs : [];
    _swapPairsLoaded = true;
  } catch (_) { /* fail soft — button stays but session won't open */ }
}

function _swapBuildDeck() {
  if (!SWAP_PAIRS || SWAP_PAIRS.length < 3) return null;
  // Fisher-Yates shuffle a copy.
  const pool = SWAP_PAIRS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(SWAP_DECK_LEN, pool.length));
}

async function startSwapBenchSession() {
  await _loadSwapPairsRegistry();
  const deck = _swapBuildDeck();
  if (!deck || deck.length < 3) {
    alert('Idiom-pair registry could not load.');
    return;
  }
  state.swapBench.sessions++;
  state.swapBench.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell swap-shell">
        <div class="recognize-header">
          <span>🔀 Swap-Bench · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-swap">✕ Exit</button>
        </div>
        <div class="swap-title">${escapeHtml(card.title || '')}</div>
        <div class="swap-pair">
          <div class="swap-snippet">
            <div class="swap-label">A</div>
            <pre class="swap-code cm-s-dracula" data-swap-a></pre>
          </div>
          <div class="swap-divider">↕ same behavior? ↕</div>
          <div class="swap-snippet">
            <div class="swap-label">B</div>
            <pre class="swap-code cm-s-dracula" data-swap-b></pre>
          </div>
        </div>
        <div class="swap-options">
          <button class="recognize-opt swap-opt" data-pick="same">✓ Same behavior</button>
          <button class="recognize-opt swap-opt" data-pick="diff">✗ Different behavior</button>
        </div>
        <div class="recognize-feedback" data-swap-feedback></div>
      </div>
    `;
    const aEl = shell.querySelector('[data-swap-a]');
    const bEl = shell.querySelector('[data-swap-b]');
    if (aEl && typeof colorizeInto === 'function') colorizeInto(aEl, card.a);
    if (bEl && typeof colorizeInto === 'function') colorizeInto(bEl, card.b);
    shell.querySelector('[data-action="exit-swap"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.swap-opt');
    let answered = false;
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const saidSame = btn.dataset.pick === 'same';
        const wasRight = saidSame === !!card.sameBehavior;
        if (wasRight) correct++;
        else if (card.sourceLessonId && findLesson(card.sourceLessonId)) {
          state.weakness[card.sourceLessonId] = (state.weakness[card.sourceLessonId] || 0) + 1;
          appendHistory(card.sourceLessonId, 'L1-miss');
        }
        state.swapBench.attempts++;
        if (wasRight) state.swapBench.correct++;
        saveProgress();
        opts.forEach(b => {
          b.disabled = true;
          const isCorrectChoice = (b.dataset.pick === 'same') === !!card.sameBehavior;
          if (isCorrectChoice) b.classList.add('recognize-opt-correct');
          else if (b === btn) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-swap-feedback]');
        if (fb) {
          const verdict = card.sameBehavior ? 'Same behavior ✓' : 'Different behavior ✗';
          fb.innerHTML = `
            <div class="swap-reveal ${wasRight ? 'swap-reveal-good' : 'swap-reveal-bad'}">
              <div class="swap-verdict">${verdict}</div>
              <div class="swap-explain">${escapeHtml(card.explain || '')}</div>
              ${card.sourceLessonId && findLesson(card.sourceLessonId)
                ? `<button class="gotcha-drill" data-drill="${escapeHtml(card.sourceLessonId)}">Drill source lesson →</button>`
                : ''}
              <button class="gotcha-next" data-action="swap-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="swap-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell swap-shell">
        <div class="recognize-header"><span>🔀 Swap-Bench · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} idiom pairs judged correctly</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.swapBench.correct} / ${state.swapBench.attempts} (${state.swapBench.attempts > 0 ? Math.round(state.swapBench.correct / state.swapBench.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="swap-again">🔀 Another bench</button>
            <button class="secondary" data-action="swap-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="swap-again"]').addEventListener('click', () => startSwapBenchSession());
    shell.querySelector('[data-action="swap-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 79: 📐 Smell-Test Complexity-Claim drill — §9B Code Evaluation Skills.
// Loads a small curated map (data/complexity-claims.json) of {lessonId: {actual,
// distractor}}; each card shows the canonical + a randomly-chosen claim (50/50
// actual vs distractor); user 2-taps "correct" or "wrong"; reveal shows the
// actual + a one-line note. Trains the interview reflex "does the stated
// complexity match the code?" — heavily graded in interviews but never drilled.
// From `ideas-by-category.md § 9B → Smell-test complexity-claim drill`.
const CLAIM_DECK_LEN = 5;
let CLAIMS = null; // {lessonId: {actual, distractor, note}}
let _claimsLoaded = false;
async function _loadClaimsRegistry() {
  if (_claimsLoaded) return;
  try {
    const res = await fetch('data/complexity-claims.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const reg = await res.json();
    CLAIMS = (reg && reg.claims) || {};
    _claimsLoaded = true;
  } catch (_) { /* fail soft — surface stays hidden */ }
}

async function _claimBuildDeck() {
  if (!CLAIMS) return null;
  const lessonIds = Object.keys(CLAIMS).filter(id => findLesson(id));
  for (const id of lessonIds) {
    if (!CONTENT[id]) {
      try { await loadLessonContent(id); } catch (_) { /* skip */ }
    }
  }
  const usable = lessonIds.filter(id => {
    const c = CONTENT[id];
    return c && c.L3 && c.L3.canonical;
  });
  if (usable.length < 3) return null;
  // Shuffle then take CLAIM_DECK_LEN.
  const shuffled = usable.slice().sort(() => Math.random() - 0.5).slice(0, CLAIM_DECK_LEN);
  return shuffled.map(id => {
    const cl = CLAIMS[id];
    const lesson = findLesson(id);
    const showActual = Math.random() < 0.5;
    const claim = showActual ? cl.actual : cl.distractor;
    return {
      lessonId: id,
      lessonTitle: lesson.title,
      sectionName: lesson.section,
      canonical: CONTENT[id].L3.canonical,
      claim,
      isCorrect: showActual, // user should tap "correct" iff showActual
      actual: cl.actual,
      note: cl.note || ''
    };
  });
}

async function startClaimSession() {
  await _loadClaimsRegistry();
  if (!CLAIMS) {
    alert('Complexity-claim registry could not load.');
    return;
  }
  const deck = await _claimBuildDeck();
  if (!deck || deck.length < 3) {
    alert('Not enough complexity-claim entries loaded.');
    return;
  }
  state.claim.sessions++;
  state.claim.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell claim-shell">
        <div class="recognize-header">
          <span>📐 Claim · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-claim">✕ Exit</button>
        </div>
        <div class="claim-meta">${escapeHtml(card.sectionName)} · <span class="claim-lesson">${escapeHtml(card.lessonTitle)}</span></div>
        <pre class="crystal-code cm-s-dracula" data-claim-code></pre>
        <div class="claim-stated">Claimed time complexity: <code class="claim-stated-val">${escapeHtml(card.claim)}</code></div>
        <div class="claim-options">
          <button class="recognize-opt claim-opt" data-pick="correct">✓ Correct</button>
          <button class="recognize-opt claim-opt" data-pick="wrong">✗ Wrong</button>
        </div>
        <div class="recognize-feedback" data-claim-feedback></div>
      </div>
    `;
    const codeEl = shell.querySelector('[data-claim-code]');
    if (codeEl && typeof colorizeInto === 'function') colorizeInto(codeEl, card.canonical);
    shell.querySelector('[data-action="exit-claim"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.claim-opt');
    let answered = false;
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const said = btn.dataset.pick === 'correct'; // user's claim
        const wasRight = said === card.isCorrect;
        if (wasRight) correct++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.claim.attempts++;
        if (wasRight) state.claim.correct++;
        saveProgress();
        opts.forEach(b => {
          b.disabled = true;
          const isCorrectChoice = (b.dataset.pick === 'correct') === card.isCorrect;
          if (isCorrectChoice) b.classList.add('recognize-opt-correct');
          else if (b === btn) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-claim-feedback]');
        if (fb) {
          const verdict = card.isCorrect ? `Actually <code>${escapeHtml(card.actual)}</code> ✓ (claim was correct)` : `Actually <code>${escapeHtml(card.actual)}</code> ≠ claim`;
          fb.innerHTML = `<div class="claim-reveal ${wasRight ? 'claim-reveal-good' : 'claim-reveal-bad'}">${verdict}${card.note ? `<div class="claim-note">${escapeHtml(card.note)}</div>` : ''}</div>`;
        }
        setTimeout(() => { idx++; renderCard(); }, 2400);
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell claim-shell">
        <div class="recognize-header"><span>📐 Claim · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} complexity claims judged correctly</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.claim.correct} / ${state.claim.attempts} (${state.claim.attempts > 0 ? Math.round(state.claim.correct / state.claim.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="claim-again">📐 Another session</button>
            <button class="secondary" data-action="claim-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="claim-again"]').addEventListener('click', () => startClaimSession());
    shell.querySelector('[data-action="claim-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 77: 🔮 Predict-the-Output — Crystal Ball mental-execution drill. Show
// a patterns canonical + 4 expected-output options (correct + 3 same-type
// distractors from other lessons' L3.expectedOutput); user picks which the
// code produces WITHOUT running it. Trains mental simulation — the
// foundational interview skill the L1/L2/L3 ladder never drills (everything
// today is "produce code"; this drills "execute code in your head"). Pure
// recombination; no per-lesson authoring. From `ideas-by-category.md § 1
// Drilling Surfaces → Crystal Ball mental-execution drill`.
const CRYSTAL_DECK_LEN = 5;

function _crystalOutputType(s) {
  // Coarse type-tag so distractors share shape with the correct answer
  // (array→array, number→number, etc.); falls back to 'string'.
  const trimmed = (s || '').trim();
  if (!trimmed) return 'string';
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return 'array';
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return 'object';
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return 'number';
  if (trimmed === 'true' || trimmed === 'false') return 'boolean';
  return 'string';
}

function _crystalBuildDeck() {
  const candidates = CURRICULUM.filter(l => l.track === 'patterns' && l.status === 'full');
  const pool = [];
  for (const l of candidates) {
    const c = CONTENT[l.id];
    if (!c || !c.L3 || !c.L3.canonical || !c.L3.expectedOutput) continue;
    // Skip overly long canonicals — mobile readability + mental-sim feasibility.
    if (c.L3.canonical.split('\n').length > 30) continue;
    pool.push({
      lessonId: l.id,
      lessonTitle: l.title,
      sectionName: l.section,
      canonical: c.L3.canonical,
      output: c.L3.expectedOutput,
      type: _crystalOutputType(c.L3.expectedOutput)
    });
  }
  if (pool.length < 4) return null;
  // Group outputs by type for distractor selection (prefer same-type so the
  // correct answer isn't trivially obvious via type mismatch).
  const byType = {};
  for (const p of pool) {
    (byType[p.type] = byType[p.type] || []).push(p);
  }
  // Shuffle pool, pick deck-len cards.
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const cards = [];
  for (const target of shuffled.slice(0, CRYSTAL_DECK_LEN * 2)) {
    if (cards.length >= CRYSTAL_DECK_LEN) break;
    // Distractor pool: same-type outputs from other lessons, excluding the
    // target's own output (defensive: identical outputs across lessons exist).
    const sameType = (byType[target.type] || []).filter(p =>
      p.lessonId !== target.lessonId && p.output !== target.output
    );
    if (sameType.length < 3) continue; // need ≥3 distractors
    const distractors = sameType.sort(() => Math.random() - 0.5).slice(0, 3).map(p => p.output);
    const options = [target.output, ...distractors];
    // Shuffle option order.
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    cards.push({
      lessonId: target.lessonId,
      lessonTitle: target.lessonTitle,
      sectionName: target.sectionName,
      canonical: target.canonical,
      options,
      correct: target.output
    });
  }
  return cards.length >= 3 ? cards : null;
}

async function startCrystalSession() {
  // Preload patterns lessons so the pool has variety.
  const patternsLessons = CURRICULUM.filter(l => l.track === 'patterns' && l.status === 'full').slice(0, 30);
  for (const l of patternsLessons) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
      if (Object.keys(CONTENT).length >= 20) break;
    }
  }
  const deck = _crystalBuildDeck();
  if (!deck || deck.length < 3) {
    alert('Predict needs more loaded patterns lessons. Click around a few patterns first, then try again.');
    return;
  }
  state.crystal.sessions++;
  state.crystal.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell crystal-shell">
        <div class="recognize-header">
          <span>🔮 Predict · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-crystal">✕ Exit</button>
        </div>
        <div class="crystal-meta">${escapeHtml(card.sectionName)} · <span class="crystal-lesson">${escapeHtml(card.lessonTitle)}</span></div>
        <div class="crystal-hint">Read the code. Don't run it. Pick the output.</div>
        <pre class="crystal-code cm-s-dracula" data-crystal-code></pre>
        <div class="recognize-options crystal-options">
          ${card.options.map(opt => `<button class="recognize-opt crystal-opt" data-opt="${escapeHtml(opt)}"><code>${escapeHtml(opt)}</code></button>`).join('')}
        </div>
        <div class="recognize-feedback" data-crystal-feedback></div>
      </div>
    `;
    // Syntax-highlight the canonical via the existing CodeMirror runMode path.
    const codeEl = shell.querySelector('[data-crystal-code]');
    if (codeEl && typeof colorizeInto === 'function') colorizeInto(codeEl, card.canonical);
    shell.querySelector('[data-action="exit-crystal"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.recognize-opt');
    let answered = false;
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const picked = btn.dataset.opt;
        const wasCorrect = picked === card.correct;
        if (wasCorrect) correct++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.crystal.attempts++;
        if (wasCorrect) state.crystal.correct++;
        saveProgress();
        opts.forEach(b => {
          b.disabled = true;
          if (b.dataset.opt === card.correct) b.classList.add('recognize-opt-correct');
          else if (b === btn) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-crystal-feedback]');
        if (fb) fb.innerHTML = wasCorrect
          ? `<span class="recognize-good">✓</span>`
          : `<span class="recognize-bad">✗ Was ${escapeHtml(card.correct)}</span>`;
        setTimeout(() => { idx++; renderCard(); }, wasCorrect ? 800 : 1700);
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell crystal-shell">
        <div class="recognize-header"><span>🔮 Predict · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} outputs predicted correctly</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Mental-sim lifetime: ${state.crystal.correct} / ${state.crystal.attempts} (${state.crystal.attempts > 0 ? Math.round(state.crystal.correct / state.crystal.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="crystal-again">🔮 Another session</button>
            <button class="secondary" data-action="crystal-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="crystal-again"]').addEventListener('click', () => startCrystalSession());
    shell.querySelector('[data-action="crystal-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 76: 🎯 Reverse Problem-ID — §9B code-evaluation surface (sibling to
// Recognize but inverted: Recognize shows prompt → pick section; Reverse
// shows input/output trace → pick problem). Forward-from-output reasoning
// — a common interview unblock pattern. Closes iter-75 § Next iter pick.
// From `ideas-by-category.md § 9B → Reverse problem-identification`.
// Lifetime stats reuse `state.recognize` (same diagnostic-direction modality;
// no new schema field).
const REVERSE_DECK_LEN = 6;
// Built-in identifiers that should NOT be masked (they're not user-function
// names; masking them would lose the "Math.floor" / "JSON.stringify" signal).
const _REVERSE_BUILTINS = new Set([
  'console','log','JSON','Math','Array','String','Number','Object','Map','Set',
  'parseInt','parseFloat','isNaN','isFinite','stringify','parse','min','max',
  'floor','ceil','round','abs','sqrt','from','of','keys','values','entries',
  'length','push','pop','shift','unshift','slice','splice','sort','reverse',
  'join','split','indexOf','includes','filter','map','reduce','forEach','find',
  'every','some','flat','flatMap','undefined','null','true','false','new'
]);

function _reverseMaskName(text) {
  // Replace lowercase-camelCase identifiers with `f` (user-function names);
  // leave built-ins, capitalized identifiers (constructors/classes), and
  // string-literal contents alone. Splits on quote-delimited regions so the
  // masker doesn't mangle string args like "hello" → "f" (which would erase
  // the signal the user reasons about).
  const parts = text.split(/("[^"]*"|'[^']*')/);
  return parts.map((part, i) => {
    if (i % 2 === 1) return part; // odd index = quote-delimited literal
    return part.replace(/\b[a-z][a-zA-Z0-9]*\b/g, (id) =>
      _REVERSE_BUILTINS.has(id) ? id : 'f'
    );
  }).join('');
}

function _reverseExtractInvocation(canonical) {
  // Find the LAST console.log(...) line in the canonical and pull what's
  // inside the outermost parens. Returns null if no parseable invocation.
  const lines = canonical.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/console\.log\((.+)\);?\s*$/);
    if (m) return m[1].trim();
  }
  return null;
}

function _reverseBuildDeck() {
  const candidates = CURRICULUM.filter(l => l.track === 'patterns' && l.status === 'full');
  // Shuffle then take the first N parseable lessons.
  const shuffled = candidates.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const cards = [];
  // Build a pool of all loaded patterns lessons with parseable invocations,
  // so we can draw distractors from it without re-checking each.
  const pool = [];
  for (const l of shuffled) {
    const c = CONTENT[l.id];
    if (!c || !c.L3 || !c.L3.canonical || !c.L3.expectedOutput || !c.L3.prompt) continue;
    const inv = _reverseExtractInvocation(c.L3.canonical);
    if (!inv) continue;
    pool.push({
      lessonId: l.id,
      invocation: _reverseMaskName(inv),
      output: c.L3.expectedOutput,
      promptMasked: _reverseMaskName(c.L3.prompt)
    });
  }
  if (pool.length < 4) return null;
  // First REVERSE_DECK_LEN entries become correct cards; each picks 3 random
  // distractors from the rest of the pool.
  const targets = pool.slice(0, Math.min(REVERSE_DECK_LEN, pool.length));
  for (const t of targets) {
    const distractors = pool
      .filter(p => p.lessonId !== t.lessonId)
      .slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(p => p.promptMasked);
    const options = [t.promptMasked, ...distractors];
    // Shuffle the 4-option array.
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    cards.push({
      lessonId: t.lessonId,
      invocation: t.invocation,
      output: t.output,
      options,
      correct: t.promptMasked
    });
  }
  return cards.length >= 3 ? cards : null;
}

async function startReverseSession() {
  // Preload broad sample of patterns lessons so the pool has variety.
  const patternsLessons = CURRICULUM.filter(l => l.track === 'patterns' && l.status === 'full').slice(0, 30);
  for (const l of patternsLessons) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
      if (Object.keys(CONTENT).length >= 18) break;
    }
  }
  const deck = _reverseBuildDeck();
  if (!deck || deck.length < 3) {
    alert('Reverse needs more loaded patterns lessons. Click around a few patterns first, then try again.');
    return;
  }
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell reverse-shell">
        <div class="recognize-header">
          <span>🎯 Reverse · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-reverse">✕ Exit</button>
        </div>
        <div class="reverse-trace">
          <div class="reverse-trace-line"><span class="reverse-trace-label">in</span><code class="reverse-trace-code">${escapeHtml(card.invocation)}</code></div>
          <div class="reverse-trace-line"><span class="reverse-trace-label">out</span><code class="reverse-trace-code">${escapeHtml(card.output)}</code></div>
        </div>
        <div class="reverse-hint">Pick the problem this trace solves:</div>
        <div class="recognize-options">
          ${card.options.map(opt => `<button class="recognize-opt reverse-opt" data-opt="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join('')}
        </div>
        <div class="recognize-feedback" data-reverse-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-reverse"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.recognize-opt');
    let answered = false;
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const picked = btn.dataset.opt;
        const wasCorrect = picked === card.correct;
        if (wasCorrect) correct++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.recognize.attempts++;
        if (wasCorrect) state.recognize.correct++;
        saveProgress();
        opts.forEach(b => {
          b.disabled = true;
          if (b.dataset.opt === card.correct) b.classList.add('recognize-opt-correct');
          else if (b === btn) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-reverse-feedback]');
        if (fb) fb.innerHTML = wasCorrect ? `<span class="recognize-good">✓</span>` : `<span class="recognize-bad">✗ Correct shown above</span>`;
        setTimeout(() => { idx++; renderCard(); }, wasCorrect ? 700 : 1500);
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell reverse-shell">
        <div class="recognize-header"><span>🎯 Reverse · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} correct</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Diagnose lifetime (incl. 🔎 Recognize): ${state.recognize.correct} / ${state.recognize.attempts} (${state.recognize.attempts > 0 ? Math.round(state.recognize.correct / state.recognize.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="reverse-again">🎯 Another session</button>
            <button class="secondary" data-action="reverse-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="reverse-again"]').addEventListener('click', () => startReverseSession());
    shell.querySelector('[data-action="reverse-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 54: L1 Rapid-Fire Drill. Cross-lesson interleaved L1 tap-stream — the
// pure mobile-throughput surface PROFILE.md L31 names as the highest-density
// recall modality. Reuses existing L1.questions across all 143 lessons (no
// new authoring). 7-sec soft-timer; tap to grade + auto-advance; streak resets
// on miss or timer-exhaust; missed lessons flip state.weakness (existing weak-
// spot tracker) so the rapid stream feeds back into normal SR. Sourced from
// iter-31 roadmap entry #4 (unblocked). See ideas-by-category.md § Paths &
// Sessions → Rapid-Fire (was the entry's queued source).
const RAPID_FIRE_SESSION_LEN = 20;
const RAPID_FIRE_TIMER_MS = 7000;
function _rapidFireBuildDeck() {
  // Walk all loaded lessons with full status + at least one L1 question.
  // Mirrors Recognize's CONTENT-lookup pattern but spans every track, not just patterns.
  const pool = [];
  for (const lesson of CURRICULUM) {
    if (lesson.status !== 'full') continue;
    const content = CONTENT[lesson.id];
    if (!content || !content.L1 || !Array.isArray(content.L1.questions)) continue;
    for (let qi = 0; qi < content.L1.questions.length; qi++) {
      const q = content.L1.questions[qi];
      if (!q || !Array.isArray(q.options) || q.options.length < 2) continue;
      if (typeof q.answer !== 'number') continue;
      pool.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        sectionName: lesson.section,
        q: q.q,
        options: q.options,
        answerIdx: q.answer,
        explain: q.explain || ''
      });
    }
  }
  if (pool.length < 5) return null;
  // Fisher-Yates shuffle then slice.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, RAPID_FIRE_SESSION_LEN);
}

async function startRapidFireSession() {
  // Backfill: preload lesson content broadly across tracks so the deck has
  // variety. We aim for ~30 lessons spanning syntax + patterns + applied.
  const sample = [];
  for (const track of ['syntax', 'patterns', 'applied']) {
    const trackLessons = CURRICULUM.filter(l => l.track === track && l.status === 'full').slice(0, 12);
    sample.push(...trackLessons);
  }
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  const deck = _rapidFireBuildDeck();
  if (!deck || deck.length < 5) {
    alert('Rapid-Fire needs more loaded lessons. Click around a few lessons first, then try again.');
    return;
  }
  return _runRapidFireWithDeck(deck, { label: '⚡ Rapid', againFn: startRapidFireSession });
}

// iter 75: deck-driven Rapid-Fire shell — extracted so other §9B/§9C surfaces
// (Big-O drill, future Trap-recognition, etc.) can reuse the letter-chip +
// 7-sec timer + streak + slowest-3 mechanics without duplicating render code.
// opts: { label, againFn } — label sets header text; againFn is called when
// user clicks "Another session" on the summary.
function _runRapidFireWithDeck(deck, opts = {}) {
  const label = opts.label || '⚡ Rapid';
  const againFn = opts.againFn || startRapidFireSession;
  let idx = 0, correct = 0, streak = 0, bestStreak = 0;
  const times = [];
  const slowest = []; // { lessonId, lessonTitle, ms }
  const shell = document.getElementById('lesson-shell');
  let cardStartedAt = 0;
  let timerHandle = null;
  let timerStartedAt = 0;

  function clearTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  }

  function renderCard() {
    clearTimer();
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    cardStartedAt = Date.now();
    shell.innerHTML = `
      <div class="rapid-shell">
        <div class="rapid-header">
          <span>${label} · ${idx + 1} of ${deck.length} · 🔥 ${streak}</span>
          <button class="rapid-exit" data-action="exit-rapid">✕ Exit</button>
        </div>
        <div class="rapid-timer-track"><div class="rapid-timer-bar" data-rapid-timer></div></div>
        <div class="rapid-meta">${escapeHtml(card.sectionName)} · <span class="rapid-lesson">${escapeHtml(card.lessonTitle)}</span></div>
        <div class="rapid-question">${escapeHtml(card.q)}</div>
        <div class="rapid-options">
          ${card.options.map((opt, i) => `<button class="rapid-opt" data-opt-idx="${i}"><span class="rapid-letter">${String.fromCharCode(65 + i)}</span>${escapeHtml(opt)}</button>`).join('')}
        </div>
        <div class="rapid-feedback" data-rapid-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-rapid"]').addEventListener('click', () => {
      clearTimer();
      renderLesson();
    });
    const opts = shell.querySelectorAll('.rapid-opt');
    let answered = false;

    const grade = (pickedIdx) => {
      if (answered) return;
      answered = true;
      clearTimer();
      const elapsed = Date.now() - cardStartedAt;
      times.push(elapsed);
      const wasCorrect = pickedIdx === card.answerIdx;
      if (wasCorrect) {
        correct++;
        streak++;
        if (streak > bestStreak) bestStreak = streak;
        // iter 141: 📳 Haptic Tap-Pulse — Rapid-Fire deliberately skips
        // appendHistory('L1-pass') (would spam the sparkline across 20-card
        // streams), so the per-card correct pulse is wired here directly.
        // Streak-of-5 milestone fires the longer 3-pulse roll on top of the
        // per-card pulse for 5/10/15/20 — gives the user a tactile "you're
        // on a roll" without printing a count to the screen (L75 mitigation:
        // no streak NUMBER visible in this haptic path; bestStreak is an
        // existing post-session stat already visible in the Rapid summary).
        _hapticPulse('L1-pass');
        if (streak > 0 && streak % 5 === 0) _hapticPulse('streak-5');
      } else {
        streak = 0;
        // Feed weak-spot tracker (existing field; same semantics as in-lesson L1 miss).
        state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
        appendHistory(card.lessonId, 'L1-miss');
      }
      state.rapidFire.attempts++;
      if (wasCorrect) state.rapidFire.correct++;
      // Slowest-lesson tracking (weak-spot variant).
      slowest.push({ lessonId: card.lessonId, lessonTitle: card.lessonTitle, ms: elapsed });
      saveProgress();
      opts.forEach((b, i) => {
        b.disabled = true;
        if (i === card.answerIdx) b.classList.add('rapid-opt-correct');
        else if (i === pickedIdx) b.classList.add('rapid-opt-wrong');
      });
      const fb = shell.querySelector('[data-rapid-feedback]');
      fb.innerHTML = wasCorrect
        ? `<span class="rapid-good">✓ +1 streak</span>`
        : `<span class="rapid-bad">✗ ${card.explain ? escapeHtml(card.explain) : 'Streak reset'}</span>`;
      setTimeout(() => { idx++; renderCard(); }, wasCorrect ? 600 : 1300);
    };

    opts.forEach(btn => {
      btn.addEventListener('click', () => grade(+btn.dataset.optIdx));
    });

    // 7-sec soft timer. On exhaust: treat as miss, reset streak, reveal answer, auto-advance.
    timerStartedAt = Date.now();
    const bar = shell.querySelector('[data-rapid-timer]');
    timerHandle = setInterval(() => {
      const remaining = RAPID_FIRE_TIMER_MS - (Date.now() - timerStartedAt);
      if (remaining <= 0) {
        clearTimer();
        if (!answered) grade(-1); // -1 = no pick; never equals card.answerIdx → miss
      } else if (bar) {
        bar.style.width = `${(remaining / RAPID_FIRE_TIMER_MS) * 100}%`;
        bar.classList.toggle('rapid-timer-hot', remaining < 2000);
      }
    }, 80);
  }

  function renderSummary() {
    clearTimer();
    const totalMs = times.reduce((a, b) => a + b, 0);
    const median = times.slice().sort((a, b) => a - b)[Math.floor(times.length / 2)] || 0;
    const pct = Math.round((correct / deck.length) * 100);
    // Slowest 3 lessons (weak-spot diagnostic per iter-31 roadmap).
    const slowestTop = slowest.slice().sort((a, b) => b.ms - a.ms).slice(0, 3);
    if (bestStreak > state.rapidFire.bestStreak) state.rapidFire.bestStreak = bestStreak;
    state.rapidFire.lastRunAt = Date.now();
    saveProgress();
    shell.innerHTML = `
      <div class="rapid-shell">
        <div class="rapid-header"><span>${label} · Session done</span></div>
        <div class="rapid-summary">
          <div class="rapid-summary-pct">${pct}%</div>
          <div class="rapid-summary-line">${correct} of ${deck.length} correct · 🔥 best streak ${bestStreak}</div>
          <div class="rapid-summary-line">Median ${(median / 1000).toFixed(1)}s · Throughput ${totalMs > 0 ? ((deck.length / (totalMs / 60000)) | 0) : 0}/min</div>
          ${slowestTop.length ? `<div class="rapid-summary-slowest"><div class="rapid-summary-slowest-title">Slowest lessons (drill these next):</div>${slowestTop.map(s => `<div class="rapid-summary-slowest-row"><span>${escapeHtml(s.lessonTitle)}</span><span class="rapid-summary-slowest-ms">${(s.ms / 1000).toFixed(1)}s</span></div>`).join('')}</div>` : ''}
          <div class="rapid-summary-line rapid-summary-lifetime">Lifetime: ${state.rapidFire.correct} / ${state.rapidFire.attempts} (${state.rapidFire.attempts > 0 ? Math.round(state.rapidFire.correct / state.rapidFire.attempts * 100) : 0}%) · best 🔥 ${state.rapidFire.bestStreak}</div>
          <div class="rapid-summary-actions">
            <button class="primary" data-action="rapid-again">${label} · Another session</button>
            <button class="secondary" data-action="rapid-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="rapid-again"]').addEventListener('click', () => againFn());
    shell.querySelector('[data-action="rapid-done"]').addEventListener('click', () => renderLesson());
  }

  renderCard();
}

// iter 57: 🌅 3-Card Warmup — ultra-short mobile micro-session over the
// existing Today's Plan curated 3-way mix (due + path + weak). Stack of 3
// L1 question cards in the main viewport with slide-off-on-grade animation;
// auto-advances; summary CTAs to keep going. PROFILE L69 "friction between
// '20 free minutes' and 'I'm drilling' is near zero" — Today's Plan picks
// the WHAT but still requires open-modal-then-nav-into-lesson; Warmup
// serves the L1 interaction shell directly in 3-tap shape. Closes iter-55
// roadmap #3 (constraint-aware reframe of A#4 with PWA-install scope
// deferred). Schema-additive state.warmup, no `__v` bump.
const WARMUP_DECK_LEN = 3;
async function _warmupBuildDeck() {
  const plan = dailyPlan().slice(0, WARMUP_DECK_LEN);
  if (!plan.length) return null;
  // Preload content for any plan-lessons that aren't in CONTENT yet.
  for (const { id } of plan) {
    if (!CONTENT[id]) {
      try { await loadLessonContent(id); } catch (_) { /* skip */ }
    }
  }
  const deck = [];
  for (const { id, why } of plan) {
    const content = CONTENT[id];
    if (!content || !content.L1 || !Array.isArray(content.L1.questions) || !content.L1.questions.length) continue;
    const lesson = findLesson(id);
    if (!lesson) continue;
    // Pick the FIRST L1 question per lesson (deterministic — same warmup is
    // the same card stack for the rest of the day; mock-interview-style
    // surprise lives in Rapid-Fire).
    const q = content.L1.questions[0];
    if (!q || !Array.isArray(q.options) || typeof q.answer !== 'number') continue;
    deck.push({
      lessonId: id,
      lessonTitle: lesson.title,
      sectionName: lesson.section,
      why,  // 'review due' | 'weak spot' | 'next on path'
      q: q.q,
      options: q.options,
      answerIdx: q.answer,
      explain: q.explain || ''
    });
  }
  return deck.length ? deck : null;
}

async function startWarmupSession() {
  const deck = await _warmupBuildDeck();
  if (!deck || !deck.length) {
    alert('No warmup queued — you are caught up! Tap Today\\u2019s Plan or Rapid-Fire to keep going.');
    return;
  }
  state.warmup.sessions++;
  state.warmup.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  const colors = { 'review due': '#67e8f9', 'weak spot': '#fdba74', 'next on path': '#93c5fd' };

  function renderStack() {
    if (idx >= deck.length) {
      state.warmup.completions++;
      saveProgress();
      return renderSummary();
    }
    // Render the current card + visual ghost cards beneath (offset + scaled).
    const remaining = deck.length - idx;
    const ghostCount = Math.min(remaining - 1, 2);
    const ghosts = Array.from({ length: ghostCount }, (_, i) => {
      const depth = i + 1;
      return `<div class="warmup-ghost" style="transform: translateY(${depth * 6}px) scale(${1 - depth * 0.03}); opacity: ${1 - depth * 0.35}; z-index: ${10 - depth};"></div>`;
    }).join('');

    const card = deck[idx];
    shell.innerHTML = `
      <div class="warmup-shell">
        <div class="warmup-header">
          <span>🌅 Warmup · Card ${idx + 1} of ${deck.length}</span>
          <button class="warmup-exit" data-action="exit-warmup">✕ Exit</button>
        </div>
        <div class="warmup-stack">
          ${ghosts}
          <div class="warmup-card" data-warmup-card style="z-index: 11;">
            <div class="warmup-card-tag" style="color: ${colors[card.why] || '#94a3b8'};">${escapeHtml(card.why)}</div>
            <div class="warmup-card-meta">${escapeHtml(card.sectionName)} · <span class="warmup-card-lesson">${escapeHtml(card.lessonTitle)}</span></div>
            <div class="warmup-card-question">${escapeHtml(card.q)}</div>
            <div class="warmup-card-options">
              ${card.options.map((opt, i) => `<button class="warmup-opt" data-opt-idx="${i}"><span class="warmup-letter">${String.fromCharCode(65 + i)}</span>${escapeHtml(opt)}</button>`).join('')}
            </div>
            <div class="warmup-card-feedback" data-warmup-feedback></div>
          </div>
        </div>
      </div>
    `;

    shell.querySelector('[data-action="exit-warmup"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.warmup-opt');
    const cardEl = shell.querySelector('[data-warmup-card]');
    let answered = false;

    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const picked = +btn.dataset.optIdx;
        const wasCorrect = picked === card.answerIdx;
        if (wasCorrect) {
          correct++;
        } else {
          // Misses route to the existing weak-spot tracker — same path as
          // missing an in-lesson L1.
          state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
          appendHistory(card.lessonId, 'L1-miss');
        }
        saveProgress();
        opts.forEach((b, i) => {
          b.disabled = true;
          if (i === card.answerIdx) b.classList.add('warmup-opt-correct');
          else if (i === picked) b.classList.add('warmup-opt-wrong');
        });
        const fb = shell.querySelector('[data-warmup-feedback]');
        fb.innerHTML = wasCorrect
          ? `<span class="warmup-good">✓ Got it</span>`
          : `<span class="warmup-bad">✗ ${card.explain ? escapeHtml(card.explain) : 'Routed to weak spots'}</span>`;
        // Slide-off animation, then advance.
        cardEl.classList.add(wasCorrect ? 'warmup-card-slide-right' : 'warmup-card-slide-left');
        setTimeout(() => { idx++; renderStack(); }, wasCorrect ? 600 : 1100);
      });
    });
  }

  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="warmup-shell">
        <div class="warmup-header"><span>🌅 Warmup · Session done</span></div>
        <div class="warmup-summary">
          <div class="warmup-summary-pct">${pct}%</div>
          <div class="warmup-summary-line">${correct} of ${deck.length} correct</div>
          <div class="warmup-summary-line warmup-summary-lifetime">Lifetime: ${state.warmup.completions} session${state.warmup.completions === 1 ? '' : 's'} completed</div>
          <div class="warmup-summary-cta">→ Keep going:</div>
          <div class="warmup-summary-actions">
            <button class="primary" data-action="warmup-rapid">⚡ Rapid-Fire</button>
            <button class="secondary" data-action="warmup-today">📅 Today's Plan</button>
            <button class="secondary" data-action="warmup-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="warmup-rapid"]').addEventListener('click', () => startRapidFireSession());
    shell.querySelector('[data-action="warmup-today"]').addEventListener('click', () => {
      renderLesson();
      document.getElementById('today-btn')?.click();
    });
    shell.querySelector('[data-action="warmup-done"]').addEventListener('click', () => renderLesson());
  }

  renderStack();
}

// iter 71: 🏁 Section Speedrun — first MOBILE timed-pressure surface.
// Mock Interview is desktop-only (per PROFILE §usage-context); recruiters
// probe at the SECTION grain ("walk me through hashing") not single-lesson
// grain, but no surface stopwatches a whole topic. Speedrun picks a section,
// streams the first L1 of every full lesson in manifest order, runs a
// stopwatch, and saves per-section best to state.speedrun.bests[<slug>].
// Closes iter-64 roadmap entry #2.
const SPEEDRUN_MIN_LESSONS = 3; // sections with <3 full lessons are trivial

function _speedrunSectionsGrouped() {
  // CURRICULUM is appended in section-order by loadManifest, so grouping by
  // section name preserves manifest order. SECTION_SLUGS maps name→slug.
  const order = [];
  const groups = new Map();
  for (const l of CURRICULUM) {
    if (!groups.has(l.section)) { groups.set(l.section, []); order.push(l.section); }
    groups.get(l.section).push(l);
  }
  return order.map(name => ({ name, slug: SECTION_SLUGS[name] || '', lessons: groups.get(name) }));
}

function _speedrunPickableSections() {
  // Filter to sections with ≥SPEEDRUN_MIN_LESSONS full lessons (classes,
  // tries, system-design get gated out — speedrun would be ≤2 cards).
  const rows = [];
  for (const sec of _speedrunSectionsGrouped()) {
    const fullLessons = sec.lessons.filter(l => l.status === 'full');
    if (fullLessons.length < SPEEDRUN_MIN_LESSONS) continue;
    rows.push({
      slug: sec.slug,
      name: sec.name,
      track: fullLessons[0]?.track || '',
      fullCount: fullLessons.length,
      bestMs: state.speedrun?.bests?.[sec.slug] || 0
    });
  }
  return rows;
}

async function _speedrunBuildDeck(sectionSlug) {
  const sec = _speedrunSectionsGrouped().find(s => s.slug === sectionSlug);
  if (!sec) return null;
  const fullLessons = sec.lessons.filter(l => l.status === 'full');
  // Preload content for every lesson in the section (sections cap at ~20).
  for (const l of fullLessons) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  const deck = [];
  for (const l of fullLessons) {
    const content = CONTENT[l.id];
    if (!content || !content.L1 || !Array.isArray(content.L1.questions) || !content.L1.questions.length) continue;
    const q = content.L1.questions[0];
    if (!q || !Array.isArray(q.options) || typeof q.answer !== 'number') continue;
    deck.push({
      lessonId: l.id,
      lessonTitle: l.title,
      sectionName: sec.name,
      q: q.q,
      options: q.options,
      answerIdx: q.answer,
      explain: q.explain || ''
    });
  }
  return deck.length >= SPEEDRUN_MIN_LESSONS ? deck : null;
}

function _formatSpeedrunMs(ms) {
  if (!ms || ms <= 0) return '—';
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = (totalSec - min * 60);
  return min > 0
    ? `${min}:${sec.toFixed(1).padStart(4, '0')}`
    : `${sec.toFixed(1)}s`;
}

function startSpeedrunPicker() {
  const sections = _speedrunPickableSections();
  if (!sections.length) {
    alert('No speedrun-eligible sections yet (need ≥3 full lessons each).');
    return;
  }
  const shell = document.getElementById('lesson-shell');
  shell.innerHTML = `
    <div class="speedrun-shell speedrun-picker">
      <div class="speedrun-header">
        <span>🏁 Section Speedrun · pick a topic</span>
        <button class="speedrun-exit" data-action="exit-speedrun">✕ Exit</button>
      </div>
      <div class="speedrun-picker-hint">Run all L1 questions in one section against the clock. Best time per section is saved.</div>
      <div class="speedrun-picker-list">
        ${sections.map(s => `
          <button class="speedrun-pick-row" data-slug="${escapeHtml(s.slug)}">
            <span class="speedrun-pick-name">${escapeHtml(s.name)}</span>
            <span class="speedrun-pick-count">${s.fullCount} lessons</span>
            <span class="speedrun-pick-best" data-best>${s.bestMs ? `★ ${_formatSpeedrunMs(s.bestMs)}` : ''}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  shell.querySelector('[data-action="exit-speedrun"]').addEventListener('click', () => renderLesson());
  shell.querySelectorAll('.speedrun-pick-row').forEach(btn => {
    btn.addEventListener('click', () => startSpeedrunSession(btn.dataset.slug));
  });
}

async function startSpeedrunSession(sectionSlug) {
  const deck = await _speedrunBuildDeck(sectionSlug);
  if (!deck || !deck.length) {
    alert('Speedrun deck is empty for this section.');
    return;
  }
  state.speedrun.sessions++;
  state.speedrun.lastRunAt = Date.now();
  saveProgress();

  let idx = 0, correct = 0, misses = 0;
  const startedAt = Date.now();
  const shell = document.getElementById('lesson-shell');
  let stopwatchHandle = null;

  function clearStopwatch() {
    if (stopwatchHandle) { clearInterval(stopwatchHandle); stopwatchHandle = null; }
  }

  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="speedrun-shell">
        <div class="speedrun-header">
          <span>🏁 ${escapeHtml(card.sectionName)} · ${idx + 1} of ${deck.length}</span>
          <button class="speedrun-exit" data-action="exit-speedrun">✕ Exit</button>
        </div>
        <div class="speedrun-stopwatch" data-speedrun-clock>0.0s</div>
        <div class="speedrun-meta"><span class="speedrun-lesson">${escapeHtml(card.lessonTitle)}</span></div>
        <div class="speedrun-question">${escapeHtml(card.q)}</div>
        <div class="speedrun-options">
          ${card.options.map((opt, i) => `<button class="speedrun-opt" data-opt-idx="${i}"><span class="speedrun-letter">${String.fromCharCode(65 + i)}</span>${escapeHtml(opt)}</button>`).join('')}
        </div>
        <div class="speedrun-feedback" data-speedrun-feedback></div>
      </div>
    `;
    const clockEl = shell.querySelector('[data-speedrun-clock]');
    stopwatchHandle = setInterval(() => {
      if (clockEl) clockEl.textContent = _formatSpeedrunMs(Date.now() - startedAt);
    }, 100);
    shell.querySelector('[data-action="exit-speedrun"]').addEventListener('click', () => {
      clearStopwatch();
      renderLesson();
    });
    const opts = shell.querySelectorAll('.speedrun-opt');
    let answered = false;
    const grade = (pickedIdx) => {
      if (answered) return;
      answered = true;
      const wasCorrect = pickedIdx === card.answerIdx;
      if (wasCorrect) correct++; else { misses++; state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); saveProgress(); }
      opts.forEach((b, i) => {
        b.disabled = true;
        if (i === card.answerIdx) b.classList.add('speedrun-opt-correct');
        else if (i === pickedIdx) b.classList.add('speedrun-opt-wrong');
      });
      const fb = shell.querySelector('[data-speedrun-feedback]');
      if (fb) fb.innerHTML = wasCorrect ? `<span class="speedrun-good">✓</span>` : `<span class="speedrun-bad">✗ ${card.explain ? escapeHtml(card.explain) : ''}</span>`;
      setTimeout(() => { idx++; clearStopwatch(); renderCard(); }, wasCorrect ? 350 : 1100);
    };
    opts.forEach(btn => btn.addEventListener('click', () => grade(+btn.dataset.optIdx)));
  }

  function renderSummary() {
    clearStopwatch();
    const totalMs = Date.now() - startedAt;
    const prevBest = state.speedrun.bests[sectionSlug] || 0;
    const isNewBest = !prevBest || totalMs < prevBest;
    // Save best time regardless of misses — Speedrun is speed-first; misses
    // already feed state.weakness. Avoids the "I got 1 wrong, no best for me"
    // anti-pattern that would discourage retries.
    if (isNewBest) state.speedrun.bests[sectionSlug] = totalMs;
    state.speedrun.completions++;
    saveProgress();
    const deltaMs = prevBest ? prevBest - totalMs : 0;
    shell.innerHTML = `
      <div class="speedrun-shell">
        <div class="speedrun-header"><span>🏁 Speedrun · done</span></div>
        <div class="speedrun-summary">
          <div class="speedrun-summary-time">${_formatSpeedrunMs(totalMs)}</div>
          ${isNewBest && prevBest ? `<div class="speedrun-summary-pb">★ New personal best (−${_formatSpeedrunMs(deltaMs)})</div>` : ''}
          ${isNewBest && !prevBest ? `<div class="speedrun-summary-pb">★ First completion — that's your best</div>` : ''}
          ${!isNewBest ? `<div class="speedrun-summary-pb speedrun-summary-pb-off">Best: ${_formatSpeedrunMs(prevBest)} (+${_formatSpeedrunMs(totalMs - prevBest)} this run)</div>` : ''}
          <div class="speedrun-summary-line">${correct} of ${deck.length} correct${misses ? ` · ${misses} miss${misses === 1 ? '' : 'es'} flagged as weak spot` : ''}</div>
          <div class="speedrun-summary-actions">
            <button class="primary" data-action="speedrun-again">🏁 Re-run</button>
            <button class="secondary" data-action="speedrun-pick">Pick another</button>
            <button class="secondary" data-action="speedrun-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="speedrun-again"]').addEventListener('click', () => startSpeedrunSession(sectionSlug));
    shell.querySelector('[data-action="speedrun-pick"]').addEventListener('click', () => startSpeedrunPicker());
    shell.querySelector('[data-action="speedrun-done"]').addEventListener('click', () => renderLesson());
  }

  renderCard();
}

// iter 125: 🥊 Pattern-Family Gauntlet — chained L1 stream across EVERY full
// lesson in a single section, surfacing EVERY L1 question per lesson (not
// just the first). Cousin to Speedrun (iter 71): Speedrun is 1 L1/lesson on
// a stopwatch (speed-first); Gauntlet is all-L1 untimed (interleaving-by-
// family). Roadmap iter-124 #1 — first Cat 2 Active list refill since iter
// 45 path-aware SR queue (78+ iters stale). Misses → state.weakness like
// every other L1 surface; correct→appendHistory('L1-pass'), miss→'L1-miss'.
// No timer, no PB. Differentiator vs Today's Plan: family-deep, not
// cross-family-wide. Differentiator vs Speedrun: question coverage depth.
const GAUNTLET_MIN_LESSONS = 3; // sections with <3 full lessons skipped

function _gauntletPickableSections() {
  // Reuse Speedrun's section-grouping helper so manifest order is preserved.
  const rows = [];
  for (const sec of _speedrunSectionsGrouped()) {
    const fullLessons = sec.lessons.filter(l => l.status === 'full');
    if (fullLessons.length < GAUNTLET_MIN_LESSONS) continue;
    const stat = state.gauntlet?.bySection?.[sec.slug] || null;
    rows.push({
      slug: sec.slug,
      name: sec.name,
      track: fullLessons[0]?.track || '',
      fullCount: fullLessons.length,
      lastCorrect: stat ? +stat.lastCorrect || 0 : 0,
      lastTotal: stat ? +stat.lastTotal || 0 : 0
    });
  }
  return rows;
}

async function _gauntletBuildDeck(sectionSlug) {
  const sec = _speedrunSectionsGrouped().find(s => s.slug === sectionSlug);
  if (!sec) return null;
  const fullLessons = sec.lessons.filter(l => l.status === 'full');
  for (const l of fullLessons) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  const deck = [];
  for (const l of fullLessons) {
    const content = CONTENT[l.id];
    if (!content || !content.L1 || !Array.isArray(content.L1.questions)) continue;
    for (let qi = 0; qi < content.L1.questions.length; qi++) {
      const q = content.L1.questions[qi];
      if (!q || !Array.isArray(q.options) || typeof q.answer !== 'number') continue;
      deck.push({
        lessonId: l.id,
        lessonTitle: l.title,
        sectionName: sec.name,
        qIdx: qi,
        qTotal: content.L1.questions.length,
        q: q.q,
        options: q.options,
        answerIdx: q.answer,
        explain: q.explain || ''
      });
    }
  }
  return deck.length >= GAUNTLET_MIN_LESSONS ? deck : null;
}

function startGauntletPicker() {
  const sections = _gauntletPickableSections();
  if (!sections.length) {
    alert('No gauntlet-eligible sections yet (need ≥3 full lessons each).');
    return;
  }
  const shell = document.getElementById('lesson-shell');
  shell.innerHTML = `
    <div class="gauntlet-shell gauntlet-picker">
      <div class="gauntlet-header">
        <span>🥊 Pattern-Family Gauntlet · pick a section</span>
        <button class="gauntlet-exit" data-action="exit-gauntlet">✕ Exit</button>
      </div>
      <div class="gauntlet-picker-hint">Run EVERY L1 question across EVERY lesson in one section, back-to-back. No timer — interleave the family's patterns. (Today's Plan = broad sample · Speedrun = first-L1 sprint · Gauntlet = deep on one family.)</div>
      <div class="gauntlet-picker-list" data-gauntlet-picker>
        ${sections.map(s => `
          <button class="gauntlet-pick-row" data-slug="${escapeHtml(s.slug)}">
            <span class="gauntlet-pick-name">${escapeHtml(s.name)}</span>
            <span class="gauntlet-pick-count">${s.fullCount} lessons</span>
            <span class="gauntlet-pick-last" data-last>${s.lastTotal ? `last: ${s.lastCorrect}/${s.lastTotal}` : ''}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  shell.querySelector('[data-action="exit-gauntlet"]').addEventListener('click', () => renderLesson());
  shell.querySelectorAll('.gauntlet-pick-row').forEach(btn => {
    btn.addEventListener('click', () => startGauntletSession(btn.dataset.slug));
  });
}

async function startGauntletSession(sectionSlug) {
  const deck = await _gauntletBuildDeck(sectionSlug);
  if (!deck || !deck.length) {
    alert('Gauntlet deck is empty for this section.');
    return;
  }
  state.gauntlet.sessions++;
  state.gauntlet.lastRunAt = Date.now();
  saveProgress();

  const sectionName = deck[0].sectionName;
  let idx = 0, correct = 0, misses = 0;
  const shell = document.getElementById('lesson-shell');

  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="gauntlet-shell">
        <div class="gauntlet-header">
          <span>🥊 ${escapeHtml(sectionName)} · ${idx + 1} of ${deck.length}</span>
          <button class="gauntlet-exit" data-action="exit-gauntlet">✕ Exit</button>
        </div>
        <div class="gauntlet-progress-strip" data-gauntlet-progress>
          ${deck.map((_, i) => `<span class="gauntlet-pip${i < idx ? ' gauntlet-pip-done' : ''}${i === idx ? ' gauntlet-pip-active' : ''}"></span>`).join('')}
        </div>
        <div class="gauntlet-meta"><span class="gauntlet-lesson">${escapeHtml(card.lessonTitle)}</span> · L1 Q${card.qIdx + 1}/${card.qTotal}</div>
        <div class="gauntlet-question">${escapeHtml(card.q)}</div>
        <div class="gauntlet-options">
          ${card.options.map((opt, i) => `<button class="gauntlet-opt" data-opt-idx="${i}"><span class="gauntlet-letter">${String.fromCharCode(65 + i)}</span>${escapeHtml(opt)}</button>`).join('')}
        </div>
        <div class="gauntlet-feedback" data-gauntlet-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-gauntlet"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.gauntlet-opt');
    let answered = false;
    const grade = (pickedIdx) => {
      if (answered) return;
      answered = true;
      const wasCorrect = pickedIdx === card.answerIdx;
      if (wasCorrect) {
        correct++;
        appendHistory(card.lessonId, 'L1-pass');
      } else {
        misses++;
        state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
        appendHistory(card.lessonId, 'L1-miss');
      }
      saveProgress();
      opts.forEach((b, i) => {
        b.disabled = true;
        if (i === card.answerIdx) b.classList.add('gauntlet-opt-correct');
        else if (i === pickedIdx) b.classList.add('gauntlet-opt-wrong');
      });
      const fb = shell.querySelector('[data-gauntlet-feedback]');
      if (fb) fb.innerHTML = wasCorrect ? `<span class="gauntlet-good">✓</span>` : `<span class="gauntlet-bad">✗ ${card.explain ? escapeHtml(card.explain) : ''}</span>`;
      setTimeout(() => { idx++; renderCard(); }, wasCorrect ? 380 : 1200);
    };
    opts.forEach(btn => btn.addEventListener('click', () => grade(+btn.dataset.optIdx)));
  }

  function renderSummary() {
    state.gauntlet.completions++;
    if (!state.gauntlet.bySection) state.gauntlet.bySection = {};
    const prev = state.gauntlet.bySection[sectionSlug] || { sessions: 0 };
    state.gauntlet.bySection[sectionSlug] = {
      sessions: (prev.sessions || 0) + 1,
      lastCorrect: correct,
      lastTotal: deck.length,
      lastRunAt: Date.now()
    };
    saveProgress();
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="gauntlet-shell">
        <div class="gauntlet-header"><span>🥊 Gauntlet · done</span></div>
        <div class="gauntlet-summary">
          <div class="gauntlet-summary-score">${correct} / ${deck.length}</div>
          <div class="gauntlet-summary-pct">${pct}% across ${escapeHtml(sectionName)}</div>
          ${misses ? `<div class="gauntlet-summary-line">${misses} miss${misses === 1 ? '' : 'es'} flagged as weak spot</div>` : `<div class="gauntlet-summary-line">Clean run.</div>`}
          <div class="gauntlet-summary-actions">
            <button class="primary" data-action="gauntlet-again">🥊 Re-run</button>
            <button class="secondary" data-action="gauntlet-pick">Pick another</button>
            <button class="secondary" data-action="gauntlet-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="gauntlet-again"]').addEventListener('click', () => startGauntletSession(sectionSlug));
    shell.querySelector('[data-action="gauntlet-pick"]').addEventListener('click', () => startGauntletPicker());
    shell.querySelector('[data-action="gauntlet-done"]').addEventListener('click', () => renderLesson());
  }

  renderCard();
}

// iter 62: 📅 Streak Map — 60-day calendar density heatmap. Aggregates
// state.history events across ALL lessons by day, returning a 60-element
// array (oldest first → newest last) so the renderer can paint a fixed
// grid. Closes iter-59 roadmap entry #3. Carefully avoids PROFILE.md L75
// gamification anti-pattern by NOT exposing streak counts or shame
// chips — just the calendar shape so the user sees the rhythm without
// the "broke my streak, can't recover" trap.
function _streakMapBuckets(lookbackDays = 60) {
  const now = Date.now();
  // Start of today (midnight) so each cell aligns to a calendar day.
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 86400000;
  // Build an empty bucket array [oldest, ..., today]
  const buckets = Array.from({ length: lookbackDays }, (_, i) => {
    const dayStart = startOfToday.getTime() - (lookbackDays - 1 - i) * dayMs;
    const d = new Date(dayStart);
    return {
      dateMs: dayStart,
      dateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      isoDate: d.toISOString().slice(0, 10),
      total: 0,
      passes: 0,
      misses: 0
    };
  });
  const startMs = buckets[0].dateMs;
  // Walk every lesson's history; bucket events into days.
  for (const lessonId of Object.keys(state.history || {})) {
    const events = state.history[lessonId];
    if (!Array.isArray(events)) continue;
    for (const e of events) {
      if (!e || typeof e.at !== 'number' || !e.event) continue;
      if (e.at < startMs) continue;
      const dayIdx = Math.floor((e.at - startMs) / dayMs);
      if (dayIdx < 0 || dayIdx >= lookbackDays) continue;
      const bucket = buckets[dayIdx];
      bucket.total++;
      if (e.event === 'L1-miss') bucket.misses++;
      else if (e.event === 'L1-pass' || e.event === 'L2-pass' || e.event === 'L3-pass') bucket.passes++;
      // Other events (e.g. hint-tier-N, critical-lines-used) are counted in
      // `total` but not classified — they're activity, not pass/miss signal.
    }
  }
  return buckets;
}
// iter 73: 🪲 Code Bug-Hunt — first §9B (Code Evaluation Skills) surface,
// closing the 37-iter gap flagged by iter-36's catalog cross-cutting note.
// Auto-mutator picks a random patterns-track canonical, applies ONE simple
// operator/boundary mutation at ONE random site, verifies via runCode() that
// the mutation actually breaks the lesson's expectedOutput, and surfaces the
// buggy code with line numbers. User taps the line they think is wrong —
// trains code-review / debug-localization, the reflex interviewers explicitly
// grade. Pure data recombination — no per-lesson authoring needed.
const BUG_HUNT_DECK_LEN = 5;
const BUG_HUNT_MUTATORS = [
  // Order matters only for tie-breaking; mutator selection is randomized.
  // Lookaheads keep `<<`, `>>`, `<=`, `>=`, `==` from being mis-matched.
  { name: '< → <=',   from: /<(?!=|<)/g,  to: '<=' },
  { name: '<= → <',   from: /<=/g,         to: '<'  },
  { name: '> → >=',   from: />(?!=|>)/g,   to: '>=' },
  { name: '>= → >',   from: />=/g,         to: '>'  },
  { name: '++ → --',  from: /\+\+/g,       to: '--' },
  { name: '-- → ++',  from: /--/g,         to: '++' },
  { name: '=== → !==', from: /===/g,       to: '!==' },
  { name: '!== → ===', from: /!==/g,       to: '===' },
  { name: '&& → ||',  from: /&&/g,         to: '||' },
  { name: '|| → &&',  from: /\|\|/g,       to: '&&' }
];

function _bugHuntCollectMatches(code, regex) {
  const re = new RegExp(regex.source, regex.flags);
  const out = [];
  let m;
  while ((m = re.exec(code)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, matched: m[0] });
    if (m.index === re.lastIndex) re.lastIndex++; // safety against zero-width
  }
  return out;
}

function _bugHuntLineOf(code, offset) {
  // 1-indexed line number of `offset` within `code`.
  let line = 1;
  for (let i = 0; i < offset && i < code.length; i++) {
    if (code.charCodeAt(i) === 10) line++;
  }
  return line;
}

function _bugHuntShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function _bugHuntFindBreakingMutation(canonical, expected) {
  // Try mutators in random order; for each, try matches in random order until
  // one yields a runCode output that doesn't match expected. Returns null if
  // no breaking mutation found (caller skips the lesson).
  // iter 143: switched from BUG_HUNT_MUTATORS (10) to SAFE_MUTATORS (7) —
  // the 3 excluded mutators (`++ → --`, `-- → ++`, `&& → ||`) could produce
  // sync infinite loops at loop counters / restrictive guards. iter-142
  // CDP probe started hanging intermittently; user-facing risk is a frozen
  // tab on Bug-Hunt session start. Variety loss is 30%, but the remaining
  // 7 still cover boundary comparisons (most common bug shape) + equality
  // flips + `|| → &&`. See SAFE_MUTATORS comment above.
  const expectedLines = normalizeLines(expected);
  for (const mut of _bugHuntShuffle(SAFE_MUTATORS)) {
    const matches = _bugHuntCollectMatches(canonical, mut.from);
    if (!matches.length) continue;
    for (const pick of _bugHuntShuffle(matches).slice(0, 4)) {
      const mutated = canonical.slice(0, pick.start) + mut.to + canonical.slice(pick.end);
      let res;
      try {
        res = await runCode(mutated);
      } catch (_) { continue; }
      // Treat any of these as "breaks": runtime error, output differs, or
      // (subsequence semantics) any expected line missing from actual.
      const actualLines = normalizeLines(res.output || '');
      let broken = false;
      if (!res.ok) {
        broken = true;
      } else if (actualLines.join('\n') !== expectedLines.join('\n')) {
        // Strict line-equality is the safer signal for the user-facing card —
        // subsequence semantics would mark "extra debug output is fine" as
        // not-broken, but for bug hunt we want any visible diff to count.
        broken = true;
      }
      if (broken) {
        return {
          mutator: mut.name,
          line: _bugHuntLineOf(canonical, pick.start),
          mutatedCode: mutated,
          originalCode: canonical
        };
      }
    }
  }
  return null;
}

async function _bugHuntBuildDeck() {
  // Sample patterns-track full lessons (avoid syntax — boundary mutations are
  // less interview-realistic on simple syntax demos). Cap candidate pool so
  // we don't burn time hunting mutations for trivial canonicals.
  const candidates = CURRICULUM.filter(l => l.track === 'patterns' && l.status === 'full');
  const shuffled = _bugHuntShuffle(candidates).slice(0, 16);
  for (const l of shuffled) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  const deck = [];
  for (const l of shuffled) {
    if (deck.length >= BUG_HUNT_DECK_LEN) break;
    const c = CONTENT[l.id];
    if (!c || !c.L3 || !c.L3.canonical || !c.L3.expectedOutput) continue;
    const breaking = await _bugHuntFindBreakingMutation(c.L3.canonical, c.L3.expectedOutput);
    if (!breaking) continue;
    deck.push({
      lessonId: l.id,
      lessonTitle: l.title,
      sectionName: l.section,
      buggyCode: breaking.mutatedCode,
      buggyLine: breaking.line,
      mutator: breaking.mutator,
      originalCode: breaking.originalCode
    });
  }
  return deck;
}

async function startBugHuntSession() {
  state.bugHunt.sessions++;
  state.bugHunt.lastRunAt = Date.now();
  saveProgress();
  const shell = document.getElementById('lesson-shell');
  shell.innerHTML = `<div class="bug-shell"><div class="bug-loading">🪲 Hunting bugs…</div></div>`;
  const deck = await _bugHuntBuildDeck();
  if (!deck.length) {
    shell.innerHTML = `<div class="bug-shell"><div class="bug-loading">No breakable canonicals found in this round — try again.</div><div class="bug-summary-actions"><button class="secondary" data-action="bug-back">Back</button></div></div>`;
    shell.querySelector('[data-action="bug-back"]').addEventListener('click', () => renderLesson());
    return;
  }
  let idx = 0, correct = 0;

  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    const lines = card.buggyCode.split('\n');
    shell.innerHTML = `
      <div class="bug-shell">
        <div class="bug-header">
          <span>🪲 Bug-Hunt · ${idx + 1} of ${deck.length}</span>
          <button class="bug-exit" data-action="exit-bug">✕ Exit</button>
        </div>
        <div class="bug-meta">${escapeHtml(card.sectionName)} · <span class="bug-lesson">${escapeHtml(card.lessonTitle)}</span></div>
        <div class="bug-prompt">One operator was flipped. Tap the buggy line.</div>
        <div class="bug-code">
          ${lines.map((ln, i) => `<button class="bug-line" data-line-idx="${i + 1}"><span class="bug-line-num">${i + 1}</span><span class="bug-line-text">${escapeHtml(ln || ' ')}</span></button>`).join('')}
        </div>
        <div class="bug-feedback" data-bug-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-bug"]').addEventListener('click', () => renderLesson());
    const lineBtns = shell.querySelectorAll('.bug-line');
    let answered = false;
    const grade = (pickedLineNum) => {
      if (answered) return;
      answered = true;
      const wasCorrect = pickedLineNum === card.buggyLine;
      if (wasCorrect) correct++;
      state.bugHunt.attempts++;
      if (wasCorrect) state.bugHunt.correct++; else state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
      saveProgress();
      lineBtns.forEach(btn => {
        btn.disabled = true;
        const ln = +btn.dataset.lineIdx;
        if (ln === card.buggyLine) btn.classList.add('bug-line-correct');
        else if (ln === pickedLineNum) btn.classList.add('bug-line-wrong');
      });
      const fb = shell.querySelector('[data-bug-feedback]');
      if (fb) fb.innerHTML = wasCorrect
        ? `<span class="bug-good">✓ Line ${card.buggyLine} · ${escapeHtml(card.mutator)}</span>`
        : `<span class="bug-bad">✗ Actually line ${card.buggyLine} (${escapeHtml(card.mutator)})</span>`;
      setTimeout(() => { idx++; renderCard(); }, wasCorrect ? 900 : 1700);
    };
    lineBtns.forEach(btn => btn.addEventListener('click', () => grade(+btn.dataset.lineIdx)));
  }

  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="bug-shell">
        <div class="bug-header"><span>🪲 Bug-Hunt · done</span></div>
        <div class="bug-summary">
          <div class="bug-summary-pct">${pct}%</div>
          <div class="bug-summary-line">${correct} of ${deck.length} bugs found</div>
          <div class="bug-summary-lifetime">Lifetime: ${state.bugHunt.correct} / ${state.bugHunt.attempts} (${state.bugHunt.attempts > 0 ? Math.round(state.bugHunt.correct / state.bugHunt.attempts * 100) : 0}%)</div>
          <div class="bug-summary-actions">
            <button class="primary" data-action="bug-again">🪲 Another hunt</button>
            <button class="secondary" data-action="bug-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="bug-again"]').addEventListener('click', () => startBugHuntSession());
    shell.querySelector('[data-action="bug-done"]').addEventListener('click', () => renderLesson());
  }

  renderCard();
}

// iter 142: 🔀 Mutate-and-Predict — §9B forward-simulation drill. Where
// Bug-Hunt (iter 73) trains LOCALIZATION (click the buggy line — visual /
// textual recognition), Mutate trains FORWARD SIMULATION (name the type
// of failure the mutation causes — mental trace + taxonomy classification).
// Reuses BUG_HUNT_MUTATORS + _bugHuntCollectMatches + _bugHuntLineOf +
// _bugHuntShuffle from iter 73 so the operator-mutation infrastructure
// stays in one place. The differentiator is the classifier + the consequence
// taxonomy distractor pool (not the localization).
const MUTATE_DECK_LEN = 5;
const MUTATE_CLASSES = [
  { label: 'Output unchanged', desc: 'The mutated code produces the same output as the canonical did.' },
  { label: 'Wrong output, same shape', desc: 'Output is the same TYPE (number/array/string) but the content is wrong.' },
  { label: 'Runtime error / throws', desc: 'The mutation makes the code throw at runtime (or hit a forbidden path).' },
  { label: 'Different output type', desc: 'Output type changed entirely — e.g. array became undefined, number became string.' }
];
// Hang-safe subset of BUG_HUNT_MUTATORS — shared between iter-73 Bug-Hunt
// (after iter-143 port) and iter-142 Mutate-and-Predict. The 3 excluded
// mutators (`++ → --`, `-- → ++`, `&& → ||`) can flip a loop counter
// direction or relax a restrictive guard, turning a finite loop into an
// infinite one. runCode wraps user code in a SYNCHRONOUS `new Function`
// call — a Promise.race timeout can't interrupt it; the only safe
// protection is not picking those mutations. iter-143 surfaced that the
// vulnerability had been latent in Bug-Hunt since iter 73 (Bug-Hunt CDP
// probe started hanging intermittently after iter-142's tighter deck-build
// loop made the issue reproducible). The remaining 7 mutators still cover
// the most common interview bug shapes: boundary comparisons (4) +
// equality flips (2) + `|| → &&` (1, the restriction-only direction).
const SAFE_MUTATORS = BUG_HUNT_MUTATORS.filter(m =>
  m.name !== '++ → --' && m.name !== '-- → ++' && m.name !== '&& → ||'
);

// Heuristic type inference over a stringified `runCode` output. The runner
// already stringifies numbers / booleans / objects / arrays via formatArg
// (see js/core/runner.js), so a regex pass over the trimmed string is enough
// to distinguish the 6-7 shapes the classifier needs. Used by _mutateClassify.
function _mutateInferType(s) {
  if (s === null || s === undefined) return 'undefined';
  const t = String(s).trim();
  if (!t) return 'empty';
  if (t === 'undefined') return 'undefined';
  if (t === 'null') return 'null';
  if (t === 'true' || t === 'false') return 'boolean';
  if (/^-?\d+$/.test(t)) return 'integer';
  if (/^-?\d+(\.\d+)?$/.test(t)) return 'number';
  if (t.startsWith('[')) return 'array';
  if (t.startsWith('{') && !t.startsWith('{ ')) return 'object';  // exclude Map() rendering
  return 'string';
}

// Classify a mutation result against the canonical's expected output.
// Returns 0..3 (index into MUTATE_CLASSES) or null if the mutation isn't
// usable (e.g. produced a hang or unparseable state — guarded upstream).
function _mutateClassify(res, expected) {
  if (!res.ok) return 2;                              // runtime error / throws
  const actual = res.output || '';
  if (actual === expected) return 0;                  // output unchanged
  const actType = _mutateInferType(actual);
  const expType = _mutateInferType(expected);
  if (actType !== expType) return 3;                  // different output type
  return 1;                                           // wrong content, same shape
}

// Pick the first classifiable mutation from a random walk of mutators ×
// match sites. Returns null when none of the tried mutations land in a
// usable class (rare — most canonicals have plenty of operators to mutate).
async function _mutateClassifyMutation(canonical, expected) {
  // Use the hang-safe subset (shared with Bug-Hunt since iter 143) — see
  // SAFE_MUTATORS comment for the hang-protection rationale.
  for (const mut of _bugHuntShuffle(SAFE_MUTATORS)) {
    const matches = _bugHuntCollectMatches(canonical, mut.from);
    if (!matches.length) continue;
    for (const pick of _bugHuntShuffle(matches).slice(0, 3)) {
      const mutated = canonical.slice(0, pick.start) + mut.to + canonical.slice(pick.end);
      let res;
      try {
        res = await runCode(mutated);
      } catch (_) { continue; }
      const cls = _mutateClassify(res, expected);
      if (cls === null) continue;
      return {
        mutator: mut.name,
        line: _bugHuntLineOf(canonical, pick.start),
        mutatedCode: mutated,
        originalCode: canonical,
        consequenceClass: cls,
        observedOutput: res.ok ? (res.output || '(empty)') : (res.output || 'Error')
      };
    }
  }
  return null;
}

// Build a 5-card deck. Samples Patterns/Applied lessons (operator-mutation
// is most interview-realistic on algorithmic code, not on basic Syntax
// reference demos). Note: differentiator from Bug-Hunt's deck — Bug-Hunt
// filters for mutations that BREAK output (the "find the bug" surface
// requires a real bug); Mutate INCLUDES unchanged-output mutations as the
// `consequenceClass=0` ("still-correct") class — that's a load-bearing
// piece of the consequence-class taxonomy. The probe asserts at least one
// class-0 card can land in a deck given enough samples.
async function _mutateBuildDeck() {
  const candidates = CURRICULUM.filter(l =>
    (l.track === 'patterns' || l.track === 'applied') && l.status === 'full'
  );
  const shuffled = _bugHuntShuffle(candidates).slice(0, 12);
  for (const l of shuffled) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  const deck = [];
  for (const l of shuffled) {
    if (deck.length >= MUTATE_DECK_LEN) break;
    const c = CONTENT[l.id];
    if (!c || !c.L3 || !c.L3.canonical || !c.L3.expectedOutput) continue;
    const classified = await _mutateClassifyMutation(c.L3.canonical, c.L3.expectedOutput);
    if (!classified) continue;
    deck.push({
      lessonId: l.id,
      lessonTitle: l.title,
      sectionName: l.section,
      mutatedCode: classified.mutatedCode,
      mutatedLine: classified.line,
      mutator: classified.mutator,
      originalCode: classified.originalCode,
      correctClass: classified.consequenceClass,
      observedOutput: classified.observedOutput,
      expectedOutput: c.L3.expectedOutput
    });
  }
  return deck;
}

async function startMutateSession() {
  const deck = await _mutateBuildDeck();
  if (!deck || deck.length < 3) {
    alert('Mutate-and-Predict needs more Patterns/Applied lessons loaded. Try again after clicking around a few lessons.');
    return;
  }
  state.mutate.sessions++;
  state.mutate.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell mutate-shell">
        <div class="recognize-header">
          <span>🔀 Mutate · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-mutate">✕ Exit</button>
        </div>
        <div class="whatif-lesson-tag">${escapeHtml(card.lessonTitle)} · ${escapeHtml(card.sectionName)}</div>
        <pre class="whatif-canonical cm-s-dracula" data-mutate-code></pre>
        <div class="mutate-mutator-tag">Mutation: <span class="mutate-mutator">${escapeHtml(card.mutator)}</span> at line ${card.mutatedLine}</div>
        <div class="whatif-tag">What happens when this code runs against the canonical's expected input?</div>
        <div class="whatif-options">
          ${MUTATE_CLASSES.map((c, i) => `
            <button class="recognize-opt whatif-opt mutate-opt" data-opt="${i}" title="${escapeHtml(c.desc)}">
              <span class="whatif-opt-letter">${String.fromCharCode(65 + i)}</span>
              <span class="whatif-opt-val">${escapeHtml(c.label)}</span>
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-mutate-feedback></div>
      </div>
    `;
    const codeEl = shell.querySelector('[data-mutate-code]');
    if (codeEl && typeof colorizeInto === 'function') colorizeInto(codeEl, card.mutatedCode);
    else if (codeEl) codeEl.textContent = card.mutatedCode;
    shell.querySelector('[data-action="exit-mutate"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.mutate-opt');
    let answered = false;
    optBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const optIdx = +btn.dataset.opt;
        const wasRight = optIdx === card.correctClass;
        if (wasRight) correct++;
        else {
          state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
          appendHistory(card.lessonId, 'L1-miss');
        }
        state.mutate.attempts++;
        if (wasRight) state.mutate.correct++;
        saveProgress();
        optBtns.forEach((b, i) => {
          b.disabled = true;
          if (i === card.correctClass) b.classList.add('recognize-opt-correct');
          else if (i === optIdx) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-mutate-feedback]');
        if (fb) {
          const obs = card.correctClass === 0
            ? '(Output: unchanged from the canonical.)'
            : card.correctClass === 2
              ? `Threw: ${escapeHtml(card.observedOutput)}`
              : `Output: <span class="mono">${escapeHtml(card.observedOutput)}</span> (expected <span class="mono">${escapeHtml(card.expectedOutput)}</span>)`;
          fb.innerHTML = `
            <div class="whatif-reveal">
              <div class="whatif-reveal-title">${wasRight ? '✓ Got it' : '✗ The right answer was'}</div>
              <div class="whatif-reveal-val">${escapeHtml(MUTATE_CLASSES[card.correctClass].label)}</div>
              <div class="mutate-observed">${obs}</div>
              <button class="whatif-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="whatif-next" data-action="mutate-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="mutate-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell mutate-shell">
        <div class="recognize-header"><span>🔀 Mutate · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} consequences predicted · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.mutate.correct} / ${state.mutate.attempts} (${state.mutate.attempts > 0 ? Math.round(state.mutate.correct / state.mutate.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="mutate-again">🔀 Another session</button>
            <button class="secondary" data-action="mutate-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="mutate-again"]').addEventListener('click', () => startMutateSession());
    shell.querySelector('[data-action="mutate-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 147: 📞 Phone Screen Simulator — Cat 2 Paths & Sessions. Chains 3 cards
// (1 syntax-track Reference-readonly warmup + 1 pattern-track L3 editor + 1
// mechanic-related L2 fill follow-up) under ONE unbroken timer (~12-15 min
// total). The unified clock is the load-bearing piece — Mock has a timer but
// only over a single lesson; Gauntlet chains lessons but has no timer. This
// surface combines both axes to reproduce the actual phone-screen shape:
// cumulative pressure across lesson transitions. PROFILE L22-24 "interview-
// format conditioning."
//
// Deck recipe is deterministic per-session (random within each card slot):
//   - Card 1: any syntax-track full lesson (any has notes; iter-144 scan
//     confirmed 100% reference.notes coverage).
//   - Card 2: random pattern-track full lesson with ≥1 mechanic (72 / 79
//     pattern lessons qualify per iter-147 pre-scan).
//   - Card 3: a DIFFERENT lesson sharing ≥1 mechanic with card 2 (via
//     existing MECHANIC_INDEX). Fallback: any random pattern lesson if no
//     mechanic-overlap candidate exists (rare — 24 mechanics shared by ≥3
//     lessons make the overlap pick reliable).
async function _phoneScreenBuildDeck() {
  // Force-load all content first so MECHANIC_INDEX is complete; reuses the
  // same ensureMechanicIndex() helper Mechanics modal + Bridge use.
  await ensureMechanicIndex();
  const fullLessons = CURRICULUM.filter(l => l.status === 'full');
  // Card 1: random syntax-track lesson with reference.code present (every
  // full lesson has it per validator).
  const syntaxPool = fullLessons.filter(l => l.track === 'syntax');
  if (!syntaxPool.length) return null;
  const card1Lesson = syntaxPool[Math.floor(Math.random() * syntaxPool.length)];
  // Card 2: random pattern-track lesson with ≥1 mechanic. If no patterns
  // have mechanics (impossible per pre-scan but guard anyway), fall back to
  // any pattern lesson.
  const patternPool = fullLessons.filter(l =>
    l.track === 'patterns' &&
    CONTENT[l.id]?.mechanics && CONTENT[l.id].mechanics.length > 0
  );
  if (!patternPool.length) return null;
  const card2Lesson = patternPool[Math.floor(Math.random() * patternPool.length)];
  // Card 3: a lesson sharing ≥1 mechanic with card 2. Walk card 2's mechanics
  // in shuffled order; for each, find lessons in MECHANIC_INDEX excluding
  // card 2; pick one at random. Fallback to any non-card-2 pattern lesson.
  const card2Mechs = CONTENT[card2Lesson.id].mechanics || [];
  let card3Lesson = null;
  for (const mid of _bugHuntShuffle(card2Mechs)) {
    const bucket = MECHANIC_INDEX.get(mid);
    if (!bucket) continue;
    const overlap = Array.from(bucket).filter(id => id !== card2Lesson.id);
    if (overlap.length === 0) continue;
    const pickedId = overlap[Math.floor(Math.random() * overlap.length)];
    card3Lesson = CURRICULUM.find(l => l.id === pickedId);
    if (card3Lesson && card3Lesson.status === 'full') break;
    card3Lesson = null;
  }
  if (!card3Lesson) {
    const fallbackPool = patternPool.filter(l => l.id !== card2Lesson.id);
    if (!fallbackPool.length) return null;
    card3Lesson = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
  }
  // Ensure all 3 lessons' content is loaded. ensureMechanicIndex already
  // calls ensureAllContentLoaded but be defensive.
  for (const l of [card1Lesson, card2Lesson, card3Lesson]) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  return [
    { lessonId: card1Lesson.id, title: card1Lesson.title, sectionName: card1Lesson.section, kind: 'warmup' },
    { lessonId: card2Lesson.id, title: card2Lesson.title, sectionName: card2Lesson.section, kind: 'pattern' },
    { lessonId: card3Lesson.id, title: card3Lesson.title, sectionName: card3Lesson.section, kind: 'followup' }
  ];
}

async function startPhoneScreenSession() {
  const deck = await _phoneScreenBuildDeck();
  if (!deck || deck.length !== 3) {
    alert('Phone Screen needs more lessons loaded. Try again after clicking around a few syntax + patterns lessons.');
    return;
  }
  state.phoneScreen.sessions++;
  state.phoneScreen.lastRunAt = Date.now();
  saveProgress();
  let idx = 0;
  const outcomes = []; // {kind, lessonId, passed}
  const shell = document.getElementById('lesson-shell');
  const sessionStartMs = Date.now();
  let tickHandle = null;
  function startTimerTick() {
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = setInterval(() => {
      const el = document.getElementById('phone-screen-timer');
      if (el) el.textContent = formatTime(Date.now() - sessionStartMs);
    }, 250);
  }
  function stopTimerTick() {
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  }
  function pipsHtml() {
    return deck.map((_, i) => {
      const cls = i < idx ? 'phone-pip-done' : (i === idx ? 'phone-pip-active' : 'phone-pip-pending');
      return `<span class="phone-pip ${cls}" data-pip-idx="${i}"></span>`;
    }).join('');
  }
  function renderShellChrome(bodyHtml) {
    shell.innerHTML = `
      <div class="recognize-shell phone-screen-shell">
        <div class="recognize-header">
          <span>📞 Phone Screen · <span id="phone-screen-timer" class="mono">0:00</span></span>
          <button class="recognize-exit" data-action="exit-phone-screen">✕ End interview</button>
        </div>
        <div class="phone-pips" aria-label="3-card session progress">${pipsHtml()}</div>
        <div class="phone-card-tag">Card ${idx + 1} of 3 · ${escapeHtml(deck[idx].title)} · ${escapeHtml(deck[idx].sectionName)}</div>
        <div class="phone-card-body" data-phone-card-body>${bodyHtml}</div>
      </div>
    `;
    shell.querySelector('[data-action="exit-phone-screen"]').addEventListener('click', () => {
      stopTimerTick();
      renderLesson();
    });
    startTimerTick();
  }
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    const content = CONTENT[card.lessonId];
    if (!content) {
      renderShellChrome(`<div class="phone-card-error">Lesson content failed to load. Try again.</div>`);
      return;
    }
    if (card.kind === 'warmup') {
      renderShellChrome(`
        <div class="phone-card-instructions">Warm-up: read the canonical + notes. Tap "Got it" when ready.</div>
        <pre class="phone-warmup-code cm-s-dracula" data-phone-warmup-code></pre>
        <div class="phone-card-notes-label">Notes:</div>
        <ul class="phone-card-notes">${(content.reference.notes || []).map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
        <div class="phone-card-actions">
          <button class="primary" data-action="phone-next">Got it →</button>
        </div>
      `);
      const codeEl = shell.querySelector('[data-phone-warmup-code]');
      if (codeEl && typeof colorizeInto === 'function') colorizeInto(codeEl, content.reference.code);
      else if (codeEl) codeEl.textContent = content.reference.code;
      shell.querySelector('[data-action="phone-next"]').addEventListener('click', () => {
        outcomes.push({ kind: 'warmup', lessonId: card.lessonId, passed: true });
        idx++;
        renderCard();
      });
    } else if (card.kind === 'pattern') {
      const drill = content.L3;
      renderShellChrome(`
        <div class="phone-card-instructions">Pattern L3 — type the canonical from scratch. Run to grade.</div>
        <div class="phone-prompt-block">
          <div class="phone-prompt-label">Prompt</div>
          <div class="phone-prompt-text">${escapeHtml(drill.prompt)}</div>
          <div class="phone-prompt-expected">Expected output: <span class="mono">${escapeHtml(drill.expectedOutput)}</span></div>
        </div>
        <textarea class="phone-l3-editor" data-phone-l3-editor></textarea>
        <div class="phone-card-actions">
          <button class="primary" data-action="phone-run">Run</button>
          <button class="secondary" data-action="phone-give-up">Give up → next card</button>
          <span class="phone-feedback" data-phone-feedback></span>
        </div>
      `);
      const ta = shell.querySelector('[data-phone-l3-editor]');
      const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const cm = CodeMirror.fromTextArea(ta, {
        mode: 'javascript', theme: 'dracula', lineNumbers: true,
        autoCloseBrackets: true, matchBrackets: true, indentUnit: 2, tabSize: 2,
        lineWrapping: true, viewportMargin: Infinity,
        inputStyle: isTouchDevice ? 'contenteditable' : 'textarea',
        spellcheck: false, autocorrect: false, autocapitalize: false
      });
      const fb = shell.querySelector('[data-phone-feedback]');
      shell.querySelector('[data-action="phone-run"]').addEventListener('click', async () => {
        const code = cm.getValue();
        if (!code.trim()) { fb.textContent = '✗ Editor empty.'; fb.className = 'phone-feedback phone-feedback-warn'; return; }
        fb.textContent = 'Running…'; fb.className = 'phone-feedback';
        const res = await runCode(code);
        if (!res.ok) {
          fb.textContent = `✗ Error: ${(res.output || 'unknown').slice(0, 60)}`;
          fb.className = 'phone-feedback phone-feedback-err';
        } else if ((res.output || '') === drill.expectedOutput) {
          fb.textContent = '✓ Pass — moving to follow-up';
          fb.className = 'phone-feedback phone-feedback-pass';
          outcomes.push({ kind: 'pattern', lessonId: card.lessonId, passed: true });
          setTimeout(() => { idx++; renderCard(); }, 700);
        } else {
          const got = (res.output || '(empty)').slice(0, 60);
          fb.textContent = `✗ Output: ${got} (expected: ${drill.expectedOutput.slice(0, 40)})`;
          fb.className = 'phone-feedback phone-feedback-warn';
        }
      });
      shell.querySelector('[data-action="phone-give-up"]').addEventListener('click', () => {
        outcomes.push({ kind: 'pattern', lessonId: card.lessonId, passed: false });
        idx++;
        renderCard();
      });
    } else if (card.kind === 'followup') {
      // L2 fill-in for the mechanic-overlap lesson. Pick the first L2
      // exercise (every full lesson has at least one). Render template with
      // blanks as <input> fields; Submit grades them server-side via the
      // existing L2-runner pattern. Keep this minimal — full L2 surface
      // lives on the lesson's L2 tab; the phone-screen card is intentionally
      // a one-shot follow-up.
      const l2 = content.L2.exercises[0];
      const blanksHtml = l2.blanks.map((_, i) =>
        `<input type="text" class="phone-l2-blank mono" data-phone-l2-blank="${i}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">`
      ).join('  ');
      renderShellChrome(`
        <div class="phone-card-instructions">Follow-up L2 (shares a mechanic with the previous lesson) — fill the blanks from memory.</div>
        <div class="phone-prompt-block">
          <div class="phone-prompt-label">Prompt</div>
          <div class="phone-prompt-text">${escapeHtml(l2.prompt)}</div>
        </div>
        <pre class="phone-l2-template cm-s-dracula" data-phone-l2-template></pre>
        <div class="phone-l2-blanks">${blanksHtml}</div>
        <div class="phone-card-actions">
          <button class="primary" data-action="phone-submit-l2">Submit</button>
          <button class="secondary" data-action="phone-skip-l2">Skip → finish</button>
          <span class="phone-feedback" data-phone-feedback></span>
        </div>
      `);
      const tplEl = shell.querySelector('[data-phone-l2-template]');
      if (tplEl && typeof colorizeInto === 'function') colorizeInto(tplEl, l2.template);
      else if (tplEl) tplEl.textContent = l2.template;
      const fb = shell.querySelector('[data-phone-feedback]');
      shell.querySelector('[data-action="phone-submit-l2"]').addEventListener('click', () => {
        const inputs = shell.querySelectorAll('[data-phone-l2-blank]');
        let allCorrect = true;
        inputs.forEach((inp, i) => {
          const expected = l2.blanks[i].answer || '';
          if (inp.value.trim() === expected.trim()) {
            inp.classList.add('phone-l2-blank-correct');
            inp.classList.remove('phone-l2-blank-wrong');
          } else {
            inp.classList.add('phone-l2-blank-wrong');
            inp.classList.remove('phone-l2-blank-correct');
            allCorrect = false;
          }
        });
        if (allCorrect) {
          fb.textContent = '✓ All blanks correct — finishing';
          fb.className = 'phone-feedback phone-feedback-pass';
          outcomes.push({ kind: 'followup', lessonId: card.lessonId, passed: true });
          setTimeout(() => { idx++; renderCard(); }, 700);
        } else {
          fb.textContent = '✗ One or more blanks wrong (red borders). Retry or Skip.';
          fb.className = 'phone-feedback phone-feedback-warn';
        }
      });
      shell.querySelector('[data-action="phone-skip-l2"]').addEventListener('click', () => {
        outcomes.push({ kind: 'followup', lessonId: card.lessonId, passed: false });
        idx++;
        renderCard();
      });
    }
  }
  function renderSummary() {
    stopTimerTick();
    const totalMs = Date.now() - sessionStartMs;
    const passedCount = outcomes.filter(o => o.passed).length;
    state.phoneScreen.completions++;
    saveProgress();
    shell.innerHTML = `
      <div class="recognize-shell phone-screen-shell">
        <div class="recognize-header"><span>📞 Phone Screen · Done · ${formatTime(totalMs)}</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${passedCount} / 3</div>
          <div class="recognize-summary-line">${passedCount} of 3 cards passed in ${formatTime(totalMs)} total time</div>
          <ul class="phone-summary-list">
            ${outcomes.map((o, i) => `<li class="phone-summary-row"><span class="phone-summary-kind">${o.kind}</span> · <span class="${o.passed ? 'phone-summary-pass' : 'phone-summary-fail'}">${o.passed ? '✓' : '✗'}</span> · <span class="phone-summary-lesson">${escapeHtml(deck[i].title)}</span></li>`).join('')}
          </ul>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.phoneScreen.completions} completed sessions of ${state.phoneScreen.sessions} started</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="phone-again">📞 Another session</button>
            <button class="secondary" data-action="phone-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="phone-again"]').addEventListener('click', () => startPhoneScreenSession());
    shell.querySelector('[data-action="phone-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 148: 🚧 Constraint-Shift Drill — Cat 9 §9C Adaptation/transfer + Cat 4
// sidecar registry hybrid. First §9C ship ever; 5th sidecar registry after
// iter-79 complexity-claims / iter-86-87 idiom-pairs / iter-117 clarify-
// distractor-bank / iter-118 hotseat-followups. Each card shows a real
// canonical with its ORIGINAL constraint claim and prompts the user to
// rewrite it to satisfy a SHIFTED constraint. Grade = runCode (output
// matches expectedOutput) PLUS the per-entry structural-fingerprint regex
// (must NOT match in the user's submission for the shift to count — the
// regex catches the canonical's antipattern, e.g. "new Map()" for the
// "O(1) extra space" shift). Trains the senior-interview pivot follow-up
// ("now do it without extra space" / "now do it in-place").
let CONSTRAINT_SHIFTS_BANK = null;
async function _loadConstraintShiftsBank() {
  if (CONSTRAINT_SHIFTS_BANK) return CONSTRAINT_SHIFTS_BANK;
  try {
    const res = await fetch('data/constraint-shifts.json');
    if (!res.ok) return null;
    const j = await res.json();
    CONSTRAINT_SHIFTS_BANK = Array.isArray(j.shifts) ? j.shifts : [];
    return CONSTRAINT_SHIFTS_BANK;
  } catch (_) { return null; }
}

async function _constraintShiftBuildDeck() {
  const bank = await _loadConstraintShiftsBank();
  if (!bank || !bank.length) return null;
  // Ensure every entry's lesson content is loaded so we can show canonical.
  for (const e of bank) {
    if (!CONTENT[e.lessonId]) {
      try { await loadLessonContent(e.lessonId); } catch (_) { /* skip */ }
    }
  }
  // Filter to entries whose lesson + canonical are actually available.
  const usable = bank.filter(e => CONTENT[e.lessonId] && CONTENT[e.lessonId].L3 && CONTENT[e.lessonId].L3.canonical);
  if (!usable.length) return null;
  // Shuffle (reuse iter-73 _bugHuntShuffle) + take all (v1 ships 2 entries; full deck per session).
  const shuffled = _bugHuntShuffle(usable);
  return shuffled.map(e => {
    const c = CONTENT[e.lessonId];
    const lesson = CURRICULUM.find(l => l.id === e.lessonId);
    return {
      lessonId: e.lessonId,
      lessonTitle: lesson ? lesson.title : e.lessonId,
      sectionName: lesson ? lesson.section : '',
      canonical: c.L3.canonical,
      expectedOutput: c.L3.expectedOutput,
      originalClaim: e.originalClaim,
      shiftedClaim: e.shiftedClaim,
      hint: e.hint || '',
      structuralCheck: e.structuralCheck,
      structuralCheckExplain: e.structuralCheckExplain || ''
    };
  });
}

async function startConstraintShiftSession() {
  const deck = await _constraintShiftBuildDeck();
  if (!deck || deck.length < 1) {
    alert('Constraint-Shift sidecar is empty or failed to load. Try again after the lesson content is cached.');
    return;
  }
  state.constraintShift.sessions++;
  state.constraintShift.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell shift-shell">
        <div class="recognize-header">
          <span>🚧 Constraint-Shift · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-shift">✕ Exit</button>
        </div>
        <div class="whatif-lesson-tag">${escapeHtml(card.lessonTitle)} · ${escapeHtml(card.sectionName)}</div>
        <div class="shift-claims-block">
          <div class="shift-claim-row">
            <span class="shift-claim-label shift-claim-orig">Original</span>
            <span class="shift-claim-text">${escapeHtml(card.originalClaim)}</span>
          </div>
          <div class="shift-claim-row">
            <span class="shift-claim-label shift-claim-shift">Shift to</span>
            <span class="shift-claim-text shift-claim-shift-text">${escapeHtml(card.shiftedClaim)}</span>
          </div>
        </div>
        <div class="shift-canonical-label">Canonical (the original-constraint solution — read it, then rewrite below):</div>
        <pre class="whatif-canonical cm-s-dracula" data-shift-canonical></pre>
        <div class="shift-hint">${escapeHtml(card.hint)}</div>
        <textarea class="shift-editor" data-shift-editor></textarea>
        <div class="shift-actions">
          <button class="primary" data-action="shift-run">Run + check</button>
          <button class="secondary" data-action="shift-skip">Skip → next</button>
          <span class="shift-feedback" data-shift-feedback></span>
        </div>
      </div>
    `;
    const codeEl = shell.querySelector('[data-shift-canonical]');
    if (codeEl && typeof colorizeInto === 'function') colorizeInto(codeEl, card.canonical);
    else if (codeEl) codeEl.textContent = card.canonical;
    const ta = shell.querySelector('[data-shift-editor]');
    const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const cm = CodeMirror.fromTextArea(ta, {
      mode: 'javascript', theme: 'dracula', lineNumbers: true,
      autoCloseBrackets: true, matchBrackets: true, indentUnit: 2, tabSize: 2,
      lineWrapping: true, viewportMargin: Infinity,
      inputStyle: isTouchDevice ? 'contenteditable' : 'textarea',
      spellcheck: false, autocorrect: false, autocapitalize: false
    });
    const fb = shell.querySelector('[data-shift-feedback]');
    shell.querySelector('[data-action="exit-shift"]').addEventListener('click', () => renderLesson());
    shell.querySelector('[data-action="shift-skip"]').addEventListener('click', () => {
      state.constraintShift.attempts++;
      state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
      appendHistory(card.lessonId, 'L1-miss');
      saveProgress();
      idx++;
      renderCard();
    });
    shell.querySelector('[data-action="shift-run"]').addEventListener('click', async () => {
      const userCode = cm.getValue();
      if (!userCode.trim()) {
        fb.textContent = '✗ Editor empty — type your shifted solution first.';
        fb.className = 'shift-feedback shift-feedback-warn';
        return;
      }
      fb.textContent = 'Running…';
      fb.className = 'shift-feedback';
      const res = await runCode(userCode);
      // Two-part grade: output must match AND structural regex must NOT match.
      const outputMatches = res.ok && (res.output || '') === card.expectedOutput;
      let regexCatchesAntipattern = false;
      try {
        const re = new RegExp(card.structuralCheck);
        regexCatchesAntipattern = re.test(userCode);
      } catch (_) { /* malformed regex in sidecar — treat as no-catch */ }
      state.constraintShift.attempts++;
      if (!res.ok) {
        fb.innerHTML = `✗ Runtime error: ${escapeHtml((res.output || 'unknown').slice(0, 80))}`;
        fb.className = 'shift-feedback shift-feedback-err';
        state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
        appendHistory(card.lessonId, 'L1-miss');
      } else if (!outputMatches) {
        const got = (res.output || '(empty)').slice(0, 60);
        fb.innerHTML = `✗ Output: <span class="mono">${escapeHtml(got)}</span> (expected <span class="mono">${escapeHtml(card.expectedOutput.slice(0, 40))}</span>)`;
        fb.className = 'shift-feedback shift-feedback-warn';
        state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
        appendHistory(card.lessonId, 'L1-miss');
      } else if (regexCatchesAntipattern) {
        fb.innerHTML = `✗ Output correct but you still used the original-constraint technique. ${escapeHtml(card.structuralCheckExplain)}`;
        fb.className = 'shift-feedback shift-feedback-warn';
        state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
        appendHistory(card.lessonId, 'L1-miss');
      } else {
        correct++;
        state.constraintShift.correct++;
        fb.textContent = '✓ Output matches AND structural check passes — constraint shift complete.';
        fb.className = 'shift-feedback shift-feedback-pass';
      }
      saveProgress();
      // Add Next button to the actions row so user can advance.
      const actions = shell.querySelector('.shift-actions');
      if (actions && !actions.querySelector('[data-action="shift-next"]')) {
        const next = document.createElement('button');
        next.className = 'primary';
        next.dataset.action = 'shift-next';
        next.textContent = 'Next card →';
        next.addEventListener('click', () => { idx++; renderCard(); });
        actions.appendChild(next);
      }
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell shift-shell">
        <div class="recognize-header"><span>🚧 Constraint-Shift · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} shifts completed cleanly</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.constraintShift.correct} / ${state.constraintShift.attempts} (${state.constraintShift.attempts > 0 ? Math.round(state.constraintShift.correct / state.constraintShift.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="shift-again">🚧 Another session</button>
            <button class="secondary" data-action="shift-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="shift-again"]').addEventListener('click', () => startConstraintShiftSession());
    shell.querySelector('[data-action="shift-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 47: per-section retention aggregation for the Stats modal. Walks every
// lesson's state.history events, bins by day across lookbackDays, returns
// sorted rows (worst retention first → drives "what needs attention" UX).
// Sections with zero activity in window are excluded. See ideas-by-category.md
// § Metacognition & Visibility → Section-level retention sparkline.
function _aggregateSectionRetention(lookbackDays = 14) {
  const now = Date.now();
  const dayMs = 86400000;
  const cutoff = now - lookbackDays * dayMs;
  // Group lessons by section.
  const bySection = new Map();
  for (const l of CURRICULUM) {
    if (l.status !== 'full') continue;
    if (!bySection.has(l.section)) bySection.set(l.section, []);
    bySection.get(l.section).push(l);
  }
  const rows = [];
  for (const [sectionName, lessons] of bySection) {
    const byDay = Array.from({ length: lookbackDays }, () => ({ passes: 0, misses: 0 }));
    let totalPass = 0, totalMiss = 0;
    for (const lesson of lessons) {
      const events = state.history?.[lesson.id] || [];
      for (const e of events) {
        if (e.at < cutoff) continue;
        const daysAgo = Math.floor((now - e.at) / dayMs);
        if (daysAgo >= lookbackDays || daysAgo < 0) continue;
        const idx = lookbackDays - 1 - daysAgo;
        if (e.event === 'L1-miss') { byDay[idx].misses++; totalMiss++; }
        else if (e.event === 'L1-pass' || e.event === 'L2-pass' || e.event === 'L3-pass') {
          byDay[idx].passes++; totalPass++;
        }
      }
    }
    if (totalPass === 0 && totalMiss === 0) continue;
    rows.push({ section: sectionName, lessons, byDay, totalPass, totalMiss });
  }
  // Sort: worst retention (highest miss-ratio) first; tiebreak by most recent activity.
  rows.sort((a, b) => {
    const ra = a.totalMiss / Math.max(1, a.totalPass + a.totalMiss);
    const rb = b.totalMiss / Math.max(1, b.totalPass + b.totalMiss);
    if (ra !== rb) return rb - ra;
    return (b.totalPass + b.totalMiss) - (a.totalPass + a.totalMiss);
  });
  return rows;
}

// Renders the section-retention block for the Stats modal. Returns HTML string
// or '' when no qualifying sections (avoid empty-section noise in Stats).
// iter 131 — Calibrate v2 Stats tile. iter-119 v1 captured calibration
// data per mechanic into state.timeCalibration.byMechanic[id].predictions[];
// v2 is the visualization surface that was DEFERRED at v1 ship pending
// soak data. Renders the top-5 most-miscalibrated mechanics by median
// errorSec (|actual_sec − bucket_midpoint_sec|). Auto-hides when no
// mechanic has ≥5 predictions yet — clean-progress users see nothing
// (graceful empty state, not a confusing "0 / 0" tile). PROFILE L65-69
// success-criterion surface: self-knowledge of pattern-time accuracy.
const CALIBRATION_TILE_MIN_PREDICTIONS = 5;
const CALIBRATION_TILE_TOP_N = 5;
function _renderCalibrationTile() {
  const cal = state.timeCalibration;
  if (!cal || !cal.byMechanic || typeof cal.byMechanic !== 'object') return '';
  const rows = [];
  for (const [id, data] of Object.entries(cal.byMechanic)) {
    if (!data || !Array.isArray(data.predictions)) continue;
    if (data.predictions.length < CALIBRATION_TILE_MIN_PREDICTIONS) continue;
    const errors = data.predictions.map(p => +p.errorSec || 0).sort((a, b) => a - b);
    const mid = Math.floor(errors.length / 2);
    const median = errors.length % 2 === 0
      ? (errors[mid - 1] + errors[mid]) / 2
      : errors[mid];
    const m = MECHANICS.find(x => x.id === id);
    rows.push({
      id,
      label: (m && m.label) ? m.label : id,
      median,
      count: data.predictions.length
    });
  }
  if (rows.length === 0) return ''; // auto-hide when no soak data
  rows.sort((a, b) => b.median - a.median);
  const top = rows.slice(0, CALIBRATION_TILE_TOP_N);
  const formatSec = (s) => s >= 60 ? `${Math.round(s/60)}m` : `${Math.round(s)}s`;
  return `
    <div data-calibration-tile style="margin-top: 18px;">
      <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">⏱ Calibration · top ${top.length} miscalibrated mechanic${top.length === 1 ? '' : 's'}</div>
      <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">Median |actual − estimate| per mechanic from your L3-pass history. Higher = bigger gap between your time bucket and actual seconds.</div>
      ${top.map(r => `
        <div data-cal-row data-mech-id="${escapeHtml(r.id)}" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #1e293b; border-radius: 6px; margin-bottom: 4px;">
          <span style="color: #cbd5e1; font-size: 13px;">${escapeHtml(r.label)}</span>
          <span style="color: #fbbf24; font-size: 13px; font-variant-numeric: tabular-nums;">${formatSec(r.median)} <span style="color: #64748b; font-size: 11px;">· ${r.count}×</span></span>
        </div>
      `).join('')}
    </div>
  `;
}

// iter 155: ⏳ Time-Invested Section Ledger. Walks state.history per lesson;
// each consecutive event pair within TIME_INVESTED_GAP_MS counts as session
// time (capped at TIME_INVESTED_INTERVAL_CAP_MS per pair so an "I left the
// tab open overnight" doesn't poison the sum). Groups ms-spent by
// lesson.section; renders top-N as horizontal bars sorted desc.
// Complements iter-66 Track Balance Compass on the orthogonal axis: Compass
// shows % mastered per TRACK; Ledger shows minutes-spent per SECTION.
// PROFILE L46-48 (effort allocation visibility) + L75 (own-data only — no
// global benchmark or peer comparison). Schema-additive zero — reads existing
// state.history.
const TIME_INVESTED_GAP_MS = 5 * 60 * 1000;
const TIME_INVESTED_INTERVAL_CAP_MS = 5 * 60 * 1000;
const TIME_INVESTED_TOP_N = 8;
function _renderTimeInvestedTile() {
  const hist = state.history || {};
  const bySection = {};
  for (const lessonId of Object.keys(hist)) {
    const lesson = findLesson(lessonId);
    if (!lesson || !lesson.section) continue;
    const events = hist[lessonId] || [];
    if (events.length < 2) continue;
    let sectionMs = 0;
    for (let i = 1; i < events.length; i++) {
      const a = events[i - 1]?.at;
      const b = events[i]?.at;
      if (typeof a !== 'number' || typeof b !== 'number') continue;
      const gap = b - a;
      if (gap > 0 && gap < TIME_INVESTED_GAP_MS) {
        sectionMs += Math.min(gap, TIME_INVESTED_INTERVAL_CAP_MS);
      }
    }
    if (sectionMs > 0) {
      bySection[lesson.section] = (bySection[lesson.section] || 0) + sectionMs;
    }
  }
  const rows = Object.entries(bySection)
    .map(([section, ms]) => ({ section, ms }))
    .sort((a, b) => b.ms - a.ms);
  if (rows.length === 0) return ''; // auto-hide when no inferable session data
  const topN = rows.slice(0, TIME_INVESTED_TOP_N);
  const maxMs = topN[0].ms;
  const totalMs = rows.reduce((s, r) => s + r.ms, 0);
  const formatMs = (ms) => {
    const min = Math.floor(ms / 60000);
    if (min < 1) return '<1m';
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const rem = min % 60;
    return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
  };
  return `
    <div data-time-invested-tile style="margin-top: 18px;">
      <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">⏳ Time invested · top ${topN.length} section${topN.length === 1 ? '' : 's'} <span style="color:#475569;">· ${formatMs(totalMs)} total</span></div>
      <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">Inferred from event timestamps — consecutive events within 5min count as session time (capped at 5min per gap). Effort-allocation complement to 🧭 Track Balance above.</div>
      ${topN.map(r => {
        const pct = Math.round((r.ms / maxMs) * 100);
        return `
          <div style="display: grid; grid-template-columns: 130px 1fr 60px; gap: 8px; align-items: center; padding: 4px 0;">
            <span style="color: #cbd5e1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(r.section)}">${escapeHtml(r.section)}</span>
            <div style="height: 8px; background: #1e293b; border-radius: 4px; overflow: hidden;">
              <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #67e8f9, #a78bfa);"></div>
            </div>
            <span style="color: #94a3b8; font-size: 11px; font-variant-numeric: tabular-nums; text-align: right;">${formatMs(r.ms)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function _renderSectionRetentionBlock(lookbackDays = 14) {
  const rows = _aggregateSectionRetention(lookbackDays);
  if (rows.length === 0) return '';
  const maxBin = Math.max(1, ...rows.flatMap(r => r.byDay.map(b => b.passes + b.misses)));
  const rowHtml = rows.map(r => {
    const bars = r.byDay.map((b, i) => {
      const total = b.passes + b.misses;
      const daysAgo = lookbackDays - 1 - i;
      if (total === 0) {
        return `<div class="sec-ret-bar sec-ret-bar-empty" title="${daysAgo}d ago: no activity"></div>`;
      }
      const pct = Math.max(15, Math.round((total / maxBin) * 100));
      const tone = b.misses === 0 ? 'pass' : b.passes === 0 ? 'miss' : 'mixed';
      return `<div class="sec-ret-bar sec-ret-bar-${tone}" style="height:${pct}%;" title="${daysAgo}d ago: ${b.passes} passes, ${b.misses} misses"></div>`;
    }).join('');
    const missRatio = r.totalMiss / Math.max(1, r.totalPass + r.totalMiss);
    const ratioTone = missRatio === 0 ? 'good' : missRatio >= 0.3 ? 'warn' : 'mid';
    return `
      <div class="sec-ret-row">
        <div class="sec-ret-name" title="${r.lessons.length} lessons in this section">${escapeHtml(r.section)}</div>
        <div class="sec-ret-spark" title="Last ${lookbackDays} days — newest right">${bars}</div>
        <div class="sec-ret-count sec-ret-count-${ratioTone}">${r.totalPass}<span class="sec-ret-sep">·</span>${r.totalMiss > 0 ? r.totalMiss + 'M' : '0M'}</div>
      </div>
    `;
  }).join('');
  return `
    <div class="sec-ret-block">
      <div class="sec-ret-title">Section retention <span class="sec-ret-sub">last ${lookbackDays} days — weakest first</span></div>
      ${rowHtml}
      <div class="sec-ret-legend">
        <span class="sec-ret-legend-item"><span class="sec-ret-swatch sec-ret-bar-pass"></span>all pass</span>
        <span class="sec-ret-legend-item"><span class="sec-ret-swatch sec-ret-bar-mixed"></span>mixed</span>
        <span class="sec-ret-legend-item"><span class="sec-ret-swatch sec-ret-bar-miss"></span>only miss</span>
        <span class="sec-ret-legend-item"><span class="sec-ret-swatch sec-ret-bar-empty"></span>no activity</span>
      </div>
    </div>
  `;
}
// ---------- Cheatsheet modal (in-app quick reference) ----------
// Mirrors the Mechanics modal pattern: a scrollable overlay you open over
// whatever lesson you're on, browse the canonical code for any lesson, then
// either jump to it (closes the modal + selectLesson) or close and resume.
let _cheatsheetTrack = null;      // 'syntax' | 'patterns' | 'applied'
let _cheatsheetSearch = '';

async function openCheatsheetModal() {
  const modal = document.getElementById('cheatsheet-modal');
  if (!modal) return;
  // Default the track tab to the current lesson's track (if any).
  if (!_cheatsheetTrack) {
    const cur = findLesson(state.currentLessonId);
    _cheatsheetTrack = (cur && cur.track) || 'patterns';
  }
  const body = document.getElementById('cheatsheet-body');
  if (body) body.innerHTML = `<div style="color:#94a3b8;text-align:center;padding:24px 0;">Loading cheatsheet…</div>`;
  const searchInput = document.getElementById('cheatsheet-search');
  if (searchInput) searchInput.value = _cheatsheetSearch;
  modal.style.display = 'block';
  await ensureAllContentLoaded();
  renderCheatsheetTabs();
  renderCheatsheetBody();
}

function closeCheatsheetModal() {
  const modal = document.getElementById('cheatsheet-modal');
  if (modal) modal.style.display = 'none';
}

function renderCheatsheetTabs() {
  const tabs = document.getElementById('cheatsheet-tabs');
  if (!tabs) return;
  const trackDefs = [
    { id: 'syntax',   label: 'Syntax' },
    { id: 'patterns', label: 'Patterns' },
    { id: 'applied',  label: 'Applied' },
  ];
  tabs.innerHTML = trackDefs.map(t => {
    const active = t.id === _cheatsheetTrack;
    const bg = active ? '#1e293b' : 'transparent';
    const color = active ? '#f8fafc' : '#94a3b8';
    const border = active ? '#334155' : '#1e293b';
    return `<button data-cs-track="${t.id}" style="background:${bg};color:${color};border:1px solid ${border};border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;">${t.label}</button>`;
  }).join('');
  tabs.querySelectorAll('[data-cs-track]').forEach(btn => {
    btn.addEventListener('click', () => {
      _cheatsheetTrack = btn.getAttribute('data-cs-track');
      renderCheatsheetTabs();
      renderCheatsheetBody();
    });
  });
}

function renderCheatsheetBody() {
  const body = document.getElementById('cheatsheet-body');
  if (!body) return;
  const fullLessons = CURRICULUM.filter(l => l.status === 'full' && l.track === _cheatsheetTrack);
  const q = _cheatsheetSearch;
  const filtered = q
    ? fullLessons.filter(l => {
        if (l.title.toLowerCase().includes(q)) return true;
        if ((l.section || '').toLowerCase().includes(q)) return true;
        const c = CONTENT[l.id];
        if (c && c.description && c.description.toLowerCase().includes(q)) return true;
        return false;
      })
    : fullLessons;

  if (!filtered.length) {
    body.innerHTML = `<div style="color:#94a3b8;text-align:center;padding:24px 0;">No lessons match.</div>`;
    return;
  }

  const sections = [...new Set(filtered.map(l => l.section))];
  const curLesson = findLesson(state.currentLessonId);
  const curSection = curLesson && curLesson.track === _cheatsheetTrack ? curLesson.section : null;
  const curLessonId = curLesson && curLesson.track === _cheatsheetTrack ? curLesson.id : null;

  let html = '';
  for (const section of sections) {
    const lessons = filtered.filter(l => l.section === section);
    // Default-open the current lesson's section, OR all sections when the
    // user is actively filtering (search-results expectation is "show me").
    const sectionOpen = q || section === curSection || _cheatsheetExpandAll;
    html += `<details data-cs-section="${escapeHtml(section)}"${sectionOpen ? ' open' : ''} style="margin-bottom:8px;border:1px solid #1e293b;border-radius:8px;background:#0b1220;">
      <summary style="padding:8px 12px;cursor:pointer;color:#cbd5e1;font-weight:600;font-size:13px;">
        ${escapeHtml(section)} <span style="color:#64748b;font-weight:400;font-size:11px;">· ${lessons.length}</span>
      </summary>
      <div style="padding:4px 8px 10px 8px;display:flex;flex-direction:column;gap:4px;">`;
    for (const lesson of lessons) {
      const c = CONTENT[lesson.id];
      if (!c) continue;
      // Each lesson gets its own collapsible card. Default-collapsed unless
      // it's the lesson the user is currently on, OR they're searching, OR
      // they've hit "Expand all" — matches the "browse titles, drill in on demand" flow.
      const lessonOpen = q || lesson.id === curLessonId || _cheatsheetExpandAll;
      const desc = c.description ? `<div style="color:#94a3b8;font-size:12px;margin:2px 0 6px 0;">${escapeHtml(c.description)}</div>` : '';
      const notesHtml = (c.reference && c.reference.notes && c.reference.notes.length)
        ? `<ul style="margin:6px 0 0 0;padding-left:18px;color:#cbd5e1;font-size:12px;">${c.reference.notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`
        : '';
      html += `<details data-cs-lesson="${escapeHtml(lesson.id)}"${lessonOpen ? ' open' : ''} class="cs-lesson" style="border-left:2px solid #1e293b;padding:2px 0 2px 8px;">
        <summary style="cursor:pointer;color:#e2e8f0;font-weight:600;font-size:13px;padding:4px 0;">
          ${escapeHtml(lesson.title)}
        </summary>
        <div style="padding:4px 0 6px 0;">
          ${desc}
          <pre class="cm-s-dracula" data-cs-code="${escapeHtml(lesson.id)}" style="margin:0;padding:8px 10px;background:#020617;border:1px solid #1e293b;border-radius:6px;overflow-x:auto;font-size:12px;line-height:1.45;white-space:pre;"></pre>
          ${notesHtml}
          <button data-cs-goto="${escapeHtml(lesson.id)}" style="background:none;border:1px solid #1e293b;color:#67e8f9;font-size:11px;cursor:pointer;padding:4px 8px;border-radius:4px;margin-top:8px;">Open lesson →</button>
        </div>
      </details>`;
    }
    html += `</div></details>`;
  }
  body.innerHTML = html;
  body.scrollTop = 0;

  // Wire jump-to-lesson buttons.
  body.querySelectorAll('[data-cs-goto]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Stop propagation so the click doesn't also toggle the parent <details>.
      e.stopPropagation();
      const id = btn.getAttribute('data-cs-goto');
      closeCheatsheetModal();
      selectLesson(id);
    });
  });

  // Colorize code in lessons that are open right now, AND lazily colorize on
  // first expand for the rest. Avoids running runMode 80× upfront on mobile.
  body.querySelectorAll('details[data-cs-lesson]').forEach(det => {
    const pre = det.querySelector('[data-cs-code]');
    if (!pre) return;
    const id = pre.getAttribute('data-cs-code');
    const c = CONTENT[id];
    if (!c || !c.reference || !c.reference.code) return;
    const colorize = () => {
      if (pre.dataset.colorized === '1') return;
      colorizeInto(pre, c.reference.code);
      pre.dataset.colorized = '1';
    };
    if (det.open) colorize();
    else det.addEventListener('toggle', () => { if (det.open) colorize(); }, { once: true });
  });

  // Sync the Expand-all button label to the new tree.
  updateCheatsheetExpandAllLabel();
}

let _cheatsheetExpandAll = false;

function updateCheatsheetExpandAllLabel() {
  const btn = document.getElementById('cheatsheet-expand-all');
  if (!btn) return;
  btn.textContent = _cheatsheetExpandAll ? 'Collapse all' : 'Expand all';
}

function toggleCheatsheetExpandAll() {
  _cheatsheetExpandAll = !_cheatsheetExpandAll;
  // Toggle every <details> inside the body — both section-level and lesson-level.
  const body = document.getElementById('cheatsheet-body');
  if (!body) return;
  body.querySelectorAll('details').forEach(d => { d.open = _cheatsheetExpandAll; });
  // Newly-opened lesson <details> need their code colorized on demand.
  if (_cheatsheetExpandAll) {
    body.querySelectorAll('details[data-cs-lesson][open] [data-cs-code]').forEach(pre => {
      if (pre.dataset.colorized === '1') return;
      const id = pre.getAttribute('data-cs-code');
      const c = CONTENT[id];
      if (c && c.reference && c.reference.code) {
        colorizeInto(pre, c.reference.code);
        pre.dataset.colorized = '1';
      }
    });
  }
  updateCheatsheetExpandAllLabel();
}

async function generateCheatsheet() {
  await ensureAllContentLoaded();
  const fullLessons = CURRICULUM.filter(l => l.status === 'full');
  const date = new Date().toISOString().slice(0, 10);
  const total = fullLessons.length;
  let md = `# JavaScript Interview Cheatsheet\n\n`;
  md += `> ${total} lessons across syntax fundamentals, canonical interview patterns, and applied problems.\n`;
  md += `> Generated ${date} from the JS Drill app.\n\n`;
  md += `---\n\n## Table of Contents\n\n`;

  const tracks = [
    { id: 'syntax',   label: 'Track A — Syntax Fundamentals' },
    { id: 'patterns', label: 'Track B — Canonical Patterns' },
    { id: 'applied',  label: 'Track C — Applied Problems' }
  ];

  // ToC
  for (const track of tracks) {
    const trackLessons = fullLessons.filter(l => l.track === track.id);
    const sections = [...new Set(trackLessons.map(l => l.section))];
    md += `### ${track.label}\n\n`;
    for (const section of sections) {
      md += `- **${section}**: ${trackLessons.filter(l => l.section === section).map(l => l.title).join(' · ')}\n`;
    }
    md += `\n`;
  }
  md += `---\n\n`;

  // Body
  for (const track of tracks) {
    md += `# ${track.label}\n\n`;
    const trackLessons = fullLessons.filter(l => l.track === track.id);
    const sections = [...new Set(trackLessons.map(l => l.section))];
    for (const section of sections) {
      md += `## ${section}\n\n`;
      const sectionLessons = trackLessons.filter(l => l.section === section);
      for (const lesson of sectionLessons) {
        const c = CONTENT[lesson.id];
        if (!c) continue;
        md += `### ${lesson.title}\n\n`;
        md += `${c.description}\n\n`;
        md += '```js\n' + c.reference.code + '\n```\n\n';
        if (c.reference.notes && c.reference.notes.length) {
          md += `**Notes:**\n\n`;
          for (const note of c.reference.notes) md += `- ${note}\n`;
          md += `\n`;
        }
        md += `---\n\n`;
      }
    }
  }
  return md;
}

// iter 126: 📦 Cheatsheet → Printable PDF / Native-Phone Save (iter-124
// roadmap #2 SHIPPED). Differentiator vs iter-113 Offline Drill Pack: Pack
// keeps the corpus drillable INSIDE the app offline; this surface gets the
// corpus OUT of the app entirely into a user-owned native-OS PDF — readable
// in Apple Books / Files / Android Downloads on a plane with the app closed.
// PROFILE 80%-phone amplifies the leverage (subway / plane / kitchen counter).
// No state changes. Returns a complete <html>…</html> string with embedded
// print stylesheet. Code blocks are plain monospace (no syntax highlighting)
// — the goal is offline READING, not interactive drilling, and plain text
// PDFs are smaller + render identically across Apple Books / Adobe / etc.
function _buildPrintableCheatsheetHtml() {
  const fullLessons = CURRICULUM.filter(l => l.status === 'full');
  const date = new Date().toISOString().slice(0, 10);
  const total = fullLessons.length;
  const tracks = [
    { id: 'syntax',   label: 'Track A — Syntax Fundamentals' },
    { id: 'patterns', label: 'Track B — Canonical Patterns' },
    { id: 'applied',  label: 'Track C — Applied Problems' }
  ];

  const css = `
    @page { margin: 18mm 14mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Georgia, "Times New Roman", serif;
      font-size: 11pt; line-height: 1.45; color: #111; background: #fff;
      padding: 24px;
    }
    h1.cover { font-size: 28pt; margin: 0 0 4px 0; }
    .cover-sub { color: #555; font-size: 11pt; margin-bottom: 12px; }
    .toc { font-size: 10pt; color: #333; }
    .toc h2 { font-size: 14pt; margin: 18px 0 6px 0; }
    .toc ul { margin: 4px 0 0 0; padding-left: 18px; }
    .toc li { margin: 1px 0; }
    h1.track { font-size: 22pt; margin: 0 0 6px 0; padding-bottom: 4px; border-bottom: 2px solid #333; }
    h2.section { font-size: 15pt; margin: 18px 0 6px 0; color: #222; }
    h3.lesson { font-size: 12pt; margin: 12px 0 2px 0; color: #111; }
    .desc { font-size: 10pt; color: #444; margin: 2px 0 4px 0; font-style: italic; }
    pre.code {
      font-family: "SF Mono", "Menlo", "Consolas", monospace;
      font-size: 8.5pt; line-height: 1.35;
      background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px;
      padding: 8px 10px; margin: 4px 0 6px 0; overflow: hidden;
      white-space: pre-wrap; word-break: break-word;
      page-break-inside: avoid;
    }
    ul.notes { margin: 4px 0 8px 0; padding-left: 18px; font-size: 10pt; }
    ul.notes li { margin: 1px 0; color: #333; }
    hr.div { border: 0; border-top: 1px dashed #ccc; margin: 12px 0; }
    /* Page breaks: each Track starts a new page; section never split from its
       first lesson; long code blocks stay together when feasible. */
    .track-wrap { page-break-before: always; }
    .track-wrap.first { page-break-before: avoid; }
    h2.section { page-break-after: avoid; }
    h3.lesson { page-break-after: avoid; }
    .toolbar {
      position: sticky; top: 0; background: #fffae6; border: 1px solid #e6c200;
      padding: 8px 12px; margin: -24px -24px 16px -24px; font-size: 10pt;
      color: #5a4a00;
    }
    .toolbar b { color: #2a2200; }
    @media print { .toolbar { display: none; } }
  `;

  const escape = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let toc = `<div class="toc"><h2>Contents</h2>`;
  for (const track of tracks) {
    const tl = fullLessons.filter(l => l.track === track.id);
    toc += `<h2>${escape(track.label)} <span style="color:#888;font-weight:400;font-size:10pt;">· ${tl.length} lessons</span></h2><ul>`;
    const sections = [...new Set(tl.map(l => l.section))];
    for (const sec of sections) {
      const lessons = tl.filter(l => l.section === sec);
      toc += `<li><b>${escape(sec)}</b> — ${lessons.map(l => escape(l.title)).join(' · ')}</li>`;
    }
    toc += `</ul>`;
  }
  toc += `</div>`;

  let body = '';
  let isFirst = true;
  for (const track of tracks) {
    const tl = fullLessons.filter(l => l.track === track.id);
    body += `<div class="track-wrap${isFirst ? ' first' : ''}"><h1 class="track">${escape(track.label)}</h1>`;
    isFirst = false;
    const sections = [...new Set(tl.map(l => l.section))];
    for (const sec of sections) {
      body += `<h2 class="section">${escape(sec)}</h2>`;
      const lessons = tl.filter(l => l.section === sec);
      for (const lesson of lessons) {
        const c = CONTENT[lesson.id];
        if (!c) continue;
        body += `<h3 class="lesson">${escape(lesson.title)}</h3>`;
        if (c.description) body += `<div class="desc">${escape(c.description)}</div>`;
        const code = (c.reference && c.reference.code) || '';
        body += `<pre class="code">${escape(code)}</pre>`;
        if (c.reference && c.reference.notes && c.reference.notes.length) {
          body += `<ul class="notes">`;
          for (const n of c.reference.notes) body += `<li>${escape(n)}</li>`;
          body += `</ul>`;
        }
      }
    }
    body += `</div>`;
  }

  // Toolbar (visible on screen, hidden on print) tells the user what to do next.
  // The print dialog is auto-triggered by the opener; the toolbar is a fallback
  // for users who dismiss the dialog and want to re-trigger it.
  const toolbar = `<div class="toolbar">
    <b>To save to your phone:</b> use your browser's Share / Print menu, then
    pick <b>Save to Files</b>, <b>Save as PDF</b>, or <b>Books</b>.
    Or press <b>⌘P / Ctrl-P</b>. (This bar is hidden in the saved PDF.)
  </div>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>JS Drill Cheatsheet — ${total} lessons · ${date}</title>
<style>${css}</style>
</head><body>
${toolbar}
<h1 class="cover">JS Interview Cheatsheet</h1>
<div class="cover-sub">${total} lessons across syntax fundamentals, canonical interview patterns, and applied problems. Generated ${date} from the JS Drill app.</div>
${toc}
${body}
</body></html>`;
}

// Opens a new window with the printable cheatsheet HTML and auto-triggers the
// native print dialog. CRITICAL: window.open MUST be called synchronously in
// the click handler before any await — iOS Safari (and most popup blockers)
// require a direct user-gesture-origin for window.open. `_buildPrintable...`
// reads from already-loaded CURRICULUM + CONTENT so it's synchronous even
// though the cheatsheet modal preloads via `ensureAllContentLoaded()`.
function exportCheatsheetToPdf() {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Allow popups to save the cheatsheet as a PDF.\n\nOr: copy the cheatsheet markdown via Cheatsheet → … (manual workaround).');
    return;
  }
  // Quick placeholder so iOS doesn't show a blank tab during HTML build.
  try {
    win.document.write('<!doctype html><meta charset="utf-8"><title>JS Drill Cheatsheet</title><body style="font-family:sans-serif;padding:24px;color:#333"><p>Generating cheatsheet PDF… <small>(takes a second)</small></p></body>');
  } catch (_) { /* ignore — some browsers buffer this */ }

  // Build the real HTML. CURRICULUM/CONTENT are already loaded because the
  // cheatsheet modal preloaded them; if not, lessons without content simply
  // skip in the iterator (graceful degradation).
  const html = _buildPrintableCheatsheetHtml();

  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch (e) {
    console.error('Cheatsheet PDF write failed:', e);
    return;
  }

  // Give the new window a beat to lay out, then fire print().
  // 600ms is conservative — content is ~150 lessons, mostly text + small <pre>.
  // Wrapped in try/catch because some browsers throw if the window is closed
  // before print fires.
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch (_) { /* user closed the tab or popup blocked print */ }
  }, 600);
}

function dailyPlan() {
  // Returns an ordered, deduped list of lesson IDs to tackle next:
  //   1. Up to 3 due-for-review (retention beats new content)
  //   2. Up to 1 top weak-spot (an active misconception is more actionable
  //      than the next-in-path; surface BEFORE path so dedup promotes the
  //      "weak spot" label when a lesson is in both buckets)
  //   3. Up to 2 next-in-starter-path that are not mastered
  const seen = new Set();
  const plan = [];
  const add = (id, why) => {
    if (id && !seen.has(id)) { seen.add(id); plan.push({ id, why }); }
  };
  for (const id of dueReviewIds().slice(0, 3)) add(id, 'review due');
  add(topWeakLessonId(), 'weak spot');
  let added = 0;
  for (const id of getActiveStarterPath()) {
    if (added >= 2) break;
    const l = findLesson(id);
    if (!l || l.status !== 'full') continue;
    if (lessonOverallStatus(id) !== 'mastered' && !seen.has(id)) {
      add(id, 'next on path');
      added++;
    }
  }
  return plan;
}
function startMockInterview(lessonId) {
  if (state.mock.tickHandle) { clearInterval(state.mock.tickHandle); state.mock.tickHandle = null; }
  state.mock.active = true;
  state.mock.startTime = Date.now();
  state.mock.lessonId = lessonId;
  state.currentLessonId = lessonId;
  state.currentTab = 'L3';
  syncBinderToLesson(lessonId);
  renderSidebar();
  renderLesson();
  state.mock.tickHandle = setInterval(() => {
    const el = document.getElementById('mock-timer');
    if (el) el.textContent = formatTime(Date.now() - state.mock.startTime);
  }, 250);
}
function endMockInterview(passed) {
  if (!state.mock.active) return;
  const elapsed = Date.now() - state.mock.startTime;
  const lessonId = state.mock.lessonId;
  if (state.mock.tickHandle) { clearInterval(state.mock.tickHandle); state.mock.tickHandle = null; }
  state.mock.active = false;
  if (passed && lessonId) {
    // Append to the rolling history — sequence reveals trend (improving /
    // plateaued / regressing), not just the single PB.
    state.mockHistory[lessonId] = state.mockHistory[lessonId] || [];
    state.mockHistory[lessonId].push(elapsed);
    if (state.mockHistory[lessonId].length > MOCK_HISTORY_MAX) {
      state.mockHistory[lessonId] = state.mockHistory[lessonId].slice(-MOCK_HISTORY_MAX);
    }
    const prevBest = state.bestTimes[lessonId];
    if (!prevBest || elapsed < prevBest) {
      state.bestTimes[lessonId] = elapsed;
    }
    saveProgress();
  }
  renderLesson();
  return elapsed;
}
function startRandomMockInterview() {
  const patternLessons = CURRICULUM.filter(l => l.status === 'full' && l.track === 'patterns');
  if (!patternLessons.length) {
    alert('Author some pattern lessons first.');
    return;
  }
  const pick = patternLessons[Math.floor(Math.random() * patternLessons.length)];
  startMockInterview(pick.id);
}
function starterPathNextId() {
  // First lesson in the active (track-scoped) starter path that is full
  // but not yet mastered.
  for (const id of getActiveStarterPath()) {
    const lesson = findLesson(id);
    if (!lesson || lesson.status !== 'full') continue;
    if (lessonOverallStatus(id) !== 'mastered') return id;
  }
  return null;
}
function markPassed(lessonId, level) {
  state.progress[lessonId] = state.progress[lessonId] || {};
  const wasMastered = lessonOverallStatus(lessonId) === 'mastered';
  // iter 56: Reveal Replay clean-pass invariant. If the user is passing a
  // level they had previously revealed AND they didn't click reveal during
  // THIS attempt, treat it as a "drilled it clean" — clear the revealed
  // flag so the ringed-green dot demotes to plain green. The dot variant
  // earned its ring because the user faked it; passing without faking it
  // again is the verb that revokes the scarlet letter.
  let clearedRevealFlag = false;
  if (
    (level === 'L2' || level === 'L3') &&
    wasRevealed(lessonId, level) &&
    !(_revealedInCurrentAttempt[lessonId] && _revealedInCurrentAttempt[lessonId][level])
  ) {
    delete state.revealed[lessonId][level];
    if (state.revealed[lessonId] && Object.keys(state.revealed[lessonId]).length === 0) {
      delete state.revealed[lessonId];
    }
    clearedRevealFlag = true;
  }
  state.progress[lessonId][level] = 'passed';
  // L3 advances the SR bucket. L2 on a due lesson holds the bucket but
  // resets dueAt — gives mobile users a way to keep the due list moving
  // without overstating their free-recall confidence.
  if (level === 'L3') {
    scheduleReview(lessonId);
  } else if (level === 'L2' && state.reviews[lessonId] && isDueForReview(lessonId)) {
    scheduleReview(lessonId, { advance: false });
  }
  appendHistory(lessonId, `${level}-pass`);
  saveProgress();
  if (!wasMastered && lessonOverallStatus(lessonId) === 'mastered') {
    state.streak += 1;
    updateStreakUI();
  }
  // Update in-place only — DO NOT re-render the lesson body.
  renderSidebar();
  if (lessonId === state.currentLessonId) updateLessonHeaderInPlace();
  updateReviewBadge();
  // iter 56: surface a transient toast when the reveal flag was cleared on
  // this clean pass, so the user understands the dot just demoted from
  // ringed-green to plain green.
  if (clearedRevealFlag) _showRevealClearedToast(lessonId, level);
  // iter 114: ☁️ Sync Onboarding — first L3 pass on a desktop user-agent
  // surfaces the one-time hint banner promoting the existing top-right
  // Sync chip. _maybeShowSyncHint() guards all conditions internally so
  // calling unconditionally on every L3 pass is safe.
  if (level === 'L3' && typeof _maybeShowSyncHint === 'function') _maybeShowSyncHint();
  // iter 118: 🔥 Hot-Seat Follow-Up — opt-in post-L3-pass modal with an
  // interviewer follow-up. _maybeShowHotseat() guards all conditions
  // (toggle on, Patterns/Applied track, content loaded, mock bypass).
  if (level === 'L3' && typeof _maybeShowHotseat === 'function') _maybeShowHotseat(lessonId);
  // iter 119: ⏱ Time-to-Solve Calibration — if an estimate was made for
  // this lesson this session, record the delta against the bucket midpoint
  // per `lesson.mechanics[]` tag. _calibrationRecordPass() handles guards.
  if (level === 'L3' && typeof _calibrationRecordPass === 'function') _calibrationRecordPass(lessonId);
}
function updateReviewBadge() {
  const btn = document.getElementById('review-btn');
  const cnt = document.getElementById('review-count');
  if (btn && cnt) {
    const due = dueReviewIds().length;
    // iter 45: when path-scoped, surface BOTH the in-scope count and the total
    // so the user sees that off-scope lessons aren't disappeared — just hidden
    // from the current scope.
    const scoped = state.starterPath && state.starterPathTrack && state.starterPathTrack !== 'all';
    const totalDue = scoped ? allDueReviewIds().length : due;
    const hiddenByScope = totalDue - due;
    if (due > 0) {
      btn.classList.remove('hidden');
      cnt.textContent = due;
      btn.title = scoped && hiddenByScope > 0
        ? `Drill the lessons whose review interval is up — ${due} in ${state.starterPathTrack} path, ${hiddenByScope} more in other tracks (switch path scope to see)`
        : 'Drill the lessons whose review interval is up';
    } else if (scoped && totalDue > 0) {
      // Zero in-scope but there ARE due lessons elsewhere — keep the button visible
      // with a 0/N badge so the user knows the path scope is hiding work.
      btn.classList.remove('hidden');
      cnt.textContent = `0/${totalDue}`;
      btn.title = `0 due in ${state.starterPathTrack} path, but ${totalDue} due in other tracks. Switch path scope or toggle path off to see them.`;
    } else {
      btn.classList.add('hidden');
    }
  }
  const weakBtn = document.getElementById('weak-btn');
  const weakCnt = document.getElementById('weak-count');
  if (weakBtn) {
    const n = Object.keys(state.weakness || {}).length;
    weakBtn.classList.toggle('hidden', n === 0);
    if (weakCnt) weakCnt.textContent = n;
  }
  // iter 56: Reveal Replay button visibility + count. Mirrors the weak-btn
  // pattern — auto-hides when the queue is empty (clean state stays quiet).
  const replayBtn = document.getElementById('reveal-replay-btn');
  const replayCnt = document.getElementById('reveal-replay-count');
  if (replayBtn) {
    const q = _revealedQueue();
    replayBtn.classList.toggle('hidden', q.length === 0);
    if (replayCnt) replayCnt.textContent = q.length;
  }
  // iter 60: 📡 At Risk button visibility + count. Joins weakness ∪ revealed
  // sets (the surface includes due lessons via the row data but the button-
  // visibility gate uses the same union, since pure-due lessons are already
  // surfaced by the existing 🕒 Review badge).
  const atRiskBtn = document.getElementById('at-risk-btn');
  const atRiskCnt = document.getElementById('at-risk-count');
  if (atRiskBtn) {
    const rows = _atRiskRows(7);
    atRiskBtn.classList.toggle('hidden', rows.length === 0);
    if (atRiskCnt) atRiskCnt.textContent = rows.length;
  }
  // iter 65: 💀 Resurrect button visibility + count. Auto-hides when no
  // lesson is past 2× its SR interval.
  const resBtn = document.getElementById('resurrect-btn');
  const resCnt = document.getElementById('resurrect-count');
  if (resBtn) {
    const ids = resurrectIds();
    resBtn.classList.toggle('hidden', ids.length === 0);
    if (resCnt) resCnt.textContent = ids.length;
  }
  // iter 94: 🧠 Bridge button visibility + count. Auto-hides when MECHANIC_INDEX
  // hasn't been built yet (first paint) OR no cross-track transfer gaps exist.
  // Lazy-kicks the index build on first call so subsequent updateReviewBadge
  // calls paint the populated count.
  const bridgeBtn = document.getElementById('bridge-btn');
  const bridgeCnt = document.getElementById('bridge-count');
  if (bridgeBtn) {
    const candidates = _bridgeCandidates();
    bridgeBtn.classList.toggle('hidden', candidates.length === 0);
    if (bridgeCnt) bridgeCnt.textContent = candidates.length;
    if (!_bridgeIndexKick && (!MECHANIC_INDEX || MECHANIC_INDEX.size === 0)) {
      _bridgeIndexKick = true;
      ensureMechanicIndex().then(() => {
        // Re-run after index is populated so the badge appears without a save.
        if (typeof updateReviewBadge === 'function') updateReviewBadge();
      });
    }
  }
}
function updateLessonHeaderInPlace() {
  // Refresh tab ✓ marks and the Mastered pill without rebuilding the body.
  const lesson = findLesson(state.currentLessonId);
  if (!lesson) return;
  const overall = lessonOverallStatus(lesson.id);
  // Refresh sparkline in-place — every pass/miss appended a history event so
  // the user sees the new tick land immediately without a full re-render.
  const sparkSlot = document.querySelector('#lesson-shell [data-sparkline-slot]');
  if (sparkSlot) sparkSlot.innerHTML = renderSparkline(lesson.id);
  // Tabs: each .tab-btn — append ✓ to the label if its level passed.
  // Reads the level off data-level so the optional Conversation tab doesn't
  // shift the index zip.
  const tabs = document.querySelectorAll('#lesson-shell .tab-btn');
  tabs.forEach(btn => {
    const lv = btn.dataset.level;
    if (lv !== 'L1' && lv !== 'L2' && lv !== 'L3') return;
    const passed = levelStatus(lesson.id, lv) === 'passed';
    const baseLabel = btn.textContent.replace(/\s*✓\s*$/, '').trim();
    btn.innerHTML = passed ? `${baseLabel} <span class="text-emerald-400 ml-1">✓</span>` : baseLabel;
  });
  // Mastered pill (header)
  const pillRow = document.querySelector('#lesson-shell .pill')?.parentElement;
  if (pillRow && overall === 'mastered' && !pillRow.querySelector('.pill-mastered')) {
    const m = document.createElement('span');
    m.className = 'pill pill-mastered ml-2';
    m.textContent = '✓ Mastered';
    pillRow.appendChild(m);
  }
  // Next-CTA row — when the lesson transitions to mastered we want the same
  // "Review N due →" / "Next lesson →" affordance that renderLesson already
  // injects on subsequent visits. Without this, the user passes L3 for the
  // first time and is stranded in the main view (the right next action is
  // only reachable via the sidebar drawer). Same logic as renderLesson's
  // nextCta block; if a row is already present we leave it alone.
  if (overall === 'mastered' && pillRow) {
    const headerDiv = pillRow.closest('div.mb-6');
    if (headerDiv && !headerDiv.querySelector('[data-cta-row]')) {
      const nextId = nextLessonId(lesson.id);
      const nextLessonObj = nextId ? findLesson(nextId) : null;
      const due = dueReviewIds();
      let ctaHtml = '';
      if (due.length > 0) {
        const secondary = nextLessonObj
          ? `<button class="secondary" data-action="goto-next">Next: ${escapeHtml(nextLessonObj.title)}</button>`
          : '';
        ctaHtml = `<div class="mt-3 flex items-center gap-2 flex-wrap" data-cta-row>
          <button class="primary" data-action="goto-due-review">🕒 Review ${due.length} due →</button>
          ${secondary}
          <button class="secondary" data-action="shuffle-here">🎲 Shuffle</button>
        </div>`;
      } else if (nextLessonObj) {
        ctaHtml = `<div class="mt-3 flex items-center gap-2" data-cta-row>
          <button class="primary" data-action="goto-next">Next lesson: ${escapeHtml(nextLessonObj.title)} →</button>
          <button class="secondary" data-action="shuffle-here">🎲 Shuffle review</button>
        </div>`;
      }
      if (ctaHtml) {
        const wrap = document.createElement('div');
        wrap.innerHTML = ctaHtml;
        const ctaEl = wrap.firstElementChild;
        headerDiv.appendChild(ctaEl);
        ctaEl.querySelector('[data-action="goto-next"]')?.addEventListener('click', () => { if (nextId) selectLesson(nextId); });
        ctaEl.querySelector('[data-action="goto-due-review"]')?.addEventListener('click', () => { document.getElementById('review-btn')?.click(); });
        ctaEl.querySelector('[data-action="shuffle-here"]')?.addEventListener('click', () => { const r = pickShuffleReview(); if (r) selectLesson(r); });
      }
    }
  }
}
function updateStreakUI() {
  const el = document.getElementById('streak-display');
  const cnt = document.getElementById('streak-count');
  if (!el || !cnt) return;
  if (state.streak > 0) {
    el.classList.remove('hidden');
    cnt.textContent = state.streak;
  } else {
    el.classList.add('hidden');
  }
}
function nextLessonId(currentId) {
  // Return the next fully-authored lesson id after currentId, wrapping if needed.
  const fullList = CURRICULUM.filter(l => l.status === 'full');
  const idx = fullList.findIndex(l => l.id === currentId);
  if (idx === -1 || fullList.length <= 1) return null;
  return fullList[(idx + 1) % fullList.length].id;
}
function prevLessonId(currentId) {
  const fullList = CURRICULUM.filter(l => l.status === 'full');
  const idx = fullList.findIndex(l => l.id === currentId);
  if (idx === -1 || fullList.length <= 1) return null;
  return fullList[(idx - 1 + fullList.length) % fullList.length].id;
}
function pickShuffleReview() {
  // Random mastered lesson (for retention review). Falls back to any authored lesson.
  const mastered = CURRICULUM.filter(l => l.status === 'full' && lessonOverallStatus(l.id) === 'mastered');
  const pool = mastered.length ? mastered : CURRICULUM.filter(l => l.status === 'full');
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}
// iter 108: 🍀 Lucky — random not-yet-fully-mastered authored lesson.
// Decision-fatigue antidote for the open-app-and-freeze moment; pool is the
// complement of pickShuffleReview's (unmastered, not mastered). Falls back to
// any authored lesson when 0 unmastered exist (mastered everything — rare).
function pickLuckyUnmastered() {
  const unmastered = CURRICULUM.filter(l =>
    l.status === 'full' && lessonOverallStatus(l.id) !== 'mastered'
  );
  const pool = unmastered.length ? unmastered : CURRICULUM.filter(l => l.status === 'full');
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}
function levelStatus(lessonId, level) {
  return state.progress?.[lessonId]?.[level] || 'not_started';
}
function lessonOverallStatus(lessonId) {
  const lesson = findLesson(lessonId);
  if (!lesson || lesson.status === 'stub') return 'stub';
  const p = state.progress[lessonId];
  if (!p) return 'not_started';
  const passed = ['L1','L2','L3'].filter(l => p[l] === 'passed').length;
  if (passed === 3) return 'mastered';
  if (passed > 0) return 'in_progress';
  return 'not_started';
}
function findLesson(id) { return CURRICULUM.find(l => l.id === id); }
// Centralized helper — call this whenever code sets state.currentLessonId
// directly (selectLesson, mock interview, review jump, weak-spot jump, init
// resume). Keeps the binder tab in sync with whichever lesson the user is on.
function syncBinderToLesson(id) {
  const l = findLesson(id);
  if (l && (l.track === 'syntax' || l.track === 'patterns' || l.track === 'applied')) {
    state.sidebarTrack = l.track;
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  SIDEBAR RENDER
// ──────────────────────────────────────────────────────────────────────────

// Re-renders the vertical binder tab strip. Counts reflect the *full*
// curriculum per track — they don't react to search / focus / starter-path
// filters, so a user can always see how many lessons each binder holds.
function renderBinderTabs(tracks) {
  const host = document.getElementById('binder-tabs');
  if (!host) return;
  host.innerHTML = '';
  for (const track of tracks) {
    const total = CURRICULUM.filter(l => l.track === track.id).length;
    const tab = document.createElement('div');
    tab.className = 'binder-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('tabindex', '0');
    tab.setAttribute('aria-selected', state.sidebarTrack === track.id ? 'true' : 'false');
    tab.setAttribute('aria-label', `${track.label} (${total} lessons)`);
    if (state.sidebarTrack === track.id) tab.classList.add('active');
    const labelSpan = document.createElement('span');
    labelSpan.textContent = track.label;
    tab.appendChild(labelSpan);
    const countSpan = document.createElement('span');
    countSpan.className = 'binder-tab-count';
    countSpan.textContent = String(total);
    tab.appendChild(countSpan);
    const switchTo = () => {
      if (state.sidebarTrack === track.id) return;
      state.sidebarTrack = track.id;
      saveProgress();
      renderSidebar();
    };
    tab.addEventListener('click', switchTo);
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchTo(); }
    });
    host.appendChild(tab);
  }
}

function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';
  const q = state.searchQuery.trim().toLowerCase();
  const matches = (lesson) => {
    if (!q) return true;
    return lesson.title.toLowerCase().includes(q)
        || lesson.section.toLowerCase().includes(q)
        || lesson.id.toLowerCase().includes(q);
  };
  const activeStarter = getActiveStarterPath();
  const inStarter = (lesson) => !state.starterPath || activeStarter.includes(lesson.id);
  const starterIndex = (id) => activeStarter.indexOf(id) + 1;  // 1-based for display
  const hideMasteredOk = (lesson) => {
    if (!state.hideMastered) return true;
    // Always keep due-for-review items even in focus mode.
    if (isDueForReview(lesson.id)) return true;
    return lessonOverallStatus(lesson.id) !== 'mastered';
  };

  // Reflect the Path View toggle on the button itself. The button filters the
  // sidebar to whichever path the user is subscribed to (see PATHS registry).
  // If the subscribed path has no drill-lesson sequence, the button is visible
  // but disabled — there's nothing to filter to.
  const pathBtn = document.getElementById('path-btn');
  if (pathBtn) {
    const hasLessons = subscribedPathHasLessons();
    // Auto-clear a stale active filter if we somehow ended up on a path with
    // no lessons (e.g. switched paths while the filter was on).
    if (!hasLessons && state.starterPath) state.starterPath = false;
    pathBtn.disabled = !hasLessons;
    pathBtn.style.opacity = hasLessons ? '' : '0.4';
    pathBtn.style.cursor = hasLessons ? '' : 'not-allowed';
    pathBtn.title = hasLessons
      ? 'Filter the sidebar to your current study plan’s lessons, in order'
      : 'Your current study plan has no drillable lesson sequence to filter to';
    pathBtn.classList.toggle('text-blue-300', state.starterPath && hasLessons);
    pathBtn.classList.toggle('text-slate-500', !(state.starterPath && hasLessons));
    // Show "🧭 Path View · Syn" etc. when a track sub-filter is selected, so the
    // user always sees which scope is active without opening the chip row.
    if (state.starterPath && state.starterPathTrack && state.starterPathTrack !== 'all') {
      const shortLabel = state.starterPathTrack[0].toUpperCase() + state.starterPathTrack.slice(1, 3);
      pathBtn.textContent = '🧭 Path View · ' + shortLabel;
    } else {
      pathBtn.textContent = '🧭 Path View';
    }
  }

  const tracks = [
    { id: 'syntax',   label: 'Syntax Fundamentals' },
    { id: 'patterns', label: 'Canonical Patterns' },
    { id: 'applied',  label: 'Applied Problems' }
  ];

  // Render the binder tab strip (independent of which lessons are visible).
  renderBinderTabs(tracks);

  // When Path View is on, surface a track-picker chip row above the lesson
  // list. Lets the user scope the active path to one track (Syntax-only,
  // Patterns-only, Applied-only) or keep "All". No new authoring — the active
  // path is just the subscribed path's lessonOrder filtered by the picked track.
  if (state.starterPath) {
    const pathBase = getPathLessonOrder(getSubscribedPath()) || [];
    const trackRow = document.createElement('div');
    trackRow.className = 'path-track-row';
    const choices = [
      { id: 'all', label: 'All' },
      { id: 'syntax', label: 'Syntax' },
      { id: 'patterns', label: 'Patterns' },
      { id: 'applied', label: 'Applied' }
    ];
    const cur = state.starterPathTrack || 'all';
    trackRow.innerHTML = choices.map(c => {
      const count = c.id === 'all'
        ? pathBase.length
        : pathBase.filter(id => {
            const l = findLesson(id);
            return l && l.track === c.id;
          }).length;
      const active = cur === c.id ? ' active' : '';
      const disabled = count === 0 ? ' disabled' : '';
      return `<button class="path-track-chip${active}${disabled}" data-track="${c.id}" ${count === 0 ? 'disabled' : ''} title="${count} lessons in this track-path">${c.label} <span class="path-track-count">${count}</span></button>`;
    }).join('');
    trackRow.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-track]');
      if (!btn || btn.disabled) return;
      const newTrack = btn.dataset.track;
      if (newTrack === state.starterPathTrack) return;
      state.starterPathTrack = newTrack;
      _invalidateStarterPathCache();
      saveProgress();
      // iter 45: review badge depends on path scope — refresh after track change.
      updateReviewBadge();
      // If current lesson is no longer in the new track-path, jump to next un-mastered.
      if (!getActiveStarterPath().includes(state.currentLessonId)) {
        const next = starterPathNextId();
        if (next) { selectLesson(next); return; }
      }
      renderSidebar();
      if (state.currentLessonId) renderLesson();
    });
    nav.appendChild(trackRow);
  }

  // Search overrides the binder filter — if the user is searching, show
  // matches across all tracks (and auto-switch the active tab if the active
  // one has zero hits but another has some). Otherwise filter by active.
  const tracksToRender = (() => {
    if (!q) return tracks.filter(t => t.id === state.sidebarTrack);
    // Searching — count matches per track
    const counts = Object.fromEntries(tracks.map(t => [t.id,
      CURRICULUM.filter(l => l.track === t.id && matches(l) && inStarter(l) && hideMasteredOk(l)).length
    ]));
    const activeHas = counts[state.sidebarTrack] > 0;
    if (!activeHas) {
      // Auto-flip to the first other track with matches.
      const other = tracks.find(t => t.id !== state.sidebarTrack && counts[t.id] > 0);
      if (other) {
        state.sidebarTrack = other.id;
        saveProgress();
        renderBinderTabs(tracks);
      }
    }
    return tracks.filter(t => t.id === state.sidebarTrack);
  })();

  let visibleCount = 0;
  for (const track of tracksToRender) {
    let lessons = CURRICULUM.filter(l => l.track === track.id && matches(l) && inStarter(l) && hideMasteredOk(l));
    if (!lessons.length) continue;

    // In path mode, sort by active-path index so the visible step numbers
    // read monotonically top-to-bottom. Sections then appear in the order
    // of their first path-step (because `[...new Set(...)]` preserves
    // first-occurrence order). Without this, HASH STRUCTURES could read
    // "22, 20, 21" because intra-section order tracks manifest order, not
    // path order. Non-path mode is unaffected.
    if (state.starterPath) {
      lessons = [...lessons].sort((a, b) =>
        activeStarter.indexOf(a.id) - activeStarter.indexOf(b.id));
    }

    const sections = [...new Set(lessons.map(l => l.section))];
    for (const section of sections) {
      const sectionLessons = lessons.filter(l => l.section === section);
      // iter 40: per-section mastery progress. Counts only full (non-stub)
      // lessons in this section that are currently visible (respects path-
      // mode + search + hide-mastered filters), so the bar reflects the
      // user's view rather than the global section size. See
      // ideas-by-category.md § Metacognition & Visibility → "Section-level
      // progress bar in sidebar".
      const fullCount = sectionLessons.filter(l => l.status === 'full').length;
      const masteredCount = sectionLessons.filter(l =>
        l.status === 'full' && lessonOverallStatus(l.id) === 'mastered'
      ).length;
      const pct = fullCount === 0 ? 0 : Math.round((masteredCount / fullCount) * 100);

      const secEl = document.createElement('div');
      secEl.className = 'section-header';
      if (fullCount > 0) {
        secEl.innerHTML = `
          <span class="section-title">${escapeHtml(section)}</span>
          <span class="section-progress" title="${masteredCount} of ${fullCount} mastered (${pct}%)">
            <span class="section-progress-bar"><span class="section-progress-fill" style="width:${pct}%"></span></span>
            <span class="section-progress-count">${masteredCount}/${fullCount}</span>
          </span>
        `;
      } else {
        secEl.textContent = section;
      }
      nav.appendChild(secEl);

      for (const lesson of sectionLessons) {
        visibleCount++;
        const link = document.createElement('div');
        const overall = lessonOverallStatus(lesson.id);
        link.className = 'lesson-link';
        // Test affordance — also makes future skills cleaner.
        link.setAttribute('data-lesson-id', lesson.id);
        if (lesson.status === 'stub') link.classList.add('stub');
        if (state.currentLessonId === lesson.id) link.classList.add('active');

        const dot = document.createElement('span');
        dot.className = 'dot';
        if (overall === 'mastered') {
          dot.classList.add('mastered');
          if (wasRevealed(lesson.id, 'L2') || wasRevealed(lesson.id, 'L3')) {
            dot.classList.add('revealed');
            dot.title = 'Mastered with a reveal — retry from scratch to clear';
          }
          if (isDueForReview(lesson.id)) {
            dot.classList.add('due');
            dot.title = `Due for review (${formatDueRelative(lesson.id)})`;
          }
        }
        if (overall === 'in_progress') dot.classList.add('in-progress');
        if (overall === 'stub')        dot.classList.add('stub');
        link.appendChild(dot);

        const label = document.createElement('span');
        label.className = 'lesson-label';
        if (state.starterPath) {
          const num = starterIndex(lesson.id);
          label.innerHTML = `<span class="text-slate-500 text-xs mr-1">${num}.</span>${escapeHtml(lesson.title)}`;
        } else {
          label.textContent = lesson.title;
        }
        link.appendChild(label);

        if (lesson.status === 'full') {
          link.addEventListener('click', () => selectLesson(lesson.id));
        }
        nav.appendChild(link);
      }
    }
  }

  if (visibleCount === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-xs text-slate-500 px-3 py-6 text-center';
    empty.textContent = state.searchQuery
      ? 'No lessons match “' + state.searchQuery + '”.'
      : 'No lessons in this track yet.';
    nav.appendChild(empty);
  }

  // progress summary
  const fullLessons = CURRICULUM.filter(l => l.status === 'full');
  const mastered = fullLessons.filter(l => lessonOverallStatus(l.id) === 'mastered').length;
  document.getElementById('progress-summary').textContent = `${mastered} / ${fullLessons.length} lessons mastered`;
  const pct = Math.round((mastered / fullLessons.length) * 100);
  document.getElementById('progress-pct').textContent = pct + '%';
  document.getElementById('progress-bar').style.width = pct + '%';
}

// ──────────────────────────────────────────────────────────────────────────
//  MAIN LESSON RENDER
// ──────────────────────────────────────────────────────────────────────────
// URL deep-linking. Hash format: #/<lesson-id>/<tab>
// Tab is optional; if absent, the lesson resolves to its default tab.
// `history.replaceState` is used to update the URL on selectLesson/selectTab
// so the URL stays shareable but doesn't pollute browser history with one
// entry per tap. `hashchange` (fired on back/forward and paste) re-routes
// via selectLesson + selectTab. See ideas-by-category.md § UI/UX Experience
// → "URL deep linking" entry.
const _VALID_TABS = new Set(['conversation', 'walkthrough', 'reference', 'L1', 'L2', 'L3']);

function _parseHash() {
  const raw = (window.location.hash || '').replace(/^#\/?/, '');
  if (!raw) return null;
  const parts = raw.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  let lessonId;
  try { lessonId = decodeURIComponent(parts[0]); } catch (_) { return null; }
  const tab = parts[1] && _VALID_TABS.has(parts[1]) ? parts[1] : null;
  return { lessonId, tab };
}

function _updateHash() {
  if (!state.currentLessonId) return;
  let h = '#/' + encodeURIComponent(state.currentLessonId);
  if (state.currentTab && state.currentTab !== 'auto' && _VALID_TABS.has(state.currentTab)) {
    h += '/' + state.currentTab;
  }
  if (window.location.hash !== h) {
    try { history.replaceState(null, '', h); } catch (_) { window.location.hash = h; }
  }
}

// hashchange fires for back/forward navigation, pasted URLs, and manual
// hash edits — NOT for replaceState (which we use internally). So this
// listener handles only external URL changes; no infinite-loop risk.
function _handleHashChange() {
  const parsed = _parseHash();
  if (!parsed) return;
  const lesson = findLesson(parsed.lessonId);
  if (!lesson || lesson.status !== 'full') return;
  if (state.currentLessonId !== parsed.lessonId) {
    selectLesson(parsed.lessonId);
  }
  if (parsed.tab && state.currentTab !== parsed.tab) {
    selectTab(parsed.tab);
  }
}

function selectLesson(id) {
  // If the user navigates away from a live mock interview, end it cleanly
  // (don't record best time — they bailed). Otherwise the tickHandle leaks
  // and bestTimes never settles.
  if (state.mock.active && state.mock.lessonId !== id) {
    endMockInterview(false);
  }
  // Drop in-flight per-tab cache for the lesson we're leaving — switching
  // lessons (vs. switching tabs within the same lesson) is when a fresh
  // start makes sense. See BS-12 + inProgressCache.
  if (state.currentLessonId && state.currentLessonId !== id) {
    _cacheClearLesson(state.currentLessonId);
    // iter 56: also drop the leaving lesson's reveal-this-attempt tracker so
    // the next visit starts a fresh attempt window for clean-pass detection.
    delete _revealedInCurrentAttempt[state.currentLessonId];
  }
  state.currentLessonId = id;
  // Sentinel — renderLesson resolves this to the first available tab once
  // content is loaded (Conversation if the lesson has one, otherwise
  // Reference). Keeps the default-tab decision in one place even though
  // content load is async.
  state.currentTab = 'auto';
  // Keep the binder tab in sync — the chosen lesson may belong to the
  // other track (shuffle / mock / review-button paths can pick freely).
  syncBinderToLesson(id);
  saveProgress();
  renderSidebar();
  renderLesson();
  _updateHash();
  if (window.matchMedia('(max-width: 767px)').matches) {
    document.body.classList.remove('sidebar-open');
  }
}
function selectTab(tab) {
  state.currentTab = tab;
  saveProgress();
  renderLesson();
  _updateHash();
}

function renderLesson() {
  const shell = document.getElementById('lesson-shell');
  shell.innerHTML = '';
  document.body.classList.remove('l2-mobile-active');
  if (typeof updateCramProgressStrip === 'function') updateCramProgressStrip();
  if (!state.currentLessonId) {
    const subbed = typeof getSubscribedPath === 'function' ? getSubscribedPath() : null;
    if (subbed && subbed.kind === 'cram' && Array.isArray(subbed.days) && subbed.days.length) {
      renderCramHome(subbed);
      return;
    }
    renderEmpty(shell);
    return;
  }

  const lesson = findLesson(state.currentLessonId);
  if (!lesson || lesson.status === 'stub') { renderEmpty(shell); return; }
  const content = CONTENT[lesson.id];
  if (!content) {
    // Cache miss — kick off fetch and re-render when it lands. Race-safe:
    // if the user navigates away before this resolves, we drop the result.
    shell.innerHTML = '<div class="text-slate-500 text-sm p-8 text-center">Loading…</div>';
    loadLessonContent(lesson.id).then(() => {
      if (state.currentLessonId === lesson.id) renderLesson();
    }).catch(err => {
      shell.innerHTML = '<div class="p-6 text-red-300 text-sm">Could not load lesson: ' + (err && err.message ? err.message : err) + '</div>';
    });
    return;
  }

  // First-time welcome — the path picker modal becomes the welcome surface
  // (auto-opened once, exposes Starter / Cram / Diagnostic / Browse-on-own).
  // The picker drives `state.welcomed` so the next renderLesson won't reopen it.
  if (!state.welcomed && Object.keys(state.progress).length === 0) {
    setTimeout(() => { if (!state.welcomed) openPathModal({ welcome: true }); }, 0);
  }

  // header
  const header = document.createElement('div');
  header.className = 'mb-6';
  const trackPill = TRACK_PILLS[lesson.track] || TRACK_PILLS.patterns;
  const pill = trackPill.cls;
  const pillText = trackPill.label;
  const overall = lessonOverallStatus(lesson.id);
  const masteredPill = overall === 'mastered' ? `<span class="pill pill-mastered ml-2">✓ Mastered</span>` : '';
  // Starter-path step indicator — shown only when path mode is on AND this
  // lesson is part of the path. The sidebar shows step numbers per-lesson
  // but they group by section, so 22 / 20 / 21 can appear adjacent —
  // confusing. The header pill gives the user a stable "Step N of M"
  // anchor in the main viewport.
  const _activePath = state.starterPath ? getActiveStarterPath() : null;
  const pathIdx = _activePath ? _activePath.indexOf(lesson.id) + 1 : 0;
  const _trackLabel = state.starterPath && state.starterPathTrack && state.starterPathTrack !== 'all'
    ? ' (' + state.starterPathTrack[0].toUpperCase() + state.starterPathTrack.slice(1) + ')' : '';
  const _pathName = getSubscribedPath().label;
  const pathPill = pathIdx > 0
    ? `<span class="pill pill-path ml-2" title="${escapeHtml(_pathName)} step ${pathIdx} of ${_activePath.length}${_trackLabel}">🧭 Step ${pathIdx} of ${_activePath.length}${_trackLabel}</span>`
    : '';
  const nextId = nextLessonId(lesson.id);
  const nextLessonObj = nextId ? findLesson(nextId) : null;
  // On a mastered lesson, surface the highest-priority next action:
  //   - Due reviews exist → primary becomes "🕒 Review N due", which jumps
  //     to the most-overdue lesson via the same path as the sidebar Review
  //     button (device-calibrated tab routing). The "Next lesson" choice
  //     drops to secondary. Retention beats new content per dailyPlan.
  //   - No due reviews → keep the original "Next lesson" primary.
  // The sidebar Review CTA is invisible on mobile (behind the drawer);
  // this surface puts the same action in the main viewport.
  const dueDuringMastered = (overall === 'mastered') ? dueReviewIds() : [];
  let nextCta = '';
  if (overall === 'mastered' && dueDuringMastered.length > 0) {
    const reviewLabel = `🕒 Review ${dueDuringMastered.length} due →`;
    const secondary = nextLessonObj
      ? `<button class="secondary" data-action="goto-next">Next: ${escapeHtml(nextLessonObj.title)}</button>`
      : '';
    nextCta = `<div class="mt-3 flex items-center gap-2 flex-wrap" data-cta-row><button class="primary" data-action="goto-due-review">${reviewLabel}</button>${secondary}<button class="secondary" data-action="shuffle-here">🎲 Shuffle</button></div>`;
  } else if (overall === 'mastered' && nextLessonObj) {
    nextCta = `<div class="mt-3 flex items-center gap-2" data-cta-row><button class="primary" data-action="goto-next">Next lesson: ${escapeHtml(nextLessonObj.title)} →</button><button class="secondary" data-action="shuffle-here">🎲 Shuffle review</button></div>`;
  }
  header.innerHTML = `
    <div class="flex items-center justify-between gap-3 mb-1">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="pill ${pill}">${pillText}</span>
        <span class="text-xs text-slate-500">${escapeHtml(lesson.section)}</span>
        ${masteredPill}
        ${pathPill}
      </div>
      <div class="flex items-center gap-1 text-slate-500 text-xs">
        <button class="hover:text-slate-300 px-1" data-action="prev-lesson" title="Previous (k)">◀</button>
        <button class="hover:text-slate-300 px-1" data-action="next-lesson" title="Next (j)">▶</button>
      </div>
    </div>
    <h2 class="text-2xl font-bold text-white">${escapeHtml(lesson.title)}</h2>
    <p class="text-slate-400 mt-1 text-sm">${escapeHtml(content.description)}</p>
    <div data-sparkline-slot class="mt-1">${renderSparkline(lesson.id)}</div>
    ${nextCta}
  `;
  shell.appendChild(header);
  header.querySelector('[data-action="prev-lesson"]').addEventListener('click', () => { const p = prevLessonId(lesson.id); if (p) selectLesson(p); });
  header.querySelector('[data-action="next-lesson"]').addEventListener('click', () => { const n = nextLessonId(lesson.id); if (n) selectLesson(n); });
  const nextBtn = header.querySelector('[data-action="goto-next"]');
  if (nextBtn) nextBtn.addEventListener('click', () => selectLesson(nextId));
  // "Review N due" — jump to the top due lesson via the same sidebar-button
  // click handler so device-calibrated tab routing (L2 on coarse, L3 on
  // fine) stays consistent across surfaces.
  const dueBtn = header.querySelector('[data-action="goto-due-review"]');
  if (dueBtn) dueBtn.addEventListener('click', () => {
    document.getElementById('review-btn')?.click();
  });
  const shuffleHere = header.querySelector('[data-action="shuffle-here"]');
  if (shuffleHere) shuffleHere.addEventListener('click', () => { const r = pickShuffleReview(); if (r) selectLesson(r); });

  // tabs
  const tabs = document.createElement('div');
  // overflow-x-auto so the 5-tab row (Conversation + Ref + L1 + L2 + L3)
  // stays reachable on a phone — last tab scrolls into view instead of
  // getting cropped behind the viewport edge.
  tabs.className = 'flex border-b border-slate-800 mb-6 overflow-x-auto';
  const tabDefs = [];
  // Conversation tab is opt-in per lesson — only Patterns/Applied lessons that
  // ship an `conversation` block (the interview walk-through) get it. Sits
  // first so the user starts in "how would I diagnose this" mode before
  // looking at the canonical solution.
  if (content.conversation) {
    tabDefs.push({ id: 'conversation', label: 'Conversation', status: null });
  }
  // Walkthrough — interactive line-by-line stepper (Jupyter-style). Sits
  // between Conversation and Reference: you diagnose (Conversation), then
  // watch the canonical execute (Walkthrough), then study the polished form
  // (Reference), then drill (L1/L2/L3).
  if (content.walkthrough) {
    tabDefs.push({ id: 'walkthrough', label: 'Walkthrough', status: null });
  }
  tabDefs.push(
    { id: 'reference', label: 'Reference',     status: null },
    { id: 'L1',        label: 'L1 — Concept',  status: levelStatus(lesson.id, 'L1') },
    { id: 'L2',        label: 'L2 — Fill-in',  status: levelStatus(lesson.id, 'L2') },
    { id: 'L3',        label: 'L3 — Drill',    status: levelStatus(lesson.id, 'L3') }
  );
  // If the current tab isn't one this lesson exposes (e.g. came from a lesson
  // that had Conversation, landed on one that doesn't), fall back to the
  // first available tab so we don't render a blank body.
  if (!tabDefs.some(t => t.id === state.currentTab)) {
    state.currentTab = tabDefs[0].id;
    // Reflect the resolved tab in the URL so the hash stays accurate even
    // when selectLesson set state.currentTab = 'auto'.
    _updateHash();
  }
  for (let i = 0; i < tabDefs.length; i++) {
    const t = tabDefs[i];
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.dataset.level = t.id;
    if (state.currentTab === t.id) btn.classList.add('active');
    // Prefix with "N. " so the keyboard shortcut (number key = Nth tab) is
    // discoverable without opening the help modal.
    const num = `<span class="text-slate-500 mr-1">${i + 1}.</span>`;
    btn.innerHTML = `${num}${t.label}${t.status === 'passed' ? ' <span class="text-emerald-400 ml-1">✓</span>' : ''}`;
    btn.addEventListener('click', () => selectTab(t.id));
    tabs.appendChild(btn);
  }
  shell.appendChild(tabs);

  // body
  const body = document.createElement('div');
  body.className = 'fade-in';
  shell.appendChild(body);

  if (state.currentTab === 'conversation') renderConversation(body, content);
  if (state.currentTab === 'walkthrough') renderWalkthrough(body, lesson, content);
  if (state.currentTab === 'reference') renderReference(body, content);
  if (state.currentTab === 'L1') renderL1(body, lesson, content);
  if (state.currentTab === 'L2') renderL2(body, lesson, content);
  if (state.currentTab === 'L3') renderL3(body, lesson, content);
}

function renderHeader() {
  // Re-render only the header section to update the mastered pill, not the whole shell.
  if (state.currentLessonId) renderLesson();
}

function renderEmpty(shell) {
  shell.innerHTML = `
    <div class="text-center py-24 text-slate-400">
      <h2 class="text-2xl font-bold text-white mb-2">Welcome to JS Drill</h2>
      <p class="max-w-md mx-auto text-sm leading-relaxed">
        Pick a lesson on the left. Read the <strong>Reference</strong>, then test recall with
        <span class="text-blue-300">L1 Concept</span>,
        <span class="text-blue-300">L2 Fill-in</span>, and
        <span class="text-blue-300">L3 Drill</span>. Greyed-out lessons are stubbed for v1.
      </p>
      <p class="text-xs text-slate-500 mt-6">Tip: press <kbd>⌘</kbd>+<kbd>↵</kbd> inside the L3 editor to run.</p>
    </div>`;
}

// ──────────────────────────────────────────────────────────────────────────
//  REFERENCE TAB
// ──────────────────────────────────────────────────────────────────────────
// Static-syntax-highlighter — reuses CodeMirror's JS tokenizer + Dracula
// theme. Appends colored <span class="cm-…"> nodes into `target`, which must
// sit under a `.cm-s-dracula` ancestor for the colors to apply.
// ──────────────────────────────────────────────────────────────────────────
//  CONVERSATION TAB — interview walk-through for Patterns/Applied lessons
// ──────────────────────────────────────────────────────────────────────────
// Each section is collapsed by default. The title + prompt stay visible
// (skim-able on mobile), and tapping expands the body. Uses native <details>
// so there's no JS state to manage and accessibility / keyboard nav is free.
function renderConversation(body, content) {
  const conv = content.conversation;
  const section = document.createElement('div');
  const intro = conv.intro
    ? `<div class="conv-intro">${escapeHtml(conv.intro)}</div>`
    : '';
  // Multi-paragraph text → escaped <p> blocks. No markdown rendering — keep
  // authoring constraints simple (just \n\n for paragraph breaks, single \n
  // for soft breaks).
  const paragraphsOf = (text) => (text || '')
    .split(/\n\s*\n/)
    .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const sectionsHtml = conv.sections.map((s) => {
    const promptHtml = s.prompt
      ? `<div class="conv-prompt">${escapeHtml(s.prompt)}</div>`
      : '';
    // Two-color body: SAY (what you'd verbalize — script voice) and WHY
    // (rationale / what it signals to the interviewer — meta voice).
    // Either field is optional; legacy `reveal` is still supported as a
    // single unified block so older content doesn't break.
    // `examples` is an optional structured trace surface — when present,
    // each entry renders as a nested <details> with input → output header
    // and a pre-formatted monospace trace body.
    const blocks = [];
    if (s.intro) {
      blocks.push(`<div class="conv-intro-inline">${paragraphsOf(s.intro)}</div>`);
    }
    if (s.say) {
      blocks.push(`<div class="conv-block conv-say">
        <div class="conv-block-label">What I'd say</div>
        <div class="conv-block-body">${paragraphsOf(s.say)}</div>
      </div>`);
    }
    if (Array.isArray(s.examples) && s.examples.length) {
      const exHtml = s.examples.map((ex) => {
        const header = `${escapeHtml(ex.input || '')}${ex.output != null ? ` <span class="conv-ex-arrow">→</span> <span class="conv-ex-out">${escapeHtml(String(ex.output))}</span>` : ''}`;
        const noteHtml = ex.note ? `<div class="conv-ex-note">${escapeHtml(ex.note)}</div>` : '';
        const traceHtml = ex.trace ? `<pre class="conv-ex-trace">${escapeHtml(ex.trace)}</pre>` : '';
        return `<details class="conv-example">
          <summary class="conv-ex-summary">
            <span class="conv-ex-header">${header}</span>
            <span class="conv-toggle" aria-hidden="true">▸</span>
          </summary>
          <div class="conv-ex-body">${noteHtml}${traceHtml}</div>
        </details>`;
      }).join('');
      blocks.push(`<div class="conv-block conv-examples-block">
        <div class="conv-block-label">Worked examples</div>
        <div class="conv-examples-list">${exHtml}</div>
      </div>`);
    }
    if (s.why) {
      blocks.push(`<div class="conv-block conv-why">
        <div class="conv-block-label">Why this matters</div>
        <div class="conv-block-body">${paragraphsOf(s.why)}</div>
      </div>`);
    }
    if (!s.say && !s.why && !s.examples && s.reveal) {
      blocks.push(`<div class="conv-block conv-legacy"><div class="conv-block-body">${paragraphsOf(s.reveal)}</div></div>`);
    }
    return `
      <details class="conv-section">
        <summary class="conv-summary">
          <span class="conv-title">${escapeHtml(s.title)}</span>
          ${promptHtml}
          <span class="conv-toggle" aria-hidden="true">▸</span>
        </summary>
        <div class="conv-body">${blocks.join('')}</div>
      </details>`;
  }).join('');
  section.innerHTML = `
    <div class="mb-2 text-xs text-slate-500 uppercase tracking-wider">Interview walk-through</div>
    ${intro}
    <div class="conv-list">${sectionsHtml}</div>
    <div class="mt-8 flex justify-end gap-2">
      <button class="secondary" data-action="conv-to-reference">See the solution →</button>
    </div>
  `;
  body.appendChild(section);
  section.querySelector('[data-action="conv-to-reference"]').addEventListener('click', () => selectTab('reference'));
}

// ──────────────────────────────────────────────────────────────────────────
//  WALKTHROUGH TAB — interactive line-by-line stepper (Jupyter-style)
// ──────────────────────────────────────────────────────────────────────────
// The lesson's `walkthrough` block defines (a) a list of example inputs and
// (b) a trace function (stored as a string of JS source — an array of lines
// joined with \n at load) that yields {line, label, state} per step. We
// `new Function`-evaluate the source, drain the generator into an array per
// example, cache it, and render: canonical code with current line highlighted
// + a state panel + prev/next/reset controls.
//
// Eval safety: lesson JSON is same-origin trusted content; we already eval
// user-typed L3 code via `new Function`. The trace function has no DOM
// access and runs purely on its `input` argument.

// Cache compiled trace functions + per-example step arrays across renders
// so re-clicking the tab doesn't re-evaluate source. Keyed by lesson id.
const _walkthroughCache = {};

function _compileWalkthrough(lessonId, walkthrough) {
  if (_walkthroughCache[lessonId]) return _walkthroughCache[lessonId];
  const src = Array.isArray(walkthrough.trace)
    ? walkthrough.trace.join('\n')
    : String(walkthrough.trace || '');
  let fn;
  try {
    fn = new Function('input', '"use strict";\n' + src + '\nreturn trace(input);');
  } catch (e) {
    return _walkthroughCache[lessonId] = { error: 'Failed to compile trace: ' + e.message };
  }
  const byExample = walkthrough.examples.map(ex => {
    try {
      const steps = [...fn(ex.input)];
      return { example: ex, steps, error: null };
    } catch (e) {
      return { example: ex, steps: [], error: 'Trace runtime error: ' + e.message };
    }
  });
  return _walkthroughCache[lessonId] = { byExample, error: null };
}

// Format a state value for the panel. Sets→[…], arrays→JSON, primitives→String.
function _formatStateVal(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return '[' + v.map(_formatStateVal).join(', ') + ']';
  if (v && typeof v === 'object') {
    try { return JSON.stringify(v); } catch (_) { return String(v); }
  }
  return String(v);
}

// Quiz-mode helper — picks a midpoint K and assembles 4 unique MC options
// from adjacent trace steps. Distractor priorities: no-advance (steps[K]),
// skip-one (steps[K+2]), regression (steps[K-1]), final, initial. Returns
// null if the trace is too short or too uniform for a meaningful quiz.
// See ideas-by-category.md § Drilling Surfaces → "What comes next?" entry.
function _pickQuizOptions(steps) {
  if (steps.length < 4) return null;
  const K = Math.max(1, Math.floor(steps.length / 2));
  const correctIdx = K + 1;
  if (correctIdx >= steps.length) return null;
  const correct = steps[correctIdx];
  const candidatePool = [
    { idx: K },
    { idx: K + 2 },
    { idx: K - 1 },
    { idx: steps.length - 1 },
    { idx: 0 },
    { idx: K + 3 },
    { idx: Math.max(0, K - 2) }
  ];
  const stepKey = s => JSON.stringify({ line: s.line, label: s.label, state: s.state });
  const seen = new Set([stepKey(correct)]);
  const distractors = [];
  for (const c of candidatePool) {
    if (c.idx === correctIdx || c.idx < 0 || c.idx >= steps.length) continue;
    const k = stepKey(steps[c.idx]);
    if (seen.has(k)) continue;
    seen.add(k);
    distractors.push({ step: steps[c.idx], idx: c.idx });
    if (distractors.length === 3) break;
  }
  if (distractors.length < 3) return null;
  const options = [
    { step: correct, idx: correctIdx, isCorrect: true },
    ...distractors.map(d => ({ step: d.step, idx: d.idx, isCorrect: false }))
  ];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { K, correctIdx, options };
}

function renderWalkthrough(body, lesson, content) {
  const w = content.walkthrough;
  const compiled = _compileWalkthrough(lesson.id, w);
  if (compiled.error) {
    body.innerHTML = `<div class="p-6 text-red-300 text-sm">${escapeHtml(compiled.error)}</div>`;
    return;
  }

  // Per-session UI state for this tab — example index + step index.
  // Kept on the global state cache so switching tabs and coming back
  // restores where you were (consistent with the L1/L2/L3 cache pattern).
  let uiState = _cacheGet(lesson.id, 'walkthrough');
  if (!uiState || typeof uiState.exampleIdx !== 'number') {
    uiState = { exampleIdx: 0, stepIdx: 0 };
    _cacheSet(lesson.id, 'walkthrough', uiState);
  }

  // Build static shell once
  const codeLines = (content.reference && content.reference.code || '').split('\n');
  const introHtml = w.intro ? `<div class="walk-intro">${escapeHtml(w.intro)}</div>` : '';
  const exOptions = w.examples.map((ex, i) =>
    `<option value="${i}" ${i === uiState.exampleIdx ? 'selected' : ''}>${escapeHtml(ex.label)}</option>`
  ).join('');

  body.innerHTML = `
    <div class="mb-2 text-xs text-slate-500 uppercase tracking-wider">Interactive walkthrough</div>
    ${introHtml}
    <div class="walk-controls">
      <label class="walk-example-label">Example
        <select class="walk-example" data-walk-example>${exOptions}</select>
      </label>
      <div class="walk-step-controls">
        <button class="walk-btn" data-walk-prev aria-label="Previous step">◀ Prev</button>
        <span class="walk-step-counter" data-walk-counter>Step 1 of N</span>
        <button class="walk-btn walk-btn-primary" data-walk-next aria-label="Next step">Next ▶</button>
        <button class="walk-btn walk-btn-ghost" data-walk-reset>Reset</button>
        <button class="walk-btn walk-btn-ghost" data-walk-quiz title="Predict the next step (active-recall mode)">🔮 Quiz</button>
        <button class="walk-btn walk-btn-ghost" data-walk-bug title="One step's state is wrong — find the bug (debug-direction drill)">🪲 Bug</button>
      </div>
    </div>
    <div class="walk-label-bar" data-walk-label>—</div>
    <div class="walk-grid">
      <div class="walk-code-pane">
        <pre class="walk-code cm-s-dracula" data-walk-code></pre>
      </div>
      <div class="walk-state-pane">
        <div class="walk-state-header">State after this step</div>
        <div class="walk-state-table" data-walk-state></div>
      </div>
    </div>
    <div class="walk-quiz hidden" data-walk-quiz-panel>
      <div class="walk-quiz-q">What's the next step?</div>
      <div class="walk-quiz-opts" data-walk-quiz-opts></div>
      <div class="walk-quiz-actions">
        <button class="walk-btn walk-btn-ghost" data-walk-quiz-close>✕ Close quiz</button>
      </div>
    </div>
    <div class="walk-bug hidden" data-walk-bug-panel>
      <div class="walk-bug-q">One step's state is corrupted. Tap the buggy step.</div>
      <div class="walk-bug-list" data-walk-bug-list></div>
      <div class="walk-bug-actions">
        <button class="walk-btn walk-btn-ghost" data-walk-bug-close>✕ Close bug-hunt</button>
      </div>
    </div>
  `;

  const codeEl = body.querySelector('[data-walk-code]');
  const stateEl = body.querySelector('[data-walk-state]');
  const labelEl = body.querySelector('[data-walk-label]');
  const counterEl = body.querySelector('[data-walk-counter]');
  const prevBtn = body.querySelector('[data-walk-prev]');
  const nextBtn = body.querySelector('[data-walk-next]');
  const resetBtn = body.querySelector('[data-walk-reset]');
  const quizBtn = body.querySelector('[data-walk-quiz]');
  const quizPanel = body.querySelector('[data-walk-quiz-panel]');
  const quizOptsEl = body.querySelector('[data-walk-quiz-opts]');
  const quizCloseBtn = body.querySelector('[data-walk-quiz-close]');
  const bugBtn = body.querySelector('[data-walk-bug]');
  const bugPanel = body.querySelector('[data-walk-bug-panel]');
  const bugListEl = body.querySelector('[data-walk-bug-list]');
  const bugCloseBtn = body.querySelector('[data-walk-bug-close]');
  const exampleSelect = body.querySelector('[data-walk-example]');
  let quizActive = false;
  let bugActive = false;

  // Render the code block once with line wrappers — highlight on update.
  // Each line gets a row wrapper with a line-number gutter and a syntax-
  // highlighted body. Re-uses CodeMirror's runMode for tokenization.
  codeLines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const row = document.createElement('div');
    row.className = 'walk-line';
    row.dataset.lineNo = lineNum;
    const gutter = document.createElement('span');
    gutter.className = 'walk-line-no';
    gutter.textContent = String(lineNum);
    const codeSpan = document.createElement('span');
    codeSpan.className = 'walk-line-code';
    if (window.CodeMirror && CodeMirror.runMode) {
      CodeMirror.runMode(line || ' ', 'javascript', codeSpan);
    } else {
      codeSpan.textContent = line || ' ';
    }
    row.appendChild(gutter);
    row.appendChild(codeSpan);
    codeEl.appendChild(row);
  });

  function currentSteps() {
    return compiled.byExample[uiState.exampleIdx]?.steps || [];
  }

  function render() {
    const steps = currentSteps();
    if (steps.length === 0) {
      labelEl.textContent = 'No steps for this example.';
      counterEl.textContent = 'Step 0 of 0';
      stateEl.innerHTML = '';
      return;
    }
    // Clamp stepIdx into range (e.g. switching to a shorter example)
    if (uiState.stepIdx >= steps.length) uiState.stepIdx = steps.length - 1;
    if (uiState.stepIdx < 0) uiState.stepIdx = 0;
    const step = steps[uiState.stepIdx];
    counterEl.textContent = `Step ${uiState.stepIdx + 1} of ${steps.length}`;
    labelEl.textContent = step.label || '';
    // Highlight current line
    codeEl.querySelectorAll('.walk-line.active').forEach(el => el.classList.remove('active'));
    const target = codeEl.querySelector(`.walk-line[data-line-no="${step.line}"]`);
    if (target) {
      target.classList.add('active');
      // Scroll into view inside the code pane (only the pane scrolls, not the page)
      target.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
    // Render state panel
    const entries = step.state ? Object.entries(step.state) : [];
    stateEl.innerHTML = entries.length === 0
      ? '<div class="walk-state-empty">— no state at this step —</div>'
      : entries.map(([k, v]) =>
          `<div class="walk-state-row"><span class="walk-state-key">${escapeHtml(k)}</span><span class="walk-state-val">${escapeHtml(_formatStateVal(v))}</span></div>`
        ).join('');
    // Disable prev/next at boundaries OR when quiz/bug is active.
    prevBtn.disabled = quizActive || bugActive || uiState.stepIdx === 0;
    nextBtn.disabled = quizActive || bugActive || uiState.stepIdx >= steps.length - 1;
    resetBtn.disabled = quizActive || bugActive;
    exampleSelect.disabled = quizActive || bugActive;
  }

  function exitQuiz() {
    quizActive = false;
    quizPanel.classList.add('hidden');
    quizOptsEl.innerHTML = '';
    quizBtn.classList.remove('active');
    quizBtn.textContent = '🔮 Quiz';
    render();
  }

  function startQuiz() {
    const steps = currentSteps();
    const quiz = _pickQuizOptions(steps);
    if (!quiz) {
      quizBtn.disabled = true;
      quizBtn.title = 'Trace too short for a quiz (need ≥4 steps)';
      return;
    }
    quizActive = true;
    uiState.stepIdx = quiz.K;  // show step K; ask "what's next?"
    render();
    quizPanel.classList.remove('hidden');
    quizBtn.classList.add('active');
    quizBtn.textContent = '🔮 Quiz on';
    quizOptsEl.innerHTML = '';
    let picked = false;
    quiz.options.forEach(opt => {
      const card = document.createElement('button');
      card.className = 'walk-quiz-opt';
      const stateSnippet = opt.step.state
        ? Object.entries(opt.step.state).slice(0, 2)
            .map(([k, v]) => `${escapeHtml(k)}=${escapeHtml(_formatStateVal(v))}`).join(', ')
        : '';
      card.innerHTML = `
        <div class="walk-quiz-opt-line">Line ${opt.step.line}</div>
        <div class="walk-quiz-opt-label">${escapeHtml(opt.step.label || '—')}</div>
        ${stateSnippet ? `<div class="walk-quiz-opt-state">${stateSnippet}</div>` : ''}
      `;
      card.addEventListener('click', () => {
        if (picked) return;
        picked = true;
        card.classList.add(opt.isCorrect ? 'correct' : 'incorrect');
        // Always reveal the correct one too
        if (!opt.isCorrect) {
          [...quizOptsEl.children].forEach((el, i) => {
            if (quiz.options[i].isCorrect) el.classList.add('correct');
          });
        }
        // Disable all option cards
        [...quizOptsEl.children].forEach(el => el.classList.add('locked'));
      });
      quizOptsEl.appendChild(card);
    });
  }

  prevBtn.addEventListener('click', () => {
    if (uiState.stepIdx > 0) { uiState.stepIdx--; render(); }
  });
  nextBtn.addEventListener('click', () => {
    const steps = currentSteps();
    if (uiState.stepIdx < steps.length - 1) { uiState.stepIdx++; render(); }
  });
  resetBtn.addEventListener('click', () => {
    uiState.stepIdx = 0;
    render();
  });
  quizBtn.addEventListener('click', () => {
    if (quizActive) exitQuiz();
    else startQuiz();
  });
  quizCloseBtn.addEventListener('click', exitQuiz);

  // iter 78: 🪲 Bug-Hunt mode — invert the trace from "watch correct" →
  // "find the corrupted step". Picks a random step, mutates one state-field
  // value (numbers ±1, booleans flipped, strings/arrays first-char swapped),
  // renders the full step list as tappable rows. User picks the buggy row.
  // Reuses the .walk-quiz-* styling family with .walk-bug-* overrides.
  function _bugMutateValue(v) {
    if (typeof v === 'number') return { val: v + (v >= 0 ? 1 : -1), kind: 'num±1' };
    if (typeof v === 'boolean') return { val: !v, kind: 'bool-flip' };
    if (typeof v === 'string' && v.length >= 2) {
      return { val: v[1] + v[0] + v.slice(2), kind: 'str-swap' };
    }
    if (Array.isArray(v) && v.length >= 2) {
      const out = v.slice(); [out[0], out[1]] = [out[1], out[0]];
      return { val: out, kind: 'arr-swap' };
    }
    if (typeof v === 'string' && v.length === 1) {
      // Single char: flip case / increment by 1
      const c = v.charCodeAt(0);
      return { val: String.fromCharCode(c + 1), kind: 'char+1' };
    }
    return null; // unmutatable
  }
  function _pickBugMutation(steps) {
    // Need ≥3 steps so the buggy row is non-trivial to spot.
    if (!steps || steps.length < 3) return null;
    // Try random (step, key) pairs until one yields a mutable value.
    const order = steps.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const bugIdx of order) {
      const state = steps[bugIdx].state;
      if (!state) continue;
      const keys = Object.keys(state);
      const shuffledKeys = keys.slice();
      for (let i = shuffledKeys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledKeys[i], shuffledKeys[j]] = [shuffledKeys[j], shuffledKeys[i]];
      }
      for (const key of shuffledKeys) {
        const mut = _bugMutateValue(state[key]);
        if (!mut) continue;
        // Build a mutated steps array (deep-ish copy: only the bug step's state).
        const mutated = steps.map((s, i) =>
          i === bugIdx ? { ...s, state: { ...s.state, [key]: mut.val } } : s
        );
        return { bugIdx, key, originalVal: state[key], mutatedVal: mut.val, kind: mut.kind, mutated };
      }
    }
    return null;
  }
  function exitBugMode() {
    bugActive = false;
    bugPanel.classList.add('hidden');
    bugListEl.innerHTML = '';
    bugBtn.classList.remove('active');
    bugBtn.textContent = '🪲 Bug';
    render();
  }
  function startBugMode() {
    if (quizActive) exitQuiz();
    const steps = currentSteps();
    const bug = _pickBugMutation(steps);
    if (!bug) {
      alert('This walkthrough is too short or has no mutable state for bug-hunt.');
      return;
    }
    bugActive = true;
    bugPanel.classList.remove('hidden');
    bugBtn.classList.add('active');
    bugBtn.textContent = '🪲 Bug on';
    render(); // disables controls
    bugListEl.innerHTML = '';
    let picked = false;
    bug.mutated.forEach((step, i) => {
      const card = document.createElement('button');
      card.className = 'walk-bug-row';
      card.type = 'button';
      const stateSnippet = step.state
        ? Object.entries(step.state).slice(0, 4)
            .map(([k, v]) => `${escapeHtml(k)}=${escapeHtml(_formatStateVal(v))}`).join(', ')
        : '— no state —';
      card.innerHTML = `
        <span class="walk-bug-row-idx">${i + 1}</span>
        <span class="walk-bug-row-body">
          <span class="walk-bug-row-line">Line ${step.line} · ${escapeHtml(step.label || '—')}</span>
          <span class="walk-bug-row-state">${stateSnippet}</span>
        </span>
      `;
      card.addEventListener('click', () => {
        if (picked) return;
        picked = true;
        const wasCorrect = i === bug.bugIdx;
        card.classList.add(wasCorrect ? 'correct' : 'incorrect');
        // Always reveal the actual bug step.
        if (!wasCorrect) {
          [...bugListEl.children][bug.bugIdx]?.classList.add('correct');
        }
        // Lock all rows
        [...bugListEl.children].forEach(el => el.classList.add('locked'));
        // Append a reveal line at the bottom showing original vs mutated value.
        const reveal = document.createElement('div');
        reveal.className = 'walk-bug-reveal';
        reveal.innerHTML = `Step ${bug.bugIdx + 1} · <code>${escapeHtml(bug.key)}</code> was <code>${escapeHtml(_formatStateVal(bug.originalVal))}</code>, shown as <code>${escapeHtml(_formatStateVal(bug.mutatedVal))}</code> (<em>${escapeHtml(bug.kind)}</em>)`;
        bugListEl.appendChild(reveal);
      });
      bugListEl.appendChild(card);
    });
  }
  bugBtn.addEventListener('click', () => {
    if (bugActive) exitBugMode();
    else startBugMode();
  });
  bugCloseBtn.addEventListener('click', exitBugMode);
  exampleSelect.addEventListener('change', (e) => {
    if (quizActive) exitQuiz();
    if (bugActive) exitBugMode();
    uiState.exampleIdx = Number(e.target.value);
    uiState.stepIdx = 0;
    render();
  });

  // Initial paint
  render();
}

function renderReference(body, content) {
  const ref = content.reference;
  const section = document.createElement('div');
  section.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <div class="text-xs text-slate-500 uppercase tracking-wider">The thing to memorize</div>
      <div class="flex items-center gap-2">
        <button class="flash-toggle text-xs px-2 py-1 rounded bg-slate-800 text-slate-400" data-action="flash-toggle" title="Hide random tokens, tap each to reveal">🃏 Flash</button>
        <button class="cinema-toggle text-xs px-2 py-1 rounded bg-slate-800 text-slate-400" data-action="cinema-toggle" title="Read+predict-then-verify — every line starts blurred, tap each to reveal in order">🎬 Cinema</button>
        <button class="bullets-toggle text-xs px-2 py-1 rounded bg-slate-800 text-slate-400" data-action="bullets-toggle" title="Hide canonical, type it from the notes below. Desk-tier 'see concept, recall code' recall direction the L1→L2→L3 ladder doesn't drill (L2 = template + blanks given; L3 = problem prompt only; Bullets→Code = notes-as-prompt, full code recall).">📝 Notes→Code</button>
      </div>
    </div>
    <pre class="code-block cm-s-dracula" data-ref-code></pre>
    <div class="mt-4" data-ref-mechanics></div>
    <div class="mt-6">
      <div class="mb-2 text-xs text-slate-500 uppercase tracking-wider">Notes</div>
      <ul class="space-y-2">
        ${ref.notes.map(n => `<li class="ref-note flex gap-2"><span class="text-slate-600">▸</span><span>${escapeHtml(n)}</span></li>`).join('')}
      </ul>
    </div>
    <div class="mt-8 flex justify-end">
      <button class="primary" data-action="start-l1">Start drills →</button>
    </div>
  `;
  body.appendChild(section);
  const codeEl = section.querySelector('[data-ref-code]');
  colorizeInto(codeEl, ref.code);
  let flashOn = false;
  let cinemaOn = false;
  let bulletsOn = false;
  const flashBtn = section.querySelector('[data-action="flash-toggle"]');
  const cinemaBtn = section.querySelector('[data-action="cinema-toggle"]');
  const bulletsBtn = section.querySelector('[data-action="bullets-toggle"]');
  function restoreCanonical() {
    flashOn = false;
    cinemaOn = false;
    bulletsOn = false;
    flashBtn.classList.remove('active');
    flashBtn.textContent = '🃏 Flash';
    cinemaBtn.classList.remove('active');
    cinemaBtn.textContent = '🎬 Cinema';
    bulletsBtn.classList.remove('active');
    bulletsBtn.textContent = '📝 Notes→Code';
    colorizeInto(codeEl, ref.code);
  }
  flashBtn.addEventListener('click', () => {
    if (cinemaOn || bulletsOn) restoreCanonical();
    flashOn = !flashOn;
    flashBtn.classList.toggle('active', flashOn);
    flashBtn.textContent = flashOn ? '🃏 Reveal all' : '🃏 Flash';
    if (flashOn) renderFlash(codeEl, ref.code);
    else colorizeInto(codeEl, ref.code);
  });
  // iter 121: 🎬 Reference Cinema — every line starts blurred; tap to reveal.
  // Read+predict-then-verify retrieval direction (distinct from Flash's
  // token-cloze). Toggling Cinema off restores syntax-highlighted view;
  // toggling Flash on while Cinema is active resets to canonical first.
  cinemaBtn.addEventListener('click', () => {
    if (flashOn || bulletsOn) restoreCanonical();
    cinemaOn = !cinemaOn;
    cinemaBtn.classList.toggle('active', cinemaOn);
    cinemaBtn.textContent = cinemaOn ? '🎬 Reveal all' : '🎬 Cinema';
    if (cinemaOn) _renderCinema(codeEl, ref.code);
    else colorizeInto(codeEl, ref.code);
  });
  // iter 144: 📝 Notes→Code — hide canonical; mount a CodeMirror editor in
  // its place; user types canonical from the still-visible Notes list below;
  // Run grades against L3.expectedOutput. Fills the documented L2→L3 cell
  // gap ("see concept, recall code" direction). Mutually exclusive with
  // Flash + Cinema via restoreCanonical(). Desk-tier — tooltip names this
  // explicitly so mobile users self-select. First Cat 1 Drilling Surfaces
  // ship since iter 122 What-If (22-iter Cat 1 drought broken).
  bulletsBtn.addEventListener('click', () => {
    if (flashOn || cinemaOn) restoreCanonical();
    bulletsOn = !bulletsOn;
    bulletsBtn.classList.toggle('active', bulletsOn);
    bulletsBtn.textContent = bulletsOn ? '📝 Reveal canonical' : '📝 Notes→Code';
    if (bulletsOn) _renderBulletsCode(codeEl, content);
    else colorizeInto(codeEl, ref.code);
  });
  section.querySelector('[data-action="start-l1"]').addEventListener('click', () => selectTab('L1'));

  // iter 72: 🧩 Mechanic Drilldown — inline mechanic chips on the Reference
  // tab. Surfaces this lesson's `content.mechanics` ids as tappable pills
  // that open the Mechanics modal directly to the detail view (every other
  // lesson where the idiom appears). Closes iter-64 held candidate B#2
  // (direct-promoted per iter-63 Mechanics × Track matrix precedent).
  // Lateral-transfer payoff: from canonical → "same idiom, different
  // shape" across track without leaving the recall flow.
  _renderReferenceMechanics(section.querySelector('[data-ref-mechanics]'), content.mechanics);
}

// iter 121: 🎬 Reference Cinema — render reference.code as line-by-line
// blurred buttons inside the existing <pre data-ref-code> element. Tap a
// line to reveal it (toggle .cine-revealed class). Bypasses CodeMirror
// runMode entirely — Cinema mode is about line-grain prediction, not
// syntax highlighting. Restoring canonical via colorizeInto() handles
// the return path when the toggle flips off. First Cat 1 Drilling
// Surfaces enhancement since iter 92 (Flash mode); drills read+predict-
// then-verify retrieval direction distinct from Flash's token cloze.
function _renderCinema(codeEl, code) {
  if (!codeEl) return;
  codeEl.innerHTML = '';
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lineEl = document.createElement('button');
    lineEl.type = 'button';
    lineEl.className = 'cine-line';
    lineEl.dataset.lineIdx = String(i);
    // Empty lines need a non-zero height so the user sees them as a tap
    // target; render a non-breaking space so the blur filter has content.
    lineEl.textContent = lines[i].length > 0 ? lines[i] : ' ';
    lineEl.addEventListener('click', () => {
      lineEl.classList.toggle('cine-revealed');
    });
    codeEl.appendChild(lineEl);
  }
}

// iter 144: 📝 Notes→Code — replace the canonical <pre> with a CodeMirror
// editor + Run button. User types canonical from memory using the still-
// visible Notes list (below) as the prompt. Run grades via runCode against
// content.L3.expectedOutput — same runner semantics as the L3 drill itself,
// so the comparison is byte-for-byte the same surface the user will face
// in L3. Closes the documented L2→L3 cell gap ("see concept (notes-only),
// recall code"). Mounts INSIDE the existing <pre data-ref-code> element so
// the surrounding layout (mechanics chips + Notes list + Start drills CTA)
// stays put — toggle off restores via colorizeInto(codeEl, ref.code).
function _renderBulletsCode(codeEl, content) {
  if (!codeEl) return;
  const expected = content?.L3?.expectedOutput || '';
  codeEl.innerHTML = `
    <div class="bullets-code-prompt">Type the canonical from the notes below. Run when done — same grader as L3.</div>
    <textarea class="bullets-code-editor" data-bullets-editor></textarea>
    <div class="bullets-code-actions">
      <button class="primary" data-bullets-run>Run</button>
      <span class="bullets-code-feedback" data-bullets-feedback></span>
    </div>
  `;
  const ta = codeEl.querySelector('[data-bullets-editor]');
  const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const cm = CodeMirror.fromTextArea(ta, {
    mode: 'javascript',
    theme: 'dracula',
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 2,
    tabSize: 2,
    lineWrapping: true,
    viewportMargin: Infinity,
    inputStyle: isTouchDevice ? 'contenteditable' : 'textarea',
    spellcheck: false,
    autocorrect: false,
    autocapitalize: false
  });
  const runBtn = codeEl.querySelector('[data-bullets-run]');
  const fb = codeEl.querySelector('[data-bullets-feedback]');
  runBtn.addEventListener('click', async () => {
    const userCode = cm.getValue();
    if (!userCode.trim()) {
      fb.textContent = '✗ Editor is empty — type something first.';
      fb.className = 'bullets-code-feedback bullets-feedback-warn';
      return;
    }
    fb.textContent = 'Running…';
    fb.className = 'bullets-code-feedback';
    const res = await runCode(userCode);
    if (!res.ok) {
      fb.textContent = `✗ Error: ${res.output || 'unknown'}`;
      fb.className = 'bullets-code-feedback bullets-feedback-err';
    } else if ((res.output || '') === expected) {
      fb.textContent = '✓ Output matches the canonical. Notes→Code recall succeeded.';
      fb.className = 'bullets-code-feedback bullets-feedback-pass';
    } else {
      // Show first 80 chars of the wrong output for inline visibility.
      const got = (res.output || '(empty)').slice(0, 80);
      fb.textContent = `✗ Output: ${got}${(res.output || '').length > 80 ? '…' : ''} (expected: ${expected.slice(0, 80)})`;
      fb.className = 'bullets-code-feedback bullets-feedback-warn';
    }
  });
}

function _renderReferenceMechanics(host, mechanicIds) {
  if (!host) return;
  // Hide quietly when lesson has no mechanic tags (~27% of corpus per
  // iter-59 inventory) or registry hasn't loaded yet. The chip row is
  // additive — its absence on a Reference render is not a regression.
  if (!Array.isArray(mechanicIds) || !mechanicIds.length) return;
  if (!MECHANICS.length) {
    // Registry not loaded yet — kick it off and re-render this host when
    // it arrives. Subsequent tab switches will find MECHANICS populated.
    loadMechanicsRegistry().then(() => {
      if (host.isConnected) _renderReferenceMechanics(host, mechanicIds);
    });
    return;
  }
  const labels = mechanicIds
    .map(id => ({ id, m: MECHANICS.find(x => x.id === id) }))
    .filter(x => x.m);
  if (!labels.length) return;
  host.innerHTML = `
    <div class="ref-mechanics-row">
      <span class="ref-mechanics-prefix">🧩 idioms used:</span>
      ${labels.map(({ id, m }) => `<button class="ref-mech-chip" data-mech-chip-id="${escapeHtml(id)}" title="${escapeHtml(m.blurb || m.label)} — tap to see every lesson where this idiom appears">${escapeHtml(m.label)}</button>`).join('')}
    </div>
  `;
  host.querySelectorAll('[data-mech-chip-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mid = btn.getAttribute('data-mech-chip-id');
      openMechanicsDetail(mid);
    });
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  L1 — MULTIPLE CHOICE
// ──────────────────────────────────────────────────────────────────────────
// Build a markdown prompt summarising an L1 session for paste-into-AI
// tutoring. Includes every question, the user's choice, the correct
// answer, and any in-app explanation. Marks unanswered questions clearly
// so the AI knows what's actually a miss vs unattempted.
function buildL1AiPrompt(lesson, content, localState) {
  const qs = content.L1.questions;
  const sectionLabel = lesson.section ? `${lesson.section} (${lesson.track || ''})`.trim() : (lesson.track || '');
  const lines = [];
  lines.push(`I'm studying "${lesson.title}"${sectionLabel ? ` — ${sectionLabel}` : ''} in a JavaScript interview-prep drill app. I just took the L1 concept quiz. Help me understand what I missed and deepen my grasp of the load-bearing ideas.`);
  lines.push('');
  if (content.reference && content.reference.code) {
    lines.push('## Canonical code I\'m drilling');
    lines.push('```js');
    lines.push(content.reference.code);
    lines.push('```');
    lines.push('');
  }
  qs.forEach((q, qi) => {
    const s = (localState && localState[qi]) || {};
    lines.push(`## Question ${qi + 1}`);
    lines.push(q.q);
    lines.push('');
    q.options.forEach((opt, oi) => {
      const letter = String.fromCharCode(65 + oi);
      const tags = [];
      if (s.locked && s.selected === oi) tags.push(oi === q.answer ? 'my answer ✓' : 'my answer ✗');
      if (q.answer === oi && !(s.locked && s.selected === oi)) tags.push('correct');
      const tagStr = tags.length ? `   ← ${tags.join(', ')}` : '';
      lines.push(`- ${letter}. ${opt}${tagStr}`);
    });
    if (!s.locked) lines.push(`(unanswered)`);
    if (q.explain) {
      lines.push('');
      lines.push(`> App's explanation: ${q.explain}`);
    }
    lines.push('');
  });
  lines.push('Please:');
  lines.push('1. For each question I got wrong, explain the underlying concept I\'m missing in plain language.');
  lines.push('2. Give one short additional example or analogy per concept I missed.');
  lines.push('3. List 2–3 follow-up multiple-choice questions I should be able to answer next to confirm I\'ve internalised it.');
  return lines.join('\n');
}

// Async clipboard with a textarea-based fallback for older browsers / file://
// contexts where navigator.clipboard isn't available. Returns true on success.
async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

// iter 88: 🤖 AI Coach Export — Markdown blob of weak-spots + revealed +
// overdue lessons sized for an LLM context window. The drilling user often
// has Claude/ChatGPT open already on phone; this surface skips the manual
// "describe my weak spots" reconstruction step by exporting curated context
// (lesson title + section + L1 question + correct answer + first ~25 lines
// of canonical) for the AI to tutor against. From `ideas-by-category.md
// § 6 Persistence → AI-tutor export (BYOK bridge)`. Pure clipboard export —
// no API integration, no creds, no schema change.
const AI_COACH_MAX_CHARS = 8000; // ~2000 tokens — leaves room for user prompt
const AI_COACH_MAX_LESSONS = 12;

function _aiCoachBuildExport() {
  const now = Date.now();
  const lines = [];
  lines.push('# JavaScript Drill — Weak Spots Snapshot');
  lines.push('');
  lines.push('I\'m studying for JS coding interviews using a spaced-repetition drill app. Below are the lessons I keep missing or had to reveal the answer for. **Please act as my tutor**: pick ONE lesson from this list and quiz me on it (Socratic style — don\'t just give the answer). After I respond, give feedback and move to the next. Focus on the WHY, not memorization.');
  lines.push('');

  // Gather weak / revealed / overdue lessons.
  const weakIds = Object.keys(state.weakness || {}).filter(id => (state.weakness[id] || 0) > 0);
  const revealedIds = Object.keys(state.revealed || {}).filter(id => state.revealed[id] && Object.keys(state.revealed[id]).length > 0);
  const overdueIds = [];
  for (const id of Object.keys(state.reviews || {})) {
    const r = state.reviews[id];
    if (!r || !r.dueAt || !r.interval) continue;
    if (now - r.dueAt > r.interval) overdueIds.push(id);
  }

  // Dedupe + rank: weakness count desc, then revealed, then overdue depth.
  const seen = new Set();
  const rank = (id) => (state.weakness[id] || 0) * 100
                       + (state.revealed[id] ? 10 : 0)
                       + (state.reviews[id] && now > (state.reviews[id].dueAt || 0) ? 1 : 0);
  const candidates = [...weakIds, ...revealedIds, ...overdueIds]
    .filter(id => { if (seen.has(id)) return false; seen.add(id); return true; })
    .filter(id => findLesson(id) && CONTENT[id])
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, AI_COACH_MAX_LESSONS);

  if (candidates.length === 0) {
    lines.push('## No weak spots yet');
    lines.push('');
    lines.push('I haven\'t logged enough misses or reveals for the app to surface specific weak spots. Quiz me on any JavaScript pattern you think a rusty mid-career engineer should know cold (hash maps, sliding window, binary search variants, common array idioms).');
    return lines.join('\n');
  }

  lines.push(`## ${candidates.length} lesson${candidates.length === 1 ? '' : 's'} I'm wobbly on`);
  lines.push('');

  for (const id of candidates) {
    const lesson = findLesson(id);
    const content = CONTENT[id];
    if (!lesson || !content) continue;
    const wkCount = state.weakness[id] || 0;
    const revLevels = state.revealed[id] ? Object.keys(state.revealed[id]).filter(k => state.revealed[id][k]) : [];
    const r = state.reviews[id];
    const overdueDays = r && r.dueAt && now > r.dueAt ? Math.round((now - r.dueAt) / 86400000) : 0;

    const flags = [];
    if (wkCount > 0) flags.push(`missed L1 ${wkCount}×`);
    if (revLevels.length > 0) flags.push(`revealed ${revLevels.join('+')}`);
    if (overdueDays > 0) flags.push(`${overdueDays}d overdue`);

    lines.push(`### ${lesson.title}`);
    lines.push(`*${lesson.section} · ${flags.join(' · ')}*`);

    // Include the most-missed L1 question if available.
    if (wkCount > 0 && content.L1 && Array.isArray(content.L1.questions) && content.L1.questions.length > 0) {
      const q = content.L1.questions[0];
      lines.push('');
      lines.push(`**Concept question:** ${q.q}`);
      lines.push(`- Correct: ${q.options[q.answer]}`);
      if (q.explain) lines.push(`- *Why:* ${q.explain}`);
    }

    // Include canonical (truncated to ~25 lines for context budget).
    if (content.L3 && content.L3.canonical) {
      const code = content.L3.canonical.split('\n').slice(0, 25).join('\n');
      lines.push('');
      lines.push('**Canonical:**');
      lines.push('```js');
      lines.push(code);
      lines.push('```');
    }
    lines.push('');

    // Bail if we're approaching the char budget — better to ship a focused
    // export than a truncated mess.
    if (lines.join('\n').length > AI_COACH_MAX_CHARS) {
      lines.push('*(snapshot truncated for LLM context budget — re-run after working through these)*');
      break;
    }
  }

  return lines.join('\n');
}

async function startAiCoachExport() {
  const text = _aiCoachBuildExport();
  const ok = await copyTextToClipboard(text);
  // Reuse the reveal-cleared-toast styling family for the confirmation.
  const existing = document.querySelector('.reveal-cleared-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'reveal-cleared-toast ai-coach-toast';
  toast.innerHTML = ok
    ? `🤖 Copied ${text.length.toLocaleString()} chars — paste into Claude/ChatGPT to be tutored on your weak spots`
    : `⚠️ Clipboard blocked — open DevTools console and run <code>_aiCoachBuildExport()</code> to print the blob`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('reveal-cleared-toast-show'));
  setTimeout(() => {
    toast.classList.remove('reveal-cleared-toast-show');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function renderL1(body, lesson, content) {
  const qs = content.L1.questions;
  // Use cached in-flight state if present (and shape-compatible) so a tab
  // switch back into L1 preserves the user's locked picks. See BS-12.
  let localState = _cacheGet(lesson.id, 'L1');
  if (!Array.isArray(localState) || localState.length !== qs.length) {
    localState = qs.map(() => ({ selected: null, locked: false }));
    _cacheSet(lesson.id, 'L1', localState);
  }
  // Capture per-question render handles so we can replay locked-state
  // visuals after all cards are appended. (Replaying inline would require
  // moving the click-handler logic up; this stays in sync more easily.)
  const cardHandles = [];

  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="mb-4 text-sm text-slate-400">Pick the right answer for each. Pass = all correct in one session.</div>`;
  qs.forEach((q, qi) => {
    const card = document.createElement('div');
    card.className = 'mb-6 p-5 rounded-lg bg-slate-900 border border-slate-800';
    card.innerHTML = `
      <div class="text-sm text-slate-500 mb-1">Question ${qi+1} of ${qs.length}</div>
      <div class="text-white font-medium mb-3">${escapeHtml(q.q)}</div>
      <div class="space-y-2" data-qi="${qi}"></div>
      <div class="explain mt-3 text-sm text-slate-400 hidden"></div>
    `;
    const optsContainer = card.querySelector('[data-qi]');
    q.options.forEach((opt, oi) => {
      const optEl = document.createElement('div');
      optEl.className = 'mc-option';
      const letter = String.fromCharCode(65 + oi);  // A, B, C, D
      optEl.innerHTML = `<span class="text-slate-500 font-mono text-xs mr-2">${letter}.</span>${escapeHtml(opt)}`;
      optEl.setAttribute('role', 'button');
      optEl.setAttribute('tabindex', '0');
      optEl.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !localState[qi].locked) {
          e.preventDefault();
          optEl.click();
        }
      });
      optEl.addEventListener('click', () => {
        if (localState[qi].locked) return;
        localState[qi].selected = oi;
        localState[qi].locked = true;
        if (oi !== q.answer) recordWrong(lesson.id);
        // mark correctness
        [...optsContainer.children].forEach((el, idx) => {
          el.classList.add('disabled');
          if (idx === q.answer) el.classList.add('correct');
          if (idx === oi && oi !== q.answer) el.classList.add('incorrect');
        });
        const ex = card.querySelector('.explain');
        ex.classList.remove('hidden');
        const isRight = oi === q.answer;
        ex.innerHTML = `<strong class="${isRight ? 'text-emerald-400' : 'text-rose-400'}">${isRight ? '✓ Correct.' : '✗ Not quite.'}</strong>${q.explain ? ' ' + escapeHtml(q.explain) : ''}`;
        // iter 58: Mistake Tagging chip strip — opt-in concept-tagging UI
        // shown only after a miss. Renders below the explain text inside
        // this same question card so the user can tag without losing
        // context. Dismissible via the X; tap a chip → save + fade strip.
        if (!isRight && !card.querySelector('[data-mistake-strip]')) {
          const strip = document.createElement('div');
          strip.className = 'mistake-strip';
          strip.dataset.mistakeStrip = '1';
          strip.innerHTML = `
            <div class="mistake-strip-header">
              <span class="mistake-strip-prompt">🏷 What tripped you?</span>
              <button class="mistake-strip-dismiss" data-action="dismiss-mistake" aria-label="Dismiss">✕</button>
            </div>
            <div class="mistake-strip-chips">
              ${MISTAKE_TAGS.map(t => `<button class="mistake-chip" data-mistake-tag="${escapeHtml(t.id)}">${escapeHtml(t.label)}</button>`).join('')}
            </div>
          `;
          card.appendChild(strip);
          strip.querySelector('[data-action="dismiss-mistake"]').addEventListener('click', () => {
            strip.classList.add('mistake-strip-fade');
            setTimeout(() => strip.remove(), 220);
          });
          strip.querySelectorAll('.mistake-chip').forEach(chipBtn => {
            chipBtn.addEventListener('click', () => {
              const tag = chipBtn.dataset.mistakeTag;
              recordMiss(lesson.id, 'L1', tag);
              chipBtn.classList.add('mistake-chip-picked');
              // Replace strip with a confirmation line + auto-fade.
              setTimeout(() => {
                strip.innerHTML = `<div class="mistake-strip-confirm">✓ Tagged as "${escapeHtml(MISTAKE_TAGS.find(t => t.id === tag).label)}"</div>`;
                setTimeout(() => {
                  strip.classList.add('mistake-strip-fade');
                  setTimeout(() => strip.remove(), 220);
                }, 1200);
              }, 200);
            });
          });
        }
        maybePassL1();
      });
      optsContainer.appendChild(optEl);
    });
    cardHandles.push({ card, optsContainer });
    wrap.appendChild(card);
  });

  const status = document.createElement('div');
  status.className = 'mt-2 mb-2 flex items-center justify-between flex-wrap gap-2';
  status.innerHTML = `
    <div class="text-sm text-slate-400" id="l1-status">Answer all to pass.</div>
    <div class="flex gap-2 flex-wrap">
      <button class="secondary" data-action="export-l1" title="Copy a prompt with your answers + the right answers to paste into ChatGPT/Claude for tutoring">📋 Ask AI to teach me</button>
      <button class="secondary" data-action="retry-l1">Retry</button>
      <button class="primary hidden" data-action="next-l2">L2 Fill-in →</button>
    </div>
  `;
  wrap.appendChild(status);
  body.appendChild(wrap);

  // Replay any cached locked-state visuals from a prior tab visit. This runs
  // AFTER the cards are in the DOM so classList.add side-effects stick.
  qs.forEach((q, qi) => {
    const s = localState[qi];
    if (!s.locked) return;
    const { card, optsContainer } = cardHandles[qi];
    [...optsContainer.children].forEach((el, idx) => {
      el.classList.add('disabled');
      if (idx === q.answer) el.classList.add('correct');
      if (idx === s.selected && s.selected !== q.answer) el.classList.add('incorrect');
    });
    const ex = card.querySelector('.explain');
    ex.classList.remove('hidden');
    const isRight = s.selected === q.answer;
    ex.innerHTML = `<strong class="${isRight ? 'text-emerald-400' : 'text-rose-400'}">${isRight ? '✓ Correct.' : '✗ Not quite.'}</strong>${q.explain ? ' ' + escapeHtml(q.explain) : ''}`;
  });

  status.querySelector('[data-action="retry-l1"]').addEventListener('click', () => {
    _cacheClearLevel(lesson.id, 'L1');
    renderLesson();
  });
  status.querySelector('[data-action="next-l2"]').addEventListener('click', () => selectTab('L2'));

  // Export-to-AI: copy a markdown-formatted prompt containing the lesson
  // context, every question, the user's chosen answer, the correct answer,
  // and the app's explanation. Designed to be pasted into ChatGPT/Claude
  // for tutoring help on what the user missed (or to deepen on what they
  // got right).
  const exportBtn = status.querySelector('[data-action="export-l1"]');
  exportBtn.addEventListener('click', async () => {
    const prompt = buildL1AiPrompt(lesson, content, localState);
    const ok = await copyTextToClipboard(prompt);
    const original = exportBtn.innerHTML;
    exportBtn.innerHTML = ok ? '✓ Copied — paste into AI' : '✗ Copy failed';
    exportBtn.disabled = true;
    setTimeout(() => { exportBtn.innerHTML = original; exportBtn.disabled = false; }, 1800);
  });

  function maybePassL1() {
    const allLocked = localState.every(s => s.locked);
    if (!allLocked) return;
    const allCorrect = localState.every((s, i) => s.selected === qs[i].answer);
    const statusEl = document.getElementById('l1-status');
    if (allCorrect) {
      statusEl.innerHTML = '<span class="text-emerald-400 font-medium">✓ L1 passed.</span> Onward.';
      status.querySelector('[data-action="next-l2"]').classList.remove('hidden');
      clearWeakness(lesson.id);
      markPassed(lesson.id, 'L1');
    } else {
      statusEl.innerHTML = '<span class="text-amber-400">Some answers were off — hit Retry to start over.</span>';
    }
  }

  // After replay: if the cached state was already fully answered (e.g. user
  // passed L1, switched to Reference, switched back), update the status
  // badge + reveal the next-L2 button without requiring another click.
  maybePassL1();
}

// ──────────────────────────────────────────────────────────────────────────
//  L2 — FILL IN THE BLANK
// ──────────────────────────────────────────────────────────────────────────
function renderL2(body, lesson, content) {
  // Mobile users get a tap-to-fill experience — see renderL2Mobile. The cramped
  // inline-input layout only makes sense on a real keyboard.
  if (window.matchMedia('(max-width: 767px)').matches) {
    return renderL2Mobile(body, lesson, content);
  }
  const exercises = content.L2.exercises;
  // Cache shape mirrors mobile so a viewport switch mid-attempt doesn't
  // lose typing: { passed: bool, values: [str, str, ...] } per exercise.
  let exerciseState = _cacheGet(lesson.id, 'L2');
  if (!Array.isArray(exerciseState) || exerciseState.length !== exercises.length) {
    exerciseState = exercises.map(ex => ({ passed: false, values: ex.blanks.map(() => '') }));
    _cacheSet(lesson.id, 'L2', exerciseState);
  } else {
    // Defensive: an older cache entry may lack `values` if it predates BS-12.
    exercises.forEach((ex, exi) => {
      if (!Array.isArray(exerciseState[exi].values) || exerciseState[exi].values.length !== ex.blanks.length) {
        exerciseState[exi].values = ex.blanks.map(() => '');
      }
    });
  }

  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="mb-4 text-sm text-slate-400">Fill the blanks so the code prints the expected output. Pass when all exercises produce the expected output.</div>`;

  exercises.forEach((ex, exi) => {
    const card = document.createElement('div');
    card.className = 'mb-6 p-5 rounded-lg bg-slate-900 border border-slate-800';
    const exerciseId = `l2-ex-${exi}`;
    card.innerHTML = `
      <div class="text-sm text-slate-500 mb-2">Exercise ${exi+1} of ${exercises.length}</div>
      <div class="text-white font-medium mb-3">${escapeHtml(ex.prompt)}</div>
      <pre class="code-block mono cm-s-dracula" data-template></pre>
      <div class="text-xs text-slate-500 mt-3 mb-2">Expected output:
        <span class="mono text-slate-300 ml-1">${escapeHtml(ex.expectedOutput)}</span>
      </div>
      <div class="flex items-center gap-3 mt-3">
        <button class="primary" data-action="check">Check</button>
        <button class="secondary" data-action="reveal">Reveal answers</button>
        <div class="feedback text-sm"></div>
      </div>
      <div class="output-wrap mt-3 hidden">
        <div class="text-xs text-slate-500 mb-1">Actual output:</div>
        <div class="output-box" data-output></div>
      </div>
    `;

    // Build the template with <input> elements where ___ appears.
    // Each non-blank segment is run through CodeMirror's tokenizer so
    // the surrounding code gets the same Dracula highlighting as the L3
    // editor; inputs interleave inline as before.
    const templEl = card.querySelector('[data-template]');
    const parts = ex.template.split('___');
    const inputs = [];
    templEl.innerHTML = '';
    parts.forEach((part, idx) => {
      const seg = document.createElement('span');
      colorizeInto(seg, part);
      templEl.appendChild(seg);
      if (idx < parts.length - 1) {
        const inp = document.createElement('input');
        inp.className = 'blank-input mono';
        inp.type = 'text';
        inp.placeholder = ex.blanks[idx]?.hint || '';
        inp.setAttribute('autocomplete', 'off');
        inp.setAttribute('autocorrect', 'off');
        inp.setAttribute('spellcheck', 'false');
        // Uniform 96px width — never leak the answer length via the slot size.
        inp.style.width = '96px';
        // Restore cached value (preserves typing across tab switches).
        const blankIdx = inputs.length;
        inp.value = exerciseState[exi].values[blankIdx] || '';
        inp.addEventListener('input', () => {
          exerciseState[exi].values[blankIdx] = inp.value;
        });
        templEl.appendChild(inp);
        inputs.push(inp);
      }
    });

    const feedback = card.querySelector('.feedback');
    const outputWrap = card.querySelector('.output-wrap');
    const outputBox = card.querySelector('[data-output]');

    card.querySelector('[data-action="check"]').addEventListener('click', async () => {
      // mark each blank
      let allBlanksRight = true;
      inputs.forEach((inp, i) => {
        inp.classList.remove('correct','incorrect');
        if (inp.value.trim() === ex.blanks[i].answer.trim()) {
          inp.classList.add('correct');
        } else {
          inp.classList.add('incorrect');
          allBlanksRight = false;
        }
      });
      // run filled-in code — split-and-rejoin so a user-typed "___" can't
      // misroute into the next placeholder's slot.
      const parts = ex.template.split('___');
      let filled = parts[0];
      for (let i = 0; i < inputs.length; i++) {
        filled += inputs[i].value + parts[i + 1];
      }
      const result = await runCode(filled);
      outputBox.classList.toggle('error', !result.ok);
      outputBox.textContent = result.output || '(no output)';
      outputWrap.classList.remove('hidden');

      const matched = result.ok && outputsMatch(result.output, ex.expectedOutput);
      if (allBlanksRight && matched) {
        feedback.innerHTML = '<span class="text-emerald-400 font-medium">✓ Pass</span>';
        exerciseState[exi].passed = true;
        checkL2Overall();
      } else if (matched) {
        feedback.innerHTML = '<span class="text-amber-400">Output matches, but one or more blanks doesn’t match the canonical answer.</span>';
        exerciseState[exi].passed = true;
        checkL2Overall();
      } else if (!result.ok) {
        // Runtime error — likely a blank caused a ReferenceError / SyntaxError
        // because a downstream identifier expects a specific name.
        feedback.innerHTML = '<span class="text-rose-400">Runtime error — a blank you typed may not match an identifier used later. Check the output box and red inputs.</span>';
      } else {
        feedback.innerHTML = '<span class="text-rose-400">Output doesn’t match. Check the blanks.</span>';
      }
    });

    card.querySelector('[data-action="reveal"]').addEventListener('click', () => {
      inputs.forEach((inp, i) => {
        inp.value = ex.blanks[i].answer;
        inp.classList.remove('incorrect');
        inp.classList.add('correct');
      });
      const { demoted } = markRevealed(lesson.id, 'L2');
      if (demoted) {
        feedback.innerHTML = '<span class="text-amber-400">Solution revealed.</span>' + srBadgeHtml(lesson.id, 'demote');
      }
    });
    wrap.appendChild(card);
  });

  const status = document.createElement('div');
  status.className = 'mt-2 flex items-center justify-between';
  status.innerHTML = `
    <div class="text-sm text-slate-400" id="l2-status">Pass every exercise to unlock L3.</div>
    <button class="primary hidden" data-action="next-l3">L3 Drill →</button>
  `;
  wrap.appendChild(status);
  body.appendChild(wrap);

  status.querySelector('[data-action="next-l3"]').addEventListener('click', () => selectTab('L3'));

  function checkL2Overall() {
    const allPassed = exerciseState.every(s => s.passed);
    if (allPassed) {
      // markPassed first so state.reviews reflects the new schedule when
      // srBadgeHtml reads it.
      markPassed(lesson.id, 'L2');
      document.getElementById('l2-status').innerHTML =
        '<span class="text-emerald-400 font-medium">✓ L2 passed.</span>' +
        srBadgeHtml(lesson.id, 'pass');
      status.querySelector('[data-action="next-l3"]').classList.remove('hidden');
    }
  }

  // Replay cached per-exercise pass state — if the user passed L2 in a
  // previous tab visit, surface the ✓ Pass feedback and L3 button without
  // requiring another Check click.
  exerciseState.forEach((s, exi) => {
    if (!s.passed) return;
    const card = wrap.children[exi + 1]; // +1 for the intro div
    const feedback = card?.querySelector('.feedback');
    if (feedback) feedback.innerHTML = '<span class="text-emerald-400 font-medium">✓ Pass</span>';
  });
  checkL2Overall();
}

// ──────────────────────────────────────────────────────────────────────────
//  L2 — MOBILE VARIANT (tap-to-fill with bottom sheet)
//  Blanks render as button chips inside the colored code. Tapping a chip
//  marks it active and slides up a single shared sheet at the bottom of
//  the viewport with the current hint + a large 16px input. Typing
//  live-updates the chip; Prev / Next walk through blanks across the
//  entire exercise; Done dismisses. Check / Reveal still validate the
//  assembled code through the same runner the desktop path uses.
// ──────────────────────────────────────────────────────────────────────────
function renderL2Mobile(body, lesson, content) {
  const exercises = content.L2.exercises;
  // Share the L2 cache slot with the desktop variant — `values` + `passed`
  // shape is identical; chips are DOM and per-render so they stay local.
  let cached = _cacheGet(lesson.id, 'L2');
  if (!Array.isArray(cached) || cached.length !== exercises.length) {
    cached = exercises.map(ex => ({ passed: false, values: ex.blanks.map(() => '') }));
    _cacheSet(lesson.id, 'L2', cached);
  } else {
    exercises.forEach((ex, exi) => {
      if (!Array.isArray(cached[exi].values) || cached[exi].values.length !== ex.blanks.length) {
        cached[exi].values = ex.blanks.map(() => '');
      }
    });
  }
  // exerciseState wraps the cached data with per-render chip refs.
  // Use getter/setter for `passed` and share the `values` array reference
  // so every existing write site (chip taps, reveal, check) automatically
  // mutates the cache too — no manual sync calls needed.
  const exerciseState = cached.map((c) => ({
    get passed() { return c.passed; },
    set passed(v) { c.passed = v; },
    values: c.values,
    chips: []
  }));

  document.body.classList.add('l2-mobile-active');

  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="mb-4 text-sm text-slate-400">Tap a blank to fill it in — a keyboard panel appears at the bottom. Pass when every blank's code prints the expected output.</div>`;

  let activeRef = null;   // { exi, bi } — which chip is currently in the sheet

  exercises.forEach((ex, exi) => {
    const card = document.createElement('div');
    card.className = 'mb-6 p-5 rounded-lg bg-slate-900 border border-slate-800';
    card.innerHTML = `
      <div class="text-sm text-slate-500 mb-2">Exercise ${exi+1} of ${exercises.length}</div>
      <div class="text-white font-medium mb-3">${escapeHtml(ex.prompt)}</div>
      <pre class="code-block mono cm-s-dracula" data-template></pre>
      <div class="text-xs text-slate-500 mt-3 mb-2">Expected output:
        <span class="mono text-slate-300 ml-1">${escapeHtml(ex.expectedOutput)}</span>
      </div>
      <div class="flex items-center gap-3 mt-3 flex-wrap">
        <button class="primary" data-action="check">Check</button>
        <button class="secondary" data-action="reveal">Reveal answers</button>
        <div class="feedback text-sm"></div>
      </div>
      <div class="output-wrap mt-3 hidden">
        <div class="text-xs text-slate-500 mb-1">Actual output:</div>
        <div class="output-box" data-output></div>
      </div>
    `;

    const templEl = card.querySelector('[data-template]');
    const parts = ex.template.split('___');
    templEl.innerHTML = '';
    parts.forEach((part, idx) => {
      const seg = document.createElement('span');
      colorizeInto(seg, part);
      templEl.appendChild(seg);
      if (idx < parts.length - 1) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'blank-chip';
        chip.setAttribute('data-exi', String(exi));
        chip.setAttribute('data-bi', String(idx));
        chip.setAttribute('aria-label', `Blank ${idx+1}, ${ex.blanks[idx]?.hint || 'tap to fill'}`);
        chip.innerHTML = `<span class="chip-value">___</span><span class="chip-num">${idx+1}</span>`;
        chip.addEventListener('click', (e) => { e.preventDefault(); activate(exi, idx); });
        templEl.appendChild(chip);
        exerciseState[exi].chips.push(chip);
        // Restore cached fill (preserves tap-input across tab/viewport switches).
        const cachedVal = exerciseState[exi].values[idx];
        if (cachedVal) {
          const valueEl = chip.querySelector('.chip-value');
          if (valueEl) valueEl.textContent = cachedVal;
          chip.classList.add('has-value');
        }
      }
    });

    const feedback = card.querySelector('.feedback');
    const outputWrap = card.querySelector('.output-wrap');
    const outputBox = card.querySelector('[data-output]');

    card.querySelector('[data-action="check"]').addEventListener('click', async () => {
      // Save whatever's typed in the sheet before validating.
      saveActiveValue();
      const vals = exerciseState[exi].values;
      const chips = exerciseState[exi].chips;
      let allBlanksRight = true;
      vals.forEach((v, i) => {
        chips[i].classList.remove('correct', 'incorrect');
        if (v.trim() === ex.blanks[i].answer.trim()) {
          chips[i].classList.add('correct');
        } else {
          chips[i].classList.add('incorrect');
          allBlanksRight = false;
        }
      });
      let filled = parts[0];
      for (let i = 0; i < vals.length; i++) filled += vals[i] + parts[i + 1];
      const result = await runCode(filled);
      outputBox.classList.toggle('error', !result.ok);
      outputBox.textContent = result.output || '(no output)';
      outputWrap.classList.remove('hidden');

      const matched = result.ok && outputsMatch(result.output, ex.expectedOutput);
      if (allBlanksRight && matched) {
        feedback.innerHTML = '<span class="text-emerald-400 font-medium">✓ Pass</span>';
        exerciseState[exi].passed = true;
        checkL2Overall();
      } else if (matched) {
        feedback.innerHTML = '<span class="text-amber-400">Output matches, but one or more blanks doesn’t match the canonical answer.</span>';
        exerciseState[exi].passed = true;
        checkL2Overall();
      } else if (!result.ok) {
        feedback.innerHTML = '<span class="text-rose-400">Runtime error — a blank may not match an identifier used later. Check the output and red chips.</span>';
      } else {
        feedback.innerHTML = '<span class="text-rose-400">Output doesn’t match. Check the blanks.</span>';
      }
    });

    card.querySelector('[data-action="reveal"]').addEventListener('click', () => {
      const chips = exerciseState[exi].chips;
      ex.blanks.forEach((b, i) => {
        exerciseState[exi].values[i] = b.answer;
        const valueEl = chips[i].querySelector('.chip-value');
        if (valueEl) valueEl.textContent = b.answer;
        chips[i].classList.remove('incorrect');
        chips[i].classList.add('has-value', 'correct');
      });
      if (activeRef && activeRef.exi === exi) {
        sheetInput.value = ex.blanks[activeRef.bi].answer;
      }
      const { demoted } = markRevealed(lesson.id, 'L2');
      if (demoted) {
        feedback.innerHTML = '<span class="text-amber-400">Solution revealed.</span>' + srBadgeHtml(lesson.id, 'demote');
      }
    });

    wrap.appendChild(card);
  });

  // ── Shared bottom sheet ─────────────────────────────────────────────
  const sheet = document.createElement('div');
  sheet.className = 'l2-sheet';
  sheet.innerHTML = `
    <div class="l2-sheet-header">
      <span class="l2-sheet-label" data-sheet-label>Tap a blank to start</span>
      <span class="l2-sheet-hint" data-sheet-hint></span>
    </div>
    <input class="l2-sheet-input mono" data-sheet-input type="text" autocomplete="off" autocorrect="off" spellcheck="false" inputmode="text" />
    <div class="l2-sheet-actions">
      <button class="secondary" data-sheet-prev>← Prev</button>
      <button class="primary" data-sheet-next>Next →</button>
      <button class="secondary" data-sheet-done>Done</button>
    </div>
  `;
  wrap.appendChild(sheet);

  const sheetInput = sheet.querySelector('[data-sheet-input]');
  const sheetLabel = sheet.querySelector('[data-sheet-label]');
  const sheetHint  = sheet.querySelector('[data-sheet-hint]');
  const sheetPrev  = sheet.querySelector('[data-sheet-prev]');
  const sheetNext  = sheet.querySelector('[data-sheet-next]');
  const sheetDone  = sheet.querySelector('[data-sheet-done]');

  function activate(exi, bi) {
    saveActiveValue();
    activeRef = { exi, bi };
    document.querySelectorAll('.blank-chip.active').forEach(c => c.classList.remove('active'));
    const ex = exercises[exi];
    const chip = exerciseState[exi].chips[bi];
    const blank = ex.blanks[bi];
    chip.classList.add('active');
    sheetLabel.textContent = `Exercise ${exi+1} · Blank ${bi+1} of ${ex.blanks.length}`;
    sheetHint.textContent = blank.hint || '';
    sheetInput.value = exerciseState[exi].values[bi];
    sheetInput.placeholder = blank.hint || '';
    sheetPrev.disabled = (bi === 0);
    sheetNext.disabled = (bi === ex.blanks.length - 1);
    sheet.classList.add('open');
    chip.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => sheetInput.focus(), 80);
  }

  function saveActiveValue() {
    if (!activeRef) return;
    const { exi, bi } = activeRef;
    const v = sheetInput.value;
    exerciseState[exi].values[bi] = v;
    const chip = exerciseState[exi].chips[bi];
    const valueEl = chip.querySelector('.chip-value');
    if (valueEl) valueEl.textContent = v || '___';
    chip.classList.toggle('has-value', !!v);
    chip.classList.remove('correct', 'incorrect');
  }

  sheetInput.addEventListener('input', () => {
    if (!activeRef) return;
    const { exi, bi } = activeRef;
    const v = sheetInput.value;
    exerciseState[exi].values[bi] = v;
    const chip = exerciseState[exi].chips[bi];
    const valueEl = chip.querySelector('.chip-value');
    if (valueEl) valueEl.textContent = v || '___';
    chip.classList.toggle('has-value', !!v);
    chip.classList.remove('correct', 'incorrect');
  });

  sheetInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!sheetNext.disabled) sheetNext.click();
      else sheetDone.click();
    }
  });

  sheetPrev.addEventListener('click', () => {
    if (!activeRef || activeRef.bi === 0) return;
    activate(activeRef.exi, activeRef.bi - 1);
  });
  sheetNext.addEventListener('click', () => {
    if (!activeRef) return;
    const max = exercises[activeRef.exi].blanks.length - 1;
    if (activeRef.bi >= max) return;
    activate(activeRef.exi, activeRef.bi + 1);
  });
  sheetDone.addEventListener('click', () => {
    saveActiveValue();
    if (activeRef) {
      const chip = exerciseState[activeRef.exi].chips[activeRef.bi];
      chip.classList.remove('active');
    }
    activeRef = null;
    sheet.classList.remove('open');
    sheetInput.blur();
  });

  // Status footer (same as desktop)
  const status = document.createElement('div');
  status.className = 'mt-2 flex items-center justify-between';
  status.innerHTML = `
    <div class="text-sm text-slate-400" id="l2-status">Pass every exercise to unlock L3.</div>
    <button class="primary hidden" data-action="next-l3">L3 Drill →</button>
  `;
  wrap.appendChild(status);
  body.appendChild(wrap);

  status.querySelector('[data-action="next-l3"]').addEventListener('click', () => selectTab('L3'));

  function checkL2Overall() {
    const allPassed = exerciseState.every(s => s.passed);
    if (allPassed) {
      // markPassed first so state.reviews reflects the new schedule when
      // srBadgeHtml reads it.
      markPassed(lesson.id, 'L2');
      document.getElementById('l2-status').innerHTML =
        '<span class="text-emerald-400 font-medium">✓ L2 passed.</span>' +
        srBadgeHtml(lesson.id, 'pass');
      status.querySelector('[data-action="next-l3"]').classList.remove('hidden');
    }
  }

  // Replay cached pass state (mobile path). Mirrors the desktop replay so
  // viewport-switching mid-attempt is symmetric.
  exerciseState.forEach((s, exi) => {
    if (!s.passed) return;
    const card = wrap.querySelectorAll('.feedback')[exi]?.closest('.mb-6');
    const feedback = card?.querySelector('.feedback');
    if (feedback) feedback.innerHTML = '<span class="text-emerald-400 font-medium">✓ Pass</span>';
  });
  checkL2Overall();
}

// ──────────────────────────────────────────────────────────────────────────
//  L3 — TYPE FROM MEMORY (DRILL)
// ──────────────────────────────────────────────────────────────────────────
// L3 hint ladder — graduated tap-to-reveal hints. Tier 1 names the approach;
// tier 2 reveals the function skeleton; tier 3 reveals the first real step.
// Falls back to auto-derivation when `L3.hints` has fewer than 3 authored
// entries so every lesson has a 3-tier ladder. Hint tiers do NOT demote the
// SR bucket — only the explicit "Reveal canonical" does that.
// See ideas-by-category.md § Drilling Surfaces → "L3 hint ladder" entry.
function _deriveCanonicalSkeleton(canonical) {
  if (!canonical) return null;
  // Find a top-level function declaration or arrow assignment.
  const fnDecl = canonical.match(/^\s*function\s+\w+\s*\([^)]*\)/m);
  if (fnDecl) return fnDecl[0].trim() + ' { ... }';
  const arrowAssign = canonical.match(/^\s*(?:const|let|var)\s+\w+\s*=\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)/m);
  if (arrowAssign) return arrowAssign[0].trim() + ' { ... }';
  // Top-level IIFE pattern.
  if (/^\s*\(async\s*\(\)\s*=>\s*\{/m.test(canonical)) return '(async () => { ... })();';
  return null;
}

function _deriveCanonicalFirstStep(canonical) {
  if (!canonical) return null;
  const lines = canonical.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('//')) continue;
    // Skip the function signature line itself.
    if (/^\s*(?:function|const|let|var|class)\b/.test(line) && /\{?\s*$/.test(trimmed)) continue;
    if (trimmed === '{' || trimmed === '}') continue;
    return line.trim();
  }
  return null;
}

function _buildHintLadder(drill) {
  const authored = drill.hints || [];
  const skeleton = _deriveCanonicalSkeleton(drill.canonical);
  const firstStep = _deriveCanonicalFirstStep(drill.canonical);
  return [
    { label: 'Approach', text: authored[0] || 'Think about which data structure or pattern fits this problem.' },
    { label: 'Skeleton', text: authored[1] || (skeleton ? skeleton : 'Top-level script — no wrapper function needed.') },
    { label: 'First step', text: authored[2] || (firstStep ? firstStep : 'Initialize your data structure and start the main loop.') }
  ];
}

function renderL3(body, lesson, content) {
  // iter 117: 🎤 Clarify-First Ritual — opt-in gate before the L3 editor.
  // Skip when (a) toggle off, (b) mock interview in progress (no scaffolding
  // by design — mirrors iter-81 Edge case chips bypass), (c) lesson lacks
  // Conv Sec.1 say bullets (Syntax track), (d) user already completed the
  // ritual for this lesson this session.
  if (
    state.clarifyRitualOn
    && !(state.mock.active && state.mock.lessonId === lesson.id)
    && content?.conversation?.sections?.[0]?.say
    && !_clarifySessionCompleted.has(lesson.id)
  ) {
    return _renderClarifyRitual(body, lesson, content);
  }
  // iter 119: ⏱ Time-to-Solve Calibration — strip injected after L3 body
  // renders (see end of this function via setTimeout(0)).
  const drill = content.L3;
  const isMock = state.mock.active && state.mock.lessonId === lesson.id;
  const bestMs = state.bestTimes[lesson.id];
  const wrap = document.createElement('div');

  // iter 140: ⏲ Pace-Bar — append 'L3-enter' event when user opens L3 (non-mock).
  // Schema-additive: existing history walkers either branch on specific event
  // strings (L1-pass/L2-pass/L3-pass/hint-tier-*/critical-lines-used) or ignore
  // unknowns, so this is backward-compatible. _paceBarMedianMs reads enter→pass
  // deltas to compute a per-lesson rolling median when mockHistory is empty.
  if (!isMock) appendHistory(lesson.id, 'L3-enter');

  // iter 140: Clear any prior Pace-Bar animation interval on re-render. Each
  // renderL3 owns its own interval; a stale interval from a previous render
  // would otherwise tick against the wrong wrap element.
  if (window._paceBarInterval) {
    clearInterval(window._paceBarInterval);
    window._paceBarInterval = null;
  }
  // Compute median ONCE per render. Null when there's not enough data — bar
  // auto-hides (no skeleton, no "no data yet" copy — L75 mitigation: silent
  // off-state rather than a nag).
  const paceBarMedianMs = (!isMock && state.paceBarOn) ? _paceBarMedianMs(lesson.id) : null;

  const mockBanner = isMock
    ? `<div class="mb-4 p-4 rounded-lg bg-rose-950/50 border border-rose-900 flex items-center justify-between">
         <div>
           <div class="text-xs uppercase tracking-wider text-rose-300 mb-1">🎯 Mock interview in progress</div>
           <div class="text-rose-100 mono"><span id="mock-timer">0:00</span> elapsed · hints disabled</div>
         </div>
         <button class="secondary" data-action="end-mock">End interview</button>
       </div>`
    : '';
  const bestBadge = bestMs
    ? `<span class="pill" style="background:rgba(244,114,182,0.15);color:#fbcfe8">⏱ Best: ${formatTime(bestMs)}</span>`
    : '';
  // Trend chip — show the rolling history of mock times so the user can see
  // whether they're improving across attempts, not just whether they hit a
  // new PB on this one. The most recent attempt is rightmost; if it equals
  // the PB it gets a star. Hidden when fewer than 2 attempts exist (no
  // trend yet to show).
  //
  // iter 61: Mock Replay Reel — cells are now individually tap-targets that
  // reveal a per-attempt tile (attempt index + delta-vs-best). Adds a slope
  // badge alongside computing first-vs-last comparison: improving (↓)
  // flat (→) regressing (↑). Closes iter-59 roadmap #2; honest-scope adjust
  // from the entry's "activates dead data" framing (data was already shown
  // in the text trend chip) to "adds slope label + tap-for-detail" — the
  // PROFILE personal-bests-trend-down measurement gap.
  const history = state.mockHistory[lesson.id] || [];
  const trendBadge = history.length >= 2
    ? (() => {
        const cells = history.map((ms, i) => {
          const isPB = bestMs && ms === bestMs;
          const label = isPB ? `★${formatTime(ms)}` : formatTime(ms);
          // data-attempt indexes the cell into history; the tap handler
          // pulls the {ms, attemptIdx} pair to render the detail tile.
          return `<button class="mock-reel-cell" data-mock-attempt="${i}" type="button" title="Attempt ${i + 1} of ${history.length}">${label}</button>`;
        });
        return `<span class="pill mono mock-reel" data-mock-reel title="Tap a cell for attempt detail. Most recent rightmost." style="background:rgba(244,114,182,0.08);color:#fbcfe8;letter-spacing:0.02em;display:inline-flex;align-items:center;gap:6px;padding-top:1px;padding-bottom:1px">${cells.join('<span style="color:#475569">·</span>')}</span>`;
      })()
    : '';
  const slopeBadge = (() => {
    if (history.length < 2) return '';
    const first = history[0], last = history[history.length - 1];
    const delta = first - last; // positive = faster on last attempt = improving
    const pct = Math.abs(delta) / first;
    let arrow, tone, label;
    if (pct < 0.05) { arrow = '→'; tone = '#94a3b8'; label = 'holding'; }
    else if (delta > 0) { arrow = '↓'; tone = '#34d399'; label = `${formatTime(Math.abs(delta))} faster vs first`; }
    else { arrow = '↑'; tone = '#fbbf24'; label = `${formatTime(Math.abs(delta))} slower vs first`; }
    return `<span class="pill mono" title="${escapeHtml(history.length)}-attempt trend (last vs first)" style="background:rgba(${tone === '#34d399' ? '52,211,153' : tone === '#fbbf24' ? '251,191,36' : '148,163,184'},0.10);color:${tone};letter-spacing:0.02em">${arrow} ${escapeHtml(label)}</span>`;
  })();

  wrap.innerHTML = `
    ${mockBanner}
    ${paceBarMedianMs != null ? `
    <!-- iter 140: ⏲ Pace-Bar — opt-in peripheral-vision tempo cue.
         Bar fill grows from 0% to 100% over paceBarMedianMs; color is
         keyed to elapsed/median ratio (green <50%, amber 50-100%, red ≥100%).
         No numerals, no streak, no "broke pace" callout — pure peripheral
         signal. data-pace-median-ms exposes the median for probe assertions. -->
    <div class="pace-bar" data-pace-bar data-pace-median-ms="${Math.round(paceBarMedianMs)}" role="presentation" aria-hidden="true">
      <div class="pace-bar-fill pace-bar-green" data-pace-bar-fill></div>
    </div>
    ` : ''}
    <div class="mb-4 text-sm text-slate-400 flex items-center justify-between flex-wrap gap-2">
      <span>Blank editor. Type the canonical solution from memory, then Run. Pass when output matches.</span>
      <div class="flex items-center gap-2 flex-wrap">${bestBadge}${slopeBadge}${trendBadge}</div>
    </div>
    <div class="mock-reel-tile hidden" data-mock-reel-tile></div>
    <div class="p-4 rounded-lg bg-slate-900 border border-slate-800 mb-4">
      <div class="text-xs text-slate-500 uppercase tracking-wider mb-1">Prompt</div>
      <div class="text-white">${escapeHtml(drill.prompt)}</div>
      <div class="mt-3 text-xs text-slate-500">Expected output:
        <span class="mono text-slate-300 ml-1">${escapeHtml(drill.expectedOutput)}</span>
      </div>
    </div>
    ${isMock ? '' : `
    <!-- iter 81: 🛡 Edge case pre-enumeration chip strip. Trains the
         clarifying-questions ritual interviewers grade — "before you code,
         what edges would you ask about?". Pure UX nudge (no scoring, no
         per-lesson curation); tap-toggles each chip's "considered" state.
         Hidden during Mock Interview (mock is no-scaffolding by design). -->
    <div class="edge-strip" data-edge-strip>
      <span class="edge-strip-label">🛡 Consider edges:</span>
      <button type="button" class="edge-chip" data-edge="empty">empty</button>
      <button type="button" class="edge-chip" data-edge="single">single element</button>
      <button type="button" class="edge-chip" data-edge="dupes">duplicates</button>
      <button type="button" class="edge-chip" data-edge="max">max size</button>
      <button type="button" class="edge-chip" data-edge="negative">negative</button>
      <button type="button" class="edge-chip" data-edge="none">no solution</button>
    </div>
    `}
    ${isMock ? '' : `
    <!-- iter 123: 🎹 L3 keyboard chips — one-tap insertion for the 12
         high-cost JS tokens (paren/symbol/modifier-key heavy). PROFILE
         80%-phone L3-typing cost mitigation; rusty engineer's mobile L3
         drilling barrier is the keyboard, not the recall. Bypassed during
         Mock Interview (no scaffolding by design — mirrors iter-81 Edge
         case chips bypass). Source: ideas-by-category.md § Cat 5 promotion
         shortlist #1 (iter 93 curated, iter 123 SHIPPED). -->
    <div class="l3-chips" data-l3-chips>
      ${L3_CHIP_TOKENS.map(t => `<button type="button" class="l3-chip" data-chip-insert="${escapeHtml(t.insert)}" title="Insert ${escapeHtml(t.label)} at cursor">${escapeHtml(t.label)}</button>`).join('')}
    </div>
    `}
    <textarea id="drill-editor"></textarea>
    <div class="l3-actions mt-3 flex items-center gap-2 flex-wrap">
      <button class="primary" data-action="run">Run <span class="text-blue-200">(⌘↵)</span></button>
      ${isMock ? '' : '<button class="secondary" data-action="hint" data-hint-btn>💡 Hint</button>'}
      ${isMock || !Array.isArray(drill.criticalLines) || drill.criticalLines.length === 0 ? '' : `<button class="secondary" data-action="critical-fill" data-critical-btn title="Pre-fill the editor with the canonical; you fill just the ${drill.criticalLines.length} load-bearing line${drill.criticalLines.length === 1 ? '' : 's'}">🎯 Critical lines</button>`}
      ${isMock ? '' : '<button class="secondary" data-action="diff">Compare to canonical</button>'}
      ${isMock ? '' : '<button class="secondary" data-action="reveal">Reveal canonical</button>'}
      <button class="secondary" data-action="clear">Clear</button>
      <div class="feedback text-sm ml-2"></div>
    </div>
    ${isMock ? '' : '<div class="hint-stack mt-3 hidden" data-hint-stack></div>'}
    ${isMock ? '' : '<div class="hint-trend mt-2 hidden" data-hint-trend></div>'}
    <div class="mt-4">
      <div class="text-xs text-slate-500 mb-1 flex items-center justify-between">
        <span>Output:</span>
        <span class="text-slate-600" title="Subsequence match: expected lines must appear in order. Extra debug logs between expected lines will break the match — use console.debug() instead to log without grading.">match: subsequence · use <code class="mono text-slate-400">console.debug()</code> to log without grading</span>
      </div>
      <div class="output-box" data-output>(run your code…)</div>
    </div>
    <div data-debug-panel class="mt-3 hidden">
      <div class="text-xs text-slate-500 mb-1 flex items-center gap-2">
        <span style="color:#fde68a">🐛 Debug output</span>
        <span class="text-slate-600">(from <code class="mono">console.debug</code> / <code class="mono">console.info</code> — not graded)</span>
      </div>
      <div class="output-box" data-debug-box style="background:#1a1330;color:#fde68a;border-color:#3b2a52"></div>
    </div>
    <div data-diff-panel class="mt-4 hidden">
      <div class="text-xs text-slate-500 mb-1">Diff vs canonical (comments stripped):</div>
      <div data-diff class="diff-side"></div>
    </div>
  `;
  body.appendChild(wrap);

  // iter 119: ⏱ Time-to-Solve Calibration — inject estimate strip at TOP of
  // L3 wrap when toggle on + Patterns/Applied + not Mock + not yet estimated/
  // skipped for this lesson this session. _calibrationMaybeInject() handles
  // all gates internally.
  if (typeof _calibrationMaybeInject === 'function') _calibrationMaybeInject(lesson, wrap);

  // iter 140: ⏲ Pace-Bar driver. Ticks every 500ms; updates fill width and
  // color class based on elapsed/median ratio. Auto-stops when the bar element
  // leaves the DOM (lesson nav / tab switch) — no manual cleanup needed because
  // the next renderL3 also clears window._paceBarInterval at the top.
  if (paceBarMedianMs != null) {
    const fillEl = wrap.querySelector('[data-pace-bar-fill]');
    if (fillEl) {
      const startTs = Date.now();
      const tick = () => {
        if (!fillEl.isConnected) {
          clearInterval(window._paceBarInterval);
          window._paceBarInterval = null;
          return;
        }
        const pct = (Date.now() - startTs) / paceBarMedianMs;
        const widthPct = Math.min(pct, 1) * 100;
        fillEl.style.width = widthPct + '%';
        // Color band keyed to ratio of elapsed/median; tracks the bar fill
        // since width is min-clamped to 100% but the ratio keeps growing past.
        const wantClass = pct < 0.5 ? 'pace-bar-green'
                        : pct < 1.0 ? 'pace-bar-amber'
                        : 'pace-bar-red';
        if (!fillEl.classList.contains(wantClass)) {
          fillEl.classList.remove('pace-bar-green', 'pace-bar-amber', 'pace-bar-red');
          fillEl.classList.add(wantClass);
        }
      };
      tick(); // paint immediately so the bar appears at 0% rather than after 500ms.
      window._paceBarInterval = setInterval(tick, 500);
    }
  }

  if (isMock) {
    wrap.querySelector('[data-action="end-mock"]').addEventListener('click', () => {
      endMockInterview(false);
    });
  }

  // iter 81: Edge-case chip toggles. Pure visual state — no persistence,
  // no scoring, no per-lesson curation. Trains the clarifying-questions
  // ritual before coding. Hidden during Mock (see edge-strip render gate).
  wrap.querySelectorAll('.edge-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('edge-chip-considered'));
  });

  // iter 61: Mock Replay Reel — wire per-cell tap-for-detail. Renders a
  // small tile below the header strip with attempt index + delta-vs-best.
  // Tile is exclusive: tapping a second cell replaces the tile body; tapping
  // the same cell twice toggles it off.
  const reelTile = wrap.querySelector('[data-mock-reel-tile]');
  let lastReelOpenIdx = -1;
  wrap.querySelectorAll('[data-mock-attempt]').forEach(cell => {
    cell.addEventListener('click', () => {
      const idx = +cell.dataset.mockAttempt;
      if (idx === lastReelOpenIdx) {
        reelTile.classList.add('hidden');
        lastReelOpenIdx = -1;
        wrap.querySelectorAll('.mock-reel-cell-active').forEach(c => c.classList.remove('mock-reel-cell-active'));
        return;
      }
      lastReelOpenIdx = idx;
      const ms = history[idx];
      const deltaVsBest = bestMs ? ms - bestMs : 0;
      const deltaLabel = deltaVsBest === 0
        ? `★ Personal best`
        : `+${formatTime(deltaVsBest)} from best`;
      const attemptLabel = `Attempt ${idx + 1} of ${history.length}`;
      const timeStr = formatTime(ms);
      const pct = bestMs && bestMs > 0 ? Math.round(deltaVsBest / bestMs * 100) : 0;
      const pctStr = deltaVsBest === 0 ? '' : ` (+${pct}%)`;
      reelTile.innerHTML = `
        <span class="mock-reel-tile-attempt">${escapeHtml(attemptLabel)}</span>
        <span class="mock-reel-tile-time mono">${escapeHtml(timeStr)}</span>
        <span class="mock-reel-tile-delta">${escapeHtml(deltaLabel)}${pctStr}</span>
      `;
      reelTile.classList.remove('hidden');
      wrap.querySelectorAll('.mock-reel-cell-active').forEach(c => c.classList.remove('mock-reel-cell-active'));
      cell.classList.add('mock-reel-cell-active');
    });
  });

  const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const cm = CodeMirror.fromTextArea(document.getElementById('drill-editor'), {
    mode: 'javascript',
    theme: 'dracula',
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 2,
    tabSize: 2,
    // Wrap long lines so phone users never have to scroll horizontally to
    // read code they just typed. Desktop benefits too (no orphan tokens
    // sliding off the right edge).
    lineWrapping: true,
    // Render the whole document — short snippets benefit from no
    // viewport virtualization, and it eliminates a scroll-jank source on iOS.
    viewportMargin: Infinity,
    // contenteditable on touch devices avoids iOS Safari's hidden-cursor /
    // autocorrect bugs with CodeMirror 5's textarea input.
    inputStyle: isTouchDevice ? 'contenteditable' : 'textarea',
    extraKeys: {
      'Cmd-Enter': run,
      'Ctrl-Enter': run
    }
  });
  cm.setSize('100%', null);

  // iter 123: 🎹 L3 keyboard chips — wire one-tap insertion. Renders only
  // when not in Mock (chip-strip HTML is gated above) and the wrap contains
  // the [data-l3-chips] container. CodeMirror's replaceSelection inserts at
  // the active cursor or replaces the current selection — works for both
  // empty editor (insert at start) and mid-edit. focus() keeps the soft
  // keyboard visible on mobile so users don't lose context between taps.
  if (!isMock) {
    wrap.querySelectorAll('[data-l3-chips] .l3-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const token = chip.dataset.chipInsert || '';
        if (!token) return;
        cm.replaceSelection(token);
        cm.focus();
      });
      // mousedown preventDefault keeps the editor's contenteditable focus
      // instead of grabbing it onto the chip button — critical for iOS Safari
      // where the soft keyboard would otherwise dismiss between every tap.
      chip.addEventListener('mousedown', (e) => e.preventDefault());
    });
  }

  // Restore cached editor text from a prior tab visit. Skip during a mock
  // interview — mock should always start from a blank editor.
  if (!isMock) {
    const cachedCode = _cacheGet(lesson.id, 'L3');
    if (typeof cachedCode === 'string' && cachedCode.length) {
      cm.setValue(cachedCode);
    }
    // Persist every keystroke (and programmatic setValue from Clear/Reveal)
    // back to the cache so the editor survives Reference/L1/L2 round-trips.
    cm.on('change', () => {
      _cacheSet(lesson.id, 'L3', cm.getValue());
    });
  }

  const outputBox = wrap.querySelector('[data-output]');
  const feedback = wrap.querySelector('.feedback');
  const hintStack = wrap.querySelector('[data-hint-stack]');
  const hintTrendEl = wrap.querySelector('[data-hint-trend]');
  const ladder = _buildHintLadder(drill);
  let hintsUsed = 0;
  let attempts = 0;
  let running = false;

  function renderHintStack() {
    if (!hintStack) return;
    if (hintsUsed === 0) {
      hintStack.classList.add('hidden');
      hintStack.innerHTML = '';
      return;
    }
    hintStack.classList.remove('hidden');
    hintStack.innerHTML = ladder.slice(0, hintsUsed).map((tier, i) => `
      <div class="hint-tier">
        <div class="hint-tier-label">Tier ${i+1} · ${escapeHtml(tier.label)}</div>
        <div class="hint-tier-text">${escapeHtml(tier.text)}</div>
      </div>
    `).join('');
  }

  // iter 46: hint-frequency trend badge. Surfaces "you needed scaffolding
  // on N of last K attempts" so the user can see their own hint-dependency
  // trending down over SR intervals (PROFILE line 65/66 retention signal).
  // Hidden when there's no hint history for this lesson yet — no noise.
  function renderHintTrend() {
    if (!hintTrendEl) return;
    const { hinted, total } = _countHintAttempts(lesson.id, 5);
    if (total === 0) {
      hintTrendEl.classList.add('hidden');
      hintTrendEl.innerHTML = '';
      return;
    }
    hintTrendEl.classList.remove('hidden');
    // Color signal: 0/N = green (independent), N/N = amber (still leaning),
    // mid = neutral. Trending down across SR intervals is the retention win.
    const tone = hinted === 0 ? 'good' : hinted === total ? 'warn' : 'mid';
    // iter 101: per-attempt cost ribbon below the trend pill. Each attempt
    // is a colored chip (0 hints = green ✓ / 1-2 = amber / 3+ = red).
    // Quality-of-pass made visible per-attempt — the existing pill counts
    // hinted-vs-not, ribbon adds the hint-DENSITY axis.
    const perAttempt = _perAttemptHintCounts(lesson.id, 5);
    const ribbon = perAttempt.length > 0
      ? `<span class="hint-cost-ribbon" aria-label="Hint cost per recent attempt">${
          perAttempt.map(a => {
            const cls = a.hintCount === 0 ? 'hint-cost-chip-good' : a.hintCount <= 2 ? 'hint-cost-chip-mid' : 'hint-cost-chip-warn';
            const glyph = a.hintCount === 0 ? '✓' : a.hintCount <= 2 ? String(a.hintCount) : `${a.hintCount}+`;
            return `<span class="hint-cost-chip ${cls}" title="Attempt used ${a.hintCount} hint tier${a.hintCount === 1 ? '' : 's'}">${glyph}</span>`;
          }).join('')
        }</span>`
      : '';
    hintTrendEl.innerHTML = `<span class="hint-trend-pill hint-trend-${tone}">💡 Hints / scaffold used on <strong>${hinted}</strong> of last <strong>${total}</strong> attempt${total === 1 ? '' : 's'}</span>${ribbon}`;
  }
  // Show baseline on mount (so a lesson with prior hint history surfaces
  // the badge even before the user re-clicks Hint).
  renderHintTrend();

  wrap.querySelector('[data-action="run"]').addEventListener('click', run);
  // Hint / diff / reveal buttons are omitted in Mock Interview mode (isMock).
  // Each query must be null-guarded — without this guard, starting a mock
  // throws `Cannot read properties of null (reading 'addEventListener')`
  // and the entire lesson shell renders the error instead of the L3 surface.
  const hintBtn = wrap.querySelector('[data-action="hint"]');
  if (hintBtn) {
    hintBtn.addEventListener('click', () => {
      if (hintsUsed >= ladder.length) return;
      hintsUsed++;
      // iter 46: record hint event into state.history so future SR-style
      // mechanisms can surface lessons with high hint-frequency as weak
      // spots. Also retroactively closes the iter-37 hints-used metric.
      // See iter-43 SR walkthrough gap #3.
      appendHistory(lesson.id, `hint-tier-${hintsUsed}`);
      saveProgress();
      renderHintStack();
      renderHintTrend();
      if (hintsUsed >= ladder.length) {
        hintBtn.textContent = '💡 No more hints';
        hintBtn.disabled = true;
      } else {
        hintBtn.textContent = `💡 Hint (${hintsUsed}/${ladder.length})`;
      }
    });
  }
  const diffBtn = wrap.querySelector('[data-action="diff"]');
  if (diffBtn) {
    diffBtn.addEventListener('click', () => {
      const panel = wrap.querySelector('[data-diff-panel]');
      const target = wrap.querySelector('[data-diff]');
      const userLines = stripCommentsForDiff(cm.getValue());
      const canonLines = stripCommentsForDiff(drill.canonical);
      const rows = lcsDiffRows(userLines, canonLines);
      // Header row + a (left, right) pair per diff row, laid out in a 2-col grid.
      const cells = [
        '<div class="diff-side-header">Yours</div>',
        '<div class="diff-side-header diff-side-header-right">Canonical</div>'
      ];
      for (const r of rows) {
        const leftCls = `diff-row diff-row-left diff-${r.status === 'eq' ? 'eq' : (r.status === 'del' ? 'del' : 'empty')}`;
        const rightCls = `diff-row diff-row-right diff-${r.status === 'eq' ? 'eq' : (r.status === 'add' ? 'add' : 'empty')}`;
        cells.push(`<div class="${leftCls}">${escapeHtml(r.left) || '&nbsp;'}</div>`);
        cells.push(`<div class="${rightCls}">${escapeHtml(r.right) || '&nbsp;'}</div>`);
      }
      target.innerHTML = cells.join('');
      panel.classList.remove('hidden');
    });
  }

  // "Critical lines" pre-fill — load the canonical with `criticalLines`
  // replaced by `/* ___ FILL THIS LINE ___ */` markers. User types just the
  // load-bearing lines (the algorithm's insight), not the boilerplate.
  // Hint tier; does NOT mark the lesson as revealed (no SR demote) — the
  // canonical is structurally available either way; this is just easier
  // recall scaffolding. See ideas-by-category.md § Drilling Surfaces →
  // "What's missing?" critical-line fill.
  const criticalBtn = wrap.querySelector('[data-action="critical-fill"]');
  if (criticalBtn && Array.isArray(drill.criticalLines) && drill.criticalLines.length > 0) {
    criticalBtn.addEventListener('click', () => {
      const lines = drill.canonical.split('\n');
      const blanked = lines.map((line, i) => {
        // 1-indexed match — criticalLines stores user-facing line numbers.
        if (drill.criticalLines.includes(i + 1)) {
          // Preserve leading indentation so the editor's bracket-match keeps
          // working and the line still looks "in place" structurally.
          const indent = line.match(/^\s*/)[0];
          return indent + '/* ___ FILL LINE ' + (i + 1) + ' ___ */';
        }
        return line;
      }).join('\n');
      cm.setValue(blanked);
      // iter 46: record critical-fill usage so future SR mechanisms can
      // surface lessons where the user has been relying on the scaffold.
      // See iter-43 SR walkthrough gap #3.
      appendHistory(lesson.id, 'critical-lines-used');
      saveProgress();
      renderHintTrend();
      feedback.innerHTML = `<span class="text-amber-300">🎯 Fill the ${drill.criticalLines.length} load-bearing line${drill.criticalLines.length === 1 ? '' : 's'} marked <code>/* ___ FILL ___ */</code> — that's the insight of this pattern.</span>`;
    });
  }

  const revealBtn = wrap.querySelector('[data-action="reveal"]');
  if (revealBtn) {
    revealBtn.addEventListener('click', () => {
      const due = isDueForReview(lesson.id);
      const msg = due
        ? 'Reveal the canonical solution? Your mastery dot will be marked as revealed, and your review interval will be shortened.'
        : 'Reveal the canonical solution? Your mastery dot will be marked as revealed.';
      if (!confirm(msg)) return;
      cm.setValue(drill.canonical);
      const { demoted } = markRevealed(lesson.id, 'L3');
      if (demoted) {
        feedback.innerHTML = '<span class="text-amber-400">Solution revealed.</span>' + srBadgeHtml(lesson.id, 'demote');
      } else {
        feedback.innerHTML = '<span class="text-amber-400">Solution revealed.</span>';
      }
    });
  }
  wrap.querySelector('[data-action="clear"]').addEventListener('click', () => {
    cm.setValue('');
    // Reset hint ladder so a fresh attempt starts unhinted.
    hintsUsed = 0;
    renderHintStack();
    if (hintBtn) { hintBtn.textContent = '💡 Hint'; hintBtn.disabled = false; }
  });

  async function run() {
    if (running) return;
    running = true;
    attempts++;
    const code = cm.getValue();
    feedback.innerHTML = '<span class="text-slate-500">Running…</span>';
    const result = await runCode(code);
    running = false;
    outputBox.classList.toggle('error', !result.ok);
    outputBox.textContent = result.output || '(no output)';
    // Surface debug output (console.debug / console.info) in its own pane —
    // visible only when there's something to show. Pane is never graded.
    const debugPanel = wrap.querySelector('[data-debug-panel]');
    const debugBox = wrap.querySelector('[data-debug-box]');
    if (result.debug && result.debug.length) {
      debugBox.textContent = result.debug;
      debugPanel.classList.remove('hidden');
    } else {
      debugPanel.classList.add('hidden');
    }
    if (result.ok && outputsMatch(result.output, drill.expectedOutput)) {
      const wasMock = state.mock.active && state.mock.lessonId === lesson.id;
      markPassed(lesson.id, 'L3');
      // iter 46: the L3-pass closed the current attempt; refresh hint trend
      // so the new attempt's hint count is reflected immediately.
      renderHintTrend();
      const tries = attempts === 1 ? 'first try' : `${attempts} tries`;
      const srBadge = srBadgeHtml(lesson.id, 'pass');
      if (wasMock) {
        const elapsed = endMockInterview(true);
        const prevBest = state.bestTimes[lesson.id];
        const isNewBest = elapsed === prevBest;
        feedback.innerHTML = `<span class="text-emerald-400 font-medium">✓ Solved in ${formatTime(elapsed)} (${tries})${isNewBest ? ' — new personal best!' : ''}</span>` + srBadge;
      } else {
        feedback.innerHTML = `<span class="text-emerald-400 font-medium">✓ Output matches — L3 passed (${tries}).</span>` + srBadge;
      }
    } else if (!result.ok) {
      feedback.innerHTML = '<span class="text-rose-400">Runtime error — read the output box.</span>';
    } else {
      // Heuristic hint: did the user likely break their own grade with a
      // debug `console.log`? If the expected output appears in actual but
      // grading still failed, point at debug-log interleaving as the cause.
      const expNorm = normalize(drill.expectedOutput);
      const actNorm = normalize(result.output);
      const containsExpected = expNorm.length > 0 && actNorm.includes(expNorm.split('\n').pop());
      const hint = containsExpected
        ? ' <span class="text-slate-500 text-xs">Your output contains the expected lines but they\'re interleaved with extras — replace stray <code class="mono">console.log</code>s with <code class="mono">console.debug</code> so they don\'t break the match.</span>'
        : '';
      feedback.innerHTML = '<span class="text-rose-400">Output doesn\'t match expected. Try again.</span>' + hint;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  MECHANICS MODAL — cross-cutting drill surface
//  Two views inside one modal:
//    list   — every mechanic grouped by category, with mastered/total badge
//    detail — one mechanic's canonical snippet + every lesson that uses it,
//             sorted by review priority (due > weak > in-progress > new > mastered)
//  Tapping a lesson row jumps straight to it and closes the modal — the
//  user's existing L1/L2/L3 loop takes over from there. The act of seeing
//  the mechanic alongside its cross-track lesson set IS the interleaving aid.
// ──────────────────────────────────────────────────────────────────────────
let _mechanicsView = 'list';            // iter 63: 'list' | 'matrix' | 'detail'
let _mechanicsPrevView = 'list';        // iter 63: which non-detail view to return to on back
let _mechanicsSelectedId = null;        // mechanic id when view === 'detail'

function _mechMasteryFraction(lessonIds) {
  const arr = [...lessonIds];
  const mastered = arr.filter(id => lessonOverallStatus(id) === 'mastered').length;
  return { mastered, total: arr.length };
}

function _mechSortLessons(lessonIds) {
  // Review priority — surface the lesson the user most needs to drill first.
  const prio = (id) => {
    if (isDueForReview(id)) return 0;
    if (state.weakness[id]) return 1;
    const s = lessonOverallStatus(id);
    if (s === 'in_progress') return 2;
    if (s === 'not_started') return 3;
    return 4; // mastered, lowest priority
  };
  return [...lessonIds].sort((a, b) => {
    const pa = prio(a), pb = prio(b);
    if (pa !== pb) return pa - pb;
    return (findLesson(a)?.title || '').localeCompare(findLesson(b)?.title || '');
  });
}

async function openMechanicsModal() {
  const modal = document.getElementById('mechanics-modal');
  if (!modal) return;
  // Show modal first, then load — the loading state lives inside the modal
  // body, not behind a spinner that blocks the click.
  _mechanicsView = 'list';
  _mechanicsPrevView = 'list';
  _mechanicsSelectedId = null;
  const body = document.getElementById('mechanics-body');
  if (body) body.innerHTML = `<div style="color:#94a3b8;text-align:center;padding:24px 0;">Loading mechanics…</div>`;
  modal.style.display = 'block';
  await ensureMechanicIndex();
  renderMechanicsModal();
}

// iter 72: open the mechanics modal directly to the detail view for a given
// mechanic id. Used by Reference-tab mechanic-chips for lateral-transfer
// drilling — tap a chip → see every other lesson where that idiom appears.
// Back button returns to the list view (consistent with detail-from-list).
async function openMechanicsDetail(mechId) {
  const modal = document.getElementById('mechanics-modal');
  if (!modal) return;
  const body = document.getElementById('mechanics-body');
  if (body) body.innerHTML = `<div style="color:#94a3b8;text-align:center;padding:24px 0;">Loading mechanic…</div>`;
  modal.style.display = 'block';
  await ensureMechanicIndex();
  const m = MECHANICS.find(x => x.id === mechId);
  if (!m) {
    // Mechanic id not in registry — fall through to list view rather than
    // showing an empty detail. Defensive: this can happen if a lesson's
    // content.mechanics references a stale id.
    _mechanicsView = 'list';
    _mechanicsPrevView = 'list';
    _mechanicsSelectedId = null;
  } else {
    _mechanicsSelectedId = mechId;
    _mechanicsPrevView = 'list';
    _mechanicsView = 'detail';
  }
  renderMechanicsModal();
}

function closeMechanicsModal() {
  const modal = document.getElementById('mechanics-modal');
  if (modal) modal.style.display = 'none';
}

function renderMechanicsModal() {
  const body = document.getElementById('mechanics-body');
  const titleEl = document.getElementById('mechanics-title');
  const subEl = document.getElementById('mechanics-sub');
  const backBtn = document.getElementById('mechanics-back');
  if (!body || !titleEl || !subEl || !backBtn) return;
  // iter 63: keep List/Matrix toggle visible in non-detail views; sync active.
  const toggleEl = document.getElementById('mechanics-view-toggle');
  const listBtn = document.getElementById('mechanics-view-list');
  const matrixBtn = document.getElementById('mechanics-view-matrix');
  if (toggleEl && listBtn && matrixBtn) {
    toggleEl.style.display = _mechanicsView === 'detail' ? 'none' : 'flex';
    const activeStyle = 'background: rgba(217,70,239,0.18); color: #f0abfc; border: 1px solid rgba(217,70,239,0.4); border-radius: 999px; padding: 4px 12px; font-size: 11px; font-weight: 500; cursor: pointer;';
    const inactiveStyle = 'background: transparent; color: #94a3b8; border: 1px solid #334155; border-radius: 999px; padding: 4px 12px; font-size: 11px; font-weight: 500; cursor: pointer;';
    listBtn.setAttribute('style', _mechanicsView === 'list' ? activeStyle : inactiveStyle);
    matrixBtn.setAttribute('style', _mechanicsView === 'matrix' ? activeStyle : inactiveStyle);
  }

  if (_mechanicsView === 'matrix') {
    titleEl.textContent = '🧩 Mechanics · Track × Tag';
    subEl.textContent = 'Mastered/total per (mechanic, track). Transfer gaps highlighted — mechanics mastered in one track but not another.';
    backBtn.style.display = 'none';
    body.innerHTML = _renderMechanicsMatrixHtml();
    body.scrollTop = 0;
    body.querySelectorAll('[data-mech-cell]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mid = btn.getAttribute('data-mech-cell');
        const m = MECHANICS.find(x => x.id === mid);
        if (!m) return;
        _mechanicsSelectedId = mid;
        _mechanicsPrevView = 'matrix';  // back button → matrix view
        _mechanicsView = 'detail';
        renderMechanicsModal();
      });
    });
    return;
  }

  if (_mechanicsView === 'list') {
    titleEl.textContent = '🧩 Mechanics';
    subEl.textContent = 'Code idioms tagged across lessons. Tap a mechanic to see every lesson where it appears.';
    backBtn.style.display = 'none';
    body.innerHTML = _renderMechanicsListHtml();
    body.scrollTop = 0;
    body.querySelectorAll('[data-mech-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        _mechanicsSelectedId = btn.getAttribute('data-mech-id');
        _mechanicsPrevView = 'list';  // iter 63: back button → list view
        _mechanicsView = 'detail';
        renderMechanicsModal();
      });
    });
  } else {
    const m = MECHANICS.find(x => x.id === _mechanicsSelectedId);
    if (!m) { _mechanicsView = 'list'; renderMechanicsModal(); return; }
    titleEl.textContent = '🧩 ' + m.label;
    subEl.textContent = m.blurb;
    backBtn.style.display = '';
    body.innerHTML = _renderMechanicsDetailHtml(m);
    body.scrollTop = 0;
    body.querySelectorAll('[data-lesson-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-lesson-id');
        closeMechanicsModal();
        selectLesson(id);
      });
    });
  }
}

function _renderMechanicsListHtml() {
  if (!MECHANICS.length) {
    return `<div style="color:#94a3b8;text-align:center;padding:24px 0;">No mechanics defined.</div>`;
  }
  // Group by category, preserving category order from the registry; within
  // a category, sort by lesson count desc so the user's most-frequented
  // mechanics float up.
  const byCat = new Map();
  for (const cat of MECHANIC_CATEGORIES) byCat.set(cat.id, []);
  for (const m of MECHANICS) {
    const lessonIds = MECHANIC_INDEX.get(m.id) || new Set();
    const { mastered, total } = _mechMasteryFraction(lessonIds);
    const arr = byCat.get(m.category);
    if (arr) arr.push({ m, total, mastered });
  }
  let html = '';
  for (const cat of MECHANIC_CATEGORIES) {
    const items = byCat.get(cat.id) || [];
    items.sort((a, b) => b.total - a.total || a.m.label.localeCompare(b.m.label));
    if (!items.length) continue;
    html += `<div data-mech-cat="${escapeHtml(cat.id)}" style="font-size:10.5px;text-transform:uppercase;letter-spacing:0.07em;color:#64748b;margin-top:10px;margin-bottom:4px;">${escapeHtml(cat.label)}</div>`;
    for (const { m, total, mastered } of items) {
      const empty = total === 0;
      const masteredAll = total > 0 && mastered === total;
      const badgeColor = masteredAll ? '#34d399' : (mastered > 0 ? '#67e8f9' : '#94a3b8');
      const pct = total ? ` · ${Math.round((mastered / total) * 100)}%` : '';
      const cursor = empty ? 'default' : 'pointer';
      const opacity = empty ? '0.5' : '1';
      html += `<button data-mech-id="${escapeHtml(m.id)}" ${empty ? 'disabled' : ''} style="text-align:left; padding:10px 12px; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#e2e8f0; cursor:${cursor}; opacity:${opacity};">
        <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px;">
          <span style="font-weight:600;">${escapeHtml(m.label)}</span>
          <span style="color:${badgeColor}; font-size:11px; white-space:nowrap;">${mastered}/${total}${pct}</span>
        </div>
      </button>`;
    }
  }
  return html;
}

// iter 63: Mechanics × Track transfer-gap matrix (direct-promoted from
// iter-59 vision iter's held candidate B#2). Joins MECHANIC_INDEX (mechanic
// → Set<lessonId>) with each lesson's `track` to produce a mechanic × track
// grid showing mastered/total per cell. Surfaces transfer gaps the existing
// list view structurally can't show (e.g., "mastered `sliding-window` in
// syntax but unmastered in patterns" — the canonical case PROFILE.md
// pattern-fluency line names). Empty cells render dim; non-empty cells
// tap-to-detail filtered to that mechanic+track.
function _mechanicsTrackMatrix() {
  const tracks = ['syntax', 'patterns', 'applied'];
  const rows = [];
  for (const m of MECHANICS) {
    const lessonIds = MECHANIC_INDEX.get(m.id) || new Set();
    if (lessonIds.size === 0) continue;  // skip empty mechanics
    const perTrack = {};
    let totalAll = 0, masteredAll = 0;
    for (const t of tracks) perTrack[t] = { mastered: 0, total: 0, lessonIds: [] };
    for (const lid of lessonIds) {
      const lesson = findLesson(lid);
      if (!lesson || !tracks.includes(lesson.track)) continue;
      const cell = perTrack[lesson.track];
      cell.total++;
      cell.lessonIds.push(lid);
      totalAll++;
      if (lessonOverallStatus(lid) === 'mastered') {
        cell.mastered++;
        masteredAll++;
      }
    }
    // Detect transfer gap: ≥1 cell at 100% mastery + ≥1 other cell at 0% mastery
    // (and both have ≥1 lesson). This is the exact "you got it in track A
    // but not B" signal the matrix exists to surface.
    const cellsWithContent = tracks.filter(t => perTrack[t].total > 0);
    const hasMasteredCell = cellsWithContent.some(t => perTrack[t].total > 0 && perTrack[t].mastered === perTrack[t].total);
    const hasUnmasteredCell = cellsWithContent.some(t => perTrack[t].total > 0 && perTrack[t].mastered === 0);
    const transferGap = cellsWithContent.length >= 2 && hasMasteredCell && hasUnmasteredCell;
    rows.push({ id: m.id, label: m.label, perTrack, totalAll, masteredAll, transferGap });
  }
  // Sort: transfer-gap rows first (highest-signal), then by totalAll desc
  // (biggest cross-section mechanics float up), then alphabetic.
  rows.sort((a, b) => {
    if (a.transferGap !== b.transferGap) return a.transferGap ? -1 : 1;
    if (a.totalAll !== b.totalAll) return b.totalAll - a.totalAll;
    return a.label.localeCompare(b.label);
  });
  return rows;
}

function _renderMechanicsMatrixHtml() {
  const rows = _mechanicsTrackMatrix();
  if (!rows.length) {
    return `<div style="color:#94a3b8;text-align:center;padding:24px 0;">No mechanics yet.</div>`;
  }
  const transferGapCount = rows.filter(r => r.transferGap).length;
  const tracks = ['syntax', 'patterns', 'applied'];
  let html = '';
  if (transferGapCount > 0) {
    html += `<div style="font-size:11px; color:#fbbf24; background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.25); border-radius:6px; padding:6px 10px; margin-bottom:10px;">⚠ ${transferGapCount} transfer gap${transferGapCount === 1 ? '' : 's'} — mechanics mastered in one track but not another. Listed first.</div>`;
  }
  // Header row.
  html += `<div style="display:grid; grid-template-columns: 1fr 56px 56px 56px; gap:4px; padding:4px 8px; font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.06em;">
    <div></div>
    <div style="text-align:center;">Syntax</div>
    <div style="text-align:center;">Pattern</div>
    <div style="text-align:center;">Applied</div>
  </div>`;
  for (const row of rows) {
    const gapMarker = row.transferGap ? `<span style="color:#fbbf24; margin-right:4px;" title="Transfer gap">⚠</span>` : '';
    html += `<div style="display:grid; grid-template-columns: 1fr 56px 56px 56px; gap:4px; padding:6px 8px; align-items:center; background:#1e293b; border:1px solid ${row.transferGap ? 'rgba(251,191,36,0.35)' : '#334155'}; border-radius:6px;">
      <div style="font-size:12.5px; color:#e2e8f0; font-weight:500; overflow:hidden; text-overflow:ellipsis;">${gapMarker}${escapeHtml(row.label)}</div>`;
    for (const t of tracks) {
      const cell = row.perTrack[t];
      if (cell.total === 0) {
        html += `<div style="text-align:center; font-size:10px; color:#475569;">—</div>`;
        continue;
      }
      // Color depth = mastery ratio; transparent at 0%, full at 100%.
      const ratio = cell.mastered / cell.total;
      let bg = '#1e293b', fg = '#94a3b8';
      if (ratio === 1) { bg = 'rgba(52,211,153,0.22)'; fg = '#d1fae5'; }
      else if (ratio >= 0.5) { bg = 'rgba(103,232,249,0.18)'; fg = '#cffafe'; }
      else if (ratio > 0) { bg = 'rgba(251,191,36,0.15)'; fg = '#fde68a'; }
      else { bg = 'rgba(148,163,184,0.08)'; fg = '#94a3b8'; }
      html += `<button data-mech-cell="${escapeHtml(row.id)}" data-mech-cell-track="${escapeHtml(t)}" type="button" title="${escapeHtml(row.label)} in ${escapeHtml(t)} — tap to drill" style="background:${bg}; color:${fg}; border:1px solid rgba(255,255,255,0.05); border-radius:4px; padding:4px 0; cursor:pointer; font-size:11px; font-weight:600; font-variant-numeric: tabular-nums;">${cell.mastered}/${cell.total}</button>`;
    }
    html += `</div>`;
  }
  return html;
}

function _renderMechanicsDetailHtml(m) {
  const lessonIds = MECHANIC_INDEX.get(m.id) || new Set();
  const sorted = _mechSortLessons(lessonIds);
  const { mastered, total } = _mechMasteryFraction(lessonIds);
  let html = '';
  // Snippet — the canonical shape of this mechanic. Plain <pre> rather than
  // CodeMirror runMode keeps the modal lightweight; it's a glance surface.
  html += `<div style="background:#020617; border:1px solid #1e293b; border-radius:8px; padding:12px; margin-bottom:14px;">
    <pre style="margin:0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12.5px; color:#e2e8f0; white-space:pre-wrap; word-break: break-word;">${escapeHtml(m.snippet)}</pre>
  </div>`;
  html += `<div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
    <span style="color:#cbd5e1; font-size:13px; font-weight:600;">${total} lesson${total === 1 ? '' : 's'}</span>
    <span style="color:#94a3b8; font-size:12px;">${mastered}/${total} mastered</span>
  </div>`;
  if (!sorted.length) {
    html += `<div style="color:#94a3b8;text-align:center;padding:24px 0;">No lessons tagged with this mechanic yet.</div>`;
    return html;
  }
  html += `<div style="display:flex; flex-direction:column; gap:6px;">`;
  for (const id of sorted) {
    const lesson = findLesson(id);
    if (!lesson) continue;
    const overall = lessonOverallStatus(id);
    const dotColor = overall === 'mastered' ? '#34d399' : (overall === 'in_progress' ? '#facc15' : '#475569');
    const tagBits = [];
    if (isDueForReview(id)) tagBits.push(`<span style="color:#67e8f9; font-size:11px;">🕒 due</span>`);
    if (state.weakness[id]) tagBits.push(`<span style="color:#fdba74; font-size:11px;">⚠ weak</span>`);
    const trackMeta = TRACK_PILLS[lesson.track] || TRACK_PILLS.patterns;
    html += `<button data-lesson-id="${escapeHtml(id)}" style="text-align:left; padding:10px 12px; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#e2e8f0; cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:8px;">
      <span style="display:flex; align-items:center; gap:8px; min-width:0; overflow:hidden;">
        <span style="width:8px; height:8px; border-radius:50%; background:${dotColor}; flex:0 0 auto;" aria-hidden="true"></span>
        <span style="color:#94a3b8; font-size:10.5px; text-transform:uppercase; letter-spacing:0.05em; flex:0 0 auto;">${escapeHtml(trackMeta.label)}</span>
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(lesson.title)}</span>
      </span>
      <span style="display:flex; gap:8px; flex:0 0 auto;">${tagBits.join(' ')}</span>
    </button>`;
  }
  html += `</div>`;
  return html;
}

// ──────────────────────────────────────────────────────────────────────────
//  INIT
// ──────────────────────────────────────────────────────────────────────────
async function init() {
  // iter 125: load PATHS registry from data/paths.json BEFORE loadProgress —
  // loadProgress validates state.subscribedPathId against PATHS, so the registry
  // must be populated first. loadPaths() never throws (defensive fallback inside).
  await loadPaths();
  loadProgress();
  try { await loadManifest(); } catch (e) {
    document.getElementById('lesson-shell').innerHTML = '<div class="p-6 text-red-300">Failed to load lesson data: ' + (e && e.message ? e.message : e) + '</div>';
    return;
  }
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

  // Search input
  const searchInput = document.getElementById('search-input');
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

  // iter 49: Pattern Recognition Speed Drill — diagnose-the-pattern session.
  // Reframe of iter-26 entry #1 (BLOCKED) using SECTION-name distractors
  // (17 cross-cutting buckets) instead of per-lesson distractors — sidesteps
  // iter-30 data-contamination concern. See roadmap.md iter-48.
  document.getElementById('recognize-btn').addEventListener('click', () => {
    startRecognizeSession();
  });

  // iter 76: 🎯 Reverse — output→problem direction. Sibling to Recognize
  // (problem→pattern direction). §9B code-evaluation surface.
  document.getElementById('reverse-btn').addEventListener('click', () => {
    startReverseSession();
  });

  // iter 77: 🔮 Predict — mental-execution drill. Read code, predict output
  // from 4 same-type distractors without running. Trains the foundational
  // interview reflex "execute this code in your head" — first surface to
  // drill mental simulation.
  document.getElementById('crystal-btn').addEventListener('click', () => {
    startCrystalSession();
  });

  // iter 79: 📐 Claim — Smell-test complexity claim. §9B code-evaluation
  // drill that trains "does the stated complexity match the code?" reflex.
  document.getElementById('claim-btn').addEventListener('click', () => {
    startClaimSession();
  });

  // iter 83: 🎰 Gotcha Roulette — reference.notes recall stream. Surfaces
  // the half-remembered traps without the cost of opening each lesson.
  document.getElementById('gotcha-btn').addEventListener('click', () => {
    startGotchaSession();
  });

  // iter 86: 🔀 Swap-Bench — pairwise idiom-equivalence drill. Two snippets
  // stacked vertically; user judges "same behavior?".
  const swapBtn = document.getElementById('swap-btn');
  if (swapBtn) swapBtn.addEventListener('click', () => {
    startSwapBenchSession();
  });

  // iter 91: 🎬 Conversation Drill — interview-arc classifier over
  // conversation.sections[]. First surface to test the 6-section interview
  // arc on Patterns/Applied lessons. Reuses Gotcha card stack.
  const convDrillBtn = document.getElementById('conv-drill-btn');
  if (convDrillBtn) convDrillBtn.addEventListener('click', () => {
    startConvDrillSession();
  });

  // iter 93: 🧬 Trace-Hop — middle-state recall over walkthrough.trace yields.
  // Three consecutive frames with the middle state blanked; user picks
  // which of 4 same-trace states fits. First surface drilling positional
  // state recall (the mental model needed to write canonical from scratch).
  const traceHopBtn = document.getElementById('trace-hop-btn');
  if (traceHopBtn) traceHopBtn.addEventListener('click', () => {
    startTraceHopSession();
  });

  // iter 97: 📝 Notes Cloze — keyword-blank recall over reference.notes[].
  // Third recall direction over the notes corpus: Gotcha tests whole-note
  // recognition; Flash tests code-token cloze; Notes Cloze tests note-
  // keyword cloze with MC distractors.
  const notesDrillBtn = document.getElementById('notes-drill-btn');
  if (notesDrillBtn) notesDrillBtn.addEventListener('click', () => {
    startNotesDrillSession();
  });

  // iter 98: 🪐 Mechanic Constellation — multi-select recall over mechanics[]
  // tag. First surface drilling mechanics as a recall TARGET (vs Bridge/Matrix/
  // modal which all USE mechanics as input). Pick the 3 lessons (of 6) tagged
  // with the given mechanic.
  const constellationBtn = document.getElementById('constellation-btn');
  if (constellationBtn) constellationBtn.addEventListener('click', () => {
    startConstellationSession();
  });

  // iter 99: ⏪ Reverse-Walkthrough — backward-direction recall over
  // walkthrough.examples. Shown final state, pick which of 3 inputs from
  // the SAME lesson produced it. Complements Walkthrough (forward stepper)
  // and Trace-Hop (mid-state recall).
  const reverseWalkBtn = document.getElementById('reverse-walk-btn');
  if (reverseWalkBtn) reverseWalkBtn.addEventListener('click', () => {
    startReverseWalkSession();
  });

  // iter 102: 🗂 Notes Locate — cross-corpus localization over reference.notes[].
  // Third recall direction over the notes corpus: Gotcha = recognition;
  // Notes Cloze = intra-note keyword; Locate = note → which lesson.
  const notesLocateBtn = document.getElementById('notes-locate-btn');
  if (notesLocateBtn) notesLocateBtn.addEventListener('click', () => {
    startNotesLocateSession();
  });

  // iter 122: 🧪 What-If Output Predictor — per-lesson input→output recall
  // over walkthrough.examples. Trace-transfer cognitive direction PROFILE
  // L22-24 names but no surface drills as pure prediction.
  const whatifBtn = document.getElementById('whatif-btn');
  if (whatifBtn) whatifBtn.addEventListener('click', () => {
    startWhatifSession();
  });

  // iter 142: 🔀 Mutate-and-Predict — §9B consequence-class drill. Distinct
  // from iter-73 Bug-Hunt: Bug-Hunt = locate the buggy line; Mutate = name
  // the type of failure the mutation causes. Forward-simulation cognitive
  // operation; first §9B ship since iter 81 Edge-case chips.
  const mutateBtn = document.getElementById('mutate-btn');
  if (mutateBtn) mutateBtn.addEventListener('click', () => {
    startMutateSession();
  });

  // iter 147: 📞 Phone Screen Simulator — Cat 2 Paths & Sessions. Chained
  // 3-card session (syntax warmup + pattern L3 + mechanic-related L2
  // follow-up) under ONE unbroken timer. First Cat 2 Active list refill
  // since iter 125 Gauntlet.
  const phoneScreenBtn = document.getElementById('phone-screen-btn');
  if (phoneScreenBtn) phoneScreenBtn.addEventListener('click', () => {
    startPhoneScreenSession();
  });

  // iter 148: 🚧 Constraint-Shift Drill — Cat 9 §9C + Cat 4 sidecar hybrid.
  // First §9C ship ever; 5th sidecar registry. Session shows canonical with
  // a swapped constraint claim and prompts rewrite; grade = runCode output
  // match + per-entry structural-fingerprint regex (must NOT match in user
  // submission).
  const constraintShiftBtn = document.getElementById('constraint-shift-btn');
  if (constraintShiftBtn) constraintShiftBtn.addEventListener('click', () => {
    startConstraintShiftSession();
  });

  // iter 109: 🔖 Match — bidirectional title ↔ description matcher.
  // Cat 8 § Modalities first ship; trains the name-to-concept retrieval
  // direction the L1/L2/L3 ladder doesn't cover.
  const matchBtn = document.getElementById('match-btn');
  if (matchBtn) matchBtn.addEventListener('click', () => {
    startMatchSession();
  });

  // iter 111: 🌈 Sections — section mastery heatmap. Cat 7 spatial axis
  // (the 5 existing Cat 7 surfaces are all temporal). 28-cell grid colored
  // by mastery %; tap → drill the section's first not-mastered lesson.
  const sectionsGridBtn = document.getElementById('sections-grid-btn');
  if (sectionsGridBtn) sectionsGridBtn.addEventListener('click', () => {
    startSectionGrid();
  });

  // iter 88: 🤖 AI Coach Export — clipboard export of weak-spots + revealed
  // + overdue lessons for paste-into-LLM tutoring. Pure clipboard, no API.
  const aiCoachBtn = document.getElementById('ai-coach-btn');
  if (aiCoachBtn) aiCoachBtn.addEventListener('click', () => {
    startAiCoachExport();
  });

  // iter 54: ⚡ Rapid-Fire L1 stream — cross-lesson interleaved tap surface.
  // Closes iter-31 roadmap entry #4 (L1 Rapid-Fire Drill, unblocked). Uses
  // existing L1 corpus across all tracks; integrates with weak-spot tracker
  // on misses so the high-throughput stream feeds normal SR/weakness rotation.
  document.getElementById('rapid-fire-btn').addEventListener('click', () => {
    startRapidFireSession();
  });

  // iter 75: ⏱ Big-O — complexity-filtered L1 stream. Reuses Rapid-Fire's
  // shell with a deck filtered to complexity-flavored q-text. Closes audit
  // theme #4 (complexity-Q fatigue) by concentrating those Qs into a
  // trainable surface instead of diluting them across normal lessons.
  document.getElementById('big-o-btn').addEventListener('click', () => {
    startBigOSession();
  });

  // iter 57: 🌅 Warmup — 3-card micro-session over Today's Plan's curated
  // mix (due + path + weak). Closes iter-55 roadmap #3. The L1 interaction
  // shell ships INSIDE the card so the user goes from idle to answering in
  // ~3 taps vs Today's Plan's ~6+ nav-into-lesson flow.
  document.getElementById('warmup-btn').addEventListener('click', () => {
    startWarmupSession();
  });

  // iter 71: 🏁 Section Speedrun — pick a section, race its L1 stream.
  // Closes iter-64 roadmap entry #2. Routes through picker (section list)
  // not direct session-start; users see all sections + their PBs first.
  document.getElementById('speedrun-btn').addEventListener('click', () => {
    startSpeedrunPicker();
  });

  // iter 125: 🥊 Pattern-Family Gauntlet — chained all-L1 untimed session
  // across every full lesson in one section. Cousin to Speedrun (1 L1/lesson
  // + stopwatch); Gauntlet is deep-on-one-family. Closes iter-124 roadmap #1
  // — first Cat 2 Active list refill since iter 45 (78+ iters stale).
  document.getElementById('gauntlet-btn').addEventListener('click', () => {
    startGauntletPicker();
  });

  // iter 73: 🪲 Bug-Hunt — §9B code-evaluation drill. Auto-mutator picks
  // a breaking mutation on a real patterns canonical; user taps the buggy
  // line. First §9B surface — closes the iter-36 cross-cutting gap.
  document.getElementById('bug-hunt-btn').addEventListener('click', () => {
    startBugHuntSession();
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
    state.currentLessonId = due[0];
    state.currentTab = coarse ? 'L2' : 'L3';
    syncBinderToLesson(due[0]);
    saveProgress();
    renderSidebar();
    await loadLessonContent(due[0]);
    if (state.currentLessonId === due[0]) renderLesson();
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

  // Path View toggle — filters the sidebar to the subscribed path's lessons.
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

  // iter 104: 🗺 Command Palette — Cmd-K / Ctrl-K opens overlay with fuzzy
  // search across sidebar buttons + lessons + sections. Closes the 33-button
  // discoverability decay the recent ship-spree caused. First REORGANIZE-not-
  // ADD surface. Results ranked by recent-use frequency from state.commandUsage.
  const paletteOverlay = document.getElementById('palette-overlay');
  const paletteInput = document.getElementById('palette-input');
  const paletteResults = document.getElementById('palette-results');
  const paletteTrigger = document.getElementById('palette-trigger');
  let _paletteItems = []; // [{ id, label, kind, hint?, action }]
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
    _paletteItems = _paletteBuildIndex();
    paletteInput.value = '';
    _paletteCursor = 0;
    paletteOverlay.classList.remove('hidden');
    _paletteRender();
    setTimeout(() => paletteInput.focus(), 0);
  }
  function _paletteClose() {
    paletteOverlay.classList.add('hidden');
    paletteInput.value = '';
    _paletteFiltered = [];
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

  // Mobile drawer wiring
  document.getElementById('hamburger').addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
  });
  document.getElementById('sidebar-backdrop').addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
  });

  // Weak-spot button — jump to the lesson with the most L1 misses
  document.getElementById('weak-btn').addEventListener('click', () => {
    const id = topWeakLessonId();
    if (id) {
      state.currentLessonId = id;
      state.currentTab = 'L1';
      syncBinderToLesson(id);
      saveProgress();
      renderSidebar();
      renderLesson();
    }
  });

  // iter 56: 🃏 Reveal Replay — route to the next revealed lesson + level.
  // Closes iter-55 roadmap #2 (constraint-aware reframe from vision iter 55).
  // The queue is just the surface that GUIDES the user; the clean-pass
  // clear-flag invariant in markPassed works generally so clears also fire
  // when the user finds a revealed lesson via normal navigation.
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
      body.innerHTML = rows.map(r => {
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
  // iter 65: 💀 Resurrect — jump to most-overdue mastered lesson at L1.
  // On touch devices land on L2 (mirror Review-button pattern); on fine
  // pointer land on L3 — same recall calibration the SR ladder uses.
  document.getElementById('resurrect-btn').addEventListener('click', () => {
    const ids = resurrectIds();
    if (!ids.length) return;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    state.currentLessonId = ids[0];
    state.currentTab = coarse ? 'L2' : 'L3';
    syncBinderToLesson(ids[0]);
    saveProgress();
    renderSidebar();
    renderLesson();
    _updateHash();
    if (window.matchMedia('(max-width: 767px)').matches) {
      document.body.classList.remove('sidebar-open');
    }
  });

  // iter 94: 🧠 Bridge — route to a cross-track transfer-gap lesson. Picks
  // the first candidate from `_bridgeCandidates()` (one per gap-mechanic,
  // deterministic by MECHANIC_INDEX iteration order). Lands on L1 with a
  // 2.2-sec fuchsia toast prefacing the transfer context. Closes iter-90
  // roadmap #3 (the last queued entry).
  const bridgeBtnEl = document.getElementById('bridge-btn');
  if (bridgeBtnEl) bridgeBtnEl.addEventListener('click', () => {
    const candidates = _bridgeCandidates();
    if (!candidates.length) return;
    const pick = candidates[0];
    state.currentLessonId = pick.targetLessonId;
    state.currentTab = 'L1';
    syncBinderToLesson(pick.targetLessonId);
    saveProgress();
    renderSidebar();
    renderLesson();
    _updateHash();
    if (window.matchMedia('(max-width: 767px)').matches) {
      document.body.classList.remove('sidebar-open');
    }
    _showBridgeToast(pick);
  });

  document.getElementById('at-risk-btn').addEventListener('click', openAtRisk);
  document.getElementById('at-risk-close').addEventListener('click', () => atRiskModal.style.display = 'none');
  atRiskModal.addEventListener('click', (e) => {
    if (e.target === atRiskModal) atRiskModal.style.display = 'none';
  });

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

  document.getElementById('reveal-replay-btn').addEventListener('click', () => {
    const queue = _revealedQueue();
    if (!queue.length) return;
    // Drop the current lesson's reveal tracker BEFORE routing so the user
    // gets a clean attempt window on arrival (lets the clean-pass invariant
    // fire even if they were just on this lesson).
    if (state.currentLessonId) delete _revealedInCurrentAttempt[state.currentLessonId];
    const next = queue[0];
    state.currentLessonId = next.lessonId;
    state.currentTab = next.level;
    delete _revealedInCurrentAttempt[next.lessonId];
    syncBinderToLesson(next.lessonId);
    saveProgress();
    renderSidebar();
    renderLesson();
    _updateHash();
    if (window.matchMedia('(max-width: 767px)').matches) {
      document.body.classList.remove('sidebar-open');
    }
  });

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
          <div style="font-size: 28px; color: #10b981; font-weight: 700;">${mastered} / ${fullLessons.length}</div>
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

  // Today's plan modal
  const todayModal = document.getElementById('today-modal');
  function openToday() {
    const plan = dailyPlan();
    const body = document.getElementById('today-body');
    if (!plan.length) {
      body.innerHTML = `<div style="color:#94a3b8;text-align:center;padding:24px 0;">Nothing queued — you're caught up! 🎉<br><br>Pick a lesson from the sidebar or try Mock Interview.</div>`;
    } else {
      body.innerHTML = plan.map(({ id, why }) => {
        const lesson = findLesson(id);
        const colors = { 'review due': '#67e8f9', 'next on path': '#93c5fd', 'weak spot': '#fdba74' };
        return `<button data-lesson-id="${escapeHtml(id)}" style="text-align:left; padding:12px 14px; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#e2e8f0; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
          <span><span style="color:#94a3b8; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; margin-right:8px;">${escapeHtml((TRACK_PILLS[lesson?.track] || TRACK_PILLS.patterns).label)}</span>${escapeHtml(lesson?.title || id)}</span>
          <span style="color:${colors[why] || '#94a3b8'}; font-size:11px;">${escapeHtml(why)}</span>
        </button>`;
      }).join('');
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
  document.getElementById('topbar-cram-progress').addEventListener('click', () => openTodaysPlan());

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
  todayModal.addEventListener('click', (e) => {
    if (e.target === todayModal) todayModal.style.display = 'none';
  });

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

  // Help modal close (open is wired in the keydown handler with `?`)
  const helpModal = document.getElementById('help-modal');
  document.getElementById('help-close').addEventListener('click', () => helpModal.style.display = 'none');
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.style.display = 'none';
  });

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
function updateOfflinePackChip() {
  // Paint the sidebar chip from state.offlinePack (last-known SW cache stats).
  // Hidden when 0 lessons cached (e.g., SW unsupported, first-load before
  // install completes, opted out) so first-time users don't see a confusing
  // "0 lessons" affordance.
  const btn = document.getElementById('offline-pack-btn');
  const cnt = document.getElementById('offline-pack-count');
  if (!btn || !cnt) return;
  const n = state.offlinePack?.lessonCount || 0;
  btn.classList.toggle('hidden', n === 0);
  cnt.textContent = String(n);
}
// iter 114: ☁️ Sync Onboarding — one-time hint banner promoting the existing
// `js/sync.js` top-right chip. Fires only when ALL conditions met:
//   - banner has never been shown/dismissed (state.syncHintShown === false)
//   - the user just passed L3 (commitment moment, not mid-drill — minimizes
//     friction-during-engagement per PROFILE "friction near zero")
//   - the user is on a desktop user-agent (fine pointer; cross-device
//     promotion is only meaningful if the user has *another* device)
//   - the Sync chip is actually mounted (js/sync.js has loaded and rendered)
// On Tap-Sync: synthetically click the existing #sync-chip (no duplicate auth
// logic). On Dismiss: just set the flag. Either way, banner self-removes.
function _isDesktopPointer() {
  if (!window.matchMedia) return true;
  // Fine pointer + non-mobile UA + viewport ≥ 768px = desktop.
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const wideViewport = window.matchMedia('(min-width: 768px)').matches;
  return finePointer && wideViewport;
}
function _maybeShowSyncHint() {
  if (state.syncHintShown) return;
  if (!_isDesktopPointer()) return;
  // SW + sync chip presence required — if js/sync.js failed to load or the
  // chip hasn't mounted yet, deferring is the right call (banner can fire
  // on a later L3 pass).
  if (!document.getElementById('sync-chip')) return;
  // Don't show if a sync session is already active (chip class is-on means
  // signed in; no point promoting what they're already using).
  const chip = document.getElementById('sync-chip');
  if (chip && chip.classList.contains('is-on')) {
    // User already adopted sync; mark flag to skip future evaluations.
    state.syncHintShown = true;
    saveProgress();
    return;
  }
  _showSyncHintBanner();
}
function _showSyncHintBanner() {
  if (document.getElementById('sync-hint-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'sync-hint-banner';
  banner.innerHTML = `
    <div class="sync-hint-body">
      <span class="sync-hint-icon">☁️</span>
      <div class="sync-hint-text">
        <div class="sync-hint-title">Drilling on multiple devices?</div>
        <div class="sync-hint-sub">Your phone progress and laptop progress are separate today. Tap Sync to merge them across devices.</div>
      </div>
      <div class="sync-hint-actions">
        <button class="sync-hint-action sync-hint-tap" data-action="tap-sync">Tap Sync</button>
        <button class="sync-hint-action sync-hint-dismiss" data-action="dismiss">Dismiss</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);
  // Slide-in via requestAnimationFrame so the initial transform is paintable.
  requestAnimationFrame(() => banner.classList.add('sync-hint-show'));
  const close = (alsoTapChip) => {
    state.syncHintShown = true;
    saveProgress();
    banner.classList.remove('sync-hint-show');
    setTimeout(() => banner.remove(), 250);
    if (alsoTapChip) {
      const chip = document.getElementById('sync-chip');
      if (chip) chip.click();
    }
  };
  banner.querySelector('[data-action="tap-sync"]').addEventListener('click', () => close(true));
  banner.querySelector('[data-action="dismiss"]').addEventListener('click', () => close(false));
}
// iter 117: 🎤 Clarify-First Ritual — opt-in pre-L3 tap-gate. When the user
// flips `state.clarifyRitualOn` on, every Patterns/Applied L3 visit shows a
// clarifier-chip card BEFORE the editor unlocks. Correct chips are mined from
// the lesson's `conversation.sections[0].say` bullet list (the existing
// "Restate & clarify" interview-narration content — 99 lessons authored);
// distractors come from `data/clarify-distractor-bank.json`. User taps chips
// in any order; correct taps mark green + count toward unlock; wrong taps
// mark red + increment state.clarify.attempts (signal not failure). When all
// correct chips are tapped → ritual completes + editor renders. Per-lesson
// per-session completion cached in `_clarifySessionCompleted` so the user
// doesn't re-do the ritual when they tab-switch back to L3. First Cat 9 §9A
// ship ever — drills the interview ritual the L1/L2/L3 ladder doesn't cover.
const _clarifySessionCompleted = new Set();
let _CLARIFY_BANK = null;
async function _clarifyLoadBank() {
  if (_CLARIFY_BANK) return _CLARIFY_BANK;
  try {
    const res = await fetch('data/clarify-distractor-bank.json', { cache: 'no-cache' });
    const body = await res.json();
    _CLARIFY_BANK = Array.isArray(body.distractors) ? body.distractors : [];
  } catch (_) {
    _CLARIFY_BANK = [];
  }
  return _CLARIFY_BANK;
}
function _clarifyExtractBullets(say) {
  // The conversation.sections[0].say is a paragraph with embedded bullet
  // questions. Format is consistent across 99/99 lessons: bullet lines
  // start with "• ". Extract each as a chip-sized clarifier question.
  if (typeof say !== 'string') return [];
  const lines = say.split(/\r?\n/);
  const bullets = [];
  for (const line of lines) {
    const m = line.match(/^\s*•\s+(.+?)\s*$/);
    if (m && m[1]) bullets.push(m[1]);
  }
  return bullets;
}
function _clarifyShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function _clarifyBuildCard(lesson, content, bank) {
  const say = content?.conversation?.sections?.[0]?.say;
  const bullets = _clarifyExtractBullets(say);
  if (bullets.length < 2) return null;
  // Cap correct picks at 3 to keep the card tappable on mobile.
  const correct = _clarifyShuffle(bullets).slice(0, Math.min(3, bullets.length));
  // 2-3 distractors from the bank, never duplicating a correct chip's text.
  const distractorPool = (bank || []).filter(d => !correct.includes(d));
  const distractorCount = Math.max(2, 6 - correct.length);
  const distractors = _clarifyShuffle(distractorPool).slice(0, distractorCount);
  const chips = _clarifyShuffle(
    correct.map(text => ({ text, isCorrect: true }))
      .concat(distractors.map(text => ({ text, isCorrect: false })))
  );
  return { chips, correctCount: correct.length };
}
function _renderClarifyRitual(body, lesson, content) {
  body.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'clarify-shell';
  wrap.innerHTML = `
    <div class="clarify-header">
      <span class="clarify-tag">🎤 Clarify-First · before you code</span>
      <button class="clarify-skip" data-action="clarify-skip" type="button">Skip this time →</button>
    </div>
    <div class="clarify-instructions">
      Real interviewers grade the <strong>questions you ask before coding</strong>. Tap the chips that are valid clarifiers for THIS problem — ignore the off-topic ones.
    </div>
    <div class="clarify-card" data-clarify-card>
      <div class="clarify-loading">Loading clarifiers…</div>
    </div>
  `;
  body.appendChild(wrap);
  wrap.querySelector('[data-action="clarify-skip"]').addEventListener('click', () => {
    _clarifySessionCompleted.add(lesson.id);
    // Re-render — the early-return gate now lets the normal L3 editor through.
    renderLesson();
  });
  const cardEl = wrap.querySelector('[data-clarify-card]');
  _clarifyLoadBank().then(bank => {
    const card = _clarifyBuildCard(lesson, content, bank);
    if (!card) {
      // No bullets available (Syntax lessons or malformed Conv data) — let editor through.
      _clarifySessionCompleted.add(lesson.id);
      renderLesson();
      return;
    }
    state.clarify.sessions++;
    state.clarify.lastRunAt = Date.now();
    saveProgress();
    let correctTapped = 0;
    cardEl.innerHTML = `
      <div class="clarify-progress" data-clarify-progress>
        Tapped <strong data-clarify-counter>0</strong> of <strong>${card.correctCount}</strong> valid clarifiers
      </div>
      <div class="clarify-chips">
        ${card.chips.map((c, i) => `
          <button class="clarify-chip" data-chip="${i}" data-correct="${c.isCorrect ? '1' : '0'}" type="button">
            ${escapeHtml(c.text)}
          </button>
        `).join('')}
      </div>
    `;
    const chipBtns = cardEl.querySelectorAll('.clarify-chip');
    chipBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('clarify-chip-correct') || btn.classList.contains('clarify-chip-wrong')) return;
        const isCorrect = btn.dataset.correct === '1';
        state.clarify.attempts++;
        if (isCorrect) {
          state.clarify.correct++;
          btn.classList.add('clarify-chip-correct');
          btn.disabled = true;
          correctTapped++;
          const cnt = cardEl.querySelector('[data-clarify-counter]');
          if (cnt) cnt.textContent = String(correctTapped);
          if (correctTapped >= card.correctCount) {
            state.clarify.completed++;
            saveProgress();
            _clarifySessionCompleted.add(lesson.id);
            const progress = cardEl.querySelector('[data-clarify-progress]');
            if (progress) progress.innerHTML = '<strong style="color:#a3e635">✓ Ritual complete — unlocking editor…</strong>';
            setTimeout(() => renderLesson(), 700);
          } else {
            saveProgress();
          }
        } else {
          btn.classList.add('clarify-chip-wrong');
          btn.disabled = true;
          saveProgress();
        }
      });
    });
  });
}
// iter 118: 🔥 Hot-Seat Follow-Up — opt-in post-L3-pass tap-card. When the
// user flips `state.hotseatOn` on, every L3 pass on a Patterns/Applied lesson
// surfaces a centered modal with one mechanic-tag-derived follow-up (mined
// from `data/hotseat-followups.json` byMechanic map) + 3 distractors picked
// from OTHER mechanics' follow-ups (interviewer-shaped but clearly wrong for
// THIS problem). User picks the right answer; correct increments
// state.hotseat.correct; wrong increments state.hotseat.attempts and shows
// red marker but doesn't block. Continue button closes; Skip available always.
// Bypassed during Mock Interview (no scaffolding by design). Pairs with
// iter-117 Clarify-First to cover both ENDS of the interview interaction.
let _HOTSEAT_REGISTRY = null;
async function _hotseatLoadRegistry() {
  if (_HOTSEAT_REGISTRY) return _HOTSEAT_REGISTRY;
  try {
    const res = await fetch('data/hotseat-followups.json', { cache: 'no-cache' });
    const body = await res.json();
    _HOTSEAT_REGISTRY = {
      byMechanic: body.byMechanic && typeof body.byMechanic === 'object' ? body.byMechanic : {},
      default: typeof body.default === 'string' ? body.default : 'Now optimize for space — can you do it with less extra memory?'
    };
  } catch (_) {
    _HOTSEAT_REGISTRY = { byMechanic: {}, default: 'Now describe one edge case the canonical might still miss.' };
  }
  return _HOTSEAT_REGISTRY;
}
function _hotseatLessonMechanicIds(lesson, content) {
  // Mechanics may live on the lesson stub (manifest) OR inside the loaded content.
  const raw = (content && Array.isArray(content.mechanics) && content.mechanics.length > 0)
    ? content.mechanics
    : (Array.isArray(lesson?.mechanics) ? lesson.mechanics : []);
  const ids = [];
  for (const m of raw) {
    if (typeof m === 'string') ids.push(m);
    else if (m && typeof m === 'object') {
      if (m.id) ids.push(m.id);
      else if (m.label) ids.push(m.label);
    }
  }
  return ids;
}
function _hotseatShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function _hotseatBuildCard(lesson, content, registry) {
  const lessonIds = _hotseatLessonMechanicIds(lesson, content);
  let correctText = null;
  let matchedMechanicId = null;
  for (const id of lessonIds) {
    if (registry.byMechanic[id]) {
      correctText = registry.byMechanic[id];
      matchedMechanicId = id;
      break;
    }
  }
  if (!correctText) {
    correctText = registry.default;
  }
  // Distractor pool = all registry follow-ups whose mechanic is NOT in this
  // lesson's mechanics[] (so they sound interviewer-shaped but are clearly
  // wrong for THIS problem).
  const lessonSet = new Set(lessonIds);
  const distractorPool = Object.entries(registry.byMechanic)
    .filter(([mid, text]) => !lessonSet.has(mid) && text !== correctText)
    .map(([_, text]) => text);
  const distractors = _hotseatShuffle(distractorPool).slice(0, 3);
  if (distractors.length < 3) return null;
  const options = _hotseatShuffle([
    { text: correctText, isCorrect: true },
    ...distractors.map(text => ({ text, isCorrect: false }))
  ]);
  return { options, matchedMechanicId };
}
function _maybeShowHotseat(lessonId) {
  if (!state.hotseatOn) return;
  // Bypass during Mock Interview (no scaffolding by design).
  if (state.mock.active && state.mock.lessonId === lessonId) return;
  const lesson = findLesson(lessonId);
  if (!lesson || (lesson.track !== 'patterns' && lesson.track !== 'applied')) return;
  const content = CONTENT[lessonId];
  if (!content) return;
  _hotseatLoadRegistry().then(registry => {
    const card = _hotseatBuildCard(lesson, content, registry);
    if (!card) return;
    _showHotseatModal(lesson, card);
  });
}
function _showHotseatModal(lesson, card) {
  if (document.getElementById('hotseat-modal')) return;
  state.hotseat.sessions++;
  state.hotseat.lastRunAt = Date.now();
  saveProgress();
  let resolved = false;
  let firstTapWasCorrect = false;
  const modal = document.createElement('div');
  modal.id = 'hotseat-modal';
  modal.innerHTML = `
    <div class="hotseat-scrim" data-action="hotseat-skip"></div>
    <div class="hotseat-card" role="dialog" aria-labelledby="hotseat-title">
      <div class="hotseat-header">
        <span class="hotseat-tag">🔥 Hot-Seat · interviewer follow-up</span>
        <button class="hotseat-skip" data-action="hotseat-skip" type="button" aria-label="Skip">✕</button>
      </div>
      <div class="hotseat-prompt" id="hotseat-title">
        You passed <strong>${escapeHtml(lesson.title)}</strong>. The interviewer leans in:
      </div>
      <div class="hotseat-options">
        ${card.options.map((o, i) => `
          <button class="hotseat-option" data-opt="${i}" data-correct="${o.isCorrect ? '1' : '0'}" type="button">
            ${escapeHtml(o.text)}
          </button>
        `).join('')}
      </div>
      <div class="hotseat-feedback" data-hotseat-feedback></div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => {
    modal.remove();
  };
  // Skip via scrim click + skip button + Esc.
  modal.querySelectorAll('[data-action="hotseat-skip"]').forEach(el => el.addEventListener('click', close));
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  const optBtns = modal.querySelectorAll('.hotseat-option');
  optBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('hotseat-option-correct') || btn.classList.contains('hotseat-option-wrong')) return;
      const isCorrect = btn.dataset.correct === '1';
      state.hotseat.attempts++;
      if (isCorrect) {
        if (!resolved) firstTapWasCorrect = true;
        state.hotseat.correct++;
        btn.classList.add('hotseat-option-correct');
        optBtns.forEach(b => { if (b !== btn) b.disabled = true; });
        resolved = true;
        const fb = modal.querySelector('[data-hotseat-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="hotseat-resolved">
              <div class="hotseat-resolved-text">${firstTapWasCorrect ? '✓ First-try correct.' : '✓ Got it.'} That's the follow-up an interviewer would push.</div>
              <button class="hotseat-continue" data-action="hotseat-continue" type="button">Continue →</button>
            </div>
          `;
          fb.querySelector('[data-action="hotseat-continue"]').addEventListener('click', close);
        }
      } else {
        btn.classList.add('hotseat-option-wrong');
        btn.disabled = true;
      }
      saveProgress();
    });
  });
}
// iter 119: ⏱ Time-to-Solve Calibration — opt-in pre-L3 estimate strip.
// When toggle on + Patterns/Applied + not Mock + not yet estimated/skipped
// for this lesson this session: render a 4-bucket tap strip at TOP of L3
// wrap. Tap → record bucket + start timer; user proceeds to drill. On L3
// pass with active estimate → compute delta + store per lesson.mechanics[]
// tag in state.timeCalibration.byMechanic[id].predictions[].
// Stats tile DEFERRED to v2 — data captured this iter for soak window.
const _calibrationEstimated = new Set();  // lessonIds estimated this session
const _calibrationSkipped = new Set();     // lessonIds explicitly skipped this session
const _calibrationActive = {};              // lessonId → { bucket, startedAt }
const CALIBRATION_BUCKET_MIDPOINT_SEC = {
  // Midpoints used for absError computation against actual seconds.
  'lt2': 90, '2to5': 210, '5to10': 450, 'gt10': 900
};
function _calibrationMaybeInject(lesson, wrap) {
  if (!state.calibrateOn) return;
  if (state.mock.active && state.mock.lessonId === lesson.id) return;
  if (lesson.track !== 'patterns' && lesson.track !== 'applied') return;
  if (_calibrationEstimated.has(lesson.id) || _calibrationSkipped.has(lesson.id)) return;
  const strip = document.createElement('div');
  strip.className = 'calib-strip';
  strip.innerHTML = `
    <div class="calib-prompt">⏱ Quick estimate — how long until L3 passes?</div>
    <div class="calib-buckets">
      <button class="calib-bucket" data-bucket="lt2" type="button">&lt; 2 min</button>
      <button class="calib-bucket" data-bucket="2to5" type="button">2–5 min</button>
      <button class="calib-bucket" data-bucket="5to10" type="button">5–10 min</button>
      <button class="calib-bucket" data-bucket="gt10" type="button">10+ min</button>
      <button class="calib-skip" data-action="calib-skip" type="button">Skip</button>
    </div>
  `;
  wrap.insertBefore(strip, wrap.firstChild);
  strip.querySelectorAll('.calib-bucket').forEach(btn => {
    btn.addEventListener('click', () => {
      const bucket = btn.dataset.bucket;
      _calibrationEstimated.add(lesson.id);
      _calibrationActive[lesson.id] = { bucket, startedAt: Date.now() };
      state.timeCalibration.meta.estimates++;
      saveProgress();
      strip.remove();
    });
  });
  strip.querySelector('[data-action="calib-skip"]').addEventListener('click', () => {
    _calibrationSkipped.add(lesson.id);
    state.timeCalibration.meta.skips++;
    saveProgress();
    strip.remove();
  });
}
function _calibrationRecordPass(lessonId) {
  const entry = _calibrationActive[lessonId];
  if (!entry) return;
  delete _calibrationActive[lessonId];
  const lesson = findLesson(lessonId);
  const content = CONTENT[lessonId];
  if (!lesson || !content) return;
  const mechs = Array.isArray(content.mechanics) ? content.mechanics : [];
  if (mechs.length === 0) return;
  const actualSec = Math.round((Date.now() - entry.startedAt) / 1000);
  const midpoint = CALIBRATION_BUCKET_MIDPOINT_SEC[entry.bucket] || 300;
  const errorSec = Math.abs(actualSec - midpoint);
  for (const m of mechs) {
    const id = typeof m === 'string' ? m : (m.id || m.label);
    if (!id) continue;
    if (!state.timeCalibration.byMechanic[id]) {
      state.timeCalibration.byMechanic[id] = { predictions: [] };
    }
    state.timeCalibration.byMechanic[id].predictions.push({
      bucket: entry.bucket, actualSec, errorSec, at: Date.now()
    });
    // Cap to last 50 per mechanic to bound storage growth.
    const preds = state.timeCalibration.byMechanic[id].predictions;
    if (preds.length > 50) state.timeCalibration.byMechanic[id].predictions = preds.slice(-50);
  }
  state.timeCalibration.meta.passes++;
  saveProgress();
}
function pollOfflinePackStats() {
  // Send a postMessage to the active service worker; on reply, update
  // state.offlinePack + the chip. No-op if the SW isn't yet controlling
  // the page (first-visit-pre-install OR unsupported browser).
  if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  const channel = new MessageChannel();
  channel.port1.onmessage = (event) => {
    const d = event.data || {};
    if (d.type !== 'cache-stats-result') return;
    const next = {
      lessonCount: +d.lessonCount || 0,
      totalCount: +d.totalCount || 0,
      lastCheckedAt: Date.now()
    };
    const changed = next.lessonCount !== state.offlinePack.lessonCount
      || next.totalCount !== state.offlinePack.totalCount;
    state.offlinePack = next;
    if (changed) saveProgress();
    updateOfflinePackChip();
  };
  try {
    navigator.serviceWorker.controller.postMessage({ type: 'cache-stats' }, [channel.port2]);
  } catch (_) { /* SW gone between check and post — ignore */ }
}
init().catch(err => console.error(err));

// ────────────────────────────────────────────────────────────────────────
// iter 127: top-bar dropdown shell (Phase 2 of the nav refactor epic).
// Single dropdown panel anchored under the topbar; opens with content
// populated by whichever menu button (Practice/Drills/Train/Insights) or
// the ⚙️ Settings icon was clicked. Phase 3 (iter 128) fills the menus
// with actual mode-launchers; Phase 2 ships the shell + open/close JS only.
//
// The existing sidebar buttons remain wired for this phase so nothing
// breaks — the user can reach every drill via either the sidebar OR (in
// Phase 3) the topbar dropdowns. Phase 4 removes the sidebar buttons.
// ────────────────────────────────────────────────────────────────────────

// iter 128 — Phase 3 of the topbar nav refactor epic. Each menu emits
// .topbar-item rows that synthetically click the corresponding sidebar
// button (same pattern as iter-104 Cmd-K palette — zero duplicate handlers).
// Taxonomy honors iter-127's stub strings verbatim:
//   Practice — sessions + picks (Mock, Today's Plan, Lucky, Shuffle, Replay, Weak, Review, At Risk, Warmup)
//   Drills — mode-launchers (Predict, Bug-Hunt, Recognize, Reverse, Match, Trace-Hop, Reverse-Walk, What-If, Notes, Locate, Claim, Gotcha, Swap, Conv, Constellation, Clarify, Hot-Seat)
//   Train — timed streams (Rapid, Big-O, Speedrun, Gauntlet)
//   Insights — visualizations (Stats, Streak, Sections, Mechanics, Cheatsheet, AI Coach)
//   Settings — toggles (Hide Mastered, Path View, Calibrate), Data (Backup/Restore), Reset
const TOPBAR_MENU_TAXONOMY = {
  practice: {
    label: 'Practice',
    blurb: 'Sessions + picks — what to drill next.',
    items: [
      'today-btn', 'mock-btn', 'warmup-btn', 'lucky-btn', 'shuffle-btn',
      'review-btn', 'weak-btn', 'at-risk-btn', 'reveal-replay-btn',
      'resurrect-btn', 'bridge-btn'
    ]
  },
  drills: {
    label: 'Drills',
    blurb: 'Single-mode recall surfaces — pick a recall direction.',
    items: [
      'crystal-btn', 'bug-hunt-btn', 'recognize-btn', 'reverse-btn',
      'match-btn', 'trace-hop-btn', 'reverse-walk-btn', 'whatif-btn',
      'mutate-btn', 'constraint-shift-btn',
      'notes-drill-btn', 'notes-locate-btn', 'claim-btn', 'gotcha-btn',
      'swap-btn', 'conv-drill-btn', 'constellation-btn',
      'clarify-ritual-btn', 'hotseat-btn'
    ]
  },
  train: {
    label: 'Train',
    blurb: 'Cross-lesson timed and coverage streams.',
    items: ['rapid-fire-btn', 'big-o-btn', 'speedrun-btn', 'gauntlet-btn', 'phone-screen-btn']
  },
  insights: {
    label: 'Insights',
    blurb: 'Visualizations and cross-lesson read-only views.',
    items: ['stats-btn', 'streak-map-btn', 'sections-grid-btn', 'mechanics-btn', 'export-btn', 'ai-coach-btn',
            'cram-cheat-btn', 'cram-glossary-btn', 'cram-behavior-btn', 'cram-shapes-btn', 'cram-review-btn']
  },
  settings: {
    label: 'Settings',
    blurb: 'Toggles, data, and account.',
    items: ['hide-mastered-btn', 'path-btn', 'calibrate-btn', 'pace-bar-btn', 'haptic-btn', 'install-btn', 'offline-pack-btn', 'backup-btn', 'restore-btn', 'reset-btn']
  }
};

// Pull display data from the sidebar button itself so the taxonomy stays
// DRY: button label is the source of truth, descriptions come from the
// `title` attribute the sidebar buttons already populate for hover-help.
// Returns null when the button is missing OR currently hidden (the
// conditional sidebar buttons — Review/Weak/At Risk/etc. — use a `hidden`
// class until the underlying state populates them; menu items follow the
// same actionability gate so we don't list dead clicks).
function _topbarItemFromButton(btn) {
  if (!btn) return null;
  if (btn.classList.contains('hidden')) return null;
  // iter 141: also respect style.display === 'none' so capability-gated
  // buttons (e.g. #haptic-btn hidden on iOS Safari where navigator.vibrate
  // is undefined) don't leak into the topbar menu. The .hidden class covers
  // dynamic empty-state hides (Review/Weak/At-Risk); style.display covers
  // permanent platform-capability hides.
  if (btn.style.display === 'none') return null;
  const cloned = btn.cloneNode(true);
  // Strip count spans (e.g. <span id="review-count">0</span>) so the label
  // doesn't carry "Review (0)" into the menu.
  cloned.querySelectorAll('[id$="-count"]').forEach(el => el.remove());
  // Collapse whitespace + strip empty parens left behind by the span removal.
  const text = cloned.textContent.trim().replace(/\s*\(\s*\)\s*$/, '').replace(/\s+/g, ' ').trim();
  // Split on first whitespace: emoji prefix + label tail. Plain-text buttons
  // (Reset / Backup / Restore) have no leading emoji — emoji becomes ''.
  const spaceIdx = text.indexOf(' ');
  let emoji = '', label = text;
  if (spaceIdx > 0) {
    const first = text.slice(0, spaceIdx);
    // Heuristic: if the first token contains any non-ASCII byte, treat it
    // as an emoji/symbol; otherwise it's part of the label.
    if (/[^\x00-\x7f]/.test(first)) {
      emoji = first;
      label = text.slice(spaceIdx + 1).trim();
    }
  }
  const desc = (btn.getAttribute('title') || '').trim();
  return { id: btn.id, emoji, label, desc };
}

function renderTopbarMenuContents(menuKey) {
  // iter 130 Phase 5: mobile-only "Browse" entry point. The 4 .topbar-menu
  // buttons are hidden on mobile via the iter-127 media query, so this view
  // exposes the categories as tappable rows. Clicking a row re-renders the
  // dropdown with that category's items (delegated in initTopbarDropdowns).
  if (menuKey === 'mobile-browse') {
    const cats = ['practice', 'drills', 'train', 'insights'];
    const blurb = `<div class="topbar-menu-blurb">Browse modes by category. (Or use 🔍 to search by name, ⚙️ for toggles.)</div>`;
    const rows = cats.map(key => {
      const cat = TOPBAR_MENU_TAXONOMY[key];
      if (!cat) return '';
      return `<button class="topbar-item-mobile-cat" role="menuitem" data-mobile-cat="${escapeHtml(key)}">
        <div class="topbar-item-text">
          <div class="topbar-item-name">${escapeHtml(cat.label)} <span class="topbar-item-caret" aria-hidden="true">▸</span></div>
          <div class="topbar-item-desc">${escapeHtml(cat.blurb)}</div>
        </div>
      </button>`;
    }).join('');
    return blurb + rows;
  }
  const cat = TOPBAR_MENU_TAXONOMY[menuKey];
  if (!cat) {
    return `<div class="topbar-dropdown-stub">Menu "${escapeHtml(menuKey)}" not configured.</div>`;
  }
  const items = cat.items.map(id => _topbarItemFromButton(document.getElementById(id))).filter(Boolean);
  if (!items.length) {
    return `<div class="topbar-dropdown-stub">Nothing actionable in <b>${escapeHtml(cat.label)}</b> right now — try again once you've drilled a few lessons.</div>`;
  }
  const blurb = cat.blurb
    ? `<div class="topbar-menu-blurb">${escapeHtml(cat.blurb)}</div>`
    : '';
  const rows = items.map(it => `
    <button class="topbar-item" role="menuitem" data-btn-id="${escapeHtml(it.id)}">
      <span class="topbar-item-emoji" aria-hidden="true">${escapeHtml(it.emoji)}</span>
      <div class="topbar-item-text">
        <div class="topbar-item-name">${escapeHtml(it.label)}</div>
        ${it.desc ? `<div class="topbar-item-desc">${escapeHtml(it.desc)}</div>` : ''}
      </div>
    </button>
  `).join('');
  return blurb + rows;
}

function initTopbarDropdowns() {
  const topbar = document.getElementById('topbar');
  if (!topbar) return; // defensive — non-app pages won't have it
  const dropdown = document.getElementById('topbar-dropdown');
  const body = dropdown ? dropdown.querySelector('.topbar-dropdown-body') : null;
  if (!dropdown || !body) return;

  let openMenu = null;

  function close() {
    if (!openMenu) return;
    openMenu.setAttribute('aria-expanded', 'false');
    openMenu = null;
    dropdown.classList.add('hidden');
    dropdown.setAttribute('aria-hidden', 'true');
    body.innerHTML = '';
  }

  function open(menuButton) {
    if (openMenu === menuButton) { close(); return; }
    if (openMenu) {
      openMenu.setAttribute('aria-expanded', 'false');
    }
    openMenu = menuButton;
    menuButton.setAttribute('aria-expanded', 'true');
    const menuKey = menuButton.getAttribute('data-menu') || menuButton.id.replace(/^topbar-/, '') || 'settings';
    body.innerHTML = renderTopbarMenuContents(menuKey);
    dropdown.classList.remove('hidden');
    dropdown.setAttribute('aria-hidden', 'false');
  }

  topbar.querySelectorAll('.topbar-menu').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); open(btn); });
  });
  const settingsBtn = document.getElementById('topbar-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); open(settingsBtn); });
  }

  // iter 130 Phase 5: mobile-only 📂 Browse button — opens the dropdown
  // with menuKey='mobile-browse', which renders 4 category rows. The
  // open() helper derives menuKey from `data-menu` || id.replace('topbar-',''),
  // so this id 'topbar-mobile-menu' resolves to menuKey='mobile-menu'. We
  // want 'mobile-browse' instead, so we set the data-menu attribute below
  // OR special-case the open(). Cleanest: set data-menu on the button.
  const mobileMenuBtn = document.getElementById('topbar-mobile-menu');
  if (mobileMenuBtn) {
    mobileMenuBtn.setAttribute('data-menu', 'mobile-browse');
    mobileMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); open(mobileMenuBtn); });
  }

  // iter 128 Phase 3: delegated click on .topbar-item → synth-click the
  // sidebar button it references. Close the dropdown first so the synth
  // click's downstream UI (e.g. a modal opening) isn't visually fighting
  // the dropdown panel. Same pattern as iter-104 Cmd-K palette which also
  // synth-clicks sidebar buttons — zero duplicate handlers.
  body.addEventListener('click', (e) => {
    // iter 130 Phase 5: mobile category-picker row → drill into that
    // category's items WITHOUT closing the dropdown. Re-render body with
    // the selected category's content; aria-expanded on the mobile-menu
    // button stays true. Checked first because `.topbar-item-mobile-cat`
    // doesn't have data-btn-id (the synth-click branch below would no-op).
    // iter 133: prepend a `‹ Categories` back button so mobile users
    // can return to the category picker without re-tapping the 📂 Browse
    // button (1-tap instead of 2-tap).
    // iter 137: also prepend a category-name heading between the back
    // button and the blurb, so the user keeps visual orientation while
    // scrolling items ("which category am I in?" — the back button hints
    // it but a small bold heading is more readable when scrolled past).
    const catRow = e.target.closest('.topbar-item-mobile-cat');
    if (catRow) {
      e.stopPropagation();
      const key = catRow.dataset.mobileCat;
      if (key) {
        const cat = TOPBAR_MENU_TAXONOMY[key];
        const heading = cat
          ? `<div class="topbar-cat-heading" data-cat-heading="${escapeHtml(key)}">${escapeHtml(cat.label)}</div>`
          : '';
        body.innerHTML = `
          <button class="topbar-cat-back" data-cat-back type="button">‹ Categories</button>
          ${heading}
          ${renderTopbarMenuContents(key)}
        `;
      }
      return;
    }
    // iter 133: back-to-categories button reopens the mobile-browse picker.
    const backBtn = e.target.closest('[data-cat-back]');
    if (backBtn) {
      e.stopPropagation();
      body.innerHTML = renderTopbarMenuContents('mobile-browse');
      return;
    }
    const item = e.target.closest('.topbar-item');
    if (!item) return;
    e.stopPropagation();
    const btnId = item.dataset.btnId;
    const target = btnId ? document.getElementById(btnId) : null;
    if (!target) return;
    close();
    target.click();
  });

  // ❓ Help icon — opens the existing help-modal (same as `?` keypress).
  const helpBtn = document.getElementById('topbar-help');
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      const helpModal = document.getElementById('help-modal');
      if (helpModal) helpModal.style.display = 'block';
    });
  }

  // Click anywhere outside the dropdown + menu strip closes it.
  document.addEventListener('click', (e) => {
    if (!openMenu) return;
    if (dropdown.contains(e.target)) return;
    if (e.target.closest('.topbar-menu')) return;
    if (e.target.id === 'topbar-settings') return;
    close();
  });

  // ESC closes (only if a topbar menu is the open thing — don't fight other ESC handlers).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openMenu) close();
  });
}

// Defer-loaded scripts run after DOM parse, so wiring synchronously is safe.
// Wrapped in a try/catch so a single missing element doesn't block init().
try { initTopbarDropdowns(); } catch (e) { console.warn('[topbar] init failed:', e); }
