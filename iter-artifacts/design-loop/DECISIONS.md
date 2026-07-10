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
