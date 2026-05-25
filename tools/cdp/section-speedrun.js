#!/usr/bin/env node
// Verifies iter-71 🏁 Section Speedrun at iPhone viewport: sidebar button
// renders → picker lists eligible sections (≥3 full lessons) → tap section
// loads deck + renders stopwatch shell → stopwatch ticks → tap correct
// answers walk the deck to completion → summary saves
// state.speedrun.bests[<slug>]. Sourced from iter-64 roadmap entry #2.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-section-speedrun';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Boot from a clean state (no prior bests).
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    speedrun: { bests: {}, sessions: 0, completions: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('boot');

  // ── Phase 1: sidebar button renders ───────────────────────────────────
  const btn = await s.evalAwait(`document.getElementById('speedrun-btn')?.textContent`);
  console.log(btn && btn.includes('Speedrun') ? `PASS: 🏁 Speedrun button rendered (${btn})` : `FAIL: speedrun button missing (got ${btn})`);

  // ── Phase 2: picker opens with eligible sections (≥10 — many sections
  //          have ≥3 full lessons; classes/tries/system-design gated out)
  await s.evalAwait(`document.getElementById('speedrun-btn').click()`);
  await s.sleep(400);
  await s.snap('picker');
  const rowCount = await s.evalAwait(`document.querySelectorAll('.speedrun-pick-row').length`);
  console.log(rowCount >= 10 ? `PASS: picker shows ${rowCount} eligible sections (≥10)` : `FAIL: picker shows only ${rowCount} rows`);

  // Verify no row has fewer than 3 lessons (the SPEEDRUN_MIN_LESSONS gate).
  const minLessons = await s.evalAwait(`(() => {
    const rows = [...document.querySelectorAll('.speedrun-pick-row .speedrun-pick-count')];
    const counts = rows.map(r => parseInt(r.textContent, 10)).filter(n => !isNaN(n));
    return Math.min(...counts);
  })()`);
  console.log(minLessons >= 3 ? `PASS: every section in picker has ≥3 lessons (min=${minLessons})` : `FAIL: picker shows section with ${minLessons} lessons (below gate)`);

  // ── Phase 3: tap a section → stopwatch shell renders + ticks ──────────
  // Pick "basics" — 10 full lessons, guaranteed eligible.
  const picked = await s.evalAwait(`(() => {
    const row = [...document.querySelectorAll('.speedrun-pick-row')].find(r => r.dataset.slug === 'basics');
    if (!row) return null;
    row.click();
    return row.dataset.slug;
  })()`);
  if (picked !== 'basics') {
    console.log(`FAIL: could not pick 'basics' section (got ${picked})`);
    process.exit(1);
  }
  // Allow time for lesson-content lazy-load (~10 lessons × 50ms each).
  await s.sleep(1500);
  await s.snap('session-card-1');

  const stopwatchText = await s.evalAwait(`document.querySelector('[data-speedrun-clock]')?.textContent`);
  const optCount = await s.evalAwait(`document.querySelectorAll('.speedrun-opt').length`);
  console.log(stopwatchText && optCount >= 2 ? `PASS: session card rendered (stopwatch="${stopwatchText}", ${optCount} options)` : `FAIL: session card missing (clock=${stopwatchText}, opts=${optCount})`);

  // Verify stopwatch advances after a short delay.
  const t0 = stopwatchText;
  await s.sleep(800);
  const t1 = await s.evalAwait(`document.querySelector('[data-speedrun-clock]')?.textContent`);
  console.log(t0 && t1 && t0 !== t1 ? `PASS: stopwatch ticks (${t0} → ${t1})` : `FAIL: stopwatch did not advance (${t0} → ${t1})`);

  // ── Phase 4: walk the deck — tap the correct option each card until summary
  let safety = 30;
  while (safety-- > 0) {
    const ready = await s.evalAwait(`(() => {
      const opts = document.querySelectorAll('.speedrun-opt');
      const summary = document.querySelector('.speedrun-summary');
      return { opts: opts.length, summary: !!summary };
    })()`);
    if (ready.summary) break;
    if (!ready.opts) { await s.sleep(150); continue; }
    // Tap the correct option (lifted from grade()'s answerIdx logic — we
    // peek into the deck via a marker class added by the renderer).
    await s.evalAwait(`(() => {
      // The renderer doesn't tag the correct option in markup; instead we
      // reach into the closure by triggering each option and seeing which
      // applies the correct class. Simpler: click options in order and
      // rely on the deck answerIdx being deterministic — but easier still
      // is to tap option index 0 each card. Some lessons mark idx 0 as
      // correct; others don't. We just want to walk the deck (correct or
      // not — both auto-advance) so tap whichever option is at index 0.
      const opt = document.querySelector('.speedrun-opt:not(:disabled)');
      if (opt) opt.click();
    })()`);
    // Feedback delay: 350ms correct, 1100ms wrong. Wait for the slower.
    await s.sleep(1300);
  }
  await s.snap('summary');

  const summaryShown = await s.evalAwait(`!!document.querySelector('.speedrun-summary-time')`);
  console.log(summaryShown ? `PASS: summary rendered after walking deck` : `FAIL: summary never appeared (deck walk stuck)`);

  // ── Phase 5: best time saved ──────────────────────────────────────────
  const savedBest = await s.evalAwait(`state.speedrun?.bests?.basics || 0`);
  console.log(savedBest > 0 ? `PASS: state.speedrun.bests.basics = ${savedBest}ms saved` : `FAIL: bests.basics not saved (got ${savedBest})`);

  // ── Phase 6: returning to picker shows the new PB chip ────────────────
  await s.evalAwait(`document.querySelector('[data-action="speedrun-pick"]')?.click()`);
  await s.sleep(400);
  const pbChip = await s.evalAwait(`(() => {
    const row = [...document.querySelectorAll('.speedrun-pick-row')].find(r => r.dataset.slug === 'basics');
    return row?.querySelector('[data-best]')?.textContent || '';
  })()`);
  console.log(pbChip.includes('★') ? `PASS: picker shows PB chip after run ("${pbChip.trim()}")` : `FAIL: PB chip missing on picker (got "${pbChip}")`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
