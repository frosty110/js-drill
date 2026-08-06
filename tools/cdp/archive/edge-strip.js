#!/usr/bin/env node
// Verifies iter-81 🛡 Edge-case pre-enumeration chip strip on L3 at iPhone
// viewport: navigate to a patterns lesson's L3 tab → 6 edge chips render
// above editor → tapping toggles .edge-chip-considered class.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-edge-strip';

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

  // Deep-link to two-sum L3 tab.
  await s.evalAwait(`location.hash = '#/two-sum/L3'`);
  await s.sleep(1000);
  await s.snap('l3-tab');

  // ── Phase 1: edge strip renders with 6 chips ─────────────────────────
  const chips = await s.evalAwait(`(() => {
    const strip = document.querySelector('.edge-strip');
    const chips = document.querySelectorAll('.edge-chip');
    const label = document.querySelector('.edge-strip-label')?.textContent || '';
    return { hasStrip: !!strip, chipCount: chips.length, label };
  })()`);
  console.log(chips.hasStrip && chips.chipCount === 6 && chips.label.includes('edges') ? `PASS: edge strip rendered with 6 chips (${chips.label})` : `FAIL: strip state (hasStrip=${chips.hasStrip}, chips=${chips.chipCount}, label="${chips.label}")`);

  // ── Phase 2: tap a chip toggles .edge-chip-considered ────────────────
  await s.evalAwait(`document.querySelector('.edge-chip').click()`);
  await s.sleep(150);
  const consideredCount1 = await s.evalAwait(`document.querySelectorAll('.edge-chip-considered').length`);
  console.log(consideredCount1 === 1 ? `PASS: tap added "considered" state` : `FAIL: tap-on count=${consideredCount1}`);

  // ── Phase 3: tap again toggles OFF ────────────────────────────────────
  await s.evalAwait(`document.querySelector('.edge-chip').click()`);
  await s.sleep(150);
  const consideredCount2 = await s.evalAwait(`document.querySelectorAll('.edge-chip-considered').length`);
  console.log(consideredCount2 === 0 ? `PASS: re-tap removed "considered" state` : `FAIL: tap-off count=${consideredCount2}`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
