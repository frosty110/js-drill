# CLAUDE.md — Project Context

> **Read also: [MIGRATION-NOTES.md](MIGRATION-NOTES.md)** for the 2026-05 refactor
> that split lesson content out of `index.html` and added mobile + syntax-highlight
> work. The "How a lesson is structured" section below reflects the *new* layout.

## Current state (snapshot)

- **143 fully-authored lessons** (`status: 'full'`), 0 stubs
- **327 verified L2+L3 exercises** (all pass via `node tools/validate-data.js`)
- `index.html` is markup only (~140 lines); `app.css` (~430 lines) and `app.js` (~2,400 lines) load via `<link>` and `<script src>`
- Lesson content lives in `data/<section-slug>/<lesson-id>.json` (143 files)
- `data/manifest.json` is the sidebar index — loaded on boot, lessons lazy-load on click
- Three tracks across 28 sections:
  - **Syntax (44)**: Basics · Arrays · Hash Structures · Modern Syntax · Iterators & Generators · JS Toolbox · Algorithms · Classes · Async · Advanced JS
  - **Patterns (79)**: Arrays & Hashing · Two Pointers · Sliding Window · Stack · Binary Search · Linked List · Trees · Tries · Heap · Graphs · Greedy · Dynamic Programming · Backtracking · Intervals · Matrix · Bit Manipulation · System Design
  - **Applied (20)**: Applied Problems — implementation problems (decks, games, hash maps, throttle/debounce, undo-redo, etc.)

## What this project is

A **JavaScript syntax + interview-pattern memorization web app**. No build step —
open `index.html` in a browser (or serve `python3 -m http.server`). Uses Tailwind
CSS and CodeMirror via CDN. Progress persists in `localStorage` under
`jsdrill.progress.v1` (schema `__v: 4`, backwards-compat to v1). Live on GitHub
Pages: https://frosty110.github.io/js-drill/

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
- Mobile responsive drawer + sticky L3 action bar
- Multi-tab storage sync
- Search (`/`), keyboard nav (`j`/`k`/`1`-`4`/`s`/`?`/`Esc`)
- Letter-labeled MC (A/B/C/D)
- Reveal-tracking (mastered-with-reveal dot variant)
- Hide-mastered filter
- First-time welcome banner with Starter Path CTA
- Syntax-highlighted static code blocks (Reference + L2 templates) via CodeMirror runMode
- Line-wrapping in the L3 editor (mobile-friendly, prevents horizontal scroll)

The app's job is to drill JS syntax and canonical interview-pattern solutions through three escalating recall tests per lesson:

- **Reference** — read the canonical code + notes (the thing to memorize)
- **L1 Concept** — multiple-choice on the load-bearing ideas
- **L2 Fill-in** — partial code with blanks to type
- **L3 Drill** — blank CodeMirror editor, type from memory, runner compares output

There are also **Mock Interview mode** (random pattern + timer, no hints) and a **Starter Path** (linear recommended order).

## Who this is for + how it learns

The target user is described in [PROFILE.md](PROFILE.md) — a rusty-but-experienced
software engineer who studies **on a phone ~80% of the time**. That single fact
shifts the design center of gravity:

- L1 (tap) and L2 (short-token typing) are the high-throughput surfaces.
- L3 is the "at-desk" tier; don't optimize the mobile loop around it.
- Every lesson should ship with ≥3 L1 questions and ≥2 L2 exercises so the
  mobile user has enough surface area per lesson.

The app is also an evolving **memorization tool**. The learning-science
principles it encodes — active recall, spaced repetition, interleaving,
retrieval practice, elaboration, etc. — live in
[docs/learning-strategies/](docs/learning-strategies/). When you add a feature
that exploits a learning principle, also add or update its strategy doc.
When you're choosing what to build next, scan the strategy docs for under-
exploited principles. The two coevolve.

The self-improve loop reads [PROFILE.md](PROFILE.md) and
[SELF-IMPROVE.md](SELF-IMPROVE.md) on each iteration and updates the directive
based on what it learned — that's how the app keeps converging on the profile.

## File layout

| File / Dir | Role |
|---|---|
| `index.html` | Markup only — ~140 lines |
| `app.css` | All app styles — ~280 lines |
| `app.js` | All app logic — ~1,750 lines |
| `data/manifest.json` | Sidebar index — `{sections: [{name, slug, lessons: [{id,title,track,status}]}]}` |
| `data/<section-slug>/<lesson-id>.json` | One JSON per lesson — the source of truth for content |
| `MIGRATION-NOTES.md` | Goals, principles, learnings from the multi-file refactor |
| `tools/validate-data.js` | Runs every L2 fill + L3 canonical, diffs manifest vs disk. Run before commits. |
| `tools/cdp/check.js` | Probes a deployed URL via Chrome's :9222 port (basic) |
| `tools/cdp/deep-check.js` | Multi-tab + multi-lesson navigation probe with screenshots |
| `tools/cdp/mobile-l3.js` | iPhone-viewport probe for the L3 editor + sticky action bar |
| `tools/migrations/extract.js` | Historical one-shot — pulled CONTENT out of `index.html` |
| `tools/migrations/refactor.js` | Historical one-shot — surgically refactored `index.html` |
| `tools/README.md` | Tool inventory + run instructions |
| `README.md` | User-facing intro |
| `PROFILE.md` | Target user profile — drives every product decision |
| `SELF-IMPROVE.md` | Self-improve loop directive — evolves with each iteration |
| `docs/learning-strategies/` | Learning-science principles the app should encode. Co-evolves with features. |
| `docs-archive/` | Older `claude.md`, `AGENTIC_*.md`, `ARCHITECTURE.md`, plus `old-scripts/` (broken pre-refactor helpers) — historical only |

