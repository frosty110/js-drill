// ──────────────────────────────────────────────────────────────────────────
//  L3 — TYPE FROM MEMORY (DRILL)
// ──────────────────────────────────────────────────────────────────────────
// L3 hint ladder — graduated tap-to-reveal hints. Tier 1 names the approach;
// tier 2 reveals the function skeleton; tier 3 reveals the first real step.
// Falls back to auto-derivation when `L3.hints` has fewer than 3 authored
// entries so every lesson has a 3-tier ladder. Hint tiers do NOT demote the
// SR bucket — only the explicit "Reveal canonical" does that.
// See ideas-by-category.md § Drilling Surfaces → "L3 hint ladder" entry.
function _deriveCanonicalSkeleton(canonical) {
  if (!canonical) return null;
  // Find a top-level function declaration or arrow assignment.
  const fnDecl = canonical.match(/^\s*function\s+\w+\s*\([^)]*\)/m);
  if (fnDecl) return fnDecl[0].trim() + ' { ... }';
  const arrowAssign = canonical.match(/^\s*(?:const|let|var)\s+\w+\s*=\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)/m);
  if (arrowAssign) return arrowAssign[0].trim() + ' { ... }';
  // Top-level IIFE pattern.
  if (/^\s*\(async\s*\(\)\s*=>\s*\{/m.test(canonical)) return '(async () => { ... })();';
  return null;
}

function _deriveCanonicalFirstStep(canonical) {
  if (!canonical) return null;
  const lines = canonical.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('//')) continue;
    // Skip the function signature line itself.
    if (/^\s*(?:function|const|let|var|class)\b/.test(line) && /\{?\s*$/.test(trimmed)) continue;
    if (trimmed === '{' || trimmed === '}') continue;
    return line.trim();
  }
  return null;
}

function _buildHintLadder(drill) {
  const authored = drill.hints || [];
  const skeleton = _deriveCanonicalSkeleton(drill.canonical);
  const firstStep = _deriveCanonicalFirstStep(drill.canonical);
  return [
    { label: 'Approach', text: authored[0] || 'Think about which data structure or pattern fits this problem.' },
    { label: 'Skeleton', text: authored[1] || (skeleton ? skeleton : 'Top-level script — no wrapper function needed.') },
    { label: 'First step', text: authored[2] || (firstStep ? firstStep : 'Initialize your data structure and start the main loop.') }
  ];
}

