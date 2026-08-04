// ──────────────────────────────────────────────────────────────────────────
//  SHARE — per-question capture, share codes, share URLs, the share sheet
// ──────────────────────────────────────────────────────────────────────────
// The drilling user's most common study partner is an AI chat window they
// already have open. Before this, handing it context meant reconstructing
// "what I got wrong" in prose. Now one URL does it: the path names the topic
// (and resolves to a static page the AI can actually fetch — see
// tools/build-share-pages.js), and `?s=` carries the per-question result set.
//
// Three pieces live here:
//
//   1. CAPTURE   state.answers — the most recent attempt per lesson, recorded
//                at the grain of a single question. Everything else in
//                state.progress is level-grained ('L1': 'passed'), which can't
//                answer "which distractor pulled me".
// 2. CODEC     lesson state → share code, via js/sharecode.js. The code is
//                built ON DEMAND at click time from live state: no share
//                records, no cache, no server, nothing to invalidate.
//   3. UI        the share sheet — Copy link / Copy for AI.
//
// state.answers stores AUTHORED indices, never the shuffled display positions
// the user saw. L1 reshuffles both question order and option order every
// session (see renderL1), so a display position is meaningless the moment the
// URL leaves the page; the authored order is the stable contract the whole
// scheme rests on.
// ──────────────────────────────────────────────────────────────────────────

// Keep the blob bounded. Picks are a handful of bytes per lesson and are kept
// for everything; typed L3 code is the only heavy field, so it is capped per
// lesson and kept only for the most recently drilled ones.
const ANSWERS_MAX_CODE_CHARS = 4000;
const ANSWERS_MAX_CODE_LESSONS = 40;

function _answersFor(lessonId) {
  if (!state.answers[lessonId]) state.answers[lessonId] = {};
  return state.answers[lessonId];
}

// Drop stored L3 source beyond the most-recent N lessons. Runs after any write
// that can add code, so the blob can't grow without bound across 171 lessons.
function _pruneAnswers() {
  const withCode = Object.keys(state.answers)
    .filter(id => state.answers[id] && state.answers[id].L3 && state.answers[id].L3.code)
    .sort((a, b) => (state.answers[b].L3.at || 0) - (state.answers[a].L3.at || 0));
  for (const id of withCode.slice(ANSWERS_MAX_CODE_LESSONS)) delete state.answers[id].L3.code;
}

// ── Capture ───────────────────────────────────────────────────────────────

// Each recorder persists. The interesting share is a FAILED attempt, and the
// existing write paths only reach saveProgress on a miss (recordWrong) or a
// level pass (markPassed) — neither fires for a half-finished run, which is
// exactly the state a user wants to hand to an AI.

// One L1 question locked. `qIdx` / `optIdx` are AUTHORED indices.
//
// `sessionToken` identifies the L1 sitting the pick belongs to (renderL1 mints
// one per fresh shuffle — Retry, or a first render after reload). The record
// resets on the first pick of a NEW session rather than when that session is
// rendered: rendering L1 is not the same as attempting it, and a user who
// opens the tab and shares without answering should still be sharing their
// last real attempt. Resetting lazily also stops a short retry from inheriting
// the previous attempt's answers in the positions it never reached.
function recordL1Pick(lessonId, qIdx, optIdx, sessionToken) {
  const a = _answersFor(lessonId);
  const stale = !a.L1 || !Array.isArray(a.L1.picks) || (sessionToken && a.L1.session !== sessionToken);
  if (stale) a.L1 = { picks: [], at: 0, session: sessionToken || null };
  a.L1.picks[qIdx] = optIdx;
  a.L1.at = Date.now();
  saveProgress();
}

function recordL2Result(lessonId, exIdx, ok) {
  const a = _answersFor(lessonId);
  if (!a.L2 || !Array.isArray(a.L2.results)) a.L2 = { results: [], at: 0 };
  a.L2.results[exIdx] = !!ok;
  a.L2.at = Date.now();
  saveProgress();
}

