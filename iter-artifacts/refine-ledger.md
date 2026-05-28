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
