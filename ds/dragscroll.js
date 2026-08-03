// ds/dragscroll.js — click-and-drag horizontal scrolling, for the whole family.
//
// Horizontally-overflowing strips (tab rows, chip rows, the study-plan cards,
// diagram boxes) are swipeable on a phone for free, but on a desktop a mouse
// has no way to scroll them: there's no visible scrollbar by design, and
// shift+wheel is not something a user discovers. So content past the right edge
// is simply unreachable with a mouse.
//
// This is ONE delegated handler rather than a per-strip opt-in, so every
// overflowing region — including ones added later — gets the affordance without
// being wired up. It finds the nearest horizontally-scrollable ancestor of
// whatever you pressed on and drags that.
//
// Deliberate exclusions:
//   - touch/pen pointers: those already drag-scroll natively, and hijacking
//     them fights the browser's own gesture handling.
//   - text surfaces (pre, code, inputs, CodeMirror, contenteditable): dragging
//     across code to select and copy it is a real use, and worth more there
//     than drag-scrolling.
//
// A drag past the threshold swallows the click that follows it, so dragging a
// strip of cards can never also open the card you started on.
(function () {
  'use strict';

  var TEXT_SURFACES = 'pre, code, textarea, input, select, [contenteditable], .CodeMirror';
  var THRESHOLD = 4;          // px before a press counts as a drag, not a click
  var state = null;

  function scrollableAncestor(el) {
    for (var n = el; n && n !== document.body && n.nodeType === 1; n = n.parentElement) {
      if (n.scrollWidth - n.clientWidth <= 1) continue;
      var ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'overlay') return n;
    }
    return null;
  }

  document.addEventListener('pointerdown', function (e) {
    // Mouse only, primary button only. Touch already does this natively.
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    var t = e.target;
    if (!t || t.nodeType !== 1 || t.closest(TEXT_SURFACES)) return;
    var el = scrollableAncestor(t);
    if (!el) return;
    state = { el: el, startX: e.clientX, startLeft: el.scrollLeft, dragging: false };
  }, true);

  document.addEventListener('pointermove', function (e) {
    if (!state) return;
    var dx = state.startX - e.clientX;
    if (!state.dragging) {
      if (Math.abs(dx) < THRESHOLD) return;
      state.dragging = true;
      document.body.classList.add('ds-dragging');
      // Kill the text selection the initial press may already have started.
      var sel = window.getSelection && window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    }
    state.el.scrollLeft = state.startLeft + dx;
    e.preventDefault();
  });

  function end() {
    if (!state) return;
    var dragged = state.dragging;
    state = null;
    document.body.classList.remove('ds-dragging');
    if (!dragged) return;
    // Swallow exactly the one click this drag would otherwise fire — on the
    // card or tab the press landed on.
    var disarm = function () { window.removeEventListener('click', swallow, true); };
    var swallow = function (ev) { ev.stopPropagation(); ev.preventDefault(); disarm(); };
    window.addEventListener('click', swallow, true);
    // That click, if it comes at all, is dispatched before the next macrotask.
    // Disarming here means a drag that ended off the element can't eat the
    // user's NEXT real click instead.
    setTimeout(disarm, 0);
  }

  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
})();
