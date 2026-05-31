# Rapid-Fire L1 — Learning-effectiveness audit

**Total: 18/21**
**Verdict: KEEP, ship-quality**
**Anchor file:** `js/app/07-drills-swap-speedrun.js:788` (`startRapidFireSession`)
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 2/3 | Multiple-choice tap is recognition, not free recall — `js/app/07-drills-swap-speedrun.js:844` (`<button class="rapid-opt" ...>`). Mitigated by the 7-sec soft timer (`:729` `RAPID_FIRE_TIMER_MS = 7000`, `:904-915`) which forces retrieval-under-pressure rather than scan-the-options recognition. Still MC at heart → 2, not 3. |
| Encoding strength | 1/3 | Pure MC — 4 options visible, pick one. `:843-844`. No typing, no free production. Recognition-tier per Bjork. |
| Spacing | 3/3 | NEW (commit `5c44495`): `_rapidFireBuildDeck` is SR/weakness-weighted. Per-lesson weight = `(weak && due) ? 5 : (weak || due) ? 3 : 1`; the pool expands each item by its weight, Fisher-Yates shuffles, then dedup-while-slicing to 20 — `js/app/07-drills-swap-speedrun.js:754-783`. Cold-start users (no SR/weakness signal yet) degrade to uniform random because every lesson has weight 1. Misses still flip `state.weakness` (`:880`) so downstream SR consumes the signal too. Full integration with the SR scheduler at the selection layer. |
| Interleaving | 3/3 | Deck is sampled across **syntax + patterns + applied** tracks (`js/app/07-drills-swap-speedrun.js:792-794` `for (const track of ['syntax', 'patterns', 'applied'])`) and the new weighted/Fisher-Yates path preserves cross-track mixing — `:762-785`. Maximally interleaved by design: every card likely belongs to a different lesson and section. Hits Rohrer & Taylor textbook spec. |
| Feedback quality | 2/3 | Correct: `✓ +1 streak` (`:895`). Wrong: shows correct answer highlighted + the lesson's authored `explain` string if present, else fallback "Streak reset" (`:892-896`). One-line explanation when authored; correct-answer reveal always. Not 3 because explanations are reused from L1 (which itself is rated, not always present); when `q.explain` is missing the wrong feedback is just "Streak reset." |
| Transfer-context match | 1/3 | Sentence-cue + 4 MC options — not blank-editor, not problem-prompt. The "interview" context per PROFILE.md is blank editor + time pressure on a coding problem. Rapid-Fire has the time-pressure half (7s timer, throughput score `:935`) but the surface is concept MC, not code production. Tulving-style context match is weak. |
| Closed-loop signal use | 3/3 | Wins increment `state.rapidFire.correct/attempts/bestStreak` (`:883-884, 926`). Misses flip `state.weakness[card.lessonId]++` (`:880`) AND append `appendHistory(card.lessonId, 'L1-miss')` (`:881`) — same signal path as in-lesson L1 miss. Session result reports slowest-3 as a weak-spot diagnostic (`:925, 936`). Wins + misses + per-card timing all persist and feed downstream surfaces. Selection ALSO consumes the SR signal now (`:762-768`), closing the loop in both directions. |

## Strengths
- **Best interleaving in the app** — sessions span syntax/patterns/applied randomly, hitting Rohrer & Taylor cross-topic mixing better than any other drill — `js/app/07-drills-swap-speedrun.js:792-794`.
- **Now full SR-integrated selection** — weighted deck pulls overdue + weak lessons 3–5× more often than rested ones (`:754-783`); previously a uniform random surface, now a real spacing tool.
- 7-sec soft timer + streak counter create exactly the mobile-tap-throughput surface PROFILE.md L30-31 calls out as the highest-density recall modality — `:729, 904-915`.

## Weaknesses
- Recognition-tier (MC) drilling means encoding strength is structurally low — `:843-844`. The user can scan options instead of retrieving.
- Transfer match still capped — concept MC isn't blank-editor coding; the bridge to interview retrieval is via the missed lessons routing through `state.weakness` into mock/L3 paths, not direct.

## Salvage path (if IMPROVE)
1. **Add a free-recall variant on streak ≥10** — show only the lesson title + question, hide MC options for 3 seconds, then reveal options (countdown bar already exists at `:840`). Half the cards become typed/spoken-then-confirm cued recall. Lifts **Encoding strength** by +1 (1→2) — cued recall during the hide window.

**Projected after salvage:** 19/21 (KEEP, ship-quality). Salvage moves +1 pt.

## Removal path (if REMOVE)
N/A — KEEP.

## Action log
- 2026-05-30 Scored at 16/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 1 applied — SR/weakness-weighted deck at `js/app/07-drills-swap-speedrun.js:754-783`. Per-lesson weight = `(weak && due) ? 5 : (weak || due) ? 3 : 1`; expand pool by weight, Fisher-Yates, then dedup-while-slicing to 20-card session. Cold-start users degrade to uniform. Projected 16→18 (+2 Spacing). Free-recall variant on streak ≥10 (+1 Encoding) is a bigger UX change, deferred. Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 18/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/). Spacing now 3/3 — weighted-selection lift fully realized; tool clears KEEP threshold.
