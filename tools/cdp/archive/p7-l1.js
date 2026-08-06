// p7-l1.js — verify P7 (design-loop): the L1 Concept tab's answer options wear
// the ds MC-option look (letter chip + 2px border + wash states), matching the
// .ds-opt used across Browse / system-design / diagnostic — and the tap→reveal
// logic (correct green / wrong red / others mute) still works byte-identically.
//
//   node tools/cdp/p7-l1.js [outDir]

const path = require('path');
const { ensureServer, ensureChrome, connect } = require('../lib');

const OUT = process.argv[2] || '/tmp/jsdrill-probe-p7-l1';

async function openL1(s) {
  await s.eval(`history.replaceState(null,'',location.pathname)`);
  await s.reload();
  await s.waitFor(`document.querySelector('#ds-appnav')`, { timeoutMs: 6000 });
  await s.eval(`selectLesson('two-sum')`); await s.sleep(700);
  await s.eval(`typeof selectTab==='function' && selectTab('L1')`); await s.sleep(600);
}

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // ── Mobile 390 — the 80%-phone L1 surface ────────────────────────────────
  const m = await connect({ url: 'http://localhost:8765/', mobile: true,
    outDir: path.join(OUT, 'mobile'), waitForLoadMs: 2600 });
  await m.eval(`localStorage.setItem('jsdrill.progress.v1', JSON.stringify({__v:5, welcomed:true, progress:{}, reviews:{}}))`);
  await openL1(m);

  // 1 · Options render as ds MC-options (letter chip + 2px border + ≥44px).
  const look = await m.eval(`(() => {
    const opts = [...document.querySelectorAll('.mc-option')];
    if (!opts.length) return { n: 0 };
    const first = opts[0], cs = getComputedStyle(first);
    return {
      n: opts.length,
      hasKey: !!first.querySelector('.mc-key'),
      hasBody: !!first.querySelector('.mc-body'),
      borderPx: parseInt(cs.borderTopWidth),
      radius: parseInt(cs.borderTopLeftRadius),
      minH: Math.min(...opts.map(o => o.getBoundingClientRect().height)),
      flex: cs.display,
    };
  })()`);
  m.assert(look.n >= 2 && look.hasKey && look.hasBody, `L1 options render ds letter-chip + body (${JSON.stringify(look)})`);
  m.assert(look.borderPx === 2 && look.flex === 'flex', 'options use the ds 2px-border flex card');
  m.assert(look.minH >= 44, `options are ≥44px tap targets (min ${look.minH})`);
  await m.snap('01-l1-options');

  // 2 · Tap→reveal: exactly one correct (green), all locked, others mute.
  const reveal = await m.eval(`(() => {
    const q = document.querySelector('[data-qi]');
    const opts = [...q.querySelectorAll('.mc-option')];
    opts[0].click();
    const after = [...q.querySelectorAll('.mc-option')];
    const correct = after.filter(o => o.classList.contains('correct'));
    const disabled = after.filter(o => o.classList.contains('disabled'));
    const muted = after.filter(o => o.classList.contains('disabled') && !o.classList.contains('correct') && !o.classList.contains('incorrect'));
    const keyCs = correct.length ? getComputedStyle(correct[0].querySelector('.mc-key')) : null;
    return {
      oneCorrect: correct.length === 1,
      allLocked: disabled.length === after.length,
      firstClickedResolved: after[0].classList.contains('correct') || after[0].classList.contains('incorrect'),
      mutedOpacity: muted.length ? parseFloat(getComputedStyle(muted[0]).opacity) : 1,
      explainShown: !q.parentElement.querySelector('.explain')?.classList.contains('hidden'),
    };
  })()`);
  m.assert(reveal.oneCorrect && reveal.allLocked && reveal.firstClickedResolved,
    `tap reveals the answer + locks the question (${JSON.stringify(reveal)})`);
  m.assert(reveal.mutedOpacity < 1, `un-picked wrong options mute on reveal (opacity ${reveal.mutedOpacity})`);
  await m.snap('02-l1-revealed');

  m.assert(await m.eval(`document.documentElement.scrollWidth <= innerWidth`), 'no horizontal scroll @390');

  console.log('\n===== L1 mobile 390 =====');
  const mr = m.report();
  await m.close();

  const failed = mr.failed + mr.errors + mr.networkErrors;
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
