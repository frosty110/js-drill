#!/usr/bin/env node
// Probes the L2 mobile tap-to-fill experience: chip rendering, sheet open,
// input → chip live-update, Next, Done, Reveal, and Check.
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

const base = process.argv[2];
const outDir = process.argv[3] || '/tmp/jsdrill-l2-mobile';
if (!base) { console.error('usage: l2-mobile-check.js <url> [outDir]'); process.exit(2); }
const PORT = 9222;

function getJson(p) {
  return new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${PORT}${p}`, r => {
      let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}
function putReq(p) {
  return new Promise((res, rej) => {
    http.request({ host: '127.0.0.1', port: PORT, path: p, method: 'PUT' }, r => {
      let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej).end();
  });
}
async function closeHostTabs(host) {
  const list = await getJson('/json/list').catch(() => []);
  for (const t of list) {
    if (t.url && t.url.includes(host)) await new Promise(r => http.get(`http://127.0.0.1:${PORT}/json/close/${t.id}`, () => r()).on('error', () => r()));
  }
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  await closeHostTabs(new URL(base).host);
  const tab = await putReq('/json/new?about:blank');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 1; const pending = new Map();
  const consoleMsgs = [];
  function send(method, params = {}) {
    return new Promise((res, rej) => { const i = id++; pending.set(i, [res, rej]); ws.send(JSON.stringify({id:i,method,params})); });
  }
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) {
      const [res, rej] = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
      return;
    }
    if (m.method === 'Runtime.consoleAPICalled') consoleMsgs.push({ type: m.params.type, text: m.params.args.map(a => a.value ?? a.description ?? '').join(' ') });
    else if (m.method === 'Runtime.exceptionThrown') consoleMsgs.push({ type: 'exception', text: m.params.exceptionDetails.text });
  });

  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: base });
  await new Promise(r => setTimeout(r, 2000));
  await send('Runtime.evaluate', { expression: `localStorage.clear(); location.reload();` });
  // Wait until init() has rendered the tab strip — Pages can be slower than
  // local for the initial manifest + lesson fetch, so a fixed sleep races.
  for (let i = 0; i < 40; i++) {
    const r = await send('Runtime.evaluate', {
      expression: `document.querySelectorAll('.tab-btn').length > 0`, returnByValue: true
    });
    if (r.result.value) break;
    await new Promise(r => setTimeout(r, 200));
  }

  async function snap(label) {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${outDir}/${label}.png`, Buffer.from(s.data, 'base64'));
  }
  async function evalJson(expr) {
    const r = await send('Runtime.evaluate', { expression: `JSON.stringify((() => { ${expr} })())`, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return JSON.parse(r.result.value);
  }

  // Navigate to the first lesson's L2 tab
  await send('Runtime.evaluate', { expression: `document.body.classList.add('sidebar-open')` });
  await new Promise(r => setTimeout(r, 200));
  await send('Runtime.evaluate', { expression: `[...document.querySelectorAll('.tab-btn')].find(b => /Fill-in/.test(b.textContent))?.click()` });
  await new Promise(r => setTimeout(r, 500));
  // Close drawer so we see the L2 view
  await send('Runtime.evaluate', { expression: `document.body.classList.remove('sidebar-open')` });
  await new Promise(r => setTimeout(r, 300));
  await snap('01-l2-mobile-initial');

  const initial = await evalJson(`
    const chips = document.querySelectorAll('.blank-chip');
    const sheet = document.querySelector('.l2-sheet');
    return {
      chipCount: chips.length,
      sheetExists: !!sheet,
      sheetOpen: sheet?.classList.contains('open'),
      bodyHasL2Mobile: document.body.classList.contains('l2-mobile-active'),
      firstChipLabel: chips[0]?.getAttribute('aria-label'),
    };
  `);
  console.log('initial:', JSON.stringify(initial));

  // Tap the first chip
  await send('Runtime.evaluate', { expression: `document.querySelectorAll('.blank-chip')[0]?.click()` });
  await new Promise(r => setTimeout(r, 400));
  const afterTap = await evalJson(`
    const sheet = document.querySelector('.l2-sheet');
    return {
      sheetOpen: sheet.classList.contains('open'),
      label: sheet.querySelector('[data-sheet-label]').textContent,
      hint: sheet.querySelector('[data-sheet-hint]').textContent,
      inputValue: sheet.querySelector('[data-sheet-input]').value,
      activeChips: document.querySelectorAll('.blank-chip.active').length,
    };
  `);
  console.log('after-tap:', JSON.stringify(afterTap));
  await snap('02-sheet-open');

  // Type into the input — set value and dispatch input event
  await send('Runtime.evaluate', { expression: `
    (function(){
      const inp = document.querySelector('.l2-sheet [data-sheet-input]');
      inp.value = 'for';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    })();
  ` });
  await new Promise(r => setTimeout(r, 150));
  const afterType = await evalJson(`
    const chip = document.querySelector('.blank-chip.active');
    return {
      chipShowsValue: chip?.querySelector('.chip-value')?.textContent,
      chipHasValueClass: chip?.classList.contains('has-value'),
    };
  `);
  console.log('after-type:', JSON.stringify(afterType));
  await snap('03-after-type');

  // Hit Next
  await send('Runtime.evaluate', { expression: `document.querySelector('.l2-sheet [data-sheet-next]')?.click()` });
  await new Promise(r => setTimeout(r, 250));
  const afterNext = await evalJson(`
    const sheet = document.querySelector('.l2-sheet');
    const active = document.querySelectorAll('.blank-chip.active');
    return {
      label: sheet.querySelector('[data-sheet-label]').textContent,
      activeCount: active.length,
      activeChipIdx: active[0]?.getAttribute('data-bi'),
    };
  `);
  console.log('after-next:', JSON.stringify(afterNext));

  // Hit Reveal answers on the first exercise (auto-fills all blanks)
  await send('Runtime.evaluate', { expression: `document.querySelector('[data-action="reveal"]')?.click()` });
  await new Promise(r => setTimeout(r, 250));
  const afterReveal = await evalJson(`
    const filled = [...document.querySelectorAll('.blank-chip')].slice(0, 2).map(c => ({
      v: c.querySelector('.chip-value')?.textContent,
      correct: c.classList.contains('correct'),
    }));
    return { filled };
  `);
  console.log('after-reveal:', JSON.stringify(afterReveal));
  await snap('04-after-reveal');

  // Hit Check
  await send('Runtime.evaluate', { expression: `document.querySelector('[data-action="check"]')?.click()` });
  await new Promise(r => setTimeout(r, 800));
  const afterCheck = await evalJson(`
    return {
      feedback: document.querySelector('.feedback')?.textContent,
      outputShown: !document.querySelector('.output-wrap')?.classList.contains('hidden'),
      outputText: document.querySelector('[data-output]')?.textContent,
    };
  `);
  console.log('after-check:', JSON.stringify(afterCheck));
  await snap('05-after-check');

  // Tab to L3 — should remove the l2-mobile-active class
  await send('Runtime.evaluate', { expression: `[...document.querySelectorAll('.tab-btn')].find(b => /Drill/.test(b.textContent))?.click()` });
  await new Promise(r => setTimeout(r, 400));
  const afterLeave = await evalJson(`
    return {
      bodyHasL2Mobile: document.body.classList.contains('l2-mobile-active'),
      sheetExists: !!document.querySelector('.l2-sheet'),
    };
  `);
  console.log('after-leave:', JSON.stringify(afterLeave));

  console.log('console msgs:', consoleMsgs.length);
  for (const m of consoleMsgs.slice(0, 10)) console.log('  [' + m.type + '] ' + m.text);
  const errs = consoleMsgs.filter(m => m.type === 'error' || m.type === 'exception');
  ws.close();
  await new Promise(r => http.get(`http://127.0.0.1:${PORT}/json/close/${tab.id}`, () => r()).on('error', () => r()));
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
