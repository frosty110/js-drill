# Navigation & Intent Refactor — Phasing Plan

> Companion to `navigation-refactor-goals.md` (the why). This is the how/when:
> an ordered sequence of independently-shippable phases. **Every phase must
> pass `node tools/validate-data.js`, keep the app fully working, ship green,
> and be reversible.** No big bang. Mobile-probe (`tools/cdp/mobile-l3.js` +
> a per-phase scenario) any phase that moves a launch surface.
>
> Sequencing principle: front-load the highest *reduction-per-risk*, and reuse
> code that already exists (`applySidebarCuration`, `renderSidebar` predicates,
> `TOPBAR_MENU_TAXONOMY`, the Cram full-window shell) before building anything new.

---

## Phase 0 — Vocabulary: Path → Plan (user-facing copy)

**Goal:** the route a user is on is their **Plan** everywhere a user can read.
**Mechanism:** rename user-facing strings only — `Starter Path`→`Starter Plan`,
`🧭 Path View`→`🧭 Plan View`, the `Path:` chip label→`Plan:`, blurbs/titles.
Leave code identifiers (`paths.json`, `getSubscribedPath`, `path.kind`,
`sidebarButtons`) untouched this phase.
**Why first:** sets the language before any new surface is built with it. Pure
copy, near-zero risk, zero behavior change.
**Ships green when:** no user-facing "Path" remains; validator green; app loads.
**Scope:** single-iter `[product/ux]`.

## Phase 1 — Extract 📅 Today as a primary action

**Goal:** Today is a first-class front door, not item #N in a pile.
**Mechanism:** promote `today-btn` to a primary topbar affordance (a labeled
button in `.topbar-left`/`.topbar-menus`, distinct from the dropdowns), visible
on mobile. Keep its existing handler. Label **📅 Today**; keep the **Plan:**
selector visually separate so the two don't read as the same control.
**Why early:** most common action, high-visibility win, validates "promote by
intent" before the bigger demolition.
**Ships green when:** Today reachable in one tap from any screen on mobile +
desktop; old sidebar entry still works until Phase 2 removes the pile.
**Scope:** single-iter `[product/ux]`.

## Phase 2 — Kill the duplication (LOAD-BEARING)

**Goal:** the topbar is the **sole** launcher; the sidebar pile is retired.
Sidebar = lesson list + Plan/Hide-mastered filter chips + the Repair/status
pills only.
**Mechanism:**
- *Scaffold* `[product/feature-scaffold]`: behind a flag, hide the sidebar
  launcher flex-wrap (`index.html:304`) on the default plan, relying on the
  topbar dropdowns (which already clone every button). Verify nothing becomes
  unreachable (cross-check `TOPBAR_MENU_TAXONOMY` covers every pile button; the
  Cmd-K palette is the safety net).
- *Ship* `[product/feature-ship]`: delete the pile markup; the topbar +
  `applySidebarCuration` own launching. Mobile-probe the drawer no longer
  carries 46 buttons.
**Why here:** biggest single reduction in cognitive surface; `applySidebarCuration`
already proves the pile is dispensable. Everything downstream gets simpler once
there's one launch system.
**Ships green when:** every former pile mode is reachable via topbar/palette;
sidebar drawer on mobile shows lessons + chips only; validator green; probe green.
**Scope:** 2-iter scaffold→ship. **Reversibility:** flag flip restores the pile.

## Phase 3 — De-junk Insights

