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
window.__jsdrillContent = CONTENT;

// Fisher-Yates index permutation. Used by L1 surfaces to randomize question
// order per session and option order per render — defeats positional learning
// (76% of authored L1 answers were "B"; without shuffle, tapping B passes).
function _shuffleIndices(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Mock interview attempts kept per lesson — enough to see a trend
// (improving / plateaued / regressing) without bloating localStorage.
const MOCK_HISTORY_MAX = 5;

// iter-32 scaffold: per-lesson event history capped at 50 entries (~6 weeks
// at 1 event/day). Larger caps would bloat localStorage; smaller would lose
// the 30-day window the sparkline targets per roadmap entry iter-31 #6.
const HISTORY_MAX = 50;

// iter 123: L3 keyboard chips — one-tap insertion for high-cost JS tokens.
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
  // iter 141: Haptic Tap-Pulse — fire tactile feedback in tandem with the
  // event-stream write. Choke-point design means every L1-pass / L1-miss /
  // L3-pass call site (main L1 quiz, Gauntlet, What-If, Recognize, Bug-Hunt,
  // Match, etc.) gets haptic for free. L3-enter (iter 140) deliberately
  // omitted — instrumentation event, not user-graded. Rapid-Fire's L1-pass
  // case is wired DIRECTLY at the wasCorrect branch (line ~4242) because
  // Rapid-Fire intentionally skips appendHistory('L1-pass') to avoid
  // polluting the sparkline.
  _hapticPulse(event);
}

// iter 141: Haptic Tap-Pulse — single dispatch helper. All pulse patterns
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

// iter 101: Per-attempt hint-cost ribbon helper. Walks `state.history` for
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

// iter 101: Self-rescue rate — global aggregator across ALL lessons in
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

// iter 106: Mastery Half-Life — per-lesson longitudinal SR signal.
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
// 1. state.mockHistory[lessonId] (≥2 entries) — clean ms durations from
//      timed mock-interview attempts.
// 2. Derived from state.history L3-enter → L3-pass deltas (≥2 deltas).
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
// The Today's Plan button routes by the subscribed path's `kind`:
// - 'lessons' → opens the in-app Today's Plan modal (curated due/path/weak session)
// - 'prep'    → navigates to a standalone dashboard page (e.g. prep.html)
// The Plan View sidebar filter scopes the sidebar to the path's drill-lesson
// sequence (path.lessons). A path with empty lessons[] disables the button.
// Progress is keyed by lesson id, NOT by path, so switching plans never resets
// mastery — two-sum stays mastered whether you reach it via Starter or Prep.
// Adding a new path is now a pure-data change: append an entry to data/paths.json.
let PATHS = []; // populated by loadPaths() on boot

