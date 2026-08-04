async function loadPaths() {
  try {
    const res = await fetch('data/paths.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Paths fetch failed: ' + res.status);
    const data = await res.json();
    PATHS = Array.isArray(data.paths) ? data.paths : [];
  } catch (e) {
    console.warn('[paths] fetch failed, using minimal Starter-only fallback:', e);
    // Defensive fallback so the app still boots into Starter Plan mode even when
    // data/paths.json is missing or malformed. lessons:[] disables Plan View
    // (would otherwise crash trying to filter on an undefined sequence).
    PATHS = [{
      id: 'starter',
      label: 'Starter Plan',
      icon: 'compass',
      kind: 'lessons',
      blurb: 'Linear recommended order through the full JS Drill curriculum.',
      lessons: []
    }];
  }
}

function getSubscribedPath() {
  return PATHS.find(p => p.id === state.subscribedPathId) || PATHS[0];
}

// Resolve a path's ordered drill-lesson list from its `lessons` field
// (populated from data/paths.json by loadPaths). Returns null for paths
// with no/empty drill-lesson sequence (→ Plan View disabled).
function getPathLessonOrder(path) {
  if (!path) return null;
  return Array.isArray(path.lessons) && path.lessons.length ? path.lessons : null;
}

// True when the subscribed path exposes a non-empty drill-lesson sequence the
// sidebar can filter to. Drives the enabled/disabled state of the button.
function subscribedPathHasLessons() {
  const order = getPathLessonOrder(getSubscribedPath());
  return Array.isArray(order) && order.length > 0;
}

// For kind:'cram' paths, returns the 0-based index of the day the user is on,
// or -1 when the cycle has ended. Before-start clamps to 0 (preview Day 1);
// after-end returns -1 so callers fall through to pure SR mode.
function getCramDayIndex(path) {
  if (!path || path.kind !== 'cram' || !Array.isArray(path.days) || !path.days.length) return -1;
  if (!path.startIso) return 0;
  const todayIso = new Date().toISOString().slice(0, 10);
  if (todayIso < path.startIso) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = new Date(path.startIso + 'T00:00:00').getTime();
  const today = new Date(todayIso + 'T00:00:00').getTime();
  const diff = Math.floor((today - start) / msPerDay);
  return diff >= path.days.length ? -1 : diff;
}

function isCramTaskDone(task) {
  if (task.lessonId) {
    return window.DrillStorage && window.DrillStorage.isLessonFullyDone(task.lessonId);
  }
  return !!state.cramTaskChecks[task.id];
}

function _cramDayProgress(day) {
  let total = 0, done = 0;
  for (const b of day.blocks) for (const t of b.tasks) { total++; if (isCramTaskDone(t)) done++; }
  return { total, done, pct: total ? Math.round(100 * done / total) : 0 };
}

