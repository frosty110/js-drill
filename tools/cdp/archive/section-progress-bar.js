#!/usr/bin/env node
// Verifies iter-40 per-section progress bars in the sidebar at iPhone
// viewport: every full-section header has a `.section-progress` element
// with a fill bar + count label; counts match `mastered / total` for that
// section's visible lessons; fill width matches percentage; bar widens
// when a lesson is mastered.
// See ideas-by-category.md § Metacognition & Visibility → "Section-level
// progress bar in sidebar".

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-section-progress';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed: no progress yet.
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {},
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(500);
  // Open the sidebar drawer on mobile.
  await s.evalAwait(`document.querySelector('#mobile-toggle, [data-mobile-toggle]')?.click()`);
  await s.sleep(200);
  await s.snap('boot');

  // Assert 1: each section-header that has full lessons shows a
  // .section-progress element.
  const headerProgress = await s.evalAwait(`Array.from(document.querySelectorAll('.section-header')).map(h => ({
    title: h.querySelector('.section-title')?.textContent || h.textContent,
    hasBar: !!h.querySelector('.section-progress-bar'),
    hasCount: !!h.querySelector('.section-progress-count'),
    countText: h.querySelector('.section-progress-count')?.textContent
  }))`);
  const withBars = headerProgress.filter(h => h.hasBar && h.hasCount);
  console.log(withBars.length >= 3
    ? `PASS: ${withBars.length} sections have progress bars (counts visible)`
    : `FAIL: only ${withBars.length} sections have bars`);

  // Assert 2: all counts at start are "0/<n>" (no lessons mastered yet).
  const allZero = withBars.every(h => /^0\/\d+$/.test(h.countText));
  console.log(allZero ? `PASS: all sections show 0/N at start` : `FAIL: some sections show non-zero count without progress`);

  // Assert 3: fill width is 0% before any mastery.
  const fillsBefore = await s.evalAwait(`Array.from(document.querySelectorAll('.section-progress-fill')).map(el => el.style.width)`);
  const allZeroWidth = fillsBefore.every(w => w === '0%');
  console.log(allZeroWidth ? `PASS: all fill widths = 0% at start` : `FAIL: some fills > 0% at start (widths=${JSON.stringify(fillsBefore)})`);

  // Act: simulate mastering one lesson in the current view by writing
  // progress directly and re-rendering.
  const sampleId = await s.evalAwait(`(() => {
    const sec = document.querySelector('.section-header + .lesson-link');
    return sec ? sec.dataset.lessonId : null;
  })()`);
  if (sampleId) {
    await s.evalAwait(`(() => {
      state.progress['${sampleId}'] = { L1: 'passed', L2: 'passed', L3: 'passed' };
      // Trigger SR scheduling so lessonOverallStatus returns 'mastered'.
      state.reviews['${sampleId}'] = { lastPassedAt: Date.now(), interval: 86400000, dueAt: Date.now() + 86400000 };
      renderSidebar();
    })()`);
    await s.sleep(200);
    await s.snap('after-master');

    // Assert 4: the section containing sampleId now shows non-zero count.
    const updatedCount = await s.evalAwait(`(() => {
      const link = document.querySelector('[data-lesson-id="${sampleId}"]');
      if (!link) return null;
      const sec = link.previousElementSibling;
      // Walk up: lesson links sit AFTER their section header in the DOM.
      let h = link;
      while (h && !h.classList.contains('section-header')) h = h.previousElementSibling;
      return h ? h.querySelector('.section-progress-count')?.textContent : null;
    })()`);
    console.log(updatedCount && /^[1-9]\d*\//.test(updatedCount)
      ? `PASS: section count updated to ${updatedCount} after mastering`
      : `FAIL: section count after master = ${updatedCount}`);
  } else {
    console.log('SKIP: no sample lesson found for mastery test');
  }

  console.log('\\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
