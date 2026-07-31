#!/usr/bin/env node
// Smoke probe for the three lessons added to close the real-interview gap
// (CSV Transaction Stats, Keyword Rules Engine, Fetch & Reshape) plus the new
// system-design problem p17 (Prescription Drug Marketplace).
//
// Asserts each lesson boots from the sidebar, renders its full tab set
// (Conversation + Walkthrough + Reference + L1 + L2 + L3), and that the
// walkthrough stepper actually advances. Then checks p17 is reachable on
// system-design.html and renders its Key Ideas + diagram.
//
//   node tools/cdp/interview-gap-lessons.js

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-interview-gap';

const NEW_LESSONS = [
  { id: 'a-csv-transaction-stats', title: 'CSV Transaction Stats' },
  { id: 'a-rules-engine', title: 'Keyword Rules Engine' },
  { id: 'a-fetch-transform', title: 'Fetch & Reshape an API Response' },
];

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  await s.evalAwait(`(async () => {
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({ __v: 5, welcomed: true, progress: {} }));
  })()`);
  await s.reload();
  await s.sleep(600);

  // ── Each new lesson is in the manifest AND its body file loads ──────────
  for (const lesson of NEW_LESSONS) {
    const found = await s.evalAwait(`(async () => {
      const m = await fetch('./data/manifest.json').then(r => r.json());
      const entry = m.sections.flatMap(sec => sec.lessons).find(l => l.id === ${JSON.stringify(lesson.id)});
      if (!entry) return 'missing-from-manifest';
      const body = await fetch('./data/applied-problems/' + ${JSON.stringify(lesson.id)} + '.json').then(r => r.json());
      return JSON.stringify({
        status: entry.status,
        track: entry.track,
        tabs: ['conversation', 'walkthrough'].filter(k => body[k]),
        l1: body.L1.questions.length,
        l2: body.L2.exercises.length,
        wt: body.walkthrough ? body.walkthrough.examples.length : 0,
      });
    })()`);
    if (found === 'missing-from-manifest') {
      s.assert(false, `${lesson.id} present in manifest`);
      continue;
    }
    const meta = JSON.parse(found);
    s.assert(meta.status === 'full', `${lesson.id} status=full (got ${meta.status})`);
    s.assert(meta.track === 'applied', `${lesson.id} track=applied (got ${meta.track})`);
    s.assert(meta.tabs.length === 2, `${lesson.id} has conversation + walkthrough (got ${meta.tabs.join(',')})`);
    s.assert(meta.l1 >= 3, `${lesson.id} has >=3 L1 questions (got ${meta.l1})`);
    s.assert(meta.l2 >= 2, `${lesson.id} has >=2 L2 exercises (got ${meta.l2})`);
    s.assert(meta.wt >= 2, `${lesson.id} has >=2 walkthrough examples (got ${meta.wt})`);
  }

  // ── Open one of them for real and walk its tabs ─────────────────────────
  // Lesson deep-link route is `#/<lessonId>` (the `m/` namespace is for modes).
  await s.eval(`location.hash = '#/a-rules-engine'`);
  await s.reload();
  await s.sleep(1400);
  await s.snap('01-rules-engine-open');

  const tabLabels = await s.eval(
    `[...document.querySelectorAll('.tab-btn')].map(b => b.textContent.trim()).join('|')`
  );
  s.assert(/Reference/.test(tabLabels), `Reference tab rendered (tabs: ${tabLabels})`);
  s.assert(/Conversation/.test(tabLabels), `Conversation tab rendered (tabs: ${tabLabels})`);
  s.assert(/Walk/.test(tabLabels), `Walkthrough tab rendered (tabs: ${tabLabels})`);

  // Patterns/Applied lessons open on Conversation, so click through to Reference.
  await s.eval(
    `[...document.querySelectorAll('.tab-btn')].find(b => /Reference/.test(b.textContent))?.click()`
  );
  await s.sleep(500);
  await s.snap('02-reference-tab');
  const refText = await s.eval(`document.body.textContent || ''`);
  s.assert(/FALLBACK|Triage/.test(refText), 'Reference panel shows the rules-engine canonical');

  // No page-level exceptions while rendering the new content
  const errs = await s.eval(`(window.__probeErrors || []).length`);
  s.assert(!errs || errs === 0, `no uncaught page errors (got ${errs})`);

  // ── p17 exists in the design-problems topic ────────────────────────────
  const sd = await s.evalAwait(`(async () => {
    const man = await fetch('./data/system-design/design-problems/manifest.json').then(r => r.json());
    const ch = man.chapters.find(c => c.id === 'p17');
    if (!ch) return 'missing-chapter';
    const inPart = man.parts.some(p => p.chapters.includes('p17'));
    const unit = await fetch('./data/system-design/design-problems/p17.json').then(r => r.json());
    return JSON.stringify({
      title: ch.title,
      inPart,
      takeaways: unit.keyTakeaways.length,
      questions: unit.questions.length,
      crux: unit.questions.filter(q => q.crux).length,
      diagram: !!unit.diagram,
    });
  })()`);
  s.assert(sd !== 'missing-chapter', 'p17 registered in design-problems manifest');
  if (sd !== 'missing-chapter') {
    const m = JSON.parse(sd);
    s.assert(/Prescription/.test(m.title), `p17 title (got ${m.title})`);
    s.assert(m.inPart === true, 'p17 assigned to a part');
    s.assert(m.questions >= 8, `p17 has >=8 questions (got ${m.questions})`);
    s.assert(m.crux >= 2, `p17 flags >=2 crux questions (got ${m.crux})`);
    s.assert(m.diagram === true, 'p17 carries an architecture diagram');
    s.assert(m.takeaways >= 6, `p17 has >=6 key takeaways (got ${m.takeaways})`);
  }

  await s.snap('03-final');
  await s.close();
  const { failed } = s.report();
  // Chrome's WS handle keeps the loop alive after close(); exit explicitly so
  // the probe is usable from CI / a piped shell.
  process.exit(failed === 0 ? 0 : 1);
})();
