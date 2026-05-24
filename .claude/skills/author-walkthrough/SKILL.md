---
name: author-walkthrough
description: Author the `walkthrough` block on an existing Patterns or Applied lesson — the interactive line-by-line stepper. Forces a trace-function-first workflow where the trace is a JS generator that yields {line, label, state} per step, evaluated at runtime against picked example inputs. Bundles the schema, the trace-function patterns, the validator step, and the exemplar references. Use when adding walkthrough to a single lesson, a batch from a sub-agent, or filling a topical gap.
---

# author-walkthrough

You are adding the `walkthrough` block to one or more existing Patterns/Applied lessons. The block enables an interactive line-by-line stepper UI (Jupyter-style) where users pick an example input and scrub through the canonical solution one statement at a time, seeing locals evolve in a state panel.

This is the **lower-risk, machine-verifiable layer**. The validator compiles your trace function, runs it on each example, and asserts the final `returns` value matches the declared `expected`. There is no way to ship a broken walkthrough past the validator. Lean on this.

## Required reading (load now, before writing anything)

1. `CLAUDE.md` — § "How a lesson is structured" + § "Runner semantics" + § "Common authoring pitfalls"
2. The **canonical exemplar**: `data/sliding-window/p-longest-sub.json` — read the entire `walkthrough` block. The trace function shape, example labels, and yielded state objects are the format spec.
3. **2-3 shape-matched exemplars** for the lessons you're authoring (e.g., if authoring two-pointers lessons, read `data/two-pointers/p-valid-palindrome.json`'s walkthrough). Find these via `ls data/<slug>/*.json` and pick existing walkthroughs from that section or an analogous shape.
4. The lesson's own `reference.code` — your trace function must mirror this code's logic with the same line numbers.

## The schema

Add a `walkthrough` block to the lesson JSON, alongside `conversation` / `reference` / `L1` / `L2` / `L3`:

