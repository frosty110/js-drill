// One-shot inspector: navigate to the trapping-rain Conversation tab,
// expand section 1, capture DOM + screenshot. No assertions — diagnostic.
const { ensureServer, ensureChrome, connect } = require('../lib');

const URL_BASE = process.argv[2] || 'http://localhost:8765/';
const OUT_DIR  = process.argv[3] || '/tmp/jsdrill-inspect-trapping';

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  for (const mobile of [false, true]) {
    const label = mobile ? 'mobile' : 'desktop';
    const cb = Date.now();
    const s = await connect({
      url: URL_BASE + '?t=' + cb + '#/p-trapping-rain/conversation',
      mobile,
      viewport: mobile ? undefined : { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
      outDir: OUT_DIR,
      waitForLoadMs: 2800,
    });

    // Dismiss welcome banner if first-time
    await s.eval(`(() => {
      const seeded = { __v: 6, welcomed: true, lastLessonId: 'p-trapping-rain', lastTab: 'conversation', progress: {}, reviews: {}, history: {}, weakness: {}, revealed: {} };
      localStorage.setItem('jsdrill.progress.v1', JSON.stringify(seeded));
    })()`);
    await s.reload();
    await s.sleep(1200);

    // Ensure we're on Conversation tab + the lesson
    const tabState = await s.eval(`(() => {
      const lid = (typeof state !== 'undefined' && state.lastLessonId) || null;
      const activeTab = document.querySelector('.tab-btn.active')?.textContent?.trim() || null;
      const convSections = Array.from(document.querySelectorAll('.conv-section, [data-conv-section], details')).slice(0,8).map(el => ({
        tag: el.tagName,
        cls: el.className.slice(0, 60),
        open: el.tagName === 'DETAILS' ? el.hasAttribute('open') : null,
        title: (el.querySelector('summary')?.textContent || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60)
      }));
      return { lid, activeTab, convSections };
    })()`);
    console.log(`[${label}] tab state:`, JSON.stringify(tabState, null, 2));

    // Try to click into Conversation tab if not active
    const clicked = await s.eval(`(() => {
      const tabs = Array.from(document.querySelectorAll('.tab-btn'));
      const conv = tabs.find(t => /conversation/i.test(t.textContent || ''));
      if (conv) { conv.click(); return true; }
      return false;
    })()`);
    if (clicked) {
      await s.sleep(600);
    }

    // Expand the first conversation section
    await s.eval(`(() => {
      const det = document.querySelector('details');
      if (det && !det.hasAttribute('open')) det.setAttribute('open', '');
    })()`);
    await s.sleep(400);

    await s.snap(`trapping-conv-${label}-section1-open`);

    // Inspect the rendered content for any iter-specific markers
    const conv = await s.eval(`(() => {
      const det = document.querySelector('details');
      if (!det) return null;
      const html = det.outerHTML;
      const txt = det.textContent;
      return {
        outerHTMLLen: html.length,
        textLen: txt.length,
        first160: txt.replace(/\\s+/g, ' ').trim().slice(0, 160),
        // Look for any markers that suggest the ADHD-reading-mode is applied
        hasBionic: /<b\\s|font-weight:\\s*(?:bold|700)/.test(html),
        hasMarker: /class="[^"]*marker/.test(html),
        hasSpacing: /letter-spacing|word-spacing/.test(html),
        adhdSettings: (typeof state !== 'undefined' && state.adhd) || null,
      };
    })()`);
    console.log(`[${label}] conversation section 1 inspect:`, JSON.stringify(conv, null, 2));

    await s.close();
  }
})().catch(e => { console.error(e); process.exit(2); });
