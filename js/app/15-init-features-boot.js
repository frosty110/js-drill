function updateOfflinePackChip() {
  // Paint the sidebar chip from state.offlinePack (last-known SW cache stats).
  // Hidden when 0 lessons cached (e.g., SW unsupported, first-load before
  // install completes, opted out) so first-time users don't see a confusing
  // "0 lessons" affordance.
  const btn = document.getElementById('offline-pack-btn');
  const cnt = document.getElementById('offline-pack-count');
  if (!btn || !cnt) return;
  const n = state.offlinePack?.lessonCount || 0;
  btn.classList.toggle('hidden', n === 0);
  cnt.textContent = String(n);
}
// iter 114: ☁Sync Onboarding — one-time hint banner promoting the existing
// `js/sync.js` top-right chip. Fires only when ALL conditions met:
//   - banner has never been shown/dismissed (state.syncHintShown === false)
//   - the user just passed L3 (commitment moment, not mid-drill — minimizes
//     friction-during-engagement per PROFILE "friction near zero")
//   - the user is on a desktop user-agent (fine pointer; cross-device
//     promotion is only meaningful if the user has *another* device)
//   - the Sync chip is actually mounted (js/sync.js has loaded and rendered)
// On Tap-Sync: synthetically click the existing #sync-chip (no duplicate auth
// logic). On Dismiss: just set the flag. Either way, banner self-removes.
function _isDesktopPointer() {
  if (!window.matchMedia) return true;
  // Fine pointer + non-mobile UA + viewport ≥ 768px = desktop.
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const wideViewport = window.matchMedia('(min-width: 768px)').matches;
  return finePointer && wideViewport;
}
function _maybeShowSyncHint() {
  if (state.syncHintShown) return;
  if (!_isDesktopPointer()) return;
  // SW + sync chip presence required — if js/sync.js failed to load or the
  // chip hasn't mounted yet, deferring is the right call (banner can fire
  // on a later L3 pass).
  if (!document.getElementById('sync-chip')) return;
  // Don't show if a sync session is already active (chip class is-on means
  // signed in; no point promoting what they're already using).
  const chip = document.getElementById('sync-chip');
  if (chip && chip.classList.contains('is-on')) {
    // User already adopted sync; mark flag to skip future evaluations.
    state.syncHintShown = true;
    saveProgress();
    return;
  }
  _showSyncHintBanner();
}
function _showSyncHintBanner() {
  if (document.getElementById('sync-hint-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'sync-hint-banner';
  banner.innerHTML = `
    <div class="sync-hint-body">
      <span class="sync-hint-icon">${dsIcon('cloud', 16)}</span>
      <div class="sync-hint-text">
        <div class="sync-hint-title">Drilling on multiple devices?</div>
        <div class="sync-hint-sub">Your phone progress and laptop progress are separate today. Tap Sync to merge them across devices.</div>
      </div>
      <div class="sync-hint-actions">
        <button class="sync-hint-action sync-hint-tap" data-action="tap-sync">Tap Sync</button>
        <button class="sync-hint-action sync-hint-dismiss" data-action="dismiss">Dismiss</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);
  // Slide-in via requestAnimationFrame so the initial transform is paintable.
  requestAnimationFrame(() => banner.classList.add('sync-hint-show'));
  const close = (alsoTapChip) => {
    state.syncHintShown = true;
    saveProgress();
    banner.classList.remove('sync-hint-show');
    setTimeout(() => banner.remove(), 250);
    if (alsoTapChip) {
      const chip = document.getElementById('sync-chip');
      if (chip) chip.click();
    }
  };
  banner.querySelector('[data-action="tap-sync"]').addEventListener('click', () => close(true));
  banner.querySelector('[data-action="dismiss"]').addEventListener('click', () => close(false));
}
// iter 117: Clarify-First Ritual — opt-in pre-L3 tap-gate. When the user
// flips `state.clarifyRitualOn` on, every Patterns/Applied L3 visit shows a
// clarifier-chip card BEFORE the editor unlocks. Correct chips are mined from
// the lesson's `conversation.sections[0].say` bullet list (the existing
// "Restate & clarify" interview-narration content — 99 lessons authored);
// distractors come from `data/clarify-distractor-bank.json`. User taps chips
// in any order; correct taps mark green + count toward unlock; wrong taps
// mark red + increment state.clarify.attempts (signal not failure). When all
// correct chips are tapped → ritual completes + editor renders. Per-lesson
// per-session completion cached in `_clarifySessionCompleted` so the user
// doesn't re-do the ritual when they tab-switch back to L3. First Cat 9 §9A
// ship ever — drills the interview ritual the L1/L2/L3 ladder doesn't cover.
const _clarifySessionCompleted = new Set();
let _CLARIFY_BANK = null;
async function _clarifyLoadBank() {
  if (_CLARIFY_BANK) return _CLARIFY_BANK;
  try {
    const res = await fetch('data/clarify-distractor-bank.json', { cache: 'no-cache' });
    const body = await res.json();
    _CLARIFY_BANK = Array.isArray(body.distractors) ? body.distractors : [];
  } catch (_) {
    _CLARIFY_BANK = [];
  }
  return _CLARIFY_BANK;
}
function _clarifyExtractBullets(say) {
  // The conversation.sections[0].say is a paragraph with embedded bullet
  // questions. Format is consistent across 99/99 lessons: bullet lines
  // start with "• ". Extract each as a chip-sized clarifier question.
  if (typeof say !== 'string') return [];
  const lines = say.split(/\r?\n/);
  const bullets = [];
  for (const line of lines) {
    const m = line.match(/^\s*•\s+(.+?)\s*$/);
    if (m && m[1]) bullets.push(m[1]);
  }
  return bullets;
}
function _clarifyShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function _clarifyBuildCard(lesson, content, bank) {
  const say = content?.conversation?.sections?.[0]?.say;
  const bullets = _clarifyExtractBullets(say);
  if (bullets.length < 2) return null;
  // Cap correct picks at 3 to keep the card tappable on mobile.
  const correct = _clarifyShuffle(bullets).slice(0, Math.min(3, bullets.length));
  // 2-3 distractors from the bank, never duplicating a correct chip's text.
  const distractorPool = (bank || []).filter(d => !correct.includes(d));
  const distractorCount = Math.max(2, 6 - correct.length);
  const distractors = _clarifyShuffle(distractorPool).slice(0, distractorCount);
  const chips = _clarifyShuffle(
    correct.map(text => ({ text, isCorrect: true }))
      .concat(distractors.map(text => ({ text, isCorrect: false })))
  );
  return { chips, correctCount: correct.length };
}
function _renderClarifyRitual(body, lesson, content) {
  body.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'clarify-shell';
  wrap.innerHTML = `
    <div class="clarify-header">
      <span class="clarify-tag">${dsIcon('mic', 15)} Clarify-First · before you code</span>
      <button class="clarify-skip" data-action="clarify-skip" type="button">Skip this time →</button>
    </div>
    <div class="clarify-instructions">
      Real interviewers grade the <strong>questions you ask before coding</strong>. Tap the chips that are valid clarifiers for THIS problem — ignore the off-topic ones.
    </div>
    <div class="clarify-card" data-clarify-card>
      <div class="clarify-loading">Loading clarifiers…</div>
    </div>
  `;
  body.appendChild(wrap);
  wrap.querySelector('[data-action="clarify-skip"]').addEventListener('click', () => {
    _clarifySessionCompleted.add(lesson.id);
    // Re-render — the early-return gate now lets the normal L3 editor through.
    renderLesson();
  });
  const cardEl = wrap.querySelector('[data-clarify-card]');
  _clarifyLoadBank().then(bank => {
    const card = _clarifyBuildCard(lesson, content, bank);
    if (!card) {
      // No bullets available (Syntax lessons or malformed Conv data) — let editor through.
      _clarifySessionCompleted.add(lesson.id);
      renderLesson();
      return;
    }
    state.clarify.sessions++;
    state.clarify.lastRunAt = Date.now();
    saveProgress();
    let correctTapped = 0;
    cardEl.innerHTML = `
      <div class="clarify-progress" data-clarify-progress>
        Tapped <strong data-clarify-counter>0</strong> of <strong>${card.correctCount}</strong> valid clarifiers
      </div>
      <div class="clarify-chips">
        ${card.chips.map((c, i) => `
          <button class="clarify-chip" data-chip="${i}" data-correct="${c.isCorrect ? '1' : '0'}" type="button">
            ${escapeHtml(c.text)}
          </button>
        `).join('')}
      </div>
    `;
    const chipBtns = cardEl.querySelectorAll('.clarify-chip');
    chipBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('clarify-chip-correct') || btn.classList.contains('clarify-chip-wrong')) return;
        const isCorrect = btn.dataset.correct === '1';
        state.clarify.attempts++;
        if (isCorrect) {
          state.clarify.correct++;
          btn.classList.add('clarify-chip-correct');
          btn.insertAdjacentHTML('afterbegin', dsIcon('check', 12));
          btn.disabled = true;
          correctTapped++;
          const cnt = cardEl.querySelector('[data-clarify-counter]');
          if (cnt) cnt.textContent = String(correctTapped);
          if (correctTapped >= card.correctCount) {
            state.clarify.completed++;
            saveProgress();
            _clarifySessionCompleted.add(lesson.id);
            const progress = cardEl.querySelector('[data-clarify-progress]');
            if (progress) progress.innerHTML = `<strong style="color:#ffce5a">${dsIcon('check', 14)} Ritual complete — unlocking editor…</strong>`;
            setTimeout(() => renderLesson(), 700);
          } else {
            saveProgress();
          }
        } else {
          btn.classList.add('clarify-chip-wrong');
          btn.insertAdjacentHTML('afterbegin', dsIcon('alert', 12));
          btn.disabled = true;
          saveProgress();
        }
      });
    });
  });
}
// iter 118: Hot-Seat Follow-Up — opt-in post-L3-pass tap-card. When the
// user flips `state.hotseatOn` on, every L3 pass on a Patterns/Applied lesson
// surfaces a centered modal with one mechanic-tag-derived follow-up (mined
// from `data/hotseat-followups.json` byMechanic map) + 3 distractors picked
// from OTHER mechanics' follow-ups (interviewer-shaped but clearly wrong for
// THIS problem). User picks the right answer; correct increments
// state.hotseat.correct; wrong increments state.hotseat.attempts and shows
// red marker but doesn't block. Continue button closes; Skip available always.
// Bypassed during Mock Interview (no scaffolding by design). Pairs with
// iter-117 Clarify-First to cover both ENDS of the interview interaction.
let _HOTSEAT_REGISTRY = null;
async function _hotseatLoadRegistry() {
  if (_HOTSEAT_REGISTRY) return _HOTSEAT_REGISTRY;
  try {
    const res = await fetch('data/hotseat-followups.json', { cache: 'no-cache' });
    const body = await res.json();
    _HOTSEAT_REGISTRY = {
      byMechanic: body.byMechanic && typeof body.byMechanic === 'object' ? body.byMechanic : {},
      default: typeof body.default === 'string' ? body.default : 'Now optimize for space — can you do it with less extra memory?'
    };
  } catch (_) {
    _HOTSEAT_REGISTRY = { byMechanic: {}, default: 'Now describe one edge case the canonical might still miss.' };
  }
  return _HOTSEAT_REGISTRY;
}
function _hotseatLessonMechanicIds(lesson, content) {
  // Mechanics may live on the lesson stub (manifest) OR inside the loaded content.
  const raw = (content && Array.isArray(content.mechanics) && content.mechanics.length > 0)
    ? content.mechanics
    : (Array.isArray(lesson?.mechanics) ? lesson.mechanics : []);
  const ids = [];
  for (const m of raw) {
    if (typeof m === 'string') ids.push(m);
    else if (m && typeof m === 'object') {
      if (m.id) ids.push(m.id);
      else if (m.label) ids.push(m.label);
    }
  }
  return ids;
}
function _hotseatShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function _hotseatBuildCard(lesson, content, registry) {
  const lessonIds = _hotseatLessonMechanicIds(lesson, content);
  let correctText = null;
  let matchedMechanicId = null;
  for (const id of lessonIds) {
    if (registry.byMechanic[id]) {
      correctText = registry.byMechanic[id];
      matchedMechanicId = id;
      break;
    }
  }
  if (!correctText) {
    correctText = registry.default;
  }
  // Distractor pool = all registry follow-ups whose mechanic is NOT in this
  // lesson's mechanics[] (so they sound interviewer-shaped but are clearly
  // wrong for THIS problem).
  const lessonSet = new Set(lessonIds);
  const distractorPool = Object.entries(registry.byMechanic)
    .filter(([mid, text]) => !lessonSet.has(mid) && text !== correctText)
    .map(([_, text]) => text);
  const distractors = _hotseatShuffle(distractorPool).slice(0, 3);
  if (distractors.length < 3) return null;
  const options = _hotseatShuffle([
    { text: correctText, isCorrect: true },
    ...distractors.map(text => ({ text, isCorrect: false }))
  ]);
  return { options, matchedMechanicId };
}
function _maybeShowHotseat(lessonId) {
  if (!state.hotseatOn) return;
  // Bypass during Mock Interview (no scaffolding by design).
  if (state.mock.active && state.mock.lessonId === lessonId) return;
  const lesson = findLesson(lessonId);
  if (!lesson || (lesson.track !== 'patterns' && lesson.track !== 'applied')) return;
  const content = CONTENT[lessonId];
  if (!content) return;
  _hotseatLoadRegistry().then(registry => {
    const card = _hotseatBuildCard(lesson, content, registry);
    if (!card) return;
    _showHotseatModal(lesson, card);
  });
}
function _showHotseatModal(lesson, card) {
  if (document.getElementById('hotseat-modal')) return;
  state.hotseat.sessions++;
  state.hotseat.lastRunAt = Date.now();
  saveProgress();
  let resolved = false;
  let firstTapWasCorrect = false;
  const modal = document.createElement('div');
  modal.id = 'hotseat-modal';
  modal.innerHTML = `
    <div class="hotseat-scrim" data-action="hotseat-skip"></div>
    <div class="hotseat-card" role="dialog" aria-labelledby="hotseat-title">
      <div class="hotseat-header">
        <span class="hotseat-tag">${dsIcon('flame', 15)} Hot-Seat · interviewer follow-up</span>
        <button class="hotseat-skip" data-action="hotseat-skip" type="button" aria-label="Skip">${dsIcon('x', 14)}</button>
      </div>
      <div class="hotseat-prompt" id="hotseat-title">
        You passed <strong>${escapeHtml(lesson.title)}</strong>. The interviewer leans in:
      </div>
      <div class="hotseat-options">
        ${card.options.map((o, i) => `
          <button class="hotseat-option" data-opt="${i}" data-correct="${o.isCorrect ? '1' : '0'}" type="button">
            ${escapeHtml(o.text)}
          </button>
        `).join('')}
      </div>
      <div class="hotseat-feedback" data-hotseat-feedback></div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => {
    modal.remove();
  };
  // Skip via scrim click + skip button + Esc.
  modal.querySelectorAll('[data-action="hotseat-skip"]').forEach(el => el.addEventListener('click', close));
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  const optBtns = modal.querySelectorAll('.hotseat-option');
  optBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('hotseat-option-correct') || btn.classList.contains('hotseat-option-wrong')) return;
      const isCorrect = btn.dataset.correct === '1';
      state.hotseat.attempts++;
      if (isCorrect) {
        if (!resolved) firstTapWasCorrect = true;
        state.hotseat.correct++;
        btn.classList.add('hotseat-option-correct');
        optBtns.forEach(b => { if (b !== btn) b.disabled = true; });
        resolved = true;
        const fb = modal.querySelector('[data-hotseat-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="hotseat-resolved">
              <div class="hotseat-resolved-text">${firstTapWasCorrect ? dsIcon('check', 14) + ' First-try correct.' : dsIcon('check', 14) + ' Got it.'} That's the follow-up an interviewer would push.</div>
              <button class="hotseat-continue" data-action="hotseat-continue" type="button">Continue →</button>
            </div>
          `;
          fb.querySelector('[data-action="hotseat-continue"]').addEventListener('click', close);
        }
      } else {
        btn.classList.add('hotseat-option-wrong');
        btn.disabled = true;
      }
      saveProgress();
    });
  });
}
// iter 119: ⏱ Time-to-Solve Calibration — opt-in pre-L3 estimate strip.
// When toggle on + Patterns/Applied + not Mock + not yet estimated/skipped
// for this lesson this session: render a 4-bucket tap strip at TOP of L3
// wrap. Tap → record bucket + start timer; user proceeds to drill. On L3
// pass with active estimate → compute delta + store per lesson.mechanics[]
// tag in state.timeCalibration.byMechanic[id].predictions[].
// Stats tile DEFERRED to v2 — data captured this iter for soak window.
const _calibrationEstimated = new Set();  // lessonIds estimated this session
const _calibrationSkipped = new Set();     // lessonIds explicitly skipped this session
const _calibrationActive = {};              // lessonId  { bucket, startedAt }
const CALIBRATION_BUCKET_MIDPOINT_SEC = {
  // Midpoints used for absError computation against actual seconds.
  'lt2': 90, '2to5': 210, '5to10': 450, 'gt10': 900
};
function _calibrationMaybeInject(lesson, wrap) {
  if (!state.calibrateOn) return;
  if (state.mock.active && state.mock.lessonId === lesson.id) return;
  if (lesson.track !== 'patterns' && lesson.track !== 'applied') return;
  if (_calibrationEstimated.has(lesson.id) || _calibrationSkipped.has(lesson.id)) return;
  const strip = document.createElement('div');
  strip.className = 'calib-strip';
  strip.innerHTML = `
    <div class="calib-prompt">${dsIcon('clock', 15)} Quick estimate — how long until L3 passes?</div>
    <div class="calib-buckets">
      <button class="calib-bucket" data-bucket="lt2" type="button">&lt; 2 min</button>
      <button class="calib-bucket" data-bucket="2to5" type="button">2–5 min</button>
      <button class="calib-bucket" data-bucket="5to10" type="button">5–10 min</button>
      <button class="calib-bucket" data-bucket="gt10" type="button">10+ min</button>
      <button class="calib-skip" data-action="calib-skip" type="button">Skip</button>
    </div>
  `;
  wrap.insertBefore(strip, wrap.firstChild);
  strip.querySelectorAll('.calib-bucket').forEach(btn => {
    btn.addEventListener('click', () => {
      const bucket = btn.dataset.bucket;
      _calibrationEstimated.add(lesson.id);
      _calibrationActive[lesson.id] = { bucket, startedAt: Date.now() };
      state.timeCalibration.meta.estimates++;
      saveProgress();
      strip.remove();
    });
  });
  strip.querySelector('[data-action="calib-skip"]').addEventListener('click', () => {
    _calibrationSkipped.add(lesson.id);
    state.timeCalibration.meta.skips++;
    saveProgress();
    strip.remove();
  });
}
function _calibrationRecordPass(lessonId) {
  const entry = _calibrationActive[lessonId];
  if (!entry) return;
  delete _calibrationActive[lessonId];
  const lesson = findLesson(lessonId);
  const content = CONTENT[lessonId];
  if (!lesson || !content) return;
  const mechs = Array.isArray(content.mechanics) ? content.mechanics : [];
  if (mechs.length === 0) return;
  const actualSec = Math.round((Date.now() - entry.startedAt) / 1000);
  const midpoint = CALIBRATION_BUCKET_MIDPOINT_SEC[entry.bucket] || 300;
  const errorSec = Math.abs(actualSec - midpoint);
  for (const m of mechs) {
    const id = typeof m === 'string' ? m : (m.id || m.label);
    if (!id) continue;
    if (!state.timeCalibration.byMechanic[id]) {
      state.timeCalibration.byMechanic[id] = { predictions: [] };
    }
    state.timeCalibration.byMechanic[id].predictions.push({
      bucket: entry.bucket, actualSec, errorSec, at: Date.now()
    });
    // Cap to last 50 per mechanic to bound storage growth.
    const preds = state.timeCalibration.byMechanic[id].predictions;
    if (preds.length > 50) state.timeCalibration.byMechanic[id].predictions = preds.slice(-50);
  }
  state.timeCalibration.meta.passes++;
  saveProgress();
}
function pollOfflinePackStats() {
  // Send a postMessage to the active service worker; on reply, update
  // state.offlinePack + the chip. No-op if the SW isn't yet controlling
  // the page (first-visit-pre-install OR unsupported browser).
  if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  const channel = new MessageChannel();
  channel.port1.onmessage = (event) => {
    const d = event.data || {};
    if (d.type !== 'cache-stats-result') return;
    const next = {
      lessonCount: +d.lessonCount || 0,
      totalCount: +d.totalCount || 0,
      lastCheckedAt: Date.now()
    };
    const changed = next.lessonCount !== state.offlinePack.lessonCount
      || next.totalCount !== state.offlinePack.totalCount;
    state.offlinePack = next;
    if (changed) saveProgress();
    updateOfflinePackChip();
  };
  try {
    navigator.serviceWorker.controller.postMessage({ type: 'cache-stats' }, [channel.port2]);
  } catch (_) { /* SW gone between check and post — ignore */ }
}
// audit F13: the cheatsheet Save tooltip shipped a hardcoded "all 154 lessons"
// and rotted silently as the corpus grew to 171. index.html now carries the
// string WITHOUT a number (a missing count is honest, a wrong one is not) and
// the live count is filled in here from CURRICULUM — the same array the
// sidebar counts off — so the copy can never disagree with the corpus again.
// Runs after init() resolves because CURRICULUM is empty until loadManifest().
function refreshDerivedCopy() {
  const save = document.getElementById('cheatsheet-save-pdf');
  if (!save || typeof CURRICULUM === 'undefined' || !CURRICULUM.length) return;
  save.title = `Open all ${CURRICULUM.length} lessons in a print-ready page, then use your `
    + `phone's Share / Print menu to Save to Files or Apple Books for offline reading`;
}
init().then(refreshDerivedCopy).catch(err => console.error(err));

// ────────────────────────────────────────────────────────────────────────
// iter 127: top-bar dropdown shell (Phase 2 of the nav refactor epic).
// Single dropdown panel anchored under the topbar; opens with content
// populated by whichever menu button (Practice/Drills/Train/Insights) or
// the ⚙Settings icon was clicked. Phase 3 (iter 128) fills the menus
// with actual mode-launchers; Phase 2 ships the shell + open/close JS only.
//
// The existing sidebar buttons remain wired for this phase so nothing
// breaks — the user can reach every drill via either the sidebar OR (in
// Phase 3) the topbar dropdowns. Phase 4 removes the sidebar buttons.
// ────────────────────────────────────────────────────────────────────────

// iter 128 — Phase 3 of the topbar nav refactor epic. Each menu emits
// .topbar-item rows that synthetically click the corresponding sidebar
// button (same pattern as iter-104 Cmd-K palette — zero duplicate handlers).
// Taxonomy honors iter-127's stub strings verbatim:
//   Practice — sessions + picks (Mock, Today's Plan, Lucky, Shuffle, Replay, Weak, Review, At Risk, Warmup)
//   Drills — mode-launchers (Predict, Bug-Hunt, Recognize, Reverse, Match, Trace-Hop, Reverse-Walk, What-If, Notes, Locate, Claim, Gotcha, Swap, Conv, Constellation, Clarify, Hot-Seat)
//   Train — timed streams (Rapid, Big-O, Speedrun, Gauntlet)
//   Insights — visualizations (Stats, Streak, Sections, Mechanics, Cheatsheet, AI Coach)
//   Settings — toggles (Hide Mastered, Plan View, Calibrate), Data (Backup/Restore), Reset
// 2026-05-29 IA audit: trim the 30+ junk-drawer menus down to traditional
// dropdown sizes. Three structural shifts:
//   (1) Practice loses 6 status-driven items (Review / Weak / At-Risk /
//       Reveal-Replay / Resurrect / Bridge). They render as sidebar count
//       pills already; users only act when count > 0, so they don't belong
//       in a menu of CHOICES.
// (2) Drill collapses 17 modes-in-5-groups → 5 family entries. Each
//       family is a single-tap "shuffle-within-family" launcher
//       (action: 'shuffle') that picks one of its modes at random.
//   (3) Practice gains one "Pick one" smart-cascade launcher
//       (action: 'pick-smart') that replaces Lucky + Shuffle by routing
//       to Review / Weak / At-Risk first, falling back to Lucky or
//       Shuffle. One affordance instead of three.
// (4) Reflect → Review (the menu's actual job is looking BACKWARD at
//       progress, not abstract reflection).
//
// Item shape: either a string (sidebar button id, looked up via
// _topbarItemFromButton) OR an object { emoji, label, desc, action,
// ids?, id? }. Object items are inert in terms of the sidebar — they
// don't have a backing button — so they're rendered directly.
// audit F13: this row's desc used to hardcode "16 design problems" and rotted
// to half the real number (32). Counts baked into shipped copy always rot, so
// derive it at render time from the system-design index and OMIT the number
// entirely until that index is loaded — no number beats a wrong one. Written
// as a function because `desc` is read at render time by BOTH consumers (the
// topbar dropdown below and the Practice launcher sheet in
// js/app/18-practice-launcher.js), so a getter keeps the derivation in one place.
function designProblemsBlurb() {
  let n = 0;
  try {
    // _sdLoadIndex()/_sdIndex live in js/app/22-home.js (loaded after this
    // slice, but every call here happens at render time, long after boot).
    // Home is the front door so the index is normally already warm; warm it
    // ourselves for the deep-link-straight-into-a-menu case.
    if (typeof _sdLoadIndex === 'function') _sdLoadIndex();
    const topic = _sdIndex && (_sdIndex.topics || []).find(t => t.id === 'design-problems');
    n = (topic && topic.units) ? topic.units.length : 0;
  } catch (_) { n = 0; }
  return n
    ? `DDIA · building blocks · ${n} design problems`
    : 'DDIA · building blocks · canonical design problems';
}

// Turn one of the hidden launcher buttons into a menu row — {id, emoji, label,
// desc} read off the button itself, so the canonical mode list has exactly one
// definition and a row can never describe a button that no longer exists.
//
// This survived the removal of the topbar dropdown machinery it was written
// for (D15 phase 2): the Practice launcher and Home's sessions list are its
// consumers now. Losing it with the dropdowns broke Home's first paint, which
// is how it came back.
function _topbarItemFromButton(btn) {
  if (!btn) return null;
  if (btn.classList.contains('hidden')) return null;
  if (btn.style.display === 'none') return null;
  const cloned = btn.cloneNode(true);
  // Strip count spans (e.g. <span id="review-count">0</span>) so the label
  // doesn't carry "Review (0)" into the menu.
  cloned.querySelectorAll('[id$="-count"]').forEach(el => el.remove());
  // Collapse whitespace + strip empty parens left behind by the span removal.
  const text = cloned.textContent.trim().replace(/\s*\(\s*\)\s*$/, '').replace(/\s+/g, ' ').trim();
  // The mark comes from DS_MODE_ICONS, keyed by button id — not from the label.
  // It used to be parsed OUT of the label by a "first token contains a
  // non-ASCII byte" heuristic, which made the button's TEXT the de-facto icon
  // registry: every surface wanting a mode's glyph re-parsed it, and a label
  // that merely began with a symbol grew a phantom icon. The label is now just
  // the label, and the mark has one home (invariant 9).
  const desc = (btn.getAttribute('title') || '').trim();
  const icon = (typeof DS_MODE_ICONS === 'object' && DS_MODE_ICONS[btn.id]) || '';
  return { id: btn.id, icon, label: text, desc };
}

const TOPBAR_MENU_TAXONOMY = {
  practice: {
    label: 'Practice',
    blurb: 'Sessions + picks — what to drill next.',
    items: [
      'today-btn',
      'mock-btn',
      // audit F14: every desc below is a ROW SUBTITLE in the Practice launcher
      // at 390px, so anything past ~90 chars clips mid-word and the rows stop
      // being tellable apart. Each one keeps only what distinguishes it from
      // its siblings — the routing order here, the member list on the Drill
      // families — since the label already carries the gloss.
      { icon: 'dice', label: 'Pick one', desc: 'Routes to due reviews, weak spots or at-risk first — else a fresh lesson.', action: 'pick-smart' },
      'warmup-btn',
      'audio-btn',
      // nav-audit P1-2 / P2-1: the two standalone pages get real launcher rows
      // (action:'href' — a plain link row). Diagnostic previously had ZERO
      // entry points after first run; System Design was palette-only on the
      // phone. Both rows die in P8 when page unification lands.
      // Diagnostic is a standalone page with no nav rung of its own, so it
      // needs this row. System Design used to sit beside it and no longer
      // does: it is a primary destination (D15 §4), and a launcher row for a
      // rail item is a second door onto one room.
      { icon: 'clipboard-list', label: 'Diagnostic', desc: '43-question baseline — retake every few weeks', action: 'href', href: 'diagnostic.html' }
    ]
  },
  drills: {
    label: 'Drill',
    blurb: 'Pick a recall family — taps launch a random member.',
    items: [
      // audit F14: the member list IS the distinguisher — the family label
      // already says what the drills do, so the "… — mental execution drills."
      // tail was pure width. Trimmed to fit two lines at 390px.
      { icon: 'eye', label: 'Run it in your head', desc: 'Random pick: Predict / What-If / Trace-Hop / Reverse-Walk', action: 'shuffle', ids: ['crystal-btn', 'whatif-btn', 'trace-hop-btn', 'reverse-walk-btn'] },
      { icon: 'wrench', label: 'Judge a code change', desc: 'Random pick: Bug-Hunt / Mutate / Claim / Constraint-Shift / Swap', action: 'shuffle', ids: ['bug-hunt-btn', 'mutate-btn', 'claim-btn', 'constraint-shift-btn', 'swap-btn'] },
      { icon: 'compass', label: 'Name the pattern', desc: 'Random pick: Recognize / Reverse / Constellation / Match', action: 'shuffle', ids: ['recognize-btn', 'reverse-btn', 'constellation-btn', 'match-btn'] },
      { icon: 'file-text', label: 'Recall the traps', desc: 'Random pick: Notes-Cloze / Notes-Locate / Crux', action: 'shuffle', ids: ['notes-drill-btn', 'notes-locate-btn', 'gotcha-btn'] },
      'conv-drill-btn'
    ]
  },
  train: {
    label: 'Train',
    blurb: 'Cross-lesson timed and coverage streams.',
    items: ['rapid-fire-btn', 'big-o-btn', 'speedrun-btn', 'gauntlet-btn', 'phone-screen-btn']
  },
  insights: {
    label: 'Review',
    blurb: 'Look back: progress, coverage, and shareable exports.',
    // Cram-only references are gated by applySidebarCuration (display:none on
    // non-cram plans, so _topbarItemFromButton filters them out everywhere).
    // Stats + Streak retired into the top-nav Dashboard (merged daily progress
    // + activity + mastery); Sections + Mechanics stay grouped under Progress.
    groups: [
      { label: 'Progress', items: ['sections-grid-btn', 'mechanics-btn'] },
      { label: 'Share', items: ['export-btn', 'ai-coach-btn'] },
      { label: dsIcon('book-open', 15) + ' Reference (this plan)', items: ['cram-cheat-btn', 'cram-glossary-btn', 'cram-behavior-btn', 'cram-shapes-btn', 'cram-review-btn'] }
    ]
  },
  settings: {
    label: 'Settings',
    blurb: 'Toggles, data, and account.',
    // Plan View + 👁 Hide Mastered are NOT here — they're view filters that
    // live on the Browse page's filter panel (P4 part 3), not in this menu.
    items: ['clarify-ritual-btn', 'hotseat-btn', 'calibrate-btn', 'pace-bar-btn', 'haptic-btn', 'adhd-mode-btn', 'font-size-btn', 'install-btn', 'offline-pack-btn', 'backup-btn', 'restore-btn', 'reset-btn']
  }
};

// "Pick one" smart-routing cascade: due reviews → weak spots → at-risk →
// fresh (lucky) → mastered (shuffle). The first chip with a non-zero count
// wins — same triage logic the sidebar pills surface, but the routing is done
// for the user. Shared by the topbar dropdown AND the Practice launcher sheet
// (js/app/18-practice-launcher.js). Returns the button element to click.
function topbarPickSmartTarget() {
  const countOf = (id) => {
    const el = document.getElementById(id);
    return el ? parseInt(el.textContent || '0', 10) || 0 : 0;
  };
  const cascade = [
    ['review-count', 'review-btn'],
    ['weak-count', 'weak-btn'],
    ['at-risk-count', 'at-risk-btn'],
    [null, 'lucky-btn'],
    [null, 'shuffle-btn']
  ];
  for (const [countId, btnId] of cascade) {
    if (countId && !countOf(countId)) continue;
    const btn = document.getElementById(btnId);
    if (btn) return btn; // lucky/shuffle always exist as fallbacks
  }
  return null;
}


// Defer-loaded scripts run after DOM parse, so wiring synchronously is safe.
// Wrapped in a try/catch so a single missing element doesn't block init().
try { initSurfaceToggle(); } catch (e) { console.warn('[surface] init failed:', e); }
try { initSessionChrome(); } catch (e) { console.warn('[session-chrome] init failed:', e); }
