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
//   node tools/check-all.js --probes …and then drive the durable browser probes
//
// The DEFAULT run is deliberately browser-free: it is what .githooks/pre-commit
// and .github/workflows/checks.yml execute, so it has to stay fast and to need
// nothing but node. Do not add a browser step to either.
//
// audit F19: leaving the browser probes out of every runner made them invisible
// — two sat red for weeks because nothing ever ran them. `--probes` is the
// opt-in suite: same gates, then each durable probe in turn with a per-probe
// verdict. Run it before shipping anything user-facing (it needs Chrome on
// :9222 — the probes bootstrap the server and the browser themselves — and
// takes a few minutes). A probe that has to be red for a known, tracked reason
// belongs in a finding, not in a comment here.
// ============================================================================

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FIX = process.argv.includes('--fix');
const PROBES = process.argv.includes('--probes');

// Ordered cheapest-first so a fast failure fails fast. `fix` is the command to
// run instead when --fix is passed (a generator rather than its --check).
const GATES = [
  { name: 'share-code codec',    cmd: ['tools/test-sharecode.js'] },
  { name: 'runner parity',       cmd: ['tools/test-runner-parity.js'] },
  { name: 'spaced repetition',   cmd: ['tools/test-sr.js'] },
  { name: 'content-order gate',  cmd: ['tools/test-content-order.js'] },
  { name: 'offline app shell',   cmd: ['tools/check-sw-shell.js'] },
  { name: 'vendored deps',       cmd: ['tools/vendor-deps.js', '--check'] },
  { name: 'tailwind subset',     cmd: ['tools/check-tailwind-subset.js'] },
  { name: 'boot weight',         cmd: ['tools/check-boot-weight.js'] },
  { name: 'sync key coverage',   cmd: ['tools/check-sync-coverage.js'] },
  { name: 'storage call sites',  cmd: ['tools/check-storage-callsites.js'] },
  { name: 'probe registry',      cmd: ['tools/check-probe-registry.js'] },
  { name: 'documented paths',    cmd: ['tools/check-doc-paths.js'] },
  { name: 'icon consistency',    cmd: ['tools/check-icons.js'] },
  { name: 'content order lock',  cmd: ['tools/check-content-order.js', '--check'], fix: ['tools/check-content-order.js'] },
  { name: 'lesson exercises',    cmd: ['tools/validate-data.js'] },
  { name: 'system design',       cmd: ['tools/validate-system-design.js'] },
  { name: 'crawlable pages',     cmd: ['tools/build-share-pages.js', '--check'], fix: ['tools/build-share-pages.js'] },
  { name: 'URL contract',        cmd: ['tools/check-url-contract.js'] },
  { name: 'shell contract',      cmd: ['tools/check-shell-contract.js'] },
  { name: 'dom references',      cmd: ['tools/check-dom-refs.js'] },
  { name: 'sd slice order',      cmd: ['tools/split-system-design.py', '--check'], bin: 'python3' },
  { name: 'init slice order',    cmd: ['tools/split-init-core.py', '--check'], bin: 'python3' }
];

