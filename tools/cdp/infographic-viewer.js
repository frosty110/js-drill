// Durable probe for the system-design infographic study set + full-screen
// workspace (js/infographic-viewer.js), at the mobile viewport that PROFILE.md
// says is 80% of usage.
//
// Guards the two defects found in PR #13 review:
//   1. Nested <header> elements inside a study set inherited the page-wide
//      `header{position:sticky}` rule and pinned over the content while
//      scrolling a 3-4 graphic set.
//   2. Pinch derived every frame from the LIVE midpoint against the pinch-start
//      transform, which algebraically cancels two-finger panning (dx=0) and
//      lets the anchored point drift during combined pan+zoom.
//
//   node tools/cdp/infographic-viewer.js
const { ensureChrome, ensureServer, connect } = require('./lib');

const out = [];
const check = (ok, msg) => { out.push(`${ok ? '  ✓' : '  ✗'} ${msg}`); return ok; };

(async () => {
  await ensureChrome();
  await ensureServer({ port: 8765, dir: process.cwd() });
  // p01 (URL Shortener) is one of the authored multi-image pilots.
  const s = await connect({
    url: 'http://localhost:8765/system-design.html#/design-problems/p01',
    waitForLoadMs: 4000, mobile: true
  });

  // ── The study set renders ────────────────────────────────────────────────
  const sets = await s.eval(`document.querySelectorAll('drill-infographic-set').length`);
  check(sets > 0, `drill-infographic-set mounted (${sets})`);
  const studies = await s.eval(`document.querySelectorAll('.infographic-study').length`);
  check(studies > 1, `multi-graphic study set rendered (${studies} graphics)`);

  // ── 1. Only the page header may be sticky ────────────────────────────────
  const headers = await s.eval(`document.querySelectorAll('header').length`);
  check(headers > 1, `nested headers present, so the rule is actually exercised (${headers})`);
  const sticky = await s.eval(
    `[...document.querySelectorAll('header')]` +
    `.filter(h => getComputedStyle(h).position === 'sticky')` +
    `.map(h => h.className || '(page)').join(' | ')`
  );
  check(sticky === '(page)', `only the page header is sticky (sticky: ${sticky || 'none'})`);

  // ── 2. Pinch: real PointerEvents on the workspace stage ──────────────────
  const res = await s.eval(`(async () => {
    window.DrillInfographicViewer.open({
      src: 'assets/system-design/infographics/design-problems/p02/overview.png',
      title: 'probe', alt: 'probe', downloadName: 'probe.png'
    });
    const stage = document.querySelector('.infographic-viewer__stage');
    const img = document.querySelector('.infographic-viewer__image');
    if (!stage || !img) return 'NO_STAGE';
    for (let i = 0; i < 60 && !img.naturalWidth; i++) await new Promise(r => setTimeout(r, 100));
    if (!img.naturalWidth) return 'IMG_NOT_LOADED';
    await new Promise(r => setTimeout(r, 300));

    const fire = (type, id, x, y) => stage.dispatchEvent(new PointerEvent(type, {
      pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1
    }));
    const T = () => { const m = new DOMMatrix(getComputedStyle(img).transform); return { x: m.e, y: m.f, s: m.a }; };

    const r = stage.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;

    fire('pointerdown', 1, cx - 50, cy - 50);
    fire('pointerdown', 2, cx + 50, cy + 50);
    const start = T();

    // (a) move BOTH fingers +40 with spacing unchanged -> pure two-finger pan
    fire('pointermove', 1, cx - 10, cy - 10);
    fire('pointermove', 2, cx + 90, cy + 90);
    const panned = T();

    // (b) spread about that midpoint -> zoom; the anchored point must hold
    fire('pointermove', 1, cx - 60, cy - 60);
    fire('pointermove', 2, cx + 140, cy + 140);
    const zoomed = T();
    const midLocalX = (cx + 40) - r.left;

    fire('pointerup', 1, cx - 60, cy - 60);
    fire('pointerup', 2, cx + 140, cy + 140);
    return JSON.stringify({
      start, panned, zoomed,
      anchorAtPan: (midLocalX - panned.x) / panned.s,
      anchorAtZoom: (midLocalX - zoomed.x) / zoomed.s
    });
  })()`, { awaitPromise: true });

  if (typeof res === 'string' && !res.startsWith('{')) {
    check(false, `workspace usable (${res})`);
  } else {
    const p = JSON.parse(res);
    check(Math.abs(p.panned.s - p.start.s) < 1e-6,
      `constant finger spacing leaves scale alone (${p.start.s} -> ${p.panned.s})`);
    check(Math.abs(p.panned.x - p.start.x - 40) < .5 && Math.abs(p.panned.y - p.start.y - 40) < .5,
      `two-finger pan follows the fingers (dx=${(p.panned.x - p.start.x).toFixed(2)}, dy=${(p.panned.y - p.start.y).toFixed(2)}, want 40)`);
    check(p.zoomed.s > p.panned.s * 1.5,
      `spreading the fingers zooms in (${p.panned.s.toFixed(3)} -> ${p.zoomed.s.toFixed(3)})`);
    check(Math.abs(p.anchorAtZoom - p.anchorAtPan) < .5,
      `anchored image point stays under the fingers (${p.anchorAtPan.toFixed(2)} -> ${p.anchorAtZoom.toFixed(2)})`);
  }

  const bad = s.consoleMsgs.filter(m => m.type === 'exception' || m.type === 'error');
  check(bad.length === 0, `no console errors/exceptions (${bad.length}${bad.length ? ': ' + JSON.stringify(bad.slice(0, 2)) : ''})`);

  await s.close();
  const failed = out.filter(l => l.startsWith('  ✗'));
  console.log('--- infographic viewer probe ---');
  console.log(out.join('\n'));
  console.log(failed.length ? `\n❌ FAIL — ${failed.length}/${out.length}` : `\n✅ PASS — ${out.length}/${out.length}`);
  process.exit(failed.length ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
