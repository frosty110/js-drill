const { ensureServer, ensureChrome, connect } = require('./lib');
(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: 'http://localhost:8765/', mobile: true, viewport: { width: 390, height: 844 }, outDir: '/tmp/crux-shots' });
  await s.evalAwait(`(async () => {
    if (navigator.serviceWorker) { const r = await navigator.serviceWorker.getRegistrations(); await Promise.all(r.map(x => x.unregister())); }
    if (self.caches) { const k = await caches.keys(); await Promise.all(k.map(x => caches.delete(x))); }
  })()`);
  await s.reload();
  await s.waitFor(`typeof startCruxSession === 'function'`);
  await s.evalAwait(`startCruxSession()`);
  await s.waitFor(`document.querySelectorAll('.crux-mode-btn').length === 2`);
  await s.snap('mode-picker');
  await s.eval(`document.querySelector('.crux-mode-btn[data-mode="easy"]').click()`);
  await s.waitFor(`document.querySelectorAll('.crux-opt').length === 4`);
  await s.snap('easy-card');
  await s.eval(`document.querySelector('.crux-opt').click()`);
  await new Promise(r => setTimeout(r, 200));
  await s.snap('easy-revealed');
  await s.evalAwait(`startCruxSession()`);
  await s.waitFor(`document.querySelectorAll('.crux-mode-btn').length === 2`);
  await s.eval(`document.querySelector('.crux-mode-btn[data-mode="hard"]').click()`);
  await s.waitFor(`document.querySelector('.crux-textarea')`);
  await s.eval(`document.querySelector('.crux-textarea').value = 'Two pointers from both ends, move the shorter wall inward.';`);
  await s.snap('hard-card');
  await s.eval(`document.querySelector('[data-action="crux-reveal"]').click()`);
  await new Promise(r => setTimeout(r, 200));
  await s.snap('hard-revealed');
  await s.close();
  console.log('shots written to /tmp/crux-shots');
})().catch(e=>{console.error(e);process.exit(2)});
