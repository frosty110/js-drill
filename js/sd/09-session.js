// ============================================================================
// SESSION SETUP
// ============================================================================
async function startChapter(t, chId) {
  const ch = await loadChapter(t, chId);
  progress.lastTopic = t; progress.lastChapter = chId; persist();
  const items = chapterItems(t, ch);
  let ordered;
  if (META[t] && META[t].ordered) {
    // Walkthrough topics (e.g. design problems) play the full arc in authored
    // order — requirements → estimation → deep dives read as one coherent pass.
    ordered = items;
  } else {
    // needsDrill, not isDue: a session pool wants new cards up front too — it's
    // only the COUNTS the user reads that must keep new and overdue apart (F11).
    const first = shuffle(items.filter(it => needsDrill(it.key)));
    const rest = shuffle(items.filter(it => !needsDrill(it.key)));
    ordered = first.concat(rest);
  }
  session = { topic: t, chId, mode: 'all', title: ch.title, items: ordered, pos: 0, right: 0, gained: 0, streak: 0, answered: false };
  renderQuestion();
}

// Crux drill — only the curated signature questions, in authored order.
async function startCrux(t, chId) {
  const ch = await loadChapter(t, chId);
  progress.lastTopic = t; progress.lastChapter = chId; persist();
  const items = chapterItems(t, ch).filter(it => it.q.crux);
  session = { topic: t, chId, mode: 'crux', title: `${ch.title} · Crux`, items, pos: 0, right: 0, gained: 0, streak: 0, answered: false };
  renderQuestion();
}

// Plan step — one unit inside a running plan. Deliberately reuses the ordinary
// session shape and renderQuestion(); the plan owns only the queue, the cursor
// and the HUD, so SR scheduling and grading stay in exactly one place.
async function startPlanStep(t, planId, index) {
  await loadPlans(); await loadMeta(t); await loadTags();
  const plan = planById(t, planId);
  if (!plan) return renderTopicHome(t);
  const units = planUnits(t, plan);
  if (index >= units.length) return renderPlanDone(t, plan);

  const chId = units[index];
  const ch = await loadChapter(t, chId);
  const items = plan.mode === 'crux'
    ? chapterItems(t, ch).filter(it => it.q.crux)
    : chapterItems(t, ch);
  // A step with no items would strand the user on a blank screen; skip forward
  // rather than render nothing. The validator makes this near-impossible, but a
  // hand-edited plan shouldn't be able to wedge the runner.
  if (!items.length) return startPlanStep(t, planId, index + 1);

  setActivePlan(planId, index);
  progress.lastTopic = t; progress.lastChapter = chId; persist();
  setRoute(`#/${t}/plan/${planId}`);
  session = {
    topic: t, chId, mode: plan.mode, title: ch.title, items,
    pos: 0, right: 0, gained: 0, streak: 0, answered: false,
    plan: { id: planId, index, total: units.length, label: plan.title }
  };
  renderQuestion();
}

function renderPlanDone(t, plan) {
  clearActivePlan();
  session = null;
  setRoute(`#/${t}`);
  const app = document.getElementById('app');
  const pr = planProgress(t, plan);
  app.innerHTML = `
    <div class="ds-card detail">
      <div class="detail-tag">Plan complete</div>
      <h2 class="detail-title">${esc(plan.title)}</h2>
      <p class="detail-summary">You worked all ${pr.total} ${esc(unitNoun(t, pr.total))} in this plan.
        ${pr.done} of ${pr.total} are fully mastered — the rest stay in spaced review.</p>
      <div class="cta-row">
        <button class="cta ds-btn ds-btn--primary" id="plan-again">${icon('refresh')} Run it again</button>
        <button class="cta ds-btn ds-btn--ghost" id="plan-back">${icon('chevron-left')} All ${esc(unitNoun(t, 2))}</button>
      </div>
    </div>`;
  document.getElementById('plan-back').addEventListener('click', () => renderTopicHome(t));
  document.getElementById('plan-again').addEventListener('click', () => startPlanStep(t, plan.id, 0));
  window.scrollTo(0, 0);
}

