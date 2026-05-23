#!/usr/bin/env node
// Mobile L3 specific check — dismisses welcome, clicks L3, scrolls, and snaps
// the editor + sticky action bar.
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

const base = process.argv[2];
const out = process.argv[3] || '/tmp/jsdrill-mobile-l3';
if (!base) { console.error('usage: cdp-mobile-l3.js <url> [outDir]'); process.exit(2); }

const PORT = 9222;
function putReq(p) {
  return new Promise((res, rej) => {
    http.request({ host: 'localhost', port: PORT, path: p, method: 'PUT' }, r => {
      let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej).end();
  });
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const tab = await putReq('/json/new?about:blank');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((res, rej) => {
      const i = id++;
      pending.set(i, [res, rej]);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  }
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) {
      const [res, rej] = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  // iPhone 13 mini-ish viewport
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: base });
  await new Promise(r => setTimeout(r, 2200));

  // Dismiss welcome if present
  await send('Runtime.evaluate', {
    expression: `document.querySelector('[data-action="dismiss-welcome"]')?.click()`
  });
  await new Promise(r => setTimeout(r, 400));

  async function snap(label) {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${out}/${label}.png`, Buffer.from(s.data, 'base64'));
  }

  // Snap home
  await snap('01-home');

  // Click L3
  await send('Runtime.evaluate', {
    expression: `[...document.querySelectorAll('.tab-btn')].find(b => /Drill/.test(b.textContent))?.click()`
  });
  await new Promise(r => setTimeout(r, 700));
  await snap('02-L3-top');

  // Scroll down inside the lesson shell to see editor + sticky bar
  await send('Runtime.evaluate', {
    expression: `window.scrollTo(0, document.body.scrollHeight)`
  });
  await new Promise(r => setTimeout(r, 300));
  await snap('03-L3-scrolled');

  // Probe: is the action bar visible at the bottom?
  const probe = await send('Runtime.evaluate', {
    expression: `(() => {
      const bar = document.querySelector('.l3-actions');
      if (!bar) return JSON.stringify({ found: false });
      const r = bar.getBoundingClientRect();
      const vh = window.innerHeight;
      // Sticky element should be near bottom of viewport
      return JSON.stringify({ found: true, bottom: r.bottom, top: r.top, vh });
    })()`, returnByValue: true
  });
  console.log('L3 sticky probe:', probe.result.value);

  // Type some text in the editor and check wrap
  await send('Runtime.evaluate', {
    expression: `(() => {
      const cm = document.querySelector('.CodeMirror')?.CodeMirror;
      if (!cm) return 'no cm';
      cm.setValue('// A very long single line that should wrap on a phone screen and never produce a horizontal scrollbar even on a 390px viewport\\nconsole.log(\"hi\");');
      cm.refresh();
      return 'set';
    })()`, returnByValue: true
  });
  await new Promise(r => setTimeout(r, 400));
  await send('Runtime.evaluate', { expression: `window.scrollTo(0, 0)` });
  await new Promise(r => setTimeout(r, 200));
  await snap('04-L3-wrap-test');

  ws.close();
  await new Promise(r => http.get(`http://localhost:${PORT}/json/close/${tab.id}`, () => r()).on('error', () => r()));
})();
