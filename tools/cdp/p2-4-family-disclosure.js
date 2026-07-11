// p2-4-family-disclosure.js — verify the deferred nav-audit P2-4 fix: the
// Practice launcher's drill-family rows now carry a ▾ disclosure that expands
// the member list, so a specific drill (e.g. Swap-Bench) can be launched
// deterministically instead of only via the family's random shuffle.
//
//   node tools/cdp/p2-4-family-disclosure.js [outDir]

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('./lib');

const OUT = process.argv[2] || '/tmp/jsdrill-probe-p2-4';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  const s = await connect({ url: 'http://localhost:8765/', mobile: true, outDir: OUT, waitForLoadMs: 2600 });
  await s.eval(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({__v:5, welcomed:true, progress:{}, reviews:{}}))`);
  await s.eval(`history.replaceState(null,'',location.pathname)`);
  await s.reload();
  await s.waitFor(`document.querySelector('#ds-appnav')`, { timeoutMs: 6000 });

  // Open the Practice launcher.
  await s.eval(`document.getElementById('practice-launcher-btn').click()`); await s.sleep(500);
  const opened = await s.eval(`document.getElementById('practice-launcher')?.classList.contains('is-open')`);
  s.assert(opened, 'Practice launcher sheet opens');

  // A family row (shuffle) carries a ▾ disclosure and a hidden member list.
  const before = await s.eval(`(() => {
    const fam = [...document.querySelectorAll('#practice-launcher [data-family]')].find(f => f.querySelector('[data-disclose]'));
    if (!fam) return { fam: false };
    return {
      fam: true,
      hasShuffle: !!fam.querySelector('[data-action="shuffle"]'),
      membersHidden: fam.querySelector('[data-members]')?.hasAttribute('hidden'),
      discloseH: fam.querySelector('[data-disclose]').getBoundingClientRect().height,
    };
  })()`);
  s.assert(before.fam && before.hasShuffle, 'a drill-family row keeps its random-shuffle tap + a ▾ disclosure');
  s.assert(before.membersHidden === true, 'member list starts collapsed (family row is the primary tap)');
  s.assert(before.discloseH >= 44, `▾ disclosure is a ≥44px target (${before.discloseH})`);
  await s.snap('01-launcher-collapsed');

  // Tapping ▾ expands deterministic member rows (each a real data-btn-id).
  await s.eval(`(() => {
    const fam = [...document.querySelectorAll('#practice-launcher [data-family]')].find(f => f.querySelector('[data-disclose]'));
    fam.querySelector('[data-disclose]').click();
  })()`); await s.sleep(300);
  const expanded = await s.eval(`(() => {
    const fam = [...document.querySelectorAll('#practice-launcher [data-family]')].find(f => f.querySelector('[data-members]:not([hidden])'));
    if (!fam) return { open: false };
    const members = [...fam.querySelectorAll('[data-members] [data-btn-id]')];
    return {
      open: true,
      count: members.length,
      allResolve: members.every(m => !!document.getElementById(m.getAttribute('data-btn-id'))),
      minH: members.length ? Math.min(...members.map(m => m.getBoundingClientRect().height)) : 0,
      ariaExpanded: fam.querySelector('[data-disclose]').getAttribute('aria-expanded') === 'true',
    };
  })()`);
  s.assert(expanded.open && expanded.count >= 2, `▾ expands the member list (${expanded.count} drills)`);
  s.assert(expanded.allResolve, 'every member row resolves to a real drill button (data-btn-id contract)');
  s.assert(expanded.minH >= 44 && expanded.ariaExpanded, `member rows are ≥44px + aria-expanded set (${JSON.stringify(expanded)})`);
  await s.snap('02-launcher-expanded');

  // Tapping a member launches that specific drill + closes the sheet.
  const memberId = await s.eval(`(() => {
    const fam = [...document.querySelectorAll('#practice-launcher [data-family]')].find(f => f.querySelector('[data-members]:not([hidden])'));
    const m = fam.querySelector('[data-members] [data-btn-id]');
    const id = m.getAttribute('data-btn-id');
    m.click();
    return id;
  })()`);
  await s.sleep(500);
  const launched = await s.eval(`!document.getElementById('practice-launcher').classList.contains('is-open')`);
  s.assert(launched, `tapping a specific member (${memberId}) closes the launcher (drill launched)`);

  s.assert(await s.eval(`document.documentElement.scrollWidth <= innerWidth`), 'no horizontal scroll @390');

  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
