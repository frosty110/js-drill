// ──────────────────────────────────────────────────────────────────────────
//  CORE MODULE IMPORTS — pure leaf utilities extracted to js/core/.
//  Loaded by index.html before this file; we destructure once here so the
//  rest of app.js can call them by the same names as before the split.
//  See js/core/util.js and js/core/runner.js for what lives where.
// ──────────────────────────────────────────────────────────────────────────
const {
  escapeHtml, formatTime, normalize, normalizeLines, outputsMatch,
  stripCommentsForDiff, lcsDiffRows, normalizeForDiff, inlineWordDiff,
  colorizeInto, renderFlash
} = window.DrillUtil;
const { formatArg, runCode, runCodeBudgeted } = window.DrillRunner;

// ──────────────────────────────────────────────────────────────────────────
//  LESSON LANGUAGE ('js' | 'ts')
//  A lesson body may declare `"lang": "ts"`, meaning every code string it
//  owns — reference, L2 templates, L3 canonical, and whatever the user types
//  into the editor for it — is TypeScript. The runner erases types before
//  executing; CodeMirror needs the matching mode to colour it.
//
//  Defaults to 'js', so the 168 lessons that predate TS support are wholly
//  unaffected by its absence.
// ──────────────────────────────────────────────────────────────────────────
function lessonLang(lessonOrId) {
  const body = typeof lessonOrId === 'string' ? CONTENT[lessonOrId] : lessonOrId;
  return (body && body.lang) === 'ts' ? 'ts' : 'js';
}

// CodeMirror ships TypeScript support inside its javascript mode, addressed
// by MIME — no extra <script> needed beyond the one index.html already loads.
function lessonCodeMode(lessonOrId) {
  return lessonLang(lessonOrId) === 'ts' ? 'text/typescript' : 'javascript';
}

// Fallback for runCode call sites that don't have the lesson in hand (the
// bug-hunt and notes→code drills build their editors from a drill object, not
// a lesson body). They always operate on the lesson the user currently has
// open, so resolving through state is correct for them.
window.DrillRunner.setLanguageResolver(() => lessonLang(state.currentLessonId));
window.DrillUtil.setCodeModeResolver(() => lessonCodeMode(state.currentLessonId));

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
        section: section.name, status: l.status,
        // Faceted-filter tags live on the manifest entry (alongside track/status)
        // so the sidebar can filter without lazy-loading each lesson body. Only
        // authored facets are stored here (difficulty/company); source(track) +
        // topic(section) are derived. See data/tags.json + tagMatch().
        tags: l.tags || null
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

// Predicate-targeted preloader (nav-audit P1-3). Deck-starved drills used to
// stop pre-loading at a raw CONTENT-count heuristic ("18 lessons loaded")
// regardless of whether the loaded lessons actually satisfied the deck's
// eligibility test — a fresh session then dead-ended into a native alert().
// This loads lessons from `lessons` (in order) until `want` of them satisfy
// `predicate(CONTENT[id])`, or `cap` fetches have been spent. Returns the
// number of satisfying lessons (callers still verify their deck builds).
async function _preloadUntil(lessons, predicate, opts = {}) {
  const want = opts.want ?? 8;
  const cap = opts.cap ?? 30;
  const count = () => lessons.reduce((n, l) => n + (predicate(CONTENT[l.id]) ? 1 : 0), 0);
  let fetched = 0;
  for (const l of lessons) {
    if (count() >= want || fetched >= cap) break;
    if (CONTENT[l.id]) continue;
    try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    fetched++;
  }
  return count();
}

