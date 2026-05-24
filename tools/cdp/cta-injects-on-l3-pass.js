#!/usr/bin/env node
// Iter 17 regression probe: when L3 passes for the first time on a lesson,
// the next-CTA row injects into the header immediately (without
// navigation). Previously this row only appeared on a subsequent
// renderLesson — so the user passed L3, saw "✓ output matches", and had
// to open the sidebar drawer to find a next action.
//
// Scenarios:
//   A. Land on a not-yet-mastered lesson with progress already at L1+L2
//      (so passing L3 transitions overall → mastered). Confirm no
//      `[data-cta-row]` is present. Pass L3 by submitting canonical.
//      Confirm a `[data-cta-row]` appears, the primary button reads
//      either "Next lesson:" or "Review N due →", and clicking it
//      navigates somewhere reasonable.

const { ensureServer, ensureChrome, connect } = require('./lib');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-iter17';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({
    url: URL,
    viewport: { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
    outDir: OUT,
  });

  // Seed: two-sum has L1+L2 passed but NOT L3 → so passing L3 makes it
  // mastered for the first time. No due reviews → expect "Next lesson"
  // primary.
  const lessonId = 'two-sum';
  await s.evalAwait(`(async () => {
    const data = { __v: 5, welcomed: true, progress: { '${lessonId}': { L1: 'passed', L2: 'passed' } } };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  })()`);
  await s.reload();

  await s.eval(`window.selectLesson('${lessonId}')`);
  await s.waitFor(`document.querySelector('#lesson-shell h2') !== null`, { timeoutMs: 5000 });
  // Switch to L3 tab
  await s.eval(`[...document.querySelectorAll('.tab-btn')].find(b => /Drill|L3/.test(b.textContent))?.click()`);
  await s.waitFor(`document.querySelector('.CodeMirror') !== null`, { timeoutMs: 5000 });
  await s.sleep(200);

  // Pre-state: no CTA row yet
  const pre = await s.eval(`!!document.querySelector('#lesson-shell [data-cta-row]')`);
  s.assert(pre === false, '[A] no CTA row before L3 pass (regression check)');
  await s.snap('A-before-l3-pass');

  // Submit canonical
  await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    let slug;
    for (const sec of m.sections) {
      if (sec.lessons.find(l => l.id === '${lessonId}')) { slug = sec.slug; break; }
    }
    const lesson = await fetch('./data/' + slug + '/${lessonId}.json').then(r => r.json());
    const cm = document.querySelector('.CodeMirror').CodeMirror;
    cm.setValue(lesson.L3.canonical);
    document.querySelector('[data-action="run"]').click();
  })()`);
  // markPassed → updateLessonHeaderInPlace runs synchronously after run completes.
  // The runner has an awaited macrotask drain; give it a small slack.
  await s.sleep(700);
  await s.snap('B-after-l3-pass');

  const post = await s.eval(`(() => {
    const row = document.querySelector('#lesson-shell [data-cta-row]');
    if (!row) return { rowPresent: false };
    const primary = row.querySelector('button.primary');
    return {
      rowPresent: true,
      primaryText: primary?.textContent.trim(),
      primaryAction: primary?.getAttribute('data-action'),
      hasMasteredPill: !!document.querySelector('.pill-mastered'),
    };
  })()`);
  console.log('Post-pass header state:', JSON.stringify(post, null, 2));
  s.assert(post && post.rowPresent === true,
    '[A] CTA row [data-cta-row] injected after L3 pass without navigation');
  s.assert(post && /Next lesson:|Review \d+ due/.test(post.primaryText || ''),
    `[A] primary CTA reads either Next lesson or Review N due (got: ${JSON.stringify(post?.primaryText)})`);
  s.assert(post && post.hasMasteredPill === true,
    '[A] mastered pill also rendered (existing in-place update preserved)');

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