// ──────────────────────────────────────────────────────────────────────────
//  DIAGNOSTIC SIGNAL (audit F2)
// The 43-question diagnostic (diagnostic.html → localStorage
//  `jsdrill.diagnostic.v1`) was a WRITE-ONLY SINK: asked, stored, synced to
//  Supabase and exported for grading, but `grep -rn loadDiagnostic js/` hit
//  only its definition in js/storage.js and the upload in js/sync.js. Nothing
//  in js/app/* ever read it — while PROFILE.md § "Study intent — autopilot"
//  makes the last diagnostic the thing that steers the pick ("if the last one
//  showed complexity-pricing weak …, today's autopilot weights complexity-heavy
//  lessons + the Big-O drill higher"). `diagnosticSignal()` is the one
//  reader; Home (js/app/22-home.js) and `_pickMockLessonId` are its consumers.
//
//  WHY A TABLE AND NOT A FUZZY MATCH: the diagnostic's taxonomy is its own —
//  six families (Pattern Recognition / Complexity / Trade-offs / Edge Cases /
//  Trace / Insight) that deliberately cut ACROSS the app's 29 curriculum
//  sections, and its answer key lives inside diagnostic.html (the blob stores
//  only `{ value, skipped }` per question id, never the key). So the mapping
//  is written out question by question below: authored answer index + the
//  CURRICULUM section names and data/mechanics.json ids that question is
//  evidence about. It is a DUPLICATE of diagnostic.html's key by necessity —
//  if a diagnostic question's `answer` is ever re-authored, this table has to
//  move with it. Questions are keyed by id (not position), so appending a new
//  diagnostic question is safe: it simply carries no signal until listed here.
// ──────────────────────────────────────────────────────────────────────────
//  Row shape: { f: family, a: authored answer index | null, sec: [], mech: [] }
//  `a: null` marks the ten short-answer Insight questions — they are graded by
//  a human against a rubric, so they can carry no auto-signal at all.
const DIAGNOSTIC_QUESTIONS = {
  // ── Pattern Recognition — "name the family". Maps 1:1 onto a section.
  p01: { f: 'Pattern Recognition', a: 1, sec: ['Arrays & Hashing'],       mech: ['hash-complement'] },
  p02: { f: 'Pattern Recognition', a: 0, sec: ['Sliding Window'],         mech: ['sliding-window'] },
  p03: { f: 'Pattern Recognition', a: 1, sec: ['Greedy'],                 mech: ['greedy-single-pass'] },
  p04: { f: 'Pattern Recognition', a: 1, sec: ['Intervals'],              mech: ['sort-then-sweep'] },
  p05: { f: 'Pattern Recognition', a: 2, sec: ['Trees'],                  mech: ['bfs-level-snapshot'] },
  p06: { f: 'Pattern Recognition', a: 1, sec: ['Graphs'],                 mech: ['dfs-graph-adjacency'] },
  p07: { f: 'Pattern Recognition', a: 1, sec: ['Heap'],                   mech: ['heap-sift'] },
  p08: { f: 'Pattern Recognition', a: 2, sec: ['Stack'],                  mech: ['array-as-stack'] },
  p09: { f: 'Pattern Recognition', a: 1, sec: ['Linked List'],            mech: ['fast-slow-pointer'] },
  p10: { f: 'Pattern Recognition', a: 0, sec: ['Graphs', 'Matrix'],       mech: ['dfs-grid-flood', 'four-dir-neighbors'] },
  p11: { f: 'Pattern Recognition', a: 1, sec: ['Applied Problems'],       mech: ['array-as-queue'] },
  p12: { f: 'Pattern Recognition', a: 2, sec: ['Tries'],                  mech: [] },
  // ── Complexity — the "pricing" family PROFILE.md names explicitly. Each
  //    question is priced against a concrete structure, so it maps to that
  //    structure's section rather than to a nonexistent "Complexity" section.
  c01: { f: 'Complexity', a: 0, sec: ['Hash Structures', 'Arrays & Hashing'], mech: ['freq-map'] },
  c02: { f: 'Complexity', a: 1, sec: ['Trees'],                              mech: ['tree-recursion'] },
  c03: { f: 'Complexity', a: 1, sec: ['Arrays'],                             mech: ['nested-loop-build'] },
  c04: { f: 'Complexity', a: 1, sec: ['Heap'],                               mech: ['heap-sift'] },
  c05: { f: 'Complexity', a: 2, sec: ['Binary Search'],                      mech: ['binary-search-interval'] },
  c06: { f: 'Complexity', a: 0, sec: ['Dynamic Programming'],                mech: ['dp-memoization'] },
  // ── Trade-offs — "which structure / which traversal", i.e. the choice the
  //    Swap-Bench drill exists for.
  t01: { f: 'Trade-offs', a: 1, sec: ['Hash Structures'],                    mech: ['freq-map', 'map-keyed-state'] },
  t02: { f: 'Trade-offs', a: 0, sec: ['Two Pointers'],                       mech: ['two-pointer', 'sort-then-sweep'] },
  t03: { f: 'Trade-offs', a: 1, sec: ['Graphs'],                             mech: ['bfs-level-snapshot'] },
  t04: { f: 'Trade-offs', a: 1, sec: ['Dynamic Programming', 'Greedy'],      mech: ['dp-tabulation'] },
  t05: { f: 'Trade-offs', a: 1, sec: ['Hash Structures'],                    mech: ['map-keyed-state'] },
  t06: { f: 'Trade-offs', a: 1, sec: ['Trees', 'Graphs'],                    mech: ['array-as-stack', 'tree-recursion'] },
  // ── Edge Cases — the off-by-one / trap family the Bug-Hunt drill attacks.
  e01: { f: 'Edge Cases', a: 2, sec: ['JS Traps', 'Arrays'],                 mech: ['sort-then-sweep'] },
  e02: { f: 'Edge Cases', a: 1, sec: ['Binary Search'],                      mech: ['binary-search-interval'] },
  e03: { f: 'Edge Cases', a: 1, sec: ['Graphs'],                             mech: ['dfs-graph-adjacency', 'set-dedup'] },
  e04: { f: 'Edge Cases', a: 0, sec: ['Sliding Window'],                     mech: ['sliding-window'] },
  e05: { f: 'Edge Cases', a: 1, sec: ['Linked List', 'JS Traps'],            mech: ['linked-list-walk'] },
  // ── Trace — read code, predict output / price it. The Crystal-ball drill.
  r01: { f: 'Trace', a: 1, sec: ['Basics'],                                  mech: [] },
  r02: { f: 'Trace', a: 0, sec: ['Hash Structures'],                         mech: ['set-dedup'] },
  r03: { f: 'Trace', a: 2, sec: ['Arrays'],                                  mech: ['nested-loop-build'] },
  r04: { f: 'Trace', a: 1, sec: ['Binary Search'],                           mech: ['binary-search-interval'] },
  // ── Insight — ten short answers, human-graded against a rubric. Listed so
  //    this table stays a complete mirror of the question bank, but `a: null`
  //    keeps them out of every tally: an ungradeable answer is not evidence.
  s01: { f: 'Insight', a: null, sec: [], mech: [] },
  s02: { f: 'Insight', a: null, sec: [], mech: [] },
  s03: { f: 'Insight', a: null, sec: [], mech: [] },
  s04: { f: 'Insight', a: null, sec: [], mech: [] },
  s05: { f: 'Insight', a: null, sec: [], mech: [] },
  s06: { f: 'Insight', a: null, sec: [], mech: [] },
  s07: { f: 'Insight', a: null, sec: [], mech: [] },
  s08: { f: 'Insight', a: null, sec: [], mech: [] },
  s09: { f: 'Insight', a: null, sec: [], mech: [] },
  s10: { f: 'Insight', a: null, sec: [], mech: [] },
};

