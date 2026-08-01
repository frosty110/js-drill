function _aggregateSectionRetention(lookbackDays = 14) {
  const now = Date.now();
  const dayMs = 86400000;
  const cutoff = now - lookbackDays * dayMs;
  // Group lessons by section.
  const bySection = new Map();
  for (const l of CURRICULUM) {
    if (l.status !== 'full') continue;
    if (!bySection.has(l.section)) bySection.set(l.section, []);
    bySection.get(l.section).push(l);
  }
  const rows = [];
  for (const [sectionName, lessons] of bySection) {
    const byDay = Array.from({ length: lookbackDays }, () => ({ passes: 0, misses: 0 }));
    let totalPass = 0, totalMiss = 0;
    for (const lesson of lessons) {
      const events = state.history?.[lesson.id] || [];
      for (const e of events) {
        if (e.at < cutoff) continue;
        const daysAgo = Math.floor((now - e.at) / dayMs);
        if (daysAgo >= lookbackDays || daysAgo < 0) continue;
        const idx = lookbackDays - 1 - daysAgo;
        if (e.event === 'L1-miss') { byDay[idx].misses++; totalMiss++; }
        else if (e.event === 'L1-pass' || e.event === 'L2-pass' || e.event === 'L3-pass') {
          byDay[idx].passes++; totalPass++;
        }
      }
    }
    if (totalPass === 0 && totalMiss === 0) continue;
    rows.push({ section: sectionName, lessons, byDay, totalPass, totalMiss });
  }
  // Sort: worst retention (highest miss-ratio) first; tiebreak by most recent activity.
  rows.sort((a, b) => {
    const ra = a.totalMiss / Math.max(1, a.totalPass + a.totalMiss);
    const rb = b.totalMiss / Math.max(1, b.totalPass + b.totalMiss);
    if (ra !== rb) return rb - ra;
    return (b.totalPass + b.totalMiss) - (a.totalPass + a.totalMiss);
  });
  return rows;
}

// Renders the section-retention block for the Stats modal. Returns HTML string
// or '' when no qualifying sections (avoid empty-section noise in Stats).
// iter 131 — Calibrate v2 Stats tile. iter-119 v1 captured calibration
// data per mechanic into state.timeCalibration.byMechanic[id].predictions[];
// v2 is the visualization surface that was DEFERRED at v1 ship pending
// soak data. Renders the top-5 most-miscalibrated mechanics by median
// errorSec (|actual_sec − bucket_midpoint_sec|). Auto-hides when no
// mechanic has ≥5 predictions yet — clean-progress users see nothing
// (graceful empty state, not a confusing "0 / 0" tile). PROFILE L65-69
// success-criterion surface: self-knowledge of pattern-time accuracy.
const CALIBRATION_TILE_MIN_PREDICTIONS = 5;
const CALIBRATION_TILE_TOP_N = 5;
function _renderCalibrationTile() {
  const cal = state.timeCalibration;
  if (!cal || !cal.byMechanic || typeof cal.byMechanic !== 'object') return '';
  const rows = [];
  for (const [id, data] of Object.entries(cal.byMechanic)) {
    if (!data || !Array.isArray(data.predictions)) continue;
    if (data.predictions.length < CALIBRATION_TILE_MIN_PREDICTIONS) continue;
    const errors = data.predictions.map(p => +p.errorSec || 0).sort((a, b) => a - b);
    const mid = Math.floor(errors.length / 2);
    const median = errors.length % 2 === 0
      ? (errors[mid - 1] + errors[mid]) / 2
      : errors[mid];
    const m = MECHANICS.find(x => x.id === id);
    rows.push({
      id,
      label: (m && m.label) ? m.label : id,
      median,
      count: data.predictions.length
    });
  }
  if (rows.length === 0) return ''; // auto-hide when no soak data
  rows.sort((a, b) => b.median - a.median);
  const top = rows.slice(0, CALIBRATION_TILE_TOP_N);
  const formatSec = (s) => s >= 60 ? `${Math.round(s/60)}m` : `${Math.round(s)}s`;
  return `
    <div data-calibration-tile style="margin-top: 18px;">
      <div style="font-size: 11px; color: #6b7079; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">⏱ Calibration · top ${top.length} miscalibrated mechanic${top.length === 1 ? '' : 's'}</div>
      <div style="font-size: 11px; color: #9aa0aa; margin-bottom: 8px;">Median |actual − estimate| per mechanic from your L3-pass history. Higher = bigger gap between your time bucket and actual seconds.</div>
      ${top.map(r => `
        <div data-cal-row data-mech-id="${escapeHtml(r.id)}" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #262930; border-radius: 6px; margin-bottom: 4px;">
          <span style="color: #c4c9cf; font-size: 13px;">${escapeHtml(r.label)}</span>
          <span style="color: #f5b62b; font-size: 13px; font-variant-numeric: tabular-nums;">${formatSec(r.median)} <span style="color: #6b7079; font-size: 11px;">· ${r.count}×</span></span>
        </div>
      `).join('')}
    </div>
  `;
}

