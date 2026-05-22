# Migration Notes — Multi-file Content + Mobile + Syntax Highlighting

Started **2026-05-21**.

The single-file `index.html` reached 8,654 lines and was becoming unsustainable to
edit and unfriendly on mobile (no line wrap, no syntax colors on read-only blocks,
small fonts that triggered iOS zoom-on-focus). This refactor fixes those without
giving up the "open `index.html` in a browser, no build step" property.

## Goals

1. **Shrink `index.html`** to ~1,500 lines of app shell + logic — no inline content.
2. **One JSON per lesson**, grouped under `data/<section-slug>/<lesson-id>.json`,
   so the AI (and humans) can read/edit one lesson without scanning a wall of
   code. This is the most maintainable shape for extending the curriculum.
3. **Syntax highlighting everywhere** — reference cards, diff view, L2 templates,
   not just the L3 editor.
4. **Mobile readability** — line wrap on, 16px editor font, sticky action bar.
5. **Zero new dependencies.** CodeMirror is already loaded; we reuse it in
   `readOnly` mode for all static code blocks.
6. **No build step.** `index.html` + plain JSON fetched over HTTP. Open it in a
   browser, serve via `python3 -m http.server`, or push to GitHub Pages.

## Principles

- **Source of truth lives in `data/`.** `index.html` carries no lesson content.
- **Lazy loading per lesson.** On boot we fetch only `data/manifest.json` (a tiny
  index of `{id, title, section, track, status}`); the lesson body is fetched on
  first click and cached in a `Map`. Subsequent visits are instant.
- **Manifest must stay in sync with disk.** A helper `node validate-data.js`
  diffs the manifest against the filesystem and fails loudly on drift.
- **Backwards-compatible progress.** `localStorage` keys are by `lesson.id` and
  don't change. Existing users keep their streaks.
- **CodeMirror is the only renderer for code.** Don't ship two styles of code
  block — every snippet uses the same Dracula theme, the same font, the same
  wrap behavior. Read-only blocks use `readOnly: 'nocursor'`.
- **Don't recreate CodeMirror instances on every render.** Reuse where possible
  to keep scrolling and focus stable.

## Authoring workflow (after this refactor)

1. Add a new file `data/<section-slug>/<lesson-id>.json` following the schema
   below.
2. Add the lesson's entry to `data/manifest.json` (id, title, section, track,
   status).
3. Verify the L2 fill-ins and L3 canonical run cleanly with `node validate-data.js`
   (see the script for details — it uses the same runner semantics as the app).
4. Reload the app — the lesson appears with its status dot.

### Lesson JSON schema

```jsonc
{
  "id": "two-sum",
  "title": "Two Sum (hash map)",
  "section": "Arrays & Hashing",
  "track": "patterns",
  "status": "full",                  // or "stub"
  "description": "One sentence.",
  "reference": {
    "code": "// canonical code",
    "notes": ["Gotcha 1", "Gotcha 2"]
  },
  "L1": { "questions": [
    { "q": "...", "options": ["a","b","c","d"], "answer": 1, "explain": "..." }
  ]},
  "L2": { "exercises": [
    { "prompt": "...", "template": "// code with ___",
      "blanks": [{ "answer": "word", "hint": "..." }],
      "expectedOutput": "..." }
  ]},
  "L3": {
    "prompt": "...",
    "expectedOutput": "...",
    "canonical": "// full working solution",
    "hints": ["..."]
  }
}
```

## Learnings (collected as the refactor proceeds)

- **`<pre class="code-block">` is not enough.** Static code blocks on phones
  need both syntax color (parsing cues) and line wrap (no horizontal scroll on a
  4-inch screen). CodeMirror in `readOnly: 'nocursor'` mode gives both for free.
- **`white-space: pre` was the mobile killer.** It forced long lines to scroll
  horizontally; combined with no colors, blocks looked like impenetrable beige
  walls.
- **iOS Safari zooms inputs with `font-size < 16px`.** The L3 editor was 14px,
  so opening it on iPhone caused an unwanted zoom-in. Mobile breakpoint bumps
  to 16px to suppress this.
- **`lineWrapping: true` on CodeMirror is the single biggest mobile win.** Even
  on desktop, wrapping long lines is friendlier for studying.
- **Lazy-load by click is fine.** Each lesson JSON is small (5–40KB). Fetch on
  first click, cache forever. Avoids the complexity of bundle-per-section.
- **The Node verification trick in CLAUDE.md still works** — just point it at
  the lesson JSON files instead of grepping the inline CONTENT object.

## What this refactor explicitly does NOT do

- Doesn't change any lesson content. All 184 verified exercises must still pass.
- Doesn't change `localStorage` schema or progress keys.
- Doesn't introduce a build step, bundler, or new runtime dependency.
- Doesn't rework the sidebar UX or starter path. (Future work.)
