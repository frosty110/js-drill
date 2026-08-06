#!/usr/bin/env node
// Verifies iter-98 🪐 Mechanic Constellation at iPhone viewport: sidebar
// button → session shows 1 mechanic + 6 lesson options (3 tagged + 3 not).
// User taps 3; per-tap immediate feedback (correct=green ✓, wrong=red ✗).
// After 3 picks, reveal marks any missed tagged lessons with ⊙ + Next CTA.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-constellation';

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
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('boot');

  // ── Phase 1: button renders ───────────────────────────────────────────
  const btn = await s.evalAwait(`document.getElementById('constellation-btn')?.textContent || ''`);
  console.log(btn.includes('Constellation') ? `PASS: 🪐 Constellation button rendered (${btn.trim()})` : `FAIL: button missing (got "${btn}")`);

  // ── Phase 2: tap → card with 1 mechanic + 6 options + counter ─────────
  await s.evalAwait(`document.getElementById('constellation-btn').click()`);
  await s.sleep(9000); // ensureMechanicIndex → ensureAllContentLoaded is heavy
  await s.snap('first-card');

  const card = await s.evalAwait(`(() => {
    const mech = document.querySelector('.constellation-mech-label')?.textContent || '';
    const tag = document.querySelector('.constellation-tag')?.textContent || '';
    const counter = document.querySelector('.constellation-counter')?.textContent || '';
    const opts = document.querySelectorAll('.constellation-opt').length;
    const titles = Array.from(document.querySelectorAll('.constellation-opt-title')).map(t => t.textContent);
    const allDistinct = new Set(titles).size === 6;
    const reveal = !!document.querySelector('.constellation-reveal');
    const header = document.querySelector('.recognize-header span')?.textContent || '';
    return { mech, tag, counter, opts, titlesLen: titles.length, allDistinct, reveal, header };
  })()`);
  console.log(card.mech.length > 0 && card.opts === 6 && card.allDistinct && !card.reveal
    && card.header.includes('1 of 10') && card.counter.includes('/ 3') && card.tag.toLowerCase().includes('pick')
    ? `PASS: card shows mechanic "${card.mech}" + 6 distinct lesson options + counter "${card.counter.trim()}" + tag "${card.tag.substring(0,40)}...", header "${card.header}"`
    : `FAIL: card state (mech="${card.mech}", opts=${card.opts}, allDistinct=${card.allDistinct}, counter="${card.counter}", header="${card.header}", tag="${card.tag}", reveal=${card.reveal})`);

  // ── Phase 3: tap 3 options → per-tap feedback + counter increments ───
  // Tap first 3 in DOM order to drive the picks.
  for (let i = 0; i < 3; i++) {
    await s.evalAwait(`document.querySelector('.constellation-opt[data-opt="${i}"]').click()`);
    await s.sleep(150);
  }
  await s.sleep(300);
  await s.snap('post-picks');
  const after = await s.evalAwait(`(() => {
    const correctMarked = document.querySelectorAll('.constellation-opt.recognize-opt-correct').length;
    const wrongMarked = document.querySelectorAll('.constellation-opt.recognize-opt-wrong').length;
    const missedMarked = document.querySelectorAll('.constellation-opt.constellation-opt-missed').length;
    const allDisabled = Array.from(document.querySelectorAll('.constellation-opt')).every(b => b.disabled);
    const reveal = !!document.querySelector('.constellation-reveal');
    const score = document.querySelector('.constellation-reveal-score')?.textContent || '';
    const next = !!document.querySelector('.constellation-next');
    const totalCommitted = correctMarked + wrongMarked;
    return { correctMarked, wrongMarked, missedMarked, allDisabled, reveal, score, next, totalCommitted };
  })()`);
  // Exactly 3 picks committed. correctMarked + wrongMarked = 3. missedMarked
  // equals (3 actual correct - correctMarked) — i.e. number of correct
  // options the user didn't pick. allDisabled true. reveal block shown.
  const passPicks = after.totalCommitted === 3 && after.allDisabled
    && after.reveal && after.next && after.score.length > 0
    && (after.correctMarked + after.missedMarked === 3);
  console.log(passPicks
    ? `PASS: 3 picks committed (${after.correctMarked} correct + ${after.wrongMarked} wrong); ${after.missedMarked} tagged lessons missed (⊙); reveal score "${after.score}"; all-disabled=${after.allDisabled}`
    : `FAIL: picks flow (committed=${after.totalCommitted}, correct=${after.correctMarked}, wrong=${after.wrongMarked}, missed=${after.missedMarked}, allDisabled=${after.allDisabled}, reveal=${after.reveal}, score="${after.score}")`);

  // ── Phase 4: state.mechConstellation.attempts incremented to 3 ───────
  let attempts = 0;
  for (let i = 0; i < 20; i++) {
    attempts = await s.evalAwait(`state.mechConstellation?.attempts || 0`);
    if (attempts >= 3) break;
    await s.sleep(150);
  }
  console.log(attempts === 3 ? `PASS: state.mechConstellation.attempts = ${attempts} (one increment per tap)` : `FAIL: stats (attempts=${attempts}, expected 3)`);

  // ── Phase 5: "Next card" advances ─────────────────────────────────────
  await s.evalAwait(`document.querySelector('.constellation-next').click()`);
  await s.sleep(300);
  const next = await s.evalAwait(`(() => {
    const header = document.querySelector('.recognize-header span')?.textContent || '';
    const opts = document.querySelectorAll('.constellation-opt').length;
    const reveal = !!document.querySelector('.constellation-reveal');
    const counter = document.querySelector('.constellation-counter')?.textContent || '';
    return { header, opts, reveal, counter };
  })()`);
  console.log(next.header.includes('2 of 10') && next.opts === 6 && !next.reveal && next.counter.includes('0')
    ? `PASS: Next advanced to card 2 of 10 (6 opts + counter reset "${next.counter.trim()}", no reveal)`
    : `FAIL: next-card state (header="${next.header}", opts=${next.opts}, reveal=${next.reveal}, counter="${next.counter}")`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
