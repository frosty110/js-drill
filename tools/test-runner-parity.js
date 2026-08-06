#!/usr/bin/env node
// ============================================================================
//  tools/test-runner-parity.js — one runner, and it stays one runner
// ============================================================================
// The app grades a drill attempt by running the user's code and comparing the
// captured console output against the lesson's `expectedOutput`. The validator
// certifies that same `expectedOutput` at authoring time. If those two paths
// disagree about ANY observable — how a Map prints, whether console.error gets
// a prefix, how many macrotasks are drained, whether the body is strict — then
// the validator green-lights a lesson the app will mark WRONG, and the user
// types the canonical perfectly and is told they failed.
//
// That is not hypothetical. tools/validate-data.js carried its own copy of
// formatArg/runCode/outputsMatch, kept in step by a comment reading "Behavior
// MUST stay in sync between the two". When it was finally measured, 9 of 10
// probe cases diverged, and one shipped lesson (s-strings L2#0) was live-broken
// in the browser: the assignment it asked the user to complete throws under the
// strict-mode wrapper the app applies, while the sloppy-mode validator passed
// it. Nothing in CI could see it, because the two implementations were never
// compared to each other — only each to itself.
//
// So the copy is deleted and this file guards the deletion, in two directions:
//
//   STRUCTURAL  the validator must not re-grow a private implementation. A
//               future edit that adds `function formatArg` back to
//               validate-data.js fails here, before it can drift.
//   BEHAVIOURAL the observables are pinned as explicit expectations. If someone
//               changes how the runner prints a Set, they have to change this
//               file too — which is the moment to notice that every authored
//               expectedOutput containing a Set just became wrong.
//
// Run: node tools/test-runner-parity.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { DrillRunner } = require(path.join(ROOT, 'js', 'core', 'runner.js'));
const { DrillUtil } = require(path.join(ROOT, 'js', 'core', 'util.js'));

let pass = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; return; }
  failures.push(`${name}\n      expected: ${e}\n      actual:   ${a}`);
}

async function run(code, opts) {
  const r = await DrillRunner.runCode(code, Object.assign({ lang: 'js' }, opts || {}));
  return r.ok ? r.output : `ERROR: ${r.output}`;
}

