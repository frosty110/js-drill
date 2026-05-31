# 🛠 Repair filter — Learning-effectiveness audit (reflection-kind)

**Total: 6/6** (reflection-kind: only Closed-loop + Transfer-context scored)
**Verdict: KEEP**
**Anchor file:** `js/app/09-stats-cheatsheet-mock.js:1091`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | N/A | (reflection tool) |
| Encoding strength | N/A | (reflection tool) |
| Spacing | N/A | (reflection tool) |
| Interleaving | N/A | (reflection tool) |
| Feedback quality | N/A | (reflection tool) |
| Transfer-context match | 3/3 | `js/app/10-render-sidebar-lesson.js:289` — when active, the sidebar lesson list is replaced with the union of needs-work lessons, each tagged inline with the load-bearing icon (💀 / 🕒 / ⚠️ / 🃏 — `js/app/10-render-sidebar-lesson.js:371-378`). User taps any lesson and is in the right retrieval surface; no menu wandering. Directly answers "what should I drill next to be interview-ready?" with diagnostic specificity. Auto-disables Hide Mastered to avoid filter conflict (`js/app/10-render-sidebar-lesson.js:177-178`). |
| Closed-loop signal use | 3/3 | `js/app/09-stats-cheatsheet-mock.js:1091-1103` — composes FOUR signal sources into a single ranked Map: `resurrectIds()` (rank 0, overdue), `dueReviewIds()` (rank 1, due), `state.weakness` (rank 2, L1-miss), `state.revealed` (rank 3, mastered-with-reveal). Ranking is overdue→due→weak→revealed — urgency order. Live count painted rose on the chip when work exists at rest (`js/app/10-render-sidebar-lesson.js:193`), so the user sees the decay signal without toggling. This is the canonical join of all reflection signals into one actionable surface. |

## Strengths
- Union-of-all-signals, single chip — collapses what would otherwise require visiting four separate badges (Review / Weak / Resurrect / Reveal-Replay) (`js/app/09-stats-cheatsheet-mock.js:1088-1102` design comment).
- Inline per-lesson icons preserve *why* each lesson is on the list — the rusty engineer sees "this one is overdue, that one I revealed" without further tap (`js/app/10-render-sidebar-lesson.js:371-378`).
- Resting-state diagnostic — rose-painted count when filter is OFF announces work-to-do without forcing engagement (`js/app/10-render-sidebar-lesson.js:188-194` design comment).

## Weaknesses
- Excludes Bridge candidates by design (`js/app/09-stats-cheatsheet-mock.js:1090` comment: "Bridge is an opportunity signal") — defensible scoping but means cross-track transfer gaps aren't in the Repair view. User has to remember the separate 🧠 Bridge button.

## Action log
- 2026-05-30 Scored at 6/6 by `/eval-learning-tool --all`.
- 2026-05-30 Re-scored at 6/6 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
