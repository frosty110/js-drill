#!/usr/bin/env node
// ============================================================================
//  tools/check-sw-shell.js — offline-pack parity guard
// ============================================================================
// The service worker precaches a HAND-MAINTAINED list of app-shell assets. Add
// a script or stylesheet to index.html and forget the list, and the app boots
// fine online and breaks only for offline users — the exact failure that never
// shows up in local testing.
//
// This asserts, in both directions:
//   · every local js/ css/ ds/ asset index.html references is precached
//   · every precached path actually exists on disk
//
// Caught the share codec landing outside APP_SHELL (2026-08-02).
//
// Usage: node tools/check-sw-shell.js
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const sw = read('service-worker.js');
const block = sw.match(/const APP_SHELL = \[([\s\S]*?)\];/);
if (!block) { console.error('✗ could not find APP_SHELL in service-worker.js'); process.exit(1); }

const shell = block[1]
  .split('\n')
  .map(l => l.trim())
  .filter(l => l.startsWith("'"))
  .map(l => l.replace(/^'\.\//, '').replace(/',?$/, ''))
  .filter(Boolean);

const shellSet = new Set(shell);
let errors = 0;

// 1. Every precached path resolves.
for (const rel of shell) {
  if (rel === '' || rel === './') continue;
  if (!fs.existsSync(path.join(ROOT, rel))) {
    console.error(`  ✗ precached but missing on disk: ${rel}`);
    errors++;
  }
}

// 2. Every local asset EVERY shell page loads is precached. External CDN URLs
//    are out of scope — the SW deliberately doesn't own them.
//
//    This checked index.html alone until 2026-08-05, which is precisely why
//    system-design.html — a routed destination, the nav's Design rung, reached
//    from inside the app — sat outside the precache for its whole life. The SW
//    still runtime-cached it on first visit and (being cache-first then) served
//    that copy for the life of the CACHE_VERSION string, so returning users got
//    a System Design page frozen several releases back while index.html looked
//    current. Nothing failed; the two halves of the product just drifted.
//
//    A page belongs in this list when the app can navigate to it. diagnostic.html
//    is deliberately absent: it is standalone, reached by URL, and shares no
//    chrome — precaching it would grow the offline pack for nothing.
const PAGES = ['index.html', 'system-design.html'];

// The directories a page may load assets from. This list used to be inlined in
// the match regex as `(?:js|css|ds)/`, which meant the gate could only see
// directories someone had remembered to add to it. When the CDN dependencies
// were vendored into `vendor/`, every one of those files was invisible here —
// a page could load them and the precache could omit them and this gate stayed
// green, which is the exact bug it exists to prevent, just at a new address.
// So the list is now explicit AND the sweep below fails on any local directory
// that is not in it.
const LOCAL_ASSET_DIRS = ['js', 'css', 'ds', 'vendor'];
const assetRe = new RegExp(`(?:src|href)="((?:${LOCAL_ASSET_DIRS.join('|')})\\/[^"]+)"`, 'g');

for (const page of PAGES) {
  if (!shellSet.has(page)) {
    console.error(`  ✗ page not precached at all: ${page}`);
    errors++;
  }
  const html = read(page);
  const refs = [...html.matchAll(assetRe)].map(m => m[1]);
  for (const rel of new Set(refs)) {
    if (!shellSet.has(rel)) {
      console.error(`  ✗ loaded by ${page} but NOT precached: ${rel}`);
      errors++;
    }
  }

  // Catch a NEW local asset directory before it can slip past the list above.
  // Any relative src/href with a path segment that resolves to a real
  // directory in the repo has to be a directory this gate knows about.
  for (const m of html.matchAll(/(?:src|href)="([^"#:]+\/[^"]*)"/g)) {
    const first = m[1].split('/')[0];
    if (!first || first === '.' || first === '..') continue;
    if (LOCAL_ASSET_DIRS.includes(first)) continue;
    if (!fs.existsSync(path.join(ROOT, first))) continue;          // not a local dir
    if (!fs.statSync(path.join(ROOT, first)).isDirectory()) continue;
    // `p/` and `sd/` are generated PAGES, linked to, never loaded as assets.
    if (first === 'p' || first === 'sd') continue;
    console.error(
      `  ✗ ${page} loads from local directory "${first}/", which this gate does not check.\n` +
      `      Add it to LOCAL_ASSET_DIRS in tools/check-sw-shell.js so its files\n` +
      `      are required to be precached — otherwise they break offline silently.`);
    errors++;
  }
}

if (errors) {
  console.error(`\n✗ app-shell parity: ${errors} problem(s) — update APP_SHELL in service-worker.js (and bump CACHE_VERSION).`);
  process.exit(1);
}
console.log(`✓ app-shell parity: ${shell.length} precached assets, all present, all local assets of ${PAGES.join(' + ')} covered.`);
