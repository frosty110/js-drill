#!/usr/bin/env node
// Durable probe for the Component Catalog — the Building Blocks topic inverted.
//
// The surface exists to make ONE relationship traversable in both directions:
//   problem → the components it uses, each annotated with what it is doing there
//   component → every problem that uses it, same annotation
//
// So the load-bearing assertion in here is not "the page renders" — it is that
// the SAME annotation string appears at both endpoints of an edge. If those two
// ever diverge, the graph is lying and nothing else in the app would notice:
// both pages would still render, both would still look right, and the user
// would be learning two different things about the same edge.
//
// Also covers:
//   - the catalog entry on the topic home, with counts derived from data
//   - every category renders, every component renders, none orphaned
//   - most-used-first ordering within a category, authored order breaking ties
//   - the five decision blocks on a component page (reach / avoid / cost /
//     failure / alternatives) and the annotated Used-in list
//   - deep links, and graceful degradation for an unknown component id and for
//     a topic that has no catalog
//   - mobile: no horizontal scroll, tap targets >= 44px
//
// Run: node tools/cdp/sd-component-catalog.js [baseUrl] [outDir]
const { ensureServer, ensureChrome, connect } = require('./lib');

const BASE = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/sd-component-catalog';
const SD = (hash) => `${BASE}system-design.html${hash || ''}`;

// Derived, never hardcoded — adding a component or an edge must not break this.
const CATALOG = require('../../data/system-design/components/catalog.json');
const EDGES = require('../../data/system-design/mechanism-map.json').edges;
const DP = require('../../data/system-design/design-problems/manifest.json');

