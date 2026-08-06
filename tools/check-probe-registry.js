#!/usr/bin/env node
// ============================================================================
//  tools/check-probe-registry.js — a probe that isn't run isn't a probe
// ============================================================================
// tools/cdp/ held 186 .js files. `check-all.js --probes` ran 15 of them.
// Nothing on disk distinguished the two, so the directory read as a large test
// suite while being a small one — and the other 171 quietly rotted against a UI
// that kept moving underneath them.
//
// The split is now physical: durable probes live in tools/cdp/, historical ones
// in tools/cdp/archive/. This gate is what keeps that true. Every .js added
// directly to tools/cdp/ must be one of:
//
//   · registered in PROBE_SUITE in tools/check-all.js  — it runs in CI
//   · listed in MANUAL below with a reason              — a tool, not an assertion
//   · lib.js                                            — the shared harness
//
// Anything else fails, with the archive as the documented alternative. The
// point is not to forbid writing a one-off probe; it is to stop a one-off from
// being indistinguishable from a guarantee.
//
// It also checks the reverse: a probe named in CLAUDE.md or docs/ must exist
// where the prose says it does. Documentation that points at a moved file is
// how a reader concludes a guarantee exists when it doesn't.
//
// Run: node tools/check-probe-registry.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CDP = path.join(ROOT, 'tools', 'cdp');

// Files that live in tools/cdp/ without being part of the automated suite.
// Each is a hand-driven tool whose output a human reads — none of them assert
// pass/fail, so putting them in PROBE_SUITE would only produce noise.
const MANUAL = {
  'lib.js': 'the shared CDP harness every probe requires — not a probe itself',
  'template.js': 'scaffold copied when writing a new probe (.claude/skills/browser-test)',
  'check.js': 'ad-hoc: probe a DEPLOYED url for basic liveness',
  'deep-check.js': 'ad-hoc: multi-tab navigation walk that dumps screenshots',
  'mobile-l3.js': 'ad-hoc: iPhone-viewport look at the L3 editor + sticky action bar'
};

const problems = [];

// ── 1. Everything directly in tools/cdp/ is accounted for ──────────────────
const checkAll = fs.readFileSync(path.join(ROOT, 'tools', 'check-all.js'), 'utf8');
const suiteBlock = checkAll.match(/const PROBE_SUITE = \[([\s\S]*?)\];/);
if (!suiteBlock) {
  console.error('✗ could not find PROBE_SUITE in tools/check-all.js');
  process.exit(1);
}
const registered = new Set(
  [...suiteBlock[1].matchAll(/tools\/cdp\/([A-Za-z0-9_.-]+\.js)/g)].map(m => m[1])
);

const present = fs.readdirSync(CDP).filter(f => f.endsWith('.js'));
for (const f of present) {
  if (registered.has(f) || MANUAL[f]) continue;
  problems.push(
    `tools/cdp/${f} is neither registered in PROBE_SUITE nor allowlisted in MANUAL.\n` +
    `      A probe nothing runs rots silently. Either register it in\n` +
    `      tools/check-all.js, add it to MANUAL with a reason, or move it to\n` +
    `      tools/cdp/archive/ (see the README there).`);
}

// ── 2. Every registered probe actually exists ──────────────────────────────
for (const f of registered) {
  if (!fs.existsSync(path.join(CDP, f))) {
    problems.push(`PROBE_SUITE registers tools/cdp/${f}, which does not exist`);
  }
}

// ── 3. MANUAL doesn't list files that are gone ─────────────────────────────
for (const f of Object.keys(MANUAL)) {
  if (!fs.existsSync(path.join(CDP, f))) {
    problems.push(`MANUAL lists tools/cdp/${f}, which does not exist — drop the entry`);
  }
}

// ── 4. The living docs don't point at probes that moved ────────────────────
// iter-artifacts/ is deliberately excluded: it is an append-only historical
// record of past iterations, and rewriting it to track file moves would be
// falsifying the record.
//
// Fenced code blocks are skipped. They hold shell transcripts, worked examples
// and quoted historical commit messages — CLAUDE.md's commit-convention section
// quotes an iter-20 commit body verbatim, and "fixing" the probe path inside a
// quoted commit would falsify the record rather than fix a pointer. Prose and
// tables are live pointers; a transcript is a description of the past.
const DOC_GLOBS = ['CLAUDE.md', 'README.md', 'docs/', '.claude/', '.github/'];
let referenced = [];
try {
  const files = execSync(
    `grep -rl 'tools/cdp/' ${DOC_GLOBS.join(' ')} 2>/dev/null || true`,
    { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  const found = new Set();
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) continue;
    const prose = fs.readFileSync(p, 'utf8').replace(/```[\s\S]*?```/g, '');
    for (const m of prose.matchAll(/tools\/cdp\/[A-Za-z0-9_.\-\/]+\.js/g)) found.add(m[0]);
  }
  referenced = [...found];
} catch { /* nothing referenced */ }

for (const ref of referenced) {
  if (fs.existsSync(path.join(ROOT, ref))) continue;
  const base = ref.replace('tools/cdp/', '');
  const inArchive = fs.existsSync(path.join(CDP, 'archive', base));
  problems.push(
    `docs reference ${ref}, which is ${inArchive ? 'now in tools/cdp/archive/' : 'missing'}.\n` +
    `      ${inArchive
      ? 'Update the reference, or promote the probe back if the doc is describing a guarantee.'
      : 'Remove the reference or restore the file.'}`);
}

if (problems.length) {
  console.error(`\n✗ probe registry: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`   ✗ ${p}`);
  console.error('');
  process.exit(1);
}

const archived = fs.existsSync(path.join(CDP, 'archive'))
  ? fs.readdirSync(path.join(CDP, 'archive')).filter(f => f.endsWith('.js')).length : 0;
console.log(
  `✓ probe registry: ${registered.size} registered + ${Object.keys(MANUAL).length} manual ` +
  `in tools/cdp/, ${archived} archived, all doc references resolve.`);
