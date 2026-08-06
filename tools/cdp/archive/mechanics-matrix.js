#!/usr/bin/env node
// Verifies iter-63 Mechanics × Track matrix view at iPhone viewport: the
// existing Mechanics modal now has a List ↔ Matrix toggle; matrix view
// renders mechanic rows × 3 track columns with mastered/total per cell;
// transfer-gap rows (mastered in track A, unmastered in track B) are
// highlighted with ⚠ marker; tapping a non-empty cell routes to detail
// view filtered by the chosen mechanic.
// Sourced from iter-59 vision iter's held candidate B#2 (direct-promoted
// to ship in iter 63, skipping a full vision iter).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-mechanics-matrix';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed: clean state with a deliberate transfer gap — mastering all
  // syntax-track lessons with a particular mechanic but leaving the
  // patterns-track lessons untouched. Use mechanics registry to find a
  // suitable mechanic that spans tracks.
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(500);

  // Open the Mechanics modal (which loads the registry async).
  await s.evalAwait(`document.getElementById('mechanics-btn').click()`);
  await s.sleep(1200);
  await s.snap('mechanics-modal-list');

  // Assert 1: List view is active by default (List button highlighted).
  const listBtnBg = await s.evalAwait(`document.getElementById('mechanics-view-list')?.getAttribute('style') || ''`);
  console.log(listBtnBg.includes('rgba(217,70,239') ? 'PASS: List button is active by default' : `FAIL: list btn style "${listBtnBg.slice(0,60)}"`);

  // Assert 2: Matrix toggle button exists.
  const hasMatrixBtn = await s.evalAwait(`!!document.getElementById('mechanics-view-matrix')`);
  console.log(hasMatrixBtn ? 'PASS: Matrix toggle button renders' : 'FAIL: matrix btn missing');

  // Act: switch to Matrix view.
  await s.evalAwait(`document.getElementById('mechanics-view-matrix').click()`);
  await s.sleep(300);
  await s.snap('mechanics-modal-matrix');

  // Assert 3: Title updated to "Track × Tag".
  const title = await s.evalAwait(`document.getElementById('mechanics-title')?.textContent || ''`);
  console.log(/Track\s*[×x]\s*Tag/i.test(title) ? 'PASS: title shows "Track × Tag"' : `FAIL: title "${title}"`);

  // Assert 4: ≥1 mechanic row renders.
  const rowCount = await s.evalAwait(`document.querySelectorAll('#mechanics-body [data-mech-cell]').length`);
  console.log(rowCount > 0 ? `PASS: ${rowCount} matrix cells render` : 'FAIL: no cells render');

  // Assert 5: cell text shows mastered/total ratio (e.g., "0/9").
  const firstCellText = await s.evalAwait(`document.querySelector('#mechanics-body [data-mech-cell]')?.textContent || ''`);
  console.log(/^\d+\/\d+$/.test(firstCellText.trim()) ? `PASS: cell shows X/N ratio ("${firstCellText.trim()}")` : `FAIL: cell text "${firstCellText.slice(0,40)}"`);

  // Assert 6: seed mastered state on syntax lessons for one mechanic to
  // create a transfer gap. Pick the first mechanic with both syntax and
  // patterns lessons.
  const targetMech = await s.evalAwait(`(() => {
    for (const m of MECHANICS) {
      const ids = MECHANIC_INDEX.get(m.id) || new Set();
      const tracks = new Set();
      for (const id of ids) {
        const l = findLesson(id);
        if (l && (l.track === 'syntax' || l.track === 'patterns')) tracks.add(l.track);
      }
      if (tracks.size >= 2) return m.id;
    }
    return null;
  })()`);

  if (targetMech) {
    // Master all syntax-track lessons for this mechanic, leave patterns alone.
    await s.evalAwait(`(() => {
      const ids = Array.from(MECHANIC_INDEX.get('${targetMech}') || []);
      for (const id of ids) {
        const l = findLesson(id);
        if (l && l.track === 'syntax') {
          state.progress[id] = { L1: 'passed', L2: 'passed', L3: 'passed' };
        }
      }
      saveProgress();
      renderMechanicsModal();
    })()`);
    await s.sleep(300);
    await s.snap('matrix-with-transfer-gap');

    // Assert 7: transfer-gap warning banner renders.
    const gapBanner = await s.evalAwait(`document.querySelector('#mechanics-body')?.textContent?.includes('transfer gap') || false`);
    console.log(gapBanner ? 'PASS: transfer-gap banner rendered after seeded mastery' : 'FAIL: no transfer-gap banner');

    // Assert 8: ≥1 row has ⚠ marker.
    const warnRows = await s.evalAwait(`(document.querySelector('#mechanics-body')?.textContent || '').match(/⚠/g)?.length || 0`);
    console.log(warnRows >= 1 ? `PASS: ${warnRows} ⚠ markers in matrix` : 'FAIL: no ⚠ markers');
  } else {
    console.log('INFO: no mechanic spans 2+ tracks in this corpus — transfer-gap test skipped');
  }

  // Assert 9: tap a non-empty cell → detail view active.
  await s.evalAwait(`document.querySelector('#mechanics-body [data-mech-cell]').click()`);
  await s.sleep(300);
  await s.snap('detail-from-matrix');
  const backBtnVisible = await s.evalAwait(`document.getElementById('mechanics-back')?.style.display !== 'none'`);
  console.log(backBtnVisible ? 'PASS: detail view active after cell tap (back button visible)' : 'FAIL: not in detail view');

  // Assert 10: back button returns to matrix (not list).
  await s.evalAwait(`document.getElementById('mechanics-back').click()`);
  await s.sleep(300);
  const titleAfterBack = await s.evalAwait(`document.getElementById('mechanics-title')?.textContent || ''`);
  console.log(/Track\s*[×x]\s*Tag/i.test(titleAfterBack) ? 'PASS: back from cell-detail returns to Matrix view' : `FAIL: back returned to "${titleAfterBack}"`);

  // Assert 11: switch back to List view → title is plain Mechanics.
  await s.evalAwait(`document.getElementById('mechanics-view-list').click()`);
  await s.sleep(200);
  const listTitle = await s.evalAwait(`document.getElementById('mechanics-title')?.textContent || ''`);
  console.log(listTitle === '🧩 Mechanics' ? 'PASS: List view title is plain' : `FAIL: list title "${listTitle}"`);

  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
