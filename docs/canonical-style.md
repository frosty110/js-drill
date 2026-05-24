# Canonical Style Guide

> **The rule**: canonical solutions use the idiom that matches the problem shape, not a global preference.
>
> Drilling the wrong idiom for the shape is worse than drilling either idiom in isolation, because the user internalizes a tool for the wrong situation. An interviewer would notice.

This doc tells you (and any agent authoring lessons) how to pick the idiom for a `reference.code` / `L3.canonical`, and what to write in the `description` field so the user understands *why* this shape gets this idiom.

---

## The two shapes

Almost every lesson canonical falls into one of two shapes. The idiom follows the shape.

### Shape A — Collection transform

You have a collection. You want another collection (or a single aggregate) where every element was processed the same way. There's no index-dependent logic, no early exit, no fused passes that share state.

**Idiom**: `.map` / `.filter` / `.reduce` / `.flatMap` / `.some` / `.every` / `.find`.

**Tell**: you can describe the operation as "for each element, do X" *without* needing to say "and also remember position / break early / look at the next one."

**Examples**:
- Extract a field from every object → `arr.map(x => x.id)`
- Keep elements that match a predicate → `arr.filter(isActive)`
- Sum / count / group → `arr.reduce(...)`
- "Any / all" checks → `.some` / `.every`

### Shape B — Algorithm

The iteration itself is part of the answer. You need index access, early exit, two pointers, sliding window, fused multi-purpose passes, or in-place mutation.

**Idiom**: `for` / `for...of` / `while`.

**Tell**: the iteration carries state that isn't a clean fold (left/right pointers, a window, a `found` flag, a counter you reset, etc.) OR you need to stop before the end OR you need `i` and `i-1` together OR the loop body branches into multiple early-exit cases.

**Examples**:
- Two-sum with hash map → single `for` with early `return`
- Sliding window → `while` or `for` with `left`/`right` pointers
- Tree/graph traversal with a stack/queue → `while (stack.length)`
- Reversing in place → `for` with two-index swap

---

## Borderline cases — how to break ties

When a problem could be written either way, ask:

1. **Would the algorithm pattern be visible in the chained form?**
   "Find the longest subarray with sum ≤ k" *can* be done with `.reduce`, but the sliding window is the *content* — hide it and you've drilled the wrong thing. → `for`.

2. **Is the operation genuinely "transform each / keep some / fold"?**
   "Double every number" via `for` is a missed teaching opportunity. → `.map`.

3. **Does single-pass `for` save real work over a chain?**
   `arr.filter(p).map(f).reduce(g)` is three passes + two allocations. If the lesson is *about* that combined operation, use `for`. If the lesson is about each method in isolation, chain them and *say so in the description*.

4. **Do you need the index, the neighbor, or early exit?**
   Yes → `for`. No → consider the method.

---

## Banned syntax (validator-enforced)

These never appear in `reference.code`, `L2.exercises[*].template`, or `L3.canonical`. They are rare-or-never in modern JS and shouldn't take up canonical real estate:

| Banned | Why |
|---|---|
| `do { ... } while (...)` | The `while` form covers every realistic case. The post-test loop is a curiosity, not a tool. |
| `with (...)` | Forbidden in strict mode anyway. |
| `var` | `let` / `const` cover all real uses; mixing introduces hoisting confusion. |
| Labeled `break` / `continue` (e.g. `outer:`) | Restructure with a helper function or a flag. Real codebases almost never use these. |
| Comma operator in expression position (e.g. `a = (b++, c)`) | Almost always a code smell; clearer to split into statements. |
| `void 0` / `void expr` | Use `undefined` directly. |

If a canonical genuinely needs one of these for pedagogical reasons (e.g. a lesson *about* `var` hoisting), that lesson is the exception, and the file should say so in `description`. Otherwise the validator fails the build.

(See `tools/validate-data.js` for the regex check.)

---

## Style preferences (not enforced, but the bar)

These aren't validator rules — they're the bar for what makes a canonical feel like real-world JS:

