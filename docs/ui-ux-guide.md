# UI/UX Consistency Guide

**Audience:** every agent (and human) who adds or changes a pixel in this repo.
**Purpose:** make the app feel like *one* product built by *one* team, no matter
how many parallel loops touch it. Consistency here is not decoration — it is how
a phone-first user builds muscle memory for navigation instead of re-learning
each screen.

**Precedence when docs disagree:**

```
PROFILE.md  ─────────────────────────►  law (who we build for)
  └─ design-loop/PRINCIPLES.md  ──────►  the 8 operating principles
       └─ design-loop/DECISIONS.md ───►  ratified decisions (D01…D14) — binding
            └─ THIS FILE  ────────────►  how to implement them consistently
                 └─ your taste  ──────►  last
```

If you need to break a rule here, you are making a *design decision*: append it
to `iter-artifacts/design-loop/DECISIONS.md` with the reason. An undocumented
exception is drift, and drift is the thing this file exists to stop.

The short, enforceable version of this guide lives in
`.claude/skills/ui-consistency/` — load that skill before you build. This file is
the reference it points at.

---

## 0. The ten rules

1. **Reuse → extend → compose → build.** Search `ds/components.css` and
   `ds/gallery.html` before you write a class. A new bespoke component needs a
   DECISIONS entry saying why nothing existing fits.
2. **390px first.** Design the phone view, then let desktop adapt. No horizontal
   scroll, ever. Every interactive target ≥ `var(--ds-tap)` (44px).
3. **Tokens only.** No hex, no raw px for type/space/radius, no invented
   `z-index` in new code. If the value doesn't exist, add a *semantic* token to
   `ds/tokens.css` first.
4. **One page frame.** Every full-page destination is
   `.ds-page` → `.ds-page__head` → `.ds-section`. No page invents its own column
   width, title row, or rhythm.
5. **One navigation model.** The nav is closed: 5 destinations + 2 rail-aux
   items. A new mode is a *launcher entry*, never a new nav rung.
6. **Every launchable surface has a hidden `#<slug>-btn`** — that single contract
   gives it the palette, the launcher, and the `#/m/<slug>` deep link for free.
7. **Every state is designed:** first-run, loading (skeleton), empty (honest),
   error (inline + retry), offline. Browser defaults and bare spinners are bugs.
8. **Right channel for feedback.** Toast for transient confirmation, inline for
   component failure, sheet for a focused task, page section for standing work.
   Never a modal for something non-blocking.
9. **Numbers never lie.** `0` is a real zero; unknown/not-yet-measured is `—`.
   Trends where up-is-bad invert their colors.
10. **Unverified on a phone viewport = unshipped.** Screenshot at 390px + a CDP
    probe assertion, or it didn't happen.

---

## 1. Ownership map — where things live

| Concern | Single source of truth | Never do this instead |
|---|---|---|
| Color, type, space, radius, motion, z-layers, breakpoint | `ds/tokens.css` | a hex in a component, a `:root` override in a page |
| Reusable primitives (page frame, button, card, chip, row, sheet, nav, field, MC option, switch, segmented, stat, progress, empty, skeleton) | `ds/components.css` | a per-surface copy of the same box |
| Iconography | `ds/icons.js` (`dsIcon(name, size)`) | inline one-off `<svg>`, emoji in chrome (D07) |
| Visual catalog / smoke check | `ds/gallery.html` | guessing what exists |
| App-specific styling of a ds surface | `css/06-ds-nav.css` … `css/10-ds-lesson.css` | app selectors inside `ds/` (breaks D04 isolation) |
| Surface behavior/markup | `js/app/16-ds-nav.js` … `21-settings.js` | markup in `index.html` for dynamic surfaces |
| localStorage I/O | `js/storage.js` (`window.DrillStorage`) | `localStorage.getItem/setItem` |
| Persisted app state + save | `state` + `saveProgress()` (`js/app/04-progress-sr.js`) | a private module-level cache that survives reload |
| Cross-device merge rules | `js/sync.js` (+ `tools/check-sync-coverage.js`) | adding a `saveProgress` field and forgetting the registry |
| Static code rendering | CodeMirror `runMode` + Dracula | `<pre><code>` |
| Charts | `dataviz` skill + `--ds-viz-*` ramp | a rainbow palette, status colors as categories |

