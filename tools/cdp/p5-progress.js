// p5-progress.js — verify the P5 unified Progress surface (design-loop).
// Desktop @1280px + mobile @390px: the rail/bar "Progress" destination renders
// the ds .progress-page (Today snapshot → Activity charts → Fix first →
// Mastery → More insights), absorbed routes resolve there (stats-btn,
// streak-map-btn, at-risk-btn, #/m/dashboard deep-link), rows route to
// lessons, no emoji in the chrome (D07), zero console errors, no horizontal
// scroll, ≥44px primary targets.
//
//   node tools/cdp/p5-progress.js [outDir]

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('./lib');

const OUT = process.argv[2] || '/tmp/jsdrill-probe-p5-progress';

// Rich seed exercising every section: history across days (bars + heatmap +
// session line), due/weak/revealed (Fix first), mock times, drill lifetimes,
// tagged misses (More insights).
const seed = () => {
  const day = 86400000;
  const now = Date.now();
  const hist = {};
  hist['two-sum'] = [
    { at: now - 12 * day, event: 'L1-pass' }, { at: now - 12 * day + 60000, event: 'L2-pass' },
    { at: now - 9 * day, event: 'L3-pass' }, { at: now - 5 * day, event: 'L3-pass' },
    { at: now - 2 * day, event: 'L3-pass' }, { at: now - 3600000, event: 'L1-pass' },
    { at: now - 300000, event: 'L2-pass' }, { at: now - 120000, event: 'L3-pass' },
  ];
  hist['p-valid-anagram'] = [
    { at: now - 8 * day, event: 'L1-miss' }, { at: now - 8 * day + 90000, event: 'L1-pass' },
    { at: now - 6 * day, event: 'L2-pass' }, { at: now - 1 * day, event: 'L1-miss' },
    { at: now - 600000, event: 'L1-miss' },
  ];
  hist['p-contains-dup'] = [
    { at: now - 4 * day, event: 'L1-pass' }, { at: now - 4 * day + 120000, event: 'L2-pass' },
    { at: now - 4 * day + 240000, event: 'L3-pass' }, { at: now - 1 * day, event: 'L3-pass' },
    { at: now - 900000, event: 'hint-tier-1' }, { at: now - 800000, event: 'L3-pass' },
  ];
  return {
    __v: 5, welcomed: true, lastLessonId: 'two-sum', lastTab: 'reference', sidebarTrack: 'patterns',
    progress: {
      'two-sum': { L1: 'passed', L2: 'passed', L3: 'passed' },
      'p-contains-dup': { L1: 'passed', L2: 'passed', L3: 'passed' },
      'p-valid-anagram': { L1: 'passed', L2: 'passed' },
      'p-anagrams': { L1: 'passed' },
    },
    reviews: {
      'two-sum': { lastPassedAt: now - 9 * day, interval: 1 * day, dueAt: now - 6 * day },
      'p-contains-dup': { lastPassedAt: now - 1 * day, interval: 3 * day, dueAt: now + 2 * day },
    },
    weakness: { 'p-valid-anagram': 3 },
    revealed: { 'p-anagrams': { L2: true } },
    bestTimes: { 'two-sum': 212000, 'p-contains-dup': 341000 },
    mockHistory: { 'two-sum': [280000, 240000, 212000] },
    history: hist,
    recognize: { attempts: 24, correct: 19 },
    gotcha: { attempts: 10, correct: 7 },
    misses: { 'p-valid-anagram': [{ at: now - 600000, level: 'L1', tag: 'off-by-one' }, { at: now - 1 * day, level: 'L1', tag: 'semantics' }] },
  };
};

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

