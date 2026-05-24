# Iter 19 — Coverage Gap List
*For iter 20+ ship-mode iterations to consume.*

> Produced by iter 19 frame-mode pass via 2 parallel fresh-eyes subagents:
> Agent A (internal syllabus audit, virgin-eyes on `data/manifest.json` + 10
> sampled lessons), Agent B (external benchmark via WebSearch across
> NeetCode 150, Blind 75, LC Top Interview 150, BFE.dev, GreatFrontend).
> Findings synthesized, ranked by **cross-source signal × profile fit ×
> authoring effort**.
>
> See `SELF-IMPROVE.md` § Blind spots ledger entries BS-01 through BS-05 +
> § External references consulted for the source links.

---

## Cluster 1 — Syntax/Algorithms boilerplate (HIGHEST LEVERAGE)
*Status: closes BS-02. Target section: Syntax/Algorithms (currently 3 lessons; this cluster doubles it).*

The Syntax/Algorithms section has 3 lessons (`sorting`, `s-stack-pattern`,
`s-queue-pattern`). The boilerplate the rusty engineer reaches for *before* the
algorithm exists ONLY inside Patterns lessons — it must be extracted by hand
each session instead of being drillable as standalone syntax.

### Tier 1 — ship in iter 20 (~70% of cluster coverage per Agent A)

| # | id | Title | Boilerplate captured |
|---|---|---|---|
| 1 | `s-matrix-neighbors` | 4-dir neighbor iteration | `const dirs=[[-1,0],[1,0],[0,-1],[0,1]]; for(const [dr,dc] of dirs){const nr=r+dr,nc=c+dc; if(nr<0\|\|...)continue;}` |
| 2 | `s-bfs-template` | BFS queue scaffold | `const q=[start]; const seen=new Set([key(start)]); while(q.length){const cur=q.shift(); for(const n of neighbors(cur)){if(!seen.has(...)){seen.add(...);q.push(n);}}}` |
| 3 | `s-tree-traversals` | Pre/in/post-order shapes | Three recursion shapes side-by-side: `function inorder(n){if(!n)return; inorder(n.left); visit(n); inorder(n.right);}` etc. |
| 4 | `s-ll-traversal` | LL walk idioms | Three sub-idioms: single walk, parallel walk (`while(a&&b)`), dummy head |
| 5 | `s-ll-fast-slow` | Fast/slow pointers (tortoise & hare) | `let slow=head,fast=head; while(fast&&fast.next){slow=slow.next; fast=fast.next.next;}` |
| 6 | `s-heap-ops` | Heap parent/child math | `parent=(i-1)>>1; left=2*i+1; right=2*i+2` + sift-up/sift-down skeleton |

### Tier 2 — ship in iter 21 (completes the cluster)

| id | Title | Boilerplate |
|---|---|---|
| `s-matrix-bounds` | Grid bounds idiom | `r>=0 && r<rows && c>=0 && c<cols` + `rows = grid.length; cols = grid[0].length` |
| `s-dfs-recursive-template` | Recursive DFS w/ visited | `function dfs(n, seen){if(seen.has(n))return; seen.add(n); for(const x of neighbors(n))dfs(x,seen);}` |
| `s-dfs-iter-template` | Iterative DFS w/ stack | `const stack=[start]; while(stack.length){const cur=stack.pop(); if(seen.has(cur))continue; seen.add(cur); …}` |
| `s-ll-node-shape` | Node constructors & helpers | `class ListNode{constructor(v,n=null){this.val=v; this.next=n;}}` + `toList(arr)` + `toArr(head)` |
| `s-binsearch-template` | Binary search invariants | Boundary discipline (`<=` vs `<`, `mid+1` vs `mid`) — frame as *invariants*, not the problem |
| `s-union-find` | Union-Find primitives | `find(x){if(p[x]!==x)p[x]=find(p[x]); return p[x];} union(a,b){p[find(a)]=find(b);}` |
| `s-grid-init` | 2D array creation | `Array.from({length:rows},()=>Array(cols).fill(0))` + the `Array(n).fill([])` shared-ref gotcha (place in **Arrays**, not Algorithms) |

