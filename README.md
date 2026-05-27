# JS Drill — Memorize JavaScript Syntax & Interview Patterns

A no-build web app for drilling JavaScript syntax, canonical interview-pattern solutions, and applied implementation problems. Built for coding-interview prep where speed of recall matters more than novel problem-solving.

**Live:** https://frosty110.github.io/js-drill/

## Quick start

```bash
python3 -m http.server 8765
# open http://127.0.0.1:8765/
```

`file://` won't work — the app fetches lesson JSON over HTTP. No install, no build, no Node required to use it. Tailwind and CodeMirror load via CDN. Progress saves to `localStorage`.

## How it works

Each lesson has up to 6 tabs:

| Tab | Where | What it does |
|---|---|---|
| **Conversation** | Patterns / Applied | 6 collapsible sections simulating what you'd say in an interview — say/why color split |
| **Walkthrough** | Patterns / Applied | Jupyter-style stepper. Pick an example, scrub line-by-line with a live state panel |
| **Reference** | All | The canonical code + short "gotcha" notes — what you're memorizing |
| **L1 Concept** | All | Multiple-choice (A/B/C/D) on the load-bearing ideas |
| **L2 Fill-in** | All | Partial code with blanks; the runner compares output exactly |
| **L3 Drill** | All | Blank CodeMirror editor — type from memory and Run |

Pass L1 + L2 + L3 → the lesson dot turns green and enters spaced-repetition rotation.

## Three tracks (152 lessons across 28 sections)

- **Syntax** — Basics · Arrays · Hash Structures · Modern Syntax · Iterators & Generators · JS Toolbox · Algorithms · Classes · Async · Advanced JS
- **Patterns** — Arrays & Hashing · Two Pointers · Sliding Window · Stack · Binary Search · Linked List · Trees · Tries · Heap · Graphs · Greedy · DP · Backtracking · Intervals · Matrix · Bit Manipulation · System Design
- **Applied** — Implementation problems (decks, games, hash maps, throttle/debounce, undo-redo, …)

## Companion pages

- `index.html` — the main drill app. Houses every study path; pick one from the in-app picker. Cram paths (e.g. the 4-Day Interview Cram) drive a day-by-day Today's Plan view inside the same app.
- `diagnostic.html` — 43-question self-diagnostic to find your weak sections

Both share the same `tokens.css` design tokens and `js/storage.js` localStorage layer.

## Features

- **Spaced repetition** — 1d → 30d intervals after a clean pass
- **Today's plan** — curated session of due reviews + path steps + weak spots
- **Starter Path** — toggleable linear recommended sequence (60+ steps)
- **Mock Interview** — random pattern, timer, no hints, personal-best tracking
- **Weak-spot tracker** — L1 misses resurface until you nail them
- **Stats dashboard** — section retention, streaks, progress over time
- **Diff view** — compare your L3 attempt to the canonical
- **Cheatsheet export** — markdown dump of every lesson's reference code
- **Progress backup/restore** — JSON export/import (no server sync)
- **Session resume** — last lesson + tab persisted across reloads
- **Mobile responsive** — drawer nav + sticky L3 action bar, line-wrapped editor
- **Multi-tab sync** — progress changes propagate across open tabs
- **Search & keyboard nav** — `/` to search, `j`/`k` prev/next, `1`-`4` tabs, `c` cheatsheet, `s` shuffle, `?` help

## Status indicators

| Dot | Meaning |
|---|---|
| empty ○ | Not started |
| amber ◐ | At least one level passed |
| green ● | All three levels passed |
| ringed green | Mastered with a reveal — retry from scratch to clear |
| faint ◯ | Stubbed (placeholder) |

## Adding lessons / contributing

Lesson content lives in `data/<section-slug>/<lesson-id>.json`, indexed by `data/manifest.json`. See [`CLAUDE.md`](CLAUDE.md) for the JSON schema, runner semantics, and authoring workflow. Validate any change with:

```bash
node tools/validate-data.js
```

This runs every L2 fill and L3 canonical against the same runner the app uses, checks manifest/disk parity, and (for Patterns/Applied) executes every walkthrough trace.

## License

Private project — not licensed for redistribution.
