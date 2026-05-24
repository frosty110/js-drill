#!/usr/bin/env node
// Verifies the iter-35 Reference-Card Flash mode (roadmap entry iter-31 #5)
// renders at iPhone viewport: toggle button is visible on the Reference tab,
// activates blur spans in `reference.code`, tap reveals each blur.
//
// Pattern: arrange (load a known lesson on Reference tab) → act (click
// Flash toggle) → assert (toggle activates, 1-3 .flash-blur spans render,
// tapping one removes blur).

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-flash';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed: dismiss welcome, route to a known full lesson on Reference tab.
  const seededId = await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const sample = m.sections.flatMap(s => s.lessons).find(l => l.status === 'full');
    if (!sample) return null;
    const data = {
      __v: 6, welcomed: true,
      progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
      starterPath: false, hideMastered: false,
      reviews: {}, weakness: {}, history: {},
      sidebarTrack: sample.track || 'syntax',
      lastLessonId: sample.id, lastTab: 'reference'
    };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
    return sample.id;
  })()`);

  if (!seededId) { console.error('FAIL: no full lesson in manifest'); process.exit(1); }

  await s.reload();
  await s.sleep(500);
  await s.snap('boot-reference');

  // Assert 1: Flash toggle button exists on Reference tab.
  const hasToggle = await s.evalAwait(`!!document.querySelector('[data-action="flash-toggle"]')`);
  console.log(hasToggle ? 'PASS: Flash toggle renders on Reference tab' : 'FAIL: Flash toggle missing');

  // Assert 2: Before toggle, no .flash-blur spans.
  const beforeBlur = await s.evalAwait(`document.querySelectorAll('.flash-blur').length`);
  console.log(beforeBlur === 0 ? 'PASS: 0 blur spans before toggle' : `FAIL: ${beforeBlur} blur spans before toggle`);

  // Act: click the Flash toggle.
  await s.evalAwait(`document.querySelector('[data-action="flash-toggle"]').click()`);
  await s.sleep(200);
  await s.snap('flash-on');

  // Assert 3: After toggle, 1-3 .flash-blur spans render.
  const blurCount = await s.evalAwait(`document.querySelectorAll('.flash-blur').length`);
  console.log(blurCount >= 1 && blurCount <= 3
    ? `PASS: ${blurCount} blur span(s) render (1-3 expected)`
    : `FAIL: got ${blurCount} blur spans, expected 1-3`);

  // Assert 4: Tapping a blur span reveals it.
  if (blurCount > 0) {
    await s.evalAwait(`document.querySelector('.flash-blur').click()`);
    await s.sleep(150);
    const revealedCount = await s.evalAwait(`document.querySelectorAll('.flash-blur.revealed').length`);
    console.log(revealedCount >= 1
      ? `PASS: tap reveals blur (${revealedCount} revealed)`
      : 'FAIL: tap did not reveal blur span');
  }

  // Assert 5: Toggle off restores plain code (no blur spans).
  await s.evalAwait(`document.querySelector('[data-action="flash-toggle"]').click()`);
  await s.sleep(150);
  const afterToggleOff = await s.evalAwait(`document.querySelectorAll('.flash-blur').length`);
  console.log(afterToggleOff === 0 ? 'PASS: toggle off restores plain code' : `FAIL: ${afterToggleOff} blur spans remain after toggle off`);

  await s.snap('flash-off');
  console.log('\\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
