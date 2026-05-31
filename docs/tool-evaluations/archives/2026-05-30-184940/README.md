# Archive — eval-learning-tool snapshot

**Snapshotted:** 2026-05-30 18:49:40 (local time)
**Git HEAD at snapshot:** `64d8b1c`
**Reason:** Auto-snapshot before second `/eval-learning-tool --all` rescore — verifying the 4 Phase 4 + Phase 5-promote lifts shipped after the first rescore (commits b08f9b6 Reverse, 282a61a L2, dd85851 Streak Map, 8246385 Mistake Tagging).

## Contents

- `TRIAGE.md` — frozen copy of the master triage as of HEAD `64d8b1c` (with the projected scores marked "(pending rescore)" for the 4 actioned tools).
- `audits/` — frozen copies of all 28 per-tool audits as of HEAD `64d8b1c`. Includes the Action log entries from BOTH Phase 1-3 salvages AND the Phase 4/5-promote commits.

## Comparing against the next run

```bash
diff docs/tool-evaluations/archives/2026-05-30-184940/TRIAGE.md docs/tool-evaluations/TRIAGE.md
diff -r docs/tool-evaluations/archives/2026-05-30-184940/audits docs/tool-evaluations/audits
```

## Pre-run projection table (to verify after rescore)

These are the 4 tools that were promoted after the first rescore (180445) and have "(pending rescore)" markers in this snapshot's TRIAGE.md. The fresh rescore should confirm or correct them:

| Tool | Pre-Phase-4/5 score | Projected | Will the rescore confirm? |
|---|---|---|---|
| Reverse | 17 | 19 (+2: Feedback 2→3 + Spacing 2→3) | TBD |
| L2 | 17 | 18 (+1: Active recall 2→3) | TBD |
| Streak Map | 3/6 | 6/6 (+3: Transfer 1→3 + Closed-loop 2→3) | TBD |
| Mistake Tagging | 4/6 | 6/6 (+2: Closed-loop 2→3 + Transfer 2→3) | TBD |

Other tools should stay stable since this run didn't target them.

## Post-run results (appended after `/eval-learning-tool --all` completed)

**All 4 promotions confirmed at exact projection.** No regressions on the other 24 tools.

| Tool | Pre-Phase-4/5 | Projected | Actual post-rescore | Confirmed? |
|---|---|---|---|---|
| Reverse | 17 | 19 (+2) | **19** | ✅ exact |
| L2 | 17 | 18 (+1) | **18** | ✅ exact |
| Streak Map | 3/6 | 6/6 (+3) | **6/6** | ✅ exact |
| Mistake Tagging | 4/6 | 6/6 (+2) | **6/6** | ✅ exact |

**Band shifts:**
- KEEP, ship-quality retrieval: 5 → **7** (L2, Reverse promoted in)
- KEEP, ship-quality reflection: 8 → **10** (Streak Map, Mistake Tagging promoted in — reflection layer now 9/10 ship-quality, only Mock Replay Reel sits at 5/6 by design)
- TOTAL ship-quality: 13 → **17 of 28 (61%)**
- KEEP, salvageable retrieval: 11 → **9** (L2 + Reverse promoted out)
- IMPROVE band: 3 → **1** (only Flash 11/21 remains — Streak Map + Mistake Tagging promoted out)
- REMOVE band: 0 (Conversation 7 marked REMOVE-as-standalone but tab still served via route)

**Summary line:** Median retrieval-tool score now **17** (up from 14 pre-campaign). Reflection layer 9/10 at ship-quality ceiling.
