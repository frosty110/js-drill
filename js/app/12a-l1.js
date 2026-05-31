//  L1 — MULTIPLE CHOICE
// ──────────────────────────────────────────────────────────────────────────
// Build a markdown prompt summarising an L1 session for paste-into-AI
// tutoring. Includes every question, the user's choice, the correct
// answer, and any in-app explanation. Marks unanswered questions clearly
// so the AI knows what's actually a miss vs unattempted.
function buildL1AiPrompt(lesson, content, localState) {
  const qs = content.L1.questions;
  const sectionLabel = lesson.section ? `${lesson.section} (${lesson.track || ''})`.trim() : (lesson.track || '');
  const lines = [];
  lines.push(`I'm studying "${lesson.title}"${sectionLabel ? ` — ${sectionLabel}` : ''} in a JavaScript interview-prep drill app. I just took the L1 concept quiz. Help me understand what I missed and deepen my grasp of the load-bearing ideas.`);
  lines.push('');
  if (content.reference && content.reference.code) {
    lines.push('## Canonical code I\'m drilling');
    lines.push('```js');
    lines.push(content.reference.code);
    lines.push('```');
    lines.push('');
  }
  // Walk in the same shuffled display order the user saw, so the prompt's
  // letters (A/B/C/D) match the user's mental picture of "I picked B".
  const qOrder = (localState && Array.isArray(localState.qOrder)) ? localState.qOrder : qs.map((_, i) => i);
  qOrder.forEach((qi, displayIdx) => {
    const q = qs[qi];
    const perQ = (localState && localState.perQ && localState.perQ[qi]) || { locked: false, selected: null, optOrder: q.options.map((_, i) => i) };
    const correctDisplayIdx = perQ.optOrder.indexOf(q.answer);
    lines.push(`## Question ${displayIdx + 1}`);
    lines.push(q.q);
    lines.push('');
    perQ.optOrder.forEach((origOi, displayOi) => {
      const opt = q.options[origOi];
      const letter = String.fromCharCode(65 + displayOi);
      const tags = [];
      if (perQ.locked && perQ.selected === displayOi) tags.push(displayOi === correctDisplayIdx ? 'my answer ✓' : 'my answer ✗');
      if (displayOi === correctDisplayIdx && !(perQ.locked && perQ.selected === displayOi)) tags.push('correct');
      const tagStr = tags.length ? `   ← ${tags.join(', ')}` : '';
      lines.push(`- ${letter}. ${opt}${tagStr}`);
    });
    if (!perQ.locked) lines.push(`(unanswered)`);
    if (q.explain) {
      lines.push('');
      lines.push(`> App's explanation: ${q.explain}`);
    }
    lines.push('');
  });
  lines.push('Please:');
  lines.push('1. For each question I got wrong, explain the underlying concept I\'m missing in plain language.');
  lines.push('2. Give one short additional example or analogy per concept I missed.');
  lines.push('3. List 2–3 follow-up multiple-choice questions I should be able to answer next to confirm I\'ve internalised it.');
  return lines.join('\n');
}

// Async clipboard with a textarea-based fallback for older browsers / file://
// contexts where navigator.clipboard isn't available. Returns true on success.
async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

// iter 88: 🤖 AI Coach Export — Markdown blob of weak-spots + revealed +
// overdue lessons sized for an LLM context window. The drilling user often
// has Claude/ChatGPT open already on phone; this surface skips the manual
// "describe my weak spots" reconstruction step by exporting curated context
// (lesson title + section + L1 question + correct answer + first ~25 lines
// of canonical) for the AI to tutor against. From `ideas-by-category.md
// § 6 Persistence → AI-tutor export (BYOK bridge)`. Pure clipboard export —
// no API integration, no creds, no schema change.
const AI_COACH_MAX_CHARS = 8000; // ~2000 tokens — leaves room for user prompt
const AI_COACH_MAX_LESSONS = 12;

