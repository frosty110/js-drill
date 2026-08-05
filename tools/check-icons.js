#!/usr/bin/env node
// ============================================================================
//  tools/check-icons.js — one icon set, and it is the only one
// ============================================================================
// Invariant 9 (docs/invariants.md); the rules it enforces are written out in
// docs/iconography.md. Five checks, each guarding a failure that leaves the
// page rendering and every other signal green:
//
//   1. Every icon NAME resolves.        dsIcon('speling') returns '' — an icon
//                                       that silently isn't there.
//   2. Every MODE has a mark.           A launcher button with no DS_MODE_ICONS
//                                       entry falls back to a letter tile, so
//                                       one list shows icons beside initials.
//   3. No emoji in chrome.              Decision D07.
//   4. No icon-role text glyph.         '▸' '›' '✓' standing in for an icon —
//                                       a second icon system at a second weight.
//
// Usage: node tools/check-icons.js        (pre-commit / CI, no flags)
//
// ── On the missing escape hatch ─────────────────────────────────────────────
// This gate shipped as a RATCHET: design-system paths held zero while 492
// glyphs across 22 pre-system files carried a budget in
// data/icon-debt.lock.json that could only fall, re-baselined with --accept.
// The backlog was cleared in the same series of changes that added the gate, so
// the budget, the lock and the flag are gone: the rule is now a flat zero
// everywhere, which is a rule you can check with grep and cannot argue with.
// If a future backlog ever justifies a ratchet again, the shape is in git.
//
// ── What counts ─────────────────────────────────────────────────────────────
// Emoji is `\p{Emoji_Presentation}` plus U+FE0F — characters that render as a
// COLOUR glyph. That is the property that makes emoji look out of place beside
// a stroke icon, and it cleanly spares the typographic marks the app uses on
// purpose: ⌘ → ← — · ─ ★ are all text-presentation and pass.
//
// An icon-role text glyph is narrower, because '▸' in prose is fine and '▸' as
// a disclosure marker is not. Two shapes are flagged, both of which mean "this
// glyph IS the control": a string literal that is nothing but the glyph, and an
// element whose entire body is the glyph. A bullet inside a sentence is not a
// match.
//
// Unlike the emoji scan, this one SKIPS comment lines. Prose quotes a glyph to
// talk about it — js/breadcrumb.js's header comment says the app's old
// up-navigation was "`×` on a lesson, `Close` in a sheet" — and markdown
// backticks in a comment are indistinguishable from string delimiters to a
// regex. Skipping comments costs nothing: a render site is never on a line that
// starts with one.
//
// Neither scan excludes comments for emoji: "this file contains no emoji" is a
// rule anyone can check with grep and no parser can get wrong, where "no emoji
// in rendered strings" needs a JS/HTML parser that becomes its own hiding place.
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const EMOJI = /\p{Emoji_Presentation}|️/gu;

// A glyph doing an icon's job. Grouped by what it stands in for so a failure
// message can say which icon to reach for.
const STANDIN_ROLES = {
  '‹': 'chevron-left', '›': 'chevron-right', '▸': 'chevron-right', '▹': 'chevron-right',
  '▾': 'chevron-down', '▿': 'chevron-down', '▴': 'chevron-up', '▵': 'chevron-up',
  '▶': 'play', '◀': 'chevron-left', '⏸': 'pause', '⏵': 'play',
  '✓': 'check', '✔': 'check', '✗': 'alert', '✘': 'alert', '✕': 'x', '×': 'x',
  '☰': 'menu', '▦': 'grid', '⌫': 'x',
};
const STANDIN_CHARS = Object.keys(STANDIN_ROLES).join('');
// (a) a string literal that is ONLY the glyph   (b) an element whose whole body is the glyph
const STANDIN = new RegExp(
  `(?:['"\`]\\s*([${STANDIN_CHARS}])\\s*['"\`]|>\\s*([${STANDIN_CHARS}])\\s*<)`, 'gu');

// Everything the browser loads. tools/ and docs/ are not chrome.
const SCAN_DIRS = ['js', 'ds', 'css'];
const SCAN_FILES = ['index.html', 'system-design.html', 'diagnostic.html'];

// ds/icons.js owns the paths; ds/gallery.html is the catalog that renders them.
const SVG_ALLOWED = new Set(['ds/icons.js', 'ds/gallery.html']);
// This file names the glyphs it bans, which is not the same as using them.
const STANDIN_EXEMPT = new Set(['ds/gallery.html']);

