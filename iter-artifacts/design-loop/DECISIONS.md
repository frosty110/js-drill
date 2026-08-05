# Decision Log (append-only)

Every product-shaping choice — nav model, what retires, a divergence from a
default — gets one entry. This is the anti-drift record: future iterations read
it to avoid relitigating settled calls. Never rewrite history; supersede with a
new entry if a decision changes.

Format:
```
## D<NN> · <short title>  (<date> · iter <N>)
Decision: <what was decided>
Rationale: <why, tied to PROFILE/PERSONAS/PRINCIPLES>
Alternatives considered: <what was rejected and why>
Reversible? <yes/no + how>
```

---

## OPEN (awaiting resolution — do not build past these until decided)
- (none)

---

## RESOLVED

## D15 · IA reconciled: three destinations, progress moves to the header, hierarchy via `parent`  (2026-08-04 · user decision)
Decision: adopt [`docs/information-architecture.md`](../../docs/information-architecture.md)
as the app's IA. In short: (a) the app answers four questions — what now /
show me everything / how am I doing / change how it works; (b) the primary nav
closes at **three** destinations — **Home · Library · Design** — plus the two
aux items, **superseding D01's five**; (c) **Progress leaves the rail and
becomes the header**, scoped to wherever the user currently is, with the full
dashboard behind a click on the meter (narrows D09: the surface survives, its
rail rung does not); (d) **Practice is a verb** — its sessions promote onto
Home, its ~17 drills stay a launcher sheet, and it stops being a nav rung; (e)
Home's track cards and Browse are one surface, **Library**; Home's *More* list
is deleted as four duplicate rows; (f) the mechanism under all of it is a
**`parent` field on every `js/routes.js` row**, from which breadcrumbs,
up-navigation, truthful `aria-current` and the header's scoped meter all derive.
System Design keeps its rail rung for now but gains the app shell (§4.1); it
becomes a Library track in a later slice.
Rationale: a scripted 15-step walk of the live app at 390px + 1280px measured
0/15 surfaces with a breadcrumb, no `aria-current` anywhere inside a lesson, a
rail destination (Practice) that never changes the URL, an overlay surviving a
navigation, `history.back()` collapsing a whole system-design excursion into one
entry, and the rail absent entirely on `system-design.html`. Every one traces to
the same gap: `js/routes.js` knows what a URL *is* and never what it is *inside
of*. Three surfaces answered "what needs repair" and two rendered the same
29-section taxonomy — the duplication PROFILE's one-decision, phone-first,
ADHD-prone user pays for on every screen. No capability retires (D05's
principle): every mode stays reachable via the palette and `#/m/<slug>`.
Alternatives considered: **adopt a framework** (React/Astro) for nested routing
— rejected: it would have made three of the defects structurally impossible, but
none of them is *caused* by the absence of one, and the cost is the no-build-step
property, the 412 committed static share pages, and most of the 181 DOM-coupled
probes; the `parent` field buys the same property for one field. **Keep Progress
in the rail AND add header stats** (the "or maybe both" option) — rejected: two
homes for one concept is precisely how this drift accumulated. **Retire the
low-value drills** — rejected again, same reason as D05: no usage data.
Reversible? Yes, and phase-by-phase — the migration in §7 is seven independently
shippable slices, each green on its own; phase 1 (`parent` + breadcrumb) is
purely additive, and the risky one (phase 5, Practice sessions onto Home) ships
behind the `feature-scaffold`/`wire`/`ship` flag sequence.

## D14 · Deferred-backlog disposition (each item cleared / accepted / deferred-with-reason)  (2026-07-11 · iter 18)
Decision: an explicit accounting of every deferred item from the nav + supabase
audits and the design-loop STATE deferrals, so the backlog is auditable rather
than an open-ended list:
- **DONE this cycle:** per-family drill disclosure in the launcher (P2-4, iter
  14); Problems⇄Reference toggle fold (D13, iter 15); the `mistake-tagging`
  probe migrated off the retired Stats modal → Progress "Top miss patterns"
  (iter 13). Bridge transfer-gap row + At-Risk ranked rows already live in
  Progress "Fix first" (`js/app/20-progress.js`, shipped with the audit fixes).
