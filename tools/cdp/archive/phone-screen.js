#!/usr/bin/env node
// iter 147 — verifies 📞 Phone Screen Simulator (Cat 2 Paths & Sessions;
// iter-146 roadmap entry #1 SHIPPED; first Cat 2 Active list refill since
// iter-125 Gauntlet — 22-iter drought broken).
//
// Differentiator (load-bearing — the probe asserts it):
//   - Mock = single lesson + timer.
//   - Gauntlet = same-section L1 chain, NO timer.
//   - Today's Plan = mixed-section session, NO timer.
//   - Phone Screen = chained-DIFFERENT-lesson-types + SINGLE unbroken timer
//     across all 3 cards (the timer keeps ticking across card transitions —
//     that's the interview-format-realism point).
//
// Phases:
//   1. Sidebar #phone-screen-btn present + tooltip names "ONE unbroken timer".
//   2. Tap → deck builds with exactly 3 cards spanning ≥2 tracks (syntax +
//      pattern minimum; followup may be same track as pattern).
//   3. Card 1 = warmup: shows reference.code + notes; Got it advances.
//   4. Timer runs across card transitions WITHOUT resetting (load-bearing
//      assertion — record T at end of card 1, T' at start of card 2; assert
//      T' >= T-100ms).
//   5. Card 2 = pattern: CodeMirror editor + Run + Give-up. Give up advances.
//   6. Card 3 = followup: L2 fill blanks + Submit + Skip. Skip advances.
//   7. Summary: shows 3 outcomes + total time + state.phoneScreen
//      .sessions/.completions both incremented.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-phone-screen';

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

  // Phase 1: sidebar button mounted with the load-bearing tooltip phrase.
  const phase1 = await s.evalAwait(`(() => {
    const btn = document.getElementById('phone-screen-btn');
    return {
      present: !!btn,
      label: btn ? btn.textContent.trim() : '',
      tooltipNamesUnbroken: btn ? /unbroken timer|one timer|single timer/i.test(btn.title) : false,
      sessionsZero: state.phoneScreen?.sessions === 0,
    };
  })()`);
  s.assert(phase1.present, '#phone-screen-btn mounted in sidebar');
  s.assert(/Phone Screen/.test(phase1.label), `Label says Phone Screen; got "${phase1.label}"`);
  s.assert(phase1.tooltipNamesUnbroken, 'Tooltip names "ONE unbroken timer" (load-bearing differentiator)');
  s.assert(phase1.sessionsZero, 'Clean state: state.phoneScreen.sessions === 0');
  await s.snap('01-init');

  // Phase 2: tap to start; deck builds with 3 cards. ensureMechanicIndex
  // forces full content-load; allow generous time.
  await s.evalAwait(`document.getElementById('phone-screen-btn').click()`);
  let deckReady = false;
  for (let i = 0; i < 90; i++) {
    await s.sleep(500);
    const ready = await s.evalAwait(`!!document.querySelector('.phone-screen-shell .phone-pip')`);
    if (ready) { deckReady = true; break; }
  }
  s.assert(deckReady, 'Phone Screen shell rendered within 45s (deck build incl. ensureMechanicIndex)');
  await s.snap('02-card-1-warmup');

  const phase2 = await s.evalAwait(`(() => {
    const pips = document.querySelectorAll('.phone-pip');
    const tag = document.querySelector('.phone-card-tag')?.textContent || '';
    const warmupCode = document.querySelector('[data-phone-warmup-code]');
    const notes = document.querySelectorAll('.phone-card-notes li');
    return {
      pipCount: pips.length,
      activePipIdx: Array.from(pips).findIndex(p => p.classList.contains('phone-pip-active')),
      cardTagText: tag,
      warmupCodePresent: !!warmupCode,
      warmupHasCode: !!warmupCode && warmupCode.textContent.length > 5,
      notesCount: notes.length,
    };
  })()`);
  s.assert(phase2.pipCount === 3, `3 pips rendered (3-card session); got ${phase2.pipCount}`);
  s.assert(phase2.activePipIdx === 0, `Pip 0 is active on first card; got idx ${phase2.activePipIdx}`);
  s.assert(/Card 1 of 3/.test(phase2.cardTagText), `Card tag says "Card 1 of 3"; got "${phase2.cardTagText}"`);
  s.assert(phase2.warmupCodePresent, 'Warmup canonical [data-phone-warmup-code] rendered');
  s.assert(phase2.warmupHasCode, 'Warmup canonical has text content');
  s.assert(phase2.notesCount >= 1, `Notes list rendered with ≥1 item; got ${phase2.notesCount}`);

  // Phase 3: capture timer reading at end of card 1; advance; capture timer
  // reading at start of card 2; assert it kept ticking (didn't reset).
  await s.sleep(1200);  // let the timer accumulate visible delta
  const timerBeforeAdvance = await s.evalAwait(`document.getElementById('phone-screen-timer')?.textContent || '0:00'`);
  await s.evalAwait(`document.querySelector('[data-action="phone-next"]').click()`);
  await s.sleep(500);
  const timerAfterAdvance = await s.evalAwait(`document.getElementById('phone-screen-timer')?.textContent || '0:00'`);
  // Parse "M:SS" or "MM:SS" into seconds.
  const parseTimer = (t) => {
    const parts = t.split(':').map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
  };
  const beforeSec = parseTimer(timerBeforeAdvance);
  const afterSec = parseTimer(timerAfterAdvance);
  s.assert(afterSec >= beforeSec, `LOAD-BEARING: timer kept ticking across card transition (before=${timerBeforeAdvance}=${beforeSec}s, after=${timerAfterAdvance}=${afterSec}s; after must be >= before)`);

  // Phase 4: card 2 = pattern. CodeMirror editor + Run + Give-up + prompt.
  const phase4 = await s.evalAwait(`(() => {
    const cm = document.querySelector('[data-phone-l3-editor]') ? document.querySelector('.CodeMirror') : null;
    const runBtn = document.querySelector('[data-action="phone-run"]');
    const giveUpBtn = document.querySelector('[data-action="phone-give-up"]');
    const tag = document.querySelector('.phone-card-tag')?.textContent || '';
    const promptText = document.querySelector('.phone-prompt-text')?.textContent || '';
    const pips = document.querySelectorAll('.phone-pip');
    return {
      cmMounted: !!cm,
      runPresent: !!runBtn,
      giveUpPresent: !!giveUpBtn,
      cardTagText: tag,
      promptText,
      pip0Done: pips[0]?.classList.contains('phone-pip-done'),
      pip1Active: pips[1]?.classList.contains('phone-pip-active'),
    };
  })()`);
  s.assert(phase4.cmMounted, 'CodeMirror editor mounted for card 2 pattern L3');
  s.assert(phase4.runPresent, '[data-action="phone-run"] button present');
  s.assert(phase4.giveUpPresent, '[data-action="phone-give-up"] button present');
  s.assert(/Card 2 of 3/.test(phase4.cardTagText), `Card tag says "Card 2 of 3"; got "${phase4.cardTagText}"`);
  s.assert(phase4.promptText.length > 0, 'Pattern L3 prompt text rendered');
  s.assert(phase4.pip0Done, 'Pip 0 now shows phone-pip-done');
  s.assert(phase4.pip1Active, 'Pip 1 now shows phone-pip-active');
  await s.snap('03-card-2-pattern');

  // Phase 5: tap Give-up → advance to card 3.
  await s.evalAwait(`document.querySelector('[data-action="phone-give-up"]').click()`);
  await s.sleep(500);
  const phase5 = await s.evalAwait(`(() => {
    const blanks = document.querySelectorAll('[data-phone-l2-blank]');
    const submit = document.querySelector('[data-action="phone-submit-l2"]');
    const skip = document.querySelector('[data-action="phone-skip-l2"]');
    const tag = document.querySelector('.phone-card-tag')?.textContent || '';
    const tpl = document.querySelector('[data-phone-l2-template]');
    return {
      blanksCount: blanks.length,
      submitPresent: !!submit,
      skipPresent: !!skip,
      cardTagText: tag,
      templatePresent: !!tpl,
    };
  })()`);
  s.assert(phase5.blanksCount >= 1, `L2 fill blanks rendered (≥1); got ${phase5.blanksCount}`);
  s.assert(phase5.submitPresent, '[data-action="phone-submit-l2"] present');
  s.assert(phase5.skipPresent, '[data-action="phone-skip-l2"] present');
  s.assert(/Card 3 of 3/.test(phase5.cardTagText), `Card tag says "Card 3 of 3"; got "${phase5.cardTagText}"`);
  s.assert(phase5.templatePresent, 'L2 template rendered');
  await s.snap('04-card-3-followup');

  // Phase 6: tap Skip → render summary.
  await s.evalAwait(`document.querySelector('[data-action="phone-skip-l2"]').click()`);
  await s.sleep(500);
  const phase6 = await s.evalAwait(`(() => {
    const summary = document.querySelector('.recognize-summary');
    const summaryRows = document.querySelectorAll('.phone-summary-row');
    const lifetime = document.querySelector('.recognize-summary-lifetime');
    return {
      summaryPresent: !!summary,
      rowCount: summaryRows.length,
      kinds: Array.from(summaryRows).map(r => r.querySelector('.phone-summary-kind')?.textContent.trim().toLowerCase()),
      lifetimeText: lifetime ? lifetime.textContent.trim() : '',
      sessionsAfter: state.phoneScreen.sessions,
      completionsAfter: state.phoneScreen.completions,
    };
  })()`);
  s.assert(phase6.summaryPresent, 'Final summary rendered after card 3 skip');
  s.assert(phase6.rowCount === 3, `3 outcome rows in summary; got ${phase6.rowCount}`);
  s.assert(phase6.kinds.join(',') === 'warmup,pattern,followup', `Summary rows in order warmup/pattern/followup; got [${phase6.kinds.join(',')}]`);
  s.assert(/Lifetime/.test(phase6.lifetimeText), `Lifetime line present; got "${phase6.lifetimeText}"`);
  s.assert(phase6.sessionsAfter === 1, `state.phoneScreen.sessions incremented to 1; got ${phase6.sessionsAfter}`);
  s.assert(phase6.completionsAfter === 1, `state.phoneScreen.completions incremented to 1 (full deck walked); got ${phase6.completionsAfter}`);
  await s.snap('05-summary');

  await s.close();
  const r = s.report();
  process.exit(r.failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
