async function _loadSwapPairsRegistry() {
  if (_swapPairsLoaded) return;
  try {
    const res = await fetch('data/idiom-pairs.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const reg = await res.json();
    SWAP_PAIRS = Array.isArray(reg && reg.pairs) ? reg.pairs : [];
    _swapPairsLoaded = true;
  } catch (_) { /* fail soft — button stays but session won't open */ }
}

// iter eval-2026-05-30: per-pair SR for Swap-Bench. Win doubles
// interval (1d → 2d → 4d, capped at 30d); miss resets to 1d. Deck
// builder prefers overdue pairs first, then new (unscheduled) pairs,
// then non-overdue tracked pairs. Within each bucket, Fisher-Yates.
// Pair-grain because the corpus is shape-curated, not lesson-grain;
// `state.swapBench.pairs[pairId] = { dueAt, interval }`.
const SWAP_PAIR_INTERVALS = [
  1 * 24 * 60 * 60 * 1000,   //  1 day
  2 * 24 * 60 * 60 * 1000,   //  2 days
  4 * 24 * 60 * 60 * 1000,   //  4 days
  8 * 24 * 60 * 60 * 1000,   //  8 days
  16 * 24 * 60 * 60 * 1000,  // 16 days
  30 * 24 * 60 * 60 * 1000   // 30 days (cap)
];
function _swapSchedulePair(pairId, wasRight) {
  if (!state.swapBench.pairs) state.swapBench.pairs = {};
  const now = Date.now();
  const prev = state.swapBench.pairs[pairId];
  let nextIntervalIdx = 0;
  if (wasRight && prev && prev.interval) {
    const curIdx = SWAP_PAIR_INTERVALS.indexOf(prev.interval);
    nextIntervalIdx = curIdx >= 0 ? Math.min(curIdx + 1, SWAP_PAIR_INTERVALS.length - 1) : 1;
  }
  // Miss → bucket 0 (1d). New pair → bucket 0 too.
  const interval = SWAP_PAIR_INTERVALS[nextIntervalIdx];
  state.swapBench.pairs[pairId] = { dueAt: now + interval, interval };
}
function _swapBuildDeck() {
  if (!SWAP_PAIRS || SWAP_PAIRS.length < 3) return null;
  const now = Date.now();
  const tracked = state.swapBench && state.swapBench.pairs ? state.swapBench.pairs : {};
  // 3 buckets: overdue (dueAt <= now), new (no SR entry yet),
  // not-overdue (tracked + dueAt > now).
  const overdue = [], fresh = [], later = [];
  for (const pair of SWAP_PAIRS) {
    const rec = pair.id ? tracked[pair.id] : null;
    if (!rec) fresh.push(pair);
    else if (rec.dueAt <= now) overdue.push(pair);
    else later.push(pair);
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  const ordered = [...shuffle(overdue), ...shuffle(fresh), ...shuffle(later)];
  return ordered.slice(0, Math.min(SWAP_DECK_LEN, ordered.length));
}

async function startSwapBenchSession() {
  await _loadSwapPairsRegistry();
  const deck = _swapBuildDeck();
  if (!deck || deck.length < 3) {
    alert('Idiom-pair registry could not load.');
    return;
  }
  state.swapBench.sessions++;
  state.swapBench.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell swap-shell">
        <div class="recognize-header">
          <span>🔀 Swap-Bench · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-swap">✕ Exit</button>
        </div>
        <div class="swap-title">${escapeHtml(card.title || '')}</div>
        <div class="swap-pair">
          <div class="swap-snippet">
            <div class="swap-label">A</div>
            <pre class="swap-code cm-s-dracula" data-swap-a></pre>
          </div>
          <div class="swap-divider">↕ same behavior? ↕</div>
          <div class="swap-snippet">
            <div class="swap-label">B</div>
            <pre class="swap-code cm-s-dracula" data-swap-b></pre>
          </div>
        </div>
        <div class="swap-options">
          <button class="recognize-opt swap-opt" data-pick="same">✓ Same behavior</button>
          <button class="recognize-opt swap-opt" data-pick="diff">✗ Different behavior</button>
        </div>
        <div class="recognize-feedback" data-swap-feedback></div>
      </div>
    `;
    const aEl = shell.querySelector('[data-swap-a]');
    const bEl = shell.querySelector('[data-swap-b]');
    if (aEl && typeof colorizeInto === 'function') colorizeInto(aEl, card.a);
    if (bEl && typeof colorizeInto === 'function') colorizeInto(bEl, card.b);
    shell.querySelector('[data-action="exit-swap"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.swap-opt');
    let answered = false;
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const saidSame = btn.dataset.pick === 'same';
        const wasRight = saidSame === !!card.sameBehavior;
        if (wasRight) correct++;
        else if (card.sourceLessonId && findLesson(card.sourceLessonId)) {
          state.weakness[card.sourceLessonId] = (state.weakness[card.sourceLessonId] || 0) + 1;
          appendHistory(card.sourceLessonId, 'L1-miss');
        }
        // Per-pair SR — win doubles interval, miss resets to 1d. Tracks
        // per-pair due dates so a bombed pair resurfaces sooner.
        if (card.id) _swapSchedulePair(card.id, wasRight);
        state.swapBench.attempts++;
        if (wasRight) state.swapBench.correct++;
        saveProgress();
        opts.forEach(b => {
          b.disabled = true;
          const isCorrectChoice = (b.dataset.pick === 'same') === !!card.sameBehavior;
          if (isCorrectChoice) b.classList.add('recognize-opt-correct');
          else if (b === btn) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-swap-feedback]');
        if (fb) {
          const verdict = card.sameBehavior ? 'Same behavior ✓' : 'Different behavior ✗';
          fb.innerHTML = `
            <div class="swap-reveal ${wasRight ? 'swap-reveal-good' : 'swap-reveal-bad'}">
              <div class="swap-verdict">${verdict}</div>
              <div class="swap-explain">${escapeHtml(card.explain || '')}</div>
              ${card.sourceLessonId && findLesson(card.sourceLessonId)
                ? `<button class="gotcha-drill" data-drill="${escapeHtml(card.sourceLessonId)}">Drill source lesson →</button>`
                : ''}
              <button class="gotcha-next" data-action="swap-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="swap-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell swap-shell">
        <div class="recognize-header"><span>🔀 Swap-Bench · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} idiom pairs judged correctly</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.swapBench.correct} / ${state.swapBench.attempts} (${state.swapBench.attempts > 0 ? Math.round(state.swapBench.correct / state.swapBench.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="swap-again">🔀 Another bench</button>
            <button class="secondary" data-action="swap-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="swap-again"]').addEventListener('click', () => startSwapBenchSession());
    shell.querySelector('[data-action="swap-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 79: 📐 Smell-Test Complexity-Claim drill — §9B Code Evaluation Skills.
// Loads a small curated map (data/complexity-claims.json) of {lessonId: {actual,
// distractor}}; each card shows the canonical + a randomly-chosen claim (50/50
// actual vs distractor); user 2-taps "correct" or "wrong"; reveal shows the
// actual + a one-line note. Trains the interview reflex "does the stated
// complexity match the code?" — heavily graded in interviews but never drilled.
// From `ideas-by-category.md § 9B → Smell-test complexity-claim drill`.
const CLAIM_DECK_LEN = 5;
let CLAIMS = null; // {lessonId: {actual, distractor, note}}
let _claimsLoaded = false;
async function _loadClaimsRegistry() {
  if (_claimsLoaded) return;
  try {
    const res = await fetch('data/complexity-claims.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const reg = await res.json();
    CLAIMS = (reg && reg.claims) || {};
    _claimsLoaded = true;
  } catch (_) { /* fail soft — surface stays hidden */ }
}

async function _claimBuildDeck() {
  if (!CLAIMS) return null;
  const lessonIds = Object.keys(CLAIMS).filter(id => findLesson(id));
  for (const id of lessonIds) {
    if (!CONTENT[id]) {
      try { await loadLessonContent(id); } catch (_) { /* skip */ }
    }
  }
  const usable = lessonIds.filter(id => {
    const c = CONTENT[id];
    return c && c.L3 && c.L3.canonical;
  });
  if (usable.length < 3) return null;
  // Shuffle then take CLAIM_DECK_LEN.
  const shuffled = usable.slice().sort(() => Math.random() - 0.5).slice(0, CLAIM_DECK_LEN);
  return shuffled.map(id => {
    const cl = CLAIMS[id];
    const lesson = findLesson(id);
    const showActual = Math.random() < 0.5;
    const claim = showActual ? cl.actual : cl.distractor;
    return {
      lessonId: id,
      lessonTitle: lesson.title,
      sectionName: lesson.section,
      canonical: CONTENT[id].L3.canonical,
      claim,
      isCorrect: showActual, // user should tap "correct" iff showActual
      actual: cl.actual,
      note: cl.note || ''
    };
  });
}

async function startClaimSession() {
  await _loadClaimsRegistry();
  if (!CLAIMS) {
    alert('Complexity-claim registry could not load.');
    return;
  }
  const deck = await _claimBuildDeck();
  if (!deck || deck.length < 3) {
    alert('Not enough complexity-claim entries loaded.');
    return;
  }
  state.claim.sessions++;
  state.claim.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell claim-shell">
        <div class="recognize-header">
          <span>📐 Claim · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-claim">✕ Exit</button>
        </div>
        <div class="claim-meta">${escapeHtml(card.sectionName)} · <span class="claim-lesson">${escapeHtml(card.lessonTitle)}</span></div>
        <pre class="crystal-code cm-s-dracula" data-claim-code></pre>
        <div class="claim-stated">Claimed time complexity: <code class="claim-stated-val">${escapeHtml(card.claim)}</code></div>
        <div class="claim-options">
          <button class="recognize-opt claim-opt" data-pick="correct">✓ Correct</button>
          <button class="recognize-opt claim-opt" data-pick="wrong">✗ Wrong</button>
        </div>
        <div class="recognize-feedback" data-claim-feedback></div>
      </div>
    `;
    const codeEl = shell.querySelector('[data-claim-code]');
    if (codeEl && typeof colorizeInto === 'function') colorizeInto(codeEl, card.canonical);
    shell.querySelector('[data-action="exit-claim"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.claim-opt');
    let answered = false;
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const said = btn.dataset.pick === 'correct'; // user's claim
        const wasRight = said === card.isCorrect;
        if (wasRight) {
          correct++;
          // Hold-but-reset-dueAt SR on a recognition-tier win. Guarded
          // to mastered+due lessons only — mirrors the L2 pattern in
          // markPassed() (slice 09:791). Binary forced choice is even
          // shallower than Predict's 4-MC, so we keep the SR cycle
          // moving without falsely advancing the bucket.
          if (state.reviews[card.lessonId] && isDueForReview(card.lessonId)) {
            scheduleReview(card.lessonId, { advance: false });
          }
        } else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.claim.attempts++;
        if (wasRight) state.claim.correct++;
        saveProgress();
        opts.forEach(b => {
          b.disabled = true;
          const isCorrectChoice = (b.dataset.pick === 'correct') === card.isCorrect;
          if (isCorrectChoice) b.classList.add('recognize-opt-correct');
          else if (b === btn) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-claim-feedback]');
        if (fb) {
          const verdict = card.isCorrect ? `Actually <code>${escapeHtml(card.actual)}</code> ✓ (claim was correct)` : `Actually <code>${escapeHtml(card.actual)}</code> ≠ claim`;
          fb.innerHTML = `<div class="claim-reveal ${wasRight ? 'claim-reveal-good' : 'claim-reveal-bad'}">${verdict}${card.note ? `<div class="claim-note">${escapeHtml(card.note)}</div>` : ''}</div>`;
        }
        setTimeout(() => { idx++; renderCard(); }, 2400);
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell claim-shell">
        <div class="recognize-header"><span>📐 Claim · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} complexity claims judged correctly</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.claim.correct} / ${state.claim.attempts} (${state.claim.attempts > 0 ? Math.round(state.claim.correct / state.claim.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="claim-again">📐 Another session</button>
            <button class="secondary" data-action="claim-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="claim-again"]').addEventListener('click', () => startClaimSession());
    shell.querySelector('[data-action="claim-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 77: 🔮 Predict-the-Output — Crystal Ball mental-execution drill. Show
// a patterns canonical + 4 expected-output options (correct + 3 same-type
// distractors from other lessons' L3.expectedOutput); user picks which the
// code produces WITHOUT running it. Trains mental simulation — the
// foundational interview skill the L1/L2/L3 ladder never drills (everything
// today is "produce code"; this drills "execute code in your head"). Pure
// recombination; no per-lesson authoring. From `ideas-by-category.md § 1
// Drilling Surfaces → Crystal Ball mental-execution drill`.
const CRYSTAL_DECK_LEN = 5;

function _crystalOutputType(s) {
  // Coarse type-tag so distractors share shape with the correct answer
  // (array→array, number→number, etc.); falls back to 'string'.
  const trimmed = (s || '').trim();
  if (!trimmed) return 'string';
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return 'array';
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return 'object';
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return 'number';
  if (trimmed === 'true' || trimmed === 'false') return 'boolean';
  return 'string';
}

function _crystalBuildDeck() {
  const candidates = CURRICULUM.filter(l => l.track === 'patterns' && l.status === 'full');
  const pool = [];
  for (const l of candidates) {
    const c = CONTENT[l.id];
    if (!c || !c.L3 || !c.L3.canonical || !c.L3.expectedOutput) continue;
    // Skip overly long canonicals — mobile readability + mental-sim feasibility.
    if (c.L3.canonical.split('\n').length > 30) continue;
    pool.push({
      lessonId: l.id,
      lessonTitle: l.title,
      sectionName: l.section,
      canonical: c.L3.canonical,
      output: c.L3.expectedOutput,
      type: _crystalOutputType(c.L3.expectedOutput)
    });
  }
  if (pool.length < 4) return null;
  // Group outputs by type for distractor selection (prefer same-type so the
  // correct answer isn't trivially obvious via type mismatch).
  const byType = {};
  for (const p of pool) {
    (byType[p.type] = byType[p.type] || []).push(p);
  }
  // Shuffle pool, pick deck-len cards.
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const cards = [];
  for (const target of shuffled.slice(0, CRYSTAL_DECK_LEN * 2)) {
    if (cards.length >= CRYSTAL_DECK_LEN) break;
    // Distractor pool: same-type outputs from other lessons, excluding the
    // target's own output (defensive: identical outputs across lessons exist).
    const sameType = (byType[target.type] || []).filter(p =>
      p.lessonId !== target.lessonId && p.output !== target.output
    );
    if (sameType.length < 3) continue; // need ≥3 distractors
    const distractors = sameType.sort(() => Math.random() - 0.5).slice(0, 3).map(p => p.output);
    const options = [target.output, ...distractors];
    // Shuffle option order.
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    cards.push({
      lessonId: target.lessonId,
      lessonTitle: target.lessonTitle,
      sectionName: target.sectionName,
      canonical: target.canonical,
      options,
      correct: target.output
    });
  }
  return cards.length >= 3 ? cards : null;
}

async function startCrystalSession() {
  // Preload patterns lessons so the pool has variety.
  const patternsLessons = CURRICULUM.filter(l => l.track === 'patterns' && l.status === 'full').slice(0, 30);
  for (const l of patternsLessons) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
      if (Object.keys(CONTENT).length >= 20) break;
    }
  }
  const deck = _crystalBuildDeck();
  if (!deck || deck.length < 3) {
    alert('Predict needs more loaded patterns lessons. Click around a few patterns first, then try again.');
    return;
  }
  state.crystal.sessions++;
  state.crystal.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell crystal-shell">
        <div class="recognize-header">
          <span>🔮 Predict · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-crystal">✕ Exit</button>
        </div>
        <div class="crystal-meta">${escapeHtml(card.sectionName)} · <span class="crystal-lesson">${escapeHtml(card.lessonTitle)}</span></div>
        <div class="crystal-hint">Read the code. Don't run it. Pick the output.</div>
        <pre class="crystal-code cm-s-dracula" data-crystal-code></pre>
        <div class="recognize-options crystal-options">
          ${card.options.map(opt => `<button class="recognize-opt crystal-opt" data-opt="${escapeHtml(opt)}"><code>${escapeHtml(opt)}</code></button>`).join('')}
        </div>
        <div class="recognize-feedback" data-crystal-feedback></div>
      </div>
    `;
    // Syntax-highlight the canonical via the existing CodeMirror runMode path.
    const codeEl = shell.querySelector('[data-crystal-code]');
    if (codeEl && typeof colorizeInto === 'function') colorizeInto(codeEl, card.canonical);
    shell.querySelector('[data-action="exit-crystal"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.recognize-opt');
    let answered = false;
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const picked = btn.dataset.opt;
        const wasCorrect = picked === card.correct;
        if (wasCorrect) {
          correct++;
          // Hold-but-reset-dueAt SR semantics — Predict is 4-MC recognition,
          // shallower than L2 cued-recall, so a win keeps the SR cycle
          // moving (resets dueAt) without falsely advancing the bucket.
          // Guarded to mastered+due lessons only — mirrors the L2 pattern
          // in markPassed() (js/app/09-stats-cheatsheet-mock.js:791) so a
          // recognition win can't seed SR on a not-yet-mastered lesson
          // or push the dueAt out further on a not-yet-due one.
          if (state.reviews[card.lessonId] && isDueForReview(card.lessonId)) {
            scheduleReview(card.lessonId, { advance: false });
          }
        } else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.crystal.attempts++;
        if (wasCorrect) state.crystal.correct++;
        saveProgress();
        opts.forEach(b => {
          b.disabled = true;
          if (b.dataset.opt === card.correct) b.classList.add('recognize-opt-correct');
          else if (b === btn) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-crystal-feedback]');
        if (fb) fb.innerHTML = wasCorrect
          ? `<span class="recognize-good">✓</span>`
          : `<span class="recognize-bad">✗ Was ${escapeHtml(card.correct)}</span>`;
        setTimeout(() => { idx++; renderCard(); }, wasCorrect ? 800 : 1700);
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell crystal-shell">
        <div class="recognize-header"><span>🔮 Predict · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} outputs predicted correctly</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Mental-sim lifetime: ${state.crystal.correct} / ${state.crystal.attempts} (${state.crystal.attempts > 0 ? Math.round(state.crystal.correct / state.crystal.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="crystal-again">🔮 Another session</button>
            <button class="secondary" data-action="crystal-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="crystal-again"]').addEventListener('click', () => startCrystalSession());
    shell.querySelector('[data-action="crystal-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 76: 🎯 Reverse Problem-ID — §9B code-evaluation surface (sibling to
// Recognize but inverted: Recognize shows prompt → pick section; Reverse
// shows input/output trace → pick problem). Forward-from-output reasoning
// — a common interview unblock pattern. Closes iter-75 § Next iter pick.
// From `ideas-by-category.md § 9B → Reverse problem-identification`.
// Lifetime stats reuse `state.recognize` (same diagnostic-direction modality;
// no new schema field).
const REVERSE_DECK_LEN = 6;
// Built-in identifiers that should NOT be masked (they're not user-function
// names; masking them would lose the "Math.floor" / "JSON.stringify" signal).
const _REVERSE_BUILTINS = new Set([
  'console','log','JSON','Math','Array','String','Number','Object','Map','Set',
  'parseInt','parseFloat','isNaN','isFinite','stringify','parse','min','max',
  'floor','ceil','round','abs','sqrt','from','of','keys','values','entries',
  'length','push','pop','shift','unshift','slice','splice','sort','reverse',
  'join','split','indexOf','includes','filter','map','reduce','forEach','find',
  'every','some','flat','flatMap','undefined','null','true','false','new'
]);

function _reverseMaskName(text) {
  // Replace lowercase-camelCase identifiers with `f` (user-function names);
  // leave built-ins, capitalized identifiers (constructors/classes), and
  // string-literal contents alone. Splits on quote-delimited regions so the
  // masker doesn't mangle string args like "hello" → "f" (which would erase
  // the signal the user reasons about).
  const parts = text.split(/("[^"]*"|'[^']*')/);
  return parts.map((part, i) => {
    if (i % 2 === 1) return part; // odd index = quote-delimited literal
    return part.replace(/\b[a-z][a-zA-Z0-9]*\b/g, (id) =>
      _REVERSE_BUILTINS.has(id) ? id : 'f'
    );
  }).join('');
}

function _reverseExtractInvocation(canonical) {
  // Find the LAST console.log(...) line in the canonical and pull what's
  // inside the outermost parens. Returns null if no parseable invocation.
  const lines = canonical.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/console\.log\((.+)\);?\s*$/);
    if (m) return m[1].trim();
  }
  return null;
}

// iter eval-2026-05-30: surface a one-line I/O-shape tell on reveal so
// the user learns the diagnostic heuristic that pointed to the family,
// not just the answer. Heuristic and honest — covers the common
// canonical-output shapes; falls back to a generic line for unknown
// shapes so we never claim a signal we can't justify.
function _reverseIOSignalHint(output) {
  if (typeof output !== 'string' || !output.length) return null;
  const trimmed = output.trim();
  if (trimmed === 'true' || trimmed === 'false') return 'Tell: boolean output → predicate / validation family';
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return 'Tell: single numeric output → counting / index / aggregate family';
  if (/^\[\s*\[/.test(trimmed)) return 'Tell: array-of-arrays output → grouping / partitioning family';
  if (/^\[/.test(trimmed)) return 'Tell: array output → return-the-collection family (filter / map / collect)';
  if (/^\{/.test(trimmed)) return 'Tell: object/map output → frequency / lookup-table family';
  if (trimmed === 'null' || trimmed === 'undefined') return 'Tell: nullish output → side-effect / in-place mutation family';
  if (/^["']/.test(trimmed)) return 'Tell: string output → string-construction family';
  return null;
}
function _reverseBuildDeck() {
  // iter eval-2026-05-30: include applied track. Applied lessons (decks,
  // throttle/debounce, undo-redo) have distinctive I/O shapes that are
  // high-signal for diagnose-from-output reasoning; excluding them
  // capped Interleaving at 2/3. Per recognize.md/reverse.md audits.
  const candidates = CURRICULUM.filter(l =>
    (l.track === 'patterns' || l.track === 'applied') && l.status === 'full'
  );
  // SR/weakness-weighted shuffle — lessons the user owes attention
  // (overdue SR or weakness > 0) surface first. See
  // `_srPriorityShuffle` in slice 04.
  const shuffled = _srPriorityShuffle(candidates, l => l.id);
  const cards = [];
  // Build a pool of all loaded patterns lessons with parseable invocations,
  // so we can draw distractors from it without re-checking each.
  const pool = [];
  for (const l of shuffled) {
    const c = CONTENT[l.id];
    if (!c || !c.L3 || !c.L3.canonical || !c.L3.expectedOutput || !c.L3.prompt) continue;
    const inv = _reverseExtractInvocation(c.L3.canonical);
    if (!inv) continue;
    pool.push({
      lessonId: l.id,
      invocation: _reverseMaskName(inv),
      output: c.L3.expectedOutput,
      promptMasked: _reverseMaskName(c.L3.prompt)
    });
  }
  if (pool.length < 4) return null;
  // First REVERSE_DECK_LEN entries become correct cards; each picks 3 random
  // distractors from the rest of the pool.
  const targets = pool.slice(0, Math.min(REVERSE_DECK_LEN, pool.length));
  for (const t of targets) {
    const distractors = pool
      .filter(p => p.lessonId !== t.lessonId)
      .slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(p => p.promptMasked);
    const options = [t.promptMasked, ...distractors];
    // Shuffle the 4-option array.
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    cards.push({
      lessonId: t.lessonId,
      invocation: t.invocation,
      output: t.output,
      options,
      correct: t.promptMasked
    });
  }
  return cards.length >= 3 ? cards : null;
}

async function startReverseSession() {
  // Preload broad sample of patterns + applied lessons so the pool has
  // variety. Applied I/O shapes added per eval-2026-05-30 salvage.
  const preloadable = CURRICULUM
    .filter(l => (l.track === 'patterns' || l.track === 'applied') && l.status === 'full')
    .slice(0, 30);
  for (const l of preloadable) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
      if (Object.keys(CONTENT).length >= 18) break;
    }
  }
  const deck = _reverseBuildDeck();
  if (!deck || deck.length < 3) {
    alert('Reverse needs more loaded patterns lessons. Click around a few patterns first, then try again.');
    return;
  }
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell reverse-shell">
        <div class="recognize-header">
          <span>🎯 Reverse · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-reverse">✕ Exit</button>
        </div>
        <div class="reverse-trace">
          <div class="reverse-trace-line"><span class="reverse-trace-label">in</span><code class="reverse-trace-code">${escapeHtml(card.invocation)}</code></div>
          <div class="reverse-trace-line"><span class="reverse-trace-label">out</span><code class="reverse-trace-code">${escapeHtml(card.output)}</code></div>
        </div>
        <div class="reverse-hint">Pick the problem this trace solves:</div>
        <div class="recognize-options">
          ${card.options.map(opt => `<button class="recognize-opt reverse-opt" data-opt="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join('')}
        </div>
        <div class="recognize-feedback" data-reverse-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-reverse"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.recognize-opt');
    let answered = false;
    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const picked = btn.dataset.opt;
        const wasCorrect = picked === card.correct;
        if (wasCorrect) correct++;
        else { state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); }
        state.recognize.attempts++;
        if (wasCorrect) state.recognize.correct++;
        saveProgress();
        opts.forEach(b => {
          b.disabled = true;
          if (b.dataset.opt === card.correct) b.classList.add('recognize-opt-correct');
          else if (b === btn) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-reverse-feedback]');
        if (fb) {
          // I/O-signal tell — teach the diagnostic heuristic, not just
          // the answer. Heuristic; null for unknown shapes.
          const tell = _reverseIOSignalHint(card.output);
          const tellHtml = tell ? `<div class="reverse-tell">${escapeHtml(tell)}</div>` : '';
          fb.innerHTML = wasCorrect
            ? `<span class="recognize-good">✓</span>${tellHtml}`
            : `<span class="recognize-bad">✗ Correct shown above</span>${tellHtml}`;
        }
        // Hold longer when a tell is shown so the user has time to read.
        const tellShown = _reverseIOSignalHint(card.output) != null;
        const delay = wasCorrect ? (tellShown ? 1400 : 700) : (tellShown ? 2200 : 1500);
        setTimeout(() => { idx++; renderCard(); }, delay);
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell reverse-shell">
        <div class="recognize-header"><span>🎯 Reverse · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} correct</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Diagnose lifetime (incl. 🔎 Recognize): ${state.recognize.correct} / ${state.recognize.attempts} (${state.recognize.attempts > 0 ? Math.round(state.recognize.correct / state.recognize.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="reverse-again">🎯 Another session</button>
            <button class="secondary" data-action="reverse-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="reverse-again"]').addEventListener('click', () => startReverseSession());
    shell.querySelector('[data-action="reverse-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 54: L1 Rapid-Fire Drill. Cross-lesson interleaved L1 tap-stream — the
// pure mobile-throughput surface PROFILE.md L31 names as the highest-density
// recall modality. Reuses existing L1.questions across all 143 lessons (no
// new authoring). 7-sec soft-timer; tap to grade + auto-advance; streak resets
// on miss or timer-exhaust; missed lessons flip state.weakness (existing weak-
// spot tracker) so the rapid stream feeds back into normal SR. Sourced from
// iter-31 roadmap entry #4 (unblocked). See ideas-by-category.md § Paths &
// Sessions → Rapid-Fire (was the entry's queued source).
const RAPID_FIRE_SESSION_LEN = 20;
const RAPID_FIRE_TIMER_MS = 7000;
function _rapidFireBuildDeck() {
  // Walk all loaded lessons with full status + at least one L1 question.
  // Mirrors Recognize's CONTENT-lookup pattern but spans every track, not just patterns.
  const pool = [];
  for (const lesson of CURRICULUM) {
    if (lesson.status !== 'full') continue;
    const content = CONTENT[lesson.id];
    if (!content || !content.L1 || !Array.isArray(content.L1.questions)) continue;
    for (let qi = 0; qi < content.L1.questions.length; qi++) {
      const q = content.L1.questions[qi];
      if (!q || !Array.isArray(q.options) || q.options.length < 2) continue;
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
  // SR/weakness-weighted selection — questions from lessons the user
  // owes attention surface more often. Weight = (weak && due) ? 5 :
  // (weak || due) ? 3 : 1. Expand each item by its weight, Fisher-Yates,
  // then slice the session length while dedup'ing so the deck doesn't
  // repeat the same question card. Cold-start users (no SR/weakness
  // signal yet) degrade to uniform random because every lesson has
  // weight 1. Per audits/rapid-fire-l1.md edit 1.
  const weighted = [];
  for (const item of pool) {
    const overdue = isDueForReview(item.lessonId);
    const weak = (state.weakness[item.lessonId] || 0) > 0;
    const weight = (weak && overdue) ? 5 : (weak || overdue) ? 3 : 1;
    for (let w = 0; w < weight; w++) weighted.push(item);
  }
  // Fisher-Yates over the expanded pool.
  for (let i = weighted.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
  }
  // Dedup as we walk — same (lessonId, q) shouldn't appear twice in
  // a 20-card session; weight controls probability, not multiplicity.
  const seen = new Set();
  const deck = [];
  for (const item of weighted) {
    const key = `${item.lessonId}::${item.q}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deck.push(item);
    if (deck.length >= RAPID_FIRE_SESSION_LEN) break;
  }
  return deck;
}

async function startRapidFireSession() {
  // Backfill: preload lesson content broadly across tracks so the deck has
  // variety. We aim for ~30 lessons spanning syntax + patterns + applied.
  const sample = [];
  for (const track of ['syntax', 'patterns', 'applied']) {
    const trackLessons = CURRICULUM.filter(l => l.track === track && l.status === 'full').slice(0, 12);
    sample.push(...trackLessons);
  }
  for (const l of sample) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  const deck = _rapidFireBuildDeck();
  if (!deck || deck.length < 5) {
    alert('Rapid-Fire needs more loaded lessons. Click around a few lessons first, then try again.');
    return;
  }
  return _runRapidFireWithDeck(deck, { label: '⚡ Rapid', againFn: startRapidFireSession });
}

// iter 75: deck-driven Rapid-Fire shell — extracted so other §9B/§9C surfaces
// (Big-O drill, future Trap-recognition, etc.) can reuse the letter-chip +
// 7-sec timer + streak + slowest-3 mechanics without duplicating render code.
// opts: { label, againFn } — label sets header text; againFn is called when
// user clicks "Another session" on the summary.
function _runRapidFireWithDeck(deck, opts = {}) {
  const label = opts.label || '⚡ Rapid';
  const againFn = opts.againFn || startRapidFireSession;
  let idx = 0, correct = 0, streak = 0, bestStreak = 0;
  const times = [];
  const slowest = []; // { lessonId, lessonTitle, ms }
  const shell = document.getElementById('lesson-shell');
  let cardStartedAt = 0;
  let timerHandle = null;
  let timerStartedAt = 0;

  function clearTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  }

  function renderCard() {
    clearTimer();
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    cardStartedAt = Date.now();
    shell.innerHTML = `
      <div class="rapid-shell">
        <div class="rapid-header">
          <span>${label} · ${idx + 1} of ${deck.length} · 🔥 ${streak}</span>
          <button class="rapid-exit" data-action="exit-rapid">✕ Exit</button>
        </div>
        <div class="rapid-timer-track"><div class="rapid-timer-bar" data-rapid-timer></div></div>
        <div class="rapid-meta">${escapeHtml(card.sectionName)} · <span class="rapid-lesson">${escapeHtml(card.lessonTitle)}</span></div>
        <div class="rapid-question">${escapeHtml(card.q)}</div>
        <div class="rapid-options">
          ${card.options.map((opt, i) => `<button class="rapid-opt" data-opt-idx="${i}"><span class="rapid-letter">${String.fromCharCode(65 + i)}</span>${escapeHtml(opt)}</button>`).join('')}
        </div>
        <div class="rapid-feedback" data-rapid-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-rapid"]').addEventListener('click', () => {
      clearTimer();
      renderLesson();
    });
    const opts = shell.querySelectorAll('.rapid-opt');
    let answered = false;

    const grade = (pickedIdx) => {
      if (answered) return;
      answered = true;
      clearTimer();
      const elapsed = Date.now() - cardStartedAt;
      times.push(elapsed);
      const wasCorrect = pickedIdx === card.answerIdx;
      if (wasCorrect) {
        correct++;
        streak++;
        if (streak > bestStreak) bestStreak = streak;
        // iter 141: 📳 Haptic Tap-Pulse — Rapid-Fire deliberately skips
        // appendHistory('L1-pass') (would spam the sparkline across 20-card
        // streams), so the per-card correct pulse is wired here directly.
        // Streak-of-5 milestone fires the longer 3-pulse roll on top of the
        // per-card pulse for 5/10/15/20 — gives the user a tactile "you're
        // on a roll" without printing a count to the screen (L75 mitigation:
        // no streak NUMBER visible in this haptic path; bestStreak is an
        // existing post-session stat already visible in the Rapid summary).
        _hapticPulse('L1-pass');
        if (streak > 0 && streak % 5 === 0) _hapticPulse('streak-5');
      } else {
        streak = 0;
        // Feed weak-spot tracker (existing field; same semantics as in-lesson L1 miss).
        state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
        appendHistory(card.lessonId, 'L1-miss');
      }
      state.rapidFire.attempts++;
      if (wasCorrect) state.rapidFire.correct++;
      // Slowest-lesson tracking (weak-spot variant).
      slowest.push({ lessonId: card.lessonId, lessonTitle: card.lessonTitle, ms: elapsed });
      saveProgress();
      opts.forEach((b, i) => {
        b.disabled = true;
        if (i === card.answerIdx) b.classList.add('rapid-opt-correct');
        else if (i === pickedIdx) b.classList.add('rapid-opt-wrong');
      });
      const fb = shell.querySelector('[data-rapid-feedback]');
      fb.innerHTML = wasCorrect
        ? `<span class="rapid-good">✓ +1 streak</span>`
        : `<span class="rapid-bad">✗ ${card.explain ? escapeHtml(card.explain) : 'Streak reset'}</span>`;
      setTimeout(() => { idx++; renderCard(); }, wasCorrect ? 600 : 1300);
    };

    opts.forEach(btn => {
      btn.addEventListener('click', () => grade(+btn.dataset.optIdx));
    });

    // 7-sec soft timer. On exhaust: treat as miss, reset streak, reveal answer, auto-advance.
    timerStartedAt = Date.now();
    const bar = shell.querySelector('[data-rapid-timer]');
    timerHandle = setInterval(() => {
      const remaining = RAPID_FIRE_TIMER_MS - (Date.now() - timerStartedAt);
      if (remaining <= 0) {
        clearTimer();
        if (!answered) grade(-1); // -1 = no pick; never equals card.answerIdx → miss
      } else if (bar) {
        bar.style.width = `${(remaining / RAPID_FIRE_TIMER_MS) * 100}%`;
        bar.classList.toggle('rapid-timer-hot', remaining < 2000);
      }
    }, 80);
  }

  function renderSummary() {
    clearTimer();
    const totalMs = times.reduce((a, b) => a + b, 0);
    const median = times.slice().sort((a, b) => a - b)[Math.floor(times.length / 2)] || 0;
    const pct = Math.round((correct / deck.length) * 100);
    // Slowest 3 lessons (weak-spot diagnostic per iter-31 roadmap).
    const slowestTop = slowest.slice().sort((a, b) => b.ms - a.ms).slice(0, 3);
    if (bestStreak > state.rapidFire.bestStreak) state.rapidFire.bestStreak = bestStreak;
    state.rapidFire.lastRunAt = Date.now();
    saveProgress();
    shell.innerHTML = `
      <div class="rapid-shell">
        <div class="rapid-header"><span>${label} · Session done</span></div>
        <div class="rapid-summary">
          <div class="rapid-summary-pct">${pct}%</div>
          <div class="rapid-summary-line">${correct} of ${deck.length} correct · 🔥 best streak ${bestStreak}</div>
          <div class="rapid-summary-line">Median ${(median / 1000).toFixed(1)}s · Throughput ${totalMs > 0 ? ((deck.length / (totalMs / 60000)) | 0) : 0}/min</div>
          ${slowestTop.length ? `<div class="rapid-summary-slowest"><div class="rapid-summary-slowest-title">Slowest lessons (drill these next):</div>${slowestTop.map(s => `<div class="rapid-summary-slowest-row"><span>${escapeHtml(s.lessonTitle)}</span><span class="rapid-summary-slowest-ms">${(s.ms / 1000).toFixed(1)}s</span></div>`).join('')}</div>` : ''}
          <div class="rapid-summary-line rapid-summary-lifetime">Lifetime: ${state.rapidFire.correct} / ${state.rapidFire.attempts} (${state.rapidFire.attempts > 0 ? Math.round(state.rapidFire.correct / state.rapidFire.attempts * 100) : 0}%) · best 🔥 ${state.rapidFire.bestStreak}</div>
          <div class="rapid-summary-actions">
            <button class="primary" data-action="rapid-again">${label} · Another session</button>
            <button class="secondary" data-action="rapid-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="rapid-again"]').addEventListener('click', () => againFn());
    shell.querySelector('[data-action="rapid-done"]').addEventListener('click', () => renderLesson());
  }

  renderCard();
}

// iter 57: 🌅 3-Card Warmup — ultra-short mobile micro-session over the
// existing Today's Plan curated 3-way mix (due + path + weak). Stack of 3
// L1 question cards in the main viewport with slide-off-on-grade animation;
// auto-advances; summary CTAs to keep going. PROFILE L69 "friction between
// '20 free minutes' and 'I'm drilling' is near zero" — Today's Plan picks
// the WHAT but still requires open-modal-then-nav-into-lesson; Warmup
// serves the L1 interaction shell directly in 3-tap shape. Closes iter-55
// roadmap #3 (constraint-aware reframe of A#4 with PWA-install scope
// deferred). Schema-additive state.warmup, no `__v` bump.
const WARMUP_DECK_LEN = 3;
async function _warmupBuildDeck() {
  const plan = dailyPlan().slice(0, WARMUP_DECK_LEN);
  if (!plan.length) return null;
  // Preload content for any plan-lessons that aren't in CONTENT yet.
  for (const { id } of plan) {
    if (!CONTENT[id]) {
      try { await loadLessonContent(id); } catch (_) { /* skip */ }
    }
  }
  const deck = [];
  for (const { id, why } of plan) {
    const content = CONTENT[id];
    if (!content || !content.L1 || !Array.isArray(content.L1.questions) || !content.L1.questions.length) continue;
    const lesson = findLesson(id);
    if (!lesson) continue;
    // Pick the FIRST L1 question per lesson (deterministic — same warmup is
    // the same card stack for the rest of the day; mock-interview-style
    // surprise lives in Rapid-Fire).
    const q = content.L1.questions[0];
    if (!q || !Array.isArray(q.options) || typeof q.answer !== 'number') continue;
    const optOrder = _shuffleIndices(q.options.length);
    deck.push({
      lessonId: id,
      lessonTitle: lesson.title,
      sectionName: lesson.section,
      why,  // 'review due' | 'weak spot' | 'next on plan'
      q: q.q,
      options: optOrder.map(i => q.options[i]),
      answerIdx: optOrder.indexOf(q.answer),
      explain: q.explain || ''
    });
  }
  return deck.length ? deck : null;
}

async function startWarmupSession() {
  const deck = await _warmupBuildDeck();
  if (!deck || !deck.length) {
    alert('No warmup queued — you are caught up! Tap Today\\u2019s Plan or Rapid-Fire to keep going.');
    return;
  }
  state.warmup.sessions++;
  state.warmup.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  const colors = { 'review due': '#67e8f9', 'weak spot': '#fdba74', 'next on plan': '#93c5fd' };

  function renderStack() {
    if (idx >= deck.length) {
      state.warmup.completions++;
      saveProgress();
      return renderSummary();
    }
    // Render the current card + visual ghost cards beneath (offset + scaled).
    const remaining = deck.length - idx;
    const ghostCount = Math.min(remaining - 1, 2);
    const ghosts = Array.from({ length: ghostCount }, (_, i) => {
      const depth = i + 1;
      return `<div class="warmup-ghost" style="transform: translateY(${depth * 6}px) scale(${1 - depth * 0.03}); opacity: ${1 - depth * 0.35}; z-index: ${10 - depth};"></div>`;
    }).join('');

    const card = deck[idx];
    shell.innerHTML = `
      <div class="warmup-shell">
        <div class="warmup-header">
          <span>🌅 Warmup · Card ${idx + 1} of ${deck.length}</span>
          <button class="warmup-exit" data-action="exit-warmup">✕ Exit</button>
        </div>
        <div class="warmup-stack">
          ${ghosts}
          <div class="warmup-card" data-warmup-card style="z-index: 11;">
            <div class="warmup-card-tag" style="color: ${colors[card.why] || '#94a3b8'};">${escapeHtml(card.why)}</div>
            <div class="warmup-card-meta">${escapeHtml(card.sectionName)} · <span class="warmup-card-lesson">${escapeHtml(card.lessonTitle)}</span></div>
            <div class="warmup-card-question">${escapeHtml(card.q)}</div>
            <div class="warmup-card-options">
              ${card.options.map((opt, i) => `<button class="warmup-opt" data-opt-idx="${i}"><span class="warmup-letter">${String.fromCharCode(65 + i)}</span>${escapeHtml(opt)}</button>`).join('')}
            </div>
            <div class="warmup-card-feedback" data-warmup-feedback></div>
          </div>
        </div>
      </div>
    `;

    shell.querySelector('[data-action="exit-warmup"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.warmup-opt');
    const cardEl = shell.querySelector('[data-warmup-card]');
    let answered = false;

    opts.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const picked = +btn.dataset.optIdx;
        const wasCorrect = picked === card.answerIdx;
        if (wasCorrect) {
          correct++;
          // Wins are concept-grain signal too — append history and decay
          // weakness (decrement, not delete) so a single warmup win
          // doesn't reset a long-standing weakness, but a steady-state of
          // wins erodes it. Note: clearWeakness() deletes outright — too
          // generous here; do an explicit decrement instead. Per
          // audits/warmup-3card.md edit 1 (closes Hattie/Wiliam loop on
          // wins, not just misses).
          appendHistory(card.lessonId, 'L1-pass');
          const w = state.weakness[card.lessonId] || 0;
          if (w > 1) state.weakness[card.lessonId] = w - 1;
          else if (w === 1) delete state.weakness[card.lessonId];
        } else {
          // Misses route to the existing weak-spot tracker — same path as
          // missing an in-lesson L1.
          state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
          appendHistory(card.lessonId, 'L1-miss');
        }
        saveProgress();
        opts.forEach((b, i) => {
          b.disabled = true;
          if (i === card.answerIdx) b.classList.add('warmup-opt-correct');
          else if (i === picked) b.classList.add('warmup-opt-wrong');
        });
        const fb = shell.querySelector('[data-warmup-feedback]');
        fb.innerHTML = wasCorrect
          ? `<span class="warmup-good">✓ Got it</span>`
          : `<span class="warmup-bad">✗ ${card.explain ? escapeHtml(card.explain) : 'Routed to weak spots'}</span>`;
        // Slide-off animation, then advance.
        cardEl.classList.add(wasCorrect ? 'warmup-card-slide-right' : 'warmup-card-slide-left');
        setTimeout(() => { idx++; renderStack(); }, wasCorrect ? 600 : 1100);
      });
    });
  }

  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="warmup-shell">
        <div class="warmup-header"><span>🌅 Warmup · Session done</span></div>
        <div class="warmup-summary">
          <div class="warmup-summary-pct">${pct}%</div>
          <div class="warmup-summary-line">${correct} of ${deck.length} correct</div>
          <div class="warmup-summary-line warmup-summary-lifetime">Lifetime: ${state.warmup.completions} session${state.warmup.completions === 1 ? '' : 's'} completed</div>
          <div class="warmup-summary-cta">→ Keep going:</div>
          <div class="warmup-summary-actions">
            <button class="primary" data-action="warmup-rapid">⚡ Rapid-Fire</button>
            <button class="secondary" data-action="warmup-today">📅 Today's Plan</button>
            <button class="secondary" data-action="warmup-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="warmup-rapid"]').addEventListener('click', () => startRapidFireSession());
    shell.querySelector('[data-action="warmup-today"]').addEventListener('click', () => {
      renderLesson();
      document.getElementById('today-btn')?.click();
    });
    shell.querySelector('[data-action="warmup-done"]').addEventListener('click', () => renderLesson());
  }

  renderStack();
}

// iter 71: 🏁 Section Speedrun — first MOBILE timed-pressure surface.
// Mock Interview is desktop-only (per PROFILE §usage-context); recruiters
// probe at the SECTION grain ("walk me through hashing") not single-lesson
// grain, but no surface stopwatches a whole topic. Speedrun picks a section,
// streams the first L1 of every full lesson in manifest order, runs a
// stopwatch, and saves per-section best to state.speedrun.bests[<slug>].
// Closes iter-64 roadmap entry #2.
const SPEEDRUN_MIN_LESSONS = 3; // sections with <3 full lessons are trivial

function _speedrunSectionsGrouped() {
  // CURRICULUM is appended in section-order by loadManifest, so grouping by
  // section name preserves manifest order. SECTION_SLUGS maps name→slug.
  const order = [];
  const groups = new Map();
  for (const l of CURRICULUM) {
    if (!groups.has(l.section)) { groups.set(l.section, []); order.push(l.section); }
    groups.get(l.section).push(l);
  }
  return order.map(name => ({ name, slug: SECTION_SLUGS[name] || '', lessons: groups.get(name) }));
}

function _speedrunPickableSections() {
  // Filter to sections with ≥SPEEDRUN_MIN_LESSONS full lessons (classes,
  // tries, system-design get gated out — speedrun would be ≤2 cards).
  const rows = [];
  for (const sec of _speedrunSectionsGrouped()) {
    const fullLessons = sec.lessons.filter(l => l.status === 'full');
    if (fullLessons.length < SPEEDRUN_MIN_LESSONS) continue;
    rows.push({
      slug: sec.slug,
      name: sec.name,
      track: fullLessons[0]?.track || '',
      fullCount: fullLessons.length,
      bestMs: state.speedrun?.bests?.[sec.slug] || 0
    });
  }
  return rows;
}

async function _speedrunBuildDeck(sectionSlug) {
  const sec = _speedrunSectionsGrouped().find(s => s.slug === sectionSlug);
  if (!sec) return null;
  const fullLessons = sec.lessons.filter(l => l.status === 'full');
  // Preload content for every lesson in the section (sections cap at ~20).
  for (const l of fullLessons) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  const deck = [];
  for (const l of fullLessons) {
    const content = CONTENT[l.id];
    if (!content || !content.L1 || !Array.isArray(content.L1.questions) || !content.L1.questions.length) continue;
    const q = content.L1.questions[0];
    if (!q || !Array.isArray(q.options) || typeof q.answer !== 'number') continue;
    const optOrder = _shuffleIndices(q.options.length);
    deck.push({
      lessonId: l.id,
      lessonTitle: l.title,
      sectionName: sec.name,
      q: q.q,
      options: optOrder.map(i => q.options[i]),
      answerIdx: optOrder.indexOf(q.answer),
      explain: q.explain || ''
    });
  }
  return deck.length >= SPEEDRUN_MIN_LESSONS ? deck : null;
}

function _formatSpeedrunMs(ms) {
  if (!ms || ms <= 0) return '—';
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = (totalSec - min * 60);
  return min > 0
    ? `${min}:${sec.toFixed(1).padStart(4, '0')}`
    : `${sec.toFixed(1)}s`;
}

function startSpeedrunPicker() {
  const sections = _speedrunPickableSections();
  if (!sections.length) {
    alert('No speedrun-eligible sections yet (need ≥3 full lessons each).');
    return;
  }
  const shell = document.getElementById('lesson-shell');
  shell.innerHTML = `
    <div class="speedrun-shell speedrun-picker">
      <div class="speedrun-header">
        <span>🏁 Section Speedrun · pick a topic</span>
        <button class="speedrun-exit" data-action="exit-speedrun">✕ Exit</button>
      </div>
      <div class="speedrun-picker-hint">Run all L1 questions in one section against the clock. Best time per section is saved.</div>
      <div class="speedrun-picker-list">
        ${sections.map(s => `
          <button class="speedrun-pick-row" data-slug="${escapeHtml(s.slug)}">
            <span class="speedrun-pick-name">${escapeHtml(s.name)}</span>
            <span class="speedrun-pick-count">${s.fullCount} lessons</span>
            <span class="speedrun-pick-best" data-best>${s.bestMs ? `★ ${_formatSpeedrunMs(s.bestMs)}` : ''}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  shell.querySelector('[data-action="exit-speedrun"]').addEventListener('click', () => renderLesson());
  shell.querySelectorAll('.speedrun-pick-row').forEach(btn => {
    btn.addEventListener('click', () => startSpeedrunSession(btn.dataset.slug));
  });
}

async function startSpeedrunSession(sectionSlug) {
  const deck = await _speedrunBuildDeck(sectionSlug);
  if (!deck || !deck.length) {
    alert('Speedrun deck is empty for this section.');
    return;
  }
  state.speedrun.sessions++;
  state.speedrun.lastRunAt = Date.now();
  saveProgress();

  let idx = 0, correct = 0, misses = 0;
  const startedAt = Date.now();
  const shell = document.getElementById('lesson-shell');
  let stopwatchHandle = null;

  function clearStopwatch() {
    if (stopwatchHandle) { clearInterval(stopwatchHandle); stopwatchHandle = null; }
  }

  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="speedrun-shell">
        <div class="speedrun-header">
          <span>🏁 ${escapeHtml(card.sectionName)} · ${idx + 1} of ${deck.length}</span>
          <button class="speedrun-exit" data-action="exit-speedrun">✕ Exit</button>
        </div>
        <div class="speedrun-stopwatch" data-speedrun-clock>0.0s</div>
        <div class="speedrun-meta"><span class="speedrun-lesson">${escapeHtml(card.lessonTitle)}</span></div>
        <div class="speedrun-question">${escapeHtml(card.q)}</div>
        <div class="speedrun-options">
          ${card.options.map((opt, i) => `<button class="speedrun-opt" data-opt-idx="${i}"><span class="speedrun-letter">${String.fromCharCode(65 + i)}</span>${escapeHtml(opt)}</button>`).join('')}
        </div>
        <div class="speedrun-feedback" data-speedrun-feedback></div>
      </div>
    `;
    const clockEl = shell.querySelector('[data-speedrun-clock]');
    stopwatchHandle = setInterval(() => {
      if (clockEl) clockEl.textContent = _formatSpeedrunMs(Date.now() - startedAt);
    }, 100);
    shell.querySelector('[data-action="exit-speedrun"]').addEventListener('click', () => {
      clearStopwatch();
      renderLesson();
    });
    const opts = shell.querySelectorAll('.speedrun-opt');
    let answered = false;
    const grade = (pickedIdx) => {
      if (answered) return;
      answered = true;
      const wasCorrect = pickedIdx === card.answerIdx;
      if (wasCorrect) correct++; else { misses++; state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1; appendHistory(card.lessonId, 'L1-miss'); saveProgress(); }
      opts.forEach((b, i) => {
        b.disabled = true;
        if (i === card.answerIdx) b.classList.add('speedrun-opt-correct');
        else if (i === pickedIdx) b.classList.add('speedrun-opt-wrong');
      });
      const fb = shell.querySelector('[data-speedrun-feedback]');
      if (fb) fb.innerHTML = wasCorrect ? `<span class="speedrun-good">✓</span>` : `<span class="speedrun-bad">✗ ${card.explain ? escapeHtml(card.explain) : ''}</span>`;
      setTimeout(() => { idx++; clearStopwatch(); renderCard(); }, wasCorrect ? 350 : 1100);
    };
    opts.forEach(btn => btn.addEventListener('click', () => grade(+btn.dataset.optIdx)));
  }

  function renderSummary() {
    clearStopwatch();
    const totalMs = Date.now() - startedAt;
    const prevBest = state.speedrun.bests[sectionSlug] || 0;
    const isNewBest = !prevBest || totalMs < prevBest;
    // Save best time regardless of misses — Speedrun is speed-first; misses
    // already feed state.weakness. Avoids the "I got 1 wrong, no best for me"
    // anti-pattern that would discourage retries.
    if (isNewBest) state.speedrun.bests[sectionSlug] = totalMs;
    state.speedrun.completions++;
    saveProgress();
    const deltaMs = prevBest ? prevBest - totalMs : 0;
    shell.innerHTML = `
      <div class="speedrun-shell">
        <div class="speedrun-header"><span>🏁 Speedrun · done</span></div>
        <div class="speedrun-summary">
          <div class="speedrun-summary-time">${_formatSpeedrunMs(totalMs)}</div>
          ${isNewBest && prevBest ? `<div class="speedrun-summary-pb">★ New personal best (−${_formatSpeedrunMs(deltaMs)})</div>` : ''}
          ${isNewBest && !prevBest ? `<div class="speedrun-summary-pb">★ First completion — that's your best</div>` : ''}
          ${!isNewBest ? `<div class="speedrun-summary-pb speedrun-summary-pb-off">Best: ${_formatSpeedrunMs(prevBest)} (+${_formatSpeedrunMs(totalMs - prevBest)} this run)</div>` : ''}
          <div class="speedrun-summary-line">${correct} of ${deck.length} correct${misses ? ` · ${misses} miss${misses === 1 ? '' : 'es'} flagged as weak spot` : ''}</div>
          <div class="speedrun-summary-actions">
            <button class="primary" data-action="speedrun-again">🏁 Re-run</button>
            <button class="secondary" data-action="speedrun-pick">Pick another</button>
            <button class="secondary" data-action="speedrun-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="speedrun-again"]').addEventListener('click', () => startSpeedrunSession(sectionSlug));
    shell.querySelector('[data-action="speedrun-pick"]').addEventListener('click', () => startSpeedrunPicker());
    shell.querySelector('[data-action="speedrun-done"]').addEventListener('click', () => renderLesson());
  }

  renderCard();
}

// iter 125: 🥊 Pattern-Family Gauntlet — chained L1 stream across EVERY full
// lesson in a single section, surfacing EVERY L1 question per lesson (not
// just the first). Cousin to Speedrun (iter 71): Speedrun is 1 L1/lesson on
// a stopwatch (speed-first); Gauntlet is all-L1 untimed (interleaving-by-
// family). Roadmap iter-124 #1 — first Cat 2 Active list refill since iter
// 45 path-aware SR queue (78+ iters stale). Misses → state.weakness like
// every other L1 surface; correct→appendHistory('L1-pass'), miss→'L1-miss'.
// No timer, no PB. Differentiator vs Today's Plan: family-deep, not
// cross-family-wide. Differentiator vs Speedrun: question coverage depth.
const GAUNTLET_MIN_LESSONS = 3; // sections with <3 full lessons skipped

function _gauntletPickableSections() {
  // Reuse Speedrun's section-grouping helper so manifest order is preserved.
  const rows = [];
  for (const sec of _speedrunSectionsGrouped()) {
    const fullLessons = sec.lessons.filter(l => l.status === 'full');
    if (fullLessons.length < GAUNTLET_MIN_LESSONS) continue;
    const stat = state.gauntlet?.bySection?.[sec.slug] || null;
    rows.push({
      slug: sec.slug,
      name: sec.name,
      track: fullLessons[0]?.track || '',
      fullCount: fullLessons.length,
      lastCorrect: stat ? +stat.lastCorrect || 0 : 0,
      lastTotal: stat ? +stat.lastTotal || 0 : 0
    });
  }
  return rows;
}

async function _gauntletBuildDeck(sectionSlug) {
  const sec = _speedrunSectionsGrouped().find(s => s.slug === sectionSlug);
  if (!sec) return null;
  const fullLessons = sec.lessons.filter(l => l.status === 'full');
  for (const l of fullLessons) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  const deck = [];
  for (const l of fullLessons) {
    const content = CONTENT[l.id];
    if (!content || !content.L1 || !Array.isArray(content.L1.questions)) continue;
    for (let qi = 0; qi < content.L1.questions.length; qi++) {
      const q = content.L1.questions[qi];
      if (!q || !Array.isArray(q.options) || typeof q.answer !== 'number') continue;
      const optOrder = _shuffleIndices(q.options.length);
      deck.push({
        lessonId: l.id,
        lessonTitle: l.title,
        sectionName: sec.name,
        qIdx: qi,
        qTotal: content.L1.questions.length,
        q: q.q,
        options: optOrder.map(i => q.options[i]),
        answerIdx: optOrder.indexOf(q.answer),
        explain: q.explain || ''
      });
    }
  }
  return deck.length >= GAUNTLET_MIN_LESSONS ? deck : null;
}

function startGauntletPicker() {
  const sections = _gauntletPickableSections();
  if (!sections.length) {
    alert('No gauntlet-eligible sections yet (need ≥3 full lessons each).');
    return;
  }
  const shell = document.getElementById('lesson-shell');
  shell.innerHTML = `
    <div class="gauntlet-shell gauntlet-picker">
      <div class="gauntlet-header">
        <span>🥊 Pattern-Family Gauntlet · pick a section</span>
        <button class="gauntlet-exit" data-action="exit-gauntlet">✕ Exit</button>
      </div>
      <div class="gauntlet-picker-hint">Run EVERY L1 question across EVERY lesson in one section, back-to-back. No timer — interleave the family's patterns. (Today's Plan = broad sample · Speedrun = first-L1 sprint · Gauntlet = deep on one family.)</div>
      <div class="gauntlet-picker-list" data-gauntlet-picker>
        ${sections.map(s => `
          <button class="gauntlet-pick-row" data-slug="${escapeHtml(s.slug)}">
            <span class="gauntlet-pick-name">${escapeHtml(s.name)}</span>
            <span class="gauntlet-pick-count">${s.fullCount} lessons</span>
            <span class="gauntlet-pick-last" data-last>${s.lastTotal ? `last: ${s.lastCorrect}/${s.lastTotal}` : ''}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  shell.querySelector('[data-action="exit-gauntlet"]').addEventListener('click', () => renderLesson());
  shell.querySelectorAll('.gauntlet-pick-row').forEach(btn => {
    btn.addEventListener('click', () => startGauntletSession(btn.dataset.slug));
  });
}

async function startGauntletSession(sectionSlug) {
  const deck = await _gauntletBuildDeck(sectionSlug);
  if (!deck || !deck.length) {
    alert('Gauntlet deck is empty for this section.');
    return;
  }
  state.gauntlet.sessions++;
  state.gauntlet.lastRunAt = Date.now();
  saveProgress();

  const sectionName = deck[0].sectionName;
  let idx = 0, correct = 0, misses = 0;
  const shell = document.getElementById('lesson-shell');

  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="gauntlet-shell">
        <div class="gauntlet-header">
          <span>🥊 ${escapeHtml(sectionName)} · ${idx + 1} of ${deck.length}</span>
          <button class="gauntlet-exit" data-action="exit-gauntlet">✕ Exit</button>
        </div>
        <div class="gauntlet-progress-strip" data-gauntlet-progress>
          ${deck.map((_, i) => `<span class="gauntlet-pip${i < idx ? ' gauntlet-pip-done' : ''}${i === idx ? ' gauntlet-pip-active' : ''}"></span>`).join('')}
        </div>
        <div class="gauntlet-meta"><span class="gauntlet-lesson">${escapeHtml(card.lessonTitle)}</span> · L1 Q${card.qIdx + 1}/${card.qTotal}</div>
        <div class="gauntlet-question">${escapeHtml(card.q)}</div>
        <div class="gauntlet-options">
          ${card.options.map((opt, i) => `<button class="gauntlet-opt" data-opt-idx="${i}"><span class="gauntlet-letter">${String.fromCharCode(65 + i)}</span>${escapeHtml(opt)}</button>`).join('')}
        </div>
        <div class="gauntlet-feedback" data-gauntlet-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-gauntlet"]').addEventListener('click', () => renderLesson());
    const opts = shell.querySelectorAll('.gauntlet-opt');
    let answered = false;
    const grade = (pickedIdx) => {
      if (answered) return;
      answered = true;
      const wasCorrect = pickedIdx === card.answerIdx;
      if (wasCorrect) {
        correct++;
        appendHistory(card.lessonId, 'L1-pass');
      } else {
        misses++;
        state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
        appendHistory(card.lessonId, 'L1-miss');
      }
      saveProgress();
      opts.forEach((b, i) => {
        b.disabled = true;
        if (i === card.answerIdx) b.classList.add('gauntlet-opt-correct');
        else if (i === pickedIdx) b.classList.add('gauntlet-opt-wrong');
      });
      const fb = shell.querySelector('[data-gauntlet-feedback]');
      if (fb) fb.innerHTML = wasCorrect ? `<span class="gauntlet-good">✓</span>` : `<span class="gauntlet-bad">✗ ${card.explain ? escapeHtml(card.explain) : ''}</span>`;
      setTimeout(() => { idx++; renderCard(); }, wasCorrect ? 380 : 1200);
    };
    opts.forEach(btn => btn.addEventListener('click', () => grade(+btn.dataset.optIdx)));
  }

  function renderSummary() {
    state.gauntlet.completions++;
    if (!state.gauntlet.bySection) state.gauntlet.bySection = {};
    const prev = state.gauntlet.bySection[sectionSlug] || { sessions: 0 };
    state.gauntlet.bySection[sectionSlug] = {
      sessions: (prev.sessions || 0) + 1,
      lastCorrect: correct,
      lastTotal: deck.length,
      lastRunAt: Date.now()
    };
    saveProgress();
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="gauntlet-shell">
        <div class="gauntlet-header"><span>🥊 Gauntlet · done</span></div>
        <div class="gauntlet-summary">
          <div class="gauntlet-summary-score">${correct} / ${deck.length}</div>
          <div class="gauntlet-summary-pct">${pct}% across ${escapeHtml(sectionName)}</div>
          ${misses ? `<div class="gauntlet-summary-line">${misses} miss${misses === 1 ? '' : 'es'} flagged as weak spot</div>` : `<div class="gauntlet-summary-line">Clean run.</div>`}
          <div class="gauntlet-summary-actions">
            <button class="primary" data-action="gauntlet-again">🥊 Re-run</button>
            <button class="secondary" data-action="gauntlet-pick">Pick another</button>
            <button class="secondary" data-action="gauntlet-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="gauntlet-again"]').addEventListener('click', () => startGauntletSession(sectionSlug));
    shell.querySelector('[data-action="gauntlet-pick"]').addEventListener('click', () => startGauntletPicker());
    shell.querySelector('[data-action="gauntlet-done"]').addEventListener('click', () => renderLesson());
  }

  renderCard();
}

// iter 62: 📅 Streak Map — 60-day calendar density heatmap. Aggregates
// state.history events across ALL lessons by day, returning a 60-element
// array (oldest first → newest last) so the renderer can paint a fixed
// grid. Closes iter-59 roadmap entry #3. Carefully avoids PROFILE.md L75
// gamification anti-pattern by NOT exposing streak counts or shame
// chips — just the calendar shape so the user sees the rhythm without
// the "broke my streak, can't recover" trap.
