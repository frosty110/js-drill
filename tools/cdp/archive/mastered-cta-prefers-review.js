#!/usr/bin/env node
// Iter 16 regression probe: on a mastered lesson, the next-CTA row swaps
// to "Review N due" when due reviews exist (and clicking it routes to a
// due lesson). With no due reviews, the row reverts to "Next lesson".

const { ensureServer, ensureChrome, connect } = require('../lib');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-iter16';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Scenario A: mastered lesson + 4 due reviews → "Review 4 due" primary.
  await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const all = m.sections.flatMap(s => s.lessons).filter(l => l.status === 'full');
    const data = { __v: 5, welcomed: true, progress: {}, reviews: {} };
    for (const l of all.slice(0, 15)) data.progress[l.id] = { L1: 'passed', L2: 'passed', L3: 'passed' };
    for (let i = 0; i < 4; i++) {
      data.reviews[all[i].id] = { lastPassedAt: Date.now() - 3*86400000, interval: 86400000, dueAt: Date.now() - 7200000 };
    }
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  })()`);
  await s.reload();
  await s.snap('A-mastered-with-due');

  const a = await s.eval(`(() => {
    const primary = document.querySelector('#lesson-shell button.primary');
    return { primaryText: primary?.textContent.trim(), dataAction: primary?.getAttribute('data-action') };
  })()`);
  s.assert(a && /Review\s+\d+\s+due/.test(a.primaryText || ''),
    `[A] primary CTA reads "Review N due" (got: ${JSON.stringify(a)})`);
  s.assert(a && a.dataAction === 'goto-due-review',
    `[A] primary CTA has data-action="goto-due-review" (got: ${JSON.stringify(a)})`);

  // Click the primary; should land on a due lesson (any of the 4 seeded)
  // at L2 (mobile/coarse pointer routing per iter 1).
  await s.click('[data-action="goto-due-review"]');
  await s.sleep(900);
  const landing = await s.eval(`(() => ({
    currentLesson: window.__jsdrillState.currentLessonId,
    activeTab: document.querySelector('.tab-btn.active')?.textContent.trim(),
  }))()`);
  s.assert(landing && /L2|Fill/.test(landing.activeTab || ''),
    `[A] click → mobile lands on L2 (got: ${JSON.stringify(landing)})`);

  // Scenario B: no due reviews → "Next lesson" primary as before.
  await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const all = m.sections.flatMap(s => s.lessons).filter(l => l.status === 'full');
    const data = { __v: 5, welcomed: true, progress: {} };
    for (const l of all.slice(0, 3)) data.progress[l.id] = { L1: 'passed', L2: 'passed', L3: 'passed' };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  })()`);
  await s.reload();
  await s.snap('B-mastered-no-due');

  const b = await s.eval(`(() => {
    const primary = document.querySelector('#lesson-shell button.primary');
    return { primaryText: primary?.textContent.trim(), dataAction: primary?.getAttribute('data-action') };
  })()`);
  s.assert(b && /Next lesson/.test(b.primaryText || ''),
    `[B] primary CTA reverts to "Next lesson" when no due (got: ${JSON.stringify(b)})`);
  s.assert(b && b.dataAction === 'goto-next',
    `[B] primary CTA has data-action="goto-next" (got: ${JSON.stringify(b)})`);

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
