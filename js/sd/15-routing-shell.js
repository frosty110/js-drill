// ============================================================================
// ROUTING — the page had no addressable state before this, so nothing could
// link INTO it (the main app's Home needed exactly that for its System Design
// "Continue" and per-topic "Review"). Routes:
//   #/                       topic landing
//   #/<topic>                topic home (chapter list)
//   #/<topic>/<unit>         unit detail (key ideas + drill modes)
//   #/<topic>/mixed          due-first mixed review, started immediately
//   #/<topic>/due            ONLY the seen cards whose interval came around
// Screen renders push their route with replaceState (no history spam inside a
// browsing session); only an EXTERNAL hash change (back/forward, a pasted or
// deep link) re-renders, so this never fights the click handlers.
// ============================================================================
let _routeSuppress = false;

// Navigation by default (docs/information-architecture.md §5 rule 3). Every
// call used to replaceState, so this page's whole hierarchy — topics → topic →
// unit → sheet — collapsed into ONE history entry: a measured walk pressed
// Back from a unit and landed back in the main app, then pressed it again and
// left the site. On a phone, Back IS the navigation.
//
// `opts.replace` is for the one case that is not a new place: dismissing a
// full-screen sheet restores the URL of the unit you were already on, and
// pushing there would make Back re-open what you just closed.
function setRoute(hash, opts) {
  if (window.location.hash === hash) return;
  _routeSuppress = true;
  const write = (opts && opts.replace) ? history.replaceState : history.pushState;
  try { write.call(history, null, '', hash); } catch (_) { window.location.hash = hash; }
  // The replaceState above doesn't fire hashchange, but the fallback does —
  // release the guard on the next tick either way.
  setTimeout(() => { _routeSuppress = false; }, 0);
}

// This page's routes are DECLARED in js/routes.js, not here. parseRoute is the
// adapter that turns a registry {kind, params} into the {view, …} shape the
// render functions below already speak.
//
// It used to be a second, independent parser. That is how `mixed`, `due`,
// `plan` and `tag` came to exist as real routes the registry had never heard
// of — addressable in the app, unknown to the share links, the sitemap and the
// static pages. One parser means that cannot recur; the reconciliation gate
// round-trips every surface through both directions to keep it honest.
const ROUTE_VIEW = {
  sdIndex: 'topics', sdTopic: 'topic', sdUnit: 'unit', sdSheet: 'graphic',
  sdPlan: 'plan', sdTag: 'tag', sdMixed: 'mixed', sdDue: 'due',
  sdComponentIndex: 'catalog', sdComponent: 'component'
};

// Ids reach render functions and selectors, so keep the historical whitelist.
const routeSafe = v => String(v == null ? '' : v).replace(/[^a-z0-9-]/gi, '');

function parseRoute() {
  const hit = window.DrillRoutes
    ? DrillRoutes.parseAppHash(window.location.hash, 'system-design.html')
    : null;
  if (!hit || !ROUTE_VIEW[hit.kind]) return { view: 'topics' };
  const p = hit.params;
  const topic = routeSafe(p.topic);
  if (hit.kind !== 'sdIndex' && !topic) return { view: 'topics' };
  const r = { view: ROUTE_VIEW[hit.kind], topic };
  if (p.unit) r.unit = routeSafe(p.unit);
  if (p.sheet) r.graphic = routeSafe(p.sheet);
  if (p.component) r.component = routeSafe(p.component);
  // A plan id may legitimately contain a slash (plan/company/<name>).
  if (p.plan) r.plan = p.plan.split('/').map(routeSafe).filter(Boolean).join('/');
  if (p.facet) r.facet = routeSafe(p.facet);
  if (p.value) r.value = routeSafe(p.value);
  return r;
}

