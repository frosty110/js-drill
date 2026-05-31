# 🔮 Predict — Learning-effectiveness audit

**Total: 16/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/07-drills-swap-speedrun.js:351`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | User must pick the output BEFORE any reveal (`07-drills-swap-speedrun.js:447-481`); no peek path; click commits the attempt. |
| Encoding strength | 1/3 | 4-option MC over expectedOutput strings — recognition, not free production (`07-drills-swap-speedrun.js:436-438`); user picks from 4 prepared options vs. typing/producing the output. |
| Spacing | 2/3 | `js/app/07-drills-swap-speedrun.js:454-465` — on `wasCorrect`, when `state.reviews[card.lessonId] && isDueForReview(card.lessonId)`, the handler calls `scheduleReview(card.lessonId, { advance: false })`. Hold-but-reset-dueAt SR semantics — mirrors L2 pattern in `markPassed()` (slice 09:791). A recognition-tier win on a mastered+due lesson resets the dueAt without advancing the bucket (since Predict is shallower than L2 cued-recall). The guard prevents seeding SR on a non-mastered lesson or pushing dueAt out on a not-yet-due one. Per-card SR write present but lesson-grain not card-grain; 2 is the honest call (per-item history feeds scheduling; no per-card interval logic). |
| Interleaving | 2/3 | Deck samples across ALL Patterns lessons via `CURRICULUM.filter(l => l.track === 'patterns')` (`07-drills-swap-speedrun.js:352`) — broad cross-lesson mixing but restricted to one track. (Applied lessons could be added analogously to Reverse's salvage; not yet.) |
| Feedback quality | 1/3 | Correct-output is highlighted and the wrong pick is X'd (`07-drills-swap-speedrun.js:470-478`); a 1-line "Was X" reveal but no per-output explanation of WHY the code produces that output. |
| Transfer-context match | 3/3 | Show real canonical L3 code + ask "what does it produce" — the interview "trace through this" reflex; mobile-first card layout (`07-drills-swap-speedrun.js:432-441`). |
| Closed-loop signal use | 3/3 | Wins now write SR (`07-drills-swap-speedrun.js:463-465`) AND increment lifetime `state.crystal.correct` (`:468`); misses write `state.weakness[lessonId]++` and `appendHistory(lessonId, 'L1-miss')` (`:466`). Wins-feed-SR was the missing piece; now both win-and-miss outcomes drive the broader autopilot. Lifts to 3 (was 2). |

## Strengths
- Pure-recombination engine: no per-lesson authoring, scales with the patterns corpus (`07-drills-swap-speedrun.js:351-403`).
- Same-type distractor selection (`_crystalOutputType`) prevents trivial type-mismatch wins (`07-drills-swap-speedrun.js:339-348`).
- Wins now feed SR (`:454-465`) guarded by `state.reviews[id] && isDueForReview(id)` — first recognition-tier drill to push the SR cycle forward on success without falsely advancing the bucket. Pattern is reusable (Claim already mirrors it at `:280-288`).
- Closes the loop on misses via the same `state.weakness` channel used by L1 — automatically resurfaces lessons (`07-drills-swap-speedrun.js:466`).

## Weaknesses
- Card pick is still random shuffle (`:376`) — no SR/weakness weighting at deck-build time. Unlike Reverse/Recognize/Notes-Drill/Trace-Hop (which now use `_srPriorityShuffle`), Predict picks cards uniformly even though the win-side now writes SR. So cards from weak/overdue lessons don't surface preferentially.
- 4-option MC compresses the recall direction below L2's typed-fill — for a "mental execution" drill, free-typing the expected output would lift encoding from recognition to cued recall.
- Feedback is "was X" only; no per-option explanation of WHY (so a wrong pick reveals the right answer but doesn't correct the user's mental model).

## Salvage path (if IMPROVE)
Ordered by leverage. Each edit names file:line + dim it lifts.
1. **SR-weighted deck pick** — `07-drills-swap-speedrun.js:376` — replace `pool.slice().sort(() => Math.random() - 0.5)` with `_srPriorityShuffle(pool, p => p.lessonId)` (helper at `js/app/04-progress-sr.js:483`). Brings Predict in line with the other recognition drills; lifts Spacing toward 3 by surfacing weak/overdue patterns preferentially.
2. **Toggle to "type the output" mode** — add a state flag (`state.crystal.typed`) and an alternate render path that swaps the 4-button grid for a single text input compared against `card.correct`. Lifts **Encoding strength 1→3** (free production from a code cue).
3. **Per-option explain on the canonical** — attach `explainByOption: {output: oneLineWhy}` to deck cards built by mining the L3 hints/notes already in CONTENT. Lifts **Feedback quality 1→2**.

**Projected after salvage:** 19/21 (KEEP, ship-quality).

## Action log
- 2026-05-30 Scored at 14/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 1 applied — SR write on win at `js/app/07-drills-swap-speedrun.js:402-415` via `scheduleReview(card.lessonId, { advance: false })`. **Guarded** to `state.reviews[id] && isDueForReview(id)` (mirrors `markPassed`'s L2 pattern at slice 09:791) so a recognition win can't seed SR on a non-mastered lesson or extend dueAt on a not-yet-due lesson. Projected 14→16 (+2 Spacing). Typed-output mode and per-option explain deferred to Phase 3-class follow-ups. Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 16/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
