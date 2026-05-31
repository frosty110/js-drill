# 💀 Resurrect Queue — Learning-effectiveness audit (reflection-kind)

**Total: 6/6** (reflection-kind: only Closed-loop + Transfer-context scored)
**Verdict: KEEP**
**Anchor file:** `js/app/04-progress-sr.js:522`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | N/A | (reflection tool) |
| Encoding strength | N/A | (reflection tool) |
| Spacing | N/A | (reflection tool) |
| Interleaving | N/A | (reflection tool) |
| Feedback quality | N/A | (reflection tool) |
| Transfer-context match | 3/3 | `js/app/14-init-core.js:470-475` — tap routes directly into the most-overdue mastered lesson at L2 (coarse-pointer) or L3 (fine), the exact interview-blank-editor retrieval context. Pick is deterministic (sorted by largest `now - dueAt`), so the user does not choose — autopilot per PROFILE § Study intent. |
| Closed-loop signal use | 3/3 | `js/app/04-progress-sr.js:522-534` — composes three signals: `state.reviews[id].dueAt`, `state.reviews[id].interval`, and `lessonOverallStatus(id) === 'mastered'`, filtering to the "long-overdue tail" (`now - dueAt > 2 * interval`). Ranks by decay magnitude. `js/app/09-stats-cheatsheet-mock.js:880-884` auto-hides badge at zero (clean state quiet). Feeds the unified `buildRepairIndex` at rank 0 (highest priority) per `js/app/09-stats-cheatsheet-mock.js:1098` — non-duplicative; this is the *only* signal source for the "overdue" rank in the unified Repair index. |

## Strengths
- Differentiates "due tomorrow" from "due 60 days ago" — closes the measurement gap the plain Review badge papers over (`js/app/04-progress-sr.js:516-521` design comment).
- One-tap routing into the correct recall tier per device (L2 mobile / L3 desktop) — `js/app/14-init-core.js:473-474`.
- Pure derivation, no new schema — composes existing `state.reviews` without persistence overhead (`js/app/04-progress-sr.js:522`).

## Weaknesses
- None at the rubric level. Minor: counts only mastered lessons, so a long-overdue *in-progress* lesson never surfaces here (but the Repair filter would catch it via weakness, so coverage is intact).

## Action log
- 2026-05-30 Scored at 6/6 by `/eval-learning-tool --all`.
- 2026-05-30 Re-scored at 6/6 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
