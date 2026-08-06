// Compare conversation tab section 1 with adhdMode OFF vs ON.
const { ensureServer, ensureChrome, connect } = require('../lib');

const URL_BASE = 'http://localhost:8765/';
const OUT_DIR  = '/tmp/jsdrill-inspect-trapping';

async function snap(adhd, mobile) {
  const label = (adhd ? 'adhd-on' : 'adhd-off') + '-' + (mobile ? 'mobile' : 'desktop');
  const s = await connect({
    url: URL_BASE + '?t=' + Date.now() + '#/p-trapping-rain/conversation',
    mobile,
    viewport: mobile ? undefined : { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: OUT_DIR,
    waitForLoadMs: 2400,
  });

  const seed = {
    __v: 6, welcomed: true, lastLessonId: 'p-trapping-rain', lastTab: 'conversation',
    progress: {}, reviews: {}, history: {}, weakness: {}, revealed: {}, adhdMode: adhd,
  };
  await s.eval(`localStorage.setItem('jsdrill.progress.v1', ${JSON.stringify(JSON.stringify(seed))})`);
  await s.reload();
  await s.sleep(1500);

  // Click into Conversation tab
  await s.eval(`(() => {
    const conv = Array.from(document.querySelectorAll('.tab-btn')).find(t => /conversation/i.test(t.textContent || ''));
    if (conv) conv.click();
  })()`);
  await s.sleep(400);

  // Expand section 1
  await s.eval(`(() => { const d = document.querySelector('details'); if (d && !d.hasAttribute('open')) d.setAttribute('open',''); })()`);
  await s.sleep(300);

  const dx = await s.eval(`(() => {
    const det = document.querySelector('details');
    if (!det) return null;
    const inner = det.outerHTML;
    return {
      adhdMode: state?.adhdMode,
      bodyClasses: document.body.className,
      bionicCount: (inner.match(/class="adhd-fix"/g) || []).length,
      markerCount: (inner.match(/conv-marker/g) || []).length + (inner.match(/class="[^"]*marker/g) || []).length,
      codeChipCount: (inner.match(/<code[^>]*>/g) || []).length,
      firstParaSnippet: (det.querySelector('p, div')?.outerHTML || '').slice(0, 360),
    };
  })()`);

  await s.snap(`trapping-conv-${label}`);
  await s.close();
  return { label, dx };
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  for (const adhd of [false, true]) {
    for (const mobile of [false, true]) {
      const r = await snap(adhd, mobile);
      console.log('=== ' + r.label + ' ===');
      console.log(JSON.stringify(r.dx, null, 2));
    }
  }
})().catch(e => { console.error(e); process.exit(2); });
