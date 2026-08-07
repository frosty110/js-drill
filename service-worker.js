// iter 113: Offline Drill Pack — service worker that pre-caches the app shell
// + data/manifest.json + every authored lesson JSON on first install.
//
// 2026-08-06: the CDN assets ARE vendored now (tools/vendor-deps.js), which is
// what the note here used to promise as "v2". Tailwind is compiled to a static
// stylesheet and CodeMirror / Supabase are served from vendor/ and precached, so
// a cold start with no network renders the styled app WITH a working L3 editor,
// instead of an unstyled page whose editor never appeared. There are no
// cross-origin boot dependencies left; the bypass branch in the fetch handler is
// kept for the one remaining lazy fetch (the TypeScript compiler, used by 3
// lessons) and for anything added later.
//
// Mermaid is the deliberate exception and is NOT precached — see the note where
// it would otherwise appear in APP_SHELL. Precaching everything vendored was the
// first instinct and it was wrong: it charged every main-app visitor 3.4 MB for
// a library only the system-design page uses.
//
// Cache strategy:
//   - install: cache app shell + manifest.json + every full-status lesson JSON
//     listed in the manifest (chunked addAll to avoid request-storm rate limits).
//   - activate: delete any stale CACHE_VERSION keys + claim open clients.
//   - fetch (same-origin GET, CODE — html/js/css): network-first, falling back
//     to cache. See § Why code is network-first below.
//   - fetch (same-origin GET, everything else): cache-first — return cached; on
//     miss, fetch + add to cache + return. On network failure with no cache,
//     return 503.
//   - fetch (cross-origin or non-GET): bypass — let the browser handle.
//
// ── Why code is network-first (2026-08-05) ─────────────────────────────────
// It used to be cache-first for EVERYTHING, and the fetch handler adds any
// successful same-origin GET to the cache. A page not in APP_SHELL therefore
// froze at whatever bytes it had the first time it was opened, and stayed
// frozen for the whole life of the CACHE_VERSION string — a string that is
// bumped by hand, and wasn't, across the entire D15 shell rollout.
//
// system-design.html was exactly that page. It is loaded by the app (the nav's
// Design rung), it changed in nearly every release, and it appeared nowhere in
// APP_SHELL — so returning users kept the pre-shell copy: no nav rail, no
// bottom bar, no header, and no way back to Home except the browser's Back
// button. index.html, which IS in APP_SHELL, was re-fetched at each install
// and looked current. One page new, one page old, on the same phone, from the
// same deploy — which reads as "the two halves are different apps."
//
// Code is now revalidated on every load when the network answers, and served
// from cache when it doesn't. Offline still works; a stale shell can no longer
// outlive a deploy. The drill payload — lesson JSON, images, fonts — stays
// cache-first, because that is what the Offline Drill Pack is FOR and its
// content is versioned by URL.
//
// Bump CACHE_VERSION when changing precache shape or app-shell list. Each bump
// invalidates the prior cache via activate.
const CACHE_VERSION = 'jsdrill-v45-mermaid-runtime-cached-2026-08-06';

// Code the SW revalidates instead of freezing. Same-origin GETs whose path ends
// in one of these, plus navigations, take the network-first branch.
const CODE_EXT = /\.(?:html|js|css)$/i;

