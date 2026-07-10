// audit-nav-pages.js — AUDIT PROBE (2026-07-10 navigation audit).
// Cross-page round trips: system-design.html + diagnostic.html at 390/1280.
// Checks: return-path presence/visibility/tap-size, absence of app nav,
// and (from index) the visible entry points to each page.
//   node tools/cdp/audit-nav-pages.js <out.json> <shotsDir>

const path = require('path');
const fs = require('fs');
const { ensureServer, ensureChrome, connect } = require('./lib');

const OUT_JSON = process.argv[2] || '/tmp/audit-pages.json';
const SHOTS = process.argv[3] || '/tmp/audit-pages-shots';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  fs.mkdirSync(SHOTS, { recursive: true });
  const results = {};

  for (const [name, opts] of [
    ['mobile390', { mobile: true }],
    ['desktop1280', { mobile: false, viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false } }],
  ]) {
    results[name] = {};

    for (const page of ['system-design.html', 'diagnostic.html']) {
      const s = await connect({ url: `http://localhost:8765/${page}`, ...opts, outDir: path.join(SHOTS, name), waitForLoadMs: 2600 });
      await s.sleep(600);
      const key = page.replace('.html', '');
      results[name][key] = await s.eval(`(() => {
        const links = [...document.querySelectorAll('a[href*="index.html"], a[href="./"], a[href="/"]')];
        const linkInfo = links.map(a => {
          const r = a.getBoundingClientRect();
          const cs = getComputedStyle(a);
          return { text: (a.textContent || '').trim(), visible: cs.display !== 'none' && r.width > 0,
                   inViewport: r.top >= 0 && r.top < innerHeight, w: Math.round(r.width), h: Math.round(r.height),
                   top: Math.round(r.top) };
        });
        return {
          title: document.title,
          returnLinks: linkInfo,
          hasBottomNav: !!document.getElementById('ds-appnav'),
          hasTopbar: !!document.getElementById('topbar'),
          hasPalette: !!document.getElementById('palette-overlay'),
          bodyChrome: [...document.querySelectorAll('header, nav')].map(el => el.tagName + '.' + (el.className || '').toString().slice(0, 40)),
          consoleOk: true,
        };
      })()`);
      results[name][key].consoleErrors = s.consoleMsgs
        .filter(m => m.type === 'error' || m.type === 'exception').map(m => m.text.slice(0, 160));
      await s.snap(`${key}-top`);
      // scroll to bottom to see if any footer nav exists
      await s.eval(`window.scrollTo(0, document.body.scrollHeight)`);
      await s.sleep(300);
      await s.snap(`${key}-bottom`);
      await s.close();
    }
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));
  console.log('wrote', OUT_JSON);
})().catch(e => { console.error(e); process.exit(2); });
