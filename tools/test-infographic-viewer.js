#!/usr/bin/env node
// Fast DOM contract test for the reusable infographic component. Browser visual
// QA is still useful, but this catches broken lifecycle, controls, pan, and
// download wiring without requiring Chrome in CI.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/infographic-viewer.js'), 'utf8');
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  runScripts: 'dangerously', url: 'https://example.test/'
});
const { window } = dom;
window.eval(source);

const card = window.document.createElement('drill-infographic');
card.setAttribute('src', 'assets/system-design/infographics/components/c01/request-routing-map.png');
card.setAttribute('title', 'Load Balancing & Routing');
card.setAttribute('download-name', 'load-balancing.png');
window.document.body.appendChild(card);

assert(card.querySelector('.infographic-card__preview'), 'renders a preview trigger');
assert.strictEqual(card.querySelector('a[download]').getAttribute('download'), 'load-balancing.png');
card.querySelector('.infographic-card__preview').click();

const viewer = window.document.querySelector('.infographic-viewer');
const stage = viewer.querySelector('.infographic-viewer__stage');
const image = viewer.querySelector('.infographic-viewer__image');
assert(viewer && !viewer.hidden, 'opens the shared full-screen viewer');
assert.strictEqual(viewer.querySelector('[data-action="download"]').getAttribute('download'), 'load-balancing.png');
assert(viewer.querySelector('[data-action="actual"]'), 'offers an explicit 100% control');
assert(viewer.querySelector('[data-action="close"]'), 'offers an explicit close control');

Object.defineProperties(stage, {
  clientWidth: { value: 800 }, clientHeight: { value: 1000 }
});
stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 1000 });
stage.setPointerCapture = () => {};
Object.defineProperties(image, {
  naturalWidth: { value: 1600 }, naturalHeight: { value: 2000 }, complete: { value: true }
});
image.dispatchEvent(new window.Event('load'));
assert.match(image.style.transform, /scale\(0\.[0-9]+\)/, 'fit mode scales the full image into the stage');

viewer.querySelector('[data-action="actual"]').click();
assert.match(image.style.transform, /scale\(1\)/, '100% mode maps one image pixel to one CSS pixel');
const beforePan = image.style.transform;

function pointer(type, id, x, y) {
  const event = new window.Event(type, { bubbles: true });
  Object.defineProperties(event, {
    pointerId: { value: id }, clientX: { value: x }, clientY: { value: y }
  });
  stage.dispatchEvent(event);
}
pointer('pointerdown', 1, 200, 300);
pointer('pointermove', 1, 275, 365);
pointer('pointerup', 1, 275, 365);
assert.notStrictEqual(image.style.transform, beforePan, 'dragging pans the zoomed image');

window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
assert(viewer.hidden, 'Escape closes the viewer');

const set = window.document.createElement('drill-infographic-set');
set.data = {
  title: 'URL Shortener visual walkthrough',
  summary: 'Overview first, then focused request flows.',
  items: [
    {
      id: 'overview', kind: 'System map', title: 'Architecture overview', purpose: 'Place the components.',
      description: 'The mapping store is authoritative.', src: 'assets/system-design/infographics/design-problems/p01/overview.png',
      alt: 'URL Shortener overview', downloadName: 'url-shortener-overview.png', width: 1600, height: 2400,
      flow: [{ step: 1, title: 'Create', detail: 'Persist the mapping.' }],
      numbers: [{ label: 'Read:write', value: '100:1', detail: 'Optimize reads.' }],
      priorities: ['Redirect latency'], tradeoffs: ['301 versus 302']
    },
    {
      id: 'redirect-flow', kind: 'GET flow', title: 'Cache hit and miss', purpose: 'Trace both read branches.',
      description: 'A miss backfills Redis.', src: 'assets/system-design/infographics/design-problems/p01/redirect-flow.png',
      alt: 'URL Shortener redirect flow', downloadName: 'url-shortener-redirect-flow.png', width: 1600, height: 2400,
      flow: [{ step: 1, title: 'Read cache', detail: 'Return a hit immediately.' }],
      numbers: [], priorities: ['Availability'], tradeoffs: ['TTL versus freshness']
    }
  ]
};
window.document.body.appendChild(set);
assert.strictEqual(set.querySelectorAll('drill-infographic').length, 2, 'a study set renders every authored graphic');
assert.match(set.textContent, /Trace the flow/, 'a study set explains the numbered flow before the image');
assert.match(set.textContent, /100:1/, 'a study set renders scale assumptions');
assert.match(set.textContent, /301 versus 302/, 'a study set renders trade-offs');
set.querySelectorAll('.infographic-card__preview')[1].click();
assert.strictEqual(viewer.querySelector('[data-action="download"]').getAttribute('download'), 'url-shortener-redirect-flow.png', 'each set image opens and downloads independently');
viewer.querySelector('[data-action="close"]').click();
assert.strictEqual(window.document.querySelectorAll('.infographic-viewer').length, 1, 'one shared workspace serves every card');

console.log('Infographic viewer DOM contract OK — multi-image sets, authored guides, full screen, fit, 100%, pan, download, and close.');
