//  REFERENCE TAB
// ──────────────────────────────────────────────────────────────────────────
// Static-syntax-highlighter — reuses CodeMirror's JS tokenizer + Dracula
// theme. Appends colored <span class="cm-…"> nodes into `target`, which must
// sit under a `.cm-s-dracula` ancestor for the colors to apply.
// ──────────────────────────────────────────────────────────────────────────
//  CONVERSATION TAB — interview walk-through for Patterns/Applied lessons
// ──────────────────────────────────────────────────────────────────────────
// Each section is collapsed by default. The title + prompt stay visible
// (skim-able on mobile), and tapping expands the body. Uses native <details>
// so there's no JS state to manage and accessibility / keyboard nav is free.
//
// Prose enrichment — `enrichConvText` is applied to all conv body text (say,
// why, intro). Two layers:
//   1. Always: convert backtick `code` spans → styled <code class="conv-code">.
//      Authoring convention across all 99+ existing conversations puts code
//      tokens (`nums`, `target`, `O(1)`) in backticks; this renders them as
//      inline code instead of leaking literal backticks into the UI.
//   2. ADHD Mode (when state.adhdMode): bionic word-heads — wrap the leading
//      letters of each 2+ letter word in <b class="adhd-fix">. Splits on code
//      blocks and HTML tags so we don't bionicize inside <code> or break
//      <br> tags. HTML entities (&lt; etc.) are skipped by the word regex.
//      The marker-highlight effect on .conv-code is CSS-only (driven by the
//      body.adhd-mode class) — render-time output is identical for the code
//      spans regardless of toggle, so toggling marker doesn't require a
//      re-render; bionic markup IS render-gated.
function _bionicizeConvSegment(seg) {
  // Length-scaled prefix bold: short words get 1, medium 2, long ~40%.
  // Matches HTML entities and skips them so &lt; etc. pass through intact.
  return seg.replace(/&[a-zA-Z]+;|&#\d+;|[A-Za-zÀ-ÿ]{2,}/g, m => {
    if (m[0] === '&') return m;
    const L = m.length;
    const n = L <= 3 ? 1 : L <= 7 ? Math.ceil(L * 0.5) : Math.ceil(L * 0.4);
    return '<b class="adhd-fix">' + m.slice(0, n) + '</b>' + m.slice(n);
  });
}
function enrichConvText(escaped) {
  // Step 1: backtick spans → <code> (always-on baseline).
  let html = escaped.replace(/`([^`]+)`/g, '<code class="conv-code">$1</code>');
  // Step 2: bionic word-heads (ADHD only). Split keeps <code>…</code> blocks
  // AND single tags (e.g. <br>) on odd indices so they pass through untouched.
  if (typeof state !== 'undefined' && state.adhdMode) {
    html = html.split(/(<code[^>]*>[\s\S]*?<\/code>|<[^>]+>)/)
      .map((seg, i) => i % 2 === 1 ? seg : _bionicizeConvSegment(seg))
      .join('');
  }
  return html;
}
function renderConversation(body, content) {
  const conv = content.conversation;
  const section = document.createElement('div');
  const intro = conv.intro
    ? `<div class="conv-intro">${enrichConvText(escapeHtml(conv.intro))}</div>`
    : '';
  // Multi-paragraph text → escaped <p> blocks. No markdown rendering — keep
  // authoring constraints simple (just \n\n for paragraph breaks, single \n
  // for soft breaks). enrichConvText layers in code spans + (when ADHD Mode
  // is on) bionic word-heads.
  const paragraphsOf = (text) => (text || '')
    .split(/\n\s*\n/)
    .map(p => `<p>${enrichConvText(escapeHtml(p).replace(/\n/g, '<br>'))}</p>`)
    .join('');
  const sectionsHtml = conv.sections.map((s) => {
    const promptHtml = s.prompt
      ? `<div class="conv-prompt">${escapeHtml(s.prompt)}</div>`
      : '';
    // Two-color body: SAY (what you'd verbalize — script voice) and WHY
    // (rationale / what it signals to the interviewer — meta voice).
    // Either field is optional; legacy `reveal` is still supported as a
    // single unified block so older content doesn't break.
    // `examples` is an optional structured trace surface — when present,
    // each entry renders as a nested <details> with input → output header
    // and a pre-formatted monospace trace body.
    const blocks = [];
    if (s.intro) {
      blocks.push(`<div class="conv-intro-inline">${paragraphsOf(s.intro)}</div>`);
    }
    if (s.say) {
      blocks.push(`<div class="conv-block conv-say">
        <div class="conv-block-label">What I'd say</div>
        <div class="conv-block-body">${paragraphsOf(s.say)}</div>
      </div>`);
    }
    if (Array.isArray(s.examples) && s.examples.length) {
      const exHtml = s.examples.map((ex) => {
        const header = `${escapeHtml(ex.input || '')}${ex.output != null ? ` <span class="conv-ex-arrow">→</span> <span class="conv-ex-out">${escapeHtml(String(ex.output))}</span>` : ''}`;
        const noteHtml = ex.note ? `<div class="conv-ex-note">${escapeHtml(ex.note)}</div>` : '';
        const traceHtml = ex.trace ? `<pre class="conv-ex-trace">${escapeHtml(ex.trace)}</pre>` : '';
        return `<details class="conv-example">
          <summary class="conv-ex-summary">
            <span class="conv-ex-header">${header}</span>
            <span class="conv-toggle" aria-hidden="true">▸</span>
          </summary>
          <div class="conv-ex-body">${noteHtml}${traceHtml}</div>
        </details>`;
      }).join('');
      blocks.push(`<div class="conv-block conv-examples-block">
        <div class="conv-block-label">Worked examples</div>
        <div class="conv-examples-list">${exHtml}</div>
      </div>`);
    }
    if (s.why) {
      blocks.push(`<div class="conv-block conv-why">
        <div class="conv-block-label">Why this matters</div>
        <div class="conv-block-body">${paragraphsOf(s.why)}</div>
      </div>`);
    }
    if (!s.say && !s.why && !s.examples && s.reveal) {
      blocks.push(`<div class="conv-block conv-legacy"><div class="conv-block-body">${paragraphsOf(s.reveal)}</div></div>`);
    }
    return `
      <details class="conv-section">
        <summary class="conv-summary">
          <span class="conv-title">${escapeHtml(s.title)}</span>
          ${promptHtml}
          <span class="conv-toggle" aria-hidden="true">▸</span>
        </summary>
        <div class="conv-body">${blocks.join('')}</div>
      </details>`;
  }).join('');
  section.innerHTML = `
    <div class="mb-2 text-xs text-slate-500 uppercase tracking-wider">Interview walk-through</div>
    ${intro}
    <div class="conv-list">${sectionsHtml}</div>
    <div class="mt-8 flex justify-end gap-2">
      <button class="secondary" data-action="conv-to-reference">See the solution →</button>
    </div>
  `;
  body.appendChild(section);
  section.querySelector('[data-action="conv-to-reference"]').addEventListener('click', () => selectTab('reference'));
}

// ──────────────────────────────────────────────────────────────────────────
//  WALKTHROUGH TAB — interactive line-by-line stepper (Jupyter-style)
// ──────────────────────────────────────────────────────────────────────────
// The lesson's `walkthrough` block defines (a) a list of example inputs and
// (b) a trace function (stored as a string of JS source — an array of lines
// joined with \n at load) that yields {line, label, state} per step. We
// `new Function`-evaluate the source, drain the generator into an array per
// example, cache it, and render: canonical code with current line highlighted
// + a state panel + prev/next/reset controls.
//
// Eval safety: lesson JSON is same-origin trusted content; we already eval
// user-typed L3 code via `new Function`. The trace function has no DOM
// access and runs purely on its `input` argument.

// Cache compiled trace functions + per-example step arrays across renders
// so re-clicking the tab doesn't re-evaluate source. Keyed by lesson id.
const _walkthroughCache = {};

function _compileWalkthrough(lessonId, walkthrough) {
  if (_walkthroughCache[lessonId]) return _walkthroughCache[lessonId];
  const src = Array.isArray(walkthrough.trace)
    ? walkthrough.trace.join('\n')
    : String(walkthrough.trace || '');
  let fn;
  try {
    fn = new Function('input', '"use strict";\n' + src + '\nreturn trace(input);');
  } catch (e) {
    return _walkthroughCache[lessonId] = { error: 'Failed to compile trace: ' + e.message };
  }
  const byExample = walkthrough.examples.map(ex => {
    try {
      const steps = [...fn(ex.input)];
      return { example: ex, steps, error: null };
    } catch (e) {
      return { example: ex, steps: [], error: 'Trace runtime error: ' + e.message };
    }
  });
  return _walkthroughCache[lessonId] = { byExample, error: null };
}

// Format a state value for the panel. Sets→[…], arrays→JSON, primitives→String.
function _formatStateVal(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return '[' + v.map(_formatStateVal).join(', ') + ']';
  if (v && typeof v === 'object') {
    try { return JSON.stringify(v); } catch (_) { return String(v); }
  }
  return String(v);
}

// Quiz-mode helper — picks a midpoint K and assembles 4 unique MC options
// from adjacent trace steps. Distractor priorities: no-advance (steps[K]),
// skip-one (steps[K+2]), regression (steps[K-1]), final, initial. Returns
// null if the trace is too short or too uniform for a meaningful quiz.
// See ideas-by-category.md § Drilling Surfaces → "What comes next?" entry.
function _pickQuizOptions(steps) {
  if (steps.length < 4) return null;
  const K = Math.max(1, Math.floor(steps.length / 2));
  const correctIdx = K + 1;
  if (correctIdx >= steps.length) return null;
  const correct = steps[correctIdx];
  const candidatePool = [
    { idx: K },
    { idx: K + 2 },
    { idx: K - 1 },
    { idx: steps.length - 1 },
    { idx: 0 },
    { idx: K + 3 },
    { idx: Math.max(0, K - 2) }
  ];
  const stepKey = s => JSON.stringify({ line: s.line, label: s.label, state: s.state });
  const seen = new Set([stepKey(correct)]);
  const distractors = [];
  for (const c of candidatePool) {
    if (c.idx === correctIdx || c.idx < 0 || c.idx >= steps.length) continue;
    const k = stepKey(steps[c.idx]);
    if (seen.has(k)) continue;
    seen.add(k);
    distractors.push({ step: steps[c.idx], idx: c.idx });
    if (distractors.length === 3) break;
  }
  if (distractors.length < 3) return null;
  const options = [
    { step: correct, idx: correctIdx, isCorrect: true },
    ...distractors.map(d => ({ step: d.step, idx: d.idx, isCorrect: false }))
  ];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { K, correctIdx, options };
}

function renderWalkthrough(body, lesson, content) {
  const w = content.walkthrough;
  const compiled = _compileWalkthrough(lesson.id, w);
  if (compiled.error) {
    body.innerHTML = `<div class="p-6 text-red-300 text-sm">${escapeHtml(compiled.error)}</div>`;
    return;
  }

  // Per-session UI state for this tab — example index + step index.
  // Kept on the global state cache so switching tabs and coming back
  // restores where you were (consistent with the L1/L2/L3 cache pattern).
  let uiState = _cacheGet(lesson.id, 'walkthrough');
  if (!uiState || typeof uiState.exampleIdx !== 'number') {
    uiState = { exampleIdx: 0, stepIdx: 0 };
    _cacheSet(lesson.id, 'walkthrough', uiState);
  }

  // Build static shell once
  const codeLines = (content.reference && content.reference.code || '').split('\n');
  const introHtml = w.intro ? `<div class="walk-intro">${escapeHtml(w.intro)}</div>` : '';
  const exOptions = w.examples.map((ex, i) =>
    `<option value="${i}" ${i === uiState.exampleIdx ? 'selected' : ''}>${escapeHtml(ex.label)}</option>`
  ).join('');

  body.innerHTML = `
    <div class="mb-2 text-xs text-slate-500 uppercase tracking-wider">Interactive walkthrough</div>
    ${introHtml}
    <div class="walk-controls">
      <label class="walk-example-label">Example
        <select class="walk-example" data-walk-example>${exOptions}</select>
      </label>
      <div class="walk-step-controls">
        <button class="walk-btn" data-walk-prev aria-label="Previous step">◀ Prev</button>
        <span class="walk-step-counter" data-walk-counter>Step 1 of N</span>
        <button class="walk-btn walk-btn-primary" data-walk-next aria-label="Next step">Next ▶</button>
        <button class="walk-btn walk-btn-ghost" data-walk-reset>Reset</button>
        <button class="walk-btn walk-btn-ghost" data-walk-quiz title="Predict the next step (active-recall mode)">🔮 Quiz</button>
        <button class="walk-btn walk-btn-ghost" data-walk-bug title="One step's state is wrong — find the bug (debug-direction drill)">🪲 Bug</button>
      </div>
    </div>
    <div class="walk-label-bar" data-walk-label>—</div>
    <div class="walk-grid">
      <div class="walk-code-pane">
        <pre class="walk-code cm-s-dracula" data-walk-code></pre>
      </div>
      <div class="walk-state-pane">
        <div class="walk-state-header">State after this step</div>
        <div class="walk-state-table" data-walk-state></div>
      </div>
    </div>
    <div class="walk-quiz hidden" data-walk-quiz-panel>
      <div class="walk-quiz-q">What's the next step?</div>
      <div class="walk-quiz-opts" data-walk-quiz-opts></div>
      <div class="walk-quiz-actions">
        <button class="walk-btn walk-btn-ghost" data-walk-quiz-close>✕ Close quiz</button>
      </div>
    </div>
    <div class="walk-bug hidden" data-walk-bug-panel>
      <div class="walk-bug-q">One step's state is corrupted. Tap the buggy step.</div>
      <div class="walk-bug-list" data-walk-bug-list></div>
      <div class="walk-bug-actions">
        <button class="walk-btn walk-btn-ghost" data-walk-bug-close>✕ Close bug-hunt</button>
      </div>
    </div>
  `;

  const codeEl = body.querySelector('[data-walk-code]');
  const stateEl = body.querySelector('[data-walk-state]');
  const labelEl = body.querySelector('[data-walk-label]');
  const counterEl = body.querySelector('[data-walk-counter]');
  const prevBtn = body.querySelector('[data-walk-prev]');
  const nextBtn = body.querySelector('[data-walk-next]');
  const resetBtn = body.querySelector('[data-walk-reset]');
  const quizBtn = body.querySelector('[data-walk-quiz]');
  const quizPanel = body.querySelector('[data-walk-quiz-panel]');
  const quizOptsEl = body.querySelector('[data-walk-quiz-opts]');
  const quizCloseBtn = body.querySelector('[data-walk-quiz-close]');
  const bugBtn = body.querySelector('[data-walk-bug]');
  const bugPanel = body.querySelector('[data-walk-bug-panel]');
  const bugListEl = body.querySelector('[data-walk-bug-list]');
  const bugCloseBtn = body.querySelector('[data-walk-bug-close]');
  const exampleSelect = body.querySelector('[data-walk-example]');
  let quizActive = false;
  let bugActive = false;

  // Render the code block once with line wrappers — highlight on update.
  // Each line gets a row wrapper with a line-number gutter and a syntax-
  // highlighted body. Re-uses CodeMirror's runMode for tokenization.
  codeLines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const row = document.createElement('div');
    row.className = 'walk-line';
    row.dataset.lineNo = lineNum;
    const gutter = document.createElement('span');
    gutter.className = 'walk-line-no';
    gutter.textContent = String(lineNum);
    const codeSpan = document.createElement('span');
    codeSpan.className = 'walk-line-code';
    if (window.CodeMirror && CodeMirror.runMode) {
      CodeMirror.runMode(line || ' ', 'javascript', codeSpan);
    } else {
      codeSpan.textContent = line || ' ';
    }
    row.appendChild(gutter);
    row.appendChild(codeSpan);
    codeEl.appendChild(row);
  });

  function currentSteps() {
    return compiled.byExample[uiState.exampleIdx]?.steps || [];
  }

  function render() {
    const steps = currentSteps();
    if (steps.length === 0) {
      labelEl.textContent = 'No steps for this example.';
      counterEl.textContent = 'Step 0 of 0';
      stateEl.innerHTML = '';
      return;
    }
    // Clamp stepIdx into range (e.g. switching to a shorter example)
    if (uiState.stepIdx >= steps.length) uiState.stepIdx = steps.length - 1;
    if (uiState.stepIdx < 0) uiState.stepIdx = 0;
    const step = steps[uiState.stepIdx];
    counterEl.textContent = `Step ${uiState.stepIdx + 1} of ${steps.length}`;
    labelEl.textContent = step.label || '';
    // Highlight current line
    codeEl.querySelectorAll('.walk-line.active').forEach(el => el.classList.remove('active'));
    const target = codeEl.querySelector(`.walk-line[data-line-no="${step.line}"]`);
    if (target) {
      target.classList.add('active');
      // Scroll into view inside the code pane (only the pane scrolls, not the page)
      target.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
    // Render state panel
    const entries = step.state ? Object.entries(step.state) : [];
    stateEl.innerHTML = entries.length === 0
      ? '<div class="walk-state-empty">— no state at this step —</div>'
      : entries.map(([k, v]) =>
          `<div class="walk-state-row"><span class="walk-state-key">${escapeHtml(k)}</span><span class="walk-state-val">${escapeHtml(_formatStateVal(v))}</span></div>`
        ).join('');
    // Disable prev/next at boundaries OR when quiz/bug is active.
    prevBtn.disabled = quizActive || bugActive || uiState.stepIdx === 0;
    nextBtn.disabled = quizActive || bugActive || uiState.stepIdx >= steps.length - 1;
    resetBtn.disabled = quizActive || bugActive;
    exampleSelect.disabled = quizActive || bugActive;
  }

  function exitQuiz() {
    quizActive = false;
    quizPanel.classList.add('hidden');
    quizOptsEl.innerHTML = '';
    quizBtn.classList.remove('active');
    quizBtn.textContent = '🔮 Quiz';
    render();
  }

  function startQuiz() {
    const steps = currentSteps();
    const quiz = _pickQuizOptions(steps);
    if (!quiz) {
      quizBtn.disabled = true;
      quizBtn.title = 'Trace too short for a quiz (need ≥4 steps)';
      return;
    }
    quizActive = true;
    uiState.stepIdx = quiz.K;  // show step K; ask "what's next?"
    render();
    quizPanel.classList.remove('hidden');
    quizBtn.classList.add('active');
    quizBtn.textContent = '🔮 Quiz on';
    quizOptsEl.innerHTML = '';
    let picked = false;
    quiz.options.forEach(opt => {
      const card = document.createElement('button');
      card.className = 'walk-quiz-opt';
      const stateSnippet = opt.step.state
        ? Object.entries(opt.step.state).slice(0, 2)
            .map(([k, v]) => `${escapeHtml(k)}=${escapeHtml(_formatStateVal(v))}`).join(', ')
        : '';
      card.innerHTML = `
        <div class="walk-quiz-opt-line">Line ${opt.step.line}</div>
        <div class="walk-quiz-opt-label">${escapeHtml(opt.step.label || '—')}</div>
        ${stateSnippet ? `<div class="walk-quiz-opt-state">${stateSnippet}</div>` : ''}
      `;
      card.addEventListener('click', () => {
        if (picked) return;
        picked = true;
        card.classList.add(opt.isCorrect ? 'correct' : 'incorrect');
        // Persist Quiz outcome to state.walkthrough[lessonId]. Misses
        // also flag state.weakness so Today's Plan / At-Risk surface
        // the lesson — closes the loop the surface previously left open
        // (per audits/walkthrough.md edit 1).
        const wt = state.walkthrough[lesson.id] || { quizAttempts: 0, quizCorrect: 0, bugAttempts: 0, bugCorrect: 0, lastRunAt: 0 };
        wt.quizAttempts++;
        if (opt.isCorrect) wt.quizCorrect++;
        else {
          state.weakness[lesson.id] = (state.weakness[lesson.id] || 0) + 1;
          appendHistory(lesson.id, 'walkthrough-quiz-miss');
        }
        wt.lastRunAt = Date.now();
        state.walkthrough[lesson.id] = wt;
        saveProgress();
        // Always reveal the correct one too
        if (!opt.isCorrect) {
          [...quizOptsEl.children].forEach((el, i) => {
            if (quiz.options[i].isCorrect) el.classList.add('correct');
          });
        }
        // Disable all option cards
        [...quizOptsEl.children].forEach(el => el.classList.add('locked'));
      });
      quizOptsEl.appendChild(card);
    });
  }

  prevBtn.addEventListener('click', () => {
    if (uiState.stepIdx > 0) { uiState.stepIdx--; render(); }
  });
  nextBtn.addEventListener('click', () => {
    const steps = currentSteps();
    if (uiState.stepIdx < steps.length - 1) {
      uiState.stepIdx++;
      render();
      // Once the user reaches the final step at least once, flag the
      // lesson as "scrubbed" so the next entry to the tab auto-opens
      // the 🔮 Quiz (per audits/walkthrough.md edit 2 — recall becomes
      // default, not opt-in).
      if (uiState.stepIdx === steps.length - 1) {
        const wt = state.walkthrough[lesson.id] || { quizAttempts: 0, quizCorrect: 0, bugAttempts: 0, bugCorrect: 0, lastRunAt: 0 };
        if (!wt.scrubbed) {
          wt.scrubbed = true;
          wt.lastRunAt = Date.now();
          state.walkthrough[lesson.id] = wt;
          saveProgress();
        }
      }
    }
  });
  resetBtn.addEventListener('click', () => {
    uiState.stepIdx = 0;
    render();
  });
  quizBtn.addEventListener('click', () => {
    if (quizActive) exitQuiz();
    else startQuiz();
  });
  quizCloseBtn.addEventListener('click', exitQuiz);

  // iter 78: 🪲 Bug-Hunt mode — invert the trace from "watch correct" →
  // "find the corrupted step". Picks a random step, mutates one state-field
  // value (numbers ±1, booleans flipped, strings/arrays first-char swapped),
  // renders the full step list as tappable rows. User picks the buggy row.
  // Reuses the .walk-quiz-* styling family with .walk-bug-* overrides.
  function _bugMutateValue(v) {
    if (typeof v === 'number') return { val: v + (v >= 0 ? 1 : -1), kind: 'num±1' };
    if (typeof v === 'boolean') return { val: !v, kind: 'bool-flip' };
    if (typeof v === 'string' && v.length >= 2) {
      return { val: v[1] + v[0] + v.slice(2), kind: 'str-swap' };
    }
    if (Array.isArray(v) && v.length >= 2) {
      const out = v.slice(); [out[0], out[1]] = [out[1], out[0]];
      return { val: out, kind: 'arr-swap' };
    }
    if (typeof v === 'string' && v.length === 1) {
      // Single char: flip case / increment by 1
      const c = v.charCodeAt(0);
      return { val: String.fromCharCode(c + 1), kind: 'char+1' };
    }
    return null; // unmutatable
  }
  function _pickBugMutation(steps) {
    // Need ≥3 steps so the buggy row is non-trivial to spot.
    if (!steps || steps.length < 3) return null;
    // Try random (step, key) pairs until one yields a mutable value.
    const order = steps.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const bugIdx of order) {
      const state = steps[bugIdx].state;
      if (!state) continue;
      const keys = Object.keys(state);
      const shuffledKeys = keys.slice();
      for (let i = shuffledKeys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledKeys[i], shuffledKeys[j]] = [shuffledKeys[j], shuffledKeys[i]];
      }
      for (const key of shuffledKeys) {
        const mut = _bugMutateValue(state[key]);
        if (!mut) continue;
        // Build a mutated steps array (deep-ish copy: only the bug step's state).
        const mutated = steps.map((s, i) =>
          i === bugIdx ? { ...s, state: { ...s.state, [key]: mut.val } } : s
        );
        return { bugIdx, key, originalVal: state[key], mutatedVal: mut.val, kind: mut.kind, mutated };
      }
    }
    return null;
  }
  function exitBugMode() {
    bugActive = false;
    bugPanel.classList.add('hidden');
    bugListEl.innerHTML = '';
    bugBtn.classList.remove('active');
    bugBtn.textContent = '🪲 Bug';
    render();
  }
  function startBugMode() {
    if (quizActive) exitQuiz();
    const steps = currentSteps();
    const bug = _pickBugMutation(steps);
    if (!bug) {
      alert('This walkthrough is too short or has no mutable state for bug-hunt.');
      return;
    }
    bugActive = true;
    bugPanel.classList.remove('hidden');
    bugBtn.classList.add('active');
    bugBtn.textContent = '🪲 Bug on';
    render(); // disables controls
    bugListEl.innerHTML = '';
    let picked = false;
    bug.mutated.forEach((step, i) => {
      const card = document.createElement('button');
      card.className = 'walk-bug-row';
      card.type = 'button';
      const stateSnippet = step.state
        ? Object.entries(step.state).slice(0, 4)
            .map(([k, v]) => `${escapeHtml(k)}=${escapeHtml(_formatStateVal(v))}`).join(', ')
        : '— no state —';
      card.innerHTML = `
        <span class="walk-bug-row-idx">${i + 1}</span>
        <span class="walk-bug-row-body">
          <span class="walk-bug-row-line">Line ${step.line} · ${escapeHtml(step.label || '—')}</span>
          <span class="walk-bug-row-state">${stateSnippet}</span>
        </span>
      `;
      card.addEventListener('click', () => {
        if (picked) return;
        picked = true;
        const wasCorrect = i === bug.bugIdx;
        card.classList.add(wasCorrect ? 'correct' : 'incorrect');
        // Persist Bug outcome to state.walkthrough[lessonId]. Misses
        // flag state.weakness (audits/walkthrough.md edit 1).
        const wt = state.walkthrough[lesson.id] || { quizAttempts: 0, quizCorrect: 0, bugAttempts: 0, bugCorrect: 0, lastRunAt: 0 };
        wt.bugAttempts++;
        if (wasCorrect) wt.bugCorrect++;
        else {
          state.weakness[lesson.id] = (state.weakness[lesson.id] || 0) + 1;
          appendHistory(lesson.id, 'walkthrough-bug-miss');
        }
        wt.lastRunAt = Date.now();
        state.walkthrough[lesson.id] = wt;
        saveProgress();
        // Always reveal the actual bug step.
        if (!wasCorrect) {
          [...bugListEl.children][bug.bugIdx]?.classList.add('correct');
        }
        // Lock all rows
        [...bugListEl.children].forEach(el => el.classList.add('locked'));
        // Append a reveal line at the bottom showing original vs mutated value.
        const reveal = document.createElement('div');
        reveal.className = 'walk-bug-reveal';
        reveal.innerHTML = `Step ${bug.bugIdx + 1} · <code>${escapeHtml(bug.key)}</code> was <code>${escapeHtml(_formatStateVal(bug.originalVal))}</code>, shown as <code>${escapeHtml(_formatStateVal(bug.mutatedVal))}</code> (<em>${escapeHtml(bug.kind)}</em>)`;
        bugListEl.appendChild(reveal);
      });
      bugListEl.appendChild(card);
    });
  }
  bugBtn.addEventListener('click', () => {
    if (bugActive) exitBugMode();
    else startBugMode();
  });
  bugCloseBtn.addEventListener('click', exitBugMode);
  exampleSelect.addEventListener('change', (e) => {
    if (quizActive) exitQuiz();
    if (bugActive) exitBugMode();
    uiState.exampleIdx = Number(e.target.value);
    uiState.stepIdx = 0;
    render();
  });

  // Initial paint
  render();

  // Default-open 🔮 Quiz when the user has already scrubbed this
  // walkthrough to the end at least once (per audits/walkthrough.md
  // edit 2 — recall becomes the default surface, not opt-in). Only
  // triggers when the trace is long enough for a quiz (≥4 steps);
  // _pickQuizOptions returns null otherwise and startQuiz exits cleanly.
  const wt = state.walkthrough && state.walkthrough[lesson.id];
  if (wt && wt.scrubbed && !quizActive && !bugActive) {
    startQuiz();
  }
}

function renderReference(body, content) {
  const ref = content.reference;
  const section = document.createElement('div');
  section.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <div class="text-xs text-slate-500 uppercase tracking-wider">The thing to memorize</div>
      <div class="flex items-center gap-2">
        <button class="flash-toggle text-xs px-2 py-1 rounded bg-slate-800 text-slate-400" data-action="flash-toggle" title="Hide random tokens, tap each to reveal">🃏 Flash</button>
        <button class="cinema-toggle text-xs px-2 py-1 rounded bg-slate-800 text-slate-400" data-action="cinema-toggle" title="Read+predict-then-verify — every line starts blurred, tap each to reveal in order">🎬 Cinema</button>
        <button class="bullets-toggle text-xs px-2 py-1 rounded bg-slate-800 text-slate-400" data-action="bullets-toggle" title="Hide canonical, type it from the notes below. Desk-tier 'see concept, recall code' recall direction the L1→L2→L3 ladder doesn't drill (L2 = template + blanks given; L3 = problem prompt only; Bullets→Code = notes-as-prompt, full code recall).">📝 Notes→Code</button>
      </div>
    </div>
    <pre class="code-block cm-s-dracula" data-ref-code></pre>
    <!-- Iter 13: inline autopilot CTA right after the canonical so the user
         can transition to drilling without scrolling past mechanics + notes
         (PROFILE.md line 27 ~80% phone; line 76-78 "press one thing → drilling").
         Bottom Start-drills primary stays untouched for the patient-reader path;
         this is the second anchor for the same action. -->
    <div class="mt-3 flex items-center justify-end gap-2 text-xs">
      <span class="text-slate-500">Memorized? </span>
      <button class="secondary px-3 py-1" data-action="start-l1" style="font-size:12px;padding:4px 12px;">🎯 Drill from blank →</button>
    </div>
    <div class="mt-4" data-ref-mechanics></div>
    <div class="mt-6">
      <!-- iter 28 (refine): promote the Notes section header (matching iter-21's
           mechanics-list category divider) so the rusty engineer's highest-value
           refresh-cues (the gotchas) read as a clear section rather than footer
           noise. Appended "· N" announces scope before the user scrolls. -->
      <div data-ref-notes-header style="font-size:12px;text-transform:uppercase;letter-spacing:0.07em;color:#a5b4fc;margin-bottom:6px;padding-left:8px;border-left:2px solid rgba(165,180,252,0.4);">Notes · ${ref.notes.length}</div>
      <ul class="space-y-2">
        ${ref.notes.map(n => `<li class="ref-note flex gap-2"><span class="text-slate-600">▸</span><span>${escapeHtml(n)}</span></li>`).join('')}
      </ul>
    </div>
    ${Array.isArray(ref.alternates) && ref.alternates.length ? `
    <div class="mt-6" data-ref-alternates>
      <!-- Alternate solutions: same problem, different idiom (e.g. min-heap
           vs pairwise divide-and-conquer). Conversation tab often names a
           second pattern in prose; this surface ships the code. Validator
           runs each alternate and asserts the output matches L3.expectedOutput. -->
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.07em;color:#fbbf24;margin-bottom:6px;padding-left:8px;border-left:2px solid rgba(251,191,36,0.4);">Alternate solutions · ${ref.alternates.length}</div>
      <div class="ref-alternates-list">
        ${ref.alternates.map((alt, i) => `
          <details class="ref-alternate">
            <summary class="ref-alt-summary">
              <span class="ref-alt-label">${escapeHtml(alt.label || '')}</span>
              ${alt.complexity ? `<span class="ref-alt-complexity">${escapeHtml(alt.complexity)}</span>` : ''}
              <span class="ref-alt-toggle" aria-hidden="true">▸</span>
            </summary>
            <div class="ref-alt-body">
              ${alt.when ? `<div class="ref-alt-when">${escapeHtml(alt.when)}</div>` : ''}
              <pre class="code-block cm-s-dracula" data-ref-alt-code="${i}"></pre>
              ${Array.isArray(alt.notes) && alt.notes.length ? `
              <ul class="ref-alt-notes">
                ${alt.notes.map(n => `<li class="ref-note flex gap-2"><span class="text-slate-600">▸</span><span>${escapeHtml(n)}</span></li>`).join('')}
              </ul>` : ''}
            </div>
          </details>
        `).join('')}
      </div>
    </div>` : ''}
    <div class="mt-8 flex justify-end">
      <button class="primary" data-action="start-l1">Start drills →</button>
    </div>
  `;
  body.appendChild(section);
  const codeEl = section.querySelector('[data-ref-code]');
  colorizeInto(codeEl, ref.code);
  if (Array.isArray(ref.alternates)) {
    ref.alternates.forEach((alt, i) => {
      const el = section.querySelector(`[data-ref-alt-code="${i}"]`);
      if (el) colorizeInto(el, alt.code || '');
    });
  }
  let flashOn = false;
  let cinemaOn = false;
  let bulletsOn = false;
  const flashBtn = section.querySelector('[data-action="flash-toggle"]');
  const cinemaBtn = section.querySelector('[data-action="cinema-toggle"]');
  const bulletsBtn = section.querySelector('[data-action="bullets-toggle"]');
  function restoreCanonical() {
    flashOn = false;
    cinemaOn = false;
    bulletsOn = false;
    flashBtn.classList.remove('active');
    flashBtn.textContent = '🃏 Flash';
    cinemaBtn.classList.remove('active');
    cinemaBtn.textContent = '🎬 Cinema';
    bulletsBtn.classList.remove('active');
    bulletsBtn.textContent = '📝 Notes→Code';
    colorizeInto(codeEl, ref.code);
  }
  flashBtn.addEventListener('click', () => {
    if (cinemaOn || bulletsOn) restoreCanonical();
    flashOn = !flashOn;
    flashBtn.classList.toggle('active', flashOn);
    flashBtn.textContent = flashOn ? '🃏 Reveal all' : '🃏 Flash';
    if (flashOn) renderFlash(codeEl, ref.code);
    else colorizeInto(codeEl, ref.code);
  });
  // iter 121: 🎬 Reference Cinema — every line starts blurred; tap to reveal.
  // Read+predict-then-verify retrieval direction (distinct from Flash's
  // token-cloze). Toggling Cinema off restores syntax-highlighted view;
  // toggling Flash on while Cinema is active resets to canonical first.
  cinemaBtn.addEventListener('click', () => {
    if (flashOn || bulletsOn) restoreCanonical();
    cinemaOn = !cinemaOn;
    cinemaBtn.classList.toggle('active', cinemaOn);
    cinemaBtn.textContent = cinemaOn ? '🎬 Reveal all' : '🎬 Cinema';
    if (cinemaOn) _renderCinema(codeEl, ref.code);
    else colorizeInto(codeEl, ref.code);
  });
  // iter 144: 📝 Notes→Code — hide canonical; mount a CodeMirror editor in
  // its place; user types canonical from the still-visible Notes list below;
  // Run grades against L3.expectedOutput. Fills the documented L2→L3 cell
  // gap ("see concept, recall code" direction). Mutually exclusive with
  // Flash + Cinema via restoreCanonical(). Desk-tier — tooltip names this
  // explicitly so mobile users self-select. First Cat 1 Drilling Surfaces
  // ship since iter 122 What-If (22-iter Cat 1 drought broken).
  bulletsBtn.addEventListener('click', () => {
    if (flashOn || cinemaOn) restoreCanonical();
    bulletsOn = !bulletsOn;
    bulletsBtn.classList.toggle('active', bulletsOn);
    bulletsBtn.textContent = bulletsOn ? '📝 Reveal canonical' : '📝 Notes→Code';
    if (bulletsOn) _renderBulletsCode(codeEl, content);
    else colorizeInto(codeEl, ref.code);
  });
  // Iter 13: querySelectorAll → forEach so the new inline top CTA AND the
  // existing bottom primary both fire selectTab('L1') from the same wiring.
  section.querySelectorAll('[data-action="start-l1"]').forEach(btn => {
    btn.addEventListener('click', () => selectTab('L1'));
  });

  // iter 72: 🧩 Mechanic Drilldown — inline mechanic chips on the Reference
  // tab. Surfaces this lesson's `content.mechanics` ids as tappable pills
  // that open the Mechanics modal directly to the detail view (every other
  // lesson where the idiom appears). Closes iter-64 held candidate B#2
  // (direct-promoted per iter-63 Mechanics × Track matrix precedent).
  // Lateral-transfer payoff: from canonical → "same idiom, different
  // shape" across track without leaving the recall flow.
  _renderReferenceMechanics(section.querySelector('[data-ref-mechanics]'), content.mechanics);
}

