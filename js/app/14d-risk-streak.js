// ──────────────────────────────────────────────────────────────────────────
//  AT-RISK MODAL — decay-radar union of dueAt + weakness + revealed flags
// ──────────────────────────────────────────────────────────────────────────
function initAtRiskModal() {
  // iter 60: At Risk — opens decay-radar modal with union-of-3-signals
  // list. Closes iter-59 roadmap entry #1. The modal lists up to 7 rows;
  // each row is tap-to-jump to that lesson at the appropriate tab.
  const atRiskModal = document.getElementById('at-risk-modal');
  function openAtRisk() {
    const rows = _atRiskRows(7);
    const body = document.getElementById('at-risk-body');
    if (!rows.length) {
      body.innerHTML = `<div style="color:#9aa0aa;text-align:center;padding:24px 0;">All clear — no wobbly or revealed lessons.</div>`;
    } else {
      // iter 33 (refine): urgency-shape inventory above the cards. ADHD/phone
      // user sees the distribution upfront ("2 DUE NOW · 1 SOON · 1 NO-SR")
      // instead of constructing it from per-card pills. Only non-zero buckets
      // render. Same iter-21/iter-28/iter-30 section-divider hex palette as
      // the codebase's other in-context inventory rows (iter-22 today-plan).
      const dueNow = rows.filter(r => r.isDue).length;
      const soon   = rows.filter(r => !r.isDue && r.daysTilDue !== null).length;
      const noSr   = rows.filter(r => r.daysTilDue === null).length;
      const invParts = [];
      if (dueNow) invParts.push(`<span style="color:#fca5a5;">${dueNow} DUE NOW</span>`);
      if (soon)   invParts.push(`<span style="color:#fdba74;">${soon} SOON</span>`);
      if (noSr)   invParts.push(`<span style="color:#9aa0aa;">${noSr} NO-SR</span>`);
      const inventoryHtml = invParts.length >= 1
        ? `<div data-at-risk-inventory style="display:flex;gap:10px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:12px;padding:6px 0 6px 10px;border-left:2px solid rgba(255,206,90,0.4);color:#ffce5a;">${invParts.join(`<span style="color:#4a4f58;">·</span>`)}</div>`
        : '';
      body.innerHTML = inventoryHtml + rows.map(r => {
        const dueChip = r.isDue
          ? `<span style="color:#fca5a5; font-size:11px; background:rgba(248,113,113,0.12); border:1px solid rgba(248,113,113,0.3); border-radius:999px; padding:2px 8px; font-weight:600;">DUE NOW</span>`
          : r.daysTilDue !== null
            ? `<span style="color:#fdba74; font-size:11px; background:rgba(251,146,60,0.12); border:1px solid rgba(251,146,60,0.3); border-radius:999px; padding:2px 8px;">in ${r.daysTilDue}d</span>`
            : `<span style="color:#6b7079; font-size:11px;">no SR</span>`;
        const missBadge = r.weaknessCount > 0
          ? `<span style="color:#fdba74; font-size:11px;">⚠ ${r.weaknessCount}×</span>`
          : '';
        const revealDot = r.revealedLevels.length > 0
          ? `<span style="color:#e9d5ff; font-size:11px; background:rgba(255,206,90,0.12); border:1px solid rgba(255,206,90,0.3); border-radius:999px; padding:2px 8px;" title="Mastered with reveal — drill clean to clear">${dsIcon('cards', 15)}${escapeHtml(r.revealedLevels.join('+'))}</span>`
          : '';
        return `<button data-lesson-id="${escapeHtml(r.lessonId)}" style="text-align:left; padding:12px 14px; border-radius:8px; background:#262930; border:1px solid #363a43; color:#eef0f2; cursor:pointer; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span style="font-size:14px; font-weight:500; color:#eef0f2;">${escapeHtml(r.title)}</span>
            ${dueChip}
          </div>
          <div style="display:flex; gap:8px; align-items:center; font-size:11px; color:#9aa0aa;">
            <span>${escapeHtml(r.section)}</span>
            ${missBadge ? `<span style="color:#4a4f58;">·</span>${missBadge}` : ''}
            ${revealDot ? `<span style="color:#4a4f58;">·</span>${revealDot}` : ''}
          </div>
        </button>`;
      }).join('');
      body.querySelectorAll('[data-lesson-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-lesson-id');
          atRiskModal.style.display = 'none';
          selectLesson(id);
        });
      });
    }
    atRiskModal.style.display = 'block';
  }
  // Design-loop P5: At Risk is absorbed into the Progress surface's "Fix
  // first" section (INVENTORY MERGE→Progress). The pill + #/m/at-risk land
  // there, focused on that section; the legacy modal stays as fallback.
  document.getElementById('at-risk-btn').addEventListener('click', () => {
    if (typeof openProgress === 'function') openProgress({ focus: 'attention' });
    else openAtRisk();
  });
  document.getElementById('at-risk-close').addEventListener('click', () => atRiskModal.style.display = 'none');
  atRiskModal.addEventListener('click', (e) => {
    if (e.target === atRiskModal) atRiskModal.style.display = 'none';
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  STREAK MAP MODAL — 60-day calendar density heatmap
// ──────────────────────────────────────────────────────────────────────────
// iter 62: Streak Map — 60-day calendar density heatmap. Renders a 9-column
// grid of 60 day-cells (oldest top-left → today bottom-right); cell color depth
// reflects events that day; tooltip shows date + breakdown on hover/tap, and a
// tap on a day with misses surfaces drill-route buttons. Extracted from the old
// standalone Streak Map modal into a reusable renderer — now hosted inside the
// unified Dashboard (openDashboard). `_close` lets the drill-route buttons close
// whatever modal is hosting the heatmap.
function renderActivityInto(rootEl, closeFn) {
  const _close = typeof closeFn === 'function' ? closeFn : () => {};
  const buckets = _streakMapBuckets(60);

  // ── Rate + streak summary. PROFILE.md (L72) explicitly wants a streak count
  // + today-vs-yesterday delta "progress at a glance"; the only guardrail (L109)
  // is gamification that OBSCURES real progress. So every number here is a real
  // rep: "solved" = a pass event (L1/L2/L3 + struggle/notes passes), "miss" = an
  // L1/walkthrough miss or flash-blank (per _streakMapBuckets' classifier).
  const todayActive = buckets[buckets.length - 1].passes > 0;
  let streak = 0;
  for (let i = buckets.length - 1 - (todayActive ? 0 : 1); i >= 0; i--) {
    if (buckets[i].passes > 0) streak++; else break;
  }
  const last7 = buckets.slice(-7);
  const wkPass = last7.reduce((s, b) => s + b.passes, 0);
  const wkMiss = last7.reduce((s, b) => s + b.misses, 0);
  const rate = wkPass / 7;
  const rateStr = rate >= 10 ? String(Math.round(rate)) : rate.toFixed(1);
  const successRate = (wkPass + wkMiss) > 0 ? Math.round(wkPass / (wkPass + wkMiss) * 100) : null;
  const streakLine = streak > 0
    ? `${dsIcon('flame', 15)}<strong style="color:#f5b62b;">${streak}-day streak</strong>${todayActive ? '' : ` · <span style="color:#fca5a5;">drill today to keep it</span>`}`
    : `<span style="color:#9aa0aa;">No streak yet — one solve today starts it.</span>`;
  const chip = (label, value, color) =>
    `<div style="flex:1; background:#17181c; border:1px solid #262930; border-radius:8px; padding:8px 10px; text-align:center;">
       <div style="font-size:18px; font-weight:700; color:${color};">${value}</div>
       <div style="font-size:10px; color:#9aa0aa; text-transform:uppercase; letter-spacing:0.04em;">${label}</div>
     </div>`;
  const summaryHtml = `
    <div style="font-size:13px; margin-bottom:10px;">${streakLine}</div>
    <div style="display:flex; gap:8px; margin-bottom:16px;">
      ${chip('Solved · 7d', wkPass, '#34d399')}
      ${chip('Per day', rateStr, '#ffce5a')}
      ${chip('First-try', successRate === null ? '—' : successRate + '%', '#ffce5a')}
    </div>`;

  // ── 14-day rate bars: height = reps that day, green=solved with amber=miss
  // stacked on top, so the daily RATE and the success/failure split both read
  // at a glance. Today's bar is outlined.
  const last14 = buckets.slice(-14);
  const barMax = Math.max(1, ...last14.map(b => b.passes + b.misses));
  const CH = 54;
  const barsHtml = `
    <div style="font-size:10px; color:#6b7079; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;">Last 14 days · solved/day</div>
    <div style="display:flex; align-items:flex-end; gap:3px; height:${CH}px; margin-bottom:4px;">
      ${last14.map((b, i) => {
        const ph = Math.round((b.passes / barMax) * CH);
        const mh = Math.round((b.misses / barMax) * CH);
        const isToday = i === last14.length - 1;
        const tip = `${b.dateLabel}: ${b.passes} solved${b.misses ? `, ${b.misses} miss` : ''}`;
        return `<div title="${escapeHtml(tip)}" style="flex:1; display:flex; flex-direction:column; justify-content:flex-end; height:${CH}px;${isToday ? ' outline:1px solid #4a4f58; outline-offset:1px; border-radius:2px;' : ''}">
          ${mh ? `<div style="height:${mh}px; background:#f59e0b; border-radius:2px 2px 0 0;"></div>` : ''}
          <div style="height:${ph}px; min-height:${b.passes ? '2px' : '0'}; background:#34d399; border-radius:${mh ? '0' : '2px 2px 0 0'};"></div>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; color:#6b7079; margin-bottom:18px;">
      <span>${escapeHtml(last14[0].dateLabel)}</span>
      <span style="display:flex; gap:10px;"><span><span style="color:#34d399;">■</span> solved</span><span><span style="color:#f59e0b;">■</span> miss</span></span>
      <span>Today</span>
    </div>`;

  rootEl.innerHTML = `
    ${summaryHtml}
    ${barsHtml}
    <div style="font-size:10px; color:#6b7079; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;">60-day consistency</div>
    <div data-act-tooltip style="margin-bottom: 8px; min-height: 22px; font-size: 12px; color: #9aa0aa;"></div>
    <div data-act-grid style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px;"></div>
    <div data-act-legend style="margin-top: 14px; display: flex; gap: 8px; align-items: center; font-size: 11px; color: #6b7079;"></div>`;
  {
    const max = buckets.reduce((m, b) => Math.max(m, b.total), 0);
    const grid = rootEl.querySelector('[data-act-grid]');
    const tooltip = rootEl.querySelector('[data-act-tooltip]');
    const legend = rootEl.querySelector('[data-act-legend]');
    // 5-tier color scale based on relative density (no absolute thresholds —
    // a user with 50 events/day max gets a different scale than one with 5).
    const tier = (count) => {
      if (count === 0) return 0;
      if (max <= 1) return count > 0 ? 4 : 0;
      const pct = count / max;
      if (pct < 0.25) return 1;
      if (pct < 0.5) return 2;
      if (pct < 0.75) return 3;
      return 4;
    };
    const tierColors = ['#262930', '#064e3b', '#065f46', '#10b981', '#34d399'];
    const tierTitles = ['none', 'light', 'medium', 'heavy', 'peak'];
    grid.innerHTML = buckets.map((b, idx) => {
      const t = tier(b.total);
      return `<button class="streak-cell" data-streak-idx="${idx}" type="button" title="${escapeHtml(b.dateLabel)} · ${b.total} event${b.total === 1 ? '' : 's'}" aria-label="${escapeHtml(b.dateLabel)}: ${b.total} events" style="aspect-ratio: 1; background: ${tierColors[t]}; border: 1px solid #17181c; border-radius: 3px; cursor: ${b.total > 0 ? 'pointer' : 'default'}; padding: 0;"></button>`;
    }).join('');
    // Legend swatches.
    legend.innerHTML = `<span>Less</span>` + tierColors.map((c, i) => `<span style="display:inline-block; width:12px; height:12px; background:${c}; border:1px solid #17181c; border-radius:3px;" title="${tierTitles[i]}"></span>`).join('') + `<span>More</span>`;
    // iter eval-2026-05-30 (Phase 4-A): forward-looking default
    // tooltip — past-only "X events across Y days" is vanity-adjacent.
    // Compute the user's peak streak (max consecutive active-day run)
    // and current gap (days since last active day) so the header
    // nudges interview-prep urgency, not history pride. Per
    // audits/streak-map.md edit 3.
    const totalAll = buckets.reduce((s, b) => s + b.total, 0);
    const activeDays = buckets.filter(b => b.total > 0).length;
    let peakStreak = 0, run = 0;
    for (const b of buckets) {
      if (b.total > 0) { run++; if (run > peakStreak) peakStreak = run; }
      else run = 0;
    }
    let gapDays = 0;
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (buckets[i].total > 0) break;
      gapDays++;
    }
    if (totalAll === 0) {
      tooltip.innerHTML = `<span style="color:#4a4f58;">No history yet — drill anything to start the map.</span>`;
    } else {
      const gapStr = gapDays === 0
        ? `drilled today ✓`
        : gapDays === 1 ? `last gap: yesterday — drill today to extend` : `last gap: ${gapDays} days — drill today to extend`;
      tooltip.innerHTML = `Peak streak: <strong style="color:#34d399;">${peakStreak} day${peakStreak === 1 ? '' : 's'}</strong> · ${gapStr} · ${activeDays}/60 active`;
    }
    // Per-cell hover/tap: replace the tooltip with that day's detail.
    // iter eval-2026-05-30 (Phase 4-A): on a click of a day-cell with
    // misses, also render a "Drill the N lessons you missed" routing
    // button that calls `selectLesson()`. Lifts Closed-loop from
    // pure-display to actionable routing per audits/streak-map.md edit 2.
    grid.querySelectorAll('[data-streak-idx]').forEach(cell => {
      const detail = (e) => {
        const b = buckets[+cell.dataset.streakIdx];
        if (b.total === 0) {
          tooltip.innerHTML = `<span style="color:#4a4f58;">${escapeHtml(b.dateLabel)} — no activity</span>`;
          return;
        }
        const head = `<strong style="color:#c4c9cf;">${escapeHtml(b.dateLabel)}</strong> · ${b.total} event${b.total === 1 ? '' : 's'} · <span style="color:#34d399;">${b.passes} pass</span>${b.misses > 0 ? ` · <span style="color:#f87171;">${b.misses} miss</span>` : ''}`;
        // Tap (not just hover) on a day with misses → show drill routes.
        // Hover stays informational only.
        const isClick = e && (e.type === 'click' || e.type === 'pointerdown');
        const missedIds = Array.isArray(b.missedLessonIds) ? b.missedLessonIds : [];
        if (isClick && missedIds.length > 0) {
          const lessons = missedIds.map(id => CURRICULUM.find(l => l.id === id)).filter(Boolean).slice(0, 5);
          const routesHtml = lessons.length > 0
            ? `<div style="margin-top:6px;">Drill the ${lessons.length === 1 ? 'lesson' : `${lessons.length} lessons`} you missed:<br>${lessons.map(l => `<button class="streak-route-btn" data-route-id="${escapeHtml(l.id)}" style="margin:4px 6px 0 0; padding:3px 8px; font-size:11px; background:rgba(248,113,113,0.12); border:1px solid rgba(248,113,113,0.35); color:#fca5a5; border-radius:4px; cursor:pointer;">${escapeHtml(l.title)} →</button>`).join('')}</div>`
            : '';
          tooltip.innerHTML = head + routesHtml;
          tooltip.querySelectorAll('[data-route-id]').forEach(btn => {
            btn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              const id = btn.getAttribute('data-route-id');
              _close();
              if (typeof selectLesson === 'function') selectLesson(id);
            });
          });
        } else {
          tooltip.innerHTML = head;
        }
      };
      cell.addEventListener('mouseenter', detail);
      cell.addEventListener('click', detail);
    });
  }
}

function initStreakMapModal() {
  // Streak Map is retired into the unified Dashboard. The hidden #streak-map-btn
  // now routes there so the Review path and #/m/streak-map deep-links resolve.
  const btn = document.getElementById('streak-map-btn');
  if (btn) btn.addEventListener('click', () => openDashboard());
}

