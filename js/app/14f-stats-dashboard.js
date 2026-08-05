// ──────────────────────────────────────────────────────────────────────────
//  HEATSTRIP — 30-minute activity timeline + modal + auto-tick
// ──────────────────────────────────────────────────────────────────────────
function initHeatstrip() {
  // iter 107: ⏱ Session Heatstrip — sidebar-top 4px activity timeline.
  // renderHeatstrip rebuilds the 30 minute-cells from state.history and
  // toggles the wrap visibility based on whether any non-idle cell exists.
  // Auto-hide on cold-start / no-recent-activity keeps the strip from
  // appearing as decoration before the user has done anything.
  const heatstripWrap = document.getElementById('heatstrip-wrap');
  const heatstripGrid = document.getElementById('heatstrip');
  const heatstripModal = document.getElementById('heatstrip-modal');
  window.renderHeatstrip = function renderHeatstrip() {
    if (!heatstripWrap || !heatstripGrid) return;
    const cells = _heatstripCells(HEATSTRIP_LOOKBACK_MIN);
    const hasActivity = cells.some(c => c.kind !== 'idle');
    if (!hasActivity) {
      heatstripWrap.hidden = true;
      heatstripGrid.innerHTML = '';
      return;
    }
    heatstripWrap.hidden = false;
    heatstripGrid.innerHTML = cells.map(c => {
      const minLabel = c.minutesAgo === 0 ? 'now' : `${c.minutesAgo}m ago`;
      const evLabel = c.kind === 'idle' ? 'no activity' : c.kind.toUpperCase();
      return `<span class="heatstrip-cell ${c.kind}" aria-hidden="true" title="${minLabel} · ${evLabel}${c.count > 1 ? ` (${c.count} events)` : ''}"></span>`;
    }).join('');
  };
  function openHeatstripModal() {
    const sum = _heatstripSessionSummary();
    const body = document.getElementById('heatstrip-modal-body');
    if (!body) return;
    if (!sum.eventCount) {
      body.innerHTML = `<div style="color:#6b7079;">No session active. Tap any lesson to start.</div>`;
    } else {
      const minLabel = sum.minActive === 1 ? '1 minute' : `${sum.minActive} minutes`;
      const lessLabel = sum.lessonsTouched === 1 ? '1 lesson' : `${sum.lessonsTouched} lessons`;
      const passLabel = sum.passes === 1 ? '1 pass' : `${sum.passes} passes`;
      const missLine = sum.missCount > 0
        ? `<div><span style="color:#9aa0aa;">L1 misses recorded:</span> <span style="color:#c4c9cf;">${sum.missCount}</span></div>`
        : '';
      body.innerHTML = `
        <div><span style="color:#9aa0aa;">Active for:</span> <span style="color:#c4c9cf;">${minLabel}</span></div>
        <div><span style="color:#9aa0aa;">Lessons touched:</span> <span style="color:#c4c9cf;">${lessLabel}</span></div>
        <div><span style="color:#9aa0aa;">Passes (L1+L2+L3):</span> <span style="color:#c4c9cf;">${passLabel}</span></div>
        ${missLine}
      `;
    }
    heatstripModal.style.display = 'block';
  }
  if (heatstripWrap) {
    heatstripWrap.addEventListener('click', openHeatstripModal);
    heatstripWrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openHeatstripModal(); }
    });
  }
  document.getElementById('heatstrip-close')?.addEventListener('click', () => heatstripModal.style.display = 'none');
  heatstripModal?.addEventListener('click', (e) => {
    if (e.target === heatstripModal) heatstripModal.style.display = 'none';
  });
  // Initial render on boot (show recent activity from a prior session in the
  // last 30 min) + a slow tick so the strip ages out without requiring a new
  // event. 60-sec interval matches the cell-grain — never refreshes mid-cell.
  renderHeatstrip();
  setInterval(renderHeatstrip, HEATSTRIP_MINUTE_MS);
}

