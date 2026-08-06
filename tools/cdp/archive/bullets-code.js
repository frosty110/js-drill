#!/usr/bin/env node
// iter 144 — verifies 📝 Notes→Code (Cat 1 Drilling Surfaces, ideas-by-
// category.md § Cat 1 → Code-from-bullet-points; iter-93 promotion
// shortlist #2 SHIPPED after 51-iter wait — was held under "category
// saturation" until iter-122 What-If, then 22 more iters until Cat 1
// was overdue again).
//
// Reference tab gains a 📝 Notes→Code toggle alongside 🃏 Flash + 🎬
// Cinema. When ON: canonical <pre> is replaced with a CodeMirror editor
// + Run button; user types canonical from memory using the still-visible
// Notes list (below the editor) as the prompt; Run grades via runCode
// against L3.expectedOutput.
//
// Phases:
//   1. Toggle button mounted in Reference toolbar with desk-tier-positioning
//      tooltip.
//   2. Toggle ON → canonical pre replaced with .bullets-code-editor +
//      Run button; Notes section still visible below.
//   3. Mutual exclusion: turning on Flash while Notes→Code is active
//      restores canonical first. Same for Cinema.
//   4. Run with correct canonical → emerald pass feedback.
//   5. Run with wrong code → amber wrong-output feedback (NOT a thrown
//      error).
//   6. Run with code that throws → red error feedback.
//   7. Toggle OFF → canonical syntax-highlighted view restored.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-bullets-code';

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
  await s.sleep(700);

  // Nav into a Patterns lesson's Reference tab.
  const lessonId = 'two-sum';
  await s.evalAwait(`selectLesson('${lessonId}')`);
  for (let i = 0; i < 10; i++) {
    await s.sleep(300);
    if (await s.evalAwait(`!!CONTENT['${lessonId}'] && !!CONTENT['${lessonId}'].L3`)) break;
  }
  await s.evalAwait(`selectTab('reference')`);
  await s.sleep(500);
  await s.snap('01-reference-default');

  // Phase 1: toggle button mounted.
  const phase1 = await s.evalAwait(`(() => {
    const btn = document.querySelector('[data-action="bullets-toggle"]');
    return {
      present: !!btn,
      label: btn ? btn.textContent.trim() : '',
      tooltip: btn ? btn.title : '',
      flashPresent: !!document.querySelector('[data-action="flash-toggle"]'),
      cinemaPresent: !!document.querySelector('[data-action="cinema-toggle"]'),
    };
  })()`);
  s.assert(phase1.present, '[data-action="bullets-toggle"] mounted on Reference tab');
  s.assert(/Notes/i.test(phase1.label), `Toggle label mentions Notes; got "${phase1.label}"`);
  s.assert(/desk|recall|see concept/i.test(phase1.tooltip), 'Tooltip positions as desk-tier / recall-direction (mobile self-select signal)');
  s.assert(phase1.flashPresent, 'Flash toggle still present (no regression)');
  s.assert(phase1.cinemaPresent, 'Cinema toggle still present (no regression)');

  // Phase 2: turn ON → canonical replaced with editor + Run.
  await s.evalAwait(`document.querySelector('[data-action="bullets-toggle"]').click()`);
  await s.sleep(400);
  const phase2 = await s.evalAwait(`(() => {
    const codeEl = document.querySelector('[data-ref-code]');
    const editor = document.querySelector('[data-bullets-editor]');
    const cm = codeEl ? codeEl.querySelector('.CodeMirror') : null;
    const runBtn = document.querySelector('[data-bullets-run]');
    const notes = document.querySelectorAll('.ref-note').length;
    const btn = document.querySelector('[data-action="bullets-toggle"]');
    return {
      editorPresent: !!editor,
      cmMounted: !!cm,
      runPresent: !!runBtn,
      notesStillVisible: notes >= 3,
      toggleLabel: btn ? btn.textContent.trim() : '',
      toggleActive: btn ? btn.classList.contains('active') : false,
    };
  })()`);
  s.assert(phase2.editorPresent, '[data-bullets-editor] textarea mounted inside [data-ref-code]');
  s.assert(phase2.cmMounted, 'CodeMirror instance mounted on the editor');
  s.assert(phase2.runPresent, '[data-bullets-run] button rendered');
  s.assert(phase2.notesStillVisible, `Notes list still visible (≥3 .ref-note items); got ${phase2.notesStillVisible}`);
  s.assert(/Reveal/.test(phase2.toggleLabel), `Toggle label flipped to "Reveal canonical"; got "${phase2.toggleLabel}"`);
  s.assert(phase2.toggleActive, 'Toggle button has .active class');
  await s.snap('02-bullets-on');

  // Phase 3: mutual exclusion. Turn Flash on while Notes→Code is active
  // → Notes→Code should reset (canonical restored, then Flash applied).
  await s.evalAwait(`document.querySelector('[data-action="flash-toggle"]').click()`);
  await s.sleep(300);
  const phase3 = await s.evalAwait(`(() => {
    const editor = document.querySelector('[data-bullets-editor]');
    const flashOn = document.querySelector('[data-action="flash-toggle"]').classList.contains('active');
    const bulletsOn = document.querySelector('[data-action="bullets-toggle"]').classList.contains('active');
    return { editorGone: !editor, flashOn, bulletsOn };
  })()`);
  s.assert(phase3.editorGone, 'Mutual exclusion: enabling Flash removed the Notes→Code editor');
  s.assert(phase3.flashOn, 'Flash is now active');
  s.assert(!phase3.bulletsOn, 'Notes→Code is no longer active after Flash takeover');
  // Turn Flash back off to clean state.
  await s.evalAwait(`document.querySelector('[data-action="flash-toggle"]').click()`);
  await s.sleep(300);

  // Phase 4: Run with correct canonical → emerald pass feedback.
  await s.evalAwait(`document.querySelector('[data-action="bullets-toggle"]').click()`);
  await s.sleep(400);
  // Pull the lesson's canonical via CONTENT[lessonId].L3.canonical and inject
  // into the CodeMirror editor.
  await s.evalAwait(`(() => {
    const canon = CONTENT['${lessonId}'].L3.canonical;
    const cm = document.querySelector('[data-ref-code] .CodeMirror').CodeMirror;
    cm.setValue(canon);
  })()`);
  await s.sleep(200);
  await s.evalAwait(`document.querySelector('[data-bullets-run]').click()`);
  await s.sleep(800);
  const phase4 = await s.evalAwait(`(() => {
    const fb = document.querySelector('[data-bullets-feedback]');
    return {
      text: fb ? fb.textContent.trim() : '',
      hasPassClass: fb ? fb.classList.contains('bullets-feedback-pass') : false,
    };
  })()`);
  s.assert(phase4.hasPassClass, `Feedback has bullets-feedback-pass class on correct canonical; got "${phase4.text}"`);
  s.assert(/matches|succeed|✓/i.test(phase4.text), `Pass feedback text reads correctly; got "${phase4.text}"`);
  await s.snap('03-bullets-pass');

  // Phase 5: Run with wrong code → amber feedback (not error).
  await s.evalAwait(`(() => {
    const cm = document.querySelector('[data-ref-code] .CodeMirror').CodeMirror;
    cm.setValue('console.log("wrong output")');
  })()`);
  await s.sleep(200);
  await s.evalAwait(`document.querySelector('[data-bullets-run]').click()`);
  await s.sleep(800);
  const phase5 = await s.evalAwait(`(() => {
    const fb = document.querySelector('[data-bullets-feedback]');
    return {
      text: fb ? fb.textContent.trim() : '',
      hasWarnClass: fb ? fb.classList.contains('bullets-feedback-warn') : false,
      hasErrClass: fb ? fb.classList.contains('bullets-feedback-err') : false,
    };
  })()`);
  s.assert(phase5.hasWarnClass, `Wrong output gets bullets-feedback-warn class (NOT error); got class via "${phase5.text}"`);
  s.assert(!phase5.hasErrClass, 'Wrong output is NOT classified as a thrown error');
  s.assert(/expected|✗/i.test(phase5.text), `Wrong feedback names the expected/got delta; got "${phase5.text}"`);
  await s.snap('04-bullets-wrong');

  // Phase 6: Run with code that throws → red error feedback.
  await s.evalAwait(`(() => {
    const cm = document.querySelector('[data-ref-code] .CodeMirror').CodeMirror;
    cm.setValue('throw new Error("nope")');
  })()`);
  await s.sleep(200);
  await s.evalAwait(`document.querySelector('[data-bullets-run]').click()`);
  await s.sleep(800);
  const phase6 = await s.evalAwait(`(() => {
    const fb = document.querySelector('[data-bullets-feedback]');
    return {
      text: fb ? fb.textContent.trim() : '',
      hasErrClass: fb ? fb.classList.contains('bullets-feedback-err') : false,
    };
  })()`);
  s.assert(phase6.hasErrClass, `Thrown error gets bullets-feedback-err class; got "${phase6.text}"`);
  s.assert(/error|nope|✗/i.test(phase6.text), `Error feedback names the error; got "${phase6.text}"`);
  await s.snap('05-bullets-error');

  // Phase 7: toggle OFF → canonical syntax-highlighted view restored.
  await s.evalAwait(`document.querySelector('[data-action="bullets-toggle"]').click()`);
  await s.sleep(400);
  const phase7 = await s.evalAwait(`(() => {
    const codeEl = document.querySelector('[data-ref-code]');
    const editorGone = !codeEl.querySelector('[data-bullets-editor]');
    const hasDracula = codeEl.classList.contains('cm-s-dracula');
    const hasCode = codeEl.textContent.trim().length > 0;
    const btn = document.querySelector('[data-action="bullets-toggle"]');
    return {
      editorGone,
      hasDracula,
      hasCode,
      toggleLabel: btn ? btn.textContent.trim() : '',
      toggleActive: btn ? btn.classList.contains('active') : false,
    };
  })()`);
  s.assert(phase7.editorGone, 'Toggle OFF removed the editor');
  s.assert(phase7.hasDracula, 'Canonical pre still has cm-s-dracula class (syntax-highlighted restored)');
  s.assert(phase7.hasCode, 'Canonical text content restored');
  s.assert(/Notes→Code|Notes/i.test(phase7.toggleLabel), `Toggle label restored to "Notes→Code"; got "${phase7.toggleLabel}"`);
  s.assert(!phase7.toggleActive, 'Toggle no longer has .active class');
  await s.snap('06-bullets-off');

  await s.close();
  const r = s.report();
  process.exit(r.failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
