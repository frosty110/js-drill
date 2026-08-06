#!/usr/bin/env node
// iter 126 — verifies 📦 Cheatsheet → Printable PDF / Native-Phone Save
// (iter-124 roadmap #2; Cat 6 Persistence — closes leaves-the-app
// offline-study gap that iter-113 Offline Pack only half-solved).
//
// The print dialog itself can't be inspected via CDP (no headless API for
// the native Save-as-PDF picker), so this probe verifies the structural
// invariants — what the user would see in the new tab before they trigger
// print. If the HTML structure is right and the print stylesheet is in
// place, the native dialog does the rest of the job.
//
// 1) "📱 Save" button renders in the Cheatsheet modal toolbar.
// 2) `_buildPrintableCheatsheetHtml()` returns a valid HTML doc containing:
//    - `<!doctype html>` and `<title>` with the lesson count + date
//    - 3 Track headings (Track A / B / C)
//    - Every full lesson's title (≥150 lessons)
//    - Every full lesson's reference.code block
//    - The print stylesheet (@page + @media print blocks)
//    - A toolbar div that's hidden in print
// 3) `exportCheatsheetToPdf()` triggers `window.open` (intercept via shim).
//    Verifies the function exists + is callable and doesn't throw.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-cheatsheet-pdf';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(800);

  // ── Phase 1: open the cheatsheet modal ───────────────────────────────
  await s.evalAwait(`document.getElementById('export-btn').click()`);
  // ensureAllContentLoaded fires on open; allow time.
  for (let i = 0; i < 15; i++) {
    await s.sleep(400);
    const ready = await s.evalAwait(`(() => {
      const m = document.getElementById('cheatsheet-modal');
      return m && m.style.display !== 'none' && document.querySelectorAll('details[data-cs-lesson]').length > 5;
    })()`);
    if (ready) break;
  }
  await s.snap('01-cheatsheet-modal');

  // ── Phase 2: 📱 Save button present + styled ─────────────────────────
  const btnInfo = await s.evalAwait(`(() => {
    const btn = document.getElementById('cheatsheet-save-pdf');
    if (!btn) return { present: false };
    return {
      present: true,
      label: btn.textContent.trim(),
      visible: btn.offsetWidth > 0,
      hasTitle: (btn.getAttribute('title') || '').length > 20
    };
  })()`);
  s.assert(btnInfo.present, '📱 Save button rendered in cheatsheet modal');
  s.assert(/Save/.test(btnInfo.label), `Button label contains "Save" (got "${btnInfo.label}")`);
  s.assert(btnInfo.visible, 'Button is visible (non-zero width)');
  s.assert(btnInfo.hasTitle, 'Button has a non-trivial tooltip (>20 chars)');

  // ── Phase 3: HTML builder output structure ───────────────────────────
  const htmlInfo = await s.evalAwait(`(() => {
    const html = _buildPrintableCheatsheetHtml();
    return {
      type: typeof html,
      length: html.length,
      hasDoctype: /^<!doctype html>/i.test(html),
      hasTitle: /<title>JS Drill Cheatsheet/.test(html),
      hasPrintCss: /@media print/.test(html) && /@page/.test(html),
      trackACount: (html.match(/Track A — Syntax Fundamentals/g) || []).length,
      trackBCount: (html.match(/Track B — Canonical Patterns/g) || []).length,
      trackCCount: (html.match(/Track C — Applied Problems/g) || []).length,
      preBlocks: (html.match(/<pre class="code">/g) || []).length,
      lessonHeadings: (html.match(/<h3 class="lesson">/g) || []).length,
      sectionHeadings: (html.match(/<h2 class="section">/g) || []).length,
      hasToolbar: /class="toolbar"/.test(html),
      hasPageBreak: /page-break-before:\\s*always/.test(html)
    };
  })()`);
  s.assert(htmlInfo.type === 'string', `Builder returns a string (got ${htmlInfo.type})`);
  s.assert(htmlInfo.length > 50000, `HTML doc is substantial (got ${htmlInfo.length} chars; expected >50k for 154 lessons)`);
  s.assert(htmlInfo.hasDoctype, 'Doc starts with <!doctype html>');
  s.assert(htmlInfo.hasTitle, '<title>JS Drill Cheatsheet…</title> present');
  s.assert(htmlInfo.hasPrintCss, 'Print stylesheet present (@page + @media print)');
  s.assert(htmlInfo.trackACount >= 2, `Track A heading appears ≥2× (ToC + body, got ${htmlInfo.trackACount})`);
  s.assert(htmlInfo.trackBCount >= 2, `Track B heading appears ≥2× (got ${htmlInfo.trackBCount})`);
  s.assert(htmlInfo.trackCCount >= 2, `Track C heading appears ≥2× (got ${htmlInfo.trackCCount})`);
  s.assert(htmlInfo.lessonHeadings >= 150, `≥150 lesson <h3> blocks emitted (got ${htmlInfo.lessonHeadings})`);
  s.assert(htmlInfo.preBlocks >= 150, `≥150 <pre> code blocks emitted (got ${htmlInfo.preBlocks})`);
  s.assert(htmlInfo.sectionHeadings >= 20, `≥20 section <h2> blocks (got ${htmlInfo.sectionHeadings})`);
  s.assert(htmlInfo.hasToolbar, 'Toolbar div present (screen-only, hidden on print)');
  s.assert(htmlInfo.hasPageBreak, 'Page-break-before:always rule present (each track starts a new page)');

  // ── Phase 4: exportCheatsheetToPdf is callable + opens a new window ──
  // Shim window.open before invoking so we can verify the call without
  // actually opening a popup (CDP can't manage popup lifecycle reliably).
  const openInfo = await s.evalAwait(`(() => {
    let opened = false;
    let writtenLen = 0;
    let printCalled = false;
    const realOpen = window.open;
    const fakeWin = {
      document: {
        write: (s) => { writtenLen += (s||'').length; },
        open: () => {},
        close: () => {}
      },
      focus: () => {},
      print: () => { printCalled = true; }
    };
    window.open = function () { opened = true; return fakeWin; };
    try {
      exportCheatsheetToPdf();
    } finally {
      // Wait for the 600ms setTimeout to fire print() before restoring;
      // but we can't await in this eval block, so probe will sleep + re-check.
    }
    // Stash on window so the probe can poll after 700ms.
    window.__pdfProbeShim = { opened, writtenLen, getPrintCalled: () => printCalled, restore: () => { window.open = realOpen; } };
    return { opened, writtenLenAfterImmediate: writtenLen };
  })()`);
  s.assert(openInfo.opened, 'exportCheatsheetToPdf() called window.open');
  s.assert(openInfo.writtenLenAfterImmediate > 50000, `Generated HTML written into new window after sync call (got ${openInfo.writtenLenAfterImmediate} chars)`);
  // Poll for print() to fire (after the 600ms setTimeout).
  await s.sleep(900);
  const printFired = await s.evalAwait(`window.__pdfProbeShim.getPrintCalled()`);
  s.assert(printFired, 'win.print() invoked after 600ms layout delay');
  await s.evalAwait(`window.__pdfProbeShim.restore()`);
  await s.snap('02-after-export-call');

  await s.close();
  const r = s.report();
  process.exit(r.failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
