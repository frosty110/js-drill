# Navigation & Intent Refactor — High-Level Goals

> A multi-iter UI/UX epic. Captures the vision agreed in discussion (2026-05).
> Phasing plan is a separate doc (TBD) — this is the goals layer only.

## The problem

The app has grown to **~51 top-level entry points** — all ~45 mode buttons live
in a `flex-wrap` pile at the top of the sidebar (`index.html:282–332`), and the
iter-127–130 topbar dropdowns (`TOPBAR_MENU_TAXONOMY`, `app.js:11985`) *clone
those same buttons* into categories. So launching a mode is presented **twice**,
and the sidebar is doing two unrelated jobs: curriculum navigation **and** mode
launching. Sessions render into the main pane (`lesson-shell`) with the sidebar
always visible — so a heads-down drill competes with the lesson list for a phone
screen. The 🍀 Lucky button's only job is "choose for me" — a tell that there
are too many doors.

Current grouping is by **mechanism** ("what kind of interaction"). The shift is
to organize by **intent** ("what job am I here to do"), because the app has **one
persona** (PROFILE.md) but **many session-intents**.

## The reframe: 3 shells, not a menu

The app has three fundamental modes, each wanting different chrome:

| Shell | When | Chrome |
|---|---|---|
| **Study** | Learning/reviewing a specific lesson along a path | Sidebar (path + lesson list) + lesson tabs |
| **Session** | A self-contained focused activity (drill / stream / sim) | Full-bleed, sidebar hidden, one task, own exit |
| **Insights** | Reading your own progress | Dashboard, no sidebar |

The **topbar becomes the single intent-switcher** between shells. **Repair** and
**Start** are not shells — they are transient *pickers* that resolve into Study
or Session and get out of the way.

### Shipped precedent (2026-05) — `path-as-focus-mode`

