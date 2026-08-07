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
    // Both quote styles — matching only `"` made a single-quoted tag free.
    [...html.matchAll(/(?:src|href)\s*=\s*["']((?:js|css|ds|vendor)\/[^"']+)["']/g)].map(m => m[1])
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

// ── The service worker's precache is a boot cost too ───────────────────────
// This gate parsed src=/href= out of HTML and nothing else, which made it blind
// to the biggest download the app can make. Vendoring Mermaid moved 3.4 MB OUT
// of system-design.html's page load and INTO APP_SHELL — so the per-page numbers
// improved by 3.5 MB while every main-app visitor started fetching 3.4 MB more,
// and this gate reported the improvement.
//
// The shell installs on first visit to index.html, so it is a real first-run
// cost and belongs under a budget of its own.
const SHELL_BUDGET_KB = 2600;
{
  const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
  const block = sw.match(/const APP_SHELL = \[([\s\S]*?)\];/);
  if (!block) {
    problems.push('could not find APP_SHELL in service-worker.js — has it been renamed?');
  } else {
    const entries = block[1].split('\n')
      .map(l => (l.match(/^\s*'([^']+)'/) || [])[1])
      .filter(Boolean);
    let total = 0;
    const files = [];
    for (const e of entries) {
      const rel = e.replace(/^\.\//, '');
      if (!rel || rel === '') continue;
      const p = path.join(ROOT, rel);
      if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) continue;
      const bytes = fs.statSync(p).size;
      total += bytes;
      files.push([rel, bytes]);
    }
    files.sort((a, b) => b[1] - a[1]);
    const kb = total / 1024;
    report.push({ page: 'service-worker APP_SHELL', kb, budget: SHELL_BUDGET_KB, files });
    if (kb > SHELL_BUDGET_KB) {
      problems.push(
        `service-worker APP_SHELL precaches ${kb.toFixed(0)} KB, over its ${SHELL_BUDGET_KB} KB budget.\n` +
        `      Every first-time visitor to index.html downloads this before the app is\n` +
        `      usable offline, whether or not they ever open the surface it belongs to.\n` +
        `      Largest: ${files.slice(0, 3).map(f => `${f[0]} ${(f[1] / 1024).toFixed(0)}KB`).join(', ')}\n` +
        `      Prefer runtime caching for anything a given page may never load.`);
    }
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