**The reuse ladder — walk it top to bottom, stop at the first hit:**

```
1. A ds/ primitive exists           → use it as-is
2. A primitive + a modifier class   → add .ds-x--variant to ds/components.css
3. Composition of primitives        → compose in the surface file
4. Page-specific class              → css/NN-ds-<surface>.css, tokens only
5. A genuinely new primitive        → ds/components.css + gallery entry + DECISIONS note
```

Never step 5 first. Most "new" components in this app were step 2.

---

## 2. Navigation model

### 2.1 The shape (D01, D08 — binding)

```
≤767px                                   ≥768px
┌──────────────────────────┐             ┌────────┬──────────────────────────┐
│ topbar (48px)            │             │        │ topbar (48px)            │
├──────────────────────────┤             │  rail  ├──────────────────────────┤
│                          │             │ 240px  │                          │
│   #lesson-shell          │             │        │   #lesson-shell          │
│   (the only page area)   │             │ Today  │   (max-width 560px,      │
│                          │             │ Browse │    centered)             │
│                          │             │ Practi │                          │
│                          │             │ Progre │                          │
├──────────────────────────┤             │ Design │                          │
│ ⌂ Today ▦ Browse ⚡ …    │  ← nav      │ ───────│                          │
└──────────────────────────┘             │ Search │                          │
                                         │ Settin │                          │
                                         └────────┴──────────────────────────┘
```

- **Destinations (5, closed set):** Today · Browse · Practice · Progress ·
  Design (system-design.html). Same items, both viewports — the bar becomes the
  rail at 768px. Defined once in `js/app/16-ds-nav.js`.
- **Rail-only aux (2):** Search (⌘K palette) · Settings. On mobile these live in
  the topbar icon strip.
- **Adding a nav item is a DECISIONS-level change.** A sixth rung costs every
  existing rung ~20% of its width on a 390px screen. Default answer: no — it
  belongs in the Practice launcher or the palette.

### 2.2 The launcher contract (D05) — how a new mode becomes reachable

Every launchable surface is fronted by a **hidden button** whose id is
`<slug>-btn`. Everything else keys off that one element:

```
        ┌──────────────── #<slug>-btn (hidden, in index.html) ───────────────┐
        │                    .click() → openYourSurface()                    │
        └───▲──────────────▲──────────────▲──────────────▲───────────────────┘
            │              │              │              │
   nav item │   launcher   │   command    │   #/m/<slug> │   another surface's
 (16-ds-nav)│ (18-practice)│  palette     │  deep link   │   inline CTA
```

To ship a new surface:

1. **Hidden button** in `index.html`:
   `<button id="foo-btn" class="hidden" aria-hidden="true" tabindex="-1" style="display:none;"></button>`
   with a comment saying what it opens.
2. **Wire it** in `js/app/15-init-features-boot.js` to your `openFoo()`.
3. **Taxonomy entry** (`TOPBAR_MENU_TAXONOMY`) with `label`, `desc`, and an
   `icon` key from `ds/icons.js` — that puts it in the Practice launcher, the
   palette, and the mobile menu at once.
4. **Route** — free. `#/m/foo` resolves via `_dispatchModeRoute`
   (`js/app/10-render-sidebar-lesson.js`).
5. **Probe** — `tools/cdp/<surface>.js` asserting it opens, renders, and doesn't
   overflow at 390px.

**Never** add a second, parallel way to open something without retiring the
first (D05 preserves *capability*, not entry points).

**Routes must be idempotent and safe.** A URL is bookmarked, shared, and replayed
from history — so `#/m/<slug>` may never flip a setting or destroy data on
arrival. A toggle-ish slug routes to the surface that *owns* the control
(`MODE_ROUTE_SURFACE`), where the user flips it deliberately.

### 2.3 Where does my thing go?

| Kind of thing | Surface | Why |
|---|---|---|
| A standing destination you return to | **Page** (`.ds-page` into `#lesson-shell`) | deserves a nav rung or a route; keeps scroll + back |
| A focused pick/config task, then back | **Sheet** (`.ds-scrim` + `.ds-sheet`) | thumb-reachable, dismissible, no context loss |
| Truly blocking, must resolve now | **Modal** (`.ds-scrim`, no dismiss-on-scrim) | rare — it stops the rep |
| Extra detail about a row already on screen | **Inline disclosure** (`<details>`, expand-in-place) | preserves spatial context; no navigation |
| Confirmation of what the user just did | **Toast** | zero layout cost, self-dismissing |
| A drill/rep | **The lesson shell tabs** | reps are the app's hot path; never nest a rep in a modal |

