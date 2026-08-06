// Verifies iter-11's smart selection in startRandomMockInterview /
// _pickMockLessonId. Seeds state with 1 weak Patterns lesson + 1 due
// Patterns lesson + 1 BOTH-weak-and-due Patterns lesson, then calls
// _pickMockLessonId N=300 times and tallies. Asserts the weighting
// produces the expected distribution shape (BOTH > weak-only ≈ due-only >
// baseline) while preserving variety (other patterns still appear).
//
// Run: node tools/cdp/refine-mock-smart-pick.js

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('../lib');

const OUT = '/tmp/jsdrill-refine-11';
const N = 300;
const WEAK_ID = 'p-anagrams';                  // weak only
const DUE_ID = 'p-valid-anagram';              // due only
const BOTH_ID = 'p-contains-dup';              // weak AND due
const BASELINE_ID = 'two-sum';                 // neither

const SEED = {
  __v: 5,
  welcomed: true,
  syncHintShown: true,
  progress: {
    // BOTH_ID and DUE_ID need to be mastered for reviews to exist
    [BOTH_ID]: { L1: 'passed', L2: 'passed', L3: 'passed' },
    [DUE_ID]:  { L1: 'passed', L2: 'passed', L3: 'passed' }
  },
  reviews: {
    [BOTH_ID]: { lastPassedAt: Date.now() - 8*86400e3, interval: 1, dueAt: Date.now() - 86400e3 },
    [DUE_ID]:  { lastPassedAt: Date.now() - 8*86400e3, interval: 1, dueAt: Date.now() - 2*86400e3 }
  },
  weakness: {
    [WEAK_ID]: true,
    [BOTH_ID]: true
  }
};

(async () => {
  await ensureServer({ port: 8765, dir: path.resolve(__dirname, '../..') });
  await ensureChrome();
  const s = await connect({
    url: 'http://localhost:8765/',
    viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: OUT
  });
  await s.seedLocalStorage('jsdrill.progress.v1', SEED);
  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });

  // Sanity: helper exists?
  const helperExists = await s.eval(`typeof _pickMockLessonId === 'function'`);
  s.assert(helperExists, `_pickMockLessonId helper exists`);

  // Sanity: state seed loaded correctly?
  const seedReady = await s.eval(`(() => ({
    weakHas:   !!window.__jsdrillState.weakness?.['${WEAK_ID}'],
    bothWeak:  !!window.__jsdrillState.weakness?.['${BOTH_ID}'],
    dueIds:    typeof dueReviewIds === 'function' ? dueReviewIds() : null,
  }))()`);
  console.log('Seed sanity:', JSON.stringify(seedReady));
  s.assert(seedReady.weakHas === true, `seed: weakness has ${WEAK_ID}`);
  s.assert(seedReady.bothWeak === true, `seed: weakness has ${BOTH_ID}`);
  s.assert(Array.isArray(seedReady.dueIds) && seedReady.dueIds.length >= 2,
    `seed: dueReviewIds has ≥2 entries (got ${seedReady.dueIds?.length})`);

  // Tally N picks.
  const tally = await s.eval(`(() => {
    const counts = {};
    for (let i = 0; i < ${N}; i++) {
      const id = _pickMockLessonId();
      counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  })()`);
  console.log('\nTally over', N, 'picks (top 10):');
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  for (const [id, n] of sorted.slice(0, 10)) {
    const tag = id === BOTH_ID ? ' [BOTH]' : id === WEAK_ID ? ' [WEAK]' : id === DUE_ID ? ' [DUE]' : id === BASELINE_ID ? ' [BASELINE]' : '';
    console.log(`  ${id.padEnd(28)} ${String(n).padStart(4)}${tag}`);
  }

  const cBoth = tally[BOTH_ID] || 0;
  const cWeak = tally[WEAK_ID] || 0;
  const cDue = tally[DUE_ID] || 0;
  const cBaseline = tally[BASELINE_ID] || 0;

  // BOTH should be picked more than weak-only or due-only.
  s.assert(cBoth > cWeak, `[smart-pick] BOTH (${cBoth}) > weak-only (${cWeak}) — 5× weight beats 3×`);
  s.assert(cBoth > cDue,  `[smart-pick] BOTH (${cBoth}) > due-only (${cDue}) — 5× weight beats 3×`);
  // Weak-only and due-only should each beat baseline.
  s.assert(cWeak > cBaseline, `[smart-pick] weak-only (${cWeak}) > baseline (${cBaseline}) — 3× weight beats 1×`);
  s.assert(cDue > cBaseline,  `[smart-pick] due-only (${cDue}) > baseline (${cBaseline}) — 3× weight beats 1×`);
  // Variety preserved: > 50 distinct lessons picked over 300 trials (out of ~79 patterns).
  s.assert(Object.keys(tally).length >= 50, `[smart-pick] variety preserved — ≥50 distinct lessons picked over ${N} trials (got ${Object.keys(tally).length})`);
  // Baseline still appears: a uniformly-random baseline lesson should be picked at least a few times.
  s.assert(cBaseline >= 1, `[smart-pick] baseline lesson still in pool (got ${cBaseline} picks)`);

  s.report();
  await s.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
