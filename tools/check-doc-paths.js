#!/usr/bin/env node
// ============================================================================
//  tools/check-doc-paths.js — the map may not name rooms that don't exist
// ============================================================================
// CLAUDE.md is loaded into every session, by every agent, and its file-layout
// table is the map everyone navigates the repo by. That table documented
// `app.css` (~3,955 lines) as a real file. There is no app.css — it was split
// into css/01..16-*.css, and the row survived the split. css/06-ds-nav.css's
// own header pointed readers at js/app/16-ds-nav.js, deleted in the D15 shell
// rollout.
//
// This is the failure mode the project recognises everywhere else: not a crash,
// just a confident statement that stopped being true with nothing watching.
// CLAUDE.md had accumulated eight self-corrections in its own prose ("audit
// F17", "had been wrong", "is not what ships", "measure, don't quote") — a
// document that has learned not to trust itself and now tells the reader to go
// measure instead.
//
// Prose about behaviour genuinely cannot be gated. Two things can:
//
//   1. MARKDOWN LINKS. A relative link target either resolves or it is broken.
//      No judgement required.
//   2. THE FILE-LAYOUT TABLE. Its first column is a promise that a path exists.
//      That is the row that lied about app.css.
//
// Deliberately narrow. An earlier, looser version flagged 1207 "paths" —
// `do/while`, `[product/fix]`, `passed/total` — and a gate that cries wolf is
// a gate people learn to skip. Nothing here judges whether the DESCRIPTION
// beside a path is accurate; only that the thing described is real.
//
// Run: node tools/check-doc-paths.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Docs describing the CURRENT repo. iter-artifacts/ and docs-archive/ are
// excluded on purpose: they are append-only historical records, and rewriting
// them to track later file moves would falsify the record.
//
// `.claude/skills/` is included: a skill is a living doc that tells the next
// agent which files to read, and a skill pointing at a moved file sends that
// agent somewhere that doesn't exist — the same failure as a bad row in the
// file-layout table, with a longer fuse.
const DOCS = ['CLAUDE.md', 'README.md', 'MIGRATION-NOTES.md', 'PROFILE.md'];
for (const root of ['docs', '.claude/skills']) {
  (function collect(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      // **/archives/ holds dated snapshots of past evaluation runs. They link
      // to each other and to files as they were at the time; "fixing" them
      // would rewrite history rather than fix a doc.
      if (e.isDirectory()) { if (e.name !== 'archives') collect(p); }
      else if (e.name.endsWith('.md')) DOCS.push(path.relative(ROOT, p));
    }
  })(path.join(ROOT, root));
}

const FILE_EXT = /\.(js|css|json|md|html|py|sh|yml|xml|webmanifest|svg|png|sql|txt)$/;

const problems = [];
let links = 0, rows = 0;

// A target that points outside the repo, at a URL, or at an anchor is not ours.
const external = t =>
  !t || /^(https?:|mailto:|#|\/\/)/.test(t) || t.startsWith('/');

function resolves(rel) {
  const clean = rel.replace(/[#?].*$/, '').replace(/\/$/, '');
  if (!clean) return true;
  return fs.existsSync(path.join(ROOT, clean));
}

for (const doc of DOCS) {
  const abs = path.join(ROOT, doc);
  if (!fs.existsSync(abs)) continue;
  const src = fs.readFileSync(abs, 'utf8');
  const dir = path.dirname(doc);

  // ── 1. Markdown links ────────────────────────────────────────────────────
  for (const m of src.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (external(target)) continue;
    links++;
    // Link targets are relative to the doc that contains them.
    const rel = path.normalize(path.join(dir, target));
    if (resolves(rel)) continue;
    problems.push({ doc, kind: 'link', token: target });
  }

  // ── 2. The file-layout table's first column ──────────────────────────────
  // Rows look like:  | `path/to/thing` | description |
  // Only rows whose first cell is a single backticked token are treated as a
  // path claim — a cell of prose is prose.
  for (const line of src.split('\n')) {
    const m = line.match(/^\|\s*`([^`|]+)`\s*\|/);
    if (!m) continue;
    const token = m[1].trim();
    // Patterns and placeholders describe a SHAPE, not one file. `js/app/*.js`,
    // `css/00..16-*.css`, `data/<slug>/<id>.json` are all legitimate rows.
    if (/[<>*?]|\.\./.test(token)) continue;
    if (external(token)) continue;
    // Plenty of tables key their first column on an IDENTIFIER rather than a
    // path — function names in docs/tool-evaluations, CSS classes in
    // conversation-walkthrough, single share-code characters in share-urls.
    // A path claim has a directory separator or a file extension; anything
    // else is a name, and this gate has no opinion about names.
    if (/\s/.test(token)) continue;
    const isPathClaim = token.includes('/') || FILE_EXT.test(token);
    if (!isPathClaim) continue;
    rows++;
    if (resolves(token)) continue;
    problems.push({ doc, kind: 'layout-table row', token });
  }
}

if (problems.length) {
  console.error(`\n✗ documented paths: ${problems.length} reference(s) that do not exist\n`);
  const byDoc = new Map();
  for (const p of problems) {
    if (!byDoc.has(p.doc)) byDoc.set(p.doc, []);
    byDoc.get(p.doc).push(p);
  }
  for (const [doc, list] of byDoc) {
    console.error(`   ${doc}`);
    for (const p of list) console.error(`     ✗ ${p.token}   (${p.kind})`);
  }
  console.error('\n   Either the file moved and the doc needs updating, or the doc');
  console.error('   describes something that was never built. Readers — including');
  console.error('   every agent that loads CLAUDE.md — navigate by these names.\n');
  process.exit(1);
}

console.log(
  `✓ documented paths: ${links} markdown link(s) + ${rows} file-layout row(s) ` +
  `across ${DOCS.length} docs all resolve.`);
