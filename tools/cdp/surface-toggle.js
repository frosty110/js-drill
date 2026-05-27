#!/usr/bin/env node
// Phase C probe — Problems⇄Reference surface toggle.
// Verifies: toggle renders (2 segs); default surface = reference shows Syntax
// (binder = 1 tab); switching to Problems shows Patterns+Applied (binder = 2
// tabs); selecting a Problems lesson then flipping Reference→Problems restores
// the remembered lesson (lossless position memory). Reports console errors.
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
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = id++; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); return; }
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error')) errors.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  try { await send('Network.clearBrowserCache'); } catch (_) {}
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

  await send('Page.navigate', { url: baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now() });
  await sleep(800);
  await send('Page.reload', { ignoreCache: true });
  await sleep(2800);

  const snap = `(() => ({
    segs: document.querySelectorAll('.surface-seg').length,
    active: document.querySelector('.surface-seg.active')?.dataset.surface || null,
    binderTabs: document.querySelectorAll('#binder-tabs .binder-tab').length,
    binderLabels: [...document.querySelectorAll('#binder-tabs .binder-tab')].map(t=>t.textContent.replace(/\\d+$/,'').trim()),
    lessons: document.querySelectorAll('#sidebar-nav .lesson-link').length,
    title: document.querySelector('#lesson-title')?.textContent?.trim() || document.querySelector('h2')?.textContent?.trim() || null
  }))()`;

  const results = {};
  results.diag = await ev(`({ hasSetSurface: typeof setSurface, hasInit: typeof initSurfaceToggle, surface: (typeof state!=='undefined'?state.surface:'no-state') })`);
  results.initial = await ev(snap);
  // → Problems
  await ev(`document.querySelector('.surface-seg[data-surface="problems"]').click()`); await sleep(500);
  results.problems = await ev(snap);
  // pick a Problems lesson, remember its title
  await ev(`(document.querySelector('#sidebar-nav .lesson-link')||{click(){}}).click()`); await sleep(500);
  const remembered = await ev(`document.querySelector('#sidebar-nav .lesson-link.active .lesson-label, #sidebar-nav .lesson-link.active')?.textContent?.trim() || null`);
  results.pickedProblemsLesson = remembered;
  // → Reference
  await ev(`document.querySelector('.surface-seg[data-surface="reference"]').click()`); await sleep(500);
  results.reference = await ev(snap);
  // → Problems again — position memory should restore the remembered lesson
  await ev(`document.querySelector('.surface-seg[data-surface="problems"]').click()`); await sleep(500);
  results.backToProblems = await ev(snap);
  results.restoredActiveLesson = await ev(`document.querySelector('#sidebar-nav .lesson-link.active .lesson-label, #sidebar-nav .lesson-link.active')?.textContent?.trim() || null`);

  // Assertions
  const a = [];
  const ok = (name, cond) => a.push((cond ? 'PASS ' : 'FAIL ') + name);
  ok('toggle renders 2 segs', results.initial.segs === 2);
  ok('default surface=reference', results.initial.active === 'reference');
  ok('reference → 1 binder tab (Syntax)', results.initial.binderTabs === 1 && /Syntax/i.test(results.initial.binderLabels.join()));
  ok('problems active after click', results.problems.active === 'problems');
  ok('problems → 2 binder tabs (Patterns+Applied)', results.problems.binderTabs === 2);
  ok('problems shows lessons', results.problems.lessons > 0);
  ok('reference shows lessons', results.reference.active === 'reference' && results.reference.lessons > 0);
  ok('back to problems', results.backToProblems.active === 'problems');
  ok('position memory restored lesson', !!remembered && results.restoredActiveLesson === remembered);
  ok('no console errors', errors.length === 0);

  console.log(JSON.stringify(results, null, 2));
  console.log('\n' + a.join('\n'));
  if (errors.length) console.log('\nERRORS:\n' + errors.join('\n'));
  const failed = a.filter(x => x.startsWith('FAIL'));
  console.log(`\n${a.length - failed.length}/${a.length} assertions passed`);
  ws.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('probe error:', e.message); process.exit(2); });
