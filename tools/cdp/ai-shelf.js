// Probe for the AI-books shelf: landing grouping, deep links into the three new
// topics, and the separated Home area cards.
const { ensureServer, ensureChrome, connect } = require('./lib');

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const BASE = 'http://localhost:8765';

  // ── 1. Landing page: shelves ──────────────────────────────────────────────
  let s = await connect({ url: `${BASE}/system-design.html#/`, mobile: true, waitForLoadMs: 3000 });
  const landing = await s.eval(`(() => ({
    heads: [...document.querySelectorAll('.shelf-head h3')].map(h => h.textContent.trim()),
    cards: [...document.querySelectorAll('.topic-card')].map(c => c.dataset.topic),
    hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
  }))()`);
  s.assert(landing.heads.length === 2, `two shelf headings (got ${JSON.stringify(landing.heads)})`);
  s.assert(landing.cards.length === 7, `7 topic cards (got ${landing.cards.length})`);
  s.assert(['ai-engineering','agentic-patterns','multi-agent-systems'].every(id => landing.cards.includes(id)), 'three AI topics on the landing');
  s.assert(landing.cards.indexOf('ddia') < landing.cards.indexOf('ai-engineering'), 'system-design shelf renders before the AI shelf');
  s.assert(!landing.hscroll, 'no horizontal scroll at 390px');
  await s.close(); s.report();

  // ── 2. Deep links into the new topics ─────────────────────────────────────
  for (const [hash, expect] of [
    ['#/ai-engineering/ch03', /Evaluation Methodology/i],
    ['#/agentic-patterns/ch05', /Tool Use/i],
    ['#/multi-agent-systems/ch07', /Autonomous Multi-Agent Orchestration/i],
  ]) {
    const p = await connect({ url: `${BASE}/system-design.html${hash}`, mobile: true, waitForLoadMs: 3000 });
    const body = await p.eval(`document.body.innerText.slice(0, 600)`);
    p.assert(expect.test(body), `${hash} renders its unit`);
    await p.close(); p.report();
  }

  // ── 3. Home: the AI card is separate from System Design ───────────────────
  const h = await connect({ url: `${BASE}/index.html#/m/home`, mobile: true, waitForLoadMs: 4000 });
  const home = await h.eval(`(() => {
    const areas = [...document.querySelectorAll('[data-home-area]')].map(el => ({
      key: el.dataset.homeArea,
      label: (el.querySelector('.home-area__id b')||{}).textContent,
      frac: ((el.querySelector('.home-area__frac')||{}).textContent||'').trim(),
      topics: ((el.querySelector('.home-expand')||{}).textContent||'').trim(),
    }));
    return { areas, hscroll: document.documentElement.scrollWidth > window.innerWidth + 1 };
  })()`);
  const sd = home.areas.find(a => a.key === 'sysdesign') || {};
  const ai = home.areas.find(a => a.key === 'aibooks') || {};
  h.assert(!!ai.key, `AI area card present (areas: ${home.areas.map(a=>a.key).join(',')})`);
  h.assert(ai.label === 'AI Engineering', `AI card labelled (got ${ai.label})`);
  h.assert(/4 topics/.test(sd.topics), `System Design counts 4 topics (got "${sd.topics}")`);
  h.assert(/3 topics/.test(ai.topics), `AI counts 3 topics (got "${ai.topics}")`);
  h.assert(sd.frac !== ai.frac, `separate denominators (${sd.frac} vs ${ai.frac})`);
  h.assert(!home.hscroll, 'home has no horizontal scroll at 390px');
  await h.close(); h.report();
})().catch(e => { console.error(e); process.exit(1); });
