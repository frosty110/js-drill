#!/usr/bin/env node
// ============================================================================
//  tools/cdp/sd-icons.js — one icon set, checked in the browser
// ============================================================================
// tools/check-icons.js proves the SOURCE only names icons that exist. This
// proves the rendered page: that every glyph on System Design came out of
// ds/icons.js, that every topic mark is one family in identical tiles
// rather than a sticker per topic at its own size, and that the mark this page wears is
// the same one the app's nav rail draws for Design — a cross-page invariant no
// single-file check can see.
//
//   node tools/cdp/sd-icons.js [baseUrl]
//
// Needs Chrome on :9222; bootstraps the server and the browser itself.
// ============================================================================

const { ensureServer, ensureChrome, connect } = require('./lib');

const BASE = process.argv[2] || 'http://localhost:8765/';
const SD = new URL('system-design.html', BASE).href;
// Derived, never hardcoded: this probe went red the day a fifth topic was added,
// which is the failure mode docs/invariants.md calls out — a probe that breaks on
// a content ADDITION teaches people to ignore it.
const N_TOPICS = require('../../data/system-design/topics.json').topics.length;
const OUT = '/tmp/sd-icons-shots';

// Rendered-text emoji. Same definition as tools/check-icons.js: colour-glyph
// characters, so typographic marks (⌘ → ‹ ─) are not flagged.
const EMOJI_SCAN = `((root) => (root.innerText.match(/\\p{Emoji_Presentation}|\\uFE0F/gu) || []))`;

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // ── The cross-page invariant ─────────────────────────────────────────────
  // Read the app's nav-rail mark first, then compare it to this page's
  // wordmark. Two files, one glyph — the thing that breaks silently when
  // somebody edits one of them.
  const app = await connect({ url: BASE, viewport: { width: 1280, height: 900 }, outDir: OUT });
  await app.sleep(1200);
  const railMark = await app.eval(
    `document.querySelector('[data-nav="sysdesign"] svg')?.innerHTML.trim() || ''`);
  const railIcons = await app.eval(
    `[...document.querySelectorAll('.ds-appnav svg')].filter(s => s.classList.contains('ds-icon')).length`);
  const railTotal = await app.eval(`document.querySelectorAll('.ds-appnav svg').length`);
  await app.snap('00-app-rail');
  await app.close();

  for (const mobile of [true, false]) {
    const label = mobile ? 'mobile' : 'desktop';
    const s = await connect({
      url: SD, mobile,
      viewport: mobile ? undefined : { width: 1280, height: 900 },
      outDir: OUT,
    });
    await s.sleep(1400);

    // Reset so a previous run's Leitner state can't change which controls render.
    await s.eval(`localStorage.removeItem('jsdrill.systemdesign.v1')`);
    await s.eval(`location.hash = '#/'`);
    await s.sleep(900);

    // ── Topic landing: every mark, one family ──────────────────────────────
    const cards = await s.eval(`document.querySelectorAll('.topic-card').length`);
    s.assert(cards === N_TOPICS, `[${label}] ${N_TOPICS} topic cards, got ${cards}`);

    const marks = JSON.parse(await s.eval(`JSON.stringify(
      [...document.querySelectorAll('.topic-icon')].map(el => {
        const svg = el.querySelector('svg');
        const r = el.getBoundingClientRect();
        return { svg: !!svg, ds: !!svg && svg.classList.contains('ds-icon'),
                 w: Math.round(r.width), h: Math.round(r.height),
                 tile: getComputedStyle(el).borderRadius };
      }))`));
    s.assert(marks.length === N_TOPICS && marks.every(m => m.svg),
      `[${label}] every topic mark is an svg, got ${marks.filter(m => m.svg).length}/${N_TOPICS}`);
    s.assert(marks.every(m => m.ds),
      `[${label}] every topic mark came from dsIcon (.ds-icon)`);
    const sizes = new Set(marks.map(m => `${m.w}x${m.h}`));
    s.assert(sizes.size === 1,
      `[${label}] all ${N_TOPICS} marks share one tile size, got ${[...sizes].join(', ')}`);
    s.assert(marks.every(m => parseFloat(m.tile) > 0),
      `[${label}] the marks sit in rounded tiles, not free-floating`);
    await s.snap(`${label}-01-topics`);

    // ── The wordmark is the app's Design mark ──────────────────────────────
    const wordmark = await s.eval(
      `document.querySelector('header .badge svg')?.innerHTML.trim() || ''`);
    s.assert(wordmark.length > 0, `[${label}] the wordmark renders an svg`);
    s.assert(railMark.length > 0 && wordmark === railMark,
      `[${label}] the wordmark is the same glyph the app's nav rail draws for Design`);
    s.assert(railTotal > 0 && railIcons === railTotal,
      `the app's nav rail draws ${railTotal} icons, all from dsIcon (${railIcons} carry .ds-icon)`);

    // ── Walk the surfaces: no emoji, no stray svg ─────────────────────────
    // Mermaid renders its own <svg>, so the "came from dsIcon" assertion is
    // scoped to chrome — everything outside a rendered diagram.
    const surfaces = [
      ['#/', 'landing'],
      ['#/design-problems', 'topic home + filter'],
      ['#/design-problems/p01', 'unit detail'],
      ['#/components/catalog', 'component catalog'],
      ['#/ddia/ch01', 'unit detail (ddia)'],
    ];
    for (const [hash, name] of surfaces) {
      await s.eval(`location.hash = '${hash}'`);
      await s.sleep(900);
      const emoji = JSON.parse(await s.eval(`JSON.stringify(${EMOJI_SCAN}(document.body))`));
      s.assert(emoji.length === 0,
        `[${label}] ${name} renders no emoji, found ${emoji.join(' ')}`);
      const stray = await s.eval(`[...document.querySelectorAll('#app svg, header svg')]
        .filter(sv => !sv.classList.contains('ds-icon') && !sv.closest('.mermaid, [data-diagram], drill-infographic, drill-infographic-set'))
        .length`);
      s.assert(stray === 0, `[${label}] ${name}: ${stray} svg(s) not from dsIcon`);
    }
    await s.snap(`${label}-02-unit`);

    // ── Filter disclosure caret flips ─────────────────────────────────────
    await s.eval(`location.hash = '#/design-problems'`);
    await s.sleep(900);
    const caretClosed = await s.eval(
      `document.querySelector('.sd-filter-caret svg')?.querySelector('path')?.getAttribute('d') || ''`);
    await s.eval(`document.getElementById('filter-toggle')?.click()`);
    await s.sleep(500);
    const caretOpen = await s.eval(
      `document.querySelector('.sd-filter-caret svg')?.querySelector('path')?.getAttribute('d') || ''`);
    s.assert(caretClosed && caretOpen && caretClosed !== caretOpen,
      `[${label}] the filter caret changes glyph when it opens`);
    await s.eval(`document.getElementById('filter-toggle')?.click()`);
    await s.sleep(400);

    // ── A drill card: verdict, streak, per-question link ───────────────────
    await s.eval(`location.hash = '#/ddia/ch01'`);
    await s.sleep(900);
    await s.eval(`document.getElementById('drill-all')?.click()`);
    await s.sleep(900);
    const qlink = JSON.parse(await s.eval(`JSON.stringify((() => {
      const b = document.getElementById('q-link');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { svg: !!b.querySelector('svg.ds-icon'), w: Math.round(r.width), h: Math.round(r.height) };
    })())`));
    s.assert(qlink && qlink.svg, `[${label}] the per-question link is a ds icon`);
    s.assert(qlink && qlink.w >= 30 && qlink.h >= 30,
      `[${label}] the per-question link stays a real target (${qlink && qlink.w}x${qlink && qlink.h})`);

    // Answer an MC so the verdict renders. The unit mixes MC and open cards and
    // the deck order is the reader's, not ours, so walk forward to the first MC
    // rather than assuming card 1 is one — assuming it made this assertion pass
    // on mobile and flake on desktop.
    for (let hop = 0; hop < 8; hop++) {
      if (await s.eval(`!!document.querySelector('.ds-opt')`)) break;
      await s.eval(`document.getElementById('reveal-btn')?.click()`);
      await s.sleep(300);
      await s.eval(`[...document.querySelectorAll('button')].find(b => /Got it/i.test(b.textContent))?.click()`);
      await s.sleep(300);
      await s.eval(`document.getElementById('next-btn')?.click()`);
      await s.sleep(400);
    }
    s.assert(await s.eval(`!!document.querySelector('.ds-opt')`),
      `[${label}] reached a multiple-choice card to grade`);
    await s.eval(`document.querySelector('.ds-opt')?.click()`);
    await s.sleep(600);
    const verdict = await s.eval(
      `!!document.querySelector('.explain .verdict svg.ds-icon')`);
    const verdictEmoji = JSON.parse(await s.eval(
      `JSON.stringify(${EMOJI_SCAN}(document.querySelector('.explain') || document.body))`));
    s.assert(verdict, `[${label}] the answer verdict leads with a ds icon`);
    s.assert(verdictEmoji.length === 0,
      `[${label}] the answer verdict carries no emoji, found ${verdictEmoji.join(' ')}`);
    await s.snap(`${label}-03-drill`);

    // ── Nothing overflows sideways ────────────────────────────────────────
    const overflow = await s.eval(
      `document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    s.assert(overflow <= 0, `[${label}] no horizontal overflow, got ${overflow}px`);

    const r = s.report();
    await s.close();
    if (r.failed) process.exit(1);
  }
  process.exit(0);
})().catch(e => { console.error('probe failed:', e.message); process.exit(1); });
