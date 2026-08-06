// Probe: verify the new "Problem" box appears in the lesson header on every
// tab for a Patterns lesson (Trapping Rain Water), at both mobile + desktop
// widths.
const { ensureServer, ensureChrome, connect } = require('../lib');

const TABS = ['reference', 'conversation', 'walkthrough', 'L1', 'L2', 'L3'];
const LESSON_ID = 'p-trapping-rain';

async function runForViewport({ mobile, label, outDir }) {
  const s = await connect({
    url: `http://localhost:8765/#/${LESSON_ID}/reference`,
    mobile,
    viewport: mobile ? undefined : { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
    outDir,
    waitForLoadMs: 2500,
  });

  await s.evalAwait(`(async () => {
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({ __v: 5, welcomed: true }));
  })()`);
  await s.reload();
  await s.sleep(800);

  for (const tab of TABS) {
    await s.evalAwait(`(async () => {
      window.location.hash = '#/${LESSON_ID}/${tab}';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    })()`);
    await s.sleep(400);

    const probe = await s.eval(`(() => {
      const box = document.querySelector('.lesson-prompt');
      if (!box) return { found: false };
      const r = box.getBoundingClientRect();
      const label = box.querySelector('div:first-child')?.textContent?.trim();
      const body = box.querySelector('div:last-child')?.textContent?.trim();
      return {
        found: true,
        label,
        body: body && body.length > 80 ? body.slice(0, 80) + '…' : body,
        visible: r.width > 0 && r.height > 0,
        top: Math.round(r.top),
      };
    })()`);

    s.assert(probe.found, `[${label}/${tab}] .lesson-prompt should exist`);
    s.assert(probe.visible, `[${label}/${tab}] .lesson-prompt should be visible`);
    s.assert(probe.label === 'Problem', `[${label}/${tab}] label should be "Problem", got ${JSON.stringify(probe.label)}`);
    s.assert(/trap\(height\)/.test(probe.body || ''), `[${label}/${tab}] body should mention trap(height), got ${JSON.stringify(probe.body)}`);

    await s.snap(`${label}-${tab}`);
  }

  // Confirm no horizontal overflow (mobile-safety check)
  if (mobile) {
    const overflow = await s.eval(`document.documentElement.scrollWidth > window.innerWidth + 1`);
    s.assert(!overflow, `[${label}] no horizontal overflow at mobile width`);
  }

  const rep = s.report();
  await s.close();
  return rep;
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  const mobileRep = await runForViewport({
    mobile: true,
    label: 'mobile',
    outDir: '/tmp/jsdrill-probe-header-prompt/mobile',
  });
  const desktopRep = await runForViewport({
    mobile: false,
    label: 'desktop',
    outDir: '/tmp/jsdrill-probe-header-prompt/desktop',
  });

  const totalFailed = mobileRep.failed + desktopRep.failed + mobileRep.errors + desktopRep.errors;
  console.log(`\nSummary:`);
  console.log(`  mobile:  ${mobileRep.passed} passed, ${mobileRep.failed} failed, ${mobileRep.errors} errors`);
  console.log(`  desktop: ${desktopRep.passed} passed, ${desktopRep.failed} failed, ${desktopRep.errors} errors`);
  process.exit(totalFailed > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
