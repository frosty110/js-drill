#!/usr/bin/env node
// ============================================================================
//  tools/test-sr.js — the spaced-repetition scheduler, under test at last
// ============================================================================
// js/app/04-progress-sr.js decides WHEN the user sees a lesson again. It is the
// mechanism the whole product is built on — every other surface (Today's plan,
// At Risk, Resurrect, scoped review, the due badge) is a different view of what
// this file computed. It had no test coverage of any kind.
//
// That matters more here than it would elsewhere, because SR failures are
// invisible in exactly the way this project's invariants doc worries about. An
// off-by-one in the interval ladder does not throw, does not look wrong on
// screen, and does not show up in a browser probe — the user simply gets asked
// the wrong question three weeks later, by which point nobody can trace it. The
// same is true of the load-time migrations: a v3 blob mis-read is a silent
// promotion or demotion of somebody's real study history.
//
// These run the ACTUAL slices in a vm context — no reimplementation, since a
// reimplemented scheduler is exactly the trap tools/test-runner-parity.js was
// written to close. Time is injected, so the 1d → 30d ladder is exercised in
// milliseconds rather than assumed.
//
// Run: node tools/test-sr.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

let pass = 0;
const failures = [];
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; return; }
  failures.push(`${name}\n      expected: ${e}\n      actual:   ${a}`);
}
function ok(name, cond) {
  if (cond) pass++; else failures.push(name);
}

