# Lesson authoring brief — read this before writing JSON

Every JS Drill lesson is a self-contained JSON file at
`data/<section-slug>/<lesson-id>.json`. Same schema for every track.

## Required fields

```jsonc
{
  "id": "kebab-case-id",
  "title": "Short readable title",
  "section": "Exact display name",
  "track": "syntax" | "patterns" | "applied",
  "status": "full",
  "description": "One sentence — why this lesson exists.",
  "reference": {
    "code": "// canonical reference snippet\n...",
    "notes": ["Gotcha 1", "Gotcha 2", "Gotcha 3"]
  },
  "L1": { "questions": [
    { "q": "...", "options": ["a","b","c","d"], "answer": 2, "explain": "optional" }
    // exactly 4 questions
  ]},
  "L2": { "exercises": [
    { "prompt": "What to do",
      "template": "// JS with ___ where blanks go\nconsole.log(x);",
      "blanks": [{ "answer": "word", "hint": "what kind of token" }],
      "expectedOutput": "exact console output" }
    // 1 to 2 exercises
  ]},
  "L3": {
    "prompt": "One-sentence challenge",
    "expectedOutput": "exact output",
    "canonical": "// full working solution that logs expectedOutput",
    "hints": ["hint 1", "hint 2"]
  }
}
```

## Runner semantics (what the in-browser runner does — and `tools/verify-lesson.js`)

- `console.log("hi")` → `"hi"` (no quotes wrapping the string)
- `console.log([1, 2])` → `"[1,2]"` (JSON.stringify)
- Multiple args in one call → space-joined: `console.log(1, 2)` → `"1 2"`
- Multiple calls → newline-joined
- `null` → `"null"`, `undefined` → `"undefined"`
- Numbers/booleans → `String(x)`
- The runner awaits the returned promise plus **one** macrotask. Use
  `(async () => { ... })()` IIFEs and `Promise.resolve()` chains.
  **Never use `setTimeout` for timing** — real delays can exceed the drain.
- `expectedOutput` is compared post-trim — leading/trailing whitespace ignored,
  but every interior character must match exactly.

## JSON / authoring pitfalls

- Escape backslashes and quotes inside JSON strings. Newlines = `\n`, tabs = `\t`.
- Do NOT use HTML entities (`&lt;`, `&gt;`, `&amp;`) inside `code`/`canonical`.
  Write `<`, `>`, `&&` literally — JSON keeps them as-is.
- `___` is the L2 blank marker. Don't put a literal triple-underscore outside
  a blank — the runner splits on `___`.
- `blanks[i]` must align positionally with the `___` markers in `template`.
  Same count. Order matters.
- For applied/OOP problems, the L3 `canonical` should be:
  the class definition + a usage block that exercises the public API and logs
  to console. The logs combine into `expectedOutput`.
- **Avoid `Math.random`** in canonical for applied lessons — output must be
  deterministic. Either test methods that don't depend on randomness, or
  inject a seeded PRNG (e.g. `let s=1; const rand=()=>(s=(s*9301+49297)%233280)/233280;`)
  before constructing.

## Verification

```bash
node tools/verify-lesson.js data/<slug>/<id>.json [...more files]
```

Must print `N pass, 0 fail`. If any failure, iterate the file until clean.

## How a good lesson reads

- `description`: one sentence — what this teaches and why it matters.
- `reference.code`: ~6–20 lines of the canonical idiom, with inline comments.
- `reference.notes`: 3 gotchas a reader would want to memorize.
- `L1.questions`: 4 questions on the load-bearing ideas (not trivia). 4 options each,
  one clearly correct. `answer` is the 0-based index.
- `L2.exercises[*].template`: realistic short program with 1–4 blanks that test
  the specific syntax / pattern. The filled program should run cleanly.
- `L3.canonical`: full standalone solution. The last few lines should be
  `console.log(...)` calls that produce `expectedOutput`.

## Tone

Direct, dense, useful for interview prep. No hedging, no "in this lesson we
will explore." Write like the rest of the curriculum — see
`data/hash-structures/map-set.json` (syntax) or
`data/arrays-and-hashing/two-sum.json` (pattern) as exemplars.