function _cramRenderTaskRow(task, opts = {}) {
  const done = isCramTaskDone(task);
  if (opts.openOnly && done) return '';
  const lesson = task.lessonId ? findLesson(task.lessonId) : null;
  const lessonTitle = lesson ? lesson.title : '';
  const minsBadge = task.mins != null ? `<span style="font-size:11px;color:#6b7079;">~${task.mins} min</span>` : '';
  const checkAttr = task.lessonId ? 'disabled' : '';
  const checkTitle = task.lessonId ? 'Ticks automatically when you master the linked lesson' : 'Tap to mark done';
  const lessonBtn = task.lessonId
    ? `<button data-cram-open="${escapeHtml(task.lessonId)}" style="background:#262930;color:#ffce5a;border:none;border-radius:5px;padding:3px 9px;font-size:11px;cursor:pointer;font-weight:500;">Open →</button>`
    : '';
  const redoBtn = (!task.lessonId && done)
    ? `<button data-cram-redo="${escapeHtml(task.id)}" title="Re-open this task" style="background:none;border:none;color:#fdba74;cursor:pointer;font-size:11px;text-decoration:underline;">↻ redo</button>`
    : '';
  const lessonBadge = lessonTitle ? `: <strong style="color:#eef0f2;">${escapeHtml(lessonTitle)}</strong>` : '';
  return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-top:1px solid #262930;${done ? 'opacity:0.55;' : ''}">
    <input type="checkbox" data-cram-check="${escapeHtml(task.id)}" ${done ? 'checked' : ''} ${checkAttr} title="${escapeHtml(checkTitle)}" style="margin-top:3px;cursor:${task.lessonId ? 'default' : 'pointer'};" />
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;line-height:1.5;color:#c4c9cf;${done ? 'text-decoration:line-through;' : ''}">${escapeHtml(task.label)}${lessonBadge}</div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:6px;flex-wrap:wrap;">${minsBadge}${lessonBtn}${redoBtn}</div>
    </div>
  </div>`;
}

function _cramRenderDayBody(day, dayIdx, opts = {}) {
  const p = _cramDayProgress(day);
  const openOnly = !!opts.openOnly;
  const collapseDone = !!opts.collapseDone;
  const blocksHtml = day.blocks.map(block => {
    const blockDone = block.tasks.filter(isCramTaskDone).length;
    const blockTotal = block.tasks.length;
    const blockComplete = blockDone === blockTotal && blockTotal > 0;
    const tasksHtml = block.tasks.map(t => _cramRenderTaskRow(t, { openOnly })).join('');
    if (openOnly && blockDone === blockTotal) return '';
    const expanded = !(collapseDone && blockComplete);
    return `<details ${expanded ? 'open' : ''} style="background:#0e0f12;border:1px solid #262930;border-radius:8px;margin-bottom:8px;">
      <summary style="padding:10px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;list-style:none;">
        <span style="display:flex;flex-direction:column;min-width:0;">
          <span style="font-size:14px;font-weight:600;color:#eef0f2;">${escapeHtml(block.title)}</span>
          <span style="font-size:11px;color:#6b7079;">${escapeHtml(block.duration || '')}</span>
        </span>
        <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;background:${blockComplete ? '#34d399' : '#262930'};color:${blockComplete ? '#17181c' : '#c4c9cf'};font-variant-numeric:tabular-nums;flex-shrink:0;">${blockDone}/${blockTotal}</span>
      </summary>
      <div style="padding:0 14px 12px;">${tasksHtml}</div>
    </details>`;
  }).join('');
  const checkpoints = (day.checkpoints && day.checkpoints.length && !openOnly)
    ? `<div style="margin-top:12px;background:#0e0f12;border-left:3px solid #34d399;border-radius:8px;padding:12px 14px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#34d399;font-weight:600;margin-bottom:6px;">End-of-day checkpoints</div>
        <ul style="margin:0;padding-left:18px;color:#9aa0aa;font-size:13px;line-height:1.5;">${day.checkpoints.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
      </div>`
    : '';
  const header = `<div style="display:flex;align-items:center;gap:10px;margin:14px 0 10px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:16px;font-weight:700;color:#eef0f2;">Day ${day.day} — ${escapeHtml(day.title)}</div>
        <div style="font-size:12px;color:#9aa0aa;">${escapeHtml(day.date || '')}</div>
      </div>
      <div style="flex-shrink:0;display:flex;align-items:center;gap:8px;">
        <div style="width:80px;height:6px;background:#262930;border-radius:3px;overflow:hidden;"><div style="height:100%;background:linear-gradient(90deg,#f5b62b,#34d399);width:${p.pct}%;"></div></div>
        <span style="font-size:12px;color:#9aa0aa;font-variant-numeric:tabular-nums;">${p.done}/${p.total}</span>
        ${opts.allowRedrill && !openOnly ? `<button data-cram-redrill-day="${dayIdx}" title="Reset this day&#39;s manual ticks (lesson mastery stays)" style="background:#262930;color:#fdba74;border:none;border-radius:5px;padding:4px 8px;font-size:11px;cursor:pointer;">${dsIcon('target', 15)} Re-drill</button>` : ''}
      </div>
    </div>`;
  return `<div data-cram-day-section="${dayIdx}">${header}${blocksHtml}${checkpoints}</div>`;
}

function renderCramHome(path) {
  const shell = document.getElementById('lesson-shell');
  const view = state.cramView || { mode: 'today', dayIndex: -1 };
  const todayIdx = getCramDayIndex(path);
  const isPastEnd = todayIdx < 0;
  const effectiveTodayIdx = isPastEnd ? path.days.length - 1 : todayIdx;
  const focusIdx = (view.mode === 'today') ? effectiveTodayIdx
    : (view.mode === 'day' || view.mode === 'open-from')
      ? Math.max(0, Math.min(path.days.length - 1, view.dayIndex))
      : effectiveTodayIdx;

  const stripChips = path.days.map((d, i) => {
    const p = _cramDayProgress(d);
    const isToday = i === todayIdx;
    const isActive = (view.mode === 'today' && i === effectiveTodayIdx) ||
                     (view.mode === 'day' && i === view.dayIndex) ||
                     (view.mode === 'open-from' && i === view.dayIndex);
    const border = isActive ? '#34d399' : (isToday ? '#ffce5a' : '#262930');
    const bg = isActive ? 'rgba(52,211,153,0.10)' : '#0e0f12';
    return `<button data-cram-day="${i}" style="flex-shrink:0;background:${bg};border:1.5px solid ${border};border-radius:8px;padding:8px 12px;cursor:pointer;color:#c4c9cf;font-family:inherit;text-align:left;min-width:84px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7079;font-weight:600;">Day ${i + 1}${isToday ? ' · today' : ''}</div>
      <div style="font-size:12px;font-weight:600;color:#c4c9cf;margin-top:2px;">${escapeHtml(d.title.slice(0, 22))}</div>
      <div style="font-size:11px;color:${p.done === p.total ? '#34d399' : '#9aa0aa'};font-variant-numeric:tabular-nums;margin-top:3px;">${p.done}/${p.total} · ${p.pct}%</div>
    </button>`;
  }).join('');
  const allActive = view.mode === 'all';
  const allChip = `<button data-cram-all style="flex-shrink:0;background:${allActive ? 'rgba(52,211,153,0.10)' : '#0e0f12'};border:1.5px solid ${allActive ? '#34d399' : '#262930'};border-radius:8px;padding:8px 12px;cursor:pointer;color:#c4c9cf;font-family:inherit;min-width:60px;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7079;font-weight:600;">View</div>
    <div style="font-size:12px;font-weight:600;margin-top:2px;">All days</div>
  </button>`;
  const stripHtml = `<div style="display:flex;gap:8px;overflow-x:auto;padding:6px 2px 14px;-webkit-overflow-scrolling:touch;">${stripChips}${allChip}</div>`;

  let carryoverHtml = '';
  if ((view.mode === 'today' || (view.mode === 'day' && view.dayIndex >= todayIdx)) && todayIdx > 0) {
    const carryover = [];
    for (let i = 0; i < todayIdx; i++) {
      const d = path.days[i];
      let open = 0;
      for (const b of d.blocks) for (const t of b.tasks) { if (!isCramTaskDone(t)) open++; }
      if (open) carryover.push({ idx: i, open, title: d.title });
    }
    if (carryover.length) {
      carryoverHtml = `<div style="background:rgba(249,115,22,0.10);border:1px solid rgba(249,115,22,0.35);border-radius:10px;padding:12px 14px;margin-bottom:14px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#fdba74;font-weight:700;margin-bottom:8px;">⚠ Carryover · unfinished from earlier days</div>
        ${carryover.map(c => `<button data-cram-open-from="${c.idx}" style="display:block;width:100%;text-align:left;background:#0e0f12;border:1px solid #262930;border-radius:6px;padding:8px 12px;margin-top:6px;color:#eef0f2;cursor:pointer;font-family:inherit;">
          <span style="font-size:13px;">${c.open} open from <strong>Day ${c.idx + 1} — ${escapeHtml(c.title)}</strong></span>
          <span style="float:right;color:#fdba74;font-size:11px;">Focus →</span>
        </button>`).join('')}
      </div>`;
    }
  }

  let rocksHtml = '';
  if (Array.isArray(path.bigRocks) && path.bigRocks.length && view.mode !== 'open-from') {
    const openByDefault = todayIdx <= 0 && view.mode === 'today';
    rocksHtml = `<details ${openByDefault ? 'open' : ''} style="background:rgba(249,115,22,0.07);border:1px solid rgba(249,115,22,0.25);border-radius:10px;padding:8px 14px;margin-bottom:14px;">
      <summary style="cursor:pointer;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#fdba74;font-weight:700;list-style:none;">⚠ ${path.bigRocks.length} Big Rocks · the gaps to close</summary>
      <ol style="margin:8px 0 4px;padding-left:22px;font-size:13px;color:#c4c9cf;line-height:1.6;">
        ${path.bigRocks.map(r => `<li><strong style="color:#fdba74;">${escapeHtml(r.rock)}</strong> — ${escapeHtml(r.detail)}</li>`).join('')}
      </ol>
    </details>`;
  }

  let endedHtml = '';
  if (isPastEnd && (view.mode === 'today' || view.mode === 'day')) {
    endedHtml = `<div style="background:rgba(245,182,43,0.08);border:1px solid rgba(245,182,43,0.3);border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:13px;color:#c4c9cf;">
      Cram cycle complete. Spaced review keeps every lesson you covered alive — check Review for what's due today.
    </div>`;
  }

  let bodyHtml = '';
  if (view.mode === 'all') {
    bodyHtml = path.days.map((d, i) => _cramRenderDayBody(d, i, { allowRedrill: i < todayIdx, collapseDone: i < todayIdx })).join('');
  } else if (view.mode === 'open-from') {
    bodyHtml = `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#fdba74;font-weight:700;margin-top:8px;">Open items only · Day ${view.dayIndex + 1}</div>` +
      _cramRenderDayBody(path.days[focusIdx], focusIdx, { openOnly: true });
  } else {
    bodyHtml = _cramRenderDayBody(path.days[focusIdx], focusIdx, { allowRedrill: focusIdx < todayIdx });
  }

  shell.innerHTML = `<div style="max-width:760px;margin:0 auto;padding:0;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:6px;">
      <h1 style="font-size:20px;font-weight:700;color:#ffffff;margin:0;">${dsIcon('clock', 15)}${escapeHtml(path.label)}</h1>
      <span style="font-size:12px;color:#9aa0aa;">${isPastEnd ? 'cycle complete' : `Day ${todayIdx + 1} of ${path.days.length}`}</span>
    </div>
    <div style="font-size:13px;color:#9aa0aa;margin-bottom:10px;">${escapeHtml(path.blurb || '')}</div>
    ${stripHtml}
    ${endedHtml}
    ${rocksHtml}
    ${carryoverHtml}
    ${bodyHtml}
  </div>`;

  // Wire interactions
  const rerender = () => renderCramHome(path);
  shell.querySelectorAll('[data-cram-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.getAttribute('data-cram-day'), 10);
      state.cramView = { mode: i === todayIdx ? 'today' : 'day', dayIndex: i };
      saveProgress();
      rerender();
    });
  });
  const allBtn = shell.querySelector('[data-cram-all]');
  if (allBtn) allBtn.addEventListener('click', () => {
    state.cramView = { mode: 'all', dayIndex: -1 };
    saveProgress();
    rerender();
  });
  shell.querySelectorAll('[data-cram-open-from]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.getAttribute('data-cram-open-from'), 10);
      state.cramView = { mode: 'open-from', dayIndex: i };
      saveProgress();
      rerender();
    });
  });
  shell.querySelectorAll('[data-cram-check]').forEach(cb => {
    cb.addEventListener('click', (e) => {
      const id = cb.getAttribute('data-cram-check');
      if (cb.disabled) { e.preventDefault(); return; }
      if (cb.checked) state.cramTaskChecks[id] = true;
      else delete state.cramTaskChecks[id];
      saveProgress();
      updateCramProgressStrip();
      rerender();
    });
  });
  shell.querySelectorAll('[data-cram-redo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cram-redo');
      delete state.cramTaskChecks[id];
      saveProgress();
      updateCramProgressStrip();
      rerender();
    });
  });
  shell.querySelectorAll('[data-cram-redrill-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.getAttribute('data-cram-redrill-day'), 10);
      if (!confirm(`Reset Day ${i + 1}'s manual ticks? (Lesson mastery stays put.)`)) return;
      const day = path.days[i];
      for (const b of day.blocks) for (const t of b.tasks) {
        if (!t.lessonId) delete state.cramTaskChecks[t.id];
      }
      saveProgress();
      updateCramProgressStrip();
      rerender();
    });
  });
  shell.querySelectorAll('[data-cram-open]').forEach(btn => {
    btn.addEventListener('click', () => selectLesson(btn.getAttribute('data-cram-open')));
  });
}

