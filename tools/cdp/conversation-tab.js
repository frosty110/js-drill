#!/usr/bin/env node
// Probe: the Conversation tab on p-longest-sub.
// Verifies that lessons with a `conversation` block get a leading
// Conversation tab (default-selected on first visit), that <details>
// sections start collapsed + expand on click, that "See the solution →"
// routes to Reference, and that lessons without a conversation block
// still default to Reference (no regression).

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-probe-conversation-tab';

async function runOne({ mobile, label }) {
  const s = await connect({ url: URL, mobile, outDir: `${OUT}-${label}` });

  // ARRANGE — land on p-longest-sub (the lesson with the conversation block)
  await s.evalAwait(`(async () => {
    const data = { __v: 5, welcomed: true, lastLessonId: 'p-longest-sub' };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  })()`);
  await s.reload();
  await s.sleep(800);

  // ASSERT — Conversation tab is rendered AND active by default
  await s.snap('01-loaded');
  const firstTab = await s.eval(`document.querySelector('#lesson-shell .tab-btn')?.textContent || ''`);
  s.assert(/Conversation/.test(firstTab), `[${label}] First tab is Conversation (got: ${JSON.stringify(firstTab)})`);

  const activeLevel = await s.eval(`document.querySelector('#lesson-shell .tab-btn.active')?.dataset?.level || ''`);
  s.assert(activeLevel === 'conversation', `[${label}] Conversation is active on first load (got: ${JSON.stringify(activeLevel)})`);

  // ASSERT — sections are collapsed by default
  const sectionCount = await s.eval(`document.querySelectorAll('.conv-section').length`);
  s.assert(sectionCount >= 5, `[${label}] >= 5 conversation sections (got: ${sectionCount})`);
  const openCount = await s.eval(`document.querySelectorAll('.conv-section[open]').length`);
  s.assert(openCount === 0, `[${label}] All sections collapsed initially (got open: ${openCount})`);

  // ACT — expand the first section by clicking its summary
  await s.eval(`document.querySelector('.conv-section .conv-summary')?.click()`);
  await s.sleep(250);
  await s.snap('02-first-expanded');
  const openAfter = await s.eval(`document.querySelectorAll('.conv-section[open]').length`);
  s.assert(openAfter === 1, `[${label}] First section opens after click (got: ${openAfter})`);

  // ASSERT — the revealed body has actual text (not empty)
  const revealText = await s.eval(`document.querySelector('.conv-section[open] .conv-body')?.textContent?.trim().length || 0`);
  s.assert(revealText > 50, `[${label}] Reveal body has substantive text (length: ${revealText})`);

  // ACT — open section 4 (the multi-example trace section) and verify the
  // worked-examples sub-blocks render and expand independently.
  const section4Title = await s.eval(`(() => {
    const sections = document.querySelectorAll('.conv-section');
    // Section 4 is index 3 (0-based)
    sections[3]?.querySelector('.conv-summary')?.click();
    return sections[3]?.querySelector('.conv-title')?.textContent || '';
  })()`);
  s.assert(/Trace/.test(section4Title), `[${label}] Section 4 is now the trace section (got: ${JSON.stringify(section4Title)})`);
  await s.sleep(200);
  const exampleCount = await s.eval(`document.querySelectorAll('.conv-section')[3]?.querySelectorAll('.conv-example').length || 0`);
  s.assert(exampleCount >= 3, `[${label}] Section 4 renders >= 3 worked examples (got: ${exampleCount})`);
  const exOpenInitial = await s.eval(`document.querySelectorAll('.conv-section')[3]?.querySelectorAll('.conv-example[open]').length || 0`);
  s.assert(exOpenInitial === 0, `[${label}] Worked examples collapsed initially (got open: ${exOpenInitial})`);
  // Expand the first worked example
  await s.eval(`document.querySelectorAll('.conv-section')[3]?.querySelector('.conv-example .conv-ex-summary')?.click()`);
  await s.sleep(200);
  // Scroll the expanded example into view so the screenshot is informative
  await s.eval(`document.querySelector('.conv-example[open]')?.scrollIntoView({ block: 'start' })`);
  await s.sleep(200);
  await s.snap('02b-example-expanded');
  const exOpenAfter = await s.eval(`document.querySelectorAll('.conv-section')[3]?.querySelectorAll('.conv-example[open]').length || 0`);
  s.assert(exOpenAfter === 1, `[${label}] First worked example expands independently (got open: ${exOpenAfter})`);
  const traceLen = await s.eval(`document.querySelector('.conv-example[open] .conv-ex-trace')?.textContent?.length || 0`);
  s.assert(traceLen > 100, `[${label}] Trace body has substantive monospace content (len: ${traceLen})`);

  // ACT — click "See the solution →" — should switch to Reference tab
  await s.eval(`document.querySelector('[data-action="conv-to-reference"]')?.click()`);
  await s.sleep(300);
  await s.snap('03-after-cta-to-reference');
  const nowActive = await s.eval(`document.querySelector('#lesson-shell .tab-btn.active')?.dataset?.level || ''`);
  s.assert(nowActive === 'reference', `[${label}] "See the solution" routes to Reference (got: ${JSON.stringify(nowActive)})`);

  // ACT — navigate to a different lesson that does NOT have conversation
  // (use the first Syntax lesson — basics/s-variables)
  await s.evalAwait(`(async () => {
    const data = { __v: 5, welcomed: true, lastLessonId: 's-variables' };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  })()`);
  await s.reload();
  await s.sleep(800);
  await s.snap('04-other-lesson');
  const otherFirstTab = await s.eval(`document.querySelector('#lesson-shell .tab-btn')?.textContent || ''`);
  s.assert(/Reference/.test(otherFirstTab) && !/Conversation/.test(otherFirstTab),
    `[${label}] Non-conversation lesson: first tab is Reference, no Conversation tab (got: ${JSON.stringify(otherFirstTab)})`);
  const otherActive = await s.eval(`document.querySelector('#lesson-shell .tab-btn.active')?.dataset?.level || ''`);
  s.assert(otherActive === 'reference', `[${label}] Non-conversation lesson defaults to Reference (got: ${JSON.stringify(otherActive)})`);

  const tabCount = await s.eval(`document.querySelectorAll('#lesson-shell .tab-btn').length`);
  s.assert(tabCount === 4, `[${label}] Non-conversation lesson shows 4 tabs, not 5 (got: ${tabCount})`);

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  return { failed, errors, networkErrors };
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  console.log('\n=== DESKTOP ===');
  const desktop = await runOne({ mobile: false, label: 'desktop' });
  console.log('\n=== MOBILE ===');
  const mobile = await runOne({ mobile: true, label: 'mobile' });

  const total = desktop.failed + desktop.errors + desktop.networkErrors
              + mobile.failed + mobile.errors + mobile.networkErrors;
  console.log(`\n=== TOTAL: ${total === 0 ? 'PASS' : 'FAIL'} ===`);
  process.exit(total > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
