// p6-settings.js — verify P6 (design-loop): the ds Settings sheet.
//
// Resolves the nav-audit P2-2 acceptance criteria: (a) rail/⚙ opens a ds surface
// as a focused overlay (not the 1,199px top-right dropdown); (b) stroke icons,
// zero emoji (D07); (c) a visible ≥44px close affordance; (d) desktop topbar
// 🔍/❓/⚙ strip retired (rail carries them); the toggle rows reflect + flip the
// real state (synth-clicking the hidden buttons), and #/m/ toggle routes open
// the sheet instead of silently flipping.
//
//   node tools/cdp/p6-settings.js [outDir]

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('../lib');

const OUT = process.argv[2] || '/tmp/jsdrill-probe-p6-settings';

// Emoji in chrome is banned (D07). Chevron › (U+203A) and & are allowed.
const EMOJI_RE = "/[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{FE0F}\\u{2190}-\\u{21FF}]/u";

function seedState() {
  return JSON.stringify({
    __v: 5, welcomed: true, lastLessonId: 'two-sum', lastTab: 'reference',
    adhdMode: false, fontScale: 'lg', paceBarOn: false,
    progress: {}, reviews: {},
  });
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // ── Desktop 1280 ──────────────────────────────────────────────────────────
  const d = await connect({ url: 'http://localhost:8765/', mobile: false,
    viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: path.join(OUT, 'desktop'), waitForLoadMs: 2600 });
  await d.eval(`localStorage.setItem('jsdrill.progress.v1', ${JSON.stringify(seedState())})`);
  await d.eval(`history.replaceState(null, '', location.pathname)`);
  await d.reload();
  await d.waitFor(`document.querySelector('#ds-appnav')`, { timeoutMs: 6000 });

  // 1 · Desktop topbar icon strip retired (rail carries Search + Settings).
  const stripHidden = await d.eval(`(() => {
    const hid = id => { const e = document.getElementById(id); return e && getComputedStyle(e).display === 'none'; };
    return hid('palette-trigger') && hid('topbar-help') && hid('topbar-settings');
  })()`);
  d.assert(stripHidden, 'desktop topbar 🔍/❓/⚙ strip is retired (rail carries them)');

  // 2 · Rail Settings opens the ds sheet as a focused overlay, close affordance.
  await d.click('#ds-appnav [data-nav="settings"]'); await d.sleep(400);
  const open = await d.eval(`(() => {
    const sh = document.getElementById('settings-sheet');
    if (!sh || !sh.classList.contains('is-open')) return { open: false };
    const closeBtn = sh.querySelector('[data-settings-close]');
    const cr = closeBtn.getBoundingClientRect();
    const dd = document.getElementById('topbar-dropdown');
    const rows = [...sh.querySelectorAll('.settings-row')];
    return {
      open: true,
      rows: rows.length,
      closeH: cr.height, closeW: cr.width,
      dropdownHidden: !dd || dd.classList.contains('hidden'),
      minRowH: Math.min(...rows.map(r => r.getBoundingClientRect().height)),
      isOverlay: getComputedStyle(sh).position === 'fixed',
    };
  })()`);
  d.assert(open.open, 'rail Settings opens the ds Settings sheet');
  d.assert(open.rows >= 6, `sheet renders the grouped toggle/action rows (${open.rows})`);
  d.assert(open.closeH >= 44 && open.closeW >= 44, `close affordance is ≥44px (${open.closeW}×${open.closeH})`);
  d.assert(open.dropdownHidden, 'the retired top-right #topbar-dropdown does NOT open (no 1,199px disconnect)');
  d.assert(open.isOverlay, 'the sheet is a focused fixed overlay, not a corner dropdown');
  d.assert(open.minRowH >= 44, `every settings row is a ≥44px target (min ${open.minRowH})`);
  await d.snap('01-desktop-settings-open');

  // 3 · No emoji in the sheet chrome (D07).
  const noEmoji = await d.eval(`!(${EMOJI_RE}).test(document.getElementById('settings-sheet').innerText)`);
  d.assert(noEmoji, 'zero emoji in the Settings sheet (D07 stroke icons only)');

  // 4 · Toggle row flips the real state + persists (synth-clicks the hidden btn).
  await d.eval(`document.querySelector('#settings-sheet [data-toggle="adhd-mode-btn"]').click()`); await d.sleep(300);
  const toggled = await d.eval(`(() => ({
    state: state.adhdMode === true,
    body: document.body.classList.contains('adhd-mode'),
    switchOn: document.querySelector('#settings-sheet [data-toggle="adhd-mode-btn"] .ds-switch').classList.contains('is-on'),
    saved: JSON.parse(localStorage.getItem('jsdrill.progress.v1')).adhdMode === true,
  }))()`);
  d.assert(toggled.state && toggled.body && toggled.switchOn && toggled.saved, `ADHD toggle flips state + switch + persists (${JSON.stringify(toggled)})`);

  // 5 · Text-size segmented control sets the font scale.
  await d.eval(`document.querySelector('#settings-sheet [data-font="xl"]').click()`); await d.sleep(250);
  const font = await d.eval(`(() => ({
    scale: state.fontScale,
    cssVar: getComputedStyle(document.documentElement).getPropertyValue('--font-scale').trim(),
    segOn: document.querySelector('#settings-sheet [data-font="xl"]').classList.contains('is-on'),
  }))()`);
  d.assert(font.scale === 'xl' && font.segOn && parseFloat(font.cssVar) > 1.2, `text-size segment sets XL scale (${JSON.stringify(font)})`);

  // 6 · Destructive Reset row is present + danger-styled (NOT clicked — its
  //     confirm() would block the CDP session; presence + guard is the check).
  const reset = await d.eval(`(() => {
    const r = document.querySelector('#settings-sheet [data-action-btn="reset-btn"]');
    if (!r) return { present: false };
    return { present: true, danger: !!r.querySelector('.settings-badge--danger') };
  })()`);
  d.assert(reset.present && reset.danger, 'Reset is present + danger-styled (guarded by its own confirm)');

  // 7 · Close, then #/m/ toggle route opens the sheet (not a silent flip).
  await d.eval(`document.querySelector('#settings-sheet [data-settings-close]').click()`); await d.sleep(300);
  const closed = await d.eval(`!document.getElementById('settings-sheet').classList.contains('is-open')`);
  d.assert(closed, 'close affordance dismisses the sheet');
  await d.eval(`location.hash = '#/m/settings'`); await d.sleep(400);
  d.assert(await d.eval(`document.getElementById('settings-sheet').classList.contains('is-open')`), '#/m/settings opens the sheet');
  await d.eval(`document.querySelector('#settings-sheet [data-settings-close]').click()`); await d.sleep(200);
  await d.eval(`location.hash = '#/m/pace-bar'`); await d.sleep(400);
  const routeToggle = await d.eval(`(() => ({
    open: document.getElementById('settings-sheet').classList.contains('is-open'),
    notFlipped: state.paceBarOn === false,
  }))()`);
  d.assert(routeToggle.open && routeToggle.notFlipped, `#/m/pace-bar opens the sheet WITHOUT silently flipping (${JSON.stringify(routeToggle)})`);
  await d.eval(`document.querySelector('#settings-sheet [data-settings-close]').click()`); await d.sleep(200);

  // 8 · No horizontal scroll.
  d.assert(await d.eval(`document.documentElement.scrollWidth <= innerWidth`), 'no horizontal scroll at 1280px');

  console.log('\n===== desktop 1280 =====');
  const dr = d.report();
  await d.close();

  // ── Mobile 390 ────────────────────────────────────────────────────────────
  const m = await connect({ url: 'http://localhost:8765/', mobile: true,
    outDir: path.join(OUT, 'mobile'), waitForLoadMs: 2600 });
  await m.eval(`localStorage.setItem('jsdrill.progress.v1', ${JSON.stringify(seedState())})`);
  await m.eval(`history.replaceState(null, '', location.pathname)`);
  await m.reload();
  await m.waitFor(`document.querySelector('#ds-appnav')`, { timeoutMs: 6000 });

  // Mobile keeps the ⚙ topbar icon (nav-audit P2-6b) → opens the same sheet.
  const gearVisible = await m.eval(`getComputedStyle(document.getElementById('topbar-settings')).display !== 'none'`);
  m.assert(gearVisible, 'mobile keeps the topbar ⚙ entry point');
  await m.eval(`document.getElementById('topbar-settings').click()`); await m.sleep(400);
  const mob = await m.eval(`(() => {
    const sh = document.getElementById('settings-sheet');
    if (!sh || !sh.classList.contains('is-open')) return { open: false };
    const rows = [...sh.querySelectorAll('.settings-row')];
    const sheet = sh.querySelector('.ds-sheet').getBoundingClientRect();
    return {
      open: true,
      rows: rows.length,
      minRowH: Math.min(...rows.map(r => r.getBoundingClientRect().height)),
      bottomAnchored: sheet.bottom >= innerHeight - 2,   // slides up from the bottom edge (sheet on mobile)
      noHScroll: document.documentElement.scrollWidth <= innerWidth,
    };
  })()`);
  m.assert(mob.open && mob.rows >= 6, `mobile ⚙ opens the sheet with rows (${JSON.stringify(mob)})`);
  m.assert(mob.minRowH >= 44, `mobile rows are ≥44px targets (min ${mob.minRowH})`);
  m.assert(mob.bottomAnchored, 'mobile presents as a bottom sheet (thumb-reachable)');
  m.assert(mob.noHScroll, 'no horizontal scroll at 390px');
  await m.snap('02-mobile-settings-open');

  // Toggle works on mobile too.
  await m.eval(`document.querySelector('#settings-sheet [data-toggle="adhd-mode-btn"]').click()`); await m.sleep(300);
  m.assert(await m.eval(`state.adhdMode === true`), 'mobile toggle flips state');

  console.log('\n===== mobile 390 =====');
  const mr = m.report();
  await m.close();

  const failed = dr.failed + dr.errors + dr.networkErrors + mr.failed + mr.errors + mr.networkErrors;
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