// Returns the user to the Cram Home view by clearing the active lesson.
// Phase 2 entry point for the today-btn and topbar-strip clicks when on cram.
function goToCramHome() {
  state.currentLessonId = null;
  saveProgress();
  if (typeof renderSidebar === 'function') renderSidebar();
  renderLesson();
}

// Phase D: the Plan home is the full-page home for ANY plan. Clearing the
// current lesson + re-rendering routes through renderLesson, which dispatches
// to renderCramHome (cram plans) or renderPlanHomeLessons (lessons-kind plans).
function goToPlanHome() {
  state.currentLessonId = null;
  saveProgress();
  if (typeof renderSidebar === 'function') renderSidebar();
  renderLesson();
}

// Full-page Plan home for non-cram (kind:'lessons') plans — Starter / Eve-Legal /
// All. Generalizes Cram Home: progress + Continue + quick-starts. Quick-starts
// reuse the existing sidebar-button handlers via synthetic click so there's no
// logic duplication. Cross-plan analytics live in Reflect; this page is the
// active plan's progress + entry points.
function renderPlanHomeLessons(shell, path) {
  const order = (typeof getPathLessonOrder === 'function' && path) ? (getPathLessonOrder(path) || []) : [];
  const ids = order.length ? order : CURRICULUM.filter(l => l.status === 'full').map(l => l.id);
  const total = ids.length;
  const mastered = ids.filter(id => lessonOverallStatus(id) === 'mastered').length;
  const pct = total ? Math.round(100 * mastered / total) : 0;
  const nextId = ids.find(id => lessonOverallStatus(id) !== 'mastered') || ids[0];
  const nextLesson = nextId ? findLesson(nextId) : null;
  const label = (path && path.label) || 'All Lessons';
  const blurb = (path && path.blurb) || 'Drill across the full curriculum.';
  const qBtn = (id, txt) => `<button data-plan-q="${id}" style="background:#0e0f12;border:1px solid #363a43;border-radius:9px;padding:9px 13px;color:#c4c9cf;cursor:pointer;font:inherit;">${txt}</button>`;
  shell.innerHTML = `<div style="max-width:760px;margin:0 auto;">
    <h1 style="font-size:22px;font-weight:700;color:#ffffff;margin:0 0 2px;">${dsIcon('clipboard', 15)}${escapeHtml(label)}</h1>
    <div style="font-size:13px;color:#9aa0aa;margin-bottom:14px;">${escapeHtml(blurb)}</div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#9aa0aa;margin-bottom:6px;max-width:520px;"><span>${mastered} / ${total} mastered</span><span>${pct}%</span></div>
    <div style="height:8px;background:#262930;border-radius:999px;overflow:hidden;max-width:520px;margin-bottom:18px;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#f5b62b,#34d399);"></div></div>
    ${nextLesson ? `<button data-plan-continue style="display:inline-flex;align-items:center;gap:8px;background:#059669;color:#ecfdf5;border:0;border-radius:10px;padding:11px 18px;font:inherit;font-weight:700;cursor:pointer;">${dsIcon('play', 14)} Continue · ${escapeHtml(nextLesson.title)}</button>` : ''}
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">
      ${qBtn('today-btn', dsIcon('calendar-check', 15) + " Today's session")}${qBtn('warmup-btn', dsIcon('sunrise', 15) + ' Warmup')}${qBtn('lucky-btn', dsIcon('clover', 15) + ' Lucky')}${qBtn('shuffle-btn', dsIcon('dice', 15) + ' Shuffle')}
    </div>
    <div style="font-size:12px;color:#6b7079;margin-top:18px;">Switch plan in the sidebar. Cross-plan stats live in Reflect.</div>
  </div>`;
  const cont = shell.querySelector('[data-plan-continue]');
  if (cont && nextId) cont.addEventListener('click', () => selectLesson(nextId));
  shell.querySelectorAll('[data-plan-q]').forEach(b => {
    b.addEventListener('click', () => document.getElementById(b.getAttribute('data-plan-q'))?.click());
  });
}

// Phase 3: cram-reference content. Loaded lazily on first modal open.
let CRAM_REFS = { glossary: null, cheat: null, behavior: null };
async function loadCramRefs() {
  if (CRAM_REFS.glossary && CRAM_REFS.cheat && CRAM_REFS.behavior) return CRAM_REFS;
  try {
    const [g, c, b] = await Promise.all([
      fetch('data/cram-glossary.json', { cache: 'no-cache' }).then(r => r.json()),
      fetch('data/cram-cheat.json', { cache: 'no-cache' }).then(r => r.json()),
      fetch('data/cram-behavior.json', { cache: 'no-cache' }).then(r => r.json())
    ]);
    CRAM_REFS = { glossary: g.terms || [], cheat: c.rows || [], behavior: b.cards || [] };
  } catch (e) {
    console.warn('[cram-refs] load failed', e);
    CRAM_REFS = { glossary: [], cheat: [], behavior: [] };
  }
  return CRAM_REFS;
}

// 6 Must-Know Code Shapes — interview canonical snippets. Each shape maps to
// a representative lesson in the existing curriculum (the canonical IS the
// lesson — single source of truth). Tap → drill the lesson.
const CRAM_CODE_SHAPES = [
  { title: '1. Binary Search (closed interval)', note: "Invariant: if target exists, it is in arr[lo..hi]. After the loop, lo === hi + 1.", lessonId: 'binary-search' },
  { title: '2. BFS (graph or tree level-order)', note: "Queue + visited Set. For level-order: capture queue.length at the top of each iteration — that's the number of nodes in the current level.", lessonId: 's-bfs-template' },
  { title: '3. DFS (in/pre/post-order)', note: "Pre-order: work BEFORE children. Post-order: work AFTER children — needed when the parent's result depends on the children's results (e.g. tree height).", lessonId: 's-tree-traversals' },
  { title: '4. Sliding Window (variable size)', note: 'Works when the "valid window" condition is monotonic as you grow the window. Breaks if growing can both make it more AND less valid (e.g. sums with negatives — use prefix-sum + deque).', lessonId: 'p-longest-sub' },
  { title: '5. Two Pointers (sorted array)', note: 'Key insight: at each step, you eliminate ALL pairs involving the moved index — that\'s why two pointers is O(n), not O(n²).', lessonId: 'valid-palindrome' },
  { title: '6. Heap-of-K (for "K most ___")', note: "Maintain a min-heap of size K. On each new v: if heap.size < K → push; else if v > heap.top → pop+push v. O(N log K) time, O(K) space.", lessonId: 's-heap-ops' }
];

function _openCramRefModal({ title, sub, searchPlaceholder, bodyHtml, onSearch, onBody }) {
  const modal = document.getElementById('cram-ref-modal');
  const titleEl = document.getElementById('cram-ref-title');
  const subEl = document.getElementById('cram-ref-sub');
  const search = document.getElementById('cram-ref-search');
  const body = document.getElementById('cram-ref-body');
  if (!modal || !body) return;
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub || '';
  if (searchPlaceholder) {
    search.placeholder = searchPlaceholder;
    search.value = '';
    search.hidden = false;
    search.oninput = () => onSearch && onSearch(search.value, body);
  } else {
    search.hidden = true;
    search.oninput = null;
  }
  body.innerHTML = bodyHtml;
  if (onBody) onBody(body);
  modal.style.display = 'block';
}

