#!/usr/bin/env node
// iter 121 — verifies 🎬 Reference Cinema (Cat 1 first ship since iter 92).
// Reference tab gains a Cinema toggle: every line of reference.code renders
// blurred; tap each line to reveal. Bypasses CodeMirror highlighting by
// design — line-grain prediction is the drill, not syntax recognition.
//
// 1) Cinema button is present alongside Flash on the Reference tab.
// 2) Toggle ON → <pre data-ref-code> swaps to .cine-line <button> elements,
//    one per code line, all starting blurred (no .cine-revealed).
// 3) Tap one line → that line gains .cine-revealed; siblings stay blurred.
// 4) Tap a different line → both revealed independently.
// 5) Toggle OFF → canonical restored (no .cine-line children; CM-highlighted).
// 6) Mutual reset: Flash on then Cinema → Flash resets, Cinema active.
// 7) Mutual reset: Cinema on then Flash → Cinema resets, Flash active.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-cinema';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed a clean state + pick a known lesson with a multi-line canonical.
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(800);

  const lessonId = 'two-sum';
  await s.evalAwait(`selectLesson('${lessonId}')`);
  for (let i = 0; i < 10; i++) {
    await s.sleep(300);
    if (await s.evalAwait(`!!CONTENT['${lessonId}'] && !!CONTENT['${lessonId}'].reference`)) break;
  }
  await s.evalAwait(`selectTab('reference')`);
  await s.sleep(400);

  // Phase 1: both toggles present.
  const togglesPresent = await s.evalAwait(`(() => {
    const flash = document.querySelector('[data-action="flash-toggle"]');
    const cine = document.querySelector('[data-action="cinema-toggle"]');
    return { flash: !!flash, cine: !!cine, flashLabel: flash?.textContent, cineLabel: cine?.textContent };
  })()`);
  s.assert(togglesPresent.flash, 'Flash toggle present on Reference tab');
  s.assert(togglesPresent.cine, 'Cinema toggle present on Reference tab');
  s.assert(/Cinema/.test(togglesPresent.cineLabel || ''), 'Cinema button label reads "🎬 Cinema"');
  await s.snap('01-reference-clean');

  // Phase 2: Cinema ON → blurred line buttons render, all unrevealed.
  await s.evalAwait(`document.querySelector('[data-action="cinema-toggle"]').click()`);
  await s.sleep(250);
  const cinemaOn = await s.evalAwait(`(() => {
    const codeEl = document.querySelector('[data-ref-code]');
    const lines = codeEl ? codeEl.querySelectorAll('.cine-line') : [];
    const revealed = codeEl ? codeEl.querySelectorAll('.cine-line.cine-revealed') : [];
    const btn = document.querySelector('[data-action="cinema-toggle"]');
    return {
      lineCount: lines.length,
      revealedCount: revealed.length,
      allButtons: Array.from(lines).every(el => el.tagName === 'BUTTON'),
      activeClass: btn.classList.contains('active'),
      label: btn.textContent
    };
  })()`);
  s.assert(cinemaOn.lineCount >= 3, `Cinema rendered ${cinemaOn.lineCount} line-buttons (expected >=3)`);
  s.assert(cinemaOn.revealedCount === 0, 'All lines start blurred (zero .cine-revealed)');
  s.assert(cinemaOn.allButtons, 'Every cine-line element is a <button>');
  s.assert(cinemaOn.activeClass, 'Cinema toggle gets .active class when ON');
  s.assert(/Reveal all/.test(cinemaOn.label || ''), 'Cinema label flips to "Reveal all" when ON');
  await s.snap('02-cinema-on-blurred');

  // Phase 3: tap one line → exactly that line gains .cine-revealed.
  await s.evalAwait(`document.querySelectorAll('.cine-line')[0].click()`);
  await s.sleep(120);
  const oneRevealed = await s.evalAwait(`(() => {
    const all = document.querySelectorAll('.cine-line');
    const rev = document.querySelectorAll('.cine-line.cine-revealed');
    return { total: all.length, revealed: rev.length, firstRevealed: all[0].classList.contains('cine-revealed') };
  })()`);
  s.assert(oneRevealed.revealed === 1, `Exactly 1 line revealed after first tap (got ${oneRevealed.revealed})`);
  s.assert(oneRevealed.firstRevealed, 'The tapped (first) line is the one revealed');

  // Phase 4: tap a different line → both revealed independently.
  await s.evalAwait(`document.querySelectorAll('.cine-line')[2].click()`);
  await s.sleep(120);
  const twoRevealed = await s.evalAwait(`document.querySelectorAll('.cine-line.cine-revealed').length`);
  s.assert(twoRevealed === 2, `2 lines revealed after second tap (got ${twoRevealed})`);
  await s.snap('03-two-revealed');

  // Phase 5: Cinema OFF → canonical restored (no .cine-line, CM-highlighted).
  await s.evalAwait(`document.querySelector('[data-action="cinema-toggle"]').click()`);
  await s.sleep(200);
  const cinemaOff = await s.evalAwait(`(() => {
    const codeEl = document.querySelector('[data-ref-code]');
    const lines = codeEl ? codeEl.querySelectorAll('.cine-line') : [];
    const cmTokens = codeEl ? codeEl.querySelectorAll('.cm-keyword, .cm-string, .cm-variable, .cm-def') : [];
    const btn = document.querySelector('[data-action="cinema-toggle"]');
    return {
      lineCount: lines.length,
      cmTokenCount: cmTokens.length,
      activeClass: btn.classList.contains('active'),
      label: btn.textContent,
      hasContent: codeEl && codeEl.textContent.trim().length > 0
    };
  })()`);
  s.assert(cinemaOff.lineCount === 0, 'No .cine-line children after Cinema OFF');
  s.assert(cinemaOff.hasContent, 'Code block has content after Cinema OFF (canonical restored)');
  s.assert(cinemaOff.cmTokenCount > 0, `CodeMirror highlighting restored (${cinemaOff.cmTokenCount} CM tokens)`);
  s.assert(!cinemaOff.activeClass, 'Cinema toggle clears .active when OFF');
  s.assert(/Cinema/.test(cinemaOff.label || '') && !/Reveal/.test(cinemaOff.label || ''),
    'Cinema label reverts to "🎬 Cinema" when OFF');

  // Phase 6: Mutual reset — turn Flash ON, then Cinema → Flash should reset.
  await s.evalAwait(`document.querySelector('[data-action="flash-toggle"]').click()`);
  await s.sleep(200);
  const flashOnly = await s.evalAwait(`(() => {
    const flashBtn = document.querySelector('[data-action="flash-toggle"]');
    const cineBtn = document.querySelector('[data-action="cinema-toggle"]');
    return {
      flashActive: flashBtn.classList.contains('active'),
      cineActive: cineBtn.classList.contains('active'),
      flashTokens: document.querySelectorAll('[data-ref-code] .flash-blur').length
    };
  })()`);
  s.assert(flashOnly.flashActive && !flashOnly.cineActive, 'Flash ON + Cinema OFF after Flash tap');

  await s.evalAwait(`document.querySelector('[data-action="cinema-toggle"]').click()`);
  await s.sleep(250);
  const cineWonFlashReset = await s.evalAwait(`(() => {
    const flashBtn = document.querySelector('[data-action="flash-toggle"]');
    const cineBtn = document.querySelector('[data-action="cinema-toggle"]');
    return {
      flashActive: flashBtn.classList.contains('active'),
      cineActive: cineBtn.classList.contains('active'),
      cineLineCount: document.querySelectorAll('.cine-line').length,
      flashTokens: document.querySelectorAll('[data-ref-code] .flash-blur').length
    };
  })()`);
  s.assert(!cineWonFlashReset.flashActive, 'Flash resets when Cinema activated mid-Flash');
  s.assert(cineWonFlashReset.cineActive, 'Cinema active after Flash → Cinema transition');
  s.assert(cineWonFlashReset.cineLineCount >= 3, 'Cinema line-buttons render after mutual reset');
  s.assert(cineWonFlashReset.flashTokens === 0, 'No leftover flash-tokens after Cinema takes over');
  await s.snap('04-mutual-reset-flash-to-cinema');

  // Phase 7: Reverse — Cinema currently ON, click Flash → Cinema should reset.
  await s.evalAwait(`document.querySelector('[data-action="flash-toggle"]').click()`);
  await s.sleep(250);
  const flashWonCineReset = await s.evalAwait(`(() => {
    const flashBtn = document.querySelector('[data-action="flash-toggle"]');
    const cineBtn = document.querySelector('[data-action="cinema-toggle"]');
    return {
      flashActive: flashBtn.classList.contains('active'),
      cineActive: cineBtn.classList.contains('active'),
      cineLineCount: document.querySelectorAll('.cine-line').length,
      flashTokens: document.querySelectorAll('[data-ref-code] .flash-blur').length
    };
  })()`);
  s.assert(flashWonCineReset.flashActive, 'Flash active after Cinema → Flash transition');
  s.assert(!flashWonCineReset.cineActive, 'Cinema resets when Flash activated mid-Cinema');
  s.assert(flashWonCineReset.cineLineCount === 0, 'No leftover .cine-line buttons after Flash takes over');
  s.assert(flashWonCineReset.flashTokens > 0, `Flash tokens populated (${flashWonCineReset.flashTokens}) after mutual reset`);
  await s.snap('05-mutual-reset-cinema-to-flash');

  await s.close();
  const r = s.report();
  process.exit(r.failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
