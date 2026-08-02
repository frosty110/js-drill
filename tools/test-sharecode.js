#!/usr/bin/env node
// ============================================================================
//  tools/test-sharecode.js — unit tests for the share codec + route registry
// ============================================================================
// The codec is a CONTRACT: every share URL ever pasted into a chat window is
// decoded against it, and codes outlive the session that produced them. So the
// properties that matter are round-trip identity and graceful degradation on
// junk input — a code that decodes differently tomorrow is a silent wrong
// answer in someone's tutoring session.
//
// Run:  node tools/test-sharecode.js
// ============================================================================

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const S = require(path.join(ROOT, 'js', 'sharecode.js'));
const R = require(path.join(ROOT, 'js', 'routes.js'));

let pass = 0, fail = 0;
const eq = (actual, expected, label) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; return; }
  fail++;
  console.error(`✗ ${label}\n    expected ${e}\n    actual   ${a}`);
};
const ok = (cond, label) => eq(!!cond, true, label);

// ── Encoding ────────────────────────────────────────────────────────────────

eq(S.encodeMc(0, 0), 'A', 'correct pick of option 0 → A');
eq(S.encodeMc(1, 2), 'b', 'wrong pick of option 1 → b');
eq(S.encodeMc(3, 3), 'D', 'correct pick of option 3 → D');
eq(S.encodeMc(null, 1), '-', 'no pick → -');
eq(S.encodeMc(undefined, 1), '-', 'undefined pick → -');
eq(S.encodeMc(9, 1), '-', 'pick beyond the alphabet → - (never a lie)');

eq(S.encodeGraded('good'), 'Y', "'good' → Y");
eq(S.encodeGraded('partial'), 'p', "'partial' → p");
eq(S.encodeGraded('again'), 'n', "'again' → n");
eq(S.encodeGraded(true), 'Y', 'true → Y');
eq(S.encodeGraded(false), 'n', 'false → n');
eq(S.encodeGraded(null), '-', 'null → -');

eq(
  S.encodeLesson({ L1: [{ picked: 0, correct: 0 }, { picked: 1, correct: 2 }], L2: [true, false], L3: [true] }),
  'Ab.Yn.Y',
  'lesson encodes as L1.L2.L3'
);
eq(S.encodeLesson({ L1: [{ picked: 0, correct: 0 }], L2: [], L3: [false] }), 'A..n', 'empty level keeps its position');
eq(S.encodeLesson({}), '..', 'a wholly empty lesson still emits 3 segments');
eq(S.encodeUnit(['good', 'partial', 'again', null]), 'Ypn-', 'unit encodes as one flat segment');

eq(
  S.encodeSession([{ id: 'two-sum', code: 'Ab.Y.n' }, { id: 'lru-cache', code: 'AA.Y.Y' }]),
  'two-sum:Ab.Y.n,lru-cache:AA.Y.Y',
  'session joins id:code pairs'
);

// ── Round trip ──────────────────────────────────────────────────────────────
// The load-bearing property: decode(encode(x)) preserves everything, and
// re-encoding a decoded code reproduces it byte for byte.

const ALL_CHARS = 'ABCDEFGHabcdefghYpn-';
for (const ch of ALL_CHARS) {
  const d = S.decodeChar(ch);
  eq(d.char, ch, `decodeChar keeps the character (${ch})`);
  const back = d.kind === 'mc' ? S.encodeMc(d.picked, d.credit === 'full' ? d.picked : d.picked + 1)
             : d.kind === 'graded' ? S.encodeGraded(d.outcome)
             : '-';
  eq(back, ch, `round trip through the semantic layer (${ch})`);
}

const sample = 'AbbCdAbC.Yn.n';
const decoded = S.decodeLesson(sample);
eq(decoded.L1.length, 8, 'L1 decodes to 8 answers');
eq(decoded.L2.length, 2, 'L2 decodes to 2 answers');
eq(decoded.L3.length, 1, 'L3 decodes to 1 answer');
eq(decoded.L1[0].credit, 'full', 'A = credit');
eq(decoded.L1[1].credit, 'none', 'b = no credit');
eq(decoded.L1[1].picked, 1, 'b = picked option index 1');
eq(decoded.L2[1].outcome, 'again', 'n = missed');

