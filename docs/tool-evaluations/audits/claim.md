# 📐 Claim — Learning-effectiveness audit

**Total: 15/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/07-drills-swap-speedrun.js:232` (`startClaimSession`)
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | User must commit "correct/wrong" before reveal — 2-tap forced choice, no peek path (`07-drills-swap-speedrun.js:260-263, 273-277`). |
| Encoding strength | 1/3 | Binary recognition (correct/wrong on a pre-stated claim) — no free production of the actual complexity (`07-drills-swap-speedrun.js:259-262`). |
| Spacing | 2/3 | NEW (commit `f466c37`): on win, calls `scheduleReview(card.lessonId, { advance: false })` guarded by `state.reviews[id] && isDueForReview(id)` — hold-but-reset-dueAt semantics (`07-drills-swap-speedrun.js:285-287`). SR cycle keeps moving on a recognition-tier win without falsely advancing the bucket. Not 3 because the surface only triggers SR on mastered+due lessons — never seeds a new SR entry from a Claim win alone. |
| Interleaving | 1/3 | Deck samples from `Object.keys(CLAIMS)` which is a curated subset of authored complexity-claim entries (`07-drills-swap-speedrun.js:201-213`); breadth bounded by the registry's authored size, not the lesson corpus. |
| Feedback quality | 2/3 | Reveal shows the ACTUAL complexity plus a 1-line `note` from the registry (`07-drills-swap-speedrun.js:300-301`); explanation is concise but consistent across right/wrong. |
| Transfer-context match | 3/3 | Shows the L3 canonical + a stated complexity, asks "does this match?" — exactly the interview reflex graded at the end of every problem (`07-drills-swap-speedrun.js:257-262`). |
| Closed-loop signal use | 3/3 | Misses flag `state.weakness[lessonId]++` and `appendHistory(...,'L1-miss')`; wins update lifetime + the new SR refresh — full dual-direction signal channel (`07-drills-swap-speedrun.js:285-291`). |

## Strengths
- High transfer fidelity — claim-on-canonical is the closest mobile drill to the actual interview wrap-up moment.
- Closed-loop on both wins and misses; the `state.weakness` write reroutes the user back to the source lesson via existing sidebar surfaces (`07-drills-swap-speedrun.js:288`).
- Per-card SR refresh on win now keeps mastered+due Patterns lessons from rotting in the spaced-rep queue while the user is grinding the Claim drill (`07-drills-swap-speedrun.js:285-287`).

## Weaknesses
- Coverage bottleneck: dependent on a hand-curated `data/complexity-claims.json` registry (`07-drills-swap-speedrun.js:191`); interleaving breadth is capped by authoring throughput, not the corpus.
- Encoding stays at recognition (binary forced choice) — the higher-fidelity recall ("name the actual complexity") is reserved for the reveal, not asked of the user.
- SR write is hold-but-reset-dueAt only — recognition-tier wins never advance the bucket, so the Claim drill can't carry an SR cycle on its own; depends on L2/L3 wins for actual interval growth.

## Salvage path (if IMPROVE)
1. **Auto-generate distractors algorithmically** — derive `distractor` from `actual` via canonical transforms (O(N) ↔ O(N²), O(N log N) ↔ O(N), O(N) ↔ O(1)) inside `_claimBuildDeck` (`07-drills-swap-speedrun.js:199`). Lifts **Interleaving 1→3** (every patterns lesson with L3.canonical becomes drillable, decoupled from the curated registry).
2. **Optional "name the complexity" tier** — gated input box that asks the user to TYPE the actual complexity after the 2-tap. Lifts **Encoding strength 1→2**.

**Projected after salvage:** 18/21 (KEEP, ship-quality). Salvage moves +3 pts.

## Action log
- 2026-05-30 Scored at 13/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 2 applied — guarded SR write on win at `js/app/07-drills-swap-speedrun.js:235-247`. Mirrors L2's hold-but-reset-dueAt pattern; only fires when `state.reviews[id]` exists AND `isDueForReview(id)` returns true. Projected 13→15 (+2 Spacing). Algorithmic distractors (+2 Interleaving) and typed "name the complexity" mode (+1 Encoding) are larger Phase 3-class follow-ups, deferred. Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 15/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
