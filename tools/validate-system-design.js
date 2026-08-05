#!/usr/bin/env node
// Validator for the System Design memorization surface (system-design.html).
//
// Content is conceptual recall (no code execution), across multiple TOPICS
// registered in data/system-design/topics.json. Each topic has a manifest and
// per-chapter files whose `questions[]` mix two shapes:
//   - MC   (type "mc" or absent): exactly 4 unique options, in-range `answer`,
//                                  non-empty `q` + `explain`.
//   - open (type "open"):         non-empty `prompt`, >=3 `points` rubric
//                                  bullets, non-empty `answer`; NO options.
//
// Checks: topics↔manifests↔disk parity, part/chapter coverage, per-question
// shape, MC answer-index variety, diagram schema/safe syntax, the complete
// lesson infographic plan, and every registered single- or multi-image asset.
// Canonical design problems additionally
// require four architecture diagrams, each tied to a valid reveal position.
// Exits non-zero on failure.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SD = path.join(ROOT, 'data', 'system-design');
const INFOGRAPHICS = path.join(ROOT, 'assets', 'system-design', 'infographics');
const INFOGRAPHIC_TOPICS = new Set(['components', 'ddia', 'design-problems']);

// Declared before the config reads below: readJson() reports parse failures
// through fail(), so a malformed infographic JSON would otherwise die with
// "Cannot access 'fail' before initialization" instead of naming the file.
let errors = 0, totalQ = 0, totalMC = 0, totalOpen = 0, totalDiagrams = 0, totalInfographics = 0;
// The two auto-derived prose templates that shipped as filler. Kept as an
// explicit gate so they cannot be reintroduced by a future bulk generator:
// the failure mode is silent, because filler still renders and still validates.
const FILLER = {
  summary: /focused sheets separate the system map/i,
  purpose: /enough room to trace independently/i
};

const fail = (where, msg) => { errors++; console.error(`  ✗ [${where}] ${msg}`); };

const INFOGRAPHIC_SPECS = readJson(path.join(SD, 'infographic-specs.json')) || {};
const INFOGRAPHIC_SETS = (readJson(path.join(SD, 'infographic-sets.json')) || {}).sets || {};
const INFOGRAPHIC_PLAN = (readJson(path.join(SD, 'infographic-plan.json')) || {}).lessons || {};
const expectedInfographics = new Set();
const registeredLessons = new Set();
let totalPending = 0;

// --- Faceted tags (data/system-design/tags.json) -----------------------------
// Authored facets live on manifest chapter entries so the topic home can filter
// before any unit file is fetched. Registry-closed: an authored value that isn't
// registered is an error, which is what stops near-synonyms ("work-queue" vs
// "task-queue") from accumulating.
const TAGS = readJson(path.join(SD, 'tags.json')) || {};
const TAG_FACETS = Array.isArray(TAGS.facets) ? TAGS.facets : [];
const TAG_TOPICS = new Set(Array.isArray(TAGS.appliesTo) ? TAGS.appliesTo : []);
const facetValues = (id) => {
  const f = TAG_FACETS.find(x => x.id === id);
  return new Set((f && Array.isArray(f.values) ? f.values : []).map(v => v.id));
};
const MECHANISMS = facetValues('mechanism');
const DIFFICULTIES = facetValues('difficulty');
const COMPANIES = facetValues('company');

// --- Study plans (data/system-design/plans.json) -----------------------------
// A plan is a route through existing content, never a copy of it. The rule that
// matters: every referenced unit must exist, or the plan runner builds a queue
// with holes in it and the failure surfaces mid-session as a blank screen.
const PLANS_FILE = readJson(path.join(SD, 'plans.json'));
function validatePlans(unitIdsByTopic, cruxUnits) {
  if (!PLANS_FILE) return;                     // optional file
  const topic = PLANS_FILE.appliesTo;
  const known = unitIdsByTopic[topic];
  if (!known) { fail('plans.json', `appliesTo "${topic}" is not a known topic`); return; }
  if (!Array.isArray(PLANS_FILE.plans) || !PLANS_FILE.plans.length) {
    fail('plans.json', 'plans must be a non-empty array'); return;
  }
  const seen = new Set();
  for (const p of PLANS_FILE.plans) {
    const at = `plans.json/${p && p.id ? p.id : '?'}`;
    if (!p || !p.id || !/^[a-z0-9-]+$/.test(p.id)) { fail(at, 'plan needs a kebab-case id'); continue; }
    if (seen.has(p.id)) fail(at, `duplicate plan id ${p.id}`);
    seen.add(p.id);
    for (const f of ['title', 'budget', 'blurb']) if (!p[f]) fail(at, `missing ${f}`);
    if (!['all', 'crux'].includes(p.mode)) fail(at, `mode must be "all" or "crux", got ${JSON.stringify(p.mode)}`);
    if (p.units === '*') continue;             // every unit, resolved at load
    if (!Array.isArray(p.units) || p.units.length < 2) { fail(at, 'units must be "*" or an array of >= 2 unit ids'); continue; }
    if (new Set(p.units).size !== p.units.length) fail(at, 'units has duplicates');
    for (const u of p.units) {
      if (!known.has(u)) fail(at, `references unknown unit "${u}"`);
      // A crux plan over a unit with no crux questions yields an empty step —
      // the user taps through to nothing and the plan silently under-delivers.
      else if (p.mode === 'crux' && !cruxUnits.has(`${topic}/${u}`)) {
        fail(at, `crux plan references "${u}", which has no crux:true questions`);
      }
    }
  }
  const cp = PLANS_FILE.companyPlans;
  if (cp && (!Number.isInteger(cp.minUnits) || cp.minUnits < 2)) {
    fail('plans.json', 'companyPlans.minUnits must be an integer >= 2');
  }
}

