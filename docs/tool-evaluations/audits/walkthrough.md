# Walkthrough line-by-line stepper — Learning-effectiveness audit

**Total: 14/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/11-tabs-ref-conv-walk.js:256`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | Base stepper (`js/app/11-tabs-ref-conv-walk.js:472-498` Prev/Next/Reset) is read-only scrubbing — recognition only. BUT the embedded `🔮 Quiz` mode (`:413-470`) gates "predict the next step" via 4-option MC drawn from adjacent trace steps (`_pickQuizOptions` at `:218-254`) — that's genuine retrieval. And the `🪲 Bug` mode (`:565-626`) demands "find the corrupted step", a discrimination retrieval direction. NEW: scrub-to-end auto-flips `state.walkthrough[lessonId].scrubbed = true` (`:484-492`), and on next entry to a scrubbed walkthrough, `startQuiz()` is auto-invoked at `:648-651`. Recall is now the DEFAULT for any user who's previously stepped through a trace — not opt-in. 3/3. |
| Encoding strength | 1/3 | Quiz mode (`:429-469`) is 4-option recognition — pick the right next step. Bug mode (`:580-624`) is also pick-from-list. Both are recognition, not production. Base stepper is familiarity (just look). The retrieval format is recognition-tier regardless of how it's invoked. |
| Spacing | 0/3 | No SR integration. `js/app/11-tabs-ref-conv-walk.js` writes nothing to `state.reviews` from Walkthrough. Quiz/Bug now persist counters to `state.walkthrough[lessonId]` (`:449-458, 602-611`) but those counters drive in-tab UI only; no `scheduleReview` call, no `markPassed`. Misses flag `state.weakness` (lifts Closed-loop) but the SR scheduler proper is untouched. |
| Interleaving | 0/3 | Bound to single lesson (`renderWalkthrough(body, lesson, content)` at `:256`). User picks one example via `walk-example` select (`:286, 632-638`); no cross-lesson session. Trace-Hop sibling drill IS cross-lesson but lives in a separate sidebar entry. |
| Feedback quality | 2/3 | Quiz: on wrong pick, correct option is also surfaced (`:460-465`); user sees what they got + what was right. Bug: on wrong pick, actual bug step is revealed AND a "reveal" line shows original vs mutated value + mutation kind (`:613-622`). That's "correct + 1-line explanation" — solid 2/3. Missing the "why YOUR pick is wrong" layer for full 3/3 (no distractor-aware rationale). |
| Transfer-context match | 2/3 | Steps are tied to canonical code lines (`:382-389` highlights `walk-line[data-line-no="${step.line}"]`) + a live state panel — that's the interview "trace your code on this input" cadence. Quiz "predict next step" matches whiteboard "what's the next operation?" exchange. Not a blank editor under time pressure, but the cue shape (code + sample input + step-through) is interview-adjacent. |
| Closed-loop signal use | 3/3 | Quiz pick at `:441-458` writes `state.walkthrough[lessonId] = { quizAttempts, quizCorrect, bugAttempts, bugCorrect, lastRunAt, scrubbed }` counters AND on miss increments `state.weakness[lessonId]` + appends `'walkthrough-quiz-miss'` to history. Bug pick at `:594-611` mirrors the pattern with `'walkthrough-bug-miss'`. Scrub-to-end at `:484-492` writes the `scrubbed` flag that gates default-quiz-on-entry. Three independent signal lanes feed downstream (per-lesson counters → can drive a future trend pill; state.weakness → At-Risk / Today's Plan; state.history → Pace-Bar / Streak Map). |

## Strengths
- **Quiz mode is now the default on second entry** — `js/app/11-tabs-ref-conv-walk.js:484-492, 648-651` — scrub-to-end flips `scrubbed = true`; subsequent renders auto-`startQuiz()`. Closes the PROFILE.md anti-pattern "gates practice behind reading" — recall becomes the destination, not a button to find.
- **Quiz/Bug outcomes persist to three lanes** (`:441-458, 594-611`) — `state.walkthrough` counters (per-lesson), `state.weakness` (lesson-grain bias for autopilot), and `state.history` event log (Pace-Bar/Streak Map). Both retrieval modes write the full signal triad.
- **Bug-Hunt's mutate-and-spot pattern** (`_pickBugMutation` at `:527-556`) is well-engineered — number ±1, boolean flip, string swap, array swap, char +1; reveal step shows original vs mutated + mutation kind.

## Weaknesses
- **Encoding ceiling at 1/3** — both retrieval modes are pick-from-list recognition. Free production from "what's the next state?" with a typed prediction would unlock 2/3 but breaks the mobile-first MC ergonomics that make Quiz cheap on phone.
- **Spacing is 0/3** — counters persist but the SR scheduler isn't wired. A user who passes Quiz on a lesson 5× in a row gets no SR bucket advance from the Walkthrough tab; only L3 advances buckets. The Walkthrough trends in `state.walkthrough` are local-only.
- **No interleaving in-tab.** Each Walkthrough is a single-lesson surface; PROFILE.md "interleaving for transfer" (Rohrer & Taylor) is structurally absent. A "Hop across 5 lessons' middle steps" session would be the natural mixed-practice surface — and Trace-Hop sibling drill (`js/app/05-drills-recognize-trace.js`) ships it, just not from this tab.

## Salvage path (if IMPROVE)
Ordered by leverage. Each edit names file:line + dim it lifts.

1. **Quiz pass writes to SR scheduler** — `js/app/11-tabs-ref-conv-walk.js:449-458` — on `wt.quizCorrect / wt.quizAttempts >= 0.8` AND `wt.quizAttempts >= 3`, call a light SR write (e.g. `scheduleReview(lessonId)` with a shorter ladder than L3 — quiz is recognition, not production). Lifts **Spacing** by +1 (0→1) without overstating recognition-grade evidence.
2. **Wrong-pick rationale** — `js/app/11-tabs-ref-conv-walk.js:460-465` on incorrect quiz pick, render a 1-line "Your pick `Line X` would skip past `Y` — the loop doesn't advance i until..." note. Distractor-aware feedback. Lifts **Feedback** +1 (2→3).
3. **Cross-lesson Trace-Hop entry from Walkthrough tab** — add a "🧬 Trace-Hop other lessons →" button next to 🔮 Quiz / 🪲 Bug that opens Trace-Hop session. Lifts **Interleaving** +1 (0→1) — invites cross-lesson mixing as a sibling action without changing the per-lesson tab model.

**Projected after salvage:** 17/21 — KEEP, salvageable upper band.

## Removal path (if REMOVE)
Not warranted at 14/21 + 3-pt salvage path available. If a future audit drops it below 10 and salvage was attempted: walkthrough.trace data would be retained because `traceHop`, `reverseWalk`, `whatif` (all in `js/app/01-state-content.js:223,226,235`) consume it. The tab itself could be hidden behind a settings toggle; the trace-based drills are the real engine.

## Action log
- 2026-05-30 Scored at 11/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edits 1+2 applied — (1) Quiz/Bug outcome persistence via new `state.walkthrough[lessonId] = { quizAttempts, quizCorrect, bugAttempts, bugCorrect, lastRunAt, scrubbed }` schema (`js/app/01-state-content.js:252`, loader+saver in slice 04). Quiz pick at `js/app/11-tabs-ref-conv-walk.js:425-444` writes counters; on miss also increments `state.weakness[lessonId]` and appends `'walkthrough-quiz-miss'` history. Bug pick at `:570-587` mirrors the pattern with `'walkthrough-bug-miss'`. +2 Closed-loop. (2) Scrub-to-end flag in nextBtn handler at `:447-469`; default-open `🔮 Quiz` at end of `renderWalkthrough` (`:612-622`) when `wt.scrubbed === true`. +1 Active recall (recall becomes default). Projected 11→14. Wrong-pick rationale (+1 Feedback) and cross-lesson Trace-Hop promotion (+2 Interleaving) deferred. Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 14/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/). Salvage lifts confirmed (Active recall 2→3, Closed-loop 1→3).