function _matchesSearch(q, ...fields) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some(f => (f || '').toLowerCase().includes(needle));
}

async function openCramCheatModal() {
  await loadCramRefs();
  const renderRows = (q) => CRAM_REFS.cheat
    .filter(r => _matchesSearch(q, r.trigger, r.pattern))
    .map(r => {
      const lesson = r.lessonId ? findLesson(r.lessonId) : null;
      const lessonBadge = lesson
        ? `<button data-cram-ref-lesson="${escapeHtml(r.lessonId)}" style="background:#262930;color:#ffce5a;border:none;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:500;font-family:inherit;">${escapeHtml(lesson.title)} →</button>`
        : '';
      return `<div style="background:#0e0f12;border:1px solid #262930;border-radius:8px;padding:12px 14px;">
        <div style="font-size:11px;color:#9aa0aa;font-style:italic;line-height:1.5;">${escapeHtml(r.trigger)}</div>
        <div style="font-size:14px;color:#eef0f2;margin-top:6px;font-weight:500;">${escapeHtml(r.pattern)}</div>
        ${lessonBadge ? `<div style="margin-top:8px;">${lessonBadge}</div>` : ''}
      </div>`;
    }).join('') || `<div style="color:#6b7079;text-align:center;padding:24px;font-size:13px;">No rows match.</div>`;
  _openCramRefModal({
    title: dsIcon('zap', 15) + ' Cheat — which pattern when?',
    sub: 'Cue → pattern → tap to drill the canonical lesson.',
    searchPlaceholder: 'Filter cues or patterns…',
    bodyHtml: renderRows(''),
    onSearch: (q, body) => { body.innerHTML = renderRows(q); wireCramRefLessonBtns(); },
    onBody: wireCramRefLessonBtns
  });
}

async function openCramGlossaryModal() {
  await loadCramRefs();
  const total = CRAM_REFS.glossary.length;
  const renderQuizCta = () => {
    const sess = state.glossaryQuiz && state.glossaryQuiz.session;
    if (sess && sess.queue && sess.index < sess.queue.length) {
      return `<div style="position:sticky;top:0;background:#17181c;z-index:1;display:flex;gap:8px;padding-bottom:6px;">
        <button data-glossquiz-resume style="flex:1;background:#0e7490;color:#ffedc2;border:none;border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">${dsIcon('play', 14)} Resume quiz · ${sess.index + 1}/${sess.queue.length}</button>
        <button data-glossquiz-restart title="Discard the in-progress quiz and start fresh" style="background:#262930;color:#9aa0aa;border:none;border-radius:8px;padding:10px 12px;font-size:13px;cursor:pointer;font-family:inherit;">↻</button>
      </div>`;
    }
    return `<button data-glossquiz-start style="position:sticky;top:0;z-index:1;width:100%;background:#0e7490;color:#ffedc2;border:none;border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">${dsIcon('target', 15)} Quiz me (${Math.min(GLOSSARY_QUIZ_LEN, total)} questions)</button>`;
  };
  const renderTerms = (q) => CRAM_REFS.glossary
    .filter(t => _matchesSearch(q, t.term, t.def, t.where))
    .map(t => `<div style="background:#0e0f12;border:1px solid #262930;border-radius:8px;padding:12px 14px;">
      <div style="font-size:14px;font-weight:600;color:#ffce5a;margin-bottom:4px;">${escapeHtml(t.term)}</div>
      <div style="font-size:13px;color:#eef0f2;line-height:1.55;">${escapeHtml(t.def)}</div>
      ${t.where ? `<div style="font-size:11px;color:#9aa0aa;margin-top:8px;padding-top:8px;border-top:1px solid #262930;"><strong style="color:#6b7079;">Where:</strong> ${escapeHtml(t.where)}</div>` : ''}
    </div>`).join('') || `<div style="color:#6b7079;text-align:center;padding:24px;font-size:13px;">No terms match.</div>`;
  _openCramRefModal({
    title: `🅰 Glossary — ${total} interview terms`,
    sub: 'Definitions and where each term shows up in problems.',
    searchPlaceholder: 'Filter terms or definitions…',
    bodyHtml: renderQuizCta() + renderTerms(''),
    onSearch: (q, body) => { body.innerHTML = renderQuizCta() + renderTerms(q); wireGlossaryQuizCta(); },
    onBody: wireGlossaryQuizCta
  });
}

function wireGlossaryQuizCta() {
  const startBtn = document.querySelector('[data-glossquiz-start]');
  if (startBtn) startBtn.addEventListener('click', startGlossaryQuiz);
  const resumeBtn = document.querySelector('[data-glossquiz-resume]');
  if (resumeBtn) resumeBtn.addEventListener('click', renderGlossaryQuizSession);
  const restartBtn = document.querySelector('[data-glossquiz-restart]');
  if (restartBtn) restartBtn.addEventListener('click', () => {
    if (!confirm('Discard the in-progress quiz and start fresh?')) return;
    state.glossaryQuiz.session = null;
    saveProgress();
    startGlossaryQuiz();
  });
}

// MC quiz over cram glossary terms. Mixed direction: half the cards show the
// term and ask for the definition; the other half show the definition and ask
// for the term. Distractors are 3 random other entries from the glossary, in
// the same field (defs for term→def cards, terms for def→term cards). Shares
// the cram-ref-modal shell with the browse view; an in-progress session
// resurfaces via a "Resume quiz" CTA at the top of the browse list.
const GLOSSARY_QUIZ_LEN = 10;

function _glossaryQuizShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildGlossaryQuizQueue(n) {
  const terms = (CRAM_REFS.glossary || []).filter(t => t && t.term && t.def);
  if (!terms.length) return [];
  const picked = _glossaryQuizShuffle(terms).slice(0, Math.min(n, terms.length));
  return picked.map((t, i) => {
    const kind = i % 2 === 0 ? 'term2def' : 'def2term';
    const others = terms.filter(o => o.term !== t.term);
    const distractors = _glossaryQuizShuffle(others).slice(0, 3);
    const correct = kind === 'term2def' ? t.def : t.term;
    const distractorVals = distractors.map(d => kind === 'term2def' ? d.def : d.term);
    const options = _glossaryQuizShuffle([correct, ...distractorVals]);
    return {
      kind,
      term: t.term,
      def: t.def,
      where: t.where || '',
      options,
      correctIdx: options.indexOf(correct)
    };
  });
}

async function startGlossaryQuiz() {
  await loadCramRefs();
  const queue = buildGlossaryQuizQueue(GLOSSARY_QUIZ_LEN);
  if (!queue.length) return;
  state.glossaryQuiz.session = { queue, index: 0, picked: null, correctCount: 0 };
  state.glossaryQuiz.sessions++;
  state.glossaryQuiz.lastRunAt = Date.now();
  saveProgress();
  renderGlossaryQuizSession();
}

