// ── 22: Home — the front door (nav "Home", and what `/` boots into) ────────
// The homepage the app never had. Before this, the root URL resumed
// `lastLessonId` (or fell back to the first full lesson), so a first-time
// visitor landed INSIDE Basics lesson 1 with no map, and a returning user
// never saw an overview of where they stood. Home is the launchpad:
//
//   greeting + streak (+ diagnostic chip) → CONTINUE hero
//   → due / weak / today stat row → ⟲ Review all due
//   → three AREA cards (Coding · Syntax · System Design), each with
//     mastery meter, due count, Continue + scoped Review
//   → each area expands into its SUBCATEGORIES (17/11 sections, 4 SD topics)
//     with the same two affordances per row
//   → More (Today's plan · Practice · Diagnostic · Progress)
//
// Home is the app's SINGLE front door (audit F5). The Today-home page used to
// render the same greeting/clock/streak/hero for the same lesson and took the
// same nav rung; it is retired to a delegation (17-today-home.js) and the one
// thing it had that Home didn't — the ambient due/weak/today read — lives here
// now. "Today's plan" means exactly one surface everywhere: the modal
// (#today-btn), which is the full queue (audit F6).
//
// Two affordances, one meaning each — the rule that keeps the page readable:
//   · Continue = FORWARD progress. First non-mastered lesson in authored
//     order, at its first unpassed level. (Not the due one — that's what the
//     ⟲ is for. If both buttons did the same thing one of them is a lie.)
//     A fully-mastered scope's Continue becomes "Refresh" → least-recently
//     reviewed lesson, so the button is never dead.
//   · ⟲ Review = the scope's REPAIR queue (due → weak → reveal-flagged),
//     handed to the scoped review session in 23-review.js.
//
// System Design lives on a separate page with its own Leitner store
// (jsdrill.systemdesign.v1, question-grain boxes) — Home reads it through
// DrillStorage and gets its denominators from the `questions` counts now
// carried in each topic manifest, so the card costs 5 small fetches, not 43.
//
// Deep link: #/m/home (hidden #home-btn). No new persisted state beyond
// state.homeOpen (which area cards are expanded) — schema-additive.

const HOME_AREAS = [
  {
    key: 'coding', label: 'Coding', icon: 'code',
    sub: 'Patterns + Applied — the interview problem set',
    tracks: ['patterns', 'applied'],
  },
  {
    key: 'syntax', label: 'Syntax', icon: 'braces',
    sub: 'JavaScript fundamentals, toolbox and traps',
    tracks: ['syntax'],
  },
  {
    key: 'sysdesign', label: 'System Design', icon: 'sysdesign',
    sub: 'DDIA · method · building blocks · design problems',
    external: 'system-design.html',
  },
];

