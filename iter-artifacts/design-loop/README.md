# Design Loop Workspace

This directory is the working memory and control surface for the **UX redesign
loop** — a recurring autonomous build (`/loop 20m <DIRECTIVE.md>`) that
transforms JS Drill into a world-class, 5-star, mobile-first experience.

The loop has no memory between iterations *except these files*. Every iteration
**reads the context files first** and **updates the state files last**, so
successive runs converge on the vision instead of thrashing.

## Files

| File | Role | Mutability |
|---|---|---|
| `DIRECTIVE.md` | The standing loop prompt — the per-iteration algorithm. | Stable |
| `VISION.md` | North star + design language. The bar we build to. | **Immutable** once ratified |
| `PERSONAS.md` | Who we design for (from `PROFILE.md`) + situational personas. | Rarely (only if PROFILE changes) |
| `PRINCIPLES.md` | Design principles, quality bar, do/don't, rubric mapping. | Rarely |
| `JOURNEYS.md` | The jobs-to-be-done / journeys the design must nail. | Rarely |
| `INVENTORY.md` | Every existing mode/surface + keep/merge/demote/retire verdict. | Living (Phase 0 fills, later iters update) |
| `ROADMAP.md` | Phased, iter-sized slices with status. | Living |
| `STATE.md` | Current phase · last slice · next slice · learnings. | **Every iteration** |
| `DECISIONS.md` | Log of product-shaping decisions + rationale (anti-drift). | Append-only |
| `shots/` | Before/after screenshots — the visual changelog. | Append per slice |

## Lifecycle each iteration
1. Read `PROFILE.md`, `PERSONAS.md`, `PRINCIPLES.md`, `JOURNEYS.md`, `VISION.md`.
2. Read `STATE.md` + `ROADMAP.md`; pick the single highest-value next slice.
3. Build it (design-system parts only), verify (validator + browser-test + rubric + contrarian review), commit.
4. Update `STATE.md` + `ROADMAP.md`; append to `DECISIONS.md` if a call was made; save `shots/`.

## Ground truth (do not drift from these)
- `PROFILE.md` — the target user. Law.
- `tokens.css` + (to-be-built) `components.css` — the single style sources.
- `js/storage.js` — the storage layer. Schema changes need a `__v` bump + migration.
- `.claude/skills/refine-rubric`, `ui-consistency`, `browser-test` — the loop's instruments.
