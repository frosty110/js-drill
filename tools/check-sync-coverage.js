#!/usr/bin/env node
// Registry-parity guard for the sync merge contract (audit P1-2).
//
// The recurring bug class: a new state field lands in saveProgress()
// (js/app/04-progress-sr.js) but nobody decides how it MERGES across devices
// in js/sync.js — so it silently rides the carry-over base (prefer-local) and
// never converges (pre-edc806b it was outright dropped). This script turns
// that omission into a hard failure:
//
//   every key written by saveProgress() must appear in exactly one of
//   js/sync.js's three registries:
//     - EXPLICIT_MERGE_KEYS  (named merge block in mergeProgress)
//     - ADDITIVE_STAT_KEYS   (mergeAdditive — MAX counters / OR booleans / …)
//     - PREFER_LOCAL_KEYS    (documented "device state, never converges" list)
//
// Also flags stale registry entries that saveProgress no longer writes
// (warning only — a field can be registry-listed ahead of shipping).
//
// Run: node tools/check-sync-coverage.js   (exit 1 on any uncovered key)

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROGRESS_SRC = fs.readFileSync(path.join(ROOT, 'js/app/04-progress-sr.js'), 'utf8');
const SYNC_SRC = fs.readFileSync(path.join(ROOT, 'js/sync.js'), 'utf8');

// ── Extract the keys of the saveAppProgress({ ... }) literal ────────────────
function extractSaveProgressKeys(src) {
  const start = src.indexOf('window.DrillStorage.saveAppProgress({');
  if (start === -1) throw new Error('saveAppProgress call not found in 04-progress-sr.js');
  const open = src.indexOf('{', start + 'window.DrillStorage.saveAppProgress'.length);
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error('unbalanced saveAppProgress literal');
  const body = src.slice(open + 1, end);
  const keys = [];
  // Top-level keys only: lines shaped `    key: <expr>,` at the literal's own
  // indent (nested object literals would be deeper / not `identifier:` lines).
  let d = 0;
  for (const line of body.split('\n')) {
    const m = d === 0 && line.match(/^\s*([A-Za-z_$][\w$]*)\s*:/);
    if (m) keys.push(m[1]);
    for (const ch of line) {
      if (ch === '{' || ch === '[' || ch === '(') d++;
      else if (ch === '}' || ch === ']' || ch === ')') d--;
    }
  }
  return keys;
}

// ── Extract a const NAME = [ 'a', 'b', … ] array from sync.js ───────────────
function extractRegistry(src, name) {
  const m = src.match(new RegExp('const\\s+' + name + '\\s*=\\s*\\[([^\\]]*)\\]'));
  if (!m) throw new Error(name + ' not found in js/sync.js');
  return Array.from(m[1].matchAll(/'([^']+)'/g), x => x[1]);
}

const saved = extractSaveProgressKeys(PROGRESS_SRC);
const explicit = extractRegistry(SYNC_SRC, 'EXPLICIT_MERGE_KEYS');
const additive = extractRegistry(SYNC_SRC, 'ADDITIVE_STAT_KEYS');
const preferLocal = extractRegistry(SYNC_SRC, 'PREFER_LOCAL_KEYS');

const covered = new Set([...explicit, ...additive, ...preferLocal]);

let fail = false;

// Sanity: extraction should find a realistic number of keys.
if (saved.length < 30) {
  console.error(`FAIL: only ${saved.length} saveProgress keys extracted — extraction regex likely broke.`);
  fail = true;
}

// Duplicate membership (a key in two registries = ambiguous policy).
const seen = new Map();
for (const [reg, keys] of [['EXPLICIT_MERGE_KEYS', explicit], ['ADDITIVE_STAT_KEYS', additive], ['PREFER_LOCAL_KEYS', preferLocal]]) {
  for (const k of keys) {
    if (seen.has(k)) { console.error(`FAIL: '${k}' appears in both ${seen.get(k)} and ${reg}`); fail = true; }
    seen.set(k, reg);
  }
}

const missing = saved.filter(k => !covered.has(k));
if (missing.length) {
  fail = true;
  console.error('FAIL: saveProgress writes these keys but js/sync.js has NO merge policy for them.');
  console.error('Add each to EXPLICIT_MERGE_KEYS (with a merge block), ADDITIVE_STAT_KEYS, or PREFER_LOCAL_KEYS:');
  for (const k of missing) console.error('  - ' + k);
}

const savedSet = new Set(saved);
const stale = [...covered].filter(k => !savedSet.has(k));
if (stale.length) {
  console.warn('warn: registry keys not (or no longer) written by saveProgress: ' + stale.join(', '));
}

if (!fail) {
  console.log(`OK: ${saved.length} saveProgress keys all covered ` +
    `(${explicit.length} explicit, ${additive.length} additive, ${preferLocal.length} prefer-local).`);
}
process.exit(fail ? 1 : 0);
