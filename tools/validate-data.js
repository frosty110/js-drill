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
// Subsequence match — must mirror app.js's outputsMatch. Every expected line
// must appear in actual, in order; extra lines in actual are ignored (so a
// user's debug console.log doesn't break the check). Canonicals don't add
// debug logs, so this is equivalent to strict equality for the validator.
function normalizeLines(s) {
  return (s ?? '').toString().trim().replace(/\r\n/g, '\n')
    .split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.length > 0);
}
function outputsMatch(actual, expected) {
  const exp = normalizeLines(expected);
  const act = normalizeLines(actual);
  if (exp.length === 0) return act.length === 0;
  let i = 0;
  for (const line of act) {
    if (line === exp[i]) i++;
    if (i === exp.length) return true;
  }
  return false;
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

// ── Tag registry gate ─────────────────────────────────────────────────────
// data/tags.json declares faceted-filter facets. Authored facets (difficulty,
// company) are stored on manifest lesson entries under `tags`. Validate every
// authored value against the registry; derived facets (source/topic) must never
// be authored. Fail fast so a typo'd tag can't ship a dead filter chip.
const TAGS_PATH = path.join(DATA, 'tags.json');
if (fs.existsSync(TAGS_PATH)) {
  const reg = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8'));
  const facets = Array.isArray(reg.facets) ? reg.facets : [];
  const byId = new Map(facets.map(f => [f.id, f]));
  const valuesOf = (id) => new Set(((byId.get(id) || {}).values || []).map(v => v.id));
  const difficulties = valuesOf('difficulty');
  const companies = valuesOf('company');
  const tagErrors = [];
  for (const sec of manifest.sections) {
    for (const l of sec.lessons) {
      const t = l.tags;
      if (t == null) continue;
      if (typeof t !== 'object' || Array.isArray(t)) { tagErrors.push(`${l.id}: tags must be an object`); continue; }
      if ('source' in t || 'topic' in t) tagErrors.push(`${l.id}: tags.source/tags.topic are derived (use track/section), not authored`);
      if ('difficulty' in t) {
        if (typeof t.difficulty !== 'string') tagErrors.push(`${l.id}: tags.difficulty must be a string`);
        else if (!difficulties.has(t.difficulty)) tagErrors.push(`${l.id}: unknown difficulty "${t.difficulty}" (not in tags.json)`);
      }
      if ('company' in t) {
        if (!Array.isArray(t.company)) tagErrors.push(`${l.id}: tags.company must be an array`);
        else for (const c of t.company) {
          if (!companies.has(c)) tagErrors.push(`${l.id}: unknown company "${c}" (not in tags.json)`);
        }
      }
    }
  }
  if (tagErrors.length) {
    console.error('TAG REGISTRY ERRORS');
    for (const e of tagErrors) console.error('  - ' + e);
    process.exit(1);
  }
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
  't-tdz',       // lesson is about the Temporal Dead Zone — `var` hoisting is the contrast that defines TDZ
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

    // L1 structural integrity — HARD failure. The app marks the correct choice
    // via optOrder.indexOf(q.answer) (js/app/12a-l1.js); an out-of-bounds
    // `answer` resolves to -1, so NO option is ever flagged correct and the
    // question becomes silently unpassable on the highest-throughput surface.
    // Density only counts questions — this gates each question's shape.
    if (Array.isArray(lesson.L1?.questions)) {
      // NOTE: the run-summary exits on the `fail` counter, not failures.length —
      // so every push here MUST be paired with `fail++` or it's silently ignored.
      const failL1 = (msg) => { fail++; failures.push(msg); };
      lesson.L1.questions.forEach((q, qi) => {
        if (typeof q.q !== 'string' || !q.q.trim()) {
          failL1(`${id} L1#${qi} missing question text (q)`);
        }
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) {
          failL1(`${id} L1#${qi} options must be an array of 2-4 choices (got ${Array.isArray(q.options) ? q.options.length : typeof q.options})`);
          return; // answer bounds undefined without a valid options array
        }
        if (q.options.some(o => typeof o !== 'string' || !o.trim())) {
          failL1(`${id} L1#${qi} every option must be a non-empty string`);
        }
        if (new Set(q.options.map(o => String(o).trim())).size !== q.options.length) {
          failL1(`${id} L1#${qi} has duplicate options`);
        }
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) {
          failL1(`${id} L1#${qi} answer ${JSON.stringify(q.answer)} out of bounds (options has ${q.options.length})`);
        }
      });
    }

    // Banned-syntax scan — covers reference.code, every L2 template, L3 canonical.
    if (!SKIP_BANNED && !BANNED_SYNTAX_EXEMPTIONS.has(id)) {
      const sources = [];
      if (lesson.reference?.code) sources.push({ where: 'reference.code', code: lesson.reference.code });
      if (Array.isArray(lesson.reference?.alternates)) {
        lesson.reference.alternates.forEach((alt, i) => sources.push({ where: `reference.alternates#${i}.code`, code: alt.code || '' }));
      }
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
    // exist. Three states, by design:
    //   - field ABSENT          → genuine TODO; surfaced in the coverage report
    //                             so tagging can roll out incrementally.
    //   - field present as `[]`  → INTENTIONAL "no cross-cutting mechanic
    //                             applies" (foundational/conceptual lessons like
    //                             s-variables, t-tdz, big-O intuition). Not a TODO.
    //   - field present with ids → each id must resolve to the registry.
    if (MECHANIC_IDS) {
      if (!('mechanics' in lesson)) {
        untaggedMechanics.push({ id, section: info.slug });
      } else if (Array.isArray(lesson.mechanics)) {
        for (const m of lesson.mechanics) {
          if (!MECHANIC_IDS.has(m)) {
            fail++;
            failures.push(`${id} unknown mechanic id "${m}" — not in data/mechanics.json`);
          } else {
            usedMechanicIds.add(m);
          }
        }
      } else {
        fail++;
        failures.push(`${id} mechanics must be an array (use [] for "no applicable mechanic")`);
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
      // iter 41: bounds-check `criticalLines` against the canonical's line count.
      // Each entry must be a 1-indexed line number in `[1, lineCount]` that points
      // at a non-empty, non-comment-only line. Catches authoring drift if the
      // canonical is edited but criticalLines isn't updated.
      if (Array.isArray(lesson.L3.criticalLines)) {
        const lines = lesson.L3.canonical.split('\n');
        for (const lineNo of lesson.L3.criticalLines) {
          if (!Number.isInteger(lineNo) || lineNo < 1 || lineNo > lines.length) {
            fail++;
            failures.push(`${id} L3.criticalLines: ${lineNo} out of bounds (canonical has ${lines.length} lines)`);
            continue;
          }
          const line = lines[lineNo - 1].trim();
          if (!line || line.startsWith('//')) {
            fail++;
            failures.push(`${id} L3.criticalLines: line ${lineNo} is empty or comment-only ("${line}")`);
            continue;
          }
          pass++;
        }
      }

      // Alternate solutions — run each `reference.alternates[*].code` and
      // assert its output matches `L3.expectedOutput`. Alternates solve the
      // same problem with a different idiom (e.g. min-heap vs pairwise
      // divide-and-conquer for merge-k-lists), so the output contract is
      // identical to L3. Required shape per entry: { label, code }; optional:
      // when, complexity, notes[].
      if (Array.isArray(lesson.reference?.alternates)) {
        for (let ai = 0; ai < lesson.reference.alternates.length; ai++) {
          const alt = lesson.reference.alternates[ai];
          if (!alt || typeof alt.label !== 'string' || !alt.label.trim()) {
            fail++;
            failures.push(`${id} reference.alternates#${ai}: missing or empty "label"`);
            continue;
          }
          if (typeof alt.code !== 'string' || !alt.code.trim()) {
            fail++;
            failures.push(`${id} reference.alternates#${ai} ("${alt.label}"): missing or empty "code"`);
            continue;
          }
          const ar = await runCode(alt.code);
          if (ar.error) {
            fail++;
            failures.push(`${id} reference.alternates#${ai} ("${alt.label}") runtime error: ${ar.error}`);
          } else if (!outputsMatch(ar.output, lesson.L3.expectedOutput)) {
            fail++;
            failures.push(`${id} reference.alternates#${ai} ("${alt.label}") mismatch — got "${ar.output}" expected "${lesson.L3.expectedOutput}"`);
          } else {
            pass++;
          }
        }
      }
    }

    // Walkthrough — compile the trace generator (array-of-lines joined to
    // source), run on each example, assert no throw. If the example has an
    // `expected` field, also assert the final step's state.returns matches.
    // Catches: trace function compile errors, runtime errors, drift between
    // the trace and the canonical (returns-mismatch).
    if (lesson.walkthrough) {
      const w = lesson.walkthrough;
      if (!Array.isArray(w.examples) || w.examples.length === 0) {
        fail++;
        failures.push(`${id} walkthrough has no examples`);
      } else {
        const src = Array.isArray(w.trace) ? w.trace.join('\n') : String(w.trace || '');
        let fn;
        try {
          fn = new Function('input', '"use strict";\n' + src + '\nreturn trace(input);');
        } catch (e) {
          fail++;
          failures.push(`${id} walkthrough trace compile error: ${e.message}`);
          fn = null;
        }
        if (fn) {
          for (let ei = 0; ei < w.examples.length; ei++) {
            const ex = w.examples[ei];
            try {
              const steps = [...fn(ex.input)];
              if (steps.length === 0) {
                fail++;
                failures.push(`${id} walkthrough example#${ei} (${ex.label || ex.input}) yielded zero steps`);
                continue;
              }
              const last = steps[steps.length - 1];
              if (ex.expected !== undefined) {
                const got = last.state && last.state.returns;
                if (String(got) !== String(ex.expected)) {
                  fail++;
                  failures.push(`${id} walkthrough example#${ei} (${ex.label || ex.input}) returns mismatch — got ${JSON.stringify(got)}, expected ${JSON.stringify(ex.expected)}`);
                } else {
                  pass++;
                }
              } else {
                pass++;
              }
            } catch (e) {
              fail++;
              failures.push(`${id} walkthrough example#${ei} (${ex.label || ex.input}) runtime error: ${e.message}`);
            }
          }
        }
      }
    }

    // Conversation — structural check. Every section needs a title and at
    // least one body field (say | why | reveal | examples). Bare-section
    // authoring is a common subagent failure mode; this catches it.
    if (lesson.conversation) {
      const c = lesson.conversation;
      if (!Array.isArray(c.sections) || c.sections.length < 3) {
        fail++;
        failures.push(`${id} conversation needs at least 3 sections (got ${c.sections?.length || 0})`);
      } else {
        c.sections.forEach((sec, si) => {
          if (!sec.title) {
            fail++;
            failures.push(`${id} conversation section#${si} missing title`);
          }
          const hasBody = sec.say || sec.why || sec.reveal || (Array.isArray(sec.examples) && sec.examples.length);
          if (!hasBody) {
            fail++;
            failures.push(`${id} conversation section#${si} (${sec.title || '?'}) has no body — needs at least one of say|why|reveal|examples`);
          }
        });
      }
    }

    // Crux — the one key trick/insight per problem, used by the 🎯 Crux recall
    // drill (Easy MC + Hard describe). OPTIONAL field: a lesson without
    // reference.crux simply doesn't enter the deck, so this rolls out
    // incrementally. When present: crux must be a non-empty string;
    // cruxDistractors (optional) must be an array of non-empty strings, each
    // distinct from the crux (so an authored MC distractor can never equal the
    // right answer). Only meaningful on patterns/applied — where "the trick" is
    // the recall unit — but not enforced by track here (a syntax lesson that
    // authors one is harmless).
    if (lesson.reference && lesson.reference.crux !== undefined) {
      const crux = lesson.reference.crux;
      if (typeof crux !== 'string' || !crux.trim()) {
        fail++;
        failures.push(`${id} reference.crux must be a non-empty string`);
      } else if (lesson.reference.cruxDistractors !== undefined) {
        const ds = lesson.reference.cruxDistractors;
        if (!Array.isArray(ds)) {
          fail++;
          failures.push(`${id} reference.cruxDistractors must be an array of strings`);
        } else {
          ds.forEach((d, di) => {
            if (typeof d !== 'string' || !d.trim()) {
              fail++;
              failures.push(`${id} reference.cruxDistractors#${di} must be a non-empty string`);
            } else if (d.trim() === crux.trim()) {
              fail++;
              failures.push(`${id} reference.cruxDistractors#${di} is identical to the crux — distractors must be wrong answers`);
            }
          });
        }
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

  // Cram-path internal-consistency check (hard failure). For every kind:'cram'
  // path in data/paths.json, the deduped sequence of lessonIds referenced by
  // days[].blocks[].tasks[] (in first-occurrence order) must equal path.lessons[].
  // Drift means the day-by-day cram view and the 🧭 Path View filter would
  // disagree about what's in the path.
  {
    const pathsSrc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/paths.json'), 'utf8'));
    const cramPaths = Array.isArray(pathsSrc.paths) ? pathsSrc.paths.filter(p => p.kind === 'cram') : [];
    if (!cramPaths.length) {
      console.log('\n🧭 Cram-path sync: no kind:"cram" paths declared (skipping).');
    }
    for (const cram of cramPaths) {
      const appIds = Array.isArray(cram.lessons) ? cram.lessons : [];
      const fromDays = [];
      const seen = new Set();
      for (const day of (cram.days || [])) {
        for (const block of (day.blocks || [])) {
          for (const task of (block.tasks || [])) {
            if (task.lessonId && !seen.has(task.lessonId)) {
              seen.add(task.lessonId);
              fromDays.push(task.lessonId);
            }
          }
        }
      }
      const sameOrder = appIds.length === fromDays.length && appIds.every((id, i) => id === fromDays[i]);
      if (!sameOrder) {
        const inDaysNotLessons = fromDays.filter(id => !appIds.includes(id));
        const inLessonsNotDays = appIds.filter(id => !fromDays.includes(id));
        console.log(`\n✗ Cram-path drift — ${cram.id}: days[].tasks[].lessonId sequence does not match lessons[].`);
        console.log(`  days unique lessons: ${fromDays.length}, lessons[]: ${appIds.length}`);
        if (inDaysNotLessons.length) console.log(`  In days but missing from lessons[]: ${inDaysNotLessons.join(', ')}`);
        if (inLessonsNotDays.length) console.log(`  In lessons[] but missing from days: ${inLessonsNotDays.join(', ')}`);
        if (!inDaysNotLessons.length && !inLessonsNotDays.length) console.log('  Same set, different order — re-copy lessons[] in first-occurrence order from days[].');
        process.exit(1);
      }
      console.log(`\n🧭 Cram-path sync (${cram.id}): days[].tasks lessonIds match lessons[] (${appIds.length} lessons, in order).`);
    }
  }
})();
