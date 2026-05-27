function _streakMapBuckets(lookbackDays = 60) {
  const now = Date.now();
  // Start of today (midnight) so each cell aligns to a calendar day.
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 86400000;
  // Build an empty bucket array [oldest, ..., today]
  const buckets = Array.from({ length: lookbackDays }, (_, i) => {
    const dayStart = startOfToday.getTime() - (lookbackDays - 1 - i) * dayMs;
    const d = new Date(dayStart);
    return {
      dateMs: dayStart,
      dateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      isoDate: d.toISOString().slice(0, 10),
      total: 0,
      passes: 0,
      misses: 0
    };
  });
  const startMs = buckets[0].dateMs;
  // Walk every lesson's history; bucket events into days.
  for (const lessonId of Object.keys(state.history || {})) {
    const events = state.history[lessonId];
    if (!Array.isArray(events)) continue;
    for (const e of events) {
      if (!e || typeof e.at !== 'number' || !e.event) continue;
      if (e.at < startMs) continue;
      const dayIdx = Math.floor((e.at - startMs) / dayMs);
      if (dayIdx < 0 || dayIdx >= lookbackDays) continue;
      const bucket = buckets[dayIdx];
      bucket.total++;
      if (e.event === 'L1-miss') bucket.misses++;
      else if (e.event === 'L1-pass' || e.event === 'L2-pass' || e.event === 'L3-pass') bucket.passes++;
      // Other events (e.g. hint-tier-N, critical-lines-used) are counted in
      // `total` but not classified — they're activity, not pass/miss signal.
    }
  }
  return buckets;
}
// iter 73: 🪲 Code Bug-Hunt — first §9B (Code Evaluation Skills) surface,
// closing the 37-iter gap flagged by iter-36's catalog cross-cutting note.
// Auto-mutator picks a random patterns-track canonical, applies ONE simple
// operator/boundary mutation at ONE random site, verifies via runCode() that
// the mutation actually breaks the lesson's expectedOutput, and surfaces the
// buggy code with line numbers. User taps the line they think is wrong —
// trains code-review / debug-localization, the reflex interviewers explicitly
// grade. Pure data recombination — no per-lesson authoring needed.
const BUG_HUNT_DECK_LEN = 5;
const BUG_HUNT_MUTATORS = [
  // Order matters only for tie-breaking; mutator selection is randomized.
  // Lookaheads keep `<<`, `>>`, `<=`, `>=`, `==` from being mis-matched.
  { name: '< → <=',   from: /<(?!=|<)/g,  to: '<=' },
  { name: '<= → <',   from: /<=/g,         to: '<'  },
  { name: '> → >=',   from: />(?!=|>)/g,   to: '>=' },
  { name: '>= → >',   from: />=/g,         to: '>'  },
  { name: '++ → --',  from: /\+\+/g,       to: '--' },
  { name: '-- → ++',  from: /--/g,         to: '++' },
  { name: '=== → !==', from: /===/g,       to: '!==' },
  { name: '!== → ===', from: /!==/g,       to: '===' },
  { name: '&& → ||',  from: /&&/g,         to: '||' },
  { name: '|| → &&',  from: /\|\|/g,       to: '&&' }
];

function _bugHuntCollectMatches(code, regex) {
  const re = new RegExp(regex.source, regex.flags);
  const out = [];
  let m;
  while ((m = re.exec(code)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, matched: m[0] });
    if (m.index === re.lastIndex) re.lastIndex++; // safety against zero-width
  }
  return out;
}

function _bugHuntLineOf(code, offset) {
  // 1-indexed line number of `offset` within `code`.
  let line = 1;
  for (let i = 0; i < offset && i < code.length; i++) {
    if (code.charCodeAt(i) === 10) line++;
  }
  return line;
}

function _bugHuntShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function _bugHuntFindBreakingMutation(canonical, expected) {
  // Try mutators in random order; for each, try matches in random order until
  // one yields a runCode output that doesn't match expected. Returns null if
  // no breaking mutation found (caller skips the lesson).
  // iter 143: switched from BUG_HUNT_MUTATORS (10) to SAFE_MUTATORS (7) —
  // the 3 excluded mutators (`++ → --`, `-- → ++`, `&& → ||`) could produce
  // sync infinite loops at loop counters / restrictive guards. iter-142
  // CDP probe started hanging intermittently; user-facing risk is a frozen
  // tab on Bug-Hunt session start. Variety loss is 30%, but the remaining
  // 7 still cover boundary comparisons (most common bug shape) + equality
  // flips + `|| → &&`. See SAFE_MUTATORS comment above.
  const expectedLines = normalizeLines(expected);
  for (const mut of _bugHuntShuffle(SAFE_MUTATORS)) {
    const matches = _bugHuntCollectMatches(canonical, mut.from);
    if (!matches.length) continue;
    for (const pick of _bugHuntShuffle(matches).slice(0, 4)) {
      const mutated = canonical.slice(0, pick.start) + mut.to + canonical.slice(pick.end);
      let res;
      try {
        res = await runCode(mutated);
      } catch (_) { continue; }
      // Treat any of these as "breaks": runtime error, output differs, or
      // (subsequence semantics) any expected line missing from actual.
      const actualLines = normalizeLines(res.output || '');
      let broken = false;
      if (!res.ok) {
        broken = true;
      } else if (actualLines.join('\n') !== expectedLines.join('\n')) {
        // Strict line-equality is the safer signal for the user-facing card —
        // subsequence semantics would mark "extra debug output is fine" as
        // not-broken, but for bug hunt we want any visible diff to count.
        broken = true;
      }
      if (broken) {
        return {
          mutator: mut.name,
          line: _bugHuntLineOf(canonical, pick.start),
          mutatedCode: mutated,
          originalCode: canonical
        };
      }
    }
  }
  return null;
}

