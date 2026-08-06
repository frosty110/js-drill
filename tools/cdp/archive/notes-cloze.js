#!/usr/bin/env node
// Verifies iter-97 📝 Notes Cloze Tap-Drill at iPhone viewport: sidebar button →
// session shows a `reference.notes[]` string with one keyword blanked + 4 MC
// options; tap reveals correct keyword + lesson + drill CTA; miss routes to
// weakness; state.notesDrill.attempts accumulates. Mobile probe (PROFILE.md
// 80%-phone).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-notes-cloze';

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
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('boot');

  // ── Phase 1: button renders ───────────────────────────────────────────
  const btn = await s.evalAwait(`document.getElementById('notes-drill-btn')?.textContent || ''`);
  console.log(btn.includes('Notes') ? `PASS: 📝 Notes button rendered (${btn.trim()})` : `FAIL: button missing (got "${btn}")`);

  // ── Phase 2: tap → card with note + blank + 4 options ─────────────────
  await s.evalAwait(`document.getElementById('notes-drill-btn').click()`);
  await s.sleep(7000); // preload + flatten notes + collect distractors
  await s.snap('first-card');

  const card = await s.evalAwait(`(() => {
    const tag = document.querySelector('.notes-drill-tag')?.textContent || '';
    const note = document.querySelector('.notes-drill-note')?.textContent || '';
    const blank = !!document.querySelector('.notes-drill-blank');
    const blankText = document.querySelector('.notes-drill-blank')?.textContent || '';
    const opts = document.querySelectorAll('.notes-drill-opt').length;
    const optWords = Array.from(document.querySelectorAll('.notes-drill-opt-word')).map(s => s.textContent.trim());
    const letters = Array.from(document.querySelectorAll('.notes-drill-opt-letter')).map(l => l.textContent.trim());
    const reveal = !!document.querySelector('.notes-drill-reveal');
    const header = document.querySelector('.recognize-header span')?.textContent || '';
    return { tag, noteLen: note.length, blank, blankText, opts, optWords, letters, reveal, header };
  })()`);
  const lettersValid = card.letters.length === 4 && card.letters.includes('A') && card.letters.includes('D');
  const allOptsDistinct = new Set(card.optWords.map(w => w.toLowerCase())).size === 4;
  const allOptsMinLen = card.optWords.every(w => w.length >= 4);
  console.log(card.noteLen > 30 && card.blank && card.blankText.includes('___') && card.opts === 4
    && lettersValid && allOptsDistinct && allOptsMinLen && !card.reveal
    && card.header.includes('1 of 12') && card.tag.toLowerCase().includes('blank')
    ? `PASS: card shows note (${card.noteLen} chars) + ___ blank + 4 distinct options (A..D) min-len-4 [${card.optWords.join(', ')}], header "${card.header}"`
    : `FAIL: card state (noteLen=${card.noteLen}, blank=${card.blank}, blankText="${card.blankText}", opts=${card.opts}, letters=${card.letters.join(',')}, optWords=${JSON.stringify(card.optWords)}, allDistinct=${allOptsDistinct}, allMinLen=${allOptsMinLen}, reveal=${card.reveal}, header="${card.header}", tag="${card.tag}")`);

  // ── Phase 3: tap A → grading flow (correct or wrong; exactly one correct marker) ──
  await s.evalAwait(`document.querySelector('.notes-drill-opt[data-opt="0"]').click()`);
  await s.sleep(300);
  const after = await s.evalAwait(`(() => {
    const reveal = !!document.querySelector('.notes-drill-reveal');
    const drill = !!document.querySelector('.notes-drill-drill');
    const next = !!document.querySelector('.notes-drill-next');
    const correctMarked = document.querySelectorAll('.notes-drill-opt.recognize-opt-correct').length;
    const wrongMarked = document.querySelectorAll('.notes-drill-opt.recognize-opt-wrong').length;
    const allDisabled = Array.from(document.querySelectorAll('.notes-drill-opt')).every(b => b.disabled);
    const revealFull = document.querySelector('.notes-drill-reveal-full')?.textContent || '';
    const revealLesson = document.querySelector('.notes-drill-reveal-lesson')?.textContent || '';
    const weaknessCount = Object.keys(state.weakness || {}).length;
    return { reveal, drill, next, correctMarked, wrongMarked, allDisabled, revealFull, revealLesson, weaknessCount };
  })()`);
  const passGrading = after.reveal && after.drill && after.next && after.correctMarked === 1
    && (after.wrongMarked === 0 || after.wrongMarked === 1) && after.allDisabled
    && after.revealFull.length > 0 && after.revealLesson.length > 0;
  console.log(passGrading
    ? `PASS: tap revealed full note + lesson "${after.revealLesson.substring(0, 40)}..." + drill+next CTAs, correct=${after.correctMarked} wrong=${after.wrongMarked} all-disabled=${after.allDisabled}, weakness=${after.weaknessCount}`
    : `FAIL: grading flow (reveal=${after.reveal}, drill=${after.drill}, next=${after.next}, correct=${after.correctMarked}, wrong=${after.wrongMarked}, allDisabled=${after.allDisabled}, revealFull="${after.revealFull.substring(0,60)}", revealLesson="${after.revealLesson}")`);

  // ── Phase 4: state.notesDrill.attempts incremented ───────────────────
  let attempts = 0;
  for (let i = 0; i < 20; i++) {
    attempts = await s.evalAwait(`state.notesDrill?.attempts || 0`);
    if (attempts >= 1) break;
    await s.sleep(150);
  }
  console.log(attempts >= 1 ? `PASS: state.notesDrill.attempts incremented to ${attempts}` : `FAIL: stats not saved (attempts=${attempts})`);

  // ── Phase 5: "Next card" advances ─────────────────────────────────────
  await s.evalAwait(`document.querySelector('.notes-drill-next').click()`);
  await s.sleep(300);
  const next = await s.evalAwait(`(() => {
    const header = document.querySelector('.recognize-header span')?.textContent || '';
    const opts = document.querySelectorAll('.notes-drill-opt').length;
    const blank = !!document.querySelector('.notes-drill-blank');
    const reveal = !!document.querySelector('.notes-drill-reveal');
    return { header, opts, blank, reveal };
  })()`);
  console.log(next.header.includes('2 of 12') && next.opts === 4 && next.blank && !next.reveal
    ? `PASS: Next advanced to card 2 (header "${next.header}", 4 opts + blank, no reveal)`
    : `FAIL: next-card state (header="${next.header}", opts=${next.opts}, blank=${next.blank}, reveal=${next.reveal})`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
