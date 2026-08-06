// Verifies the new Reference-tab "Alternate solutions" surface on
// p-merge-k-lists. Checks: section renders, label + complexity badge
// present, expanding shows colorized code + when-line + notes.
//   node tools/cdp/reference-alternates.js
const { ensureChrome, ensureServer, connect } = require('../lib');

async function runOne({ mobile, label }) {
  const url = `http://localhost:8765/?cb=${Date.now()}#/p-merge-k-lists/reference`;
  const outDir = `/tmp/probe-ref-alternates-${mobile ? 'mobile' : 'desktop'}`;
  const s = await connect({ url, mobile, outDir, waitForLoadMs: 3500 });
  // Force a hard reload — Network.setCacheDisabled doesn't fully bypass the
  // cache for resources from a prior debug session; Page.reload(ignoreCache)
  // does. Without this the probe sees stale CONTENT (pre-edit JSON).
  await s.reload();
  await s.sleep(800);

  await s.waitFor(`document.querySelector('[data-ref-alternates]')`);
  await s.snap(`${label}-collapsed`);

  const altCount = await s.eval(`document.querySelectorAll('.ref-alternate').length`);
  s.assert(altCount === 1, `${label}: exactly 1 alternate rendered (got ${altCount})`);

  const altLabel = await s.eval(`document.querySelector('.ref-alt-label')?.textContent.trim()`);
  s.assert(altLabel === 'Min-heap (k-way merge)', `${label}: label = "${altLabel}"`);

  const complexity = await s.eval(`document.querySelector('.ref-alt-complexity')?.textContent.trim()`);
  s.assert(/O\(N log k\)/.test(complexity || ''), `${label}: complexity badge shows "${complexity}"`);

  // Collapsed by default — body should not be visible yet (offsetHeight 0 in a closed <details>).
  const openBefore = await s.eval(`document.querySelector('.ref-alternate')?.open === true`);
  s.assert(!openBefore, `${label}: starts collapsed`);

  // Expand and verify body content
  await s.eval(`document.querySelector('.ref-alternate').open = true`);
  await s.sleep(150);
  await s.snap(`${label}-expanded`);

  const whenText = await s.eval(`document.querySelector('.ref-alt-when')?.textContent.trim().length || 0`);
  s.assert(whenText > 40, `${label}: when-line populated (${whenText} chars)`);

  // CodeMirror runMode produces spans inside the <pre> — check we got tokens.
  const codeTokens = await s.eval(`document.querySelectorAll('[data-ref-alt-code="0"] span').length`);
  s.assert(codeTokens > 20, `${label}: alternate code colorized (${codeTokens} spans)`);

  const codeText = await s.eval(`document.querySelector('[data-ref-alt-code="0"]')?.textContent || ''`);
  s.assert(/class MinHeap/.test(codeText), `${label}: alternate code contains "class MinHeap"`);
  s.assert(/mergeKLists/.test(codeText), `${label}: alternate code contains "mergeKLists"`);

  const noteCount = await s.eval(`document.querySelectorAll('.ref-alt-notes li').length`);
  s.assert(noteCount === 3, `${label}: 3 alternate notes rendered (got ${noteCount})`);

  // Primary canonical (pairwise) must still be the top reference.code block.
  const primaryText = await s.eval(`document.querySelector('[data-ref-code]')?.textContent || ''`);
  s.assert(/mergeTwo/.test(primaryText), `${label}: primary canonical still shows mergeTwo`);
  s.assert(!/class MinHeap/.test(primaryText), `${label}: primary canonical does NOT contain heap class`);

  const r = s.report();
  await s.close();
  return r;
}

(async () => {
  // Mirror the lib.js output to a file as well, so the harness can read the
  // results when stdout capture is unavailable (e.g. low temp disk).
  const fs = require('fs');
  const FILE = '/tmp/probe-ref-alternates-out.log';
  try { fs.writeFileSync(FILE, ''); } catch(_){}
  const origLog = console.log;
  console.log = (...a) => {
    const line = a.map(x => typeof x==='string'?x:JSON.stringify(x)).join(' ');
    try { fs.appendFileSync(FILE, line + '\n'); } catch(_){}
    origLog(...a);
  };

  try {
    await ensureChrome();
    await ensureServer({ port: 8765, dir: process.cwd() });

    const desktop = await runOne({ mobile: false, label: 'desktop' });
    const mobile = await runOne({ mobile: true, label: 'mobile' });

    const totalFailed = desktop.failed + mobile.failed;
    if (totalFailed > 0) {
      console.log(`\n❌ FAIL — ${totalFailed} assertion(s) failed across desktop+mobile`);
      process.exit(1);
    }
    console.log('\n✅ PASS — reference alternates render on desktop + mobile');
  } catch (e) {
    console.log('ERR:', e.message, '\n', e.stack);
    process.exit(1);
  }
})();
