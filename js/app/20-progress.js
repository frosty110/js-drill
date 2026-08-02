// ── 20: Progress — unified progress surface (design-loop P5) ───────────────
// The nav's "Progress" destination, rebuilt on the ds/ system. ONE scrollable
// arc: Today snapshot → Activity (rep bars + consistency heatmap) → Fix first
// (the absorbed At-Risk / Resurrect / Reveal-Replay queues) → Mastery →
// More insights (progressive disclosure for the long-tail lifetime stats).
//
// Replaces the legacy openDashboard body (14-init-core delegates here) and
// absorbs the standalone At-Risk modal (its #at-risk-btn routes here too, per
// INVENTORY.md MERGE→Progress verdicts). The session heatstrip's facts-only
// summary joins the Today section. Resurrect / Reveal-Replay keep their
// one-tap direct actions (#resurrect-btn / #reveal-replay-btn are synthetic-
// click targets of the Fix-first rows) — capability unchanged (D05).
//
// Charts follow the dataviz method: status colors reserved for status
// (good = solved / warn = miss, CVD-validated pair + legend + fixed stack
// order as secondary encoding); the heatmap is a ONE-hue sequential ramp
// (--ds-viz-*); marks are thin, data-ends rounded, baselines square; text
// wears text tokens only. Page-specific classes live in css/07-ds-progress.css.
//
// Deep links: #/m/dashboard (canonical), #/m/stats, #/m/streak-map and
// #/m/at-risk all resolve here via their hidden buttons. No new state.

const _PROG_DRILLS = [
  { key: 'recognize', label: 'Recognize', sub: 'name the pattern family', btn: 'recognize-btn' },
  { key: 'gotcha', label: 'Crux recall', sub: 'key-trick recall', btn: 'gotcha-btn' },
  { key: 'claim', label: 'Claim check', sub: 'complexity smell-test', btn: 'claim-btn' },
  { key: 'crystal', label: 'Predict', sub: 'mental execution', btn: 'crystal-btn' },
  { key: 'bugHunt', label: 'Bug hunt', sub: 'spot the operator flip', btn: 'bug-hunt-btn' },
];

function _progHeatTier(count, max) {
  if (count === 0) return 0;
  if (max <= 1) return 4;
  const pct = count / max;
  if (pct < 0.25) return 1;
  if (pct < 0.5) return 2;
  if (pct < 0.75) return 3;
  return 4;
}

// ── Section builders (pure HTML strings; wiring happens in _wireProgress) ──

function _progTodayHtml(buckets) {
  const today = buckets[buckets.length - 1] || { passes: 0, misses: 0 };
  const yest = buckets[buckets.length - 2] || { passes: 0, misses: 0 };
  const due = typeof dueReviewIds === 'function' ? dueReviewIds().length : 0;
  const weak = Object.keys(state.weakness || {}).filter(k => state.weakness[k]).length;
  const delta = (today.passes || 0) - (yest.passes || 0);
  let deltaLine;
  if (!today.passes && !today.misses) {
    deltaLine = `<span class="ds-mute">No reps logged yet today — one drill counts.</span>`;
  } else if (delta > 0) {
    deltaLine = `<span style="color: var(--ds-good);">▲ ${delta} more solved than yesterday — keep going.</span>`;
  } else if (delta < 0) {
    deltaLine = `<span class="ds-dim">▼ ${-delta} fewer than yesterday so far.</span>`;
  } else {
    deltaLine = `<span class="ds-dim">On pace with yesterday.</span>`;
  }
  // Absorbed session heatstrip summary — facts only, renders only mid-session.
  const s = typeof _heatstripSessionSummary === 'function' ? _heatstripSessionSummary() : null;
  const sessionLine = s && s.eventCount > 0
    ? `<p class="ds-mute" style="margin: var(--ds-s1) 0 0; font-size: var(--ds-fs-sm);">This session · ${s.minActive} min · ${s.lessonsTouched} lesson${s.lessonsTouched === 1 ? '' : 's'} · ${s.passes} pass${s.passes === 1 ? '' : 'es'}${s.missCount ? ` · ${s.missCount} miss${s.missCount === 1 ? '' : 'es'}` : ''}</p>`
    : '';
  return `
    <section class="ds-section" data-prog-today>
      <span class="ds-label ds-section__label">Today</span>
      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: var(--ds-s2);">
        <div class="ds-stat ds-stat--accent"><b>${today.passes || 0}</b><span>Solved</span></div>
        <div class="ds-stat"><b>${today.misses || 0}</b><span>Missed</span></div>
        <div class="ds-stat"><b>${due}</b><span>Due</span></div>
        <div class="ds-stat"><b>${weak}</b><span>Weak</span></div>
      </div>
      <p style="margin: var(--ds-s2) 0 0; font-size: var(--ds-fs-sm);">${deltaLine}</p>
      ${sessionLine}
    </section>`;
}

