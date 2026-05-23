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
  spawn('open', ['-na', 'Google Chrome', '--args',
    '--remote-debugging-port=9222',
    '--user-data-dir=/tmp/chrome-debug-jsdrill',
    '--headless=new'
  ], { detached: true, stdio: 'ignore' }).unref();
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
    } else if (m.method === 'Network.requestWillBeSent') {
      requestUrls.set(m.params.requestId, m.params.request.url);
    } else if (m.method === 'Network.loadingFailed') {
      networkErrors.push({ url: requestUrls.get(m.params.requestId) || '(unknown)', error: m.params.errorText });
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
    await rawSend('Emulation.setDeviceMetricsOverride', viewport);
  }

  await rawSend('Page.navigate', { url });
  await new Promise(r => setTimeout(r, waitForLoadMs));

  let snapCounter = 0;
  const session = {
    consoleMsgs, networkErrors, assertions,

    async eval(expression, { awaitPromise = false, returnByValue = true } = {}) {
      const r = await rawSend('Runtime.evaluate', { expression, returnByValue, awaitPromise });
      if (r.exceptionDetails) throw new Error('eval threw: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result?.value;
    },

    async evalAwait(expression) { return session.eval(expression, { awaitPromise: true }); },

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
      await rawSend('Page.reload');
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
