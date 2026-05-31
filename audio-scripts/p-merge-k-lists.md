# Audio scripts — Merge K Sorted Lists

> Each numbered block below is one MP3. Paste the script text (NOT the heading)
> into saythetext.com, generate the MP3, and save it to the matching path under
> `audio/p-merge-k-lists/`. Until those files exist, the player falls back to
> the browser's text-to-speech with two distinct voices.
>
> **Voice A** (the "say" voice — interview narration, conversational):
> recommend a male voice. e.g. saythetext.com's "Matthew" or "Joey".
>
> **Voice B** (the "why" voice — meta-commentary, slightly more reflective):
> recommend a female voice. e.g. saythetext.com's "Joanna" or "Salli".
>
> Lightly post-edit the source `data/linked-list/p-merge-k-lists.json` text to
> remove visual quotation marks around the candidate's lines and to convert
> bullet lists into spoken prose. Already done below.

---

## Section 1 — Restate and clarify

### Clip 1A — Voice A → `audio/p-merge-k-lists/s1-say.mp3`

Let me make sure I have this right. I'm given an array of k linked-list heads, each list already sorted ascending, and I need to return the head of a single merged sorted list. Total node count across all lists is N.

Then a few quick clarifying questions. Empty input array, k equals zero — return null? Lists containing only nulls, like an array of three nulls — also return null? Single list, k equals one — return that list as-is? Mutation OK — can I splice the existing nodes, or do I need to allocate fresh ones? And are k and N both potentially large, or is one of them bounded? Which one is bigger shapes which optimization wins. Heap when k is small relative to N, pairwise when k is large.

### Clip 1B — Voice B → `audio/p-merge-k-lists/s1-why.mp3`

The relative sizes of k and N are the load-bearing detail here. Both heap and pairwise divide-and-conquer hit O of N log k. The difference is constant factor and code complexity. The lists-containing-nulls question is the empty-input edge — it's not the same as an empty array, and a sloppy implementation would crash on lists-bracket-zero-bracket dot val if it didn't filter nulls or handle them in the merge. Asking surfaces both decision points cleanly.

---

## Section 2 — Brute force first, out loud

### Clip 2A — Voice A → `audio/p-merge-k-lists/s2-say.mp3`

Two brute forces worth naming. First, collect every value into one array, sort it, build a fresh list. O of N log N time, O of N extra space — and this ignores the precondition that the inputs are already sorted. Second, merge lists one at a time into an accumulator. Merge list one and list two, then merge that result with list three, et cetera. That uses my mergeTwo helper k minus one times.

But the math is bad. By round k, the accumulator has roughly N nodes and we're walking over it again. So the i-th merge processes roughly i times N over k nodes. Summing it up: N over k times the sum from one to k minus one, which is O of N times k. Way worse than what we can do.

The optimization is to balance the work. Instead of one growing accumulator, pair-merge in rounds so each node is touched at most log k times. That gets us O of N log k.

### Clip 2B — Voice B → `audio/p-merge-k-lists/s2-why.mp3`

Two reasons to walk through the bad-merge-order brute force explicitly. First, it proves you know why the naive just-merge-them-all approach is wrong. Many candidates write that and don't realize it's O of N times k. Second, it motivates the optimization. Pairwise merging isn't a clever new algorithm, it's the same mergeTwo applied in a smarter order. That framing makes the O of N log k bound feel earned rather than asserted.

---

## Section 3 — Spot the pattern

### Clip 3A — Voice A → `audio/p-merge-k-lists/s3-say.mp3`

There are two canonical patterns here, both hitting O of N log k.

Pattern one is pairwise divide-and-conquer. Pair adjacent lists, merge each pair, then pair the results, repeat. After log k rounds you have one list. Each round processes N nodes total — every node moves once per round — and there are log k rounds, so total work is N log k. This is what I'd reach for in JavaScript because the language doesn't ship a heap. Implementing one is a thirty-line detour.

Pattern two is a min-heap of size k. Maintain a heap of pairs — head value and list index. Pop the smallest, splice it onto the output, push its successor. Each pop and push is O of log k, and we do N of them. Same N log k bound, but lower constant in practice because each node moves exactly once instead of log k times.

The signal that points at either pattern is the phrase k sorted things, merge them all. That family always hits O of N log k. The choice between heap and pairwise is about language ergonomics and whether the interviewer asked for the absolute fastest constant.

### Clip 3B — Voice B → `audio/p-merge-k-lists/s3-why.mp3`

Naming both patterns and stating when to pick each one is the senior move. Most candidates either know only the heap version — and have to write a heap from scratch in JS, eating time — or only the pairwise version, and can't defend why they didn't use the heap. Saying I'd choose pairwise for JS, heap if I had heapq shows you understand the constraints driving the choice. Calling out each round processes N nodes, there are log k rounds is also the cleanest way to derive the bound on the spot.

