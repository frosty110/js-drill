// ============================================================================
//  js/routes.js — the addressable-surface registry
// ============================================================================
// ONE table describing every surface that has a URL. Adding a crawlable
// surface is a single row here; the share links, the static-page generator,
// the sitemap and the "open in the app" backlinks all read from it. Nothing
// else in the project should concatenate a share path by hand.
//
// Two URL families, deliberately kept apart:
//
//   SHARE / CRAWL   p/two-sum/                   static, server-rendered by
//                   sd/design-problems/p01/      tools/build-share-pages.js.
//                                                Complete without JavaScript,
//                                                so an agent or a crawler that
//                                                fetches it gets the content.
//
//   APP             index.html#/two-sum/L1       the live SPA. Hash routes,
//                   system-design.html#/ddia/ch01  client-rendered.
//
// They never collide: the SPA owns the hash, the static pages own the path.
// A share URL carries the score code in `?s=` (see js/sharecode.js) and an
// optional `#qN` anchor, neither of which the SPA's hash router can see.
//
// Loaded as a plain <script> (exposes window.DrillRoutes) and require()d by
// the tools under Node.
// ============================================================================

(function (root, factory) {
  const share = (typeof module === 'object' && module.exports)
    ? require('./sharecode.js')
    : root.DrillShare;
  const api = factory(share);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DrillRoutes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DrillShare) {
  'use strict';

  // Pages that live at the base of the deployment. Used to derive the base URL
  // from whatever page happens to be running this code.
  const APP_PAGES = ['index.html', 'system-design.html', 'diagnostic.html'];

  // ── The registry ──────────────────────────────────────────────────────────
  // Each surface declares:
  //   dir        first path segment of its static home ('' = the root index)
  //   arity      how many path segments follow `dir`
  //   codeKind   which sharecode grammar its ?s= uses ('lesson' | 'unit' | null)
  //   path()     params  → share path, no leading slash, WITH a trailing
  //              slash. Every surface is written to disk as <dir>/index.html,
  //              so the slash form is the file's real address and resolves in
  //              one hop. Emitting it slashless made every share link cost a
  //              301 on GitHub Pages — fetchers that don't follow redirects
  //              failed outright, and some dropped the ?s= across the hop.
  //              parseSharePath() still accepts the slashless form, so links
  //              shared before this change keep working.
  //   appHash()  params  → the live-app URL that renders the same thing
  //   params()   segments → params, or null when the shape doesn't match
  //   sitemap    include in sitemap.xml
  const SURFACES = [
    {
      kind: 'lessonIndex',
      dir: 'p',
      arity: 0,
      codeKind: null,
      sitemap: true,
      title: 'All coding lessons',
      path: () => 'p/',
      appHash: () => 'index.html#/m/browse',
      params: segs => (segs.length === 0 ? {} : null)
    },
    {
      kind: 'lesson',
      dir: 'p',
      arity: 1,
      codeKind: 'lesson',
      sitemap: true,
      path: p => `p/${encodeURIComponent(p.id)}/`,
      appHash: p => `index.html#/${encodeURIComponent(p.id)}${p.tab ? '/' + p.tab : ''}`,
      params: segs => (segs.length === 1 ? { id: segs[0] } : null)
    },
    {
      kind: 'sdIndex',
      dir: 'sd',
      arity: 0,
      codeKind: null,
      sitemap: true,
      title: 'System design topics',
      path: () => 'sd/',
      appHash: () => 'system-design.html#/',
      params: segs => (segs.length === 0 ? {} : null)
    },
    {
      kind: 'sdTopic',
      dir: 'sd',
      arity: 1,
      codeKind: null,
      sitemap: true,
      path: p => `sd/${encodeURIComponent(p.topic)}/`,
      appHash: p => `system-design.html#/${encodeURIComponent(p.topic)}`,
      params: segs => (segs.length === 1 ? { topic: segs[0] } : null)
    },
    {
      kind: 'sdUnit',
      dir: 'sd',
      arity: 2,
      codeKind: 'unit',
      sitemap: true,
      path: p => `sd/${encodeURIComponent(p.topic)}/${encodeURIComponent(p.unit)}/`,
      appHash: p => `system-design.html#/${encodeURIComponent(p.topic)}/${encodeURIComponent(p.unit)}`,
      params: segs => (segs.length === 2 ? { topic: segs[0], unit: segs[1] } : null)
    },
    {
      // One study sheet. The app already addresses it (#/…/graphic/<id>, so a
      // full-screen PNG can be linked); this gives that route the JS-free twin
      // every other surface has, so a pasted sheet URL is also fetchable by an
      // agent or a crawler. Registering it here rather than concatenating the
      // app URL by hand is what keeps the two spellings from drifting.
      kind: 'sdSheet',
      dir: 'sd',
      arity: 3,
      codeKind: null,
      sitemap: true,
      path: p => `sd/${encodeURIComponent(p.topic)}/${encodeURIComponent(p.unit)}/${encodeURIComponent(p.sheet)}/`,
      appHash: p => `system-design.html#/${encodeURIComponent(p.topic)}/${encodeURIComponent(p.unit)}/graphic/${encodeURIComponent(p.sheet)}`,
      params: segs => (segs.length === 3 ? { topic: segs[0], unit: segs[1], sheet: segs[2] } : null)
    }
  ];

  const BY_KIND = SURFACES.reduce((m, s) => { m[s.kind] = s; return m; }, {});

  function surface(kind) {
    const s = BY_KIND[kind];
    if (!s) throw new Error(`Unknown surface kind: ${kind}`);
    return s;
  }

  // ── Base URL resolution ───────────────────────────────────────────────────
  // Works unchanged from the app root, from a nested static page, and from a
  // local `python3 -m http.server` — all three of which serve the project from
  // a different path depth. Always returns a value ending in '/'.
  function baseUrl(loc) {
    const l = loc || (typeof location !== 'undefined' ? location : null);
    if (!l) return '/';
    let path = l.pathname || '/';
    const last = path.split('/').pop();
    if (APP_PAGES.includes(last) || last === '') path = path.slice(0, path.length - last.length);
    else path = path.replace(/[^/]+$/, '');
    // Climb out of a static share page: /base/p/<id>/ and /base/sd/<t>/<u>/.
    const segs = path.split('/').filter(Boolean);
    for (const s of SURFACES) {
      if (!s.dir) continue;
      const at = segs.lastIndexOf(s.dir);
      if (at >= 0 && segs.length - at - 1 <= s.arity) { segs.length = at; break; }
    }
    const prefix = segs.length ? '/' + segs.join('/') + '/' : '/';
    return `${l.origin || ''}${prefix}`;
  }

  // ── Building ──────────────────────────────────────────────────────────────

  // Absolute (or base-relative) URL of a surface's static, crawlable page.
  //   shareUrl('lesson', {id:'two-sum'}, 'AbbC.Y.n')
  //     → https://…/js-drill/p/two-sum/?s=AbbC.Y.n
  function shareUrl(kind, params, code, opts) {
    const o = opts || {};
    const base = o.base != null ? o.base : baseUrl(o.loc);
    const url = `${base}${surface(kind).path(params || {})}`;
    const withCode = DrillShare ? DrillShare.withShareParam(url, code) : url;
    return o.anchor ? `${withCode}#${o.anchor}` : withCode;
  }

  // Relative share path only — what the generator writes to disk.
  function sharePath(kind, params) {
    return surface(kind).path(params || {});
  }

  // The live-app URL that renders the same content as a static page. Every
  // generated page links back through this, so "open this in the drill" always
  // lands on the real interactive surface.
  function appUrl(kind, params, opts) {
    const o = opts || {};
    const base = o.base != null ? o.base : baseUrl(o.loc);
    return `${base}${surface(kind).appHash(params || {})}`;
  }

  // Which sharecode grammar a surface's ?s= uses ('lesson' | 'unit' | null).
  function codeKind(kind) {
    return surface(kind).codeKind;
  }

  // ── Parsing ───────────────────────────────────────────────────────────────
  // Turn a static share path back into {kind, params}. Accepts a full URL, a
  // path, with or without leading/trailing slashes or an /index.html suffix.
  function parseSharePath(input) {
    let path = String(input || '');
    try { if (/^https?:\/\//i.test(path)) path = new URL(path).pathname; } catch (_) { /* keep raw */ }
    path = path.split('?')[0].split('#')[0].replace(/\/index\.html$/i, '');
    let segs = path.split('/').filter(Boolean).map(s => { try { return decodeURIComponent(s); } catch (_) { return s; } });
    // Tolerate a deployment prefix (/js-drill/p/two-sum) by scanning for the
    // first segment that names a registered directory.
    const dirs = new Set(SURFACES.map(s => s.dir).filter(Boolean));
    const at = segs.findIndex(s => dirs.has(s));
    if (at < 0) return null;
    const dir = segs[at];
    const rest = segs.slice(at + 1);
    for (const s of SURFACES) {
      if (s.dir !== dir) continue;
      const params = s.params(rest);
      if (params) return { kind: s.kind, params };
    }
    return null;
  }

  // Read the score code sitting on the current page's URL, already validated.
  function currentCode(search) {
    return DrillShare ? DrillShare.readShareParam(search) : null;
  }

  // ── Sitemap ───────────────────────────────────────────────────────────────
  // `entries` is [{kind, params}] — the generator passes everything it wrote.
  function sitemapXml(entries, origin) {
    const base = String(origin || '').replace(/\/$/, '') + '/';
    const urls = entries
      .filter(e => surface(e.kind).sitemap)
      .map(e => `  <url><loc>${escapeXml(base + sharePath(e.kind, e.params))}</loc></url>`)
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  }

  function escapeXml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  }

  return {
    SURFACES, APP_PAGES,
    surface, baseUrl,
    shareUrl, sharePath, appUrl, codeKind,
    parseSharePath, currentCode,
    sitemapXml
  };
});