// iter 121: 🎬 Reference Cinema — render reference.code as line-by-line
// blurred buttons inside the existing <pre data-ref-code> element. Tap a
// line to reveal it (toggle .cine-revealed class). Bypasses CodeMirror
// runMode entirely — Cinema mode is about line-grain prediction, not
// syntax highlighting. Restoring canonical via colorizeInto() handles
// the return path when the toggle flips off. First Cat 1 Drilling
// Surfaces enhancement since iter 92 (Flash mode); drills read+predict-
// then-verify retrieval direction distinct from Flash's token cloze.
function _renderCinema(codeEl, code) {
  if (!codeEl) return;
  codeEl.innerHTML = '';
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lineEl = document.createElement('button');
    lineEl.type = 'button';
    lineEl.className = 'cine-line';
    lineEl.dataset.lineIdx = String(i);
    // Empty lines need a non-zero height so the user sees them as a tap
    // target; render a non-breaking space so the blur filter has content.
    lineEl.textContent = lines[i].length > 0 ? lines[i] : ' ';
    lineEl.addEventListener('click', () => {
      lineEl.classList.toggle('cine-revealed');
    });
    codeEl.appendChild(lineEl);
  }
}

// iter 144: 📝 Notes→Code — replace the canonical <pre> with a CodeMirror
// editor + Run button. User types canonical from memory using the still-
// visible Notes list (below) as the prompt. Run grades via runCode against
// content.L3.expectedOutput — same runner semantics as the L3 drill itself,
// so the comparison is byte-for-byte the same surface the user will face
// in L3. Closes the documented L2→L3 cell gap ("see concept (notes-only),
// recall code"). Mounts INSIDE the existing <pre data-ref-code> element so
// the surrounding layout (mechanics chips + Notes list + Start drills CTA)
// stays put — toggle off restores via colorizeInto(codeEl, ref.code).
function _renderBulletsCode(codeEl, content) {
  if (!codeEl) return;
  const expected = content?.L3?.expectedOutput || '';
  codeEl.innerHTML = `
    <div class="bullets-code-prompt">Type the canonical from the notes below. Run when done — same grader as L3.</div>
    <textarea class="bullets-code-editor" data-bullets-editor></textarea>
    <div class="bullets-code-actions">
      <button class="primary" data-bullets-run>Run</button>
      <span class="bullets-code-feedback" data-bullets-feedback></span>
    </div>
  `;
  const ta = codeEl.querySelector('[data-bullets-editor]');
  const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const cm = CodeMirror.fromTextArea(ta, {
    mode: 'javascript',
    theme: 'dracula',
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 2,
    tabSize: 2,
    lineWrapping: true,
    viewportMargin: Infinity,
    inputStyle: isTouchDevice ? 'contenteditable' : 'textarea',
    spellcheck: false,
    autocorrect: false,
    autocapitalize: false
  });
  const runBtn = codeEl.querySelector('[data-bullets-run]');
  const fb = codeEl.querySelector('[data-bullets-feedback]');
  runBtn.addEventListener('click', async () => {
    const userCode = cm.getValue();
    if (!userCode.trim()) {
      fb.textContent = '✗ Editor is empty — type something first.';
      fb.className = 'bullets-code-feedback bullets-feedback-warn';
      return;
    }
    fb.textContent = 'Running…';
    fb.className = 'bullets-code-feedback';
    const res = await runCode(userCode);
    if (!res.ok) {
      fb.textContent = `✗ Error: ${res.output || 'unknown'}`;
      fb.className = 'bullets-code-feedback bullets-feedback-err';
    } else if ((res.output || '') === expected) {
      fb.textContent = '✓ Output matches the canonical. Notes→Code recall succeeded.';
      fb.className = 'bullets-code-feedback bullets-feedback-pass';
      // Notes→Code grader is byte-identical to L3's (same runCode +
      // L3.expectedOutput) — a green pass IS an L3 win. Feed the SR
      // scheduler so the bucket advances; tag history with the cue
      // distinction so downstream telemetry can split L3-direct from
      // notes-direct recalls.
      if (content && content.id) {
        markPassed(content.id, 'L3');
        appendHistory(content.id, 'notes-to-code-pass');
      }
    } else {
      // Show first 80 chars of the wrong output for inline visibility.
      const got = (res.output || '(empty)').slice(0, 80);
      fb.textContent = `✗ Output: ${got}${(res.output || '').length > 80 ? '…' : ''} (expected: ${expected.slice(0, 80)})`;
      fb.className = 'bullets-code-feedback bullets-feedback-warn';
    }
  });
}

