#!/usr/bin/env node
// ============================================================================
//  tools/check-content-order.js — the content-ordering lock
// ============================================================================
// Share codes are POSITIONAL (docs/share-urls.md): character N of a code is
// question N of a lesson, and the letter is the option's authored index. That
// makes authored order a published contract, not an implementation detail —
// every share URL ever pasted into a chat window decodes against it.
//
// Nothing in the schema stops an editor from swapping two questions or
// reordering options to "put the best distractor last". Both silently
// repoint every code ever generated for that lesson at the wrong question,
// and the failure is invisible: the page still renders, the code still
// decodes, the answers are just wrong. This gate makes that class of change
// impossible to land by accident.
//
// WHAT IS ALLOWED
//   append      a new question / option at the END        → lock updates
//   edit        reword a question or option IN PLACE      → lock updates
//
// WHAT FAILS
//   reorder     the same items in a different order       → codes repoint
//   remove      a question or option disappears           → codes overrun
//   >8 options  beyond the share alphabet (A–H)           → silently unencodable
//
// MODES
//   (default)   verify, then absorb allowed changes into the lock
//   --check     verify only; also fails if the lock is stale (CI / pre-commit)
//   --accept    re-baseline deliberately, invalidating existing share codes
//
// Known limit: a swap that ALSO rewords both items reads as two edits. Text
// edits are indistinguishable from swap-plus-edit by content alone, and the
// alternative — stable authored ids on every question — is a schema change
// this project has so far not needed. Reordering without rewording, which is
// what actually happens by accident, is caught.
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const SD = path.join(DATA, 'system-design');
const LOCK = path.join(DATA, 'content-order.lock.json');

const DrillShare = require(path.join(ROOT, 'js', 'sharecode.js'));

const CHECK = process.argv.includes('--check');
const ACCEPT = process.argv.includes('--accept');

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const fp = s => crypto.createHash('sha1').update(String(s == null ? '' : s).replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 8);

// ── Build the current fingerprint of every ordered surface ──────────────────

function currentSnapshot() {
  const snap = { lessons: {}, systemDesign: {} };

  const manifest = readJson(path.join(DATA, 'manifest.json'));
  for (const section of manifest.sections) {
    for (const l of section.lessons) {
      if (l.status !== 'full') continue;
      const file = path.join(DATA, section.slug, `${l.id}.json`);
      if (!fs.existsSync(file)) continue;
      const c = readJson(file);
      snap.lessons[l.id] = {
        L1: ((c.L1 && c.L1.questions) || []).map(q => ({ q: fp(q.q), o: (q.options || []).map(fp) })),
        L2: ((c.L2 && c.L2.exercises) || []).map(ex => ({ q: fp(ex.prompt || ex.template) })),
        L3: c.L3 && c.L3.canonical ? 1 : 0
      };
    }
  }

  for (const t of readJson(path.join(SD, 'topics.json')).topics) {
    const meta = readJson(path.join(SD, t.id, 'manifest.json'));
    for (const ch of meta.chapters) {
      const file = path.join(SD, t.id, `${ch.id}.json`);
      if (!fs.existsSync(file)) continue;
      snap.systemDesign[`${t.id}/${ch.id}`] = (readJson(file).questions || [])
        .map(q => ({ q: fp(q.q || q.prompt), o: (q.options || []).map(fp) }));
    }
  }

  return snap;
}

// ── Compare one ordered list against its locked form ────────────────────────
// Returns { violations: [...], changes: [...] }. A violation fails the build;
// a change is an allowed append/edit that the lock absorbs.

