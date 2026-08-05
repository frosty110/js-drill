// ============================================================================
// TOPIC HOME (chapter list)
// ============================================================================
async function renderTopicHome(t) {
  session = null; curTopic = t;
  progress.lastTopic = t; persist();
  setRoute(`#/${t}`);
  document.getElementById('stats-btn').hidden = false;
  const app = document.getElementById('app');
  const m = await loadMeta(t);
  await loadTopicChapters(t);
  await loadTags();
  await loadPlans();
  const meta = TOPICS.find(x => x.id === t) || {};
  const s = topicStats(t);
  const u = topicUnitStats(t);
  const byId = Object.fromEntries(m.chapters.map(c => [c.id, CH[t][c.id]]));
  const resume = progress.lastChapter && byId[progress.lastChapter] ? progress.lastChapter : null;

  // audit F11: the hero's third line used to be an unconditional
  // "<u.due> chapters due for review", which read "0 chapters due for review"
  // to every first-time visitor. Lead with the work that actually exists —
  // review debt if there is any, otherwise how much is left to learn — and keep
  // the "nothing due" half stated so the absence of a queue is explicit rather
  // than merely missing. The primary CTA follows the same rule below: on a topic
  // where nothing has been seen there is nothing to REVIEW, so it says
  // "Start learning" (same #mixed-btn, same session — only the promise changes).
  const nounPl = esc(unitNoun(t, 2));
  const workLine = u.due
    ? `<b>${u.due}</b> ${esc(unitNoun(t, u.due))} due for review`
    : u.unseen
      ? `<b>${u.unseen}</b> ${esc(unitNoun(t, u.unseen))} to learn<br><span class="stat-sub">no ${nounPl} due for review yet</span>`
      : `All caught up — no ${nounPl} due for review`;

  let html = `
    <section class="ds-card hero">
      <p class="book-title">${esc(m.title)}</p>
      <p class="book-sub">${esc(m.subtitle || meta.kind || '')}</p>
      ${m.author ? `<p class="book-author">${esc(m.author)}</p>` : ''}
      <p class="book-desc">${esc(m.description || '')}</p>
      <div class="overall">
        <div class="ring-wrap"><div class="ring" style="--pct:${s.pct}"></div><span>${s.pct}%</span></div>
        <div class="stat-copy"><b>${u.mastered}</b> of <b>${u.total}</b> ${esc(unitNoun(t, u.total))} mastered<br>
          <span class="stat-sub">${s.mastered}/${s.total} questions${u.started ? ` · ${u.started} in progress` : ''}</span><br>
          ${workLine}</div>
      </div>
      <div class="cta-row">
        <button class="cta ds-btn ds-btn--primary" id="mixed-btn" ${s.total ? '' : 'disabled'}>${s.seen ? icon('zap') + ' Mixed review' : icon('play') + ' Start learning'}${s.due ? ` <span class="ds-chip ds-chip--warn due-pill">${s.due}</span>` : ''}</button>
        ${resume ? `<button class="cta ds-btn ds-btn--ghost" id="resume-btn">${icon('refresh')} Resume ${unitAbbrev(t)} ${chNum(byId[resume], t)}</button>` : ''}
      </div>
    </section>`;

  // Catalog entry. The 7 drill sections below are organised by AREA; the
  // catalog is the same material organised by COMPONENT and cross-linked to the
  // design problems that use each one. One row, above the section list, because
  // "which block do I reach for" is the question this topic exists to answer.
  if (catalogAppliesTo(t)) {
    await loadCatalog();
    const n = (CATALOG.components || []).length;
    const links = (CATALOG.components || []).reduce((a, c) => a + componentEdges(c.id).length, 0);
    html += `
      <a class="ds-card ds-card--flat ds-card--tap cmp-entry" href="#/${t}/catalog" id="catalog-entry">
        <span class="cmp-entry__icon sd-badge" aria-hidden="true">${icon('grid', 19)}</span>
        <span class="cmp-entry__main">
          <span class="cmp-entry__title">Component catalog</span>
          <span class="cmp-entry__sub">${n} building blocks · when to reach for each · ${links} links into the design problems</span>
        </span>
        <span class="ch-chevron" aria-hidden="true">${icon('chevron-right', 17)}</span>
      </a>`;
  }

  // Plan strip. Once a plan is running it collapses to a single resume row, so
  // it costs one line rather than a permanent carousel.
  if (plansApplyTo(t)) {
    const ap = activePlan();
    const active = ap ? planById(t, ap.id) : null;
    if (active) {
      const pr = planProgress(t, active);
      html += `
        <section class="plan-strip plan-strip--active">
          <div class="ds-card ds-card--flat plan-active">
            <div class="plan-active__main">
              <b>${esc(active.title)}</b>
              <span class="plan-active__meta">${ap.index + 1} of ${pr.total} · ${pr.done} mastered</span>
            </div>
            <button class="ds-btn ds-btn--primary plan-active__go" id="plan-resume">Resume →</button>
            <button class="plan-active__exit" id="plan-drop" title="Leave this plan" aria-label="Leave this plan">${icon('x', 17)}</button>
          </div>
        </section>`;
    } else {
      // Two labeled rows, not one list: a "Google loop" spanning 19 of 32
      // problems answers "what do they ask", not "I have 45 minutes". Filing
      // them under one heading would make the time budgets unreadable.
      const planCard = (p) => {
        const pr = planProgress(t, p);
        const pct = pr.total ? Math.round(pr.done / pr.total * 100) : 0;
        return `<button class="ds-card ds-card--flat ds-card--tap plan-card" data-plan="${esc(p.id)}">
          <span class="plan-card__title">${esc(p.title)}</span>
          <span class="plan-card__budget">${esc(p.budget)}${p.mode === 'crux' ? ' · crux' : ''}</span>
          <span class="ds-progress ds-progress--good plan-card__bar"><i style="width:${pct}%"></i></span>
          <span class="plan-card__frac">${pr.done}/${pr.total}</span>
        </button>`;
      };
      const row = (label, list) => list.length ? `
        <div class="plan-strip__label">${esc(label)}</div>
        <div class="plan-cards">${list.map(planCard).join('')}</div>` : '';
      const gen = companyPlans(t);
      html += `
        <section class="plan-strip">
          ${row('Pick a time budget', (PLANS.plans || []).map(p => ({ ...p, generated: false })))}
          ${row(`By company · ${gen.length}`, gen)}
        </section>`;
    }
  }

  const faceted = tagsApplyTo(t);
  const entryOf = Object.fromEntries(m.chapters.map(c => [c.id, c]));

  // Card renderer, shared by the grouped and filtered layouts.
  const card = (cid) => {
    const ch = byId[cid]; if (!ch) return '';
    const cs = chapterStats(t, ch);
    const p = cs.total ? Math.round(cs.mastered / cs.total * 100) : 0;
    const done = cs.total && cs.mastered === cs.total;
    let chips = '';
    if (faceted && entryOf[cid]) {
      const tags = entryTags(t, entryOf[cid]);
      const diff = tags.difficulty[0];
      // Mobile is the design center: difficulty + two mechanisms, then a count.
      const mech = tags.mechanism.slice(0, 2);
      const extra = tags.mechanism.length - mech.length;
      chips = `<div class="ch-tags">
        ${diff ? `<span class="ds-chip ds-chip--${SD_DIFF_VARIANT[diff]}">${esc(facetLabel('difficulty', diff))}</span>` : ''}
        ${mech.map(v => `<span class="ds-chip">${esc(facetLabel('mechanism', v))}</span>`).join('')}
        ${extra > 0 ? `<span class="ds-chip sd-chip--more">+${extra}</span>` : ''}
      </div>`;
    }
    return `
      <button class="ds-card ds-card--flat ds-card--tap ch-card" data-ch="${ch.id}">
        <div class="ch-num ${done ? 'done' : ''}">${done ? icon('check', 19) : chNum(ch, t)}</div>
        <div class="ch-main">
          <div class="ch-title">${esc(ch.title)}</div>
          <div class="ch-meta"><span class="ds-progress ds-progress--good"><i style="width:${p}%"></i></span>
            <span class="ch-frac">${cs.mastered}/${cs.total}</span>
            ${workLabel(cs)}</div>
          ${chips}
        </div>
        <span class="ch-chevron" aria-hidden="true">${icon('chevron-right', 17)}</span>
      </button>`;
  };

  if (faceted) {
    const present = presentValues(t, m.chapters);
    const active = tagFilterCount();
    const open = !!progress.tagFilterOpen || active > 0;
    const facets = (TAGS.facets || []).filter(f => (present[f.id] || new Set()).size > 1);
    html += `
      <section class="sd-filter ${open ? 'is-open' : ''}">
        <button class="sd-filter-head" id="filter-toggle" aria-expanded="${open}">
          <span class="sd-filter-title">Filter</span>
          ${active ? `<span class="ds-chip ds-chip--accent sd-filter-count">${active} active</span>` : ''}
          <span class="sd-filter-caret" aria-hidden="true">${icon(open ? 'chevron-down' : 'chevron-right', 15)}</span>
        </button>
        ${open ? `<div class="sd-filter-body">
          ${facets.map(f => {
            const vals = (f.values || []).filter(v => (present[f.id] || new Set()).has(v.id));
            // Derived facets (family) enumerate from the data, not the registry.
            const list = vals.length ? vals
              : Array.from(present[f.id] || []).sort().map(v => ({ id: v, label: v }));
            if (list.length < 2) return '';
            return `<div class="sd-facet">
              <div class="sd-facet-label">${esc(f.label)}</div>
              <div class="sd-facet-vals">
                ${list.map(v => `<button class="ds-chip sd-chip--btn ${tagFilterHas(f.id, v.id) ? 'is-on' : ''}"
                   data-facet="${esc(f.id)}" data-val="${esc(v.id)}">${esc(v.label)}</button>`).join('')}
              </div></div>`;
          }).join('')}
          ${active ? `<button class="ds-btn ds-btn--ghost sd-filter-clear" id="filter-clear">Clear all filters</button>` : ''}
        </div>` : ''}
      </section>`;

    if (active) {
      // Under an active filter the parts collapse into one flat list — same
      // behavior as the main app's merged Problems list.
      const hits = m.chapters.filter(e => tagMatch(entryTags(t, e)))
        .sort((a, b) => (m._order[a.id] || 0) - (m._order[b.id] || 0));
      html += `<div class="part-head">${hits.length} problem${hits.length === 1 ? '' : 's'} match</div>`;
      html += hits.length
        ? hits.map(e => card(e.id)).join('')
        : `<div class="ds-empty">
             <div class="ds-empty__title">No problems match all four filters</div>
             <p class="ds-empty__body">Try clearing the narrowest one.</p>
           </div>`;
    }
  }

  if (!faceted || !tagFilterCount()) {
    for (const part of m.parts) {
      html += `<div class="part-head">${esc(part.name)}</div>`;
      for (const cid of part.chapters) html += card(cid);
    }
  }

  app.innerHTML = html;
  app.querySelectorAll('.ch-card').forEach(el => el.addEventListener('click', () => renderChapterDetail(t, el.dataset.ch)));
  const ce = document.getElementById('catalog-entry');
  if (ce) ce.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault(); renderComponentCatalog(t);
  });
  const ft = document.getElementById('filter-toggle');
  if (ft) ft.addEventListener('click', () => {
    progress.tagFilterOpen = !(progress.tagFilterOpen || tagFilterCount() > 0);
    if (!progress.tagFilterOpen) clearTagFilter();
    persist(); renderTopicHome(t);
  });
  app.querySelectorAll('.sd-chip--btn').forEach(el => el.addEventListener('click', () => {
    toggleTag(el.dataset.facet, el.dataset.val); renderTopicHome(t);
  }));
  const fc = document.getElementById('filter-clear');
  if (fc) fc.addEventListener('click', () => { clearTagFilter(); renderTopicHome(t); });
  app.querySelectorAll('.plan-card').forEach(el => el.addEventListener('click', () =>
    startPlanStep(t, el.dataset.plan, 0)));
  const presume = document.getElementById('plan-resume');
  if (presume) presume.addEventListener('click', () => {
    const ap = activePlan(); startPlanStep(t, ap.id, ap.index);
  });
  const pdrop = document.getElementById('plan-drop');
  if (pdrop) pdrop.addEventListener('click', () => { clearActivePlan(); renderTopicHome(t); });
  const mb = document.getElementById('mixed-btn'); if (mb) mb.addEventListener('click', () => startMixed(t));
  const rb = document.getElementById('resume-btn'); if (rb) rb.addEventListener('click', () => renderChapterDetail(t, resume));
  window.scrollTo(0, 0);
}

