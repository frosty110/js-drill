// ============================================================================
// QUESTION RENDER
// ============================================================================

// The unit's `brief` is the whiteboard state a real interviewer hands you up
// front: the scoped functional requirements and the scale constants. Without it
// "derive the write QPS" has no derivable answer — the numbers were only ever
// stated inside an earlier question's model answer, which an interleaved
// session may never show you.
//
// Collapsed by default, always: retrieval first, the numbers on one tap.
//
// `brief.gate` lists the question indices whose OWN answer is the brief (the
// scope and estimate steps of the arc) — there it's withheld entirely until the
// reveal, then rendered alongside the model answer, where comparing what you
// said to the real scoping is the point. Indices are positional against
// authored question order, which the append-only content rule keeps stable.
function briefHtml(it, ch, revealed) {
  const b = ch && ch.brief;
  if (!b) return '';
  if (!revealed && Array.isArray(b.gate) && b.gate.includes(it.qIndex)) return '';
  const list = (label, arr) => (arr && arr.length)
    ? `<h5>${label}</h5><ul>${arr.map(x => `<li>${fmt(x)}</li>`).join('')}</ul>` : '';
  const body = list('Functional requirements', b.functional) + list('Scale &amp; constraints', b.scale);
  if (!body) return '';
  return `<details class="q-brief"${revealed ? ' open' : ''}>
      <summary>${revealed ? 'The scoped brief' : 'Requirements &amp; scale'}</summary>
      <div class="q-brief__body">${body}</div>
    </details>`;
}

function renderQuestion() {
  const app = document.getElementById('app');
  if (session.pos >= session.items.length) return renderSummary();
  const it = session.items[session.pos];
  const ch = CH[it.topic][it.chId];
  const q = it.q;
  const total = session.items.length;
  const pct = Math.round(session.pos / total * 100);
  session._wasMastered = isMastered(it.key);

  // The unit label is the retrieval CUE, not a decoration. An interleaved
  // session that withholds it is asking you to "estimate the scale" of nothing:
  // 64% of the design-problem prompts never name their own system, because they
  // were authored for a chapter run where Q1 scoped it. So mixed/due sessions —
  // which shuffle ACROSS units — lead every card with the unit and its authored
  // one-line scope. Interleaving should vary the cue, not delete it.
  // (Chapter and plan sessions already carry it in `session.title`, and the user
  // arrived from that unit's detail screen.)
  // Spelled out ("Problem 14 · Design an Observability Platform"), not the "#"
  // abbreviation used where space is tight — this line's whole job is to be read.
  const unitLabel = `${unitNounCap(it.topic)} ${chNum(ch, it.topic)} · ${esc(ch.title)}`;
  const tag = session.mixed ? unitLabel : `Question ${session.pos + 1} of ${total}`;
  const contextHtml = session.mixed
    ? `<div class="q-context">
         <span class="q-tag">${unitLabel}</span>
         ${ch.summary ? `<p class="q-context__scope">${fmt(ch.summary)}</p>` : ''}
       </div>`
    : '';

  let bodyHtml, hint;
  if (it.type === 'open') {
    bodyHtml = `
      ${contextHtml}
      <span class="q-tag open">Explain &amp; apply</span>
      <p class="q-stem">${fmt(q.prompt)}</p>
      ${briefHtml(it, ch)}
      <p class="open-hint">${icon('mic', 15)}<b>Say your answer out loud</b> as if in the interview — then reveal the model answer and grade yourself honestly.</p>
      <textarea class="open-scratch" placeholder="(optional) jot key points…"></textarea>
      <div id="explain-slot"></div>
      <div class="action-bar" id="action-bar"><button class="cta ds-btn ds-btn--primary" id="reveal-btn">Reveal model answer</button></div>`;
    hint = 'Press <code>Enter</code> or <code>Space</code> to reveal · then <code>1</code> Missed · <code>2</code> Partial · <code>3</code> Got it';
  } else {
    bodyHtml = `
      ${contextHtml}
      ${session.mixed ? '' : `<span class="q-tag">${tag}</span>`}
      <p class="q-stem">${fmt(q.q)}</p>
      ${briefHtml(it, ch)}
      <div class="ds-options" id="opts">
        ${q.options.map((o, i) => `<button class="ds-opt" data-i="${i}"><span class="ds-opt__key">${'ABCD'[i]}</span><span class="ds-opt__body">${fmt(o)}</span></button>`).join('')}
      </div>
      <div id="explain-slot"></div>
      <div class="action-bar" id="action-bar"></div>`;
    hint = 'Tap an answer · keys <code>A–D</code> / <code>1–4</code> to answer, <code>Enter</code> for next';
  }

  app.innerHTML = `
    ${planHud()}
    <div id="progress-wrap"><div id="progress-bar" style="width:${pct}%"></div></div>
    <div class="sess-meta">
      <span>${esc(session.title)} — ${session.pos + 1}/${total}${session.mixed ? '' : ` · <span class="q-tag" style="margin:0;padding:1px 6px">${tag}</span>`}</span>
      <span>${session.streak >= 3 ? `<span class="streak">${icon('flame', 13)}${session.streak} streak</span>` : `${session.right} correct`}<button class="q-link" id="q-link" title="Copy a link to this question" aria-label="Copy a link to this question">${icon('link', 15)}</button></span>
    </div>
    ${bodyHtml}
    <p class="kbd-hint">${hint}</p>`;

  // Per-question link. The drill shows one question at a time, and until now
  // "the thing I'm looking at" had no address at that grain — only the unit did.
  // This copies the STATIC unit page anchored at this question (#qN), which is
  // deliberately not a new app route: a shared "question 3" link that started a
  // drill would touch the recipient's spaced-repetition schedule, and the point
  // here is to hand someone the question, not reschedule their reviews.
  const qLink = document.getElementById('q-link');
  if (qLink) qLink.addEventListener('click', async () => {
    const n = (ch.questions || []).indexOf(q) + 1;
    if (!n || !window.DrillRoutes) return;
    const url = DrillRoutes.shareUrl('sdUnit', { topic: it.topic, unit: it.chId }, null, { anchor: `q${n}` });
    const ok = await copyText(url);
    qLink.innerHTML = icon(ok ? 'check' : 'x', 15);
    qLink.classList.add(ok ? 'is-ok' : 'is-bad');
    setTimeout(() => {
      qLink.innerHTML = icon('link', 15);
      qLink.classList.remove('is-ok', 'is-bad');
    }, 1400);
  });

  session.answered = false;
  if (it.type === 'open') {
    document.getElementById('reveal-btn').addEventListener('click', revealOpen);
  } else {
    app.querySelectorAll('.ds-opt').forEach(el => el.addEventListener('click', () => selectAnswer(parseInt(el.dataset.i, 10))));
  }
  wirePlanHud();
  window.scrollTo(0, 0);
}

