#!/usr/bin/env node
// Verifies the iter-36 Walkthrough Quiz mode renders at iPhone viewport on
// a Patterns lesson with a walkthrough trace: button is visible, click
// opens 4 MC option cards, tapping a card reveals correct/wrong styling.
// See ideas-by-category.md § Drilling Surfaces → "What comes next?" entry.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-walk-quiz';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Pick a Patterns lesson with a walkthrough trace (≥4 steps).
  const seededId = await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const lessons = m.sections.flatMap(s => s.lessons).filter(l => l.status === 'full' && l.track === 'patterns');
    for (const lesson of lessons) {
      try {
        const c = await fetch('./data/' + lesson.section.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '/' + lesson.id + '.json').then(r => r.json());
        if (c.walkthrough && c.walkthrough.trace) return lesson.id;
      } catch {}
    }
    return null;
  })()`);

  if (!seededId) { console.error('FAIL: no patterns lesson with walkthrough trace found'); process.exit(1); }

  // Seed: dismiss welcome, route to that lesson on Walkthrough tab.
  await s.evalAwait(`(() => {
    const data = {
      __v: 6, welcomed: true,
      progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
      starterPath: false, hideMastered: false,
      reviews: {}, weakness: {}, history: {},
      sidebarTrack: 'patterns',
      lastLessonId: '${seededId}', lastTab: 'walkthrough'
    };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  })()`);

  await s.reload();
  await s.sleep(700);
  await s.snap('boot-walkthrough');

  // Assert 1: Quiz button renders on Walkthrough tab.
  const hasQuizBtn = await s.evalAwait(`!!document.querySelector('[data-walk-quiz]')`);
  console.log(hasQuizBtn ? 'PASS: Quiz button renders on Walkthrough' : 'FAIL: Quiz button missing');

  // Assert 2: Quiz panel hidden before click.
  const panelHiddenBefore = await s.evalAwait(`document.querySelector('[data-walk-quiz-panel]').classList.contains('hidden')`);
  console.log(panelHiddenBefore ? 'PASS: quiz panel hidden before click' : 'FAIL: quiz panel visible before click');

  // Act: click Quiz button.
  await s.evalAwait(`document.querySelector('[data-walk-quiz]').click()`);
  await s.sleep(200);
  await s.snap('quiz-active');

  // Assert 3: Quiz panel visible and 4 option cards render.
  const optCount = await s.evalAwait(`document.querySelectorAll('[data-walk-quiz-opts] .walk-quiz-opt').length`);
  console.log(optCount === 4 ? `PASS: 4 option cards render` : `FAIL: got ${optCount} option cards, expected 4`);

  // Assert 4: Prev/Next disabled while quiz active.
  const prevDisabled = await s.evalAwait(`document.querySelector('[data-walk-prev]').disabled`);
  const nextDisabled = await s.evalAwait(`document.querySelector('[data-walk-next]').disabled`);
  console.log(prevDisabled && nextDisabled ? 'PASS: prev/next disabled during quiz' : `FAIL: prev=${prevDisabled} next=${nextDisabled}`);

  // Act: tap the first option card.
  await s.evalAwait(`document.querySelector('[data-walk-quiz-opts] .walk-quiz-opt').click()`);
  await s.sleep(150);

  // Assert 5: At least one option card has .correct or .incorrect styling after tap.
  const styledCount = await s.evalAwait(`document.querySelectorAll('[data-walk-quiz-opts] .walk-quiz-opt.correct, [data-walk-quiz-opts] .walk-quiz-opt.incorrect').length`);
  console.log(styledCount >= 1 ? `PASS: ${styledCount} card(s) styled after tap` : 'FAIL: no styling after tap');

  // Assert 6: Close quiz restores controls.
  await s.evalAwait(`document.querySelector('[data-walk-quiz-close]').click()`);
  await s.sleep(150);
  const panelHiddenAfter = await s.evalAwait(`document.querySelector('[data-walk-quiz-panel]').classList.contains('hidden')`);
  console.log(panelHiddenAfter ? 'PASS: quiz close restores hidden state' : 'FAIL: quiz panel still visible after close');

  await s.snap('quiz-closed');
  console.log('\\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
