#!/usr/bin/env node
// ============================================================================
//  tools/check-tailwind-subset.js — the utilities used are the utilities built
// ============================================================================
// css/00-tailwind.css is generated and COMMITTED, and index.html loads it as a
// plain stylesheet. That is a straight trade: the app stopped shipping the
// Tailwind compiler to every visitor, and in exchange a utility class that is
// used but not built now silently does nothing.
//
// Before, `cdn.tailwindcss.com` watched the DOM and generated whatever it saw,
// so adding `class="mt-12"` anywhere just worked. Now it has to be in the
// build. This gate is what keeps that from being a footgun: it re-derives the
// used set with a SECOND, independent scanner (the generator relies on
// Tailwind's own content scanning) and fails when the two disagree.
//
// Deliberately dependency-free — .github/workflows/checks.yml runs the gates
// with no `npm install`, so verifying must never need tailwindcss even though
// regenerating does.
//
//   node tools/check-tailwind-subset.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSS = path.join(ROOT, 'css', '00-tailwind.css');

// ── What counts as a Tailwind utility ──────────────────────────────────────
// Narrow on purpose. Anything matching this is expected to be BUILT; anything
// not matching is assumed to be one of the app's own class names and is the
// stylesheets' problem, not this gate's.
// Variants and families are hand-maintained, so gaps here are silent: a used
// utility outside this list is neither built nor reported, and simply renders
// as nothing. `top-0`/`inset-0` were exactly that gap. Widen this list when you
// reach for a family it doesn't cover.
const TW = new RegExp('^(?:(?:sm|md|lg|xl|2xl|dark|hover|focus|focus-visible|active|disabled|group-hover|first|last|odd|even):)*(?:' + [
  'flex', 'grid', 'block', 'inline(?:-block|-flex)?', 'hidden', 'table', 'contents',
  'absolute', 'relative', 'fixed', 'sticky', 'static',
  '(?:items|justify|self|content|place)-[a-z]+',
  'flex-(?:row|col|wrap|nowrap|1|auto|none|initial)',
  'grid-cols-\\d+', 'col-span-\\d+',
  'gap(?:-[xy])?-\\d+', 'space-[xy]-\\d+',
  '[pm][xytblr]?-(?:\\d+|auto|px)',
  '[wh]-(?:\\d+|full|screen|auto|px|\\d+\\/\\d+)',
  '(?:min|max)-[wh]-[a-z0-9]+',
  'text-(?:xs|sm|base|lg|xl|\\dxl|left|center|right|justify)',
  'text-(?:white|black|transparent)',
  'text-[a-z]+-\\d{2,3}',
  'bg-(?:white|black|transparent)', 'bg-[a-z]+-\\d{2,3}',
  'border(?:-[a-z0-9]+)?', 'rounded(?:-(?:sm|md|lg|xl|\\dxl|full|none))?',
  'font-(?:thin|light|normal|medium|semibold|bold|extrabold|black|mono|sans|serif)',
  'leading-[a-z0-9]+', 'tracking-[a-z]+', 'opacity-\\d+', 'shadow(?:-[a-z]+)?',
  'overflow(?:-[xy])?-(?:auto|hidden|scroll|visible)',
  'z-\\d+', 'cursor-[a-z]+', 'select-[a-z]+', 'truncate',
  'uppercase', 'lowercase', 'capitalize', 'underline', 'whitespace-[a-z]+',
  'transition(?:-[a-z]+)?', 'duration-\\d+', 'order-\\d+',
  'shrink(?:-0)?', 'grow(?:-0)?', 'basis-[a-z0-9\\/]+',
  'ring(?:-\\d+)?', 'divide-[a-z0-9-]+', 'antialiased', 'sr-only',
  'pointer-events-[a-z]+', 'resize(?:-[a-z]+)?',
  // Added after a sweep found `top-0` and `inset-0` used-but-unbuilt with the
  // gate green. Positioning, transforms and list/outline families were all
  // missing from the original list.
  '(?:top|right|bottom|left)-(?:\\d+|auto|px|full|\\d+\\/\\d+)',
  'inset(?:-[xy])?-(?:\\d+|auto|px|full)',
  'object-[a-z]+', 'aspect-[a-z]+', 'animate-[a-z]+',
  'scale-\\d+', 'rotate-\\d+', '(?:translate|-translate)-[xy]-[a-z0-9\\/]+',
  'list-[a-z]+', 'col-start-\\d+', 'col-end-\\d+', 'row-span-\\d+',
  'outline(?:-[a-z0-9]+)?', 'align-[a-z]+', 'float-[a-z]+', 'isolate',
  'backdrop-[a-z-]+\\d*', 'break-[a-z]+', 'indent-\\d+'
].join('|') + ')$');

