#!/usr/bin/env node
// Validator — runs every lesson's L2 fill-ins (template + blanks) and L3
// canonical solution through the same runner semantics the app uses, then
// compares the captured output against expectedOutput. Also diffs the manifest
// against the on-disk layout so we don't ship a manifest pointing at missing
// files (or files not in the manifest).

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');

// ── Runner — must match index.html's runCode() and outputsMatch() ─────────
function formatArg(a) {
  if (typeof a === 'string') return a;
  if (typeof a === 'number' || typeof a === 'boolean') return String(a);
  if (a === null) return 'null';
  if (a === undefined) return 'undefined';
  return JSON.stringify(a);
}
async function runCode(code) {
  const lines = [];
  const fakeConsole = {
    log: (...args) => lines.push(args.map(formatArg).join(' ')),
    error: (...args) => lines.push(args.map(formatArg).join(' ')),
    warn: (...args) => lines.push(args.map(formatArg).join(' '))
  };
  try {
    const fn = new Function('console', code);
    const res = fn(fakeConsole);
    if (res && typeof res.then === 'function') await res;
    // One macrotask drain
    await new Promise(r => setTimeout(r, 0));
    return { output: lines.join('\n'), error: null };
  } catch (err) {
    return { output: lines.join('\n'), error: err.message };
  }
}
function outputsMatch(actual, expected) {
  return actual.trim() === expected.trim();
}

// ── Manifest vs disk diff ─────────────────────────────────────────────────
const manifest = JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8'));
const manifestEntries = new Map(); // id -> {section slug, file path}
for (const sec of manifest.sections) {
  for (const l of sec.lessons) {
    manifestEntries.set(l.id, {
      slug: sec.slug,
      file: path.join(DATA, sec.slug, `${l.id}.json`)
    });
  }
}
const onDisk = new Set();
for (const sec of fs.readdirSync(DATA)) {
  const p = path.join(DATA, sec);
  if (!fs.statSync(p).isDirectory()) continue;
  for (const f of fs.readdirSync(p)) {
    if (!f.endsWith('.json')) continue;
    onDisk.add(`${sec}/${f}`);
  }
}

const missingFromDisk = [];
const missingFromManifest = [];
for (const [id, info] of manifestEntries) {
  if (!fs.existsSync(info.file)) missingFromDisk.push(`${info.slug}/${id}.json`);
}
const manifestKey = (info) => `${info.slug}/${info.file.split('/').pop()}`;
const manifestKeys = new Set([...manifestEntries.values()].map(manifestKey));
for (const k of onDisk) {
  if (!manifestKeys.has(k)) missingFromManifest.push(k);
}

if (missingFromDisk.length || missingFromManifest.length) {
  console.error('MANIFEST DRIFT DETECTED');
  if (missingFromDisk.length) {
    console.error('  In manifest but no file:');
    for (const f of missingFromDisk) console.error(`    - ${f}`);
  }
  if (missingFromManifest.length) {
    console.error('  On disk but not in manifest:');
    for (const f of missingFromManifest) console.error(`    - ${f}`);
  }
  process.exit(1);
}

// ── L2 + L3 verification ──────────────────────────────────────────────────
(async () => {
  let pass = 0, fail = 0;
  const failures = [];
  for (const [id, info] of manifestEntries) {
    const lesson = JSON.parse(fs.readFileSync(info.file, 'utf8'));
    if (lesson.status !== 'full') continue;

    // L2 — splice each blank.answer into template, run, compare
    if (lesson.L2 && lesson.L2.exercises) {
      for (let i = 0; i < lesson.L2.exercises.length; i++) {
        const ex = lesson.L2.exercises[i];
        const parts = ex.template.split('___');
        let filled = parts[0];
        for (let b = 0; b < ex.blanks.length; b++) {
          filled += ex.blanks[b].answer + parts[b + 1];
        }
        const r = await runCode(filled);
        if (r.error) {
          fail++;
          failures.push(`${id} L2#${i} runtime error: ${r.error}`);
        } else if (!outputsMatch(r.output, ex.expectedOutput)) {
          fail++;
          failures.push(`${id} L2#${i} mismatch — got "${r.output}" expected "${ex.expectedOutput}"`);
        } else {
          pass++;
        }
      }
    }

    // L3 — run canonical, compare to expectedOutput
    if (lesson.L3 && lesson.L3.canonical) {
      const r = await runCode(lesson.L3.canonical);
      if (r.error) {
        fail++;
        failures.push(`${id} L3 runtime error: ${r.error}`);
      } else if (!outputsMatch(r.output, lesson.L3.expectedOutput)) {
        fail++;
        failures.push(`${id} L3 mismatch — got "${r.output}" expected "${lesson.L3.expectedOutput}"`);
      } else {
        pass++;
      }
    }
  }

  console.log(`\n${pass} passed, ${fail} failed.`);
  if (fail) {
    for (const f of failures.slice(0, 20)) console.log('  - ' + f);
    if (failures.length > 20) console.log(`  …and ${failures.length - 20} more`);
    process.exit(1);
  }
})();
