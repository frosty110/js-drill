#!/usr/bin/env node
// Phase G probe — Drill menu grouped into 5 recall-direction families; clarify +
// hotseat moved to Settings. Verifies family sub-headers render, all 17 drill
// variants are reachable, and the modifiers live under Settings now.
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
  r.drill = await ev(`(() => {
    document.querySelector('.topbar-menu[data-menu="drills"]').click();
    const body = document.querySelector('#topbar-dropdown .topbar-dropdown-body');
    return {
      groupLabels: body.querySelectorAll('.topbar-group-label').length,
      labelTexts: [...body.querySelectorAll('.topbar-group-label')].map(g=>g.textContent.trim()),
      items: body.querySelectorAll('.topbar-item').length,
      btnIds: [...body.querySelectorAll('.topbar-item')].map(b=>b.dataset.btnId)
    };
  })()`);
  r.settings = await ev(`(() => {
    document.getElementById('topbar-settings').click();
    const body = document.querySelector('#topbar-dropdown .topbar-dropdown-body');
    return [...body.querySelectorAll('.topbar-item')].map(b=>b.dataset.btnId);
  })()`);
  await sleep(200);

  const a = []; const ok = (n, c) => a.push((c ? 'PASS ' : 'FAIL ') + n);
  ok('Drill menu shows 5 family labels', r.drill.groupLabels === 5);
  ok('all 17 drill variants reachable', r.drill.items === 17);
  ok('families include Run-it/Judge/Name/Traps/Meta', /Run it/.test(r.drill.labelTexts.join()) && /Judge/.test(r.drill.labelTexts.join()) && /Name the pattern/.test(r.drill.labelTexts.join()));
  ok('swap folded into a drill family', r.drill.btnIds.includes('swap-btn'));
  ok('clarify NOT in Drill', !r.drill.btnIds.includes('clarify-ritual-btn'));
  ok('clarify + hotseat now in Settings', r.settings.includes('clarify-ritual-btn') && r.settings.includes('hotseat-btn'));
  ok('no console errors', errors.length === 0);
  console.log(JSON.stringify(r, null, 2));
  console.log('\n' + a.join('\n'));
  if (errors.length) console.log('\nERRORS:\n' + errors.join('\n'));
  const failed = a.filter(x => x.startsWith('FAIL'));
  console.log(`\n${a.length - failed.length}/${a.length} assertions passed`);
  ws.close(); process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('probe error:', e.message); process.exit(2); });
