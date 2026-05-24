#!/usr/bin/env node
// Validator — runs every lesson's L2 fill-ins (template + blanks) and L3
// canonical solution through the same runner semantics the app uses, then
// compares the captured output against expectedOutput. Also diffs the manifest
// against the on-disk layout so we don't ship a manifest pointing at missing
// files (or files not in the manifest).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');   // tools/ → project root
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

// ── Mechanics registry ────────────────────────────────────────────────────
// Optional: data/mechanics.json defines cross-cutting code idioms tagged on
// lessons. If present, every `mechanics: [...]` reference on a lesson must
// point to a real id here, or the run fails. Orphan mechanics (defined but
// never used) and untagged full lessons surface as a non-fatal warning so
// the registry can grow without blocking work.
const MECHANICS_PATH = path.join(DATA, 'mechanics.json');
let MECHANIC_IDS = null;
if (fs.existsSync(MECHANICS_PATH)) {
  const reg = JSON.parse(fs.readFileSync(MECHANICS_PATH, 'utf8'));
  MECHANIC_IDS = new Set((reg.mechanics || []).map(m => m.id));
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

// ── Banned-syntax check ───────────────────────────────────────────────────
// Per docs/canonical-style.md, a small set of JS constructs is rare-or-never
// in modern code and shouldn't take up canonical real estate. The check
// scans reference.code, every L2.exercises[*].template, and L3.canonical.
// Lessons specifically *about* a banned construct (e.g. a `var` hoisting
// lesson) go in BANNED_SYNTAX_EXEMPTIONS with a one-line reason.
const BANNED_SYNTAX_EXEMPTIONS = new Set([
  's-variables', // lesson is about let/const/var — `var` is part of the curriculum
  's-loops',     // lesson teaches while AND do-while as the two while-family forms
  's-closures',  // demonstrates the classic var-vs-let captured-binding loop bug
]);
const BANNED_PATTERNS = [
  { name: 'do...while loop',          re: /\bdo\s*\{/ },
  { name: '`with` statement',         re: /\bwith\s*\(/ },
  { name: '`var` declaration',        re: /\bvar\s+[A-Za-z_$]/ },
  { name: 'labeled break/continue',   re: /\b(?:break|continue)\s+[A-Za-z_$][\w$]*\s*;/ },
  { name: '`void` operator',          re: /\bvoid\s+[^\s;]/ },
];
function stripCommentsAndStrings(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}
function scanBanned(src) {
  const clean = stripCommentsAndStrings(src);
  const hits = [];
  for (const p of BANNED_PATTERNS) {
    if (p.re.test(clean)) hits.push(p.name);
  }
  return hits;
}

// ── L2 + L3 verification ──────────────────────────────────────────────────
// Density thresholds — PROFILE.md says ≥3 L1 questions and ≥2 L2 exercises
// per lesson so the mobile drill loop has enough surface area. Tracked here
// as a non-fatal warning so the existing backlog doesn't block work; turn
// it into a hard failure with --strict-density (e.g. in CI once cleared).
const L1_MIN = 3;
const L2_MIN = 2;
const STRICT_DENSITY = process.argv.includes('--strict-density');
const SKIP_BANNED = process.argv.includes('--skip-banned-syntax');

(async () => {
  let pass = 0, fail = 0;
  const failures = [];
  const underL1 = [];
  const underL2 = [];
  const untaggedMechanics = [];
  const usedMechanicIds = new Set();
  const bannedHits = [];
  for (const [id, info] of manifestEntries) {
    const lesson = JSON.parse(fs.readFileSync(info.file, 'utf8'));
    if (lesson.status !== 'full') continue;

    // Density check — non-fatal by default, see below.
    const l1n = lesson.L1?.questions?.length || 0;
    const l2n = lesson.L2?.exercises?.length || 0;
    if (l1n < L1_MIN) underL1.push({ id, section: info.slug, n: l1n });
    if (l2n < L2_MIN) underL2.push({ id, section: info.slug, n: l2n });

    // Banned-syntax scan — covers reference.code, every L2 template, L3 canonical.
    if (!SKIP_BANNED && !BANNED_SYNTAX_EXEMPTIONS.has(id)) {
      const sources = [];
      if (lesson.reference?.code) sources.push({ where: 'reference.code', code: lesson.reference.code });
      if (lesson.L2?.exercises) {
        lesson.L2.exercises.forEach((ex, i) => sources.push({ where: `L2#${i}.template`, code: ex.template || '' }));
      }
      if (lesson.L3?.canonical) sources.push({ where: 'L3.canonical', code: lesson.L3.canonical });
      for (const s of sources) {
        const hits = scanBanned(s.code);
        for (const name of hits) {
          bannedHits.push({ id, section: info.slug, where: s.where, name });
        }
      }
    }

    // Mechanics field — when registry is present, every referenced id must
    // exist; missing field is a non-fatal warning so tagging can roll out
    // incrementally.
    if (MECHANIC_IDS) {
      const mechs = Array.isArray(lesson.mechanics) ? lesson.mechanics : null;
      if (!mechs || mechs.length === 0) {
        untaggedMechanics.push({ id, section: info.slug });
      } else {
        for (const m of mechs) {
          if (!MECHANIC_IDS.has(m)) {
            fail++;
            failures.push(`${id} unknown mechanic id "${m}" — not in data/mechanics.json`);
          } else {
            usedMechanicIds.add(m);
          }
        }
      }
    }

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

  // Banned-syntax check — hard failure unless --skip-banned-syntax.
  if (bannedHits.length) {
    console.log('');
    console.log(`✗ Banned syntax — ${bannedHits.length} hit${bannedHits.length === 1 ? '' : 's'} across ${new Set(bannedHits.map(h => h.id)).size} lesson${new Set(bannedHits.map(h => h.id)).size === 1 ? '' : 's'} (see docs/canonical-style.md):`);
    for (const h of bannedHits.slice(0, 30)) {
      console.log(`  - ${h.section}/${h.id} :: ${h.where} — ${h.name}`);
    }
    if (bannedHits.length > 30) console.log(`  …and ${bannedHits.length - 30} more`);
    console.log('\nFix the canonical to use the allowed idiom, OR add the lesson id to BANNED_SYNTAX_EXEMPTIONS in tools/validate-data.js with a one-line reason if the lesson is genuinely about the banned construct.');
    process.exit(1);
  }

  // Density warning — never fails by default (use --strict-density to enforce).
  if (underL1.length || underL2.length) {
    console.log('');
    console.log(`⚠ Density ${STRICT_DENSITY ? 'check' : 'warning'} — PROFILE.md says ≥${L1_MIN} L1 + ≥${L2_MIN} L2 per lesson.`);
    if (underL1.length) {
      console.log(`  L1 < ${L1_MIN} questions: ${underL1.length} lesson${underL1.length === 1 ? '' : 's'}`);
      for (const o of underL1.slice(0, 5)) console.log(`    - ${o.section}/${o.id} (L1=${o.n})`);
      if (underL1.length > 5) console.log(`    …and ${underL1.length - 5} more`);
    }
    if (underL2.length) {
      console.log(`  L2 < ${L2_MIN} exercises: ${underL2.length} lesson${underL2.length === 1 ? '' : 's'}`);
      for (const o of underL2.slice(0, 5)) console.log(`    - ${o.section}/${o.id} (L2=${o.n})`);
      if (underL2.length > 5) console.log(`    …and ${underL2.length - 5} more`);
    }
    if (STRICT_DENSITY) {
      console.error('\nStrict density enforcement is on — exiting non-zero.');
      process.exit(1);
    }
  }

  // Mechanics coverage report (non-fatal). Surfaces:
  //   - lessons missing a `mechanics` field
  //   - mechanic ids defined but never referenced
  if (MECHANIC_IDS) {
    const orphans = [...MECHANIC_IDS].filter(id => !usedMechanicIds.has(id));
    if (untaggedMechanics.length || orphans.length) {
      console.log('');
      console.log('⚠ Mechanics coverage:');
      if (untaggedMechanics.length) {
        console.log(`  Lessons missing \`mechanics\` field: ${untaggedMechanics.length}`);
        for (const o of untaggedMechanics.slice(0, 5)) console.log(`    - ${o.section}/${o.id}`);
        if (untaggedMechanics.length > 5) console.log(`    …and ${untaggedMechanics.length - 5} more`);
      }
      if (orphans.length) {
        console.log(`  Mechanics defined but unused: ${orphans.length}`);
        for (const o of orphans.slice(0, 10)) console.log(`    - ${o}`);
        if (orphans.length > 10) console.log(`    …and ${orphans.length - 10} more`);
      }
    } else {
      const tagged = MECHANIC_IDS.size;
      console.log(`\n🧩 Mechanics: ${tagged} ids defined, all referenced by ≥1 lesson; all full lessons tagged.`);
    }
  }
})();
