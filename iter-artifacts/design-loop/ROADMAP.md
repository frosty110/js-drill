# Roadmap — Phased Slices (living)

Phases are ordered by dependency: **design system → shell → core loop → the rest
→ polish**. Each bullet is roughly one iteration-sized, independently-green,
shippable slice. Status: ☐ todo · ◐ in progress · ☑ done · ✗ dropped (log why in
`DECISIONS.md`). Reprioritize freely as you learn; keep the ordering honest.

> **Rule:** never build a screen before the design-system parts it needs exist.
> Never leave a half-migrated state at a commit boundary.

## P0 · Foundation & alignment  *(do first; some slices gate everything)*
- ☐ Capture **before** screenshots of every major surface @390px + desktop → `shots/00-before/`
- ☐ Ratify `VISION.md` + lock the **primary nav model** & **visual direction** (AskUserQuestion) → `DECISIONS.md`
- ☐ Fill `INVENTORY.md` — every mode/surface with a keep/merge/demote/retire verdict
- ☐ Design tokens pass: extend `tokens.css` (spacing scale, type scale, elevation, motion vars); remove ad-hoc values
- ☐ Build `components.css` v1: buttons, cards, options, tags, chips, sheets, modals, nav bar, progress — on tokens
- ☐ Iconography + a11y baseline (focus ring, reduced-motion scaffold)

## P1 · Navigation shell
- ☐ Thumb-first primary nav (bottom tab bar mobile / adaptive desktop) replacing the topbar-of-dropdowns
- ☐ Command palette redesigned as the long-tail power path (reaches any `#/m/<mode>`)
- ☐ Route/keyboard parity audit (every deep-link + shortcut still resolves)

## P2 · Home / "next rep"
- ☐ Landing = one-tap next rep (due > weak > path, diagnostic-biased) + ambient progress
- ☐ First-run experience (designed, gets to a first rep fast)

## P3 · Practice launcher
- ☐ One contextual launcher replacing Practice/Drills/Train/Review menus
- ☐ Long-tail modes grouped & progressively disclosed here + palette

## P4 · Browse
- ☐ Lessons/tracks/faceted-filter/search as a first-class surface (not a cramped drawer)

## P5 · Progress
- ☐ Unify Dashboard / Stats / Streak / At-Risk / Resurrect into one coherent surface

## P6 · Settings
- ☐ One grouped Settings panel (Display · Feedback & haptics · Data & sync · Install & offline)

## P7 · The drill screens (core loop craft)
- ☐ L1 redesign · ☐ L2 redesign · ☐ L3 redesign · ☐ Reference/reveal · ☐ Mock · ☐ Walkthrough/Conversation

## P8 · Unify the family
- ☐ Migrate `system-design.html` onto `components.css` (kill hardcoded colors)
- ☐ Migrate `diagnostic.html` onto `components.css`

## P9 · Delight & states
- ☐ Motion/microinteractions (grade, streak, mastery) · ☐ empty/loading/error/offline states · ☐ light+dark

## P10 · A11y, perf & regression sweep
- ☐ Contrast/focus-order/reduced-motion audit · ☐ load/perf pass · ☐ full capability-reachability sweep · ☐ final before/after rubric report
