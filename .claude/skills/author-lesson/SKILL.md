---
name: author-lesson
description: Author one or more new lessons for the JS drill app. Forces a shape-first workflow — decide whether each lesson is collection-transform or algorithm shape BEFORE writing the canonical, so the idiom (`.map`/`.reduce` vs `for`/`while`) matches the problem. Bundles the schema, the canonical style guide, the validator step, and the manifest update. Use when adding a single lesson, a batch from a sub-agent, or filling a topical gap.
---

# author-lesson

You are authoring one or more lessons for the JS drill app. The workflow is **shape-first** — the most common authoring failure is writing a canonical in the wrong idiom for the problem shape, which trains the user on a tool that doesn't match the situation.

This skill enforces the discipline. Follow the steps in order. Do **not** skip Step 2; do **not** write any canonical before completing Step 2 for that lesson.

## Required reading (load now, before writing anything)

1. `CLAUDE.md` — § "How a lesson is structured" + § "Adding a new lesson" + § "Runner semantics" + § "Common authoring pitfalls"
2. `docs/canonical-style.md` — the entire doc. This is the load-bearing reference for the shape decision.
3. `docs/l1-distractor-quality.md` — the entire doc. Load-bearing for L1 `options` arrays.
4. One sample lesson JSON from the **same section** as the lesson you're authoring, to see the schema in context. If the section is empty, use any existing `data/<section-slug>/*.json` whose track matches.

## Step 1 — Identify each lesson

For each lesson the user (or the calling agent) wants to author, write down:

| Field | Example |
|---|---|
| `id` | `p-merge-intervals` (prefix `p-` for patterns, `s-` for syntax, `a-` for applied — or use a clean noun for marquee lessons like `two-sum`) |
| `title` | `Merge Intervals` |
| `section` | `Intervals` |
| `slug` (folder) | `intervals` (lowercased; `&` → `and`; non-alnum → `-`) |
| `track` | `syntax` \| `patterns` \| `applied` |

If you're authoring more than one, list them all here before moving on. This forces you to see the batch as a whole — useful for spotting near-duplicates and for picking a coherent set of shapes.

## Step 2 — Decide the problem shape (THE critical step)

For **each lesson** in the batch, answer these three questions explicitly. Write the answers down — do not just think them.

### Q1 — Which shape is this?

- **Collection-transform**: "for each element, do X" *without* needing position, early exit, neighbors, or shared state. → `.map` / `.filter` / `.reduce` / `.flatMap` / `.some` / `.every` / `.find`.
- **Algorithm**: the iteration itself is part of the answer — index access, early exit, two pointers, sliding window, fused passes, in-place mutation. → `for` / `for...of` / `while`.

If you cannot tell, use the four tiebreakers in `docs/canonical-style.md` § "Borderline cases".

### Q2 — Which idiom will the canonical use?

State the specific construct: `.map`, `.reduce`, `for (let i=0; …)`, `for...of`, `while`, etc.

### Q3 — What does the `description` field say to make the shape visible to the user?

The `description` is one sentence the user reads BEFORE the reference. It must name the shape and the idiom choice, using the templates in `docs/canonical-style.md` § "What the `description` field should say":

- Patterns: "Solve [problem] with a [pattern name] — single pass [for|while] because [reason]."
- Syntax (array-methods section): "Use `.[method]` when you need to [transform / keep / fold / find] — it returns [shape] and reads as [intent]."

If the description doesn't load-bear on the shape decision, rewrite it before continuing.

## Step 3 — Author the lesson JSON

Now write the lesson file at `data/<slug>/<id>.json` with `"status": "stub"`. Required fields:

