// system-design-visual-deck.js — mobile regression probe for the canonical
// design-problem architecture decks.
//
// Verifies: the unit renders a multi-image visual study set, the first
// raster has the expected dimensions, its reusable pan/zoom workspace works, the
// relevant supporting diagram stays co-located with its revealed interview
// answer, and the 390px viewport never overflows horizontally.
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
  // The sheets carry loading="lazy" and sit ~2500px down a 390px viewport, so on
  // a fast local connection Chrome never enters them into the viewport margin and
  // the image stays complete=false forever. Scroll it into view before waiting —
  // the lazy attribute is deliberate (mobile is the design centre), so the probe
  // has to meet the app rather than the app dropping the optimisation.
  await s.waitFor(`!!document.querySelector('drill-infographic img')`, { timeoutMs: 6000 });
  await s.eval(`document.querySelector('drill-infographic').scrollIntoView()`);
  await s.waitFor(`(() => { const img = document.querySelector('drill-infographic img'); return img && img.complete && img.naturalWidth; })()`, { timeoutMs: 10000 });

  const initial = await s.eval(`(() => {
    const set = document.querySelector('drill-infographic-set');
    const board = set.querySelector('drill-infographic');
    const image = board.querySelector('.infographic-card__preview img');
    const download = board.querySelector('.infographic-card__actions a[download]');
    const controls = [...board.querySelectorAll('.infographic-card__actions button, .infographic-card__actions a')];
    return {
      placement: set.previousElementSibling && set.previousElementSibling.classList.contains('key-ideas')
        && set.nextElementSibling && set.nextElementSibling.classList.contains('cta-row'),
      count: set.querySelectorAll('drill-infographic').length,
      src: image.getAttribute('src'),
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      download: download.getAttribute('download'),
      minControlHeight: Math.min(...controls.map(b => b.getBoundingClientRect().height)),
      noHScroll: document.documentElement.scrollWidth <= innerWidth
    };
  })()`);
  s.assert(initial.placement, 'visual study set sits after Key Ideas and before drill actions');
  s.assert(initial.count === 3, `URL Shortener exposes all three planned graphics (${initial.count})`);
  s.assert(initial.src.endsWith('/design-problems/p01/overview.png'), `correct overview infographic is loaded (${initial.src})`);
  s.assert(initial.naturalWidth === 1600 && initial.naturalHeight === 2400, `overview PNG has its registered dimensions (${initial.naturalWidth}×${initial.naturalHeight})`);
  s.assert(initial.download.endsWith('.png'), `download action names a PNG (${initial.download})`);
  s.assert(initial.minControlHeight >= 44, `infographic controls are mobile-sized (${initial.minControlHeight}px)`);
  s.assert(initial.noHScroll, 'infographic has no horizontal overflow at 390px');
  await s.snap('01-downloadable-infographic');

  await s.eval(`document.querySelector('.infographic-card__open').click()`);
  await s.waitFor(`(() => { const img = document.querySelector('.infographic-viewer__image'); return img && img.complete && img.naturalWidth; })()`, { timeoutMs: 10000 });
  const expanded = await s.eval(`(() => {
    const viewer = document.querySelector('.infographic-viewer');
    const image = viewer.querySelector('.infographic-viewer__image');
    const before = image.style.transform;
    viewer.querySelector('[data-action="actual"]').click();
    const actual = image.style.transform;
    const stage = viewer.querySelector('.infographic-viewer__stage');
    const rect = stage.getBoundingClientRect();
    stage.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: rect.left + 120, clientY: rect.top + 180, bubbles: true }));
    stage.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: rect.left + 180, clientY: rect.top + 230, bubbles: true }));
    stage.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: rect.left + 180, clientY: rect.top + 230, bubbles: true }));
    return {
    open: !viewer.hidden,
    image: !!image,
    fitTransform: before,
    actualTransform: actual,
    pannedTransform: image.style.transform,
    download: viewer.querySelector('a[download]').getAttribute('download'),
    noHScroll: document.documentElement.scrollWidth <= innerWidth
    };
  })()`);
  s.assert(expanded.open && expanded.image && expanded.download.endsWith('.png'), `full-size infographic opens with download (${JSON.stringify(expanded)})`);
  s.assert(/scale\(1\)/.test(expanded.actualTransform), `100% control selects actual pixels (${expanded.actualTransform})`);
  s.assert(expanded.pannedTransform !== expanded.actualTransform, 'pointer drag pans the 100% image');
  s.assert(expanded.noHScroll, 'expanded infographic has no horizontal page overflow at 390px');
  await s.snap('02-full-size-infographic');
  await s.eval(`document.querySelector('.infographic-viewer [data-action="close"]').click()`);

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
  await s.snap('03-answer-visual');

  const report = s.report();
  await s.close();
  process.exit(report.failed + report.errors + report.networkErrors > 0 ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
