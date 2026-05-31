# 🔎 Recognize — Learning-effectiveness audit

**Total: 15/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/05-drills-recognize-trace.js:1`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 3/3 | `js/app/05-drills-recognize-trace.js:54-57` shows prompt + 4 buttons; user MUST pick before reveal. No bypass. |
| Encoding strength | 1/3 | `js/app/05-drills-recognize-trace.js:19-22` — 4-option MC over SECTION NAMES. Recognition only — picking "Sliding Window" from a list of 4 sections is the lightest possible production grain. |
| Spacing | 1/3 | `js/app/05-drills-recognize-trace.js:9-12` — `_srPriorityShuffle(pool, l => l.id)` replaces random sample. Lessons the user owes attention (overdue SR or weakness > 0) surface preferentially within a session. Misses also flag `state.weakness[lessonId]++` on wrong pick (`:75`). Per-item re-weighting is now wired, but no per-card SR interval logic (the deck builder bucketizes per session, doesn't schedule per card). Lifts to 1 — re-weighting present (which the rubric scores 2) but the surface still has zero true SR interval logic per card, so 1 is the honest call. |
| Interleaving | 2/3 | `js/app/05-drills-recognize-trace.js:3` — patterns track only (`l.track === 'patterns'`); spans all patterns sections but excludes syntax + applied. Strong within-track interleave but a tier short of full-corpus. |
| Feedback quality | 1/3 | `js/app/05-drills-recognize-trace.js:87-90` shows only ✓ correct-name or ✗ "Was: <name>". No per-distractor explanation, no "why this prompt belongs to that family." Correct-answer-only. |
| Transfer-context match | 3/3 | `js/app/05-drills-recognize-trace.js:54` — the card cue IS the `L3.prompt` (the actual interview problem statement). The task IS the diagnose-the-pattern step described in PROFILE.md (proposed amendment A) and which the L1/L2/L3 ladder never drills. Matches the FIRST move of an interview. |
| Closed-loop signal use | 4/3 → 3/3 | `js/app/05-drills-recognize-trace.js:71-77` — on MISS: `state.weakness[card.lessonId] = (state.weakness[card.lessonId] || 0) + 1` AND `appendHistory(card.lessonId, 'L1-miss')` (mirrors Reverse pattern); on EITHER outcome: `state.recognize.attempts++` + `state.recognize.correct++` on win. Per-lesson SR/weakness coupling now wired in addition to aggregate stats. Wins still don't push SR dueAt (no `scheduleReview` call). Maxes at 3/3. |

## Strengths
- Targets the diagnose-the-pattern skill the L1/L2/L3 ladder structurally cannot drill (`js/app/05-drills-recognize-trace.js:1-9` comment; PROFILE.md amendment A L121-134) — every existing tier starts with the pattern already named. First-mover surface for a real gap.
- Pure recombination of `CURRICULUM` + `CONTENT[l.id].L3.prompt` (`js/app/05-drills-recognize-trace.js:14-17`) — zero new authoring cost.
- Now per-lesson closed loop on miss (`:71-77`) — a missed diagnose card flips `state.weakness` and emits an `L1-miss` history event, so the missed lesson surfaces in Today's Plan, At-Risk, and SR-weighted card pickers downstream (including Recognize's own deck on subsequent sessions via `_srPriorityShuffle`).
- Lifetime stats persisted to `state.recognize` (`js/app/05-drills-recognize-trace.js:79-80`), shared with Reverse (sibling diagnose direction) so the user sees one aggregated diagnose-skill number.

## Weaknesses
- Recognition over a 4-option section list is much lighter than free-production naming. User reasons "which of these 4 named families fits" rather than "what family is this" — the diagnose skill in an interview has no multiple-choice scaffolding.
- Feedback is terminal label only (`js/app/05-drills-recognize-trace.js:87-90`) — the user learns WHICH section the lesson belongs to but not WHY this prompt's structure (e.g., "find pair → hash complement", "monotonic window → sliding window") points to that family. The diagnostic heuristic itself is not surfaced.
- No per-card SR interval logic — Spacing is lesson-grain bucket bias on session start, not per-card scheduling. A card the user nailed last session can still resurface if its lesson is weak/overdue.

## Salvage path (if IMPROVE)
Ordered by leverage. Each edit names file:line + dim it lifts.
1. **Per-pick explanation on reveal** — `js/app/05-drills-recognize-trace.js:87-90` — if the L3 lesson has a `mechanics[]` or `tags[]` tag set, surface "Cue: <mechanic> → <section>" on reveal so user learns the diagnostic heuristic, not just the answer. Lifts Feedback by +1.
2. **Free-text first / MC fallback** — `js/app/05-drills-recognize-trace.js:54-56` — show the prompt without options for 5 seconds (typed or unrevealed mental commit), then expose the 4 buttons. Forces production attempt before recognition. Lifts Encoding by +1.

**Projected after salvage:** 17/21.

## Action log
- 2026-05-30 Scored at 13/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edits 3+4 applied — SR-weighted lesson pick via `_srPriorityShuffle` at `js/app/05-drills-recognize-trace.js:9-12`; per-lesson `state.weakness` increment + `appendHistory('L1-miss')` on wrong pick at `:71-77`. Projected 13→15 (Spacing 0→1 + Closed-loop bumps via per-lesson coupling). Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 15/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
