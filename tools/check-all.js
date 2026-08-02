#!/usr/bin/env node
// ============================================================================
//  tools/check-all.js — every standing-constraint gate, one command
// ============================================================================
// The project's invariants are documented in docs/invariants.md and enforced by
// a handful of small tools. Remembering which to run after which kind of change
// is its own failure mode, so this runs all of them, in cost order, and reports
// once.
//
//   node tools/check-all.js          verify everything (pre-commit / CI)
//   node tools/check-all.js --fix    regenerate what is generated, then verify
//
// Browser probes are deliberately NOT included — they need Chrome on :9222 and
// take minutes. Run those before shipping anything user-facing:
//   node tools/cdp/share-urls.js · node tools/cdp/home-nav.js · tools/cdp/ds-page-frame.js
// ============================================================================

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FIX = process.argv.includes('--fix');

// Ordered cheapest-first so a fast failure fails fast. `fix` is the command to
// run instead when --fix is passed (a generator rather than its --check).
const GATES = [
  { name: 'share-code codec',    cmd: ['tools/test-sharecode.js'] },
  { name: 'content-order gate',  cmd: ['tools/test-content-order.js'] },
  { name: 'offline app shell',   cmd: ['tools/check-sw-shell.js'] },
  { name: 'sync key coverage',   cmd: ['tools/check-sync-coverage.js'] },
  { name: 'content order lock',  cmd: ['tools/check-content-order.js', '--check'], fix: ['tools/check-content-order.js'] },
  { name: 'lesson exercises',    cmd: ['tools/validate-data.js'] },
  { name: 'system design',       cmd: ['tools/validate-system-design.js'] },
  { name: 'crawlable pages',     cmd: ['tools/build-share-pages.js', '--check'], fix: ['tools/build-share-pages.js'] }
];

const results = [];
let failed = 0;

for (const gate of GATES) {
  const cmd = FIX && gate.fix ? gate.fix : gate.cmd;
  const r = spawnSync(process.execPath, cmd, { cwd: ROOT, encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) failed++;
  results.push({ name: gate.name, ok, out: `${r.stdout || ''}${r.stderr || ''}`.trim() });
  // Surface a failing gate's own output immediately — its message is the point.
  if (!ok) {
    console.error(`\n━━ ${gate.name} ━━`);
    console.error(results[results.length - 1].out);
  }
}

console.log('\n━━ summary ━━');
for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}`);

if (failed) {
  console.error(`\n✗ ${failed} of ${GATES.length} gates failed. See docs/invariants.md for what each one protects.`);
  process.exit(1);
}
console.log(`\n✓ all ${GATES.length} gates pass.${FIX ? ' Generated output refreshed — commit it with your change.' : ''}`);
