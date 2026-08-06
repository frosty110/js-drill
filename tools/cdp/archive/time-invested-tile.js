#!/usr/bin/env node
// iter 155 — verifies the ⏳ Time-Invested Section Ledger Stats tile.
// Walks state.history per lesson; sums consecutive-event gaps <5min (each
// capped at 5min) per lesson.section; renders top-8 sorted by ms-spent desc.
// Auto-hides when no inferable session data exists.
//
// Phases:
// 1) Clean state (no history) → no tile.
// 2) Seeded history: 3 events 1min apart on a syntax lesson → tile renders
//    with that lesson's section row and ~2min total.
// 3) Multi-section seeded history with mixed-gap durations → rows sorted
//    desc; gaps >5min excluded; section labels visible.
// 4) >8 sections seeded → top-8 truncation invariant.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-time-invested-tile';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // ── Phase 1: clean state → no tile ─────────────────────────────────────
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(800);
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(400);
  await s.snap('01-clean-state-no-tile');
  const cleanState = await s.evalAwait(`(() => {
    const modal = document.getElementById('stats-modal');
    return {
      modalOpen: modal && modal.style.display !== 'none' && modal.style.display !== '',
      tilePresent: !!document.querySelector('[data-time-invested-tile]')
    };
  })()`);
  s.assert(cleanState.modalOpen, 'Stats modal opens via #stats-btn click');
  s.assert(!cleanState.tilePresent, 'Phase 1: Clean state → tile auto-hides (no history)');
  await s.evalAwait(`document.getElementById('stats-close').click()`);
  await s.sleep(200);

  // ── Phase 2: single-section seeded with 3 tight events ────────────────
  // Pick a known syntax lesson id from the manifest. Two Sum is in
  // arrays-and-hashing patterns track — use it as the seed lesson.
  await s.evalAwait(`(() => {
    const now = Date.now();
    const M = 60 * 1000;
    state.history = {
      'two-sum': [
        { at: now - 2*M, event: 'L1-pass' },
        { at: now - 1*M, event: 'L2-pass' },
        { at: now,        event: 'L3-pass' }
      ]
    };
    saveProgress();
  })()`);
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(400);
  await s.snap('02-single-section-seeded');
  const oneSection = await s.evalAwait(`(() => {
    const tile = document.querySelector('[data-time-invested-tile]');
    if (!tile) return { tilePresent: false };
    const headerText = tile.querySelector('div')?.textContent.trim().replace(/\\s+/g, ' ') || '';
    const rows = Array.from(tile.children).slice(2); // header + blurb + rows
    return {
      tilePresent: true,
      headerText,
      rowCount: rows.length,
      firstRowText: rows[0]?.textContent.trim().replace(/\\s+/g, ' ') || ''
    };
  })()`);
  s.assert(oneSection.tilePresent, 'Phase 2: Tile RENDERS when history has session-time inferable events');
  s.assert(/top 1 section/.test(oneSection.headerText),
    `Phase 2: Header shows "top 1 section" (got "${oneSection.headerText}")`);
  s.assert(/2m total/.test(oneSection.headerText),
    `Phase 2: Header shows "2m total" (got "${oneSection.headerText}")`);
  s.assert(oneSection.rowCount === 1, `Phase 2: Exactly 1 section row (got ${oneSection.rowCount})`);
  s.assert(/Arrays.*Hashing/i.test(oneSection.firstRowText),
    `Phase 2: Row shows two-sum's section "Arrays & Hashing" (got "${oneSection.firstRowText}")`);
  s.assert(/2m/.test(oneSection.firstRowText),
    `Phase 2: Row shows 2m duration (got "${oneSection.firstRowText}")`);
  await s.evalAwait(`document.getElementById('stats-close').click()`);
  await s.sleep(200);

  // ── Phase 3: multi-section with mixed gaps ────────────────────────────
  // Lesson A (two-sum / Arrays & Hashing): 4 events 1min apart → 3m
  // Lesson B (s-let-const / Basics): 2 events 8min apart → 0 (gap too long)
  // Lesson C (s-arr-iter / Arrays): 3 events 2min apart → 4m
  // Expected order: Arrays (4m) > Arrays & Hashing (3m); Basics absent.
  await s.evalAwait(`(() => {
    const now = Date.now();
    const M = 60 * 1000;
    state.history = {
      'two-sum': [
        { at: now - 4*M, event: 'L1-pass' },
        { at: now - 3*M, event: 'L1-pass' },
        { at: now - 2*M, event: 'L2-pass' },
        { at: now - 1*M, event: 'L3-pass' }
      ],
      's-variables': [
        { at: now - 10*M, event: 'L1-pass' },
        { at: now - 2*M,  event: 'L3-pass' }
      ],
      's-arr-create': [
        { at: now - 4*M, event: 'L1-pass' },
        { at: now - 2*M, event: 'L2-pass' },
        { at: now,        event: 'L3-pass' }
      ]
    };
    saveProgress();
  })()`);
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(400);
  await s.snap('03-multi-section-mixed-gaps');
  const multi = await s.evalAwait(`(() => {
    const tile = document.querySelector('[data-time-invested-tile]');
    const allText = tile?.textContent.replace(/\\s+/g, ' ').trim() || '';
    const rows = Array.from(tile?.children || []).slice(2);
    const rowSections = rows.map(r => r.children[0]?.textContent.trim());
    return { allText, rowCount: rows.length, rowSections };
  })()`);
  // Two sections should appear (Arrays & Hashing + Arrays). Basics is excluded
  // because both events were >5min apart.
  s.assert(multi.rowCount === 2, `Phase 3: 2 section rows (got ${multi.rowCount}). Basics excluded due to >5min gap.`);
  s.assert(!/Basics/.test(multi.allText),
    `Phase 3: "Basics" section absent (its only gap exceeded 5min). Got "${multi.allText}"`);
  // s-arr-iter is in "Arrays" section (4m); two-sum in "Arrays & Hashing" (3m).
  // The first row should be the larger total.
  s.assert(multi.rowSections[0] === 'Arrays' && multi.rowSections[1] === 'Arrays & Hashing',
    `Phase 3: Rows sorted by ms-spent DESC. Expected ["Arrays", "Arrays & Hashing"], got ${JSON.stringify(multi.rowSections)}`);
  await s.evalAwait(`document.getElementById('stats-close').click()`);
  await s.sleep(200);

  // ── Phase 4: >8 sections → top-8 truncation ────────────────────────────
  // Seed 10 different lessons spanning 10 different sections, each with 2
  // events 1min apart (so each section gets ~1min). The tile should cap at 8.
  // Use a mix of known lesson ids spanning distinct sections.
  await s.evalAwait(`(() => {
    const now = Date.now();
    const M = 60 * 1000;
    // Pick 10 lessons from distinct sections via CURRICULUM lookup.
    const seen = new Set();
    const picks = [];
    for (const l of CURRICULUM) {
      if (!l.section || seen.has(l.section)) continue;
      seen.add(l.section);
      picks.push(l.id);
      if (picks.length >= 10) break;
    }
    state.history = {};
    picks.forEach((id, i) => {
      // Decreasing per-lesson session time: pick i contributes (10-i)*30s
      // so the sort order is stable.
      const seconds = (10 - i) * 30;
      state.history[id] = [
        { at: now - seconds * 1000, event: 'L1-pass' },
        { at: now,                  event: 'L3-pass' }
      ];
    });
    saveProgress();
    return picks.length;
  })()`);
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(400);
  await s.snap('04-top-8-truncation');
  const topN = await s.evalAwait(`(() => {
    const tile = document.querySelector('[data-time-invested-tile]');
    const rows = Array.from(tile?.children || []).slice(2);
    const header = tile?.querySelector('div')?.textContent.trim().replace(/\\s+/g, ' ') || '';
    return { rowCount: rows.length, header };
  })()`);
  s.assert(topN.rowCount === 8, `Phase 4: Tile capped at top-8 even with 10 seeded sections (got ${topN.rowCount})`);
  s.assert(/top 8 sections/.test(topN.header),
    `Phase 4: Header shows "top 8 sections" (got "${topN.header}")`);
  await s.evalAwait(`document.getElementById('stats-close').click()`);
  await s.sleep(200);

  await s.close();
  const r = s.report();
  process.exit(r.failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