// Case carries correctness — the property the whole design rests on.
for (let i = 0; i < 8; i++) {
  eq(S.decodeChar(S.MC_UPPER[i]).credit, 'full', `uppercase ${S.MC_UPPER[i]} = credit`);
  eq(S.decodeChar(S.MC_LOWER[i]).credit, 'none', `lowercase ${S.MC_LOWER[i]} = no credit`);
  eq(S.decodeChar(S.MC_UPPER[i]).picked, i, `${S.MC_UPPER[i]} = option ${i}`);
  eq(S.decodeChar(S.MC_LOWER[i]).picked, i, `${S.MC_LOWER[i]} = option ${i}`);
}

// The graded characters must never collide with the MC alphabet, or a decoder
// would silently read "partial" as "picked option 15".
ok(!S.MC_LOWER.includes(S.PARTIAL), 'p is outside the MC alphabet');
ok(!S.MC_LOWER.includes(S.MISSED), 'n is outside the MC alphabet');
ok(!S.MC_UPPER.includes(S.GOT_IT), 'Y is outside the MC alphabet');

const session = S.decodeSession('two-sum:Ab.Y.n,lru-cache:AA.Y.Y');
eq(session.length, 2, 'session decodes 2 entries');
eq(session[0], { id: 'two-sum', code: 'Ab.Y.n' }, 'first session entry');
eq(session[1].id, 'lru-cache', 'second session entry id');

// ── Degradation ─────────────────────────────────────────────────────────────
// A code that outlives a content change must fail soft, never throw.

eq(S.decodeLesson('').L1, [], 'empty code decodes to empty levels');
eq(S.decodeLesson('Ab').L2, [], 'truncated code: missing levels decode empty');
eq(S.decodeLesson('Ab').L1.length, 2, 'truncated code: present level still decodes');
eq(S.decodeChar('?').kind, 'unknown', 'unknown character decodes to a defined kind');
eq(S.decodeChar('?').attempted, false, 'unknown character is not counted as attempted');
eq(S.decodeUnit('Y.n'), S.decodeUnit('Y'), 'a unit code ignores extra segments');

// ── Validation ──────────────────────────────────────────────────────────────

ok(S.isValidCode('AbbCdAbC.Yn.n'), 'plain code validates');
ok(S.isValidCode(''), 'empty code validates');
ok(!S.isValidCode('<script>'), 'markup rejected');
ok(!S.isValidCode('Ab;DROP'), 'punctuation rejected');
ok(S.isValidShareParam('two-sum:Ab.Y.n,lru-cache:AA.Y.Y'), 'session param validates');
ok(!S.isValidShareParam('two-sum:Ab.Y.n,<img>:x'), 'session with a bad id rejected');
ok(!S.isValidShareParam('x'.repeat(5000)), 'oversized param rejected');

eq(S.readShareParam('?s=Ab.Y.n'), 'Ab.Y.n', 'reads s= from a query string');
eq(S.readShareParam('?foo=1&s=Ab.Y.n'), 'Ab.Y.n', 'reads s= among other params');
eq(S.readShareParam('?s=%3Cscript%3E'), null, 'rejects an encoded injection');
eq(S.readShareParam('?t=Ab'), null, 'absent s= reads null');
eq(S.withShareParam('https://x/p/two-sum', 'Ab.Y.n'), 'https://x/p/two-sum?s=Ab.Y.n', 'appends s=');
eq(S.withShareParam('https://x/p/two-sum?a=1', 'Ab'), 'https://x/p/two-sum?a=1&s=Ab', 'appends to an existing query');
eq(S.withShareParam('https://x/p/two-sum', ''), 'https://x/p/two-sum', 'no code = no param');

// ── Summary ─────────────────────────────────────────────────────────────────

const sum = S.summarize(S.flattenLesson(S.decodeLesson('AbbCdAbC.Yn.n')));
eq(sum.total, 11, 'summary counts every position');
eq(sum.full, 5, 'summary counts credited answers');
eq(sum.missed, 6, 'summary counts missed answers');
eq(sum.unattempted, 0, 'summary counts unattempted');
eq(S.summarize(S.decodeUnit('YY--nn')).unattempted, 2, 'unattempted excluded from the score');
eq(S.summarize(S.decodeUnit('YY--nn')).score, 50, 'score is over ATTEMPTED, not total');
eq(S.summarize([]).score, 0, 'empty summary does not divide by zero');

