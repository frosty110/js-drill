#!/usr/bin/env node
// Iter 9 regression probe: weak-spot visibility.
//
// Scenarios:
//   A. With 3 weak entries seeded, the sidebar's ⚠️ Weak button is visible
//      and shows the count "3".
//   B. With no weakness seeded, the Weak button is hidden.
//   C. When a lesson is both weak AND on the starter path (the test seeds
//      a weakness on `s-trycatch`, which is in STARTER_PATH), today's plan
//      labels that lesson "weak spot" — not "next on path". Weak ordering
//      now precedes path-adding so dedup promotes the more actionable label.

const { ensureServer, ensureChrome, connect } = require('./lib');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-iter9-weak';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Scenario A — seed 3 weak entries.
  await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const all = m.sections.flatMap(s => s.lessons).filter(l => l.status === 'full');
    const data = {
      __v: 4, welcomed: true,
      progress: {},
      weakness: {},
    };
    // Seed three weak entries on non-mastered lessons (different IDs so the
    // count is unambiguous).
    for (const l of all.slice(40, 43)) data.weakness[l.id] = 3;
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  })()`);
  await s.reload();
  await s.click('#hamburger');
  await s.sleep(300);
  await s.snap('A-sidebar-with-weak');

  const weakA = await s.eval(`(() => {
    const b = document.getElementById('weak-btn');
    const c = document.getElementById('weak-count');
    return {
      hidden: b?.classList.contains('hidden'),
      count: c?.textContent,
      label: b?.textContent.replace(/\\s+/g, ' ').trim(),
    };
  })()`);
  s.assert(weakA && weakA.hidden === false, `[A] Weak button visible when weakness seeded (got: ${JSON.stringify(weakA)})`);
  s.assert(weakA?.count === '3', `[A] Weak count reads 3 (got: ${JSON.stringify(weakA?.count)})`);

  // Scenario B — clear weakness, Weak button hides + count zeroes.
  await s.eval(`localStorage.removeItem('jsdrill.progress.v1')`);
  await s.reload();
  await s.click('#hamburger');
  await s.sleep(300);
  await s.snap('B-sidebar-no-weak');
  const weakB = await s.eval(`document.getElementById('weak-btn')?.classList.contains('hidden')`);
  s.assert(weakB === true, '[B] Weak button hidden when no weakness exists');

  // Scenario C — weak lesson is also on starter path.
  // s-trycatch is a known STARTER_PATH member; weakness on it should
  // produce a "weak spot" labeled item in today's plan (not "next on path").
  await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const all = m.sections.flatMap(s => s.lessons).filter(l => l.status === 'full');
    const data = {
      __v: 4, welcomed: true,
      progress: {},
      weakness: { 's-trycatch': 4 },
    };
    // No mastered lessons → starter path will surface several non-mastered
    // items, including s-trycatch eventually. The reorder guarantees the
    // weak label wins.
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  })()`);
  await s.reload();
  await s.click('#hamburger');
  await s.sleep(200);
  await s.click('#today-btn');
  await s.sleep(400);
  await s.snap('C-today-with-weak-on-path');

  const today = await s.eval(`(() => {
    const items = [...document.querySelectorAll('#today-body [data-lesson-id]')];
    return items.map(b => ({
      id: b.getAttribute('data-lesson-id'),
      label: b.textContent.replace(/\\s+/g, ' ').trim(),
    }));
  })()`);
  const trycatchItem = today.find(t => t.id === 's-trycatch');
  s.assert(!!trycatchItem, `[C] today's plan contains s-trycatch (items: ${JSON.stringify(today.map(t => t.id))})`);
  s.assert(trycatchItem && /weak spot/i.test(trycatchItem.label),
    `[C] s-trycatch labeled "weak spot" (label: ${JSON.stringify(trycatchItem?.label)})`);

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
