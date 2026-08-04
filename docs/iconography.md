# Iconography

One icon set, and it is the only one. This is the rules half; the enforcement
half is `tools/check-icons.js` (invariant 9) and `tools/cdp/sd-icons.js`.

```bash
node tools/check-icons.js      # in the default check-all run
node tools/cdp/sd-icons.js     # the rendered result, mobile + desktop
open ds/gallery.html           # every icon in the set, by name
```

---

## 1. The one rule

**Every glyph in chrome comes from `ds/icons.js` via `dsIcon(name)`.**

No emoji. No inline `<svg>`. No `▸`, `›`, `✓` standing in for an icon. The set
is 89 glyphs and grows by appending; if the one you want isn't there, add it
there rather than reaching for a character that looks close.

The reason is not taste. Three vocabularies were live at once — emoji, font
glyphs, and the stroke set — and they disagree on every axis a set has to agree
on:

| | weight | colour | size | platform |
|---|---|---|---|---|
| Emoji | its own | its own, always | its own | different on every OS |
| Font glyph (`▸`, `✓`) | the font's | inherits | font-size | different per font stack |
| `dsIcon` | 1.9px stroke | `currentColor` | the call's | identical everywhere |

Only the third can sit in a row with itself. A screen mixing them doesn't read
as designed — it reads as three people who never spoke.

**Emoji stays welcome in authored lesson content** under `data/`, which the gate
does not scan. A lesson can say whatever it wants; the app's chrome cannot.

---

## 2. Icon or typography?

This is the line the gate draws, and the one worth internalising:

> A glyph is an **icon** when it names an affordance or a status — when it *is*
> the control, or the verdict. It is **typography** when it is punctuation
> inside running text.

| Glyph | Where | Verdict |
|---|---|---|
| `›` on a row | it's the affordance — "this opens" | icon → `chevron-right` |
| `▾` on a disclosure | it's the control's state | icon → `chevron-down` |
| `✓` beside a result | it's the verdict | icon → `check` |
| `✕` on a close button | it *is* the button | icon → `x` |
| `→` in "Next →" | advances a sequence, inside a label | **typography** — stays |
| `·` between meta items | separator | **typography** — stays |
| `•` as a list bullet | list marker | **typography** — stays |
| `⌘K` in a hint | it names a key | **typography** — stays |
| `─` in a comment banner | it's a rule | **typography** — stays |

**Chevron vs. arrow** is the pair that gets confused. A **chevron** moves you
through a *hierarchy* — into a card, back to a parent, open a disclosure — and
is an icon. A trailing **arrow** advances a *sequence* — "Next →", "Continue →",
"Resume →" — and stays a character, because it belongs to the sentence, not to
the button.

**Disclosure markers drawn by CSS** are the one place a shape can't come from
`dsIcon()`: `::before` can't hold markup. Draw the triangle with borders
(`border-width: 4px 0 4px 6px`), as `#cheatsheet-body details > summary::before`
and `.q-brief > summary::before` do. Don't put a character back.

---

## 3. Sizes

`dsIcon(name, px)` — the second argument is the rendered size. There is no scale
to memorise, only three habits:

| Context | px |
|---|---|
| Inline in a label, in a button, in a chip | **13–15** |
| A row badge, a section heading, a tile | **16–19** |
| The one mark on an empty state or a hero | **26–32** |

Alignment is **not** a call site's problem. `dsIcon()` stamps `.ds-icon`
(`flex: none; vertical-align: -.16em`) on every glyph, which is exactly the two
things true of an icon wherever it lands: don't get squeezed by a flex parent,
sit on the text's centre line inline. If you find yourself writing a
`vertical-align` next to an icon, fix `.ds-icon` instead.

---

## 4. Tiles

When icons appear as a **set of peers** — a menu, a list of tracks, a row of
modes — they go in identical tiles: same box, same radius, same background, same
colour. The tile is what makes four unrelated subjects read as one menu.

```html
<span class="ds-row__badge">…</span>   <!-- ds/components.css, 30px -->
<span class="sd-badge">…</span>        <!-- system-design.html, sized per use -->
```

The System Design topic list is the worked example: four subjects (a book, a
method, a component catalog, 32 problems) that used to be 📕 🧭 🧱 📐 at four
different optical sizes. Same four ideas, one tile, and the menu became a menu.

A **lone** icon — inline in a button, beside a heading — takes no tile.

---

## 5. Adding an icon

