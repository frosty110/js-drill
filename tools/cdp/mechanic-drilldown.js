#!/usr/bin/env node
// Verifies iter-72 🧩 Mechanic Drilldown at iPhone viewport: Reference tab
// renders inline mechanic chips for lessons with `content.mechanics`; tap
// chip opens Mechanics modal directly to detail view filtered to that
// mechanic; back button returns to list view. Sourced from iter-64 held
// candidate B#2 (direct-promoted per iter-63 precedent).

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-mechanic-drilldown';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Clean state — no progress, fresh defaults.
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    speedrun: { bests: {}, sessions: 0, completions: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(600);

  // Pre-load mechanics registry + two-sum content so the chip row renders
  // on first Reference render (registry-not-loaded code-path is exercised
  // separately in the existing mechanics-modal probes).
  await s.evalAwait(`(async () => { await loadMechanicsRegistry(); await loadLessonContent('two-sum'); })()`);
  await s.sleep(300);

  // Navigate to a lesson known to have content.mechanics (two-sum →
  // hash-complement). Force Reference tab via deep-link.
  await s.evalAwait(`location.hash = '#/two-sum/reference'`);
  await s.sleep(700);
  await s.snap('boot-reference');

  // ── Phase 1: chip row renders ────────────────────────────────────────
  const chipCount = await s.evalAwait(`document.querySelectorAll('.ref-mech-chip').length`);
  console.log(chipCount >= 1 ? `PASS: ${chipCount} mechanic chip(s) rendered on Reference` : `FAIL: no chips rendered (got ${chipCount})`);

  const chipLabel = await s.evalAwait(`document.querySelector('.ref-mech-chip')?.textContent || ''`);
  console.log(chipLabel.length > 0 ? `PASS: chip shows mechanic label ("${chipLabel}")` : `FAIL: chip label empty`);

  // ── Phase 2: chip tap opens Mechanics modal to detail view ───────────
  await s.evalAwait(`document.querySelector('.ref-mech-chip').click()`);
  // Wait for ensureMechanicIndex to resolve (loads ALL lesson content; can
  // take a second on cold cache).
  await s.sleep(2500);
  await s.snap('detail-open');

  const modalVisible = await s.evalAwait(`(() => {
    const m = document.getElementById('mechanics-modal');
    return m && m.style.display !== 'none';
  })()`);
  console.log(modalVisible ? `PASS: Mechanics modal opened from chip tap` : `FAIL: modal not visible`);

  // Verify it's the DETAIL view (back button visible), not the list view.
  const backVisible = await s.evalAwait(`(() => {
    const b = document.getElementById('mechanics-back');
    return b && b.style.display !== 'none';
  })()`);
  console.log(backVisible ? `PASS: opened directly into detail view (back-button visible)` : `FAIL: modal opened to list view, not detail`);

  // Title shows the mechanic label (matches the chip the user tapped).
  const titleText = await s.evalAwait(`document.getElementById('mechanics-title')?.textContent || ''`);
  console.log(titleText.includes(chipLabel.trim()) ? `PASS: detail title matches chip ("${titleText}")` : `FAIL: title=${titleText}, chip=${chipLabel}`);

  // Detail body lists ≥1 lesson with the mechanic.
  const lessonRows = await s.evalAwait(`document.querySelectorAll('#mechanics-body [data-lesson-id]').length`);
  console.log(lessonRows >= 1 ? `PASS: detail view shows ${lessonRows} lesson(s) using this mechanic` : `FAIL: no lesson rows in detail`);

  // ── Phase 3: back button returns to LIST view ────────────────────────
  await s.evalAwait(`document.getElementById('mechanics-back').click()`);
  await s.sleep(300);
  const backToList = await s.evalAwait(`(() => {
    const back = document.getElementById('mechanics-back');
    const title = document.getElementById('mechanics-title')?.textContent || '';
    return back.style.display === 'none' && title.includes('Mechanics');
  })()`);
  console.log(backToList ? `PASS: back-button returns to list view` : `FAIL: back did not restore list view`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
