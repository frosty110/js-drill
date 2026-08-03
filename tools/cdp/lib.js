// Shared Chrome DevTools Protocol helper for the JS Drill probes.
//
// Why this exists: each one-off probe used to re-implement the CDP plumbing
// (WS connect, message routing, eval/screenshot wrappers). That made probes
// long and made shared bugs persist — like Chrome 148 restricting devtools
// to `localhost` while every probe hardcoded `127.0.0.1`. Put the plumbing
// here once; let scenario scripts be short.
//
// Usage:
//   const { ensureServer, ensureChrome, connect } = require('./lib');
//   await ensureServer({ port: 8765 });
//   await ensureChrome();
//   const s = await connect({ url: 'http://localhost:8765/', mobile: true, outDir: '/tmp/probe-foo' });
//   await s.snap('01-home');
//   const tab = await s.eval(`document.querySelector('.tab-btn.active')?.textContent`);
//   s.assert(/L2/.test(tab), 'expected L2 active');
//   await s.close();
//   s.report();

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const path = require('path');

const HOST = 'localhost'; // Chrome 148 restricts devtools to localhost; do not change.
const PORT = 9222;

// ── Vendored CDN assets ─────────────────────────────────────────────────────
// Sandboxed environments (e.g. Claude Code remote containers) block the CDN
// domains the app loads (cdn.tailwindcss.com, cdnjs.cloudflare.com,
// cdn.jsdelivr.net) while allowing registry.npmjs.org. `bash
// tools/cdp/fetch-vendor.sh` downloads npm-mirror copies into tools/cdp/vendor/
// (gitignored); when that dir exists, connect() transparently serves those
// bytes for the matching CDN URLs via CDP Fetch interception — so probes see
// the fully-styled app. No-op when vendor/ is absent (normal dev machines).
const VENDOR_DIR = path.join(__dirname, 'vendor');
const CM = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16';
const VENDOR_ROUTES = [ // [url-prefix, vendor-relative file, content-type]
  ['https://cdn.tailwindcss.com', 'tailwind/3.4.10/tailwindcss.js', 'application/javascript'],
  [`${CM}/codemirror.min.css`, 'codemirror/lib/codemirror.css', 'text/css'],
  [`${CM}/theme/dracula.min.css`, 'codemirror/theme/dracula.css', 'text/css'],
  [`${CM}/codemirror.min.js`, 'codemirror/lib/codemirror.js', 'application/javascript'],
  [`${CM}/mode/javascript/javascript.min.js`, 'codemirror/mode/javascript/javascript.js', 'application/javascript'],
  [`${CM}/addon/edit/closebrackets.min.js`, 'codemirror/addon/edit/closebrackets.js', 'application/javascript'],
  [`${CM}/addon/edit/matchbrackets.min.js`, 'codemirror/addon/edit/matchbrackets.js', 'application/javascript'],
  [`${CM}/addon/runmode/runmode.min.js`, 'codemirror/addon/runmode/runmode.js', 'application/javascript'],
  ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', 'supabase/dist/umd/supabase.js', 'application/javascript'],
  ['https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js', 'mermaid/dist/mermaid.min.js', 'application/javascript'],
  // Lazy-loaded on demand by js/core/runner.js when a lang:"ts" lesson runs code.
  ['https://cdn.jsdelivr.net/npm/typescript@5.6.3/lib/typescript.js', 'typescript/lib/typescript.js', 'application/javascript'],
];
function resolveVendor(url) {
  for (const [prefix, rel, type] of VENDOR_ROUTES) {
    if (url === prefix || url.startsWith(prefix + '/') || url.startsWith(prefix + '?')) {
      const file = path.join(VENDOR_DIR, rel);
      if (fs.existsSync(file)) return { file, type };
    }
  }
  return null;
}

