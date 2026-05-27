//  MECHANICS MODAL — cross-cutting drill surface
//  Two views inside one modal:
//    list   — every mechanic grouped by category, with mastered/total badge
//    detail — one mechanic's canonical snippet + every lesson that uses it,
//             sorted by review priority (due > weak > in-progress > new > mastered)
//  Tapping a lesson row jumps straight to it and closes the modal — the
//  user's existing L1/L2/L3 loop takes over from there. The act of seeing
//  the mechanic alongside its cross-track lesson set IS the interleaving aid.
// ──────────────────────────────────────────────────────────────────────────
let _mechanicsView = 'list';            // iter 63: 'list' | 'matrix' | 'detail'
let _mechanicsPrevView = 'list';        // iter 63: which non-detail view to return to on back
let _mechanicsSelectedId = null;        // mechanic id when view === 'detail'

function _mechMasteryFraction(lessonIds) {
  const arr = [...lessonIds];
  const mastered = arr.filter(id => lessonOverallStatus(id) === 'mastered').length;
  return { mastered, total: arr.length };
}

function _mechSortLessons(lessonIds) {
  // Review priority — surface the lesson the user most needs to drill first.
  const prio = (id) => {
    if (isDueForReview(id)) return 0;
    if (state.weakness[id]) return 1;
    const s = lessonOverallStatus(id);
    if (s === 'in_progress') return 2;
    if (s === 'not_started') return 3;
    return 4; // mastered, lowest priority
  };
  return [...lessonIds].sort((a, b) => {
    const pa = prio(a), pb = prio(b);
    if (pa !== pb) return pa - pb;
    return (findLesson(a)?.title || '').localeCompare(findLesson(b)?.title || '');
  });
}

async function openMechanicsModal() {
  const modal = document.getElementById('mechanics-modal');
  if (!modal) return;
  // Show modal first, then load — the loading state lives inside the modal
  // body, not behind a spinner that blocks the click.
  _mechanicsView = 'list';
  _mechanicsPrevView = 'list';
  _mechanicsSelectedId = null;
  const body = document.getElementById('mechanics-body');
  if (body) body.innerHTML = `<div style="color:#94a3b8;text-align:center;padding:24px 0;">Loading mechanics…</div>`;
  modal.style.display = 'block';
  await ensureMechanicIndex();
  renderMechanicsModal();
}

// iter 72: open the mechanics modal directly to the detail view for a given
// mechanic id. Used by Reference-tab mechanic-chips for lateral-transfer
// drilling — tap a chip → see every other lesson where that idiom appears.
// Back button returns to the list view (consistent with detail-from-list).
async function openMechanicsDetail(mechId) {
  const modal = document.getElementById('mechanics-modal');
  if (!modal) return;
  const body = document.getElementById('mechanics-body');
  if (body) body.innerHTML = `<div style="color:#94a3b8;text-align:center;padding:24px 0;">Loading mechanic…</div>`;
  modal.style.display = 'block';
  await ensureMechanicIndex();
  const m = MECHANICS.find(x => x.id === mechId);
  if (!m) {
    // Mechanic id not in registry — fall through to list view rather than
    // showing an empty detail. Defensive: this can happen if a lesson's
    // content.mechanics references a stale id.
    _mechanicsView = 'list';
    _mechanicsPrevView = 'list';
    _mechanicsSelectedId = null;
  } else {
    _mechanicsSelectedId = mechId;
    _mechanicsPrevView = 'list';
    _mechanicsView = 'detail';
  }
  renderMechanicsModal();
}

function closeMechanicsModal() {
  const modal = document.getElementById('mechanics-modal');
  if (modal) modal.style.display = 'none';
}

