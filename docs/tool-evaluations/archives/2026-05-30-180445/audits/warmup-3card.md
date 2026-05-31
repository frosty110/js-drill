# 3-Card Warmup — Learning-effectiveness audit

**Total: 15/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/07-drills-swap-speedrun.js:874`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 2/3 | MC tap on L1 question, options always visible — `js/app/07-drills-swap-speedrun.js:915` (`<button class="warmup-opt" ...>`). Recognition-tier. No reveal-after-attempt; the options are the prompt. Same MC-not-free-recall ceiling as Rapid-Fire. |
| Encoding strength | 1/3 | Pure MC: see L1 question, tap A/B/C/D. `:914-916`. No typing, no production. Familiarity / recognition recall direction. |
| Spacing | 3/3 | Deck is built from `dailyPlan()` — `js/app/07-drills-swap-speedrun.js:840` (`const plan = dailyPlan().slice(0, WARMUP_DECK_LEN)`). `dailyPlan()` mixes `dueReviewIds().slice(0,3)` (SR-due) + `topWeakLessonId()` (weakness) + starter-path-next — `js/app/09-stats-cheatsheet-mock.js:644-668`. This is the cleanest SR-integrated selection in the app: SR `dueAt`, weakness, and path all consulted. |
| Interleaving | 2/3 | Three cards mix three reason buckets (review-due / weak-spot / next-on-plan) and are likely from three different lessons/sections — `js/app/07-drills-swap-speedrun.js:849-870, 911` (the `why` color-tag splits the three streams visually). Not 3 because deck length is hard-coded to 3 (`:838 WARMUP_DECK_LEN = 3`) — small N caps cross-topic mixing vs Rapid-Fire's 20. |
| Feedback quality | 2/3 | Correct: `✓ Got it`; wrong: shows correct option highlighted + lesson's authored `explain` if present, else fallback "Routed to weak spots" — `js/app/07-drills-swap-speedrun.js:945-951`. Same one-line + correct-reveal level as Rapid-Fire. Not 3 because `explain` is optional and the fallback is just a routing notice, not an explanation. |
| Transfer-context match | 1/3 | Mobile MC card stack — sentence cue + 4 options — `:910-916`. Not blank-editor, not problem-prompt-and-code. Interview context per PROFILE.md is blank editor; this is a triage micro-session. Hits the "20 free minutes → drilling" friction goal (`:829-834`) but doesn't match the interview-retrieval context. |
| Closed-loop signal use | 2/3 | Wins are NOT recorded as concept-grain signal (no `appendHistory` on correct, no per-lesson rapid-style stats); session-level lifetime `state.warmup.sessions/completions/lastRunAt` increments only — `js/app/07-drills-swap-speedrun.js:880-881, 889`. Misses DO flip `state.weakness[card.lessonId]++` + `appendHistory(card.lessonId, 'L1-miss')` — `:938-941`. Misses-only at the lesson grain = 2. (Hattie & Wiliam: closing the loop on misses but not wins). |

## Strengths
- **Best SR integration in the app** — only surface that consumes `dueReviewIds()` + `topWeakLessonId()` + starter-path-next as a unified picker via `dailyPlan()` — `js/app/07-drills-swap-speedrun.js:840` + `js/app/09-stats-cheatsheet-mock.js:644-668`.
- Mobile-first one-tap-to-start path serves PROFILE.md L69 "friction between '20 free minutes' and 'I'm drilling' is near zero" — `:874-882` (no lesson-pick step; sidebar button → deck → first card).
- Why-tag color split (`'review due'` cyan / `'weak spot'` orange / `'next on plan'` blue — `:885, 911`) gives the user metacognitive context for each card without requiring a navigation step.

## Weaknesses
- Hard-coded deck-len 3 (`:838`) caps total recall reps per session — by the time the user is warm, the session is over.
- Wins don't append `appendHistory(_, 'L1-pass')` and don't decay `state.weakness[card.lessonId]` — `:932-942`. A correct answer on a previously-weak lesson is silent in the SR signal. Session-level `state.warmup.completions` is a vanity counter, not learner-state.
- Pure MC at the L1 grain — same recognition ceiling as Rapid-Fire — `:914-916`.

## Salvage path (if IMPROVE)
1. **On correct answer, `appendHistory(card.lessonId, 'L1-pass')` and decay weakness** — `js/app/07-drills-swap-speedrun.js:934-936` — currently only `correct++` runs on the pass branch; mirror the miss branch's history call so wins feed downstream surfaces and a previously-weak lesson can be demoted out of `state.weakness`. Lifts **Closed-loop signal use** by +1 (2→3) — wins AND misses now feed.
2. **Add a typed-recall variant for "next on plan" cards** — first card of any new lesson in the deck shows the question with a small text input instead of MC, accepting any of the option strings as substring match. The two other cards remain MC. Lifts **Encoding strength** by +1 (1→2) — cued recall typed fill-in on a third of cards.

**Projected after salvage:** 17/21.

## Removal path (if REMOVE)
N/A — KEEP.

## Action log
- 2026-05-30 Scored at 15/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 1 applied — wins now feed concept-grain signal at `js/app/07-drills-swap-speedrun.js:1057-1068`. On correct: `appendHistory(card.lessonId, 'L1-pass')` + manual weakness decrement (not `clearWeakness()` which deletes outright — decrement preserves long-standing weakness across a single win, eroding only on steady wins per CLAUDE.md intent). Projected 15→16 (+1 Closed-loop). Typed-recall variant for next-on-plan cards (+1 Encoding) is a larger UX change, deferred. Validator: 810 passed, 0 failed.