function get(p) {
  return new Promise((res, rej) => {
    http.get(`http://${HOST}:${PORT}${p}`, r => {
      let b = ''; r.on('data', d => b += d);
      r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}
function put(p) {
  return new Promise((res, rej) => {
    http.request({ host: HOST, port: PORT, path: p, method: 'PUT' }, r => {
      let b = ''; r.on('data', d => b += d);
      r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej).end();
  });
}

async function ensureChrome({ timeoutMs = 15000 } = {}) {
  // If Chrome devtools is already up, do nothing.
  try { await get('/json/version'); return { started: false }; } catch (_) {}
  // Headless so the probe doesn't steal user focus. --user-data-dir keeps the
  // debug profile isolated from the user's normal browser.
  //
  // macOS launches the installed Chrome via `open`; Linux (dev containers, the
  // remote-execution environment) has no `open` and no "Google Chrome" bundle,
  // so fall back to the first chromium binary we can find — CHROME_BIN, then
  // the Playwright browser that ships in those images, then PATH.
  const flags = [
    '--remote-debugging-port=9222',
    '--user-data-dir=/tmp/chrome-debug-jsdrill',
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage'
  ];
  if (process.platform === 'darwin') {
    spawn('open', ['-na', 'Google Chrome', '--args', ...flags], { detached: true, stdio: 'ignore' }).unref();
  } else {
    const candidates = [
      process.env.CHROME_BIN,
      '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      ...(() => {
        // PLAYWRIGHT_BROWSERS_PATH images pin a build number; glob rather than hardcode.
        try {
          const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
          return fs.readdirSync(root)
            .filter(d => d.startsWith('chromium-'))
            .map(d => path.join(root, d, 'chrome-linux', 'chrome'));
        } catch (_) { return []; }
      })(),
      'chromium', 'chromium-browser', 'google-chrome'
    ].filter(Boolean);
    const bin = candidates.find(c => (c.includes('/') ? fs.existsSync(c) : true));
    if (!bin) throw new Error('No chromium binary found — set CHROME_BIN to one.');
    spawn(bin, flags, { detached: true, stdio: 'ignore' }).unref();
  }
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { await get('/json/version'); return { started: true }; } catch (_) {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Chrome devtools did not come up on ${HOST}:${PORT} within ${timeoutMs}ms`);
}

async function ensureServer({ port = 8765, dir = process.cwd(), timeoutMs = 4000 } = {}) {
  // If something already serves :port, accept it.
  try {
    await new Promise((res, rej) => {
      http.get(`http://localhost:${port}/`, r => { r.resume(); res(); }).on('error', rej);
    });
    return { started: false, port };
  } catch (_) {}
  spawn('python3', ['-m', 'http.server', String(port)], {
    cwd: dir, detached: true, stdio: 'ignore'
  }).unref();
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      await new Promise((res, rej) => {
        http.get(`http://localhost:${port}/`, r => { r.resume(); res(); }).on('error', rej);
      });
      return { started: true, port };
    } catch (_) {}
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error(`Local server did not come up on :${port} within ${timeoutMs}ms`);
}