// --- Component catalog + the component↔problem graph -------------------------
// docs/component-catalog.md is the contract. Two files, one graph:
//   components/catalog.json  the component NODES, grouped into categories
//   mechanism-map.json       the EDGES, each annotated with what the component
//                            is DOING in that problem
//
// The load-bearing gate is coverage (gate 5 in the doc): a component that
// declares a `mechanism` must annotate every design problem already tagged with
// it. Without that, tagging a problem and forgetting the annotation degrades the
// component page into a list of names — the exact link-farm failure the surface
// exists to avoid, and one that renders perfectly while teaching nothing.
const CATALOG = readJson(path.join(SD, 'components', 'catalog.json'));
const EDGE_FILE = readJson(path.join(SD, 'mechanism-map.json'));
const MAX_EDGE_CHARS = 220;
const CATALOG_TEXT_FIELDS = ['reachFor', 'avoid', 'costs', 'failureModes'];

function validateCatalog() {
  if (!CATALOG) { fail('components/catalog.json', 'missing or unreadable'); return; }
  const cats = Array.isArray(CATALOG.categories) ? CATALOG.categories : [];
  const comps = Array.isArray(CATALOG.components) ? CATALOG.components : [];
  if (!cats.length) fail('catalog.json', 'no categories declared');
  if (!comps.length) fail('catalog.json', 'no components declared');
  // Which topic owns the catalog is DATA, the way plans.json and tags.json
  // declare it — the page generator reads this rather than assuming.
  if (!registry.topics.some(t => t.id === CATALOG.appliesTo)) {
    fail('catalog.json', `appliesTo "${CATALOG.appliesTo}" is not a registered topic`);
  }

  const catIds = new Set();
  for (const c of cats) {
    if (!c || !c.id || !c.title) { fail('catalog.json', 'every category needs an id and a title'); continue; }
    if (!/^[a-z0-9-]+$/.test(c.id)) fail('catalog.json', `category id "${c.id}" must be kebab-case`);
    if (catIds.has(c.id)) fail('catalog.json', `duplicate category id ${c.id}`);
    catIds.add(c.id);
    if (!c.blurb) fail('catalog.json', `category ${c.id} missing blurb`);
  }

  const compIds = new Set();
  for (const c of comps) {
    const at = `catalog.json ${c && c.id ? c.id : '?'}`;
    if (!c || !c.id || !c.title) { fail('catalog.json', 'every component needs an id and a title'); continue; }
    // The id IS the URL (#/components/c/<id>), so a non-slug id would produce a
    // route the sanitiser silently rewrites into one that matches nothing.
    if (!/^[a-z0-9-]+$/.test(c.id)) fail(at, `component id must be kebab-case`);
    if (compIds.has(c.id)) fail(at, 'duplicate component id');
    compIds.add(c.id);
    if (!catIds.has(c.category)) fail(at, `category "${c.category}" is not declared`);
    if (!c.what || !String(c.what).trim()) fail(at, 'missing "what"');
    for (const f of CATALOG_TEXT_FIELDS) {
      const v = c[f];
      const min = f === 'reachFor' ? 2 : 1;
      if (!Array.isArray(v) || v.length < min) fail(at, `"${f}" needs >= ${min} entr${min === 1 ? 'y' : 'ies'}`);
      else if (!v.every(x => typeof x === 'string' && x.trim())) fail(at, `"${f}" has an empty entry`);
    }
    // A mechanism ties the component to the faceted tag registry. Unregistered
    // means the chip deep-links to a facet value matching nothing — an empty
    // list, no error.
    if (c.mechanism && !MECHANISMS.has(c.mechanism)) {
      fail(at, `mechanism "${c.mechanism}" is not registered in tags.json`);
    }
  }

  // Alternatives are the "rule out the near neighbour" surface (G2); a dangling
  // id is a dead link on the one row the user is most likely to follow.
  const mechOwner = {};
  for (const c of comps) {
    for (const a of (c.alternatives || [])) {
      if (!a || !a.id) { fail(`catalog.json ${c.id}`, 'alternative missing id'); continue; }
      if (!compIds.has(a.id)) fail(`catalog.json ${c.id}`, `alternative "${a.id}" is not a component`);
      if (a.id === c.id) fail(`catalog.json ${c.id}`, 'component lists itself as an alternative');
      if (!a.note || !String(a.note).trim()) fail(`catalog.json ${c.id}`, `alternative "${a.id}" needs a note saying what decides between them`);
    }
    if (c.mechanism) {
      if (mechOwner[c.mechanism]) fail('catalog.json', `mechanism "${c.mechanism}" claimed by both ${mechOwner[c.mechanism]} and ${c.id}`);
      else mechOwner[c.mechanism] = c.id;
    }
    if (c.drill && c.drill.unit && c.drill.topic) {
      const f = path.join(SD, c.drill.topic, `${c.drill.unit}.json`);
      if (!fs.existsSync(f)) fail(`catalog.json ${c.id}`, `drill points at missing unit ${c.drill.topic}/${c.drill.unit}`);
    }
  }

  // --- Edges ---------------------------------------------------------------
  const edges = (EDGE_FILE && EDGE_FILE.edges) || null;
  if (!edges) { fail('mechanism-map.json', 'missing or unreadable — expected an edges{} object'); return; }

  const dpManifest = readJson(path.join(SD, 'design-problems', 'manifest.json'));
  const dpChapters = (dpManifest && dpManifest.chapters) || [];
  const problemIds = new Set(dpChapters.map(c => c.id));
  const taggedWith = {};
  for (const ch of dpChapters) {
    for (const m of ((ch.tags || {}).mechanism || [])) (taggedWith[m] || (taggedWith[m] = new Set())).add(ch.id);
  }

  let edgeCount = 0;
  for (const [compId, byProblem] of Object.entries(edges)) {
    if (!compIds.has(compId)) { fail('mechanism-map.json', `edges for unknown component "${compId}"`); continue; }
    for (const [pid, note] of Object.entries(byProblem)) {
      edgeCount++;
      const at = `mechanism-map.json ${compId}→${pid}`;
      if (!problemIds.has(pid)) fail(at, 'not a design-problem unit id');
      if (typeof note !== 'string' || !note.trim()) fail(at, 'empty annotation');
      else if (note.length > MAX_EDGE_CHARS) fail(at, `annotation is ${note.length} chars, max ${MAX_EDGE_CHARS}`);
      // Renders at BOTH endpoints, so a sentence that names its own problem
      // reads as nonsense on that problem's own page.
      else if (/^(this|the) (problem|design|system) (uses|needs)/i.test(note.trim())) {
        fail(at, 'annotation must be a predicate about the job, not a "this problem uses…" preamble');
      }
    }
  }

  // Gate 5 — coverage.
  for (const c of comps) {
    if (!c.mechanism) continue;
    const need = taggedWith[c.mechanism] || new Set();
    const have = new Set(Object.keys(edges[c.id] || {}));
    const missing = [...need].filter(p => !have.has(p));
    if (missing.length) {
      fail('mechanism-map.json', `${c.id}: no annotation for ${missing.join(', ')} — tagged "${c.mechanism}" but nothing says what it is doing there`);
    }
  }

  // A component with no edges is REPORTED, not failed. Its failure mode is
  // visible — the page says "not yet mapped to a canonical design problem" —
  // and invariants are for the failures you cannot see. Blocking here would
  // also forbid the honest case: a block worth knowing that no canonical
  // problem happens to turn into a decision.
  const unmapped = comps.filter(c => !Object.keys(edges[c.id] || {}).length);

  if (errors === 0) {
    console.log(`  Component catalog OK — ${comps.length} components in ${cats.length} categories, ${edgeCount} annotated edges.`);
    if (unmapped.length) {
      console.log(`  note: ${unmapped.length} component(s) carry no problem edge — ${unmapped.slice(0, 4).map(c => c.id).join(', ')}${unmapped.length > 4 ? ', …' : ''}`);
    }
  }
}

