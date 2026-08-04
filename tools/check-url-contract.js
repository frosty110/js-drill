#!/usr/bin/env node
// ============================================================================
//  tools/check-url-contract.js — every addressable thing is fetchable
// ============================================================================
// The rule this enforces is in docs/url-contract.md. Short form: an app URL is
// something a user pastes to an AI, a crawler indexes, and a colleague opens.
// All three fetch it with no JavaScript. So every surface the app can be
// looking at must have a real path that returns real bytes.
//
// This exists because the failure is invisible from inside a browser. The app
// worked perfectly; it was only from the outside — curl, a crawler, an agent —
// that `system-design.html#/design-problems/p03` turned out to be a shell
// saying "Loading…", and that the pre-rendered pages had silently dropped every
// diagram and image. Nothing was red. Four checks, each one a bug we shipped:
//
//   1. Every surface in js/routes.js resolves to a file on disk.
//   2. Every hash-routed app page carries the agent bridge that points at them.
//   3. The sitemap lists every unit page.
//   4. A unit whose DATA has diagrams/infographics renders them on its page.
//
// Check 4 is the one that would have caught the original bug: the generator can
// stay green while quietly rendering half the content.
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const SD = path.join(DATA, 'system-design');

const DrillRoutes = require(path.join(ROOT, 'js', 'routes.js'));

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const fail = [];
let checked = 0;

function loadSets() {
  const f = path.join(SD, 'infographic-sets.json');
  return fs.existsSync(f) ? (readJson(f).sets || {}) : {};
}

// Sheet ids a unit has ARTWORK for. A set may register a sheet whose PNG is
// still being drawn; that one has nothing to serve yet, so it is not expected
// to have a page. Registered-but-missing is caught separately, below.
function sheetsOf(sets, topicId, unitId) {
  const set = sets[`${topicId}/${unitId}`];
  if (!set || !Array.isArray(set.items)) return [];
  return set.items
    .filter(i => fs.existsSync(path.join(ROOT, 'assets', 'system-design', 'infographics', topicId, unitId, `${i.id}.png`)))
    .map(i => i.id);
}

// ── 1. Every registered surface has a file ──────────────────────────────────
// routes.js is the registry; if a surface is in it, its static twin must exist.
function checkSurfacesResolve() {
  const topics = readJson(path.join(SD, 'topics.json')).topics;
  const manifest = readJson(path.join(DATA, 'manifest.json'));

  const targets = [
    { kind: 'lessonIndex', params: {} },
    { kind: 'sdIndex', params: {} }
  ];
  for (const s of manifest.sections) {
    for (const l of s.lessons) {
      if (l.status === 'full') targets.push({ kind: 'lesson', params: { id: l.id } });
    }
  }
  const sets = loadSets();
  const plansDoc = fs.existsSync(path.join(SD, 'plans.json')) ? readJson(path.join(SD, 'plans.json')) : { plans: [] };
  const tagsDoc = fs.existsSync(path.join(SD, 'tags.json')) ? readJson(path.join(SD, 'tags.json')) : { facets: [], appliesTo: [] };
  for (const t of topics) {
    targets.push({ kind: 'sdTopic', params: { topic: t.id } });
    const meta = readJson(path.join(SD, t.id, 'manifest.json'));
    for (const c of meta.chapters) {
      targets.push({ kind: 'sdUnit', params: { topic: t.id, unit: c.id } });
      // Every study sheet is its own address — that is what makes "here is the
      // diagram I'm looking at" a thing a user can paste.
      for (const item of sheetsOf(sets, t.id, c.id)) {
        targets.push({ kind: 'sdSheet', params: { topic: t.id, unit: c.id, sheet: item } });
      }
    }
    // Plans and tag lists are content too — a shared plan link that 404s is the
    // same failure as a missing unit page.
    if (plansDoc.appliesTo === t.id) {
      for (const plan of plansDoc.plans || []) {
        targets.push({ kind: 'sdPlan', params: { topic: t.id, plan: plan.id } });
      }
    }
    if ((tagsDoc.appliesTo || []).includes(t.id)) {
      for (const facet of tagsDoc.facets || []) {
        for (const value of facet.values || []) {
          const dir = path.join(ROOT, 'sd', t.id, 'tag', facet.id, value.id);
          // A registry value with no problems carrying it has no list to serve.
          if (fs.existsSync(dir)) targets.push({ kind: 'sdTag', params: { topic: t.id, facet: facet.id, value: value.id } });
        }
      }
    }
  }

  for (const t of targets) {
    const rel = DrillRoutes.sharePath(t.kind, t.params);
    checked++;
    if (!fs.existsSync(path.join(ROOT, rel, 'index.html'))) {
      fail.push(`no JS-free page for ${t.kind} → ${rel} (run: node tools/build-share-pages.js)`);
    }
    // A path with a space or an ampersand is not an address anyone can round
    // trip — the app's own route sanitiser would strip it, so the two spellings
    // could never agree. Caught once already, on tag values derived from part
    // display names.
    checked++;
    if (/[^A-Za-z0-9\-._~/%]/.test(rel)) {
      fail.push(`${t.kind} path is not URL-safe: ${rel}`);
    }
  }
}

