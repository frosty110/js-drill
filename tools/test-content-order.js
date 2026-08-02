#!/usr/bin/env node
// ============================================================================
//  tools/test-content-order.js — tests for the content-ordering gate
// ============================================================================
// check-content-order.js is the only thing standing between an innocuous-looking
// content edit and every share URL for that lesson silently decoding against the
// wrong question. A gate that stops detecting is indistinguishable from a green
// build, so its comparison gets its own tests.
//
// Two properties matter, and they pull against each other:
//   · it must FAIL on reorder and removal          (or codes repoint)
//   · it must PASS on append and in-place rewording (or authoring is blocked
//     and someone disables the gate)
//
// Run:  node tools/test-content-order.js
// ============================================================================

const path = require('path');
const { diffList, diffQuestionList } = require(path.join(__dirname, 'check-content-order.js'));

let pass = 0, fail = 0;
const check = (label, got, want) => {
  if (got === want) { pass++; return; }
  fail++;
  console.error(`✗ ${label}\n    expected ${want}, got ${got}`);
};
const violations = r => r.violations.length;
const changes = r => r.changes.length;

// Fingerprints stand in for question text; only identity and position matter.
const A = 'aaaa1111', B = 'bbbb2222', C = 'cccc3333', D = 'dddd4444', E = 'eeee5555';

// ── Must FAIL ───────────────────────────────────────────────────────────────

check('adjacent swap is a violation',
  violations(diffList([A, B, C], [B, A, C], 'L1')), 2);

check('moving one item to the end is a violation',
  violations(diffList([A, B, C], [B, C, A], 'L1')) > 0, true);

check('inserting in the middle is a violation (it shifts everything after)',
  violations(diffList([A, B, C], [A, E, B, C], 'L1')) > 0, true);

check('removal is a violation',
  violations(diffList([A, B, C], [A, B], 'L1')), 1);

check('removing from the middle is a violation',
  violations(diffList([A, B, C], [A, C], 'L1')) > 0, true);

check('replacing the whole list is a violation',
  violations(diffList([A, B, C], [C, B, A], 'L1')) > 0, true);

// ── Must PASS ───────────────────────────────────────────────────────────────

check('identical lists are unchanged',
  violations(diffList([A, B, C], [A, B, C], 'L1')) + changes(diffList([A, B, C], [A, B, C], 'L1')), 0);

check('appending one item is allowed',
  violations(diffList([A, B], [A, B, C], 'L1')), 0);
check('appending one item is recorded as a change',
  changes(diffList([A, B], [A, B, C], 'L1')), 1);

check('appending several items is allowed',
  violations(diffList([A], [A, B, C, D], 'L1')), 0);

check('rewording in place is allowed',
  violations(diffList([A, B, C], [A, E, C], 'L1')), 0);
check('rewording in place is recorded as a change',
  changes(diffList([A, B, C], [A, E, C], 'L1')), 1);

check('rewording AND appending is allowed',
  violations(diffList([A, B], [A, E, C], 'L1')), 0);

check('an empty baseline accepts anything',
  violations(diffList([], [A, B], 'L1')), 0);

// ── Options are positional too ──────────────────────────────────────────────
// 'B' in a share code means options[1] on every page, forever.

const q = (stem, opts) => ({ q: stem, o: opts });

check('reordering options inside an unchanged question is a violation',
  violations(diffQuestionList([q(A, [A, B, C, D])], [q(A, [B, A, C, D])], 'L1')), 2);

check('replacing an option text in place is allowed',
  violations(diffQuestionList([q(A, [A, B, C, D])], [q(A, [A, E, C, D])], 'L1')), 0);

check('dropping an option is a violation',
  violations(diffQuestionList([q(A, [A, B, C, D])], [q(A, [A, B, C])], 'L1')), 1);

check('appending a 5th option is allowed',
  violations(diffQuestionList([q(A, [A, B, C, D])], [q(A, [A, B, C, D, E])], 'L1')), 0);

check('a reworded stem does not mask reordered options',
  violations(diffQuestionList([q(A, [A, B, C])], [q(E, [C, B, A])], 'L1')) > 0, true);

check('options of an appended question are not compared against nothing',
  violations(diffQuestionList([q(A, [A, B])], [q(A, [A, B]), q(C, [C, D])], 'L1')), 0);

// ── The documented blind spot ───────────────────────────────────────────────
// A swap that also rewords BOTH items is indistinguishable from two edits by
// content alone. Asserted so the limit stays a known, deliberate one rather
// than something a future reader assumes is covered.

check('swap-plus-reword-both reads as edits (documented limit, invariants.md § 1)',
  violations(diffList([A, B], [C, D], 'L1')), 0);

console.log(`${fail ? '✗' : '✓'} content-order gate: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