function renderGlossaryQuizSession() {
  const sess = state.glossaryQuiz && state.glossaryQuiz.session;
  const modal = document.getElementById('cram-ref-modal');
  const titleEl = document.getElementById('cram-ref-title');
  const subEl = document.getElementById('cram-ref-sub');
  const search = document.getElementById('cram-ref-search');
  const body = document.getElementById('cram-ref-body');
  if (!modal || !sess) return;
  if (search) { search.hidden = true; search.value = ''; search.oninput = null; }
  modal.style.display = 'block';

  if (sess.index >= sess.queue.length) {
    const total = sess.queue.length;
    const pct = total ? Math.round(100 * sess.correctCount / total) : 0;
    titleEl.innerHTML = dsIcon('target', 15) + ' Glossary Quiz · done';
    subEl.textContent = `${sess.correctCount} / ${total} correct`;
    body.innerHTML = `<div style="text-align:center;padding:30px 12px;">
      <div style="font-size:48px;font-weight:700;color:${pct >= 70 ? '#34d399' : '#f5b62b'};font-variant-numeric:tabular-nums;line-height:1;">${pct}%</div>
      <div style="color:#9aa0aa;font-size:14px;margin-top:6px;">recall</div>
      <div style="display:flex;justify-content:center;gap:10px;margin-top:22px;flex-wrap:wrap;">
        <button data-glossquiz-retake style="background:#34d399;color:#17181c;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Retake</button>
        <button data-glossquiz-done style="background:#262930;color:#eef0f2;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Back to glossary</button>
      </div>
    </div>`;
    body.querySelector('[data-glossquiz-retake]').addEventListener('click', () => {
      state.glossaryQuiz.session = null;
      saveProgress();
      startGlossaryQuiz();
    });
    body.querySelector('[data-glossquiz-done]').addEventListener('click', () => {
      state.glossaryQuiz.session = null;
      saveProgress();
      openCramGlossaryModal();
    });
    return;
  }

  const card = sess.queue[sess.index];
  const pct = Math.round(100 * sess.index / sess.queue.length);
  const revealed = sess.picked !== null;
  const isTerm2Def = card.kind === 'term2def';
  const promptText = isTerm2Def ? card.term : card.def;
  const promptSub = isTerm2Def ? 'Pick the definition.' : 'Which term does this define?';

  titleEl.innerHTML = `${dsIcon('target', 15)} Glossary Quiz · ${sess.index + 1}/${sess.queue.length}`;
  subEl.textContent = `Score so far: ${sess.correctCount}/${sess.index}${sess.index ? ` (${Math.round(100*sess.correctCount/sess.index)}%)` : ''}`;

  const optionsHtml = card.options.map((opt, i) => {
    let bg = '#0e0f12', border = '#262930', color = '#eef0f2';
    if (revealed) {
      if (i === card.correctIdx) { bg = '#064e3b'; border = '#34d399'; color = '#d1fae5'; }
      else if (i === sess.picked) { bg = '#7f1d1d'; border = '#f87171'; color = '#fecaca'; }
    }
    const letter = String.fromCharCode(65 + i);
    return `<button data-glossquiz-pick="${i}" ${revealed ? 'disabled' : ''} style="display:flex;gap:10px;align-items:flex-start;text-align:left;width:100%;background:${bg};border:1px solid ${border};border-radius:8px;padding:12px 14px;color:${color};font-size:14px;line-height:1.5;cursor:${revealed ? 'default' : 'pointer'};font-family:inherit;">
      <span style="font-weight:700;color:#ffce5a;font-size:13px;min-width:18px;">${letter}</span>
      <span style="flex:1;">${escapeHtml(opt)}</span>
    </button>`;
  }).join('');

  const feedbackHtml = revealed
    ? `<div style="background:#0e0f12;border-left:3px solid ${sess.picked === card.correctIdx ? '#34d399' : '#f87171'};border-radius:8px;padding:12px 14px;margin-top:12px;font-size:13px;color:#eef0f2;line-height:1.55;">
        <div style="font-size:11px;color:${sess.picked === card.correctIdx ? '#34d399' : '#f87171'};text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:6px;">${sess.picked === card.correctIdx ? dsIcon('check', 14) + ' Correct' : dsIcon('alert', 14) + ' Not quite'}</div>
        <div><strong style="color:#ffce5a;">${escapeHtml(card.term)}</strong> — ${escapeHtml(card.def)}</div>
        ${card.where ? `<div style="font-size:12px;color:#9aa0aa;margin-top:8px;padding-top:8px;border-top:1px solid #262930;"><strong style="color:#6b7079;">Where:</strong> ${escapeHtml(card.where)}</div>` : ''}
      </div>`
    : '';

  body.innerHTML = `<div style="display:flex;flex-direction:column;min-height:280px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
      <button data-glossquiz-back title="Exit quiz" style="background:transparent;border:none;color:#6b7079;font-size:18px;line-height:1;cursor:pointer;padding:0 6px;font-family:inherit;">←</button>
      <div style="flex:1;height:6px;background:#262930;border-radius:3px;overflow:hidden;"><div style="height:100%;background:#ffce5a;width:${pct}%;transition:width .25s;"></div></div>
      <div style="font-size:11px;color:#9aa0aa;font-variant-numeric:tabular-nums;min-width:50px;text-align:right;">${sess.index + 1}/${sess.queue.length}</div>
    </div>
    <div style="font-size:11px;color:#9aa0aa;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">${escapeHtml(promptSub)}</div>
    <div style="font-size:${isTerm2Def ? '22px' : '14px'};font-weight:${isTerm2Def ? '700' : '500'};color:#ffffff;line-height:1.4;margin-bottom:16px;">${escapeHtml(promptText)}</div>
    <div style="display:flex;flex-direction:column;gap:8px;">${optionsHtml}</div>
    ${feedbackHtml}
    ${revealed ? `<div style="margin-top:16px;"><button data-glossquiz-next style="width:100%;padding:12px;border-radius:8px;border:none;background:#34d399;color:#17181c;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">${sess.index + 1 >= sess.queue.length ? 'See results →' : 'Next →'}</button></div>` : ''}
  </div>`;

  body.querySelectorAll('[data-glossquiz-pick]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (sess.picked !== null) return;
      const i = +btn.getAttribute('data-glossquiz-pick');
      const wasCorrect = i === card.correctIdx;
      sess.picked = i;
      if (wasCorrect) sess.correctCount++;
      state.glossaryQuiz.attempts++;
      if (wasCorrect) state.glossaryQuiz.correct++;
      const pt = state.glossaryQuiz.perTerm[card.term] || { seen: 0, correct: 0 };
      pt.seen++;
      if (wasCorrect) pt.correct++;
      state.glossaryQuiz.perTerm[card.term] = pt;
      saveProgress();
      renderGlossaryQuizSession();
    });
  });
  const nextBtn = body.querySelector('[data-glossquiz-next]');
  if (nextBtn) nextBtn.addEventListener('click', () => {
    sess.index++;
    sess.picked = null;
    saveProgress();
    renderGlossaryQuizSession();
  });
  const backBtn = body.querySelector('[data-glossquiz-back]');
  if (backBtn) backBtn.addEventListener('click', () => {
    if (sess.picked === null && sess.index === 0) {
      state.glossaryQuiz.session = null;
      saveProgress();
    }
    openCramGlossaryModal();
  });
}

async function openCramBehaviorModal() {
  await loadCramRefs();
  _openCramRefModal({
    title: dsIcon('mic', 15) + ' Interview Behavior',
    sub: 'The 8-step say-this-in-the-interview ritual.',
    bodyHtml: CRAM_REFS.behavior.map(c => `<div style="background:#0e0f12;border-left:3px solid #ffce5a;border-radius:8px;padding:12px 14px;">
      <div style="font-size:11px;color:#ffce5a;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:4px;">${escapeHtml(c.num)}</div>
      <div style="font-size:14px;font-weight:600;color:#eef0f2;margin-bottom:6px;">${escapeHtml(c.title)}</div>
      <div style="font-size:13px;color:#c4c9cf;line-height:1.55;">${escapeHtml(c.body)}</div>
    </div>`).join('')
  });
}

function openCramShapesModal() {
  const path = getSubscribedPath();
  const reviewedSet = new Set((path && path.lessons) ? path.lessons : []);
  _openCramRefModal({
    title: '〈〉 6 Must-Know Code Shapes',
    sub: 'Each shape is a canonical lesson. Tap to drill.',
    bodyHtml: CRAM_CODE_SHAPES.map(s => {
      const lesson = findLesson(s.lessonId);
      const mastered = window.DrillStorage && window.DrillStorage.isLessonFullyDone(s.lessonId);
      const dotColor = mastered ? '#34d399' : '#4a4f58';
      return `<div style="background:#0e0f12;border:1px solid #262930;border-radius:8px;padding:12px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="width:8px;height:8px;border-radius:50%;background:${dotColor};display:inline-block;flex-shrink:0;"></span>
              <span style="font-size:14px;font-weight:600;color:#eef0f2;">${escapeHtml(s.title)}</span>
            </div>
            <div style="font-size:13px;color:#9aa0aa;margin-top:6px;line-height:1.5;">${escapeHtml(s.note)}</div>
          </div>
          <button data-cram-ref-lesson="${escapeHtml(s.lessonId)}" style="background:#262930;color:#ffce5a;border:none;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:500;font-family:inherit;flex-shrink:0;">${lesson ? 'Drill →' : 'Missing'}</button>
        </div>
      </div>`;
    }).join(''),
    onBody: wireCramRefLessonBtns
  });
}