// ── A browser-shaped sandbox, with a clock we control ──────────────────────
// The slices are plain <script> files sharing global scope, so a vm context is
// the honest way to load them: same execution model, same load order as
// index.html, nothing rewritten to be testable.
function makeApp() {
  let NOW = 1_700_000_000_000;               // fixed epoch; tests move it
  class FakeDate extends Date {
    constructor(...a) { if (!a.length) super(NOW); else super(...a); }
    static now() { return NOW; }
  }

  const store = {};
  const sandbox = {
    console, JSON, Math, Promise, setTimeout, clearTimeout, setInterval, clearInterval,
    Set, Map, Array, Object, String, Number, Boolean, RegExp, Error, isNaN,
    parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    Date: FakeDate,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    // Just enough DOM that top-level code and the save path don't throw. No
    // test below asserts on rendering — this file is about scheduling.
    document: {
      createElement: () => ({
        style: {}, dataset: {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        appendChild() {}, setAttribute() {}, addEventListener() {}, remove() {}
      }),
      querySelector: () => null, querySelectorAll: () => [],
      getElementById: () => null, addEventListener() {},
      body: { appendChild() {}, classList: { add() {}, remove() {} } },
      head: { appendChild() {} }
    },
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    fetch: () => Promise.reject(new Error('network disabled in tests')),
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    location: { hash: '', href: 'http://localhost/', pathname: '/' },
    history: { pushState() {}, replaceState() {} },
    navigator: { userAgent: 'node', onLine: true }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Same order index.html loads them in.
  for (const rel of [
    'js/storage.js', 'js/core/util.js', 'js/core/runner.js',
    'js/app/01-state-content.js', 'js/app/03-paths-cram.js',
    'js/app/04-progress-sr.js', 'js/app/09-stats-cheatsheet-mock.js'
  ]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  }

  // `const`/`let` at a script's top level land in the context's lexical scope,
  // not on the global object, so they are reached by evaluating an expression.
  const evalIn = (expr) => vm.runInContext(expr, sandbox);
  return {
    sandbox, evalIn,
    now: () => NOW,
    advance: (ms) => { NOW += ms; },
    setNow: (t) => { NOW = t; },
    // Install a synthetic curriculum + progress so tests don't depend on the
    // 171 authored lessons (which would make this a content test, not a
    // scheduler test).
    seed(lessons, progress) {
      evalIn(`CURRICULUM.length = 0; CURRICULUM.push(...${JSON.stringify(lessons)});`);
      evalIn(`state.progress = ${JSON.stringify(progress || {})};`);
      evalIn('state.reviews = {}; state.weakness = {}; state.starterPath = false;');
    }
  };
}

const DAY = 24 * 60 * 60 * 1000;
const MASTERED = { L1: 'passed', L2: 'passed', L3: 'passed' };
const LESSONS = [
  { id: 'a', title: 'A', track: 'syntax', status: 'full' },
  { id: 'b', title: 'B', track: 'syntax', status: 'full' },
  { id: 'c', title: 'C', track: 'patterns', status: 'full' }
];

// ── 1. The interval ladder ─────────────────────────────────────────────────
{
  const app = makeApp();
  const LADDER = app.evalIn('REVIEW_INTERVALS');
  check('ladder is 1d/3d/7d/14d/30d',
    LADDER.map(ms => ms / DAY), [1, 3, 7, 14, 30]);

  app.seed(LESSONS, { a: { ...MASTERED } });

  // First pass seeds the first bucket.
  app.evalIn(`scheduleReview('a')`);
  check('first pass → 1 day', app.evalIn(`state.reviews.a.interval`) / DAY, 1);
  check('first pass → dueAt is now + 1 day',
    app.evalIn(`state.reviews.a.dueAt`) - app.now(), DAY);

  // Each further pass advances exactly one rung.
  const seen = [];
  for (let i = 0; i < 6; i++) {
    app.evalIn(`scheduleReview('a')`);
    seen.push(app.evalIn(`state.reviews.a.interval`) / DAY);
  }
  check('ladder advances one rung per pass and saturates at 30d',
    seen, [3, 7, 14, 30, 30, 30]);
}

// ── 2. advance:false — the L2-on-mobile hold ───────────────────────────────
// A phone user passing L2 on a due lesson should keep the bucket and push the
// date, NOT get promoted as if they had proven free recall at L3. This is the
// desirable-difficulty rule the scheduler exists to encode; if `advance:false`
// silently promoted, mobile study would inflate every interval it touched.
{
  const app = makeApp();
  app.seed(LESSONS, { a: { ...MASTERED } });
  app.evalIn(`scheduleReview('a')`);          // 1d
  app.evalIn(`scheduleReview('a')`);          // 3d
  const before = app.evalIn(`state.reviews.a.interval`);
  app.advance(3 * DAY);
  app.evalIn(`scheduleReview('a', { advance: false })`);
  check('advance:false holds the bucket', app.evalIn(`state.reviews.a.interval`), before);
  check('advance:false still pushes dueAt forward by one interval',
    app.evalIn(`state.reviews.a.dueAt`) - app.now(), before);
}

// ── 3. Due-ness ────────────────────────────────────────────────────────────
{
  const app = makeApp();
  app.seed(LESSONS, { a: { ...MASTERED }, b: { L1: 'passed' } });
  app.evalIn(`scheduleReview('a')`);
  ok('not due the moment it is scheduled', app.evalIn(`isDueForReview('a')`) === false);

  app.advance(DAY - 1);
  ok('not due one millisecond early', app.evalIn(`isDueForReview('a')`) === false);
  app.advance(1);
  ok('due exactly at dueAt', app.evalIn(`isDueForReview('a')`) === true);

  // A half-finished lesson is not a REVIEW candidate — it is still acquisition.
  app.evalIn(`scheduleReview('b')`);
  app.advance(60 * DAY);
  ok('un-mastered lesson never becomes due', app.evalIn(`isDueForReview('b')`) === false);
  ok('unknown lesson is not due', app.evalIn(`isDueForReview('nope')`) === false);
}

// ── 4. The due queue is ordered by urgency ─────────────────────────────────
{
  const app = makeApp();
  app.seed(LESSONS, { a: { ...MASTERED }, b: { ...MASTERED }, c: { ...MASTERED } });
  app.evalIn(`scheduleReview('c')`);                       // due in 1d
  app.advance(2 * DAY);
  app.evalIn(`scheduleReview('b')`);                       // due in 1d (later date)
  app.evalIn(`scheduleReview('a')`); app.evalIn(`scheduleReview('a')`); // 3d
  app.advance(10 * DAY);
  check('due queue sorts most-overdue first', app.evalIn(`dueReviewIds()`), ['c', 'b', 'a']);
}

// ── 5. Resurrect — long-overdue, not merely due ────────────────────────────
// The distinction the Resurrect Queue exists to make: "due yesterday" and "due
// two months ago" are different problems. Threshold is now - dueAt > 2×interval.
{
  const app = makeApp();
  app.seed(LESSONS, { a: { ...MASTERED } });
  app.evalIn(`scheduleReview('a')`);                       // 1d bucket
  app.advance(DAY + 1);
  check('merely due is not resurrect-worthy', app.evalIn(`resurrectIds()`), []);
  app.advance(2 * DAY);                                    // now 2×interval past due
  check('past 2x the interval, it resurrects', app.evalIn(`resurrectIds()`), ['a']);
}

// ── 6. Load-time migrations ────────────────────────────────────────────────
// loadProgress accepts __v 2-5. A v<4 blob has no `reviews` map at all, so
// lessons already mastered must be SEEDED into the ladder — otherwise a
// long-time user's entire history silently drops out of spaced repetition and
// nothing ever comes due again.
{
  const app = makeApp();
  app.seed(LESSONS, {});
  app.sandbox.localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 3,
    progress: { a: { ...MASTERED }, b: { L1: 'passed', L2: 'passed' } }
  }));
  app.evalIn(`loadProgress()`);
  ok('v3 blob loads without throwing', true);
  check('v3 mastered lesson is seeded into the first bucket',
    app.evalIn(`state.reviews.a ? state.reviews.a.interval / ${DAY} : null`), 1);
  ok('v3 partial lesson is NOT given a review schedule',
    app.evalIn(`!state.reviews.b`));
  check('v3 progress survives the migration',
    app.evalIn(`state.progress.a`), MASTERED);
}
{
  // A current-schema blob must round-trip unchanged — no re-seeding, no drift
  // in a schedule the user has already built up.
  const app = makeApp();
  app.seed(LESSONS, {});
  const dueAt = app.now() + 7 * DAY;
  app.sandbox.localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 5,
    progress: { a: { ...MASTERED } },
    reviews: { a: { lastPassedAt: app.now(), interval: 7 * DAY, dueAt } }
  }));
  app.evalIn(`loadProgress()`);
  check('v5 interval is preserved exactly',
    app.evalIn(`state.reviews.a.interval`) / DAY, 7);
  check('v5 dueAt is preserved exactly', app.evalIn(`state.reviews.a.dueAt`), dueAt);
}
{
  // Garbage must not take the app down on boot. A user whose blob is corrupt
  // should get a working app, not a white screen.
  const app = makeApp();
  app.seed(LESSONS, {});
  app.sandbox.localStorage.setItem('jsdrill.progress.v1', '{not json at all');
  // js/storage.js logs the parse failure on its way to recovering. That log IS
  // the correct behaviour, so swallow it here rather than let a passing run
  // print a stack trace that reads like a failure.
  const realError = console.error;
  app.sandbox.console = Object.assign({}, console, { error() {}, warn() {} });
  let threw = false;
  try { app.evalIn(`loadProgress()`); } catch { threw = true; }
  app.sandbox.console = console;
  console.error = realError;
  ok('a corrupt blob does not throw on load', !threw);
  ok('state stays usable after a corrupt blob',
    typeof app.evalIn(`state.progress`) === 'object');
}

