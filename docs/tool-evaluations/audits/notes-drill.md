# 📝 Notes Drill — Learning-effectiveness audit

**Total: 14/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/05-drills-recognize-trace.js:855`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | `js/app/05-drills-recognize-trace.js:876` blanks the load-bearing word inline; user must produce/pick before any reveal. No "show answer" tap exists pre-pick. |
| Encoding strength | 1/3 | `js/app/05-drills-recognize-trace.js:842-849` — 4-option MC over a single word. Recognition-grade, not free production. Distractor pool is "any eligible word from other lessons' notes" (`:769-799`) — often semantically far, which weakens encoding discrimination. |
| Spacing | 1/3 | `js/app/05-drills-recognize-trace.js:899` increments `state.weakness[lessonId]` and `appendHistory(... 'L1-miss')` on miss, but the card itself is sampled at random (`:832-835` Fisher-Yates) and is NOT scheduled against `state.reviews` SR intervals. Misses feed the tracker; correct cards don't push due dates. |
| Interleaving | 3/3 | `js/app/05-drills-recognize-trace.js:803-829` flattens notes across up to 80 loaded lessons spanning all 3 tracks; deck of 12 is uniformly shuffled. Cross-section, cross-track. |
| Feedback quality | 2/3 | `js/app/05-drills-recognize-trace.js:910-917` reveals the blank word + the FULL ORIGINAL NOTE + lesson title + section. That's "correct answer + 1 line of context" — strong for a 1-line gotcha but no per-distractor "why wrong" or per-correct "why right beyond the note itself". |
| Transfer-context match | 1/3 | `js/app/05-drills-recognize-trace.js:876` — cloze over a SENTENCE from `reference.notes[]`. The retrieval cue is "fill the blank in this prose explanation," not "produce code from a problem prompt." Per PROFILE.md L21-24 + L86-88 the target context is blank-editor coding under time pressure — this surface is one full step removed (recall a word that names a concept). |
| Closed-loop signal use | 3/3 | `js/app/05-drills-recognize-trace.js:899-901` — on MISS feeds `state.weakness[lessonId]++` and `appendHistory(...'L1-miss')`; on EITHER outcome increments `state.notesDrill.attempts/correct` (lifetime stats). The wins-feed-too half qualifies as "wins AND misses feed". |

## Strengths
- Mines the previously-dead `reference.notes[]` corpus — every note has been on-disk since project start with ~zero recall surfaces touching it (`js/app/05-drills-recognize-trace.js:700-707` comment). High-leverage content reuse.
- Same-section distractors preferred first (`js/app/05-drills-recognize-trace.js:784`), so MC discrimination is non-trivial for plausible items.
- Misses both increment `state.weakness` AND log history — closes the loop into the existing weak-spot tracker (`js/app/05-drills-recognize-trace.js:899`).

## Weaknesses
- The blank-pick strategy (`js/app/05-drills-recognize-trace.js:736-766` walk-tokens-in-reverse) often grabs whichever word happens to fall last that passes stop-word + length filters — not necessarily the load-bearing concept. The header comment admits the heuristic; no curation gate.
- Distractor pool draws from ANY note in ANY lesson (`js/app/05-drills-recognize-trace.js:773-787`) — many distractors are semantically unrelated to the note's topic, making the 4-way MC easier than free-recall production.
- No SR scheduling (`js/app/05-drills-recognize-trace.js:832-835`) — random sample each session. A user who nailed a note 7 sessions ago has equal chance of seeing it again as a brand-new miss.

## Salvage path (if IMPROVE)
Ordered by leverage. Each edit names file:line + dim it lifts.
1. **SR weighting on card pick** — `js/app/05-drills-recognize-trace.js:832-835` — replace Fisher-Yates with a pull that biases toward items belonging to lessons in `state.weakness` or with overdue `state.reviews[lessonId]`. Lifts Spacing by +1.
2. **Per-distractor "why wrong"** — `js/app/05-drills-recognize-trace.js:910-917` — when an authored note string contains the distractor, surface a 1-line "X means ... so it doesn't fit here". (Needs lightweight authored tag set; could ship as best-effort over existing notes corpus.) Lifts Feedback by +1.
3. **Same-lesson distractors when available** — `js/app/05-drills-recognize-trace.js:769-799` — prefer distractors from the SAME lesson's other notes before falling back to same-section. Tighter discrimination. Lifts Encoding by +1.

**Projected after salvage:** 17/21.

## Action log
- 2026-05-30 Scored at 14/21 by `/eval-learning-tool --all`.
