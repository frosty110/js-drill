// ============================================================================
// STUDY PLANS — data/system-design/plans.json
// A plan is a ROUTE through existing units with a declared time budget, never a
// copy of them. Completion is always derived from unit SR state, so switching or
// abandoning a plan can never reset mastery. Only the cursor is persisted
// (schema-additive `activePlan`), because the main app's Home lives on a
// different page and needs to render "One Week Core · 6/14" from a cold load.
// ============================================================================
let PLANS = null;
async function loadPlans() {
  if (PLANS === null) {
    try { PLANS = await fetch(`${BASE}/plans.json`).then(r => r.json()); }
    catch (_) { PLANS = { plans: [] }; }
  }
  return PLANS;
}
const plansApplyTo = (t) => !!(PLANS && PLANS.appliesTo === t);

// Authored plans plus the generated company sets, in one list.
function allPlans(t) {
  if (!plansApplyTo(t)) return [];
  const authored = (PLANS.plans || []).map(p => ({ ...p, generated: false }));
  return authored.concat(companyPlans(t));
}

// Company plans are DERIVED from the `company` tag, not authored — tagging one
// problem grows every relevant loop set for free. That is the whole payoff for
// surfacing company tags at all.
function companyPlans(t) {
  const cfg = (PLANS && PLANS.companyPlans) || {};
  const min = cfg.minUnits || 4, perUnit = cfg.budgetPerUnit || 12;
  const m = META[t]; if (!m) return [];
  const byCompany = {};
  m.chapters.forEach(c => ((c.tags && c.tags.company) || []).forEach(co => {
    (byCompany[co] || (byCompany[co] = [])).push(c.id);
  }));
  return Object.keys(byCompany)
    .filter(co => byCompany[co].length >= min)
    .sort((a, b) => byCompany[b].length - byCompany[a].length || a.localeCompare(b))
    .map(co => ({
      id: `company/${co}`, generated: true, mode: 'all',
      title: `${facetLabel('company', co)} loop`,
      budget: `~${Math.round(byCompany[co].length * perUnit / 60 * 10) / 10} hrs`,
      blurb: `${byCompany[co].length} problems tagged as asked at ${facetLabel('company', co)}.`,
      units: byCompany[co].sort((a, b) => (m._order[a] || 0) - (m._order[b] || 0))
    }));
}
const planById = (t, id) => allPlans(t).find(p => p.id === id) || null;

// `units: "*"` resolves to every unit in parts[] order — the curriculum order,
// not manifest-array order, so the Full Canon walks family by family.
function planUnits(t, plan) {
  const m = META[t]; if (!m || !plan) return [];
  if (plan.units === '*') return (m.parts || []).flatMap(p => p.chapters);
  return plan.units.filter(id => m._order[id] != null);
}

// Derived from unit SR state — never stored, so it can't drift from mastery.
function planProgress(t, plan) {
  const units = planUnits(t, plan);
  let done = 0;
  units.forEach(id => {
    const ch = CH[t] && CH[t][id]; if (!ch) return;
    const items = plan.mode === 'crux'
      ? chapterItems(t, ch).filter(it => it.q.crux)
      : chapterItems(t, ch);
    if (items.length && items.every(it => isMastered(it.key))) done++;
  });
  return { total: units.length, done };
}

function activePlan() { return progress.activePlan || null; }
function setActivePlan(id, index) {
  progress.activePlan = { id, index, startedAt: (activePlan() || {}).startedAt || Date.now() };
  persist();
}
// Writes an explicit null TOMBSTONE rather than deleting the key: sync merges
// system-design state as { ...cloud, ...local }, so a missing local key silently
// inherits the cloud's value and a plan dropped on the phone would resurrect
// from the laptop's copy. A null is a fact ("no plan here"); an absence isn't.
function clearActivePlan() { progress.activePlan = null; persist(); }