// iter 155: ⏳ Time-Invested Section Ledger. Walks state.history per lesson;
// each consecutive event pair within TIME_INVESTED_GAP_MS counts as session
// time (capped at TIME_INVESTED_INTERVAL_CAP_MS per pair so an "I left the
// tab open overnight" doesn't poison the sum). Groups ms-spent by
// lesson.section; renders top-N as horizontal bars sorted desc.
// Complements iter-66 Track Balance Compass on the orthogonal axis: Compass
// shows % mastered per TRACK; Ledger shows minutes-spent per SECTION.
// PROFILE L46-48 (effort allocation visibility) + L75 (own-data only — no
// global benchmark or peer comparison). Schema-additive zero — reads existing
// state.history.
const TIME_INVESTED_GAP_MS = 5 * 60 * 1000;
const TIME_INVESTED_INTERVAL_CAP_MS = 5 * 60 * 1000;
const TIME_INVESTED_TOP_N = 8;
function _renderTimeInvestedTile() {
  const hist = state.history || {};
  const bySection = {};
  for (const lessonId of Object.keys(hist)) {
    const lesson = findLesson(lessonId);
    if (!lesson || !lesson.section) continue;
    const events = hist[lessonId] || [];
    if (events.length < 2) continue;
    let sectionMs = 0;
    for (let i = 1; i < events.length; i++) {
      const a = events[i - 1]?.at;
      const b = events[i]?.at;
      if (typeof a !== 'number' || typeof b !== 'number') continue;
      const gap = b - a;
      if (gap > 0 && gap < TIME_INVESTED_GAP_MS) {
        sectionMs += Math.min(gap, TIME_INVESTED_INTERVAL_CAP_MS);
      }
    }
    if (sectionMs > 0) {
      bySection[lesson.section] = (bySection[lesson.section] || 0) + sectionMs;
    }
  }
  const rows = Object.entries(bySection)
    .map(([section, ms]) => ({ section, ms }))
    .sort((a, b) => b.ms - a.ms);
  if (rows.length === 0) return ''; // auto-hide when no inferable session data
  const topN = rows.slice(0, TIME_INVESTED_TOP_N);
  const maxMs = topN[0].ms;
  const totalMs = rows.reduce((s, r) => s + r.ms, 0);
  const formatMs = (ms) => {
    const min = Math.floor(ms / 60000);
    if (min < 1) return '<1m';
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const rem = min % 60;
    return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
  };
  return `
    <div data-time-invested-tile style="margin-top: 18px;">
      <div style="font-size: 11px; color: #6b7079; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">⏳ Time invested · top ${topN.length} section${topN.length === 1 ? '' : 's'} <span style="color:#4a4f58;">· ${formatMs(totalMs)} total</span></div>
      <div style="font-size: 11px; color: #9aa0aa; margin-bottom: 8px;">Inferred from event timestamps — consecutive events within 5min count as session time (capped at 5min per gap). Effort-allocation complement to 🧭 Track Balance above.</div>
      ${topN.map(r => {
        const pct = Math.round((r.ms / maxMs) * 100);
        return `
          <div style="display: grid; grid-template-columns: 130px 1fr 60px; gap: 8px; align-items: center; padding: 4px 0;">
            <span style="color: #c4c9cf; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(r.section)}">${escapeHtml(r.section)}</span>
            <div style="height: 8px; background: #262930; border-radius: 4px; overflow: hidden;">
              <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #ffce5a, #ffce5a);"></div>
            </div>
            <span style="color: #9aa0aa; font-size: 11px; font-variant-numeric: tabular-nums; text-align: right;">${formatMs(r.ms)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function _renderSectionRetentionBlock(lookbackDays = 14) {
  const rows = _aggregateSectionRetention(lookbackDays);
  if (rows.length === 0) return '';
  const maxBin = Math.max(1, ...rows.flatMap(r => r.byDay.map(b => b.passes + b.misses)));
  const rowHtml = rows.map(r => {
    const bars = r.byDay.map((b, i) => {
      const total = b.passes + b.misses;
      const daysAgo = lookbackDays - 1 - i;
      if (total === 0) {
        return `<div class="sec-ret-bar sec-ret-bar-empty" title="${daysAgo}d ago: no activity"></div>`;
      }
      const pct = Math.max(15, Math.round((total / maxBin) * 100));
      const tone = b.misses === 0 ? 'pass' : b.passes === 0 ? 'miss' : 'mixed';
      return `<div class="sec-ret-bar sec-ret-bar-${tone}" style="height:${pct}%;" title="${daysAgo}d ago: ${b.passes} passes, ${b.misses} misses"></div>`;
    }).join('');
    const missRatio = r.totalMiss / Math.max(1, r.totalPass + r.totalMiss);
    const ratioTone = missRatio === 0 ? 'good' : missRatio >= 0.3 ? 'warn' : 'mid';
    return `
      <div class="sec-ret-row">
        <div class="sec-ret-name" title="${r.lessons.length} lessons in this section">${escapeHtml(r.section)}</div>
        <div class="sec-ret-spark" title="Last ${lookbackDays} days — newest right">${bars}</div>
        <div class="sec-ret-count sec-ret-count-${ratioTone}">${r.totalPass}<span class="sec-ret-sep">·</span>${r.totalMiss > 0 ? r.totalMiss + 'M' : '0M'}</div>
      </div>
    `;
  }).join('');
  return `
    <div class="sec-ret-block">
      <div class="sec-ret-title">Section retention <span class="sec-ret-sub">last ${lookbackDays} days — weakest first</span></div>
      ${rowHtml}
      <div class="sec-ret-legend">
        <span class="sec-ret-legend-item"><span class="sec-ret-swatch sec-ret-bar-pass"></span>all pass</span>
        <span class="sec-ret-legend-item"><span class="sec-ret-swatch sec-ret-bar-mixed"></span>mixed</span>
        <span class="sec-ret-legend-item"><span class="sec-ret-swatch sec-ret-bar-miss"></span>only miss</span>
        <span class="sec-ret-legend-item"><span class="sec-ret-swatch sec-ret-bar-empty"></span>no activity</span>
      </div>
    </div>
  `;
}
// ---------- Cheatsheet modal (in-app quick reference) ----------
// Mirrors the Mechanics modal pattern: a scrollable overlay you open over
// whatever lesson you're on, browse the canonical code for any lesson, then
// either jump to it (closes the modal + selectLesson) or close and resume.
let _cheatsheetTrack = null;      // 'syntax' | 'patterns' | 'applied'
let _cheatsheetSearch = '';

async function openCheatsheetModal() {
  const modal = document.getElementById('cheatsheet-modal');
  if (!modal) return;
  // Default the track tab to the current lesson's track (if any).
  if (!_cheatsheetTrack) {
    const cur = findLesson(state.currentLessonId);
    _cheatsheetTrack = (cur && cur.track) || 'patterns';
  }
  const body = document.getElementById('cheatsheet-body');
  if (body) body.innerHTML = `<div style="color:#9aa0aa;text-align:center;padding:24px 0;">Loading cheatsheet…</div>`;
  const searchInput = document.getElementById('cheatsheet-search');
  if (searchInput) searchInput.value = _cheatsheetSearch;
  modal.style.display = 'block';
  await ensureAllContentLoaded();
  renderCheatsheetTabs();
  renderCheatsheetBody();
}

function closeCheatsheetModal() {
  const modal = document.getElementById('cheatsheet-modal');
  if (modal) modal.style.display = 'none';
}

function renderCheatsheetTabs() {
  const tabs = document.getElementById('cheatsheet-tabs');
  if (!tabs) return;
  const trackDefs = [
    { id: 'syntax',   label: 'Syntax' },
    { id: 'patterns', label: 'Patterns' },
    { id: 'applied',  label: 'Applied' },
  ];
  tabs.innerHTML = trackDefs.map(t => {
    const active = t.id === _cheatsheetTrack;
    const bg = active ? '#262930' : 'transparent';
    const color = active ? '#ffffff' : '#9aa0aa';
    const border = active ? '#363a43' : '#262930';
    return `<button data-cs-track="${t.id}" style="background:${bg};color:${color};border:1px solid ${border};border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;">${t.label}</button>`;
  }).join('');
  tabs.querySelectorAll('[data-cs-track]').forEach(btn => {
    btn.addEventListener('click', () => {
      _cheatsheetTrack = btn.getAttribute('data-cs-track');
      renderCheatsheetTabs();
      renderCheatsheetBody();
    });
  });
}

function renderCheatsheetBody() {
  const body = document.getElementById('cheatsheet-body');
  if (!body) return;
  const fullLessons = CURRICULUM.filter(l => l.status === 'full' && l.track === _cheatsheetTrack);
  const q = _cheatsheetSearch;
  const filtered = q
    ? fullLessons.filter(l => {
        if (l.title.toLowerCase().includes(q)) return true;
        if ((l.section || '').toLowerCase().includes(q)) return true;
        const c = CONTENT[l.id];
        if (c && c.description && c.description.toLowerCase().includes(q)) return true;
        return false;
      })
    : fullLessons;

  if (!filtered.length) {
    body.innerHTML = `<div style="color:#9aa0aa;text-align:center;padding:24px 0;">No lessons match.</div>`;
    return;
  }

  const sections = [...new Set(filtered.map(l => l.section))];
  const curLesson = findLesson(state.currentLessonId);
  const curSection = curLesson && curLesson.track === _cheatsheetTrack ? curLesson.section : null;
  const curLessonId = curLesson && curLesson.track === _cheatsheetTrack ? curLesson.id : null;

  let html = '';
  for (const section of sections) {
    const lessons = filtered.filter(l => l.section === section);
    // Default-open the current lesson's section, OR all sections when the
    // user is actively filtering (search-results expectation is "show me").
    const sectionOpen = q || section === curSection || _cheatsheetExpandAll;
    html += `<details data-cs-section="${escapeHtml(section)}"${sectionOpen ? ' open' : ''} style="margin-bottom:8px;border:1px solid #262930;border-radius:8px;background:#0e0f12;">
      <summary style="padding:8px 12px;cursor:pointer;color:#c4c9cf;font-weight:600;font-size:13px;">
        ${escapeHtml(section)} <span style="color:#6b7079;font-weight:400;font-size:11px;">· ${lessons.length}</span>
      </summary>
      <div style="padding:4px 8px 10px 8px;display:flex;flex-direction:column;gap:4px;">`;
    for (const lesson of lessons) {
      const c = CONTENT[lesson.id];
      if (!c) continue;
      // Each lesson gets its own collapsible card. Default-collapsed unless
      // it's the lesson the user is currently on, OR they're searching, OR
      // they've hit "Expand all" — matches the "browse titles, drill in on demand" flow.
      const lessonOpen = q || lesson.id === curLessonId || _cheatsheetExpandAll;
      const desc = c.description ? `<div style="color:#9aa0aa;font-size:12px;margin:2px 0 6px 0;">${escapeHtml(c.description)}</div>` : '';
      // Primary approach + complexity header — mirrors the alternate chip
      // pattern so the cheatsheet's "two solutions visible side-by-side" view
      // surfaces complexity for BOTH the canonical and its alternates.
      const approachHtml = (c.reference && (c.reference.approach || c.reference.complexity))
        ? `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:4px 0 4px 0;flex-wrap:wrap;">
            ${c.reference.approach ? `<strong style="color:#eef0f2;font-size:12.5px;">${escapeHtml(c.reference.approach)}</strong>` : '<span></span>'}
            ${c.reference.complexity ? `<span style="color:#f5b62b;font-size:10.5px;font-family:ui-monospace,monospace;background:rgba(245,182,43,0.08);border:1px solid rgba(245,182,43,0.25);padding:1px 6px;border-radius:999px;white-space:nowrap;" title="time / space">${escapeHtml(c.reference.complexity)}</span>` : ''}
          </div>`
        : '';
      const notesHtml = (c.reference && c.reference.notes && c.reference.notes.length)
        ? `<ul style="margin:6px 0 0 0;padding-left:18px;color:#c4c9cf;font-size:12px;">${c.reference.notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`
        : '';
      // Alternates surface — collapsed by default so the primary canonical
      // stays the readable thing; users opt in to compare approaches.
      const altHtml = (c.reference && Array.isArray(c.reference.alternates) && c.reference.alternates.length)
        ? `<details style="margin-top:8px;border-left:2px solid rgba(245,182,43,0.35);padding-left:8px;">
            <summary style="cursor:pointer;color:#f5b62b;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;padding:2px 0;">Alternates · ${c.reference.alternates.length}</summary>
            <div style="margin-top:6px;display:flex;flex-direction:column;gap:8px;">
              ${c.reference.alternates.map(alt => `
                <div style="border:1px solid #262930;border-radius:6px;padding:8px 10px;background:#0a0b0d;">
                  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                    <strong style="color:#eef0f2;font-size:12.5px;">${escapeHtml(alt.label || '')}</strong>
                    ${alt.complexity ? `<span style="color:#f5b62b;font-size:10.5px;font-family:ui-monospace,monospace;background:rgba(245,182,43,0.08);border:1px solid rgba(245,182,43,0.25);padding:1px 6px;border-radius:999px;white-space:nowrap;">${escapeHtml(alt.complexity)}</span>` : ''}
                  </div>
                  ${alt.when ? `<div style="color:#9aa0aa;font-size:11.5px;font-style:italic;margin:4px 0 6px 0;">${escapeHtml(alt.when)}</div>` : ''}
                  <pre style="margin:0;padding:6px 8px;background:#0a0b0d;border:1px solid #262930;border-radius:4px;overflow-x:auto;font-size:11px;line-height:1.4;white-space:pre;color:#c4c9cf;">${escapeHtml(alt.code || '')}</pre>
                  ${Array.isArray(alt.notes) && alt.notes.length ? `<ul style="margin:6px 0 0 0;padding-left:16px;color:#c4c9cf;font-size:11.5px;">${alt.notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>` : ''}
                </div>
              `).join('')}
            </div>
          </details>`
        : '';
      html += `<details data-cs-lesson="${escapeHtml(lesson.id)}"${lessonOpen ? ' open' : ''} class="cs-lesson" style="border-left:2px solid #262930;padding:2px 0 2px 8px;">
        <summary style="cursor:pointer;color:#eef0f2;font-weight:600;font-size:13px;padding:4px 0;">
          ${escapeHtml(lesson.title)}
        </summary>
        <div style="padding:4px 0 6px 0;">
          ${desc}
          ${approachHtml}
          <pre class="cm-s-dracula" data-cs-code="${escapeHtml(lesson.id)}" style="margin:0;padding:8px 10px;background:#0a0b0d;border:1px solid #262930;border-radius:6px;overflow-x:auto;font-size:12px;line-height:1.45;white-space:pre;"></pre>
          ${notesHtml}
          ${altHtml}
          <button data-cs-goto="${escapeHtml(lesson.id)}" style="background:none;border:1px solid #262930;color:#ffce5a;font-size:11px;cursor:pointer;padding:4px 8px;border-radius:4px;margin-top:8px;">Open lesson →</button>
        </div>
      </details>`;
    }
    html += `</div></details>`;
  }
  body.innerHTML = html;
  body.scrollTop = 0;

  // Wire jump-to-lesson buttons.
  body.querySelectorAll('[data-cs-goto]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Stop propagation so the click doesn't also toggle the parent <details>.
      e.stopPropagation();
      const id = btn.getAttribute('data-cs-goto');
      closeCheatsheetModal();
      selectLesson(id);
    });
  });

  // Colorize code in lessons that are open right now, AND lazily colorize on
  // first expand for the rest. Avoids running runMode 80× upfront on mobile.
  body.querySelectorAll('details[data-cs-lesson]').forEach(det => {
    const pre = det.querySelector('[data-cs-code]');
    if (!pre) return;
    const id = pre.getAttribute('data-cs-code');
    const c = CONTENT[id];
    if (!c || !c.reference || !c.reference.code) return;
    const colorize = () => {
      if (pre.dataset.colorized === '1') return;
      colorizeInto(pre, c.reference.code);
      pre.dataset.colorized = '1';
    };
    if (det.open) colorize();
    else det.addEventListener('toggle', () => { if (det.open) colorize(); }, { once: true });
  });

  // Sync the Expand-all button label to the new tree.
  updateCheatsheetExpandAllLabel();
}

