#!/usr/bin/env node
// Durable probe for the API + data-model steps on the four Bretton design problems.
//
// The defect this locks down is silent twice over:
//
//   1. A mermaid syntax error does NOT throw. renderDiagramInto() catches it and
//      falls through to `<pre class="diagram-src">` — the same fallback used when
//      the CDN is blocked. So a malformed diagram renders as a wall of source and
//      every gate stays green, because the validator only checks that the code
//      starts with an allowed header.
//   2. `afterQuestion` is a positional index. Inserting the two arc steps shifted
//      every question after them, so an un-updated anchor still points at a VALID
//      index and simply attaches the wrong picture to the wrong question. Nothing
//      errors; the deck just teaches the wrong thing.
//
// Covers:
//   - each of p33-p36 asks for the API at Q3 and the data model at Q4 (the arc in
//     data/system-design/design-problems/BRIEF.md, which all four skipped)
//   - every new question's diagram renders to a real <svg>, not the source fallback
//   - the data-model question carries BOTH its own diagram and the deck's
//     architecture-overview, proving the shifted anchor landed on the right question
//   - the reveal shows real endpoints and real table DDL, not prose about them
//   - mobile: the diagrams do not overflow a 390px viewport
//
// Run: node tools/cdp/sd-bretton-arc.js [baseUrl] [outDir]
const { ensureServer, ensureChrome, connect } = require('./lib');

const BASE = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/sd-bretton-arc';
const SD = (hash) => `${BASE}system-design.html${hash || ''}`;

const UNITS = ['p33', 'p34', 'p35', 'p36'];
// The authored source is the fixture: the probe asserts the SHIPPED page matches
// what the JSON claims, rather than freezing a copy of the copy.
const FILES = Object.fromEntries(UNITS.map(id =>
  [id, require(`../../data/system-design/design-problems/${id}.json`)]));

// Read the reveal state: how many diagrams the deck holds, and whether the one on
// screen is a rendered SVG or the source-code fallback.
const REVEAL = `(() => {
  const deck = document.querySelector('.diagram-deck');
  const slot = deck && deck.querySelector('.diagram-slot');
  return {
    stem:   (document.querySelector('.q-stem') || {}).textContent || '',
    points: [...document.querySelectorAll('.model ul li')].map(li => li.textContent),
    codes:  [...document.querySelectorAll('.model ul li code')].map(c => c.textContent),
    answer: (document.querySelector('.model .ans') || {}).textContent || '',
    count:  deck ? (deck.querySelector('.diagram-deck__count') || {}).textContent : null,
    title:  deck ? (deck.querySelector('.diagram-deck__title') || {}).textContent : null,
    svg:    !!(slot && slot.querySelector('svg')),
    fellBack: !!(slot && slot.querySelector('pre.diagram-src')),
    wide:   slot ? Math.round(slot.scrollWidth) : 0
  };
})()`;