function diffList(oldList, newList, label) {
  const violations = [];
  const changes = [];
  const oldHashes = oldList.map(x => (typeof x === 'string' ? x : x.q));
  const newHashes = newList.map(x => (typeof x === 'string' ? x : x.q));
  const oldAt = new Map(); oldHashes.forEach((h, i) => { if (!oldAt.has(h)) oldAt.set(h, i); });
  const newAt = new Map(); newHashes.forEach((h, i) => { if (!newAt.has(h)) newAt.set(h, i); });

  if (newHashes.length < oldHashes.length) {
    violations.push(`${label}: ${oldHashes.length - newHashes.length} item(s) REMOVED (was ${oldHashes.length}, now ${newHashes.length}) — every share code past position ${newHashes.length} now overruns the content`);
  }

  const shared = Math.min(oldHashes.length, newHashes.length);
  for (let i = 0; i < shared; i++) {
    if (oldHashes[i] === newHashes[i]) continue;
    const movedTo = newAt.get(oldHashes[i]);
    const cameFrom = oldAt.get(newHashes[i]);
    if (movedTo != null) {
      violations.push(`${label}: position ${i + 1} REORDERED — the item locked at ${i + 1} is now at ${movedTo + 1}`);
    } else if (cameFrom != null) {
      violations.push(`${label}: position ${i + 1} REORDERED — it now holds the item locked at position ${cameFrom + 1}`);
    } else {
      changes.push(`${label}: position ${i + 1} reworded (identity kept)`);
    }
  }

  if (newHashes.length > oldHashes.length) {
    changes.push(`${label}: ${newHashes.length - oldHashes.length} item(s) appended`);
  }
  return { violations, changes };
}

function diffQuestionList(oldQs, newQs, label) {
  const out = diffList(oldQs || [], newQs || [], label);
  // Options are positional too — 'B' in a code means options[1], always.
  const shared = Math.min((oldQs || []).length, (newQs || []).length);
  for (let i = 0; i < shared; i++) {
    const o = (oldQs[i] && oldQs[i].o) || [];
    const n = (newQs[i] && newQs[i].o) || [];
    if (!o.length && !n.length) continue;
    const sub = diffList(o, n, `${label} Q${i + 1} options`);
    out.violations.push(...sub.violations);
    out.changes.push(...sub.changes);
  }
  return out;
}

// ── Run ─────────────────────────────────────────────────────────────────────

function main() {
  const snap = currentSnapshot();

  // The share alphabet caps multiple choice at 8 options. Beyond that a pick
  // encodes as '-' (unattempted) — a silent wrong answer, not an error.
  const overCap = [];
  for (const [id, l] of Object.entries(snap.lessons)) {
    l.L1.forEach((q, i) => { if (q.o.length > DrillShare.MC_MAX_OPTIONS) overCap.push(`${id} L1 Q${i + 1}: ${q.o.length} options`); });
  }
  for (const [key, qs] of Object.entries(snap.systemDesign)) {
    qs.forEach((q, i) => { if (q.o.length > DrillShare.MC_MAX_OPTIONS) overCap.push(`${key} Q${i + 1}: ${q.o.length} options`); });
  }

  if (!fs.existsSync(LOCK) || ACCEPT) {
    if (overCap.length) { reportCap(overCap); process.exit(1); }
    if (ACCEPT && fs.existsSync(LOCK)) {
      console.log('⚠ --accept: re-baselining the content-order lock.');
      console.log('  Every share code generated before this point may now decode against the wrong');
      console.log('  question. Only do this when that is understood and intended.\n');
    }
    writeLock(snap);
    console.log(`✓ content-order lock written — ${Object.keys(snap.lessons).length} lessons, ${Object.keys(snap.systemDesign).length} system-design units.`);
    return;
  }

  const lock = readJson(LOCK);
  const violations = [];
  const changes = [];

  for (const [id, cur] of Object.entries(snap.lessons)) {
    const prev = lock.lessons[id];
    if (!prev) { changes.push(`${id}: new lesson`); continue; }
    for (const level of ['L1', 'L2']) {
      const d = diffQuestionList(prev[level], cur[level], `${id} ${level}`);
      violations.push(...d.violations);
      changes.push(...d.changes);
    }
    if (prev.L3 === 1 && cur.L3 === 0) violations.push(`${id}: the L3 drill was REMOVED — it is the third segment of every code for this lesson`);
  }
  for (const id of Object.keys(lock.lessons)) {
    if (!snap.lessons[id]) violations.push(`${id}: lesson REMOVED or demoted from status:"full" — every share link for it now 404s`);
  }

  for (const [key, cur] of Object.entries(snap.systemDesign)) {
    const prev = lock.systemDesign[key];
    if (!prev) { changes.push(`${key}: new unit`); continue; }
    const d = diffQuestionList(prev, cur, key);
    violations.push(...d.violations);
    changes.push(...d.changes);
  }
  for (const key of Object.keys(lock.systemDesign)) {
    if (!snap.systemDesign[key]) violations.push(`${key}: system-design unit REMOVED — every share link for it now 404s`);
  }

  if (overCap.length) { reportCap(overCap); process.exit(1); }

  if (violations.length) {
    console.error(`✗ content-order: ${violations.length} change(s) would break existing share codes\n`);
    for (const v of violations.slice(0, 40)) console.error(`  · ${v}`);
    if (violations.length > 40) console.error(`  …and ${violations.length - 40} more`);
    console.error(`
Share codes are positional — character N is question N, and the letter is the
option's authored index (docs/share-urls.md). Reordering or removing content
repoints every URL already shared for it, and nothing about the result looks
broken; it is just wrong.

  · To add a question or option:  APPEND it. Position is identity.
  · To improve a question:        reword it in place. That is allowed.
  · To retire a question:         leave it and mark it, or accept the break below.

If the change is genuinely intended and the broken codes are acceptable:

  node tools/check-content-order.js --accept
`);
    process.exit(1);
  }

  if (CHECK) {
    if (changes.length) {
      console.error(`✗ content-order: the lock is stale — ${changes.length} allowed change(s) not recorded.\n`);
      for (const c of changes.slice(0, 20)) console.error(`  · ${c}`);
      if (changes.length > 20) console.error(`  …and ${changes.length - 20} more`);
      console.error('\nRun: node tools/check-content-order.js');
      process.exit(1);
    }
    console.log(`✓ content-order: no reorders or removals; lock current (${Object.keys(snap.lessons).length} lessons, ${Object.keys(snap.systemDesign).length} units).`);
    return;
  }

  if (changes.length) {
    console.log(`✓ content-order: ${changes.length} allowed change(s) absorbed into the lock:`);
    for (const c of changes.slice(0, 20)) console.log(`  · ${c}`);
    if (changes.length > 20) console.log(`  …and ${changes.length - 20} more`);
    writeLock(snap);
    console.log('\n  Lock updated — commit data/content-order.lock.json with your change.');
    return;
  }
  console.log(`✓ content-order: unchanged (${Object.keys(snap.lessons).length} lessons, ${Object.keys(snap.systemDesign).length} units).`);
}