// The durable browser probes — the ones that are the standing regression net
// for a whole surface, as opposed to the one-shot `refine-*` / `audit-*`
// scripts in tools/cdp/ kept around as evidence for a single iteration. Each one
// bootstraps its own server + Chrome and exits with a real status code, so the
// suite is just "run them in order". Append a row when you add a durable probe.
const PROBE_SUITE = [
  { name: 'app boot smoke',      cmd: ['tools/cdp/appsplit-smoke.js'] },
  { name: 'ds page frame',       cmd: ['tools/cdp/ds-page-frame.js'] },
  { name: 'ds drag-scroll',      cmd: ['tools/cdp/ds-dragscroll.js'] },
  { name: 'home + review nav',   cmd: ['tools/cdp/home-nav.js'] },
  { name: 'nav hierarchy',       cmd: ['tools/cdp/nav-hierarchy.js'] },
  { name: 'share URLs',          cmd: ['tools/cdp/share-urls.js'] },
  { name: 'sd study plans',      cmd: ['tools/cdp/sd-plans.js'] },
  // CLAUDE.md described this as a durable probe with 11 assertions for months
  // while nothing ran it. It passes; now it runs.
  { name: 'sd graphic route',    cmd: ['tools/cdp/sd-graphic-route.js'] },
  { name: 'sd tags + nav',       cmd: ['tools/cdp/sd-tags-nav.js'] },
  { name: 'sd mixed context',    cmd: ['tools/cdp/sd-mixed-context.js'] },
  { name: 'sd component catalog',cmd: ['tools/cdp/sd-component-catalog.js'] },
  { name: 'sd component return', cmd: ['tools/cdp/sd-component-return.js'] },
  { name: 'sd + app icons',      cmd: ['tools/cdp/sd-icons.js'] },
  { name: 'ai book shelf',       cmd: ['tools/cdp/ai-shelf.js'] },
  { name: 'agent bridge',        cmd: ['tools/cdp/agent-bridge.js'] },
  // Documented in docs/conversation-walkthrough.md as regression coverage but
  // never registered. Of the four probes that table claimed, this is the one
  // still passing (10/10) — so it runs now and the other three are archived.
  { name: 'tab state preserved', cmd: ['tools/cdp/tab-switch-preserves-state.js'] },
  { name: 'sync merge rules',    cmd: ['tools/cdp/sync-merge.js'] }
];

// A probe that wedges (Chrome never answers, a waitFor never resolves) would
// otherwise hang the whole suite silently; cap each one and report the timeout
// as the failure it is.
const PROBE_TIMEOUT_MS = 6 * 60 * 1000;

const results = [];
let failed = 0;

for (const gate of GATES) {
  const cmd = FIX && gate.fix ? gate.fix : gate.cmd;
  // Most gates are node scripts; a gate may name its own interpreter (the
  // js/sd slice-order check is the Python splitter's own --check, so the tool
  // that knows the contract is the tool that enforces it).
  const r = spawnSync(gate.bin || process.execPath, cmd, { cwd: ROOT, encoding: 'utf8' });
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

// `return`, not `process.exit(0)`: this is the DEFAULT path (pre-commit / CI),
// and process.exit tears the process down without flushing pending stdout
// writes — which are asynchronous when stdout is a pipe on macOS, so a piped
// `check-all` run could lose the summary it just printed. Falling off the end
// of the module exits 0 the same way, after the flush. (Top-level return is
// legal here: CommonJS wraps the file in a function.)
if (!PROBES) return;

// ── Opt-in browser suite (audit F19) ────────────────────────────────────────
// Streamed rather than captured: each probe prints its own assertion lines and
// a run takes minutes, so swallowing the output until the end would look hung.
console.log(`\n━━ browser probes (${PROBE_SUITE.length}) ━━`);
console.log('Needs Chrome on :9222 — the probes start it and the server themselves.\n');

const probeResults = [];
let probesFailed = 0;

for (const probe of PROBE_SUITE) {
  console.log(`\n──── ${probe.name} · ${probe.cmd[0]} ────`);
  const r = spawnSync(process.execPath, probe.cmd, {
    cwd: ROOT, stdio: 'inherit', timeout: PROBE_TIMEOUT_MS
  });
  const timedOut = r.error && r.error.code === 'ETIMEDOUT';
  const ok = !timedOut && r.status === 0;
  if (!ok) probesFailed++;
  probeResults.push({ name: probe.name, ok, note: timedOut ? ' (timed out)' : (r.error ? ` (${r.error.message})` : '') });
}

console.log('\n━━ probe summary ━━');
for (const p of probeResults) console.log(`  ${p.ok ? '✓' : '✗'} ${p.name}${p.note}`);

if (probesFailed) {
  console.error(`\n✗ ${probesFailed} of ${PROBE_SUITE.length} browser probes failed.`);
  process.exit(1);
}
console.log(`\n✓ all ${PROBE_SUITE.length} browser probes pass.`);