**Goal:** Insights = read-only progress views again (goal #6 spirit).
**Mechanism:** move the 4 cram references (Cheat/Glossary/Behavior/Code Shapes)
+ `cram-review` OUT of the `insights` taxonomy into a **Reference** grouping
(or the cram shell context where they belong). Insights returns to
stats/streak/sections/mechanics(+export/ai-coach).
**Ships green when:** Insights dropdown ≤6 items; cram refs still reachable in
cram context; validator green.
**Scope:** single-iter `[product/ux]`.

## Phase 4 — Generalize the curation engine (plan-scoped → intent-scoped)

**Goal:** the engine that curates chrome serves *intent*, not only *plan*.
**Mechanism:** generalize `applySidebarCuration` + `sidebarButtons[]` so an
active **intent/shell** (not just a `kind:'cram'` plan) can declare which
launchers/chrome exist. This is the bridge from "Cram special case" to the
general Study/Session/Insights shells.
**Ships green when:** curation is driven by a shell/intent param; Cram still
behaves identically (it becomes one consumer of the general engine).
**Scope:** single-iter `[engineering/refactor]` + `[product/ux]`.

## Phase 5 — Intent cut (re-group the topbar)

**Goal:** topbar grouped by intent, not mechanism.
**Mechanism:** rewrite `TOPBAR_MENU_TAXONOMY` from Practice/Drills/Train/Insights
to **📅 Today (primary) · Repair · Drill · Simulate · Reflect** (+ Plan selector,
Settings). Re-slot every existing button under the new intents.
**Ships green when:** every mode lives under exactly one intent; nothing orphaned;
mobile dropdowns fit.
**Scope:** single-iter `[product/ux]` (extends a data structure that exists).

## Phase 6 — Repair 6 → 1 (filter presets on the lesson list)

**Goal:** review/weak/at-risk/resurrect/reveal-replay/bridge collapse into one
**Repair** surface.
**Mechanism:** add a Repair filter predicate to `renderSidebar()` (union of the
six signals, ranked by urgency) + a per-item reason badge ("due 3d", "missed
L1 ×2"). The six buttons become one chip/entry. Reuse existing predicate
composition (`inStarter`, `hideMasteredOk`).
**Ships green when:** one Repair entry reproduces all six behaviors; counts
match the old per-button counts; validator green.
**Scope:** 2-iter scaffold→ship.

## Phase 7 — Start picker + Drills 19 → 6 families

**Goal:** decision-fatigue antidote as default; drills consolidated.
**Mechanism:**
- **Start picker:** today(default)/warmup/lucky/shuffle behind one affordance
  near 📅 Today; "surprise me" is the default behavior.
- **Drill families:** group the 19 into the 6 recall-direction families
  (Execute-in-head / Reason-about-change / Identify-pattern / Notes&traps /
  Idiom-equivalence / Interview-meta); each family opens to its variants or
  picks one.
**Ships green when:** all 19 drills reachable within ≤2 taps via 6 families.
**Scope:** 2–3 iters.

## Phase 8 — Generalize the Session shell (full-bleed focus)

**Goal:** every self-contained activity renders full-bleed, sidebar hidden.
**Mechanism:** generalize the Cram Home full-window shell so drills/streams/sims
render in it (not into `lesson-shell` with the sidebar visible). Hide sidebar
entirely (not a rail) per goals doc. Exit returns to Study.
**Ships green when:** launching any drill/stream/sim hides the sidebar and shows
one ✕ Exit; exit restores Study; mobile-probe green.
**Scope:** 2-iter scaffold→ship.

## Phase 9 — Insights dashboard (4 → 1)

**Goal:** stats/streak/sections/mechanics become one dashboard.
**Mechanism:** fold the 4 progress modals into a single Insights surface
(tabs/sections); export + ai-coach become actions inside it.
**Ships green when:** one Insights entry; 4 old modals reachable as sections;
validator green.
**Scope:** 2-iter scaffold→ship.

## Phase 10 (optional) — Code-identifier rename: path → plan

**Goal:** code matches the vocabulary.
**Mechanism:** `paths.json`→`plans.json`, `getSubscribedPath`→`getSubscribedPlan`,
`path.kind`→`plan.kind`, etc. Pure refactor, no user benefit — do only if the
codebase divergence becomes a maintenance cost. Keep a back-compat read for the
old `paths.json` filename if anything external references it.
**Scope:** single-iter `[engineering/refactor]`, deferrable indefinitely.

## Phase 11 — Tags & faceted filter over Problems

> **SHIPPED 2026-05-27** (direct build, not staged). The Problems surface already
> existed (`state.surface` + `tracksForSurface`), so the merge + filter landed in
> one pass: `data/tags.json`, manifest difficulty backfill (122 lessons), the
> `renderSidebar()` merge + `renderTagFacets()` panel, `tagMatch()` predicate,
> validator gate, and `tools/cdp/tag-filter.js` (12/12 green). Company facet is
> live but unpopulated — append `tags.company[]` on manifest entries to use it.

**Depends on:** the **Surface split** (the merged Patterns+Applied "Problems"
list must exist — there's nothing to faceted-filter until then). See
`navigation-refactor-design.md` § Tags & faceted filtering for the model.
**Goal:** find a problem fast across the merged list by Type / Topic /
Difficulty / Company.
**Mechanism:**
- *Scaffold* `[product/feature-scaffold]`: add `data/tags.json` (facet registry:
  `source`+`topic` derived, `difficulty`+`company` authored) + the validator gate
  (authored values exist in the registry; `difficulty` string, `company` array;
  no `tags.source`/`tags.topic` keys). No UI yet. Ships green = validator passes
  with the new gate, zero lessons required to carry `tags`.
- *Wire* `[product/feature-wire]`: backfill `tags.difficulty` (and `company`
  where known) across the Problems lessons; derive `source`/`topic` at load;
  build `state.tagFilter` + the `renderSidebar()` faceted predicate (AND-across /
  OR-within) behind a flag. Still no chips.
- *Ship* `[product/feature-ship]`: the facet chip row on the Problems sidebar —
  each chip opens a multi-select value sheet, active facets show counts, a Clear
  affordance, persisted filter. Mobile-probe the chip row + value sheets.
**Why here:** the merge (a Surface-split deliverable) is what makes a single
filterable list exist; tagging is the payoff that makes the larger list
navigable. Adding companies later = appending registry values, no code change.
**Ships green when:** every facet filters correctly; combining facets matches
AND/OR semantics; clearing restores the full Plan list; validator green; probe
green. **Reversibility:** flag flip hides the chip row; `tags.json` + `tags`
keys are inert additive data.
**Scope:** 3-iter scaffold→wire→ship.

---

## End-state checkpoint

After Phase 9: **one sidebar** (lesson list + Plan/Hide-mastered/Repair chips) ·
**one Session shell** (full-bleed) · **one Insights dashboard** · **topbar as the
intent-switcher** (📅 Today · Repair · Drill · Simulate · Reflect + Plan selector)
— launcher count from 51 down to a handful of intent doors, with no duplicate
launch system.
