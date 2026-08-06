// Captures the Today's Plan modal (Starter Plan kind:'lessons' mode) in two
// real-world states a PROFILE.md user could be in:
//   (1) cold-start: zero progress, no due, no weak — what new users see.
//   (2) mid-flight: 4 due-for-review + 1 weakness — what week-2 users see.
// Both at mobile (375×667 per PROFILE.md ~80% phone) AND desktop (1280×800).
//
// The "click 📅 Today's Plan, see the curated session, tap an item to start"
// flow is the autopilot path PROFILE.md line 59-78 anchors the whole product
// on. This probe captures what the user actually sees.
//
// Run: node tools/cdp/refine-today-plan.js [outDir]
// Default outDir: /tmp/jsdrill-refine-05

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('../lib');

const OUT = process.argv[2] || '/tmp/jsdrill-refine-05';

const MIDFLIGHT_SEED = {
  __v: 5,
  welcomed: true,
  syncHintShown: true,
  progress: {
    // Seed a few mastered patterns so SR has something to surface.
    'two-sum':              { L1: 'passed', L2: 'passed', L3: 'passed' },
    'p-valid-anagram':      { L1: 'passed', L2: 'passed', L3: 'passed' },
    'p-contains-dup':       { L1: 'passed', L2: 'passed', L3: 'passed' },
    'p-longest-consecutive':{ L1: 'passed', L2: 'passed', L3: 'passed' },
  },
  reviews: {
    // dueAt in the past = due for review NOW
    'two-sum':               { lastPassedAt: Date.now() - 8*86400e3, interval: 1, dueAt: Date.now() - 86400e3 },
    'p-valid-anagram':       { lastPassedAt: Date.now() - 8*86400e3, interval: 1, dueAt: Date.now() - 2*86400e3 },
    'p-contains-dup':        { lastPassedAt: Date.now() - 8*86400e3, interval: 1, dueAt: Date.now() - 4*86400e3 },
    'p-longest-consecutive': { lastPassedAt: Date.now() - 8*86400e3, interval: 1, dueAt: Date.now() - 86400e3 },
  },
  weakness: { 'p-anagrams': true },
  starterPath: true,
};

