# 🔎 Recognize — Learning-effectiveness audit

**Total: 13/21**
**Verdict: IMPROVE-or-cut**
**Anchor file:** `js/app/05-drills-recognize-trace.js:24`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | `js/app/05-drills-recognize-trace.js:51-57` shows prompt + 4 buttons; user MUST pick before reveal. No bypass. |
| Encoding strength | 1/3 | `js/app/05-drills-recognize-trace.js:17-19` — 4-option MC over SECTION NAMES. Recognition only — picking "Sliding Window" from a list of 4 sections is the lightest possible production grain. |
| Spacing | 0/3 | `js/app/05-drills-recognize-trace.js:9` Fisher-Yates random sample over patterns lessons; nothing reads `state.reviews` or `state.weakness` to bias the pick. Random across sessions. |
| Interleaving | 2/3 | `js/app/05-drills-recognize-trace.js:3` — patterns track only (`l.track === 'patterns'`); spans all patterns sections but excludes syntax + applied. Strong within-track interleave but a tier short of full-corpus. |
| Feedback quality | 1/3 | `js/app/05-drills-recognize-trace.js:77-80` shows only ✓ correct-name or ✗ "Was: <name>". No per-distractor explanation, no "why this prompt belongs to that family." Correct-answer-only. |
| Transfer-context match | 3/3 | `js/app/05-drills-recognize-trace.js:51` — the card cue IS the `L3.prompt` (the actual interview problem statement). The task IS the diagnose-the-pattern step described in PROFILE.md (proposed amendment A) and which the L1/L2/L3 ladder never drills. Matches the FIRST move of an interview. |
| Closed-loop signal use | 3/3 | `js/app/05-drills-recognize-trace.js:69-71` increments both `state.recognize.attempts` AND `state.recognize.correct` on every outcome (wins + misses lifetime stats). Surfaces in Stats modal. NB: does NOT feed `state.weakness` per-lesson on a miss (in contrast to Reverse `:585`), but lifetime signal use qualifies for 3. |

## Strengths
- Targets the diagnose-the-pattern skill the L1/L2/L3 ladder structurally cannot drill (`js/app/05-drills-recognize-trace.js:1-9` comment; PROFILE.md amendment A L121-134) — every existing tier starts with the pattern already named. First-mover surface for a real gap.
- Pure recombination of `CURRICULUM` + `CONTENT[l.id].L3.prompt` (`js/app/05-drills-recognize-trace.js:13-14`) — zero new authoring cost.
- Lifetime stats persisted to `state.recognize` (`js/app/05-drills-recognize-trace.js:69-71`), shared with Reverse (sibling diagnose direction) so the user sees one aggregated diagnose-skill number.

## Weaknesses
- Recognition over a 4-option section list is much lighter than free-production naming. User reasons "which of these 4 named families fits" rather than "what family is this" — the diagnose skill in an interview has no multiple-choice scaffolding.
- No SR/weakness weighting (`js/app/05-drills-recognize-trace.js:9`) — a section the user just bombed has the same chance of resurfacing as one they aced.
- Feedback is terminal label only (`js/app/05-drills-recognize-trace.js:77-80`) — the user learns WHICH section the lesson belongs to but not WHY this prompt's structure (e.g., "find pair → hash complement", "monotonic window → sliding window") points to that family. The diagnostic heuristic itself is not surfaced.
- Misses don't increment `state.weakness[lessonId]` (compare Reverse `:585`) — the closed loop only operates on aggregate stats, not per-lesson SR.

## Salvage path (if IMPROVE)
Ordered by leverage. Each edit names file:line + dim it lifts.
1. **Per-pick explanation on reveal** — `js/app/05-drills-recognize-trace.js:77-80` — if the L3 lesson has a `mechanics[]` or `tags[]` tag set, surface "Cue: <mechanic> → <section>" on reveal so user learns the diagnostic heuristic, not just the answer. Lifts Feedback by +1.
2. **Free-text first / MC fallback** — `js/app/05-drills-recognize-trace.js:51-53` — show the prompt without options for 5 seconds (typed or unrevealed mental commit), then expose the 4 buttons. Forces production attempt before recognition. Lifts Encoding by +1.
3. **SR-weighted lesson pick** — `js/app/05-drills-recognize-trace.js:9-21` — bias `shuffled` toward lessons in `state.weakness` (matching the Reverse pattern at `:585`). Lifts Spacing by +1.
4. **Feed `state.weakness` on miss** — `js/app/05-drills-recognize-trace.js:62-71` — mirror the Reverse `:585` `state.weakness[card.lessonId]++` + `appendHistory(... 'L1-miss')` on wrong pick. Already-scored 3 on closed-loop but this also lifts per-lesson SR coupling, indirectly helping Spacing salvage above.

**Projected after salvage:** 16-17/21.

## Action log
- 2026-05-30 Scored at 13/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edits 3+4 applied — SR-weighted lesson pick via `_srPriorityShuffle` at `js/app/05-drills-recognize-trace.js:9-12`; per-lesson `state.weakness` increment + `appendHistory('L1-miss')` on wrong pick at `:71-77`. Projected 13→15 (Spacing 0→1 + Closed-loop bumps via per-lesson coupling). Validator: 810 passed, 0 failed.
