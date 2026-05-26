#!/usr/bin/env node
// Verifies iter-102 🗂 Notes→Lesson Reverse Lookup at iPhone viewport.
// Sidebar 🗂 Locate → 10-card session shows one `reference.notes[]` string
// + 4 lesson-title MC options (1 correct + 3 same-section-preferred
// distractors). Tap reveals correct lesson + drill CTA. Miss routes to
// state.weakness. state.notesLocate.attempts accumulates.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-notes-locate';

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
    notesLocate: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('boot');

  // ── Phase 1: button renders ───────────────────────────────────────────
  const btn = await s.evalAwait(`document.getElementById('notes-locate-btn')?.textContent || ''`);
  console.log(btn.includes('Locate') ? `PASS: 🗂 Locate button rendered (${btn.trim()})` : `FAIL: button missing (got "${btn}")`);

  // ── Phase 2: tap → card with note + 4 lesson-title options ────────────
  await s.evalAwait(`document.getElementById('notes-locate-btn').click()`);
  await s.sleep(8000); // preload + flatten notes + build distractors
  await s.snap('first-card');

  const card = await s.evalAwait(`(() => {
    const tag = document.querySelector('.notes-locate-tag')?.textContent || '';
    const note = document.querySelector('.notes-locate-note')?.textContent || '';
    const opts = document.querySelectorAll('.notes-locate-opt').length;
    const titles = Array.from(document.querySelectorAll('.notes-locate-opt-title')).map(t => t.textContent.trim());
    const sections = Array.from(document.querySelectorAll('.notes-locate-opt-section')).map(s => s.textContent.trim());
    const letters = Array.from(document.querySelectorAll('.notes-locate-opt-letter')).map(l => l.textContent.trim());
    const allDistinct = new Set(titles).size === titles.length;
    const reveal = !!document.querySelector('.notes-locate-reveal');
    const header = document.querySelector('.recognize-header span')?.textContent || '';
    return { tag, noteLen: note.length, opts, titlesLen: titles.length, allDistinct, letters, sectionsLen: sections.length, reveal, header };
  })()`);
  const lettersValid = card.letters.length === 4 && card.letters.includes('A') && card.letters.includes('D');
  console.log(card.noteLen >= 30 && card.opts === 4 && card.titlesLen === 4 && card.allDistinct
    && lettersValid && card.sectionsLen === 4 && !card.reveal
    && card.header.includes('1 of 10') && card.tag.toLowerCase().includes('lesson')
    ? `PASS: card shows note (${card.noteLen} chars) + 4 distinct lesson-titles (A..D) + section sublabels + tag "${card.tag.substring(0,50)}...", header "${card.header}"`
    : `FAIL: card state (noteLen=${card.noteLen}, opts=${card.opts}, titles=${card.titlesLen}, allDistinct=${card.allDistinct}, letters=${card.letters.join(',')}, sections=${card.sectionsLen}, reveal=${card.reveal}, header="${card.header}", tag="${card.tag}")`);

  // ── Phase 3: tap option A → grading flow + exactly 1 correct marker ──
  await s.evalAwait(`document.querySelector('.notes-locate-opt[data-opt="0"]').click()`);
  await s.sleep(300);
  const after = await s.evalAwait(`(() => {
    const reveal = !!document.querySelector('.notes-locate-reveal');
    const drill = !!document.querySelector('.notes-locate-drill');
    const next = !!document.querySelector('.notes-locate-next');
    const correctMarked = document.querySelectorAll('.notes-locate-opt.recognize-opt-correct').length;
    const wrongMarked = document.querySelectorAll('.notes-locate-opt.recognize-opt-wrong').length;
    const allDisabled = Array.from(document.querySelectorAll('.notes-locate-opt')).every(b => b.disabled);
    const revealTitle = document.querySelector('.notes-locate-reveal-title')?.textContent || '';
    const revealSection = document.querySelector('.notes-locate-reveal-section')?.textContent || '';
    const weaknessCount = Object.keys(state.weakness || {}).length;
    return { reveal, drill, next, correctMarked, wrongMarked, allDisabled, revealTitle, revealSection, weaknessCount };
  })()`);
  const passGrading = after.reveal && after.drill && after.next && after.correctMarked === 1
    && (after.wrongMarked === 0 || after.wrongMarked === 1) && after.allDisabled
    && after.revealTitle.length > 0 && after.revealSection.length > 0;
  console.log(passGrading
    ? `PASS: tap revealed "${after.revealTitle.substring(0, 50)}..." on section "${after.revealSection}" + drill+next CTAs + correct=${after.correctMarked} wrong=${after.wrongMarked} all-disabled=${after.allDisabled}, weakness=${after.weaknessCount}`
    : `FAIL: grading flow (reveal=${after.reveal}, drill=${after.drill}, next=${after.next}, correct=${after.correctMarked}, wrong=${after.wrongMarked}, allDisabled=${after.allDisabled}, revealTitle="${after.revealTitle}", revealSection="${after.revealSection}")`);

  // ── Phase 4: state.notesLocate.attempts incremented ──────────────────
  let attempts = 0;
  for (let i = 0; i < 20; i++) {
    attempts = await s.evalAwait(`state.notesLocate?.attempts || 0`);
    if (attempts >= 1) break;
    await s.sleep(150);
  }
  console.log(attempts >= 1 ? `PASS: state.notesLocate.attempts incremented to ${attempts}` : `FAIL: stats not saved (attempts=${attempts})`);

  // ── Phase 5: "Next card" advances ─────────────────────────────────────
  await s.evalAwait(`document.querySelector('.notes-locate-next').click()`);
  await s.sleep(300);
  const next = await s.evalAwait(`(() => {
    const header = document.querySelector('.recognize-header span')?.textContent || '';
    const opts = document.querySelectorAll('.notes-locate-opt').length;
    const reveal = !!document.querySelector('.notes-locate-reveal');
    return { header, opts, reveal };
  })()`);
  console.log(next.header.includes('2 of 10') && next.opts === 4 && !next.reveal
    ? `PASS: Next advanced to card 2 of 10 (4 opts, no reveal)`
    : `FAIL: next-card state (header="${next.header}", opts=${next.opts}, reveal=${next.reveal})`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
