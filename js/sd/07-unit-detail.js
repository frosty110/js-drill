// ============================================================================
// UNIT DETAIL — key ideas + choose a drill mode
// ============================================================================
async function renderChapterDetail(t, chId) {
  session = null; curTopic = t; curUnitForGraphic = chId;
  progress.lastTopic = t; progress.lastChapter = chId; persist();
  setRoute(`#/${t}/${chId}`);
  document.getElementById('stats-btn').hidden = false;
  const app = document.getElementById('app');
  const ch = await loadChapter(t, chId);
  const m = await loadMeta(t);
  await loadTags();
  const items = chapterItems(t, ch);
  const cs = chapterStats(t, ch);
  const csWork = workLabel(cs);   // "N due" / "N to learn" — audit F11
  const cruxCount = items.filter(it => it.q.crux).length;
  const takeaways = ch.keyTakeaways || [];
  const diagrams = diagramsOf(ch);
  const infographicSets = INFOGRAPHIC_TOPICS.has(t) ? await loadInfographicSets() : {};
  const infographicSet = infographicSets[`${t}/${ch.id}`] || null;
  const label = `${unitAbbrev(t)} ${chNum(ch, t)}`;
  const entry = tagsApplyTo(t) ? m.chapters.find(c => c.id === chId) : null;
  const dTags = entry ? entryTags(t, entry) : null;
  const tagRow = dTags ? `
    <div class="detail-tags">
      ${dTags.difficulty.map(v => `<span class="ds-chip ds-chip--${SD_DIFF_VARIANT[v]}">${esc(facetLabel('difficulty', v))}</span>`).join('')}
      ${dTags.company.map(v => `<a class="ds-chip sd-chip--co" href="#/${t}/tag/company/${encodeURIComponent(v)}">${esc(facetLabel('company', v))}</a>`).join('')}
    </div>` : '';

  // The problem→component half of the graph. The mechanism tags used to render
  // as bare chips linking SIDEWAYS to a filtered list of other problems — you
  // could see that a problem "uses caching" but never what caching was doing in
  // it, and there was no component page to land on. Now each mechanism resolves
  // to its component and carries the same annotation the component page shows,
  // so the traversal works in both directions. docs/component-catalog.md.
  let componentRow = '';
  if (dTags && dTags.mechanism.length) {
    await loadCatalog();
    const used = problemComponents(chId, dTags.mechanism);
    const sig = used.filter(u => u.signature).length;
    if (used.length) componentRow = `
      <section class="ds-card ds-card--flat cmp-block cmp-block--uses cmp-inplay">
        <h3>Components in play — ${used.length}${sig ? `, ${sig} signature` : ''}</h3>
        <div class="cmp-uses">${used.map(u => `
          <a class="cmp-use${u.signature ? ' cmp-use--sig' : ''}" href="#/components/c/${encodeURIComponent(u.component.id)}" data-cmp-link="${esc(u.component.id)}">
            <span class="cmp-use__title">${esc(u.component.title)}${u.signature ? ' <span class="ds-chip ds-chip--accent cmp-sig" title="A headline mechanism for this problem — what an interviewer probes">signature</span>' : ''}</span>
            <span class="cmp-use__note">${fmt(u.note || u.component.what)}</span>
          </a>`).join('')}</div>
      </section>`;
  }

  app.innerHTML = `
    <div class="ds-card detail">
      <div class="detail-head">
        <div class="detail-tag">${esc(label)}</div>
        <button class="ds-btn ds-btn--ghost detail-share" id="share-unit" title="Share a link carrying your results, for an AI to drill you from">${icon('share', 15)} Share</button>
      </div>
      <h2 class="detail-title">${esc(ch.title)}</h2>
      <p class="detail-summary">${fmt(ch.summary || '')}</p>
      <div class="detail-prog"><span class="ds-progress ds-progress--good"><i style="width:${cs.total ? Math.round(cs.mastered / cs.total * 100) : 0}%"></i></span>
        <span class="ch-frac">${cs.mastered}/${cs.total} mastered</span>${csWork ? ` · ${csWork}` : ''}</div>
      ${tagRow}
      ${componentRow}
      ${takeaways.length ? `
        <div class="ds-card ds-card--flat key-ideas">
          <h3>${icon('lightbulb', 15)} Key ideas${cruxCount ? ' — the crux to memorize' : ''}</h3>
          <ul>${takeaways.map(k => `<li>${fmt(k)}</li>`).join('')}</ul>
        </div>` : ''}
      ${INFOGRAPHIC_TOPICS.has(t) ? `<div id="unit-infographic"></div>` : ''}
      ${diagrams.length && t !== 'design-problems' ? `<div id="unit-diagrams"></div>` : ''}
      <div class="cta-row">
        <button class="cta ds-btn ds-btn--primary" id="drill-all">${icon('play')} Drill all <span class="ds-chip due-pill" style="background:rgba(23,24,28,.25);color:inherit">${items.length}</span></button>
        ${cruxCount ? `<button class="cta ds-btn ds-btn--ghost" id="drill-crux">${icon('zap')} Crux only <span class="ds-chip due-pill" style="background:var(--ds-accent-soft);color:var(--ds-accent-hi)">${cruxCount}</span></button>` : ''}
      </div>
    </div>`;
  document.getElementById('drill-all').addEventListener('click', () => startChapter(t, chId));
  document.getElementById('share-unit').addEventListener('click', () => openShareSheet(t, ch));
  app.querySelectorAll('[data-cmp-link]').forEach(el => el.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    // Hand the component page the problem you left, so it can offer a way
    // back. The breadcrumb structurally cannot: a component is CONTAINED by
    // the catalog, not by the problem that sent you to it.
    e.preventDefault(); renderComponentDetail('components', el.dataset.cmpLink, { topic: t, unit: chId });
  }));
  const cx = document.getElementById('drill-crux'); if (cx) cx.addEventListener('click', () => startCrux(t, chId));
  if (INFOGRAPHIC_TOPICS.has(t)) renderLessonInfographics(document.getElementById('unit-infographic'), t, ch, infographicSet);
  if (diagrams.length && t !== 'design-problems') {
    const host = document.getElementById('unit-diagrams');
    renderDiagramDeck(host, diagrams);
  }
  window.scrollTo(0, 0);
}

