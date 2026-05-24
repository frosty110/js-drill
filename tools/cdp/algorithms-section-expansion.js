#!/usr/bin/env node
// iter 20 ship — verifies the 6 new boilerplate-as-syntax lessons in
// data/algorithms/ load + render correctly at mobile viewport. Durable
// regression probe for the expanded Algorithms section.

const { ensureServer, ensureChrome, connect } = require('./lib');

const NEW_LESSONS = [
  's-bfs-template',
  's-matrix-neighbors',
  's-tree-traversals',
  's-ll-traversal',
  's-ll-fast-slow',
  's-heap-ops',
];

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-iter20-algorithms';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Dismiss welcome banner if present
  await s.evalAwait(`(async () => {
    const data = { __v: 4, welcomed: true, progress: {}, reviews: {} };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  })()`);
  await s.reload();

  // -------- A. All 6 new lessons exist in the manifest + sidebar -----------
  const manifestIds = await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const algoSection = m.sections.find(sec => sec.slug === 'algorithms');
    return algoSection.lessons.map(l => l.id);
  })()`);
  for (const id of NEW_LESSONS) {
    s.assert(
      Array.isArray(manifestIds) && manifestIds.includes(id),
      `[A] manifest Algorithms section contains ${id} (got: ${JSON.stringify(manifestIds)})`
    );
  }

  // Open the sidebar to inspect rendered lesson links
  await s.click('#hamburger');
  await s.sleep(300);
  await s.snap('01-sidebar-open');

  const sidebarIds = await s.eval(`
    Array.from(document.querySelectorAll('[data-lesson-id]'))
      .map(el => el.getAttribute('data-lesson-id'))
  `);
  for (const id of NEW_LESSONS) {
    s.assert(
      Array.isArray(sidebarIds) && sidebarIds.includes(id),
      `[A] sidebar renders lesson link for ${id}`
    );
  }

  // -------- B. One full lesson loads + tabs through cleanly ----------------
  // Pick s-matrix-neighbors as the representative — it has the most varied
  // content (Reference w/ dirs array, L1 w/ direction questions, L2 fills,
  // L3 with grid math).
  await s.eval(`document.querySelector('[data-lesson-id="s-matrix-neighbors"]')?.click()`);
  await s.sleep(500);
  await s.snap('02-s-matrix-neighbors-loaded');

  const headerText = await s.eval(`document.querySelector('#lesson-shell h2.text-2xl')?.textContent || ''`);
  s.assert(
    /4-dir neighbor iteration|s-matrix-neighbors/i.test(headerText),
    `[B] s-matrix-neighbors renders its title (got: ${JSON.stringify(headerText)})`
  );

  const errorVisible = await s.eval(`/Could not load lesson/i.test(document.body.textContent)`);
  s.assert(!errorVisible, '[B] no "Could not load lesson" error');

  // Tab through Reference → L1 → L2 → L3
  for (const tabLabel of ['Ref', 'L1', 'L2', 'L3']) {
    await s.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('.tab-btn'))
        .find(b => b.textContent.trim().startsWith('${tabLabel}'));
      if (btn) btn.click();
    })()`);
    await s.sleep(250);
    const active = await s.eval(`document.querySelector('.tab-btn.active')?.textContent || ''`);
    s.assert(
      active.trim().startsWith(tabLabel),
      `[B] tab switches to ${tabLabel} (got: ${JSON.stringify(active)})`
    );
  }
  await s.snap('03-s-matrix-neighbors-l3');

  // -------- C. No horizontal overflow at iPhone viewport -------------------
  const overflow = await s.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  s.assert(
    overflow <= 2,
    `[C] no horizontal scroll on s-matrix-neighbors at mobile width (overflow: ${overflow}px)`
  );

  // -------- D. Spot-check the other 5 lessons load without error -----------
  const others = NEW_LESSONS.filter(id => id !== 's-matrix-neighbors');
  for (const id of others) {
    await s.eval(`document.querySelector('[data-lesson-id="${id}"]')?.click()`);
    await s.sleep(350);
    const err = await s.eval(`/Could not load lesson/i.test(document.body.textContent)`);
    s.assert(!err, `[D] ${id} loads without "Could not load lesson" error`);
    const title = await s.eval(`document.querySelector('#lesson-shell h2.text-2xl')?.textContent || ''`);
    s.assert(title.length > 0, `[D] ${id} renders a non-empty title (got: ${JSON.stringify(title)})`);
  }

  // -------- REPORT + CLEANUP -----------------------------------------------
  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