---

## Section 4 — Trace through examples

### Clip 4A — Voice A → `audio/p-merge-k-lists/s4-say.mp3`

Let me trace through a couple of cases to make sure the model is right. Three inputs cover the interesting behaviors — the classic three-list case where the count is odd and the last list pairs with null, an empty input, and a power-of-two count where every round divides evenly.

First case: three lists, one-four-five, one-three-four, and two-six. Odd count, so round one pairs list zero with list one, and list two pairs with null and passes through unchanged. Merge of one-four-five with one-three-four gives one-one-three-four-four-five. Merge of two-six with null gives two-six. Now we have two lists. Round two pairs them. Merge of one-one-three-four-four-five with two-six gives one-one-two-three-four-four-five-six. One list left, done.

Second case: empty input. Length is zero, return null immediately. No pair-merging happens.

Third case: four lists, all length two — one-two, three-four, five-six, seven-eight. Power-of-two count, each round halves cleanly. Round one pairs them into one-two-three-four and five-six-seven-eight. Round two merges those into one through eight. Done in exactly two rounds, which is log base two of four.

### Clip 4B — Voice B → `audio/p-merge-k-lists/s4-why.mp3`

Tracing surfaces two specific bugs. First, the odd-count case with three lists confirms that mergeTwo of lists-i and lists-i-plus-one or null handles the unpaired tail without an explicit if. Most candidates either write a special case or forget the last list entirely. Second, the power-of-two trace counts the rounds. K equals four gives log base two of four equals two rounds, and each round processes all N nodes. That's the visual proof of the N log k bound. If you can count rounds and confirm all N nodes appear in this round's output, the math is right.

---

## Section 5 — Edge cases to mention

### Clip 5A — Voice A → `audio/p-merge-k-lists/s5-say.mp3`

Before I declare it done, let me think about edges.

Empty input array — return null immediately. Done.

All nulls, say lists is null comma null comma null. First round pairs them. mergeTwo of null and null is null, mergeTwo of null and null is null. Eventually one null remains. Return null. Done.

Single list, lists is just one head. The loop condition lists dot length greater than one is false, so return lists-bracket-zero-bracket as-is.

Single very long list, rest are short. Each round still touches all N nodes, but the bound is still O of N log k. The long list participates in every round but the work is proportional to its length each time.

K greater than N — more lists than total nodes, most are single-node or null. Log k rounds, but the per-round work is small. Still O of N log k. The bound holds.

Integer overflow not a concern here. We're moving pointers, not adding values.

Very large k, like millions. Log k is still small — about twenty for a million — so twenty rounds of N work is fine.

### Clip 5B — Voice B → `audio/p-merge-k-lists/s5-why.mp3`

The all-nulls case is the one most candidates miss. They assume each input list has at least one node. Walking through it shows the algorithm handles it because mergeTwo accepts null on either side. The k greater than N edge is the small-k-large-N inverse and confirms the bound generalizes. The pointer-movement-not-addition note about overflow is the senior reflex. Every numeric-feeling problem deserves a moment of overflow consideration, and this one happens to be safe.

---

## Section 6 — Complexity and wrap-up

### Clip 6A — Voice A → `audio/p-merge-k-lists/s6-say.mp3`

Time is O of N log k. Here's the argument. In each round we walk every node that's still in the input — call that N-prime — and produce N-prime nodes of output. Over log k rounds, every node is touched at most log k times. It pairs, gets merged into a longer list, that longer list pairs with another, and so on, log k times until one list remains. Total: N times log k.

Space is O of one extra beyond the input. We're splicing existing nodes, not allocating. The dummy node in mergeTwo is one node per merge call, but those are garbage-collected between calls. If you wrote this with a heap instead, you'd have O of k heap space.

If the interview wanted the heap version, here's the picture. Maintain a min-heap of val and list-index, seeded with each list's head. Pop, splice, push the successor. Each pop and push is O of log k. N total pops gives N log k. Both versions hit the same bound. Heap has a slightly lower constant but JavaScript doesn't ship one, so pairwise is the pragmatic interview answer.

### Clip 6B — Voice B → `audio/p-merge-k-lists/s6-why.mp3`

The each-node-touched-log-k-times argument is the clean defense. It generalizes immediately to mergesort, which is structurally the same algorithm applied to array indices instead of list pointers. Calling out the heap alternative — and its space cost — shows you've thought about the full design space. The JS-doesn't-ship-a-heap detail is the practical interview judgment. Yes, the heap version is theoretically the same bound, but if you have to spend five minutes writing a heap from scratch, you've eaten your interview time on infrastructure rather than the algorithm.
