# Conversation + Walkthrough tabs — architecture & maintenance

> Two opt-in lesson surfaces that ship across all 99 Patterns + Applied
> lessons. Rolled out in a single out-of-band session 2026-05-24 (see
> `SELF-IMPROVE.md` OOB row). This doc captures everything a future
> author, debugger, or maintainer needs to extend or fix them.

## TL;DR

- **Conversation tab**: opt-in `conversation` block on a lesson. Renders as the leftmost tab. Six collapsible sections simulating an interview narration (clarify → brute force → spot pattern → trace examples → edges → complexity). Each section has a SAY block (teal — what you'd verbalize) and a WHY block (amber — coaching footnote). Pure content; no engine.
- **Walkthrough tab**: opt-in `walkthrough` block. Renders between Conversation and Reference. Interactive Jupyter-style line-by-line stepper — pick an example input, scrub through the canonical with current-line highlight + state panel. Engine compiles the trace generator at runtime via `new Function`.
- **Tab order on Patterns/Applied**: Conversation → Walkthrough → Reference → L1 → L2 → L3 (6 tabs, horizontally scrollable on mobile).
- **Tab order on Syntax**: Reference → L1 → L2 → L3 (4 tabs, unchanged).
- Tabs are independent: a lesson can have both, either, or neither. The
  Walkthrough engine, the renderer, and the CSS all handle absence gracefully.

## Schema

Both blocks sit at the top of a lesson JSON, alongside `reference` / `L1` / `L2` / `L3`. Order in file (by convention): `conversation` → `walkthrough` → `reference` → tiers.

### `conversation`

```jsonc
"conversation": {
  "intro": "Optional preamble shown above all sections.",
  "sections": [
    {
      "title": "1. Restate & clarify",
      "prompt": "Italic subtitle, always visible.",
      "say":   "What you'd verbalize — quoted speech preferred.",
      "why":   "Why this move matters — the coaching voice."
    },
    {
      "title": "4. Trace through examples",
      "prompt": "Walk a few inputs before writing the loop.",
      "intro":  "Optional intro paragraph before the examples.",
      "examples": [
        {
          "input":  "\"abcabcbb\"",
          "output": "3",
          "note":   "Optional one-line context.",
          "trace":  "Pre-formatted monospace trace text.\nMulti-line via \\n."
        }
      ],
      "why": "Rationale for tracing examples."
    }
  ]
}
```

**Field rules** (enforced by `tools/validate-data.js`):
- `sections.length >= 3`
- Every section has a `title`
- Every section has at least one body field: `say` | `why` | `reveal` | `examples`
- Anything beyond is renderer-permissive (missing prompt → no italic subtitle, missing intro → no preamble, etc.)

`reveal` is legacy from the v0 prototype — single body block, neutral slate accent. Still rendered for backward compatibility; new lessons should not use it.

### `walkthrough`

```jsonc
"walkthrough": {
  "intro": "Optional one-sentence orienting note.",
  "examples": [
    {
      "label":    "\"abcabcbb\" → 3",  // display string with → separator
      "input":    "abcabcbb",           // arg(s) — see "Input shapes" below
      "expected": 3                     // primitive OR JSON-string for non-primitive
    }
  ],
  "trace": [
    "function* trace(input) {",
    "  yield { line: 1, label: 'enter', state: { input } };",
    "  // ...",
    "  yield { line: N, label: 'return', state: { returns: <value> } };",
    "}"
  ]
}
```

**`trace`** is an **array of strings** (joined with `\n` at compile time). Array form is for JSON readability; single-string form also works. The author writes a complete generator function named exactly `trace` that takes one `input` argument and yields step objects.

**Yield contract**: each yield is `{ line: <1-indexed line of reference.code>, label: <short narrative string>, state: <flat key→value object> }`.

**Validator runs** (mechanical, no human review needed):
- Compiles trace via `new Function('input', '"use strict";\n' + src + '\nreturn trace(input);')`. Compile error → fail.
- For every example: spreads the generator into an array. Runtime error → fail.
- If `expected` is declared: asserts `String(steps[last].state.returns) === String(expected)`. Mismatch → fail.

## Input shapes (the load-bearing decisions)

The trace function takes ONE `input` arg. Map your canonical's signature to one of these patterns:

| Canonical signature | `input` shape | Example |
|---|---|---|
| `fn(arr)` single arg | the arg directly | `input: [1,2,3]` |
| `fn(a, b)` multi-arg | object, destructure inside trace | `input: { nums: [1,2], target: 3 }` |
| `class.method(...)` (Min-Stack, LRU, Trie, EventEmitter, etc.) | operation array | `input: [{op:'push', arg:5}, {op:'pop'}, ...]` |
| `fn(linkedList)` | array of values; rebuild list inside trace | `input: [1,2,3,4]` |
| `fn(tree)` | LeetCode level-order array; rebuild tree inside trace | `input: [3,9,20,null,null,15,7]` |
| `fn(grid)` matrix | `{ grid: [[...]] }` or `{ matrix: [[...]] }` | clone via `grid.map(r => r.slice())` |
| `fn(graph)` adjacency | depends — `{adj: [[...]]}` for graphs, `{numCourses, prerequisites}` for course-schedule | rebuild Node objects inside trace |
| Async / timing (debounce, throttle, promise.all) | `{ delay, calls: [{at, args}] }` or `{ promises: [{resolveAfter, value}] }` — simulate timing synchronously | trace yields once per "event" |
| Function-returning-function (curry, memoize) | `{ calls: [[args1], [args2]] }` + inline a deterministic example fn | results array collected for `returns` |

## Return value handling

The validator does `String(got) !== String(expected)`. Stringify discipline:

| Return type | `expected` form | Trace's final `state.returns` form |
|---|---|---|
| primitive (number, string, boolean, null) | literal: `3`, `"abc"`, `true`, `null` | literal: `returns: 3` |
| array | JSON-string: `"[0,1]"` | `returns: JSON.stringify([0,1])` |
| object | JSON-string: `"{\"a\":1}"` | `returns: JSON.stringify(obj)` |
| linked list (returns a list) | JSON-string of flattened array: `"[5,4,3,2,1]"` | `returns: JSON.stringify(toArr(head))` |
| tree (returns a tree) | JSON-string of level-order array | `returns: JSON.stringify(toLevelOrder(root))` |
| class observations (results across ops) | JSON-string of results array | `returns: JSON.stringify(results)` |

For `getMin`/`peek`/`search`/`get`/`startsWith` etc. on class lessons, collect every observation method's return into a `results = []` array as you process the operation sequence, then yield `returns: JSON.stringify(results)` on the final step.

## Engine internals (`app.js`)

### Tab list construction (`renderLesson`)

```js
const tabDefs = [];
if (content.conversation) tabDefs.push({ id: 'conversation', ... });
if (content.walkthrough)  tabDefs.push({ id: 'walkthrough',  ... });
tabDefs.push({ id: 'reference', ... }, { id: 'L1', ... }, ...);
```

`state.currentTab` carries a sentinel `'auto'` until the first render — `renderLesson` resolves it to `tabDefs[0].id` (Conversation if present, else Reference). Same logic handles the case where you navigate from a lesson with Conversation to one without (the resume-allowlist falls back).

`data-level` attribute on each `.tab-btn` carries the tab id (`conversation` / `walkthrough` / `reference` / `L1` / `L2` / `L3`). `updateLessonHeaderInPlace` reads this when stamping the ✓ marker — don't zip by DOM index, the tab list is variable-length.

### Walkthrough compile cache

```js
const _walkthroughCache = {}; // { [lessonId]: { byExample: [{example, steps, error}], error } | { error } }
```

Each lesson's trace is compiled once via `new Function` and its examples drained into step arrays. Subsequent tab visits hit the cache. If the trace throws at compile or runtime, the error is cached too and surfaced inline.

### Per-tab UI state (in-progress cache)

The Walkthrough tab participates in the existing `inProgressCache` pattern (BS-12 fix from iter 21). `uiState = { exampleIdx, stepIdx }` is cached per `(lessonId, 'walkthrough')` — switching to Reference and back restores your position. Switching lessons clears it.

### CSS color system

| Block type | Border / accent | Use |
|---|---|---|
| `.conv-intro` | violet `#a78bfa` left border | Conversation tab preamble |
| `.conv-block.conv-say` | teal `#22d3ee` left border, cyan label | What you'd say (script voice) |
| `.conv-block.conv-why` | amber `#f59e0b` left border, italic body | Why this matters (coaching) |
| `.conv-examples-block` | violet `#a78bfa` left border | Container for worked examples |
| `.conv-example` (nested) | violet toggle when open | Per-example collapsible |
| `.walk-intro` | violet `#a78bfa` left border | Walkthrough orienting note |
| `.walk-label-bar` | violet `#a78bfa` left border | Current step's narrative |
| `.walk-line.active` | amber `#fbbf24` band + bold gutter | Currently-executing line |

The violet thread connects Walkthrough chrome to Conversation worked-examples (they're the same pedagogical surface, just static vs interactive). Teal/amber binary inside Conversation sections is the SAY/WHY split.

## Authoring a new walkthrough

Use the `author-walkthrough` skill (`.claude/skills/author-walkthrough/SKILL.md`) — bundles all the patterns. The short version:

1. Read the lesson's `reference.code` and count lines 1-indexed.
2. Pick 3 examples: typical / edge-degenerate / L3-prompt-input (or a third interesting case).
3. Write `function* trace(input) { ... }` mirroring the canonical's logic. Yield once per state-changing or branch-deciding step (NOT every line). Aim 20-50 steps per example for typical inputs; degenerate inputs can yield 3-10 steps.
4. State object: only the locals that actually inform understanding at that line. Spread Sets/Maps to arrays (`[...seen]`, `[...map.entries()]`). Never yield a live mutable reference — always spread/snapshot.
5. Final yield includes `returns: <value>` matching the example's `expected`.
6. `node tools/validate-data.js` — must pass without any new failures.

## Authoring a new conversation

Use the `author-conversation` skill (`.claude/skills/author-conversation/SKILL.md`). The short version:

1. Read the lesson + the shape-matched exemplar (e.g., for two-pointers lessons, read `data/two-pointers/valid-palindrome.json`).
2. Six sections in fixed order. Section 4 (`Trace through examples`) MUST use the same inputs as the walkthrough's examples — so the two tabs tell the same story.
3. SAY in first-person with quoted speech: `"\"Let me make sure I have this right: ...\""`. WHY in coaching register, distinct rationale per section (no copy-paste).
4. Section 3 (Spot the pattern) is load-bearing: name both the data structure AND the structural property that makes it apply. Not "use a stack" — "monotonic decreasing stack of indices because we need the NEXT GREATER element".
5. Section 6 (Complexity) should defend the bound with the actual amortization argument, and include an unprompted extension (a related problem using the same template) to show template-thinking.
6. `node tools/validate-data.js` — structural check only; voice quality is on you. Eyeball the rendered output via `http://localhost:8765/`.

## Per-shape pattern library (surfaced during the rollout)

For future authors picking up a new lesson, here's the trace pattern that worked for each shape family. Always cross-reference the shipped exemplar in that section.

### Hash-map (Arrays & Hashing)
- Map state: `[...map.entries()]` (or `[...set]` for Sets)
- Multi-arg → object input
- Array-of-arrays return (Group Anagrams) → JSON.stringify both sides
- Encode/Decode style (two-function round-trip) → trace the round-trip end-to-end, return decoded
- **Exemplar**: `data/arrays-and-hashing/two-sum.json`

### Two-pointers
- Compress prep step (sort, normalize) to ONE yield, not multiple
- Variable-length traces are OK (short-circuit cases are the lesson)
- Sort-mutates-input → clone via `input.slice()` at top
- **Exemplar**: `data/two-pointers/valid-palindrome.json` + `p-3sum.json`

### Sliding window
- Yield BEFORE each outer iteration (captures "step starts") and AFTER each meaningful inner branch
- Deque → spread to array; also expose `dqValues` mapping deque indices to values (load-bearing for monotonic-deque)
- **Exemplar**: `data/sliding-window/p-longest-sub.json` (also the primary exemplar overall)

### Stack
- Two yield tiers for monotonic stacks: per outer-i + per inner-while-pop. Don't drop the inner — the cascade is the teaching.
- Class-based (Min-Stack) → operation-array input pattern (see below)
- Sentinel-append yield should be explicit for histogram-style problems
- **Exemplar**: `data/stack/p-min-stack.json` (class-based) + `p-largest-rect-hist.json` (monotonic)

### Binary search
- Multi-arg → object input
- Always yield `l`, `r`, `m`, `midVal` per iteration
- For rotated: also yield `sortedHalf` (which side identified as sorted)
- For binary-search-on-answer (Koko): yield `lo`, `hi`, `mid`, plus `hours`/`ok` from feasibility
- Log-n traces are naturally short (5-15 steps) — don't pad
- **Exemplar**: `data/binary-search/binary-search.json`

### Linked list (CRITICAL — list rebuild pattern)
- Input is array of values; rebuild inside trace:
  ```js
  const dummy = { val: null, next: null }; let tail = dummy;
  for (const v of input) { tail.next = { val: v, next: null }; tail = tail.next; }
  let head = dummy.next;
  ```
- State visualization: define `const toArr = (n) => { const out = []; while (n) { out.push(n.val); n = n.next; } return out; }` and use `list: toArr(head)` in yields
- For cycle problems: input is `{ values, cycleAt }` (cycleAt = index where tail loops back, -1 for no cycle)
- For multi-list: input is `{ a: [...], b: [...] }` or `{ lists: [[...]] }`
- Safety stops on potentially-infinite loops
- **Exemplar**: `data/linked-list/p-reverse-list.json` + `p-cycle.json`

### Trees (CRITICAL — tree rebuild pattern)
- Input is LeetCode level-order array (e.g. `[3, 9, 20, null, null, 15, 7]`)
- Rebuild inside trace from array using BFS-style queue assignment
- State shows the original `treeShape` (array) as visual proxy; don't try to render live tree
- Convert recursive canonicals to **iterative explicit-stack simulations** in the trace — cleaner generator yielding than `yield*` through recursion (though both work)
- For tree-returning canonicals (Invert, Construct): run `toLevelOrder` on the result for the JSON-string return
- **Exemplar**: `data/trees/p-max-depth.json` + `p-bfs.json` + `p-invert.json`

### Tries
- Class-based (Trie) → operation-array
- For tries inside grid DFS (Word Search II): use `function* dfs(...)` + `yield* dfs(...)` for recursive yields
- Trie state: nested object via recursive snapshot helper, PLUS a flat `words` array for human readability
- Board mutation discipline: snapshot via `board.map(row => row.slice())` on every yield
- **Exemplar**: `data/tries/p-trie.json` + `p-word-search-ii.json`

### Heap
- Heap state: spread to array (`heap: [...heap]`); root at index 0, children at 2i+1/2i+2
- Class-based (Min-Heap, Median Data Stream) → operation-array + `results` array for observations
- For Two-Heap (Median Stream): inline BOTH heap helpers (`loPush`/`loPop` for max, `hiPush`/`hiPop` for min) inside the trace
- **Exemplar**: `data/heap/p-min-heap.json`

### Graphs
- Matrix DFS (Islands): clone grid at top, mark-and-restore or sink-to-zero discipline
- Adjacency-list: `input: { numCourses: N, prerequisites: [[...]] }`
- Clone Graph: input is adjacency array `[[1,3],[0,2],[1,3],[0,2]]`; trace builds Node objects then runs algorithm; flatten clone back via BFS for return
- Pacific Atlantic: clone grid; multi-source BFS from each ocean
- For union-find: yield `parents` map per union
- Recursive-DFS lessons: use explicit stack in trace (cleaner than `yield*` for void recursions)
- **Exemplar**: `data/graphs/p-islands.json` + `p-clone-graph.json` + `p-pacific-atlantic.json`

### Greedy
- Single-pass with running state — yield once per outer iteration showing how running state evolves
- Capture `prevReach`/`prevBest` BEFORE assignment so labels can show both operands
- Add `else` arm yields so non-action iterations don't look like dead steps
- **Exemplar**: `data/greedy/p-max-subarray.json` (Kadane's)

### DP (1D)
- Even for rolling-scalar canonicals (Climbing Stairs), synthesize a `dp` array alongside the rolling vars for state visualization
- Coin Change: yield once per outer `a` with compact `tries` summary in label (not per inner coin)
- Infinity → render as `"Inf"` via `show()` helper; bare `Infinity` JSON-serializes to `null`
- **Exemplar**: `data/dynamic-programming/p-climbing-stairs.json` + `p-coin-change.json`

### DP (2D)
- Yield once per cell fill: `state: { i, j, dp: dp.map(row => row.slice()) }`
- Per-cell label narrates the recurrence: `dp[i][j] = max(dp[i-1][j], dp[i][j-1]) = ${dp[i][j]}`
- KEEP MATRICES SMALL — 4x4 max for examples (more = unscrollable trace)
- Expose `lastFilled: [i, j]` for renderer-side highlighting if useful
- **Exemplar**: `data/dynamic-programming/p-edit-distance.json` + `p-longest-common-subseq.json`

### Backtracking
- Use `function* dfs(...)` + `yield* dfs(...)` for recursive yields
- Yield BEFORE each recursive call (push) AND after each backtrack (pop)
- State: `current` partial solution, `result` (snapshot via `result.map(r => [...r])`), `used` set, depth
- KEEP INPUTS SMALL — `[1,2,3]` for subsets/permutations, 3x3 grid for word-search, etc.
- For boolean DFS (word-search): `found = yield* dfs(...)` captures the generator's return value
- **Exemplar**: `data/backtracking/p-subsets.json` + `p-word-search.json`

### Bit manipulation
- Always show numbers in BOTH decimal AND binary in state — define `const bin = (x) => (x >>> 0).toString(2).padStart(N, '0')` at the top
- The `>>> 0` coercion is essential — naive `.toString(2)` on negatives or values ≥ 2³¹ produces wrong-looking strings
- Padding widths: 4 for small loops, 8 for byte values, 32 for full-int problems (Reverse Bits)
- Without binary representation in state, the walkthrough loses its core teaching value for bit ops
- **Exemplar**: `data/bit-manipulation/p-reverse-bits.json` + `p-single-number.json`

### Class-based design (LRU Cache)
- Operation-array input with multi-arg packed: `[{op:'put', arg:[1,1]}, {op:'get', arg:1}, ...]`
- Inline the data structure using plain primitives (Map for LRU); no need to `new` the class
- Collect `get`/observation returns into `results` array; final yield `returns: JSON.stringify(results)`
- Expose `mapOrder = [...map.keys()]` so the user can watch eviction order shift
- **Exemplar**: `data/system-design/p-lru-cache.json`

### Applied — class-based (Hashmap, EventEmitter, CircularBuffer, etc.)
- Same operation-array pattern as class-based design
- For HashMap: pre-compute that example keys collide in the same bucket (otherwise the "separate chaining" lesson is hypothetical)
- For EventEmitter: use a function-registry keyed by string id so the same fn ref persists across on/off
- **Exemplar**: `data/applied-problems/a-hashmap.json` + `a-event-emitter.json`

### Applied — async / timing (debounce, throttle, promise.all)
- Simulate timing manually: input is event sequence with `at` (time), trace tracks `lastFired`/`pending` synchronously
- For promise.all: sort by `resolveAfter` to simulate event-loop order, yield as each resolves
- `-Infinity` in state → render as `"-Infinity"` string via `show()` helper
- **Exemplar**: `data/applied-problems/a-debounce.json` + `a-promise-all.json`

### Applied — board evolution (Game of Life, Snake)
- Snapshot the board on every yield: `board.map(row => row.slice())`
- For Game of Life: keep boards 4x4 max — full per-cell yields blow past 70 steps fast on bigger boards
- For Snake/Connect Four: deep-copy `snake`/`board` per yield to avoid future-state leak into past yields
- **Exemplar**: `data/applied-problems/a-game-of-life.json` + `a-snake-game.json`

## Banned anti-patterns (all surfaced during the rollout)

- **Mutating state after yield** — every yield captures by reference. Set/array spreads MUST happen at the yield site, not before. Mutating the same Set then yielding again will make all prior yields reflect the latest state.
- **Yielding more than 2-3× for the same line in one iteration** — if you're doing this, the line is fine-grained and one yield is enough.
- **Nested template literals** — `` `${... ? `foo` : `bar`}` `` doesn't parse cleanly when the outer is also a template. Use string concatenation or pre-compute.
- **Comments inside the trace string array** — the array is for JSON readability, not code documentation. Put narrative in `label` instead.
- **Generic labels** — "step 5", "iterate", "loop body". Labels are what TEACH; template current values in: `` `outer step: r=${r}, char='${input[r]}'` ``.
- **DOM access** — the trace runs in an eval'd context with no DOM/`fetch`/`require`/`import`.
- **Padding short traces with redundant yields** — degenerate inputs (empty, single element, all-same) genuinely have few state changes. Honoring that is more pedagogical than faking 20 steps.

## Probes (regression coverage)

| Probe | What it asserts |
|---|---|
| `tools/cdp/conversation-tab.js` | 30 assertions × (desktop+mobile). Tab renders, sections collapse/expand, worked-examples sub-blocks expand independently, "See the solution" CTA routes to Reference, non-conversation lessons unaffected. |
| `tools/cdp/walkthrough-tab.js` | 34 assertions × (desktop+mobile). Tab order, initial step 1, line highlight, prev/next/reset, example dropdown switch, end-of-trace `returns` value, non-walkthrough lessons omit tab. |
| `tools/cdp/walkthrough-cross-shapes.js` | 140 assertions × (desktop+mobile). One representative per shape family (14 shapes); confirms Conversation has ≥3 sections + Walkthrough renders code+state+counter + final state includes `returns`. Run this when a wide content change might have broken a shape. |
| `tools/cdp/tab-switch-preserves-state.js` | 10 assertions. Existing BS-12 cache regression — Walkthrough position now also restores via this pattern. |

## Maintenance playbook

### "A lesson's Walkthrough is broken"

1. `node tools/validate-data.js` will tell you (compile / runtime / returns-mismatch). Most common cause: someone edited `reference.code` and the line numbers in the trace drift. Re-validate after every canonical change.
2. If it compiles but renders wrong: open the lesson at `http://localhost:8765/`, step through, and check the state panel. Likely a missing spread (live Set/Map mutating across yields).
3. If `returns` mismatches: the trace's final yield's `state.returns` doesn't match the example's `expected`. For arrays/objects, BOTH sides must be JSON-stringified.

### "I want to add a new lesson"

Use the `author-lesson` skill for the lesson itself. Then if it's a Patterns/Applied lesson, use `author-walkthrough` and `author-conversation` to add those blocks. The skills bundle everything; don't reinvent.

### "I want to change the Conversation/Walkthrough UI"

- Tab list construction: `app.js` `renderLesson` (~line 1160).
- Default-tab resolution: `app.js` `selectLesson` (sets `state.currentTab = 'auto'`) + `renderLesson` (resolves to first tabDef).
- Conversation renderer: `app.js` `renderConversation` (~line 1261).
- Walkthrough renderer: `app.js` `renderWalkthrough` (~line 1395).
- CSS for both: `app.css` — search for `/* ── Conversation tab ` and `/* ── Walkthrough tab `.
- After changes, run all three probes (conversation-tab + walkthrough-tab + walkthrough-cross-shapes) to catch regressions.

### "I want to add a new tab type"

The tab list is dynamic per lesson. To add a new tab:
1. Add `if (content.<newKey>) tabDefs.push({ id: '<newId>', label: '...', status: null });` in `renderLesson`.
2. Add `if (state.currentTab === '<newId>') render<NewTab>(body, lesson, content);` below the existing branches.
3. Add `<newId>` to the resume-allowlist in the boot path (`if (state.lastTab && [...].includes(state.lastTab))`).
4. Add a render function. If it has UI state to preserve across tab switches, use the `inProgressCache` pattern (see `renderWalkthrough` as the cleanest reference).
5. Validator: add a structural check if the new block is opt-in (model on the existing `conversation` / `walkthrough` checks at the bottom of `tools/validate-data.js`).

### "I want to bulk-author across multiple lessons"

Use the parallel-subagent pattern from the OOB-2026-05-24 rollout — see `SELF-IMPROVE.md` for the wave structure (~11 subagents per round, batched by section/shape). Each subagent must:
- Read the relevant skill file
- Read 2-3 shape-matched exemplars
- Author its batch
- Run `node tools/validate-data.js` (mechanical guardrail)
- Report back with step counts + any shape-specific gotchas

The orchestrator then runs the cross-shape probe + the regression probes before declaring done.

## Open items (linked back to SELF-IMPROVE.md)

- **BS-15** — `description` is technique-flavored, not problem-flavored. The Conversation tab simulates an interview but doesn't show the actual problem statement first. Fix: add a new `problem` field at the lesson top level, rendered under the title on every tab. Schema-only addition.
- **BS-16** — Conversation voice quality at scale: validator only checks structure. 99 lessons authored via parallel subagents; voice consistency was not human-audited end-to-end. Remediation path: soak window → if positive, `lesson-audit`-style scoring on a random Conversation sample (consider `--conversation` flag for `/lesson-audit`); if negative, roll back to a curated top-20 hand-authored set.

## Historical context

- **Prototype** (2026-05-23): Conversation + Walkthrough shipped on `p-longest-sub` only. Schema + engine + 3 exemplars (longest-sub, two-sum, valid-palindrome) hand-authored over several iterations of design discussion with the user.
- **OOB rollout** (2026-05-24): scaled to 99/99 Patterns + Applied lessons via 22 parallel subagent invocations (11 walkthrough + 11 conversation, in two phases). Single user-driven session. Counter-additive-bias caveat acknowledged: scaled before measuring whether the prototype moves the drilling needle.
