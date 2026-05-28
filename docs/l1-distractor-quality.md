# L1 Distractor Quality Guide

> **The rule**: every wrong option in an L1 multiple-choice question must be a wrong answer a real engineer might pick. If you can eliminate an option without thinking, it failed.

This is the load-bearing reference for L1 distractor quality. Authoring a new
lesson? Read this before writing the `options` arrays. Auditing existing
lessons? Use the rubric in § Audit rubric.

L1 is the high-throughput surface — taps on a phone, 80% of study sessions
per `PROFILE.md`. A weak distractor turns the question into pattern-match
elimination ("the one weird option" wins by default), which trains the user
on test-taking, not on the concept.

---

## Weak distractors (replace these)

Anything in this list is a defect. The user can eliminate it without
engaging with the question's load-bearing idea.

### 1. Tautologies / hand-waves

Vague, unfalsifiable, dismissible at a glance.

- `"Style"`, `"Style choice"`, `"Style preference"`, `"Style only"`
- `"Performance"`, `"Performance only"`, `"It is faster"` (with no mechanism)
- `"Premature optimization"`, `"Pure microoptimization"`
- `"It depends"`, `"It depends on the body"`
- `"Convention"`, `"Aesthetics"`, `"Cosmetic preference"`
- `"Saves memory"` / `"Lower memory usage"` (with no mechanism)

### 2. Obvious nonsense

Factually wrong in a way no engineer would believe.

- `"Required by JavaScript"`, `"It is required by JavaScript"`, `"JavaScript requires it"`
- `"Required by the spec"`, `"Required by the runner"`, `"Required to compile"`
- `"setTimeout is deprecated"`, `"Browsers do not have setTimeout"`
- `"Sets cannot hold numbers"`, `"Sets cannot hold strings"`, `"Hash sets cannot store triplets"`
- `"Arrays cannot iterate backwards"`, `"Objects cannot store arrays"`
- `"JS optimizes the array away"`, `"JS hoisting"` (as a reason for an unrelated rule)

### 3. Invented APIs

A method/event/symbol that doesn't exist. Anyone who's typed enough JS
recognizes these as fake.

- `".error() callback"` for Promise rejection (no such method)
- `"Symbol.awaitable"`, `"Symbol.for('async')"` (not real)
- `"unhandledawait"` event (not real — it's `unhandledrejection`)
- Made-up regex flags, made-up array methods

### 4. Restatement of the answer

The distractor just paraphrases the correct option's premise without
asserting anything actually different.

- For "min-heap, because root is smallest of k kept" — distractor: `"A max-heap, because largest implies max"` (just restates the meaning of "max")

### 5. Sandbag throwaways

Default "none of the above" / "always throws" filler that contributes
nothing.

- `"None of the above"`, `"All of the above"` (when implausible)
- `"It throws"` / `"Throws TypeError"` / `"Throws an error"` when there is
  no plausible throw mechanism in the code being asked about
- `"Undefined behavior"`, `"Coincidence"`, `"Random failure marker"`

---

## Strong distractors (write these)

A strong distractor encodes a real wrong belief or a real adjacent concept.
A diligent engineer who half-remembers the topic will be tempted by it.

### 1. Genuine misconception

What a half-remembering engineer might actually assert.

- For "Why fast/slow pointers detect a cycle?" → distractor: *"Because slow
  eventually wraps around and overtakes fast"* (a real wrong mental model
  of pointer interaction in a cycle).

### 2. Adjacent-concept confusion

Swap in a similar-but-distinct API/feature. The reader has to know the
difference to eliminate it.

- `Symbol.iterator` vs `Symbol.asyncIterator`
- `Map` vs `Set` (presence vs key→value)
- `Array.fill` vs `Array.from`
- preorder vs inorder vs postorder traversal
- min-heap vs max-heap operations

### 3. Subtly wrong rule

Almost true. Breaks on an edge case. The reader has to know the edge.

- *"Two pointers requires a sorted array, which costs O(n log n)"* — true
  for sorted-array requirement, but the relevant question is asking about
  hash-map vs two-pointer where the array is already in indexed form.
- *"`==` unwraps the String wrapper but `===` does not"* — half-true; `==`
  does coerce, `===` doesn't.

### 4. Plausible-sounding fake mechanism

A made-up explanation that *sounds* engineered. Reads like a knowing
engineer making a structural argument.

- *"Map iteration is faster than array iteration on modern engines because
  of inline caches"* — fake but plausible.
- *"Eviction from a min-heap is O(n) instead of O(log k)"* — fake but
  sounds like the kind of nuance a senior would surface.

### 5. Inverted condition

The opposite of the truth — what a careless reader would pick after
skimming the question.

- For "count goes BELOW zero means not anagram" → *"count goes ABOVE zero
  means not anagram"*.
- For "check before set" → *"set before check"*.

### 6. Right-answer-to-different-question

Technically true but irrelevant to the asked question.

- The reader recognizes the statement is correct in isolation and has to
  notice it doesn't address what was asked.

---

## Hard invariants (when rewriting)

When improving distractors on an existing question — DO NOT:

1. Change the `q` text (narrow precision refinements like adding "untagged"
   or "FIRST" are allowed only if a new distractor genuinely requires the
   question to be sharper).