async function applyRoute() {
  const r = parseRoute();
  await loadTopics();
  const known = (id) => TOPICS.some(t => t.id === id);
  try {
    if (r.view === 'topic' && known(r.topic)) return await renderTopicHome(r.topic);
    // A catalog route on a topic that has no catalog degrades to the topic
    // rather than rendering an empty shell — same rule the plan/tag routes use.
    if (r.view === 'catalog' && known(r.topic)) {
      return catalogAppliesTo(r.topic) ? await renderComponentCatalog(r.topic) : await renderTopicHome(r.topic);
    }
    if (r.view === 'component' && known(r.topic)) {
      if (!catalogAppliesTo(r.topic)) return await renderTopicHome(r.topic);
      await loadCatalog();
      // An unknown component id lands on the catalog, so a stale or mistyped
      // deep link still arrives somewhere that answers the question it asked.
      return componentById(r.component)
        ? await renderComponentDetail(r.topic, r.component)
        : await renderComponentCatalog(r.topic);
    }
    if (r.view === 'mixed' && known(r.topic)) { curTopic = r.topic; return await startMixed(r.topic); }
    if (r.view === 'due' && known(r.topic)) { curTopic = r.topic; return await startDue(r.topic); }
    if (r.view === 'plan' && known(r.topic)) {
      await loadMeta(r.topic); await loadTopicChapters(r.topic); await loadTags(); await loadPlans();
      if (!planById(r.topic, r.plan)) return await renderTopicHome(r.topic);
      // A shared plan link starts at the beginning unless THIS plan is the one
      // already in progress, in which case it resumes where the user left off.
      const ap = activePlan();
      const at = (ap && ap.id === r.plan) ? ap.index : 0;
      return await startPlanStep(r.topic, r.plan, at);
    }
    if (r.view === 'tag' && known(r.topic)) {
      // A tag link REPLACES the filter rather than adding to it, so a shared URL
      // always lands on the same list regardless of the recipient's saved state.
      await loadTags();
      if (tagsApplyTo(r.topic) && facetOf(r.facet)) {
        progress.tagFilter = { [r.facet]: [r.value] };
        progress.tagFilterOpen = true;
        persist();
      }
      return await renderTopicHome(r.topic);
    }
    if (r.view === 'graphic' && known(r.topic)) {
      const m = await loadMeta(r.topic);
      if (!m.chapters.some(c => c.id === r.unit)) return await renderTopicHome(r.topic);
      await renderChapterDetail(r.topic, r.unit);
      return openSheetById(r.topic, r.unit, r.graphic);
    }
    if (r.view === 'unit' && known(r.topic)) {
      const m = await loadMeta(r.topic);
      if (m.chapters.some(c => c.id === r.unit)) return await renderChapterDetail(r.topic, r.unit);
      return await renderTopicHome(r.topic);
    }
  } catch (_) { /* fall through to the landing */ }
  return renderTopics();
}

// The unit whose detail screen is on screen — the other half of a graphic
// route. Set by renderChapterDetail, read when a sheet opens.
let curUnitForGraphic = null;

// Open one study sheet full-screen by its authored id (used by a deep link).
async function openSheetById(topic, unitId, sheetId) {
  if (!INFOGRAPHIC_TOPICS.has(topic) || !window.DrillInfographicViewer) return;
  const sets = await loadInfographicSets();
  const set = sets[`${topic}/${unitId}`];
  const item = set && Array.isArray(set.items) ? set.items.find(i => i.id === sheetId) : null;
  if (!item) return;
  const ch = await loadChapter(topic, unitId);
  window.DrillInfographicViewer.open({
    src: `assets/system-design/infographics/${topic}/${unitId}/${item.id}.png`,
    title: item.title,
    alt: `${ch.title}: ${item.title} system design infographic`,
    downloadName: infographicDownloadName(ch, item),
    sheetId: item.id
  });
}

// Keep the URL honest about what is on screen: opening a sheet addresses it,
// closing returns to the unit. setRoute uses replaceState, so this never
// stacks history entries the back button has to chew through.
document.addEventListener('drill-infographic-open', e => {
  const id = e.detail && e.detail.sheetId;
  if (!id || !curTopic || !curUnitForGraphic) return;
  setRoute(`#/${curTopic}/${curUnitForGraphic}/graphic/${id}`);
});
document.addEventListener('drill-infographic-close', () => {
  if (!curTopic || !curUnitForGraphic) return;
  setRoute(`#/${curTopic}/${curUnitForGraphic}`, { replace: true });
});

