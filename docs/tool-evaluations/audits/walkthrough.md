# Walkthrough line-by-line stepper — Learning-effectiveness audit

**Total: 11/21**
**Verdict: IMPROVE-or-cut**
**Anchor file:** `js/app/11-tabs-ref-conv-walk.js:239`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 2/3 | Base stepper (`js/app/11-tabs-ref-conv-walk.js:441-451` Prev/Next/Reset) is read-only scrubbing — recognition only. BUT the embedded `🔮 Quiz` mode (`js/app/11-tabs-ref-conv-walk.js:396-439`) gates "predict the next step" via 4-option MC drawn from adjacent trace steps (`_pickQuizOptions` at line 201) — that's genuine retrieval. And the `🪲 Bug` mode (lines 518-567) demands "find the corrupted step", a discrimination retrieval direction. Two real recall modes inside a recognition shell. |
| Encoding strength | 1/3 | Quiz mode (`js/app/11-tabs-ref-conv-walk.js:412-438`) is 4-option recognition — pick the right next step. Bug mode (line 533-565) is also pick-from-list. Both are recognition, not production. Base stepper is familiarity (just look). |
| Spacing | 0/3 | No SR integration. `js/app/11-tabs-ref-conv-walk.js` writes nothing to `state.reviews`. Quiz/Bug outcomes are ephemeral (lines 424-438, 548-565 register clicks for in-render styling only — no `saveProgress`, no counter). |
| Interleaving | 0/3 | Bound to single lesson (`renderWalkthrough(body, lesson, content)` at line 239). User picks one example via `walk-example` select (line 320, 573-579); no cross-lesson session. |
| Feedback quality | 2/3 | Quiz: on wrong pick, correct option is also surfaced (`js/app/11-tabs-ref-conv-walk.js:428-433`); user sees what they got + what was right. Bug: on wrong pick, actual bug step is revealed AND a "reveal" line shows original vs mutated value + mutation kind (lines 552-563). That's "correct + 1-line explanation" — solid 2/3. Missing the "why YOUR pick is wrong" layer for full 3/3. |
| Transfer-context match | 2/3 | Steps are tied to canonical code lines (line 367-371 highlights `walk-line[data-line-no="${step.line}"]`) + a live state panel — that's the interview "trace your code on this input" cadence. Quiz "predict next step" matches whiteboard "what's the next operation?" exchange. Not a blank editor under time pressure, but the cue shape (code + sample input + step-through) is interview-adjacent. |
| Closed-loop signal use | 1/3 | UI-state cache (`js/app/11-tabs-ref-conv-walk.js:250-254` `_cacheGet/_cacheSet` — exampleIdx + stepIdx survive tab switches). But Quiz/Bug outcomes are NEVER persisted: lines 424-438 (quiz pick) and 548-565 (bug pick) call no `saveProgress`, write to no counter. A separate `traceHop` drill (`js/app/01-state-content.js:223`) drives counters from the same walkthrough.trace data — but THIS tab doesn't. |

## Strengths
- Genuine retrieval-direction surfaces hidden inside — `js/app/11-tabs-ref-conv-walk.js:396` (Quiz) and `:518` (Bug) are the only places in the Walkthrough tab that demand prediction. Bug-Hunt's mutate-and-spot pattern (`_pickBugMutation` line 480-509) is well-engineered.
- Strong cue-shape — current-line highlight + live state panel (`js/app/11-tabs-ref-conv-walk.js:367-379`) matches the interview "trace this on the whiteboard" exchange.
- UI state persistence across tab-switches (`js/app/11-tabs-ref-conv-walk.js:250-254`) respects PROFILE.md's "sessions are minutes" constraint — user can resume mid-trace.

## Weaknesses
- Default mode is read-only scrubbing. PROFILE.md anti-pattern "gates practice behind reading" — most users will press Next/Next/Next and never tap 🔮 or 🪲. The retrieval modes are opt-in behind buttons in a flexbox row (line 275-276) that compete with Prev/Next.
- Quiz/Bug outcomes are ephemeral. `js/app/11-tabs-ref-conv-walk.js:424-438, 548-563` — every click is locally styled but never persisted; the user has no record they got it right or wrong, and no signal feeds SR / weakness / `traceHop` counters.
- No interleaving. Each Walkthrough is a single-lesson surface; PROFILE.md "interleaving for transfer" (Rohrer & Taylor) is structurally absent. A "Hop across 5 lessons' middle steps" session would be the natural mixed-practice surface.

## Salvage path (if IMPROVE)
Ordered by leverage. Each edit names file:line + dim it lifts.
1. **Persist Quiz/Bug outcomes to `state.walkthrough`** — `js/app/11-tabs-ref-conv-walk.js:424-438, 548-563` add `state.walkthrough[lessonId] = { quizAttempts, quizCorrect, bugAttempts, bugCorrect, lastRunAt }`; on miss also flag `state.weakness[lessonId]`. Lifts Closed-loop +2.
2. **Default-open Quiz after first full scrub** — track "user has next-clicked to end" and on the 2nd entry to the tab, auto-open `🔮 Quiz`. Lifts Active recall +1 (recall becomes default, not opt-in).
3. **Cross-lesson Trace-Hop entry on sidebar** — promote the existing `traceHop` drill (`js/app/05-drills-recognize-trace.js`) as the *default* walkthrough entry from Today's Plan, not a separate sidebar pill. Lifts Interleaving +2.
4. **Wrong-pick rationale** — `js/app/11-tabs-ref-conv-walk.js:428-433` on incorrect quiz pick, render a 1-line "Your pick `Line X` would skip past `Y` — the loop doesn't advance i until..." note. Distractor-aware feedback. Lifts Feedback +1.

**Projected after salvage:** 17/21 — KEEP, salvageable tier.

## Removal path (if REMOVE)
Not warranted at 11/21 + 4-pt salvage path available. If a future audit drops it below 10 and salvage was attempted: walkthrough.trace data would be retained because `traceHop`, `reverseWalk`, `whatif` (all in `js/app/01-state-content.js:223,226,235`) consume it. The tab itself could be hidden behind a settings toggle; the trace-based drills are the real engine.

## Action log
- 2026-05-30 Scored at 11/21 by `/eval-learning-tool --all`.
