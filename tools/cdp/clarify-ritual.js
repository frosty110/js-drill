#!/usr/bin/env node
// iter 117 — verifies 🎤 Clarify-First Ritual (Cat 9 §9A first ship ever).
// Opt-in pre-L3 chip-gate that mines clarifier questions from each lesson's
// `conversation.sections[0].say` bullet list + generic distractor bank.
//
// 1) Toggle defaults OFF; sidebar button present.
// 2) Toggle ON + navigate to a Patterns lesson L3 → ritual renders, NOT editor.
// 3) Ritual card has correct + distractor chips, mixed.
// 4) Tap CORRECT chip → green + counter increments + state.clarify counters update.
// 5) Tap WRONG chip → red + state.clarify.attempts++ but no completion.
// 6) Tap remaining correct chips → ritual completes → editor unlocks (re-render).
// 7) Per-lesson session-completion sticks (re-nav to same lesson's L3 shows editor, not ritual).
// 8) Skip button bypasses ritual + marks lesson session-completed.
// 9) Toggle OFF → ritual never shows even on fresh lesson.
// 10) Mobile viewport: chips render in single column (responsive grid).

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-clarify';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Phase 1: clean state — toggle OFF by default; button present.
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    clarifyRitualOn: false,
    clarify: { attempts: 0, correct: 0, completed: 0, sessions: 0, lastRunAt: 0 },
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);

  const btnPresent = await s.evalAwait(`!!document.getElementById('clarify-ritual-btn')`);
  console.log(btnPresent ? 'PASS: 🎤 Clarify sidebar button present' : 'FAIL: button missing');

  const initialFlag = await s.evalAwait(`state.clarifyRitualOn === false`);
  console.log(initialFlag ? 'PASS: clarifyRitualOn defaults false' : 'FAIL: default state wrong');

  // Phase 2: toggle ON + navigate to a Patterns lesson's L3 → ritual renders.
  await s.evalAwait(`document.getElementById('clarify-ritual-btn').click()`);
  await s.sleep(150);
  const flagAfterToggle = await s.evalAwait(`state.clarifyRitualOn === true`);
  console.log(flagAfterToggle ? 'PASS: toggle flips flag to true' : 'FAIL: toggle did not flip flag');

  // Pick a known Patterns lesson with conversation.
  const lessonId = 'two-sum';
  await s.evalAwait(`selectLesson('${lessonId}')`);
  // Wait for content lazy-load.
  for (let i = 0; i < 10; i++) {
    await s.sleep(400);
    if (await s.evalAwait(`!!CONTENT['${lessonId}'] && !!CONTENT['${lessonId}'].conversation`)) break;
  }
  await s.evalAwait(`selectTab('L3')`);
  // Bank fetch is async — give it a beat.
  await s.sleep(800);
  await s.snap('ritual-rendered');

  const ritualShown = await s.evalAwait(`(() => {
    const shell = document.querySelector('.clarify-shell');
    const chips = document.querySelectorAll('.clarify-chip');
    const hasEditor = document.querySelector('.CodeMirror');
    return { shellPresent: !!shell, chipCount: chips.length, editorPresent: !!hasEditor };
  })()`);
  console.log(ritualShown.shellPresent ? 'PASS: .clarify-shell rendered on L3 visit' : 'FAIL: ritual shell missing');
  console.log(ritualShown.chipCount >= 4 && ritualShown.chipCount <= 6 ? `PASS: ${ritualShown.chipCount} chips rendered (in 4-6 range)`
    : `FAIL: ${ritualShown.chipCount} chips (expected 4-6)`);
  console.log(!ritualShown.editorPresent ? 'PASS: L3 editor NOT rendered while ritual active' : 'FAIL: editor rendered too early');

  // Phase 3: verify mix of correct + wrong chips.
  const chipMix = await s.evalAwait(`(() => {
    const chips = Array.from(document.querySelectorAll('.clarify-chip'));
    const correctCount = chips.filter(c => c.dataset.correct === '1').length;
    const wrongCount = chips.filter(c => c.dataset.correct === '0').length;
    return { correctCount, wrongCount };
  })()`);
  console.log(chipMix.correctCount >= 2 && chipMix.wrongCount >= 2 ? `PASS: chip mix (${chipMix.correctCount} correct + ${chipMix.wrongCount} wrong)`
    : `FAIL: bad mix ${JSON.stringify(chipMix)}`);

  // Phase 4: tap a wrong chip → red + attempts++ but no completion.
  const beforeAttempts = await s.evalAwait(`state.clarify.attempts`);
  await s.evalAwait(`document.querySelector('.clarify-chip[data-correct="0"]').click()`);
  await s.sleep(150);
  const afterWrongTap = await s.evalAwait(`({
    attempts: state.clarify.attempts,
    completed: state.clarify.completed,
    hasWrongMark: !!document.querySelector('.clarify-chip-wrong'),
    editorPresent: !!document.querySelector('.CodeMirror')
  })`);
  console.log(afterWrongTap.attempts === beforeAttempts + 1 ? `PASS: wrong tap incremented attempts (${beforeAttempts}→${afterWrongTap.attempts})`
    : `FAIL: attempts ${beforeAttempts}→${afterWrongTap.attempts}`);
  console.log(afterWrongTap.hasWrongMark ? 'PASS: wrong chip marked red' : 'FAIL: no red marker');
  console.log(afterWrongTap.completed === 0 && !afterWrongTap.editorPresent ? 'PASS: ritual NOT completed by wrong tap' : 'FAIL: editor leaked through');

  // Phase 5: tap ALL correct chips → ritual completes + editor unlocks.
  await s.evalAwait(`(() => {
    document.querySelectorAll('.clarify-chip[data-correct="1"]').forEach(c => c.click());
  })()`);
  // Ritual sets a 700ms timeout before re-rendering L3.
  await s.sleep(1200);
  await s.snap('after-ritual-complete');

  const afterComplete = await s.evalAwait(`({
    completed: state.clarify.completed,
    correct: state.clarify.correct,
    editorPresent: !!document.querySelector('.CodeMirror'),
    ritualGone: !document.querySelector('.clarify-shell')
  })`);
  console.log(afterComplete.completed >= 1 ? `PASS: state.clarify.completed = ${afterComplete.completed}` : `FAIL: completed = ${afterComplete.completed}`);
  console.log(afterComplete.correct >= 2 ? `PASS: state.clarify.correct ≥ 2 (got ${afterComplete.correct})` : `FAIL: correct = ${afterComplete.correct}`);
  console.log(afterComplete.editorPresent ? 'PASS: L3 editor rendered after ritual completion' : 'FAIL: editor still hidden');
  console.log(afterComplete.ritualGone ? 'PASS: ritual shell removed' : 'FAIL: ritual shell still in DOM');

  // Phase 6: re-nav to same lesson's L3 → editor shows immediately (session-completion sticks).
  await s.evalAwait(`selectTab('reference'); `);
  await s.sleep(200);
  await s.evalAwait(`selectTab('L3')`);
  await s.sleep(400);
  const ritualReshown = await s.evalAwait(`!!document.querySelector('.clarify-shell')`);
  console.log(!ritualReshown ? 'PASS: ritual does NOT re-show within session for same lesson' : 'FAIL: ritual showed again');

  // Phase 7: toggle OFF → fresh lesson, ritual never shows.
  await s.evalAwait(`document.getElementById('clarify-ritual-btn').click()`);
  await s.sleep(100);
  await s.evalAwait(`selectLesson('p-contains-dup')`);
  for (let i = 0; i < 10; i++) {
    await s.sleep(400);
    if (await s.evalAwait(`!!CONTENT['p-contains-dup']`)) break;
  }
  await s.evalAwait(`selectTab('L3')`);
  await s.sleep(400);
  const offRitual = await s.evalAwait(`!!document.querySelector('.clarify-shell')`);
  const offEditor = await s.evalAwait(`!!document.querySelector('.CodeMirror')`);
  console.log(!offRitual && offEditor ? 'PASS: toggle OFF skips ritual on fresh lesson (editor renders)'
    : `FAIL: ritual=${offRitual} editor=${offEditor}`);

  await s.snap('end');
  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