function _renderReferenceMechanics(host, mechanicIds) {
  if (!host) return;
  // Hide quietly when lesson has no mechanic tags (~27% of corpus per
  // iter-59 inventory) or registry hasn't loaded yet. The chip row is
  // additive — its absence on a Reference render is not a regression.
  if (!Array.isArray(mechanicIds) || !mechanicIds.length) return;
  if (!MECHANICS.length) {
    // Registry not loaded yet — kick it off and re-render this host when
    // it arrives. Subsequent tab switches will find MECHANICS populated.
    loadMechanicsRegistry().then(() => {
      if (host.isConnected) _renderReferenceMechanics(host, mechanicIds);
    });
    return;
  }
  const labels = mechanicIds
    .map(id => ({ id, m: MECHANICS.find(x => x.id === id) }))
    .filter(x => x.m);
  if (!labels.length) return;
  host.innerHTML = `
    <div class="ref-mechanics-row">
      <span class="ref-mechanics-prefix">🧩 idioms used:</span>
      ${labels.map(({ id, m }) => `<button class="ref-mech-chip" data-mech-chip-id="${escapeHtml(id)}" title="${escapeHtml(m.blurb || m.label)} — tap to see every lesson where this idiom appears">${escapeHtml(m.label)}</button>`).join('')}
    </div>
  `;
  host.querySelectorAll('[data-mech-chip-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mid = btn.getAttribute('data-mech-chip-id');
      openMechanicsDetail(mid);
    });
  });
}

// ──────────────────────────────────────────────────────────────────────────
