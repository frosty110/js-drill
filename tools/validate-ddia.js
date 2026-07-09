#!/usr/bin/env node
// Validator for the System Design → DDIA multiple-choice memorization set.
//
// Unlike tools/validate-data.js (which RUNS lesson code), DDIA content is
// pure conceptual MC — so this checks structural integrity instead:
//   - every chapter in the manifest has a file on disk (and vice versa)
//   - each chapter's id/chapter/part/title/summary are well-formed
//   - keyTakeaways is a non-empty string array
//   - each question has EXACTLY 4 unique non-empty options, an in-range
//     0-based `answer`, a non-empty `q`, and a non-empty `explain`
//   - the keyed correct-answer index varies across a chapter (guards against
//     an author leaving every answer at 0)
//
// Exit non-zero on any failure so it can gate commits.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DDIA = path.join(ROOT, 'data', 'system-design', 'ddia');

const VALID_PARTS = new Set([
  'Part I: Foundations of Data Systems',
  'Part II: Distributed Data',
  'Part III: Derived Data',
]);

const MIN_QUESTIONS = 10;
const MIN_TAKEAWAYS = 3;

let errors = 0;
let totalQuestions = 0;
const fail = (where, msg) => { errors++; console.error(`  ✗ [${where}] ${msg}`); };

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail(path.basename(file), `not valid JSON: ${e.message}`);
    return null;
  }
}

// ── Manifest ↔ disk parity ────────────────────────────────────────────────
const manifest = readJson(path.join(DDIA, 'manifest.json'));
if (!manifest) { console.error('\nDDIA validation FAILED (no manifest).'); process.exit(1); }

const manifestIds = manifest.chapters.map(c => c.id);
const diskFiles = fs.readdirSync(DDIA)
  .filter(f => /^ch\d\d\.json$/.test(f))
  .map(f => f.replace(/\.json$/, ''));

for (const id of manifestIds) {
  if (!diskFiles.includes(id)) fail('manifest', `chapter ${id} listed but ${id}.json missing on disk`);
}
for (const id of diskFiles) {
  if (!manifestIds.includes(id)) fail('disk', `${id}.json on disk but not in manifest`);
}

// parts[].chapters must cover every manifest chapter exactly once
const partChapters = (manifest.parts || []).flatMap(p => p.chapters);
for (const id of manifestIds) {
  if (!partChapters.includes(id)) fail('manifest', `${id} not assigned to any part`);
}

// ── Per-chapter validation ────────────────────────────────────────────────
for (const entry of manifest.chapters) {
  const id = entry.id;
  const file = path.join(DDIA, `${id}.json`);
  if (!fs.existsSync(file)) continue; // already reported above
  const ch = readJson(file);
  if (!ch) continue;

  if (ch.id !== id) fail(id, `id field "${ch.id}" != manifest id "${id}"`);
  if (ch.chapter !== entry.chapter) fail(id, `chapter ${ch.chapter} != manifest ${entry.chapter}`);
  if (!ch.title || typeof ch.title !== 'string') fail(id, 'missing title');
  if (!ch.summary || typeof ch.summary !== 'string') fail(id, 'missing summary');
  if (!VALID_PARTS.has(ch.part)) fail(id, `invalid/absent part: ${JSON.stringify(ch.part)}`);

  if (!Array.isArray(ch.keyTakeaways) || ch.keyTakeaways.length < MIN_TAKEAWAYS) {
    fail(id, `keyTakeaways must be an array of >= ${MIN_TAKEAWAYS} strings`);
  } else if (!ch.keyTakeaways.every(t => typeof t === 'string' && t.trim())) {
    fail(id, 'keyTakeaways has an empty/non-string entry');
  }

  if (!Array.isArray(ch.questions) || ch.questions.length < MIN_QUESTIONS) {
    fail(id, `expected >= ${MIN_QUESTIONS} questions, got ${ch.questions ? ch.questions.length : 0}`);
    continue;
  }

  const answerIndices = new Set();
  ch.questions.forEach((q, i) => {
    const at = `${id} q${i}`;
    if (!q.q || typeof q.q !== 'string' || !q.q.trim()) fail(at, 'empty question stem');
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      fail(at, `must have exactly 4 options, got ${q.options ? q.options.length : 0}`);
    } else {
      if (!q.options.every(o => typeof o === 'string' && o.trim())) fail(at, 'has an empty/non-string option');
      if (new Set(q.options.map(o => o.trim())).size !== 4) fail(at, 'options are not all unique');
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) {
      fail(at, `answer must be an integer 0-3, got ${JSON.stringify(q.answer)}`);
    } else {
      answerIndices.add(q.answer);
    }
    if (!q.explain || typeof q.explain !== 'string' || !q.explain.trim()) fail(at, 'missing explain');
    totalQuestions++;
  });

  if (answerIndices.size < 2) {
    fail(id, 'correct-answer index never varies (all questions key the same option) — likely an authoring bug');
  }
}

// ── Report ────────────────────────────────────────────────────────────────
console.log('');
if (errors === 0) {
  console.log(`DDIA validation OK — ${manifest.chapters.length} chapters, ${totalQuestions} questions, 0 errors.`);
  process.exit(0);
} else {
  console.error(`\nDDIA validation FAILED — ${errors} error(s), ${totalQuestions} questions scanned.`);
  process.exit(1);
}
