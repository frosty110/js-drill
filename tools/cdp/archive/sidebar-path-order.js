#!/usr/bin/env node
// Iter 11 regression probe: in starter-path mode, the sidebar's visible
// lessons appear in STRICTLY ASCENDING path-step order — scrolling
// top-to-bottom reads 1, 2, 3, … not 22, 20, 21.
//
// Scenarios:
//   A. Path mode ON, no progress. Read step numbers from the visible
//      lesson labels in document order. Assert monotonic.
//   B. The known broken case (HASH STRUCTURES with s-obj-basics/s-obj-iter/
//      map-set at steps 20, 21, 22) appears in that order, not the prior
//      manifest order which interleaved them as 22, 20, 21.
//   C. Path mode OFF: sidebar lessons appear in manifest order (no sort
//      applied). Same lessons visible, no path numbers, no resort.

const { ensureServer, ensureChrome, connect } = require('../lib');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-iter11-sidebar';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Clean start, dismiss welcome.
  await s.eval(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({ __v: 4, welcomed: true, starterPath: true, sidebarTrack: 'syntax' }))`);
  await s.reload();
  await s.click('#hamburger');
  await s.sleep(300);
  await s.snap('A-path-on-syntax');

  // Scenario A — read step labels from the visible sidebar lessons.
  // In path mode each lesson label is prefixed with "N. " where N is the
  // path step. Strip the prefix to a number array.
  const steps = await s.eval(`(() => {
    const labels = [...document.querySelectorAll('#sidebar-nav .lesson-link .lesson-label')]
      .map(el => el.textContent.trim());
    return labels.map(t => {
      const m = t.match(/^(\\d+)\\./);
      return m ? Number(m[1]) : null;
    }).filter(n => n !== null);
  })()`);
  console.log('Sidebar step sequence:', steps.slice(0, 30), '... total', steps.length);
  s.assert(steps.length > 5, `[A] sidebar shows multiple path lessons (got ${steps.length})`);
  const monotonic = steps.every((n, i) => i === 0 || n > steps[i - 1]);
  s.assert(monotonic, `[A] sidebar step numbers are strictly ascending top-to-bottom (got ${JSON.stringify(steps.slice(0, 15))})`);

  // Scenario B — switch to the binder tab that contains HASH STRUCTURES
  // (it's in the Syntax track per the manifest). Find s-obj-basics, s-obj-
  // iter, map-set in the rendered order and assert they read 20, 21, 22.
  const hashSection = await s.eval(`(() => {
    const ids = ['s-obj-basics', 's-obj-iter', 'map-set'];
    const seen = [];
    for (const link of document.querySelectorAll('#sidebar-nav .lesson-link')) {
      const id = link.getAttribute('data-lesson-id');
      if (ids.includes(id)) {
        const label = link.querySelector('.lesson-label')?.textContent.trim();
        seen.push({ id, label });
      }
    }
    return seen;
  })()`);
  console.log('HASH STRUCTURES order:', JSON.stringify(hashSection));
  s.assert(hashSection.length === 3, `[B] all 3 hash-structures lessons visible in path-on syntax tab (got ${hashSection.length})`);
  s.assert(hashSection[0]?.id === 's-obj-basics' && hashSection[1]?.id === 's-obj-iter' && hashSection[2]?.id === 'map-set',
    `[B] HASH STRUCTURES reads s-obj-basics → s-obj-iter → map-set (got ${JSON.stringify(hashSection.map(h => h.id))})`);
  // And the step labels read 20, 21, 22.
  const hashSteps = hashSection.map(h => Number(h.label?.match(/^(\d+)\./)?.[1]));
  s.assert(hashSteps.length === 3 && hashSteps[0] < hashSteps[1] && hashSteps[1] < hashSteps[2],
    `[B] HASH STRUCTURES step labels strictly ascending (got ${JSON.stringify(hashSteps)})`);

  // Scenario C — toggle path OFF and re-check: no step numbers, lessons
  // appear in manifest order (not the sort we apply only in path mode).
  await s.click('#path-btn');
  await s.sleep(400);
  await s.snap('C-path-off');
  const noPrefixCount = await s.eval(`(() => {
    const labels = [...document.querySelectorAll('#sidebar-nav .lesson-link .lesson-label')]
      .map(el => el.textContent.trim());
    return labels.filter(t => /^\\d+\\./.test(t)).length;
  })()`);
  s.assert(noPrefixCount === 0,
    `[C] no step-number prefixes when path mode is OFF (got ${noPrefixCount} with prefix)`);

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
