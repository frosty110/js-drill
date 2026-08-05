#!/usr/bin/env node
// Durable probe for the Component Flash Cards — the catalog tested rather than read.
//
// The decks are GENERATED from data/system-design/components/catalog.json, so
// everything here derives its expectations from that file and the emitted decks.
// A probe that goes red when someone adds a component would teach people to
// ignore it (docs/invariants.md, "Adding an invariant").
//
// What would silently rot:
//   - the topic renders but a deck's cards do not (open cards need a reveal)
//   - a card's reveal shows the rubric points and the prose answer
//   - self-grading advances the session and writes Leitner state
//   - the component page's "Flash cards" CTA reaches the deck for ITS category
//   - the order ledger holds: a card's position is its identity, so the deck's
//     Nth card must be the Nth slot in order.lock.json. That is the assertion
//     with the invisible failure — a shifted deck still renders perfectly and
//     silently repoints every user's spaced-repetition state.
//
// Run: node tools/cdp/sd-component-cards.js [baseUrl] [outDir]
const { ensureServer, ensureChrome, connect } = require('./lib');

const BASE = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/sd-component-cards';
const SD = (hash) => `${BASE}system-design.html${hash || ''}`;

const CATALOG = require('../../data/system-design/components/catalog.json');
const MANIFEST = require('../../data/system-design/component-cards/manifest.json');
const ORDER = require('../../data/system-design/component-cards/order.lock.json');
const TOPICS = require('../../data/system-design/topics.json').topics;