## How a lesson is structured (post-refactor)

Each lesson is a standalone JSON file at `data/<section-slug>/<id>.json`:

```jsonc
{
  "id": "two-sum",
  "title": "Two Sum (hash map)",
  "section": "Arrays & Hashing",
  "track": "patterns",           // or "syntax"
  "status": "full",              // or "stub"
  "description": "One sentence describing the lesson.",
  "reference": {
    "code": "// canonical code as a string\n...",
    "notes": ["Gotcha 1", "Gotcha 2"]
  },
  "L1": { "questions": [
    { "q": "Question?", "options": ["a","b","c","d"], "answer": 1, "explain": "optional" }
  ]},
  "L2": { "exercises": [
    { "prompt": "...", "template": "// JS with ___ where blanks go\nconsole.log(x);",
      "blanks": [{ "answer": "word", "hint": "optional" }],
      "expectedOutput": "exact console output" }
  ]},
  "L3": {
    "prompt": "One-sentence challenge",
    "expectedOutput": "exact output",
    "canonical": "// full working solution",
    "hints": ["hint 1", "hint 2"]
  }
}
```

Also add the lesson to `data/manifest.json` under the right section (id, title,
track, status). Section slug is `lowercase + & → 'and' + non-alnum → '-'`.

A lesson is **authored** (`status: "full"`) only when:
1. The `L2.exercises[*].template` filled with each `blanks[*].answer` produces the `expectedOutput` exactly.
2. The `L3.canonical` produces the `L3.expectedOutput` exactly.

## Adding a new lesson — the workflow

1. Pick the section slug (e.g., `arrays-and-hashing`). Create
   `data/<slug>/<lesson-id>.json` with `"status": "stub"`.
2. Author the body. Use `\n` in JSON strings for newlines.
3. Add an entry under the right section in `data/manifest.json` with `"status": "stub"`.
4. Verify:
   ```bash
   node tools/validate-data.js
   ```
   This runs every L2 fill + L3 canonical against the same runner semantics the
   app uses, and flags any manifest/disk drift. Must show `184 passed, 0 failed`
   (or whatever the new total is — it scales with lessons).
5. Flip both the file's `"status"` and the manifest entry's `"status"` to `"full"`.
6. Open `index.html` in a browser (via `python3 -m http.server 8765`) — the lesson
   appears with its status dot.

## Runner semantics — critical for `expectedOutput`

`runCode(code)` runs the string via `new Function('console', code)` with a fake
console. It is **async** and awaits any returned promise plus one macrotask, so
`(async () => { ... })()` IIFEs work. (Same semantics in `validate-data.js`.)

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

- **JSON strings: escape backslashes and quotes**. Newlines are `\n`. Tabs are `\t`.
  Tab character in templates expands per `tab-size: 2` CSS.
- **HTML entities (`&lt;`, `&gt;`, `&amp;`) are not auto-decoded** in code. Write
  `<`, `>`, `&&` literally inside JSON strings (the JSON parser keeps them as-is).
- **`___` is the blank marker** in `L2.exercises[*].template`. The runner uses
  split-and-rejoin so a user-typed `___` can't misroute, but don't put literal
  `___` inside templates outside of blanks.
- **Async code**: use `Promise.resolve(value).then(...)` or `(async () => { ... })()` patterns.
  Real `setTimeout` delays may exceed the runner's single-macrotask drain.
- **Don't edit `CONTENT` / `CURRICULUM` inline in `index.html` anymore** — those
  globals are now populated from `data/`. Edit the JSON files instead.

## Local dev + deploy

```bash
# Serve locally — file:// won't work because of the fetch() calls.
python3 -m http.server 8765
# Open http://127.0.0.1:8765/

# Validate all exercises + manifest/disk parity
node tools/validate-data.js

# Drive Chrome at :9222 (start with: open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-jsdrill)
node tools/cdp/deep-check.js http://127.0.0.1:8765/ /tmp/shots
node tools/cdp/mobile-l3.js  http://127.0.0.1:8765/ /tmp/shots
```

Deployment is GitHub Pages off `main` — just push to deploy. Pages refresh takes
~30–90 seconds; poll for the new content (e.g., grep for a unique string from
the new commit) before running the CDP probe against the live URL.

## Commit message convention

Every commit subject is prefixed with a category tag so `git log` is searchable
by impact type. The killer use case:

```bash
git log --grep="^\[product" --oneline -20    # recent user-facing improvements
```

### Subject format

```
[<category>] <one-line summary>
```

