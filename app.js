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
//  STATE + LOCALSTORAGE
// ──────────────────────────────────────────────────────────────────────────
const LS_KEY = 'jsdrill.progress.v1';
const state = {
  currentLessonId: null,
  currentTab: 'reference',
  progress: {},   // { lessonId: { L1: 'passed', L2: 'passed', L3: 'passed' } }
  searchQuery: '',
  streak: 0,      // consecutive lessons mastered in this run (resets on reload)
  bestTimes: {},  // { lessonId: ms } — fastest mock-interview pass
  mock: { active: false, startTime: 0, lessonId: null, tickHandle: null },
  starterPath: false, // when true, sidebar shows only the linear starter path
  revealed: {},   // { lessonId: { L2: true, L3: true } } — track integrity
  lastLessonId: null, // persisted across sessions for resume
  lastTab: null,
  welcomed: false,    // hide welcome panel after first dismissal
  hideMastered: false, // sidebar filter: when true, drop fully-mastered lessons
  reviews: {},        // { lessonId: { lastPassedAt: ms, interval: ms, dueAt: ms } }
  weakness: {},       // { lessonId: wrongL1Count } — tracks recurring L1 misses
  sidebarTrack: 'syntax' // 'syntax' | 'patterns' — which binder tab is active
};
// Expose script-scope state on window for E2E probes (tools/cdp/*).
// Production-safe: it's the same object the runtime uses; readers only.
window.__jsdrillState = state;

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

