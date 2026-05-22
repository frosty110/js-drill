# CLAUDE.md — Project Context

## Current state (snapshot)

- **76 fully-authored lessons** (`status: 'full'`), 0 stubs
- **184 verified L2+L3 exercises** (all pass via the in-app runner)
- ~8,500 lines, single self-contained `index.html`
- 22 sections: Basics, Arrays, Hash Structures, Modern Syntax, Algorithms, Classes, Async, Advanced JS · Arrays & Hashing, Two Pointers, Sliding Window, Stack, Binary Search, Linked List, Trees, Tries, Heap, Graphs, Dynamic Programming, Backtracking, Bit Manipulation, System Design

## What this project is

A **single-file JavaScript syntax + interview-pattern memorization web app**. The entire app is `/index.html` — open it in a browser, no build step, no install. Uses Tailwind CSS and CodeMirror via CDN. Progress persists in `localStorage` under `jsdrill.progress.v1` (schema `__v: 4`, backwards-compat to v1).

## Features shipped (so future iterations don't re-add them)

- Spaced repetition (1d → 30d intervals)
- Mock interview mode + personal-best times per lesson
- Starter Path (linear recommended sequence, 60+ steps)
- Weak-spot tracker (resurfaces L1 misses)
- Today's plan (curated session: due + path + weak)
- Stats dashboard
- Diff view (compare L3 to canonical)
- Cheatsheet markdown export
- Progress JSON backup/restore
- Session resume (currentLessonId + tab persisted)
- Mobile responsive drawer
- Multi-tab storage sync
- Search (`/`), keyboard nav (`j`/`k`/`1`-`4`/`s`/`?`/`Esc`)
- Letter-labeled MC (A/B/C/D)
- Reveal-tracking (mastered-with-reveal dot variant)
- Hide-mastered filter
- First-time welcome banner with Starter Path CTA

The app's job is to drill JS syntax and canonical interview-pattern solutions through three escalating recall tests per lesson:

- **Reference** — read the canonical code + notes (the thing to memorize)
- **L1 Concept** — multiple-choice on the load-bearing ideas
- **L2 Fill-in** — partial code with blanks to type
- **L3 Drill** — blank CodeMirror editor, type from memory, runner compares output

There are also **Mock Interview mode** (random pattern + timer, no hints) and a **Starter Path** (linear recommended order).

## File layout

| File | Status |
|---|---|
| `index.html` | The entire app — ~4000 lines, self-contained |
| `data/patterns-batch-1.json` | Early batch of pattern data (now superseded by inline CONTENT in `index.html`) |
| `README.md` | User-facing intro |
| `claude.md` (lowercase) | Older AI-workflow doc; superseded by this file |
| `AGENTIC_*.md`, `ARCHITECTURE.md`, `DELIVERY.md`, `SETUP.md`, `QUICK_REFERENCE.md`, `AUTONOMOUS_BUILD_PROMPT.txt`, `RUN_AUTONOMOUS_BUILD.md` | **Stale** — describe an earlier Next.js architecture that does not exist. Safe to delete or treat as historical. |
| `generate-patterns.js`, `validate-snippets.js`, `enhance-descriptions.js` | Standalone helper scripts using the older JSON schema. Independent of the running app. |

## How a lesson is structured

Two top-level arrays inside `index.html`:

