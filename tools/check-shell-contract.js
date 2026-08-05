#!/usr/bin/env node
// ============================================================================
//  tools/check-shell-contract.js — shared chrome stays shared
// ============================================================================
// The rule (docs/information-architecture.md §4, D15):
//
//     A component that reaches for an element it does not create is not a
//     component. It is a script with an undeclared dependency on one page.
//
// This is not a style preference; it is the exact defect that made System
// Design lose the rail and the header. js/app/16-ds-nav.js declared every nav
// item as a DOM id it synthetically clicked, six of which existed only on
// index.html — and the seventh, `home-btn`, existed on BOTH pages meaning
// different things, so the failure would not even have been loud.
//
// The failure mode is invisible from the page that works. You only see it by
// opening the other page, which is why it survived a design-loop, an audit and
// 181 probes. So it gets a gate.
//
//   1. ds/ may not name an id or class it does not create. Shared chrome
//      asks the page for CAPABILITIES; it never reaches for the page's DOM.
//   2. Every primary-nav destination resolves to a real route row. A rung with
//      no address is a place the URL contract cannot describe (Practice was
//      exactly that: it never changed the URL, in either state).
//   3. The nav is closed at the count the IA doc declares.
//   4. Both hash-routed pages mount the shell. A page that does not is a page
//      the user arrives at and loses the chrome.
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DrillRoutes = require(path.join(ROOT, 'js', 'routes.js'));

const fail = [];
let checked = 0;

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ── 1. The ds/ layer owns no page ───────────────────────────────────────────
// Ids the shell CREATES are fine to look up — it put them there. Everything
// else is a page reaching into a page.
const SHELL_OWNED = new Set(['ds-appnav', 'ds-shellbar', 'ds-crumbs']);

function checkNoPageIds() {
  for (const file of ['ds/shell.js', 'js/breadcrumb.js']) {
    const src = read(file);
    const ids = [...src.matchAll(/getElementById\(\s*['"]([\w-]+)['"]\s*\)/g)].map(m => m[1]);
    for (const id of ids) {
      checked++;
      if (!SHELL_OWNED.has(id)) {
        fail.push(`${file}: reaches for #${id}, which it does not create — pass it in as a capability instead (docs/information-architecture.md §4)`);
      }
    }
    // The other spelling of the same mistake.
    checked++;
    const cls = [...src.matchAll(/querySelector(?:All)?\(\s*['"]\.([\w-]+)/g)].map(m => m[1])
      .filter(c => !c.startsWith('ds-'));
    if (cls.length) {
      fail.push(`${file}: selects page class(es) .${cls.join(', .')} — shared chrome may only select its own ds- classes`);
    }
  }
}

// ── 2 & 3. Every rung is a route, and there are only so many rungs ──────────
// Parsing rather than importing: ds/shell.js is a browser script, and the
// declaration is what we want to check anyway.
const DECLARED_DESTINATIONS = 3;

function checkNavIsRouted() {
  const src = read('ds/shell.js');
  const block = src.slice(src.indexOf('const DESTINATIONS'), src.indexOf('const AUX'));
  const kinds = [...block.matchAll(/route:\s*\{\s*kind:\s*'([\w]+)'/g)].map(m => m[1]);

  checked++;
  if (kinds.length !== DECLARED_DESTINATIONS) {
    fail.push(`ds/shell.js declares ${kinds.length} nav destinations; the IA closes the nav at ${DECLARED_DESTINATIONS} (docs/information-architecture.md §4). Changing the count is a decision — record it in DECISIONS.md and update this gate.`);
  }

  for (const kind of kinds) {
    checked++;
    if (!DrillRoutes.SURFACES.some(s => s.kind === kind)) {
      fail.push(`ds/shell.js: nav destination routes to "${kind}", which is not a surface in js/routes.js`);
      continue;
    }
    // A destination the user can be AT must be somewhere aria-current can
    // resolve to — i.e. a top level, or the chain would light a different rung.
    checked++;
    if (DrillRoutes.ancestors(kind).length) {
      fail.push(`ds/shell.js: nav destination "${kind}" is not a top-level surface (its parent chain runs through ${DrillRoutes.ancestors(kind).join(' → ')}), so no surface under it can light it`);
    }
  }

  // Every destination must also be reachable from every page that mounts the
  // shell — that IS the composability property, and hrefFrom is what provides
  // it, so exercise it from both pages.
  for (const page of ['index.html', 'system-design.html']) {
    for (const kind of kinds) {
      checked++;
      const params = kind === 'appMode' ? { mode: 'home' } : {};
      const href = DrillRoutes.hrefFrom(kind, params, page);
      if (!href) fail.push(`ds/shell.js: destination "${kind}" has no address from ${page}`);
    }
  }
}

// ── 4. Both hash-routed pages actually mount it ─────────────────────────────
function checkPagesMount() {
  for (const page of ['index.html', 'system-design.html']) {
    const src = read(page);
    checked++;
    if (!/ds\/shell\.js/.test(src)) fail.push(`${page}: does not load ds/shell.js — arriving here would drop the nav and the header`);
    checked++;
    if (!/id="ds-shellbar"/.test(src)) fail.push(`${page}: has no #ds-shellbar mount point, so the shell has nowhere to put the header`);
  }
  // And nothing may resurrect a second nav.
  checked++;
  const idx = read('index.html');
  if (/class="topbar-menus"/.test(idx)) {
    fail.push('index.html: the topbar menubar is back — that is a second navigation, which is what D15 removed');
  }
}

checkNoPageIds();
checkNavIsRouted();
checkPagesMount();

if (fail.length) {
  console.error(`✗ shell contract broken — ${fail.length} of ${checked} checks failed:\n`);
  for (const f of fail) console.error(`  ${f}`);
  console.error('\nSee docs/information-architecture.md §4.');
  process.exit(1);
}
console.log(`✓ shell contract holds (${checked} checks: ds/ owns no page, every rung is a routed top-level surface reachable from both pages, both pages mount the shell)`);
