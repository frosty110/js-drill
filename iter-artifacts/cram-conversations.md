# 4-Day Interview Cram — Problem Conversations

> *Captured 2026-05-28 from `data/paths.json` (path id: `prep-4day`).*
> Each lesson's interview-narration conversation, in the order it first appears in the cram. Lessons that recur across days are noted at the lesson header.
> Regenerate anytime: `node tools/export-cram-conversations.js`

---

## Day 1 — Foundations & gap-fills *(2026-05-24)*

### Morning — Clear the 5 big rocks *(~2 hr)*

#### Sort with comparator

*Algorithms* · `sorting` — `.sort()` MUTATES and defaults to STRING comparison. Always pass a comparator for numbers.

> How an interview about `.sort()` would actually play out. Each section has two parts: what you'd say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before reaching for `.sort()` — pin down the contract.

**What I'd say** — "Let me restate: I have an array and I want it sorted. A couple of quick questions before I write the call:"

• Are these numbers, strings, or objects? It changes the comparator.
• Do I need ascending or descending order?
• Am I allowed to mutate the input, or do I need a fresh array?
• If two items compare equal, does original order matter (i.e. do I need stable sort)?

**Why this matters** — *These are not pedantic questions — each one decides a different line of code. 'Numbers vs strings' is the canonical interview gotcha (`[10, 2, 1].sort()` returns `[1, 10, 2]`); 'mutate or not' decides between `arr.sort(...)` and `[...arr].sort(...)`; 'stable' matters when chaining secondary keys. Asking signals you've been bitten by `.sort()` before.*

##### 2. Why this template?

> Name the trap the default `.sort()` walks straight into.

**What I'd say** — "The default `.sort()` with no comparator coerces every element to a string and sorts lexicographically. So `[10, 2, 1].sort()` is `[1, 10, 2]` — because `'10' < '2'` as strings. That's almost never what you want for numbers, so the template is: always pass a comparator. `(a, b) => a - b` for numbers ascending, `(a, b) => b - a` for descending, `(a, b) => a.localeCompare(b)` for strings, and `(a, b) => a.key - b.key` to sort objects by a numeric key."

**Why this matters** — *The comparator-always-on-numbers rule is muscle memory. Saying it unprompted before writing the call inoculates against the most-cited JS interview trap. Naming both `a - b` and `localeCompare` shows you know strings have their own canonical path — naive `a < b ? -1 : 1` works but loses locale collation.*

##### 3. Spot the pattern — comparator contract

> What does the comparator actually return, and why subtraction?

**What I'd say** — "The comparator is a function `(a, b) => number` with three legal outcomes:"

• Negative → `a` comes before `b`
• Positive → `b` comes before `a`
• Zero → they're equal (relative order preserved on stable sort)

"That's why `a - b` works for ascending numbers: if `a < b`, `a - b` is negative, so `a` lands first. For descending, flip to `b - a`. The crucial bug to avoid: writing `(a, b) => a > b` looks intuitive but returns true/false → 1/0, never a negative number, so the sort is wrong."

**Why this matters** — *Naming the three-valued contract is what distinguishes a candidate from someone who copy-pastes the idiom. The `a > b` boolean-returning bug is the exact thing senior interviewers probe for — they want to see you know WHY subtraction works, not just THAT it does.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the call.

Three cases cover the interesting behaviors — the textbook ascending-numbers case, the descending flip, and the objects-by-key case which is the L3 prompt.

**Worked examples**

- **Input:** `[3, 1, 4, 1, 5].sort((a, b) => a - b)` → **Output:** `[1, 1, 3, 4, 5]`
  *Note:* Numbers ascending — `a - b` puts smaller first.

  ```
  comparator picks pairs:
    3 vs 1 → 3-1=2 positive → 1 before 3
    4 vs 1 → 4-1=3 positive → 1 before 4
    5 vs 4 → 5-4=1 positive → 4 before 5
  result: [1,1,3,4,5] (stable — the two 1s keep their original order)
  ```
- **Input:** `[3, 1, 4, 1, 5].sort((a, b) => b - a)` → **Output:** `[5, 4, 3, 1, 1]`
  *Note:* Same array, flipped comparator → descending.

  ```
  comparator picks pairs:
    3 vs 1 → 1-3=-2 negative → 3 before 1
    4 vs 3 → 3-4=-1 negative → 4 before 3
    5 vs 4 → 4-5=-1 negative → 5 before 4
  result: [5,4,3,1,1]
  ```
- **Input:** `[{age:30},{age:25}].sort((a,b)=>a.age-b.age)` → **Output:** `[{age:25},{age:30}]`
  *Note:* Objects-by-key — the L3 pattern. Subtract on the key, not the object.

  ```
  comparator picks pair:
    {age:30} vs {age:25} → 30-25=5 positive → {age:25} before {age:30}
  result: [{age:25},{age:30}]
  (input array is MUTATED — same reference, new order)
  ```

**Why this matters** — *The third example is the load-bearing one to mention out loud — `(a, b) => a.age - b.age` is the same template applied to a projection. The interviewer is checking whether you know the comparator can project into any numeric field. The mutation note on example 3 is also worth flagging: if the caller still holds the original reference, they'll see it re-ordered.*

##### 5. Edge cases & pitfalls

> What inputs or comparators would trip up a careless implementation?

**What I'd say** — "Edges and pitfalls worth flagging:"

• Forgot the comparator on numbers → string sort: `[10, 2, 1].sort()` = `[1, 10, 2]`.
• Returned a boolean from the comparator: `(a, b) => a > b` is wrong; coerces to 1/0, never negative.
• Mutates in place → if the caller needs the original, copy first: `[...arr].sort(...)` or `arr.slice().sort(...)`.
• Empty or single-element array → no-op, no error.
• `NaN` values → comparator with `NaN` always returns NaN, which the sort treats as 0 (equal); your NaNs can land anywhere. Worth flagging if floats are in play.
• Strings with mixed locale → use `localeCompare` not `<`, otherwise accented chars sort oddly.

**Why this matters** — *The `(a, b) => a > b` bug is the one that catches careless candidates — it's the boolean-coerces-to-0/1 trap that looks right but isn't. Calling it out unprompted is a senior-tier tell. The mutation flag is also high-signal — most candidates forget that `arr.sort()` returns the SAME array, not a new one.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n log n) — V8 uses TimSort, an adaptive merge-insertion hybrid that's stable. The comparator runs O(n log n) times, so the comparator should itself be O(1) — `a - b` and `a.key - b.key` qualify; something like `(a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))` would secretly make each comparison O(k) where k is the serialized length.

Space is O(log n) auxiliary (TimSort's run stack), but you should treat it as O(n) for safety since engines vary.

The template generalizes: any time you need ordered iteration, sort with a comparator FIRST, then iterate. It's the prep step for two-pointer problems on sorted arrays (3Sum, container-with-most-water) — sorting trades one O(n log n) up front for O(n) sweeps after."

**Why this matters** — *Naming TimSort and the comparator-cost gotcha is a senior touch — it shows you think about what the comparator costs PER call, not just the overall sort. The 'sort first, then two-pointer' generalization proves transfer: you see sorting as a primitive that unlocks downstream linear algorithms.*

---

#### Big-O intuition (read complexity off code shapes) <sub>*also scheduled: Day 2, Day 4*</sub>

*Algorithms* · `s-bigo-intuition` — Read time complexity off the code shape — what loop and recursion structures map to O(1), O(log n), O(n), O(n log n), and O(n²). Meta-lesson: the canonical is a recognition checklist, not one algorithm.

> How you'd justify a Big-O claim in an interview — not 'recite the answer' but 'derive it out loud from the code shape'. Each section: what you'd say, then why that move matters.

##### 1. Why drill this?

> Every interview ends with 'what's the complexity?' — be ready.

**What I'd say** — "Every algorithm question I've had ends with the interviewer asking 'and what's the time and space complexity?'. They're not testing whether I memorized the answer for THIS problem — they're testing whether I can READ a piece of code and derive O(...) from its shape. So this is the recognition skill: see a single loop → O(n); see a halving loop → O(log n); see two nested loops over the same input → O(n²); see a sort followed by anything → O(n log n) until something blows past it."

"My script for any complexity question is the same: name the shape, count the work per element, multiply, then add the secondary costs and drop them if they're smaller."

**Why this matters** — *Frame the lesson as a *technique* (read-off-the-shape) rather than memorization. Interviewers can tell when a candidate has memorized 'two-sum is O(n)' vs when they can defend any algorithm's complexity by pointing at the lines. The recognition-from-shape skill is the transferable one — it works on problems you haven't seen before.*

##### 2. The common mistakes first

> What goes wrong in candidate complexity answers?

**What I'd say** — "Three failure modes I'd guard against:"

• "Calling nested loops O(n²) without checking whether the inner is bounded by n. `for j in 0..k` with k a constant gives O(n·k) = O(n), not O(n²). The inner has to depend on n for the outer multiplication to compound."

• "Confusing O(n log n) for any sort — quicksort's WORST case is O(n²), and counting sort / radix sort can do O(n) for bounded keys. The default for `arr.sort()` in JS is O(n log n) (TimSort), but flagging the assumption is the senior move."

• "Reporting `O(n + 5)` or `O(2n)` instead of `O(n)`. Big-O drops constants and lower-order terms — `O(2n + 100) = O(n)`. Reporting the raw expression in an interview is a tell that you've memorized the form, not the meaning."

• "Confusing time with space. An algorithm can be O(n) time but O(n²) space (e.g. building a distance matrix), or O(n) time AND O(1) space (sliding window). Always name both."

**Why this matters** — *The 'inner-loop-not-actually-bounded-by-n' point is the one most worth flagging — it's where candidates get O(n²) wrong in BOTH directions (claiming O(n²) when it's O(n), or claiming O(n) when nested-over-i means it's actually O(n²)). Calling the bound out explicitly — 'inner runs O(n) per outer iteration, so n·n = n²' — is the structural argument the interviewer wants to hear.*

##### 3. Spot the math — the recognition checklist

> What shapes give what complexity?

**What I'd say** — "My read-off-the-shape table:"

• "No loop, no recursion → O(1). Bracket access, hash lookup, arithmetic — work independent of input size."

• "Loop that HALVES the problem each step (`n = n/2`, or binary-search `l..r` shrinks by half) → O(log n). After k halvings the size is n/2^k; loop ends when 2^k ≥ n, so k ≈ log₂(n)."

• "Single loop, one O(1) operation per element → O(n). Sum, max, hash-map first pass, single-pass two-pointer."

• "Sort step + single pass → O(n log n). The sort dominates; addition rule says we keep the largest term."

• "Two nested loops, BOTH bounded by n → O(n²). Even if the inner shrinks (`j = i+1..n`), the sum 1+2+...+n = n(n-1)/2 ≈ n²/2 is still O(n²) after dropping constants."

• "Recursion that splits the input in half AND does O(n) work per level → O(n log n) (merge sort). Recursion that branches twice per call with O(1) work → O(2ⁿ) (naive fib)."

"Then the two arithmetic rules: ADD sequential costs and KEEP the largest term; MULTIPLY nested costs."

**Why this matters** — *Having a tight mental table is what lets you answer complexity questions fast — you read the code, match against the shape list, and apply the addition/multiplication rules. The shape-matching skill is also what lets you ESTIMATE complexity for problems you've never seen: the interviewer doesn't care about the answer in the abstract, they care that you have a procedure for arriving at it.*

##### 4. Walk through examples

> Run the recognition checklist on three different code shapes.

"Let me apply the read-off-the-shape rules to a few concrete loops."

**Worked examples**

- **Input:** `while (n > 0) { n = Math.floor(n / 2); steps++; }  with n=64` → **Output:** `7`
  *Note:* Halving loop — the canonical log-n shape. Doubling n adds exactly 1 step.

  ```
  n=64  →  step 1: n=32
  n=32  →  step 2: n=16
  n=16  →  step 3: n=8
  n=8   →  step 4: n=4
  n=4   →  step 5: n=2
  n=2   →  step 6: n=1
  n=1   →  step 7: n=0   (loop exits)
  7 steps  =  ⌊log₂(64)⌋ + 1  =  6 + 1
  This is O(log n) by definition.
  ```
- **Input:** `for i in 0..n: for j in i+1..n: count++  with n=4` → **Output:** `6 pairs, O(n²)`
  *Note:* Triangular inner shape — still O(n²) after dropping constants.

  ```
  i=0: j=1,2,3   → 3 inner steps
  i=1: j=2,3     → 2 inner steps
  i=2: j=3       → 1 inner step
  i=3: (none)    → 0 inner steps
  Total: 3+2+1+0 = 6 = n(n-1)/2
  For n=4: 6.  For n=100: ~5000.  For n=1000: ~500,000.
  Leading term ≈ n²/2 → O(n²) after dropping the 1/2 constant.
  ```
- **Input:** `arr.sort() + single for loop  with arr.length = n` → **Output:** `O(n log n)`
  *Note:* Addition rule with sort dominating.

  ```
  sort step:    O(n log n)  ← TimSort on V8
  scan step:    O(n)
  Total:        O(n log n) + O(n)
  Largest term: O(n log n)  ← keep
  Drop O(n):    O(n log n)  ✓
  ```

**Why this matters** — *Walking through the halving loop on concrete numbers — going 64 → 32 → 16 → ... → 0 — is what makes log n feel TANGIBLE. Most candidates can recite 'binary search is log n' but never traced the halvings; once you have, the intuition that 'doubling n adds one step' sticks for life. The triangular-inner trace is the second load-bearing one: it shows WHY a shrinking inner loop is still O(n²).*

##### 5. Edges + pitfalls

> Where does naive complexity analysis go wrong?

**What I'd say** — "Edges where the obvious answer is wrong:"

• "Hash-map ops are O(1) AVERAGE but O(n) worst case (collisions). For interview analysis, ALWAYS state 'average O(1) assuming good hash distribution' — the pathological case requires adversarial input."

• "Amortized analysis. Pushing onto a dynamic array is O(1) amortized: most pushes are O(1), occasional resizes are O(n), but the rare resizes spread out over many cheap pushes average to O(1) per push. Same with Union-Find with path compression — individual op can be O(log n), but n ops total are O(n α(n)) ≈ O(n)."

• "`arr.includes(x)` inside a loop is sneaky O(n²). Each `includes` is O(n); calling it for each element gives n × O(n) = O(n²). Replace with `Set.has` for O(n) total."

• "Recursive Fibonacci `fib(n) = fib(n-1) + fib(n-2)` is O(2ⁿ), NOT O(n). The recursion tree branches twice per call, depth n, so 2ⁿ nodes. Memoization brings it down to O(n)."

• "Space complexity for recursion includes the call stack — depth-n recursion is O(n) space even if it does no allocation. Tail-call optimization isn't reliable in JS, so always count the stack."

**Why this matters** — *The `arr.includes` inside a loop case is the most common silent quadratic — it's the bug pattern that gets candidates 'wrong' on a 'right' algorithm. The amortization point is worth raising on any dynamic-array or hash-resize problem; saying 'amortized O(1)' shows you've seen real systems analysis, not just textbook complexity. Stack-as-space-cost is the one most candidates forget on recursive solutions.*

##### 6. How I'd justify it in an interview

> Closing the loop — say it out loud, defend the bound.

**What I'd say** — "My script for stating complexity:"

1. "Name the dominating shape. 'The outer loop is O(n), the inner is O(log n) — so each outer iteration does log n work.'"

2. "Multiply or add. 'Nested → multiply: n × log n = O(n log n). Sequential → add and keep largest: O(n) + O(log n) = O(n).'"

3. "Drop constants and lower-order terms. 'That's O(n log n), not O(2 n log n + 100).'"

4. "State time AND space separately. 'Time O(n log n) from the sort, space O(1) because the sort is in-place — but if I use `[...arr].sort()` instead, space becomes O(n) for the copy.'"

5. "Flag any assumption. 'Assuming hash ops are O(1) average — adversarial keys would make this O(n) per op.'"

"If you want me to extend: the classic interview MOVE is recognizing an O(n²) brute force and replacing it with O(n) via a hash map (Two Sum), or O(n²) → O(n log n) via sort + two-pointer (3Sum). The bound improvement is what the interviewer is grading."

**Why this matters** — *The script-it-out approach is what makes complexity claims feel REASONED rather than recited. Saying 'I'm assuming hash ops are O(1) average' is the senior-tier move — it shows you know complexity is conditional on the underlying data structure's guarantees, and you're not blindly applying textbook bounds. Naming the brute-force-to-optimized recognition pattern as the extension proves transfer: this lesson isn't just about reading complexity, it's about USING the recognition to drive optimization.*

---

#### Binary Search <sub>*also scheduled: Day 2*</sub>

*Binary Search* · `binary-search` — Halve the search range on a sorted array. Closed interval [l, r] with `l <= r`.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me restate: I'm given a sorted array `nums` and a `target`, and I want to return the index of `target`, or `-1` if it's not present. A few things to confirm:"

• Sorted ascending — that's the precondition, right?
• Are values unique, or can there be duplicates? (For plain BS it doesn't change the search, but it does change what 'the' index even means.)
• If the target appears multiple times, do you want any matching index, the leftmost, or the rightmost?
• Empty array — return `-1`?
• Any value bounds I should know about (int range, floats)?

**Why this matters** — *The sortedness question sounds like overkill but I always ask — every BS bug story starts with somebody running it on an unsorted array. The leftmost/rightmost question is the one that signals 'I know this template generalizes to lower_bound/upper_bound,' which is the first thing a strong interviewer probes for after the basic version works.*

##### 2. Brute force first (out loud)

> Name the obvious O(n) solution before you discard it.

**What I'd say** — "The brute force is a linear scan: walk from index 0, return `i` when `nums[i] === target`, return `-1` if I fall off the end. That's O(n) time, O(1) space — and it doesn't use the sortedness at all, which is the giveaway that we can do better."

**Why this matters** — *Stating linear scan first does two things. (1) It confirms I read the prompt — I'm not assuming BS is the goal, I'm deriving it from 'O(n) ignores the structure I was given.' (2) It frames the optimization as 'exploit the order' rather than 'apply binary search,' which is the right mental motion — patterns come from properties, not labels.*

##### 3. Spot the pattern

> What property of the input unlocks binary search?

**What I'd say** — "This is the canonical binary-search trigger: a sorted array gives me a monotone property — for any index `m`, every element left of `m` is `<= nums[m]`, and every element to the right is `>= nums[m]`. That monotonicity is what lets me discard half the search space in one comparison. So instead of one pass, I shrink the range by half each step: O(log n)."

"Two template choices worth flagging up front: I'll use a CLOSED interval `[l, r]` with `while (l <= r)` — the `=` matters, otherwise single-element ranges get skipped. And I'll move PAST `m` with `l = m + 1` / `r = m - 1` to guarantee the range shrinks every iteration; `l = m` is the classic infinite-loop trap."

**Why this matters** — *Naming the *property* — monotone order — separates BS from pattern-matching on the word 'sorted.' The closed-interval-and-move-past-m callouts are the two implementation choices interviewers grill on; saying them up front signals you've written this loop before and remember why each piece is the way it is, instead of fumbling them under pressure.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace a couple of inputs to make sure the loop boundaries are right." Three cases cover the interesting behaviors — a hit deep in the array, a miss where the loop has to terminate cleanly, and a single-element array that exercises the `l <= r` boundary.

**Worked examples**

- **Input:** `nums=[-1,0,3,5,9,12], target=9` → **Output:** `4`
  *Note:* Standard hit — converges in 3 steps.

  ```
  l=0 r=5  m=2 nums[m]=3   < 9 → l = m+1 = 3
  l=3 r=5  m=4 nums[m]=9   === 9 → return 4 ✓
  ```
- **Input:** `nums=[1,3,5,7,9,11,13], target=2` → **Output:** `-1`
  *Note:* Miss — the loop must terminate via l > r, not loop forever.

  ```
  l=0 r=6  m=3 nums[m]=7   > 2 → r = m-1 = 2
  l=0 r=2  m=1 nums[m]=3   > 2 → r = m-1 = 0
  l=0 r=0  m=0 nums[m]=1   < 2 → l = m+1 = 1
  l=1 r=0  → l > r, loop exits → return -1 ✓
  ```
- **Input:** `nums=[5], target=5` → **Output:** `0`
  *Note:* Single-element array — this is why `<=` matters, not `<`.

  ```
  l=0 r=0  → l <= r is TRUE (would be FALSE with `<`)
             m=0 nums[m]=5 === 5 → return 0 ✓
  ```

**Why this matters** — *The miss-case trace is the one to narrate slowly — it's where careless implementations infinite-loop (writing `l = m` instead of `l = m + 1`) or off-by-one (writing `l < r` instead of `l <= r` and missing the last comparison). The single-element trace is the cleanest way to defend the `<=` choice on the spot: 'with `<` this returns -1 instead of 0.' Both bugs are caught on the whiteboard, not in the runtime.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Edges worth flagging:"

• Empty array → `r = -1`, loop never enters, return `-1`. ✓
• Single element matching target → returns 0 only if the loop condition is `<=`. With `<` it returns -1. Already flagged.
• Target smaller than `nums[0]` or larger than `nums[n-1]` → the range collapses to one side and exits cleanly with -1.
• Duplicates → plain BS returns *some* index of `target`, not necessarily the first or last. If the interviewer wants leftmost, swap to the `lower_bound` template (`while (l < r)`, `if (nums[m] < target) l = m+1; else r = m;`).
• Integer overflow on `(l + r) / 2` → in JS, numbers are 64-bit floats so it's safe up to 2^53. In Java/C++ you'd write `l + ((r - l) >> 1)` to dodge `INT_MAX` overflow. Worth mentioning that you'd port it that way in a typed language.

**Why this matters** — *The overflow callout is the senior-tier flag — in JS it's a non-issue, but mentioning that you *would* protect it in C++/Java signals language-portability awareness. The duplicates callout is the bridge to the more advanced versions of this template (first/last occurrence, ceiling, floor) — naming `lower_bound` unprompted shows you see the family, not just this one instance.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(log n) — each iteration halves the search range, so after `k` steps the range is `n / 2^k`. The loop terminates when the range is empty, which happens at `k = log₂(n) + 1`. So worst case is `⌈log₂(n)⌉ + 1` comparisons.

Space is O(1) — just the three integer pointers, no recursion stack. If I wrote this recursively it would be O(log n) auxiliary space from the call stack, which is why I prefer the iterative form.

If you wanted to extend: the same `l/r/m` skeleton becomes `lower_bound` (first index >= target) by swapping the comparison and the loop condition, and from there you get insertion-point, ceiling, floor, and 'first/last occurrence of target' as one-line variants. That's the whole binary-search family from one template."

**Why this matters** — *The halving argument is the textbook defense, but the iterative-vs-recursive aside is what shows up-leveled engineering judgment — the asymptotic cost is the same but the constant factors and stack pressure differ. Naming `lower_bound` and the family of variants is the bonus that proves you see this as a *template*, not a one-off; that's the move that earns the 'strong hire' bullet on the rubric.*

---

#### BFS queue scaffold

*Algorithms* · `s-bfs-template` — The canonical breadth-first search shell — queue + seen set, plus the level-snapshot variant for level-order traversal.

> How an interview about the BFS template would actually play out. Each section has two parts: what you'd say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before reaching for BFS — pin down the inputs and the answer shape.

**What I'd say** — "Let me restate: I'm given a graph and a start node, and I need to walk every reachable node in breadth-first order. Quick checks before I code:"

• How is the graph represented — adjacency list (object/map), adjacency matrix, or edge list? Adjacency list is what my template assumes.
• Is the graph directed or undirected? Affects whether I traverse `graph[cur]` once or both directions (the undirected case is usually pre-encoded in the adjacency list).
• Can a node have itself as a neighbor, or duplicate edges? The `seen` set handles both, but worth confirming.
• What do I return — visit order, just a count, or per-level groups? Variant A gives a flat order; Variant B groups by level.

**Why this matters** — *The 'adjacency list vs matrix' question changes the inner loop — `graph[cur]` vs `for (let i = 0; i < n; i++) if (matrix[cur][i])`. Asking about per-level vs flat output is the move that lets you pick Variant A vs Variant B BEFORE writing code, so you don't have to refactor mid-implementation.*

##### 2. Why this template?

> What makes BFS the right tool over DFS here?

**What I'd say** — "BFS is the right tool when ORDER matters — specifically when you need shortest path in an unweighted graph, or per-level groupings. The reason: BFS expands by distance from the start, so the first time you reach any node is via a minimum-edge path. DFS doesn't give you that guarantee — it can find the target via a long detour first."

"The template has three load-bearing pieces:"

• `q = [start]` and `seen = new Set([start])` — initialize together so the start is never re-enqueued.
• `while (q.length)` + `q.shift()` — FIFO drain.
• Mark `seen.add(n)` BEFORE `q.push(n)` — the load-bearing ordering.

**Why this matters** — *Naming WHY BFS gives shortest path (distance-ordered expansion) distinguishes derivation from rote use. Most candidates can spell out the template; fewer can defend why it works. The 'mark before enqueue' ordering is the canonical interview trap — see section 3.*

##### 3. Spot the pattern — mark-before-enqueue

> Why mark `seen` BEFORE pushing to the queue, not when you pop?

**What I'd say** — "This is the canonical BFS bug to inoculate against. If you wait until you dequeue to mark seen, then a high-degree node can be enqueued multiple times before any of those copies actually get popped — each of its predecessors sees it as 'unseen' and pushes a duplicate."

"Concrete example: graph A→C, B→C, A→B. From A: enqueue A; pop A, push B and C (mark A). Pop B (mark B), push C — but C was already in the queue! Without mark-before-enqueue, C is in the queue twice and gets visited twice. With mark-before-enqueue, when A pushes C it ALSO marks C, so B's loop sees `seen.has(C)` is true and skips."

"Same reasoning: never drop the `seen` set on a cyclic graph — you'd get an effectively infinite queue."

**Why this matters** — *This is the question I'd expect the interviewer to ask explicitly: 'why mark before push?' Having a concrete two-line example ready — not just 'to avoid duplicates' — is the senior-tier answer. The cyclic-graph extension (drop the seen set → infinite loop) is the second-order proof that the seen set is what makes BFS terminate on cycles.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

Three cases — the L3 prompt input (diamond shape with one shared sink), a linear chain (worst case for the queue length), and a single isolated node (degenerate case proving termination).

**Worked examples**

- **Input:** `bfsOrder({A:["B","C"], B:["D"], C:["D"], D:[]}, "A")` → **Output:** `["A", "B", "C", "D"]`
  *Note:* Diamond — D is reachable from both B and C. The seen set prevents D from being enqueued twice.

  ```
  Init: q=['A'], seen={A}, order=[]
  shift A → order=[A]. Neighbors B,C: B unseen → seen={A,B}, q=[B]. C unseen → seen={A,B,C}, q=[B,C]
  shift B → order=[A,B]. Neighbors D: D unseen → seen={A,B,C,D}, q=[C,D]
  shift C → order=[A,B,C]. Neighbors D: seen has D → skip. q=[D]
  shift D → order=[A,B,C,D]. Neighbors=[]. q=[]
  q empty → return [A,B,C,D] ✓
  (Notice: C tried to enqueue D but seen.has(D) was already true.)
  ```
- **Input:** `bfsOrder({A:["B"], B:["C"], C:[]}, "A")` → **Output:** `["A", "B", "C"]`
  *Note:* Linear chain — queue holds at most one node at a time.

  ```
  Init: q=[A], seen={A}, order=[]
  shift A → order=[A]. B unseen → q=[B], seen={A,B}
  shift B → order=[A,B]. C unseen → q=[C], seen={A,B,C}
  shift C → order=[A,B,C]. Neighbors=[]. q=[]
  return [A,B,C] ✓
  ```
- **Input:** `bfsOrder({X:[]}, "X")` → **Output:** `["X"]`
  *Note:* Single isolated node — proves the loop terminates on a graph of size 1.

  ```
  Init: q=[X], seen={X}, order=[]
  shift X → order=[X]. Neighbors=[]. q=[]
  return [X] ✓
  ```

**Why this matters** — *The diamond example is the load-bearing one — it's where 'mark-before-enqueue' earns its keep. Narrating 'C tried to enqueue D but seen.has(D) was already true' shows you traced the bug-vs-fix in your head. The linear-chain case demonstrates the queue stays small (BFS doesn't always have a fat queue), and the single-node case proves termination on the degenerate input.*

##### 5. Edge cases & pitfalls

> What inputs or coding choices would trip up a careless implementation?

**What I'd say** — "Edges and pitfalls worth flagging:"

• Disconnected graphs → BFS only visits the start's connected component. If you need all nodes, wrap in an outer loop over unvisited starts.
• Cycles → handled by the `seen` set; drop the set and you get an infinite queue.
• `graph[cur]` undefined (a node with no entry, vs an entry with empty array) → `graph[cur] || []` guards against undefined.
• Forgot to mark start in `seen` → start might re-enqueue itself if a neighbor points back to it. Initialize `seen` with `new Set([start])`.
• Used `q.pop()` instead of `q.shift()` → silently turns into DFS. Same output sometimes; wrong on level-order or shortest-path problems.
• Huge graphs → `shift` is O(n); for millions of nodes use a head pointer or deque.

**Why this matters** — *The 'pop vs shift silently becomes DFS' point is the trap that catches careless candidates — the code still runs, sometimes returns the right answer, but is semantically wrong. The `graph[cur] || []` guard is the defensive touch for adjacency maps that may not have every node as a key. Naming the disconnected-graph case shows you've thought about whether BFS is a one-shot or needs to be looped.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(V + E) — each vertex is enqueued and dequeued at most once (V), and each edge is examined at most twice in an undirected adjacency representation, once in a directed one (E). The `seen` set's `has` and `add` are O(1) amortized.

The wrinkle: `q.shift()` is O(n) on a JS array, so the naive total is O(V·shift) = O(V²). For interview-scale (V≤10⁴) that's fine. For production, swap to a head-pointer to restore the textbook O(V + E).

Space is O(V) — the queue and seen set can each hold every vertex in the worst case.

The template generalizes hard. Variant B (level-order) adds one line — `const n = q.length` snapshot before the inner loop — and unlocks shortest-path-in-unweighted-graphs, binary-tree level traversal, and minimum-number-of-steps puzzles. Multi-source BFS (start with multiple nodes seeded into the queue) is the next layer up — that's how problems like 'rotting oranges' or 'walls and gates' are solved."

**Why this matters** — *The 'O(V·shift) = O(V²) for the naive form' admission is the senior-tier defense — interviewers want to hear you've thought about the constant factor, not just the asymptotic. Mentioning multi-source BFS unprompted is the transfer move that proves you see this as a template family, not a one-off.*

---

#### Pre/in/post-order traversal shapes

*Algorithms* · `s-tree-traversals` — Three recursive tree-traversal shapes side-by-side — only the position of visit(n) moves between them.

> This is a syntax-template lesson — three traversal shapes side-by-side. The interview script focuses on WHICH traversal fits WHICH task, not on solving a single problem. Tap a section to expand.

##### 1. When do you reach for each traversal?

> Three almost-identical templates — only the position of visit(n) moves. Match each to its natural use.

**What I'd say** — "Three recursive shapes, three jobs:

• PREORDER — `visit(n); preorder(n.left); preorder(n.right)`. Root FIRST. Natural for SERIALIZING or CLONING a tree top-down, because the parent is emitted before its subtrees, so a recursive deserializer reads parent then reconstructs left then right.

• INORDER — `inorder(n.left); visit(n); inorder(n.right)`. Root MIDDLE. The killer use: on a BST, inorder visits values in SORTED ASCENDING order. That's the one-line BST invariant.

• POSTORDER — `postorder(n.left); postorder(n.right); visit(n)`. Root LAST. Natural for BOTTOM-UP aggregation: subtree sum, height, safe delete, max-path-sum — anything where the parent's answer depends on both children's answers being ready first.

The code is almost identical — only the position of `visit(n)` moves between the two recursive calls. That's it."

**Why this matters** — *Naming each traversal AND the structural reason it fits its use case is the fluency signal. 'Use inorder for BSTs' is folklore; 'inorder visits left-then-self-then-right which is exactly the BST ordering invariant' is a derivation. Interviewers grade on the second — it means you can derive the right traversal for a problem they haven't seen, not just recall the canonical.*

##### 2. Why recursion, and what's the alternative?

> Name the iterative version before defaulting to recursion.

**What I'd say** — "The recursive version is three lines and reads like the definition: 'visit current, recurse left, recurse right' (modulo where `visit` sits). The iterative alternative uses an EXPLICIT STACK to simulate the call stack — push the root, pop, push children in reverse order, repeat. Iterative is more bookkeeping but it's the right call when the tree might be deep enough to blow the JS recursion stack — typically around 10k-15k frames. For a typical interview tree (a few hundred nodes), recursion is cleaner.

Using a QUEUE instead of a stack would give you LEVEL-ORDER (BFS), which is a fourth traversal shape with its own use cases (printing by level, computing tree width, shortest path from root). Stack = depth-first, queue = breadth-first — the data structure determines the family."

**Why this matters** — *Stating the iterative alternative unprompted shows you know recursion isn't the only option, which is the senior signal — most candidates default to recursion without acknowledging it could blow the stack. The stack-vs-queue equivalence is the bonus: BFS isn't a different algorithm, it's the same template with a FIFO swapped in for the LIFO. Interviewers love hearing that connection.*

##### 3. Spot the pattern: which traversal fits this task?

> How to decide, given a new tree problem.

**What I'd say** — "The decision rule I run:

1. Does the answer depend on visiting nodes in SORTED ORDER on a BST? → inorder.
2. Does the parent's answer DEPEND on its children's results (subtree sum, height, validate-BST with helper, lowest-common-ancestor)? → postorder, because children must finish first.
3. Do I need to emit the PARENT BEFORE its children (serialize, deep-clone, print tree structure top-down)? → preorder.
4. Do I need LEVEL-BY-LEVEL processing (right side view, level averages, zigzag)? → BFS, not DFS at all.

If two traversals seem to work, pick the one whose `visit` position matches the data dependency — that minimizes the bookkeeping you need to thread through the recursion."

**Why this matters** — *Walking through the decision tree out loud is what makes the FAMILY visible, not just the three templates. Most candidates pick a traversal by gut feel; running the dependency check ('does the parent depend on children?') is what makes the choice principled and defensible if the interviewer asks 'why postorder?'. The fourth bullet (BFS) closes the family — every standard tree traversal is either DFS-with-stack-position-choice or BFS-with-queue.*

##### 4. Trace through a tiny example

> Three traversals, one tiny BST — confirm the outputs.

"Let me trace each traversal on the same 3-node BST `{val:2, left:{val:1}, right:{val:3}}` so the differences land."

**Worked examples**

- **Input:** `tree = {val:2, left:{val:1}, right:{val:3}}` → **Output:** `preorder [2,1,3], inorder [1,2,3], postorder [1,3,2]`
  *Note:* Same tree, same three nodes — only the position of visit moves between the calls.

  ```
  PREORDER(2): visit 2 → out=[2]; preorder(1) → visit 1 → out=[2,1]; preorder(3) → visit 3 → out=[2,1,3]
  INORDER(2): inorder(1) → visit 1 → out=[1]; visit 2 → out=[1,2]; inorder(3) → visit 3 → out=[1,2,3]
  POSTORDER(2): postorder(1) → visit 1 → out=[1]; postorder(3) → visit 3 → out=[1,3]; visit 2 → out=[1,3,2]
  ```
- **Input:** `tree = null (empty)` → **Output:** `all three produce []`
  *Note:* Empty tree — base case `if (!n) return` fires immediately, no recursion. Same answer for all three.

  ```
  PREORDER(null): !n is true → return → out=[]
  INORDER(null):  !n is true → return → out=[]
  POSTORDER(null):!n is true → return → out=[]
  ```

**Why this matters** — *Running all three traversals on the SAME tree side-by-side is what makes the 'only visit position moves' point concrete. The candidate who's drilled this will draw the tree once on the whiteboard and walk all three orderings in 30 seconds; the candidate who hasn't will trace each one from scratch. The empty-tree trace defends the base case — without `if (!n) return`, you'd crash on `null.left`.*

##### 5. Edge cases & pitfalls

> What trips up a careless implementation?

**What I'd say** — "Pitfalls when you drop one of these into a real problem:
• Empty tree (root=null) → base case `if (!n) return` handles it without a special case. ✓
• Single node → one visit, no recursion fires below. All three traversals emit `[val]`. ✓
• Skewed tree (left-only or right-only) → recursion depth equals node count. For a 50k-node skewed tree, this blows the JS stack. Switch to iterative-explicit-stack if the input could be that deep.
• Forgetting the base case → recursing on `null.left` throws a TypeError. The `if (!n) return` is non-negotiable.
• Mixing up left/right order — inorder on the right-first variant `inorder(n.right); visit(n); inorder(n.left)` gives you REVERSE sorted order. Sometimes useful (e.g. Kth Largest in BST), but only if you meant it.
• On a non-BST, inorder does NOT give sorted output. The 'inorder = sorted' shortcut is BST-specific — don't claim it on a general binary tree.
• If you're aggregating bottom-up (postorder), make sure the recursive call RETURNS the value rather than just visiting — a 'visit' that pushes into an output array is different from a recursive function whose return value the parent reads."

**Why this matters** — *The skewed-tree call-out is the senior signal — recursion depth is O(h), and on adversarial input h = n. Most candidates write the recursive version and stop; flagging the stack risk shows you've thought about scale. The 'inorder on a non-BST isn't sorted' point is the bug that catches people who memorized 'inorder = sorted' without understanding it relies on the BST invariant left.val < node.val < right.val.*

##### 6. Complexity & common follow-ups

> What does each cost, and what problems use this template?

**What I'd say** — "All three traversals are O(n) time and O(h) recursion-stack space, where n is the node count and h is the tree height. O(h) is O(log n) for a balanced tree and O(n) for a skewed one. Every node is visited exactly once — the work per node is constant (one `visit` call), so the total time is linear in node count regardless of which traversal you pick.

Common follow-ups that use one of these templates as the SKELETON:
• Preorder → Serialize/Deserialize Binary Tree, Construct Binary Tree from Preorder + Inorder.
• Inorder → Validate BST, Kth Smallest in BST, Convert BST to Sorted Doubly Linked List.
• Postorder → Binary Tree Maximum Path Sum, Diameter of Binary Tree, Balanced Binary Tree, Lowest Common Ancestor.
• BFS (related but uses a queue) → Right Side View, Level Order Traversal, Zigzag, Tree Width.

If the interviewer asks for the iterative version of any DFS traversal, the trick is to use an EXPLICIT STACK and push children in REVERSE order (right then left for left-first traversal), so popping gives the right order."

**Why this matters** — *Listing the follow-up family for each traversal is the move that proves you see these as REUSABLE SKELETONS, not standalone tricks. Interviewers love this because it means you'll pattern-match the next tree problem instead of solving from scratch. The 'push children in reverse order' iterative trick is the canonical gotcha — calling it out unprompted signals you've actually written the iterative version, not just the recursive one.*

---

#### Maximum Subarray (Kadane's) <sub>*also scheduled: Day 3*</sub>

*Greedy* · `p-max-subarray` — Find the max sum of any contiguous subarray. Kadane's: at each index, either extend the running sum or restart from the current value.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: given an integer array `nums`, return the largest sum of any contiguous subarray. Contiguous, not subsequence — the elements have to be adjacent in the original array. And it has to be non-empty: at minimum the answer is the single largest element."

Then a few quick clarifying questions:
• Can values be negative? (Yes — that's what makes this non-trivial.)
• What if the whole array is negative — do I return the least-negative element, or 0?
• Is the subarray required to be length ≥ 1, or can it be empty (sum 0)?
• Just return the sum, or also the indices?

**Why this matters** — *The 'all-negative → return largest element' clarification is the load-bearing one. If empty subarrays were allowed (sum 0), the answer for `[-3,-1,-2]` would be 0, which makes the algorithm trivially simple but doesn't match the standard problem. Confirming non-empty up front determines how you initialize `cur` and `best` — and getting that init wrong is the most common bug on this problem.*

##### 2. Brute force first (out loud)

> Name the obvious solutions before you discard them.

**What I'd say** — "Two brute forces worth naming. The naive one is O(n³): two nested loops over `i` and `j` to pick every subarray, an inner loop to sum it. The slightly-better version uses prefix sums to compute any subarray sum in O(1), bringing it to O(n²) — still try every pair. Both work, but they're doing redundant work: when extending the subarray ending at `i` to one ending at `i+1`, we don't need to re-examine all earlier starts.

There's also a clean O(n log n) divide-and-conquer: the max subarray either lies entirely in the left half, entirely in the right half, or crosses the midpoint (which you compute with a linear scan). But the most elegant is O(n) with one pass — let me describe that."

**Why this matters** — *Walking the cost ladder O(n³) → O(n²) → O(n log n) → O(n) explicitly is the move. It shows you can see the problem at multiple resolutions, which is what separates 'pattern-matched to Kadane' from 'thought it through.' Also, the O(n log n) D&C is a real algorithm — some interviewers will probe whether you know it exists; naming it costs you nothing and demonstrates breadth.*

##### 3. Spot the pattern

> What signal in the problem points to Kadane's one-pass DP?

**What I'd say** — "Here's the structural insight: define `cur[i]` = the maximum sum of any subarray that ENDS exactly at index `i`. There are only two options for that subarray — either it's just `nums[i]` alone (we start fresh here), or it's the best subarray ending at `i-1` extended by `nums[i]`. So `cur[i] = max(nums[i], cur[i-1] + nums[i])`. The final answer is `max(cur[0], cur[1], ..., cur[n-1])`.

The greedy choice is: at each `i`, take whichever is larger between starting fresh and extending. This is provably optimal because `cur[i-1]` is by definition the best subarray ending at `i-1` — extending it gives the best 'extension' option, and starting fresh gives the only alternative. There's no third choice.

And since we only ever look at `cur[i-1]`, we can drop the array and use a single rolling variable. That's Kadane's."

**Why this matters** — *Defining `cur[i]` precisely as 'max subarray ENDING at i' is the move. Most candidates wave at 'running sum' without naming what it means; saying 'it's the max subarray ending at this exact index' is the DP definition that makes the recurrence trivially correct. The 'we only need cur[i-1]' observation is what justifies the O(1) space — same template as Fibonacci-style DP collapse.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — the classic mixed case, an all-negative edge, and a never-restart positive case.

**Worked examples**

- **Input:** `[-2,1,-3,4,-1,2,1,-5,4]` → **Output:** `6`
  *Note:* Classic case — multiple restarts; best subarray is [4,-1,2,1] from i=3..6.

  ```
  init cur=-2, best=-2
  i=1, nums[i]=1:  cur = max(1, -2+1=-1) → 1 [restart]. best=max(-2,1) → 1
  i=2, nums[i]=-3: cur = max(-3, 1-3=-2) → -2 [extend]. best=max(1,-2) → 1
  i=3, nums[i]=4:  cur = max(4, -2+4=2) → 4 [restart]. best=max(1,4) → 4
  i=4, nums[i]=-1: cur = max(-1, 4-1=3) → 3 [extend]. best=max(4,3) → 4
  i=5, nums[i]=2:  cur = max(2, 3+2=5) → 5 [extend]. best=max(4,5) → 5
  i=6, nums[i]=1:  cur = max(1, 5+1=6) → 6 [extend]. best=max(5,6) → 6
  i=7, nums[i]=-5: cur = max(-5, 6-5=1) → 1 [extend]. best=max(6,1) → 6
  i=8, nums[i]=4:  cur = max(4, 1+4=5) → 5 [extend]. best=max(6,5) → 6
  return 6
  ```
- **Input:** `[-3,-1,-2]` → **Output:** `-1`
  *Note:* All-negative edge — answer is the largest (least-negative) single element. Seeding cur/best with nums[0] is what makes this work.

  ```
  init cur=-3, best=-3
  i=1, nums[i]=-1: cur = max(-1, -3-1=-4) → -1 [restart]. best=max(-3,-1) → -1
  i=2, nums[i]=-2: cur = max(-2, -1-2=-3) → -2 [restart]. best=max(-1,-2) → -1
  return -1
  ```
- **Input:** `[5,4,-1,7,8]` → **Output:** `23`
  *Note:* Never restart — the running sum stays positive throughout, so extending always wins.

  ```
  init cur=5, best=5
  i=1, nums[i]=4:  cur = max(4, 5+4=9) → 9 [extend]. best=max(5,9) → 9
  i=2, nums[i]=-1: cur = max(-1, 9-1=8) → 8 [extend]. best=max(9,8) → 9
  i=3, nums[i]=7:  cur = max(7, 8+7=15) → 15 [extend]. best=max(9,15) → 15
  i=4, nums[i]=8:  cur = max(8, 15+8=23) → 23 [extend]. best=max(15,23) → 23
  return 23
  ```

**Why this matters** — *Tracing surfaces the bug that bites everyone — initializing `cur=0, best=0` instead of `cur=nums[0], best=nums[0]`. The all-negative case `[-3,-1,-2]` is the clearest demonstration: with `0,0` init, the algorithm would return 0 (which means 'empty subarray'), violating the non-empty constraint. The 'never restart' case `[5,4,-1,7,8]` also clarifies that `best` is not always the final `cur` — but here they coincide because the maximum prefix sum IS the answer. Both are essential mental models to lock in before coding.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Single element `[5]` → loop doesn't run, return best=5. ✓
• Single negative `[-3]` → loop doesn't run, return best=-3. ✓
• All negative `[-3,-1,-2]` → seeding with nums[0] gives the right -1.
• All positive `[1,2,3]` → never restart, return sum=6.
• All zeros `[0,0,0]` → cur stays 0, best stays 0, return 0. ✓
• Single zero in negatives `[-2,0,-3]` → cur after i=1 is max(0,-2+0=-2)=0; best becomes 0. Correctly picks the zero as the max.
• Peak in the middle then drop `[1,2,3,-100,4]` → best locks in at 6 after i=2; cur tanks at i=3 but best is preserved. (This is why we track best separately.)
• Very large arrays — O(n) handles it. Integer overflow: in JS, numbers are safe to 2^53, so accumulating millions of even moderately large ints is fine; in Java/C++, you'd want a long."

**Why this matters** — *The 'peak in the middle then drop' case is what proves WHY we need both `cur` and `best` — a one-variable Kadane would lose the peak the moment `cur` falls. Naming this out loud preempts the interviewer's 'why don't you just return `cur`?' challenge. The overflow caveat is the senior flag for language-agnostic interviews; trivial in JS but worth voicing.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — single pass, constant work per element (two max calls, one addition). No nested loop, no recursion, no auxiliary data structure.

Space is O(1) — two rolling variables, `cur` and `best`. The DP table collapsed to two scalars because the recurrence only looks back one step.

The key insight: Kadane is the canonical example of a 1D DP collapsing to O(1) space. The state we actually need at index `i` is just `cur[i-1]` — we never look further back. Same trick applies to House Robber, Climbing Stairs, and any 'state depends on previous one or two values' DP.

If you wanted to return the actual subarray (start and end indices, not just the sum), you'd track `cur_start` alongside `cur`: when you restart (`cur = nums[i]`), set `cur_start = i`; when `best` updates, lock in `best_start = cur_start` and `best_end = i`. Same template, two extra variables.

And if the problem changed to 'maximum product subarray' instead of sum, the same shape applies but you have to track both the max AND min product ending at `i`, because a negative times a negative can become the new max. Same Kadane spirit, two parallel state variables."

**Why this matters** — *The 'collapses to O(1) because we only look back one step' phrasing is the move that frames Kadane as a member of a family rather than a one-off. The subarray-tracking and max-product extensions are real LeetCode follow-ups (LC 53 → LC 152, and 'return subarray' is a common variant) — naming them proves you see the template, not just the problem. That's the senior signal.*

---

### Afternoon — Arrays & Hashing + Two Pointers *(~3 hr)*

#### Two Sum (hash map)

*Arrays & Hashing* · `two-sum` — Find indices of two values that sum to target. The canonical hash-map pattern. O(n).

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me restate: I'm given an array of integers `nums` and a target. I want to return the indices of the two numbers that add up to `target` — indices, not the values themselves. Quick checks before I code:"

• Is exactly one solution guaranteed, or could there be zero or multiple?
• Can I use the same element twice? (i.e. if `nums[3] = 4` and `target = 8`, is `[3,3]` legal?)
• Are the numbers integers, possibly negative? Any range I should worry about?
• Does the output order matter — `[i,j]` with `i<j`?

**Why this matters** — *The 'can I reuse the same element' question is the one that decides the implementation: if reuse is allowed you can do it in one line with a count check, but the standard problem forbids it — which is exactly why we check `seen.has(need)` BEFORE inserting the current element. Confirming the 'exactly one solution' guarantee also tells you whether to return `[]` on miss or whether a miss is impossible by contract.*

##### 2. Brute force first (out loud)

> Name the obvious O(n²) solution before you discard it.

**What I'd say** — "The brute force is two nested loops: outer `i` from 0, inner `j` from `i+1`, and check whether `nums[i] + nums[j] === target`. First pair that matches, return `[i, j]`. That's O(n²) time, O(1) extra space — let me see if we can trade space for time."

**Why this matters** — *Saying the brute force out loud does two things. First, it proves you understand the problem before reaching for a clever data structure — interviewers worry about candidates who pattern-match straight to 'hash map' without showing they could solve it the dumb way. Second, it sets up the optimization narratively: 'the inner loop is searching for the complement of `nums[i]` — what if we could look that up in O(1) instead of scanning?' The hash map answers exactly that question, so the leap feels earned rather than memorized.*

##### 3. Spot the pattern

> What signal in the problem points to a hash map?

**What I'd say** — "This is the canonical hash-map-of-complements problem. The signal: for each element I'm asking 'have I seen `target - nums[i]` before?' — that's an O(1) membership-and-retrieval question, and the order of the input doesn't matter. Hash map gives me both. I'll walk the array once, and at each index `i`, before I store `nums[i]`, I check whether its complement is already in the map. If it is, I've got my answer."

"Two subtle choices: value → index (not the reverse), so when the match fires I can return the partner's index; and check-then-set order, so an element doesn't match itself."

**Why this matters** — *Naming the pattern AND the structural property — 'O(1) complement lookup, order doesn't matter' — is what distinguishes derivation from guessing. If the problem said 'find any two elements that sum to target' (values, not indices) you'd still use a hash set; if it said 'find them with the smallest index gap' you'd need a sorted structure; if it said 'find them in a sorted array' you'd switch to two-pointers and skip the hash entirely. Spelling out which property unlocks hash map is what the interviewer is grading.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me run a couple of inputs through the model." Three cases cover the interesting behaviors — a typical match-on-the-second-step, an early-match where the complement is already there by the time the loop starts seeing duplicates, and a case where the matching pair contains repeated values (the 'don't match yourself' check earns its keep).

**Worked examples**

- **Input:** `nums=[2,7,11,15], target=9` → **Output:** `[0,1]`
  *Note:* The textbook case — match on the second iteration.

  ```
  i=0 nums[i]=2  need=7  → seen={} no hit → seen={2:0}
  i=1 nums[i]=7  need=2  → seen has 2! return [seen.get(2), 1] = [0,1] ✓
  ```
- **Input:** `nums=[3,2,4], target=6` → **Output:** `[1,2]`
  *Note:* Match comes from indices 1 and 2 — proves we don't return [0,0] even though 3+3=6.

  ```
  i=0 nums[i]=3  need=3  → seen={} no hit → seen={3:0}
  i=1 nums[i]=2  need=4  → seen has only 3 → seen={3:0, 2:1}
  i=2 nums[i]=4  need=2  → seen has 2! return [seen.get(2), 2] = [1,2] ✓
  ```
- **Input:** `nums=[3,2,3], target=6` → **Output:** `[0,2]`
  *Note:* Two 3s in the array, and 3+3=target — this is exactly the case where check-before-set matters.

  ```
  i=0 nums[i]=3  need=3  → seen={} no hit (we DON'T match ourselves) → seen={3:0}
  i=1 nums[i]=2  need=4  → seen={3:0} no hit → seen={3:0, 2:1}
  i=2 nums[i]=3  need=3  → seen has 3! return [seen.get(3), 2] = [0,2] ✓
  ```

**Why this matters** — *The third example is the one to mention out loud — it's why the order is `check → set`, not `set → check`. If you stored `nums[i]` first and then checked, the very first 3 would 'find' itself and you'd return `[0,0]`. Tracing surfaces that bug before code does. The second example is also worth narrating because it shows the complement that wins is the *earlier* one in the array, which is why the map stores value → index rather than the other way.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Edges worth flagging:"

• Empty or one-element array → loop just doesn't fire; return `[]` (or whatever the contract says on miss).
• Negative numbers and zero → no special-case logic needed; `target - nums[i]` still works because Map keys handle any number.
• Duplicate values where the pair *is* the duplicate (like `[3,3]` target=6) → handled by the check-before-set order; we don't match an element with itself.
• No valid pair → the contract usually promises one exists, but a defensive `return []` after the loop is cheap insurance.
• Floating-point values → would still work for exact representations, but you'd want to switch to an epsilon comparison if floats are in play. Worth flagging that you'd ask before assuming.

**Why this matters** — *The 'duplicate values that ARE the pair' edge is the one that catches careless candidates — it's where the seemingly arbitrary 'check-then-set' order turns out to encode a real correctness property. Calling it out unprompted signals that you understand WHY the canonical is structured this way, not just THAT it works. The floating-point flag is the senior-tier touch: most candidates never raise it, and an interviewer either nods or says 'assume integers for now' — both fine.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — one pass over the array, with two O(1) hash operations per element (a `has` and a `set`).

Space is O(n) — the map holds at most `n` entries (one per index visited before the match). On the very last element, in the worst case, it holds `n-1`.

If you wanted me to extend this: 3Sum is a clean evolution — sort the array, fix one index `i`, then run a two-pointer sweep on the remaining slice to find pairs that sum to `-nums[i]`. The hash-map template here is the building block; 3Sum just wraps it in an outer loop and trades the map for two pointers because the slice is now sorted."

**Why this matters** — *The amortized defense here is much simpler than for sliding window — there's no nested loop to explain away, just 'each element pays O(1) for two hash ops'. That makes the wrap-up's job structural rather than analytical: show you see this as a *template* (value-keyed map for O(1) complement lookup) that generalizes, not as a one-off trick. Naming 3Sum unprompted is the move that proves transfer.*

---

#### Contains Duplicate

*Arrays & Hashing* · `p-contains-dup` — Stream once; the first repeated value short-circuits to true. Set membership is O(1).

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me restate: I'm given an array `nums` and I need to return `true` if any value appears at least twice, `false` if every value is distinct. A couple of quick questions before I code:"

• What are the elements — integers only, or could there be strings or mixed types?
• Any size bound on the array? Anything I should worry about for memory?
• Are NaN or `-0`/`+0` in play? (Set treats `NaN` as equal to itself, but `===` doesn't — worth flagging.)
• Empty input — return `false`, right?

**Why this matters** — *The element-type question matters because Set uses SameValueZero equality, which differs from `===` on exactly one edge: `NaN`. If the interviewer says "floats are possible," you've now planted a flag that the Set behavior is intentional rather than accidental. The empty-input check is a 5-second clarification that prevents a silly miss at the end.*

##### 2. Brute force first (out loud)

> Name the obvious O(n²) solution before you discard it.

**What I'd say** — "The brute force is two nested loops: outer `i` from 0, inner `j` from `i+1`, check `nums[i] === nums[j]`. First match returns `true`. That's O(n²) time, O(1) extra space — let me see if we can trade some space for time."

"There's also a sort-then-scan-adjacent variant — O(n log n) time, but it mutates the input array, and the default `.sort()` is lexicographic which would order `[1,10,2]` wrong without a comparator. I'd flag both before I went that direction."

**Why this matters** — *Naming both brute forces — nested loops AND sort — is more thorough than just one. It shows you considered the alternatives. The lexicographic-sort gotcha is the kind of trivia interviewers respect: it proves you've actually been burned by `[1,10,2].sort()` returning `[1,10,2]` and know to reach for a numeric comparator.*

##### 3. Spot the pattern

> What signal in the problem points to a hash set?

**What I'd say** — "This is the canonical Set-membership problem. The signal: for each element I'm asking 'have I seen this before?' — that's O(1) membership lookup, and I don't need any value associated with the key, just presence. Set gives me exactly that. I'll walk the array once, and for each element check `seen.has(n)` BEFORE adding it. First hit returns `true`; if I finish the loop, return `false`."

**Why this matters** — *Naming the data structure AND the structural property — 'O(1) membership, no associated value needed' — is what distinguishes derivation from guessing. If the problem had asked 'count duplicates' I'd reach for a Map (need a count). If it had asked 'find the first index that repeats' I'd still want a Set, but storing the index. Spelling out which property unlocks Set is what the interviewer is grading.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me run a couple of inputs through the model." Three cases — a typical dup-found-mid-array, an all-unique case that walks the full loop, and an all-same case that returns on the second element.

**Worked examples**

- **Input:** `[1,2,3,1]` → **Output:** `true`
  *Note:* Typical case — duplicate is the very last element.

  ```
  n=1 → seen.has(1)=false → seen={1}
  n=2 → seen.has(2)=false → seen={1,2}
  n=3 → seen.has(3)=false → seen={1,2,3}
  n=1 → seen.has(1)=true! return true ✓
  ```
- **Input:** `[1,2,3,4]` → **Output:** `false`
  *Note:* All unique — loop runs to completion and falls through to the trailing `return false`.

  ```
  n=1 → seen.has(1)=false → seen={1}
  n=2 → seen.has(2)=false → seen={1,2}
  n=3 → seen.has(3)=false → seen={1,2,3}
  n=4 → seen.has(4)=false → seen={1,2,3,4}
  loop ends → return false ✓
  ```
- **Input:** `[1,1,1,1]` → **Output:** `true`
  *Note:* All-same — short-circuits on the second element. The check-before-add order is what prevents the first 1 from matching itself.

  ```
  n=1 → seen.has(1)=false (we DON'T match ourselves) → seen={1}
  n=1 → seen.has(1)=true! return true ✓
  ```

**Why this matters** — *The all-same case is the one to mention out loud — it's why the order is `check → add`, not `add → check`. If you added first, the very first 1 would 'find' itself on the next has-check (or worse, on the same iteration if you wrote it inline). The all-unique trace also defends the worst-case bound: even when the answer is false, we only walk the array once.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Edges worth flagging:"

• Empty array → loop doesn't fire, returns `false` (vacuously: no duplicates exist).
• One element → same — no duplicate is possible.
• Mixed types like `[1, '1']` → `===` and Set's SameValueZero treat these as distinct, so this returns `false`. That might or might not be the intended behavior — worth asking.
• `NaN` in the array → Set treats `NaN === NaN` for membership, even though `NaN !== NaN` under `===`. So `[NaN, NaN]` returns `true`, which is actually the *intuitive* answer.
• Very large array of all-unique → O(n) memory in the Set. If memory's a constraint and we accept O(n log n) time, sort-and-scan in place is the alternative.

**Why this matters** — *The NaN call-out is the senior-tier touch — most candidates don't know that Set and Map use SameValueZero rather than `===`. If the interviewer asks 'why does that matter,' you've got an answer ready: it's the one place Set's equality differs from `===`. The memory-vs-time tradeoff at the end shows you understand this is a deliberate engineering choice, not a default.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — one pass, with O(1) `has` and `add` per element. The short-circuit on first match can return early, but the worst case is all-unique, which still walks the whole array.

Space is O(n) — the Set holds at most n entries in the worst case (all-unique).

If you wanted to extend this: 'Contains Duplicate II' adds a constraint — duplicates must be within distance k of each other. The fix is to switch from Set to a sliding window of size k (still O(n)). The template here — Set-as-membership — is the building block; the windowed variant just bounds the Set's lifetime."

**Why this matters** — *The amortization story is straightforward — one pass, O(1) per element — but the wrap-up's job is to show transfer. Naming Contains Duplicate II unprompted is the move that proves you see this as a *template* (Set-for-membership) rather than a one-off. Interviewers grade transfer heavily because it predicts how you'll handle the variant they'll throw at you on the follow-up.*

---

#### Group Anagrams

*Arrays & Hashing* · `p-anagrams` — Group strings that are anagrams. Use a sorted-character key in a Map to bucket them. O(n·k log k) where k is max word length.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me restate: I'm given an array of strings, and I want to group together the strings that are anagrams of each other. Output is an array of groups — each group is the strings that share an anagram class. A few clarifying questions:"

• Character set — lowercase ASCII only, or full Unicode? That changes whether the 26-count-array trick is viable.
• Case sensitivity — is `"Eat"` the same anagram class as `"tea"`? My guess is no, but worth confirming.
• Do groups need a particular order — first-seen, alphabetical, by group size?
• Are duplicate strings allowed in the input? (e.g. `["a", "a"]` → one group of two, or two groups of one?)

**Why this matters** — *The character-set question is load-bearing: 'lowercase ASCII only' unlocks the O(k) count-array key; full Unicode forces you back to the sorted-string key (which is O(k log k)). The first-seen-order question matters because using a `Map` (insertion order) vs. a plain object lets you guarantee that ordering for free — interviewers often want a deterministic output.*

##### 2. Brute force first (out loud)

> Name the obvious O(n²·k) solution before you discard it.

**What I'd say** — "The brute force is: for each string, scan all the already-formed groups; if any group's representative is an anagram of the current string, append it; otherwise start a new group. Checking 'are these anagrams' itself costs O(k) (sort both and compare, or count chars). So total is O(n²·k) in the worst case — n strings times up-to-n groups times O(k) per anagram check."

"That's wasteful — we're recomputing the anagram check over and over. What if we computed a canonical *key* for each string and bucketed by that?"

**Why this matters** — *Two reasons to walk through the brute force. First, it forces you to articulate WHY this is wasteful — we're doing the same anagram check repeatedly. Second, it sets up the optimization narratively: the leap from 'check anagram pairwise' to 'compute a canonical key once' is the entire insight, and it lands harder when the brute force was just stated.*

##### 3. Spot the pattern

> What signal in the problem points to a hash map keyed by anagram fingerprint?

**What I'd say** — "This is a bucket-by-key hash-map problem. The structural property: two strings are anagrams iff they have the same multiset of characters. So if I can produce a canonical key from a string that depends only on its multiset, two anagrams will produce the same key, and a Map keyed on that gives me O(1) bucketing."

"Easiest canonical key: sort the chars and join. `'eat'` → `'aet'`, `'tea'` → `'aet'`, `'ate'` → `'aet'` — all collide into the same bucket. That's O(k log k) per string. If the alphabet is fixed (lowercase ASCII), I could swap that for a 26-length count array joined into a string, which drops keying to O(k)."

**Why this matters** — *Naming the data structure AND the structural property — 'same multiset → same key' — is what distinguishes derivation from a memorized template. The same hash-map-keyed-by-canonical-form template shows up in surprising places (group by sorted graph adjacency, group by frequency signature). The interviewer is testing whether you see the abstraction, not just the surface.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a few inputs." Three cases — the textbook mixed input, the degenerate single-element case, and a small mixed case to confirm bucket order.

**Worked examples**

- **Input:** `["eat","tea","tan","ate","nat","bat"]` → **Output:** `[["eat","tea","ate"],["tan","nat"],["bat"]]`
  *Note:* Three anagram classes. Note the groups stay in first-seen order because Map preserves insertion order.

  ```
  s="eat" → key="aet" → new bucket → map={aet:[eat]}
  s="tea" → key="aet" → push → map={aet:[eat,tea]}
  s="tan" → key="ant" → new bucket → map={aet:[eat,tea], ant:[tan]}
  s="ate" → key="aet" → push → map={aet:[eat,tea,ate], ant:[tan]}
  s="nat" → key="ant" → push → map={aet:[eat,tea,ate], ant:[tan,nat]}
  s="bat" → key="abt" → new bucket → map={aet:[eat,tea,ate], ant:[tan,nat], abt:[bat]}
  return Array.from(map.values()) → [[eat,tea,ate],[tan,nat],[bat]] ✓
  ```
- **Input:** `["a"]` → **Output:** `[["a"]]`
  *Note:* Single-element degenerate case — one bucket with one string. Confirms the lazy-init bucket path works.

  ```
  s="a" → key="a" → new bucket → map={a:[a]}
  return [[a]] ✓
  ```
- **Input:** `["abc","bca","xyz"]` → **Output:** `[["abc","bca"],["xyz"]]`
  *Note:* Two groups — `abc` and `bca` collide on key `abc`, `xyz` is alone.

  ```
  s="abc" → key="abc" → new bucket → map={abc:[abc]}
  s="bca" → key="abc" → push → map={abc:[abc,bca]}
  s="xyz" → key="xyz" → new bucket → map={abc:[abc,bca], xyz:[xyz]}
  return [[abc,bca],[xyz]] ✓
  ```

**Why this matters** — *Tracing surfaces the subtle correctness property — the *output order* of the outer groups is determined by which anagram class is *first seen*, not by which class has the most members. The `tan/nat` group appears before `bat` because `tan` came before `bat` in the input. That's only guaranteed if you use `Map` (or careful Object usage on modern engines); a wrong-language assumption would bite a candidate who reached for a plain object without thinking about it.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Edges worth flagging:"

• Empty input `[]` → loop doesn't fire, returns `[]`. Vacuously correct.
• Single string → one group of one. The lazy-init path runs once.
• Empty strings as input elements (`["", ""]`) → key is `""` for both; one group of two. Worth confirming that's intended.
• Duplicate strings (`["a", "a"]`) → both hash to the same bucket, one group of two. Same as anagrams — the algorithm doesn't distinguish.
• Unicode/emoji → `.split('')` splits by UTF-16 code units, which can break surrogate pairs (one emoji becomes two halves). Fix: `[...s].sort().join('')` iterates by codepoint.
• Very long strings (large k) → the sort dominates: O(k log k) per string. If k is huge and the alphabet is fixed, switch to the count-array key for O(k) per string.

**Why this matters** — *The Unicode call-out is the senior-tier touch — `.split('')` is one of the most quietly-buggy idioms in JavaScript because it works perfectly for ASCII and silently breaks for emoji. Mentioning the `[...s]` fix shows you've debugged this before. The count-array-vs-sort tradeoff at the end shows you understand the algorithm has a tunable knob, not just one canonical form.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n · k log k) where n is the number of strings and k is the max string length. The k log k comes from sorting each string's chars; the outer n is the loop over the input.

Space is O(n · k) for the output (each input string appears in exactly one group), plus O(n) for the Map's key set (one key per unique anagram class, each key of length k).

If you wanted the O(n · k) variant: build a length-26 count array per string (for lowercase ASCII), join into a key like `'1#0#2#...'` — that drops keying to linear. Same Map structure, same bucketing logic. The template is identical; only the key function changes."

**Why this matters** — *The complexity defense here has TWO components that candidates often blur — the n-loop and the per-string k log k cost. Naming them separately is the move. The count-array extension at the end isn't bonus material — it's the alternative an interviewer might press you on ('can you do better than k log k per string?'), and having it ready is the difference between scrambling and confident.*

---

#### Valid Anagram

*Arrays & Hashing* · `p-valid-anagram` — Two strings are anagrams iff their character counts match. One Map, increment for s, decrement for t — all zero at the end means anagram. O(n).

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me restate: I'm given two strings `s` and `t`, and I return `true` if `t` is an anagram of `s` — same multiset of characters, possibly rearranged. A few quick clarifying questions:"

• Are the strings case-sensitive? Is `"Listen"` an anagram of `"silent"`?
• Character set — lowercase ASCII, or full Unicode?
• Should I strip whitespace or punctuation, or treat them as significant characters?
• Is the empty-string vs empty-string case `true`? (Trivially yes — both have the empty multiset.)

**Why this matters** — *The case-sensitivity and whitespace questions are the ones that decide whether your solution actually solves the user's problem. If they say 'normalize first,' you'd add `.toLowerCase()` and possibly `.replace(/\s/g, '')` before counting. The character-set question matters less here than in Group Anagrams — you're counting, not sorting — but it still affects whether you can use a length-26 array vs. a Map.*

##### 2. Brute force first (out loud)

> Name the obvious solutions before you discard them.

**What I'd say** — "Two obvious brute forces."

"One: sort both strings and compare with `===`. That's O(n log n) time, O(n) space for the sorted copies. Clean and short — a perfectly fine answer if the interviewer doesn't push for better."

"Two: count chars in `s`, then walk `t` and tick each one down — if any count goes negative or any char isn't in the count, return false. That's O(n) time, O(1) space for a bounded alphabet."

"I'll go with the count-map approach since it beats the sort asymptotically and the constant factors are similar."

**Why this matters** — *Naming the sort solution first is important — it's the obvious one, and dismissing it without acknowledging it makes you look like you skipped the easy answer to show off. By explicitly comparing the two, you show you considered both AND have a principled reason for picking the counter — not 'because it's the fancy one' but 'because it's strictly better on the asymptotic.'*

##### 3. Spot the pattern

> What signal in the problem points to a counter map?

**What I'd say** — "This is a frequency-counter hash-map problem. The structural property: two strings are anagrams iff their character frequency distributions are identical. So if I maintain a count map keyed on character, +1 walking `s` and -1 walking `t`, the strings are anagrams iff every entry settles back to zero."

"Two tricks make this even cleaner. First, length check at the top — if the lengths differ, the strings cannot be anagrams, period; bail immediately and skip the whole final zero-check. Second, while walking `t`, if any count goes negative, return false right away — that means `t` has an extra of some char that `s` didn't, and no further work can rescue it. Combined with the length check, those two short-circuits mean I never need to scan the map at the end."

**Why this matters** — *Naming the data structure AND the structural property — 'same frequency distribution → anagram' — is what the interviewer wants. The two short-circuits (length check + negative-on-decrement) aren't just micro-optimizations; they're what lets you skip the trailing zero-check entirely. Spelling out *why* they're load-bearing — not just that they're nice — is what separates pattern recognition from cargo culting.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a few cases." Three inputs — a typical anagram pair, a same-length non-anagram (where a counter goes negative), and a length-mismatch case that exits at the top.

**Worked examples**

- **Input:** `s="anagram", t="nagaram"` → **Output:** `true`
  *Note:* Classic anagram pair — counts balance to zero everywhere.

  ```
  length check: 7 === 7 → continue
  build count from s: {a:3, n:1, g:1, r:1, m:1}
  t: 'n' → count.n=0
  t: 'a' → count.a=2
  t: 'g' → count.g=0
  t: 'a' → count.a=1
  t: 'r' → count.r=0
  t: 'a' → count.a=0
  t: 'm' → count.m=0
  walked all of t with no negatives → return true ✓
  ```
- **Input:** `s="rat", t="car"` → **Output:** `false`
  *Note:* Same length but not an anagram — the 'c' in t isn't in the count map, so we short-circuit.

  ```
  length check: 3 === 3 → continue
  build count from s: {r:1, a:1, t:1}
  t: 'c' → count.has('c')=false → return false ✓
  ```
- **Input:** `s="abc", t="abcd"` → **Output:** `false`
  *Note:* Length mismatch — exits immediately at the top check, no Map even built.

  ```
  length check: 3 !== 4 → return false ✓
  ```

**Why this matters** — *The second example is the one to mention out loud — it's the case where the negative-counter short-circuit pays off. If you didn't bail on `!count.has('c')`, you'd `set('c', -1)` and the negative check would catch it on the next line — same correctness, slightly redundant. The third example is also worth flagging because it shows the length-check top-bail is doing real work, not just being defensive.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Edges worth flagging:"

• Both empty `s=""`, `t=""` → length check passes (0 === 0), both loops are no-ops, returns `true`. Vacuously correct.
• Length mismatch → caught immediately by the top check. Don't skip this — without it, you'd need to scan the map at the end for non-zero entries.
• Repeated characters (`"aabb"`, `"abab"`) → the counter handles repeats naturally; that's what makes it stronger than a Set.
• Unicode/emoji → `for...of` on a string DOES iterate by codepoint (unlike index-based access), so this canonical actually handles emoji correctly. Worth flagging as a hidden win.
• Case sensitivity — if `"Listen"` should match `"silent"`, lowercase both at the top.
• Whitespace — same: strip if the problem says to.

**Why this matters** — *The Unicode call-out here is a positive one — `for...of` happens to do the right thing, which is the opposite of `s[i]` indexing that breaks on surrogate pairs. Naming that explicitly shows you know the difference and that this canonical wasn't an accident. The case/whitespace edges aren't trivial — they're real interview-trap territory where the candidate codes the right algorithm against the wrong specification.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) where n is the string length. Two passes — one over `s` to build the count map, one over `t` to decrement — each does O(1) work per character.

Space is O(1) for a bounded alphabet — the Map holds at most |alphabet| entries (26 for lowercase English, 128 for ASCII), independent of n. For unbounded Unicode it'd be O(n) in the worst case.

If you wanted to extend to 'are two strings k-anagrams' (anagrams after at most k char swaps), you'd build the count map the same way, then sum the absolute deltas and check if the total is at most 2k. Same primitive — frequency map — with a different aggregation. Or extend to 'find all anagram start indices in a longer text': that's the same counter inside a sliding window, which is exactly the Find All Anagrams in a String problem."

**Why this matters** — *The amortization is straightforward — two linear passes, O(1) per char — but the wrap-up's job is to show transfer. Naming k-anagrams AND Find All Anagrams in a String unprompted demonstrates you see this as a *template* (frequency-count comparison) that composes with sliding window, not just a one-off trick. That's the move that wins the senior-track follow-up.*

---

#### Encode/Decode Strings

*Arrays & Hashing* · `p-encode-decode-strings` — Serialize a list of arbitrary strings into one string and round-trip it back. Length-prefix scheme `len#payload` avoids any delimiter collision.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me restate: I need two functions — `encode(strs)` that takes a list of arbitrary strings and produces a single string, and `decode(str)` that takes that string back to the original list. The round trip must be lossless for any input. A few critical clarifying questions:"

• What's the character domain of the input strings — ASCII, full Unicode, or arbitrary bytes? This decides what we can use as a delimiter.
• Can the strings be empty? Can the input list be empty?
• Is the encoded form constrained — must it be ASCII-printable, or anything goes?
• Am I optimizing for encode/decode speed, or for the smallest encoded size?

**Why this matters** — *The character-domain question is the most important one in this whole problem. If the answer is 'arbitrary strings including any Unicode codepoint,' then no single character can serve as a safe delimiter — payloads might contain it. That's the entire motivation for the length-prefix scheme. Confirming it up front turns the rest of the conversation into 'here's why length-prefix is the right answer' rather than 'why didn't you just join with a comma?'*

##### 2. Brute force first (out loud)

> Name the naive solution and walk through why it breaks.

**What I'd say** — "The naive solution is to pick a separator and `join` on it — `strs.join('#')`. Decode would be `str.split('#')`. That works perfectly UNTIL the input contains the separator: `encode(['a', '#b'])` produces `'a##b'`, and `'a##b'.split('#')` gives `['a', '', 'b']` — three elements, not two. The round trip is broken."

"You could try escaping — replace `'#'` in payloads with `'\\#'` and unescape on decode — but now you've got escape rules to track, and you have to escape the escape character too. It's brittle."

"The clean fix is to make the encoding self-describing: instead of relying on a delimiter to find the boundary, prefix each payload with its length. Then the decoder doesn't need to scan for a delimiter inside the payload at all — it reads the length, jumps that far, and lands on the next header."

**Why this matters** — *This is the unusual case where the brute force ISN'T O(n²) — it's the wrong solution, period. Walking through how `split('#')` breaks with a concrete payload (`'#b'`) is the move that earns the length-prefix solution. Saying 'I'd use a length prefix' without first showing why simpler approaches fail is just memorization.*

##### 3. Spot the pattern

> What signal in the problem points to length-prefix framing?

**What I'd say** — "This is a self-delimiting encoding problem — the structural property is that the encoded form must be unambiguously parseable without external context, and the payload alphabet overlaps with any candidate delimiter alphabet. The classic solution: encode each item as `length` + `delimiter` + `payload`. The length tells the decoder exactly how many bytes to consume for the payload, so the delimiter only needs to separate the length-header from the payload — and the length is digits, which can't collide with the `'#'` separator."

"This is the same trick that powers Pascal strings, network protocols like HTTP's `Content-Length`, and serialization formats like Protobuf and BSON. Length-prefix beats delimiter-scan whenever payloads can be arbitrary."

**Why this matters** — *Naming the encoding pattern AND the structural property — 'self-delimiting framing where payload alphabet overlaps delimiter alphabet' — is what separates this from a memorized template. The comparison to HTTP `Content-Length` and Protobuf is the senior-tier touch: it shows you've seen this problem in production, not just on a problem set.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace a couple of round trips." Three cases — a typical two-string input, an empty string in the list (the case that breaks naive delimiter schemes), and a payload containing the delimiter character itself (the case that proves length-prefix earns its keep).

**Worked examples**

- **Input:** `["hello","world"]` → **Output:** `["hello","world"]`
  *Note:* Typical case. Encoded form is `5#hello5#world`.

  ```
  ENCODE:
  s="hello" (len 5) → out += "5#hello" → out="5#hello"
  s="world" (len 5) → out += "5#world" → out="5#hello5#world"
  DECODE str="5#hello5#world":
  i=0: scan to '#' at j=1. len=Number("5")=5. payload=str.slice(2,7)="hello". push. i=j+1+len=1+1+5=7
  i=7: scan to '#' at j=8. len=Number("5")=5. payload=str.slice(9,14)="world". push. i=8+1+5=14
  return ["hello","world"] ✓
  ```
- **Input:** `[""]` → **Output:** `[""]`
  *Note:* Empty string — encodes as `0#`, decodes back to `[""]`. Naive `split(',')` could lose this case entirely.

  ```
  ENCODE:
  s="" (len 0) → out += "0#" → out="0#"
  DECODE str="0#":
  i=0: scan to '#' at j=1. len=Number("0")=0. payload=str.slice(2,2)="". push. i=1+1+0=2
  loop ends (i=2=str.length)
  return [""] ✓
  ```
- **Input:** `["a","#b","c"]` → **Output:** `["a","#b","c"]`
  *Note:* Payload contains '#' itself — this is the case that proves length-prefix beats delimiter-scan. Notice we never try to interpret the '#' inside `#b` as a delimiter.

  ```
  ENCODE:
  s="a" (len 1) → out="1#a"
  s="#b" (len 2) → out="1#a2##b"
  s="c" (len 1) → out="1#a2##b1#c"
  DECODE str="1#a2##b1#c":
  i=0: scan to '#' at j=1. len=1. payload=str.slice(2,3)="a". push. i=3
  i=3: scan to '#' at j=4. len=2. payload=str.slice(5,7)="#b". push. i=7  ← length-prefix consumed the '#' as payload, NOT delimiter
  i=7: scan to '#' at j=8. len=1. payload=str.slice(9,10)="c". push. i=10
  return ["a","#b","c"] ✓
  ```

**Why this matters** — *The third example is the one to mention out loud — it's the case that justifies the entire design. The trace shows the decoder NEVER mistakes the `'#'` inside `'#b'` for a delimiter, because once it's read length=2 it just consumes 2 chars of payload mechanically. The empty-string case is also worth narrating; many candidates' first instinct is to filter empties out, which breaks lossless round-tripping.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Edges worth flagging:"

• Empty list `[]` → encodes to `""`, decodes back to `[]` (the while loop never enters).
• List with empty strings (`[""]`, `["", ""]`) → encodes as `0#`, `0#0#`. Length-prefix handles them cleanly.
• Payload containing `'#'` → handled because we scan to the FIRST `'#'` per header, not any `'#'`.
• Payload containing digits at the front → no problem, because the digits BEFORE the first `'#'` are unambiguously the header.
• Very long payload → string concatenation in encode is technically O(n²) on some engines; for production you'd use an array + join at the end. Not usually an issue in practice for V8.
• Unicode/emoji → `s.length` returns UTF-16 code units, not codepoints. A single emoji counts as length 2. As long as encode and decode both use `.length` and `.slice`, the round trip is still correct — both sides agree on the unit. But if someone consumes the encoded form by codepoint count, they'd be off.

**Why this matters** — *The Unicode call-out is the senior-tier touch — `.length` and `.slice` are consistent (both UTF-16 units) so the round trip is correct internally, but the encoded form is undefined behavior if a *different* system tries to parse it counting codepoints. That kind of cross-system reasoning is what separates implementations from production code. The O(n²) string-concat note also shows depth — knowing that the canonical might not be optimal at scale.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(N) where N is the total character count across all input strings. Encode does one pass with O(1) per char (modulo string-concat caveats above). Decode does one pass with O(1) per char — the inner while that scans for `'#'` looks like it could be O(k²), but each character is visited at most twice (once by the scan, once by the slice), so the amortized cost is O(N) total.

Space is O(N) — the encoded string and the decoded list both hold the same total character payload.

If you wanted to extend this: the same length-prefix framing scales to nested structures (encode a list of lists by recursively prefixing). For binary data, you'd swap the digit-header for a fixed-width 4-byte big-endian length, which is what most network protocols actually do. Same template — self-delimiting via explicit length — at every scale."

**Why this matters** — *The amortization defense for the decode's nested while loop is the move — without it, an interviewer might press you on 'isn't that nested?' The recursive-nested and binary-protocol extensions show you see this as a *template*, which is the truth: every serialization format in production uses some flavor of length-prefix or escape-and-delimit, and length-prefix wins for anything where the payload alphabet isn't restricted. That's the senior-track wrap-up.*

---

#### Longest Consecutive Sequence

*Arrays & Hashing* · `p-longest-consecutive` — Find the length of the longest run of consecutive integers in an unsorted array, in O(n). Trick: dump into a Set and only start counting from values whose predecessor is missing.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me restate: I'm given an unsorted array of integers, and I need to return the LENGTH of the longest run of consecutive integers — values that differ by exactly 1, like `[1,2,3,4]`. They don't need to be adjacent in the array; only their values need to be consecutive. A few quick clarifying questions:"

• Are duplicates in the input allowed? If `[1,2,2,3]` is in, does the run count as 3 (1,2,3)?
• Can the integers be negative? Around zero? Very large?
• Is the empty array a valid input? Return 0?
• Just the length, or do I also need to return the actual run?

**Why this matters** — *The duplicates question is what decides whether you need to dedup at the start. Putting everything into a Set both deduplicates AND gives you O(1) membership in one step — that's load-bearing for the algorithm. The negative/large-integer questions are quick sanity checks: this approach handles both natively since we're using `===` semantics via the Set, not numeric arithmetic that could overflow.*

##### 2. Brute force first (out loud)

> Name the obvious solutions before you discard them.

**What I'd say** — "Two reasonable brute forces."

"One: sort the array, walk it, count consecutive runs (resetting on a gap or duplicate). That's O(n log n) time, O(1) extra space if you sort in place. Clean and short."

"Two: for each element `x` in the array, walk upward — does `x+1` exist? `x+2`? `x+3`? Take the max length found. To check existence you'd scan the array each time, which is O(n) per check times n elements times up-to-n walk length — that's O(n³). You can drop one factor of n by putting everything in a Set for O(1) lookup, getting it to O(n²). Still not great because runs would be re-walked starting from every member."

"The key insight for getting to O(n): we don't need to start the walk from every element — only from the START of each run."

**Why this matters** — *Walking through both brute forces is important here because the O(n²) Set version is close to the right answer — it just doesn't filter starting points. That makes the leap to the canonical feel inevitable: 'we have all the right pieces, we just need to avoid starting from mid-run elements.' The sort solution is also worth naming because it's the legitimate O(n log n) fallback if the interviewer rejects the Set-memory cost.*

##### 3. Spot the pattern

> What signal in the problem points to a Set with a sequence-start guard?

**What I'd say** — "This is a Set-with-sequence-head-detection pattern. The structural property: each consecutive run has exactly one element whose predecessor is missing — the run's head. If I only start counting from heads, every element gets walked at most twice across the whole algorithm — once when it's considered as a possible head, once when an actual head's inner while-loop reaches it. That's the amortization that buys us O(n)."

"The data structure is Set because I need TWO O(1) operations: membership (`set.has(x-1)` to detect heads, `set.has(x+len)` to extend runs) AND iteration (to walk candidates exactly once). The head-guard `if (set.has(x - 1)) continue` is the load-bearing line — without it, the inner while-loop runs from every element and you're back to O(n²)."

**Why this matters** — *Naming the data structure AND the structural property — 'O(1) membership PLUS sequence-start detection via the missing-predecessor check' — is what distinguishes derivation from guessing. A naive Set solution without the head-guard looks identical at a glance but is asymptotically O(n²). The head-guard is the *whole* algorithmic idea, and articulating WHY it bounds the work to O(n) is what wins this question.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace a few inputs." Three cases — the classic mix, the empty array, and a duplicate-containing input that confirms the Set dedup is doing real work.

**Worked examples**

- **Input:** `[100,4,200,1,3,2]` → **Output:** `4`
  *Note:* Classic case. Only x=1 and x=100 and x=200 pass the head check; the others (2,3,4) are mid-run and skip. The walk from x=1 finds 2,3,4 → length 4.

  ```
  set = {100,4,200,1,3,2}, best=0
  x=100: set.has(99)=false → HEAD. len=1. set.has(101)=false → run is 1. best=1
  x=4:   set.has(3)=true → mid-run, skip
  x=200: set.has(199)=false → HEAD. len=1. set.has(201)=false → run is 1. best=1
  x=1:   set.has(0)=false → HEAD. len=1.
         set.has(2)=true → len=2. set.has(3)=true → len=3. set.has(4)=true → len=4.
         set.has(5)=false → run is 4. best=4
  x=3:   set.has(2)=true → mid-run, skip
  x=2:   set.has(1)=true → mid-run, skip
  return best=4 ✓
  ```
- **Input:** `[]` → **Output:** `0`
  *Note:* Empty input — Set is empty, outer for-of loop never runs, best stays 0. Vacuously correct.

  ```
  set = {}, best=0
  (for-of loop never enters)
  return best=0 ✓
  ```
- **Input:** `[1,2,0,1]` → **Output:** `3`
  *Note:* Duplicate `1` — the Set dedups it to one entry, and only x=0 passes the head check. Run is 0,1,2 → length 3.

  ```
  set = {1,2,0} (duplicate 1 collapsed), best=0
  x=1: set.has(0)=true → mid-run, skip
  x=2: set.has(1)=true → mid-run, skip
  x=0: set.has(-1)=false → HEAD. len=1.
       set.has(1)=true → len=2. set.has(2)=true → len=3.
       set.has(3)=false → run is 3. best=3
  return best=3 ✓
  ```

**Why this matters** — *The first example is the one to mention out loud — it shows the head-guard skipping 4, 3, and 2 (mid-run elements), and the walk from x=1 doing the real counting work. The third example proves WHY iterating the Set (not the original array) matters: the duplicate `1` collapses to one entry, so we don't waste an outer-loop iteration on it. The empty case is just defense — confirms the base case behaves.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Edges worth flagging:"

• Empty input → for-of never enters, returns 0.
• Single element → set has one entry, it passes the head check (predecessor not in set), inner while finds nothing, returns 1.
• All duplicates (`[5,5,5,5]`) → set collapses to `{5}`, one head, run of 1, returns 1. Confirms dedup matters.
• All-consecutive in order (`[1,2,3,4,5]`) → only `1` passes the head check; the walk from 1 runs the inner while n-1 times. Total work is still O(n) because every other outer iteration short-circuits.
• Negative integers (`[-3,-2,-1,0,1]`) → no special handling needed; `x-1` works on negatives.
• `Number.MIN_SAFE_INTEGER` / `Number.MAX_SAFE_INTEGER` boundaries → `x-1` and `x+len` are fine within the safe-integer range. Beyond that you'd start losing precision, but most interviewers will scope to safe integers.
• `NaN` in the input → set treats `NaN === NaN` for membership, but `NaN - 1` is `NaN`, so the head check passes vacuously and the walk fails on `NaN+1`. Best to ask whether `NaN` is even possible.

**Why this matters** — *The all-consecutive case is the one to mention because it's where the amortization story matters most — the inner while loop does ALL the work in one outer iteration, but it's still O(n) total. Calling that out signals that you've actually thought about the worst-case shape, not just the average. The integer-boundary edge is a senior touch most candidates skip.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) amortized — and the amortization argument is exactly what the head-guard buys us. Each element is touched at most twice across the whole algorithm: once when the outer for-of loop visits it (where the head-guard either skips it or starts a walk), and once by an inner-while step from some head. So total work is bounded by 2n, which is O(n).

Space is O(n) for the Set — at most one entry per distinct input value.

If you wanted to extend this: the same head-detection trick generalizes to 'find all consecutive runs' (return them as ranges instead of just the max length). It also adapts to 'longest consecutive in a stream' (keep a Map of value → run-length and merge runs when a new value bridges two neighbors). Both build on the same primitive — Set membership for O(1) predecessor/successor checks."

**Why this matters** — *The amortization defense — 'each element touched at most twice' — is the answer to 'but you have a nested loop, isn't that O(n²)?' Walking through WHY the head-guard bounds the inner work is the move; just stating 'it's O(n)' isn't enough at the senior level. The stream-variant extension shows you see this as a *template* (Set-for-O(1)-adjacency) that scales beyond the original problem.*

---

#### Valid Palindrome

*Two Pointers* · `valid-palindrome` — Two-pointer convergence: left and right walk inward comparing characters. O(n) time, O(1) extra.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: I'm checking whether `s` reads the same forward and backward, ignoring case and any non-alphanumeric characters — so 'A man, a plan, a canal: Panama' counts as a palindrome because once you strip the punctuation and lowercase it, you get 'amanaplanacanalpanama'."

Then a few quick clarifying questions:
• What counts as 'alphanumeric' — ASCII letters and digits only, or full Unicode letters too?
• What about the empty string — palindrome by convention?
• What about a string that's *only* punctuation (e.g. '.,') and cleans to empty — also true?
• Return value — just a boolean, right? Not the cleaned string?

**Why this matters** — *The 'ignore case and non-alphanumeric' rule is the easy thing to miss on the first read — it changes the whole solution because now you can't just compare `s[l]` and `s[r]` directly. Asking about the only-punctuation case surfaces the convention you'll lean on at the end (cleaned-empty → true). And confirming ASCII vs. Unicode sets the regex you'll write: `/[^a-z0-9]/` for ASCII, or a much messier `\p{L}\p{N}` Unicode property class otherwise.*

##### 2. Brute force first (out loud)

> Name the obvious O(n) solution before you discard it.

**What I'd say** — "The brute force is: clean the string the same way — lowercase, strip non-alphanumeric — then reverse it and compare the cleaned string to its reverse. In JS that's `clean === [...clean].reverse().join('')`. That's O(n) time but it allocates a second string of length n on top of `clean`. Functionally correct, but I think we can do it without the reverse — just walk two pointers inward and short-circuit on the first mismatch."

**Why this matters** — *Two reasons to name reverse-and-compare out loud. (1) It proves you can see the obvious answer before reaching for the clever one — interviewers worry about candidates who skip straight to two-pointers because they recognized the section header. (2) It frames the two-pointer optimization as 'same comparison, but in place and short-circuiting' rather than a wholly different algorithm — which is exactly what it is.*

##### 3. Spot the pattern

> What signal in the problem points to two pointers converging?

**What I'd say** — "A palindrome is defined by a symmetry property: `clean[i] === clean[n-1-i]` for every `i`. The pairs to check are (0, n-1), (1, n-2), (2, n-3), and so on — meeting in the middle. That's exactly the two-pointer convergence shape: `l` starting at 0, `r` starting at `n-1`, walking inward together. The reverse-and-compare brute force checks the same pairs, just by materializing the reversed string first; two pointers checks them in place, and the first mismatch lets us bail out with `false` immediately. Loop condition is `l < r` — once they cross, every pair has been checked, and the middle character (in odd-length strings) trivially equals itself."

**Why this matters** — *Naming the pattern *and* the structural property that makes it apply is the move. 'Two pointers' alone is a guess; 'two pointers because palindrome symmetry pairs index i with n-1-i, so converging from the ends checks every pair in one pass' is a derivation. The bonus insight — that two pointers short-circuits while reverse-and-compare doesn't — is what justifies the choice on a non-palindrome input where you mismatch on the second character.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — the classic palindrome with heavy punctuation, a non-palindrome that fails early, and the cleans-to-empty edge.

**Worked examples**

- **Input:** `"A man, a plan, a canal: Panama"` → **Output:** `true`
  *Note:* Classic case — heavy punctuation that the normalize step has to strip before two pointers even starts.

  ```
  normalize → clean = "amanaplanacanalpanama" (length 21)
  l=0 r=20 → clean[0]='a' vs clean[20]='a' ✓ → l=1 r=19
  l=1 r=19 → clean[1]='m' vs clean[19]='m' ✓ → l=2 r=18
  l=2 r=18 → clean[2]='a' vs clean[18]='a' ✓ → l=3 r=17
  ... (continues symmetrically, all pairs match)
  l=9 r=11 → clean[9]='c' vs clean[11]='c' ✓ → l=10 r=10
  l=10 r=10 → l < r is false (l == r, middle char). exit loop
  return true
  ```
- **Input:** `"race a car"` → **Output:** `false`
  *Note:* Non-palindrome — short-circuit on the first mismatch. This is where two pointers beats reverse-and-compare.

  ```
  normalize → clean = "raceacar" (length 8)
  l=0 r=7 → clean[0]='r' vs clean[7]='r' ✓ → l=1 r=6
  l=1 r=6 → clean[1]='a' vs clean[6]='a' ✓ → l=2 r=5
  l=2 r=5 → clean[2]='c' vs clean[5]='c' ✓ → l=3 r=4
  l=3 r=4 → clean[3]='e' vs clean[4]='a' ✗ MISMATCH
  return false
  ```
- **Input:** `".,"` → **Output:** `true`
  *Note:* Cleans-to-empty edge — every char is stripped, loop never runs.

  ```
  normalize → clean = "" (length 0)
  l=0 r=-1 → l < r is false (0 < -1 is false). loop never executes
  return true
  ```

**Why this matters** — *Tracing surfaces the two bugs this problem rewards. (1) `l < r` vs `l <= r` — on the middle-character iteration of odd-length strings, `<=` would do an unnecessary self-comparison; here it's harmless but on a different problem (e.g. counting distinct pairs) it'd double-count. (2) The cleans-to-empty case — `r = clean.length - 1 = -1`, and only because `0 < -1` is false does the loop correctly skip. Worth flagging out loud so the interviewer knows you saw it.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty string '' → `clean = ''`, `r = -1`, loop `l < r` is false from the start, returns true. ✓ (palindrome by convention)
• Single character 'a' → `clean = 'a'`, `l=0 r=0`, loop doesn't run, returns true. ✓
• Only punctuation '.,!?' → `clean = ''`, same as empty case, returns true. ✓
• Mixed case 'Aa' → normalized to 'aa', l=0 r=1 match, returns true. The lowercase step is what saves us.
• Already-lowercase no-punct 'abba' → straight pair check, returns true. The normalize step is a no-op.
• Unicode like 'résumé' or emoji — `[^a-z0-9]` strips accented chars and emoji entirely, which may or may not be what we want. If the interviewer cares about diacritics, we'd need `s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()` and a Unicode property regex instead of `[a-z0-9]`. Worth flagging."

**Why this matters** — *The cleans-to-empty and single-char cases both pass for the *same* structural reason — `l < r` is false at entry — and naming that connection is what shows you understand the loop's invariant rather than memorizing pass/fail per case. The Unicode call-out separates seniors from juniors; most candidates never think about it, and the interviewer either nods (impressed) or says 'good catch but assume ASCII for now'. Either outcome is good.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — the normalize step (lowercase + replace) walks the string once, and the two-pointer loop visits each character at most once because `l` only increments and `r` only decrements, so together they cover at most `n` positions. No nested loops, no amortization argument needed.

Space is O(n) for the cleaned string. If memory mattered, I could skip allocating `clean` and instead walk two pointers on the original `s`, advancing each over non-alphanumeric chars in a small helper — that'd be O(1) extra space but the inner skip logic is fiddlier to get right. For interview purposes the O(n) clean is fine and far more readable.

If you wanted to extend to 'palindrome by deleting at most one character', it's the same two-pointer skeleton, but on a mismatch you'd try skipping `l` OR skipping `r` and recursively check the resulting substring. Same template, branching on mismatch instead of bailing."

**Why this matters** — *Calling out the O(n) space and offering the in-place O(1) variant unprompted is the move — it shows you see the tradeoff without the interviewer having to ask. The 'palindrome by deleting one char' extension is LeetCode 680 (Valid Palindrome II) and proves you see two-pointer convergence as a reusable template, not just this problem's solution — that's how the same shape shows up in Reverse String, Container With Most Water, 3Sum, and Trapping Rain Water.*

---

#### 3Sum

*Two Pointers* · `p-3sum` — Sort, then for each anchor i, two pointers converge on the remaining pair. Skip duplicates at every level to keep results unique.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: given an integer array `nums`, return every unique triplet `[a, b, c]` where `a + b + c = 0`. 'Unique' meaning the set of triplets — order within a triplet doesn't matter, and `[-1, 0, 1]` should only appear once even if there are multiple ways to form it from the input."

Then a few quick clarifying questions:
• Can the input have duplicates? (Almost certainly yes — that's where the dedup discipline comes in.)
• Negatives, zero, and positives all allowed? (Need negatives for the sum to ever hit 0 with positives.)
• Any bounds on `nums.length`? (Affects whether O(n²) is acceptable — for n up to ~3000 it's fine.)
• Can I mutate the input by sorting in place, or do I need to copy first?
• Return shape — array of arrays, or some other structure? Does the order of triplets in the output matter?

**Why this matters** — *The 'unique triplets' clause is the load-bearing part of the prompt and the thing that turns a clean two-pointer scan into a problem with three layers of dedup. Surfacing it explicitly tells the interviewer you noticed. The mutation question matters too: sorting is the first move, and a real engineer asks before mutating someone else's array.*

##### 2. Brute force first (out loud)

> Name the obvious O(n³) solution before you discard it.

**What I'd say** — "The brute force is three nested loops — pick `i`, then `j > i`, then `k > j`, check if `nums[i] + nums[j] + nums[k] === 0`. To dedup, I'd sort each triplet, stringify it, and put it in a Set. That's O(n³) time and O(n³) space worst case for the Set. Correct but slow — let me see if I can fix one element and reduce the inner two to a faster search."

**Why this matters** — *Two reasons to narrate this. (1) It anchors the O(n²) target as a clean improvement — you're collapsing the inner two loops, not reinventing the algorithm. (2) The brute force's stringify-and-Set dedup makes the in-place dedup-by-skip in the real solution look obviously better, which is what you want the interviewer to notice.*

##### 3. Spot the pattern

> What signal in the problem points to sort + two pointers?

**What I'd say** — "Sum-to-target on an array screams 'sort it and use two pointers.' Here's the derivation: if I fix the first element `a = nums[i]`, the remaining problem is 'find two numbers in `nums[i+1..]` that sum to `-a`' — that's classic two-sum on a subarray. Sorting buys me two things at once. (1) Two-pointer convergence works: with `l = i+1` and `r = n-1`, if `nums[l] + nums[r]` is too small I move `l` right (bigger value), too big I move `r` left (smaller value), exactly equal I record the triplet. The sorted invariant is what tells me which side to move. (2) Duplicates cluster together, so I can skip them by comparing adjacent values — `if (nums[i] === nums[i-1]) continue` for the anchor, and after a hit `while (nums[l] === nums[l+1]) l++` and the symmetric `r--`. Three layers of dedup, all enabled by the sort."

**Why this matters** — *Pattern-naming alone is a guess. The derivation — fix one element, reduce to two-sum, sort enables both the convergence AND the dedup — is what scores. The bonus insight is that sorting does double duty here: most candidates pitch sort for the convergence and treat dedup as a separate problem. Calling out that it's one decision serving both needs is the senior move.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — the canonical mixed input, the all-zeros dup-skip stress, and a no-triplet case to confirm we return empty cleanly.

**Worked examples**

- **Input:** `[-1, 0, 1, 2, -1, -4]` → **Output:** `[[-1,-1,2],[-1,0,1]]`
  *Note:* Canonical case — has duplicate anchors after sorting, so the i-dedup actually fires.

  ```
  sort → nums = [-4,-1,-1,0,1,2]
  i=0 anchor=-4 → l=1 r=5
    sum = -4 + -1 + 2 = -3 < 0 → l++, l=2
    sum = -4 + -1 + 2 = -3 < 0 → l++, l=3
    sum = -4 + 0 + 2 = -2 < 0 → l++, l=4
    sum = -4 + 1 + 2 = -1 < 0 → l++, l=5. l<r false, exit
  i=1 anchor=-1 → l=2 r=5
    sum = -1 + -1 + 2 = 0 ✓ push [-1,-1,2]. l++ r--, l=3 r=4
    sum = -1 + 0 + 1 = 0 ✓ push [-1,0,1]. l++ r--, l=4 r=3. exit
  i=2 anchor=-1, nums[2]==nums[1] → SKIP DUP ANCHOR
  i=3 anchor=0 → l=4 r=5
    sum = 0 + 1 + 2 = 3 > 0 → r--, r=4. exit
  return [[-1,-1,2],[-1,0,1]]
  ```
- **Input:** `[0, 0, 0, 0]` → **Output:** `[[0,0,0]]`
  *Note:* Dup-skip stress — every element is identical, the post-hit dedup loops are what prevent emitting [0,0,0] four times.

  ```
  sort → nums = [0,0,0,0]
  i=0 anchor=0 → l=1 r=3
    sum = 0+0+0 = 0 ✓ push [0,0,0]
    while nums[l]==nums[l+1]: nums[1]==nums[2] → l++, l=2. nums[2]==nums[3] → l++, l=3. l<r false, stop
    while nums[r]==nums[r-1]: l<r false, stop
    l++ r-- → l=4 r=2. exit
  i=1 anchor=0, nums[1]==nums[0] → SKIP
  i=2 same → SKIP. (loop ends at i < length-2 = 2)
  return [[0,0,0]]
  ```
- **Input:** `[1, 2, 3]` → **Output:** `[]`
  *Note:* No-triplet case — smallest possible array (length 3) with all positives, so no sum can hit 0.

  ```
  sort → nums = [1,2,3] (already sorted)
  i=0 anchor=1 → l=1 r=2
    sum = 1 + 2 + 3 = 6 > 0 → r--, r=1. l<r false, exit
  (loop ends at i < length-2 = 1)
  return []
  ```

**Why this matters** — *Two things the trace exposes. (1) The dup-skip loops on l and r need the `l < r` guard inside them — without it, on `[0,0,0,0]` you'd walk off the end and crash on the bounds check; the trace makes that very visible. (2) The outer bound `i < length - 2` (not `< length`) needs to leave room for `l = i+1` and `r`, and the `[1,2,3]` case confirms the loop exits cleanly even when the array is exactly length 3.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty array or length < 3 → `length - 2 ≤ 0`, outer loop never runs, returns `[]`. ✓
• All zeros `[0,0,0,0,...]` → exactly one triplet `[0,0,0]`; the three layers of dedup are what enforce uniqueness.
• All positives or all negatives `[1,2,3]` or `[-3,-2,-1]` → no sum can hit 0, returns `[]`. The two-pointer just walks out without ever finding `sum === 0`.
• Many duplicate anchors `[-1,-1,-1,2,2,2]` → without the `nums[i] === nums[i-1]` skip, you'd emit `[-1,-1,2]` three times.
• Large values near `Number.MAX_SAFE_INTEGER` → `a + b + c` could overflow JS safe-integer range; for interview purposes I'd note it but assume inputs are bounded.
• Should I return triplets in any particular order? The standard answer (and what LeetCode expects) is that triplet order in the output doesn't matter, but within each triplet they're sorted ascending — which falls out for free because we read them off the sorted array."

**Why this matters** — *The dedup-related edges (all-zeros, repeated anchors) are where careless implementations fail — and naming each layer of dedup against the specific input that exercises it shows you understand which check is doing what. The integer-overflow callout is the senior touch; most candidates never think about it, and on a problem with summation it's a real (if rare) concern.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n²). The sort is O(n log n) — dominated. The outer loop runs n times. The inner two-pointer scan for each anchor is O(n), because `l` only increments and `r` only decrements, so together they visit at most `n` positions per anchor. n outer × n inner = n². The dedup-skip loops don't change this — they're amortized into the same `l`/`r` budget.

Space is O(1) extra if we ignore the output array and the sort's stack (which is O(log n) for V8's quicksort). The dedup is in-place via the skip checks — no Set, no hash structure.

If you wanted to extend to 4Sum, it's the same template with one more outer loop layer: fix two anchors, two-pointer the remaining pair. O(n³). The general 'k-Sum' recursion is: peel an outer layer until you hit base case (k=2 → two-pointer), giving O(n^(k-1))."

**Why this matters** — *The amortization argument — that `l` and `r` collectively cover at most n positions per anchor, regardless of how many dup-skips happen — is the right defense against 'isn't the dedup loop nested inside the while loop another factor?' It's not, because the dedup `l++` and the main-path `l++` both consume the same budget. The 4Sum / k-Sum extension proves you see the template, not just this one problem — which is how the same shape generalizes.*

---

#### Container w/ Most Water

*Two Pointers* · `p-container` — Two pointers at the ends. Water is bounded by the shorter side, so always move the shorter pointer inward. O(n).

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: I'm given a `height` array where each value is a vertical line on the x-axis at that index. I pick two lines and form a container with the x-axis as the base — water sits inside up to the level of the shorter of the two lines. I return the maximum water area I can hold by choosing the two best lines."

Then a few quick clarifying questions:
• What's `height.length` — at least 2? (Need two lines to form a container.)
• Can heights be 0? Negative? (Zero means a wall with no height; negative makes no physical sense.)
• What's the largest height? (Affects whether `h * (r - l)` could overflow — for normal int ranges in JS we're safe inside `Number.MAX_SAFE_INTEGER`.)
• Return just the area as a number, right?

**Why this matters** — *The geometry of the problem is the part most people misread on the first pass — confusing it with histogram-style 'water trapped above the bars' (which is the Trapping Rain Water problem, totally different). Restating it with 'lines as walls, water bounded by shorter, base is x-axis distance' makes the model unambiguous and prevents writing the wrong algorithm.*

##### 2. Brute force first (out loud)

> Name the obvious O(n²) solution before you discard it.

**What I'd say** — "The brute force is: nested loops over every pair `(i, j)` with `j > i`, compute `area = min(height[i], height[j]) * (j - i)`, track the max. That's O(n²) — for n up to ~10⁵ it's too slow. Let me see if there's a way to skip whole ranges of pairs without checking them."

**Why this matters** — *Two reasons. (1) The brute force makes the area formula explicit — `min(h[i], h[j]) * (j - i)` — so when I describe the optimization, the interviewer already has the formula in their head. (2) It frames the optimization as 'how do I eliminate pairs from consideration without checking them?' which is exactly what the shorter-pointer move does.*

##### 3. Spot the pattern

> What signal in the problem points to two pointers converging?

**What I'd say** — "Two-pointer convergence — but the trigger isn't just 'pair of indices on an array.' Here's the real argument: start with `l=0` and `r=n-1`, the widest possible base. Width is `r - l`, height is `min(h[l], h[r])`. Now whichever pointer I move inward, the width strictly decreases by 1. So for the new pair to beat the old area, the height has to go *up*. The shorter side is the bottleneck — if I move the *taller* side inward, the new min is at best the same shorter value, but width has shrunk, so area can only decrease. If I move the *shorter* side inward, there's at least a chance the new height exceeds the old shorter side and beats the old area. So: always move the shorter pointer. That eliminates every pair where the taller side was the one that could have moved, which is exactly the pairs we don't need to check."

**Why this matters** — *This is the canonical 'greedy choice that's actually optimal' argument and it's the entire problem. The naming 'width-bounded by `r-l`, height bounded by `min(h[l], h[r])`, moving the taller pointer can only shrink width without raising height' is the senior derivation — most candidates just say 'move the shorter side' as a rule without explaining why moving the taller is provably useless. The 'why' is what separates someone who's memorized the solution from someone who'd derive it on a problem they hadn't seen.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — the canonical mixed-heights case, the minimal-length case, and a case where the best container is at the very ends (so the algorithm shouldn't move past them).

**Worked examples**

- **Input:** `[1, 8, 6, 2, 5, 4, 8, 3, 7]` → **Output:** `49`
  *Note:* Classic case — best container is height[1]=8 paired with height[8]=7, area=min(8,7)*(8-1)=49.

  ```
  init l=0 r=8 best=0
  l=0 r=8: h=min(1,7)=1, area=1*8=8 → best=8. h[l]=1<h[r]=7, l++ → l=1
  l=1 r=8: h=min(8,7)=7, area=7*7=49 → best=49. h[l]=8≥h[r]=7, r-- → r=7
  l=1 r=7: h=min(8,3)=3, area=3*6=18, keep best=49. h[l]=8≥h[r]=3, r-- → r=6
  l=1 r=6: h=min(8,8)=8, area=8*5=40, keep best=49. h[l]=8≥h[r]=8 (equal), r-- → r=5
  l=1 r=5: h=min(8,4)=4, area=4*4=16, keep best=49. h[l]=8≥h[r]=4, r-- → r=4
  l=1 r=4: h=min(8,5)=5, area=5*3=15, keep best=49. h[l]=8≥h[r]=5, r-- → r=3
  l=1 r=3: h=min(8,2)=2, area=2*2=4, keep best=49. h[l]=8≥h[r]=2, r-- → r=2
  l=1 r=2: h=min(8,6)=6, area=6*1=6, keep best=49. h[l]=8≥h[r]=6, r-- → r=1
  l<r false, exit. return 49
  ```
- **Input:** `[1, 1]` → **Output:** `1`
  *Note:* Minimal case — only one pair possible. Loop runs once, exits immediately.

  ```
  init l=0 r=1 best=0
  l=0 r=1: h=min(1,1)=1, area=1*1=1 → best=1. h[l]=1≥h[r]=1, r-- → r=0
  l<r false (0<0), exit. return 1
  ```
- **Input:** `[4, 3, 2, 1, 4]` → **Output:** `16`
  *Note:* Best at the ends — the algorithm catches it on the first iteration. If it kept moving past, it'd never find anything better.

  ```
  init l=0 r=4 best=0
  l=0 r=4: h=min(4,4)=4, area=4*4=16 → best=16. h[l]=4≥h[r]=4 (equal), r-- → r=3
  l=0 r=3: h=min(4,1)=1, area=1*3=3, keep best=16. h[l]=4≥h[r]=1, r-- → r=2
  l=0 r=2: h=min(4,2)=2, area=2*2=4, keep best=16. h[l]=4≥h[r]=2, r-- → r=1
  l=0 r=1: h=min(4,3)=3, area=3*1=3, keep best=16. h[l]=4≥h[r]=3, r-- → r=0
  l<r false, exit. return 16
  ```

**Why this matters** — *Two things the trace exposes. (1) On the equal-heights case (`h[l] === h[r]`), the `<` check in `if (height[l] < height[r])` falls through to `r--` — that's fine because moving either pointer gives a symmetric outcome; both candidates would tie. Naming this out loud reassures the interviewer that you didn't miss the tie. (2) The `[4,3,2,1,4]` case confirms the algorithm correctly identifies the optimal pair on iteration 1 and doesn't fail to find it later — a sanity check that 'always move the shorter side' isn't quietly leaving optimal pairs unconsidered.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Length 2 → exactly one container possible, loop runs once and exits. ✓
• Length 0 or 1 → `r = length - 1` is -1 or 0, `l < r` is false at entry, return best=0. (Problem usually constrains length ≥ 2, but defensive.)
• All-same heights `[5,5,5,5]` → best is `5 * (n-1)`, found on the first iteration, then never beaten. The shorter-side rule degenerates to 'always r--' (or always l++); doesn't matter, every subsequent area is smaller because width shrinks while h stays at 5.
• One zero in the middle `[3, 0, 3]` → the 0-height bar doesn't poison the algorithm because we don't have to pick it; the answer is `min(3,3)*2 = 6`.
• A zero at one end `[0, 5, 5, 5]` → first iteration has h=0, area=0; the shorter-side rule moves l++ past the zero immediately, and we proceed with a meaningful container.
• Strictly increasing `[1,2,3,4,5]` or decreasing `[5,4,3,2,1]` → in the increasing case, every iteration moves l++ (the left is always shorter); in the decreasing case, every iteration moves r--. Both still O(n)."

**Why this matters** — *The all-same and monotone cases prove the algorithm's worst-case behavior is still O(n) — every iteration advances exactly one pointer, total iterations = n - 1. The zero-at-one-end case is the one that catches careless implementations that try to skip zero bars; you don't need to skip them, the algorithm handles them naturally. Naming why each edge works (rather than just listing them) shows you've reasoned about the invariant.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n). The loop runs until `l` and `r` meet. Each iteration advances exactly one of them — `l++` or `r--`, never both, never neither. They start `n-1` apart and meet when `l === r`, so total iterations is exactly `n - 1`. Each iteration does O(1) work — a min, a multiply, a compare, a pointer move. So O(n) overall.

Space is O(1) — just `l`, `r`, `best`, and the loop-local `h`/`area`. No auxiliary structures.

The correctness defense is the load-bearing part: I'm pruning n² pairs down to n by always moving the shorter side. The argument is that any pair I skip has the taller side as the bottleneck on the side that I would move, and width strictly shrinks, so the skipped pair is dominated.

If you wanted a related problem with the same shape: Trapping Rain Water uses the same two-pointer-walk-the-ends template, but instead of an area between two walls, you're accumulating water above each bar bounded by the running max from each side. Same machinery, different accumulator."

**Why this matters** — *The O(n) defense is mostly the iteration count, but the correctness defense is what the interviewer is really probing for — without it, you've just described a heuristic that happens to work. Spelling out 'any skipped pair is dominated by one I checked, because width strictly shrinks and height can't exceed the shorter side I moved past' is the rigorous form. The Trapping Rain Water extension shows you see the template — both problems use 'two pointers at the ends, advance the shorter, accumulate.'*

---

#### Trapping Rain Water

*Two Pointers* · `p-trapping-rain` — Total water trapped above a height array. Two pointers march inward; the shorter side fixes the water level on that column.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: each entry in `height` is a 1-unit-wide vertical bar at that index. After rain, water collects on top of bars wherever there's a 'basin' — a low spot with taller bars on both sides. I return the total trapped water across all columns. So for `[0,1,0,2,1,0,1,3,2,1,2,1]` the answer is 6 units."

Then a few quick clarifying questions:
• Heights all non-negative? (0 is a flat ground tile.)
• `height.length` could be 0 or 1, right? (Can't trap water with fewer than 3 bars.)
• Total water as a single number, not per-column?
• Any upper bound on heights? (Affects integer-overflow concern, though in JS we have a wide safe-int range.)

**Why this matters** — *The mental model — 'water sits above column `i` up to `min(leftMax, rightMax) - height[i]`' — is unambiguous once you state it, but ambiguous if you don't. Some candidates conflate this with Container With Most Water (which is between two chosen walls, not above a histogram). The restatement prevents that misread.*

##### 2. Brute force first (out loud)

> Name the obvious O(n²) solution before you discard it.

**What I'd say** — "The brute force is column-by-column: for each index `i`, scan left to find `leftMax[i]` (the tallest bar at or before `i`), scan right to find `rightMax[i]`, then add `min(leftMax, rightMax) - height[i]` to the total. That's O(n²) — n columns times an O(n) scan each side.

The first natural optimization is to precompute two arrays — `leftMax[]` and `rightMax[]` — in two linear passes, then do a third pass adding `min(leftMax[i], rightMax[i]) - height[i]` per column. That's O(n) time but O(n) extra space.

The two-pointer version drops the precompute by maintaining running `lMax` and `rMax` as we walk inward — O(n) time, O(1) extra space."

**Why this matters** — *Two reasons to walk all three. (1) The precompute-arrays version is a perfectly good interview answer and many candidates stop there — naming it shows you know it, then upgrading to two-pointer shows you can go further. (2) The two-pointer version is the kind of optimization that looks like magic if you skip the intermediate step; framing it as 'same accumulator, but maintain the maxes incrementally instead of precomputing' makes the leap intuitive.*

##### 3. Spot the pattern

> What signal in the problem points to two pointers + running maxes?

**What I'd say** — "The core formula is `water[i] = min(leftMax, rightMax) - height[i]`, summed over all `i`. The key insight: I don't actually need *both* maxes' exact values at every step. I only need the smaller of the two, because that's the binding constraint. Here's the move: with `l` and `r` walking inward, if `height[l] < height[r]`, then I know the running `lMax` (built only from positions ≤ `l`) is strictly less than `rMax` (which is at least `height[r]`) — because `lMax` includes `height[l]` and `height[r] > height[l]`. So `lMax` IS the binding constraint at column `l`, and I can safely settle column `l` using `lMax - height[l]` and advance `l`. Symmetrically when `height[r] ≤ height[l]`. Two pointers + running maxes from each side — O(n) time, O(1) space.

The `min(lMax, rMax)` is replaced by 'whichever side's running max is provably smaller' — which is the side I'm advancing."

**Why this matters** — *This is one of the harder pattern derivations in the catalog because the correctness argument is subtle — the fact that 'the running max on the shorter side IS the binding constraint' isn't obvious until you trace it. Spelling out the inequality chain ('lMax ≤ height[l] in the future direction is irrelevant; lMax already exists from positions ≤ l, and height[r] > height[l] guarantees rMax > lMax') is exactly the rigor that distinguishes a genuine derivation from a memorized rule.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — the canonical mixed terrain, a sharp single-basin case, and a flat case to confirm we return 0.

**Worked examples**

- **Input:** `[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]` → **Output:** `6`
  *Note:* Canonical case — multiple basins, the two pointers alternate sides as they walk in.

  ```
  init l=0 r=11 lMax=0 rMax=0 water=0
  l=0 r=11: h[0]=0 < h[11]=1, settle left. lMax=max(0,0)=0. water += 0-0 = 0. l=1
  l=1 r=11: h[1]=1 ≥ h[11]=1, settle right. rMax=max(0,1)=1. water += 1-1 = 0. r=10
  l=1 r=10: h[1]=1 < h[10]=2, settle left. lMax=max(0,1)=1. water += 1-1 = 0. l=2
  l=2 r=10: h[2]=0 < h[10]=2, settle left. lMax=max(1,0)=1. water += 1-0 = 1 → water=1. l=3
  l=3 r=10: h[3]=2 ≥ h[10]=2, settle right. rMax=max(1,2)=2. water += 2-2 = 0. r=9
  l=3 r=9: h[3]=2 ≥ h[9]=1, settle right. rMax=max(2,1)=2. water += 2-1 = 1 → water=2. r=8
  l=3 r=8: h[3]=2 ≥ h[8]=2, settle right. rMax=max(2,2)=2. water += 2-2 = 0. r=7
  l=3 r=7: h[3]=2 < h[7]=3, settle left. lMax=max(1,2)=2. water += 2-2 = 0. l=4
  l=4 r=7: h[4]=1 < h[7]=3, settle left. lMax=max(2,1)=2. water += 2-1 = 1 → water=3. l=5
  l=5 r=7: h[5]=0 < h[7]=3, settle left. lMax=max(2,0)=2. water += 2-0 = 2 → water=5. l=6
  l=6 r=7: h[6]=1 < h[7]=3, settle left. lMax=max(2,1)=2. water += 2-1 = 1 → water=6. l=7
  l<r false (7<7), exit. return 6
  ```
- **Input:** `[4, 2, 0, 3, 2, 5]` → **Output:** `9`
  *Note:* Asymmetric — the global max is on the right (5), but the algorithm advances from the smaller side and accumulates correctly without needing to know that in advance.

  ```
  init l=0 r=5 lMax=0 rMax=0 water=0
  l=0 r=5: h[0]=4 < h[5]=5, settle left. lMax=max(0,4)=4. water += 4-4 = 0. l=1
  l=1 r=5: h[1]=2 < h[5]=5, settle left. lMax=max(4,2)=4. water += 4-2 = 2 → water=2. l=2
  l=2 r=5: h[2]=0 < h[5]=5, settle left. lMax=max(4,0)=4. water += 4-0 = 4 → water=6. l=3
  l=3 r=5: h[3]=3 < h[5]=5, settle left. lMax=max(4,3)=4. water += 4-3 = 1 → water=7. l=4
  l=4 r=5: h[4]=2 < h[5]=5, settle left. lMax=max(4,2)=4. water += 4-2 = 2 → water=9. l=5
  l<r false, exit. return 9
  ```
- **Input:** `[3, 3, 3]` → **Output:** `0`
  *Note:* Flat case — no basin can form, water=0. Equal heights take the else branch and r marches in.

  ```
  init l=0 r=2 lMax=0 rMax=0 water=0
  l=0 r=2: h[0]=3 ≥ h[2]=3, settle right. rMax=max(0,3)=3. water += 3-3 = 0. r=1
  l=0 r=1: h[0]=3 ≥ h[1]=3, settle right. rMax=max(3,3)=3. water += 3-3 = 0. r=0
  l<r false (0<0), exit. return 0
  ```

**Why this matters** — *Two things the trace makes concrete. (1) The 'update max BEFORE adding water' discipline — on the first iteration of any side, the running max is 0 and `height` could equal the new max; if you added water first and then updated, you'd subtract a stale max. The trace shows `lMax = max(lMax, height[l])` always happens first, and the subsequent `lMax - height[l]` is always non-negative. (2) The `[4,2,0,3,2,5]` case shows the two-pointer doesn't need to know in advance which side holds the global max — it just keeps settling the smaller side, and the invariant guarantees correctness.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• `[]` or single element `[5]` → `r = length - 1` is -1 or 0, `l < r` is false at entry, water=0. ✓
• Two elements `[5, 5]` → loop runs once, settles right, adds 0, exits. water=0 (no basin possible with 2 bars).
• Flat array `[3,3,3,3]` → no basin, water=0. Trace shows every iteration adds 0.
• Monotone increasing `[1,2,3,4,5]` → no water can be trapped (no right wall higher than the increasing side). The algorithm always settles left (since `h[l] < h[r]` for every step), adds `lMax - h[l]` which is 0 each time because `lMax === h[l]` after the update.
• Monotone decreasing `[5,4,3,2,1]` → same logic, mirror image, water=0.
• A bar taller than any context `[0,5,0]` → lMax/rMax both eventually hit 5, the 0 in the middle gets water += 5-0 = 5. ✓
• All zeros `[0,0,0,0]` → water=0 trivially, no actual basin.
• Heights that pile high without an opposing wall `[5,0,0,0]` → no right wall to trap, water=0; the algorithm advances from the right side adding 0 each time."

**Why this matters** — *The monotone cases are the ones that look like they 'should' trap water (a wall exists on one side!) but don't, because trapping requires a higher bar on BOTH sides. Naming why the algorithm correctly returns 0 — `lMax === h[l]` after the update so the contribution is 0 — confirms you understand the invariant rather than memorizing 'monotone returns 0'.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n). Each iteration advances exactly one of `l` or `r`, never both, never neither. They start `n-1` apart and meet, so total iterations is `n - 1`. Each iteration is O(1) — a compare, a max, a subtract, an add, a pointer move.

Space is O(1). Four scalars: `l`, `r`, `lMax`, `rMax`, plus the `water` accumulator. No precomputed arrays, no stack, no hash. This is the win over the precompute-arrays version (which is also O(n) time but O(n) space).

The correctness defense is the invariant: at any iteration where `height[l] < height[r]`, the running `lMax` is provably the smaller of the two true maxes, because `rMax ≥ height[r] > height[l]` and `lMax` already includes `height[l]`. So settling column `l` with `lMax - height[l]` gives exactly the right water amount for that column. Symmetric on the other side.

If you wanted related problems: there's a stack-based O(n) version that processes water 'horizontally' — every time you encounter a bar that's taller than the top of stack, you pop and compute the rectangle of water trapped at that level. Same total complexity, different mental model. Container With Most Water is the sister problem on the same `height` array shape but a different question (max area between two chosen walls instead of water above a histogram)."

**Why this matters** — *Calling out the O(1) space win unprompted is the move — both the precompute-arrays version and this version are O(n) time, but the space difference is what makes this the preferred answer for an interviewer. The stack-based variant proves you see that 'trap water above a histogram' has a family of solutions, and the Container With Most Water callout flags the family connection that interviewers often probe for ('have you seen another problem with this shape?').*

---

## Day 2 — Pattern power day *(2026-05-25)*

### Morning — Sliding Window + Stack *(~3 hr)*

#### Buy/Sell Stock

*Sliding Window* · `best-time-stock` — Track the minimum price seen so far; compute profit at each step. Single pass, O(1) space.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: `prices[i]` is the stock price on day `i`, and I want the max profit from exactly one buy followed by exactly one sell on a later day. If no profitable trade exists, I return 0 — I just don't trade."

Then a few quick clarifying questions:
• Can buy and sell happen on the same day? (Standard answer: no — sell must be strictly after buy.)
• Can prices be negative or zero, or always positive integers?
• Empty array or single-day input — return 0?
• Just the profit, or the (buy_day, sell_day) pair too?

**Why this matters** — *The buy-before-sell constraint is the entire reason this isn't just `max(prices) - min(prices)` — if the min comes after the max, that subtraction is wrong. Asking the same-day question pins down that the indices must be strictly ordered. Confirming the return shape matters because a follow-up often asks for the days, and you don't want to redesign halfway through.*

##### 2. Brute force first (out loud)

> Name the obvious O(n²) solution before you discard it.

**What I'd say** — "The brute force is: for every buy day `i`, walk every sell day `j > i`, compute `prices[j] - prices[i]`, and track the max. Two nested loops, O(n²) time, O(1) space. Correct but slow — let me see if we can do it in one pass."

**Why this matters** — *Two reasons to name it out loud. (1) It proves you understand the constraint — every candidate pair is `(i, j)` with `j > i`, and the brute force makes that explicit. (2) It frames the optimization clearly: instead of re-scanning all earlier days for each `j`, we can keep a running `min` of everything before `j` and compute `prices[j] - min_so_far` in O(1). The brute force is doing redundant work; we just memoize the one piece that matters.*

##### 3. Spot the pattern

> What signal in the problem points to single-pass running-min tracking?

**What I'd say** — "This is technically grouped under sliding window, but it's not a classic two-pointer window — it's a one-pass greedy. The key observation: the best profit ending on day `i` is `prices[i] - min(prices[0..i-1])`. So I only need ONE piece of state from the past — the minimum price seen so far. Not a window of values, not a frequency map, just a single number that monotonically decreases (or stays the same) as I scan left to right. That's the running-min/running-max template: when the answer at position `i` depends only on `nums[i]` and one summary statistic of everything before it, you collapse the prefix to that statistic and walk once."

**Why this matters** — *Naming why this isn't a 'real' sliding window is the move — the rusty engineer sees this in the Sliding Window section and might try to over-engineer with two pointers and a window structure. The structural insight is that the 'window' here is degenerate: it's everything before `i`, summarized by a single scalar. That's why the canonical is so short. Recognizing 'I only need ONE summary stat of the prefix' is the trigger that picks running-min over a literal sliding window — and the same trigger applies to Maximum Subarray (Kadane's) and Largest Rectangle prefixes.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — a normal mix with a clear buy/sell point, a strictly-decreasing degenerate case (no trade), and a strictly-increasing case (buy day 0, sell last day).

**Worked examples**

- **Input:** `[7,1,5,3,6,4]` → **Output:** `5`
  *Note:* Classic mix — minSoFar updates twice (7→1), then profits compete (4, 2, 5, 3) and best lands on 5 (buy at 1, sell at 6).

  ```
  init minSoFar=Infinity, best=0
  idx=0 p=7  → p < minSoFar → minSoFar=7,           best=0
  idx=1 p=1  → p < minSoFar → minSoFar=1,           best=0
  idx=2 p=5  → else: profit = 5-1 = 4, best=max(0,4)=4
  idx=3 p=3  → else: profit = 3-1 = 2, best=max(4,2)=4
  idx=4 p=6  → else: profit = 6-1 = 5, best=max(4,5)=5
  idx=5 p=4  → else: profit = 4-1 = 3, best=max(5,3)=5
  return 5
  ```
- **Input:** `[7,6,4,3,1]` → **Output:** `0`
  *Note:* Strictly decreasing — every day updates minSoFar, the else branch never runs, best stays 0. This is why best starts at 0, not -Infinity.

  ```
  init minSoFar=Infinity, best=0
  idx=0 p=7 → minSoFar=7, best=0
  idx=1 p=6 → minSoFar=6, best=0
  idx=2 p=4 → minSoFar=4, best=0
  idx=3 p=3 → minSoFar=3, best=0
  idx=4 p=1 → minSoFar=1, best=0
  return 0  (no trade — best stayed at its initial 0)
  ```
- **Input:** `[1,2,3,4,5]` → **Output:** `4`
  *Note:* Strictly increasing — minSoFar locks at 1 on day 0, then every day extends best by exactly 1 until it hits 4.

  ```
  init minSoFar=Infinity, best=0
  idx=0 p=1 → minSoFar=1,             best=0
  idx=1 p=2 → else: profit=2-1=1,     best=1
  idx=2 p=3 → else: profit=3-1=2,     best=2
  idx=3 p=4 → else: profit=4-1=3,     best=3
  idx=4 p=5 → else: profit=5-1=4,     best=4
  return 4
  ```

**Why this matters** — *The decreasing case is the one that defends the `best = 0` initialization — if you initialized `best = -Infinity` instead, you'd return -Infinity here, which is wrong (the problem says 'don't trade'). The mixed case surfaces the order-of-operations bug: if you update `minSoFar` BEFORE checking profit, then on a day where `p < minSoFar` you'd compute `p - p = 0` and miss the real profit. The `if/else` (update min OR sell, never both same iteration) sidesteps that — worth stating out loud so the interviewer knows you saw it.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty array `[]` → loop doesn't run, best=0. Probably what you want, but worth confirming the spec.
• Single day `[5]` → loop runs once, updates minSoFar to 5, never enters else (no profit possible with one day). best=0. ✓
• Strictly decreasing `[5,4,3,2,1]` → no profitable trade, best stays at its initial 0. This is why `best = 0` (not `-Infinity`).
• All-same `[3,3,3,3]` → first day sets minSoFar=3, then every later day `p < minSoFar` is FALSE (3 is not less than 3), so we take the else branch and compute `3-3=0`. best stays 0. ✓
• Strictly increasing `[1,2,3,4,5]` → minSoFar locks at day 0, max profit is `last - first`.
• Negative prices — math still works, but worth flagging that real stock prices can't go negative; if they can be 0, also fine."

**Why this matters** — *The all-same case is the subtle one — `p < minSoFar` is strict, so on equal-price days you fall into the else branch and compute a zero profit, which doesn't change `best`. That's the right behavior, but a candidate who used `<=` would still get the right answer here by coincidence (`minSoFar = p` is a no-op when they're equal). Calling out the equality semantics shows you actually traced what the operator does instead of just typing `<` because it 'felt right'.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — exactly one pass, constant work per element (a comparison and at most one subtraction + Math.max). No nested loops, no amortization argument needed.

Space is O(1) — two scalars, `minSoFar` and `best`. Doesn't grow with input.

A natural follow-up is 'Best Time to Buy and Sell Stock II' — unlimited transactions, just no overlapping. That collapses to: sum every positive `prices[i] - prices[i-1]`, because any monotonic upward run is a buy-low/sell-high you should take. Different problem, but the same one-pass greedy mindset. The 'with at most K transactions' variant (LeetCode 188) is where it actually becomes DP — you need a 2D state because the optimal-substructure breaks at K=2+. Worth knowing the boundary between greedy and DP for this family."

**Why this matters** — *The complexity here is easy — the interesting wrap-up is the follow-up family. Naming Stock II (greedy, O(n)) and Stock III/IV (DP, O(nK)) without being asked signals you've seen the whole template, not just this one variant. The 'one summary stat → greedy; K-bounded transactions → DP' boundary is the kind of meta-insight that closes a senior interview cleanly.*

---

#### Longest substring

*Sliding Window* · `p-longest-sub` — Sliding window with a Set: expand the right edge, shrink the left while a duplicate sits in the window. O(n) time.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: longest substring of `s` with no repeating characters — by substring you mean contiguous, right? (As opposed to subsequence.)"

Then a few quick clarifying questions:
• Character set — ASCII only, or full Unicode?
• Empty string — return 0?
• Case sensitivity — is "aA" length 2 or 1?
• Return value — just the length, or the substring itself?

**Why this matters** — *Takes 20 seconds and signals that you don't dive into code blind. The character-set question matters: it sets the space bound. The contiguous-vs-subsequence question matters even more: if you misread it as subsequence, you'd build a completely different (and harder) solution.*

##### 2. Brute force first (out loud)

> Name the obvious O(n²) solution before you discard it.

**What I'd say** — "The brute force is: for every starting index `i`, walk forward with `j` and track seen characters in a Set. The moment you hit a repeat, record `j - i` and move `i` forward. That's O(n²) time, O(n) space — let me see if we can do better."

**Why this matters** — *Two reasons to name it out loud. (1) It proves you understand the problem before optimizing — interviewers worry about candidates who pattern-match straight to the clever answer. (2) It plants the seed for the real solution: the brute force is restarting the Set on every `i`. The optimization is literally just "don't restart — slide."*

##### 3. Spot the pattern

> What signal in the problem points to sliding window?

**What I'd say** — "'Longest contiguous X with property Y' is the canonical sliding-window trigger. And here the property — no repeats — is monotone under shrinkage: if `[l..r]` has a duplicate, removing chars from the left can only fix it, never break it. So once I move `r` forward, I never have to back up. One pass with `r`, a Set tracking what's in the window, and `l` only advances when forced."

**Why this matters** — *Naming the pattern *and* the property that makes the pattern apply is the move. "Sliding window" alone is a guess; "sliding window because the property is monotone in shrinkage" is a derivation. Interviewers grade on the second.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — a normal mix, an all-same-char degenerate case, and the L3 prompt's own input as a final sanity check.

**Worked examples**

- **Input:** `"abcabcbb"` → **Output:** `3`
  *Note:* Classic mix — multiple single-step shrinks.

  ```
  r=0 'a' → seen={a},     window [0,0], best=1
  r=1 'b' → seen={a,b},   window [0,1], best=2
  r=2 'c' → seen={a,b,c}, window [0,2], best=3
  r=3 'a' → dup! delete s[0]='a', l=1. seen={b,c}. add 'a'. window [1,3], best=3
  r=4 'b' → dup! delete s[1]='b', l=2. seen={c,a}. add 'b'. window [2,4], best=3
  r=5 'c' → dup! delete s[2]='c', l=3. seen={a,b}. add 'c'. window [3,5], best=3
  r=6 'b' → dup! delete s[3]='a', l=4. still dup. delete s[4]='b', l=5. add 'b'. window [5,6], best=3
  r=7 'b' → dup! delete s[5]='c', l=6. still dup. delete s[6]='b', l=7. add 'b'. window [7,7], best=3
  ```
- **Input:** `"bbbbb"` → **Output:** `1`
  *Note:* Degenerate all-same-char — every step triggers a full shrink, but still O(n) amortized.

  ```
  r=0 'b' → seen={b}, window [0,0], best=1
  r=1 'b' → dup! delete s[0]='b', l=1. add 'b'. window [1,1], best=1
  r=2 'b' → dup! delete s[1]='b', l=2. add 'b'. window [2,2], best=1
  r=3 'b' → dup! delete s[2]='b', l=3. add 'b'. window [3,3], best=1
  r=4 'b' → dup! delete s[3]='b', l=4. add 'b'. window [4,4], best=1
  ```
- **Input:** `"pwwkew"` → **Output:** `3`
  *Note:* Sanity-check the L3 prompt's own input — the longest unique substring is "wke", not the prefix.

  ```
  r=0 'p' → seen={p},     window [0,0], best=1
  r=1 'w' → seen={p,w},   window [0,1], best=2
  r=2 'w' → dup! delete s[0]='p', l=1. still dup. delete s[1]='w', l=2. add 'w'. window [2,2], best=2
  r=3 'k' → seen={w,k},   window [2,3], best=2
  r=4 'e' → seen={w,k,e}, window [2,4], best=3
  r=5 'w' → dup! delete s[2]='w', l=3. add 'w'. window [3,5], best=3
  ```

**Why this matters** — *Tracing surfaces the subtle bug — you have to delete `s[l]` *before* you increment `l`, otherwise you delete the wrong character. The all-same-char case also defends the O(n) claim: even when every step shrinks, each character still enters and exits the set exactly once. Catching both on the whiteboard is much less painful than catching them after the interviewer points out failing tests.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty string → loop doesn't execute, best=0. ✓
• Single char → no duplicate, best=1. ✓
• All same char ("aaaa") → each new `r` triggers a full shrink, but every char still enters and exits the set exactly once, so still O(n). best=1.
• All unique ("abcdef") → `l` never moves, best=n.
• Unicode/emoji — `s[r]` indexes UTF-16 code units, not codepoints, so a single emoji could read as two halves. Worth flagging; the fix is `[...s]` to iterate by codepoint."

**Why this matters** — *Edge-case enumeration is the difference between "works on the example" and "production-ready". The Unicode call-out in particular shows depth — most candidates never think about it, and the interviewer either nods (impressed) or says "good catch but assume ASCII for now". Either outcome is good.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — even with the nested `while`, each character enters `seen` at most once and is removed at most once, so total work across the outer loop is bounded by 2n.

Space is O(min(n, |alphabet|)) — the Set never holds more than the alphabet size, which is 128 for ASCII, much smaller in practice.

If you wanted to extend to 'at most K distinct chars,' I'd swap the Set for a count-Map and shrink while `map.size > K`. Same template, different shrink condition."

**Why this matters** — *The amortized-analysis argument ("each char enters/exits once") is the right defense against an interviewer who pushes back with "but you have a nested loop, isn't that O(n²)?". The extension to 'at most K distinct' is unprompted bonus material that demonstrates you see the template, not just this one problem — that's how the same pattern shows up in Minimum Window Substring, Longest Substring with At Most K Distinct, etc.*

---

#### Min Window Substring

*Sliding Window* · `p-min-window` — Smallest substring of s containing every char of t (with multiplicities). Sliding window with need-Map + have/required counter. O(|s| + |t|).

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: I'm looking for the shortest contiguous substring of `s` that contains every character of `t`, counting multiplicities — so if `t = "AABC"`, the window has to have at least 2 A's, 1 B, and 1 C. If multiple windows tie on length, I return the leftmost one. If no window works, I return the empty string."

Then a few quick clarifying questions:
• Multiplicities — confirmed `t = "AABC"` requires two A's, not just one?
• Case sensitivity — is `'a'` distinct from `'A'`?
• Character set — ASCII, or full Unicode?
• Tie-break — leftmost shortest, or any shortest?
• What if `t` is empty — return `""`, or undefined behavior?

**Why this matters** — *The multiplicities question is the entire game. A candidate who treats this as 'window contains every distinct char of t' writes a much simpler (and wrong) solution — and the interviewer will hand them a test case like `s="a", t="aa"` to expose it. Asking up front signals you've already spotted the trap. The tie-break question also matters — the natural implementation gives leftmost-shortest for free, but it's good to confirm rather than discover it's wrong in a test.*

##### 2. Brute force first (out loud)

> Name the obvious O(|s|² · |t|) solution before you discard it.

**What I'd say** — "The brute force is: for every pair of indices `(i, j)` with `i ≤ j`, check whether `s[i..j]` contains all of `t` with the right multiplicities — that check is O(|t|) using a frequency map. Three nested loops total — O(|s|² · |t|). Correct but obviously too slow.

The optimization comes from noticing that as I expand `j` to the right, I'm building on a window I already characterized. I shouldn't re-scan from scratch — I should maintain a frequency map of the current window incrementally and a single 'how close am I' signal. That points to two pointers with a counter."

**Why this matters** — *Two reasons. (1) Stating the explicit O(|s|² · |t|) bound (not just 'slow') shows you can reason about complexity from the loop structure, not just recite memorized answers. (2) The optimization is non-obvious — going from 'check every window' to 'extend the window and amortize the count' is the whole insight. Naming the redundant work (re-scanning) makes the leap to 'maintain incrementally' feel inevitable rather than magical.*

##### 3. Spot the pattern

> What signal in the problem points to a variable-size window with a two-counter satisfaction signal?

**What I'd say** — "This is variable-size sliding window — `l` and `r` move independently. The expand/shrink loop is: extend `r` until the window is valid (covers `t`), then shrink `l` while it stays valid, recording the smallest valid window seen. The valid → invalid → valid oscillation is exactly the variable-window template.

The load-bearing trick is the satisfaction signal — how do I cheaply know 'is this window valid right now?' The naive answer is 'compare two whole maps every iteration,' which makes the algorithm O(|s| · alphabet). The clever answer is a `have` counter that tracks how many DISTINCT chars in `t` have their quota met in the current window. The window is valid exactly when `have === required`, where `required = need.size`. That collapses the validity check from O(alphabet) to O(1).

The two `have` updates have a critical asymmetry — increment ONLY when `window[c]` hits `need[c]` exactly (`===`), and decrement ONLY when `window[c]` drops strictly below `need[c]`. Going past the quota on either side mustn't bump `have`, because the window is still satisfying that char."

**Why this matters** — *The variable-size two-pointer window with a need/have counter is one of the most reused interview patterns — it shows up in 'Longest Substring with At Most K Distinct,' 'Permutation in String,' 'Find All Anagrams,' 'Substring with Concatenation of All Words.' Naming the asymmetric `===` and `<` conditions out loud isn't pedantry — it's the exact bug interviewers expect you to almost ship, and articulating it preempts the 'why not >= ?' pushback. The 'collapse the validity check to one int' insight is also what separates a working solution from an O(n · alphabet) almost-solution.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — a small case with duplicates in t that exercises the multiplicities logic, an impossible case (the trap from clarifying questions), and the classic LeetCode example.

**Worked examples**

- **Input:** `s="ABAC", t="ABC"` → **Output:** `"BAC"`
  *Note:* Small case — need={A:1, B:1, C:1}, required=3. The window 'ABA' has have=2 (A and B met), then C arrives and have=3, triggering shrinks until 'BAC' lands as smallest valid.

  ```
  need = {A:1, B:1, C:1}, required = 3
  r=0 c='A' → window={A:1}. window[A]=1 === need[A]=1 → have=1
  r=1 c='B' → window={A:1,B:1}. window[B]=1 === need[B]=1 → have=2
  r=2 c='A' → window={A:2,B:1}. window[A]=2 ≠ need[A]=1 (excess) → have stays 2
  r=3 c='C' → window={A:2,B:1,C:1}. window[C]=1 === need[C]=1 → have=3
    have===required → bestLen=4 ("ABAC"), shrink:
    drop s[0]='A' → window={A:1,B:1,C:1}. window[A]=1 still === need[A]=1 (not <), have stays 3
    bestLen=3 ("BAC"), shrink again:
    drop s[1]='B' → window={A:1,B:0,C:1}. window[B]=0 < need[B]=1 → have=2, l=2, loop ends
  return "BAC"
  ```
- **Input:** `s="a", t="aa"` → **Output:** `"" (impossible)`
  *Note:* The trap from clarifying — |s| < |t| early-return short-circuits before any work. Without it, the loop just finds no valid window and returns "" anyway.

  ```
  t.length=2, s.length=1 → s.length < t.length → early return ""
  
  (If the early return weren't there:
  need = {a:2}, required = 1
  r=0 c='a' → window={a:1}. window[a]=1 ≠ need[a]=2 → have=0
  loop ends, bestLen=Infinity → return "")
  ```
- **Input:** `s="ADOBECODEBANC", t="ABC"` → **Output:** `"BANC"`
  *Note:* Classic LeetCode case — the L3 prompt's own input. First valid window is "ADOBEC" (length 6), then "CODEBA"-ish intermediate, finally "BANC" (length 4) wins.

  ```
  need = {A:1, B:1, C:1}, required = 3
  r=0..4 'A','D','O','B','E' → window collects A and B, have=2
  r=5 c='C' → have=3. shrink: "ADOBEC" (len 6) is bestLen. drop A → have=2, l=1
  r=6..9 'O','D','E','B' → window={B:2,C:1,D:1,E:1,O:1,...}. have stays 2 (need A still missing)
  r=10 c='B' → already have B met, no change to have
  r=11 c='A' → window[A]=1 === need[A]=1 → have=3
    shrink: window is s[1..11]="DOBECODEBA" (len 10) — not better than 6. drop D, drop O, drop B → window[B]=1 still ok, drop E, drop C → window[C]=0 < need[C]=1 → have=2, l=6
  r=12 c='C' → window[C]=1 === need[C]=1 → have=3
    shrink: window is s[6..12]="ODEBANC" (len 7) → not better than 6. drop O, drop D, drop E → none in need, have stays 3
    window is s[9..12]="BANC" (len 4) → new bestLen=4, bestL=9
    drop B → window[B]=0 < need[B]=1 → have=2, l=10, loop ends
  return "BANC"
  ```

**Why this matters** — *The 'ABAC' trace surfaces the most important bug — when shrinking, dropping the first 'A' takes window[A] from 2 to 1, which still meets need[A]=1, so `have` must NOT decrement. Only when window[B] drops from 1 to 0 (below need[B]=1) does `have` decrement. Watching that play out in a concrete trace is what fixes the asymmetric condition in your head; without the trace, the `<` vs `<=` choice feels arbitrary. The 'a'/'aa' impossible case defends the early return — without it, you still get the right answer, but it's a cheap O(1) guard that saves a pass over s in degenerate inputs.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• `t` empty → spec usually says return `""`. Worth confirming and guarding (early return).
• `|s| < |t|` → impossible by pigeonhole, return `""`. Cheap early-return.
• `s === t` → the whole string is the answer, runs in O(n). Good sanity check.
• `t` has duplicates like `"aabbc"` — this is the multiplicities trap. A candidate using a Set instead of a Map silently fails here. Worth saying out loud.
• `t` larger than s but has all needed chars individually — still impossible (pigeonhole again). The early return covers it.
• Unicode/emoji in s or t — `s[r]` indexes UTF-16 code units, so a multi-unit emoji reads as halves. For interview, assume ASCII unless asked. The fix would be iterating with `for...of` and using the codepoint as the map key.
• Massive `s`, tiny `t` — still O(|s| + |t|). The amortization holds."

**Why this matters** — *The multiplicities edge is THE failure mode here. Other window problems (Longest Substring Without Repeating) get away with a Set; this one absolutely needs counts. Naming the Set-vs-Map distinction unprompted shows you've internalized why the data structure changes with the problem variant — that's pattern fluency, not pattern memorization. The empty/short-`t` guards also signal defensive thinking — a candidate who skips them often gets bitten by an undefined behavior in `need.size === 0` (required=0 makes `have === required` true forever, returning the empty prefix as 'valid').*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(|s| + |t|) — building `need` from `t` is O(|t|), then the main loop: `r` advances exactly |s| times, and `l` advances at most |s| times across the whole run (it only moves forward, never back). So the total work in the outer for and the inner while combined is bounded by 2|s|. Each character of `s` enters the window once and leaves once. Same amortization argument as the longest-substring-no-repeats lesson.

Space is O(|s| + |t|) in the worst case — `need` is bounded by |t|, `window` is bounded by |s|. If the alphabet is small (ASCII), both collapse to O(|alphabet|) ≈ O(1).

The extension worth naming: 'Find All Anagrams of `p` in `s`' uses the same need/have skeleton, but with a FIXED window size of |p| — you don't shrink based on validity, you shrink whenever `r - l + 1 > |p|`. Same template, different shrink trigger. 'Permutation in String' (LeetCode 567) is the boolean variant of that. The template generalizes to any 'window must contain pattern' question."

**Why this matters** — *The amortization argument — `l` moves at most |s| times across the whole run — is the right defense against an interviewer who points at the nested while and says 'isn't that O(|s|²)?' Naming Find All Anagrams and Permutation in String as siblings proves you see the template, not just this problem. The fixed-vs-variable-window distinction at the end is the meta-pattern that ties this lesson to Sliding Window Maximum (also fixed-size) — useful framing for the whole section.*

---

#### Sliding Window Maximum

*Sliding Window* · `p-sliding-window-max` — Maintain a deque of indices whose values are strictly decreasing. The front is always the max of the current window. O(n) total because each index is pushed and popped at most once.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: I'm given an array `nums` and a window size `k`. I slide a window of size `k` from left to right, one position at a time, and for each window position I record the maximum. The output array has length `nums.length - k + 1`."

Then a few quick clarifying questions:
• Is `k` guaranteed `1 ≤ k ≤ nums.length`, or do I have to handle `k > nums.length`?
• Can `nums` contain duplicates, negatives, very large values?
• Output shape — array of maxes, one per window, in left-to-right order?
• What if `nums` is empty — return `[]`?

**Why this matters** — *The `k` bound matters because the canonical loop assumes `k ≤ nums.length` — at `i = k-1` the first window is complete, and if `k > n`, no window ever forms. Confirming that up front lets you skip a defensive check or add it explicitly if needed. Asking about duplicates also signals you're thinking about the comparison operator — strict vs non-strict in the deque pop affects whether duplicates pile up (matters for some variants like 'min plus index').*

##### 2. Brute force first (out loud)

> Name the obvious O(n·k) solution before you discard it.

**What I'd say** — "The brute force is: for each window position `i` from 0 to `n - k`, take `Math.max(...nums.slice(i, i + k))`. That's O(n·k) — each window re-scans `k` elements from scratch. Correct but redundant — every time the window slides one step right, only one element enters and one leaves, but I'm rescanning the other `k-1` that didn't change."

**Why this matters** — *Two reasons. (1) Naming the O(n·k) bound out loud — not just 'slow' — proves you can read complexity off a loop. (2) The phrase 'one in, one out' is what motivates the deque: I need a data structure where I can amortize the 'find max' work across slides, given that slides are incremental. That points either to a heap (O(n log k)) or a monotonic deque (O(n)). Naming both options before picking shows you didn't just memorize one answer.*

##### 3. Spot the pattern

> What signal in the problem points to a monotonic-decreasing deque of indices?

**What I'd say** — "Fixed-size window + 'maximum of the window' + need O(n) total = monotonic deque. The key insight: when a new element `nums[i]` enters the window, any earlier element that's strictly smaller than `nums[i]` can NEVER be the max again — `nums[i]` is in the window, will leave the window later than they will, AND is larger. They're dominated. So I pop them off the back of the deque before pushing `i`.

The deque stores INDICES, not values — and this is the load-bearing choice. Why? Because I need to know WHEN the front falls out of the window (`dq[0] <= i - k`), and that's an index comparison, not a value comparison. Two elements with the same value at different indices are distinguishable by their expiry. Storing values would lose that.

The invariant the deque maintains: values at the indices in the deque are strictly decreasing from front to back. So `dq[0]` is always the index of the current window's maximum. Three operations per step: expire the front if it left the window, pop the back while it's dominated, push the new index, then record `nums[dq[0]]` once the window is fully formed (`i >= k - 1`)."

**Why this matters** — *Naming WHY indices not values is the move — it's the question every interviewer asks, and a candidate who can't answer it has memorized the algorithm without understanding it. The 'dominated' framing (elements that can never be max again get evicted) is also how you derive the strictly-decreasing invariant from first principles, not by remembering 'I think it's decreasing.' The same monotonic-deque pattern shows up in 'Sliding Window Minimum' (flip the comparator), '132 Pattern,' 'Largest Rectangle in Histogram' (monotonic stack variant), and 'Daily Temperatures' — recognizing the family is what makes this problem feel like one of many, not a one-off trick.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — a tiny case (window size 2), a degenerate k=1 case (every element is its own max), and the classic LeetCode example.

**Worked examples**

- **Input:** `nums=[9,11], k=2` → **Output:** `[11]`
  *Note:* Tiny case — when 11 enters, it dominates 9 and pops it. Window is fully formed at i=1, record nums[dq[0]]=11.

  ```
  init dq=[], out=[]
  i=0 nums[0]=9 → dq=[0]. i < k-1=1, no output.
  i=1 nums[1]=11 → nums[dq[-1]]=nums[0]=9 < 11 → pop 0. dq=[]. push 1 → dq=[1]. i >= k-1, out.push(nums[1])=11.
  return [11]
  ```
- **Input:** `nums=[1,-1], k=1` → **Output:** `[1,-1]`
  *Note:* Degenerate k=1 — every element is its own window. The expiry check fires every step (dq[0]=i-1 ≤ i-k=i-1), so the deque always holds exactly one index.

  ```
  init dq=[], out=[]
  i=0 nums[0]=1 → push 0 → dq=[0]. i >= k-1=0, out.push(nums[0])=1.
  i=1 nums[1]=-1 → dq[0]=0 <= i-k=0 → shift → dq=[]. push 1 → dq=[1]. out.push(nums[1])=-1.
  return [1, -1]
  ```
- **Input:** `nums=[1,3,-1,-3,5,3,6,7], k=3` → **Output:** `[3,3,5,5,6,7]`
  *Note:* Classic LeetCode case — the L3 prompt's own input. Notice 3 dominates 1 immediately, then -1 and -3 ride along as candidates, then 5 evicts everything smaller in one sweep.

  ```
  init dq=[], out=[]
  i=0 nums[0]=1  → push 0. dq=[0] (values [1]).         i<2, no output.
  i=1 nums[1]=3  → nums[0]=1 < 3 → pop 0. push 1. dq=[1] (values [3]). i<2, no output.
  i=2 nums[2]=-1 → -1 < 3, no pop. push 2. dq=[1,2] (values [3,-1]). i=2 >= 2 → out.push(nums[1])=3.
  i=3 nums[3]=-3 → dq[0]=1 > i-k=0, no expire. -3 < -1, no pop. push 3. dq=[1,2,3] (values [3,-1,-3]). out.push(nums[1])=3.
  i=4 nums[4]=5  → dq[0]=1 <= i-k=1 → shift. dq=[2,3]. Now nums[3]=-3<5 pop, nums[2]=-1<5 pop. dq=[]. push 4. dq=[4] (values [5]). out.push(nums[4])=5.
  i=5 nums[5]=3  → dq[0]=4 > i-k=2, no expire. 3 < 5, no pop. push 5. dq=[4,5] (values [5,3]). out.push(nums[4])=5.
  i=6 nums[6]=6  → dq[0]=4 > i-k=3, no expire. nums[5]=3<6 pop, nums[4]=5<6 pop. dq=[]. push 6. dq=[6] (values [6]). out.push(nums[6])=6.
  i=7 nums[7]=7  → dq[0]=6 > i-k=4, no expire. nums[6]=6<7 pop. dq=[]. push 7. dq=[7] (values [7]). out.push(nums[7])=7.
  return [3,3,5,5,6,7]
  ```

**Why this matters** — *The classic trace surfaces two subtle bugs. (1) Expiry uses `<=` not `<` — at i=4, dq[0]=1 and i-k=1, and that index IS at the trailing edge of the window for i=3 but OUT of the window for i=4 (window is [2,3,4]). Off-by-one here returns wrong answers silently. (2) When 5 arrives at i=4 and dominates everything, you have to pop -3 and -1 even though they're 'in the window' — they're dominated, so they're useless. A candidate who only pops the immediate predecessor (one pop, not a while loop) gets the right answer here by luck but fails on sequences like `[1,2,3,4,5], k=5`. The while loop is what makes this O(n).*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• `k = 1` → window is a single element; the expiry check fires every step, deque always has size 1, output is just `nums` itself.
• `k = nums.length` → exactly one output (the max of the whole array). The expiry check never fires.
• Strictly increasing `[1,2,3,4,5]` → every new element pops all predecessors. Deque only ever has one element. Output windows show the rightmost element each time.
• Strictly decreasing `[5,4,3,2,1]` → no pops, deque grows up to `k` elements, expire fires once per step after the window forms. Output is the leftmost-but-still-in-window element each time.
• All same `[3,3,3,3]` with `k=2` → since pop condition is `<` (strictly less), equal elements DON'T pop each other. Deque can hold up to k equal elements, expire shifts them off. Output is [3,3,3].
• Empty array → loop doesn't run, return `[]`. Probably worth an early guard.
• Negatives — math works fine, no special handling."

**Why this matters** — *The all-same case is the subtle one — the `<` vs `<=` choice in the pop loop only matters when values are equal, and using `<` is correct because keeping equal-valued elements means you don't lose the max prematurely when the front expires. Walking that out shows you actually reasoned about the comparator instead of typing one and hoping. The strictly-increasing and strictly-decreasing cases are also useful because they're the two ends of how full the deque gets — useful for proving the O(k) space bound.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — amortized. The for loop runs n times. Inside, the while loop can pop multiple elements, but each index enters the deque exactly once (via the final `push(i)`) and leaves at most once (via either the front `shift` or the back `pop`). So the total work across all iterations of the while is bounded by n, not n times k. Even though the worst case for any single step is O(k) pops, the average is O(1).

Space is O(k) — the deque can hold at most k indices (anything older would have been shifted off the front). Output is O(n - k + 1), but that's the answer, not auxiliary space.

A few extensions worth naming. (1) Sliding Window Minimum is the same algorithm with the comparator flipped — pop tails while `nums[tail] > nums[i]`, deque is strictly INCREASING. (2) If you need both max and min simultaneously (e.g., 'longest subarray where max - min ≤ limit'), run two deques in parallel. (3) The monotonic-deque shape generalizes to 'maximum sum subarray of length ≤ k' and 'shortest subarray with sum ≥ target' via prefix sums + monotonic deque. (4) Implementation note — JavaScript arrays' `shift()` is O(n), which technically breaks the amortization in pure JS. For interviews this is fine, but in production you'd use a real deque (linked list, or an array with a head index that you advance) to keep it true O(n)."

**Why this matters** — *The amortization defense is essential here — the inner while loop screams 'O(n·k)!' to anyone who hasn't seen the proof, and a candidate who can't explain why it's actually O(n) loses the credit for the optimization. Naming the `shift()` perf footgun in JS unprompted is the kind of language-specific detail that flags a senior engineer — most candidates write `shift()` and don't realize it's linear-time in V8. The two-deque extension for 'longest subarray with bounded spread' (LeetCode 1438) is a great follow-up to namedrop because it reuses this exact data structure twice.*

---

#### Valid Parentheses

*Stack* · `valid-parentheses` — Push openers; on a closer, the top of the stack must match. Empty stack at the end = valid.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: given a string `s` of bracket characters, return true iff every opener has a matching closer of the same type AND the brackets are properly nested — so '([])' is valid but '([)]' isn't, because the '(' opened first must close last."

Then a few quick clarifying questions:
• Which bracket types — just `()[]{}` or also angle brackets / custom pairs?
• Can the string contain non-bracket characters mixed in, or is it brackets only?
• Empty string — true by convention?
• Return value — just a boolean, not the position of the first mismatch?

**Why this matters** — *The 'properly nested' rule is the easy thing to skim past — if you read it as 'every opener has *some* matching closer somewhere', you'd build a counter-based solution that wrongly accepts '([)]'. The non-bracket-chars question matters because the answer changes the `if` shape: skip them, or treat them as invalid? Confirming brackets-only here lets you write the tight two-branch loop.*

##### 2. Brute force first (out loud)

> Name the obvious O(n²) solution before you discard it.

**What I'd say** — "The brute force is: repeatedly scan the string for an adjacent matched pair like '()' or '[]' or '{}', delete it, and rescan from the start. Keep doing that until either the string is empty (true) or no pair was deleted in a full pass (false). That works because the innermost matched pair is always adjacent — peeling it off reveals the next innermost pair. But it's O(n²) — each pass is O(n) and you might do n/2 passes. Let me see if we can do it in one pass."

**Why this matters** — *Two reasons to name peel-the-innermost out loud. (1) It proves you actually understand WHY nesting works — the innermost pair has to be adjacent, which is the structural insight the stack exploits. (2) It frames the stack solution as 'same peeling logic, but tracked left-to-right with a stack instead of repeatedly rescanning' rather than a clever trick pulled from nowhere — which is exactly what it is.*

##### 3. Spot the pattern

> What signal in the problem points to a stack?

**What I'd say** — "The 'properly nested' constraint IS the LIFO invariant — the most recently opened bracket must be the first to close. That's the literal definition of a stack: last in, first out. So as I scan left to right, every opener I see is a 'pending obligation' that must be resolved by the matching closer before any earlier opener can close. Push openers onto a stack; on every closer, pop the top and verify it's the matching opener. At the end, if the stack isn't empty, there are unclosed openers — invalid."

**Why this matters** — *Naming the pattern *and* the structural property that makes it apply is the move. 'Use a stack' alone is pattern-matching on the section header; 'LIFO matching is the literal definition of a stack — most recent opener must close first' is a derivation. The 'pending obligation' framing also generalizes — it's the same insight behind expression parsing, function-call frames, and HTML tag matching, all of which use the same stack template.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — a clean multi-type valid string, an interleaved invalid that a counter-based approach would wrongly accept, and an unclosed opener.

**Worked examples**

- **Input:** `"()[]{}"` → **Output:** `true`
  *Note:* Classic case — three separate pairs, stack pushes once and pops immediately, never grows past size 1.

  ```
  stack=[]
  i=0 c='(' → opener, push. stack=['(']
  i=1 c=')' → closer, pop → '(' === pairs[')']='(' ✓. stack=[]
  i=2 c='[' → opener, push. stack=['[']
  i=3 c=']' → closer, pop → '[' === pairs[']']='[' ✓. stack=[]
  i=4 c='{' → opener, push. stack=['{']
  i=5 c='}' → closer, pop → '{' === pairs['}']='{' ✓. stack=[]
  loop done — stack.length === 0 → true
  ```
- **Input:** `"([)]"` → **Output:** `false`
  *Note:* Interleaved — a naive counter (count of '(', '[', etc.) would say true, but the stack catches it on the first closer.

  ```
  stack=[]
  i=0 c='(' → opener, push. stack=['(']
  i=1 c='[' → opener, push. stack=['(','[']
  i=2 c=')' → closer, pop → '[' !== pairs[')']='(' ✗ MISMATCH
  return false
  ```
- **Input:** `"("` → **Output:** `false`
  *Note:* Unclosed opener — loop completes without error, but the final stack-empty check catches it.

  ```
  stack=[]
  i=0 c='(' → opener, push. stack=['(']
  loop done — stack.length === 1, not 0 → return false
  ```

**Why this matters** — *Tracing surfaces the two bugs this problem rewards. (1) The closer-on-empty-stack case — `stack.pop()` returns `undefined`, which mismatches every opener via `!==`, so the explicit empty check isn't needed inside the loop. Naming that out loud shows you considered it. (2) The final `stack.length === 0` check — without it, the unclosed-opener case '(' would silently return true. Both are off-by-one-style oversights that interviewers specifically probe for.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty string '' → loop doesn't execute, stack is empty, returns true. ✓ (vacuously valid)
• Single opener '(' → push, loop ends, stack non-empty, returns false. ✓
• Single closer ')' → pop on empty returns undefined, which !== '(' → returns false. ✓ (the `undefined` mismatch is the implicit guard)
• All openers '(((' → push three times, stack non-empty at end, returns false. ✓
• Long alternating '(((...)))' deep nesting — stack grows to n/2 then drains. O(n) time, O(n) space. ✓
• Mismatched-type close '(]' → pop '(' !== pairs[']']='[' → returns false. ✓ The pairs map handles this for free."

**Why this matters** — *Walking the closer-on-empty case explicitly is what shows the interviewer you understood why the loop body doesn't need a separate empty-stack check — `undefined !== anything` is the elegant trick that lets the code stay tight. The deep-nesting case quietly defends the O(n) space bound: worst case the stack holds half the string, which is still linear.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — single pass through the string, each character does one push or one pop plus a constant-time map lookup. No nested loops, no amortization needed.

Space is O(n) — worst case is all openers (e.g. '((((' of length n), where the stack holds all n characters before any pop fires. Realistic well-formed inputs stay much smaller, but the bound is n.

If you wanted to extend to mixed bracket-and-text input — e.g. validate '{name: [1, 2]}' — same skeleton, but you `continue` on any non-bracket char. If you wanted to return the index of the first mismatch instead of a boolean, just track `i` in the for loop and return it on the mismatch path. The stack-of-openers template is reused in expression parsing, HTML/XML validation, and any 'most-recent X' undo problem."

**Why this matters** — *Defending O(n) space explicitly is the move that distinguishes from candidates who say 'O(1) — it's just a stack' without thinking. The 'extend to mixed text' and 'return index' extensions are unprompted bonus material that proves you see the template, not just this problem — that's how the same shape shows up in Min Remove to Make Valid Parentheses, Decode String, and Basic Calculator.*

---

#### Daily Temperatures

*Stack* · `p-daily-temp` — Monotonic decreasing stack of indices: pop while the new temp is warmer, recording the wait for each popped index.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: given an array `temps` of daily temperatures, return an array `result` of the same length where `result[i]` is the number of days you'd have to wait after day `i` until a warmer temperature. If no future day is warmer, `result[i]` is 0."

Then a few quick clarifying questions:
• 'Warmer' — strictly greater, right? Equal temps don't count?
• Integer temperatures, or could they be floats?
• Bounds — is the array length at most 10^5 or larger? (Determines whether O(n²) brute force would even pass.)
• If today is the last day, the answer is 0 by definition?

**Why this matters** — *The strictly-greater vs greater-or-equal question is load-bearing — if equal temps DID count, the inner condition becomes `>=` and the stack logic changes (equal temps resolve each other). Confirming integer temps lets you skip floating-point edge talk. And asking about array size signals you're thinking about whether the O(n²) brute force is even acceptable — sometimes it is, and the interviewer will tell you to stop optimizing.*

##### 2. Brute force first (out loud)

> Name the obvious O(n²) solution before you discard it.

**What I'd say** — "The brute force is: for each index `i`, walk forward with `j` from `i+1` looking for the first `temps[j] > temps[i]`. Record `j - i` and break. If you walk off the end, record 0. That's two nested loops — O(n²) time, O(1) extra space. It works, but for n=10^5 it's 10^10 operations — way too slow. Let me see if we can do it in one pass."

**Why this matters** — *Two reasons to name the nested-loop brute force out loud. (1) It proves you understand the problem before optimizing — and you'd be surprised how often candidates skip this and produce a subtly wrong O(n) solution because they never grounded themselves in what the right answer should look like. (2) It frames the stack solution as 'instead of EACH `i` searching forward for its warmer day, let EACH WARMER DAY broadcast itself backward to the pending `i`s waiting for it' — which is the inversion the stack enables.*

##### 3. Spot the pattern

> What signal in the problem points to a monotonic stack?

**What I'd say** — "This is a 'next greater element' problem — for each `i`, find the nearest `j > i` with `temps[j] > temps[i]`. Whenever you see 'for each element, find the next/previous greater/smaller element', the answer is a monotonic stack. Specifically: I'll keep a stack of INDICES whose answer is still pending, and I'll maintain the invariant that the temperatures at those indices are monotonically DECREASING (top of stack = smallest pending temp). When I see a new temp warmer than the top, I pop — the popped index's wait is `i - poppedIdx` — and I keep popping while the invariant is broken. Each index gets pushed once and popped at most once, so the total work across the outer loop is O(n) even though there's a nested while."

**Why this matters** — *Naming the pattern *and* the structural invariant that makes it apply is the move. 'Use a stack' is a guess; 'monotonic decreasing stack of indices waiting for their warmer day' is a derivation. The 'pushed once, popped once' framing is the amortization argument that defends O(n) — name it here so it's not surprising when you reach section 6. The 'next greater element' framing is also the bridge — once you see this problem as that template, you've also unlocked Next Greater Element I/II, Stock Span, and Largest Rectangle in Histogram.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — the canonical mixed case, all-decreasing (stack never pops), and all-increasing (stack pops every step).

**Worked examples**

- **Input:** `[73, 74, 75, 71, 69, 72, 76, 73]` → **Output:** `[1,1,4,2,1,1,0,0]`
  *Note:* Canonical case — multiple pops at i=5 (resolves 71 and 69) and i=6 (resolves 75 and 72).

  ```
  res=[0,0,0,0,0,0,0,0] stack=[]
  i=0 temp=73 → push. stack=[0]
  i=1 temp=74 > temps[0]=73 → pop 0, res[0]=1-0=1. push 1. stack=[1] res=[1,0,0,0,0,0,0,0]
  i=2 temp=75 > temps[1]=74 → pop 1, res[1]=2-1=1. push 2. stack=[2] res=[1,1,0,0,0,0,0,0]
  i=3 temp=71 < temps[2]=75 → push. stack=[2,3]
  i=4 temp=69 < temps[3]=71 → push. stack=[2,3,4]
  i=5 temp=72 > temps[4]=69 → pop 4, res[4]=5-4=1. 72 > temps[3]=71 → pop 3, res[3]=5-3=2. 72 < temps[2]=75 → stop. push 5. stack=[2,5] res=[1,1,0,2,1,0,0,0]
  i=6 temp=76 > temps[5]=72 → pop 5, res[5]=6-5=1. 76 > temps[2]=75 → pop 2, res[2]=6-2=4. push 6. stack=[6] res=[1,1,4,2,1,1,0,0]
  i=7 temp=73 < temps[6]=76 → push. stack=[6,7]
  loop done — stack=[6,7] both keep their default 0
  return [1,1,4,2,1,1,0,0]
  ```
- **Input:** `[5, 4, 3, 2, 1]` → **Output:** `[0,0,0,0,0]`
  *Note:* All decreasing — invariant never broken, every index pushed, nothing ever pops. Result is all zeros from init.

  ```
  res=[0,0,0,0,0] stack=[]
  i=0 temp=5 → push. stack=[0]
  i=1 temp=4 < temps[0]=5 → push. stack=[0,1]
  i=2 temp=3 < temps[1]=4 → push. stack=[0,1,2]
  i=3 temp=2 < temps[2]=3 → push. stack=[0,1,2,3]
  i=4 temp=1 < temps[3]=2 → push. stack=[0,1,2,3,4]
  loop done — all 5 indices left on stack, all keep res[i]=0
  return [0,0,0,0,0]
  ```
- **Input:** `[1, 2, 3, 4]` → **Output:** `[1,1,1,0]`
  *Note:* All increasing — every push immediately triggers a pop. Stack never has more than 1 element. The last index has no warmer day, keeps 0.

  ```
  res=[0,0,0,0] stack=[]
  i=0 temp=1 → push. stack=[0]
  i=1 temp=2 > temps[0]=1 → pop 0, res[0]=1-0=1. push 1. stack=[1] res=[1,0,0,0]
  i=2 temp=3 > temps[1]=2 → pop 1, res[1]=2-1=1. push 2. stack=[2] res=[1,1,0,0]
  i=3 temp=4 > temps[2]=3 → pop 2, res[2]=3-2=1. push 3. stack=[3] res=[1,1,1,0]
  loop done — stack=[3] keeps res[3]=0
  return [1,1,1,0]
  ```

**Why this matters** — *Tracing surfaces the three bugs this problem rewards. (1) Pushing the TEMP instead of the INDEX — you can't compute `i - j` if `j` was a temperature. (2) Using `>=` instead of `>` — equal temps would pop each other, breaking the 'strictly greater' rule. (3) Forgetting to leave the trailing pending indices with 0 — the `fill(0)` at init is what saves you (no explicit cleanup needed). The all-increasing case also defends the amortization: every step pops once, total pops across the loop = n, so O(n) overall.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty array → result is empty, loop doesn't run. ✓
• Single element → push and never pop, result is [0]. ✓
• All same temps (e.g. [5,5,5]) → since the condition is strictly `>`, no pops fire, result is all 0s. ✓ (This is why the strict-vs-equal clarification mattered.)
• Strictly decreasing → every index pushed, never popped, all 0s. (Worst case for stack-size.)
• Strictly increasing → every step pops exactly once, stack never grows past size 1. (Best case for stack size, every result except last is 1.)
• Two big plateaus separated by a drop, e.g. [5,5,5,1,1,1,9] → the plateau values don't resolve each other (strict `>`), but the trailing 9 resolves them all in one burst when it arrives."

**Why this matters** — *Calling out the all-same case explicitly closes the loop on the strict-vs-equal clarification from section 1 — it shows the interviewer you used that constraint to make a load-bearing decision in the code, not just to fill time. The plateau example is the one that tends to trip up the 'I'll use `>=`' candidate, because they'd resolve plateau entries against each other prematurely (and wrongly).*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — the nested `while` looks scary, but the amortization argument is: each index is pushed onto the stack exactly once, and popped from the stack at most once. So the total work the inner while does across the entire outer loop is bounded by n. Outer loop is n iterations, inner work is amortized O(1) per iteration, total O(n).

Space is O(n) — worst case strictly-decreasing input fills the stack with all n indices.

If you wanted Next Greater Element instead of count-of-days, you'd record `temps[i]` (the warmer value) instead of `i - j` (the wait). If you wanted to look backwards (previous warmer day), iterate right-to-left instead of left-to-right. If you wanted to handle circular arrays (Next Greater Element II), iterate twice through the array (modular indexing) but only push during the first pass. Same monotonic-stack template, different recording rules."

**Why this matters** — *The amortized-analysis argument is what wins the pushback from an interviewer who sees the nested `while` and challenges 'isn't that O(n²)?'. The Next Greater Element extensions are unprompted bonus material that proves you see the template, not just this one problem — that's how the same shape powers Stock Span, Online Stock Span, Sum of Subarray Minimums, and the histogram problem two lessons over.*

---

#### Min Stack

*Stack* · `p-min-stack` — Parallel stack of running minimums alongside the value stack so getMin is O(1).

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: I need a stack data structure supporting push(x), pop(), top(), and getMin() — and the catch is getMin() needs to return the minimum of all values currently in the stack in O(1), not O(n)."

Then a few quick clarifying questions:
• All four operations need to be O(1) — push, pop, top, AND getMin, right?
• Are pop() and top() always called on a non-empty stack, or do I need to handle empty?
• Duplicates allowed? (e.g. push(2), push(2), pop — what's the min after?)
• Integer values only, or could they be floats / strings?

**Why this matters** — *The O(1) constraint on getMin is the whole point of the problem — it's why naive 'scan vals on getMin' (O(n)) won't fly. Confirming duplicates are allowed matters for the parallel-stack design: if you used a 'pop the min stack only when popping the actual min' shortcut, duplicates would silently break it. Asking about empty-stack semantics signals you've thought about edge behavior — but most LeetCode-style problem statements guarantee non-empty for pop/top, so this is usually a quick confirmation.*

##### 2. Brute force first (out loud)

> Name the obvious O(n)-on-getMin solution before you discard it.

**What I'd say** — "The brute force is: just use a single array as the stack. push, pop, and top are all O(1) — straight array operations. But getMin scans the entire stack with `Math.min(...vals)`, which is O(n). That fails the constraint. The alternative naive idea — cache the current min in a variable — works until you pop the min, at which point you don't know what the *next* min is without scanning. So a single variable isn't enough state. We need to remember not just the current min but the min at every depth."

**Why this matters** — *Two reasons to name the cached-min trap out loud. (1) It's the trap candidates fall into — they push a `this.min` field, feel clever, and then realize on pop they have no way to recover the previous min without scanning. Naming it shows you saw the trap before falling in. (2) It frames the parallel-stack solution as 'remember the min at every depth' — which is exactly what a parallel stack of running mins achieves, one stack frame per depth.*

##### 3. Spot the pattern

> What signal in the problem points to a parallel min-stack?

**What I'd say** — "The insight is: when I push x, the new minimum is `min(currentMin, x)`. When I pop, the minimum has to revert to whatever it was BEFORE the pushed element arrived. So I need a way to 'remember' the min at every depth — push and pop in sync with the main stack. That's a parallel stack: `mins[i]` holds the minimum of `vals[0..i]`, and I push to mins on EVERY push (not just when x is the new min) so the two stacks stay the same length. Then pop drops one from each. getMin is just `mins[mins.length - 1]` — O(1) read of the top."

**Why this matters** — *Naming the pattern *and* the invariant that makes it apply is the move. 'Use two stacks' is a guess; 'parallel min-stack tracks the running minimum at each depth, so pop reverts naturally' is a derivation. The 'push to mins on every push, even when x isn't the new min' bit is the load-bearing detail — interviewers specifically ask 'why not only push when x is smaller?' and the answer is exactly the alignment invariant: pop needs to drop one from each, and that only works if the two stacks have the same length.*

##### 4. Trace through examples

> Walk a few operation sequences to confirm the model before writing the class.

"Let me trace through a couple of operation sequences to make sure my model is right." Each example is a sequence of method calls. I'll show vals, mins, and the collected results (one entry per getMin/top call) after each operation. Three sequences cover the canonical case, a case where pushes don't change the min, and one with multiple pops.

**Worked examples**

- **Input:** `push(-2), push(0), push(-3), getMin→-3, pop, top→0, getMin→-2` → **Output:** `[-3,0,-2]`
  *Note:* Canonical case — the LeetCode example. After popping -3, getMin correctly reverts to -2 because mins[1]=-2 is still on the parallel stack.

  ```
  init vals=[] mins=[]
  push(-2) → vals=[-2], mins=[min(Infinity, -2)]=[-2]
  push(0)  → vals=[-2, 0], mins=[-2, min(-2, 0)]=[-2, -2]
  push(-3) → vals=[-2, 0, -3], mins=[-2, -2, min(-2, -3)]=[-2, -2, -3]
  getMin() → mins[top]=-3 → results=[-3]
  pop()    → vals=[-2, 0], mins=[-2, -2]
  top()    → vals[top]=0 → results=[-3, 0]
  getMin() → mins[top]=-2 → results=[-3, 0, -2]
  return [-3, 0, -2]
  ```
- **Input:** `push(5), push(2), getMin→2, push(7), getMin→2, pop, getMin→2` → **Output:** `[2,2,2]`
  *Note:* Push(7) doesn't change the min, but we still push to mins (we push 2, copying the running min). This is the load-bearing detail — without it, lengths would drift.

  ```
  init vals=[] mins=[]
  push(5)  → vals=[5], mins=[min(Infinity, 5)]=[5]
  push(2)  → vals=[5, 2], mins=[5, min(5, 2)]=[5, 2]
  getMin() → mins[top]=2 → results=[2]
  push(7)  → vals=[5, 2, 7], mins=[5, 2, min(2, 7)]=[5, 2, 2]   ← note we push 2 even though 7 > 2
  getMin() → mins[top]=2 → results=[2, 2]
  pop()    → vals=[5, 2], mins=[5, 2]   ← both shrink together
  getMin() → mins[top]=2 → results=[2, 2, 2]
  return [2, 2, 2]
  ```
- **Input:** `push(3), push(1), push(4), getMin→1, pop, getMin→1, pop, getMin→3` → **Output:** `[1,1,3]`
  *Note:* Pop the top (4) — getMin still 1, because mins[1]=1 is unchanged. Pop again (1) — now getMin correctly reverts to 3 from mins[0].

  ```
  init vals=[] mins=[]
  push(3)  → vals=[3], mins=[3]
  push(1)  → vals=[3, 1], mins=[3, min(3, 1)]=[3, 1]
  push(4)  → vals=[3, 1, 4], mins=[3, 1, min(1, 4)]=[3, 1, 1]
  getMin() → mins[top]=1 → results=[1]
  pop()    → vals=[3, 1], mins=[3, 1]
  getMin() → mins[top]=1 → results=[1, 1]
  pop()    → vals=[3], mins=[3]
  getMin() → mins[top]=3 → results=[1, 1, 3]
  return [1, 1, 3]
  ```

**Why this matters** — *Tracing surfaces the two bugs this problem rewards. (1) The 'only push to mins when x < current min' optimization — it seems to save space, but it breaks the alignment invariant: when you later pop, you don't know whether to also pop from mins (was the value-being-popped the min at the time?), and tracking that needs an extra equality check that's easy to get wrong with duplicates. (2) The Infinity initialization for the first push — without it, `mins[mins.length - 1]` on an empty mins stack returns undefined, and `Math.min(undefined, x)` returns NaN, silently poisoning every subsequent getMin. Both are the kind of bugs that pass the easy test cases and fail the trickier ones.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• First push (empty stacks) → Infinity fallback for the prior min, so `Math.min(Infinity, x) = x`. The first mins entry is just x. ✓
• Push of a new minimum then pop → mins[top] correctly reverts to the prior min because we pushed the prior min one level down.
• Duplicate of the current min, e.g. push(2), push(2), pop, getMin → both vals and mins have a 2 at the top; popping drops one of each; mins[new top] is still 2. ✓ (The 'push every time' rule handles duplicates for free; the 'only on smaller' shortcut would silently fail here.)
• Long sequence of monotonically decreasing pushes (3, 2, 1, 0, -1) → mins matches vals exactly. Wastes a bit of space but always correct.
• Long sequence of monotonically increasing pushes (1, 2, 3, 4, 5) → mins is [1, 1, 1, 1, 1] — the original min stays at every level. This is the case where 'only push when smaller' would have saved space, but at the cost of complicating pop.
• pop on empty / top on empty — usually out of scope per the problem statement, but worth flagging that the current implementation would return undefined silently."

**Why this matters** — *The duplicate-of-min case is the killer one to mention — it's the one that breaks the naive 'only push smaller' optimization most clearly, and walking through it shows the interviewer why your 'wasteful' parallel-stack design is actually the right call. The monotonically increasing case is also worth naming because a sharp interviewer might push back with 'isn't this wasteful?' — and the answer is yes by a constant factor (2n instead of n) but it buys O(1) pop with no conditional logic, which is the right tradeoff.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(1) per operation — push does two array pushes plus one Math.min, pop does two array pops, top and getMin are each one array index. No loops anywhere, no amortization argument needed; truly worst-case O(1).

Space is O(n) — two parallel stacks of length n, so 2n total, which is O(n).

If space mattered, the optimization is to push to mins only when `x <= current min` (note `<=`, not `<`, so duplicates are handled), and on pop only pop mins when `vals.pop() === mins[top]`. That's strictly better space in the average case but adds conditional logic that's easier to get wrong. Worth knowing it exists, but I'd default to the parallel-stack version for readability unless space was actually the bottleneck.

The parallel-tracking pattern shows up elsewhere — Max Stack uses the same trick with `>=` instead of `<=`. A monotonic deque (for sliding window max/min) is the same idea generalized to allow removal from both ends. The 'track auxiliary state in sync with the main structure' template applies anywhere you need O(1) lookup of a derived value."

**Why this matters** — *Explicitly naming the space-optimized variant unprompted is the senior-candidate move — it shows you know the tradeoff exists and you've made a deliberate choice (readability over a constant-factor space savings). The Max Stack and monotonic deque connections prove you see the template, not just this one problem — that's how the same shape powers Sliding Window Maximum and Stock Spanner.*

---

#### Largest Rectangle in Histogram

*Stack* · `p-largest-rect-hist` — Monotonic increasing stack of indices. When a shorter bar arrives, pop and compute the rectangle whose height is the popped bar; its width spans from the new stack-top to the current index. Append a 0 sentinel so everything drains at the end.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: I have an array `heights` where `heights[i]` is the height of a bar of width 1 sitting at position `i`, and I want the area of the largest axis-aligned rectangle I can fit *inside* the histogram. The rectangle has to be horizontal — same height all the way across — but can span any contiguous set of bars, and its height is bounded by the SHORTEST bar in that span."

Then a few quick clarifying questions:
• Heights are non-negative integers, right? Can any be zero?
• Bars all have width 1?
• Bounds — n up to 10^5? That rules out O(n²).
• Return value — just the area integer, not the rectangle's position?

**Why this matters** — *The 'bounded by the shortest bar' detail is the load-bearing one — that's the constraint that makes brute force O(n²) (for every pair `(i, j)`, you need to find the min height in `[i..j]`). Asking about zero-height bars matters because the algorithm handles zeros gracefully — they immediately drain the stack — and confirming this lets you use a 0 sentinel as a closing trick. Asking about n's bound signals you're already thinking about whether the natural O(n²) is acceptable; for n=10^5 it isn't, hence the stack.*

##### 2. Brute force first (out loud)

> Name the obvious O(n²) solution before you discard it.

**What I'd say** — "Two natural brute forces. First: for every pair `(i, j)` with `i <= j`, compute the min height in `[i..j]` and the area `(j - i + 1) * min`. That's O(n³) naively, or O(n²) if you track the running min as `j` extends. Second, equivalently: for every index `i`, find the leftmost `L` and rightmost `R` such that `heights[k] >= heights[i]` for all `k` in `[L..R]` — the area for bar `i` as the limiting height is `heights[i] * (R - L + 1)`. Computing L and R naively is O(n) per index → O(n²) total. The answer is the max over all i. Either way we're at O(n²); for n=10^5 that's 10^10 ops. Let me see if we can find L and R for every index in one pass."

**Why this matters** — *Two reasons to name the 'for each bar, find its left and right extent' brute force out loud. (1) It's NOT the obvious O(n²) — most candidates think first of 'try every pair'. The reframing to 'for each bar as the limiting height, find its extent' is the structural insight that the monotonic stack will accelerate. (2) It tees up section 3 perfectly: a monotonic stack computes those extents for free as a side effect of its push/pop discipline.*

##### 3. Spot the pattern

> What signal in the problem points to a monotonic stack?

**What I'd say** — "For each bar `i`, I need to find the nearest *smaller* bar to its left and the nearest smaller bar to its right — those two are L-1 and R+1, the boundaries of bar i's rectangle. 'Nearest smaller on each side for every index' is the textbook monotonic-stack signal. Specifically: I'll maintain a stack of indices whose heights are strictly INCREASING from bottom to top. As I scan left to right, whenever the new bar `h[i]` is shorter than the stack-top bar, I pop — and at that pop moment I know everything: the popped bar's right boundary is `i` (because the violator caused the pop), and its left boundary is the new stack-top (because anything between them was already popped earlier, which means everything between was taller). So `width = i - newStackTop - 1`, `area = poppedHeight * width`. Keep popping while the invariant is broken, then push i. At the end, any bars left on the stack haven't been resolved — so I append a 0 sentinel that forces a final drain."

**Why this matters** — *Naming the pattern *and* the structural invariant that makes it apply is the move. 'Use a stack' is a guess; 'monotonic increasing stack — when a shorter bar arrives, the popped bar's left/right extents are exactly knowable from stack positions' is a derivation. The sentinel-0 trick is also the load-bearing detail — without it, an all-increasing input like `[1, 2, 3]` would leave every bar on the stack and you'd compute zero rectangles. Naming the sentinel explicitly here means it's not a surprise when it appears in the code.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — the canonical mixed case, a single bar (sentinel-only drain), and a flat run (sentinel forces a wide rectangle).

**Worked examples**

- **Input:** `[2, 1, 5, 6, 2, 3]` → **Output:** `10`
  *Note:* Canonical case. The answer 10 = height 5 × width 2 — bars at indices 2 and 3 (heights 5 and 6) limited by 5.

  ```
  h = [2, 1, 5, 6, 2, 3, 0]   ← append sentinel
  stack=[] best=0
  i=0 h[i]=2 → push. stack=[0]
  i=1 h[i]=1 < h[0]=2 → pop 0. width = stack empty → i=1. area = 2*1 = 2. best=2. push 1. stack=[1]
  i=2 h[i]=5 > h[1]=1 → push. stack=[1, 2]
  i=3 h[i]=6 > h[2]=5 → push. stack=[1, 2, 3]
  i=4 h[i]=2 < h[3]=6 → pop 3. width = i-newTop-1 = 4-2-1 = 1. area = 6*1 = 6. best=6.
           2 < h[2]=5 → pop 2. width = 4-1-1 = 2. area = 5*2 = 10. best=10.
           2 > h[1]=1 → stop. push 4. stack=[1, 4]
  i=5 h[i]=3 > h[4]=2 → push. stack=[1, 4, 5]
  i=6 h[i]=0 < h[5]=3 → pop 5. width = 6-4-1 = 1. area = 3*1 = 3. (best stays 10)
           0 < h[4]=2 → pop 4. width = 6-1-1 = 4. area = 2*4 = 8. (best stays 10)
           0 < h[1]=1 → pop 1. width = stack empty → i=6. area = 1*6 = 6. (best stays 10)
           push 6. stack=[6]
  return 10
  ```
- **Input:** `[5]` → **Output:** `5`
  *Note:* Single bar — without the sentinel, nothing would ever pop. The sentinel 0 forces the drain at i=1.

  ```
  h = [5, 0]   ← append sentinel
  stack=[] best=0
  i=0 h[i]=5 → push. stack=[0]
  i=1 h[i]=0 < h[0]=5 → pop 0. width = stack empty → i=1. area = 5*1 = 5. best=5.
           push 1. stack=[1]
  return 5
  ```
- **Input:** `[3, 3, 3]` → **Output:** `9`
  *Note:* Flat run — strict `>` means equal heights don't pop, so all three indices accumulate. Sentinel drains them as a single 3-wide rectangle (last pop has empty stack → width = i = 3).

  ```
  h = [3, 3, 3, 0]   ← append sentinel
  stack=[] best=0
  i=0 h[i]=3 → push. stack=[0]
  i=1 h[i]=3 NOT > h[0]=3 (strict) → push. stack=[0, 1]
  i=2 h[i]=3 NOT > h[1]=3 → push. stack=[0, 1, 2]
  i=3 h[i]=0 < h[2]=3 → pop 2. width = 3-1-1 = 1. area = 3*1 = 3. best=3.
           0 < h[1]=3 → pop 1. width = 3-0-1 = 2. area = 3*2 = 6. best=6.
           0 < h[0]=3 → pop 0. width = stack empty → i=3. area = 3*3 = 9. best=9.
           push 3. stack=[3]
  return 9
  ```

**Why this matters** — *Tracing surfaces the three bugs this problem rewards. (1) The width formula — `i - newTop - 1` (NOT `i - top` and NOT `i - newTop`) — is the most common mistake; tracing through `[2, 1, 5, 6, 2, 3]` at i=4 shows exactly why we subtract one. (2) The empty-stack case — width = i, not i - 1 — is the other variant of the same bug, and the `[5]` case isolates it. (3) Forgetting the sentinel — without it, the `[3, 3, 3]` case would return 0 (everything left on the stack, never measured); tracing it makes the necessity obvious. All three are exactly the bugs interviewers probe for.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty array → result 0 (no rectangles possible). The for-loop never runs; best stays 0. ✓
• Single bar [h] → area = h * 1 = h. The sentinel drains it. ✓ (Without the sentinel this would return 0 — silent bug.)
• All same height [3, 3, 3] → since the condition is strictly `>`, no pops fire during the main scan; sentinel drains everything at the end as one wide rectangle. Result h * n. ✓
• Strictly increasing [1, 2, 3, 4, 5] → no pops during the scan, sentinel triggers pops in reverse order. Each pop's width is the remaining span. ✓
• Strictly decreasing [5, 4, 3, 2, 1] → every step pops once (clean monotone violations), stack stays size 1 throughout. ✓
• A bar of height 0 in the middle, e.g. [3, 0, 3] → the 0 immediately drains the 3 to its left (and itself becomes a non-event since `area = 0 * anything = 0`); no rectangle spans across it because 0 limits everything. ✓
• Very large heights / very long arrays — JS numbers handle up to 2^53 safely; for n=10^5 and h up to 10^4, max area is 10^9 which is fine. No overflow concern unless we're in BigInt territory."

**Why this matters** — *Walking the [5] and the flat-run cases explicitly is what defends the sentinel — without it both would return 0 silently, and they're the two cases the interviewer is most likely to throw at you to test edge handling. The 0-bar-in-the-middle case is a nice senior-touch — most candidates don't think about it because the algorithm handles it naturally (0 acts like a soft sentinel mid-array), but explaining WHY it works smoothly shows you understand the invariant.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — same amortization argument as every monotonic-stack problem. Each index is pushed onto the stack exactly once and popped from the stack at most once. So the total work of the inner `while` across the entire outer loop is bounded by n. Outer loop is n+1 iterations (n bars plus the sentinel), inner work is amortized O(1) per iteration, total O(n).

Space is O(n) — worst case strictly-increasing input fills the stack with all n indices before the sentinel drains them.

The sentinel is purely an implementation convenience — an equivalent solution puts an `after-loop` drain block that pops the remaining stack with `width = n - newTop - 1` (or n if empty). I prefer the sentinel because it eliminates a duplicate code path and keeps the loop body the sole place where area is computed.

This template extends directly to Maximal Rectangle in a binary matrix — for each row, build a histogram of consecutive 1s ending at that row, then run Largest Rectangle on it; total O(rows × cols). Same monotonic-stack core, layered over a row-wise histogram build."

**Why this matters** — *The amortized-analysis argument is what wins the pushback from an interviewer who sees the nested `while` and challenges 'isn't that O(n²)?'. Naming the sentinel as 'an implementation convenience' acknowledges that the after-loop drain works equally well — this matters because an interviewer who learned it the other way might ask 'why the sentinel?' and you want to show you chose it deliberately, not because it was the only way. The Maximal Rectangle extension is unprompted bonus material that proves you see this not as a one-off trick but as the engine that powers a whole class of 2D problems.*

---

### Afternoon — Binary Search + Linked List *(~3 hr)*

#### Search Rotated Array

*Binary Search* · `p-rotated` — Binary search on a rotated sorted array. At each step one half is sorted — check if target lies inside. O(log n).

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: I'm given an array that was sorted ascending, then rotated at some unknown pivot, and I need to return the index of `target` in O(log n) — or `-1` if it's not there. Quick clarifying questions:"

• Are values guaranteed unique? (If duplicates are allowed, the algorithm degrades to O(n) worst case — that's a different problem.)
• Can the rotation be by 0 (i.e. the array is still in original order)?
• Empty input — return `-1`?
• Output is the index, not the value, correct?

**Why this matters** — *The unique-values question is the load-bearing one. With duplicates, the `nums[l] <= nums[m]` check becomes ambiguous (`[1,1,1,1,1,2,1]` — both halves look sorted), and you'd have to fall back to incrementing `l` past the ambiguity, breaking the log-n bound. Confirming uniqueness up front lets you commit to the standard template. The rotation-by-zero question matters too — the canonical needs to handle that as the degenerate case where the 'left half is sorted' branch covers the whole array.*

##### 2. Brute force first (out loud)

> Name the obvious O(n) solutions before you discard them.

**What I'd say** — "Two brute forces, both O(n). One: a linear scan — return `i` when `nums[i] === target`. Doesn't use the structure at all. Two: find the rotation pivot first (where `nums[i] > nums[i+1]`), then binary-search the appropriate half. That's two O(log n) passes plus an O(n) pivot scan — overall still O(n) because the pivot search is linear.

The interesting brute force is actually the second one done right — find the pivot in O(log n) too, then do a standard BS in the correct half. That's two binary searches glued together. But there's a one-pass version that does the same logic inside a single loop, and that's cleaner — let me build that."

**Why this matters** — *Walking through 'find pivot then BS' is the bridge from 'rotated' to 'one-pass.' It shows you considered the decomposed version — which is a legitimate solution — and chose the unified template because it's cleaner, not because you didn't see the alternative. That's an upgrade signal: the candidate who can name both and pick is stronger than the one who only knows the magic one-pass version.*

##### 3. Spot the pattern

> What invariant makes binary search still work after rotation?

**What I'd say** — "The key insight: even after rotation, at every iteration AT LEAST ONE of `[l..m]` or `[m..r]` is still sorted. The pivot can only land in one of the halves, not both. So I can:"

"(1) Identify which half is sorted — compare `nums[l]` to `nums[m]`. If `nums[l] <= nums[m]`, the LEFT half `[l..m]` is the sorted one."

"(2) Check whether target lies inside that sorted half's value range — that's a simple `nums[l] <= target < nums[m]` comparison."

"(3) If yes, recurse into the sorted half (standard BS). If no, target must be in the OTHER half (the rotated one), so recurse there. Either way I halve the range — O(log n)."

"The monotonicity that BS needs is still there, it's just locally true on whichever half is sorted, instead of globally true on the whole array."

**Why this matters** — *This is the entire problem in three sentences — and it's how you'd say it on the whiteboard. Naming the 'one half is always sorted' invariant explicitly is the move; without that, you're just guessing at branches. The monotonicity callback to plain BS is the synthesis: same template, the prerequisite is just satisfied differently (locally on one half instead of globally on the whole).*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace these to make sure the half-identification logic is right." Three cases — target on the wrap-around side, target on the original side, and a miss to confirm the loop terminates.

**Worked examples**

- **Input:** `nums=[4,5,6,7,0,1,2], target=0` → **Output:** `4`
  *Note:* Target is in the rotated portion — first step must walk past the sorted-left.

  ```
  l=0 r=6  m=3 nums[m]=7   nums[l]=4 <= 7 → LEFT [0..3] sorted (4,5,6,7)
           is target=0 in [4, 7)? no → search right: l = m+1 = 4
  l=4 r=6  m=5 nums[m]=1   nums[l]=0 <= 1 → LEFT [4..5] sorted (0,1)
           is target=0 in [0, 1)? yes → search left: r = m-1 = 4
  l=4 r=4  m=4 nums[m]=0   === 0 → return 4 ✓
  ```
- **Input:** `nums=[6,7,0,1,2,4,5], target=4` → **Output:** `5`
  *Note:* Target is in the sorted-right portion — exercises the right-half branch.

  ```
  l=0 r=6  m=3 nums[m]=1   nums[l]=6 > 1 → RIGHT [3..6] sorted (1,2,4,5)
           is target=4 in (1, 5]? yes → search right: l = m+1 = 4
  l=4 r=6  m=5 nums[m]=4   === 4 → return 5 ✓
  ```
- **Input:** `nums=[4,5,6,7,0,1,2], target=3` → **Output:** `-1`
  *Note:* Miss — confirms the loop exits cleanly via l > r.

  ```
  l=0 r=6  m=3 nums[m]=7   nums[l]=4 <= 7 → LEFT sorted (4,5,6,7)
           is target=3 in [4, 7)? no → search right: l = m+1 = 4
  l=4 r=6  m=5 nums[m]=1   nums[l]=0 <= 1 → LEFT sorted (0,1)
           is target=3 in [0, 1)? no → search right: l = m+1 = 6
  l=6 r=6  m=6 nums[m]=2   nums[l]=2 <= 2 → LEFT sorted (just [2])
           is target=3 in [2, 2)? no → search right: l = m+1 = 7
  l=7 r=6  → l > r, loop exits → return -1 ✓
  ```

**Why this matters** — *The first example is the one to narrate — it exposes the subtle bit, that target=0 lies in the rotated half, so the algorithm has to recognize 'sorted-left doesn't contain 0' and jump RIGHT, even though intuitively '0 is less than everything' might suggest going left. The boundary strictness in `nums[l] <= target && target < nums[m]` (note the `<` not `<=` on the right) is also worth flagging — `nums[m]` already failed the equality check at the top of the loop, so excluding it from the range avoids re-testing it.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Edges worth flagging:"

• Empty array → `r = -1`, loop never enters, return `-1`. ✓
• Single element → `l == r == m`, equality check fires or we return -1.
• No rotation (e.g. `[1,2,3,4,5]`) → `nums[l] <= nums[m]` is always true, so we always take the left-sorted branch. Falls back to plain BS. ✓
• Full rotation (rotated by length) → same as no rotation.
• `nums[l] == nums[m]` (with unique values, only possible when `l == m`) → the `<=` in the half-check handles it; without `=`, a 2-element subarray breaks.
• Duplicates allowed (different problem — Search Rotated II) → would need to `l++` past the ambiguous prefix, degrading to O(n) worst case. Worth flagging that you'd ask before assuming unique.
• Integer overflow on `(l + r) / 2` → JS is safe (Number is 64-bit float), but in a typed language I'd write `l + ((r - l) >> 1)`.

**Why this matters** — *The no-rotation edge is the one to mention out loud — it's the test case that proves the template degrades gracefully to plain BS. The duplicates flag is the senior-tier touch: most candidates don't realize the algorithm assumes uniqueness, and interviewers either nod or follow up with 'how would you handle duplicates?' — either response is good. The `nums[l] == nums[m]` callout is what justifies the `<=` (not `<`) in the half-check, which is a real bug in 2-element subarrays if you get it wrong.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(log n) — each iteration halves the search range, same as plain BS. The extra work per step (deciding which half is sorted, then which half to search) is O(1), so the asymptotic bound is unchanged.

Space is O(1) — same three pointers, no extra structure, iterative loop.

The defense against pushback is straightforward: 'I'm halving the range every step; the only new work is constant per step.' The hard part isn't the complexity proof — it's convincing the interviewer the BRANCHING is correct, which is what the trace above does.

If you wanted to extend: Find Minimum in Rotated Sorted Array uses the same family — it's the same setup but you anchor to `nums[r]` instead of `nums[l]`, and you converge to the pivot itself instead of a target. And if duplicates were allowed, Search Rotated II keeps the same skeleton but adds an `l++` fallback to skip past ambiguity, accepting O(n) worst case."

**Why this matters** — *The 'same complexity, harder correctness argument' framing is exactly what makes this problem interview-classic: the asymptotic story is easy, but the branch logic is where you live or die. Naming Find Minimum and Search Rotated II unprompted is the bonus that proves you see the rotated-BS family as a template — three related problems, one skeleton, three different convergence/anchor choices.*

---

#### Koko Eating Bananas

*Binary Search* · `p-koko-bananas` — Binary search the ANSWER on [1, max(piles)]: find the minimum k such that `canFinish(k)` is true.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me restate: Koko has `piles` of bananas and `h` hours. She picks one eating speed `k` (bananas per hour) at the start and uses it for every hour. Each hour she eats from one pile — if the pile has fewer than `k` bananas left, she eats those and stops for that hour (she doesn't move on to another pile). I need the minimum integer `k` such that she finishes all piles within `h` hours."

"Clarifying questions:"

• Is `h >= piles.length` guaranteed? (If not, there's no feasible `k` — every pile takes at least one hour even at infinite speed.)
• Are pile values bounded? That'll set the upper search bound.
• `k` must be a positive integer, correct? (Not fractional.)
• If multiple `k` values tie at exactly `h` hours, return the smallest, right?

**Why this matters** — *The `h >= piles.length` precondition is the one that quietly makes the problem solvable — it's worth confirming because it's also why the upper bound on `k` is `max(piles)` (any faster and a pile still takes exactly 1 hour). The integer-k clarification matters because it tells you you're searching over `[1, max(piles)]`, not a real interval — that determines whether BS-on-the-answer is even the right family.*

##### 2. Brute force first (out loud)

> Name the obvious O(n * max(piles)) solution before you discard it.

**What I'd say** — "The brute force is: try every speed from 1 upward. For each `k`, compute total hours as `sum(ceil(p / k) for p in piles)`. Return the first `k` where the total is `<= h`. That's O(n * max(piles)) — for each of up to `max(piles)` candidate speeds we do an O(n) feasibility check. With piles up to 10⁹, that's untenable."

"But notice the structure of what I'm doing: I'm scanning the answer space `[1, max(piles)]` looking for the smallest `k` that satisfies a predicate. If that predicate has the right shape, I can binary-search the answer space and skip from O(max(piles)) to O(log max(piles)) on the outer loop."

**Why this matters** — *This brute force is the bridge — it has to be stated as 'scanning the *answer space*' rather than 'scanning the *array*,' because that's the conceptual leap. Once you frame it as 'I'm searching for an integer that satisfies a monotone predicate,' BS-on-the-answer feels inevitable rather than magic. The phrasing matters: candidates who say 'use binary search' without saying 'on what' fail to communicate the actual insight.*

##### 3. Spot the pattern

> What property of the predicate unlocks binary search on the answer?

**What I'd say** — "This is binary-search-on-the-answer — also called parametric binary search. The trigger: I'm looking for the minimum value of a parameter `k` such that a feasibility function `canFinish(k)` returns true. BS applies because the predicate is **monotone in k** — if Koko can finish at speed `k`, she can also finish at any speed `k' > k` (faster never hurts). So the sequence `canFinish(1), canFinish(2), ..., canFinish(max(piles))` is a string of `false`s followed by a string of `true`s. That's the exact shape BS converges on — find the boundary."

"The monotonicity is the prerequisite, just like 'sorted array' is for plain BS. The 'array' here is the implicit one indexed by k, and 'sorted' is the predicate's monotonicity. Same skeleton, just the search space is conceptual."

"Template choice: half-open `while (l < r)` with `r = m` on success and `l = m + 1` on failure — converges to the leftmost true, which is exactly the minimum feasible `k`."

**Why this matters** — *Naming the monotonicity explicitly is the entire derivation — without it, 'binary search on the answer' is a memorized trick instead of a principled application. The 'sorted array → monotone predicate' analogy is the one that generalizes to every parametric-BS problem (Capacity to Ship, Split Array Largest Sum, Aggressive Cows), so it's worth saying out loud — it's the transferable insight, not a problem-specific trick.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace these to make sure the feasibility function and the convergence are both right." Three cases — a standard mid-range answer, a case where the answer is large (forces the upper end of the range), and a degenerate all-ones case.

**Worked examples**

- **Input:** `piles=[3,6,7,11], h=8` → **Output:** `4`
  *Note:* Standard case — answer sits in the middle of the range.

  ```
  lo=1 hi=11
  m=6 canFinish(6): ceil(3/6)+ceil(6/6)+ceil(7/6)+ceil(11/6) = 1+1+2+2 = 6 <= 8 ✓ → hi = 6
  lo=1 hi=6
  m=3 canFinish(3): 1+2+3+4 = 10 > 8 ✗ → lo = 4
  lo=4 hi=6
  m=5 canFinish(5): 1+2+2+3 = 8 <= 8 ✓ → hi = 5
  lo=4 hi=5
  m=4 canFinish(4): 1+2+2+3 = 8 <= 8 ✓ → hi = 4
  lo=4 hi=4 → converged → return 4 ✓
  ```
- **Input:** `piles=[30,11,23,4,20], h=6` → **Output:** `23`
  *Note:* Tight schedule — h equals piles.length+1, so the answer is forced high.

  ```
  lo=1 hi=30
  m=15 canFinish(15): 2+1+2+1+2 = 8 > 6 ✗ → lo = 16
  lo=16 hi=30
  m=23 canFinish(23): 2+1+1+1+1 = 6 <= 6 ✓ → hi = 23
  lo=16 hi=23
  m=19 canFinish(19): 2+1+2+1+2 = 8 > 6 ✗ → lo = 20
  lo=20 hi=23
  m=21 canFinish(21): 2+1+2+1+1 = 7 > 6 ✗ → lo = 22
  lo=22 hi=23
  m=22 canFinish(22): 2+1+2+1+1 = 7 > 6 ✗ → lo = 23
  lo=23 hi=23 → converged → return 23 ✓
  ```
- **Input:** `piles=[1,1,1,1], h=4` → **Output:** `1`
  *Note:* Degenerate — answer is the lower bound of the range.

  ```
  lo=1 hi=1 → loop never enters (lo < hi is false) → return 1 ✓
  ```

**Why this matters** — *The first trace exposes the subtlety: `canFinish(5)` returns true and we set `hi = 5`, then `canFinish(4)` ALSO returns true and we set `hi = 4`. The half-open template keeps pulling `hi` down to find the leftmost true, even when the predicate keeps succeeding. The third trace defends the loop condition — with `[1,1,1,1]` the answer is 1, and `while (l < r)` correctly skips the loop and returns the initial `l`. With `while (l <= r)` the loop would enter, compute `m = 1`, do unnecessary work, and could infinite-loop without careful bounds. The convergence pattern (`hi = m` on success, `lo = m + 1` on failure) is the one to memorize for leftmost-true.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Edges worth flagging:"

• `h == piles.length` → minimum feasible `k` is `max(piles)` (one pile per hour at the slowest speed that still finishes the biggest pile in one hour).
• `h` very large (>> sum of piles) → answer is 1 (eat one banana per hour, never miss).
• Single huge pile (e.g. `piles=[10⁹], h=2`) → answer is `⌈10⁹/2⌉ = 500000000`. The upper bound `max(piles)=10⁹` is essential — without it the search space is wrong.
• Integer-division vs ceiling — must use `Math.ceil`, not `Math.floor`. A pile of 7 bananas at speed 3 takes 3 hours (not 2), because the last hour she only eats 1 banana but the hour is still consumed.
• Empty piles → not possible by problem constraints, but defensively `Math.max(...[])` returns `-Infinity`, so a guard might be warranted.
• `(l + r) / 2` overflow → safe in JS (Number is 64-bit float), but in C++/Java I'd write `l + ((r - l) >> 1)`.

**Why this matters** — *The single-huge-pile edge is the one to mention — it justifies why the upper bound is `max(piles)`, not `sum(piles)` (a common wrong guess). The ceiling-vs-floor edge is the load-bearing semantic bug; getting it wrong silently passes some tests and fails others, which is exactly the kind of mistake that's painful to debug in an interview. The overflow flag is the senior-tier touch.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n log M) where `M = max(piles)`. The outer binary search runs O(log M) iterations, and each one calls `canFinish` which is O(n) (sum a `ceil` per pile). So O(n log M) total.

Space is O(1) — just the pointers and the loop locals, no auxiliary structure.

The defense against pushback like 'but you have an O(n) function inside an O(log M) loop, isn't that just O(n * M)?' is: the OUTER loop runs `log M` times, not `M` times, because of the halving — each iteration kills half the candidate-speed range. So `log M` outer × `n` inner = `n log M`, much smaller than `n * M`.

If you wanted to extend: same template fits Capacity To Ship Packages Within D Days (search the answer space of ship capacities, predicate is 'does this capacity finish in <= D days'), Split Array Largest Sum (search the answer space of max-subarray-sum, predicate is 'can I split into <= K subarrays each with sum <= this?'), and Aggressive Cows (search the answer space of minimum gap, predicate is 'can I place K cows with gap >= this?'). All same skeleton: monotone predicate → BS the answer."

**Why this matters** — *The 'log M not M' clarification is the exact pushback interviewers throw because the loop syntax LOOKS like a linear scan over candidate speeds. Articulating that the outer loop is BS, not iteration, is what defends the bound. Naming the family of problems unprompted is the bonus — Capacity To Ship, Split Array Largest Sum, Aggressive Cows are all the same template, and showing you see them as a family is what proves you can apply this in a new problem you haven't memorized.*

---

#### Reverse Linked List

*Linked List* · `p-reverse-list` — Walk the list once; at each node rewrite next to point at the previous node. Three pointers: prev, curr, next.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: I'm given the head of a singly linked list and I need to reverse it in place, returning the new head. So [1,2,3,4,5] becomes [5,4,3,2,1] — same nodes, same values, but the next pointers all flip."

Then a few quick clarifying questions:
• Mutation — am I allowed to rewrite the existing `next` pointers, or do I need to allocate new nodes?
• Empty list — head is null. Return null?
• Single node — return the same node (its next is already null)?
• Iterative or recursive — any preference? (Iterative is O(1) space; recursive is O(n) stack.)

**Why this matters** — *The mutation question is the load-bearing one. If they want immutability, this becomes a different problem — you'd allocate a new list, which is O(n) extra space. If they're fine with in-place mutation (the standard answer), the iterative three-pointer dance is O(1) space. The empty/single-node questions surface that your loop should handle them without special cases — and they will, if you set `prev = null` at the start.*

##### 2. Brute force first (out loud)

> Name the obvious O(n) extra-space solution before you discard it.

**What I'd say** — "The brute force is: walk the list and push every value into an array, then walk a second time and overwrite each node's `val` from the array in reverse — or build a brand new list from `arr.reverse()`. Either way it's O(n) time and O(n) extra space. Functionally correct, but if I'm allowed to mutate next pointers I can do it in one pass with O(1) extra space — same comparisons, just rewriting the existing pointers instead of allocating an array."

**Why this matters** — *Two reasons to name the array-buffer brute force out loud. (1) It proves you can see the obvious answer before reaching for the clever one — interviewers worry about candidates who pattern-match straight to the three-pointer dance without acknowledging why it's better. (2) It frames the iterative solution as 'same outcome, just no buffer' rather than a wholly different algorithm — which is what makes the pointer dance feel motivated rather than magical.*

##### 3. Spot the pattern

> What signal in the problem points to the three-pointer dance?

**What I'd say** — "Reversing a singly linked list is the canonical 'pointer-dance' problem — you can't walk backward (no prev pointer in the node), so you have to flip each `next` as you pass through, but the moment you flip `curr.next = prev` you've lost the rest of the list. The fix is to cache `next` BEFORE the rewrite. That gives you the three-pointer template: `prev` (what comes before, starts null), `curr` (where I am now), and a local `next` cached each iteration. Initialize `prev = null` because the original head becomes the new tail with `next = null`. Return `prev` at the end, not `curr` — when the loop exits, `curr` is null and `prev` points to what was the old tail."

**Why this matters** — *Naming the pattern *and* the structural reason makes it land. 'Three-pointer dance' alone is jargon; 'three pointers because flipping curr.next destroys the forward link, so you must cache next first' is a derivation. Interviewers grade on the second. Calling out 'return prev, not curr' upfront also short-circuits the most common off-by-one — most candidates write the loop right and then return the wrong thing.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — a typical multi-node reversal, the empty case where the loop never runs, and the single-node case where the loop runs exactly once.

**Worked examples**

- **Input:** `[1, 2, 3, 4, 5]` → **Output:** `[5, 4, 3, 2, 1]`
  *Note:* Classic case — five iterations of the pointer dance, prev walks from null to 5.

  ```
  init: prev=null, curr=1
  iter1: next=2, 1.next=null, prev=1, curr=2  → reversedSoFar=[1]
  iter2: next=3, 2.next=1, prev=2, curr=3     → reversedSoFar=[2,1]
  iter3: next=4, 3.next=2, prev=3, curr=4     → reversedSoFar=[3,2,1]
  iter4: next=5, 4.next=3, prev=4, curr=5     → reversedSoFar=[4,3,2,1]
  iter5: next=null, 5.next=4, prev=5, curr=null → reversedSoFar=[5,4,3,2,1]
  loop exits (curr=null), return prev=5
  ```
- **Input:** `[]` → **Output:** `[]`
  *Note:* Empty list — head is null, loop never executes, prev stays null, return null. No special case needed.

  ```
  init: prev=null, curr=null
  loop check: curr is null → never enter
  return prev=null
  ```
- **Input:** `[42]` → **Output:** `[42]`
  *Note:* Single node — one iteration writes 42.next=null (it already was), then curr becomes null. Same code, no special case.

  ```
  init: prev=null, curr=42
  iter1: next=null, 42.next=null, prev=42, curr=null
  loop exits, return prev=42
  ```

**Why this matters** — *Tracing surfaces the two off-by-ones this problem rewards. (1) The empty-list trace confirms that initializing `prev = null` and looping on `curr` (not `head`) handles the zero-node case without an `if`. (2) The single-node trace confirms you return `prev`, not `curr` — at loop exit `curr` is always null, so returning `curr` would always give you back null. Writing the trace out before the code is much less painful than catching either bug after the interviewer points at failing tests.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty list (head = null) → loop never runs, prev stays null, return null. ✓
• Single node → one iteration sets the (already null) next, then curr becomes null, return that node. ✓
• Two nodes → tests the rewrite specifically — 1→2 becomes 2→1, easy to mess up if you forget to cache next.
• Long list (10k+ nodes) → O(n) time, O(1) space; the recursive version would blow the stack here, which is one reason to prefer iterative.
• Cycle in the input (e.g. 1→2→3→1) → the loop never terminates. Worth flagging that this function assumes acyclic input; with a cycle you'd need Floyd's detection first."

**Why this matters** — *The empty and single-node cases both work for the *same* structural reason — `prev = null` is the correct initial value and the loop condition checks `curr`, not `head` — and naming that connection shows you understand the invariant rather than memorizing pass/fail per case. The cycle call-out is the senior move; most candidates assume acyclic input silently, and the interviewer either nods (impressed) or says 'good catch but assume acyclic for now'. Either outcome is good.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — each node is visited exactly once. The body of the loop is a fixed number of pointer assignments (three), so no amortization argument is needed.

Space is O(1) — three local pointers (`prev`, `curr`, `next`) regardless of list length. The recursive version is O(n) stack space because every call frame holds onto a node, so for large lists iterative is the right call.

If you wanted to extend to 'reverse only nodes between positions m and n', it's the same three-pointer dance bounded by a counter — walk to position m-1, then run the reverse loop n-m+1 times, then splice the reversed segment back in. Same template, just bracketed. And if you wanted to 'reverse in groups of k' (LeetCode 25), it's the same dance run k nodes at a time with a per-group splice."

**Why this matters** — *The fixed-work-per-node argument is the clean defense — there's no nested loop here so amortization isn't the issue, but interviewers do sometimes ask 'why isn't this O(n²)?' and the answer is just 'every operation in the body is O(1)'. The 'reverse between m and n' and 'reverse k-group' extensions prove you see the three-pointer dance as a reusable primitive rather than this one problem's trick — that's exactly how it shows up in Reverse Nodes in k-Group, Reverse Linked List II, and as a subroutine inside Reorder List and Palindrome Linked List.*

---

#### Detect Cycle

*Linked List* · `p-cycle` — Floyd tortoise-and-hare: two pointers move at 1x and 2x speed. If they ever meet, there is a cycle. O(n) time, O(1) space.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: I'm given the head of a singly linked list and I need to return true if any node's `next` pointer creates a cycle back to an earlier node, false otherwise. So the list is either acyclic and ends in null, or it loops back somewhere — possibly at the head (full loop) or deeper in the list (lollipop shape)."

Then a few quick clarifying questions:
• Empty list — return false (no nodes, no cycle)?
• Single node with `next = null` → false; single node pointing at itself → true. Both possible?
• Can I mutate the input (mark nodes as visited)? Or do I need to leave it untouched?
• Memory budget — is O(n) extra space fine, or do you want O(1)?

**Why this matters** — *The mutation and memory questions point at the answer. If you can mutate, you could mark visited nodes with a flag — O(n) time, O(1) extra space but destructive. If you can use O(n) extra space, a Set of visited nodes is the obvious answer. If neither is allowed — leave nodes untouched, O(1) space — you're forced into Floyd's tortoise-and-hare, which is the canonical answer interviewers are usually fishing for. Asking surfaces all three solutions cleanly.*

##### 2. Brute force first (out loud)

> Name the obvious O(n) extra-space solution before you discard it.

**What I'd say** — "The obvious solution is a hash Set: walk the list, and at each node check if I've seen it before. If I have, return true. If I hit null, return false. That's O(n) time but O(n) extra space because the Set can hold up to n nodes. Functionally correct, but I think we can do it in O(1) space — same correctness, but with two pointers instead of a Set."

**Why this matters** — *Two reasons to name the Set version out loud. (1) It proves you can solve the problem without the trick — interviewers worry about candidates who only know Floyd's and can't reason from first principles. (2) It frames Floyd's as 'same correctness guarantee, less memory' rather than a wholly different idea — which justifies the cleverness instead of just deploying it. The interviewer might even say 'Set is fine, ship it,' in which case you've saved time.*

##### 3. Spot the pattern

> What signal in the problem points to Floyd's tortoise-and-hare?

**What I'd say** — "This is the canonical fast-and-slow pointer problem. The insight is: if there's a cycle, a pointer moving at 2x speed eventually laps a pointer moving at 1x speed inside that cycle — they MUST meet, because the gap between them closes by 1 node per iteration once they're both inside the loop. If there's no cycle, the fast pointer hits null first (specifically, `fast` or `fast.next` becomes null) and we exit. Two pointers moving at the SAME speed wouldn't work — they'd maintain a fixed gap forever. The 2-to-1 step ratio is what guarantees they collide inside any cycle.

Two things to be careful about: the loop guard checks BOTH `fast` AND `fast.next` because fast does a double-hop and both `.next` accesses have to be legal. And the meeting check uses `===` (reference equality on the node object), not `slow.val === fast.val` — different nodes can hold the same value."

**Why this matters** — *Naming the pattern *and* the mathematical reason it works is the move. 'Floyd's tortoise-and-hare' alone is just terminology; 'they collide because the 2-to-1 step ratio means the gap closes by 1 each iteration once both are in the loop' is a derivation. Calling out the `===` vs `.val` distinction upfront also short-circuits the most common bug — values can repeat across distinct nodes, so value equality would give false positives.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure the model is right." Three inputs cover the interesting behaviors — a small cycle at the head, an acyclic list where fast hits null, and a 2-node self-loop to confirm the smallest possible cycle works.

**Worked examples**

- **Input:** `1 → 2 → 3 → 1 (cycle at index 0)` → **Output:** `true`
  *Note:* Classic cycle — fast laps slow on the second pass.

  ```
  init: slow=node#0(1), fast=node#0(1)
  iter1: slow=node#1(2), fast=node#2(3). slow !== fast.
  iter2: slow=node#2(3), fast=node#1(2). slow !== fast. (fast wrapped: 3→1→2)
  iter3: slow=node#0(1), fast=node#0(1). slow === fast → return true.
  ```
- **Input:** `1 → 2 → 3 → 4 → 5 → null (no cycle)` → **Output:** `false`
  *Note:* Acyclic — fast hits the end first. Loop guard catches `fast.next === null` and exits.

  ```
  init: slow=node#0(1), fast=node#0(1)
  iter1: slow=node#1(2), fast=node#2(3). slow !== fast.
  iter2: slow=node#2(3), fast=node#4(5). slow !== fast.
  loop guard: fast=node#4(5), fast.next=null → false. Exit loop.
  return false.
  ```
- **Input:** `1 → 2 → 1 (smallest non-trivial cycle)` → **Output:** `true`
  *Note:* Smallest cycle — fast laps slow in one iteration.

  ```
  init: slow=node#0(1), fast=node#0(1)
  iter1: slow=node#1(2), fast=node#1(2). (fast: 1→2→1→2, lands on 2.) slow === fast → return true.
  ```

**Why this matters** — *Tracing surfaces two bugs this problem rewards. (1) The acyclic case confirms the loop guard `fast && fast.next` is the right condition — if you only checked `fast`, the `fast.next.next` would throw on a single-step-from-null. (2) The 1→2→1 trace confirms that fast can land on the same node as slow in a single iteration when the cycle is small enough; without tracing, candidates sometimes think the meeting only happens after multiple wraps and get confused when it fires immediately. Worth verifying on the whiteboard before the interviewer points to a test case where slow and fast collide in iter 1.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty list (head = null) → loop guard `fast && fast.next` is false immediately, return false. ✓
• Single node, no cycle (head.next = null) → loop guard `fast.next` is false, return false. ✓
• Single node, self-loop (head.next = head) → first iteration: slow = head.next = head, fast = head.next.next = head. slow === fast, return true. ✓
• Cycle at head (full loop, like 1→2→3→1) → handled — fast laps slow inside the cycle eventually.
• Cycle deep in the list (lollipop, like 1→2→3→4→3) → also handled — slow walks the straight part first, then both end up in the cycle and fast catches up.
• Very large list → O(n) time, O(1) space; no risk of memory blow-up.
• Worth noting: this returns *whether* a cycle exists, not *where* it starts. The 'find the cycle's entry node' variant (LeetCode 142) is a follow-up that reuses the same meeting point with a clever second-pass trick."

**Why this matters** — *The self-loop edge is the one most candidates miss — they assume cycles have at least two distinct nodes. Walking through it on the whiteboard confirms the algorithm handles it without a special case. The lollipop case is also worth naming because it disproves a common misconception that 'fast and slow have to start at the cycle entry to collide' — they don't; fast catches up regardless. Flagging the LeetCode 142 follow-up unprompted shows you see the cycle-detection family, not just this one problem.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — the gap between slow and fast closes by 1 node per iteration once both are in the cycle, so they meet within at most C iterations where C is the cycle length. Before the cycle, slow walks at most n nodes to reach it. Total: bounded by 2n iterations, so O(n). For the acyclic case, fast hits null in at most n/2 iterations, also O(n).

Space is O(1) — two pointer variables, no auxiliary structure. This is what beats the hash-Set version.

If you wanted to extend to 'find the cycle's starting node' (LeetCode 142), it's the same two-pointer setup with a clever second phase: after slow and fast meet, reset one pointer to head and advance both at 1x — they meet again at the cycle entry. The math is from Floyd's full algorithm: distance from head to cycle entry equals distance from meeting point to cycle entry going forward. Same template, one extra walk."

**Why this matters** — *The amortized 2n bound is the right defense against an interviewer who pushes back with 'but slow and fast are both walking — isn't that more than n?'. The answer is that the gap closes by 1 per iteration, so even with the 2x speed difference, fast traverses at most 2n nodes total. The LeetCode 142 extension is the natural next problem and proves you see the slow/fast template as a family rather than a one-off — that's how it shows up in Find Duplicate Number, Linked List Cycle II, and Happy Number.*

---

#### Merge Two Sorted Lists

*Linked List* · `p-merge-two-sorted` — Splice two sorted lists into one sorted list using a dummy head and a tail pointer. Iterative, O(1) extra space beyond the dummy.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: I'm given the heads of two singly linked lists, each already sorted in ascending order, and I need to return the head of a single merged list that's also sorted. The intent is to splice the existing nodes together rather than allocate new ones — so I'll be rewriting `next` pointers in place."

Then a few quick clarifying questions:
• Either list empty — return the other one as-is?
• Both empty — return null?
• Mutation OK — can I rewire the existing nodes' `next`, or do I need fresh nodes?
• Duplicate values across the two lists — both should appear in the output (stable)?
• Sort order — confirming ascending? (If descending, the comparator flips.)

**Why this matters** — *The mutation question matters for space — splicing existing nodes is O(1) extra; allocating new nodes is O(n+m). The duplicate-handling question signals you've thought about stability: if [1,2,4] and [1,3,4] both contain 1 and 4, the output is [1,1,2,3,4,4] not [1,2,3,4]. And asking 'are both empty' surfaces the cleanest invariant — your loop should produce null naturally without an upfront `if`.*

##### 2. Brute force first (out loud)

> Name the obvious copy-and-sort solution before you discard it.

**What I'd say** — "The brute force is: walk both lists, push every value into an array, sort it, then build a fresh linked list from the sorted array. That's O((n+m) log (n+m)) time and O(n+m) extra space. Functionally correct, but it throws away the precondition — the two lists are ALREADY sorted, so we shouldn't need a sort. The right structure is a merge step from mergesort: walk both heads in parallel, splice whichever is smaller, advance that pointer. O(n+m) time, O(1) extra space if we splice in place."

**Why this matters** — *Two reasons to name copy-and-sort out loud. (1) It proves you can see the obvious answer before reaching for the merge — important because the merge isn't obvious if you've never seen mergesort. (2) Stating 'we shouldn't need to sort because the inputs are already sorted' frames the merge as exploiting the precondition, which is exactly the right intuition for why merge runs in linear time instead of n log n.*

##### 3. Spot the pattern

> What signal in the problem points to the dummy-head splice pattern?

**What I'd say** — "This is the canonical dummy-head pattern. Whenever I'm building a linked list incrementally — appending nodes one at a time — I want a dummy sentinel at the front so the first append works the same as every subsequent append. Without a dummy, the first node is special: I'd have to write 'if head is null, head = newNode; else tail.next = newNode' on every iteration. With a dummy, I always do `tail.next = newNode; tail = tail.next`, and return `dummy.next` at the end. The sentinel exists only to absorb that first-append asymmetry.

The loop itself is a two-pointer walk on the inputs (a and b) and a one-pointer build on the output (tail). I compare `a.val <= b.val` — using `<=` rather than `<` for stability so equal values from `a` go in first — splice the winner, advance that input pointer, advance tail. When one list runs out, the other is already sorted, so I just attach the survivor with `tail.next = a || b` and we're done."

**Why this matters** — *Naming the dummy-head pattern *and* what it buys you ('first append is no longer a special case') is the move. 'Use a dummy' alone is a recipe; explaining why — to eliminate the head/tail asymmetry — shows you understand when to reach for the pattern in OTHER problems where you're building a linked list incrementally (Add Two Numbers, Reverse Between m and n, basically every linked-list constructor). The stability argument with `<=` is the small detail that separates careful candidates from sloppy ones.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure the model is right." Three inputs cover the interesting behaviors — a balanced merge with a duplicate, an empty-list edge, and an asymmetric merge where one list ends much earlier than the other.

**Worked examples**

- **Input:** `a=[1,2,4], b=[1,3,4]` → **Output:** `[1,1,2,3,4,4]`
  *Note:* Classic merge with duplicates — the `<=` comparator keeps a's 1 before b's 1 (stable).

  ```
  init: dummy→null, tail=dummy
  iter1: 1 <= 1 → splice a(1), a=[2,4]. tail=1.   merged=[1]
  iter2: 2 > 1 → splice b(1), b=[3,4]. tail=1.    merged=[1,1]
  iter3: 2 <= 3 → splice a(2), a=[4]. tail=2.    merged=[1,1,2]
  iter4: 4 > 3 → splice b(3), b=[4]. tail=3.     merged=[1,1,2,3]
  iter5: 4 <= 4 → splice a(4), a=null. tail=4.   merged=[1,1,2,3,4]
  loop exits (a is null). Attach b=[4] → merged=[1,1,2,3,4,4]
  return dummy.next = node(1)
  ```
- **Input:** `a=[], b=[0]` → **Output:** `[0]`
  *Note:* Empty list — loop never executes; `tail.next = a || b` attaches b directly.

  ```
  init: dummy→null, tail=dummy
  loop check: a is null → never enter
  Attach: tail.next = a || b = b = [0]. merged=[0]
  return dummy.next = node(0)
  ```
- **Input:** `a=[1,5], b=[2,3,4]` → **Output:** `[1,2,3,4,5]`
  *Note:* Asymmetric — b empties first, then the rest of a (just node 5) attaches in one move.

  ```
  init: dummy→null, tail=dummy
  iter1: 1 <= 2 → splice a(1), a=[5]. tail=1.   merged=[1]
  iter2: 5 > 2 → splice b(2), b=[3,4]. tail=2.  merged=[1,2]
  iter3: 5 > 3 → splice b(3), b=[4]. tail=3.    merged=[1,2,3]
  iter4: 5 > 4 → splice b(4), b=null. tail=4.   merged=[1,2,3,4]
  loop exits (b is null). Attach a=[5] → merged=[1,2,3,4,5]
  return dummy.next = node(1)
  ```

**Why this matters** — *Tracing surfaces the two bugs this problem rewards. (1) The `<=` vs `<` choice is invisible until you trace two equal values — `<=` keeps a's value first (stable); `<` would still merge correctly but with reversed order at ties, which fails the stability requirement that some interview variants care about. (2) The empty-list and asymmetric traces both confirm that `tail.next = a || b` is the one-liner that handles 'one list still has nodes' for free — no extra loop needed because the survivor is already a fully-formed sorted list.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Both lists empty (a=null, b=null) → loop never runs, `tail.next = null || null = null`, return dummy.next = null. ✓
• One list empty → loop never runs, the survivor attaches in one move. ✓
• All values in a smaller than all in b (e.g. a=[1,2,3], b=[4,5,6]) → loop drains a completely, then b attaches as-is.
• Identical lists (a=b in values) → the `<=` comparator interleaves them: a₁, b₁, a₂, b₂, …
• Lists with a single node each → one iteration of the loop, then one survivor attach. Tests the dummy-head plumbing.
• Very long lists (millions of nodes) → O(n+m) time, O(1) space; no risk of recursion stack overflow because this is iterative."

**Why this matters** — *Walking the both-empty and one-empty cases shows the algorithm degrades gracefully — no `if (!a || !b)` short-circuit needed. The 'all values in a smaller' case is worth naming because it exercises the survivor-attach path heavily; if you had a bug where you forgot to attach the leftover, that case would silently truncate. The iterative-vs-recursive call-out also flags that you've thought about real-world stack limits, which matters for production code.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n + m) — each node from either list is examined and spliced exactly once. The body of the loop does a fixed amount of pointer work, so no amortization argument is needed.

Space is O(1) — one dummy node, one tail pointer, no auxiliary structures. We're rewiring the existing nodes, not allocating new ones.

If you wanted to extend to 'merge k sorted lists', the natural approach is to apply this exact `mergeTwo` k-1 times pairwise — but that's O(n*k). The better approach is divide-and-conquer pairwise (merge in pairs, then pairs of pairs) which gets to O(n log k), or a min-heap of size k for the same bound. Same merge-two primitive underneath, just better orchestration."

**Why this matters** — *The 'each node spliced exactly once' argument is the clean defense against an interviewer who asks 'why O(n+m) and not something else?'. The merge-k extension is the natural follow-up (LeetCode 23) and proves you see merge-two as a reusable primitive rather than this one problem's solution — that's how it shows up in MergeSort, Merge k Sorted Lists, and any external-merge variant where data doesn't fit in memory.*

---

### Evening — Tree-shape drill *(~1.5 hr)*

#### Max Depth of Tree

*Trees* · `p-max-depth` — Depth of a node = 1 + the deeper of its two children. Null subtree contributes 0.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "So I need to return the maximum depth of a binary tree — by depth you mean the number of nodes on the longest root-to-leaf path, right? (As opposed to number of edges, which would be one less.)"

Then a few quick clarifying questions:
• Empty tree — return 0?
• Node shape — is it `{ val, left, right }` with `null` for missing children?
• Can values be anything (negative, duplicates), or does that not matter here?
• Any constraint on tree size — do I need to worry about recursion stack overflow for very deep trees?

**Why this matters** — *The node-count vs. edge-count distinction is the easy thing to get wrong — LeetCode uses node count (a single-node tree has depth 1), but some textbooks use edge count (depth 0). Asking up front avoids an off-by-one that doesn't surface until the test cases run. The stack-overflow question hints that you know recursion has a ceiling and have an iterative BFS in your back pocket if needed.*

##### 2. Brute force first (out loud)

> Name the obvious recursive solution — there's no slower naive.

**What I'd say** — "There isn't really a 'brute force' separate from the optimal here — the natural solution is already O(n). I'd describe it as: every node's depth is 1 plus the deeper of its two children. Base case: null contributes 0. Recurse left, recurse right, return `1 + Math.max(left, right)`. The whole algorithm is three lines."

**Why this matters** — *Some problems don't have a slow-then-fast arc — saying so out loud is better than inventing a strawman. Interviewers worry about candidates who pad their answer to fit a template; calling out that the natural solution IS optimal demonstrates judgment about when an optimization step is or isn't needed.*

##### 3. Spot the pattern

> What signal in the problem points to pure tree recursion?

**What I'd say** — "The depth of a tree is defined recursively in terms of the depth of its subtrees — that's the textbook signature of structural recursion on a tree. Each node only needs information from its two children to compute its own answer, and those children compute the same way. So I'd reach for pure recursion: base case at null, combine the two children's answers, return. No need for BFS, no need for memoization, no need for an accumulator parameter. If interview constraints forbid recursion — say, the tree is a million levels deep — I'd switch to BFS with a queue and count levels, but for a typical interview tree, recursion is the cleanest expression."

**Why this matters** — *Naming the pattern *and* the property that makes the pattern apply is the move. 'Tree recursion' alone is a guess; 'tree recursion because depth is a recursive function of subtree depths' is the derivation. The unprompted callout to BFS as a stack-safe fallback is bonus: it shows you know the standard alternative without being asked.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — the classic balanced tree, the empty tree, and a left-skewed tree that stresses the recursion depth.

**Worked examples**

- **Input:** `[3,9,20,null,null,15,7]` → **Output:** `3`
  *Note:* Classic balanced — the deeper path is root→20→either 15 or 7.

  ```
  maxDepth(3)
    maxDepth(9) → no children, 1 + max(0, 0) = 1
    maxDepth(20)
      maxDepth(15) → 1 + max(0, 0) = 1
      maxDepth(7)  → 1 + max(0, 0) = 1
      return 1 + max(1, 1) = 2
    return 1 + max(1, 2) = 3
  ```
- **Input:** `[] (empty tree, root=null)` → **Output:** `0`
  *Note:* Degenerate — base case fires immediately, no recursion.

  ```
  maxDepth(null)
    !root is true → return 0
  ```
- **Input:** `[1,2,null,3,null,4] (left-skewed)` → **Output:** `4`
  *Note:* Skewed → recursion depth equals node count. Stresses the stack.

  ```
  maxDepth(1)
    maxDepth(2)
      maxDepth(3)
        maxDepth(4)
          return 1 + max(0, 0) = 1
        return 1 + max(1, 0) = 2
      return 1 + max(2, 0) = 3
    return 1 + max(3, 0) = 4
  ```

**Why this matters** — *The skewed-tree trace surfaces the stack-depth concern in concrete form — recursion depth is O(h), which on a degenerate tree equals n. The empty-tree case defends the `if (!root) return 0` base — without it the recursion would crash on `null.left`. Both bugs are easier to catch on the whiteboard than after the interviewer points to a failing test.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Null root → returns 0 via the base case. ✓
• Single node → 1 + max(0, 0) = 1. ✓
• Left-skewed (degenerate to linked list) → recursion depth equals n; for a million-node skewed tree the call stack would overflow. The fix is iterative BFS with a queue counting levels.
• Right-skewed → same as above, mirror image.
• Perfectly balanced → recursion depth is log₂(n), totally safe.
• All-same values → depth doesn't depend on values, only structure, so identical to the same shape with distinct values."

**Why this matters** — *The skewed-tree call-out is the senior signal. Most candidates write the three-line recursion and stop; flagging that recursion depth equals tree height — and that for adversarial inputs the height can equal n — shows you understand the difference between O(h) space (the right bound) and O(log n) space (the bound you'd get only on balanced inputs). Interviewers either nod or say 'assume the tree fits in the stack' — either response is good.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — every node is visited exactly once. The work per node is constant: one comparison, one max, one addition. No memoization needed because the recursion tree mirrors the actual tree, no overlap.

Space is O(h) for the recursion stack, where h is the tree height. For a balanced tree that's O(log n); for a skewed tree it's O(n). If the input could be adversarial — a deliberately skewed tree larger than the JS engine's stack frame budget — I'd convert to an iterative BFS: queue, level counter, `queue.length` snapshot per level. Same O(n) time, O(w) space where w is the max level width.

If you wanted to extend to 'find the node at maximum depth' or 'minimum depth', the recursive skeleton is identical — only the combine step changes. Min depth has the gotcha that a node with one null child shouldn't claim depth 1 from that side; you have to special-case it."

**Why this matters** — *The O(h) vs O(log n) distinction is the right defense against pushback. Calling out the iterative BFS fallback unprompted demonstrates you see the template, not just this solution. The min-depth extension is a real interview gotcha — LeetCode 111 — and naming it shows you've thought about the family of problems that share this shape, not just the specific question being asked.*

---

#### Invert Binary Tree

*Trees* · `p-invert` — Swap each node’s left and right children recursively — the mirror image of the original tree.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "So I need to invert a binary tree — by 'invert' you mean produce the mirror image, where every node's left and right children are swapped, and that swap cascades through all descendants. Yes? (As opposed to, say, reversing the values per level or rotating the tree.)"

Then a few quick clarifying questions:
• Mutate in place, or return a new tree?
• Node shape — `{ val, left, right }` with `null` for missing children?
• What should I return for an empty tree — `null`?
• Are duplicate values allowed? (Doesn't change the algorithm but worth confirming.)

**Why this matters** — *The 'mirror' framing is the clearest plain-English description and pins down what's actually being asked. In-place vs. new-tree matters for the API: the canonical answer mutates and returns the same root, which is fine for LeetCode but a real codebase might want immutability. The empty-tree question surfaces the base case before you write it. This is the famous Max Howell tweet problem — Google rejected him for failing it on a whiteboard, so the bar for crisp execution is high.*

##### 2. Brute force first (out loud)

> Name the obvious recursive solution.

**What I'd say** — "There isn't a meaningfully slower 'brute force' here — the natural recursive solution is already O(n) and visits each node once. I'd describe it as: at every node, swap the left and right children, then recurse into both subtrees so they get inverted too. Base case: null returns null. Three or four lines.

The only variation worth mentioning is whether you swap first then recurse, or recurse first then swap — both work, the order of operations doesn't affect correctness because the recursive calls are independent."

**Why this matters** — *Calling out that there's no slower variant — and that the order doesn't matter — is the move. Interviewers worry about candidates who pad with a strawman; saying 'the natural solution is already optimal, here's why the order doesn't matter' shows you've thought about it rather than memorized it. The order-independence callout is a frequent interviewer follow-up; pre-empting it saves a round-trip.*

##### 3. Spot the pattern

> What signal in the problem points to pure tree recursion?

**What I'd say** — "Mirror is a per-node transformation defined recursively: the mirror of a tree rooted at N is a tree with N's value, the mirror of N.right as left subtree, the mirror of N.left as right subtree. Each node's output depends only on its two children's outputs — that's the textbook signature of structural recursion on a tree. So I'd do exactly that: base case null returns null, recursively invert both children, swap. This is also the classic 'exam of recursion' problem — the algorithm is so trivial that what's being tested is whether you can write clean recursive code under pressure, not algorithm design. So I'd focus on writing it cleanly first and only optimize if asked."

**Why this matters** — *The 'exam of recursion' framing is the key insight. The interviewer almost certainly isn't testing whether you know the algorithm — they're testing whether you can express it in clean code without thinking. Calling that out tells them you understand what's actually being graded, which is itself a signal of interview maturity.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — a balanced BST whose inversion has a clean property (inorder becomes sorted descending), the empty tree, and a tiny asymmetric tree that shows the structural change.

**Worked examples**

- **Input:** `[4,2,7,1,3,6,9]` → **Output:** `[4,7,2,9,6,3,1]`
  *Note:* Classic balanced BST — inversion produces the mirror; inorder traversal goes from sorted ASC to sorted DESC.

  ```
  invert(4)
    invert(2)
      invert(1) → leaf, swap nulls, return 1
      invert(3) → leaf, swap nulls, return 3
      swap 2's children: now left=3, right=1; return 2
    invert(7)
      invert(6) → leaf, return 6
      invert(9) → leaf, return 9
      swap 7's children: now left=9, right=6; return 7
    swap 4's children: now left=7, right=2; return 4
  final: root=4, left=7 (with children 9,6), right=2 (with children 3,1)
  ```
- **Input:** `[] (empty tree, root=null)` → **Output:** `[]`
  *Note:* Degenerate — base case returns null immediately, no recursion.

  ```
  invert(null)
    !root is true → return null
  ```
- **Input:** `[1,2] (single left child)` → **Output:** `[1,null,2]`
  *Note:* Tiny asymmetric — shows the swap turning a left-only child into a right-only child.

  ```
  invert(1)
    invert(2) → leaf, return 2
    invert(null) → return null
    swap 1's children: now left=null, right=2; return 1
  ```

**Why this matters** — *The BST trace is the cleanest sanity check: inverting a BST should make its inorder traversal go from sorted-ascending to sorted-descending. If your code is wrong, that property will visibly break. The `[1,2]` trace exposes the subtle bug where a careless implementation forgets to assign the swapped result — if you only recurse into existing children, the lone child never moves to the other side.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Null root → base case returns null. ✓
• Single node → no children to swap, returns unchanged.
• Perfectly balanced tree → all swaps happen, recursion depth is log₂(n).
• Left-skewed (degenerate to linked list) → becomes right-skewed. Recursion depth equals n, so a million-node skewed tree would overflow the call stack. The iterative alternative uses a queue or stack — same swap logic, no recursion.
• All-same values → swap is structurally identical to the original tree; inorder traversal is unchanged, but the references on left/right have flipped. Worth mentioning that visual equivalence doesn't mean object identity.
• Asymmetric subtrees (e.g. lots of lefts, few rights) → recursion handles it naturally because each subtree is processed independently."

**Why this matters** — *The skewed-tree callout is the senior signal — for a degenerate tree the recursion depth equals n, which is the same O(h) space concern that shows up across every tree problem. The all-same-values observation about reference vs. value equality is the kind of subtle thing that separates engineers who think about object identity from those who only think about output. Either prompt earns you bonus points.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — every node is visited exactly once. Work per node is constant: two recursive calls and a swap.

Space is O(h) for the recursion stack, where h is the tree height. Balanced is O(log n); skewed is O(n) worst case. If the interviewer pushes back on stack safety, I'd convert to iterative BFS or DFS — push root onto a queue/stack, pop, swap children, push the children back, repeat. Same O(n) time, O(w) extra space where w is max level width (or stack size).

If you wanted to extend this to 'check if a tree is a mirror of itself' — Symmetric Tree, LeetCode 101 — you'd use parallel recursion on the original tree against its mirror, comparing values and inverted subtrees at each step. Same recursive shape, different combine step. And of course the Max Howell rejection is the canonical interview folklore here — if you can't write this in 60 seconds under pressure, you'll get filtered. The drill is to make it muscle memory."

**Why this matters** — *The iterative fallback is the right answer to the stack-overflow pushback. The Symmetric Tree extension demonstrates you see invert-tree as a primitive in a family of mirror problems, not just a one-off question. Surfacing the Howell folklore is appropriate here in a way it wouldn't be for most problems — it tells the interviewer you know this problem's reputation, which signals you've taken it seriously enough to make the implementation reflexive.*

---

#### BFS Level Order

*Trees* · `p-bfs` — BFS with a queue, processing one level per outer iteration by snapshotting the queue size before the inner loop.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "So I need to return the level-order traversal of a binary tree as an array of arrays — one inner array per level, containing the values at that depth in left-to-right order. For tree [3,9,20,null,null,15,7], the answer is [[3],[9,20],[15,7]]. Yes?"

Then a few quick clarifying questions:
• Empty tree — return `[]` or `[[]]`? (I'd argue `[]` — no levels, not one empty level.)
• Are levels guaranteed to be in left-to-right order? (Yes is standard.)
• Node shape — `{ val, left, right }` with `null` children?
• Could the tree have a single skewed branch? (Affects max queue width but not the algorithm.)

**Why this matters** — *The `[]` vs `[[]]` distinction on empty input is a real bug magnet — both are plausible interpretations and the wrong choice fails a single test case at the bottom of the suite. Asking up front beats discovering it post-hoc. The left-to-right ordering question matters because BFS naturally produces it only if you enqueue left before right; flipping that order would produce right-to-left, which is a different problem.*

##### 2. Brute force first (out loud)

> Name the obvious — DFS with depth — before pivoting to BFS.

**What I'd say** — "One option is recursive DFS carrying a `depth` parameter: at each node, push its value into `res[depth]`, recursing left and right with `depth + 1`. That's O(n) time and gives the right answer because depth-first naturally fills levels in left-to-right order if you recurse left first.

The BFS version is the more idiomatic answer for level-order — it processes one level at a time in lockstep with the structure of the question, and the level boundaries fall out naturally from the queue size. I'd go with BFS because the code reads as 'for each level, collect its values, then enqueue the next level' — that's literally what the problem asks for."

**Why this matters** — *Two reasons to mention the DFS variant out loud. (1) It proves you can see both approaches and chose BFS deliberately, not because you didn't think of DFS. (2) It frames BFS as 'the more natural fit for level-order' rather than 'the only way' — which is what an interviewer wants to hear. They're grading on judgment about which tool fits, not memorization of one canonical answer.*

##### 3. Spot the pattern

> What signal in the problem points to BFS with a level-size snapshot?

**What I'd say** — "Level-order with explicit per-level grouping is the canonical 'BFS with level-size trick' problem. The standard BFS template visits nodes one at a time, but here I need to know which level each node belongs to — and the trick for that is to snapshot `queue.length` BEFORE the inner loop, then process exactly that many nodes. Any children pushed during the inner loop belong to the NEXT level, not the current one, so the snapshot captures the level boundary precisely.

This is THE template for any 'do something per level' problem: right-side view, average per level, max per level, zigzag traversal — they all share this skeleton."

**Why this matters** — *Naming the level-size snapshot trick — and explaining WHY it works (children pushed mid-loop go to the next level) — is the move. 'BFS' alone is the right pattern name but not the right depth; specifying the snapshot mechanism shows you understand the implementation pitfall that catches most people. The 'this is THE template' callout demonstrates you see the reusable shape across the BFS family, not just this question.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — the classic mixed-sparse tree, the empty tree, and a perfectly balanced one.

**Worked examples**

- **Input:** `[3,9,20,null,null,15,7]` → **Output:** `[[3],[9,20],[15,7]]`
  *Note:* Classic — sparse mid-level (9 has no children, 20 has two).

  ```
  queue=[3], res=[]
  iter 1: size=1, level=[]
    shift 3 → level=[3], enqueue 9, 20. queue=[9,20]
    level done → res=[[3]]
  iter 2: size=2, level=[]
    shift 9 → level=[9], no children. queue=[20]
    shift 20 → level=[9,20], enqueue 15, 7. queue=[15,7]
    level done → res=[[3],[9,20]]
  iter 3: size=2, level=[]
    shift 15 → level=[15], no children. queue=[7]
    shift 7 → level=[15,7], no children. queue=[]
    level done → res=[[3],[9,20],[15,7]]
  queue empty → return [[3],[9,20],[15,7]]
  ```
- **Input:** `[] (empty tree)` → **Output:** `[]`
  *Note:* Degenerate — early-return guard fires.

  ```
  !root is true → return []
  ```
- **Input:** `[1,2,3,4,5,6,7]` → **Output:** `[[1],[2,3],[4,5,6,7]]`
  *Note:* Perfectly balanced — level widths double each iteration.

  ```
  queue=[1], res=[]
  iter 1: size=1 → shift 1, enqueue 2,3. res=[[1]]. queue=[2,3]
  iter 2: size=2 → shift 2 (enqueue 4,5), shift 3 (enqueue 6,7). res=[[1],[2,3]]. queue=[4,5,6,7]
  iter 3: size=4 → shift 4,5,6,7 (no children). res=[[1],[2,3],[4,5,6,7]]. queue=[]
  return [[1],[2,3],[4,5,6,7]]
  ```

**Why this matters** — *The mixed-sparse trace surfaces the level-snapshot bug — if you accidentally used `queue.length` INSIDE the inner loop instead of the snapshotted `size`, iter 2 would see queue grow to 4 mid-loop and process 15 and 7 as part of level 2. Watching the snapshot stay fixed while the queue grows is the visual proof the trick works. The empty case defends the early return; without it you'd return `[[]]` instead of `[]`.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Null root → returns `[]` via early guard. (Without the guard you'd return `[[]]` because the outer while wouldn't execute but an empty level would be pushed by... wait, no, without the guard the while loop wouldn't run at all because `queue.length` is 0 — you'd actually return `[]` correctly. The guard is still cleaner.) ✓
• Single node → returns `[[v]]`. ✓
• Left-skewed (degenerate to linked list) → each level has exactly one node, res has n inner arrays of length 1.
• Right-skewed → same as left-skewed, mirror image.
• Perfectly balanced → max queue width is n/2 at the bottom level, so O(n) extra space worst case.
• Very wide tree (e.g. a root with 1000 children — wait, this is binary, so at most 2 — but a perfectly balanced tree with 1M leaves would have 500K nodes in the queue simultaneously). For huge trees, that O(w) memory matters.
• Performance: `queue.shift()` is O(n) in JS arrays — for large trees, total cost becomes O(n²). The fix is a head index (`let head = 0; const node = queue[head++]`) or a real deque."

**Why this matters** — *The `shift` O(n) callout is the senior signal. Most candidates write `queue.shift()` and move on; flagging that it's O(n) and offering the head-index fix shows you know the JS performance gotcha that doesn't bite on LeetCode test cases but bites hard in production. Interviewers love this because it's specifically about JavaScript, not about the algorithm — it proves you know the language, not just the textbook.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — each node is enqueued exactly once and dequeued exactly once. The level-size snapshot adds zero overhead per node; the per-level inner loop just slices the work into chunks.

With the naive `queue.shift()` it's actually O(n²) on huge inputs because `shift` walks the whole array each call. For interview purposes O(n) is the right answer to state, but I'd flag the gotcha and offer the head-index fix if the interviewer probes.

Space is O(w) where w is the maximum level width — at most n/2 for a balanced tree at the bottom level, so O(n) worst case.

If you wanted to extend to right-side view (LeetCode 199), it's the same skeleton — just push only the LAST element of each level instead of all of them. For zigzag traversal (LeetCode 103), alternate `level.push` and `level.unshift` (or reverse the level after building). Same template, different per-level processing."

**Why this matters** — *The `shift` amortization caveat is what wins the pushback — interviewers who care about performance will ask, and pre-empting it shows you do too. The right-side-view and zigzag extensions prove you see this as a reusable template, not just this problem's solution. That's the difference between memorizing one answer and understanding a pattern family.*

---

#### Same Tree

*Trees* · `p-same-tree` — Two binary trees are identical iff their roots match in value AND their left and right subtrees are recursively identical. Straight structural recursion.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "So I need to determine if two binary trees `p` and `q` are 'the same' — meaning they have identical structure AND identical values at every corresponding position. If one tree has a node where the other has null at the same position, they're different even if all the values where both exist would match."

Then a few quick clarifying questions:
• Are we comparing structure + values, or just values (e.g. ignoring missing children)? (Standard is structure + values.)
• Both empty trees → return true?
• Node shape — `{ val, left, right }` with `null` children?
• Should I return early on the first mismatch, or compare every node? (Early return is the standard, but it's worth confirming there's no 'count differences' variant.)

**Why this matters** — *The 'structure + values' framing is the easy thing to misread — some candidates compare values via in-order traversal and miss that `[1,2]` (left child only) and `[1,null,2]` (right child only) produce the same in-order [1,2] but are different trees. Confirming structure matters too — and that the algorithm must check shape, not just contents — locks in the right approach from the start.*

##### 2. Brute force first (out loud)

> Name the obvious recursive solution — and the BFS alternative for stack safety.

**What I'd say** — "There's no slower naive here — the natural recursive solution is O(n) and visits each pair of corresponding nodes once. I'd describe it as: three base cases up front — both null → true, exactly one null → false, values differ → false — then recurse on (p.left, q.left) AND (p.right, q.right) with short-circuiting `&&`.

The iterative alternative uses parallel BFS or DFS: maintain a queue of (p_node, q_node) pairs. Pop a pair, apply the same three base-case checks, push the children pairs. Same O(n) time, O(w) or O(h) space depending on traversal order. Iterative version trades clarity for stack safety on deep trees."

**Why this matters** — *Calling out that there's no meaningful brute force — and offering the iterative variant as a stack-safety alternative — is the right framing. Interviewers want to see judgment about which tool fits; offering both options without padding shows you've thought about the tradeoff. The iterative version's value is purely stack safety, not asymptotic, and saying so demonstrates you don't conflate 'iterative' with 'faster.'*

##### 3. Spot the pattern

> What signal in the problem points to parallel recursion?

**What I'd say** — "The property to check is defined recursively over both trees simultaneously: two trees are 'same' iff their roots match AND their corresponding subtrees (both lefts, both rights) are 'same.' That's the textbook signature of parallel structural recursion — walk two trees in lockstep, making the same check at every paired position. Not a single-tree recursion that returns something interesting; a pair-of-trees recursion where the result is just true/false.

The three base cases come from the cartesian product of (p exists or not) × (q exists or not): both missing is fine (true), one missing while the other isn't is mismatch (false), both present requires value match plus recursion. That cartesian exhaustion is what makes the algorithm complete — every position in either tree is accounted for.

Parallel recursion (or parallel BFS) is the same family that shows up in Symmetric Tree, Mirror of a Tree, Subtree Check — anytime you're comparing two tree structures position-by-position."

**Why this matters** — *Naming 'parallel recursion' — and explaining the three base cases come from the cartesian product of nullable positions — is the derivation. 'Use recursion' alone is too vague; 'parallel recursion because we're walking two trees in lockstep' is specific. The connection to Symmetric Tree and Subtree Check proves you see the family, which is the kind of pattern-level understanding interviewers grade on.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — fully identical, value mismatch, and shape mismatch (the in-order-trap case).

**Worked examples**

- **Input:** `p=[1,2,3] q=[1,2,3]` → **Output:** `true`
  *Note:* Fully identical — algorithm walks both trees in lockstep, all checks pass.

  ```
  isSame(1, 1): both non-null, vals match (1===1). recurse:
    isSame(2, 2): both non-null, vals match. recurse:
      isSame(null, null): both null → true
      isSame(null, null): both null → true
      → true && true = true
    isSame(3, 3): both non-null, vals match. recurse:
      isSame(null, null): true
      isSame(null, null): true
      → true
    → true && true = true
  return true
  ```
- **Input:** `p=[1,2,3] q=[1,2,4]` → **Output:** `false`
  *Note:* Right child value differs — short-circuit return on mismatch.

  ```
  isSame(1, 1): vals match. recurse:
    isSame(2, 2): vals match. recurse on children, all null → true
    isSame(3, 4): vals differ (3 !== 4) → return false
    → true && false = false
  return false
  ```
- **Input:** `p=[1,2] q=[1,null,2]` → **Output:** `false`
  *Note:* Shape mismatch — in-order traversal would give [1,2] for both, but structures differ. This is THE in-order-trap case.

  ```
  isSame(p_root_1, q_root_1): vals match (1===1). recurse:
    isSame(p.left=2, q.left=null): exactly one null → return false
    → false && (right recursion not evaluated due to short-circuit)
  return false
  ```

**Why this matters** — *The third trace is the load-bearing one — it exposes the in-order trap. A candidate who solves this with 'flatten both trees in-order and compare arrays' would return TRUE here, because both trees produce in-order [1, 2]. The parallel-recursion approach correctly returns false at the (left, null) mismatch. Walking through this trace out loud is what convinces an interviewer you understand WHY shape matters separately from values.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Both null → both-null base case returns true. ✓
• One null, one non-null root → exactly-one-null base case returns false. ✓
• Single node, same value → vals match, both children recursions return true (both null on both sides). ✓
• Single node, different values → vals-differ base case returns false. ✓
• Trees with identical in-order but different shapes (e.g. [1,2] vs [1,null,2]) → the in-order trap. Parallel recursion catches it via the exactly-one-null check; in-order-then-compare would miss it.
• All-same values (e.g. [1,1,1] vs [1,1,1]) → walks both fully, returns true.
• One tree huge, other tiny — first mismatch (likely an exactly-one-null in the recursion) short-circuits to false; we don't walk the whole large tree.
• Left-skewed (degenerate to linked list) → recursion depth = n, stack-overflow risk on adversarial input.
• Floating-point values like NaN — `NaN !== NaN` so trees with NaN at corresponding positions would compare as different. Worth flagging if values are floats."

**Why this matters** — *The in-order trap callout is the senior signal — most interview problems don't have a 'tempting wrong solution' to call out, and this one does. The NaN edge is bonus depth for floats — most candidates never think about it, but `Number.isNaN(v) && Number.isNaN(u)` is the careful comparison if NaN is in scope. Either flagging earns you 'thinks about edges' credit.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(min(|p|, |q|)) in the early-return case (we stop at the first mismatch), and O(n) where n = max tree size in the full-match case. The standard answer is O(n) because the worst case is two identical trees that require visiting every node pair.

Space is O(h) for the recursion stack — log n balanced, n worst case skewed. Iterative parallel BFS would be O(w) instead.

The short-circuit via `&&` is a real performance win when trees mismatch early — recursion doesn't even enter the right subtree once the left disagrees. Worth using `&&` rather than evaluating both and AND-ing the results.

If you wanted to extend this to 'is `subRoot` a subtree of `root`' (LeetCode 572), you'd call `isSameTree` from every node of `root`: at each `n` in `root`, check if `isSameTree(n, subRoot)`. That's O(m·n) naively; can be made O(m+n) with serialization + KMP, but the natural recursive version reuses this function as a primitive."

**Why this matters** — *Naming early-return as O(min) and full-match as O(n) shows you've thought about the actual cost profile, not just the worst case. The Subtree Check extension is LeetCode 572 and uses `isSameTree` as a building block — calling that out proves you see this as a primitive in the tree-comparison family, not just a one-off question. That's the kind of compositional thinking that distinguishes pattern fluency.*

---

#### Heap index math + sift skeleton

*Algorithms* · `s-heap-ops` — The whiteboard boilerplate for a 0-indexed array heap: parent/child index math plus sift-up and sift-down loops.

> How you'd walk through heap mechanics in an interview when the heap shows up as a subroutine (top-K, median stream, Dijkstra). Each section: what you'd say, then why that move matters. Tap to expand.

##### 1. Why drill this?

> When does heap math actually show up?

**What I'd say** — "A heap is the data structure I reach for whenever I need 'the smallest (or largest) so far' on a stream — top-K, median, Dijkstra's frontier, scheduling. JS has no built-in heap, so in a real interview I'd either write the index math from memory or ask 'can I assume a min-heap helper?'. I want both options ready, so this lesson is the index math (parent / left / right) plus the two sift loops (up for insert, down for pop-root) — the skeleton I'd reproduce on a whiteboard."

**Why this matters** — *Most candidates blank on heap mechanics the moment a problem needs more than `arr.sort()`. Treating the three index formulas + two sift loops as ONE memorized unit — not five things — turns 'I forget the parent formula' into 'I have a 25-line block I write down'. That confidence frees attention for the actual problem (which heap, what comparator, when to extract).*

##### 2. The common mistakes first

> What goes wrong before you get the canonical right?

**What I'd say** — "Three failures I'd flag before I start writing:"

• "Mixing up 1-indexed and 0-indexed math. The classic textbook formulas are `parent = i/2`, `left = 2i`, `right = 2i+1` — but those are for **1-indexed** heaps. JS arrays are 0-indexed, so I use `parent = (i-1) >> 1`, `left = 2i+1`, `right = 2i+2`. Different by exactly one."

• "On sift-DOWN, swapping with the WRONG child. If I swap with the larger child of a min-heap, the smaller one stays trapped below — heap property broken. Always swap with the smaller (for min-heap) or larger (for max-heap) child."

• "Forgetting the bounds check on sift-down. The current node might have only a left child, or no children at all. `l < heap.length && heap[l] < heap[s]` covers both: the AND short-circuits if the child slot doesn't exist."

**Why this matters** — *Surfacing these failures unprompted signals you've HIT them — interviewers can tell the difference between memorized code and lived code. The 1- vs 0-indexed point is the one most candidates miss because they learned heaps from a textbook diagram that used 1-indexed nodes; saying 'in JS I use the 0-indexed form' shows you've translated the abstraction to your tools.*

##### 3. Spot the math

> Why does index arithmetic encode a tree?

**What I'd say** — "A complete binary tree laid out level-by-level into a flat array makes the parent/child relationship pure arithmetic. Level 0 is index 0 (one node). Level 1 is indices 1, 2 (two nodes). Level 2 is indices 3-6 (four nodes). At every level, a node at index `i` has children at `2i+1` and `2i+2`, and its parent is at `(i-1) >> 1`. No pointers, no allocation per node — the tree shape is implied."

"For the sift loops: sift-UP fires after a push. The new item sits at the tail, possibly smaller than its parent, so I bubble it upward swapping with its parent until either the parent is smaller (heap property restored) or I hit the root (`i === 0`). Sift-DOWN fires after a pop-root: I swap root with the tail, shrink the array, then bubble the now-root downward, always picking the smaller child to swap with — until both children are larger or I run out of children."

**Why this matters** — *Naming the structural property — 'complete binary tree → contiguous array' — is what shows you understand WHY the formulas work, not just THAT they do. If the interviewer asks 'what if the tree isn't complete?', you can answer: 'then this representation breaks; you'd need pointers or sparse indices.' Heaps are complete BY CONSTRUCTION (we always fill left-to-right), which is what makes the index math correctness-preserving.*

##### 4. Trace through examples

> Walk a sift-up and a sift-down on concrete numbers.

"Let me run a push-then-sift-up and a pop-root-then-sift-down through the formulas."

**Worked examples**

- **Input:** `heap=[1,5,3,10,8,7] then push(2)` → **Output:** `[1,5,2,10,8,7,3]`
  *Note:* Sift-up: 2 lands at index 6, parent at index 2 is 3, 3 > 2 so swap; new index 2, parent at index 0 is 1, 1 < 2 so stop.

  ```
  push 2 → heap=[1,5,3,10,8,7,2]
  i=6  parent=(6-1)>>1=2  heap[2]=3 > heap[6]=2 → swap → [1,5,2,10,8,7,3]  i=2
  i=2  parent=(2-1)>>1=0  heap[0]=1 < heap[2]=2 → STOP  ✓
  ```
- **Input:** `heap=[1,5,3,10,8,7] then pop-root` → **Output:** `[3,5,7,10,8]`
  *Note:* Pop-root: swap 1↔7, shrink to [7,5,3,10,8], then sift-down 7 from index 0 — swap with smaller child 3.

  ```
  swap heap[0]↔heap[5]=7  pop → heap=[7,5,3,10,8]
  j=0  l=1, r=2  smaller child = heap[2]=3 < heap[0]=7 → swap → [3,5,7,10,8]  j=2
  j=2  l=5, r=6  both out of bounds → STOP  ✓
  ```
- **Input:** `heap=[1,5,3,10,8,7], parent(4)=?` → **Output:** `5`
  *Note:* L3 case — pure parent lookup, no sift needed.

  ```
  parent(4) = (4 - 1) >> 1 = 3 >> 1 = 1
  heap[1] = 5  ✓
  ```

**Why this matters** — *The sift-down example is the one to narrate aloud — picking the SMALLER child between 3 (index 2) and 5 (index 1) is the load-bearing move. Choose 5 instead and 3 stays trapped below a 7, violating the invariant. Tracing it on numbers surfaces that decision in a way the code alone doesn't.*

##### 5. Edges + pitfalls

> What inputs would trip up a careless sift implementation?

**What I'd say** — "Edges I'd think through:"

• "Heap of size 0 or 1 — push into empty heap: tail is at index 0, the `i > 0` guard stops sift-up immediately. Pop-root on size 1: swap with self, pop, sift-down on empty — bounds check `l < heap.length` blocks both child checks."

• "Equal values — comparison is `>` not `>=`, so equal-value parent/child means no swap. That's correct: equal values trivially satisfy the heap property and unnecessary swaps cost time."

• "Sift-down with only a LEFT child — common when the heap has an odd number of nodes. The `r < heap.length` check on the right guards it; we'd compare against left only."

• "Duplicates — heaps handle duplicates fine; the only catch is that a custom comparator must be a total order (no `a == b` returning ambiguous), otherwise sift loops may bounce."

• "Forgetting to `break` when `s === j` on sift-down — without it the loop is infinite. The `break` is what says 'this node is already smaller than both children — stop'."

**Why this matters** — *The size-1 pop-root edge is the one that bites under timing pressure: you swap root with tail, then your shrink is `heap.pop()`, leaving an empty array — and sift-down on index 0 of an empty array would NaN-compare against `heap[l]` (undefined). The two `l < heap.length` / `r < heap.length` guards are not paranoia, they're the empty-heap correctness proof. Calling that out shows you've thought past the happy path.*

##### 6. Complexity

> What's the cost of these operations and how would you defend it?

**What I'd say** — "Per operation:"

• "Sift-up: at most one swap per tree level, and a complete binary tree of n nodes has ⌊log₂(n)⌋ + 1 levels. So sift-up is O(log n) — the level count grows logarithmically with size."

• "Sift-down: same argument from the root downward — at most one swap per level, so O(log n) as well."

• "Push and pop-root are O(log n) each. `peek` (read heap[0]) is O(1)."

• "Building a heap from n elements via repeated push is O(n log n), but bottom-up `heapify` — sift-down from index `(n/2)-1` down to 0 — is O(n). The trick is that half the nodes are leaves with 0 work, a quarter sift at most 1 level, an eighth at most 2 levels, and the weighted sum converges to O(n). Worth flagging if the problem builds a heap from a known list."

"If you want me to extend: kth-largest uses this directly — keep a min-heap of size k, push every element, pop when size exceeds k. Final root is the kth largest. O(n log k) total."

**Why this matters** — *The bottom-up heapify O(n) result is the one that earns the senior-tier nod — most candidates know push/pop are log n but recite 'building a heap is n log n' by reflex. Knowing the weighted-sum argument shows you've actually done the analysis. Naming kth-largest as the unprompted extension is the standard 'where does this template fire?' move.*

---

## Day 3 — Synthesis + first mock *(2026-05-26)*

### Morning — Trees / Heap / Intervals *(~3 hr)*

#### Validate BST

*Trees* · `p-valid-bst` — Validate a BST by passing tightening (lo, hi) bounds down: every node must satisfy lo < node.val < hi. Recurse left with hi=node.val, right with lo=node.val. O(n).

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "So I need to determine if a binary tree is a valid BST — meaning for EVERY node, every value in its left subtree is strictly less, and every value in its right subtree is strictly greater. Not just the immediate children — the whole subtree."

Then a few quick clarifying questions:
• Strict or non-strict comparison? Are duplicates allowed (LeetCode's standard is strict — no duplicates)?
• Value range — can values be larger than what `Number.MAX_SAFE_INTEGER` can represent? (Affects whether `-Infinity` sentinels are safe.)
• Empty tree — return `true` (vacuously valid)?
• Just a boolean answer, right? Not the offending node?

**Why this matters** — *The strict-vs-non-strict question is THE common misunderstanding for this problem — many candidates write `node.val < parent.val` for left subtrees, which would incorrectly pass `[2,2]`. Asking up front frames the answer: strict means `<` and `>`, never `<=`. The value-range question is a subtle senior signal — if values can exceed safe integer range, `-Infinity` won't work and you'd need `null` sentinels with explicit checks.*

##### 2. Brute force first (out loud)

> Name the obvious — but wrong — local check, then the correct in-order alternative.

**What I'd say** — "The first solution most people reach for is wrong: 'check that left.val < root.val < right.val at every node.' That's the LOCAL property but it's not enough. Counter-example: tree [5,1,4,null,null,3,6] — root 5 has left=1 and right=4. Locally that fails (4 < 5). But even if I flip it to [5,1,6,null,null,3,7], where 5 → 1 / 6 is locally fine and 6 → 3 / 7 is locally fine, the tree is still invalid because 3 is in the right subtree of 5 but 3 < 5.

A correct brute force is in-order traversal: collect all values left-to-right, then check the resulting array is strictly increasing. That's O(n) time and O(n) extra space for the array.

The more elegant variant — and what I'd use — carries (lo, hi) bounds down the recursion: each node must satisfy `lo < node.val < hi`, and the bounds tighten as you descend. Same O(n) time but O(h) space for the recursion only, no traversal array."

**Why this matters** — *Walking the interviewer through the WRONG local check first — and naming the specific counter-example that breaks it — is a power move. It shows you've thought about why a naive solution fails, not just that the right answer is the right answer. The bounds-passing solution then lands as 'the natural fix' rather than a magic trick: you're not just remembering an algorithm, you're deriving why ancestral constraints matter.*

##### 3. Spot the pattern

> What signal in the problem points to bounds-passing recursion?

**What I'd say** — "The defining BST property is global, not local: every node in the LEFT subtree of N must be less than N — not just N's direct left child, but every descendant. That global constraint is what kills the naive local check, and the standard fix is bounds-passing recursion: at every recursive call, carry the (lo, hi) open interval that the current subtree's values must fall inside. Going left tightens `hi` to node.val; going right tightens `lo` to node.val. Root starts with (-Infinity, +Infinity).

This is the tree analogue of 'pass state down the recursion' — common in any tree problem where a node's validity depends on its ancestors. Beats in-order traversal because it's O(h) space instead of O(n), no allocation, and handles duplicates cleanly with strict inequalities."

**Why this matters** — *The 'global vs local property' framing is the key insight that turns this from a memorized algorithm into a derivation. Naming bounds-passing as a specific technique — not just 'recursion' — is what separates the answer from a generic 'use recursion' guess. The comparison to in-order traversal (faster space, no allocation) shows you've weighed alternatives, not just picked the first solution that comes to mind.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — a tiny valid tree, the classic 'naive local check passes but ancestor violation makes it invalid' tree, and a similar gotcha with reversed bounds direction.

**Worked examples**

- **Input:** `[2,1,3]` → **Output:** `true`
  *Note:* Tiny valid BST.

  ```
  check(2, -inf, +inf): 2 in (-inf, +inf) ✓
    check(1, -inf, 2): 1 in (-inf, 2) ✓
      check(null, -inf, 1): true
      check(null, 1, 2): true
    check(3, 2, +inf): 3 in (2, +inf) ✓
      check(null, 2, 3): true
      check(null, 3, +inf): true
  return true
  ```
- **Input:** `[5,1,4,null,null,3,6]` → **Output:** `false`
  *Note:* Naive local check passes (4 fails 4<5 locally, but let's use the classic invalid where 3 violates ancestor 5).

  ```
  check(5, -inf, +inf): 5 in (-inf, +inf) ✓
    check(1, -inf, 5): 1 in (-inf, 5) ✓
      (both children null, both pass)
    check(4, 5, +inf): 4 in (5, +inf)? NO — 4 <= 5
  return false (caught by bounds, even though 4 is locally < 5's right value... wait, 5 < 4 fails at the local check too).
  The actual ancestor-violation case is the subtree of 4: had we let 4 in, then check(3, 5, 4) would have caught 3 not in (5, 4) — bounds carry the ancestor 5 down.
  ```
- **Input:** `[10,5,15,null,null,6,20]` → **Output:** `false`
  *Note:* Cleaner ancestor-violation example — 6 is locally fine (left child of 15, less than 15) but globally invalid (must also be > 10 because it's in the right subtree of 10).

  ```
  check(10, -inf, +inf): 10 in (-inf, +inf) ✓
    check(5, -inf, 10): 5 in (-inf, 10) ✓ (no children)
    check(15, 10, +inf): 15 in (10, +inf) ✓
      check(6, 10, 15): 6 in (10, 15)? NO — 6 <= 10
  return false ← caught by ancestor bound 10, which the naive local check would have missed
  ```

**Why this matters** — *The third trace is the load-bearing one — it shows the bounds approach catching exactly the kind of bug the naive local check misses. Node 6 IS less than its parent 15, so a local check would let it through; but the inherited `lo=10` from ancestor 10 rejects it. This is the proof that bounds-passing is correct where local-only is not. Worth verbalizing during the trace so the interviewer sees you understand the WHY, not just the algorithm.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty tree → `check(null, -Infinity, Infinity)` hits the null base case and returns true. ✓ (Vacuously valid.)
• Single node → check passes regardless of value (since (-Infinity, +Infinity) accepts anything). ✓
• Duplicates anywhere — `[2,2]` or `[1,1,1]` — must return false with strict `<=` and `>=`. If the problem allowed duplicates on one side only, swap one comparison to non-strict.
• Left-skewed (1M nodes descending) — recursion depth is n, risks stack overflow. Iterative in-order is the fallback.
• Values at integer extremes — if the tree contains `Number.MIN_SAFE_INTEGER` as a real value, `-Infinity` still works as a sentinel because JS numbers compare correctly. If you were in a language with bounded ints, you'd want `null` sentinels with explicit `lo === null` checks.
• Tree that's locally valid but globally invalid — this is THE classic bug (e.g. [10,5,15,null,null,6,20]) and the bounds approach catches it where local-only doesn't."

**Why this matters** — *Calling out the locally-valid-globally-invalid case explicitly — and naming it as the bug that motivates the bounds approach — closes the loop on why you picked this solution. The integer-extreme callout is the senior signal: most candidates use `-Infinity` without thinking; flagging the language-specific concern shows you'd handle this differently in C++/Java where you'd need `Optional<Integer>` or `INT_MIN`/`INT_MAX` with care.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — every node is visited exactly once, and the bounds check at each node is O(1). No memoization needed because the recursion tree exactly matches the actual tree.

Space is O(h) for the recursion stack — log n balanced, n worst case skewed. That's a strict win over the in-order-traversal alternative which is O(n) for the traversal array on top of O(h) for the stack.

If you wanted to do it iteratively to avoid stack overflow on deep trees, the standard trick is iterative in-order with a stack: push lefts until null, pop, compare with previous, push the popped node's right and repeat. Same O(n) time, O(h) space, but the stack is your data structure not the JS call stack — so you don't blow up on a 1M-node skewed tree.

If you wanted to extend to 'count nodes that violate the BST property' instead of just yes/no, the same skeleton works — replace the early `return false` with an accumulator and walk the whole tree."

**Why this matters** — *The iterative in-order fallback for stack-safety is the right defense against the 'what if the tree is huge' pushback. The count-violators extension demonstrates you see this as a parameterized template — change the combine step and the same recursive skeleton solves related problems. That's the kind of thinking that shows you understand the family of validation problems, not just this one.*

---

#### LCA in a BST

*Trees* · `p-lca-bst` — In a BST, walk down from root: if both p, q < root go left, both > root go right, else root IS the split point and therefore the LCA.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "So I need to find the lowest common ancestor of two nodes `p` and `q` in a BST — the deepest node that has both `p` and `q` as descendants. A node can be a descendant of itself, so if `p` is an ancestor of `q`, then `p` IS the LCA."

Then a few quick clarifying questions:
• Is the tree guaranteed to be a valid BST (no duplicates, strict ordering)? The BST property is the whole point of this problem.
• Are `p` and `q` guaranteed to exist in the tree? If not, what should I return — null?
• Can `p === q`? (LCA of a node and itself is just that node.)
• Should I return the node reference or just its value?

**Why this matters** — *The 'node is a descendant of itself' clause is the small print that determines whether the LCA can be `p` or `q` themselves. Missing it leads to a bug where you skip past the answer looking for something deeper. The 'guaranteed to be a BST' question matters because the whole O(h) trick depends on the ordering — without it you'd fall back to the generic-tree LCA algorithm, which is O(n).*

##### 2. Brute force first (out loud)

> Name the generic-tree LCA — then leverage the BST property.

**What I'd say** — "For a generic binary tree (no BST property), the standard LCA is: recurse into left and right subtrees looking for p or q. If both sides return non-null, this node is the LCA. If only one side does, propagate that side up. That's O(n) time because you potentially visit every node.

But this is a BST, so I can do much better. The BST ordering tells me, without exploration, which subtree p and q are in: if both are less than the current node, both are in the left subtree, so the LCA is in the left subtree. Same logic on the right. The first node where they diverge — one less, one greater, or one equals the node itself — is the LCA. That's O(h) time, never branches into both subtrees, and is iterative with O(1) space."

**Why this matters** — *Naming the generic O(n) LCA first — and then explaining how the BST property cuts it to O(h) — is the move. It proves you can solve the harder generic version and chose the BST shortcut deliberately. Interviewers love when you show the optimization is enabled by problem structure, not by cleverness.*

##### 3. Spot the pattern

> What signal in the problem points to descending toward the split point?

**What I'd say** — "The BST property gives us total ordering: every node 'partitions' its subtree into 'smaller on the left' and 'larger on the right'. For two target nodes p and q, exactly three things can happen at any node N during the descent:

(1) Both p.val < N.val and q.val < N.val → LCA is in N's left subtree (because both targets live there). Descend left.
(2) Both p.val > N.val and q.val > N.val → symmetric. Descend right.
(3) Otherwise — they split (one less, one greater), OR N equals one of them → N IS the LCA. Done.

Case (3) is the convergence: the moment p and q stop being on the same side of N is the moment N becomes their common ancestor with no deeper alternative. Iterative descent, O(h) time, O(1) space. This is fundamentally different from generic-tree LCA because BST ordering lets you pick ONE direction at each step instead of exploring both."

**Why this matters** — *The 'three cases' framing is the clean derivation. Saying 'the moment they stop being on the same side IS the LCA' is the key insight — it explains why the algorithm is correct, not just what it does. Naming 'descend toward the split point' as the technique distinguishes it from generic LCA, sliding-window two-pointers, or any other 'walk down the structure' pattern.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — a clean split at the root, a case where one target IS the ancestor of the other, and a deeper split.

**Worked examples**

- **Input:** `tree=[6,2,8,0,4,7,9,null,null,3,5], p=2, q=8` → **Output:** `6`
  *Note:* Clean split at root — 2 < 6 and 8 > 6, so the root is the LCA immediately.

  ```
  node=6: p=2, q=8 → 2 < 6 and 8 > 6 → split! return 6
  ```
- **Input:** `tree=[6,2,8,0,4,7,9,null,null,3,5], p=2, q=4` → **Output:** `2`
  *Note:* p is the ancestor of q — case where node equals one of the targets.

  ```
  node=6: p=2, q=4 → both < 6 → go left
  node=2: p=2, q=4 → 2 equals node.val (not both <, not both >) → return 2 (node IS the LCA because p is ancestor of q)
  ```
- **Input:** `tree=[6,2,8,0,4,7,9,null,null,3,5], p=3, q=5` → **Output:** `4`
  *Note:* Deep split — both targets in the left subtree, LCA is deeper than the root.

  ```
  node=6: p=3, q=5 → both < 6 → go left
  node=2: p=3, q=5 → both > 2 → go right
  node=4: p=3, q=5 → 3 < 4 and 5 > 4 → split! return 4
  ```

**Why this matters** — *The middle trace (p=2, q=4) is the load-bearing one — it exercises the 'node equals one of the targets' case that's easy to mis-handle. A careless implementation might check 'both <' and 'both >' and then recurse on a null when neither matches, never returning the current node. The third trace shows the LCA can be arbitrarily deep, not just the root — defends the O(h) bound by showing it can equal the tree height.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• p === q (same node) → LCA is that node itself; the first iteration hits the 'split' branch trivially because p.val and q.val are equal, neither both-less nor both-greater holds.
• p is an ancestor of q (or vice versa) → the descent reaches p, p.val is not both-less or both-greater than itself, so we return p. ✓
• p and q both at the root → root is the LCA, first iteration returns it.
• Left-skewed tree (effectively a linked list) → O(n) descent worst case. Same as the generic tree's worst case, but this is unavoidable — it's the tree's height.
• Both targets in the deepest level on opposite sides → LCA is somewhere mid-tree, descent goes through the path that splits them.
• Null tree → returns null. ✓
• p or q not in the tree → if guaranteed they exist (per the problem), no concern. If not, we'd walk off the tree and return null, which the loop's `while (node)` guard handles.
• Duplicates — by BST definition (strict) there shouldn't be any, but if the problem allows them, the descent strategy still works if you pick one consistent side for equals."

**Why this matters** — *The p-is-ancestor-of-q case is the one most candidates miss — they assume the LCA must be strictly above both targets, when actually a node can be its own ancestor by the problem's definition. Calling it out and showing the trace handles it correctly is the senior signal. The skewed-tree O(n) callout shows you know the worst-case isn't always O(log n) just because we're in a BST.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(h) — each iteration descends one level, and we descend at most h times before hitting the split point. For a balanced BST that's O(log n); for a skewed BST it's O(n). The descent never branches into both subtrees, which is the whole win over generic-tree LCA.

Space is O(1) for the iterative version — just one `node` pointer. The recursive version would be O(h) for the call stack, so I'd go iterative for symmetry with the O(1) win.

If the tree weren't a BST — just a generic binary tree — I'd switch to the recursive 'return both p and q from below' approach: if both subtrees return non-null, the current node is the LCA. That's LeetCode 236. Same problem family, different ordering assumption, much different algorithm.

And if you wanted to find the LCA of more than two nodes in a BST, the same descent works — keep descending while ALL targets are on the same side; the first split or hit is the LCA."

**Why this matters** — *The 'O(h) descent, never both subtrees' is the right defense — it explains WHY this is faster than generic LCA, not just that it is. The LCA-236 callout proves you see the family: BST-LCA and generic-LCA are distinct templates that share the LCA concept. The multi-target extension is unprompted bonus that demonstrates the descent strategy generalizes — a real signal of pattern understanding.*

---

#### Construct Tree from Preorder + Inorder

*Trees* · `p-construct-tree` — Preorder gives roots in order; inorder splits left/right around each root. Recurse on the two halves, indexing inorder with a Map for O(n).

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "So I have two arrays: `preorder` (root-left-right traversal) and `inorder` (left-root-right traversal) of the same binary tree, and I need to reconstruct the tree. Each preorder array starts with the root of the whole tree, and finding that root in inorder splits inorder into 'everything left of root' = left subtree's inorder, and 'everything right of root' = right subtree's inorder."

Then a few quick clarifying questions:
• Are all values guaranteed unique? (Critical — duplicates break the inorder-split-by-root approach.)
• Are the two arrays guaranteed to describe a valid tree (same length, same multiset of values)?
• What if both arrays are empty? Return null?
• Return the root node, right? Not a serialized form?

**Why this matters** — *The 'all values unique' question is THE precondition for this algorithm. With duplicates, looking up the root's index in inorder is ambiguous — which copy of the value is the actual root? The standard solution assumes uniqueness; flagging it shows you understand the algorithm's foundation, not just its mechanics. Without that assumption you'd need a different approach entirely (BFS-based or extra metadata).*

##### 2. Brute force first (out loud)

> Name the O(n²) version, then justify the O(n) hash-map upgrade.

**What I'd say** — "The natural recursive solution: take `preorder[0]` as the root. Find that root value in `inorder` — say at index `mid`. Then everything in `inorder[0..mid-1]` is the left subtree's inorder, and `inorder[mid+1..end]` is the right subtree's inorder. The corresponding slices of preorder are `preorder[1..mid]` for the left and `preorder[mid+1..end]` for the right.

Naively, finding `mid` in inorder is O(n) per call, and we make n recursive calls, giving O(n²) overall. Plus, slicing arrays each call allocates memory.

The optimization is two-pronged: (1) build a value→index Map from inorder up front, making the `mid` lookup O(1); (2) instead of slicing, pass (lo, hi) index ranges into the original inorder array, and use a single moving pointer `p` into preorder. Result: O(n) time, O(n) space for the map and recursion."

**Why this matters** — *Walking through the O(n²) version first — and naming both the lookup cost AND the slicing allocation — is the move. It justifies BOTH optimizations (Map and index ranges) as fixing specific identified problems, not as 'because the textbook says so.' Interviewers grade on whether you can name the cost source, then engineer past it.*

##### 3. Spot the pattern

> What signal in the problem points to this specific tree-recursion shape?

**What I'd say** — "There are really two interlocking insights. First, preorder is sequential: 'visit self, then ALL of left subtree, then ALL of right subtree.' Which means after I take preorder[0] as root, the very next preorder elements (in order) form the entire left subtree's preorder — and only after the whole left subtree is consumed does the right subtree's preorder begin. That's why a SINGLE moving pointer `p` works: I just consume preorder in order as I recurse.

Second, inorder is split-by-root: 'left subtree's inorder, then root, then right subtree's inorder.' So finding the root in inorder cleanly partitions the remaining inorder into the two subtrees.

Combine them: preorder names roots in left-first order; inorder tells me where each root splits its subtree. Recurse on the (lo, hi) sub-range of inorder, with `p` consuming preorder. That's the pattern — 'reconstruct via two traversals where one names roots and the other splits subtrees.'"

**Why this matters** — *Naming the two traversals' complementary properties — preorder gives roots in order, inorder gives the split — is the derivation. 'Use a hash map' alone is mechanics; 'left-first preorder consumption + inorder split point' is the insight. The fact that a single pointer `p` works is non-obvious; spelling out WHY (preorder visits all of left before any of right) earns serious credit.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — the classic balanced case, the single-node base case, and a left-skewed-ish tree.

**Worked examples**

- **Input:** `preorder=[3,9,20,15,7] inorder=[9,3,15,20,7]` → **Output:** `post-order [9,15,7,20,3]`
  *Note:* Classic — tree is 3 with left=9 (leaf) and right=20 (with children 15, 7).

  ```
  p=0, build(0, 4): val=preorder[0]=3, p=1, mid=idx.get(3)=1
    build(0, 0): val=preorder[1]=9, p=2, mid=0
      build(0, -1): lo>hi → null
      build(1, 0): lo>hi → null
      return node 9
    build(2, 4): val=preorder[2]=20, p=3, mid=3
      build(2, 2): val=preorder[3]=15, p=4, mid=2
        build(2, 1): null; build(3, 2): null
        return node 15
      build(4, 4): val=preorder[4]=7, p=5, mid=4
        build(4, 3): null; build(5, 4): null
        return node 7
      return node 20 with left=15, right=7
    return node 3 with left=9, right=20
  post-order of result: [9, 15, 7, 20, 3]
  ```
- **Input:** `preorder=[1] inorder=[1]` → **Output:** `post-order [1]`
  *Note:* Single node — recursive base case after one consumption.

  ```
  p=0, build(0, 0): val=preorder[0]=1, p=1, mid=0
    build(0, -1): lo>hi → null
    build(1, 0): lo>hi → null
    return node 1
  post-order: [1]
  ```
- **Input:** `preorder=[1,2,4,5,3] inorder=[4,2,5,1,3]` → **Output:** `post-order [4,5,2,3,1]`
  *Note:* Asymmetric — node 1 has left=2 (with children 4 and 5) and right=3 (leaf).

  ```
  p=0, build(0, 4): val=1, p=1, mid=3
    build(0, 2): val=2, p=2, mid=1
      build(0, 0): val=4, p=3, mid=0 → leaf 4
      build(2, 2): val=5, p=4, mid=2 → leaf 5
      return node 2 with left=4, right=5
    build(4, 4): val=3, p=5, mid=4 → leaf 3
    return node 1 with left=2, right=3
  post-order: [4, 5, 2, 3, 1]
  ```

**Why this matters** — *Watching `p` advance monotonically through preorder while the inorder window narrows is the visual proof that the algorithm works — it's not obvious that a single pointer suffices until you trace it. The asymmetric case (#3) is where the inorder-split logic becomes load-bearing: root 1 sits at inorder[3], so mid=3 cleanly partitions inorder into [4,2,5] (left subtree, length 3) and [3] (right subtree, length 1). If the lengths come out wrong, the recursion goes off the rails — tracing surfaces that immediately.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty arrays → first call is `build(0, -1)` which hits `lo > hi` and returns null. ✓
• Single node → `build(0, 0)`, consumes preorder[0], finds mid=0, both child calls hit `lo > hi`. ✓
• Left-skewed tree (all lefts) → mid is always at the END of the current inorder window; right subtree is always empty. Recursion depth = n.
• Right-skewed tree (all rights) → mid is always at the START of the current inorder window; left subtree is always empty. Recursion depth = n.
• Duplicate values → THE algorithm-breaking case. The map's value→index lookup becomes ambiguous; the algorithm assumes uniqueness. Worth flagging the precondition.
• Mismatched arrays (e.g. preorder and inorder don't describe the same tree) → would crash or produce a wrong tree; defensive programming would validate, but typically the problem promises valid inputs.
• Very deep tree → recursion-stack risk for skewed cases, same as any tree recursion."

**Why this matters** — *The duplicates callout is the senior signal — it names the algorithm's specific precondition and what breaks without it. Most candidates implement the algorithm assuming uniqueness implicitly; explicitly flagging the precondition demonstrates you understand which assumptions are load-bearing. The skewed-tree recursion depth is the standard tree-recursion concern — naming it shows you're aware of stack-overflow risk on adversarial inputs.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — each of n preorder elements is consumed exactly once via the moving pointer, and each recursive call does O(1) work given the hash-map lookup for mid. Without the map it would be O(n²) because the linear search for mid happens n times.

Space is O(n) — the map stores n entries, and the recursion stack is O(h) which is at most n for skewed trees. Both are bounded by n.

If you wanted to extend this to 'reconstruct from inorder + postorder' (LeetCode 106), it's the same skeleton but: postorder's LAST element is the root, and you consume postorder back-to-front. The right subtree is now what comes AFTER the root in postorder, so you build right BEFORE left in the recursion. Same template, mirrored consumption order.

If you wanted 'reconstruct from preorder + postorder' (LeetCode 889) — that's actually under-constrained for general binary trees because you can't always distinguish left from right; works only if you assume full binary trees (every node has 0 or 2 children)."

**Why this matters** — *The complexity defense — O(n) IFF the hash map is used, else O(n²) — is the right way to frame the optimization. The inorder+postorder extension is LeetCode 106 and shows you see this as a parameterized template. The preorder+postorder caveat (only works for full binary trees) is a subtle senior signal: most candidates assume all three combinations are equivalent, when in fact one of them is under-constrained. That's the kind of detail that distinguishes engineers who understand information content from those who memorize recipes.*

---

#### Kth Largest

*Heap* · `p-kth-largest` — Easy: sort descending and index k-1. Optimal interview answer: size-K min-heap → O(n log k). See the Implement Min-Heap lesson for the heap primitive.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this: I'm given `nums`, an array of integers, and `k`. I need to return the kth *largest* value — by `largest` you mean distinct rank or just positional rank? E.g. for `[3,3,3,2,1]` with k=2, do you want 3 (positional) or 2 (distinct)?"

Then a few quick clarifying questions:
• Is `k` guaranteed in range — `1 <= k <= nums.length`?
• Can `nums` contain duplicates? Negatives?
• Is `nums` mutable — am I allowed to sort it in place?
• How big is `n`? And how big is `k` relative to `n`? — this decides between sort, heap, and quickselect.

**Why this matters** — *The duplicates-counted-positionally question is the one most candidates skip and most interviewers care about — the standard LeetCode contract is positional (`[3,3,3,2,1]` k=2 returns 3, not 2), but real interviewers will flip the question to see if you noticed. The `k` vs `n` question is the load-bearing one for the optimization: if k is tiny (say k=10 in a stream of a million), a size-k heap beats sort by orders of magnitude; if k ≈ n/2, sort is just as good and simpler.*

##### 2. Brute force first (out loud)

> Name the obvious O(n log n) baseline before reaching for the heap.

**What I'd say** — "The straightforward solution is just: sort the array in descending order and return `nums[k - 1]`. Two-line solution — `nums.sort((a, b) => b - a); return nums[k - 1];`. Time is O(n log n) from the sort, space is O(1) extra if we sort in place. That's actually a perfectly reasonable answer for most inputs.

The catch: sorting throws away work. To find the *kth* largest we're computing a full ordering when we only needed partial-order information about the top k. If k is small and n is huge — think 'top 10 trending posts out of a million events' — we're paying O(n log n) when we could pay O(n log k)."

**Why this matters** — *Two reasons to name the sort answer out loud, even though everyone knows you'll reach for the heap. First, it shows you wouldn't over-engineer for a small dataset — staff-level signal. Second, it sets up the optimization as a *targeted* improvement (we only need partial order over the top k) rather than a magic trick. The 'top 10 out of a million' phrasing also surfaces the streaming framing without you having to introduce it artificially.*

##### 3. Spot the pattern

> What signal in the problem points to a size-k min-heap?

**What I'd say** — "Three signals together point straight at heap. First, I only care about the top k elements — the rest are irrelevant. Second, I want to discard the *smallest of the top-k-so-far* every time a new candidate beats it — that's exactly what a min-heap of size k gives you in O(log k). Third, this generalizes naturally to a stream: I never need to see all of `nums` at once.

"So: walk the array. Push every value. If the heap exceeds size k, pop. After the pass, the heap holds the top k elements, and its root — the *smallest* of those top k — is by definition the kth largest. The min-heap-of-size-k for kth-largest feels backwards the first time you see it (why min for largest?), but once you internalize 'root = the worst of the keepers,' the rest falls into place."

**Why this matters** — *Naming the structural property — 'I want to discard the smallest of the keepers' — is what distinguishes derivation from memorization. If the question were 'kth smallest,' you'd flip to a *max*-heap of size k for the same reason. If it were 'top k frequent,' you'd key the heap by frequency. The pattern isn't 'heap'; it's 'size-k heap of opposite type to the rank we want.' That generalization is what the interviewer is grading on.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple to lock the model in." Three cases — the textbook input, a duplicate-heavy case where positional vs distinct could trip a candidate, and the degenerate single-element case. I'll trace the *sort-and-index* approach since that's what the canonical does, but I'll note where the heap diverges.

**Worked examples**

- **Input:** `[3,2,1,5,6,4] k=2` → **Output:** `5`
  *Note:* Textbook case — sort descending, pick index 1.

  ```
  before sort: [3,2,1,5,6,4]
  sort((a,b) => b - a) → [6,5,4,3,2,1]
  k-1 = 1
  nums[1] = 5 ✓
  
  (heap version: push all 6, pop down to size 2 → heap holds {5,6}, root=5 = kth largest)
  ```
- **Input:** `[3,2,3,1,2,4,5,5,6] k=4` → **Output:** `4`
  *Note:* Duplicates — positional rank, not distinct. The two 5s are the 2nd and 3rd largest.

  ```
  before sort: [3,2,3,1,2,4,5,5,6]
  sort((a,b) => b - a) → [6,5,5,4,3,3,2,2,1]
  k-1 = 3
  nums[3] = 4 ✓
  
  Note: 6 is 1st, 5 is 2nd, 5 is 3rd, 4 is 4th — duplicates DO count separately. If the interviewer wanted distinct ranks, the answer would shift.
  ```
- **Input:** `[1] k=1` → **Output:** `1`
  *Note:* Degenerate — single element, k=1.

  ```
  before sort: [1]
  sort((a,b) => b - a) → [1]
  k-1 = 0
  nums[0] = 1 ✓
  ```

**Why this matters** — *The middle trace is the one to call out — it's the case where 'kth largest' vs 'kth distinct largest' diverges. If you trace this and pause to say 'so duplicates count positionally — confirm that's what you wanted?' you get bonus points for catching the spec edge mid-solution. The single-element case defends both the off-by-one (`k-1` not `k`) and the no-special-case property of the sort approach.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Edges worth flagging:
• k = 1 → kth largest is just the max. Both approaches handle it; the heap version becomes a single-slot max-tracker.
• k = n → kth largest is just the min. Both still work; the heap holds the whole array.
• Duplicates that span the k-boundary → as in the trace, positional rank is the standard contract — worth confirming with the interviewer.
• Negative numbers → no special-case logic; `b - a` comparator works for negatives just fine.
• Empty array or k > n → typically violates the contract, but a defensive guard at the top is cheap insurance.
• Bare `.sort()` without a comparator → silently wrong for numbers: `[10, 2].sort()` gives `[10, 2]` because of string coercion. Numeric comparator is mandatory."

**Why this matters** — *The bare-`.sort()` trap is the one that catches even experienced JS engineers off-guard — JS made the unusual choice to default to lexicographic, and if you forget the comparator, your `[10, 2, 100]` sorts to `[10, 100, 2]` and your kth-largest is silently wrong. Calling it out unprompted signals you've been burned by it before, which is exactly the senior-tier signal. The k=1 / k=n edges defend that the approach degrades gracefully at both extremes.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim and bring up the optimal answer?

**What I'd say** — "Sort approach: O(n log n) time, O(1) extra space if we sort in place (V8's Timsort is in-place-ish; some engines allocate O(n) temporaries — worth flagging if asked).

"The min-heap-of-size-k upgrade: walk the n elements; for each, push (O(log k)) and possibly pop (O(log k)). Total time O(n log k), space O(k). When k = n that degrades to O(n log n) — same as sort — but when k is small relative to n, you've turned a `log n` factor into a `log k` factor. For k=10 and n=1e6, that's roughly 4x faster.

"And the staff-level answer is quickselect — O(n) expected time, O(n²) worst case if the pivot is adversarial. Median-of-medians pivot makes it O(n) worst case but the constants are bad. I usually mention quickselect exists and let the interviewer choose whether to go down that rabbit hole."

**Why this matters** — *The 'mention all three, defend the one you implemented, name the staff-level option' arc is what wins this question. Most candidates either ship the sort and stop, or jump straight to quickselect and get tangled in the partition code under pressure. Showing the *spectrum* — sort, heap, quickselect — and articulating WHEN each one wins (full sort fine; k << n use heap; absolutely huge n with adversarial inputs use quickselect) is the signal the interviewer is looking for. The 'log n → log k' framing makes the heap win feel earned.*

---

#### Top K Frequent

*Heap* · `p-top-k-frequent` — Count frequencies in a Map, then keep the K most frequent. Sort + slice is the readable baseline; a size-K min-heap is the O(n log k) upgrade.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me restate: given `nums` and integer `k`, return the k most frequent *values* — not the indices, the actual values. Quick checks:"

• Is `k` guaranteed in range — `1 <= k <= number_of_distinct_values`?
• Does the output order matter? Most contracts say 'any order'; I'll confirm.
• Ties — if two values have the same frequency, is there a tiebreaker (smaller value first? insertion order?), or can I pick either?
• How big is `n`, and how many distinct values relative to `n`? — this affects which optimization wins.

**Why this matters** — *The tie-breaking question is the one most candidates skip and most interviewers care about — if the contract is 'any order,' your sort-by-count is correct; if the contract is 'ties broken by value,' you need a two-key comparator. The 'distinct values vs n' question matters because bucket sort wins when frequencies are dense (frequencies bounded by n), but pays a memory tax when the distinct set is sparse — knowing the shape of the data picks the optimal.*

##### 2. Brute force first (out loud)

> Name the obvious approaches before reaching for the heap.

**What I'd say** — "The dumbest version: for each distinct value, scan the whole array to count it — O(n²) for the counts alone, then sort the distinct values by count. Obviously bad; we'd never ship this.

"The straightforward version: one O(n) pass to build a frequency Map (value → count), then sort the entries by count descending and slice the first k. That's O(n) for counting plus O(d log d) for sorting d distinct entries — total O(n log n) in the worst case where every value is distinct. That's the readable baseline and it's what I'd write first.

"The catch: same as kth-largest — we're sorting all d distinct values when we only need partial order over the top k. If d is huge and k is small, we're wasting work."

**Why this matters** — *The double-pass-count version (O(n²)) is worth mentioning briefly to show you wouldn't do it — interviewers occasionally test whether you reach for nested loops out of habit. The sort-and-slice version is the *honest* baseline: it's the answer most engineers would actually ship in production code, and it's a fine answer for an interview. Setting it up as 'readable baseline, here's the optimization' makes the heap upgrade feel like a deliberate refinement rather than a flex.*

##### 3. Spot the pattern

> Why heap (and why bucket sort might beat it)?

**What I'd say** — "Two viable optimizations once we have the frequency Map. First, a *size-k min-heap keyed by frequency* — same logic as kth-largest: walk the d entries, push each, pop when the heap exceeds size k. After the pass, the heap holds the k entries with the highest frequencies. Time becomes O(d log k), space O(k). When k << d, this is a real win.

"Second, *bucket sort by frequency* — and this is the slicker trick for this specific problem. Frequencies are bounded: no value can appear more than n times. So we can build an array `buckets` of length n+1 where `buckets[f]` is the list of values that appeared exactly f times. Walking from `buckets[n]` down to `buckets[1]` collects the most-frequent values first, and we stop once we have k. That's O(n) total — linear, not log-linear. The cost is O(n) extra memory for the bucket array, but each bucket is usually sparse, so the real working set is small.

"For this problem I'd offer both — the heap is the textbook 'heap section' answer, but bucket sort is the asymptotically best answer because we're exploiting a *bound* on the values being sorted (frequencies ≤ n). That kind of structural exploit is what wins the bonus points."

**Why this matters** — *Naming WHY bucket sort applies here — 'frequencies are bounded by n' — is what distinguishes derivation from memorization. Bucket sort isn't a general technique; it specifically works when the keys you're sorting have a small, known range. That's the case here (and in counting sort, radix sort, etc.). If the interviewer were to ask 'sort these arbitrary doubles by some property,' bucket sort wouldn't apply, and the answer would degrade back to the heap. Spelling out the precondition is the move.*

##### 4. Trace through examples

> Walk a few inputs to confirm the count-and-sort model.

"Let me trace through a few cases to confirm the model." Three inputs cover the standard mix-with-ties case, the degenerate single-value case, and an input with negatives to confirm the Map handles them.

**Worked examples**

- **Input:** `nums=[1,1,1,2,2,3], k=2` → **Output:** `[1, 2]`
  *Note:* Textbook case — clear frequency ranking, no ties at the cutoff.

  ```
  count pass: 1→1, 1→2, 1→3, 2→1, 2→2, 3→1
  final count = Map { 1=>3, 2=>2, 3=>1 }
  entries = [[1,3], [2,2], [3,1]]
  sort desc by [1]: [[1,3], [2,2], [3,1]] (already sorted)
  slice(0, 2): [[1,3], [2,2]]
  map → keys: [1, 2] ✓
  ```
- **Input:** `nums=[1], k=1` → **Output:** `[1]`
  *Note:* Degenerate — single element, k=1.

  ```
  count pass: 1→1
  final count = Map { 1=>1 }
  entries = [[1,1]]
  sort: [[1,1]]
  slice(0, 1): [[1,1]]
  map → keys: [1] ✓
  ```
- **Input:** `nums=[4,1,-1,2,-1,2,3], k=2` → **Output:** `[-1, 2]`
  *Note:* Negatives + tie at frequency 2. Either [-1,2] or [2,-1] is correct under 'any order'; Map insertion order makes -1 come first since it was inserted earlier.

  ```
  count pass: 4→1, 1→1, -1→1, 2→1, -1→2, 2→2, 3→1
  final count = Map { 4=>1, 1=>1, -1=>2, 2=>2, 3=>1 }
  entries = [[4,1], [1,1], [-1,2], [2,2], [3,1]]
  sort desc by [1]: [[-1,2], [2,2], [4,1], [1,1], [3,1]]
    (V8's sort is stable since 2019, so -1 stays before 2 — they tied at count 2 and -1 came first in entries)
  slice(0, 2): [[-1,2], [2,2]]
  map → keys: [-1, 2] ✓
  ```

**Why this matters** — *The third trace is the load-bearing one — it surfaces *two* subtle behaviors: (1) Map.entries() preserves insertion order, which (2) combined with V8's stable sort means ties are broken by first-seen-in-the-input order. If the contract demanded a different tiebreaker (smaller value first, larger first, whatever), you'd add a secondary sort key. The fact that 'sort by count descending' happens to give a *deterministic* answer here is a happy accident of stability; calling it out shows you understand the mechanism rather than getting lucky.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Edges worth flagging:
• k = 1 → return the single most-frequent value. Trivial; both approaches handle it.
• k = number_of_distinct → return every distinct value. Sort version is fine; heap version's keep-only-k constraint becomes a no-op.
• Ties at the k boundary → if frequencies 3,3,2,2 and k=3, the third spot is ambiguous between the two 2-counts. Either is correct under 'any order'; specify a tiebreaker if the contract demands one.
• Negative numbers / zero → handled — Map keys accept any value. (`{}` would coerce to strings; Map preserves type, which is why we use it.)
• Empty array → either return `[]` or rely on `slice(0, k)` of an empty entries array (which is `[]`). Defensive but the math degrades correctly.
• Floating-point keys → Map handles equality on `===`, so `0.1 + 0.2` would key separately from `0.3`. Worth flagging if floats are in play."

**Why this matters** — *The Map-vs-object distinction is the senior-tier callout — most candidates reach for `{}` reflexively, which coerces numeric keys to strings (`{1: 1}` and `{'1': 1}` are the same key). For an array of numbers, that's silently wrong if you later iterate and expect numeric keys back. The floating-point edge is the deepest cut: if the input could contain repeated computed floats, you'd need to normalize. Most candidates miss it entirely.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim and rank the three approaches?

**What I'd say** — "Three approaches, three complexity profiles:

• Sort-and-slice (the canonical): O(n) for counting + O(d log d) for sort = O(n log n) worst case (d ≤ n). Space O(d) for the Map. This is what I'd ship for general use.

• Size-k min-heap keyed by frequency: O(n) counting + O(d log k) heap ops = O(n + d log k). Space O(k). Wins when k << d — the typical 'top 10 trending out of millions' case.

• Bucket sort: O(n) counting + O(n) bucket build + O(n) walk = O(n) total. Space O(n) for the bucket array, mostly empty. Wins asymptotically because we exploit the bound 'frequency ≤ n.'

"The amortization defense for bucket sort is the prettiest of the three: each value contributes once to the count Map and lands in exactly one bucket. The walk from `buckets[n]` down to `buckets[1]` visits each bucket once, and the total number of values across all buckets is exactly d ≤ n. So the sum of work is O(n) — no log factor, period.

"If you wanted me to extend this: 'top k frequent *words*' is the same problem with string keys; 'top k frequent in a stream' is where the heap dominates because you can't bucket-sort an unbounded stream. The pattern — count-then-rank — generalizes anywhere you need partial order by frequency."

**Why this matters** — *Offering all three approaches with their precondition for winning ('heap when k<<d, bucket when frequencies are bounded, sort otherwise') is what proves you see this as a *family* of problems, not a single answer. The bucket-sort amortization argument is the cleanest one to articulate: 'every element pays O(1) into a bucket, the walk visits every bucket once, total work is bounded by 2n.' That's the form of argument an interviewer wants to hear — concrete pay-per-element accounting, no hand-waving.*

---

#### Merge Intervals

*Intervals* · `p-merge-intervals` — Sort by start, then sweep once: extend the last merged interval if the next overlaps; otherwise start a new one. O(n log n) sort + O(n) sweep.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: I'm given a list of intervals like `[[1,3],[2,6],[8,10]]`, and I need to merge any that overlap and return the resulting list. So `[1,3]` and `[2,6]` would collapse into `[1,6]`."

Then a few quick clarifying questions:
• Is the input sorted? (Almost always no — that's the first move.)
• Do touching intervals like `[1,4]` and `[4,5]` count as overlapping, or strictly disjoint? (Changes one operator: `<=` vs `<`.)
• Can I mutate the input array by sorting in place, or do I need to copy first?
• Are intervals always `[start, end]` with `start <= end`, or can they be reversed/empty?
• Return shape — array of arrays, sorted by start in the output?

**Why this matters** — *The touching-vs-strict question is the load-bearing clarification — it flips one comparator and silently changes the result on test cases like `[[1,4],[4,5]]`. Asking it up front signals you've already mapped the failure modes. The mutation question is the senior tell: sorting is the first move, and a real engineer asks before mutating someone else's array.*

##### 2. Brute force first (out loud)

> Name the obvious O(n^2) solution before you discard it.

**What I'd say** — "The brute force is to repeatedly scan the list for any pair that overlaps and merge them in place, repeating until no merges happen. Each pass is O(n^2) on the pair check, and you could need up to n passes in the worst case — so O(n^3) ugly. Even a cleaner version that does one O(n^2) all-pairs sweep into a union-find or set is still quadratic. Let me see if I can avoid the all-pairs check by imposing some order first."

**Why this matters** — *Two reasons to narrate this. (1) It anchors O(n log n) as a clean win — you're not just shaving a constant, you're collapsing a quadratic. (2) It plants the seed for sorting: the brute force is expensive because it has to check every pair to find overlaps. If you could guarantee that an interval only ever overlaps with the run immediately before it, you'd never need that pair check.*

##### 3. Spot the pattern

> What signal in the problem points to sort-then-sweep?

**What I'd say** — "Two things scream sort-then-sweep here. (1) The problem is fundamentally about *order* — two intervals can only overlap if one starts before the other ends. (2) After sorting by start, the structure collapses to a single sweep: if `cur.start <= last.end` they overlap and I extend `last.end`; otherwise `cur` is the start of a new disjoint run, push it. The key invariant is that once I see a non-overlap, I *never* have to look back. Because the array is sorted by start, every future interval has a start ≥ `cur.start`, so it can't reach back across the gap into the previous run. That's what makes one pass sufficient.

The Math.max on the end is the one subtlety — `cur` might be fully contained in `last` (like `[1,4]` then `[2,3]`), in which case I must not shrink the run by overwriting `last.end` with the smaller value."

**Why this matters** — *Pattern-naming alone is a guess. The derivation — sorting buys you a no-look-back invariant, and the sweep maintains it in one pass — is what scores. The 'no need to look back after a non-overlap' insight is the load-bearing one; it's why this is O(n) sweep and not O(n^2), and naming it explicitly shows you understand *why* the algorithm is correct, not just that it works on the examples.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — a canonical mix with multiple merges, a touching-endpoints case that exercises the `<=`, and a contained case that exercises the Math.max.

**Worked examples**

- **Input:** `[[1,3],[2,6],[8,10],[15,18]]` → **Output:** `[[1,6],[8,10],[15,18]]`
  *Note:* Canonical case — one merge, then two disjoint runs.

  ```
  sort → [[1,3],[2,6],[8,10],[15,18]] (already sorted)
  seed res = [[1,3]]
  i=1 cur=[2,6], last=[1,3] → 2 <= 3 → OVERLAP. last[1] = max(3,6) = 6 → res=[[1,6]]
  i=2 cur=[8,10], last=[1,6] → 8 > 6 → DISJOINT. push → res=[[1,6],[8,10]]
  i=3 cur=[15,18], last=[8,10] → 15 > 10 → DISJOINT. push → res=[[1,6],[8,10],[15,18]]
  return [[1,6],[8,10],[15,18]]
  ```
- **Input:** `[[1,4],[4,5]]` → **Output:** `[[1,5]]`
  *Note:* Touching endpoints — exercises the `<=` decision; `<` would split these wrongly.

  ```
  sort → [[1,4],[4,5]] (already sorted)
  seed res = [[1,4]]
  i=1 cur=[4,5], last=[1,4] → 4 <= 4 → OVERLAP (touching counts). last[1] = max(4,5) = 5 → res=[[1,5]]
  return [[1,5]]
  ```
- **Input:** `[[1,4],[2,3]]` → **Output:** `[[1,4]]`
  *Note:* Contained case — exercises the Math.max; without it last.end would shrink from 4 to 3.

  ```
  sort → [[1,4],[2,3]] (already sorted by start)
  seed res = [[1,4]]
  i=1 cur=[2,3], last=[1,4] → 2 <= 4 → OVERLAP. last[1] = max(4,3) = 4 (NOT 3) → res=[[1,4]]
  return [[1,4]]
  ```

**Why this matters** — *Two specific bugs the trace exposes. (1) On `[[1,4],[2,3]]`, a naive `last[1] = cur[1]` would corrupt the run to `[1,3]` — the Math.max is what keeps the run honest when `cur` is fully contained. (2) On `[[1,4],[4,5]]`, the `<=` vs `<` choice flips the entire output; tracing forces you to commit to one and confirm against the spec before writing the loop.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty input `[]` → guard up front, return `[]`. The seed `res = [intervals[0]]` would crash without this.
• Single interval `[[1,2]]` → seed sets `res = [[1,2]]`, loop runs zero times, returns `[[1,2]]`. ✓
• All identical `[[1,5],[1,5],[1,5]]` → each subsequent one overlaps and Math.max keeps last.end at 5. Returns `[[1,5]]`.
• Fully nested `[[1,10],[2,3],[4,5]]` → after sort, every later interval is contained in the first; Math.max keeps the run at `[1,10]`.
• Already disjoint and sorted `[[1,2],[3,4],[5,6]]` → never overlaps, every iteration pushes; returns the input.
• Reverse-sorted input `[[15,18],[8,10],[1,6]]` → the sort fixes it; the sweep never sees the original order.
• Negative coordinates, zero-width intervals like `[[3,3]]` — the comparators all still work; no special case needed."

**Why this matters** — *The empty-input guard is the cheap obvious one but it's also the most common skipped check — `res = [intervals[0]]` crashes silently as `res = [undefined]` and the loop never errors, just returns garbage. Naming the fully-nested case explicitly is the dedup callout that proves the Math.max is doing real work, not decoration.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n log n), dominated entirely by the sort. The sweep itself is O(n) — one pass, constant work per element. Space is O(n) for the result array (in the worst case, no merges happen and `res` ends up the same size as `intervals`). The sort is in-place so it contributes O(log n) stack overhead for V8's quicksort, which I'd mention but it's not the bottleneck.

If you wanted to handle a stream of intervals arriving one at a time instead of a batch, you'd swap this for a sorted-set structure keyed by start, find the insertion point with binary search, and merge against neighbors — O(log n) per insert. That's the Insert Interval / Calendar Booking variant."

**Why this matters** — *The 'sort dominates' answer is the correct framing — most candidates state O(n log n) without naming *which step* drives it, which leaves them stuck when the interviewer asks 'what if the input came in pre-sorted?'. The streaming extension proves you see the family of problems: Insert Interval, My Calendar I/II, Range Module are all the same shape with different freshness assumptions.*

---

#### Meeting Rooms II

*Intervals* · `p-meeting-rooms-ii` — Minimum rooms = max simultaneous meetings. Sort starts and ends separately, then sweep with two pointers — a meeting reuses a room iff its start is at or after the next ending. O(n log n).

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: given a list of meeting intervals like `[[0,30],[5,10],[15,20]]`, return the minimum number of conference rooms needed to host them all. So if two meetings overlap in time they need separate rooms, but if one ends before the next starts they can share."

Then a few quick clarifying questions:
• Is the input sorted in any way? (Almost certainly not — that's the first move.)
• Touching meetings — if one ends at 10 and the next starts at 10, can they share a room? (Convention says yes; that flips strict `<` vs `<=`.)
• Are start and end always integers, with `start < end`? Any zero-length meetings?
• Should the answer be the *peak* concurrency at any moment, or some weekly total? (Peak — that's what 'minimum rooms' means.)
• Can the input be empty? Return 0?

**Why this matters** — *The 'touching reuses' clarification is the load-bearing one — it's the difference between a room count of `n` and a much smaller number on stacked schedules. The reframe from 'minimum rooms' to 'peak concurrency' is the key conceptual unlock; getting the interviewer to nod at that reframe means you've already solved the hard part of the problem.*

##### 2. Brute force first (out loud)

> Name the obvious O(n^2) (or worse) solution before you discard it.

**What I'd say** — "The brute force is to walk every integer time point and count how many intervals contain it, then take the max. That's O(n * range) which is awful if times are large. A tighter brute force: for each interval, count how many others overlap it, but that's still O(n^2). The real reframe is to stop thinking about rooms and start thinking about *events* on a timeline — every start is a +1 to concurrency, every end is a -1. The answer is the peak running sum. Let me see if I can compute that without scanning every time point."

**Why this matters** — *Two reasons to narrate this. (1) The event-stream reframe is the entire algorithmic insight — once you see meetings as +1/-1 events sorted in time, the problem becomes 'find the peak prefix-sum of a sequence', which is trivially O(n) after a sort. (2) Talking through the time-point scan first makes it obvious *why* you don't need it: only the moments where the running count changes (the actual start/end times) matter.*

##### 3. Spot the pattern

> Why decouple starts and ends, and why does the sweep work?

**What I'd say** — "Two equivalent solutions both unlocked by sorting.

**Approach A (the one I'll code) — two-pointer sweep on decoupled events.** I split the intervals into two arrays: all starts and all ends. Sort each independently. Then walk the starts with pointer `s` while a second pointer `e` tracks the next end. For each start, if `starts[s] < ends[e]` then a new meeting begins before any current one ends — increment `used`, update `rooms = max(rooms, used)`. Otherwise some prior meeting has ended (or touches), so we can reuse its room — advance `e`. The output `rooms` is the peak `used` ever reached.

The weird part is that I sort starts and ends *independently* — pairing is irrelevant. That works because I don't care *which* meeting freed the room, only that *a* room was freed by *some* prior meeting. The pairing back to specific intervals doesn't affect concurrency.

**Approach B — min-heap of end times.** Sort meetings by start. Walk through them; for each new meeting, peek the heap-top (smallest end). If `meeting.start >= heap.top` the earliest-ending meeting has freed its room, so pop and push the new end (reuse). Otherwise push the new end without popping (new room). Final answer is `heap.size`. Same O(n log n), more intuitive to some interviewers because each room is an explicit heap entry with its current end time.

Both use sort to put events in time order; both maintain a single piece of state (the next ending). The two-pointer version is cleaner code; the heap version generalizes more naturally to variants (e.g., 'which room did each meeting go in?')."

**Why this matters** — *Sorting is what reduces this to a one-pass scan — without it you'd be doing all-pairs comparisons forever. The independent-sort insight in approach A is the part most candidates miss; saying 'pairing is irrelevant, only the timeline matters' explicitly is what separates a coached answer from a derived one. Naming both approaches and the tradeoff (cleaner code vs. easier to generalize) shows you've actually thought about the family of solutions, not just memorized one.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — a canonical mix where rooms are reused, a touching-endpoints case that exercises the strict `<`, and a fully-concurrent case where no reuse is possible.

**Worked examples**

- **Input:** `[[0,30],[5,10],[15,20]]` → **Output:** `2`
  *Note:* Canonical case — meeting [5,10] ends before [15,20] starts, so room 2 gets reused.

  ```
  starts sorted = [0, 5, 15]
  ends   sorted = [10, 20, 30]
  init rooms=0, used=0, e=0
  s=0: starts[0]=0 < ends[0]=10 → new room. used=1, rooms=max(0,1)=1
  s=1: starts[1]=5 < ends[0]=10 → new room. used=2, rooms=max(1,2)=2
  s=2: starts[2]=15 >= ends[0]=10 → reuse. e=1 (used stays at 2)
  loop ends
  return 2
  ```
- **Input:** `[[7,10],[2,4]]` → **Output:** `1`
  *Note:* Touching case — [2,4] ends at 4, then [7,10] starts at 7. Strict `<` lets the room be reused even though they don't actually touch.

  ```
  starts sorted = [2, 7]
  ends   sorted = [4, 10]
  init rooms=0, used=0, e=0
  s=0: starts[0]=2 < ends[0]=4 → new room. used=1, rooms=max(0,1)=1
  s=1: starts[1]=7 >= ends[0]=4 → reuse. e=1 (used stays at 1)
  loop ends
  return 1
  ```
- **Input:** `[[1,5],[2,6],[3,7]]` → **Output:** `3`
  *Note:* All concurrent — every meeting starts before any has ended; no reuse possible.

  ```
  starts sorted = [1, 2, 3]
  ends   sorted = [5, 6, 7]
  init rooms=0, used=0, e=0
  s=0: starts[0]=1 < ends[0]=5 → new room. used=1, rooms=1
  s=1: starts[1]=2 < ends[0]=5 → new room. used=2, rooms=2
  s=2: starts[2]=3 < ends[0]=5 → new room. used=3, rooms=3
  loop ends
  return 3
  ```

**Why this matters** — *Two specific things the trace exposes. (1) Notice that `used` never decrements — it only grows on a 'new room' path. That's fine because we only care about the *peak*, and decrementing on reuse would just be bookkeeping that doesn't affect the answer. (2) On `[[7,10],[2,4]]`, watch the `>=` save us — if we used `>` instead, two meetings that just touch (one ending exactly when another starts) would falsely be counted as concurrent. The strict-vs-non-strict pick is the single most common bug in this problem.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty input `[]` → guard at the top, return 0. Without the guard, sort and loop still run safely but the up-front check is cleaner.
• Single meeting `[[1,5]]` → starts=[1], ends=[5], loop runs once, used=1, rooms=1. ✓
• All non-overlapping `[[1,2],[3,4],[5,6]]` → each new start finds the next end already past, so we just advance `e` and used stays at 1. Returns 1.
• All identical `[[5,10],[5,10],[5,10]]` → all starts at 5, all ends at 10. starts[0]=5 < ends[0]=10 → +1. starts[1]=5 < ends[0]=10 → +1. starts[2]=5 < ends[0]=10 → +1. Returns 3.
• Touching back-to-back `[[1,5],[5,10],[10,15]]` → starts=[1,5,10], ends=[5,10,15]. Each subsequent start equals the prior end → reused. Returns 1.
• Zero-length meeting `[[5,5]]` → starts=[5], ends=[5]. starts[0]=5 < ends[0]=5? No → e=1. Loop ends with used=0, rooms=0. Hm — that's probably wrong; a zero-length meeting still arguably needs a room. I'd flag this and ask the interviewer.
• Very large schedules — sort is O(n log n) on whatever n is; nothing pathological."

**Why this matters** — *The zero-length edge is the kind of question the interviewer might not have considered themselves — surfacing it shows you're stress-testing your own model, not just running the canonical examples. The touching-back-to-back case is a great sanity check that the strict `<` is doing what we want; a single conference room can host a back-to-back schedule with no overlap, and the algorithm returns 1 to confirm.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n log n), dominated by the two sorts (sorting starts and sorting ends). The sweep itself is O(n) — pointer `s` advances n times in the outer loop, and pointer `e` advances at most n times total across all iterations, so the inner work is O(n) amortized. Space is O(n) for the two extracted arrays.

The min-heap variant is also O(n log n) — n insertions/pop-pushes, each O(log n). Same asymptotic class, different constant factor; the two-pointer version usually wins on practical benchmarks because comparisons on a pre-sorted array beat heap operations.

If you wanted to extend this to 'return the actual assignment of meeting → room', the min-heap version is cleaner: each heap entry can carry a room ID, and when you pop you reassign the room to the new meeting. The two-pointer version loses that info because it decouples starts from ends."

**Why this matters** — *Naming the amortization on `e` is the right defense against 'isn't there a hidden inner loop?' — `e` is a single pointer that only advances, so its total work across the whole algorithm is bounded by n. The 'which version to pick' tradeoff at the end is what proves you understand both approaches as members of the same family, not as competing memorized recipes. Calling out the room-ID extension is the bonus that shows you can adapt the choice to downstream requirements.*

---

#### Insert Interval

*Intervals* · `p-insert-interval` — Insert a new interval into a sorted, non-overlapping list and re-merge. Single pass in three phases: before, overlapping, after. O(n).

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: I'm given a list of intervals that's already sorted by start and has no overlaps. I'm also given a single `newInterval`, and I need to insert it and re-merge anything it touches. So inserting `[2,5]` into `[[1,3],[6,9]]` gives `[[1,5],[6,9]]`."

Then a few quick clarifying questions:
• Is the input *guaranteed* sorted and non-overlapping, or do I need to defend against unsorted input? (Spec says yes; that's the whole point of the problem.)
• Touching counts as overlap, right? Inserting `[5,7]` into `[[1,5]]` should give `[[1,7]]`, not `[[1,5],[5,7]]`?
• Can `newInterval` fall entirely before all existing intervals, entirely after, or completely engulf the whole list?
• Can I mutate `newInterval` in place, or do I need to copy it first?
• Return shape — fresh array of arrays, or modify input?

**Why this matters** — *The 'already sorted' invariant is the entire reason this runs in O(n) instead of O(n log n) — surfacing it explicitly tells the interviewer you know what affordance the problem is handing you. The engulf and before-everything cases are the corner cases that make the three-phase structure necessary; flagging them up front shows you've already mapped why a single while loop won't work.*

##### 2. Brute force first (out loud)

> Name the obvious O(n log n) solution before you discard it.

**What I'd say** — "The dumb-but-correct approach is to push `newInterval` onto the list, sort by start, then run the standard Merge Intervals sweep on top. That's O(n log n) — the sort dominates. It works, but it throws away the sortedness gift the problem already gave me. Let me see if I can walk the list once and exploit the order."

**Why this matters** — *Two reasons to narrate this. (1) It's a genuine fallback — if the candidate runs out of time on the three-phase walk, they can fall back to sort-then-merge and still be correct. (2) It anchors the optimization target: getting from O(n log n) to O(n) means *not re-sorting*. The optimization isn't a clever algorithm — it's a structural one, exploiting the input invariant.*

##### 3. Spot the pattern

> Why a single sweep, but in three phases?

**What I'd say** — "The input is already sorted and non-overlapping, so I don't need to sort — that's the whole affordance. But unlike Merge Intervals, I can't just run one sweep with one rule, because `newInterval` partitions the list into three distinct regions: intervals that end *before* `newInterval` starts (untouched, pass through), intervals that *overlap* with `newInterval` (collapse into a single merged interval), and intervals that start *after* `newInterval` ends (untouched, pass through). Three regions → three while loops.

The pivot is the overlap test. Phase 1 condition: `intervals[i][1] < newInterval[0]` — strict `<` because touching at the endpoint should merge. Phase 2 condition: `intervals[i][0] <= newInterval[1]` — `<=` because touching merges. During phase 2 I expand `newInterval` itself by taking `Math.min` of starts and `Math.max` of ends, which is what lets me handle the case where `newInterval` engulfs several existing intervals. After phase 2 I push the now-grown `newInterval` once. Phase 3 is just 'drain the rest'.

The reason this is O(n), not O(n^2), is that each phase advances `i` monotonically — once a phase exits, we never re-examine its intervals. Each interval is touched at most once across the whole algorithm."

**Why this matters** — *The three-phase framing is the whole derivation — without it, candidates write one giant while loop with three nested conditions and get lost. Naming the strict `<` vs `<=` distinction explicitly is the senior touch; those two operators encode the touching-is-overlap rule and getting them wrong silently produces wrong answers on `[[1,3]] + [3,5]`. The 'each interval touched at most once' line is the O(n) defense in advance.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — a simple two-element merge, a multi-interval engulf that exercises phase 2 hard, and a no-overlap case that confirms phase 2 can run zero times.

**Worked examples**

- **Input:** `intervals=[[1,3],[6,9]], newInterval=[2,5]` → **Output:** `[[1,5],[6,9]]`
  *Note:* Canonical case — phase 2 fires once, then phase 3 drains the tail.

  ```
  init res=[], i=0, n=2
  PHASE 1: intervals[0]=[1,3], 3 < 2? No → exit phase 1
  PHASE 2: intervals[0]=[1,3], 1 <= 5? Yes → OVERLAP
    newInterval = [min(2,1), max(5,3)] = [1,5]. i=1
    intervals[1]=[6,9], 6 <= 5? No → exit phase 2
  push newInterval=[1,5] → res=[[1,5]]
  PHASE 3: push intervals[1]=[6,9] → res=[[1,5],[6,9]]. i=2
  return [[1,5],[6,9]]
  ```
- **Input:** `intervals=[[1,2],[3,5],[6,7],[8,10],[12,16]], newInterval=[4,8]` → **Output:** `[[1,2],[3,10],[12,16]]`
  *Note:* Multi-interval engulf — newInterval [4,8] swallows [3,5], [6,7], and [8,10]; phase 2 runs three times and newInterval grows to [3,10].

  ```
  init res=[], i=0, n=5
  PHASE 1: intervals[0]=[1,2], 2 < 4? Yes → push [1,2], i=1. res=[[1,2]]
    intervals[1]=[3,5], 5 < 4? No → exit phase 1
  PHASE 2: intervals[1]=[3,5], 3 <= 8? Yes → OVERLAP
    newInterval = [min(4,3), max(8,5)] = [3,8]. i=2
    intervals[2]=[6,7], 6 <= 8? Yes → OVERLAP
    newInterval = [min(3,6), max(8,7)] = [3,8]. i=3
    intervals[3]=[8,10], 8 <= 8? Yes → OVERLAP (touching)
    newInterval = [min(3,8), max(8,10)] = [3,10]. i=4
    intervals[4]=[12,16], 12 <= 10? No → exit phase 2
  push newInterval=[3,10] → res=[[1,2],[3,10]]
  PHASE 3: push intervals[4]=[12,16] → res=[[1,2],[3,10],[12,16]]. i=5
  return [[1,2],[3,10],[12,16]]
  ```
- **Input:** `intervals=[[1,2],[3,4]], newInterval=[5,6]` → **Output:** `[[1,2],[3,4],[5,6]]`
  *Note:* No-overlap case — phase 2 runs zero times; we push newInterval as-is.

  ```
  init res=[], i=0, n=2
  PHASE 1: intervals[0]=[1,2], 2 < 5? Yes → push [1,2], i=1
    intervals[1]=[3,4], 4 < 5? Yes → push [3,4], i=2 → exit (i==n)
  PHASE 2: i==n, condition false → skip entirely (zero iterations)
  push newInterval=[5,6] → res=[[1,2],[3,4],[5,6]]
  PHASE 3: i==n → skip
  return [[1,2],[3,4],[5,6]]
  ```

**Why this matters** — *Two specific things the trace exposes. (1) On the multi-engulf input, you can watch `newInterval` actually grow over three iterations — that's the proof that you must take `Math.min`/`Math.max`, not just overwrite, because each overlapping interval can extend in either direction. (2) The no-overlap case forces you to confirm that pushing `newInterval` happens *between* phases 2 and 3 unconditionally — not inside a condition. A common bug is to forget the push when phase 2 runs zero times, which corrupts the no-overlap case silently.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty intervals list `intervals=[]` → phases 1 and 3 skip, phase 2 skips, we push `newInterval` alone. Returns `[newInterval]`. ✓
• `newInterval` before everything `intervals=[[5,7]], newInterval=[1,2]` → phase 1 skips (5 not < 1), phase 2 skips (5 not <= 2), push `newInterval`, phase 3 drains. Returns `[[1,2],[5,7]]`. ✓
• `newInterval` after everything `intervals=[[1,2]], newInterval=[5,7]` → phase 1 drains, phase 2 skips, push `newInterval`. Returns `[[1,2],[5,7]]`. ✓
• `newInterval` engulfs the whole list `intervals=[[2,3],[4,5]], newInterval=[1,10]` → phase 1 skips, phase 2 runs twice and grows newInterval to `[1,10]`. ✓
• Touching at the boundary `intervals=[[1,5]], newInterval=[5,8]` → phase 1 skips (5 not < 5), phase 2 fires (5 <= 8), newInterval becomes `[1,8]`. Confirms `<` and `<=` are doing what we think.
• `newInterval` fully inside an existing one `intervals=[[1,10]], newInterval=[3,5]` → phase 2 fires once, `newInterval` becomes `[min(3,1), max(5,10)] = [1,10]`. Result is `[[1,10]]` — unchanged.
• Mutation note: I'm mutating `newInterval` in place during phase 2. If the caller cares about that, I should copy it first."

**Why this matters** — *The before/after/engulf cases are exactly where careless implementations fail — naming each one and walking through why the three phases handle it shows you understand the structural invariant, not just that the code passes the canonical test. The mutation callout at the end is the senior touch most candidates skip; in real code, silently mutating a caller's argument is the kind of bug that surfaces three sprints later.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n). Each interval is examined at most once — across all three phases, the pointer `i` only advances, never resets. There's no sort, because the input is already sorted; that's the whole reason we're under O(n log n). Space is O(n) for the output array (in the worst case, no merges happen and `res` is `intervals.length + 1`).

If the input *weren't* sorted, this becomes Merge Intervals — push `newInterval`, sort, sweep, O(n log n). Going the other direction, if you needed to handle a *stream* of inserts (Insert Interval called repeatedly), you'd want a balanced BST or sorted-set keyed by start, locate the insertion point in O(log n), and merge against neighbors — that's the My Calendar I/II family."

**Why this matters** — *The 'pointer only advances' argument is the right defense against 'don't you have three loops, isn't that O(3n)?' — three loops sharing one monotonically advancing pointer is still one pass. The sorted-stream extension shows you see the family: a single batch insert is one shape, but the same merge-with-neighbors mental model scales to live-data structures with the right index.*

---

### Afternoon — Graphs + Greedy/DP basics *(~2.5 hr)*

#### Number of Islands

*Graphs* · `p-islands` — DFS flood fill: every unvisited "1" starts a new island; sink it by overwriting connected land with "0". O(rows*cols).

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: I get a 2D grid of '1' (land) and '0' (water), and I count the number of islands — where an island is a maximal group of land cells connected 4-directionally (up/down/left/right, not diagonals)."

Then a few quick clarifying questions:
• Cell type — are these the strings '1'/'0' or the numbers 1/0? (LeetCode uses strings; matters for the equality check.)
• Connectivity — 4-directional or 8-directional? (Default is 4.)
• Can I mutate the input grid, or do I need a separate visited set?
• Edges — does land at the border count as bordered by water, or is the border itself water? (Standard interpretation: anything off-grid is water.)
• Empty grid — return 0?

**Why this matters** — *The string-vs-number question is the load-bearing one — if you compare with `=== 1` when the cell is `'1'`, your DFS never enters and you return 0. The mutation question matters because the cleanest solution sinks visited land in-place, which destroys the input — if mutation is forbidden, you need an O(R*C) visited matrix instead. Asking up front is cheaper than rewriting halfway through.*

##### 2. Brute force first (out loud)

> Name the obvious approach before optimizing.

**What I'd say** — "The brute force is basically the same algorithm — there's no O(n²) version that's meaningfully different. Every land cell has to be visited at least once just to confirm it's part of an island, so the floor is O(R*C). The naive thing would be to use Union-Find: walk every cell, and for each '1' union it with each of its 4 '1' neighbors. At the end, count distinct roots. That works and gives O(R*C*α(R*C)), but it's more bookkeeping than necessary — DFS flood fill is the same asymptotic with a tiny constant."

**Why this matters** — *This problem is unusual in that the brute force IS the optimal — there's no factor-of-n improvement to discover. The right move is to name an alternative algorithm (Union-Find) and explain why DFS wins on simplicity, rather than inventing a strawman O(R²C²) just so you have something to optimize away. Interviewers respect knowing when a problem doesn't have a clever speedup.*

##### 3. Spot the pattern

> What signal in the problem points to grid-DFS flood fill?

**What I'd say** — "This is the canonical 'matrix as implicit graph' problem. Each '1' cell is a node; its 4-neighbors that are also '1' are its edges — but we never materialize an adjacency list, we just compute neighbors on the fly with (r±1, c) and (r, c±1). Counting islands is counting connected components in that implicit graph, which is the textbook DFS-from-each-unvisited-node pattern. The flood-fill twist is that we mark cells visited by sinking them to '0' in place — that doubles as 'visited' and saves the O(R*C) auxiliary set. The outer double loop scans every cell exactly once; the inner DFS sinks one whole component, so each cell is touched at most twice total (once by the outer scan, once by a DFS)."

**Why this matters** — *Naming the pattern AND the structural property is the move. 'It's a DFS problem' is a guess; 'matrix is an implicit graph where 4-neighbors are edges, and connected components on that graph is exactly islands' is a derivation. The in-place sinking trick is the specific implementation insight that separates this from a generic DFS — call it out because the alternative (visited matrix) is correct but uses 2x memory and an extra parameter to thread through.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — a multi-island grid with a diagonal-touching pair (which must NOT merge), an all-water case, and one big island shaped to verify the flood fills around its hole.

**Worked examples**

- **Input:** `[["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]` → **Output:** `3`
  *Note:* Classic case — three distinct islands. Note (2,2) and (3,3) touch only diagonally → still separate islands under 4-connectivity.

  ```
  outer scan (0,0)='1' → count=1, dfs sinks (0,0),(0,1),(1,0),(1,1) → top-left 2x2 all become '0'
  outer scan (0,1)='0', (0,2)..(0,4)='0', (1,0)..(1,4)='0' → all already sunk or water
  outer scan (2,2)='1' → count=2, dfs sinks (2,2) — neighbors are all '0' or off-grid
  outer scan (3,3)='1' → count=3, dfs sinks (3,3) and (3,4)
  outer scan finishes → return 3
  ```
- **Input:** `[["0","0"],["0","0"]]` → **Output:** `0`
  *Note:* Degenerate all-water — outer loop visits every cell but the `if (grid[r][c] === '1')` guard never fires.

  ```
  outer scan (0,0)='0' → skip
  outer scan (0,1)='0' → skip
  outer scan (1,0)='0' → skip
  outer scan (1,1)='0' → skip
  return count=0 (never incremented)
  ```
- **Input:** `[["1","1","1"],["0","1","0"],["1","1","1"]]` → **Output:** `1`
  *Note:* Plus-shape — confirms the flood follows 4-connectivity around the two water cells without splitting.

  ```
  outer scan (0,0)='1' → count=1, launch dfs
    dfs floods (0,0)→(0,1)→(0,2), backtracks via (0,1)→(1,1)→(2,1)→(2,0) and (2,2)
    all eight land cells sink to '0'
  outer scan continues — every remaining cell is '0', no more islands
  return count=1
  ```

**Why this matters** — *Tracing surfaces the one bug this problem keeps catching: the string-vs-number mismatch. If you write `grid[r][c] === 1` instead of `=== '1'`, the trace immediately shows the outer scan never finding any land and returning 0. The plus-shape example also defends 4-connectivity — if you accidentally added diagonals (5 or 8 neighbor calls), the trace wouldn't change for this case, but it would over-merge the first example's (2,2) and (1,1) into one island. Worth picking an example that distinguishes.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty grid `[]` → `grid[0]` throws. Guard with `if (!grid.length || !grid[0].length) return 0` at the top.
• Single cell — `[['1']]` returns 1, `[['0']]` returns 0. The double loop handles both without special cases.
• All land — one big island, returns 1. DFS visits every cell exactly once.
• All water — returns 0, the if-guard never fires.
• Single row or single column — works, but worth tracing once because the recursion is now strictly linear.
• Diagonal-only adjacency (e.g. two '1's at (0,0) and (1,1) surrounded by water) → must NOT merge under 4-connectivity; returns 2. This is the bug a sloppy 8-direction loop would create.
• Very large grid — recursion depth can hit O(R*C) on a snake-shaped island, which blows the JS stack around 10k-15k cells. For interview purposes I'd flag this and offer an iterative-stack variant as the fallback."

**Why this matters** — *The empty-grid guard is the cheap one most candidates forget — `grid[0].length` throws on `[]`. The diagonal-adjacency call-out shows you read the connectivity rule carefully rather than assuming. The recursion-depth concern is the senior move: most candidates ship the recursive version without thinking about stack limits, and on a 200x200 grid filled with a single snaky island that's an actual bug. Naming it and offering the iterative-stack alternative is the right level of paranoia.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(R*C). Two passes maximum over each cell: once by the outer double loop, and once by a DFS that sinks it. The outer loop touches every cell in O(R*C); each DFS visit is O(1) work (bounds check, equality check, four recursive calls). The total DFS work across all components sums to O(R*C) because each land cell is sunk exactly once and water cells are bailed on immediately.

Space is O(R*C) worst case — the recursion stack for a single snake-shaped island that fills the whole grid. If we used the iterative-stack version, it's still O(R*C) for the stack but no actual recursion frames. Sinking in place is what saves us the O(R*C) visited matrix.

If you wanted to extend to 'count islands in a STREAM of land additions' (LeetCode 305, Number of Islands II), the DFS approach doesn't work — adding a single land cell could merge up to 4 existing islands. That's Union-Find's home turf: each add does up-to-4 union operations, total O(K*α(R*C)) for K additions. Same template I mentioned in section 2, just used in a regime where it actually wins."

**Why this matters** — *The two-passes-per-cell argument is the clean amortization defense — interviewers sometimes ask 'isn't the DFS itself O(R*C) per call, and you call it from inside a loop, so isn't it O((R*C)²)?' The answer is no, because once a cell is sunk it'll never be visited again. The streaming-additions extension is the killer follow-up: it's LeetCode 305, it explicitly motivates Union-Find as the better tool for that regime, and it proves you see the problem family, not just this instance. That's how the same pattern shows up in Surrounded Regions, Max Area of Island, and Walls and Gates.*

---

#### Course Schedule

*Graphs* · `p-course` — Cycle detection on a directed graph via Kahn topological sort: peel zero-indegree nodes until none remain. If all peeled, no cycle.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: I get a number of courses `numCourses` (numbered 0 to n-1) and a list of `prerequisites` where each pair `[a, b]` means I must take course b before I can take course a. I return true if it's possible to finish all courses, false otherwise."

Then a few quick clarifying questions:
• Edge direction in the pair — `[a, b]` means b is a prereq of a, right? (Easy to flip and get a wrong-direction graph.)
• Empty prerequisites — `numCourses=3, prereqs=[]` returns true?
• Duplicate edges — could `[[1,0],[1,0]]` appear? Does it matter? (Inflates indegree but the algorithm still works.)
• Self-loops — could `[[1,1]]` appear? That's a trivial cycle, returns false.
• Disconnected components — multiple independent course chains?

**Why this matters** — *The edge-direction question is the most common bug. The convention in this problem is `[a, b]` = 'b before a', so the directed edge goes FROM b TO a (b unlocks a). If you flip it, the algorithm runs but on a wrong graph and gives wrong answers. Asking up front signals you've seen the problem before and forces the interviewer to confirm — much better than discovering it via a failing test. The self-loop and duplicate-edge questions are senior-level; they probe the input contract.*

##### 2. Brute force first (out loud)

> Name the obvious approach before optimizing.

**What I'd say** — "The brute force is exhaustive search: try every permutation of `numCourses!` orderings, and for each one check whether every prerequisite is satisfied — meaning b comes before a for every `[a, b]`. That's O(n! · m) where m is the number of prereqs, which is hopeless past n=10. The fix is to recognize this is cycle detection in a directed graph: if there's no cycle, a valid order exists; if there is, no permutation can satisfy it."

**Why this matters** — *Two reasons to name the n!-permutations brute force. (1) It frames the problem as a search through orderings, which is what it literally is — every permutation either satisfies all constraints or doesn't. (2) It motivates the leap to graph theory: 'I don't actually need to construct the order, I just need to know if one CAN exist, which is a yes/no question about cycles.' That reframing is what unlocks both Kahn's BFS and DFS-with-colors. The brute force isn't a strawman — it's literally what people try first if they don't see the graph framing.*

##### 3. Spot the pattern

> What signal in the problem points to topological sort / cycle detection?

**What I'd say** — "'Must do X before Y' is the canonical directed-graph trigger. Each course is a node; each `[a, b]` is a directed edge b → a (b unlocks a). The question 'can I finish all courses?' is exactly 'does this directed graph have a cycle?' — because a cycle means some course depends, transitively, on itself, which is impossible to satisfy. I'll use Kahn's algorithm: build adjacency and indegree arrays, seed a queue with every node that has indegree 0 (no prereqs), then BFS — for each node I dequeue I 'take' that course and decrement indegree on all its dependents. Any dependent whose indegree hits 0 joins the queue. At the end, if I took every course (`taken === numCourses`), no cycle; if I came up short, the missing nodes form a cycle. Alternative is DFS with 3-color marking (white/gray/black) — gray means 'on current path', and re-encountering a gray node IS the cycle. Kahn's tends to be cleaner for this problem because the queue gives you the topological order for free (which matters for Course Schedule II) and there's no recursion stack."

**Why this matters** — *Naming the pattern AND the structural property AND comparing the two valid implementations is the senior move. 'It's a cycle detection problem' is the trigger; 'Kahn's BFS because the topological ordering is a natural byproduct and there's no stack risk' is the implementation choice with justification. The DFS-with-colors mention shows you know both — interviewers may push 'why not DFS?' and the answer is 'either works; I'm picking Kahn's for these specific reasons.' Don't bury that — it's the kind of taste interviewers explicitly grade.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — a simple linear DAG (success), a 2-node cycle (failure), and a diamond DAG (multi-source, tests that all zero-indegree nodes seed correctly).

**Worked examples**

- **Input:** `numCourses=2, prerequisites=[[1,0]]` → **Output:** `true`
  *Note:* Simplest valid case — take 0, then take 1. indeg[0]=0 seeds the queue.

  ```
  build: graph[0]=[1], indeg=[0, 1]
  seed: indeg[0]===0 → queue=[0]
  dequeue 0 → taken=1, decrement indeg[1]: 1→0 → enqueue 1
  dequeue 1 → taken=2, graph[1] empty
  queue empty → taken(2) === numCourses(2) → return true
  ```
- **Input:** `numCourses=2, prerequisites=[[1,0],[0,1]]` → **Output:** `false`
  *Note:* Direct 2-cycle: 0 needs 1, 1 needs 0. Both indegrees start at 1, queue never seeds.

  ```
  build: graph[0]=[1], graph[1]=[0], indeg=[1, 1]
  seed loop: indeg[0]=1, indeg[1]=1 → queue stays []
  while loop never executes → taken=0
  taken(0) !== numCourses(2) → return false
  ```
- **Input:** `numCourses=6, prerequisites=[[1,0],[2,0],[3,1],[3,2],[4,3],[5,4]]` → **Output:** `true`
  *Note:* Diamond DAG — course 0 unlocks both 1 and 2, which both unlock 3, then linear to 5. Confirms multi-out-edge decrement and that 3 enqueues only after BOTH 1 and 2 finish.

  ```
  build: graph[0]=[1,2], graph[1]=[3], graph[2]=[3], graph[3]=[4], graph[4]=[5]
  indeg=[0, 1, 1, 2, 1, 1]
  seed: only indeg[0]=0 → queue=[0]
  dequeue 0 → taken=1, decrement indeg[1]: 1→0 → enqueue 1; indeg[2]: 1→0 → enqueue 2 → queue=[1,2]
  dequeue 1 → taken=2, decrement indeg[3]: 2→1 (NOT 0 yet)
  dequeue 2 → taken=3, decrement indeg[3]: 1→0 → enqueue 3 → queue=[3]
  dequeue 3 → taken=4, decrement indeg[4]: 1→0 → enqueue 4
  dequeue 4 → taken=5, decrement indeg[5]: 1→0 → enqueue 5
  dequeue 5 → taken=6
  queue empty → taken(6) === numCourses(6) → return true
  ```

**Why this matters** — *Tracing surfaces the two bugs this problem keeps creating. (1) The diamond DAG case confirms that node 3 only enqueues AFTER both 1 and 2 have decremented its indegree — if you instead enqueued on `indeg > 0`, you'd take 3 too early. (2) The 2-cycle case confirms that an empty initial queue is correctly handled (the while loop just doesn't execute), and that the `taken === numCourses` check at the end is what catches the cycle — without that check you'd silently return true on a stuck graph. Worth flagging both before writing the loop.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Empty prerequisites — every indegree is 0, every node seeds the queue, all `taken` in one sweep, returns true. ✓
• Single course `numCourses=1, prereqs=[]` — indeg=[0], queue=[0], taken=1, returns true. ✓
• Self-loop `[[1,1]]` — indeg[1]=1 with no path to reach 0; queue empty → false. The algorithm handles it without a special case.
• Duplicate edges `[[1,0],[1,0]]` — indeg[1]=2; when 0 is taken, it decrements twice (graph[0]=[1,1]), 1 hits 0 correctly. Works but inflates work; could dedup if asked.
• Disconnected components — multiple zero-indegree roots seed the queue in parallel; BFS processes them all. No special handling.
• Very large input (1e5 courses, 1e5 edges) — `queue.shift()` is O(n) on a JS array, which makes the loop O(V²). For interview correctness it's fine; for production I'd use a circular buffer or a head index to keep `shift` O(1)."

**Why this matters** — *The self-loop case is the cheap one most candidates forget to mention — it's a cycle of length 1, and the algorithm handles it for the same structural reason it handles longer cycles (initial indegree > 0, never enqueued). The `queue.shift()` performance call-out is the senior move: it's an actual JS-specific concern that doesn't apply in Python/Java, and most candidates write `.shift()` without thinking. Interviewers either nod (impressed) or say 'assume it's fine' — either way you've shown you read your own code.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(V + E) where V = numCourses and E = prerequisites.length. The build phase is O(V + E). The BFS visits each node at most once (V dequeues) and each edge at most once (one decrement per edge across the whole loop), so the body is O(V + E). The only nuance is `queue.shift()` — that's O(V) per call in JS, which would make the loop O(V²); for big inputs use a head-index pointer or a Deque-equivalent.

Space is O(V + E) — the adjacency list dominates with O(E), the indegree array and queue are O(V).

If you wanted to extend to Course Schedule II — return the actual order, not just the boolean — it's literally one extra line: push each `c` you dequeue into an `order` array, and return `order` instead of `taken === numCourses` (returning `[]` on cycle). Kahn's is preferred over DFS specifically because the topological order falls out for free. If you wanted to extend to 'find the minimum number of semesters' (Course Schedule III variant), it's still Kahn's but with a layer counter — increment per BFS level, not per dequeue."

**Why this matters** — *The V + E defense is the textbook bound — interviewers may ask 'why not V*E?' and the answer is 'each edge contributes one decrement to the inner for-loop across the entire BFS, never repeated.' The `queue.shift()` performance call-out is what shows you care about constant factors in the language you're actually writing. The Course Schedule II extension is the obvious follow-up and proves you see Kahn's as a template (build adjacency + indegree, BFS the zero-indegree frontier, decrement-and-enqueue) that generalizes — same shape shows up in Alien Dictionary, Sequence Reconstruction, and any 'find an order consistent with constraints' problem.*

---

#### Clone Graph

*Graphs* · `p-clone-graph` — DFS with a visited Map from original-node to clone-node. The Map handles cycles AND avoids exponential reclones of shared neighbors.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me make sure I have this right: I'm given a reference to one node in a connected, undirected graph (each node has `val` and `neighbors: Node[]`), and I need to return a deep copy — a brand-new graph with the same structure, where no node in the result is the same object reference as any node in the input."

Then a few quick clarifying questions:
• Connected — am I guaranteed the input graph is connected? (Otherwise I might miss components.)
• Cycles — the graph can have cycles, right? (Almost always yes; that's why the visited Map exists.)
• Self-loops — could a node be its own neighbor?
• Null input — return null?
• Node values — unique, or could two distinct nodes have the same `val`? (Critical: if vals can collide, my Map must key on the original-node OBJECT, not `node.val`.)

**Why this matters** — *The unique-vs-non-unique values question is the load-bearing one. If you key the visited Map on `node.val` and two different original nodes share a value, you'd alias them in the clone — wrong graph. The correct key is the original-node object reference itself (JavaScript `Map` supports object keys with identity comparison). The cycles question forces the visited-Map insight; if the interviewer says 'tree only', you don't strictly need the map (but it's still fine to use one). Asking signals you've thought about what makes the problem hard.*

##### 2. Brute force first (out loud)

> Name the broken approach to motivate the fix.

**What I'd say** — "The naive approach is: walk the graph and for each neighbor, recursively call `clone(neighbor)`. The problem is cycles — if node A has neighbor B and B has neighbor A, you'd recurse from A into B, then from B back into A, forever. Even without cycles, if multiple nodes share a neighbor (say a diamond graph A→B, A→C, B→D, C→D), you'd clone D twice — once via B's recursion and once via C's — producing two D-copies that the cloned graph treats as different nodes. Wrong structure AND wasted work."

**Why this matters** — *Two reasons to name the broken version. (1) It motivates the visited Map: 'I need to remember which originals I've already cloned, both to break cycles and to share clones across paths.' (2) It distinguishes this problem from the tree-copy version (where there are no cycles and no shared nodes, so naive recursion works). The diamond example is concrete and shows that the bug isn't only about cycles — sharing alone breaks the clone.*

##### 3. Spot the pattern

> What signal in the problem points to DFS with a visited Map?

**What I'd say** — "Two things tell me 'DFS with memoization on a graph':
1. I need to visit every node and rewrite the edges — that's DFS/BFS over a connected graph.
2. I need to handle cycles and shared neighbors — that's what the visited set is for.
The twist for this problem is that the visited structure is a Map, not a Set: it stores `original → clone`, so it doubles as the 'have I cloned this?' check AND the source of the cached clone object. The load-bearing rule is: insert `map.set(orig, copy)` BEFORE recursing into the neighbors. If you recurse first, the cycle re-enters DFS on the same original, finds nothing in the map, makes a SECOND copy, recurses again, and infinite-loops. Set first, then recurse — that's the whole algorithm in one sentence."

**Why this matters** — *Naming the pattern AND the specific implementation rule (set-before-recurse) is what makes this conversation feel earned. 'Use a visited Map' is the textbook tip; 'set before recurse, because a cycle re-enters DFS during the neighbor loop' is the derivation that proves you've actually written this and bug-fixed it. Interviewers will pull on that thread — the wrong order is the most common bug they see, and being able to explain WHY it's wrong (not just 'I memorized to do it this way') separates senior from junior.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — a 4-cycle with cross-edges (the load-bearing cycle case), a single node with no edges (the base case), and a triangle (the simplest cycle that forces the visited Map).

**Worked examples**

- **Input:** `adj=[[1,3],[0,2],[1,3],[0,2]]  (4-cycle 1↔2↔3↔4↔1, no diagonals)` → **Output:** `cloned graph with same adjacency structure`
  *Note:* Classic case — cycles in all directions. Watch the Map record each clone BEFORE recursing.

  ```
  dfs(orig=1): map.has(1)? no → create copy(1), map.set(1, copy1)
    for nb in [2, 4]:
      dfs(orig=2): map.has(2)? no → create copy(2), map.set(2, copy2)
        for nb in [1, 3]:
          dfs(orig=1): map.has(1)? YES → return copy1 (cycle broken!)
          copy2.neighbors.push(copy1)
          dfs(orig=3): map.has(3)? no → create copy(3), map.set(3, copy3)
            for nb in [2, 4]:
              dfs(orig=2): map.has(2)? YES → return copy2 (cycle broken!)
              copy3.neighbors.push(copy2)
              dfs(orig=4): map.has(4)? no → create copy(4), map.set(4, copy4)
                for nb in [1, 3]: both YES → return copy1, copy3
              copy3.neighbors.push(copy4)
          copy2.neighbors.push(copy3)
      copy1.neighbors.push(copy2)
      dfs(orig=4): map.has(4)? YES → return copy4 (already cloned via copy3's path)
    copy1.neighbors.push(copy4)
  final map: {1→copy1, 2→copy2, 3→copy3, 4→copy4} — 4 clones for 4 originals ✓
  ```
- **Input:** `adj=[[]]  (single node, no neighbors)` → **Output:** `single cloned node with empty neighbors`
  *Note:* Base case — no cycles to handle, just verify the function doesn't choke on empty neighbors.

  ```
  dfs(orig=1): map.has(1)? no → create copy(1) with neighbors=[]
  map.set(1, copy1)
  for nb in []: loop doesn't execute
  return copy1
  ```
- **Input:** `adj=[[1,2],[0,2],[0,1]]  (triangle 1-2-3-1)` → **Output:** `cloned triangle`
  *Note:* Smallest cycle that exercises both branches of map.has — verify clones are reused, not duplicated.

  ```
  dfs(orig=1): map.set(1, copy1)
    dfs(orig=2): map.set(2, copy2)
      dfs(orig=1): map.has(1)? YES → return copy1
      copy2.neighbors.push(copy1)
      dfs(orig=3): map.set(3, copy3)
        dfs(orig=1): YES → return copy1
        dfs(orig=2): YES → return copy2
        copy3.neighbors = [copy1, copy2]
      copy2.neighbors.push(copy3)
    copy1.neighbors.push(copy2)
    dfs(orig=3): YES → return copy3
  copy1.neighbors.push(copy3)
  final: copy1.neighbors=[copy2, copy3], copy2=[copy1, copy3], copy3=[copy1, copy2]
  ```

**Why this matters** — *Tracing surfaces the set-before-recurse rule viscerally. Look at the very first cycle in example 1: `dfs(1)` calls `dfs(2)` which calls `dfs(1)` again — and the only reason this terminates is that `dfs(1)` already wrote `map.set(1, copy1)` before entering its neighbor loop. If you'd written `map.set(orig, copy)` AFTER the for-loop instead of before, the inner `map.has(1)` would return false, you'd create a SECOND copy of 1, recurse into ITS neighbors, and infinite-loop. The trace makes the bug-and-fix concrete in a way that 'use a visited Map' never does.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• Null input → return null at the top. Guard the function entry.
• Single node, no neighbors → DFS creates one copy, neighbor loop never executes, returns copy. ✓
• Self-loop (node A's neighbors include A itself) → first thing DFS does is set `map.set(A, copyA)`, then loop into neighbors. When it hits A as its own neighbor, `map.has(A)` is true → returns copyA, pushes copyA into copyA's neighbors. Self-loop preserved in the clone. ✓
• Disconnected graph — problem statement usually says 'connected', but if not, this DFS only clones the connected component of the input node. The interviewer would have to give us roots for each component or a list of all nodes.
• Very large graph — recursion depth = longest DFS path = up to V. Could stack-overflow at ~10k nodes in JS. The iterative BFS variant uses an explicit queue and avoids the stack.
• Duplicate values across distinct nodes (e.g. two different nodes both with val=1) — the Map keys on the original node OBJECT, not its val, so they stay distinct. This is why I asked about val-uniqueness up front."

**Why this matters** — *The self-loop case is the cheap proof that 'set before recurse' is the right rule even outside cycles — it works the same way. The duplicate-values case is the senior insight that explains WHY the Map key must be the node object, not the val; most candidates use the val as the key without realizing it's wrong when vals collide. Calling that out shows you've thought about the data model, not just the algorithm. The recursion-depth warning is the same concern as Number of Islands — JS stacks aren't deep enough for graph-scale recursion.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(V + E) — every node is created exactly once (V), and every edge is traversed exactly twice in undirected form (once from each endpoint), so the neighbor pushes sum to 2E. The Map operations (has, get, set) are O(1) amortized for object keys.

Space is O(V) for the Map plus O(V) worst case for the recursion stack on a path-shaped graph, so O(V) overall — independent of E, which is nice.

If you wanted to extend to BFS instead of DFS, the algorithm is structurally the same: queue the original, create its copy and `map.set`, then for each dequeued original, look at its neighbors — if not in the map, create the copy and enqueue; either way wire `copy.neighbors.push(map.get(nb))`. Same Map, same set-before-recurse discipline, just iteration instead of recursion. That's what you'd reach for if recursion-depth is a concern.

The same template — 'visited Map from original-thing → clone-thing, set before recurse' — shows up in Copy List with Random Pointer (where the Map handles the random pointer just like neighbors handle cycles) and any 'deep clone a graph-like structure with shared references' problem."

**Why this matters** — *The 'each edge traversed exactly twice in undirected form' argument is the textbook defense; for directed graphs it's once. The DFS-to-BFS extension is the obvious follow-up and proves you see the algorithm shape (visited-Map + frontier) rather than a specific syntax. The Copy List with Random Pointer connection is the killer cross-reference — same Map trick, different data structure, and naming it explicitly demonstrates pattern-recognition at the template level.*

---

#### Climbing Stairs

*Dynamic Programming* · `p-climbing-stairs` — Ways to reach step n taking 1 or 2 steps at a time. Fibonacci-shaped DP: ways(n) = ways(n-1) + ways(n-2). O(1) space with rolling variables.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me play it back: I'm standing at the bottom of `n` stairs. At every move I can take exactly 1 step or 2 steps. I want to count the number of distinct sequences of moves that land me on step `n`."

Then a few quick clarifying questions:
• Range of `n` — fits in a 32-bit int? Could it be 0?
• Is `n=0` a valid input — and if so, is the answer 1 (the empty sequence) or 0?
• Are 1-then-2 and 2-then-1 counted as different sequences? (They should be — it's ordered.)
• Return value — just the count, or also the sequences themselves?

**Why this matters** — *The `n=0` and ordering questions look pedantic but they pin down the base case. If 1-2 and 2-1 are the *same*, this becomes a partition-counting problem with a totally different recurrence. And `n=0 → 1` is what makes `ways(2) = ways(1) + ways(0) = 1 + 1 = 2` work cleanly — without it the seed gets ugly.*

##### 2. Brute force first (out loud)

> Name the obvious O(2^n) solution before you discard it.

**What I'd say** — "The obvious recursive version is: `ways(n) = ways(n-1) + ways(n-2)`, with `ways(0) = ways(1) = 1`. At every step you either took a 1 or a 2; sum the two subtrees. Plain recursion is O(2^n) time because `ways(n-1)` and `ways(n-2)` re-derive overlapping subproblems — `ways(n-3)` gets computed in both branches, `ways(n-4)` four times, and so on. Same shape as the naive Fibonacci recursion."

**Why this matters** — *Two reasons to name it. (1) Most interviewers want to see you reach for recursion first — it's the natural decomposition of 'last move was 1 or 2'. (2) The overlap is the whole reason DP applies. Once you say 'I'm recomputing the same subtree', memoization → tabulation → rolling-pair is a straight line, and it's clear *why* each step helps.*

##### 3. Spot the pattern

> What signal in the problem points to bottom-up DP with rolling variables?

**What I'd say** — "This is a 1D DP problem. The recurrence is the load-bearing piece: to land on step `n`, the last move was either a 1 (so I was on step `n-1`) or a 2 (so I was on step `n-2`). Those two subproblems are disjoint and cover every sequence, so `ways(n) = ways(n-1) + ways(n-2)` — straight Fibonacci. Once I see that each `dp[i]` only reads `dp[i-1]` and `dp[i-2]`, the array is overkill: I keep two rolling scalars `prev2` and `prev1`, slide them forward in a loop, and the answer is the final `prev1`. Time O(n), space O(1)."

**Why this matters** — *Naming the recurrence in plain language — 'last move was 1 or 2, so sum the two predecessors' — is the move. Anyone can say 'this is Fibonacci'; the win is *deriving* it from the decision at each step. The rolling-vars observation comes from inspecting the recurrence's read-window: if the recurrence only reaches back `k` cells, you only need `k` rolling vars.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — the canonical n=5, the n=1 base case, and a slightly larger n=7 to confirm the Fibonacci pattern keeps holding.

**Worked examples**

- **Input:** `5` → **Output:** `8`
  *Note:* Canonical case — produces the familiar Fibonacci sequence 1,1,2,3,5,8.

  ```
  init: prev2=ways(0)=1, prev1=ways(1)=1
  i=2: curr = prev1+prev2 = 1+1 = 2. roll → prev2=1, prev1=2. dp so far [1,1,2]
  i=3: curr = 2+1 = 3. roll → prev2=2, prev1=3. dp [1,1,2,3]
  i=4: curr = 3+2 = 5. roll → prev2=3, prev1=5. dp [1,1,2,3,5]
  i=5: curr = 5+3 = 8. roll → prev2=5, prev1=8. dp [1,1,2,3,5,8]
  return prev1 = 8
  ```
- **Input:** `1` → **Output:** `1`
  *Note:* Base case — the early return fires before the loop runs.

  ```
  n=1 → hits `if (n <= 1) return 1`
  return 1 (single sequence: [1])
  ```
- **Input:** `7` → **Output:** `21`
  *Note:* Larger — confirms the rolling-pair carries the Fibonacci forward without divergence.

  ```
  init: prev2=1, prev1=1
  i=2: curr=2, roll → (1,2)
  i=3: curr=3, roll → (2,3)
  i=4: curr=5, roll → (3,5)
  i=5: curr=8, roll → (5,8)
  i=6: curr=13, roll → (8,13)
  i=7: curr=21, roll → (13,21)
  return 21
  ```

**Why this matters** — *Tracing surfaces the one bug this problem rewards: the roll order. If you assign `prev1 = curr` *before* `prev2 = prev1`, you overwrite `prev1` with `curr` and then copy that same `curr` into `prev2` — both rails collapse and you compute the wrong sequence. The n=1 trace also defends the base case: without `ways(0) = 1`, the loop's first iteration would start from the wrong seed.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• `n = 0` — depends on the convention you pick in clarification. Either return 1 (the empty sequence) or guard against it explicitly.
• `n = 1` and `n = 2` — both should return 1 and 2 respectively; the early return covers `n ≤ 1` and the loop body covers `n = 2` cleanly.
• Very large `n` (e.g. 80+) — the answer overflows a regular JS Number's safe integer range around `n ≈ 78`. If the spec needs exact arithmetic beyond that, switch the rolling vars to BigInt.
• Negative `n` — almost certainly invalid; either throw or treat as 0 depending on the contract."

**Why this matters** — *The integer-overflow call-out is the senior signal here. Most candidates blow past it because the Fibonacci numbers feel benign; pointing out that JS Numbers lose precision around `2^53` (which Fibonacci hits surprisingly fast) shows you actually thought about the data type, not just the algorithm. The interviewer either nods or says 'assume `n ≤ 45`' — both are fine outcomes.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is O(n) — single pass from `i = 2` to `n`, constant work per iteration (one add, two assignments). Space is O(1) — just the two rolling scalars `prev2` and `prev1`, no array allocation.

The naive recursive version was O(2^n) time because of the overlapping-subproblems blow-up; memoization brings it to O(n) time / O(n) space; tabulation keeps O(n) / O(n); rolling pair drops space to O(1). Same answer, three different memory profiles.

If you wanted to extend to 'you can step 1, 2, or 3 at a time', the recurrence becomes `ways(n) = ways(n-1) + ways(n-2) + ways(n-3)` (a tribonacci) and you'd need three rolling vars. Same template, different look-back depth."

**Why this matters** — *Walking the 2^n → n → 1 progression in space is the right way to defend the rolling-vars choice — the interviewer sees you understand why DP works (overlapping subproblems) and why you can compress (limited look-back). The tribonacci extension proves you see the template as 'k-step Fibonacci' rather than memorizing this one problem; that same shape recurs in House Robber, Min Cost Climbing Stairs, and Decode Ways.*

---

#### Coin Change

*Dynamic Programming* · `p-coin-change` — Fewest coins to make `amount`. Bottom-up dp[a] = min over coins of dp[a - c] + 1. Returns -1 if no combination reaches the amount.

> How an interview about this problem would actually play out. Each section has two parts: what you'd actually say out loud, and why that move matters. Tap a section to expand.

##### 1. Restate & clarify

> Before touching code — pin down the inputs.

**What I'd say** — "Let me play it back: I have an array of distinct positive integers `coins` representing denominations, and a target `amount`. I want the *fewest* number of coins (with unlimited supply of each) that sum exactly to `amount`, or `-1` if no combination reaches it."

Then a few quick clarifying questions:
• Unlimited supply of each coin, right? (As opposed to one-of-each — that's the 0/1 knapsack variant.)
• Are coins always positive, distinct integers?
• `amount = 0` — return 0 (zero coins needed)?
• Range — what's the upper bound on `amount`? (Affects whether `O(amount × coins)` is acceptable.)
• Return value — just the count, or also the actual coins used?

**Why this matters** — *The unlimited-supply question is *critical* — if it's one-of-each, the recurrence changes (you can't reuse `dp[a - c]` from the current pass, you'd need a 2D table or reverse iteration). The `amount = 0` clarification lets you anchor `dp[0] = 0` cleanly. The upper-bound question lets you preempt the 'is `O(amount × coins)` good enough?' pushback — for `amount ≤ 10^4` and a handful of coins, easily.*

##### 2. Brute force first (out loud)

> Name the obvious exponential solution before you discard it.

**What I'd say** — "The brute force is recursive: `minCoins(a) = 1 + min(minCoins(a - c))` over every coin `c ≤ a`, with `minCoins(0) = 0` and `minCoins(negative) = Infinity`. Try every coin at every step, recurse on the remainder, take the best plus one. That's exponential — roughly `O(coins.length ^ amount)` — because the same subproblem `minCoins(7)` gets recomputed in countless branches (subtract 5 from 12, subtract 2 from 9 then 2 from 7, etc.). Massive overlap, perfect DP target."

**Why this matters** — *Two reasons to name it. (1) It's the natural framing — 'at each step pick a coin' is what an interviewer expects to hear first. (2) The overlap is the whole reason DP works here. Pointing out that `minCoins(7)` gets re-derived from many paths is what justifies caching, and the cache is exactly the bottom-up `dp` array.*

##### 3. Spot the pattern

> What signal in the problem points to bottom-up tabulation?

**What I'd say** — "This is 1D DP over the amount. The recurrence is `dp[a] = min over coins c of dp[a - c] + 1`, where `dp[a]` is the fewest coins that sum to `a`. The decision at each step is *which coin to use last* — and once you commit to coin `c` as the last one, the remaining problem is `dp[a - c]`, which is strictly smaller. So I build up from `dp[0] = 0` to `dp[amount]`, and for each subproblem I try every coin. Initialize the whole array to `Infinity` so unreachable amounts stay unreachable; at the end, if `dp[amount]` is still `Infinity`, return -1."

**Why this matters** — *Naming the recurrence in 'last coin used' framing is what makes it click. Saying 'min over coins' alone is too abstract; 'I'm asking what was the last coin — try each, the rest is a smaller subproblem' is the derivation. The `Infinity` sentinel is the trick that makes the unreachable case fall out of the same recurrence — no special-case branching for 'impossible'.*

##### 4. Trace through examples

> Walk a few inputs to confirm the model before writing the loop.

"Let me trace through a couple of cases to make sure my model is right." Three inputs cover the interesting behaviors — the canonical case, an unreachable amount (returns -1), and a case where the greedy fails but DP wins.

**Worked examples**

- **Input:** `coins=[1,2,5], amount=11` → **Output:** `3`
  *Note:* Canonical case — optimal is 5+5+1 = 3 coins.

  ```
  dp = [0, Inf, Inf, …, Inf] (length 12)
  a=1: try c=1 → dp[0]+1=1. dp[1]=1
  a=2: try c=1 → dp[1]+1=2. try c=2 → dp[0]+1=1. dp[2]=1
  a=3: try c=1 → dp[2]+1=2. try c=2 → dp[1]+1=2. dp[3]=2
  a=4: c=1→dp[3]+1=3, c=2→dp[2]+1=2. dp[4]=2
  a=5: c=1→4, c=2→3, c=5→dp[0]+1=1. dp[5]=1
  a=6: c=1→2, c=2→2, c=5→dp[1]+1=2. dp[6]=2
  a=7: c=1→3, c=2→3, c=5→dp[2]+1=2. dp[7]=2
  a=8: c=1→3, c=2→3, c=5→dp[3]+1=3. dp[8]=3
  a=9: c=1→4, c=2→3, c=5→dp[4]+1=3. dp[9]=3
  a=10: c=1→4, c=2→4, c=5→dp[5]+1=2. dp[10]=2
  a=11: c=1→3, c=2→4, c=5→dp[6]+1=3. dp[11]=3
  return 3
  ```
- **Input:** `coins=[2], amount=3` → **Output:** `-1`
  *Note:* Unreachable — every odd amount stays at Infinity. The Infinity sentinel does the work.

  ```
  dp = [0, Inf, Inf, Inf]
  a=1: c=2 > 1, skip. dp[1] still Inf
  a=2: c=2 → dp[0]+1=1. dp[2]=1
  a=3: c=2 → dp[1]+1 = Inf+1 = Inf. dp[3] still Inf
  dp[3] === Infinity → return -1
  ```
- **Input:** `coins=[1,3,4], amount=6` → **Output:** `2`
  *Note:* Greedy fails here — greedy picks 4+1+1 = 3 coins, but DP finds 3+3 = 2 coins.

  ```
  dp = [0, Inf, …, Inf] (length 7)
  a=1: c=1→dp[0]+1=1. dp[1]=1
  a=2: c=1→dp[1]+1=2. dp[2]=2
  a=3: c=1→3, c=3→dp[0]+1=1. dp[3]=1
  a=4: c=1→2, c=3→dp[1]+1=2, c=4→dp[0]+1=1. dp[4]=1
  a=5: c=1→2, c=3→dp[2]+1=3, c=4→dp[1]+1=2. dp[5]=2
  a=6: c=1→3, c=3→dp[3]+1=2, c=4→dp[2]+1=3. dp[6]=2
  return 2  (the 3+3 path, not greedy's 4+1+1)
  ```

**Why this matters** — *Tracing surfaces two important things. (1) The `[1,3,4] amount=6` case is the textbook reason DP beats greedy: greedy picks the largest coin first and gets stuck. (2) The `[2] amount=3` case validates the `Infinity` sentinel — `Infinity + 1 === Infinity`, so the propagation works without any guard clauses, and the final `=== Infinity → -1` check is the only special-case branch.*

##### 5. Edge cases to mention

> What inputs would trip up a careless implementation?

**What I'd say** — "Before I declare it done, let me think about edges:
• `amount = 0` — `dp[0] = 0`, loop doesn't run, return 0. ✓
• Empty `coins` — every `dp[a]` for `a > 0` stays Infinity, return -1 for any positive amount. (Should clarify: do we even get empty coins?)
• `amount` smaller than the smallest coin — every coin is bigger, inner `if (c <= a)` skips, dp[a] stays Infinity. Returns -1.
• Coin value equals amount — `dp[a]` should be 1 via `dp[0] + 1`. Walked through it: works.
• Very large amount with small coins (e.g. coins=[1], amount=10000) — runs in `O(10000 × 1) = 10^4` ops, fine. The complexity is tight but the constant is small.
• Duplicate coins in the input — irrelevant for correctness (you'd just try the same coin twice per cell), but a dedupe would shave a tiny constant."

**Why this matters** — *The `amount = 0` case validates the seed without needing a guard — that's a senior signal, showing the recurrence's invariant is robust. The greedy-fail call-out (which you already made in section 4) is what justifies *why* this is DP and not a one-liner — interviewers often probe with 'why can't you just always use the biggest coin?'. Naming `[1,3,4] amount=6` as the counter-example is a clean rebuttal.*

##### 6. Complexity & wrap-up

> How would you defend the complexity claim?

**What I'd say** — "Time is `O(amount × coins.length)` — outer loop runs `amount` times, inner loop tries every coin, constant work per (amount, coin) pair. Space is `O(amount)` for the dp array.

The naive recursive version was `O(coins.length ^ amount)` — exponential. Memoization brings it to `O(amount × coins)` time / `O(amount)` space. Bottom-up tabulation keeps the same bounds with smaller constants (no recursion overhead).

For variants worth knowing: Coin Change II (count the *number of distinct ways* to make the amount instead of the minimum coins) — same `O(amount × coins)` shape, but you sum instead of taking min, and you iterate coins on the outer loop and amount on the inner to avoid double-counting permutations. The 0/1 knapsack (one coin of each) is also a small twist — iterate the amount in reverse to prevent reusing the same coin."

**Why this matters** — *Naming the `O(amount × coins)` bound with the exponential-to-polynomial trajectory is the defense — interviewers want to see you understand *why* DP saves you from the blow-up. The Coin Change II / 0/1 knapsack extensions prove you see the template family and know the loop-order trick (outer-vs-inner determines whether you count combinations or permutations). That same trick recurs in Combination Sum IV, Climbing Stairs Variant, and Partition Equal Subset Sum.*

---