// audit F15: on a first run every chart in this section is chrome around a
// number that CANNOT exist yet — 0-height bars, a 60-cell grid of empty
// tiles, "— first-try". docs/ui-ux-guide.md's empty-state rule says an empty
// surface must explain itself and offer exactly one way out, so when there
// isn't a single event in the window we render one ds-empty block instead of
// the chart frame. The Today tiles above stay: their zeros are honest facts
// about today, not placeholders for missing data.
function _progActivityEmptyHtml(everDrilled) {
  // Same first-run fallback the Home hero uses, so "start drilling" means the
  // same lesson on both surfaces rather than a second opinion.
  const target = typeof homeContinueTarget === 'function'
    ? (homeContinueTarget({ kind: 'area', key: 'coding' }) || homeContinueTarget({ kind: 'area', key: 'syntax' }))
    : null;
  const lesson = target ? findLesson(target.id) : null;
  // The label carries a lesson title of unknown length, so it wears
  // .prog-empty-cta (07-ds-progress.css) — capped + ellipsized rather than
  // pushing the 390px column into a horizontal scroll.
  const cta = lesson
    ? `<button type="button" class="ds-btn ds-btn--primary prog-empty-cta" data-prog-start="${escapeHtml(target.id)}" data-prog-start-level="${escapeHtml(target.level || 'L1')}"><span>Start ${escapeHtml(lesson.title)}</span> →</button>`
    : `<button type="button" class="ds-btn ds-btn--primary prog-empty-cta" data-prog-action="home"><span>Find something to drill</span> →</button>`;
  const title = everDrilled ? 'Nothing in the last 60 days' : 'No reps logged yet';
  const body = everDrilled
    ? 'Your charts cover the last 60 days and that window is empty. One drill re-starts the rep bars, the consistency map and the retention signals below.'
    : 'Once you drill, this section charts reps per day, a 60-day consistency map and how fast each section decays. One lesson is enough to start it.';
  return `
    <section class="ds-section" data-prog-activity data-prog-activity-empty>
      <span class="ds-label ds-section__label">Activity</span>
      <div class="ds-card ds-card--flat">
        <div class="ds-empty">
          <div class="ds-empty__icon">${dsIcon('chart', 28)}</div>
          <p class="ds-empty__title">${title}</p>
          <p class="ds-empty__body">${body}</p>
          ${cta}
        </div>
      </div>
    </section>`;
}

// "Has this user EVER drilled?" — decides which empty-state copy runs. It must
// NOT be read from `state.history` alone: history is a later addition, and
// loadProgress (04-progress-sr.js) hands back `{}` for it on any __v 2/3/4 blob
// or a restored older backup. Such a user has real mastery, so "No reps logged
// yet" would flatly contradict the Mastery section further down the same page.
// progress/reviews are the durable proof a rep happened.
function _progEverDrilled() {
  const nonEmpty = (o) => !!o && typeof o === 'object' && Object.keys(o).length > 0;
  return nonEmpty(state.history) || nonEmpty(state.progress) || nonEmpty(state.reviews);
}