// "Weak" is RELATIVE, never absolute: a section counts as weak when the user
// scored at least 15 points below their OWN average on that same sitting. An
// absolute cut (e.g. <50%) would flag half the diagnostic for a rusty user and
// nothing at all for a sharp one — in both cases telling them what they already
// knew instead of where to spend the next 20 minutes.
const DIAG_WEAK_MARGIN = 0.15;
// Below this many graded questions the user's "own average" isn't a baseline,
// it's one coin flip — so we report the score and stay silent about weakness.
const DIAG_MIN_GRADED = 6;
const DIAG_MAX_WEAK_SECTIONS = 6;
const DIAG_MAX_WEAK_MECHANICS = 8;

// Read the blob defensively. `js/storage.js` owns localStorage I/O for every
// page (see CLAUDE.md § Shared UI + storage contract), so go through it when
// it's there; the direct read is the fallback for a load-order or probe
// context where DrillStorage hasn't mounted. Any throw / corrupt JSON means
// "no diagnostic", never an exception into a render path.
function _diagnosticBlob() {
  try {
    if (typeof window !== 'undefined' && window.DrillStorage &&
        typeof window.DrillStorage.loadDiagnostic === 'function') {
      return window.DrillStorage.loadDiagnostic();
    }
    if (typeof localStorage !== 'undefined') {
      return JSON.parse(localStorage.getItem('jsdrill.diagnostic.v1') || 'null');
    }
  } catch (e) { /* corrupt or unreadable → treated as "never taken" */ }
  return null;
}

