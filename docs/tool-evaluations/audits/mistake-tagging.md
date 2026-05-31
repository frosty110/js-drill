# mistake-tagging — Learning-effectiveness audit (reflection-kind)

**Total: 6/6** (reflection-kind: only Closed-loop + Transfer-context scored)
**Verdict: KEEP**
**Anchor file:** `js/app/12a-l1.js:384`
**Scored:** 2026-05-30 (rescored 2026-05-30 post-Phase-4-B salvage)

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | N/A | (reflection tool) |
| Encoding strength | N/A | (reflection tool) |
| Spacing | N/A | (reflection tool) |
| Interleaving | N/A | (reflection tool) |
| Feedback quality | N/A | (reflection tool) |
| Transfer-context match | 3/3 | Capture surface at `js/app/12a-l1.js:384-417` still fires in interview-shape retrieval context (opt-in chip strip below L1 miss explain). The Stats tile at `js/app/14-init-core.js:1646-1657` is now tap-routed: each chip is a `<button data-mistake-route="${lessonId}">` carrying the lesson with the most recent miss of that tag; click handler at `:1766-1777` calls `selectLesson(id)` + `selectTab('L1')` to drop the user directly into the concept-grain surface where they previously tagged. Tile header now reads "(N tagged · tap to drill)" (`:1653`). Phase 4-B closed the "static text dead-end" weakness — tag-grain surfaces both name the gap AND route to drill → 3/3. |
| Closed-loop signal use | 3/3 | Capture writes `state.misses[lessonId]=[{at,level,tag}]` (`js/app/04-progress-sr.js:831-840`). `_aggregateMissTags()` at `:846-877` now returns `topLessons: [{lessonId, count, lastAt}]` per tag (reverse index, sorted recency-then-count) — feeds the tap-route in the Stats tile. New helper `mostRecentTaggedMissLesson()` at `:888-911` returns the single freshest tagged-miss lesson; consumed by `dailyPlan()` at `js/app/09-stats-cheatsheet-mock.js:664-665` as a 4th signal slot labeled `recent <tag> miss`. Signal flow: capture → aggregate → route in two surfaces (Stats tile + Today's Plan slot). Composes 3+ signals (misses + lesson curriculum + tag registry) and ROUTES on tap → 3/3. |

## Strengths
- Lowest-friction opt-in tagging UI in the codebase: 6 chips inline below explain text, dismissible, auto-fades after pick (`js/app/12a-l1.js:393-414`). Captures concept-grain signal that `state.weakness` (lesson-grain) cannot.
- Signal now feeds TWO downstream surfaces: Stats tap-route tile (`js/app/14-init-core.js:1646-1657`) AND Today's Plan tag-grain slot (`js/app/09-stats-cheatsheet-mock.js:664-665`) — same captured tag drives both reflection and autopilot.
- Reverse-index aggregator at `js/app/04-progress-sr.js:846-877` is schema-additive — preserves existing `{tag, count, label}` shape and adds `topLessons` without bumping `__v`. Composable for future surfaces.

## Weaknesses
- L1-only capture (`js/app/12a-l1.js:405` hard-codes `'L1'`) — L2/L3 misses never tag, despite schema supporting it. Half the failure modes (semantics, syntax) actually surface on L2 typed-fill. (Rubric-orthogonal but the next obvious lift.)
- Today's Plan slot uses `mostRecentTaggedMissLesson()` (single freshest) rather than dominance-weighted — a user with 1 fresh `syntax` miss outranks 10 older `off-by-one` misses. Acceptable for recency-bias but loses dominance signal.
- No "tag has been resolved" demotion — clearing the underlying weakness or passing L1 cleanly doesn't expire old tag entries; the 50-entry cap at `js/app/04-progress-sr.js:836-838` is the only bound.

## Salvage path (KEEP — completed)
All 3 edits from prior baseline shipped in Phase 4-B. Optional opportunistic improvements:
- Extend capture to L2 misses (`js/app/12b-l2.js` typed-fill miss path) — schema already supports `level: 'L2'`. Would not lift rubric (already 3/3 on both dims) but doubles capture surface.
- Dominance-aware Today's Plan slot using `_aggregateMissTags(1)[0].topLessons[0]` (top tag's top lesson) instead of recency-only `mostRecentTaggedMissLesson()`. Toggle between recency and dominance based on session pattern.

**Score:** 6/6 (was 4/6 pre-salvage).

## Action log
- 2026-05-30 Scored at 4/6 by `/eval-learning-tool --all`.
- 2026-05-30 Re-scored at 4/6 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
- 2026-05-30 Salvage edits 1+2+3 applied (Phase 4-B) — (1) `_aggregateMissTags` at `js/app/04-progress-sr.js:841-873` rewritten to also return `topLessons: [{lessonId, count, lastAt}]` per tag, sorted by recency then count. (2) Stats tile chips at `js/app/14-init-core.js:1646-1657` converted to tap-route `<button data-mistake-route>` elements; handler at `:1759-1767` calls `selectLesson(id)` + `selectTab('L1')`. Tile header updated to "tap to drill". (3) New `mostRecentTaggedMissLesson()` helper at `js/app/04-progress-sr.js:878-895`; `dailyPlan()` at `js/app/09-stats-cheatsheet-mock.js:644-684` now inserts a "recent <tag> miss" slot between weak-spot and starter-path slots. Schema-additive — no `__v` bump. Projected 4→6 (Closed-loop 2→3, Transfer 2→3). Crosses into KEEP ship-quality reflection band. Validator: 895 passed, 0 failed.
- 2026-05-30 Re-scored at 6/6 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-184940/). Lift verified: `_aggregateMissTags` returns `topLessons` per row at `js/app/04-progress-sr.js:846-877`; Stats tile chips at `js/app/14-init-core.js:1646-1657` use `<button data-mistake-route>` with click handler at `:1766-1777`; `dailyPlan()` at `js/app/09-stats-cheatsheet-mock.js:644-676` has the `recent <tag> miss` slot at `:664-665`. Delta +2 (4/6 → 6/6). Composed signal flow Today's Plan now 4 sources, not 3.