async function _bugHuntBuildDeck() {
  // Sample patterns-track full lessons (avoid syntax — boundary mutations are
  // less interview-realistic on simple syntax demos). Cap candidate pool so
  // we don't burn time hunting mutations for trivial canonicals.
  const candidates = CURRICULUM.filter(l => l.track === 'patterns' && l.status === 'full');
  const shuffled = _bugHuntShuffle(candidates).slice(0, 16);
  for (const l of shuffled) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  const deck = [];
  for (const l of shuffled) {
    if (deck.length >= BUG_HUNT_DECK_LEN) break;
    const c = CONTENT[l.id];
    if (!c || !c.L3 || !c.L3.canonical || !c.L3.expectedOutput) continue;
    const breaking = await _bugHuntFindBreakingMutation(c.L3.canonical, c.L3.expectedOutput);
    if (!breaking) continue;
    deck.push({
      lessonId: l.id,
      lessonTitle: l.title,
      sectionName: l.section,
      buggyCode: breaking.mutatedCode,
      buggyLine: breaking.line,
      mutator: breaking.mutator,
      originalCode: breaking.originalCode
    });
  }
  return deck;
}

async function startBugHuntSession() {
  state.bugHunt.sessions++;
  state.bugHunt.lastRunAt = Date.now();
  saveProgress();
  const shell = document.getElementById('lesson-shell');
  shell.innerHTML = `<div class="bug-shell"><div class="bug-loading">🪲 Hunting bugs…</div></div>`;
  const deck = await _bugHuntBuildDeck();
  if (!deck.length) {
    shell.innerHTML = `<div class="bug-shell"><div class="bug-loading">No breakable canonicals found in this round — try again.</div><div class="bug-summary-actions"><button class="secondary" data-action="bug-back">Back</button></div></div>`;
    shell.querySelector('[data-action="bug-back"]').addEventListener('click', () => renderLesson());
    return;
  }
  let idx = 0, correct = 0;

  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    const lines = card.buggyCode.split('\n');
    shell.innerHTML = `
      <div class="bug-shell">
        <div class="bug-header">
          <span>🪲 Bug-Hunt · ${idx + 1} of ${deck.length}</span>
          <button class="bug-exit" data-action="exit-bug">✕ Exit</button>
        </div>
        <div class="bug-meta">${escapeHtml(card.sectionName)} · <span class="bug-lesson">${escapeHtml(card.lessonTitle)}</span></div>
        <div class="bug-prompt">One operator was flipped. Tap the buggy line.</div>
        <div class="bug-code">
          ${lines.map((ln, i) => `<button class="bug-line" data-line-idx="${i + 1}"><span class="bug-line-num">${i + 1}</span><span class="bug-line-text">${escapeHtml(ln || ' ')}</span></button>`).join('')}
        </div>
        <div class="bug-feedback" data-bug-feedback></div>
      </div>
    `;
    shell.querySelector('[data-action="exit-bug"]').addEventListener('click', () => renderLesson());
    const lineBtns = shell.querySelectorAll('.bug-line');
    let answered = false;
    const grade = (pickedLineNum) => {
      if (answered) return;
      answered = true;
      const wasCorrect = pickedLineNum === card.buggyLine;
      if (wasCorrect) correct++;
      state.bugHunt.attempts++;
      if (wasCorrect) state.bugHunt.correct++; else state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
      saveProgress();
      lineBtns.forEach(btn => {
        btn.disabled = true;
        const ln = +btn.dataset.lineIdx;
        if (ln === card.buggyLine) btn.classList.add('bug-line-correct');
        else if (ln === pickedLineNum) btn.classList.add('bug-line-wrong');
      });
      const fb = shell.querySelector('[data-bug-feedback]');
      if (fb) fb.innerHTML = wasCorrect
        ? `<span class="bug-good">✓ Line ${card.buggyLine} · ${escapeHtml(card.mutator)}</span>`
        : `<span class="bug-bad">✗ Actually line ${card.buggyLine} (${escapeHtml(card.mutator)})</span>`;
      setTimeout(() => { idx++; renderCard(); }, wasCorrect ? 900 : 1700);
    };
    lineBtns.forEach(btn => btn.addEventListener('click', () => grade(+btn.dataset.lineIdx)));
  }

  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="bug-shell">
        <div class="bug-header"><span>🪲 Bug-Hunt · done</span></div>
        <div class="bug-summary">
          <div class="bug-summary-pct">${pct}%</div>
          <div class="bug-summary-line">${correct} of ${deck.length} bugs found</div>
          <div class="bug-summary-lifetime">Lifetime: ${state.bugHunt.correct} / ${state.bugHunt.attempts} (${state.bugHunt.attempts > 0 ? Math.round(state.bugHunt.correct / state.bugHunt.attempts * 100) : 0}%)</div>
          <div class="bug-summary-actions">
            <button class="primary" data-action="bug-again">🪲 Another hunt</button>
            <button class="secondary" data-action="bug-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="bug-again"]').addEventListener('click', () => startBugHuntSession());
    shell.querySelector('[data-action="bug-done"]').addEventListener('click', () => renderLesson());
  }

  renderCard();
}

