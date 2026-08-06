#!/usr/bin/env node
// Iter 13 regression probe: Mock Interview surfaces a rolling history of
// the last N=MOCK_HISTORY_MAX successful attempts so the user can see
// whether they're improving (PROFILE.md success criterion #3 — "Mock
// interview personal-bests trend down over weeks" requires a *trend*
// to be visible, not just a single PB number).
//
// Scenarios:
//   A. Three sequential mock attempts on the same lesson land all three
//      times in `state.mockHistory[lessonId]` (oldest→newest), and the
//      chip on the L3 surface renders them in that order.
//   B. The PB cell in the chip is marked with a leading "★".
//   C. The history is capped to MOCK_HISTORY_MAX (5) entries; a 6th
//      attempt evicts the oldest.
//   D. The chip is hidden when only 1 attempt exists (no trend yet).

const { ensureServer, ensureChrome, connect } = require('../lib');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-iter13-mock-history';
const MAX = 5;

async function runMockOnce(s, lessonId) {
  // Drive mock through the same path the app's Mock button uses, but
  // targeting a specific lesson. Top-level fns in app.js (no IIFE wrapper)
  // are window-globals — so we can call selectLesson + startMockInterview
  // directly. selectLesson triggers content load; we wait for it before
  // starting the mock (mock relies on the content cache).
  await s.eval(`window.selectLesson(${JSON.stringify(lessonId)})`);
  // Wait until renderLesson has settled — the L1 button is rendered only
  // once content has loaded (the "Loading…" placeholder is replaced by the
  // real lesson body).
  await s.waitFor(`document.querySelector('#lesson-shell h2') !== null`, { timeoutMs: 5000 });
  await s.eval(`window.startMockInterview(${JSON.stringify(lessonId)})`);
  await s.waitFor(`document.querySelector('[data-action="end-mock"]') !== null`, { timeoutMs: 5000 });
  await s.waitFor(`document.querySelector('.CodeMirror') !== null`, { timeoutMs: 5000 });
  // Give CodeMirror a moment to fully initialize after the textarea swap.
  await s.sleep(150);

  // Fetch canonical, paste, run.
  await s.evalAwait(`(async () => {
    const id = ${JSON.stringify(lessonId)};
    const m = await fetch('./data/manifest.json').then(r => r.json());
    let slug;
    for (const sec of m.sections) {
      if (sec.lessons.find(l => l.id === id)) { slug = sec.slug; break; }
    }
    const lesson = await fetch('./data/' + slug + '/' + id + '.json').then(r => r.json());
    const cm = document.querySelector('.CodeMirror').CodeMirror;
    cm.setValue(lesson.L3.canonical);
    document.querySelector('[data-action="run"]').click();
  })()`);
  // Wait for end-mock (state.mock.active flips false)
  await s.waitFor(`window.__jsdrillState.mock.active === false`, { timeoutMs: 5000 });
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({
    url: URL,
    viewport: { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
    outDir: OUT,
  });

  await s.eval(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({ __v: 5, welcomed: true }))`);
  await s.reload();

  // Use a small, fast pattern lesson for the mocks.
  const lessonId = 'two-sum';

  // Scenario D — start once, no chip yet (only 1 attempt).
  await runMockOnce(s, lessonId);
  await s.snap('D-after-first-attempt');
  const after1 = await s.eval(`(() => ({
    history: window.__jsdrillState.mockHistory['two-sum'],
    chipPresent: !!document.querySelector('.pill[title*="mock attempts"]'),
  }))()`);
  console.log('After 1:', JSON.stringify(after1));
  s.assert(Array.isArray(after1.history) && after1.history.length === 1,
    `[D] one history entry after first attempt (got ${JSON.stringify(after1.history)})`);
  s.assert(after1.chipPresent === false,
    '[D] trend chip hidden with only 1 attempt');

  // Scenario A — second + third attempts. Chip should appear and contain
  // all 3 times in order.
  await runMockOnce(s, lessonId);
  await runMockOnce(s, lessonId);
  await s.snap('A-after-three-attempts');
  const after3 = await s.eval(`(() => {
    const chip = document.querySelector('.pill[title*="mock attempts"]');
    return {
      history: window.__jsdrillState.mockHistory['two-sum'],
      chipText: chip?.textContent.trim(),
      chipTitle: chip?.getAttribute('title'),
    };
  })()`);
  console.log('After 3:', JSON.stringify(after3, null, 2));
  s.assert(Array.isArray(after3.history) && after3.history.length === 3,
    `[A] three history entries after three mocks (got length ${after3.history?.length})`);
  s.assert(after3.chipText && after3.chipText.includes('·'),
    `[A] chip renders multiple cells separated by "·" (got: ${JSON.stringify(after3.chipText)})`);
  // Count the cells (split on "·").
  const cellCount = (after3.chipText || '').split('·').length;
  s.assert(cellCount === 3, `[A] chip has 3 cells (got ${cellCount})`);

  // Scenario B — at least one cell starts with "★" marking the PB. Because
  // all three mock submissions used the same canonical solution, one of
  // them is the PB (the fastest).
  s.assert(/★/.test(after3.chipText || ''),
    `[B] PB cell marked with leading "★" (got: ${JSON.stringify(after3.chipText)})`);

  // Scenario C — drive 3 more attempts (6 total), assert capped at 5.
  await runMockOnce(s, lessonId);
  await runMockOnce(s, lessonId);
  await runMockOnce(s, lessonId);
  await s.snap('C-after-six-attempts');
  const after6 = await s.eval(`(() => ({
    history: window.__jsdrillState.mockHistory['two-sum'],
  }))()`);
  console.log('After 6 attempts, history length:', after6.history?.length);
  s.assert(Array.isArray(after6.history) && after6.history.length === MAX,
    `[C] history capped at ${MAX} entries (got ${after6.history?.length})`);

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
