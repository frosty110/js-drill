#!/usr/bin/env node
// Phase D probe — full-page Plan home (📋 Plan topbar link).
// Verifies: the Plan link renders; clicking it shows the plan home (progress bar
// + Continue CTA + quick-start buttons); Continue navigates into a lesson.
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
  r.planLinkExists = await ev(`!!document.getElementById('topbar-plan')`);
  await ev(`document.getElementById('topbar-plan').click()`); await sleep(600);
  r.home = await ev(`(() => {
    const s = document.getElementById('lesson-shell');
    return {
      hasProgressBar: !!s.querySelector('div[style*="linear-gradient"]'),
      hasContinue: !!s.querySelector('[data-plan-continue]'),
      continueText: s.querySelector('[data-plan-continue]')?.textContent?.trim() || null,
      quickStarts: s.querySelectorAll('[data-plan-q]').length,
      heading: s.querySelector('h1')?.textContent?.trim() || null
    };
  })()`);
  // Continue → should navigate into a lesson
  await ev(`document.querySelector('#lesson-shell [data-plan-continue]')?.click()`); await sleep(700);
  r.afterContinue = await ev(`(() => ({ tabs: document.querySelectorAll('.lesson-tab, [role=tab]').length, hasEditorOrTabs: !!document.querySelector('#lesson-shell') && /Reference|L1|L2|L3|Concept|Drill/.test(document.getElementById('lesson-shell').textContent) }))()`);

  const a = []; const ok = (n, c) => a.push((c ? 'PASS ' : 'FAIL ') + n);
  ok('📋 Plan link exists', r.planLinkExists === true);
  ok('plan home shows progress bar', r.home.hasProgressBar);
  ok('plan home shows Continue CTA', r.home.hasContinue);
  ok('plan home shows 4 quick-starts', r.home.quickStarts === 4);
  ok('Continue navigates into a lesson', r.afterContinue.hasEditorOrTabs);
  ok('no console errors', errors.length === 0);
  console.log(JSON.stringify(r, null, 2));
  console.log('\n' + a.join('\n'));
  if (errors.length) console.log('\nERRORS:\n' + errors.join('\n'));
  const failed = a.filter(x => x.startsWith('FAIL'));
  console.log(`\n${a.length - failed.length}/${a.length} assertions passed`);
  ws.close(); process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('probe error:', e.message); process.exit(2); });