// ── Routes ──────────────────────────────────────────────────────────────────

const BASE = 'https://frosty110.github.io/js-drill/';
eq(R.sharePath('lesson', { id: 'two-sum' }), 'p/two-sum', 'lesson share path');
eq(R.sharePath('sdUnit', { topic: 'ddia', unit: 'ch01' }), 'sd/ddia/ch01', 'sd unit share path');
eq(R.sharePath('lessonIndex', {}), 'p', 'lesson index path');
eq(
  R.shareUrl('lesson', { id: 'two-sum' }, 'Ab.Y.n', { base: BASE }),
  `${BASE}p/two-sum?s=Ab.Y.n`,
  'lesson share URL'
);
eq(
  R.shareUrl('lesson', { id: 'two-sum' }, 'Ab.Y.n', { base: BASE, anchor: 'q3' }),
  `${BASE}p/two-sum?s=Ab.Y.n#q3`,
  'share URL with a question anchor'
);
eq(
  R.appUrl('lesson', { id: 'two-sum', tab: 'L1' }, { base: BASE }),
  `${BASE}index.html#/two-sum/L1`,
  'app URL keeps the SPA hash route'
);
eq(R.codeKind('lesson'), 'lesson', 'lesson uses the lesson grammar');
eq(R.codeKind('sdUnit'), 'unit', 'sd unit uses the unit grammar');
eq(R.codeKind('lessonIndex'), null, 'an index carries no code grammar');

// Parsing tolerates the deployment prefix, trailing slash and /index.html.
eq(R.parseSharePath('p/two-sum'), { kind: 'lesson', params: { id: 'two-sum' } }, 'parse bare path');
eq(R.parseSharePath('/js-drill/p/two-sum/'), { kind: 'lesson', params: { id: 'two-sum' } }, 'parse with prefix + slash');
eq(R.parseSharePath('/js-drill/p/two-sum/index.html'), { kind: 'lesson', params: { id: 'two-sum' } }, 'parse index.html');
eq(R.parseSharePath(`${BASE}sd/ddia/ch01?s=Yn`), { kind: 'sdUnit', params: { topic: 'ddia', unit: 'ch01' } }, 'parse full URL with query');
eq(R.parseSharePath('sd/ddia'), { kind: 'sdTopic', params: { topic: 'ddia' } }, 'parse topic');
eq(R.parseSharePath('sd'), { kind: 'sdIndex', params: {} }, 'parse sd index');
eq(R.parseSharePath('nope/at/all'), null, 'unknown path parses null');
eq(R.parseSharePath(''), null, 'empty path parses null');

// baseUrl must climb out of a nested static page back to the deploy root —
// otherwise a share link generated from a share page would nest forever.
const loc = d => ({ origin: 'https://x', pathname: d });
eq(R.baseUrl(loc('/js-drill/')), 'https://x/js-drill/', 'base from app root');
eq(R.baseUrl(loc('/js-drill/index.html')), 'https://x/js-drill/', 'base from index.html');
eq(R.baseUrl(loc('/js-drill/system-design.html')), 'https://x/js-drill/', 'base from system-design.html');
eq(R.baseUrl(loc('/js-drill/p/two-sum/')), 'https://x/js-drill/', 'base from a lesson share page');
eq(R.baseUrl(loc('/js-drill/sd/ddia/ch01/')), 'https://x/js-drill/', 'base from an sd share page');
eq(R.baseUrl(loc('/')), 'https://x/', 'base from a root deployment');

// Round trip through the registry: build a path, parse it, rebuild it.
for (const [kind, params] of [
  ['lesson', { id: 'two-sum' }],
  ['sdUnit', { topic: 'design-problems', unit: 'p01' }],
  ['sdTopic', { topic: 'components' }],
  ['lessonIndex', {}],
  ['sdIndex', {}]
]) {
  const parsed = R.parseSharePath(R.sharePath(kind, params));
  eq(parsed && parsed.kind, kind, `registry round trip: ${kind}`);
  eq(parsed && R.sharePath(parsed.kind, parsed.params), R.sharePath(kind, params), `registry round trip path: ${kind}`);
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log(`${fail ? '✗' : '✓'} sharecode: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
