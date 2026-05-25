#!/usr/bin/env node
// Verifies iter-77 🔮 Predict-the-Output (Crystal Ball mental-execution) at
// iPhone viewport: sidebar button → session shows a real patterns canonical
// + 4 output options (1 correct + 3 same-type distractors from other
// lessons), user picks one, state.crystal accumulates. First surface that
// trains mental simulation — reading code and predicting behavior without
// executing.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-crystal';

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
  await s.snap('boot');

  // ── Phase 1: button renders ───────────────────────────────────────────
  const btn = await s.evalAwait(`document.getElementById('crystal-btn')?.textContent || ''`);
  console.log(btn.includes('Predict') ? `PASS: 🔮 Predict button rendered (${btn.trim()})` : `FAIL: button missing (got "${btn}")`);

  // ── Phase 2: tap → session shows canonical code + 4 options ──────────
  await s.evalAwait(`document.getElementById('crystal-btn').click()`);
  await s.sleep(8000); // preload ~20 patterns lessons
  await s.snap('first-card');

  const card = await s.evalAwait(`(() => {
    const code = document.querySelector('.crystal-code')?.textContent || '';
    const opts = document.querySelectorAll('.crystal-opt').length;
    const hint = document.querySelector('.crystal-hint')?.textContent || '';
    return { codeLen: code.length, opts, hint };
  })()`);
  console.log(card.codeLen > 30 && card.opts === 4 && card.hint.includes('Pick the output') ? `PASS: card rendered (canonical ${card.codeLen} chars, ${card.opts} options, hint shown)` : `FAIL: card malformed (codeLen=${card.codeLen}, opts=${card.opts}, hint="${card.hint}")`);

  // ── Phase 3: all 4 options are same-type as the correct answer ───────
  // (distractor-type-match check — protects against the trivial-distractor
  // anti-pattern from the iter-30 audit)
  const typesMatch = await s.evalAwait(`(() => {
    const opts = [...document.querySelectorAll('.crystal-opt')].map(b => b.dataset.opt || '');
    function classify(s) {
      const t = (s || '').trim();
      if (!t) return 'string';
      if (t.startsWith('[') && t.endsWith(']')) return 'array';
      if (t.startsWith('{') && t.endsWith('}')) return 'object';
      if (/^-?\\d+(\\.\\d+)?$/.test(t)) return 'number';
      if (t === 'true' || t === 'false') return 'boolean';
      return 'string';
    }
    const types = opts.map(classify);
    return types.length === 4 && new Set(types).size === 1;
  })()`);
  console.log(typesMatch ? `PASS: all 4 options share output type (no type-mismatch giveaway)` : `FAIL: option types diverge — distractor-quality regression`);

  // ── Phase 4: tap an option → state.crystal.attempts increments ───────
  await s.evalAwait(`(() => {
    const o = document.querySelector('.crystal-opt:not(:disabled)');
    if (o) o.click();
  })()`);
  let attempts = 0;
  for (let i = 0; i < 20; i++) {
    attempts = await s.evalAwait(`state.crystal?.attempts || 0`);
    if (attempts >= 1) break;
    await s.sleep(150);
  }
  console.log(attempts >= 1 ? `PASS: state.crystal.attempts incremented to ${attempts}` : `FAIL: stats not saved (attempts=${attempts})`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
