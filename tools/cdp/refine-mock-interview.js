// Drives the Mock Interview shell end-to-end to capture the post-game win
// state in three scenarios:
//   (1) first-pass: no prior bestTime exists yet  → "first mock pass" tier
//   (2) new-PB:     prior bestTime, this pass is faster → "new personal best (was …, X faster)"
//   (3) off-best:   prior bestTime, this pass is slower → "X off your best (was …)"
// This probe is the refinement-loop verifier for iter 4 (mock-interview).
//
// Pattern adapted from tools/cdp/mock-history-trend.js (selectLesson →
// startMockInterview → setValue via .CodeMirror → click run → wait for
// state.mock.active === false).
//
// Run:
//   node tools/cdp/refine-mock-interview.js [outDir]
// Default outDir: /tmp/jsdrill-refine-04

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('./lib');

const OUT = process.argv[2] || '/tmp/jsdrill-refine-04';
const LESSON_ID = 'two-sum';

async function runMockOnce(s, lessonId) {
  await s.eval(`window.selectLesson(${JSON.stringify(lessonId)})`);
  await s.waitFor(`document.querySelector('#lesson-shell h2') !== null`, { timeoutMs: 6000 });
  await s.eval(`window.startMockInterview(${JSON.stringify(lessonId)})`);
  await s.waitFor(`document.querySelector('[data-action="end-mock"]') !== null`, { timeoutMs: 6000 });
  await s.waitFor(`document.querySelector('.CodeMirror') !== null`, { timeoutMs: 6000 });
  await s.sleep(200);
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
  await s.waitFor(`window.__jsdrillState.mock.active === false`, { timeoutMs: 6000 });
}

async function captureWinState(s, scenario) {
  const feedback = await s.eval(`document.querySelector('.feedback')?.innerText?.trim() || ''`);
  // Scroll the action bar (which contains .feedback) into view so the
  // screenshot actually shows the win line. Without this the L3 page is
  // tall enough that the feedback lands below the 900px viewport fold.
  await s.eval(`document.querySelector('#lesson-shell .l3-actions')?.scrollIntoView({block:'center'})`);
  await s.sleep(200);
  await s.snap(`${scenario}-win`);
  return feedback;
}

(async () => {
  await ensureServer({ port: 8765, dir: path.resolve(__dirname, '../..') });
  await ensureChrome();
  const s = await connect({
    url: 'http://localhost:8765/',
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
    outDir: OUT
  });

  // Scenario 1: first-pass — no prior best.
  await s.seedLocalStorage('jsdrill.progress.v1', {
    __v: 5, progress: {}, bestTimes: {}, mockHistory: {}, welcomed: true, syncHintShown: true
  });
  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await s.snap('00-app-loaded');
  await runMockOnce(s, LESSON_ID);
  const fb1 = await captureWinState(s, '01-first-pass');
  s.assert(/Solved in/.test(fb1), `[first-pass] feedback shows Solved time`);
  s.assert(/first mock pass/.test(fb1), `[first-pass] feedback names the no-prior-best tier`);
  console.log('\n[1] first-pass feedback:');
  console.log('   ', JSON.stringify(fb1));

  // Scenario 2: new-PB — prior bestTime is 10:00, this pass beats it.
  await s.seedLocalStorage('jsdrill.progress.v1', {
    __v: 5, progress: {},
    bestTimes: { [LESSON_ID]: 600000 },
    mockHistory: { [LESSON_ID]: [600000] },
    welcomed: true, syncHintShown: true
  });
  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await runMockOnce(s, LESSON_ID);
  const fb2 = await captureWinState(s, '02-new-pb');
  s.assert(/Solved in/.test(fb2), `[new-PB] feedback shows Solved time`);
  s.assert(/new personal best/.test(fb2), `[new-PB] feedback names the PB tier`);
  s.assert(/was 10:00/.test(fb2), `[new-PB] feedback shows the prior best (10:00)`);
  s.assert(/faster/.test(fb2), `[new-PB] feedback shows the delta direction (faster)`);
  console.log('\n[2] new-PB feedback:');
  console.log('   ', JSON.stringify(fb2));

  // Scenario 3: off-best — prior bestTime is 1ms, this pass cannot beat it.
  await s.seedLocalStorage('jsdrill.progress.v1', {
    __v: 5, progress: {},
    bestTimes: { [LESSON_ID]: 1 },
    mockHistory: { [LESSON_ID]: [1] },
    welcomed: true, syncHintShown: true
  });
  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await runMockOnce(s, LESSON_ID);
  const fb3 = await captureWinState(s, '03-off-best');
  s.assert(/Solved in/.test(fb3), `[off-best] feedback shows Solved time`);
  s.assert(/off your best/.test(fb3), `[off-best] feedback names the off-best tier`);
  console.log('\n[3] off-best feedback:');
  console.log('   ', JSON.stringify(fb3));

  s.report();
  await s.close();
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
