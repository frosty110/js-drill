#!/usr/bin/env node
// Durable probe for ds/dragscroll.js — click-and-drag horizontal scrolling.
//
// Horizontal strips are swipeable on a phone for free; on a desktop a mouse has
// no way to reach content past the right edge, because the scrollbars are
// hidden by design and shift+wheel isn't discoverable. This locks down the
// mouse affordance and, just as importantly, the things it must NOT break:
//
//   - dragging a strip scrolls it
//   - the drag does NOT also fire the click underneath (dragging the study-plan
//     strip must not launch the plan you started the drag on)
//   - a plain click still works — the threshold means a click is not a drag
//   - text surfaces are exempt, so selecting code to copy still works
//   - the page itself never drag-scrolls
//
// Run: node tools/cdp/ds-dragscroll.js [baseUrl] [outDir]
const { ensureServer, ensureChrome, connect } = require('./lib');

const BASE = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/ds-dragscroll';
const SD = (hash) => `${BASE}system-design.html${hash || ''}`;

// CDP-level mouse drag: the utility listens to pointer events, so synthesized
// el.dispatchEvent would prove nothing about real input.
async function drag(s, x, y, dx) {
  const step = (type, px, extra = {}) => s.send('Input.dispatchMouseEvent', {
    type, x: px, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1,
    clickCount: 1, pointerType: 'mouse', ...extra
  });
  await step('mousePressed', x);
  for (let i = 1; i <= 6; i++) await step('mouseMoved', x - (dx * i) / 6);
  await step('mouseReleased', x - dx);
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // Desktop first — this affordance exists FOR the mouse.
  const s = await connect({ url: SD('#/design-problems'), viewport: { width: 1280, height: 900 }, outDir: OUT });
  await s.sleep(1400);

  // This probe launches a plan, and an active plan changes what the topic home
  // renders — so without a clean baseline the SECOND run tests a different
  // screen than the first. Reset the topic's storage and reload.
  await s.eval(`localStorage.removeItem('jsdrill.systemdesign.v1')`);
  await s.reload();

  const strip = '.plan-cards';
  // The plan strip renders after plans.json resolves; measuring before that
  // races and reads null.
  await s.waitFor(`!!document.querySelector('${strip}')`, { timeoutMs: 8000 });
  const geo = await s.eval(`(() => {
    const el = document.querySelector('${strip}'); if (!el) return null;
    const r = el.getBoundingClientRect();
    return { overflow: el.scrollWidth - el.clientWidth, left: el.scrollLeft,
             x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  s.assert(geo && geo.overflow > 20, `the study-plan strip actually overflows (${geo && geo.overflow}px) — nothing to prove otherwise`);
  // Rest position isn't 0 — the strip has side padding and x-mandatory scroll
  // snap. Measure the DELTA, which is what the drag is responsible for.

  // ── A drag scrolls it ────────────────────────────────────────────────────
  await drag(s, geo.x, geo.y, 160);
  await s.sleep(250);
  const after = await s.eval(`document.querySelector('${strip}').scrollLeft`);
  s.assert(after - geo.left > 40, `drag scrolled the strip (scrollLeft ${geo.left} -> ${after})`);
  s.assert(await s.eval(`location.hash`) === '#/design-problems',
    `the drag did NOT also open the card underneath it (hash: ${await s.eval('location.hash')})`);
  s.assert(await s.eval(`!document.body.classList.contains('ds-dragging')`), 'the dragging class is cleaned up on release');
  await s.snap('01-after-drag-desktop');

  // ── Dragging back returns it ─────────────────────────────────────────────
  await drag(s, geo.x, geo.y, -120);
  await s.sleep(250);
  const back = await s.eval(`document.querySelector('${strip}').scrollLeft`);
  s.assert(back < after, `dragging the other way scrolls back (${after} -> ${back})`);

  // ── A plain click still activates ────────────────────────────────────────
  // Below the threshold it must behave exactly as before the utility existed.
  const target = await s.eval(`(() => {
    const c = document.querySelector('${strip} .plan-card'); if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  s.assert(!!target, 'found a plan card to click');
  await drag(s, target.x, target.y, 2);   // 2px — under THRESHOLD, so still a click
  await s.sleep(900);
  const launched = await s.eval(`location.hash`);
  s.assert(/\/plan\//.test(launched), `a plain click still launches the plan (hash: ${launched})`);

  // ── A real mouse click on an answer still registers ──────────────────────
  // The highest-risk regression: a real click drifts a pixel or two, so if the
  // drag threshold or the click-swallower were wrong, answering a question
  // would silently stop working. Only a real CDP click can catch that.
  await s.eval(`location.hash = '#/design-problems/p05'`);
  await s.sleep(1000);
  await s.eval(`document.getElementById('drill-all').click()`);
  await s.sleep(800);
  for (let i = 0; i < 6 && await s.eval(`!!document.getElementById('reveal-btn')`); i++) {
    await s.eval(`document.getElementById('reveal-btn').click()`);
    await s.sleep(200);
    await s.eval(`document.querySelector('#action-bar [data-g="good"]').click()`);
    await s.sleep(450);
  }
  const opt = await s.eval(`(() => {
    const o = document.querySelector('.ds-opt'); if (!o) return null;
    const r = o.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  s.assert(!!opt, 'reached an MC card to click');
  await drag(s, opt.x, opt.y, 0);   // a real press+release, no movement
  await s.sleep(400);
  s.assert(await s.eval(`!!document.querySelector('.ds-opt.is-correct, .ds-opt.is-wrong')`),
    'a real mouse click on an MC option still grades the answer');

  // ── Text surfaces are exempt: drag-select still works on code ────────────
  // A fixture rather than whatever code happens to be on screen: the exemption
  // is a property of the utility, so it should be tested as one, and a probe
  // that silently skips when the page has no <pre> proves nothing.
  await s.eval(`(() => {
    const box = document.createElement('div');
    box.id = 'dragfix';
    box.style.cssText = 'position:fixed;top:40px;left:40px;width:300px;overflow-x:auto;white-space:nowrap;z-index:99999;background:#111';
    box.innerHTML = '<pre id="dragfix-pre" style="margin:0;display:inline-block">' +
      'const aLongLineOfCodeThatOverflowsItsContainerHorizontally = 1;</pre>';
    document.body.appendChild(box);
  })()`);
  await s.sleep(200);
  const fix = await s.eval(`(() => {
    const b = document.getElementById('dragfix'), r = b.getBoundingClientRect();
    return { overflow: b.scrollWidth - b.clientWidth, left: b.scrollLeft,
             x: Math.round(r.left + r.width - 20), y: Math.round(r.top + r.height / 2) };
  })()`);
  s.assert(fix.overflow > 20, `fixture overflows (${fix.overflow}px)`);
  await drag(s, fix.x, fix.y, -180);   // drag leftward across the <pre> text
  await s.sleep(200);
  const afterText = await s.eval(`(() => ({
    left: document.getElementById('dragfix').scrollLeft,
    sel: (window.getSelection() || '').toString().length
  }))()`);
  s.assert(afterText.left === fix.left, `a drag on <pre> does NOT scroll its container (${fix.left} -> ${afterText.left})`);
  s.assert(afterText.sel > 0, `a drag on <pre> still selects text for copying (${afterText.sel} chars)`);
  await s.eval(`document.getElementById('dragfix').remove(); window.getSelection().removeAllRanges()`);

  // ── The page itself must never drag-scroll ───────────────────────────────
  const pageBefore = await s.eval(`window.scrollY`);
  await drag(s, 640, 500, 200);
  await s.sleep(200);
  s.assert(await s.eval(`window.scrollY`) === pageBefore, 'dragging empty page area does not scroll the document');

  // ── Mobile: touch still scrolls natively, and nothing is broken ──────────
  await s.setViewport({ width: 390, height: 844, mobile: true, deviceScaleFactor: 2 });
  await s.eval(`location.hash = '#/design-problems'`);
  await s.sleep(1200);
  const hScroll = await s.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  s.assert(hScroll <= 1, `no horizontal scroll on mobile, overflow=${hScroll}px`);
  s.assert(await s.eval(`typeof document.querySelector('${strip}') === 'object'`), 'strip still renders at mobile');
  await s.snap('02-mobile');

  const r = s.report();
  await s.close();
  process.exit(r.failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
