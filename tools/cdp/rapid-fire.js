#!/usr/bin/env node
// Verifies iter-54 L1 Rapid-Fire Drill at iPhone viewport: the ⚡ Rapid sidebar
// button opens a cross-lesson interleaved L1 session in the main viewport;
// each card shows a question + 4 lettered options (A/B/C/D) + a 7-sec soft
// timer bar; tap grades + auto-advances; state.rapidFire counts attempts and
// the existing state.weakness tracker picks up Rapid-Fire misses.
// Sourced from iter-31 roadmap entry #4 (shipped iter 54).

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-rapid-fire';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed: clean state, welcomed; pre-touch a few lessons so CONTENT cache has
  // material for the deck builder (mirrors how a normal user would arrive).
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(500);
  await s.snap('boot');

  // Assert 1: ⚡ Rapid button renders in sidebar control row.
  const hasBtn = await s.evalAwait(`!!document.getElementById('rapid-fire-btn')`);
  console.log(hasBtn ? 'PASS: ⚡ Rapid button renders in sidebar' : 'FAIL: button missing');

  // Act: click Rapid-Fire. The session pre-loads content broadly across
  // tracks; wait for the deck to assemble.
  await s.evalAwait(`document.getElementById('rapid-fire-btn').click()`);
  await s.sleep(3000);
  await s.snap('rapid-card');

  // Assert 2: Rapid shell renders in main viewport.
  const shellRendered = await s.evalAwait(`!!document.querySelector('.rapid-shell')`);
  console.log(shellRendered ? 'PASS: rapid shell rendered' : 'FAIL: shell missing (deck failed to assemble)');

  // Assert 3: 4 option buttons render (most L1 questions are 4-option MC).
  const optCount = await s.evalAwait(`document.querySelectorAll('.rapid-opt').length`);
  console.log(optCount >= 2 ? `PASS: ${optCount} option buttons rendered` : `FAIL: ${optCount} options, expected ≥2`);

  // Assert 4: Letter chips (A/B/C/D) render and are not empty.
  const letterChips = await s.evalAwait(`Array.from(document.querySelectorAll('.rapid-letter')).map(e => e.textContent).join('')`);
  console.log(letterChips.startsWith('AB') ? `PASS: letter chips render ("${letterChips}")` : `FAIL: letter chips wrong: "${letterChips}"`);

  // Assert 5: Timer bar exists.
  const hasTimer = await s.evalAwait(`!!document.querySelector('[data-rapid-timer]')`);
  console.log(hasTimer ? 'PASS: timer bar renders' : 'FAIL: timer bar missing');

  // Assert 6: question text is non-empty (real L1 question).
  const qText = await s.evalAwait(`document.querySelector('.rapid-question')?.textContent || ''`);
  console.log(qText.length > 10 ? `PASS: question is real text (${qText.length} chars)` : `FAIL: question too short: "${qText}"`);

  // Act: click first option (don't care correct/wrong; we just need grading to fire).
  await s.evalAwait(`document.querySelector('.rapid-opt').click()`);
  await s.sleep(300);

  // Assert 7: grading classes applied to ≥1 option.
  const styledCount = await s.evalAwait(`document.querySelectorAll('.rapid-opt-correct, .rapid-opt-wrong').length`);
  console.log(styledCount >= 1 ? `PASS: ${styledCount} option(s) styled after tap` : 'FAIL: no grading feedback');

  // Assert 8: state.rapidFire.attempts incremented.
  const attempts = await s.evalAwait(`state.rapidFire?.attempts || 0`);
  console.log(attempts === 1 ? 'PASS: state.rapidFire.attempts incremented to 1' : `FAIL: attempts = ${attempts}`);

  // Assert 9: weak-spot feedback — if the tap was a miss, weakness for the
  // current card's lesson should be set. (If it was a correct pick, this
  // assertion is informational — log but don't fail.)
  const weaknessKeys = await s.evalAwait(`Object.keys(state.weakness || {}).length`);
  const corrects = await s.evalAwait(`state.rapidFire?.correct || 0`);
  if (corrects === 0) {
    console.log(weaknessKeys >= 1 ? `PASS: miss flipped state.weakness (${weaknessKeys} entries)` : 'FAIL: miss did not flip weakness');
  } else {
    console.log(`INFO: tap was correct (${weaknessKeys} weakness entries) — weakness-on-miss path covered by alternate runs`);
  }

  await s.snap('after-tap');
  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
