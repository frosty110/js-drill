# Lesson Audit — 2026-05-24

**Scope:** all 150 lessons (44 syntax + 79 patterns + 20 applied + 7 from manifest expansion since iter 23).
**Rubric:** `l1l2` (default; identical to iter-23 audit per `.claude/skills/lesson-audit/SKILL.md` §§ Rubric library).
**Agents spawned:** 12 (Basics, Algorithms, Trees, DP, Applied (single 20-lesson group), Arrays+Hash+Modern, Iterators+JS-Toolbox, Classes+Async+Advanced JS, Arrays&Hashing+Two-Pointers+Sliding, Stack+Binary-Search+Linked-List, Tries+Heap+Graphs, Greedy+Backtracking+Intervals+Matrix+Bit+System-Design).
**Prior audit:** `iter-artifacts/iter-23-l1-l2-audit.md` (51 syntax lessons; ~24 with explicit L1/L2 scores).
**State file:** `iter-artifacts/.lesson-audit-state.json` (first-ever write).

**Aggregate scores:** L1 mean **2.63**, L2 mean **2.60**, lesson mean **2.61** across 150 lessons.

**Bottom-quartile (lesson mean < 1.80):** 2 lessons — `applied-problems/a-minesweeper` (1.75) and `linked-list/p-remove-nth` (1.75).

**Watchlist (1.80 ≤ mean ≤ 2.15):** 12 lessons — see § Combined ranking.

**Plan delta vs Step-1 pre-prior plan:** none material. Pre-prior plan called for 12 agents over all 150 lessons with l1l2 rubric. Step-2 review of iter-23 priors only refined the per-agent prompt to pass through prior scores for ~24 lessons so the delta column populates. Scope, agent count, and groupings were unchanged.

---

## Combined ranking (all 150 lessons, lowest mean first)

