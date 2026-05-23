#!/usr/bin/env node
// Iteration 3 regression probe: confirm that revealing the answer on a due
// lesson DEMOTES the SR bucket by one step and resets dueAt by the new
// (shorter) interval. Symmetric counterpart to sr-l2-holds-bucket.js.
//
// Scenario:
//   1. Seed a mastered lesson with a 3-day interval, dueAt in the past.
//   2. Open the lesson on L3 and click the Reveal button (auto-confirm the
//      dialog via Page.handleJavaScriptDialog).
//   3. Assert: reviews[id].interval is now 1d (1 step down from 3d);
//      dueAt is ~ now + 1d.
//   4. Negative test: seed a NOT-due lesson at 3d, reveal — assert the
//      interval is unchanged. We don't want to demote a lesson the user
//      voluntarily reviewed early.

const { ensureServer, ensureChrome, connect } = require('./lib');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-iter3';

const ONE_DAY = 86400000;
const THREE_DAYS = 3 * ONE_DAY;
const TOLERANCE = 60000;

async function runOneScenario({ urlSession, dueAtOffset, label }) {
  // dueAtOffset: ms relative to now. Negative = overdue, positive = future.
  const seeded = await urlSession.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const sample = m.sections.flatMap(s => s.lessons).find(l => l.status === 'full');
    if (!sample) return null;
    const data = {
      __v: 4,
      welcomed: true,
      progress: { [sample.id]: { L1: 'passed', L2: 'passed', L3: 'passed' } },
      reviews: { [sample.id]: {
        lastPassedAt: Date.now() - 4*86400000,
        interval: 3*86400000,
        dueAt: Date.now() + ${dueAtOffset},
      }},
    };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
    return sample.id;
  })()`);
  if (!seeded) throw new Error('no full lesson in manifest to seed');
  await urlSession.reload();

  // Navigate to the seeded lesson, switch to L3.
  await urlSession.eval(`(() => {
    const link = document.querySelector('[data-lesson-id=' + JSON.stringify(${JSON.stringify(seeded)}) + ']');
    if (link) link.click();
  })()`);
  await urlSession.sleep(400);
  await urlSession.eval(`[...document.querySelectorAll('.tab-btn')].find(b => /Drill|L3/.test(b.textContent))?.click()`);
  await urlSession.sleep(500);
  await urlSession.snap(`${label}-on-l3`);

  // The L3 reveal button uses window.confirm; auto-stub it to accept.
  await urlSession.eval(`window.confirm = () => true`);
  await urlSession.eval(`document.querySelector('[data-action="reveal"]')?.click()`);
  await urlSession.sleep(300);
  await urlSession.snap(`${label}-after-reveal`);

  const after = await urlSession.eval(`(() => {
    const r = window.__jsdrillState.reviews[${JSON.stringify(seeded)}];
    return r ? { interval: r.interval, dueAt: r.dueAt } : null;
  })()`);
  // L3 reveal puts feedback inside .feedback element; grab text for assertion.
  const feedbackText = await urlSession.eval(`document.querySelector('.feedback')?.textContent || ''`);
  return { seeded, after, feedbackText };
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({
    url: URL,
    viewport: { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
    outDir: OUT,
  });

  // --- Scenario A: DUE lesson, reveal → bucket demotes 3d → 1d ---
  const a = await runOneScenario({ urlSession: s, dueAtOffset: -86400000, label: 'due' });
  s.assert(a.after?.interval === ONE_DAY,
    `[due] interval demoted 3d → 1d (got ${a.after?.interval}; expected ${ONE_DAY})`);
  s.assert(Math.abs(a.after.dueAt - (Date.now() + ONE_DAY)) < TOLERANCE,
    `[due] dueAt reset to ~now+1d (delta ${a.after.dueAt - (Date.now() + ONE_DAY)}ms)`);
  // iter 4: SR-impact feedback surfaces the demote.
  s.assert(/Interval shortened/i.test(a.feedbackText) && /in 1d/.test(a.feedbackText),
    `[due] L3 feedback surfaces "Interval shortened — next review in 1d." (got: ${JSON.stringify(a.feedbackText)})`);

  // --- Scenario B: NOT-due lesson, reveal → bucket UNCHANGED ---
  const b = await runOneScenario({ urlSession: s, dueAtOffset: ONE_DAY, label: 'not-due' });
  s.assert(b.after?.interval === THREE_DAYS,
    `[not-due] interval HELD at 3d (got ${b.after?.interval})`);
  // dueAt should still be ~now+1d (the seeded future date), not perturbed.
  s.assert(Math.abs(b.after.dueAt - (Date.now() + ONE_DAY)) < TOLERANCE,
    `[not-due] dueAt unchanged from seed (delta ${b.after.dueAt - (Date.now() + ONE_DAY)}ms)`);
  // iter 4: no demote feedback when the lesson wasn't due.
  s.assert(!/Interval shortened/i.test(b.feedbackText),
    `[not-due] L3 feedback does NOT surface "Interval shortened" (got: ${JSON.stringify(b.feedbackText)})`);

  // --- Scenario C: due lesson already at bucket 0 — floor, no underflow ---
  const seededC = await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const sample = m.sections.flatMap(s => s.lessons).find(l => l.status === 'full');
    const data = {
      __v: 4, welcomed: true,
      progress: { [sample.id]: { L1: 'passed', L2: 'passed', L3: 'passed' } },
      reviews: { [sample.id]: {
        lastPassedAt: Date.now() - 2*86400000,
        interval: 86400000,
        dueAt: Date.now() - 86400000,
      }},
    };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
    return sample.id;
  })()`);
  await s.reload();
  await s.eval(`(() => {
    const link = document.querySelector('[data-lesson-id=' + JSON.stringify(${JSON.stringify(seededC)}) + ']');
    if (link) link.click();
  })()`);
  await s.sleep(400);
  await s.eval(`[...document.querySelectorAll('.tab-btn')].find(b => /Drill|L3/.test(b.textContent))?.click()`);
  await s.sleep(500);
  await s.eval(`window.confirm = () => true`);
  await s.eval(`document.querySelector('[data-action="reveal"]')?.click()`);
  await s.sleep(300);
  await s.snap('floor-after-reveal');
  const c = await s.eval(`(() => {
    const r = window.__jsdrillState.reviews[${JSON.stringify(seededC)}];
    return r ? { interval: r.interval, dueAt: r.dueAt } : null;
  })()`);
  s.assert(c?.interval === ONE_DAY,
    `[floor] interval stays at 1d (got ${c?.interval}; no underflow)`);
  s.assert(Math.abs(c.dueAt - (Date.now() + ONE_DAY)) < TOLERANCE,
    `[floor] dueAt reset to ~now+1d (delta ${c.dueAt - (Date.now() + ONE_DAY)}ms)`);

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
