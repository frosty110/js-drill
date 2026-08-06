// Visual + functional check of the gamified Activity view on the Dashboard:
// 🔥 streak, weekly solved/rate/first-try chips, 14-day solved-per-day bars
// (green solved / amber miss), today-vs-yesterday delta. Seeds a realistic
// 14-day history so the surface is populated.
const { ensureServer, ensureChrome, connect } = require('../lib');

const ROOT = 'http://localhost:8765/';

const SEED = `(async () => {
  if (navigator.serviceWorker) { const r = await navigator.serviceWorker.getRegistrations(); await Promise.all(r.map(x=>x.unregister())); }
  if (self.caches) { const k = await caches.keys(); await Promise.all(k.map(x=>caches.delete(x))); }
  const m = await fetch('./data/manifest.json').then(r=>r.json());
  const ids = m.sections.flatMap(s=>s.lessons).filter(l=>l.status==='full').slice(0,12).map(l=>l.id);
  const dayMs = 86400000, now = Date.now();
  const startToday = new Date(now); startToday.setHours(12,0,0,0);
  const hist = {};
  const add = (id, at, event) => { (hist[id] = hist[id] || []).push({ at, event }); };
  // index 0 = 13 days ago … index 13 = today. One gap (index 1) before a long
  // current streak; varied counts for an interesting bar chart.
  const perDay = [2,0,3,1,4,2,5,3,4,6,2,5,7,4];
  const miss   = [1,0,1,0,2,0,1,1,0,2,0,1,1,1];
  for (let d=0; d<14; d++) {
    const at = startToday.getTime() - (13-d)*dayMs;
    for (let k=0;k<perDay[d];k++) add(ids[(d+k)%ids.length], at + k*60000, 'L3-pass');
    for (let k=0;k<miss[d];k++)   add(ids[(d+k+3)%ids.length], at + k*60000, 'L1-miss');
  }
  localStorage.setItem('jsdrill.progress.v1', JSON.stringify({ __v:5, welcomed:true, history: hist, progress:{}, reviews:{} }));
})()`;

async function run(mobile, outDir, label) {
  const s = await connect({ url: ROOT, mobile, viewport: mobile ? undefined : { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false }, outDir });
  await s.evalAwait(SEED);
  await s.reload();
  await s.waitFor(`typeof openDashboard === 'function'`, { timeoutMs: 8000 });
  await s.evalAwait(`openDashboard()`);
  await s.sleep(300);
  const probe = await s.eval(`(() => {
    const body = document.getElementById('dashboard-body');
    const txt = body.textContent;
    const bars = body.querySelectorAll('[data-dash-activity] > div')[1]; // the bars row
    return {
      streak: /\\d+-day streak/.test(txt),
      chips: /Solved · 7d/.test(txt) && /Per day/.test(txt) && /First-try/.test(txt),
      delta: /than yesterday|On pace|reps logged/.test(txt),
      barCols: body.querySelector('[data-dash-activity]') ? [...body.querySelectorAll('[data-dash-activity] div')].filter(d => /justify-content:\\s*flex-end/.test(d.getAttribute('style')||'')).length : 0,
      heatCells: body.querySelectorAll('[data-dash-activity] [data-streak-idx]').length,
    };
  })()`);
  s.assert(probe.streak, `${label}: 🔥 streak line should render`);
  s.assert(probe.chips, `${label}: weekly Solved/Per-day/First-try chips should render`);
  s.assert(probe.delta, `${label}: today-vs-yesterday delta line should render`);
  s.assert(probe.barCols === 14, `${label}: 14-day bar chart should have 14 columns (got ${probe.barCols})`);
  s.assert(probe.heatCells === 60, `${label}: 60-day heatmap should still render (got ${probe.heatCells})`);
  await s.snap(`activity-${label}`);
  const r = s.report();
  await s.close();
  return r.failed + r.errors + r.networkErrors;
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  let fail = 0;
  fail += await run(false, '/tmp/jsdrill-activity-desktop', 'desktop');
  fail += await run(true, '/tmp/jsdrill-activity-mobile', 'mobile');
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
