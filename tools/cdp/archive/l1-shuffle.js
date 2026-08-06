#!/usr/bin/env node
// Probe: per-render L1 shuffle.
// Verifies that:
//   - L1 questions and per-question options render in non-canonical order.
//   - The shuffle is stable across a tab switch away and back.
//   - Retry produces a NEW shuffle (different visual order than the prior visit).
//   - Clicking the rendered correct option (mapped via display→original index)
//     still passes L1 and unlocks the "L2 Fill-in →" CTA.
//
// Pick a lesson with ≥4 L1 questions so the question-order shuffle is detectable.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-probe-l1-shuffle';
const LESSON = 's-variables'; // syntax/basics — 4 L1 questions

async function readDom(s) {
  // Returns a serialized view of L1: per question, the question text + the
  // ORIGINAL option index for each rendered display slot.
  return s.eval(`(() => {
    const lessonId = '${LESSON}';
    const content = window.__jsdrillContent ? window.__jsdrillContent[lessonId] : null;
    const cards = [...document.querySelectorAll('#lesson-shell [data-qi]')];
    if (!cards.length) return { error: 'no-cards' };
    if (!content || !content.L1) return { error: 'no-content', loadedIds: window.__jsdrillContent ? Object.keys(window.__jsdrillContent).slice(0,5) : null };
    return cards.map((c, displayIdx) => {
      const origQi = +c.dataset.qi;
      const q = content.L1.questions[origQi];
      const opts = [...c.querySelectorAll('.mc-option')].map(el => {
        // Strip the letter prefix; what remains is the literal option text.
        const txt = (el.querySelector('.mc-body') || el).textContent.replace(/^\\s*[A-D]\\.?\\s*/, '').trim();
        const origOi = q.options.findIndex(o => o.trim() === txt);
        return origOi;
      });
      return { displayIdx, origQi, opts };
    });
  })()`);
}

async function runOne({ mobile, label }) {
  const s = await connect({ url: URL, mobile, outDir: `${OUT}-${label}` });

  // ARRANGE — land directly on a 4-question L1 lesson.
  await s.evalAwait(`(async () => {
    const data = { __v: 5, welcomed: true, lastLessonId: '${LESSON}', lastTab: 'L1' };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  })()`);
  await s.reload();
  await s.sleep(1500);
  // Ensure L1 tab is the active one.
  await s.eval(`document.querySelector('#lesson-shell .tab-btn[data-level="L1"]')?.click()`);
  await s.sleep(400);

  await s.snap('01-loaded');
  const firstView = await readDom(s);
  s.assert(Array.isArray(firstView) && firstView.length >= 3, `[${label}] L1 rendered (${JSON.stringify(firstView).slice(0,200)})`);
  if (!Array.isArray(firstView)) { await s.close(); s.report(); return false; }

  // Question-order shuffle: across ALL question-display slots, at least one
  // display position must hold a non-matching origQi (probability of identity
  // permutation with 5 items is 1/120).
  const qOrderShuffled = firstView.some(c => c.displayIdx !== c.origQi);
  s.assert(qOrderShuffled, `[${label}] Question order is shuffled (got [${firstView.map(c => c.origQi).join(',')}])`);

  // Option-order shuffle: at least one question must have its options in a
  // non-identity order. Probability of all-identity across N≥3 questions of
  // 4 options each is (1/24)^N — vanishingly small.
  const anyOptShuffled = firstView.some(c => c.opts.some((origOi, di) => origOi !== di));
  s.assert(anyOptShuffled, `[${label}] At least one question has shuffled options`);

  // Stability across tab switch: switch to Reference, back to L1, read again.
  await s.eval(`document.querySelector('#lesson-shell .tab-btn[data-level="Reference"]')?.click()`);
  await s.sleep(300);
  await s.eval(`document.querySelector('#lesson-shell .tab-btn[data-level="L1"]')?.click()`);
  await s.sleep(400);
  const stableView = await readDom(s);
  const sameQOrder = stableView.length === firstView.length
    && stableView.every((c, i) => c.origQi === firstView[i].origQi
        && c.opts.length === firstView[i].opts.length
        && c.opts.every((o, j) => o === firstView[i].opts[j]));
  s.assert(sameQOrder, `[${label}] Tab-switch preserved shuffle order`);
  await s.snap('02-after-tab-switch');

  // Retry → reshuffle. Click Retry, then read again. Across question order
  // OR per-question option order, at least one slot should differ from the
  // pre-retry order (probability of identical reshuffle is ~1/120 * (1/24)^N).
  await s.eval(`document.querySelector('[data-action="retry-l1"]')?.click()`);
  await s.sleep(500);
  const retryView = await readDom(s);
  const differs = retryView.length === firstView.length && (
    retryView.some((c, i) => c.origQi !== firstView[i].origQi) ||
    retryView.some((c, i) => c.opts.some((o, j) => o !== firstView[i].opts[j]))
  );
  s.assert(differs, `[${label}] Retry produced a new shuffle`);
  await s.snap('03-after-retry');

  // Functional: clicking the displayed-correct option for every question
  // should pass L1 — verifies the answer-index remap.
  const passResult = await s.evalAwait(`(async () => {
    const lessonId = '${LESSON}';
    const content = window.window.__jsdrillContent[lessonId];
    const cards = [...document.querySelectorAll('#lesson-shell [data-qi]')];
    for (const c of cards) {
      const origQi = +c.dataset.qi;
      const correctOrig = content.L1.questions[origQi].answer;
      const opts = [...c.querySelectorAll('.mc-option')];
      // Match via stripped text.
      const correctTxt = content.L1.questions[origQi].options[correctOrig].trim();
      const target = opts.find(el => (el.querySelector('.mc-body') || el).textContent.replace(/^\\s*[A-D]\\.?\\s*/, '').trim() === correctTxt);
      if (!target) return { ok: false, reason: 'no-target', origQi };
      target.click();
      await new Promise(r => setTimeout(r, 80));
    }
    await new Promise(r => setTimeout(r, 300));
    const statusEl = document.getElementById('l1-status');
    const nextBtn = document.querySelector('[data-action="next-l2"]');
    return {
      ok: !!statusEl && /L1 passed/i.test(statusEl.textContent) && nextBtn && !nextBtn.classList.contains('hidden'),
      statusTxt: statusEl?.textContent || '',
      nextHidden: nextBtn ? nextBtn.classList.contains('hidden') : null
    };
  })()`);
  s.assert(passResult && passResult.ok, `[${label}] Clicking mapped-correct passes L1 (status="${passResult?.statusTxt || ''}", nextHidden=${passResult?.nextHidden})`);
  await s.snap('04-passed');

  await s.close();
  s.report();
  return s.failed === 0;
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  let ok = true;
  ok = (await runOne({ mobile: false, label: 'desktop' })) && ok;
  ok = (await runOne({ mobile: true, label: 'mobile' })) && ok;
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
