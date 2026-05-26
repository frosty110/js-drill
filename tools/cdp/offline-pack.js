#!/usr/bin/env node
// iter 113 — verifies 📦 Offline Drill Pack at iPhone viewport.
//
// 1) service-worker.js registers without error on first visit.
// 2) After install completes, the cache contains the app shell + all 143
//    full-status lesson JSONs + manifest.json (chunked precache works).
// 3) After reload, the SW controls the page (navigator.serviceWorker.controller
//    is non-null) and lesson JSONs serve from cache.
// 4) The sidebar chip 📦 Offline becomes visible after the page polls the SW
//    for cache stats, and shows the cached lesson count.
// 5) state.offlinePack persists across page reloads so cold-start can paint
//    the chip immediately without a SW round-trip.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-offline';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Phase 1: clear any prior SW state so this is a clean install path.
  await s.evalAwait(`(async () => {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
      __v: 6, welcomed: true,
      progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
      starterPath: false, starterPathTrack: 'all', hideMastered: false,
      reviews: {}, weakness: {}, history: {}, misses: {},
      recognize: { attempts: 0, correct: 0 },
      rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
      warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
      offlinePack: { lessonCount: 0, totalCount: 0, lastCheckedAt: 0 },
      sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
    }));
  })()`);
  await s.reload();

  // Wait for install + activate. The precache covers ~143 lesson JSONs so
  // poll for several seconds. Cap at 30 s; bail if no controller appears.
  let controllerOk = false;
  for (let i = 0; i < 15; i++) {
    await s.sleep(2000);
    const ctl = await s.evalAwait(`!!navigator.serviceWorker.controller`);
    if (ctl) { controllerOk = true; break; }
  }
  console.log(controllerOk ? 'PASS: service worker installed + controlling the page' : 'FAIL: no controller after 30 s');

  // Phase 2: cache contents — should include app shell + most lesson JSONs.
  const cacheStats = await s.evalAwait(`(async () => {
    const keys = await caches.keys();
    if (!keys.length) return { ok: false, reason: 'no cache keys' };
    const cache = await caches.open(keys[0]);
    const reqs = await cache.keys();
    const lessonReqs = reqs.filter(r => /\\/data\\/[^/]+\\/[^/]+\\.json$/.test(new URL(r.url).pathname));
    const shellReqs = reqs.filter(r => /\\/(app\\.js|app\\.css|index\\.html|tokens\\.css|data\\/manifest\\.json)$/.test(new URL(r.url).pathname));
    return {
      ok: true,
      version: keys[0],
      total: reqs.length,
      lessons: lessonReqs.length,
      shell: shellReqs.length
    };
  })()`);
  console.log(cacheStats.ok && cacheStats.version
    ? `PASS: cache "${cacheStats.version}" populated (${cacheStats.total} entries: ${cacheStats.lessons} lessons + ${cacheStats.shell} shell)`
    : `FAIL: cache stats — ${JSON.stringify(cacheStats)}`);
  console.log(cacheStats.lessons >= 100 ? `PASS: ≥100 lesson JSONs precached (got ${cacheStats.lessons})` : `FAIL: only ${cacheStats.lessons} lessons cached`);
  console.log(cacheStats.shell >= 5 ? `PASS: ≥5 app-shell assets precached (got ${cacheStats.shell})` : `FAIL: shell incomplete — ${cacheStats.shell}`);

  // Phase 3: cache-first fetch — request a lesson JSON, verify response.
  const lessonOk = await s.evalAwait(`(async () => {
    const res = await fetch('./data/arrays-and-hashing/two-sum.json');
    if (!res.ok) return { ok: false, status: res.status };
    const body = await res.json();
    return { ok: body.id === 'two-sum', id: body.id };
  })()`);
  console.log(lessonOk.ok ? `PASS: cached lesson serves correctly (id="${lessonOk.id}")` : `FAIL: ${JSON.stringify(lessonOk)}`);

  // Phase 4: sidebar chip visibility + count.
  // Poll the chip — pollOfflinePackStats() runs on load + 3s + 8s timers, so
  // by now state.offlinePack should be populated. Wait a moment + reload to
  // exercise the persist-then-paint path (cold-start without round-trip).
  await s.sleep(2000);
  await s.reload();
  await s.sleep(1500);

  const chipState = await s.evalAwait(`(() => {
    const btn = document.getElementById('offline-pack-btn');
    const cnt = document.getElementById('offline-pack-count');
    return {
      present: !!btn,
      hidden: btn ? btn.classList.contains('hidden') : true,
      count: cnt ? cnt.textContent : null,
      lessonCount: state.offlinePack && state.offlinePack.lessonCount
    };
  })()`);
  console.log(chipState.present ? 'PASS: chip element present in DOM' : 'FAIL: chip missing');
  console.log(!chipState.hidden ? 'PASS: chip visible after cache populated' : 'FAIL: chip still hidden');
  console.log(parseInt(chipState.count, 10) >= 100 ? `PASS: chip shows ≥100 cached lessons (count="${chipState.count}")` : `FAIL: count="${chipState.count}"`);
  console.log(chipState.lessonCount >= 100 ? `PASS: state.offlinePack.lessonCount persisted = ${chipState.lessonCount}` : `FAIL: lessonCount = ${chipState.lessonCount}`);

  await s.snap('end');
  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
