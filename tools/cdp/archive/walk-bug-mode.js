#!/usr/bin/env node
// Verifies iter-78 🪲 Walkthrough Bug-Hunt at iPhone viewport: navigate to a
// patterns lesson's Walkthrough tab → 🪲 Bug button visible alongside 🔮
// Quiz → tap renders step list with tap targets + corruption-reveal on pick.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-walk-bug';

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
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);

  // Navigate directly to two-sum walkthrough via deep-link.
  await s.evalAwait(`location.hash = '#/two-sum/walkthrough'`);
  await s.sleep(1200);
  await s.snap('walkthrough-tab');

  // ── Phase 1: 🪲 Bug button renders alongside 🔮 Quiz ─────────────────
  const bugBtnText = await s.evalAwait(`document.querySelector('[data-walk-bug]')?.textContent || ''`);
  console.log(bugBtnText.includes('Bug') ? `PASS: 🪲 Bug button rendered on Walkthrough (${bugBtnText.trim()})` : `FAIL: Bug button missing (got "${bugBtnText}")`);

  // ── Phase 2: tap Bug button → panel + step list rendered ─────────────
  await s.evalAwait(`document.querySelector('[data-walk-bug]').click()`);
  await s.sleep(400);
  await s.snap('bug-list');

  const panel = await s.evalAwait(`(() => {
    const p = document.querySelector('[data-walk-bug-panel]');
    const rows = document.querySelectorAll('.walk-bug-row').length;
    const hidden = p?.classList.contains('hidden');
    return { open: !hidden, rows };
  })()`);
  console.log(panel.open && panel.rows >= 3 ? `PASS: bug panel open with ${panel.rows} step rows` : `FAIL: panel state (open=${panel.open}, rows=${panel.rows})`);

  // ── Phase 3: tap a row → grade applied + reveal-line appears ─────────
  await s.evalAwait(`document.querySelector('.walk-bug-row:not(.locked)').click()`);
  await s.sleep(300);
  const graded = await s.evalAwait(`(() => {
    const correct = !!document.querySelector('.walk-bug-row.correct');
    const reveal = !!document.querySelector('.walk-bug-reveal');
    const locked = document.querySelectorAll('.walk-bug-row.locked').length;
    return { correct, reveal, locked };
  })()`);
  console.log(graded.correct && graded.reveal && graded.locked >= 3 ? `PASS: tap graded a row, locked all (${graded.locked}), revealed mutation` : `FAIL: grade flow (correct=${graded.correct}, reveal=${graded.reveal}, locked=${graded.locked})`);

  // ── Phase 4: close button restores normal walkthrough ────────────────
  await s.evalAwait(`document.querySelector('[data-walk-bug-close]').click()`);
  await s.sleep(300);
  const restored = await s.evalAwait(`(() => {
    const p = document.querySelector('[data-walk-bug-panel]');
    const stepCounter = document.querySelector('[data-walk-counter]')?.textContent || '';
    return { closed: p?.classList.contains('hidden'), counter: stepCounter };
  })()`);
  console.log(restored.closed && restored.counter.includes('Step') ? `PASS: close button restored normal walkthrough (counter="${restored.counter}")` : `FAIL: close (closed=${restored.closed}, counter="${restored.counter}")`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
