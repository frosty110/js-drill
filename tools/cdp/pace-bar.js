#!/usr/bin/env node
// iter 140 — verifies ⏲ Pace-Bar (Cat 3 Mechanics, iter-139 roadmap #1).
// Opt-in toggle (default OFF) shows a peripheral-vision width-growing bar
// above the L3 editor against the user's OWN median time-to-solve. Color
// keyed to elapsed/median ratio (green <50%, amber 50-100%, red ≥100%).
//
// L75 anti-gamification invariants the probe asserts:
//   - Default state: paceBarOn=false → no [data-pace-bar] element.
//   - No data: toggle ON + zero history → bar STILL hidden (auto-hide).
//   - Median sourced from user's own mockHistory (not a global benchmark).
//   - Bar element has aria-hidden="true" + role="presentation" + NO timer text.
//   - Toggle OFF → bar disappears immediately on re-render.
//
// Phases:
//   1. Default OFF — open L3 on a Patterns lesson; no pace-bar element.
//   2. Toggle ON via #pace-bar-btn — no time data yet → bar auto-hidden.
//   3. Seed mockHistory with 4 entries (5/8/10/14 sec) → reload → enter L3.
//      Bar present; data-pace-median-ms ≈ 9000ms (median of 4); fill width
//      grows on tick interval; color transitions hit green/amber/red over time.
//   4. Toggle OFF → re-render → bar disappears.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-pace-bar';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Clean state — no mockHistory, paceBarOn omitted (defaults to false).
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);

  // Nav into a Patterns lesson's L3 tab.
  const lessonId = 'two-sum';
  await s.evalAwait(`selectLesson('${lessonId}')`);
  for (let i = 0; i < 10; i++) {
    await s.sleep(300);
    if (await s.evalAwait(`!!CONTENT['${lessonId}'] && !!CONTENT['${lessonId}'].L3`)) break;
  }
  await s.evalAwait(`selectTab('L3')`);
  await s.sleep(500);
  await s.snap('01-default-off');

  // Phase 1: paceBarOn defaults to false → no bar element on L3.
  const phase1 = await s.evalAwait(`(() => ({
    paceBarOn: state.paceBarOn === true,
    barPresent: !!document.querySelector('[data-pace-bar]'),
    toggleBtnPresent: !!document.getElementById('pace-bar-btn'),
  }))()`);
  s.assert(phase1.paceBarOn === false, 'Default state: state.paceBarOn === false');
  s.assert(!phase1.barPresent, 'Default state: no [data-pace-bar] element rendered on L3');
  s.assert(phase1.toggleBtnPresent, '#pace-bar-btn toggle button is mounted');

  // Phase 2: toggle ON with NO time data → bar STILL hidden (auto-hide).
  await s.evalAwait(`document.getElementById('pace-bar-btn').click()`);
  await s.sleep(600);
  await s.snap('02-toggle-on-no-data');
  const phase2 = await s.evalAwait(`(() => ({
    paceBarOn: state.paceBarOn === true,
    barPresent: !!document.querySelector('[data-pace-bar]'),
    medianMsResult: typeof _paceBarMedianMs === 'function' ? _paceBarMedianMs('${lessonId}') : 'NO_FN',
  }))()`);
  s.assert(phase2.paceBarOn === true, 'After toggle: state.paceBarOn === true');
  s.assert(phase2.medianMsResult === null, '_paceBarMedianMs returns null when no data (auto-hide path)');
  s.assert(!phase2.barPresent, 'Bar still HIDDEN when paceBarOn=true but no data (L75: silent off-state, no nag)');

  // Phase 3: seed mockHistory with 4 entries → reload → re-enter L3.
  // Medians (sorted): [5000, 8000, 10000, 14000] → (8000+10000)/2 = 9000.
  await s.evalAwait(`(() => {
    const cur = JSON.parse(localStorage.getItem('jsdrill.progress.v1'));
    cur.mockHistory = { '${lessonId}': [5000, 8000, 10000, 14000] };
    cur.paceBarOn = true;
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(cur));
  })()`);
  await s.reload();
  await s.sleep(700);
  await s.evalAwait(`selectLesson('${lessonId}')`);
  for (let i = 0; i < 10; i++) {
    await s.sleep(300);
    if (await s.evalAwait(`!!CONTENT['${lessonId}'] && !!CONTENT['${lessonId}'].L3`)) break;
  }
  await s.evalAwait(`selectTab('L3')`);
  await s.sleep(600);
  await s.snap('03-bar-rendered');

  const phase3a = await s.evalAwait(`(() => {
    const bar = document.querySelector('[data-pace-bar]');
    const fill = document.querySelector('[data-pace-bar-fill]');
    if (!bar || !fill) return { barPresent: false };
    const widthInit = parseFloat(fill.style.width) || 0;
    return {
      barPresent: true,
      medianAttr: parseInt(bar.getAttribute('data-pace-median-ms'), 10),
      ariaHidden: bar.getAttribute('aria-hidden'),
      role: bar.getAttribute('role'),
      widthInit,
      hasGreen: fill.classList.contains('pace-bar-green'),
      barText: bar.textContent.trim(),  // L75 invariant: no numerals shown
    };
  })()`);
  s.assert(phase3a.barPresent, 'Bar element rendered when paceBarOn + median data present');
  s.assert(phase3a.medianAttr === 9000, `data-pace-median-ms = 9000 (median of [5,8,10,14]k); got ${phase3a.medianAttr}`);
  s.assert(phase3a.ariaHidden === 'true', 'aria-hidden="true" on bar (decorative, peripheral)');
  s.assert(phase3a.role === 'presentation', 'role="presentation" on bar (not an interactive widget)');
  s.assert(phase3a.barText === '', 'L75 invariant: no numerals/text shown inside the bar element');
  // Initial paint happens at t=0; the 500ms tick interval fires ≥1 time before
  // we measure (probe waits 600ms to let the L3 render settle). One 500ms tick
  // at median=9000ms → width = 500/9000 * 100 ≈ 5.6%. Ceiling at 10% to assert
  // "starts small" without being brittle to ±100ms probe-timing jitter.
  s.assert(phase3a.widthInit < 10, `Initial fill width < 10% (one tick into a 9000ms median); got ${phase3a.widthInit}`);
  s.assert(phase3a.hasGreen, 'Initial color class = pace-bar-green (elapsed/median < 50%)');

  // Wait long enough for the fill to grow into the amber band:
  // median = 9000ms; amber threshold at pct=0.5 = 4500ms elapsed.
  await s.sleep(5000);
  const phase3b = await s.evalAwait(`(() => {
    const fill = document.querySelector('[data-pace-bar-fill]');
    if (!fill) return { fillPresent: false };
    return {
      fillPresent: true,
      width: parseFloat(fill.style.width) || 0,
      hasGreen: fill.classList.contains('pace-bar-green'),
      hasAmber: fill.classList.contains('pace-bar-amber'),
      hasRed: fill.classList.contains('pace-bar-red'),
    };
  })()`);
  s.assert(phase3b.fillPresent, 'Fill still present after 5s soak');
  s.assert(phase3b.width >= 45, `Fill width >= 45% after ~5s of 9s median (pct ≈ 0.55); got ${phase3b.width}`);
  s.assert(phase3b.hasAmber && !phase3b.hasGreen, `Color transitioned green→amber after crossing 50% (green=${phase3b.hasGreen} amber=${phase3b.hasAmber})`);
  await s.snap('04-bar-amber');

  // Wait through the 100% threshold; bar should hit red and clamp at 100% width.
  // Total elapsed by now ≈ 5s; we need >9s total → sleep another 5s.
  await s.sleep(5000);
  const phase3c = await s.evalAwait(`(() => {
    const fill = document.querySelector('[data-pace-bar-fill]');
    if (!fill) return { fillPresent: false };
    return {
      fillPresent: true,
      width: parseFloat(fill.style.width) || 0,
      hasRed: fill.classList.contains('pace-bar-red'),
    };
  })()`);
  s.assert(phase3c.width >= 99.5 && phase3c.width <= 100, `Fill width clamped at 100% past median; got ${phase3c.width}`);
  s.assert(phase3c.hasRed, 'Color transitioned to pace-bar-red after crossing 100% ratio');
  await s.snap('05-bar-red');

  // Phase 4: toggle OFF → bar disappears on re-render.
  await s.evalAwait(`document.getElementById('pace-bar-btn').click()`);
  await s.sleep(500);
  await s.snap('06-toggle-off');
  const phase4 = await s.evalAwait(`(() => ({
    paceBarOn: state.paceBarOn === true,
    barPresent: !!document.querySelector('[data-pace-bar]'),
    intervalCleared: !window._paceBarInterval,
  }))()`);
  s.assert(phase4.paceBarOn === false, 'After second click: state.paceBarOn === false');
  s.assert(!phase4.barPresent, 'Bar removed from DOM after toggle OFF + re-render');
  s.assert(phase4.intervalCleared, 'window._paceBarInterval cleared on toggle OFF (no orphan tick)');

  await s.close();
  const r = s.report();
  process.exit(r.failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