window.addEventListener('hashchange', () => {
  if (_routeSuppress) { _routeSuppress = false; return; }
  applyRoute().catch(() => {});
});

// ── App shell (D15 phase 2) ─────────────────────────────────────────────────
// The SAME nav + header index.html renders, from the same ds/shell.js and the
// same route registry. This block is only what is specific to THIS page: what
// its capabilities do, and how to turn its ids into titles and its Leitner
// boxes into a scoped meter. Nothing here reaches into the shell.
if (window.DrillShell) {
  // Titles arrive asynchronously (loadTopics / loadMeta / loadSets), so every
  // resolver falls back to the id and applyRoute() refreshes once they land.
  const sdTitle = (kind, p) => {
    if (kind === 'sdTopic') { const t = TOPICS.find(x => x.id === p.topic); return t ? t.title : null; }
    if (kind === 'sdComponent') { const c = componentById(p.component); return c ? c.title : null; }
    if (kind === 'sdUnit' || kind === 'sdSheet') {
      const m = META[p.topic];
      const ch = m && (m.chapters || []).find(c => c.id === p.unit);
      if (kind === 'sdUnit') return ch ? ch.title : null;
      const set = INFOGRAPHIC_SETS && INFOGRAPHIC_SETS[`${p.topic}/${p.unit}`];
      const item = set && (set.items || []).find(i => i.id === p.sheet);
      return item ? item.title : null;
    }
    return null;
  };

  // Same contract as the main app (docs/information-architecture.md §3 rule 2):
  // the meter reports the scope named in the breadcrumb beside it. A unit
  // answers in questions — the grain at which you actually drill here — while
  // a topic answers in units, which is what its own hero already reports, so
  // the header can never disagree with the page under it.
  const sdScope = (kind, p) => {
    if (kind === 'sdUnit' || kind === 'sdSheet') {
      const ch = CH[p.topic] && CH[p.topic][p.unit];
      if (!ch) return null;
      const st = chapterStats(p.topic, ch);
      return st.total ? { done: st.mastered, total: st.total } : null;
    }
    if (kind === 'sdTopic' || kind === 'sdPlan' || kind === 'sdTag' ||
        kind === 'sdMixed' || kind === 'sdDue' ||
        kind === 'sdComponent' || kind === 'sdComponentIndex') {
      if (!META[p.topic] || !CH[p.topic]) return null;
      const st = topicUnitStats(p.topic);
      return st.total ? { done: st.mastered, total: st.total } : null;
    }
    return null;
  };

  // What is due across every topic — the same question the main app's chip
  // answers, asked of this page's own store.
  const sdDue = () => {
    let n = 0;
    for (const t of TOPICS) {
      if (!META[t.id] || !CH[t.id]) continue;
      n += topicStats(t.id).due;
    }
    return n;
  };

  DrillShell.mount({
    page: 'system-design.html',
    // Search and Settings have no counterpart here, so the shell renders
    // neither — a nav that offers what the page cannot do is worse than a
    // shorter one. Stats IS this page's Progress surface.
    actions: { progress: () => openStats() },
    scope: sdScope,
    due: sdDue,
    // The topics landing is this page's root — no crumb, same as Home.
    crumb: { title: sdTitle, hidden: (kind) => kind === 'sdIndex' }
  });

  const _applyRoute = applyRoute;
  applyRoute = async function () {
    try { return await _applyRoute.apply(this, arguments); }
    finally { DrillShell.refresh(); }
  };
  // Grading writes Leitner boxes without navigating; the meter must follow.
  window.addEventListener('drill:storage-written', () => DrillShell.refresh());
}

applyRoute().catch(err => {
  document.getElementById('app').innerHTML =
    `<div class="empty">Couldn't load content.<br><small>${esc(err.message)}</small><br><br>
     Serve this over http (e.g. <code>python3 -m http.server</code>) — <code>file://</code> can't fetch the JSON.</div>`;
  console.error(err);
});