1. Draw it Lucide-style: 24×24 viewBox, stroke only, `fill: none`, round caps.
   Register only the path data in `DS_ICONS`; `dsIcon()` supplies the wrapper.
2. Name it for **what it is**, not what it's for — `flame`, not `streak-badge`.
   One name per shape; several features may claim the same one.
3. Open `ds/gallery.html` and **look at it** next to the rest of the set. It is
   generated from `DS_ICONS`, so it can't fall behind. Check it reads at 26px
   and that it isn't a near-twin of a neighbour.
4. If a **launchable mode** claims it, add the mode's row to `DS_MODE_ICONS`
   (see below) rather than calling `dsIcon` at the render site.

Don't add an icon you aren't about to use. The gate can't see a dead one, and
the gallery makes it look like an option.

---

## 6. Modes: `DS_MODE_ICONS`

Every launchable mode declares its mark **once**, keyed by its launcher-button
id:

```js
'bug-hunt-btn': 'bug',
```

The Practice launcher, the command palette, the topbar menus, and the mode's own
session header all resolve through that row. Before it was complete, each of
those surfaces carried its own emoji for the same mode, and the launcher fell
back to the label's **first letter** for anything missing — so one list showed
stroke icons beside bare initials.

Coverage is gated: `check-icons.js` fails on a launcher button in `index.html`
with no entry, so a new mode can't ship without a mark.

A mode's glyph is **not** in its label. The label is the label. (It used to be
parsed out of the button text by a "first token has a non-ASCII byte" heuristic,
which made the button's text the de-facto icon registry.)

---

## 7. Static markup: `data-icon`

Markup that exists before any JS runs declares its own icon and gets filled at
boot. All three pages use the same convention:

```html
<button id="topbar-help" aria-label="Keyboard shortcuts"
        data-icon="help" data-icon-size="19"></button>
```

`mountChromeIcons()` fills every `[data-icon]` — `js/app/16-ds-nav.js` for the
app, the function of the same name in `system-design.html`, an inline sweep in
`ds/gallery.html`. This replaced a hardcoded selector→icon table that lived in
the JS: the element said one thing, the table said another, and only one of them
rendered.

---

## 8. Icon-only buttons

Every icon-only control carries an `aria-label`, **and the same string as
`title`** so hover teaches what the shape means. An icon without a name is a
rebus.

Icon-only is for repeated or secondary controls — close, expand, refresh,
per-row actions, topbar utilities. The one primary action on a surface, anything
destructive, and anything opening a *variable* destination gets a label
(`docs/ui-ux-guide.md` § Iconography).

---

## 9. What the gate checks

`tools/check-icons.js`, five checks, all of which fail loudly and none of which
has an escape hatch:

1. **Every referenced name resolves.** `dsIcon('refrsh')` returns `''` — an icon
   that silently isn't there, on a page that still renders perfectly.
2. **Every mode has a mark.** No launcher button without a `DS_MODE_ICONS` row.
3. **No emoji in chrome.** `\p{Emoji_Presentation}` + U+FE0F — colour glyphs.
   Comments included, because *"this file contains no emoji"* is checkable with
   `grep` and can't be got wrong, where *"no emoji in rendered strings"* needs a
   parser that becomes its own hiding place.
4. **No icon-role text glyph.** Three shapes are matched, all meaning "this
   glyph is the control": a string literal that is only the glyph, an element
   whose whole body is the glyph, and a glyph that opens a label (`✕ Exit`).
   A glyph *inside* a sentence is not matched — that's rule 2's line, mechanised.
5. **No inline `<svg>` outside `ds/icons.js`.** A copied path drifts from the
   set it was copied from and both keep rendering.

`tools/cdp/sd-icons.js` then checks the *rendered* result at both viewports,
including the one thing no single-file check can see: the mark System Design
wears as its wordmark is byte-identical to the one the app's nav rail draws for
Design.

---

## 10. History

D07 ("no emoji in chrome") was a rule in a doc for about a year with no gate.
When the gate was finally written it found **492 emoji across 22 files** — the
whole pre-design-system surface — so it shipped as a *ratchet*: design-system
paths at zero, legacy paths on a per-file budget in `data/icon-debt.lock.json`
that could only fall.

The backlog was cleared in the same series of changes, so the budget, the lock
and the `--accept` flag are gone and the rule is a flat zero. If a future
backlog ever justifies a ratchet again, the shape is in git history.

The lesson is the one in `docs/invariants.md` § Adding an invariant: a rule
without a gate is a rule that will be forgotten, and the size of what the gate
finds on day one is the measure of how long it went unenforced.
