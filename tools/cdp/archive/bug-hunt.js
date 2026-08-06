#!/usr/bin/env node
// Verifies iter-73 🪲 Code Bug-Hunt at iPhone viewport: sidebar button →
// session loads a deck of patterns canonicals with one auto-mutated line
// each, rendered with line numbers + per-line tap targets. Each card's
// buggy line is verified to actually break the lesson's expectedOutput
// (the deck-builder only ships mutations that break). Tap a line → grade
// correct/wrong with line-num feedback; lifetime stats accumulate in
// state.bugHunt. First §9B (Code Evaluation Skills) surface.

const http = require('http');
const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-bug-hunt';

// Close any leftover tabs pointing at the app origin — the freeze-regression
// phase abandons a tab if the watchdog trips (same recovery pattern as
// tools/cdp/audit-nav-deeplink.js).
function closeTabsMatching(substr) {
  return new Promise(res => {
    http.get('http://localhost:9222/json', r => {
      let b = ''; r.on('data', d => b += d);
      r.on('end', () => {
        try {
          const tabs = JSON.parse(b).filter(t => t.type === 'page' && (t.url || '').includes(substr));
          let n = tabs.length;
          if (!n) return res();
          for (const t of tabs) http.get(`http://localhost:9222/json/close/${t.id}`, () => { if (--n === 0) res(); }).on('error', () => { if (--n === 0) res(); });
        } catch (_) { res(); }
      });
    }).on('error', () => res());
  });
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  let s = await connect({ url: URL, mobile: true, outDir: OUT });

  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    recognize: { attempts: 0, correct: 0 },
    rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
    warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
    speedrun: { bests: {}, sessions: 0, completions: 0, lastRunAt: 0 },
    bugHunt: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('boot');

  // ── Phase 1: sidebar button renders ───────────────────────────────────
  const btnText = await s.evalAwait(`document.getElementById('bug-hunt-btn')?.textContent`);
  console.log(btnText && btnText.includes('Bug-Hunt') ? `PASS: 🪲 Bug-Hunt button rendered (${btnText})` : `FAIL: button missing (got ${btnText})`);

  // ── Phase 2: tap button → session card eventually renders ─────────────
  await s.evalAwait(`document.getElementById('bug-hunt-btn').click()`);
  // Deck-build is expensive (preloads 16 patterns lessons + tries
  // mutators with runCode verification). Allow generous time.
  await s.sleep(12000);
  await s.snap('first-card');

  const cardRendered = await s.evalAwait(`(() => {
    const lines = document.querySelectorAll('.bug-line');
    const prompt = document.querySelector('.bug-prompt')?.textContent || '';
    return { lines: lines.length, hasPrompt: prompt.includes('Tap the buggy line') };
  })()`);
  console.log(cardRendered.lines >= 3 && cardRendered.hasPrompt ? `PASS: session card rendered (${cardRendered.lines} buggy-code lines + tap-the-buggy-line prompt)` : `FAIL: card not properly rendered (lines=${cardRendered.lines}, prompt=${cardRendered.hasPrompt})`);

  // ── Phase 3: every line has a tap target + line number ────────────────
  const lineWithNumber = await s.evalAwait(`(() => {
    const btn = document.querySelector('.bug-line');
    const num = btn?.querySelector('.bug-line-num')?.textContent;
    return num && /^\\d+$/.test(num.trim());
  })()`);
  console.log(lineWithNumber ? `PASS: line numbers rendered on tap targets` : `FAIL: no line numbers on .bug-line buttons`);

  // ── Phase 4: tap a line → grade applies (one of green/red classes
  //          appears on the tapped line and the correct-line). Walk all
  //          cards by tapping line 1 each time.
  let safety = 12;
  let firstTapGraded = false;
  while (safety-- > 0) {
    const phase = await s.evalAwait(`(() => {
      const lines = document.querySelectorAll('.bug-line');
      const summary = document.querySelector('.bug-summary');
      return { lines: lines.length, summary: !!summary };
    })()`);
    if (phase.summary) break;
    if (!phase.lines) { await s.sleep(200); continue; }
    // Tap first non-disabled line.
    await s.evalAwait(`(() => {
      const btn = document.querySelector('.bug-line:not(:disabled)');
      if (btn) btn.click();
    })()`);
    if (!firstTapGraded) {
      await s.sleep(300);
      const graded = await s.evalAwait(`!!document.querySelector('.bug-line-correct, .bug-line-wrong')`);
      console.log(graded ? `PASS: tap applies grading class to a line` : `FAIL: tap did not grade`);
      firstTapGraded = true;
    }
    await s.sleep(2000); // 900ms correct, 1700ms wrong — wait for the slower
  }
  await s.snap('summary');

  const summaryRendered = await s.evalAwait(`!!document.querySelector('.bug-summary-pct')`);
  console.log(summaryRendered ? `PASS: summary rendered after walking deck` : `FAIL: summary never appeared`);

  // ── Phase 5: state.bugHunt accumulates lifetime stats ─────────────────
  const stats = await s.evalAwait(`({
    attempts: state.bugHunt?.attempts || 0,
    sessions: state.bugHunt?.sessions || 0
  })`);
  console.log(stats.attempts >= 1 && stats.sessions >= 1 ? `PASS: state.bugHunt accumulated (${stats.attempts} attempts, ${stats.sessions} sessions)` : `FAIL: bugHunt stats not saved (attempts=${stats.attempts}, sessions=${stats.sessions})`);

  // ── Phase 6 (nav-audit P1-1 regression): cold-boot #/m/bug-hunt 10× and
  //    assert the renderer never hard-freezes. Pre-fix this froze 2/2 (a
  //    boundary-flip mutation of a two-pointer/binary-search canonical made
  //    runCode's synchronous `new Function` spin forever). Post-fix, mutants
  //    run via runCodeBudgeted (loop-iteration guard), so every boot must
  //    resolve to a Bug-Hunt card OR the in-shell empty state while the page
  //    stays responsive to a trivial eval. Watchdog + fresh-tab recovery
  //    mirror tools/cdp/audit-nav-deeplink.js.
  const BOOTS = 10;
  let freezes = 0, resolvedBoots = 0;
  for (let i = 0; i < BOOTS; i++) {
    const runOne = (async () => {
      await s.eval(`location.href = location.pathname + '#/m/bug-hunt'`);
      await s.eval(`setTimeout(() => location.reload(), 30); true`);
      await s.sleep(2000);
      await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 10000 });
      // Deck build runs async after boot dispatch — wait for a card or the
      // empty state (both render inside .bug-shell).
      await s.waitFor(`!!document.querySelector('.bug-line, [data-action="drill-empty-back"], .bug-shell .bug-summary-actions')`, { timeoutMs: 20000 });
      return s.eval(`1 + 1`); // responsiveness proof — times out if the main thread is pegged
    })();
    try {
      const two = await Promise.race([
        runOne,
        new Promise((_, rej) => setTimeout(() => rej(new Error('WATCHDOG: page unresponsive')), 26000)),
      ]);
      if (two === 2) resolvedBoots++;
    } catch (e) {
      freezes++;
      console.log(`  boot ${i + 1}/${BOOTS}: FROZE (${String(e.message).slice(0, 60)})`);
      try { await s.close(); } catch (_) {}
      await closeTabsMatching('8765');
      s = await connect({ url: URL, mobile: true, outDir: OUT });
    }
    try { await s.eval(`history.replaceState(null,'',location.pathname)`); } catch (_) {}
    process.stdout.write(`${i + 1} `);
  }
  console.log();
  console.log(freezes === 0 && resolvedBoots === BOOTS
    ? `PASS: ${resolvedBoots}/${BOOTS} cold #/m/bug-hunt boots resolved with the page responsive (0 freezes)`
    : `FAIL: freeze regression — ${freezes} frozen boots, ${resolvedBoots}/${BOOTS} resolved`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