- **`const` by default, `let` when reassignment is real, never `var`.**
- **`for...of` over `for (let i = 0; i < arr.length; i++)` when you don't need the index.** The index-based form is correct when you need `i` or you're mutating in place.
- **Arrow functions for short callbacks, named `function` for hoisted top-level helpers.**
- **Destructure where it clarifies** (`const [a, b] = pair`, `const { id, name } = user`), don't destructure to hit a checkbox.
- **Template literals over string concatenation.**
- **Optional chaining and nullish coalescing where the alternative is a defensive `&&` chain.**
- **No `Array.prototype.forEach` for transforms or aggregations.** `forEach` is fine for side effects; use `.map` / `.reduce` when you want a return value. (`forEach` is the "I want a `for` loop but with worse perf and no early exit" trap.)
- **No `arguments` object in arrow-function-era code.** Use rest params `(...args)`.

---

## What the `description` field should say

The `description` is one sentence that gives the user the *why* before they read the reference. For lessons where idiom choice matters, the description should name the shape.

**Patterns lesson template**:

> Solve [problem] with a [pattern name] — single pass [for|while] because [reason: need index / early exit / two pointers / window state].

**Syntax lesson template** (for the array-methods section):

> Use `.[method]` when you need to [transform each / keep some / fold / find one] — it returns [shape] and reads as [intent].

**Examples**:

- `two-sum.json`: "Find a pair summing to target in a single `for` pass, using a hash map to remember complements — we need early return on the match, so this is algorithm-shape, not a `.map`."
- `array-iteration.json` (`.map`): "Transform every element of an array into a new array with `.map` — collection-transform shape, no index or early exit, so the method beats a `for` loop on intent."
- `s-arr-search.json` (`.find` / `.findIndex`): "Locate the first element matching a predicate with `.find` — clearer than `for` when you only need the match, not the index logic."

The description is the **load-bearing signal** for the user about *why this idiom*. Don't waste it on restating the title.

---

## Common smells (what to fix when auditing)

- **Chained methods hiding an algorithm.** `arr.filter(p).reduce(g, 0)` where the lesson is really "single-pass sum-if" — rewrite as `for`.
- **`for` loop doing a pure transform.** `for (let i = 0; i < arr.length; i++) out.push(arr[i] * 2)` where the lesson has nothing to do with iteration — rewrite as `.map`.
- **`forEach` with `push`.** Almost always wants to be `.map` or `.filter`.
- **`reduce` for a count.** `arr.reduce((acc, x) => acc + (cond ? 1 : 0), 0)` is harder to read than `arr.filter(cond).length` (or a `for` with `count++` if perf matters). Pick the one that names the intent.
- **`reduce` with destructured accumulator object** doing four things at once — usually the lesson would be clearer as a `for` with named locals.
- **Index-based `for` where `for...of` works.** Drop the index if you don't use it.

---

## Track-by-track defaults

| Track | Default idiom | Exceptions |
|---|---|---|
| **Syntax — JS Toolbox, Iterators & Generators, Arrays (array methods)** | `.map` / `.filter` / `.reduce` / `for...of` / generators — the methods *are* the lesson | Use `for` only when the lesson is specifically about `for` / `while` / index iteration |
| **Syntax — Basics, Hash Structures, Modern Syntax, Classes, Async, Advanced JS, Algorithms** | Whatever idiom the lesson is teaching | n/a — these aren't iteration lessons primarily |
| **Patterns (all 17 sections)** | `for` / `while` — algorithm shape | Use a method when the inner operation genuinely is a pure transform (e.g. building a result list with `.map` after the algorithm has computed indices) |
| **Applied (20 lessons)** | Match real-world JS — usually `.map` / `.filter` / `.reduce` for the data layer, `for` / `while` for any state machine or game loop | The judgment call is "what would the rusty-but-experienced engineer write in production code?" |

---

## When the validator catches you

`tools/validate-data.js` runs the banned-syntax check across all 143 lesson files. If it fails, you'll see:

```
FAIL  data/<section>/<lesson>.json
  reference.code: banned token `do {` at line 14
```

Fix the canonical to use the allowed idiom, or — if the lesson is genuinely *about* the banned construct — add the file's id to the `BANNED_SYNTAX_EXEMPTIONS` array at the top of `tools/validate-data.js` with a one-line comment explaining the exemption.
