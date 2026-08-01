// Probe: Home front door + scoped review + System Design deep links.
//
// Covers the 2026-08 navigation work end to end:
//   · a bare `/` boots into Home (not into a lesson) for a cold visitor
//   · a returning user with a lastLessonId ALSO gets Home, with that lesson
//     offered as the CONTINUE hero (boot policy: always-Home)
//   · an explicit lesson deep link still wins over the Home boot
//   · track cards show real progress and expand into subcategory rows
//   · a section's Continue lands on the first non-mastered lesson (forward
//     progress), NOT on the due one — the two affordances stay distinct
//   · a section's ⟲ starts a scoped review session: HUD mounts, queue is the
//     scope's repair list, Skip advances, Exit returns to Home
//   · #/m/review/<slug> deep-links straight into a scoped review
//   · System Design routes resolve (#/ddia, #/ddia/ch03) and Home's SD card
//     reads the manifest question counts
//
// Usage: node tools/cdp/home-nav.js [url] [outDir]

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/home-nav-probe';

// A seeded store: two mastered lessons (one overdue → repair queue), one weak.
const SEED = {
  __v: 5,
  progress: {
    'two-sum': { L1: 'passed', L2: 'passed', L3: 'passed' },
    'p-contains-dup': { L1: 'passed', L2: 'passed', L3: 'passed' },
    'p-anagrams': { L1: 'passed' },
  },
  reviews: {
    'two-sum': { lastPassedAt: Date.now() - 40 * 86400000, interval: 86400000, dueAt: Date.now() - 39 * 86400000 },
    'p-contains-dup': { lastPassedAt: Date.now(), interval: 30 * 86400000, dueAt: Date.now() + 30 * 86400000 },
  },
  weakness: { 'p-anagrams': 2 },
  lastLessonId: 'p-anagrams',
  lastTab: 'L1',
};

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  for (const mobile of [true, false]) {
    const tag = mobile ? 'mobile' : 'desktop';
    const s = await connect({ url: URL, mobile, outDir: `${OUT}/${tag}` });
    console.log(`\n── ${tag} ──`);

    // ── Cold boot: no state at all ──────────────────────────────────────
    await s.eval(`localStorage.clear()`);
    await s.reload();
    await s.waitFor(`!!document.querySelector('.home-page')`);
    s.assert(true, 'cold boot renders Home at the bare URL');
    s.assert(await s.eval(`location.hash === '#/m/home'`), 'cold boot normalizes the URL to #/m/home');
    s.assert(await s.eval(`document.querySelectorAll('.home-area').length === 3`), 'three track cards render');
    s.assert(await s.eval(`!!document.querySelector('[data-home-start]')`), 'cold boot still offers a hero start');
    await s.snap('01-home-cold');

    // ── Returning user: lastLessonId becomes the hero, not the screen ───
    await s.seedLocalStorage('jsdrill.progress.v1', SEED);
    await s.waitFor(`!!document.querySelector('.home-page')`);
    s.assert(true, 'returning user boots to Home, not into their last lesson');
    s.assert(
      await s.eval(`document.querySelector('[data-home-start]')?.getAttribute('data-home-start') === 'p-anagrams'`),
      'hero offers the lesson the user left off on'
    );
    const sub = await s.eval(`document.querySelector('.home-subline')?.textContent || ''`);
    s.assert(/due/.test(sub), `subline reports what is due (got: "${sub}")`);
    await s.snap('02-home-seeded');

    // ── Track cards carry real numbers ──────────────────────────────────
    const codingFrac = await s.eval(`document.querySelector('[data-home-area="coding"] .home-area__frac')?.textContent || ''`);
    s.assert(/^\d+\/\d+$/.test(codingFrac), `coding card shows a mastered/total fraction (got "${codingFrac}")`);
    s.assert(
      await s.eval(`(() => { const [m, t] = (document.querySelector('[data-home-area="coding"] .home-area__frac').textContent).split('/').map(Number); return m === 2 && t > 100; })()`),
      'coding fraction counts the two seeded mastered lessons out of the full problem set'
    );

    // ── Subcategory expansion ───────────────────────────────────────────
    await s.click('[data-home-toggle="coding"]');
    await s.waitFor(`document.querySelectorAll('[data-home-area="coding"] .home-subrow').length > 0`);
    const rows = await s.eval(`document.querySelectorAll('[data-home-area="coding"] .home-subrow').length`);
    s.assert(rows > 10, `coding expands into its sections (${rows} rows)`);
    s.assert(
      await s.eval(`!!document.querySelector('[data-home-review="arrays-and-hashing"]')`),
      'each section row carries its own scoped review button'
    );
    await s.snap('03-home-expanded');

    // Expansion persists across a reload (state.homeOpen).
    await s.reload();
    await s.waitFor(`!!document.querySelector('.home-page')`);
    s.assert(
      await s.eval(`document.querySelectorAll('[data-home-area="coding"] .home-subrow').length > 0`),
      'expanded track stays expanded after reload'
    );

    // ── Continue = forward progress (not the due lesson) ────────────────
    await s.click('[data-home-continue="arrays-and-hashing"]');
    await s.waitFor(`!!document.querySelector('#lesson-shell .tab-btn, #lesson-shell [data-tab]')`, { timeoutMs: 6000 });
    const contId = await s.eval(`state.currentLessonId`);
    s.assert(contId !== 'two-sum', `Continue skips the overdue mastered lesson (landed on ${contId})`);
    s.assert(
      await s.eval(`lessonOverallStatus(state.currentLessonId) !== 'mastered'`),
      'Continue lands on a lesson that still has work in it'
    );

    // ── ⟲ Review = the scope's repair queue ─────────────────────────────
    await s.eval(`document.getElementById('home-btn').click()`);
    await s.waitFor(`!!document.querySelector('.home-page')`);
    await s.click('[data-home-toggle="coding"]');
    await s.waitFor(`!!document.querySelector('[data-home-review="arrays-and-hashing"]')`);
    await s.click('[data-home-review="arrays-and-hashing"]');
    await s.waitFor(`!!document.getElementById('review-hud')`, { timeoutMs: 6000 });
    s.assert(true, 'scoped review mounts its HUD');
    s.assert(await s.eval(`document.body.classList.contains('review-active')`), 'body flags an active review');
    s.assert(await s.eval(`state.currentLessonId === 'two-sum'`), 'review queue opens the most overdue lesson first');
    const lvl = await s.eval(`_reviewSession && _reviewSession.level`);
    s.assert(lvl === (mobile ? 'L2' : 'L3'), `review lands on ${mobile ? 'L2 (touch)' : 'L3 (fine pointer)'} — got ${lvl}`);
    s.assert(
      await s.eval(`_reviewSession.ids.includes('p-anagrams')`),
      'the weak lesson is in the queue behind the overdue one'
    );
    // The HUD is a flex row, not an overlay — it must not cover the stage.
    s.assert(
      await s.eval(`(() => {
        const hud = document.getElementById('review-hud').getBoundingClientRect();
        const stage = document.querySelector('.app-stage').getBoundingClientRect();
        return hud.bottom <= stage.top + 1;
      })()`),
      'HUD sits above the stage instead of overlapping it'
    );
    await s.snap('04-review-hud');

    await s.click('[data-review-skip]');
    await s.waitFor(`_reviewSession && _reviewSession.pos === 1`);
    s.assert(true, 'Skip advances the queue');
    await s.click('[data-review-exit]');
    await s.waitFor(`!!document.querySelector('.home-page')`);
    s.assert(await s.eval(`!document.getElementById('review-hud')`), 'Exit unmounts the HUD and returns Home');

    // ── Deep links ──────────────────────────────────────────────────────
    await s.eval(`location.hash = '#/m/review/coding'`);
    await s.waitFor(`!!document.getElementById('review-hud')`, { timeoutMs: 6000 });
    s.assert(
      await s.eval(`(document.querySelector('.review-hud__label')?.textContent || '').includes('Coding')`),
      '#/m/review/<slug> deep-links into a scoped review'
    );
    await s.click('[data-review-exit]');
    await s.waitFor(`!!document.querySelector('.home-page')`);

    // A scope with nothing to repair says so instead of opening an empty
    // session (Syntax is untouched in the seed).
    await s.eval(`startScopedReview('syntax')`);
    await s.sleep(400);
    s.assert(
      await s.eval(`!document.getElementById('review-hud') && !!document.querySelector('.review-toast')`),
      'a scope with nothing due explains itself instead of starting an empty session'
    );

    await s.eval(`location.hash = '#/two-sum/L1'`);
    await s.sleep(700);
    s.assert(
      await s.eval(`state.currentLessonId === 'two-sum' && !document.querySelector('.home-page')`),
      'an explicit lesson deep link still beats the Home boot'
    );

    // ── System Design rollup + routes ───────────────────────────────────
    await s.eval(`document.getElementById('home-btn').click()`);
    await s.waitFor(`!!document.querySelector('[data-home-area="sysdesign"] .home-subrow')`, { timeoutMs: 8000 });
    const sdFrac = await s.eval(`document.querySelector('[data-home-area="sysdesign"] .home-area__frac')?.textContent || ''`);
    s.assert(/^\d+\/568$/.test(sdFrac), `System Design card totals all 568 authored questions (got "${sdFrac}")`);
    s.assert(
      await s.eval(`(document.querySelector('[data-home-sd-continue]')?.getAttribute('href') || '').startsWith('system-design.html')`),
      'System Design Continue points at the drill page'
    );
    await s.snap('05-home-sysdesign');

    await s.close();
    const r = s.report();
    if (r.failed || r.errors) process.exitCode = 1;
  }

  // ── System Design page routing (separate document) ────────────────────
  const sd = await connect({ url: URL.replace(/\/$/, '') + '/system-design.html#/ddia', outDir: `${OUT}/sysdesign` });
  console.log('\n── system-design routing ──');
  await sd.waitFor(`!!document.querySelector('.ch-card')`, { timeoutMs: 8000 });
  sd.assert(true, '#/<topic> deep-links to the topic chapter list');
  sd.assert(await sd.eval(`location.hash === '#/ddia'`), 'topic route is preserved');
  await sd.snap('01-topic');

  await sd.eval(`location.hash = '#/ddia/ch03'`);
  await sd.waitFor(`!!document.querySelector('#drill-all, .cta')`, { timeoutMs: 8000 });
  sd.assert(true, '#/<topic>/<unit> deep-links to the unit detail');
  await sd.snap('02-unit');

  await sd.eval(`location.hash = '#/ddia/mixed'`);
  await sd.waitFor(`!!document.querySelector('.q-stem')`, { timeoutMs: 8000 });
  sd.assert(true, '#/<topic>/mixed starts a due-first review session');
  await sd.snap('03-mixed');

  await sd.eval(`document.getElementById('home-btn').click()`);
  await sd.waitFor(`!!document.querySelector('.topic-card')`);
  sd.assert(await sd.eval(`location.hash === '#/'`), 'landing normalizes back to #/');

  await sd.close();
  const r2 = sd.report();
  if (r2.failed || r2.errors) process.exitCode = 1;
  // The CDP sockets keep the event loop alive after close(); exit explicitly
  // so the probe is usable in a script/CI pipeline.
  process.exit(process.exitCode || 0);
})().catch(err => { console.error('Probe error:', err.message); process.exit(1); });
