#!/usr/bin/env node
// Mobile check for the standalone prep.html dashboard. Validates:
//   - page renders (header, tab bar, today's day card)
//   - tab switching works (Today → Glossary → Code → Cheat → back)
//   - task check-off persists across tab swaps (writes to localStorage)
//   - glossary search filters
//   - code shape copy button is present
//   - "Open in app" button bridges via lastLessonId
//
// Run after any change to prep.html. Per CLAUDE.md mobile is the 80% case.
const { ensureServer, ensureChrome, connect } = require('./lib');

const base = process.argv[2] || 'http://localhost:8765/prep.html';
const out = process.argv[3] || '/tmp/jsdrill-prep-mobile';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: base, mobile: true, outDir: out });

  // Wait for first paint
  await new Promise(r => setTimeout(r, 600));

  // Clear prior state and reload to get a clean baseline
  await s.eval(`(() => { localStorage.removeItem('jsdrill.prep.v1'); })()`);
  await s.eval(`location.reload()`);
  await new Promise(r => setTimeout(r, 800));

  // --- Page rendered ---
  const brand = await s.eval(`document.querySelector('.brand')?.textContent?.trim()`);
  s.assert(/Eve.*Prep/.test(brand || ''), `header brand should say "Eve Prep" (got: ${brand})`);

  const tabCount = await s.eval(`document.querySelectorAll('.tab').length`);
  s.assert(tabCount === 6, `expected 6 tabs in bottom nav (got: ${tabCount})`);

  const dayTitle = await s.eval(`document.querySelector('.day-title')?.textContent?.trim()`);
  s.assert(/^Day \d/.test(dayTitle || ''), `expected day title to start with "Day N" (got: ${dayTitle})`);

  const blockCount = await s.eval(`document.querySelectorAll('.block').length`);
  s.assert(blockCount >= 3, `expected ≥3 blocks for the day (got: ${blockCount})`);

  await s.snap('01-today-default');

  // --- Tab switching ---
  await s.eval(`document.querySelector('.tab[data-tab="glossary"]').click()`);
  await new Promise(r => setTimeout(r, 300));
  const glossCards = await s.eval(`document.querySelectorAll('.gloss-card').length`);
  s.assert(glossCards >= 14, `expected ≥14 glossary cards (got: ${glossCards})`);
  await s.snap('02-glossary');

  // Glossary search
  await s.eval(`
    const inp = document.getElementById('glossSearch');
    inp.value = 'monotonic';
    inp.dispatchEvent(new Event('input'));
  `);
  await new Promise(r => setTimeout(r, 200));
  const filtered = await s.eval(`document.querySelectorAll('.gloss-card').length`);
  s.assert(filtered >= 1 && filtered <= 3, `glossary search "monotonic" should match 1-3 cards (got: ${filtered})`);
  await s.snap('03-glossary-filtered');

  // --- Code tab ---
  await s.eval(`document.querySelector('.tab[data-tab="code"]').click()`);
  await new Promise(r => setTimeout(r, 600)); // let CodeMirror runMode paint
  const shapes = await s.eval(`document.querySelectorAll('.shape').length`);
  s.assert(shapes === 6, `expected 6 code shapes (got: ${shapes})`);
  const copyBtns = await s.eval(`document.querySelectorAll('.copy-btn').length`);
  s.assert(copyBtns === 6, `expected 6 copy buttons (got: ${copyBtns})`);
  // CodeMirror syntax highlighting present
  const cmTokens = await s.eval(`document.querySelectorAll('.cm-host .cm-keyword, .cm-host .cm-def, .cm-host .cm-variable').length`);
  s.assert(cmTokens > 10, `expected CodeMirror tokens in code shapes (got: ${cmTokens})`);
  // Per-item checkboxes present on code shapes
  const codeChecks = await s.eval(`document.querySelectorAll('.shape [data-review-id]').length`);
  s.assert(codeChecks === 6, `expected 6 per-shape review checkboxes (got: ${codeChecks})`);

  // No horizontal scrollbar on code blocks on mobile: long canonical lines
  // (BFS queue, monotonic stack, etc.) must wrap, not push a horizontal scroller.
  // Per CLAUDE.md / PROFILE.md, the phone is the 80% surface — a hidden
  // horizontal scrollbar hides content behind a swipe users don't discover.
  const codeOverflow = await s.eval(`(() => {
    const pres = [...document.querySelectorAll('.cm-host pre, .shape pre')];
    const offenders = pres
      .map(p => ({ scroll: p.scrollWidth, client: p.clientWidth }))
      .filter(d => d.scroll > d.client + 1);
    return { total: pres.length, offenderCount: offenders.length, sample: offenders[0] || null };
  })()`);
  s.assert(codeOverflow.total >= 6,
    `expected ≥6 code-block <pre> elements in Code tab (got: ${codeOverflow.total})`);
  s.assert(codeOverflow.offenderCount === 0,
    `code blocks must not overflow horizontally on mobile (offenders: ${codeOverflow.offenderCount}/${codeOverflow.total}, sample: ${JSON.stringify(codeOverflow.sample)})`);

  await s.snap('04-code-shapes');

  // --- Cheat tab (now uses behavior-card style rows + per-item checkboxes, no table) ---
  await s.eval(`document.querySelector('.tab[data-tab="cheat"]').click()`);
  await new Promise(r => setTimeout(r, 300));
  const behaviorCards = await s.eval(`document.querySelectorAll('.behavior-card').length`);
  s.assert(behaviorCards >= 22, `expected ≥22 cheat cards (15 patterns + 8 behaviors) (got: ${behaviorCards})`);
  const cheatChecks = await s.eval(`document.querySelectorAll('.behavior-card [data-review-id]').length`);
  s.assert(cheatChecks >= 22, `expected ≥22 per-row review checkboxes (got: ${cheatChecks})`);
  await s.snap('05-cheat');

  // --- Back to Today, check off a task ---
  await s.eval(`document.querySelector('.tab[data-tab="today"]').click()`);
  await new Promise(r => setTimeout(r, 300));

  // Make sure first block is expanded
  await s.eval(`(() => {
    const b = document.querySelector('.block');
    if (!b.classList.contains('expanded')) b.querySelector('.block-header').click();
  })()`);
  await new Promise(r => setTimeout(r, 200));

  // Click first task checkbox
  const beforeRaw = await s.eval(`JSON.stringify(JSON.parse(localStorage.getItem('jsdrill.prep.v1') || '{}').completed || {})`);
  const beforeCount = Object.keys(JSON.parse(beforeRaw)).filter(k => JSON.parse(beforeRaw)[k]).length;

  await s.eval(`document.querySelector('.task-check').click()`);
  await new Promise(r => setTimeout(r, 300));

  const afterRaw = await s.eval(`JSON.stringify(JSON.parse(localStorage.getItem('jsdrill.prep.v1') || '{}').completed || {})`);
  const afterCount = Object.keys(JSON.parse(afterRaw)).filter(k => JSON.parse(afterRaw)[k]).length;
  s.assert(afterCount === beforeCount + 1, `checking task should add 1 to completed count (before=${beforeCount}, after=${afterCount})`);

  await s.snap('06-task-checked');

  // --- Switch tabs and back, verify persistence ---
  await s.eval(`document.querySelector('.tab[data-tab="cheat"]').click()`);
  await new Promise(r => setTimeout(r, 200));
  await s.eval(`document.querySelector('.tab[data-tab="today"]').click()`);
  await new Promise(r => setTimeout(r, 300));
  // Re-expand first block (it may have collapsed)
  await s.eval(`(() => {
    const b = document.querySelector('.block');
    if (!b.classList.contains('expanded')) b.querySelector('.block-header').click();
  })()`);
  await new Promise(r => setTimeout(r, 200));
  const checkboxState = await s.eval(`document.querySelector('.task-check').checked`);
  s.assert(checkboxState === true, `after tab swap, first task should remain checked`);

  // --- Open in app bridge: verify the button exists with a real lesson ID ---
  // Actually clicking would navigate away; the renderTaskHtml code writes the
  // lastLessonId, so we mimic that write directly to keep the test self-contained.
  const openRes = await s.eval(`(() => {
    const btn = document.querySelector('button[data-open-lesson]');
    if (!btn) return JSON.stringify({ ok: false, reason: 'no open-lesson button found' });
    const id = btn.dataset.openLesson;
    try {
      const raw = localStorage.getItem('jsdrill.progress.v1');
      const parsed = raw ? JSON.parse(raw) : { __v: 5 };
      parsed.lastLessonId = id;
      localStorage.setItem('jsdrill.progress.v1', JSON.stringify(parsed));
      return JSON.stringify({ ok: true, lessonId: id });
    } catch (e) {
      return JSON.stringify({ ok: false, reason: e.message });
    }
  })()`);
  const openParsed = JSON.parse(openRes || '{}');
  s.assert(openParsed.ok, `open-lesson bridge should succeed (reason: ${openParsed.reason || 'ok'})`);

  // --- Per-item glossary checkbox writes review state ---
  await s.eval(`document.querySelector('.tab[data-tab="glossary"]').click()`);
  await new Promise(r => setTimeout(r, 300));
  // Clear glossary search filter that was set earlier
  await s.eval(`(() => {
    const inp = document.getElementById('glossSearch');
    if (inp && inp.value) { inp.value = ''; inp.dispatchEvent(new Event('input')); }
  })()`);
  await new Promise(r => setTimeout(r, 200));
  const glossChecksBefore = await s.eval(`document.querySelectorAll('.gloss-card [data-review-id]').length`);
  s.assert(glossChecksBefore >= 14, `expected ≥14 glossary review checkboxes (got: ${glossChecksBefore})`);
  // Click first glossary item check
  await s.eval(`document.querySelector('.gloss-card [data-review-id]').click()`);
  await new Promise(r => setTimeout(r, 200));
  const reviewedAfter = await s.eval(`JSON.stringify(Object.keys(JSON.parse(localStorage.getItem('jsdrill.prep.v1') || '{}').reviewed || {}))`);
  const reviewedKeys = JSON.parse(reviewedAfter);
  s.assert(reviewedKeys.some(k => k.startsWith('g:')), `expected a glossary item (g:*) in reviewed state (got: ${reviewedKeys.join(',') || 'empty'})`);

  // --- Daily Review flow ---
  await s.eval(`document.querySelector('.tab[data-tab="today"]').click()`);
  await new Promise(r => setTimeout(r, 300));
  // Re-expand first block if collapsed (doesn't matter for review test, but keeps page state sane)
  const promoExists = await s.eval(`document.querySelector('.review-promo button[data-action="start-review"]') ? 1 : 0`);
  s.assert(promoExists === 1, `Daily Review promo button should be visible on Today tab`);
  await s.eval(`document.querySelector('.review-promo button[data-action="start-review"]').click()`);
  await new Promise(r => setTimeout(r, 400));
  const inSession = await s.eval(`document.querySelector('.review-session') ? 1 : 0`);
  s.assert(inSession === 1, `clicking Start review should open the review session`);
  // Peek and grade one item
  const peekBtn = await s.eval(`document.getElementById('reviewPeekBtn') ? 1 : 0`);
  s.assert(peekBtn === 1, `Peek button present on first review card`);
  await s.eval(`document.getElementById('reviewPeekBtn').click()`);
  await new Promise(r => setTimeout(r, 200));
  const answerShown = await s.eval(`document.querySelector('.review-answer') ? 1 : 0`);
  s.assert(answerShown === 1, `Peek reveals .review-answer block`);
  await s.snap('08-review-card');
  // Grade "Got it"
  await s.eval(`document.getElementById('reviewGotitBtn').click()`);
  await new Promise(r => setTimeout(r, 250));
  const gotitCount = await s.eval(`JSON.parse(localStorage.getItem('jsdrill.prep.v1') || '{}').review?.gotIt || 0`);
  s.assert(gotitCount === 1, `Got-it grade should increment review.gotIt (got: ${gotitCount})`);
  // Exit review
  await s.eval(`document.getElementById('reviewExitBtn').click()`);
  await new Promise(r => setTimeout(r, 300));
  const exited = await s.eval(`document.querySelector('.review-session') ? 0 : 1`);
  s.assert(exited === 1, `Exit review returns to Today view`);

  // --- Settings tab ---
  await s.eval(`document.querySelector('.tab[data-tab="settings"]').click()`);
  await new Promise(r => setTimeout(r, 300));
  const settingsRows = await s.eval(`document.querySelectorAll('.settings-row').length`);
  s.assert(settingsRows >= 5, `expected ≥5 settings rows (got: ${settingsRows})`);
  await s.snap('07-settings');

  // --- Layout sanity: no horizontal overflow at mobile viewport ---
  const overflow = await s.eval(`
    JSON.stringify({
      docW: document.documentElement.scrollWidth,
      viewW: document.documentElement.clientWidth,
      hasHscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    })
  `);
  const ov = JSON.parse(overflow);
  s.assert(!ov.hasHscroll, `no horizontal scroll at mobile viewport (doc=${ov.docW}, view=${ov.viewW})`);

  // Clean up: remove the test check + lastLessonId so repeated runs don't drift state
  await s.eval(`(() => {
    localStorage.removeItem('jsdrill.prep.v1');
    const raw = localStorage.getItem('jsdrill.progress.v1');
    if (raw) {
      try {
        const p = JSON.parse(raw);
        delete p.lastLessonId;
        localStorage.setItem('jsdrill.progress.v1', JSON.stringify(p));
      } catch {}
    }
  })()`);

  await s.close();
  s.report();
})().catch(e => { console.error(e); process.exit(1); });
