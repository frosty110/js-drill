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

  // Second path segments under sd/ that name a KIND of route rather than a
  // unit. Without this list `sd/design-problems/plan/night-before/` and
  // `sd/design-problems/p06/overview/` are the same shape, and a plan would
  // parse as a study sheet.
  // `catalog` and `c` join them for the component catalog: without the
  // discriminator, a component id and a unit id share a shape, and
  // `#/components/c01` would be ambiguous between the two.
  const SD_RESERVED = new Set(['plan', 'tag', 'mixed', 'due', 'catalog', 'c']);

  // ── The registry ──────────────────────────────────────────────────────────
  // ONE row per place the app can put the user. Not "per crawlable page" —
  // per PLACE. That distinction is the whole point: a route the registry
  // doesn't name is a place with no address, and the reconciliation gate
  // (tools/check-url-contract.js) fails on it rather than letting it pass
  // unnoticed the way `mixed`/`due`/`plan`/`tag` did for months.
  //
  // Each surface declares:
  //   page       which app page owns the hash ('index.html' | 'system-design.html')
  //   dir        first path segment of its static home ('' = the root index)
  //   arity      MAX path segments after `dir` (used to climb out in baseUrl)
  //   codeKind   which sharecode grammar its ?s= uses ('lesson' | 'unit' | null)
  //
  //   disposition  what the route MEANS, which decides what a fetcher gets:
  //     'content'  denotes a thing that exists independently of the user —
  //                a lesson, a unit, a sheet, a plan, a tag list. Has its own
  //                static page. Crawlable, shareable, quotable.
  //     'action'   starts a personal, stateful session — "review what's due for
  //                ME". There is no content to serve, and pretending otherwise
  //                would mean generating a page that lies. Declares `fallback`:
  //                the content surface a fetcher or crawler is sent to instead.
  //                An action route is NOT an exemption from the contract — it
  //                still has to be here, and still has to resolve to something.
  //
  //   path()     params  → share path, no leading slash, WITH a trailing
  //              slash. Every surface is written to disk as <dir>/index.html,
  //              so the slash form is the file's real address and resolves in
  //              one hop. Emitting it slashless made every share link cost a
  //              301 on GitHub Pages — fetchers that don't follow redirects
  //              failed outright, and some dropped the ?s= across the hop.
  //              parseSharePath() still accepts the slashless form, so links
  //              shared before this change keep working. Absent on 'action'.
  //   parent     the kind of the surface that CONTAINS this one, or null for a
  //              top level. This is the hierarchy — the one fact the registry
  //              was missing (docs/information-architecture.md §5, D15). Before
  //              it, a row could say what a URL *is* and never what it is
  //              *inside of*, so breadcrumbs, up-navigation, truthful
  //              aria-current and scoped progress each had to be hand-authored
  //              per surface — which is why a measured walk found 0 of 15
  //              surfaces with a breadcrumb and no aria-current anywhere inside
  //              a lesson. Declare it once here; derive all four.
  //
  //              `null` means top level, NOT "no ancestor": every page renders
  //              Home ahead of the chain (js/breadcrumb.js). Home is not a row
  //              because it is an appMode, and appMode is one row for ~40 modes.
  //
  //              A child's params are a superset of its parent's by
  //              construction (sdSheet {topic,unit,sheet} → sdUnit {topic,unit}
  //              → sdTopic {topic}), so one params object walks the whole chain.
  //
  //   crumbLabel()  params → the breadcrumb's text when no better title is
  //              known. Callers that CAN resolve a real title (the app has the
  //              manifests; the generator has the files) pass `opts.title` to
  //              crumbs() and this is the fallback.
  //
  //   params()   path segments → params, or null when the shape doesn't match
  //   appHash()  params  → the live-app URL that renders the same thing
  //   appParams()  hash segments → params, or null. The INVERSE of appHash,
  //              and the reason the app's router no longer has to re-describe
  //              routes it already declared here. Round-tripped by the gate.
  //   sitemap    include in sitemap.xml
  const SURFACES = [
    {
      kind: 'lessonIndex',
      page: 'index.html',
      dir: 'p',
      arity: 0,
      codeKind: null,
      disposition: 'content',
      sitemap: true,
      title: 'All coding lessons',
      // Top level: the coding corpus. Becomes "Library" when D15 phase 4 folds
      // Home's track cards in; the label tracks what ships, not the target.
      parent: null,
      crumbLabel: () => 'Browse',
      path: () => 'p/',
      params: segs => (segs.length === 0 ? {} : null),
      appHash: () => 'index.html#/m/browse',
      appParams: segs => (segs.length === 2 && segs[0] === 'm' && segs[1] === 'browse' ? {} : null)
    },
    {
      kind: 'lesson',
      page: 'index.html',
      dir: 'p',
      arity: 1,
      codeKind: 'lesson',
      disposition: 'content',
      sitemap: true,
      // The section between Browse and a lesson is real hierarchy with no
      // address yet (there is no #/section/trees route), so it is not a row.
      // js/breadcrumb.js splices it in unlinked via `extra`; when sections get
      // routes it becomes a row and the splice goes away.
      parent: 'lessonIndex',
      crumbLabel: p => p.id,
      path: p => `p/${encodeURIComponent(p.id)}/`,
      params: segs => (segs.length === 1 ? { id: segs[0] } : null),
      // The optional tab (#/two-sum/L2) is view state on one lesson, so it
      // rides the same surface; the static twin carries it as an #L2 anchor.
      appHash: p => `index.html#/${encodeURIComponent(p.id)}${p.tab ? '/' + encodeURIComponent(p.tab) : ''}`,
      appParams: segs => (segs.length && segs.length <= 2 && segs[0] !== 'm'
        ? (segs[1] ? { id: segs[0], tab: segs[1] } : { id: segs[0] })
        : null)
    },
    {
      // Every launchable mode (#/m/dashboard, #/m/mock, …). An action: it opens
      // a surface over the user's own state, so there is nothing standalone to
      // serve. Registered anyway — an unregistered route is an unaddressable
      // place, and this is how the gate knows the mode links are accounted for.
      kind: 'appMode',
      page: 'index.html',
      dir: null,
      arity: 0,
      codeKind: null,
      disposition: 'action',
      fallback: 'lessonIndex',
      sitemap: false,
      // Top level: a mode is launched from wherever you are, so it has no
      // structural container. `home` is the one mode that IS the root — the
      // renderer drops the duplicate crumb rather than printing "Home › Home".
      parent: null,
      crumbLabel: p => p.mode,
      appHash: p => `index.html#/m/${encodeURIComponent(p.mode)}`,
      appParams: segs => (segs.length >= 2 && segs[0] === 'm' && segs[1] !== 'browse'
        ? { mode: segs.slice(1).join('/') }
        : null)
    },
    {
      kind: 'sdIndex',
      page: 'system-design.html',
      dir: 'sd',
      arity: 0,
      codeKind: null,
      disposition: 'content',
      sitemap: true,
      title: 'System design topics',
      // Top level today; becomes a Library track in a later D15 slice (§4.1).
      parent: null,
      crumbLabel: () => 'System Design',
      path: () => 'sd/',
      params: segs => (segs.length === 0 ? {} : null),
      appHash: () => 'system-design.html#/',
      appParams: segs => (segs.length === 0 ? {} : null)
    },
    {
      kind: 'sdTopic',
      page: 'system-design.html',
      dir: 'sd',
      arity: 1,
      codeKind: null,
      disposition: 'content',
      sitemap: true,
      parent: 'sdIndex',
      crumbLabel: p => p.topic,
      path: p => `sd/${encodeURIComponent(p.topic)}/`,
      params: segs => (segs.length === 1 ? { topic: segs[0] } : null),
      appHash: p => `system-design.html#/${encodeURIComponent(p.topic)}`,
      appParams: segs => (segs.length === 1 ? { topic: segs[0] } : null)
    },
    {
      // An ordered subset of a topic with a time budget — content, not a
      // session: the same link means the same thing to everyone who opens it.
      // The plan id may itself contain a slash (company plans are
      // `plan/company/<name>`), so both parsers take the remaining segments.
      kind: 'sdPlan',
      page: 'system-design.html',
      dir: 'sd',
      arity: 3,
      codeKind: null,
      disposition: 'content',
      sitemap: true,
      parent: 'sdTopic',
      crumbLabel: p => `Plan · ${p.plan}`,
      path: p => `sd/${encodeURIComponent(p.topic)}/plan/${p.plan.split('/').map(encodeURIComponent).join('/')}/`,
      params: segs => (segs.length >= 3 && segs[1] === 'plan' ? { topic: segs[0], plan: segs.slice(2).join('/') } : null),
      appHash: p => `system-design.html#/${encodeURIComponent(p.topic)}/plan/${p.plan.split('/').map(encodeURIComponent).join('/')}`,
      appParams: segs => (segs.length >= 3 && segs[1] === 'plan' ? { topic: segs[0], plan: segs.slice(2).join('/') } : null)
    },
    {
      // A filtered list — "every problem that uses consistent hashing". Content:
      // a shared tag link lands everyone on the same list regardless of their
      // saved filter state.
      kind: 'sdTag',
      page: 'system-design.html',
      dir: 'sd',
      arity: 4,
      codeKind: null,
      disposition: 'content',
      sitemap: true,
      parent: 'sdTopic',
      crumbLabel: p => `${p.facet}: ${p.value}`,
      path: p => `sd/${encodeURIComponent(p.topic)}/tag/${encodeURIComponent(p.facet)}/${encodeURIComponent(p.value)}/`,
      params: segs => (segs.length === 4 && segs[1] === 'tag' ? { topic: segs[0], facet: segs[2], value: segs[3] } : null),
      appHash: p => `system-design.html#/${encodeURIComponent(p.topic)}/tag/${encodeURIComponent(p.facet)}/${encodeURIComponent(p.value)}`,
      appParams: segs => (segs.length === 4 && segs[1] === 'tag' ? { topic: segs[0], facet: segs[2], value: segs[3] } : null)
    },
    {
      // "Shuffle this topic for me" — due-first, seeded from the reader's own
      // Leitner state, so it renders differently for every person. Nothing
      // standalone to serve; a fetcher gets the topic page.
      kind: 'sdMixed',
      page: 'system-design.html',
      dir: 'sd',
      arity: 2,
      codeKind: null,
      disposition: 'action',
      fallback: 'sdTopic',
      sitemap: false,
      parent: 'sdTopic',
      crumbLabel: () => 'Mixed',
      appHash: p => `system-design.html#/${encodeURIComponent(p.topic)}/mixed`,
      appParams: segs => (segs.length === 2 && segs[1] === 'mixed' ? { topic: segs[0] } : null)
    },
    {
      // "What's due for me right now" — the same, and even more personal.
      kind: 'sdDue',
      page: 'system-design.html',
      dir: 'sd',
      arity: 2,
      codeKind: null,
      disposition: 'action',
      fallback: 'sdTopic',
      sitemap: false,
      parent: 'sdTopic',
      crumbLabel: () => 'Due',
      appHash: p => `system-design.html#/${encodeURIComponent(p.topic)}/due`,
      appParams: segs => (segs.length === 2 && segs[1] === 'due' ? { topic: segs[0] } : null)
    },
    {
      // The component catalog — every building block grouped by category.
      // Content: the same list for everyone, and the entry point a crawler or
      // an agent needs in order to find the component pages at all.
      kind: 'sdComponentIndex',
      page: 'system-design.html',
      dir: 'sd',
      arity: 2,
      codeKind: null,
      disposition: 'content',
      sitemap: true,
      // The catalog is a view OF a topic — sd/<topic>/catalog/ — so it hangs
      // off sdTopic, and a component hangs off the catalog.
      parent: 'sdTopic',
      crumbLabel: () => 'Catalog',
      title: 'Component catalog',
      path: p => `sd/${encodeURIComponent(p.topic)}/catalog/`,
      params: segs => (segs.length === 2 && segs[1] === 'catalog' ? { topic: segs[0] } : null),
      appHash: p => `system-design.html#/${encodeURIComponent(p.topic)}/catalog`,
      appParams: segs => (segs.length === 2 && segs[1] === 'catalog' ? { topic: segs[0] } : null)
    },
    {
      // One component — what it is, when to reach for it, what it costs, and
      // every design problem that uses it with what it is doing there. The
      // other direction of the same edge a problem's mechanism chip walks.
      kind: 'sdComponent',
      page: 'system-design.html',
      dir: 'sd',
      arity: 3,
      codeKind: null,
      disposition: 'content',
      sitemap: true,
      parent: 'sdComponentIndex',
      crumbLabel: p => p.component,
      path: p => `sd/${encodeURIComponent(p.topic)}/c/${encodeURIComponent(p.component)}/`,
      params: segs => (segs.length === 3 && segs[1] === 'c' ? { topic: segs[0], component: segs[2] } : null),
      appHash: p => `system-design.html#/${encodeURIComponent(p.topic)}/c/${encodeURIComponent(p.component)}`,
      appParams: segs => (segs.length === 3 && segs[1] === 'c' ? { topic: segs[0], component: segs[2] } : null)
    },
    {
      kind: 'sdUnit',
      page: 'system-design.html',
      dir: 'sd',
      arity: 2,
      codeKind: 'unit',
      disposition: 'content',
      sitemap: true,
      parent: 'sdTopic',
      crumbLabel: p => p.unit,
      path: p => `sd/${encodeURIComponent(p.topic)}/${encodeURIComponent(p.unit)}/`,
      params: segs => (segs.length === 2 && !SD_RESERVED.has(segs[1]) ? { topic: segs[0], unit: segs[1] } : null),
      appHash: p => `system-design.html#/${encodeURIComponent(p.topic)}/${encodeURIComponent(p.unit)}`,
      appParams: segs => (segs.length === 2 && !SD_RESERVED.has(segs[1]) ? { topic: segs[0], unit: segs[1] } : null)
    },
    {
      // One study sheet. The app addresses it as #/<topic>/<unit>/graphic/<id>
      // so a full-screen PNG can be linked; the static twin drops the `graphic`
      // segment because a path doesn't need the disambiguator a hash does.
      // Declaring both spellings here is what stops them drifting apart.
      kind: 'sdSheet',
      page: 'system-design.html',
      dir: 'sd',
      arity: 3,
      codeKind: null,
      disposition: 'content',
      sitemap: true,
      parent: 'sdUnit',
      crumbLabel: p => p.sheet,
      path: p => `sd/${encodeURIComponent(p.topic)}/${encodeURIComponent(p.unit)}/${encodeURIComponent(p.sheet)}/`,
      params: segs => (segs.length === 3 && !SD_RESERVED.has(segs[1]) ? { topic: segs[0], unit: segs[1], sheet: segs[2] } : null),
      appHash: p => `system-design.html#/${encodeURIComponent(p.topic)}/${encodeURIComponent(p.unit)}/graphic/${encodeURIComponent(p.sheet)}`,
      appParams: segs => (segs.length === 4 && segs[2] === 'graphic' && !SD_RESERVED.has(segs[1])
        ? { topic: segs[0], unit: segs[1], sheet: segs[3] } : null)
    }
  ];

  const BY_KIND = SURFACES.reduce((m, s) => { m[s.kind] = s; return m; }, {});

  function surface(kind) {
    const s = BY_KIND[kind];
    if (!s) throw new Error(`Unknown surface kind: ${kind}`);
    return s;
  }

  // ── Hierarchy ─────────────────────────────────────────────────────────────
  // Walking `parent` is the whole mechanism. Four things that used to be
  // hand-authored per surface now derive from it: the breadcrumb, the single
  // up-affordance, truthful aria-current, and the header's scoped progress
  // (docs/information-architecture.md §5).

  // Ancestor kinds, ROOT-first, excluding `kind` itself.
  // Throws on a cycle rather than looping — the gate calls this on every row.
  function ancestors(kind) {
    const out = [];
    const seen = new Set([kind]);
    let cur = surface(kind).parent;
    while (cur) {
      if (seen.has(cur)) throw new Error(`routes: parent cycle at "${cur}" (from "${kind}")`);
      seen.add(cur);
      out.unshift(cur);
      cur = surface(cur).parent;
    }
    return out;
  }

  // The breadcrumb trail for a surface: root → … → self.
  //
  //   crumbs('sdUnit', { topic: 'ddia', unit: 'ch01' })
  //     → [ {kind:'sdIndex', label:'System Design', …},
  //         {kind:'sdTopic', label:'ddia', …},
  //         {kind:'sdUnit',  label:'ch01', self:true, …} ]
  //
  // opts.title(kind, params) supplies real display titles when the caller has
  // them (the app holds the manifests, the generator holds the files); the
  // row's own crumbLabel() is the fallback so this is never empty.
  //
  // Every item carries both spellings of its address — appHref for the live
  // app, sharePath for the static twin — so one trail serves the SPA header
  // and the generated pages without either re-deriving links.
  function crumbs(kind, params, opts) {
    const o = opts || {};
    const p = params || {};
    return ancestors(kind).concat([kind]).map(k => {
      const s = surface(k);
      let label = null;
      if (typeof o.title === 'function') { try { label = o.title(k, p); } catch (_) { label = null; } }
      if (!label && typeof s.crumbLabel === 'function') { try { label = s.crumbLabel(p); } catch (_) { label = null; } }
      const item = { kind: k, params: p, label: String(label || s.title || k), self: k === kind };
      try { item.appHref = s.appHash(p); } catch (_) { item.appHref = null; }
      try { item.sharePath = typeof s.path === 'function' ? s.path(p) : null; } catch (_) { item.sharePath = null; }
      return item;
    });
  }

  // The address to put in an href, as seen FROM a given page. Same-page targets
  // stay bare fragments so following one never reloads the app; cross-page
  // targets keep their page prefix. Chrome that renders on more than one page
  // (ds/shell.js, js/breadcrumb.js) must not each re-derive this — getting it
  // wrong on one page is invisible from the other.
  function hrefFrom(kind, params, fromPage) {
    const full = surface(kind).appHash(params || {});
    const [page, hash] = String(full).split('#');
    return page === fromPage ? '#' + hash : full;
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
      // An 'action' surface has no static path to parse — it lives only as an
      // app hash and resolves to its fallback for anyone fetching.
      if (s.dir !== dir || typeof s.params !== 'function') continue;
      const params = s.params(rest);
      if (params) return { kind: s.kind, params };
    }
    return null;
  }

  // ── Parsing an APP hash ───────────────────────────────────────────────────
  // The inverse of appHash(). This is what makes the registry the single
  // source: an app router calls this instead of re-describing its own routes
  // in a second parser that nothing keeps in step. Pass the page so two apps
  // can use overlapping hash shapes without colliding.
  //
  //   parseAppHash('#/design-problems/p06/graphic/overview', 'system-design.html')
  //     → { kind: 'sdSheet', params: { topic, unit, sheet } }
  //
  // Returns null for a hash no surface claims — which the caller should treat
  // as "not a route", not as "render nothing".
  function parseAppHash(hash, page) {
    const raw = String(hash == null ? '' : hash).replace(/^#\/?/, '');
    const segs = raw.split('/').filter(Boolean)
      .map(s => { try { return decodeURIComponent(s); } catch (_) { return s; } });
    for (const s of SURFACES) {
      if (page && s.page !== page) continue;
      if (typeof s.appParams !== 'function') continue;
      const params = s.appParams(segs);
      if (params) return { kind: s.kind, params };
    }
    return null;
  }

  // What a fetcher, crawler or AI should be given for a route. Content routes
  // answer for themselves; an action route hands back its declared fallback,
  // so "there is no page for this" never means "there is nowhere to go".
  function resolveForFetch(kind, params) {
    const s = surface(kind);
    if (s.disposition === 'content') return { kind, params: params || {} };
    const to = surface(s.fallback);
    // An action's params are a superset of its fallback's by construction
    // (#/ddia/mixed → sd/ddia/), so the same object resolves the fallback.
    return { kind: to.kind, params: params || {} };
  }

  // Read the score code sitting on the current page's URL, already validated.
  function currentCode(search) {
    return DrillShare ? DrillShare.readShareParam(search) : null;
  }

  // ── Sitemap ───────────────────────────────────────────────────────────────
  // `entries` is [{kind, params}] — the generator passes everything it wrote.
  // An entry may carry `images: [{loc, caption}]`, which emits the image
  // sitemap extension. The 183 study sheets are a real asset and were
  // previously invisible to image search — a crawler had to find them by
  // parsing <img> out of the pages.
  function sitemapXml(entries, origin) {
    const base = String(origin || '').replace(/\/$/, '') + '/';
    const urls = entries
      .filter(e => surface(e.kind).sitemap)
      .map(e => {
        const loc = `  <url><loc>${escapeXml(base + sharePath(e.kind, e.params))}</loc>`;
        const imgs = (e.images || []).map(i =>
          `\n    <image:image><image:loc>${escapeXml(i.loc)}</image:loc>` +
          (i.caption ? `<image:caption>${escapeXml(i.caption)}</image:caption>` : '') +
          `</image:image>`).join('');
        return loc + imgs + (imgs ? '\n  ' : '') + '</url>';
      })
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls}\n</urlset>\n`;
  }

  function escapeXml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  }

  return {
    SURFACES, APP_PAGES, SD_RESERVED,
    surface, baseUrl, ancestors, crumbs, hrefFrom,
    shareUrl, sharePath, appUrl, codeKind,
    parseSharePath, parseAppHash, resolveForFetch, currentCode,
    sitemapXml
  };
});