```jsonc
"walkthrough": {
  "intro": "One sentence orienting the user. Optional but recommended.",
  "examples": [
    { "label": "\"abcabcbb\" → 3", "input": "abcabcbb", "expected": 3 },
    { "label": "\"bbbbb\" → 1",    "input": "bbbbb",    "expected": 1 },
    { "label": "\"pwwkew\" → 3",   "input": "pwwkew",   "expected": 3 }
  ],
  "trace": [
    "function* trace(input) {",
    "  yield { line: 1, label: `enter function — input \"${input}\"`, state: { input } };",
    "  const seen = new Set();",
    "  yield { line: 2, label: 'init seen (empty Set)', state: { input, seen: [] } };",
    "  // ... etc"
    "}"
  ]
}
```

Field discipline:
- `intro` — optional. One sentence. Skip if it would be filler.
- `examples` — **3 examples minimum**: a typical case, a degenerate/edge case, and a third (often matching the L3 prompt's input). Each has `label` (display string with `→` separator), `input` (the actual argument value — string, array, number, whatever the canonical takes), and **`expected`** (the value the function returns — this is what the validator asserts).
- `trace` — an **array of strings**. The validator joins with `\n` and feeds to `new Function('input', source + 'return trace(input);')`. Array form is for JSON readability; single-string form also works but is harder to author.

## Step 1 — Identify the lessons

For each lesson you're authoring, write down: `id`, `slug` (folder), `reference.code` line range you'll trace, the canonical's input type, and the function name. Group lessons by shape — same-shape lessons share trace patterns and can be authored faster as a batch.

## Step 2 — Pick the 3 example inputs per lesson

The examples must cover:
1. **A typical case** — the input that best demonstrates the algorithm's normal behavior (often the canonical example: `"abcabcbb"`, `[2,7,11,15] target=9`, `[1,2,3,4]`, etc.).
2. **A degenerate/edge case** — one that exercises the shrink/expand/branching logic at extreme: all-same-character, single-element, empty (if defined), max-shrinking case, all-unique, etc.
3. **The L3 prompt's input** if it's distinct from #1 — gives the user a sanity check they can mentally run against L3.

If the L3 input is the same as #1, replace #3 with another interesting case (a longer input, a case where the answer comes from the middle, etc.).

## Step 3 — Write the trace function (the load-bearing step)

The trace function has this contract:

```js
function* trace(input) {
  // yield { line: N, label: 'short narrative', state: { /* relevant locals */ } };
  // ... your algorithm with yields between meaningful steps ...
}
```

**Yield discipline — this is what separates a good walkthrough from a noisy one:**

- **Yield ONCE per state-changing or branch-deciding step.** Not every line. Yields after `let l = 0, best = 0;` is one step (init both); a yield after every micro-statement (separate yield for `l = 0` then `best = 0`) is noise.
- **Yield BEFORE entering a loop iteration** (`for (let r = 0; r < n; r++) { yield ... }` — this captures "outer step starts"), and after each meaningful inner branch (after a shrink, after an add, after a set/delete).
- **Aim for 30-60 total steps per example.** More than ~70 is unscrollable; fewer than ~20 misses important transitions.
- **Use the actual line number from `reference.code`.** Open the canonical, count lines starting at 1, and use those numbers in `yield { line: N }`. Comment-only lines are valid line numbers; pick the most representative line for the statement that just ran.
- **The `state` object** is a flat key→value map of the locals at that point. Spread Sets and Maps to arrays so they JSON-serialize cleanly: `seen: [...seen]`, `counts: [...counts.entries()]`. Don't include `this` or DOM-y values.
- **The `label`** is a short narrative — what just happened, with concrete values templated in: `` `outer step: r=${r}, char='${input[r]}'` ``, `` `delete s[${l}]='${input[l]}' from seen` ``, `` `best = max(prev_best, r-l+1) → ${best}` ``. Avoid generic labels ("step 5", "iterate") — labels are what make the walkthrough teach.
- **Final yield** must include `returns: <value>` in the state object, where `<value>` matches the example's `expected`. This is what the validator checks.

**Handling multi-arg canonicals (e.g. `twoSum(nums, target)`):**
The trace function takes a single `input` parameter. For canonicals taking multiple args, wrap them as an object:
```jsonc
"examples": [
  { "label": "[2,7,11,15] target=9 → [0,1]", "input": { "nums": [2,7,11,15], "target": 9 }, "expected": "[0,1]" }
]
```
And unpack inside the trace: `function* trace(input) { const { nums, target } = input; ... }`.

**Handling non-primitive returns (arrays, objects):**
The validator does `String(got) !== String(expected)`. For arrays/objects, JSON-stringify on BOTH sides so the comparison is string-vs-string:
- In the trace: `yield { line: N, ..., state: { ..., returns: JSON.stringify([seen.get(need), i]) } }` → yields the string `"[0,1]"`
- In the example: `"expected": "[0,1]"` (the JSON-string form, not the raw array)

For boolean / number / string returns, use the literal value on both sides:
- `"expected": true`, trace yields `returns: true`
- `"expected": 3`, trace yields `returns: best`

**Handling class-based canonicals (e.g. Min Stack, LRU Cache, Trie, Heap, EventEmitter):**
Model the input as an **array of operation objects** with shape `{ op: 'methodName', arg?: value }` (or `args: [...]` for multi-arg methods). The trace constructs the data structure inline using plain primitives that mirror what the class's constructor would set up (e.g. two arrays for Min Stack's `vals` + `mins` — no need to actually `new` the class), then loops `for (const { op, arg } of input)` and dispatches via `if/else` to inline simulations of each method, yielding the relevant state slice after each operation. To produce a single `returns` value the validator can check, **collect every observation-method's return value into a `results` array** during the run (for Min Stack: every `getMin` + `top` result; for Trie: every `search` + `startsWith` result), and yield `returns: JSON.stringify(results)` on the final step with the example's `expected` set to the matching JSON string. The example `label` should narrate the op sequence inline (e.g. `"push(-2), push(0), getMin→-2, pop, top→0"`) so users see what they're about to step through.

**Handling bit-manipulation canonicals:**
JS bitwise ops produce **signed int32** — negative intermediate values (or values ≥ 2³¹) will produce wrong-looking 32-bit strings under naive `.toString(2)`. Always coerce: define `const bin = (x) => (x >>> 0).toString(2).padStart(N, '0')` at the top of the trace and use it inside `state` yields to show every relevant integer in BOTH decimal AND binary (e.g. `result: \`${result} (${bin(result)})\``). Pick padding width to match the algorithm's bit-width (4 for small loops, 8 for byte-sized values, 32 for full-int problems like Reverse Bits). Without this, the pedagogical bit-flow story breaks for any value with the high bit set, and the walkthrough loses its core teaching value for bit ops.