function wireCramRefLessonBtns() {
  document.querySelectorAll('[data-cram-ref-lesson]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cram-ref-lesson');
      document.getElementById('cram-ref-modal').style.display = 'none';
      selectLesson(id);
    });
  });
}

// Phase 4: Daily Review SR over cram reference content.
const CRAM_SR_INTERVAL_DAYS = [0, 1, 2, 4];           // tier  days until next due
const CRAM_SR_SAMPLE = { glossary: 5, cheat: 4, behavior: 2, code: 3 };

function cramReviewableItems() {
  const out = [];
  if (CRAM_REFS.glossary) {
    for (const g of CRAM_REFS.glossary) {
      out.push({ id: 'g:' + g.term, type: 'glossary', prompt: g.term, answer: g.def, where: g.where });
    }
  }
  if (CRAM_REFS.cheat) {
    for (let i = 0; i < CRAM_REFS.cheat.length; i++) {
      const r = CRAM_REFS.cheat[i];
      out.push({ id: 'p:' + i, type: 'cheat', prompt: r.trigger, answer: r.pattern, lessonId: r.lessonId });
    }
  }
  if (CRAM_REFS.behavior) {
    for (let i = 0; i < CRAM_REFS.behavior.length; i++) {
      const c = CRAM_REFS.behavior[i];
      out.push({ id: 'b:' + i, type: 'behavior', prompt: c.title, answer: c.body, where: c.num });
    }
  }
  for (let i = 0; i < CRAM_CODE_SHAPES.length; i++) {
    const s = CRAM_CODE_SHAPES[i];
    out.push({ id: 's:' + i, type: 'code', prompt: s.title, answer: s.note, lessonId: s.lessonId });
  }
  return out;
}

function cramReviewGet(id) {
  return state.cramReview.items[id] || { familiarity: 0, lastReviewedAt: 0 };
}
function cramReviewSet(id, patch) {
  state.cramReview.items[id] = Object.assign({}, cramReviewGet(id), patch);
}

function cramDueItems() {
  const now = Date.now();
  return cramReviewableItems().filter(it => {
    const r = cramReviewGet(it.id);
    const intervalMs = CRAM_SR_INTERVAL_DAYS[Math.min(r.familiarity, 3)] * 86400000;
    return (now - r.lastReviewedAt) >= intervalMs;
  });
}

function buildCramReviewQueue() {
  const due = cramDueItems();
  const buckets = { glossary: [], cheat: [], behavior: [], code: [] };
  for (const it of due) buckets[it.type].push(it);
  for (const t in buckets) buckets[t].sort(() => Math.random() - 0.5);
  const picked = [];
  for (const t in buckets) picked.push(...buckets[t].slice(0, CRAM_SR_SAMPLE[t] || 0));
  picked.sort(() => Math.random() - 0.5);
  return picked;
}

function updateCramReviewCount() {
  const path = getSubscribedPath();
  const onCram = path && path.kind === 'cram';
  const countEl = document.getElementById('cram-review-count');
  const btn = document.getElementById('cram-review-btn');
  if (!btn || !countEl) return;
  if (!onCram) { countEl.textContent = '0'; return; }
  if (!CRAM_REFS.glossary && !CRAM_REFS.cheat && !CRAM_REFS.behavior) {
    countEl.textContent = '?';
    loadCramRefs().then(() => updateCramReviewCount());
    return;
  }
  countEl.textContent = String(cramDueItems().length);
}

async function openCramReviewModal() {
  await loadCramRefs();
  if (!state.cramReview.session) {
    const queue = buildCramReviewQueue();
    if (!queue.length) {
      _openCramRefModal({
        title: dsIcon('refresh', 15) + ' Cram Review · all caught up',
        sub: 'No items due right now. Items resurface as their interval lapses (0 → 1 → 2 → 4 days).',
        bodyHtml: `<div style="text-align:center;padding:24px;color:#9aa0aa;font-size:13px;">${dsIcon('check', 14)} Nothing due — come back tomorrow.</div>`
      });
      return;
    }
    state.cramReview.session = { queue, index: 0, revealed: false, gotIt: 0, fuzzy: 0 };
    saveProgress();
  }
  renderCramReviewSession();
}

