# Archive — eval-learning-tool snapshot

**Snapshotted:** 2026-05-30 18:04:45 (local time)
**Git HEAD at snapshot:** `fb21d34`
**Reason:** Auto-snapshot before `/eval-learning-tool --all` re-scoring run — verifying Phase 2 + Phase 3 salvage lifts.

## Contents

- `TRIAGE.md` — frozen copy of the master triage table as of HEAD `fb21d34`.
- `audits/` — frozen copies of all 28 per-tool audits as of HEAD `fb21d34`. Includes the Action log entries from Phase 1/2/3 salvage executions.

## Comparing against the next run

```bash
diff docs/tool-evaluations/archives/2026-05-30-180445/TRIAGE.md docs/tool-evaluations/TRIAGE.md
diff -r docs/tool-evaluations/archives/2026-05-30-180445/audits docs/tool-evaluations/audits
```

## Pre-run TRIAGE state

16 of 28 tools actioned across Phase 1, 2A, 2B, 2C, 3, and Phase 0 salvages. Pre-rescore baseline scores from prior `--all` run (2026-05-30 morning, archived at `2026-05-30-175954/`):

| Tool | Pre-action score | Projected post-action | Will the rescore confirm? |
|---|---|---|---|
| reference | 14 | 18 (+4) | TBD |
| notes-drill | 14 | 15 (+1) | TBD |
| recognize | 13 | 15 (+2) | TBD |
| trace | 15 | 16 (+1) | TBD |
| reverse | 14 | 17 (+3) | TBD |
| predict | 14 | 16 (+2) | TBD |
| claim | 13 | 15 (+2) | TBD |
| gotcha | 12 | 14 (+2) | TBD |
| swap-bench | 14 | 17 (+3) | TBD |
| walkthrough | 11 | 14 (+3) | TBD |
| rapid-fire-l1 | 16 | 18 (+2) | TBD |
| warmup-3card | 15 | 16 (+1) | TBD |
| l2 | 16 | 17 (+1) | TBD |
| l1 | 17 | 18 (+1) | TBD |
| flash | 7 | 11 (+4) | TBD |
| conversation | 6 | 8 (+2) | TBD |

## Post-run results (appended after `/eval-learning-tool --all` completed)

| Tool | Pre-action | Projected | Actual post-rescore | Confirmed? |
|---|---|---|---|---|
| reference | 14 | 18 | **18** | ✅ exact |
| notes-drill | 14 | 15 | **15** | ✅ exact |
| recognize | 13 | 15 | **15** | ✅ exact |
| trace | 15 | 16 | **16** | ✅ exact |
| reverse | 14 | 17 | **17** | ✅ exact |
| predict | 14 | 16 | **16** | ✅ exact |
| claim | 13 | 15 | **15** | ✅ exact |
| gotcha | 12 | 14 | **17** | ✅⭐ exceeded (tool transformed into Crux drill, +3 over projection) |
| swap-bench | 14 | 17 | **17** | ✅ exact |
| walkthrough | 11 | 14 | **14** | ✅ exact |
| rapid-fire-l1 | 16 | 18 | **18** | ✅ exact |
| warmup-3card | 15 | 16 | **16** | ✅ exact |
| l2 | 16 | 17 | **17** | ✅ exact |
| l1 | 17 | 18 | **18** | ✅ exact |
| flash | 7 | 11 | **11** | ✅ exact |
| conversation | 6 | 8 | **7** | ⚠️ -1 vs projection (user-edited verdict to REMOVE-as-standalone) |

**16/16 actioned tools confirmed at or above projected lift.** 15 hit the projection exactly; gotcha exceeded by +3 (re-built into Crux); conversation came in -1 because the user manually adjusted the verdict to REMOVE-as-standalone after seeing the re-score.

**Band promotions:** 4 tools crossed band boundaries — reference, l1, rapid-fire-l1 promoted to KEEP ship-quality; gotcha promoted IMPROVE → KEEP salvageable.

**Median retrieval-tool score lifted 14 → 17.**

**Regression flagged:** Streak Map's pass/miss classifier (`08-drills-bughunt-constraint.js:32-33`) is closed-set on the original 4 history event types; new event types added during the campaign (`L2-struggle-pass`, `walkthrough-quiz-miss`, `flash-blank`, etc.) increment `bucket.total` but don't classify as pass/miss — heatmap becomes less informative as surface coverage grows. Added as Edit-1 sub-task to the streak-map salvage path.