(async () => {
  // ── 1. Structural: no Node tool owns a runner of its own ─────────────────
  // There were FOUR implementations when this was written: the real one plus
  // private copies in validate-data.js, verify-lesson.js and validate-files.js.
  // Each certified lesson content, none agreed with the app, and two of them
  // were not in any CI gate at all. Matching on definitions, not mentions —
  // these files legitimately *call* runCode and outputsMatch.
  const GRADERS = ['validate-data.js', 'verify-lesson.js', 'validate-files.js'];
  const FORBIDDEN = [
    // [label, pattern that would mean "this file defines its own"]
    ['a formatArg',      /(?:function\s+(?:formatArg|fmt)\b|(?:const|let|var)\s+(?:formatArg|fmt)\s*=)/],
    ['a runCode body',   /function\s+runCode\s*\([^)]*\)\s*\{[\s\S]{0,400}?new Function\s*\(/],
    ['an outputsMatch',  /function\s+outputsMatch\b/],
    ['a normalizeLines', /function\s+normalizeLines\b/],
    ['a raw new Function grader', /new Function\s*\(\s*['"]console['"]/]
  ];
  for (const file of GRADERS) {
    const src = fs.readFileSync(path.join(ROOT, 'tools', file), 'utf8');
    for (const [label, re] of FORBIDDEN) {
      if (re.test(src)) {
        failures.push(
          `tools/${file} defines ${label} of its own — it must grade through\n` +
          `      tools/lib/runner-node.js instead. A second implementation is exactly\n` +
          `      how the last drift shipped a lesson that was broken in the browser.`);
      } else pass++;
    }
    if (/require\([^)]*lib\/runner-node/.test(src)) pass++;
    else failures.push(`tools/${file} does not require tools/lib/runner-node.js`);
  }

  // The adapter itself must load the app's real modules rather than reimplement.
  const adapter = fs.readFileSync(path.join(ROOT, 'tools', 'lib', 'runner-node.js'), 'utf8');
  for (const mod of ['runner.js', 'util.js']) {
    if (new RegExp(`core[^)]*${mod.replace('.', '\\.')}`).test(adapter)) pass++;
    else failures.push(`tools/lib/runner-node.js does not load js/core/${mod}`);
  }

  // ── 2. Behavioural: the observables every expectedOutput depends on ──────

  // Map and Set print their CONTENTS. JSON.stringify renders both as "{}",
  // which is what the old Node copy did — so a lesson logging a Map validated
  // against "{}" and then rendered "Map(1) { a => 1 }" to the user.
  check('Map formatting',
    await run(`console.log(new Map([['a',1],['b',2]]));`),
    'Map(2) { a => 1, b => 2 }');
  check('Set formatting',
    await run(`console.log(new Set([1,2]));`),
    'Set(2) { 1, 2 }');
  // Known limitation, pinned deliberately: the Map/Set special-case is only
  // applied to TOP-LEVEL console.log arguments. Nested inside an array or
  // object they fall through to JSON.stringify and print as `{}`. Authors need
  // to know that, and a future fix should break this line loudly rather than
  // silently invalidating every expectedOutput that contains a nested Set.
  check('nested Set falls through to JSON.stringify',
    await run(`console.log([new Set([1])]);`), '[{}]');

  // console.error / warn are PREFIXED into the graded stream.
  check('console.error prefix', await run(`console.error('boom');`), '[error] boom');
  check('console.warn prefix',  await run(`console.warn('careful');`), '[warn] careful');

  // console.debug / info are the user's escape hatch: captured, never graded.
  check('debug excluded from grading',
    await run(`console.log('a'); console.debug('hidden'); console.info('also');`), 'a');

  // Functions are named, not stringified to nothing.
  check('function formatting',
    await run(`console.log(function namedFn(){});`), '[Function: namedFn]');
  check('anonymous function formatting',
    await run(`console.log(() => {});`), '[Function]');

  // Primitives and the JSON path.
  check('primitives', await run(`console.log(1, true, null, undefined, 'x');`),
    '1 true null undefined x');
  check('array/object JSON', await run(`console.log([1,2], {a:1});`), '[1,2] {"a":1}');
  check('multi-arg join', await run(`console.log('a','b');`), 'a b');
  check('multi-call newline join', await run(`console.log('a');console.log('b');`), 'a\nb');

  // Circular structures must not blow up the grader.
  check('circular object is survivable',
    await run(`const o={};o.self=o;console.log(o);`), '[object Object]');

  // STRICT MODE. The body is wrapped in "use strict", so sloppy-only code
  // must fail here exactly as it fails for the user. This is the one that
  // shipped a broken lesson.
  check('strict: assignment to undeclared throws',
    await run(`x = 5; console.log(x);`), 'ERROR: x is not defined');
  check('strict: string index assignment throws',
    await run(`const s='hi'; s[0]='X'; console.log(s);`),
    `ERROR: Cannot assign to read only property '0' of string 'hi'`);

  // DRAIN. Up to 8 macrotasks, so chained awaits settle. The old Node copy
  // drained exactly 1 and would have certified only the first line.
  check('drains chained macrotasks',
    await run(`(async()=>{for(let i=0;i<3;i++){await new Promise(r=>setTimeout(r,0));console.log('tick'+i);}})();`),
    'tick0\ntick1\ntick2');
  check('async IIFE resolves',
    await run(`(async()=>{const v=await Promise.resolve(7);console.log(v);})();`), '7');

  // Errors surface as the message, with no partial output.
  check('throw reports message', await run(`throw new Error('nope');`), 'ERROR: nope');
  check('unhandled rejection is caught',
    await run(`(async()=>{throw new Error('async nope');})();`), 'ERROR: async nope');

  // ── 3. The matcher the two sides share ───────────────────────────────────
  check('outputsMatch: exact',      DrillUtil.outputsMatch('a\nb', 'a\nb'), true);
  check('outputsMatch: subsequence',DrillUtil.outputsMatch('a\ndebug\nb', 'a\nb'), true);
  check('outputsMatch: order matters', DrillUtil.outputsMatch('b\na', 'a\nb'), false);
  check('outputsMatch: missing line', DrillUtil.outputsMatch('a', 'a\nb'), false);
  check('outputsMatch: trailing whitespace ignored',
    DrillUtil.outputsMatch('a  \nb\t', 'a\nb'), true);
  check('outputsMatch: empty expects empty', DrillUtil.outputsMatch('', ''), true);

  // ── 4. The loop guard still grades like the plain runner ─────────────────
  check('budgeted runner matches plain runner',
    await DrillRunner.runCodeBudgeted(`for(let i=0;i<3;i++){console.log(i);}`, { lang: 'js' })
      .then(r => r.ok ? r.output : `ERROR: ${r.output}`),
    '0\n1\n2');
  const runaway = await DrillRunner.runCodeBudgeted(
    `let i=0; while(true){ i++; }`, { lang: 'js', maxIterations: 1000 });
  if (!runaway.ok && /Iteration budget exceeded/.test(runaway.output)) pass++;
  else failures.push('runaway loop was not stopped by the iteration budget');

  // ── report ───────────────────────────────────────────────────────────────
  if (failures.length) {
    console.error(`\n✗ runner parity: ${failures.length} failed, ${pass} passed\n`);
    for (const f of failures) console.error(`   ✗ ${f}`);
    console.error('');
    process.exit(1);
  }
  console.log(`✓ runner parity: ${pass} checks pass (one runner, browser + validator).`);
})();
