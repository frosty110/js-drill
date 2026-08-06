#!/usr/bin/env node
// Durable probe for interleaved-session CONTEXT on the system-design drill.
//
// The defect this locks down: a mixed/due session shuffles questions across
// units, but the unit label was rendered only in the MC branch of
// renderQuestion(). Design problems are ~78% open questions, so four out of
// five mixed cards named no system at all — and 64% of the prompts never name
// their own system either, because they were authored for a chapter run where
// Q1 scoped it. "Estimate the scale" of nothing is not a harder question, it's
// an invalid one.
//
// Covers:
//   - every mixed card leads with the unit label + the authored scope line,
//     open and MC alike, across the whole session (not just card 1)
//   - the label names the unit the question actually belongs to
//   - chapter sessions do NOT get the block (session.title already says it)
//   - the `brief` disclosure renders, is COLLAPSED by default (retrieval
//     first), and opens on tap
//   - brief.gate hides it on the scope/estimate questions and the reveal
//     brings it back
//   - mobile: no horizontal scroll, >= 44px tap target on the disclosure
//
// Run: node tools/cdp/sd-mixed-context.js [baseUrl] [outDir]
const { ensureServer, ensureChrome, connect } = require('./lib');

const BASE = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/sd-mixed-context';
const SD = (hash) => `${BASE}system-design.html${hash || ''}`;

const MANIFEST = require('../../data/system-design/design-problems/manifest.json');
const P05 = require('../../data/system-design/design-problems/p05.json');
// The drill renders the UNIT FILE's title, which for a few problems is a longer
// form of the manifest's card title (p14/p15/p16). Assert against the files, so
// this probe tests the label without freezing that pre-existing drift.
const UNIT_TITLES = new Set(MANIFEST.chapters
  .map(c => require(`../../data/system-design/design-problems/${c.id}.json`).title));

