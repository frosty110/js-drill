// Probe: getting BACK out of a component page on system-design.html.
//
// Reported as "navigating from a system design problem to a component and then
// back to the problem is not possible — the back button just takes me to a
// different page". Three separate faults produced that one sentence:
//
//   1. The header never followed an in-page navigation. setRoute() writes the
//      URL with pushState/replaceState, neither of which fires hashchange, and
//      every screen here navigates by calling its render function directly —
//      applyRoute only runs for an EXTERNAL hash change. So the breadcrumb kept
//      painting the trail of the screen you were on BEFORE the tap: standing on
//      a component it read "… › Canonical Design Problems", whose only live
//      link is the topics landing.
//   2. At 390px the breadcrumb was laid out 0px wide — every crumb squeezed to
//      8px, "System Design" to 0×0 — because the wordmark and the header
//      buttons are all `flex: 0 0 auto` and the crumb was the only thing in the
//      row that could yield. The page's whole up-navigation, invisible on the
//      viewport PROFILE.md calls the design center.
//   3. Even painted correctly, the trail is CONTAINMENT (Building Blocks ›
//      Catalog › Cache). The problem that sent you there is nowhere on it, and
//      structurally never can be.
//
// Fault 1 is why the existing probes were green: they all navigate with
// `location.hash = …`, which fires hashchange and repaints. Every navigation
// below is a real CLICK for exactly that reason — a probe that sets the hash
// here would pass against the broken build.
//
// Usage: node tools/cdp/sd-component-return.js [url] [outDir]

