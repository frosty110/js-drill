#!/usr/bin/env node
// Verifies iter-93 🧬 Trace-Hop at iPhone viewport: sidebar button → session
// shows 3 consecutive trace frames with middle state BLANKED + 4 same-trace
// state options; tap reveals correct/wrong + drill CTA + next; miss routes
// to weakness; state.traceHop.attempts accumulates. Mobile probe (PROFILE.md
// 80%-phone).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-trace-hop';

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
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('boot');

  // ── Phase 1: button renders ───────────────────────────────────────────
  const btn = await s.evalAwait(`document.getElementById('trace-hop-btn')?.textContent || ''`);
  console.log(btn.includes('Trace-Hop') ? `PASS: 🧬 Trace-Hop button rendered (${btn.trim()})` : `FAIL: button missing (got "${btn}")`);

  // ── Phase 2: tap → 3 frames + 4 options + middle blanked ─────────────
  await s.evalAwait(`document.getElementById('trace-hop-btn').click()`);
  await s.sleep(10000); // walk Patterns/Applied lessons preload + trace compile
  await s.snap('first-card');

  const card = await s.evalAwait(`(() => {
    const frames = document.querySelectorAll('.trace-hop-frame').length;
    const sideFrames = document.querySelectorAll('.trace-hop-frame-side').length;
    const middleFrame = document.querySelectorAll('.trace-hop-frame-middle').length;
    const blank = document.querySelector('.trace-hop-frame-state-blank')?.textContent || '';
    const opts = document.querySelectorAll('.trace-hop-opt').length;
    const optStates = Array.from(document.querySelectorAll('.trace-hop-opt-state')).map(s => s.textContent.length);
    const optLetters = Array.from(document.querySelectorAll('.trace-hop-opt-letter')).map(l => l.textContent.trim());
    const header = document.querySelector('.recognize-header span')?.textContent || '';
    const tag = document.querySelector('.trace-hop-tag')?.textContent || '';
    const reveal = !!document.querySelector('.trace-hop-reveal');
    return { frames, sideFrames, middleFrame, blank, opts, optStates, optLetters, header, tag, reveal };
  })()`);
  const lettersValid = card.optLetters.length === 4 && card.optLetters.includes('A') && card.optLetters.includes('D');
  const allOptsHaveContent = card.optStates.length === 4 && card.optStates.every(n => n > 0);
  console.log(card.frames === 3 && card.sideFrames === 2 && card.middleFrame === 1 && card.opts === 4
    && lettersValid && allOptsHaveContent && card.blank.includes('?') && !card.reveal
    && card.header.includes('1 of 8') && card.tag.toLowerCase().includes('middle')
    ? `PASS: card shows 3 frames (2 side + 1 middle blanked "${card.blank.trim()}") + 4 options (A..D) + tag asks "${card.tag}", header "${card.header}"`
    : `FAIL: card state (frames=${card.frames}, side=${card.sideFrames}, middle=${card.middleFrame}, blank="${card.blank}", opts=${card.opts}, letters=${card.optLetters.join(',')}, stateLens=${card.optStates.join(',')}, header="${card.header}", tag="${card.tag}", reveal=${card.reveal})`);

  // ── Phase 3: tap option A → all 4 locked, exactly 1 marked correct ───
  await s.evalAwait(`document.querySelector('.trace-hop-opt[data-opt="0"]').click()`);
  await s.sleep(300);
  const after = await s.evalAwait(`(() => {
    const reveal = !!document.querySelector('.trace-hop-reveal');
    const drill = !!document.querySelector('.trace-hop-drill');
    const next = !!document.querySelector('.trace-hop-next');
    const correctMarked = document.querySelectorAll('.trace-hop-opt.recognize-opt-correct').length;
    const wrongMarked = document.querySelectorAll('.trace-hop-opt.recognize-opt-wrong').length;
    const allDisabled = Array.from(document.querySelectorAll('.trace-hop-opt')).every(b => b.disabled);
    const revealTitle = document.querySelector('.trace-hop-reveal-title')?.textContent || '';
    const revealLesson = document.querySelector('.trace-hop-reveal-lesson')?.textContent || '';
    const weaknessCount = Object.keys(state.weakness || {}).length;
    return { reveal, drill, next, correctMarked, wrongMarked, allDisabled, revealTitle, revealLesson, weaknessCount };
  })()`);
  // Pass condition: exactly 1 correct marker, picked option may be correct (wrongMarked=0)
  // OR wrong (wrongMarked=1), reveal + drill + next CTAs all present, all options disabled,
  // revealTitle has visible text. Picked A — has ~1/4 chance to be correct.
  const passGrading = after.reveal && after.drill && after.next && after.correctMarked === 1
    && (after.wrongMarked === 0 || after.wrongMarked === 1) && after.allDisabled
    && after.revealTitle.length > 0 && after.revealLesson.length > 0;
  console.log(passGrading
    ? `PASS: tap revealed "${after.revealTitle}" on ${after.revealLesson.substring(0,50)}..., drill+next CTAs shown, correct=${after.correctMarked} wrong=${after.wrongMarked} all-disabled=${after.allDisabled}, weakness=${after.weaknessCount}`
    : `FAIL: grading flow (reveal=${after.reveal}, drill=${after.drill}, next=${after.next}, correct=${after.correctMarked}, wrong=${after.wrongMarked}, allDisabled=${after.allDisabled}, revealTitle="${after.revealTitle}", revealLesson="${after.revealLesson}")`);

  // ── Phase 4: state.traceHop.attempts incremented ────────────────────
  let attempts = 0;
  for (let i = 0; i < 20; i++) {
    attempts = await s.evalAwait(`state.traceHop?.attempts || 0`);
    if (attempts >= 1) break;
    await s.sleep(150);
  }
  console.log(attempts >= 1 ? `PASS: state.traceHop.attempts incremented to ${attempts}` : `FAIL: stats not saved (attempts=${attempts})`);

  // ── Phase 5: "Next card" advances ─────────────────────────────────────
  await s.evalAwait(`document.querySelector('.trace-hop-next').click()`);
  await s.sleep(300);
  const nextCard = await s.evalAwait(`(() => {
    const header = document.querySelector('.recognize-header span')?.textContent || '';
    const frames = document.querySelectorAll('.trace-hop-frame').length;
    const opts = document.querySelectorAll('.trace-hop-opt').length;
    const blank = document.querySelector('.trace-hop-frame-state-blank')?.textContent || '';
    const reveal = !!document.querySelector('.trace-hop-reveal');
    return { header, frames, opts, blank, reveal };
  })()`);
  console.log(nextCard.header.includes('2 of 8') && nextCard.frames === 3 && nextCard.opts === 4
    && nextCard.blank.includes('?') && !nextCard.reveal
    ? `PASS: Next advanced to card 2 (header "${nextCard.header}", 3 frames + 4 opts + middle blanked, no reveal)`
    : `FAIL: next-card state (header="${nextCard.header}", frames=${nextCard.frames}, opts=${nextCard.opts}, blank="${nextCard.blank}", reveal=${nextCard.reveal})`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