function _progActivityHtml(buckets) {
  // No events anywhere in the 60-day window → empty state, not empty charts.
  if (!buckets.length || buckets.every(b => b.total === 0)) {
    return _progActivityEmptyHtml(_progEverDrilled());
  }
  const last7 = buckets.slice(-7);
  const wkPass = last7.reduce((s, b) => s + b.passes, 0);
  const wkMiss = last7.reduce((s, b) => s + b.misses, 0);
  const rate = wkPass / 7;
  const rateStr = rate >= 10 ? String(Math.round(rate)) : rate.toFixed(1);
  const firstTry = (wkPass + wkMiss) > 0 ? Math.round(wkPass / (wkPass + wkMiss) * 100) : null;
  const weekChips = `
    <div style="display:flex; gap: var(--ds-s2); flex-wrap: wrap;">
      <span class="ds-chip ds-chip--good">${wkPass} solved · 7d</span>
      <span class="ds-chip">${rateStr}/day</span>
      <span class="ds-chip">${firstTry === null ? '—' : firstTry + '%'} first-try</span>
    </div>`;

  // 14-day stacked rep bars (solved base, miss cap; today outlined).
  const last14 = buckets.slice(-14);
  const barMax = Math.max(1, ...last14.map(b => b.passes + b.misses));
  const CH = 52; // px available for segments (56px track − 2px gap headroom)
  const bars = last14.map((b, i) => {
    const ph = b.passes ? Math.max(2, Math.round((b.passes / barMax) * CH)) : 0;
    const mh = b.misses ? Math.max(2, Math.round((b.misses / barMax) * CH)) : 0;
    const tip = `${b.dateLabel}: ${b.passes} solved${b.misses ? `, ${b.misses} miss` : ''}`;
    const segs =
      (mh ? `<i class="seg-miss" style="height:${mh}px"></i>` : '') +
      (ph ? `<i class="seg-pass" style="height:${ph}px"></i>` : '') ||
      `<i class="seg-none"></i>`;
    return `<div class="prog-bar${i === last14.length - 1 ? ' is-today' : ''}" title="${escapeHtml(tip)}">${segs}</div>`;
  }).join('');

  // 60-day consistency heatmap (sequential one-hue ramp) + summary line.
  const max = buckets.reduce((m, b) => Math.max(m, b.total), 0);
  const cells = buckets.map((b, idx) => {
    const t = _progHeatTier(b.total, max);
    const label = `${b.dateLabel}: ${b.total} event${b.total === 1 ? '' : 's'}`;
    return `<button type="button" class="prog-heatcell${b.total > 0 ? ' has-events' : ''}" data-heat-idx="${idx}" data-tier="${t}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" tabindex="${b.total > 0 ? 0 : -1}"></button>`;
  }).join('');
  const totalAll = buckets.reduce((s, b) => s + b.total, 0);
  const activeDays = buckets.filter(b => b.total > 0).length;
  let peakStreak = 0, run = 0;
  for (const b of buckets) {
    if (b.total > 0) { run++; if (run > peakStreak) peakStreak = run; } else run = 0;
  }
  let gapDays = 0;
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (buckets[i].total > 0) break;
    gapDays++;
  }
  const heatSummary = totalAll === 0
    ? `<span class="ds-mute">No history yet — drill anything to start the map.</span>`
    : `Peak streak <strong style="color: var(--ds-good);">${peakStreak} day${peakStreak === 1 ? '' : 's'}</strong> · ${gapDays === 0 ? 'drilled today' : gapDays === 1 ? 'last rep: yesterday' : `last rep: ${gapDays} days ago`} · ${activeDays}/60 active`;

  return `
    <section class="ds-section" data-prog-activity>
      <span class="ds-label ds-section__label">Activity</span>
      <div class="ds-card ds-card--flat">
        ${weekChips}
        <div class="prog-bars" style="margin-top: var(--ds-s4);" role="img" aria-label="Reps per day, last 14 days">${bars}</div>
        <div class="prog-bars-meta">
          <span>${escapeHtml(last14[0].dateLabel)}</span>
          <span class="prog-legend"><span class="prog-swatch" style="background: var(--ds-good);"></span>solved<span class="prog-swatch" style="background: var(--ds-warn); margin-left: var(--ds-s2);"></span>miss</span>
          <span>Today</span>
        </div>
        <div style="border-top: 1px solid var(--ds-line); margin: var(--ds-s4) 0;"></div>
        <div class="prog-heat-detail" data-heat-detail aria-live="polite">${heatSummary}</div>
        <div class="prog-heat">${cells}</div>
        <div class="prog-bars-meta">
          <span>60 days</span>
          <span class="prog-legend">Less
            <span class="prog-swatch" style="background: var(--ds-viz-0);"></span>
            <span class="prog-swatch" style="background: var(--ds-viz-1);"></span>
            <span class="prog-swatch" style="background: var(--ds-viz-2);"></span>
            <span class="prog-swatch" style="background: var(--ds-viz-3);"></span>
            <span class="prog-swatch" style="background: var(--ds-viz-4);"></span>
          More</span>
        </div>
      </div>
    </section>`;
}