// An L3 run. The typed source is the highest-value thing the user produces in
// the whole app — it is what makes "review my attempt" possible — so it rides
// along in state (and in the Copy-for-AI payload), never in the URL.
function recordL3Result(lessonId, ok, code) {
  const a = _answersFor(lessonId);
  a.L3 = {
    ok: !!ok,
    code: typeof code === 'string' ? code.slice(0, ANSWERS_MAX_CODE_CHARS) : '',
    at: Date.now()
  };
  _pruneAnswers();
  saveProgress();
}

// ── Codec bridge ──────────────────────────────────────────────────────────

// Build the share code for a lesson from live state. Always full authored
// length — an unanswered question encodes as '-' rather than being omitted, so
// position N in the code is always question N on the page.
function lessonShareCode(lessonId) {
  const content = CONTENT[lessonId];
  if (!content || !window.DrillShare) return '';
  const a = state.answers[lessonId] || {};
  const picks = (a.L1 && a.L1.picks) || [];
  const l2 = (a.L2 && a.L2.results) || [];

  const L1 = ((content.L1 && content.L1.questions) || []).map((q, i) => ({
    picked: picks[i] == null ? null : picks[i],
    correct: q.answer
  }));
  const L2 = ((content.L2 && content.L2.exercises) || []).map((_, i) => (l2[i] == null ? null : l2[i]));
  const L3 = content.L3 ? [a.L3 ? a.L3.ok : null] : [];

  return DrillShare.encodeLesson({ L1, L2, L3 });
}

// True when the user has actually answered something worth sharing.
function lessonHasAnswers(lessonId) {
  const code = lessonShareCode(lessonId);
  return /[A-Ha-hYpn]/.test(code);
}

function lessonShareUrl(lessonId, opts) {
  if (!window.DrillRoutes) return '';
  const code = lessonShareCode(lessonId);
  return DrillRoutes.shareUrl('lesson', { id: lessonId }, code, opts || {});
}

// A whole-session code across several lessons, for a mock run or a scoped
// review: `two-sum:AbbC.Y.n,lru-cache:AAbD.Y.Y`.
function sessionShareUrl(lessonIds, opts) {
  if (!window.DrillRoutes || !window.DrillShare) return '';
  const entries = (lessonIds || [])
    .map(id => ({ id, code: lessonShareCode(id) }))
    .filter(e => /[A-Ha-hYpn]/.test(e.code));
  return DrillRoutes.shareUrl('lessonIndex', {}, DrillShare.encodeSession(entries), opts || {});
}

// ── Copy for AI ───────────────────────────────────────────────────────────
// The URL alone is enough for the AI to fetch the questions, the answer key
// and the canonical. What the URL cannot carry is the code the user actually
// typed — so the clipboard payload adds it. Same zero infrastructure: the
// clipboard is the transport.
function buildLessonAiPayload(lessonId) {
  const lesson = findLesson(lessonId);
  const content = CONTENT[lessonId];
  if (!lesson || !content || !window.DrillShare) return '';
  const url = lessonShareUrl(lessonId);
  const code = lessonShareCode(lessonId);
  const decoded = DrillShare.decodeLesson(code);
  const s = DrillShare.summarize(DrillShare.flattenLesson(decoded));
  const a = state.answers[lessonId] || {};

  const lines = [];
  lines.push(`I'm drilling "${lesson.title}" (${lesson.section}) in a JavaScript interview-prep app. Here's the page, with my results encoded in the URL:`);
  lines.push('');
  lines.push(url);
  lines.push('');
  lines.push('Open it — it has the full lesson, every question, the answer key, and a legend for the `s=` code. That code is my result set, one character per question in the order they appear on the page.');
  lines.push('');
  lines.push(`I scored ${s.full}/${s.attempted} on the questions I attempted${s.unattempted ? ` (${s.unattempted} of ${s.total} not attempted)` : ''}.`);

  if (a.L3 && a.L3.code) {
    lines.push('');
    lines.push(`Here's the code I actually wrote for the L3 drill (it ${a.L3.ok ? 'passed' : 'did NOT pass'}):`);
    lines.push('```' + (content.lang === 'ts' ? 'ts' : 'js'));
    lines.push(a.L3.code);
    lines.push('```');
  }

  lines.push('');
  lines.push('Please tutor me on this: start from what I got wrong (and which wrong option I picked — that usually says more than the miss itself), explain the underlying idea rather than the answer, then quiz me back until I can defend it. Ask me one question at a time.');
  return lines.join('\n');
}