// In-shell empty state for drill launch paths (nav-audit P1-3) — replaces the
// blocking native alert() dead-ends ("Click around a few patterns first…").
// Same shape Bug-Hunt's empty state already uses: message + Back into
// renderLesson(), plus an optional Try-again that re-invokes the starter
// (deck builds are probabilistic — a retry often succeeds). Native alert()
// stays banned from launch paths. Plain-text chrome only (D07 — no emoji).
function _drillEmptyState(title, message, opts = {}) {
  const shell = document.getElementById('lesson-shell');
  if (!shell) return;
  const retryBtn = typeof opts.retry === 'function'
    ? `<button class="primary" data-action="drill-empty-retry">Try again</button>` : '';
  shell.innerHTML = `
    <div class="bug-shell">
      <div class="bug-loading">${escapeHtml(title)}</div>
      <p style="color: var(--text-dim, #9aa1ab); font-size: 0.9rem; margin: 10px 0 0; text-align: center;">${escapeHtml(message)}</p>
      <div class="bug-summary-actions">
        ${retryBtn}
        <button class="secondary" data-action="drill-empty-back">Back</button>
      </div>
    </div>`;
  const retry = shell.querySelector('[data-action="drill-empty-retry"]');
  if (retry) retry.addEventListener('click', () => opts.retry());
  shell.querySelector('[data-action="drill-empty-back"]').addEventListener('click', () => renderLesson());
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
//  TAG REGISTRY (faceted filter over the merged Problems list)
//  Loaded once from data/tags.json. Four facets: source(Type) + topic derived
//  from track/section (no authoring); difficulty + company authored on the
//  manifest entry's `tags`. Filter semantics: AND across facets, OR within one.
// ──────────────────────────────────────────────────────────────────────────
let TAG_FACETS = [];                   // [{id,label,derived?,authored?,single?,values?}]
let _tagRegistryLoaded = false;

async function loadTagRegistry() {
  if (_tagRegistryLoaded) return;
  try {
    const res = await fetch('data/tags.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const reg = await res.json();
    TAG_FACETS = Array.isArray(reg.facets) ? reg.facets : [];
    _tagRegistryLoaded = true;
  } catch (e) {
    TAG_FACETS = [];   // missing registry just hides the facet row; fail soft
  }
}

// The value of a facet for one lesson. Derived facets read CURRICULUM fields;
// authored facets read the manifest-copied `tags`. Returns a string (single) or
// array (multi); null/[] means "untagged on this facet".
function facetValueOf(facet, lesson) {
  if (facet.id === 'source') return lesson.track;          // patterns | applied
  if (facet.id === 'topic')  return lesson.section;        // section IS the topic
  const t = lesson.tags || {};
  if (facet.id === 'difficulty') return t.difficulty || null;
  if (facet.id === 'company')    return Array.isArray(t.company) ? t.company : [];
  return null;
}

// Distinct topic values present in the merged Problems corpus, in manifest order
// (section is the topic; computed dynamically so it never drifts from content).
function problemsTopics() {
  const seen = new Set(), out = [];
  for (const l of CURRICULUM) {
    if (l.track !== 'patterns' && l.track !== 'applied') continue;
    if (!seen.has(l.section)) { seen.add(l.section); out.push(l.section); }
  }
  return out;
}

// True if a lesson passes the active tag filter. AND across facets that have any
// selection; OR within a facet's selected values. An untagged lesson is excluded
// only by a facet it has no value for (e.g. filtering Company hides untagged).
function tagMatch(lesson) {
  const sel = state.tagFilter || {};
  for (const facet of TAG_FACETS) {
    const chosen = sel[facet.id];
    if (!chosen || !chosen.length) continue;            // facet inactive
    const v = facetValueOf(facet, lesson);
    if (Array.isArray(v)) {
      if (!v.some(x => chosen.includes(x))) return false;
    } else {
      if (!chosen.includes(v)) return false;
    }
  }
  return true;
}

// Count of active facet selections across all facets (for the chip badge).
function tagFilterActiveCount() {
  const sel = state.tagFilter || {};
  return Object.values(sel).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
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
  swapBench: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0, pairs: {} }, // iter 86: 🔀 Swap-Bench — pairwise idiom-equivalence drill. iter eval-2026-05-30 added per-pair SR via `pairs[id] = { dueAt, interval }` (additive, no `__v` bump)
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
  adhdMode: false, // 🖍 ADHD Mode — opt-in toggle (default OFF) restyles the Conversation tab for focus: bionic word-heads (bold leading letters as fixation anchors), marker-highlight on backtick code terms (cyan in "What I'd say" blocks, amber in "Why this matters"), and looser line + section spacing. Render-time gated (bionic markup only emitted when ON); body.adhd-mode class drives the CSS. Conversation tab only.
  fontScale: 'lg', // 🔠 App-wide font size — 'md' (1.0×) | 'lg' (1.125×, default — bumps everything ~12.5% over the original baseline) | 'xl' (1.25×). Drives the --font-scale CSS variable on :root, which scales html font-size so every rem-based value (Tailwind text-* utilities, conv-* spacing, modal bodies, etc.) scales uniformly. Hard-coded pixel sizes (CodeMirror, .code-block) keep their explicit values so mobile density stays sane. Toggle via 🔠 Font in ⚙️ Settings; persisted across sessions.
  commandUsage: {}, // iter 104: 🗺 Sidebar Command Palette — `{ [commandId]: count }` recent-use counter for fuzzy-search ranking (additive, no `__v` bump)
  misses: {},          // iter 58: { lessonId: [{ at: ms, level: 'L1'|'L2'|'L3', tag: string }] } — Mistake Tagging Postmortem (additive, opt-in)
  subscribedPathId: 'starter', // which study plan the user is on — see PATHS registry. Routes the 📅 button. Progress is shared across paths (keyed by lesson id), so switching never resets mastery.
  cramTaskChecks: {},  // { taskId: true } — non-lesson task ticks for cram-kind paths (e.g. "write BFS on paper"). Lesson-linked tasks auto-check via isLessonFullyDone.
  cramView: { mode: 'today', dayIndex: -1 },  // active Cram Home view. mode: 'today' (live day) | 'day' (specific past/future day, dayIndex set) | 'all' (all days expanded) | 'open-from' (only !done items from dayIndex).
  cramReview: { items: {}, session: null },  // SR over cram glossary/cheat/behavior/code-shapes. items[itemId] = { familiarity 0-3, lastReviewedAt }. session = active queue { queue, index, revealed, gotIt, fuzzy } | null.
  glossaryQuiz: { sessions: 0, attempts: 0, correct: 0, lastRunAt: 0, perTerm: {}, session: null },  // MC quiz over cram glossary terms. Mixed direction (term→def + def→term), 10 cards/session. session = { queue, index, picked, correctCount } | null. perTerm[term] = { seen, correct }.
  walkthrough: {},  // iter eval-2026-05-30: { [lessonId]: { quizAttempts, quizCorrect, bugAttempts, bugCorrect, lastRunAt, scrubbed } } — Walkthrough tab Quiz/Bug outcome persistence + scrub-to-end flag for default-open-Quiz behavior (additive, no `__v` bump)
  flash: {},  // iter eval-2026-05-30: { [lessonId]: { attempts, blanks, lastRunAt } } — 🃏 Flash mode per-token self-rate persistence; "blanked" taps feed state.weakness on session threshold (additive, no `__v` bump)
  revealed: {},   // { lessonId: { L2: true, L3: true } } — track integrity
  revealedAt: {},        // { lessonId: { L2: epochMs } } — when the flag was SET; lets sync merge "newest event wins" instead of OR-resurrecting cleared rings
  revealedClearedAt: {}, // { lessonId: { L2: epochMs } } — when a clean pass CLEARED the flag (Reveal Replay invariant); newer clear beats a stale flag from another device
  partialL1: {},  // { lessonId: true } — L1 passed at ≥80%/miss-one but NOT 100%; drives the amber (vs emerald) ✓ and keeps the missed question(s) in the weakness queue for re-review
  lastLessonId: null, // persisted across sessions for resume
  lastTab: null,
  welcomed: false,    // hide welcome panel after first dismissal
  hideMastered: false, // sidebar filter: when true, drop fully-mastered lessons
  repairFilter: false, // Phase E: when true, sidebar shows ONLY lessons needing work (due/weak/overdue/reveal)
  tagFilter: {},      // faceted filter over the merged Problems list: { source:[], topic:[], difficulty:[], company:[] } (additive, no `__v` bump)
  tagFilterOpen: false, // UI: whether the sidebar tag-facet panel is expanded (additive)
  homeOpen: {},       // UI: which Home track cards are expanded into subcategories, { areaKey: true } (additive)
  reviews: {},        // { lessonId: { lastPassedAt: ms, interval: ms, dueAt: ms } }
  weakness: {},       // { lessonId: wrongL1Count } — tracks recurring L1 misses
  sidebarTrack: 'syntax', // 'syntax' | 'patterns' — which binder tab is active
  surface: 'reference',   // 'problems' | 'reference' — Reference=Syntax; Problems=Patterns+Applied. Kept consistent with sidebarTrack; the topbar segmented toggle flips it.
  surfaceCtx: { problems: null, reference: null }, // last lessonId per surface — lossless position memory across the toggle
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
