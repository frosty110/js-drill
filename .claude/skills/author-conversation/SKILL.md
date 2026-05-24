---
name: author-conversation
description: Author the `conversation` block on an existing Patterns or Applied lesson — the interview-narration walkthrough that simulates how a candidate would diagnose, plan, and verify the solution out loud. Forces a 6-section interview arc with a say/why color-split discipline (what you'd verbalize vs. why the move matters), plus a multi-example trace section. Bundles the schema, voice rules, shape-specific section variations, and the validator step. Use when adding conversation to a single lesson, a batch from a sub-agent, or filling a topical gap.
---

# author-conversation

You are adding the `conversation` block to one or more existing Patterns/Applied lessons. The block enables a Conversation tab where users tap through collapsible sections that simulate an interview: what the candidate would say at each step, why that move matters, and worked examples to trace through.

This is the **artisanal, voice-dependent layer**. The validator can only check structure (≥3 sections, each has a title + body). Quality is the author's responsibility. The single most common failure mode is generic, glib content that doesn't sound like a real engineer thinking out loud — guard against this by writing in concrete first-person voice with the actual quoted lines you'd say.

## Required reading (load now, before writing anything)

1. `CLAUDE.md` — § "Who this is for + how it learns" + § "Adding a new lesson"
2. `PROFILE.md` — the entire doc. The target user is a rusty-but-experienced engineer prepping for interviews. Your voice must match what would resonate with that person.
3. The **canonical exemplar**: `data/sliding-window/p-longest-sub.json` — read the entire `conversation` block. The 6-section arc, say/why split, and worked-examples structure are the format spec.
4. **2-3 shape-matched exemplars** for the lessons you're authoring. Find these via `ls data/<slug>/*.json` and pick existing conversation blocks from analogous shapes (hash-map → look at hash-map exemplars; two-pointers → look at two-pointers exemplars).
5. The lesson's own `reference.code`, `description`, and `L3.prompt` — your conversation must be about THIS specific problem, not a generic version of its shape.

## The schema

Add a `conversation` block to the lesson JSON, alongside `walkthrough` / `reference` / `L1` / `L2` / `L3`:

```jsonc
"conversation": {
  "intro": "One sentence orienting the user. Optional.",
  "sections": [
    {
      "title": "1. Restate & clarify",
      "prompt": "Before touching code — pin down the inputs.",
      "say": "\"...the actual words you'd speak...\"",
      "why": "..."
    },
    {
      "title": "2. Brute force first (out loud)",
      "prompt": "...",
      "say": "...",
      "why": "..."
    },
    // ... 4 more sections ...
    {
      "title": "4. Trace through examples",
      "prompt": "...",
      "intro": "Optional preamble before the examples.",
      "examples": [
        { "input": "\"abcabcbb\"", "output": "3", "note": "...", "trace": "step-by-step text..." }
      ],
      "why": "..."
    }
  ]
}
```

Field discipline per section:
- `title` — short numbered heading. Always visible. Use "1. " / "2. " / etc. — the numbering reinforces the arc.
- `prompt` — italic subtitle, always visible. Frames what the section is *about*. One sentence.
- `say` — the actual script you'd verbalize. Multi-paragraph OK (separate with `\n\n`). Quote lines you'd literally speak: `"\"Let me make sure I have this right…\""`.
- `why` — the rationale/coaching footnote. Why this move matters to an interviewer.
- `examples` — used in the "Trace through examples" section. Array of `{input, output, note, trace}` per worked example.
- `intro` — per-section preamble, only used in the examples section (preceeds the example sub-blocks).

## Step 1 — Identify the lessons & the shape

For each lesson, write down:
- `id`, `slug` (folder)
- Algorithm shape: sliding-window, two-pointers, hash-map, binary-search, BFS, DFS, DP-1d, DP-2d, backtracking, intervals, monotonic-stack, heap, trie, etc.
- Brute force you'd describe in section 2 (O(n²) typically)
- The "trigger signal" that points to the chosen pattern (section 3)
- 2-3 example inputs + expected outputs for section 4
- 4-6 edge cases worth calling out (section 5)
- Time and space complexity with the amortization argument (section 6)

Batch by shape — same-shape lessons share section-3 (pattern triggers), section-5 (edges), section-6 (complexity arguments) almost verbatim. Authoring them together is faster.

## Step 2 — Write the 6 sections

The canonical arc:

### 1. Restate & clarify
- **SAY**: Restate the prompt in your own words. Ask 3-5 clarifying questions (data type/range, edge cases, return shape). Quote the actual questions.
- **WHY**: Why these questions matter (signals depth, prevents misreading the problem, sets constraints that shape the solution).

### 2. Brute force first (out loud)
- **SAY**: Describe the obvious O(n²) (or O(2^n), or whatever the naive bound is). Don't write code for it — narrate it.
- **WHY**: Two reasons usually — (a) proves you understand the problem before optimizing, (b) plants the seed for the real solution (the optimization is often a small restructuring of the brute force, not a wholly new algorithm).

### 3. Spot the pattern
- **SAY**: Name the pattern AND the structural property that makes the pattern apply. "X is a sliding-window problem because the property is monotone in shrinkage" is the answer; "X is a sliding-window problem" alone is a guess.
- **WHY**: Pattern-recognition is a derivation, not a memorization. Interviewers grade you on the derivation.

### 4. Trace through examples
- **PROMPT**: "Walk a few inputs to confirm the model before writing the loop."
- **INTRO**: Brief framing — what cases the examples cover.
- **EXAMPLES**: 3 worked examples (matches the `walkthrough.examples` if walkthrough exists):
  - Typical case
  - Degenerate/edge case (all-same, single element, empty if defined, etc.)
  - L3 prompt's input (if distinct) — gives the user a mental sanity check
  Each `trace` is a monospace narration formatted as `r=0 'a' → seen={a}, window [0,0], best=1\nr=1 'b' → ...`. Use `→` separators, `\n` between steps.
- **WHY**: Two things — (a) tracing surfaces off-by-ones before they hit the code (mention one specific bug the trace exposes for this problem), (b) the degenerate case usually defends an amortization claim.

### 5. Edge cases to mention
- **SAY**: Bullet list of edges the interviewer would care about. Empty input, single element, all-same, all-unique, very large, Unicode/emoji (for string problems), integer overflow (for numeric), null/undefined handling (for object problems). Pick the 4-5 most relevant for THIS problem; not all edges apply to all problems.
- **WHY**: The Unicode/overflow class of edges in particular separates senior candidates from junior — interviewers either nod (impressed) or say "good catch but assume X for now" (also fine).

### 6. Complexity & wrap-up
- **SAY**: Defend the time and space bounds with the actual amortization argument. For sliding window: "each char enters and exits the set at most once → O(n) even with nested while". For two pointers: "l and r each traverse at most n positions, so 2n total". For DP: the table-size argument. Then a **bonus**: an extension or related problem that uses the same template (e.g., "if you wanted at-most-K-distinct, swap Set for Map and shrink while map.size > K").
- **WHY**: The amortization defense is what wins the pushback ("but you have a nested loop, isn't that O(n²)?"). The extension proves you see the template, not just this problem.

## Voice rules (the load-bearing part)

These are what separate a real Conversation from a glib one:

1. **First-person, present-tense, in actual quotes.** SAY content should read like a transcript. Lines like *"I'd start by repeating the prompt back: 'Longest substring of `s` with no repeating characters — by substring you mean contiguous, right?'"* — quoted speech inside the candidate's narration.

2. **Concrete over abstract.** Bad: "I'd ask about the input format." Good: *"Can the array have negative numbers? Are the integers bounded?"* Always include the specific question.

3. **No filler "engineer-speak."** Avoid: "cheap clarifying questions" (use "quick"); "let's leverage a hash map" (use "I'd reach for a hash map"); "best-in-class solution" (just say "the standard one").

4. **WHY is the coaching voice, not the script voice.** SAY is what you'd say in the room; WHY is what the coach whispers after. Different register, different sentence rhythm. WHY can be analytical and impersonal; SAY must sound human.

5. **Domain-specific specificity.** For sliding window: name the monotone-shrinkage property. For two pointers: name the sorted invariant. For BFS: name the layer-order property. Don't be vague — interviewers know when you're paraphrasing a textbook vs. actually understanding the structure.

6. **No anti-patterns.** Don't say "obviously…" or "trivially…" (alienates the user). Don't apologize ("I might be wrong here, but…"). Don't bury the key insight in a parenthetical.

## Step 3 — Validate (structural)

```bash
node tools/validate-data.js
```

The validator checks: every conversation has ≥3 sections, every section has a title and at least one body field (`say` | `why` | `reveal` | `examples`). It does NOT grade voice quality — that's on you.

## Step 4 — Spot-check the browser

```bash
node tools/cdp/conversation-tab.js
```

The existing probe verifies the tab renders and sections collapse/expand. If it passes for an existing lesson, your new lessons should render too. For broader confidence, open the app at `http://localhost:8765/`, navigate to your lessons, and read the Conversation tab end-to-end. Ask yourself: *"Would this make sense to a rusty engineer prepping for an interview tomorrow?"* If no — rewrite.

## Common authoring pitfalls

- **Section 4 examples must match `walkthrough.examples`** if walkthrough exists for the same lesson. Inputs and expected outputs should align — otherwise the user reads two different traces in two tabs for the same problem.
- **Don't reuse the same WHY phrasing across sections.** Each WHY should add a distinct rationale; copy-pasted WHYs read as filler.
- **The brute force in section 2 must be a real algorithm, not a strawman.** Don't say "you could check every pair, but that's slow" — describe the actual loop structure: *"two nested loops, the outer picks i, the inner picks j > i, you check every pair"*.
- **The "spot the pattern" answer must distinguish this problem from its sibling patterns.** Don't say "this is a hash map problem" — say "this is a hash map problem because we need O(1) membership *and* the order doesn't matter, vs. an ordered map which we'd need if X". Specificity is what teaches.
- **The complexity defense must use the actual amortization argument, not just state the bound.** "O(n) because we visit each element once" is fine for L1. For Conversation, you need: "O(n) because each element enters AND exits the set at most once across the whole outer loop — the inner while doesn't dominate because of the amortization."

## Checklist before declaring a lesson done

- [ ] `conversation` block present with `intro` (optional) + 6 sections
- [ ] Every section has `title` + `prompt` + at least one of {say, why, examples}
- [ ] Sections 1-3 and 5-6 have BOTH `say` AND `why`
- [ ] Section 4 has `intro` + `examples` (3 worked) + `why`
- [ ] Validator passes (`node tools/validate-data.js`)
- [ ] Voice reads as concrete first-person, with quoted speech in SAY blocks
- [ ] WHY blocks add distinct rationales (no copy-paste across sections)
- [ ] Section 4 examples match `walkthrough.examples` if walkthrough exists for this lesson
- [ ] Eyeball-tested in the browser: would this make sense to a rusty engineer prepping tomorrow?
