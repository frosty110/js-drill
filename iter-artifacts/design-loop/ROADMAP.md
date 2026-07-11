# Roadmap — Phased Slices (living)

Phases are ordered by dependency: **design system → shell → core loop → the rest
→ polish**. Each bullet is roughly one iteration-sized, independently-green,
shippable slice. Status: ☐ todo · ◐ in progress · ☑ done · ✗ dropped (log why in
`DECISIONS.md`). Reprioritize freely as you learn; keep the ordering honest.

> **Rule:** never build a screen before the design-system parts it needs exist.
> Never leave a half-migrated state at a commit boundary.

## P0 · Foundation & alignment  *(do first; some slices gate everything)*
- ☑ Capture **before** screenshots of every major surface @390px + desktop → `shots/00-before/` (35 shots; `tools/cdp/before-shots.js`, reusable for the after-sweep)
- ☑ Ratify VISION + lock nav model (D01), theming (D02), visual direction (D03), isolated `ds/` layer (D04) → `DECISIONS.md`
- ☑ Fill `INVENTORY.md` — every mode/surface with a keep/merge/demote/retire verdict (D05: zero capability retirements; chrome-only replacement)
- ☑ Design tokens pass: `ds/tokens.css` — Ink & Amber semantic roles (light-ready), 8pt spacing, type scale, radii, elevation, motion
- ☑ Build `components.css` v1: `ds/components.css` — buttons, cards, options (+states), chips/tags, stats, fields, progress, list rows, sheet/modal, adaptive nav (bottom bar ↔ rail); verified via `ds/gallery.html`
- ◐ Iconography + a11y baseline (nav icons + focus-visible + reduced-motion done; broader icon set TBD)

## P1 · Navigation shell
- ☑ Thumb-first primary nav — **mobile bottom bar SHIPPED** (≤767px; Today/Browse/Practice/Progress wired to existing surfaces via synthetic click; L3-immersive hide; audio-dock lift) + **desktop rail SHIPPED** (P4b, ≥768px: same 4 destinations + Search ⌘K/Settings aux foot; topbar dropdowns + permanent sidebar retired; breakpoints unified at 768; drawer z-order + aria-current active state both wired). D01 adaptive nav complete.
- ☐ Command palette redesigned as the long-tail power path (reaches any `#/m/<mode>`)
- ☐ Route/keyboard parity audit (every deep-link + shortcut still resolves)

## P2 · Home / "next rep"
- ◐ Landing = one-tap next rep + ambient progress — **Today home SHIPPED** (hero pick due>weak>recent-miss>path, streak chip w/ grace rule, 3 stat tiles, THEN queue, #/m/today-home; matches ratified mock C). Remaining: diagnostic-signal bias in the pick; make home the BOOT default (needs a decision vs J3 resume — ask user); desktop entry (P4 rail).
- ☐ First-run experience (designed, gets to a first rep fast)

## P3 · Practice launcher
- ☑ One contextual launcher replacing Practice/Drills/Train/Review menus — **bottom-sheet launcher SHIPPED** (taxonomy-derived, 4 groups, pick-smart/shuffle actions shared with topbar; #/m/practice-launcher). Desktop topbar menus retire with the P4 rail.
- ☑ Long-tail modes grouped & progressively disclosed here + palette (sheet = grouped browse; ⌘K = search; deferred: insights sub-labels if cram lists grow)

## P4 · Browse
- ☑ Lessons/tracks/faceted-filter/search as a first-class surface — **Browse page SHIPPED** (search + segments + accordion + rows, #/m/browse); **desktop rail SHIPPED** (P4b: topbar menus retired, 768px unified breakpoint); **power filters SHIPPED** (P4c/D10: Plan view + scope chips / Hide mastered / Needs work / tag facets / plan switcher as one ds Filters disclosure; IME-safe in-place search — input never recreated; **off-canvas drawer RETIRED**, `/` = Browse search on-page / palette elsewhere).

## P5 · Progress
- ☑ Unify Dashboard / Stats / Streak / At-Risk / Resurrect into one coherent surface — **Progress page SHIPPED** (js/app/20-progress.js + css/07-ds-progress.css, all-ds: Today snapshot w/ session summary → Activity (7d chips + 14d stacked bars + 60d one-hue heatmap w/ tap-day drill routes) → Fix first (At-Risk rows + Resurrect + Reveal-Replay actions) → Mastery (overall + per-track meters) → More insights `<details>` (drill lifetimes, self-rescue, miss tags, half-life, retention, calibration, time invested, mock bests). openDashboard delegates; at-risk-btn/#/m/at-risk land focused on Fix first. Bonus fix: `#/m/<mode>` boot deep-links no longer clobbered by the async lesson-content re-render.

## P6 · Settings
- ☑ One grouped Settings panel — **ds Settings sheet SHIPPED** (`js/app/21-settings.js` + `css/09-ds-settings.css`, D11): Display (text-size M/L/XL · ADHD mode · pace bar) · Feedback (haptics) · Interview rituals (clarify / hot-seat / calibrate) · Data & sync (sync status→modal · backup · restore · reset[danger]) · Install & offline · Keyboard shortcuts. Bottom sheet ≤639px / centered panel ≥640px; ≥44px close; stroke icons, zero emoji. `#topbar-settings` rewired off the legacy dropdown → `openSettings`; rail/bar + palette + `#/m/settings` + every toggle slug route here (silent-flip bug fixed, nav-audit P2-5). Desktop topbar 🔍/❓/⚙ strip retired (rail carries them). p6-settings 21/21 + p4b-rail/p1-nav-smoke updated, all regression probes green.

## P7 · The drill screens (core loop craft)
- ☐ L1 redesign · ☐ L2 redesign · ☐ L3 redesign · ☐ Reference/reveal · ☐ Mock · ☐ Walkthrough/Conversation

## P8 · Unify the family
- ☐ Migrate `system-design.html` onto `components.css` (kill hardcoded colors)
- ☐ Migrate `diagnostic.html` onto `components.css`

## P9 · Delight & states
- ☐ Motion/microinteractions (grade, streak, mastery) · ☐ empty/loading/error/offline states · ☐ light+dark

## P10 · A11y, perf & regression sweep
- ☐ Contrast/focus-order/reduced-motion audit · ☐ load/perf pass · ☐ full capability-reachability sweep · ☐ final before/after rubric report
