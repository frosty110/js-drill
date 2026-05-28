// refine-topbar.js — Step 2 + Step 7 probe for /drill-refine iter 19.
//
// Captures the topbar at mobile (375×667) and desktop (1280×800) on a fresh
// localStorage state. Two purposes: (1) BEFORE/AFTER side-by-side for the iter,
// (2) durable invariant check that the topbar's iter-19 refinement holds.

const { ensureServer, ensureChrome, connect } = require('./lib');

const TAG = process.env.SNAP_TAG || 'before';
const OUT = process.env.OUT_DIR || '/tmp/jsdrill-refine-19';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  for (const profile of [
    { name: 'mobile',  mobile: true },
    { name: 'desktop', mobile: false, viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false } },
  ]) {
    const s = await connect({
      url: 'http://localhost:8765/',
      mobile: profile.mobile,
      viewport: profile.viewport,
      outDir: OUT,
    });

    // Seed past the welcome modal so the topbar is unobstructed for the snap.
    await s.eval(`
      localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
        __v: 5, progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
        starterPath: true, welcomed: true, hideMastered: false,
        reviews: {}, weakness: {}, sidebarTrack: 'syntax'
      }));
    `);
    // Force-bypass cache on reload so newly-edited CSS lands in the test.
    await s.reload();

    await s.snap(`topbar-${profile.name}-${TAG}`);

    // Empirical capture of what's actually rendered + visible.
    const info = await s.eval(`
      (() => {
        const topbar = document.getElementById('topbar');
        if (!topbar) return { error: 'no #topbar' };
        const r = topbar.getBoundingClientRect();
        const styles = getComputedStyle(topbar);
        const menus = Array.from(topbar.querySelectorAll('.topbar-menu')).map(b => {
          const br = b.getBoundingClientRect();
          const visible = br.width > 0 && br.height > 0 && getComputedStyle(b).display !== 'none';
          return { label: b.textContent.trim(), visible, width: Math.round(br.width) };
        });
        const right = Array.from(topbar.querySelectorAll('.topbar-right .topbar-icon')).map(b => {
          const br = b.getBoundingClientRect();
          const visible = br.width > 0 && br.height > 0 && getComputedStyle(b).display !== 'none';
          return { id: b.id, label: b.getAttribute('aria-label'), visible, width: Math.round(br.width) };
        });
        const left = {
          wordmark: !!topbar.querySelector('.topbar-wordmark'),
          surfaceToggle: Array.from(topbar.querySelectorAll('.surface-seg')).map(b => ({
            label: (b.querySelector('.surface-seg-label')?.textContent || b.textContent).trim(),
            selected: b.getAttribute('aria-selected') === 'true',
          })),
          plan: !!document.getElementById('topbar-plan'),
        };
        return {
          height: Math.round(r.height),
          bg: styles.backgroundColor,
          menus, right, left,
        };
      })()
    `);
    console.log(`[${profile.name}]`, JSON.stringify(info, null, 2));

    // iter-19 invariant: on the mobile viewport the ACTIVE surface-seg must
    // render its text label (not just the emoji). On desktop both segs always
    // show labels — also assert that's still true.
    const activeText = await s.eval(`
      (() => {
        const seg = document.querySelector('.surface-seg.active');
        if (!seg) return '';
        const label = seg.querySelector('.surface-seg-label');
        if (!label) return '';
        return getComputedStyle(label).display !== 'none' ? label.textContent.trim() : '';
      })()
    `);
    s.assert(/Problems|Reference/.test(activeText),
      `[${profile.name}] expected active surface-seg label visible with "Problems" or "Reference", got "${activeText}"`);

    await s.close();
    s.report();
  }
})().catch(e => { console.error(e); process.exit(1); });
