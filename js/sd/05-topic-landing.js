// ============================================================================
// TOPIC LANDING
// ============================================================================
async function renderTopics() {
  session = null; curTopic = null;
  setRoute('#/');
  document.getElementById('stats-btn').hidden = true;
  const app = document.getElementById('app');
  await loadTopics();
  await Promise.all(TOPICS.map(t => loadTopicChapters(t.id)));

  let html = `<div class="lead"><h2>Concept study drills</h2>
    <p>Active recall for interviews. Pick a track — the distributed-systems theory and the interview method, or the AI engineering and agent books.</p></div>`;

  // Topics are grouped into SHELVES (data/system-design/topics.json → shelves[]).
  // The engine is topic-generic, so a second shelf of books costs a heading
  // rather than a page: what separates "System Design" from "AI Engineering &
  // Agents" is subject matter, not machinery. A topic with no `shelf` (or one
  // naming a shelf the registry doesn't declare) falls into the first shelf, so
  // adding a topic without touching the registry can't make it disappear.
  const shelves = (SHELVES && SHELVES.length) ? SHELVES : [{ id: null, title: '' }];
  const known = new Set(shelves.map(s => s.id));
  const shelfOf = (t) => (t.shelf && known.has(t.shelf)) ? t.shelf : shelves[0].id;
  const multi = shelves.length > 1;

  for (const shelf of shelves) {
    const inShelf = TOPICS.filter(t => shelfOf(t) === shelf.id);
    if (!inShelf.length) continue;
    if (multi) {
      html += `<div class="shelf-head"><h3>${esc(shelf.title || '')}</h3>
        ${shelf.blurb ? `<p>${esc(shelf.blurb)}</p>` : ''}</div>`;
    }
    for (const t of inShelf) {
      const s = topicStats(t.id);
      html += `
        <button class="ds-card ds-card--tap topic-card" data-topic="${t.id}">
          <span class="topic-icon sd-badge" aria-hidden="true">${icon(t.icon || 'book', 24)}</span>
          <span class="topic-body">
            <span class="topic-title">${esc(t.title)}</span>
            <div class="topic-kind">${esc(t.kind || '')}</div>
            <div class="topic-blurb">${esc(t.blurb || '')}</div>
            <div class="topic-prog"><span class="ds-progress ds-progress--good"><i style="width:${s.pct}%"></i></span>
              <span class="ch-frac">${s.mastered}/${s.total}</span>
              ${workLabel(s)}</div>
          </span>
          <span class="ch-chevron" aria-hidden="true">${icon('chevron-right', 17)}</span>
        </button>`;
    }
  }
  app.innerHTML = html;
  app.querySelectorAll('.topic-card').forEach(el => el.addEventListener('click', () => renderTopicHome(el.dataset.topic)));
  window.scrollTo(0, 0);
}

