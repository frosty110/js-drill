#!/usr/bin/env node
// Durable probe for the Canonical Design Problems taxonomy + faceted filter.
//
// Covers what P1 shipped and what would silently rot:
//   - re-parted families render in authored order
//   - displayNum is contiguous 1..N even though chapter ids are non-sequential
//     (p01, p14, p02, … must show 1, 2, 3, …) — the whole point of the
//     ids-are-permanent rule
//   - tag chips on cards + detail
//   - filter panel: AND across facets / OR within, flat list under a filter,
//     empty state, clear
//   - #/<topic>/tag/<facet>/<value> deep links land on the filtered list
//   - other topics are untouched by the tag layer
//   - mobile: no horizontal scroll, tap targets >= 44px on the filter head
//
// Run: node tools/cdp/sd-tags-nav.js [baseUrl] [outDir]
const { ensureServer, ensureChrome, connect } = require('./lib');

const BASE = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/sd-tags-nav';
const SD = (hash) => `${BASE}system-design.html${hash || ''}`;

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // ── Mobile first: 80% of study happens on a phone (PROFILE.md) ───────────
  const s = await connect({ url: SD('#/design-problems'), mobile: true, outDir: OUT });
  await s.sleep(900);
  await s.snap('01-topic-home-mobile');

  const parts = await s.eval(`
    Array.from(document.querySelectorAll('.part-head')).map(e => e.textContent.trim())`);
  s.assert(Array.isArray(parts) && parts.length === 7, `expected 7 families, got ${parts && parts.length}`);
  s.assert(parts[0] === 'Read-Heavy Systems & Search', `first family: ${parts[0]}`);
  s.assert(parts.includes('Infrastructure Primitives'), 'Infrastructure Primitives family present');
  s.assert(!parts.includes('Feeds & Read-Heavy Systems'), 'old part names gone');

  // displayNum: contiguous 1..N in parts order, NOT the p-number order.
  const nums = await s.eval(`
    Array.from(document.querySelectorAll('.ch-card .ch-num')).map(e => e.textContent.trim())`);
  s.assert(nums.length === 21, `expected 21 cards, got ${nums.length}`);
  const asNums = nums.filter(n => /^\d+$/.test(n)).map(Number);
  s.assert(asNums.length === 0 || asNums.every((n, i, a) => i === 0 || n > a[i - 1]),
    `displayNum must ascend, got ${nums.join(',')}`);
  const order = await s.eval(`
    Array.from(document.querySelectorAll('.ch-card')).map(e => e.dataset.ch).join(',')`);
  s.assert(order.startsWith('p01,p14,p02'), `authored order drives display, got ${order.slice(0, 20)}`);

  // Second card is Typeahead (p14) but must render as "2".
  const secondNum = await s.eval(`document.querySelectorAll('.ch-card')[1].querySelector('.ch-num').textContent.trim()`);
  const secondId = await s.eval(`document.querySelectorAll('.ch-card')[1].dataset.ch`);
  s.assert(secondId === 'p14', `second card is p14, got ${secondId}`);
  s.assert(secondNum === '2' || secondNum === '✓', `p14 displays as 2, got ${secondNum}`);

  // ── Unit-level rollup ────────────────────────────────────────────────────
  // topicStats() counts QUESTIONS; the hero headline must count UNITS, or a
  // 21-problem topic reads "0 of 195 mastered". Both appear, each with its noun.
  const heroCopy = await s.eval(`document.querySelector('.overall .stat-copy').textContent.replace(/\\s+/g,' ').trim()`);
  s.assert(/of 21 problems mastered/.test(heroCopy), `hero counts units, got: ${heroCopy}`);
  // Don't hardcode the question total — it moves with every authored problem.
  // What must hold is that both grains appear and the question count is larger.
  const qm = heroCopy.match(/(\d+)\/(\d+) questions/);
  s.assert(qm && Number(qm[2]) > 21, `hero still reports question grain and it exceeds unit count, got: ${heroCopy}`);
  s.assert(/problems? due for review/.test(heroCopy), `due count carries the unit noun, got: ${heroCopy}`);
  // The noun comes from the manifest's unitLabel, so other topics say their own.
  await s.eval(`location.hash = '#/ddia'`);
  await s.sleep(900);
  const ddiaCopy = await s.eval(`document.querySelector('.overall .stat-copy').textContent.replace(/\\s+/g,' ').trim()`);
  s.assert(/of 12 chapters mastered/.test(ddiaCopy), `ddia uses its own unit noun, got: ${ddiaCopy}`);
  await s.eval(`location.hash = '#/design-problems'`);
  await s.sleep(900);

  // ── Tag chips on cards ───────────────────────────────────────────────────
  const chipCount = await s.eval(`document.querySelectorAll('.ch-card .ch-tags .sd-chip').length`);
  s.assert(chipCount >= 21, `every card carries chips, got ${chipCount}`);
  const firstChips = await s.eval(`
    Array.from(document.querySelectorAll('.ch-card')[0].querySelectorAll('.sd-chip')).map(e => e.textContent.trim()).join('|')`);
  s.assert(/Easy/.test(firstChips), `p01 shows its difficulty chip, got ${firstChips}`);

  // ── Filter panel ─────────────────────────────────────────────────────────
  s.assert(await s.eval(`!!document.getElementById('filter-toggle')`), 'filter toggle renders');
  const headH = await s.eval(`document.getElementById('filter-toggle').getBoundingClientRect().height`);
  s.assert(headH >= 44, `filter head >= 44px tap target, got ${headH}`);

  await s.eval(`document.getElementById('filter-toggle').click()`);
  await s.sleep(400);
  await s.snap('02-filter-open');
  const facetLabels = await s.eval(`
    Array.from(document.querySelectorAll('.sd-facet-label')).map(e => e.textContent.trim()).join('|')`);
  s.assert(/Mechanism/.test(facetLabels), `mechanism facet offered, got ${facetLabels}`);
  s.assert(/Difficulty/.test(facetLabels), `difficulty facet offered, got ${facetLabels}`);

  // OR within a facet: caching is on 6 problems.
  await s.eval(`
    document.querySelector('.sd-chip--btn[data-facet="mechanism"][data-val="caching"]').click()`);
  await s.sleep(400);
  await s.snap('03-filter-caching');
  const cachingHits = await s.eval(`document.querySelectorAll('.ch-card').length`);
  s.assert(cachingHits >= 5 && cachingHits < 21, `caching narrows the list, got ${cachingHits}`);
  s.assert(await s.eval(`document.querySelectorAll('.part-head').length === 1`),
    'filtered view collapses families into one flat list');
  s.assert(/match/.test(await s.eval(`document.querySelector('.part-head').textContent`)),
    'flat list shows a match count');

  // AND across facets: caching AND hard should be strictly narrower.
  await s.eval(`document.querySelector('.sd-chip--btn[data-facet="difficulty"][data-val="hard"]').click()`);
  await s.sleep(400);
  const andHits = await s.eval(`document.querySelectorAll('.ch-card').length`);
  s.assert(andHits < cachingHits, `AND across facets narrows further (${andHits} < ${cachingHits})`);
  s.assert(await s.eval(`document.querySelector('.sd-filter-count').textContent.trim() === '2 active'`),
    'active-filter count reflects both facets');

  // Clear returns to the grouped view.
  await s.eval(`document.getElementById('filter-clear').click()`);
  await s.sleep(400);
  s.assert(await s.eval(`document.querySelectorAll('.ch-card').length === 21`), 'clear restores all 21');
  s.assert(await s.eval(`document.querySelectorAll('.part-head').length === 7`), 'clear restores families');

  // ── Empty state ──────────────────────────────────────────────────────────
  await s.eval(`
    document.querySelector('.sd-chip--btn[data-facet="mechanism"][data-val="saga"]').click()`);
  await s.sleep(300);
  await s.eval(`document.querySelector('.sd-chip--btn[data-facet="difficulty"][data-val="easy"]').click()`);
  await s.sleep(400);
  await s.snap('04-empty-state');
  s.assert(await s.eval(`!!document.querySelector('.sd-empty')`), 'impossible combination shows empty state');
  await s.eval(`document.getElementById('filter-clear').click()`);
  await s.sleep(300);

  // ── Detail screen chips + deep link ──────────────────────────────────────
  await s.eval(`location.hash = '#/design-problems/p12'`);
  await s.sleep(800);
  await s.snap('05-detail-chips');
  const detailChips = await s.eval(`
    Array.from(document.querySelectorAll('.detail-tags .sd-chip')).map(e => e.textContent.trim()).join('|')`);
  s.assert(/Consistent hashing/.test(detailChips), `p12 shows mechanism chips, got ${detailChips}`);
  s.assert(await s.eval(`
    !!document.querySelector('.detail-tags a[href*="tag/mechanism/consistent-hashing"]')`),
    'mechanism chip links to its filtered list');

  // The transfer surface: tapping consistent-hashing shows every problem using it.
  await s.eval(`location.hash = '#/design-problems/tag/mechanism/consistent-hashing'`);
  await s.sleep(900);
  await s.snap('06-tag-deeplink');
  const chIds = await s.eval(`
    Array.from(document.querySelectorAll('.ch-card')).map(e => e.dataset.ch).sort().join(',')`);
  s.assert(chIds === 'p08,p12,p21', `consistent-hashing deep link lists p08+p12+p21, got ${chIds}`);
  s.assert(await s.eval(`document.querySelectorAll('.sd-chip--btn.is-on').length === 1`),
    'deep link REPLACES the filter rather than adding to saved state');

  // A tag link with an unknown facet must not wedge the page.
  await s.eval(`location.hash = '#/design-problems/tag/bogus/nope'`);
  await s.sleep(700);
  s.assert(await s.eval(`document.querySelectorAll('.ch-card').length > 0`), 'unknown facet degrades to the list');

  // ── Other topics untouched ───────────────────────────────────────────────
  await s.eval(`location.hash = '#/ddia'`);
  await s.sleep(900);
  s.assert(await s.eval(`!document.getElementById('filter-toggle')`), 'ddia has no filter panel');
  s.assert(await s.eval(`document.querySelectorAll('.ch-card .ch-tags').length === 0`), 'ddia cards carry no chips');
  const ddiaNums = await s.eval(`
    Array.from(document.querySelectorAll('.ch-card .ch-num')).map(e => e.textContent.trim()).join(',')`);
  s.assert(/^(1|✓),/.test(ddiaNums), `ddia numbering unchanged, got ${ddiaNums.slice(0, 20)}`);

  // ── Mobile overflow ──────────────────────────────────────────────────────
  await s.eval(`location.hash = '#/design-problems'`);
  await s.sleep(800);
  await s.eval(`document.getElementById('filter-toggle').click()`);
  await s.sleep(400);
  const hScroll = await s.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  s.assert(hScroll <= 1, `no horizontal scroll on mobile, overflow=${hScroll}px`);
  await s.snap('07-mobile-filter-open');

  // ── Desktop, same session ────────────────────────────────────────────────
  await s.setViewport({ width: 1280, height: 900, mobile: false, deviceScaleFactor: 1 });
  await s.eval(`location.hash = '#/ddia'`);
  await s.sleep(400);
  await s.eval(`location.hash = '#/design-problems'`);
  await s.sleep(900);
  await s.snap('08-topic-home-desktop');
  s.assert(await s.eval(`document.querySelectorAll('.ch-card').length === 21`), 'desktop lists 21');
  s.assert(await s.eval(`document.querySelectorAll('.part-head').length === 7`), 'desktop shows 7 families');
  const dScroll = await s.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  s.assert(dScroll <= 1, `no horizontal scroll on desktop, overflow=${dScroll}px`);

  const r = s.report();
  await s.close();
  process.exit(r.failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