// Read the card the session is currently showing.
const CARD = `(() => {
  const ctx = document.querySelector('.q-context');
  const br  = document.querySelector('.q-brief');
  return {
    hasCtx:  !!ctx,
    label:   ctx ? (ctx.querySelector('.q-tag') || {}).textContent : null,
    scope:   ctx ? (ctx.querySelector('.q-context__scope') || {}).textContent : null,
    stem:    (document.querySelector('.q-stem') || {}).textContent || '',
    open:    !!document.getElementById('reveal-btn'),
    hasBrief: !!br,
    briefOpen: br ? br.hasAttribute('open') : null,
    briefH:  br ? Math.round(br.querySelector('summary').getBoundingClientRect().height) : null,
    inModel: !!document.querySelector('.model .q-brief')
  };
})()`;

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // ── Mobile first: 80% of study happens on a phone (PROFILE.md) ───────────
  const s = await connect({ url: SD('#/design-problems'), mobile: true, outDir: OUT });
  // Start from a known store. A mixed session is ordered new-first over saved
  // Leitner state, so the slice this probe walks depends on whatever graded it
  // last — including OTHER probes sharing the browser profile. Measured: run
  // standalone it passed; run straight after sd-tags-nav it saw 12 open cards
  // and 0 MC, because every MC in the pool had been answered into a later box,
  // and "saw both card types" is precisely about the pool containing both.
  //
  // (Found independently on two branches at once, which is its own evidence.)
  await s.eval(`localStorage.removeItem('jsdrill.systemdesign.v1')`);
  await s.eval(`location.reload()`);
  await s.sleep(1100);

  // Make the shuffle deterministic. A mixed session is `shuffle(pool).slice(0,20)`
  // over a pool that is ~78% open questions (255 open / 73 MC across the 36
  // design problems), and this probe walks 12 cards — so "the first 12 contain
  // at least one MC" fails about 4% of the time by chance alone. It did, twice,
  // and cost a real investigation to rule out as a regression.
  //
  // Clearing the store above fixed the OTHER source of order-dependence (state
  // left by a probe that ran earlier in the same profile). This fixes the one
  // that remained: seeding Math.random makes the walk reproducible, so a
  // failure here from now on means the app changed, not that the dice did.
  await s.eval(`(() => {
    let seed = 0x2F6E2B1;
    Math.random = function () {                 // mulberry32
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })()`);

  // ── Mixed session: every card carries its unit ───────────────────────────
  await s.eval(`location.hash = '#/design-problems/mixed'`);
  await s.sleep(1200);
  await s.snap('01-mixed-card-mobile');

  let seen = 0, withCtx = 0, withScope = 0, openCards = 0, mcCards = 0, badLabel = null;
  // Walk a slice of the session — the bug was per-branch, so a single card
  // proves nothing; we need both open and MC cards to pass.
  for (let i = 0; i < 12; i++) {
    const c = await s.eval(CARD);
    if (!c.stem) break;
    seen++;
    if (c.hasCtx) withCtx++;
    if (c.scope && c.scope.trim().length > 20) withScope++;
    c.open ? openCards++ : mcCards++;
    // "Problem 5 · Design a Web Crawler" — the tail must be a real unit title.
    const tail = (c.label || '').split('·').slice(1).join('·').trim();
    if (!UNIT_TITLES.has(tail)) badLabel = badLabel || `card ${i}: "${c.label}"`;
    // Advance: answer whatever this card is.
    if (c.open) {
      await s.eval(`document.getElementById('reveal-btn').click()`);
      await s.sleep(250);
      await s.eval(`document.querySelector('#action-bar [data-g="good"]').click()`);
    } else {
      await s.eval(`document.querySelector('.ds-opt').click()`);
      await s.sleep(250);
      await s.eval(`document.getElementById('next-btn').click()`);
    }
    await s.sleep(400);
  }
  s.assert(seen >= 8, `walked a real session, saw ${seen} cards`);
  s.assert(openCards > 0 && mcCards > 0, `saw both card types (open=${openCards}, mc=${mcCards}) — the bug was per-branch`);
  s.assert(withCtx === seen, `every mixed card carries the unit block (${withCtx}/${seen})`);
  s.assert(withScope === seen, `every mixed card carries the authored scope line (${withScope}/${seen})`);
  s.assert(!badLabel, `unit label names a real problem${badLabel ? ` — got ${badLabel}` : ''}`);

  // ── Due session is the same shape ────────────────────────────────────────
  await s.eval(`location.hash = '#/design-problems/due'`);
  await s.sleep(1200);
  const due = await s.eval(CARD);
  s.assert(due.hasCtx, 'due review carries the unit block too (same session.mixed flag)');

  // ── Chapter session does NOT (session.title already names the unit) ──────
  await s.eval(`location.hash = '#/design-problems/p05'`);
  await s.sleep(900);
  await s.eval(`document.getElementById('drill-all').click()`);
  await s.sleep(900);
  const ch0 = await s.eval(CARD);
  s.assert(!ch0.hasCtx, 'chapter session omits the block — the title bar already says the unit');

  // ── brief.gate: hidden on the scope question, back after the reveal ──────
  s.assert(P05.brief.gate.includes(0), 'fixture: p05 gates its scope question');
  s.assert(!ch0.hasBrief, 'gated question hides the brief before answering');
  if (ch0.open) {
    await s.eval(`document.getElementById('reveal-btn').click()`);
    await s.sleep(400);
    const revealed = await s.eval(CARD);
    s.assert(revealed.inModel, 'the gated brief appears with the model answer, where it grades rather than feeds');
    await s.snap('02-gated-brief-revealed');
    await s.eval(`document.querySelector('#action-bar [data-g="good"]').click()`);
    await s.sleep(500);
  }

  // ── Ungated question: collapsed by default, opens on tap ────────────────
  // Walk to a question index p05 does not gate.
  let card = await s.eval(CARD);
  for (let i = 0; i < 4 && !card.hasBrief; i++) {
    if (card.open) {
      await s.eval(`document.getElementById('reveal-btn').click()`);
      await s.sleep(250);
      await s.eval(`document.querySelector('#action-bar [data-g="good"]').click()`);
    } else {
      await s.eval(`document.querySelector('.ds-opt').click()`);
      await s.sleep(250);
      await s.eval(`document.getElementById('next-btn').click()`);
    }
    await s.sleep(500);
    card = await s.eval(CARD);
  }
  s.assert(card.hasBrief, 'ungated questions carry the brief disclosure');
  s.assert(card.briefOpen === false, 'brief is COLLAPSED by default — retrieve first, numbers on one tap');
  s.assert(card.briefH >= 44, `brief summary is a >=44px tap target, got ${card.briefH}px`);
  await s.eval(`document.querySelector('.q-brief > summary').click()`);
  await s.sleep(300);
  const opened = await s.eval(`(() => {
    const b = document.querySelector('.q-brief');
    return { open: b.hasAttribute('open'), items: b.querySelectorAll('li').length, heads: b.querySelectorAll('h5').length };
  })()`);
  s.assert(opened.open, 'brief opens on tap');
  s.assert(opened.items >= 4 && opened.heads === 2, `brief shows both sections (${opened.heads} heads, ${opened.items} bullets)`);
  await s.snap('03-brief-open-mobile');

  const hScroll = await s.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  s.assert(hScroll <= 1, `no horizontal scroll on mobile, overflow=${hScroll}px`);

  // ── Desktop ─────────────────────────────────────────────────────────────
  await s.setViewport({ width: 1280, height: 900, mobile: false, deviceScaleFactor: 1 });
  await s.eval(`location.hash = '#/design-problems/mixed'`);
  await s.sleep(1200);
  const desk = await s.eval(CARD);
  s.assert(desk.hasCtx && !!desk.scope, 'desktop mixed card carries unit + scope');
  const dScroll = await s.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  s.assert(dScroll <= 1, `no horizontal scroll on desktop, overflow=${dScroll}px`);
  await s.snap('04-mixed-card-desktop');

  // Same-origin only: the page also pulls Supabase and Mermaid from a CDN, and
  // a sandboxed or offline runner blocks those without the drill caring.
  const localFails = s.networkErrors.filter(e => (e.url || e).includes('localhost'));
  s.assert(localFails.length === 0, `no failed same-origin requests (${localFails.length})`);

  const r = s.report();
  await s.close();
  process.exit(r.failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