// Slug rule matches the data/<section-slug>/ convention (lowercase, & → and,
// non-alphanumeric → '-'), so #/m/review/arrays-and-hashing is stable and
// guessable. Areas keep their own short keys.
function homeSlug(name) {
  return String(name).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Scope model ────────────────────────────────────────────────────────────
// A scope is {kind:'area'|'section', key}. Everything on this page (and the
// scoped review session) is expressed as a scope so one set of helpers serves
// the area cards, the subcategory rows and the review queue.

function homeScopeFromSlug(slug) {
  if (!slug) return null;
  const area = HOME_AREAS.find(a => a.key === slug);
  if (area) return { kind: 'area', key: area.key };
  const section = CURRICULUM.find(l => homeSlug(l.section) === slug);
  if (section) return { kind: 'section', key: section.section };
  return null;
}

function homeScopeSlug(scope) {
  if (!scope) return '';
  return scope.kind === 'area' ? scope.key : homeSlug(scope.key);
}

function homeScopeLabel(scope) {
  if (!scope) return '';
  if (scope.kind === 'area') return (HOME_AREAS.find(a => a.key === scope.key) || {}).label || scope.key;
  return scope.key;
}

// Authored order (manifest order) — CURRICULUM is already in that order, so a
// plain filter preserves it. Stubs never enter a scope: they aren't drillable.
function homeScopeLessons(scope) {
  if (!scope) return [];
  if (scope.kind === 'section') {
    return CURRICULUM.filter(l => l.status === 'full' && l.section === scope.key);
  }
  const area = HOME_AREAS.find(a => a.key === scope.key);
  if (!area || !area.tracks) return [];
  return CURRICULUM.filter(l => l.status === 'full' && area.tracks.includes(l.track));
}

function homeScopeSections(areaKey) {
  const seen = [];
  for (const l of homeScopeLessons({ kind: 'area', key: areaKey })) {
    if (!seen.includes(l.section)) seen.push(l.section);
  }
  return seen;
}

function homeScopeStats(scope) {
  const lessons = homeScopeLessons(scope);
  let mastered = 0, started = 0, due = 0, weak = 0;
  for (const l of lessons) {
    const st = lessonOverallStatus(l.id);
    if (st === 'mastered') mastered++;
    else if (st === 'in_progress') started++;
    if (isDueForReview(l.id)) due++;
    if ((state.weakness || {})[l.id]) weak++;
  }
  const total = lessons.length;
  return { total, mastered, started, due, weak, pct: total ? Math.round(100 * mastered / total) : 0 };
}

// Forward progress: first lesson in authored order that isn't mastered, at
// its first unpassed level. When the whole scope is mastered there is nothing
// to advance to — fall back to the least-recently-reviewed lesson so the
// button stays live as a refresher (flagged with kind:'refresh' so the label
// can tell the truth about which of the two it is).
function homeContinueTarget(scope) {
  const lessons = homeScopeLessons(scope);
  if (!lessons.length) return null;
  const next = lessons.find(l => lessonOverallStatus(l.id) !== 'mastered');
  if (next) {
    return { id: next.id, level: _todayNextLevel(next.id), kind: 'continue' };
  }
  let oldest = null, oldestAt = Infinity;
  for (const l of lessons) {
    const at = (state.reviews[l.id] || {}).lastPassedAt || 0;
    if (at < oldestAt) { oldestAt = at; oldest = l; }
  }
  return oldest ? { id: oldest.id, level: 'L3', kind: 'refresh' } : null;
}

// The scope's repair queue, in the same priority order the ambient repair
// icons use (overdue → due → weak → reveal-flagged). buildRepairIndex()
// already dedupes and ranks globally; scoping is an intersection, so the two
// surfaces can never disagree about what needs work.
//
// `unscoped: true` is deliberate: Home's scopes are the ones the USER just
// tapped, so the Starter Plan's track filter (which dueReviewIds() applies)
// must not silently subtract from them. Without it a section could read
// "1 due" — homeScopeStats() calls isDueForReview() directly, which is
// unfiltered — while showing no ⟲ and no entry in Review-all.
//
// Entries keep their rank so the review session can pick a level that can
// actually CLEAR the signal that queued the lesson (see 23-review.js).
function homeRepairEntries(scope) {
  const inScope = new Set(homeScopeLessons(scope).map(l => l.id));
  const idx = typeof buildRepairIndex === 'function' ? buildRepairIndex({ unscoped: true }) : new Map();
  const rows = [];
  idx.forEach((rep, id) => { if (inScope.has(id)) rows.push({ id, rank: rep.rank }); });
  rows.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const da = (state.reviews[a.id] || {}).dueAt || Infinity;
    const db = (state.reviews[b.id] || {}).dueAt || Infinity;
    return da - db;
  });
  return rows;
}

function homeRepairIds(scope) {
  return homeRepairEntries(scope).map(r => r.id);
}

// ── System Design rollup (cross-store, read-only) ───────────────────────────
// Denominators come from the manifests' per-chapter `questions` counts (added
// alongside this page, validator-gated). Numerators come from the Leitner
// boxes in jsdrill.systemdesign.v1, whose keys are "<topic>/<chapter>/<qIdx>".
// Nothing here writes — the drill page owns that store.

const SD_MASTER_BOX = 4;         // mirrors system-design.html MASTER_BOX
let _sdIndex = null;             // { topics:[{id,title,icon,units,questions}] }
let _sdIndexPromise = null;

function _sdLoadIndex() {
  if (_sdIndex) return Promise.resolve(_sdIndex);
  if (_sdIndexPromise) return _sdIndexPromise;
  _sdIndexPromise = fetch('data/system-design/topics.json')
    .then(r => r.json())
    .then(reg => Promise.all((reg.topics || []).map(t =>
      fetch(`data/system-design/${t.id}/manifest.json`)
        .then(r => r.json())
        .then(m => ({
          id: t.id,
          title: t.title || m.title || t.id,
          icon: t.icon || '',
          unitLabel: m.unitLabel || 'Chapter',
          units: (m.chapters || []).map(c => ({ id: c.id, title: c.title, questions: +c.questions || 0 })),
          questions: (m.chapters || []).reduce((n, c) => n + (+c.questions || 0), 0),
        }))
    )))
    .then(topics => { _sdIndex = { topics }; return _sdIndex; })
    .catch(() => { _sdIndex = { topics: [] }; return _sdIndex; });
  return _sdIndexPromise;
}

