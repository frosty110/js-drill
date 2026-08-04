// ============================================================================
// System Design memorization drill — standalone, multi-topic MC + open recall.
// Content: data/system-design/topics.json → <topic>/manifest.json → chNN.json.
// Progress: DrillStorage.load/saveSystemDesign (key jsdrill.systemdesign.v1).
// ============================================================================
'use strict';

const BASE = 'data/system-design';
const INTERVAL_DAYS = [0, 1, 3, 7, 16, 45];  // days until due after reaching box i
const MAX_BOX = 5, MASTER_BOX = 4, DAY = 86400000;

let TOPICS = [];              // topics.json registry
let META = {};               // topicId -> manifest
let INFOGRAPHIC_SETS = null;  // authored multi-image study sets
let CH = {};                 // topicId -> { chId -> chapter json }
let progress = load();       // { __v, boxes:{key:{box,seen,good,again,due,last}}, lastTopic, lastChapter }
let session = null;
let curTopic = null;

function load() {
  const s = (window.DrillStorage && DrillStorage.loadSystemDesign()) || null;
  if (s && s.boxes) return s;
  return { __v: 1, boxes: {}, lastTopic: null, lastChapter: null };
}
function persist() { if (window.DrillStorage) DrillStorage.saveSystemDesign(progress); }

// ── SR (Leitner) keyed by full item key ─────────────────────────────────
function boxOf(key) { return progress.boxes[key] || { box: 0, seen: 0, good: 0, again: 0, due: 0, last: 0 }; }
function isMastered(key) { return boxOf(key).box >= MASTER_BOX; }
// audit F11: `isDue` used to be `box === 0 || due <= now`, which counted a card
// the user has NEVER SEEN as overdue — so a first-time visitor was greeted with
// "202 due" on a topic they hadn't opened. Never-seen is NEW, not a review debt.
// The three predicates now say exactly one thing each:
//   isNew      — never attempted; work to LEARN
//   isDue      — attempted, and its Leitner interval has come around; work to REPAIR
//   needsDrill — the old union, kept for the places that build a session QUEUE
//                (a new card does belong in the pool, it just isn't a debt).
function isNew(key) { return boxOf(key).seen === 0; }
function isDue(key) { const b = boxOf(key); return b.seen > 0 && b.due <= Date.now(); }
function needsDrill(key) { return isNew(key) || isDue(key); }
function grade(key, outcome, pick) {   // 'good' | 'partial' | 'again'
  const b = progress.boxes[key] || { box: 0, seen: 0, good: 0, again: 0, due: 0, last: 0 };
  b.seen++; b.last = Date.now();
  // Share capture: the Leitner counters say how OFTEN this was missed, never
  // how the LAST attempt went — which is what a share code encodes. `lastPick`
  // is the authored option index on a multiple-choice question, so a share
  // link can say which distractor pulled the user, not merely that they missed.
  b.lastOutcome = outcome;
  if (typeof pick === 'number') b.lastPick = pick;
  if (outcome === 'good') { b.good++; b.box = Math.min(b.box + 1, MAX_BOX); }
  else if (outcome === 'partial') { b.box = Math.max(b.box, 1); }   // hold position, resurface soon
  else { b.again++; b.box = 1; }
  const interval = outcome === 'partial' ? 1 : INTERVAL_DAYS[Math.min(b.box, INTERVAL_DAYS.length - 1)];
  b.due = Date.now() + interval * DAY;
  progress.boxes[key] = b; persist();
}

