// Probe: L1 ≥80%/miss-one pass rule + amber-vs-emerald ✓ + weakness retention.
// Drives the real DOM click flow on a 4-question lesson:
//   - 3 correct + 1 wrong  → orange pass: passed, amber status, partialL1 set,
//                            weakness KEPT (gap stays for re-review), next-L2 shown
//   - 4 correct (retry)    → clean pass: green status, partialL1 cleared,
//                            weakness cleared
// Run: node tools/cdp/l1-orange-pass.js
const { ensureServer, ensureChrome, connect } = require('./lib');

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: 'http://localhost:8765/' });
  // The app ships a cache-first service worker; without clearing it the probe
  // would run against stale precached JS. Unregister + drop caches, then reload.
  await s.evalAwait(`(async () => {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (self.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); }
  })()`);
  await s.reload();
  await s.waitFor(`typeof selectLesson === 'function' && typeof CONTENT === 'object' && typeof isPartialL1 === 'function'`);

  const LID = 's-variables'; // 4 L1 questions (syntax track)

  // Clean slate, then open the lesson's L1 tab and wait for CONTENT + cards.
  await s.eval(`(() => { localStorage.removeItem('jsdrill.progress.v1'); state.progress={}; state.weakness={}; state.partialL1={}; })()`);
  await s.eval(`selectLesson(${JSON.stringify(LID)})`);
  await s.evalAwait(`(async () => { selectTab('L1'); for (let i=0;i<40 && !CONTENT[${JSON.stringify(LID)}];i++){ await new Promise(r=>setTimeout(r,50)); } selectTab('L1'); })()`);
  await s.waitFor(`document.querySelectorAll('.mc-option').length >= 4 && _cacheGet(${JSON.stringify(LID)},'L1')`);

  // Helper run in-page: click the correct option for the first (n-1) display
  // questions and a WRONG option for the last. Returns {n, clickedWrong}.
  const clickResult = await s.eval(`(() => {
    const ls = _cacheGet(${JSON.stringify(LID)}, 'L1');
    const qs = CONTENT[${JSON.stringify(LID)}].L1.questions;
    const cards = [...document.querySelectorAll('[data-qi]')];
    const n = ls.qOrder.length;
    let clickedWrong = false;
    ls.qOrder.forEach((qi, displayIdx) => {
      const perQ = ls.perQ[qi];
      const correctDisplay = perQ.optOrder.indexOf(qs[qi].answer);
      const opts = [...cards[displayIdx].children];
      if (displayIdx < n - 1) {
        opts[correctDisplay].click();           // correct
      } else {
        const wrong = correctDisplay === 0 ? 1 : 0;
        opts[wrong].click();                     // deliberately wrong
        clickedWrong = true;
      }
    });
    return { n, clickedWrong };
  })()`);

  s.assert(clickResult.n === 4, `lesson has 4 L1 questions (got ${clickResult.n})`);
  s.assert(clickResult.clickedWrong === true, `clicked a wrong option on the last question`);

  // Assertions for the ORANGE pass.
  const orange = await s.eval(`(() => {
    const status = document.getElementById('l1-status').textContent;
    const nextBtn = document.querySelector('[data-action="next-l2"]');
    return {
      status,
      statusHasPassed: /passed \\(3\\/4\\)/.test(status),
      statusAmber: !!document.querySelector('#l1-status .text-amber-400'),
      nextVisible: nextBtn && !nextBtn.classList.contains('hidden'),
      levelPassed: levelStatus(${JSON.stringify(LID)}, 'L1') === 'passed',
      partialSet: isPartialL1(${JSON.stringify(LID)}),
      weaknessKept: (state.weakness[${JSON.stringify(LID)}] || 0) >= 1,
      tabAmber: !!document.querySelector('.tab-btn[data-level="L1"] .text-amber-400'),
    };
  })()`);

  s.assert(orange.statusHasPassed, `orange: status shows "passed (3/4)" — got "${orange.status}"`);
  s.assert(orange.statusAmber, `orange: status text is amber`);
  s.assert(orange.nextVisible, `orange: L2 button revealed (advance allowed at 80%)`);
  s.assert(orange.levelPassed, `orange: levelStatus L1 === 'passed'`);
  s.assert(orange.partialSet, `orange: partialL1 flag set`);
  s.assert(orange.weaknessKept, `orange: weakness KEPT for re-review (not cleared on partial)`);
  // Tab ✓ color updates on next render; force one and check it's amber.
  await s.eval(`renderLesson && renderLesson()`);
  const tabAmber = await s.eval(`!!document.querySelector('.tab-btn[data-level="L1"] .text-amber-400') && !document.querySelector('.tab-btn[data-level="L1"] .text-emerald-400')`);
  s.assert(tabAmber, `orange: L1 tab ✓ renders amber (not emerald)`);

  // ── Now RETRY and ace it 4/4 → should demote to green + clear weakness ──
  await s.eval(`_cacheClearLevel(${JSON.stringify(LID)}, 'L1'); renderLesson();`);
  await s.waitFor(`document.querySelectorAll('.mc-option').length >= 4 && _cacheGet(${JSON.stringify(LID)},'L1')`);
  await s.eval(`(() => {
    const ls = _cacheGet(${JSON.stringify(LID)}, 'L1');
    const qs = CONTENT[${JSON.stringify(LID)}].L1.questions;
    const cards = [...document.querySelectorAll('[data-qi]')];
    ls.qOrder.forEach((qi, displayIdx) => {
      const perQ = ls.perQ[qi];
      const correctDisplay = perQ.optOrder.indexOf(qs[qi].answer);
      [...cards[displayIdx].children][correctDisplay].click();
    });
  })()`);

  const green = await s.eval(`(() => {
    const status = document.getElementById('l1-status').textContent;
    return {
      status,
      statusGreen: !!document.querySelector('#l1-status .text-emerald-400'),
      partialCleared: !isPartialL1(${JSON.stringify(LID)}),
      weaknessCleared: !state.weakness[${JSON.stringify(LID)}],
    };
  })()`);
  s.assert(green.statusGreen, `green: clean retry shows emerald status — got "${green.status}"`);
  s.assert(green.partialCleared, `green: partialL1 flag cleared on clean pass`);
  s.assert(green.weaknessCleared, `green: weakness cleared on clean pass`);

  const r = s.report();
  await s.close();
  process.exit(r.failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