// ── Load the set ────────────────────────────────────────────────────────────
// Evaluated rather than regex-scraped so the gate reads the same table the
// browser does — including DS_MODE_ICONS, whose values are icon names too.
function loadIconSet() {
  const src = fs.readFileSync(path.join(ROOT, 'ds', 'icons.js'), 'utf8');
  try {
    return new Function(`${src}\nreturn { DS_ICONS, DS_MODE_ICONS };`)();
  } catch (e) {
    console.error(`✗ ds/icons.js does not evaluate: ${e.message}`);
    process.exit(1);
  }
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, out);
    else if (/\.(html|js|css)$/.test(e.name)) out.push(abs);
  }
  return out;
}

function sources() {
  const files = [];
  for (const d of SCAN_DIRS) {
    const abs = path.join(ROOT, d);
    if (fs.existsSync(abs)) walk(abs, files);
  }
  for (const f of SCAN_FILES) {
    const abs = path.join(ROOT, f);
    if (fs.existsSync(abs)) files.push(abs);
  }
  return files.map(f => path.relative(ROOT, f).split(path.sep).join('/')).sort();
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

// ── Icon-name references ────────────────────────────────────────────────────
// Four spellings, one vocabulary:
//   dsIcon('x')      the design system's own call
//   icon('x')        a page-local wrapper (system-design.html)
//   data-icon="x"    static markup, filled at boot by mountChromeIcons()
//   icon: 'x'        a name carried in a registry row (nav items, Home areas,
//                    Settings rows) — and every `icon` field in the data/
//                    registries listed in ICON_REGISTRIES below
const REF_PATTERNS = [
  /\bdsIcon\(\s*['"]([A-Za-z0-9_-]+)['"]/g,
  /(?<![A-Za-z])icon\(\s*['"]([A-Za-z0-9_-]+)['"]/g,
  /data-icon\s*=\s*["']([A-Za-z0-9_-]+)["']/g,
  /(?<![A-Za-z-])icon:\s*['"]([A-Za-z0-9_-]+)['"]/g,
];

function iconRefs(rel, src) {
  const found = [];
  for (const re of REF_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) found.push({ name: m[1], rel, line: lineOf(src, m.index) });
  }
  return found;
}

// ── Run ─────────────────────────────────────────────────────────────────────
const { DS_ICONS, DS_MODE_ICONS } = loadIconSet();
const known = new Set(Object.keys(DS_ICONS));
const files = sources();
const failures = [];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// 1 ── every referenced name resolves
const refs = [];
for (const rel of files) refs.push(...iconRefs(rel, read(rel)));
for (const [id, name] of Object.entries(DS_MODE_ICONS || {})) {
  refs.push({ name, rel: 'ds/icons.js', line: 0, note: `DS_MODE_ICONS['${id}']` });
}
// Registries in data/ that name an icon. They are content by location and
// chrome by function, so a bad name there is invisible until the page renders
// nothing — data/paths.json shipped emoji in its `icon` field for a year past
// D07 precisely because it wasn't a surface file and nothing looked at it.
//
// Every `icon` field anywhere in these files is checked, at any depth, so a new
// registry row or a new nesting level is covered without touching this list.
const ICON_REGISTRIES = ['data/system-design/topics.json', 'data/paths.json'];
function collectIconFields(node, rel, trail) {
  if (Array.isArray(node)) { node.forEach((v, i) => collectIconFields(v, rel, `${trail}[${i}]`)); return; }
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (k === 'icon' && typeof v === 'string' && v) {
      refs.push({ name: v, rel, line: 0, note: `${trail}.icon${node.id ? ` ("${node.id}")` : ''}` });
    } else {
      collectIconFields(v, rel, trail ? `${trail}.${k}` : k);
    }
  }
}
for (const rel of ICON_REGISTRIES) {
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs)) collectIconFields(JSON.parse(fs.readFileSync(abs, 'utf8')), rel, '');
}
const unknown = refs.filter(r => !known.has(r.name));
if (unknown.length) {
  failures.push(
    `${unknown.length} icon reference${unknown.length === 1 ? '' : 's'} names an icon that isn't in ds/icons.js.\n` +
    `  dsIcon() returns '' for these — the icon is simply absent and the page still renders.\n` +
    unknown.map(u => `    ${u.rel}${u.line ? ':' + u.line : ''}  →  "${u.name}"${u.note ? ' (' + u.note + ')' : ''}`).join('\n') +
    `\n  Fix: add the icon to ds/icons.js, or use one of the ${known.size} that exist (see ds/gallery.html).`
  );
}

// 2 ── every launchable mode has a mark
// The Practice launcher falls back to the label's first LETTER, so a missing
// entry doesn't break anything — it just puts an initial in a row of icons.
const launcherIds = [...new Set(
  [...read('index.html').matchAll(/id="([a-z0-9-]+-btn)"/g)].map(m => m[1]))];
const unmarked = launcherIds.filter(id => !DS_MODE_ICONS[id]);
if (unmarked.length) {
  failures.push(
    `${unmarked.length} launcher button${unmarked.length === 1 ? '' : 's'} with no DS_MODE_ICONS entry.\n` +
    `  The Practice launcher falls back to the label's first letter, so these render\n` +
    `  as initials in a list of icons — nothing errors, the row just looks unfinished.\n` +
    unmarked.map(id => `    #${id}`).join('\n') +
    `\n  Fix: add a row to DS_MODE_ICONS in ds/icons.js.`
  );
}

// 3 ── no emoji in chrome
const emojiHits = [];
for (const rel of files) {
  const src = read(rel);
  const n = (src.match(EMOJI) || []).length;
  if (!n) continue;
  const where = src.split('\n')
    .map((l, i) => [i + 1, (l.match(EMOJI) || [])])
    .filter(([, hits]) => hits.length)
    .slice(0, 6)
    .map(([ln, hits]) => `      :${ln}  ${hits.join(' ')}`)
    .join('\n');
  emojiHits.push(`    ${rel} — ${n}\n${where}`);
}
if (emojiHits.length) {
  failures.push(
    `Emoji in ${emojiHits.length} file${emojiHits.length === 1 ? '' : 's'} (D07 — chrome draws from ds/icons.js only).\n` +
    emojiHits.join('\n') +
    `\n  Fix: replace with dsIcon('name'). Emoji stays fine in authored lesson\n` +
    `  content under data/, which this gate does not scan.`
  );
}

// 4 ── no text glyph standing in for an icon
// Line-by-line rather than whole-file, so a comment can quote a glyph in
// backticks without reading as a string literal (see the header note).
const IS_COMMENT = (l) => /^\s*(\/\/|\*|\/\*|<!--)/.test(l);
const standinHits = [];
for (const rel of files) {
  if (STANDIN_EXEMPT.has(rel)) continue;
  read(rel).split('\n').forEach((line, i) => {
    if (IS_COMMENT(line)) return;
    STANDIN.lastIndex = 0;
    let m;
    while ((m = STANDIN.exec(line))) {
      const g = m[1] || m[2];
      standinHits.push(`    ${rel}:${i + 1}  ${g}  →  dsIcon('${STANDIN_ROLES[g]}')`);
    }
  });
}
if (standinHits.length) {
  failures.push(
    `${standinHits.length} text glyph${standinHits.length === 1 ? '' : 's'} standing in for an icon.\n` +
    `  A glyph that IS the control is an icon, whatever font it comes from — and a\n` +
    `  font glyph is a second icon system at a second weight, next to the first.\n` +
    standinHits.join('\n') +
    `\n  Fix: use the suggested icon. A glyph inside running text (a bullet, an arrow\n` +
    `  in a label like "Next →") is typography and is not matched — see docs/iconography.md.`
  );
}

// 5 ── no inline <svg> outside the set
const inlined = [];
for (const rel of files) {
  if (SVG_ALLOWED.has(rel)) continue;
  const src = read(rel);
  const re = /<svg[\s>]/g;
  let m;
  while ((m = re.exec(src))) inlined.push(`    ${rel}:${lineOf(src, m.index)}`);
}
if (inlined.length) {
  failures.push(
    `${inlined.length} inline <svg> outside ds/icons.js.\n` +
    `  A copied path drifts from the set it was copied from and both still render.\n` +
    inlined.join('\n') +
    `\n  Fix: add the glyph to ds/icons.js and call dsIcon('name').`
  );
}

if (failures.length) {
  console.error('✗ icon consistency\n');
  for (const f of failures) console.error(f + '\n');
  console.error('Rules: docs/iconography.md · Invariant: docs/invariants.md § 9');
  process.exit(1);
}

console.log(
  `✓ icons: ${refs.length} references resolve against ${known.size} icons; ` +
  `all ${launcherIds.length} modes carry a mark; no emoji, no stand-in glyphs, no inline <svg>.`
);