// ── Collect every class token the code applies ─────────────────────────────
function sources() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'vendor') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.js$/.test(e.name)) out.push(p);
    }
  };
  for (const d of ['js', 'ds']) walk(path.join(ROOT, d));
  out.push(path.join(ROOT, 'index.html'));
  return out;
}

const used = new Set();
for (const f of sources()) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/class(?:Name)?\s*=\s*["'`]([^"'`]*)["'`]/g))
    for (const t of m[1].split(/\s+/)) if (t) used.add(t);
  for (const m of src.matchAll(/classList\.(?:add|remove|toggle)\(([^)]*)\)/g))
    for (const q of m[1].matchAll(/["'`]([^"'`\s]+)["'`]/g)) used.add(q[1]);
}
const wanted = [...used].filter(t => TW.test(t)).sort();

// ── Collect every class the generated stylesheet defines ───────────────────
if (!fs.existsSync(CSS)) {
  console.error('✗ css/00-tailwind.css is missing — run: node tools/build-tailwind-subset.js');
  process.exit(1);
}
const css = fs.readFileSync(CSS, 'utf8');
const built = new Set();
// Selectors escape the characters that are illegal raw in CSS idents:
// `.hover\:text-cyan-300:hover`, `.w-1\/2`. Unescape back to the authored name
// and drop any trailing pseudo-class.
for (const m of css.matchAll(/\.((?:[A-Za-z0-9_-]|\\.)+)/g)) {
  built.add(m[1].replace(/\\(.)/g, '$1'));
}

const missing = wanted.filter(u => !built.has(u));

// ── Preflight must survive ─────────────────────────────────────────────────
// css/01-base.css sets a font and a background and nothing else. Every margin
// reset, `button { font: inherit }` and `img { display: block }` the layout
// assumes comes from Tailwind's base layer. A build with preflight disabled
// still passes the utility check above while restyling the entire page.
const problems = [];
if (!/\*\s*,\s*::before/.test(css) && !/box-sizing:\s*border-box/.test(css)) {
  problems.push('preflight is missing from the build (corePlugins.preflight must stay true)');
}
if (!/margin:\s*0/.test(css)) {
  problems.push('preflight margin reset is missing — headings and lists will re-inherit UA margins');
}

// ── No page may reintroduce the runtime compiler ───────────────────────────
// Comments are stripped first: index.html explains in prose why the CDN script
// was removed, and naming a URL in a comment is not loading it.
for (const page of ['index.html', 'system-design.html', 'diagnostic.html']) {
  const p = path.join(ROOT, page);
  if (!fs.existsSync(p)) continue;
  const html = fs.readFileSync(p, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  if (/cdn\.tailwindcss\.com/.test(html)) {
    problems.push(`${page} loads cdn.tailwindcss.com again — that is the compiler, not a stylesheet`);
  }
}

if (missing.length || problems.length) {
  console.error('\n✗ Tailwind subset is out of date.\n');
  for (const p of problems) console.error(`   ✗ ${p}`);
  if (missing.length) {
    console.error(`   ✗ ${missing.length} utility class(es) used in the code but not built:`);
    for (const m of missing) console.error(`       ${m}`);
    console.error('\n   These render as nothing. Regenerate:');
    console.error('       npm install && node tools/build-tailwind-subset.js');
  }
  console.error('');
  process.exit(1);
}

console.log(`✓ Tailwind subset: ${wanted.length} used utilities all built, preflight intact, no CDN compiler.`);
