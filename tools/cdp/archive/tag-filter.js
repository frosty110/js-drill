#!/usr/bin/env node
// Probe — Patterns+Applied merge + faceted tag filter on the Problems surface.
// Verifies: switching to Problems renders ONE merged list (a patterns section and
// an applied section coexist; no per-track binder sub-tabs); the 🏷 Filter panel
// opens with Type/Topic/Difficulty/Company facets; a Difficulty:Easy filter drops
// hard lessons and keeps easy ones; a Type:Applied filter keeps only applied;
// Clear restores the full list. No console exceptions throughout.
const { ensureChrome, ensureServer, connect } = require('../lib');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8765/';
const outDir = process.argv[3] || '/tmp/shots-tags';

const IDS = `[...document.querySelectorAll('#sidebar-nav [data-lesson-id]')].map(e=>e.getAttribute('data-lesson-id'))`;
const SECTIONS = `[...document.querySelectorAll('#sidebar-nav .section-header .section-title, #sidebar-nav .section-header')].map(e=>e.textContent.trim())`;

(async () => {
  await ensureChrome();
  await ensureServer({ dir: process.cwd() });
  const s = await connect({ url: baseUrl, outDir, waitForLoadMs: 2600 });

  try {
    // Start clean so the full problems corpus is visible (no hide-mastered/path).
    await s.eval(`(()=>{const k='jsdrill.progress.v1';const p=JSON.parse(localStorage.getItem(k)||'{}');p.welcomed=true;p.hideMastered=false;p.starterPath=false;p.tagFilter={};p.tagFilterOpen=false;localStorage.setItem(k,JSON.stringify(p));})()`);
    await s.reload();
    await s.waitFor(`!!document.querySelector('.surface-seg[data-surface="problems"]')`);

    // → Problems surface (merge).
    await s.click('.surface-seg[data-surface="problems"]');
    await s.waitFor(`${IDS}.length > 50`);
    await s.snap('problems-merged');

    const merged = await s.eval(IDS);
    const secs = await s.eval(SECTIONS);
    s.assert(merged.includes('two-sum'), 'merged list contains a Patterns lesson (two-sum)');
    s.assert(merged.includes('a-curry'), 'merged list contains an Applied lesson (a-curry)');
    s.assert(secs.some(t => /Arrays/.test(t)) && secs.some(t => /Applied/.test(t)),
      'both a Patterns section and the Applied section render together');
    const binderTabs = await s.eval(`document.querySelectorAll('#binder-tabs .binder-tab').length`);
    s.assert(binderTabs === 0, 'no per-track binder sub-tabs on the merged Problems surface');
    const fullCount = merged.length;

    // Open the facet panel.
    s.assert(await s.eval(`!!document.querySelector('.tag-facets-toggle')`), '🏷 Filter toggle present');
    await s.click('.tag-facets-toggle');
    await s.waitFor(`!!document.querySelector('.tag-facets-panel')`);
    const facets = await s.eval(`[...document.querySelectorAll('.facet-group .facet-label')].map(e=>e.textContent.trim())`);
    s.assert(['Type','Topic','Difficulty','Company'].every(f => facets.includes(f)), 'all 4 facets render: ' + facets.join(', '));
    await s.snap('facets-open');

    // Difficulty: Easy → hard lessons drop, easy remain.
    await s.click('.facet-chip[data-facet="difficulty"][data-value="easy"]');
    await s.waitFor(`${IDS}.length < ${fullCount}`);
    const easy = await s.eval(IDS);
    s.assert(easy.includes('two-sum'), 'Difficulty:Easy keeps an easy lesson (two-sum)');
    s.assert(!easy.includes('p-trapping-rain'), 'Difficulty:Easy drops a hard lesson (p-trapping-rain)');
    await s.snap('difficulty-easy');

    // Add Type:Applied → AND across facets: only easy AND applied.
    await s.click('.facet-chip[data-facet="source"][data-value="applied"]');
    await s.sleep(250);
    const easyApplied = await s.eval(IDS);
    s.assert(!easyApplied.includes('two-sum'), 'Easy+Applied excludes a Patterns lesson (two-sum)');
    s.assert(easyApplied.every(id => id.startsWith('a-')), 'Easy+Applied shows only applied (a-*) lessons');
    s.assert(easyApplied.length > 0, 'Easy+Applied is non-empty');

    // Clear → full list restored.
    await s.click('.tag-facets-clear');
    await s.waitFor(`${IDS}.length === ${fullCount}`);
    s.assert(true, 'Clear restores the full merged list (' + fullCount + ' lessons)');

    const rep = s.report();
    await s.close();
    process.exit(rep.failed === 0 && rep.errors === 0 ? 0 : 1);
  } catch (e) {
    console.error('PROBE ERROR:', e.message);
    try { s.report(); } catch (_) {}
    await s.close().catch(() => {});
    process.exit(1);
  }
})();
