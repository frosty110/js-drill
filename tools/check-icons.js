#!/usr/bin/env node
// ============================================================================
//  tools/check-icons.js — one icon set, and it is the only one
// ============================================================================
// Invariant 9 (docs/invariants.md). Three checks, each guarding a failure that
// leaves the page rendering and green:
//
//   1. Every icon NAME resolves.        dsIcon('speling') returns '' — an icon
//                                       that silently isn't there.
//   2. No inline <svg> outside ds/.     A copied path drifts from the set it
//                                       was copied from, and both look fine.
//   3. No emoji in chrome.              Decision D07. Ratcheted, see below.
//
// Usage:
//   node tools/check-icons.js            verify (pre-commit / CI)
//   node tools/check-icons.js --accept   re-baseline the LEGACY emoji budget
//
// ── On the ratchet ──────────────────────────────────────────────────────────
// D07 has been the rule since the design system landed, and the pre-design-system
// surfaces (index.html and js/app/01..15) never complied — a few hundred glyphs
// across legacy modal headings and mode labels. A gate that fails on all of it
// on day one gets switched off, and a rule with no gate is what produced the
// backlog. So the check is a RATCHET:
//
//   · STRICT paths must contain ZERO emoji. Everything built on the design
//     system is here, and a new file lands here by default (see isStrict).
//   · LEGACY paths carry a recorded budget in data/icon-debt.lock.json. The
//     count may fall, never rise. Migrate a file to zero and it is removed from
//     the lock — after which it is strict forever, with no way back.
//
// --accept re-baselines LEGACY entries only. There is deliberately no way to
// re-baseline a strict path: that is what makes the ratchet one-way.
//
// ── What counts as an emoji ────────────────────────────────────────────────
// `\p{Emoji_Presentation}` plus U+FE0F — characters that render as a COLOUR
// glyph. That is the property that makes emoji look out of place next to a
// stroke icon, and it cleanly spares the typographic marks the app legitimately
// uses: ⌘ → ← ‹ › ─ ★ are all text-presentation and pass.
//
// The scan does not exclude comments. "This file contains no emoji" is a rule
// anyone can check with grep and no parser can get wrong; "no emoji in rendered
// strings" needs a JS/HTML parser that would itself become a place for a bug to
// hide.
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ACCEPT = process.argv.includes('--accept');
const LOCK = path.join(ROOT, 'data', 'icon-debt.lock.json');

const EMOJI = /\p{Emoji_Presentation}|️/gu;

// Everything the browser loads. tools/ and docs/ are not chrome.
const SCAN_DIRS = ['js', 'ds', 'css'];
const SCAN_FILES = ['index.html', 'system-design.html', 'diagnostic.html'];

// The design-system era. A path is STRICT unless it is one of the surfaces that
// predates the system — so a new file is strict by default rather than by
// somebody remembering to add it.
const LEGACY_PREFIXES = [
  'index.html',
  'js/app/01-', 'js/app/02-', 'js/app/03-', 'js/app/04-', 'js/app/05-',
  'js/app/06-', 'js/app/07-', 'js/app/08-', 'js/app/09-', 'js/app/10-',
  'js/app/11-', 'js/app/12', 'js/app/13-', 'js/app/14-', 'js/app/15-',
  'js/core/',
  'css/01-', 'css/02-', 'css/03-', 'css/04-', 'css/05-',
];
const isStrict = (rel) => !LEGACY_PREFIXES.some(p => rel.startsWith(p));

// ds/icons.js owns the paths; ds/gallery.html is the catalog that renders them.
const SVG_ALLOWED = new Set(['ds/icons.js', 'ds/gallery.html']);

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

// ── Icon-name references ────────────────────────────────────────────────────
// Four spellings, one vocabulary:
//   dsIcon('x')      the design system's own call
//   icon('x')        a page-local wrapper (system-design.html)
//   data-icon="x"    static markup filled at boot
//   icon: 'x'        a name carried in a registry row (nav items, Home areas,
//                    Settings rows, data/system-design/topics.json)
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
    while ((m = re.exec(src))) {
      const line = src.slice(0, m.index).split('\n').length;
      found.push({ name: m[1], rel, line });
    }
  }
  return found;
}

// ── Run ─────────────────────────────────────────────────────────────────────
const { DS_ICONS, DS_MODE_ICONS } = loadIconSet();
const known = new Set(Object.keys(DS_ICONS));
const files = sources();
const failures = [];
const measured = {};