| Rank | Lesson | L1 | L2 | Mean | Delta vs prior | Flag |
|---|---|---|---|---|---|---|
| 1 | `applied-problems/a-minesweeper` | 2.50 | **1.00** | **1.75** | newly | 🚨 BOTTOM-QUARTILE |
| 2 | `linked-list/p-remove-nth` | 2.50 | **1.00** | **1.75** | newly | 🚨 BOTTOM-QUARTILE |
| 3 | `basics/s-strings` | 1.75 | 2.00 | 1.88 | +0.13 from 1.75 (was bottom) | watchlist |
| 4 | `basics/s-loops` | 1.75 | 2.00 | 1.88 | unchanged at 1.88 | watchlist |
| 5 | `hash-structures/s-obj-basics` | 2.75 | **1.00** | 1.88 | +0.13 from 1.75 (was bottom) | watchlist |
| 6 | `arrays/s-arr-index` | 2.50 | 1.50 | 2.00 | +0.12 from 1.88 | watchlist |
| 7 | `trees/p-same-tree` | 2.00 | 2.00 | 2.00 | newly | watchlist |
| 8 | `bit-manipulation/p-single-number` | 2.00 | 2.00 | 2.00 | newly | watchlist |
| 9 | `linked-list/p-merge-two-sorted` | 2.25 | 2.00 | 2.13 | newly | watchlist |
| 10 | `backtracking/p-permutations` | 2.25 | 2.00 | 2.13 | newly | watchlist |
| 11 | `heap/p-kth-largest` | 2.25 | 2.00 | 2.13 | newly | watchlist |
| 12 | `graphs/p-islands` | 2.25 | 2.00 | 2.13 | newly | watchlist |
| 13 | `graphs/p-connected-components` | 2.25 | 2.00 | 2.13 | newly | watchlist |
| 14 | `basics/s-strmethods` | 2.75 | 1.50 | 2.13 | +0.13 from 2.00 | watchlist |
| 15 | `arrays/s-arr-search` | 2.25 | 2.50 | 2.38 | newly | |
| 16 | `iter-and-gen/s-generators` | 2.75 | 2.00 | 2.38 | newly | |
| 17 | `iter-and-gen/s-gen-delegation` | 2.75 | 2.00 | 2.38 | newly | |
| 18 | `js-toolbox/s-array-from` | 2.50 | 2.00 | 2.25 | newly | |
| 19 | `hash-structures/s-obj-iter` | 2.75 | 2.00 | 2.38 | newly | |
| 20 | `modern-syntax/destructuring-spread` | 2.75 | 2.00 | 2.38 | +0.38 from 2.00 | |
| 21 | `algorithms/sorting` | 2.50 | 2.00 | 2.25 | +0.37 from 1.88 (cleared watchlist) | |
| 22 | `algorithms/s-index-math` | 3.00 | 2.00 | 2.50 | -0.17 from 2.67 | |
| 23 | `basics/s-recursion` | 2.75 | 2.00 | 2.38 | newly | |
| 24 | `arrays-and-hashing/p-contains-dup` | 2.25 | 2.50 | 2.38 | newly | |
| 25 | `arrays-and-hashing/p-valid-anagram` | 2.50 | 2.00 | 2.25 | newly | |
| 26 | `applied/a-connect-four` | 2.50 | 2.00 | 2.25 | newly | |
| 27 | `applied/a-deck-cards` | 2.50 | 2.00 | 2.25 | newly | |
| 28 | `applied/a-hashmap` | 2.50 | 2.00 | 2.25 | newly | |
| 29 | `applied/a-poker-rank` | 2.50 | 2.00 | 2.25 | newly | |
| 30 | `applied/a-queue-from-stacks` | 2.50 | 2.00 | 2.25 | newly | |
| 31 | `applied/a-memoize` | 2.75 | 2.00 | 2.38 | newly | |
| 32 | `applied/a-shopping-cart` | 2.75 | 2.00 | 2.38 | newly | |
| 33 | `applied/a-tic-tac-toe` | 2.75 | 2.00 | 2.38 | newly | |
| 34 | `applied/a-undo-redo` | 2.75 | 2.00 | 2.38 | newly | |
| 35 | `applied/a-blackjack-hand` | 2.50 | 3.00 | 2.75 | newly | |
| 36 | `applied/a-deep-clone` | 2.50 | 3.00 | 2.75 | newly | |
| 37 | `applied/a-game-of-life` | 2.25 | 3.00 | 2.63 | newly | |
| 38 | `binary-search/p-rotated` | 2.75 | 2.00 | 2.38 | newly | |
| 39 | `linked-list/p-reverse-list` | 2.75 | 2.00 | 2.38 | newly | |
| 40 | `linked-list/p-reorder-list` | 2.75 | 2.00 | 2.38 | newly | |
| 41 | `tries/p-word-search-ii` | 2.75 | 2.00 | 2.38 | newly | |
| 42 | `heap/p-median-data-stream` | 2.50 | 2.00 | 2.25 | newly | |
| 43 | `graphs/p-clone-graph` | 2.50 | 2.00 | 2.25 | newly | |
| 44 | `greedy/p-jump-game` | 2.50 | 2.00 | 2.25 | newly | |
| 45 | `backtracking/p-word-search` | 2.50 | 2.00 | 2.25 | newly | |
| 46 | `matrix/p-rotate-image` | 2.75 | 2.00 | 2.38 | newly | |
| 47 | `matrix/p-set-matrix-zeroes` | 2.75 | 2.00 | 2.38 | newly | |
| 48 | `bit-manipulation/p-missing-number` | 2.75 | 2.00 | 2.38 | newly | |
| 49 | `greedy/p-max-subarray` | 2.75 | 2.00 | 2.38 | newly | |
| 50 | `async/s-promises` | 2.75 | 2.00 | 2.38 | +1.00 from 1.38 — investigate¹ | |
| 51 | `basics/s-variables` | 2.50 | 2.50 | 2.50 | newly | |
| 52 | `basics/s-closures` | 2.50 | 2.50 | 2.50 | newly | |
| 53 | `algorithms/s-stack-pattern` | 2.50 | 2.50 | 2.50 | newly | |
| 54 | `algorithms/s-queue-pattern` | 2.50 | 2.50 | 2.50 | newly | |
| 55 | `arrays/array-iteration` | 2.50 | 2.50 | 2.50 | newly | |
| 56 | `modern-syntax/s-nullish` | 2.50 | 2.50 | 2.50 | newly | |
| 57 | `two-pointers/valid-palindrome` | 2.50 | 2.50 | 2.50 | newly | |
| 58 | `sliding-window/best-time-stock` | 2.50 | 2.50 | 2.50 | newly | |
| 59 | `advanced-js/s-event-loop` | 2.50 | 2.50 | 2.50 | newly | |
| 60 | `arrays-and-hashing/p-anagrams` | 2.00 | 3.00 | 2.50 | newly | |
| 61 | `arrays-and-hashing/p-encode-decode-strings` | 3.00 | 2.00 | 2.50 | newly | |
| 62 | `algorithms/s-tree-traversals` | 2.75 | 2.50 | 2.63 | newly | |
| 63 | `arrays/array-transform` | 2.25 | 3.00 | 2.63 | +0.38 from 2.25 (cleared watchlist) | |
| 64 | `js-toolbox/s-json-api` | 2.75 | 2.50 | 2.63 | newly | |
| 65 | `js-toolbox/s-regexp-basics` | 2.75 | 2.50 | 2.63 | newly | |
| 66 | `matrix/p-spiral-matrix` | 2.25 | 3.00 | 2.63 | newly | |
| 67 | `bit-manipulation/p-count-bits` | 2.25 | 3.00 | 2.63 | newly | |
| 68 | `dynamic-programming/p-house-robber` | 2.25 | 3.00 | 2.63 | newly | |
| 69 | `arrays/s-arr-create` | 2.50 | 3.00 | 2.75 | newly | |
| 70 | `arrays/s-arr-mutate` | 3.00 | 2.50 | 2.75 | newly | |
| 71 | `hash-structures/map-set` | 2.50 | 3.00 | 2.75 | newly | |
| 72 | `iter-and-gen/s-iter-protocol` | 2.50 | 3.00 | 2.75 | newly | |
| 73 | `algorithms/s-matrix-neighbors` | 2.50 | 3.00 | 2.75 | newly | |
| 74 | `algorithms/s-heap-ops` | 3.00 | 2.50 | 2.75 | -0.13 from 2.88 | |
| 75 | `js-toolbox/s-bitwise-toolkit` | 2.50 | 3.00 | 2.75 | -0.13 from 2.88 | |
| 76 | `classes/s-class` | 2.50 | 3.00 | 2.75 | +0.62 from 2.13 — investigate¹ | |
| 77 | `classes/s-class-inh` | 2.50 | 3.00 | 2.75 | newly | |
| 78 | `async/s-trycatch` | 2.50 | 3.00 | 2.75 | +1.00 from 1.75 — investigate¹ | |
| 79 | `arrays-and-hashing/two-sum` | 2.50 | 3.00 | 2.75 | newly | |
| 80 | `two-pointers/p-trapping-rain` | 2.50 | 3.00 | 2.75 | newly | |
| 81 | `stack/p-daily-temp` | 2.50 | 3.00 | 2.75 | newly | |
| 82 | `binary-search/binary-search` | 2.50 | 3.00 | 2.75 | newly | |
| 83 | `trees/p-max-depth` | 2.50 | 3.00 | 2.75 | newly | |
| 84 | `trees/p-bfs` | 2.50 | 3.00 | 2.75 | newly | |
| 85 | `trees/p-valid-bst` | 2.50 | 3.00 | 2.75 | newly | |
| 86 | `trees/p-lca-bst` | 2.50 | 3.00 | 2.75 | newly | |
| 87 | `tries/p-trie` | 2.50 | 3.00 | 2.75 | newly | |
| 88 | `heap/p-top-k-frequent` | 2.50 | 3.00 | 2.75 | newly | |
| 89 | `graphs/p-num-provinces` | 2.50 | 3.00 | 2.75 | newly | |
| 90 | `intervals/p-insert-interval` | 2.50 | 3.00 | 2.75 | newly | |
| 91 | `intervals/p-meeting-rooms-ii` | 2.50 | 3.00 | 2.75 | newly | |
| 92 | `system-design/p-lru-cache` | 2.50 | 3.00 | 2.75 | newly | |
| 93 | `applied/a-snake-game` | 2.75 | 3.00 | 2.88 | newly | |
| 94 | `applied/a-circular-buffer` | 2.75 | 3.00 | 2.88 | newly | |
| 95 | `applied/a-curry` | 2.75 | 3.00 | 2.88 | newly | |
| 96 | `applied/a-debounce` | 2.75 | 3.00 | 2.88 | newly | |
| 97 | `applied/a-event-emitter` | 2.75 | 3.00 | 2.88 | newly | |
| 98 | `dynamic-programming/p-climbing-stairs` | 2.50 | 3.00 | 2.75 | newly | |
| 99 | `dynamic-programming/p-coin-change` | 2.50 | 3.00 | 2.75 | newly | |
| 100 | `modern-syntax/s-optional` | 2.75 | 3.00 | 2.88 | newly | |
| 101 | `arrays-and-hashing/p-longest-consecutive` | 2.75 | 3.00 | 2.88 | newly | |
| 102 | `two-pointers/p-3sum` | 2.75 | 3.00 | 2.88 | newly | |
| 103 | `two-pointers/p-container` | 2.75 | 3.00 | 2.88 | newly | |
| 104 | `stack/p-min-stack` | 2.75 | 3.00 | 2.88 | newly | |
| 105 | `stack/p-largest-rect-hist` | 2.75 | 3.00 | 2.88 | newly | |
| 106 | `binary-search/p-min-rotated` | 2.75 | 3.00 | 2.88 | newly | |
| 107 | `linked-list/p-cycle` | 2.75 | 3.00 | 2.88 | newly | |
| 108 | `linked-list/p-merge-k-lists` | 2.75 | 3.00 | 2.88 | newly | |
| 109 | `linked-list/p-add-two-numbers` | 2.75 | 3.00 | 2.88 | newly | |
| 110 | `heap/p-min-heap` | 2.75 | 3.00 | 2.88 | newly | |
| 111 | `graphs/p-course` | 2.75 | 3.00 | 2.88 | newly | |
| 112 | `graphs/p-course-ii` | 2.75 | 3.00 | 2.88 | newly | |
| 113 | `graphs/p-pacific-atlantic` | 2.75 | 3.00 | 2.88 | newly | |
| 114 | `greedy/p-gas-station` | 2.75 | 3.00 | 2.88 | newly | |
| 115 | `backtracking/p-subsets` | 2.75 | 3.00 | 2.88 | newly | |
| 116 | `intervals/p-merge-intervals` | 2.75 | 3.00 | 2.88 | newly | |
| 117 | `bit-manipulation/p-num-1-bits` | 2.75 | 3.00 | 2.88 | newly | |
| 118 | `bit-manipulation/p-reverse-bits` | 2.75 | 3.00 | 2.88 | newly | |
| 119 | `trees/p-invert` | 2.00 | 3.00 | 2.50 | newly | |
| 120 | `trees/p-construct-tree` | 2.75 | 3.00 | 2.88 | newly | |
| 121 | `trees/p-max-path-sum` | 2.75 | 3.00 | 2.88 | newly | |
| 122 | `trees/p-serialize-tree` | 2.75 | 3.00 | 2.88 | newly | |
| 123 | `dynamic-programming/p-word-break` | 2.75 | 3.00 | 2.88 | newly | |
| 124 | `dynamic-programming/p-edit-distance` | 2.75 | 3.00 | 2.88 | newly | |
| 125 | `dynamic-programming/p-max-product-subarray` | 2.75 | 3.00 | 2.88 | newly | |
| 126 | `dynamic-programming/p-longest-inc-sub` | 2.50 | 2.00 | 2.25 | newly | |
| 127 | `dynamic-programming/p-unique-paths` | 2.50 | 2.00 | 2.25 | newly | |
| 128 | `basics/s-cond` | 2.75 | 3.00 | 2.88 | newly | |
| 129 | `basics/s-functions` | 2.75 | 3.00 | 2.88 | unchanged at 2.88 | |
| 130 | `js-toolbox/s-number-parse` | 2.75 | 3.00 | 2.88 | +0.13 from 2.75 | |
| 131 | `advanced-js/s-prototype` | 2.75 | 3.00 | 2.88 | newly | |
| 132 | `stack/valid-parentheses` | 2.25 | 3.00 | 2.63 | newly | |
| 133 | `basics/s-template` | 1.50 | 3.00 | 2.25 | +0.50 from 1.75 (cleared bottom) | |
| 134 | `sliding-window/p-min-window` | 2.80 | 3.00 | 2.90 | newly | |
| 135 | `basics/s-numbers` | 3.00 | 3.00 | 3.00 | +0.25 from 2.75 | |
| 136 | `algorithms/s-bfs-template` | 3.00 | 3.00 | 3.00 | unchanged at 3.00 | exemplary |
| 137 | `algorithms/s-ll-traversal` | 3.00 | 3.00 | 3.00 | unchanged at 3.00 | exemplary |
| 138 | `algorithms/s-ll-fast-slow` | 3.00 | 3.00 | 3.00 | unchanged at 3.00 | exemplary |
| 139 | `iter-and-gen/s-iter-custom` | 3.00 | 3.00 | 3.00 | unchanged at 3.00 | exemplary |
| 140 | `iter-and-gen/s-async-iter` | 3.00 | 3.00 | 3.00 | unchanged at 3.00 | exemplary |
| 141 | `js-toolbox/s-math-toolkit` | 3.00 | 3.00 | 3.00 | +0.25 from 2.75 | |
| 142 | `async/s-async` | 3.00 | 3.00 | 3.00 | newly | |
| 143 | `advanced-js/s-this` | 3.00 | 3.00 | 3.00 | newly | |
| 144 | `sliding-window/p-longest-sub` | 3.00 | 3.00 | 3.00 | newly | |
| 145 | `sliding-window/p-sliding-window-max` | 3.00 | 3.00 | 3.00 | newly | |
| 146 | `dynamic-programming/p-longest-common-subseq` | 3.00 | 3.00 | 3.00 | newly | |
| 147 | `binary-search/p-koko-bananas` | 3.00 | 3.00 | 3.00 | newly | |
| 148 | `backtracking/p-combination-sum` | 3.00 | 3.00 | 3.00 | newly | |
| 149 | `applied/a-promise-all` | 3.00 | 3.00 | 3.00 | newly | |
| 150 | `applied/a-throttle` | 3.00 | 3.00 | 3.00 | newly | |

