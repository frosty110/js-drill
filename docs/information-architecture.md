# Information Architecture

**Status:** decided, not built. This is the target the app converges on; §7 is
the migration.
**Supersedes:** D01 (five nav destinations), and narrows D09 (Progress as a
destination). Ratified as **D15** in
[`iter-artifacts/design-loop/DECISIONS.md`](../iter-artifacts/design-loop/DECISIONS.md).
**Companion docs:** [`ui-ux-guide.md`](ui-ux-guide.md) is *how* a surface looks;
[`url-contract.md`](url-contract.md) is *how* it is addressed; this is *what
surfaces exist and why*.

---

## 0. Why this document exists

Every surface in this app was added by a loop that was correct in isolation.
Nothing was ever removed. The result measures like this — a scripted walk through
the live app at 1280px and 390px, 15 steps:

| Observation | Measured |
|---|---|
| Steps with a breadcrumb | **0 of 15** |
| Nav items that are routed pages | **3 of 5** (Practice is a sheet with no URL; Design is a page load) |
| `aria-current` while inside a lesson | **none** — you are nowhere in the nav |
| Rail present on `system-design.html` | **no** — a primary-nav item navigates you out of the shell that has the nav |
| `history.back()` from a system-design unit | jumped past the whole excursion to `#/m/dashboard`; a second back left the site |
| Overlay dismissed by navigating | **no** — the Practice sheet stayed open on top of Progress |
| `<h1>` per main-app page | **2** (the page frame's rule is one) |
| Distinct up-affordances | **3** (`×` on a lesson, `Close` in a sheet, `‹ All topics` on system design) |

Those are eight symptoms of one cause: **the app has an address book but no
hierarchy.** `js/routes.js` can tell you what any URL *is*; nothing can tell you
what any URL is *inside of*. Breadcrumbs, up-navigation, truthful `aria-current`,
and scoped progress are all the same missing fact.

The second cause is duplication. Three surfaces answer "what needs repair"
(Progress → *Fix first*, Browse → repair filter, Home → *⟲ Review*). Two render
the same 29-section taxonomy (Home track cards, Browse track segments). Home's
entire *More* list is three rail destinations plus Diagnostic.

This document fixes the vocabulary so the loops stop re-adding surfaces.

---

## 1. The app answers four questions

Everything a user comes here to do is one of these. A surface that doesn't map
to one is drift.

| # | Question | Answered by | Kind |
|---|---|---|---|
| 1 | *What do I do right now?* | **Home** | destination |
| 2 | *Show me everything / let me pick* | **Library** | destination |
| 3 | *How am I doing?* | **the header** | ambient, always on screen |
| 4 | *Change how it works* | **Settings** | aux |

Three of the four have a fixed place. The third deliberately does not — see §3.

---

## 2. Vocabulary (settled — do not relitigate)

These words were used inconsistently across surfaces, which is most of why the
app reads as three products.

- **Track** — the top level of the corpus. Coding (patterns + applied, 127),
  Syntax (44), System Design. A track is **not** a peer of Browse; it is
  Browse's first level. Home rendering track cards was a duplicate of the
  library's own root.
- **Section** — the 29 authored groupings under a track (Arrays & Hashing,
  Trees, JS Traps …). Matches `data/<section-slug>/`.
- **Lesson / unit** — the leaf. The thing with L1/L2/L3 (or, for system design,
  a chapter of questions).
- **Scope** — any node in `track → section → lesson`, plus the root. Everything
  in §3 and §4 is defined against a scope. `all` is the root scope.
- **Destination** — a place with a URL that the primary nav can point at.
  Exactly three exist.
- **Session** — a queue of reps with a start and an end (Today's plan, Mock,
  scoped review, a drill run). A session is a *verb*. It is launched from a
  destination; it never becomes one.
- **Drill** — one recall family (Rapid-Fire, Swap-Bench, Predict …). ~17 of
  them. Drills are the long tail of sessions, not a nav rung.

**Practice is a verb, not a place.** That is the single largest correction here,
and the measured evidence agrees: the Practice sheet never changed the URL, in
either the sheet-open or the drill-launched state. It has no address because it
is not a location.

---

## 3. The header is the progress instrument

> **Rule — progress is ambient context, not a destination.**

Progress leaves the rail. It moves into the header, scoped to wherever you
currently are:

```
┌──────────────────────────────────────────────────────────────────┐
│ Library › Patterns › Trees        ▓▓▓▓▓▓░░░░ 6/11        3 due   │
│ └─ breadcrumb                     └─ scope progress     └─ global │
└──────────────────────────────────────────────────────────────────┘
```

The breadcrumb and the meter are **the same mechanism**: both are derived from
the current scope's parent chain (§5). This is why the header change and the
breadcrumb change are one change, not two.

The meter re-scopes automatically by altitude:

| Where you are | Meter shows |
|---|---|
| Home | whole corpus |
| A track | that track |
| A section | that section |
| A lesson | that lesson's L1 / L2 / L3 |
| A session | position in the queue (`4 / 12`), not mastery |

**Clicking the meter opens the full Progress panel** — today's dashboard content
(Today · Activity · Fix first · Mastery · More insights) as an overlay over
wherever you are. Nothing in it is lost; it stops being a place you have to
travel to.

### Rules for what may appear in the header

1. **Actionable numbers only.** `3 due` earns its place because it implies a
   next action. A streak count does not. PROFILE L109 bars gamification that
   obscures readiness; the header is the most expensive real estate in the app
   and must not spend it on vanity.
2. **Never lie about scope.** The number is for the scope named in the
   breadcrumb beside it. If they can disagree, the bug is the header's.
3. **`—`, not `0`, for not-yet-measured.** Guide rule 9.
4. **390px budget: breadcrumb + one number.** The meter bar is a ≥768px
   affordance. The phone gets the crumb and the due count.
5. **Two live items maximum besides the progress row.** Today the header carries
   `📋 Plan` and `System Design`, both duplicating rail destinations, plus six
   `display:none` fossil menus (`Practice ▾`, `Drills ▾`, `Train ▾`, `Review ▾`,
   `Dashboard`, the Problems⇄Reference toggle) still in the DOM at
   `index.html:111-160`. All of it goes. The header is not a nav.

---

## 4. The rail is three destinations

> **Rule — the nav is closed at three destinations plus two aux items. A new
> mode is a launcher entry, never a nav rung.** (Supersedes D01's five.)

| Rail item | Owns | Absorbs |
|---|---|---|
| **Home** | *What do I do now* — the Continue hero, what's due, and the recommended sessions | The Practice **sessions** (Today's plan · Mock · Pick one · Warmup · Audio). These are answers to "what now," not a separate place. |
| **Library** | The corpus: **track → section → lesson**, with search and the facet filters | Browse (renamed) **and** Home's track cards, which were the same taxonomy rendered twice. System Design becomes a fourth track. |
| **Design** | *Transitional.* See §4.1. | — |
| ⌄ Search | ⌘K palette | unchanged |
| ⌄ Settings | the ds Settings sheet | unchanged |

The **drill catalog** (~17 recall families) stays a sheet, launched from Home.
It is genuinely browsable, but a 17-item menu is the wrong primary destination
for a user PROFILE describes as needing one decision, on a phone. Home surfaces
the recommendation; the catalog is one tap behind it.

**Home's *More* list is deleted.** All four rows (Today's plan · Practice ·
Progress · Diagnostic) duplicate something else; two of them also appear inside
the Practice sheet.

