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
// shape, and MC answer-index variety per chapter. Exits non-zero on failure.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SD = path.join(ROOT, 'data', 'system-design');

const MIN_QUESTIONS = 8;      // MC + open combined, per chapter
const MIN_TAKEAWAYS = 3;
const MIN_OPEN_POINTS = 3;

let errors = 0, totalQ = 0, totalMC = 0, totalOpen = 0;
const fail = (where, msg) => { errors++; console.error(`  ✗ [${where}] ${msg}`); };

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
    .filter(f => /^(ch|s|c)\d\d\.json$/.test(f)).map(f => f.replace(/\.json$/, ''));

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

    if (ch.id !== id) fail(at, `id "${ch.id}" != manifest "${id}"`);
    const num = ch.num != null ? ch.num : ch.chapter;
    const entryNum = entry.num != null ? entry.num : entry.chapter;
    if (num !== entryNum) fail(at, `num ${num} != manifest ${entryNum}`);
    if (!ch.title) fail(at, 'missing title');
    if (!ch.summary) fail(at, 'missing summary');
    if (ch.part && validParts.size && !validParts.has(ch.part)) fail(at, `part "${ch.part}" not a manifest part`);
    if (!Array.isArray(ch.keyTakeaways) || ch.keyTakeaways.length < MIN_TAKEAWAYS) fail(at, `keyTakeaways needs >= ${MIN_TAKEAWAYS} entries`);
    else if (!ch.keyTakeaways.every(x => typeof x === 'string' && x.trim())) fail(at, 'empty keyTakeaway');

    if (!Array.isArray(ch.questions) || ch.questions.length < MIN_QUESTIONS) {
      fail(at, `expected >= ${MIN_QUESTIONS} questions, got ${ch.questions ? ch.questions.length : 0}`); continue;
    }

    const mcAnswers = new Set();
    ch.questions.forEach((q, i) => {
      const qat = `${at} q${i}`;
      totalQ++;
      if ((q.type || 'mc') === 'open') {
        totalOpen++;
        if (!q.prompt || !String(q.prompt).trim()) fail(qat, 'open: empty prompt');
        if (!Array.isArray(q.points) || q.points.length < MIN_OPEN_POINTS) fail(qat, `open: needs >= ${MIN_OPEN_POINTS} points`);
        else if (!q.points.every(p => typeof p === 'string' && p.trim())) fail(qat, 'open: empty point');
        if (!q.answer || !String(q.answer).trim()) fail(qat, 'open: empty answer');
        if (q.options) fail(qat, 'open: should not have options');
      } else {
        totalMC++;
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
    if (mcAnswers.size && mcAnswers.size < 2) fail(at, 'MC correct-answer index never varies — likely an authoring bug');
  }
}

console.log('');
if (errors === 0) {
  console.log(`System Design validation OK — ${registry.topics.length} topics, ${totalQ} questions (${totalMC} MC, ${totalOpen} open), 0 errors.`);
  process.exit(0);
} else {
  console.error(`\nSystem Design validation FAILED — ${errors} error(s), ${totalQ} questions scanned.`);
  process.exit(1);
}
