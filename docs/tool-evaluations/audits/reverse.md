# 🎯 Reverse — Learning-effectiveness audit

**Total: 14/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/07-drills-swap-speedrun.js:539`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | `js/app/07-drills-swap-speedrun.js:564-571` shows masked invocation `in` + `out` + 4 masked-prompt buttons. User MUST pick before reveal. No bypass tap. |
| Encoding strength | 1/3 | `js/app/07-drills-swap-speedrun.js:522-527` — 4-option MC over masked problem-prompt strings. Recognition. The masking (`:461-474`) replaces user-defined function/variable identifiers with `f` so the user reasons from input/output shape, not from leftover identifier hints — that strengthens encoding discrimination slightly, but it's still picking from 4 prompts, not producing the answer. |
| Spacing | 1/3 | `js/app/07-drills-swap-speedrun.js:585` `state.weakness[card.lessonId]++` + `appendHistory(... 'L1-miss')` on miss. Card pick (`:541-547` preload + `:489-510` build) is random shuffle, no `state.reviews` consultation. Misses tracked, no SR scheduling. |
| Interleaving | 2/3 | `js/app/07-drills-swap-speedrun.js:488` — patterns track only; spans all patterns sections shuffled. Same shape as Recognize. |
| Feedback quality | 1/3 | `js/app/07-drills-swap-speedrun.js:594-595` — only `✓` or `✗ Correct shown above`. No per-distractor explanation, no "here's the I/O signal that pointed to this family." Correct-answer-only (the green highlight on the correct option button is the reveal). |
| Transfer-context match | 3/3 | `js/app/07-drills-swap-speedrun.js:564-567` shows the I/O trace of a canonical solution and asks which problem it solves — the FORWARD-FROM-OUTPUT reasoning a candidate uses to unblock during an interview when stuck reading someone else's code or auditing their own scratch. Per PROFILE.md L86-88 + the header comment at `:442-445`: real interview unblock pattern. Diagnose direction (input/output → problem) shaped exactly like a real interview move. |
| Closed-loop signal use | 3/3 | `js/app/07-drills-swap-speedrun.js:583-588` — MISS: `state.weakness[card.lessonId]++` + `appendHistory(... 'L1-miss')`; BOTH outcomes: `state.recognize.attempts++` + `state.recognize.correct++` on win. Wins AND misses both feed; per-lesson weakness AND aggregate diagnose-stats. (Reuses `state.recognize` as sibling diagnose direction — same lifetime stat field, intentional per `:447-448` header.) |

## Strengths
- Pure recombination of `L3.canonical` + `L3.expectedOutput` + `L3.prompt` (`js/app/07-drills-swap-speedrun.js:501-509`) — zero new authoring cost. Mines existing canonical I/O signal in a way nothing else does.
- Identifier-masking design (`js/app/07-drills-swap-speedrun.js:461-474`) is genuinely clever — keeps built-ins (`Math.floor`, `JSON.stringify`), classes, and string literals intact while wiping user-defined names that would leak the answer. Encoding discrimination is non-trivial even at 4-option MC because the user MUST reason from I/O shape.
- Closed-loop fully wired: weakness + history + recognize-aggregate-stats + drill-route on miss (`js/app/07-drills-swap-speedrun.js:583-588`). Tied with Trace-Hop and Notes-Drill for best closed-loop in the audited set.
- Shares lifetime stats with `state.recognize` (`:587`) so the user sees ONE aggregated diagnose-skill number across both diagnose directions — good UX consolidation, not state fragmentation.

## Weaknesses
- 4-option MC over prompt strings is recognition. The richer "forward-from-output" interview move is free-production ("from this I/O, write the problem statement") — Reverse drills the recognition-grade version.
- Feedback is the lightest in the audited set (`js/app/07-drills-swap-speedrun.js:594-595`) — `✓` or `✗ Correct shown above`. The user sees the green-highlighted correct button but no explanation of WHICH I/O signal (input shape? output type? mutation pattern?) was the diagnostic tell.
- Patterns-track only (`js/app/07-drills-swap-speedrun.js:488`); applied + syntax canonical I/Os are excluded from the diagnose drill. Applied lessons (decks, throttle/debounce) have very distinctive I/O shapes and would be high-signal additions to the pool.
- No SR weighting on card pick (`js/app/07-drills-swap-speedrun.js:489-510`); freshly-flagged weak patterns don't resurface preferentially.

## Salvage path (if IMPROVE)
Ordered by leverage. Each edit names file:line + dim it lifts.
1. **I/O-signal callout on reveal** — `js/app/07-drills-swap-speedrun.js:594-595` — when correct, surface "Tell: <output shape, e.g. 'returns boolean → predicate family'>". Even a heuristic mapping table (output-shape → family) authored once would teach the diagnostic skill the surface currently leaves the user to infer. Lifts Feedback by +1.
2. **Include `applied` track** — `js/app/07-drills-swap-speedrun.js:488,541` — change filter to `(l.track === 'patterns' || l.track === 'applied')`. Distinct I/O shapes on applied lessons (decks, throttle, undo-redo) are high-signal. Lifts Interleaving by +1. |
3. **SR-weighted card pick** — `js/app/07-drills-swap-speedrun.js:489-510` — bias the shuffle toward lessons in `state.weakness` or overdue `state.reviews`. Lifts Spacing by +1.

**Projected after salvage:** 17/21.

## Action log
- 2026-05-30 Scored at 14/21 by `/eval-learning-tool --all`.