function _aiCoachBuildExport() {
  const now = Date.now();
  const lines = [];
  lines.push('# JavaScript Drill — Weak Spots Snapshot');
  lines.push('');
  lines.push('I\'m studying for JS coding interviews using a spaced-repetition drill app. Below are the lessons I keep missing or had to reveal the answer for. **Please act as my tutor**: pick ONE lesson from this list and quiz me on it (Socratic style — don\'t just give the answer). After I respond, give feedback and move to the next. Focus on the WHY, not memorization.');
  lines.push('');

  // Gather weak / revealed / overdue lessons.
  const weakIds = Object.keys(state.weakness || {}).filter(id => (state.weakness[id] || 0) > 0);
  const revealedIds = Object.keys(state.revealed || {}).filter(id => state.revealed[id] && Object.keys(state.revealed[id]).length > 0);
  const overdueIds = [];
  for (const id of Object.keys(state.reviews || {})) {
    const r = state.reviews[id];
    if (!r || !r.dueAt || !r.interval) continue;
    if (now - r.dueAt > r.interval) overdueIds.push(id);
  }

  // Dedupe + rank: weakness count desc, then revealed, then overdue depth.
  const seen = new Set();
  const rank = (id) => (state.weakness[id] || 0) * 100
                       + (state.revealed[id] ? 10 : 0)
                       + (state.reviews[id] && now > (state.reviews[id].dueAt || 0) ? 1 : 0);
  const candidates = [...weakIds, ...revealedIds, ...overdueIds]
    .filter(id => { if (seen.has(id)) return false; seen.add(id); return true; })
    .filter(id => findLesson(id) && CONTENT[id])
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, AI_COACH_MAX_LESSONS);

  if (candidates.length === 0) {
    lines.push('## No weak spots yet');
    lines.push('');
    lines.push('I haven\'t logged enough misses or reveals for the app to surface specific weak spots. Quiz me on any JavaScript pattern you think a rusty mid-career engineer should know cold (hash maps, sliding window, binary search variants, common array idioms).');
    return lines.join('\n');
  }

  lines.push(`## ${candidates.length} lesson${candidates.length === 1 ? '' : 's'} I'm wobbly on`);
  lines.push('');

  for (const id of candidates) {
    const lesson = findLesson(id);
    const content = CONTENT[id];
    if (!lesson || !content) continue;
    const wkCount = state.weakness[id] || 0;
    const revLevels = state.revealed[id] ? Object.keys(state.revealed[id]).filter(k => state.revealed[id][k]) : [];
    const r = state.reviews[id];
    const overdueDays = r && r.dueAt && now > r.dueAt ? Math.round((now - r.dueAt) / 86400000) : 0;

    const flags = [];
    if (wkCount > 0) flags.push(`missed L1 ${wkCount}×`);
    if (revLevels.length > 0) flags.push(`revealed ${revLevels.join('+')}`);
    if (overdueDays > 0) flags.push(`${overdueDays}d overdue`);

    lines.push(`### ${lesson.title}`);
    lines.push(`*${lesson.section} · ${flags.join(' · ')}*`);

    // Include the most-missed L1 question if available.
    if (wkCount > 0 && content.L1 && Array.isArray(content.L1.questions) && content.L1.questions.length > 0) {
      const q = content.L1.questions[0];
      lines.push('');
      lines.push(`**Concept question:** ${q.q}`);
      lines.push(`- Correct: ${q.options[q.answer]}`);
      if (q.explain) lines.push(`- *Why:* ${q.explain}`);
    }

    // Include canonical (truncated to ~25 lines for context budget).
    if (content.L3 && content.L3.canonical) {
      const code = content.L3.canonical.split('\n').slice(0, 25).join('\n');
      lines.push('');
      lines.push('**Canonical:**');
      lines.push('```js');
      lines.push(code);
      lines.push('```');
    }
    lines.push('');

    // Bail if we're approaching the char budget — better to ship a focused
    // export than a truncated mess.
    if (lines.join('\n').length > AI_COACH_MAX_CHARS) {
      lines.push('*(snapshot truncated for LLM context budget — re-run after working through these)*');
      break;
    }
  }

  return lines.join('\n');
}