async function capture(s, label) {
  await s.eval(`document.getElementById('today-btn').click()`);
  await s.waitFor(`document.getElementById('today-modal').style.display === 'block'`, { timeoutMs: 5000 });
  await s.sleep(300);
  await s.snap(label);
  await s.eval(`document.getElementById('today-modal').style.display = 'none'`);
  await s.sleep(150);
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
  // Cold-start (default seed - no progress)
  await sd.seedLocalStorage('jsdrill.progress.v1', { __v: 5, welcomed: true, syncHintShown: true });
  await sd.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await capture(sd, '01-coldstart-desktop');
  // Mid-flight
  await sd.seedLocalStorage('jsdrill.progress.v1', MIDFLIGHT_SEED);
  await sd.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await capture(sd, '02-midflight-desktop');
  // Iter-10 primary-CTA assertions (mid-flight, plan has items).
  const ctaReport = await sd.eval(`(() => {
    const cta = document.querySelector('#today-body [data-action="start-first"]');
    if (!cta) return { error: 'no [data-action=start-first] button — iter-10 fix not in place' };
    const cards = document.querySelectorAll('#today-body [data-lesson-id]');
    const firstCardId = cards.length > 1 ? cards[1].getAttribute('data-lesson-id') : null;
    return {
      ctaPresent: true,
      ctaText: cta.innerText.replace(/\\s+/g, ' ').trim(),
      ctaLessonId: cta.getAttribute('data-lesson-id'),
      // iter 42: list now starts at plan[1], so first list card should be DIFFERENT from the CTA.
      firstListCardLessonId: firstCardId,
      totalLessonIdElements: cards.length, // primary + 5 alt list items = 6
    };
  })()`);
  console.log('\nDesktop mid-flight primary-CTA report:');
  console.log(JSON.stringify(ctaReport, null, 2));
  sd.assert(ctaReport.ctaPresent === true, `[desktop] primary [data-action=start-first] CTA exists`);
  sd.assert(/🎯 Start/.test(ctaReport.ctaText || ''), `[desktop] CTA text contains "🎯 Start"`);
  sd.assert(ctaReport.ctaLessonId !== ctaReport.firstListCardLessonId,
    `[desktop] iter 42: CTA's plan[0] ("${ctaReport.ctaLessonId}") should NOT appear as first list card ("${ctaReport.firstListCardLessonId}")`);
  sd.assert(ctaReport.totalLessonIdElements === 6,
    `[desktop] iter 42: CTA + 5 alt list cards = 6 [data-lesson-id] elements (got ${ctaReport.totalLessonIdElements})`);

  // iter-22 invariant: an inventory row [data-today-inventory] sits between
  // the CTA and the "Or pick another" divider, summarizing what's in today's
  // session (e.g. "3 due · 1 weak · 2 on path"). It renders only when ≥2
  // why-buckets are populated; the MIDFLIGHT seed has all three.
  const invReport = await sd.eval(`(() => {
    const inv = document.querySelector('#today-body [data-today-inventory]');
    if (!inv) return { exists: false };
    const text = inv.textContent.replace(/\\s+/g, ' ').trim();
    return { exists: true, text };
  })()`);
  console.log('\nDesktop inventory report:', JSON.stringify(invReport));
  sd.assert(invReport.exists, `[desktop] [data-today-inventory] row should render with 3+ buckets active`);
  sd.assert(invReport.exists && /\d+ DUE/i.test(invReport.text || ''),
    `[desktop] inventory should include "N DUE" (got "${invReport.text}")`);
  sd.assert(invReport.exists && /\d+ WEAK/i.test(invReport.text || ''),
    `[desktop] inventory should include "N WEAK" (got "${invReport.text}")`);
  sd.assert(invReport.exists && /\d+ ON PATH/i.test(invReport.text || ''),
    `[desktop] inventory should include "N ON PATH" (got "${invReport.text}")`);
  // Click the CTA — assert state.currentLessonId flips to the CTA's lessonId.
  const ctaLessonId = ctaReport.ctaLessonId;
  await sd.eval(`document.querySelector('#today-body [data-action="start-first"]').click()`);
  await sd.sleep(400);
  const navLessonId = await sd.eval(`window.__jsdrillState.currentLessonId`);
  sd.assert(navLessonId === ctaLessonId, `[desktop] clicking CTA navigated to lesson "${ctaLessonId}" (got "${navLessonId}")`);
  // Verify modal closed after the click.
  const modalDisplay = await sd.eval(`document.getElementById('today-modal').style.display`);
  sd.assert(modalDisplay === 'none', `[desktop] modal closed after CTA click (display="${modalDisplay}")`);
  await sd.close();

  // Mobile pass
  const sm = await connect({
    url: 'http://localhost:8765/',
    mobile: true,
    outDir: OUT
  });
  await sm.seedLocalStorage('jsdrill.progress.v1', { __v: 5, welcomed: true, syncHintShown: true });
  await sm.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await capture(sm, '03-coldstart-mobile');
  await sm.seedLocalStorage('jsdrill.progress.v1', MIDFLIGHT_SEED);
  await sm.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await capture(sm, '04-midflight-mobile');

  // Mobile clipping assertion — the why-tag's right edge must be INSIDE the
  // modal body's right edge. Pre-fix this would fail (tag clipped off-screen).
  await sm.eval(`document.getElementById('today-btn').click()`);
  await sm.waitFor(`document.getElementById('today-modal').style.display === 'block'`, { timeoutMs: 5000 });
  await sm.sleep(300);
  const clipReport = await sm.eval(`(() => {
    const body = document.getElementById('today-body');
    if (!body) return { error: 'no today-body' };
    const bodyRight = body.getBoundingClientRect().right;
    const tags = Array.from(body.querySelectorAll('[data-why-tag]'));
    if (!tags.length) return { error: 'no [data-why-tag] tags rendered — refinement not in place' };
    return tags.map(t => {
      const r = t.getBoundingClientRect();
      return { text: t.textContent, right: r.right, withinBody: r.right <= bodyRight + 1 };
    });
  })()`);
  console.log('\nMobile tag-clipping report:');
  console.log(JSON.stringify(clipReport, null, 2));
  if (Array.isArray(clipReport)) {
    for (const t of clipReport) {
      sm.assert(t.withinBody, `[mobile] tag "${t.text}" stays inside modal body (right=${Math.round(t.right)})`);
    }
    sm.assert(clipReport.length === 5, `[mobile] iter 42: 5 alt list items (plan[1..]) have why-tags (got ${clipReport.length})`);
  } else {
    sm.assert(false, `[mobile] expected tags array, got: ${JSON.stringify(clipReport)}`);
  }
  await sm.close();

  sd.report();
  sm.report();
  console.log('\nScreenshots:', OUT);
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
