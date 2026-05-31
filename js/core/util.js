// Pure leaf utilities for the JS-Drill main app.
//
// Why this exists: app.js had outgrown 8.9k lines. This file holds the
// stateless helpers that have ZERO dependencies on `state`, `CURRICULUM`,
// `saveProgress`, or any other app-scoped global. They can be unit-tested
// or reused from other surfaces without dragging the whole app in.
//
// What lives here:
//   - String normalization for the grader (normalize / normalizeLines / outputsMatch)
//   - HTML escaping (escapeHtml)
//   - Diff helpers for the L3 side-by-side (stripCommentsForDiff / lcsDiffRows)
//   - Time formatting (formatTime)
//   - CodeMirror static-render helpers (colorizeInto / renderFlash)
//
// What does NOT live here: anything that reads/writes `state`, persists to
// localStorage, or fires UI re-renders. Those belong with the feature that
// owns them.
//
// To consume: include before app.js.
//   <script src="js/core/util.js"></script>
// Exposed as `window.DrillUtil`. App.js destructures at top-of-file.

(function (root) {
  'use strict';

  const U = {};

  U.escapeHtml = function (s) {
    return (s ?? '').toString()
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  U.formatTime = function (ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  U.normalize = function (s) {
    return (s ?? '').toString().trim().replace(/\r\n/g, '\n');
  };

  U.normalizeLines = function (s) {
    return U.normalize(s).split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.length > 0);
  };

  // Subsequence match: every expected line must appear in actual, in order.
  // Extra lines in actual (debug `console.log` calls the user left in) are
  // tolerated — they just don't match any expected line. Identical sequences
  // pass under subsequence too, so this is strictly more permissive than the
  // old equality check.
  U.outputsMatch = function (actual, expected) {
    const exp = U.normalizeLines(expected);
    const act = U.normalizeLines(actual);
    if (exp.length === 0) return act.length === 0;
    let i = 0;
    for (const line of act) {
      if (line === exp[i]) i++;
      if (i === exp.length) return true;
    }
    return false;
  };

  // Comment stripping for the L3 side-by-side diff. Drops block comments,
  // then line comments, then any line that's now whitespace-only — comments
  // are noise when comparing recalled code to the canonical's annotated form.
  // Naive: doesn't track string/regex literals. Safe for our canonicals (no
  // `//` inside template strings), reviewer-enforced going forward.
  U.stripCommentsForDiff = function (code) {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map(line => line.replace(/\/\/.*$/, '').replace(/\s+$/, ''))
      .filter(line => line.trim().length > 0);
  };

  // Normalize a line for diff *matching* (not display): collapse internal
  // whitespace runs to a single space and trim. Lets indentation-only and
  // brace-spacing-only differences anchor as equal, so the user's 4-space
  // recall lines up with the canonical's 2-space form. Display still uses
  // the original line.
  U.normalizeForDiff = function (line) {
    return line.replace(/\s+/g, ' ').trim();
  };

  // LCS-based line alignment for side-by-side diff. O(n*m) DP — fine for
  // snippets under a few hundred lines (our canonicals top out ~40).
  // `keyFn` (optional) maps a display line to its match key — pass
  // `normalizeForDiff` to make alignment whitespace-insensitive.
  // Returns rows of `{left, right, status: 'eq'|'del'|'add'|'chg'}`.
  // Post-pass: adjacent del/add runs are paired positionally into 'chg'
  // rows (both sides populated) so a changed line sits beside its
  // counterpart instead of producing a blank gap.
  U.lcsDiffRows = function (a, b, keyFn) {
    const ka = keyFn ? a.map(keyFn) : a;
    const kb = keyFn ? b.map(keyFn) : b;
    const n = a.length, m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = ka[i] === kb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const raw = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (ka[i] === kb[j]) { raw.push({ left: a[i], right: b[j], status: 'eq' }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { raw.push({ left: a[i], right: '', status: 'del' }); i++; }
      else { raw.push({ left: '', right: b[j], status: 'add' }); j++; }
    }
    while (i < n) raw.push({ left: a[i++], right: '', status: 'del' });
    while (j < m) raw.push({ left: '', right: b[j++], status: 'add' });

    // Pair adjacent del/add runs into side-by-side 'chg' rows.
    const rows = [];
    let k = 0;
    while (k < raw.length) {
      if (raw[k].status === 'eq') { rows.push(raw[k]); k++; continue; }
      const dels = [], adds = [];
      while (k < raw.length && raw[k].status !== 'eq') {
        if (raw[k].status === 'del') dels.push(raw[k].left);
        else adds.push(raw[k].right);
        k++;
      }
      const pairs = Math.max(dels.length, adds.length);
      for (let p = 0; p < pairs; p++) {
        const left = p < dels.length ? dels[p] : '';
        const right = p < adds.length ? adds[p] : '';
        const status = left && right ? 'chg' : (left ? 'del' : 'add');
        rows.push({ left, right, status });
      }
    }
    return rows;
  };

  // Inline word-level diff for a single side-by-side row. Tokenizes each line
  // into words / punctuation / whitespace-runs and LCS-aligns the tokens, so
  // the differing TOKENS (not the whole line) get highlighted — GitHub-style.
  // Returns `{ leftHtml, rightHtml }` with `<span>`-wrapped changed tokens.
  //
  // Whitespace policy (intentional, matches the diff's whitespace-blind match):
  //   - LEADING indent whitespace is split off and never compared/highlighted
  //     (4-space recall vs 2-space canonical shouldn't flag as a diff).
  //   - INTERNAL whitespace runs ARE tokens, so `a  b` vs `a b` highlights the
  //     extra space. (Trailing whitespace is already stripped upstream.)
  U.inlineWordDiff = function (leftLine, rightLine) {
    const splitLead = s => { const m = (s.match(/^\s*/) || [''])[0]; return [m, s.slice(m.length)]; };
    const tokenize = s => s.match(/\s+|\w+|[^\w\s]/g) || [];
    const [lLead, lRest] = splitLead(leftLine || '');
    const [rLead, rRest] = splitLead(rightLine || '');
    const lt = tokenize(lRest), rt = tokenize(rRest);
    const n = lt.length, m = rt.length;
    const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = lt[i] === rt[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const esc = U.escapeHtml;
    const wsCls = t => /^\s+$/.test(t) ? ' diff-word-ws' : '';
    const del = t => `<span class="diff-word-del${wsCls(t)}">${esc(t)}</span>`;
    const add = t => `<span class="diff-word-add${wsCls(t)}">${esc(t)}</span>`;
    const leftParts = [], rightParts = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (lt[i] === rt[j]) { leftParts.push(esc(lt[i])); rightParts.push(esc(rt[j])); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { leftParts.push(del(lt[i])); i++; }
      else { rightParts.push(add(rt[j])); j++; }
    }
    while (i < n) leftParts.push(del(lt[i++]));
    while (j < m) rightParts.push(add(rt[j++]));
    return {
      leftHtml: esc(lLead) + leftParts.join(''),
      rightHtml: esc(rLead) + rightParts.join('')
    };
  };

  // CodeMirror static-render helpers. Both depend on the runMode addon being
  // loaded (see index.html head). Fall back to plain text if CM isn't ready.
  U.colorizeInto = function (target, code, mode = 'javascript') {
    target.textContent = '';
    if (root.CodeMirror && root.CodeMirror.runMode) {
      root.CodeMirror.runMode(code, mode, target);
    } else {
      target.textContent = code;
    }
  };

  // Flash-mode render — same tokens as colorizeInto, but 1-3 "good" tokens
  // (length >= 3, alphanumeric, not a comment) are wrapped in tap-to-reveal
  // blur spans. Active-recall surface on the Reference tab: the user
  // mentally fills the blank before tapping to confirm.
  //
  // iter eval-2026-05-30 (audits/flash.md edits 1+2):
  //  - When `opts.mechanics` is a non-empty array, candidate tokens whose
  //    `.text` matches any mechanic label/id are preferred — pure shuffle
  //    falls back when no mechanic match exists.
  //  - When `opts.onRate` is a callback, each revealed blur span renders
  //    a tiny 👍/👎 chip pair after reveal; the user's tap calls
  //    `onRate('knew' | 'blanked')`. The Reference tab uses this to
  //    persist `state.flash[lessonId]` counters and flag weakness on
  //    session-threshold blanks.
  U.renderFlash = function (target, code, mode = 'javascript', opts = {}) {
    target.textContent = '';
    if (!(root.CodeMirror && root.CodeMirror.runMode)) {
      target.textContent = code;
      return;
    }
    const tokens = [];
    root.CodeMirror.runMode(code, mode, (text, style) => {
      tokens.push({ text, style });
    });
    const goodIdx = [];
    tokens.forEach((t, i) => {
      if (t.text.length < 3) return;
      if (!/[a-zA-Z0-9]{3,}/.test(t.text)) return;
      if (t.style && /^(comment)$/.test(t.style)) return;
      goodIdx.push(i);
    });
    // Mechanics-weighted selection — bias toward tokens that match the
    // lesson's idiom keywords. Mechanics often hold the load-bearing
    // method/keyword (e.g. `flatMap`, `WeakMap`, `reduce`); blurring
    // those forces recall on the idiom that gave the lesson its identity.
    let ordered = goodIdx.slice();
    const mechs = Array.isArray(opts.mechanics) ? opts.mechanics : null;
    if (mechs && mechs.length) {
      const needles = mechs.map(m => String(m || '').toLowerCase()).filter(Boolean);
      const matchScore = (idx) => {
        const t = (tokens[idx].text || '').toLowerCase();
        for (const n of needles) {
          if (n && t.includes(n)) return 1;
        }
        return 0;
      };
      const matched = ordered.filter(i => matchScore(i) === 1);
      const others = ordered.filter(i => matchScore(i) === 0);
      for (let i = matched.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [matched[i], matched[j]] = [matched[j], matched[i]];
      }
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      ordered = [...matched, ...others];
    } else {
      for (let i = ordered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      }
    }
    const n = Math.min(ordered.length, 1 + Math.floor(Math.random() * 3));
    const blurSet = new Set(ordered.slice(0, n));
    tokens.forEach((tok, i) => {
      const span = document.createElement('span');
      if (blurSet.has(i)) {
        span.className = 'flash-blur';
        span.textContent = tok.text;
        span.setAttribute('role', 'button');
        span.setAttribute('tabindex', '0');
        span.title = 'Tap to reveal';
        let rated = false;  // each blur can only be self-rated once
        const reveal = () => {
          span.classList.add('revealed');
          if (typeof opts.onRate === 'function' && !rated) {
            // Inject a tiny 👍 / 👎 chip pair right after the token.
            const chips = document.createElement('span');
            chips.className = 'flash-rate-chips';
            chips.innerHTML = '<button type="button" class="flash-rate" data-rate="knew" title="Recalled it">👍</button><button type="button" class="flash-rate" data-rate="blanked" title="Blanked — flag for review">👎</button>';
            chips.addEventListener('click', (e) => {
              const btn = e.target.closest('.flash-rate');
              if (!btn || rated) return;
              rated = true;
              const rate = btn.getAttribute('data-rate');
              chips.querySelectorAll('.flash-rate').forEach(b => { b.disabled = true; b.classList.toggle('chosen', b === btn); });
              try { opts.onRate(rate === 'knew' ? 'knew' : 'blanked'); } catch (_) { /* swallow callback errors */ }
            });
            // Insert AFTER the span so it appears inline next to the
            // newly-revealed token.
            if (span.parentNode) span.parentNode.insertBefore(chips, span.nextSibling);
          }
        };
        span.addEventListener('click', reveal);
        span.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); }
        });
      } else {
        if (tok.style) span.className = 'cm-' + tok.style.replace(/ +/g, ' cm-');
        span.textContent = tok.text;
      }
      target.appendChild(span);
    });
  };

  root.DrillUtil = U;
})(typeof window !== 'undefined' ? window : this);