function renderMechanicsModal() {
  const body = document.getElementById('mechanics-body');
  const titleEl = document.getElementById('mechanics-title');
  const subEl = document.getElementById('mechanics-sub');
  const backBtn = document.getElementById('mechanics-back');
  if (!body || !titleEl || !subEl || !backBtn) return;
  // iter 63: keep List/Matrix toggle visible in non-detail views; sync active.
  const toggleEl = document.getElementById('mechanics-view-toggle');
  const listBtn = document.getElementById('mechanics-view-list');
  const matrixBtn = document.getElementById('mechanics-view-matrix');
  if (toggleEl && listBtn && matrixBtn) {
    toggleEl.style.display = _mechanicsView === 'detail' ? 'none' : 'flex';
    const activeStyle = 'background: rgba(217,70,239,0.18); color: #f0abfc; border: 1px solid rgba(217,70,239,0.4); border-radius: 999px; padding: 4px 12px; font-size: 11px; font-weight: 500; cursor: pointer;';
    const inactiveStyle = 'background: transparent; color: #94a3b8; border: 1px solid #334155; border-radius: 999px; padding: 4px 12px; font-size: 11px; font-weight: 500; cursor: pointer;';
    listBtn.setAttribute('style', _mechanicsView === 'list' ? activeStyle : inactiveStyle);
    matrixBtn.setAttribute('style', _mechanicsView === 'matrix' ? activeStyle : inactiveStyle);
  }

  if (_mechanicsView === 'matrix') {
    titleEl.textContent = '🧩 Mechanics · Track × Tag';
    subEl.textContent = 'Mastered/total per (mechanic, track). Transfer gaps highlighted — mechanics mastered in one track but not another.';
    backBtn.style.display = 'none';
    body.innerHTML = _renderMechanicsMatrixHtml();
    body.scrollTop = 0;
    body.querySelectorAll('[data-mech-cell]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mid = btn.getAttribute('data-mech-cell');
        const m = MECHANICS.find(x => x.id === mid);
        if (!m) return;
        _mechanicsSelectedId = mid;
        _mechanicsPrevView = 'matrix';  // back button → matrix view
        _mechanicsView = 'detail';
        renderMechanicsModal();
      });
    });
    return;
  }

  if (_mechanicsView === 'list') {
    titleEl.textContent = '🧩 Mechanics';
    subEl.textContent = 'Code idioms tagged across lessons. Tap a mechanic to see every lesson where it appears.';
    backBtn.style.display = 'none';
    body.innerHTML = _renderMechanicsListHtml();
    body.scrollTop = 0;
    body.querySelectorAll('[data-mech-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        _mechanicsSelectedId = btn.getAttribute('data-mech-id');
        _mechanicsPrevView = 'list';  // iter 63: back button → list view
        _mechanicsView = 'detail';
        renderMechanicsModal();
      });
    });
  } else {
    const m = MECHANICS.find(x => x.id === _mechanicsSelectedId);
    if (!m) { _mechanicsView = 'list'; renderMechanicsModal(); return; }
    titleEl.textContent = '🧩 ' + m.label;
    subEl.textContent = m.blurb;
    backBtn.style.display = '';
    body.innerHTML = _renderMechanicsDetailHtml(m);
    body.scrollTop = 0;
    body.querySelectorAll('[data-lesson-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-lesson-id');
        closeMechanicsModal();
        selectLesson(id);
      });
    });
  }
}

function _renderMechanicsListHtml() {
  if (!MECHANICS.length) {
    return `<div style="color:#94a3b8;text-align:center;padding:24px 0;">No mechanics defined.</div>`;
  }
  // Group by category, preserving category order from the registry; within
  // a category, sort by lesson count desc so the user's most-frequented
  // mechanics float up.
  const byCat = new Map();
  for (const cat of MECHANIC_CATEGORIES) byCat.set(cat.id, []);
  for (const m of MECHANICS) {
    const lessonIds = MECHANIC_INDEX.get(m.id) || new Set();
    const { mastered, total } = _mechMasteryFraction(lessonIds);
    const arr = byCat.get(m.category);
    if (arr) arr.push({ m, total, mastered });
  }
  let html = '';
  for (const cat of MECHANIC_CATEGORIES) {
    const items = byCat.get(cat.id) || [];
    items.sort((a, b) => b.total - a.total || a.m.label.localeCompare(b.m.label));
    if (!items.length) continue;
    html += `<div data-mech-cat="${escapeHtml(cat.id)}" style="font-size:10.5px;text-transform:uppercase;letter-spacing:0.07em;color:#64748b;margin-top:10px;margin-bottom:4px;">${escapeHtml(cat.label)}</div>`;
    for (const { m, total, mastered } of items) {
      const empty = total === 0;
      const masteredAll = total > 0 && mastered === total;
      const badgeColor = masteredAll ? '#34d399' : (mastered > 0 ? '#67e8f9' : '#94a3b8');
      const pct = total ? ` · ${Math.round((mastered / total) * 100)}%` : '';
      const cursor = empty ? 'default' : 'pointer';
      const opacity = empty ? '0.5' : '1';
      html += `<button data-mech-id="${escapeHtml(m.id)}" ${empty ? 'disabled' : ''} style="text-align:left; padding:10px 12px; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#e2e8f0; cursor:${cursor}; opacity:${opacity};">
        <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px;">
          <span style="font-weight:600;">${escapeHtml(m.label)}</span>
          <span style="color:${badgeColor}; font-size:11px; white-space:nowrap;">${mastered}/${total}${pct}</span>
        </div>
      </button>`;
    }
  }
  return html;
}

