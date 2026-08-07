#!/usr/bin/env node
// ============================================================================
//  tools/check-storage-callsites.js — one door to localStorage
// ============================================================================
// Invariant 5 says js/storage.js owns localStorage I/O and everything else goes
// through `window.DrillStorage`. There WAS a gate near this
// (tools/check-sync-coverage.js), but it checks that every persisted FIELD has
// a sync policy — it says nothing about who does the reading and writing. So
// two call sites had quietly grown their own raw access, and both of them were
// wrong in the specific way the abstraction exists to prevent:
//
//   js/app/02-util-metrics.js   read jsdrill.diagnostic.v1 directly, skipping
//                               the __v validation loadDiagnostic performs — an
//                               unsupported blob came back looking valid.
//   js/app/14g-plan-modals.js   wrote the progress blob with a raw setItem, so
//                               no storage-written event fired and the restored
//                               data never synced. The comment directly above
//                               it described that exact bug as already fixed.
//
// Both were fallbacks for "DrillStorage missing", a state that cannot happen
// (index.html loads js/storage.js before every slice, and the service worker
// precaches it) and whose handling was worse than failing.
//
// So: raw localStorage is allowed in js/storage.js, which implements it, and
// nowhere else.
//
// Run: node tools/check-storage-callsites.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// The only file allowed to touch the API directly — it IS the abstraction.
const OWNER = 'js/storage.js';

// Files that legitimately reference localStorage without being the owner:
// they detect availability or clear everything, and route real I/O elsewhere.
// Empty on purpose. js/sync.js was listed here once, but it has no raw
// localStorage calls at all — a dead escape hatch is an invitation to use it.
// Add an entry only with a reason that survives being read out loud.
const ALLOWED = {};

const problems = [];
// Everything that SHIPS. This walked only `js/` at first, and then printed
// "js/storage.js is the only direct localStorage consumer" — a claim it had not
// checked. diagnostic.html, one of the three shipped pages, held five raw calls
// including `localStorage.setItem('jsdrill.progress.v1', …)`: character for
// character the bug in this file's header, sitting in the part the gate could
// not see. A gate that asserts a repo-wide invariant has to read the repo.
const files = [];
(function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'vendor', 'archive'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(path.join(ROOT, 'js'));
(function walkDs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkDs(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(path.join(ROOT, 'ds'));
// Inline <script> in the pages counts too — that is where the violation was.
for (const page of ['index.html', 'system-design.html', 'diagnostic.html']) {
  const p = path.join(ROOT, page);
  if (fs.existsSync(p)) files.push(p);
}

// The mutating + reading calls. `localStorage.length`, `key()` and feature
// detection (`typeof localStorage`) are not I/O and are not the concern here.
const CALL = /\blocalStorage\s*\.\s*(getItem|setItem|removeItem|clear)\s*\(/g;

for (const abs of files) {
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  if (rel === OWNER) continue;
  const src = fs.readFileSync(abs, 'utf8');
  // Strip comments so prose describing the rule doesn't trip it.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const hits = [...code.matchAll(CALL)];
  if (!hits.length) continue;
  if (ALLOWED[rel]) continue;

  // Report with line numbers from the ORIGINAL source so the message is useful.
  const lines = src.split('\n');
  const at = [];
  lines.forEach((l, i) => {
    if (/\blocalStorage\s*\.\s*(getItem|setItem|removeItem|clear)\s*\(/.test(l) &&
        !/^\s*(\/\/|\*)/.test(l)) at.push(i + 1);
  });
  problems.push(
    `${rel}${at.length ? ':' + at.join(',') : ''} calls localStorage directly.\n` +
    `      Route it through window.DrillStorage (invariant 5). If DrillStorage\n` +
    `      is genuinely unavailable, fail visibly — do not fall back to raw\n` +
    `      access, which skips version validation on read and skips the\n` +
    `      storage-written event (and therefore sync) on write.`);
}

if (problems.length) {
  console.error(`\n✗ storage call sites: ${problems.length} violation(s) of invariant 5\n`);
  for (const p of problems) console.error(`   ✗ ${p}`);
  console.error('');
  process.exit(1);
}
console.log(`✓ storage call sites: ${OWNER} is the only direct localStorage consumer (${files.length} files scanned).`);
