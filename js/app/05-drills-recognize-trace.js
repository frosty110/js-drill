function _recognizeBuildDeck() {
  // Only patterns-track full lessons with a valid prompt.
  const pool = CURRICULUM.filter(l => l.track === 'patterns' && l.status === 'full');
  // Section names with ≥2 lessons (need siblings for distractor pool).
  const sectionCounts = {};
  for (const l of pool) sectionCounts[l.section] = (sectionCounts[l.section] || 0) + 1;
  const eligibleSections = Object.keys(sectionCounts).filter(s => sectionCounts[s] >= 1);
  if (eligibleSections.length < 4) return null;  // need at least 4 sections for 4-option MC
  // SR/weakness-weighted lesson pick — lessons the user owes attention
  // (overdue SR or weakness > 0) surface preferentially. See
  // `_srPriorityShuffle` in slice 04.
  const shuffled = _srPriorityShuffle(pool, l => l.id);
  const cards = [];
  for (const lesson of shuffled) {
    if (cards.length >= RECOGNIZE_SESSION_LEN) break;
    const content = CONTENT[lesson.id];
    const prompt = content?.L3?.prompt;
    if (!prompt) continue;  // skip lessons not yet loaded; we'll backfill
    const correct = lesson.section;
    const others = eligibleSections.filter(s => s !== correct).sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [correct, ...others].sort(() => Math.random() - 0.5);
    cards.push({ lessonId: lesson.id, prompt, correct, options });
  }
  return cards.length >= 3 ? cards : null;
}

