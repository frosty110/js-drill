// ── 23: Scoped review sessions — the ⟲ affordance on Home ─────────────────
// Before this, "review" was one global button that jumped to the single most
// overdue lesson. There was no way to ask "what's rotting in Trees?" and no
// notion of working a review queue to the end. This slice adds both:
//
//   startScopedReview('trees')  → queue = that scope's repair list
//                                 (overdue → due → weak → reveal-flagged,
//                                  the same ranking buildRepairIndex() uses)
//   → drops you into rep 1 at the right level, mounts a HUD strip under the
//     topbar (label · 2/6 · Skip · Exit), and advances automatically when you
//     PASS the level it sent you to.
//
// Deliberately NOT a new drill UI: a review rep is a real recall rep, so the
// session reuses L1/L2/L3 exactly as they are and only owns the queue, the
// progress readout and the advance rule. That also means everything the
// levels already do — SR scheduling, weakness clearing, reveal-flag clearing,
// history — happens for free and stays the single source of truth.
//
// Level choice mirrors the long-standing Review-Due rule: a mastered lesson
// coming back for review lands on L2 on touch devices (cued recall — typing
// free-recall code on a phone is the wrong friction, PROFILE.md's 80% case)
// and L3 on fine-pointer devices (the tier that advances the SR interval).
// A not-yet-mastered lesson lands on its first unpassed level instead.
//
// Session state is in-memory only — a review queue is a moment, not a
// preference, and persisting it would resurrect a stale queue days later.
// Deep link: #/m/review/<scope-slug> (e.g. #/m/review/trees, #/m/review/all).

const REVIEW_MAX_REPS = 12;

let _reviewSession = null;   // { slug, label, ids, pos, passed, startedAt }

function _reviewTargetLevel(lessonId) {
  if (lessonOverallStatus(lessonId) === 'mastered') {
    return window.matchMedia('(pointer: coarse)').matches ? 'L2' : 'L3';
  }
  return _todayNextLevel(lessonId);
}

function _reviewLevelIdx(level) {
  return ['L1', 'L2', 'L3'].indexOf(level);
}

// The queue for a slug. 'all' is the global repair list; anything else
// resolves through the Home scope model, so the queue and the counts on the
// Home buttons are computed from exactly one source.
function reviewQueueFor(slug) {
  if (slug === 'all') {
    const idx = typeof buildRepairIndex === 'function' ? buildRepairIndex() : new Map();
    const rows = [];
    idx.forEach((rep, id) => rows.push({ id, rank: rep.rank }));
    rows.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const da = (state.reviews[a.id] || {}).dueAt || Infinity;
      const db = (state.reviews[b.id] || {}).dueAt || Infinity;
      return da - db;
    });
    return rows.map(r => r.id);
  }
  const scope = homeScopeFromSlug(slug);
  return scope ? homeRepairIds(scope) : [];
}

function reviewScopeLabel(slug) {
  if (slug === 'all') return 'Everything due';
  const scope = homeScopeFromSlug(slug);
  return scope ? homeScopeLabel(scope) : 'Review';
}

function startScopedReview(slug) {
  const ids = reviewQueueFor(slug).slice(0, REVIEW_MAX_REPS);
  if (!ids.length) {
    _reviewToast(`Nothing to review in ${reviewScopeLabel(slug)} — all on schedule.`);
    return;
  }
  _reviewSession = {
    slug,
    label: reviewScopeLabel(slug),
    ids,
    pos: 0,
    passed: 0,
    startedAt: Date.now(),
  };
  try { history.replaceState(null, '', `#/m/review/${encodeURIComponent(slug)}`); } catch (_) {}
  _reviewGoto(0);
}

function _reviewGoto(pos) {
  if (!_reviewSession) return;
  if (pos >= _reviewSession.ids.length) { _reviewFinish(); return; }
  _reviewSession.pos = pos;
  const id = _reviewSession.ids[pos];
  const level = _reviewTargetLevel(id);
  _reviewSession.level = level;
  selectLesson(id);
  selectTab(level);
  _reviewMountHud();
}

function _reviewSkip() {
  if (!_reviewSession) return;
  _reviewGoto(_reviewSession.pos + 1);
}