// ── Data loading ─────────────────────────────────────────────────────────
async function loadTopics() { if (!TOPICS.length) TOPICS = (await fetch(`${BASE}/topics.json`).then(r => r.json())).topics; return TOPICS; }
async function loadMeta(t) {
  if (!META[t]) {
    const m = await fetch(`${BASE}/${t}/manifest.json`).then(r => r.json());
    // Chapter ids are PERMANENT — SR keys, deep links and infographic paths all
    // depend on them. Display position instead comes from parts[] order, so
    // re-grouping a topic never renumbers a file. `_order` is that mapping.
    m._order = {};
    (m.parts || []).flatMap(p => p.chapters).forEach((cid, i) => { m._order[cid] = i + 1; });
    m._partOf = {};
    (m.parts || []).forEach(p => p.chapters.forEach(cid => { m._partOf[cid] = p.name; }));
    META[t] = m;
  }
  return META[t];
}
async function loadChapter(t, id) { CH[t] = CH[t] || {}; if (!CH[t][id]) CH[t][id] = await fetch(`${BASE}/${t}/${id}.json`).then(r => r.json()); return CH[t][id]; }
async function loadTopicChapters(t) { const m = await loadMeta(t); await Promise.all(m.chapters.map(c => loadChapter(t, c.id))); return m.chapters.map(c => CH[t][c.id]); }
async function loadInfographicSets() {
  if (!INFOGRAPHIC_SETS) INFOGRAPHIC_SETS = (await fetch(`${BASE}/infographic-sets.json`).then(r => r.json())).sets || {};
  return INFOGRAPHIC_SETS;
}

// ── Component catalog + the component↔problem graph ──────────────────────
// The catalog is the Building Blocks topic INVERTED: instead of "here is a
// system, here are its parts", it is "here is a part — when do you reach for
// it, what does it cost, and which canonical problems use it, doing what?".
//
// The edges already half-existed: every design problem carries `tags.mechanism`,
// but the chip only ever linked SIDEWAYS to a filtered list of other problems.
// There was no component node in the graph. mechanism-map.json supplies the
// missing half — one annotation per edge saying what the component is DOING in
// that problem — and the same string renders at both endpoints.
// Contract: docs/component-catalog.md.
let CATALOG = null, EDGES = null;
const CATALOG_TOPICS = new Set(['components']);
const catalogAppliesTo = (t) => CATALOG_TOPICS.has(t);

async function loadCatalog() {
  if (!CATALOG) {
    try {
      const [cat, map] = await Promise.all([
        fetch(`${BASE}/components/catalog.json`).then(r => r.json()),
        fetch(`${BASE}/mechanism-map.json`).then(r => r.json())
      ]);
      CATALOG = cat; EDGES = (map && map.edges) || {};
    } catch (_) { CATALOG = { categories: [], components: [] }; EDGES = {}; }
    CATALOG._byId = Object.fromEntries((CATALOG.components || []).map(c => [c.id, c]));
    // mechanism → component, so a problem's existing tag can find its page.
    CATALOG._byMechanism = Object.fromEntries(
      (CATALOG.components || []).filter(c => c.mechanism).map(c => [c.mechanism, c.id]));
  }
  return CATALOG;
}

const componentById = (id) => (CATALOG && CATALOG._byId && CATALOG._byId[id]) || null;
const componentForMechanism = (m) => (CATALOG && CATALOG._byMechanism && CATALOG._byMechanism[m]) || null;
// Every problem this component appears in, newest-authored order preserved, each
// with the annotation that says what it is doing there.
function componentEdges(id) {
  const byProblem = (EDGES && EDGES[id]) || {};
  return Object.keys(byProblem).sort().map(pid => ({ problem: pid, note: byProblem[pid] }));
}
// The reverse lookup a design problem needs: its mechanisms, resolved to
// components, carrying the same annotation the component page shows.
function problemComponents(pid, mechanisms) {
  return (mechanisms || []).map(m => {
    const cid = componentForMechanism(m);
    const c = cid ? componentById(cid) : null;
    return c ? { component: c, note: ((EDGES && EDGES[cid]) || {})[pid] || '' } : null;
  }).filter(Boolean);
}

// ── Helpers ───────────────────────────────────────────────────────────────
function esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function fmt(s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>'); }
function shuffle(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[r[i], r[j]] = [r[j], r[i]]; } return r; }
