#!/usr/bin/env node
// Iter probe: study-plan subscription + path switcher.
//
// Asserts the full mobile flow:
//   A. Sidebar shows a "Path: <label> ▾" chip; default label is "Starter Path".
//   B. Tapping the chip opens the switcher modal listing both paths, current marked.
//   C. While subscribed to Starter, 📅 Today's Plan opens the in-app modal (no nav).
//   D. Switching to "4-Day Interview Cram" updates the chip + persists to storage.
//   E. While subscribed to Cram, 📅 Today's Plan opens the full-window Cram Home (no modal, no nav).
//   F. Subscription survives a reload (persisted in jsdrill.progress.v1).

const { ensureServer, ensureChrome, connect } = require('../lib');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-path-switcher';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Clean baseline: dismiss welcome, no subscription set (→ defaults to starter).
  await s.evalAwait(`(async () => {
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({ __v: 6, welcomed: true, progress: {}, reviews: {} }));
  })()`);
  await s.reload();

  // Mobile: open the sidebar drawer.
  await s.click('#hamburger');
  await s.sleep(200);
  await s.snap('A-sidebar');

  // ── A: chip present, default label ───────────────────────────────────
  const chip = await s.eval(`(() => {
    const c = document.getElementById('path-chip');
    const l = document.getElementById('path-chip-label');
    return { present: !!c, label: l?.textContent?.trim() };
  })()`);
  s.assert(chip.present, '[A] path chip present in sidebar');
  s.assert(chip.label === 'Starter Path', `[A] default chip label is "Starter Path" (got: ${chip.label})`);

  // ── B: chip opens switcher modal ─────────────────────────────────────
  await s.click('#path-chip');
  await s.waitFor(`(() => document.getElementById('path-modal').style.display === 'block')()`, { timeoutMs: 3000 });
  await s.snap('B-switcher-open');
  const switcher = await s.eval(`(() => {
    const opts = document.querySelectorAll('#path-body [data-path-id]');
    const ids = [...opts].map(o => o.getAttribute('data-path-id'));
    const currentMarked = [...opts].some(o => o.getAttribute('data-path-id') === 'starter' && /Current/.test(o.textContent));
    return { optionCount: opts.length, ids, currentMarked };
  })()`);
  s.assert(switcher.optionCount >= 2, `[B] switcher lists ≥2 paths (got: ${switcher.optionCount})`);
  s.assert(switcher.ids.includes('starter') && switcher.ids.includes('prep-4day'),
    `[B] switcher includes starter + prep-4day (got: ${switcher.ids.join(',')})`);
  s.assert(switcher.currentMarked, '[B] currently-subscribed path is marked "Current"');

  // Close the switcher (Escape) before testing Today's Plan routing.
  await s.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await s.sleep(120);
  const closedB = await s.eval(`document.getElementById('path-modal').style.display`);
  s.assert(closedB === 'none', `[B] Escape closes the switcher (got: ${closedB})`);

  // ── C: subscribed to Starter → Today's Plan opens in-app modal ───────
  await s.click('#today-btn');
  await s.sleep(250);
  const cToday = await s.eval(`(() => ({
    todayDisplay: document.getElementById('today-modal').style.display,
    href: location.href,
  }))()`);
  s.assert(cToday.todayDisplay === 'block',
    `[C] Today's Plan opens the in-app modal while on Starter (got: ${cToday.todayDisplay})`);
  s.assert(!/prep\.html/.test(cToday.href), `[C] did not navigate away (href: ${cToday.href})`);
  // Close the today modal.
  await s.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await s.sleep(120);

  // ── D: switch to Cram → chip updates + persists ──────────────────────
  await s.click('#path-chip');
  await s.waitFor(`(() => document.getElementById('path-modal').style.display === 'block')()`, { timeoutMs: 3000 });
  await s.click(`[data-path-id="prep-4day"]`);
  await s.sleep(200);
  await s.snap('D-switched-to-cram');
  const afterSwitch = await s.eval(`(() => {
    const label = document.getElementById('path-chip-label')?.textContent?.trim();
    const modalClosed = document.getElementById('path-modal').style.display === 'none';
    const stored = JSON.parse(localStorage.getItem('jsdrill.progress.v1') || '{}').subscribedPathId;
    return { label, modalClosed, stored };
  })()`);
  s.assert(/4-Day/.test(afterSwitch.label || ''),
    `[D] chip label updates to the cram plan (got: ${afterSwitch.label})`);
  s.assert(afterSwitch.modalClosed, '[D] switcher closes after picking a path');
  s.assert(afterSwitch.stored === 'prep-4day',
    `[D] subscription persisted to storage (got: ${afterSwitch.stored})`);

  // ── E: subscribed to Cram → Today's Plan opens the full-window Cram Home ──
  await s.click('#today-btn');
  await s.sleep(400);
  await s.snap('E-cram-home');
  const eState = await s.eval(`(() => {
    const shell = document.getElementById('lesson-shell');
    return {
      todayModalDisplay: document.getElementById('today-modal').style.display,
      hasDayChips: shell.querySelectorAll('[data-cram-day]').length,
      hasAllChip: !!shell.querySelector('[data-cram-all]'),
      shellText: (shell.textContent || '').slice(0, 200),
      href: location.href
    };
  })()`);
  s.assert(eState.todayModalDisplay !== 'block',
    `[E] Today's Plan does NOT open today-modal on Cram (got: ${eState.todayModalDisplay})`);
  s.assert(!/prep\.html/.test(eState.href), `[E] did not navigate to a separate page (href: ${eState.href})`);
  s.assert(eState.hasDayChips === 4,
    `[E] Cram Home renders 4 day chips (got: ${eState.hasDayChips})`);
  s.assert(eState.hasAllChip,
    `[E] Cram Home renders the "All days" chip`);
  s.assert(/4-Day Interview Cram/.test(eState.shellText),
    `[E] Cram Home shows path label (got text snippet: ${eState.shellText.slice(0, 80)})`);

  // ── F: subscription survives a reload of the main app ────────────────
  await s.reload();
  await s.sleep(600);
  await s.click('#hamburger');
  await s.sleep(200);
  const persisted = await s.eval(`document.getElementById('path-chip-label')?.textContent?.trim()`);
  s.assert(/4-Day/.test(persisted || ''),
    `[F] subscription survives reload — chip still shows cram plan (got: ${persisted})`);

  // ── G: 🧭 button is renamed to "Path View" (unified, path-agnostic) ──
  const btnLabel = await s.eval(`document.getElementById('path-btn')?.textContent?.trim()`);
  s.assert(/Path View/.test(btnLabel || ''),
    `[G] 🧭 button reads "Path View", not "Starter Path" (got: ${btnLabel})`);

  // ── H: Path View filters the sidebar to the SUBSCRIBED path's lessons ──
  // Helper: pin the visible binder track to Patterns, then read the filtered
  // lesson ids. Pin happens AFTER any navigation (toggling Path View jumps to
  // the first path lesson, which can flip the binder track) so the capture is
  // deterministic on the Patterns track.
  const pinPatternsAndRead = async () => {
    await s.eval(`(() => {
      const tab = [...document.querySelectorAll('#binder-tabs .binder-tab')]
        .find(t => /Patterns/.test(t.textContent));
      if (tab) tab.click();
    })()`);
    await s.sleep(150);
    return s.eval(`(() => {
      const ids = [...document.querySelectorAll('#sidebar-nav [data-lesson-id]')].map(e => e.getAttribute('data-lesson-id'));
      return { count: ids.length, ids };
    })()`);
  };

  // Turn Path View ON (currently subscribed to prep-4day). This may navigate to
  // the first prep lesson; we pin the Patterns track afterward.
  await s.click('#path-btn');
  await s.sleep(200);
  const prepSet = await pinPatternsAndRead();
  await s.snap('H-prep-filtered');
  s.assert(prepSet.count > 0, `[H] prep path filters to ≥1 patterns lesson (got: ${prepSet.count})`);
  // Sanity: visible set must contain known prep patterns lessons (filter is real).
  const PREP_PATTERNS_SAMPLE = ['p-max-subarray', 'two-sum', 'p-daily-temp', 'valid-parentheses'];
  const prepHasKnown = PREP_PATTERNS_SAMPLE.some(id => prepSet.ids.includes(id));
  s.assert(prepHasKnown, `[H] prep-filtered Patterns view contains known prep lessons (ids: ${prepSet.ids.slice(0,6).join(',')})`);

  // Switch subscription to starter (Path View stays on). Sidebar should re-filter.
  await s.click('#path-chip');
  await s.waitFor(`(() => document.getElementById('path-modal').style.display === 'block')()`, { timeoutMs: 3000 });
  await s.click(`[data-path-id="starter"]`);
  await s.sleep(250);
  const starterSet = await pinPatternsAndRead();
  await s.snap('I-starter-filtered');
  s.assert(starterSet.count > 0, `[I] starter path filters to ≥1 patterns lesson (got: ${starterSet.count})`);
  // The two filtered sets must differ — starter patterns ⊋ prep patterns.
  const sameSet = prepSet.count === starterSet.count &&
    prepSet.ids.every(id => starterSet.ids.includes(id));
  s.assert(!sameSet,
    `[I] Path View follows the subscription — prep (${prepSet.count}) and starter (${starterSet.count}) filtered sets differ`);
  s.assert(starterSet.count > prepSet.count,
    `[I] starter patterns set is larger than prep's subset (starter: ${starterSet.count}, prep: ${prepSet.count})`);

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