```js
const CURRICULUM = [
  { id: 'lesson-id', title: 'Title', track: 'syntax' | 'patterns', section: 'Section name', status: 'full' | 'stub' },
  // ...
];

const CONTENT = {
  'lesson-id': {
    description: 'One sentence describing the lesson.',
    reference: {
      code: `// canonical code in a template literal`,
      notes: ['Gotcha 1', 'Gotcha 2', 'Gotcha 3']
    },
    L1: { questions: [
      { q: 'Question?', options: ['a', 'b', 'c', 'd'], answer: 1, explain: 'optional' }
    ]},
    L2: { exercises: [
      {
        prompt: 'What to do',
        template: `// JS with ___ where blanks go\nconsole.log(...);`,
        blanks: [{ answer: 'word', hint: 'optional' }],  // one per ___
        expectedOutput: 'exact console output'
      }
    ]},
    L3: {
      prompt: 'One-sentence challenge',
      expectedOutput: 'exact output',
      canonical: `// full working solution that logs expectedOutput`,
      hints: ['hint 1', 'hint 2']
    }
  }
};
```

A lesson is **authored** (status `'full'`) only when it has a matching CONTENT entry AND both these are true:
1. `L2` template with blanks filled produces `expectedOutput` exactly when run.
2. `L3.canonical` produces `expectedOutput` exactly when run.

## Adding a new lesson — the workflow

1. Add a CURRICULUM entry with `status: 'stub'`
2. Author the CONTENT entry following the schema above
3. Verify against Node:
   ```bash
   node -e "
     const fs = require('fs');
     const html = fs.readFileSync('index.html', 'utf8');
     const scripts = [...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];
     let js = scripts[scripts.length - 1][1].replace(/^\\s*init\\(\\);\\s*\$/m, '');
     const factory = eval('(function(){' + js + ' return { CURRICULUM, CONTENT, runCode, outputsMatch }; })');
     const { CURRICULUM, CONTENT, runCode, outputsMatch } = factory();
     (async () => {
       const c = CONTENT['YOUR-LESSON-ID'];
       for (const ex of c.L2.exercises) {
         const parts = ex.template.split('___');
         let filled = parts[0];
         for (let i = 0; i < ex.blanks.length; i++) filled += ex.blanks[i].answer + parts[i+1];
         const r = await runCode(filled);
         console.log(outputsMatch(r.output, ex.expectedOutput) ? 'OK' : 'FAIL', r.output);
       }
       const r = await runCode(c.L3.canonical);
       console.log(outputsMatch(r.output, c.L3.expectedOutput) ? 'OK' : 'FAIL', r.output);
     })();
   "
   ```
4. Flip `status` from `'stub'` to `'full'` in CURRICULUM
5. Open `index.html` in a browser — the lesson appears with its status dot

## Runner semantics — critical for `expectedOutput`

`runCode(code)` runs the string via `new Function('console', code)` with a fake console. It is **async** and awaits any returned promise plus one macrotask, so `(async () => { ... })()` IIFEs work.

Argument formatting:
- strings → as-is
- numbers / booleans → `String(x)`
- null → `"null"`, undefined → `"undefined"`
- objects / arrays → `JSON.stringify(x)`

Output joining:
- Multiple args in one `console.log(a, b)` → joined by a single space (`"1 2"`)
- Multiple `console.log` calls → joined by newline

So `console.log([1, 2])` produces `"[1,2]"`, and `console.log("hi")` produces `"hi"` (no quotes).

## Common authoring pitfalls

- **Apostrophes in single-quoted strings break the file**. Use double quotes (`"don't"`) or backticks. The whole JS object literal is single-quote-heavy.
- **HTML entities (`&lt;`, `&gt;`, `&amp;`) in code are not auto-decoded**. Write `<`, `>`, `&&` literally.
- **`___` is the blank marker**. The runner uses split-and-rejoin, so a user-typed `___` won't misroute, but don't put literal `___` inside templates outside of blanks.
- **Async code**: use `Promise.resolve(value).then(...)` or `(async () => { ... })()` patterns. Real `setTimeout` delays may exceed the runner's single-macrotask drain.

## Sub-agent workflow

When asked to author multiple lessons at once, spawn parallel `general-purpose` Agent calls — one per batch of 4-5 lessons. Each agent:
1. Reads `index.html` for the schema
2. Authors lessons
3. **Verifies each with Node** (writes to /tmp, runs, captures output)
4. Reports the JS object literals + verification results

The orchestrator then integrates output, flips `status` flags, and runs the full verification pass across all lessons before declaring iteration complete.

## Loop mode

`/loop 10m <prompt>` schedules a recurring autonomous build. Each iteration:
- Spawns multiple parallel content agents
- Optionally spawns a review agent for code-quality findings
- Integrates outputs, fixes critical bugs, verifies all exercises

Track progress via `TaskCreate` / `TaskUpdate`. Verify every iteration with the full-runner check above.