async function startRecognizeSession() {
  // Backfill: load content for the first N patterns lessons so the deck builder
  // has prompts to work with (most are stub-loaded). Limit to avoid mass fetch.
  const patternsLessons = CURRICULUM.filter(l => l.track === 'patterns' && l.status === 'full').slice(0, 30);
  for (const l of patternsLessons) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
      if (Object.keys(CONTENT).length >= 12) break;  // enough variety
    }
  }
  const deck = _recognizeBuildDeck();
  if (!deck || deck.length < 3) {
    alert('Recognize needs more loaded patterns lessons. Click around a few patterns first, then try again.');
    return;
  }
  let idx = 0, correct = 0, startedAt = Date.now(), times = [];
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    const cardStarted = Date.now();
    shell.innerHTML = `
      <div class="recognize-shell">
        <div class="recognize-header">
          <span>🔎 Recognize · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-recognize">✕ Exit</button>
        </div>
        <div class="recognize-prompt">${escapeHtml(card.prompt)}</div>
        <div class="recognize-options">
          ${card.options.map(opt => `<button class="recognize-opt" data-opt="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join('')}
        </div>
        <div class="recognize-feedback" data-recognize-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-recognize"]').addEventListener('click', () => { renderLesson(); });
    const opts = shell.querySelectorAll('.recognize-opt');
    let answered = false;
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const picked = btn.dataset.opt;
        const wasCorrect = picked === card.correct;
        if (wasCorrect) correct++;
        else {
          // Per-lesson weakness signal + history event so a missed
          // diagnose-the-pattern card surfaces in Today's Plan, At-Risk,
          // and downstream weak-spot queries — mirrors Reverse `:585`.
          state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
          appendHistory(card.lessonId, 'L1-miss');
        }
        times.push(Date.now() - cardStarted);
        state.recognize.attempts++;
        if (wasCorrect) state.recognize.correct++;
        saveProgress();
        opts.forEach(b => {
          b.disabled = true;
          if (b.dataset.opt === card.correct) b.classList.add('recognize-opt-correct');
          else if (b === btn) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-recognize-feedback]');
        fb.innerHTML = wasCorrect
          ? `<span class="recognize-good">✓ ${escapeHtml(card.correct)}</span>`
          : `<span class="recognize-bad">✗ Was: ${escapeHtml(card.correct)}</span>`;
        setTimeout(() => { idx++; renderCard(); }, wasCorrect ? 700 : 1400);
      });
    });
  }
  function renderSummary() {
    const total = Date.now() - startedAt;
    const median = times.slice().sort((a, b) => a - b)[Math.floor(times.length / 2)] || 0;
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell">
        <div class="recognize-header"><span>🔎 Recognize · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} correct</div>
          <div class="recognize-summary-line">Median time per card: ${(median / 1000).toFixed(1)}s</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.recognize.correct} / ${state.recognize.attempts} (${state.recognize.attempts > 0 ? Math.round(state.recognize.correct / state.recognize.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="recognize-again">🔎 Another session</button>
            <button class="secondary" data-action="recognize-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="recognize-again"]').addEventListener('click', () => startRecognizeSession());
    shell.querySelector('[data-action="recognize-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 75: ⏱ Big-O Speed Drill — concentrates the iter-27 audit theme #4
// ("complexity-question fatigue distributed across normal lessons") into a
// trainable surface. Pure recombination of existing L1 questions filtered to
// complexity-flavored q-text (matches /complex|O\(|big.?o/i). Routes through
// startRapidFireSession by passing a pre-built filtered deck so the entire
// shell — letter chips, 7-sec timer, streak counter, summary — is reused
// with zero new render code. From `ideas-by-category.md § 9C Adaptation`.
const BIG_O_SESSION_LEN = 12; // shorter than Rapid (20) — complexity Qs are denser
const BIG_O_FILTER_RE = /\b(complex|O\(|big[\s-]?o|amortized|asymptotic)\b/i;
function _bigOBuildDeck() {
  const pool = [];
  for (const lesson of CURRICULUM) {
    if (lesson.status !== 'full') continue;
    const content = CONTENT[lesson.id];
    if (!content || !content.L1 || !Array.isArray(content.L1.questions)) continue;
    for (const q of content.L1.questions) {
      if (!q || !BIG_O_FILTER_RE.test(q.q || '')) continue;
      if (!Array.isArray(q.options) || q.options.length < 2) continue;
      if (typeof q.answer !== 'number') continue;
      const optOrder = _shuffleIndices(q.options.length);
      pool.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        sectionName: lesson.section,
        q: q.q,
        options: optOrder.map(i => q.options[i]),
        answerIdx: optOrder.indexOf(q.answer),
        explain: q.explain || ''
      });
    }
  }
  if (pool.length < 5) return null;
  // Fisher-Yates shuffle then slice.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, BIG_O_SESSION_LEN);
}

async function startBigOSession() {
  // Preload patterns + algorithms (where complexity Qs concentrate) so the
  // deck has variety beyond just the few lessons the user has clicked.
  const sample = CURRICULUM.filter(l =>
    l.status === 'full' && (l.track === 'patterns' || l.section === 'Algorithms')
  ).slice(0, 24);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  const deck = _bigOBuildDeck();
  if (!deck || deck.length < 5) {
    alert('Big-O drill needs more loaded lessons. Click around a few patterns lessons first, then try again.');
    return;
  }
  // Reuse Rapid-Fire's session shell directly — same deck shape, same
  // letter-chip + 7-sec-timer + streak mechanics. Passing the prebuilt deck
  // skips Rapid-Fire's full-corpus preload (heavier) and shorter session
  // length matches the denser concentration of complexity Qs.
  return _runRapidFireWithDeck(deck, { label: '⏱ Big-O', emoji: '⏱' });
}

// iter 83: 🎰 Gotcha Roulette — standalone recall stream over reference.notes[].
// The `notes[]` corpus (2-5 strings × 143 lessons = ~400 cards) has been
// on-disk since project start and is read by ~zero surfaces — every existing
// surface treats notes as ornamentation around code. This surface treats them
// as the atomic recall unit: one note per card, lesson title hidden; user
// 2-taps "knew it" / "didn't"; reveal shows lesson + deep-link CTA. Trains
// surfacing the half-remembered traps (off-by-one, mutation footguns,
// coercion edges) without the navigation cost of opening each lesson.
// From `ideas-by-category.md § 1 → Gotcha Roulette` (iter-82 vision top pick).
const GOTCHA_DECK_LEN = 8;
async function _gotchaBuildDeck() {
  // Preload a broad sample across all tracks so the pool has variety.
  const sample = CURRICULUM.filter(l => l.status === 'full').slice(0, 60);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
      if (Object.keys(CONTENT).length >= 30) break;
    }
  }
  // Flatten all notes across all loaded lessons.
  const pool = [];
  for (const lesson of CURRICULUM) {
    const c = CONTENT[lesson.id];
    if (!c || !c.reference || !Array.isArray(c.reference.notes)) continue;
    for (let ni = 0; ni < c.reference.notes.length; ni++) {
      const note = c.reference.notes[ni];
      if (typeof note !== 'string' || note.length < 20) continue; // skip thin ornament
      pool.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        sectionName: lesson.section,
        note
      });
    }
  }
  if (pool.length < 4) return null;
  // Fisher-Yates shuffle.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, GOTCHA_DECK_LEN);
}

