// refine-topbar-menu.js — Step 2 + Step 7 probe for /drill-refine iter 30.
//
// Captures the topbar dropdown panel OPEN at mobile + desktop. Mobile opens
// via 📂 Browse button → category sheet; desktop opens via .topbar-menu click.

const { ensureServer, ensureChrome, connect } = require('./lib');

const TAG = process.env.SNAP_TAG || 'before';
const OUT = process.env.OUT_DIR || '/tmp/jsdrill-refine-30';

async function shot({ mobile, label, menu }) {
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

  // Open the specified menu.
  if (mobile) {
    // Mobile uses the 📂 Browse icon.
    await s.eval(`document.getElementById('topbar-mobile-menu')?.click()`);
    await new Promise(r => setTimeout(r, 400));
    // If menu name given, click that category in the sheet.
    if (menu) {
      await s.eval(`(() => { const el = document.querySelector('[data-mobile-cat="${menu}"]'); el?.click(); })()`);
      await new Promise(r => setTimeout(r, 400));
    }
  } else {
    await s.eval(`(() => { const el = document.querySelector('.topbar-menu[data-menu="${menu}"]'); el?.click(); })()`);
    await new Promise(r => setTimeout(r, 400));
  }

  await s.snap(`topbar-${menu}-${label}-${TAG}`);

  const info = await s.eval(`
    (() => {
      const panel = document.getElementById('topbar-dropdown');
      const visible = panel && !panel.classList.contains('hidden');
      const items = Array.from(document.querySelectorAll('.topbar-item')).map(b => ({
        name: b.querySelector('.topbar-item-name')?.textContent.trim(),
        desc: b.querySelector('.topbar-item-desc')?.textContent.trim().slice(0, 60),
        hasEmoji: !!b.querySelector('.topbar-item-emoji'),
      }));
      const groupLabels = Array.from(document.querySelectorAll('.topbar-group-label')).map(g => g.textContent.trim());
      const blurb = document.querySelector('.topbar-menu-blurb')?.textContent.trim();
      const panelRect = panel?.getBoundingClientRect();
      return {
        panelVisible: visible,
        panelHeight: panelRect ? Math.round(panelRect.height) : null,
        itemCount: items.length,
        groupCount: groupLabels.length,
        groupLabels,
        sampleItems: items.slice(0, 6),
        blurb,
        viewportHeight: innerHeight,
      };
    })()
  `);
  console.log(`[${label}/${menu}]`, JSON.stringify(info, null, 2));

  // iter-30 invariant: .topbar-group-label renders with the promoted style
  // when groups are present (Drills + Insights menus on desktop).
  if (!mobile && (menu === 'drills' || menu === 'insights')) {
    const labelStyle = await s.eval(`
      (() => {
        const el = document.querySelector('.topbar-group-label');
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          fontSize: cs.fontSize,
          color: cs.color,
          borderLeftWidth: cs.borderLeftWidth,
          count: document.querySelectorAll('.topbar-group-label').length,
        };
      })()
    `);
    s.assert(!!labelStyle, `[${label}/${menu}] .topbar-group-label present`);
    s.assert(labelStyle && parseFloat(labelStyle.fontSize) >= 12,
      `[${label}/${menu}] group-label font-size >= 12px (got ${labelStyle?.fontSize})`);
    s.assert(labelStyle && parseFloat(labelStyle.borderLeftWidth) >= 2,
      `[${label}/${menu}] group-label has ≥2px left-border (got ${labelStyle?.borderLeftWidth})`);
  }

  s.report();
  await s.close();
  return s;
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  // Desktop: snap each of the 4 menus directly.
  await shot({ mobile: false, label: 'desktop', menu: 'practice' });
  await shot({ mobile: false, label: 'desktop', menu: 'drills' });
  await shot({ mobile: false, label: 'desktop', menu: 'insights' });
  // Mobile: snap the Browse-sheet root + one category drilldown.
  await shot({ mobile: true,  label: 'mobile', menu: '' });           // root sheet
  await shot({ mobile: true,  label: 'mobile', menu: 'practice' });  // drill into Practice
})().catch(e => { console.error(e); process.exit(1); });
