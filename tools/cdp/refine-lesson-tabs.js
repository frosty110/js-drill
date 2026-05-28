// Captures the lesson-tabs strip (Conversation / Walkthrough / Reference /
// L1 / L2 / L3 for Patterns lessons; 4 for Syntax) on mobile + desktop.
// Two scenarios:
//   (1) Patterns lesson 'two-sum' (6 tabs — horizontal scroll territory)
//   (2) Patterns lesson on tab '3. Reference' (default landing) — does the
//       strip auto-scroll the active tab into view on mobile?
//   (3) Patterns lesson with currentTab='L3' (last tab) — is L3 visible
//       without manual scrolling?
//
// Run: node tools/cdp/refine-lesson-tabs.js [outDir]

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('./lib');

const OUT = process.argv[2] || '/tmp/jsdrill-refine-09';
const LESSON_ID = 'two-sum';

async function setup(s, lastTab = 'reference') {
  await s.seedLocalStorage('jsdrill.progress.v1', {
    __v: 5, welcomed: true, syncHintShown: true,
    lastLessonId: LESSON_ID, lastTab
  });
  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await s.eval(`window.selectLesson(${JSON.stringify(LESSON_ID)})`);
  await s.waitFor(`document.querySelector('#lesson-shell h2') !== null`, { timeoutMs: 6000 });
  await s.waitFor(`document.querySelectorAll('.tab-btn').length > 0`, { timeoutMs: 5000 });
  await s.sleep(300);
}

async function reportTabs(s, label) {
  return await s.eval(`(() => {
    const strip = document.querySelector('#lesson-shell .flex.border-b');
    if (!strip) return { error: 'no strip' };
    const stripRect = strip.getBoundingClientRect();
    const tabs = Array.from(strip.querySelectorAll('.tab-btn'));
    return {
      label: ${JSON.stringify(label)},
      stripLeft: stripRect.left,
      stripRight: stripRect.right,
      stripScrollLeft: strip.scrollLeft,
      stripScrollWidth: strip.scrollWidth,
      stripClientWidth: strip.clientWidth,
      isScrollable: strip.scrollWidth > strip.clientWidth,
      tabs: tabs.map(t => {
        const r = t.getBoundingClientRect();
        return {
          text: t.innerText.replace(/\\s+/g, ' '),
          active: t.classList.contains('active'),
          left: r.left,
          right: r.right,
          fullyVisible: r.left >= stripRect.left - 1 && r.right <= stripRect.right + 1
        };
      })
    };
  })()`);
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
  await setup(sd, 'reference');
  await sd.snap('01-desktop-reference');
  const dr = await reportTabs(sd, 'desktop-reference');
  console.log('\n[desktop, default tab = Reference]:');
  console.log('  scrollable:', dr.isScrollable, ' tabs:', dr.tabs.length);
  for (const t of dr.tabs) console.log(`    ${t.active ? '* ' : '  '}${t.text} ${t.fullyVisible ? '' : '(CLIPPED)'}`);
  await sd.close();

  // Mobile pass — default tab
  const sm = await connect({
    url: 'http://localhost:8765/',
    mobile: true,
    outDir: OUT
  });
  await setup(sm, 'reference');
  await sm.snap('02-mobile-default-tab-reference');
  const mr = await reportTabs(sm, 'mobile-reference');
  console.log('\n[mobile, default tab = Reference]:');
  console.log('  scrollable:', mr.isScrollable, ' scrollWidth:', Math.round(mr.stripScrollWidth), ' clientWidth:', Math.round(mr.stripClientWidth));
  for (const t of mr.tabs) console.log(`    ${t.active ? '* ' : '  '}${t.text} ${t.fullyVisible ? '' : '(CLIPPED — left=' + Math.round(t.left) + ' right=' + Math.round(t.right) + ' strip-right=' + Math.round(mr.stripRight) + ')'}`);

  // Mobile pass — navigate to L3 (the LAST of 6 tabs) via selectTab AFTER
  // selectLesson (selectLesson resets currentTab to 'auto'; selectTab sets it
  // explicitly). With the iter-9 fix, the strip should auto-scroll to bring
  // the L3 tab fully into the visible window.
  await sm.eval(`window.selectTab('L3')`);
  await sm.sleep(400);
  await sm.snap('03-mobile-tab-L3');
  const mL3 = await reportTabs(sm, 'mobile-L3');
  console.log('\n[mobile, currentTab = L3 (last of 6 tabs)]:');
  for (const t of mL3.tabs) console.log(`    ${t.active ? '* ' : '  '}${t.text} ${t.fullyVisible ? '' : '(CLIPPED — left=' + Math.round(t.left) + ' right=' + Math.round(t.right) + ')'}`);
  const activeTab = mL3.tabs.find(t => t.active);
  sm.assert(!!activeTab, `[mobile L3] active tab exists`);
  sm.assert(activeTab?.text?.includes('L3'), `[mobile L3] active tab is the L3 — Drill tab (got "${activeTab?.text}")`);
  sm.assert(activeTab?.fullyVisible === true, `[mobile L3] active L3 tab is fully visible (auto-scrolled into strip's window)`);

  // Also test mid-strip: L1 (tab 4 of 6) — should also be brought into view.
  await sm.eval(`window.selectTab('L1')`);
  await sm.sleep(400);
  const mL1 = await reportTabs(sm, 'mobile-L1');
  const activeL1 = mL1.tabs.find(t => t.active);
  sm.assert(activeL1?.text?.includes('L1'), `[mobile L1] active tab is L1 (got "${activeL1?.text}")`);
  sm.assert(activeL1?.fullyVisible === true, `[mobile L1] active L1 tab is fully visible after auto-scroll`);
  await sm.snap('04-mobile-tab-L1');

  await sm.close();
  sd.report();
  sm.report();
  console.log('\nScreenshots:', OUT);
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
