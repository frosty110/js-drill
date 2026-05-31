# 📐 Claim — Learning-effectiveness audit

**Total: 13/21**
**Verdict: IMPROVE-or-cut (salvage must move ≥4 pts or REMOVE)**
**Anchor file:** `js/app/07-drills-swap-speedrun.js:189`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | User must commit "correct/wrong" before reveal — 2-tap forced choice, no peek path (`07-drills-swap-speedrun.js:217-220`). |
| Encoding strength | 1/3 | Binary recognition (correct/wrong on a pre-stated claim) — no free production of the actual complexity (`07-drills-swap-speedrun.js:216-220`). |
| Spacing | 0/3 | `state.claim` only tracks attempts/correct/sessions/lastRunAt (`01-state-content.js:219`); no per-card interval; no SR write. |
| Interleaving | 1/3 | Deck samples from `Object.keys(CLAIMS)` which is a curated subset, not the full curriculum (`07-drills-swap-speedrun.js:158-170`); breadth bounded by the registry's authored size, not the lesson corpus. |
| Feedback quality | 2/3 | Reveal shows the ACTUAL complexity plus a 1-line `note` from the registry (`07-drills-swap-speedrun.js:248-249`); explanation is concise but consistent across right/wrong. |
| Transfer-context match | 3/3 | Shows the L3 canonical + a stated complexity, asks "does this match?" — exactly the interview reflex graded at the end of every problem (`07-drills-swap-speedrun.js:214-216`). |
| Closed-loop signal use | 3/3 | Misses flag `state.weakness[lessonId]++` and `appendHistory(...,'L1-miss')`; wins update lifetime — same dual-direction channel as L1 (`07-drills-swap-speedrun.js:236-238`). |

## Strengths
- High transfer fidelity — claim-on-canonical is the closest mobile drill to the actual interview wrap-up moment.
- Closed-loop on both wins and misses; the `state.weakness` write reroutes the user back to the source lesson via existing sidebar surfaces (`07-drills-swap-speedrun.js:236`).
- Auto-advance after 2.4s keeps the mobile-card cadence tight (`07-drills-swap-speedrun.js:251`).

## Weaknesses
- Coverage bottleneck: dependent on a hand-curated `data/complexity-claims.json` registry (`07-drills-swap-speedrun.js:148`); interleaving breadth is capped by authoring throughput, not the corpus.
- No spacing — `state.claim` is lifetime counters only; a card the user just bombed can reappear next session at the same random rate.
- Encoding stays at recognition (binary forced choice) — the higher-fidelity recall ("name the actual complexity") is reserved for the reveal, not asked of the user.

## Salvage path (if IMPROVE)
1. **Auto-generate distractors algorithmically** — derive `distractor` from `actual` via canonical transforms (O(N) ↔ O(N²), O(N log N) ↔ O(N), O(N) ↔ O(1)) inside `_claimBuildDeck` (`07-drills-swap-speedrun.js:156`). Lifts **Interleaving 1→3** (every patterns lesson with L3.canonical becomes drillable, decoupled from the curated registry).
2. **Add per-card SR write on win** — on `wasRight`, call `scheduleReview(card.lessonId, { advance: false })` (real function at `js/app/04-progress-sr.js:431`) in `07-drills-swap-speedrun.js:238`. Uses L2's hold-but-reset-dueAt semantics — drill is recognition-tier (binary forced choice), shallower than L2, so it should keep the SR cycle moving without falsely advancing the bucket. Lifts **Spacing 0→2** at lesson-grain.
3. **Optional "name the complexity" tier** — gated input box that asks the user to TYPE the actual complexity after the 2-tap. Lifts **Encoding strength 1→2**.

**Projected after salvage:** 18/21 (KEEP, ship-quality). Salvage moves +5 pts — clears the IMPROVE threshold.

## Action log
- 2026-05-30 Scored at 13/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 2 applied — guarded SR write on win at `js/app/07-drills-swap-speedrun.js:235-247`. Mirrors L2's hold-but-reset-dueAt pattern; only fires when `state.reviews[id]` exists AND `isDueForReview(id)` returns true. Projected 13→15 (+2 Spacing). Algorithmic distractors (+2 Interleaving) and typed "name the complexity" mode (+1 Encoding) are larger Phase 3-class follow-ups, deferred. Validator: 810 passed, 0 failed.
