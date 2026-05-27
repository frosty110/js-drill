#!/usr/bin/env node
// Phase E probe — inline Repair icons + 🛠 Repair filter.
// Seeds a weak-spot on the first visible lesson, then verifies: an inline repair
// icon appears, the Repair chip count reflects it, and toggling the filter
// narrows the list to repair items (and back).
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
  r.chipExists = await ev(`!!document.getElementById('repair-filter-btn')`);
  // Seed a weak-spot on the first visible lesson, re-render.
  r.seeded = await ev(`(() => {
    const first = document.querySelector('#sidebar-nav .lesson-link');
    const lid = first?.getAttribute('data-lesson-id');
    if (!lid) return null;
    state.weakness[lid] = 2; saveProgress(); renderSidebar();
    return lid;
  })()`);
  await sleep(300);
  r.afterSeed = await ev(`(() => ({
    repairIcons: document.querySelectorAll('#sidebar-nav .lesson-repair').length,
    chipCount: parseInt(document.getElementById('repair-filter-count').textContent, 10),
    totalLessons: document.querySelectorAll('#sidebar-nav .lesson-link').length
  }))()`);
  // Turn ON the Repair filter
  await ev(`document.getElementById('repair-filter-btn').click()`); await sleep(400);
  r.filtered = await ev(`(() => ({
    active: document.getElementById('repair-filter-btn').classList.contains('text-rose-300'),
    lessons: document.querySelectorAll('#sidebar-nav .lesson-link').length,
    allHaveIcon: [...document.querySelectorAll('#sidebar-nav .lesson-link')].every(l => l.querySelector('.lesson-repair'))
  }))()`);
  // Turn OFF
  await ev(`document.getElementById('repair-filter-btn').click()`); await sleep(400);
  r.unfiltered = await ev(`document.querySelectorAll('#sidebar-nav .lesson-link').length`);

  const a = []; const ok = (n, c) => a.push((c ? 'PASS ' : 'FAIL ') + n);
  ok('🛠 Repair chip exists', r.chipExists === true);
  ok('seeded a weak-spot lesson', !!r.seeded);
  ok('inline repair icon appears', r.afterSeed.repairIcons >= 1);
  ok('chip count >= 1', r.afterSeed.chipCount >= 1);
  ok('filter ON narrows list', r.filtered.lessons >= 1 && r.filtered.lessons <= r.afterSeed.totalLessons);
  ok('filter ON: every shown lesson has a repair icon', r.filtered.allHaveIcon);
  ok('filter active class painted', r.filtered.active === true);
  ok('filter OFF restores full list', r.unfiltered > r.filtered.lessons);
  ok('no console errors', errors.length === 0);
  console.log(JSON.stringify(r, null, 2));
  console.log('\n' + a.join('\n'));
  if (errors.length) console.log('\nERRORS:\n' + errors.join('\n'));
  const failed = a.filter(x => x.startsWith('FAIL'));
  console.log(`\n${a.length - failed.length}/${a.length} assertions passed`);
  ws.close(); process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('probe error:', e.message); process.exit(2); });
