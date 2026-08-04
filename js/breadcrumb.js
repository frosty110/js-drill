// ============================================================================
//  js/breadcrumb.js — the derived breadcrumb (D15 phase 1)
// ============================================================================
// Renders "where am I, and what contains me" from the `parent` chain in
// js/routes.js. Nothing here knows about lessons, topics or units — it asks the
// registry for the trail and paints it. Adding a surface with a `parent` gives
// it a breadcrumb for free; that is the point.
//
// Why this exists: a scripted 15-step walk of the live app measured a
// breadcrumb on 0 of them. Up-navigation was three different bespoke
// affordances (`×` on a lesson, `Close` in a sheet, `‹ All topics` on system
// design) and inside a lesson no nav item was aria-current at all, so the app
// read as flat when the content is four levels deep.
// See docs/information-architecture.md §5.
//
// Usage (each page wires its own title resolver — the registry has ids, the
// page has manifests):
//
//   DrillBreadcrumb.mount({
//     page: 'index.html',
//     mount: document.getElementById('ds-crumbs'),
//     title: (kind, params) => …,      // real display name, or null to fall back
//     extra: (kind, params) => […],    // unlinked crumbs spliced before the leaf
//     hidden: (kind, params) => bool   // suppress entirely (e.g. at the root)
//   });
//
// Re-renders on hashchange. Call DrillBreadcrumb.refresh() after any in-page
// navigation that does not change the hash.
// ============================================================================

(function (root) {
  'use strict';

  const CFG = { page: null, mount: null, title: null, extra: null, hidden: null };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // The root crumb every page prepends. Home is not a registry row — it is an
  // appMode, and appMode is one row standing in for ~40 modes — so it is named
  // here rather than derived. Everything BELOW it derives.
  const HOME = { label: 'Home', appHref: 'index.html#/m/home', root: true };

  // Trail for the current hash, or null when there is nothing to show.
  function trail() {
    const R = root.DrillRoutes;
    if (!R) return null;
    const hit = R.parseAppHash(root.location.hash, CFG.page);
    // An unrecognised hash is "not a route" (routes.js), not "render nothing
    // sensible" — at the root of a page that is exactly right: no crumb.
    if (!hit) return null;
    if (typeof CFG.hidden === 'function' && CFG.hidden(hit.kind, hit.params)) return null;

    let items;
    try {
      items = R.crumbs(hit.kind, hit.params, { title: CFG.title });
    } catch (_) {
      return null; // a cycle or an unknown kind must never take the header down
    }

    // Unlinked interstitials the registry can't model yet — a lesson's section
    // is real hierarchy with no address (§5). They sit before the leaf.
    if (typeof CFG.extra === 'function') {
      let ex = [];
      try { ex = CFG.extra(hit.kind, hit.params) || []; } catch (_) { ex = []; }
      if (ex.length) {
        items = items.slice(0, -1)
          .concat(ex.map(e => (typeof e === 'string' ? { label: e } : e)))
          .concat(items.slice(-1));
      }
    }

    const full = [HOME].concat(items);
    // "Home › Home" — a top-level surface whose own label is the root's.
    return full.filter((c, i) => !(i === 1 && c.label === HOME.label));
  }

  function href(c) {
    if (!c.appHref) return null;
    // Shared with ds/shell.js via the registry — see DrillRoutes.hrefFrom.
    const [page, hash] = String(c.appHref).split('#');
    return page === CFG.page ? '#' + hash : c.appHref;
  }

  function render() {
    const el = CFG.mount;
    if (!el) return;
    const items = trail();
    if (!items || items.length < 2) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;

    // The leaf is never a link — you are already there — and it is the one
    // crumb that must survive truncation at 390px, so it is marked for CSS
    // rather than dropped in JS (a phone still needs to see its ancestors when
    // there is room). Middle crumbs collapse via css/14-breadcrumb.css.
    el.innerHTML = items.map((c, i) => {
      const last = i === items.length - 1;
      const sep = i ? '<span class="ds-crumb__sep" aria-hidden="true">›</span>' : '';
      const cls = 'ds-crumb' + (last ? ' ds-crumb--leaf' : '') + (c.root ? ' ds-crumb--root' : '');
      const body = esc(c.label);
      const h = last ? null : href(c);
      return sep + (h
        ? `<a class="${cls}" href="${esc(h)}">${body}</a>`
        : `<span class="${cls}"${last ? ' aria-current="page"' : ''}>${body}</span>`);
    }).join('');
  }

  function mount(cfg) {
    Object.assign(CFG, cfg || {});
    if (!CFG.mount) return;
    CFG.mount.classList.add('ds-crumbs');
    CFG.mount.setAttribute('aria-label', 'Breadcrumb');
    root.addEventListener('hashchange', render);
    render();
  }

  root.DrillBreadcrumb = { mount, refresh: render, trail };
})(typeof globalThis !== 'undefined' ? globalThis : this);
