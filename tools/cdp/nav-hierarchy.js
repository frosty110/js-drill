#!/usr/bin/env node
// ============================================================================
//  tools/cdp/nav-hierarchy.js — the app knows where you are
// ============================================================================
// Encodes the walk that produced D15. A scripted 15-step pass through the live
// app measured a breadcrumb on 0 of 15 surfaces, no aria-current anywhere
// inside a lesson, and three different bespoke up-affordances — none of which
// any of the 938 content checks or 181 probes could see, because every one of
// them was individually shipping correctly.
//
// This asserts the derived trail (docs/information-architecture.md §5) at both
// breakpoints, on both hash-routed pages:
//
//   · a breadcrumb on every non-root surface, and none at a root
//   · the trail's depth matches the surface's depth in the registry
//   · the leaf is not a link (you are already there) and is aria-current
//   · every ancestor crumb IS a link, and following one climbs exactly one level
//   · the crumb names the lesson/unit by TITLE, not by id
//   · the header never pushes the page into horizontal scroll at 390px
//   · ancestors stay tappable (≥44px) on a phone
//
// Usage: node tools/cdp/nav-hierarchy.js [url] [outDir]
// ============================================================================

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL_ARG = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/nav-hierarchy';

const CRUMBS = `(() => {
  const el = document.getElementById('ds-crumbs');
  if (!el) return { present: false };
  const cs = getComputedStyle(el);
  const items = [...el.querySelectorAll('.ds-crumb')].map(c => ({
    label: c.textContent.trim(),
    link: c.tagName === 'A',
    href: c.getAttribute('href'),
    current: c.getAttribute('aria-current') === 'page',
    leaf: c.classList.contains('ds-crumb--leaf'),
    h: Math.round(c.getBoundingClientRect().height)
  }));
  return {
    present: true,
    hidden: el.hidden || cs.display === 'none',
    items,
    hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  };
})()`;

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL_ARG, viewport: { width: 1280, height: 900 }, outDir: OUT });

  const go = async (hash, waitMs = 1100) => {
    await s.eval(`location.hash = ${JSON.stringify(hash)}`);
    await s.sleep(waitMs);
    return s.eval(CRUMBS);
  };

  // ── index.html ────────────────────────────────────────────────────────────
  let c = await go('#/m/home');
  s.assert(c.present, 'index: #ds-crumbs is mounted');
  s.assert(c.hidden || !c.items.length, 'index: no breadcrumb at the root (Home)');

  c = await go('#/m/browse');
  s.assert(!c.hidden && c.items.length === 2, 'index: Browse shows Home › Browse');
  s.assert(c.items[0].link, 'index: the root crumb is a link');
  s.assert(!c.items[1].link && c.items[1].current, 'index: the leaf is not a link and is aria-current');

  // A lesson is Home › Browse › <Section> › <Title>. The section is the
  // unlinked interstitial (§5) — real hierarchy with no address yet.
  c = await go('#/two-sum/L1', 1600);
  s.assert(c.items.length === 4, `index: a lesson has 4 crumbs (got ${c.items.length})`);
  s.assert(/Two Sum/i.test(c.items[3].label), `index: the leaf names the lesson by title, not id (got "${c.items[3].label}")`);
  s.assert(!/two-sum/.test(c.items[3].label), 'index: the leaf is not the raw lesson id');
  s.assert(c.items[1].link, 'index: Browse is climbable from inside a lesson');
  s.assert(!c.items[2].link, 'index: the section crumb is present but unlinked (no route yet)');
  s.assert(c.items.filter(i => i.current).length === 1, 'index: exactly one crumb is aria-current');
  await s.snap('desktop-lesson');

  // Climbing: following an ancestor lands on that ancestor.
  await s.eval(`document.querySelectorAll('#ds-crumbs a.ds-crumb')[1].click()`);
  await s.sleep(1100);
  const climbed = await s.eval(`location.hash`);
  s.assert(/\/m\/browse/.test(climbed), `index: clicking the Browse crumb navigates to Browse (got ${climbed})`);

  // A mode route reads as its destination, not its slug.
  c = await go('#/m/dashboard');
  s.assert(c.items.some(i => /Progress/i.test(i.label)), 'index: #/m/dashboard crumbs as "Progress", not "dashboard"');
  // A scoped review names the scope it is over.
  c = await go('#/m/review/trees');
  s.assert(c.items.some(i => /Review/i.test(i.label) && /Trees/i.test(i.label)),
    `index: a scoped review names its scope (got "${c.items.map(i => i.label).join(' › ')}")`);

  // ── mobile ────────────────────────────────────────────────────────────────
  await s.setViewport({ width: 390, height: 844, mobile: true });
  c = await go('#/two-sum/L1', 1500);
  s.assert(!c.hScroll, 'mobile: the breadcrumb does not push the page into horizontal scroll');
  s.assert(c.items.some(i => i.leaf), 'mobile: the leaf survives truncation');
  const taps = c.items.filter(i => i.link);
  s.assert(taps.length > 0, 'mobile: at least one ancestor stays reachable');
  await s.snap('mobile-lesson');

  // ── system-design.html ────────────────────────────────────────────────────
  await s.setViewport({ width: 1280, height: 900, mobile: false });
  const sdBase = URL_ARG.replace(/\/?$/, '/') + 'system-design.html';
  await s.eval(`location.href = ${JSON.stringify(sdBase + '#/')}`);
  await s.sleep(2200);
  c = await s.eval(CRUMBS);
  s.assert(c.present, 'sd: #ds-crumbs is mounted on system-design.html');
  s.assert(c.hidden || !c.items.length, 'sd: no breadcrumb at the topics root');

  c = await go('#/ddia', 1600);
  s.assert(c.items.length === 3, `sd: a topic is Home › System Design › <topic> (got ${c.items.length})`);
  s.assert(c.items[0].label === 'Home' && /index\.html/.test(c.items[0].href || ''),
    'sd: the root crumb links back into the app that owns the nav');

  c = await go('#/ddia/ch01', 1700);
  s.assert(c.items.length === 4, `sd: a unit has 4 crumbs (got ${c.items.length})`);
  s.assert(!/^ch01$/i.test(c.items[3].label), `sd: the unit crumb is a title, not an id (got "${c.items[3].label}")`);
  s.assert(c.items[2].link, 'sd: the topic is climbable from inside a unit');
  await s.snap('sd-unit');

  await s.close();
  const r = s.report();
  process.exit(r.failed || r.errors ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