function validateTagRegistry() {
  if (!TAGS.facets) { fail('tags.json', 'missing or unreadable — expected a facets[] array'); return; }
  const seen = new Set();
  for (const f of TAG_FACETS) {
    if (!f || !f.id || !f.label) { fail('tags.json', 'every facet needs an id and a label'); continue; }
    if (seen.has(f.id)) fail('tags.json', `duplicate facet id ${f.id}`);
    seen.add(f.id);
    if (!f.authored && !f.derived) fail('tags.json', `facet ${f.id} must be either authored or derived`);
    for (const v of (f.values || [])) {
      if (!v || !v.id || !v.label) fail('tags.json', `facet ${f.id} has a value missing id or label`);
      else if (!/^[a-z0-9-]+$/.test(v.id)) fail('tags.json', `facet ${f.id} value "${v.id}" must be kebab-case`);
    }
  }
  for (const id of ['mechanism', 'difficulty', 'company']) {
    if (!seen.has(id)) fail('tags.json', `missing required authored facet "${id}"`);
  }
}

// Authored tags on one manifest chapter entry. Mechanism is required (>=2) because
// it is the cross-family transfer index — a problem with one mechanism can't answer
// "what else solves it this way?".
// A unit's `brief` — the scoped requirements + scale constants a drill session
// can't reconstruct from a shuffled question. Required on design problems (the
// topic whose prompts lean hardest on session context), optional elsewhere but
// schema-checked wherever it appears.
const BRIEF_REQUIRED_TOPICS = new Set(['design-problems']);
function validateBrief(topic, ch, where) {
  const b = ch.brief;
  if (b === undefined) {
    if (BRIEF_REQUIRED_TOPICS.has(topic)) fail(where, 'missing "brief" (functional + scale)');
    return;
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return fail(where, '"brief" must be an object');
  for (const k of ['functional', 'scale']) {
    if (!Array.isArray(b[k]) || b[k].length < 2) fail(where, `brief.${k} needs >= 2 entries`);
    else if (!b[k].every(x => typeof x === 'string' && x.trim())) fail(where, `empty brief.${k} entry`);
  }
  if (b.gate !== undefined) {
    const n = Array.isArray(ch.questions) ? ch.questions.length : 0;
    if (!Array.isArray(b.gate)) fail(where, 'brief.gate must be an array of question indices');
    else b.gate.forEach(i => {
      if (!Number.isInteger(i) || i < 0 || i >= n) fail(where, `brief.gate index ${i} out of range (0..${n - 1})`);
    });
  }
  for (const k of Object.keys(b)) {
    if (!['functional', 'scale', 'gate'].includes(k)) fail(where, `unknown brief field "${k}"`);
  }
}

function validateChapterTags(topic, entry, where) {
  if (!TAG_TOPICS.has(topic)) return;
  const tags = entry.tags;
  if (!tags || typeof tags !== 'object') { fail(where, 'manifest entry missing "tags" block'); return; }

  if (!tags.difficulty) fail(where, 'tags.difficulty is required');
  else if (!DIFFICULTIES.has(tags.difficulty)) fail(where, `unregistered difficulty "${tags.difficulty}"`);

  if (!Array.isArray(tags.mechanism) || tags.mechanism.length < 2) {
    fail(where, 'tags.mechanism must list at least 2 registered mechanisms');
  } else {
    if (new Set(tags.mechanism).size !== tags.mechanism.length) fail(where, 'tags.mechanism has duplicates');
    for (const m of tags.mechanism) if (!MECHANISMS.has(m)) fail(where, `unregistered mechanism "${m}"`);
  }

  if (!Array.isArray(tags.company)) fail(where, 'tags.company must be an array (may be empty)');
  else {
    if (new Set(tags.company).size !== tags.company.length) fail(where, 'tags.company has duplicates');
    for (const c of tags.company) if (!COMPANIES.has(c)) fail(where, `unregistered company "${c}"`);
  }
}

const INFOGRAPHIC_VISUAL_TYPES = new Set([
  'routing-map', 'cache-layers', 'edge-globe', 'queue-conveyor',
  'token-bucket', 'primitive-toolkit', 'protocol-branches',
  'three-pillars', 'data-models', 'storage-cutaway',
  'compatibility-bridge', 'replication-topologies', 'partition-map',
  'transaction-timeline', 'partial-failure', 'consensus-overlap',
  'batch-pipeline', 'stream-windows', 'derived-ecosystem'
]);

const MIN_QUESTIONS = 8;      // MC + open combined, per chapter
const MIN_TAKEAWAYS = 3;
const MIN_OPEN_POINTS = 3;

const DIAGRAM_ROLES = new Set(['overview', 'request-flow', 'mechanism', 'comparison', 'failure', 'lifecycle']);

function validateDiagram(diagram, where, collection = false) {
  totalDiagrams++;
  if (!diagram || typeof diagram !== 'object' || Array.isArray(diagram)) {
    fail(where, 'diagram must be an object'); return;
  }
  if (!['mermaid', 'svg'].includes(diagram.kind)) fail(where, `kind must be "mermaid" or "svg", got ${JSON.stringify(diagram.kind)}`);
  if (!diagram.code || typeof diagram.code !== 'string') fail(where, 'missing non-empty code');
  if (collection) {
    if (!diagram.id || typeof diagram.id !== 'string') fail(where, 'diagrams[] item needs a stable id');
    if (!diagram.title || typeof diagram.title !== 'string') fail(where, 'diagrams[] item needs a title');
    if (!DIAGRAM_ROLES.has(diagram.role)) fail(where, `role must be one of ${[...DIAGRAM_ROLES].join(', ')}`);
    if (!diagram.takeaway || typeof diagram.takeaway !== 'string') fail(where, 'diagrams[] item needs a takeaway');
  }
  if (diagram.kind === 'mermaid' && typeof diagram.code === 'string') {
    if (!/^(flowchart (LR|TD)|sequenceDiagram)\n/.test(diagram.code)) fail(where, 'Mermaid must start with flowchart LR/TD or sequenceDiagram');
    if (/(^|\n)\s*(click|style|classDef)\b|%%\{/.test(diagram.code)) fail(where, 'unsafe/unsupported Mermaid directive');
  }
}

function validateDiagrams(owner, where) {
  if (owner.diagram) validateDiagram(owner.diagram, `${where} diagram`);
  if (owner.diagrams != null) {
    if (!Array.isArray(owner.diagrams) || owner.diagrams.length === 0) {
      fail(where, 'diagrams must be a non-empty array'); return;
    }
    if (owner.diagram) fail(where, 'use either diagram or diagrams, not both');
    const ids = new Set();
    owner.diagrams.forEach((diagram, i) => {
      validateDiagram(diagram, `${where} diagrams[${i}]`, true);
      if (diagram && diagram.id) {
        if (ids.has(diagram.id)) fail(where, `duplicate diagram id "${diagram.id}"`);
        ids.add(diagram.id);
      }
    });
  }
}

function validateInfographicFile(relative, widthExpected, heightExpected, where) {
  expectedInfographics.add(relative);
  const file = path.join(INFOGRAPHICS, relative);
  if (!fs.existsSync(file)) { fail(where, `missing downloadable infographic assets/system-design/infographics/${relative}`); return; }
  const png = fs.readFileSync(file);
  if (png.length < 24 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    fail(where, 'infographic is not a valid PNG'); return;
  }
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  if (width !== widthExpected || height !== heightExpected) fail(where, `infographic must be ${widthExpected}×${heightExpected}, got ${width}×${height}`);
  totalInfographics++;
}

function validateInfographic(topic, id, where) {
  const key = `${topic}/${id}`;
  const set = INFOGRAPHIC_SETS[key];
  const plan = INFOGRAPHIC_PLAN[key];
  if (!plan) fail(where, 'missing lesson entry in infographic-plan.json');
  else {
    if (!Number.isInteger(plan.count) || plan.count < 1) fail(where, 'infographic plan count must be a positive integer');
    if (!Array.isArray(plan.graphics) || plan.graphics.length !== plan.count) fail(where, 'infographic plan graphics must match count');
    else if (new Set(plan.graphics).size !== plan.graphics.length) fail(where, 'infographic plan graphic ids must be unique');
  }
  // `pending: true` = the lesson's text is authored and gated, but its hand-drawn
  // sheets haven't landed yet. SHIPPED BUT DELIBERATELY UNUSED: the repo owner
  // wants a missing sheet to fail hard, so the red gate is the artwork to-do list.
  // Kept available in case that call is ever reversed.
  if (plan && plan.pending === true) { totalPending++; return; }
  // Every infographic lesson now has an authored multi-image set — the old
  // single-illustrated-sheet fallback retired when the last lesson converted.
  if (!set) { fail(where, 'every infographic lesson needs an authored multi-image set'); return; }
  if (!set.title) fail(where, 'infographic set needs a title');
  // `summary` and the per-item `purpose` are OPTIONAL, and the rule is inverted
  // on purpose: they used to be required, which is how 33 summaries and 113
  // purposes came to be auto-derived filler that restated the title back at the
  // reader ("Give chat system system map enough room to trace independently").
  // Requiring a field you cannot fill honestly manufactures noise. Absent is
  // fine; templated is not.
  if (set.summary != null && FILLER.summary.test(set.summary)) {
    fail(where, 'set summary is the auto-derived template — write a real one or omit it');
  }
  if (!Array.isArray(set.items) || set.items.length < 2) {
    fail(where, 'authored infographic set needs at least two focused graphics');
    return;
  }
  if (plan && set.items.length !== plan.count) fail(where, `authored set has ${set.items.length} graphics but plan calls for ${plan.count}`);
  const ids = new Set();
  set.items.forEach((item, index) => {
    const at = `${where} infographic ${index + 1}`;
    if (!item || typeof item !== 'object') { fail(at, 'item must be an object'); return; }
    if (!item.id || !/^[a-z0-9-]+$/.test(item.id)) fail(at, 'item needs a kebab-case id');
    else if (ids.has(item.id)) fail(at, `duplicate id ${item.id}`);
    else ids.add(item.id);
    for (const field of ['kind', 'title', 'description']) if (!item[field] || typeof item[field] !== 'string') fail(at, `missing ${field}`);
    if (item.purpose != null && FILLER.purpose.test(item.purpose)) {
      fail(at, 'purpose is the auto-derived template — write a real one or omit it');
    }
    if (item.renderer != null && item.renderer !== 'diagram-v1') fail(at, `unknown renderer ${JSON.stringify(item.renderer)}`);
    if (!Array.isArray(item.flow) || item.flow.length < 3) fail(at, 'flow needs at least three numbered steps');
    else item.flow.forEach((step, stepIndex) => {
      if (step.step !== stepIndex + 1 || !step.title || !step.detail) fail(at, `flow step ${stepIndex + 1} needs sequential number, title, and detail`);
    });
    if (!Array.isArray(item.numbers) || !item.numbers.length) fail(at, 'numbers needs at least one scale or operating assumption');
    else item.numbers.forEach((number, numberIndex) => {
      if (!number.label || !number.value || !number.detail) fail(at, `number ${numberIndex + 1} needs label, value, and detail`);
    });
    if (!Array.isArray(item.priorities) || item.priorities.length < 2) fail(at, 'priorities needs at least two entries');
    else if (new Set(item.priorities.map(value => value.toLowerCase())).size !== item.priorities.length) fail(at, 'priorities must be distinct');
    if (!Array.isArray(item.tradeoffs) || item.tradeoffs.length < 2) fail(at, 'tradeoffs needs at least two entries');
    else if (new Set(item.tradeoffs.map(value => value.toLowerCase())).size !== item.tradeoffs.length) fail(at, 'tradeoffs must be distinct');
    if (!Number.isInteger(item.width) || !Number.isInteger(item.height) || item.width < 1200 || item.height < 1600 || item.height <= item.width) {
      fail(at, 'image dimensions must describe a high-resolution portrait asset');
    } else if (item.id) {
      validateInfographicFile(`${topic}/${id}/${item.id}.png`, item.width, item.height, at);
    }
  });
  if (plan && Array.isArray(plan.graphics) && set.items.map(item => item.id).join('|') !== plan.graphics.join('|')) {
    fail(where, 'authored infographic ids/order must match infographic-plan.json');
  }
}

function validateInfographicSpec(topic, id, where) {
  if (topic === 'design-problems') return;
  const spec = INFOGRAPHIC_SPECS[`${topic}/${id}`];
  if (!spec) { fail(where, 'missing authored entry in infographic-specs.json'); return; }
  if (!INFOGRAPHIC_VISUAL_TYPES.has(spec.visualType)) {
    fail(where, `infographic spec needs a registered visualType, got ${JSON.stringify(spec.visualType)}`);
  }
  if (!spec.coreIdea || !spec.tradeoff) fail(where, 'infographic spec needs coreIdea and tradeoff');
  if (!Array.isArray(spec.flow) || spec.flow.length < 3 || spec.flow.length > 5) fail(where, 'infographic flow needs 3–5 nodes');
  if (!Array.isArray(spec.flowLabels) || spec.flowLabels.length !== spec.flow.length - 1) fail(where, 'infographic flowLabels must connect every adjacent node');
  if (!Array.isArray(spec.cards) || spec.cards.length !== 4) fail(where, 'infographic spec needs exactly four study cards');
  else spec.cards.forEach((card, index) => {
    if (!card.title || !card.body) fail(where, `infographic card ${index + 1} needs title and body`);
  });
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { fail(path.relative(SD, file), `not valid JSON: ${e.message}`); return null; }
}

const registry = readJson(path.join(SD, 'topics.json'));
if (!registry || !Array.isArray(registry.topics)) {
  console.error('\nSystem Design validation FAILED (no topics.json).'); process.exit(1);
}

validateTagRegistry();

const unitIdsByTopic = {};
const cruxUnits = new Set();
for (const topic of registry.topics) {
  const t = topic.id;
  const dir = path.join(SD, t);
  if (!fs.existsSync(dir)) { fail('topics', `topic "${t}" has no directory ${t}/`); continue; }

  const manifest = readJson(path.join(dir, 'manifest.json'));
  if (!manifest) continue;

  const validParts = new Set((manifest.parts || []).map(p => p.name));
  const manifestIds = manifest.chapters.map(c => c.id);
  const diskFiles = fs.readdirSync(dir)
    .filter(f => /^(ch|s|c|p)\d\d\.json$/.test(f)).map(f => f.replace(/\.json$/, ''));

  for (const id of manifestIds) if (!diskFiles.includes(id)) fail(t, `manifest lists ${id} but ${id}.json missing`);
  for (const id of diskFiles) if (!manifestIds.includes(id)) fail(t, `${id}.json on disk but not in manifest`);

  const partChapters = (manifest.parts || []).flatMap(p => p.chapters);
  for (const id of manifestIds) if (!partChapters.includes(id)) fail(t, `${id} not assigned to any part`);
  // ...and exactly once: a chapter listed in two parts renders its card twice and
  // makes `displayNum` non-contiguous. Hand-re-parting makes this a live risk.
  for (const id of new Set(partChapters)) {
    const n = partChapters.filter(x => x === id).length;
    if (n > 1) fail(t, `${id} assigned to ${n} parts — must be exactly one`);
  }
  for (const id of partChapters) if (!manifestIds.includes(id)) fail(t, `part references unknown chapter ${id}`);

  for (const entry of manifest.chapters) {
    const id = entry.id;
    const file = path.join(dir, `${id}.json`);
    if (!fs.existsSync(file)) continue;
    const ch = readJson(file);
    if (!ch) continue;
    const at = `${t}/${id}`;
    registeredLessons.add(at);
    (unitIdsByTopic[t] || (unitIdsByTopic[t] = new Set())).add(id);
    if (Array.isArray(ch.questions) && ch.questions.some(q => q && q.crux)) cruxUnits.add(at);

    if (ch.id !== id) fail(at, `id "${ch.id}" != manifest "${id}"`);
    const num = ch.num != null ? ch.num : ch.chapter;
    const entryNum = entry.num != null ? entry.num : entry.chapter;
    if (num !== entryNum) fail(at, `num ${num} != manifest ${entryNum}`);
    if (!ch.title) fail(at, 'missing title');
    // The manifest's copy of the title is denormalized the same way its
    // `questions` count is, and for the same reason: consumers that must not
    // fetch 32 unit files read the manifest instead — the crawlable topic index
    // links units by it (so the link text disagreed with the <h1> it points at),
    // and the main app's Home loads it into `_sdIndex` already. A drift here is
    // invisible in the drill and wrong everywhere else.
    else if (entry.title && entry.title !== ch.title) {
      fail(at, `manifest title "${entry.title}" != unit title "${ch.title}"`);
    }
    if (!ch.summary) fail(at, 'missing summary');
    if (ch.part && validParts.size && !validParts.has(ch.part)) fail(at, `part "${ch.part}" not a manifest part`);
    validateChapterTags(t, entry, at);
    if (!Array.isArray(ch.keyTakeaways) || ch.keyTakeaways.length < MIN_TAKEAWAYS) fail(at, `keyTakeaways needs >= ${MIN_TAKEAWAYS} entries`);
    else if (!ch.keyTakeaways.every(x => typeof x === 'string' && x.trim())) fail(at, 'empty keyTakeaway');
    validateDiagrams(ch, at);
    if (INFOGRAPHIC_TOPICS.has(t)) {
      validateInfographic(t, id, at);
      validateInfographicSpec(t, id, at);
    }

    if (!Array.isArray(ch.questions) || ch.questions.length < MIN_QUESTIONS) {
      fail(at, `expected >= ${MIN_QUESTIONS} questions, got ${ch.questions ? ch.questions.length : 0}`); continue;
    }
    // The manifest carries a `questions` count per unit so the main app's Home
    // page can show System Design progress (mastered/total per topic) from 5
    // small fetches instead of pulling all 43 unit files. It's a denormalized
    // count, so it has to be gated — a drifted number would silently misreport
    // progress on the front door.
    if (!Number.isInteger(entry.questions)) {
      fail(at, `manifest entry missing "questions" count (expected ${ch.questions.length})`);
    } else if (entry.questions !== ch.questions.length) {
      fail(at, `manifest "questions": ${entry.questions} != actual ${ch.questions.length}`);
    }
    // The `brief` is the whiteboard state an interleaved session can't rebuild
    // for itself — the scoped requirements and the scale constants. Every
    // canonical design problem must carry one, because a mixed set can serve
    // any question of any unit cold. `gate` names the question indices whose
    // own answer IS the brief (scope, estimate), where it stays hidden until
    // the reveal; indices are positional, which the append-only content rule
    // keeps stable. See the § brief note in CLAUDE.md.
    validateBrief(t, ch, at);

    if (t === 'design-problems') {
      if (!Array.isArray(ch.diagrams) || ch.diagrams.length !== 4) {
        fail(at, `design problem needs exactly 4 architecture diagrams, got ${ch.diagrams ? ch.diagrams.length : 0}`);
      } else {
        ch.diagrams.forEach((diagram, i) => {
          if (!Number.isInteger(diagram.afterQuestion) || diagram.afterQuestion < 0 || diagram.afterQuestion >= ch.questions.length) {
            fail(`${at} diagrams[${i}]`, `afterQuestion must point to a valid question index, got ${JSON.stringify(diagram.afterQuestion)}`);
          }
        });
      }
    }

    const mcAnswers = new Set();
    let mcCount = 0;
    ch.questions.forEach((q, i) => {
      const qat = `${at} q${i}`;
      totalQ++;
      validateDiagrams(q, qat);
      if ((q.type || 'mc') === 'open') {
        totalOpen++;
        if (!q.prompt || !String(q.prompt).trim()) fail(qat, 'open: empty prompt');
        if (!Array.isArray(q.points) || q.points.length < MIN_OPEN_POINTS) fail(qat, `open: needs >= ${MIN_OPEN_POINTS} points`);
        else if (!q.points.every(p => typeof p === 'string' && p.trim())) fail(qat, 'open: empty point');
        if (!q.answer || !String(q.answer).trim()) fail(qat, 'open: empty answer');
        if (q.options) fail(qat, 'open: should not have options');
      } else {
        totalMC++; mcCount++;
        if (!q.q || !String(q.q).trim()) fail(qat, 'mc: empty stem');
        if (!Array.isArray(q.options) || q.options.length !== 4) fail(qat, `mc: needs exactly 4 options, got ${q.options ? q.options.length : 0}`);
        else {
          if (!q.options.every(o => typeof o === 'string' && o.trim())) fail(qat, 'mc: empty option');
          if (new Set(q.options.map(o => o.trim())).size !== 4) fail(qat, 'mc: options not unique');
        }
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) fail(qat, `mc: answer must be 0-3, got ${JSON.stringify(q.answer)}`);
        else mcAnswers.add(q.answer);
        if (!q.explain || !String(q.explain).trim()) fail(qat, 'mc: missing explain');
      }
    });
    // Only meaningful when a unit has enough MC to expect spread; walkthrough
    // units (design problems) intentionally carry just 2-3 MC checks.
    if (mcCount >= 4 && mcAnswers.size < 2) fail(at, 'MC correct-answer index never varies — likely an authoring bug');
  }
}

function collectPngs(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? collectPngs(path.join(dir, entry.name), relative) : (/\.png$/i.test(entry.name) ? [relative] : []);
  });
}

