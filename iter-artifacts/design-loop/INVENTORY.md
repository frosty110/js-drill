# Surface & Mode Inventory

Every entry point in the current app, with a **verdict** for the redesign. This
is seeded from a grep of `-btn` ids across `index.html` + `js/app/*.js` (~60
modes) plus the shell surfaces. **Verdicts filled 2026-07-10 (P0 close-out)**;
later iterations keep it honest as things move.

Verdicts: **KEEP** (primary surface) · **MERGE→X** (fold into surface X) ·
**DEMOTE** (reachable via launcher/palette only, not permanent chrome) ·
**SETTINGS** (move into the Settings surface) · **RETIRE** (dead/duplicative —
log in `DECISIONS.md`). Every capability must remain reachable unless RETIRED
with rationale.

> Reachability contract: KEEP/MERGE/DEMOTE all stay live via the new IA +
> `#/m/<mode>` routes + command palette. Only RETIRE removes a capability.
>
> **P0 verdict pass result: ZERO capabilities retired.** Only *chrome* is
> replaced (topbar dropdowns → adaptive nav, D01/D05); every mode remains
> reachable via its new home + `#/m/<mode>` + palette.

Target IA (D01): **Today · Browse · Practice · Progress** (+ Settings via gear).

## Shell surfaces
| Surface | Today | Verdict | Notes |
|---|---|---|---|
| Topbar (4 dropdowns + links + icons) | `#topbar` | RETIRE (chrome only — D05) | Replaced by the P1 adaptive nav; every item remapped below |
| Sidebar (nav, track tabs, filter, search) | `#sidebar-nav` | MERGE→Browse | **Landed (P4c/D10):** Browse page owns search/segments/filters/list; drawer retired (aside stays in DOM as synthetic-click host); plan switcher lives in Browse's filter panel |
| Settings dropdown | `#topbar-dropdown` (⚙️) | MERGE→Settings | **Landed (P6/D11):** `#topbar-settings` opens the ds Settings sheet (`openSettings`); the legacy dropdown never fires for settings; desktop 🔍/❓/⚙ strip retired (rail carries them) |
| Command palette | `palette-*` | KEEP | The long-tail power path; redesign in P1 |
| Cram progress widget | `#topbar-cram-progress` | MERGE→Today | Home shows active-plan progress ambiently |
| Session heatstrip | `#heatstrip-wrap` | MERGE→Progress | **Landed (P5 + P4c):** session summary line in Progress "Today"; the sidebar strip died with the drawer (D10) |
| Surface toggle (Problems ⇄ Reference) | `.surface-toggle` | MERGE→Browse | Becomes a Browse facet/segment |
| System Design link | `#topbar-system-design` | KEEP | Separate page; nav entry point stays (family-unified in P8) |
| Diagnostic page | `diagnostic.html` | KEEP | Separate page; family-unified in P8 |

## Core loop (protect above all)
Reference · Conversation · Walkthrough · L1 · L2 · L3 · reveal — the beating
heart. **KEEP**, redesign in P7.

## Modes

