// Captures the L2 fill-in surface on a Patterns lesson (two-sum, 2 exercises)
// at desktop + mobile. Inspects:
//   - Multi-exercise vertical layout
//   - "Check" feedback / pass markers
//   - Per-exercise pass tracking
//   - Mobile chip vs desktop input divergence
//
// Run: node tools/cdp/refine-l2.js

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('../lib');

const OUT = '/tmp/jsdrill-refine-12';
const LESSON_ID = 'two-sum';

async function setup(s) {
  await s.seedLocalStorage('jsdrill.progress.v1', {
    __v: 5, welcomed: true, syncHintShown: true
  });
  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await s.eval(`window.selectLesson(${JSON.stringify(LESSON_ID)})`);
  await s.waitFor(`document.querySelector('#lesson-shell h2') !== null`, { timeoutMs: 6000 });
  await s.eval(`window.selectTab('L2')`);
  await s.sleep(500);
}

async function reportL2(s) {
  return await s.eval(`(() => {
    const cards = Array.from(document.querySelectorAll('#lesson-shell .mb-6.p-5'));
    return {
      cardCount: cards.length,
      cards: cards.map((c, i) => {
        const passed = c.querySelector('.feedback')?.innerText?.includes('passed') || false;
        const hasReveal = !!c.querySelector('[data-action="reveal"]');
        const hasCheck = !!c.querySelector('[data-action="check"]');
        const r = c.getBoundingClientRect();
        return { idx: i + 1, passed, hasReveal, hasCheck, height: Math.round(r.height) };
      }),
      // Per-exercise marker (✓) visible somewhere?
      passMarkers: Array.from(document.querySelectorAll('#lesson-shell .text-emerald-400'))
                       .map(el => el.innerText).filter(t => t.trim()),
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
  await setup(sd);
  await sd.snap('01-desktop-l2-fresh');
  const dr = await reportL2(sd);
  console.log('\n[desktop L2 fresh state]:');
  console.log('  exercises:', dr.cardCount);
  for (const c of dr.cards) console.log(`    Ex ${c.idx}: passed=${c.passed} height=${c.height}px reveal=${c.hasReveal} check=${c.hasCheck}`);
  await sd.close();

  // Mobile pass
  const sm = await connect({
    url: 'http://localhost:8765/',
    mobile: true,
    outDir: OUT
  });
  await setup(sm);
  await sm.snap('02-mobile-l2-fresh');
  const mr = await reportL2(sm);
  console.log('\n[mobile L2 fresh state]:');
  console.log('  exercises:', mr.cardCount);
  for (const c of mr.cards) console.log(`    Ex ${c.idx}: passed=${c.passed} height=${c.height}px reveal=${c.hasReveal} check=${c.hasCheck}`);

  // Iter 12 auto-advance assertion (mobile).
  // 1. Capture Ex 2's top position BEFORE Check on Ex 1.
  const ex2TopBefore = await sm.eval(`(() => {
    const cards = document.querySelectorAll('#lesson-shell .mb-6.p-5');
    return cards[1]?.getBoundingClientRect().top ?? null;
  })()`);
  console.log('\nBEFORE click — Ex 2 top:', Math.round(ex2TopBefore));

  // 2. Programmatically fill Ex 1's blanks with the canonical answers and click Check.
  await sm.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    let slug;
    for (const sec of m.sections) {
      if (sec.lessons.find(l => l.id === '${LESSON_ID}')) { slug = sec.slug; break; }
    }
    const lesson = await fetch('./data/' + slug + '/${LESSON_ID}.json').then(r => r.json());
    const ex1 = lesson.L2.exercises[0];
    const card1 = document.querySelectorAll('#lesson-shell .mb-6.p-5')[0];
    const chips = card1.querySelectorAll('.blank-chip');
    // Set each chip's value via the mobile path's cache + DOM sync.
    chips.forEach((chip, i) => {
      const answer = ex1.blanks[i].answer;
      const valueEl = chip.querySelector('.chip-value');
      if (valueEl) valueEl.textContent = answer;
      chip.classList.add('has-value');
      // Also poke the cache so Check reads the right values.
      const cached = window.__jsdrillState._l2cache || null;
      // The mobile cache is exerciseState[exi].values — easier path: directly grab
      // the inputs array via a fake input event would require deeper access.
      // Instead, force-mutate via _cacheGet helper.
      if (typeof _cacheGet === 'function') {
        const c = _cacheGet('${LESSON_ID}', 'L2');
        if (Array.isArray(c)) c[0].values[i] = answer;
      }
    });
    // Click Check.
    card1.querySelector('[data-action="check"]').click();
  })()`);
  // 3. Wait for ✓ Pass and the smooth scroll to land.
  await sm.waitFor(`document.querySelectorAll('#lesson-shell .mb-6.p-5')[0].querySelector('.feedback').innerText.includes('Pass')`, { timeoutMs: 5000 });
  await sm.sleep(900); // wait for smooth-scroll animation to complete
  await sm.snap('03-mobile-after-ex1-pass');

  // 4. Assert Ex 2's top is now near viewport top (auto-scrolled).
  const ex2TopAfter = await sm.eval(`(() => {
    const cards = document.querySelectorAll('#lesson-shell .mb-6.p-5');
    return cards[1]?.getBoundingClientRect().top ?? null;
  })()`);
  console.log('AFTER click — Ex 2 top:', Math.round(ex2TopAfter));
  sm.assert(ex2TopBefore !== null && ex2TopAfter !== null, `[mobile] Ex 2 position measurable before/after`);
  sm.assert(ex2TopAfter < ex2TopBefore, `[mobile] Ex 2 scrolled UP (top moved from ${Math.round(ex2TopBefore)} to ${Math.round(ex2TopAfter)})`);
  sm.assert(ex2TopAfter < 150, `[mobile] Ex 2 now near viewport top (top=${Math.round(ex2TopAfter)}, expected <150)`);

  await sm.close();
  sm.report();
  console.log('\nScreenshots:', OUT);
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
