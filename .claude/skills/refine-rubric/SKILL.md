---
name: refine-rubric
description: Score one JS drill app surface against the 7-dimension user-fit rubric anchored in PROFILE.md (Autopilot · Decisions · Phone-fit · Time-respect · Diagnostic-aware · Progress-visible · ADHD-fit). Returns a per-dimension score with cited evidence and a suggested target dimension. Invokable standalone (`/refine-rubric <surface-name>` — e.g. `/refine-rubric topbar`) or as Step 3 of `/drill-refine`. This skill IS the metric. PROFILE.md is the law; this rubric is its measurable interpretation.
---

# refine-rubric

The metric for "is this surface the best it can be for our user?" Document of authority.

## North star

PROFILE.md defines WHO. This rubric defines HOW we measure whether a surface serves that who. **If PROFILE.md changes, this rubric must change.** They never diverge.

## When to invoke

- **Standalone (`/refine-rubric <surface>`):** one-off scoring. "How bad is the Today Plan card?" Returns a score + the dimension most worth lifting.
- **Inside `/drill-refine`:** as Step 3, after a screenshot-grounded audit.
- **Pre/post a refinement:** score before + after the change to verify the lift was real.

Don't invoke this for code that isn't a user-facing surface (lesson JSON, validator scripts, build tooling — wrong instrument).

## Input

One surface name. Recognized names live in `iter-artifacts/refine-surfaces.md`. For an ad-hoc surface, give it a one-line description + the primary source files.

## The 7 dimensions

Score each 0–3 with cited evidence. Total /21. Anchor every dimension in a quoted PROFILE.md line — if you can't cite the line, the score isn't measuring what we claim.

### 1. Autopilot (0–3) — anchored in § Study intent

> "Pick a plan, go on autopilot. Surface ONE next action. The app decides which."

| Score | Behavior |
|---|---|
| 3 | One obvious "begin" CTA. User taps it and is immediately drilling. No upfront choice. |
| 2 | One clear default action with ≤1 secondary affordance visible. |
| 1 | 2–3 competing CTAs; user must read to decide. |
| 0 | ≥4 competing actions OR no clear "what do I do" affordance. |

### 2. Decisions (0–3) — anchored in § Cognitive style (ADHD)

> "Limited working memory for parallel decisions; benefits from single-focus surfaces, not menus-of-menus."

Count distinct decisions the user must make before they're drilling. Submenus, modals, plan-pickers, tab-switchers — each is a decision.

| Score | Decisions |
|---|---|
| 3 | 0–1 |
| 2 | 2 |
| 1 | 3–4 |
| 0 | ≥5 |

### 3. Phone-fit (0–3) — anchored in § Usage context (load-bearing)

> "~80% of study time is on a phone. L1 (multiple choice) is the smoothest interaction on mobile."

Test at 375×667 viewport, coarse pointer. Score:

| Score | Behavior |
|---|---|
| 3 | Thumb-only. No horizontal scroll. Tap targets ≥44×44px. No keyboard required. |
| 2 | Thumb-mostly. Maybe one minor zoom/scroll moment. |
| 1 | Workable but awkward — small tap targets, requires precision, or hidden affordances. |
| 0 | Broken on mobile (overflow, unreachable controls, keyboard-only flow). |

### 4. Time-respect (0–3) — anchored in § Cognitive style (limited study time)

> "Sessions are minutes, not hours. Every surface should deliver value in <5 minutes."

Measure from "surface opens" to "first meaningful interaction."

| Score | Time-to-value |
|---|---|
| 3 | <30 sec — open and tap; you're learning. |
| 2 | 30 sec – 2 min — small setup, fast start. |
| 1 | 2–5 min — non-trivial setup or read-before-do. |
| 0 | >5 min OR can't be used in a 5-min window. |

### 5. Diagnostic-aware (0–3) — anchored in § Study intent

> "Use recent diagnostic signal to bias the pick … if the last diagnostic showed complexity-pricing weak, today's autopilot weights complexity-heavy lessons + Big-O drill higher."