**Practice / plan**
| Mode | Verdict | New home |
|---|---|---|
| `today-btn` (Today's Plan) | MERGE→Today | *Is* the home surface's core (P2 one-tap next rep) |
| `review-btn` (due reviews) | MERGE→Today | Due queue is the top next-rep signal |
| `warmup-btn` (3-card warmup) | MERGE→Today | The one-tap quick session on home |
| `mock-btn` (Mock Interview) | MERGE→Practice | Prominent launcher entry |
| `weak-btn` (weak spots) | MERGE→Practice | Launcher entry; also feeds Today queue |
| `lucky-btn` (random pick) | DEMOTE | Palette + launcher long tail |
| `path-btn` (Plan View filter) | MERGE→Browse | **Landed (P4c):** "Plan view" toggle + scope chips in Browse's filter panel (same starterPath/starterPathTrack state) |
| `at-risk-btn` (decay radar) | MERGE→Progress | **Landed (P5):** modal chrome retired; btn + `#/m/at-risk` open Progress "Fix first" (same rows/routes) |
| `resurrect-btn` (long-overdue) | MERGE→Progress | **Landed (P5):** Progress "Fix first" action row; direct-jump button behavior kept |

**Drills** (the long tail — grouped & progressively disclosed in the P3
launcher; every one also palette- and `#/m/`-reachable)
| Mode | Verdict | Notes |
|---|---|---|
| `recognize-btn` `rapid-fire-btn` `swap-btn` `speedrun-btn` `match-btn` `gauntlet-btn` `bug-hunt-btn` `gotcha-btn` `trace-hop-btn` `reverse-walk-btn` `big-o-btn` `mutate-btn` `whatif-btn` `constraint-shift-btn` `reverse-btn` `crystal-btn` `claim-btn` | MERGE→Practice | Grouped by recall direction in the launcher (recognition / prediction / transfer / speed) |
| `constellation-btn` | MERGE→Practice | Mechanics-recall drill, same group |
| `sections-grid-btn` (mastery heatmap) | MERGE→Browse | It's a spatial "where do I study" nav view, not a drill |

**Train**
| Mode | Verdict | Notes |
|---|---|---|
| `conv-drill-btn` `notes-drill-btn` `notes-locate-btn` `phone-screen-btn` | MERGE→Practice | Interview-arc drills, launcher group |
| `clarify-ritual-btn` `hotseat-btn` `calibrate-btn` | SETTINGS | **Landed (P6):** "Interview rituals" toggle group in the Settings sheet (each row synth-clicks the hidden btn) |
| `bridge-btn` (transfer gaps) | MERGE→Progress | Insight surface that routes to lessons |
| `ai-coach-btn` (weak-spot export) | DEMOTE | Palette-reachable export utility |

**Review / insights**
| Mode | Verdict | Notes |
|---|---|---|
| `dashboard-btn` | MERGE→Progress | **Landed (P5):** openDashboard delegates to the ds openProgress (js/app/20-progress.js) |
| `stats-btn` `streak-map-btn` | MERGE→Progress | **Landed (P5):** route to the ds Progress page (stats in Mastery/More-insights; streak map in Activity) |
| `mechanics-btn` | MERGE→Browse | Browse-by-idiom index (list + matrix) |
| `reveal-replay-btn` | MERGE→Progress | **Landed (P5):** Progress "Fix first" action row; direct-jump button behavior kept |
| `repair-filter-btn` | MERGE→Browse | **Landed (P4c):** "Needs work" toggle in Browse's filter panel; now spans all tracks (D10) |
| `shuffle-btn` | DEMOTE | Palette + keyboard (`s`) only |

**Cram**
| Mode | Verdict | Notes |
|---|---|---|
| `cram-review-btn` | MERGE→Today | Due-based; joins the home queue when a cram plan is active |
| `cram-cheat-btn` `cram-glossary-btn` `cram-shapes-btn` `cram-behavior-btn` | MERGE→Browse | Reference shelf (Browse's Reference segment) |

**Settings / utility**
| Mode | Verdict | Notes |
|---|---|---|
| `font-size-btn` `haptic-btn` `adhd-mode-btn` `pace-bar-btn` | SETTINGS | **Landed (P6):** Display (font size `.ds-seg` · ADHD · pace bar) + Feedback (haptics, self-gated) groups |
| `offline-pack-btn` `install-btn` | SETTINGS | **Landed (P6):** Install & offline group (both self-gate on capability) |
| `backup-btn` `restore-btn` `reset-btn` | SETTINGS | **Landed (P6):** Data & sync group; Reset carries a danger badge + its own confirm guard |
| `audio-btn` (episodes) | MERGE→Practice | It's a listening mode with a playlist, not a setting |
| `export-btn` (Cheatsheet) | MERGE→Browse | Quick-reference panel → Browse's Reference segment |

**Other**
| Mode | Verdict | Notes |
|---|---|---|
| `hide-mastered-btn` | MERGE→Browse | **Landed (P4c):** "Hide mastered" toggle in Browse's filter panel (due reviews stay visible; yields under Needs work) |
| Sync chip (`js/sync.js`) | SETTINGS | **Landed (P6):** a "Cross-device sync" row in Data & sync shows live status (signed-in email / local-only) and opens the existing sync modal; the ambient chip stays (session-hidden per nav-audit P2-7). Rebuilding the auth modal on ds is deferred to P8/P9 |

## How to use this in a slice
When redesigning a surface, consult this file for what folds into it, update the
verdicts you touch, and confirm every non-RETIRED mode is still reachable before
you commit.