The prep→Cram dissolution (commits `4a0638b` → `28b1ddd`) is the **first shipped
proof of this model**, before any phasing:
- **Cram Home is full-window, not a modal** — validates the shell principle (#4).
- **Focus mode hides drill-supplement modes that don't fit a 4-day timescale** —
  the active path drives which launchers exist. This *is* the intent→chrome
  coupling the whole refactor rests on, demonstrated in production.
- **First-time path picker** — an intent-selection front door at launch.
- **Contextual topbar (Day N/M strip)** — the topbar already changes by mode.

Takeaway: the refactor's risky premise is no longer a premise. Generalize the
`path`-driven curation that Cram introduced into the broader Study/Session/
Insights shell split.

## Current state — re-derived 2026-05-27 (the scorecard)

Counts re-measured against live code (not trusted from memory):

| Surface | Count now | Note |
|---|---|---|
| Sidebar launcher pile (in DOM) | **51 buttons** | `index.html:304` flex-wrap |
| …visible on **default/Starter** plan | **~46** | only 5 cram-only hidden |
| …visible on **Cram** plan | small curated set | via `plan.sidebarButtons[]` |
| Topbar dropdown slots | **54** (P11/D19/T5/**I11**/S8) | *clones* the same buttons |
| Modals | **10** | `cram-ref` reused 4× (good) |
| Sidebar filter chips | Plan + Hide-mastered | relocated out of Settings ✓ |

**The engine already exists.** `applySidebarCuration()` (`app.js:1241`) hides every
launcher a plan doesn't declare in `plan.sidebarButtons[]`. Only Cram uses it.
**Generalizing it from plan-scoped to intent-scoped is the load-bearing move** —
it already proves the sidebar pile is dispensable.

**The root bloat is duplication, not count.** On the default plan ~46 launchers
render in the sidebar pile *and* are re-presented in the topbar dropdowns — two
parallel launch systems. The iter-127 topbar didn't replace the pile; it cloned it.

### Goal scorecard

| Goal | Status | Evidence |
|---|---|---|
| #1 Intent cut | ❌ not started | topbar still mechanism-grouped (`TOPBAR_MENU_TAXONOMY`) |
| #2 ~51 → 4 surfaces | ⚠️ regressed | sidebar 45→51; Insights 6→11 |
| #3 Sidebar = filtered list | 🟡 edge done | Plan + Hide-mastered are chips; Repair/Start consolidation pending |
| #4 Session shell | 🟡 proven, not general | only Cram Home is full-window |
| #5 Drills 19 → 6 | ❌ not started | still 19 in `drills` menu |
| #6 Insights 4 → 1 dashboard | ⚠️ regressed | became an 11-item junk drawer (refs + SR dumped in) |
| #7 Demote modifiers | 🟡 partial | pace-bar/haptic/install → Settings ✓ |

Net: ~15% toward the vision, one regression (Insights), core duplication untouched —
but the hard part (proving intent→chrome + building its engine) is done.

## 2026-05-27 decisions (amend the goals above)

- **Vocabulary: "Plan" replaces "Path" application-wide.** The route a user is on
  is their **Plan** (Starter Plan / 4-Day Cram / Eve-Legal). User-facing copy
  renames now (`Starter Path`→`Plan`, `Path View`→`Plan View`, the `Path:` chip→
  `Plan:`); code identifiers (`paths.json`, `getSubscribedPath`, `path.kind`) are
  an optional later pure-refactor phase.
- **"Today" is a first-class primary action**, extracted from the launcher pile.
  It is the most common "what do I do now" action and the default front door —
  not an item buried among 50 others. Labeled **📅 Today** (the daily slice of
  your Plan) to stay distinct from the **Plan** route selector.
- This sharpens goal #1: the primary surface is **📅 Today** (default) + the
  intent menus (**Repair · Drill · Simulate · Reflect**) + the **Plan** selector —
  with Start's old members (warmup/lucky/shuffle) as quick alternates near Today.

## High-level goals

1. **Organize by intent, not mechanism.** Five session-intents — **Start ·
   Repair · Drill · Simulate · Reflect** — replace the Practice/Drills/Train/
   Insights mechanism cut. *End state:* a user can name why they opened the app
   and find the one door that matches.

2. **Collapse ~51 entry points → 4 surfaces** (+ Settings): the **sidebar**
   (Study + Repair + Start as filter presets), the **Session shell**, the
   **Insights dashboard**, and the **topbar** intent-switcher. *Metric:* no
   menu/list on a phone screen exceeds ~6 items.

3. **The sidebar is the one filterable lesson list.** `renderSidebar()` already
   composes filter predicates (`inStarter`, `hideMasteredOk`, track scope —
   `app.js:6936`). **Repair** (`due ∪ weak ∪ at-risk ∪ overdue ∪ reveal ∪
   bridge`, ranked by urgency) and **Start** (today / lucky / shuffle) become
   *additional filter presets* — a chip row on the sidebar, not new surfaces.
   Path View is the existing precedent. *Reuse is semantic ("same lesson list,
   filtered") — NOT a generic panel host.*
   - Collapses: 6 Repair buttons + today/lucky/shuffle + Path View → one chip row.
   - Only addition needed: a per-item reason badge ("due 3d", "missed L1 ×2").

4. **Build the Session shell — full-bleed focus.** Self-contained drills, streams,
   and sims own the full viewport with one obvious ✕ Exit and **no sidebar**
   (hidden entirely, not a rail — the rail is desktop-brain; phone has no spare
   width). A Session is defined by *focus* ("one task that owns the screen until
   you exit"), with chrome-hiding as the consequence.

5. **Consolidate the 19 drills → ~6 recall-direction families:**
   - **Execute in your head** — crystal, whatif, trace-hop, reverse-walk
   - **Reason about a code change** — bug-hunt, mutate, claim, constraint-shift
   - **Identify the pattern** — recognize, reverse, constellation, match
   - **Notes & traps** — notes-drill, notes-locate, gotcha
   - **Idiom equivalence** — swap
   - **Interview meta** — conv-drill (+ clarify/hotseat as modifiers, see #7)

6. **Consolidate Insights: 4 modals → 1 dashboard.** stats, streak-map,
   sections-grid, mechanics merge into one Insights surface (export + ai-coach
   become actions inside it), replacing 4 separate modal launches.

7. **Demote session *modifiers* out of the top level.** clarify, hotseat,
   calibrate, pace-bar, haptic are toggles that decorate a Study/Simulate
   session — they are not modes and should not be top-level buttons. Move them
   into session config / Settings.

## Design guardrails (non-negotiable)

- **Phone-80% (PROFILE.md):** every decision optimizes the one-handed phone loop;
  full-bleed Sessions and chip-filtered sidebar both serve this.
- **Anti-gamification (PROFILE.md L75):** no streak counts, no leaderboards
  introduced by this refactor; Insights stays facts-only.
- **Every phase ships green:** each iter independently passes
  `node tools/validate-data.js`, keeps the app working, and is reversible. No
  big-bang.
- **Semantic reuse, not mechanical:** the sidebar stays "the lesson list,
  filtered" — do not abstract its drawer into a generic content host.
- **No feature loss:** every one of the ~51 behaviors still reachable post-refactor
  (consolidated, not deleted) unless explicitly decided otherwise.

## Target end-state

**One sidebar** (Study + Repair + Start, as filter presets) · **one Session shell**
(full-bleed) · **one Insights dashboard** · **topbar as the intent-switcher** —
down from ~51 entry points.

## Status of the standalone pages

- **`prep.html` — DONE (2026-05).** Dissolved into the main app as the cram-aware
  `4-Day Cram` path + first-time path picker (`path-as-focus-mode` epic). No
  longer a separate page-integration risk; it's the precedent above.
- **`diagnostic.html` — partially wired.** Reachable as a "diagnostic shortcut"
  in the launch path picker; full fold-in (→ onboarding/Reflect) still open.

## Next

See **`navigation-refactor-phasing.md`** for the ordered, independently-shippable
phase plan. Load-bearing first phase: **kill the duplication** (topbar = sole
launcher; retire the sidebar pile) — reusing `applySidebarCuration`, which already
proves the pile is dispensable.
