// Smoke test for the optional cross-device sync layer (js/sync.js).
//
// What it verifies on each of the three pages (index, prep, diagnostic):
//   1. The Supabase SDK loads from the CDN (window.supabase exists).
//   2. js/supabase-client.js initializes the client (window.SupabaseClient).
//   3. js/sync.js exposes window.DrillSync and DrillSync.init() runs.
//   4. The fixed top-right Sync chip mounts in the DOM.
//   5. No console errors related to sync, auth, or Supabase.
//
// On the main page it also opens the modal to confirm the sign-in UI renders.
//
// Run: node tools/cdp/sync-smoke.js  (assumes server on :8765, Chrome on :9222)

const { ensureServer, ensureChrome, connect } = require('../lib');

async function checkPage(s, label) {
  await s.waitFor(`typeof window.supabase === 'object' && typeof window.supabase.createClient === 'function'`);
  s.assert(true, `${label}: Supabase SDK loaded from CDN`);

  await s.waitFor(`window.SupabaseClient && typeof window.SupabaseClient.auth === 'object'`);
  s.assert(true, `${label}: SupabaseClient initialized`);

  await s.waitFor(`window.DrillSync && typeof window.DrillSync.signInWithOtp === 'function'`);
  s.assert(true, `${label}: DrillSync API present`);

  const chipExists = await s.eval(`!!document.getElementById('sync-chip')`);
  s.assert(chipExists, `${label}: Sync chip mounted in DOM`);

  const chipLabel = await s.eval(`document.querySelector('#sync-chip .label')?.textContent`);
  s.assert(chipLabel === 'Sync', `${label}: chip label says "Sync" when signed out (got "${chipLabel}")`);

  const user = await s.eval(`window.DrillSync.getCurrentUser()`);
  s.assert(user === null || user === undefined, `${label}: starts signed out`);
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // --- index.html ---
  const home = await connect({
    url: 'http://localhost:8765/',
    outDir: '/tmp/sync-smoke'
  });
  await checkPage(home, 'index');

  // Open the modal and verify the signed-out view renders.
  await home.click('#sync-chip');
  await home.sleep(150);
  const modalOpen = await home.eval(`document.getElementById('sync-modal').classList.contains('is-open')`);
  home.assert(modalOpen, 'index: clicking chip opens modal');
  const emailVisible = await home.eval(`!!document.getElementById('sync-email') && document.getElementById('sync-email').offsetParent !== null`);
  home.assert(emailVisible, 'index: signed-out view shows email input');
  await home.snap('home-modal-open');
  home.report();
  await home.close();

  // --- diagnostic.html ---
  const diag = await connect({
    url: 'http://localhost:8765/diagnostic.html',
    outDir: '/tmp/sync-smoke'
  });
  await checkPage(diag, 'diagnostic');
  await diag.snap('diag-chip');
  diag.report();
  await diag.close();

  const allFailed = [home, diag].reduce((acc, s) =>
    acc + s.assertions.filter(a => !a.ok).length, 0);
  process.exit(allFailed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