function renderCramReviewSession() {
  const sess = state.cramReview.session;
  const modal = document.getElementById('cram-ref-modal');
  const titleEl = document.getElementById('cram-ref-title');
  const subEl = document.getElementById('cram-ref-sub');
  const search = document.getElementById('cram-ref-search');
  const body = document.getElementById('cram-ref-body');
  if (!modal || !sess) return;
  if (search) { search.hidden = true; search.value = ''; }
  modal.style.display = 'block';

  if (sess.index >= sess.queue.length) {
    const total = sess.gotIt + sess.fuzzy;
    const pct = total ? Math.round(100 * sess.gotIt / total) : 0;
    titleEl.innerHTML = dsIcon('refresh', 15) + ' Cram Review · session done';
    subEl.textContent = 'Fuzzy items resurface tomorrow. Got-it items advance one tier (1 → 2 → 4 days).';
    body.innerHTML = `<div style="text-align:center;padding:30px 12px;">
      <div style="font-size:48px;font-weight:700;color:#34d399;font-variant-numeric:tabular-nums;line-height:1;">${pct}%</div>
      <div style="color:#9aa0aa;font-size:14px;margin-top:6px;">recalled</div>
      <div style="display:flex;justify-content:center;gap:18px;margin:18px 0;">
        <div style="text-align:center;"><div style="font-size:22px;color:#34d399;font-weight:600;">${sess.gotIt}</div><div style="font-size:11px;color:#9aa0aa;text-transform:uppercase;letter-spacing:0.05em;">got it</div></div>
        <div style="text-align:center;"><div style="font-size:22px;color:#f87171;font-weight:600;">${sess.fuzzy}</div><div style="font-size:11px;color:#9aa0aa;text-transform:uppercase;letter-spacing:0.05em;">fuzzy</div></div>
        <div style="text-align:center;"><div style="font-size:22px;font-weight:600;">${sess.queue.length}</div><div style="font-size:11px;color:#9aa0aa;text-transform:uppercase;letter-spacing:0.05em;">total</div></div>
      </div>
      <button data-cram-review-done style="background:#34d399;color:#17181c;border:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Done</button>
    </div>`;
    body.querySelector('[data-cram-review-done]').addEventListener('click', () => {
      state.cramReview.session = null;
      saveProgress();
      updateCramReviewCount();
      modal.style.display = 'none';
    });
    return;
  }

  const it = sess.queue[sess.index];
  const pct = Math.round(100 * sess.index / sess.queue.length);
  const fam = cramReviewGet(it.id).familiarity;
  const tierLabel = fam === 0 ? 'new' : `tier ${fam}`;
  const typeLabel = ({ glossary: 'Glossary', cheat: 'Pattern trigger', behavior: 'Interview behavior', code: 'Code shape' })[it.type] || it.type;

  titleEl.innerHTML = `${dsIcon('refresh', 15)} Cram Review · ${sess.index + 1}/${sess.queue.length}`;
  subEl.textContent = `${typeLabel} · ${tierLabel}`;

  const promptSub = ({
    glossary: 'Define this term in 1 sentence + name one place it shows up.',
    cheat: "What's the first pattern you'd reach for?",
    code: "Can you write this from memory? (Picture the code in your head before peeking.)",
    behavior: "Why does this step matter in an interview?"
  })[it.type] || '';

  const answerHtml = sess.revealed
    ? `<div style="background:#0e0f12;border-left:3px solid #34d399;border-radius:8px;padding:14px;margin:12px 0;font-size:14px;color:#eef0f2;line-height:1.6;">
        <div style="font-size:11px;color:#34d399;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:6px;">Answer</div>
        ${escapeHtml(it.answer)}
        ${it.where ? `<div style="font-size:12px;color:#9aa0aa;margin-top:8px;padding-top:8px;border-top:1px solid #262930;">${escapeHtml(it.where)}</div>` : ''}
        ${it.lessonId ? `<div style="margin-top:10px;"><button data-cram-review-open="${escapeHtml(it.lessonId)}" style="background:#262930;color:#ffce5a;border:none;border-radius:5px;padding:4px 12px;font-size:11px;cursor:pointer;font-weight:500;font-family:inherit;">Open the lesson →</button></div>` : ''}
      </div>`
    : '';

  body.innerHTML = `<div style="display:flex;flex-direction:column;min-height:280px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
      <div style="flex:1;height:6px;background:#262930;border-radius:3px;overflow:hidden;"><div style="height:100%;background:#ffce5a;width:${pct}%;transition:width .25s;"></div></div>
      <div style="font-size:11px;color:#9aa0aa;font-variant-numeric:tabular-nums;min-width:50px;text-align:right;">${sess.index + 1}/${sess.queue.length}</div>
    </div>
    <div style="font-size:17px;font-weight:600;color:#ffffff;line-height:1.4;margin-bottom:10px;">${escapeHtml(it.prompt)}</div>
    ${promptSub ? `<div style="font-size:12px;color:#9aa0aa;margin-bottom:12px;line-height:1.5;">${escapeHtml(promptSub)}</div>` : ''}
    ${answerHtml}
    <div style="margin-top:auto;padding-top:18px;display:flex;gap:10px;flex-wrap:wrap;">
      ${!sess.revealed
        ? `<button data-cram-review-peek style="flex:1;min-width:140px;padding:12px;border-radius:8px;border:none;background:#262930;color:#eef0f2;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Peek</button>`
        : `<button data-cram-review-fuzzy style="flex:1;min-width:120px;padding:12px;border-radius:8px;border:none;background:#7f1d1d;color:#fecaca;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Fuzzy ✗</button>
           <button data-cram-review-gotit style="flex:1;min-width:120px;padding:12px;border-radius:8px;border:none;background:#34d399;color:#17181c;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Got it ✓</button>`}
    </div>
  </div>`;

  const peek = body.querySelector('[data-cram-review-peek]');
  if (peek) peek.addEventListener('click', () => {
    state.cramReview.session.revealed = true;
    saveProgress();
    renderCramReviewSession();
  });
  const fuzzy = body.querySelector('[data-cram-review-fuzzy]');
  if (fuzzy) fuzzy.addEventListener('click', () => _gradeCramReview(false));
  const got = body.querySelector('[data-cram-review-gotit]');
  if (got) got.addEventListener('click', () => _gradeCramReview(true));
  const openLessonBtn = body.querySelector('[data-cram-review-open]');
  if (openLessonBtn) openLessonBtn.addEventListener('click', () => {
    const id = openLessonBtn.getAttribute('data-cram-review-open');
    modal.style.display = 'none';
    selectLesson(id);
  });
}

function _gradeCramReview(gotIt) {
  const sess = state.cramReview.session;
  if (!sess) return;
  const it = sess.queue[sess.index];
  const prev = cramReviewGet(it.id);
  const nextFam = gotIt ? Math.min(3, prev.familiarity + 1) : 0;
  cramReviewSet(it.id, { familiarity: nextFam, lastReviewedAt: Date.now() });
  if (gotIt) sess.gotIt++; else sess.fuzzy++;
  sess.index++;
  sess.revealed = false;
  saveProgress();
  updateCramReviewCount();
  renderCramReviewSession();
}

function updatePathChip() {
  const label = document.getElementById('path-chip-label');
  if (label) label.textContent = getSubscribedPath().label;
}

// Buttons that should only ever surface when a cram-kind path is active.
// On no-path / Starter / any path without sidebarButtons[], these stay hidden
// EVERYWHERE — sidebar, topbar dropdowns, and the ⌘K palette — because they
// have no meaningful action without a cram context. Mechanism: inline
// style.display:none, which _topbarItemFromButton filters out.
const CRAM_ONLY_BUTTON_IDS = new Set([
  'cram-cheat-btn', 'cram-glossary-btn', 'cram-behavior-btn',
  'cram-shapes-btn', 'cram-review-btn'
]);

// Plan-based sidebar curation. Two distinct hide mechanisms, by design:
//
//   • .sidebar-curation-hidden (CSS class) — PLAN UX-FOCUS hide. Applied to
//     buttons NOT in a curated path's `sidebarButtons[]` allowlist. The
//     button is still ACTIONABLE: it stays available in the topbar Drill /
// Train / Reflect menus and the ⌘K palette, because activities are
//     *modality* (how you recall), not *corpus* (which lessons). A plan
//     should narrow the lesson corpus, not gate the recall directions.
//
//   • inline style.display:none — CONTEXT/CAPABILITY hide. Used for
//     CRAM_ONLY_BUTTON_IDS (no cram active) and capability gates (e.g.
//     #haptic-btn on iOS Safari where navigator.vibrate is absent). The
//     button can't usefully act, so it disappears from every surface.
//     _topbarItemFromButton's `btn.style.display === 'none'` check filters
//     these from the topbar — that is the load-bearing reason this branch
//     keeps using inline style instead of the class.
//
// Background (2026-05-27): the topbar Drill and Train menus silently went
// empty on the prep-4day cram because every drill/train button was hidden
// by the curation allowlist via inline display:none, which the topbar
// reader read as "permanently unavailable." Splitting the two mechanisms
// (class for plan-curation, inline-style for context-gating) decouples
// sidebar UX-focus from topbar/palette discoverability without altering
// the sidebar's visual result.
function applySidebarCuration() {
  const path = getSubscribedPath();
  const list = path && Array.isArray(path.sidebarButtons) ? path.sidebarButtons : null;
  const candidates = document.querySelectorAll('[id$="-btn"], #streak-display');
  if (!list) {
    // No allowlist: cram-only buttons hide everywhere (context-gated);
    // everything else is fully visible.
    candidates.forEach(el => {
      el.classList.remove('sidebar-curation-hidden');
      if (CRAM_ONLY_BUTTON_IDS.has(el.id)) el.style.display = 'none';
      else el.style.removeProperty('display');
    });
    return;
  }
  // Allowlist present: listed buttons show; everything else gets the
  // SIDEBAR-ONLY hide. Inline style.display is deliberately not touched
  // here — capability hides own that channel.
  const set = new Set(list);
  candidates.forEach(el => {
    if (set.has(el.id)) el.classList.remove('sidebar-curation-hidden');
    else el.classList.add('sidebar-curation-hidden');
  });
}

// Top-bar cram progress strip: "Day N · ▓▓▓░░ · X/Y". Visible only when the
// subscribed path is kind:'cram' AND the cycle is still active. Tap routes
// to the cram home view (Phase 2 takes over when subscribed; for now opens
// the Today modal).
function updateCramProgressStrip() {
  const wrap = document.getElementById('topbar-cram-progress');
  if (!wrap) return;
  const path = getSubscribedPath();
  if (!path || path.kind !== 'cram') { wrap.hidden = true; return; }
  const dayIdx = getCramDayIndex(path);
  if (dayIdx < 0) { wrap.hidden = true; return; }
  const day = path.days[dayIdx];
  let total = 0, done = 0;
  for (const b of day.blocks) for (const t of b.tasks) { total++; if (isCramTaskDone(t)) done++; }
  const pct = total ? Math.round(100 * done / total) : 0;
  const dayEl = document.getElementById('topbar-cram-day');
  const barEl = document.getElementById('topbar-cram-bar');
  const countEl = document.getElementById('topbar-cram-count');
  if (dayEl) dayEl.innerHTML = `${dsIcon('clock', 15)} Day ${dayIdx + 1}/${path.days.length}`;
  if (barEl) barEl.style.width = pct + '%';
  if (countEl) countEl.textContent = `${done}/${total}`;
  wrap.hidden = false;
}

function openPathModal(opts = {}) {
  const modal = document.getElementById('path-modal');
  const body = document.getElementById('path-body');
  if (!modal || !body) return;
  const welcome = !!opts.welcome;
  const heading = modal.querySelector('h2');
  if (heading) heading.innerHTML = welcome ? dsIcon('home', 15) + ' Welcome to JS Drill' : 'Study plan';
  const sub = modal.querySelector('[data-path-sub]');
  if (sub) {
    // iter 43 (refine): welcome subhead drops the corpus-stat first
    // sentence ("N lessons across syntax, interview patterns, and applied
    // problems.") — it's decision-time stats the user doesn't need at the
    // moment of picking, and on mobile 375x667 it pushed the recommended
    // banner + cards + secondary CTAs further below the fold.
    sub.textContent = welcome
      ? `Pick a plan that fits your situation — you can switch any time.`
      : `Pick the plan that drives your Today's Plan button. Switching is safe — your lesson progress is shared across every plan.`;
  }
  const currentId = state.subscribedPathId;
  // On welcome, mark the Starter Plan as the recommended default so a first-
  // time ADHD user has an obvious one-tap entry instead of comparing 3 blurbs
  // (PROFILE.md § Cognitive style — "Default actions matter more than option
  // exhaustiveness — pick something reasonable, let them override").
  const recommendedId = welcome ? 'starter' : null;
  const cardsHtml = PATHS.map(p => {
    const active = !welcome && p.id === currentId;
    const recommended = !active && p.id === recommendedId;
    const border = active ? '#34d399' : recommended ? '#34d399' : '#262930';
    const bg = active ? 'rgba(52,211,153,0.08)' : recommended ? 'rgba(52,211,153,0.06)' : '#0e0f12';
    const tag = active
      ? `<span style="color:#34d399;font-size:13px;">● Current</span>`
      : (welcome
          ? `<span style="color:#6b7079;font-size:13px;">Pick →</span>`
          : `<span style="color:#6b7079;font-size:13px;">Switch →</span>`);
    const recommendedBanner = recommended
      ? `<span data-recommended style="display:inline-block;align-self:flex-start;color:#34d399;background:rgba(52,211,153,0.14);font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;padding:3px 8px;border-radius:999px;">${dsIcon('sparkles', 15)} Recommended — most users start here</span>`
      : '';
    // iter 23: promote the blurb's lead sentence to a brighter weight so the
    // ADHD/phone user scans 3 differentiated lines instead of 3 paragraphs.
    // First "." (or "?"/"!") followed by whitespace is the boundary; if no
    // boundary exists the whole blurb stays in the muted tail (no lead).
    const blurb = p.blurb || '';
    const splitIdx = (() => { const m = blurb.match(/[.!?]\s+/); return m ? m.index + m[0].length : -1; })();
    const lead = splitIdx > 0 ? blurb.slice(0, splitIdx).trim() : '';
    const tail = splitIdx > 0 ? blurb.slice(splitIdx).trim() : blurb;
    const blurbHtml = lead
      ? `<span data-blurb-lead style="color:#c4c9cf;font-size:12px;font-weight:500;line-height:1.5;">${escapeHtml(lead)}</span>
         <span style="color:#9aa0aa;font-size:12px;line-height:1.5;">${escapeHtml(tail)}</span>`
      : `<span style="color:#9aa0aa;font-size:12px;line-height:1.5;">${escapeHtml(blurb)}</span>`;
    return `<button data-path-id="${escapeHtml(p.id)}" style="text-align:left;padding:14px 16px;border-radius:8px;background:${bg};border:1px solid ${border};color:#eef0f2;cursor:pointer;display:flex;flex-direction:column;gap:6px;">
      ${recommendedBanner}
      <span style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <span style="font-weight:600;font-size:14px;display:inline-flex;align-items:center;gap:6px;">${p.icon ? dsIcon(p.icon, 15) : ''}${escapeHtml(p.label)}</span>
        ${tag}
      </span>
      ${blurbHtml}
    </button>`;
  }).join('');
  const footerHtml = welcome
    ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid #262930;display:flex;flex-direction:column;gap:8px;">
        <a href="diagnostic.html" style="color:#ffce5a;font-size:12px;text-decoration:none;">${dsIcon('gauge', 15)} Or start with a 43-question diagnostic →</a>
        <button data-action="browse-on-own" style="background:none;border:none;color:#6b7079;font-size:12px;cursor:pointer;text-align:left;padding:0;">Browse on my own (no path)</button>
      </div>`
    : '';
  body.innerHTML = cardsHtml + footerHtml;
  body.querySelectorAll('[data-path-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const prevPathId = state.subscribedPathId;
      const newPathId = btn.getAttribute('data-path-id');
      state.subscribedPathId = newPathId;
      _invalidateStarterPathCache();
      if (!subscribedPathHasLessons()) state.starterPath = false;
      if (welcome) state.welcomed = true;
      // Picking a cram path is a *focus-mode switch*, not just a Today's Plan
      // re-target: drop the user on Cram Home so the new shell is visible.
      // Stale currentLessonId would otherwise keep them on a lesson with a
      // tiny topbar strip as the only cue that anything changed.
      const newPath = getSubscribedPath();
      if (newPath && newPath.kind === 'cram' && newPathId !== prevPathId) {
        state.currentLessonId = null;
        state.cramView = { mode: 'today', dayIndex: -1 };
      }
      saveProgress();
      updatePathChip();
      applySidebarCuration();
      updateCramProgressStrip();
      if (typeof updateCramReviewCount === 'function') updateCramReviewCount();
      modal.style.display = 'none';
      if (typeof renderSidebar === 'function') renderSidebar();
      if (typeof renderLesson === 'function') renderLesson();
    });
  });
  const browse = body.querySelector('[data-action="browse-on-own"]');
  if (browse) browse.addEventListener('click', () => {
    state.welcomed = true;
    saveProgress();
    modal.style.display = 'none';
    if (typeof renderLesson === 'function') renderLesson();
  });
  modal.style.display = 'block';
}

// Spaced-repetition intervals (in ms). Each pass advances to the next bucket.
const REVIEW_INTERVALS = [
  1  * 24 * 60 * 60 * 1000,   // 1 day  (after first mastery)
  3  * 24 * 60 * 60 * 1000,   // 3 days
  7  * 24 * 60 * 60 * 1000,   // 1 week
  14 * 24 * 60 * 60 * 1000,   // 2 weeks
  30 * 24 * 60 * 60 * 1000    // 1 month (max — re-pass holds at 30d)
];

// iter 125: STARTER_PATH and PREP_4DAY_PATH lesson sequences moved to
// data/paths.json (the `lessons` field of each path entry). Loaded into the
// PATHS registry by loadPaths() on boot. Adding a new path is now a pure-data
// change: append an entry to data/paths.json.
//
// Source-of-truth note for the prep path: prep.html's PLAN (each item's
// `lesson.id`) remains canonical. tools/validate-data.js re-extracts those
// ids and fails if data/paths.json's prep-4day.lessons drifts from prep.html.

// The Plan View sidebar filter scopes the sidebar to the *subscribed* path's
// drill-lesson sequence (getPathLessonOrder), then applies the per-track
// sub-filter (`state.starterPathTrack`) so a user can drill Syntax-only or
// Patterns-only without track-mixing distraction. Cache is keyed by
// subscribedPathId + track and invalidated on either change.
// iter 39: per-track sub-filter. Unified across paths: see PATHS registry.
let _activeStarterPathCache = null;
let _activeStarterPathCacheKey = null;