- `id`, `title`, `section`, `track`, `status`
- `description` (the one you justified in Step 2 Q3)
- `reference.code` (canonical reference, using the idiom from Step 2 Q2)
- `reference.notes` (2–4 gotchas / load-bearing points)
- `L1.questions` — **≥3 multiple-choice questions** on load-bearing ideas (PROFILE.md says ≥3; the mobile loop needs the surface area). **Every distractor must pass `docs/l1-distractor-quality.md`** — no tautologies ("Style"/"Performance"), no obvious nonsense ("Required by JavaScript"), no invented APIs, no restatement of the answer. Strong distractors are real misconceptions, adjacent-concept confusions, subtly wrong rules, or plausible-sounding fake mechanisms.
- `L2.exercises` — **≥2 fill-in exercises** with `template` (`___` for blanks), `blanks[*].answer`, `expectedOutput`
- `L3` — `prompt`, `expectedOutput`, `canonical` (same idiom as `reference.code`), `hints`

**Runner reminders** (from CLAUDE.md § "Runner semantics"):
- JSON strings: `\n` for newlines, escape `\` and `"`.
- `console.log([1,2])` → `[1,2]` (no spaces); `console.log(1, 2)` → `1 2` (single space).
- Async: use `(async () => {...})()` IIFE — `setTimeout(0)` may not drain.
- HTML entities are NOT auto-decoded — write `<`, `>`, `&&` literally.
- `___` is the L2 blank marker; don't put literal `___` in templates outside blanks.

**Banned syntax** (validator-enforced — see `docs/canonical-style.md`):
- `do { … } while (…)`, `with (…)`, `var`, labeled `break`/`continue`, `void <expr>`.
- If your lesson is genuinely *about* one of these (e.g. a `var` hoisting lesson), note the file's id — you'll exempt it in Step 5.

## Step 4 — Wire the manifest

Add the lesson under the right section in `data/manifest.json` with `"status": "stub"`:

```json
{ "id": "<id>", "title": "<title>", "track": "<track>", "status": "stub" }
```

If the section doesn't exist yet, add a new section block at the end of the right track group with `name`, `slug`, and a `lessons: []` array.

## Step 5 — Validate

Run:

```bash
node tools/validate-data.js
```

This runs every L2 fill + L3 canonical against the app's runner semantics, diffs manifest vs disk, and enforces the banned-syntax list.

- If validation passes: continue to Step 6.
- If an L2/L3 mismatch fires: fix the `template`/`blanks`/`canonical`/`expectedOutput` until output matches exactly. Don't paper over with `.trim()` shenanigans — the runner already trims.
- If a banned-syntax hit fires AND the lesson is genuinely about that construct: add the lesson id to `BANNED_SYNTAX_EXEMPTIONS` in `tools/validate-data.js` with a one-line `// reason` comment. Otherwise: rewrite the canonical to use the allowed idiom.
- If a density warning fires (`L1 < 3` or `L2 < 2`): add the missing questions/exercises. This is non-fatal but the bar.

## Step 6 — Flip to `"full"` and report

Once the validator is green:

1. Change `"status": "stub"` → `"status": "full"` in both the lesson JSON and the manifest entry.
2. Re-run `node tools/validate-data.js` to confirm.
3. Report:
   - Lesson IDs added
   - Validator output line (`N passed, 0 failed.`)
   - Any banned-syntax exemptions you added and why
   - Any borderline shape decisions where the call could have gone either way

## When to fork to sub-agents

If the user asks for **5+ lessons at once**, follow CLAUDE.md § "Sub-agent workflow":

- Spawn parallel `general-purpose` Agent calls, one per batch of 4–5 lessons.
- Each agent runs this skill (Steps 1–6) end-to-end for its batch.
- Orchestrator integrates outputs, updates `data/manifest.json` (single source of truth), and runs `node tools/validate-data.js` again across all changes.

## What success looks like

- Every new lesson's `description` names the shape and explains the idiom choice in one sentence.
- Every `reference.code` and `L3.canonical` uses the same idiom (don't reference `for` but canonical `.reduce`).
- Every L1 question's wrong options pass `docs/l1-distractor-quality.md` — a diligent engineer has to think to eliminate them.
- Validator output: `N passed, 0 failed.` with no banned-syntax hits (or exemptions you can defend in one line).
- A reader of the lesson learns *both* the technique *and* the shape-recognition skill — they know why this problem gets `for` instead of `.reduce`, or vice versa.
