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
| Closed-loop signal use | 3/3 | `dailyPlan()` at `js/app/09-stats-cheatsheet-mock.js:644-668` composes THREE independent signal sources in priority order: SR `dueReviewIds()` (top 3) → `topWeakLessonId()` (top weakness) → `getActiveStarterPath()` (next 2 unmastered). Deduplicates so a lesson appearing in two buckets surfaces under the higher-priority label. Every row routes on tap: click handler at `js/app/14-init-core.js:1786-1792` closes modal and `selectLesson(id)` directly opens the lesson. Composes multiple signal sources, ranks by urgency, ROUTES on tap → 3/3. |

## Strengths
- Three-signal composition is the cleanest in the codebase: SR-due first (retention beats new content per inline comment `js/app/09-stats-cheatsheet-mock.js:646-649`), weak before path (active misconception more actionable than next-in-curriculum). Comments at `js/app/09-stats-cheatsheet-mock.js:644-650` make the priority rationale explicit.
- Primary CTA pattern (`js/app/14-init-core.js:1751-1762`) is the canonical "one button to drill" autopilot surface — and iter 42 refinement (line 1763-1768) removed the working-memory duplicate so the start CTA's lesson is dropped from the "OR PICK ANOTHER" list.
- Inventory strip (`js/app/14-init-core.js:1743-1750`) converts an opaque queue into a named bundle, addressing PROFILE.md's ADHD/overwhelm constraint.

## Weaknesses
- Caps signal mix at 3+1+2=6 lessons; for the rare user with 20+ due reviews the modal silently truncates and a true backlog stays invisible. The `dueReviewIds().slice(0,3)` at `js/app/09-stats-cheatsheet-mock.js:656` hides that signal magnitude — the inventory strip says "3 due" even when 30 are due.
- No tagging-tool integration: doesn't add a slot for recent miss-tag concepts (`state.misses`) — a closed-loop signal from a sibling reflection tool that goes unused here. (See mistake-tagging audit Salvage #3.)
- Mistake Tagging top patterns isn't a Today's Plan slot, despite being the only concept-grain miss signal.

## Salvage path (KEEP — no changes required)
N/A — score is at ceiling for the rubric. Minor opportunistic improvement: integrate `_aggregateMissTags()` as a 4th signal slot (covered in mistake-tagging Salvage #3) when that tool's tap-route ships.

## Action log
- 2026-05-30 Scored at 6/6 by `/eval-learning-tool --all`.
- 2026-05-30 Re-scored at 6/6 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