**Section reorg recommendation:** rename/split Syntax/Algorithms into "Data Structure Primitives" (stack, queue, heap-ops, LL helpers, union-find) and "Traversal Templates" (BFS, DFS-iter, DFS-recursive, tree, binsearch, matrix-neighbors+bounds+init). Check mobile drawer ergonomics first; if 16 lessons in one section reads fine, keep it flat.

---

## Cluster 2 — Cross-source consensus problems (Patterns track)
*Status: closes BS-01. Sequencing TBD — too large for one ship; needs user prioritization.*

Top problems appearing on ≥2 external rubrics that the app doesn't cover:

| id | Problem | Sources | Section |
|---|---|---|---|
| `p-product-except-self` | Product of Array Except Self | Blind75, NC150, LC150 | Arrays & Hashing |
| `p-longest-palindromic-substr` | Longest Palindromic Substring | Blind75, NC150, LC150 | DP / Strings |
| `p-palindromic-substrings` | Palindromic Substrings | Blind75, NC150 | DP |
| `p-longest-rep-char-replace` | Longest Repeating Char Replacement | Blind75, NC150 | Sliding Window |
| `p-house-robber-ii` | House Robber II | Blind75, NC150 | DP |
| `p-decode-ways` | Decode Ways | Blind75, NC150 | DP |
| `p-alien-dictionary` | Alien Dictionary (topo sort on chars) | Blind75, NC150 | Graphs |
| `p-graph-valid-tree` | Graph Valid Tree | Blind75, NC150 | Graphs |
| `p-kth-smallest-bst` | Kth Smallest in BST | Blind75, NC150, LC150 | Trees |
| `p-subtree-of-tree` | Subtree of Another Tree | Blind75, NC150 | Trees |
| `p-diameter-tree` | Diameter of Binary Tree | NC150, common | Trees |
| `p-word-ladder` | Word Ladder (BFS shortest path) | NC150, LC150 | Graphs |
| `p-rotting-oranges` | Rotting Oranges (multi-source BFS) | NC150, LC150 | Graphs |
| `p-eval-rpn` | Eval Reverse Polish Notation | NC150, LC150 | Stack |
| `p-generate-parens` | Generate Parentheses (canonical backtrack) | NC150, LC150 | Backtracking |
| `p-copy-list-random` | Copy List w/ Random Pointer | NC150, LC150 | Linked List |
| `p-non-overlap-intervals` | Non-overlapping Intervals | Blind75, NC150 | Intervals |
| `p-happy-number` | Happy Number (cycle detection on numbers) | NC150, LC150 | Math/Cycle |

---

## Cluster 3 — JS-specific concept gaps
*Status: closes BS-03. Queue for coverage iter ~22.*

These items algorithmic-pattern lists don't cover, but they matter for JS-role interviews:

| id | Title | Why | Section |
|---|---|---|---|
| `s-promise-combinators` | `Promise.all` / `allSettled` / `race` / `any` | High-frequency interview L1 ("which one rejects first?") | Async |
| `s-async-loops` | Sequential vs parallel async iteration | Classic gotcha (`forEach(async)` antipattern) | Async |
| `s-equality` | `==` vs `===` vs `Object.is`, NaN | Pure L1 gold (`NaN===NaN // false`) — surprisingly missing | Basics |
| `s-hoisting-tdz` | Hoisting + Temporal Dead Zone | GFE top question | Basics |
| `s-structured-clone` | `structuredClone` vs JSON-clone vs lodash | BFE staple | JS Toolbox |
| `s-abort-controller` | `AbortController` + `AbortSignal` | GFE staple (fetch cancel, listener cleanup) | Async |
| `s-weakmap-weakref` | `WeakMap` / `WeakRef` use cases | Memory-safe caches | Hash Structures |

---

## Cluster 4 — Modern syntax gaps
*Status: closes BS-05. Modern Syntax section is thin (3 lessons); this doubles it.*

