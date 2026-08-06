// Captures the diagnostic results page (renderDone) state at mobile + desktop
// for the /drill-refine audit of the `diagnostic-results` surface.
//
// Seeds a completed diagnostic state (mixed correct/wrong answers across the
// four sections) directly into localStorage, then loads diagnostic.html which
// lands on the DONE step.
//
// Usage:
//   node tools/cdp/refine-diagnostic-results.js [url] [outDir]
const { ensureServer, ensureChrome, connect } = require('../lib');

const URL_BASE = process.argv[2] || 'http://localhost:8765/';
const OUT_DIR  = process.argv[3] || '/tmp/jsdrill-refine-01';

async function seedAndSnap({ mobile, label }) {
  const cb = Date.now(); // cache-buster — Chrome keeps an in-memory copy across probes
  const s = await connect({
    url: URL_BASE + 'diagnostic.html?t=' + cb,
    mobile,
    viewport: mobile ? undefined : { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: OUT_DIR,
    waitForLoadMs: 1800,
  });

  // Read QUESTIONS schema from the page (it's a top-level const in the script).
  const meta = await s.eval(`(() => {
    return {
      total: QUESTIONS.length,
      qstart: Q_START,
      done: DONE_INDEX,
      questions: QUESTIONS.map(q => ({
        id: q.id, section: q.section, type: q.type, answer: q.answer ?? null
      }))
    };
  })()`);

  // Build a seeded answers map: ~70% correct, ~20% wrong, ~10% skipped.
  // Deterministic by index so two runs look identical (mobile vs desktop frame).
  const answers = {};
  meta.questions.forEach((q, i) => {
    const roll = (i * 37 + 7) % 10; // 0..9
    if (roll < 1) {
      // skipped
      answers[q.id] = { skipped: true, lastAnsweredAt: new Date().toISOString() };
      return;
    }
    if (q.type === 'mc') {
      const correct = roll >= 3; // 7/10
      const val = correct ? q.answer : ((q.answer + 1) % 4);
      answers[q.id] = {
        value: val,
        skipped: false,
        firstAnsweredAt: new Date().toISOString(),
        lastAnsweredAt: new Date().toISOString(),
      };
    } else {
      // short answer: stuff a placeholder so it counts as answered
      answers[q.id] = {
        value: 'placeholder seeded answer for probe',
        skipped: false,
        firstAnsweredAt: new Date().toISOString(),
        lastAnsweredAt: new Date().toISOString(),
      };
    }
  });

  const timeOnStep = {};
  // 30s spent on each question on average → ~22 min total feels real
  for (let i = meta.qstart; i < meta.qstart + meta.total; i++) {
    timeOnStep[i] = 25 + ((i * 13) % 35);
  }
  timeOnStep[0] = 12;
  timeOnStep[1] = 40;
  timeOnStep[meta.qstart + meta.total] = 80;

  const seeded = {
    startedAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    currentStep: meta.done,
    pre: { yearsExp: '5', recentInterviews: 'no', targetRole: 'IC4 backend' },
    post: { focusAreas: 'Sliding window + DP', concerns: 'Time pressure on recursion problems' },
    answers,
    timeOnStep,
  };

  // Directly mutate the running page's state and re-render (sidesteps reload-storage races).
  await s.eval(`(() => {
    state.currentStep = ${meta.done};
    Object.assign(state, ${JSON.stringify({ pre: seeded.pre, post: seeded.post, answers: seeded.answers, timeOnStep: seeded.timeOnStep, startedAt: seeded.startedAt })});
    render();
  })()`);
  await s.sleep(300);

  const stepAfter = await s.eval(`state?.currentStep`);
  console.log(`[${label}] state.currentStep: ${stepAfter}`);
  // Debug: did renderDone produce the drill button?
  const dbg = await s.eval(`(() => ({
    heading: document.querySelector('#content h2')?.textContent,
    hasDrillBtn: !!document.getElementById('drill-weakest-btn'),
    weakest: (typeof pickWeakestSection === 'function') ? pickWeakestSection(computeStats().bySection) : 'fn-missing',
  }))()`);
  console.log(`[${label}] debug:`, JSON.stringify(dbg));

  // Verify we're on the done step
  const headingTxt = await s.eval(`document.querySelector('#content h2')?.textContent || ''`);
  s.assert(/Done/.test(headingTxt), `Expected "Done" heading on results page, got "${headingTxt}"`);

  // Snap before-shot label (kept stable across runs so we can keep the
  // original capture for compare).
  await s.snap(`diagnostic-results-${label}-after`);

  // ASSERTIONS — the autopilot bridge invariants we shipped
  // 1. New primary CTA exists with id #drill-weakest-btn
  const drillBtn = await s.eval(`(() => {
    const el = document.getElementById('drill-weakest-btn');
    if (!el) return null;
    return { text: el.textContent.trim(), visible: el.getBoundingClientRect().width > 0 };
  })()`);
  s.assert(!!drillBtn, `Drill-weakest button should exist`);
  s.assert(drillBtn && drillBtn.visible, `Drill-weakest button should be visible`);

  // 2. The button text names the weakest section. Per the seed (~70% correct,
  //    deterministic by index), one of the diagnostic sections lands lowest;
  //    just assert the text follows the "Drill weakest: <section> (<pct>%)"
  //    shape and includes a percent < 100.
  s.assert(/Drill weakest:/i.test(drillBtn?.text || ''), `Drill CTA should name "Drill weakest" (got "${drillBtn?.text}")`);
  s.assert(/\d+%/.test(drillBtn?.text || ''), `Drill CTA should include a percent (got "${drillBtn?.text}")`);

  // 3. Click stamps sidebarTrack=patterns + lastTab=L1 + diagnosticHandoff
  //    into jsdrill.progress.v1. location.href is non-configurable, so we
  //    intercept by attaching a capturing listener that preventDefault's the
  //    click's default action AFTER the onclick has run — by then the
  //    storage write has already happened (it's synchronous before
  //    location.href = ...).
  await s.eval(`(() => {
    // Override onbeforeunload won't fire for location.href in headless. Just
    // monkey-patch the assignment: shadow the document with a stub url
    // assignment trap on the link instead. Simpler: call the handler then
    // halt navigation via window.stop().
    const btn = document.getElementById('drill-weakest-btn');
    if (btn && btn.onclick) {
      const orig = btn.onclick;
      btn.onclick = (e) => { orig(e); window.stop(); };
    }
  })()`);
  await s.click('#drill-weakest-btn');
  await s.sleep(200);
  const handoff = await s.eval(`(() => {
    try {
      const p = JSON.parse(localStorage.getItem('jsdrill.progress.v1') || '{}');
      return { sidebarTrack: p.sidebarTrack, lastTab: p.lastTab, diagnosticHandoff: p.diagnosticHandoff };
    } catch { return null; }
  })()`);
  console.log(`[${label}] Handoff payload after click:`, JSON.stringify(handoff));
  s.assert(handoff?.sidebarTrack === 'patterns', `sidebarTrack should be patterns (got ${handoff?.sidebarTrack})`);
  s.assert(handoff?.lastTab === 'L1', `lastTab should be L1 (got ${handoff?.lastTab})`);
  s.assert(!!handoff?.diagnosticHandoff?.weakestSection, `diagnosticHandoff.weakestSection should be set`);
  s.assert(/\d+/.test(String(handoff?.diagnosticHandoff?.weakestPct)), `diagnosticHandoff.weakestPct should be a number`);

  // 4. JSON-export affordances STILL EXIST after the change (contrarian gate
  //    (a) — must not remove existing affordances).
  const existingCtas = await s.eval(`(() => ({
    export: !!document.getElementById('export-btn'),
    copy: !!document.getElementById('copy-btn'),
    restart: !!document.getElementById('restart-btn'),
  }))()`);
  s.assert(existingCtas.export, 'Export JSON button preserved');
  s.assert(existingCtas.copy, 'Copy JSON button preserved');
  s.assert(existingCtas.restart, 'Restart button preserved');

  // 5. iter-20 invariant: the breakdown table marks the weakest row with
  //    class="weakest-row", and that row's section name matches the CTA's
  //    named weakest section. Visually corroborates the autopilot pick.
  // NOTE: this assertion runs after the drill-weakest-btn click above, which
  // calls window.stop() but the DOM is preserved. Re-read both.
  const weakestRow = await s.eval(`(() => {
    const tr = document.querySelector('.summary-table tr.weakest-row');
    if (!tr) return null;
    const section = tr.querySelector('td')?.textContent.trim();
    const styles = getComputedStyle(tr.querySelector('td'));
    return { section, borderLeft: styles.borderLeftWidth, hasBg: styles.backgroundColor !== 'rgba(0, 0, 0, 0)' };
  })()`);
  s.assert(!!weakestRow, 'Weakest row should be marked with class="weakest-row"');
  s.assert(weakestRow && weakestRow.section === handoff?.diagnosticHandoff?.weakestSection,
    `weakest-row section "${weakestRow?.section}" should match CTA's pick "${handoff?.diagnosticHandoff?.weakestSection}"`);
  s.assert(weakestRow && parseInt(weakestRow.borderLeft || '0', 10) >= 2,
    `weakest-row should have left-border accent (got ${weakestRow?.borderLeft})`);

  // iter-41 (refine): post-CTA explainer collapsed to single sentence so the
  // breakdown table sits closer to the fold on mobile. The JSON-handoff
  // workflow is independently explained by the bottom prose at lines
  // 802-805 + the labeled JSON buttons themselves.
  const postCtaHint = await s.eval(`(() => {
    const btn = document.getElementById('drill-weakest-btn');
    if (!btn) return null;
    // The explainer hint is the .hint paragraph immediately after the button.
    let sib = btn.nextElementSibling;
    while (sib && !sib.classList?.contains('hint')) sib = sib.nextElementSibling;
    return sib ? sib.textContent.replace(/\\s+/g, ' ').trim() : null;
  })()`);
  s.assert(!!postCtaHint, 'Post-CTA explainer hint should exist');
  s.assert(postCtaHint && !/JSON buttons below/i.test(postCtaHint),
    `Post-CTA explainer should not redirect to JSON buttons (got "${postCtaHint}")`);
  s.assert(postCtaHint && !/Want to send results/i.test(postCtaHint),
    `Post-CTA explainer should not contain "Want to send results" copy`);
  s.assert(postCtaHint && /Patterns track ready to drill/i.test(postCtaHint),
    `Post-CTA explainer should still describe the CTA's behavior (got "${postCtaHint}")`);
  // Bottom prose still carries the full JSON-handoff explanation.
  const bottomHint = await s.eval(`(() => {
    const hints = Array.from(document.querySelectorAll('p.hint'));
    const bottom = hints[hints.length - 1];
    return bottom ? bottom.textContent.replace(/\\s+/g, ' ').trim() : null;
  })()`);
  s.assert(bottomHint && /Send the JSON to me/i.test(bottomHint),
    `Bottom prose should still explain the JSON workflow (got "${bottomHint?.slice(0, 60)}…")`);

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  return { failed, errors, networkErrors };
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const r1 = await seedAndSnap({ mobile: true,  label: 'mobile' });
  const r2 = await seedAndSnap({ mobile: false, label: 'desktop' });
  const total = r1.failed + r1.errors + r2.failed + r2.errors;
  process.exit(total > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
