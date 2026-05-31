# 📝 Notes Drill — Learning-effectiveness audit

**Total: 15/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/05-drills-recognize-trace.js:993`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | `js/app/05-drills-recognize-trace.js:1067` blanks the load-bearing word inline; user must produce/pick before any reveal. No "show answer" tap exists pre-pick. |
| Encoding strength | 1/3 | `js/app/05-drills-recognize-trace.js:1069-1074` — 4-option MC over a single word. Recognition-grade, not free production. Distractor pool is "any eligible word from other lessons' notes" (`:961-991`) — often semantically far, which weakens encoding discrimination. |
| Spacing | 2/3 | `js/app/05-drills-recognize-trace.js:1023-1026` — replaced Fisher-Yates with `_srPriorityShuffle(pool, item => item.lessonId)`. Pool items are bucketed by SR-overdue + weakness (4 buckets, high-to-low) per `js/app/04-progress-sr.js:483-499`. Cards from lessons the user owes attention now surface FIRST within a session; misses still feed `state.weakness` (`:1090`). Per-item re-weighting now exists; per-item interval logic (true SR per-card) does not. Lifts to 2 (was 1). |
| Interleaving | 3/3 | `js/app/05-drills-recognize-trace.js:993-1022` flattens notes across up to 80 loaded lessons spanning all 3 tracks; deck of 12 is `_srPriorityShuffle`'d. Cross-section, cross-track. |
| Feedback quality | 2/3 | On reveal the card surfaces the blank word + the full original note + lesson title + section (handler at `:1083-1099`+). That's "correct answer + 1 line of context" — strong for a 1-line gotcha but no per-distractor "why wrong" or per-correct "why right beyond the note itself". |
| Transfer-context match | 1/3 | `js/app/05-drills-recognize-trace.js:1067` — cloze over a SENTENCE from `reference.notes[]`. The retrieval cue is "fill the blank in this prose explanation," not "produce code from a problem prompt." Per PROFILE.md L21-24 + L86-88 the target context is blank-editor coding under time pressure — this surface is one full step removed (recall a word that names a concept). |
| Closed-loop signal use | 3/3 | `js/app/05-drills-recognize-trace.js:1090-1093` — on MISS feeds `state.weakness[lessonId]++` and `appendHistory(... 'L1-miss')`; on EITHER outcome increments `state.notesDrill.attempts/correct` (lifetime stats). Wins-feed-too half qualifies as "wins AND misses feed". |

## Strengths
- Mines the previously-dead `reference.notes[]` corpus — every note has been on-disk since project start with ~zero recall surfaces touching it (`js/app/05-drills-recognize-trace.js:892-899` comment). High-leverage content reuse.
- SR/weakness-weighted card pick (`:1023-1026`) — first deck builder in the salvage batch to bias toward lessons the user owes attention, via shared `_srPriorityShuffle` helper (slice 04:483-499). Cold-start users degrade gracefully to uniform shuffle.
- Same-section distractors preferred first (`js/app/05-drills-recognize-trace.js:976`), so MC discrimination is non-trivial for plausible items.
- Misses both increment `state.weakness` AND log history — closes the loop into the existing weak-spot tracker.

## Weaknesses
- The blank-pick strategy (`js/app/05-drills-recognize-trace.js:933-958` walk-tokens-in-reverse) often grabs whichever word happens to fall last that passes stop-word + length filters — not necessarily the load-bearing concept. The header comment admits the heuristic; no curation gate.
- Distractor pool draws from ANY note in ANY lesson (`js/app/05-drills-recognize-trace.js:961-991`) — many distractors are semantically unrelated to the note's topic, making the 4-way MC easier than free-recall production.
- No per-card SR interval logic — Spacing is now lesson-grain bias on session start, not per-card dueAt scheduling. A card the user nailed last session can still surface again immediately if its lesson is weak/overdue.

## Salvage path (if IMPROVE)
Ordered by leverage. Each edit names file:line + dim it lifts.
1. **Per-distractor "why wrong"** — `js/app/05-drills-recognize-trace.js:1083-1099`-area — when an authored note string contains the distractor, surface a 1-line "X means ... so it doesn't fit here". Lifts Feedback by +1.
2. **Same-lesson distractors when available** — `js/app/05-drills-recognize-trace.js:961-991` — prefer distractors from the SAME lesson's other notes before falling back to same-section. Tighter discrimination. Lifts Encoding by +1.

**Projected after salvage:** 17/21.

## Action log
- 2026-05-30 Scored at 14/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 1 applied — replaced Fisher-Yates pool shuffle with shared `_srPriorityShuffle` helper at `js/app/05-drills-recognize-trace.js:828-840`. New helper at `js/app/04-progress-sr.js:461-490` bucketizes by SR-overdue + weakness (also used by recognize, trace-hop, reverse in Phase 2A). Projected 14→15 (+1 Spacing). Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 15/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
