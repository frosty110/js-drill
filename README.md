# JS Drill — Memorize JavaScript Syntax & Interview Patterns

A single-file web app for drilling JavaScript syntax, canonical interview-pattern solutions, and applied implementation problems. Built for coding-interview prep where speed of recall matters more than novel problem-solving.

## Quick start

```bash
open index.html   # macOS
# or just double-click index.html in any file browser
```

No install, no build, no Node required. Tailwind and CodeMirror load via CDN. Progress saves to `localStorage`.

## How it works

Each lesson has four tabs:

| Tab | What it does |
|---|---|
| **Reference** | The canonical code + 3 short "gotcha" notes — what you're memorizing |
| **L1 Concept** | Multiple-choice on the load-bearing ideas. Pass = all correct in one session. |
| **L2 Fill-in** | Partial code with blanks; check button runs your version and compares output |
| **L3 Drill** | Blank CodeMirror editor — type the canonical solution from memory and Run |

Pass all three levels → the lesson dot turns green in the sidebar.

## Two tracks

- **Track A — Syntax Fundamentals** (~30 lessons): variables, arrays, objects, destructuring, async/await, classes, closures, etc.
- **Track B — Canonical Patterns** (~22 lessons): Two Sum, Two Pointers, Sliding Window, Stack, Binary Search, Linked List, Trees, Tries, Heap, Graphs, etc.

## Features

- 🔍 **Search** — focus with `/`, filter the sidebar by title/section/id
- ⌨️ **Keyboard nav** — `j`/`k` for prev/next, `1`-`4` for tabs, `s` to shuffle, `/` to search
- 🎯 **Mock Interview mode** — random pattern + L3 + timer + no hints. Tracks your personal best per pattern.
- 🧭 **Starter Path** — toggleable linear track of recommended lessons, numbered in order
- 🎲 **Shuffle review** — random mastered lesson for retention drills
- 🔥 **Streak counter** — consecutive lessons mastered this session
- 💾 **Auto-resume** — your last lesson + tab come back on reload

## Status indicators

| Dot | Meaning |
|---|---|
| ○ empty | Not started |
| ◐ amber | At least one level passed |
| ● green | All three levels passed |
| ● ringed green | Mastered with a reveal — retry from scratch to clear |
| ◯ faint | Stubbed (coming soon) |

## Customizing or extending

The two top-level constants in `index.html` are `CURRICULUM` (sidebar manifest) and `CONTENT` (lesson data). To add a lesson, see `CLAUDE.md` for the schema and verification workflow.

## License

Private project — not licensed for redistribution.