// iter 63: Mechanics × Track transfer-gap matrix (direct-promoted from
// iter-59 vision iter's held candidate B#2). Joins MECHANIC_INDEX (mechanic
// → Set<lessonId>) with each lesson's `track` to produce a mechanic × track
// grid showing mastered/total per cell. Surfaces transfer gaps the existing
// list view structurally can't show (e.g., "mastered `sliding-window` in
// syntax but unmastered in patterns" — the canonical case PROFILE.md
// pattern-fluency line names). Empty cells render dim; non-empty cells
// tap-to-detail filtered to that mechanic+track.
function _mechanicsTrackMatrix() {
  const tracks = ['syntax', 'patterns', 'applied'];
  const rows = [];
  for (const m of MECHANICS) {
    const lessonIds = MECHANIC_INDEX.get(m.id) || new Set();
    if (lessonIds.size === 0) continue;  // skip empty mechanics
    const perTrack = {};
    let totalAll = 0, masteredAll = 0;
    for (const t of tracks) perTrack[t] = { mastered: 0, total: 0, lessonIds: [] };
    for (const lid of lessonIds) {
      const lesson = findLesson(lid);
      if (!lesson || !tracks.includes(lesson.track)) continue;
      const cell = perTrack[lesson.track];
      cell.total++;
      cell.lessonIds.push(lid);
      totalAll++;
      if (lessonOverallStatus(lid) === 'mastered') {
        cell.mastered++;
        masteredAll++;
      }
    }
    // Detect transfer gap: ≥1 cell at 100% mastery + ≥1 other cell at 0% mastery
    // (and both have ≥1 lesson). This is the exact "you got it in track A
    // but not B" signal the matrix exists to surface.
    const cellsWithContent = tracks.filter(t => perTrack[t].total > 0);
    const hasMasteredCell = cellsWithContent.some(t => perTrack[t].total > 0 && perTrack[t].mastered === perTrack[t].total);
    const hasUnmasteredCell = cellsWithContent.some(t => perTrack[t].total > 0 && perTrack[t].mastered === 0);
    const transferGap = cellsWithContent.length >= 2 && hasMasteredCell && hasUnmasteredCell;
    rows.push({ id: m.id, label: m.label, perTrack, totalAll, masteredAll, transferGap });
  }
  // Sort: transfer-gap rows first (highest-signal), then by totalAll desc
  // (biggest cross-section mechanics float up), then alphabetic.
  rows.sort((a, b) => {
    if (a.transferGap !== b.transferGap) return a.transferGap ? -1 : 1;
    if (a.totalAll !== b.totalAll) return b.totalAll - a.totalAll;
    return a.label.localeCompare(b.label);
  });
  return rows;
}

