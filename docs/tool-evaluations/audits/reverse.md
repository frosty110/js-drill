# 🎯 Reverse — Learning-effectiveness audit

**Total: 17/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/07-drills-swap-speedrun.js:567`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | `js/app/07-drills-swap-speedrun.js:651-658` shows masked invocation `in` + `out` + 4 masked-prompt buttons. User MUST pick before reveal. No bypass tap. |
| Encoding strength | 1/3 | `js/app/07-drills-swap-speedrun.js:606-619` — 4-option MC over masked problem-prompt strings. Recognition. The masking (`:524-537`) replaces user-defined function/variable identifiers with `f` so the user reasons from input/output shape, not from leftover identifier hints — that strengthens encoding discrimination slightly, but it's still picking from 4 prompts, not producing the answer. |
| Spacing | 2/3 | `js/app/07-drills-swap-speedrun.js:572-578` — candidates filter (`patterns || applied` + full status) → `_srPriorityShuffle(candidates, l => l.id)`; pool items bucketed by SR-overdue + weakness then concatenated high-to-low. Misses still bump `state.weakness[card.lessonId]++` (`:672`). Per-item re-weighting now wired; no per-card interval logic. Lifts to 2 (was 1). |
| Interleaving | 3/3 | `js/app/07-drills-swap-speedrun.js:572-574` — candidate filter now includes BOTH `patterns` AND `applied` tracks (was patterns-only). Shuffled across all patterns + applied sections. Applied lessons (decks, throttle/debounce, undo-redo) have distinctive I/O shapes high-signal for diagnose-from-output reasoning. Cross-section + cross-track within the two tracks that have prompt+canonical+output. Lifts to 3 (was 2). |
| Feedback quality | 2/3 | `js/app/07-drills-swap-speedrun.js:681-690` — on reveal, `_reverseIOSignalHint(card.output)` (`:555-566`) produces an I/O-shape tell ("Tell: boolean output → predicate / validation family", "Tell: array-of-arrays output → grouping / partitioning family", etc.). The tell is shown under the ✓/✗ verdict (`:687-689`); when present the hold delay is extended to 1.4s (correct) / 2.2s (wrong) so the user has time to read (`:691-694`). Heuristic, honest — falls back to null for unknown shapes (`:565`). Surfaces the diagnostic heuristic, not just the answer. No per-distractor "why wrong" though; lifts to 2 (was 1). |
| Transfer-context match | 3/3 | `js/app/07-drills-swap-speedrun.js:651-654` shows the I/O trace of a canonical solution and asks which problem it solves — the FORWARD-FROM-OUTPUT reasoning a candidate uses to unblock during an interview. Per PROFILE.md L86-88 + the header comment at `:505-511`: real interview unblock pattern. Diagnose direction (input/output → problem) shaped exactly like a real interview move. |
| Closed-loop signal use | 3/3 | `js/app/07-drills-swap-speedrun.js:670-675` — MISS: `state.weakness[card.lessonId]++` + `appendHistory(... 'L1-miss')`; BOTH outcomes: `state.recognize.attempts++` + `state.recognize.correct++` on win. Wins AND misses both feed; per-lesson weakness AND aggregate diagnose-stats. (Reuses `state.recognize` as sibling diagnose direction — same lifetime stat field, intentional per `:510-511` header.) |

## Strengths
- Pure recombination of `L3.canonical` + `L3.expectedOutput` + `L3.prompt` (`js/app/07-drills-swap-speedrun.js:583-594`) — zero new authoring cost. Mines existing canonical I/O signal in a way nothing else does.
- Identifier-masking design (`:524-537`) is genuinely clever — keeps built-ins (`Math.floor`, `JSON.stringify`), classes, and string literals intact while wiping user-defined names that would leak the answer.
- I/O-shape tell on reveal (`:555-566` + `:681-690`) — first surface in the audited drills to TEACH the diagnostic heuristic, not just confirm/correct. Heuristic mapping (boolean → predicate, array-of-arrays → grouping, object → frequency/lookup) is shown after each card so the user accumulates the "what output shape signals which family" rule across sessions.
- Patterns + Applied corpus (`:572-574`) — applied lessons have very distinctive I/O shapes that are high-signal additions.
- SR/weakness-weighted shuffle (`:578`) via `_srPriorityShuffle` — first user-attention pass moves freshly-weak lessons to the front of the deck.
- Closed-loop fully wired: weakness + history + recognize-aggregate-stats (`:670-675`).

## Weaknesses
- 4-option MC over prompt strings is recognition. The richer "forward-from-output" interview move is free-production ("from this I/O, write the problem statement") — Reverse drills the recognition-grade version.
- The I/O tell is a coarse heuristic — `_reverseIOSignalHint` (`:555-566`) maps by regex on first chars (`^\[\s*\[` → arr-of-arr). Real interview tells include input-shape signals (sorted? graph? tree?) which aren't surfaced. Authored hints per lesson would lift further but are a different effort class.
- No per-card SR interval logic — Spacing is lesson-grain bias on session start, not per-card.

## Salvage path (if IMPROVE)
Ordered by leverage. Each edit names file:line + dim it lifts.
1. **Per-distractor "why wrong"** — `js/app/07-drills-swap-speedrun.js:681-690` — when a distractor's prompt is also in `pool`, surface "That prompt would have produced <other.output>" so the user contrasts. Lifts Feedback by +1.
2. **Hold-but-reset-dueAt on correct (mastered+due)** — `js/app/07-drills-swap-speedrun.js:670-675` — mirror Predict's pattern (`:463-465`): on `wasCorrect`, if `state.reviews[card.lessonId] && isDueForReview(card.lessonId)` call `scheduleReview(card.lessonId, { advance: false })`. Lifts Spacing toward 3 (per-card SR coupling on wins).

**Projected after salvage:** 19/21 (KEEP, ship-quality).

## Action log
- 2026-05-30 Scored at 14/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edits 1+2+3 applied — (1) I/O-shape tell on reveal via new `_reverseIOSignalHint(output)` helper at `js/app/07-drills-swap-speedrun.js:487-503`, surfaced under ✓/✗ at `:618-630` (+1 Feedback); (2) include `applied` track in candidate filter + preload at `:506-512, 561-565` (+1 Interleaving); (3) SR-weighted shuffle via `_srPriorityShuffle` at `:515-518` (+1 Spacing). New `.reverse-tell` style at `css/04-drills.css:792-797`. Projected 14→17. Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 17/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