function _progAttentionHtml() {
  const rows = typeof _atRiskRows === 'function' ? _atRiskRows(7) : [];
  const resIds = typeof resurrectIds === 'function' ? resurrectIds() : [];
  const revealQ = typeof _revealedQueue === 'function' ? _revealedQueue() : [];

  const riskRows = rows.map(r => {
    const chips = [
      r.isDue ? `<span class="ds-chip ds-chip--accent" style="padding: 1px 8px;">due now</span>`
        : r.daysTilDue !== null ? `<span class="ds-chip" style="padding: 1px 8px;">due in ${r.daysTilDue}d</span>` : '',
      r.weaknessCount > 0 ? `<span class="ds-chip ds-chip--bad" style="padding: 1px 8px;">${r.weaknessCount} miss${r.weaknessCount === 1 ? '' : 'es'}</span>` : '',
      r.revealedLevels.length > 0 ? `<span class="ds-chip ds-chip--warn" style="padding: 1px 8px;">revealed ${escapeHtml(r.revealedLevels.join('+'))}</span>` : '',
    ].join('');
    return `
      <button type="button" class="ds-row prog-rowbtn" data-prog-lesson="${escapeHtml(r.lessonId)}">
        <div class="ds-row__main">
          <b>${escapeHtml(r.title)}</b>
          <span>${escapeHtml(r.section)}</span>
        </div>
        ${chips}
        <span class="ds-row__chev">›</span>
      </button>`;
  }).join('');

  const resRow = resIds.length ? `
    <button type="button" class="ds-row prog-rowbtn" data-prog-action="resurrect">
      <span class="ds-row__badge">${dsIcon('refresh', 16)}</span>
      <div class="ds-row__main">
        <b>Resurrect ${resIds.length} overdue lesson${resIds.length === 1 ? '' : 's'}</b>
        <span>Mastered, but past 2× the review interval — drill the most overdue</span>
      </div>
      <span class="ds-row__chev">›</span>
    </button>` : '';

  const revealRow = revealQ.length ? `
    <button type="button" class="ds-row prog-rowbtn" data-prog-action="reveal-replay">
      <span class="ds-row__badge">${dsIcon('eye', 16)}</span>
      <div class="ds-row__main">
        <b>Re-earn ${revealQ.length} revealed pass${revealQ.length === 1 ? '' : 'es'}</b>
        <span>Pass again without peeking to clear the reveal flag</span>
      </div>
      <span class="ds-row__chev">›</span>
    </button>` : '';

  // Bridge — cross-track transfer gaps (nav-audit P2-3). With the sidebar
  // retired (D10) the old count-pill was the mode's last glanceable channel;
  // this row gives the transfer-opportunity signal its visible home
  // (INVENTORY verdict MERGE→Progress). Same synthetic-click contract as
  // Resurrect / Reveal-Replay. Empty until MECHANIC_INDEX lazy-builds — the
  // same gating the old pill had.
  const bridges = typeof _bridgeCandidates === 'function' ? _bridgeCandidates() : [];
  const bridgeRow = bridges.length ? `
    <button type="button" class="ds-row prog-rowbtn" data-prog-action="bridge">
      <span class="ds-row__badge">${dsIcon('layers', 16)}</span>
      <div class="ds-row__main">
        <b>Bridge ${bridges.length} transfer gap${bridges.length === 1 ? '' : 's'}</b>
        <span>You know this mechanic in another track — ride the transfer</span>
      </div>
      <span class="ds-row__chev">›</span>
    </button>` : '';

  const body = riskRows + resRow + revealRow + bridgeRow;
  const card = body
    ? `<div class="ds-card ds-card--flat" style="padding: var(--ds-s1) var(--ds-s4);">${body}</div>`
    : `<div class="ds-card ds-card--flat" style="text-align: center; padding: var(--ds-s5);">
         <p style="margin: 0 0 var(--ds-s2); color: var(--ds-good);">${dsIcon('check-circle', 32)}</p>
         <p class="ds-dim" style="margin: 0;">Nothing needs repair — every signal is clear.</p>
       </div>`;
  return `
    <section class="ds-section" data-prog-attention>
      <span class="ds-label ds-section__label">Fix first</span>
      ${card}
    </section>`;
}

function _progMasteryHtml() {
  const fullLessons = CURRICULUM.filter(l => l.status === 'full');
  const mastered = fullLessons.filter(l => lessonOverallStatus(l.id) === 'mastered').length;
  const inProgress = fullLessons.filter(l => lessonOverallStatus(l.id) === 'in_progress').length;
  const pct = fullLessons.length ? Math.round(mastered / fullLessons.length * 100) : 0;
  const tracks = [
    { key: 'syntax', label: 'Syntax' },
    { key: 'patterns', label: 'Patterns' },
    { key: 'applied', label: 'Applied' },
  ].map(t => {
    const pool = fullLessons.filter(l => l.track === t.key);
    const done = pool.filter(l => lessonOverallStatus(l.id) === 'mastered').length;
    const p = pool.length ? Math.round(done / pool.length * 100) : 0;
    return { ...t, done, total: pool.length, pct: p };
  });
  const least = tracks.filter(t => t.total > 0).slice().sort((a, b) => a.pct - b.pct)[0];
  const trackRows = tracks.map(t => `
    <div class="prog-meter">
      <span>${t.label}</span>
      <span class="ds-progress"><i style="width:${t.pct}%"></i></span>
      <span>${t.done}/${t.total} · ${t.pct}%</span>
    </div>`).join('');
  const bestTimesEntries = Object.entries(state.bestTimes || {});
  const avgMockMs = bestTimesEntries.length
    ? Math.floor(bestTimesEntries.reduce((s, [, ms]) => s + ms, 0) / bestTimesEntries.length) : 0;
  const chips = [
    inProgress ? `<span class="ds-chip ds-chip--warn">${inProgress} in progress</span>` : '',
    avgMockMs ? `<span class="ds-chip">avg mock ${escapeHtml(formatTime(avgMockMs))}</span>` : '',
    least ? `<span class="ds-chip">least covered: ${least.label}</span>` : '',
  ].join('');
  return `
    <section class="ds-section" data-prog-mastery>
      <span class="ds-label ds-section__label">Mastery</span>
      <div class="ds-card ds-card--flat">
        <div style="display:flex; align-items: baseline; gap: var(--ds-s2);">
          <span class="ds-num" style="font-size: var(--ds-fs-2xl); font-weight: var(--ds-fw-black); color: var(--ds-text-strong); line-height: 1;">${mastered}</span>
          <span class="ds-dim">of ${fullLessons.length} mastered</span>
          <span class="ds-num" style="margin-left: auto; color: var(--ds-accent); font-weight: var(--ds-fw-bold);">${pct}%</span>
        </div>
        <div class="ds-progress ds-progress--good" style="margin: var(--ds-s3) 0 var(--ds-s4);"><i style="width:${pct}%"></i></div>
        ${trackRows}
        ${chips ? `<div style="display:flex; gap: var(--ds-s2); flex-wrap: wrap; margin-top: var(--ds-s3);">${chips}</div>` : ''}
      </div>
    </section>`;
}

