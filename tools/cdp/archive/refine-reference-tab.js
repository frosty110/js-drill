// refine-reference-tab.js — Step 2 + Step 7 probe for /drill-refine iter 28.
//
// Captures the Reference tab (canonical-code + notes) at mobile + desktop.

const { ensureServer, ensureChrome, connect } = require('../lib');

const TAG = process.env.SNAP_TAG || 'before';
const OUT = process.env.OUT_DIR || '/tmp/jsdrill-refine-28';

async function shot({ mobile, label }) {
  const s = await connect({
    url: 'http://localhost:8765/',
    mobile,
    viewport: mobile ? undefined : { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
    outDir: OUT,
  });

  await s.eval(`
    localStorage.setItem('jsdrill.progress.v1', JSON.stringify({
      __v: 5, progress: {}, bestTimes: {}, mockHistory: {}, revealed: {},
      starterPath: true, welcomed: true, hideMastered: false,
      reviews: {}, weakness: {},
      sidebarTrack: 'patterns', subscribedPathId: 'starter',
      currentTab: 'reference', lastTab: 'reference', lastLessonId: 'two-sum'
    }));
  `);
  await s.reload();

  await s.waitFor(`typeof CURRICULUM !== 'undefined' && CURRICULUM.length > 0`, { timeoutMs: 15000 });
  await s.eval(`window.selectLesson('two-sum')`);
  await s.waitFor(`document.querySelector('#lesson-shell h2') !== null`, { timeoutMs: 6000 });
  await s.eval(`if (typeof selectTab === 'function') selectTab('reference')`);
  await new Promise(r => setTimeout(r, 700));

  await s.snap(`reference-${label}-${TAG}`);

  const info = await s.eval(`
    (() => {
      const codeBox = document.querySelector('#lesson-shell .CodeMirror') || document.querySelector('#lesson-shell pre');
      const drillCta = document.querySelector('[data-action="goto-l3-from-ref"], [data-drill-cta]');
      const notes = document.querySelectorAll('#lesson-shell ul li').length;
      const mechChips = document.querySelectorAll('#lesson-shell .mech-chip, [data-mech-chip]').length;
      const flashBtn = document.querySelector('[data-flash-mode], [data-action="flash-toggle"]');
      const cinemaBtn = document.querySelector('[data-action="open-cinema"], [data-cinema-btn]');
      const cardsHeader = Array.from(document.querySelectorAll('#lesson-shell div')).find(d => /the thing to memorize/i.test(d.textContent.slice(0, 100)));
      const codeRect = codeBox?.getBoundingClientRect();
      return {
        codeBoxTop: codeRect ? Math.round(codeRect.top) : null,
        codeBoxBottom: codeRect ? Math.round(codeRect.bottom) : null,
        codeAboveFold: codeRect ? codeRect.top < innerHeight : null,
        drillCtaPresent: !!drillCta,
        notesCount: notes,
        mechChipsCount: mechChips,
        flashBtnPresent: !!flashBtn,
        cinemaBtnPresent: !!cinemaBtn,
        viewportHeight: innerHeight,
      };
    })()
  `);
  console.log(`[${label}]`, JSON.stringify(info, null, 2));

  // iter-28 invariant: Notes section header rendered as a lavender-accent
  // divider with a count digit.
  const notesHeader = await s.eval(`
    (() => {
      const el = document.querySelector('[data-ref-notes-header]');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        text: el.textContent.trim(),
        fontSize: cs.fontSize,
        color: cs.color,
        borderLeftWidth: cs.borderLeftWidth,
      };
    })()
  `);
  s.assert(!!notesHeader, `[${label}] [data-ref-notes-header] present`);
  s.assert(notesHeader && parseFloat(notesHeader.fontSize) >= 12,
    `[${label}] header font-size >= 12px (got ${notesHeader?.fontSize})`);
  s.assert(notesHeader && parseFloat(notesHeader.borderLeftWidth) >= 2,
    `[${label}] header has ≥2px left-border (got ${notesHeader?.borderLeftWidth})`);
  s.assert(notesHeader && /\d+/.test(notesHeader.text || ''),
    `[${label}] header text includes count digit (got "${notesHeader?.text}")`);

  s.report();
  await s.close();
  return s;
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  await shot({ mobile: true,  label: 'mobile' });
  await shot({ mobile: false, label: 'desktop' });
})().catch(e => { console.error(e); process.exit(1); });
