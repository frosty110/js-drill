// refine-mock-active.js — Step 2 + Step 7 probe for /drill-refine iter 24.
//
// Captures the Mock Interview L3 shell MID-SESSION (banner + timer + editor
// at the moment the user is typing the solution from memory). Distinct from
// tools/cdp/refine-mock-interview.js (iter 4) which captures the POST-WIN
// feedback state. This probe captures the during-mock surface.

const { ensureServer, ensureChrome, connect } = require('./lib');

const TAG = process.env.SNAP_TAG || 'before';
const OUT = process.env.OUT_DIR || '/tmp/jsdrill-refine-24';

async function shot({ mobile, label }) {
  const s = await connect({
    url: 'http://localhost:8765/',
    mobile,
    viewport: mobile ? undefined : { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: OUT,
  });

  await s.eval(`
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
      __v: 5,
      progress: {
        'two-sum':         { L1:'passed', L2:'passed', L3:'passed' },
        'p-contains-dup':  { L1:'passed', L2:'passed', L3:'passed' },
        'p-valid-anagram': { L1:'passed', L2:'passed', L3:'passed' },
      },
      bestTimes: { 'two-sum': 95000 },
      mockHistory: { 'two-sum': [180000, 140000, 110000, 95000] },
      revealed: {},
      starterPath: true, welcomed: true, hideMastered: false,
      reviews: {}, weakness: {},
      sidebarTrack: 'patterns',
      subscribedPathId: 'starter'
    }));
  `);
  await s.reload();

  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await s.eval(`window.selectLesson('two-sum')`);
  await s.waitFor(`document.querySelector('#lesson-shell h2') !== null`, { timeoutMs: 6000 });
  await s.eval(`window.startMockInterview('two-sum')`);
  await s.waitFor(`document.querySelector('[data-action="end-mock"]') !== null`, { timeoutMs: 6000 });
  await new Promise(r => setTimeout(r, 600));

  await s.snap(`mock-active-${label}-${TAG}`);

  const info = await s.eval(`
    (() => {
      const banner = document.querySelector('[data-action="end-mock"]')?.closest('div.flex') || document.querySelector('.rounded-lg.border-rose-900');
      const timer = document.getElementById('mock-timer');
      const endBtn = document.querySelector('[data-action="end-mock"]');
      const editor = document.querySelector('.CodeMirror');
      const promptBox = document.querySelector('.bg-slate-900.border-slate-800');
      const promptRect = promptBox?.getBoundingClientRect();
      const editorRect = editor?.getBoundingClientRect();
      const bannerRect = banner?.getBoundingClientRect();
      const actions = Array.from(document.querySelectorAll('.l3-actions button')).map(b => b.getAttribute('data-action'));
      return {
        bannerVisible: !!banner,
        bannerHeight: bannerRect ? Math.round(bannerRect.height) : null,
        bannerTop: bannerRect ? Math.round(bannerRect.top) : null,
        timerText: timer?.textContent.trim(),
        endButtonText: endBtn?.textContent.trim(),
        promptTop: promptRect ? Math.round(promptRect.top) : null,
        promptBottom: promptRect ? Math.round(promptRect.bottom) : null,
        editorTop: editorRect ? Math.round(editorRect.top) : null,
        editorAboveFold: editorRect ? editorRect.top < innerHeight : null,
        actions,
        viewportHeight: innerHeight,
      };
    })()
  `);
  console.log(`[${label}]`, JSON.stringify(info, null, 2));

  // iter-24 invariant: during mock, the [data-cta-row] abandonment CTA
  // (Next lesson / Shuffle review) must NOT render in the lesson shell.
  // Also assert the rose banner + End interview + timer + editor + Run all
  // still exist (we removed only the abandonment row, nothing else).
  const ctaRow = await s.eval(`!!document.querySelector('[data-cta-row]')`);
  s.assert(ctaRow === false,
    `[${label}] [data-cta-row] should be absent during active mock (got present=${ctaRow})`);
  s.assert(info.bannerVisible, `[${label}] rose mock banner still renders`);
  s.assert(/\d:\d\d/.test(info.timerText || ''), `[${label}] timer shows m:ss (got "${info.timerText}")`);
  s.assert(/End/i.test(info.endButtonText || ''), `[${label}] End interview button preserved`);
  s.assert(Array.isArray(info.actions) && info.actions.includes('run'), `[${label}] Run action preserved`);
  s.assert(info.editorTop !== null, `[${label}] L3 editor still in DOM`);

  // iter-27 invariant: tab strip should be absent during active mock.
  const tabCount = await s.eval(`document.querySelectorAll('#lesson-shell .tab-btn').length`);
  s.assert(tabCount === 0, `[${label}] tab strip should be empty during active mock (got ${tabCount})`);

  // iter-29 invariant: prev/next-lesson arrow buttons absent during active mock.
  const arrowCount = await s.eval(`document.querySelectorAll('[data-action="prev-lesson"], [data-action="next-lesson"]').length`);
  s.assert(arrowCount === 0, `[${label}] prev/next arrows should be absent during active mock (got ${arrowCount})`);

  // iter-32 invariant: journey-context pills (.pill-mastered + .pill-path)
  // absent during active mock.
  const pillCount = await s.eval(`document.querySelectorAll('#lesson-shell .pill-mastered, #lesson-shell .pill-path').length`);
  s.assert(pillCount === 0, `[${label}] ✓ Mastered + 🧭 Step pills should be absent during active mock (got ${pillCount})`);

  s.report();
  await s.close();
  return s;
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  await shot({ mobile: true,  label: 'mobile' });
  await shot({ mobile: false, label: 'desktop' });
})().catch(e => { console.error(e); process.exit(1); });
