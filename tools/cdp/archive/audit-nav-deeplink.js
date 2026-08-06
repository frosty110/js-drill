// audit-nav-deeplink.js — AUDIT PROBE (2026-07-10 navigation audit).
// Cold-boots #/m/<mode> for EVERY -btn id in index.html at a given viewport
// and records what surface (if any) is visibly open after boot dispatch,
// plus console exceptions and native dialogs (auto-dismissed by lib.js).
// Hardened: incremental JSON writes after every mode + a per-mode watchdog
// that recovers with a fresh tab if the page hard-freezes (Bug-Hunt's
// mutation runner can sync-infinite-loop the tab — see audit finding P1).
//   node tools/cdp/audit-nav-deeplink.js <mobile|desktop> <out.json> [skipCsv]

const fs = require('fs');
const http = require('http');
const { ensureServer, ensureChrome, connect } = require('../lib');

const VIEW = process.argv[2] || 'mobile';
const OUT_JSON = process.argv[3] || `/tmp/audit-deeplink-${VIEW}.json`;
const SKIP = (process.argv[4] || '').split(',').filter(Boolean);
const MODE_TIMEOUT_MS = 30000;

const DAY = 86400000;
const now = Date.now();
const SEED = {
  __v: 5, welcomed: true, lastLessonId: 'two-sum', lastTab: 'reference', sidebarTrack: 'patterns',
  progress: {
    'two-sum': { L1: 'passed', L2: 'passed', L3: 'passed' },
    'p-contains-dup': { L1: 'passed' },
    'p-valid-anagram': { L1: 'passed', L2: 'passed', L3: 'passed' },
    's-variables': { L1: 'passed', L2: 'passed', L3: 'passed' },
  },
  reviews: {
    'two-sum': { lastPassedAt: now - 40 * DAY, interval: 7, dueAt: now - 33 * DAY },
    'p-valid-anagram': { lastPassedAt: now - 2 * DAY, interval: 1, dueAt: now - 1 * DAY },
    's-variables': { lastPassedAt: now - 3 * DAY, interval: 1, dueAt: now - 2 * DAY },
  },
  weakness: { 'p-contains-dup': true },
  revealed: { 'p-valid-anagram': { L3: true } },
  history: {
    'two-sum': [{ at: now - DAY, event: 'L1-pass' }, { at: now - 2 * DAY, event: 'L1-pass' }],
    'p-valid-anagram': [{ at: now - DAY, event: 'L3-pass' }],
  },
};

const DETECT = `(() => {
  const openModal = () => {
    const ids = ['help-modal','today-modal','mechanics-modal','cheatsheet-modal','path-modal',
                 'at-risk-modal','heatstrip-modal','audio-modal','cram-ref-modal'];
    for (const id of ids) {
      const m = document.getElementById(id);
      if (m && m.style.display === 'block') return id;
    }
    return null;
  };
  const shell = document.getElementById('lesson-shell');
  const shellFirst = shell && shell.firstElementChild ? (shell.firstElementChild.className || shell.firstElementChild.tagName) : '';
  const dd = document.getElementById('topbar-dropdown');
  return {
    hash: location.hash,
    page: document.querySelector('.today-home-page') ? 'today-home'
      : document.querySelector('.browse-page') ? 'browse'
      : document.querySelector('.progress-page') ? 'progress'
      : document.querySelector('.dashboard-page') ? 'dashboard' : null,
    launcherOpen: !!document.getElementById('practice-launcher')?.classList.contains('is-open'),
    modal: openModal(),
    dropdownOpen: dd ? !dd.classList.contains('hidden') : false,
    paletteOpen: !document.getElementById('palette-overlay')?.classList.contains('hidden'),
    inSession: document.body.classList.contains('in-session'),
    exitAffordance: !!document.querySelector('[data-action^="exit-"]'),
    mockActive: typeof state !== 'undefined' && state.mock ? !!state.mock.active : null,
    currentLessonId: typeof state !== 'undefined' ? state.currentLessonId : null,
    bodyCls: document.body.className,
    shellFirst: String(shellFirst).slice(0, 90),
    shellText: shell ? (shell.textContent || '').trim().slice(0, 70) : '',
  };
})()`;

function closeTabsMatching(substr) {
  return new Promise(res => {
    http.get('http://localhost:9222/json', r => {
      let b = ''; r.on('data', d => b += d);
      r.on('end', () => {
        try {
          const tabs = JSON.parse(b).filter(t => t.type === 'page' && (t.url || '').includes(substr));
          let n = tabs.length;
          if (!n) return res();
          for (const t of tabs) http.get(`http://localhost:9222/json/close/${t.id}`, () => { if (--n === 0) res(); }).on('error', () => { if (--n === 0) res(); });
        } catch (_) { res(); }
      });
    }).on('error', () => res());
  });
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const opts = VIEW === 'mobile'
    ? { mobile: true }
    : { mobile: false, viewport: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false } };

  async function freshSession() {
    const s = await connect({ url: 'http://localhost:8765/', ...opts, waitForLoadMs: 1800 });
    await s.eval(`localStorage.setItem('jsdrill.progress.v1', ${JSON.stringify(JSON.stringify(SEED))})`);
    return s;
  }

  let s = await freshSession();
  const modes = await s.eval(`[...document.querySelectorAll('button[id$="-btn"]')].map(b => b.id.replace(/-btn$/, ''))`);

  const results = {};
  const flush = () => fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));

  for (const mode of modes) {
    if (SKIP.includes(mode)) { results[mode] = { skipped: true }; flush(); continue; }
    const errsBefore = s.consoleMsgs.length;
    const dlgBefore = s.dialogs.length;

    const runOne = (async () => {
      await s.eval(`location.href = location.pathname + '#/m/${mode}'`);
      // Fire the reload on a timeout so this eval RETURNS before the execution
      // context is destroyed (an awaited bare location.reload() can hang).
      await s.eval(`setTimeout(() => location.reload(), 30); true`);
      await s.sleep(2600);
      await s.waitFor(`typeof state !== 'undefined' && typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 8000 });
      await s.sleep(900);
      const det = await s.eval(DETECT);
      det.newConsole = s.consoleMsgs.slice(errsBefore)
        .filter(m => m.type === 'error' || m.type === 'exception')
        .map(m => m.text.slice(0, 160));
      det.dialogs = s.dialogs.slice(dlgBefore).map(d => d.type + ': ' + d.message.slice(0, 120));
      return det;
    })();

    try {
      results[mode] = await Promise.race([
        runOne,
        new Promise((_, rej) => setTimeout(() => rej(new Error('WATCHDOG: page unresponsive (likely sync freeze)')), MODE_TIMEOUT_MS)),
      ]);
    } catch (e) {
      results[mode] = { error: String(e.message).slice(0, 200) };
      // Recover: abandon the (possibly frozen) tab, open a fresh one.
      try { await s.close(); } catch (_) {}
      await closeTabsMatching('localhost:8765');
      s = await freshSession();
    }
    try { await s.eval(`history.replaceState(null,'',location.pathname)`); } catch (_) {}
    flush();
    process.stdout.write(mode + ' ');
  }
  console.log();
  console.log('wrote', OUT_JSON);
  try { await s.close(); } catch (_) {}
})().catch(e => { console.error(e); process.exit(2); });
