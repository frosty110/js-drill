// ── 17: Today home — the landing surface (design-loop P2, slice 1) ─────────
// The bottom nav's "Today" destination: ONE next rep, picked for you, one tap
// from drilling (JOURNEYS J1; PROFILE "press one thing → you're drilling").
// Matches the ratified Home mockup (mock-compare.png, variant C · Ink & Amber):
// greeting + streak chip → hero next-up card (amber Start) → 3 ambient stat
// tiles → a short "THEN" queue. Built from ds/ components (first full content
// surface on the new design system).
//
// Pick logic = dailyPlan() (09-stats): due reviews > weak spot > recent
// tagged miss > next on starter path. The hero is plan[0]; THEN is plan[1..2].
// Deep link: #/m/today-home (hidden #today-home-btn, same contract as every
// other mode). The Today's Plan MODAL stays reachable (Practice menu) as the
// full-queue detail view; this page is the calm default.

function _todayNextLevel(lessonId) {
  for (const lvl of ['L1', 'L2', 'L3']) {
    if (levelStatus(lessonId, lvl) !== 'passed') return lvl;
  }
  return 'L3'; // fully mastered — a review rep lands on the recall tier
}

const _TODAY_LEVEL_META = {
  L1: { label: 'L1 · concept', mins: 1 },
  L2: { label: 'L2 · fill-in', mins: 2 },
  L3: { label: 'L3 · from memory', mins: 5 },
};

function _todayStreak() {
  const buckets = _streakMapBuckets(60);
  const passesToday = buckets[buckets.length - 1]?.passes || 0;
  // Grace rule (same as the Dashboard, 14-init-core): a not-yet-drilled-today
  // user KEEPS their streak — start counting from yesterday when today is
  // inactive. Without this, the pre-drill "Good morning" moment (the page's
  // whole reason to exist) would tell a mid-streak user they have no streak.
  let streak = 0;
  for (let i = buckets.length - (passesToday > 0 ? 1 : 2); i >= 0; i--) {
    if (buckets[i].passes > 0) streak++; else break;
  }
  return { streak, todayActive: passesToday > 0, passesToday };
}

