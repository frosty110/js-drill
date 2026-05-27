# Navigation & Intent Refactor — Concrete Design

> The governing design. Supersedes the earlier intent-menu synthesis after the
> 2026-05-27 Problems⇄Reference reframe. Companion to
> `navigation-refactor-goals.md` (why) and `navigation-refactor-phasing.md` (when).
> Mechanism detail (Session shell internals, Repair predicate, drill families)
> carried forward from the 4 parallel design passes.

## The model: two surfaces, one Plan, a few activities

The app is **two co-equal surfaces with a fast toggle between them**, scoped by a
**Plan**, with a handful of **activities** that act over the Problems surface.

```
┌─ PROBLEMS (plan-scoped) ──────┐  segmented  ┌─ REFERENCE (always-on) ───────┐
│ Patterns + Applied            │  toggle +   │ Syntax fundamentals           │
│ • the lesson you're working   │  Tab key    │ + Cheat / Glossary / Shapes   │
│ • inline Repair icons         │  ⇄ ⇄ ⇄      │ • NOT plan-scoped (Syntax)    │
│ • Drill/Simulate act on scope │             │ • cheat/shapes adapt to Plan  │
│ • remembers selection+scroll  │             │ • remembers selection+scroll  │
└───────────────────────────────┘             └───────────────────────────────┘
        ▲ scoped by Plan
   [ Plan ] topbar nav link → full-page home (progress + start). Switch Plan in sidebar.
   Activities (topbar): Drill · Simulate · Reflect.   Utilities: 🔍 ⌘K · ⚙️
```

Why this is the spine: the three "tracks" were never peers. **Syntax is reference
you *consult*; Patterns+Applied are problems you *work*.** Splitting them into two
position-preserving surfaces, scoped by Plan, collapses ~51 entry points into:
**Problems ⇄ Reference · Plan · Drill/Simulate/Reflect · Settings.**

## Topbar (final composition)

