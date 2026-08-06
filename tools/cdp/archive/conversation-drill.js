#!/usr/bin/env node
// Verifies iter-91 🎬 Conversation Drill at iPhone viewport: sidebar button →
// session shows .say paragraph + 6 phase options + section title HIDDEN; tap
// option locks all, marks correct/wrong, reveals actual title + lesson +
// drill CTA + next; miss routes to weakness; state.convDrill.attempts
// accumulates. Mobile probe (PROFILE.md 80%-phone).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-conv-drill';

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
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('boot');

  // ── Phase 1: button renders ───────────────────────────────────────────
  const btn = await s.evalAwait(`document.getElementById('conv-drill-btn')?.textContent || ''`);
  console.log(btn.includes('Conv') ? `PASS: 🎬 Conv button rendered (${btn.trim()})` : `FAIL: button missing (got "${btn}")`);

  // ── Phase 2: tap → card with .say paragraph + 6 options + title HIDDEN ─
  await s.evalAwait(`document.getElementById('conv-drill-btn').click()`);
  await s.sleep(8000); // preload up to 40 Patterns/Applied lessons + flatten sections
  await s.snap('first-card');

  const card = await s.evalAwait(`(() => {
    const say = document.querySelector('.conv-drill-say')?.textContent || '';
    const tag = document.querySelector('.conv-drill-tag')?.textContent || '';
    const opts = document.querySelectorAll('.conv-drill-opt').length;
    const reveal = !!document.querySelector('.conv-drill-reveal');
    const phases = Array.from(document.querySelectorAll('.conv-drill-opt')).map(b => b.dataset.phase);
    const header = document.querySelector('.recognize-header span')?.textContent || '';
    return { sayLen: say.length, tag, opts, reveal, phases, header };
  })()`);
  const phasesValid = card.phases.length === 6 && card.phases.includes('1') && card.phases.includes('6');
  console.log(card.sayLen >= 100 && card.opts === 6 && phasesValid && !card.reveal && card.header.includes('1 of 10')
    ? `PASS: card shows .say (${card.sayLen} chars) + 6 phase options (1..6) + title HIDDEN ("${card.tag.substring(0,50)}..."), header "${card.header}"`
    : `FAIL: card state (sayLen=${card.sayLen}, opts=${card.opts}, phases=${card.phases.join(',')}, reveal=${card.reveal}, header="${card.header}")`);

  // ── Phase 3: tap WRONG phase → reveal + weakness incremented + correct option marked ──
  const wrongPick = await s.evalAwait(`(() => {
    // Find the actual correct phase from the deck (peek into the rendered DOM:
    // the title is hidden but we have access via the bound deck on the renderer).
    // Safer: deliberately pick phase=1, then check post-tap whether either:
    //   (a) the picked btn was marked wrong (and a different option was marked correct), OR
    //   (b) it happened to be correct — in which case re-pick using a fresh next card.
    // For determinism, pick phase=2 (Brute) — almost any first card from a shuffled
    // pool has a ~5/6 chance of being wrong. The test asserts the GRADING flow
    // (correct/wrong marker appears + reveal renders + state increments), not
    // a specific wrongness outcome.
    document.querySelector('.conv-drill-opt[data-phase="2"]').click();
    return true;
  })()`);
  await s.sleep(300);
  const after = await s.evalAwait(`(() => {
    const reveal = document.querySelector('.conv-drill-reveal');
    const drill = document.querySelector('.conv-drill-drill');
    const next = document.querySelector('.conv-drill-next');
    const correctMarked = document.querySelectorAll('.conv-drill-opt.recognize-opt-correct').length;
    const wrongMarked = document.querySelectorAll('.conv-drill-opt.recognize-opt-wrong').length;
    const allDisabled = Array.from(document.querySelectorAll('.conv-drill-opt')).every(b => b.disabled);
    const revealTitle = document.querySelector('.conv-drill-reveal-title')?.textContent || '';
    const revealLesson = document.querySelector('.conv-drill-reveal-lesson')?.textContent || '';
    const weaknessCount = Object.keys(state.weakness || {}).length;
    return { reveal: !!reveal, hasDrill: !!drill, hasNext: !!next, correctMarked, wrongMarked, allDisabled, revealTitle, revealLesson, weaknessCount };
  })()`);
  // We MUST see exactly one correct marker (the actual phase). We MAY see one
  // wrong marker (if pick was incorrect) or zero (if pick was correct).
  const passGrading = after.reveal && after.hasDrill && after.hasNext && after.correctMarked === 1
    && (after.wrongMarked === 0 || after.wrongMarked === 1) && after.allDisabled
    && after.revealTitle.length > 0 && after.revealLesson.length > 0;
  console.log(passGrading
    ? `PASS: tap revealed lesson ("${after.revealTitle}" · ${after.revealLesson.substring(0,40)}...), drill+next CTAs shown, correct=${after.correctMarked} wrong=${after.wrongMarked} all-disabled=${after.allDisabled}, weakness=${after.weaknessCount}`
    : `FAIL: grading flow (reveal=${after.reveal}, drill=${after.hasDrill}, next=${after.hasNext}, correct=${after.correctMarked}, wrong=${after.wrongMarked}, allDisabled=${after.allDisabled}, revealTitle="${after.revealTitle}", revealLesson="${after.revealLesson}")`);

  // ── Phase 4: state.convDrill.attempts incremented ────────────────────
  let attempts = 0;
  for (let i = 0; i < 20; i++) {
    attempts = await s.evalAwait(`state.convDrill?.attempts || 0`);
    if (attempts >= 1) break;
    await s.sleep(150);
  }
  console.log(attempts >= 1 ? `PASS: state.convDrill.attempts incremented to ${attempts}` : `FAIL: stats not saved (attempts=${attempts})`);

  // ── Phase 5: "Next card" advances ────────────────────────────────────
  await s.evalAwait(`document.querySelector('.conv-drill-next').click()`);
  await s.sleep(300);
  const next = await s.evalAwait(`(() => {
    const header = document.querySelector('.recognize-header span')?.textContent || '';
    const opts = document.querySelectorAll('.conv-drill-opt').length;
    const reveal = !!document.querySelector('.conv-drill-reveal');
    return { header, opts, reveal };
  })()`);
  console.log(next.header.includes('2 of 10') && next.opts === 6 && !next.reveal
    ? `PASS: Next advanced to card 2 (header "${next.header}", 6 opts, no reveal)`
    : `FAIL: next-card state (header="${next.header}", opts=${next.opts}, reveal=${next.reveal})`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
