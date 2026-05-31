# 🔀 Swap-Bench — Learning-effectiveness audit

**Total: 17/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/07-drills-swap-speedrun.js:63` (`startSwapBenchSession`)
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | User must commit "same" or "different" before reveal; binary forced choice with no peek path (`07-drills-swap-speedrun.js:97-99, 110-126`). |
| Encoding strength | 1/3 | Binary recognition (same/different on two visible snippets) — no production of the difference, no typing (`07-drills-swap-speedrun.js:97-98`). The relational reasoning is novel but the response surface is MC. |
| Spacing | 3/3 | NEW (commit `33a69be`): per-pair SR. `_swapSchedulePair` doubles interval on win (1d → 2d → 4d → 8d → 16d → 30d cap), resets to 1d on miss (`07-drills-swap-speedrun.js:26-38`). `_swapBuildDeck` is 3-tier: overdue pairs first → fresh/unscheduled → not-overdue tracked, Fisher-Yates within each bucket (`:39-61`). Win/miss handler at `:123` always calls `_swapSchedulePair(card.id, wasRight)`. Schema-additive `state.swapBench.pairs = {}` at `01-state-content.js:221` with load-path backfill at `04-progress-sr.js`. This is now the **only retrieval-kind drill in the app with full per-card SR (not just hold-and-refresh)** — beats Claim/Gotcha/Predict which only refresh existing buckets. |
| Interleaving | 2/3 | Pool is the entire `data/idiom-pairs.json` registry (18 entries as of iter 87), with 3-tier SR-bucket ordering (`07-drills-swap-speedrun.js:39-61`). The new SR-aware bucketing actively spreads the user across due/fresh/later, but the underlying corpus is still small (18 pairs) — a 6-card session covers 33% of the corpus, so within a single week the same pairs recycle. 2 → would lift to 3 with corpus expansion to ≥40 pairs. |
| Feedback quality | 3/3 | Reveal shows the verdict + a per-pair `explain` string sourced from `idiom-pairs.json` (`07-drills-swap-speedrun.js:133-148`); both same- and different-behavior pairs get a 1-2 sentence explanation. Best-in-class feedback of the four MC drills. |
| Transfer-context match | 2/3 | Two real code snippets stacked vertically; user reasons about observable behavior — much closer to interview "is this refactor safe?" than to flashcards (`07-drills-swap-speedrun.js:85-95`). But not a writing task; the user reads pre-made pairs. |
| Closed-loop signal use | 3/3 | Misses flag `state.weakness[sourceLessonId]++` AND `appendHistory(...,'L1-miss')` when a `sourceLessonId` is authored on the pair (`07-drills-swap-speedrun.js:117-120`); wins update lifetime + per-pair SR bucket; misses reset per-pair SR. Full dual-direction signal. |

## Strengths
- Only surface in the app drilling RELATIONAL retrieval ("are these two equivalent?") rather than categorical pick-one (`07-drills-swap-speedrun.js:90` — the "↕ same behavior? ↕" framing).
- High-quality per-pair `explain` strings authored into `data/idiom-pairs.json` — feedback dim is fully realized (`07-drills-swap-speedrun.js:139`).
- **Now the gold standard for SR integration among drills** — per-card buckets, 3-tier overdue/fresh/later ordering, win-doubles / miss-resets — the salvage-path edit 1 fully realized.

## Weaknesses
- 18-pair registry caps interleaving breadth — even with SR-aware bucketing, a steady user will burn through the corpus in under a week. Spacing dim now ship-quality; interleaving is the next bottleneck.
- Encoding sits at relational recognition; no path to free production ("rewrite snippet A in the style of snippet B"). The deepest learning case for "are these equivalent?" is "PROVE it by rewriting" — currently unsupported.
- `sourceLessonId` is optional per pair — pairs without it can't route misses to `state.weakness`, leaving some signal on the table.

## Salvage path (if IMPROVE)
1. **Expand `data/idiom-pairs.json` to ≥40 pairs** — a sub-agent batch authoring trip per `docs/canonical-style.md` shape categories. Lifts **Interleaving 2→3** (deck cycles less aggressively).
2. **Optional "type the difference" tier on miss** — after a wrong pick, prompt "in one phrase, what's the observable difference?" with a text input compared against authored keywords from `card.explain`. Lifts **Encoding strength 1→2**.

**Projected after salvage:** 19/21 (KEEP, ship-quality). Salvage moves +2 pts.

## Action log
- 2026-05-30 Scored at 14/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 1 applied — per-pair SR shipped. Schema-additive `state.swapBench.pairs = { [pairId]: { dueAt, interval } }` at `js/app/01-state-content.js:221` (defaults to `{}`) + load-path at `js/app/04-progress-sr.js:117-127` (legacy users get `{}`). New `_swapSchedulePair(pairId, wasRight)` helper at `js/app/07-drills-swap-speedrun.js:12-32`: win doubles interval (1d→2d→4d→8d→16d→30d cap), miss resets to 1d. New `_swapBuildDeck` at `js/app/07-drills-swap-speedrun.js:34-58`: 3-tier (overdue → fresh/unscheduled → not-overdue-tracked), Fisher-Yates within each tier, then slice deck length. Win/miss handlers at `:118-120` call `_swapSchedulePair(card.id, wasRight)`. Projected 14→17 (+3 Spacing). Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 17/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/). Spacing now 3/3 — per-pair SR fully realized.