- **ACCEPTED as an intentional tradeoff (no change):**
  · *Consistency-heatmap day-cells <44px* — a 60-cell calendar can't give every
  cell a 44px target without dominating the screen; the persistent detail line
  + per-cell `title`/`aria-label` carry the same data on hover/tap/focus. This
  is the tradeoff every calendar heatmap makes (GitHub, Oura). Cells are
  keyboard-focusable and the section is informational, not a primary tap path.
  · *At-Risk "N DUE · M SOON" inventory strip not reproduced* — the per-row
  attention chips ("due now" / "due in Xd" / "N misses" / "revealed") carry the
  same signal at higher fidelity than a rolled-up strip; a summary strip would
  duplicate, not add.
- **DEFERRED to a dedicated focused slice (with reason):**
  · *Delete the ~600-line legacy Dashboard/sidebar renderers* (`renderDailyInto`/
  `renderActivityInto`/`renderStatsInto` + the at-risk modal) — dead code behind
  the openProgress delegation; safe to keep until the `dashboard-probe`/
  `dashboard-activity-probe`/`refine-stats-modal`/`at-risk-radar` probes are
  rewritten-or-retired. Deleting them WITHOUT retiring those probes would go
  red; it's a probe-cleanup-then-delete slice, not a drive-by.
  · *Topic-facet chip density in Browse* (~19 wrapping chips) — fine inside the
  closed-by-default Filters panel; a per-group disclosure is tighter craft but
  not a blocker.
  · *Reference-tab Flash/Cinema/Notes toggles still carry emoji* (D07) — their
  labels change dynamically across ~6-8 `.textContent` sites, so a clean
  conversion belongs to a holistic Reference-tab redesign (P7), not a piecemeal
  swap. Same for the system-design page header emoji (📊 Stats / 📇 badge) and
  the L1 carryover/mistake-strip emoji.
  · *Weakness-clear call sites left un-timestamped in the P1-3 sync fix* (07/12a
  slices) — a sync-correctness concern that wants a focused pass over the merge
  policy, not a rushed edit.
Rationale: the prompt's closeout bar is "backlog cleared OR explicitly accepted
in DECISIONS.md" — this entry meets the second half for the items that are
either intentional tradeoffs or genuinely need a dedicated slice, and records
the first half for what shipped.
Reversible? N/A (a disposition record, not a code change).

