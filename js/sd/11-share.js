// ============================================================================
// SHARE — a URL carrying this unit's result set, for an AI to tutor from
// ============================================================================
// Built on demand from the Leitner boxes; no share records, no cache. The
// path resolves to a static page (tools/build-share-pages.js) that carries
// the questions, the model answers and the legend for the code — so an agent
// handed the URL can decode the result set with nothing but what it fetches.
// Topic-dependent mix: DDIA / interview-method / components are mostly MC (so
// their codes read as letters, carrying the distractor), while the canonical
// design problems are ~78% open self-graded (Y/p/n). See docs/share-urls.md.

function unitShareCode(t, ch) {
  if (!window.DrillShare) return '';
  return DrillShare.encodeUnit(chapterItems(t, ch).map(it => {
    const b = progress.boxes[it.key];
    if (!b || !b.lastOutcome) return null;                    // never attempted → '-'
    if (it.type === 'mc' && typeof b.lastPick === 'number') {
      return { picked: b.lastPick, correct: it.q.answer };
    }
    return b.lastOutcome;
  }));
}

function unitShareUrl(t, ch) {
  if (!window.DrillRoutes) return '';
  return DrillRoutes.shareUrl('sdUnit', { topic: t, unit: ch.id }, unitShareCode(t, ch));
}

// The framing is built from the unit's ACTUAL question-type mix, not assumed.
// The topics differ sharply — DDIA and components are mostly multiple choice
// (where the code carries the exact distractor picked, the most diagnostic
// thing in the whole payload), while the canonical design problems are mostly
// spoken and self-graded (where all the code can carry is the self-grade). A
// fixed "these are spoken questions" framing throws away the distractors on
// three of the four topics and points the AI at rubric points that MC
// questions do not have.
function buildUnitAiPayload(t, ch) {
  const url = unitShareUrl(t, ch);
  const code = unitShareCode(t, ch);
  const items = chapterItems(t, ch);
  const decoded = DrillShare.decodeUnit(code);

  const mc = { attempted: 0, right: 0, wrong: 0 };
  const open = { attempted: 0, good: 0, partial: 0, missed: 0 };
  items.forEach((it, i) => {
    const d = decoded[i];
    if (!d || !d.attempted) return;
    if (it.type === 'mc') {
      mc.attempted++;
      if (d.credit === 'full') mc.right++; else mc.wrong++;
    } else {
      open.attempted++;
      if (d.credit === 'full') open.good++;
      else if (d.credit === 'partial') open.partial++;
      else open.missed++;
    }
  });

  const lines = [
    `I'm preparing for a system design interview and just drilled "${ch.title}" (${META[t].title}). Here's the page, with my results encoded in the URL:`,
    '',
    url,
    '',
    'Open it — it has every question, the model answers and the rubric points, plus a legend for the `s=` code. That code is my result set, one character per question in the order they appear on the page.',
    ''
  ];

  const score = [];
  if (mc.attempted) score.push(`${mc.right}/${mc.attempted} on the multiple-choice questions`);
  if (open.attempted) score.push(`${open.good} solid, ${open.partial} partial, ${open.missed} missed on the open questions`);
  lines.push(score.length ? `I scored ${score.join('; ')}.` : "I haven't answered anything in this unit yet.");
  lines.push('');

  if (mc.wrong) {
    lines.push('For the multiple choice, the code records **which option I picked**, not just whether I was right — a lowercase letter is the wrong option I chose. Work from that: the specific distractor that pulled me usually says more about the gap than the miss does. Explain what would have to be true for my answer to be right, and what that reveals I am confusing it with.');
    lines.push('');
  }
  if (open.partial || open.missed) {
    lines.push('The open questions are answered out loud, so you have my self-grade but not my words. Ask me the ones I marked partial or missed, one at a time, and hold me to the rubric points on the page — then tell me what a strong answer adds.');
    lines.push('');
  }
  if (!mc.wrong && !open.partial && !open.missed && (mc.attempted || open.attempted)) {
    lines.push('I got these right, so go the other way: pick the two or three that matter most in a real interview and push me past recall — ask the follow-up an interviewer would ask next, and make me defend the trade-off.');
    lines.push('');
  }
  lines.push('Ask me one question at a time.');
  return lines.join('\n');
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch (_) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-9999px';
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
  } catch (_) { return false; }
}

function openShareSheet(t, ch) {
  if (!window.DrillShare) return;
  const url = unitShareUrl(t, ch);
  const code = unitShareCode(t, ch);
  const s = DrillShare.summarize(DrillShare.decodeUnit(code));
  const hasCode = /[A-Ha-hYpn]/.test(code);

  document.getElementById('share-sheet')?.remove();
  const scrim = document.createElement('div');
  scrim.className = 'ds-root ds-scrim is-open';
  scrim.id = 'share-sheet';
  scrim.innerHTML = `
    <div class="ds-sheet ds-sheet--scroll" role="dialog" aria-modal="true" aria-label="Share this unit">
      <div class="share-head">
        <h2 class="ds-h2">Share</h2>
        <button class="ds-iconbtn" data-share-close aria-label="Close share">${icon('x', 20)}</button>
      </div>
      <p class="share-lede">A link to <strong>${esc(ch.title)}</strong>${hasCode ? ` carrying your results — ${s.full} solid, ${s.partial} partial, ${s.missed} missed` : ''}. Paste it to an AI to be drilled on exactly what you're shaky on.</p>
      <input class="ds-field share-url" data-share-url readonly value="${esc(url)}" aria-label="Share URL" spellcheck="false">
      <p class="share-code">${hasCode
        ? `Your results: <code>${esc(code)}</code> — <code>Y</code> got it, <code>p</code> partial, <code>n</code> missed, <code>-</code> not attempted.`
        : `You haven't drilled this unit yet, so the link carries the questions only.`}</p>
      <div class="share-actions">
        <button class="ds-btn ds-btn--primary ds-btn--block" data-share-copy>Copy link</button>
        <button class="ds-btn ds-btn--block" data-share-ai>Copy for AI</button>
      </div>
      <p class="share-foot">Opens a plain page with every question, the model answers and a legend for the code — no sign-in, nothing stored anywhere.</p>
    </div>`;
  document.body.appendChild(scrim);

  const close = () => scrim.remove();
  scrim.addEventListener('click', e => { if (e.target === scrim) close(); });
  scrim.querySelector('[data-share-close]').addEventListener('click', close);
  const field = scrim.querySelector('[data-share-url]');
  field.addEventListener('focus', () => field.select());

  // The confirmation carries an icon, so it restores innerHTML rather than
  // textContent — the latter would strip the button's own glyphs on the way back.
  const flash = (btn, ok) => {
    const original = btn.innerHTML;
    btn.innerHTML = ok ? icon('check', 15) + ' Copied' : icon('alert', 15) + ' Copy failed';
    btn.disabled = true;
    setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 1600);
  };
  scrim.querySelector('[data-share-copy]').addEventListener('click', async e => {
    const btn = e.currentTarget;
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: ch.title, url }); return; } catch (_) {}
    }
    flash(btn, await copyText(url));
  });
  scrim.querySelector('[data-share-ai]').addEventListener('click', async e => {
    flash(e.currentTarget, await copyText(buildUnitAiPayload(t, ch)));
  });
}