// ──────────────────────────────────────────────────────────────────────────
//  STATS MODAL — track balance, drill lifetime tiles, retention, mock PBs
// ──────────────────────────────────────────────────────────────────────────
// Renders the full Progress/Stats body into `statsBodyEl` and wires its
// tap-to-drill tiles (Recognize / Crux / Claim / Predict / Bug-Hunt lifetimes,
// slippery half-life rows, miss-pattern chips). `_close` closes whatever modal
// hosts it. Extracted from the old standalone Stats modal, now retired into the
// unified Dashboard (openDashboard).
function renderStatsInto(statsBodyEl, _close) {
  if (typeof _close !== 'function') _close = () => {};
  {
    const fullLessons = CURRICULUM.filter(l => l.status === 'full');
    const mastered = fullLessons.filter(l => lessonOverallStatus(l.id) === 'mastered').length;
    const inProgress = fullLessons.filter(l => lessonOverallStatus(l.id) === 'in_progress').length;
    const notStarted = fullLessons.length - mastered - inProgress;
    const due = dueReviewIds().length;
    const weakCount = Object.keys(state.weakness).length;
    const bestTimesEntries = Object.entries(state.bestTimes);
    const totalMockMs = bestTimesEntries.reduce((s, [,ms]) => s + ms, 0);
    const avgMockMs = bestTimesEntries.length ? Math.floor(totalMockMs / bestTimesEntries.length) : 0;
    const tally = (track) => ({
      mastered: CURRICULUM.filter(l => l.track === track && lessonOverallStatus(l.id) === 'mastered').length,
      total:    CURRICULUM.filter(l => l.track === track).length,
    });
    const syntaxStats   = tally('syntax');
    const patternsStats = tally('patterns');
    const appliedStats  = tally('applied');

    // iter 66: Track Balance Compass — 3-bar widget showing % mastered per
    // track + a one-line nudge naming the least-covered. Closes iter-64
    // roadmap #3 (constraint-aware B#5 — allocation balance across track
    // axis). Pure tally over progress × manifest.track; zero new state.
    const compassRows = [
      { id: 'syntax',   label: 'Syntax',   color: '#ffce5a', ...syntaxStats },
      { id: 'patterns', label: 'Pattern',  color: '#ffce5a', ...patternsStats },
      { id: 'applied',  label: 'Applied',  color: '#ffedc2', ...appliedStats }
    ].map(r => ({ ...r, pct: r.total > 0 ? Math.round((r.mastered / r.total) * 100) : 0 }));
    const leastCovered = compassRows.filter(r => r.total > 0).sort((a, b) => a.pct - b.pct)[0];
    const compassNudge = leastCovered
      ? `<div style="font-size:11px; color:#9aa0aa; margin-top:6px;">Least covered: <strong style="color:${leastCovered.color};">${escapeHtml(leastCovered.label)}</strong> · ${leastCovered.mastered}/${leastCovered.total} (${leastCovered.pct}%)</div>`
      : '';
    const compassHtml = `
      <div style="margin-bottom: 14px; padding: 12px 14px; background: #17181c; border: 1px solid #262930; border-radius: 8px;">
        <div style="font-size:10px; color:#6b7079; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">🧭 Track Balance</div>
        ${compassRows.map(r => `
          <div style="display:grid; grid-template-columns: 70px 1fr 70px; gap:8px; align-items:center; padding:3px 0;">
            <span style="font-size:12px; color:${r.color}; font-weight:600;">${escapeHtml(r.label)}</span>
            <div style="height:8px; background:#262930; border-radius:4px; overflow:hidden;">
              <div style="width:${r.pct}%; height:100%; background:${r.color};"></div>
            </div>
            <span style="font-size:11px; color:#9aa0aa; font-variant-numeric:tabular-nums; text-align:right;">${r.mastered}/${r.total} · ${r.pct}%</span>
          </div>
        `).join('')}
        ${compassNudge}
      </div>
    `;

    statsBodyEl.innerHTML = `${compassHtml}
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="background: #262930; padding: 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #6b7079; text-transform: uppercase; letter-spacing: 0.05em;">Mastered</div>
          <div style="font-size: 28px; color: #10b981; font-weight: 700;">${mastered} / ${fullLessons.length}<span style="font-size: 14px; color: #6ee7b7; font-weight: 500; margin-left: 6px;">· ${fullLessons.length ? Math.round(mastered / fullLessons.length * 100) : 0}%</span></div>
        </div>
        <div style="background: #262930; padding: 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #6b7079; text-transform: uppercase; letter-spacing: 0.05em;">In Progress</div>
          <div style="font-size: 28px; color: #f59e0b; font-weight: 700;">${inProgress}</div>
        </div>
      </div>
      <div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
        <div data-track-stat="syntax" style="background: #262930; padding: 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #6b7079; text-transform: uppercase; letter-spacing: 0.05em;">Syntax</div>
          <div style="font-size: 22px; color: #ffce5a; font-weight: 700;">${syntaxStats.mastered} / ${syntaxStats.total}</div>
        </div>
        <div data-track-stat="patterns" style="background: #262930; padding: 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #6b7079; text-transform: uppercase; letter-spacing: 0.05em;">Patterns</div>
          <div style="font-size: 22px; color: #ffdd8a; font-weight: 700;">${patternsStats.mastered} / ${patternsStats.total}</div>
        </div>
        <div data-track-stat="applied" style="background: #262930; padding: 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #6b7079; text-transform: uppercase; letter-spacing: 0.05em;">Applied</div>
          <div style="font-size: 22px; color: #ffce5a; font-weight: 700;">${appliedStats.mastered} / ${appliedStats.total}</div>
        </div>
      </div>
      <div style="margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 12px;">
        <div style="background: rgba(245,182,43,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(245,182,43,0.2);">
          <div style="color: #9aa0aa;">Due for review</div>
          <div style="color: #ffce5a; font-size: 18px; font-weight: 600;">${due}</div>
        </div>
        <div style="background: rgba(251,146,60,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(251,146,60,0.2);">
          <div style="color: #9aa0aa;">Weak spots</div>
          <div style="color: #fdba74; font-size: 18px; font-weight: 600;">${weakCount}</div>
        </div>
        <div style="background: rgba(255,206,90,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,206,90,0.2);">
          <div style="color: #9aa0aa;">Avg mock time</div>
          <div style="color: #ffedc2; font-size: 18px; font-weight: 600;">${avgMockMs ? formatTime(avgMockMs) : '—'}</div>
        </div>
      </div>
      ${(state.recognize?.attempts || 0) > 0 ? `
        <div style="margin-top: 8px;">
          <div style="background: rgba(245,182,43,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(245,182,43,0.2); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="color: #9aa0aa; font-size: 12px;">🔎 Recognize lifetime <span style="color: #6b7079; font-weight: 400;">(incl. 🎯 Reverse)</span></div>
              <div style="color: #ffce5a; font-size: 16px; font-weight: 600; margin-top: 2px;">${state.recognize.correct} / ${state.recognize.attempts} <span style="color: #9aa0aa; font-size: 12px; font-weight: 400;">(${Math.round(state.recognize.correct / state.recognize.attempts * 100)}%)</span></div>
            </div>
            <button data-action="open-recognize-from-stats" style="background: rgba(245,182,43,0.16); color: #ffce5a; border: 1px solid rgba(245,182,43,0.4); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer;">Drill →</button>
          </div>
        </div>
      ` : ''}
      ${(state.gotcha?.attempts || 0) > 0 ? `
        <div style="margin-top: 8px;">
          <div style="background: rgba(255,206,90,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,206,90,0.25); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="color: #9aa0aa; font-size: 12px;">🎯 Crux lifetime <span style="color: #6b7079; font-weight: 400;">(key-trick recall)</span></div>
              <div style="color: #ffedc2; font-size: 16px; font-weight: 600; margin-top: 2px;">${state.gotcha.correct} / ${state.gotcha.attempts} <span style="color: #9aa0aa; font-size: 12px; font-weight: 400;">(${Math.round(state.gotcha.correct / state.gotcha.attempts * 100)}%)</span></div>
            </div>
            <button data-action="open-gotcha-from-stats" style="background: rgba(255,206,90,0.16); color: #ffedc2; border: 1px solid rgba(255,206,90,0.4); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer;">Recall →</button>
          </div>
        </div>
      ` : ''}
      ${(state.claim?.attempts || 0) > 0 ? `
        <div style="margin-top: 8px;">
          <div style="background: rgba(245,182,43,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(245,182,43,0.25); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="color: #9aa0aa; font-size: 12px;">📐 Claim lifetime <span style="color: #6b7079; font-weight: 400;">(smell-test complexity)</span></div>
              <div style="color: #ffce5a; font-size: 16px; font-weight: 600; margin-top: 2px;">${state.claim.correct} / ${state.claim.attempts} <span style="color: #9aa0aa; font-size: 12px; font-weight: 400;">(${Math.round(state.claim.correct / state.claim.attempts * 100)}%)</span></div>
            </div>
            <button data-action="open-claim-from-stats" style="background: rgba(245,182,43,0.16); color: #ffce5a; border: 1px solid rgba(245,182,43,0.4); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer;">Spin →</button>
          </div>
        </div>
      ` : ''}
      ${(state.crystal?.attempts || 0) > 0 ? `
        <div style="margin-top: 8px;">
          <div style="background: rgba(245,182,43,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(245,182,43,0.25); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="color: #9aa0aa; font-size: 12px;">🔮 Predict lifetime <span style="color: #6b7079; font-weight: 400;">(mental-execution)</span></div>
              <div style="color: #ffdd8a; font-size: 16px; font-weight: 600; margin-top: 2px;">${state.crystal.correct} / ${state.crystal.attempts} <span style="color: #9aa0aa; font-size: 12px; font-weight: 400;">(${Math.round(state.crystal.correct / state.crystal.attempts * 100)}%)</span></div>
            </div>
            <button data-action="open-crystal-from-stats" style="background: rgba(245,182,43,0.16); color: #ffdd8a; border: 1px solid rgba(245,182,43,0.4); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer;">Predict →</button>
          </div>
        </div>
      ` : ''}
      ${(state.bugHunt?.attempts || 0) > 0 ? `
        <div style="margin-top: 8px;">
          <div style="background: rgba(255,206,90,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,206,90,0.25); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="color: #9aa0aa; font-size: 12px;">🪲 Bug-Hunt lifetime <span style="color: #6b7079; font-weight: 400;">(spot the operator flip)</span></div>
              <div style="color: #ffce5a; font-size: 16px; font-weight: 600; margin-top: 2px;">${state.bugHunt.correct} / ${state.bugHunt.attempts} <span style="color: #9aa0aa; font-size: 12px; font-weight: 400;">(${Math.round(state.bugHunt.correct / state.bugHunt.attempts * 100)}%)</span></div>
            </div>
            <button data-action="open-bughunt-from-stats" style="background: rgba(255,206,90,0.16); color: #ffce5a; border: 1px solid rgba(255,206,90,0.4); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer;">Hunt →</button>
          </div>
        </div>
      ` : ''}
      ${(() => {
        // iter 101: 🎯 Self-rescue rate tile. Aggregates L3-pass events across
        // all lessons, counts ones that completed with zero hints used. First
        // surface that measures QUALITY-OF-PASS (not pass/fail). Closes the
        // iter-37 deferred metric. Hidden when no L3-pass history yet so the
        // tile stays quiet for users new to L3.
        const sr = _selfRescueRateGlobal();
        if (sr.total === 0) return '';
        const tone = sr.rate >= 70 ? '#86efac' : sr.rate >= 40 ? '#ffce5a' : '#fdba74';
        const borderTone = sr.rate >= 70 ? 'rgba(134,239,172,0.3)' : sr.rate >= 40 ? 'rgba(252,211,77,0.3)' : 'rgba(253,186,116,0.3)';
        const bgTone = sr.rate >= 70 ? 'rgba(134,239,172,0.08)' : sr.rate >= 40 ? 'rgba(252,211,77,0.08)' : 'rgba(253,186,116,0.08)';
        return `
        <div style="margin-top: 8px;">
          <div style="background: ${bgTone}; padding: 10px; border-radius: 6px; border: 1px solid ${borderTone};">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="color: #9aa0aa; font-size: 12px;">🎯 Self-rescue rate <span style="color: #6b7079; font-weight: 400;">(zero-hint L3 passes)</span></div>
                <div style="color: ${tone}; font-size: 16px; font-weight: 600; margin-top: 2px;">${sr.zeroHint} / ${sr.total} <span style="color: #9aa0aa; font-size: 12px; font-weight: 400;">(${sr.rate}%)</span></div>
              </div>
            </div>
            <div style="color: #6b7079; font-size: 10px; margin-top: 4px;">since you started L3 drilling — hint events captured per attempt</div>
          </div>
        </div>
        `;
      })()}
      ${(() => {
        // iter 58: Mistake Tagging top-5 tile. Only renders when the user
        // has tagged ≥1 miss — keeps Stats quiet for users who never opt in.
        // iter eval-2026-05-30 (Phase 4-B): chips are now tap-route buttons.
        // Tap a tag → jump to the lesson with the most recent miss of that
        // tag (via _aggregateMissTags's new topLessons reverse index) and
        // open L1. Per audits/mistake-tagging.md edits 1+2.
        const top = _aggregateMissTags(5);
        if (!top.length) return '';
        const total = top.reduce((s, r) => s + r.count, 0);
        return `
        <div style="margin-top: 8px;">
          <div style="background: rgba(255,206,90,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,206,90,0.2);">
            <div style="color: #9aa0aa; font-size: 12px; margin-bottom: 6px;">🏷 Top miss patterns <span style="color: #6b7079; font-weight: 400;">(${total} tagged · tap to drill)</span></div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;" data-mistake-tag-tiles>
              ${top.map(row => {
                const route = row.topLessons && row.topLessons[0] ? row.topLessons[0].lessonId : '';
                const interactive = route ? 'cursor: pointer;' : 'cursor: default; opacity: 0.7;';
                const title = route ? `Drill most-recent ${escapeHtml(row.label)} miss` : `No routable lesson for ${escapeHtml(row.label)}`;
                return `<button type="button" data-mistake-route="${escapeHtml(route)}" title="${title}" style="background: rgba(255,206,90,0.15); color: #e9d5ff; border: 1px solid rgba(255,206,90,0.3); border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 500; ${interactive}">${escapeHtml(row.label)} <span style="color: #ffce5a; margin-left: 2px;">×${row.count}</span></button>`;
              }).join('')}
            </div>
          </div>
        </div>
        `;
      })()}
      ${(() => {
        // iter 106: 📈 Mastery Half-Life tile. Per-lesson longitudinal SR
        // signal — buckets each lesson's median L3-pass gap into Sticky /
        // Normal / Slippery. Tap-routed top-5 slippery lessons list lets
        // the user jump straight to "what's slipping." Hidden when no
        // lesson has ≥2 L3-passes yet (graceful empty state).
        const hl = _masteryHalfLife(5);
        const total = hl.sticky + hl.normal + hl.slippery;
        if (total === 0) return '';
        const fmtGap = (ms) => {
          const days = ms / HALF_LIFE_DAY_MS;
          if (days < 1) return `${Math.round(days * 24)}h`;
          if (days < 14) return `${days.toFixed(1)}d`;
          return `${Math.round(days)}d`;
        };
        return `
        <div style="margin-top: 8px;">
          <div style="background: rgba(255,206,90,0.08); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,206,90,0.2);">
            <div style="color: #9aa0aa; font-size: 12px; margin-bottom: 6px;">📈 Mastery Half-Life <span style="color: #6b7079; font-weight: 400;">(${total} lesson${total === 1 ? '' : 's'} with ≥2 L3 passes)</span></div>
            <div class="half-life-buckets">
              <div class="half-life-bucket"><span class="half-life-dot sticky"></span><span class="half-life-label">Sticky</span><span class="half-life-count">${hl.sticky}</span><span class="half-life-range">&gt;${HALF_LIFE_STICKY_DAYS}d</span></div>
              <div class="half-life-bucket"><span class="half-life-dot normal"></span><span class="half-life-label">Normal</span><span class="half-life-count">${hl.normal}</span><span class="half-life-range">${HALF_LIFE_NORMAL_DAYS}-${HALF_LIFE_STICKY_DAYS}d</span></div>
              <div class="half-life-bucket"><span class="half-life-dot slippery"></span><span class="half-life-label">Slippery</span><span class="half-life-count">${hl.slippery}</span><span class="half-life-range">&lt;${HALF_LIFE_NORMAL_DAYS}d</span></div>
            </div>
            ${hl.slipperyList.length ? `
              <div class="half-life-list">
                <div class="half-life-list-header">Top slippery — tap to drill</div>
                ${hl.slipperyList.map(row => {
                  const lesson = findLesson(row.lessonId);
                  if (!lesson) return '';
                  return `<div class="half-life-row" data-action="open-slippery" data-lesson-id="${escapeHtml(row.lessonId)}"><span class="half-life-row-title">${escapeHtml(lesson.title)}</span><span class="half-life-row-gap">${fmtGap(row.medianGapMs)}</span></div>`;
                }).join('')}
              </div>
            ` : ''}
            <div style="color: #6b7079; font-size: 10px; margin-top: 6px;">since you started L3 drilling — median gap between consecutive passes</div>
          </div>
        </div>
        `;
      })()}
      ${_renderSectionRetentionBlock(14)}
      ${state.calibrateOn === false ? `
        <div data-calibration-hint style="margin-top: 18px; padding: 10px 12px; background: rgba(245,182,43,0.08); border: 1px solid rgba(245,182,43,0.3); border-radius: 8px; font-size: 12px; color: #fde68a; line-height: 1.5;">
          💡 <strong>⏱ Calibration</strong> not tracking yet — turn on from <strong>⚙️ Settings → ⏱ Calibrate</strong> to log your time-to-solve per mechanic and see your top miscalibrated patterns here.
        </div>
      ` : ''}
      ${_renderCalibrationTile()}
      ${_renderTimeInvestedTile()}
      ${bestTimesEntries.length ? `
        <div style="margin-top: 18px;">
          <div style="font-size: 11px; color: #6b7079; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Mock interview personal bests</div>
          <div style="max-height: 200px; overflow-y: auto; font-family: 'SF Mono', monospace; font-size: 12px;">
            ${bestTimesEntries
              .sort((a, b) => a[1] - b[1])
              .map(([id, ms]) => {
                const l = findLesson(id);
                return `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #262930;"><span style="color: #c4c9cf;">${escapeHtml(l?.title || id)}</span><span style="color: #ffedc2;">${formatTime(ms)}</span></div>`;
              }).join('')}
          </div>
        </div>
      ` : ''}
      <div style="margin-top: 16px; text-align: center; color: #6b7079; font-size: 11px;">Streak this session: ${state.streak}</div>
    `;
    // iter 51: wire the Recognize Drill-from-Stats button (only present when lifetime attempts > 0).
    statsBodyEl.querySelector('[data-action="open-recognize-from-stats"]')?.addEventListener('click', () => {
      _close();
      startRecognizeSession();
    });
    // iter 84: wire the Gotcha + Claim Drill-from-Stats buttons (only present when lifetime > 0).
    statsBodyEl.querySelector('[data-action="open-gotcha-from-stats"]')?.addEventListener('click', () => {
      _close();
      startGotchaSession();
    });
    statsBodyEl.querySelector('[data-action="open-claim-from-stats"]')?.addEventListener('click', () => {
      _close();
      startClaimSession();
    });
    // iter 85: Crystal + Bug-Hunt Drill-from-Stats buttons. Same pattern.
    statsBodyEl.querySelector('[data-action="open-crystal-from-stats"]')?.addEventListener('click', () => {
      _close();
      startCrystalSession();
    });
    statsBodyEl.querySelector('[data-action="open-bughunt-from-stats"]')?.addEventListener('click', () => {
      _close();
      startBugHuntSession();
    });
    // iter 106: 📈 Mastery Half-Life — wire each slippery-list row to deep-link
    // to its lesson. Each row carries data-lesson-id; selectLesson handles the
    // rest (default tab = Reference, so the user lands on the canonical they
    // need to re-encode before re-attempting L3).
    statsBodyEl.querySelectorAll('[data-action="open-slippery"]').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-lesson-id');
        if (!id) return;
        _close();
        selectLesson(id);
      });
    });
    // iter eval-2026-05-30 (Phase 4-B): 🏷 Mistake Tagging tile chips
    // now tap-route to the most-recent miss of that tag. Per
    // audits/mistake-tagging.md edits 1+2.
    statsBodyEl.querySelectorAll('[data-mistake-route]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-mistake-route');
        if (!id) return;
        _close();
        selectLesson(id);
        // Default tab on selectLesson is Reference; bump to L1 so the
        // user lands on the concept-grain surface where they tagged
        // the miss to begin with.
        if (typeof selectTab === 'function') selectTab('L1');
      });
    });
  }
}

