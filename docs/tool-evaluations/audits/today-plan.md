# today-plan — Learning-effectiveness audit (reflection-kind)

**Total: 6/6** (reflection-kind: only Closed-loop + Transfer-context scored)
**Verdict: KEEP**
**Anchor file:** `js/app/09-stats-cheatsheet-mock.js:644`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | N/A | (reflection tool) |
| Encoding strength | N/A | (reflection tool) |
| Spacing | N/A | (reflection tool) |
| Interleaving | N/A | (reflection tool) |
| Feedback quality | N/A | (reflection tool) |
| Transfer-context match | 3/3 | `js/app/14-init-core.js:1751-1762` — modal opens with a single green 🎯 Start CTA pinned to `plan[0]` ("press one thing → drilling" per PROFILE.md:76-78). Each row carries a `why` label ("review due" / "weak spot" / "next on plan") at `js/app/14-init-core.js:1779` so the user sees not just what to drill but WHY this lesson is next. Inventory strip `js/app/14-init-core.js:1743-1750` summarizes the bundle ("3 due · 1 weak · 2 on path"). This IS the autopilot surface PROFILE.md is built around. |
| Closed-loop signal use | 3/3 | `dailyPlan()` at `js/app/09-stats-cheatsheet-mock.js:644-676` composes FOUR independent signal sources in priority order: SR `dueReviewIds()` (top 3) → `topWeakLessonId()` (top weakness) → `mostRecentTaggedMissLesson()` (`js/app/04-progress-sr.js:888-911` — freshest concept-grain miss-tag, slot labeled `recent <tag> miss` at `:665`) → `getActiveStarterPath()` (next 2 unmastered). The new 4th slot (Phase 4-B mistake-tagging salvage, audits/mistake-tagging.md edit 3) closes the previously-flagged "no concept-grain miss signal" weakness. Deduplicates so a lesson appearing in two buckets surfaces under the higher-priority label. Every row routes on tap: click handler at `js/app/14-init-core.js:1786-1792` closes modal and `selectLesson(id)` directly opens the lesson. Composes 4 signal sources, ranks by urgency, ROUTES on tap → 3/3. |

## Strengths
- Four-signal composition is the cleanest in the codebase: SR-due first (retention beats new content per inline comment `js/app/09-stats-cheatsheet-mock.js:646-649`), weak before tag before path (lesson-grain weakness, then freshest concept-grain miss, then next-in-curriculum). Comments at `js/app/09-stats-cheatsheet-mock.js:644-656` make the priority rationale explicit. Tag-grain slot composes Mistake Tagging signal previously stranded in the Stats modal.
- Primary CTA pattern (`js/app/14-init-core.js:1751-1762`) is the canonical "one button to drill" autopilot surface — and iter 42 refinement (line 1763-1768) removed the working-memory duplicate so the start CTA's lesson is dropped from the "OR PICK ANOTHER" list.
- Inventory strip (`js/app/14-init-core.js:1743-1750`) converts an opaque queue into a named bundle, addressing PROFILE.md's ADHD/overwhelm constraint.

## Weaknesses
- Caps signal mix at 3+1+1+2=7 lessons; for the rare user with 20+ due reviews the modal silently truncates and a true backlog stays invisible. The `dueReviewIds().slice(0, 3)` at `js/app/09-stats-cheatsheet-mock.js:662` hides that signal magnitude — the inventory strip says "3 due" even when 30 are due.
- Recent-tagged-miss slot uses `mostRecentTaggedMissLesson()` which picks single freshest miss across ALL tags — when a user has 3+ tags tied for recency, only one surfaces. (Minor — most users tag sparingly so collisions are rare.)
- No miss-pattern dominance signal: if the user has 12 `off-by-one` misses across 5 lessons vs 1 `syntax` miss, the freshest single miss wins regardless of tag-level dominance. The Stats `_aggregateMissTags` reverse-index could feed a dominance-aware slot if needed.

## Salvage path (KEEP — no changes required)
N/A — score is at ceiling for the rubric. Phase 4-B Mistake Tagging salvage edit 3 shipped the 4th signal slot (tag-grain miss) flagged here as the opportunistic improvement on the prior pass.

## Action log
- 2026-05-30 Scored at 6/6 by `/eval-learning-tool --all`.
- 2026-05-30 Re-scored at 6/6 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
- 2026-05-30 Re-scored at 6/6 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-184940/). Signal composition lifted from 3 sources → 4 (Phase 4-B mistake-tagging tag-grain slot shipped); rubric ceiling unchanged.