// iter 142: 🔀 Mutate-and-Predict — §9B forward-simulation drill. Where
// Bug-Hunt (iter 73) trains LOCALIZATION (click the buggy line — visual /
// textual recognition), Mutate trains FORWARD SIMULATION (name the type
// of failure the mutation causes — mental trace + taxonomy classification).
// Reuses BUG_HUNT_MUTATORS + _bugHuntCollectMatches + _bugHuntLineOf +
// _bugHuntShuffle from iter 73 so the operator-mutation infrastructure
// stays in one place. The differentiator is the classifier + the consequence
// taxonomy distractor pool (not the localization).
const MUTATE_DECK_LEN = 5;
const MUTATE_CLASSES = [
  { label: 'Output unchanged', desc: 'The mutated code produces the same output as the canonical did.' },
  { label: 'Wrong output, same shape', desc: 'Output is the same TYPE (number/array/string) but the content is wrong.' },
  { label: 'Runtime error / throws', desc: 'The mutation makes the code throw at runtime (or hit a forbidden path).' },
  { label: 'Different output type', desc: 'Output type changed entirely — e.g. array became undefined, number became string.' }
];
// Hang-safe subset of BUG_HUNT_MUTATORS — shared between iter-73 Bug-Hunt
// (after iter-143 port) and iter-142 Mutate-and-Predict. The 3 excluded
// mutators (`++ → --`, `-- → ++`, `&& → ||`) can flip a loop counter
// direction or relax a restrictive guard, turning a finite loop into an
// infinite one. runCode wraps user code in a SYNCHRONOUS `new Function`
// call — a Promise.race timeout can't interrupt it; the only safe
// protection is not picking those mutations. iter-143 surfaced that the
// vulnerability had been latent in Bug-Hunt since iter 73 (Bug-Hunt CDP
// probe started hanging intermittently after iter-142's tighter deck-build
// loop made the issue reproducible). The remaining 7 mutators still cover
// the most common interview bug shapes: boundary comparisons (4) +
// equality flips (2) + `|| → &&` (1, the restriction-only direction).
const SAFE_MUTATORS = BUG_HUNT_MUTATORS.filter(m =>
  m.name !== '++ → --' && m.name !== '-- → ++' && m.name !== '&& → ||'
);

// Heuristic type inference over a stringified `runCode` output. The runner
// already stringifies numbers / booleans / objects / arrays via formatArg
// (see js/core/runner.js), so a regex pass over the trimmed string is enough
// to distinguish the 6-7 shapes the classifier needs. Used by _mutateClassify.
function _mutateInferType(s) {
  if (s === null || s === undefined) return 'undefined';
  const t = String(s).trim();
  if (!t) return 'empty';
  if (t === 'undefined') return 'undefined';
  if (t === 'null') return 'null';
  if (t === 'true' || t === 'false') return 'boolean';
  if (/^-?\d+$/.test(t)) return 'integer';
  if (/^-?\d+(\.\d+)?$/.test(t)) return 'number';
  if (t.startsWith('[')) return 'array';
  if (t.startsWith('{') && !t.startsWith('{ ')) return 'object';  // exclude Map() rendering
  return 'string';
}

// Classify a mutation result against the canonical's expected output.
// Returns 0..3 (index into MUTATE_CLASSES) or null if the mutation isn't
// usable (e.g. produced a hang or unparseable state — guarded upstream).
function _mutateClassify(res, expected) {
  if (!res.ok) return 2;                              // runtime error / throws
  const actual = res.output || '';
  if (actual === expected) return 0;                  // output unchanged
  const actType = _mutateInferType(actual);
  const expType = _mutateInferType(expected);
  if (actType !== expType) return 3;                  // different output type
  return 1;                                           // wrong content, same shape
}

// Pick the first classifiable mutation from a random walk of mutators ×
// match sites. Returns null when none of the tried mutations land in a
// usable class (rare — most canonicals have plenty of operators to mutate).
async function _mutateClassifyMutation(canonical, expected) {
  // Use the hang-safe subset (shared with Bug-Hunt since iter 143) — see
  // SAFE_MUTATORS comment for the hang-protection rationale.
  for (const mut of _bugHuntShuffle(SAFE_MUTATORS)) {
    const matches = _bugHuntCollectMatches(canonical, mut.from);
    if (!matches.length) continue;
    for (const pick of _bugHuntShuffle(matches).slice(0, 3)) {
      const mutated = canonical.slice(0, pick.start) + mut.to + canonical.slice(pick.end);
      let res;
      try {
        res = await runCode(mutated);
      } catch (_) { continue; }
      const cls = _mutateClassify(res, expected);
      if (cls === null) continue;
      return {
        mutator: mut.name,
        line: _bugHuntLineOf(canonical, pick.start),
        mutatedCode: mutated,
        originalCode: canonical,
        consequenceClass: cls,
        observedOutput: res.ok ? (res.output || '(empty)') : (res.output || 'Error')
      };
    }
  }
  return null;
}

// Build a 5-card deck. Samples Patterns/Applied lessons (operator-mutation
// is most interview-realistic on algorithmic code, not on basic Syntax
// reference demos). Note: differentiator from Bug-Hunt's deck — Bug-Hunt
// filters for mutations that BREAK output (the "find the bug" surface
// requires a real bug); Mutate INCLUDES unchanged-output mutations as the
// `consequenceClass=0` ("still-correct") class — that's a load-bearing
// piece of the consequence-class taxonomy. The probe asserts at least one
// class-0 card can land in a deck given enough samples.
async function _mutateBuildDeck() {
  const candidates = CURRICULUM.filter(l =>
    (l.track === 'patterns' || l.track === 'applied') && l.status === 'full'
  );
  const shuffled = _bugHuntShuffle(candidates).slice(0, 12);
  for (const l of shuffled) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  const deck = [];
  for (const l of shuffled) {
    if (deck.length >= MUTATE_DECK_LEN) break;
    const c = CONTENT[l.id];
    if (!c || !c.L3 || !c.L3.canonical || !c.L3.expectedOutput) continue;
    const classified = await _mutateClassifyMutation(c.L3.canonical, c.L3.expectedOutput);
    if (!classified) continue;
    deck.push({
      lessonId: l.id,
      lessonTitle: l.title,
      sectionName: l.section,
      mutatedCode: classified.mutatedCode,
      mutatedLine: classified.line,
      mutator: classified.mutator,
      originalCode: classified.originalCode,
      correctClass: classified.consequenceClass,
      observedOutput: classified.observedOutput,
      expectedOutput: c.L3.expectedOutput
    });
  }
  return deck;
}