// ISO-8601 string (what diagnostic.html writes) → epoch ms, or null.
function _diagTime(iso) {
  if (typeof iso !== 'string') return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

// MC answers are stored as the option INDEX. Accept a numeric string too —
// a future input path could round-trip it through a dataset attribute.
function _diagPick(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

// audit F2 — the single reader of `jsdrill.diagnostic.v1`.
// Returns { takenAt, score, weakSections, weakMechanics }; a missing or
// malformed blob returns the all-null/empty shape rather than throwing, so
// every caller can render unconditionally. Pure (no writes, no state reads).
//
// SKIPPED COUNTS AS WRONG. The diagnostic's own intro tells the user "If you
// genuinely don't know, skip it — that's signal. Don't random-guess", so a
// skip is a deliberate admission of not-knowing and is the cleanest evidence
// in the whole blob. Counting it as wrong is what makes honest skipping pay
// off; counting it as unattempted would reward it with silence.
// UNTOUCHED questions (no entry at all) are excluded from the denominator —
// the diagnostic is resumable, so "never reached" is not evidence.
//
// weakSections carries TWO GRAINS, worst-first within each: the CURRICULUM
// section names this app can act on (drill weighting, Home copy), then the
// diagnostic's own family names lowercased ('complexity', 'edge cases', …),
// which is the grain a whole DRILL maps to (complexity → Big-O, edge cases →
// Bug-Hunt). Consumers take the first entry they recognise. weakMechanics is
// single-grain: data/mechanics.json ids.
//
// Not memoized on purpose: one JSON.parse of a <10KB blob plus a 43-entry walk
// is cheaper than the staleness bug a cache would introduce when the user
// finishes the diagnostic in the other tab.
function diagnosticSignal() {
  const empty = { takenAt: null, score: null, weakSections: [], weakMechanics: [] };
  const blob = _diagnosticBlob();
  if (!blob || typeof blob !== 'object') return empty;
  const answers = (blob.answers && typeof blob.answers === 'object' && !Array.isArray(blob.answers))
    ? blob.answers : null;
  if (!answers) return empty;

  const secTally = new Map(), mechTally = new Map(), famTally = new Map();
  const tally = (map, key, ok) => {
    const row = map.get(key) || { correct: 0, total: 0 };
    row.total++;
    if (ok) row.correct++;
    map.set(key, row);
  };

  let correct = 0, total = 0, takenAt = null;
  for (const qid of Object.keys(DIAGNOSTIC_QUESTIONS)) {
    const q = DIAGNOSTIC_QUESTIONS[qid];
    const a = answers[qid];
    if (!a || typeof a !== 'object') continue;
    const at = _diagTime(a.lastAnsweredAt) || _diagTime(a.firstAnsweredAt);
    if (at !== null && (takenAt === null || at > takenAt)) takenAt = at;
    if (q.a === null) continue;                       // short answer — no key
    const skipped = a.skipped === true;
    const picked = skipped ? null : _diagPick(a.value);
    if (!skipped && picked === null) continue;        // entry exists, no pick
    const ok = !skipped && picked === q.a;
    total++;
    if (ok) correct++;
    for (const s of q.sec) tally(secTally, s, ok);
    for (const m of q.mech) tally(mechTally, m, ok);
    tally(famTally, q.f.toLowerCase(), ok);
  }
  // Per-answer timestamps are the truth, but a legacy blob may lack them —
  // fall back to the sitting's start so a real score still reports an age.
  if (takenAt === null && total > 0) takenAt = _diagTime(blob.startedAt);
  if (takenAt === null && total === 0) return empty;  // opened, never engaged

  const out = { takenAt, score: total > 0 ? { correct, total } : null, weakSections: [], weakMechanics: [] };
  if (total < DIAG_MIN_GRADED) return out;

  const avg = correct / total;
  const weakest = (map, cap) => {
    const rows = [];
    for (const [key, t] of map) {
      const rate = t.correct / t.total;
      if (rate <= avg - DIAG_WEAK_MARGIN) rows.push({ key, rate, total: t.total });
    }
    // Rank by EVIDENCE-WEIGHTED deficit, not by raw rate. Bucket sizes here are
    // wildly uneven — Graphs carries 5 questions, Matrix and Tries carry 1 each
    // — so a rate-first sort makes a single missed question outrank four missed
    // out of five (0/1 = rate 0 beats 1/5 = rate 0.2). weakSections[0] is what
    // Home prints as the headline and what the mock picker biases toward, so
    // that inversion is user-visible: "Matrix weakest" after bombing Graphs.
    // (avg − rate) × total is "how many questions below par", which ranks the
    // section the user actually lost the most ground on first. Membership is
    // unchanged — still the relative-margin test above. More evidence, then
    // alphabetical, break ties so the list is stable across calls.
    const deficit = r => (avg - r.rate) * r.total;
    rows.sort((x, y) => deficit(y) - deficit(x) || y.total - x.total || x.key.localeCompare(y.key));
    return rows.slice(0, cap).map(r => r.key);
  };
  out.weakSections = weakest(secTally, DIAG_MAX_WEAK_SECTIONS)
    .concat(weakest(famTally, DIAG_MAX_WEAK_SECTIONS));
  out.weakMechanics = weakest(mechTally, DIAG_MAX_WEAK_MECHANICS);
  return out;
}

// audit F2 — the ONE curriculum section the diagnostic says to bias toward,
// or null. Scans weakSections (already worst-first) for the first name that is
// a real CURRICULUM section, so the family-name grain is skipped harmlessly.
// Deliberately singular: diagnostic.html's own results page picks a single
// weakest section, and boosting all six would flatten into "everything is
// weak" — which is the same as no signal, minus the interleaving.
//
// `isUsable(sectionName)` is an optional caller-supplied filter, and it is not
// cosmetic. The diagnostic's questions map onto BOTH tracks — four of the
// nineteen mapped sections (Basics, Arrays, Hash Structures, JS Traps) are
// syntax-only. A consumer that can only act on one track (the mock interview
// is Patterns-only) would otherwise get handed "Hash Structures", match zero
// lessons, and silently apply no bias at all — even when weakSections also
// names Graphs two entries down. Skipping past sections the caller cannot use
// keeps the signal alive instead of dropping it on the floor.
function _diagnosticWeakestCurriculumSection(isUsable) {
  let sig;
  try { sig = diagnosticSignal(); } catch (e) { return null; }
  if (!sig || !sig.weakSections.length) return null;
  const known = new Set((typeof CURRICULUM !== 'undefined' ? CURRICULUM : []).map(l => l.section));
  for (const name of sig.weakSections) {
    if (!known.has(name)) continue;                       // family grain — skip
    if (typeof isUsable === 'function' && !isUsable(name)) continue;
    return name;
  }
  return null;
}

