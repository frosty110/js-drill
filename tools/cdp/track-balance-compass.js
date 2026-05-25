#!/usr/bin/env node
// Verifies iter-66 🧭 Track Balance Compass at iPhone viewport: 3-bar widget
// renders in Stats modal; each row shows track label + % bar + count;
// least-covered nudge names the track with lowest % mastery.
// Sourced from iter-64 roadmap entry #3 (shipped iter 66).

const { ensureServer, ensureChrome, connect } = require('./lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-track-compass';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  // Seed: master a few syntax lessons but none in patterns or applied,
  // so the least-covered nudge should point to applied (lowest % with
  // any total) or patterns.
  await s.evalAwait(`(() => {
    const syntaxLessons = CURRICULUM.filter(l => l.track === 'syntax' && l.status === 'full').slice(0, 5);
    const progress = {};
    for (const l of syntaxLessons) progress[l.id] = { L1: 'passed', L2: 'passed', L3: 'passed' };
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
      __v: 6, welcomed: true,
      progress, bestTimes: {}, mockHistory: {}, revealed: {},
      starterPath: false, starterPathTrack: 'all', hideMastered: false,
      reviews: {}, weakness: {}, history: {}, misses: {},
      recognize: { attempts: 0, correct: 0 },
      rapidFire: { attempts: 0, correct: 0, bestStreak: 0, lastRunAt: 0 },
      warmup: { sessions: 0, completions: 0, lastRunAt: 0 },
      sidebarTrack: 'syntax', lastLessonId: null, lastTab: null
    }));
  })()`);
  await s.reload();
  await s.sleep(500);

  // Open Stats modal.
  await s.evalAwait(`document.getElementById('stats-btn').click()`);
  await s.sleep(400);
  await s.snap('stats-with-compass');

  // Assert 1: Compass widget renders.
  const compassText = await s.evalAwait(`document.getElementById('stats-body')?.textContent || ''`);
  console.log(compassText.includes('Track Balance') ? 'PASS: 🧭 Track Balance widget rendered in Stats' : 'FAIL: compass missing');

  // Assert 2: 3 rows render (Syntax / Pattern / Applied).
  const labels = ['Syntax', 'Pattern', 'Applied'].every(l => compassText.includes(l));
  console.log(labels ? 'PASS: all 3 track labels rendered' : 'FAIL: missing track label');

  // Assert 3: Least-covered nudge names a track with 0% (applied or patterns).
  const nudgeMatch = /Least covered.*?(Pattern|Applied)/i.test(compassText);
  console.log(nudgeMatch ? 'PASS: Least-covered nudge names a 0% track' : 'FAIL: nudge missing or wrong track');

  // Assert 4: Syntax row shows non-zero % (we seeded 5 mastered).
  const syntaxPct = await s.evalAwait(`(() => {
    const html = document.getElementById('stats-body')?.innerHTML || '';
    const m = html.match(/Syntax[\\\\s\\\\S]{0,400}?(\\\\d+)%/);
    return m ? +m[1] : -1;
  })()`);
  console.log(syntaxPct > 0 ? `PASS: Syntax bar shows ${syntaxPct}% (>0)` : `FAIL: Syntax pct = ${syntaxPct}`);

  console.log('\nDone — screenshots in', OUT);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
