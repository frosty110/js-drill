#!/usr/bin/env node
// Verifies iter-45 path-aware SR: when Starter Path is scoped to a track,
// the Review queue shows only in-scope due lessons; off-scope due lessons
// are tracked but hidden from the current scope; switching back to 'all'
// re-surfaces them. The badge text reflects scope.
// See iter-43 SR walkthrough gap #2; ideas-by-category.md § Paths & Sessions.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-path-aware-sr';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed: 1 due Syntax lesson + 1 due Patterns lesson; path OFF initially.
  const seeded = await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const lessons = m.sections.flatMap(s => s.lessons).filter(l => l.status === 'full');
    const syn = lessons.find(l => l.track === 'syntax');
    const pat = lessons.find(l => l.track === 'patterns');
    if (!syn || !pat) return null;
    const past = Date.now() - 2 * 86400000;
    const data = {
      __v: 6, welcomed: true,
      progress: { [syn.id]: { L1:'passed', L2:'passed', L3:'passed' }, [pat.id]: { L1:'passed', L2:'passed', L3:'passed' } },
      bestTimes: {}, mockHistory: {}, revealed: {},
      starterPath: false, starterPathTrack: 'all', hideMastered: false,
      reviews: {
        [syn.id]: { lastPassedAt: past, interval: 86400000, dueAt: past + 86400000 },
        [pat.id]: { lastPassedAt: past, interval: 86400000, dueAt: past + 86400000 }
      },
      weakness: {}, history: {},
      sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
    };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
    return { synId: syn.id, patId: pat.id };
  })()`);
  if (!seeded) { console.error('FAIL: no full syntax+patterns lessons'); process.exit(1); }
  await s.reload();
  await s.sleep(500);
  await s.snap('boot-2-due');

  // Assert 1: With path OFF, dueReviewIds() returns BOTH lessons.
  const dueOff = await s.evalAwait(`dueReviewIds().length`);
  console.log(dueOff === 2 ? 'PASS: 2 due with path off' : `FAIL: ${dueOff} due with path off, expected 2`);

  // Assert 2: Review badge shows "2" with path off.
  const cntOff = await s.evalAwait(`document.querySelector('#review-count')?.textContent`);
  console.log(cntOff === '2' ? 'PASS: badge shows "2" with path off' : `FAIL: badge = "${cntOff}", expected "2"`);

  // Act: turn path on (default track = 'all').
  await s.evalAwait(`document.getElementById('path-btn').click()`);
  await s.sleep(300);

  // Assert 3: With path on + track='all', behavior unchanged (2 due, badge "2").
  const dueAll = await s.evalAwait(`dueReviewIds().length`);
  const cntAll = await s.evalAwait(`document.querySelector('#review-count')?.textContent`);
  console.log(dueAll === 2 && cntAll === '2' ? 'PASS: path on + all → 2 due (global behavior preserved)' : `FAIL: due=${dueAll} cnt=${cntAll}`);

  // Act: scope to syntax track.
  await s.evalAwait(`document.querySelector('.path-track-chip[data-track="syntax"]').click()`);
  await s.sleep(300);
  await s.snap('syntax-scoped');

  // Assert 4: dueReviewIds() now returns only the syntax lesson.
  const dueSyn = await s.evalAwait(`dueReviewIds()`);
  console.log(dueSyn.length === 1 && dueSyn[0] === seeded.synId
    ? `PASS: scoped to syntax → 1 due (${dueSyn[0]})`
    : `FAIL: got ${JSON.stringify(dueSyn)}, expected [${seeded.synId}]`);

  // Assert 5: allDueReviewIds() unchanged (still 2, the global pool).
  const allDue = await s.evalAwait(`allDueReviewIds().length`);
  console.log(allDue === 2 ? 'PASS: allDueReviewIds() unchanged (global pool intact)' : `FAIL: allDue = ${allDue}`);

  // Assert 6: Badge shows scoped count.
  const cntSyn = await s.evalAwait(`document.querySelector('#review-count')?.textContent`);
  console.log(cntSyn === '1' ? `PASS: badge shows "1" (scoped count)` : `FAIL: badge = "${cntSyn}"`);

  // Assert 7: Switch back to 'all' → off-scope due lessons re-surface.
  await s.evalAwait(`document.querySelector('.path-track-chip[data-track="all"]').click()`);
  await s.sleep(300);
  const dueBackToAll = await s.evalAwait(`dueReviewIds().length`);
  console.log(dueBackToAll === 2 ? 'PASS: flip back to all → off-scope lessons re-surface' : `FAIL: ${dueBackToAll} due after flip back`);

  await s.snap('back-to-all');
  console.log('\\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
