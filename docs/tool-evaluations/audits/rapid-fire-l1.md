# Rapid-Fire L1 — Learning-effectiveness audit

**Total: 16/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/07-drills-swap-speedrun.js:665`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 2/3 | Multiple-choice tap is recognition, not free recall — `js/app/07-drills-swap-speedrun.js:721` (`<button class="rapid-opt" ...>`). Mitigated by the 7-sec soft timer (`:631` `RAPID_FIRE_TIMER_MS = 7000`, `:782-793`) which forces retrieval-under-pressure rather than scan-the-options recognition. Still MC at heart → 2, not 3. |
| Encoding strength | 1/3 | Pure MC — 4 options visible, pick one. `:720-722`. No typing, no free production. Recognition-tier per Bjork. |
| Spacing | 1/3 | Deck-build is uniform random across all `full`-status lessons that have L1 questions — Fisher-Yates shuffle over the pool — `js/app/07-drills-swap-speedrun.js:632-662`. Does NOT consult `state.reviews` dueAt or `state.weakness` for selection weighting. Misses DO flip `state.weakness` (`:757`) so downstream SR consumes the signal, but the rapid surface itself doesn't re-weight selection. |
| Interleaving | 3/3 | Deck is sampled across **syntax + patterns + applied** tracks (`js/app/07-drills-swap-speedrun.js:669-672` `for (const track of ['syntax', 'patterns', 'applied'])`) and Fisher-Yates shuffled before slicing 20 — `:658-662`. Maximally interleaved by design: every card likely belongs to a different lesson and section. Hits Rohrer & Taylor textbook spec. |
| Feedback quality | 2/3 | Correct: `✓ +1 streak` (`:772`). Wrong: shows correct answer highlighted + the lesson's authored `explain` string if present, else fallback "Streak reset" (`:767-773`). One-line explanation when authored; correct-answer reveal always. Not 3 because explanations are reused from L1 (which itself is rated, not always present); when `q.explain` is missing the wrong feedback is just "Streak reset." |
| Transfer-context match | 1/3 | Sentence-cue + 4 MC options — not blank-editor, not problem-prompt. The "interview" context per PROFILE.md is blank editor + time pressure on a coding problem. Rapid-Fire has the time-pressure half (7s timer, throughput score `:812`) but the surface is concept MC, not code production. Tulving-style context match is weak. |
| Closed-loop signal use | 3/3 | Wins increment `state.rapidFire.correct/attempts/bestStreak` (`:760-761, 803-805`). Misses flip `state.weakness[card.lessonId]++` (`:757`) AND append `appendHistory(card.lessonId, 'L1-miss')` (`:758`) — same signal path as in-lesson L1 miss. Session result reports slowest-3 as a weak-spot diagnostic (`:802, 813`). Wins + misses + per-card timing all persist and feed downstream surfaces. |

## Strengths
- **Best interleaving in the app** — sessions span syntax/patterns/applied randomly, hitting Rohrer & Taylor cross-topic mixing better than any other drill — `js/app/07-drills-swap-speedrun.js:669-672`.
- Closes the loop on misses cleanly: `state.weakness` + `appendHistory` + lifetime `rapidFire` stats all written in the grade path — `:757-764`.
- 7-sec soft timer + streak counter create exactly the mobile-tap-throughput surface PROFILE.md L30-31 calls out as the highest-density recall modality — `:631, 782-793`.

## Weaknesses
- Recognition-tier (MC) drilling means encoding strength is structurally low — `:720-722`. The user can scan options instead of retrieving.
- Selection is uniform random across all loaded lessons — `:658-662`. Does not consult `state.reviews.dueAt` or `state.weakness` to weight the deck toward due/weak lessons. A lesson the user just nailed yesterday gets the same odds as one they bombed last week.

## Salvage path (if IMPROVE)
1. **Weight the deck by `state.reviews.dueAt` + `state.weakness`** — `js/app/07-drills-swap-speedrun.js:635-662` — mirror the `_pickMockLessonId` weighting (`js/app/09-stats-cheatsheet-mock.js:733-743`): per-lesson weight = `(weak && due) ? 5 : (weak || due) ? 3 : 1`; expand pool by weight then Fisher-Yates. Lifts **Spacing** by +2 (1→3) — re-weights selection from SR signal.
2. **Add a free-recall variant on streak ≥10** — show only the lesson title + question, hide MC options for 3 seconds, then reveal options (countdown bar already exists at `:717`). Half the cards become typed/spoken-then-confirm cued recall. Lifts **Encoding strength** by +1 (1→2) — cued recall during the hide window.

**Projected after salvage:** 19/21.

## Removal path (if REMOVE)
N/A — KEEP.

## Action log
- 2026-05-30 Scored at 16/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 1 applied — SR/weakness-weighted deck at `js/app/07-drills-swap-speedrun.js:754-783`. Per-lesson weight = `(weak && due) ? 5 : (weak || due) ? 3 : 1`; expand pool by weight, Fisher-Yates, then dedup-while-slicing to 20-card session. Cold-start users degrade to uniform. Projected 16→18 (+2 Spacing). Free-recall variant on streak ≥10 (+1 Encoding) is a bigger UX change, deferred. Validator: 810 passed, 0 failed.
