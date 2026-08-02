// ============================================================================
//  js/sharecode.js — the share-code codec
// ============================================================================
// A share code is a compact, human-readable, POSITIONAL record of how a user
// answered one drillable unit. One character per question, in AUTHORED order.
// It is the payload of every shareable URL in this project:
//
//     https://frosty110.github.io/js-drill/p/two-sum?s=AbbCdAbC.Yn.n
//     https://frosty110.github.io/js-drill/sd/design-problems/p01?s=YppnY-YnYY
//
// WHY POSITIONAL. Authored question order never changes (adding a question
// appends; reordering is a content bug the validator catches). So position N
// in the code IS question N on the page. No ids, no lookup table, no server.
//
// WHY SELF-DESCRIBING. Each character encodes BOTH the response and its
// correctness, so a decoder needs no schema — not even to know whether the
// question was multiple-choice or self-graded. That is what lets an AI agent
// decode a code it was handed by reading nothing but the legend printed on
// the page.
//
//   A B C D E F G H   multiple choice — picked this option, CORRECT
//   a b c d e f g h   multiple choice — picked this option, WRONG
//   Y                 open / typed / fill-in — got it
//   p                 open — partial credit (system-design self-grade)
//   n                 open / typed / fill-in — missed
//   -                 not attempted
//
//   Case carries correctness: UPPERCASE = credit, lowercase = no credit.
//
// The letter is the AUTHORED option index (A = options[0]), never the shuffled
// display position the user saw — the app reshuffles options every session, so
// display position is meaningless the moment the URL leaves the page.
//
// GRAMMAR
//
//   code     := segment ( "." segment )*        levels, fixed count per kind
//   session  := entry ( "," entry )*
//   entry    := id ":" code
//
//   Coding lessons always emit exactly 3 segments — L1.L2.L3 — even when a
//   segment is empty (a lesson with no L2 exercises encodes as "AbC..Y").
//   The fixed arity is what keeps level parsing positional.
//
//   System-design units emit exactly 1 segment (a flat question list).
//
// NON-GOALS. No compression, no checksum, no version prefix. The code is meant
// to be read by a human at a glance and by an agent without a decoder library;
// every byte spent on machine ceremony costs that. Forward compatibility comes
// from the character table being append-only and from unknown characters
// decoding to a defined `unknown` kind rather than throwing.
//
// Loaded as a plain <script> by index.html / system-design.html / every
// generated static page (exposes window.DrillShare), and require()d by
// tools/build-share-pages.js + tools/test-sharecode.js under Node.
// ============================================================================

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DrillShare = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ── Character table ───────────────────────────────────────────────────────
  // MC letters stop at H (8 options). Nothing in the corpus exceeds 4, and the
  // ceiling keeps the MC range clear of the graded characters Y / p / n.
  const MC_MAX_OPTIONS = 8;
  const MC_UPPER = 'ABCDEFGH';
  const MC_LOWER = 'abcdefgh';

  const UNATTEMPTED = '-';
  const GOT_IT = 'Y';
  const PARTIAL = 'p';
  const MISSED = 'n';

  const LEVEL_SEP = '.';
  const ENTRY_SEP = ',';
  const ID_SEP = ':';

  // Fixed segment arity per unit kind — the reason level parsing is positional.
  const LEVELS = { lesson: ['L1', 'L2', 'L3'], unit: ['Q'] };

  // Printed verbatim on every generated page. An agent reads this table off
  // the page and decodes the ?s= it was handed. Keep it short enough to stay
  // readable and complete enough to need no prose.
  const LEGEND = [
    { chars: 'A B C D', meaning: 'multiple choice — picked this option, correct' },
    { chars: 'a b c d', meaning: 'multiple choice — picked this option, wrong' },
    { chars: 'Y', meaning: 'open / typed / fill-in — got it' },
    { chars: 'p', meaning: 'open — partial credit' },
    { chars: 'n', meaning: 'open / typed / fill-in — missed' },
    { chars: '-', meaning: 'not attempted' }
  ];

  const LEGEND_TEXT = [
    'One character per question, in the order the questions appear on this page.',
    'Uppercase means credit, lowercase means no credit.',
    ...LEGEND.map(l => `  ${l.chars.padEnd(9)} ${l.meaning}`),
    "Segments are separated by '.' — for a coding lesson they are always L1.L2.L3.",
    'The letter is the option index on this page (A = the first option listed).'
  ].join('\n');

  // ── Encoding ──────────────────────────────────────────────────────────────

  // A multiple-choice answer. `picked` and `correct` are AUTHORED option
  // indices. A null/undefined pick encodes as unattempted.
  function encodeMc(picked, correct) {
    if (picked == null || picked < 0) return UNATTEMPTED;
    if (picked >= MC_MAX_OPTIONS) return UNATTEMPTED; // out of alphabet — record nothing rather than lie
    return picked === correct ? MC_UPPER[picked] : MC_LOWER[picked];
  }

  // A self-graded or pass/fail answer. Accepts the system-design vocabulary
  // ('good' | 'partial' | 'again'), a boolean, or null.
  function encodeGraded(outcome) {
    if (outcome === true || outcome === 'good') return GOT_IT;
    if (outcome === 'partial') return PARTIAL;
    if (outcome === false || outcome === 'again' || outcome === 'missed') return MISSED;
    return UNATTEMPTED;
  }

  // Encode one level's worth of answers. `items` is an array whose entries are
  // either {picked, correct} (multiple choice) or a graded value.
  function encodeSegment(items) {
    if (!Array.isArray(items)) return '';
    return items.map(item => {
      if (item && typeof item === 'object' && 'picked' in item) return encodeMc(item.picked, item.correct);
      return encodeGraded(item);
    }).join('');
  }

  // Encode a coding lesson: always three dot-separated segments.
  //   encodeLesson({ L1: [{picked:0,correct:0}, …], L2: [true,false], L3: true })
  function encodeLesson(levels) {
    const src = levels || {};
    return LEVELS.lesson.map(k => encodeSegment(src[k])).join(LEVEL_SEP);
  }

  // Encode a system-design unit: one flat segment.
  function encodeUnit(items) {
    return encodeSegment(items);
  }

  // Encode several units into one session code: `id:code,id:code`.
  function encodeSession(entries) {
    if (!Array.isArray(entries)) return '';
    return entries
      .filter(e => e && e.id && e.code)
      .map(e => `${e.id}${ID_SEP}${e.code}`)
      .join(ENTRY_SEP);
  }

  // ── Decoding ──────────────────────────────────────────────────────────────

  // Decode a single character into a fully described answer. The character
  // alone determines the kind — that is the property that lets an agent decode
  // without a schema.
  function decodeChar(ch) {
    if (ch === UNATTEMPTED) return { char: ch, kind: 'unattempted', attempted: false, credit: null, picked: null };
    if (ch === GOT_IT) return { char: ch, kind: 'graded', attempted: true, credit: 'full', picked: null, outcome: 'good' };
    if (ch === PARTIAL) return { char: ch, kind: 'graded', attempted: true, credit: 'partial', picked: null, outcome: 'partial' };
    if (ch === MISSED) return { char: ch, kind: 'graded', attempted: true, credit: 'none', picked: null, outcome: 'again' };
    let picked = MC_UPPER.indexOf(ch);
    if (picked >= 0) return { char: ch, kind: 'mc', attempted: true, credit: 'full', picked, outcome: 'good' };
    picked = MC_LOWER.indexOf(ch);
    if (picked >= 0) return { char: ch, kind: 'mc', attempted: true, credit: 'none', picked, outcome: 'again' };
    return { char: ch, kind: 'unknown', attempted: false, credit: null, picked: null };
  }

  function decodeSegment(segment) {
    return String(segment || '').split('').map(decodeChar);
  }

  // Decode a coding-lesson code into named levels. Missing trailing segments
  // decode as empty arrays, so a truncated code degrades instead of throwing.
  function decodeLesson(code) {
    const parts = String(code || '').split(LEVEL_SEP);
    const out = {};
    LEVELS.lesson.forEach((k, i) => { out[k] = decodeSegment(parts[i]); });
    return out;
  }

  function decodeUnit(code) {
    return decodeSegment(String(code || '').split(LEVEL_SEP)[0]);
  }

  function decodeSession(str) {
    return String(str || '')
      .split(ENTRY_SEP)
      .map(chunk => chunk.trim())
      .filter(Boolean)
      .map(chunk => {
        const at = chunk.indexOf(ID_SEP);
        if (at < 0) return { id: chunk, code: '' };
        return { id: chunk.slice(0, at), code: chunk.slice(at + 1) };
      })
      .filter(e => e.id);
  }

  // True when `str` is a session code (`id:code,…`) rather than a bare code.
  function isSession(str) {
    return String(str || '').includes(ID_SEP);
  }

  // ── Validation + summary ──────────────────────────────────────────────────

  const CODE_RE = /^[A-Ha-hYpn.\-]*$/;
  const SESSION_RE = /^[A-Za-z0-9_.:,\-]*$/;

  function isValidCode(str) {
    return CODE_RE.test(String(str || ''));
  }

  // A share param is safe to act on when it is a plain code or a session of
  // plain codes. Anything else came from somewhere we don't control.
  function isValidShareParam(str) {
    const s = String(str || '');
    if (s.length > 4096) return false;
    if (!isSession(s)) return isValidCode(s);
    if (!SESSION_RE.test(s)) return false;
    return decodeSession(s).every(e => /^[a-zA-Z0-9_\-/]+$/.test(e.id) && isValidCode(e.code));
  }

  // Roll a decoded list up into the numbers a summary line needs.
  function summarize(decoded) {
    const items = Array.isArray(decoded) ? decoded : [];
    const s = { total: items.length, attempted: 0, full: 0, partial: 0, missed: 0, unattempted: 0 };
    for (const d of items) {
      if (!d.attempted) { s.unattempted++; continue; }
      s.attempted++;
      if (d.credit === 'full') s.full++;
      else if (d.credit === 'partial') s.partial++;
      else s.missed++;
    }
    s.score = s.attempted ? Math.round((s.full / s.attempted) * 100) : 0;
    return s;
  }

  // Flatten a decoded lesson (all three levels) for a whole-lesson summary.
  function flattenLesson(decodedLesson) {
    return LEVELS.lesson.reduce((acc, k) => acc.concat(decodedLesson[k] || []), []);
  }

  // ── URL helpers ───────────────────────────────────────────────────────────
  // Kept here rather than in routes.js because reading `?s=` is the one thing
  // every consumer does, including the generated static pages (which load this
  // file alone).

  const PARAM = 's';

  function readShareParam(search) {
    const q = String(search == null ? (typeof location !== 'undefined' ? location.search : '') : search);
    const m = q.replace(/^\?/, '').split('&').map(p => p.split('=')).find(p => decodeURIComponent(p[0]) === PARAM);
    if (!m || m[1] == null) return null;
    let raw;
    try { raw = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim(); } catch (_) { return null; }
    if (!raw || !isValidShareParam(raw)) return null;
    return raw;
  }

  function withShareParam(url, code) {
    if (!code) return url;
    const sep = url.includes('?') ? '&' : '?';
    // The alphabet is entirely URL-safe; encodeURIComponent would only turn
    // the readable ':' and ',' of a session code into %3A / %2C noise.
    return `${url}${sep}${PARAM}=${code}`;
  }

  return {
    // constants
    MC_MAX_OPTIONS, MC_UPPER, MC_LOWER,
    UNATTEMPTED, GOT_IT, PARTIAL, MISSED,
    LEVEL_SEP, ENTRY_SEP, ID_SEP, LEVELS, PARAM,
    LEGEND, LEGEND_TEXT,
    // encode
    encodeMc, encodeGraded, encodeSegment, encodeLesson, encodeUnit, encodeSession,
    // decode
    decodeChar, decodeSegment, decodeLesson, decodeUnit, decodeSession, isSession,
    // validate + summarize
    isValidCode, isValidShareParam, summarize, flattenLesson,
    // url
    readShareParam, withShareParam
  };
});
