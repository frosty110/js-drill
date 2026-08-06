// refine-at-risk.js — Step 2 + Step 7 probe for /drill-refine iter 33.
//
// Captures the At Risk modal (📡 sidebar pill → modal opens) at mobile +
// desktop with a seed that triggers ≥3 at-risk rows (mix of due/weak/revealed).

const { ensureServer, ensureChrome, connect } = require('../lib');

const TAG = process.env.SNAP_TAG || 'before';
const OUT = process.env.OUT_DIR || '/tmp/jsdrill-refine-33';

async function shot({ mobile, label }) {
  const s = await connect({
    url: 'http://localhost:8765/',
    mobile,
    viewport: mobile ? undefined : { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: OUT,
  });

  await s.eval(`
    const now = Date.now();
    const ago = (h) => now - h*3600*1000;
    const ahead = (h) => now + h*3600*1000;
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
      __v: 5,
      progress: {
        's-variables':  { L1:'passed', L2:'passed', L3:'passed' },
        's-numbers':    { L1:'passed', L2:'passed', L3:'passed' },
        's-strings':    { L1:'passed', L2:'passed', L3:'passed' },
        'two-sum':      { L1:'passed', L2:'passed', L3:'passed' },
        'p-anagrams':   { L1:'passed', L2:'passed', L3:'passed' },
      },
      bestTimes: {}, mockHistory: {}, revealed: {
        's-strings': { L3: true },
      },
      starterPath: true, welcomed: true, hideMastered: false,
      reviews: {
        's-variables': { lastPassedAt: ago(48), interval: 1, dueAt: ago(24) },
        's-numbers':   { lastPassedAt: ago(36), interval: 3, dueAt: ago(12) },
        's-strings':   { lastPassedAt: ago(72), interval: 7, dueAt: ago(6) },
        'two-sum':     { lastPassedAt: ago(12), interval: 1, dueAt: ahead(12) },
      },
      weakness: { 's-variables': 2, 'two-sum': 1, 'p-anagrams': 3 },
      sidebarTrack: 'syntax', subscribedPathId: 'starter'
    }));
  `);
  await s.reload();
  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });

  // openAtRisk is defined inside an init IIFE — not globally accessible.
  // Force-unhide the at-risk-btn (which may be `hidden` if rendered count
  // shows 0) and click it to open the modal via its bound handler.
  await s.eval(`
    const btn = document.getElementById('at-risk-btn');
    if (btn) { btn.classList.remove('hidden'); btn.click(); }
  `);
  await new Promise(r => setTimeout(r, 600));

  await s.snap(`at-risk-${label}-${TAG}`);

  const info = await s.eval(`
    (() => {
      const modal = document.getElementById('at-risk-modal');
      const body = document.getElementById('at-risk-body');
      const visible = modal && getComputedStyle(modal).display !== 'none';
      const cards = Array.from(body?.querySelectorAll('[data-lesson-id]') || []).map(b => ({
        id: b.getAttribute('data-lesson-id'),
        text: b.textContent.replace(/\\s+/g, ' ').trim().slice(0, 100),
      }));
      const dueChips = body?.querySelectorAll('[style*="DUE NOW"], [style*="due-now"]').length;
      const heading = modal?.querySelector('h2, h3')?.textContent.trim();
      const subheader = modal?.querySelector('p, [data-sub], .text-slate-400')?.textContent.trim();
      const bodyRect = body?.getBoundingClientRect();
      return {
        visible,
        heading,
        subheader,
        cardCount: cards.length,
        sample: cards.slice(0, 5),
        bodyHeight: bodyRect ? Math.round(bodyRect.height) : null,
        scrollHeight: body?.scrollHeight,
        viewportHeight: innerHeight,
      };
    })()
  `);
  console.log(`[${label}]`, JSON.stringify(info, null, 2));

  // iter-33 invariant: [data-at-risk-inventory] row renders with a non-zero
  // bucket count (this seed has DUE NOW + SOON + NO-SR all populated).
  const inv = await s.eval(`
    (() => {
      const el = document.querySelector('[data-at-risk-inventory]');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        text: el.textContent.trim(),
        fontSize: cs.fontSize,
        borderLeftWidth: cs.borderLeftWidth,
      };
    })()
  `);
  s.assert(!!inv, `[${label}] [data-at-risk-inventory] row should render`);
  s.assert(inv && /DUE NOW/i.test(inv.text || ''),
    `[${label}] inventory should include DUE NOW count (got "${inv?.text}")`);
  s.assert(inv && parseFloat(inv.fontSize) >= 10,
    `[${label}] inventory font-size >= 10px (got ${inv?.fontSize})`);
  s.assert(inv && parseFloat(inv.borderLeftWidth) >= 2,
    `[${label}] inventory has ≥2px left-border (got ${inv?.borderLeftWidth})`);

  // iter-40 (refine): explainer copy collapsed to single-vocab. Asserts the
  // 3 dropped legacy terms ("wobbly" / "about to slip" / "mastered-with-reveal")
  // are gone, and the new copy mentions "missed or revealed". The inventory
  // row's DUE NOW / SOON / NO-SR labels are now the modal's single vocabulary.
  const explainerText = await s.eval(`
    (() => {
      const modal = document.getElementById('at-risk-modal');
      const inv = modal?.querySelector('[data-at-risk-inventory]');
      // Explainer is the sibling div just above the inventory row.
      const candidates = Array.from(modal?.querySelectorAll('div') || []);
      const idx = candidates.findIndex(d => d === inv?.parentNode);
      // Easier: search all divs whose textContent includes "Tap any row".
      const explainer = candidates.find(d =>
        /Tap any row/.test(d.textContent || '') &&
        d.children.length === 0
      );
      return explainer ? explainer.textContent.trim() : null;
    })()
  `);
  s.assert(!!explainerText, `[${label}] explainer copy should be present`);
  s.assert(explainerText && !/wobbly/i.test(explainerText),
    `[${label}] explainer should not contain legacy "wobbly" term (got "${explainerText}")`);
  s.assert(explainerText && !/about to slip/i.test(explainerText),
    `[${label}] explainer should not contain legacy "about to slip" term`);
  s.assert(explainerText && !/mastered-with-reveal/i.test(explainerText),
    `[${label}] explainer should not contain legacy "mastered-with-reveal" term`);
  s.assert(explainerText && /missed or revealed/i.test(explainerText),
    `[${label}] explainer should use unified "missed or revealed" phrasing (got "${explainerText}")`);

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
