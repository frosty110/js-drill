// ============================================================================
// SUMMARY
// ============================================================================
function renderSummary() {
  const app = document.getElementById('app');
  const total = session.items.length;
  const pct = total ? Math.round(session.right / total * 100) : 0;
  const t = session.topic;
  app.innerHTML = `
    ${planHud()}
    <div class="summary">
      <h2>${session.plan ? esc(session.title) : 'Session complete'}</h2>
      <div class="score">${session.right}/${total}</div>
      <p class="sub">${pct}% on this ${session.mixed ? 'mixed review' : 'set'}.</p>
      ${session.gained ? `<div class="gained">🎯 ${session.gained} new item${session.gained === 1 ? '' : 's'} mastered</div>` : ''}
      <div class="cta-row" style="justify-content:center;margin-top:22px">
        ${session.plan
          ? `<button class="cta ds-btn ds-btn--primary" id="plan-next">${session.plan.index + 1 < session.plan.total ? 'Next in plan →' : 'Finish plan →'}</button>`
          : `<button class="cta ds-btn ds-btn--primary" id="again-btn">${session.mixed ? '⚡ Another mixed set' : (session.mode === 'crux' ? '⚡ Crux again' : '↻ Drill again')}</button>`}
        <button class="cta ds-btn ds-btn--ghost" id="back-btn">${session.mixed ? '← All chapters' : '← Back'}</button>
        ${session.mixed ? '' : `<button class="cta ds-btn ds-btn--ghost" id="share-session" title="Share a link carrying your results, for an AI to drill you from">Share</button>`}
      </div>
    </div>`;
  const chId = session.chId;
  const mode = session.mode;
  // Right after a session is the moment the result set is worth handing to an
  // AI — the misses are fresh and unexplained. Mixed reviews span chapters, so
  // they have no single unit URL to point at.
  const shareBtn = document.getElementById('share-session');
  if (shareBtn) shareBtn.addEventListener('click', () => openShareSheet(t, CH[t][chId]));
  const planNext = document.getElementById('plan-next');
  if (planNext) {
    const pl = session.plan;
    planNext.addEventListener('click', () => startPlanStep(t, pl.id, pl.index + 1));
  }
  wirePlanHud();
  document.getElementById('back-btn').addEventListener('click', () => session.mixed ? renderTopicHome(t) : renderChapterDetail(t, chId));
  const againBtn = document.getElementById('again-btn');
  if (againBtn) againBtn.addEventListener('click', () =>
    session.mixed ? startMixed(t) : (mode === 'crux' ? startCrux(t, chId) : startChapter(t, chId)));
  window.scrollTo(0, 0);
}

