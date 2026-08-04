// ============================================================================
// COMPONENT CATALOG — the building blocks, worked backwards
// ============================================================================
// Two screens: the catalog (every component grouped by category) and one
// component. The component screen is the inverted view — it leads with the
// SELECTION signal ("reach for it when…"), not with a definition, because the
// skill being drilled is picking the right block under a prompt you haven't
// seen. Prose is the answer key, not the page (PROFILE.md bans gating practice
// behind reading), so the reference body sits below the decision surface.
async function renderComponentCatalog(t) {
  session = null; curTopic = t;
  setRoute(`#/${t}/catalog`);
  document.getElementById('stats-btn').hidden = false;
  const app = document.getElementById('app');
  await loadCatalog();
  const cats = CATALOG.categories || [];
  const comps = CATALOG.components || [];
  const total = comps.reduce((n, c) => n + componentEdges(c.id).length, 0);

  const card = (c) => {
    const n = componentEdges(c.id).length;
    return `<a class="cmp-card" href="#/${t}/c/${encodeURIComponent(c.id)}" data-cmp="${esc(c.id)}">
      <span class="cmp-card__main">
        <span class="cmp-card__title">${esc(c.title)}</span>
        <span class="cmp-card__what">${fmt(c.what)}</span>
      </span>
      ${n ? `<span class="cmp-card__uses" title="Appears in ${n} canonical design problem${n === 1 ? '' : 's'}">${n}</span>`
          : `<span class="cmp-card__uses cmp-card__uses--none" title="Not yet mapped to a design problem">–</span>`}
    </a>`;
  };

  let html = `
    <section class="hero">
      <p class="book-title">${esc(CATALOG.title || 'Component Catalog')}</p>
      <p class="book-sub">${esc(CATALOG.subtitle || '')}</p>
      <p class="book-desc">${esc(CATALOG.description || '')}</p>
      <div class="cmp-legend">
        <span><b>${comps.length}</b> components</span>
        <span><b>${cats.length}</b> categories</span>
        <span><b>${total}</b> links into the ${esc(String(32))} design problems</span>
      </div>
    </section>`;

  for (const cat of cats) {
    // Within a category, most-used first. The asymmetry IS the curriculum
    // signal — caching carries 11 problems and vector-search 1, and flattening
    // that into alphabetical order would hide which blocks are load-bearing.
    // Ties fall back to AUTHORED order, not alphabetical: a category where
    // nothing is edge-mapped yet (Traffic & Routing) would otherwise lead with
    // "API Gateway" over "Load Balancer" purely because A sorts before L.
    const idx = Object.fromEntries(comps.map((c, i) => [c.id, i]));
    const list = comps.filter(c => c.category === cat.id)
      .sort((a, b) => componentEdges(b.id).length - componentEdges(a.id).length
        || idx[a.id] - idx[b.id]);
    if (!list.length) continue;
    html += `<div class="part-head">${esc(cat.title)}</div>
      <p class="cmp-cat-blurb">${esc(cat.blurb || '')}</p>
      <div class="cmp-grid">${list.map(card).join('')}</div>`;
  }

  app.innerHTML = html;
  app.querySelectorAll('.cmp-card').forEach(el => el.addEventListener('click', e => {
    // Let cmd/ctrl/middle-click open a real new tab; plain click renders in place.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault(); renderComponentDetail(t, el.dataset.cmp);
  }));
  window.scrollTo(0, 0);
}

async function renderComponentDetail(t, id) {
  session = null; curTopic = t;
  await loadCatalog();
  const c = componentById(id);
  if (!c) return renderComponentCatalog(t);
  setRoute(`#/${t}/c/${encodeURIComponent(id)}`);
  document.getElementById('stats-btn').hidden = false;
  const app = document.getElementById('app');
  const cat = (CATALOG.categories || []).find(x => x.id === c.category);
  const edges = componentEdges(id);
  // Titles come from the design-problems manifest, which is already the
  // denormalized source the topic index reads — no unit fetches needed.
  const dpMeta = await loadMeta('design-problems').catch(() => null);
  const dpTitle = {};
  if (dpMeta) for (const ch of dpMeta.chapters) dpTitle[ch.id] = ch.title;

  const bullets = (label, items, mod) => (items && items.length) ? `
    <section class="cmp-block cmp-block--${mod}">
      <h3>${esc(label)}</h3>
      <ul>${items.map(x => `<li>${fmt(x)}</li>`).join('')}</ul>
    </section>` : '';

  const alts = (c.alternatives || []).filter(a => componentById(a.id));
  const usedIn = edges.map(e => `
    <a class="cmp-use" href="#/design-problems/${encodeURIComponent(e.problem)}" data-prob="${esc(e.problem)}">
      <span class="cmp-use__title">${esc(dpTitle[e.problem] || e.problem)}</span>
      <span class="cmp-use__note">${fmt(e.note)}</span>
    </a>`).join('');

  app.innerHTML = `
    <div class="detail">
      <div class="detail-tag">${esc(cat ? cat.title : 'Component')}</div>
      <h2 class="detail-title">${esc(c.title)}</h2>
      <p class="detail-summary">${fmt(c.what)}</p>

      ${bullets('Reach for it when', c.reachFor, 'yes')}
      ${bullets("Don't reach for it when", c.avoid, 'no')}
      ${bullets('What it costs you', c.costs, 'cost')}
      ${bullets('How it breaks', c.failureModes, 'fail')}

      ${alts.length ? `
        <section class="cmp-block cmp-block--alt">
          <h3>Instead, consider</h3>
          <ul class="cmp-alts">${alts.map(a => {
            const o = componentById(a.id);
            return `<li><a class="cmp-alt__name" href="#/${t}/c/${encodeURIComponent(a.id)}" data-cmp="${esc(a.id)}">${esc(o.title)}</a>
              <span class="cmp-alt__note">${fmt(a.note)}</span></li>`;
          }).join('')}</ul>
        </section>` : ''}

      <section class="cmp-block cmp-block--uses">
        <h3>Used in ${edges.length} design problem${edges.length === 1 ? '' : 's'}${c.mechanism ? '' : ''}</h3>
        ${edges.length
          ? `<div class="cmp-uses">${usedIn}</div>`
          : `<p class="cmp-empty">Not yet mapped to a canonical design problem. It is still worth knowing — but if you are
             short on time, the components above it in this category carry more interview weight.</p>`}
      </section>

      <div class="cta-row">
        ${c.drill && c.drill.unit ? `<button class="cta ds-btn ds-btn--primary" id="cmp-drill">▶ Drill ${esc(c.title)}</button>` : ''}
        ${c.mechanism ? `<a class="cta ds-btn ds-btn--ghost" href="#/design-problems/tag/mechanism/${encodeURIComponent(c.mechanism)}" id="cmp-filter">Filter problems by this</a>` : ''}
      </div>
    </div>`;
  app.querySelectorAll('[data-cmp]').forEach(el => el.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault(); renderComponentDetail(t, el.dataset.cmp);
  }));
  app.querySelectorAll('[data-prob]').forEach(el => el.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault(); renderChapterDetail('design-problems', el.dataset.prob);
  }));
  const d = document.getElementById('cmp-drill');
  if (d) d.addEventListener('click', () => startChapter(c.drill.topic || t, c.drill.unit));
  window.scrollTo(0, 0);
}

