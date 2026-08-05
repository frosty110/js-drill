// ============================================================================
// FACETED TAGS — data/system-design/tags.json
// Mirrors the main app's Problems filter: AND across facets, OR within a facet.
// Authored facets (mechanism/difficulty/company) live on manifest chapter
// entries, so filtering works before any unit file is fetched. Derived facets
// (family/length) are computed here and need no authoring.
// ============================================================================
let TAGS = null;
async function loadTags() {
  if (TAGS === null) {
    try { TAGS = await fetch(`${BASE}/tags.json`).then(r => r.json()); }
    catch (_) { TAGS = { facets: [], appliesTo: [] }; }
  }
  return TAGS;
}
const tagsApplyTo = (t) => !!(TAGS && (TAGS.appliesTo || []).indexOf(t) >= 0);
const facetOf = (id) => ((TAGS && TAGS.facets) || []).find(f => f.id === id) || null;
function facetLabel(fid, vid) {
  const f = facetOf(fid);
  const v = f && (f.values || []).find(x => x.id === vid);
  return v ? v.label : vid;
}
const LENGTH_OF = (q) => (q <= 8 ? 'short' : q <= 10 ? 'medium' : 'long');
// A family is DERIVED from the part a problem sits in, but its value has to be a
// stable id rather than the display name: "AI & ML Infrastructure" cannot be a
// URL segment, and the route sanitiser would strip it to something that matches
// nothing. Ids are registered in tags.json so the chips still read as prose.
// Mirrored in tools/build-share-pages.js — same slug, both sides.
const familySlug = (name) => String(name || '').toLowerCase()
  .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Every facet value one manifest entry carries — derived and authored together.
function entryTags(t, entry) {
  const tg = entry.tags || {};
  const part = (META[t] && META[t]._partOf && META[t]._partOf[entry.id]) || null;
  return {
    family: part ? [familySlug(part)] : [],
    mechanism: tg.mechanism || [],
    difficulty: tg.difficulty ? [tg.difficulty] : [],
    company: tg.company || [],
    length: [LENGTH_OF(entry.questions || 0)]
  };
}