async function boot(c) {
  await c.eval(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify((${seed.toString()})()))`);
  await c.eval(`history.replaceState(null, '', location.pathname)`); // hash beats seeded state on boot
  await c.reload();
  await c.waitFor(`typeof openProgress === 'function' && document.querySelector('#ds-appnav')`, { timeoutMs: 8000 });
}

async function checkSurface(c, tag) {
  const s = await c.eval(`(() => {
    const page = document.querySelector('.progress-page');
    if (!page) return { page: false };
    const secs = ['[data-prog-today]', '[data-prog-activity]', '[data-prog-attention]', '[data-prog-mastery]', '[data-prog-more]']
      .map(sel => !!page.querySelector(sel));
    const rows = [...page.querySelectorAll('.prog-rowbtn')];
    const summary = page.querySelector('.prog-details > summary');
    return {
      page: true, secs,
      stats: page.querySelectorAll('.ds-stat').length,
      bars: page.querySelectorAll('.prog-bar').length,
      cells: page.querySelectorAll('.prog-heatcell').length,
      riskRows: rows.length,
      minRow: rows.length ? Math.min(...rows.map(r => r.getBoundingClientRect().height)) : null,
      summaryH: summary ? summary.getBoundingClientRect().height : 0,
      navCurrent: document.querySelector('#ds-appnav [data-nav="progress"]')?.getAttribute('aria-current') === 'page',
      noHScroll: document.documentElement.scrollWidth <= innerWidth,
      emoji: (page.textContent.match(${EMOJI_RE.toString()}) || [null])[0],
    };
  })()`);
  c.assert(s.page, `${tag}: .progress-page renders`);
  c.assert(s.secs && s.secs.every(Boolean), `${tag}: all 5 sections present (${JSON.stringify(s.secs)})`);
  c.assert(s.stats >= 4, `${tag}: today snapshot tiles (${s.stats})`);
  c.assert(s.bars === 14, `${tag}: 14-day rep bars (${s.bars})`);
  c.assert(s.cells === 60, `${tag}: 60 heatmap cells (${s.cells})`);
  c.assert(s.riskRows >= 3, `${tag}: Fix-first rows render (at-risk + resurrect + reveal = ${s.riskRows})`);
  c.assert(s.minRow !== null && s.minRow >= 44, `${tag}: attention rows ≥44px (min ${Math.round(s.minRow)})`);
  c.assert(s.summaryH >= 44, `${tag}: More-insights summary ≥44px (${Math.round(s.summaryH)})`);
  c.assert(s.navCurrent, `${tag}: nav Progress carries aria-current`);
  c.assert(s.noHScroll, `${tag}: no horizontal scroll`);
  c.assert(!s.emoji, `${tag}: no emoji in the page chrome (D07)${s.emoji ? ` — found ${s.emoji}` : ''}`);
  return s;
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // ── Desktop 1280 ──────────────────────────────────────────────────────────
  const d = await connect({ url: 'http://localhost:8765/', mobile: false,
    viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: path.join(OUT, 'desktop'), waitForLoadMs: 2600 });
  await boot(d);

  await d.click('#ds-appnav [data-nav="progress"]'); await d.sleep(600);
  await checkSurface(d, 'desktop');
  await d.snap('01-progress-top');

  // Heatmap tap → day detail (today has events in the seed).
  await d.eval(`(() => { const cells = document.querySelectorAll('.prog-heatcell'); cells[cells.length - 1].dispatchEvent(new MouseEvent('click', { bubbles: true })); })()`);
  await d.sleep(200);
  const heatDetail = await d.eval(`document.querySelector('[data-heat-detail]').textContent`);
  d.assert(/pass/.test(heatDetail), `desktop: heatmap tap shows day detail ("${heatDetail.slice(0, 60)}")`);

  // More insights opens; lifetime drill rows + Drill button route.
  await d.click('.prog-details > summary'); await d.sleep(300);
  const insights = await d.eval(`(() => {
    const det = document.querySelector('.prog-details');
    return { open: det.open,
             drills: det.querySelectorAll('[data-prog-drill]').length,
             tags: det.querySelectorAll('[data-prog-tag-route]').length,
             bests: det.querySelectorAll('.prog-bests > div').length };
  })()`);
  d.assert(insights.open, 'desktop: More insights opens');
  d.assert(insights.drills >= 2, `desktop: lifetime drill rows (${insights.drills})`);
  d.assert(insights.tags >= 1 && insights.bests >= 2, `desktop: miss tags (${insights.tags}) + mock bests (${insights.bests})`);
  await d.snap('02-progress-insights');

  // At-risk row routes to the lesson.
  await d.click('#ds-appnav [data-nav="progress"]'); await d.sleep(500);
  await d.click('[data-prog-attention] [data-prog-lesson]'); await d.sleep(700);
  const routed = await d.eval(`!document.querySelector('.progress-page') && !!state.currentLessonId`);
  d.assert(routed, 'desktop: Fix-first row routes into the lesson');

  // Absorbed legacy routes: stats-btn and at-risk-btn land on Progress.
  await d.eval(`document.getElementById('stats-btn').click()`); await d.sleep(500);
  d.assert(await d.eval(`!!document.querySelector('.progress-page')`), 'desktop: stats-btn (→ #/m/stats) lands on Progress');
  await d.eval(`document.getElementById('today-home-btn').click()`); await d.sleep(400);
  await d.eval(`document.getElementById('at-risk-btn').click()`); await d.sleep(500);
  const atRisk = await d.eval(`(() => {
    const page = document.querySelector('.progress-page');
    const sec = page && page.querySelector('[data-prog-attention]');
    const main = document.querySelector('.app-main');
    return { page: !!page, scrolled: sec && main ? main.scrollTop > 0 : false };
  })()`);
  d.assert(atRisk.page, 'desktop: at-risk-btn (→ #/m/at-risk) lands on Progress');
  d.assert(atRisk.scrolled, 'desktop: at-risk route scrolls to the Fix-first section');
  await d.snap('03-progress-atrisk-focus');

  console.log('\n===== desktop 1280 =====');
  const dr = d.report();
  await d.close();

  // ── Mobile 390 ────────────────────────────────────────────────────────────
  const m = await connect({ url: 'http://localhost:8765/', mobile: true,
    outDir: path.join(OUT, 'mobile'), waitForLoadMs: 2600 });
  await boot(m);
  await m.click('#ds-appnav [data-nav="progress"]'); await m.sleep(600);
  await checkSurface(m, 'mobile');
  await m.snap('01-progress-top');
  await m.eval(`document.querySelector('.app-main').scrollTop = 700`); await m.sleep(200);
  await m.snap('02-progress-mid');
  await m.click('.prog-details > summary'); await m.sleep(300);
  await m.eval(`document.querySelector('.prog-details').scrollIntoView({ block: 'start' })`); await m.sleep(200);
  await m.snap('03-progress-insights');

  console.log('\n===== mobile 390 =====');
  const mr = m.report();
  await m.close();

  // ── Deep link: a fresh tab at #/m/dashboard boots straight into Progress ──
  // (Set the hash AFTER connect — lib's SW-neutralize reload lets the first
  // boot normalize the URL to the lesson hash, which would eat the mode.)
  const dl = await connect({ url: 'http://localhost:8765/', mobile: true,
    outDir: path.join(OUT, 'deeplink'), waitForLoadMs: 3200 });
  await dl.eval(`history.replaceState(null, '', location.pathname + '#/m/dashboard')`);
  await dl.reload();
  await dl.waitFor(`!!document.querySelector('.progress-page')`, { timeoutMs: 8000 });
  dl.assert(true, 'deep-link: #/m/dashboard boots into the Progress page');
  await dl.snap('01-deeplink-dashboard');
  console.log('\n===== deep link =====');
  const dlr = dl.report();
  await dl.close();

  process.exit(dr.failed + dr.errors + mr.failed + mr.errors + dlr.failed + dlr.errors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
