#!/usr/bin/env node
// Verifies iter-83 🎰 Gotcha Roulette at iPhone viewport: sidebar button →
// session shows note + 2 buttons + hidden title; tap reveals lesson title +
// "Drill this" CTA; misses route to weakness; lifetime stats accumulate.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-gotcha';

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
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('boot');

  // ── Phase 1: button renders ───────────────────────────────────────────
  const btn = await s.evalAwait(`document.getElementById('gotcha-btn')?.textContent || ''`);
  console.log(btn.includes('Gotcha') ? `PASS: 🎰 Gotcha button rendered (${btn.trim()})` : `FAIL: button missing (got "${btn}")`);

  // ── Phase 2: tap → card with note + 2 options + lesson title HIDDEN ──
  await s.evalAwait(`document.getElementById('gotcha-btn').click()`);
  await s.sleep(6000); // preload ~30 lessons + flatten notes
  await s.snap('first-card');

  const card = await s.evalAwait(`(() => {
    const note = document.querySelector('.gotcha-note')?.textContent || '';
    const tag = document.querySelector('.gotcha-tag')?.textContent || '';
    const opts = document.querySelectorAll('.gotcha-opt').length;
    const reveal = !!document.querySelector('.gotcha-reveal');
    return { noteLen: note.length, tag, opts, reveal };
  })()`);
  console.log(card.noteLen > 20 && card.opts === 2 && card.tag.includes('???') && !card.reveal ? `PASS: card shows note (${card.noteLen} chars) + 2 options + lesson HIDDEN ("${card.tag}")` : `FAIL: card state (noteLen=${card.noteLen}, opts=${card.opts}, tag="${card.tag}", reveal=${card.reveal})`);

  // ── Phase 3: tap "Didn't" → reveal appears + weakness incremented ────
  await s.evalAwait(`document.querySelector('.gotcha-opt[data-pick="didnt"]').click()`);
  await s.sleep(250);
  const after = await s.evalAwait(`(() => {
    const reveal = document.querySelector('.gotcha-reveal');
    const drill = document.querySelector('.gotcha-drill');
    const next = document.querySelector('.gotcha-next');
    const weaknessCount = Object.keys(state.weakness || {}).length;
    return { reveal: !!reveal, hasDrill: !!drill, hasNext: !!next, weaknessCount };
  })()`);
  console.log(after.reveal && after.hasDrill && after.hasNext && after.weaknessCount >= 1 ? `PASS: "Didn't" tap revealed lesson + drill CTA + next button, weakness flagged (${after.weaknessCount} entries)` : `FAIL: reveal flow (reveal=${after.reveal}, drill=${after.hasDrill}, next=${after.hasNext}, weakness=${after.weaknessCount})`);

  // ── Phase 4: state.gotcha.attempts incremented ────────────────────────
  let attempts = 0;
  for (let i = 0; i < 20; i++) {
    attempts = await s.evalAwait(`state.gotcha?.attempts || 0`);
    if (attempts >= 1) break;
    await s.sleep(150);
  }
  console.log(attempts >= 1 ? `PASS: state.gotcha.attempts incremented to ${attempts}` : `FAIL: stats not saved (attempts=${attempts})`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