let _cheatsheetExpandAll = false;

function updateCheatsheetExpandAllLabel() {
  const btn = document.getElementById('cheatsheet-expand-all');
  if (!btn) return;
  btn.textContent = _cheatsheetExpandAll ? 'Collapse all' : 'Expand all';
}

function toggleCheatsheetExpandAll() {
  _cheatsheetExpandAll = !_cheatsheetExpandAll;
  // Toggle every <details> inside the body — both section-level and lesson-level.
  const body = document.getElementById('cheatsheet-body');
  if (!body) return;
  body.querySelectorAll('details').forEach(d => { d.open = _cheatsheetExpandAll; });
  // Newly-opened lesson <details> need their code colorized on demand.
  if (_cheatsheetExpandAll) {
    body.querySelectorAll('details[data-cs-lesson][open] [data-cs-code]').forEach(pre => {
      if (pre.dataset.colorized === '1') return;
      const id = pre.getAttribute('data-cs-code');
      const c = CONTENT[id];
      if (c && c.reference && c.reference.code) {
        colorizeInto(pre, c.reference.code);
        pre.dataset.colorized = '1';
      }
    });
  }
  updateCheatsheetExpandAllLabel();
}

async function generateCheatsheet() {
  await ensureAllContentLoaded();
  const fullLessons = CURRICULUM.filter(l => l.status === 'full');
  const date = new Date().toISOString().slice(0, 10);
  const total = fullLessons.length;
  let md = `# JavaScript Interview Cheatsheet\n\n`;
  md += `> ${total} lessons across syntax fundamentals, canonical interview patterns, and applied problems.\n`;
  md += `> Generated ${date} from the JS Drill app.\n\n`;
  md += `---\n\n## Table of Contents\n\n`;

  const tracks = [
    { id: 'syntax',   label: 'Track A — Syntax Fundamentals' },
    { id: 'patterns', label: 'Track B — Canonical Patterns' },
    { id: 'applied',  label: 'Track C — Applied Problems' }
  ];

  // ToC
  for (const track of tracks) {
    const trackLessons = fullLessons.filter(l => l.track === track.id);
    const sections = [...new Set(trackLessons.map(l => l.section))];
    md += `### ${track.label}\n\n`;
    for (const section of sections) {
      md += `- **${section}**: ${trackLessons.filter(l => l.section === section).map(l => l.title).join(' · ')}\n`;
    }
    md += `\n`;
  }
  md += `---\n\n`;

  // Body
  for (const track of tracks) {
    md += `# ${track.label}\n\n`;
    const trackLessons = fullLessons.filter(l => l.track === track.id);
    const sections = [...new Set(trackLessons.map(l => l.section))];
    for (const section of sections) {
      md += `## ${section}\n\n`;
      const sectionLessons = trackLessons.filter(l => l.section === section);
      for (const lesson of sectionLessons) {
        const c = CONTENT[lesson.id];
        if (!c) continue;
        md += `### ${lesson.title}\n\n`;
        md += `${c.description}\n\n`;
        md += '```js\n' + c.reference.code + '\n```\n\n';
        if (c.reference.notes && c.reference.notes.length) {
          md += `**Notes:**\n\n`;
          for (const note of c.reference.notes) md += `- ${note}\n`;
          md += `\n`;
        }
        if (Array.isArray(c.reference.alternates) && c.reference.alternates.length) {
          md += `**Alternates:**\n\n`;
          for (const alt of c.reference.alternates) {
            md += `#### ${alt.label}${alt.complexity ? ` — \`${alt.complexity}\`` : ''}\n\n`;
            if (alt.when) md += `*${alt.when}*\n\n`;
            md += '```js\n' + alt.code + '\n```\n\n';
            if (Array.isArray(alt.notes) && alt.notes.length) {
              for (const n of alt.notes) md += `- ${n}\n`;
              md += `\n`;
            }
          }
        }
        md += `---\n\n`;
      }
    }
  }
  return md;
}

// iter 126: 📦 Cheatsheet → Printable PDF / Native-Phone Save (iter-124
// roadmap #2 SHIPPED). Differentiator vs iter-113 Offline Drill Pack: Pack
// keeps the corpus drillable INSIDE the app offline; this surface gets the
// corpus OUT of the app entirely into a user-owned native-OS PDF — readable
// in Apple Books / Files / Android Downloads on a plane with the app closed.
// PROFILE 80%-phone amplifies the leverage (subway / plane / kitchen counter).
// No state changes. Returns a complete <html>…</html> string with embedded
// print stylesheet. Code blocks are plain monospace (no syntax highlighting)
// — the goal is offline READING, not interactive drilling, and plain text
// PDFs are smaller + render identically across Apple Books / Adobe / etc.
function _buildPrintableCheatsheetHtml() {
  const fullLessons = CURRICULUM.filter(l => l.status === 'full');
  const date = new Date().toISOString().slice(0, 10);
  const total = fullLessons.length;
  const tracks = [
    { id: 'syntax',   label: 'Track A — Syntax Fundamentals' },
    { id: 'patterns', label: 'Track B — Canonical Patterns' },
    { id: 'applied',  label: 'Track C — Applied Problems' }
  ];

  const css = `
    @page { margin: 18mm 14mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Georgia, "Times New Roman", serif;
      font-size: 11pt; line-height: 1.45; color: #111; background: #fff;
      padding: 24px;
    }
    h1.cover { font-size: 28pt; margin: 0 0 4px 0; }
    .cover-sub { color: #555; font-size: 11pt; margin-bottom: 12px; }
    .toc { font-size: 10pt; color: #333; }
    .toc h2 { font-size: 14pt; margin: 18px 0 6px 0; }
    .toc ul { margin: 4px 0 0 0; padding-left: 18px; }
    .toc li { margin: 1px 0; }
    h1.track { font-size: 22pt; margin: 0 0 6px 0; padding-bottom: 4px; border-bottom: 2px solid #333; }
    h2.section { font-size: 15pt; margin: 18px 0 6px 0; color: #222; }
    h3.lesson { font-size: 12pt; margin: 12px 0 2px 0; color: #111; }
    .desc { font-size: 10pt; color: #444; margin: 2px 0 4px 0; font-style: italic; }
    pre.code {
      font-family: "SF Mono", "Menlo", "Consolas", monospace;
      font-size: 8.5pt; line-height: 1.35;
      background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px;
      padding: 8px 10px; margin: 4px 0 6px 0; overflow: hidden;
      white-space: pre-wrap; word-break: break-word;
      page-break-inside: avoid;
    }
    ul.notes { margin: 4px 0 8px 0; padding-left: 18px; font-size: 10pt; }
    ul.notes li { margin: 1px 0; color: #333; }
    /* Alternate solutions: subordinate to primary canonical; amber accent
       mirrors the in-app reference-tab treatment. */
    .alt { margin: 8px 0 8px 0; padding: 6px 0 4px 10px; border-left: 2px solid #e8a800; page-break-inside: avoid; }
    h4.alt-label { font-size: 11pt; margin: 0 0 4px 0; color: #3a3000; font-weight: 600; }
    .alt-comp { font-size: 8.5pt; font-family: "SF Mono", "Menlo", "Consolas", monospace; color: #5a4a00; background: #fffae6; padding: 1px 6px; border-radius: 999px; border: 1px solid #e6c200; white-space: nowrap; }
    .alt-when { font-size: 9.5pt; color: #555; font-style: italic; margin: 0 0 4px 0; }
    hr.div { border: 0; border-top: 1px dashed #ccc; margin: 12px 0; }
    /* Page breaks: each Track starts a new page; section never split from its
       first lesson; long code blocks stay together when feasible. */
    .track-wrap { page-break-before: always; }
    .track-wrap.first { page-break-before: avoid; }
    h2.section { page-break-after: avoid; }
    h3.lesson { page-break-after: avoid; }
    .toolbar {
      position: sticky; top: 0; background: #fffae6; border: 1px solid #e6c200;
      padding: 8px 12px; margin: -24px -24px 16px -24px; font-size: 10pt;
      color: #5a4a00;
    }
    .toolbar b { color: #2a2200; }
    @media print { .toolbar { display: none; } }
  `;

  const escape = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let toc = `<div class="toc"><h2>Contents</h2>`;
  for (const track of tracks) {
    const tl = fullLessons.filter(l => l.track === track.id);
    toc += `<h2>${escape(track.label)} <span style="color:#888;font-weight:400;font-size:10pt;">· ${tl.length} lessons</span></h2><ul>`;
    const sections = [...new Set(tl.map(l => l.section))];
    for (const sec of sections) {
      const lessons = tl.filter(l => l.section === sec);
      toc += `<li><b>${escape(sec)}</b> — ${lessons.map(l => escape(l.title)).join(' · ')}</li>`;
    }
    toc += `</ul>`;
  }
  toc += `</div>`;

  let body = '';
  let isFirst = true;
  for (const track of tracks) {
    const tl = fullLessons.filter(l => l.track === track.id);
    body += `<div class="track-wrap${isFirst ? ' first' : ''}"><h1 class="track">${escape(track.label)}</h1>`;
    isFirst = false;
    const sections = [...new Set(tl.map(l => l.section))];
    for (const sec of sections) {
      body += `<h2 class="section">${escape(sec)}</h2>`;
      const lessons = tl.filter(l => l.section === sec);
      for (const lesson of lessons) {
        const c = CONTENT[lesson.id];
        if (!c) continue;
        body += `<h3 class="lesson">${escape(lesson.title)}</h3>`;
        if (c.description) body += `<div class="desc">${escape(c.description)}</div>`;
        const code = (c.reference && c.reference.code) || '';
        body += `<pre class="code">${escape(code)}</pre>`;
        if (c.reference && c.reference.notes && c.reference.notes.length) {
          body += `<ul class="notes">`;
          for (const n of c.reference.notes) body += `<li>${escape(n)}</li>`;
          body += `</ul>`;
        }
      }
    }
    body += `</div>`;
  }

  // Toolbar (visible on screen, hidden on print) tells the user what to do next.
  // The print dialog is auto-triggered by the opener; the toolbar is a fallback
  // for users who dismiss the dialog and want to re-trigger it.
  const toolbar = `<div class="toolbar">
    <b>To save to your phone:</b> use your browser's Share / Print menu, then
    pick <b>Save to Files</b>, <b>Save as PDF</b>, or <b>Books</b>.
    Or press <b>⌘P / Ctrl-P</b>. (This bar is hidden in the saved PDF.)
  </div>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>JS Drill Cheatsheet — ${total} lessons · ${date}</title>
<style>${css}</style>
</head><body>
${toolbar}
<h1 class="cover">JS Interview Cheatsheet</h1>
<div class="cover-sub">${total} lessons across syntax fundamentals, canonical interview patterns, and applied problems. Generated ${date} from the JS Drill app.</div>
${toc}
${body}
</body></html>`;
}

// Opens a new window with the printable cheatsheet HTML and auto-triggers the
// native print dialog. CRITICAL: window.open MUST be called synchronously in
// the click handler before any await — iOS Safari (and most popup blockers)
// require a direct user-gesture-origin for window.open. `_buildPrintable...`
// reads from already-loaded CURRICULUM + CONTENT so it's synchronous even
// though the cheatsheet modal preloads via `ensureAllContentLoaded()`.
function exportCheatsheetToPdf() {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Allow popups to save the cheatsheet as a PDF.\n\nOr: copy the cheatsheet markdown via Cheatsheet → … (manual workaround).');
    return;
  }
  // Quick placeholder so iOS doesn't show a blank tab during HTML build.
  try {
    win.document.write('<!doctype html><meta charset="utf-8"><title>JS Drill Cheatsheet</title><body style="font-family:sans-serif;padding:24px;color:#333"><p>Generating cheatsheet PDF… <small>(takes a second)</small></p></body>');
  } catch (_) { /* ignore — some browsers buffer this */ }

  // Build the real HTML. CURRICULUM/CONTENT are already loaded because the
  // cheatsheet modal preloaded them; if not, lessons without content simply
  // skip in the iterator (graceful degradation).
  const html = _buildPrintableCheatsheetHtml();

  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch (e) {
    console.error('Cheatsheet PDF write failed:', e);
    return;
  }

  // Give the new window a beat to lay out, then fire print().
  // 600ms is conservative — content is ~150 lessons, mostly text + small <pre>.
  // Wrapped in try/catch because some browsers throw if the window is closed
  // before print fires.
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch (_) { /* user closed the tab or popup blocked print */ }
  }, 600);
}

function dailyPlan() {
  // Returns an ordered, deduped list of lesson IDs to tackle next:
  //   1. Up to 3 due-for-review (retention beats new content)
  //   2. Up to 1 top weak-spot (an active misconception is more actionable
  //      than the next-in-path; surface BEFORE path so dedup promotes the
  //      "weak spot" label when a lesson is in both buckets)
  //   3. Up to 1 recent concept-grain miss (Mistake Tagging tag), so a
  //      freshly self-flagged misconception surfaces next-up without
  //      waiting for the lesson-grain weakness counter to hit threshold.
  //      Per audits/mistake-tagging.md edit 3 (Phase 4-B). Label embeds
  //      the tag name ("recent off-by-one miss") so the why-color in the
  //      sidebar/warmup carries the concept-grain signal.
  //   4. Up to 2 next-in-starter-path that are not mastered
  const seen = new Set();
  const plan = [];
  const add = (id, why) => {
    // Guard every branch (not just path) against ids whose lesson no longer
    // exists or is a stub — a stale review/weakness id would otherwise become
    // a dead CTA (raw-id title, Start selects nothing) on the Today home hero.
    if (id && !seen.has(id) && findLesson(id)?.status === 'full') {
      seen.add(id); plan.push({ id, why });
    }
  };
  for (const id of dueReviewIds().slice(0, 3)) add(id, 'review due');
  add(topWeakLessonId(), 'weak spot');
  const recentTagged = typeof mostRecentTaggedMissLesson === 'function' ? mostRecentTaggedMissLesson() : null;
  if (recentTagged) add(recentTagged.lessonId, `recent ${recentTagged.tagLabel} miss`);
  let added = 0;
  for (const id of getActiveStarterPath()) {
    if (added >= 2) break;
    const l = findLesson(id);
    if (!l || l.status !== 'full') continue;
    if (lessonOverallStatus(id) !== 'mastered' && !seen.has(id)) {
      add(id, 'next on plan');
      added++;
    }
  }
  return plan;
}
function startMockInterview(lessonId) {
  if (state.mock.tickHandle) { clearInterval(state.mock.tickHandle); state.mock.tickHandle = null; }
  state.mock.active = true;
  state.mock.startTime = Date.now();
  state.mock.lessonId = lessonId;
  state.currentLessonId = lessonId;
  state.currentTab = 'L3';
  syncBinderToLesson(lessonId);
  renderSidebar();
  renderLesson();
  state.mock.tickHandle = setInterval(() => {
    const el = document.getElementById('mock-timer');
    if (el) el.textContent = formatTime(Date.now() - state.mock.startTime);
  }, 250);
}
function endMockInterview(passed) {
  if (!state.mock.active) return;
  const elapsed = Date.now() - state.mock.startTime;
  const lessonId = state.mock.lessonId;
  if (state.mock.tickHandle) { clearInterval(state.mock.tickHandle); state.mock.tickHandle = null; }
  state.mock.active = false;
  if (passed && lessonId) {
    // Append to the rolling history — sequence reveals trend (improving /
    // plateaued / regressing), not just the single PB.
    state.mockHistory[lessonId] = state.mockHistory[lessonId] || [];
    state.mockHistory[lessonId].push(elapsed);
    if (state.mockHistory[lessonId].length > MOCK_HISTORY_MAX) {
      state.mockHistory[lessonId] = state.mockHistory[lessonId].slice(-MOCK_HISTORY_MAX);
    }
    const prevBest = state.bestTimes[lessonId];
    if (!prevBest || elapsed < prevBest) {
      state.bestTimes[lessonId] = elapsed;
    }
    saveProgress();
  }
  renderLesson();
  return elapsed;
}
// Iter 11: smart selection. Replaces uniform-random over 79 patterns with
// a weighted pool that biases toward the user's active gaps — lessons in
// state.weakness (recent L1 misses) and lessons whose SR review is due.
// PROFILE.md line 66-69 mandates this ("Use recent diagnostic signal to
// bias the pick"). Variety preserved — baseline patterns still in pool.
// Returns the lesson ID; exposed as a separate helper so probes can call
// it 100s of times to verify the weighting distribution without paying
// the cost of starting an actual mock each time.
function _pickMockLessonId() {
  const patternLessons = CURRICULUM.filter(l => l.status === 'full' && l.track === 'patterns');
  if (!patternLessons.length) return null;
  // Restrict diagnostic signals to the Patterns track so the picker doesn't
  // try to pick a Syntax lesson for a mock (mock is Patterns-only).
  const dueSet = new Set(
    dueReviewIds().filter(id => {
      const l = findLesson(id);
      return l && l.track === 'patterns';
    })
  );
  const weakSet = new Set(
    Object.keys(state.weakness || {}).filter(id => {
      const l = findLesson(id);
      return l && l.track === 'patterns';
    })
  );
  // Weighted pool: BOTH weak AND due = 5×, either alone = 3×, neither = 1×.
  // For a user with one active gap, the gap lesson appears 3× and the other
  // 78 patterns appear 1× each — ~3.6% pick rate vs ~1.2% baseline. Heavy
  // enough to bias toward gaps; light enough that interleaving still works.
  const pool = [];
  for (const lesson of patternLessons) {
    const weak = weakSet.has(lesson.id);
    const due = dueSet.has(lesson.id);
    const weight = (weak && due) ? 5 : (weak || due) ? 3 : 1;
    for (let i = 0; i < weight; i++) pool.push(lesson.id);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
function startRandomMockInterview() {
  const id = _pickMockLessonId();
  if (!id) {
    alert('Author some pattern lessons first.');
    return;
  }
  startMockInterview(id);
}
function starterPathNextId() {
  // First lesson in the active (track-scoped) starter path that is full
  // but not yet mastered.
  for (const id of getActiveStarterPath()) {
    const lesson = findLesson(id);
    if (!lesson || lesson.status !== 'full') continue;
    if (lessonOverallStatus(id) !== 'mastered') return id;
  }
  return null;
}
function markPassed(lessonId, level) {
  state.progress[lessonId] = state.progress[lessonId] || {};
  const wasMastered = lessonOverallStatus(lessonId) === 'mastered';
  // iter 56: Reveal Replay clean-pass invariant. If the user is passing a
  // level they had previously revealed AND they didn't click reveal during
  // THIS attempt, treat it as a "drilled it clean" — clear the revealed
  // flag so the ringed-green dot demotes to plain green. The dot variant
  // earned its ring because the user faked it; passing without faking it
  // again is the verb that revokes the scarlet letter.
  let clearedRevealFlag = false;
  if (
    (level === 'L2' || level === 'L3') &&
    wasRevealed(lessonId, level) &&
    !(_revealedInCurrentAttempt[lessonId] && _revealedInCurrentAttempt[lessonId][level])
  ) {
    delete state.revealed[lessonId][level];
    if (state.revealed[lessonId] && Object.keys(state.revealed[lessonId]).length === 0) {
      delete state.revealed[lessonId];
    }
    // Timestamp the CLEAR so sync doesn't OR-resurrect the ring from another
    // device's stale flag — the newest set/clear event wins in the merge.
    state.revealedClearedAt = state.revealedClearedAt || {};
    state.revealedClearedAt[lessonId] = state.revealedClearedAt[lessonId] || {};
    state.revealedClearedAt[lessonId][level] = Date.now();
    clearedRevealFlag = true;
  }
  state.progress[lessonId][level] = 'passed';
  // L3 advances the SR bucket. L2 on a due lesson holds the bucket but
  // resets dueAt — gives mobile users a way to keep the due list moving
  // without overstating their free-recall confidence.
  if (level === 'L3') {
    scheduleReview(lessonId);
  } else if (level === 'L2' && state.reviews[lessonId] && isDueForReview(lessonId)) {
    scheduleReview(lessonId, { advance: false });
  }
  appendHistory(lessonId, `${level}-pass`);
  saveProgress();
  if (!wasMastered && lessonOverallStatus(lessonId) === 'mastered') {
    state.streak += 1;
    updateStreakUI();
  }
  // Update in-place only — DO NOT re-render the lesson body.
  renderSidebar();
  if (lessonId === state.currentLessonId) updateLessonHeaderInPlace();
  updateReviewBadge();
  // iter 56: surface a transient toast when the reveal flag was cleared on
  // this clean pass, so the user understands the dot just demoted from
  // ringed-green to plain green.
  if (clearedRevealFlag) _showRevealClearedToast(lessonId, level);
  // iter 114: ☁️ Sync Onboarding — first L3 pass on a desktop user-agent
  // surfaces the one-time hint banner promoting the existing top-right
  // Sync chip. _maybeShowSyncHint() guards all conditions internally so
  // calling unconditionally on every L3 pass is safe.
  if (level === 'L3' && typeof _maybeShowSyncHint === 'function') _maybeShowSyncHint();
  // iter 118: 🔥 Hot-Seat Follow-Up — opt-in post-L3-pass modal with an
  // interviewer follow-up. _maybeShowHotseat() guards all conditions
  // (toggle on, Patterns/Applied track, content loaded, mock bypass).
  if (level === 'L3' && typeof _maybeShowHotseat === 'function') _maybeShowHotseat(lessonId);
  // iter 119: ⏱ Time-to-Solve Calibration — if an estimate was made for
  // this lesson this session, record the delta against the bucket midpoint
  // per `lesson.mechanics[]` tag. _calibrationRecordPass() handles guards.
  if (level === 'L3' && typeof _calibrationRecordPass === 'function') _calibrationRecordPass(lessonId);
  // Scoped review session (js/app/23-review.js): a pass on the queue's
  // current lesson, at or above the level the session asked for, advances to
  // the next rep. No-op when no session is running.
  if (typeof _reviewOnLevelPass === 'function') _reviewOnLevelPass(lessonId, level);
}
function updateReviewBadge() {
  const btn = document.getElementById('review-btn');
  const cnt = document.getElementById('review-count');
  if (btn && cnt) {
    const due = dueReviewIds().length;
    // iter 45: when path-scoped, surface BOTH the in-scope count and the total
    // so the user sees that off-scope lessons aren't disappeared — just hidden
    // from the current scope.
    const scoped = state.starterPath && state.starterPathTrack && state.starterPathTrack !== 'all';
    const totalDue = scoped ? allDueReviewIds().length : due;
    const hiddenByScope = totalDue - due;
    if (due > 0) {
      btn.classList.remove('hidden');
      cnt.textContent = due;
      btn.title = scoped && hiddenByScope > 0
        ? `Drill the lessons whose review interval is up — ${due} in ${state.starterPathTrack} path, ${hiddenByScope} more in other tracks (switch path scope to see)`
        : 'Drill the lessons whose review interval is up';
    } else if (scoped && totalDue > 0) {
      // Zero in-scope but there ARE due lessons elsewhere — keep the button visible
      // with a 0/N badge so the user knows the path scope is hiding work.
      btn.classList.remove('hidden');
      cnt.textContent = `0/${totalDue}`;
      btn.title = `0 due in ${state.starterPathTrack} path, but ${totalDue} due in other tracks. Switch path scope or toggle path off to see them.`;
    } else {
      btn.classList.add('hidden');
    }
  }
  const weakBtn = document.getElementById('weak-btn');
  const weakCnt = document.getElementById('weak-count');
  if (weakBtn) {
    const n = Object.keys(state.weakness || {}).length;
    weakBtn.classList.toggle('hidden', n === 0);
    if (weakCnt) weakCnt.textContent = n;
  }
  // iter 56: Reveal Replay button visibility + count. Mirrors the weak-btn
  // pattern — auto-hides when the queue is empty (clean state stays quiet).
  const replayBtn = document.getElementById('reveal-replay-btn');
  const replayCnt = document.getElementById('reveal-replay-count');
  if (replayBtn) {
    const q = _revealedQueue();
    replayBtn.classList.toggle('hidden', q.length === 0);
    if (replayCnt) replayCnt.textContent = q.length;
  }
  // iter 60: 📡 At Risk button visibility + count. Joins weakness ∪ revealed
  // sets (the surface includes due lessons via the row data but the button-
  // visibility gate uses the same union, since pure-due lessons are already
  // surfaced by the existing 🕒 Review badge).
  const atRiskBtn = document.getElementById('at-risk-btn');
  const atRiskCnt = document.getElementById('at-risk-count');
  if (atRiskBtn) {
    const rows = _atRiskRows(7);
    atRiskBtn.classList.toggle('hidden', rows.length === 0);
    if (atRiskCnt) atRiskCnt.textContent = rows.length;
  }
  // iter 65: 💀 Resurrect button visibility + count. Auto-hides when no
  // lesson is past 2× its SR interval.
  const resBtn = document.getElementById('resurrect-btn');
  const resCnt = document.getElementById('resurrect-count');
  if (resBtn) {
    const ids = resurrectIds();
    resBtn.classList.toggle('hidden', ids.length === 0);
    if (resCnt) resCnt.textContent = ids.length;
  }
  // iter 94: 🧠 Bridge button visibility + count. Auto-hides when MECHANIC_INDEX
  // hasn't been built yet (first paint) OR no cross-track transfer gaps exist.
  // Lazy-kicks the index build on first call so subsequent updateReviewBadge
  // calls paint the populated count.
  const bridgeBtn = document.getElementById('bridge-btn');
  const bridgeCnt = document.getElementById('bridge-count');
  if (bridgeBtn) {
    const candidates = _bridgeCandidates();
    bridgeBtn.classList.toggle('hidden', candidates.length === 0);
    if (bridgeCnt) bridgeCnt.textContent = candidates.length;
    if (!_bridgeIndexKick && (!MECHANIC_INDEX || MECHANIC_INDEX.size === 0)) {
      _bridgeIndexKick = true;
      ensureMechanicIndex().then(() => {
        // Re-run after index is populated so the badge appears without a save.
        if (typeof updateReviewBadge === 'function') updateReviewBadge();
      });
    }
  }
}
function updateLessonHeaderInPlace() {
  // Refresh tab ✓ marks and the Mastered pill without rebuilding the body.
  const lesson = findLesson(state.currentLessonId);
  if (!lesson) return;
  const overall = lessonOverallStatus(lesson.id);
  // Refresh sparkline in-place — every pass/miss appended a history event so
  // the user sees the new tick land immediately without a full re-render.
  const sparkSlot = document.querySelector('#lesson-shell [data-sparkline-slot]');
  if (sparkSlot) sparkSlot.innerHTML = renderSparkline(lesson.id);
  // Tabs: each .tab-btn — append ✓ to the label if its level passed.
  // Reads the level off data-level so the optional Conversation tab doesn't
  // shift the index zip.
  const tabs = document.querySelectorAll('#lesson-shell .tab-btn');
  tabs.forEach(btn => {
    const lv = btn.dataset.level;
    if (lv !== 'L1' && lv !== 'L2' && lv !== 'L3') return;
    const passed = levelStatus(lesson.id, lv) === 'passed';
    const baseLabel = btn.textContent.replace(/\s*✓\s*$/, '').trim();
    btn.innerHTML = passed ? `${baseLabel} <span class="text-emerald-400 ml-1">✓</span>` : baseLabel;
  });
  // Mastered pill (header)
  const pillRow = document.querySelector('#lesson-shell .pill')?.parentElement;
  if (pillRow && overall === 'mastered' && !pillRow.querySelector('.pill-mastered')) {
    const m = document.createElement('span');
    m.className = 'pill pill-mastered ml-2';
    m.textContent = '✓ Mastered';
    pillRow.appendChild(m);
  }
  // Next-CTA row — when the lesson transitions to mastered we want the same
  // "Review N due →" / "Next lesson →" affordance that renderLesson already
  // injects on subsequent visits. Without this, the user passes L3 for the
  // first time and is stranded in the main view (the right next action is
  // only reachable via the sidebar drawer). Same logic as renderLesson's
  // nextCta block; if a row is already present we leave it alone.
  if (overall === 'mastered' && pillRow) {
    const headerDiv = pillRow.closest('div.mb-6');
    if (headerDiv && !headerDiv.querySelector('[data-cta-row]')) {
      const nextId = nextLessonId(lesson.id);
      const nextLessonObj = nextId ? findLesson(nextId) : null;
      const due = dueReviewIds();
      let ctaHtml = '';
      if (due.length > 0) {
        const secondary = nextLessonObj
          ? `<button class="secondary" data-action="goto-next">Next: ${escapeHtml(nextLessonObj.title)}</button>`
          : '';
        ctaHtml = `<div class="mt-3 flex items-center gap-2 flex-wrap" data-cta-row>
          <button class="primary" data-action="goto-due-review">🕒 Review ${due.length} due →</button>
          ${secondary}
          <button class="secondary" data-action="shuffle-here">🎲 Shuffle</button>
        </div>`;
      } else if (nextLessonObj) {
        ctaHtml = `<div class="mt-3 flex items-center gap-2" data-cta-row>
          <button class="primary" data-action="goto-next">Next lesson: ${escapeHtml(nextLessonObj.title)} →</button>
          <button class="secondary" data-action="shuffle-here">🎲 Shuffle review</button>
        </div>`;
      }
      if (ctaHtml) {
        const wrap = document.createElement('div');
        wrap.innerHTML = ctaHtml;
        const ctaEl = wrap.firstElementChild;
        headerDiv.appendChild(ctaEl);
        ctaEl.querySelector('[data-action="goto-next"]')?.addEventListener('click', () => { if (nextId) selectLesson(nextId); });
        ctaEl.querySelector('[data-action="goto-due-review"]')?.addEventListener('click', () => { document.getElementById('review-btn')?.click(); });
        ctaEl.querySelector('[data-action="shuffle-here"]')?.addEventListener('click', () => { const r = pickShuffleReview(); if (r) selectLesson(r); });
      }
    }
  }
}
function updateStreakUI() {
  const el = document.getElementById('streak-display');
  const cnt = document.getElementById('streak-count');
  if (!el || !cnt) return;
  if (state.streak > 0) {
    el.classList.remove('hidden');
    cnt.textContent = state.streak;
  } else {
    el.classList.add('hidden');
  }
}
function nextLessonId(currentId) {
  // Return the next fully-authored lesson id after currentId, wrapping if needed.
  const fullList = CURRICULUM.filter(l => l.status === 'full');
  const idx = fullList.findIndex(l => l.id === currentId);
  if (idx === -1 || fullList.length <= 1) return null;
  return fullList[(idx + 1) % fullList.length].id;
}
function prevLessonId(currentId) {
  const fullList = CURRICULUM.filter(l => l.status === 'full');
  const idx = fullList.findIndex(l => l.id === currentId);
  if (idx === -1 || fullList.length <= 1) return null;
  return fullList[(idx - 1 + fullList.length) % fullList.length].id;
}
function pickShuffleReview() {
  // Random mastered lesson (for retention review). Falls back to any authored lesson.
  const mastered = CURRICULUM.filter(l => l.status === 'full' && lessonOverallStatus(l.id) === 'mastered');
  const pool = mastered.length ? mastered : CURRICULUM.filter(l => l.status === 'full');
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}
// iter 108: 🍀 Lucky — random not-yet-fully-mastered authored lesson.
// Decision-fatigue antidote for the open-app-and-freeze moment; pool is the
// complement of pickShuffleReview's (unmastered, not mastered). Falls back to
// any authored lesson when 0 unmastered exist (mastered everything — rare).
function pickLuckyUnmastered() {
  const unmastered = CURRICULUM.filter(l =>
    l.status === 'full' && lessonOverallStatus(l.id) !== 'mastered'
  );
  const pool = unmastered.length ? unmastered : CURRICULUM.filter(l => l.status === 'full');
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}
function levelStatus(lessonId, level) {
  return state.progress?.[lessonId]?.[level] || 'not_started';
}
function lessonOverallStatus(lessonId) {
  const lesson = findLesson(lessonId);
  if (!lesson || lesson.status === 'stub') return 'stub';
  const p = state.progress[lessonId];
  if (!p) return 'not_started';
  const passed = ['L1','L2','L3'].filter(l => p[l] === 'passed').length;
  if (passed === 3) return 'mastered';
  if (passed > 0) return 'in_progress';
  return 'not_started';
}
function findLesson(id) { return CURRICULUM.find(l => l.id === id); }
// Centralized helper — call this whenever code sets state.currentLessonId
// directly (selectLesson, mock interview, review jump, weak-spot jump, init
// resume). Keeps the binder tab in sync with whichever lesson the user is on.
// Problems⇄Reference surface model: Reference = the Syntax track (always-on
// reference material); Problems = Patterns + Applied (the plan-scoped problems
// you work). The topbar segmented toggle flips state.surface; each surface keeps
// its own last-lesson (state.surfaceCtx) for lossless position memory.
const SURFACE_OF_TRACK = { syntax: 'reference', patterns: 'problems', applied: 'problems' };
function tracksForSurface(surface) {
  return surface === 'reference' ? ['syntax'] : ['patterns', 'applied'];
}
function syncBinderToLesson(id) {
  const l = findLesson(id);
  if (l && (l.track === 'syntax' || l.track === 'patterns' || l.track === 'applied')) {
    state.sidebarTrack = l.track;
    state.surface = SURFACE_OF_TRACK[l.track] || state.surface;
    if (!state.surfaceCtx) state.surfaceCtx = { problems: null, reference: null };
    state.surfaceCtx[state.surface] = id;
  }
}

// Flip the active surface (topbar segmented toggle / programmatic). Restores the
// surface's remembered lesson, else jumps to the first full lesson of its track.
function setSurface(surface) {
  if (surface !== 'problems' && surface !== 'reference') return;
  if (state.surface === surface) return;
  state.surface = surface;
  const ids = tracksForSurface(surface);
  if (!ids.includes(state.sidebarTrack)) state.sidebarTrack = ids[0];
  const remembered = state.surfaceCtx && state.surfaceCtx[surface];
  if (remembered && findLesson(remembered)) {
    selectLesson(remembered);
  } else {
    const first = CURRICULUM.find(l => ids.includes(l.track) && l.status === 'full');
    if (first) selectLesson(first.id);
    else { saveProgress(); renderSidebar(); }
  }
  updateSurfaceToggle();
}

// Paint the segmented toggle's active state from state.surface.
function updateSurfaceToggle() {
  document.querySelectorAll('.surface-seg').forEach(b => {
    const on = b.dataset.surface === state.surface;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

// Wire the topbar Problems⇄Reference segmented toggle.
function initSurfaceToggle() {
  document.querySelectorAll('.surface-seg').forEach(b => {
    b.addEventListener('click', () => setSurface(b.dataset.surface));
  });
  const planBtn = document.getElementById('topbar-plan');
  if (planBtn) planBtn.addEventListener('click', () => goToPlanHome());
  updateSurfaceToggle();
}

// Phase E: union the "needs work" signals into one ranked index, consumed by the
// sidebar inline icons + the 🛠 Repair filter. Resurrect (overdue) > due > weak >
// reveal. Bridge is an opportunity signal with its own surface — excluded here.
// `unscoped: true` sources the due signal from allDueReviewIds() instead of
// the Starter-Plan-filtered dueReviewIds(). Home and the scoped review
// sessions pass it: their scope is the track/section the user just tapped, so
// silently subtracting the active plan's track filter on top would show a
// section "1 due" (homeScopeStats reads isDueForReview directly) while its ⟲
// never appears. The sidebar and Browse keep the plan-scoped default.
function buildRepairIndex({ unscoped = false } = {}) {
  const idx = new Map();
  const consider = (id, rank, icon, title) => {
    if (!id || !findLesson(id)) return;
    const cur = idx.get(id);
    if (!cur || rank < cur.rank) idx.set(id, { rank, icon, title });
  };
  const dueIds = () => (unscoped ? allDueReviewIds() : dueReviewIds());
  try { (resurrectIds() || []).forEach(id => consider(id, 0, '💀', 'Overdue — mastered but past 2× its review interval')); } catch (_) {}
  try { (dueIds() || []).forEach(id => consider(id, 1, '🕒', 'Due for review (' + formatDueRelative(id) + ')')); } catch (_) {}
  try { Object.keys(state.weakness || {}).forEach(id => { if (state.weakness[id]) consider(id, 2, '⚠️', 'Weak spot — recurring L1 miss'); }); } catch (_) {}
  try { Object.keys(state.revealed || {}).forEach(id => { if (wasRevealed(id, 'L2') || wasRevealed(id, 'L3')) consider(id, 3, '🃏', 'Mastered with a reveal — retry clean to clear'); }); } catch (_) {}
  return idx;
}

// Phase H: full-bleed Session shell. Self-contained drills/streams/sims render
// into #lesson-shell with their own ✕ Exit affordance ([data-action^="exit-"]).
// When one is present we add body.in-session, which hides the topbar + sidebar
// (CSS) so the session owns the screen — the phone-80% focus mode. On exit the
// drill re-renders the lesson (no exit marker) and chrome returns. A single
// MutationObserver covers every session with zero per-function migration;
// sessions without the marker simply don't go full-bleed (graceful).
function _refreshSessionChrome() {
  const shell = document.getElementById('lesson-shell');
  if (!shell) { document.body.classList.remove('in-session'); return; }
  const inSession = !!shell.querySelector('[data-action^="exit-"]');
  document.body.classList.toggle('in-session', inSession);
}
function initSessionChrome() {
  const shell = document.getElementById('lesson-shell');
  if (!shell) return;
  new MutationObserver(() => _refreshSessionChrome()).observe(shell, { childList: true, subtree: true });
  _refreshSessionChrome();
}

// ──────────────────────────────────────────────────────────────────────────
