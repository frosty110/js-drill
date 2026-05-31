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
| Spacing | 3/3 | Deck is built from `dailyPlan()` — `js/app/07-drills-swap-speedrun.js:995` (`const plan = dailyPlan().slice(0, WARMUP_DECK_LEN)`). `dailyPlan()` now mixes `dueReviewIds().slice(0,3)` (SR-due) + `topWeakLessonId()` (weakness) + `mostRecentTaggedMissLesson()` (recent concept-grain miss via Mistake Tagging, NEW slot inserted between weakness and path) + starter-path-next — `js/app/09-stats-cheatsheet-mock.js:644-676`. This is the cleanest SR-integrated selection in the app: SR `dueAt`, weakness, concept-grain miss tags, and path all consulted. |
| Interleaving | 2/3 | Three cards mix three reason buckets (review-due / weak-spot / next-on-plan) and are likely from three different lessons/sections — `js/app/07-drills-swap-speedrun.js:972, 1034` (the `why` color-tag splits the three streams visually). Not 3 because deck length is hard-coded to 3 (`:961 WARMUP_DECK_LEN = 3`) — small N caps cross-topic mixing vs Rapid-Fire's 20. |
| Feedback quality | 2/3 | Correct: `✓ Got it`; wrong: shows correct option highlighted + lesson's authored `explain` if present, else fallback "Routed to weak spots" — `js/app/07-drills-swap-speedrun.js:1077-1085`. Same one-line + correct-reveal level as Rapid-Fire. Not 3 because `explain` is optional and the fallback is just a routing notice, not an explanation. |
| Transfer-context match | 1/3 | Mobile MC card stack — sentence cue + 4 options — `:1036-1039`. Not blank-editor, not problem-prompt-and-code. Interview context per PROFILE.md is blank editor; this is a triage micro-session. Hits the "20 free minutes → drilling" friction goal (`:997-1006`) but doesn't match the interview-retrieval context. |
| Closed-loop signal use | 3/3 | NEW (commit `61e3d94`): wins now feed concept-grain signal too. On correct: `appendHistory(card.lessonId, 'L1-pass')` + manual weakness decrement (not delete) — `js/app/07-drills-swap-speedrun.js:1057-1069`. Decrement (not `clearWeakness()`) preserves long-standing weakness across a single win, eroding only on steady wins. Misses still flip `state.weakness[card.lessonId]++` + `appendHistory(card.lessonId, 'L1-miss')` — `:1073-1074`. Both directions of the Hattie/Wiliam loop now closed. The `dailyPlan()` upgrade (added `mostRecentTaggedMissLesson()` via `js/app/04-progress-sr.js:888-911`) now ALSO consumes the concept-grain `state.misses` signal as a deck source — broadening the closed-loop *input* side beyond lesson-grain weakness/SR. Already at 3/3; the new bucket strengthens the dimension's coverage without crossing a threshold. |

## Strengths
- **Best SR integration in the app** — only surface that consumes `dueReviewIds()` + `topWeakLessonId()` + `mostRecentTaggedMissLesson()` (concept-grain) + starter-path-next as a unified picker via `dailyPlan()` — `js/app/07-drills-swap-speedrun.js:995` + `js/app/09-stats-cheatsheet-mock.js:644-676`.
- Mobile-first one-tap-to-start path serves PROFILE.md L69 "friction between '20 free minutes' and 'I'm drilling' is near zero" — `:1029-1037` (no lesson-pick step; sidebar button → deck → first card).
- **Wins now feed the closed loop** — a correct answer on a previously-weak lesson erodes weakness and writes `L1-pass` to history; mirrors the in-lesson L1-correct path so the sparkline + at-risk surfaces reflect warmup performance.

## Weaknesses
- Hard-coded deck-len 3 (`:993`) caps total recall reps per session — by the time the user is warm, the session is over. The new tag-miss slot from `dailyPlan()` enriches the input pool to 4 distinct signal types but the deck is still sliced to 3, so the tag-miss slot can displace the starter-path slot rather than extend the session.
- Pure MC at the L1 grain — same recognition ceiling as Rapid-Fire — `:1069-1071`.
- `dailyPlan()` mixes 3 lessons by construction (sliced from a now-richer 4+ source pool); interleaving is capped at 3 — could expand to 5–6 to widen cross-topic mix without breaking the "warmup" framing AND let the new tag-miss slot land alongside path rather than replacing it.
- Minor UX gap: the `colors` map at `:1040` covers only `review due` / `weak spot` / `next on plan` — the new `recent <tag> miss` why-label falls through to the gray fallback `#94a3b8`. Cosmetic; doesn't affect score.

## Salvage path (if IMPROVE)
1. **Add a typed-recall variant for "next on plan" cards** — first card of any new lesson in the deck shows the question with a small text input instead of MC, accepting any of the option strings as substring match. The two other cards remain MC. Lifts **Encoding strength** by +1 (1→2) — cued recall typed fill-in on a third of cards.
2. **Bump `WARMUP_DECK_LEN` to 5** at `:993` and have `dailyPlan()` return 2 review-due + 1 weak + 1 recent-tag-miss + 1 path lesson. Lifts **Interleaving** by +1 (2→3) — 5 cards across 5 lessons clears the small-N cap AND lets the new tag-miss slot land without displacing the path slot.
3. **Extend `colors` map at `:1040`** to include `recent <tag>` labels (a permissive prefix match → a 4th color, e.g. `#fcd34d`). Cosmetic but reinforces the diagnostic signal distinction. No rubric-dim lift; route via /drill-refine if pursued.

**Projected after salvage:** 18/21 (KEEP, ship-quality). Salvage moves +2 pts.

## Removal path (if REMOVE)
N/A — KEEP.

## Action log
- 2026-05-30 Scored at 15/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 1 applied — wins now feed concept-grain signal at `js/app/07-drills-swap-speedrun.js:1057-1068`. On correct: `appendHistory(card.lessonId, 'L1-pass')` + manual weakness decrement (not `clearWeakness()` which deletes outright — decrement preserves long-standing weakness across a single win, eroding only on steady wins per CLAUDE.md intent). Projected 15→16 (+1 Closed-loop). Typed-recall variant for next-on-plan cards (+1 Encoding) is a larger UX change, deferred. Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 16/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/). Closed-loop now 3/3 — wins + misses both feed `state.weakness` + history; salvage edit 1 fully realized.
- 2026-05-30 Re-scored at 16/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-184940/). `dailyPlan()` extended with a `mostRecentTaggedMissLesson()` slot (via new helper at `js/app/04-progress-sr.js:888-911`) — broadens the warmup's deck-source pool to 4 signal types (SR-due / weakness / recent-tag-miss / starter-path). Score unchanged: Spacing & Closed-loop already 3/3 (the new bucket reinforces them but doesn't cross a threshold), and deck length is still hard-capped at 3, so Interleaving is still 2/3. Salvage path edit 2 updated to also widen `dailyPlan()` allocation to make room for the new bucket without displacing path.
