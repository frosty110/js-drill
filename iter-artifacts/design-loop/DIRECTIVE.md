# LOOP DIRECTIVE — Radical UX Redesign → 5-Star, World-Class

**Run as:** `/loop 20m <this file>` (or paste its contents). Each fire is one
iteration. Your only memory across iterations is this directory — read the
context files first, update the state files last.

## Mission (immutable — see `VISION.md`)
Transform JS Drill into a **world-class, elegant, 5-star, mobile-first**
experience — Linear/Things/Oura/Duolingo-tier craft — for the user in
`PROFILE.md`. The current ~60-modes-across-dropdowns sprawl is what you
**replace**, not preserve.

## Read first, every iteration
`PROFILE.md` → `PERSONAS.md` → `PRINCIPLES.md` → `JOURNEYS.md` → `VISION.md` →
then `STATE.md` + `ROADMAP.md` + `INVENTORY.md` + `DECISIONS.md`.

## Per-iteration algorithm
0. **Bootstrap (only if P0 not started):**
   a. Capture *before* screenshots of every major surface @390px + desktop (`browser-test`) → `shots/00-before/`.
   b. Finalize `VISION.md`; generate **2–3 nav/IA concepts**, score each on `refine-rubric`, recommend one.
   c. **`AskUserQuestion`** to lock the primary nav model + visual direction (+ light/dark). Record in `DECISIONS.md`.
   d. Fill `INVENTORY.md` verdicts. Seed is done. Then **stop** — that's the iteration.
1. **Orient.** Read the context + state files. Pick the **single highest-value next slice** from `ROADMAP.md` (design system → shell → core loop → rest → polish). Never build a screen before its design-system parts exist.
2. **Build beautifully.** Implement it fully, from `tokens.css` + `components.css` only. No one-off styles, no arbitrary values, no hardcoded colors. Every pixel intentional (`PRINCIPLES.md` quality bar).
3. **Prove it.**
   - `node tools/validate-data.js` green.
   - `browser-test` @390px + desktop: after-screenshots, **zero** console errors, no horizontal scroll, ≥44px targets.
   - Score the touched surface on `refine-rubric` — it must **improve** the targeted dimension(s), not merely "not regress."
   - Spawn a **contrarian reviewer sub-agent** that blocks only if the change hurts the PROFILE user or cheapens the craft. Address blocks before committing.
   - Run the `ui-consistency` skill's checklist (tokens/components/storage).
4. **Land it.** Commit per the repo convention (`[product/ux]` + `## Product impact`). One coherent slice, independently green and reversible.
5. **Record.** Update `STATE.md` (status, last/next slice, learnings, iteration-log line) and `ROADMAP.md` (statuses). Append to `DECISIONS.md` if a call was made. Save before/after to `shots/`.

## Hard rules
- **Preserve capability, not layout.** Everything stays reachable via the new IA + `#/m/<mode>` + palette. Redundant entry points may MERGE/DEMOTE; dead modes may RETIRE — logged in `DECISIONS.md`. Verify reachability before committing.
- **No build step.** Vanilla JS + CDN + `data/`. `tokens.css`/`components.css` single style sources. `js/storage.js` storage layer — schema change → `__v` bump + migration; never lose progress. Deep-links + keyboard preserved.
- **Independently green.** No half-migrated state at a commit boundary. Each iteration ships something real and reversible.
- **When a call is product-shaping** (home layout, nav model, what retires), **`AskUserQuestion`** — don't guess.
- **`PROFILE.md` is law.** If a slice doesn't get the Rusty Returner drilling faster with less thinking, it's decoration — cut or demote it.

## Definition of done (may declare completion)
All roadmap phases shipped · `refine-rubric` materially up on **all 7**
dimensions vs the P0 baseline · every capability preserved · all pages on one
design system · first-time *and* returning users each have an obviously 5-star
path · validators green · no regressions · `shots/` shows the transformation.
When no remaining slice raises the bar, **stop and report done** — don't
manufacture busywork.

**Ambition is the mandate.** Don't anchor on today's screens. Design the
experience this user deserves and carry every needed capability into it —
elegantly.
