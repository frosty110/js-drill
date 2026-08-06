#!/usr/bin/env node
// iter 118 — verifies 🔥 Hot-Seat Follow-Up modal at iPhone viewport.
// Opt-in post-L3-pass modal with mechanic-tag-derived follow-up + 3 distractors.
//
// 1) Toggle defaults OFF; sidebar button present.
// 2) Toggle ON, mark L3 pass on a Patterns lesson → modal renders 4 options.
// 3) Wrong tap → red marker, no resolve, attempts++.
// 4) Correct tap → green marker + resolved feedback + Continue button + correct++.
// 5) Continue closes modal.
// 6) Toggle OFF → L3 pass does NOT show modal.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-hotseat';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    hotseatOn: false,
    hotseat: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);

  console.log(await s.evalAwait(`!!document.getElementById('hotseat-btn')`) ? 'PASS: 🔥 Hot-Seat sidebar button present' : 'FAIL: button missing');
  console.log(await s.evalAwait(`state.hotseatOn === false`) ? 'PASS: hotseatOn defaults false' : 'FAIL: default state wrong');

  // Toggle ON.
  await s.evalAwait(`document.getElementById('hotseat-btn').click()`);
  await s.sleep(100);
  console.log(await s.evalAwait(`state.hotseatOn === true`) ? 'PASS: toggle flips flag to true' : 'FAIL: toggle did not flip');

  // Load a Patterns lesson with mechanics and trigger L3 pass.
  const lessonId = 'two-sum';
  await s.evalAwait(`selectLesson('${lessonId}')`);
  for (let i = 0; i < 10; i++) {
    await s.sleep(400);
    if (await s.evalAwait(`!!CONTENT['${lessonId}']`)) break;
  }
  // Verify two-sum has mechanics tags (precondition).
  const hasMech = await s.evalAwait(`(() => {
    const c = CONTENT['${lessonId}'];
    return Array.isArray(c?.mechanics) && c.mechanics.length > 0;
  })()`);
  console.log(hasMech ? 'PASS: two-sum has mechanics[] tags (precondition)' : 'FAIL: two-sum lacks mechanics tags');

  // Trigger L3 pass via markPassed (bypasses editor for probe efficiency).
  await s.evalAwait(`markPassed('${lessonId}', 'L3')`);
  // Modal renders async (registry fetch). Give it a beat.
  await s.sleep(800);
  await s.snap('modal-shown');

  const modalState = await s.evalAwait(`(() => {
    const modal = document.getElementById('hotseat-modal');
    const opts = document.querySelectorAll('.hotseat-option');
    return {
      present: !!modal,
      optionCount: opts.length,
      hasSkip: !!modal?.querySelector('.hotseat-skip'),
      hasTag: !!modal?.querySelector('.hotseat-tag')
    };
  })()`);
  console.log(modalState.present ? 'PASS: hotseat-modal rendered after L3 pass' : 'FAIL: modal missing');
  console.log(modalState.optionCount === 4 ? `PASS: 4 options rendered` : `FAIL: ${modalState.optionCount} options (expected 4)`);
  console.log(modalState.hasSkip && modalState.hasTag ? 'PASS: header + skip button present' : 'FAIL: header malformed');

  if (!modalState.present) process.exit(1);

  // Verify mix: exactly 1 correct + 3 wrong.
  const mix = await s.evalAwait(`(() => {
    const opts = Array.from(document.querySelectorAll('.hotseat-option'));
    return {
      correct: opts.filter(o => o.dataset.correct === '1').length,
      wrong: opts.filter(o => o.dataset.correct === '0').length
    };
  })()`);
  console.log(mix.correct === 1 && mix.wrong === 3 ? 'PASS: 1 correct + 3 wrong distractors' : `FAIL: mix ${JSON.stringify(mix)}`);

  // Tap WRONG option first → red + attempts++ + no resolve.
  const beforeAttempts = await s.evalAwait(`state.hotseat.attempts`);
  await s.evalAwait(`document.querySelector('.hotseat-option[data-correct="0"]').click()`);
  await s.sleep(120);
  const afterWrong = await s.evalAwait(`({
    attempts: state.hotseat.attempts,
    correct: state.hotseat.correct,
    hasWrongMark: !!document.querySelector('.hotseat-option-wrong'),
    hasResolved: !!document.querySelector('.hotseat-resolved')
  })`);
  console.log(afterWrong.attempts === beforeAttempts + 1 ? `PASS: wrong tap incremented attempts (${beforeAttempts}→${afterWrong.attempts})` : `FAIL: attempts ${beforeAttempts}→${afterWrong.attempts}`);
  console.log(afterWrong.hasWrongMark ? 'PASS: wrong option marked red' : 'FAIL: no red marker');
  console.log(!afterWrong.hasResolved ? 'PASS: no resolved feedback yet' : 'FAIL: resolved leaked through');

  // Tap CORRECT option → green + resolved feedback + Continue button + correct++.
  await s.evalAwait(`document.querySelector('.hotseat-option[data-correct="1"]').click()`);
  await s.sleep(150);
  const afterCorrect = await s.evalAwait(`({
    correct: state.hotseat.correct,
    hasCorrectMark: !!document.querySelector('.hotseat-option-correct'),
    hasResolved: !!document.querySelector('.hotseat-resolved'),
    hasContinue: !!document.querySelector('[data-action="hotseat-continue"]')
  })`);
  console.log(afterCorrect.correct >= 1 ? `PASS: state.hotseat.correct ≥ 1 (got ${afterCorrect.correct})` : `FAIL: correct = ${afterCorrect.correct}`);
  console.log(afterCorrect.hasCorrectMark ? 'PASS: correct option marked green' : 'FAIL: no green marker');
  console.log(afterCorrect.hasResolved && afterCorrect.hasContinue ? 'PASS: resolved feedback + Continue rendered' : 'FAIL: post-resolve UI missing');

  // Continue closes modal.
  await s.evalAwait(`document.querySelector('[data-action="hotseat-continue"]').click()`);
  await s.sleep(150);
  console.log(!await s.evalAwait(`!!document.getElementById('hotseat-modal')`) ? 'PASS: Continue closes modal' : 'FAIL: modal persisted');

  // Toggle OFF → next L3 pass should NOT show modal.
  await s.evalAwait(`document.getElementById('hotseat-btn').click()`);
  await s.sleep(100);
  await s.evalAwait(`markPassed('${lessonId}', 'L3')`);
  await s.sleep(600);
  console.log(!await s.evalAwait(`!!document.getElementById('hotseat-modal')`) ? 'PASS: toggle OFF skips modal' : 'FAIL: modal showed with toggle OFF');

  await s.snap('end');
  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
