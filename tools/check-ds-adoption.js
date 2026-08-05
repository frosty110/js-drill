#!/usr/bin/env node
// ============================================================================
//  tools/check-ds-adoption.js — the design system is used, not just present
// ============================================================================
// Invariant 10. ds/components.css defines the family's component vocabulary.
// Nothing enforced that a surface USE it, and the result was measurable: at the
// 2026-08-05 audit, system-design.html referenced `ds-btn` 24 times and every
// other primitive ZERO times, while carrying its own card (×4), chip (×8),
// progress bar (×4), stat tile and THREE separate empty states — all of which
// ds/components.css already had, and all of which index.html was already using.
//
// That is the same failure mode as the icon system before tools/check-icons.js:
// a vocabulary everyone agrees with and nobody is held to. Icons are consistent
// today because that gate is a flat zero. This is the same idea for components.
//
// Two checks, both RATCHETS rather than absolutes — the legacy CSS predates the
// design system by years and rewriting it wholesale is not the goal:
//
//   1. Re-declaration. A page stylesheet may not declare the LOOK of something
//      the design system already owns (surface + border + radius on a card,
//      a pill with its own background, a progress track, an empty state). The
//      budget below is the count at the time of writing; it may fall, never
//      rise. Layout — flex, grid, width, margin — is never counted: that is
//      exactly what a page SHOULD say about a primitive it composes.
//
//   2. Raw colour. A component rule may not hard-code a hex. Tokens exist so
//      "warn" is one colour in two places. Same ratchet.
//
// Escape hatch: none by design, but the budget is per-file, so a genuinely new
// component lands in ds/components.css (where the gallery documents it), not in
// a page file. If a number here must go UP, that is the conversation the gate
// exists to force.
//
// Usage: node tools/check-ds-adoption.js [--accept]
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCK = path.join(ROOT, 'data', 'ds-adoption.lock.json');

// Page stylesheets only. ds/ IS the design system; css/13-share-page.css styles
// the generated static pages, which deliberately ship without ds/components.css.
const FILES = [
  'css/01-base.css', 'css/02-sidebar.css', 'css/03-tabs.css', 'css/04-drills.css',
  'css/05-shell-chrome.css', 'css/06-ds-nav.css', 'css/07-ds-progress.css',
  'css/08-ds-browse.css', 'css/09-ds-settings.css', 'css/10-ds-lesson.css',
  'css/11-ds-home.css', 'css/12-ds-share.css', 'css/14-breadcrumb.css',
  'css/15-ds-shell.css', 'css/16-sd-shell.css', 'css/17-sd-page.css',
];

// A "rule" is a selector block. We look at DECLARATIONS inside it, not the
// selector name — a class called .thing-card that only sets `display:flex` is
// composing a primitive correctly, and a class called .foo that paints its own
// surface + border + radius is re-declaring one whatever it is named.
function rules(css) {
  const out = [];
  // Strip comments first so a hex in prose doesn't count.
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(bare))) {
    const sel = m[1].trim().split('\n').pop().trim();
    if (!sel || sel.startsWith('@')) continue;
    out.push({ sel, body: m[2] });
  }
  return out;
}

const has = (body, prop) => new RegExp(`(^|;|\\s)${prop}\\s*:`).test(body);

// A rule re-declares a primitive when it paints a SURFACE the design system
// already paints. Three signatures, each matching a real primitive:
function redeclares({ sel, body }) {
  // Never count the design system's own overrides or a state-only rule.
  if (/^\.ds-|,\s*\.ds-/.test(sel)) return null;
  const bg = has(body, 'background');
  const border = has(body, 'border') || has(body, 'border-color');
  const radius = has(body, 'border-radius');

  // .ds-card — a surface with a border and a corner radius.
  if (bg && border && radius && has(body, 'padding')) return 'card';
  // .ds-chip — a pill (999px / --ds-r-full) that paints its own background.
  if (bg && radius && /border-radius\s*:\s*(999px|var\(--ds-r-full\))/.test(body)) return 'chip';
  // .ds-progress — a track with an overflow-clipped fill.
  if (bg && radius && has(body, 'overflow') && /height\s*:\s*[2-9]px/.test(body)) return 'progress';
  return null;
}

const HEX = /#[0-9a-fA-F]{3,8}\b/g;

let report = {};
for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const css = fs.readFileSync(file, 'utf8');
  const redecl = rules(css).map(redeclares).filter(Boolean).length;
  const hex = (css.replace(/\/\*[\s\S]*?\*\//g, '').match(HEX) || []).length;
  report[rel] = { redeclared: redecl, hex };
}

if (process.argv.includes('--accept')) {
  fs.writeFileSync(LOCK, JSON.stringify(report, null, 2) + '\n');
  console.log(`✓ ds-adoption baseline written (${Object.keys(report).length} files)`);
  process.exit(0);
}

if (!fs.existsSync(LOCK)) {
  console.error('✗ data/ds-adoption.lock.json missing — run with --accept to baseline.');
  process.exit(1);
}
const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));

let errors = 0;
for (const [rel, now] of Object.entries(report)) {
  const was = lock[rel];
  if (!was) {
    console.error(`  ✗ ${rel}: new page stylesheet, not in the lock — run --accept once you have`);
    console.error(`      checked it composes ds/components.css instead of restating it`);
    console.error(`      (currently ${now.redeclared} re-declared primitive(s), ${now.hex} raw hex)`);
    errors++;
    continue;
  }
  if (now.redeclared > was.redeclared) {
    console.error(`  ✗ ${rel}: re-declares ${now.redeclared} design-system primitive(s), was ${was.redeclared}`);
    console.error(`      Compose the primitive instead: class="ds-card ${'<page-class>'}" and let the`);
    console.error(`      page rule carry only layout. See ds/gallery.html for what exists.`);
    errors++;
  }
  if (now.hex > was.hex) {
    console.error(`  ✗ ${rel}: ${now.hex} hard-coded hex colour(s), was ${was.hex} — use ds/tokens.css`);
    errors++;
  }
}

const totals = Object.values(report).reduce(
  (a, r) => ({ redeclared: a.redeclared + r.redeclared, hex: a.hex + r.hex }), { redeclared: 0, hex: 0 });
const base = Object.values(lock).reduce(
  (a, r) => ({ redeclared: a.redeclared + r.redeclared, hex: a.hex + r.hex }), { redeclared: 0, hex: 0 });

if (errors) {
  console.error(`\n✗ ds adoption: ${errors} regression(s). The ratchet only turns one way —`);
  console.error(`  --accept re-baselines, and is the right move ONLY when the number went DOWN.`);
  process.exit(1);
}
console.log(`✓ ds adoption: ${totals.redeclared} re-declared primitives (budget ${base.redeclared}), ` +
            `${totals.hex} raw hex (budget ${base.hex}) across ${Object.keys(report).length} page stylesheets`);
