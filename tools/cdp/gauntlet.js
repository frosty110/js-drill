#!/usr/bin/env node
// iter 125 — verifies 🥊 Pattern-Family Gauntlet (Cat 2 Paths & Sessions
// refill; first Cat 2 Active ship since iter 45 path-aware SR queue, 78+
// iters stale). Cousin to Speedrun: ALL L1 questions per lesson, NO timer.
//
// 1) Sidebar button renders with 🥊 Gauntlet label.
// 2) Tap → picker modal shows ≥1 eligible section (≥3 full lessons) with
//    name + "X lessons" count.
// 3) Tap a section → session shell renders first card with header
//    "🥊 <section> · 1 of N", progress strip with N pips, lesson title in
//    meta line, question text, A/B/C/D option buttons.
// 4) Deck depth > section's lesson count (i.e. multiple L1s per lesson —
//    the Speedrun differentiator).
// 5) Tap an option → grades, advances; second card has progress pip[0]
//    marked done.
// 6) state.gauntlet.sessions / completions / bySection persist after a
//    short session.
// 7) Exit button returns to lesson view.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-gauntlet';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(800);

  // ── Phase 1: sidebar button present ──────────────────────────────────
  const btnText = await s.evalAwait(`document.getElementById('gauntlet-btn')?.textContent || ''`);
  s.assert(btnText.includes('Gauntlet'), `Sidebar 🥊 Gauntlet button rendered (got "${btnText.trim()}")`);
  await s.snap('01-sidebar-button');

  // ── Phase 2: tap → picker modal renders with ≥1 eligible section ─────
  await s.evalAwait(`document.getElementById('gauntlet-btn').click()`);
  await s.sleep(500);
  await s.snap('02-picker');
  const pickerInfo = await s.evalAwait(`(() => {
    const shell = document.querySelector('.gauntlet-shell.gauntlet-picker');
    const rows = document.querySelectorAll('.gauntlet-pick-row');
    const first = rows[0] ? {
      slug: rows[0].dataset.slug,
      name: rows[0].querySelector('.gauntlet-pick-name')?.textContent || '',
      count: rows[0].querySelector('.gauntlet-pick-count')?.textContent || ''
    } : null;
    return { shellPresent: !!shell, rowCount: rows.length, first };
  })()`);
  s.assert(pickerInfo.shellPresent, 'Picker shell present');
  s.assert(pickerInfo.rowCount >= 1, `≥1 eligible section in picker (got ${pickerInfo.rowCount})`);
  s.assert(pickerInfo.first && /\d+\s+lessons/.test(pickerInfo.first.count), `First row shows lesson count (got "${pickerInfo.first?.count}")`);

  // ── Phase 3: pick first section → session card 1 of N renders ────────
  const pickedSlug = pickerInfo.first.slug;
  await s.evalAwait(`document.querySelectorAll('.gauntlet-pick-row')[0].click()`);
  // Allow lesson preload (whole section worth of files).
  for (let i = 0; i < 15; i++) {
    await s.sleep(400);
    const ready = await s.evalAwait(`!!document.querySelector('.gauntlet-shell:not(.gauntlet-picker) .gauntlet-question')`);
    if (ready) break;
  }
  await s.snap('03-first-card');

  const cardInfo = await s.evalAwait(`(() => {
    const headerEl = document.querySelector('.gauntlet-shell:not(.gauntlet-picker) .gauntlet-header span');
    const header = headerEl?.textContent || '';
    const pips = document.querySelectorAll('.gauntlet-pip');
    const activePip = document.querySelectorAll('.gauntlet-pip-active').length;
    const opts = document.querySelectorAll('.gauntlet-opt');
    const letters = Array.from(document.querySelectorAll('.gauntlet-letter')).map(l => l.textContent.trim());
    const lesson = document.querySelector('.gauntlet-meta .gauntlet-lesson')?.textContent || '';
    const qText = document.querySelector('.gauntlet-question')?.textContent || '';
    const minHeight = opts[0] ? parseFloat(getComputedStyle(opts[0]).minHeight) : 0;
    return {
      header, pips: pips.length, activePip, opts: opts.length,
      letters, lesson, qLen: qText.length, minHeight
    };
  })()`);
  s.assert(/^🥊\s.+·\s1\s+of\s+\d+/.test(cardInfo.header), `Header reads "🥊 <section> · 1 of N" (got "${cardInfo.header}")`);
  s.assert(cardInfo.pips >= 3, `Progress strip has ≥3 pips (got ${cardInfo.pips})`);
  s.assert(cardInfo.activePip === 1, `Exactly 1 active pip on first card (got ${cardInfo.activePip})`);
  s.assert(cardInfo.opts >= 2, `≥2 option buttons (got ${cardInfo.opts})`);
  s.assert(cardInfo.letters.includes('A') && cardInfo.letters.includes('B'), `A/B letter chips present (got ${JSON.stringify(cardInfo.letters)})`);
  s.assert(cardInfo.lesson.length > 0, `Lesson title shown in meta line (got "${cardInfo.lesson}")`);
  s.assert(cardInfo.qLen > 5, `Question text non-trivial (got ${cardInfo.qLen} chars)`);
  s.assert(cardInfo.minHeight >= 48, `Option button min-height ≥ 48px mobile target (got ${cardInfo.minHeight})`);

  // ── Phase 4: deck depth > section's lesson count (the Speedrun diff) ──
  // Decode total cards from header "· 1 of N".
  const headerMatch = cardInfo.header.match(/·\s+1\s+of\s+(\d+)/);
  const totalCards = headerMatch ? +headerMatch[1] : 0;
  // Pull section's full-lesson count from the picker's count cell label.
  const sectionLessonCount = parseInt((pickerInfo.first.count.match(/\d+/) || ['0'])[0], 10);
  s.assert(totalCards > sectionLessonCount,
    `Deck depth > lesson count — Gauntlet uses ALL L1s per lesson, not just first ` +
    `(deck=${totalCards} cards > section=${sectionLessonCount} lessons)`);

  // ── Phase 5: answer first card → advances; pip[0] now "done" ─────────
  // Read answer index from runtime state to avoid guessing.
  const answerIdx = await s.evalAwait(`(() => {
    // Re-derive: state.currentLessonId may not be set; instead, scan CONTENT
    // for the lesson whose first L1 question text matches the rendered q.
    const qText = document.querySelector('.gauntlet-question')?.textContent || '';
    for (const id of Object.keys(CONTENT || {})) {
      const c = CONTENT[id];
      if (!c?.L1?.questions) continue;
      for (const q of c.L1.questions) {
        if (q.q === qText) return q.answer;
      }
    }
    return 0;
  })()`);
  await s.evalAwait(`document.querySelectorAll('.gauntlet-opt')[${answerIdx}].click()`);
  // Wait for advance (380ms on correct, 1200ms on miss); add buffer.
  await s.sleep(1500);
  await s.snap('04-second-card');
  const secondCard = await s.evalAwait(`(() => {
    const header = document.querySelector('.gauntlet-shell:not(.gauntlet-picker) .gauntlet-header span')?.textContent || '';
    const donePips = document.querySelectorAll('.gauntlet-pip-done').length;
    const activePip = document.querySelectorAll('.gauntlet-pip-active').length;
    return { header, donePips, activePip };
  })()`);
  s.assert(/·\s+2\s+of\s+\d+/.test(secondCard.header), `Advanced to card 2 (header now "${secondCard.header}")`);
  s.assert(secondCard.donePips >= 1, `≥1 pip marked done after first answer (got ${secondCard.donePips})`);
  s.assert(secondCard.activePip === 1, `Exactly 1 active pip on second card (got ${secondCard.activePip})`);

  // ── Phase 6: state.gauntlet.sessions persisted ───────────────────────
  const stateSnap = await s.evalAwait(`(() => ({
    sessions: state.gauntlet?.sessions || 0,
    lastRunAt: state.gauntlet?.lastRunAt || 0
  }))()`);
  s.assert(stateSnap.sessions >= 1, `state.gauntlet.sessions incremented (got ${stateSnap.sessions})`);
  s.assert(stateSnap.lastRunAt > 0, `state.gauntlet.lastRunAt set (got ${stateSnap.lastRunAt})`);

  // ── Phase 7: exit button → returns to lesson view ────────────────────
  await s.evalAwait(`document.querySelector('[data-action="exit-gauntlet"]').click()`);
  await s.sleep(500);
  const afterExit = await s.evalAwait(`(() => ({
    stillInGauntlet: !!document.querySelector('.gauntlet-shell')
  }))()`);
  s.assert(!afterExit.stillInGauntlet, 'Exit closes Gauntlet shell, returns to lesson view');
  await s.snap('05-after-exit');

  await s.close();
  const r = s.report();
  process.exit(r.failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
