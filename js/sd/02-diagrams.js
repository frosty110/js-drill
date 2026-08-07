// ── Diagrams ────────────────────────────────────────────────────────────
// Mermaid is 3.5 MB — by far the largest thing this page can fetch, and most
// visits never open a diagram at all. It used to be a `<script defer>` in the
// page head, so every visitor on every load paid for it whether or not they
// looked at a single architecture diagram. It is now fetched on FIRST DIAGRAM
// RENDER instead.
//
// It stays in the service worker's APP_SHELL, so the fetch is usually a cache
// hit and offline diagrams keep working — the change is to when the network is
// asked, not to whether the bytes are available.
let _mermaidReady = false, _mmdCounter = 0, _mermaidLoad = null;

// Load the vendored bundle once. Resolves to false rather than rejecting, so
// every failure path (offline first visit, blocked, corrupt) lands on the same
// graceful fallback the caller already had.
function loadMermaid() {
  if (window.mermaid) return Promise.resolve(true);
  if (_mermaidLoad) return _mermaidLoad;
  _mermaidLoad = new Promise((resolve) => {
    const el = document.createElement('script');
    el.src = 'vendor/mermaid/mermaid.min.js';
    el.async = true;
    el.onload = () => resolve(!!window.mermaid);
    el.onerror = () => { _mermaidLoad = null; resolve(false); };  // let a later attempt retry
    document.head.appendChild(el);
  });
  return _mermaidLoad;
}

function initMermaid() {
  if (_mermaidReady) return true;
  if (!window.mermaid) return false;   // not loaded yet → caller falls back
  try {
    window.mermaid.initialize({
      startOnLoad: false, securityLevel: 'loose', theme: 'base',
      themeVariables: {
        background: '#0e0f12', primaryColor: '#262930', primaryTextColor: '#eef0f2',
        primaryBorderColor: '#f5b62b', lineColor: '#9aa0aa', secondaryColor: '#0f2233',
        tertiaryColor: '#0e0f12', clusterBkg: '#0f2233',
        fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif', fontSize: '14px'
      }
    });
    _mermaidReady = true;
  } catch (e) { /* leave false */ }
  return _mermaidReady;
}
// Render a { kind:'mermaid'|'svg', code, caption } diagram into `el`. Degrades to
// showing the source if mermaid isn't available, so the page never depends on
// the library actually loading.
//
// `isStale` is an optional predicate checked immediately before each write. A
// caller that can re-render the same element (the deck's prev/next) passes one
// so a slow render cannot paint over a newer one. Every write below is guarded,
// because the awaits — the lazy library fetch AND mermaid.render itself — both
// give the user time to press the button again.
async function renderDiagramInto(el, diagram, isStale) {
  if (!el || !diagram || !diagram.code) return;
  const stale = () => (typeof isStale === 'function' && isStale());
  const cap = diagram.caption ? `<div class="diagram-cap">${esc(diagram.caption)}</div>` : '';
  if (diagram.kind === 'svg') {
    if (!stale()) el.innerHTML = cap + `<div class="diagram-box">${diagram.code}</div>`;
    return;
  }
  // First mermaid diagram on the page pays the fetch; the rest are free.
  await loadMermaid();
  if (stale()) return;
  if (initMermaid()) {
    try {
      const { svg } = await window.mermaid.render('mmd' + (_mmdCounter++), diagram.code);
      if (!stale()) el.innerHTML = cap + `<div class="diagram-box">${svg}</div>`;
      return;
    } catch (e) { /* fall through to source */ }
  }
  if (!stale()) el.innerHTML = cap + `<pre class="diagram-src">${esc(diagram.code)}</pre>`;
}

// New content uses `diagrams[]`; legacy content can keep its singular `diagram`.
// A unit/question may therefore opt into the visual deck without a migration.
function diagramsOf(owner) {
  if (!owner) return [];
  if (Array.isArray(owner.diagrams)) return owner.diagrams.filter(d => d && d.code);
  return owner.diagram && owner.diagram.code ? [owner.diagram] : [];
}

function diagramsForItem(it) {
  const questionDiagrams = diagramsOf(it.q);
  const unit = CH[it.topic] && CH[it.topic][it.chId];
  const unitDiagrams = diagramsOf(unit).filter(d => d.afterQuestion === it.qIndex);
  return questionDiagrams.concat(unitDiagrams);
}