function renderL3(body, lesson, content) {
  // iter 117: 🎤 Clarify-First Ritual — opt-in gate before the L3 editor.
  // Skip when (a) toggle off, (b) mock interview in progress (no scaffolding
  // by design — mirrors iter-81 Edge case chips bypass), (c) lesson lacks
  // Conv Sec.1 say bullets (Syntax track), (d) user already completed the
  // ritual for this lesson this session.
  if (
    state.clarifyRitualOn
    && !(state.mock.active && state.mock.lessonId === lesson.id)
    && content?.conversation?.sections?.[0]?.say
    && !_clarifySessionCompleted.has(lesson.id)
  ) {
    return _renderClarifyRitual(body, lesson, content);
  }
  // iter 119: ⏱ Time-to-Solve Calibration — strip injected after L3 body
  // renders (see end of this function via setTimeout(0)).
  const drill = content.L3;
  const isMock = state.mock.active && state.mock.lessonId === lesson.id;
  const bestMs = state.bestTimes[lesson.id];
  const wrap = document.createElement('div');

  // iter 140: ⏲ Pace-Bar — append 'L3-enter' event when user opens L3 (non-mock).
  // Schema-additive: existing history walkers either branch on specific event
  // strings (L1-pass/L2-pass/L3-pass/hint-tier-*/critical-lines-used) or ignore
  // unknowns, so this is backward-compatible. _paceBarMedianMs reads enter→pass
  // deltas to compute a per-lesson rolling median when mockHistory is empty.
  if (!isMock) appendHistory(lesson.id, 'L3-enter');

  // iter 140: Clear any prior Pace-Bar animation interval on re-render. Each
  // renderL3 owns its own interval; a stale interval from a previous render
  // would otherwise tick against the wrong wrap element.
  if (window._paceBarInterval) {
    clearInterval(window._paceBarInterval);
    window._paceBarInterval = null;
  }
  // Compute median ONCE per render. Null when there's not enough data — bar
  // auto-hides (no skeleton, no "no data yet" copy — L75 mitigation: silent
  // off-state rather than a nag).
  const paceBarMedianMs = (!isMock && state.paceBarOn) ? _paceBarMedianMs(lesson.id) : null;

  const mockBanner = isMock
    ? `<div class="mb-4 p-4 rounded-lg bg-rose-950/50 border border-rose-900 flex items-center justify-between">
         <div>
           <div class="text-xs uppercase tracking-wider text-rose-300 mb-1">🎯 Mock interview in progress</div>
           <div class="text-rose-100 mono"><span id="mock-timer">0:00</span> elapsed · hints disabled</div>
         </div>
         <button class="secondary" data-action="end-mock">End interview</button>
       </div>`
    : '';
  const bestBadge = bestMs
    ? `<span class="pill" style="background:rgba(255,206,90,0.15);color:#ffedc2">⏱ Best: ${formatTime(bestMs)}</span>`
    : '';
  // Trend chip — show the rolling history of mock times so the user can see
  // whether they're improving across attempts, not just whether they hit a
  // new PB on this one. The most recent attempt is rightmost; if it equals
  // the PB it gets a star. Hidden when fewer than 2 attempts exist (no
  // trend yet to show).
  //
  // iter 61: Mock Replay Reel — cells are now individually tap-targets that
  // reveal a per-attempt tile (attempt index + delta-vs-best). Adds a slope
  // badge alongside computing first-vs-last comparison: improving (↓)
  // flat (→) regressing (↑). Closes iter-59 roadmap #2; honest-scope adjust
  // from the entry's "activates dead data" framing (data was already shown
  // in the text trend chip) to "adds slope label + tap-for-detail" — the
  // PROFILE personal-bests-trend-down measurement gap.
  const history = state.mockHistory[lesson.id] || [];
  const trendBadge = history.length >= 2
    ? (() => {
        const cells = history.map((ms, i) => {
          const isPB = bestMs && ms === bestMs;
          const label = isPB ? `★${formatTime(ms)}` : formatTime(ms);
          // data-attempt indexes the cell into history; the tap handler
          // pulls the {ms, attemptIdx} pair to render the detail tile.
          return `<button class="mock-reel-cell" data-mock-attempt="${i}" type="button" title="Attempt ${i + 1} of ${history.length}">${label}</button>`;
        });
        return `<span class="pill mono mock-reel" data-mock-reel title="Tap a cell for attempt detail. Most recent rightmost." style="background:rgba(255,206,90,0.08);color:#ffedc2;letter-spacing:0.02em;display:inline-flex;align-items:center;gap:6px;padding-top:1px;padding-bottom:1px">${cells.join('<span style="color:#4a4f58">·</span>')}</span>`;
      })()
    : '';
  const slopeBadge = (() => {
    if (history.length < 2) return '';
    const first = history[0], last = history[history.length - 1];
    const delta = first - last; // positive = faster on last attempt = improving
    const pct = Math.abs(delta) / first;
    let arrow, tone, label;
    if (pct < 0.05) { arrow = '→'; tone = '#9aa0aa'; label = 'holding'; }
    else if (delta > 0) { arrow = '↓'; tone = '#34d399'; label = `${formatTime(Math.abs(delta))} faster vs first`; }
    else { arrow = '↑'; tone = '#f5b62b'; label = `${formatTime(Math.abs(delta))} slower vs first`; }
    return `<span class="pill mono" title="${escapeHtml(history.length)}-attempt trend (last vs first)" style="background:rgba(${tone === '#34d399' ? '52,211,153' : tone === '#f5b62b' ? '251,191,36' : '148,163,184'},0.10);color:${tone};letter-spacing:0.02em">${arrow} ${escapeHtml(label)}</span>`;
  })();

  wrap.innerHTML = `
    ${mockBanner}
    ${paceBarMedianMs != null ? `
    <!-- iter 140: ⏲ Pace-Bar — opt-in peripheral-vision tempo cue.
         Bar fill grows from 0% to 100% over paceBarMedianMs; color is
         keyed to elapsed/median ratio (green <50%, amber 50-100%, red ≥100%).
         No numerals, no streak, no "broke pace" callout — pure peripheral
         signal. data-pace-median-ms exposes the median for probe assertions. -->
    <div class="pace-bar" data-pace-bar data-pace-median-ms="${Math.round(paceBarMedianMs)}" role="presentation" aria-hidden="true">
      <div class="pace-bar-fill pace-bar-green" data-pace-bar-fill></div>
    </div>
    ` : ''}
    <div class="mb-4 text-sm text-slate-400 flex items-center justify-between flex-wrap gap-2">
      ${isMock ? '' : '<span>Type the canonical from memory, then Run — pass when the output matches.</span>'}
      <div class="flex items-center gap-2 flex-wrap">${bestBadge}${slopeBadge}${trendBadge}</div>
    </div>
    <div class="mock-reel-tile hidden" data-mock-reel-tile></div>
    <div class="p-4 rounded-lg bg-slate-900 border border-slate-800 mb-4">
      <div class="text-xs text-slate-500 uppercase tracking-wider mb-1">Prompt</div>
      <div class="text-white">${escapeHtml(drill.prompt)}</div>
      <div class="mt-3 text-xs text-slate-500">Expected output:
        <span class="mono text-slate-300 ml-1">${escapeHtml(drill.expectedOutput)}</span>
      </div>
    </div>
    ${isMock ? '' : `
    <!-- iter 81: 🛡 Edge case pre-enumeration chip strip. Trains the
         clarifying-questions ritual interviewers grade — "before you code,
         what edges would you ask about?". Pure UX nudge (no scoring, no
         per-lesson curation); tap-toggles each chip's "considered" state.
         Hidden during Mock Interview (mock is no-scaffolding by design). -->
    <div class="edge-strip" data-edge-strip>
      <span class="edge-strip-label">🛡 Consider edges:</span>
      <button type="button" class="edge-chip" data-edge="empty">empty</button>
      <button type="button" class="edge-chip" data-edge="single">single element</button>
      <button type="button" class="edge-chip" data-edge="dupes">duplicates</button>
      <button type="button" class="edge-chip" data-edge="max">max size</button>
      <button type="button" class="edge-chip" data-edge="negative">negative</button>
      <button type="button" class="edge-chip" data-edge="none">no solution</button>
    </div>
    `}
    ${isMock ? '' : `
    <!-- iter 123: 🎹 L3 keyboard chips — one-tap insertion for the 12
         high-cost JS tokens (paren/symbol/modifier-key heavy). PROFILE
         80%-phone L3-typing cost mitigation; rusty engineer's mobile L3
         drilling barrier is the keyboard, not the recall. Bypassed during
         Mock Interview (no scaffolding by design — mirrors iter-81 Edge
         case chips bypass). Source: ideas-by-category.md § Cat 5 promotion
         shortlist #1 (iter 93 curated, iter 123 SHIPPED). -->
    <div class="l3-chips" data-l3-chips>
      ${L3_CHIP_TOKENS.map(t => `<button type="button" class="l3-chip" data-chip-insert="${escapeHtml(t.insert)}" title="Insert ${escapeHtml(t.label)} at cursor">${escapeHtml(t.label)}</button>`).join('')}
    </div>
    `}
    <textarea id="drill-editor"></textarea>
    <div class="l3-actions mt-3 flex items-center gap-2 flex-wrap">
      <button class="primary" data-action="run">Run <span class="text-amber-900">(⌘↵)</span></button>
      ${isMock ? '' : `<button class="secondary" data-action="hint" data-hint-btn>${dsIcon('lightbulb', 15)}Hint</button>`}
      ${isMock || !Array.isArray(drill.criticalLines) || drill.criticalLines.length === 0 ? '' : `<button class="secondary" data-action="critical-fill" data-critical-btn title="Pre-fill the editor with the canonical; you fill just the ${drill.criticalLines.length} load-bearing line${drill.criticalLines.length === 1 ? '' : 's'}">${dsIcon('target', 15)}Critical lines</button>`}
      ${isMock ? '' : '<button class="secondary" data-action="diff">Compare to canonical</button>'}
      ${isMock ? '' : '<button class="secondary" data-action="reveal">Reveal canonical</button>'}
      <button class="secondary" data-action="clear">Clear</button>
      <div class="feedback text-sm ml-2"></div>
    </div>
    ${isMock ? '' : '<div class="hint-stack mt-3 hidden" data-hint-stack></div>'}
    ${isMock ? '' : '<div class="hint-trend mt-2 hidden" data-hint-trend></div>'}
    <div class="mt-4">
      <div class="text-xs text-slate-500 mb-1 flex items-center justify-between">
        <span>Output:</span>
        <span class="text-slate-600" title="Subsequence match: expected lines must appear in order. Extra debug logs between expected lines will break the match — use console.debug() instead to log without grading.">match: subsequence · use <code class="mono text-slate-400">console.debug()</code> to log without grading</span>
      </div>
      <div class="output-box" data-output>(run your code…)</div>
    </div>
    <div data-debug-panel class="mt-3 hidden">
      <div class="text-xs text-slate-500 mb-1 flex items-center gap-2">
        <span style="color:#fde68a">🐛 Debug output</span>
        <span class="text-slate-600">(from <code class="mono">console.debug</code> / <code class="mono">console.info</code> — not graded)</span>
      </div>
      <div class="output-box" data-debug-box style="background:#1a1330;color:#fde68a;border-color:#3b2a52"></div>
    </div>
    <div data-diff-panel class="mt-4 hidden">
      <div class="text-xs text-slate-500 mb-1">Diff vs canonical (comments stripped):</div>
      <div data-diff class="diff-side"></div>
    </div>
  `;
  body.appendChild(wrap);

  // iter 119: ⏱ Time-to-Solve Calibration — inject estimate strip at TOP of
  // L3 wrap when toggle on + Patterns/Applied + not Mock + not yet estimated/
  // skipped for this lesson this session. _calibrationMaybeInject() handles
  // all gates internally.
  if (typeof _calibrationMaybeInject === 'function') _calibrationMaybeInject(lesson, wrap);

  // iter 140: ⏲ Pace-Bar driver. Ticks every 500ms; updates fill width and
  // color class based on elapsed/median ratio. Auto-stops when the bar element
  // leaves the DOM (lesson nav / tab switch) — no manual cleanup needed because
  // the next renderL3 also clears window._paceBarInterval at the top.
  if (paceBarMedianMs != null) {
    const fillEl = wrap.querySelector('[data-pace-bar-fill]');
    if (fillEl) {
      const startTs = Date.now();
      const tick = () => {
        if (!fillEl.isConnected) {
          clearInterval(window._paceBarInterval);
          window._paceBarInterval = null;
          return;
        }
        const pct = (Date.now() - startTs) / paceBarMedianMs;
        const widthPct = Math.min(pct, 1) * 100;
        fillEl.style.width = widthPct + '%';
        // Color band keyed to ratio of elapsed/median; tracks the bar fill
        // since width is min-clamped to 100% but the ratio keeps growing past.
        const wantClass = pct < 0.5 ? 'pace-bar-green'
                        : pct < 1.0 ? 'pace-bar-amber'
                        : 'pace-bar-red';
        if (!fillEl.classList.contains(wantClass)) {
          fillEl.classList.remove('pace-bar-green', 'pace-bar-amber', 'pace-bar-red');
          fillEl.classList.add(wantClass);
        }
      };
      tick(); // paint immediately so the bar appears at 0% rather than after 500ms.
      window._paceBarInterval = setInterval(tick, 500);
    }
  }

  if (isMock) {
    wrap.querySelector('[data-action="end-mock"]').addEventListener('click', () => {
      endMockInterview(false);
    });
  }

  // iter 81: Edge-case chip toggles. Pure visual state — no persistence,
  // no scoring, no per-lesson curation. Trains the clarifying-questions
  // ritual before coding. Hidden during Mock (see edge-strip render gate).
  wrap.querySelectorAll('.edge-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('edge-chip-considered'));
  });

  // iter 61: Mock Replay Reel — wire per-cell tap-for-detail. Renders a
  // small tile below the header strip with attempt index + delta-vs-best.
  // Tile is exclusive: tapping a second cell replaces the tile body; tapping
  // the same cell twice toggles it off.
  const reelTile = wrap.querySelector('[data-mock-reel-tile]');
  let lastReelOpenIdx = -1;
  wrap.querySelectorAll('[data-mock-attempt]').forEach(cell => {
    cell.addEventListener('click', () => {
      const idx = +cell.dataset.mockAttempt;
      if (idx === lastReelOpenIdx) {
        reelTile.classList.add('hidden');
        lastReelOpenIdx = -1;
        wrap.querySelectorAll('.mock-reel-cell-active').forEach(c => c.classList.remove('mock-reel-cell-active'));
        return;
      }
      lastReelOpenIdx = idx;
      const ms = history[idx];
      const deltaVsBest = bestMs ? ms - bestMs : 0;
      const deltaLabel = deltaVsBest === 0
        ? `★ Personal best`
        : `+${formatTime(deltaVsBest)} from best`;
      const attemptLabel = `Attempt ${idx + 1} of ${history.length}`;
      const timeStr = formatTime(ms);
      const pct = bestMs && bestMs > 0 ? Math.round(deltaVsBest / bestMs * 100) : 0;
      const pctStr = deltaVsBest === 0 ? '' : ` (+${pct}%)`;
      reelTile.innerHTML = `
        <span class="mock-reel-tile-attempt">${escapeHtml(attemptLabel)}</span>
        <span class="mock-reel-tile-time mono">${escapeHtml(timeStr)}</span>
        <span class="mock-reel-tile-delta">${escapeHtml(deltaLabel)}${pctStr}</span>
      `;
      reelTile.classList.remove('hidden');
      wrap.querySelectorAll('.mock-reel-cell-active').forEach(c => c.classList.remove('mock-reel-cell-active'));
      cell.classList.add('mock-reel-cell-active');
    });
  });

  const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const cm = CodeMirror.fromTextArea(document.getElementById('drill-editor'), {
    // TS lessons get the typescript MIME so annotations colour correctly.
    mode: lessonCodeMode(content),
    theme: 'dracula',
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 2,
    tabSize: 2,
    // Wrap long lines so phone users never have to scroll horizontally to
    // read code they just typed. Desktop benefits too (no orphan tokens
    // sliding off the right edge).
    lineWrapping: true,
    // Render the whole document — short snippets benefit from no
    // viewport virtualization, and it eliminates a scroll-jank source on iOS.
    viewportMargin: Infinity,
    // contenteditable on touch devices avoids iOS Safari's hidden-cursor /
    // autocorrect bugs with CodeMirror 5's textarea input.
    inputStyle: isTouchDevice ? 'contenteditable' : 'textarea',
    extraKeys: {
      'Cmd-Enter': run,
      'Ctrl-Enter': run
    }
  });
  cm.setSize('100%', null);

  // iter 123: 🎹 L3 keyboard chips — wire one-tap insertion. Renders only
  // when not in Mock (chip-strip HTML is gated above) and the wrap contains
  // the [data-l3-chips] container. CodeMirror's replaceSelection inserts at
  // the active cursor or replaces the current selection — works for both
  // empty editor (insert at start) and mid-edit. focus() keeps the soft
  // keyboard visible on mobile so users don't lose context between taps.
  if (!isMock) {
    wrap.querySelectorAll('[data-l3-chips] .l3-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const token = chip.dataset.chipInsert || '';
        if (!token) return;
        cm.replaceSelection(token);
        cm.focus();
      });
      // mousedown preventDefault keeps the editor's contenteditable focus
      // instead of grabbing it onto the chip button — critical for iOS Safari
      // where the soft keyboard would otherwise dismiss between every tap.
      chip.addEventListener('mousedown', (e) => e.preventDefault());
    });
  }

  // Restore cached editor text from a prior tab visit. Skip during a mock
  // interview — mock should always start from a blank editor.
  if (!isMock) {
    const cachedCode = _cacheGet(lesson.id, 'L3');
    if (typeof cachedCode === 'string' && cachedCode.length) {
      cm.setValue(cachedCode);
    }
    // Persist every keystroke (and programmatic setValue from Clear/Reveal)
    // back to the cache so the editor survives Reference/L1/L2 round-trips.
    cm.on('change', () => {
      _cacheSet(lesson.id, 'L3', cm.getValue());
    });
  }

  const outputBox = wrap.querySelector('[data-output]');
  const feedback = wrap.querySelector('.feedback');
  const hintStack = wrap.querySelector('[data-hint-stack]');
  const hintTrendEl = wrap.querySelector('[data-hint-trend]');
  const ladder = _buildHintLadder(drill);
  let hintsUsed = 0;
  let attempts = 0;
  let running = false;

  function renderHintStack() {
    if (!hintStack) return;
    if (hintsUsed === 0) {
      hintStack.classList.add('hidden');
      hintStack.innerHTML = '';
      return;
    }
    hintStack.classList.remove('hidden');
    hintStack.innerHTML = ladder.slice(0, hintsUsed).map((tier, i) => `
      <div class="hint-tier">
        <div class="hint-tier-label">Tier ${i+1} · ${escapeHtml(tier.label)}</div>
        <div class="hint-tier-text">${escapeHtml(tier.text)}</div>
      </div>
    `).join('');
  }

  // iter 46: hint-frequency trend badge. Surfaces "you needed scaffolding
  // on N of last K attempts" so the user can see their own hint-dependency
  // trending down over SR intervals (PROFILE line 65/66 retention signal).
  // Hidden when there's no hint history for this lesson yet — no noise.
  function renderHintTrend() {
    if (!hintTrendEl) return;
    const { hinted, total } = _countHintAttempts(lesson.id, 5);
    if (total === 0) {
      hintTrendEl.classList.add('hidden');
      hintTrendEl.innerHTML = '';
      return;
    }
    hintTrendEl.classList.remove('hidden');
    // Color signal: 0/N = green (independent), N/N = amber (still leaning),
    // mid = neutral. Trending down across SR intervals is the retention win.
    const tone = hinted === 0 ? 'good' : hinted === total ? 'warn' : 'mid';
    // iter 101: per-attempt cost ribbon below the trend pill. Each attempt
    // is a colored chip (0 hints = green ✓ / 1-2 = amber / 3+ = red).
    // Quality-of-pass made visible per-attempt — the existing pill counts
    // hinted-vs-not, ribbon adds the hint-DENSITY axis.
    const perAttempt = _perAttemptHintCounts(lesson.id, 5);
    const ribbon = perAttempt.length > 0
      ? `<span class="hint-cost-ribbon" aria-label="Hint cost per recent attempt">${
          perAttempt.map(a => {
            const cls = a.hintCount === 0 ? 'hint-cost-chip-good' : a.hintCount <= 2 ? 'hint-cost-chip-mid' : 'hint-cost-chip-warn';
            const glyph = a.hintCount === 0 ? '✓' : a.hintCount <= 2 ? String(a.hintCount) : `${a.hintCount}+`;
            return `<span class="hint-cost-chip ${cls}" title="Attempt used ${a.hintCount} hint tier${a.hintCount === 1 ? '' : 's'}">${glyph}</span>`;
          }).join('')
        }</span>`
      : '';
    hintTrendEl.innerHTML = `<span class="hint-trend-pill hint-trend-${tone}">💡 Hints / scaffold used on <strong>${hinted}</strong> of last <strong>${total}</strong> attempt${total === 1 ? '' : 's'}</span>${ribbon}`;
  }
  // Show baseline on mount (so a lesson with prior hint history surfaces
  // the badge even before the user re-clicks Hint).
  renderHintTrend();

  wrap.querySelector('[data-action="run"]').addEventListener('click', run);
  // Hint / diff / reveal buttons are omitted in Mock Interview mode (isMock).
  // Each query must be null-guarded — without this guard, starting a mock
  // throws `Cannot read properties of null (reading 'addEventListener')`
  // and the entire lesson shell renders the error instead of the L3 surface.
  const hintBtn = wrap.querySelector('[data-action="hint"]');
  if (hintBtn) {
    hintBtn.addEventListener('click', () => {
      if (hintsUsed >= ladder.length) return;
      hintsUsed++;
      // iter 46: record hint event into state.history so future SR-style
      // mechanisms can surface lessons with high hint-frequency as weak
      // spots. Also retroactively closes the iter-37 hints-used metric.
      // See iter-43 SR walkthrough gap #3.
      appendHistory(lesson.id, `hint-tier-${hintsUsed}`);
      saveProgress();
      renderHintStack();
      renderHintTrend();
      if (hintsUsed >= ladder.length) {
        hintBtn.textContent = '💡 No more hints';
        hintBtn.disabled = true;
      } else {
        hintBtn.textContent = `💡 Hint (${hintsUsed}/${ladder.length})`;
      }
    });
  }
  const diffBtn = wrap.querySelector('[data-action="diff"]');
  if (diffBtn) {
    diffBtn.addEventListener('click', () => {
      const panel = wrap.querySelector('[data-diff-panel]');
      const target = wrap.querySelector('[data-diff]');
      const userLines = stripCommentsForDiff(cm.getValue());
      const canonLines = stripCommentsForDiff(drill.canonical);
      const rows = lcsDiffRows(userLines, canonLines, normalizeForDiff);
      // Header row + a (left, right) pair per diff row, laid out in a 2-col grid.
      const cells = [
        '<div class="diff-side-header">Yours</div>',
        '<div class="diff-side-header diff-side-header-right">Canonical</div>'
      ];
      for (const r of rows) {
        const leftCls = `diff-row diff-row-left diff-${r.status === 'eq' ? 'eq' : ((r.status === 'del' || r.status === 'chg') ? 'del' : 'empty')}`;
        const rightCls = `diff-row diff-row-right diff-${r.status === 'eq' ? 'eq' : ((r.status === 'add' || r.status === 'chg') ? 'add' : 'empty')}`;
        // Word-level highlight where both sides exist (eq rows too, to surface
        // internal-whitespace-only diffs the line match normalized away).
        let leftHtml, rightHtml;
        if ((r.status === 'eq' || r.status === 'chg') && r.left && r.right) {
          const w = inlineWordDiff(r.left, r.right);
          leftHtml = w.leftHtml;
          rightHtml = w.rightHtml;
        } else {
          leftHtml = escapeHtml(r.left);
          rightHtml = escapeHtml(r.right);
        }
        cells.push(`<div class="${leftCls}">${leftHtml || '&nbsp;'}</div>`);
        cells.push(`<div class="${rightCls}">${rightHtml || '&nbsp;'}</div>`);
      }
      target.innerHTML = cells.join('');
      panel.classList.remove('hidden');
    });
  }

  // "Critical lines" pre-fill — load the canonical with `criticalLines`
  // replaced by `/* ___ FILL THIS LINE ___ */` markers. User types just the
  // load-bearing lines (the algorithm's insight), not the boilerplate.
  // Hint tier; does NOT mark the lesson as revealed (no SR demote) — the
  // canonical is structurally available either way; this is just easier
  // recall scaffolding. See ideas-by-category.md § Drilling Surfaces →
  // "What's missing?" critical-line fill.
  const criticalBtn = wrap.querySelector('[data-action="critical-fill"]');
  if (criticalBtn && Array.isArray(drill.criticalLines) && drill.criticalLines.length > 0) {
    criticalBtn.addEventListener('click', () => {
      const lines = drill.canonical.split('\n');
      const blanked = lines.map((line, i) => {
        // 1-indexed match — criticalLines stores user-facing line numbers.
        if (drill.criticalLines.includes(i + 1)) {
          // Preserve leading indentation so the editor's bracket-match keeps
          // working and the line still looks "in place" structurally.
          const indent = line.match(/^\s*/)[0];
          return indent + '/* ___ FILL LINE ' + (i + 1) + ' ___ */';
        }
        return line;
      }).join('\n');
      cm.setValue(blanked);
      // iter 46: record critical-fill usage so future SR mechanisms can
      // surface lessons where the user has been relying on the scaffold.
      // See iter-43 SR walkthrough gap #3.
      appendHistory(lesson.id, 'critical-lines-used');
      saveProgress();
      renderHintTrend();
      feedback.innerHTML = `<span class="text-amber-300">🎯 Fill the ${drill.criticalLines.length} load-bearing line${drill.criticalLines.length === 1 ? '' : 's'} marked <code>/* ___ FILL ___ */</code> — that's the insight of this pattern.</span>`;
    });
  }

  const revealBtn = wrap.querySelector('[data-action="reveal"]');
  if (revealBtn) {
    revealBtn.addEventListener('click', () => {
      const due = isDueForReview(lesson.id);
      const msg = due
        ? 'Reveal the canonical solution? Your mastery dot will be marked as revealed, and your review interval will be shortened.'
        : 'Reveal the canonical solution? Your mastery dot will be marked as revealed.';
      if (!confirm(msg)) return;
      cm.setValue(drill.canonical);
      const { demoted } = markRevealed(lesson.id, 'L3');
      if (demoted) {
        feedback.innerHTML = '<span class="text-amber-400">Solution revealed.</span>' + srBadgeHtml(lesson.id, 'demote');
      } else {
        feedback.innerHTML = '<span class="text-amber-400">Solution revealed.</span>';
      }
    });
  }
  wrap.querySelector('[data-action="clear"]').addEventListener('click', () => {
    cm.setValue('');
    // Reset hint ladder so a fresh attempt starts unhinted.
    hintsUsed = 0;
    renderHintStack();
    if (hintBtn) { hintBtn.textContent = '💡 Hint'; hintBtn.disabled = false; }
  });

  async function run() {
    if (running) return;
    running = true;
    attempts++;
    const code = cm.getValue();
    feedback.innerHTML = '<span class="text-slate-500">Running…</span>';
    const result = await runCode(code, { lang: lessonLang(content) });
    running = false;
    outputBox.classList.toggle('error', !result.ok);
    outputBox.textContent = result.output || '(no output)';
    // Surface debug output (console.debug / console.info) in its own pane —
    // visible only when there's something to show. Pane is never graded.
    const debugPanel = wrap.querySelector('[data-debug-panel]');
    const debugBox = wrap.querySelector('[data-debug-box]');
    if (result.debug && result.debug.length) {
      debugBox.textContent = result.debug;
      debugPanel.classList.remove('hidden');
    } else {
      debugPanel.classList.add('hidden');
    }
    // Share capture: record the verdict AND the source. The typed code is the
    // highest-value artifact the user produces here — too big for a URL, so it
    // rides in state and in the Copy-for-AI payload (js/app/24-share.js).
    const l3Passed = result.ok && outputsMatch(result.output, drill.expectedOutput);
    recordL3Result(lesson.id, l3Passed, code);
    if (l3Passed) {
      const wasMock = state.mock.active && state.mock.lessonId === lesson.id;
      markPassed(lesson.id, 'L3');
      // iter 46: the L3-pass closed the current attempt; refresh hint trend
      // so the new attempt's hint count is reflected immediately.
      renderHintTrend();
      const tries = attempts === 1 ? 'first try' : `${attempts} tries`;
      const srBadge = srBadgeHtml(lesson.id, 'pass');
      if (wasMock) {
        // Capture priorBest BEFORE endMockInterview overwrites state.bestTimes
        // when this attempt is a new PB. Used to compute the delta line below.
        const priorBest = state.bestTimes[lesson.id];
        const elapsed = endMockInterview(true);
        let bestMsg;
        if (priorBest == null) {
          bestMsg = ' — first mock pass for this lesson';
        } else if (elapsed < priorBest) {
          bestMsg = ` — new personal best (was ${formatTime(priorBest)}, ${formatTime(priorBest - elapsed)} faster)`;
        } else if (elapsed === priorBest) {
          bestMsg = ` — matched your best (${formatTime(priorBest)})`;
        } else {
          bestMsg = ` — ${formatTime(elapsed - priorBest)} off your best (${formatTime(priorBest)})`;
        }
        // endMockInterview() above called renderLesson(), which fully replaced
        // the L3 body — the `feedback` closure variable now points at a
        // detached node. Re-acquire from the live DOM so the win line is
        // actually visible to the user.
        const liveFeedback = document.querySelector('#lesson-shell .feedback');
        if (liveFeedback) {
          // Inline "Mock another" CTA — desktop-only by PROFILE.md line 43;
          // lowers friction for the repeat-mocks PROFILE's "personal-bests
          // trend down over weeks" success criterion structurally requires.
          // Random selection is preserved here (smart-pick is queued backlog).
          liveFeedback.innerHTML = `<span class="text-emerald-400 font-medium">✓ Solved in ${formatTime(elapsed)} (${tries})${bestMsg}</span>` + srBadge +
            ` <button class="secondary" data-action="mock-again" style="margin-left:10px;font-size:12px;padding:3px 10px;">🎯 Mock another</button>`;
          const againBtn = liveFeedback.querySelector('[data-action="mock-again"]');
          if (againBtn) againBtn.addEventListener('click', () => {
            if (typeof startRandomMockInterview === 'function') startRandomMockInterview();
          });
        }
      } else {
        feedback.innerHTML = `<span class="text-emerald-400 font-medium">✓ Output matches — L3 passed (${tries}).</span>` + srBadge;
      }
    } else if (!result.ok) {
      feedback.innerHTML = '<span class="text-rose-400">Runtime error — read the output box.</span>';
    } else {
      // Heuristic hint: did the user likely break their own grade with a
      // debug `console.log`? If the expected output appears in actual but
      // grading still failed, point at debug-log interleaving as the cause.
      const expNorm = normalize(drill.expectedOutput);
      const actNorm = normalize(result.output);
      const containsExpected = expNorm.length > 0 && actNorm.includes(expNorm.split('\n').pop());
      const hint = containsExpected
        ? ' <span class="text-slate-500 text-xs">Your output contains the expected lines but they\'re interleaved with extras — replace stray <code class="mono">console.log</code>s with <code class="mono">console.debug</code> so they don\'t break the match.</span>'
        : '';
      feedback.innerHTML = '<span class="text-rose-400">Output doesn\'t match expected. Try again.</span>' + hint;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
