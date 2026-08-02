#!/usr/bin/env node
// Durable probe for study plans on Canonical Design Problems (P2).
//
// A plan is a ROUTE through units with a declared time budget, never a copy of
// them. Everything below exists to keep that true — the failure mode is a plan
// quietly becoming a second source of mastery, or a cursor that survives the
// user dropping it. Covers:
//   - plan strip renders every authored plan + the GENERATED company sets
//   - company plans derive from the `company` tag and honour minUnits
//   - `units: "*"` resolves in parts[] (curriculum) order, not manifest order
//   - starting a plan drills its first unit, HUD reads label · n/N
//   - crux mode drills strictly fewer questions than the full unit
//   - Skip / Next advance the cursor; Exit clears it
//   - activePlan persists across a RELOAD and the strip collapses to Resume
//   - dropping a plan writes a null tombstone (survives a sync merge)
//   - #/<topic>/plan/<id> deep links, including the company/<name> two-segment
//     form; an unknown plan degrades to the topic home instead of a blank screen
//   - plans are scoped to appliesTo — other topics show no strip
//   - mobile: no horizontal scroll, HUD buttons >= 44px
//
// Run: node tools/cdp/sd-plans.js [baseUrl] [outDir]
const { ensureServer, ensureChrome, connect } = require('./lib');

const BASE = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/sd-plans';
const SD = (hash) => `${BASE}system-design.html${hash || ''}`;

// Derived from the data, never hardcoded — authoring a plan or tagging one more
// problem for a company must not break this probe.
const PLANS = require('../../data/system-design/plans.json');
const MANIFEST = require('../../data/system-design/design-problems/manifest.json');
const TOPIC = PLANS.appliesTo;
const N_AUTHORED = PLANS.plans.length;
const N_PROBLEMS = MANIFEST.chapters.length;

const byCompany = {};
MANIFEST.chapters.forEach(c => ((c.tags && c.tags.company) || []).forEach(co => {
  (byCompany[co] || (byCompany[co] = [])).push(c.id);
}));
const N_COMPANY = Object.keys(byCompany)
  .filter(co => byCompany[co].length >= (PLANS.companyPlans.minUnits || 4)).length;
const CRUX_PLAN = PLANS.plans.find(p => p.mode === 'crux');
const STAR_PLAN = PLANS.plans.find(p => p.units === '*');
// Curriculum order = parts[] order, which is NOT chapters[] order by design.
const CURRICULUM = MANIFEST.parts.flatMap(p => p.chapters);

