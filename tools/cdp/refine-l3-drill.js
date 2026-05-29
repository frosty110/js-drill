// refine-l3-drill.js — Step 2 + Step 7 probe for /drill-refine iter 26.
//
// Captures the L3 drill surface (Blank editor + Run/Hint/etc.) in non-mock
// mode at mobile + desktop. The L3 tab on a pattern lesson that has had a
// prior pass attempt so the trend/slope/best badges render where applicable.

const { ensureServer, ensureChrome, connect } = require('./lib');

const TAG = process.env.SNAP_TAG || 'before';
const OUT = process.env.OUT_DIR || '/tmp/jsdrill-refine-26';

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
        'two-sum':         { L1:'passed', L2:'passed' },
      },
      bestTimes: {}, mockHistory: {}, revealed: {},
      starterPath: true, welcomed: true, hideMastered: false,
      reviews: {}, weakness: {},
      sidebarTrack: 'patterns',
      subscribedPathId: 'starter',
      lastTab: 'L3',
      lastLessonId: 'two-sum'
    }));
  `);
  await s.reload();

  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await s.eval(`window.selectLesson('two-sum')`);
  await s.waitFor(`document.querySelector('#lesson-shell h2') !== null`, { timeoutMs: 6000 });
  await s.eval(`if (typeof selectTab === 'function') selectTab('L3')`);
  await new Promise(r => setTimeout(r, 600));

  await s.snap(`l3-drill-${label}-${TAG}`);

  const info = await s.eval(`
    (() => {
      const editor = document.querySelector('.CodeMirror');
      const editorRect = editor?.getBoundingClientRect();
      const promptBox = document.querySelector('#lesson-shell .bg-slate-900.border-slate-800');
      const promptRect = promptBox?.getBoundingClientRect();
      const edgeStrip = document.querySelector('[data-edge-strip]');
      const edgeChips = document.querySelectorAll('[data-edge-strip] .edge-chip').length;
      const l3Chips = document.querySelectorAll('[data-l3-chips] .l3-chip').length;
      const actions = Array.from(document.querySelectorAll('.l3-actions button')).map(b => ({
        action: b.getAttribute('data-action'),
        text: b.textContent.trim().slice(0, 30),
        visible: b.getBoundingClientRect().width > 0,
      }));
      const desc = document.querySelector('#lesson-shell .mb-4.text-sm.text-slate-400')?.textContent.trim().slice(0, 80);
      const bestBadge = !!document.querySelector('.pill');
      return {
        editorPresent: !!editor,
        editorTop: editorRect ? Math.round(editorRect.top) : null,
        editorAboveFold: editorRect ? editorRect.top < innerHeight : null,
        promptTop: promptRect ? Math.round(promptRect.top) : null,
        promptBottom: promptRect ? Math.round(promptRect.bottom) : null,
        edgeStripPresent: !!edgeStrip,
        edgeChipCount: edgeChips,
        l3ChipCount: l3Chips,
        actions,
        description: desc,
        viewportHeight: innerHeight,
      };
    })()
  `);
  console.log(`[${label}]`, JSON.stringify(info, null, 2));

  // iter-26 invariant: on L3, the shell PROBLEM box (.lesson-prompt) must
  // NOT render, while the L3 body PROMPT box still renders. Editor's
  // y-position should also be closer to the fold than the BEFORE measurement.
  const dom = await s.eval(`
    (() => {
      const shellPrompt = document.querySelector('.lesson-prompt');
      const bodyPrompts = Array.from(document.querySelectorAll('#lesson-shell .bg-slate-900.border-slate-800'));
      const bodyPromptHasExpected = bodyPrompts.some(p => /Expected output/i.test(p.textContent));
      return {
        shellPromptPresent: !!shellPrompt,
        bodyPromptCount: bodyPrompts.length,
        bodyPromptHasExpected,
      };
    })()
  `);
  s.assert(dom.shellPromptPresent === false,
    `[${label}] shell .lesson-prompt PROBLEM box should be absent on L3 (got present=${dom.shellPromptPresent})`);
  s.assert(dom.bodyPromptHasExpected === true,
    `[${label}] L3 body PROMPT box (with Expected output) still renders`);

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
