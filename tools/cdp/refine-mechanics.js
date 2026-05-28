// Captures the Mechanics modal (🧩 button) at engaged-user state for the
// /drill-refine audit of the `mechanics` surface. Snaps both List view
// (default) and Matrix view (List ↔ Matrix toggle).
//
// Usage:
//   node tools/cdp/refine-mechanics.js [url] [outDir]
const { ensureServer, ensureChrome, connect } = require('./lib');

const URL_BASE = process.argv[2] || 'http://localhost:8765/';
const OUT_DIR  = process.argv[3] || '/tmp/jsdrill-refine-03';

async function seedAndSnap({ mobile, label }) {
  const cb = Date.now();
  const s = await connect({
    url: URL_BASE + '?t=' + cb,
    mobile,
    viewport: mobile ? undefined : { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: OUT_DIR,
    waitForLoadMs: 2400,
  });

  const manifest = await s.evalAwait(`(async () => fetch('./data/manifest.json').then(r => r.json()))()`);
  const allLessons = manifest.sections.flatMap(sec =>
    sec.lessons.filter(l => l.status === 'full').map(l => ({ id: l.id, track: l.track }))
  );
  const byTrack = { syntax: [], patterns: [], applied: [] };
  for (const l of allLessons) if (byTrack[l.track]) byTrack[l.track].push(l.id);

  // Mid-progress seed: ~50% syntax mastered, ~30% patterns, ~20% applied —
  // a profile that produces visible transfer gaps in the matrix view.
  const progress = {};
  const now = Date.now();
  for (const [track, ids] of Object.entries(byTrack)) {
    const pct = track === 'syntax' ? 0.5 : track === 'patterns' ? 0.3 : 0.2;
    const n = Math.max(2, Math.floor(ids.length * pct));
    for (let i = 0; i < n; i++) {
      progress[ids[i]] = { L1: 'passed', L2: 'passed', L3: 'passed' };
    }
  }
  const seeded = {
    __v: 6,
    welcomed: true,
    progress,
    reviews: {},
    history: {},
    weakness: {},
    revealed: {},
    sidebarTrack: 'patterns',
    lastTab: 'L1',
  };
  await s.eval(`localStorage.setItem('jsdrill.progress.v1', ${JSON.stringify(JSON.stringify(seeded))})`);
  await s.reload();
  await s.sleep(900);

  // Click the 🧩 Mechanics button. The topbar has menus; the button may
  // be in a dropdown. Try direct click; if hidden behind a dropdown,
  // fall back to JS click.
  await s.eval(`(() => {
    const b = document.getElementById('mechanics-btn');
    if (b) b.click();
  })()`);
  await s.sleep(1000); // mechanic index load is async

  // Confirm modal opened
  const isOpen = await s.eval(`(() => {
    const m = document.getElementById('mechanics-modal');
    return m && getComputedStyle(m).display !== 'none';
  })()`);
  s.assert(isOpen, 'Mechanics modal should be visible after click');

  // ── INVARIANT — with engaged-user seed (5 transfer gaps), the default
  //    view should now be Matrix. The title should reflect that.
  const initialHeader = await s.eval(`document.getElementById('mechanics-title')?.textContent || ''`);
  console.log(`[${label}] Initial header after open:`, JSON.stringify(initialHeader));
  s.assert(/Track × Tag|Track x Tag/i.test(initialHeader), `With transfer gaps in seed, default view should be Matrix (header="${initialHeader}")`);
  const initialToggleState = await s.eval(`(() => {
    const lb = document.getElementById('mechanics-view-list');
    const mb = document.getElementById('mechanics-view-matrix');
    const isActive = (btn) => /rgba\\(217,\\s*70,\\s*239,\\s*0.18\\)/.test(btn.getAttribute('style') || '');
    return { listActive: isActive(lb), matrixActive: isActive(mb) };
  })()`);
  console.log(`[${label}] toggle state at open:`, JSON.stringify(initialToggleState));
  s.assert(initialToggleState.matrixActive === true, 'Matrix toggle should be active at open');
  s.assert(initialToggleState.listActive === false, 'List toggle should be inactive at open');
  const gapBanner = await s.eval(`(() => {
    const body = document.getElementById('mechanics-body');
    return body && /transfer gap/i.test(body.textContent || '');
  })()`);
  s.assert(gapBanner, 'Transfer-gap banner should be visible at open');

  // Snap initial (now Matrix) view
  await s.snap(`mechanics-${label}-after-default`);

  // ── INVARIANT — clicking List toggle reverts to List view (no affordance removed)
  await s.click('#mechanics-view-list');
  await s.sleep(300);
  const listHeader = await s.eval(`document.getElementById('mechanics-title')?.textContent || ''`);
  console.log(`[${label}] After List toggle, header:`, JSON.stringify(listHeader));
  s.assert(listHeader === '🧩 Mechanics', `List toggle should switch to list view header (got "${listHeader}")`);

  // Snap List view post-toggle
  await s.snap(`mechanics-${label}-after-list-toggle`);

  // Probe List-view structure
  const listSurvey = await s.eval(`(() => {
    const body = document.getElementById('mechanics-body');
    const modal = document.getElementById('mechanics-modal');
    const card = modal && modal.firstElementChild;
    if (!body || !card) return null;
    const cardRect = card.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const cats = Array.from(body.querySelectorAll('[data-mech-cat]')).map(c => c.textContent.trim());
    const items = Array.from(body.querySelectorAll('[data-mech-id]')).length;
    return {
      cardTop: Math.round(cardRect.top),
      cardBottom: Math.round(cardRect.bottom),
      vh: window.innerHeight,
      bodyClientH: Math.round(bodyRect.height),
      bodyScrollH: body.scrollHeight,
      catCount: cats.length,
      catLabels: cats,
      itemCount: items,
    };
  })()`);
  console.log(`[${label}] List view survey:`, JSON.stringify(listSurvey, null, 2));

  // Switch back to Matrix view via toggle (already-default behavior preserved)
  await s.click('#mechanics-view-matrix');
  await s.sleep(400);

  const matrixSurvey = await s.eval(`(() => {
    const body = document.getElementById('mechanics-body');
    if (!body) return null;
    const rows = body.querySelectorAll('[style*="grid-template-columns"]').length; // header + N data rows
    const cells = Array.from(body.querySelectorAll('[data-mech-cell]'));
    const transferGap = body.textContent.match(/(\\d+) transfer gap/);
    return {
      rowCount: rows,
      cellCount: cells.length,
      bodyScrollH: body.scrollHeight,
      bodyClientH: body.clientHeight,
      transferGapText: transferGap ? transferGap[0] : null,
    };
  })()`);
  console.log(`[${label}] Matrix view survey:`, JSON.stringify(matrixSurvey, null, 2));

  // ── INVARIANT — close + reopen with no-progress seed: default reverts to List
  await s.click('#mechanics-close');
  await s.sleep(200);
  const noProgressSeed = { __v: 6, welcomed: true, progress: {}, reviews: {}, history: {}, weakness: {}, revealed: {}, sidebarTrack: 'patterns', lastTab: 'L1' };
  await s.eval(`localStorage.setItem('jsdrill.progress.v1', ${JSON.stringify(JSON.stringify(noProgressSeed))})`);
  await s.reload();
  await s.sleep(900);
  await s.eval(`(() => { const b = document.getElementById('mechanics-btn'); if (b) b.click(); })()`);
  await s.sleep(1000);
  const noProgressHeader = await s.eval(`document.getElementById('mechanics-title')?.textContent || ''`);
  console.log(`[${label}] No-progress default header:`, JSON.stringify(noProgressHeader));
  s.assert(noProgressHeader === '🧩 Mechanics', `No-progress user should default to List view (got "${noProgressHeader}")`);

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
