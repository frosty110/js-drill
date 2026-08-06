// refine-cmd-k-palette.js — Step 2 + Step 7 probe for /drill-refine iter 34.
//
// Opens the ⌘K / 🔍 command palette and captures it at mobile + desktop with
// (a) empty input (just-opened) and (b) a partial-query state showing results.

const { ensureServer, ensureChrome, connect } = require('../lib');

const TAG = process.env.SNAP_TAG || 'before';
const OUT = process.env.OUT_DIR || '/tmp/jsdrill-refine-34';

async function shot({ mobile, label, query }) {
  const s = await connect({
    url: 'http://localhost:8765/',
    mobile,
    viewport: mobile ? undefined : { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: OUT,
  });

  await s.eval(`
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
      __v: 5, progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
      starterPath: true, welcomed: true, hideMastered: false,
      reviews: {}, weakness: {},
      sidebarTrack: 'patterns', subscribedPathId: 'starter'
    }));
  `);
  await s.reload();
  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });

  // Open the palette via the 🔍 trigger button.
  await s.eval(`document.getElementById('palette-trigger')?.click()`);
  await new Promise(r => setTimeout(r, 400));

  if (query) {
    await s.eval(`
      const inp = document.getElementById('palette-input');
      if (inp) {
        inp.focus();
        inp.value = ${JSON.stringify(query)};
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    `);
    await new Promise(r => setTimeout(r, 400));
  }

  await s.snap(`palette-${label}-${query ? 'q' : 'empty'}-${TAG}`);

  const info = await s.eval(`
    (() => {
      const overlay = document.getElementById('palette-overlay');
      const visible = overlay && !overlay.classList.contains('hidden');
      const input = document.getElementById('palette-input');
      const results = document.getElementById('palette-results');
      const items = Array.from(results?.querySelectorAll('[role="option"], .palette-row, .palette-item') || []);
      const sampleRows = items.slice(0, 6).map(el => ({
        text: el.textContent.replace(/\\s+/g, ' ').trim().slice(0, 80),
        cat: el.getAttribute('data-cat') || el.querySelector('[data-cat]')?.getAttribute('data-cat'),
      }));
      const footer = overlay?.querySelector('.palette-footer')?.textContent.replace(/\\s+/g, ' ').trim();
      const placeholder = input?.placeholder;
      return {
        visible,
        placeholder,
        itemCount: items.length,
        sample: sampleRows,
        footer,
        viewportHeight: innerHeight,
        overlayHeight: overlay ? Math.round(overlay.getBoundingClientRect().height) : null,
      };
    })()
  `);
  console.log(`[${label}/${query || 'empty'}]`, JSON.stringify(info, null, 2));

  // iter-34 invariant: palette footer is touch-aware. On mobile (coarse-
  // pointer) it should say "Tap" and NOT "navigate". On desktop (fine-
  // pointer) it should preserve the keyboard cue "navigate".
  if (mobile) {
    s.assert(/tap/i.test(info.footer || ''),
      `[${label}] mobile footer should mention "Tap" (got "${info.footer}")`);
    s.assert(!/navigate/i.test(info.footer || ''),
      `[${label}] mobile footer should NOT say "navigate" (got "${info.footer}")`);
  } else {
    s.assert(/navigate/i.test(info.footer || ''),
      `[${label}] desktop footer should preserve "navigate" (got "${info.footer}")`);
  }

  s.report();
  await s.close();
  return s;
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  await shot({ mobile: true,  label: 'mobile',  query: '' });
  await shot({ mobile: true,  label: 'mobile',  query: 'two' });
  await shot({ mobile: false, label: 'desktop', query: '' });
  await shot({ mobile: false, label: 'desktop', query: 'mock' });
})().catch(e => { console.error(e); process.exit(1); });
