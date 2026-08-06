// refine-sidebar-drawer.js — Step 2 + Step 7 probe for /drill-refine iter 31.
//
// Captures the mobile sidebar drawer in two states: closed (default boot, ☰
// visible) and open (☰ tapped, drawer reveals from the left with backdrop).

const { ensureServer, ensureChrome, connect } = require('../lib');

const TAG = process.env.SNAP_TAG || 'before';
const OUT = process.env.OUT_DIR || '/tmp/jsdrill-refine-31';

async function shot({ mobile, label, opened }) {
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
        'variables-types': { L1:'passed', L2:'passed', L3:'passed' },
        'numbers-math':    { L1:'passed', L2:'passed', L3:'passed' },
        'string-basics':   { L1:'passed', L2:'passed' },
      },
      bestTimes: {}, mockHistory: {}, revealed: {},
      starterPath: true, welcomed: true, hideMastered: false,
      reviews: {}, weakness: { 'arrow-functions': true },
      sidebarTrack: 'syntax', subscribedPathId: 'starter'
    }));
  `);
  await s.reload();
  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });

  if (opened) {
    await s.eval(`document.getElementById('hamburger')?.click()`);
    await new Promise(r => setTimeout(r, 500));
  }

  await s.snap(`drawer-${label}-${opened ? 'open' : 'closed'}-${TAG}`);

  const info = await s.eval(`
    (() => {
      const ham = document.getElementById('hamburger');
      const backdrop = document.getElementById('sidebar-backdrop');
      const sidebar = document.getElementById('sidebar');
      const drawerOpen = document.body.classList.contains('sidebar-open') || (sidebar && sidebar.classList.contains('open'));
      const hamRect = ham?.getBoundingClientRect();
      const sidebarRect = sidebar?.getBoundingClientRect();
      const backdropDisplay = backdrop ? getComputedStyle(backdrop).display : 'no-backdrop';
      const backdropOpacity = backdrop ? getComputedStyle(backdrop).opacity : null;
      return {
        hamburgerSize: hamRect ? { w: Math.round(hamRect.width), h: Math.round(hamRect.height) } : null,
        hamTop: hamRect ? Math.round(hamRect.top) : null,
        hamLeft: hamRect ? Math.round(hamRect.left) : null,
        drawerOpen,
        sidebarLeft: sidebarRect ? Math.round(sidebarRect.left) : null,
        sidebarWidth: sidebarRect ? Math.round(sidebarRect.width) : null,
        backdropDisplay,
        backdropOpacity,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
      };
    })()
  `);
  console.log(`[${label}/${opened ? 'open' : 'closed'}]`, JSON.stringify(info, null, 2));

  // iter-31 invariant: search-input placeholder on coarse-pointer (mobile)
  // must NOT contain "press /". On non-coarse it should preserve the hint.
  const placeholder = await s.eval(`document.getElementById('search-input')?.placeholder`);
  if (opened) {
    if (mobile) {
      s.assert(placeholder === 'Search lessons…',
        `[${label}/mobile] search placeholder should drop "(press /)" on touch (got "${placeholder}")`);
    } else {
      s.assert(/press \//i.test(placeholder || ''),
        `[${label}/desktop] search placeholder should preserve "(press /)" on fine-pointer (got "${placeholder}")`);
    }
  }

  s.report();
  await s.close();
  return s;
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  await shot({ mobile: true,  label: 'mobile', opened: false });
  await shot({ mobile: true,  label: 'mobile', opened: true });
  // Desktop pass to verify the "(press /)" hint is preserved on fine-pointer.
  await shot({ mobile: false, label: 'desktop', opened: true });
})().catch(e => { console.error(e); process.exit(1); });
