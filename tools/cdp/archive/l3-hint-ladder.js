#!/usr/bin/env node
// Verifies the iter-37 L3 hint ladder at iPhone viewport: button visible,
// taps progress 0→1→2→3 hint tiers, button locks after 3, Clear resets.
// See ideas-by-category.md § Drilling Surfaces → "L3 hint ladder" entry.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-hint-ladder';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed: route to a known full lesson on L3 tab.
  const seededId = await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const sample = m.sections.flatMap(s => s.lessons).find(l => l.status === 'full');
    if (!sample) return null;
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
      __v: 6, welcomed: true,
      progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
      starterPath: false, hideMastered: false,
      reviews: {}, weakness: {}, history: {},
      sidebarTrack: sample.track || 'syntax',
      lastLessonId: sample.id, lastTab: 'L3'
    }));
    return sample.id;
  })()`);

  if (!seededId) { console.error('FAIL: no full lesson in manifest'); process.exit(1); }
  await s.reload();
  await s.sleep(600);
  await s.snap('boot-l3');

  // Assert 1: Hint button renders.
  const hasBtn = await s.evalAwait(`!!document.querySelector('[data-hint-btn]')`);
  console.log(hasBtn ? 'PASS: hint button renders' : 'FAIL: hint button missing');

  // Assert 2: hint stack hidden before any tap.
  const stackHidden = await s.evalAwait(`document.querySelector('[data-hint-stack]').classList.contains('hidden')`);
  console.log(stackHidden ? 'PASS: hint stack hidden before tap' : 'FAIL: stack visible too early');

  // Tap 1: one hint tier appears.
  await s.evalAwait(`document.querySelector('[data-hint-btn]').click()`);
  await s.sleep(120);
  let tierCount = await s.evalAwait(`document.querySelectorAll('[data-hint-stack] .hint-tier').length`);
  console.log(tierCount === 1 ? 'PASS: 1 tier after tap 1' : `FAIL: ${tierCount} tiers after tap 1, expected 1`);

  // Tap 2: two tiers.
  await s.evalAwait(`document.querySelector('[data-hint-btn]').click()`);
  await s.sleep(120);
  tierCount = await s.evalAwait(`document.querySelectorAll('[data-hint-stack] .hint-tier').length`);
  console.log(tierCount === 2 ? 'PASS: 2 tiers after tap 2' : `FAIL: ${tierCount} tiers after tap 2, expected 2`);

  // Tap 3: three tiers + button disabled.
  await s.evalAwait(`document.querySelector('[data-hint-btn]').click()`);
  await s.sleep(120);
  tierCount = await s.evalAwait(`document.querySelectorAll('[data-hint-stack] .hint-tier').length`);
  const btnDisabled = await s.evalAwait(`document.querySelector('[data-hint-btn]').disabled`);
  console.log(tierCount === 3 && btnDisabled
    ? 'PASS: 3 tiers + button locked after tap 3'
    : `FAIL: tiers=${tierCount}, disabled=${btnDisabled}`);

  await s.snap('hint-ladder-full');

  // Assert 6: Clear resets ladder.
  await s.evalAwait(`document.querySelector('[data-action="clear"]').click()`);
  await s.sleep(150);
  const tiersAfterClear = await s.evalAwait(`document.querySelectorAll('[data-hint-stack] .hint-tier').length`);
  const btnEnabledAfterClear = await s.evalAwait(`!document.querySelector('[data-hint-btn]').disabled`);
  console.log(tiersAfterClear === 0 && btnEnabledAfterClear
    ? 'PASS: Clear resets ladder + re-enables button'
    : `FAIL: tiers=${tiersAfterClear}, btn-enabled=${btnEnabledAfterClear}`);

  await s.snap('after-clear');
  console.log('\\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