function openTodayHome() {
  const shell = document.getElementById('lesson-shell');
  if (!shell) return;
  const plan = typeof dailyPlan === 'function' ? dailyPlan() : [];
  const { streak, todayActive, passesToday } = _todayStreak();
  const dueCount = typeof dueReviewIds === 'function' ? dueReviewIds().length : 0;
  const weakCount = Object.keys(state.weakness || {}).filter(k => state.weakness[k]).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'short' }) + ' · ' +
    new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  // Honest estimate: sum the per-level minutes of the actual queued reps
  // (the same numbers the hero chip shows), not a flat per-lesson constant.
  const mins = Math.max(1, plan.reduce((sum, p) =>
    sum + _TODAY_LEVEL_META[_todayNextLevel(p.id)].mins, 0));
  const subLine = plan.length
    ? `${dueCount > 0 ? `${dueCount} lesson${dueCount === 1 ? '' : 's'} due` : `${plan.length} rep${plan.length === 1 ? '' : 's'} queued`} · about ${mins} minutes`
    : 'Nothing queued — you’re caught up.';

  const first = plan[0];
  const firstLesson = first ? findLesson(first.id) : null;
  const firstLevel = first ? _todayNextLevel(first.id) : null;
  const lvlMeta = firstLevel ? _TODAY_LEVEL_META[firstLevel] : null;
  const trackLabel = firstLesson ? (TRACK_PILLS[firstLesson.track] || TRACK_PILLS.patterns).label : '';

  const flame = dsIcon('flame', 13);
  const streakChip = streak > 0
    ? (todayActive
        ? `<span class="ds-chip ds-chip--accent">${flame}${streak}-day streak</span>`
        : `<span class="ds-chip ds-chip--accent">${flame}${streak}-day · keep it today</span>`)
    : `<span class="ds-chip">${flame}Start a streak</span>`;

  const heroHtml = first ? `
    <div class="ds-card" style="margin-top: var(--ds-s5);">
      <p class="ds-eyebrow" style="margin:0 0 8px;">Next up · picked for you</p>
      <h2 class="ds-h2" style="font-size: var(--ds-fs-xl); margin: 0 0 6px;">${escapeHtml(firstLesson?.title || first.id)}</h2>
      <p class="ds-dim" data-today-desc style="margin: 0 0 14px; min-height: 1.4em;">${escapeHtml(firstLesson?.section || '')}</p>
      <div style="display:flex; gap: var(--ds-s2); flex-wrap: wrap; margin-bottom: var(--ds-s4);">
        <span class="ds-chip">${escapeHtml(trackLabel)}</span>
        <span class="ds-chip">${escapeHtml(lvlMeta.label)}</span>
        <span class="ds-chip">~${lvlMeta.mins} min</span>
        <span class="ds-chip ds-chip--warn">${escapeHtml(first.why)}</span>
      </div>
      <button class="ds-btn ds-btn--primary ds-btn--lg ds-btn--block" data-today-start data-lesson-id="${escapeHtml(first.id)}">Start&nbsp;&nbsp;→</button>
    </div>` : `
    <div class="ds-card" style="margin-top: var(--ds-s5); text-align:center;">
      <p style="margin: 6px 0 10px; color: var(--ds-good);">${dsIcon('check-circle', 44)}</p>
      <h2 class="ds-h2" style="margin: 0 0 6px;">All clear</h2>
      <p class="ds-dim" style="margin: 0 0 16px;">Reviews done, no weak spots waiting. Sharpen something anyway?</p>
      <div style="display:flex; gap: var(--ds-s2);">
        <button class="ds-btn ds-btn--ghost" style="flex:1;" data-today-mode="shuffle">${dsIcon('dice', 16)}Shuffle</button>
        <button class="ds-btn ds-btn--ghost" style="flex:1;" data-today-mode="mock">${dsIcon('target', 16)}Mock</button>
      </div>
    </div>`;

  const thenRows = plan.slice(1, 3).map(({ id, why }) => {
    const l = findLesson(id);
    const lvl = _todayNextLevel(id);
    return `
      <div class="ds-row" data-today-row data-lesson-id="${escapeHtml(id)}" role="button" tabindex="0" style="cursor:pointer;">
        <span class="ds-row__badge">${lvl}</span>
        <div class="ds-row__main">
          <b>${escapeHtml(l?.title || id)}</b>
          <span>${escapeHtml(l?.section || '')} · ${escapeHtml(why)}</span>
        </div>
        <span class="ds-row__chev">›</span>
      </div>`;
  }).join('');

  const thenHtml = thenRows ? `
    <p class="ds-label" style="margin: var(--ds-s5) 0 var(--ds-s2);">Then</p>
    <div class="ds-card ds-card--flat" style="padding: var(--ds-s1) var(--ds-s4);">${thenRows}</div>` : '';

  shell.innerHTML = `
    <div class="ds-root today-home-page" style="max-width: 560px; margin: 0 auto; background: transparent;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap: var(--ds-s3);">
        <span class="ds-dim" style="font-size: var(--ds-fs-sm);">${escapeHtml(dateLine)}</span>
        ${streakChip}
      </div>
      <h1 class="ds-title" style="margin: var(--ds-s4) 0 4px;">${greeting}</h1>
      <p class="ds-dim" style="margin: 0;">${subLine}</p>
      ${heroHtml}
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: var(--ds-s2); margin-top: var(--ds-s5);">
        <div class="ds-stat ds-stat--accent"><b>${dueCount}</b><span>Due</span></div>
        <div class="ds-stat"><b>${weakCount}</b><span>Weak</span></div>
        <div class="ds-stat"><b>${passesToday}</b><span>Today</span></div>
      </div>
      ${thenHtml}
    </div>`;

  // Lazy-enrich the hero with the lesson's one-line description once its JSON
  // arrives (manifest entries don't carry descriptions; don't block paint).
  if (first) {
    loadLessonContent(first.id).then(body => {
      const el = shell.querySelector('[data-today-desc]');
      if (el && body?.description) el.textContent = body.description;
    }).catch(() => {});
  }

  shell.querySelectorAll('[data-today-start], [data-today-row]').forEach(el => {
    const go = () => selectLesson(el.getAttribute('data-lesson-id'));
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  shell.querySelectorAll('[data-today-mode]').forEach(el => {
    el.addEventListener('click', () => {
      const btn = document.getElementById(el.getAttribute('data-today-mode') + '-btn');
      if (btn) btn.click();
    });
  });

  const main = document.querySelector('.app-main');
  if (main) main.scrollTop = 0;
}

(() => {
  const btn = document.getElementById('today-home-btn');
  if (btn) btn.addEventListener('click', openTodayHome);
})();