- **Desktop:** `JS Drill │ [ Problems | Reference ] │ Plan │ Drill▾ Simulate▾ Reflect▾ │ ⟶ 🔍 ⚙️`
  - `[ Problems | Reference ]` — segmented toggle near the wordmark (co-equal halves). `Tab` key flips it.
  - `Plan` — a **nav link** (not a dropdown, not a switcher) → the full-page Plan home.
  - `Drill / Simulate / Reflect` — activity dropdowns, operate over the active Plan's Problems scope.
  - **No Plan switcher in the topbar** (it's in the sidebar — see below).
- **Mobile (≤767px):** `☰  JS Drill  [Prob|Ref]  🧭 🔍 ⚙️`. The toggle stays visible (it's core); `🧭` opens the activities sheet (Drill/Simulate/Reflect + Plan); `☰` opens the sidebar drawer for the current surface.

## Plan (the full-page home)

The generalization of Cram Home to every Plan — a full-page progress/start surface,
not a modal. Renamed from "Today's Plan."
- **Cram Plan:** the existing Day N/M strip + carryover + big-rocks + checkpoints.
- **Starter / Eve-Legal / All:** progress through the Plan's sequence + "Continue"
  + the quick-start actions (🌅 Warmup, 🍀 Lucky, 🎲 Shuffle) that used to float in
  the topbar now live **here**.
- Plan **switching** happens in the sidebar (primary) and is also offered on this
  page (managing your plan).
- Shows **plan-progress only**. Cross-plan analytics live in Reflect (below).

## Sidebar (per-surface navigation)

The sidebar renders the **current surface's** contents. The 51-button launcher pile
is gone entirely.

**In PROBLEMS context:**
- Plan header (name + switch affordance) · **filter-chip row** · lesson list.
- **Path View is implicit** — the list always shows the active Plan's lessons in
  order. To see everything, switch Plan to "All Lessons." (No Path View chip.)
- **Repair is ambient, not a destination:** every affected lesson shows an inline
  status icon (🕒 due / ⚠️ weak / 💀 overdue / 🃏 reveal / 🧠 bridge) to the right of
  its label. The **Repair filter** ("show only what needs work") is one option in
  the filter view — it reuses `renderSidebar()`'s predicate chain and the
  `buildRepairIndex()` union (resurrect→due→weak→reveal→bridge, deduped). At-Risk
  dissolves (it was already weak∪reveal). New state: `state.repairFilter` (additive).
- **Filter chips:** `🛠 Repair N` (filter) · `👁 Hide Mastered`. Hide-Mastered
  auto-disables (greyed) under the Repair filter.

**In REFERENCE context:**
- Syntax fundamentals section list (Basics · Arrays · Hash Structures · Modern
  Syntax · Iterators & Generators · JS Toolbox · Classes · Async · Advanced · Traps —
  **Algorithms removed**, see migration) + a "Quick refs" group (⚡ Cheat · 🅰 Glossary
  · 〈〉 Code Shapes; plan-adaptive contents).
- Not plan-scoped for Syntax; cheat/shapes adapt to the active Plan.

## The toggle (the one new interaction)

A `state.surface ∈ {problems, reference}` flip that is **instant and lossless**:
- Each surface keeps its **own** `{selectedLessonId, tab, scrollY}` (`state.ctx.problems`,
  `state.ctx.reference`). Flipping restores the other surface exactly where you left it.
- Triggered by the segmented control or `Tab`. On mobile it's a full-screen flip
  (no split-pane — phone-80%).
- Mechanism: a `setSurface(s)` that snapshots the outgoing surface's position,
  swaps sidebar + main render, restores the incoming surface's position via
  `requestAnimationFrame`. Mirrors the `enterSessionShell` snapshot/restore pattern.

## Activities over Problems

### Drill — 5 families (tap = blended set · ⋯ = one variant)
| Family | Members |
|---|---|
| 🧠 Run it in your head | crystal, whatif, trace-hop, reverse-walk |
| 🔧 Judge a code change | bug-hunt, mutate, claim, constraint-shift, swap |
| 🧭 Name the pattern | recognize, reverse, constellation, match |
| 📝 Recall the traps | notes-drill, notes-locate, gotcha |
| 🎬 Interview meta | conv-drill |
Launch = shuffle-and-dispatch over existing `*-btn` entry points (synth-click), hosted full-bleed by the Session shell.

### Simulate
mock · rapid-fire · big-o · speedrun · gauntlet · phone-screen — over the Plan's scope.

### Reflect — cross-plan analytics dashboard (Phase 9)
One full-bleed surface, sticky chip-nav (not tabs), facts-only: **Stats · Streak map
(calendar density, no 🔥 counter) · Sections · Mechanics** (list default on mobile).
Export + AI-Coach are footer actions. *Plan-specific* progress is NOT here — that's
the Plan page; Reflect is the all-time / cross-plan view.

## Session shell (full-bleed, for Drill/Simulate)

`body.in-session` + a fixed `#session-shell` (`z≈55`, `100dvh`). Header (activity +
`3/20` + intrinsic-streak-only + `✕ Exit`) / scrollable body (reuses `.recognize-*`)
/ optional footer. `enterSessionShell(opts)` snapshots `{lessonId,tab,scrollY}`,
adds `body.in-session`, `history.pushState`; `exitSessionShell()` restores. Back-button
/ Esc = exit; dirty-exit shows an inline confirm strip. Membership = *self-contained
loop that returns you where you were* (the ~24 drills/sims). Pickers that route into a
lesson (Plan/Lucky/Repair) are NOT sessions — they hand off to the Problems surface.

## Settings (session modifiers + config)

clarify-ritual · hotseat · calibrate · pace-bar · haptic · install · offline · backup ·
restore · reset. clarify/hotseat moved here from Drill (they're modifiers, not drills —
must be one atomic edit or they vanish).

## Content migration (data-only)

- **Algorithms section moves Syntax → Patterns as "Basics."** It's pattern-prerequisite
  boilerplate (BFS queue, DFS template, matrix dirs, heap math), not language reference.
  Touches: `manifest.json` (section move + slug), each lesson's `section`/`track`,
  `paths.json` (Starter sequence), `mechanics.json` tags. Other Syntax sections stay.
- **Syntax track becomes the Reference surface's content** (minus Algorithms).

## Cross-cutting contracts

- **Surface = the top-level state.** `state.surface` + per-surface position memory is
  the new spine; Plan scopes only the Problems surface.
- **DOM-retention + synth-click:** launcher `<button>` nodes stay in the DOM (hidden);
  topbar activities + Cmd-K launch via synthetic-click. Don't delete them.
- **One curation principle, three consumers:** `body.in-session` (hide all chrome),
  `plan.sidebarButtons[]` (plan-scoped problems), and surface-toggle (problems vs
  reference) are all specializations of the generalized `applySidebarCuration` (Phase 4).
- **Plan-scoped chrome:** Plan drives the Problems surface's scope, the activities'
  corpus, and cheat/shapes contents. Surfaces with no Plan-relevant content are omitted.

## Resolved decisions (2026-05-27)

1. Repair = ambient inline icons + a filter option (canonical home: sidebar). ✓
2. References are **plan-scoped**, folded into the Reference surface (not cram-only). ✓
3. Drill = **5 families** (swap folded into "Judge a code change"; conv-drill standalone). ✓
4. **No Plan switcher in topbar** — sidebar + Plan page only. ✓
5. **"Today's Plan" → "Plan"**, a full-page home, a topbar nav link (not a dropdown). ✓
6. **Path View implicit** — switch Plan to "All Lessons" to see everything. ✓
7. **Syntax extracted** into the Reference surface; **Algorithms → Patterns "Basics."** ✓
8. **Reflect** = cross-plan analytics; plan-progress lives on the Plan page. ✓
9. Toggle = **segmented Problems⇄Reference control + `Tab`**, lossless position memory. ✓
10. Mock Interview enters the Session shell (frame) with a Study-L3 body. ✓

## Phasing impact

Re-anchors `navigation-refactor-phasing.md`:
- New early phase: **Surface split** — extract Syntax into the Reference surface +
  the Problems⇄Reference toggle (the new spine; everything hangs off it).
- New data-only phase: **Algorithms → Patterns "Basics"** migration.
- **Plan page** = generalize Cram Home (replaces the "extract Today" phase — Today
  becomes the Plan home).
- Repair phase becomes "inline icons + filter option" (lighter than a list-replacing mode).
- Path View removal folds into the Plan-scoping work (implicit).
