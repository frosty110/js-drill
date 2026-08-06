#!/usr/bin/env node
// iter 114 — verifies ☁️ Sync Onboarding hint banner on DESKTOP viewport.
// The banner is gated on (fine pointer + ≥768px viewport + Sync chip
// mounted + state.syncHintShown false + L3 pass just happened); none of
// those conditions match the default mobile-emulated probe context, so
// this probe explicitly skips the mobile flag.
//
// 1) Clean state + no L3 pass → no banner.
// 2) Mark an L3 pass → banner appears.
// 3) Tap Dismiss → banner removed + state.syncHintShown = true.
// 4) Re-render: no banner reappears (one-time invariant).
// 5) Tap-Sync path: simulate fresh state, mark L3 pass, click Tap Sync
//    → existing #sync-chip click handler is invoked (sync-modal opens).
// 6) Mobile-emulated viewport: banner does NOT show (PROFILE-aware gating).

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-sync-onboard';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  // Desktop viewport — banner is desktop-only by design.
  const s = await connect({ url: URL, viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, outDir: OUT });

  // Phase 1: clean state — no banner present.
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    syncHintShown: false,
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(1500);

  const initialBanner = await s.evalAwait(`!!document.getElementById('sync-hint-banner')`);
  console.log(!initialBanner ? 'PASS: no banner on clean state' : 'FAIL: banner present before L3 pass');

  // Verify the Sync chip is mounted (js/sync.js has loaded).
  const chipMounted = await s.evalAwait(`!!document.getElementById('sync-chip')`);
  console.log(chipMounted ? 'PASS: #sync-chip mounted (js/sync.js loaded)' : 'FAIL: sync chip missing — js/sync.js failed to load');
  if (!chipMounted) process.exit(1);

  // Phase 2: simulate an L3 pass — banner should appear.
  const firstLessonId = await s.evalAwait(`CURRICULUM.find(l => l.status === 'full')?.id`);
  if (!firstLessonId) { console.error('FAIL: no full lessons'); process.exit(1); }
  await s.evalAwait(`markPassed('${firstLessonId}', 'L3')`);
  await s.sleep(400);

  const bannerVisible = await s.evalAwait(`(() => {
    const el = document.getElementById('sync-hint-banner');
    if (!el) return { present: false };
    return {
      present: true,
      shown: el.classList.contains('sync-hint-show'),
      title: el.querySelector('.sync-hint-title')?.textContent,
      hasTap: !!el.querySelector('[data-action="tap-sync"]'),
      hasDismiss: !!el.querySelector('[data-action="dismiss"]')
    };
  })()`);
  console.log(bannerVisible.present ? 'PASS: banner appears after L3 pass' : 'FAIL: banner missing');
  console.log(bannerVisible.shown ? 'PASS: banner has slide-in class' : 'FAIL: banner not animated in');
  console.log(bannerVisible.hasTap && bannerVisible.hasDismiss ? 'PASS: banner has Tap Sync + Dismiss buttons' : 'FAIL: banner missing actions');
  await s.snap('banner-shown');

  // Phase 3: Dismiss → banner removed + state.syncHintShown = true.
  await s.evalAwait(`document.querySelector('[data-action="dismiss"]').click()`);
  await s.sleep(400);
  const afterDismiss = await s.evalAwait(`({
    bannerGone: !document.getElementById('sync-hint-banner'),
    flagSet: state.syncHintShown === true
  })`);
  console.log(afterDismiss.bannerGone ? 'PASS: banner removed after Dismiss' : 'FAIL: banner still in DOM');
  console.log(afterDismiss.flagSet ? 'PASS: state.syncHintShown = true' : 'FAIL: flag not set');

  // Phase 4: re-trigger L3 pass — banner should NOT reappear (one-time invariant).
  const secondLessonId = await s.evalAwait(`CURRICULUM.filter(l => l.status === 'full')[1]?.id`);
  await s.evalAwait(`markPassed('${secondLessonId}', 'L3')`);
  await s.sleep(300);
  const noRebanner = await s.evalAwait(`!document.getElementById('sync-hint-banner')`);
  console.log(noRebanner ? 'PASS: banner does NOT reappear (one-time invariant)' : 'FAIL: banner reappeared');

  // Phase 5: Tap-Sync path. Reset state, trigger banner, click Tap Sync.
  await s.evalAwait(`(() => {
    state.syncHintShown = false;
    state.progress = {};
    saveProgress();
  })()`);
  await s.evalAwait(`markPassed('${firstLessonId}', 'L3')`);
  await s.sleep(400);
  const bannerBackForTap = await s.evalAwait(`!!document.getElementById('sync-hint-banner')`);
  console.log(bannerBackForTap ? 'PASS: banner re-appears after state reset' : 'FAIL: banner gone');

  // Click Tap Sync — should set the flag + close banner + click #sync-chip.
  // The chip click opens the sync-modal (defined inside js/sync.js).
  await s.evalAwait(`document.querySelector('[data-action="tap-sync"]').click()`);
  await s.sleep(500);
  const afterTap = await s.evalAwait(`({
    bannerGone: !document.getElementById('sync-hint-banner'),
    flagSet: state.syncHintShown === true,
    modalOpen: !!document.querySelector('#sync-modal.is-open')
  })`);
  console.log(afterTap.bannerGone ? 'PASS: banner removed after Tap Sync' : 'FAIL: banner persisted');
  console.log(afterTap.flagSet ? 'PASS: flag set on Tap Sync path' : 'FAIL: flag not set');
  console.log(afterTap.modalOpen ? 'PASS: #sync-chip click invoked → sync-modal opened' : 'FAIL: sync-modal did not open');

  await s.snap('after-tap');
  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
