// Captures the Repair filter chip (🔧 Repair N) in the sidebar header — both
// ON and OFF states — at mobile (375x667) AND desktop (1280x800) to study
// the chip's discoverability + active-state painting.
//
// Run: node tools/cdp/refine-repair-filter.js [outDir]

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('../lib');

const OUT = process.argv[2] || '/tmp/jsdrill-refine-44';

const SEED = {
  __v: 5,
  welcomed: true,
  syncHintShown: true,
  subscribedPathId: 'starter',
  starterPath: true,
  // Mark 4 lessons as having weakness so Repair has work to do.
  weakness: { 'two-sum': 2, 'p-anagrams': 3, 'p-contains-dup': 1, 'p-valid-anagram': 1 },
  // Mark a couple of mastered lessons with reveal flag so they enter repair set too.
  revealed: { 's-strings': { L3: true } },
  progress: {
    's-strings': { L1: 'passed', L2: 'passed', L3: 'passed' },
  },
};

async function capture(s, label) {
  await s.snap(label);
}

(async () => {
  await ensureServer({ port: 8765, dir: path.resolve(__dirname, '../..') });
  await ensureChrome();

  for (const mode of ['desktop', 'mobile']) {
    const s = await connect({
      url: 'http://localhost:8765/',
      mobile: mode === 'mobile',
      viewport: mode === 'desktop' ? { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false } : undefined,
      outDir: OUT,
    });
    await s.seedLocalStorage('jsdrill.progress.v1', SEED);
    await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
    await s.sleep(300);

    // On mobile, open the sidebar drawer first so the chip is visible.
    if (mode === 'mobile') {
      await s.eval(`document.getElementById('hamburger')?.click()`);
      await s.sleep(300);
    }

    // OFF state
    await capture(s, `01-repair-off-${mode}`);

    // Read the chip info
    const chipBefore = await s.eval(`(() => {
      const btn = document.getElementById('repair-filter-btn');
      if (!btn) return null;
      const cs = getComputedStyle(btn);
      const cnt = document.getElementById('repair-filter-count');
      const cntCs = cnt ? getComputedStyle(cnt) : null;
      return {
        text: btn.textContent.replace(/\\s+/g, ' ').trim(),
        countNode: cnt?.textContent,
        color: cs.color,
        countColor: cntCs?.color,
        countHasRose: cnt?.classList.contains('text-rose-300') ?? false,
        cls: btn.className,
        title: btn.title,
        ariaPressed: btn.getAttribute('aria-pressed'),
      };
    })()`);
    console.log(`[${mode}] chip OFF:`, JSON.stringify(chipBefore));
    s.assert(!!chipBefore, `[${mode}] Repair chip should exist`);
    s.assert(chipBefore && parseInt(chipBefore.countNode || '0') >= 4,
      `[${mode}] Repair count should reflect seeded weakness (got "${chipBefore?.countNode}")`);

    // iter 44 (refine): the COUNT span should paint rose when filter is OFF
    // and count > 0 (the live-decay signal). Label stays muted slate.
    s.assert(chipBefore && chipBefore.countHasRose === true,
      `[${mode}] iter 44: count span should carry text-rose-300 when OFF and N>0 (got class "${chipBefore?.countHasRose}")`);
    // Label color (button color) should remain in the slate family (not rose) — the
    // affordance "tap to filter" stays calm; only the count number pops.
    const isSlate = chipBefore && /rgb\(\s*(?:71|100|148|71)/.test(chipBefore.color || '');
    s.assert(isSlate, `[${mode}] iter 44: button label should stay slate when OFF (got color ${chipBefore?.color})`);
    // Count color should be in the rose family (RGB channel pattern fcafa-ish — rose-300 = rgb(253, 164, 175)).
    const isRose = chipBefore && /rgb\(\s*25[0-5][,\s]+1[56][0-9]/.test(chipBefore.countColor || '');
    s.assert(isRose, `[${mode}] iter 44: count color should be rose-tinted when OFF and N>0 (got ${chipBefore?.countColor})`);

    // Toggle ON
    await s.eval(`document.getElementById('repair-filter-btn').click()`);
    await s.sleep(400);
    await capture(s, `02-repair-on-${mode}`);

    const chipAfter = await s.eval(`(() => {
      const btn = document.getElementById('repair-filter-btn');
      const cs = getComputedStyle(btn);
      return {
        text: btn.textContent.replace(/\\s+/g, ' ').trim(),
        color: cs.color,
        cls: btn.className,
        active: btn.classList.contains('text-rose-300'),
        ariaPressed: btn.getAttribute('aria-pressed'),
        visibleLessons: document.querySelectorAll('#sidebar-nav .lesson-link').length,
      };
    })()`);
    console.log(`[${mode}] chip ON:`, JSON.stringify(chipAfter));
    s.assert(chipAfter.active, `[${mode}] chip should paint active when ON`);

    s.report();
    await s.close();
  }
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
