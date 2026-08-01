// system-design-visual-deck.js — mobile regression probe for the canonical
// design-problem architecture decks.
//
// Verifies: the unit ends with a consolidated final-interview whiteboard,
// its overview renders, label recall works, the expanded board contains all
// four authored views, the relevant diagram stays co-located with its revealed
// interview answer, and the 390px viewport never overflows horizontally.
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
  await s.waitFor(`document.querySelector('.final-board .diagram-box svg')`, { timeoutMs: 10000 });

  const initial = await s.eval(`(() => {
    const board = document.querySelector('.final-board');
    const controls = [...board.querySelectorAll('.final-board__actions button')];
    return {
      authored: CH['design-problems'].p01.diagrams.length,
      placement: board.previousElementSibling && board.previousElementSibling.classList.contains('key-ideas')
        && board.nextElementSibling && board.nextElementSibling.classList.contains('cta-row'),
      notes: board.querySelectorAll('.final-board__note').length,
      rendered: !!board.querySelector('.diagram-box svg'),
      minControlHeight: Math.min(...controls.map(b => b.getBoundingClientRect().height)),
      noHScroll: document.documentElement.scrollWidth <= innerWidth
    };
  })()`);
  s.assert(initial.authored === 4 && initial.notes === 4, `four decisions form one final whiteboard (${JSON.stringify(initial)})`);
  s.assert(initial.placement, 'final whiteboard sits after Key Ideas and before drill actions');
  s.assert(initial.rendered, 'whiteboard overview rendered as SVG');
  s.assert(initial.minControlHeight >= 44, `whiteboard controls are mobile-sized (${initial.minControlHeight}px)`);
  s.assert(initial.noHScroll, 'final whiteboard has no horizontal overflow at 390px');
  await s.snap('01-final-whiteboard');

  await s.eval(`document.querySelector('.final-board__recall').click()`);
  const recall = await s.eval(`(() => {
    const board = document.querySelector('.final-board');
    const label = board.querySelector('.diagram-box svg text, .diagram-box svg foreignObject');
    return {
      active: board.classList.contains('is-recall'),
      button: board.querySelector('.final-board__recall').textContent.trim(),
      opacity: label ? getComputedStyle(label).opacity : null
    };
  })()`);
  s.assert(recall.active && recall.button === 'Reveal labels', `recall mode activates (${JSON.stringify(recall)})`);
  s.assert(recall.opacity === '0', `SVG labels are hidden in recall mode (${recall.opacity})`);
  await s.snap('02-label-recall');

  await s.eval(`document.querySelector('.final-board__open').click()`);
  await s.waitFor(`document.querySelectorAll('#whiteboard-modal .whiteboard-panel .diagram-box svg').length === 4`, { timeoutMs: 10000 });
  const expanded = await s.eval(`(() => ({
    open: document.getElementById('whiteboard-modal').classList.contains('is-open'),
    panels: document.querySelectorAll('#whiteboard-modal .whiteboard-panel').length,
    rendered: document.querySelectorAll('#whiteboard-modal .whiteboard-panel .diagram-box svg').length,
    noHScroll: document.documentElement.scrollWidth <= innerWidth
  }))()`);
  s.assert(expanded.open && expanded.panels === 4 && expanded.rendered === 4, `full board shows all four visual views (${JSON.stringify(expanded)})`);
  s.assert(expanded.noHScroll, 'expanded whiteboard has no horizontal page overflow at 390px');
  await s.snap('03-full-whiteboard');
  await s.eval(`closeFinalWhiteboard()`);

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
