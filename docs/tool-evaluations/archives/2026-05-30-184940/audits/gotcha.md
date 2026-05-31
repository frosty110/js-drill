# 🎰 Gotcha — Learning-effectiveness audit

**Total: 17/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/05-drills-recognize-trace.js:286` (`startCruxSession`, aliased as `startGotchaSession` at :318)
**Scored:** 2026-05-30

> **NOTE — tool has been substantially transformed since prior audit.** The original honor-system "knew it / didn't" cloze-of-a-note tool (`reference.notes` corpus, audit 12/21) was rebuilt as **🎯 Crux** (iter 83+) — a forced-recall test over the authored `reference.crux` field with TWO modes (Easy = 4-option MC over hybrid distractors; Hard = free-recall typed answer + AI-grading copy-export + honest self-grade). The `state.gotcha` schema is reused, the registry row still says "🎰 Gotcha", and `startGotchaSession` is preserved as a back-compat alias (`:318`). Scoring the CURRENT implementation per task instructions.

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | Easy mode forces a 4-option pick BEFORE any reveal — no peek path (`05-drills-recognize-trace.js:399-405`). Hard mode requires typing into a textarea, then revealing (`05-drills-recognize-trace.js:430, 448-460`). Both modes are real retrieval moments, not honor-system. |
| Encoding strength | 2/3 | Mixed: Easy mode is recognition (4 MC); Hard mode is free production (type the trick from memory, `05-drills-recognize-trace.js:430`). User picks mode at session start (`:300-309`). Hard mode hits Bjork's free-production tier — 2/3 reflects that Easy is still the default-presented option and pure MC; bumping to 3 would require Hard being the default. |
| Spacing | 2/3 | NEW (commit `0c518ea`): on win, `grade()` calls `scheduleReview(card.lessonId, { advance: false })` guarded by `state.reviews[id] && isDueForReview(id)` — hold-but-reset-dueAt (`05-drills-recognize-trace.js:336-340`). Plus `_runCruxDeck` uses `_srPriorityShuffle(pool, p => p.lessonId)` so overdue/weak lessons surface first in deck-build (`:323-325`). Both selection-AND-write integrate the SR scheduler. Not 3 because the SR write is hold-only — never seeds a new bucket from a Crux win. |
| Interleaving | 3/3 | Pool spans every loaded patterns + applied lesson with an authored `reference.crux` (`:208-209, 218-232`); `_runCruxDeck` further sorts via `_srPriorityShuffle` and slices to 8 (`:323-325`). Eight cards across the full Patterns/Applied corpus is solidly cross-section interleaved. |
| Feedback quality | 2/3 | Reveal shows the canonical crux + source lesson title + "Drill this lesson →" deep-link (`:351-362`). Easy mode adds verdict line; Hard mode adds self-grade buttons (`:454-460`). 1-line reveal of the canonical trick is contrast against the user's pick/type, but no per-distractor explanation of WHY the wrong MC was wrong. 2/3 for one-line corrective; 3/3 would require per-distractor "why this one was tempting" annotations. |
| Transfer-context match | 2/3 | Cue is the L3 problem prompt itself (`card.prompt = lesson.L3.prompt`, `:226`); user recalls the load-bearing insight given an interview-shaped problem statement. Hard mode's typed-recall closely matches the interview "talk through your approach" beat. 2 (not 3) because the surface tests the INSIGHT, not the CODE — the interview wants code production, not insight-naming, even though insight-naming precedes coding. |
| Closed-loop signal use | 3/3 | `grade()` is shared between Easy and Hard modes (`:333-348`): wins fire SR refresh; misses flag `state.weakness[lessonId]++` AND `appendHistory(...,'L1-miss')`. Both lifetime `state.gotcha` stats (attempts/correct) and the SR/weakness signals fire on both branches. |

## Strengths
- Free-recall Hard mode + AI-grading clipboard export is the deepest retrieval surface in any drill (`:430-446`); user TYPES the insight, then exports `{problem + answer + canonical}` to ChatGPT/Claude for adjudication. Bjork's desirable-difficulty + closed-feedback-loop in one path.
- Hybrid distractors in Easy mode pull from OTHER lessons' real cruxes (same section preferred) so every wrong option is a real interview-grade trick — believable by construction (`:240-255`).
- SR-priority deck shuffle + per-win SR refresh + miss-feeds-weakness gives full closed-loop signal use across both modes.

## Weaknesses
- Easy is the default-presented mode (top button in the picker, `:301-304`) and most users will pick it; the deeper-encoding Hard mode is opt-in. Median user gets MC-only.
- No per-distractor "why this wrong answer was tempting" feedback — the reveal shows the right answer but the user has to infer why their MC pick was a distractor.
- Self-grade in Hard mode is honor-based (`:457-458`) — the AI-grading export path exists but requires the user to round-trip through a separate tool; no in-app grading.

## Salvage path (if IMPROVE)
1. **Add per-distractor "why this was tempting" annotations** — extend `reference.cruxDistractors` schema from `string[]` to `{text, why}[]`; on miss, the reveal panel shows the user's wrong pick + its `why` string. Lifts **Feedback quality 2→3**.
2. **Default to Hard mode for repeat users** — track `state.gotcha.hardModeRuns`; once ≥3, swap the picker order so Hard becomes the top button. Lifts **Encoding strength 2→3** (median user now does free production).
3. **Local heuristic grader for Hard mode** — token-set Jaccard between user answer and `card.crux`; if ≥0.4 → auto-pass without requiring AI round-trip. Lifts **Feedback quality** further by removing the external-tool dependency on Hard wins.

**Projected after salvage:** 19/21 (KEEP, ship-quality). Salvage moves +2 pts.

## Action log
- 2026-05-30 Scored at 12/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 2 applied — guarded SR write on "knew it" at `js/app/05-drills-recognize-trace.js:263-278`. Mirrors L2's hold-but-reset-dueAt pattern; only fires when `state.reviews[id]` exists AND `isDueForReview(id)` returns true. Projected 12→14 (+2 Spacing). Cloze-deletion conversion (+2 Active recall +2 Encoding) and per-note "why" feedback (+1 Feedback) are larger Phase 3-class follow-ups, deferred. Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 17/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/). Tool was substantially rebuilt as 🎯 Crux since prior audit — forced-recall MC + free-recall typed modes replaced the honor-system cloze. Active recall 2→3, Encoding 1→2, Interleaving 3→3, Transfer 1→2, plus Spacing already lifted by SR-priority deck shuffle + per-win SR refresh in `grade()`.
