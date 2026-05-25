#!/usr/bin/env node
// Verifies iter-88 🤖 AI Coach Export at iPhone viewport: sidebar button →
// _aiCoachBuildExport() returns a Markdown blob with weak-spots context;
// startAiCoachExport() copies to clipboard and shows toast.

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-ai-coach';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed state with weak-spots so the export has substance to verify against.
  // two-sum (weakness 2) + valid-palindrome (weakness 1, revealed L2) +
  // binary-search (overdue 10d).
  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {},
    bestTimes: {}, mockHistory: {},
    revealed: { 'valid-palindrome': { L2: true } },
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: { 'binary-search': { lastPassedAt: Date.now() - 30*86400000, interval: 5*86400000, dueAt: Date.now() - 10*86400000 } },
    weakness: { 'two-sum': 2, 'valid-palindrome': 1 },
    history: {}, misses: {},
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
  const btn = await s.evalAwait(`document.getElementById('ai-coach-btn')?.textContent || ''`);
  console.log(btn.includes('AI Coach') ? `PASS: 🤖 AI Coach button rendered (${btn.trim()})` : `FAIL: button missing (got "${btn}")`);

  // ── Phase 2: blob is well-formed Markdown with seeded lessons ─────────
  // Preload the weak lessons so _aiCoachBuildExport finds them in CONTENT.
  await s.evalAwait(`(async () => { await loadLessonContent('two-sum'); await loadLessonContent('valid-palindrome'); await loadLessonContent('binary-search'); })()`);
  await s.sleep(600);

  const blob = await s.evalAwait(`_aiCoachBuildExport()`);
  const hasHeader = blob.includes('# JavaScript Drill — Weak Spots Snapshot');
  const hasTwoSum = blob.includes('Two Sum');
  const hasPalindrome = blob.includes('Valid Palindrome') || blob.toLowerCase().includes('palindrome');
  const hasMissCount = blob.includes('missed L1 2×');
  const hasRevealedFlag = blob.includes('revealed L2');
  const hasCanonical = blob.includes('```js');
  const isUnderBudget = blob.length <= 8200;
  const phase2OK = hasHeader && hasTwoSum && hasPalindrome && hasMissCount && hasRevealedFlag && hasCanonical && isUnderBudget;
  console.log(phase2OK
    ? `PASS: blob ${blob.length} chars; header✓ two-sum✓ palindrome✓ missed-2×✓ revealed-L2✓ canonical-block✓ under-budget✓`
    : `FAIL: blob shape (len=${blob.length}, header=${hasHeader}, two-sum=${hasTwoSum}, palindrome=${hasPalindrome}, missCount=${hasMissCount}, revealed=${hasRevealedFlag}, canonical=${hasCanonical}, budget=${isUnderBudget})`);

  // ── Phase 3: tap button → toast appears with success message ─────────
  await s.evalAwait(`document.getElementById('ai-coach-btn').click()`);
  await s.sleep(500);
  await s.snap('toast-shown');

  const toast = await s.evalAwait(`(() => {
    const t = document.querySelector('.ai-coach-toast');
    if (!t) return { exists: false };
    const html = t.innerHTML;
    return {
      exists: true,
      visible: t.classList.contains('reveal-cleared-toast-show'),
      isSuccess: html.includes('🤖') && (html.includes('Claude') || html.includes('ChatGPT')),
      isFallback: html.includes('⚠') && html.includes('_aiCoachBuildExport'),
      preview: html.slice(0, 100)
    };
  })()`);
  // Either branch is legitimate: success when clipboard API works (real users),
  // fallback when blocked (headless Chrome — clipboard requires user gesture).
  const phase3OK = toast.exists && toast.visible && (toast.isSuccess || toast.isFallback);
  console.log(phase3OK
    ? `PASS: toast shown — ${toast.isSuccess ? 'success branch (clipboard worked)' : 'fallback branch (headless clipboard blocked; DevTools fallback shown)'}`
    : `FAIL: toast state (exists=${toast.exists}, visible=${toast.visible}, success=${toast.isSuccess}, fallback=${toast.isFallback}, preview="${toast.preview}")`);

  // ── Phase 4: empty-state path (no weak spots) shows friendly fallback ──
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
  const emptyBlob = await s.evalAwait(`_aiCoachBuildExport()`);
  const phase4OK = emptyBlob.includes('No weak spots yet') && emptyBlob.includes('Quiz me on any');
  console.log(phase4OK
    ? `PASS: empty-state shows friendly fallback (quiz me on any pattern...)`
    : `FAIL: empty-state shape — blob: ${emptyBlob.slice(0, 200)}`);

  await s.close();
})().catch(err => { console.error(err); process.exit(1); });
