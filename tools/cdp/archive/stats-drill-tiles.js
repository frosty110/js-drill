#!/usr/bin/env node
// Verifies iter-84 Stats-modal drill-lifetime tiles for 🎰 Gotcha + 📐 Claim
// at iPhone viewport: seed lifetime stats > 0 → open Stats modal → both
// tiles render with correct %/N/M and "Spin →" CTA. Also verifies the
// tiles HIDE when respective state.X.attempts === 0 (quiet-by-default).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-stats-tiles';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // ── Phase 1: seed ZERO lifetime stats → tiles should be HIDDEN ───────
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
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(400);
  await s.snap('stats-empty');

  const emptyState = await s.evalAwait(`(() => {
    const body = document.getElementById('stats-body').innerHTML;
    return {
      gotchaTile: body.includes('open-gotcha-from-stats'),
      claimTile: body.includes('open-claim-from-stats')
    };
  })()`);
  console.log(!emptyState.gotchaTile && !emptyState.claimTile ? `PASS: tiles HIDDEN when lifetime attempts = 0 (quiet-by-default)` : `FAIL: tiles leaked when empty (gotcha=${emptyState.gotchaTile}, claim=${emptyState.claimTile})`);

  // ── Phase 2: close modal, seed non-zero stats, reopen → tiles VISIBLE
  await s.evalAwait(`document.getElementById('stats-close').click()`);
  await s.sleep(150);
  await s.evalAwait(`(() => {
    state.gotcha = { attempts: 5, correct: 3, sessions: 1, lastRunAt: Date.now() };
    state.claim = { attempts: 8, correct: 6, sessions: 2, lastRunAt: Date.now() };
    saveProgress();
  })()`);
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(400);
  await s.snap('stats-with-tiles');

  const tiles = await s.evalAwait(`(() => {
    const gotchaBtn = document.querySelector('[data-action="open-gotcha-from-stats"]');
    const claimBtn = document.querySelector('[data-action="open-claim-from-stats"]');
    const body = document.getElementById('stats-body').textContent;
    return {
      gotchaVisible: !!gotchaBtn,
      claimVisible: !!claimBtn,
      gotchaText: body.includes('3 / 5') && body.includes('60%'),
      claimText: body.includes('6 / 8') && body.includes('75%')
    };
  })()`);
  console.log(tiles.gotchaVisible && tiles.gotchaText ? `PASS: 🎰 Gotcha tile shows 3/5 (60%) with Spin button` : `FAIL: Gotcha tile (visible=${tiles.gotchaVisible}, text-ok=${tiles.gotchaText})`);
  console.log(tiles.claimVisible && tiles.claimText ? `PASS: 📐 Claim tile shows 6/8 (75%) with Spin button` : `FAIL: Claim tile (visible=${tiles.claimVisible}, text-ok=${tiles.claimText})`);

  // ── Phase 3: iter-85 Crystal + Bug-Hunt tiles render when seeded ─────
  // (reopen modal in the same state — already-non-zero from Phase 2)
  await s.evalAwait(`(() => {
    state.crystal = { attempts: 4, correct: 2, sessions: 1, lastRunAt: Date.now() };
    state.bugHunt = { attempts: 10, correct: 7, sessions: 2, lastRunAt: Date.now() };
    saveProgress();
  })()`);
  // Reopen Stats so the new tiles render.
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(400);
  await s.snap('stats-all-tiles');
  const extraTiles = await s.evalAwait(`(() => {
    const crystalBtn = document.querySelector('[data-action="open-crystal-from-stats"]');
    const bugBtn = document.querySelector('[data-action="open-bughunt-from-stats"]');
    const body = document.getElementById('stats-body').textContent;
    return {
      crystalVisible: !!crystalBtn,
      bugVisible: !!bugBtn,
      crystalText: body.includes('2 / 4') && body.includes('50%'),
      bugText: body.includes('7 / 10') && body.includes('70%')
    };
  })()`);
  console.log(extraTiles.crystalVisible && extraTiles.crystalText ? `PASS: 🔮 Crystal tile shows 2/4 (50%) with Predict button` : `FAIL: Crystal tile (visible=${extraTiles.crystalVisible}, text-ok=${extraTiles.crystalText})`);
  console.log(extraTiles.bugVisible && extraTiles.bugText ? `PASS: 🪲 Bug-Hunt tile shows 7/10 (70%) with Hunt button` : `FAIL: Bug-Hunt tile (visible=${extraTiles.bugVisible}, text-ok=${extraTiles.bugText})`);

  // ── Phase 4: tap the Gotcha "Spin →" button → closes modal + opens session
  await s.evalAwait(`document.querySelector('[data-action="open-gotcha-from-stats"]').click()`);
  await s.sleep(800);
  const routed = await s.evalAwait(`(() => {
    const statsHidden = document.getElementById('stats-modal').style.display === 'none';
    return { statsHidden };
  })()`);
  console.log(routed.statsHidden ? `PASS: Spin button closed Stats modal (routed to Gotcha session)` : `FAIL: Stats modal still visible after Spin tap`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