### 4.1 System Design

**Target: a fourth track inside Library.** It is structurally a track already —
a corpus of units with mastery, Leitner scheduling, and per-unit questions. Made
a track, it stops being the special case where a primary-nav item leaves the
shell that contains the nav, and the rail drops to two destinations plus aux.

**Interim (cheaper, do this first):** keep `Design` in the rail but mount the
shell on `system-design.html` — the ds nav, the header, the breadcrumb. This
removes the "nav disappears" defect in about a day without migrating the
corpus. The full merge is a separate, later slice; it must not block §7.

Until the merge, `system-design.html` is the **only** page permitted to render a
second navigation, and it must render the same header contract as §3.

---

## 5. Hierarchy: `parent` on the route registry

The mechanism for §3 and §4 is one field.

Every row in `js/routes.js` gains **`parent`** — the id of the scope that
contains it, or `null` for the root. That single addition yields, by derivation
rather than by hand-authoring per surface:

- **Breadcrumbs** — walk `parent` to the root.
- **Up-navigation** — one affordance, one behavior, replacing today's three
  (`×`, `Close`, `‹ All topics`).
- **Truthful `aria-current`** — a lesson highlights **Library** because its
  parent chain runs through it. Today `syncCurrent()`
  (`js/app/16-ds-nav.js:108`) matches three page classes and gives up
  everywhere else, which is why you go nowhere-in-the-nav the moment you open a
  lesson.
- **Scoped progress** — the header's meter, and the scope model
  `homeScopeLessons/Stats/…` in `js/app/22-home.js` stops being Home-private.
- **Scoped review** — `#/m/review/<scope>` already exists; it becomes available
  at every altitude for free.

### Rules

1. **Every route row declares `parent`.** No exceptions, including `action`
   rows — a session's parent is the scope it was launched from.
2. **A primary-nav destination is a route.** If it can't have a URL, it can't be
   in the rail. (Practice, today, cannot.)
3. **`pushState` for navigation; `replaceState` only for view state.** The
   measured back-button failure — a whole system-design excursion collapsing
   into one history entry — is this rule being inverted. On a phone, back *is*
   the navigation.
