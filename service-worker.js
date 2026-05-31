// iter 113: Offline Drill Pack — service worker that pre-caches the app shell
// + data/manifest.json + every authored lesson JSON on first install. Same-origin
// fetches are cache-first; cross-origin (Tailwind / CodeMirror / Supabase CDNs)
// fall through to the network, picking up the browser's HTTP cache after first
// online visit. v2 will vendor the CDN assets for true cold-start offline.
//
// Cache strategy:
//   - install: cache app shell + manifest.json + every full-status lesson JSON
//     listed in the manifest (chunked addAll to avoid request-storm rate limits).
//   - activate: delete any stale CACHE_VERSION keys + claim open clients.
//   - fetch (same-origin GET): cache-first — return cached; on miss, fetch + add
//     to cache + return. On network failure with no cache, return 503.
//   - fetch (cross-origin or non-GET): bypass — let the browser handle.
//
// Bump CACHE_VERSION when changing precache shape or app-shell list. Each bump
// invalidates the prior cache via activate.
const CACHE_VERSION = 'jsdrill-v7-crux-recall-2026-05-30';
const APP_SHELL = [
  './',
  './index.html',
  // app.js was split into ordered slices (tools/split-app.py); precache them all.
  './js/app/01-state-content.js',
  './js/app/02-util-metrics.js',
  './js/app/03-paths-cram.js',
  './js/app/04-progress-sr.js',
  './js/app/05-drills-recognize-trace.js',
  './js/app/06-drills-constellation-grid.js',
  './js/app/07-drills-swap-speedrun.js',
  './js/app/08-drills-bughunt-constraint.js',
  './js/app/09-stats-cheatsheet-mock.js',
  './js/app/10-render-sidebar-lesson.js',
  './js/app/11-tabs-ref-conv-walk.js',
  './js/app/12a-l1.js',
  './js/app/12b-l2.js',
  './js/app/12c-l3.js',
  './js/app/13-mechanics-modal.js',
  './js/app/14-init-core.js',
  './js/app/15-init-features-boot.js',
  './css/01-base.css',
  './css/02-sidebar.css',
  './css/03-tabs.css',
  './css/04-drills.css',
  './css/05-shell-chrome.css',
  './tokens.css',
  './js/storage.js',
  './js/sync.js',
  './js/supabase-config.js',
  './js/supabase-client.js',
  './js/core/util.js',
  './js/core/runner.js',
  './data/manifest.json',
  './data/paths.json'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    try {
      await cache.addAll(APP_SHELL);
    } catch (err) {
      console.warn('[SW] app-shell precache partial fail', err);
    }
    try {
      const res = await fetch('./data/manifest.json', { cache: 'no-cache' });
      const manifest = await res.json();
      const lessonUrls = [];
      for (const section of manifest.sections || []) {
        for (const lesson of section.lessons || []) {
          if (lesson.status === 'full') {
            lessonUrls.push(`./data/${section.slug}/${lesson.id}.json`);
          }
        }
      }
      // Chunk addAll — one failed request would abort the whole batch otherwise.
      for (let i = 0; i < lessonUrls.length; i += 20) {
        try {
          await cache.addAll(lessonUrls.slice(i, i + 20));
        } catch (err) {
          console.warn('[SW] lesson chunk', i, 'fail', err);
        }
      }
    } catch (err) {
      console.warn('[SW] manifest precache fail', err);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Cross-origin: bypass — let the browser handle CDN assets via its HTTP cache.
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      // Only cache successful same-origin GET responses; bypass for redirects,
      // 4xx/5xx, opaque responses, etc.
      if (res && res.ok && res.type === 'basic') {
        cache.put(req, res.clone()).catch(() => { /* quota / parse errors swallowed */ });
      }
      return res;
    } catch (_) {
      // Network unreachable and not cached — degrade gracefully.
      return new Response('Offline and not cached', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  })());
});

// Allow the page to query cache state (number of cached lesson JSONs + last
// activation time) for the sidebar chip without re-implementing CacheStorage
// walks on every render.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'cache-stats') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_VERSION);
      const reqs = await cache.keys();
      const lessonCount = reqs.filter(r => /\/data\/[^/]+\/[^/]+\.json$/.test(new URL(r.url).pathname)).length;
      const payload = {
        type: 'cache-stats-result',
        lessonCount,
        totalCount: reqs.length,
        version: CACHE_VERSION
      };
      // Prefer the dedicated MessageChannel port the page transferred
      // (deterministic per-request reply); fall back to event.source if no
      // port was passed (defensive — keeps the API backwards-compatible).
      const port = event.ports && event.ports[0];
      if (port) port.postMessage(payload);
      else if (event.source) event.source.postMessage(payload);
    })());
  }
});
