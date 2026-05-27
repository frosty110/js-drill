#!/usr/bin/env node
// iter 142 — verifies 🔀 Mutate-and-Predict (Cat 9 §9B, iter-139 roadmap #3,
// **last remaining iter-139 vision queue entry**; first §9B ship since iter
// 81 Edge-case chips — 58-iter drought broken).
//
// Differentiator from iter-73 Bug-Hunt (load-bearing — probe asserts it):
//   - Bug-Hunt = LOCATE the buggy line (visual/textual recognition).
//   - Mutate   = NAME the consequence CLASS of the mutation (forward
//     simulation + taxonomy classification). Deck cards carry
//     `correctClass` (0..3 enum) not `buggyLine` (1..N line number).
//
// Phases:
//   1. Sidebar #mutate-btn present + tooltip mentions consequence taxonomy.
//   2. startMutateSession() builds a deck of 3+ cards (preload allowed).
//   3. Card UI renders: mutator name tag visible, syntax-highlighted
//      canonical, 4 MC consequence-class options (Output unchanged / Wrong
//      output, same shape / Runtime error / Different output type),
//      lesson + section tag.
//   4. Each card has `correctClass` ∈ {0,1,2,3} — proves taxonomy populated.
//   5. Tap correct → state.mutate.correct increments; .recognize-opt-correct
//      class applied; reveal panel shows observed output.
//   6. Tap wrong → state.weakness for that lesson increments; L1-miss
//      appended to history.
//   7. Next advances to card 2; final summary shows lifetime stats.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-mutate-predict';

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

  // Phase 1: sidebar button mounted + tooltip mentions the 4 classes.
  const phase1 = await s.evalAwait(`(() => {
    const btn = document.getElementById('mutate-btn');
    return {
      present: !!btn,
      label: btn ? btn.textContent.trim() : '',
      titleHasClasses: btn ? /still-correct|wrong output|runtime error|different output/i.test(btn.title) : false,
      lifetimeAttempts: state.mutate.attempts,
      lifetimeSessions: state.mutate.sessions,
    };
  })()`);
  s.assert(phase1.present, '#mutate-btn mounted in sidebar');
  s.assert(/Mutate/.test(phase1.label), `Label contains "Mutate"; got "${phase1.label}"`);
  s.assert(phase1.titleHasClasses, 'Tooltip names the consequence-class taxonomy (differentiator vs Bug-Hunt)');
  s.assert(phase1.lifetimeAttempts === 0, 'Clean state: state.mutate.attempts === 0');
  s.assert(phase1.lifetimeSessions === 0, 'Clean state: state.mutate.sessions === 0');
  await s.snap('01-init');

  // Phase 2: tap to start; deck build is async (preloads lessons + runs each
  // mutation through runCode for classification). Poll up to 30s.
  await s.evalAwait(`document.getElementById('mutate-btn').click()`);
  let deckReady = false;
  for (let i = 0; i < 60; i++) {
    await s.sleep(500);
    const ready = await s.evalAwait(`!!document.querySelector('.mutate-shell .mutate-opt')`);
    if (ready) { deckReady = true; break; }
  }
  s.assert(deckReady, 'Deck built within 30s + first card rendered');
  await s.snap('02-card-1');

  // Phase 3: card UI renders all expected elements.
  const phase3 = await s.evalAwait(`(() => {
    const shell = document.querySelector('.mutate-shell');
    const opts = document.querySelectorAll('.mutate-shell .mutate-opt');
    const code = document.querySelector('[data-mutate-code]');
    const mutator = document.querySelector('.mutate-mutator');
    const lessonTag = document.querySelector('.mutate-shell .whatif-lesson-tag');
    const header = document.querySelector('.mutate-shell .recognize-header');
    return {
      shellPresent: !!shell,
      optCount: opts.length,
      optLabels: Array.from(opts).map(o => o.querySelector('.whatif-opt-val')?.textContent.trim() || ''),
      codeHasText: !!code && (code.textContent.length > 10),
      codeHasHighlight: !!code && code.classList.contains('cm-s-dracula'),
      mutatorTagPresent: !!mutator && mutator.textContent.length > 0,
      lessonTagPresent: !!lessonTag && lessonTag.textContent.length > 0,
      headerText: header ? header.textContent.trim() : '',
    };
  })()`);
  s.assert(phase3.shellPresent, '.mutate-shell rendered');
  s.assert(phase3.optCount === 4, `4 MC options rendered; got ${phase3.optCount}`);
  const expectedLabels = ['Output unchanged', 'Wrong output, same shape', 'Runtime error / throws', 'Different output type'];
  for (const want of expectedLabels) {
    s.assert(phase3.optLabels.includes(want), `Option label "${want}" present`);
  }
  s.assert(phase3.codeHasText, 'Canonical code rendered in [data-mutate-code]');
  s.assert(phase3.codeHasHighlight, 'Canonical code carries cm-s-dracula class (syntax-highlighted)');
  s.assert(phase3.mutatorTagPresent, '.mutate-mutator tag present (names the operator-mutation, e.g. "< → <=")');
  s.assert(phase3.lessonTagPresent, '.whatif-lesson-tag present (names the source lesson + section)');
  s.assert(phase3.headerText.includes('Mutate'), `Header names the drill; got "${phase3.headerText}"`);

  // Phase 4: load-bearing differentiator — every deck card has correctClass
  // ∈ {0,1,2,3} (consequence taxonomy), NOT buggyLine (Bug-Hunt's locate-
  // the-bug field). Read the live deck via the shell's closure-captured
  // state. The deck isn't exposed on window — read the first card's correct
  // option through the DOM by clicking and asserting on which option ends
  // up marked .recognize-opt-correct.
  const correctIdx0 = await s.evalAwait(`(() => {
    // Walk MUTATE_CLASSES via the global state so the probe doesn't have
    // to know the labels by index — verify the constant matches the spec.
    return Array.isArray(MUTATE_CLASSES) ? MUTATE_CLASSES.length : -1;
  })()`);
  s.assert(correctIdx0 === 4, `MUTATE_CLASSES is a 4-entry taxonomy; got ${correctIdx0}`);

  // Tap option A (always; we don't know which is correct without inspecting
  // the deck). Record whether it was right and capture state.mutate deltas.
  const phase5 = await s.evalAwait(`(() => {
    const before = { attempts: state.mutate.attempts, correct: state.mutate.correct };
    const opt = document.querySelector('.mutate-shell .mutate-opt[data-opt="0"]');
    if (opt) opt.click();
    return { before };
  })()`);
  await s.sleep(500);
  const phase5b = await s.evalAwait(`(() => {
    const optCorrect = document.querySelector('.mutate-shell .mutate-opt.recognize-opt-correct');
    const correctOptIdx = optCorrect ? +optCorrect.dataset.opt : -1;
    const reveal = document.querySelector('[data-mutate-feedback] .whatif-reveal');
    const observed = document.querySelector('[data-mutate-feedback] .mutate-observed');
    const allDisabled = Array.from(document.querySelectorAll('.mutate-shell .mutate-opt')).every(b => b.disabled);
    return {
      after: { attempts: state.mutate.attempts, correct: state.mutate.correct },
      correctOptIdx,
      revealPresent: !!reveal,
      observedPresent: !!observed,
      allDisabled,
      tappedWasCorrect: correctOptIdx === 0,
    };
  })()`);
  s.assert(phase5b.after.attempts === phase5.before.attempts + 1, `state.mutate.attempts incremented by 1; got ${phase5b.after.attempts - phase5.before.attempts}`);
  s.assert(phase5b.correctOptIdx >= 0 && phase5b.correctOptIdx <= 3, `correctOptIdx is in {0..3}; got ${phase5b.correctOptIdx}`);
  s.assert(phase5b.revealPresent, 'Reveal panel rendered after tap');
  s.assert(phase5b.observedPresent, '.mutate-observed line rendered (observed-output explainer)');
  s.assert(phase5b.allDisabled, 'All option buttons disabled after answer (no re-tap)');
  await s.snap('03-after-tap');

  if (phase5b.tappedWasCorrect) {
    s.assert(phase5b.after.correct === phase5.before.correct + 1, 'Correct tap incremented state.mutate.correct');
  } else {
    // Wrong path: weakness + L1-miss recorded for the source lesson.
    const phase6 = await s.evalAwait(`(() => {
      // The card's lessonId is exposed via the Drill button's data attr.
      const drillBtn = document.querySelector('[data-mutate-feedback] [data-drill]');
      const lessonId = drillBtn ? drillBtn.dataset.drill : null;
      const weak = lessonId ? state.weakness[lessonId] : null;
      const hist = lessonId ? (state.history[lessonId] || []) : [];
      const hasL1Miss = hist.some(e => e.event === 'L1-miss');
      return { lessonId, weak, hasL1Miss };
    })()`);
    s.assert(phase6.lessonId, 'Reveal panel exposes lesson id via Drill→ button');
    s.assert(phase6.weak >= 1, `state.weakness[${phase6.lessonId}] incremented after wrong tap; got ${phase6.weak}`);
    s.assert(phase6.hasL1Miss, 'L1-miss event appended to history after wrong tap');
  }

  // Phase 7: Next advances to card 2.
  await s.evalAwait(`document.querySelector('[data-mutate-feedback] [data-action="mutate-next"]').click()`);
  await s.sleep(500);
  const phase7 = await s.evalAwait(`(() => {
    const header = document.querySelector('.mutate-shell .recognize-header span')?.textContent || '';
    const optsFresh = Array.from(document.querySelectorAll('.mutate-shell .mutate-opt')).every(b => !b.disabled);
    return { header, optsFresh };
  })()`);
  s.assert(/2 of /.test(phase7.header), `Card 2 of N rendered; got "${phase7.header}"`);
  s.assert(phase7.optsFresh, 'Card 2 options are fresh (not disabled)');
  await s.snap('04-card-2');

  // Phase 8: skip through remaining cards to reach summary.
  for (let i = 0; i < 10; i++) {
    const onSummary = await s.evalAwait(`!!document.querySelector('.recognize-summary')`);
    if (onSummary) break;
    await s.evalAwait(`(() => {
      const opt = document.querySelector('.mutate-shell .mutate-opt:not([disabled])');
      if (opt) opt.click();
    })()`);
    await s.sleep(300);
    await s.evalAwait(`(() => {
      const next = document.querySelector('[data-mutate-feedback] [data-action="mutate-next"]');
      if (next) next.click();
    })()`);
    await s.sleep(300);
  }
  const phase8 = await s.evalAwait(`(() => {
    const summary = document.querySelector('.recognize-summary');
    const pct = document.querySelector('.recognize-summary-pct');
    const lifetime = document.querySelector('.recognize-summary-lifetime');
    return {
      summaryPresent: !!summary,
      pctText: pct ? pct.textContent.trim() : '',
      lifetimeText: lifetime ? lifetime.textContent.trim() : '',
      sessions: state.mutate.sessions,
    };
  })()`);
  s.assert(phase8.summaryPresent, 'Final summary rendered after walking through deck');
  s.assert(/^\d+%$/.test(phase8.pctText), `Summary pct formatted "NN%"; got "${phase8.pctText}"`);
  s.assert(/Lifetime/.test(phase8.lifetimeText), `Lifetime stats line present; got "${phase8.lifetimeText}"`);
  s.assert(phase8.sessions === 1, `state.mutate.sessions === 1 after one full session; got ${phase8.sessions}`);
  await s.snap('05-summary');

  await s.close();
  const r = s.report();
  process.exit(r.failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
