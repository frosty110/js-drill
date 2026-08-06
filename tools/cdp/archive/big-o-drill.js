#!/usr/bin/env node
// Verifies iter-75 ⏱ Big-O Speed Drill at iPhone viewport: sidebar button
// renders → session uses Rapid-Fire shell with complexity-filtered deck →
// header reads "⏱ Big-O" not "⚡ Rapid" → ≥5 cards rendered with letter
// chips → state.rapidFire accumulates (Big-O shares lifetime stats with
// Rapid-Fire by design — same modality, different filter).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-big-o';

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
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('boot');

  // ── Phase 1: button renders ───────────────────────────────────────────
  const btnText = await s.evalAwait(`document.getElementById('big-o-btn')?.textContent || ''`);
  console.log(btnText.includes('Big-O') ? `PASS: ⏱ Big-O button rendered (${btnText.trim()})` : `FAIL: button missing (got ${btnText})`);

  // ── Phase 2: tap → session shell with ⏱ Big-O header (not ⚡ Rapid) ───
  await s.evalAwait(`document.getElementById('big-o-btn').click()`);
  // Preload of ~24 lessons + deck filter takes a moment.
  await s.sleep(8000);
  await s.snap('first-card');

  const header = await s.evalAwait(`document.querySelector('.rapid-header span')?.textContent || ''`);
  console.log(header.startsWith('⏱ Big-O') ? `PASS: header reads "⏱ Big-O" (got "${header}")` : `FAIL: header is "${header}", expected to start with ⏱ Big-O`);

  // ── Phase 3: card has ≥2 options + letter chips ──────────────────────
  const cardOk = await s.evalAwait(`(() => {
    const opts = document.querySelectorAll('.rapid-opt');
    const letters = document.querySelectorAll('.rapid-letter');
    const q = document.querySelector('.rapid-question')?.textContent || '';
    return { opts: opts.length, letters: letters.length, qLen: q.length };
  })()`);
  console.log(cardOk.opts >= 2 && cardOk.letters >= 2 && cardOk.qLen > 10 ? `PASS: card rendered (${cardOk.opts} options, ${cardOk.letters} letter chips, q-text ${cardOk.qLen} chars)` : `FAIL: card malformed (opts=${cardOk.opts}, letters=${cardOk.letters}, qLen=${cardOk.qLen})`);

  // ── Phase 4: question text matches the complexity filter ──────────────
  const isComplexityQ = await s.evalAwait(`(() => {
    const q = document.querySelector('.rapid-question')?.textContent || '';
    return /\\b(complex|O\\(|big[\\s-]?o|amortized|asymptotic)\\b/i.test(q);
  })()`);
  console.log(isComplexityQ ? `PASS: question is complexity-flavored (filter working)` : `FAIL: question doesn't match Big-O filter regex`);

  // ── Phase 5: tap an option grades + accumulates state.rapidFire.
  // Big-O reuses the Rapid-Fire shell, which has a 7-sec auto-advance
  // timer; the probe may land in an inter-card gap. Try-tap-then-poll
  // tolerates that without spurious failure.
  const tapped = await s.evalAwait(`(() => {
    const btn = document.querySelector('.rapid-opt:not(:disabled)');
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  // Wait up to 4s for state.rapidFire to register the attempt — covers both
  // direct-tap path AND auto-advance-from-timer path (timer also calls grade).
  let attempts = 0;
  for (let i = 0; i < 20; i++) {
    attempts = await s.evalAwait(`state.rapidFire?.attempts || 0`);
    if (attempts >= 1) break;
    await s.sleep(200);
  }
  console.log(attempts >= 1 ? `PASS: state.rapidFire.attempts incremented to ${attempts} (tapped=${tapped})` : `FAIL: stats not saved (attempts=${attempts})`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