function _progInsightsHtml() {
  const blocks = [];

  // Lifetime drill accuracy (only families the user has actually run).
  const drillRows = _PROG_DRILLS
    .map(d => ({ ...d, s: state[d.key] }))
    .filter(d => (d.s?.attempts || 0) > 0)
    .map(d => {
      const pctVal = Math.round(d.s.correct / d.s.attempts * 100);
      return `
      <div class="ds-row">
        <div class="ds-row__main">
          <b>${d.label} <span class="ds-num ds-dim" style="font-weight: var(--ds-fw-reg); font-size: var(--ds-fs-sm);">${d.s.correct}/${d.s.attempts} · ${pctVal}%</span></b>
          <span>${d.sub}</span>
        </div>
        <button type="button" class="ds-btn ds-btn--ghost" data-prog-drill="${d.btn}" style="min-height: 36px; font-size: var(--ds-fs-sm); padding: 0 var(--ds-s3);">Drill</button>
      </div>`;
    }).join('');
  if (drillRows) {
    blocks.push(`<div class="prog-insight"><span class="ds-label">Drill accuracy · lifetime</span>${drillRows}</div>`);
  }

  // Self-rescue rate (zero-hint L3 passes).
  const sr = typeof _selfRescueRateGlobal === 'function' ? _selfRescueRateGlobal() : { total: 0 };
  if (sr.total > 0) {
    blocks.push(`
      <div class="prog-insight">
        <span class="ds-label">Self-rescue rate</span>
        <div class="prog-meter" style="margin-top: var(--ds-s2);">
          <span>Zero-hint</span>
          <span class="ds-progress ds-progress--good"><i style="width:${sr.rate}%"></i></span>
          <span>${sr.zeroHint}/${sr.total} · ${sr.rate}%</span>
        </div>
        <p class="prog-insight-note">L3 passes completed without any hint tier, since hint tracking began.</p>
      </div>`);
  }

  // Top miss patterns (tap → most recent miss of that tag, at L1).
  const tags = typeof _aggregateMissTags === 'function' ? _aggregateMissTags(5) : [];
  if (tags.length) {
    const total = tags.reduce((s, r) => s + r.count, 0);
    const chips = tags.map(row => {
      const route = row.topLessons && row.topLessons[0] ? row.topLessons[0].lessonId : '';
      return `<button type="button" class="ds-chip ds-chip--warn" data-prog-tag-route="${escapeHtml(route)}" style="cursor: ${route ? 'pointer' : 'default'}; min-height: 32px; border: 0;">${escapeHtml(row.label)} <b class="ds-num">×${row.count}</b></button>`;
    }).join('');
    blocks.push(`
      <div class="prog-insight">
        <span class="ds-label">Top miss patterns <span style="text-transform: none; letter-spacing: 0; color: var(--ds-text-mute);">· ${total} tagged · tap to drill</span></span>
        <div style="display:flex; flex-wrap: wrap; gap: var(--ds-s2); margin-top: var(--ds-s2);">${chips}</div>
      </div>`);
  }

  // Mastery half-life buckets + slippery routes.
  const hl = typeof _masteryHalfLife === 'function' ? _masteryHalfLife(5) : { sticky: 0, normal: 0, slippery: 0, slipperyList: [] };
  const hlTotal = hl.sticky + hl.normal + hl.slippery;
  if (hlTotal > 0) {
    const fmtGap = (ms) => {
      const days = ms / HALF_LIFE_DAY_MS;
      if (days < 1) return `${Math.round(days * 24)}h`;
      if (days < 14) return `${days.toFixed(1)}d`;
      return `${Math.round(days)}d`;
    };
    const slipperyRows = hl.slipperyList.map(row => {
      const lesson = findLesson(row.lessonId);
      if (!lesson) return '';
      return `
        <button type="button" class="ds-row prog-rowbtn" data-prog-lesson="${escapeHtml(row.lessonId)}">
          <div class="ds-row__main"><b style="font-weight: var(--ds-fw-med);">${escapeHtml(lesson.title)}</b></div>
          <span class="ds-num ds-dim" style="font-size: var(--ds-fs-sm);">${fmtGap(row.medianGapMs)}</span>
          <span class="ds-row__chev">›</span>
        </button>`;
    }).join('');
    blocks.push(`
      <div class="prog-insight">
        <span class="ds-label">Mastery half-life <span style="text-transform: none; letter-spacing: 0; color: var(--ds-text-mute);">· median gap between L3 passes</span></span>
        <div style="display:flex; gap: var(--ds-s2); flex-wrap: wrap; margin-top: var(--ds-s2);">
          <span class="ds-chip ds-chip--good">${hl.sticky} sticky &gt;${HALF_LIFE_STICKY_DAYS}d</span>
          <span class="ds-chip">${hl.normal} normal</span>
          <span class="ds-chip ds-chip--warn">${hl.slippery} slippery &lt;${HALF_LIFE_NORMAL_DAYS}d</span>
        </div>
        ${slipperyRows ? `<div style="margin-top: var(--ds-s2);">${slipperyRows}</div>` : ''}
      </div>`);
  }

  // Per-section retention sparks (last 14 days, weakest first).
  const retRows = typeof _aggregateSectionRetention === 'function' ? _aggregateSectionRetention(14) : [];
  if (retRows.length) {
    const rowsHtml = retRows.map(r => {
      const bars = r.byDay.map(b => {
        const total = b.passes + b.misses;
        if (total === 0) return `<i></i>`;
        const tone = b.misses === 0 ? 'sp-pass' : b.passes === 0 ? 'sp-miss' : 'sp-mixed';
        const h = Math.max(4, Math.min(18, 4 + total * 3));
        return `<i class="${tone}" style="height:${h}px"></i>`;
      }).join('');
      return `
        <div class="prog-meter prog-meter--wide">
          <span title="${escapeHtml(r.section)}">${escapeHtml(r.section)}</span>
          <span class="prog-spark">${bars}</span>
          <span>${r.totalPass}·${r.totalMiss}M</span>
        </div>`;
    }).join('');
    blocks.push(`
      <div class="prog-insight">
        <span class="ds-label">Section retention <span style="text-transform: none; letter-spacing: 0; color: var(--ds-text-mute);">· 14 days, weakest first</span></span>
        <div style="margin-top: var(--ds-s2);">${rowsHtml}</div>
      </div>`);
  }

  // Time-to-solve calibration (median |actual − estimate| per mechanic).
  const cal = state.timeCalibration;
  if (cal && cal.byMechanic && typeof cal.byMechanic === 'object') {
    const calRows = [];
    for (const [id, data] of Object.entries(cal.byMechanic)) {
      if (!data || !Array.isArray(data.predictions)) continue;
      if (data.predictions.length < CALIBRATION_TILE_MIN_PREDICTIONS) continue;
      const errors = data.predictions.map(p => +p.errorSec || 0).sort((a, b) => a - b);
      const mid = Math.floor(errors.length / 2);
      const median = errors.length % 2 === 0 ? (errors[mid - 1] + errors[mid]) / 2 : errors[mid];
      const m = MECHANICS.find(x => x.id === id);
      calRows.push({ label: (m && m.label) || id, median, count: data.predictions.length });
    }
    if (calRows.length) {
      calRows.sort((a, b) => b.median - a.median);
      const fmtSec = (s) => s >= 60 ? `${Math.round(s / 60)}m` : `${Math.round(s)}s`;
      const rowsHtml = calRows.slice(0, CALIBRATION_TILE_TOP_N).map(r => `
        <div class="prog-meter prog-meter--wide">
          <span title="${escapeHtml(r.label)}">${escapeHtml(r.label)}</span>
          <span></span>
          <span>${fmtSec(r.median)} · ${r.count}×</span>
        </div>`).join('');
      blocks.push(`
        <div class="prog-insight">
          <span class="ds-label">Time calibration <span style="text-transform: none; letter-spacing: 0; color: var(--ds-text-mute);">· most miscalibrated mechanics</span></span>
          <div style="margin-top: var(--ds-s2);">${rowsHtml}</div>
          <p class="prog-insight-note">Median gap between your time estimate and the actual solve, per mechanic.</p>
        </div>`);
    }
  }
  if (state.calibrateOn === false) {
    blocks.push(`<p class="prog-insight prog-insight-note">Time calibration isn't tracking yet — turn on Calibrate in Settings to log time-to-solve per mechanic.</p>`);
  }

  // Time invested per section (inferred from event timestamps).
  if (typeof _progTimeInvestedRows === 'function') {
    const inv = _progTimeInvestedRows();
    if (inv.rows.length) {
      const rowsHtml = inv.rows.map(r => `
        <div class="prog-meter prog-meter--wide">
          <span title="${escapeHtml(r.section)}">${escapeHtml(r.section)}</span>
          <span class="ds-progress"><i style="width:${r.pct}%"></i></span>
          <span>${escapeHtml(r.label)}</span>
        </div>`).join('');
      blocks.push(`
        <div class="prog-insight">
          <span class="ds-label">Time invested <span style="text-transform: none; letter-spacing: 0; color: var(--ds-text-mute);">· ${escapeHtml(inv.totalLabel)} total</span></span>
          <div style="margin-top: var(--ds-s2);">${rowsHtml}</div>
        </div>`);
    }
  }

  // Mock-interview personal bests.
  const bests = Object.entries(state.bestTimes || {}).sort((a, b) => a[1] - b[1]);
  if (bests.length) {
    const rowsHtml = bests.map(([id, ms]) => {
      const l = findLesson(id);
      return `<div><span>${escapeHtml(l?.title || id)}</span><span>${escapeHtml(formatTime(ms))}</span></div>`;
    }).join('');
    blocks.push(`
      <div class="prog-insight">
        <span class="ds-label">Mock personal bests</span>
        <div class="prog-bests" style="margin-top: var(--ds-s2);">${rowsHtml}</div>
      </div>`);
  }

  if (state.streak > 0) {
    blocks.push(`<p class="prog-insight prog-insight-note" style="text-align: center;">Streak this session: ${state.streak}</p>`);
  }

  const body = blocks.length
    ? blocks.join('')
    : `<p class="prog-insight prog-insight-note">Lifetime insights appear here as you drill — accuracy per drill family, miss patterns, retention and more.</p>`;
  return `
    <section class="ds-section">
      <details class="prog-details" data-prog-more>
        <summary>More insights<span class="prog-caret">›</span></summary>
        <div class="prog-details-body">${body}</div>
      </details>
    </section>`;
}

