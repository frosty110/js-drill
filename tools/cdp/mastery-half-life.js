#!/usr/bin/env node
// Verifies iter-106 📈 Mastery Half-Life Stats tile at iPhone viewport.
// Seeds state.history with three lessons spaced to land in each bucket:
//   - two-sum         : 3 L3-passes 20d apart   → median ~20d → Sticky
//   - p-anagrams      : 3 L3-passes 7d apart    → median 7d   → Normal
//   - p-valid-anagram : 3 L3-passes 1d apart    → median 1d   → Slippery
// Asserts:
//   1. _masteryHalfLife() returns { sticky:1, normal:1, slippery:1 } with
//      a single-entry slipperyList pointing at p-valid-anagram.
//   2. Stats-modal tile renders all 3 bucket counts + slippery row.
//   3. Tapping the slippery row routes to p-valid-anagram lesson.
//   4. Empty-state — history wiped → tile auto-hides.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-mastery-half-life';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed: each lesson has 3 L3-pass events at fixed offsets. Median of 2
  // equal gaps is just the gap value, so per-lesson median is exact.
  const DAY = 86400000;
  const now = Date.now();
  const historySeed = {
    'two-sum': [
      { at: now - 40 * DAY, event: 'L3-pass' },
      { at: now - 20 * DAY, event: 'L3-pass' },
      { at: now -  0 * DAY, event: 'L3-pass' }
    ],
    'p-anagrams': [
      { at: now - 14 * DAY, event: 'L3-pass' },
      { at: now -  7 * DAY, event: 'L3-pass' },
      { at: now -  0 * DAY, event: 'L3-pass' }
    ],
    'p-valid-anagram': [
      { at: now - 2 * DAY, event: 'L3-pass' },
      { at: now - 1 * DAY, event: 'L3-pass' },
      { at: now - 0 * DAY, event: 'L3-pass' }
    ]
  };

  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {
      'two-sum':         { L1: 'passed', L2: 'passed', L3: 'passed' },
      'p-anagrams':      { L1: 'passed', L2: 'passed', L3: 'passed' },
      'p-valid-anagram': { L1: 'passed', L2: 'passed', L3: 'passed' }
    },
    bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, misses: {},
    history: ${JSON.stringify(historySeed)},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    speedrun: { bests: {}, sessions: 0, completions: 0, lastRunAt: 0 },
    bugHunt: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    crystal: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    claim: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    gotcha: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    swapBench: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    convDrill: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    traceHop: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    notesDrill: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    mechConstellation: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    reverseWalk: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    notesLocate: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('boot');

  // ── Phase 1: _masteryHalfLife() returns expected shape ─────────────────
  const hl = await s.evalAwait(`(() => {
    if (typeof _masteryHalfLife !== 'function') return null;
    return _masteryHalfLife(5);
  })()`);
  const slipperyIds = (hl && hl.slipperyList || []).map(r => r.lessonId);
  console.log(hl && hl.sticky === 1 && hl.normal === 1 && hl.slippery === 1 && slipperyIds.length === 1 && slipperyIds[0] === 'p-valid-anagram'
    ? `PASS: _masteryHalfLife returns { sticky:${hl.sticky}, normal:${hl.normal}, slippery:${hl.slippery} } + slipperyList=[p-valid-anagram]`
    : `FAIL: _masteryHalfLife shape (got ${JSON.stringify(hl)})`);

  // ── Phase 2: Stats modal tile renders all 3 bucket counts ──────────────
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(500);
  await s.snap('stats-open');
  const tile = await s.evalAwait(`(() => {
    const body = document.querySelector('#stats-body') || document.body;
    const html = body.innerHTML;
    const buckets = Array.from(body.querySelectorAll('.half-life-bucket')).map(b => ({
      label: (b.querySelector('.half-life-label') || {}).textContent || '',
      count: (b.querySelector('.half-life-count') || {}).textContent || ''
    }));
    const rowTitles = Array.from(body.querySelectorAll('.half-life-row .half-life-row-title')).map(t => t.textContent);
    return {
      hasTitle: html.includes('Mastery Half-Life'),
      hasSubtext: html.includes('since you started L3 drilling'),
      buckets,
      rowTitles
    };
  })()`);
  const bucketsOk = tile.buckets.length === 3
    && tile.buckets[0].label === 'Sticky'   && tile.buckets[0].count === '1'
    && tile.buckets[1].label === 'Normal'   && tile.buckets[1].count === '1'
    && tile.buckets[2].label === 'Slippery' && tile.buckets[2].count === '1';
  console.log(tile.hasTitle && tile.hasSubtext && bucketsOk && tile.rowTitles.length === 1
    ? `PASS: Stats tile renders 📈 Mastery Half-Life — Sticky:1 / Normal:1 / Slippery:1 + 1 slippery-row`
    : `FAIL: Stats tile (title=${tile.hasTitle}, subtext=${tile.hasSubtext}, buckets=${JSON.stringify(tile.buckets)}, rowTitles=${JSON.stringify(tile.rowTitles)})`);

  // ── Phase 3: tap slippery row → routes to p-valid-anagram ──────────────
  const beforeId = await s.evalAwait(`state.currentLessonId`);
  await s.evalAwait(`(() => {
    const row = document.querySelector('[data-action="open-slippery"]');
    if (row) row.click();
  })()`);
  await s.sleep(400);
  const afterId = await s.evalAwait(`state.currentLessonId`);
  const modalHidden = await s.evalAwait(`(() => {
    const m = document.getElementById('stats-modal');
    return !m || m.style.display === 'none';
  })()`);
  console.log(afterId === 'p-valid-anagram' && modalHidden
    ? `PASS: tap slippery row navigates currentLessonId from "${beforeId}" → "p-valid-anagram" + Stats modal closes`
    : `FAIL: tap routing (beforeId=${beforeId}, afterId=${afterId}, modalHidden=${modalHidden})`);

  // ── Phase 4: empty-state — wipe history, re-render Stats, tile hides ───
  await s.evalAwait(`(() => {
    state.history = {};
    saveProgress();
    document.getElementById('stats-btn').click();
  })()`);
  await s.sleep(500);
  await s.snap('stats-empty');
  const empty = await s.evalAwait(`(() => {
    const body = document.querySelector('#stats-body') || document.body;
    return { hasTile: body.innerHTML.includes('Mastery Half-Life') };
  })()`);
  console.log(!empty.hasTile
    ? `PASS: Mastery Half-Life tile auto-hides when no lesson has ≥2 L3-passes (empty-state)`
    : `FAIL: empty-state tile leaked (hasTile=${empty.hasTile})`);

  // ── Phase 5: single-pass edge — one lesson with only 1 L3-pass shouldn't count ─
  await s.evalAwait(`(() => {
    state.history = { 'two-sum': [{ at: Date.now(), event: 'L3-pass' }] };
    saveProgress();
  })()`);
  await s.sleep(200);
  const single = await s.evalAwait(`_masteryHalfLife(5)`);
  console.log(single.sticky === 0 && single.normal === 0 && single.slippery === 0
    ? `PASS: lessons with <2 L3-passes silently skipped (sticky:0/normal:0/slippery:0)`
    : `FAIL: single-pass filter (got ${JSON.stringify(single)})`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
