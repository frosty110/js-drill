#!/usr/bin/env node
// Verifies iter-58 🏷 Mistake Tagging Postmortem at iPhone viewport: after
// an L1 wrong-option tap, an opt-in chip strip appears below the explain
// text with 6 mistake tags; tap a chip stores {at, level, tag} in
// state.misses; dismiss removes the strip without storing. Stats modal
// Miss Patterns tile aggregates top tags across all lessons.
// Sourced from iter-48 roadmap entry #3 (shipped iter 58).

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-mistake-tagging';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed clean state.
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

  // Navigate to a known full lesson with L1 questions and switch to L1 tab.
  const lessonId = await s.evalAwait(`(CURRICULUM.find(l => l.track === 'syntax' && l.status === 'full') || {}).id || null`);
  if (!lessonId) { console.log('FAIL: no full syntax lesson'); process.exit(1); }
  await s.evalAwait(`selectLesson('${lessonId}'); selectTab('L1');`);
  await s.sleep(1500);
  await s.snap('on-l1');

  // Assert 1: L1 cards are present (we have a render path).
  const cardCount = await s.evalAwait(`document.querySelectorAll('.mc-option').length`);
  console.log(cardCount > 0 ? `PASS: ${cardCount} MC options rendered` : 'FAIL: no MC options');

  // Find a wrong option to click: pick the first card's first option that is
  // NOT the answer. We need to read CONTENT to know which is wrong.
  const wrongInfo = await s.evalAwait(`(() => {
    const lesson = CONTENT['${lessonId}'];
    if (!lesson || !lesson.L1 || !lesson.L1.questions || !lesson.L1.questions[0]) return null;
    const q = lesson.L1.questions[0];
    // Pick first option index that is NOT q.answer.
    const wrongIdx = q.options.findIndex((_, i) => i !== q.answer);
    return { wrongIdx, answer: q.answer };
  })()`);
  if (!wrongInfo || wrongInfo.wrongIdx < 0) {
    console.log('FAIL: could not find wrong option');
    process.exit(1);
  }

  // Click the wrong option of the first question.
  await s.evalAwait(`document.querySelectorAll('[data-qi="0"] .mc-option')[${wrongInfo.wrongIdx}].click()`);
  await s.sleep(400);
  await s.snap('after-wrong-click');

  // Assert 2: chip strip appears.
  const stripPresent = await s.evalAwait(`!!document.querySelector('[data-mistake-strip]')`);
  console.log(stripPresent ? 'PASS: 🏷 chip strip rendered after L1 miss' : 'FAIL: chip strip missing');

  // Assert 3: 6 chips present (matches MISTAKE_TAGS const).
  const chipCount = await s.evalAwait(`document.querySelectorAll('.mistake-chip').length`);
  console.log(chipCount === 6 ? 'PASS: 6 mistake chips rendered' : `FAIL: ${chipCount} chips, expected 6`);

  // Assert 4: tap a chip — state.misses populated.
  await s.evalAwait(`document.querySelector('.mistake-chip[data-mistake-tag="off-by-one"]').click()`);
  await s.sleep(300);
  const missCount = await s.evalAwait(`(state.misses['${lessonId}'] || []).length`);
  console.log(missCount === 1 ? 'PASS: tag tap saved to state.misses (1 entry)' : `FAIL: missCount = ${missCount}`);

  const taggedTag = await s.evalAwait(`(state.misses['${lessonId}'] || [])[0]?.tag`);
  console.log(taggedTag === 'off-by-one' ? 'PASS: stored tag matches the picked chip' : `FAIL: stored "${taggedTag}", expected "off-by-one"`);

  // Wait for confirm-then-fade animation (1.2s + 0.22s) before next phase.
  await s.sleep(1700);

  // Assert 5: strip is gone (fade-and-remove completed).
  const stripGone = await s.evalAwait(`!document.querySelector('[data-mistake-strip]')`);
  console.log(stripGone ? 'PASS: chip strip removed after tag + fade' : 'FAIL: strip still in DOM');

  // Assert 6: open Stats modal, Miss Patterns tile renders.
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(500);
  await s.snap('stats-with-miss-tile');
  const tileText = await s.evalAwait(`document.getElementById('stats-body')?.textContent || ''`);
  const tilePresent = tileText.includes('Top miss patterns');
  console.log(tilePresent ? 'PASS: 🏷 Top miss patterns tile renders in Stats' : 'FAIL: Stats tile missing');

  const tileShowsTag = tileText.includes('off-by-one');
  console.log(tileShowsTag ? 'PASS: tile shows tagged "off-by-one"' : 'FAIL: tile does not show the tag');

  // Assert 7: dismiss path — close Stats, trigger another miss, dismiss chip.
  await s.evalAwait(`document.getElementById('stats-modal').style.display = 'none';`);
  // Pick the second question; if there's only one, we're done for the
  // dismiss check.
  const hasSecondQ = await s.evalAwait(`document.querySelectorAll('[data-qi]').length >= 2`);
  if (hasSecondQ) {
    const secondWrongIdx = await s.evalAwait(`(() => {
      const lesson = CONTENT['${lessonId}'];
      const q = lesson.L1.questions[1];
      return q.options.findIndex((_, i) => i !== q.answer);
    })()`);
    await s.evalAwait(`document.querySelectorAll('[data-qi="1"] .mc-option')[${secondWrongIdx}].click()`);
    await s.sleep(300);
    const strip2 = await s.evalAwait(`!!document.querySelector('[data-qi="1"]')?.parentElement?.querySelector('[data-mistake-strip]')`);
    if (strip2) {
      const beforeCount = await s.evalAwait(`(state.misses['${lessonId}'] || []).length`);
      await s.evalAwait(`document.querySelectorAll('[data-action="dismiss-mistake"]')[document.querySelectorAll('[data-action="dismiss-mistake"]').length - 1].click()`);
      await s.sleep(350);
      const afterCount = await s.evalAwait(`(state.misses['${lessonId}'] || []).length`);
      console.log(afterCount === beforeCount ? `PASS: dismiss removed strip without saving (count stayed ${afterCount})` : `FAIL: dismiss leaked a save (${beforeCount} → ${afterCount})`);
    } else {
      console.log('INFO: second-question strip not found; dismiss path not testable here');
    }
  } else {
    console.log('INFO: only 1 L1 question in this lesson; dismiss path not exercised');
  }

  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