// ── MC answer ─────────────────────────────────────────────────────────────
function selectAnswer(choice) {
  if (session.answered) return;
  session.answered = true;
  const it = session.items[session.pos];
  const q = it.q;
  const diagrams = diagramsForItem(it);
  const correct = choice === q.answer;
  grade(it.key, correct ? 'good' : 'again', choice);
  applyOutcome(correct);

  document.querySelectorAll('.ds-opt').forEach((el, i) => {
    el.disabled = true;
    if (i === q.answer) el.classList.add('is-correct');
    else if (i === choice) el.classList.add('is-wrong');
    else el.classList.add('is-muted');
  });
  document.getElementById('explain-slot').innerHTML =
    `<div class="explain ${correct ? 'correct' : 'wrong'}"><span class="verdict ${correct ? 'correct' : 'wrong'}">${correct ? icon('check-circle', 15) + ' Correct.' : icon('x-circle', 15) + ' Not quite.'}</span>${fmt(q.explain)}</div>`
    + (diagrams.length ? `<div id="mc-diag"></div>` : '');
  if (diagrams.length) renderDiagramDeck(document.getElementById('mc-diag'), diagrams, 'Answer visual');
  showNext();
}

// ── Open reveal + self-grade ───────────────────────────────────────────────
function revealOpen() {
  if (session.answered) return;
  session.answered = true;
  const it = session.items[session.pos];
  const q = it.q;
  const ch = CH[it.topic][it.chId];
  const diagrams = diagramsForItem(it);
  // A gated brief (see briefHtml) surfaces here and only here — after you've
  // committed to an answer, so it grades you rather than feeding you.
  const gated = ch && ch.brief && Array.isArray(ch.brief.gate) && ch.brief.gate.includes(it.qIndex);
  document.getElementById('explain-slot').innerHTML = `
    <div class="model">
      <h4>Key points to hit</h4>
      <ul>${(q.points || []).map(p => `<li>${fmt(p)}</li>`).join('')}</ul>
      <div class="ans">${fmt(q.answer || '')}</div>
      ${gated ? briefHtml(it, ch, true) : ''}
      ${diagrams.length ? `<div id="reveal-diag"></div>` : ''}
    </div>`;
  if (diagrams.length) renderDiagramDeck(document.getElementById('reveal-diag'), diagrams, 'Answer visual');
  document.getElementById('action-bar').innerHTML = `
    <button class="cta ds-btn again" data-g="again">Missed</button>
    <button class="cta ds-btn partial" data-g="partial">Partial</button>
    <button class="cta ds-btn good" data-g="good">Got it</button>`;
  document.querySelectorAll('#action-bar .cta').forEach(el => el.addEventListener('click', () => gradeOpen(el.dataset.g)));
}
function gradeOpen(outcome) {
  const it = session.items[session.pos];
  grade(it.key, outcome);
  applyOutcome(outcome === 'good');
  nextQuestion();
}

function applyOutcome(good) {
  const it = session.items[session.pos];
  if (good) { session.right++; session.streak++; if (!session._wasMastered && isMastered(it.key)) session.gained++; }
  else { session.streak = 0; }
}
function showNext() {
  const last = session.pos === session.items.length - 1;
  document.getElementById('action-bar').innerHTML = `<button class="cta ds-btn ds-btn--primary" id="next-btn">${last ? 'Finish →' : 'Next →'}</button>`;
  document.getElementById('next-btn').addEventListener('click', nextQuestion);
  wirePlanHud();
}
function nextQuestion() { session.pos++; renderQuestion(); }

