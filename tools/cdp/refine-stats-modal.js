// refine-stats-modal.js — Step 2 + Step 7 probe for /drill-refine iter 25.
//
// Captures the Stats modal (📊 Stats button → modal) at mobile + desktop
// with mid-flight progress so all tiles render.

const { ensureServer, ensureChrome, connect } = require('./lib');

const TAG = process.env.SNAP_TAG || 'before';
const OUT = process.env.OUT_DIR || '/tmp/jsdrill-refine-25';

async function shot({ mobile, label }) {
  const s = await connect({
    url: 'http://localhost:8765/',
    mobile,
    viewport: mobile ? undefined : { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: OUT,
  });

  // Seed: mid-flight progress so the Track Balance has 3 bars + several
  // mastered counts + due reviews + weak spots + mock times + a few lifetime
  // drill modes seeded so their tiles render.
  await s.eval(`
    const now = Date.now();
    const ago = (h) => new Date(now - h*3600*1000).toISOString();
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
      __v: 5,
      progress: {
        'variables-types':  { L1:'passed', L2:'passed', L3:'passed' },
        'numbers-math':     { L1:'passed', L2:'passed', L3:'passed' },
        'string-basics':    { L1:'passed', L2:'passed', L3:'passed' },
        'template-literals':{ L1:'passed', L2:'passed', L3:'passed' },
        'two-sum':          { L1:'passed', L2:'passed', L3:'passed' },
        'p-contains-dup':   { L1:'passed', L2:'passed', L3:'passed' },
        'p-anagrams':       { L1:'passed', L2:'passed' },
      },
      bestTimes: { 'two-sum': 95000, 'p-contains-dup': 110000 },
      mockHistory: { 'two-sum': [180000, 140000, 95000] },
      revealed: {},
      starterPath: true, welcomed: true, hideMastered: false,
      reviews: {
        'variables-types': { lastPassedAt: ago(24), interval: 1, dueAt: ago(2) },
        'two-sum':         { lastPassedAt: ago(36), interval: 3, dueAt: ago(3) },
      },
      weakness: { 'p-anagrams': true, 'arrow-functions': true },
      sidebarTrack: 'syntax',
      subscribedPathId: 'starter',
      recognize: { attempts: 30, correct: 24 },
      gotcha:    { attempts: 14, correct: 9 },
    }));
  `);
  await s.reload();

  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await s.eval(`document.getElementById('stats-btn').click()`);
  await s.waitFor(`document.getElementById('stats-modal').style.display === 'block'`, { timeoutMs: 5000 });
  await new Promise(r => setTimeout(r, 500));

  await s.snap(`stats-${label}-${TAG}`);

  const info = await s.eval(`
    (() => {
      const modal = document.getElementById('stats-modal');
      const body = document.getElementById('stats-body');
      if (!body) return { error: 'no stats-body' };
      const compass = body.querySelector('[data-mech-cell], [style*="Track Balance"]') || body.firstElementChild;
      const tiles = Array.from(body.children).map(el => ({
        tagName: el.tagName,
        height: Math.round(el.getBoundingClientRect().height),
      }));
      return {
        modalDisplay: getComputedStyle(modal).display,
        bodyHeight: Math.round(body.getBoundingClientRect().height),
        bodyScrollHeight: body.scrollHeight,
        childCount: body.children.length,
        tiles: tiles.slice(0, 12),
        viewportHeight: innerHeight,
      };
    })()
  `);
  console.log(`[${label}]`, JSON.stringify(info, null, 2));

  // iter-25 invariant: MASTERED tile shows fraction + percentage (e.g.
  // "2 / 166 · 1%"), matching the convention used by the Track Balance
  // compass + sidebar.
  const masteredText = await s.eval(`
    (() => {
      const els = Array.from(document.querySelectorAll('#stats-body div'));
      const labelEl = els.find(e => e.textContent.trim() === 'Mastered');
      const tile = labelEl?.parentElement;
      const numEl = tile?.querySelector('div + div');
      return numEl?.textContent.replace(/\\s+/g, ' ').trim();
    })()
  `);
  s.assert(/\d+\s*\/\s*\d+/.test(masteredText || ''),
    `[${label}] MASTERED tile renders a fraction (got "${masteredText}")`);
  s.assert(/·\s*\d+%/.test(masteredText || ''),
    `[${label}] MASTERED tile shows percentage with "·" separator (got "${masteredText}")`);

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
