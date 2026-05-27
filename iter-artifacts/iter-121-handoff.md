# iter 121 — handoff

Written 2026-05-26. Snapshot of the working tree before this iter's commits land.

## TL;DR

Two independent streams are in-flight:

1. **STAGED, ready to ship** → 🎬 **Reference Cinema** v1 (iter 121's planned Cat 1 ship per roadmap line 115 + SELF-IMPROVE L39). `app.js` + `app.css`.
2. **UNSTAGED, WIP** → prep.html ADHD-friendly visual overhaul + 2 new review-loop sections (Input Quirks, Init Tricks) + CODE_SHAPES expansion (sliding-window 3-variant rewrite + Heap-of-K split into real-heap + sorted-array fallback).

Validator: **698 passed, 0 failed**. Prep-path sync OK (47 lessons, in order).

## Stream 1 — 🎬 Reference Cinema (STAGED)

### What it is

Reference tab gains a `🎬 Cinema` button next to the existing `🃏 Flash`. Toggle on → every line of `reference.code` renders as a blurred `<button>`; tap any line to reveal it. Tap each line in any order. Toggle off → restore the syntax-highlighted canonical via the existing `colorizeInto()` path.

First Cat 1 (Drilling Surfaces) enhancement since iter 92 (Flash mode). Retrieval direction it covers — **read+predict-then-verify** at line grain — was not served by Flash (token-cloze), Walkthrough (next-state pick), or any existing surface.

### Files touched (staged)

| File | Δ | Notes |
|---|---|---|
| `app.js` | +56 / -1 | New `_renderCinema(codeEl, code)` (line ~6547). Cinema/Flash toggles now share a `restoreCanonical()` helper so flipping one resets the other. Button wired next to Flash inside `renderReference()`. |
| `app.css` | +33 / 0 | `.cinema-toggle.active` (matches `.flash-toggle.active` lime style). `.code-block .cine-line` — `display:block`, blur(5px), tap-target min-height 1.4em, hover blur(3px), revealed = no filter. Empty lines rendered as a space so the blur has something to blur. |

### Design decisions worth remembering

- **No CodeMirror in Cinema mode by design.** Cinema is line-grain prediction, not syntax recognition. Syntax highlighting is a distraction from the retrieval direction we want to drill. Restoring the canonical via `colorizeInto()` re-applies highlighting when the toggle flips off.
- **Each line is a `<button>` element** (not a div). Gives free keyboard nav, real focus rings, real tap semantics on mobile.
- **Tap order is user-driven** (any order, any line). Subagent flagged "trivial lines feel empty" — orchestrator decision per roadmap line 115 was to ship simple tap-to-advance v1 (no auto-advance, no compress-trivial heuristic) and let users surface real friction before per-lesson `cinema.beats` authoring.
- **Mutual-reset with Flash** — if Flash is on and Cinema gets toggled, Flash resets first (via `restoreCanonical()`), then Cinema turns on. Same in reverse. Avoids the rendering races that would happen if both modifiers fought over `codeEl.innerHTML`.

### Validator + probe checklist before commit

- [x] `node tools/validate-data.js` → 698 passed, 0 failed (no data changes — confirmed Cinema is presentation-only).
- [ ] Browser smoke: open Reference tab on any lesson, toggle Cinema, tap a few lines, toggle off → expect highlighted canonical restored.
- [ ] Mobile-viewport probe (`tools/cdp/mobile-l3.js` or a fresh `tools/cdp/cinema.js`) — durable probe doesn't exist yet; add one if landing this.
- [ ] Flash + Cinema interleave: turn on Flash, then Cinema, then Flash again — confirm no visual artifacts.

### Suggested commit message

```
[product/feature] iter 121 (ship): 🎬 Reference Cinema v1 — line-by-line read+predict-then-verify

## Product impact
Reference tab gains a 🎬 Cinema toggle next to 🃏 Flash. Every line of the
canonical starts blurred; tap each line to reveal it in whatever order the
rusty engineer's eye wants to check. First read+predict-then-verify retrieval
direction in the app — distinct from Flash (token cloze) and Walkthrough Quiz
(next-state pick). First Cat 1 Drilling Surfaces enhancement since Flash mode
in iter 92 (29 iters ago).

## Engineering
- New _renderCinema(codeEl, code) renders each line of reference.code as a
  blurred <button>; click toggles .cine-revealed.
- Shared restoreCanonical() helper resets either toggle when the other fires,
  so Flash and Cinema can't fight over codeEl.innerHTML.
- Bypasses CodeMirror by design — line-grain prediction is the drill, not
  syntax. colorizeInto() reapplies highlighting when the toggle flips off.

## Verification
node tools/validate-data.js: 698 passed, 0 failed
```

## Stream 2 — prep.html overhaul (UNSTAGED)

~485 added lines. Three substreams; all *interactively* tested-looking but never committed. Decide whether to land as one commit, split into 2-3 commits, or pause and finish the rest.

### 2a. ADHD-friendly visual refresh

CSS-only changes to existing block / task layout:

- **Blocks**: 4px left accent bar that lights up when `.expanded`. Bigger title (17px / 700), more vertical breathing room.
- **Tasks**: bigger label (16px / 500), hover state, lesson name now `.lesson-name` (accent-colored, bold) instead of `<strong>`.
- **Inline term highlights** — new `.hi-l1` / `.hi-l2` / `.hi-l3` / `.hi-combo` / `.hi-dur` / `.hi-num` classes. Each is color-coded with a faint background tint. Applied by a new `highlightTaskLabel(rawLabel)` function (~1517 in `prep.html`) that regexes the high-scan-cost markers (L1, L2, L3, L1+L2, L1+L2+L3, "~3 min", "of 5", etc.) in task labels.

Why it matters: prep.html is dense; the ADHD user's eye needs anchors. The before-and-after on a phone is the test.

### 2b. CODE_SHAPES expansion

Two of the 6 shapes got materially rewritten + a 7th added:

- **#4 Sliding Window (variable size)** — was a 12-line skeleton. Now ships SHELL + 3 worked variants (Set-window for longest-unique, Map-counter for ≤K distinct, fixed-window for max-sum-K). Note revised.
- **#6 Heap-of-K** — was a comment-only "how it would work" note. Now ships a full `MinHeap` class (sift-up/sift-down) + `kthLargest` driver. The "I'd reach for a heap but here's the sorted-array fallback" framing got hoisted out into…
- **#7 (NEW) Top-K sorted-array fallback** — explicit "if heap won't surface, here's the verbal framing + the slower-but-correct code." Two cards = two verbal pivots in the interview.

Why it matters: PROFILE.md L14-16 (concepts intact, mechanics rusty); ship the actual implementation, not just the prose.

### 2c. Two new review-loop sections

- **INPUT_QUIRKS** (13 items) — "ask these BEFORE coding" checklist. Each: dimension / question / why it matters / how to handle. Wired into `reviewableItems()` with `id: q:<i>` and the SRS at `REVIEW_SAMPLE.quirk: 2`. Renders below CODE_SHAPES on the Code tab.
- **INIT_TRICKS** (5 items) — Array.from cookbook, codepoint math, magic counts (52, 26, 256…), `.map` gotchas, Set/Map/Object init. Wired same way (`id: t:<i>`, `REVIEW_SAMPLE.trick: 2`). Each has a CodeMirror-rendered snippet + Copy button.

Both new sections are real review-loop items — they show up in `buildDailyReviewQueue()`, contribute to `dueItems()`, get checked off into `state.reviewed`.

### Open questions for stream 2

- [ ] Does the ADHD visual refresh test well on a phone? (CDP `tools/cdp/lib.js` + a fresh `tools/cdp/prep-refresh.js` probe — doesn't exist yet.)
- [ ] Should INPUT_QUIRKS + INIT_TRICKS commit *separately* from the visual refresh? They're independent in spirit but tangled in `prep.html` lines. `git add -p` could split them but the CSS additions for `.quirk-card`, `.hi-*`, etc. are interleaved with `.task` / `.block` changes — probably cleaner as one commit per substream OR one big `[product/content] [product/ux]` combined commit.
- [ ] Is the Heap impl drill-tested? The trace `[3,1,4,1,5,9,2,6] → 1,1,2,3,4,5,6,9` claim in the note (line 286 of the diff) should be confirmed in a REPL before claiming it.
- [ ] `highlightTaskLabel`'s regex alternation has a subtle order dependency (longest combo wins) — drop a unit-style assertion into a `tools/cdp/prep-label-highlight.js` smoke test before shipping if any label edge case is suspect.

### Suggested commit shape (if landing all three substreams)

Option A — one combined commit (faster):

```
[product/ux] [product/content] iter 121 side-stream: prep.html overhaul + Input Quirks / Init Tricks sections

## Product impact
prep.html got an ADHD-friendly refresh (bigger titles, accent left-border,
color-coded L1/L2/L3/combo/duration markers in task labels) plus two new
review-loop sections — Input Quirks (13 "ask these BEFORE coding" cards)
and Init Tricks (5 Array.from / codepoint / magic-counts snippets). Both
new sections are real SRS items, woven into the daily review queue.
Sliding Window code shape expanded from 1 skeleton to 3 worked variants;
Heap-of-K split into a full MinHeap impl + a sorted-array fallback card,
matching the "ideal vs. blanked" interview-pivot the rusty engineer needs.

## Engineering
- New highlightTaskLabel() applied in renderTaskHtml — regex covers
  L1/L2/L3, L1+L2, L1+L2+L3, "~3 hr", "of 5". Longest-alternation-first.
- INPUT_QUIRKS + INIT_TRICKS added to reviewableItems() with id prefixes
  q: and t:. REVIEW_SAMPLE / buckets gained the two new types.
- CODE_SHAPES grew from 6 to 7.

## Verification
node tools/validate-data.js: 698 passed, 0 failed
Prep-path sync: 47 lessons, in order.
[mobile probe TBD]
```

Option B — split into 3:

1. `[product/ux] iter 121 side-stream: prep.html ADHD-friendly visual refresh` — CSS + `highlightTaskLabel` only.
2. `[product/content] iter 121 side-stream: CODE_SHAPES expansion (sliding-window 3-variant, heap split, +Top-K fallback)`.
3. `[product/content] iter 121 side-stream: Input Quirks + Init Tricks review-loop sections (+18 SRS items)`.

Splitting is faithful to commit-convention but each split touches `prep.html` so `git add -p` is required. Recommend Option A unless reviewer cares.

## Loop framing — what should iter 122 nominate?

Per roadmap line 127, iter 120 vision iter pre-nominated iter 121 = Reference Cinema. Iter 121's measurement target is "≥25% of Reference-tab sessions toggle Cinema within 30 days" (roadmap line 137). Too early to measure — iter 122 should NOT re-vision off Cinema usage data.

Recommended iter 122: **🧪 What-If Output Predictor** — the other Cat 1 + §9C hybrid promoted alongside Cinema in iter 120 (SELF-IMPROVE L39). Same vision-iter promotion, same blind-spots-audit context. Ships next while Cinema soaks.

If iter 122 should instead be a *frame* or *vision* iter (e.g. context cliff hit, 5+ ship-iters in a row), check `.claude/skills/drill-improve/SKILL.md` Step 0 (loop health) for the trigger threshold.

## Quick context for the next session

- Working tree before this handoff: 2 modified files staged (`app.js`, `app.css`), 1 modified unstaged (`prep.html`).
- Cinema is a self-contained 89-line addition to the staged files; safe to commit alone.
- `prep.html` is a single-file 485-line addition; nothing else depends on it (no other JS modules import from it).
- Validator clean, prep-path sync clean.
- The iter-120 vision-iter blind-spots-audit lesson ("subagent self-flagged its own steering bias, heeded the warning, promoted 2-not-3") should be carried forward — iter 122 vision iter (whenever it fires) should re-ask the steering self-audit question.
