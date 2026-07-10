# Surface & Mode Inventory

Every entry point in the current app, with a **verdict** for the redesign. This
is seeded from a grep of `-btn` ids across `index.html` + `js/app/*.js` (~60
modes) plus the shell surfaces. **Phase 0 fills in every verdict**; later
iterations keep it honest as things move.

Verdicts: **KEEP** (primary surface) · **MERGE→X** (fold into surface X) ·
**DEMOTE** (reachable via launcher/palette only, not permanent chrome) ·
**SETTINGS** (move into the Settings surface) · **RETIRE** (dead/duplicative —
log in `DECISIONS.md`). Every capability must remain reachable unless RETIRED
with rationale.

> Reachability contract: KEEP/MERGE/DEMOTE all stay live via the new IA +
> `#/m/<mode>` routes + command palette. Only RETIRE removes a capability.

## Shell surfaces
| Surface | Today | Verdict | Notes |
|---|---|---|---|
| Topbar (4 dropdowns + links + icons) | `#topbar` | TBD | Replace with the P1 nav model |
| Sidebar (nav, track tabs, filter, search) | `#sidebar-nav` | TBD | → P4 Browse |
| Settings dropdown | `#topbar-dropdown` | TBD | → P6 Settings |
| Command palette | `palette-*` | KEEP | The long-tail power path |
| Cram progress widget | `#topbar-cram-progress` | TBD | → Home/Plan |

## Core loop (protect above all)
Reference · L1 · L2 · L3 · reveal — the beating heart. **KEEP**, redesign in P7.

## Modes (fill verdicts in P0)
_Grouped by today's menu; grep source of truth is the `-btn` list._

**Practice / plan:** `path-btn` `today-btn` `mock-btn` `warmup-btn` `weak-btn` `resurrect-btn` `at-risk-btn` `lucky-btn` — TBD
**Drills:** `recognize-btn` `rapid-fire-btn` `swap-btn` `speedrun-btn` `match-btn` `gauntlet-btn` `bug-hunt-btn` `gotcha-btn` `trace-hop-btn` `reverse-walk-btn` `constellation-btn` `sections-grid-btn` `big-o-btn` `mutate-btn` `whatif-btn` `constraint-shift-btn` `reverse-btn` `crystal-btn` — TBD
**Train:** `conv-drill-btn` `notes-drill-btn` `notes-locate-btn` `hotseat-btn` `phone-screen-btn` `clarify-ritual-btn` `bridge-btn` `calibrate-btn` `ai-coach-btn` — TBD
**Review / insights:** `stats-btn` `streak-map-btn` `mechanics-btn` `review-btn` `dashboard-btn` `reveal-replay-btn` `repair-filter-btn` `shuffle-btn` — TBD → mostly MERGE→Progress
**Cram:** `cram-review-btn` `cram-cheat-btn` `cram-glossary-btn` `cram-shapes-btn` `cram-behavior-btn` — TBD → MERGE→Cram/Plan
**Settings / utility:** `font-size-btn` `haptic-btn` `audio-btn` `adhd-mode-btn` `pace-bar-btn` `offline-pack-btn` `install-btn` `backup-btn` `restore-btn` `export-btn` `reset-btn` — TBD → mostly SETTINGS
**Other:** `hide-mastered-btn` (→Browse) `claim-btn` — TBD

## How to use this in a slice
When redesigning a surface, consult this file for what folds into it, update the
verdicts you touch, and confirm every non-RETIRED mode is still reachable before
you commit.
