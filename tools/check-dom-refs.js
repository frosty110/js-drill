#!/usr/bin/env node
// ============================================================================
//  tools/check-dom-refs.js — no code reaches for an element nothing creates
// ============================================================================
// Written because this exact failure happened twice while removing the old
// navigation, both times silently:
//
//   · The System Design wordmark and Stats listeners were lost inside a splice.
//     Nothing threw. The buttons simply stopped doing anything, and only one
//     probe that happens to click the wordmark noticed.
//   · Deleting the topbar menubar left four files calling getElementById on
//     ids that no longer existed. All were null-guarded, so the app stayed
//     green while the code underneath was dead.
//
// Both directions are bugs and neither is visible at runtime:
//
//   DEAD REFERENCE   the JS asks for an id nothing defines → the feature is
//                    silently gone, or one un-guarded call away from throwing.
//   (the guard is what makes this invisible, so a gate is the only way to see it)
//
// An id "exists" if any page's markup declares it, any JS template string
// writes it, any code assigns `.id = '…'`, or a generated page under p//sd/
// carries it (js/share-page.js drives those). That is deliberately generous —
// the point is to catch ids nothing anywhere creates, not to police how they
// are created.
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const fail = [];
let checked = 0;

const SKIP_DIR = /node_modules|vendor|\.git|docs-archive|iter-artifacts/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.test(rel)) walk(rel, out); }
    else if (/\.(js|html)$/.test(e.name)) out.push(rel);
  }
  return out;
}

// Sources that DEFINE ids: every page, every script, and a sample of the
// generated static pages (they are 412 identical-shaped files; two is enough to
// know the shape, and reading all of them would dominate the gate's runtime).
const scripts = ['js', 'ds'].flatMap(d => walk(d));
const pages = ['index.html', 'system-design.html', 'diagnostic.html'];
const generated = ['p/two-sum/index.html', 'sd/ddia/ch01/index.html']
  .filter(f => fs.existsSync(path.join(ROOT, f)));

const defined = new Set();
for (const f of [...scripts, ...pages, ...generated]) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of src.matchAll(/id=\\?["']([\w-]+)\\?["']/g)) defined.add(m[1]);
  for (const m of src.matchAll(/\.id\s*=\s*['"]([\w-]+)['"]/g)) defined.add(m[1]);
  // `id="${...}"` — a templated id can't be checked, but its PREFIX tells us
  // the family is generated, so don't flag siblings of it either.
  for (const m of src.matchAll(/id="([\w-]*)\$\{/g)) if (m[1]) defined.add(m[1] + '*');
}
const prefixes = [...defined].filter(d => d.endsWith('*')).map(d => d.slice(0, -1));
const known = id => defined.has(id) || prefixes.some(p => p && id.startsWith(p));

for (const f of scripts) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of src.matchAll(/getElementById\(\s*['"]([\w-]+)['"]\s*\)/g)) {
    checked++;
    if (!known(m[1])) {
      fail.push(`${f}: getElementById('${m[1]}') — nothing in the project creates that id. Either the element was removed (delete this code) or it was renamed (update it).`);
    }
  }
}

if (fail.length) {
  console.error(`✗ dead DOM references — ${fail.length} of ${checked} checks failed:\n`);
  for (const f of [...new Set(fail)]) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`✓ no dead DOM references (${checked} getElementById call sites resolve to an id something creates)`);
