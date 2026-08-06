#!/usr/bin/env node
// iter 145 — verifies the PWA install surface (Cat 5; closes ideas-by-
// category.md § Cat 5 → "PWA install + offline drilling" iter-93
// promotion shortlist #4; iter-113 shipped the SW cache half, iter-145
// ships the manifest + icons + install-prompt UX).
//
// The browser's actual install criteria (beforeinstallprompt firing)
// depend on engagement heuristics CDP can't simulate end-to-end. The
// probe verifies the STRUCTURAL invariants — manifest is fetchable +
// well-formed, link/meta tags are present, install button is hidden
// by default, and a synthetic beforeinstallprompt event correctly
// unhides the button + wires the prompt() call. Real-device install
// is validated manually post-deploy.

const { ensureServer, ensureChrome, connect } = require('../lib');

const URL = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/jsdrill-pwa-install';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({ url: URL, mobile: true, outDir: OUT });

  await s.evalAwait(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
    __v: 6, welcomed: true,
    progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
    starterPath: false, starterPathTrack: 'all', hideMastered: false,
    reviews: {}, weakness: {}, history: {}, misses: {},
    sidebarTrack: 'patterns', lastLessonId: null, lastTab: null
  }))`);
  await s.reload();
  await s.sleep(700);
  await s.snap('01-init');

  // Phase 1: <link rel="manifest"> + meta tags present in <head>.
  const phase1 = await s.evalAwait(`(() => ({
    manifestLink: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    appleCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content'),
    appleTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content'),
    appleTouchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
    svgIcon: document.querySelector('link[rel="icon"][type="image/svg+xml"]')?.getAttribute('href'),
  }))()`);
  s.assert(phase1.manifestLink === 'manifest.webmanifest', `<link rel="manifest"> href = "manifest.webmanifest"; got "${phase1.manifestLink}"`);
  s.assert(phase1.themeColor && /^#[0-9a-f]{6}$/i.test(phase1.themeColor), `theme-color meta is a 6-digit hex; got "${phase1.themeColor}"`);
  s.assert(phase1.appleCapable === 'yes', `apple-mobile-web-app-capable = "yes"; got "${phase1.appleCapable}"`);
  s.assert(phase1.appleTitle && phase1.appleTitle.length > 0, `apple-mobile-web-app-title is set; got "${phase1.appleTitle}"`);
  s.assert(phase1.svgIcon === 'icon.svg', `SVG icon <link rel="icon"> href = "icon.svg"; got "${phase1.svgIcon}"`);
  s.assert(phase1.appleTouchIcon, `<link rel="apple-touch-icon"> present (SVG fallback); got "${phase1.appleTouchIcon}"`);

  // Phase 2: manifest.webmanifest is fetchable + well-formed JSON with
  // required PWA fields per the W3C Web App Manifest spec.
  const phase2 = await s.evalAwait(`(async () => {
    try {
      const res = await fetch('manifest.webmanifest');
      if (!res.ok) return { ok: false, status: res.status };
      const m = await res.json();
      return {
        ok: true,
        hasName: typeof m.name === 'string' && m.name.length > 0,
        hasShortName: typeof m.short_name === 'string' && m.short_name.length > 0,
        hasStartUrl: typeof m.start_url === 'string',
        hasDisplay: m.display === 'standalone',
        hasThemeColor: typeof m.theme_color === 'string',
        hasBgColor: typeof m.background_color === 'string',
        iconCount: Array.isArray(m.icons) ? m.icons.length : 0,
        iconsHaveSrc: Array.isArray(m.icons) && m.icons.every(i => typeof i.src === 'string'),
        hasMaskable: Array.isArray(m.icons) && m.icons.some(i => i.purpose && i.purpose.includes('maskable')),
      };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  })()`);
  s.assert(phase2.ok, `manifest.webmanifest is fetchable + valid JSON; got ${JSON.stringify(phase2)}`);
  s.assert(phase2.hasName, 'manifest.name is a non-empty string');
  s.assert(phase2.hasShortName, 'manifest.short_name is a non-empty string');
  s.assert(phase2.hasStartUrl, 'manifest.start_url is a string');
  s.assert(phase2.hasDisplay, 'manifest.display === "standalone"');
  s.assert(phase2.hasThemeColor, 'manifest.theme_color is a string');
  s.assert(phase2.hasBgColor, 'manifest.background_color is a string');
  s.assert(phase2.iconCount >= 1, `manifest.icons has at least one entry; got ${phase2.iconCount}`);
  s.assert(phase2.iconsHaveSrc, 'every manifest.icons entry has a `src`');
  s.assert(phase2.hasMaskable, 'manifest.icons includes a maskable variant (proper home-screen render on Android)');

  // Phase 3: icon.svg fetchable + valid SVG.
  const phase3 = await s.evalAwait(`(async () => {
    try {
      const res = await fetch('icon.svg');
      if (!res.ok) return { ok: false, status: res.status };
      const t = await res.text();
      return {
        ok: true,
        isSvg: t.trim().startsWith('<svg'),
        hasViewBox: /viewBox=/.test(t),
        len: t.length,
      };
    } catch (e) { return { ok: false, error: String(e) }; }
  })()`);
  s.assert(phase3.ok, 'icon.svg is fetchable');
  s.assert(phase3.isSvg, 'icon.svg starts with <svg');
  s.assert(phase3.hasViewBox, 'icon.svg has a viewBox attribute (scales on home screens)');

  // Phase 4: install button mounted; HTML-attribute default is .hidden
  // (the SHIPPED markup hides it). In a Chrome browser with a valid
  // manifest + service worker context, beforeinstallprompt fires almost
  // immediately on load and the button unhides — that's correct behavior.
  // The invariant we want to verify is the SHIPPED default (".hidden" in
  // the HTML attribute), so we fetch the raw HTML rather than reading the
  // runtime DOM state. iOS Safari and browsers without PWA install
  // heuristics never fire the event; the button stays hidden in those.
  const phase4 = await s.evalAwait(`(async () => {
    const btn = document.getElementById('install-btn');
    let htmlAttrHasHidden = false;
    try {
      const res = await fetch('index.html');
      const text = await res.text();
      // Look for the install-btn HTML attribute class list — it must contain
      // "hidden" as a baseline so browsers that don't fire the event still
      // see no broken affordance.
      const m = text.match(/<button[^>]*id="install-btn"[^>]*>/);
      htmlAttrHasHidden = m ? /class="[^"]*\\bhidden\\b[^"]*"/.test(m[0]) : false;
    } catch (_) {}
    return {
      present: !!btn,
      htmlAttrHasHidden,
      label: btn ? btn.textContent.trim() : '',
    };
  })()`);
  s.assert(phase4.present, '#install-btn mounted in DOM');
  s.assert(phase4.htmlAttrHasHidden, 'Install button HTML-attribute default has .hidden class (shipped-markup default = hidden — iOS Safari + non-PWA browsers see no broken affordance)');
  s.assert(/install/i.test(phase4.label), `Label says Install; got "${phase4.label}"`);
  await s.snap('02-install-hidden');

  // Phase 5: fire a synthetic beforeinstallprompt event → button unhides
  // + deferred prompt is stashed. The browser's BeforeInstallPromptEvent
  // constructor isn't available, so we fake it via a plain Event with the
  // required surface (preventDefault + prompt + userChoice).
  await s.evalAwait(`(() => {
    let promptCalled = false;
    const fake = new Event('beforeinstallprompt');
    fake.preventDefault = function() { /* match the real event surface */ };
    fake.prompt = function() {
      promptCalled = true;
      return Promise.resolve();
    };
    fake.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    window.__pwaInstallTest = { promptCalled: () => promptCalled };
    window.dispatchEvent(fake);
  })()`);
  await s.sleep(300);
  const phase5 = await s.evalAwait(`(() => {
    const btn = document.getElementById('install-btn');
    return {
      hiddenAfterEvent: btn ? btn.classList.contains('hidden') : true,
      labelStillInstall: btn ? /install/i.test(btn.textContent) : false,
    };
  })()`);
  s.assert(!phase5.hiddenAfterEvent, 'Install button UNHIDDEN after beforeinstallprompt fires');
  s.assert(phase5.labelStillInstall, 'Label still says Install after unhide');
  await s.snap('03-install-shown');

  // Phase 6: tap the install button → deferred prompt's .prompt() is
  // called; button re-hides afterward.
  await s.evalAwait(`document.getElementById('install-btn').click()`);
  await s.sleep(400);
  const phase6 = await s.evalAwait(`(() => ({
    promptCalled: window.__pwaInstallTest?.promptCalled(),
    hiddenAfterClick: document.getElementById('install-btn')?.classList.contains('hidden'),
  }))()`);
  s.assert(phase6.promptCalled, 'Clicking #install-btn calls the deferred event.prompt()');
  s.assert(phase6.hiddenAfterClick, 'Install button re-hidden after prompt outcome');
  await s.snap('04-install-after-click');

  // Phase 7: appinstalled event also re-hides the button (belt + suspenders
  // path for users who install via desktop browser address-bar install icon).
  // First, re-show the button via another synthetic beforeinstallprompt.
  await s.evalAwait(`(() => {
    const fake = new Event('beforeinstallprompt');
    fake.preventDefault = function() {};
    fake.prompt = function() { return Promise.resolve(); };
    fake.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    window.dispatchEvent(fake);
  })()`);
  await s.sleep(200);
  const reShown = await s.evalAwait(`!document.getElementById('install-btn').classList.contains('hidden')`);
  s.assert(reShown, 'Button re-shown after a second beforeinstallprompt');
  await s.evalAwait(`window.dispatchEvent(new Event('appinstalled'))`);
  await s.sleep(200);
  const phase7 = await s.evalAwait(`document.getElementById('install-btn').classList.contains('hidden')`);
  s.assert(phase7, 'Install button re-hidden after appinstalled event (covers desktop browser address-bar install path)');

  await s.close();
  const r = s.report();
  process.exit(r.failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
