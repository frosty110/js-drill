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
  }

  for (const t of targets) {
    const rel = DrillRoutes.sharePath(t.kind, t.params);
    checked++;
    if (!fs.existsSync(path.join(ROOT, rel, 'index.html'))) {
      fail.push(`no JS-free page for ${t.kind} → ${rel} (run: node tools/build-share-pages.js)`);
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

checkSurfacesResolve();
checkBridge();
checkSitemap();
checkVisualsRendered();

if (fail.length) {
  console.error(`✗ URL contract broken — ${fail.length} of ${checked} checks failed:\n`);
  for (const f of fail.slice(0, 40)) console.error(`  ${f}`);
  if (fail.length > 40) console.error(`  … and ${fail.length - 40} more`);
  console.error('\nSee docs/url-contract.md. Usually the fix is:  node tools/build-share-pages.js');
  process.exit(1);
}
console.log(`✓ URL contract holds (${checked} checks: surfaces resolve, bridge points home, sitemap complete, visuals rendered)`);