// ── Share sheet ───────────────────────────────────────────────────────────

function openShareSheet(lessonId) {
  const lesson = findLesson(lessonId);
  if (!lesson || !window.DrillShare) return;
  const url = lessonShareUrl(lessonId);
  const code = lessonShareCode(lessonId);
  const s = DrillShare.summarize(DrillShare.flattenLesson(DrillShare.decodeLesson(code)));
  const hasCode = lessonHasAnswers(lessonId);
  const typed = (state.answers[lessonId] || {}).L3;

  document.getElementById('share-sheet')?.remove();
  const scrim = document.createElement('div');
  scrim.className = 'ds-root ds-scrim is-open';
  scrim.id = 'share-sheet';
  scrim.innerHTML = `
    <div class="ds-sheet ds-sheet--scroll" role="dialog" aria-modal="true" aria-label="Share this lesson">
      <div class="share-head">
        <h2 class="ds-h2">Share</h2>
        <button class="ds-iconbtn" data-share-close aria-label="Close share">${dsIcon('x', 20)}</button>
      </div>
      <p class="share-lede">A link to <strong>${escapeHtml(lesson.title)}</strong>${hasCode ? ` carrying your results — ${s.full}/${s.attempted} correct${s.unattempted ? `, ${s.unattempted} not yet attempted` : ''}` : ''}. Paste it to an AI to be tutored on exactly what you missed.</p>
      <input class="ds-field share-url" data-share-url readonly value="${escapeHtml(url)}" aria-label="Share URL" spellcheck="false">
      <p class="share-code">${hasCode
        ? `Your results: <code>${escapeHtml(code)}</code> — uppercase is a right answer, lowercase is the wrong option you picked, <code>-</code> is unanswered.`
        : `You haven't answered anything here yet, so the link carries the lesson only.`}</p>
      <div class="share-actions">
        <button class="ds-btn ds-btn--primary ds-btn--block" data-share-copy>${dsIcon('link', 15)} Copy link</button>
        <button class="ds-btn ds-btn--block" data-share-ai>${dsIcon('sparkles', 15)} Copy for AI${typed && typed.code ? ' (with my code)' : ''}</button>
      </div>
      <p class="share-foot">Opens a plain page with the full lesson, the answer key and a legend for the code — no sign-in, nothing stored anywhere.${typed && typed.code ? ' Copy&nbsp;for&nbsp;AI also includes the code you typed, which the URL can\'t carry.' : ''}</p>
    </div>`;
  document.body.appendChild(scrim);

  const close = () => scrim.remove();
  scrim.addEventListener('click', e => { if (e.target === scrim) close(); });
  scrim.querySelector('[data-share-close]').addEventListener('click', close);
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  const urlField = scrim.querySelector('[data-share-url]');
  urlField.addEventListener('focus', () => urlField.select());

  const flash = (btn, msg) => {
    const original = btn.innerHTML;
    btn.innerHTML = msg;
    btn.disabled = true;
    setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 1600);
  };

  scrim.querySelector('[data-share-copy]').addEventListener('click', async e => {
    const btn = e.currentTarget;
    // Native share on phones — the drilling user is on a phone ~80% of the
    // time, where "copy then switch apps then paste" is the slow path.
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: lesson.title, url }); return; } catch (_) { /* fall through to copy */ }
    }
    flash(btn, await copyTextToClipboard(url)
      ? dsIcon('check', 15) + ' Copied' : dsIcon('alert', 15) + ' Copy failed');
  });

  scrim.querySelector('[data-share-ai]').addEventListener('click', async e => {
    const payload = buildLessonAiPayload(lessonId);
    flash(e.currentTarget, await copyTextToClipboard(payload)
      ? dsIcon('check', 15) + ' Copied — paste into your AI' : dsIcon('alert', 15) + ' Copy failed');
  });
}