2. Change the correct option's text (the option at index `answer`).
3. Change the `answer` index. Replacement distractors take the **same
   positions** in the array as the weak ones they replace.
4. Change `explain`.
5. Touch `L2`, `L3`, `conversation`, `walkthrough`, `reference`, or any
   other field on the lesson.
6. Add or remove options. Each `options` array stays length 4.

---

## Domain accuracy

Replacement distractors must be **FALSE but PLAUSIBLE**. If you're not
sure whether a claim is true (especially about JS engine internals, spec
behavior, or an API), pick a different distractor. The goal is to test
real understanding, not to confuse with random facts.

Common slip-ups to avoid:
- "Objects don't preserve insertion order" — false; modern JS DOES preserve
  insertion order for non-integer-like keys.
- "Maps preserve insertion order" — true. Don't use as a wrong claim.
- "Array.prototype methods mutate" — depends on the method (`.sort` mutates,
  `.toSorted` doesn't). Don't blanket-claim.

If a draft distractor turns out to be true after a sanity check, it's not
a distractor anymore — it's a *second correct answer*. Rewrite it.

---

## Before/after exemplars

Real rewrites from the May 2026 distractor pass.

### EX1 — `two-sum.json` Q1: "Why check `seen.has(need)` BEFORE `seen.set`?"

**Before** (3 weak distractors):
- `"Premature optimization"` — tautology
- ✓ `"To avoid matching the current element with itself"`
- `"It is required by JavaScript"` — obvious nonsense
- `"Saves a hash collision"` — vague

**After**:
- `"So `seen.get(need)` returns the smaller of the two paired indices"` — plausible-sounding fake mechanism
- ✓ `"To avoid matching the current element with itself"`
- `"To preserve the Map's insertion order during iteration"` — adjacent-concept confusion (Maps DO preserve order, but it's unrelated)
- `"To skip storing duplicate values, keeping the Map small"` — subtly wrong rule

### EX2 — `a-debounce.json` Q3: "Why expose `tick(delta)` instead of real setTimeout?"

**Before**:
- `"setTimeout is deprecated"` — obvious nonsense
- ✓ `"Deterministic, synchronous testing without waiting for wall-clock"`
- `"tick is faster at runtime"` — tautology
- `"Browsers do not have setTimeout"` — obvious nonsense

**After**:
- `"setTimeout's minimum delay differs across runtimes, so tests would flake"` — plausible-sounding fake mechanism
- ✓ `"Deterministic, synchronous testing without waiting for wall-clock"`
- `"tick can fire before the debounce window even starts"` — inverted condition
- `"Real setTimeout would prevent the test from awaiting the callback's args"` — subtly wrong rule

### EX3 — `s-async.json` Q4: "How do you catch a rejected awaited Promise?"

**Before**:
- `"if (result.error)"` — invented API
- ✓ `"try/catch around the await"`
- `"It cannot be caught"` — obvious nonsense
- `".error() callback"` — invented API

**After**:
- `"Pass an onRejected callback as the second argument to await"` — adjacent-concept confusion (Promise.then takes onRejected; await doesn't)
- ✓ `"try/catch around the await"`
- `"Attach `.catch()` to the awaited expression — await unwraps the resolved branch only"` — subtly wrong rule (`.catch()` works on the promise, but the explanation reverses how await behaves)
- `"Listen for a `unhandledrejection` event inside the async function"` — adjacent-concept confusion (the event exists at the global scope, not inside the function)

### EX4 — `p-kth-largest.json` Q5: "kth LARGEST with size-k heap — which heap?"

**Before**:
- `"A max-heap, so the root is the largest element"` — genuine misconception ✓ KEEP
- ✓ `"A min-heap, so the root is the smallest of the k kept..."`
- `"Either works identically"` — genuine misconception ✓ KEEP
- `"A max-heap, because largest implies max"` — **restatement of the answer**

**After** (only the weak slot needed replacing):
- `"A max-heap, so the root is the largest element"`
- ✓ `"A min-heap, so the root is the smallest of the k kept..."`
- `"Either works identically"`
- `"A max-heap, because eviction from a min-heap is O(n) instead of O(log k)"` — plausible-sounding fake mechanism

This last example shows the **conservative bias**: most questions have 1-2
weak distractors and 1-2 strong ones. Replace the weak; keep the strong.

---

## Audit rubric

Use this rubric to score existing distractors (or your own drafts). One
score per option (0 or 1) — a question with 4 strong options scores 3/3
on its distractors.

- **1 — strong**: the option is a real misconception, adjacent concept,
  subtly wrong rule, plausible-sounding fake, inverted condition, or
  right-answer-to-different-question.
- **0 — weak**: matches any pattern in § Weak distractors.

A lesson's distractor health: `sum(strong distractors) / (total distractors)`.
Aim for 1.0. A bottom-quartile flag fires at <0.50.

This rubric is consumable by `.claude/skills/lesson-audit/` as the
`distractor-plausibility` rubric variant.

---

## Conservative bias

When auditing for rewrites: leave passable distractors alone. A complexity
question with three valid-but-wrong complexities (O(n²), O(n log n), O(1))
needs zero edits — those distractors *are* the lesson. The point of this
guide is to remove the throwaways, not to over-tune what already works.