// ── 7. Save/load round-trip ────────────────────────────────────────────────
// Every field saveProgress writes must survive a reload. A field added to the
// save but missed in the load is the classic "my progress reset itself" bug.
{
  const app = makeApp();
  app.seed(LESSONS, { a: { ...MASTERED } });
  app.evalIn(`scheduleReview('a')`);
  app.evalIn(`state.weakness = { b: 2 }; saveProgress();`);

  const raw = JSON.parse(app.sandbox.localStorage.getItem('jsdrill.progress.v1'));
  // Tied to the storage layer's own contract rather than a literal, so a
  // deliberate schema bump only has to be made in one place — but a save that
  // writes a version the LOADER would reject still fails loudly here. (When
  // this was written the code was at __v 6 while CLAUDE.md still documented 5
  // in four places, which is precisely the kind of drift a literal invites.)
  const accepted = app.evalIn('window.DrillStorage.MAIN_APP_ACCEPTED_VERSIONS');
  check('save writes the newest accepted schema version',
    raw.__v, Math.max(...accepted));
  ok('the version written is one the loader accepts', accepted.includes(raw.__v));

  const app2 = makeApp();
  app2.seed(LESSONS, {});
  app2.sandbox.localStorage.setItem('jsdrill.progress.v1', JSON.stringify(raw));
  app2.evalIn(`loadProgress()`);
  check('reviews survive a save/load round-trip',
    app2.evalIn(`state.reviews.a.interval`) / DAY, 1);
  check('weakness survives a save/load round-trip',
    app2.evalIn(`state.weakness.b`), 2);
  check('progress survives a save/load round-trip',
    app2.evalIn(`state.progress.a`), MASTERED);
}

// ── report ─────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✗ spaced repetition: ${failures.length} failed, ${pass} passed\n`);
  for (const f of failures) console.error(`   ✗ ${f}`);
  console.error('');
  process.exit(1);
}
console.log(`✓ spaced repetition: ${pass} checks pass (ladder, hold, due-ness, queue order, resurrect, legacy-blob migration, round-trip).`);
