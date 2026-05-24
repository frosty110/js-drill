#!/usr/bin/env node
// Verifies the iter-33 sparkline (roadmap entry iter-31 #6) renders at
// iPhone viewport with seeded history events. Closes the SKILL.md mobile-
// probe requirement deferred from iter-33 ship.
//
// Pattern: arrange (seed v6 schema with synthetic history) → act (load
// page, click into a lesson) → assert (sparkline div + correct tick count
// + colors) → snap.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-sparkline';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed v6 schema with synthetic history on a known lesson.
  const seededId = await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const sample = m.sections.flatMap(s => s.lessons).find(l => l.status === 'full');
    if (!sample) return null;
    const now = Date.now();
    const day = 86400000;
    const history = {};
    history[sample.id] = [
      { at: now - 5 * day, event: 'L1-pass' },
      { at: now - 4 * day, event: 'L1-miss' },
      { at: now - 3 * day, event: 'L2-pass' },
      { at: now - 2 * day, event: 'L3-pass' },
      { at: now - 1 * day, event: 'L1-pass' }
    ];
    const data = {
      __v: 6,
      welcomed: true,
      progress: {},
      bestTimes: {}, mockHistory: {}, revealed: {},
      starterPath: false, hideMastered: false,
      reviews: {}, weakness: {},
      sidebarTrack: sample.track || 'syntax',
      history,
      lastLessonId: sample.id,
      lastTab: 'reference'
    };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
    return sample.id;
  })()`);

  if (!seededId) {
    console.error('FAIL: no full lesson in manifest');
    process.exit(1);
  }

  await s.reload();
  await s.sleep(500);
  await s.snap('boot');

  // Assert 1: sparkline div exists in lesson header.
  const hasSparkline = await s.evalAwait(`(() => {
    const slot = document.querySelector('#lesson-shell [data-sparkline-slot]');
    return !!(slot && slot.querySelector('.sparkline'));
  })()`);
  console.log(hasSparkline ? 'PASS: sparkline div renders' : 'FAIL: sparkline div missing');

  // Assert 2: correct tick count (5 seeded events all within 30-day window).
  const tickCount = await s.evalAwait(`document.querySelectorAll('#lesson-shell .sparkline .sparkline-tick').length`);
  const expectedTicks = 5;
  console.log(tickCount === expectedTicks
    ? `PASS: ${tickCount}/${expectedTicks} ticks render`
    : `FAIL: got ${tickCount} ticks, expected ${expectedTicks}`);

  // Assert 3: tick colors match the event-type map (emerald/rose/sky).
  const colors = await s.evalAwait(`Array.from(document.querySelectorAll('#lesson-shell .sparkline .sparkline-tick')).map(t => t.style.background)`);
  const expectedColors = [
    'rgb(52, 211, 153)',  // L1-pass = emerald
    'rgb(248, 113, 113)', // L1-miss = rose
    'rgb(52, 211, 153)',  // L2-pass = emerald
    'rgb(96, 165, 250)',  // L3-pass = sky
    'rgb(52, 211, 153)'   // L1-pass = emerald
  ];
  const colorsMatch = JSON.stringify(colors) === JSON.stringify(expectedColors);
  console.log(colorsMatch
    ? 'PASS: tick colors match L1/L2/L3-pass + L1-miss map'
    : `FAIL: colors=${JSON.stringify(colors)}, expected=${JSON.stringify(expectedColors)}`);

  // Assert 4: tick layout doesn't overflow the iPhone viewport (375px wide).
  // Each tick is 3px wide + 2px margin = 5px; 5 ticks = 25px. Fits trivially.
  // Assert the sparkline div's width is < 100px so it's not stealing
  // significant header real-estate (adversary's iter-33 concern).
  const sparkWidth = await s.evalAwait(`(() => {
    const el = document.querySelector('#lesson-shell .sparkline');
    return el ? Math.ceil(el.getBoundingClientRect().width) : -1;
  })()`);
  console.log(sparkWidth > 0 && sparkWidth < 100
    ? `PASS: sparkline width ${sparkWidth}px (< 100px header budget)`
    : `FAIL: sparkline width ${sparkWidth}px violates header budget`);

  await s.snap('sparkline-rendered');

  console.log('\\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
