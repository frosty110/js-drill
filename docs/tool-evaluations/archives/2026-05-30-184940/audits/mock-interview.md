# Mock Interview — Learning-effectiveness audit

**Total: 19/21**
**Verdict: KEEP, ship-quality**
**Anchor file:** `js/app/09-stats-cheatsheet-mock.js:670` (`startMockInterview`) + `js/app/12c-l3.js:571` (grade gate)
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | Blank editor + hints/diff/reveal/critical-fill all gated off when `isMock` is true — `js/app/12c-l3.js:193-201` (`${isMock ? '' : ...}`) and `:342-360` (no cached editor text restored during mock). User must produce the canonical from memory; nothing to read or recognize. |
| Encoding strength | 3/3 | Free production into a CodeMirror editor that grades by `outputsMatch(result.output, drill.expectedOutput)` — `js/app/12c-l3.js:571`. No cue beyond the L3 prompt; encoding is pure recall of code from a one-line problem stem. |
| Spacing | 2/3 | Lesson selection is SR-weighted: `_pickMockLessonId()` builds a weighted pool where `(weak && due) = 5×, (weak || due) = 3×, neither = 1×` over `dueReviewIds()` and `state.weakness` — `js/app/09-stats-cheatsheet-mock.js:716-744`. Re-weights selection toward due/weak but does NOT itself advance `state.reviews` on mock pass (the underlying `markPassed`→`scheduleReview` SR fires at L3 grade, so SR is integrated downstream — not 3 because the mock surface only consumes the SR signal; it doesn't drive new intervals beyond what an L3 pass already does). |
| Interleaving | 2/3 | Random pick across the full Patterns track per session — `js/app/09-stats-cheatsheet-mock.js:717` (`patternLessons = CURRICULUM.filter(... track === 'patterns')`). One lesson per mock, but sessions chain via "🎯 Mock another" — `js/app/12c-l3.js:604-609`. Cross-lesson cross-section mix across consecutive mocks (not blocked); single-lesson within a mock keeps it from 3. |
| Feedback quality | 2/3 | Pass: timer + PB delta + tries + first-mock vs new-PB vs match vs off-best — `js/app/12c-l3.js:585-593`. Runtime errors surface stderr `js/app/12c-l3.js:614-615`. Output-mismatch shows expected vs actual via debug heuristic — `js/app/12c-l3.js:617+`. Strong correctness signal but no per-line explanation of WHY the wrong answer was wrong (that's by design — interview-shaped). |
| Transfer-context match | 3/3 | This is THE interview-shaped surface in the app: random pattern + blank editor + live timer (`mock-timer` `js/app/12c-l3.js:92`) + no hints + no scaffolding (`js/app/12c-l3.js:194-200`). Exactly matches PROFILE.md L86-88 "Interview-format conditioning … no hints, blank editor, expected output to hit". |
| Closed-loop signal use | 3/3 | Pass updates `state.mockHistory[lessonId]` (last N) and `state.bestTimes[lessonId]` — `js/app/09-stats-cheatsheet-mock.js:694-702`. L3-pass downstream triggers `markPassed`→`scheduleReview` advancing the SR bucket. Misses on the way (failed runs) feed via `appendHistory`; the mock surface feeds `bestTimes`, `mockHistory`, `state.reviews`, and the Mock Replay Reel reads them back (`js/app/12c-l3.js:113-123`). Wins AND signal-bearing failures both persist. |

## Strengths
- The only surface that simulates **all four** interview-format constraints simultaneously — blank editor, time pressure, no hints, expected output — `js/app/12c-l3.js:88-94, 193-201`. This is the literal embodiment of PROFILE.md success criterion #3.
- Weighted lesson picker biases toward gaps without collapsing variety: weak+due = 5×, either = 3×, neither = 1× — `js/app/09-stats-cheatsheet-mock.js:733-743`. Encodes the PROFILE.md L66-69 "use recent diagnostic signal to bias the pick" directive without sacrificing interleaving.
- Personal-best trend chip + Mock Replay Reel surface the success criterion ("PBs trend down over weeks") directly on the L3 tab — `js/app/12c-l3.js:100-123`.

## Weaknesses
- Single-lesson session (one pattern per mock) means no within-session interleaving — `js/app/09-stats-cheatsheet-mock.js:670-684`. A real interview is also single-problem so this is faithful, but it caps the interleaving score.
- Feedback on a failed mock is "✗ end interview, no PB recorded" — no automatic post-mortem prompt about which canonical step broke down — `js/app/09-stats-cheatsheet-mock.js:685-707`. Mistake Tagging Postmortem (iter 58) is L1-only; mock failures don't get a structured retrospective.

## Salvage path (if IMPROVE)
N/A — KEEP ship-quality.

## Removal path (if REMOVE)
N/A.

## Action log
- 2026-05-30 Scored at 19/21 by `/eval-learning-tool --all`.
- 2026-05-30 Re-scored at 19/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/). No regression; line numbers in `js/app/12c-l3.js` shifted slightly (~1 line) due to neighboring edits but all dim evidence holds.
