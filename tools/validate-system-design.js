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
const fail = (where, msg) => { errors++; console.error(`  ✗ [${where}] ${msg}`); };

const INFOGRAPHIC_SPECS = readJson(path.join(SD, 'infographic-specs.json')) || {};
const INFOGRAPHIC_SETS = (readJson(path.join(SD, 'infographic-sets.json')) || {}).sets || {};
const INFOGRAPHIC_PLAN = (readJson(path.join(SD, 'infographic-plan.json')) || {}).lessons || {};
const expectedInfographics = new Set();
const registeredLessons = new Set();

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
  // Mixed model: a lesson either has an authored multi-image set (design problems,
  // plus the hand-authored pilots) or keeps its single illustrated sheet. The plan
  // records the eventual target either way, so it stays the roadmap for conversion.
  if (!set) {
    validateInfographicFile(`${topic}/${id}.png`, 1600, 2000, where);
    return;
  }
  if (!set.title || !set.summary) fail(where, 'infographic set needs title and summary');
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
    for (const field of ['kind', 'title', 'purpose', 'description']) if (!item[field] || typeof item[field] !== 'string') fail(at, `missing ${field}`);
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

  for (const entry of manifest.chapters) {
    const id = entry.id;
    const file = path.join(dir, `${id}.json`);
    if (!fs.existsSync(file)) continue;
    const ch = readJson(file);
    if (!ch) continue;
    const at = `${t}/${id}`;
    registeredLessons.add(at);

    if (ch.id !== id) fail(at, `id "${ch.id}" != manifest "${id}"`);
    const num = ch.num != null ? ch.num : ch.chapter;
    const entryNum = entry.num != null ? entry.num : entry.chapter;
    if (num !== entryNum) fail(at, `num ${num} != manifest ${entryNum}`);
    if (!ch.title) fail(at, 'missing title');
    if (!ch.summary) fail(at, 'missing summary');
    if (ch.part && validParts.size && !validParts.has(ch.part)) fail(at, `part "${ch.part}" not a manifest part`);
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
if (errors === 0) {
  console.log(`System Design validation OK — ${registry.topics.length} topics, ${totalQ} questions (${totalMC} MC, ${totalOpen} open), ${totalDiagrams} diagrams, ${totalInfographics} infographics, 0 errors.`);
  process.exit(0);
} else {
  console.error(`\nSystem Design validation FAILED — ${errors} error(s), ${totalQ} questions scanned.`);
  process.exit(1);
}
