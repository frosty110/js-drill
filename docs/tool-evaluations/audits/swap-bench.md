# 🔀 Swap-Bench — Learning-effectiveness audit

**Total: 14/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/07-drills-swap-speedrun.js:23`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | User must commit "same" or "different" before reveal; binary forced choice with no peek path (`07-drills-swap-speedrun.js:57-59`, `70-89`). |
| Encoding strength | 1/3 | Binary recognition (same/different on two visible snippets) — no production of the difference, no typing (`07-drills-swap-speedrun.js:57-58`). The relational reasoning is novel but the response surface is MC. |
| Spacing | 0/3 | `state.swapBench` tracks lifetime attempts/correct/sessions/lastRunAt only (`01-state-content.js:221`, `04-progress-sr.js:114-119`); no per-pair interval, no SR write. |
| Interleaving | 2/3 | Pool is the entire `data/idiom-pairs.json` registry (18 entries as of iter 87), Fisher-Yates shuffled per session (`07-drills-swap-speedrun.js:12-21`). Breadth is small (registry-bounded) but mixes across many JS idiom families per session. |
| Feedback quality | 3/3 | Reveal shows the verdict + a per-pair `explain` string sourced from `idiom-pairs.json` (`07-drills-swap-speedrun.js:92-99`); both same- and different-behavior pairs get a 1-2 sentence explanation. Best-in-class feedback of the four tools. |
| Transfer-context match | 2/3 | Two real code snippets stacked vertically; user reasons about observable behavior — much closer to interview "is this refactor safe?" than to flashcards (`07-drills-swap-speedrun.js:44-55`). But not a writing task; the user reads pre-made pairs. |
| Closed-loop signal use | 3/3 | Misses flag `state.weakness[sourceLessonId]++` AND `appendHistory(...,'L1-miss')` when a `sourceLessonId` is authored on the pair (`07-drills-swap-speedrun.js:77-79`); wins update lifetime — dual-direction signal use. |

## Strengths
- Only surface in the app drilling RELATIONAL retrieval ("are these two equivalent?") rather than categorical pick-one (`07-drills-swap-speedrun.js:50` — the "↕ same behavior? ↕" framing).
- High-quality per-pair `explain` strings authored into `data/idiom-pairs.json` — feedback dim is fully realized (`07-drills-swap-speedrun.js:96`).
- Drill-source-lesson deep-link on misses routes the user from the abstract idiom comparison back to the canonical context (`07-drills-swap-speedrun.js:97-99`).

## Weaknesses
- 18-pair registry caps interleaving breadth — a 6-card session covers 33% of the corpus, so within a single week the same pairs recycle without spacing logic to defer mastered ones.
- No SR — a pair the user nailed today reappears at the same random rate next session; a pair they bombed has no priority signal.
- Encoding sits at relational recognition; no path to free production ("rewrite snippet A in the style of snippet B"). The deepest learning case for "are these equivalent?" is "PROVE it by rewriting" — currently unsupported.

## Salvage path (if IMPROVE)
1. **Per-pair SR via `state.swapBench.pairs[id] = {dueAt, interval}`** — bump `01-state-content.js:221` to track per-pair due dates; on win, double the interval (1d→2d→4d), on miss reset to 1d; build the deck preferring overdue pairs in `_swapBuildDeck` (`07-drills-swap-speedrun.js:12`). Lifts **Spacing 0→3**.
2. **Expand `data/idiom-pairs.json` to ≥40 pairs** — a sub-agent batch authoring trip per `docs/canonical-style.md` shape categories. Lifts **Interleaving 2→3** (deck cycles less aggressively).
3. **Optional "type the difference" tier on miss** — after a wrong pick, prompt "in one phrase, what's the observable difference?" with a text input compared against authored keywords from `card.explain`. Lifts **Encoding strength 1→2**.

**Projected after salvage:** 19/21 (KEEP, ship-quality). Salvage moves +5 pts.

## Action log
- 2026-05-30 Scored at 14/21 by `/eval-learning-tool --all`.
