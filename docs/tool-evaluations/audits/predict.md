# 🔮 Predict — Learning-effectiveness audit

**Total: 14/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/07-drills-swap-speedrun.js:353`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | User must pick the output BEFORE any reveal (`07-drills-swap-speedrun.js:396-411`); no peek path; click commits the attempt. |
| Encoding strength | 1/3 | 4-option MC over expectedOutput strings — recognition, not free production (`07-drills-swap-speedrun.js:385`); user picks from 4 prepared options vs. typing/producing the output. |
| Spacing | 0/3 | No SR integration — `state.crystal` tracks attempts/correct/sessions/lastRunAt only (`01-state-content.js:218`); no per-card `dueAt`, no `state.reviews` write. |
| Interleaving | 2/3 | Deck samples across ALL Patterns lessons via `CURRICULUM.filter(l => l.track === 'patterns')` (`07-drills-swap-speedrun.js:300`) — broad cross-lesson mixing but restricted to one track. |
| Feedback quality | 1/3 | Correct-output is highlighted and the wrong pick is X'd (`07-drills-swap-speedrun.js:407-415`); a 1-line "Was X" reveal but no per-output explanation of WHY the code produces that output. |
| Transfer-context match | 3/3 | Show real canonical L3 code + ask "what does it produce" — the interview "trace through this" reflex; mobile-first card layout (`07-drills-swap-speedrun.js:382-389`). |
| Closed-loop signal use | 2/3 | Misses write `state.weakness[lessonId]++` and `appendHistory(lessonId, 'L1-miss')` (`07-drills-swap-speedrun.js:403`); correct picks update lifetime stats only — no SR-due bump for wins. |

## Strengths
- Pure-recombination engine: no per-lesson authoring, scales with the patterns corpus (`07-drills-swap-speedrun.js:299-351`).
- Same-type distractor selection (`_crystalOutputType`) prevents trivial type-mismatch wins (`07-drills-swap-speedrun.js:287-297`).
- Closes the loop on misses via the same `state.weakness` channel used by L1 — automatically resurfaces lessons (`07-drills-swap-speedrun.js:403`).

## Weaknesses
- No spacing. Hot cards reappear by random shuffle; no per-card interval, no integration with `state.reviews` even though the schema exists (`04-progress-sr.js:104` shows `state.crystal` is just lifetime counters).
- 4-option MC compresses the recall direction below L2's typed-fill — for a "mental execution" drill, free-typing the expected output would lift encoding from recognition to cued recall.
- Feedback is "was X" only; no per-option explanation of WHY (so a wrong pick reveals the right answer but doesn't correct the user's mental model).

## Salvage path (if IMPROVE)
1. **Add SR write on per-card pass** — `07-drills-swap-speedrun.js:405` — when `wasCorrect`, call `scheduleReview(card.lessonId, { advance: false })` (real function at `js/app/04-progress-sr.js:431`). Uses L2's hold-but-reset-dueAt semantics — drill is 4-MC recognition, shallower than L2 cued-recall, so it should keep the SR cycle moving without falsely advancing the bucket. Lifts **Spacing 0→2** (re-uses existing intervals via lesson-grain not card-grain).
2. **Toggle to "type the output" mode** — add a state flag (`state.crystal.typed`) and an alternate render path that swaps the 4-button grid for a single text input compared against `card.correct`. Lifts **Encoding strength 1→3** (free production from a code cue).
3. **Per-option explain on the canonical** — attach `explainByOption: {output: oneLineWhy}` to deck cards built by mining the L3 hints/notes already in CONTENT. Lifts **Feedback quality 1→2**.

**Projected after salvage:** 18/21 (KEEP, ship-quality).

## Action log
- 2026-05-30 Scored at 14/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 1 applied — SR write on win at `js/app/07-drills-swap-speedrun.js:402-415` via `scheduleReview(card.lessonId, { advance: false })`. **Guarded** to `state.reviews[id] && isDueForReview(id)` (mirrors `markPassed`'s L2 pattern at slice 09:791) so a recognition win can't seed SR on a non-mastered lesson or extend dueAt on a not-yet-due lesson. Projected 14→16 (+2 Spacing). Typed-output mode and per-option explain deferred to Phase 3-class follow-ups. Validator: 810 passed, 0 failed.
