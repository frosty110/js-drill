// system-design-visual-deck.js — mobile regression probe for the canonical
// design-problem architecture decks.
//
// Verifies: four diagrams load, Mermaid renders, carousel navigation works,
// label recall hides/reveals SVG text, the relevant architecture diagram is
// co-located with its revealed interview answer, and the 390px viewport never
// overflows horizontally.
//
//   node tools/cdp/system-design-visual-deck.js [outDir]

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('./lib');

const OUT = process.argv[2] || '/tmp/jsdrill-system-design-visual-deck';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({
    url: 'http://localhost:8765/system-design.html',
    mobile: true,
    outDir: path.join(OUT, 'mobile'),
    waitForLoadMs: 2200
  });

  await s.waitFor(`document.querySelector('.topic-card[data-topic="design-problems"]')`, { timeoutMs: 6000 });
  await s.eval(`document.querySelector('.topic-card[data-topic="design-problems"]').click()`);
  await s.waitFor(`document.querySelector('.ch-card[data-ch="p01"]')`, { timeoutMs: 6000 });
  await s.eval(`document.querySelector('.ch-card[data-ch="p01"]').click()`);
  await s.waitFor(`document.querySelector('.diagram-deck .diagram-box svg')`, { timeoutMs: 10000 });

  const initial = await s.eval(`(() => {
    const deck = document.querySelector('.diagram-deck');
    const controls = [...deck.querySelectorAll('.diagram-deck__controls button')];
    return {
      authored: CH['design-problems'].p01.diagrams.length,
      count: deck.querySelector('.diagram-deck__count').textContent.trim(),
      title: deck.querySelector('.diagram-deck__title').textContent.trim(),
      rendered: !!deck.querySelector('.diagram-box svg'),
      minControlHeight: Math.min(...controls.map(b => b.getBoundingClientRect().height)),
      noHScroll: document.documentElement.scrollWidth <= innerWidth
    };
  })()`);
  s.assert(initial.authored === 4 && initial.count === '1 / 4', `four-diagram deck is present (${JSON.stringify(initial)})`);
  s.assert(initial.rendered, 'first architecture diagram rendered as SVG');
  s.assert(initial.minControlHeight >= 44, `deck controls are mobile-sized (${initial.minControlHeight}px)`);
  s.assert(initial.noHScroll, 'detail deck has no horizontal overflow at 390px');
  await s.snap('01-overview');

  await s.eval(`document.querySelector('.diagram-next').click()`);
  await s.waitFor(`document.querySelector('.diagram-deck__count').textContent.trim() === '2 / 4'`);
  const secondTitle = await s.eval(`document.querySelector('.diagram-deck__title').textContent.trim()`);
  s.assert(secondTitle !== initial.title, `next control changes diagrams (${initial.title} → ${secondTitle})`);
  await s.snap('02-signature-mechanism');

  await s.eval(`document.querySelector('.diagram-recall').click()`);
  const recall = await s.eval(`(() => {
    const deck = document.querySelector('.diagram-deck');
    const label = deck.querySelector('.diagram-box svg text, .diagram-box svg foreignObject');
    return {
      active: deck.classList.contains('is-recall'),
      button: deck.querySelector('.diagram-recall').textContent.trim(),
      opacity: label ? getComputedStyle(label).opacity : null
    };
  })()`);
  s.assert(recall.active && recall.button === 'Reveal labels', `recall mode activates (${JSON.stringify(recall)})`);
  s.assert(recall.opacity === '0', `SVG labels are hidden in recall mode (${recall.opacity})`);
  await s.snap('03-label-recall');

  // Ordered problem session: jump to p01 question index 3 (architecture), reveal,
  // and verify its afterQuestion diagram appears beside the model answer.
  await s.eval(`document.getElementById('drill-all').click()`);
  await s.waitFor(`typeof session !== 'undefined' && session && session.items && session.items.length`, { timeoutMs: 6000 });
  await s.eval(`session.pos = 3; renderQuestion(); revealOpen()`);
  await s.waitFor(`document.querySelector('.model .diagram-deck .diagram-box svg')`, { timeoutMs: 10000 });
  const answerDeck = await s.eval(`(() => ({
    title: document.querySelector('.model .diagram-deck__title').textContent.trim(),
    count: document.querySelector('.model .diagram-deck__count').textContent.trim(),
    noHScroll: document.documentElement.scrollWidth <= innerWidth
  }))()`);
  s.assert(answerDeck.title === 'High-level architecture', `overview is attached to architecture answer (${JSON.stringify(answerDeck)})`);
  s.assert(answerDeck.count === '1 / 1', 'question reveal shows only diagrams relevant to that answer');
  s.assert(answerDeck.noHScroll, 'revealed answer diagram has no horizontal overflow at 390px');
  await s.snap('04-answer-visual');

  const report = s.report();
  await s.close();
  process.exit(report.failed + report.errors + report.networkErrors > 0 ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