function _renderMechanicsMatrixHtml() {
  const rows = _mechanicsTrackMatrix();
  if (!rows.length) {
    return `<div style="color:#94a3b8;text-align:center;padding:24px 0;">No mechanics yet.</div>`;
  }
  const transferGapCount = rows.filter(r => r.transferGap).length;
  const tracks = ['syntax', 'patterns', 'applied'];
  let html = '';
  if (transferGapCount > 0) {
    html += `<div style="font-size:11px; color:#fbbf24; background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.25); border-radius:6px; padding:6px 10px; margin-bottom:10px;">⚠ ${transferGapCount} transfer gap${transferGapCount === 1 ? '' : 's'} — mechanics mastered in one track but not another. Listed first.</div>`;
  }
  // Header row.
  html += `<div style="display:grid; grid-template-columns: 1fr 56px 56px 56px; gap:4px; padding:4px 8px; font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.06em;">
    <div></div>
    <div style="text-align:center;">Syntax</div>
    <div style="text-align:center;">Pattern</div>
    <div style="text-align:center;">Applied</div>
  </div>`;
  for (const row of rows) {
    const gapMarker = row.transferGap ? `<span style="color:#fbbf24; margin-right:4px;" title="Transfer gap">⚠</span>` : '';
    html += `<div style="display:grid; grid-template-columns: 1fr 56px 56px 56px; gap:4px; padding:6px 8px; align-items:center; background:#1e293b; border:1px solid ${row.transferGap ? 'rgba(251,191,36,0.35)' : '#334155'}; border-radius:6px;">
      <div style="font-size:12.5px; color:#e2e8f0; font-weight:500; overflow:hidden; text-overflow:ellipsis;">${gapMarker}${escapeHtml(row.label)}</div>`;
    for (const t of tracks) {
      const cell = row.perTrack[t];
      if (cell.total === 0) {
        html += `<div style="text-align:center; font-size:10px; color:#475569;">—</div>`;
        continue;
      }
      // Color depth = mastery ratio; transparent at 0%, full at 100%.
      const ratio = cell.mastered / cell.total;
      let bg = '#1e293b', fg = '#94a3b8';
      if (ratio === 1) { bg = 'rgba(52,211,153,0.22)'; fg = '#d1fae5'; }
      else if (ratio >= 0.5) { bg = 'rgba(103,232,249,0.18)'; fg = '#cffafe'; }
      else if (ratio > 0) { bg = 'rgba(251,191,36,0.15)'; fg = '#fde68a'; }
      else { bg = 'rgba(148,163,184,0.08)'; fg = '#94a3b8'; }
      html += `<button data-mech-cell="${escapeHtml(row.id)}" data-mech-cell-track="${escapeHtml(t)}" type="button" title="${escapeHtml(row.label)} in ${escapeHtml(t)} — tap to drill" style="background:${bg}; color:${fg}; border:1px solid rgba(255,255,255,0.05); border-radius:4px; padding:4px 0; cursor:pointer; font-size:11px; font-weight:600; font-variant-numeric: tabular-nums;">${cell.mastered}/${cell.total}</button>`;
    }
    html += `</div>`;
  }
  return html;
}

function _renderMechanicsDetailHtml(m) {
  const lessonIds = MECHANIC_INDEX.get(m.id) || new Set();
  const sorted = _mechSortLessons(lessonIds);
  const { mastered, total } = _mechMasteryFraction(lessonIds);
  let html = '';
  // Snippet — the canonical shape of this mechanic. Plain <pre> rather than
  // CodeMirror runMode keeps the modal lightweight; it's a glance surface.
  html += `<div style="background:#020617; border:1px solid #1e293b; border-radius:8px; padding:12px; margin-bottom:14px;">
    <pre style="margin:0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12.5px; color:#e2e8f0; white-space:pre-wrap; word-break: break-word;">${escapeHtml(m.snippet)}</pre>
  </div>`;
  html += `<div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
    <span style="color:#cbd5e1; font-size:13px; font-weight:600;">${total} lesson${total === 1 ? '' : 's'}</span>
    <span style="color:#94a3b8; font-size:12px;">${mastered}/${total} mastered</span>
  </div>`;
  if (!sorted.length) {
    html += `<div style="color:#94a3b8;text-align:center;padding:24px 0;">No lessons tagged with this mechanic yet.</div>`;
    return html;
  }
  html += `<div style="display:flex; flex-direction:column; gap:6px;">`;
  for (const id of sorted) {
    const lesson = findLesson(id);
    if (!lesson) continue;
    const overall = lessonOverallStatus(id);
    const dotColor = overall === 'mastered' ? '#34d399' : (overall === 'in_progress' ? '#facc15' : '#475569');
    const tagBits = [];
    if (isDueForReview(id)) tagBits.push(`<span style="color:#67e8f9; font-size:11px;">🕒 due</span>`);
    if (state.weakness[id]) tagBits.push(`<span style="color:#fdba74; font-size:11px;">⚠ weak</span>`);
    const trackMeta = TRACK_PILLS[lesson.track] || TRACK_PILLS.patterns;
    html += `<button data-lesson-id="${escapeHtml(id)}" style="text-align:left; padding:10px 12px; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#e2e8f0; cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:8px;">
      <span style="display:flex; align-items:center; gap:8px; min-width:0; overflow:hidden;">
        <span style="width:8px; height:8px; border-radius:50%; background:${dotColor}; flex:0 0 auto;" aria-hidden="true"></span>
        <span style="color:#94a3b8; font-size:10.5px; text-transform:uppercase; letter-spacing:0.05em; flex:0 0 auto;">${escapeHtml(trackMeta.label)}</span>
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(lesson.title)}</span>
      </span>
      <span style="display:flex; gap:8px; flex:0 0 auto;">${tagBits.join(' ')}</span>
    </button>`;
  }
  html += `</div>`;
  return html;
}

// ──────────────────────────────────────────────────────────────────────────