function _sdBoxes() {
  try {
    const blob = (window.DrillStorage && DrillStorage.loadSystemDesign()) || null;
    return (blob && blob.boxes) || {};
  } catch (_) { return {}; }
}

function _sdProgressBlob() {
  try { return (window.DrillStorage && DrillStorage.loadSystemDesign()) || null; } catch (_) { return null; }
}

// Per-topic {total, mastered, due}. "Due" counts only questions the user has
// actually seen — an untouched question is NEW, not overdue, and folding the
// two together would make a fresh topic read as 48 reps in the red.
function _sdTopicStats(topicId) {
  const idx = _sdIndex;
  const topic = idx && idx.topics.find(t => t.id === topicId);
  if (!topic) return null;
  const boxes = _sdBoxes();
  const now = Date.now();
  let mastered = 0, due = 0, seen = 0;
  const prefix = topicId + '/';
  for (const key of Object.keys(boxes)) {
    if (key.indexOf(prefix) !== 0) continue;
    const b = boxes[key] || {};
    if ((b.seen || 0) > 0) seen++;
    if ((b.box || 0) >= SD_MASTER_BOX) mastered++;
    if ((b.seen || 0) > 0 && (b.due || 0) <= now) due++;
  }
  const total = topic.questions;
  return { total, mastered, seen, due, pct: total ? Math.round(100 * mastered / total) : 0 };
}

function _sdAreaStats() {
  if (!_sdIndex) return null;
  return _sdIndex.topics.reduce((acc, t) => {
    const s = _sdTopicStats(t.id) || { total: 0, mastered: 0, seen: 0, due: 0 };
    acc.total += s.total; acc.mastered += s.mastered; acc.seen += s.seen; acc.due += s.due;
    return acc;
  }, { total: 0, mastered: 0, seen: 0, due: 0, pct: 0 });
}

// Where "Continue System Design" goes. Prefer the drill page's own resume
// pointer (lastTopic/lastChapter, which it already persists); otherwise the
// first topic that still has unmastered questions; otherwise the landing.
function _sdContinueHref() {
  const blob = _sdProgressBlob();
  if (blob && blob.lastTopic) {
    return blob.lastChapter
      ? `system-design.html#/${blob.lastTopic}/${blob.lastChapter}`
      : `system-design.html#/${blob.lastTopic}`;
  }
  if (_sdIndex) {
    const next = _sdIndex.topics.find(t => {
      const s = _sdTopicStats(t.id);
      return s && s.mastered < s.total;
    });
    if (next) return `system-design.html#/${next.id}`;
  }
  return 'system-design.html';
}

// ── Rendering ──────────────────────────────────────────────────────────────

function _homeMeter(pct, good) {
  return `<span class="ds-progress home-meter${good ? ' ds-progress--good' : ''}"><i style="width:${pct}%"></i></span>`;
}

function _homeDuePill(n) {
  return n > 0 ? `<span class="ds-chip ds-chip--warn home-due">${n} due</span>` : '';
}

// ── Diagnostic signal (audit F2) ───────────────────────────────────────────
// The 43-question diagnostic (diagnostic.html, jsdrill.diagnostic.v1) was a
// write-only sink: it was asked, stored and synced, and nothing in js/app/*
// ever read it — while PROFILE.md § "Study intent — autopilot" makes the last
// diagnostic's per-section result the thing that steers what gets weighted
// ("if the last one showed complexity-pricing weak, weight the 🧮 Big-O drill
// higher"). Home is where that belongs: ONE chip, ONE tap, straight into the
// drill that attacks the weakest area — not a second decision in the hero,
// which keeps exactly one primary action (PROFILE: "press one thing → you're
// drilling").
//
// Keys are the diagnostic's own section names, lowercased; the values are the
// canonical launcher buttons the rest of the app already routes through.
const HOME_DIAG_ROUTES = {
  'complexity':          { btn: 'big-o-btn',     label: 'Big-O drill' },
  'pattern recognition': { btn: 'recognize-btn', label: 'Recognize drill' },
  'trace':               { btn: 'crystal-btn',   label: 'predict-the-output drill' },
  'edge cases':          { btn: 'bug-hunt-btn',  label: 'Bug-Hunt drill' },
  'trade-offs':          { btn: 'swap-btn',      label: 'Swap-Bench drill' },
  'insight':             { btn: 'gotcha-btn',    label: 'crux-recall drill' },
};

