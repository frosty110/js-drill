// ── Diagrams ────────────────────────────────────────────────────────────
let _mermaidReady = false, _mmdCounter = 0;
function initMermaid() {
  if (_mermaidReady) return true;
  if (!window.mermaid) return false;   // CDN not loaded (offline / blocked) → caller falls back
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
// showing the source if mermaid isn't available so the page never depends on the CDN.
async function renderDiagramInto(el, diagram) {
  if (!el || !diagram || !diagram.code) return;
  const cap = diagram.caption ? `<div class="diagram-cap">${esc(diagram.caption)}</div>` : '';
  if (diagram.kind === 'svg') { el.innerHTML = cap + `<div class="diagram-box">${diagram.code}</div>`; return; }
  if (initMermaid()) {
    try {
      const { svg } = await window.mermaid.render('mmd' + (_mmdCounter++), diagram.code);
      el.innerHTML = cap + `<div class="diagram-box">${svg}</div>`;
      return;
    } catch (e) { /* fall through to source */ }
  }
  el.innerHTML = cap + `<pre class="diagram-src">${esc(diagram.code)}</pre>`;
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
      <button class="ds-btn ds-btn--ghost diagram-prev" type="button" aria-label="Previous diagram">‹</button>
      <button class="ds-btn ds-btn--ghost diagram-recall" type="button" aria-pressed="false">Hide labels</button>
      <button class="ds-btn ds-btn--ghost diagram-next" type="button" aria-label="Next diagram">›</button>
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
    await renderDiagramInto(slot, { ...diagram, caption: '' });
    if (token !== paintToken) return;
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

