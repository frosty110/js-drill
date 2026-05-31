// ──────────────────────────────────────────────────────────────────────────
//  L2 — FILL IN THE BLANK
// ──────────────────────────────────────────────────────────────────────────

// Iter 12: after a Check pass, smoothly scroll the next un-passed exercise
// into view so the mobile drilling loop becomes tap-tap-tap instead of
// tap-pause-scroll-tap (PROFILE 80%-phone, autopilot, ADHD single-focus).
// Used by BOTH renderL2 and renderL2Mobile — same DOM shape (cards as
// direct children of `wrap`), same logic. Skips focus-stealing to avoid
// popping the mobile keyboard unexpectedly.
function _scrollNextUnpassedL2(currentExi, wrap, exerciseState) {
  for (let i = currentExi + 1; i < exerciseState.length; i++) {
    if (exerciseState[i].passed) continue;
    const cards = wrap.querySelectorAll('.mb-6.p-5');
    const target = cards[i];
    if (target && typeof target.scrollIntoView === 'function') {
      // requestAnimationFrame so the feedback's ✓ Pass paint lands first.
      requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    return;
  }
}

function renderL2(body, lesson, content) {
  // Mobile users get a tap-to-fill experience — see renderL2Mobile. The cramped
  // inline-input layout only makes sense on a real keyboard.
  if (window.matchMedia('(max-width: 767px)').matches) {
    return renderL2Mobile(body, lesson, content);
  }
  const exercises = content.L2.exercises;
  // Cache shape mirrors mobile so a viewport switch mid-attempt doesn't
  // lose typing: { passed: bool, values: [str, str, ...] } per exercise.
  let exerciseState = _cacheGet(lesson.id, 'L2');
  if (!Array.isArray(exerciseState) || exerciseState.length !== exercises.length) {
    exerciseState = exercises.map(ex => ({ passed: false, attempts: 0, values: ex.blanks.map(() => '') }));
    _cacheSet(lesson.id, 'L2', exerciseState);
  } else {
    // Defensive: an older cache entry may lack `values` if it predates BS-12.
    exercises.forEach((ex, exi) => {
      if (!Array.isArray(exerciseState[exi].values) || exerciseState[exi].values.length !== ex.blanks.length) {
        exerciseState[exi].values = ex.blanks.map(() => '');
      }
      // Legacy cache entries pre-2026-05-30 lack `attempts`; backfill 0.
      if (typeof exerciseState[exi].attempts !== 'number') exerciseState[exi].attempts = 0;
    });
  }

  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="mb-4 text-sm text-slate-400">Fill the blanks so the code prints the expected output. Pass when all exercises produce the expected output.</div>`;

  exercises.forEach((ex, exi) => {
    const card = document.createElement('div');
    card.className = 'mb-6 p-5 rounded-lg bg-slate-900 border border-slate-800';
    const exerciseId = `l2-ex-${exi}`;
    card.innerHTML = `
      <div class="text-sm text-slate-500 mb-2">Exercise ${exi+1} of ${exercises.length}</div>
      <div class="text-white font-medium mb-3">${escapeHtml(ex.prompt)}</div>
      <pre class="code-block mono cm-s-dracula" data-template></pre>
      <div class="text-xs text-slate-500 mt-3 mb-2">Expected output:
        <span class="mono text-slate-300 ml-1">${escapeHtml(ex.expectedOutput)}</span>
      </div>
      <div class="flex items-center gap-3 mt-3">
        <button class="primary" data-action="check">Check</button>
        <button class="secondary" data-action="reveal">Reveal answers</button>
        <div class="feedback text-sm"></div>
      </div>
      <div class="output-wrap mt-3 hidden">
        <div class="text-xs text-slate-500 mb-1">Actual output:</div>
        <div class="output-box" data-output></div>
      </div>
    `;

    // Build the template with <input> elements where ___ appears.
    // Each non-blank segment is run through CodeMirror's tokenizer so
    // the surrounding code gets the same Dracula highlighting as the L3
    // editor; inputs interleave inline as before.
    const templEl = card.querySelector('[data-template]');
    const parts = ex.template.split('___');
    const inputs = [];
    templEl.innerHTML = '';
    parts.forEach((part, idx) => {
      const seg = document.createElement('span');
      colorizeInto(seg, part);
      templEl.appendChild(seg);
      if (idx < parts.length - 1) {
        const inp = document.createElement('input');
        inp.className = 'blank-input mono';
        inp.type = 'text';
        inp.placeholder = ex.blanks[idx]?.hint || '';
        inp.setAttribute('autocomplete', 'off');
        inp.setAttribute('autocorrect', 'off');
        inp.setAttribute('spellcheck', 'false');
        // Uniform 96px width — never leak the answer length via the slot size.
        inp.style.width = '96px';
        // Restore cached value (preserves typing across tab switches).
        const blankIdx = inputs.length;
        inp.value = exerciseState[exi].values[blankIdx] || '';
        inp.addEventListener('input', () => {
          exerciseState[exi].values[blankIdx] = inp.value;
        });
        templEl.appendChild(inp);
        inputs.push(inp);
      }
    });

    const feedback = card.querySelector('.feedback');
    const outputWrap = card.querySelector('.output-wrap');
    const outputBox = card.querySelector('[data-output]');

    card.querySelector('[data-action="check"]').addEventListener('click', async () => {
      // Count this attempt — used to flag the "struggled-but-eventually-
      // passed" middle case (≥3 attempts) as a weakness signal. Audit:
      // audits/l2.md edit 1.
      if (!exerciseState[exi].passed) exerciseState[exi].attempts++;
      // mark each blank
      let allBlanksRight = true;
      inputs.forEach((inp, i) => {
        inp.classList.remove('correct','incorrect');
        if (inp.value.trim() === ex.blanks[i].answer.trim()) {
          inp.classList.add('correct');
        } else {
          inp.classList.add('incorrect');
          allBlanksRight = false;
        }
      });
      // run filled-in code — split-and-rejoin so a user-typed "___" can't
      // misroute into the next placeholder's slot.
      const parts = ex.template.split('___');
      let filled = parts[0];
      for (let i = 0; i < inputs.length; i++) {
        filled += inputs[i].value + parts[i + 1];
      }
      const result = await runCode(filled);
      outputBox.classList.toggle('error', !result.ok);
      outputBox.textContent = result.output || '(no output)';
      outputWrap.classList.remove('hidden');

      const matched = result.ok && outputsMatch(result.output, ex.expectedOutput);
      // If the user passes after struggling (≥3 attempts), flag once
      // as a weakness signal — surfaces "struggled-but-eventually-passed"
      // middle case the SR loop previously couldn't see (audits/l2.md
      // edit 1). Only fires on the FIRST pass for this exercise.
      const justPassed = !exerciseState[exi].passed && matched;
      if (justPassed && exerciseState[exi].attempts >= 3) {
        state.weakness[lesson.id] = (state.weakness[lesson.id] || 0) + 1;
        appendHistory(lesson.id, 'L2-struggle-pass');
      }
      if (allBlanksRight && matched) {
        feedback.innerHTML = '<span class="text-emerald-400 font-medium">✓ Pass</span>';
        exerciseState[exi].passed = true;
        checkL2Overall();
        _scrollNextUnpassedL2(exi, wrap, exerciseState);
      } else if (matched) {
        feedback.innerHTML = '<span class="text-amber-400">Output matches, but one or more blanks doesn’t match the canonical answer.</span>';
        exerciseState[exi].passed = true;
        checkL2Overall();
        _scrollNextUnpassedL2(exi, wrap, exerciseState);
      } else if (!result.ok) {
        // Runtime error — likely a blank caused a ReferenceError / SyntaxError
        // because a downstream identifier expects a specific name.
        feedback.innerHTML = '<span class="text-rose-400">Runtime error — a blank you typed may not match an identifier used later. Check the output box and red inputs.</span>';
      } else {
        feedback.innerHTML = '<span class="text-rose-400">Output doesn’t match. Check the blanks.</span>';
      }
    });

    card.querySelector('[data-action="reveal"]').addEventListener('click', () => {
      inputs.forEach((inp, i) => {
        inp.value = ex.blanks[i].answer;
        inp.classList.remove('incorrect');
        inp.classList.add('correct');
      });
      const { demoted } = markRevealed(lesson.id, 'L2');
      if (demoted) {
        feedback.innerHTML = '<span class="text-amber-400">Solution revealed.</span>' + srBadgeHtml(lesson.id, 'demote');
      }
    });
    wrap.appendChild(card);
  });

  const status = document.createElement('div');
  status.className = 'mt-2 flex items-center justify-between';
  status.innerHTML = `
    <div class="text-sm text-slate-400" id="l2-status">Pass every exercise to unlock L3.</div>
    <button class="primary hidden" data-action="next-l3">L3 Drill →</button>
  `;
  wrap.appendChild(status);
  body.appendChild(wrap);

  status.querySelector('[data-action="next-l3"]').addEventListener('click', () => selectTab('L3'));

  function checkL2Overall() {
    const allPassed = exerciseState.every(s => s.passed);
    if (allPassed) {
      // markPassed first so state.reviews reflects the new schedule when
      // srBadgeHtml reads it.
      markPassed(lesson.id, 'L2');
      document.getElementById('l2-status').innerHTML =
        '<span class="text-emerald-400 font-medium">✓ L2 passed.</span>' +
        srBadgeHtml(lesson.id, 'pass');
      status.querySelector('[data-action="next-l3"]').classList.remove('hidden');
    }
  }

  // Replay cached per-exercise pass state — if the user passed L2 in a
  // previous tab visit, surface the ✓ Pass feedback and L3 button without
  // requiring another Check click.
  exerciseState.forEach((s, exi) => {
    if (!s.passed) return;
    const card = wrap.children[exi + 1]; // +1 for the intro div
    const feedback = card?.querySelector('.feedback');
    if (feedback) feedback.innerHTML = '<span class="text-emerald-400 font-medium">✓ Pass</span>';
  });
  checkL2Overall();
}

// ──────────────────────────────────────────────────────────────────────────
//  L2 — MOBILE VARIANT (tap-to-fill with bottom sheet)
//  Blanks render as button chips inside the colored code. Tapping a chip
//  marks it active and slides up a single shared sheet at the bottom of
//  the viewport with the current hint + a large 16px input. Typing
//  live-updates the chip; Prev / Next walk through blanks across the
//  entire exercise; Done dismisses. Check / Reveal still validate the
//  assembled code through the same runner the desktop path uses.
// ──────────────────────────────────────────────────────────────────────────
function renderL2Mobile(body, lesson, content) {
  const exercises = content.L2.exercises;
  // Share the L2 cache slot with the desktop variant — `values` + `passed`
  // shape is identical; chips are DOM and per-render so they stay local.
  let cached = _cacheGet(lesson.id, 'L2');
  if (!Array.isArray(cached) || cached.length !== exercises.length) {
    cached = exercises.map(ex => ({ passed: false, attempts: 0, values: ex.blanks.map(() => '') }));
    _cacheSet(lesson.id, 'L2', cached);
  } else {
    exercises.forEach((ex, exi) => {
      if (!Array.isArray(cached[exi].values) || cached[exi].values.length !== ex.blanks.length) {
        cached[exi].values = ex.blanks.map(() => '');
      }
      // Legacy cache entries pre-2026-05-30 lack `attempts`; backfill 0.
      if (typeof cached[exi].attempts !== 'number') cached[exi].attempts = 0;
    });
  }
  // exerciseState wraps the cached data with per-render chip refs.
  // Use getter/setter for `passed`/`attempts` and share the `values`
  // array reference so every existing write site (chip taps, reveal,
  // check) automatically mutates the cache too — no manual sync.
  const exerciseState = cached.map((c) => ({
    get passed() { return c.passed; },
    set passed(v) { c.passed = v; },
    get attempts() { return c.attempts; },
    set attempts(v) { c.attempts = v; },
    values: c.values,
    chips: []
  }));

  document.body.classList.add('l2-mobile-active');

  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="mb-4 text-sm text-slate-400">Tap a blank to fill it in — a keyboard panel appears at the bottom. Pass when every blank's code prints the expected output.</div>`;

  let activeRef = null;   // { exi, bi } — which chip is currently in the sheet

  exercises.forEach((ex, exi) => {
    const card = document.createElement('div');
    card.className = 'mb-6 p-5 rounded-lg bg-slate-900 border border-slate-800';
    card.innerHTML = `
      <div class="text-sm text-slate-500 mb-2">Exercise ${exi+1} of ${exercises.length}</div>
      <div class="text-white font-medium mb-3">${escapeHtml(ex.prompt)}</div>
      <pre class="code-block mono cm-s-dracula" data-template></pre>
      <div class="text-xs text-slate-500 mt-3 mb-2">Expected output:
        <span class="mono text-slate-300 ml-1">${escapeHtml(ex.expectedOutput)}</span>
      </div>
      <div class="flex items-center gap-3 mt-3 flex-wrap">
        <button class="primary" data-action="check">Check</button>
        <button class="secondary" data-action="reveal">Reveal answers</button>
        <div class="feedback text-sm"></div>
      </div>
      <div class="output-wrap mt-3 hidden">
        <div class="text-xs text-slate-500 mb-1">Actual output:</div>
        <div class="output-box" data-output></div>
      </div>
    `;

    const templEl = card.querySelector('[data-template]');
    const parts = ex.template.split('___');
    templEl.innerHTML = '';
    parts.forEach((part, idx) => {
      const seg = document.createElement('span');
      colorizeInto(seg, part);
      templEl.appendChild(seg);
      if (idx < parts.length - 1) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'blank-chip';
        chip.setAttribute('data-exi', String(exi));
        chip.setAttribute('data-bi', String(idx));
        chip.setAttribute('aria-label', `Blank ${idx+1}, ${ex.blanks[idx]?.hint || 'tap to fill'}`);
        chip.innerHTML = `<span class="chip-value">___</span><span class="chip-num">${idx+1}</span>`;
        chip.addEventListener('click', (e) => { e.preventDefault(); activate(exi, idx); });
        templEl.appendChild(chip);
        exerciseState[exi].chips.push(chip);
        // Restore cached fill (preserves tap-input across tab/viewport switches).
        const cachedVal = exerciseState[exi].values[idx];
        if (cachedVal) {
          const valueEl = chip.querySelector('.chip-value');
          if (valueEl) valueEl.textContent = cachedVal;
          chip.classList.add('has-value');
        }
      }
    });

    const feedback = card.querySelector('.feedback');
    const outputWrap = card.querySelector('.output-wrap');
    const outputBox = card.querySelector('[data-output]');

    card.querySelector('[data-action="check"]').addEventListener('click', async () => {
      // Save whatever's typed in the sheet before validating.
      saveActiveValue();
      // Count this attempt — used to flag the "struggled-but-eventually-
      // passed" middle case (≥3 attempts) as a weakness signal. Audit:
      // audits/l2.md edit 1.
      if (!exerciseState[exi].passed) exerciseState[exi].attempts++;
      const vals = exerciseState[exi].values;
      const chips = exerciseState[exi].chips;
      let allBlanksRight = true;
      vals.forEach((v, i) => {
        chips[i].classList.remove('correct', 'incorrect');
        if (v.trim() === ex.blanks[i].answer.trim()) {
          chips[i].classList.add('correct');
        } else {
          chips[i].classList.add('incorrect');
          allBlanksRight = false;
        }
      });
      let filled = parts[0];
      for (let i = 0; i < vals.length; i++) filled += vals[i] + parts[i + 1];
      const result = await runCode(filled);
      outputBox.classList.toggle('error', !result.ok);
      outputBox.textContent = result.output || '(no output)';
      outputWrap.classList.remove('hidden');

      const matched = result.ok && outputsMatch(result.output, ex.expectedOutput);
      // If the user passes after struggling (≥3 attempts), flag once
      // as a weakness signal — surfaces "struggled-but-eventually-passed"
      // middle case the SR loop previously couldn't see (audits/l2.md
      // edit 1). Only fires on the FIRST pass for this exercise.
      const justPassed = !exerciseState[exi].passed && matched;
      if (justPassed && exerciseState[exi].attempts >= 3) {
        state.weakness[lesson.id] = (state.weakness[lesson.id] || 0) + 1;
        appendHistory(lesson.id, 'L2-struggle-pass');
      }
      if (allBlanksRight && matched) {
        feedback.innerHTML = '<span class="text-emerald-400 font-medium">✓ Pass</span>';
        exerciseState[exi].passed = true;
        checkL2Overall();
        _scrollNextUnpassedL2(exi, wrap, exerciseState);
      } else if (matched) {
        feedback.innerHTML = '<span class="text-amber-400">Output matches, but one or more blanks doesn’t match the canonical answer.</span>';
        exerciseState[exi].passed = true;
        checkL2Overall();
        _scrollNextUnpassedL2(exi, wrap, exerciseState);
      } else if (!result.ok) {
        feedback.innerHTML = '<span class="text-rose-400">Runtime error — a blank may not match an identifier used later. Check the output and red chips.</span>';
      } else {
        feedback.innerHTML = '<span class="text-rose-400">Output doesn’t match. Check the blanks.</span>';
      }
    });

    card.querySelector('[data-action="reveal"]').addEventListener('click', () => {
      const chips = exerciseState[exi].chips;
      ex.blanks.forEach((b, i) => {
        exerciseState[exi].values[i] = b.answer;
        const valueEl = chips[i].querySelector('.chip-value');
        if (valueEl) valueEl.textContent = b.answer;
        chips[i].classList.remove('incorrect');
        chips[i].classList.add('has-value', 'correct');
      });
      if (activeRef && activeRef.exi === exi) {
        sheetInput.value = ex.blanks[activeRef.bi].answer;
      }
      const { demoted } = markRevealed(lesson.id, 'L2');
      if (demoted) {
        feedback.innerHTML = '<span class="text-amber-400">Solution revealed.</span>' + srBadgeHtml(lesson.id, 'demote');
      }
    });

    wrap.appendChild(card);
  });

  // ── Shared bottom sheet ─────────────────────────────────────────────
  const sheet = document.createElement('div');
  sheet.className = 'l2-sheet';
  sheet.innerHTML = `
    <div class="l2-sheet-header">
      <span class="l2-sheet-label" data-sheet-label>Tap a blank to start</span>
      <span class="l2-sheet-hint" data-sheet-hint></span>
    </div>
    <input class="l2-sheet-input mono" data-sheet-input type="text" autocomplete="off" autocorrect="off" spellcheck="false" inputmode="text" />
    <div class="l2-sheet-actions">
      <button class="secondary" data-sheet-prev>← Prev</button>
      <button class="primary" data-sheet-next>Next →</button>
      <button class="secondary" data-sheet-done>Done</button>
    </div>
  `;
  wrap.appendChild(sheet);

  const sheetInput = sheet.querySelector('[data-sheet-input]');
  const sheetLabel = sheet.querySelector('[data-sheet-label]');
  const sheetHint  = sheet.querySelector('[data-sheet-hint]');
  const sheetPrev  = sheet.querySelector('[data-sheet-prev]');
  const sheetNext  = sheet.querySelector('[data-sheet-next]');
  const sheetDone  = sheet.querySelector('[data-sheet-done]');

  function activate(exi, bi) {
    saveActiveValue();
    activeRef = { exi, bi };
    document.querySelectorAll('.blank-chip.active').forEach(c => c.classList.remove('active'));
    const ex = exercises[exi];
    const chip = exerciseState[exi].chips[bi];
    const blank = ex.blanks[bi];
    chip.classList.add('active');
    sheetLabel.textContent = `Exercise ${exi+1} · Blank ${bi+1} of ${ex.blanks.length}`;
    sheetHint.textContent = blank.hint || '';
    sheetInput.value = exerciseState[exi].values[bi];
    sheetInput.placeholder = blank.hint || '';
    sheetPrev.disabled = (bi === 0);
    sheetNext.disabled = (bi === ex.blanks.length - 1);
    sheet.classList.add('open');
    chip.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => sheetInput.focus(), 80);
  }

  function saveActiveValue() {
    if (!activeRef) return;
    const { exi, bi } = activeRef;
    const v = sheetInput.value;
    exerciseState[exi].values[bi] = v;
    const chip = exerciseState[exi].chips[bi];
    const valueEl = chip.querySelector('.chip-value');
    if (valueEl) valueEl.textContent = v || '___';
    chip.classList.toggle('has-value', !!v);
    chip.classList.remove('correct', 'incorrect');
  }

  sheetInput.addEventListener('input', () => {
    if (!activeRef) return;
    const { exi, bi } = activeRef;
    const v = sheetInput.value;
    exerciseState[exi].values[bi] = v;
    const chip = exerciseState[exi].chips[bi];
    const valueEl = chip.querySelector('.chip-value');
    if (valueEl) valueEl.textContent = v || '___';
    chip.classList.toggle('has-value', !!v);
    chip.classList.remove('correct', 'incorrect');
  });

  sheetInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!sheetNext.disabled) sheetNext.click();
      else sheetDone.click();
    }
  });

  sheetPrev.addEventListener('click', () => {
    if (!activeRef || activeRef.bi === 0) return;
    activate(activeRef.exi, activeRef.bi - 1);
  });
  sheetNext.addEventListener('click', () => {
    if (!activeRef) return;
    const max = exercises[activeRef.exi].blanks.length - 1;
    if (activeRef.bi >= max) return;
    activate(activeRef.exi, activeRef.bi + 1);
  });
  sheetDone.addEventListener('click', () => {
    saveActiveValue();
    if (activeRef) {
      const chip = exerciseState[activeRef.exi].chips[activeRef.bi];
      chip.classList.remove('active');
    }
    activeRef = null;
    sheet.classList.remove('open');
    sheetInput.blur();
  });

  // Status footer (same as desktop)
  const status = document.createElement('div');
  status.className = 'mt-2 flex items-center justify-between';
  status.innerHTML = `
    <div class="text-sm text-slate-400" id="l2-status">Pass every exercise to unlock L3.</div>
    <button class="primary hidden" data-action="next-l3">L3 Drill →</button>
  `;
  wrap.appendChild(status);
  body.appendChild(wrap);

  status.querySelector('[data-action="next-l3"]').addEventListener('click', () => selectTab('L3'));

  function checkL2Overall() {
    const allPassed = exerciseState.every(s => s.passed);
    if (allPassed) {
      // markPassed first so state.reviews reflects the new schedule when
      // srBadgeHtml reads it.
      markPassed(lesson.id, 'L2');
      document.getElementById('l2-status').innerHTML =
        '<span class="text-emerald-400 font-medium">✓ L2 passed.</span>' +
        srBadgeHtml(lesson.id, 'pass');
      status.querySelector('[data-action="next-l3"]').classList.remove('hidden');
    }
  }

  // Replay cached pass state (mobile path). Mirrors the desktop replay so
  // viewport-switching mid-attempt is symmetric.
  exerciseState.forEach((s, exi) => {
    if (!s.passed) return;
    const card = wrap.querySelectorAll('.feedback')[exi]?.closest('.mb-6');
    const feedback = card?.querySelector('.feedback');
    if (feedback) feedback.innerHTML = '<span class="text-emerald-400 font-medium">✓ Pass</span>';
  });
  checkL2Overall();
}

