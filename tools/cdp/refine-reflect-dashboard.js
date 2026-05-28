// Captures the Reflect dashboard (Stats modal) on the JS Drill main app
// for the /drill-refine audit of the `reflect-dashboard` surface.
//
// Seeds a representative engaged-user state with:
//   - 30+ mastered lessons across all 3 tracks (so Track Balance + tallies
//     have data),
//   - several weak spots,
//   - mock-interview personal-bests for a handful of lessons,
//   - lifetime attempts on Recognize / Gotcha / Claim / Crystal / Bug-Hunt
//     so the conditional tiles all render (worst-case modal height).
//
// Usage:
//   node tools/cdp/refine-reflect-dashboard.js [url] [outDir]
const { ensureServer, ensureChrome, connect } = require('./lib');

const URL_BASE = process.argv[2] || 'http://localhost:8765/';
const OUT_DIR  = process.argv[3] || '/tmp/jsdrill-refine-02';

async function seedAndSnap({ mobile, label }) {
  const cb = Date.now();
  const s = await connect({
    url: URL_BASE + '?t=' + cb,
    mobile,
    viewport: mobile ? undefined : { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: OUT_DIR,
    waitForLoadMs: 2400,
  });

  // Pull the manifest from the running app — it has already loaded by now.
  const manifest = await s.evalAwait(`(async () => {
    const m = await fetch('./data/manifest.json').then(r => r.json());
    return m;
  })()`);

  const allLessons = manifest.sections.flatMap(sec => sec.lessons.filter(l => l.status === 'full').map(l => ({ id: l.id, track: l.track })));
  const byTrack = { syntax: [], patterns: [], applied: [] };
  for (const l of allLessons) if (byTrack[l.track]) byTrack[l.track].push(l.id);

  // Seed: ~40% mastered per track for an engaged user.
  const progress = {};
  const reviews = {};
  const mockHistory = {};
  const bestTimes = {};
  const weakness = {};
  const masterCount = (arr, pct) => Math.max(2, Math.floor(arr.length * pct));
  const now = Date.now();
  for (const [track, ids] of Object.entries(byTrack)) {
    const n = masterCount(ids, track === 'syntax' ? 0.55 : track === 'patterns' ? 0.30 : 0.20);
    for (let i = 0; i < n; i++) {
      const id = ids[i];
      progress[id] = { L1: 'passed', L2: 'passed', L3: 'passed' };
      reviews[id] = {
        lastPassedAt: now - (3 + i) * 86400000,
        interval: 7 * 86400000,
        dueAt: now + (4 - (i % 6)) * 86400000,
      };
    }
    // In-progress lessons (L1 only) for "in progress" count
    for (let i = n; i < n + 4; i++) {
      const id = ids[i];
      if (!id) break;
      progress[id] = { L1: 'passed' };
    }
    // weak spots: a few L1-missed lessons
    for (let i = n + 4; i < n + 7; i++) {
      const id = ids[i];
      if (!id) break;
      weakness[id] = true;
    }
  }

  // mock interview history for 6 lessons (Patterns + Applied)
  const mockLessons = byTrack.patterns.slice(0, 4).concat(byTrack.applied.slice(0, 2));
  for (const id of mockLessons) {
    const times = [180000 + Math.floor(Math.random() * 60000), 150000 + Math.floor(Math.random() * 60000), 120000 + Math.floor(Math.random() * 40000)];
    mockHistory[id] = times;
    bestTimes[id] = Math.min(...times);
  }

  // history events — drives streak + section retention + heatstrip.
  // Shape: { [lessonId]: [ { event: 'L3-pass'|'L2-pass'|'L1-pass'|'L1-miss', at: ms }, ... ] }
  const history = {};
  for (let i = 0; i < 25; i++) {
    const id = allLessons[i % allLessons.length].id;
    const event = ['L1-pass','L2-pass','L3-pass'][i % 3];
    if (!history[id]) history[id] = [];
    history[id].push({ event, at: now - (i * 6 * 3600 * 1000) });
  }

  const seeded = {
    __v: 6,
    welcomed: true,
    starterPath: false,
    hideMastered: false,
    sidebarTrack: 'patterns',
    lastTab: 'L1',
    progress,
    reviews,
    mockHistory,
    bestTimes,
    weakness,
    history,
    revealed: {},
    // lifetime drill stats — all tiles fire (worst case)
    recognize: { attempts: 47, correct: 33 },
    gotcha: { attempts: 22, correct: 14 },
    claim: { attempts: 18, correct: 11 },
    crystal: { attempts: 9, correct: 5 },
    bugHunt: { attempts: 14, correct: 9 },
    streak: 5,
    misses: {
      [allLessons[0].id]: { tags: { 'off-by-one': 2, 'wrong-method': 1 }, lastAt: now - 86400000 },
      [allLessons[3].id]: { tags: { 'wrong-method': 3 }, lastAt: now - 2*86400000 },
      [allLessons[7].id]: { tags: { 'semantics': 2, 'misread': 1 }, lastAt: now - 3*86400000 },
    },
  };

  await s.eval(`localStorage.setItem('jsdrill.progress.v1', ${JSON.stringify(JSON.stringify(seeded))})`);
  await s.reload();
  await s.sleep(800);

  // Open Stats modal
  await s.click('#stats-btn');
  await s.sleep(400);

  // verify the modal opened
  const isOpen = await s.eval(`(() => {
    const m = document.getElementById('stats-modal');
    return m && getComputedStyle(m).display !== 'none';
  })()`);
  s.assert(isOpen, 'Stats modal should be visible after click');

  // Snap initial viewport — kept the "-before-top" label as well; this one
  // captures the post-fix state.
  await s.snap(`reflect-${label}-after-top`);

  // INVARIANTS — does the modal now fit the viewport?
  const fit = await s.eval(`(() => {
    const modal = document.getElementById('stats-modal');
    const card = modal && modal.firstElementChild;
    const body = document.getElementById('stats-body');
    if (!modal || !card || !body) return null;
    const cardRect = card.getBoundingClientRect();
    const cs = getComputedStyle(body);
    return {
      cardTop: Math.round(cardRect.top),
      cardBottom: Math.round(cardRect.bottom),
      vh: window.innerHeight,
      bodyOverflowY: cs.overflowY,
      bodyClientH: body.clientHeight,
      bodyScrollH: body.scrollHeight,
    };
  })()`);
  console.log(`[${label}] fit:`, JSON.stringify(fit));
  s.assert(fit && fit.cardTop >= 0, `Modal card top should be inside viewport (got ${fit?.cardTop})`);
  s.assert(fit && fit.cardBottom <= fit.vh, `Modal card bottom should be inside viewport (got ${fit?.cardBottom} <= ${fit?.vh})`);
  s.assert(fit && fit.bodyOverflowY === 'auto', `Stats body should have overflow-y:auto (got ${fit?.bodyOverflowY})`);
  s.assert(fit && fit.bodyClientH < fit.bodyScrollH, `Stats body should scroll internally (clientH<${fit?.bodyClientH} should be < scrollH=${fit?.bodyScrollH})`);

  // First tile in the body's visible window should be Track Balance
  const firstTile = await s.eval(`(() => {
    const body = document.getElementById('stats-body');
    if (!body) return null;
    body.scrollTop = 0;
    const c = body.children[0];
    return c ? (c.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80) : null;
  })()`);
  console.log(`[${label}] first tile in body:`, JSON.stringify(firstTile));
  s.assert(/Track Balance/i.test(firstTile || ''), `First tile inside body should be Track Balance (got "${firstTile}")`);

  // Probe what tiles rendered + heights
  const tileSurvey = await s.eval(`(() => {
    const body = document.getElementById('stats-body');
    if (!body) return null;
    const rect = body.getBoundingClientRect();
    const tiles = Array.from(body.children).map((c, idx) => {
      const r = c.getBoundingClientRect();
      return {
        idx,
        tagName: c.tagName,
        textPreview: (c.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
        height: Math.round(r.height),
        top: Math.round(r.top - rect.top),
      };
    });
    return {
      bodyHeight: Math.round(body.scrollHeight),
      bodyClientHeight: Math.round(body.clientHeight),
      viewportH: window.innerHeight,
      tileCount: tiles.length,
      tiles,
    };
  })()`);
  console.log(`[${label}] stats-body survey: viewportH=${tileSurvey.viewportH}, bodyScrollH=${tileSurvey.bodyHeight}, clientH=${tileSurvey.bodyClientHeight}, tiles=${tileSurvey.tileCount}`);
  console.log(`[${label}] tile heights/positions:`);
  for (const t of tileSurvey.tiles) {
    console.log(`  [${t.idx}] top=${t.top}px h=${t.height}px — ${t.textPreview}`);
  }

  // Try scrolling to bottom and snap
  await s.eval(`(() => {
    const body = document.getElementById('stats-body');
    if (body) body.scrollTop = body.scrollHeight;
  })()`);
  await s.sleep(300);
  await s.snap(`reflect-${label}-before-bottom`);

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
