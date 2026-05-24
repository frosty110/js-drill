# Iter 23 — L1 / L2 Pedagogical Quality Audit
*For iter 24+ ship-mode iterations to consume.*

> Produced by iter 23 audit-mode pass via 2 parallel fresh-eyes
> subagents. Each agent scored a subset of the 51 syntax-track lessons
> on a 1-3 rubric for both L1 (multiple-choice concept) and L2 (fill-in-
> blank). Agents were given PROFILE.md but NOT SELF-IMPROVE.md, the
> iteration log, or this rubric's predecessor reasoning — fresh eyes
> only. Closes BS-08 ("Content quality vs. content validity").
>
> Aggregate scores: **L1 mean 2.56, L2 mean 2.42, lesson mean 2.49**
> across 51 lessons. **5 bottom-quartile (mean < 1.80) lessons flagged
> for rewrite.** 6 near-bottom (mean 1.80-2.15) lessons flagged as
> watchlist.

---

## Rubric (applied identically by both agents)

### L1 question score (1-3)
- **3** — Tests load-bearing concept, common gotcha, or "you'd hit this bug in interviews" point. ALL FOUR distractors plausibly wrong. Cannot be passed by Reference skim alone.
- **2** — Tests something real but either (a) one distractor is obviously absurd, or (b) borderline passable by Reference pattern-match.
- **1** — Either (a) rephrases a Reference sentence directly, or (b) has weak/duplicate distractors, or (c) tests trivia, or (d) the explain text gives away the answer.

### L2 exercise score (1-3)
- **3** — Blanks isolate LOAD-BEARING tokens of the canonical idiom. Template exercises canonical SHAPE. Hint provides direction without giving the literal answer.
- **2** — Blanks meaningful but either (a) hint too direct, (b) template trivial/short, or (c) tests variable names not load-bearing tokens.
- **1** — Either (a) blank is a trivial identifier, (b) hint is literal hand-off, (c) tests typing not memory, or (d) duplicates another L2 exercise.

### Lesson aggregate
- Lesson mean = (L1 mean + L2 mean) / 2
- **Bottom-quartile flag** if Lesson mean < 1.80

---

## Combined ranking (lowest first)

| Rank | Lesson | L1 mean | L2 mean | Lesson mean | Flag |
|---|---|---|---|---|---|
| 1 | `async/s-promises` | 1.75 | **1.00** | **1.38** | 🚨 BOTTOM-QUARTILE |
| 2 | `basics/s-strings` | 2.00 | 1.50 | **1.75** | 🚨 BOTTOM-QUARTILE |
| 3 | `basics/s-template` | 1.50 | 2.00 | **1.75** | 🚨 BOTTOM-QUARTILE |
| 4 | `hash-structures/s-obj-basics` | 2.50 | **1.00** | **1.75** | 🚨 BOTTOM-QUARTILE |
| 5 | `async/s-trycatch` | 1.50 | 2.00 | **1.75** | 🚨 BOTTOM-QUARTILE |
| 6 | `basics/s-loops` | 1.75 | 2.00 | 1.88 | watchlist |
| 7 | `arrays/s-arr-index` | 2.25 | 1.50 | 1.88 | watchlist |
| 8 | `algorithms/sorting` | 2.25 | 1.50 | 1.88 | watchlist |
| 9 | `modern-syntax/destructuring-spread` | 2.50 | 1.50 | 2.00 | watchlist |
| 10 | `basics/s-strmethods` | 2.50 | 1.50 | 2.00 | watchlist |
| 11 | `arrays/array-transform` | 2.00 | 2.50 | 2.25 | watchlist |
| 12 | `classes/s-class` | 1.75 | 2.50 | 2.13 | watchlist |
| — | (remaining 39 lessons mean ≥ 2.25) | | | | OK |

