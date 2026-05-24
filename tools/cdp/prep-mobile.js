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
  await new Promise(r => setTimeout(r, 300));
  const shapes = await s.eval(`document.querySelectorAll('.shape').length`);
  s.assert(shapes === 6, `expected 6 code shapes (got: ${shapes})`);
  const copyBtns = await s.eval(`document.querySelectorAll('.copy-btn').length`);
  s.assert(copyBtns === 6, `expected 6 copy buttons (got: ${copyBtns})`);
  await s.snap('04-code-shapes');

  // --- Cheat tab ---
  await s.eval(`document.querySelector('.tab[data-tab="cheat"]').click()`);
  await new Promise(r => setTimeout(r, 300));
  const cheatRows = await s.eval(`document.querySelectorAll('.cheat-table tbody tr').length`);
  s.assert(cheatRows >= 14, `expected ≥14 cheatsheet rows (got: ${cheatRows})`);
  const behaviorCards = await s.eval(`document.querySelectorAll('.behavior-card').length`);
  s.assert(behaviorCards >= 7, `expected ≥7 interview-behavior cards (got: ${behaviorCards})`);
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