// diagnosticSignal() lives in 02-util-metrics.js. Guarded on both existence
// and throw so Home still renders if slice load order ever changes — a missing
// diagnostic must degrade to "no chip", never to a blank front door.
function _homeDiagSignal() {
  if (typeof diagnosticSignal !== 'function') return null;
  try { return diagnosticSignal() || null; } catch (_) { return null; }
}

// Weakest-first, so the first key that names a drill wins. Mechanic slugs are
// de-slugged before lookup ('edge-cases' → 'edge cases') so either grain of
// the signal can resolve to a route.
function _homeDiagRoute(sig) {
  const keys = (sig.weakSections || []).map(s => String(s).toLowerCase())
    .concat((sig.weakMechanics || []).map(m => String(m).toLowerCase().replace(/[-_]+/g, ' ')));
  // The matched KEY travels with the route: the chip has to name the thing the
  // tap actually opens. weakSections[0] is a CURRICULUM section name whenever
  // any section is weak ('Binary Search'), and no section name is routable —
  // only the family names appended after them are — so labelling the chip
  // weakSections[0] made the common case read "Binary Search weakest" and then
  // open the Bug-Hunt drill.
  for (const k of keys) if (HOME_DIAG_ROUTES[k]) return { ...HOME_DIAG_ROUTES[k], key: k };
  return null;
}

