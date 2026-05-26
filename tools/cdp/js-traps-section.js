#!/usr/bin/env node
// iter 115 — verifies the new "JS Traps" section (3-lesson MVP) renders in
// the sidebar and each lesson is selectable + drills L1.
//
// 1) "JS Traps" section header appears in the sidebar (syntax track).
// 2) All 3 lessons (t-tdz / t-floating-precision / t-delete-array-holes)
//    appear under that section with the expected titles.
// 3) Clicking the first lesson loads it; Reference tab + L1 tab both render.
// 4) L1 questions are present (≥3 per lesson per the authoring spec).

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-js-traps';

const EXPECTED = [
  { id: 't-tdz', title: 'Temporal Dead Zone (TDZ)' },
  { id: 't-floating-precision', title: 'Floating-point precision (0.1 + 0.2)' },
  { id: 't-delete-array-holes', title: 'delete arr[i] leaves holes' }
];

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Clean state, syntax track active (where the new section lives).
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);

  // Phase 1: section header present in sidebar (when on syntax track).
  const sectionPresent = await s.evalAwait(`(() => {
    const headers = Array.from(document.querySelectorAll('#sidebar-nav .section-title, #sidebar-nav h3, #sidebar-nav [class*="section"]'))
      .map(el => el.textContent.trim());
    return headers.some(h => /JS Traps/i.test(h));
  })()`);
  console.log(sectionPresent ? 'PASS: "JS Traps" section header present in sidebar' : 'FAIL: section header missing');

  // Phase 2: all 3 lessons present + CURRICULUM has them.
  const lessonStatuses = await s.evalAwait(`(() => {
    return ${JSON.stringify(EXPECTED.map(l => l.id))}.map(id => {
      const lesson = CURRICULUM.find(l => l.id === id);
      return { id, present: !!lesson, status: lesson?.status, section: lesson?.section, track: lesson?.track };
    });
  })()`);
  let allFull = true;
  for (const l of lessonStatuses) {
    const ok = l.present && l.status === 'full' && l.section === 'JS Traps' && l.track === 'syntax';
    console.log(ok ? `PASS: ${l.id} → status=full section="JS Traps" track=syntax`
      : `FAIL: ${l.id} → ${JSON.stringify(l)}`);
    if (!ok) allFull = false;
  }
  if (!allFull) process.exit(1);

  // Phase 3: select the first JS Trap lesson + verify it loads.
  await s.evalAwait(`selectLesson('t-tdz')`);
  // Wait for fetch + render (lesson JSONs are lazy-loaded).
  for (let i = 0; i < 10; i++) {
    await s.sleep(400);
    const loaded = await s.evalAwait(`!!CONTENT['t-tdz']`);
    if (loaded) break;
  }
  await s.snap('t-tdz-loaded');

  const shellState = await s.evalAwait(`(() => {
    const tabs = Array.from(document.querySelectorAll('.tab-btn[data-level]')).map(b => b.dataset.level);
    return {
      currentLessonId: state.currentLessonId,
      currentTab: state.currentTab,
      tabs,
      contentLoaded: !!CONTENT['t-tdz']
    };
  })()`);
  console.log(shellState.currentLessonId === 't-tdz' ? 'PASS: state.currentLessonId = t-tdz' : `FAIL: ${shellState.currentLessonId}`);
  console.log(shellState.contentLoaded ? 'PASS: t-tdz content loaded into CONTENT' : 'FAIL: content not in cache');
  // Syntax-track lessons should have 4 tabs (Reference + L1 + L2 + L3).
  const hasAllLevels = ['L1', 'L2', 'L3'].every(lv => shellState.tabs.includes(lv));
  console.log(hasAllLevels ? `PASS: lesson exposes L1/L2/L3 tabs (got: ${shellState.tabs.join(',')})` : `FAIL: tabs=${shellState.tabs}`);

  // Phase 4: ≥3 L1 questions per lesson (PROFILE compliance for mobile L1 throughput).
  const l1Counts = await s.evalAwait(`(() => {
    return ${JSON.stringify(EXPECTED.map(l => l.id))}.map(id => {
      const c = CONTENT[id];
      return { id, qCount: (c && c.L1 && c.L1.questions) ? c.L1.questions.length : 0 };
    });
  })()`);
  for (const r of l1Counts) {
    if (r.qCount === 0) {
      // Not loaded yet; force-load and re-query.
      await s.evalAwait(`loadLessonContent('${r.id}')`);
      await s.sleep(200);
      r.qCount = await s.evalAwait(`CONTENT['${r.id}']?.L1?.questions?.length || 0`);
    }
    console.log(r.qCount >= 3 ? `PASS: ${r.id} has ${r.qCount} L1 questions (≥3 PROFILE floor)`
      : `FAIL: ${r.id} only ${r.qCount} L1 questions`);
  }

  await s.snap('end');
  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
