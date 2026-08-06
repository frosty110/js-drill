#!/usr/bin/env node
// Iter probe: Mechanics modal — cross-cutting drill surface.
//
// Asserts the full mobile flow:
//   A. Sidebar has a 🧩 Mechanics button; clicking it opens the modal.
//   B. List view renders category headers + mechanic buttons with
//      mastered/total badges, sourced from data/mechanics.json.
//   C. Clicking a mechanic transitions to detail view: snippet visible,
//      back button appears, lessons list rendered sorted by review priority.
//   D. Clicking a lesson closes the modal and navigates to that lesson.
//   E. Reopening + Escape closes the modal.

const { ensureServer, ensureChrome, connect } = require('../lib');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-mechanics';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Pre-seed: one mastered lesson + one due review, so the priority
  // sort and the mastery badge both have something to surface.
  await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const all = m.sections.flatMap(s => s.lessons).filter(l => l.status === 'full');
    const data = { __v: 5, welcomed: true, progress: {}, reviews: {} };
    // Mark first 3 patterns lessons mastered so several mechanics show non-zero mastery.
    const patterns = all.filter(l => l.track === 'patterns').slice(0, 3);
    for (const l of patterns) data.progress[l.id] = { L1: 'passed', L2: 'passed', L3: 'passed' };
    if (patterns[0]) data.reviews[patterns[0].id] = {
      lastPassedAt: Date.now() - 3*86400000, interval: 86400000, dueAt: Date.now() - 7200000
    };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
  })()`);
  await s.reload();

  // ── Scenario A: button present, click opens modal ──────────────────────
  // On mobile the sidebar is in a drawer — open it first.
  await s.click('#hamburger');
  await s.sleep(200);
  await s.snap('A-sidebar-open');
  const btnPresent = await s.eval(`!!document.getElementById('mechanics-btn')`);
  s.assert(btnPresent, '[A] 🧩 Mechanics button present in sidebar toolbar');

  await s.click('#mechanics-btn');
  // Wait for the body to populate past the "Loading…" placeholder.
  await s.waitFor(
    `(() => { const b = document.getElementById('mechanics-body'); return b && b.querySelectorAll('[data-mech-id]').length > 0; })()`,
    { timeoutMs: 6000 }
  );
  await s.snap('A-modal-list');

  const open = await s.eval(`(() => ({
    display: document.getElementById('mechanics-modal').style.display,
    title:   document.getElementById('mechanics-title')?.textContent.trim(),
  }))()`);
  s.assert(open.display === 'block', `[A] modal display=block (got: ${open.display})`);
  s.assert(/Mechanics/.test(open.title || ''), `[A] modal title contains "Mechanics" (got: ${open.title})`);

  // ── Scenario B: list view structure ────────────────────────────────────
  const listSummary = await s.eval(`(() => {
    const body = document.getElementById('mechanics-body');
    const cats = body.querySelectorAll('[data-mech-cat]');
    const mechs = body.querySelectorAll('[data-mech-id]');
    const firstMechBtn = mechs[0];
    const firstMechHtml = firstMechBtn?.outerHTML || '';
    // Look for the count badge — should be of the form "M/N" or "M/N · P%"
    const hasBadge = /\\d+\\/\\d+/.test(firstMechHtml);
    return {
      categoryCount: cats.length,
      mechanicCount: mechs.length,
      firstMechId: firstMechBtn?.getAttribute('data-mech-id'),
      hasBadge,
    };
  })()`);
  s.assert(listSummary.categoryCount >= 5,
    `[B] list shows ≥5 category headers (got: ${listSummary.categoryCount})`);
  s.assert(listSummary.mechanicCount >= 15,
    `[B] list shows ≥15 mechanics (got: ${listSummary.mechanicCount})`);
  s.assert(listSummary.hasBadge,
    `[B] mechanic buttons show mastered/total badge (got: ${listSummary.firstMechId})`);

  // ── Scenario C: click a known-tagged mechanic → detail view ───────────
  // Pick array-as-stack — well-covered (4 stack lessons + s-stack-pattern).
  const detailReady = await s.eval(`(() => {
    const btn = document.querySelector('[data-mech-id="array-as-stack"]');
    if (!btn) return { found: false };
    btn.click();
    return { found: true };
  })()`);
  s.assert(detailReady.found, '[C] array-as-stack button present in list');
  await s.waitFor(
    `(() => document.getElementById('mechanics-back')?.style.display !== 'none')()`,
    { timeoutMs: 3000 }
  );
  await s.snap('C-modal-detail');

  const detail = await s.eval(`(() => {
    const body = document.getElementById('mechanics-body');
    const backBtn = document.getElementById('mechanics-back');
    const title = document.getElementById('mechanics-title')?.textContent.trim();
    const sub = document.getElementById('mechanics-sub')?.textContent.trim();
    const snippet = body.querySelector('pre')?.textContent || '';
    const lessons = body.querySelectorAll('[data-lesson-id]');
    return {
      backVisible: backBtn?.style.display !== 'none',
      title,
      subLength: sub.length,
      snippetHasPushPop: /push|pop/.test(snippet),
      lessonCount: lessons.length,
      firstLessonId: lessons[0]?.getAttribute('data-lesson-id'),
    };
  })()`);
  s.assert(detail.backVisible, '[C] back button visible in detail view');
  s.assert(/Array-as-stack|array-as-stack/i.test(detail.title || ''),
    `[C] detail title shows mechanic label (got: ${detail.title})`);
  s.assert(detail.subLength > 20, '[C] detail subtitle shows the blurb');
  s.assert(detail.snippetHasPushPop,
    '[C] snippet block contains canonical idiom keywords (push/pop)');
  s.assert(detail.lessonCount >= 3,
    `[C] array-as-stack lists ≥3 tagged lessons (got: ${detail.lessonCount})`);

  // ── Scenario D: click a lesson → modal closes + navigates ─────────────
  const targetId = detail.firstLessonId;
  await s.click(`[data-lesson-id="${targetId}"]`);
  await s.sleep(700);
  await s.snap('D-lesson-navigated');
  const landed = await s.eval(`(() => ({
    modalDisplay: document.getElementById('mechanics-modal').style.display,
    currentLesson: window.__jsdrillState.currentLessonId,
  }))()`);
  s.assert(landed.modalDisplay === 'none',
    `[D] modal closed after lesson click (got: ${landed.modalDisplay})`);
  s.assert(landed.currentLesson === targetId,
    `[D] navigated to clicked lesson (expected ${targetId}, got: ${landed.currentLesson})`);

  // ── Scenario E: reopen + Escape closes ────────────────────────────────
  await s.click('#hamburger');
  await s.sleep(200);
  await s.click('#mechanics-btn');
  await s.waitFor(
    `(() => document.getElementById('mechanics-modal').style.display === 'block')()`,
    { timeoutMs: 3000 }
  );
  // Dispatch a real keydown so the existing global Esc handler runs.
  await s.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await s.sleep(150);
  const closed = await s.eval(`document.getElementById('mechanics-modal').style.display`);
  s.assert(closed === 'none', `[E] Escape closes modal (got: ${closed})`);

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