const APP_SHELL = [
  './',
  './index.html',
  // Third-party code, now served from our own origin (tools/vendor-deps.js).
  // This is the entry this file's header used to promise: "v2 will vendor the
  // CDN assets for true cold-start offline." Until it existed, the fetch
  // handler bypassed cross-origin requests, so an offline cold start had no
  // Tailwind (unstyled app) and no CodeMirror (the L3 editor simply absent).
  './js/core/errors.js',
  './css/00-tailwind.css',
  './vendor/codemirror/codemirror.css',
  './vendor/codemirror/dracula.css',
  './vendor/codemirror/codemirror.js',
  './vendor/codemirror/javascript.js',
  './vendor/codemirror/closebrackets.js',
  './vendor/codemirror/matchbrackets.js',
  './vendor/codemirror/runmode.js',
  './vendor/supabase/supabase.js',
  // NOT './vendor/mermaid/mermaid.min.js' — deliberately. It is 3.4 MB, and
  // only index.html registers this service worker. index.html never renders a
  // diagram: Mermaid belongs to system-design.html, which injects it on first
  // diagram render. Precaching it charged every main-app visitor 3.4 MB for a
  // file they may never load — worse than the CDN era, where it was
  // cross-origin and this worker skipped it entirely.
  //
  // It is still cached, just later: the fetch handler stores any successful
  // same-origin GET, so the first diagram a user opens populates the cache and
  // every diagram after that works offline.
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
  './js/app/14a-init-palette.js',
  './js/app/14b-bootstrap-launchers.js',
  './js/app/14c-settings-input.js',
  './js/app/14d-risk-streak.js',
  './js/app/14e-audio.js',
  './js/app/14f-stats-dashboard.js',
  './js/app/14g-plan-modals.js',
  './js/app/15-init-features-boot.js',
  './js/app/16-ds-shell.js',
  './js/app/17-today-home.js',
  './js/app/18-practice-launcher.js',
  './js/app/19-browse.js',
  './js/app/20-progress.js',
  './js/app/21-settings.js',
  './js/app/22-home.js',
  './js/app/23-review.js',
  './js/app/24-share.js',
  './css/01-base.css',
  './css/02-sidebar.css',
  './css/03-tabs.css',
  './css/04-drills.css',
  './css/05-shell-chrome.css',
  './css/06-ds-nav.css',
  './css/07-ds-progress.css',
  './css/08-ds-browse.css',
  './css/09-ds-settings.css',
  './css/10-ds-lesson.css',
  './css/11-ds-home.css',
  './css/12-ds-share.css',
  './css/14-breadcrumb.css',
  './css/15-ds-shell.css',
  './ds/tokens.css',
  './ds/components.css',
  './ds/icons.js',
  './ds/dragscroll.js',
  './js/storage.js',
  // Share codes + the surface registry. index.html loads these NON-deferred,
  // before the app slices, so an offline boot without them is a broken boot.
  './js/sharecode.js',
  './js/routes.js',
  './js/breadcrumb.js',
  './ds/shell.js',
  './js/sync.js',
  './js/supabase-config.js',
  './js/supabase-client.js',
  './js/core/util.js',
  './js/core/runner.js',
  './data/manifest.json',
  './data/paths.json',

  // ── system-design.html and everything only IT loads ──────────────────────
  // Absent until 2026-08-05, which is how the page came to be served frozen to
  // returning users (see the note at the top). It is a first-class destination
  // — the nav's Design rung — so it precaches like index.html does.
  './system-design.html',
  './css/16-sd-shell.css',
  './js/infographic-viewer.js',
  './js/sd/01-state-data.js',
  './js/sd/02-diagrams.js',
  './js/sd/03-tags.js',
  './js/sd/04-plans.js',
  './js/sd/05-topic-landing.js',
  './js/sd/06-topic-home.js',
  './js/sd/07-unit-detail.js',
  './js/sd/08-component-catalog.js',
  './js/sd/09-session.js',
  './js/sd/10-question-render.js',
  './js/sd/11-share.js',
  './js/sd/12-summary.js',
  './js/sd/13-stats.js',
  './js/sd/14-keyboard.js',
  './js/sd/15-routing-shell.js',
  './data/system-design/topics.json'
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
  // A navigation asks for a document even when the URL has no .html on it
  // ('./', a directory index), so ask the request, not only the path.
  const isCode = req.mode === 'navigate' ||
    req.destination === 'document' || req.destination === 'script' ||
    req.destination === 'style' || CODE_EXT.test(url.pathname);

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);

    // Only cache successful same-origin GET responses; bypass for redirects,
    // 4xx/5xx, opaque responses, etc.
    const store = res => {
      if (res && res.ok && res.type === 'basic') {
        cache.put(req, res.clone()).catch(() => { /* quota / parse errors swallowed */ });
      }
      return res;
    };

    if (isCode) {
      // Network-first: the deployed bytes win whenever they're reachable, so a
      // shipped fix reaches the user on their next load rather than on the next
      // hand-written CACHE_VERSION bump. Offline falls straight back to cache.
      try {
        return store(await fetch(req));
      } catch (_) {
        const cached = await cache.match(req);
        if (cached) return cached;
        // A navigation offline to a page we never cached: hand back the app
        // shell rather than a 503, so the router can still render something.
        if (req.mode === 'navigate') {
          const shell = await cache.match('./index.html');
          if (shell) return shell;
        }
        return new Response('Offline and not cached', {
          status: 503, headers: { 'Content-Type': 'text/plain' }
        });
      }
    }

    // Everything else — lesson JSON, infographics, fonts: cache-first. This is
    // the Offline Drill Pack, and its content is versioned by URL.
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      return store(await fetch(req));
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