function tagFilter() { return progress.tagFilter || (progress.tagFilter = {}); }
function tagFilterCount() {
  return Object.keys(tagFilter()).reduce((n, k) => n + (tagFilter()[k] || []).length, 0);
}
function tagFilterHas(fid, vid) { return (tagFilter()[fid] || []).indexOf(vid) >= 0; }
function toggleTag(fid, vid) {
  const tf = tagFilter();
  const arr = tf[fid] || (tf[fid] = []);
  const i = arr.indexOf(vid);
  if (i >= 0) arr.splice(i, 1); else arr.push(vid);
  if (!arr.length) delete tf[fid];
  persist();
}
function clearTagFilter() { progress.tagFilter = {}; persist(); }
// AND across facets, OR within a facet.
function tagMatch(tags) {
  const tf = tagFilter();
  return Object.keys(tf).every(fid => {
    const vals = tf[fid] || [];
    return !vals.length || vals.some(v => (tags[fid] || []).indexOf(v) >= 0);
  });
}
// Which facet values actually occur in this topic — never offer a filter that
// can only ever return zero results.
function presentValues(t, entries) {
  const seen = {};
  entries.forEach(e => {
    const tags = entryTags(t, e);
    Object.keys(tags).forEach(fid => {
      (seen[fid] || (seen[fid] = new Set()));
      tags[fid].forEach(v => seen[fid].add(v));
    });
  });
  return seen;
}
// One chapter's drillable items (MC + open), each with a stable SR key.
function chapterItems(t, ch) {
  return (ch.questions || []).map((q, i) => ({ topic: t, chId: ch.id, qIndex: i, key: `${t}/${ch.id}/${i}`, type: q.type || 'mc', q }));
}
// `unseen` rides alongside `due` everywhere (audit F11) so every surface can say
// "N to learn" instead of misreporting untouched cards as overdue.
function chapterStats(t, ch) {
  const items = chapterItems(t, ch);
  let mastered = 0, due = 0, unseen = 0;
  items.forEach(it => { if (isMastered(it.key)) mastered++; if (isDue(it.key)) due++; if (isNew(it.key)) unseen++; });
  return { total: items.length, mastered, due, unseen, seen: items.length - unseen };
}
function topicStats(t) {
  let total = 0, mastered = 0, due = 0, unseen = 0;
  (META[t] ? META[t].chapters : []).forEach(c => { const s = chapterStats(t, CH[t][c.id]); total += s.total; mastered += s.mastered; due += s.due; unseen += s.unseen; });
  return { total, mastered, due, unseen, seen: total - unseen, pct: total ? Math.round(mastered / total * 100) : 0 };
}
// UNIT-level rollup. topicStats() counts questions, which is the right grain for
// a progress meter but the wrong one for "how many problems do I know?" — on a
// 21-problem topic it reads "0 of 195". A unit counts as mastered when every one
// of its questions is (the same rule the chapter card's ✓ already uses), so the
// two numbers can't drift apart. Both are shown, each labeled with its own noun.
function topicUnitStats(t) {
  let total = 0, mastered = 0, due = 0, started = 0, unseen = 0;
  (META[t] ? META[t].chapters : []).forEach(c => {
    const ch = CH[t] && CH[t][c.id]; if (!ch) return;
    const s = chapterStats(t, ch); if (!s.total) return;
    total++;
    if (s.mastered === s.total) mastered++;
    else if (s.mastered > 0) started++;
    if (s.due) due++;
    // A unit is "to learn" only when NOTHING in it has been attempted — a
    // half-drilled unit is in progress, not new (audit F11).
    if (!s.seen) unseen++;
  });
  return { total, mastered, started, due, unseen, pct: total ? Math.round(mastered / total * 100) : 0 };
}
// The singular, capitalized noun — "Problem", "Section", "Chapter".
function unitNounCap(t) { return (META[t] && META[t].unitLabel) || 'Chapter'; }
// "Problem" / "Section" / "Chapter" — the manifest's own noun for a unit.
function unitNoun(t, n) {
  const label = (META[t] && META[t].unitLabel) || 'Chapter';
  return n === 1 ? label.toLowerCase() : label.toLowerCase() + 's';
}
// audit F11: ONE place decides how a scope's outstanding work is worded, so the
// landing card, the chapter card and the unit detail can't drift apart. A real
// review debt outranks new material (it decays; unopened material doesn't), so
// `due` wins when both exist; an untouched scope reads "N to learn" instead of
// claiming N cards are overdue.
function workLabel(s) {
  if (s.due) return `<span class="ch-due">${s.due} due</span>`;
  if (s.unseen) return `<span class="ch-new">${s.unseen} to learn</span>`;
  return '';
}

