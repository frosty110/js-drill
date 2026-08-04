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

  let html = `<div class="lead"><h2>System Design study drills</h2>
    <p>Active recall for interviews. Pick a track — memorize the theory, the method, and the building blocks.</p></div>`;
  for (const t of TOPICS) {
    const s = topicStats(t.id);
    html += `
      <button class="topic-card" data-topic="${t.id}">
        <span class="topic-icon">${t.icon || '📘'}</span>
        <span class="topic-body">
          <span class="topic-title">${esc(t.title)}</span>
          <div class="topic-kind">${esc(t.kind || '')}</div>
          <div class="topic-blurb">${esc(t.blurb || '')}</div>
          <div class="topic-prog"><span class="bar"><i style="width:${s.pct}%"></i></span>
            <span class="ch-frac">${s.mastered}/${s.total}</span>
            ${workLabel(s)}</div>
        </span>
        <span class="ch-chevron">›</span>
      </button>`;
  }
  app.innerHTML = html;
  app.querySelectorAll('.topic-card').forEach(el => el.addEventListener('click', () => renderTopicHome(el.dataset.topic)));
  window.scrollTo(0, 0);
}