Rules that follow from this table:

- A sheet never opens another sheet. Replace contents or route to a page.
- A page never opens inside a modal.
- Escape and a scrim tap close every non-blocking overlay. Every overlay has a
  visible close control ≥44px (`.ds-iconbtn` with `aria-label="Close"`).
- Opening any overlay must not scroll the page behind it back to the top.

---

## 3. Page frame

### 3.1 Zones

```
┌──────────────────────────────────────────────────────────────────────┐
│ Zone 0 · App shell — topbar + nav (bar or rail). NOT yours to change.│
│          Fixed, tokenized, safe-area aware. Pages never re-render it.│
├──────────────────────────────────────────────────────────────────────┤
│ Zone 1 · .ds-page__head                                              │
│   · .ds-page__meta      (optional) small left context + right chip   │
│   · .ds-page__titlerow  <h1 class="ds-title"> + .ds-page__actions    │
│   · .ds-page__sub       (optional) ≤ 2 lines, clamped                │
├──────────────────────────────────────────────────────────────────────┤
│ Zone 2 · Controls (optional) — search, segments, filter disclosure.  │
│          Stays directly under the head; never floats mid-content.    │
├──────────────────────────────────────────────────────────────────────┤
│ Zone 3 · .ds-section*  — labeled blocks, in a fixed priority order:  │
│          what's true now → what changed → what to fix → the long tail│
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 The markup (copy this)

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

### 3.3 Invariants

1. **One `<h1>` per page**, and it names the *destination*, not the current
   filter/tab/mode. Browse stays "Browse" when you filter it.
2. **The column is `var(--ds-page-w)` (560px), centered.** Not 600, not
   "full width because this page has a table". A wide child scrolls *inside its
   own* `overflow-x:auto` box; the page body never scrolls sideways.
3. **The sub is ≤2 lines** (clamped by the primitive) so the head's height is
   deterministic and switching destinations doesn't jump.
4. **Sections carry a `.ds-section__label`** (uppercase eyebrow) unless the
   section is a single self-titling card.
5. **`#lesson-shell` is the only page host**; `.app-main` is the scroll owner.
   Reset/restore `scrollTop` deliberately on render — never leave it to chance.