// The HUD strip. This used to say "same shape as the main app's scoped-review
// HUD so the family reads as one product" and then build its own — different
// classes, no icon, no meter, bare <button>s. It is now literally the same
// component (.ds-hud in ds/components.css, promoted there for exactly this
// reason), so the two can no longer drift: a change to the strip changes both.
// `.plan-hud` survives only as this page's placement.
function planHud() {
  if (!session || !session.plan) return '';
  const p = session.plan;
  const pct = p.total ? Math.round(100 * p.index / p.total) : 0;
  return `<div class="ds-hud plan-hud">
    <span class="ds-hud__icon" aria-hidden="true">${icon('refresh', 14)}</span>
    <span class="ds-hud__label">${esc(p.label)}</span>
    <span class="ds-hud__count">${p.index + 1}/${p.total}</span>
    <span class="ds-progress ds-hud__meter"><i style="width:${pct}%"></i></span>
    <button class="ds-btn ds-btn--ghost ds-btn--pill ds-hud__btn" id="plan-skip">Skip</button>
    <button class="ds-iconbtn ds-hud__btn" id="plan-exit" aria-label="Exit plan">${icon('x', 15)}</button>
  </div>`;
}
function wirePlanHud() {
  const skip = document.getElementById('plan-skip');
  if (skip) skip.addEventListener('click', () => {
    const p = session.plan;
    startPlanStep(session.topic, p.id, p.index + 1);
  });
  const exit = document.getElementById('plan-exit');
  if (exit) exit.addEventListener('click', () => {
    const t = session.topic;
    clearActivePlan(); session = null; renderTopicHome(t);
  });
}

// Due-only review — the session the main app's Home ⟲ links to. It exists
// because startMixed()'s pool is the needsDrill() union, which includes untouched
// cards; on a mostly-new topic that turns a "Review 2" affordance into 20
// shuffled NEW cards with the 2 actually-overdue ones nowhere in sight. This
// pool is strictly cards the user has SEEN whose interval has come around —
// isDue() itself since audit F11 — oldest first, matching the count Home shows.
// Empty pool → fall back to mixed so the route is never a dead end.
async function startDue(t) {
  await loadTopicChapters(t);
  progress.lastTopic = t; persist();
  const pool = [];
  META[t].chapters.forEach(c => chapterItems(t, CH[t][c.id]).forEach(it => {
    if (isDue(it.key)) pool.push({ it, due: boxOf(it.key).due });
  }));
  if (!pool.length) return startMixed(t);
  setRoute(`#/${t}/due`);
  pool.sort((a, b) => a.due - b.due);
  session = { topic: t, title: 'Due review', items: pool.map(x => x.it).slice(0, 20),
    pos: 0, right: 0, gained: 0, streak: 0, answered: false, mixed: true };
  renderQuestion();
}

async function startMixed(t) {
  await loadTopicChapters(t);
  progress.lastTopic = t; persist();
  setRoute(`#/${t}/mixed`);
  let pool = [];
  // Same union as startChapter: mixed review is a QUEUE, so unseen cards belong
  // in it — see the needsDrill note in § SR (audit F11).
  META[t].chapters.forEach(c => chapterItems(t, CH[t][c.id]).forEach(it => { if (needsDrill(it.key)) pool.push(it); }));
  if (pool.length < 12) {
    const extra = [];
    META[t].chapters.forEach(c => chapterItems(t, CH[t][c.id]).forEach(it => { if (!needsDrill(it.key)) extra.push({ it, box: boxOf(it.key).box }); }));
    extra.sort((a, b) => a.box - b.box);
    pool = pool.concat(extra.slice(0, 12 - pool.length).map(x => x.it));
  }
  session = { topic: t, title: 'Mixed Review', items: shuffle(pool).slice(0, 20), pos: 0, right: 0, gained: 0, streak: 0, answered: false, mixed: true };
  renderQuestion();
}

