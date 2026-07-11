---
name: ui-consistency
description: Enforce shared UI tokens, storage layer, and code-rendering patterns across the JS-Drill family (main app + prep dashboard + diagnostic). Use whenever authoring a new page, adding a feature that touches localStorage, or rendering a static code block — to prevent the design-system / storage drift that surfaced in iter-35 (prep.html shipped with its own --bg, --panel, --accent vars and its own localStorage wrappers that broke when main app's schema bumped).
---

# ui-consistency

This project has three user-facing pages: `index.html` (main drill app),
`prep.html` (4-day interview prep dashboard), and `diagnostic.html` (self-test).
They share an audience, a visual language, and a localStorage origin. When they
drift apart, the user pays — same color name means different colors per page,
prep auto-checks lessons by reading the main app's storage with stale
assumptions about the schema, etc.

This skill is the contract that keeps the three in sync.

## The three sources of truth

| Concern | File | What it owns |
|---|---|---|
| Design tokens (colors, radii, type, spacing) | `ds/tokens.css` | Every color, radius, font, and spacing constant used across the family. |
| localStorage I/O | `js/storage.js` (exposed as `window.DrillStorage`) | All reads, writes, schema versioning, and cross-page bridge helpers. |
| Static code blocks (Reference, L2 templates, Code shapes, Review answers) | CodeMirror `runMode` addon | Syntax-highlighted, Dracula-themed, mobile-readable code. |

Anything that touches these concerns goes through the corresponding file.
Period. No inline forks "just for this page."

## The five rules

### 1. Don't define colors in component CSS

```css
/* WRONG — drift incoming */
.my-card { background: #1e293b; border: 1px solid #334155; }

/* RIGHT — consume tokens */
.my-card { background: var(--panel); border: 1px solid var(--panel-2); }
```

If you need a new color, add it to `ds/tokens.css` with a semantic name. Don't
hard-code hex in a component file. Don't redeclare a token in a page's `:root`
block — that just creates a per-page shadow that defeats the whole point.

The single exception: page-specific layout vars like `--tabbar-h` or
`--safe-bottom` belong in that page's `:root`. They're not palette.

### 2. Don't touch `localStorage` directly

```js
/* WRONG — bypasses versioning, no migration handshake, silent break when schema bumps */
const raw = localStorage.getItem('jsdrill.progress.v1');
const data = JSON.parse(raw);

/* RIGHT — versioned + defensive */
const data = window.DrillStorage.loadAppProgress();
```

`DrillStorage` exposes:
- `loadAppProgress()` / `saveAppProgress(state)` — main app
- `loadPrepState()` / `savePrepState(state)` — prep dashboard
- `loadDiagnostic()` / `saveDiagnostic(state)` — diagnostic

For cross-app reads (prep checking main-app lesson completion) use the bridge
helpers, never raw `localStorage`:
- `readMainProgressMap()` — defensive `{}` fallback on any failure
- `isLessonFullyDone(lessonId)` / `isLessonPartiallyDone(lessonId)`
- `setMainLastLessonId(lessonId)` — for deep-linking into a lesson

The only direct `localStorage` calls left in the codebase are:
- The backup-download button in `app.js` (needs the exact persisted bytes)
- The multi-tab `storage` event listener in `app.js` (needs the raw key for filtering)
- The reset button in `diagnostic.html` (`removeItem` only)

If you find yourself reaching for `localStorage.getItem` outside these
exceptions, stop and add a method to `DrillStorage` instead.

### 3. Static code blocks go through CodeMirror `runMode`

The main app already loads CodeMirror 5.65.16 + the Dracula theme + the
`runmode` addon. `prep.html` and `diagnostic.html` should `<link>` and
`<script>` the same CDN URLs (copy them from `index.html`'s head).

```js
/* WRONG — plain <pre><code> renders without highlighting; looks unpolished
   on mobile and differs from the main app's polish. */
host.innerHTML = `<pre><code>${escapeHtml(code)}</code></pre>`;

/* RIGHT — same tokenizer + theme the main app uses */
function renderCmInto(host, code) {
  host.innerHTML = '';
  const pre = document.createElement('pre');
  pre.className = 'CodeMirror cm-s-dracula';
  pre.style.cssText = 'margin:0;padding:10px 12px;background:#282a36;' +
    'color:#f8f8f2;font:inherit;overflow-x:auto;-webkit-overflow-scrolling:touch';
  const codeEl = document.createElement('code');
  codeEl.style.cssText = 'background:none;padding:0;color:inherit;' +
    'font:inherit;display:block;white-space:pre';
  pre.appendChild(codeEl);
  host.appendChild(pre);
  window.CodeMirror.runMode(code, 'javascript', codeEl);
}
```

This pattern lives in `prep.html` as `renderCmInto`. If you add a third page
that renders static code, hoist this function into `js/storage.js` (or a new
`js/code-render.js`) and consume it from there. Don't fork it inline.

### 4. Load shared infrastructure in the right order

Every page that consumes the shared layer needs this in `<head>`, BEFORE its
own styles and scripts:

```html
<!-- CodeMirror (theme + tokenizer + runMode) -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/theme/dracula.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/javascript/javascript.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/runmode/runmode.min.js"></script>

<!-- Shared design tokens + storage layer. Source of truth across pages. -->
<link rel="stylesheet" href="ds/tokens.css">
<script src="js/storage.js"></script>
```

Then your page's own `<style>` and `<script>` go after. Order matters: if your
page declares `:root { --panel: …; }` AFTER `ds/tokens.css` loads, you shadow the
shared token. Don't.

### 5. Verify with the mobile probe

Any change to `prep.html` or `diagnostic.html` runs:

```bash
node tools/cdp/prep-mobile.js
```

The probe asserts CodeMirror tokens are present (`.cm-keyword/.cm-def/.cm-variable`
count > 10), checkboxes work, the storage bridge survives a write+read+grade flow,
and nothing horizontally overflows at iPhone-13 viewport (390×844). If you add
a new tab or interactive surface to prep, add a matching assertion.

For changes to `index.html` / `app.js` / `app.css`, the existing CDP probes
under `tools/cdp/` cover the main flows. Add a new probe if you ship a new
surface; don't bolt assertions onto unrelated probes.

## The "don't reinvent" checklist

Before authoring a new page or feature, run through this list:

- [ ] Does this color already exist as a token in `ds/tokens.css`?
  → If yes: reference it. If no: add it with a semantic name first, then reference.
- [ ] Does this UI need to persist state across sessions?
  → If yes: add a method to `DrillStorage`. Don't call `localStorage` directly.
- [ ] Does this UI need to read state from another page (main app's progress)?
  → If yes: use a `DrillStorage` bridge helper. Don't read another page's
    localStorage key directly.
- [ ] Does this UI render static code?
  → If yes: use `renderCmInto` (or hoist it to a shared helper). Don't use
    plain `<pre><code>`.
- [ ] Will this UI run on a phone (the 80% case per PROFILE.md)?
  → If yes: write a CDP probe. iPhone-13 viewport. Assert no horizontal overflow.

## Why this exists (the iter-35 lesson)

When `prep.html` first shipped, it had its own `--bg`/`--panel`/`--accent` CSS
vars (different colors from main app's Tailwind palette), its own
`save()`/`load()` wrappers around `localStorage`, and its own
`<pre><code>`-rendered code blocks (no syntax highlighting). The user noticed
that "the code viewer doesn't look good on mobile" and asked "are we not
reusing components?" — the answer was no, we'd reinvented the wheel.

The fix (iter-35) extracted `ds/tokens.css` + `js/storage.js`, migrated all three
pages to consume them, and authored this skill so the drift can't recur.

If a future iteration adds a fourth page (e.g., a stats dashboard, a mentor
board, a shared playground), it MUST consume `ds/tokens.css` and `DrillStorage`.
No exceptions without a documented reason.
