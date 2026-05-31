# Archive — eval-learning-tool snapshot

**Snapshotted:** 2026-05-30 17:59:54 (local time)
**Git HEAD at snapshot:** `e92da64`
**Reason:** Pre-rescore baseline — Phase 2 + Phase 3 salvage paths shipped, about to run `/eval-learning-tool --all` to verify projected lifts.

## Contents

- `TRIAGE.md` — frozen copy of the master triage table as of HEAD `e92da64`.
- `audits/` — frozen copies of all 28 per-tool audits as of HEAD `e92da64`. Includes the Action log entries written during Phase 2 + Phase 3 execution.

## Comparing against the next run

After the next `/eval-learning-tool --all` finishes, diff the new live files against this snapshot to see which projected lifts were real:

```bash
diff docs/tool-evaluations/archives/2026-05-30-175954/TRIAGE.md docs/tool-evaluations/TRIAGE.md
diff -r docs/tool-evaluations/archives/2026-05-30-175954/audits docs/tool-evaluations/audits
```

## Status at snapshot

| Phase | Tools actioned | Commits |
|---|---|---|
| Phase 1 (reference) | 1 | `473ad7c` |
| Phase 2A (SR-weighted READ) | 4 | `69ba011`, `02fb7dd`, `047278a`, `d1c27bc` |
| Phase 2B (guarded SR WRITE) | 3 | `99ff288`, `f466c37`, `0c518ea` |
| Phase 2C (per-pair SR) | 1 | `33a69be` |
| Phase 3 (single-tool high-leverage) | 5 | `a01b0a8`, `5c44495`, `61e3d94`, `5a51fe2`, `22e4b81` |
| Phase 0 salvages (flash + conversation) | 2 | `cdfc6f1`, `6c55271` |
| **Total** | **16 / 28** | |

The remaining 12 tools were already at ship-quality (≥18/21 retrieval, or 5-6/6 reflection) and untouched by this campaign.