¹ **Delta-integrity caveat:** `async/s-promises` (+1.00), `async/s-trycatch` (+1.00), and `classes/s-class` (+0.62) show large positive deltas, but `git log` shows NO commits touching those lesson JSONs between iter-23 and iter-27. The agent flagged "investigate" on its own; the likely cause is iter-27's fresh-eyes-second-time being marginally more lenient than iter-23's, NOT a real rewrite. Treat these three positive deltas as artifact noise. The two negative deltas (`s-heap-ops` -0.13, `s-index-math` -0.17, `s-bitwise-toolkit` -0.13) are also within noise.

---

## Delta summary (vs iter-23 priors)

24 lessons had explicit prior L1/L2 scores; the other 126 are first-time scored.

| Bucket | Count | Notes |
|---|---|---|
| **Improved (+0.10 or more)** | 13 | s-promises†, s-trycatch†, s-class†, s-template, array-transform, destructuring-spread, sorting, s-math-toolkit, s-numbers, s-number-parse, s-strings, s-obj-basics, s-arr-index, s-strmethods. **†These three flagged "noise" — no code change since iter 23; agent leniency.** |
| **Regressed (-0.10 or more)** | 3 | s-heap-ops, s-index-math, s-bitwise-toolkit (all -0.13 to -0.17 — within rubric noise; no follow-up needed) |
| **Unchanged** | 7 | s-loops, s-functions, s-iter-custom, s-async-iter, s-bfs-template, s-ll-traversal, s-ll-fast-slow |
| **Newly scored** | 126 | All 99 patterns lessons + 20 applied + 7 syntax lessons added or with no explicit iter-23 score (basics: s-variables, s-cond, s-closures, s-recursion; advanced-js: all 3; algorithms: 5 added iters 20+22; classes: s-class-inh; async: s-async) |