**Banned anti-patterns:**
- Don't access the DOM. The trace function runs in an eval'd context with no DOM.
- Don't use `require()`, `import`, `fetch`, or globals beyond standard ECMAScript.
- Don't put template literals with backticks inside template literals (no nesting); use string concatenation if you need nested interpolation.
- Don't include comments inside the trace function array if you can avoid it — the array form is for readable JSON, not for code comments. Put narrative in `label` instead.
- Don't yield more than 2-3 times for the same line in the same iteration — if you find yourself doing this, the line is fine-grained and one yield is enough.

## Step 4 — Validate

```bash
node tools/validate-data.js
```

This will:
- Compile your trace via `new Function`. Compile errors here mean a syntax bug in your trace.
- Run the trace on every example. Runtime errors here mean a logic bug (the trace doesn't match the canonical's semantics on that input).
- For every example with `expected` declared, assert `state.returns` on the final yielded step matches. **Returns-mismatch means your trace's final value doesn't match what the canonical produces for that input.**

If ANY of those three fails, fix and re-run. A passing validator is the bar; do not declare a lesson "done" until validator is green.

## Step 5 — Spot-check the browser

Once a batch is in:

```bash
node tools/cdp/walkthrough-tab.js
```

If the existing probe passes, the engine is wired and your lesson's trace will render. For broader confidence, you can write a one-off probe that lands on your specific lesson — but this is optional; the validator's compile+run+returns check is the load-bearing gate.

## Common authoring pitfalls (read this before writing your first trace)

- **Line numbers drift after canonical edits.** If you later refactor `reference.code`, the trace's line numbers may now point at wrong lines. Re-validate. (The validator can't catch this — it only checks `returns`.)
- **Sets/Maps stringify badly.** A bare `Set` in `state` serializes as `{}` in the renderer. Always spread to array: `[...seen]`, `[...map.entries()]`.
- **`input[l]` when `l` is past end** returns `undefined` — fine inside guarded code (e.g., inner while), but if you yield with this in the label string template, you'll get the literal "undefined" rendered. Guard it: `input[l] ?? '(end)'`.
- **JSON escaping.** Inside the trace string array, single quotes don't need escaping. Backticks don't either. Double quotes do (because they delimit the JSON string).
- **Don't mutate `state` after yielding.** Each yield's state object is captured by reference. If you mutate the same Set then yield again, both yields will reflect the latest state. Always spread (`[...seen]`) when yielding — never yield the live Set.

## Checklist before declaring a lesson done

- [ ] `walkthrough` block present with `intro` (optional), `examples` (3+), `trace` (array of source lines)
- [ ] Every example has `label`, `input`, `expected`
- [ ] Trace function compiles (`node tools/validate-data.js` shows no compile error for this lesson)
- [ ] Trace function runs on every example without throwing
- [ ] Final step's `state.returns` matches `expected` for every example
- [ ] Line numbers in `yield { line: N }` align with `reference.code`
- [ ] Labels are concrete (templated with current values), not generic
- [ ] Total step count per example is between ~20 and ~70