function initStatsModal() {
  // Stats is retired into the unified Dashboard. The hidden #stats-btn now
  // routes there so the Review→Stats path and #/m/stats deep-link resolve.
  const btn = document.getElementById('stats-btn');
  if (btn) btn.addEventListener('click', () => openDashboard());
}

// ──────────────────────────────────────────────────────────────────────────
//  DASHBOARD — unified surface merging daily progress + 60-day activity
//  heatmap + mastery/stats into one scrollable view. Replaces the standalone
//  Stats and Streak Map modals (their buttons route here). Opened from the
//  top-nav Dashboard link and the hidden #dashboard-btn (so #/m/dashboard
//  deep-links + cmd+click-new-tab resolve).
// ──────────────────────────────────────────────────────────────────────────
function renderDailyInto(rootEl) {
  const b = (typeof _streakMapBuckets === 'function') ? _streakMapBuckets(2) : [];
  const today = b[1] || { passes: 0, misses: 0 };
  const yest = b[0] || { passes: 0, misses: 0 };
  const due = (typeof dueReviewIds === 'function') ? dueReviewIds().length : 0;
  const weak = Object.keys(state.weakness || {}).length;
  // Today-vs-yesterday delta — explicitly endorsed by PROFILE.md (L72) as
  // "progress at a glance". Encouraging when ahead, neutral-honest otherwise.
  const delta = (today.passes || 0) - (yest.passes || 0);
  let deltaLine;
  if (!today.passes && !today.misses) deltaLine = `<span style="color:#6b7079;">No reps logged yet today — one drill counts.</span>`;
  else if (delta > 0) deltaLine = `<span style="color:#34d399;">▲ ${delta} more solved than yesterday — keep going.</span>`;
  else if (delta < 0) deltaLine = `<span style="color:#9aa0aa;">▼ ${-delta} fewer than yesterday so far.</span>`;
  else deltaLine = `<span style="color:#9aa0aa;">On pace with yesterday.</span>`;
  const tile = (label, value, color, bg, border) =>
    `<div style="background:${bg}; padding:10px 12px; border-radius:8px; border:1px solid ${border};">
       <div style="font-size:11px; color:#9aa0aa;">${label}</div>
       <div style="font-size:20px; font-weight:700; color:${color};">${value}</div>
     </div>`;
  rootEl.innerHTML = `
    <div style="font-size:10px; color:#6b7079; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">📆 Today</div>
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
      ${tile('Solved today', today.passes || 0, '#34d399', 'rgba(52,211,153,0.08)', 'rgba(52,211,153,0.25)')}
      ${tile('Missed today', today.misses || 0, '#f87171', 'rgba(248,113,113,0.08)', 'rgba(248,113,113,0.25)')}
      ${tile('Due now', due, '#ffce5a', 'rgba(245,182,43,0.08)', 'rgba(245,182,43,0.25)')}
      ${tile('Weak spots', weak, '#fdba74', 'rgba(251,146,60,0.08)', 'rgba(251,146,60,0.25)')}
    </div>
    <div style="margin-top:8px; font-size:12px;">${deltaLine}</div>`;
}