// Painting is async — settle on either outcome so the SVG-vs-fallback assertion
// is reading a finished deck rather than the "Rendering diagram…" placeholder.
const PAINTED = `!!document.querySelector('.diagram-slot svg, .diagram-slot pre.diagram-src')`;

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // Mobile first — 80% of study happens on a phone (PROFILE.md).
  const s = await connect({ url: SD('#/design-problems'), mobile: true, outDir: OUT });
  // Leitner state changes which questions a session serves; start from a known
  // store so a rerun (or another probe sharing the profile) walks the same slice.
  await s.eval(`localStorage.removeItem('jsdrill.systemdesign.v1')`);
  await s.reload();
  await s.waitFor(`!!document.querySelector('.topic-hero, .ch-card, #sd-app')`, { timeoutMs: 15000 });

  const vw = await s.eval(`window.innerWidth`);

  for (const id of UNITS) {
    const unit = FILES[id];
    const overview = unit.diagrams.find(d => d.id === 'architecture-overview');

    // Fixture guards: if the arc regresses in the JSON, say so here rather than
    // letting the DOM assertions fail with a confusing message.
    s.assert(/API/i.test(unit.questions[2].prompt), `${id}: Q3 is the API step`);
    s.assert(/data model/i.test(unit.questions[3].prompt), `${id}: Q4 is the data-model step`);
    s.assert(overview.afterQuestion === 3,
      `${id}: architecture-overview anchors to the data-model question (got ${overview.afterQuestion})`);

    await s.eval(`location.hash = '#/design-problems/${id}'`);
    await s.waitFor(`!!document.getElementById('drill-all')`, { timeoutMs: 15000 });
    await s.eval(`document.getElementById('drill-all').click()`);
    await s.waitFor(`!!document.getElementById('reveal-btn')`, { timeoutMs: 15000 });

    // Walk to Q3 (index 2). Q1 and Q2 are both open in all four units.
    for (let i = 0; i < 2; i++) {
      await s.eval(`document.getElementById('reveal-btn').click()`);
      await s.waitFor(`!!document.querySelector('#action-bar [data-g="good"]')`, { timeoutMs: 10000 });
      await s.eval(`document.querySelector('#action-bar [data-g="good"]').click()`);
      await s.waitFor(`!!document.getElementById('reveal-btn')`, { timeoutMs: 10000 });
    }

    // ── Q3: the API step ──────────────────────────────────────────────────
    await s.eval(`document.getElementById('reveal-btn').click()`);
    await s.waitFor(PAINTED, { timeoutMs: 20000 });
    const api = await s.eval(REVEAL);
    s.assert(api.stem === unit.questions[2].prompt, `${id} Q3: the API question is on screen`);
    s.assert(api.svg && !api.fellBack,
      `${id} Q3: diagram rendered to SVG${api.fellBack ? ' — FELL BACK to source, mermaid syntax is bad' : ''}`);
    s.assert(api.count === '1 / 1', `${id} Q3: exactly its own diagram (got ${api.count})`);
    // The point of the step: concrete endpoints, not prose about having an API.
    const endpoints = api.points.filter(p => /\b(GET|POST|PUT|DELETE)\s+\/v1\//.test(p)).length;
    s.assert(endpoints >= 3, `${id} Q3: rubric names >= 3 real endpoints (got ${endpoints})`);
    s.assert(api.wide <= vw, `${id} Q3: diagram fits ${vw}px without overflow (${api.wide}px)`);
    await s.snap(`${id}-q3-api`);

    await s.eval(`document.querySelector('#action-bar [data-g="good"]').click()`);
    await s.waitFor(`!!document.getElementById('reveal-btn')`, { timeoutMs: 10000 });

    // ── Q4: the data-model step ───────────────────────────────────────────
    await s.eval(`document.getElementById('reveal-btn').click()`);
    await s.waitFor(PAINTED, { timeoutMs: 20000 });
    const dm = await s.eval(REVEAL);
    s.assert(dm.stem === unit.questions[3].prompt, `${id} Q4: the data-model question is on screen`);
    s.assert(dm.svg && !dm.fellBack,
      `${id} Q4: diagram rendered to SVG${dm.fellBack ? ' — FELL BACK to source, mermaid syntax is bad' : ''}`);
    // Two diagrams here is the shifted-anchor proof: the question's own schema
    // picture PLUS the deck's architecture-overview, which had to move with it.
    s.assert(dm.count === '1 / 2',
      `${id} Q4: carries its own diagram + the re-anchored architecture-overview (got ${dm.count})`);
    // Real table definitions — `name(col, col, ...)` rendered as code, not prose
    // saying the design "has a data model". Lowercase head excludes `UNIQUE(...)`.
    const tables = dm.codes.filter(c => /^[a-z_]+\([a-z_]+.*,.*\)$/.test(c.trim()));
    s.assert(tables.length >= 5,
      `${id} Q4: rubric defines >= 5 tables with columns (got ${tables.length}: ${tables.map(t => t.split('(')[0]).join(', ')})`);
    s.assert(dm.wide <= vw, `${id} Q4: diagram fits ${vw}px without overflow (${dm.wide}px)`);
    await s.snap(`${id}-q4-datamodel`);

    // The second diagram in the deck must render too — it is painted lazily, so
    // an anchor pointing at a broken neighbour would go unseen without this.
    await s.eval(`document.querySelector('.diagram-next').click()`);
    await s.waitFor(PAINTED, { timeoutMs: 20000 });
    const second = await s.eval(REVEAL);
    s.assert(second.svg && !second.fellBack, `${id} Q4: the second deck diagram renders too`);
    s.assert(second.title === overview.title,
      `${id} Q4: second diagram is the architecture overview (got "${second.title}")`);
  }

  const r = s.report();
  await s.close();
  process.exit(r.failed ? 1 : 0);
})();