For commits that genuinely span categories, list the *primary* tag first:

```
[<primary>] [<secondary>] <summary>
```

For loop-driven iterations, the iter+mode marker goes inside the summary so
the meta-loop's framing stays intact:

```
[<category>] iter N (mode): <summary>
```

### Categories

**Product — anything a drilling user can notice.** Tag this when the change
affects what the user sees, reads, or interacts with on the live URL.
- `[product/feature]` — net-new functionality (a new mode, a new tracker, a new surface). Use when "the app does something it didn't do before."
- `[product/content]` — new lessons, new L1 questions, new L2 exercises, new sections, or substantive expansion of an existing lesson's surface. Use when "there's more to drill than before."
- `[product/ux]` — refinement to an existing feature: copy changes, CTA reordering, sidebar sort, banner refresh, layout tweaks. Use when "an existing feature got better but the feature set didn't grow."
- `[product/fix]` — bug fix the user would notice (crash, broken interaction, wrong content shown, mobile overflow). Use when "something the user could have hit is now fixed."

**Engineering — internal, no direct user impact.** Tag this when the change is
invisible to the drilling user.
- `[engineering/tooling]` — validator, CDP probes/helpers, `tools/` scripts, `.gitignore`, build helpers. Use when "the way we build, verify, or deploy changed."
- `[engineering/meta]` — loop framework (`.claude/skills/`, `SELF-IMPROVE.md`), `iter-artifacts/`, planning docs that drive future iterations. Use when "the way we plan or evaluate the next iteration changed."
- `[engineering/refactor]` — code reorganization with no behavior change, file moves, dead-code removal, type/lint cleanup. Use when "the code is the same, just cleaner."
- `[engineering/docs]` — `README.md`, `CLAUDE.md`, `PROFILE.md`, `docs/learning-strategies/`, in-code comments. Use when "the project's documented understanding changed."

### Body format

For any `[product/*]` commit, the body **MUST** include:

```
## Product impact
<one-sentence user-facing description — what the drilling user notices and why it helps>
```

That single line is the durable record. It's what `git log --pretty` queries
will surface to answer "what shipped that helps users?"

Other labeled sections, use as relevant:

```
## Engineering
<implementation notes — files, technical approach, tradeoffs>

## Verification
<validator output, CDP probe results, manual test notes>
```

For loop iterations, keep the iter-and-mode + Challenge-the-focus + Learning
framing already established by the drill-improve skill — those live inside
or alongside the labeled sections, not replacing them.

### Multi-category example

```
[product/content] [engineering/tooling] iter 20 (ship): 6 boilerplate-as-syntax lessons + isolation validator

## Product impact
Algorithms section grew from 3 to 9 lessons — the boilerplate (matrix
dirs, BFS queue, DFS template, tree traversal shapes, LL walk, heap
math) the rusty engineer reaches for BEFORE the algorithm is now
drillable as standalone syntax instead of being buried inside Patterns
solutions.

## Engineering
Added tools/validate-files.js for in-isolation lesson validation. New
durable probe tools/cdp/algorithms-section-expansion.js.

## Verification
node tools/validate-data.js: 336 → 355 (+19 exercises, 0 fail)
node tools/cdp/algorithms-section-expansion.js: 29/29
```

### Common queries

```bash
# Recently shipped user-facing improvements (overview)
git log --grep="^\[product" --oneline -20

# New content added this month
git log --grep="^\[product/content" --since="1 month ago" --oneline

# Recent bug fixes the user would have noticed
git log --grep="^\[product/fix" --since="1 month ago" --oneline

# Full "Product impact" descriptions for the last 10 user-facing commits
git log --grep="^\[product" -10 --pretty=format:"%h %s%n%n%b%n---%n"

# Internal changes (no direct user impact)
git log --grep="^\[engineering" --oneline -20

# Loop iterations that actually shipped product (vs framework changes)
git log --grep="^\[product" --grep="iter " --all-match --oneline
```

### When to skip the convention

- **Merge commits** — auto-generated, leave them alone.
- **Pre-convention history** — no retroactive rewrite. The convention applies
  going forward; earlier commits are still readable via `--since`/`--until` +
  topical grep.

## Sub-agent workflow

When asked to author multiple lessons at once, spawn parallel `general-purpose`
Agent calls — one per batch of 4-5 lessons. Each agent:
1. Reads `CLAUDE.md` + a sample `data/<slug>/<sample>.json` for the schema
2. Authors lesson JSON files into the right section folder
3. **Verifies via `node tools/validate-data.js`** before reporting back
4. Reports lesson IDs added and the validator output

The orchestrator integrates output, updates `data/manifest.json` for each new
lesson, flips statuses, and runs `node tools/validate-data.js` again to
confirm all exercises still pass.

## Loop mode

`/loop 10m <prompt>` schedules a recurring autonomous build. Each iteration:
- Spawns multiple parallel content agents
- Optionally spawns a review agent for code-quality findings
- Integrates outputs, fixes critical bugs, verifies via `node tools/validate-data.js`

Track progress via `TaskCreate` / `TaskUpdate`. Verify every iteration with the
full validator before declaring iteration complete.
