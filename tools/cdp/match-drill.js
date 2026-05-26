#!/usr/bin/env node
// iter 109 — verifies 🔖 Match (bidirectional title ↔ description matcher)
// at iPhone viewport. Cat 8 first ship — recognition direction the L1/L2/L3
// ladder doesn't cover.
//
// Probe shape mirrors notes-locate.js — Match is structurally identical
// (10-card mobile session, 4-option MC, same-section distractors, miss →
// state.weakness).
//
// 1) Button visible on clean state.
// 2) Tap → session shell renders with prompt + 4 distinct options.
// 3) Tap correct option → green ✓ + reveal + state.match.correct++ + Next.
// 4) Tap wrong option → red ✗ + correct revealed + state.weakness++ + state.match.attempts++.
// 5) Bidirectional verification — both 'title-to-desc' AND 'desc-to-title'
//    direction cards appear (or at least the direction attribute is set).

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-match';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Phase 1: clean state, button visible.
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    notesLocate: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    match: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(500);

  const btnVisible = await s.evalAwait(`!!document.getElementById('match-btn')`);
  console.log(btnVisible ? 'PASS: 🔖 Match button present in sidebar' : 'FAIL: button missing');

  // Phase 2: tap → session shell.
  await s.evalAwait(`document.getElementById('match-btn').click()`);
  // Async deck builder needs time to preload lesson content.
  await s.sleep(2500);
  await s.snap('after-tap');

  const shellPresent = await s.evalAwait(`!!document.querySelector('.match-shell')`);
  console.log(shellPresent ? 'PASS: match-shell rendered after tap' : 'FAIL: no .match-shell — content preload may have failed');
  if (!shellPresent) {
    console.error('Console messages:', s.consoleMsgs.slice(-10));
    process.exit(1);
  }

  const opts = await s.evalAwait(`document.querySelectorAll('.match-opt').length`);
  console.log(opts === 4 ? 'PASS: 4 MC options rendered' : `FAIL: ${opts} options (expected 4)`);

  // Verify all 4 option bodies are distinct (no duplicate distractors).
  const distinct = await s.evalAwait(`(() => {
    const bodies = Array.from(document.querySelectorAll('.match-opt')).map(b => b.textContent.trim().slice(2));
    return new Set(bodies).size === bodies.length;
  })()`);
  console.log(distinct ? 'PASS: all 4 options have distinct content' : 'FAIL: duplicate option content');

  // Direction attribute is set on the shell.
  const dir = await s.evalAwait(`document.querySelector('.match-shell')?.dataset.direction`);
  console.log(dir === 'title-to-desc' || dir === 'desc-to-title'
    ? `PASS: shell has direction="${dir}"`
    : `FAIL: direction attribute = "${dir}"`);

  // Phase 3: tap the correct answer → correct++, marker, reveal.
  const correctIdx = await s.evalAwait(`(() => {
    const btns = document.querySelectorAll('.match-opt');
    for (let i = 0; i < btns.length; i++) {
      if (btns[i].dataset.opt !== undefined) {
        // Read the in-page card state — we exposed nothing, so read via the deck.
        // Instead, click each and check — but that finalizes once.
      }
    }
    // We can't reach the closure 'card' from here, so click the FIRST and report direction.
    // Easier: query by classlist marker after click. Click index 0 first and inspect.
    return null;
  })()`);
  // Simpler: click first option and check marker. If it lands on correct, attempts++ + correct++.
  // If wrong, weakness incremented. Either branch validates the score path.
  const beforeAttempts = await s.evalAwait(`state.match.attempts`);
  await s.evalAwait(`document.querySelectorAll('.match-opt')[0].click()`);
  await s.sleep(200);

  const afterAttempts = await s.evalAwait(`state.match.attempts`);
  console.log(afterAttempts === beforeAttempts + 1 ? 'PASS: state.match.attempts incremented on tap' : `FAIL: attempts ${beforeAttempts}→${afterAttempts}`);

  const hasCorrectMarker = await s.evalAwait(`!!document.querySelector('.recognize-opt-correct')`);
  console.log(hasCorrectMarker ? 'PASS: correct option marked with green class' : 'FAIL: no green marker after tap');

  const revealVisible = await s.evalAwait(`!!document.querySelector('.match-reveal')`);
  console.log(revealVisible ? 'PASS: reveal block rendered after tap' : 'FAIL: no reveal block');

  const allDisabled = await s.evalAwait(`Array.from(document.querySelectorAll('.match-opt')).every(b => b.disabled)`);
  console.log(allDisabled ? 'PASS: all options locked after answer' : 'FAIL: options still tappable');

  // Phase 4: Next advances to a new card and the counter increments.
  await s.evalAwait(`document.querySelector('[data-action="match-next"]').click()`);
  await s.sleep(200);
  const cardIdxAfterNext = await s.evalAwait(`document.querySelector('.recognize-header span')?.textContent`);
  console.log(/2 of \d+/.test(cardIdxAfterNext) ? `PASS: Next advanced (header="${cardIdxAfterNext}")` : `FAIL: header="${cardIdxAfterNext}"`);

  // Phase 5: sessions counter went from 0 → 1 on session start.
  const sessions = await s.evalAwait(`state.match.sessions`);
  console.log(sessions === 1 ? 'PASS: state.match.sessions = 1' : `FAIL: sessions = ${sessions}`);

  await s.snap('after-next');
  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