async function startAiCoachExport() {
  const text = _aiCoachBuildExport();
  const ok = await copyTextToClipboard(text);
  // Reuse the reveal-cleared-toast styling family for the confirmation.
  const existing = document.querySelector('.reveal-cleared-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'reveal-cleared-toast ai-coach-toast';
  toast.innerHTML = ok
    ? `🤖 Copied ${text.length.toLocaleString()} chars — paste into Claude/ChatGPT to be tutored on your weak spots`
    : `⚠️ Clipboard blocked — open DevTools console and run <code>_aiCoachBuildExport()</code> to print the blob`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('reveal-cleared-toast-show'));
  setTimeout(() => {
    toast.classList.remove('reveal-cleared-toast-show');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// iter eval-2026-05-30: Pick one carry-over weak-spot question for an
// L1 session — from a DIFFERENT lesson the user has flagged in
// state.weakness, picked at random. Returns null if no weak-spot lesson
// has loaded L1 content yet (cold-start or all weak lessons unloaded).
// Excludes the current lesson so the carry-over genuinely interleaves.
// Per audits/l1.md edit 1.
function _pickCarryoverL1Question(currentLessonId) {
  const candidates = Object.keys(state.weakness || {})
    .filter(id => id !== currentLessonId && (state.weakness[id] || 0) > 0)
    .filter(id => {
      const c = CONTENT[id];
      return c && c.L1 && Array.isArray(c.L1.questions) && c.L1.questions.length > 0;
    });
  if (!candidates.length) return null;
  const lessonId = candidates[Math.floor(Math.random() * candidates.length)];
  const lessonMeta = CURRICULUM.find(l => l.id === lessonId);
  const qs = CONTENT[lessonId].L1.questions;
  const q = qs[Math.floor(Math.random() * qs.length)];
  if (!q || !Array.isArray(q.options) || typeof q.answer !== 'number') return null;
  return { lessonId, lessonTitle: lessonMeta ? lessonMeta.title : lessonId, q };
}

function renderL1(body, lesson, content) {
  const qs = content.L1.questions;
  // Per-session shuffle: question order + per-question option order. Both
  // permutations live in the in-flight cache so a tab switch back into L1
  // preserves what the user is looking at (and their locked picks). Retry
  // clears the cache, which reshuffles on the next render. See BS-12.
  //
  // Shape: { qOrder: [displayPos→origQi], perQ: [origQi→{selected, locked,
  // optOrder: [displayPos→origOi]}] }. `selected` is the DISPLAY-position
  // index into optOrder, so replays don't require remembering original idx.
  let localState = _cacheGet(lesson.id, 'L1');
  const shapeOk = localState && Array.isArray(localState.qOrder)
    && localState.qOrder.length === qs.length
    && Array.isArray(localState.perQ) && localState.perQ.length === qs.length
    && localState.perQ.every((p, i) => p && Array.isArray(p.optOrder)
        && p.optOrder.length === qs[i].options.length);
  if (!shapeOk) {
    localState = {
      qOrder: _shuffleIndices(qs.length),
      perQ: qs.map(q => ({
        selected: null,
        locked: false,
        optOrder: _shuffleIndices(q.options.length)
      }))
    };
    _cacheSet(lesson.id, 'L1', localState);
  }
  // Capture per-question render handles so we can replay locked-state
  // visuals after all cards are appended. (Replaying inline would require
  // moving the click-handler logic up; this stays in sync more easily.)
  const cardHandles = [];

  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="mb-4 text-sm text-slate-400">Pick the right answer for each. Pass = miss at most one (≥80%); a perfect run earns a green ✓, otherwise an amber ✓ and the miss is saved to review.</div>`;

  // Carry-over weak-spot card — one extra L1 question from another lesson
  // the user has flagged, picked once per session and cached. Does NOT
  // count toward this lesson's pass criterion (excluded from
  // localState/maybePassL1). Per audits/l1.md edit 1 — adds cross-lesson
  // interleaving inside the L1 tab itself, complementing Rapid-Fire.
  let carryover = localState.carryover;  // { lessonId, lessonTitle, q, optOrder, selected, locked }
  if (!carryover) {
    const pick = _pickCarryoverL1Question(lesson.id);
    if (pick) {
      carryover = {
        lessonId: pick.lessonId,
        lessonTitle: pick.lessonTitle,
        q: pick.q,
        optOrder: _shuffleIndices(pick.q.options.length),
        selected: null,
        locked: false
      };
      localState.carryover = carryover;
    }
  }
  if (carryover) {
    const cQ = carryover.q;
    const cCorrectDisplayIdx = carryover.optOrder.indexOf(cQ.answer);
    const cCard = document.createElement('div');
    cCard.className = 'mb-6 p-5 rounded-lg bg-slate-900 border border-cyan-700/40';
    cCard.innerHTML = `
      <div class="text-xs uppercase tracking-wider text-cyan-300/80 mb-1">🔁 Carry-over weak spot · <span class="text-slate-400 normal-case tracking-normal">${escapeHtml(carryover.lessonTitle)}</span></div>
      <div class="text-white font-medium mb-3">${escapeHtml(cQ.q)}</div>
      <div class="space-y-2" data-carryover-opts></div>
      <div class="explain mt-3 text-sm text-slate-400 hidden"></div>
      <div class="mt-2 text-xs text-slate-500">Doesn't count toward this lesson's pass — purely a memory recheck on a flagged concept.</div>
    `;
    const cOptsContainer = cCard.querySelector('[data-carryover-opts]');
    carryover.optOrder.forEach((origOi, displayOi) => {
      const opt = cQ.options[origOi];
      const optEl = document.createElement('div');
      optEl.className = 'mc-option';
      const letter = String.fromCharCode(65 + displayOi);
      optEl.innerHTML = `<span class="text-slate-500 font-mono text-xs mr-2">${letter}.</span>${escapeHtml(opt)}`;
      optEl.setAttribute('role', 'button');
      optEl.setAttribute('tabindex', '0');
      optEl.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !carryover.locked) { e.preventDefault(); optEl.click(); }
      });
      optEl.addEventListener('click', () => {
        if (carryover.locked) return;
        carryover.selected = displayOi;
        carryover.locked = true;
        const isRight = displayOi === cCorrectDisplayIdx;
        // Write back to the SOURCE lesson's weakness counter, not the
        // current one. On miss: increment. On win: decrement (steady
        // wins erode a long-standing weakness without a single win
        // resetting it).
        if (!isRight) {
          state.weakness[carryover.lessonId] = (state.weakness[carryover.lessonId] || 0) + 1;
          appendHistory(carryover.lessonId, 'L1-miss');
        } else {
          const w = state.weakness[carryover.lessonId] || 0;
          if (w > 1) state.weakness[carryover.lessonId] = w - 1;
          else if (w === 1) delete state.weakness[carryover.lessonId];
          appendHistory(carryover.lessonId, 'L1-pass');
        }
        saveProgress();
        [...cOptsContainer.children].forEach((el, idx) => {
          el.classList.add('disabled');
          if (idx === cCorrectDisplayIdx) el.classList.add('correct');
          if (idx === displayOi && !isRight) el.classList.add('incorrect');
        });
        const ex = cCard.querySelector('.explain');
        ex.classList.remove('hidden');
        ex.innerHTML = `<strong class="${isRight ? 'text-emerald-400' : 'text-rose-400'}">${isRight ? '✓ Correct.' : '✗ Not quite.'}</strong>${cQ.explain ? ' ' + escapeHtml(cQ.explain) : ''}`;
      });
      cOptsContainer.appendChild(optEl);
    });
    // Replay locked-state across re-renders (tab switch back into L1).
    if (carryover.locked && carryover.selected != null) {
      [...cOptsContainer.children].forEach((el, idx) => {
        el.classList.add('disabled');
        if (idx === cCorrectDisplayIdx) el.classList.add('correct');
        if (idx === carryover.selected && idx !== cCorrectDisplayIdx) el.classList.add('incorrect');
      });
      const ex = cCard.querySelector('.explain');
      ex.classList.remove('hidden');
      const wasRight = carryover.selected === cCorrectDisplayIdx;
      ex.innerHTML = `<strong class="${wasRight ? 'text-emerald-400' : 'text-rose-400'}">${wasRight ? '✓ Correct.' : '✗ Not quite.'}</strong>${cQ.explain ? ' ' + escapeHtml(cQ.explain) : ''}`;
    }
    wrap.appendChild(cCard);
  }

  localState.qOrder.forEach((qi, displayIdx) => {
    const q = qs[qi];
    const perQ = localState.perQ[qi];
    const correctDisplayIdx = perQ.optOrder.indexOf(q.answer);
    const card = document.createElement('div');
    card.className = 'mb-6 p-5 rounded-lg bg-slate-900 border border-slate-800';
    card.innerHTML = `
      <div class="text-sm text-slate-500 mb-1">Question ${displayIdx+1} of ${qs.length}</div>
      <div class="text-white font-medium mb-3">${escapeHtml(q.q)}</div>
      <div class="space-y-2" data-qi="${qi}"></div>
      <div class="explain mt-3 text-sm text-slate-400 hidden"></div>
    `;
    const optsContainer = card.querySelector('[data-qi]');
    perQ.optOrder.forEach((origOi, displayOi) => {
      const opt = q.options[origOi];
      const optEl = document.createElement('div');
      optEl.className = 'mc-option';
      const letter = String.fromCharCode(65 + displayOi);  // A, B, C, D
      optEl.innerHTML = `<span class="text-slate-500 font-mono text-xs mr-2">${letter}.</span>${escapeHtml(opt)}`;
      optEl.setAttribute('role', 'button');
      optEl.setAttribute('tabindex', '0');
      optEl.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !perQ.locked) {
          e.preventDefault();
          optEl.click();
        }
      });
      optEl.addEventListener('click', () => {
        if (perQ.locked) return;
        perQ.selected = displayOi;
        perQ.locked = true;
        const isRightClick = displayOi === correctDisplayIdx;
        if (!isRightClick) recordWrong(lesson.id);
        // mark correctness
        [...optsContainer.children].forEach((el, idx) => {
          el.classList.add('disabled');
          if (idx === correctDisplayIdx) el.classList.add('correct');
          if (idx === displayOi && !isRightClick) el.classList.add('incorrect');
        });
        const ex = card.querySelector('.explain');
        ex.classList.remove('hidden');
        const isRight = isRightClick;
        ex.innerHTML = `<strong class="${isRight ? 'text-emerald-400' : 'text-rose-400'}">${isRight ? '✓ Correct.' : '✗ Not quite.'}</strong>${q.explain ? ' ' + escapeHtml(q.explain) : ''}`;
        // iter 58: Mistake Tagging chip strip — opt-in concept-tagging UI
        // shown only after a miss. Renders below the explain text inside
        // this same question card so the user can tag without losing
        // context. Dismissible via the X; tap a chip → save + fade strip.
        if (!isRight && !card.querySelector('[data-mistake-strip]')) {
          const strip = document.createElement('div');
          strip.className = 'mistake-strip';
          strip.dataset.mistakeStrip = '1';
          strip.innerHTML = `
            <div class="mistake-strip-header">
              <span class="mistake-strip-prompt">🏷 What tripped you?</span>
              <button class="mistake-strip-dismiss" data-action="dismiss-mistake" aria-label="Dismiss">✕</button>
            </div>
            <div class="mistake-strip-chips">
              ${MISTAKE_TAGS.map(t => `<button class="mistake-chip" data-mistake-tag="${escapeHtml(t.id)}">${escapeHtml(t.label)}</button>`).join('')}
            </div>
          `;
          card.appendChild(strip);
          strip.querySelector('[data-action="dismiss-mistake"]').addEventListener('click', () => {
            strip.classList.add('mistake-strip-fade');
            setTimeout(() => strip.remove(), 220);
          });
          strip.querySelectorAll('.mistake-chip').forEach(chipBtn => {
            chipBtn.addEventListener('click', () => {
              const tag = chipBtn.dataset.mistakeTag;
              recordMiss(lesson.id, 'L1', tag);
              chipBtn.classList.add('mistake-chip-picked');
              // Replace strip with a confirmation line + auto-fade.
              setTimeout(() => {
                strip.innerHTML = `<div class="mistake-strip-confirm">✓ Tagged as "${escapeHtml(MISTAKE_TAGS.find(t => t.id === tag).label)}"</div>`;
                setTimeout(() => {
                  strip.classList.add('mistake-strip-fade');
                  setTimeout(() => strip.remove(), 220);
                }, 1200);
              }, 200);
            });
          });
        }
        maybePassL1();
      });
      optsContainer.appendChild(optEl);
    });
    cardHandles.push({ card, optsContainer });
    wrap.appendChild(card);
  });

  const status = document.createElement('div');
  status.className = 'mt-2 mb-2 flex items-center justify-between flex-wrap gap-2';
  status.innerHTML = `
    <div class="text-sm text-slate-400" id="l1-status">Answer all to pass.</div>
    <div class="flex gap-2 flex-wrap">
      <button class="secondary" data-action="export-l1" title="Copy a prompt with your answers + the right answers to paste into ChatGPT/Claude for tutoring">📋 Ask AI to teach me</button>
      <button class="secondary" data-action="retry-l1">Retry</button>
      <button class="primary hidden" data-action="next-l2">L2 Fill-in →</button>
    </div>
  `;
  wrap.appendChild(status);
  body.appendChild(wrap);

  // Replay any cached locked-state visuals from a prior tab visit. This runs
  // AFTER the cards are in the DOM so classList.add side-effects stick.
  // Iterate in DISPLAY order so cardHandles[displayIdx] lines up.
  localState.qOrder.forEach((qi, displayIdx) => {
    const q = qs[qi];
    const perQ = localState.perQ[qi];
    if (!perQ.locked) return;
    const correctDisplayIdx = perQ.optOrder.indexOf(q.answer);
    const { card, optsContainer } = cardHandles[displayIdx];
    [...optsContainer.children].forEach((el, idx) => {
      el.classList.add('disabled');
      if (idx === correctDisplayIdx) el.classList.add('correct');
      if (idx === perQ.selected && perQ.selected !== correctDisplayIdx) el.classList.add('incorrect');
    });
    const ex = card.querySelector('.explain');
    ex.classList.remove('hidden');
    const isRight = perQ.selected === correctDisplayIdx;
    ex.innerHTML = `<strong class="${isRight ? 'text-emerald-400' : 'text-rose-400'}">${isRight ? '✓ Correct.' : '✗ Not quite.'}</strong>${q.explain ? ' ' + escapeHtml(q.explain) : ''}`;
  });

  status.querySelector('[data-action="retry-l1"]').addEventListener('click', () => {
    _cacheClearLevel(lesson.id, 'L1');
    renderLesson();
  });
  status.querySelector('[data-action="next-l2"]').addEventListener('click', () => selectTab('L2'));

  // Export-to-AI: copy a markdown-formatted prompt containing the lesson
  // context, every question, the user's chosen answer, the correct answer,
  // and the app's explanation. Designed to be pasted into ChatGPT/Claude
  // for tutoring help on what the user missed (or to deepen on what they
  // got right).
  const exportBtn = status.querySelector('[data-action="export-l1"]');
  exportBtn.addEventListener('click', async () => {
    const prompt = buildL1AiPrompt(lesson, content, localState);
    const ok = await copyTextToClipboard(prompt);
    const original = exportBtn.innerHTML;
    exportBtn.innerHTML = ok ? '✓ Copied — paste into AI' : '✗ Copy failed';
    exportBtn.disabled = true;
    setTimeout(() => { exportBtn.innerHTML = original; exportBtn.disabled = false; }, 1800);
  });

  function maybePassL1() {
    const allLocked = localState.perQ.every(p => p.locked);
    if (!allLocked) return;
    const allCorrect = localState.perQ.every((p, qi) => {
      const correctDisplayIdx = p.optOrder.indexOf(qs[qi].answer);
      return p.selected === correctDisplayIdx;
    });
    const statusEl = document.getElementById('l1-status');
    if (allCorrect) {
      statusEl.innerHTML = '<span class="text-emerald-400 font-medium">✓ L1 passed.</span> Onward.';
      status.querySelector('[data-action="next-l2"]').classList.remove('hidden');
      clearWeakness(lesson.id);
      markPassed(lesson.id, 'L1');
    } else {
      statusEl.innerHTML = '<span class="text-amber-400">Some answers were off — hit Retry to start over.</span>';
    }
  }

  // After replay: if the cached state was already fully answered (e.g. user
  // passed L1, switched to Reference, switched back), update the status
  // badge + reveal the next-L2 button without requiring another click.
  maybePassL1();
}