## D13 · Problems⇄Reference toggle folds into Browse at desktop; stays on mobile lessons  (2026-07-10 · iter 15, user decision)
Decision: The topbar Problems⇄Reference `.surface-toggle` is retired from the
DESKTOP topbar (`display:none` at ≥768px in css/06-ds-nav.css, beside the P6
icon-strip retirement) and KEPT on mobile (≤767px). Its drawer-era job — steering
the sidebar lesson list — died with D10; Browse's Type facet + track segments
(plus the desktop rail) already recover the Problems/Reference split, so the
desktop toggle was redundant chrome. On mobile it stays because it's the only
inline track-context switcher while viewing a lesson (swap Problems ⇄
Reference/Syntax without leaving the lesson) — that inline switch has no mobile
replacement until P7 redesigns lesson chrome. The button + its handler remain in
the DOM (synthetic-click target; Browse's own segment sync is independent), so
zero capability is lost (D05).
Rationale: user chose "fold into Browse; keep on mobile" (the nav-audit P2-6d
recommendation) — the least-disruptive option that de-clutters the desktop
topbar (Decisions-budget: persistent chrome ≤4 destinations, D01) without
stranding the mobile lesson's track switch. Supersedes D08's interim retention
of the toggle at all viewports.
Alternatives considered: retire it entirely (rejected by the user — leaves mobile
lessons without an inline track switch until P7); keep it as-is at all viewports
(rejected — the desktop redundancy the nav audit flagged).
Reversible? Yes — one `display:none` rule; a revert restores the toggle on
desktop (DOM + handler never left). P7 revisits the mobile lesson-chrome switch.

## D12 · Family unified on ds; legacy tokens.css merged as value-exact aliases (not a full recolor)  (2026-07-10 · iter 12)
Decision: `system-design.html` and `diagnostic.html` migrate onto
`ds/tokens.css` + `ds/components.css`: their MC options adopt `.ds-opt`
(+`.ds-opt__key`/`__body`, `.is-correct`/`.is-wrong`/`.is-selected`), CTAs adopt
`.ds-btn` variants, the system-design stats modal adopts `.ds-scrim`/`.ds-sheet`,
and every raw hex in their inline `<style>` maps to a ds/alias token (the only
literals left are system-design's mermaid `themeVariables`, a JS diagram-theme
config the library needs). The retired root `tokens.css` is **merged into
ds/tokens.css as a "legacy aliases" block** rather than deleted-and-rewritten:
surfaces/text/accent/fonts/targets alias straight to their identical-valued
`--ds-*` role; the few tokens whose value differs from any ds role (status
greens/reds, `--panel-3`, radii, dracula, shadow) are kept as literals. So the
merge is **pixel-identical** — it unifies the token SOURCE (one file, no per-page
fork = the original reason tokens.css existed) WITHOUT recoloring the
already-shipped main-app chrome, which a P8-era global recolor would risk. The
full ink-&-amber recolor of the not-yet-rebuilt main-app chrome happens when
those surfaces are rebuilt (P7) or in the P9/P10 polish, referencing `--ds-*`
directly; the aliases are the bridge until then. Both pages keep their existing
return link to `index.html` as the path back into the app.
Rationale: completes P8 / VISION "from → to" row 4 (per-page hand-rolled CSS +
duplicated components → one design system used by all pages). Value-exact merge
keeps every prior slice independently green (no main-app regression) while still
retiring the second token file.
Alternatives considered: aliasing legacy names to ds roles even where values
differ (rejected: would shift the main app's status greens/reds mid-journey — a
broad, silent regression for a phase whose job is the two standalone pages);
rewriting both pages' inline styles fully onto `--ds-*` with a global recolor
(deferred to P7/P9 — bigger regression surface, not P8's job).
Reversible? Yes — the alias block + the pages' link swaps revert cleanly; git
restores the old `tokens.css` and hand-rolled `.opt`/`.cta`/`.modal` rules.

## D11 · Settings = one grouped ds sheet (bottom on mobile, centered panel on desktop); legacy dropdown + desktop topbar icon strip retire  (2026-07-10 · iter 11)
Decision: The Settings destination is a ds-sheet (`js/app/21-settings.js`
`openSettings` → `#settings-sheet`, a `.ds-scrim`/`.ds-sheet` overlay identical
in presentation to the Practice launcher: bottom sheet ≤639px, centered panel
≥640px). It groups **Display** (text size M/L/XL segmented, ADHD reading mode,
Pace bar) · **Feedback** (Haptics) · **Interview rituals** (Clarify-first,
Hot-seat, Time calibration) · **Data & sync** (Cross-device sync status →
existing sync modal, Back up, Restore, Reset [danger, own confirm guards it]) ·
**Install & offline** (Install, Offline pack — both self-gate on capability) ·
**Help** (Keyboard shortcuts). Every control synth-clicks the SAME hidden
sidebar `<id>-btn` the retired dropdown drove (D05 contract) → zero new
`saveProgress` field, zero sync-registry change; the sheet re-renders after each
flip to reflect the switch. Entry points all resolve here: `#topbar-settings`
(rewired off the legacy dropdown → `openSettings`), the rail/bar Settings item
(synth-clicks it), the palette, and `#/m/settings` + every toggle slug
(`#/m/clarify-ritual`, `/haptic`, `/reset`, `/backup`, `/offline-pack`, …) via
`MODE_ROUTE_SURFACE` — a routed toggle now OPENS the sheet instead of silently
flipping (nav-audit P2-5). Retired: the top-right `#topbar-dropdown` for
settings (nav-audit measured 1,199px from the rail trigger, over the lesson,
emoji rows, no close), and — at ≥768px — the redundant topbar 🔍/❓/⚙ icon
strip (the rail already carries Search + Settings 40px away; help folds into
the sheet's Keyboard-shortcuts row + the `?` key). The three buttons STAY in the
DOM as synthetic-click targets (D05); mobile keeps the ⚙/🔍/❓ strip (nav-audit
P2-6b — the bar has no settings slot yet).
Rationale: completes P6 / VISION "from → to" row 2 (Settings smeared across
standalone buttons → one grouped surface). Settings is a transient "pop-in,
toggle, pop-out" panel, not a dwell-in destination — a sheet (which preserves
the lesson underneath and ships a visible ≥44px close) fits it better than a
full page swap, and matching the Practice launcher's presentation keeps the two
nav-reached panels consistent (PRINCIPLES #1 one-focus, #6 one-system).
Alternatives considered: a full ds page in `#lesson-shell` like Progress
(rejected: destroys lesson context for a transient adjust, and needs a bespoke
back affordance the sheet gets for free); a rail-anchored desktop panel
(rejected: centered-modal consistency with the already-shipped Practice launcher
won — both are nav-reached pop-in panels and should read identically); rebuilding
the sync auth modal on ds now (deferred to P8/P9 — the Data & sync row surfaces
status + opens the existing modal, no auth-path risk in P6).
Reversible? Yes — revert restores the dropdown wiring (`#topbar-settings` back
into `initTopbarDropdowns` hoverTriggers) + the desktop `display:none` on the
icon strip; the hidden buttons + handlers never left.

## D10 · Browse owns the power filters; the off-canvas drawer retires  (2026-07-10 · iter 10)
Decision: The drawer's power tools become first-class ds controls on the
Browse page — one "Filters" disclosure (persisted via the existing
`tagFilterOpen`) holding three view toggles (**Plan view** with its
All/Syntax/Patterns/Applied scope chips · **Hide mastered** · **Needs work**,
the 🛠 Repair filter renamed to say what it means) + the four tag-facet
groups + the **study-plan switcher row** (was the drawer's "Plan:" chip; same
`openPathModal`) + a Clear-all. All filters read/write the SAME persisted
state fields the drawer used (starterPath/starterPathTrack, hideMastered,
repairFilter, tagFilter/tagFilterOpen) — nothing resets. The off-canvas
drawer itself RETIRES (never renders; `display:none` in css/06-ds-nav.css):
Browse's "All filters" row is gone, `#hamburger` redirects any residual
synthetic click to Browse, and `/` = Browse-search on the page / palette
everywhere else. The aside STAYS in the DOM — its hidden buttons are
synthetic-click targets for the palette/launcher/settings (D05), and
renderSidebar keeps painting into it harmlessly. Retired with it: the
sidebar header (progress bar → Progress page), the drawer search input
(Browse search + palette), and the session-heatstrip STRIP (its facts-only
summary already lives in Progress "Today" per D09; the heatstrip modal DOM
stays as dead fallback). One deliberate widening: **Needs work spans all
tracks** (the drawer scoped repair to the active surface — an invisible
scoping the page-level view drops; strictly more reachable). Row attention
chips derive from the repair-index rank (overdue > due > weak > reveal) in
ds status colors, replacing the drawer's emoji icons (D07).
Rationale: completes P4 (VISION "from → to" row 1 — Browse as THE
first-class find-a-lesson surface); kills the last legacy chrome the rail
flow leaned on; J5 ≤2 taps preserved with fewer surfaces to understand.
Alternatives considered: keeping the drawer as an "advanced" fallback
(rejected: two homes for the same filters = drift + a second mental model);
persisting Browse's search query like the drawer's state.searchQuery
(rejected: a stale query is a "where did my lessons go?" trap — fresh Browse
starts clean).
Reversible? Yes — the retirement is 3 display:none rules + the Browse
part-3 render block; a revert restores the drawer wholesale (its DOM and
handlers never left).

## D09 · Progress = one ds surface; long-tail stats behind disclosure; At-Risk modal chrome retires  (2026-07-10 · iter 9)
Decision: The nav's Progress destination is the new ds `.progress-page`
(js/app/20-progress.js): Today snapshot → Activity → **Fix first** → Mastery,
with the ~10 lifetime-stat tiles the legacy Dashboard always showed (drill
accuracies, self-rescue, miss tags, half-life, section retention, calibration,
time invested, mock bests) moved behind ONE "More insights" `<details>`
(PRINCIPLES #1/#5 — the glanceable arc stays under two screens; the long tail
is available, not shouting). Three absorption calls: (a) the standalone
**At-Risk modal's chrome retires** — `#at-risk-btn` and `#/m/at-risk` now open
Progress focused on Fix first, which renders the same ranked rows (7) with the
same chips + tap-to-drill (modal DOM + openAtRisk stay in index.html/14-init
as unused fallback, D05-style); (b) **Resurrect and Reveal-Replay keep their
one-tap direct-jump buttons** — Progress adds action rows that synthetically
click them, so the queues finally have a visible home without slowing the
autopilot path; (c) the **session heatstrip's facts-only summary** joins the
Today section (the sidebar strip itself dies with the drawer in P4 part 3).
`openDashboard` delegates to `openProgress`; the legacy renderers remain as
the delegation fallback until their probes retire. Charts follow the dataviz
method: status colors reserved (good=solved / warn=miss, CVD-validated),
one-hue sequential heatmap ramp added as `--ds-viz-*` tokens.
Rationale: VISION "from → to" row 3 (one coherent Progress surface); PROFILE
"progress at a glance" without a menu maze; zero capability retired.
Alternatives considered: rewriting the legacy renderers in place (rejected:
keeps the kitchen-sink IA and legacy styling); dropping the long-tail tiles
(rejected: capability retirement without usage evidence).
Reversible? Yes — one-line delegation in openDashboard + the at-risk-btn
handler; revert restores the legacy Dashboard wholesale.

## D08 · Desktop chrome = ds rail; permanent sidebar retires to a drawer  (2026-07-10 · iter 8)
Decision: At ≥768px the ds rail (Today / Browse / Practice / Progress +
Search ⌘K / Settings aux items at its foot) is the primary navigation. The
topbar dropdown menus (Practice/Drills/Train/Review) and the Dashboard link
retire (display:none — DOM + handlers stay per D05); the permanent 320px
sidebar becomes an off-canvas drawer at EVERY viewport (opened via Browse's
"All filters"; holds Plan View / Hide Mastered / Repair / facets until P4
part 3 migrates them). Breakpoints unify at 768px (the interim 900px rail
threshold is gone). Two deliberate retentions: (a) the topbar keeps its
wordmark / Problems⇄Reference toggle / Plan / System Design link / icon
strip — System Design has no rail slot and the icon strip's fate is P6's
call; (b) `/` now falls back to the command palette whenever the drawer is
closed (the sidebar search is off-canvas everywhere), and System Design
gained a palette entry (it was UNREACHABLE on mobile before — net
capability gain).
Rationale: completes D01's adaptive nav; desktop gets the same calm 4-
destination model as the phone instead of a topbar of dropdowns (PRINCIPLES
#5 progressive disclosure; VISION "from → to" row 1).
Alternatives considered: keeping the permanent sidebar next to the rail
(rejected: two competing lesson-list surfaces, Browse page already owns
that job); hiding the topbar icon strip in favor of rail-only affordances
(rejected for now: the settings dropdown anchors to the topbar ⚙, and help
would lose its only pointer affordance — revisit in P6).
Reversible? Yes — css/06-ds-nav.css desktop block + the ds/components.css
breakpoint value; a revert restores the permanent sidebar wholesale.

## D07 · Icon language = stroke line-icons; no emoji in chrome  (2026-07-10 · iter 6, user decision)
Decision: The user rejected emoji as UI iconography ("the icons don't look
professional enough — they look silly"). All *chrome* — nav, launcher rows,
topbar controls, page headers, stat/badge accents — uses a single stroke
line-icon set (`ds/icons.js`: 24×24, stroke=currentColor, fill=none, width
1.9, round caps — the language the bottom nav already used). Emoji remains
acceptable ONLY inside authored lesson content and celebratory moments (e.g.
a pass toast), never as an affordance icon.
Rationale: consistency + restraint (PRINCIPLES #6, quality bar "would this
pass in Linear/Things?"); emoji renders differently per platform and reads
as placeholder design.
Rollout: new surfaces (launcher, Today home, topbar) immediately; legacy
surfaces (sidebar buttons, palette rows, old dropdowns) convert as their
phases land (P4/P5) since they retire or migrate anyway.
Reversible? Yes — dsIcon() call sites; emoji strings still live on the hidden
buttons.

## D06 · Global retheme NOW — visible transformation before structural rebuilds  (2026-07-10 · iter 3, user decision)
Decision: Reverse the D04 default of "new look arrives only as each surface is
structurally rebuilt." The user reviewed iter-2 output ("it looks like the same
design") and chose **Global retheme now**: map the entire legacy palette
(Tailwind slate/blue ramps, legacy tokens.css, hardcoded hexes in css/ +
index.html + js/app inline styles) onto the Ink & Amber roles immediately, so
every screen adopts the new visual language within 1–2 iterations. Structural
rebuilds (P2 home, P3 launcher, P4 browse, P5 progress, P7 drill screens)
continue on top; token purity still arrives with those rebuilds.
Rationale: the staged plan delivered no perceivable transformation after two
iterations; the user wants the design to LOOK new now, accepting the broader
regression surface in exchange (mitigated by the probe suite + screenshots).
Mechanism: Tailwind Play-CDN config palette remap (slate→ink, blue/sky→amber,
status ramps tuned to ds values) + legacy tokens.css value swap + hex sweep in
css/*.css, index.html inline styles, js/app template strings + targeted
contrast fixes (white-on-amber → accent-ink).
Reversible? Yes — palette maps and hex sweeps are pure value changes; git
revert restores the blue/slate look wholesale.

## D05 · P0 inventory pass — zero capability retirements; topbar chrome replaced  (2026-07-10 · iter 1)
Decision: The full ~60-mode inventory verdict pass (see `INVENTORY.md`) retires
**no capability**. The only RETIRE is the topbar-of-dropdowns *chrome* itself —
its contents all remap: home/next-rep signals → **Today**; drills + train modes
→ **Practice** launcher; insight/repair surfaces → **Progress**; lesson list,
filters, mechanics, cheatsheet + cram references → **Browse**; toggles
(rituals, display, haptics, install/offline, data) → **Settings**; `lucky`,
`shuffle`, `ai-coach` → DEMOTE (palette/launcher long tail only).
Rationale: PROFILE user needs fewer, calmer entry points, not fewer
capabilities. Every mode stays reachable via new IA + `#/m/<mode>` + palette
(the reachability contract), so nothing the user drilled with disappears.
Alternatives considered: retiring low-value niche drills outright (rejected for
P0 — no usage data to justify; can revisit per-mode later with evidence).
Reversible? Yes — verdicts are a plan; nothing is deleted until P1+ slices land,
and each slice re-verifies reachability before commit.

## D03 · Visual direction = "Ink & Amber" (minimal)  (2026-07-10 · iter 0)
Decision: Mood **C** from the Home mockups — near-monochrome ink neutrals
(`#0e0f12` base), a single confident **warm amber** accent (`#f5b62b`), heavier
sans display type, maximal restraint. Status colors reserved strictly for status.
Rationale: the most austere/focused of the three — serious, calm, zero noise;
best fit for an ADHD-prone professional doing minutes-long reps. Amber accent is
a token (hue trivially tunable later).
Alternatives considered: A · Midnight Cyan (rejected: safest but least
distinctive); B · Warm Indigo editorial (close 2nd; serif elegance, but C's
restraint won for focus).
Reversible? Yes — palette lives in `ds/tokens.css`; hue/warmth are token flips.

## D04 · Design system ships as an isolated `ds/` layer  (2026-07-10 · iter 0)
Decision: The redesign's tokens + components live in a new `ds/` layer
(`ds/tokens.css`, `ds/components.css`, `ds/gallery.html`) — *additive*, not a
mutation of the legacy `tokens.css`. Existing pages keep their current styles
until intentionally migrated (P8). Legacy `tokens.css` is retired/merged at the
end.
Rationale: prevents a half-migrated live restyle (changing legacy `--accent` to
amber would instantly recolor diagnostic.html + system-design.html mid-redesign).
Keeps every slice independently green and reversible.
Reversible? Yes — `ds/` can be deleted without touching shipped pages.

## D01 · Primary navigation model = adaptive rail ↔ bottom bar  (2026-07-10 · iter 0)
Decision: **Adaptive navigation** — a bottom tab bar on mobile (thumb-first) that
becomes a left rail on desktop. Four destinations: **Today · Browse · Practice ·
Progress**; Settings via a profile/gear; the ~60-mode long tail behind the
Practice launcher + command palette.
Rationale: serves the 80%-phone, ADHD, one-tap-to-drill user (bottom bar =
thumb-native, always-visible orientation, caps persistent chrome at ~4) while
giving desktop a first-class rail. Maps today's 4 dropdowns + 60 modes onto a
coherent, low-overwhelm structure; every job ≤2 taps.
Alternatives considered: pure bottom bar (rejected: weaker desktop); hub-and-spoke
no-nav (rejected: too much round-tripping for the app's breadth — Browse/Progress/
Settings friction).
Reversible? Yes — nav shell is P1; swappable before deeper screens depend on it.

## D02 · Theming = dark-first, light-ready tokens  (2026-07-10 · iter 0)
Decision: Ship one polished **dark** theme for v1; structure `tokens.css`
semantically (surface / on-surface / accent / status roles) so a **light** theme
is an additive flip in P9/P10, not a rewrite.
Rationale: app is already dark, dev audience skews dark-preference, and dual
themes tax every redesign slice. Nail one; keep light cheap to add. The real
light-mode win (outdoor phone legibility) is preserved as a future flip.
Alternatives considered: ship both now (rejected: doubles design/QA, slows the
loop); dark-only forever (rejected: forecloses outdoor legibility).
Reversible? Yes — semantic tokens make light additive.