async function startMutateSession() {
  const deck = await _mutateBuildDeck();
  if (!deck || deck.length < 3) {
    alert('Mutate-and-Predict needs more Patterns/Applied lessons loaded. Try again after clicking around a few lessons.');
    return;
  }
  state.mutate.sessions++;
  state.mutate.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell mutate-shell">
        <div class="recognize-header">
          <span>🔀 Mutate · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-mutate">✕ Exit</button>
        </div>
        <div class="whatif-lesson-tag">${escapeHtml(card.lessonTitle)} · ${escapeHtml(card.sectionName)}</div>
        <pre class="whatif-canonical cm-s-dracula" data-mutate-code></pre>
        <div class="mutate-mutator-tag">Mutation: <span class="mutate-mutator">${escapeHtml(card.mutator)}</span> at line ${card.mutatedLine}</div>
        <div class="whatif-tag">What happens when this code runs against the canonical's expected input?</div>
        <div class="whatif-options">
          ${MUTATE_CLASSES.map((c, i) => `
            <button class="recognize-opt whatif-opt mutate-opt" data-opt="${i}" title="${escapeHtml(c.desc)}">
              <span class="whatif-opt-letter">${String.fromCharCode(65 + i)}</span>
              <span class="whatif-opt-val">${escapeHtml(c.label)}</span>
            </button>
          `).join('')}
        </div>
        <div class="recognize-feedback" data-mutate-feedback></div>
      </div>
    `;
    const codeEl = shell.querySelector('[data-mutate-code]');
    if (codeEl && typeof colorizeInto === 'function') colorizeInto(codeEl, card.mutatedCode);
    else if (codeEl) codeEl.textContent = card.mutatedCode;
    shell.querySelector('[data-action="exit-mutate"]').addEventListener('click', () => renderLesson());
    const optBtns = shell.querySelectorAll('.mutate-opt');
    let answered = false;
    optBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const optIdx = +btn.dataset.opt;
        const wasRight = optIdx === card.correctClass;
        if (wasRight) correct++;
        else {
          state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
          appendHistory(card.lessonId, 'L1-miss');
        }
        state.mutate.attempts++;
        if (wasRight) state.mutate.correct++;
        saveProgress();
        optBtns.forEach((b, i) => {
          b.disabled = true;
          if (i === card.correctClass) b.classList.add('recognize-opt-correct');
          else if (i === optIdx) b.classList.add('recognize-opt-wrong');
        });
        const fb = shell.querySelector('[data-mutate-feedback]');
        if (fb) {
          const obs = card.correctClass === 0
            ? '(Output: unchanged from the canonical.)'
            : card.correctClass === 2
              ? `Threw: ${escapeHtml(card.observedOutput)}`
              : `Output: <span class="mono">${escapeHtml(card.observedOutput)}</span> (expected <span class="mono">${escapeHtml(card.expectedOutput)}</span>)`;
          fb.innerHTML = `
            <div class="whatif-reveal">
              <div class="whatif-reveal-title">${wasRight ? '✓ Got it' : '✗ The right answer was'}</div>
              <div class="whatif-reveal-val">${escapeHtml(MUTATE_CLASSES[card.correctClass].label)}</div>
              <div class="mutate-observed">${obs}</div>
              <button class="whatif-drill" data-drill="${escapeHtml(card.lessonId)}">Drill this lesson →</button>
              <button class="whatif-next" data-action="mutate-next">Next card</button>
            </div>
          `;
          const drillBtn = fb.querySelector('[data-drill]');
          if (drillBtn) drillBtn.addEventListener('click', () => {
            const lid = drillBtn.dataset.drill;
            if (typeof selectLesson === 'function') selectLesson(lid);
          });
          fb.querySelector('[data-action="mutate-next"]').addEventListener('click', () => { idx++; renderCard(); });
        }
      });
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell mutate-shell">
        <div class="recognize-header"><span>🔀 Mutate · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} consequences predicted · ${deck.length - correct} flagged as weak spots</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.mutate.correct} / ${state.mutate.attempts} (${state.mutate.attempts > 0 ? Math.round(state.mutate.correct / state.mutate.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="mutate-again">🔀 Another session</button>
            <button class="secondary" data-action="mutate-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="mutate-again"]').addEventListener('click', () => startMutateSession());
    shell.querySelector('[data-action="mutate-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 147: 📞 Phone Screen Simulator — Cat 2 Paths & Sessions. Chains 3 cards
// (1 syntax-track Reference-readonly warmup + 1 pattern-track L3 editor + 1
// mechanic-related L2 fill follow-up) under ONE unbroken timer (~12-15 min
// total). The unified clock is the load-bearing piece — Mock has a timer but
// only over a single lesson; Gauntlet chains lessons but has no timer. This
// surface combines both axes to reproduce the actual phone-screen shape:
// cumulative pressure across lesson transitions. PROFILE L22-24 "interview-
// format conditioning."
//
// Deck recipe is deterministic per-session (random within each card slot):
//   - Card 1: any syntax-track full lesson (any has notes; iter-144 scan
//     confirmed 100% reference.notes coverage).
//   - Card 2: random pattern-track full lesson with ≥1 mechanic (72 / 79
//     pattern lessons qualify per iter-147 pre-scan).
//   - Card 3: a DIFFERENT lesson sharing ≥1 mechanic with card 2 (via
//     existing MECHANIC_INDEX). Fallback: any random pattern lesson if no
//     mechanic-overlap candidate exists (rare — 24 mechanics shared by ≥3
//     lessons make the overlap pick reliable).
async function _phoneScreenBuildDeck() {
  // Force-load all content first so MECHANIC_INDEX is complete; reuses the
  // same ensureMechanicIndex() helper Mechanics modal + Bridge use.
  await ensureMechanicIndex();
  const fullLessons = CURRICULUM.filter(l => l.status === 'full');
  // Card 1: random syntax-track lesson with reference.code present (every
  // full lesson has it per validator).
  const syntaxPool = fullLessons.filter(l => l.track === 'syntax');
  if (!syntaxPool.length) return null;
  const card1Lesson = syntaxPool[Math.floor(Math.random() * syntaxPool.length)];
  // Card 2: random pattern-track lesson with ≥1 mechanic. If no patterns
  // have mechanics (impossible per pre-scan but guard anyway), fall back to
  // any pattern lesson.
  const patternPool = fullLessons.filter(l =>
    l.track === 'patterns' &&
    CONTENT[l.id]?.mechanics && CONTENT[l.id].mechanics.length > 0
  );
  if (!patternPool.length) return null;
  const card2Lesson = patternPool[Math.floor(Math.random() * patternPool.length)];
  // Card 3: a lesson sharing ≥1 mechanic with card 2. Walk card 2's mechanics
  // in shuffled order; for each, find lessons in MECHANIC_INDEX excluding
  // card 2; pick one at random. Fallback to any non-card-2 pattern lesson.
  const card2Mechs = CONTENT[card2Lesson.id].mechanics || [];
  let card3Lesson = null;
  for (const mid of _bugHuntShuffle(card2Mechs)) {
    const bucket = MECHANIC_INDEX.get(mid);
    if (!bucket) continue;
    const overlap = Array.from(bucket).filter(id => id !== card2Lesson.id);
    if (overlap.length === 0) continue;
    const pickedId = overlap[Math.floor(Math.random() * overlap.length)];
    card3Lesson = CURRICULUM.find(l => l.id === pickedId);
    if (card3Lesson && card3Lesson.status === 'full') break;
    card3Lesson = null;
  }
  if (!card3Lesson) {
    const fallbackPool = patternPool.filter(l => l.id !== card2Lesson.id);
    if (!fallbackPool.length) return null;
    card3Lesson = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
  }
  // Ensure all 3 lessons' content is loaded. ensureMechanicIndex already
  // calls ensureAllContentLoaded but be defensive.
  for (const l of [card1Lesson, card2Lesson, card3Lesson]) {
    if (!CONTENT[l.id]) {
      try { await loadLessonContent(l.id); } catch (_) { /* skip */ }
    }
  }
  return [
    { lessonId: card1Lesson.id, title: card1Lesson.title, sectionName: card1Lesson.section, kind: 'warmup' },
    { lessonId: card2Lesson.id, title: card2Lesson.title, sectionName: card2Lesson.section, kind: 'pattern' },
    { lessonId: card3Lesson.id, title: card3Lesson.title, sectionName: card3Lesson.section, kind: 'followup' }
  ];
}

async function startPhoneScreenSession() {
  const deck = await _phoneScreenBuildDeck();
  if (!deck || deck.length !== 3) {
    alert('Phone Screen needs more lessons loaded. Try again after clicking around a few syntax + patterns lessons.');
    return;
  }
  state.phoneScreen.sessions++;
  state.phoneScreen.lastRunAt = Date.now();
  saveProgress();
  let idx = 0;
  const outcomes = []; // {kind, lessonId, passed}
  const shell = document.getElementById('lesson-shell');
  const sessionStartMs = Date.now();
  let tickHandle = null;
  function startTimerTick() {
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = setInterval(() => {
      const el = document.getElementById('phone-screen-timer');
      if (el) el.textContent = formatTime(Date.now() - sessionStartMs);
    }, 250);
  }
  function stopTimerTick() {
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  }
  function pipsHtml() {
    return deck.map((_, i) => {
      const cls = i < idx ? 'phone-pip-done' : (i === idx ? 'phone-pip-active' : 'phone-pip-pending');
      return `<span class="phone-pip ${cls}" data-pip-idx="${i}"></span>`;
    }).join('');
  }
  function renderShellChrome(bodyHtml) {
    shell.innerHTML = `
      <div class="recognize-shell phone-screen-shell">
        <div class="recognize-header">
          <span>📞 Phone Screen · <span id="phone-screen-timer" class="mono">0:00</span></span>
          <button class="recognize-exit" data-action="exit-phone-screen">✕ End interview</button>
        </div>
        <div class="phone-pips" aria-label="3-card session progress">${pipsHtml()}</div>
        <div class="phone-card-tag">Card ${idx + 1} of 3 · ${escapeHtml(deck[idx].title)} · ${escapeHtml(deck[idx].sectionName)}</div>
        <div class="phone-card-body" data-phone-card-body>${bodyHtml}</div>
      </div>
    `;
    shell.querySelector('[data-action="exit-phone-screen"]').addEventListener('click', () => {
      stopTimerTick();
      renderLesson();
    });
    startTimerTick();
  }
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    const content = CONTENT[card.lessonId];
    if (!content) {
      renderShellChrome(`<div class="phone-card-error">Lesson content failed to load. Try again.</div>`);
      return;
    }
    if (card.kind === 'warmup') {
      renderShellChrome(`
        <div class="phone-card-instructions">Warm-up: read the canonical + notes. Tap "Got it" when ready.</div>
        <pre class="phone-warmup-code cm-s-dracula" data-phone-warmup-code></pre>
        <div class="phone-card-notes-label">Notes:</div>
        <ul class="phone-card-notes">${(content.reference.notes || []).map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
        <div class="phone-card-actions">
          <button class="primary" data-action="phone-next">Got it →</button>
        </div>
      `);
      const codeEl = shell.querySelector('[data-phone-warmup-code]');
      if (codeEl && typeof colorizeInto === 'function') colorizeInto(codeEl, content.reference.code);
      else if (codeEl) codeEl.textContent = content.reference.code;
      shell.querySelector('[data-action="phone-next"]').addEventListener('click', () => {
        outcomes.push({ kind: 'warmup', lessonId: card.lessonId, passed: true });
        idx++;
        renderCard();
      });
    } else if (card.kind === 'pattern') {
      const drill = content.L3;
      renderShellChrome(`
        <div class="phone-card-instructions">Pattern L3 — type the canonical from scratch. Run to grade.</div>
        <div class="phone-prompt-block">
          <div class="phone-prompt-label">Prompt</div>
          <div class="phone-prompt-text">${escapeHtml(drill.prompt)}</div>
          <div class="phone-prompt-expected">Expected output: <span class="mono">${escapeHtml(drill.expectedOutput)}</span></div>
        </div>
        <textarea class="phone-l3-editor" data-phone-l3-editor></textarea>
        <div class="phone-card-actions">
          <button class="primary" data-action="phone-run">Run</button>
          <button class="secondary" data-action="phone-give-up">Give up → next card</button>
          <span class="phone-feedback" data-phone-feedback></span>
        </div>
      `);
      const ta = shell.querySelector('[data-phone-l3-editor]');
      const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const cm = CodeMirror.fromTextArea(ta, {
        mode: 'javascript', theme: 'dracula', lineNumbers: true,
        autoCloseBrackets: true, matchBrackets: true, indentUnit: 2, tabSize: 2,
        lineWrapping: true, viewportMargin: Infinity,
        inputStyle: isTouchDevice ? 'contenteditable' : 'textarea',
        spellcheck: false, autocorrect: false, autocapitalize: false
      });
      const fb = shell.querySelector('[data-phone-feedback]');
      shell.querySelector('[data-action="phone-run"]').addEventListener('click', async () => {
        const code = cm.getValue();
        if (!code.trim()) { fb.textContent = '✗ Editor empty.'; fb.className = 'phone-feedback phone-feedback-warn'; return; }
        fb.textContent = 'Running…'; fb.className = 'phone-feedback';
        const res = await runCode(code);
        if (!res.ok) {
          fb.textContent = `✗ Error: ${(res.output || 'unknown').slice(0, 60)}`;
          fb.className = 'phone-feedback phone-feedback-err';
        } else if ((res.output || '') === drill.expectedOutput) {
          fb.textContent = '✓ Pass — moving to follow-up';
          fb.className = 'phone-feedback phone-feedback-pass';
          outcomes.push({ kind: 'pattern', lessonId: card.lessonId, passed: true });
          setTimeout(() => { idx++; renderCard(); }, 700);
        } else {
          const got = (res.output || '(empty)').slice(0, 60);
          fb.textContent = `✗ Output: ${got} (expected: ${drill.expectedOutput.slice(0, 40)})`;
          fb.className = 'phone-feedback phone-feedback-warn';
        }
      });
      shell.querySelector('[data-action="phone-give-up"]').addEventListener('click', () => {
        outcomes.push({ kind: 'pattern', lessonId: card.lessonId, passed: false });
        idx++;
        renderCard();
      });
    } else if (card.kind === 'followup') {
      // L2 fill-in for the mechanic-overlap lesson. Pick the first L2
      // exercise (every full lesson has at least one). Render template with
      // blanks as <input> fields; Submit grades them server-side via the
      // existing L2-runner pattern. Keep this minimal — full L2 surface
      // lives on the lesson's L2 tab; the phone-screen card is intentionally
      // a one-shot follow-up.
      const l2 = content.L2.exercises[0];
      const blanksHtml = l2.blanks.map((_, i) =>
        `<input type="text" class="phone-l2-blank mono" data-phone-l2-blank="${i}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">`
      ).join('  ');
      renderShellChrome(`
        <div class="phone-card-instructions">Follow-up L2 (shares a mechanic with the previous lesson) — fill the blanks from memory.</div>
        <div class="phone-prompt-block">
          <div class="phone-prompt-label">Prompt</div>
          <div class="phone-prompt-text">${escapeHtml(l2.prompt)}</div>
        </div>
        <pre class="phone-l2-template cm-s-dracula" data-phone-l2-template></pre>
        <div class="phone-l2-blanks">${blanksHtml}</div>
        <div class="phone-card-actions">
          <button class="primary" data-action="phone-submit-l2">Submit</button>
          <button class="secondary" data-action="phone-skip-l2">Skip → finish</button>
          <span class="phone-feedback" data-phone-feedback></span>
        </div>
      `);
      const tplEl = shell.querySelector('[data-phone-l2-template]');
      if (tplEl && typeof colorizeInto === 'function') colorizeInto(tplEl, l2.template);
      else if (tplEl) tplEl.textContent = l2.template;
      const fb = shell.querySelector('[data-phone-feedback]');
      shell.querySelector('[data-action="phone-submit-l2"]').addEventListener('click', () => {
        const inputs = shell.querySelectorAll('[data-phone-l2-blank]');
        let allCorrect = true;
        inputs.forEach((inp, i) => {
          const expected = l2.blanks[i].answer || '';
          if (inp.value.trim() === expected.trim()) {
            inp.classList.add('phone-l2-blank-correct');
            inp.classList.remove('phone-l2-blank-wrong');
          } else {
            inp.classList.add('phone-l2-blank-wrong');
            inp.classList.remove('phone-l2-blank-correct');
            allCorrect = false;
          }
        });
        if (allCorrect) {
          fb.textContent = '✓ All blanks correct — finishing';
          fb.className = 'phone-feedback phone-feedback-pass';
          outcomes.push({ kind: 'followup', lessonId: card.lessonId, passed: true });
          setTimeout(() => { idx++; renderCard(); }, 700);
        } else {
          fb.textContent = '✗ One or more blanks wrong (red borders). Retry or Skip.';
          fb.className = 'phone-feedback phone-feedback-warn';
        }
      });
      shell.querySelector('[data-action="phone-skip-l2"]').addEventListener('click', () => {
        outcomes.push({ kind: 'followup', lessonId: card.lessonId, passed: false });
        idx++;
        renderCard();
      });
    }
  }
  function renderSummary() {
    stopTimerTick();
    const totalMs = Date.now() - sessionStartMs;
    const passedCount = outcomes.filter(o => o.passed).length;
    state.phoneScreen.completions++;
    saveProgress();
    shell.innerHTML = `
      <div class="recognize-shell phone-screen-shell">
        <div class="recognize-header"><span>📞 Phone Screen · Done · ${formatTime(totalMs)}</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${passedCount} / 3</div>
          <div class="recognize-summary-line">${passedCount} of 3 cards passed in ${formatTime(totalMs)} total time</div>
          <ul class="phone-summary-list">
            ${outcomes.map((o, i) => `<li class="phone-summary-row"><span class="phone-summary-kind">${o.kind}</span> · <span class="${o.passed ? 'phone-summary-pass' : 'phone-summary-fail'}">${o.passed ? '✓' : '✗'}</span> · <span class="phone-summary-lesson">${escapeHtml(deck[i].title)}</span></li>`).join('')}
          </ul>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.phoneScreen.completions} completed sessions of ${state.phoneScreen.sessions} started</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="phone-again">📞 Another session</button>
            <button class="secondary" data-action="phone-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="phone-again"]').addEventListener('click', () => startPhoneScreenSession());
    shell.querySelector('[data-action="phone-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 148: 🚧 Constraint-Shift Drill — Cat 9 §9C Adaptation/transfer + Cat 4
// sidecar registry hybrid. First §9C ship ever; 5th sidecar registry after
// iter-79 complexity-claims / iter-86-87 idiom-pairs / iter-117 clarify-
// distractor-bank / iter-118 hotseat-followups. Each card shows a real
// canonical with its ORIGINAL constraint claim and prompts the user to
// rewrite it to satisfy a SHIFTED constraint. Grade = runCode (output
// matches expectedOutput) PLUS the per-entry structural-fingerprint regex
// (must NOT match in the user's submission for the shift to count — the
// regex catches the canonical's antipattern, e.g. "new Map()" for the
// "O(1) extra space" shift). Trains the senior-interview pivot follow-up
// ("now do it without extra space" / "now do it in-place").
let CONSTRAINT_SHIFTS_BANK = null;
async function _loadConstraintShiftsBank() {
  if (CONSTRAINT_SHIFTS_BANK) return CONSTRAINT_SHIFTS_BANK;
  try {
    const res = await fetch('data/constraint-shifts.json');
    if (!res.ok) return null;
    const j = await res.json();
    CONSTRAINT_SHIFTS_BANK = Array.isArray(j.shifts) ? j.shifts : [];
    return CONSTRAINT_SHIFTS_BANK;
  } catch (_) { return null; }
}

async function _constraintShiftBuildDeck() {
  const bank = await _loadConstraintShiftsBank();
  if (!bank || !bank.length) return null;
  // Ensure every entry's lesson content is loaded so we can show canonical.
  for (const e of bank) {
    if (!CONTENT[e.lessonId]) {
      try { await loadLessonContent(e.lessonId); } catch (_) { /* skip */ }
    }
  }
  // Filter to entries whose lesson + canonical are actually available.
  const usable = bank.filter(e => CONTENT[e.lessonId] && CONTENT[e.lessonId].L3 && CONTENT[e.lessonId].L3.canonical);
  if (!usable.length) return null;
  // Shuffle (reuse iter-73 _bugHuntShuffle) + take all (v1 ships 2 entries; full deck per session).
  const shuffled = _bugHuntShuffle(usable);
  return shuffled.map(e => {
    const c = CONTENT[e.lessonId];
    const lesson = CURRICULUM.find(l => l.id === e.lessonId);
    return {
      lessonId: e.lessonId,
      lessonTitle: lesson ? lesson.title : e.lessonId,
      sectionName: lesson ? lesson.section : '',
      canonical: c.L3.canonical,
      expectedOutput: c.L3.expectedOutput,
      originalClaim: e.originalClaim,
      shiftedClaim: e.shiftedClaim,
      hint: e.hint || '',
      structuralCheck: e.structuralCheck,
      structuralCheckExplain: e.structuralCheckExplain || ''
    };
  });
}

async function startConstraintShiftSession() {
  const deck = await _constraintShiftBuildDeck();
  if (!deck || deck.length < 1) {
    alert('Constraint-Shift sidecar is empty or failed to load. Try again after the lesson content is cached.');
    return;
  }
  state.constraintShift.sessions++;
  state.constraintShift.lastRunAt = Date.now();
  saveProgress();
  let idx = 0, correct = 0;
  const shell = document.getElementById('lesson-shell');
  function renderCard() {
    if (idx >= deck.length) return renderSummary();
    const card = deck[idx];
    shell.innerHTML = `
      <div class="recognize-shell shift-shell">
        <div class="recognize-header">
          <span>🚧 Constraint-Shift · ${idx + 1} of ${deck.length}</span>
          <button class="recognize-exit" data-action="exit-shift">✕ Exit</button>
        </div>
        <div class="whatif-lesson-tag">${escapeHtml(card.lessonTitle)} · ${escapeHtml(card.sectionName)}</div>
        <div class="shift-claims-block">
          <div class="shift-claim-row">
            <span class="shift-claim-label shift-claim-orig">Original</span>
            <span class="shift-claim-text">${escapeHtml(card.originalClaim)}</span>
          </div>
          <div class="shift-claim-row">
            <span class="shift-claim-label shift-claim-shift">Shift to</span>
            <span class="shift-claim-text shift-claim-shift-text">${escapeHtml(card.shiftedClaim)}</span>
          </div>
        </div>
        <div class="shift-canonical-label">Canonical (the original-constraint solution — read it, then rewrite below):</div>
        <pre class="whatif-canonical cm-s-dracula" data-shift-canonical></pre>
        <div class="shift-hint">${escapeHtml(card.hint)}</div>
        <textarea class="shift-editor" data-shift-editor></textarea>
        <div class="shift-actions">
          <button class="primary" data-action="shift-run">Run + check</button>
          <button class="secondary" data-action="shift-skip">Skip → next</button>
          <span class="shift-feedback" data-shift-feedback></span>
        </div>
      </div>
    `;
    const codeEl = shell.querySelector('[data-shift-canonical]');
    if (codeEl && typeof colorizeInto === 'function') colorizeInto(codeEl, card.canonical);
    else if (codeEl) codeEl.textContent = card.canonical;
    const ta = shell.querySelector('[data-shift-editor]');
    const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const cm = CodeMirror.fromTextArea(ta, {
      mode: 'javascript', theme: 'dracula', lineNumbers: true,
      autoCloseBrackets: true, matchBrackets: true, indentUnit: 2, tabSize: 2,
      lineWrapping: true, viewportMargin: Infinity,
      inputStyle: isTouchDevice ? 'contenteditable' : 'textarea',
      spellcheck: false, autocorrect: false, autocapitalize: false
    });
    const fb = shell.querySelector('[data-shift-feedback]');
    shell.querySelector('[data-action="exit-shift"]').addEventListener('click', () => renderLesson());
    shell.querySelector('[data-action="shift-skip"]').addEventListener('click', () => {
      state.constraintShift.attempts++;
      state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
      appendHistory(card.lessonId, 'L1-miss');
      saveProgress();
      idx++;
      renderCard();
    });
    shell.querySelector('[data-action="shift-run"]').addEventListener('click', async () => {
      const userCode = cm.getValue();
      if (!userCode.trim()) {
        fb.textContent = '✗ Editor empty — type your shifted solution first.';
        fb.className = 'shift-feedback shift-feedback-warn';
        return;
      }
      fb.textContent = 'Running…';
      fb.className = 'shift-feedback';
      const res = await runCode(userCode);
      // Two-part grade: output must match AND structural regex must NOT match.
      const outputMatches = res.ok && (res.output || '') === card.expectedOutput;
      let regexCatchesAntipattern = false;
      try {
        const re = new RegExp(card.structuralCheck);
        regexCatchesAntipattern = re.test(userCode);
      } catch (_) { /* malformed regex in sidecar — treat as no-catch */ }
      state.constraintShift.attempts++;
      if (!res.ok) {
        fb.innerHTML = `✗ Runtime error: ${escapeHtml((res.output || 'unknown').slice(0, 80))}`;
        fb.className = 'shift-feedback shift-feedback-err';
        state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
        appendHistory(card.lessonId, 'L1-miss');
      } else if (!outputMatches) {
        const got = (res.output || '(empty)').slice(0, 60);
        fb.innerHTML = `✗ Output: <span class="mono">${escapeHtml(got)}</span> (expected <span class="mono">${escapeHtml(card.expectedOutput.slice(0, 40))}</span>)`;
        fb.className = 'shift-feedback shift-feedback-warn';
        state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
        appendHistory(card.lessonId, 'L1-miss');
      } else if (regexCatchesAntipattern) {
        fb.innerHTML = `✗ Output correct but you still used the original-constraint technique. ${escapeHtml(card.structuralCheckExplain)}`;
        fb.className = 'shift-feedback shift-feedback-warn';
        state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1;
        appendHistory(card.lessonId, 'L1-miss');
      } else {
        correct++;
        state.constraintShift.correct++;
        fb.textContent = '✓ Output matches AND structural check passes — constraint shift complete.';
        fb.className = 'shift-feedback shift-feedback-pass';
      }
      saveProgress();
      // Add Next button to the actions row so user can advance.
      const actions = shell.querySelector('.shift-actions');
      if (actions && !actions.querySelector('[data-action="shift-next"]')) {
        const next = document.createElement('button');
        next.className = 'primary';
        next.dataset.action = 'shift-next';
        next.textContent = 'Next card →';
        next.addEventListener('click', () => { idx++; renderCard(); });
        actions.appendChild(next);
      }
    });
  }
  function renderSummary() {
    const pct = Math.round((correct / deck.length) * 100);
    shell.innerHTML = `
      <div class="recognize-shell shift-shell">
        <div class="recognize-header"><span>🚧 Constraint-Shift · Session done</span></div>
        <div class="recognize-summary">
          <div class="recognize-summary-pct">${pct}%</div>
          <div class="recognize-summary-line">${correct} of ${deck.length} shifts completed cleanly</div>
          <div class="recognize-summary-line recognize-summary-lifetime">Lifetime: ${state.constraintShift.correct} / ${state.constraintShift.attempts} (${state.constraintShift.attempts > 0 ? Math.round(state.constraintShift.correct / state.constraintShift.attempts * 100) : 0}%)</div>
          <div class="recognize-summary-actions">
            <button class="primary" data-action="shift-again">🚧 Another session</button>
            <button class="secondary" data-action="shift-done">Done</button>
          </div>
        </div>
      </div>
    `;
    shell.querySelector('[data-action="shift-again"]').addEventListener('click', () => startConstraintShiftSession());
    shell.querySelector('[data-action="shift-done"]').addEventListener('click', () => renderLesson());
  }
  renderCard();
}

// iter 47: per-section retention aggregation for the Stats modal. Walks every
// lesson's state.history events, bins by day across lookbackDays, returns
// sorted rows (worst retention first → drives "what needs attention" UX).
// Sections with zero activity in window are excluded. See ideas-by-category.md
// § Metacognition & Visibility → Section-level retention sparkline.
