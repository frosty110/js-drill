#!/usr/bin/env node
// Verifies iter-79 📐 Smell-Test Complexity-Claim drill at iPhone viewport:
// sidebar button → session loads curated claims, shows canonical + claimed
// complexity + 2 buttons (✓ Correct / ✗ Wrong); tap reveals actual + note.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-claim';

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
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('boot');

  // ── Phase 1: button renders ───────────────────────────────────────────
  const btn = await s.evalAwait(`document.getElementById('claim-btn')?.textContent || ''`);
  console.log(btn.includes('Claim') ? `PASS: 📐 Claim button rendered (${btn.trim()})` : `FAIL: button missing (got "${btn}")`);

  // ── Phase 2: tap → session card with canonical + claim + 2 options ───
  await s.evalAwait(`document.getElementById('claim-btn').click()`);
  await s.sleep(4500); // load registry + 10 lesson contents
  await s.snap('first-card');

  const card = await s.evalAwait(`(() => {
    const code = document.querySelector('[data-claim-code]')?.textContent || '';
    const claim = document.querySelector('.claim-stated-val')?.textContent || '';
    const opts = document.querySelectorAll('.claim-opt').length;
    return { codeLen: code.length, claim, opts };
  })()`);
  console.log(card.codeLen > 30 && card.opts === 2 && card.claim.length > 0 ? `PASS: card rendered (canonical ${card.codeLen} chars, claim="${card.claim}", 2 options)` : `FAIL: card malformed (codeLen=${card.codeLen}, claim="${card.claim}", opts=${card.opts})`);

  // ── Phase 3: tap an option → reveal appears + state.claim.attempts increments
  await s.evalAwait(`document.querySelector('.claim-opt:not(:disabled)').click()`);
  await s.sleep(300);
  const reveal = await s.evalAwait(`(() => {
    const r = document.querySelector('.claim-reveal');
    const locked = document.querySelectorAll('.claim-opt:disabled').length;
    return { reveal: !!r, revealText: r?.textContent || '', locked };
  })()`);
  console.log(reveal.reveal && reveal.locked === 2 && reveal.revealText.includes('Actually') ? `PASS: tap revealed actual complexity + locked both buttons` : `FAIL: reveal flow (reveal=${reveal.reveal}, locked=${reveal.locked}, text="${reveal.revealText}")`);

  // ── Phase 4: state.claim.attempts incremented ────────────────────────
  let attempts = 0;
  for (let i = 0; i < 20; i++) {
    attempts = await s.evalAwait(`state.claim?.attempts || 0`);
    if (attempts >= 1) break;
    await s.sleep(150);
  }
  console.log(attempts >= 1 ? `PASS: state.claim.attempts incremented to ${attempts}` : `FAIL: stats not saved (attempts=${attempts})`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
