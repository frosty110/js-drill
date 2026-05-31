# mistake-tagging — Learning-effectiveness audit (reflection-kind)

**Total: 4/6** (reflection-kind: only Closed-loop + Transfer-context scored)
**Verdict: IMPROVE**
**Anchor file:** `js/app/12a-l1.js:384`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | N/A | (reflection tool) |
| Encoding strength | N/A | (reflection tool) |
| Spacing | N/A | (reflection tool) |
| Interleaving | N/A | (reflection tool) |
| Feedback quality | N/A | (reflection tool) |
| Transfer-context match | 2/3 | `js/app/12a-l1.js:384-417` opt-in chip strip below L1 miss explain — fires in retrieval context (interview-shape blank prompt, post-error moment). Aggregate `js/app/14-init-core.js:1595-1611` shows top-5 tag chips but renders only inside Stats modal — surfaces a gap ("syntax × 12") but does NOT answer "which lesson should I drill next" — user must mentally map "syntax" → lessons. Helps identify a gap; user decides → 2/3. |
| Closed-loop signal use | 2/3 | Writes a real concept-grain signal `state.misses[lessonId]=[{at,level,tag}]` (`js/app/04-progress-sr.js:831-840`) — the only concept-tag stream the app captures. Reads via `_aggregateMissTags()` (`js/app/04-progress-sr.js:842-856`) and renders pill chips at `js/app/14-init-core.js:1604-1606`. But the pills are **static text** — `escapeHtml(row.label) ×N` with no `data-action`, no click handler, no route to drill. Signal IS composed (sum across all lessons by tag), but not actionably routed → 2/3 (composes but doesn't route). |

## Strengths
- Lowest-friction opt-in tagging UI in the codebase: 6 chips inline below explain text, dismissible, auto-fades after pick (`js/app/12a-l1.js:393-414`). Captures concept-grain signal that `state.weakness` (lesson-grain) cannot.
- Storage shape is genuinely composable: `{at, level, tag}` per entry, level field is forward-compatible for L2/L3 tagging (`js/app/04-progress-sr.js:834`).
- Bounded to 50 entries per lesson (`js/app/04-progress-sr.js:836-838`) — won't bloat localStorage.

## Weaknesses
- Top miss patterns tile is a dead-end: chip pills at `js/app/14-init-core.js:1606` have zero interactivity. User sees "off-by-one × 8" but must navigate manually to find off-by-one-prone lessons.
- Tag-to-lesson reverse index never built. `state.misses` is keyed by lessonId, but the aggregator drops lessonId on the floor (`js/app/04-progress-sr.js:847-851`) — can't route from a tag back to top-3 lessons that triggered it.
- L1-only capture (`js/app/12a-l1.js:405` hard-codes `'L1'`) — L2/L3 misses never tag, despite the schema supporting it. Half the failure modes (semantics, syntax) actually surface on L2.

## Salvage path (IMPROVE)

1. **[Tile → tap-route]** — `js/app/14-init-core.js:1604-1606` — wrap each pill in `<button data-action="drill-tag" data-tag="${row.tag}">`, add a handler that picks the lesson with the most recent miss of that tag and `selectLesson(id)` + jumps to L1. Lifts Closed-loop signal use +1 (3/3 — composes AND routes).
2. **[Reverse-index aggregator]** — `js/app/04-progress-sr.js:842-856` — change `_aggregateMissTags` to also return `topLessons: [{lessonId, count}]` per tag so the tap-route in #1 has data. Co-requisite of #1.
3. **[Tag-grain Today's Plan slot]** — `js/app/09-stats-cheatsheet-mock.js:644-668` — add a 4th `add(...)` after `weakSpot` for the top tag's most-recent-miss lesson labeled `"recent {tag} miss"`. Lifts Transfer-context match +1 (3/3 — directly answers next-action).

**Projected after salvage:** 6/6.

## Action log
- 2026-05-30 Scored at 4/6 by `/eval-learning-tool --all`.
- 2026-05-30 Re-scored at 4/6 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
- 2026-05-30 Salvage edits 1+2+3 applied (Phase 4-B) — (1) `_aggregateMissTags` at `js/app/04-progress-sr.js:841-873` rewritten to also return `topLessons: [{lessonId, count, lastAt}]` per tag, sorted by recency then count. (2) Stats tile chips at `js/app/14-init-core.js:1646-1657` converted to tap-route `<button data-mistake-route>` elements; handler at `:1759-1767` calls `selectLesson(id)` + `selectTab('L1')`. Tile header updated to "tap to drill". (3) New `mostRecentTaggedMissLesson()` helper at `js/app/04-progress-sr.js:878-895`; `dailyPlan()` at `js/app/09-stats-cheatsheet-mock.js:644-684` now inserts a "recent <tag> miss" slot between weak-spot and starter-path slots. Schema-additive — no `__v` bump. Projected 4→6 (Closed-loop 2→3, Transfer 2→3). Crosses into KEEP ship-quality reflection band. Validator: 895 passed, 0 failed.
