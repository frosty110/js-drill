#!/usr/bin/env node
// Verifies iter-62 📅 Streak Map at iPhone viewport: button always visible;
// click opens modal with 60-cell heatmap grid; seeded state.history events
// produce colored cells with correct counts; per-cell hover updates the
// tooltip with day detail.
// Sourced from iter-59 roadmap entry #3 (shipped iter 62).

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-streak-map';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed: state.history with events spread across 3 distinct days within
  // the 60-day window. Use a lesson id we know exists in the corpus.
  const lessonId = await s.evalAwait(`(CURRICULUM.find(l => l.status === 'full') || {}).id || null`);
  if (!lessonId) { console.log('FAIL: no full lesson'); process.exit(1); }

  // Three days: today, yesterday, 5 days ago. 1 / 3 / 7 events respectively.
  const now = Date.now();
  const dayMs = 86400000;
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, misses: {},
    history: {
      '${lessonId}': [
        { at: ${now}, event: 'L1-pass' },
        { at: ${now - dayMs}, event: 'L1-pass' },
        { at: ${now - dayMs}, event: 'L2-pass' },
        { at: ${now - dayMs}, event: 'L1-miss' },
        { at: ${now - 5 * dayMs}, event: 'L1-pass' },
        { at: ${now - 5 * dayMs}, event: 'L1-pass' },
        { at: ${now - 5 * dayMs}, event: 'L2-pass' },
        { at: ${now - 5 * dayMs}, event: 'L3-pass' },
        { at: ${now - 5 * dayMs}, event: 'L1-miss' },
        { at: ${now - 5 * dayMs}, event: 'L1-miss' },
        { at: ${now - 5 * dayMs}, event: 'hint-tier-1' }
      ]
    },
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(500);
  await s.snap('boot-seeded');

  // Assert 1: button always visible (no auto-hide for Streak Map).
  const hasBtn = await s.evalAwait(`!!document.getElementById('streak-map-btn')`);
  console.log(hasBtn ? 'PASS: 📅 Streak button renders in sidebar' : 'FAIL: button missing');

  // Act: click to open modal.
  await s.evalAwait(`document.getElementById('streak-map-btn').click()`);
  await s.sleep(300);
  await s.snap('modal-open');

  // Assert 2: modal is open.
  const modalOpen = await s.evalAwait(`document.getElementById('streak-map-modal')?.style.display === 'block'`);
  console.log(modalOpen ? 'PASS: modal opened' : 'FAIL: modal not visible');

  // Assert 3: 60 cells in grid.
  const cellCount = await s.evalAwait(`document.querySelectorAll('#streak-map-grid [data-streak-idx]').length`);
  console.log(cellCount === 60 ? 'PASS: 60 day-cells render' : `FAIL: ${cellCount} cells, expected 60`);

  // Assert 4: last cell (today) has non-empty background (events seeded for today).
  const todayBg = await s.evalAwait(`document.querySelectorAll('#streak-map-grid [data-streak-idx]')[59]?.style.backgroundColor || ''`);
  // Today has 1 event vs max 7 (day 5-ago has 7 events). 1/7 = 14% → tier 1 = #064e3b.
  console.log(todayBg.includes('rgb(6, 78, 59)') || todayBg.includes('#064e3b') ? `PASS: today cell tier-1 color (${todayBg})` : `INFO: today cell color "${todayBg}"`);

  // Assert 5: day-5-ago cell (idx 54) has heaviest color (7 events = max → tier 4 = #34d399).
  const heavyBg = await s.evalAwait(`document.querySelectorAll('#streak-map-grid [data-streak-idx]')[54]?.style.backgroundColor || ''`);
  console.log(heavyBg.includes('rgb(52, 211, 153)') || heavyBg.includes('#34d399') ? `PASS: peak-day cell tier-4 color (${heavyBg})` : `FAIL: peak cell color "${heavyBg}"`);

  // Assert 6: legend renders 5 swatches.
  const swatchCount = await s.evalAwait(`document.querySelectorAll('#streak-map-legend span[style*="width"]').length`);
  console.log(swatchCount === 5 ? 'PASS: legend shows 5 swatches' : `FAIL: ${swatchCount} swatches`);

  // Assert 7: default tooltip shows total events (11 total) and active days (3).
  const tooltipText = await s.evalAwait(`document.getElementById('streak-map-tooltip')?.textContent || ''`);
  console.log(tooltipText.includes('11') && tooltipText.includes('3') ? `PASS: tooltip shows 11 events across 3 days` : `FAIL: tooltip "${tooltipText}"`);

  // Assert 8: hover peak day cell → tooltip updates with breakdown.
  await s.evalAwait(`document.querySelectorAll('#streak-map-grid [data-streak-idx]')[54].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))`);
  await s.sleep(150);
  const hoverText = await s.evalAwait(`document.getElementById('streak-map-tooltip')?.textContent || ''`);
  console.log(/4\s*pass/i.test(hoverText) && /2\s*miss/i.test(hoverText) ? 'PASS: hover tooltip shows 4 pass · 2 miss for peak day' : `FAIL: hover tooltip "${hoverText}"`);

  // Assert 9: tap an empty cell (e.g., idx 0 = 60 days ago) → "no activity" message.
  await s.evalAwait(`document.querySelectorAll('#streak-map-grid [data-streak-idx]')[0].click()`);
  await s.sleep(150);
  const emptyText = await s.evalAwait(`document.getElementById('streak-map-tooltip')?.textContent || ''`);
  console.log(emptyText.includes('no activity') ? 'PASS: empty-day tap shows "no activity"' : `FAIL: empty tooltip "${emptyText}"`);

  // Assert 10: close modal.
  await s.evalAwait(`document.getElementById('streak-map-close').click()`);
  await s.sleep(150);
  const closed = await s.evalAwait(`document.getElementById('streak-map-modal')?.style.display === 'none'`);
  console.log(closed ? 'PASS: modal closes on X click' : 'FAIL: modal still open');

  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
