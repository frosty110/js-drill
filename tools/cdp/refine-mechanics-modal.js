// refine-mechanics-modal.js — Step 2 + Step 7 probe for /drill-refine iter 21.
//
// Opens the Mechanics modal at mobile + desktop with two seed states:
//   - "no progress": clean install, no mastered lessons → list view default
//   - "transfer gap": seeded with a few patterns-track lessons mastered to
//     trip _hasTransferGaps() so the modal opens in Matrix view.

const { ensureServer, ensureChrome, connect } = require('./lib');

const TAG = process.env.SNAP_TAG || 'before';
const OUT = process.env.OUT_DIR || '/tmp/jsdrill-refine-21';

async function shot({ mobile, label, seedProgress }) {
  const s = await connect({
    url: 'http://localhost:8765/',
    mobile,
    viewport: mobile ? undefined : { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: OUT,
  });

  // Seed past welcome + optionally stamp some mastered lessons.
  await s.eval(`
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
      __v: 5,
      progress: ${JSON.stringify(seedProgress || {})},
      bestTimes: {}, mockHistory: {}, revealed: {},
      starterPath: true, welcomed: true, hideMastered: false,
      reviews: {}, weakness: {}, sidebarTrack: 'syntax'
    }));
  `);
  await s.reload();

  // Open the Mechanics modal (it's a button in the sidebar / hidden nav).
  // openMechanicsModal is a global on window — call it directly to avoid the
  // sidebar-drawer interaction (mobile would have to open ☰ first).
  await s.evalAwait(`(async () => { await openMechanicsModal(); })()`);
  await new Promise(r => setTimeout(r, 800));

  await s.snap(`mechanics-${label}-${TAG}`);

  // iter-21 invariant: category-header divs (data-mech-cat=*) must render with
  // the promoted styling — color #a5b4fc (lavender), font-size 12px, and a
  // visible left-border accent.
  if (label.endsWith('-list')) {
    const catStyle = await s.eval(`
      (() => {
        const el = document.querySelector('[data-mech-cat]');
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          color: cs.color,
          fontSize: cs.fontSize,
          borderLeftWidth: cs.borderLeftWidth,
          borderLeftStyle: cs.borderLeftStyle,
          count: document.querySelectorAll('[data-mech-cat]').length,
        };
      })()
    `);
    s.assert(!!catStyle, `[${label}] category-header divs should render`);
    s.assert(catStyle && parseFloat(catStyle.fontSize) >= 12,
      `[${label}] category-header font-size should be >=12px (got ${catStyle?.fontSize})`);
    s.assert(catStyle && parseFloat(catStyle.borderLeftWidth) >= 2,
      `[${label}] category-header border-left should be >=2px (got ${catStyle?.borderLeftWidth})`);
    s.assert(catStyle && catStyle.count >= 3,
      `[${label}] expected at least 3 category headers (got ${catStyle?.count})`);
  }

  // Empirical capture
  const info = await s.eval(`
    (() => {
      const modal = document.getElementById('mechanics-modal');
      const title = document.getElementById('mechanics-title')?.textContent.trim();
      const sub = document.getElementById('mechanics-sub')?.textContent.trim();
      const view = (typeof _mechanicsView !== 'undefined') ? _mechanicsView : 'unknown';
      const toggle = document.getElementById('mechanics-view-toggle');
      const toggleVisible = toggle && getComputedStyle(toggle).display !== 'none';
      const body = document.getElementById('mechanics-body');
      const bodyHeight = body?.getBoundingClientRect().height;
      const rowCount = body?.querySelectorAll('[data-mech-id], [data-mech-cell]').length;
      const transferGapMarkers = body?.querySelectorAll('[data-transfer-gap], .transfer-gap, [class*="transfer-gap"]').length;
      const sectionHeaders = body?.querySelectorAll('h3, h4, .mech-category, [class*="category"], [class*="section-header"]').length;
      return {
        view, title, sub,
        toggleVisible,
        modalDisplay: modal ? getComputedStyle(modal).display : 'no-modal',
        bodyHeight: Math.round(bodyHeight),
        rowCount, transferGapMarkers, sectionHeaders,
      };
    })()
  `);
  console.log(`[${label}]`, JSON.stringify(info, null, 2));

  s.report();
  await s.close();
  return s;
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // No-progress seed — list view default.
  await shot({ mobile: true,  label: 'mobile-list',  seedProgress: {} });
  await shot({ mobile: false, label: 'desktop-list', seedProgress: {} });

  // Transfer-gap seed — master a few patterns-track lessons so _hasTransferGaps
  // fires and the modal opens to Matrix view by default (iter-3 behavior).
  // Pick patterns lessons known to be in the dataset.
  const gapSeed = {
    'two-sum': { L1: 'passed', L2: 'passed', L3: 'passed' },
    'valid-anagram': { L1: 'passed', L2: 'passed', L3: 'passed' },
    'contains-duplicate': { L1: 'passed', L2: 'passed', L3: 'passed' },
  };
  await shot({ mobile: true,  label: 'mobile-matrix',  seedProgress: gapSeed });
  await shot({ mobile: false, label: 'desktop-matrix', seedProgress: gapSeed });
})().catch(e => { console.error(e); process.exit(1); });
