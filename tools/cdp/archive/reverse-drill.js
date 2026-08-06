#!/usr/bin/env node
// Verifies iter-76 🎯 Reverse Problem-ID at iPhone viewport: sidebar button
// → session shows input/output trace + 4 prompt distractors; function names
// are masked (no `twoSum`/`reverseList` giveaway); tap-grade increments
// state.recognize lifetime stats (shared modality with 🔎 Recognize).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-reverse';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    speedrun: { bests: {}, sessions: 0, completions: 0, lastRunAt: 0 },
    bugHunt: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('boot');

  // ── Phase 1: button renders ───────────────────────────────────────────
  const btn = await s.evalAwait(`document.getElementById('reverse-btn')?.textContent || ''`);
  console.log(btn.includes('Reverse') ? `PASS: 🎯 Reverse button rendered (${btn.trim()})` : `FAIL: button missing (got "${btn}")`);

  // ── Phase 2: tap → session card with input/output trace + 4 options ──
  await s.evalAwait(`document.getElementById('reverse-btn').click()`);
  // Preload of ~18 patterns lessons takes a moment.
  await s.sleep(8000);
  await s.snap('first-card');

  const card = await s.evalAwait(`(() => {
    const trace = document.querySelectorAll('.reverse-trace-line').length;
    const opts = document.querySelectorAll('.reverse-opt').length;
    const inv = document.querySelector('.reverse-trace-line .reverse-trace-code')?.textContent || '';
    return { trace, opts, inv };
  })()`);
  console.log(card.trace === 2 && card.opts === 4 ? `PASS: card has in/out trace (2 lines) + 4 prompt options (got inv="${card.inv}")` : `FAIL: card malformed (trace=${card.trace}, opts=${card.opts})`);

  // ── Phase 3: function names masked — invocation should contain "f("
  //          (the mask token) rather than camelCase user fn names
  const masked = await s.evalAwait(`(() => {
    const inv = document.querySelector('.reverse-trace-line .reverse-trace-code')?.textContent || '';
    // Common user fn names from patterns track that SHOULD be masked.
    const leakNames = /\\b(twoSum|reverseList|isValid|maxProfit|hasCycle|invertTree|lengthOfLongestSubstring|threeSum|search|merge)\\b/;
    return { inv, hasMask: inv.includes('f('), leaked: leakNames.test(inv) };
  })()`);
  console.log(masked.hasMask && !masked.leaked ? `PASS: function names masked ("${masked.inv}")` : `FAIL: masking issue (hasMask=${masked.hasMask}, leaked=${masked.leaked}, inv="${masked.inv}")`);

  // ── Phase 4: tap an option → state.recognize.attempts increments ─────
  const tapped = await s.evalAwait(`(() => {
    const o = document.querySelector('.reverse-opt:not(:disabled)');
    if (o) { o.click(); return true; }
    return false;
  })()`);
  let attempts = 0;
  for (let i = 0; i < 20; i++) {
    attempts = await s.evalAwait(`state.recognize?.attempts || 0`);
    if (attempts >= 1) break;
    await s.sleep(150);
  }
  console.log(attempts >= 1 ? `PASS: state.recognize.attempts incremented to ${attempts} (tapped=${tapped})` : `FAIL: stats not saved (attempts=${attempts})`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