function exitScopedReview(silent) {
  _reviewSession = null;
  _reviewUnmountHud();
  if (!silent && typeof openHome === 'function') {
    try { history.replaceState(null, '', '#/m/home'); } catch (_) {}
    openHome();
  }
}

function _reviewFinish() {
  const s = _reviewSession;
  _reviewSession = null;
  _reviewUnmountHud();
  if (s) {
    const mins = Math.max(1, Math.round((Date.now() - s.startedAt) / 60000));
    _reviewToast(`Review complete — ${s.passed}/${s.ids.length} passed in ${s.label} (~${mins} min)`);
  }
  try { history.replaceState(null, '', '#/m/home'); } catch (_) {}
  if (typeof openHome === 'function') openHome();
}

// Called from markLevelPassed (09-stats-cheatsheet-mock.js). Advances only
// when the pass is on the CURRENT queue lesson at or above the level the
// session sent the user to — passing L1 on your way to an L3 target isn't the
// rep the queue asked for, so it doesn't count as done.
function _reviewOnLevelPass(lessonId, level) {
  const s = _reviewSession;
  if (!s) return;
  if (s.ids[s.pos] !== lessonId) return;
  if (_reviewLevelIdx(level) < _reviewLevelIdx(s.level || 'L1')) {
    _reviewRenderHud();   // level chip may have moved on; keep the strip truthful
    return;
  }
  s.passed++;
  _reviewRenderHud();
  // Let the level's own pass feedback land before moving the user on.
  setTimeout(() => {
    if (_reviewSession === s) _reviewGoto(s.pos + 1);
  }, 1100);
}

// ── HUD ────────────────────────────────────────────────────────────────────
// A flex row inserted between the topbar and the app stage — not a fixed
// overlay, so it can never cover the L3 editor or the mobile action bar.

function _reviewMountHud() {
  let hud = document.getElementById('review-hud');
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'review-hud';
    hud.className = 'review-hud';
    hud.setAttribute('role', 'status');
    const topbar = document.getElementById('topbar');
    if (topbar && topbar.parentNode) topbar.parentNode.insertBefore(hud, topbar.nextSibling);
    else document.body.appendChild(hud);
    hud.addEventListener('click', (e) => {
      if (e.target.closest('[data-review-skip]')) { _reviewSkip(); return; }
      if (e.target.closest('[data-review-exit]')) { exitScopedReview(); }
    });
  }
  document.body.classList.add('review-active');
  _reviewRenderHud();
}

function _reviewRenderHud() {
  const hud = document.getElementById('review-hud');
  const s = _reviewSession;
  if (!hud || !s) return;
  const pct = Math.round(100 * s.pos / s.ids.length);
  hud.innerHTML = `
    <span class="review-hud__icon" aria-hidden="true">${dsIcon('refresh', 14)}</span>
    <span class="review-hud__label">${escapeHtml(s.label)}</span>
    <span class="review-hud__count ds-num">${s.pos + 1}/${s.ids.length}</span>
    <span class="ds-progress review-hud__meter"><i style="width:${pct}%"></i></span>
    <button class="ds-btn ds-btn--ghost ds-btn--pill review-hud__btn" data-review-skip>Skip</button>
    <button class="ds-iconbtn review-hud__btn" data-review-exit aria-label="Exit review">${dsIcon('x', 15)}</button>`;
}

function _reviewUnmountHud() {
  const hud = document.getElementById('review-hud');
  if (hud) hud.remove();
  document.body.classList.remove('review-active');
}

function _reviewToast(msg) {
  const existing = document.querySelector('.reveal-cleared-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'reveal-cleared-toast review-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('reveal-cleared-toast-show'));
  setTimeout(() => {
    toast.classList.remove('reveal-cleared-toast-show');
    setTimeout(() => toast.remove(), 250);
  }, 2600);
}

// Leaving the queue's lesson by any other route (sidebar click, palette,
// Browse) ends the session — the HUD would otherwise claim to be tracking a
// lesson the user has walked away from.
(() => {
  const shell = document.getElementById('lesson-shell');
  if (!shell) return;
  new MutationObserver(() => {
    const s = _reviewSession;
    if (!s) return;
    if (state.currentLessonId !== s.ids[s.pos]) exitScopedReview(true);
  }).observe(shell, { childList: true });
})();