function _homeDiagAge(takenAt) {
  const days = Math.max(0, Math.round((Date.now() - takenAt) / 86400000));
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

// The header chip. Rendered only when a diagnostic has actually been taken —
// the never-taken case is offered by the (single, quiet) Diagnostic row in
// More, so the offer is never duplicated and the hero never moves down the
// page for a first-time visitor.
function _homeDiagHtml(sig) {
  if (!sig || !sig.takenAt) return '';
  const weakest = (sig.weakSections || [])[0] || (sig.weakMechanics || [])[0] || '';
  const score = sig.score ? `${sig.score.correct}/${sig.score.total}` : '';
  const route = weakest ? _homeDiagRoute(sig) : null;
  // Label the area the tap drills, so the chip's copy and its action agree.
  const named = route ? route.key : weakest;
  const text = named ? `Diagnostic: ${named} weakest` : `Diagnostic: ${score || 'done'}`;
  const title = `Diagnostic taken ${_homeDiagAge(sig.takenAt)}` +
    (score ? ` · scored ${score}` : '') +
    (route ? ` · opens the ${route.label}` : ' · tap to retake');
  const inner = `${dsIcon('target', 13)}${escapeHtml(text)}`;
  // With a route the chip is a button that fires the canonical launcher;
  // without one there is nothing to drill at, so it degrades to a retake link.
  return route
    ? `<p class="home-diag"><button class="ds-chip ds-chip--warn home-diag__chip"
         data-home-diag="${escapeHtml(route.btn)}" title="${escapeHtml(title)}">${inner}</button></p>`
    : `<p class="home-diag"><a class="ds-chip home-diag__chip" href="diagnostic.html"
         title="${escapeHtml(title)}">${inner}</a></p>`;
}

// audit F5 — the one thing the retired Today-home page had that Home lacked:
// the ambient due / weak / today read. Static tiles, not buttons: every one of
// these numbers already has its action elsewhere on this page (⟲ Review all
// due right below, the track cards' own ⟲), and a third tappable copy is
// exactly the "several simultaneous options" friction PROFILE.md § Cognitive
// style names.
function _homeStatsHtml(dueTotal, passesToday) {
  const weak = Object.keys(state.weakness || {}).filter(k => state.weakness[k]).length;
  // Three zeroes is chrome, not information (the empty-state rule in
  // docs/ui-ux-guide.md § States, and the same "rendered only where there's
  // work" rule the ⟲ buttons already follow). A brand-new user sees the hero
  // and the tracks, not a row of noughts.
  if (!dueTotal && !weak && !passesToday) return '';
  return `
    <div class="home-stats">
      <div class="ds-stat${dueTotal ? ' ds-stat--accent' : ''}"><b>${dueTotal}</b><span>Due</span></div>
      <div class="ds-stat"><b>${weak}</b><span>Weak</span></div>
      <div class="ds-stat"><b>${passesToday}</b><span>Today</span></div>
    </div>`;
}

function _homeHeroHtml() {
  // The global Continue: the lesson the user was last on (if there's still
  // work in it), else today's plan pick, else the first thing in the path.
  const resumeId = state.lastLessonId && findLesson(state.lastLessonId)?.status === 'full'
    ? state.lastLessonId : null;
  const resumeUsable = resumeId && lessonOverallStatus(resumeId) !== 'mastered';
  const plan = typeof dailyPlan === 'function' ? dailyPlan() : [];
  let id = null, why = '';
  if (resumeUsable) { id = resumeId; why = 'where you left off'; }
  else if (plan.length) { id = plan[0].id; why = plan[0].why; }
  else {
    const first = homeContinueTarget({ kind: 'area', key: 'coding' })
      || homeContinueTarget({ kind: 'area', key: 'syntax' });
    if (first) { id = first.id; why = 'start here'; }
  }
  if (!id) {
    return `
      <div class="ds-card home-hero">
        <p class="ds-eyebrow" style="margin:0 0 8px;">Nothing queued</p>
        <h2 class="ds-h2" style="margin:0 0 6px;">You're all caught up</h2>
        <p class="ds-dim" style="margin:0;">Pick any track below to keep going.</p>
      </div>`;
  }
  const lesson = findLesson(id);
  const level = _todayNextLevel(id);
  const meta = _TODAY_LEVEL_META[level];
  const isNew = lessonOverallStatus(id) === 'not_started';
  return `
    <div class="ds-card home-hero">
      <p class="ds-eyebrow" style="margin:0 0 8px;">${isNew ? 'Start' : 'Continue'} · ${escapeHtml(why)}</p>
      <h2 class="ds-h2 home-hero__title">${escapeHtml(lesson?.title || id)}</h2>
      <p class="ds-dim home-hero__desc" data-home-desc>${escapeHtml(lesson?.section || '')}</p>
      <div class="home-chiprow">
        <span class="ds-chip">${escapeHtml((TRACK_PILLS[lesson?.track] || TRACK_PILLS.patterns).label)}</span>
        <span class="ds-chip">${escapeHtml(meta.label)}</span>
        <span class="ds-chip">~${meta.mins} min</span>
      </div>
      <button class="ds-btn ds-btn--primary ds-btn--lg ds-btn--block" data-home-start="${escapeHtml(id)}" data-home-level="${level}">
        ${isNew ? 'Start' : 'Resume'}&nbsp;&nbsp;→
      </button>
    </div>`;
}

function _homeAreaCardHtml(area) {
  const open = !!(state.homeOpen || {})[area.key];
  const chev = `<span class="home-expand__chev" aria-hidden="true">${open ? '▾' : '▸'}</span>`;

  if (area.external) {
    const s = _sdAreaStats();
    const loading = !s;
    const frac = loading ? '· · ·' : `${s.mastered}/${s.total}`;
    const pct = loading ? 0 : (s.total ? Math.round(100 * s.mastered / s.total) : 0);
    const subRows = !_sdIndex ? '' : _sdIndex.topics.map(t => {
      const ts = _sdTopicStats(t.id) || { total: 0, mastered: 0, due: 0, pct: 0 };
      return `
        <div class="home-subrow">
          <a class="home-subrow__main" href="system-design.html#/${escapeHtml(t.id)}">
            <b>${escapeHtml(t.title)}</b>
            <span class="home-subrow__meta">
              ${_homeMeter(ts.pct, ts.total > 0 && ts.mastered === ts.total)}
              <span class="ds-num ds-mute">${ts.mastered}/${ts.total}</span>
              ${_homeDuePill(ts.due)}
            </span>
          </a>
          ${ts.due ? `<a class="ds-btn ds-btn--ghost ds-btn--pill home-subrow__review"
             href="system-design.html#/${escapeHtml(t.id)}/due"
             title="Review ${ts.due} card${ts.due === 1 ? '' : 's'} due — ${escapeHtml(t.title)}">${dsIcon('refresh', 14)} ${ts.due}</a>` : ''}
        </div>`;
    }).join('');
    return `
      <div class="ds-card home-area" data-home-area="${area.key}">
        <div class="home-area__head">
          <span class="home-area__icon" aria-hidden="true">${dsIcon(area.icon, 18)}</span>
          <div class="home-area__id">
            <b>${escapeHtml(area.label)}</b>
            <span class="ds-dim">${escapeHtml(area.sub)}</span>
          </div>
          <span class="ds-num ds-mute home-area__frac">${frac}</span>
        </div>
        ${_homeMeter(pct, false)}
        <div class="home-area__actions">
          <a class="ds-btn ds-btn--ghost" data-home-sd-continue href="${escapeHtml(_sdContinueHref())}">Continue&nbsp;→</a>
          <a class="ds-btn ds-btn--subtle" href="system-design.html" title="All System Design topics">All topics</a>
        </div>
        <button class="home-expand" data-home-toggle="${area.key}" aria-expanded="${open ? 'true' : 'false'}">
          ${chev} ${_sdIndex ? _sdIndex.topics.length + ' topics' : 'Topics'}
        </button>
        <div class="home-subrows"${open ? '' : ' hidden'}>${subRows || '<p class="ds-dim" style="margin:6px 0;">Loading…</p>'}</div>
      </div>`;
  }

  const scope = { kind: 'area', key: area.key };
  const s = homeScopeStats(scope);
  const cont = homeContinueTarget(scope);
  const contLesson = cont ? findLesson(cont.id) : null;
  const sections = homeScopeSections(area.key);
  const subRows = sections.map(name => {
    const sc = { kind: 'section', key: name };
    const ss = homeScopeStats(sc);
    const slug = homeSlug(name);
    // The ⟲ appears only when the section actually has something to repair —
    // 19 permanently-empty review buttons is noise, and the row's own tap
    // (Continue) covers the "nothing rotting here" case.
    const repair = homeRepairIds(sc).length;
    return `
      <div class="home-subrow">
        <button class="home-subrow__main" data-home-continue="${escapeHtml(slug)}" title="Continue — ${escapeHtml(name)}">
          <b>${escapeHtml(name)}</b>
          <span class="home-subrow__meta">
            ${_homeMeter(ss.pct, ss.total > 0 && ss.mastered === ss.total)}
            <span class="ds-num ds-mute">${ss.mastered}/${ss.total}</span>
            ${_homeDuePill(ss.due)}
          </span>
        </button>
        ${repair ? `<button class="ds-btn ds-btn--ghost ds-btn--pill home-subrow__review"
                data-home-review="${escapeHtml(slug)}" title="Review what needs work — ${escapeHtml(name)}">
          ${dsIcon('refresh', 14)} ${repair}
        </button>` : ''}
      </div>`;
  }).join('');

  const repairN = homeRepairIds(scope).length;
  return `
    <div class="ds-card home-area" data-home-area="${area.key}">
      <div class="home-area__head">
        <span class="home-area__icon" aria-hidden="true">${dsIcon(area.icon, 18)}</span>
        <div class="home-area__id">
          <b>${escapeHtml(area.label)}</b>
          <span class="ds-dim">${escapeHtml(area.sub)}</span>
        </div>
        <span class="ds-num ds-mute home-area__frac">${s.mastered}/${s.total}</span>
      </div>
      ${_homeMeter(s.pct, s.total > 0 && s.mastered === s.total)}
      <div class="home-area__actions">
        <button class="ds-btn ds-btn--ghost" data-home-continue="${area.key}"${cont ? '' : ' disabled'}>
          ${cont && cont.kind === 'refresh' ? 'Refresh' : 'Continue'}&nbsp;→
        </button>
        ${repairN ? `<button class="ds-btn ds-btn--subtle" data-home-review="${area.key}">
          ${dsIcon('refresh', 14)}Review ${repairN}
        </button>` : ''}
      </div>
      ${cont && contLesson ? `<p class="home-area__next ds-mute">Next: ${escapeHtml(contLesson.title)} · ${cont.level}</p>` : ''}
      <button class="home-expand" data-home-toggle="${area.key}" aria-expanded="${open ? 'true' : 'false'}">
        ${chev} ${sections.length} sections
      </button>
      <div class="home-subrows"${open ? '' : ' hidden'}>${subRows}</div>
    </div>`;
}

function _homeMoreHtml(sig) {
  const rows = [
    // audit F6 — one label, one surface. This row used to fire #today-home-btn
    // (a PAGE) while the Practice launcher's identically-labelled row fired
    // #today-btn (the MODAL); the modal is the full queue, so both point at it.
    { btn: 'today-btn', icon: 'clock', label: "Today's plan", sub: 'The full due + path + weak queue' },
    { btn: 'practice-launcher-btn', icon: 'zap', label: 'Practice', sub: 'Drills, streams, mock interview' },
    { btn: 'dashboard-btn', icon: 'chart', label: 'Progress', sub: 'Activity, mastery, what to fix first' },
  ];
  const inner = rows.map(r => `
    <div class="ds-row" data-home-mode="${r.btn}" role="button" tabindex="0">
      <span class="ds-row__badge" aria-hidden="true">${dsIcon(r.icon, 16)}</span>
      <div class="ds-row__main"><b>${escapeHtml(r.label)}</b><span>${escapeHtml(r.sub)}</span></div>
      <span class="ds-row__chev">›</span>
    </div>`).join('');
  // audit F2 — this is also the never-taken case's single quiet OFFER: say what
  // the 43 questions buy the user (they steer the chip above), rather than
  // describing the page. Once taken, the row reports the signal's freshness so
  // a stale reading is visible instead of silently steering.
  const diagSub = sig && sig.takenAt
    ? `Last taken ${_homeDiagAge(sig.takenAt)}${sig.score ? ` · scored ${sig.score.correct}/${sig.score.total}` : ''} — retake`
    : '43 questions — they steer what this page puts first';
  const diag = `
    <a class="ds-row" href="diagnostic.html">
      <span class="ds-row__badge" aria-hidden="true">${dsIcon('target', 16)}</span>
      <div class="ds-row__main"><b>Diagnostic</b><span>${escapeHtml(diagSub)}</span></div>
      <span class="ds-row__chev">›</span>
    </a>`;
  return `
    <p class="ds-label home-sectionlabel">More</p>
    <div class="ds-card ds-card--flat home-more">${inner}${diag}</div>`;
}

function openHome() {
  const shell = document.getElementById('lesson-shell');
  if (!shell) return;
  // Kick the System Design rollup on first open; re-render once it lands so
  // the card fills in without blocking paint.
  const hadIndex = !!_sdIndex;
  if (!hadIndex) _sdLoadIndex().then(() => { if (document.querySelector('.home-page')) openHome(); });

  const { streak, todayActive, passesToday } = _todayStreak();
  // Unfiltered on purpose — same reason as homeRepairEntries(): Home reports
  // the whole store, not the active Starter Plan's slice of it.
  const dueTotal = typeof allDueReviewIds === 'function' ? allDueReviewIds().length : 0;
  const sd = _sdAreaStats();
  const sdDue = sd ? sd.due : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'short' }) + ' · ' +
    new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const flame = dsIcon('flame', 13);
  const streakChip = streak > 0
    ? `<span class="ds-chip ds-chip--accent">${flame}${streak}-day${todayActive ? ' streak' : ' · keep it today'}</span>`
    : `<span class="ds-chip">${flame}Start a streak</span>`;

  // Honest subline: lesson reps and System Design cards are different units,
  // so they're named separately rather than summed into one fake number.
  let subLine;
  if (dueTotal || sdDue) {
    const parts = [];
    if (dueTotal) parts.push(`${dueTotal} lesson rep${dueTotal === 1 ? '' : 's'} due`);
    if (sdDue) parts.push(`${sdDue} design card${sdDue === 1 ? '' : 's'} due`);
    subLine = parts.join(' · ');
  } else {
    subLine = passesToday
      ? `${passesToday} rep${passesToday === 1 ? '' : 's'} done today — nothing due.`
      : 'Nothing due. Pick up a track below.';
  }

  const reviewAllHtml = dueTotal
    ? `<button class="ds-btn ds-btn--subtle ds-btn--block home-reviewall" data-home-review="all">${dsIcon('refresh', 15)}Review all ${dueTotal} due</button>`
    : '';

  // Home is a full-page destination, so it wears the shared page frame
  // (docs/ui-ux-guide.md § 3 / ds/components.css) like Browse and Progress:
  // .ds-page column, one <h1> inside .ds-page__head. It hand-rolled its own
  // topline/greeting/subline before, which is exactly the drift the frame
  // exists to prevent — and it kept the front door out of the
  // tools/cdp/ds-page-frame.js probe.
  const diagSig = _homeDiagSignal();
  shell.innerHTML = `
    <div class="ds-root ds-page home-page">
      <header class="ds-page__head">
        <div class="ds-page__meta">
          <span class="home-date">${escapeHtml(dateLine)}</span>
          ${streakChip}
        </div>
        <div class="ds-page__titlerow"><h1 class="ds-title home-greeting">${greeting}</h1></div>
        <p class="ds-page__sub home-subline">${escapeHtml(subLine)}</p>
      </header>
      ${_homeDiagHtml(diagSig)}
      ${_homeHeroHtml()}
      ${_homeStatsHtml(dueTotal, passesToday)}
      ${reviewAllHtml}
      <p class="ds-label home-sectionlabel">Tracks</p>
      ${HOME_AREAS.map(_homeAreaCardHtml).join('')}
      ${_homeMoreHtml(diagSig)}
    </div>`;

  // Lazy-enrich the hero with the lesson's one-line description (manifest
  // entries don't carry it; don't block paint on the fetch).
  const heroBtn = shell.querySelector('[data-home-start]');
  if (heroBtn) {
    loadLessonContent(heroBtn.getAttribute('data-home-start')).then(body => {
      const el = shell.querySelector('[data-home-desc]');
      if (el && body?.description) el.textContent = body.description;
    }).catch(() => {});
  }

  // Bind the delegated listeners to the RENDERED root, never to #lesson-shell:
  // openHome() re-renders (the System Design rollup lands, and every expand
  // toggle re-renders), while #lesson-shell survives all of it — so binding
  // there stacked one more listener per render. Two stacked handlers make the
  // expand toggle flip itself back to where it started (an even number of
  // toggles per click), i.e. a dead button. innerHTML replaces this node, so
  // its listeners go with it. Same pattern as Browse (19-browse.js).
  _wireHome(shell.querySelector('.home-page') || shell);
  const main = document.querySelector('.app-main');
  if (main) main.scrollTop = 0;
}