// Full-page surface (NOT a modal) — takes over #lesson-shell the same way the
// drill surfaces (Recognize, Constellation, …) do, with an Exit that routes
// back to the lesson view via renderLesson(). Navigation buttons inside the
// stats/activity bodies re-render #lesson-shell themselves (selectLesson /
// startXSession), so their close-callback is a no-op here.
function openDashboard() {
  // Design-loop P5: the unified Progress surface (js/app/20-progress.js)
  // replaced the legacy dashboard body. Delegate so every existing route
  // (#/m/dashboard, stats-btn, streak-map-btn, rail Progress) lands there.
  // The legacy renderers below stay as the reference implementation until
  // their remaining callers/probes retire (see design-loop STATE.md).
  if (typeof openProgress === 'function') return openProgress();
  const shell = document.getElementById('lesson-shell');
  if (!shell) return;
  shell.innerHTML = `
    <div class="dashboard-page">
      <div class="dashboard-page-header">
        <h1 class="dashboard-page-title">📊 Dashboard</h1>
        <button class="dashboard-exit" data-action="exit-dashboard" aria-label="Exit dashboard">✕ Exit</button>
      </div>
      <section class="dash-section" data-dash-daily></section>
      <section class="dash-section"><div class="dash-h">📅 Activity · 60 days</div><div data-dash-activity></div></section>
      <section class="dash-section"><div class="dash-h">📊 Mastery &amp; progress</div><div data-dash-stats></div></section>
    </div>`;
  renderDailyInto(shell.querySelector('[data-dash-daily]'));
  renderActivityInto(shell.querySelector('[data-dash-activity]'), () => {});
  renderStatsInto(shell.querySelector('[data-dash-stats]'), () => {});
  shell.querySelector('[data-action="exit-dashboard"]').addEventListener('click', () => {
    if (typeof renderLesson === 'function') renderLesson();
  });
  // Start at the top of the daily summary, not wherever the prior view scrolled.
  const main = document.querySelector('.app-main');
  if (main) main.scrollTop = 0;
}

function initDashboardModal() {
  // Hidden #dashboard-btn — the uniform target the #/m/dashboard route and the
  // retired stats/streak buttons all resolve to. The topbar link and its
  // mobile-only twin that used to be wired here went with the rest of the old
  // navigation (D15 phase 2); Progress is the header's scope meter now.
  const btn = document.getElementById('dashboard-btn');
  if (btn) btn.addEventListener('click', openDashboard);
}

