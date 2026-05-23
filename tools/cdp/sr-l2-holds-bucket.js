#!/usr/bin/env node
// Iteration 2 probe: confirm that passing L2 on a due lesson HOLDS the
// interval bucket and pushes dueAt by exactly the current interval — and
// does NOT advance to the next bucket.
//
// Scenario:
//   1. Seed a mastered lesson with a 1d interval, dueAt in the past.
//   2. Navigate to L2 (desktop layout — inline inputs we can drive directly).
//   3. Fill every blank in every exercise with the canonical answer.
//   4. Click Check on each exercise card. The last one triggers markPassed.
//   5. Assert: reviews[id].interval is still 1d; reviews[id].dueAt advanced
//      to ~ now + 1d. NOT 3d (which would mean we advanced the bucket).
//
// Desktop viewport is intentional: the SR wiring is shared across surfaces,
// and the mobile L2 sheet UI is harder to drive. Iter 1's probe covered the
// mobile Review-CTA routing; this one covers the SR semantics.

const { ensureServer, ensureChrome, connect } = require('./lib');
const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-iter2';

const ONE_DAY = 86400000;
const THREE_DAYS = 3 * ONE_DAY;
const TOLERANCE = 60000;

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  // Desktop-sized viewport so renderL2 (not renderL2Mobile) runs.
  const s = await connect({
    url: URL,
    viewport: { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
    outDir: OUT,
  });

  // ARRANGE: seed a due, mastered lesson with a 1-day interval.
  const seeded = await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    const sample = m.sections.flatMap(s => s.lessons).find(l => l.status === 'full');
    if (!sample) return null;
    const data = {
      __v: 4,
      welcomed: true,
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
  if (!seeded) throw new Error('no full lesson in manifest to seed');
  await s.reload();

  const dueVisible = await s.eval(`!document.getElementById('review-btn').classList.contains('hidden')`);
  s.assert(dueVisible, 'Review badge visible after seeding due review');

  // Navigate to the seeded lesson on L2 via state + sidebar click.
  await s.eval(`(() => {
    const link = document.querySelector('[data-lesson-id=' + JSON.stringify(${JSON.stringify(seeded)}) + ']');
    if (link) link.click();
  })()`);
  await s.sleep(400);
  // Switch to L2 tab
  await s.eval(`[...document.querySelectorAll('.tab-btn')].find(b => /Fill-in|L2/.test(b.textContent))?.click()`);
  await s.sleep(500);
  await s.snap('on-l2');

  // Fill blanks + click Check for each exercise card.
  const filled = await s.evalAwait(`(async () => {
    const id = ${JSON.stringify(seeded)};
    // Wait for the L2 cards to be in the DOM.
    let cards = [];
    for (let i = 0; i < 40; i++) {
      cards = [...document.querySelectorAll('[data-action="check"]')].map(b => b.closest('.mb-6'));
      if (cards.length) break;
      await new Promise(r => setTimeout(r, 80));
    }
    if (!cards.length) return { ok: false, why: 'no L2 cards found' };

    // The CONTENT global is module-scoped; we read canonical answers from
    // the templates via the rendered DOM is unreliable — instead refetch.
    const lessonPath = (() => {
      // Derive the data path from the manifest.
      return null;
    })();
    // Easier path: fetch the manifest + lesson JSON to get blank answers.
    const m = await fetch('./data/manifest.json').then(r => r.json());
    let sectionSlug, lessonJson;
    for (const sec of m.sections) {
      const hit = sec.lessons.find(l => l.id === id);
      if (hit) { sectionSlug = sec.slug; break; }
    }
    if (!sectionSlug) return { ok: false, why: 'lesson not in manifest' };
    lessonJson = await fetch('./data/' + sectionSlug + '/' + id + '.json').then(r => r.json());
    const exercises = lessonJson.L2.exercises;

    for (let exi = 0; exi < cards.length; exi++) {
      const card = cards[exi];
      const inputs = card.querySelectorAll('input.blank-input');
      const blanks = exercises[exi].blanks;
      inputs.forEach((inp, i) => {
        inp.value = blanks[i].answer;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      });
      card.querySelector('[data-action="check"]').click();
      // checkL2Overall is sync after the awaited runCode resolves; give the
      // microtask + setTimeout drain a moment.
      await new Promise(r => setTimeout(r, 300));
    }
    return { ok: true, exerciseCount: cards.length };
  })()`);
  console.log('L2 fill:', filled);
  s.assert(filled?.ok, `L2 exercises filled (${JSON.stringify(filled)})`);

  await s.sleep(400);
  await s.snap('after-l2-check');

  // ASSERT: interval held at 1d, dueAt now+1d.
  const after = await s.eval(`(() => {
    const r = window.__jsdrillState.reviews[${JSON.stringify(seeded)}];
    return r ? { interval: r.interval, dueAt: r.dueAt } : null;
  })()`);
  if (!after) {
    s.assert(false, 'reviews entry should still exist after L2 pass');
  } else {
    const expectedDue = Date.now() + ONE_DAY;
    s.assert(after.interval === ONE_DAY,
      `interval HELD at 1d (got ${after.interval}; ${after.interval === THREE_DAYS ? 'incorrectly advanced to 3d' : 'unexpected value'})`);
    s.assert(Math.abs(after.dueAt - expectedDue) < TOLERANCE,
      `dueAt pushed to ~now+1d (delta ${after.dueAt - expectedDue}ms)`);
  }

  // The lesson should no longer be due.
  const dueHidden = await s.eval(`document.getElementById('review-btn').classList.contains('hidden')`);
  s.assert(dueHidden, 'Review badge hidden after L2 pass (lesson no longer due)');

  // L2 status text should report passed.
  const l2Status = await s.eval(`document.getElementById('l2-status')?.textContent || ''`);
  s.assert(/L2 passed/i.test(l2Status), `L2 status reads passed (got: ${JSON.stringify(l2Status)})`);

  // iter 4: SR-impact line should be surfaced in the same status text.
  s.assert(/Next review in 1d/i.test(l2Status),
    `L2 status surfaces SR impact ("Next review in 1d"; got: ${JSON.stringify(l2Status)})`);

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
