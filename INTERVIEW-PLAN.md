# Eve AI Interview — 4-Day Plan

> Generated 2026-05-24 from your diagnostic. Interview ~4 days out.
> Stack: JavaScript / TypeScript. Format: algorithmic round with real-world framing.

---

## Your diagnostic, decoded

| Section | Score | Read |
|---|---|---|
| Pattern Recognition | **10/12 (83%)** | **Strong.** You can name the technique. This is the hardest skill to build cold — you have it. |
| Complexity | 4/6 (67%) | Decent. Missed `indexOf`-in-loop trap and heapify trivia. |
| Trade-offs | 3/6 (50%) | Specific gaps: BFS vs DFS, greedy vs DP, didn't reach 2 questions. |
| Edge Cases | 2/5 (40%) | JS sort gotcha + binary-search invariants are your weakest area. |
| Trace/Predict | 2/4 (50%) | Reading code carefully under pressure needs reps. |
| Insight (short) | 8/10 answered | Mixed — see below. |

### What this actually means (the 5 big rocks)

1. **BFS vs DFS confusion.** You picked DFS for "shortest path in unweighted graph" (always BFS), and your notes say you forgot which is which. Both code shapes need to be muscle memory by Day 2.
2. **Binary search.** You couldn't spot the off-by-one bug, didn't answer the invariant question, and your s03 answer ("a for loop over a queue?") confused binary search with BFS/DFS. **This is the highest-leverage fix** — binary search shows up everywhere and you currently don't have the algorithm structure in your head.
3. **JS sort gotcha.** You expected `[10,2,5].sort()` to return `[2,5,10]`. It returns `[10,2,5]`. Every JS interview will test this. Memorize: **`arr.sort((a,b) => a - b)` for numbers, always.**
4. **Substring vs subsequence is BACKWARDS in your head.** You wrote "Subsequence is a contiguous sequence." It's the opposite. **Substring = contiguous. Subsequence = order-preserving but gappy.** Fix today.
5. **Kadane's algorithm is missing.** You skipped s01. Kadane's max-subarray is high-frequency and trivially elegant once you see it. ~15 min to learn forever.

### What you already have (don't waste time on this)
- Hash maps for lookup (Two Sum, Contains Duplicate) — solid.
- Stack-for-parens recognition — solid.
- Heap-of-K intuition — your s05 answer was nearly perfect.
- Sort-then-sweep for intervals — your s07 was correct.
- Sliding window concept (you knew rate-limiter was sliding window in s09).

---

## Glossary (memorize before Day 2 — these blocked you in the diagnostic)