async function startGotchaSession() {
  const deck = await _gotchaBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Gotcha needs more loaded lessons. Click around a few first, then try again.');
    return;
  }
  state.gotcha.sessions++;
  state.gotcha.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, knew = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell gotcha-shell">
        <div class="recognize-header">
          <span>🎰 Gotcha · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-gotcha">✕ Exit</button>
        </div>
        <div class="gotcha-tag">${escapeHtml(card.sectionName)} · ??? </div>
        <div class="gotcha-note">${escapeHtml(card.note)}</div>
        <div class="gotcha-options">
          <button class="recognize-opt gotcha-opt" data-pick="knew">✓ Knew it</button>
          <button class="recognize-opt gotcha-opt" data-pick="didnt">✗ Didn't</button>
        </div>
        <div class="recognize-feedback" data-gotcha-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-gotcha"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.gotcha-opt');
    let answered = false;
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const wasKnew = btn.dataset.pick === 'knew';
        if (wasKnew) knew++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.gotcha.attempts++;
        if (wasKnew) state.gotcha.correct++;
        saveProgress();
        opts.forEach(b => b.disabled = true);
        btn.classList.add(wasKnew ? 'recognize-opt-correct' : 'recognize-opt-wrong');
        const fb = shell.querySelector('[data-gotcha-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="gotcha-reveal">
              <div class="gotcha-reveal-title">${escapeHtml(card.lessonTitle)}</div>
              <div class="gotcha-reveal-section">${escapeHtml(card.sectionName)}</div>
              <button class="gotcha-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="gotcha-next" data-action="gotcha-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="gotcha-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((knew / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell gotcha-shell">
        <div class="recognize-header"><span>🎰 Gotcha · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${knew} of ${deck.length} traps recognized · ${deck.length - knew} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.gotcha.correct} / ${state.gotcha.attempts} (${state.gotcha.attempts > 0 ? Math.round(state.gotcha.correct / state.gotcha.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="gotcha-again">🎰 Another spin</button>
            <button class="secondary" data-action="gotcha-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="gotcha-again"]').addEventListener('click', () => startGotchaSession());
    shell.querySelector('[data-action="gotcha-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 91: 🎬 Conversation Drill — interview-arc classifier over the 99 Patterns
// + Applied lessons' `conversation.sections[]` corpus. Each card shows ONE
// .say paragraph with the section title HIDDEN; user taps which of the 6
// fixed interview-phase types it is (Restate / Brute force / Spot pattern /
// Trace / Edges / Complexity). Reveal shows actual title + source lesson +
// "Drill this lesson →" deep-link. Misses route to state.weakness via existing
// path. First surface to test the interview-arc skill — recruiters grade the
// arc, not just the code, and 495 authored paragraphs across 99 lessons have
// never been used as a recall corpus. From roadmap.md iter-90 #1 (vision iter
// top promoted entry). Reuses .recognize-* shell base + Gotcha card structure.
const CONV_DRILL_DECK_LEN = 10;
const CONV_DRILL_MIN_SAY_LEN = 100;
const CONV_DRILL_PHASES = [
  { idx: 1, label: '🎯 Restate', hint: 'Clarify the problem' },
  { idx: 2, label: '🧱 Brute force', hint: 'Naive solution first' },
  { idx: 3, label: '💡 Spot pattern', hint: 'Identify the technique' },
  { idx: 4, label: '🔍 Trace', hint: 'Walk through an example' },
  { idx: 5, label: '⚠️ Edge cases', hint: 'Boundary conditions' },
  { idx: 6, label: '📏 Complexity', hint: 'Big-O & wrap-up' }
];
function _convDrillPhaseIdx(title) {
  // Titles like "1. Restate & clarify" / "3. Spot the pattern — API shape…".
  // Extract the leading digit to bucket. Returns 1..6 or 0 if unparseable.
  if (typeof title !== 'string') return 0;
  const m = title.match(/^\s*([1-6])\b/);
  return m ? +m[1] : 0;
}
async function _convDrillBuildDeck() {
  // Preload Patterns/Applied lessons broadly — these are the only tracks with
  // conversation blocks (99/99 per OOB-2026-05-24).
  const candidates = CURRICULUM.filter(l =>
    l.status === 'full' && (l.track === 'patterns' || l.track === 'applied')
  );
  // Fisher-Yates shuffle candidates so the preload sample varies per session.
  const shuffled = candidates.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Cap preloads at 40 to keep session startup fast on first-run.
  const sample = shuffled.slice(0, 40);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  // Flatten all eligible sections across loaded lessons.
  const pool = [];
  for (const lesson of CURRICULUM) {
    if (lesson.track !== 'patterns' && lesson.track !== 'applied') continue;
    const c = CONTENT[lesson.id];
    if (!c || !c.conversation || !Array.isArray(c.conversation.sections)) continue;
    for (const s of c.conversation.sections) {
      const say = (s && typeof s.say === 'string') ? s.say : '';
      if (say.length < CONV_DRILL_MIN_SAY_LEN) continue; // skip empty/thin sections
      const idx = _convDrillPhaseIdx(s.title);
      if (idx < 1 || idx > 6) continue;
      pool.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        sectionName: lesson.section,
        sectionTitle: s.title,
        say,
        phaseIdx: idx
      });
    }
  }
  if (pool.length < 4) return null;
  // Fisher-Yates shuffle the pool.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(CONV_DRILL_DECK_LEN, pool.length));
}

async function startConvDrillSession() {
  const deck = await _convDrillBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Conversation Drill needs more loaded lessons. Click around a few Patterns lessons first, then try again.');
    return;
  }
  state.convDrill.sessions++;
  state.convDrill.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell conv-drill-shell">
        <div class="recognize-header">
          <span>🎬 Conv · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-conv">✕ Exit</button>
        </div>
        <div class="conv-drill-tag">Which phase of the interview is this?</div>
        <div class="conv-drill-say">${escapeHtml(card.say)}</div>
        <div class="conv-drill-options">
          ${CONV_DRILL_PHASES.map(p => `
            <button class="recognize-opt conv-drill-opt" data-phase="${p.idx}" title="${escapeHtml(p.hint)}">
              ${escapeHtml(p.label)}
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-conv-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-conv"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.conv-drill-opt');
    let answered = false;
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const picked = +btn.dataset.phase;
        const wasRight = picked === card.phaseIdx;
        if (wasRight) correct++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.convDrill.attempts++;
        if (wasRight) state.convDrill.correct++;
        saveProgress();
        opts.forEach(b => {
          b.disabled = true;
          const pIdx = +b.dataset.phase;
          if (pIdx === card.phaseIdx) b.classList.add('recognize-opt-correct');
          else if (b === btn) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-conv-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="conv-drill-reveal">
              <div class="conv-drill-reveal-title">${escapeHtml(card.sectionTitle)}</div>
              <div class="conv-drill-reveal-lesson">${escapeHtml(card.lessonTitle)} · ${escapeHtml(card.sectionName)}</div>
              <button class="conv-drill-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="conv-drill-next" data-action="conv-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="conv-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell conv-drill-shell">
        <div class="recognize-header"><span>🎬 Conv · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} phases identified · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.convDrill.correct} / ${state.convDrill.attempts} (${state.convDrill.attempts > 0 ? Math.round(state.convDrill.correct / state.convDrill.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="conv-again">🎬 Another session</button>
            <button class="secondary" data-action="conv-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="conv-again"]').addEventListener('click', () => startConvDrillSession());
    shell.querySelector('[data-action="conv-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 93: 🧬 Trace-Hop — pick-the-middle-state mobile quiz over
// `walkthrough.trace` yields. Each card shows 3 CONSECUTIVE trace frames
// (K-1, K, K+1) with the MIDDLE frame's `state` panel BLANKED; user taps
// which of 4 state-objects fits there. Distractors are sampled from OTHER
// frames of the SAME trace (not other lessons) so the user reasons about
// "which step belongs here" rather than type-matching. Distinct from
// 🪲 Walkthrough Bug-Hunt (which mutates a state value and asks "which row
// is corrupted") — Trace-Hop tests positional state recall, the mental
// model the rusty engineer needs to WRITE the code from scratch.
// From roadmap.md iter-90 #2 (vision iter — 2nd promoted entry). Reuses
// the Walkthrough engine's compiled trace + step-key dedup logic from
// _pickQuizOptions (iter 36) + .recognize-* shell base.
const TRACE_HOP_DECK_LEN = 8;
function _traceHopStepKey(s) {
  try { return JSON.stringify({ line: s.line, label: s.label, state: s.state }); }
  catch (_) { return Math.random().toString(); }
}
function _traceHopBuildCard(lesson, content) {
  // Compile the lesson's walkthrough. Returns { byExample, error }.
  const compiled = _compileWalkthrough(lesson.id, content.walkthrough);
  if (compiled.error || !Array.isArray(compiled.byExample)) return null;
  // Pick a random example with enough steps.
  const usable = compiled.byExample.filter(b => !b.error && Array.isArray(b.steps) && b.steps.length >= 5);
  if (!usable.length) return null;
  const block = usable[Math.floor(Math.random() * usable.length)];
  const steps = block.steps;
  // Pick a middle frame K such that K-1 and K+1 both exist.
  const candidatesK = [];
  for (let K = 1; K < steps.length - 1; K++) {
    // Only K's with at least one state key (so the blanked panel isn't empty).
    if (steps[K].state && typeof steps[K].state === 'object' && Object.keys(steps[K].state).length > 0) {
      candidatesK.push(K);
    }
  }
  if (!candidatesK.length) return null;
  const K = candidatesK[Math.floor(Math.random() * candidatesK.length)];
  const correct = steps[K];
  // Distractor pool: other frames of THE SAME TRACE excluding K-1, K, K+1
  // (K-1 and K+1 are visible in the card → would be trivially-wrong giveaways).
  const seen = new Set([_traceHopStepKey(correct), _traceHopStepKey(steps[K - 1]), _traceHopStepKey(steps[K + 1])]);
  const distractorPool = [];
  for (let i = 0; i < steps.length; i++) {
    if (i === K - 1 || i === K || i === K + 1) continue;
    const s = steps[i];
    if (!s || !s.state || typeof s.state !== 'object') continue;
    const k = _traceHopStepKey(s);
    if (seen.has(k)) continue;
    seen.add(k);
    distractorPool.push({ step: s, idx: i });
  }
  if (distractorPool.length < 3) return null;
  // Fisher-Yates shuffle the pool; take first 3.
  for (let i = distractorPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [distractorPool[i], distractorPool[j]] = [distractorPool[j], distractorPool[i]];
  }
  const distractors = distractorPool.slice(0, 3);
  const options = [
    { step: correct, idx: K, isCorrect: true },
    ...distractors.map(d => ({ step: d.step, idx: d.idx, isCorrect: false }))
  ];
  // Shuffle option positions so correct isn't always first.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    sectionName: lesson.section,
    exampleLabel: block.example && block.example.label ? block.example.label : '',
    framePrev: steps[K - 1],
    frameNext: steps[K + 1],
    correctIdx: K,
    options
  };
}
async function _traceHopBuildDeck() {
  // Preload Patterns/Applied lessons — only those with walkthrough blocks.
  const candidates = CURRICULUM.filter(l =>
    l.status === 'full' && (l.track === 'patterns' || l.track === 'applied')
  );
  // Fisher-Yates shuffle so each session pulls a different sample.
  const shuffled = candidates.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Try lessons one by one until we've built enough cards.
  const deck = [];
  for (const lesson of shuffled) {
    if (deck.length >= TRACE_HOP_DECK_LEN) break;
    if (!CONTENT[lesson.id]) {
      try { await loadLessonContent(lesson.id); } catch (_) { continue; }
    }
    const c = CONTENT[lesson.id];
    if (!c || !c.walkthrough || !Array.isArray(c.walkthrough.examples)) continue;
    const card = _traceHopBuildCard(lesson, c);
    if (card) deck.push(card);
  }
  if (deck.length < 4) return null;
  return deck;
}

function _traceHopFormatState(stateObj) {
  if (!stateObj || typeof stateObj !== 'object') return '<span class="trace-hop-state-empty">(no state)</span>';
  const rows = Object.entries(stateObj).map(([k, v]) =>
    `<div class="trace-hop-state-row"><span class="trace-hop-state-key">${escapeHtml(k)}</span><span class="trace-hop-state-val">${escapeHtml(_formatStateVal(v))}</span></div>`
  );
  return rows.join('');
}

async function startTraceHopSession() {
  const deck = await _traceHopBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Trace-Hop needs more lessons with walkthroughs. Click around a few Patterns lessons first, then try again.');
    return;
  }
  state.traceHop.sessions++;
  state.traceHop.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    const exampleLine = card.exampleLabel
      ? `<div class="trace-hop-meta">Example: <span class="trace-hop-meta-em">${escapeHtml(card.exampleLabel)}</span></div>`
      : '';
    shell.innerHTML = `
      <div class="recognize-shell trace-hop-shell">
        <div class="recognize-header">
          <span>🧬 Trace-Hop · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-trace-hop">✕ Exit</button>
        </div>
        ${exampleLine}
        <div class="trace-hop-tag">Which state fits the middle frame?</div>
        <div class="trace-hop-frames">
          <div class="trace-hop-frame trace-hop-frame-side">
            <div class="trace-hop-frame-head"><span class="trace-hop-frame-pos">Step ${card.correctIdx}</span><span class="trace-hop-frame-line">line ${escapeHtml(String(card.framePrev.line))}</span></div>
            <div class="trace-hop-frame-label">${escapeHtml(card.framePrev.label || '')}</div>
            <div class="trace-hop-frame-state">${_traceHopFormatState(card.framePrev.state)}</div>
          </div>
          <div class="trace-hop-frame trace-hop-frame-middle">
            <div class="trace-hop-frame-head"><span class="trace-hop-frame-pos">Step ${card.correctIdx + 1}</span><span class="trace-hop-frame-line">line ${escapeHtml(String(card.options[0].step.line))}</span></div>
            <div class="trace-hop-frame-label">${escapeHtml(card.options.find(o => o.isCorrect).step.label || '')}</div>
            <div class="trace-hop-frame-state trace-hop-frame-state-blank">?  ?  ?</div>
          </div>
          <div class="trace-hop-frame trace-hop-frame-side">
            <div class="trace-hop-frame-head"><span class="trace-hop-frame-pos">Step ${card.correctIdx + 2}</span><span class="trace-hop-frame-line">line ${escapeHtml(String(card.frameNext.line))}</span></div>
            <div class="trace-hop-frame-label">${escapeHtml(card.frameNext.label || '')}</div>
            <div class="trace-hop-frame-state">${_traceHopFormatState(card.frameNext.state)}</div>
          </div>
        </div>
        <div class="trace-hop-options">
          ${card.options.map((o, i) => `
            <button class="recognize-opt trace-hop-opt" data-opt="${i}">
              <span class="trace-hop-opt-letter">${String.fromCharCode(65 + i)}</span>
              <span class="trace-hop-opt-state">${_traceHopFormatState(o.step.state)}</span>
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-trace-hop-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-trace-hop"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.trace-hop-opt');
    let answered = false;
    optBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const optIdx = +btn.dataset.opt;
        const picked = card.options[optIdx];
        const wasRight = !!picked.isCorrect;
        if (wasRight) correct++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.traceHop.attempts++;
        if (wasRight) state.traceHop.correct++;
        saveProgress();
        optBtns.forEach((b, i) => {
          b.disabled = true;
          if (card.options[i].isCorrect) b.classList.add('recognize-opt-correct');
          else if (i === optIdx) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-trace-hop-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="trace-hop-reveal">
              <div class="trace-hop-reveal-title">${wasRight ? '✓ Got it' : '✗ The middle state was option ' + String.fromCharCode(65 + card.options.findIndex(o => o.isCorrect))}</div>
              <div class="trace-hop-reveal-lesson">${escapeHtml(card.lessonTitle)} · ${escapeHtml(card.sectionName)}</div>
              <button class="trace-hop-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="trace-hop-next" data-action="trace-hop-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="trace-hop-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell trace-hop-shell">
        <div class="recognize-header"><span>🧬 Trace-Hop · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} states identified · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.traceHop.correct} / ${state.traceHop.attempts} (${state.traceHop.attempts > 0 ? Math.round(state.traceHop.correct / state.traceHop.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="trace-hop-again">🧬 Another session</button>
            <button class="secondary" data-action="trace-hop-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="trace-hop-again"]').addEventListener('click', () => startTraceHopSession());
    shell.querySelector('[data-action="trace-hop-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 97: 📝 Notes Cloze Tap-Drill — cloze-MC over `reference.notes[]` text.
// Each card shows ONE note string with one keyword blanked + 4 tap options.
// Distractors sampled from notes in OTHER lessons (preferring same section
// for plausibility). Third recall direction over the notes corpus —
// distinct from 🎰 Gotcha (whole-note yes/no recognition) and 🃏 Flash
// (canonical-code cloze). Forces actual keyword recall (not just affirm
// familiarity), which is closer to interview pressure. From roadmap.md
// iter-95 #1 (vision iter top promoted entry).
const NOTES_DRILL_DECK_LEN = 12;
const NOTES_DRILL_STOP_WORDS = new Set([
  'the','a','an','and','or','but','if','then','else','when','that','this',
  'these','those','it','its','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should',
  'may','might','must','can','to','of','in','on','at','by','for','from',
  'with','as','into','about','over','under','than','so','not','no','yes',
  'you','your','they','their','we','our','my','his','her','one','two',
  'any','all','some','each','every','same','only','other','many','also',
  'use','used','uses','make','makes','take','takes','give','gives','get',
  'gets','put','puts','set','sets','because','while','since','until',
  'where','what','which','who','how','very','much','more','most','less'
]);
// Strip leading + trailing non-alphanumeric/underscore characters (so
// "reduce)." → "reduce", "__v" → "__v"). Internal `.` and `-` survive
// (so "Array.from" and "freq-map" stay intact when surrounded by letters
// because the regex anchors only at start/end).
function _notesStripPunct(token) {
  return token.replace(/^[^a-zA-Z0-9_]+|[^a-zA-Z0-9_]+$/g, '');
}
function _notesIsEligibleWord(token) {
  const stripped = _notesStripPunct(token);
  if (stripped.length < 4) return false;
  if (NOTES_DRILL_STOP_WORDS.has(stripped.toLowerCase())) return false;
  // Require at least one letter (skip pure numbers / pure punctuation).
  if (!/[a-zA-Z]/.test(stripped)) return false;
  return true;
}
// Pick a keyword to blank in a note. Strategy: walk tokens in reverse —
// the LAST eligible distinctive word is usually the load-bearing term
// in a one-line gotcha (e.g., "splice mutates the array" → "array",
// or better "mutates"; tested on real corpus iter-97). Returns null
// when no eligible word found (caller skips the note).
function _notesPickBlank(noteText) {
  if (typeof noteText !== 'string') return null;
  const tokens = noteText.split(/(\s+)/); // keep whitespace tokens for re-join
  // Walk in reverse over non-whitespace tokens.
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (!t || /^\s+$/.test(t)) continue;
    if (!_notesIsEligibleWord(t)) continue;
    const stripped = _notesStripPunct(t);
    // Find the exact position of `stripped` inside the original token
    // (token may have surrounding punctuation we want to keep).
    const startInTok = t.indexOf(stripped);
    if (startInTok < 0) continue;
    // Reconstruct: leading-tokens + leading-punct + ___ + trailing-punct + trailing-tokens
    const lead = tokens.slice(0, i).join('');
    const trail = tokens.slice(i + 1).join('');
    const tokPrefix = t.slice(0, startInTok);
    const tokSuffix = t.slice(startInTok + stripped.length);
    return {
      blankWord: stripped,
      prefix: lead + tokPrefix,
      suffix: tokSuffix + trail
    };
  }
  return null;
}
// Distractor pool — eligible words from OTHER lessons' notes. Prefer same
// section first; fall back to any track if pool too small.
function _notesCollectDistractors(sourceLessonId, sourceSection, blankWord) {
  const blankLower = blankWord.toLowerCase();
  const same = new Set();
  const other = new Set();
  for (const lesson of CURRICULUM) {
    if (lesson.id === sourceLessonId) continue;
    const c = CONTENT[lesson.id];
    if (!c || !c.reference || !Array.isArray(c.reference.notes)) continue;
    for (const note of c.reference.notes) {
      if (typeof note !== 'string') continue;
      const tokens = note.split(/\s+/);
      for (const t of tokens) {
        if (!_notesIsEligibleWord(t)) continue;
        const stripped = _notesStripPunct(t);
        if (stripped.toLowerCase() === blankLower) continue;
        (lesson.section === sourceSection ? same : other).add(stripped);
      }
    }
  }
  const sameArr = Array.from(same);
  const otherArr = Array.from(other);
  // Fisher-Yates shuffle each.
  for (const arr of [sameArr, otherArr]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  // Take from same first; top up from other.
  const pool = sameArr.concat(otherArr);
  return pool.slice(0, 3);
}
async function _notesDrillBuildDeck() {
  // Preload a broad sample so the pool is large enough for distractors.
  const sample = CURRICULUM.filter(l => l.status === 'full').slice(0, 80);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
      if (Object.keys(CONTENT).length >= 40) break;
    }
  }
  // Flatten eligible notes across loaded lessons.
  const pool = [];
  for (const lesson of CURRICULUM) {
    const c = CONTENT[lesson.id];
    if (!c || !c.reference || !Array.isArray(c.reference.notes)) continue;
    for (const note of c.reference.notes) {
      if (typeof note !== 'string' || note.length < 25) continue;
      const picked = _notesPickBlank(note);
      if (!picked) continue;
      pool.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        sectionName: lesson.section,
        note,
        blankWord: picked.blankWord,
        prefix: picked.prefix,
        suffix: picked.suffix
      });
    }
  }
  if (pool.length < 4) return null;
  // SR/weakness-weighted shuffle — cards from overdue or weak-spot
  // lessons surface first, then random fill. See `_srPriorityShuffle`
  // in slice 04 for the bucketing rules.
  const ordered = _srPriorityShuffle(pool, item => item.lessonId);
  // Build cards with distractors. Skip any card with <3 distractors.
  const deck = [];
  for (const item of ordered) {
    if (deck.length >= NOTES_DRILL_DECK_LEN) break;
    const distractors = _notesCollectDistractors(item.lessonId, item.sectionName, item.blankWord);
    if (distractors.length < 3) continue;
    const options = [
      { word: item.blankWord, isCorrect: true },
      ...distractors.map(w => ({ word: w, isCorrect: false }))
    ];
    // Shuffle option order.
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    deck.push({ ...item, options });
  }
  return deck.length >= 4 ? deck : null;
}
async function startNotesDrillSession() {
  const deck = await _notesDrillBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Notes Drill needs more loaded lessons. Click around a few first, then try again.');
    return;
  }
  state.notesDrill.sessions++;
  state.notesDrill.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell notes-drill-shell">
        <div class="recognize-header">
          <span>📝 Notes · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-notes">✕ Exit</button>
        </div>
        <div class="notes-drill-tag">Which word fits the blank?</div>
        <div class="notes-drill-note">${escapeHtml(card.prefix)}<span class="notes-drill-blank">___</span>${escapeHtml(card.suffix)}</div>
        <div class="notes-drill-options">
          ${card.options.map((o, i) => `
            <button class="recognize-opt notes-drill-opt" data-opt="${i}">
              <span class="notes-drill-opt-letter">${String.fromCharCode(65 + i)}</span>
              <span class="notes-drill-opt-word">${escapeHtml(o.word)}</span>
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-notes-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-notes"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.notes-drill-opt');
    let answered = false;
    optBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const optIdx = +btn.dataset.opt;
        const picked = card.options[optIdx];
        const wasRight = !!picked.isCorrect;
        if (wasRight) correct++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.notesDrill.attempts++;
        if (wasRight) state.notesDrill.correct++;
        saveProgress();
        optBtns.forEach((b, i) => {
          b.disabled = true;
          if (card.options[i].isCorrect) b.classList.add('recognize-opt-correct');
          else if (i === optIdx) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-notes-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="notes-drill-reveal">
              <div class="notes-drill-reveal-full"><strong>${escapeHtml(card.blankWord)}</strong> — ${escapeHtml(card.note)}</div>
              <div class="notes-drill-reveal-lesson">${escapeHtml(card.lessonTitle)} · ${escapeHtml(card.sectionName)}</div>
              <button class="notes-drill-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="notes-drill-next" data-action="notes-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="notes-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell notes-drill-shell">
        <div class="recognize-header"><span>📝 Notes · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} keywords recalled · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.notesDrill.correct} / ${state.notesDrill.attempts} (${state.notesDrill.attempts > 0 ? Math.round(state.notesDrill.correct / state.notesDrill.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="notes-again">📝 Another session</button>
            <button class="secondary" data-action="notes-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="notes-again"]').addEventListener('click', () => startNotesDrillSession());
    shell.querySelector('[data-action="notes-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 98: 🪐 Mechanic Constellation — multi-select recall over the
// `mechanics[]` tag. Each card shows ONE mechanic name + 6 lesson titles
// (3 tagged with the mechanic, 3 not); user picks 3 they think are
// tagged. Per-tap immediate-feedback (mirrors iter-93/97 pattern):
// correct → green ✓; wrong → red ✗ + state.weakness[lessonId]++.
// Card ends after 3 taps; reveal shows all 6 marked + drill CTAs.
// First surface drilling mechanics as a recall TARGET (vs Bridge/Matrix/
// modal which all USE mechanics as input). From roadmap.md iter-95 #2.
const CONSTELLATION_DECK_LEN = 10;
const CONSTELLATION_PICKS_PER_CARD = 3;
const CONSTELLATION_OPTIONS_PER_CARD = 6;