// Time-invested aggregation (ds twin of the legacy ledger tile; same
// inference: consecutive events <5min apart count, capped at 5min per gap).
function _progTimeInvestedRows() {
  const hist = state.history || {};
  const bySection = {};
  for (const lessonId of Object.keys(hist)) {
    const lesson = findLesson(lessonId);
    if (!lesson || !lesson.section) continue;
    const events = hist[lessonId] || [];
    let ms = 0;
    for (let i = 1; i < events.length; i++) {
      const a = events[i - 1]?.at, b = events[i]?.at;
      if (typeof a !== 'number' || typeof b !== 'number') continue;
      const gap = b - a;
      if (gap > 0 && gap < TIME_INVESTED_GAP_MS) ms += Math.min(gap, TIME_INVESTED_INTERVAL_CAP_MS);
    }
    if (ms > 0) bySection[lesson.section] = (bySection[lesson.section] || 0) + ms;
  }
  const all = Object.entries(bySection).map(([section, ms]) => ({ section, ms }))
    .sort((a, b) => b.ms - a.ms);
  const fmt = (ms) => {
    const min = Math.floor(ms / 60000);
    if (min < 1) return '<1m';
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60), rem = min % 60;
    return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
  };
  const top = all.slice(0, TIME_INVESTED_TOP_N);
  const maxMs = top.length ? top[0].ms : 1;
  return {
    rows: top.map(r => ({ section: r.section, pct: Math.round(r.ms / maxMs * 100), label: fmt(r.ms) })),
    totalLabel: fmt(all.reduce((s, r) => s + r.ms, 0)),
  };
}