// One-at-a-time is intentional: four small diagrams remain phone-readable instead
// of becoming a long wall of SVGs. Hiding SVG text turns the same visual into a
// label-recall prompt without maintaining a second copy of the diagram.
function renderDiagramDeck(el, diagrams, label = 'Visual models') {
  if (!el || !diagrams.length) return;
  let index = 0, recall = false, paintToken = 0;
  el.className = 'diagram-deck';
  el.innerHTML = `
    <div class="diagram-deck__head">
      <div><span class="diagram-deck__eyebrow"></span><strong class="diagram-deck__title"></strong></div>
      <span class="diagram-deck__count" aria-live="polite"></span>
    </div>
    <div class="diagram-slot"></div>
    <p class="diagram-deck__takeaway"></p>
    <div class="diagram-deck__controls">
      <button class="ds-btn ds-btn--ghost diagram-prev" type="button" aria-label="Previous diagram">${icon('chevron-left', 17)}</button>
      <button class="ds-btn ds-btn--ghost diagram-recall" type="button" aria-pressed="false">Hide labels</button>
      <button class="ds-btn ds-btn--ghost diagram-next" type="button" aria-label="Next diagram">${icon('chevron-right', 17)}</button>
    </div>`;
  const eyebrow = el.querySelector('.diagram-deck__eyebrow');
  const title = el.querySelector('.diagram-deck__title');
  const count = el.querySelector('.diagram-deck__count');
  const slot = el.querySelector('.diagram-slot');
  const takeaway = el.querySelector('.diagram-deck__takeaway');
  const prev = el.querySelector('.diagram-prev');
  const next = el.querySelector('.diagram-next');
  const recallBtn = el.querySelector('.diagram-recall');

  async function paint() {
    const token = ++paintToken;
    const diagram = diagrams[index];
    recall = false;
    el.classList.remove('is-recall');
    recallBtn.textContent = 'Hide labels';
    recallBtn.setAttribute('aria-pressed', 'false');
    eyebrow.textContent = diagram.role ? `${label} · ${diagram.role}` : label;
    title.textContent = diagram.title || diagram.caption || `Diagram ${index + 1}`;
    count.textContent = `${index + 1} / ${diagrams.length}`;
    takeaway.textContent = diagram.takeaway || '';
    takeaway.hidden = !diagram.takeaway;
    prev.disabled = diagrams.length < 2;
    next.disabled = diagrams.length < 2;
    slot.innerHTML = '<div class="loading">Rendering diagram…</div>';
    // The staleness check has to gate the WRITE, not follow it. It used to sit
    // after this await, where it could not prevent anything — renderDiagramInto
    // sets slot.innerHTML itself, so by the time the token was compared the
    // stale picture was already on screen.
    //
    // That was survivable while the await was a mermaid.render() microtask. It
    // stopped being survivable when Mermaid became a lazy 3.4 MB fetch: the
    // window is now seconds on a phone, so tapping ▸ twice during the first
    // diagram of a deck left the title reading "3 / 4" above whichever render
    // happened to resolve last. On a study surface the label IS the thing being
    // learned, so a header that disagrees with the picture is worse than a slow
    // one.
    await renderDiagramInto(slot, { ...diagram, caption: '' },
      () => token !== paintToken);
  }
  prev.addEventListener('click', () => { index = (index - 1 + diagrams.length) % diagrams.length; paint(); });
  next.addEventListener('click', () => { index = (index + 1) % diagrams.length; paint(); });
  recallBtn.addEventListener('click', () => {
    recall = !recall;
    el.classList.toggle('is-recall', recall);
    recallBtn.textContent = recall ? 'Reveal labels' : 'Hide labels';
    recallBtn.setAttribute('aria-pressed', String(recall));
  });
  paint();
}

function legacyInfographicPath(topic, ch) {
  return `assets/system-design/infographics/${topic}/${ch.id}.png`;
}

function infographicDownloadName(ch, item) {
  const slug = ch.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug}-${item ? item.id : 'overview'}-infographic.png`;
}

const INFOGRAPHIC_TOPICS = new Set(['components', 'ddia', 'design-problems']);
function renderLessonInfographics(el, topic, ch, authoredSet) {
  if (!el || !INFOGRAPHIC_TOPICS.has(topic)) return;
  if (authoredSet && Array.isArray(authoredSet.items) && authoredSet.items.length) {
    const set = document.createElement('drill-infographic-set');
    set.data = {
      ...authoredSet,
      items: authoredSet.items.map(item => ({
        ...item,
        src: `assets/system-design/infographics/${topic}/${ch.id}/${item.id}.png`,
        alt: `${ch.title}: ${item.title} system design infographic`,
        downloadName: infographicDownloadName(ch, item)
      }))
    };
    el.replaceWith(set);
    return;
  }
  const infographic = document.createElement('drill-infographic');
  infographic.setAttribute('src', legacyInfographicPath(topic, ch));
  infographic.setAttribute('title', ch.title);
  infographic.setAttribute('alt', `Quick-review system design infographic for ${ch.title}`);
  infographic.setAttribute('download-name', infographicDownloadName(ch));
  el.replaceWith(infographic);
}

function unitAbbrev(t) { return (META[t] && META[t].unitAbbrev) || 'Ch'; }
// Display number = position in the flattened parts order (see loadMeta). Falls
// back to the authored num for any topic loaded without a manifest.
function chNum(c, t) {
  const order = t && META[t] && META[t]._order;
  if (order && c && order[c.id] != null) return order[c.id];
  return c.num != null ? c.num : c.chapter;
}

