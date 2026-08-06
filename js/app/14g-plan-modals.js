// ──────────────────────────────────────────────────────────────────────────
//  TODAY'S PLAN MODAL — daily plan view, cram-day routing, topbar progress click
// ──────────────────────────────────────────────────────────────────────────
function initTodaysPlanModal() {
  // Today's plan modal
  const todayModal = document.getElementById('today-modal');
  function openToday() {
    const plan = dailyPlan();
    const body = document.getElementById('today-body');
    if (!plan.length) {
      body.innerHTML = `<div style="color:#9aa0aa;text-align:center;padding:24px 0;">Nothing queued — you're caught up.<br><br>Pick a lesson from the sidebar or try Mock Interview.</div>`;
    } else {
      // Iter 10: PRIMARY autopilot CTA. Surfaces the smartest pick (plan[0]
      // — dailyPlan ranks SR-due first, then weak, then path) as a single
      // emerald button above the 6-card list. PROFILE.md line 76-78 ("press
      // one thing → drilling") + line 48-50 (ADHD single-focus surfaces) +
      // line 53-54 ("Default actions matter more than option exhaustiveness").
      const first = plan[0];
      const firstLesson = findLesson(first.id);
      const firstTitle = firstLesson?.title || first.id;
      // iter 22: inventory of today's session — converts the modal from
      // "unknown queue" to "named bundle" for the ADHD/phone user. Counts
      // are derived from plan[].why; only renders when ≥2 buckets are active
      // (a single-bucket plan's CTA tag already tells the story). Colors
      // match the per-card why-tag pills below for cross-visual consistency.
      const whyCounts = plan.reduce((acc, p) => { acc[p.why] = (acc[p.why] || 0) + 1; return acc; }, {});
      const invParts = [];
      if (whyCounts['review due']) invParts.push(`<span style="color:#ffce5a;">${whyCounts['review due']} due</span>`);
      if (whyCounts['weak spot'])  invParts.push(`<span style="color:#fdba74;">${whyCounts['weak spot']} weak</span>`);
      if (whyCounts['next on plan']) invParts.push(`<span style="color:#ffce5a;">${whyCounts['next on plan']} on path</span>`);
      const inventoryHtml = invParts.length >= 2
        ? `<div data-today-inventory style="display:flex;justify-content:center;gap:10px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;margin:-8px 0 10px;color:#9aa0aa;">${invParts.join(`<span style="color:#4a4f58;">·</span>`)}</div>`
        : '';
      const primaryCta = `
        <button data-action="start-first" data-lesson-id="${escapeHtml(first.id)}" style="text-align:left;width:100%;padding:14px 16px;border-radius:8px;background:rgba(52,211,153,0.14);border:1px solid rgba(52,211,153,0.55);color:#ecfdf5;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;font-family:inherit;margin-bottom:14px;">
          <span style="display:flex;flex-direction:column;gap:3px;min-width:0;">
            <span style="font-size:11px;color:#34d399;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">${dsIcon('target', 15)} Start</span>
            <span style="font-size:15px;font-weight:600;color:#f0fdf4;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(firstTitle)}</span>
            <span style="font-size:11px;color:#86efac;">${escapeHtml(first.why)}</span>
          </span>
          <span style="color:#34d399;font-size:18px;flex-shrink:0;">➜</span>
        </button>
        ${inventoryHtml}
        <div style="font-size:10px;color:#4a4f58;text-transform:uppercase;letter-spacing:0.08em;text-align:center;margin:0 0 8px;">— Or pick another —</div>
      `;
      // iter 42 (refine): start the "OR PICK ANOTHER" list at plan[1] —
      // plan[0] is already represented by the green START CTA above, so
      // listing it again created a working-memory duplicate ("same lesson
      // appears twice"). Inventory counts (computed from full plan above)
      // are unchanged; click-handlers still wire to data-lesson-id.
      body.innerHTML = primaryCta + plan.slice(1).map(({ id, why }) => {
        const lesson = findLesson(id);
        const colors = { 'review due': '#ffce5a', 'next on plan': '#ffce5a', 'weak spot': '#fdba74' };
        const tint =   { 'review due': 'rgba(255,206,90,0.12)', 'next on plan': 'rgba(255,206,90,0.12)', 'weak spot': 'rgba(253,186,116,0.14)' };
        const tagColor = colors[why] || '#9aa0aa';
        const tagBg = tint[why] || 'rgba(154,160,170,0.10)';
        // Stack title + why-tag vertically so the tag stays visible on mobile —
        // the prior `flex justify-between` row clipped long titles' tags off
        // the right edge on 375px viewports (PROFILE-stated 80% phone use).
        return `<button data-lesson-id="${escapeHtml(id)}" data-why="${escapeHtml(why)}" style="text-align:left; padding:12px 14px; border-radius:8px; background:#262930; border:1px solid #363a43; color:#eef0f2; cursor:pointer; display:flex; flex-direction:column; align-items:stretch; gap:6px;">
          <span style="display:block;"><span style="color:#9aa0aa; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; margin-right:8px;">${escapeHtml((TRACK_PILLS[lesson?.track] || TRACK_PILLS.patterns).label)}</span>${escapeHtml(lesson?.title || id)}</span>
          <span data-why-tag style="align-self:flex-start; color:${tagColor}; background:${tagBg}; font-size:11px; font-weight:500; padding:2px 8px; border-radius:999px; letter-spacing:0.01em;">${escapeHtml(why)}</span>
        </button>`;
      }).join('');
      // Iter 10: PRIMARY autopilot CTA click handler. The same data-lesson-id
      // selector catches BOTH the primary [data-action="start-first"] button
      // AND the existing 6-card list — both have data-lesson-id, so the
      // single forEach below wires them all.
      body.querySelectorAll('[data-lesson-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-lesson-id');
          todayModal.style.display = 'none';
          selectLesson(id);
        });
      });
    }
    todayModal.style.display = 'block';
  }
  function openCramToday(path) {
    const dayIdx = getCramDayIndex(path);
    if (dayIdx < 0) { openToday(); return; }
    const day = path.days[dayIdx];
    const totalDays = path.days.length;
    const heading = document.getElementById('today-heading');
    const sub = document.getElementById('today-sub');
    const body = document.getElementById('today-body');
    if (heading) heading.innerHTML = `${dsIcon('clock', 15)} Day ${dayIdx + 1} of ${totalDays} — ${day.title}`;
    if (sub) sub.textContent = `${day.date}. Tasks auto-tick when you master the linked lesson. Earlier-day lessons resurface below as SR comes due.`;

    let totalTasks = 0, doneTasks = 0;
    for (const b of day.blocks) for (const t of b.tasks) { totalTasks++; if (isCramTaskDone(t)) doneTasks++; }
    const pct = totalTasks ? Math.round(100 * doneTasks / totalTasks) : 0;

    const blocksHtml = day.blocks.map(block => {
      const blockDone = block.tasks.filter(isCramTaskDone).length;
      const blockTotal = block.tasks.length;
      const blockComplete = blockDone === blockTotal && blockTotal > 0;
      const tasksHtml = block.tasks.map(t => {
        const done = isCramTaskDone(t);
        const lesson = t.lessonId ? findLesson(t.lessonId) : null;
        const lessonTitle = lesson ? lesson.title : '';
        const minsBadge = t.mins != null ? `<span style="font-size:11px;color:#6b7079;">~${t.mins} min</span>` : '';
        const checkAttr = t.lessonId ? 'disabled' : '';
        const checkTitle = t.lessonId ? 'Ticks automatically when you master the linked lesson' : 'Tap to mark done';
        const lessonBtn = t.lessonId
          ? `<button data-cram-open="${escapeHtml(t.lessonId)}" style="background:#262930;color:#ffce5a;border:none;border-radius:5px;padding:3px 9px;font-size:11px;cursor:pointer;font-weight:500;">Open →</button>`
          : '';
        const lessonBadge = lessonTitle ? `: <strong style="color:#eef0f2;">${escapeHtml(lessonTitle)}</strong>` : '';
        return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-top:1px solid #262930;${done ? 'opacity:0.55;' : ''}">
          <input type="checkbox" data-cram-check="${escapeHtml(t.id)}" ${done ? 'checked' : ''} ${checkAttr} title="${escapeHtml(checkTitle)}" style="margin-top:3px;cursor:${t.lessonId ? 'default' : 'pointer'};" />
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;line-height:1.5;color:#c4c9cf;${done ? 'text-decoration:line-through;' : ''}">${escapeHtml(t.label)}${lessonBadge}</div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap;">${minsBadge}${lessonBtn}</div>
          </div>
        </div>`;
      }).join('');
      return `<details ${blockComplete ? '' : 'open'} style="background:#0e0f12;border:1px solid #262930;border-radius:8px;margin-bottom:8px;">
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

    const dueIds = dueReviewIds().slice(0, 6);
    const cramLessonSet = new Set(path.lessons || []);
    const reviewIds = dueIds.filter(id => cramLessonSet.has(id));
    const reviewHtml = reviewIds.length
      ? `<div style="margin-top:14px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#ffce5a;font-weight:600;margin-bottom:8px;">Review from earlier days · ${reviewIds.length} due</div>
          ${reviewIds.map(id => {
            const l = findLesson(id);
            return `<button data-cram-open="${escapeHtml(id)}" style="text-align:left;padding:10px 12px;border-radius:6px;background:#0e0f12;border:1px solid #262930;color:#eef0f2;cursor:pointer;display:flex;justify-content:space-between;align-items:center;width:100%;margin-bottom:6px;font-family:inherit;">
              <span style="font-size:13px;">${escapeHtml(l?.title || id)}</span>
              <span style="color:#ffce5a;font-size:11px;">SR due</span>
            </button>`;
          }).join('')}
        </div>`
      : '';

    const weakId = (typeof topWeakLessonId === 'function') ? topWeakLessonId() : null;
    const weakHtml = (weakId && !reviewIds.includes(weakId))
      ? (() => { const l = findLesson(weakId); return `<div style="margin-top:14px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#fdba74;font-weight:600;margin-bottom:8px;">Weak spot</div>
          <button data-cram-open="${escapeHtml(weakId)}" style="text-align:left;padding:10px 12px;border-radius:6px;background:#0e0f12;border:1px solid #262930;color:#eef0f2;cursor:pointer;display:flex;justify-content:space-between;align-items:center;width:100%;font-family:inherit;">
            <span style="font-size:13px;">${escapeHtml(l?.title || weakId)}</span>
            <span style="color:#fdba74;font-size:11px;">L1 miss</span>
          </button>
        </div>`; })()
      : '';

    const checkpointsHtml = (day.checkpoints && day.checkpoints.length)
      ? `<div style="margin-top:14px;background:#0e0f12;border-left:3px solid #34d399;border-radius:8px;padding:12px 14px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#34d399;font-weight:600;margin-bottom:6px;">End-of-day checkpoints</div>
          <ul style="margin:0;padding-left:18px;color:#9aa0aa;font-size:13px;line-height:1.5;">${day.checkpoints.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
        </div>`
      : '';

    body.innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="flex:1;height:8px;background:#262930;border-radius:4px;overflow:hidden;"><div style="height:100%;background:linear-gradient(90deg,#f5b62b,#34d399);width:${pct}%;border-radius:4px;"></div></div>
        <div style="font-size:12px;color:#9aa0aa;font-variant-numeric:tabular-nums;min-width:60px;text-align:right;">${doneTasks}/${totalTasks} · ${pct}%</div>
      </div>
      ${blocksHtml}
      ${reviewHtml}
      ${weakHtml}
      ${checkpointsHtml}`;

    body.querySelectorAll('[data-cram-check]').forEach(cb => {
      cb.addEventListener('click', (e) => {
        const id = cb.getAttribute('data-cram-check');
        if (cb.disabled) { e.preventDefault(); return; }
        if (cb.checked) state.cramTaskChecks[id] = true;
        else delete state.cramTaskChecks[id];
        saveProgress();
        openCramToday(path);
      });
    });
    body.querySelectorAll('[data-cram-open]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cram-open');
        todayModal.style.display = 'none';
        selectLesson(id);
      });
    });
    todayModal.style.display = 'block';
  }

  // Today's Plan routes by the subscribed study plan. A 'cram' path navigates
  // to the full Cram Home view (Phase 2); any other kind opens the modal.
  function openTodaysPlan() {
    const path = getSubscribedPath();
    if (path && path.kind === 'cram') {
      state.cramView = { mode: 'today', dayIndex: -1 };
      goToCramHome();
      return;
    }
    const heading = document.getElementById('today-heading');
    const sub = document.getElementById('today-sub');
    if (heading) heading.innerHTML = `${dsIcon('calendar-check', 15)} Today's session`;
    if (sub) sub.textContent = `Curated from your due reviews, starter path, and weak spots. Click any item to start.`;
    openToday();
  }
  document.getElementById('today-btn').addEventListener('click', openTodaysPlan);
  document.getElementById('today-close').addEventListener('click', () => todayModal.style.display = 'none');
  todayModal.addEventListener('click', (e) => {
    if (e.target === todayModal) todayModal.style.display = 'none';
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  PATH SWITCHER + CRAM REFS — path modal, sidebar curation, cram reference
//  modals (Cheat/Glossary/Behavior/Shapes/Review)
// ──────────────────────────────────────────────────────────────────────────
function initPathSwitcher() {
  // Path switcher — sidebar chip opens the modal; picking a path is handled
  // inside openPathModal (sets subscription, saves, updates chip, closes).
  const pathModal = document.getElementById('path-modal');
  document.getElementById('path-chip').addEventListener('click', openPathModal);
  // audit F9: dismissing with the × has to COUNT as being welcomed. It used to
  // only hide the modal, leaving state.welcomed false — so for any user with
  // zero progress the picker re-opened on the next renderLesson, i.e. on every
  // lesson they navigated to until they picked a plan. Only "Pick" and "Browse
  // on my own" ever cleared it. Declining is an answer; persist it.
  document.getElementById('path-close').addEventListener('click', () => {
    pathModal.style.display = 'none';
    if (!state.welcomed) { state.welcomed = true; saveProgress(); }
  });
  pathModal.addEventListener('click', (e) => {
    if (e.target === pathModal) pathModal.style.display = 'none';
  });
  updatePathChip();
  applySidebarCuration();

  // Phase 3 — cram reference modals
  const cramRefModal = document.getElementById('cram-ref-modal');
  document.getElementById('cram-cheat-btn')?.addEventListener('click', openCramCheatModal);
  document.getElementById('cram-glossary-btn')?.addEventListener('click', openCramGlossaryModal);
  document.getElementById('cram-behavior-btn')?.addEventListener('click', openCramBehaviorModal);
  document.getElementById('cram-shapes-btn')?.addEventListener('click', openCramShapesModal);
  document.getElementById('cram-review-btn')?.addEventListener('click', openCramReviewModal);
  document.getElementById('cram-ref-close')?.addEventListener('click', () => cramRefModal.style.display = 'none');
  cramRefModal?.addEventListener('click', (e) => { if (e.target === cramRefModal) cramRefModal.style.display = 'none'; });
  updateCramReviewCount();
}

// ──────────────────────────────────────────────────────────────────────────
//  MECHANICS MODAL WIRING — open/close/back + list/matrix view toggles
// ──────────────────────────────────────────────────────────────────────────
function initMechanicsWiring() {
  // Mechanics modal — cross-cutting drill surface
  const mechanicsModal = document.getElementById('mechanics-modal');
  document.getElementById('mechanics-btn').addEventListener('click', openMechanicsModal);
  document.getElementById('mechanics-close').addEventListener('click', closeMechanicsModal);
  document.getElementById('mechanics-back').addEventListener('click', () => {
    // iter 63: back button returns to whichever non-detail view was active
    // when the user dove into detail. Default 'list' for legacy users who
    // never visited matrix view.
    _mechanicsView = _mechanicsPrevView || 'list';
    _mechanicsSelectedId = null;
    renderMechanicsModal();
  });
  // iter 63: View-toggle handlers (List ↔ Matrix). Both also reset detail state
  // so a stale _mechanicsSelectedId doesn't leak between switches.
  document.getElementById('mechanics-view-list').addEventListener('click', () => {
    _mechanicsView = 'list';
    _mechanicsPrevView = 'list';
    _mechanicsSelectedId = null;
    renderMechanicsModal();
  });
  document.getElementById('mechanics-view-matrix').addEventListener('click', () => {
    _mechanicsView = 'matrix';
    _mechanicsPrevView = 'matrix';
    _mechanicsSelectedId = null;
    renderMechanicsModal();
  });
  mechanicsModal.addEventListener('click', (e) => {
    if (e.target === mechanicsModal) closeMechanicsModal();
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  HELP MODAL — close + backdrop (open is in the `?` keydown handler)
// ──────────────────────────────────────────────────────────────────────────
function initHelpModal() {
  // Help modal close (open is wired in the keydown handler with `?`)
  const helpModal = document.getElementById('help-modal');
  document.getElementById('help-close').addEventListener('click', () => helpModal.style.display = 'none');
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.style.display = 'none';
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  BACKUP / RESTORE — JSON download + file-input replace
// ──────────────────────────────────────────────────────────────────────────
function initBackupRestore() {
  // Backup — JSON download of all progress / reviews / bestTimes.
  // Read through DrillStorage (the storage contract), not raw localStorage.
  document.getElementById('backup-btn').addEventListener('click', () => {
    const parsed = window.DrillStorage ? window.DrillStorage.loadAppProgress() : null;
    const raw = parsed ? JSON.stringify(parsed) : JSON.stringify({ __v: 6, progress: state.progress });
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `js-drill-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Restore — read a JSON backup and replace localStorage
  document.getElementById('restore-btn').addEventListener('click', () => {
    document.getElementById('restore-input').click();
  });
  document.getElementById('restore-input').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        // Sanity-check the shape before writing
        if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid backup shape');
        if (!confirm('Restore this backup? Your current progress will be replaced.')) return;
        // Write through DrillStorage so the storage-written event fires (a raw
        // setItem bypassed sync entirely — the restored blob never pushed, and
        // the post-reload pull-merge half-undid the rollback).
        //
        // There is deliberately no raw-setItem fallback. One used to sit here,
        // and it did the exact thing the paragraph above says breaks a restore.
        // A silent half-restore is worse than a refusal, because the user walks
        // away believing their rollback took.
        if (!window.DrillStorage) {
          alert('Restore unavailable: the storage layer failed to load. Reload the page and try again.');
          return;
        }
        window.DrillStorage.saveAppProgress(parsed);
        const finish = () => {
          alert('Backup restored. Reloading…');
          location.reload();
        };
        // Signed-in: a restore is a point-in-time ROLLBACK, so it must be
        // cloud-authoritative like Reset — push immediately (bypassing the
        // debounce) and stamp resetAt so other devices replace instead of
        // union-merging their newer state back in.
        if (window.DrillSync && window.DrillSync.getCurrentUser && window.DrillSync.getCurrentUser() && window.DrillSync.resetCloud) {
          window.DrillSync.resetCloud().then(finish, (err) => {
            console.warn('cloud restore push failed:', err);
            finish();
          });
        } else {
          finish();
        }
      } catch (err) {
        alert('Could not restore backup: ' + err.message);
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be picked again later
    e.target.value = '';
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  CHEATSHEET WIRING — overlay open/close, search, expand-all, PDF export
// ──────────────────────────────────────────────────────────────────────────
function initCheatsheetWiring() {
  // Cheatsheet — in-app quick-reference overlay (no download).
  const cheatsheetModal = document.getElementById('cheatsheet-modal');
  document.getElementById('export-btn').addEventListener('click', openCheatsheetModal);
  document.getElementById('cheatsheet-close').addEventListener('click', closeCheatsheetModal);
  cheatsheetModal.addEventListener('click', (e) => {
    if (e.target === cheatsheetModal) closeCheatsheetModal();
  });
  document.getElementById('cheatsheet-search').addEventListener('input', (e) => {
    _cheatsheetSearch = e.target.value.toLowerCase().trim();
    renderCheatsheetBody();
  });
  document.getElementById('cheatsheet-expand-all').addEventListener('click', toggleCheatsheetExpandAll);
  // iter 126: Save — printable PDF export. window.open() must fire synchronously
  // from this click handler (no await before it) to preserve iOS Safari popup-allow.
  document.getElementById('cheatsheet-save-pdf').addEventListener('click', exportCheatsheetToPdf);
}

// ──────────────────────────────────────────────────────────────────────────
//  BOOT TAIL — paint initial badge state, mount cross-tab + interval +
//  service-worker listeners, reflect persisted hide-mastered onto the button.
//  Runs LAST because some of these read state that initBootstrap loaded and
//  paint UI that the wiring sub-inits attached handlers to.
// ──────────────────────────────────────────────────────────────────────────
function initBootTail() {
  updateStreakUI();
  updateReviewBadge();

  // Multi-tab sync: when another tab writes progress, reload ours
  // (don't blindly re-render — only if the key we care about changed).
  window.addEventListener('storage', (e) => {
    if (e.key !== LS_KEY) return;
    loadProgress();
    updateStreakUI();
    updateReviewBadge();
    renderSidebar();
    // Don't re-render the current lesson — that wipes the editor.
    // Just refresh the header indicators in place.
    if (state.currentLessonId) updateLessonHeaderInPlace();
  });
  // Sync REPLACE events (cross-account adopt / cloud reset-restore adoption)
  // rewrite localStorage wholesale. A reload is the only safe response — any
  // in-memory state this page still holds would clobber the replaced blobs on
  // its next saveProgress() and push the stale data back to the cloud.
  window.addEventListener('drill:sync-pulled', (e) => {
    if (e && e.detail && e.detail.replaced) location.reload();
  });
  // Reflect persisted hide-mastered toggle on its button
  if (state.hideMastered) {
    const btn = document.getElementById('hide-mastered-btn');
    btn.classList.add('text-emerald-300');
    btn.classList.remove('text-slate-500');
  }
  // Refresh review badge every 60s so freshly-due items show up without a reload.
  // Skip the sidebar re-render when the user is typing or when nothing has
  // changed — re-rendering steals focus and destroys input state.
  let lastDueCount = dueReviewIds().length;
  setInterval(() => {
    const focusInSearch = document.activeElement?.id === 'search-input';
    const dueNow = dueReviewIds().length;
    updateReviewBadge();
    if (!focusInSearch && dueNow !== lastDueCount) {
      renderSidebar();
      lastDueCount = dueNow;
    }
  }, 60 * 1000);
  // iter 113: Offline Drill Pack — paint chip from last-known stats
  // immediately so cold-start has no blank flash, then ask the SW for fresh
  // stats (round-trip is sub-second once SW is active).
  updateOfflinePackChip();
  pollOfflinePackStats();
  window.addEventListener('focus', pollOfflinePackStats);
  if (navigator.serviceWorker) {
    // The first install on a fresh visit takes a few seconds while
    // ~143 lesson JSONs precache. Repoll a couple times to catch the
    // populated state without busy-waiting.
    navigator.serviceWorker.addEventListener('controllerchange', pollOfflinePackStats);
    setTimeout(pollOfflinePackStats, 3000);
    setTimeout(pollOfflinePackStats, 8000);
  }
}