async function connect({ url, mobile = false, viewport, outDir, waitForLoadMs = 2200 }) {
  if (!url) throw new Error('connect: { url } required');
  if (outDir) fs.mkdirSync(outDir, { recursive: true });

  const tab = await put('/json/new?about:blank');
  // The webSocketDebuggerUrl returned by Chrome may use 127.0.0.1; rewrite to
  // localhost so the actual WS connection succeeds on Chrome 148+.
  const wsUrl = tab.webSocketDebuggerUrl.replace('127.0.0.1', HOST);
  const ws = new WebSocket(wsUrl);
  let id = 1;
  const pending = new Map();
  const consoleMsgs = [];
  const dialogs = [];   // native alert/confirm/prompt — auto-dismissed so probes never hang
  const networkErrors = [];
  const requestUrls = new Map();
  const assertions = [];

  function rawSend(method, params = {}) {
    return new Promise((res, rej) => {
      const i = id++;
      pending.set(i, [res, rej]);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  }
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) {
      const [res, rej] = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
      return;
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      const txt = (m.params.args || []).map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ');
      consoleMsgs.push({ type: m.params.type, text: txt });
    } else if (m.method === 'Runtime.exceptionThrown') {
      consoleMsgs.push({ type: 'exception', text: m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || '') });
    } else if (m.method === 'Page.javascriptDialogOpening') {
      // A native alert()/confirm() BLOCKS the page (and every pending
      // Runtime.evaluate) until dismissed — a probe without this handler
      // hangs forever the first time the app throws an alert. Record + cancel.
      dialogs.push({ type: m.params.type, message: m.params.message });
      rawSend('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
    } else if (m.method === 'Network.requestWillBeSent') {
      requestUrls.set(m.params.requestId, m.params.request.url);
    } else if (m.method === 'Network.loadingFailed') {
      networkErrors.push({ url: requestUrls.get(m.params.requestId) || '(unknown)', error: m.params.errorText });
    } else if (m.method === 'Fetch.requestPaused') {
      const { requestId, request } = m.params;
      const hit = resolveVendor(request.url);
      if (hit) {
        rawSend('Fetch.fulfillRequest', {
          requestId, responseCode: 200,
          responseHeaders: [
            { name: 'Content-Type', value: hit.type },
            { name: 'Access-Control-Allow-Origin', value: '*' },
          ],
          body: fs.readFileSync(hit.file).toString('base64'),
        }).catch(() => {});
      } else {
        rawSend('Fetch.continueRequest', { requestId }).catch(() => {});
      }
    } else if (m.method === 'Network.responseReceived') {
      const r = m.params.response;
      // favicon.ico is requested by the browser but the app intentionally
      // doesn't serve one — that 404 is universally ignorable noise.
      if (r.status >= 400 && !/\/favicon\.ico(?:\?|$)/.test(r.url)) {
        networkErrors.push({ url: r.url, error: 'HTTP ' + r.status });
      }
    }
  });

  await rawSend('Page.enable');
  await rawSend('Runtime.enable');
  await rawSend('Network.enable');
  // Bypass HTTP cache for the lifetime of the probe — prevents stale
  // js/app/*.js bytes from a previous local-dev session masking a freshly
  // edited slice. Cheap to do per-tab, applies to all navigations on this
  // session. Discovered while smoke-testing the 🎧 Audio prototype: HTML
  // cachebust query bust the document but Chrome still returned cached JS.
  await rawSend('Network.setCacheDisabled', { cacheDisabled: true });

  // Serve vendored CDN assets when available (see VENDOR_ROUTES above).
  if (fs.existsSync(VENDOR_DIR)) {
    await rawSend('Fetch.enable', { patterns: [
      { urlPattern: 'https://cdn.tailwindcss.com*' },
      { urlPattern: 'https://cdnjs.cloudflare.com/*' },
      { urlPattern: 'https://cdn.jsdelivr.net/*' },
    ]});
  }

  if (mobile) {
    // iPhone 13 mini viewport — the PROFILE.md mobile target.
    await rawSend('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await rawSend('Emulation.setTouchEmulationEnabled', { enabled: true });
    // Force coarse-pointer media query so `(pointer: coarse)` matches reliably.
    await rawSend('Emulation.setEmulatedMedia', { features: [
      { name: 'pointer', value: 'coarse' },
      { name: 'any-pointer', value: 'coarse' }
    ]});
  } else if (viewport) {
    // setDeviceMetricsOverride requires mobile + deviceScaleFactor; a bare
    // { width, height } is rejected as "Invalid parameters" from inside
    // connect(), which reads like a probe bug anywhere but here.
    await rawSend('Emulation.setDeviceMetricsOverride',
      { mobile: false, deviceScaleFactor: 1, ...viewport });
  }

  await rawSend('Page.navigate', { url });
  await new Promise(r => setTimeout(r, waitForLoadMs));

  // The app registers a cache-first service worker (service-worker.js). A
  // probe tab spun up after a previous probe installed it gets the CACHED app
  // shell — Network.setCacheDisabled does NOT bypass SW caches, so freshly
  // edited files silently don't load (bit the P1 nav probe: desktop tab got a
  // stale index.html without the new script tag). Neutralize: unregister all
  // SWs + delete CacheStorage, then reload so this probe sees live bytes.
  const swControlled = await (async () => {
    try {
      const r = await rawSend('Runtime.evaluate', {
        expression: `(async () => {
          if (!('serviceWorker' in navigator)) return false;
          const regs = await navigator.serviceWorker.getRegistrations();
          const had = regs.length > 0 || !!navigator.serviceWorker.controller;
          await Promise.all(regs.map(reg => reg.unregister()));
          if (typeof caches !== 'undefined') {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
          return had;
        })()`, returnByValue: true, awaitPromise: true });
      return !!r.result?.value;
    } catch (_) { return false; }
  })();
  if (swControlled) {
    await rawSend('Page.reload', { ignoreCache: true });
    await new Promise(r => setTimeout(r, waitForLoadMs));
  }
  // Note on cache busting after a code edit: Network.setCacheDisabled
  // (above) is the lighter-touch option but sometimes loses to Chrome's
  // preload scanner on recently-visited URLs. Probes that run right after
  // an edit and see stale JS can add `?cb=Date.now()` to the URL passed to
  // connect() — that busts the HTML which then re-requests subresources.

  let snapCounter = 0;
  const session = {
    consoleMsgs, networkErrors, assertions, dialogs,

    async eval(expression, { awaitPromise = false, returnByValue = true } = {}) {
      const r = await rawSend('Runtime.evaluate', { expression, returnByValue, awaitPromise });
      if (r.exceptionDetails) throw new Error('eval threw: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result?.value;
    },

    async evalAwait(expression) { return session.eval(expression, { awaitPromise: true }); },

    // Raw CDP escape hatch. Needed when the thing under test IS the browser's
    // own input handling — a synthesized PointerEvent from eval() never
    // produces the real click-after-drag a mouse does, so a probe built on
    // dispatchEvent would pass while the feature was broken.
    async send(method, params = {}) { return rawSend(method, params); },

    async click(selector) {
      const ok = await session.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
      if (!ok) throw new Error(`click: selector not found: ${selector}`);
      return ok;
    },

    async snap(label) {
      if (!outDir) throw new Error('snap: no outDir was provided to connect()');
      const n = String(++snapCounter).padStart(2, '0');
      const file = path.join(outDir, `${n}-${label}.png`);
      const s = await rawSend('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(file, Buffer.from(s.data, 'base64'));
      return file;
    },

    async reload() {
      // ignoreCache=true bypasses Chrome's HTTP cache so probes pick up the
      // current app.js after edits. The local server doesn't set cache
      // headers, so without this flag Chrome can serve a stale build between
      // probe runs in the same session.
      await rawSend('Page.reload', { ignoreCache: true });
      await new Promise(r => setTimeout(r, waitForLoadMs));
    },

    async waitFor(expression, { timeoutMs = 4000, intervalMs = 100 } = {}) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        const v = await session.eval(expression).catch(() => false);
        if (v) return v;
        await new Promise(r => setTimeout(r, intervalMs));
      }
      throw new Error(`waitFor: timeout after ${timeoutMs}ms — ${expression}`);
    },

    async seedLocalStorage(key, valueObj) {
      // Seed BEFORE reload so the app picks it up on next init.
      await session.eval(`localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify(valueObj))})`);
      await session.reload();
    },

    async sleep(ms) { await new Promise(r => setTimeout(r, ms)); },

    // Switch breakpoints inside one session. Opening a second connect() just to
    // check desktop costs a whole tab + Fetch-interception setup; this keeps a
    // responsive probe to a single session.
    async setViewport({ width, height, mobile = false, deviceScaleFactor = 2 }) {
      await rawSend('Emulation.setDeviceMetricsOverride', { width, height, mobile, deviceScaleFactor });
    },

    assert(cond, message) {
      assertions.push({ ok: !!cond, message });
      return !!cond;
    },

    report() {
      const passed = assertions.filter(a => a.ok).length;
      const failed = assertions.length - passed;
      const errs = consoleMsgs.filter(m => m.type === 'error' || m.type === 'exception');
      console.log(`\nProbe report:`);
      console.log(`  Assertions: ${passed} passed, ${failed} failed (${assertions.length} total)`);
      for (const a of assertions) console.log(`    ${a.ok ? 'PASS' : 'FAIL'} — ${a.message}`);
      if (errs.length) {
        console.log(`  Console errors: ${errs.length}`);
        for (const e of errs.slice(0, 10)) console.log(`    [${e.type}] ${e.text}`);
      }
      if (networkErrors.length) {
        console.log(`  Network errors: ${networkErrors.length}`);
        for (const n of networkErrors.slice(0, 10)) console.log(`    ${n.url} — ${n.error}`);
      }
      if (outDir) console.log(`  Screenshots: ${outDir}`);
      return { passed, failed, errors: errs.length, networkErrors: networkErrors.length };
    },

    async close() {
      ws.close();
      await new Promise(r => http.get(`http://${HOST}:${PORT}/json/close/${tab.id}`, () => r()).on('error', () => r()));
    }
  };

  return session;
}

module.exports = { ensureChrome, ensureServer, connect, HOST, PORT };