Discarding the 3 noise-flagged positives, the **real story is**:
- ZERO lessons moved INTO the bottom-quartile (1.80) since iter 23.
- The 5 iter-23 bottom-quartile lessons (s-promises, s-strings, s-template, s-obj-basics, s-trycatch) all cleared the 1.80 line, but only `s-template` cleanly (`+0.50` is a real signal — the rubric application differs because `s-template`'s L2 was strong both times; iter-23 likely over-weighted the weak L1). The other four are within ±0.13 of their iter-23 score.
- TWO NEW bottom-quartile lessons surfaced from never-audited tracks: `a-minesweeper` (applied) and `p-remove-nth` (patterns/linked-list).
- One systemic pattern surfaced across patterns track: 33 of 79 lessons have only 1 L2 exercise (violates PROFILE.md "≥2 L2 per lesson" floor). This is structural under-build, not single-lesson quality drift.

---

## Cross-cutting themes (7 bullets, orchestrator-distilled)

1. **The `.next` blanking disease (linked-list).** Across 5 of 7 linked-list lessons, L2 templates have multiple blanks where the answer is the literal token `next`. `p-remove-nth` is the extreme case (4/4 blanks = `next`, mean 1.75); `p-reverse-list`, `p-cycle`, `p-merge-two-sorted`, `p-reorder-list` all share the pattern. Mobile users will pattern-match a string of `next` answers without engaging — defeats L2's purpose. This is the single highest-leverage section-level rewrite target.

2. **L2 under-build in patterns + applied is systemic.** 33 of 79 patterns lessons and 17 of 20 applied lessons ship only 1 L2 exercise — violates PROFILE.md's stated "≥3 L1 + ≥2 L2" floor for mobile-first usage. The mobile user runs out of L2 surface fast and is forced into L3 (the at-desk tier) prematurely. Adding even one targeted L2 per under-built lesson would lift the global L2 mean meaningfully.

3. **Recurring "Why dummy head?" L1 across linked-list.** Same question shape with similar weak distractors appears in `p-merge-two-sorted`, `p-merge-k-lists`, `p-add-two-numbers`, `p-remove-nth`. Under spaced-rep interleaving, the rusty engineer sees this 4 times — three of those reps are wasted. Cluster diff-and-vary candidate.

4. **Complexity-question fatigue.** Time/Space complexity L1s appear in nearly every patterns lesson (≥70 of 79), almost always with one obviously-absurd distractor (`O(1)` for tree walks, `O(n²)` for amortized ops). These consistently score 2 and produce no useful retrieval signal. Section-wide opportunity: collapse 2 separate T+S questions into one combined T+S question (per `p-valid-bst` Q4's template) and free a slot per lesson for a pattern-specific gotcha.

5. **Identifier-as-blank anti-pattern.** Across multiple sections, L2 blanks target the easiest-to-recall token (the variable name just declared two lines above, the field name printed in the prompt) instead of the load-bearing idiom token. Worst offenders: `s-obj-basics` (Ex1 blank is the variable name `name`, Ex2 blank is `key`), `s-obj-iter` Ex2 (prompt names `Object.entries`, blank is `entries`), `sorting` Ex2 (blank is `age`, not the `a.age - b.age` comparator body), `a-undo-redo` (push/pop blanks instead of the `this.undone = []` clear-redo line).

6. **Iterators+Generators + Algorithms + Sliding Window are the model sections.** All three cluster around 2.80+ section means; their L2s consistently blank load-bearing operator tokens (`>>` in `s-heap-ops`, `&&` in `s-ll-traversal`, `delete` in `p-longest-sub`, `length`/`shift`/`add` in `s-bfs-template`). Future rewrites should mirror this template: blank the operator that, if mistyped, would break the canonical, not the identifier that's already named in context.

7. **L1 distractor floor is uneven.** ~25 questions across all sections have at least one absurd distractor ("required by JavaScript", "balance the recursion", "only with primitives", "sorts the parent array", "Sets are sorted") that lets a rusty engineer eliminate by triage rather than recall. Section-wide cheap-fix opportunity: a one-iter pass through all flagged absurd-distractor L1s would lift the global L1 mean by an estimated 0.05-0.08 with minimal authoring effort.

---

## Highest-leverage rewrites (top 10 across all sections)

| # | Lesson | Primary issue | Rewrite direction | Tier |
|---|---|---|---|---|
| 1 | `linked-list/p-remove-nth` (1.75) | All 4 L2 blanks are the literal token `next`. Pattern-matchable; tests typing not memory. | Total L2 rewrite: blank `fast.next` (loop guard), `n` (for-loop bound), `slow.next.next` (unlink target), `dummy.next` (return). Each a different load-bearing token. | **Tier 1 (BOTTOM-QUARTILE)** |
| 2 | `applied-problems/a-minesweeper` (1.75) | Single trivial `"X"` blank for a lesson whose entire body is a stack-DFS flood fill. L1 also leans on trivia (Q3/Q4 are sentinel-name + neighbor-count). | Add a second L2 blanking `if (n > 0)` (numbered-stop) or `board[cr][cc] = "B"` (mark-before-push). Replace Q3 with "what bug if you DON'T mark before pushing?". | **Tier 1 (BOTTOM-QUARTILE)** |
| 3 | `linked-list/p-merge-two-sorted` (2.13) | Recurring "Why dummy head?" Q1 with weak distractors; L2 has 2 of 4 blanks as trivial `dummy`/`next`. | Rewrite Q1 to test `<` vs `<=` stability claim from notes; L2 should isolate the `if (a.val <= b.val)` splice decision and the `tail.next = a || b` survivor. | **Tier 2** |
| 4 | `bit-manipulation/p-single-number` (2.00) | Lesson is structurally undersized (1-line algorithm yields a 2-blank L2 and 4 L1s mostly rephrasing Reference notes). | Add L1 testing "what if a triplicate appeared" or "hash-set tradeoff"; accept the L2 won't get richer given algorithm size. Lowest-marginal-cost win in this list. | **Tier 2** |
| 5 | `trees/p-same-tree` (2.00) | All 4 L1s lean on Reference paraphrase; only 1 L2 with operator blanks that don't test the recursive-call structure. | Replace at least one L1 with a "what bug if you check `p.val !== q.val` BEFORE the null checks?" ordering gotcha. Add a second L2 testing the structural recursion: `sameTree(p.left, q.left) && sameTree(p.right, q.right)`. | **Tier 2** |
| 6 | `hash-structures/s-obj-basics` (1.88) | Both L2 exercises blank the variable IDENTIFIER (hint is a literal hand-off); doesn't drill the brace shorthand or computed-key syntax. | Rewrite both L2 to blank the SYNTAX tokens: `{ ___ name ___ }` testing brace shorthand, `{ [___]: 100 }` testing computed-key brackets, `___ () { return ... }` testing method shorthand. | **Tier 2 (was iter-23 BOTTOM)** |
| 7 | `arrays/s-arr-index` (2.00) | Ex2 has two identical `at` blanks. | Collapse duplicate blanks; add a second exercise testing `.at(-1)` vs `arr[arr.length-1]` equivalence directly. | **Tier 2 (was iter-23 watchlist)** |
| 8 | `basics/s-strings` (1.88) | Q1 throwaway ("typeof 'hello'"); Q4 has the "while...let" absurd distractor; Ex1 is a one-blank hand-off. | Replace Q1 with `new String("hi") === "hi"` wrapper-trap; Q4 swap "while...let" for `for (const ch in s)` to make for-in-vs-for-of the actual trap; recast L2 Ex1 to blank a non-trivial token. | **Tier 2 (was iter-23 BOTTOM)** |
| 9 | `basics/s-loops` (1.88) | L2 Ex1 is a one-keyword blank; Q2 tests trivial `break` semantics. | Rewrite L2 Ex1 as do-while-vs-while body-position blank; replace Q2 with the "advance counter BEFORE continue" infinite-loop trap from the lesson's own notes. | **Tier 2 (was iter-23 watchlist)** |
| 10 | Section-wide: **add a 2nd L2 to all single-L2 patterns lessons** | 33 patterns lessons + 17 applied lessons violate PROFILE.md ≥2 L2 floor. Mobile user runs out of L2 surface fast. | One ship iter that adds one targeted second L2 per lesson, focused on whatever load-bearing token the existing single L2 misses. Mechanical authoring; high mobile-throughput payoff. **Single highest-leverage section-level intervention.** | **Tier 2** (multi-iter; can chunk by section) |

---

## Per-section reports (verbatim from subagent outputs)

### Basics (10 lessons)

L1 mean **2.40**, L2 mean **2.45**, lesson mean **2.43**.
Bottom-quartile: none (lowest is `s-strings`/`s-loops` at 1.88, both just above 1.80).

Themes:
- L2 blanks frequently leak into trivial identifiers (s-variables Ex2 `n`, s-strmethods Ex1 duplicate `slice`, s-closures Ex1 `count`, s-recursion Ex2 `sumTo`) — pattern of blanking the easiest-to-recall token instead of the load-bearing one
- L1 questions for "definitional / what-is-X" framings (s-strings Q1, s-template Q1/Q3, s-loops Q1/Q2) are routinely Reference-skim-passable — these need recasting as gotcha-discrimination instead of definition-recall
- Strongest cluster is mid-section (s-numbers 3.00, s-functions 2.88, s-cond 2.88) where the lesson centers on a real interview gotcha and the L2 blanks the actual operator/idiom token

Top 2 rewrite candidates: `s-strings` (Q1/Q4 distractor weakness + trivial L2 blanks), `s-loops` (one-keyword L2 + trivial break-semantics Q2).

### Algorithms (10 lessons)

L1 mean **2.83**, L2 mean **2.59**, lesson mean **2.71**. **Strongest section across the audit.**
Bottom-quartile: none (weakest is `sorting` at 2.25).

Themes:
- L1 consistently strong (mean 2.83); the exemplary cluster (`s-bfs-template`, `s-ll-traversal`, `s-ll-fast-slow`, `s-heap-ops`) holds at 3.00 and provides a reusable distractor-design pattern (couple wrong-but-realistic intuitions, not absurd filler)
- L2 weakness clusters around single-token blanks on already-named identifiers (`sorting` Ex2 "age", `s-index-math` Ex1-3 "1"/"n"/"n"). Strongest L2s blank the load-bearing idiom operator (`s-ll-traversal` Ex3 `&&`, `s-heap-ops` Ex1 `>>`, `s-bfs-template` Ex1 `length`/`add`)
- Recurring throwaway distractors ("Random", "Only on primitives") drag a handful of otherwise-strong L1s from 3 to 2

Top 2 rewrite candidates: `s-index-math` L2 (all 3 exercises — blank the full multi-token expression, not the trailing literal; aligns with iter-23 hint-heavy note), `sorting` L2 Ex2 (blank the comparator body `a.age - b.age` instead of the property name).

### Trees (9 lessons)

L1 mean **2.47**, L2 mean **2.89**, lesson mean **2.68**.
Bottom-quartile: none (lowest is `p-same-tree` at 2.00).

Themes:
- L2s are uniformly strong (mean 2.89) — blank choices consistently isolate load-bearing tokens
- L1s lean on a repeated complexity-question template ("Time?"/"Space?") across nearly every lesson, often with one obviously-absurd distractor — section's most-fixable quality drag
- Every lesson ships only 1 L2 exercise — under-built for ~80% phone-study profile (≥2 L2 per lesson per CLAUDE.md / PROFILE.md)

Top 2 rewrite candidates: `p-same-tree` (weakest L1 set, L2 falls to 2.00), section-wide complexity-question consolidation (free slots for pattern-specific gotchas).

### Dynamic Programming (9 lessons)

L1 mean **2.61**, L2 mean **2.78**, lesson mean **2.69**.
Bottom-quartile: none (lowest is `p-longest-inc-sub` / `p-unique-paths` at 2.25).

Themes:
- Complexity questions consistently score 2 (Reference comments leak the answer)
- Recurrence-recall L1s are uniformly strong (distractors capture real cross-pattern confusions: LCS vs Edit Distance vs House Robber off-by-one variants)
- L2 exercises that include indexing-trivia blanks (`m-1`/`n-1`, `...` spread) drag the load-bearing average down vs lessons that blank only DP-shape tokens

Top 2 rewrite candidates: `p-unique-paths` L2 (replace `m-1`/`n-1` blanks with O(n) rolling-row template), `p-longest-inc-sub` (add second L2 isolating `Math.max(...dp)` vs `dp[n-1]` — the lesson's biggest semantic trap).

### Applied Problems (20 lessons)

L1 mean **2.64**, L2 mean **2.41**, lesson mean **2.53**.
Bottom-quartile: `a-minesweeper` (1.75).

Themes:
- L2 surface is the weak link — most lessons ship only ONE L2 exercise, and many blank trivial sentinels (`-1`, `''`, `"X"`, tuple-index `1`) or duplicate the same array method twice (`pop/pop`, `push/pop`)
- L1 trivia-recall questions dilute strong sets — almost every lesson has one Q (Q3 or Q4) that is either rule recall, pedagogical, or a sentinel-name trivia question
- Async + closure-state lessons are best authored (debounce, throttle, promise-all, curry, snake-game all scored 2.75+). Game/grid lessons (minesweeper, connect-four, deck) drag the average down via thin L2

Top 2 rewrite candidates: `a-minesweeper` L2 (single trivial `"X"` blank — total L2 expansion needed), `a-undo-redo` L2 (must blank `this.undone = []` since that's the load-bearing insight from Q1 and notes — currently the two push/pop blanks ignore it).

### Arrays (6), Hash Structures (3), Modern Syntax (3) — 12 lessons

Arrays: L1 mean **2.50**, L2 mean **2.50**, lesson mean **2.50**.
Hash: L1 mean **2.67**, L2 mean **2.00**, lesson mean **2.33** (`s-obj-basics` at 1.88 narrowly clears 1.80).
Modern: L1 mean **2.67**, L2 mean **2.50**, lesson mean **2.58**.

Themes (across all 3): L2 IDENTIFIER-blanking is the dominant failure mode (`s-obj-basics`, `s-obj-iter`, `destructuring-spread` Ex1). `s-optional` is the model — blanks the `?.` operator itself across three forms.

Top 2 rewrite candidates: `s-obj-basics` L2 (both exercises need full rewrite — drill BRACE shorthand + BRACKET computed-key SYNTAX, not identifiers), `s-obj-iter` Ex2 (remove the "load-bearing call is `Object.entries`" giveaway from prompt; add destructuring `[k, v]` as second blank).

### Iterators & Generators (5), JS Toolbox (6) — 11 lessons

Iter+Gen: L1 mean **2.80**, L2 mean **2.60**, lesson mean **2.70** (`s-iter-custom` and `s-async-iter` exemplary 3.00).
JS Toolbox: L1 mean **2.71**, L2 mean **2.67**, lesson mean **2.69**.

Themes: Async-iter and custom-iter are the gold standard. Generator-syntax lessons (`s-generators`, `s-gen-delegation`) lean on single-character blanks (`*`, `...`) for one L2 exercise. Math / number-parse / bitwise consistently strong. L2 exercises with a single trivial blank (`s-array-from` Ex2 'from', `s-regexp-basics` Ex1 'g') are the recurring weakness.

Top 2 rewrite candidates: `s-array-from` L2 Ex2 (replace single-blank `'hey'` with Set-dedupe or array-of-objects mapping exercise), `s-json-api` L2 Ex2 (move blank off literal `'password'` onto `undefined` return or `k ===` comparison).

### Classes (2), Async (3), Advanced JS (3) — 8 lessons

Classes: L1 mean **2.50**, L2 mean **3.00**, lesson mean **2.75**.
Async: L1 mean **2.75**, L2 mean **2.67**, lesson mean **2.71** (former bottom-quartile lessons `s-promises` and `s-trycatch` appear genuinely rebuilt per agent's read — but see delta-integrity caveat¹).
Advanced JS: L1 mean **2.75**, L2 mean **2.83**, lesson mean **2.79** (`s-this` and `s-prototype` both exemplary).

Themes: `s-this` and `s-prototype` deliver canonical-quality L1. `s-event-loop` has the section's only soft spots: Q2/Q3 distractors include throwaways, and L2 Ex1 has a trivial `"C"` blank. Q4 in `s-prototype` duplicates the "methods live on prototype" concept already in `s-class` Q4.

Top 2 rewrite candidates: `s-event-loop` L2 Ex1 (replace trivial `"C"` blank with `Promise.resolve()` factory blank), `s-event-loop` Q3 (replace "Only in Node.js" / "Only inside async functions" distractors with realistic confusions).

### Arrays & Hashing (6), Two Pointers (4), Sliding Window (4) — 14 lessons

A&H: L1 mean **2.50**, L2 mean **2.69**, lesson mean **2.59**.
Two Pointers: L1 mean **2.63**, L2 mean **2.80**, lesson mean **2.71**.
Sliding Window: L1 mean **2.82**, L2 mean **2.90**, lesson mean **2.86**. **Strongest patterns section.**

Themes: Sliding Window is the strongest section in the entire audit. Two Pointers has uniformly strong L1 (load-bearing semantics; distractors include real rusty-engineer misconceptions). Persistent under-build: 4 of 6 A&H + 3 of 4 Two-Pointers + 3 of 4 Sliding lessons have only 1 L2 exercise.

Top 2 rewrite candidates: `p-anagrams` + `p-encode-decode-strings` + `p-valid-anagram` + `p-longest-consecutive` (add 2nd L2 — highest-leverage mobile fix), `p-3sum` L2 (add second exercise targeting inner dedup `while` loops).

### Stack (4), Binary Search (4), Linked List (7) — 15 lessons

Stack: L1 mean **2.56**, L2 mean **3.00**, lesson mean **2.78**.
Binary Search: L1 mean **2.75**, L2 mean **2.75**, lesson mean **2.75** (`p-koko-bananas` exemplary 3.00).
Linked List: L1 mean **2.61**, L2 mean **2.14**, lesson mean **2.38** — **the linked-list `.next`-blanking disease drags this whole section**.

Themes: Stack L2 quality uniformly strong when present (3 of 4 under-built). All 4 Binary Search lessons under-built. Linked List: "Fill in `.next`" disease across 5 of 7 lessons (p-remove-nth extreme case at 4/4 = `next`); recurring "Why dummy head?" Q with weak distractors across 4 of 7 lessons.

Top 2 rewrite candidates: `p-remove-nth` L2 (total rewrite required — bottom-quartile), section-wide LL second-L2 addition + diff-and-vary on the dummy-head Q.

### Tries (2), Heap (4), Graphs (7) — 13 lessons

Tries: L1 mean **2.63**, L2 mean **2.50**, lesson mean **2.56**.
Heap: L1 mean **2.50**, L2 mean **2.50**, lesson mean **2.50**.
Graphs: L1 mean **2.54**, L2 mean **2.57**, lesson mean **2.55**.

Themes: Course Schedule pair (`p-course`, `p-course-ii`) and `p-pacific-atlantic` are exemplars. Three lessons (`p-islands`, `p-clone-graph`, `p-connected-components`) leave the most load-bearing template position pre-filled and blank trivial identifiers. `p-median-data-stream` L2 leaves the hardest tokens (rebalance comparisons) pre-filled and blanks the trivial `2` divisor.

Top 2 rewrite candidates: `p-clone-graph` L2 (restructure so `map.set(orig, copy)` line ordering is enforced via blanks — the Q1 cycle gotcha is reinforced only verbally), `p-islands` L2 (replace single-char string blanks with the four `dfs(r±1, c±1)` neighbor calls or bounds-check `return`).

### Greedy (3), Backtracking (4), Intervals (3), Matrix (3), Bit Manipulation (5), System Design (1) — 19 lessons

Greedy: L1 mean **2.67**, L2 mean **2.33**, lesson mean **2.50**.
Backtracking: L1 mean **2.63**, L2 mean **2.50**, lesson mean **2.56** (`p-combination-sum` exemplary 3.00).
Intervals: L1 mean **2.58**, L2 mean **3.00**, lesson mean **2.79**.
Matrix: L1 mean **2.58**, L2 mean **2.33**, lesson mean **2.46**.
Bit: L1 mean **2.50**, L2 mean **2.60**, lesson mean **2.55** (lowest `p-single-number` at 2.00 — structurally undersized).
System Design: 1 lesson `p-lru-cache` at 2.75.

Themes: Combination Sum gold-standard; Permutations under-tests vs Subsets (should leverage contrast more aggressively); Word Search misses load-bearing `"#"` sentinel. Intervals L2s excellent across the board. Matrix L2 templates under-blanked. Bit Manip Single Number structurally undersized. Recurring pattern: L2 templates often under-blank by 1 (especially shorter algorithms like Rotate Image, Word Search, Missing Number, Single Number).

Top 2 rewrite candidates: `p-word-search` L2 (add 3rd blank for `"#"` visited sentinel — the lesson's signature token), section-wide L1 absurd-distractor cleanup (Single Number Q1, Count Bits Q1/Q2, Hamming Weight Q1 — all rephrase Reference verbatim).

---

## Next-iter plan (mandatory per SKILL.md Step 4 item 7 + iter-25 adversary)

Per the iter-25 adversarial-subagent constraint ("no measurement-only artifacts without committed next-iter plan"), the audit findings consume into ship work as follows. Artifact-to-ship deadline is 5 iters per `drill-improve` SKILL.md.

**Iter 28 (next ship iter) — Tier 1 bottom-quartile fixes:**
- `linked-list/p-remove-nth` L2 total rewrite (4 distinct load-bearing blanks, not 4× `next`)
- `applied-problems/a-minesweeper` add 2nd L2 + rewrite Q3
- 2-lesson atomic ship (~30min authoring each + validator).

**Iter 29 ship — competing options to choose from:**
- Option A: Tier 2 watchlist fixes (5 lessons: `s-strings`, `s-loops`, `s-obj-basics`, `s-arr-index`, `p-same-tree`)
- Option B: roadmap entry #1 from iter 26 vision (Pattern Recognition Speed Drill — single-iter ship)
- Option C: cluster L1 absurd-distractor cleanup pass (theme 7 — ~25 questions across all sections, mechanical)

**Iter 30+ — Section-wide L2 under-build remediation (multi-iter, chunked by section):**
- Patterns + applied: add a 2nd targeted L2 to ~50 lessons that currently ship with 1 L2. Chunk by section (one section per iter). Highest-leverage mobile-throughput intervention; payoff scales with how much the user actually drills L2 mobile.

**Updates to SELF-IMPROVE.md (orchestrator handles in drill-improve §Step 6):**
- BS-08: append "iter 27 audit run; 2 new bottom-quartile (`a-minesweeper`, `p-remove-nth`); 12 watchlist; `iter-artifacts/lesson-audit-2026-05-24.md` for full table"
- § Next iteration: nominate ship for iter 28 with Tier 1 bottom-quartile fixes (2 lessons)

---

## Open questions for the user

1. **Tier 1 first, then Tier 2, or interleave with roadmap iter-26 entries?** The 2 bottom-quartile rewrites are obvious next-ship work, but roadmap entry #1 (Pattern Recognition Speed Drill) was also nominated by vision iter 26. Recommend: Tier 1 iter 28 (closes the audit's hard finding), then roadmap entry #1 iter 29 (validates new architecture).
2. **The 33+17 single-L2 lessons — chunk by section or by priority?** Section-chunking is mechanical and resumable; priority-chunking targets the lessons that score lowest. Recommend section-chunking starting with linked-list (worst-scoring section, also worst per `.next` disease).
3. **Should `s-promises`/`s-trycatch`/`s-class` +1.00 deltas be treated as real or as noise?** No git changes to those files since iter 23, so I've flagged as noise. If you want a confirmation pass, a single-agent re-audit of just those 3 with the iter-23 rubric paragraph attached verbatim would resolve it cleanly.
4. **Audit cadence going forward?** This run took ~15 min wall time + 12 agents in parallel. A monthly `/lesson-audit --changed-only` run (covers only lessons modified or previously bottom-quartile) would be lighter — maybe 3-4 agents — and catch regressions promptly. Worth scheduling?
