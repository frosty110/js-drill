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

  // Click a WRONG rendered option of the first question. Options are shuffled
  // per session, so match on the option TEXT (from .mc-body — the ds letter
  // chip holds only the letter) rather than assuming render order === content
  // order. Deterministic regardless of the shuffle.
  const clickedWrong = await s.evalAwait(`(() => {
    const lesson = CONTENT['${lessonId}'];
    if (!lesson || !lesson.L1 || !lesson.L1.questions || !lesson.L1.questions[0]) return false;
    const q = lesson.L1.questions[0];
    const answerTxt = q.options[q.answer].trim();
    const opts = [...document.querySelectorAll('[data-qi="0"] .mc-option')];
    const bodyTxt = el => ((el.querySelector('.mc-body') || el).textContent || '').replace(/^\\s*[A-D]\\.?\\s*/, '').trim();
    const wrong = opts.find(el => bodyTxt(el) !== answerTxt);
    if (!wrong) return false;
    wrong.click();
    return true;
  })()`);
  if (!clickedWrong) {
    console.log('FAIL: could not find/click a wrong option');
    process.exit(1);
  }
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

  // Assert 6: #stats-btn opens the ds Progress page (P5 retired the Stats modal
  // into it). "Top miss patterns" lives in the "More insights" <details> — its
  // content is in the DOM even collapsed, so textContent surfaces the tag.
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(600);
  await s.snap('progress-with-miss-tile');
  const progText = await s.evalAwait(`document.querySelector('.progress-page')?.textContent || ''`);
  const tilePresent = /Top miss patterns/i.test(progText);
  console.log(tilePresent ? 'PASS: Top miss patterns insight renders in Progress' : 'FAIL: miss-patterns insight missing');

  const tileShowsTag = progText.includes('off-by-one');
  console.log(tileShowsTag ? 'PASS: insight shows tagged "off-by-one"' : 'FAIL: insight does not show the tag');

  // Assert 7: dismiss path — return to the lesson's L1, trigger another miss,
  // dismiss the chip strip. (Opening Progress replaced the lesson shell.)
  await s.evalAwait(`(typeof selectLesson === 'function') && selectLesson('${lessonId}')`);
  await s.sleep(300);
  await s.evalAwait(`(typeof selectTab === 'function') && selectTab('L1')`);
  await s.sleep(400);
  const hasSecondQ = await s.evalAwait(`document.querySelectorAll('[data-qi]').length >= 2`);
  if (hasSecondQ) {
    // Deterministic wrong click on Q2, shuffle-robust (match on .mc-body text).
    const clicked2 = await s.evalAwait(`(() => {
      const q = CONTENT['${lessonId}'].L1.questions[1];
      const answerTxt = q.options[q.answer].trim();
      const bodyTxt = el => ((el.querySelector('.mc-body') || el).textContent || '').replace(/^\\s*[A-D]\\.?\\s*/, '').trim();
      const wrong = [...document.querySelectorAll('[data-qi="1"] .mc-option')].find(el => bodyTxt(el) !== answerTxt);
      if (!wrong) return false;
      wrong.click();
      return true;
    })()`);
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
