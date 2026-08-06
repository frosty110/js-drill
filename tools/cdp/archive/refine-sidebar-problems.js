// refine-sidebar-problems.js — Step 2 + Step 7 probe for /drill-refine iter 35.
//
// Captures the sidebar's Problems list at mobile (drawer open) + desktop with
// seed progress so section mini-bars and per-lesson status dots render.

const { ensureServer, ensureChrome, connect } = require('../lib');

const TAG = process.env.SNAP_TAG || 'before';
const OUT = process.env.OUT_DIR || '/tmp/jsdrill-refine-35';

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
        'p-anagrams':      { L1:'passed', L2:'passed' },
      },
      bestTimes: {}, mockHistory: {}, revealed: { 'p-anagrams': { L3: true } },
      starterPath: true, welcomed: true, hideMastered: false,
      reviews: {}, weakness: { 'p-anagrams': 2 },
      sidebarTrack: 'patterns', subscribedPathId: 'starter'
    }));
  `);
  await s.reload();
  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });

  if (mobile) {
    await s.eval(`document.getElementById('hamburger')?.click()`);
    await new Promise(r => setTimeout(r, 500));
  }

  await s.snap(`sidebar-problems-${label}-${TAG}`);

  const info = await s.eval(`
    (() => {
      const sidebar = document.getElementById('sidebar');
      const sections = Array.from(sidebar?.querySelectorAll('[data-section-header], .sidebar-section-header, .section-name') || []);
      const lessonRows = Array.from(sidebar?.querySelectorAll('[data-lesson-id]') || []);
      const filterChips = Array.from(sidebar?.querySelectorAll('[data-track-filter], .track-chip, .track-pill, .all-track-chip') || []);
      const planHeader = sidebar?.querySelector('[data-plan-chip], .plan-chip, [class*="Plan:"]')?.textContent.trim();
      const statusDots = sidebar?.querySelectorAll('.status-dot, [data-status-dot]').length;
      const repairBtn = sidebar?.querySelector('#repair-filter-btn');
      const sample = lessonRows.slice(0, 5).map(r => ({
        id: r.getAttribute('data-lesson-id'),
        text: r.textContent.replace(/\\s+/g, ' ').trim().slice(0, 60),
      }));
      return {
        sectionCount: sections.length,
        lessonRowCount: lessonRows.length,
        filterChipCount: filterChips.length,
        statusDots,
        repairBtnVisible: repairBtn ? getComputedStyle(repairBtn).display !== 'none' : false,
        sampleLessons: sample,
        viewportHeight: innerHeight,
      };
    })()
  `);
  console.log(`[${label}]`, JSON.stringify(info, null, 2));

  // iter-36 invariant: .section-header renders at ≥12px lavender + ≥2px left-border.
  const sh = await s.eval(`
    (() => {
      const el = document.querySelector('.section-header');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { fontSize: cs.fontSize, color: cs.color, borderLeftWidth: cs.borderLeftWidth };
    })()
  `);
  s.assert(!!sh, `[${label}] .section-header should render`);
  s.assert(sh && parseFloat(sh.fontSize) >= 12, `[${label}] section-header font-size >=12px (got ${sh?.fontSize})`);
  s.assert(sh && parseFloat(sh.borderLeftWidth) >= 2, `[${label}] section-header left-border >=2px (got ${sh?.borderLeftWidth})`);

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
