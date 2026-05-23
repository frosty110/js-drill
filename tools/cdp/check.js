#!/usr/bin/env node
// Drive the Chrome debug port at localhost:9222 to load a URL and capture:
//   - Console messages (especially errors)
//   - Network failures
//   - Page title and a screenshot
//   - Basic DOM probes (sidebar lesson count, selected lesson content presence)
//
// Usage: node scripts/cdp-check.js <url> [--screenshot path.png] [--mobile]

const WebSocket = (() => {
  try { return require('ws'); }
  catch (e) {
    // Fall back to a tiny built-in WS impl using net + crypto — not needed here
    console.error('Install `ws`:  npm i ws  (or run from a dir that has it)');
    process.exit(2);
  }
})();
const http = require('http');
const fs = require('fs');

const argv = process.argv.slice(2);
const url = argv[0];
if (!url) { console.error('usage: cdp-check.js <url> [--screenshot file.png] [--mobile]'); process.exit(2); }
const screenshotArg = argv.indexOf('--screenshot');
const screenshotPath = screenshotArg >= 0 ? argv[screenshotArg + 1] : null;
const mobile = argv.includes('--mobile');

const PORT = 9222;
function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
async function newTab(url) {
  return new Promise((resolve, reject) => {
    http.request({ host: 'localhost', port: PORT, path: `/json/new?${encodeURIComponent(url)}`, method: 'PUT' }, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { reject(e); } });
    }).on('error', reject).end();
  });
}
async function closeTab(id) {
  return new Promise((resolve) => {
    http.get(`http://localhost:${PORT}/json/close/${id}`, () => resolve()).on('error', () => resolve());
  });
}

(async () => {
  const target = await newTab('about:blank');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();
  const consoleMsgs = [];
  const failedRequests = [];
  const requestUrls = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const t = msg.params.type;
      const text = msg.params.args.map(a => a.value !== undefined ? a.value : (a.description || JSON.stringify(a))).join(' ');
      consoleMsgs.push({ type: t, text });
    } else if (msg.method === 'Runtime.exceptionThrown') {
      consoleMsgs.push({ type: 'exception', text: msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || '') });
    } else if (msg.method === 'Network.requestWillBeSent') {
      requestUrls.set(msg.params.requestId, msg.params.request.url);
    } else if (msg.method === 'Network.loadingFailed') {
      failedRequests.push({ url: requestUrls.get(msg.params.requestId) || '(unknown)', error: msg.params.errorText });
    } else if (msg.method === 'Network.responseReceived') {
      const r = msg.params.response;
      if (r.status >= 400) failedRequests.push({ url: r.url, error: 'HTTP ' + r.status });
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  if (mobile) {
    // iPhone 13 viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 2, mobile: true
    });
  }

  await send('Page.navigate', { url });
  // wait for load
  await new Promise((resolve) => {
    const handler = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.method === 'Page.loadEventFired') { ws.off('message', handler); resolve(); }
    };
    ws.on('message', handler);
  });
  // Give the app some time to fetch manifest + render
  await new Promise(r => setTimeout(r, 1500));

  // Probe the DOM
  const probe = await send('Runtime.evaluate', {
    expression: `(() => {
      const sidebarLinks = document.querySelectorAll('.lesson-link');
      const trackHeaders = document.querySelectorAll('.track-header');
      const sectionHeaders = document.querySelectorAll('.section-header');
      const lessonShell = document.getElementById('lesson-shell');
      const lessonTitle = lessonShell?.querySelector('h2')?.textContent || null;
      const tabs = document.querySelectorAll('.tab-btn');
      const codeMirrors = document.querySelectorAll('.CodeMirror');
      const codeBlocks = document.querySelectorAll('pre.code-block, .code-block');
      return JSON.stringify({
        sidebarLinks: sidebarLinks.length,
        trackHeaders: trackHeaders.length,
        sectionHeaders: sectionHeaders.length,
        lessonTitle,
        tabs: tabs.length,
        codeMirrorsOnPage: codeMirrors.length,
        codeBlocksOnPage: codeBlocks.length,
        shellLen: lessonShell?.innerText?.length || 0
      });
    })()`,
    returnByValue: true
  });
  const probeData = JSON.parse(probe.result.value);

  if (screenshotPath) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(screenshotPath, Buffer.from(shot.data, 'base64'));
  }

  // Report
  console.log('URL:', url);
  console.log('Probe:', JSON.stringify(probeData, null, 2));
  console.log('Console messages:', consoleMsgs.length);
  for (const m of consoleMsgs.slice(0, 30)) {
    console.log('  [' + m.type + ']', m.text);
  }
  console.log('Failed requests:', failedRequests.length);
  for (const r of failedRequests.slice(0, 30)) {
    console.log('  ' + r.url + ' — ' + r.error);
  }
  const errors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'exception');
  if (screenshotPath) console.log('Screenshot:', screenshotPath);
  ws.close();
  await closeTab(target.id);
  process.exit(errors.length || failedRequests.length ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