function _wireProgress(shell, buckets) {
  shell.querySelectorAll('[data-prog-lesson]').forEach(b => b.addEventListener('click', () => {
    selectLesson(b.getAttribute('data-prog-lesson'));
  }));
  shell.querySelectorAll('[data-prog-action]').forEach(b => b.addEventListener('click', () => {
    // Same one-tap direct actions the sidebar pills fire (D05 contract).
    // 'home' is the audit-F15 empty-state fallback: when the corpus can't
    // name a next lesson, hand the user to the front door rather than a
    // dead button.
    const target = { resurrect: 'resurrect-btn', 'reveal-replay': 'reveal-replay-btn', bridge: 'bridge-btn', home: 'home-btn' }[b.getAttribute('data-prog-action')];
    const btn = target && document.getElementById(target);
    if (btn) btn.click();
  }));
  // audit F15: the empty state's single primary action — drop straight into
  // the lesson at the level Home would have opened it at (one tap to a rep,
  // which is the only thing that fills this page).
  shell.querySelectorAll('[data-prog-start]').forEach(b => b.addEventListener('click', () => {
    selectLesson(b.getAttribute('data-prog-start'));
    const lvl = b.getAttribute('data-prog-start-level');
    if (lvl && typeof selectTab === 'function') selectTab(lvl);
  }));
  shell.querySelectorAll('[data-prog-drill]').forEach(b => b.addEventListener('click', () => {
    const btn = document.getElementById(b.getAttribute('data-prog-drill'));
    if (btn) btn.click();
  }));
  shell.querySelectorAll('[data-prog-tag-route]').forEach(b => b.addEventListener('click', () => {
    const id = b.getAttribute('data-prog-tag-route');
    if (!id) return;
    selectLesson(id);
    if (typeof selectTab === 'function') selectTab('L1');
  }));

  // Heatmap: hover = inform, tap = inform + (on miss days) drill routes.
  const detail = shell.querySelector('[data-heat-detail]');
  shell.querySelectorAll('[data-heat-idx]').forEach(cell => {
    const show = (e) => {
      const b = buckets[+cell.dataset.heatIdx];
      if (!detail || !b) return;
      if (b.total === 0) {
        detail.innerHTML = `<span class="ds-mute">${escapeHtml(b.dateLabel)} — no activity</span>`;
        return;
      }
      const head = `<strong style="color: var(--ds-text);">${escapeHtml(b.dateLabel)}</strong> · <span style="color: var(--ds-good);">${b.passes} pass${b.passes === 1 ? '' : 'es'}</span>${b.misses ? ` · <span style="color: var(--ds-bad);">${b.misses} miss${b.misses === 1 ? '' : 'es'}</span>` : ''}`;
      const isTap = e && (e.type === 'click' || e.type === 'keydown');
      const missedIds = Array.isArray(b.missedLessonIds) ? b.missedLessonIds : [...(b.missedLessonIds || [])];
      if (isTap && missedIds.length) {
        const lessons = missedIds.map(id => findLesson(id)).filter(Boolean).slice(0, 4);
        const routes = lessons.map(l => `<button type="button" class="prog-route" data-prog-lesson="${escapeHtml(l.id)}">${escapeHtml(l.title)} ›</button>`).join('');
        detail.innerHTML = `${head}${routes ? `<div>${routes}</div>` : ''}`;
        detail.querySelectorAll('[data-prog-lesson]').forEach(rb => rb.addEventListener('click', () => selectLesson(rb.getAttribute('data-prog-lesson'))));
      } else {
        detail.innerHTML = head;
      }
    };
    cell.addEventListener('mouseenter', show);
    cell.addEventListener('click', show);
    cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(e); } });
  });
}

