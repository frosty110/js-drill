#!/usr/bin/env node
// Iter 12 regression probe: Mock Interview actually loads without crashing.
//
// Before iter 12, starting a mock threw
//   "Cannot read properties of null (reading 'addEventListener')"
// because the hint-button wiring (data-action="hint") wasn't null-guarded
// like the adjacent diff and reveal buttons, but the hint button is
// conditionally omitted from the markup when isMock. The crash filled the
// lesson shell with an error, and Mock Interview was unusable.
//
// Scenarios:
//   A. Click Mock → mock state active, lesson shell shows L3 surface
//      (mock banner + end-mock button + drill editor), NO error banner.
//   B. Submitting the canonical solution while mock is active triggers
//      end-mock with `passed=true`, sets `state.bestTimes[lessonId]`,
//      and the "best time" pill appears.
//   C. Hint button is absent during mock and present after end-mock.

const { ensureServer, ensureChrome, connect } = require('../lib');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-iter12-mock';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({
    url: URL,
    viewport: { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
    outDir: OUT,
  });

  await s.eval(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({ __v: 4, welcomed: true }))`);
  await s.reload();

  // Scenario A — click Mock, expect the L3 surface to render cleanly.
  await s.click('#mock-btn');
  await s.sleep(1200);            // mock content load + render
  await s.snap('A-mock-started');

  const a = await s.eval(`(() => {
    const shellText = document.getElementById('lesson-shell')?.textContent || '';
    const errLine = /Could not load lesson|Cannot read properties of null/i.test(shellText);
    return {
      mockActive: window.__jsdrillState.mock.active,
      mockLessonId: window.__jsdrillState.mock.lessonId,
      hasMockBanner: !!document.querySelector('.bg-rose-950\\\\/50'),
      hasEndMockBtn: !!document.querySelector('[data-action="end-mock"]'),
      hasHintBtn: !!document.querySelector('[data-action="hint"]'),
      hasDrillEditor: !!document.querySelector('#drill-editor, .CodeMirror'),
      errInShell: errLine,
      timer: document.getElementById('mock-timer')?.textContent,
    };
  })()`);
  console.log('Mock A state:', JSON.stringify(a, null, 2));
  s.assert(a.mockActive === true, '[A] mock state is active');
  s.assert(!a.errInShell, '[A] lesson shell does NOT show the "Could not load lesson" error');
  s.assert(a.hasMockBanner, '[A] mock banner rendered');
  s.assert(a.hasEndMockBtn, '[A] End Mock button present');
  s.assert(!a.hasHintBtn, '[A] Hint button absent during mock (hints disabled)');
  s.assert(a.hasDrillEditor, '[A] drill editor rendered');

  // Scenario B — submit the canonical to pass the mock, expect a best-time
  // pill to appear and mock to clear.
  const submission = await s.evalAwait(`(async () => {
    const id = window.__jsdrillState.mock.lessonId;
    const m = await fetch('./data/manifest.json').then(r => r.json());
    let slug;
    for (const sec of m.sections) {
      if (sec.lessons.find(l => l.id === id)) { slug = sec.slug; break; }
    }
    const lesson = await fetch('./data/' + slug + '/' + id + '.json').then(r => r.json());
    const cm = document.querySelector('.CodeMirror')?.CodeMirror;
    if (!cm) return { ok: false, reason: 'no CodeMirror' };
    cm.setValue(lesson.L3.canonical);
    document.querySelector('[data-action="run"]')?.click();
    return { ok: true, id };
  })()`);
  console.log('Submission:', submission);
  await s.sleep(1500);            // runner + render
  await s.snap('B-mock-passed');

  const b = await s.eval(`(() => ({
    mockActive: window.__jsdrillState.mock.active,
    bestForLesson: window.__jsdrillState.bestTimes[${JSON.stringify(submission?.id)}],
    feedback: document.querySelector('.feedback')?.textContent.trim().slice(0, 120),
    hintBtnAfter: !!document.querySelector('[data-action="hint"]'),
  }))()`);
  console.log('After pass:', JSON.stringify(b, null, 2));
  s.assert(b.mockActive === false, '[B] mock state cleared after pass');
  s.assert(typeof b.bestForLesson === 'number' && b.bestForLesson > 0, `[B] best time recorded (got: ${b.bestForLesson})`);
  s.assert(b.hintBtnAfter === true, '[C] hint button reappears after mock ends');

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
