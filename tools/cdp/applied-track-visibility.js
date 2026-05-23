#!/usr/bin/env node
// Iter 14 regression probe: the Applied track is surfaced consistently.
// The iter-14 audit found drift in three places — the lesson header pill
// said "Pattern" for applied-track lessons (false dichotomy fallback),
// the Today's plan modal label did the same, and the stats modal had no
// applied row at all. Each of these would have made the 20 applied
// lessons feel like second-class progress to the user.
//
// Scenarios:
//   A. Navigate to an applied-track lesson (e.g. a-debounce). The header
//      pill text reads "Applied", uses the `pill-applied` CSS class,
//      and is NOT the purple "Pattern" pill.
//   B. The stats modal contains a `[data-track-stat="applied"]` panel
//      showing N/M applied lessons mastered.
//   C. Seed an applied lesson into the daily-plan path (path-mode pick
//      is patterns-only, so verify the label helper directly on the
//      header instead — covered by A).

const { ensureServer, ensureChrome, connect } = require('./lib');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-iter14-applied';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Fresh state.
  await s.eval(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({ __v: 5, welcomed: true }))`);
  await s.reload();

  // --- Scenario A: applied-lesson header pill ---
  await s.eval(`window.selectLesson('a-debounce')`);
  await s.waitFor(`document.querySelector('#lesson-shell h2') !== null`, { timeoutMs: 5000 });
  await s.snap('A-applied-lesson-header');

  const headerPill = await s.eval(`(() => {
    const pill = document.querySelector('#lesson-shell .pill');
    return pill ? {
      classes: [...pill.classList].join(' '),
      text: pill.textContent.trim(),
    } : null;
  })()`);
  console.log('Applied lesson header pill:', JSON.stringify(headerPill));
  s.assert(headerPill && headerPill.text === 'Applied',
    `[A] header pill reads "Applied" for applied-track lesson (got: ${JSON.stringify(headerPill?.text)})`);
  s.assert(headerPill && /\bpill-applied\b/.test(headerPill.classes),
    `[A] header pill has .pill-applied class (got: ${JSON.stringify(headerPill?.classes)})`);
  s.assert(headerPill && !/\bpill-pattern\b/.test(headerPill.classes),
    `[A] header pill does NOT have .pill-pattern class`);

  // --- Scenario B: stats modal includes Applied row ---
  // Open sidebar drawer (mobile), open stats.
  await s.click('#hamburger');
  await s.sleep(200);
  await s.click('#stats-btn');
  await s.sleep(400);
  await s.snap('B-stats-modal');

  const appliedStat = await s.eval(`(() => {
    const panel = document.querySelector('[data-track-stat="applied"]');
    if (!panel) return null;
    return {
      present: true,
      text: panel.textContent.replace(/\\s+/g, ' ').trim(),
    };
  })()`);
  console.log('Applied stat panel:', JSON.stringify(appliedStat));
  s.assert(appliedStat && appliedStat.present === true,
    '[B] stats modal contains [data-track-stat="applied"] panel');
  s.assert(appliedStat && /Applied/.test(appliedStat.text) && /\d+\s*\/\s*\d+/.test(appliedStat.text),
    `[B] applied panel shows label + N/M ratio (got: ${JSON.stringify(appliedStat?.text)})`);

  // Both syntax and patterns panels should also still be there.
  const allTrackStats = await s.eval(`['syntax','patterns','applied'].map(t => !!document.querySelector('[data-track-stat="' + t + '"]'))`);
  s.assert(JSON.stringify(allTrackStats) === '[true,true,true]',
    `[B] all three track-stat panels rendered (got: ${JSON.stringify(allTrackStats)})`);

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
