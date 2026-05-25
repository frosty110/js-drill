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
  subscribedPathId: 'starter', // which study plan the user is on — see PATHS registry. Routes the 📅 button. Progress is shared across paths (keyed by lesson id), so switching never resets mastery.
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
function appendHistory(lessonId, event) {
  if (!lessonId) return;
  if (!state.history[lessonId]) state.history[lessonId] = [];
  state.history[lessonId].push({ at: Date.now(), event });
  if (state.history[lessonId].length > HISTORY_MAX) {
    state.history[lessonId] = state.history[lessonId].slice(-HISTORY_MAX);
  }
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
// The 📅 Today's Plan button routes by the subscribed path's `kind`:
//   - 'lessons' → opens the in-app Today's Plan modal (curated due/path/weak session)
//   - 'prep'    → navigates to a standalone dashboard page (e.g. prep.html)
// The 🧭 Path View sidebar filter scopes the sidebar to the path's drill-lesson
// sequence (`lessonOrderKey` → resolved by getPathLessonOrder). A path with no
// drill-lesson mapping disables the 🧭 button.
// Progress is keyed by lesson id, NOT by path, so switching plans never resets
// mastery — two-sum stays mastered whether you reach it via Starter or Prep.
const PATHS = [
  {
    id: 'starter',
    label: 'Starter Path',
    icon: '🧭',
    kind: 'lessons',
    lessonOrderKey: 'STARTER_PATH',
    blurb: 'Linear recommended order through the full JS Drill curriculum.',
  },
  {
    id: 'prep-4day',
    label: '4-Day Interview Prep',
    icon: '📅',
    kind: 'prep',
    url: 'prep.html',
    lessonOrderKey: 'PREP_4DAY_PATH',
    blurb: 'Day-by-day interview cram: drills, glossary, code shapes, and mocks.',
  },
];

function getSubscribedPath() {
  return PATHS.find(p => p.id === state.subscribedPathId) || PATHS[0];
}

// Resolve a path's ordered drill-lesson list. Indirection (string key → array)
// avoids a TDZ problem: the arrays (STARTER_PATH, PREP_4DAY_PATH) are declared
// later in the file, but this resolver only runs at call-time. Returns null for
// paths with no drill-lesson sequence (→ 🧭 Path View disabled for that path).
function getPathLessonOrder(path) {
  if (!path) return null;
  switch (path.lessonOrderKey) {
    case 'STARTER_PATH': return STARTER_PATH;
    case 'PREP_4DAY_PATH': return PREP_4DAY_PATH;
    default: return null;
  }
}

// True when the subscribed path exposes a non-empty drill-lesson sequence the
// sidebar can filter to. Drives the enabled/disabled state of the 🧭 button.
function subscribedPathHasLessons() {
  const order = getPathLessonOrder(getSubscribedPath());
  return Array.isArray(order) && order.length > 0;
}

function updatePathChip() {
  const label = document.getElementById('path-chip-label');
  if (label) label.textContent = getSubscribedPath().label;
}

function openPathModal() {
  const modal = document.getElementById('path-modal');
  const body = document.getElementById('path-body');
  if (!modal || !body) return;
  const currentId = state.subscribedPathId;
  body.innerHTML = PATHS.map(p => {
    const active = p.id === currentId;
    const border = active ? '#34d399' : '#1e293b';
    const bg = active ? 'rgba(52,211,153,0.08)' : '#0b1220';
    const check = active ? `<span style="color:#34d399;font-size:13px;">● Current</span>` : `<span style="color:#64748b;font-size:13px;">Switch →</span>`;
    return `<button data-path-id="${escapeHtml(p.id)}" style="text-align:left;padding:12px 14px;border-radius:8px;background:${bg};border:1px solid ${border};color:#e2e8f0;cursor:pointer;display:flex;flex-direction:column;gap:4px;">
      <span style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <span style="font-weight:600;font-size:14px;">${escapeHtml(p.icon || '')} ${escapeHtml(p.label)}</span>
        ${check}
      </span>
      <span style="color:#94a3b8;font-size:12px;">${escapeHtml(p.blurb)}</span>
    </button>`;
  }).join('');
  body.querySelectorAll('[data-path-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.subscribedPathId = btn.getAttribute('data-path-id');
      // The Path View filter base just changed — drop the cache and, if the
      // new path has no drillable lessons, clear an active filter.
      _invalidateStarterPathCache();
      if (!subscribedPathHasLessons()) state.starterPath = false;
      saveProgress();
      updatePathChip();
      modal.style.display = 'none';
      // Re-render the sidebar so the 🧭 button state + (if active) the filtered
      // lesson list reflect the newly-subscribed path.
      if (typeof renderSidebar === 'function') renderSidebar();
    });
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

// Recommended progression for someone starting from scratch — syntax first,
// then patterns building on those syntax tools.
const STARTER_PATH = [
  // Foundations
  's-variables', 's-numbers', 's-strings', 's-strmethods', 's-template',
  's-cond', 's-loops', 's-functions', 's-closures', 's-recursion',
  // Arrays
  'array-iteration', 'array-transform', 's-arr-create', 's-arr-index',
  's-arr-mutate', 's-arr-search', 'sorting',
  // Data-structure idioms (MUST come before patterns that depend on them)
  's-stack-pattern', 's-queue-pattern',
  // Objects + maps
  's-obj-basics', 's-obj-iter', 'map-set',
  // Modern syntax
  'destructuring-spread', 's-optional', 's-nullish',
  // Iterators & Generators (depends on for-of from array-iteration above)
  's-iter-protocol', 's-iter-custom', 's-generators', 's-gen-delegation', 's-async-iter',
  // JS Toolbox — utility-belt syntax that comes up in nearly every coding challenge
  's-array-from', 's-json-api', 's-math-toolkit', 's-regexp-basics', 's-number-parse', 's-bitwise-toolkit',
  // Classes + async
  's-class', 's-class-inh', 's-promises', 's-async', 's-trycatch',
  // Patterns — Arrays & Hashing first
  'two-sum', 'p-contains-dup', 'p-anagrams', 'p-valid-anagram',
  'p-longest-consecutive', 'p-encode-decode-strings',
  // Two pointers
  'valid-palindrome', 'p-3sum', 'p-container', 'p-trapping-rain',
  // Sliding window
  'best-time-stock', 'p-longest-sub', 'p-min-window', 'p-sliding-window-max',
  // Stack (depends on s-stack-pattern above)
  'valid-parentheses', 'p-daily-temp', 'p-min-stack', 'p-largest-rect-hist',
  // Binary search
  'binary-search', 'p-rotated', 'p-min-rotated', 'p-koko-bananas',
  // Linked list
  'p-reverse-list', 'p-cycle', 'p-merge-two-sorted', 'p-remove-nth',
  'p-add-two-numbers', 'p-reorder-list', 'p-merge-k-lists',
  // Trees (depends on s-queue-pattern for BFS)
  'p-max-depth', 'p-invert', 'p-bfs', 'p-valid-bst', 'p-lca-bst',
  'p-same-tree', 'p-construct-tree', 'p-max-path-sum', 'p-serialize-tree',
  // Tries + heap (p-min-heap must precede p-top-k-frequent and the heap upgrade for p-kth-largest)
  'p-trie', 'p-min-heap', 'p-top-k-frequent', 'p-kth-largest', 'p-median-data-stream',
  'p-word-search-ii',
  // Graphs
  'p-islands', 'p-course', 'p-clone-graph', 'p-connected-components',
  'p-course-ii', 'p-num-provinces', 'p-pacific-atlantic',
  // Greedy
  'p-max-subarray', 'p-jump-game', 'p-gas-station',
  // Dynamic Programming (foundational interview category)
  'p-climbing-stairs', 'p-house-robber', 'p-coin-change', 'p-longest-inc-sub', 'p-word-break',
  'p-edit-distance', 'p-longest-common-subseq', 'p-unique-paths', 'p-max-product-subarray',
  // Backtracking (recursive search)
  'p-subsets', 'p-permutations', 'p-combination-sum', 'p-word-search',
  // Intervals
  'p-merge-intervals', 'p-insert-interval', 'p-meeting-rooms-ii',
  // Matrix / Grid
  'p-spiral-matrix', 'p-rotate-image', 'p-set-matrix-zeroes',
  // Bit manipulation (XOR is famous interview trick)
  'p-single-number', 'p-count-bits', 'p-num-1-bits', 'p-missing-number', 'p-reverse-bits',
  // Advanced JS (interview deep dives)
  's-this', 's-prototype', 's-event-loop',
  // System design classics
  'p-lru-cache'
  // Applied Problems are intentionally OUTSIDE the linear path — they're a
  // different practice mode (build me X) rather than a learning progression.
];

// Drill lessons referenced across the 4-Day Interview Prep plan, in prep-day
// order (deduped). This is the lessonOrder for the 'prep-4day' path, so the
// 🧭 Path View filter scopes the sidebar to just the prep lessons in sequence.
//
// SOURCE OF TRUTH is prep.html's PLAN (each item's `lesson.id`). This array is
// a hardcoded mirror — tools/validate-data.js re-extracts the IDs from prep.html
// and fails if the two drift, so editing the prep plan flags a required re-sync.
const PREP_4DAY_PATH = [
  'sorting', 's-bigo-intuition', 'binary-search', 's-bfs-template', 's-tree-traversals',
  'p-max-subarray', 'two-sum', 'p-contains-dup', 'p-anagrams', 'p-valid-anagram',
  'p-encode-decode-strings', 'p-longest-consecutive', 'valid-palindrome', 'p-3sum',
  'p-container', 'p-trapping-rain', 'best-time-stock', 'p-longest-sub', 'p-min-window',
  'p-sliding-window-max', 'valid-parentheses', 'p-daily-temp', 'p-min-stack',
  'p-largest-rect-hist', 'p-rotated', 'p-koko-bananas', 'p-reverse-list', 'p-cycle',
  'p-merge-two-sorted', 'p-max-depth', 'p-invert', 'p-bfs', 'p-same-tree', 's-heap-ops',
  'p-valid-bst', 'p-lca-bst', 'p-construct-tree', 'p-kth-largest', 'p-top-k-frequent',
  'p-merge-intervals', 'p-meeting-rooms-ii', 'p-insert-interval', 'p-islands', 'p-course',
  'p-clone-graph', 'p-climbing-stairs', 'p-coin-change'
];

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
    // Subscribed study plan. Legacy users (no field) default to 'starter' = existing behavior.
    // Validate against the registry so a stale/removed path id falls back gracefully.
    state.subscribedPathId = (typeof PATHS !== 'undefined' && PATHS.some(p => p.id === parsed.subscribedPathId))
      ? parsed.subscribedPathId : 'starter';
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
    subscribedPathId: state.subscribedPathId,
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
function markRevealed(lessonId, level) {
  state.revealed[lessonId] = state.revealed[lessonId] || {};
  state.revealed[lessonId][level] = true;
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
function recordWrong(lessonId) {
  state.weakness[lessonId] = (state.weakness[lessonId] || 0) + 1;
  appendHistory(lessonId, 'L1-miss');
  saveProgress();
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
          <span>⚡ Rapid · ${idx + 1} of ${deck.length} · 🔥 ${streak}</span>
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
        <div class="rapid-header"><span>⚡ Rapid · Session done</span></div>
        <div class="rapid-summary">
          <div class="rapid-summary-pct">${pct}%</div>
          <div class="rapid-summary-line">${correct} of ${deck.length} correct · 🔥 best streak ${bestStreak}</div>
          <div class="rapid-summary-line">Median ${(median / 1000).toFixed(1)}s · Throughput ${totalMs > 0 ? ((deck.length / (totalMs / 60000)) | 0) : 0}/min</div>
          ${slowestTop.length ? `<div class="rapid-summary-slowest"><div class="rapid-summary-slowest-title">Slowest lessons (drill these next):</div>${slowestTop.map(s => `<div class="rapid-summary-slowest-row"><span>${escapeHtml(s.lessonTitle)}</span><span class="rapid-summary-slowest-ms">${(s.ms / 1000).toFixed(1)}s</span></div>`).join('')}</div>` : ''}
          <div class="rapid-summary-line rapid-summary-lifetime">Lifetime: ${state.rapidFire.correct} / ${state.rapidFire.attempts} (${state.rapidFire.attempts > 0 ? Math.round(state.rapidFire.correct / state.rapidFire.attempts * 100) : 0}%) · best 🔥 ${state.rapidFire.bestStreak}</div>
          <div class="rapid-summary-actions">
            <button class="primary" data-action="rapid-again">⚡ Another session</button>
            <button class="secondary" data-action="rapid-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="rapid-again"]').addEventListener('click', () => startRapidFireSession());
    shell.querySelector('[data-action="rapid-done"]').addEventListener('click', () => renderLesson());
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
function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
//  CODE RUNNER (sandboxed via new Function)
// ──────────────────────────────────────────────────────────────────────────
function formatArg(a) {
  if (typeof a === 'string') return a;
  if (typeof a === 'number' || typeof a === 'boolean') return String(a);
  if (a === null) return 'null';
  if (a === undefined) return 'undefined';
  if (typeof a === 'function') return `[Function${a.name ? ': ' + a.name : ''}]`;
  // Native JSON.stringify produces "{}" for Map/Set — special-case them so
  // users experimenting with `console.log(myMap)` see real content.
  if (a instanceof Map) {
    const pairs = [...a.entries()].map(([k, v]) => `${formatArg(k)} => ${formatArg(v)}`);
    return `Map(${a.size}) { ${pairs.join(', ')} }`;
  }
  if (a instanceof Set) {
    const items = [...a].map(formatArg);
    return `Set(${a.size}) { ${items.join(', ')} }`;
  }
  try { return JSON.stringify(a); } catch { return String(a); }
}
async function runCode(code) {
  const logs = [];
  const fakeConsole = {
    log: (...args) => logs.push(args.map(formatArg).join(' ')),
    error: (...args) => logs.push('[error] ' + args.map(formatArg).join(' ')),
    warn:  (...args) => logs.push('[warn] '  + args.map(formatArg).join(' '))
  };
  // Capture unhandled async rejections inside the user code — async IIFEs
  // whose returned Promise isn't surfaced to us would otherwise hit the
  // window-level handler with no lesson feedback.
  let unhandled = null;
  const rejectionHandler = (e) => {
    if (!unhandled) unhandled = (e && e.reason) || new Error('Unhandled rejection');
    e && e.preventDefault && e.preventDefault();
  };
  const hasWindow = typeof window !== 'undefined';
  if (hasWindow) window.addEventListener('unhandledrejection', rejectionHandler);
  try {
    // Wrap in strict mode so `this` semantics match what s-this teaches.
    const wrapped = '"use strict";\n' + code;
    // eslint-disable-next-line no-new-func
    const result = new Function('console', wrapped)(fakeConsole);
    if (result && typeof result.then === 'function') {
      await result;
    }
    // Adaptive drain — exit early when logs stabilize, capped at 8 ticks.
    let prev = -1;
    for (let i = 0; i < 8; i++) {
      if (logs.length === prev) break;
      prev = logs.length;
      await new Promise(r => setTimeout(r, 0));
    }
    if (unhandled) {
      return { ok: false, output: (unhandled && unhandled.message) || String(unhandled) };
    }
    return { ok: true, output: logs.join('\n') };
  } catch (e) {
    return { ok: false, output: (e && e.message) || String(e) };
  } finally {
    if (hasWindow) window.removeEventListener('unhandledrejection', rejectionHandler);
  }
}
function normalize(s) { return (s ?? '').toString().trim().replace(/\r\n/g, '\n'); }
function normalizeLines(s) {
  return normalize(s).split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.length > 0);
}
// Subsequence match: every expected line must appear in actual, in order.
// Extra lines in actual (debug `console.log` calls the user left in) are
// tolerated — they just don't match any expected line. Identical sequences
// pass under subsequence too, so this is strictly more permissive than the
// old equality check.
function outputsMatch(actual, expected) {
  const exp = normalizeLines(expected);
  const act = normalizeLines(actual);
  if (exp.length === 0) return act.length === 0;
  let i = 0;
  for (const line of act) {
    if (line === exp[i]) i++;
    if (i === exp.length) return true;
  }
  return false;
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
  // Any per-tab body classes (e.g. l2-mobile-active for the bottom sheet
  // padding) belong to the tab that set them — clear on every render.
  document.body.classList.remove('l2-mobile-active');
  if (!state.currentLessonId) { renderEmpty(shell); return; }

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

  // First-time welcome banner — shows once until dismissed or starter path engaged.
  if (!state.welcomed && Object.keys(state.progress).length === 0) {
    const fullCount = CURRICULUM.filter(l => l.status === 'full').length;
    const welcome = document.createElement('div');
    welcome.className = 'mb-6 p-4 rounded-lg bg-blue-950/50 border border-blue-900';
    welcome.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-blue-200 font-semibold mb-1">👋 Welcome to JS Drill</div>
          <div class="text-sm text-slate-300 leading-relaxed">
            ${fullCount} lessons across <strong>syntax</strong>, <strong>interview patterns</strong>, and <strong>applied problems</strong>.
            Each lesson has a <strong>Reference</strong> card, then <strong>L1</strong> (concept MC), <strong>L2</strong> (fill-in), and <strong>L3</strong> (type from memory).
            <br><br>
            Start with the <strong>🧭 Starter Path</strong> for a linear sequence, or hit <kbd>?</kbd> for keyboard shortcuts.
          </div>
          <div class="mt-3 flex gap-2 flex-wrap">
            <button class="primary" data-action="start-path">🧭 Take the Starter Path</button>
            <button class="secondary" data-action="dismiss-welcome">Browse on my own</button>
          </div>
        </div>
        <button class="text-slate-500 hover:text-slate-200 text-xl leading-none" data-action="dismiss-welcome" aria-label="Dismiss">×</button>
      </div>
    `;
    shell.appendChild(welcome);
    welcome.querySelector('[data-action="start-path"]').addEventListener('click', () => {
      state.welcomed = true;
      state.starterPath = true;
      const first = starterPathNextId();
      saveProgress();
      renderSidebar();
      if (first) selectLesson(first); else renderLesson();
    });
    welcome.querySelectorAll('[data-action="dismiss-welcome"]').forEach(b => b.addEventListener('click', () => {
      state.welcomed = true;
      saveProgress();
      renderLesson();
    }));
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
function colorizeInto(target, code, mode = 'javascript') {
  target.textContent = '';
  if (window.CodeMirror && CodeMirror.runMode) {
    CodeMirror.runMode(code, mode, target);
  } else {
    target.textContent = code;
  }
}

// Flash-mode render — same tokens as colorizeInto, but 1-3 randomly-chosen
// "good" tokens (length >= 3, alphanumeric content, not a comment) are wrapped
// in tap-to-reveal blur spans. Active-recall surface on the Reference tab:
// the user mentally fills the blank before tapping to confirm. No typing,
// no validation, pure self-graded retrieval. See roadmap.md iter-31 entry #2
// and ideas-by-category.md § Drilling Surfaces.
function renderFlash(target, code, mode = 'javascript') {
  target.textContent = '';
  if (!(window.CodeMirror && CodeMirror.runMode)) {
    target.textContent = code;
    return;
  }
  const tokens = [];
  CodeMirror.runMode(code, mode, (text, style) => {
    tokens.push({ text, style });
  });
  // Pick "good" candidates: length >= 3, alphanumeric content, not comment/string-content noise.
  const goodIdx = [];
  tokens.forEach((t, i) => {
    if (t.text.length < 3) return;
    if (!/[a-zA-Z0-9]{3,}/.test(t.text)) return;
    if (t.style && /^(comment)$/.test(t.style)) return;
    goodIdx.push(i);
  });
  // Shuffle and pick 1-3.
  for (let i = goodIdx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [goodIdx[i], goodIdx[j]] = [goodIdx[j], goodIdx[i]];
  }
  const n = Math.min(goodIdx.length, 1 + Math.floor(Math.random() * 3));
  const blurSet = new Set(goodIdx.slice(0, n));
  tokens.forEach((tok, i) => {
    const span = document.createElement('span');
    if (blurSet.has(i)) {
      span.className = 'flash-blur';
      span.textContent = tok.text;
      span.setAttribute('role', 'button');
      span.setAttribute('tabindex', '0');
      span.title = 'Tap to reveal';
      const reveal = () => span.classList.add('revealed');
      span.addEventListener('click', reveal);
      span.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); }
      });
    } else {
      if (tok.style) span.className = 'cm-' + tok.style.replace(/ +/g, ' cm-');
      span.textContent = tok.text;
    }
    target.appendChild(span);
  });
}

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
  const exampleSelect = body.querySelector('[data-walk-example]');
  let quizActive = false;

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
    // Disable prev/next at boundaries OR when quiz is active (quiz holds K).
    prevBtn.disabled = quizActive || uiState.stepIdx === 0;
    nextBtn.disabled = quizActive || uiState.stepIdx >= steps.length - 1;
    resetBtn.disabled = quizActive;
    exampleSelect.disabled = quizActive;
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
  exampleSelect.addEventListener('change', (e) => {
    if (quizActive) exitQuiz();
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
      <button class="flash-toggle text-xs px-2 py-1 rounded bg-slate-800 text-slate-400" data-action="flash-toggle" title="Hide random tokens, tap each to reveal">🃏 Flash</button>
    </div>
    <pre class="code-block cm-s-dracula" data-ref-code></pre>
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
  const flashBtn = section.querySelector('[data-action="flash-toggle"]');
  flashBtn.addEventListener('click', () => {
    flashOn = !flashOn;
    flashBtn.classList.toggle('active', flashOn);
    flashBtn.textContent = flashOn ? '🃏 Reveal all' : '🃏 Flash';
    if (flashOn) renderFlash(codeEl, ref.code);
    else colorizeInto(codeEl, ref.code);
  });
  section.querySelector('[data-action="start-l1"]').addEventListener('click', () => selectTab('L1'));
}

// ──────────────────────────────────────────────────────────────────────────
//  L1 — MULTIPLE CHOICE
// ──────────────────────────────────────────────────────────────────────────
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
        maybePassL1();
      });
      optsContainer.appendChild(optEl);
    });
    cardHandles.push({ card, optsContainer });
    wrap.appendChild(card);
  });

  const status = document.createElement('div');
  status.className = 'mt-2 mb-2 flex items-center justify-between';
  status.innerHTML = `
    <div class="text-sm text-slate-400" id="l1-status">Answer all to pass.</div>
    <div class="flex gap-2">
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
  const drill = content.L3;
  const isMock = state.mock.active && state.mock.lessonId === lesson.id;
  const bestMs = state.bestTimes[lesson.id];
  const wrap = document.createElement('div');

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
  const history = state.mockHistory[lesson.id] || [];
  const trendBadge = history.length >= 2
    ? (() => {
        const cells = history.map(ms =>
          (bestMs && ms === bestMs ? `★${formatTime(ms)}` : formatTime(ms))
        );
        return `<span class="pill mono" title="Last ${history.length} mock attempts — most recent rightmost" style="background:rgba(244,114,182,0.08);color:#fbcfe8;letter-spacing:0.02em">${cells.join(' · ')}</span>`;
      })()
    : '';

  wrap.innerHTML = `
    ${mockBanner}
    <div class="mb-4 text-sm text-slate-400 flex items-center justify-between flex-wrap gap-2">
      <span>Blank editor. Type the canonical solution from memory, then Run. Pass when output matches.</span>
      <div class="flex items-center gap-2 flex-wrap">${bestBadge}${trendBadge}</div>
    </div>
    <div class="p-4 rounded-lg bg-slate-900 border border-slate-800 mb-4">
      <div class="text-xs text-slate-500 uppercase tracking-wider mb-1">Prompt</div>
      <div class="text-white">${escapeHtml(drill.prompt)}</div>
      <div class="mt-3 text-xs text-slate-500">Expected output:
        <span class="mono text-slate-300 ml-1">${escapeHtml(drill.expectedOutput)}</span>
      </div>
    </div>
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
      <div class="text-xs text-slate-500 mb-1">Output:</div>
      <div class="output-box" data-output>(run your code…)</div>
    </div>
    <div data-diff-panel class="mt-4 hidden">
      <div class="text-xs text-slate-500 mb-1">Diff vs canonical (comments stripped):</div>
      <div data-diff class="diff-side"></div>
    </div>
  `;
  body.appendChild(wrap);

  if (isMock) {
    wrap.querySelector('[data-action="end-mock"]').addEventListener('click', () => {
      endMockInterview(false);
    });
  }

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
    hintTrendEl.innerHTML = `<span class="hint-trend-pill hint-trend-${tone}">💡 Hints / scaffold used on <strong>${hinted}</strong> of last <strong>${total}</strong> attempt${total === 1 ? '' : 's'}</span>`;
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
      feedback.innerHTML = '<span class="text-rose-400">Output doesn’t match expected. Try again.</span>';
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  UTIL
// ──────────────────────────────────────────────────────────────────────────
function escapeHtml(s) {
  return (s ?? '').toString()
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Comment stripping for the L3 side-by-side diff. Drops block comments,
// then line comments, then any line that's now whitespace-only — comments
// are noise when comparing recalled code to the canonical's annotated form.
// Naive: doesn't track string/regex literals. Safe for our canonicals (no
// `//` inside template strings), reviewer-enforced going forward.
function stripCommentsForDiff(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, '').replace(/\s+$/, ''))
    .filter(line => line.trim().length > 0);
}

// LCS-based line alignment for side-by-side diff. O(n*m) DP — fine for
// snippets under a few hundred lines (our canonicals top out ~40).
// Returns rows of `{left, right, status: 'eq'|'del'|'add'}`.
function lcsDiffRows(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { rows.push({ left: a[i], right: b[j], status: 'eq' }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push({ left: a[i], right: '', status: 'del' }); i++; }
    else { rows.push({ left: '', right: b[j], status: 'add' }); j++; }
  }
  while (i < n) rows.push({ left: a[i++], right: '', status: 'del' });
  while (j < m) rows.push({ left: '', right: b[j++], status: 'add' });
  return rows;
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
let _mechanicsView = 'list';            // 'list' | 'detail'
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
  _mechanicsSelectedId = null;
  const body = document.getElementById('mechanics-body');
  if (body) body.innerHTML = `<div style="color:#94a3b8;text-align:center;padding:24px 0;">Loading mechanics…</div>`;
  modal.style.display = 'block';
  await ensureMechanicIndex();
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

  if (_mechanicsView === 'list') {
    titleEl.textContent = '🧩 Mechanics';
    subEl.textContent = 'Code idioms tagged across lessons. Tap a mechanic to see every lesson where it appears.';
    backBtn.style.display = 'none';
    body.innerHTML = _renderMechanicsListHtml();
    body.scrollTop = 0;
    body.querySelectorAll('[data-mech-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        _mechanicsSelectedId = btn.getAttribute('data-mech-id');
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

  // iter 54: ⚡ Rapid-Fire L1 stream — cross-lesson interleaved tap surface.
  // Closes iter-31 roadmap entry #4 (L1 Rapid-Fire Drill, unblocked). Uses
  // existing L1 corpus across all tracks; integrates with weak-spot tracker
  // on misses so the high-throughput stream feeds normal SR/weakness rotation.
  document.getElementById('rapid-fire-btn').addEventListener('click', () => {
    startRapidFireSession();
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
      const modals = ['help-modal', 'today-modal', 'stats-modal', 'mechanics-modal', 'cheatsheet-modal', 'path-modal'];
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

    document.getElementById('stats-body').innerHTML = `
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
              <div style="color: #94a3b8; font-size: 12px;">🔎 Recognize lifetime</div>
              <div style="color: #fcd34d; font-size: 16px; font-weight: 600; margin-top: 2px;">${state.recognize.correct} / ${state.recognize.attempts} <span style="color: #94a3b8; font-size: 12px; font-weight: 400;">(${Math.round(state.recognize.correct / state.recognize.attempts * 100)}%)</span></div>
            </div>
            <button data-action="open-recognize-from-stats" style="background: rgba(251,191,36,0.16); color: #fcd34d; border: 1px solid rgba(251,191,36,0.4); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer;">Drill →</button>
          </div>
        </div>
      ` : ''}
      ${_renderSectionRetentionBlock(14)}
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
  // Today's Plan routes by the subscribed study plan. A 'prep' path navigates
  // to its standalone dashboard; a 'lessons' path opens the in-app curated modal.
  function openTodaysPlan() {
    const path = getSubscribedPath();
    if (path.kind === 'prep' && path.url) {
      window.location.href = path.url;
      return;
    }
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
  todayModal.addEventListener('click', (e) => {
    if (e.target === todayModal) todayModal.style.display = 'none';
  });

  // Mechanics modal — cross-cutting drill surface
  const mechanicsModal = document.getElementById('mechanics-modal');
  document.getElementById('mechanics-btn').addEventListener('click', openMechanicsModal);
  document.getElementById('mechanics-close').addEventListener('click', closeMechanicsModal);
  document.getElementById('mechanics-back').addEventListener('click', () => {
    _mechanicsView = 'list';
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
}
init().catch(err => console.error(err));
