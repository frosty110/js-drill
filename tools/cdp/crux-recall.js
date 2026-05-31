// Probe: 🎯 Crux recall drill (evolved Gotcha) — both modes.
//   Easy: mode picker → MC card with 4 options (one == reference.crux); a wrong
//         pick flags weakness, a correct pick credits stats; reveal shows source.
//   Hard: mode picker → textarea; "Copy for AI grading" writes a prompt
//         containing the problem + user answer + canonical crux to the clipboard;
//         reveal + self-grade closes the loop.
// Run: node tools/cdp/crux-recall.js
const { ensureServer, ensureChrome, connect } = require('./lib');

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: 'http://localhost:8765/' });
  // Clear the cache-first service worker so we test the freshly-edited JS/CSS.
  await s.evalAwait(`(async () => {
    if (navigator.serviceWorker) { const r = await navigator.serviceWorker.getRegistrations(); await Promise.all(r.map(x => x.unregister())); }
    if (self.caches) { const k = await caches.keys(); await Promise.all(k.map(x => caches.delete(x))); }
  })()`);
  await s.reload();
  await s.waitFor(`typeof startCruxSession === 'function' && typeof _cruxBuildPool === 'function'`);

  // Grant clipboard so the Hard-mode export path doesn't throw.
  try { await s.eval(`navigator.clipboard && navigator.clipboard.writeText ? true : false`); } catch (_) {}

  // ── Pool sanity: ≥ a real deck's worth of authored cruxes, with options buildable.
  const pool = await s.evalAwait(`(async () => {
    const p = await _cruxBuildPool();
    const sample = p[0];
    const built = sample ? _cruxBuildOptions(sample, p) : null;
    return {
      size: p.length,
      sampleHasCrux: !!(sample && sample.crux),
      optCount: built ? built.options.length : 0,
      correctIsCrux: built ? built.options[built.correctIdx] === sample.crux : false,
      optsUnique: built ? new Set(built.options).size === built.options.length : false,
    };
  })()`);
  s.assert(pool.size >= 20, `crux pool has real depth (got ${pool.size})`);
  s.assert(pool.sampleHasCrux, `pool entries carry a crux string`);
  s.assert(pool.optCount === 4, `Easy builds exactly 4 options (got ${pool.optCount})`);
  s.assert(pool.correctIsCrux, `the correct option IS the lesson's crux`);
  s.assert(pool.optsUnique, `all 4 options are distinct (no dup distractor)`);

  // ── Mode picker renders with both modes.
  await s.eval(`state.weakness = {}; state.gotcha = { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 };`);
  await s.evalAwait(`startCruxSession()`);
  await s.waitFor(`document.querySelectorAll('.crux-mode-btn').length === 2`);
  s.assert(true, `mode picker shows Easy + Hard`);

  // ── EASY MODE: pick the WRONG option, assert weakness + miss credited.
  await s.eval(`document.querySelector('.crux-mode-btn[data-mode="easy"]').click()`);
  await s.waitFor(`document.querySelectorAll('.crux-opt').length === 4`);
  const easy = await s.eval(`(() => {
    // Find the wrong option by comparing button text to the deck card's crux.
    // We can't see closure state, so derive: click the first option, then read
    // whether feedback says correct/incorrect and whether weakness moved.
    const before = JSON.stringify(state.weakness);
    const opts = [...document.querySelectorAll('.crux-opt')];
    // Click the option whose text is NOT the longest-correct — just click index 0
    // and report the resulting verdict; we assert the machinery, not which idx.
    opts[0].click();
    const verdict = document.querySelector('.crux-verdict');
    const correctShown = !!document.querySelector('.crux-opt.recognize-opt-correct');
    return {
      verdictText: verdict ? verdict.textContent : '',
      correctHighlighted: correctShown,
      revealSource: !!document.querySelector('.crux-reveal-source'),
      nextBtn: !!document.querySelector('[data-action="crux-next"]'),
      attempts: state.gotcha.attempts,
      weaknessChanged: JSON.stringify(state.weakness) !== before,
    };
  })()`);
  s.assert(easy.correctHighlighted, `Easy: correct option highlighted on answer`);
  s.assert(easy.revealSource, `Easy: reveal shows source lesson`);
  s.assert(easy.nextBtn, `Easy: Next button present`);
  s.assert(easy.attempts === 1, `Easy: one attempt credited to stats (got ${easy.attempts})`);
  // Exactly one of {correct credited, weakness flagged} must be true.
  const easyCredited = easy.verdictText.includes('move');
  s.assert(easyCredited ? !easy.weaknessChanged : easy.weaknessChanged,
    `Easy: a miss flags weakness, a hit doesn't (verdict="${easy.verdictText}", weaknessΔ=${easy.weaknessChanged})`);

  // ── HARD MODE: textarea + clipboard export + reveal + self-grade.
  await s.evalAwait(`startCruxSession()`);
  await s.waitFor(`document.querySelectorAll('.crux-mode-btn').length === 2`);
  await s.eval(`document.querySelector('.crux-mode-btn[data-mode="hard"]').click()`);
  await s.waitFor(`document.querySelector('.crux-textarea')`);
  // Type a recalled answer, then verify the AI-grading prompt the export builds.
  // (We test _cruxBuildAiPrompt directly — the headless clipboard API is blocked
  // without window focus, so the round-trip itself isn't a meaningful signal;
  // the real user path reuses the same copyTextToClipboard as the L1 export.)
  await s.eval(`(() => { const ta = document.querySelector('.crux-textarea'); ta.value = 'use a hash set for O(1) lookups'; })()`);
  const exported = await s.evalAwait(`(async () => {
    const pool = await _cruxBuildPool();
    const prompt = _cruxBuildAiPrompt(pool[0], 'use a hash set for O(1) lookups');
    // Also click the button to confirm the handler runs without throwing.
    let threw = false;
    try { document.querySelector('[data-action="crux-copy"]').click(); } catch (_) { threw = true; }
    return {
      handlerOk: !threw,
      hasProblem: /## Problem/.test(prompt),
      hasMyAnswer: /hash set for O\\(1\\)/.test(prompt),
      hasCanonical: /canonical key trick/i.test(prompt),
      hasCrux: prompt.includes(pool[0].crux),
    };
  })()`);
  s.assert(exported.handlerOk, `Hard: copy handler runs without throwing`);
  s.assert(exported.hasProblem, `Hard: export prompt includes the problem`);
  s.assert(exported.hasMyAnswer, `Hard: export prompt includes the user's recalled answer`);
  s.assert(exported.hasCanonical, `Hard: export prompt includes the canonical crux for grading`);
  s.assert(exported.hasCrux, `Hard: export prompt embeds the actual crux text`);
  // Reveal + self-grade miss → weakness + attempt.
  const hard = await s.eval(`(() => {
    const before = state.gotcha.attempts;
    document.querySelector('[data-action="crux-reveal"]').click();
    const answerShown = !!document.querySelector('.crux-reveal-answer');
    document.querySelector('.crux-selfgrade-btn[data-grade="miss"]').click();
    return {
      answerShown,
      attemptsAfter: state.gotcha.attempts,
      credited: state.gotcha.attempts === before + 1,
    };
  })()`);
  s.assert(hard.answerShown, `Hard: reveal shows the canonical crux`);
  s.assert(hard.credited, `Hard: self-grade credits one attempt to stats`);

  const r = s.report();
  await s.close();
  process.exit(r.failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