const COMPONENTS = CATALOG.components;
const CATEGORIES = CATALOG.categories;
const usesOf = (id) => Object.keys(EDGES[id] || {}).length;
const TOTAL_EDGES = COMPONENTS.reduce((n, c) => n + usesOf(c.id), 0);

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // ── Mobile first: 80% of study happens on a phone (PROFILE.md) ───────────
  const s = await connect({ url: SD('#/components'), mobile: true, outDir: OUT });
  await s.sleep(1000);
  await s.snap('01-topic-home-mobile');

  // 1. The entry point exists on the topic home and reports real numbers.
  const entry = await s.eval(`!!document.getElementById('catalog-entry')`);
  s.assert(entry, 'components topic home shows the catalog entry');
  const sub = await s.eval(`(document.querySelector('.cmp-entry__sub')||{}).textContent||''`);
  s.assert(sub.includes(String(COMPONENTS.length)), `entry names ${COMPONENTS.length} components, got "${sub}"`);
  s.assert(sub.includes(String(TOTAL_EDGES)), `entry names ${TOTAL_EDGES} links, got "${sub}"`);

  // 2. Catalog renders every category and every component.
  await s.eval(`document.getElementById('catalog-entry').click()`);
  await s.sleep(600);
  s.assert(await s.eval(`location.hash`) === '#/components/catalog', 'entry addresses the catalog');
  await s.snap('02-catalog-mobile');

  const cards = await s.eval(`document.querySelectorAll('.cmp-card').length`);
  s.assert(cards === COMPONENTS.length, `expected ${COMPONENTS.length} component cards, got ${cards}`);
  const heads = await s.eval(`Array.from(document.querySelectorAll('.part-head')).map(e=>e.textContent.trim())`);
  s.assert(heads.length === CATEGORIES.length, `expected ${CATEGORIES.length} categories, got ${heads.length}`);
  s.assert(heads[0] === CATEGORIES[0].title, `first category is "${CATEGORIES[0].title}", got "${heads[0]}"`);
  // Nothing orphaned: every authored id has a card.
  const rendered = await s.eval(`Array.from(document.querySelectorAll('.cmp-card')).map(e=>e.dataset.cmp)`);
  const missing = COMPONENTS.map(c => c.id).filter(id => !rendered.includes(id));
  s.assert(missing.length === 0, `every component renders (missing: ${missing.slice(0, 3).join(',')})`);

  // 3. Ordering — most-used first inside a category. The asymmetry IS the
  //    curriculum signal, so a flat alphabetical list would be a regression.
  const firstCatIds = await s.eval(`
    (() => {
      const out = [], heads = document.querySelectorAll('.part-head');
      let n = heads[0].nextElementSibling;
      while (n && !n.classList.contains('cmp-grid')) n = n.nextElementSibling;
      return n ? Array.from(n.querySelectorAll('.cmp-card')).map(e => e.dataset.cmp) : out;
    })()`);
  const firstCatUses = firstCatIds.map(usesOf);
  s.assert(firstCatUses.every((u, i, a) => i === 0 || a[i - 1] >= u),
    `first category ordered most-used first, got ${firstCatUses.join(',')}`);
  // Ties keep AUTHORED order rather than falling back to alphabetical.
  const authoredIdx = Object.fromEntries(COMPONENTS.map((c, i) => [c.id, i]));
  const tiesOk = firstCatIds.every((id, i) =>
    i === 0 || usesOf(firstCatIds[i - 1]) !== usesOf(id) || authoredIdx[firstCatIds[i - 1]] < authoredIdx[id]);
  s.assert(tiesOk, `ties fall back to authored order, got ${firstCatIds.join(',')}`);

  // 4. A component page carries the whole decision surface.
  const CACHING = COMPONENTS.find(c => c.id === 'caching');
  await s.eval(`document.querySelector('[data-cmp="caching"]').click()`);
  await s.sleep(600);
  await s.snap('03-component-mobile');
  s.assert(await s.eval(`location.hash`) === '#/components/c/caching', 'component page addresses itself');
  s.assert(await s.eval(`(document.querySelector('.detail-title')||{}).textContent`) === CACHING.title,
    'component title renders');
  for (const [mod, field] of [['yes', 'reachFor'], ['no', 'avoid'], ['cost', 'costs'], ['fail', 'failureModes']]) {
    const n = await s.eval(`document.querySelectorAll('.cmp-block--${mod} li').length`);
    s.assert(n === CACHING[field].length, `${field} renders ${CACHING[field].length} items, got ${n}`);
  }
  const altN = await s.eval(`document.querySelectorAll('.cmp-alts li').length`);
  s.assert(altN === CACHING.alternatives.length, `alternatives render (${altN}/${CACHING.alternatives.length})`);

  // 5. The Used-in list matches the edge file exactly.
  const uses = await s.eval(`document.querySelectorAll('.cmp-use').length`);
  s.assert(uses === usesOf('caching'), `caching used in ${usesOf('caching')} problems, got ${uses}`);
  const usedIds = await s.eval(`Array.from(document.querySelectorAll('.cmp-use')).map(e=>e.dataset.prob)`);
  const expectIds = Object.keys(EDGES.caching).sort();
  s.assert(JSON.stringify(usedIds) === JSON.stringify(expectIds),
    `used-in ids match the edge file, got ${usedIds.join(',')}`);
  // Every row carries its annotation — without it the page is a link farm,
  // which is the exact failure this surface was built to avoid.
  const notes = await s.eval(`Array.from(document.querySelectorAll('.cmp-use__note')).map(e=>e.textContent.trim())`);
  s.assert(notes.every(n => n.length > 20), 'every used-in row carries a real annotation');
  s.assert(notes[0] === EDGES.caching[expectIds[0]],
    `annotation is the authored string, got "${notes[0].slice(0, 40)}…"`);

  // 6. ── The bidirectional assertion ────────────────────────────────────────
  // Walk component → problem, then read the same edge from the problem's side.
  // The two must be the SAME string. This is the invariant the whole surface
  // rests on, and the only one whose failure is invisible on both pages.
  await s.eval(`document.querySelector('[data-prob="p02"]').click()`);
  await s.sleep(900);
  await s.snap('04-problem-mobile');
  s.assert(await s.eval(`location.hash`) === '#/design-problems/p02', 'component → problem traversal lands');

  const inPlay = await s.eval(`
    Array.from(document.querySelectorAll('.cmp-inplay .cmp-use')).map(e => ({
      id: e.dataset.cmpLink,
      title: (e.querySelector('.cmp-use__title')||{}).textContent.trim(),
      note: (e.querySelector('.cmp-use__note')||{}).textContent.trim()
    }))`);
  const p02Mechs = (DP.chapters.find(c => c.id === 'p02').tags.mechanism) || [];
  s.assert(inPlay.length === p02Mechs.length,
    `p02 shows ${p02Mechs.length} components in play, got ${inPlay.length}`);
  const backEdge = inPlay.find(x => x.id === 'caching');
  s.assert(!!backEdge, 'the problem links back to the caching component');
  s.assert(backEdge.note === EDGES.caching.p02,
    `SAME annotation at both endpoints — component said "${EDGES.caching.p02.slice(0, 30)}…", problem says "${(backEdge.note || '').slice(0, 30)}…"`);

  // …and the return leg completes the round trip.
  await s.eval(`document.querySelector('[data-cmp-link="caching"]').click()`);
  await s.sleep(700);
  s.assert(await s.eval(`location.hash`) === '#/components/c/caching', 'problem → component traversal returns');

  // 7. Mobile geometry: nothing overflows, everything is tappable.
  const hScroll = await s.eval(`document.documentElement.scrollWidth > window.innerWidth + 1`);
  s.assert(!hScroll, 'component page does not scroll horizontally at 390px');
  const shortRow = await s.eval(`
    Array.from(document.querySelectorAll('.cmp-use')).some(e => e.getBoundingClientRect().height < 44)`);
  s.assert(!shortRow, 'every used-in row clears the 44px tap-target floor');

  // ── Desktop, same session ────────────────────────────────────────────────
  await s.setViewport({ width: 1280, height: 900, mobile: false, deviceScaleFactor: 1 });

  // A pasted deep link opens that exact component.
  await s.eval(`location.hash = '#/components/c/consistent-hashing'`);
  await s.sleep(900);
  await s.snap('05-deeplink-desktop');
  s.assert(await s.eval(`(document.querySelector('.detail-title')||{}).textContent`) === 'Consistent Hashing',
    'a pasted component deep link opens that component');
  s.assert(await s.eval(`document.querySelectorAll('.cmp-use').length`) === usesOf('consistent-hashing'),
    'deep-linked component lists its problems');
  const dHScroll = await s.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  s.assert(dHScroll <= 1, `no horizontal scroll on desktop, overflow=${dHScroll}px`);

  // Two columns once there is room for them (mobile stays one).
  await s.eval(`location.hash = '#/components/catalog'`);
  await s.sleep(800);
  await s.snap('06-catalog-desktop');
  const cols = await s.eval(`getComputedStyle(document.querySelector('.cmp-grid')).gridTemplateColumns.split(' ').length`);
  s.assert(cols === 2, `catalog is two columns on desktop, got ${cols}`);

  // An unknown component id degrades to the catalog rather than a blank screen.
  await s.eval(`location.hash = '#/components/c/not-a-real-component'`);
  await s.sleep(800);
  s.assert(await s.eval(`document.querySelectorAll('.cmp-card').length`) === COMPONENTS.length,
    'unknown component id degrades to the catalog');

  // A catalog route on a topic that has none degrades to that topic.
  await s.eval(`location.hash = '#/ddia/catalog'`);
  await s.sleep(900);
  const ddiaCards = await s.eval(`document.querySelectorAll('.ch-card').length`);
  const strayCmp = await s.eval(`document.querySelectorAll('.cmp-card').length`);
  s.assert(ddiaCards > 0 && strayCmp === 0,
    'a catalog route on a topic without one degrades to the topic home');

  const r = s.report();
  await s.close();
  process.exit(r.failed ? 1 : 0);
})().catch(e => { console.error('probe failed:', e.message); process.exit(1); });