// ── 2. Hash-routed app pages point at their static twin ─────────────────────
// A fragment never reaches a server, so the shell is identical for every route.
// It has to carry the directions out.
// Both app pages are hash-routed, so both are equally unreadable to a fetcher
// and both need the way out.
const BRIDGED = [
  { page: 'system-design.html', cites: /sd\/[a-z0-9-]+\/[a-z0-9]+\//i },
  { page: 'index.html', cites: /\bp\/[a-z0-9][a-z0-9-]*\//i }
];

function checkBridge() {
  for (const { page, cites } of BRIDGED) {
    const abs = path.join(ROOT, page);
    if (!fs.existsSync(abs)) continue;
    const html = fs.readFileSync(abs, 'utf8');
    checked++;
    if (!html.includes('<!-- agent-bridge:start -->')) {
      fail.push(`${page}: no agent bridge — a fetcher gets a shell with no way to reach the content`);
      continue;
    }
    // The bridge is worthless if it doesn't name a real path.
    const m = html.match(cites);
    if (!m || !fs.existsSync(path.join(ROOT, m[0]))) {
      fail.push(`${page}: agent bridge cites ${m ? m[0] : 'no path'}, which does not exist`);
    }
    // …and worse than worthless if a browser shows it to a user.
    checked++;
    if (!/getElementById\('(app|lesson-shell)'\)\.innerHTML\s*=/.test(html)) {
      fail.push(`${page}: nothing blanks the bridge on boot — real users would see it`);
    }
  }
}

// ── 3. The sitemap covers the unit pages ────────────────────────────────────
function checkSitemap() {
  const abs = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(abs)) { fail.push('sitemap.xml missing'); return; }
  const xml = fs.readFileSync(abs, 'utf8');
  const topics = readJson(path.join(SD, 'topics.json')).topics;
  for (const t of topics) {
    const meta = readJson(path.join(SD, t.id, 'manifest.json'));
    for (const c of meta.chapters) {
      checked++;
      const rel = DrillRoutes.sharePath('sdUnit', { topic: t.id, unit: c.id });
      if (!xml.includes(rel)) fail.push(`sitemap.xml does not list ${rel}`);
    }
  }
}

// ── 4. Authored visuals actually reach the page ─────────────────────────────
// The regression that started this: unit JSON carried four mermaid diagrams and
// three PNGs, and the generated page carried none of them. Green everywhere.
function checkVisualsRendered() {
  const sets = fs.existsSync(path.join(SD, 'infographic-sets.json'))
    ? readJson(path.join(SD, 'infographic-sets.json')).sets || {}
    : {};
  const topics = readJson(path.join(SD, 'topics.json')).topics;

  for (const t of topics) {
    const meta = readJson(path.join(SD, t.id, 'manifest.json'));
    for (const c of meta.chapters) {
      const file = path.join(SD, t.id, `${c.id}.json`);
      if (!fs.existsSync(file)) continue;
      const unit = readJson(file);
      const page = path.join(ROOT, 'sd', t.id, c.id, 'index.html');
      if (!fs.existsSync(page)) continue;      // check 1 already reported it
      const html = fs.readFileSync(page, 'utf8');

      // Assert against the RENDERED elements, never the embedded drill-data
      // JSON. Both carry the same strings, so a substring search satisfied by
      // the JSON blob would keep passing with the visible page stripped bare —
      // which is exactly how the first version of this check fooled itself.
      for (const d of unit.diagrams || []) {
        checked++;
        if (!d.id) continue;
        if (!html.includes(`id="diagram-${d.id}"`)) {
          fail.push(`sd/${t.id}/${c.id}/: diagram "${d.id}" is in the data but not rendered on the page`);
          continue;
        }
        // The mermaid SOURCE is the payload — a reader with no image support
        // still gets the topology from it.
        if (d.code && !html.includes(escapeHtml(d.code.split('\n').pop().trim()))) {
          fail.push(`sd/${t.id}/${c.id}/: diagram "${d.id}" renders without its source`);
        }
      }

      const set = sets[`${t.id}/${c.id}`];
      for (const item of (set && set.items) || []) {
        checked++;
        const rel = `assets/system-design/infographics/${t.id}/${c.id}/${item.id}.png`;
        // A registered sheet without artwork yet is a known in-flight state, not
        // a broken contract — it just must not be linked from anywhere.
        if (!fs.existsSync(path.join(ROOT, rel))) {
          if (html.includes(`${item.id}.png`)) {
            fail.push(`sd/${t.id}/${c.id}/: page links ${item.id}.png, which is not on disk`);
          }
        } else if (!new RegExp(`<img[^>]+${item.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.png`).test(html)) {
          fail.push(`sd/${t.id}/${c.id}/: sheet "${item.id}" exists but no <img> on the page shows it`);
        }
      }
    }
  }
}

const escapeHtml = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ── 5. The registry and the app routers agree ───────────────────────────────
// The reconciliation check, and the reason the others exist. Everything above
// verifies the registry against DISK. This verifies it against ITSELF and
// against the app — which is where the real drift happened: `mixed`, `due`,
// `plan` and `tag` were live app routes for months that no surface named, so
// they had no share link, no sitemap entry and no fetchable page, and every
// check stayed green because nothing ever compared the two.
function checkReconciliation() {
  const samples = {
    lessonIndex: {}, sdIndex: {},
    lesson: { id: 'two-sum' },
    sdTopic: { topic: 'ddia' },
    sdUnit: { topic: 'design-problems', unit: 'p06' },
    sdSheet: { topic: 'design-problems', unit: 'p06', sheet: 'overview' },
    sdPlan: { topic: 'design-problems', plan: 'night-before' },
    sdTag: { topic: 'design-problems', facet: 'mechanism', value: 'caching' },
    sdMixed: { topic: 'ddia' }, sdDue: { topic: 'ddia' },
    appMode: { mode: 'dashboard' }
  };

  for (const s of DrillRoutes.SURFACES) {
    const params = samples[s.kind];
    checked++;
    if (!params) { fail.push(`no round-trip sample for surface "${s.kind}" — add one to this gate`); continue; }

    // Every surface must declare what it means, and an action must land
    // somewhere real.
    checked++;
    if (s.disposition !== 'content' && s.disposition !== 'action') {
      fail.push(`${s.kind}: disposition must be 'content' or 'action', got ${JSON.stringify(s.disposition)}`);
    } else if (s.disposition === 'action') {
      const to = DrillRoutes.SURFACES.find(x => x.kind === s.fallback);
      if (!to) fail.push(`${s.kind}: action fallback "${s.fallback}" is not a surface`);
      else if (to.disposition !== 'content') fail.push(`${s.kind}: action fallback "${s.fallback}" is itself an action`);
      else {
        const r = DrillRoutes.resolveForFetch(s.kind, params);
        if (!DrillRoutes.sharePath(r.kind, r.params)) fail.push(`${s.kind}: fallback does not resolve to a path`);
      }
    }

    // appHash → parseAppHash must return the same surface and params. This is
    // the one that catches a route spelled two ways.
    checked++;
    const hash = '#' + String(s.appHash(params)).split('#')[1];
    const back = DrillRoutes.parseAppHash(hash, s.page);
    if (!back) fail.push(`${s.kind}: its own app hash ${hash} parses to nothing`);
    else if (back.kind !== s.kind) fail.push(`${s.kind}: app hash ${hash} parses as ${back.kind}`);
    else {
      for (const k of Object.keys(params)) {
        if (String(back.params[k]) !== String(params[k])) {
          fail.push(`${s.kind}: app hash round-trip lost ${k} (${params[k]} → ${back.params[k]})`);
        }
      }
    }

    // Content surfaces must round-trip the static path too.
    if (s.disposition === 'content') {
      checked++;
      const p = DrillRoutes.sharePath(s.kind, params);
      const parsed = DrillRoutes.parseSharePath(p);
      if (!parsed) fail.push(`${s.kind}: its own share path ${p} parses to nothing`);
      else if (parsed.kind !== s.kind) fail.push(`${s.kind}: share path ${p} parses as ${parsed.kind}`);
    }
  }

  // ── The parent chain (D15 phase 1) ────────────────────────────────────────
  // docs/information-architecture.md §5 rule 1: every row declares `parent`,
  // and the chain terminates at a top level without a cycle. Unenforced, this
  // decays exactly the way the routes themselves did — a row added without one
  // is a surface with no place in the hierarchy, and the only symptom is a
  // breadcrumb that silently stops one level short.
  for (const s of DrillRoutes.SURFACES) {
    checked++;
    if (!('parent' in s)) {
      fail.push(`${s.kind}: no \`parent\` — declare the containing surface, or null for a top level (docs/information-architecture.md §5)`);
      continue;
    }
    checked++;
    if (s.parent !== null && !DrillRoutes.SURFACES.some(x => x.kind === s.parent)) {
      fail.push(`${s.kind}: parent "${s.parent}" is not a surface`);
      continue;
    }
    // ancestors() throws on a cycle rather than hanging.
    checked++;
    try { DrillRoutes.ancestors(s.kind); }
    catch (e) { fail.push(`${s.kind}: ${e.message}`); continue; }

    // A crumb must be legible without the caller resolving anything — the
    // static pages and a cold app both render before titles are known.
    checked++;
    const trail = DrillRoutes.crumbs(s.kind, samples[s.kind] || {});
    if (trail.length !== DrillRoutes.ancestors(s.kind).length + 1) {
      fail.push(`${s.kind}: crumb trail length disagrees with its ancestor chain`);
    } else if (trail.some(c => !c.label || c.label === 'undefined')) {
      fail.push(`${s.kind}: a crumb has no label — add crumbLabel() to the row it came from`);
    }

    // Params flow down, so a parent must be addressable with its child's
    // params. This is what lets one object walk the whole trail.
    checked++;
    if (trail.some(c => !c.self && c.appHref == null)) {
      fail.push(`${s.kind}: an ancestor crumb has no appHref — its params don't survive the walk down from ${s.kind}`);
    }
  }

  // And the app's router must not be inventing routes behind the registry's
  // back. system-design.html declares its views in one table now; every value
  // there has to correspond to a surface.
  checked++;
  const page = fs.readFileSync(path.join(ROOT, 'system-design.html'), 'utf8');
  const m = page.match(/const ROUTE_VIEW = \{([\s\S]*?)\};/);
  if (!m) {
    fail.push('system-design.html: no ROUTE_VIEW table — the router is parsing hashes on its own again');
  } else {
    for (const kind of (m[1].match(/(\w+)\s*:/g) || []).map(x => x.replace(/\s*:$/, ''))) {
      checked++;
      if (!DrillRoutes.SURFACES.some(s => s.kind === kind)) {
        fail.push(`system-design.html routes "${kind}", which is not a surface in js/routes.js`);
      }
    }
  }
}

checkSurfacesResolve();
checkBridge();
checkSitemap();
checkVisualsRendered();
checkReconciliation();

if (fail.length) {
  console.error(`✗ URL contract broken — ${fail.length} of ${checked} checks failed:\n`);
  for (const f of fail.slice(0, 40)) console.error(`  ${f}`);
  if (fail.length > 40) console.error(`  … and ${fail.length - 40} more`);
  console.error('\nSee docs/url-contract.md. Usually the fix is:  node tools/build-share-pages.js');
  process.exit(1);
}
console.log(`✓ URL contract holds (${checked} checks: surfaces resolve, bridge points home, sitemap complete, visuals rendered, registry ⇄ router reconciled)`);