// 1 ── every referenced name resolves
const refs = [];
for (const rel of files) {
  refs.push(...iconRefs(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8')));
}
for (const [id, name] of Object.entries(DS_MODE_ICONS || {})) {
  refs.push({ name, rel: 'ds/icons.js', line: 0, note: `DS_MODE_ICONS['${id}']` });
}
// Content that names an icon. Registries live in data/, not in a surface file,
// so a bad name there is invisible until the page renders nothing.
const TOPICS = path.join(ROOT, 'data', 'system-design', 'topics.json');
if (fs.existsSync(TOPICS)) {
  for (const t of JSON.parse(fs.readFileSync(TOPICS, 'utf8')).topics || []) {
    if (t.icon) refs.push({ name: t.icon, rel: 'data/system-design/topics.json', line: 0, note: `topic "${t.id}"` });
  }
}
const unknown = refs.filter(r => !known.has(r.name));
if (unknown.length) {
  failures.push(
    `${unknown.length} icon reference${unknown.length === 1 ? '' : 's'} name${unknown.length === 1 ? 's' : ''} an icon that isn't in ds/icons.js.\n` +
    `  dsIcon() returns '' for these — the icon is simply absent and the page still renders.\n` +
    unknown.map(u => `    ${u.rel}${u.line ? ':' + u.line : ''}  →  "${u.name}"${u.note ? ' (' + u.note + ')' : ''}`).join('\n') +
    `\n  Fix: add the icon to ds/icons.js, or use one of the ${known.size} that exist.`
  );
}

// 2 ── no inline <svg> outside the set
const inlined = [];
for (const rel of files) {
  if (SVG_ALLOWED.has(rel)) continue;
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const re = /<svg[\s>]/g;
  let m;
  while ((m = re.exec(src))) inlined.push(`${rel}:${src.slice(0, m.index).split('\n').length}`);
}
if (inlined.length) {
  failures.push(
    `${inlined.length} inline <svg> outside ds/icons.js.\n` +
    `  A copied path drifts from the set it was copied from and nothing looks broken.\n` +
    inlined.map(l => `    ${l}`).join('\n') +
    `\n  Fix: add the glyph to ds/icons.js and call dsIcon('name').`
  );
}

// 3 ── the emoji ratchet
const lock = fs.existsSync(LOCK) ? JSON.parse(fs.readFileSync(LOCK, 'utf8')) : { budget: {} };
const budget = lock.budget || {};

for (const rel of files) {
  const n = (fs.readFileSync(path.join(ROOT, rel), 'utf8').match(EMOJI) || []).length;
  if (n) measured[rel] = n;
}

if (ACCEPT) {
  const next = {};
  for (const [rel, n] of Object.entries(measured)) {
    if (isStrict(rel)) continue;      // strict paths are never re-baselined
    next[rel] = n;
  }
  const before = Object.values(budget).reduce((a, b) => a + b, 0);
  const after = Object.values(next).reduce((a, b) => a + b, 0);
  fs.writeFileSync(LOCK, JSON.stringify({
    _: 'Legacy emoji-in-chrome budget (invariant 9). Counts may fall, never rise. ' +
       'A file that reaches zero leaves this list and becomes strict. ' +
       'Re-baseline: node tools/check-icons.js --accept',
    budget: Object.fromEntries(Object.entries(next).sort()),
  }, null, 2) + '\n');
  console.log(`✓ icon-debt lock re-baselined: ${before} → ${after} legacy emoji across ${Object.keys(next).length} files.`);
  return;
}

const strictHits = Object.entries(measured).filter(([rel]) => isStrict(rel));
if (strictHits.length) {
  failures.push(
    `Emoji in ${strictHits.length} design-system file${strictHits.length === 1 ? '' : 's'} (D07 — chrome uses ds/icons.js only).\n` +
    strictHits.map(([rel, n]) => {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
      const where = src.map((l, i) => [i + 1, (l.match(EMOJI) || [])])
        .filter(([, hits]) => hits.length)
        .slice(0, 6)
        .map(([ln, hits]) => `      :${ln}  ${hits.join(' ')}`)
        .join('\n');
      return `    ${rel} — ${n}\n${where}`;
    }).join('\n') +
    `\n  Fix: replace with dsIcon('name'). These paths have no budget and never will.`
  );
}

const risen = [];
const fallen = [];
for (const [rel, allowed] of Object.entries(budget)) {
  const now = measured[rel] || 0;
  if (now > allowed) risen.push(`    ${rel} — was ${allowed}, now ${now}`);
  else if (now < allowed) fallen.push(`    ${rel} — ${allowed} → ${now}`);
}
for (const [rel, n] of Object.entries(measured)) {
  if (!isStrict(rel) && !(rel in budget)) risen.push(`    ${rel} — was 0 (unlisted), now ${n}`);
}
if (risen.length) {
  failures.push(
    `The legacy emoji budget went UP — the ratchet only turns one way.\n` +
    risen.join('\n') +
    `\n  Fix: use dsIcon('name') instead. If the increase is genuinely intended,\n` +
    `  re-baseline with: node tools/check-icons.js --accept`
  );
}

if (failures.length) {
  console.error('✗ icon consistency\n');
  for (const f of failures) console.error(f + '\n');
  console.error('See docs/invariants.md § 9 and docs/ui-ux-guide.md § Iconography.');
  process.exit(1);
}

const legacyTotal = Object.values(budget).reduce((a, b) => a + b, 0);
console.log(
  `✓ icons: ${refs.length} references resolve against ${known.size} icons; ` +
  `no inline <svg>; ${Object.keys(budget).length} legacy files hold ${legacyTotal} emoji (ratcheting down).`
);
if (fallen.length) {
  console.log(`  ${fallen.length} file(s) below budget — re-baseline to lock the win in:`);
  console.log(fallen.join('\n'));
  console.log('  node tools/check-icons.js --accept');
}
