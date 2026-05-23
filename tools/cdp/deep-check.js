#!/usr/bin/env node
// Deeper check — navigates to URL, switches tabs, clicks a different lesson,
// captures screenshots at each step. Reports console errors and failed reqs.
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

const argv = process.argv.slice(2);
const baseUrl = argv[0];
const outDir = argv[1] || '/tmp/jsdrill-shots';
const mobile = argv.includes('--mobile');

if (!baseUrl) { console.error('usage: cdp-deep-check.js <url> [outDir] [--mobile]'); process.exit(2); }

const PORT = 9222;
function getJson(p) {
  return new Promise((res, rej) => {
    http.get(`http://localhost:${PORT}${p}`, r => {
      let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}
function putReq(p) {
  return new Promise((resolve, reject) => {
    http.request({ host: 'localhost', port: PORT, path: p, method: 'PUT' }, r => {
      let b = ''; r.on('data', d => b += d); r.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject).end();
  });
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const tab = await putReq('/json/new?about:blank');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();
  const consoleMsgs = [];
  const failedReqs = [];
  const reqUrls = new Map();
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(m.error.message)); else resolve(m.result);
      return;
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      consoleMsgs.push({ type: m.params.type, text: m.params.args.map(a => a.value ?? a.description ?? '').join(' ') });
    } else if (m.method === 'Runtime.exceptionThrown') {
      consoleMsgs.push({ type: 'exception', text: m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || '') });
    } else if (m.method === 'Network.requestWillBeSent') {
      reqUrls.set(m.params.requestId, m.params.request.url);
    } else if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) {
      failedReqs.push({ url: m.params.response.url, error: 'HTTP ' + m.params.response.status });
    } else if (m.method === 'Network.loadingFailed') {
      failedReqs.push({ url: reqUrls.get(m.params.requestId) || '(unknown)', error: m.params.errorText });
    }
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  if (mobile) {
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  }
  await send('Page.navigate', { url: baseUrl });
  await new Promise(r => {
    const h = raw => {
      const m = JSON.parse(raw.toString());
      if (m.method === 'Page.loadEventFired') { ws.off('message', h); r(); }
    };
    ws.on('message', h);
  });
  await new Promise(r => setTimeout(r, 1500));

  async function snap(label) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const path = `${outDir}/${label}.png`;
    fs.writeFileSync(path, Buffer.from(shot.data, 'base64'));
    return path;
  }

  async function probe(label) {
    const r = await send('Runtime.evaluate', {
      expression: `(() => {
        const sb = document.querySelectorAll('.lesson-link').length;
        const title = document.querySelector('#lesson-shell h2')?.textContent || null;
        const codeBlocks = document.querySelectorAll('.code-block').length;
        const tokenSpans = document.querySelectorAll('.cm-s-dracula .cm-keyword, .cm-s-dracula .cm-string, .cm-s-dracula .cm-number, .cm-s-dracula .cm-comment').length;
        const activeTab = document.querySelector('.tab-btn.active')?.textContent?.trim() || null;
        return JSON.stringify({ label: '${label}', sidebar: sb, title, codeBlocks, tokenSpans, activeTab });
      })()`, returnByValue: true
    });
    return JSON.parse(r.result.value);
  }

  const probes = [];

  // Initial state: should land on Reference
  probes.push(await probe('initial-reference'));
  await snap('01-initial-reference');

  // Click L2 tab
  await send('Runtime.evaluate', {
    expression: `[...document.querySelectorAll('.tab-btn')].find(b => /Fill-in/.test(b.textContent))?.click();`
  });
  await new Promise(r => setTimeout(r, 500));
  probes.push(await probe('L2-tab'));
  await snap('02-L2-tab');

  // Click L3 tab
  await send('Runtime.evaluate', {
    expression: `[...document.querySelectorAll('.tab-btn')].find(b => /Drill/.test(b.textContent))?.click();`
  });
  await new Promise(r => setTimeout(r, 500));
  probes.push(await probe('L3-tab'));
  await snap('03-L3-tab');

  // Click a pattern lesson (Two Sum) to trigger lazy load
  await send('Runtime.evaluate', {
    expression: `[...document.querySelectorAll('.lesson-link')].find(l => /Two Sum/.test(l.textContent))?.click();`
  });
  await new Promise(r => setTimeout(r, 800));
  probes.push(await probe('after-click-two-sum'));
  await snap('04-two-sum');

  // Switch to L2 on Two Sum
  await send('Runtime.evaluate', {
    expression: `[...document.querySelectorAll('.tab-btn')].find(b => /Fill-in/.test(b.textContent))?.click();`
  });
  await new Promise(r => setTimeout(r, 500));
  probes.push(await probe('two-sum-L2'));
  await snap('05-two-sum-L2');

  console.log('URL:', baseUrl, mobile ? '(mobile)' : '');
  for (const p of probes) console.log(JSON.stringify(p));
  console.log('Console msgs:', consoleMsgs.length);
  for (const m of consoleMsgs.slice(0, 20)) console.log('  [' + m.type + '] ' + m.text);
  console.log('Failed reqs:', failedReqs.length);
  for (const r of failedReqs.slice(0, 20)) console.log('  ' + r.url + ' — ' + r.error);

  const errs = consoleMsgs.filter(m => m.type === 'error' || m.type === 'exception');
  // favicon-only is fine
  const realFails = failedReqs.filter(r => !/favicon\.ico$/.test(r.url));
  ws.close();
  await getJson('/json/close/' + tab.id).catch(() => {});
  process.exit(errs.length || realFails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