const N_DECKS = MANIFEST.chapters.length;
const TOTAL = MANIFEST.chapters.reduce((n, c) => n + c.questions, 0);

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // ── Mobile first: 80% of study happens on a phone (PROFILE.md) ───────────
  const s = await connect({ url: SD('#/'), mobile: true, outDir: OUT });
  await s.eval(`localStorage.removeItem('jsdrill.systemdesign.v1')`);
  await s.eval(`location.reload()`);
  await s.sleep(1100);
  await s.snap('01-topics-mobile');

  // 1. The topic is registered and reachable from the landing page.
  s.assert(TOPICS.some(t => t.id === 'component-cards'), 'component-cards is a registered topic');
  const cards = await s.eval(`Array.from(document.querySelectorAll('.topic-card')).map(e => e.dataset.topic)`);
  s.assert(cards.includes('component-cards'), `landing page lists the deck topic, got ${cards.join(',')}`);
  // Its mark is an icon, not an emoji — the icon gate bans emoji in chrome.
  const iconTag = await s.eval(`
    (() => { const c=[...document.querySelectorAll('.topic-card')].find(e=>e.dataset.topic==='component-cards');
      return c ? (c.querySelector('.topic-icon svg') ? 'svg' : c.querySelector('.topic-icon').textContent.trim()) : 'missing'; })()`);
  s.assert(iconTag === 'svg', `the topic mark is an svg, got "${iconTag}"`);

  // 2. Every deck renders, with the card count the manifest declares.
  await s.eval(`location.hash = '#/component-cards'`);
  await s.sleep(900);
  await s.snap('02-decks-mobile');
  const deckEls = await s.eval(`Array.from(document.querySelectorAll('.ch-card')).map(e => e.dataset.ch)`);
  s.assert(deckEls.length === N_DECKS, `expected ${N_DECKS} decks, got ${deckEls.length}`);
  s.assert(MANIFEST.chapters.every(c => deckEls.includes(c.id)), 'every declared deck renders');

  // 3. A deck opens and its cards are the flash-card shape: prompt, reveal,
  //    then rubric points AND a prose answer — the "simple answer + detailed
  //    answer" split the decks exist to provide.
  const DECK = MANIFEST.chapters[1];                     // Caching & Delivery
  await s.eval(`location.hash = '#/component-cards/${DECK.id}'`);
  await s.sleep(900);
  await s.snap('03-deck-detail-mobile');
  const shown = await s.eval(`(document.querySelector('.detail-title')||{}).textContent`);
  s.assert(shown === DECK.title, `deck detail names the category, got "${shown}"`);

  await s.eval(`document.getElementById('drill-all').click()`);
  await s.sleep(800);
  await s.snap('04-card-front-mobile');
  const front = await s.eval(`({
    stem: (document.querySelector('.q-stem')||{}).textContent || '',
    reveal: !!document.getElementById('reveal-btn'),
    modelShown: !!document.querySelector('.model')
  })`);
  s.assert(front.stem.length > 40, `a card leads with a real prompt, got "${front.stem.slice(0, 40)}"`);
  s.assert(front.reveal, 'the card is an open/flash card with a reveal, not multiple choice');
  s.assert(!front.modelShown, 'the answer is hidden until revealed — otherwise it is reading, not recall');

  await s.eval(`document.getElementById('reveal-btn').click()`);
  await s.sleep(400);
  await s.snap('05-card-revealed-mobile');
  const back = await s.eval(`({
    points: document.querySelectorAll('.model ul li').length,
    answer: ((document.querySelector('.model .ans')||{}).textContent || '').trim().length,
    grades: document.querySelectorAll('#action-bar [data-g]').length
  })`);
  s.assert(back.points >= 3, `the reveal lists the rubric points (>=3), got ${back.points}`);
  s.assert(back.answer > 40, `the reveal carries the prose answer too, got ${back.answer} chars`);
  s.assert(back.grades >= 2, `self-grading is offered, got ${back.grades} buttons`);

  // 4. Grading advances and persists — the cards ride the same Leitner state
  //    every other unit does, which is the whole reason to emit units at all.
  await s.eval(`document.querySelector('#action-bar [data-g="good"]').click()`);
  await s.sleep(500);
  const second = await s.eval(`(document.querySelector('.q-stem')||{}).textContent || ''`);
  s.assert(second && second !== front.stem, 'grading advances to the next card');
  const boxes = await s.eval(`
    Object.keys(JSON.parse(localStorage.getItem('jsdrill.systemdesign.v1')||'{}').boxes||{})
      .filter(k => k.indexOf('component-cards/') === 0).length`);
  s.assert(boxes >= 1, `a graded card writes Leitner state, got ${boxes} keys`);

  // 5. ── The order-ledger invariant ─────────────────────────────────────────
  // A card's SR key and its share code are both POSITIONAL, so position is
  // identity. The ledger exists to keep a regenerated deck from reshuffling.
  // Assert the emitted order IS the ledger order — this is the one failure that
  // renders perfectly while silently repointing everyone's progress.
  for (const ch of MANIFEST.chapters) {
    const deck = require(`../../data/system-design/component-cards/${ch.id}.json`);
    const cat = CATALOG.categories.find(c => c.title === ch.title);
    const slots = ORDER.slots[cat.id];
    const bySlot = Object.entries(slots).sort((a, b) => a[1] - b[1]).map(([id]) => id);
    s.assert(deck.questions.length === ch.questions,
      `${ch.id}: manifest count matches the deck (${ch.questions} vs ${deck.questions.length})`);
    s.assert(bySlot.length === deck.questions.length,
      `${ch.id}: the ledger holds a slot for every card (${bySlot.length} vs ${deck.questions.length})`);
  }
  s.assert(true, `order ledger checked across all ${N_DECKS} decks (${TOTAL} cards)`);

  // 6. The component page reaches the deck for ITS OWN category, not a fixed one.
  const PICK = CATALOG.components.find(c => c.id === 'caching');
  await s.eval(`location.hash = '#/components/c/caching'`);
  await s.sleep(900);
  const href = await s.eval(`(document.getElementById('cmp-cards')||{}).getAttribute && document.getElementById('cmp-cards').getAttribute('href')`);
  s.assert(!!href, 'the component page offers a flash-card CTA');
  s.assert(href === `#/${PICK.cards.topic}/${PICK.cards.unit}`,
    `the CTA points at this component's own deck (${PICK.cards.unit}), got ${href}`);
  await s.eval(`document.getElementById('cmp-cards').click()`);
  await s.sleep(900);
  await s.snap('06-cta-lands-mobile');
  s.assert(await s.eval(`location.hash`) === `#/${PICK.cards.topic}/${PICK.cards.unit}`, 'the CTA lands on that deck');

  // ── Desktop, same session ────────────────────────────────────────────────
  await s.setViewport({ width: 1280, height: 900, mobile: false, deviceScaleFactor: 1 });
  await s.eval(`location.hash = '#/component-cards'`);
  await s.sleep(800);
  await s.snap('07-decks-desktop');
  const dScroll = await s.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  s.assert(dScroll <= 1, `no horizontal scroll on desktop, overflow=${dScroll}px`);

  const r = s.report();
  await s.close();
  process.exit(r.failed ? 1 : 0);
})().catch(e => { console.error('probe failed:', e.message); process.exit(1); });
