function _constellationBuildCard(mechId, mech) {
  const taggedSet = MECHANIC_INDEX.get(mechId);
  if (!taggedSet || taggedSet.size < 3) return null;
  // Pick 3 RANDOM tagged lessons. Filter to full status.
  const tagged = Array.from(taggedSet)
    .map(id => findLesson(id))
    .filter(l => l && l.status === 'full');
  if (tagged.length < 3) return null;
  // Fisher-Yates a copy then take 3.
  for (let i = tagged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
  }
  const correct = tagged.slice(0, 3);
  // Build distractor pool: full lessons NOT tagged with this mechanic.
  // Prefer same-section as one of the correct lessons for plausibility.
  const correctIds = new Set(correct.map(l => l.id));
  const correctSections = new Set(correct.map(l => l.section));
  const sameSection = [];
  const otherSection = [];
  for (const lesson of CURRICULUM) {
    if (lesson.status !== 'full') continue;
    if (correctIds.has(lesson.id)) continue;
    if (taggedSet.has(lesson.id)) continue; // skip lessons that ARE tagged
    if (correctSections.has(lesson.section)) sameSection.push(lesson);
    else otherSection.push(lesson);
  }
  // Shuffle each, then concat (same-section first).
  for (const arr of [sameSection, otherSection]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  const distractors = sameSection.concat(otherSection).slice(0, 3);
  if (distractors.length < 3) return null;
  // Combine + shuffle option order.
  const options = [
    ...correct.map(l => ({ lesson: l, isCorrect: true })),
    ...distractors.map(l => ({ lesson: l, isCorrect: false }))
  ];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    mechId,
    mechLabel: mech.label,
    mechBlurb: mech.blurb || '',
    options
  };
}
async function _constellationBuildDeck() {
  // Lazy-load MECHANIC_INDEX (mirrors iter-94 Bridge pattern).
  await ensureMechanicIndex();
  if (!MECHANIC_INDEX || MECHANIC_INDEX.size === 0) return null;
  // Filter to mechanics with ≥3 tagged lessons.
  const eligible = [];
  for (const [mechId, lessonSet] of MECHANIC_INDEX) {
    if (lessonSet.size < 3) continue;
    const mech = MECHANICS.find(m => m.id === mechId);
    if (!mech) continue;
    eligible.push({ mechId, mech });
  }
  if (eligible.length < 4) return null;
  // Shuffle.
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  // Build cards.
  const deck = [];
  for (const { mechId, mech } of eligible) {
    if (deck.length >= CONSTELLATION_DECK_LEN) break;
    const card = _constellationBuildCard(mechId, mech);
    if (card) deck.push(card);
  }
  return deck.length >= 4 ? deck : null;
}
async function startConstellationSession() {
  const deck = await _constellationBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Constellation needs more loaded lessons + a populated mechanics registry. Try again in a moment.');
    return;
  }
  state.mechConstellation.sessions++;
  state.mechConstellation.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, cardsCompleted = 0, perCardCorrect = [];
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    let picks = 0, cardCorrect = 0;
    const optStates = card.options.map(() => 'unpicked'); // unpicked | correct | wrong
    shell.innerHTML = `
      <div class="recognize-shell constellation-shell">
        <div class="recognize-header">
          <span>🪐 Constellation · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-constellation">✕ Exit</button>
        </div>
        <div class="constellation-tag">Pick the 3 lessons that use this idiom:</div>
        <div class="constellation-mech">
          <div class="constellation-mech-label">${escapeHtml(card.mechLabel)}</div>
          ${card.mechBlurb ? `<div class="constellation-mech-blurb">${escapeHtml(card.mechBlurb)}</div>` : ''}
        </div>
        <div class="constellation-counter">Picks: <span data-picks>0</span> / 3</div>
        <div class="constellation-options">
          ${card.options.map((o, i) => `
            <button class="recognize-opt constellation-opt" data-opt="${i}">
              <span class="constellation-opt-mark" data-mark="${i}"></span>
              <span class="constellation-opt-title">${escapeHtml(o.lesson.title)}</span>
              <span class="constellation-opt-section">${escapeHtml(o.lesson.section)}</span>
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-constellation-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-constellation"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.constellation-opt');
    const counterEl = shell.querySelector('[data-picks]');
    optBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (picks >= CONSTELLATION_PICKS_PER_CARD) return;
        const optIdx = +btn.dataset.opt;
        if (optStates[optIdx] !== 'unpicked') return;
        const picked = card.options[optIdx];
        const wasRight = !!picked.isCorrect;
        optStates[optIdx] = wasRight ? 'correct' : 'wrong';
        picks++;
        if (wasRight) cardCorrect++;
        else { state.weakness[picked.lesson.id] = (state.weakness[picked.lesson.id] || 0) + 1; appendHistory(picked.lesson.id, 'L1-miss'); }
        state.mechConstellation.attempts++;
        if (wasRight) state.mechConstellation.correct++;
        saveProgress();
        btn.disabled = true;
        btn.classList.add(wasRight ? 'recognize-opt-correct' : 'recognize-opt-wrong');
        const mark = shell.querySelector(`[data-mark="${optIdx}"]`);
        if (mark) mark.textContent = wasRight ? '✓' : '✗';
        if (counterEl) counterEl.textContent = String(picks);
        if (picks >= CONSTELLATION_PICKS_PER_CARD) {
          // Reveal phase: mark the remaining untagged-as-wrong + missed-correct.
          cardsCompleted++;
          perCardCorrect.push(cardCorrect);
          optBtns.forEach((b, i) => {
            b.disabled = true;
            if (optStates[i] === 'unpicked') {
              // If correct was missed, mark it "missed-correct"
              if (card.options[i].isCorrect) {
                b.classList.add('constellation-opt-missed');
                const mark = shell.querySelector(`[data-mark="${i}"]`);
                if (mark) mark.textContent = '⊙';
              }
              // Distractor that was NOT picked — keep neutral (no marker).
            }
          });
          const fb = shell.querySelector('[data-constellation-feedback]');
          if (fb) {
            fb.innerHTML = `
              <div class="constellation-reveal">
                <div class="constellation-reveal-score">${cardCorrect} of 3 correct</div>
                <div class="constellation-reveal-hint">⊙ marks the tagged lesson you didn't pick</div>
                <button class="constellation-next" data-action="constellation-next">Next card</button>
              </div>
            `;
            fb.querySelector('[data-action="constellation-next"]').addEventListener('click', () => { idx++; renderCard(); });
          }
        }
      });
    });
  }
  function renderSummary() {
    const totalCorrect = perCardCorrect.reduce((s, n) => s + n, 0);
    const totalPossible = deck.length * 3;
    const pct = Math.round((totalCorrect / totalPossible) * 100);
    const perfectCards = perCardCorrect.filter(n => n === 3).length;
    shell.innerHTML = `
      <div class="recognize-shell constellation-shell">
        <div class="recognize-header"><span>🪐 Constellation · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${totalCorrect} of ${totalPossible} correct picks · ${perfectCards} of ${deck.length} cards perfect (all 3)</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.mechConstellation.correct} / ${state.mechConstellation.attempts} (${state.mechConstellation.attempts > 0 ? Math.round(state.mechConstellation.correct / state.mechConstellation.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="constellation-again">🪐 Another session</button>
            <button class="secondary" data-action="constellation-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="constellation-again"]').addEventListener('click', () => startConstellationSession());
    shell.querySelector('[data-action="constellation-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 99: ⏪ Reverse-Walkthrough — backward-direction recall over walkthrough
// trace data. Each card shows the FINAL `{state, returns}` of one walkthrough
// example + 3 input options (all 3 examples from the SAME lesson); user taps
// which input produced this final state. **Adapted spec** from iter-95
// roadmap entry: the roadmap assumed lessons might have 4+ examples; empirical
// scan (iter-99 feasibility check) found ALL 99 Patterns/Applied lessons have
// EXACTLY 3 walkthrough examples. So distractors are 3-option MC from the
// same lesson — pure cognitive operation, no cross-lesson shape-mismatch
// concerns. Baseline guess rate is 33% but discriminating between 3 examples
// of the same algorithm requires actual trace-execution mental simulation.
// Distinct from Walkthrough (forward stepper) and Trace-Hop (mid-state recall).
const REVERSE_WALK_DECK_LEN = 8;
function _reverseWalkBuildCard(lesson, content) {
  const compiled = _compileWalkthrough(lesson.id, content.walkthrough);
  if (compiled.error || !Array.isArray(compiled.byExample)) return null;
  const usable = compiled.byExample.filter(b => !b.error && Array.isArray(b.steps) && b.steps.length >= 2);
  if (usable.length < 3) return null;
  // Pick a random example as the "correct" one.
  const correctIdx = Math.floor(Math.random() * usable.length);
  const correctBlock = usable[correctIdx];
  const finalStep = correctBlock.steps[correctBlock.steps.length - 1];
  // Build 3 input options (all 3 examples, shuffled).
  const options = usable.map((b, i) => ({
    inputLabel: b.example.label || `Example ${i + 1}`,
    inputJson: _formatStateVal(b.example.input),
    isCorrect: i === correctIdx
  }));
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    sectionName: lesson.section,
    finalState: finalStep.state,
    finalReturns: 'returns' in finalStep ? finalStep.returns : undefined,
    correctLabel: correctBlock.example.label || `Example ${correctIdx + 1}`,
    options
  };
}
async function _reverseWalkBuildDeck() {
  const candidates = CURRICULUM.filter(l =>
    l.status === 'full' && (l.track === 'patterns' || l.track === 'applied')
  );
  const shuffled = candidates.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const sample = shuffled.slice(0, 40);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { continue; }
    }
  }
  const deck = [];
  for (const lesson of shuffled) {
    if (deck.length >= REVERSE_WALK_DECK_LEN) break;
    const c = CONTENT[lesson.id];
    if (!c || !c.walkthrough || !Array.isArray(c.walkthrough.examples)) continue;
    const card = _reverseWalkBuildCard(lesson, c);
    if (card) deck.push(card);
  }
  return deck.length >= 4 ? deck : null;
}
function _reverseWalkRenderFinalState(state) {
  if (!state || typeof state !== 'object') return '<span class="reverse-walk-state-empty">(no state)</span>';
  const rows = Object.entries(state).map(([k, v]) =>
    `<div class="reverse-walk-state-row"><span class="reverse-walk-state-key">${escapeHtml(k)}</span><span class="reverse-walk-state-val">${escapeHtml(_formatStateVal(v))}</span></div>`
  );
  return rows.join('');
}
async function startReverseWalkSession() {
  const deck = await _reverseWalkBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Reverse-Walkthrough needs more lessons with walkthroughs. Click around a few Patterns lessons first, then try again.');
    return;
  }
  state.reverseWalk.sessions++;
  state.reverseWalk.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    const returnsLine = card.finalReturns !== undefined
      ? `<div class="reverse-walk-returns"><span class="reverse-walk-returns-label">returns</span> <span class="reverse-walk-returns-val">${escapeHtml(_formatStateVal(card.finalReturns))}</span></div>`
      : '';
    shell.innerHTML = `
      <div class="recognize-shell reverse-walk-shell">
        <div class="recognize-header">
          <span>⏪ Reverse · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-reverse-walk">✕ Exit</button>
        </div>
        <div class="reverse-walk-lesson-tag">${escapeHtml(card.lessonTitle)} · ${escapeHtml(card.sectionName)}</div>
        <div class="reverse-walk-tag">Which input produced this final state?</div>
        <div class="reverse-walk-final">
          <div class="reverse-walk-final-head">FINAL STATE</div>
          <div class="reverse-walk-state">${_reverseWalkRenderFinalState(card.finalState)}</div>
          ${returnsLine}
        </div>
        <div class="reverse-walk-options">
          ${card.options.map((o, i) => `
            <button class="recognize-opt reverse-walk-opt" data-opt="${i}">
              <span class="reverse-walk-opt-letter">${String.fromCharCode(65 + i)}</span>
              <span class="reverse-walk-opt-input">${escapeHtml(o.inputJson)}</span>
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-reverse-walk-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-reverse-walk"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.reverse-walk-opt');
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
        state.reverseWalk.attempts++;
        if (wasRight) state.reverseWalk.correct++;
        saveProgress();
        optBtns.forEach((b, i) => {
          b.disabled = true;
          if (card.options[i].isCorrect) b.classList.add('recognize-opt-correct');
          else if (i === optIdx) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-reverse-walk-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="reverse-walk-reveal">
              <div class="reverse-walk-reveal-title">${wasRight ? '✓ Got it' : '✗ The correct input was the highlighted one'}</div>
              <div class="reverse-walk-reveal-label">${escapeHtml(card.correctLabel)}</div>
              <button class="reverse-walk-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="reverse-walk-next" data-action="reverse-walk-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="reverse-walk-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell reverse-walk-shell">
        <div class="recognize-header"><span>⏪ Reverse · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} inputs matched · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.reverseWalk.correct} / ${state.reverseWalk.attempts} (${state.reverseWalk.attempts > 0 ? Math.round(state.reverseWalk.correct / state.reverseWalk.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="reverse-walk-again">⏪ Another session</button>
            <button class="secondary" data-action="reverse-walk-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="reverse-walk-again"]').addEventListener('click', () => startReverseWalkSession());
    shell.querySelector('[data-action="reverse-walk-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 122: 🧪 What-If Output Predictor — given the (memorized) canonical
// + ONE input drawn from `walkthrough.examples[].label`, pick the function's
// output from 4 MC options. Inverts the L1/L2/L3 ladder — L1 tests concepts,
// L2/L3 test code production, Crystal Ball (iter 77) tests "what does this
// canonical typically output", and What-If tests "for THIS input, what's the
// output?" — the trace-transfer cognitive direction PROFILE L22-24 names
// ("trace mentally under interview pressure") that no surface drills as pure
// input→output prediction.
//
// **Adapted spec from iter-120 roadmap entry:** the entry envisioned
// SYNTHESIZED fresh inputs + bucket-shift distractors. Empirical scan
// (iter-122 setup) found all 99 Patterns/Applied lessons store inputs in
// `example.label` as a free-form string ("[2,7,11,15] target=9 → [0,1]"),
// not a structured `inputs` field. Adapted to: use the 3 walkthrough
// examples as the input pool (per-lesson recall task), with the OTHER 2
// examples' `expected` as plausible same-lesson distractors + 1 algorithmic
// shift on the correct answer (±1 numeric / flipped boolean / reversed
// array / swapped first-last). v2 candidate: synthesize fresh inputs by
// mutating the label's input portion — requires per-pattern parser, deferred.
const WHATIF_DECK_LEN = 8;
function _whatifStringify(v) {
  if (v === undefined) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch (_) { return undefined; }
}
function _whatifShifts(raw, asStr) {
  // Produce 2-3 plausible-wrong variants of the correct answer. Strategy
  // varies by output shape to avoid type-mismatch giveaways (the iter-30
  // audit's anti-pattern that 🔮 Crystal's same-output-type filter also
  // protects against). Returns an array of string candidates; caller dedups.
  const out = [];
  if (typeof raw === 'number') {
    out.push(String(raw + 1));
    out.push(String(raw - 1));
    if (raw !== 0) out.push('0');
  } else if (typeof raw === 'boolean') {
    out.push(String(!raw));
  } else if (typeof asStr === 'string') {
    const s = asStr.trim();
    if (s === 'true') out.push('false');
    else if (s === 'false') out.push('true');
    else if (/^-?\d+$/.test(s)) {
      const n = parseInt(s, 10);
      out.push(String(n + 1));
      out.push(String(n - 1));
    } else if (s.startsWith('[') && s.endsWith(']')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          if (parsed.length >= 2) {
            const reversed = parsed.slice().reverse();
            out.push(JSON.stringify(reversed));
            const swapped = parsed.slice();
            [swapped[0], swapped[swapped.length - 1]] = [swapped[swapped.length - 1], swapped[0]];
            out.push(JSON.stringify(swapped));
          }
          out.push('[]');
        }
      } catch (_) {}
    }
  }
  return out;
}
function _whatifBuildCard(lesson, content) {
  const examples = content && content.walkthrough && Array.isArray(content.walkthrough.examples)
    ? content.walkthrough.examples : null;
  if (!examples || examples.length < 3) return null;
  // Filter to examples with both an `expected` and a `label` we can split on →.
  const usable = examples
    .map((ex, idx) => {
      const expStr = _whatifStringify(ex.expected);
      if (expStr === undefined) return null;
      const label = typeof ex.label === 'string' ? ex.label : '';
      const arrowIdx = label.indexOf('→');
      const inputPhrase = arrowIdx >= 0 ? label.slice(0, arrowIdx).trim() : label.trim();
      if (!inputPhrase) return null;
      return { idx, raw: ex.expected, expStr, inputPhrase };
    })
    .filter(Boolean);
  if (usable.length < 2) return null;
  // Pick the "correct" example.
  const correct = usable[Math.floor(Math.random() * usable.length)];
  // Build distractor pool from OTHER examples' expected, deduped by string.
  const pool = new Set();
  for (const u of usable) {
    if (u.idx === correct.idx) continue;
    if (u.expStr !== correct.expStr) pool.add(u.expStr);
  }
  // Pad with algorithmic shifts.
  for (const shift of _whatifShifts(correct.raw, correct.expStr)) {
    if (pool.size >= 3) break;
    if (shift !== undefined && shift !== correct.expStr) pool.add(shift);
  }
  // If still short (very rare), pad with em-dash so the card still renders 4-option.
  while (pool.size < 3) pool.add(pool.size === 0 ? '—' : pool.size === 1 ? '(no output)' : 'undefined');
  // Slice to exactly 3 distractors.
  const distractors = Array.from(pool).slice(0, 3);
  const options = [
    { val: correct.expStr, isCorrect: true },
    ...distractors.map(d => ({ val: d, isCorrect: false }))
  ];
  // Fisher-Yates shuffle.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  // Truncate canonical to ≤30 lines for mobile readability — Crystal Ball
  // precedent (iter 77). Long canonicals still render; the editor scrolls.
  const code = (content.reference && content.reference.code) || (content.L3 && content.L3.canonical) || '';
  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    sectionName: lesson.section,
    inputPhrase: correct.inputPhrase,
    canonicalCode: code,
    options,
    correctVal: correct.expStr
  };
}
async function _whatifBuildDeck() {
  const candidates = CURRICULUM.filter(l =>
    l.status === 'full' && (l.track === 'patterns' || l.track === 'applied')
  );
  const shuffled = candidates.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Preload a sample of 40 lessons to keep deck-build under ~1s on first run.
  const sample = shuffled.slice(0, 40);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { continue; }
    }
  }
  const deck = [];
  for (const lesson of shuffled) {
    if (deck.length >= WHATIF_DECK_LEN) break;
    const c = CONTENT[lesson.id];
    if (!c) continue;
    const card = _whatifBuildCard(lesson, c);
    if (card) deck.push(card);
  }
  return deck.length >= 4 ? deck : null;
}
async function startWhatifSession() {
  const deck = await _whatifBuildDeck();
  if (!deck || deck.length < 4) {
    alert('What-If needs more lessons with walkthrough examples. Click around a few Patterns lessons first, then try again.');
    return;
  }
  state.whatif.sessions++;
  state.whatif.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell whatif-shell">
        <div class="recognize-header">
          <span>🧪 What-If · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-whatif">✕ Exit</button>
        </div>
        <div class="whatif-lesson-tag">${escapeHtml(card.lessonTitle)} · ${escapeHtml(card.sectionName)}</div>
        <pre class="whatif-canonical cm-s-dracula" data-whatif-code></pre>
        <div class="whatif-input">
          <span class="whatif-input-label">INPUT</span>
          <span class="whatif-input-val">${escapeHtml(card.inputPhrase)}</span>
        </div>
        <div class="whatif-tag">What does the function output?</div>
        <div class="whatif-options">
          ${card.options.map((o, i) => `
            <button class="recognize-opt whatif-opt" data-opt="${i}">
              <span class="whatif-opt-letter">${String.fromCharCode(65 + i)}</span>
              <span class="whatif-opt-val">${escapeHtml(o.val)}</span>
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-whatif-feedback></div>
      </div>
    `;
    // Syntax-highlight the canonical via existing CodeMirror runMode helper.
    const codeEl = shell.querySelector('[data-whatif-code]');
    if (codeEl && typeof colorizeInto === 'function') colorizeInto(codeEl, card.canonicalCode);
    else if (codeEl) codeEl.textContent = card.canonicalCode;
    shell.querySelector('[data-action="exit-whatif"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.whatif-opt');
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
        state.whatif.attempts++;
        if (wasRight) state.whatif.correct++;
        saveProgress();
        optBtns.forEach((b, i) => {
          b.disabled = true;
          if (card.options[i].isCorrect) b.classList.add('recognize-opt-correct');
          else if (i === optIdx) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-whatif-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="whatif-reveal">
              <div class="whatif-reveal-title">${wasRight ? '✓ Got it' : '✗ The correct output was'}</div>
              <div class="whatif-reveal-val">${escapeHtml(card.correctVal)}</div>
              <button class="whatif-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="whatif-next" data-action="whatif-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="whatif-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell whatif-shell">
        <div class="recognize-header"><span>🧪 What-If · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} outputs correct · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.whatif.correct} / ${state.whatif.attempts} (${state.whatif.attempts > 0 ? Math.round(state.whatif.correct / state.whatif.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="whatif-again">🧪 Another session</button>
            <button class="secondary" data-action="whatif-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="whatif-again"]').addEventListener('click', () => startWhatifSession());
    shell.querySelector('[data-action="whatif-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 102: 🗂 Notes→Lesson Reverse Lookup — cross-corpus localization over
// `reference.notes[]`. Each card shows ONE note string + 4 lesson-title MC
// buttons (1 correct + 3 distractors, same-section-preferred for plausibility);
// user taps which lesson the note belongs to. Reveal shows lesson + drill CTA.
// Third recall direction over the notes corpus: 🎰 Gotcha = whole-note yes/no
// recognition; 📝 Notes Cloze = intra-note keyword cloze; 🗂 Locate = note →
// which lesson localization. Interview-mid-problem retrieval pattern: "I
// remember a gotcha about negative-zero, where was that?" — currently
// unsupported. From roadmap.md iter-100 #2.
const NOTES_LOCATE_DECK_LEN = 10;
const NOTES_LOCATE_OPTIONS = 4;
const NOTES_LOCATE_MIN_NOTE_LEN = 30;
function _notesLocateBuildCard(noteEntry, allFullLessons) {
  // Pick 3 distractors. Prefer same-section lessons; fall back to any
  // full-status lesson if same-section pool is too small.
  const same = [];
  const other = [];
  for (const l of allFullLessons) {
    if (l.id === noteEntry.lessonId) continue;
    if (l.section === noteEntry.sectionName) same.push(l);
    else other.push(l);
  }
  for (const arr of [same, other]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  const distractors = same.concat(other).slice(0, NOTES_LOCATE_OPTIONS - 1);
  if (distractors.length < NOTES_LOCATE_OPTIONS - 1) return null;
  const correctLesson = findLesson(noteEntry.lessonId);
  if (!correctLesson) return null;
  const options = [
    { lesson: correctLesson, isCorrect: true },
    ...distractors.map(l => ({ lesson: l, isCorrect: false }))
  ];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    lessonId: noteEntry.lessonId,
    sectionName: noteEntry.sectionName,
    note: noteEntry.note,
    options
  };
}
async function _notesLocateBuildDeck() {
  // Preload a broad sample so the note pool is large.
  const sample = CURRICULUM.filter(l => l.status === 'full').slice(0, 80);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
      if (Object.keys(CONTENT).length >= 40) break;
    }
  }
  const allFull = CURRICULUM.filter(l => l.status === 'full');
  // Flatten eligible notes — filter by min length (uniqueness proxy per
  // iter-100 roadmap entry; longer notes are more distinctive).
  const pool = [];
  for (const lesson of CURRICULUM) {
    const c = CONTENT[lesson.id];
    if (!c || !c.reference || !Array.isArray(c.reference.notes)) continue;
    for (const note of c.reference.notes) {
      if (typeof note !== 'string' || note.length < NOTES_LOCATE_MIN_NOTE_LEN) continue;
      pool.push({ lessonId: lesson.id, sectionName: lesson.section, note });
    }
  }
  if (pool.length < 4) return null;
  // Fisher-Yates.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Build cards.
  const deck = [];
  for (const noteEntry of pool) {
    if (deck.length >= NOTES_LOCATE_DECK_LEN) break;
    const card = _notesLocateBuildCard(noteEntry, allFull);
    if (card) deck.push(card);
  }
  return deck.length >= 4 ? deck : null;
}
async function startNotesLocateSession() {
  const deck = await _notesLocateBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Notes Locate needs more loaded lessons. Click around a few first, then try again.');
    return;
  }
  state.notesLocate.sessions++;
  state.notesLocate.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell notes-locate-shell">
        <div class="recognize-header">
          <span>🗂 Locate · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-notes-locate">✕ Exit</button>
        </div>
        <div class="notes-locate-tag">Which lesson does this gotcha belong to?</div>
        <div class="notes-locate-note">${escapeHtml(card.note)}</div>
        <div class="notes-locate-options">
          ${card.options.map((o, i) => `
            <button class="recognize-opt notes-locate-opt" data-opt="${i}">
              <span class="notes-locate-opt-letter">${String.fromCharCode(65 + i)}</span>
              <span class="notes-locate-opt-body">
                <span class="notes-locate-opt-title">${escapeHtml(o.lesson.title)}</span>
                <span class="notes-locate-opt-section">${escapeHtml(o.lesson.section)}</span>
              </span>
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-notes-locate-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-notes-locate"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.notes-locate-opt');
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
        state.notesLocate.attempts++;
        if (wasRight) state.notesLocate.correct++;
        saveProgress();
        optBtns.forEach((b, i) => {
          b.disabled = true;
          if (card.options[i].isCorrect) b.classList.add('recognize-opt-correct');
          else if (i === optIdx) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-notes-locate-feedback]');
        if (fb) {
          const correctLesson = card.options.find(o => o.isCorrect).lesson;
          fb.innerHTML = `
            <div class="notes-locate-reveal">
              <div class="notes-locate-reveal-title">${wasRight ? '✓ Got it' : '✗ The note was from'}: <strong>${escapeHtml(correctLesson.title)}</strong></div>
              <div class="notes-locate-reveal-section">${escapeHtml(correctLesson.section)}</div>
              <button class="notes-locate-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="notes-locate-next" data-action="notes-locate-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="notes-locate-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell notes-locate-shell">
        <div class="recognize-header"><span>🗂 Locate · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} lessons identified · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.notesLocate.correct} / ${state.notesLocate.attempts} (${state.notesLocate.attempts > 0 ? Math.round(state.notesLocate.correct / state.notesLocate.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="notes-locate-again">🗂 Another session</button>
            <button class="secondary" data-action="notes-locate-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="notes-locate-again"]').addEventListener('click', () => startNotesLocateSession());
    shell.querySelector('[data-action="notes-locate-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 109: 🔖 Match — bidirectional title ↔ description matcher (Cat 8 first
// ship; algorithm name ↔ description). Drills the name-to-concept retrieval
// direction the L1→L2→L3 ladder doesn't cover: "you've heard of Kadane's —
// what does it do?" and the reverse. Pure recombination over already-loaded
// `title` (manifest) + `description` (per-lesson JSON). 10-card mobile session;
// direction (title-prompt vs description-prompt) coin-flipped per card.
// Sourced from ideas-by-category.md Promotion shortlist #5 (Cat 8 § Modalities).
const MATCH_DECK_LEN = 10;
const MATCH_OPTIONS = 4;
function _matchBuildCard(lesson, direction, allEligible) {
  // Same-section distractors preferred; cross-section fallback. allEligible is
  // the patterns+applied authored set (with CONTENT loaded — i.e. description
  // available). direction ∈ {'title-to-desc', 'desc-to-title'}.
  const correctContent = CONTENT[lesson.id];
  if (!correctContent || !correctContent.description) return null;
  const same = [];
  const other = [];
  for (const l of allEligible) {
    if (l.id === lesson.id) continue;
    const c = CONTENT[l.id];
    if (!c || !c.description) continue;
    if (l.section === lesson.section) same.push(l);
    else other.push(l);
  }
  for (const arr of [same, other]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  const distractors = same.concat(other).slice(0, MATCH_OPTIONS - 1);
  if (distractors.length < MATCH_OPTIONS - 1) return null;
  const buildOpt = (l, isCorrect) => ({
    lesson: l,
    description: (CONTENT[l.id] && CONTENT[l.id].description) || '',
    isCorrect
  });
  const options = [buildOpt(lesson, true), ...distractors.map(l => buildOpt(l, false))];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    lessonId: lesson.id,
    sectionName: lesson.section,
    title: lesson.title,
    description: correctContent.description,
    direction,
    options
  };
}
async function _matchBuildDeck() {
  // Patterns + Applied lessons (descriptions are richest there — Syntax titles
  // double as descriptors already). Preload a sample so CONTENT has enough
  // descriptions for distractor pools.
  const eligible = CURRICULUM.filter(l =>
    l.status === 'full' && (l.track === 'patterns' || l.track === 'applied')
  );
  const sample = eligible.slice(0, 80);
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
      if (Object.keys(CONTENT).length >= 40) break;
    }
  }
  const eligibleLoaded = eligible.filter(l => CONTENT[l.id] && CONTENT[l.id].description);
  if (eligibleLoaded.length < MATCH_OPTIONS) return null;
  // Shuffle + slice for the deck. Direction coin-flipped per card so a session
  // mixes both retrieval directions (title→desc and desc→title).
  const shuffled = eligibleLoaded.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const deck = [];
  for (const lesson of shuffled) {
    if (deck.length >= MATCH_DECK_LEN) break;
    const direction = Math.random() < 0.5 ? 'title-to-desc' : 'desc-to-title';
    const card = _matchBuildCard(lesson, direction, eligibleLoaded);
    if (card) deck.push(card);
  }
  return deck.length >= 4 ? deck : null;
}
async function startMatchSession() {
  const deck = await _matchBuildDeck();
  if (!deck || deck.length < 4) {
    alert('Match needs more loaded lessons. Click around a few first, then try again.');
    return;
  }
  state.match.sessions++;
  state.match.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    const isTitleToDesc = card.direction === 'title-to-desc';
    const promptLabel = isTitleToDesc
      ? 'Which description matches this lesson?'
      : 'Which lesson does this describe?';
    const promptBody = isTitleToDesc
      ? `<div class="match-title">${escapeHtml(card.title)}</div>
         <div class="match-section">${escapeHtml(card.sectionName)}</div>`
      : `<div class="match-desc">${escapeHtml(card.description)}</div>`;
    const optBody = isTitleToDesc
      ? (o, i) => `<span class="match-opt-letter">${String.fromCharCode(65 + i)}</span>
                   <span class="match-opt-body match-opt-desc">${escapeHtml(o.description)}</span>`
      : (o, i) => `<span class="match-opt-letter">${String.fromCharCode(65 + i)}</span>
                   <span class="match-opt-body">
                     <span class="match-opt-title">${escapeHtml(o.lesson.title)}</span>
                     <span class="match-opt-section">${escapeHtml(o.lesson.section)}</span>
                   </span>`;
    shell.innerHTML = `
      <div class="recognize-shell match-shell" data-direction="${card.direction}">
        <div class="recognize-header">
          <span>🔖 Match · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-match">✕ Exit</button>
        </div>
        <div class="match-tag">${escapeHtml(promptLabel)}</div>
        <div class="match-prompt">${promptBody}</div>
        <div class="match-options">
          ${card.options.map((o, i) => `
            <button class="recognize-opt match-opt" data-opt="${i}">${optBody(o, i)}</button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-match-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-match"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.match-opt');
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
        state.match.attempts++;
        if (wasRight) state.match.correct++;
        saveProgress();
        optBtns.forEach((b, i) => {
          b.disabled = true;
          if (card.options[i].isCorrect) b.classList.add('recognize-opt-correct');
          else if (i === optIdx) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-match-feedback]');
        if (fb) {
          fb.innerHTML = `
            <div class="match-reveal">
              <div class="match-reveal-title">${wasRight ? '✓ Got it' : '✗ Correct match'}: <strong>${escapeHtml(card.title)}</strong></div>
              <div class="match-reveal-section">${escapeHtml(card.sectionName)}</div>
              <button class="match-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="match-next" data-action="match-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="match-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell match-shell">
        <div class="recognize-header"><span>🔖 Match · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} matched · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.match.correct} / ${state.match.attempts} (${state.match.attempts > 0 ? Math.round(state.match.correct / state.match.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="match-again">🔖 Another session</button>
            <button class="secondary" data-action="match-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="match-again"]').addEventListener('click', () => startMatchSession());
    shell.querySelector('[data-action="match-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 111: 🌈 Sections — section mastery heatmap (Cat 7 § Metacognition;
// spatial axis vs the 5 existing temporal Cat 7 surfaces — Hint-Cost,
// Half-Life, Heatstrip, At Risk, Resurrect all operate on TIME HORIZONS,
// none aggregates to SECTION grain). 28-cell grid colored by per-section
// mastery %; tap a cell → close grid + drill the first not-mastered lesson
// in that section. Pure derivation over CURRICULUM + state.progress — no
// new state, no `__v` bump. Sourced from ideas-by-category.md Promotion
// shortlist #1.
function _sgBuildRows() {
  // Group full lessons by section, preserving manifest order. Returns
  // [{name, mastered, total, pct, weakestId, allMastered}]; skips empty sections.
  const order = [];
  const groups = new Map();
  for (const l of CURRICULUM) {
    if (l.status !== 'full') continue;
    if (!groups.has(l.section)) { groups.set(l.section, []); order.push(l.section); }
    groups.get(l.section).push(l);
  }
  return order.map(name => {
    const lessons = groups.get(name);
    const total = lessons.length;
    const mastered = lessons.filter(l => lessonOverallStatus(l.id) === 'mastered').length;
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    const allMastered = total > 0 && mastered === total;
    let weakestId = null;
    if (allMastered) {
      // Retention pick — random lesson from the mastered set.
      weakestId = lessons[Math.floor(Math.random() * lessons.length)].id;
    } else {
      // First not-mastered by manifest order.
      const first = lessons.find(l => lessonOverallStatus(l.id) !== 'mastered');
      weakestId = first ? first.id : (lessons[0] ? lessons[0].id : null);
    }
    return { name, mastered, total, pct, weakestId, allMastered };
  });
}
function _sgColor(pct) {
  // Interpolate red-400 (rgb 248,113,113) → amber-400 (251,191,36) →
  // emerald-400 (52,211,153). Cells render with rgba alpha so the colored
  // wash is informational, not over-saturated.
  let r, g, b;
  if (pct <= 50) {
    const t = pct / 50;
    r = 248 + (251 - 248) * t;
    g = 113 + (191 - 113) * t;
    b = 113 + (36 - 113) * t;
  } else {
    const t = (pct - 50) / 50;
    r = 251 + (52 - 251) * t;
    g = 191 + (211 - 191) * t;
    b = 36 + (153 - 36) * t;
  }
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}
function startSectionGrid() {
  const rows = _sgBuildRows();
  if (!rows.length) {
    alert('No sections with authored lessons yet.');
    return;
  }
  const shell = document.getElementById('lesson-shell');
  // Weakest section first in the "where to study tonight?" nudge (lowest pct).
  const weakestSection = rows.slice().sort((a, b) => a.pct - b.pct)[0];
  shell.innerHTML = `
    <div class="recognize-shell sg-shell">
      <div class="recognize-header">
        <span>🌈 Sections · mastery heatmap</span>
        <button class="recognize-exit" data-action="exit-sg">✕ Exit</button>
      </div>
      <div class="sg-nudge">Where to study tonight? Try <strong>${escapeHtml(weakestSection.name)}</strong> (${weakestSection.pct}% mastered).</div>
      <div class="sg-grid">
        ${rows.map(r => {
          const c = _sgColor(r.pct);
          const bg = `rgba(${c.r},${c.g},${c.b},0.18)`;
          const border = `rgba(${c.r},${c.g},${c.b},0.55)`;
          const ringClass = r.allMastered ? 'sg-cell-mastered' : '';
          return `<button class="sg-cell ${ringClass}" data-section="${escapeHtml(r.name)}" data-lesson="${escapeHtml(r.weakestId || '')}" style="background:${bg};border-color:${border};">
            <div class="sg-cell-name">${escapeHtml(r.name)}</div>
            <div class="sg-cell-pct">${r.pct}%</div>
            <div class="sg-cell-counts">${r.mastered}/${r.total}</div>
          </button>`;
        }).join('')}
      </div>
      <div class="sg-legend">
        <span class="sg-legend-swatch" style="background:rgba(248,113,113,0.6);"></span> 0% mastered
        <span class="sg-legend-swatch" style="background:rgba(245,182,43,0.6);"></span> 50%
        <span class="sg-legend-swatch" style="background:rgba(52,211,153,0.6);"></span> 100%
      </div>
    </div>
  `;
  shell.querySelector('[data-action="exit-sg"]').addEventListener('click', () => renderLesson());
  shell.querySelectorAll('.sg-cell').forEach(btn => {
    btn.addEventListener('click', () => {
      const lessonId = btn.dataset.lesson;
      if (!lessonId) return;
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const wantedTab = coarse ? 'L1' : 'L3';
      selectLesson(lessonId);
      // selectLesson set currentTab='auto'; override for the drill-tier
      // calibration matching Resurrect/Bridge precedent.
      selectTab(wantedTab);
    });
  });
}

// iter 86: 🔀 Swap-Bench — pairwise idiom-equivalence drill. Loads a curated
// data/idiom-pairs.json of {a, b, sameBehavior, explain, sourceLessonId?}.
// Each card stacks two snippets vertically (mobile-first; PROFILE.md 80%-phone)
// and asks "Same behavior?". Forces transfer-of-mental-model — the rusty
// engineer recognizes that two different idioms reach the same result, or
// that two near-identical-looking idioms diverge. From `roadmap.md iter 82
// entry #3 (Idiom Swap-Bench)`. Single-iter MVP; expandable by appending to
// the JSON file (same pattern as Claim iter 79→80).
const SWAP_DECK_LEN = 6;
let SWAP_PAIRS = null; // [{id, title, a, b, sameBehavior, explain, sourceLessonId?}]
let _swapPairsLoaded = false;