**Strongest lessons (lesson mean ≥ 2.85):**
- `iterators-and-generators/s-iter-custom` — 3.00 (exemplary)
- `iterators-and-generators/s-async-iter` — 3.00 (exemplary)
- `algorithms/s-bfs-template` — 3.00 (exemplary)
- `algorithms/s-ll-traversal` — 3.00 (exemplary)
- `algorithms/s-ll-fast-slow` — 3.00 (exemplary)
- `algorithms/s-heap-ops` — 2.88
- `algorithms/s-index-math` (iter 22) — 2.67 (good but L2 hint-heavy)
- `js-toolbox/s-bitwise-toolkit` — 2.88
- `js-toolbox/s-number-parse` — 2.75
- `js-toolbox/s-math-toolkit` — 2.75
- `basics/s-functions` — 2.88
- `basics/s-numbers` — 2.75

---

## Cross-cutting themes

1. **L2 single-blank hand-off pattern.** Most-prevalent failure mode. One blank, one hint, hint is a verbal definition of the answer (e.g. `Array.from` hint: "builds an array from an iterable or array-like" → blank is `from`). Tests typing under hint, not recall under pressure. Rampant in: `s-strings`, `s-obj-basics`, `s-obj-iter`, `s-arr-create`, `s-arr-search`, `s-promises`, `s-this` (Ex1), `s-json-api` (Ex2), `s-index-math` (Ex1+Ex2 by Agent B), `s-array-from` (Ex2).
2. **L2 repetition wastes blanks.** Multiple exercises have N identical blanks (`...`, `...` or `slice`, `slice` or `at`, `at`, `push`, `push`) where the second blank tests nothing the first didn't. Seen in: `s-strmethods` Ex1, `s-arr-index` Ex2, `s-nullish` Ex1, `s-numbers` Ex2, `destructuring-spread` Ex2, `s-stack-pattern` Ex1, `s-tree-traversals` Ex2, `s-gen-delegation` Ex2.
3. **Basics-section L1 leans on Reference rephrasing.** `s-strings`, `s-template`, `s-loops` have multiple L1s that directly re-ask a Reference sentence ("Which keyword enables ${}" when the Reference's first line says "Use backticks"). Profile-wrong for a rusty engineer who already knows the basics conceptually.
4. **Async lessons under-test the gotchas.** `s-promises` and `s-trycatch` ask "what is .catch for?" and "how do you signal an error?" — definition-checks aimed at a beginner. The load-bearing async gotchas (unhandled rejection, `await` unwrapping rejections, `finally` runs before return, microtask vs macrotask ordering inside `async fns`, optional catch binding, rethrowing in catch, `Promise.resolve(thenable)` adoption) are mostly missing from L1.
5. **Class-basics L1 leans on fundamentals-pedagogy.** "When does constructor run?" with "When the file loads" as a distractor insults the target user. Same lesson's good gotcha (`new` omitted → TypeError) survives in Q2, but Q1/Q4 are throwaway.
6. **Filler distractors recur.** "throws"/"TypeError" as a fourth option when the question isn't about errors; absurd alternatives like `set.toArray()`, `arr.max()`, `Math.maxOf`, `Set.toArray()`, `raise(...)`. These let pattern-matchers skim through without engaging.
7. **Iterators/Generators + Algorithms cluster is the model.** The strongest lessons share a pattern: multi-blank L2s testing the canonical idiom's load-bearing tokens; L1 distractors that map to real other mechanics (not absurdities). `s-iter-custom`, `s-async-iter`, `s-bfs-template`, `s-ll-traversal`, `s-ll-fast-slow` should be the template for rewrites.

---

## Highest-leverage rewrites (combined ranking — iter 24+ candidates)

**Tier 1 — ship in iter 24** (5 bottom-quartile lessons; full L1+L2 overhaul):

| # | Lesson | Primary issue | Rewrite direction |
|---|---|---|---|
| 1 | `async/s-promises` (1.38) | Both L2 are single-blank hand-offs; L1 is definitions | L2: collapse to one multi-blank chain (`.then` returning value → `.then` returning promise → `.catch` → `.finally`). L1: replace 2-3 with gotchas — `Promise.resolve(thenable)` adoption, returning Promise vs value from `.then`, unhandled-rejection behavior in modern Node. |
| 2 | `basics/s-strings` (1.75) | Q1 throwaway; Ex1 one-blank hand-off | L1: replace `typeof 'hello'` with primitive-vs-wrapper (`new String("hi") === "hi"`). L2: multi-blank exercise on immutability (`s[0] = 'X'` no-op). |
| 3 | `basics/s-template` (1.75) | Q1/Q3 Reference rephrases; Ex1 is a 1-char `+` typing | L1: test escapes (`\``), tagged-template signature (`strings, ...values`), `String.raw`. L2: replace Ex1 with interpolation gotcha — nested templates or method calls inside `${}`. |
| 4 | `hash-structures/s-obj-basics` (1.75) | Both L2 are trivial identifier hand-offs | L2: blank the SYNTAX tokens (computed-key brackets `[` `]`, method-shorthand parens, separator commas) — not identifiers. |
| 5 | `async/s-trycatch` (1.75) | Q2/Q3 are trivia (`.message`, `throw new Error`); Ex1 tests keyword names | L1: finally-runs-before-return, optional catch binding, rethrowing-in-catch. L2: Ex1 should test the await-inside-try idiom, not the three keyword names. |

**Tier 2 — ship in iter 25** (watchlist; targeted fixes):

| # | Lesson | Targeted fix |
|---|---|---|
| 6 | `basics/s-loops` (1.88) | Q1/Q2 Reference rephrases. Rewrite to test do-while body-runs-once-even-on-false-condition + the "advance counter before continue" gotcha. Ex1 is a one-keyword hand-off — replace. |
| 7 | `arrays/s-arr-index` (1.88) | Ex2 repeats `at` across blanks — vary to test `.at(-arr.length)` boundary or contrast `arr[-1]` vs `arr.at(-1)` in one exercise. |
| 8 | `algorithms/sorting` (1.88) | Ex2 "Sort by age" blanks should be the comparator's `.age - .age` expression positioning, not the literal field name visible 3 lines above. Q4 should be a "you'd get the wrong order if…" scenario. |
| 9 | `modern-syntax/destructuring-spread` (2.00) | Ex1 blank should be the rename-syntax (`addr: location` form) or default `= 18`. Ex2 two identical `...` blanks → vary. |
| 10 | `basics/s-strmethods` (2.00) | Ex1: vary one blank to a different method (`substring` or `slice(-5)`). Q1 D distractor is throwaway. |
| 11 | `classes/s-class` (2.13) | Q1 "When does the constructor run?" must go. Replace with class-field syntax, `static` method semantics, or "what happens if a method references `this` after being passed to setTimeout?". Q4 — `static` vs instance method distinction. |
| 12 | `arrays/array-transform` (2.25) | Q4 is opinion-based ("All three work") — replace with `reduce` callback signature (4 args) or callback-returning-undefined-in-map behavior. |

**Tier 3 — ship in iter 26** (one-question fixes; bundle several):
- `s-class-inh` Q1 (inheritance keyword recall is too easy) → "what does `super` reference inside a static method?"
- `s-prototype` Q4 (duplicates `s-class` Q4) → `Object.create(null)` or `__proto__` vs `prototype` distinction
- `s-array-from` Q3 distractors weak
- `s-json-api` Q3 (which arg is indent) trivia → replacer-array semantics
- `s-this` Ex1 too thin/hinted → add "what is `this` inside `setTimeout(user.greet, 0)`?"

---

## Open questions for the user

1. **Do you want each rewrite to preserve the existing L1/L2 count, or expand?** (e.g. `s-promises` currently has 2 L2; the proposed multi-blank chain would still be 2 L2, just better. But Tier 1 #2 `s-strings` proposes adding an immutability test which would push from 2 L2 → 3 L2.)
2. **For the rewrite ships, is parallel agent OK, or single-author for consistency?** (iter 20 used 3 parallel agents successfully for 6 NEW lessons; rewrites need more care to preserve what's working in each lesson, so single-author per lesson is safer but slower.)
3. **Bottom-quartile threshold:** 1.80 caught 5 lessons (~10% of syntax track). Move threshold to 2.00 to catch the ~12 in Tier 2 as well? Or keep tiered approach as listed?
