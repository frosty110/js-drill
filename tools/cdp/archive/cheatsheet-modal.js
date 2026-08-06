#!/usr/bin/env node
// Iter probe: Cheatsheet modal — in-app quick-reference overlay
// (replaces the prior markdown-download flow).
//
// Asserts the full mobile flow:
//   A. Sidebar 📋 Cheatsheet button opens the modal (no download triggered).
//   B. Modal shows 3 track tabs + lessons grouped by section with
//      syntax-highlighted code blocks.
//   C. Track tabs switch content. Default track matches current lesson.
//   D. Search input filters by title/section/description.
//   E. Clicking a lesson title closes the modal and navigates to that lesson.
//   F. Escape closes the modal.

const { ensureServer, ensureChrome, connect } = require('../lib');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-cheatsheet';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Pre-seed: dismiss welcome banner so the sidebar is clean.
  await s.evalAwait(`(async () => {
    const data = { __v: 5, welcomed: true, progress: {}, reviews: {} };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  })()`);
  await s.reload();

  // ── A: open modal from sidebar (mobile: drawer first) ────────────────
  await s.click('#hamburger');
  await s.sleep(200);
  const btnPresent = await s.eval(`!!document.getElementById('export-btn')`);
  s.assert(btnPresent, '[A] 📋 Cheatsheet button present in sidebar toolbar');

  await s.click('#export-btn');
  await s.waitFor(
    `(() => { const b = document.getElementById('cheatsheet-body'); return b && b.querySelectorAll('[data-cs-lesson]').length > 0; })()`,
    { timeoutMs: 6000 }
  );
  await s.snap('A-modal-open');

  const open = await s.eval(`(() => ({
    display: document.getElementById('cheatsheet-modal').style.display,
    hasModal: !!document.getElementById('cheatsheet-modal'),
  }))()`);
  s.assert(open.display === 'block', `[A] modal display=block (got: ${open.display})`);

  // ── B: structure check — tabs + sections + lessons collapsed by default ──
  const structure = await s.eval(`(() => {
    const tabs = document.querySelectorAll('#cheatsheet-tabs [data-cs-track]');
    const sections = document.querySelectorAll('#cheatsheet-body [data-cs-section]');
    const lessons = document.querySelectorAll('#cheatsheet-body [data-cs-lesson]');
    const openLessons = document.querySelectorAll('#cheatsheet-body [data-cs-lesson][open]');
    const code = document.querySelectorAll('#cheatsheet-body [data-cs-code]');
    return {
      tabCount: tabs.length,
      sectionCount: sections.length,
      lessonCount: lessons.length,
      openLessonCount: openLessons.length,
      codeCount: code.length,
    };
  })()`);
  s.assert(structure.tabCount === 3, `[B] 3 track tabs (got: ${structure.tabCount})`);
  s.assert(structure.sectionCount >= 1, `[B] ≥1 section rendered (got: ${structure.sectionCount})`);
  s.assert(structure.lessonCount >= 5, `[B] ≥5 lessons rendered (got: ${structure.lessonCount})`);
  s.assert(structure.codeCount === structure.lessonCount,
    `[B] each lesson has a code block (lessons:${structure.lessonCount}, code:${structure.codeCount})`);
  // Two-tier collapse: most lessons should be collapsed by default. At most 1
  // lesson (the current one) should be open without a search filter.
  s.assert(structure.openLessonCount <= 1,
    `[B] lessons collapsed by default (open: ${structure.openLessonCount}/${structure.lessonCount})`);

  // ── B2: click a collapsed lesson title → it expands and code colorizes ──
  const expandResult = await s.eval(`(() => {
    const lesson = [...document.querySelectorAll('#cheatsheet-body [data-cs-lesson]')]
      .find(d => !d.open);
    if (!lesson) return { found: false };
    const id = lesson.getAttribute('data-cs-lesson');
    lesson.querySelector('summary').click();
    return { found: true, id, openAfter: lesson.open };
  })()`);
  await s.sleep(150);
  const expandedAfter = await s.eval(`(() => {
    const lesson = document.querySelector('[data-cs-lesson="${expandResult.id}"]');
    const pre = lesson?.querySelector('[data-cs-code]');
    const hasTokens = !!(pre && pre.querySelector('span'));
    return { open: lesson?.open, hasTokens };
  })()`);
  s.assert(expandResult.found && expandedAfter.open,
    `[B2] tapping a collapsed lesson summary expands it (id: ${expandResult.id})`);
  s.assert(expandedAfter.hasTokens,
    `[B2] code colorizes lazily on expand (CodeMirror tokens present)`);

  // ── B3: Expand all button opens every <details> ──────────────────────
  await s.click('#cheatsheet-expand-all');
  await s.sleep(100);
  const afterExpandAll = await s.eval(`(() => {
    const all = document.querySelectorAll('#cheatsheet-body details');
    const closed = [...all].filter(d => !d.open).length;
    const label = document.getElementById('cheatsheet-expand-all').textContent.trim();
    return { total: all.length, closed, label };
  })()`);
  await s.snap('B3-expand-all');
  s.assert(afterExpandAll.closed === 0,
    `[B3] Expand all opens every details (closed: ${afterExpandAll.closed}/${afterExpandAll.total})`);
  s.assert(afterExpandAll.label === 'Collapse all',
    `[B3] button label flips to Collapse all (got: ${afterExpandAll.label})`);
  // Toggle back so the rest of the test uses the default state.
  await s.click('#cheatsheet-expand-all');
  await s.sleep(100);

  // ── C: switching track tab swaps content ─────────────────────────────
  // Default opens on the current lesson's track (s-variables → syntax).
  // Click a different track and assert the lesson set changes.
  const beforeSwitch = await s.eval(`document.querySelector('#cheatsheet-body [data-cs-lesson]').getAttribute('data-cs-lesson')`);
  await s.click(`[data-cs-track="patterns"]`);
  await s.sleep(150);
  await s.snap('C-patterns-track');
  const afterSwitch = await s.eval(`(() => {
    const first = document.querySelector('#cheatsheet-body [data-cs-lesson]');
    const activeTabBg = document.querySelector('[data-cs-track="patterns"]').style.background;
    return {
      firstLessonId: first?.getAttribute('data-cs-lesson'),
      patternsActive: activeTabBg && activeTabBg !== 'transparent',
    };
  })()`);
  s.assert(afterSwitch.firstLessonId !== beforeSwitch,
    `[C] switching to patterns tab changed visible lessons (was: ${beforeSwitch}, now: ${afterSwitch.firstLessonId})`);
  s.assert(afterSwitch.patternsActive, `[C] patterns tab shows active styling`);
  // Switch back to syntax for the search test (so "array" finds syntax matches).
  await s.click(`[data-cs-track="syntax"]`);
  await s.sleep(150);

  // ── D: search filters ───────────────────────────────────────────────
  await s.eval(`(() => {
    const inp = document.getElementById('cheatsheet-search');
    inp.value = 'array';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await s.sleep(150);
  await s.snap('D-search-array');
  const filtered = await s.eval(`(() => {
    const lessons = [...document.querySelectorAll('#cheatsheet-body [data-cs-lesson]')];
    const titles = lessons.map(l => l.querySelector('[data-cs-goto]')?.textContent || '');
    return {
      count: lessons.length,
      allMatchOrSection: titles.length > 0,
    };
  })()`);
  s.assert(filtered.count > 0, `[D] search "array" returns matches (got: ${filtered.count})`);
  s.assert(filtered.count < structure.lessonCount,
    `[D] search narrowed the set vs all-syntax (filtered: ${filtered.count})`);

  // Clear search.
  await s.eval(`(() => {
    const inp = document.getElementById('cheatsheet-search');
    inp.value = '';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await s.sleep(100);

  // ── E: expand a non-default lesson, click "Open lesson →" → modal closes + navigates ──
  const targetId = await s.eval(`(() => {
    // Pick the first collapsed lesson so we exercise the expand-then-jump flow,
    // not the default-open current-lesson shortcut.
    const lesson = [...document.querySelectorAll('#cheatsheet-body [data-cs-lesson]')]
      .find(d => !d.open);
    if (lesson) {
      lesson.querySelector('summary').click();
      return lesson.getAttribute('data-cs-lesson');
    }
    return document.querySelector('#cheatsheet-body [data-cs-goto]')?.getAttribute('data-cs-goto');
  })()`);
  await s.sleep(150);
  await s.click(`[data-cs-goto="${targetId}"]`);
  await s.sleep(700);
  await s.snap('E-navigated');
  const landed = await s.eval(`(() => ({
    modalDisplay: document.getElementById('cheatsheet-modal').style.display,
    currentLesson: window.__jsdrillState.currentLessonId,
  }))()`);
  s.assert(landed.modalDisplay === 'none',
    `[E] modal closed after Open lesson click (got: ${landed.modalDisplay})`);
  s.assert(landed.currentLesson === targetId,
    `[E] navigated to clicked lesson (expected ${targetId}, got: ${landed.currentLesson})`);

  // ── F: Escape closes ────────────────────────────────────────────────
  await s.click('#hamburger');
  await s.sleep(200);
  await s.click('#export-btn');
  await s.waitFor(
    `(() => document.getElementById('cheatsheet-modal').style.display === 'block')()`,
    { timeoutMs: 3000 }
  );
  await s.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await s.sleep(150);
  const closed = await s.eval(`document.getElementById('cheatsheet-modal').style.display`);
  s.assert(closed === 'none', `[F] Escape closes modal (got: ${closed})`);

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
