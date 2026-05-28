// Captures the Plan Picker modal in both modes a PROFILE.md user encounters:
//   (1) welcome:    first-time user (no welcomed flag) — modal pops automatically
//       on boot via the welcome flow.
//   (2) switch:     existing user re-opens it via the "Plan: ..." chip in sidebar.
// Both at mobile (390×844) AND desktop (1280×800).
//
// Run: node tools/cdp/refine-plan-picker.js [outDir]

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('./lib');

const OUT = process.argv[2] || '/tmp/jsdrill-refine-06';

async function openSwitch(s) {
  // Existing-user mode: programmatically open via openPathModal({ welcome:false })
  await s.eval(`openPathModal({})`);
  await s.waitFor(`document.getElementById('path-modal').style.display === 'block'`, { timeoutMs: 5000 });
  await s.sleep(300);
}

async function openWelcome(s) {
  // First-time-user mode: welcome flag triggers different copy + Pick→ tags
  await s.eval(`openPathModal({ welcome: true })`);
  await s.waitFor(`document.getElementById('path-modal').style.display === 'block'`, { timeoutMs: 5000 });
  await s.sleep(300);
}

(async () => {
  await ensureServer({ port: 8765, dir: path.resolve(__dirname, '../..') });
  await ensureChrome();

  // Desktop pass
  const sd = await connect({
    url: 'http://localhost:8765/',
    viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: OUT
  });
  await sd.seedLocalStorage('jsdrill.progress.v1', {
    __v: 5, welcomed: true, syncHintShown: true, subscribedPathId: 'starter'
  });
  await sd.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await openSwitch(sd);
  await sd.snap('01-switch-desktop');
  await sd.eval(`document.getElementById('path-modal').style.display = 'none'`);
  await sd.sleep(150);
  await openWelcome(sd);
  await sd.snap('02-welcome-desktop');
  const cards = await sd.eval(`Array.from(document.querySelectorAll('#path-body [data-path-id]')).map(b => ({
    id: b.getAttribute('data-path-id'),
    height: b.getBoundingClientRect().height,
    text: b.innerText.replace(/\\s+/g, ' ').slice(0, 100)
  }))`);
  console.log('\nDesktop welcome — path cards:');
  for (const c of cards) console.log(`  [${c.id}] h=${Math.round(c.height)}px · ${c.text}`);
  sd.assert(cards.length === 3, `[desktop] modal shows all 3 paths (got ${cards.length})`);
  await sd.close();

  // Mobile pass
  const sm = await connect({
    url: 'http://localhost:8765/',
    mobile: true,
    outDir: OUT
  });
  await sm.seedLocalStorage('jsdrill.progress.v1', {
    __v: 5, welcomed: true, syncHintShown: true, subscribedPathId: 'starter'
  });
  await sm.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await openSwitch(sm);
  await sm.snap('03-switch-mobile');
  await sm.eval(`document.getElementById('path-modal').style.display = 'none'`);
  await sm.sleep(150);
  await openWelcome(sm);
  await sm.snap('04-welcome-mobile');

  // Recommended-badge + switch-mode-absent: capture both reports in ONE
  // synchronous JS eval so we don't pay the WS round-trip cost twice and
  // don't have to re-open the modal twice.
  const badgeReport = await sm.eval(`(() => {
    // 1. Welcome state (modal is currently open via openWelcome).
    const welcomeCards = Array.from(document.querySelectorAll('#path-body [data-path-id]')).map(c => ({
      id: c.getAttribute('data-path-id'),
      hasRecommended: !!c.querySelector('[data-recommended]'),
      recommendedText: c.querySelector('[data-recommended]')?.innerText?.trim() || ''
    }));
    // 2. Switch state: re-render via openPathModal({}) and re-read.
    openPathModal({});
    const switchCards = Array.from(document.querySelectorAll('#path-body [data-path-id]')).map(c => ({
      id: c.getAttribute('data-path-id'),
      hasRecommended: !!c.querySelector('[data-recommended]')
    }));
    return { welcome: welcomeCards, switch: switchCards };
  })()`);
  console.log('\nMobile welcome — recommended-badge per card:');
  console.log(JSON.stringify(badgeReport.welcome, null, 2));
  console.log('\nMobile switch — recommended-badge per card:');
  console.log(JSON.stringify(badgeReport.switch, null, 2));
  const w = badgeReport.welcome;
  const sw = badgeReport.switch;
  const starter = w.find(c => c.id === 'starter');
  const others = w.filter(c => c.id !== 'starter');
  sm.assert(!!starter, `[mobile welcome] starter card present`);
  sm.assert(starter?.hasRecommended === true, `[mobile welcome] starter has [data-recommended] badge`);
  sm.assert(/recommended/i.test(starter?.recommendedText || ''), `[mobile welcome] badge text says "Recommended"`);
  for (const c of others) {
    sm.assert(c.hasRecommended === false, `[mobile welcome] non-starter "${c.id}" has NO [data-recommended] badge`);
  }
  const switchBadgeCount = sw.filter(c => c.hasRecommended).length;
  sm.assert(switchBadgeCount === 0, `[mobile switch] no card carries recommended badge (got ${switchBadgeCount})`);

  // Mobile clipping assertion — Current/Switch/Pick tag right edge must stay
  // inside the modal body's right edge.
  const tagReport = await sm.eval(`(() => {
    const body = document.getElementById('path-body');
    if (!body) return { error: 'no path-body' };
    const bodyRight = body.getBoundingClientRect().right;
    const cards = Array.from(body.querySelectorAll('[data-path-id]'));
    return cards.map(card => {
      // The tag is the second <span> inside the header row (Current / Switch → / Pick →)
      const headerRow = card.firstElementChild;
      const tag = headerRow?.children[1];
      const r = tag?.getBoundingClientRect();
      return {
        id: card.getAttribute('data-path-id'),
        tagText: tag?.innerText?.trim() || '(none)',
        tagRight: r?.right ?? 0,
        bodyRight: bodyRight,
        withinBody: r ? r.right <= bodyRight + 1 : false
      };
    });
  })()`);
  console.log('\nMobile path-card tag clipping:');
  console.log(JSON.stringify(tagReport, null, 2));
  if (Array.isArray(tagReport)) {
    for (const t of tagReport) {
      sm.assert(t.withinBody, `[mobile] card "${t.id}" tag "${t.tagText}" stays inside modal (right=${Math.round(t.tagRight)})`);
    }
  } else {
    sm.assert(false, `[mobile] expected tags array, got: ${JSON.stringify(tagReport)}`);
  }
  await sm.close();

  sd.report();
  sm.report();
  console.log('\nScreenshots:', OUT);
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