6. **Re-render replaces the page, not the shell chrome.** Keep focus-bearing
   inputs (e.g. Browse's search field) in the DOM across re-renders and re-render
   only the list, or you break IME composition and focus.
7. **No breadcrumbs, no full-bleed header bands, no page-level tab strips.** The
   app is one level deep on purpose; tabs belong to the lesson shell only.

### 3.4 What we deliberately do *not* import from generic SaaS guides

- **Full-bleed header bands + breadcrumbs** — designed for deep hierarchies on
  wide screens. Here they'd eat ~15% of a 390px viewport to restate a nav rung
  the user just tapped.
- **A sticky desktop filter rail** — Browse's filters are a disclosure panel that
  works identically on both viewports (D10). One filter language, not two.
- **Route-tabs per sub-resource** — a lesson's tabs are recall *levels*, not
  resources; `#/<lesson>/<tab>` already deep-links them.

---

## 4. Component catalog

Read `ds/gallery.html` (open it in a browser) before building anything.

| I need… | Use | Notes |
|---|---|---|
| A page | `.ds-page` + `.ds-page__head` + `.ds-section` | § 3 |
| Primary action | `.ds-btn.ds-btn--primary` | one per screen/section |
| Secondary / tertiary | `.ds-btn` · `.ds-btn--ghost` · `.ds-btn--subtle` | |
| Destructive | `.ds-btn--danger` + explicit confirm | never one-tap |
| Icon-only action | `.ds-iconbtn` + `aria-label` (+ `title`) | 44×44 by construction |
| Full-width mobile CTA | `.ds-btn--block` (+ `--lg` for hero) | thumb zone |
| Container | `.ds-card` · `--flat` · `--tap` (if the card is a link) | |
| Status/metadata pill | `.ds-chip` (+ `--accent/--good/--warn/--bad`) | non-interactive |
| A number + label | `.ds-stat` (+ `--accent` for the hero number) | tabular numerals |
| List row | `.ds-row` + `__badge/__main/__chev` | the one row anatomy |
| Text input | `.ds-field` | 16px+ effective size (no iOS zoom) |
| Multiple choice | `.ds-options` + `.ds-opt` + `is-selected/correct/wrong/muted` | |
| Boolean setting | `.ds-switch` inside a `role="switch"` button | switch is decoration; the row is the target |
| 2–4 exclusive modes | `.ds-seg` | not for navigation |
| Completion bar | `.ds-progress` (+ `--good`) | |
| Overlay | `.ds-scrim` + `.ds-sheet` (+ `--scroll`) | bottom sheet ≤639px, centered ≥640px |
| Empty state | `.ds-empty` + `__title/__body` + one CTA | § 6 |
| Loading | `.ds-skel` sized to the incoming box | § 6 |
| Icon | `dsIcon('name', px)` | add new icons to `ds/icons.js` |
| Toast | `.reveal-cleared-toast` (+ variant class) | see § 7 + § 15 debt |

**Do not hand-roll:** a card, a chip, a row, a modal, a switch, a filter chip, a
close button, a status dot, a stat tile. They all exist.

---

## 5. Actions & affordances

**Icon-only vs. labeled.**

- Icon-only (`.ds-iconbtn`) for repeated/secondary controls: close, expand,
  refresh, per-row actions, topbar utilities. Every one **must** carry a
  `aria-label` — and the same string as `title` so hover teaches the meaning.
- Labeled `.ds-btn` for: the one primary action on a surface, any destructive
  action, and any control that opens a *variable* destination (a menu, a
  launcher, a picker) — a bare glyph can't say where it goes.
- **No emoji in chrome (D07).** Emoji renders per-platform and reads as
  placeholder design. It remains fine in authored lesson content and in
  celebratory toasts.

**Hierarchy per surface:** exactly one primary action visible at a time. If two
things look equally important, the screen has no focus (PRINCIPLES #1).

**Destructive actions** get: `--danger` styling, a verb-specific label
("Delete progress", not "OK"), an explicit confirm, and never a position where
the primary action used to be.

**Row anatomy** — one pattern everywhere: `badge · title/sub · trailing chip ·
chevron`. Whole row is the target (≥44px), chevron only when it navigates.

**Disabled vs. hidden:** disable (with a reason in `title`) when the control will
become available; hide when it's not applicable to this user at all. Never show a
control that silently does nothing.

---

## 6. States — all five are designed

```
first-run ──► loading ──► data ──► (empty | error | offline)
```

**First-run.** A user with zero state must still see a usable page: real chrome,
honest zeroes, and one obvious way to start. Never gate the whole app behind a
modal the user must dismiss to see anything.

**Loading.** `.ds-skel` boxes that mirror the incoming content's dimensions —
never a centered spinner, never a layout that reflows when data lands. If the
content usually arrives in <150ms (a cached lesson), render nothing rather than
flashing a skeleton.

**Empty — and be honest.** Two different empties:

| Situation | Show |
|---|---|
| No data anywhere yet (new user, no reps) | `.ds-empty` — what this surface will show, and ONE CTA that produces the first datum |
| Data exists, but the current filter/search matches nothing | "No lessons match these filters" + a **Clear filters** button. Never a setup/onboarding pitch |

> **Rejected pattern: blurred/frosted mock data behind an empty state.** In a
> memory app, a plausible-looking fake number is indistinguishable from a real
> readiness signal — the exact failure PROFILE.md forbids. Empty states here say
> what's missing and how to fill it, with real chrome and no fake data.

**Error.** Inline, in place, with a retry — the failing component reports its own
failure. Never a toast for a persistent failure (it vanishes), never an alert().

**Offline.** The service worker serves the app shell; a surface that needs a
fetch it can't make says so in place and keeps the rest of the page usable.

---

## 7. Feedback & signal hierarchy

```
                       ┌───────────────────────────────┐
                       │ Does the user have to act NOW │
                       │ before they can keep drilling?│
                       └───────────────┬───────────────┘
                    ┌──────────────────┴──────────────────┐
                  [YES]                                 [NO]
                    │                                     │
      ┌─────────────┴─────────────┐         ┌─────────────┴─────────────┐
      │ Is it about ONE component │         │ Is it feedback on an      │
      │ that just failed?         │         │ action they just took?    │
      └──────┬─────────────┬──────┘         └──────┬─────────────┬──────┘
          [YES]          [NO]                   [YES]          [NO]
             │              │                      │              │
    ┌────────┴──────┐ ┌─────┴────────┐    ┌────────┴──────┐ ┌─────┴──────────┐
    │ Inline error  │ │ Blocking     │    │ Toast         │ │ A row in the   │
    │ + Retry       │ │ modal (rare) │    │ ≤2.2s, no CTA │ │ Progress page's│
    └───────────────┘ └──────────────┘    └───────────────┘ │ "Fix first"    │
                                                            └────────────────┘
```

- **Toast** — transient confirmation only ("Reveal cleared", "Backup saved").
  No actions, no persistent state, auto-dismiss, never stacked.
- **Inline** — component-scoped failure, stays until resolved, owns its retry.
- **Sheet/modal** — only when the user must decide before continuing.
- **Standing work** (due reviews, weak spots, overdue lessons) is **not a
  notification**. It belongs on the Progress page's *Fix first* section and as
  ambient counts (PRINCIPLES #4). This app has no notification bell and should
  not grow one: there is no server pushing events, and a badge that never
  reaches zero is noise.

---

## 8. Data display & numbers

- **`0` vs `—`.** `0` when the measurement happened and the answer is zero
  ("0 solved today"). `—` when there is nothing to measure yet (no mock attempts,
  no first-try rate). Never print `0` for "unknown" — in this app a fake zero
  reads as a real readiness signal.
- **Tabular numerals** (`.ds-num` / `font-variant-numeric: tabular-nums`) for
  anything that updates in place or stacks in a column.
- **Inverted trends.** Up is not always good: misses, overdue count, and solve
  time use `--ds-bad` when rising, `--ds-good` when falling. Match color to
  *meaning*, never to direction.
- **Relative time needs an absolute.** `<time datetime="…" title="Aug 1, 2026,
  13:42">3 days ago</time>`.
- **Charts** follow the `dataviz` skill: one-hue sequential ramps from
  `--ds-viz-*`, status colors reserved for status, a legend whenever color
  carries meaning, thin marks with rounded data-ends and square baselines. Never
  encode a category in a status color.
- **Percentages carry their denominator** where it fits ("62% · 106/171").
- **Every stat is a real rep.** No points, no fake levels, no streak inflation
  (PROFILE.md L109). Streaks and deltas are allowed because they are literally
  counted reps.

---

## 9. Motion

- Duration/easing come from tokens: `--ds-dur-fast|dur|dur-slow`, `--ds-ease`,
  `--ds-ease-spring`. Nothing longer than `--ds-dur-slow` on an interaction path.
- Animate **`opacity` and `transform` only** (GPU-composited; no layout thrash).
- Motion explains change: a sheet rises from the edge it's anchored to, a graded
  answer settles, a dismissed card leaves in the direction it was swiped.
- **Never animate content into view on scroll**, and never delay a drill surface
  behind an entrance animation — the rep is the product.
- `prefers-reduced-motion` is honored globally (the tokens collapse to `0ms`);
  don't reintroduce hard-coded durations that dodge it.

---

## 10. Layering & breakpoints

**One breakpoint: 768px** (`max-width: 767px` / `min-width: 768px`). The drawer,
topbar, and rail all flip together there. Component-internal breakpoints are
allowed only where a primitive changes presentation (`.ds-sheet` at 640px).
Don't invent 600/700/540 for a new surface — those are legacy and being paid down.

**The z-ladder** (tokens in `ds/tokens.css`; use the token, never the literal):

| Rung | Token | Who |
|---|---|---|
| 5 | `--ds-z-sticky` | in-flow sticky chrome (L3 run bar, tab strip) |
| 30 | `--ds-z-nav` | bottom bar / rail |
| 45 | `--ds-z-drawer` | off-canvas panel + backdrop (legacy, retired visually) |
| 50 | `--ds-z-topbar` | topbar (its dropdown panel sits at 49) |
| 55 | `--ds-z-dock` | audio mini-player dock |
| 60 | `--ds-z-sheet` | `.ds-scrim` + every sheet/modal |
| 80 | `--ds-z-drillbar` | in-drill fixed sheets (L2 keypad) — above the dock |
| 90 | `--ds-z-toast` | toasts (95 = the sync hint banner) |
| 100 | `--ds-z-overlay` | command palette + interruptive modals — the roof |

Two fixed things at the same rung is a bug waiting to happen: if your new
surface must sit above an existing one, say which and why in a comment.

**Fixed-chrome etiquette.** Anything fixed to the bottom edge must (a) reserve
space in the content (`.ds-navpad` or a `padding-bottom`), (b) respect
`env(safe-area-inset-bottom)`, and (c) declare how it coexists with the nav, the
dock, and the L3 run bar (see the interop rules in `css/06-ds-nav.css`).

---

## 11. Accessibility floor

Non-negotiable, verified by probe where possible:

- **≥44px** touch targets (`var(--ds-tap)`), including rows and chips.
- **Every icon-only control has an accessible name** (`aria-label`).
- **Focus is visible** — don't remove the `:focus-visible` outline from `.ds-root`.
- **Active destination is programmatic**, not just colored: `aria-current="page"`
  on the nav item, kept truthful by the `#lesson-shell` observer.
- **Overlays**: `role="dialog"` + `aria-modal="true"` + a labelled close control;
  `Escape` closes; focus starts inside.
- **Toggles**: `role="switch"` + `aria-checked` on the row (the visual
  `.ds-switch` is `aria-hidden`); disclosures carry `aria-expanded`.
- **Semantics over divs**: `<button>` for actions, `<a href>` for destinations
  (so cmd-click opens a tab — that's how `#/m/` routes earn their keep),
  `<section>` + heading for blocks, `<dl>`/`<ul>` for key-value stats.
- **Contrast**: body text on `--ds-surface*` uses `--ds-text`/`--ds-text-dim`;
  `--ds-text-mute` is for non-essential hints only, never body copy.
- **Text scales**: the Settings text-size control multiplies the type scale —
  don't pin a font-size in px where a token belongs.

---

## 12. Copy & labels

- **Sentence case** for everything except `.ds-label`/`.ds-eyebrow` (uppercase by
  the token) — no Title Case Buttons.
- **Verbs on buttons** ("Start a rep", "Clear filters"), nouns on destinations
  ("Progress"). The button says what happens, not "OK".
- **Second person, present tense, no exclamation marks.** Calm > cheerful.
- **Numbers before adjectives**: "5 due · about 7 minutes", not "a few due".
- **Empty/error copy is specific**: what's missing, why, what to do next. Never
  "Something went wrong."
- **The label a user tapped is the label they land on.** A launcher row, its
  page `<h1>`, and its palette entry use the *same* word.

---

## 13. State, storage & URL

- All persisted state lives in `state` and is written by `saveProgress()`; new
  fields must be mirrored in `loadProgress`/`saveProgress` **and** registered in
  one of `js/sync.js`'s three key registries (`node tools/check-sync-coverage.js`
  enforces it). A rename/removal bumps `__v` and adds a migration branch.
- Read/write storage only through `window.DrillStorage`.
- **Transient UI state stays transient** (a search box's text, a hover). If
  losing it on reload would annoy the user, persist it; otherwise don't grow the
  schema.
- **URL contract:** `#/<lesson-id>/<tab>` for reps, `#/m/<slug>` for surfaces.
  Internal navigation uses `history.replaceState` (no history spam); external
  hash changes re-route through `_handleHashChange`.
- A surface that can be opened from a URL must render correctly on a **cold
  boot** with no prior state — that's what `_pendingBootMode` is for.

---

## 14. Checklists

### 14.1 Shipping a new surface

- [ ] It's a page/sheet/modal/inline per § 2.3 — and you can say why.
- [ ] Markup starts from `.ds-page` (page) or `.ds-scrim` + `.ds-sheet` (overlay).
- [ ] Zero hex, zero raw px type/space, zero new `z-index` literals.
- [ ] Icons via `dsIcon()`; no emoji in chrome.
- [ ] Hidden `#<slug>-btn` + taxonomy entry + `#/m/<slug>` verified.
- [ ] First-run, loading, empty, error states all render (test by clearing state).
- [ ] 390px: no horizontal scroll, all targets ≥44px, primary action in thumb reach.
- [ ] 768px+: adapts without a second layout system.
- [ ] Keyboard: Tab order sane, Escape closes, focus visible.
- [ ] New persisted field? → `loadProgress`/`saveProgress` + sync registry + coverage check.
- [ ] `node tools/validate-data.js` green.
- [ ] A durable probe in `tools/cdp/` + before/after screenshots at both viewports.
- [ ] Commit message follows the `[product/*]` convention with `## Product impact`.

### 14.2 Adding to the design system

- [ ] It's genuinely reusable (2+ surfaces would use it) — otherwise it's a
      page-specific class in `css/NN-ds-*.css`.
- [ ] Built only from tokens; no app selectors inside `ds/` (D04).
- [ ] Named `.ds-<block>` / `--<modifier>` / `.is-<state>`.
- [ ] Added to `ds/gallery.html` with a realistic example.
- [ ] Works in both themes (toggle light in the gallery) and at 390px.

### 14.3 Reviewing someone else's UI diff

Reject (or fix) on sight: a hex literal, a hand-rolled card/chip/modal, a new
breakpoint, a new `z-index` number, an emoji in chrome, an icon-only button
without `aria-label`, a `<div onclick>`, an empty state with no CTA, a spinner
where a skeleton belongs, a toast used for a persistent error, a page that
invents its own column width, a mode reachable only from one place.

---

## 15. Known debt (measured, 2026-08-01)

Honest inventory so nobody mistakes legacy for precedent:

| Debt | Size | Rule |
|---|---|---|
| Hardcoded hex in legacy `css/01-05*.css` | ~880 literals | Don't add more. Convert the block you're already editing. |
| Hardcoded hex in `js/app/*.js` | ~509 | Same rule; prefer moving the style into a class while you're there. |
| Inline `style="…"` in ds surfaces (`17`, `20`) | ~80 | New markup uses classes. Convert what you touch. |
| Breakpoint drift (600/700/540/480px) | ~17 media queries | New code uses 768 only. |
| Toast lives in `css/04-drills.css` with fixed colors | 4 variants | The next agent to add a toast hoists it to `.ds-toast` in `ds/components.css` (tokens, no emoji dependency) and migrates the variants. |
| First-run welcome + several legacy modals aren't on `ds/` | ~6 surfaces | Migrate opportunistically, one per change, with screenshots. |

**Boy-scout bounds:** clean up the *block you're already in*. Do not open a
1,000-line CSS file to convert hexes as a side quest — a big unrelated diff is
harder to review than the debt it pays. Debt paydown that spans files gets its
own commit.

---

## 16. Verification recipes

```bash
# Content + runner semantics (always, before any commit)
node tools/validate-data.js

# The app boots, all slices load, no exceptions/404s
node tools/cdp/appsplit-smoke.js

# Page-frame + nav invariants across the three destinations, both viewports
node tools/cdp/ds-page-frame.js

# Storage field parity with the sync registries
node tools/check-sync-coverage.js
```

Screenshots at **390×844** (iPhone 13 mini — the PROFILE default) and
**1280×900**. Keep before/after pairs for anything visual; the design-loop
convention is `iter-artifacts/design-loop/shots/<phase>/`.

If Chrome isn't already on :9222 in your environment, `tools/cdp/lib.js`
`ensureChrome()` assumes macOS. On Linux/CI, launch it yourself and vendor the
CDN assets first:

```bash
bash tools/cdp/fetch-vendor.sh        # once — mirrors Tailwind/CodeMirror/etc.
chromium --headless=new --remote-debugging-port=9222 \
         --user-data-dir=/tmp/chrome-debug-jsdrill --no-sandbox &
python3 -m http.server 8765 &
```

---

## The one-paragraph version

Open `ds/gallery.html`. Use what's there. Put your surface in a `.ds-page` with
one `<h1>`, labeled `.ds-section`s, and tokens for every value. Give it a hidden
`#<slug>-btn` so the launcher, palette, and `#/m/<slug>` route come free. Design
its empty and loading states as carefully as its full one. Check it at 390px,
prove it with a probe and a screenshot, and write down any rule you had to break.