const actualInfographics = collectPngs(INFOGRAPHICS);
for (const relative of actualInfographics) {
  if (!expectedInfographics.has(relative)) fail('infographics', `unregistered or stale PNG ${relative}`);
}
if (actualInfographics.length !== expectedInfographics.size) {
  fail('infographics', `expected exactly ${expectedInfographics.size} PNGs, found ${actualInfographics.length}`);
}
for (const key of Object.keys(INFOGRAPHIC_SPECS)) {
  if (!registeredLessons.has(key)) fail('infographic-specs.json', `orphan spec ${key}`);
}
for (const key of Object.keys(INFOGRAPHIC_PLAN)) if (!registeredLessons.has(key)) fail('infographic-plan.json', `orphan lesson ${key}`);
for (const key of Object.keys(INFOGRAPHIC_SETS)) if (!registeredLessons.has(key)) fail('infographic-sets.json', `orphan set ${key}`);
for (const key of registeredLessons) {
  const [topic] = key.split('/');
  if (INFOGRAPHIC_TOPICS.has(topic) && !INFOGRAPHIC_PLAN[key]) fail('infographic-plan.json', `missing lesson ${key}`);
}

console.log('');
validatePlans(unitIdsByTopic, cruxUnits);
validateCatalog();

if (errors === 0) {
  const pending = totalPending ? `, ${totalPending} pending artwork` : '';
  console.log(`System Design validation OK — ${registry.topics.length} topics, ${totalQ} questions (${totalMC} MC, ${totalOpen} open), ${totalDiagrams} diagrams, ${totalInfographics} infographics${pending}, 0 errors.`);
  process.exit(0);
} else {
  console.error(`\nSystem Design validation FAILED — ${errors} error(s), ${totalQ} questions scanned.`);
  process.exit(1);
}
