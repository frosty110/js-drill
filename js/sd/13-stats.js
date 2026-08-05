// ============================================================================
// STATS MODAL (current topic)
// ============================================================================
async function openStats() {
  if (!curTopic) return;
  const t = curTopic;
  const m = await loadMeta(t);
  await loadTopicChapters(t);
  const byId = Object.fromEntries(m.chapters.map(c => [c.id, CH[t][c.id]]));
  let totalQ = 0, totalM = 0, totalDue = 0, seenQ = 0;
  m.chapters.forEach(c => chapterItems(t, byId[c.id]).forEach(it => {
    totalQ++; const b = boxOf(it.key); if (b.seen > 0) seenQ++; if (b.box >= MASTER_BOX) totalM++; if (isDue(it.key)) totalDue++;
  }));

  let parts = '';
  for (const part of m.parts) {
    let pm = 0, pt = 0;
    const rows = part.chapters.map(cid => {
      const ch = byId[cid]; if (!ch) return '';
      const s = chapterStats(t, ch); pm += s.mastered; pt += s.total;
      const p = s.total ? Math.round(s.mastered / s.total * 100) : 0;
      return `<div class="row"><span class="nm">${unitAbbrev(t)} ${chNum(ch, t)}. ${esc(ch.title)}</span>
        <span class="ds-progress ds-progress--good" style="max-width:90px"><i style="width:${p}%"></i></span>
        <span class="ch-frac">${s.mastered}/${s.total}</span></div>`;
    }).join('');
    parts += `<div class="part-stat"><div class="ph">${esc(part.name)} — ${pm}/${pt}</div>${rows}</div>`;
  }

  document.getElementById('stats-body').innerHTML = `
    <button class="close" id="stats-close" aria-label="Close">${icon('x', 18)}</button>
    <h2>Your progress</h2>
    <p style="color:var(--muted);font-size:13px;margin:2px 0 0">${esc(m.title)}</p>
    <div class="sd-stat-grid">
      <div class="ds-stat"><b>${totalM}</b><span>Mastered</span></div>
      <div class="ds-stat"><b>${seenQ}</b><span>Seen</span></div>
      <div class="ds-stat"><b>${totalDue}</b><span>Due</span></div>
    </div>
    ${parts}
    <button class="danger-link" id="reset-btn">Reset all system-design progress</button>`;
  document.getElementById('stats-modal').classList.add('is-open');
  document.getElementById('stats-close').addEventListener('click', closeStats);
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset ALL system-design progress (every topic)? This cannot be undone.')) {
      progress = { __v: 1, boxes: {}, lastTopic: t, lastChapter: null };
      persist(); closeStats(); renderTopicHome(t);
    }
  });
}
function closeStats() { document.getElementById('stats-modal').classList.remove('is-open'); }

