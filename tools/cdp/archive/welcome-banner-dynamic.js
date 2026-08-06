#!/usr/bin/env node
// Iter 10 regression probe: the first-time welcome banner shows a
// DYNAMIC lesson count (matching CURRICULUM) and mentions all three
// tracks (syntax + patterns + applied), instead of the hardcoded
// "76 lessons spanning syntax fundamentals → canonical interview patterns".

const { ensureServer, ensureChrome, connect } = require('../lib');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-iter10-banner';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Clear state — banner only shows for fresh users (no progress, not welcomed).
  await s.eval(`localStorage.removeItem('jsdrill.progress.v1')`);
  await s.reload();
  await s.snap('fresh-mobile');

  // Banner should be present.
  const bannerText = await s.eval(`(() => {
    const banner = document.querySelector('#lesson-shell .bg-blue-950\\\\/50');
    return banner ? banner.textContent.replace(/\\s+/g, ' ').trim() : null;
  })()`);
  s.assert(bannerText !== null, `welcome banner is present on fresh load (got: ${JSON.stringify(bannerText)})`);

  // It should contain the LIVE lesson count derived from the manifest.
  const liveCount = await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    return m.sections.flatMap(s => s.lessons).filter(l => l.status === 'full').length;
  })()`);
  s.assert(bannerText && bannerText.includes(`${liveCount} lessons`),
    `banner mentions live count "${liveCount} lessons" (banner: ${JSON.stringify(bannerText?.slice(0, 200))})`);

  // It should NOT contain the old hardcoded "76".
  s.assert(bannerText && !/^76 lessons|\b76 lessons\b/.test(bannerText) || liveCount === 76,
    `banner no longer hardcodes "76 lessons" (current liveCount is ${liveCount})`);

  // It should mention all three tracks.
  s.assert(bannerText && /syntax/i.test(bannerText), 'banner mentions "syntax"');
  s.assert(bannerText && /interview patterns/i.test(bannerText), 'banner mentions "interview patterns"');
  s.assert(bannerText && /applied/i.test(bannerText), 'banner mentions "applied" — the third track');

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
