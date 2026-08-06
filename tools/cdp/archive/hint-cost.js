#!/usr/bin/env node
// Verifies iter-101 🎯 Hint-Cost Ladder Stats at iPhone viewport. Seeds
// state.history for two lessons with mixed-cost L3 passes:
//   - two-sum: 3 zero-hint passes + 1 with-hint pass = 3/4 self-rescue
//   - p-anagrams: 1 zero-hint pass + 1 with-3-tiers pass = 1/2 self-rescue
// Total: 4 zero-hint of 6 = 67% global self-rescue rate.
// Asserts: (1) Stats-modal Self-rescue tile renders 4/6 = 67%; (2) L3
// trend-chip ribbon on two-sum renders 4 chips with correct color mix
// (3 green + 1 amber).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-hint-cost';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed state.history with shaped attempts.
  const now = Date.now();
  const historySeed = {
    'two-sum': [
      // Attempt 1: clean L3-pass (zero hints)
      { at: now - 600000, event: 'L3-pass' },
      // Attempt 2: clean L3-pass (zero hints)
      { at: now - 500000, event: 'L3-pass' },
      // Attempt 3: 2 hint tiers used, then L3-pass (mid)
      { at: now - 420000, event: 'hint-tier-1' },
      { at: now - 410000, event: 'hint-tier-2' },
      { at: now - 400000, event: 'L3-pass' },
      // Attempt 4: clean L3-pass (zero hints)
      { at: now - 300000, event: 'L3-pass' }
    ],
    'p-anagrams': [
      // Attempt 1: clean L3-pass (zero hints)
      { at: now - 250000, event: 'L3-pass' },
      // Attempt 2: 3 hint tiers used (warn), then L3-pass
      { at: now - 220000, event: 'hint-tier-1' },
      { at: now - 218000, event: 'hint-tier-2' },
      { at: now - 215000, event: 'hint-tier-3' },
      { at: now - 200000, event: 'L3-pass' }
    ]
  };

  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: { 'two-sum': { L1: 'passed', L2: 'passed', L3: 'passed' }, 'p-anagrams': { L1: 'passed', L2: 'passed', L3: 'passed' } },
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
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('boot');

  // ── Phase 1: _selfRescueRateGlobal returns expected shape ─────────────
  const sr = await s.evalAwait(`(() => {
    if (typeof _selfRescueRateGlobal !== 'function') return null;
    return _selfRescueRateGlobal();
  })()`);
  console.log(sr && sr.zeroHint === 4 && sr.total === 6 && sr.rate === 67
    ? `PASS: _selfRescueRateGlobal returns expected { zeroHint: ${sr.zeroHint}, total: ${sr.total}, rate: ${sr.rate} }%`
    : `FAIL: _selfRescueRateGlobal shape (got ${JSON.stringify(sr)})`);

  // ── Phase 2: Stats modal Self-rescue tile renders with correct numbers ─
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(500);
  await s.snap('stats-open');
  const tile = await s.evalAwait(`(() => {
    const body = document.querySelector('#stats-body') || document.body;
    const html = body.innerHTML;
    const hasTitle = html.includes('Self-rescue rate');
    const hasZeroHint = /4\\s*\\/\\s*6/.test(html);
    const hasPercent = /67%/.test(html);
    const hasSubtext = html.includes('since you started L3 drilling');
    return { hasTitle, hasZeroHint, hasPercent, hasSubtext };
  })()`);
  console.log(tile.hasTitle && tile.hasZeroHint && tile.hasPercent && tile.hasSubtext
    ? `PASS: Stats tile renders 🎯 Self-rescue rate with "4 / 6 (67%)" + tracking-window subtext`
    : `FAIL: Stats tile (title=${tile.hasTitle}, 4/6=${tile.hasZeroHint}, 67%=${tile.hasPercent}, subtext=${tile.hasSubtext})`);

  // Close stats.
  await s.evalAwait(`(() => { const m = document.getElementById('stats-modal'); if (m) m.style.display = 'none'; })()`);
  await s.sleep(200);

  // ── Phase 3: navigate to two-sum L3 → ribbon renders 4 chips ─────────
  await s.evalAwait(`selectLesson('two-sum'); state.currentTab = 'L3'; renderLesson();`);
  await s.sleep(500);
  await s.snap('two-sum-l3');
  const ribbon = await s.evalAwait(`(() => {
    const chips = Array.from(document.querySelectorAll('.hint-cost-chip')).map(c => ({
      text: c.textContent.trim(),
      good: c.classList.contains('hint-cost-chip-good'),
      mid: c.classList.contains('hint-cost-chip-mid'),
      warn: c.classList.contains('hint-cost-chip-warn')
    }));
    const trendVisible = !document.querySelector('.hint-trend')?.classList.contains('hidden');
    return { chips, count: chips.length, trendVisible };
  })()`);
  const goodCount = ribbon.chips.filter(c => c.good).length;
  const midCount = ribbon.chips.filter(c => c.mid).length;
  const warnCount = ribbon.chips.filter(c => c.warn).length;
  // Expected: 3 zero-hint passes (good) + 1 with-2-tiers pass (mid) = 3 good + 1 mid + 0 warn.
  console.log(ribbon.count === 4 && goodCount === 3 && midCount === 1 && warnCount === 0 && ribbon.trendVisible
    ? `PASS: two-sum L3 ribbon shows 4 chips (3 good ✓ + 1 mid "2" + 0 warn), pill visible — chips: ${ribbon.chips.map(c => c.text).join(' ')}`
    : `FAIL: ribbon state (count=${ribbon.count}, good=${goodCount}, mid=${midCount}, warn=${warnCount}, visible=${ribbon.trendVisible}, chips=${JSON.stringify(ribbon.chips)})`);

  // ── Phase 4: navigate to p-anagrams L3 → ribbon renders 2 chips (good + warn) ──
  await s.evalAwait(`selectLesson('p-anagrams'); state.currentTab = 'L3'; renderLesson();`);
  await s.sleep(500);
  await s.snap('p-anagrams-l3');
  const ribbon2 = await s.evalAwait(`(() => {
    const chips = Array.from(document.querySelectorAll('.hint-cost-chip')).map(c => ({
      text: c.textContent.trim(),
      good: c.classList.contains('hint-cost-chip-good'),
      mid: c.classList.contains('hint-cost-chip-mid'),
      warn: c.classList.contains('hint-cost-chip-warn')
    }));
    return { chips, count: chips.length };
  })()`);
  const good2 = ribbon2.chips.filter(c => c.good).length;
  const warn2 = ribbon2.chips.filter(c => c.warn).length;
  // Expected: 1 zero-hint (good) + 1 with-3-tiers (warn) = 1 good + 0 mid + 1 warn.
  console.log(ribbon2.count === 2 && good2 === 1 && warn2 === 1
    ? `PASS: p-anagrams L3 ribbon shows 2 chips (1 good ✓ + 1 warn "3+") — chips: ${ribbon2.chips.map(c => c.text).join(' ')}`
    : `FAIL: ribbon (count=${ribbon2.count}, good=${good2}, warn=${warn2}, chips=${JSON.stringify(ribbon2.chips)})`);

  // ── Phase 5: empty-state — wipe history, re-render Stats, tile hides ──
  await s.evalAwait(`(() => {
    state.history = {};
    saveProgress();
    document.getElementById('stats-btn').click();
  })()`);
  await s.sleep(500);
  const empty = await s.evalAwait(`(() => {
    const body = document.querySelector('#stats-body') || document.body;
    return { hasTile: body.innerHTML.includes('Self-rescue rate') };
  })()`);
  console.log(!empty.hasTile
    ? `PASS: Self-rescue tile auto-hides when no L3-pass history exists (empty-state)`
    : `FAIL: empty-state tile leaked (hasTile=${empty.hasTile})`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
