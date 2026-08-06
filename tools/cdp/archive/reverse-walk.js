#!/usr/bin/env node
// Verifies iter-99 ⏪ Reverse-Walkthrough at iPhone viewport. Each card
// shows the FINAL state of one walkthrough example + 3 input options (all
// 3 examples from the same lesson); user taps which input produced this
// final state. 3-option MC (empirical: ALL 99 Patterns/Applied lessons
// have exactly 3 walkthrough examples per iter-99 feasibility scan).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-reverse-walk';

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
    speedrun: { bests: {}, sessions: 0, completions: 0, lastRunAt: 0 },
    bugHunt: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    crystal: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    claim: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    gotcha: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    swapBench: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    convDrill: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    traceHop: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    notesDrill: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    mechConstellation: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    reverseWalk: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('boot');

  // ── Phase 1: button renders ───────────────────────────────────────────
  const btn = await s.evalAwait(`document.getElementById('reverse-walk-btn')?.textContent || ''`);
  console.log(btn.includes('Reverse-Walk') ? `PASS: ⏪ Reverse-Walk button rendered (${btn.trim()})` : `FAIL: button missing (got "${btn}")`);

  // ── Phase 2: tap → card with final state + 3 input options ────────────
  await s.evalAwait(`document.getElementById('reverse-walk-btn').click()`);
  await s.sleep(10000); // walkthrough preload + trace compile
  await s.snap('first-card');

  const card = await s.evalAwait(`(() => {
    const lessonTag = document.querySelector('.reverse-walk-lesson-tag')?.textContent || '';
    const tag = document.querySelector('.reverse-walk-tag')?.textContent || '';
    const finalHead = document.querySelector('.reverse-walk-final-head')?.textContent || '';
    const stateRows = document.querySelectorAll('.reverse-walk-state-row').length;
    const opts = document.querySelectorAll('.reverse-walk-opt').length;
    const optInputs = Array.from(document.querySelectorAll('.reverse-walk-opt-input')).map(el => el.textContent.trim());
    const letters = Array.from(document.querySelectorAll('.reverse-walk-opt-letter')).map(el => el.textContent.trim());
    const allDistinct = new Set(optInputs).size === optInputs.length;
    const reveal = !!document.querySelector('.reverse-walk-reveal');
    const header = document.querySelector('.recognize-header span')?.textContent || '';
    return { lessonTag, tag, finalHead, stateRows, opts, optInputs, letters, allDistinct, reveal, header };
  })()`);
  const lettersValid = card.letters.length === 3 && card.letters.includes('A') && card.letters.includes('C');
  console.log(card.opts === 3 && card.lessonTag.length > 0 && card.tag.toLowerCase().includes('input')
    && card.finalHead.toLowerCase().includes('final') && card.stateRows >= 1
    && lettersValid && card.allDistinct && !card.reveal
    && card.header.includes('1 of 8')
    ? `PASS: card shows final-state (${card.stateRows} state rows) + 3 distinct input options (A,B,C) on lesson "${card.lessonTag.substring(0,40)}...", header "${card.header}"`
    : `FAIL: card state (lessonTag="${card.lessonTag}", tag="${card.tag}", finalHead="${card.finalHead}", stateRows=${card.stateRows}, opts=${card.opts}, letters=${card.letters.join(',')}, allDistinct=${card.allDistinct}, header="${card.header}", reveal=${card.reveal})`);

  // ── Phase 3: tap option A → grading flow + exactly 1 correct marker ──
  await s.evalAwait(`document.querySelector('.reverse-walk-opt[data-opt="0"]').click()`);
  await s.sleep(300);
  const after = await s.evalAwait(`(() => {
    const reveal = !!document.querySelector('.reverse-walk-reveal');
    const drill = !!document.querySelector('.reverse-walk-drill');
    const next = !!document.querySelector('.reverse-walk-next');
    const correctMarked = document.querySelectorAll('.reverse-walk-opt.recognize-opt-correct').length;
    const wrongMarked = document.querySelectorAll('.reverse-walk-opt.recognize-opt-wrong').length;
    const allDisabled = Array.from(document.querySelectorAll('.reverse-walk-opt')).every(b => b.disabled);
    const revealTitle = document.querySelector('.reverse-walk-reveal-title')?.textContent || '';
    const revealLabel = document.querySelector('.reverse-walk-reveal-label')?.textContent || '';
    const weaknessCount = Object.keys(state.weakness || {}).length;
    return { reveal, drill, next, correctMarked, wrongMarked, allDisabled, revealTitle, revealLabel, weaknessCount };
  })()`);
  const passGrading = after.reveal && after.drill && after.next && after.correctMarked === 1
    && (after.wrongMarked === 0 || after.wrongMarked === 1) && after.allDisabled
    && after.revealTitle.length > 0 && after.revealLabel.length > 0;
  console.log(passGrading
    ? `PASS: tap revealed "${after.revealTitle}" on label "${after.revealLabel.substring(0, 40)}..." + drill+next CTAs + correct=${after.correctMarked} wrong=${after.wrongMarked} all-disabled=${after.allDisabled}, weakness=${after.weaknessCount}`
    : `FAIL: grading flow (reveal=${after.reveal}, drill=${after.drill}, next=${after.next}, correct=${after.correctMarked}, wrong=${after.wrongMarked}, allDisabled=${after.allDisabled}, revealTitle="${after.revealTitle}", revealLabel="${after.revealLabel}")`);

  // ── Phase 4: state.reverseWalk.attempts incremented ──────────────────
  let attempts = 0;
  for (let i = 0; i < 20; i++) {
    attempts = await s.evalAwait(`state.reverseWalk?.attempts || 0`);
    if (attempts >= 1) break;
    await s.sleep(150);
  }
  console.log(attempts >= 1 ? `PASS: state.reverseWalk.attempts incremented to ${attempts}` : `FAIL: stats not saved (attempts=${attempts})`);

  // ── Phase 5: "Next card" advances ─────────────────────────────────────
  await s.evalAwait(`document.querySelector('.reverse-walk-next').click()`);
  await s.sleep(300);
  const next = await s.evalAwait(`(() => {
    const header = document.querySelector('.recognize-header span')?.textContent || '';
    const opts = document.querySelectorAll('.reverse-walk-opt').length;
    const reveal = !!document.querySelector('.reverse-walk-reveal');
    const finalHead = document.querySelector('.reverse-walk-final-head')?.textContent || '';
    return { header, opts, reveal, finalHead };
  })()`);
  console.log(next.header.includes('2 of 8') && next.opts === 3 && !next.reveal && next.finalHead.toLowerCase().includes('final')
    ? `PASS: Next advanced to card 2 of 8 (3 opts + final-state header, no reveal)`
    : `FAIL: next-card state (header="${next.header}", opts=${next.opts}, reveal=${next.reveal}, finalHead="${next.finalHead}")`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
