#!/usr/bin/env node
// Verifies iter-38 URL deep-linking at iPhone viewport: loading a #/lesson/tab
// URL routes to that exact surface; selectTab updates the hash; hashchange
// from external nav re-routes; invalid lesson IDs fall back gracefully.
// See ideas-by-category.md § UI/UX Experience → "URL deep linking" entry.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL_BASE = (process.argv[2] || 'http://localhost:8765/').replace(/\/$/, '');
const OUT = process.argv[3] || '/tmp/jsdrill-deep-link';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL_BASE + '/', mobile: true, outDir: OUT });

  // Pick a known full lesson + a second one for the hashchange test.
  const { firstId, secondId } = await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const lessons = m.sections.flatMap(s => s.lessons).filter(l => l.status === 'full');
    return { firstId: lessons[0]?.id, secondId: lessons[1]?.id };
  })()`);
  if (!firstId || !secondId) { console.error('FAIL: need 2 full lessons'); process.exit(1); }

  // Seed welcomed=true so banner doesn't intercept.
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, hideMastered: false,
    reviews: {}, weakness: {}, history: {},
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);

  // Reconnect with the deep-link URL.
  const s2 = await connect({ url: URL_BASE + '/#/' + firstId + '/L1', mobile: true, outDir: OUT });
  await s2.sleep(700);
  await s2.snap('deep-link-load');

  // Assert 1: lesson + tab match the URL.
  const loadedLesson = await s2.evalAwait(`state?.currentLessonId`);
  const loadedTab = await s2.evalAwait(`state?.currentTab`);
  console.log(loadedLesson === firstId ? `PASS: loaded lesson = ${firstId}` : `FAIL: loaded lesson = ${loadedLesson}, expected ${firstId}`);
  console.log(loadedTab === 'L1' ? `PASS: loaded tab = L1` : `FAIL: loaded tab = ${loadedTab}, expected L1`);

  // Assert 2: URL hash reflects the resolved state.
  const hashLoaded = await s2.evalAwait(`window.location.hash`);
  console.log(hashLoaded === '#/' + firstId + '/L1' ? `PASS: hash preserved as ${hashLoaded}` : `FAIL: hash = ${hashLoaded}`);

  // Act: switch to L2 via the tab button — hash should update.
  await s2.evalAwait(`document.querySelector('.tab-btn[data-level="L2"]').click()`);
  await s2.sleep(200);
  const hashAfterTabSwitch = await s2.evalAwait(`window.location.hash`);
  console.log(hashAfterTabSwitch === '#/' + firstId + '/L2'
    ? `PASS: tab switch updated hash to ${hashAfterTabSwitch}`
    : `FAIL: hash after tab switch = ${hashAfterTabSwitch}`);

  // Act: simulate external nav (paste URL / back-forward) by setting hash directly.
  await s2.evalAwait(`window.location.hash = '#/' + ${JSON.stringify(secondId)} + '/reference'`);
  await s2.sleep(300);
  const lessonAfterExt = await s2.evalAwait(`state?.currentLessonId`);
  const tabAfterExt = await s2.evalAwait(`state?.currentTab`);
  console.log(lessonAfterExt === secondId && tabAfterExt === 'reference'
    ? `PASS: external hashchange re-routed to ${secondId}/reference`
    : `FAIL: ext-nav landed on ${lessonAfterExt}/${tabAfterExt}, expected ${secondId}/reference`);

  // Act: invalid lesson ID in hash — should be ignored (no crash, no nav).
  const beforeBad = await s2.evalAwait(`state?.currentLessonId`);
  await s2.evalAwait(`window.location.hash = '#/this-lesson-does-not-exist/L1'`);
  await s2.sleep(250);
  const afterBad = await s2.evalAwait(`state?.currentLessonId`);
  console.log(afterBad === beforeBad
    ? `PASS: invalid lesson ID ignored (stayed on ${beforeBad})`
    : `FAIL: navigated to invalid lesson — ended on ${afterBad}`);

  await s2.snap('after-external-nav');
  console.log('\\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