function loadProgress() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Support old shape ({lessonId: {...}}), v2 (progress + bestTimes), v3 (+ lastLesson, +revealed)
      if (parsed && (parsed.__v === 2 || parsed.__v === 3 || parsed.__v === 4 || parsed.__v === 5)) {
        state.progress = parsed.progress || {};
        state.bestTimes = parsed.bestTimes || {};
        state.revealed = parsed.revealed || {};
        state.lastLessonId = parsed.lastLessonId || null;
        state.lastTab = parsed.lastTab || null;
        state.starterPath = !!parsed.starterPath;
        state.welcomed = !!parsed.welcomed;
        state.hideMastered = !!parsed.hideMastered;
        state.reviews = parsed.reviews || {};
        state.weakness = parsed.weakness || {};
        if (parsed.sidebarTrack === 'syntax' || parsed.sidebarTrack === 'patterns' || parsed.sidebarTrack === 'applied') {
          state.sidebarTrack = parsed.sidebarTrack;
        }
        // Backfill: if a lesson is mastered but has no review schedule (legacy
        // data), seed it with the first interval so spaced-rep starts working
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
      } else {
        state.progress = parsed || {};
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
    }
  } catch (e) {
    state.progress = {}; state.bestTimes = {}; state.revealed = {};
  }
}
function saveProgress() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      __v: 5,
      progress: state.progress,
      bestTimes: state.bestTimes,
      revealed: state.revealed,
      lastLessonId: state.currentLessonId,
      lastTab: state.currentTab,
      starterPath: state.starterPath,
      welcomed: state.welcomed,
      hideMastered: state.hideMastered,
      reviews: state.reviews,
      weakness: state.weakness,
      sidebarTrack: state.sidebarTrack
    }));
  } catch (e) {}
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
  return CURRICULUM
    .filter(l => l.status === 'full' && isDueForReview(l.id))
    .sort((a, b) => state.reviews[a.id].dueAt - state.reviews[b.id].dueAt)
    .map(l => l.id);
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
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days >= 1) return `in ${days}d`;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  return `in ${hours}h`;
}
function markRevealed(lessonId, level) {
  state.revealed[lessonId] = state.revealed[lessonId] || {};
  state.revealed[lessonId][level] = true;
  saveProgress();
}
function wasRevealed(lessonId, level) {
  return !!(state.revealed && state.revealed[lessonId] && state.revealed[lessonId][level]);
}
function recordWrong(lessonId) {
  state.weakness[lessonId] = (state.weakness[lessonId] || 0) + 1;
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
async function generateCheatsheet() {
  await ensureAllContentLoaded();
  const fullLessons = CURRICULUM.filter(l => l.status === 'full');
  const date = new Date().toISOString().slice(0, 10);
  const total = fullLessons.length;
  let md = `# JavaScript Interview Cheatsheet\n\n`;
  md += `> ${total} lessons covering syntax fundamentals and canonical interview patterns.\n`;
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
  //   1. Up to 3 due-for-review (highest priority — retention beats new content)
  //   2. Up to 2 next-in-starter-path that are not mastered
  //   3. Up to 1 top weak-spot
  const seen = new Set();
  const plan = [];
  const add = (id, why) => {
    if (id && !seen.has(id)) { seen.add(id); plan.push({ id, why }); }
  };
  for (const id of dueReviewIds().slice(0, 3)) add(id, 'review due');
  let added = 0;
  for (const id of STARTER_PATH) {
    if (added >= 2) break;
    const l = findLesson(id);
    if (!l || l.status !== 'full') continue;
    if (lessonOverallStatus(id) !== 'mastered' && !seen.has(id)) {
      add(id, 'next on path');
      added++;
    }
  }
  add(topWeakLessonId(), 'weak spot');
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
    const prevBest = state.bestTimes[lessonId];
    if (!prevBest || elapsed < prevBest) {
      state.bestTimes[lessonId] = elapsed;
      saveProgress();
    }
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
  // First lesson in STARTER_PATH that is full but not yet mastered.
  for (const id of STARTER_PATH) {
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
    if (due > 0) {
      btn.classList.remove('hidden');
      cnt.textContent = due;
    } else {
      btn.classList.add('hidden');
    }
  }
  const weakBtn = document.getElementById('weak-btn');
  if (weakBtn) {
    const hasWeak = Object.keys(state.weakness || {}).length > 0;
    weakBtn.classList.toggle('hidden', !hasWeak);
  }
}
function updateLessonHeaderInPlace() {
  // Refresh tab ✓ marks and the Mastered pill without rebuilding the body.
  const lesson = findLesson(state.currentLessonId);
  if (!lesson) return;
  const overall = lessonOverallStatus(lesson.id);
  // Tabs: each .tab-btn — append ✓ to the label if its level passed
  const tabs = document.querySelectorAll('#lesson-shell .tab-btn');
  const levels = ['reference', 'L1', 'L2', 'L3'];
  tabs.forEach((btn, i) => {
    const lv = levels[i];
    if (lv === 'reference') return;
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
function outputsMatch(a, b) { return normalize(a) === normalize(b); }

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
  const inStarter = (lesson) => !state.starterPath || STARTER_PATH.includes(lesson.id);
  const starterIndex = (id) => STARTER_PATH.indexOf(id) + 1;  // 1-based for display
  const hideMasteredOk = (lesson) => {
    if (!state.hideMastered) return true;
    // Always keep due-for-review items even in focus mode.
    if (isDueForReview(lesson.id)) return true;
    return lessonOverallStatus(lesson.id) !== 'mastered';
  };

  // Reflect starter-path toggle on the button itself
  const pathBtn = document.getElementById('path-btn');
  if (pathBtn) {
    pathBtn.classList.toggle('text-blue-300', state.starterPath);
    pathBtn.classList.toggle('text-slate-500', !state.starterPath);
  }

  const tracks = [
    { id: 'syntax',   label: 'Syntax Fundamentals' },
    { id: 'patterns', label: 'Canonical Patterns' },
    { id: 'applied',  label: 'Applied Problems' }
  ];

  // Render the binder tab strip (independent of which lessons are visible).
  renderBinderTabs(tracks);

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
    const lessons = CURRICULUM.filter(l => l.track === track.id && matches(l) && inStarter(l) && hideMasteredOk(l));
    if (!lessons.length) continue;

    const sections = [...new Set(lessons.map(l => l.section))];
    for (const section of sections) {
      const secEl = document.createElement('div');
      secEl.className = 'section-header';
      secEl.textContent = section;
      nav.appendChild(secEl);

      const sectionLessons = lessons.filter(l => l.section === section);
      for (const lesson of sectionLessons) {
        visibleCount++;
        const link = document.createElement('div');
        const overall = lessonOverallStatus(lesson.id);
        link.className = 'lesson-link';
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
function selectLesson(id) {
  // If the user navigates away from a live mock interview, end it cleanly
  // (don't record best time — they bailed). Otherwise the tickHandle leaks
  // and bestTimes never settles.
  if (state.mock.active && state.mock.lessonId !== id) {
    endMockInterview(false);
  }
  state.currentLessonId = id;
  state.currentTab = 'reference';
  // Keep the binder tab in sync — the chosen lesson may belong to the
  // other track (shuffle / mock / review-button paths can pick freely).
  syncBinderToLesson(id);
  saveProgress();
  renderSidebar();
  renderLesson();
  if (window.matchMedia('(max-width: 767px)').matches) {
    document.body.classList.remove('sidebar-open');
  }
}
function selectTab(tab) {
  state.currentTab = tab;
  saveProgress();
  renderLesson();
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
    const welcome = document.createElement('div');
    welcome.className = 'mb-6 p-4 rounded-lg bg-blue-950/50 border border-blue-900';
    welcome.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-blue-200 font-semibold mb-1">👋 Welcome to JS Drill</div>
          <div class="text-sm text-slate-300 leading-relaxed">
            76 lessons spanning syntax fundamentals → canonical interview patterns.
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
  const pill = lesson.track === 'syntax' ? 'pill-syntax' : 'pill-pattern';
  const pillText = lesson.track === 'syntax' ? 'Syntax' : 'Pattern';
  const overall = lessonOverallStatus(lesson.id);
  const masteredPill = overall === 'mastered' ? `<span class="pill pill-mastered ml-2">✓ Mastered</span>` : '';
  const nextId = nextLessonId(lesson.id);
  const nextLessonObj = nextId ? findLesson(nextId) : null;
  const nextCta = (overall === 'mastered' && nextLessonObj)
    ? `<div class="mt-3 flex items-center gap-2"><button class="primary" data-action="goto-next">Next lesson: ${escapeHtml(nextLessonObj.title)} →</button><button class="secondary" data-action="shuffle-here">🎲 Shuffle review</button></div>`
    : '';
  header.innerHTML = `
    <div class="flex items-center justify-between gap-3 mb-1">
      <div class="flex items-center gap-2">
        <span class="pill ${pill}">${pillText}</span>
        <span class="text-xs text-slate-500">${escapeHtml(lesson.section)}</span>
        ${masteredPill}
      </div>
      <div class="flex items-center gap-1 text-slate-500 text-xs">
        <button class="hover:text-slate-300 px-1" data-action="prev-lesson" title="Previous (k)">◀</button>
        <button class="hover:text-slate-300 px-1" data-action="next-lesson" title="Next (j)">▶</button>
      </div>
    </div>
    <h2 class="text-2xl font-bold text-white">${escapeHtml(lesson.title)}</h2>
    <p class="text-slate-400 mt-1 text-sm">${escapeHtml(content.description)}</p>
    ${nextCta}
  `;
  shell.appendChild(header);
  header.querySelector('[data-action="prev-lesson"]').addEventListener('click', () => { const p = prevLessonId(lesson.id); if (p) selectLesson(p); });
  header.querySelector('[data-action="next-lesson"]').addEventListener('click', () => { const n = nextLessonId(lesson.id); if (n) selectLesson(n); });
  const nextBtn = header.querySelector('[data-action="goto-next"]');
  if (nextBtn) nextBtn.addEventListener('click', () => selectLesson(nextId));
  const shuffleHere = header.querySelector('[data-action="shuffle-here"]');
  if (shuffleHere) shuffleHere.addEventListener('click', () => { const r = pickShuffleReview(); if (r) selectLesson(r); });

  // tabs
  const tabs = document.createElement('div');
  tabs.className = 'flex border-b border-slate-800 mb-6';
  const tabDefs = [
    { id: 'reference', label: 'Reference',     status: null },
    { id: 'L1',        label: 'L1 — Concept',  status: levelStatus(lesson.id, 'L1') },
    { id: 'L2',        label: 'L2 — Fill-in',  status: levelStatus(lesson.id, 'L2') },
    { id: 'L3',        label: 'L3 — Drill',    status: levelStatus(lesson.id, 'L3') }
  ];
  for (const t of tabDefs) {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    if (state.currentTab === t.id) btn.classList.add('active');
    btn.innerHTML = `${t.label}${t.status === 'passed' ? ' <span class="text-emerald-400 ml-1">✓</span>' : ''}`;
    btn.addEventListener('click', () => selectTab(t.id));
    tabs.appendChild(btn);
  }
  shell.appendChild(tabs);

  // body
  const body = document.createElement('div');
  body.className = 'fade-in';
  shell.appendChild(body);

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

function renderReference(body, content) {
  const ref = content.reference;
  const section = document.createElement('div');
  section.innerHTML = `
    <div class="mb-2 text-xs text-slate-500 uppercase tracking-wider">The thing to memorize</div>
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
  colorizeInto(section.querySelector('[data-ref-code]'), ref.code);
  section.querySelector('[data-action="start-l1"]').addEventListener('click', () => selectTab('L1'));
}

// ──────────────────────────────────────────────────────────────────────────
//  L1 — MULTIPLE CHOICE
// ──────────────────────────────────────────────────────────────────────────
function renderL1(body, lesson, content) {
  const qs = content.L1.questions;
  const localState = qs.map(() => ({ selected: null, locked: false }));

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

  status.querySelector('[data-action="retry-l1"]').addEventListener('click', () => renderLesson());
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
  const exerciseState = exercises.map(() => ({ passed: false }));

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
      markRevealed(lesson.id, 'L2');
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
      document.getElementById('l2-status').innerHTML = '<span class="text-emerald-400 font-medium">✓ L2 passed.</span>';
      status.querySelector('[data-action="next-l3"]').classList.remove('hidden');
      markPassed(lesson.id, 'L2');
    }
  }
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
  const exerciseState = exercises.map(ex => ({
    passed: false,
    values: ex.blanks.map(() => ''),
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
      markRevealed(lesson.id, 'L2');
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
      document.getElementById('l2-status').innerHTML = '<span class="text-emerald-400 font-medium">✓ L2 passed.</span>';
      status.querySelector('[data-action="next-l3"]').classList.remove('hidden');
      markPassed(lesson.id, 'L2');
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  L3 — TYPE FROM MEMORY (DRILL)
// ──────────────────────────────────────────────────────────────────────────
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

  wrap.innerHTML = `
    ${mockBanner}
    <div class="mb-4 text-sm text-slate-400 flex items-center justify-between flex-wrap gap-2">
      <span>Blank editor. Type the canonical solution from memory, then Run. Pass when output matches.</span>
      ${bestBadge}
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
      ${isMock ? '' : '<button class="secondary" data-action="hint">Hint</button>'}
      ${isMock ? '' : '<button class="secondary" data-action="diff">Compare to canonical</button>'}
      ${isMock ? '' : '<button class="secondary" data-action="reveal">Reveal canonical</button>'}
      <button class="secondary" data-action="clear">Clear</button>
      <div class="feedback text-sm ml-2"></div>
    </div>
    <div class="mt-4">
      <div class="text-xs text-slate-500 mb-1">Output:</div>
      <div class="output-box" data-output>(run your code…)</div>
    </div>
    <div data-diff-panel class="mt-4 hidden">
      <div class="text-xs text-slate-500 mb-1">Diff vs canonical (yours on top):</div>
      <div data-diff class="code-block" style="white-space: pre-wrap;"></div>
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

  const outputBox = wrap.querySelector('[data-output]');
  const feedback = wrap.querySelector('.feedback');
  let hintIndex = 0;
  let attempts = 0;
  let running = false;

  wrap.querySelector('[data-action="run"]').addEventListener('click', run);
  wrap.querySelector('[data-action="hint"]').addEventListener('click', () => {
    const hints = drill.hints || [];
    if (hints.length === 0) { feedback.innerHTML = '<span class="text-slate-500">No hints for this one.</span>'; return; }
    feedback.innerHTML = `<span class="text-amber-300">💡 ${escapeHtml(hints[Math.min(hintIndex, hints.length-1)])}</span>`;
    hintIndex++;
  });
  const diffBtn = wrap.querySelector('[data-action="diff"]');
  if (diffBtn) {
    diffBtn.addEventListener('click', () => {
      const panel = wrap.querySelector('[data-diff-panel]');
      const target = wrap.querySelector('[data-diff]');
      const userLines = cm.getValue().split('\n');
      const canonLines = drill.canonical.split('\n');
      const max = Math.max(userLines.length, canonLines.length);
      const out = [];
      for (let i = 0; i < max; i++) {
        const u = userLines[i] ?? '';
        const c = canonLines[i] ?? '';
        if (u === c) {
          out.push(`<span style="color:#64748b">  ${escapeHtml(u || ' ')}</span>`);
        } else {
          if (u.length) out.push(`<span style="color:#fca5a5">- ${escapeHtml(u)}</span>`);
          if (c.length) out.push(`<span style="color:#86efac">+ ${escapeHtml(c)}</span>`);
        }
      }
      target.innerHTML = out.join('\n');
      panel.classList.remove('hidden');
    });
  }

  const revealBtn = wrap.querySelector('[data-action="reveal"]');
  if (revealBtn) {
    revealBtn.addEventListener('click', () => {
      if (!confirm('Reveal the canonical solution? Your mastery dot will be marked as revealed.')) return;
      cm.setValue(drill.canonical);
      markRevealed(lesson.id, 'L3');
    });
  }
  wrap.querySelector('[data-action="clear"]').addEventListener('click', () => cm.setValue(''));

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
      const tries = attempts === 1 ? 'first try' : `${attempts} tries`;
      if (wasMock) {
        const elapsed = endMockInterview(true);
        const prevBest = state.bestTimes[lesson.id];
        const isNewBest = elapsed === prevBest;
        feedback.innerHTML = `<span class="text-emerald-400 font-medium">✓ Solved in ${formatTime(elapsed)} (${tries})${isNewBest ? ' — new personal best!' : ''}</span>`;
      } else {
        feedback.innerHTML = `<span class="text-emerald-400 font-medium">✓ Output matches — L3 passed (${tries}).</span>`;
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

// ──────────────────────────────────────────────────────────────────────────
//  INIT
// ──────────────────────────────────────────────────────────────────────────
async function init() {
  loadProgress();
  try { await loadManifest(); } catch (e) {
    document.getElementById('lesson-shell').innerHTML = '<div class="p-6 text-red-300">Failed to load lesson data: ' + (e && e.message ? e.message : e) + '</div>';
    return;
  }
  // Re-run GC now that CURRICULUM is populated.
  {
    let mutated = false;
    for (const id of Object.keys(state.progress)) {
      if (!findLesson(id)) { delete state.progress[id]; mutated = true; }
    }
    if (mutated) saveProgress();
  }
  // Resume the last lesson + tab if they still resolve to a valid full lesson
  let resumed = false;
  if (state.lastLessonId) {
    const last = findLesson(state.lastLessonId);
    if (last && last.status === 'full') {
      state.currentLessonId = state.lastLessonId;
      if (state.lastTab && ['reference','L1','L2','L3'].includes(state.lastTab)) {
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

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset ALL progress, reviews, best times, and weak-spot history? This cannot be undone (use Backup first if you want to save).')) {
      state.progress = {};
      state.streak = 0;
      state.bestTimes = {};
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

  // Starter-path toggle
  document.getElementById('path-btn').addEventListener('click', () => {
    state.starterPath = !state.starterPath;
    renderSidebar();
    // If toggling ON and current lesson isn't in the path, jump to next un-mastered in path
    if (state.starterPath && !STARTER_PATH.includes(state.currentLessonId)) {
      const next = starterPathNextId();
      if (next) selectLesson(next);
    }
  });

  // Keyboard nav (global)
  document.addEventListener('keydown', (e) => {
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
      const modals = ['help-modal', 'today-modal', 'stats-modal'];
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
    } else if (e.key === '1') { selectTab('reference'); }
    else if (e.key === '2') { selectTab('L1'); }
    else if (e.key === '3') { selectTab('L2'); }
    else if (e.key === '4') { selectTab('L3'); }
    else if (e.key === 's' && (e.metaKey === false && e.ctrlKey === false)) {
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
    const masteredPatterns = CURRICULUM.filter(l => l.track === 'patterns' && lessonOverallStatus(l.id) === 'mastered').length;
    const totalPatterns = CURRICULUM.filter(l => l.track === 'patterns').length;
    const masteredSyntax = CURRICULUM.filter(l => l.track === 'syntax' && lessonOverallStatus(l.id) === 'mastered').length;
    const totalSyntax = CURRICULUM.filter(l => l.track === 'syntax').length;

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
        <div style="background: #1e293b; padding: 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Syntax</div>
          <div style="font-size: 22px; color: #93c5fd; font-weight: 700;">${masteredSyntax} / ${totalSyntax}</div>
        </div>
        <div style="background: #1e293b; padding: 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Patterns</div>
          <div style="font-size: 22px; color: #c4b5fd; font-weight: 700;">${masteredPatterns} / ${totalPatterns}</div>
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
          <span><span style="color:#94a3b8; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; margin-right:8px;">${escapeHtml(lesson?.track === 'syntax' ? 'Syntax' : 'Pattern')}</span>${escapeHtml(lesson?.title || id)}</span>
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
  document.getElementById('today-btn').addEventListener('click', openToday);
  document.getElementById('today-close').addEventListener('click', () => todayModal.style.display = 'none');
  todayModal.addEventListener('click', (e) => {
    if (e.target === todayModal) todayModal.style.display = 'none';
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

  // Export cheatsheet — markdown download of every reference card
  document.getElementById('export-btn').addEventListener('click', async () => {
    const md = await generateCheatsheet();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `js-drill-cheatsheet-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

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
