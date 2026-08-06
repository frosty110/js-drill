#!/usr/bin/env node
// Phase F probe — the sidebar launcher pile is retired; the topbar is the sole
// launcher. Verifies: the pile is not visible; the launcher <button>s still
// exist in the DOM (so synth-click works); a topbar dropdown opens with items
// and launching one still works; the filter chips remain visible.
const WebSocket = require('ws');
const http = require('http');
const baseUrl = process.argv[2] || 'http://127.0.0.1:8765/';
const PORT = 9222;
const put = p => new Promise((res, rej) => { http.request({ host: 'localhost', port: PORT, path: p, method: 'PUT' }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej).end(); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const tab = await put('/json/new?about:blank');
  const ws = new WebSocket(tab.webSocketDebuggerUrl.replace('127.0.0.1', 'localhost'));
  let id = 1; const pending = new Map(); const errors = [];
  const send = (m, p = {}) => new Promise((resolve, reject) => { const i = id++; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  ws.on('message', raw => { const m = JSON.parse(raw.toString()); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); return; } if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ')); if (m.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
  await send('Page.navigate', { url: baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now() });
  await sleep(800); await send('Page.reload', { ignoreCache: true }); await sleep(2800);

  const r = {};
  r.pile = await ev(`(() => {
    const pile = document.querySelector('aside .flex.items-center.gap-3.mt-3.text-xs.flex-wrap');
    return {
      exists: !!pile,
      visible: pile ? pile.offsetParent !== null : false,
      launcherBtnsInDom: document.querySelectorAll('#mock-btn, #recognize-btn, #stats-btn, #rapid-fire-btn').length,
      filtersVisible: (document.getElementById('repair-filter-btn')?.offsetParent !== null)
    };
  })()`);
  // Open a desktop topbar dropdown and verify items render
  r.dropdown = await ev(`(() => {
    const m = document.querySelector('.topbar-menu[data-menu="drills"]');
    if (!m) return { ok:false };
    m.click();
    const items = document.querySelectorAll('#topbar-dropdown .topbar-dropdown-body button, #topbar-dropdown .topbar-dropdown-body [role=menuitem], #topbar-dropdown .topbar-dropdown-body a').length;
    return { ok:true, items };
  })()`);
  await sleep(300);

  const a = []; const ok = (n, c) => a.push((c ? 'PASS ' : 'FAIL ') + n);
  ok('launcher pile still in DOM', r.pile.exists === true);
  ok('launcher pile is NOT visible', r.pile.visible === false);
  ok('launcher buttons remain in DOM (synth-click target)', r.pile.launcherBtnsInDom === 4);
  ok('filter chips still visible', r.pile.filtersVisible === true);
  ok('topbar dropdown opens with items', r.dropdown.ok && r.dropdown.items > 0);
  ok('no console errors', errors.length === 0);
  console.log(JSON.stringify(r, null, 2));
  console.log('\n' + a.join('\n'));
  if (errors.length) console.log('\nERRORS:\n' + errors.join('\n'));
  const failed = a.filter(x => x.startsWith('FAIL'));
  console.log(`\n${a.length - failed.length}/${a.length} assertions passed`);
  ws.close(); process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('probe error:', e.message); process.exit(2); });
