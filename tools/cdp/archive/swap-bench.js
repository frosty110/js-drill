#!/usr/bin/env node
// Verifies iter-86 🔀 Swap-Bench at iPhone viewport: sidebar button →
// session shows two stacked snippets + 2 buttons; tap-grade locks options
// and reveals explain; lifetime stats accumulate.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-swap';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

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
    crystal: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    claim: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    gotcha: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    swapBench: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('boot');

  // ── Phase 1: button renders ───────────────────────────────────────────
  const btn = await s.evalAwait(`document.getElementById('swap-btn')?.textContent || ''`);
  console.log(btn.includes('Swap') ? `PASS: 🔀 Swap button rendered (${btn.trim()})` : `FAIL: button missing (got "${btn}")`);

  // ── Phase 2: tap → session opens with 2 snippets stacked + 2 buttons ─
  await s.evalAwait(`document.getElementById('swap-btn').click()`);
  await s.sleep(1200); // fetch idiom-pairs.json
  await s.snap('first-card');

  const card = await s.evalAwait(`(() => {
    const snippets = document.querySelectorAll('.swap-snippet').length;
    const codeA = document.querySelector('[data-swap-a]')?.textContent || '';
    const codeB = document.querySelector('[data-swap-b]')?.textContent || '';
    const opts = document.querySelectorAll('.swap-opt').length;
    const divider = !!document.querySelector('.swap-divider');
    const title = document.querySelector('.swap-title')?.textContent || '';
    const reveal = !!document.querySelector('.swap-reveal');
    return { snippets, codeALen: codeA.length, codeBLen: codeB.length, opts, divider, title, reveal };
  })()`);
  const phase2OK = card.snippets === 2 && card.codeALen > 5 && card.codeBLen > 5 && card.opts === 2 && card.divider && card.title.length > 0 && !card.reveal;
  console.log(phase2OK
    ? `PASS: session shows 2 stacked snippets (A=${card.codeALen} B=${card.codeBLen} chars) + 2 buttons + "${card.title.slice(0,30)}..." divider+`
    : `FAIL: card state (snippets=${card.snippets}, A=${card.codeALen}, B=${card.codeBLen}, opts=${card.opts}, divider=${card.divider}, title="${card.title}", reveal=${card.reveal})`);

  // ── Phase 3: stacked layout fits in mobile viewport (no horizontal scroll) ──
  const layout = await s.evalAwait(`(() => {
    const pair = document.querySelector('.swap-pair');
    if (!pair) return { dir: 'missing', overflow: false };
    const style = getComputedStyle(pair);
    const dir = style.flexDirection;
    const docW = document.documentElement.clientWidth;
    const pairW = pair.scrollWidth;
    return { dir, docW, pairW, overflow: pairW > docW + 5 };
  })()`);
  console.log(layout.dir === 'column' && !layout.overflow
    ? `PASS: .swap-pair stacks vertically (flex-direction=${layout.dir}, ${layout.pairW}px ≤ viewport ${layout.docW}px)`
    : `FAIL: layout issue (dir=${layout.dir}, pairW=${layout.pairW}, docW=${layout.docW}, overflow=${layout.overflow})`);

  // ── Phase 4: tap an option → reveal appears with explain + next button ──
  await s.evalAwait(`document.querySelector('.swap-opt[data-pick="same"]').click()`);
  await s.sleep(250);
  const afterTap = await s.evalAwait(`(() => {
    const reveal = document.querySelector('.swap-reveal');
    const verdict = document.querySelector('.swap-verdict')?.textContent || '';
    const explain = document.querySelector('.swap-explain')?.textContent || '';
    const nextBtn = document.querySelector('[data-action="swap-next"]');
    const optsDisabled = Array.from(document.querySelectorAll('.swap-opt')).every(b => b.disabled);
    return { reveal: !!reveal, verdictLen: verdict.length, explainLen: explain.length, hasNext: !!nextBtn, optsDisabled };
  })()`);
  const phase4OK = afterTap.reveal && afterTap.verdictLen > 0 && afterTap.explainLen > 10 && afterTap.hasNext && afterTap.optsDisabled;
  console.log(phase4OK
    ? `PASS: tap revealed verdict (${afterTap.verdictLen} chars) + explain (${afterTap.explainLen} chars) + next button; both options locked`
    : `FAIL: reveal flow (reveal=${afterTap.reveal}, verdict=${afterTap.verdictLen}, explain=${afterTap.explainLen}, next=${afterTap.hasNext}, disabled=${afterTap.optsDisabled})`);

  // ── Phase 5: state.swapBench.attempts incremented ────────────────────
  let attempts = 0;
  for (let i = 0; i < 20; i++) {
    attempts = await s.evalAwait(`state.swapBench?.attempts || 0`);
    if (attempts >= 1) break;
    await s.sleep(150);
  }
  console.log(attempts >= 1 ? `PASS: state.swapBench.attempts incremented to ${attempts}` : `FAIL: stats not saved (attempts=${attempts})`);

  await s.snap('after-tap');
  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
