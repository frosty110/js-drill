#!/usr/bin/env node
// Verifies iter-107 ⏱ Session Heatstrip at iPhone viewport.
// Seeds state.history with a SHAPED event sequence containing a deliberate
// >10-min idle gap so the session-boundary logic gets exercised:
//   PRE-GAP (should be EXCLUDED from session summary):
//   - now-22min: L1-pass on two-sum
//   - now-18min: L1-miss + L1-pass + L3-pass on p-anagrams (same cell —
//                tests dominant-event priority — L3 should win)
//   ──── 13-min idle gap (>10 min boundary) ────
//   POST-GAP (should be the WHOLE session):
//   - now-5min: L2-pass on p-valid-anagram
//   - now-2min: L3-pass on two-sum
//   - now-0min: L1-pass on p-anagrams
// Asserts:
//   1. _heatstripCells returns 30 cells; cell-22 = l1-pass, cell-18 =
//      l3-pass (priority wins, count=3), cell-5 = l2-pass, cell-2 =
//      l3-pass, cell-0 = l1-pass.
//   2. Strip wrap is visible (hasActivity=true) and renders 30 DOM cells.
//   3. _heatstripSessionSummary: post-gap-only — minActive ≈ 5,
//      lessonsTouched = 3, passes = 3, missCount = 0, eventCount = 3.
//   4. Tap on the wrap opens the modal; modal text contains "5 minutes" +
//      "3 lessons" + "3 passes".
//   5. Empty-state — history wiped → strip hides.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-heatstrip';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  const MIN = 60000;
  const now = Date.now();
  // Seed events. Minute offsets are chosen so adjacent minutes don't collide
  // — minute-grain bucketing rounds DOWN, so an event at now-(N*60_000 - 1ms)
  // would fall into cell N-1. Use exact minute boundaries minus 5 sec safety.
  const at = (m) => now - m * MIN - 5000;
  const historySeed = {
    'two-sum': [
      // PRE-gap
      { at: at(22), event: 'L1-pass' },
      // POST-gap
      { at: at(2),  event: 'L3-pass' }
    ],
    'p-anagrams': [
      // PRE-gap: same minute cluster — tests dominant priority within cell
      { at: at(18) + 100, event: 'L1-miss' },
      { at: at(18) + 200, event: 'L1-pass' },
      { at: at(18) + 300, event: 'L3-pass' },  // L3 wins
      // POST-gap, ~now
      { at: at(0) - 1000, event: 'L1-pass' }
    ],
    'p-valid-anagram': [
      // POST-gap: first event of the active session
      { at: at(5), event: 'L2-pass' }
    ]
  };

  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {
      'two-sum':         { L1: 'passed', L3: 'passed' },
      'p-anagrams':      { L1: 'passed', L3: 'passed' },
      'p-valid-anagram': { L2: 'passed' }
    },
    bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, misses: {},
    history: ${JSON.stringify(historySeed)},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    speedrun: { bests: {}, sessions: 0, completions: 0, lastRunAt: 0 },
    bugHunt: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    crystal: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    claim: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    gotcha: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    swapBench: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    convDrill: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    traceHop: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    notesDrill: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    mechConstellation: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    reverseWalk: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    notesLocate: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(800);
  await s.snap('boot');

  // ── Phase 1: _heatstripCells returns expected per-cell kinds ───────────
  const cells = await s.evalAwait(`(() => {
    if (typeof _heatstripCells !== 'function') return null;
    const arr = _heatstripCells(30);
    // Encode just kind by minutesAgo for inspection (sorted oldest-first).
    return arr.map(c => ({ m: c.minutesAgo, k: c.kind, count: c.count }));
  })()`);
  const cellAt = (m) => cells && cells.find(c => c.m === m);
  const c22 = cellAt(22), c18 = cellAt(18), c5 = cellAt(5), c2 = cellAt(2), c0 = cellAt(0);
  const phase1ok = cells && cells.length === 30
    && c22 && c22.k === 'l1-pass'
    && c18 && c18.k === 'l3-pass' && c18.count === 3  // priority wins; count = all 3 events
    && c5  && c5.k === 'l2-pass'
    && c2  && c2.k === 'l3-pass'
    && c0  && c0.k === 'l1-pass';
  console.log(phase1ok
    ? `PASS: _heatstripCells — 30 cells; m22=l1-pass, m18=l3-pass(3 events; L3 wins), m5=l2-pass, m2=l3-pass, m0=l1-pass`
    : `FAIL: cell shape (cells.length=${cells && cells.length}, m22=${JSON.stringify(c22)}, m18=${JSON.stringify(c18)}, m5=${JSON.stringify(c5)}, m2=${JSON.stringify(c2)}, m0=${JSON.stringify(c0)})`);

  // ── Phase 2: strip wrap visible + 30 DOM cells rendered ────────────────
  const dom = await s.evalAwait(`(() => {
    const wrap = document.getElementById('heatstrip-wrap');
    const grid = document.getElementById('heatstrip');
    return {
      wrapHidden: wrap.hidden,
      cellCount: grid.querySelectorAll('.heatstrip-cell').length,
      domKinds: Array.from(grid.querySelectorAll('.heatstrip-cell')).map(el => {
        const cls = el.className.split(' ').filter(c => c.startsWith('l') || c === 'idle' || c === 'other');
        return cls[0] || 'unknown';
      })
    };
  })()`);
  // DOM order: oldest minute first (idx 0 = 29 min ago) → newest last (idx 29 = 0 min).
  // m22 at idx 7 (29-22), m18 at 11, m5 at 24, m2 at 27, m0 at 29.
  const phase2ok = !dom.wrapHidden && dom.cellCount === 30
    && dom.domKinds[7]  === 'l1-pass'
    && dom.domKinds[11] === 'l3-pass'
    && dom.domKinds[24] === 'l2-pass'
    && dom.domKinds[27] === 'l3-pass'
    && dom.domKinds[29] === 'l1-pass';
  console.log(phase2ok
    ? `PASS: DOM strip visible + 30 cells; idx 7/11/24/27/29 match seed (l1-pass/l3-pass/l2-pass/l3-pass/l1-pass)`
    : `FAIL: DOM (wrapHidden=${dom.wrapHidden}, cellCount=${dom.cellCount}, kinds[7,11,24,27,29]=${[dom.domKinds[7],dom.domKinds[11],dom.domKinds[24],dom.domKinds[27],dom.domKinds[29]].join(',')})`);

  // ── Phase 3: _heatstripSessionSummary — 13-min gap isolates post-gap events ─
  const sum = await s.evalAwait(`_heatstripSessionSummary()`);
  // Post-gap session = events at 5/2/0 min ago: p-valid-anagram L2-pass,
  // two-sum L3-pass, p-anagrams L1-pass. 3 lessons, 3 passes, 0 misses, ~5 min.
  const phase3ok = sum && sum.lessonsTouched === 3 && sum.passes === 3 && sum.missCount === 0
    && sum.eventCount === 3 && sum.minActive >= 4 && sum.minActive <= 6;
  console.log(phase3ok
    ? `PASS: session summary — minActive=${sum.minActive}, lessonsTouched=3, passes=3, missCount=0, eventCount=3 (>10-min gap correctly isolates post-gap events)`
    : `FAIL: session summary (got ${JSON.stringify(sum)})`);

  // ── Phase 4: tap → modal opens with the expected facts ─────────────────
  await s.evalAwait(`document.getElementById('heatstrip-wrap').click()`);
  await s.sleep(400);
  await s.snap('modal-open');
  const modal = await s.evalAwait(`(() => {
    const m = document.getElementById('heatstrip-modal');
    const body = document.getElementById('heatstrip-modal-body');
    return {
      visible: m.style.display === 'block',
      bodyText: body.textContent
    };
  })()`);
  const phase4ok = modal.visible
    && /\b[456]\s*minutes\b/.test(modal.bodyText)
    && /3\s*lessons/.test(modal.bodyText)
    && /3\s*passes/.test(modal.bodyText);
  console.log(phase4ok
    ? `PASS: tap opens modal; body shows "${(modal.bodyText.match(/\b[456]\s*minutes\b/)||[''])[0]}" + 3 lessons + 3 passes`
    : `FAIL: modal (visible=${modal.visible}, bodyText="${modal.bodyText.replace(/\s+/g, ' ').trim()}")`);
  // Close.
  await s.evalAwait(`document.getElementById('heatstrip-close').click()`);
  await s.sleep(200);

  // ── Phase 5: empty-state — wipe history, strip auto-hides ──────────────
  await s.evalAwait(`(() => {
    state.history = {};
    saveProgress();
    renderHeatstrip();
  })()`);
  await s.sleep(300);
  const empty = await s.evalAwait(`(() => {
    const wrap = document.getElementById('heatstrip-wrap');
    return { hidden: wrap.hidden };
  })()`);
  console.log(empty.hidden
    ? `PASS: heatstrip auto-hides when no recent activity (empty-state)`
    : `FAIL: empty-state leak (wrap.hidden=${empty.hidden})`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
