# 3-Card Warmup — Learning-effectiveness audit

**Total: 16/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/07-drills-swap-speedrun.js:997` (`startWarmupSession`)
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 2/3 | MC tap on L1 question, options always visible — `js/app/07-drills-swap-speedrun.js:1038` (`<button class="warmup-opt" ...>`). Recognition-tier. No reveal-after-attempt; the options are the prompt. Same MC-not-free-recall ceiling as Rapid-Fire. |
| Encoding strength | 1/3 | Pure MC: see L1 question, tap A/B/C/D. `:1037-1039`. No typing, no production. Familiarity / recognition recall direction. |
| Spacing | 3/3 | Deck is built from `dailyPlan()` — `js/app/07-drills-swap-speedrun.js:963` (`const plan = dailyPlan().slice(0, WARMUP_DECK_LEN)`). `dailyPlan()` mixes `dueReviewIds().slice(0,3)` (SR-due) + `topWeakLessonId()` (weakness) + starter-path-next — `js/app/09-stats-cheatsheet-mock.js:644-668`. This is the cleanest SR-integrated selection in the app: SR `dueAt`, weakness, and path all consulted. |
| Interleaving | 2/3 | Three cards mix three reason buckets (review-due / weak-spot / next-on-plan) and are likely from three different lessons/sections — `js/app/07-drills-swap-speedrun.js:972, 1034` (the `why` color-tag splits the three streams visually). Not 3 because deck length is hard-coded to 3 (`:961 WARMUP_DECK_LEN = 3`) — small N caps cross-topic mixing vs Rapid-Fire's 20. |
| Feedback quality | 2/3 | Correct: `✓ Got it`; wrong: shows correct option highlighted + lesson's authored `explain` if present, else fallback "Routed to weak spots" — `js/app/07-drills-swap-speedrun.js:1077-1085`. Same one-line + correct-reveal level as Rapid-Fire. Not 3 because `explain` is optional and the fallback is just a routing notice, not an explanation. |
| Transfer-context match | 1/3 | Mobile MC card stack — sentence cue + 4 options — `:1036-1039`. Not blank-editor, not problem-prompt-and-code. Interview context per PROFILE.md is blank editor; this is a triage micro-session. Hits the "20 free minutes → drilling" friction goal (`:997-1006`) but doesn't match the interview-retrieval context. |
| Closed-loop signal use | 3/3 | NEW (commit `61e3d94`): wins now feed concept-grain signal too. On correct: `appendHistory(card.lessonId, 'L1-pass')` + manual weakness decrement (not delete) — `js/app/07-drills-swap-speedrun.js:1057-1069`. Decrement (not `clearWeakness()`) preserves long-standing weakness across a single win, eroding only on steady wins. Misses still flip `state.weakness[card.lessonId]++` + `appendHistory(card.lessonId, 'L1-miss')` — `:1073-1074`. Both directions of the Hattie/Wiliam loop now closed. |

## Strengths
- **Best SR integration in the app** — only surface that consumes `dueReviewIds()` + `topWeakLessonId()` + starter-path-next as a unified picker via `dailyPlan()` — `js/app/07-drills-swap-speedrun.js:963` + `js/app/09-stats-cheatsheet-mock.js:644-668`.
- Mobile-first one-tap-to-start path serves PROFILE.md L69 "friction between '20 free minutes' and 'I'm drilling' is near zero" — `:997-1006` (no lesson-pick step; sidebar button → deck → first card).
- **Wins now feed the closed loop** — a correct answer on a previously-weak lesson erodes weakness and writes `L1-pass` to history; mirrors the in-lesson L1-correct path so the sparkline + at-risk surfaces reflect warmup performance.

## Weaknesses
- Hard-coded deck-len 3 (`:961`) caps total recall reps per session — by the time the user is warm, the session is over.
- Pure MC at the L1 grain — same recognition ceiling as Rapid-Fire — `:1037-1039`.
- `dailyPlan()` mixes only 3 lessons by construction; interleaving is capped at 3 — could expand to 5–6 to widen cross-topic mix without breaking the "warmup" framing.

## Salvage path (if IMPROVE)
1. **Add a typed-recall variant for "next on plan" cards** — first card of any new lesson in the deck shows the question with a small text input instead of MC, accepting any of the option strings as substring match. The two other cards remain MC. Lifts **Encoding strength** by +1 (1→2) — cued recall typed fill-in on a third of cards.
2. **Bump `WARMUP_DECK_LEN` to 5** at `:961` and have `dailyPlan()` return 2 review-due + 2 weak + 1 path lessons. Lifts **Interleaving** by +1 (2→3) — 5 cards across 5 lessons clears the small-N cap.

**Projected after salvage:** 18/21 (KEEP, ship-quality). Salvage moves +2 pts.

## Removal path (if REMOVE)
N/A — KEEP.

## Action log
- 2026-05-30 Scored at 15/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 1 applied — wins now feed concept-grain signal at `js/app/07-drills-swap-speedrun.js:1057-1068`. On correct: `appendHistory(card.lessonId, 'L1-pass')` + manual weakness decrement (not `clearWeakness()` which deletes outright — decrement preserves long-standing weakness across a single win, eroding only on steady wins per CLAUDE.md intent). Projected 15→16 (+1 Closed-loop). Typed-recall variant for next-on-plan cards (+1 Encoding) is a larger UX change, deferred. Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 16/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/). Closed-loop now 3/3 — wins + misses both feed `state.weakness` + history; salvage edit 1 fully realized.