function openProgress(opts = {}) {
  const shell = document.getElementById('lesson-shell');
  if (!shell) return;
  // audit F10: Progress owns the URL while it is the rendered surface (same
  // replaceState contract as Home / scoped review). The truthful slug is
  // `dashboard`, not `progress`: _dispatchModeRoute resolves `#/m/<slug>` by
  // clicking `#<slug>-btn`, and this page's hidden launcher button is
  // #dashboard-btn (there is no #progress-btn, so `#/m/progress` would be a
  // dead route). The At-Risk entry keeps its own slug so the section-focused
  // variant round-trips to the same view it opened.
  const slug = opts.focus === 'attention' ? 'at-risk' : 'dashboard';
  try { history.replaceState(null, '', '#/m/' + slug); } catch (_) {}
  const buckets = typeof _streakMapBuckets === 'function' ? _streakMapBuckets(60) : [];
  // Read the routing Sets once — the heatmap detail consumer wants arrays.
  for (const b of buckets) {
    if (b.missedLessonIds instanceof Set) b.missedLessonIds = [...b.missedLessonIds];
  }
  const { streak, todayActive } = typeof _todayStreak === 'function'
    ? _todayStreak() : { streak: 0, todayActive: false };
  const flame = dsIcon('flame', 13);
  const streakChip = streak > 0
    ? `<span class="ds-chip ds-chip--accent">${flame}${streak}-day streak${todayActive ? '' : ' · keep it today'}</span>`
    : `<span class="ds-chip">${flame}Start a streak</span>`;

  // `dashboard-page` kept alongside `progress-page`: the nav active-state
  // observer and existing probes key on it (this page IS its successor).
  shell.innerHTML = `
    <div class="ds-root ds-page progress-page dashboard-page">
      <header class="ds-page__head">
        <div class="ds-page__titlerow">
          <h1 class="ds-title">Progress</h1>
          <div class="ds-page__actions">${streakChip}</div>
        </div>
      </header>
      ${_progTodayHtml(buckets)}
      ${_progActivityHtml(buckets)}
      ${_progAttentionHtml()}
      ${_progMasteryHtml()}
      ${_progInsightsHtml()}
    </div>`;
  _wireProgress(shell, buckets);

  const main = document.querySelector('.app-main');
  if (opts.focus === 'attention') {
    const sec = shell.querySelector('[data-prog-attention]');
    if (sec && main) main.scrollTop = Math.max(0, sec.offsetTop - 12);
  } else if (main) {
    main.scrollTop = 0;
  }
}
