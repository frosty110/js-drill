# 🧬 Trace-Hop — Learning-effectiveness audit

**Total: 15/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/05-drills-recognize-trace.js:585`
**Scored:** 2026-05-30

> Note: cmd-k "Trace" routes to `startTraceHopSession` (`js/app/14-init-core.js:284` → `trace-hop-btn`). No separate "trace" drill exists — Trace-Hop is the only trace surface.

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | `js/app/05-drills-recognize-trace.js:619-633` shows K-1 + blanked K + K+1 with 4 state-object options; user MUST pick the middle-frame state before reveal. No bypass tap. |
| Encoding strength | 1/3 | `js/app/05-drills-recognize-trace.js:530-538` — 4-option MC over state objects. User picks "which of these state snapshots fits step K" — recognition. Free-production would require typing the state manually. |
| Spacing | 1/3 | `js/app/05-drills-recognize-trace.js:649` `state.weakness[lessonId]++` on miss; `appendHistory(... 'L1-miss')` logs the event; but card pick (`:551-572`) is Fisher-Yates over candidates, no `state.reviews` lookup. Misses tracked, no SR scheduling. |
| Interleaving | 2/3 | `js/app/05-drills-recognize-trace.js:552-554` candidates = `patterns + applied` (excludes syntax — by design since syntax lessons rarely have walkthroughs); shuffled across sections within those 2 tracks. Strong but not full-corpus. |
| Feedback quality | 2/3 | `js/app/05-drills-recognize-trace.js:660-667` — "✓ Got it" or "✗ The middle state was option X" + lesson title + section + Drill-this-lesson CTA. Identifies the correct option and offers the salvage route (deeper drill). No per-distractor "why wrong" — no callout explaining why option B's state value would only arise 3 steps later. |
| Transfer-context match | 2/3 | `js/app/05-drills-recognize-trace.js:609-625` — trace-frame layout (step N, line N, label, state panel) IS the mental model the user needs to WRITE the code. Per `js/app/05-drills-recognize-trace.js:480-484` header comment: "tests positional state recall, the mental model the rusty engineer needs to WRITE the code from scratch." Interview-adjacent but one step removed from blank-editor production (it's a trace-reading task on the canonical, not a code-writing task). |
| Closed-loop signal use | 3/3 | `js/app/05-drills-recognize-trace.js:649-651` — MISS: `state.weakness[lessonId]++` AND `appendHistory(... 'L1-miss')`; BOTH outcomes: `state.traceHop.attempts++` + `state.traceHop.correct++` on win. Wins AND misses both feed; per-lesson weakness AND lifetime stats AND history all wired. |

## Strengths
- Distractors drawn from OTHER frames of THE SAME TRACE (`js/app/05-drills-recognize-trace.js:510-522`) — forces the user to reason "which step belongs at K" rather than type-matching irrelevant snapshots. High encoding discrimination for a 4-option MC.
- Excludes K-1 and K+1 from distractor pool (`js/app/05-drills-recognize-trace.js:515`) so the visible neighbors aren't giveaway distractors — the puzzle is non-trivial.
- Closed-loop is fully wired: per-lesson weakness + history + lifetime stats + Drill-this-lesson CTA on miss (`js/app/05-drills-recognize-trace.js:664-672`). Best closed-loop in the audited set alongside Notes Drill.

## Weaknesses
- 4-option MC over state snapshots is recognition, not production. The "mental model the rusty engineer needs to WRITE the code" goal (`js/app/05-drills-recognize-trace.js:480-481`) is closer to "predict the next state" — a free-production task — than to "pick which of these 4 snapshots is step K."
- No SR weighting on card pick (`js/app/05-drills-recognize-trace.js:551-572`); user with a freshly-flagged weakness on a walkthrough doesn't see it preferentially next session.
- Card builder requires `walkthrough.trace` (`:491-493`) — silently shrinks the pool to lessons that have walkthroughs authored. As of OOB-2026-05-24, 99/99 patterns+applied lessons have walkthroughs per CLAUDE.md, so this is mostly moot today, but the surface degrades gracefully to 0 cards on a syntax-heavy build.

## Salvage path (if IMPROVE)
Ordered by leverage. Each edit names file:line + dim it lifts.
1. **Free-text state-key recall mode** — `js/app/05-drills-recognize-trace.js:619` — replace blanked panel `?  ?  ?` with one typed-input per state key (e.g., user types `i=3`, `hash={1:0,2:1}` per key). Tap fallback for mobile. Lifts Encoding by +1.
2. **SR-weighted lesson pick** — `js/app/05-drills-recognize-trace.js:551-572` — bias `shuffled` toward lessons in `state.weakness` or overdue `state.reviews`. Lifts Spacing by +1.
3. **Per-distractor "why wrong" on reveal** — `js/app/05-drills-recognize-trace.js:660-667` — surface "Option C's state was step <distractor.idx>; that's <N> steps too early/late". The trace already carries idx info. Lifts Feedback by +1.

**Projected after salvage:** 18/21.

## Action log
- 2026-05-30 Scored at 15/21 by `/eval-learning-tool --all`.