function _homeGoContinue(slug) {
  const scope = homeScopeFromSlug(slug);
  if (!scope) return;
  const target = homeContinueTarget(scope);
  if (!target) return;
  selectLesson(target.id);
  selectTab(target.level);
}

// `root` is the freshly rendered .home-page node, NOT #lesson-shell — see the
// call site. Everything here is delegated, so one listener per render is enough
// and the node's removal is the teardown.
function _wireHome(root) {
  root.addEventListener('click', (e) => {
    const start = e.target.closest('[data-home-start]');
    if (start) {
      selectLesson(start.getAttribute('data-home-start'));
      const lvl = start.getAttribute('data-home-level');
      if (lvl) selectTab(lvl);
      return;
    }
    const cont = e.target.closest('[data-home-continue]');
    if (cont) { _homeGoContinue(cont.getAttribute('data-home-continue')); return; }

    const review = e.target.closest('[data-home-review]');
    if (review) {
      const slug = review.getAttribute('data-home-review');
      if (typeof startScopedReview === 'function') startScopedReview(slug);
      return;
    }
    const toggle = e.target.closest('[data-home-toggle]');
    if (toggle) {
      const key = toggle.getAttribute('data-home-toggle');
      state.homeOpen = state.homeOpen || {};
      state.homeOpen[key] = !state.homeOpen[key];
      saveProgress();
      openHome();
      // Keep the toggled card in view after the re-render (the page scrolls
      // to top on open; an expand from mid-page would otherwise lose place).
      const card = document.querySelector(`[data-home-area="${key}"]`);
      if (card && state.homeOpen[key]) card.scrollIntoView({ block: 'nearest' });
      return;
    }
    // audit F2 — the diagnostic chip routes into the drill that attacks the
    // weakest area. Falls back to the diagnostic itself if the launcher this
    // build maps to has since been retired, so the chip is never a dead tap.
    const diag = e.target.closest('[data-home-diag]');
    if (diag) {
      const btn = document.getElementById(diag.getAttribute('data-home-diag'));
      if (btn) btn.click(); else window.location.href = 'diagnostic.html';
      return;
    }
    const mode = e.target.closest('[data-home-mode]');
    if (mode) {
      const btn = document.getElementById(mode.getAttribute('data-home-mode'));
      if (btn) btn.click();
    }
  });
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('[data-home-mode]');
    if (row) { e.preventDefault(); row.click(); }
  });
}

(() => {
  const btn = document.getElementById('home-btn');
  if (btn) btn.addEventListener('click', () => {
    // Home is the canonical front door — make the URL say so, so a refresh
    // (or a share) lands back here instead of on the resumed lesson.
    try { history.replaceState(null, '', '#/m/home'); } catch (_) {}
    openHome();
  });
})();