| Term | Definition | Where it shows up |
|---|---|---|
| **monotonic** | Always moving in one direction — non-decreasing or non-increasing. A monotonic stack only keeps elements in sorted order; popping smaller-than-current ones. | "Daily Temperatures", "Sliding Window Maximum", "Largest Rectangle in Histogram". Also: sliding window only works cleanly when the window-sum is monotonic as you grow it (breaks with negative numbers). |
| **insertion-ordered iteration** | When you iterate a structure, you get items back in the order you inserted them. `Map` and `Set` guarantee this; plain `Object` historically didn't (now mostly does, but with weird rules for integer-like keys). | "I need to remember the order users were added" → use Map, not Object. |
| **loop invariant** | A statement that is true at the start of every iteration of a loop. The contract that proves the algorithm works. | Binary search: "if the target exists, it's in `[lo, hi]`." Two-pointer: "all valid pairs lie between `left` and `right`." |
| **trie** (prefix tree) | A tree where each node represents one character, and paths from root spell out words. Lookups by prefix are O(prefix length) regardless of dictionary size. | Autocomplete, spellcheck, "does any word in this dictionary start with X?", IP routing tables. For Eve AI: legal term suggestion. |
| **BFS** (Breadth-First Search) | Explore neighbors level by level. Uses a **queue**. First time you reach a node = shortest path (in edges). | Shortest path in unweighted graph. Level-order tree traversal. Spreading infection / fire / water. |
| **DFS** (Depth-First Search) | Explore as deep as possible before backtracking. Uses **recursion** or an explicit **stack**. | Counting connected components. Checking reachability. Tree traversals (in/pre/post). Cycle detection. Topological sort. |
| **in-order / pre-order / post-order** | Tree DFS traversal orderings. **Pre-order**: visit node, then left, then right. **In-order**: left, node, right (yields sorted output on a BST). **Post-order**: left, right, then node (used when children's results feed the parent — e.g. tree height, deletion). | BST → in-order gives sorted. Computing tree height → post-order. Serializing → pre-order. |
| **topological sort** | Linear ordering of a DAG (directed acyclic graph) such that every edge `u → v` has `u` before `v`. Detects cycles as a side effect. | Course schedule. Build dependency resolution. Spreadsheet recalc order. |
| **Dijkstra's algorithm** | Shortest path on a **weighted** graph with **non-negative** weights. BFS + priority queue. | Maps/routing. Network latency. **NOT needed for unweighted graphs (BFS is enough).** |
| **Union-Find** (Disjoint Set Union, DSU) | A structure for "are these two things in the same group?" with `union(a,b)` and `find(a)` operations. Near-O(1) amortized. | Number of connected components. Detecting cycle in undirected graph. Kruskal's MST. |
| **DP** (dynamic programming) | Break a problem into overlapping subproblems, store each result so you don't recompute. Either top-down (memoized recursion) or bottom-up (fill a table). | Coin change, edit distance, longest common subsequence, knapsack. |
| **substring** | A **contiguous** chunk of a string. `"abc"` has substrings `""`, `"a"`, `"ab"`, `"abc"`, `"b"`, `"bc"`, `"c"`. | Longest substring without repeating chars (sliding window). |
| **subsequence** | An ordered selection of characters, **not necessarily contiguous**. `"ace"` is a subsequence of `"abcde"`. | Longest common subsequence (DP). Longest increasing subsequence. |
| **prefix sum** | An array where `prefix[i] = arr[0] + ... + arr[i]`. Lets you compute the sum of any range in O(1). | Range-sum queries. Sliding window over arrays that may contain negatives. |
| **deque** (double-ended queue) | A queue you can push/pop from BOTH ends in O(1). In JS you can fake one with an array + index pointers, or just use an array carefully. | Rate limiter (evict from front, push to back). Sliding window maximum (monotonic deque). |

> When/if you build a glossary feature into the app later, this is the starter content.

---

## The 4-day schedule

Targets: **4–8 hours/day**. Days are structured **morning / afternoon / evening** but you can shuffle. Pomodoro recommended: 50 min focused / 10 min walk-around-break. Don't skip the breaks — your retention drops off a cliff at hour 2 without them.

Lessons are referenced by their app ID (e.g. `binary-search`). Use `/` to search the sidebar.

### Day 1 (Today, Sat) — Foundations & gap-fills

**Morning (~2 hr) — Clear the 5 big rocks.**

- (30 min) Read the **Glossary** above. Out loud. Twice. Especially: monotonic, in-order vs pre-order vs post-order, substring vs subsequence.
- (30 min) Write each of the **6 Must-Know Code Shapes** (below) on a blank page from memory. Compare to the cheatsheet. Repeat anything you got wrong.
- (45 min) Drill these lessons specifically because you got them WRONG in the diagnostic:
  - `sorting` (Algorithms section) — **the JS sort gotcha that bit you**
  - `binary-search` (Binary Search section) — re-read invariants carefully
  - `s-bfs-template` (Algorithms section)
  - `s-tree-traversals` (Algorithms section) — drill in-order vs pre-order vs post-order
  - `p-max-subarray` (Greedy section) — **this is Kadane's; you don't know it; learn it now**
- (15 min) Re-read your wrong answers in the diagnostic JSON, look at the correct ones, say "ah" out loud.

**Afternoon (~3 hr) — Arrays & Hashing + Two Pointers, full coverage.**

In order, do every lesson in:
- Arrays & Hashing (6): `two-sum`, `p-contains-dup`, `p-anagrams`, `p-valid-anagram`, `p-encode-decode-strings`, `p-longest-consecutive`
- Two Pointers (4): `valid-palindrome`, `p-3sum`, `p-container`, `p-trapping-rain`

Do L1 + L2 for all 10. Do L3 for **at least** `two-sum`, `p-3sum`, `valid-palindrome`. If time, more.

**Evening (~1–2 hr, optional but recommended) — Mock pressure.**

- Open the app's **Mock Interview mode**. 30 min, 3 problems from above sections. No hints.
- Whichever ones you got stuck on, re-do the L3 the next morning before starting Day 2.

**End-of-day checkpoint:**
- ☐ I can write binary search from memory in <2 min with correct invariants.
- ☐ I can name when BFS vs DFS, and write the queue/stack scaffold for each.
- ☐ I no longer have to think about `(a,b) => a - b`.
- ☐ I know what Kadane's does in one sentence.

---

### Day 2 (Sun) — Pattern power day (windows, stacks, trees, lists)

**Morning (~3 hr) — Sliding Window + Stack.** These are your highest-ROI patterns for the "real-world" framing of an Eve AI interview.

- Sliding Window (4): `best-time-stock` (you got this WRONG in diagnostic — pay attention to "running-min" pattern, not "window-of-2"), `p-longest-sub`, `p-min-window`, `p-sliding-window-max`
- Stack (4): `valid-parens`, `p-daily-temp` (monotonic stack!), `p-min-stack`, `p-largest-rect-hist`

Goal: L1+L2 on all 8. L3 on `best-time-stock`, `p-longest-sub`, `valid-parens`, `p-daily-temp`.

**Afternoon (~3 hr) — Binary Search + Linked List.**

- Binary Search (3): `binary-search`, `p-rotated`, `p-koko-bananas`
  - **CRITICAL**: re-derive the invariant out loud on each. Say: "target is in `[lo, hi]`. After the loop, `lo === hi + 1`, so target wasn't there." If you can't explain the invariant, you don't own the algorithm.
- Linked List (3 — the essentials only): `p-reverse-list`, `p-cycle` (fast/slow!), `p-merge-two-sorted`

**Evening (~1.5 hr) — Tree shape drill.**

- Open a blank editor (or paper). Write from memory, 3 times each:
  - BFS level-order on a binary tree (queue, level-size pattern)
  - DFS recursive in-order
  - DFS recursive post-order (because tree-height uses it)
  - DFS iterative pre-order with explicit stack (because some interviews bar recursion)
- Then drill: `p-max-depth`, `p-invert`, `p-bfs`, `p-same-tree`

**End-of-day checkpoint:**
- ☐ I can write the BFS-queue + DFS-recursive scaffolds without thinking.
- ☐ I can explain WHY binary search terminates correctly, not just that it does.
- ☐ I know what "monotonic stack" means and what kind of problem it solves.

---

### Day 3 (Mon) — Synthesis + first mock

**Morning (~3 hr) — Trees / Heap / Intervals.**

- Trees (rest): `p-valid-bst`, `p-lca-bst` (LCA is a common ask), `p-construct-tree`
- Heap (2): `p-kth-largest`, `p-top-k-frequent`
- Intervals (3): `p-merge-intervals`, `p-meeting-rooms-ii`, `p-insert-interval`

For Eve AI specifically (legal AI, document-heavy, AI-call-throttling) — **intervals + heap-of-K + sliding window are the most likely "real-world-flavored" question types**. Spend extra love here.

**Afternoon (~2.5 hr) — Graphs + Greedy/DP basics.**

- Graphs (3): `p-islands`, `p-course` (topological sort — your topo-sort confusion), `p-clone-graph`
- Greedy / DP intro (3): `p-max-subarray` again (Kadane's lock-in), `p-climbing-stairs`, `p-coin-change`

**Evening (~1.5 hr) — Real mock interview.**

- Open app → **Mock Interview mode**. Pick a random pattern problem. **Treat it 100% real**: timer on, no hints, no peeking, talk out loud as you go (record yourself if you can — surprisingly useful).
- Do 2–3 problems.
- Score yourself: did you state the brute force? Did you state the optimal approach BEFORE coding? Did you state complexity? Did you test against an edge case?

**End-of-day checkpoint:**
- ☐ I have written ≥40 L3 problems this weekend.
- ☐ I can do a full mock problem (problem statement → brute force → optimal → code → test → complexity) in 25–30 min.
- ☐ I know which 2 data structures I reach for first when I see "top K something".

---

### Day 4 (Tue, interview eve) — Lock-in, then stop

**Morning (~2 hr) — Re-do the diagnostic.**

- Open `diagnostic.html` again. Click "Restart". Re-take the whole thing.
- Should take 25–30 min the second time. Export the JSON, send to me. We'll compare to Day 0 and identify the residual 2–3 weak spots.

**Late morning / early afternoon (~2 hr) — Targeted reread.**

- Whatever the redo flagged, drill those specific lessons one more time.
- Re-write each of the 6 Must-Know Code Shapes from memory. They should flow.

**Late afternoon (~1 hr) — Strategy review, NOT new material.**

- Re-read **"Interview-day behavior"** (below).
- Re-read your **Glossary**.
- Skim, don't drill. New material the day-before is anxiety fuel and does not stick.

**Evening — STOP.**

- No drilling after dinner. None.
- Walk. Eat. Hydrate. Phone away from bed.
- 8+ hours sleep. Sleep is when the day's drilling consolidates — it's literally a productive use of the night before.

---

## Must-know code shapes (write these from memory until they flow)

You should be able to produce all 6 of these in a blank editor in under 2 min each by Day 3.

### 1. Binary Search (closed interval — the version I prefer)
```js
function binarySearch(arr, target) {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {                        // closed: <= because hi is inclusive
    const mid = lo + ((hi - lo) >> 1);      // overflow-safe (matters in other langs)
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
// Invariant: if target exists in arr, it's always in arr[lo..hi].
```

### 2. BFS (graph or tree level-order)
```js
function bfs(start, getNeighbors) {
  const queue = [start];
  const visited = new Set([start]);
  while (queue.length) {
    const node = queue.shift();              // ok for small inputs; use deque for large
    for (const next of getNeighbors(node)) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
}
// For LEVEL-ORDER on a tree: capture queue.length at the top of each iteration —
// that's the number of nodes in the current level.
```

### 3. DFS recursive
```js
function dfs(node, visited = new Set()) {
  if (!node || visited.has(node)) return;
  visited.add(node);
  // pre-order work HERE (before recursing)
  for (const next of node.neighbors) dfs(next, visited);
  // post-order work HERE (after recursing — used for "bubble up" answers like tree height)
}
```

### 4. Sliding Window (variable size)
```js
function longestGoodWindow(arr, isValid) {
  let left = 0, best = 0;
  // state describing the current window — depends on the problem (set, map, sum, count)
  const state = {};
  for (let right = 0; right < arr.length; right++) {
    add(arr[right], state);
    while (!isValid(state)) {                // shrink from left until valid again
      remove(arr[left], state);
      left++;
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}
// Works when the "valid window" condition is MONOTONIC as you grow the window.
// Breaks if growing can both make it more AND less valid (e.g. sums with negatives).
```

### 5. Two Pointers (sorted array, pair-sum class)
```js
function twoSumSorted(arr, target) {
  let l = 0, r = arr.length - 1;
  while (l < r) {
    const sum = arr[l] + arr[r];
    if (sum === target) return [l, r];
    if (sum < target) l++;                  // need bigger → move left up
    else r--;                               // need smaller → move right down
  }
  return [-1, -1];
}
// Key insight: at each step, you eliminate ALL pairs involving the moved index.
```

### 6. Heap-of-K (for "K most ___" problems)
JS has no built-in heap. In a real interview, either implement a min-heap quickly OR
explain it verbally and proceed with a sorted-array stand-in. Sketch:
```js
// Find K largest in a stream:
// - maintain a min-heap of size K
// - on each new value v: if heap.size < K, push; else if v > heap.top, pop+push
// - at the end, heap contains the K largest; the root is the K-th largest
//
// Complexity: O(N log K) time, O(K) space.
//
// If you can't implement heap in time, say so: "I'd reach for a min-heap of size K.
// In JS I'd normally pull a heap library, but I can implement sift-up/sift-down if
// you want — or for this scratch pass I'll sort the buffer to demonstrate the
// algorithm, then we can swap in the heap." → Interviewers respect that framing.
```

### Cheatsheet: which pattern when?

| Problem says... | First thing to try |
|---|---|
| "pair sum", "two numbers that..." | Hash map (need indices) or sort + two-pointer (need values) |
| "longest/shortest substring/subarray with..." | Sliding window |
| "valid parens", "next greater element", "find span" | Stack (monotonic stack for next-greater) |
| "sorted" and "find" | Binary search |
| "shortest path" in unweighted graph | BFS |
| "all paths" or "connected components" | DFS |
| "course order", "build dependency" | Topological sort |
| "top K", "K largest/smallest/most frequent" | Min-heap of size K (or bucket sort if values bounded) |
| "overlapping intervals", "merge schedules" | Sort by start, sweep |
| "rate limit", "throttle", "last N events" | Sliding window over a deque of timestamps |
| "rotated sorted", "find pivot" | Modified binary search |
| "cycle in linked list", "middle of list", "Nth from end" | Fast/slow pointers |
| "all subsets/permutations/combinations" | Backtracking (recursion + try/undo) |
| "min cost / fewest steps" with overlapping subproblems | DP |
| "running max subarray sum" | Kadane's (reset to 0 when running sum goes negative) |

---

## Interview-day behavior (read morning-of, don't skip this)

A correct algorithm with bad process can lose to a brute-force with good process. The process points:

1. **Read the problem fully. Restate it back.** "So, just to confirm — I'm given X, and I need to return Y, with constraints Z. Is that right?" This catches the 30% of cases where you misread the problem.

2. **Ask 2 questions BEFORE coding.** Always.
   - Input bounds? (10? 10^4? 10^9? — changes the algorithm)
   - Any special inputs to handle? (Empty? Negative? Duplicates? `null`?)
   - Can I mutate the input?

3. **State brute force, then state optimal, BEFORE coding.** Out loud. Even if obvious.
   - "Brute force is O(N²) — nested loop. We can do better with a hash map — O(N) time, O(N) space. I'll code the hash map version."
   - This is the #1 thing interviewers grade for "did they think before coding".

4. **Code, narrating in chunks.** Don't dictate every character. Say: "Now I'll loop over the array, looking up `target - x`..." then code.

5. **Test against 3 inputs, on paper:** the example given, an edge case (empty / single element / max), and one tricky case (duplicates / negatives / wrap-around).

6. **State complexity at the end.** Time AND space. "This is O(N) time and O(N) space."

7. **If stuck**: say "let me think out loud about what's blocking me." Vocalize. The interviewer can nudge you if you're vocal. Silent stuck = no signal.

### Eve AI specifically — likely flavors

Legal AI, document-heavy. Bet on:
- **Strings/parsing** (clause extraction, tokenizing): hash map, two-pointer, sliding window.
- **Intervals** (overlapping clauses, citation spans): sort + sweep.
- **Top-K ranking** (most-relevant documents/chunks): heap.
- **Throttling / queueing** (managing LLM calls): sliding window over timestamps, queue/deque.
- **Tree/graph traversal** (document AST, citation graph): BFS/DFS.
- **Maybe** diff/edit distance between document versions: 2D DP. (DP is a stretch — if it comes up, fall back to two-pointer brute force and articulate the DP idea.)

Less likely (deprioritize): bit manipulation, advanced DP, backtracking puzzles.

---

## Adjustments I'll make once you send Day 4's redo

After Day 4 morning, send me the new diagnostic JSON. I'll diff it against this one and:
- Drop you a "final 60-min targeted review" list of the 5 specific things still soft.
- Adjust the Eve AI-specific question types prediction based on any new signal.

---

## TODOs for after the interview (not now — flagged for later)

- Build a `glossary` feature into the app — your post-diagnostic note nailed this.
- Add an `s-binary-search-template` syntax lesson explicitly drilling the invariant.
- Add a `concept-confusables` mode that interleaves easily-confused pairs (BFS/DFS, sub/seq, in/pre/post-order).

Good luck. You're not as far back as you think — your pattern recognition is the part you can't fake, and it's still there. The next 4 days are about restoring **execution speed** on top of recognition.
