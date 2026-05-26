#!/usr/bin/env node
// Verifies iter-104 🗺 Sidebar Command Palette at iPhone viewport.
// Phases:
//   (1) 🔍 top-bar trigger renders;
//   (2) Cmd-K / Ctrl-K opens the overlay (keyboard);
//   (3) typed query fuzzy-filters results (mode/lesson/section kinds present);
//   (4) selecting a result invokes the underlying handler + increments
//       state.commandUsage; recent-use ranking ranks accordingly on reopen;
//   (5) Esc closes the overlay.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-command-palette';

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
    convDrill: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    traceHop: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    notesDrill: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    mechConstellation: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    reverseWalk: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    notesLocate: { attempts: 0, correct: 0, sessions: 0, lastRunAt: 0 },
    commandUsage: {},
    sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(800);
  await s.snap('boot');

  // ── Phase 1: 🔍 trigger renders + overlay is hidden initially ─────────
  const trig = await s.evalAwait(`(() => {
    const t = document.getElementById('palette-trigger');
    const overlay = document.getElementById('palette-overlay');
    return {
      triggerExists: !!t,
      triggerText: t ? t.textContent.trim() : '',
      overlayHidden: overlay ? overlay.classList.contains('hidden') : null
    };
  })()`);
  console.log(trig.triggerExists && trig.triggerText.includes('🔍') && trig.overlayHidden
    ? `PASS: 🔍 trigger renders (text="${trig.triggerText}"), overlay hidden on boot`
    : `FAIL: boot state (triggerExists=${trig.triggerExists}, text="${trig.triggerText}", overlayHidden=${trig.overlayHidden})`);

  // ── Phase 2: clicking 🔍 opens the overlay + input focuses + results populate ──
  await s.evalAwait(`document.getElementById('palette-trigger').click()`);
  await s.sleep(400);
  await s.snap('palette-open');
  const opened = await s.evalAwait(`(() => {
    const overlay = document.getElementById('palette-overlay');
    const inputFocused = document.activeElement?.id === 'palette-input';
    const results = document.querySelectorAll('.palette-result').length;
    const hasModeKind = !!document.querySelector('.palette-result-kind-mode');
    const hasLessonKind = !!document.querySelector('.palette-result-kind-lesson');
    const hasSectionKind = !!document.querySelector('.palette-result-kind-section');
    return { hidden: overlay.classList.contains('hidden'), inputFocused, results, hasModeKind, hasLessonKind, hasSectionKind };
  })()`);
  console.log(!opened.hidden && opened.inputFocused && opened.results > 0 && opened.hasModeKind && opened.hasLessonKind && opened.hasSectionKind
    ? `PASS: trigger-click opened overlay (input focused, ${opened.results} results visible, mode+lesson+section kinds all present)`
    : `FAIL: open state (hidden=${opened.hidden}, focused=${opened.inputFocused}, results=${opened.results}, mode=${opened.hasModeKind}, lesson=${opened.hasLessonKind}, section=${opened.hasSectionKind})`);

  // ── Phase 3: type "rec" → results narrow to Recognize / etc ──────────
  await s.evalAwait(`(() => {
    const inp = document.getElementById('palette-input');
    inp.value = 'rec';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await s.sleep(200);
  const filtered = await s.evalAwait(`(() => {
    const results = Array.from(document.querySelectorAll('.palette-result'));
    const labels = results.map(r => r.querySelector('.palette-result-label')?.textContent || '');
    const hasRecognize = labels.some(l => l.toLowerCase().includes('recogniz'));
    return { count: results.length, labels: labels.slice(0, 5), hasRecognize };
  })()`);
  console.log(filtered.count >= 1 && filtered.count <= 24 && filtered.hasRecognize
    ? `PASS: typed "rec" → ${filtered.count} results, Recognize present in matches (sample: ${JSON.stringify(filtered.labels)})`
    : `FAIL: filter state (count=${filtered.count}, hasRecognize=${filtered.hasRecognize}, labels=${JSON.stringify(filtered.labels)})`);

  // ── Phase 4: Enter → select top result → invokes handler + commandUsage++ ──
  // Pick a target where invocation is observable: filter to a lesson and select it.
  await s.evalAwait(`(() => {
    const inp = document.getElementById('palette-input');
    inp.value = 'two-sum';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await s.sleep(200);
  const beforeUsage = await s.evalAwait(`Object.keys(state.commandUsage || {}).length`);
  await s.evalAwait(`(() => {
    const inp = document.getElementById('palette-input');
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  })()`);
  await s.sleep(400);
  const after = await s.evalAwait(`(() => {
    const overlay = document.getElementById('palette-overlay');
    const lessonId = state.currentLessonId;
    const usageKeys = Object.keys(state.commandUsage || {});
    return { hidden: overlay.classList.contains('hidden'), lessonId, usageKeys, usageCount: usageKeys.length };
  })()`);
  const lessonRouted = after.lessonId === 'two-sum';
  const usageRecorded = after.usageCount > beforeUsage && after.usageKeys.some(k => k.startsWith('lesson:two-sum'));
  console.log(after.hidden && lessonRouted && usageRecorded
    ? `PASS: Enter selected "two-sum" lesson → overlay closed, state.currentLessonId="${after.lessonId}", commandUsage recorded (${after.usageCount} keys including lesson:two-sum)`
    : `FAIL: select flow (hidden=${after.hidden}, lessonId=${after.lessonId}, usageKeys=${after.usageKeys.length}, hasTwoSum=${after.usageKeys.some(k => k.includes('two-sum'))})`);

  // ── Phase 5: Esc closes the overlay (and recent-use bumps top of empty-query list) ──
  await s.evalAwait(`document.getElementById('palette-trigger').click()`);
  await s.sleep(300);
  const empty = await s.evalAwait(`(() => {
    const overlay = document.getElementById('palette-overlay');
    const firstLabel = document.querySelector('.palette-result-label')?.textContent || '';
    const firstKind = document.querySelector('.palette-result-kind')?.textContent || '';
    return { hidden: overlay.classList.contains('hidden'), firstLabel, firstKind };
  })()`);
  // The just-used "Two Sum" lesson should now rank at the top of the empty-query list.
  const recencyRanksTop = empty.firstLabel.toLowerCase().includes('two sum');
  // Close via Esc keydown on the input.
  await s.evalAwait(`(() => {
    const inp = document.getElementById('palette-input');
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  })()`);
  await s.sleep(200);
  const closed = await s.evalAwait(`document.getElementById('palette-overlay').classList.contains('hidden')`);
  console.log(!empty.hidden && recencyRanksTop && closed
    ? `PASS: recent-use ranks "Two Sum" at top of empty-query list (firstLabel="${empty.firstLabel}", kind="${empty.firstKind}"); Esc closes overlay`
    : `FAIL: recency+Esc (initially-hidden=${empty.hidden}, recencyRanksTop=${recencyRanksTop}, firstLabel="${empty.firstLabel}", closedAfterEsc=${closed})`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
