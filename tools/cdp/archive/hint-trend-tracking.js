#!/usr/bin/env node
// Verifies iter-46 hint-tier + critical-lines SR-tracking at iPhone viewport:
// hint button clicks append `hint-tier-N` to history; 🎯 clicks append
// `critical-lines-used`; the trend badge surfaces the windowed ratio.
// See iter-43 SR walkthrough gap #3.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL_BASE = (process.argv[2] || 'http://localhost:8765/').replace(/\/$/, '');
const OUT = process.argv[3] || '/tmp/jsdrill-hint-trend';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL_BASE + '/', mobile: true, outDir: OUT });

  // Seed: route to two-sum on L3 (has criticalLines + hints), no history.
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {},
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  const s2 = await connect({ url: URL_BASE + '/#/two-sum/L3', mobile: true, outDir: OUT });
  await s2.sleep(700);
  await s2.snap('boot-no-history');

  // Assert 1: trend badge hidden with no history.
  const hiddenAtBoot = await s2.evalAwait(`document.querySelector('[data-hint-trend]')?.classList.contains('hidden')`);
  console.log(hiddenAtBoot ? 'PASS: trend badge hidden at boot (no history)' : 'FAIL: trend badge visible without history');

  // Act 1: click hint twice → 2 hint-tier events.
  await s2.evalAwait(`document.querySelector('[data-hint-btn]').click()`);
  await s2.sleep(120);
  await s2.evalAwait(`document.querySelector('[data-hint-btn]').click()`);
  await s2.sleep(120);

  // Assert 2: state.history has both events.
  const events = await s2.evalAwait(`(state.history['two-sum'] || []).map(e => e.event)`);
  console.log(events.includes('hint-tier-1') && events.includes('hint-tier-2')
    ? `PASS: 2 hint-tier events recorded (${JSON.stringify(events)})`
    : `FAIL: events = ${JSON.stringify(events)}`);

  // Assert 3: trend badge now visible.
  const visibleAfterHints = await s2.evalAwait(`!document.querySelector('[data-hint-trend]').classList.contains('hidden')`);
  console.log(visibleAfterHints ? 'PASS: trend badge visible after hint clicks' : 'FAIL: badge still hidden');

  // Assert 4: badge shows "1 of 1" (one attempt, hinted).
  const badgeText = await s2.evalAwait(`document.querySelector('[data-hint-trend] .hint-trend-pill')?.textContent || ''`);
  console.log(/1\s+of\s+1/.test(badgeText)
    ? `PASS: badge shows "1 of 1" ("${badgeText.trim()}")`
    : `FAIL: badge = "${badgeText.trim()}"`);

  // Assert 5: badge is amber (hint-trend-warn) since 100% hinted.
  const isWarn = await s2.evalAwait(`document.querySelector('[data-hint-trend] .hint-trend-pill')?.classList.contains('hint-trend-warn')`);
  console.log(isWarn ? 'PASS: badge tone = warn (100% hinted)' : 'FAIL: badge not amber');

  // Act 2: click critical-fill → 'critical-lines-used' event.
  await s2.evalAwait(`document.querySelector('[data-critical-btn]').click()`);
  await s2.sleep(120);
  const eventsAfterCritical = await s2.evalAwait(`(state.history['two-sum'] || []).map(e => e.event)`);
  console.log(eventsAfterCritical.includes('critical-lines-used')
    ? `PASS: critical-lines-used event recorded`
    : `FAIL: events = ${JSON.stringify(eventsAfterCritical)}`);

  // Act 3: simulate a clean L3-pass without hints (manually append events).
  await s2.evalAwait(`(() => {
    appendHistory('two-sum', 'L3-pass'); // closes the hinted attempt
    appendHistory('two-sum', 'L3-pass'); // a new clean attempt with no hints
    saveProgress();
    renderLesson();
  })()`);
  await s2.sleep(300);
  const badgeAfterPasses = await s2.evalAwait(`document.querySelector('[data-hint-trend] .hint-trend-pill')?.textContent || ''`);
  // Now: attempt 1 = hinted (passed), attempt 2 = unhinted (passed). Last 5 = 2 attempts, 1 hinted.
  console.log(/1\s+of\s+2/.test(badgeAfterPasses)
    ? `PASS: badge after clean pass shows "1 of 2" ("${badgeAfterPasses.trim()}")`
    : `FAIL: badge = "${badgeAfterPasses.trim()}"`);

  await s2.snap('after-mixed-attempts');
  console.log('\\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
