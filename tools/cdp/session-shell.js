#!/usr/bin/env node
// Phase H probe — full-bleed Session shell. Verifies the MutationObserver toggles
// body.in-session (hiding topbar + sidebar) when a session shell with an
// [data-action^="exit-"] affordance is present, and restores chrome when it's
// gone. Also launches a real drill (Recognize) as a live check.
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
  // Deterministic: inject a session shell with an exit affordance.
  await ev(`document.getElementById('lesson-shell').innerHTML = '<div class="recognize-shell"><button data-action="exit-test">✕ Exit</button>session</div>'`);
  await sleep(350);
  r.inSession = await ev(`(() => ({
    bodyInSession: document.body.classList.contains('in-session'),
    topbarHidden: document.getElementById('topbar').offsetParent === null,
    sidebarHidden: document.querySelector('aside.app-sidebar').offsetParent === null
  }))()`);
  // Restore a non-session render → chrome should come back.
  await ev(`document.getElementById('lesson-shell').innerHTML = '<div class="lesson-tabs">normal lesson</div>'`);
  await sleep(350);
  r.afterExit = await ev(`(() => ({
    bodyInSession: document.body.classList.contains('in-session'),
    topbarVisible: document.getElementById('topbar').offsetParent !== null
  }))()`);
  // Live: launch a real drill (Recognize) and see if it goes full-bleed.
  r.liveDrill = await ev(`(() => { try { document.getElementById('recognize-btn').click(); } catch(e) { return 'err:'+e.message; } return 'clicked'; })()`);
  await sleep(900);
  r.liveInSession = await ev(`document.body.classList.contains('in-session')`);

  const a = []; const ok = (n, c) => a.push((c ? 'PASS ' : 'FAIL ') + n);
  ok('session render adds body.in-session', r.inSession.bodyInSession === true);
  ok('topbar hidden in session', r.inSession.topbarHidden === true);
  ok('sidebar hidden in session', r.inSession.sidebarHidden === true);
  ok('exit restores body (no in-session)', r.afterExit.bodyInSession === false);
  ok('topbar visible after exit', r.afterExit.topbarVisible === true);
  ok('live drill (Recognize) goes full-bleed', r.liveInSession === true);
  ok('no console errors', errors.length === 0);
  console.log(JSON.stringify(r, null, 2));
  console.log('\n' + a.join('\n'));
  if (errors.length) console.log('\nERRORS:\n' + errors.join('\n'));
  const failed = a.filter(x => x.startsWith('FAIL'));
  console.log(`\n${a.length - failed.length}/${a.length} assertions passed`);
  ws.close(); process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('probe error:', e.message); process.exit(2); });
