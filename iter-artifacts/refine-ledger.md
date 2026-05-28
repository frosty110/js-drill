# Refine — Iteration Ledger

One row per iteration of `/drill-refine`. Updated by the skill at the end of
Step 6 (shipped) or Step 5 (halted by contrarian).

| Iter | Surface | Change | Rubric (before → after) | Outcome |
|---|---|---|---|---|

## Outcome codes

- `shipped` — change committed, validator + CDP probe green
- `halted` — contrarian blocked; finding kept in artifact; surface NOT re-audited until backlog clears
- `bailed` — Step 0 health check forced abort (e.g., same surface 3× in a row)

## Reading this ledger

Step 0 of the skill scans the last 6 rows. Watch for:
- ≥4 `halted` in last 6 → contrarian is over-strict (will loosen this iter)
- ≥3 same surface in a row → force a different surface this iter

## Cross-ref

- The skill: `.claude/skills/drill-refine/SKILL.md`
- The surfaces: `iter-artifacts/refine-surfaces.md`
- The backlog of queued refinements (one-per-iter throttle overflow): `iter-artifacts/refine-backlog.md` (created on first append)
- The user model: `PROFILE.md` (load-bearing — re-read every iter)
| 1 | diagnostic-results | Add primary "🎯 Drill weakest: <section>" CTA — diagnostic→drilling autopilot bridge | 8/21 → 13/21 (proj.) | shipped |
| 2 | reflect-dashboard | Constrain Stats modal to max-height:90vh + internal overflow-y — Track Balance no longer clipped off-viewport | 9/21 → 13/21 (proj.) | shipped |
| 3 | mechanics | Default to Matrix view when transfer gaps exist — diagnostic-aware view first | 13/21 → 16/21 (proj.) | shipped |
| 4 | mock-interview | Restore + enrich post-mock win line (prior-best delta) — fixes latent detached-feedback bug | 11/21 → 14/21 (proj.) | shipped |
| 5 | today-plan | Stack title + why-tag vertically — fixes mobile clipping of "review due"/"weak spot"/"next on plan" on 80%-phone surface | 7/21 → 11/21 (proj.) | shipped |
| 6 | plan-picker-modal | Add ⭐ RECOMMENDED badge + emerald accent on Starter Plan card in welcome mode — gives first-time ADHD users an obvious default | 8/21 → 11/21 (proj.) | shipped |
| 7 | mock-interview | Inline "🎯 Mock another" CTA on post-win feedback — lowers repeat-mock friction, directly serves "PBs trend down over weeks" metric | 14/21 → 15/21 (proj.) | shipped |
| 8 | — | No clean target: every registry surface either refined this session OR blocked by user's in-flight Font Scale feature WIP (~8 files). Re-refining would cluster; touching WIP files risks collision. Wait for next /loop fire with cleared WIP. | — | bailed |