const clearSD = `localStorage.removeItem('jsdrill.systemdesign.v1')`;

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();

  // ── Mobile first: 80% of study happens on a phone (PROFILE.md) ───────────
  const s = await connect({ url: SD(`#/${TOPIC}`), mobile: true, outDir: OUT });
  await s.sleep(900);
  await s.eval(clearSD);
  await s.eval(`location.reload()`);
  await s.sleep(1200);
  await s.snap('01-plan-strip-mobile');

  // ── The strip ────────────────────────────────────────────────────────────
  const cards = await s.eval(`
    Array.from(document.querySelectorAll('.plan-card')).map(e => ({
      id: e.dataset.plan,
      title: e.querySelector('.plan-card__title').textContent.trim(),
      budget: e.querySelector('.plan-card__budget').textContent.trim(),
      frac: e.querySelector('.plan-card__frac').textContent.trim()
    }))`);
  s.assert(cards.length === N_AUTHORED + N_COMPANY,
    `strip shows ${N_AUTHORED} authored + ${N_COMPANY} company plans, got ${cards.length}`);
  PLANS.plans.forEach(p => s.assert(cards.some(c => c.id === p.id), `plan "${p.id}" on the strip`));
  s.assert(cards.filter(c => c.id.startsWith('company/')).length === N_COMPANY,
    `${N_COMPANY} generated company plans`);
  s.assert(cards.every(c => /^~/.test(c.budget)), 'every card declares a time budget');

  // Two labeled rows: a 19-of-32-problem "Google loop" is not a time budget, and
  // filing it under one heading makes the actual budgets unreadable.
  const rows = await s.eval(`
    Array.from(document.querySelectorAll('.plan-strip__label')).map(e => e.textContent.trim())`);
  s.assert(rows.length === 2 && /^Pick a time budget$/.test(rows[0]) && /^By company/.test(rows[1]),
    `time budgets and company loops are separately labeled, got ${JSON.stringify(rows)}`);
  const rowSplit = await s.eval(`
    Array.from(document.querySelectorAll('.plan-cards')).map(r => r.querySelectorAll('.plan-card').length)`);
  s.assert(rowSplit.join(',') === `${N_AUTHORED},${N_COMPANY}`,
    `authored row then company row, got ${rowSplit.join(',')}`);
  s.assert(rows[1] === `By company · ${N_COMPANY}`, `company row is counted, got "${rows[1]}"`);
  s.assert(cards.every(c => /^0\/\d+$/.test(c.frac)), `fresh state → 0/N everywhere, got ${cards.map(c => c.frac).join(' ')}`);
  const cruxCard = cards.find(c => c.id === CRUX_PLAN.id);
  s.assert(/· crux$/.test(cruxCard.budget), `crux mode is labelled, got "${cruxCard.budget}"`);

  // A company plan must be derived, not authored: its unit count has to match
  // the tag, and it must clear minUnits.
  const min = PLANS.companyPlans.minUnits;
  const worst = Object.keys(byCompany).filter(co => byCompany[co].length < min);
  if (worst.length) {
    s.assert(!cards.some(c => c.id === `company/${worst[0]}`),
      `company under minUnits (${worst[0]}, ${byCompany[worst[0]].length}) gets no plan`);
  }
  const topCompany = Object.keys(byCompany)
    .filter(co => byCompany[co].length >= min)
    .sort((a, b) => byCompany[b].length - byCompany[a].length)[0];
  if (topCompany) {
    const c = cards.find(x => x.id === `company/${topCompany}`);
    s.assert(c && c.frac === `0/${byCompany[topCompany].length}`,
      `company/${topCompany} spans its ${byCompany[topCompany].length} tagged problems, got ${c && c.frac}`);
  }

  // `units: "*"` = every unit, in curriculum order.
  const starCard = cards.find(c => c.id === STAR_PLAN.id);
  s.assert(starCard.frac === `0/${N_PROBLEMS}`, `"*" spans all ${N_PROBLEMS}, got ${starCard.frac}`);
  const starOrder = await s.eval(`(function(){
    const p = planById('${TOPIC}', '${STAR_PLAN.id}');
    return planUnits('${TOPIC}', p).join(',');
  })()`);
  s.assert(starOrder === CURRICULUM.join(','), '"*" resolves in parts[] curriculum order');
  s.assert(starOrder.split(',')[1] !== MANIFEST.chapters[1].id || CURRICULUM[1] === MANIFEST.chapters[1].id,
    'curriculum order is the parts order (sanity: not accidentally manifest order)');

  // ── Start a plan ─────────────────────────────────────────────────────────
  const first = PLANS.plans.find(p => p.mode === 'all' && Array.isArray(p.units));
  await s.eval(`document.querySelector('[data-plan="${first.id}"]').click()`);
  await s.sleep(900);
  await s.snap('02-plan-running');
  s.assert(await s.eval(`!!document.querySelector('.plan-hud')`), 'HUD mounts in a plan session');
  const hud = await s.eval(`document.querySelector('.plan-hud').textContent.replace(/\\s+/g,' ').trim()`);
  s.assert(hud.includes(first.title), `HUD names the plan, got "${hud}"`);
  s.assert(/\b1\/\d+\b/.test(hud), `HUD counts n/N and starts at 1, got "${hud}"`);
  s.assert(new RegExp(`1/${first.units.length}\\b`).test(hud),
    `HUD total is the plan length (${first.units.length}), got "${hud}"`);
  s.assert((await s.eval(`location.hash`)) === `#/${TOPIC}/plan/${first.id}`,
    `route is the plan, got ${await s.eval(`location.hash`)}`);
  s.assert(await s.eval(`session && session.chId === '${first.units[0]}'`),
    `drills the plan's first unit (${first.units[0]})`);

  // Persisted cursor — a plan is resumable from a cold load, which is the whole
  // reason the cursor is stored at all.
  const saved = await s.eval(`JSON.parse(localStorage.getItem('jsdrill.systemdesign.v1')).activePlan`);
  s.assert(saved && saved.id === first.id && saved.index === 0, `activePlan persisted, got ${JSON.stringify(saved)}`);
  s.assert(typeof saved.startedAt === 'number', 'activePlan records startedAt');

  // ── Skip advances the cursor ─────────────────────────────────────────────
  await s.eval(`document.getElementById('plan-skip').click()`);
  await s.sleep(800);
  s.assert(await s.eval(`session && session.chId === '${first.units[1]}'`),
    `Skip advances to unit 2 (${first.units[1]})`);
  const hud2 = await s.eval(`document.querySelector('.plan-hud').textContent.replace(/\\s+/g,' ').trim()`);
  s.assert(/\b2\/\d+\b/.test(hud2), `HUD now reads 2/N, got "${hud2}"`);
  s.assert((await s.eval(`JSON.parse(localStorage.getItem('jsdrill.systemdesign.v1')).activePlan.index`)) === 1,
    'skipped cursor persists');

  // ── Reload resumes ───────────────────────────────────────────────────────
  await s.eval(`location.hash = '#/${TOPIC}'`);
  await s.sleep(800);
  await s.eval(`location.reload()`);
  await s.sleep(1300);
  s.assert(await s.eval(`!!document.querySelector('.plan-strip--active')`),
    'strip collapses to the active row after a reload');
  const active = await s.eval(`document.querySelector('.plan-active').textContent.replace(/\\s+/g,' ').trim()`);
  s.assert(active.includes(first.title) && /\b2 of \d+\b/.test(active),
    `active row resumes at 2 of N, got "${active}"`);
  s.assert((await s.eval(`document.querySelectorAll('.plan-card').length`)) === 0,
    'the card carousel is hidden while a plan runs (costs one line, not a permanent strip)');
  const activeTaps = await s.eval(`
    Array.from(document.querySelectorAll('#plan-resume, #plan-drop')).map(e => Math.round(e.getBoundingClientRect().height))`);
  s.assert(activeTaps.length === 2 && activeTaps.every(h => h >= 44),
    `active-row controls >= 44px, got ${activeTaps.join(',')}`);
  await s.snap('03-plan-resume-row');
  await s.eval(`document.getElementById('plan-resume').click()`);
  await s.sleep(900);
  s.assert(await s.eval(`session && session.chId === '${first.units[1]}'`), 'Resume returns to the right unit');

  // ── Exit clears, and clears with a TOMBSTONE ─────────────────────────────
  await s.eval(`document.getElementById('plan-exit').click()`);
  await s.sleep(800);
  s.assert(await s.eval(`document.querySelectorAll('.plan-card').length > 0`), 'Exit returns to the card strip');
  const tomb = await s.eval(`(function(){
    const raw = JSON.parse(localStorage.getItem('jsdrill.systemdesign.v1'));
    return { has: 'activePlan' in raw, val: raw.activePlan };
  })()`);
  s.assert(tomb.has === true && tomb.val === null,
    `dropping a plan writes an explicit null tombstone (sync merges { ...cloud, ...local }, so a deleted key would resurrect), got ${JSON.stringify(tomb)}`);

  // ── Crux mode drills strictly fewer questions ────────────────────────────
  const cruxLens = await s.eval(`(function(){
    const p = planById('${TOPIC}', '${CRUX_PLAN.id}');
    const units = planUnits('${TOPIC}', p);
    const ch = CH['${TOPIC}'][units[0]];
    return { all: chapterItems('${TOPIC}', ch).length,
             crux: chapterItems('${TOPIC}', ch).filter(it => it.q.crux).length,
             unit: units[0] };
  })()`);
  s.assert(cruxLens.crux > 0, `crux plan's first unit (${cruxLens.unit}) has crux questions`);
  s.assert(cruxLens.crux < cruxLens.all,
    `crux is a strict subset (${cruxLens.crux} of ${cruxLens.all}) — otherwise "the panic pass" is the full drill`);
  await s.eval(`document.querySelector('[data-plan="${CRUX_PLAN.id}"]').click()`);
  await s.sleep(900);
  s.assert((await s.eval(`session.items.length`)) === cruxLens.crux, 'crux session drills only crux items');
  s.assert((await s.eval(`session.mode`)) === 'crux', 'session carries crux mode');

  // ── Progress is DERIVED from unit SR state, never stored on the plan ──────
  // Master every question in the plan's first unit directly through the box
  // store, then confirm the plan's fraction moves without the plan being told.
  const bumped = await s.eval(`(function(){
    const p = planById('${TOPIC}', '${CRUX_PLAN.id}');
    const unit = planUnits('${TOPIC}', p)[0];
    const items = chapterItems('${TOPIC}', CH['${TOPIC}'][unit]).filter(it => it.q.crux);
    items.forEach(it => { progress.boxes[it.key] = { box: 5, seen: 5, good: 5, again: 0, due: Date.now() + 9e8, last: Date.now() }; });
    persist();
    return planProgress('${TOPIC}', p).done;
  })()`);
  s.assert(bumped === 1, `mastering a unit advances plan progress by derivation, got ${bumped}`);
  await s.eval(`document.getElementById('plan-exit').click()`);
  await s.sleep(800);
  const cruxFrac = await s.eval(`document.querySelector('[data-plan="${CRUX_PLAN.id}"] .plan-card__frac').textContent.trim()`);
  s.assert(cruxFrac === `1/${CRUX_PLAN.units.length}`, `card reflects derived progress, got ${cruxFrac}`);
  // …and it is NOT reset by dropping the plan — the point of keying by unit.
  s.assert((await s.eval(`JSON.parse(localStorage.getItem('jsdrill.systemdesign.v1')).activePlan`)) === null,
    'plan dropped');
  s.assert((await s.eval(`document.querySelector('[data-plan="${CRUX_PLAN.id}"] .plan-card__frac').textContent.trim()`)) === cruxFrac,
    'abandoning a plan cannot reset mastery');
  await s.snap('04-derived-progress');

  // ── Deep links ───────────────────────────────────────────────────────────
  await s.eval(`location.hash = '#/${TOPIC}/plan/${first.id}'`);
  await s.sleep(1000);
  s.assert(await s.eval(`!!document.querySelector('.plan-hud')`), 'plan deep link starts the plan');
  s.assert(await s.eval(`session && session.chId === '${first.units[0]}'`),
    'a shared plan link starts at step 1 (no cursor for it yet)');
  // Same link while THIS plan is mid-flight resumes instead of restarting.
  await s.eval(`document.getElementById('plan-skip').click()`);
  await s.sleep(800);
  await s.eval(`location.hash = '#/${TOPIC}'`);
  await s.sleep(700);
  await s.eval(`location.hash = '#/${TOPIC}/plan/${first.id}'`);
  await s.sleep(1000);
  s.assert(await s.eval(`session && session.chId === '${first.units[1]}'`),
    'the same link resumes the in-flight cursor rather than restarting');

  if (topCompany) {
    await s.eval(`location.hash = '#/${TOPIC}/plan/company/${topCompany}'`);
    await s.sleep(1000);
    s.assert(await s.eval(`!!document.querySelector('.plan-hud')`),
      `two-segment company plan link works (#/${TOPIC}/plan/company/${topCompany})`);
    const chud = await s.eval(`document.querySelector('.plan-hud__label').textContent.trim()`);
    s.assert(/loop$/.test(chud), `company HUD names the loop, got "${chud}"`);
    await s.eval(`document.getElementById('plan-exit').click()`);
    await s.sleep(700);
  }

  await s.eval(`location.hash = '#/${TOPIC}/plan/not-a-plan'`);
  await s.sleep(900);
  s.assert(await s.eval(`document.querySelectorAll('.ch-card').length > 0`),
    'an unknown plan degrades to the topic home, never a blank screen');
  s.assert(await s.eval(`!document.querySelector('.plan-hud')`), 'no HUD for an unknown plan');

  // ── Scoped to appliesTo ──────────────────────────────────────────────────
  await s.eval(`location.hash = '#/ddia'`);
  await s.sleep(900);
  s.assert(await s.eval(`!document.querySelector('.plan-strip')`), 'other topics show no plan strip');
  await s.eval(`location.hash = '#/ddia/plan/${first.id}'`);
  await s.sleep(900);
  s.assert(await s.eval(`!document.querySelector('.plan-hud')`), 'a plan cannot be started on a topic it does not apply to');

  // ── Mobile geometry ──────────────────────────────────────────────────────
  await s.eval(`location.hash = '#/${TOPIC}'`);
  await s.sleep(900);
  const hScroll = await s.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  s.assert(hScroll <= 1, `no horizontal scroll with the strip on mobile, overflow=${hScroll}px`);
  await s.eval(`document.querySelector('[data-plan="${first.id}"]').click()`);
  await s.sleep(900);
  const taps = await s.eval(`
    Array.from(document.querySelectorAll('.plan-hud__btn')).map(e => Math.round(e.getBoundingClientRect().height))`);
  s.assert(taps.length === 2 && taps.every(h => h >= 44), `HUD buttons >= 44px, got ${taps.join(',')}`);
  const hudScroll = await s.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  s.assert(hudScroll <= 1, `no horizontal scroll with the HUD on mobile, overflow=${hudScroll}px`);
  await s.snap('05-hud-mobile');

  // ── Desktop ──────────────────────────────────────────────────────────────
  await s.setViewport({ width: 1280, height: 900, mobile: false, deviceScaleFactor: 1 });
  await s.eval(`document.getElementById('plan-exit').click()`);
  await s.sleep(900);
  await s.snap('06-plan-strip-desktop');
  s.assert((await s.eval(`document.querySelectorAll('.plan-card').length`)) === N_AUTHORED + N_COMPANY,
    'desktop shows the same plans');
  const dScroll = await s.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  s.assert(dScroll <= 1, `no horizontal scroll on desktop, overflow=${dScroll}px`);

  await s.eval(clearSD);
  const r = s.report();
  await s.close();
  process.exit(r.failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
