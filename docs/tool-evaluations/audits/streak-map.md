# 📅 Streak map (60-day heatmap) — Learning-effectiveness audit (reflection-kind)

**Total: 3/6** (reflection-kind: only Closed-loop + Transfer-context scored)
**Verdict: IMPROVE**
**Anchor file:** `js/app/14-init-core.js:947` + `js/app/08-drills-bughunt-constraint.js:1`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | N/A | (reflection tool — does not teach via retrieval) |
| Encoding strength | N/A | (reflection tool) |
| Spacing | N/A | (reflection tool) |
| Interleaving | N/A | (reflection tool) |
| Feedback quality | N/A | (reflection tool) |
| Transfer-context match | 1/3 | `08-drills-bughunt-constraint.js:1-39` buckets `state.history` events into 60 day-cells with pass/miss split; cells answer "did I drill this day?" but NOT "what should I drill next to be interview-ready?" `14-init-core.js:983-985` default tooltip says "X events across Y days" — past-performance only, no next-action signal. The `passes`/`misses` per-day split (`08-drills-bughunt-constraint.js:32-33`) could inform "high-miss day = bad concepts to revisit" but isn't surfaced that way. Side-effect note: new history event types (`L2-struggle-pass`, `walkthrough-quiz-miss`, `flash-blank`, `notes-to-code-pass`) increment `bucket.total` but the pass/miss classifier at `08-drills-bughunt-constraint.js:32-33` only recognises `L1-miss` / `L1-pass` / `L2-pass` / `L3-pass`, so the richer signal silently drops to uncategorised "activity". |
| Closed-loop signal use | 2/3 | Reads one signal source — `state.history` (`08-drills-bughunt-constraint.js:22`). Composes day-level pass vs miss counts (`:32-33`) but doesn't intersect with any other signal (no SR `reviews`, no `weakness`, no `misses` tags). `14-init-core.js:953` comment explicitly admits "Read-only v1 — no day-tap filter (deferred)." No tap-route to lessons drilled that day; cells (`14-init-core.js:987-998`) only swap tooltip text. |

## Strengths
- 5-tier relative color scale (`14-init-core.js:963-973`) adapts to the user's own peak day, avoiding gamification anti-pattern of comparing to a fixed bar.
- Per-cell tap/hover reveals pass + miss split `14-init-core.js:992-994` — the raw signal is there.
- PROFILE.md anti-pattern note ("Gamification that obscures progress against interview readiness") is consciously dodged — the comment at `14-init-core.js:953` notes the deferred filter, showing intentional restraint.

## Weaknesses
- Pure-display surface — `14-init-core.js:996-998` only swap tooltip text, no `selectLesson()` route, no "drill what I missed on day X" action.
- Single-signal — doesn't intersect with `state.misses`, `state.weakness`, `reviews.dueAt`, or `recognize/gotcha/etc.` per-day stats. The other reflection tools (At Risk, Stats) compose 3+ signals; Streak Map composes one.
- Pass/miss classifier (`08-drills-bughunt-constraint.js:32-33`) is closed-set on the original 4 event types and never updated as new event types were added — so the user's growing surface coverage (walkthrough quizzes, flash blanks, notes-to-code) makes the map *less* informative over time, not more.
- Activity density is a vanity-adjacent metric — a heavy day with 80% misses looks identical to a heavy day with 80% passes (per the relative-tier scale ignoring pass/miss split for color).

## Salvage path (IMPROVE)
1. **[Edit 1]** — `js/app/08-drills-bughunt-constraint.js:22-37` — capture *which lesson ids* missed each day (push `lessonId` into `bucket.missedLessonIds`) AND extend the pass/miss classifier to recognise `L2-struggle-pass` + `notes-to-code-pass` as passes and `walkthrough-quiz-miss` as a miss; lifts Transfer-context by +1.
2. **[Edit 2]** — `js/app/14-init-core.js:987-998` — on cell click, if `b.misses > 0`, render a "Drill the 3 lessons you missed Mar 14 →" routing button that calls `selectLesson(id)`; lifts Closed-loop by +1.
3. **[Edit 3]** — `js/app/14-init-core.js:983-985` — replace generic "X events across Y days" with a forward-looking nudge like "Your peak streak: 7 days · last gap: 3 days · drill today to extend"; lifts Transfer-context by +1.

**Projected after salvage:** 6/6.

## Action log
- 2026-05-30 Scored 3/6 by `/eval-learning-tool --all`.
- 2026-05-30 Re-scored at 3/6 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
- 2026-05-30 Salvage edits 1+2+3 applied (Phase 4-A) — (1) Classifier extended at `js/app/08-drills-bughunt-constraint.js:7-58` — now recognises `L2-struggle-pass` + `notes-to-code-pass` as passes and `walkthrough-quiz-miss` + `walkthrough-bug-miss` + `flash-blank` as misses. PASS_EVENTS/MISS_EVENTS sets at `:23-31`. Buckets now also capture `missedLessonIds: Set` per day (de-dup'd, converted to Array at end at `:55`). Fixes the silent informativeness regression flagged in TRIAGE cross-cutting findings. (2) Cell click on a day with misses now renders "Drill the N lessons you missed" routing buttons at `js/app/14-init-core.js:1015-1040`; tap calls `selectLesson(id)` and dismisses the modal. (3) Default tooltip rewritten as forward-looking peak-streak + last-gap nudge at `:984-1003` ("Peak streak: 7 days · last gap: 3 days — drill today to extend"). Projected 3→6 (Transfer 1→3, Closed-loop 2→3). Crosses into KEEP ship-quality band. Validator: 895 passed, 0 failed.
