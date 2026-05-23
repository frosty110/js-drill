#!/usr/bin/env node
// Probes the vertical binder tabs: presence, count badges, tab switch behavior,
// active-lesson sync after a cross-track navigation.
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

const base = process.argv[2];
const outDir = process.argv[3] || '/tmp/jsdrill-binder';
const mobile = process.argv.includes('--mobile');
if (!base) { console.error('usage: binder-check.js <url> [outDir] [--mobile]'); process.exit(2); }
const PORT = 9222;

function putReq(p) {
  return new Promise((res, rej) => {
    http.request({ host: 'localhost', port: PORT, path: p, method: 'PUT' }, r => {
      let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej).end();
  });
}

function getJson(p) {
  return new Promise((res, rej) => {
    http.get(`http://localhost:${PORT}${p}`, r => {
      let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

// Close any pre-existing tabs that point at the same host — they fire
// `storage` events when our tab does saveProgress and clobber state under us.
async function closeStaleHostTabs(hostHint) {
  const list = await getJson('/json/list').catch(() => []);
  for (const t of list) {
    if (t.url && t.url.includes(hostHint)) {
      await new Promise(r => http.get(`http://localhost:${PORT}/json/close/${t.id}`, () => r()).on('error', () => r()));
    }
  }
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const hostHint = new URL(base).host;
  await closeStaleHostTabs(hostHint);
  const tab = await putReq('/json/new?about:blank');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 1; const pending = new Map();
  const consoleMsgs = [];
  function send(method, params = {}) {
    return new Promise((res, rej) => {
      const i = id++; pending.set(i, [res, rej]);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  }
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) {
      const [res, rej] = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
      return;
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      consoleMsgs.push({ type: m.params.type, text: m.params.args.map(a => a.value ?? a.description ?? '').join(' ') });
    } else if (m.method === 'Runtime.exceptionThrown') {
      consoleMsgs.push({ type: 'exception', text: m.params.exceptionDetails.text });
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  if (mobile) await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: base });
  await new Promise(r => setTimeout(r, 1800));
  // Fresh state per probe run — older runs persist state into localStorage,
  // which makes flake-debugging miserable.
  await send('Runtime.evaluate', { expression: `localStorage.clear(); location.reload();` });
  await new Promise(r => setTimeout(r, 2000));
  if (mobile) {
    // Open the drawer so binder taps land on real geometry rather than the
    // off-screen pre-open transform.
    await send('Runtime.evaluate', { expression: `document.body.classList.add('sidebar-open')` });
    await new Promise(r => setTimeout(r, 200));
  }

  async function snap(label) {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${outDir}/${label}.png`, Buffer.from(s.data, 'base64'));
  }

  async function probe() {
    const r = await send('Runtime.evaluate', {
      expression: `(() => {
        const tabs = [...document.querySelectorAll('.binder-tab')];
        const active = tabs.find(t => t.classList.contains('active'));
        const sectionsVisible = [...document.querySelectorAll('#sidebar-nav .section-header')].map(s => s.textContent);
        const lessons = document.querySelectorAll('#sidebar-nav .lesson-link').length;
        const trackHeaders = document.querySelectorAll('.track-header').length;
        return JSON.stringify({
          tabCount: tabs.length,
          tabLabels: tabs.map(t => t.firstChild?.textContent),
          tabCounts: tabs.map(t => t.querySelector('.binder-tab-count')?.textContent),
          activeLabel: active?.firstChild?.textContent,
          activeAria: active?.getAttribute('aria-selected'),
          stateSidebarTrack: window.__jsdrillState?.sidebarTrack,
          stateCurrentLessonId: window.__jsdrillState?.currentLessonId,
          sectionsVisible,
          lessons,
          trackHeaders                  /* expect 0 — old headers removed */
        });
      })()`, returnByValue: true
    });
    return JSON.parse(r.result.value);
  }

  // 1. Initial state — should show one track of lessons + two tabs
  console.log('initial:', JSON.stringify(await probe()));
  await snap('01-initial');

  // 2. Click the OTHER tab
  await send('Runtime.evaluate', {
    expression: `(() => {
      const tabs = [...document.querySelectorAll('.binder-tab')];
      const inactive = tabs.find(t => !t.classList.contains('active'));
      inactive?.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 350));
  console.log('after-switch:', JSON.stringify(await probe()));
  await snap('02-after-switch');

  // 3. Click a lesson from the new tab
  await send('Runtime.evaluate', {
    expression: `document.querySelector('#sidebar-nav .lesson-link:not(.stub)')?.click()`
  });
  await new Promise(r => setTimeout(r, 700));
  await snap('03-lesson-from-second-tab');

  // 4. Switch back to first tab — current lesson should remain rendered.
  // On mobile selectLesson auto-closes the drawer; reopen it so the
  // synthetic click lands on visible (in-flow) geometry.
  if (mobile) await send('Runtime.evaluate', { expression: `document.body.classList.add('sidebar-open')` });
  await new Promise(r => setTimeout(r, 150));
  await send('Runtime.evaluate', {
    expression: `(() => {
      const tabs = [...document.querySelectorAll('.binder-tab')];
      const inactive = tabs.find(t => !t.classList.contains('active'));
      inactive?.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 350));
  console.log('back-on-first:', JSON.stringify(await probe()));
  await snap('04-back-on-first');

  // 5. Type in search to test cross-track search behavior
  await send('Runtime.evaluate', {
    expression: `(() => {
      const inp = document.getElementById('search-input');
      inp.value = 'two sum';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    })()`
  });
  await new Promise(r => setTimeout(r, 350));
  console.log('search-two-sum:', JSON.stringify(await probe()));
  await snap('05-search');

  // Console output
  console.log('console msgs:', consoleMsgs.length);
  for (const m of consoleMsgs.slice(0, 20)) console.log('  [' + m.type + '] ' + m.text);
  const errs = consoleMsgs.filter(m => m.type === 'error' || m.type === 'exception');
  ws.close();
  http.get(`http://localhost:${PORT}/json/close/${tab.id}`, () => {}).on('error', () => {});
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
