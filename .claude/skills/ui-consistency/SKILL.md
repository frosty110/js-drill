---
name: ui-consistency
description: Enforce the shared design system, page frame, navigation contract, and storage layer across the JS-Drill family (index.html · system-design.html · diagnostic.html). Use whenever authoring a new page or surface, adding a mode, changing layout/styles, or touching localStorage — so parallel loops can't drift the product apart (the iter-35 incident + the design-loop's one-system rule).
---

# ui-consistency

Three user-facing pages (`index.html`, `system-design.html`, `diagnostic.html`)
share one audience, one visual language, and one localStorage origin. This skill
is the contract that keeps them — and every surface inside the main app —
feeling like one product.

**Full reference:** [`docs/ui-ux-guide.md`](../../../docs/ui-ux-guide.md).
Read it before building a new surface. This file is the enforceable short form.

## The sources of truth

| Concern | File | Never instead |
|---|---|---|
| Color · type · space · radius · motion · z-layers · breakpoint | `ds/tokens.css` | a hex in a component, a `:root` override per page |
| Reusable primitives (page frame, button, card, chip, row, sheet, nav, field, MC option, switch, segment, stat, progress, empty, skeleton) | `ds/components.css` | a per-surface copy of the same box |
| Icons | `ds/icons.js` → `dsIcon(name, px)` | inline one-off `<svg>`, emoji in chrome (D07) |
| Visual catalog | `ds/gallery.html` | guessing what exists |
| App-side styling of a ds surface | `css/06-ds-nav.css` … `10-ds-lesson.css` | app selectors inside `ds/` (breaks D04) |
| localStorage I/O | `js/storage.js` (`window.DrillStorage`) | `localStorage.getItem/setItem` |
| Static code blocks | CodeMirror `runMode` + Dracula theme | `<pre><code>` |

## The ten rules

1. **Reuse → extend → compose → build.** A new bespoke component needs a
   `DECISIONS.md` entry saying why nothing existing fits.
2. **390px first.** No horizontal scroll ever; every target ≥ `var(--ds-tap)` (44px).
3. **Tokens only.** No hex, no raw px for type/space/radius, no invented `z-index`.
4. **One page frame:** `.ds-page` → `.ds-page__head` (one `<h1>`) → `.ds-section`.
5. **One nav model.** 5 destinations + 2 rail-aux items, closed set. New modes go
   in the Practice launcher / palette, not the nav.
6. **Every launchable surface has a hidden `#<slug>-btn`** — that gives it the
   launcher, the palette, and the `#/m/<slug>` route. Routes must be safe to
   replay (never silently flip a setting or destroy data on arrival).
7. **Design all five states:** first-run · loading (skeleton, not spinner) ·
   empty (honest, one CTA — never fake/blurred sample data) · error (inline +
   retry) · offline.
8. **Right feedback channel:** toast = transient confirmation; inline = component
   failure; sheet/modal = must decide now; a Progress "Fix first" row = standing
   work. No notification bell, no modal for the non-blocking.
9. **Numbers never lie.** `0` when measured-and-zero, `—` when unknown. Invert
   trend colors where up-is-bad. Every stat is a real rep.
10. **Unverified at 390px = unshipped.** Screenshot + CDP probe assertion.

## Copy-this page skeleton

```js
shell.innerHTML = `
  <div class="ds-root ds-page foo-page">
    <header class="ds-page__head">
      <div class="ds-page__meta"><span>${escapeHtml(context)}</span>${chip}</div>
      <div class="ds-page__titlerow">
        <h1 class="ds-title">Foo</h1>
        <div class="ds-page__actions">${actions}</div>
      </div>
      <p class="ds-page__sub">${sub}</p>
    </header>
    <section class="ds-section">
      <span class="ds-label ds-section__label">Today</span>
      …
    </section>
  </div>`;
```

Live examples: `js/app/17-today-home.js`, `19-browse.js`, `20-progress.js`.
Overlays use `.ds-scrim` + `.ds-sheet` (see `18-practice-launcher.js`).

## Don't-reinvent checklist

- [ ] Does this color/size/duration already exist as a token? → use it; else add a
      *semantic* token to `ds/tokens.css` first.
- [ ] Does this component exist in `ds/gallery.html`? → card, chip, row, stat,
      sheet, switch, segment, MC option, field, empty, skeleton all do.
- [ ] Is this a page? → `.ds-page`. A picker? → `.ds-sheet`. Extra detail? →
      inline `<details>`. Blocking? → modal (rare).
- [ ] Icon? → `dsIcon()`; add new glyphs to `ds/icons.js`, never inline a path.
- [ ] Persisting state? → `state` + `saveProgress()`, mirrored in
      `loadProgress`, registered in a `js/sync.js` key registry.
- [ ] Reading another page's state? → a `DrillStorage` bridge helper
      (`readMainProgressMap`, `isLessonFullyDone`, `setMainLastLessonId`).
- [ ] Rendering static code? → CodeMirror `runMode`, not `<pre><code>`.
- [ ] New launchable surface? → hidden `#<slug>-btn` + taxonomy entry + route.
- [ ] Runs on a phone (the 80% case)? → probe it at 390×844.

## Verify

```bash
node tools/validate-data.js        # content + runner semantics
node tools/cdp/appsplit-smoke.js   # app boots, all slices load, no 404s
node tools/cdp/ds-page-frame.js    # page frame + nav invariants, both viewports
node tools/check-sync-coverage.js  # new state fields are registered for sync
```

Screenshot at 390×844 and 1280×900; keep the before/after pair. Chrome bootstrap
for Linux/CI environments is in `docs/ui-ux-guide.md` § 16.

## Why this exists

**iter-35:** `prep.html` shipped with its own `--bg`/`--panel`/`--accent`, its own
`localStorage` wrappers, and unhighlighted `<pre><code>` blocks. The user asked
"are we not reusing components?" — we weren't. The fix extracted the shared token
+ storage layers and wrote this skill.

**The design loop (D01–D14)** then rebuilt navigation, Browse, Progress, and
Settings on `ds/`. That work is only durable if every later change stays on the
system — which is what this skill checks. The measured legacy debt (hardcoded
hexes, breakpoint drift, off-system toasts) is inventoried in
`docs/ui-ux-guide.md` § 15: don't add to it, and clean only the block you're
already editing.