function reportCap(overCap) {
  console.error(`✗ content-order: ${overCap.length} question(s) exceed the share alphabet (max ${DrillShare.MC_MAX_OPTIONS} options)\n`);
  for (const c of overCap) console.error(`  · ${c}`);
  console.error(`
A pick beyond option ${DrillShare.MC_UPPER[DrillShare.MC_MAX_OPTIONS - 1]} has no character in the code and encodes as '-'
(unattempted) — a silent wrong answer rather than an error. Split the question,
or raise the ceiling in js/sharecode.js (which requires re-checking that the new
letters do not collide with Y / p / n).`);
}

// One line per lesson keeps `git diff` at exactly the granularity that matters:
// a changed lesson is one changed line, and the gate's message names it.
function writeLock(snap) {
  const lines = [];
  lines.push('{');
  lines.push('  "_note": "Generated by tools/check-content-order.js. Locks the AUTHORED ORDER of every question and option, because share codes are positional (docs/share-urls.md). Do not hand-edit.",');
  lines.push(`  "_version": 1,`);
  lines.push('  "lessons": {');
  const lessonIds = Object.keys(snap.lessons).sort();
  lessonIds.forEach((id, i) => {
    lines.push(`    ${JSON.stringify(id)}: ${JSON.stringify(snap.lessons[id])}${i === lessonIds.length - 1 ? '' : ','}`);
  });
  lines.push('  },');
  lines.push('  "systemDesign": {');
  const sdKeys = Object.keys(snap.systemDesign).sort();
  sdKeys.forEach((k, i) => {
    lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(snap.systemDesign[k])}${i === sdKeys.length - 1 ? '' : ','}`);
  });
  lines.push('  }');
  lines.push('}');
  fs.writeFileSync(LOCK, lines.join('\n') + '\n');
}

// The diff logic is the load-bearing part — a gate whose comparison quietly
// stops working is worse than no gate. Exported for tools/test-content-order.js;
// main() runs only when invoked directly.
module.exports = { diffList, diffQuestionList, fp, currentSnapshot };

if (require.main === module) main();