| id | Title | Section |
|---|---|---|
| `s-rest-params` | Rest parameters + default args (`function f(a, b=1, ...rest)`) | Modern Syntax |
| `s-computed-keys` | Computed + shorthand object keys (`{ [k]: v, foo, ...rest }`) | Modern Syntax |
| `s-logical-assignment` | `\|\|=`, `??=`, `&&=` | Modern Syntax |
| `s-array-modern` | `flat` / `flatMap` / `findLast` / `findLastIndex` / `toSorted` / `toReversed` | Arrays |
| `s-string-modern` | `padStart` / `padEnd` / `repeat` / `.at()` | Basics |

---

## Cluster 5 — Hash / Set / Map ergonomics
*Status: sibling of BS-02. Hash Structures section has 3 lessons; this adds the workhorse idioms.*

| id | Title | Captures |
|---|---|---|
| `s-counter-pattern` | Frequency counter | `for(const x of arr) map.set(x,(map.get(x)\|\|0)+1)` |
| `s-groupby-pattern` | Group-by into Map | `reduce` form + new `Object.groupBy` / `Map.groupBy` |
| `s-set-ops` | Set union / intersect / diff | `new Set([...a].filter(x=>b.has(x)))` etc. |

---

## Cluster 6 — Frontend utility lessons (Applied track)
*Status: closes BS-04. Applied track is 20 lessons; this is a focused expansion.*

| id | Title | Source |
|---|---|---|
| `a-dom-traversal` | `querySelector` polyfill | GFE/BFE |
| `a-event-delegation` | Event delegation pattern | GFE/BFE |
| `a-classnames` | `classNames()` / `clsx` implementation | BFE staple |
| `a-retry-backoff` | Retry with exponential backoff | common |
| `a-concurrency-pool` | Promise concurrency pool (`pLimit` / `mapLimit`) | Meta/Stripe top ask |
| `a-cancellable-promise` | Cancellable promise + AbortController | common |
| `a-deep-equal` | `_.isEqual` deep equality | BFE |
| `a-flatten` | Flatten nested array/object with depth | common |

---

## What to skip (analyzed, rejected)

- **Sliding-window / two-pointer / backtracking templates as standalone syntax** — `valid-palindrome` + `p-3sum`, `best-time-stock` + `p-longest-sub` + `p-min-window`, `p-subsets` + `p-permutations` + `p-combination-sum` already triangulate the shape with enough variation that an abstract version would be too vague.
- **DP table init / memo wrapper as syntax** — too many flavors (1D, 2D, top-down, bottom-up); better taught per-problem in existing DP patterns lessons.
- **`Symbol` deep dives, `Proxy`, `Reflect`** — out of scope for typical JS interviews; not the rusty-engineer's bottleneck.
- **Algorithmic variants where the existing Pattern lesson is representative enough** (e.g., Subsets II, Combination Sum II, Word Ladder II once Word Ladder is covered).

---

## Recommended sequencing

| Iter | Mode | Scope |
|---|---|---|
| **20** | ship | Cluster 1 Tier 1 (6 lessons) — highest leverage, single cohesive theme |
| 21 | ship | Cluster 1 Tier 2 (7 lessons) — completes the boilerplate cluster |
| 22 | ship | Cluster 4 (5 lessons) — Modern Syntax doubles from 3 → 8 |
| 23 | ship | Cluster 5 (3 lessons) + Cluster 3 Tier 1 (3-4 lessons) — async + hash idioms |
| 24 | audit | Validate the syntax expansion: do the new boilerplate lessons get touched in real drill sessions? Density still ≥3 L1 / ≥2 L2? CDP probe for navigation flow at mobile width with the larger Algorithms section |
| 25 | coverage | Re-benchmark against Cluster 2 / Cluster 6 with user priority signal |

**Defer to user steering:** Cluster 2 (18 canonical missing problems — too big for one ship; user picks priority sub-categories) and Cluster 6 (Applied utilities — overlap with user's interest in DOM/concurrency vs. pure JS utilities should be confirmed before authoring).