Does this surface read the user's signal (diagnostic results, weakness map, miss tags, recent SR fails) and adapt?

| Score | Behavior |
|---|---|
| 3 | Surface visibly bends to recent signal — content order, defaults, callouts shift with the user's actual gaps. |
| 2 | Surface uses some signal (e.g., weakness for SR) but doesn't surface diagnostic explicitly. |
| 1 | Same content order for every user; signal exists in state but isn't used here. |
| 0 | No personalization. Static for every user, every day. |

### 6. Progress-visible (0–3) — anchored in § Study intent

> "Show progress + scores at a glance — without the user having to navigate to find them."

Open the surface. Without navigating, what does the user learn about their progress?

| Score | Behavior |
|---|---|
| 3 | Score + state legible above the fold (mobile). No taps required to see progress. |
| 2 | Progress visible after one tap (an obvious chip or tile expands). |
| 1 | Progress exists in Reflect/Stats but not on this surface; user has to leave to find it. |
| 0 | No progress signal anywhere on or near this surface. |

### 7. ADHD-fit (0–3) — anchored in § Cognitive style (ADHD)

> "A 5-button card stack costs more than a 1-button 'Begin' with overflow tucked behind a `[more ▾]`."

This dimension is the **interaction-shape** counterpart to Decisions (count). ADHD-fit is about parallel cognitive load — how many things compete for attention simultaneously.

| Score | Behavior |
|---|---|
| 3 | Single focus. One visible task at a time. Overflow tucked behind one disclosure. |
| 2 | Primary focus with 1 quiet secondary signal (e.g. a count badge). |
| 1 | Two surfaces compete for attention (e.g., modal-over-modal, primary + persistent banner + sticky bar). |
| 0 | Multiple modals, sticky bars, and competing CTAs all simultaneously demanding attention. |

## Output format

```markdown
# Rubric score — <surface>

**Total: N/21**
**Suggested refine target:** <dimension> (lowest non-3 with highest leverage)

| Dim | Score | Evidence |
|---|---|---|
| Autopilot | X/3 | <file:line or screenshot frame description> |
| Decisions | X/3 | … |
| Phone-fit | X/3 | … |
| Time-respect | X/3 | … |
| Diagnostic-aware | X/3 | … |
| Progress-visible | X/3 | … |
| ADHD-fit | X/3 | … |

## Notes
- 1–3 sentences flagging anything the rubric can't capture (e.g., a specific PROFILE.md line that pulls extra weight for this surface).
```

## How a score becomes an action

- **≤14/21:** refinement candidate. Pass to `/drill-refine`, or queue in `iter-artifacts/refine-backlog.md`.
- **15–17/21:** marginal. Refine only if one dimension scored 0 (a specific painful gap).
- **≥18/21:** leave it. Target something staler.
- **Lowest dimension drives the refine target.** Don't try to lift everything; pick the lowest non-3 with the most user-impact leverage and propose ONE change.

## When to update this rubric

- PROFILE.md changed → mirror the change here within the same iter. The rubric is a *measurable interpretation* of PROFILE.md; drift between them silently invalidates every score.
- A real user complaint surfaces a dimension the rubric doesn't capture → add an 8th. Don't shoehorn into an existing dimension.
- A dimension hasn't moved across 10+ iters → either it's well-served (consider raising the bar) or the rubric is asking the wrong question (consider replacing it). Either way, log the call in the iter's artifact.

## What this rubric is NOT

- **Not a code-quality rubric.** No "maintainability," "test coverage," "type safety." Those are code-review concerns. This rubric measures user fit, period.
- **Not exhaustive.** It captures 7 of the highest-leverage user-fit dimensions, not every possible one. A surface can score 21/21 and still have non-rubric problems (e.g., accessibility for screen readers — important but not in this rubric's frame). The Notes field is the escape hatch.
- **Not a benchmark.** Don't compare scores across surfaces to rank them — they're not commensurable. Topbar at 16 and Today Plan at 16 don't have the same fix difficulty.
