# 🧬 Trace-Hop — Learning-effectiveness audit

**Total: 16/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/05-drills-recognize-trace.js:744`
**Scored:** 2026-05-30

> Note: cmd-k "Trace" routes to `startTraceHopSession` (`js/app/14-init-core.js` → `trace-hop-btn`). No separate "trace" drill exists — Trace-Hop is the only trace surface.

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | `js/app/05-drills-recognize-trace.js:802-829` shows K-1 + blanked K + K+1 with 4 state-object options; user MUST pick the middle-frame state before reveal. No bypass tap. |
| Encoding strength | 1/3 | `js/app/05-drills-recognize-trace.js:724-727` — 4-option MC over state objects. User picks "which of these state snapshots fits step K" — recognition. Free-production would require typing the state manually. |
| Spacing | 2/3 | `js/app/05-drills-recognize-trace.js:744-752` — candidate shuffle uses `_srPriorityShuffle(candidates, l => l.id)` so SR-overdue + weakness lessons surface first within a session; misses also bump `state.weakness[lessonId]++` (`:841`). Per-item re-weighting now wired; no per-card interval logic. Lifts to 2 (was 1). |
| Interleaving | 2/3 | `js/app/05-drills-recognize-trace.js:746-748` candidates = `patterns + applied` (excludes syntax — by design since syntax lessons rarely have walkthroughs); shuffled across sections within those 2 tracks via `_srPriorityShuffle`. Strong but not full-corpus. |
| Feedback quality | 2/3 | `js/app/05-drills-recognize-trace.js:852-865` — "✓ Got it" or "✗ The middle state was option X" + lesson title + section + Drill-this-lesson CTA. Identifies the correct option and offers the salvage route (deeper drill). No per-distractor "why wrong" — no callout explaining why option B's state value would only arise 3 steps later. |
| Transfer-context match | 2/3 | `js/app/05-drills-recognize-trace.js:794-825` — trace-frame layout (step N, line N, label, state panel) IS the mental model the user needs to WRITE the code. Per `js/app/05-drills-recognize-trace.js:667-675` header comment: "tests positional state recall, the mental model the rusty engineer needs to WRITE the code from scratch." Interview-adjacent but one step removed from blank-editor production. |
| Closed-loop signal use | 3/3 | `js/app/05-drills-recognize-trace.js:840-844` — MISS: `state.weakness[card.lessonId]++` AND `appendHistory(... 'L1-miss')`; BOTH outcomes: `state.traceHop.attempts++` + `state.traceHop.correct++` on win. Wins AND misses both feed; per-lesson weakness AND lifetime stats AND history all wired. |

## Strengths
- Distractors drawn from OTHER frames of THE SAME TRACE (`js/app/05-drills-recognize-trace.js:704-722`) — forces the user to reason "which step belongs at K" rather than type-matching irrelevant snapshots. High encoding discrimination for a 4-option MC.
- SR/weakness-weighted shuffle (`:744-752`) — lessons the user owes attention surface first within a session via the shared `_srPriorityShuffle` helper (slice 04:483-499); cold-start users degrade to uniform shuffle.
- Excludes K-1 and K+1 from distractor pool (`:709`) so the visible neighbors aren't giveaway distractors — the puzzle is non-trivial.
- Closed-loop is fully wired: per-lesson weakness + history + lifetime stats + Drill-this-lesson CTA on miss (`:856-864`). Tied with Reverse + Notes-Drill for best closed-loop in the audited set.

## Weaknesses
- 4-option MC over state snapshots is recognition, not production. The "mental model the rusty engineer needs to WRITE the code" goal (`js/app/05-drills-recognize-trace.js:667-668`) is closer to "predict the next state" — a free-production task — than to "pick which of these 4 snapshots is step K."
- Card builder requires `walkthrough.trace` (`:760-761`) — silently shrinks the pool to lessons that have walkthroughs authored. As of OOB-2026-05-24, 99/99 patterns+applied lessons have walkthroughs per CLAUDE.md, so this is mostly moot today, but the surface degrades to 0 cards on a syntax-heavy build.
- No per-card SR interval logic — Spacing is lesson-grain bias on session start, not per-card scheduling.

## Salvage path (if IMPROVE)
Ordered by leverage. Each edit names file:line + dim it lifts.
1. **Free-text state-key recall mode** — `js/app/05-drills-recognize-trace.js:808-811` — replace blanked panel `?  ?  ?` with one typed-input per state key (e.g., user types `i=3`, `hash={1:0,2:1}` per key). Tap fallback for mobile. Lifts Encoding by +1.
2. **Per-distractor "why wrong" on reveal** — `js/app/05-drills-recognize-trace.js:852-865` — surface "Option C's state was step <distractor.idx>; that's <N> steps too early/late". The trace already carries idx info on each option (`:725-727`). Lifts Feedback by +1.

**Projected after salvage:** 18/21.

## Action log
- 2026-05-30 Scored at 15/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 2 applied — SR-weighted candidate shuffle via `_srPriorityShuffle` at `js/app/05-drills-recognize-trace.js:555-558` (was Fisher-Yates). Projected 15→16 (+1 Spacing). Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 16/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