const { ensureServer, ensureChrome, connect } = require('./lib');
const BASE = (process.argv[2] || 'http://localhost:8765/').replace(/\/$/, '') + '/';
const OUT = process.argv[3] || '/tmp/sd-component-return';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} — ${m}`); };

// The crumb labels currently on screen, in order, skipping any the layout has
// collapsed — a 0px crumb is not a crumb, which is the whole of fault 2.
const CRUMBS = `[...document.querySelectorAll('#ds-crumbs .ds-crumb')]
  .filter(c => c.getBoundingClientRect().width > 0)
  .map(c => c.textContent.trim())`;

async function walk(s, label) {
  // Problem → component, by tapping the "Components in play" row.
  ok(/Design a URL Shortener/.test(await s.eval(`document.querySelector('.detail-title').textContent`)),
    `${label}: starts on the problem`);
  const beforeLen = await s.eval(`history.length`);
  await s.eval(`document.querySelector('[data-cmp-link]').click()`);
  await sleep(1400);

  ok(await s.eval(`location.hash`) === '#/components/c/caching', `${label}: the component's URL`);
  ok(await s.eval(`history.length`) === beforeLen + 1, `${label}: the hop is a history entry`);

  // Fault 1: the trail must be the COMPONENT's, not the problem's.
  const crumbs = await s.eval(CRUMBS);
  ok(crumbs.length >= 2, `${label}: the breadcrumb is on screen at all (${crumbs.length} crumbs)`);
  ok(crumbs[crumbs.length - 1] === 'Cache',
    `${label}: the leaf names where you are, got ${JSON.stringify(crumbs[crumbs.length - 1])}`);
  ok(!crumbs.includes('Canonical Design Problems'),
    `${label}: the trail is not still the problem's, got ${JSON.stringify(crumbs)}`);

  // Fault 2: a crumb you cannot read or hit is not navigation. The ancestor
  // link has to be a real target, not an ellipsed sliver.
  const up = await s.eval(`(() => {
    const a = [...document.querySelectorAll('#ds-crumbs a.ds-crumb')].pop();
    if (!a) return null;
    const r = a.getBoundingClientRect();
    return { text: a.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height),
             hit: Math.round(a.getBoundingClientRect().height) };
  })()`);
  ok(up && up.w >= 40, `${label}: the up-link is wide enough to read + hit (${up && up.w}px, "${up && up.text}")`);

  // Fault 3: the return row, which is the only thing that can name the origin.
  const back = await s.eval(`(() => {
    const el = document.querySelector('.cmp-back');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { text: el.textContent.trim(), h: Math.round(r.height), href: el.getAttribute('href') };
  })()`);
  ok(back && /Design a URL Shortener/.test(back.text),
    `${label}: the component names the problem you came from (${back && JSON.stringify(back.text)})`);
  ok(back && back.href === '#/design-problems/p01',
    `${label}: and links to it, so cmd+click still opens a tab (${back && back.href})`);
  ok(back && back.h >= 44, `${label}: the return row clears the 44px tap floor (${back && back.h}px)`);

  // Following an alternative is still the same reading session — the origin
  // must survive the hop, or the way out disappears one tap in.
  const alt = await s.eval(`(() => {
    const el = document.querySelector('.cmp-alt__name'); if (!el) return null;
    el.click(); return el.textContent.trim();
  })()`);
  if (alt) {
    await sleep(1300);
    ok(/Design a URL Shortener/.test(await s.eval(`document.querySelector('.cmp-back')?.textContent || ''`)),
      `${label}: the origin survives following "Instead, consider" (${alt})`);
    await s.eval(`history.back()`); await sleep(1200);
  } else {
    ok(false, `${label}: expected an "Instead, consider" link to follow`);
  }

  // And the row actually goes there.
  await s.eval(`document.querySelector('.cmp-back').click()`);
  await sleep(1400);
  ok(await s.eval(`location.hash`) === '#/design-problems/p01', `${label}: the return row lands on the problem`);
  ok(/Design a URL Shortener/.test(await s.eval(`document.querySelector('.detail-title').textContent`)),
    `${label}: and the problem is what renders`);
  const afterCrumbs = await s.eval(CRUMBS);
  ok(afterCrumbs[afterCrumbs.length - 1] === 'Design a URL Shortener',
    `${label}: the header followed it back, got ${JSON.stringify(afterCrumbs)}`);

  ok(await s.eval(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`),
    `${label}: no horizontal scroll`);
}

(async () => {
  await ensureServer(); await ensureChrome();

  const m = await connect({ url: `${BASE}system-design.html#/design-problems/p01`, mobile: true, outDir: OUT, waitForLoadMs: 4500 });
  await walk(m, 'mobile');
  await m.snap('mobile-problem');

  // The browser's own Back must still retrace the click path — the fix adds a
  // return affordance, it does not replace history.
  await m.eval(`document.querySelector('[data-cmp-link]').click()`); await sleep(1300);
  await m.eval(`history.back()`); await sleep(1300);
  ok(await m.eval(`location.hash`) === '#/design-problems/p01', 'mobile: browser Back still retraces to the problem');
  ok(/Design a URL Shortener/.test(await m.eval(`document.querySelector('.detail-title').textContent`)),
    'mobile: and re-renders it');

  const d = await connect({ url: `${BASE}system-design.html#/design-problems/p01`, viewport: { width: 1280, height: 900 }, outDir: OUT, waitForLoadMs: 4500 });
  await walk(d, 'desktop');
  // Desktop has the room for the whole trail; the mobile collapse must not leak.
  await d.eval(`document.querySelector('[data-cmp-link]').click()`); await sleep(1300);
  const full = await d.eval(CRUMBS);
  ok(full.length >= 4 && full.includes('Building Blocks'),
    `desktop: keeps the full trail, got ${JSON.stringify(full)}`);

  // A pasted link is not a journey. Arriving cold must show no return row
  // rather than inventing an origin the reader never came from.
  const cold = await connect({ url: `${BASE}system-design.html#/components/c/caching`, mobile: true, outDir: OUT, waitForLoadMs: 4500 });
  ok(await cold.eval(`document.querySelector('.cmp-back') === null`),
    'a deep-linked component claims no origin');
  const coldCrumbs = await cold.eval(CRUMBS);
  ok(coldCrumbs[coldCrumbs.length - 1] === 'Cache',
    `a deep-linked component still says where it is, got ${JSON.stringify(coldCrumbs)}`);

  // The catalog is a legitimate way in, and it is not a design problem.
  const cat = await connect({ url: `${BASE}system-design.html#/components/catalog`, mobile: true, outDir: OUT, waitForLoadMs: 4500 });
  await cat.eval(`document.querySelector('.cmp-card').click()`); await sleep(1300);
  ok(await cat.eval(`document.querySelector('.cmp-back') === null`),
    'arriving from the catalog claims no problem origin');
  ok((await cat.eval(CRUMBS)).includes('Catalog'), 'and the trail still names the catalog it came from');

  console.log(`\n${fail ? '✗' : '✓'} component return: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERROR:', e.message); process.exit(1); });
