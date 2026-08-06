#!/usr/bin/env node
// Verifies iter-47 Section retention block in Stats modal at iPhone viewport:
// when state.history has events seeded across lessons in different sections,
// the Stats panel surfaces a per-section sparkline; sections with no activity
// are excluded; sort order is worst-retention-first.
// See ideas-by-category.md § Metacognition & Visibility.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-section-retention';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed: write history across 2 sections — one all-passes (good), one mostly-misses (bad).
  const seeded = await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const lessons = m.sections.flatMap(s => s.lessons).filter(l => l.status === 'full');
    // Two lessons from different sections.
    const sectionsSeen = new Set();
    const picks = [];
    for (const l of lessons) {
      if (sectionsSeen.has(l.section)) continue;
      sectionsSeen.add(l.section);
      picks.push(l);
      if (picks.length === 2) break;
    }
    if (picks.length < 2) return null;
    const goodId = picks[0].id, badId = picks[1].id;
    const now = Date.now();
    const day = 86400000;
    const history = {};
    history[goodId] = [
      { at: now - 5*day, event: 'L1-pass' },
      { at: now - 3*day, event: 'L2-pass' },
      { at: now - 1*day, event: 'L3-pass' }
    ];
    history[badId] = [
      { at: now - 6*day, event: 'L1-miss' },
      { at: now - 4*day, event: 'L1-miss' },
      { at: now - 2*day, event: 'L1-pass' }
    ];
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
      __v: 6, welcomed: true,
      progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
      starterPath: false, starterPathTrack: 'all', hideMastered: false,
      reviews: {}, weakness: {}, history,
      sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
    }));
    return { goodSection: picks[0].section, badSection: picks[1].section };
  })()`);
  if (!seeded) { console.error('FAIL: need 2 sections'); process.exit(1); }
  await s.reload();
  await s.sleep(500);

  // Act: open Stats modal.
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(300);
  await s.snap('stats-open');

  // Assert 1: Section retention block renders.
  const blockExists = await s.evalAwait(`!!document.querySelector('.sec-ret-block')`);
  console.log(blockExists ? 'PASS: section retention block renders in Stats' : 'FAIL: block missing');

  // Assert 2: 2 rows (one per seeded section).
  const rows = await s.evalAwait(`Array.from(document.querySelectorAll('.sec-ret-row')).map(r => ({
    section: r.querySelector('.sec-ret-name')?.textContent,
    count: r.querySelector('.sec-ret-count')?.textContent
  }))`);
  console.log(rows.length === 2 ? `PASS: 2 section rows (${rows.map(r => r.section).join(', ')})` : `FAIL: ${rows.length} rows`);

  // Assert 3: Worst-retention first (bad section row[0], good row[1]).
  const firstSection = rows[0]?.section;
  const expectedFirst = seeded.badSection;
  console.log(firstSection === expectedFirst
    ? `PASS: worst-retention first ("${firstSection}" = bad section)`
    : `FAIL: row[0] = "${firstSection}", expected "${expectedFirst}"`);

  // Assert 4: Bad section has miss bars (red).
  const badHasMissBar = await s.evalAwait(`!!document.querySelector('.sec-ret-row:first-of-type .sec-ret-bar-miss')`);
  console.log(badHasMissBar ? 'PASS: bad section row has red miss bar' : 'FAIL: no red bar in bad section');

  // Assert 5: Good section has only pass bars (green) — no miss bars.
  const goodHasMissBar = await s.evalAwait(`(() => {
    const rows = document.querySelectorAll('.sec-ret-row');
    return rows.length >= 2 && !!rows[1].querySelector('.sec-ret-bar-miss');
  })()`);
  console.log(!goodHasMissBar ? 'PASS: good section has no miss bars' : 'FAIL: good section has a miss bar');

  // Assert 6: Legend renders (4 items).
  const legendCount = await s.evalAwait(`document.querySelectorAll('.sec-ret-legend-item').length`);
  console.log(legendCount === 4 ? 'PASS: legend has 4 items' : `FAIL: legend has ${legendCount} items`);

  await s.snap('section-retention-rendered');
  console.log('\\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
