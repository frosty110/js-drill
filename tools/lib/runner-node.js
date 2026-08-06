// ============================================================================
//  tools/lib/runner-node.js — the app's runner, wired for Node
// ============================================================================
// Every Node-side tool that executes lesson code must grade it EXACTLY the way
// the browser does, or it certifies an expectedOutput the app then rejects and
// the user is marked wrong for typing the canonical correctly.
//
// There used to be four implementations of that runner — js/core/runner.js plus
// private copies in validate-data.js, verify-lesson.js and validate-files.js —
// each kept in step with the others by a comment. They diverged on Map/Set
// formatting, the `[error] `/`[warn] ` prefixes, console.debug, strict mode and
// the macrotask drain, and the drift shipped a live-broken lesson.
//
// This module is the only place Node is allowed to build a runner. It loads the
// real one and supplies the single thing that genuinely differs between the two
// engines: how TypeScript types get erased. The browser lazy-loads the ~1.6 MB
// TypeScript compiler; Node has had `module.stripTypeScriptTypes` built in
// since 22.13, so it would be silly to ship the dependency. Both erase, neither
// type-checks, and lessons may only use erasable syntax — which is what makes
// the two paths equivalent (docs/canonical-style.md § TypeScript lessons).
//
// Pinned by tools/test-runner-parity.js.
const path = require('path');
const nodeModule = require('node:module');

const ROOT = path.resolve(__dirname, '..', '..');
const { DrillRunner } = require(path.join(ROOT, 'js', 'core', 'runner.js'));
const { DrillUtil } = require(path.join(ROOT, 'js', 'core', 'util.js'));

const STRIP = typeof nodeModule.stripTypeScriptTypes === 'function'
  ? nodeModule.stripTypeScriptTypes
  : null;

// mode:'strip' blanks types out in place, preserving line/column so a runtime
// error's position still points at the authored source.
function eraseTypes(code, lang) {
  if (lang !== 'ts') return code;
  if (!STRIP) {
    throw new Error(
      'This Node build cannot strip TypeScript types (needs Node >= 22.13). ' +
      'Upgrade Node to validate lang:"ts" lessons.'
    );
  }
  return STRIP(code, { mode: 'strip' });
}

DrillRunner.setTypeEraser(eraseTypes);

// Adapter only — all grading semantics live in DrillRunner. Callers expect
// `{ output, error }`; the runner reports failure as `ok:false` with the
// message in `output`.
async function runCode(code, lang) {
  const r = await DrillRunner.runCode(code, { lang: lang || 'js' });
  return r.ok ? { output: r.output, error: null } : { output: '', error: r.output };
}

module.exports = {
  runCode,
  eraseTypes,
  // Subsequence match, straight from the app's own util: every expected line
  // must appear in actual, in order. Extra lines are tolerated so a debug
  // console.log the user left in doesn't fail an otherwise-correct answer.
  outputsMatch: DrillUtil.outputsMatch,
  DrillRunner,
  DrillUtil
};
