#!/usr/bin/env node
// ============================================================================
//  tools/check-boot-weight.js — a budget for the thing the phone downloads
// ============================================================================
// PROFILE.md's one load-bearing fact is that ~80% of study happens on a phone.
// Nothing in the repo measured what a phone actually has to fetch before the
// app is usable, so the boot path could only ever grow: every slice added, every
// stylesheet appended, every library pulled in was individually reasonable and
// collectively unbudgeted.
//
// It went the wrong way for a long time. Until 2026-08-06 the pages also pulled
// the Tailwind COMPILER (~400 KB) from a CDN to generate the same 119 utility
// classes in every visitor's browser on every load. Removing it was worth more
// than any amount of code golf — and this gate exists so that win, and the next
// one, cannot be quietly given back.
//
// This is a BUDGET, not a target. It is set with real headroom above today's
// figure; the point is to make a large regression a conversation rather than an
// accident. If you legitimately need more, raise the number in the same commit
// that spends it, so the diff records the decision.
//
// Counts uncompressed bytes of same-origin assets the page loads eagerly. Pages
// are served gzipped, so the wire cost is roughly a third of this — the ratio is
// stable enough that budgeting the raw number is the simpler honest measure.
//
// Run: node tools/check-boot-weight.js [--report]
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Per page: the ceiling in KB, and why it is where it is.
const BUDGETS = {
  'index.html': {
    kb: 2300,
    note: 'the drill app: 40 js/app slices + 17 stylesheets + CodeMirror + Supabase'
  },
  'system-design.html': {
    kb: 900,
    note: 'the concept drill. Was 4073 KB until Mermaid (3.5 MB) stopped being a ' +
          '<script> in the head and became a first-diagram-render fetch — keep it that way'
  },
  'diagnostic.html': {
    kb: 600,
    note: 'standalone 43-question page; shares only storage + sync'
  }
};

const problems = [];
const report = [];

for (const [page, budget] of Object.entries(BUDGETS)) {
  const abs = path.join(ROOT, page);
  if (!fs.existsSync(abs)) continue;
  // Strip comments: the pages document the CDN assets they no longer load, and
  // a URL inside a comment is not a byte anyone downloads.
  const html = fs.readFileSync(abs, 'utf8').replace(/<!--[\s\S]*?-->/g, '');

  const refs = [...new Set(
    [...html.matchAll(/(?:src|href)="((?:js|css|ds|vendor)\/[^"]+)"/g)].map(m => m[1])
  )];

  let total = fs.statSync(abs).size;
  const files = [[page, fs.statSync(abs).size]];
  for (const rel of refs) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;      // check-sw-shell.js owns missing files
    const bytes = fs.statSync(p).size;
    total += bytes;
    files.push([rel, bytes]);
  }

  const kb = total / 1024;
  files.sort((a, b) => b[1] - a[1]);
  report.push({ page, kb, budget: budget.kb, files });

  if (kb > budget.kb) {
    problems.push(
      `${page} boots ${kb.toFixed(0)} KB, over its ${budget.kb} KB budget by ${(kb - budget.kb).toFixed(0)} KB.\n` +
      `      (${budget.note})\n` +
      `      Largest: ${files.slice(0, 3).map(f => `${f[0]} ${(f[1] / 1024).toFixed(0)}KB`).join(', ')}\n` +
      `      Either trim it, load it lazily, or raise the budget in\n` +
      `      tools/check-boot-weight.js in the same commit — so the diff says\n` +
      `      someone chose to spend it.`);
  }
}

if (process.argv.includes('--report')) {
  for (const r of report) {
    console.log(`\n${r.page} — ${r.kb.toFixed(1)} KB of ${r.budget} KB budget ` +
      `(${(100 * r.kb / r.budget).toFixed(0)}%), ${r.files.length} files`);
    for (const [f, b] of r.files.slice(0, 10)) {
      console.log(`  ${(b / 1024).toFixed(1).padStart(8)} KB  ${f}`);
    }
  }
  console.log('');
}

if (problems.length) {
  console.error(`\n✗ boot weight: ${problems.length} page(s) over budget\n`);
  for (const p of problems) console.error(`   ✗ ${p}`);
  console.error('');
  process.exit(1);
}

console.log('✓ boot weight: ' + report
  .map(r => `${r.page} ${r.kb.toFixed(0)}/${r.budget} KB`).join(' · '));