4. **Navigating dismisses overlays.** A sheet may not outlive the surface it was
   opened over. It does today.

---

## 6. Disposition of every current surface

Nothing below is a capability retirement — this is D05's principle held: fewer,
calmer entry points; same capabilities; everything stays reachable via the
palette and `#/m/<slug>`.

| Today | Becomes |
|---|---|
| Home — greeting + Continue hero | **Home**, unchanged in spirit |
| Home — TRACKS cards (Coding/Syntax/System Design) | **Library** root; progress moves to the header |
| Home — 29-section expansion | **Library** second level |
| Home — More (4 rows) | **deleted** — all duplicates |
| Browse — search, segments, facets, list | **Library**, renamed |
| Browse — repair filter | **Library** filter, and the same query behind the header's *Fix first* |
| Practice — SESSIONS (7 rows) | promoted onto **Home** |
| Practice — DRILLS (~17 families) | sheet launched from **Home** |
| Progress — Today · Activity · Fix first · Mastery · More insights | **header panel** (click the meter) |
| Design (rail) | §4.1 — shell first, then a Library track |
| Topbar — `📋 Plan`, `System Design` | **deleted** (duplicates of rail destinations) |
| Topbar — hidden `Practice/Drills/Train/Review ▾`, `Dashboard`, surface toggle | **deleted from the DOM** — retired chrome kept as synthetic-click targets under D05; the launcher-button contract (guide rule 6) survives them |
| `#/m/<slug>` deep links | unchanged — the reachability contract holds |
| Command palette | unchanged |

---

## 7. Migration

Each phase is independently shippable and leaves the app green.

| Phase | Change | Unblocks |
|---|---|---|
| **1** ✅ | `parent` on every `js/routes.js` row + derive the breadcrumb. No visual change beyond the crumb. | everything |
| **2** | Header: breadcrumb + scoped meter + due count. Delete `Plan` / `System Design` / the fossil menus. | — |
| **3** | Progress leaves the rail → becomes the header panel. | rail drops to 4 |
| **4** | Home's track cards merge into Library; delete *More*. | rail drops to 3 |
| **5** | Practice sessions onto Home; drills stay a sheet; Practice leaves the rail. | — |
| **6** | `pushState` discipline + overlay dismissal on nav. | back button works |
| **7** | Mount the shell on `system-design.html` (§4.1 interim). | — |
| **later** | System Design becomes a Library track. | rail = 2 + aux |

Phase 5 carries the real risk: Home is already dense, and PROFILE's user needs
it to stay a one-decision screen. Ship it behind the feature-flag sequence
(`feature-scaffold` → `feature-wire` → `feature-ship`) and screenshot at 390px
before removing the flag.

### Phase 1 — shipped

`parent` + `crumbLabel()` on all 11 registry rows; `ancestors()` and `crumbs()`
derive from them; `js/breadcrumb.js` paints the trail on **both** hash-routed
pages; `js/app/25-breadcrumb.js` supplies the app's titles and splices the
unlinked section crumb. Gated by five new assertions per row in
`tools/check-url-contract.js` (every row declares `parent`; it names a real
surface; no cycle; every crumb has a label; a parent stays addressable with its
child's params) and by `tools/cdp/nav-hierarchy.js`, 24 assertions at 390px and
1280px across both pages, now in `PROBE_SUITE`.

Purely additive — no surface moved, nothing was deleted, and `ds-page-frame`
(33), `home-nav` (32 + 7), `sd-tags-nav` (41) and the boot smoke all stayed
green.

**Left standing on purpose:** the bespoke up-affordances (`×` on a lesson,
`Close` in a sheet, `‹ All topics` on a system-design topic) are still there, so
a system-design unit currently shows both the derived trail and the old link.
Retiring them is phase 6's "one up-affordance," not phase 1's — they are load-
bearing for existing probes and removing them is a visual change this phase
promised not to make.

---

## 8. Gate

In this repo a rule without a gate is a suggestion. `tools/check-url-contract.js`
already reconciles the route registry against the router; it extends to cover:

1. **Every route row has a `parent`** (root excepted), and the chain terminates
   at the root without a cycle.
2. **Every primary-nav destination resolves to a route row** — this is what
   makes "Practice is in the rail but has no URL" a failing build rather than a
   thing someone notices a year later.
3. **The rail's destination count matches this document** (three, plus aux).

Plus a durable probe, `tools/cdp/nav-hierarchy.js`, asserting at 390px and
1280px: a breadcrumb on every non-root surface; exactly one up-affordance and
one `<h1>`; `aria-current` truthful inside a lesson; `history.back()` retracing
each navigation; no overlay surviving a nav.

Both belong in `PROBE_SUITE` / `check-all.js` before phase 2 lands — the walk in
§0 is what these encode, and every defect it found was invisible to the existing
938 content checks and 181 probes.
