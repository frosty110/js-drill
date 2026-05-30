# 🎰 Gotcha — Learning-effectiveness audit

**Total: 12/21**
**Verdict: IMPROVE-or-cut (salvage must move ≥4 pts or REMOVE)**
**Anchor file:** `js/app/05-drills-recognize-trace.js:217`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 2/3 | User taps "knew it" / "didn't" — a metacognitive judgment, not a retrieval test; the note IS the answer, shown alongside the question (`05-drills-recognize-trace.js:238-241`). Lesson title is hidden until reveal (`05-drills-recognize-trace.js:237`), so SOME retrieval (which lesson is this trap from) is implicit but never tested. |
| Encoding strength | 1/3 | Recognition-only — read the note, judge familiarity. No production of the trap, no lesson-name typing (`05-drills-recognize-trace.js:240-241`). |
| Spacing | 0/3 | `state.gotcha` is lifetime attempts/correct/sessions/lastRunAt (`01-state-content.js:220`); no per-note interval, no SR write. |
| Interleaving | 3/3 | Pool flattens `reference.notes` across all loaded lessons of all tracks — Fisher-Yates shuffles the full corpus (`05-drills-recognize-trace.js:194-214`). Broadest interleaving of the four tools audited. |
| Feedback quality | 1/3 | Reveal shows the lesson title + section name (`05-drills-recognize-trace.js:265-266`); no explanation of WHY the trap matters or how to avoid it. The reveal IS the source attribution, not pedagogical feedback. |
| Transfer-context match | 1/3 | Cloze-of-a-note is closer to flashcards than to interview retrieval. Notes are pre-written prose, not code-shaped traps; the user reads, not codes (`05-drills-recognize-trace.js:238`). |
| Closed-loop signal use | 3/3 | "Didn't know" writes `state.weakness[lessonId]++` AND `appendHistory(...,'L1-miss')`; wins update lifetime stats (`05-drills-recognize-trace.js:255-257`). Honor-based but routes to existing weak-spot machinery. |

## Strengths
- Best-in-class interleaving — broadest cross-lesson, cross-track sampling of any drill (`05-drills-recognize-trace.js:194-214`).
- Surfaces a previously-unused corpus (`reference.notes` × 166 lessons ≈ 400 cards) without per-lesson authoring.
- Closes the loop to `state.weakness` despite being honor-based — a miss reroutes the user via the existing sidebar weak-spot pill.

## Weaknesses
- Honor-system grading: "knew it" is self-reported with the answer (the note) visible. No verifiable retrieval moment — encoding strength is bounded above by recognition.
- Transfer-context drift: a note about "for-in walks inherited keys" pre-stated as prose doesn't resemble the interview moment of WRITING `for (const k in obj)` and reasoning about its output.
- No spacing — a note bombed today can resurface tomorrow at the same shuffled rate, with no priority to overdue items.

## Salvage path (if IMPROVE)
1. **Convert to cloze-deletion on the note** — mask the load-bearing token in `card.note` (the key term/method/operator); user must TYPE the masked word before reveal. Lifts **Active recall 2→3** AND **Encoding strength 1→3** (becomes cued-recall typed production).
2. **Add SR write on pass** — when user taps "knew it", call `scheduleReview(card.lessonId, { advance: false })` (real function at `js/app/04-progress-sr.js:431`) in `05-drills-recognize-trace.js:257`. Uses L2's hold-but-reset-dueAt semantics — drill is recognition-tier, shallower than L2 cued-recall, so it should keep the SR cycle moving without falsely advancing the bucket. Lifts **Spacing 0→2** at lesson-grain.
3. **Attach a 1-line "why" from the source lesson** — pull `notes[ni+1]` or the L1 explain text adjacent to the note as a contrast/why string at reveal (`05-drills-recognize-trace.js:263-269`). Lifts **Feedback quality 1→2**.

**Projected after salvage:** 18/21 (KEEP, ship-quality). Salvage moves +6 pts — comfortably clears the IMPROVE threshold.

## Action log
- 2026-05-30 Scored at 12/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 2 applied — guarded SR write on "knew it" at `js/app/05-drills-recognize-trace.js:263-278`. Mirrors L2's hold-but-reset-dueAt pattern; only fires when `state.reviews[id]` exists AND `isDueForReview(id)` returns true. Projected 12→14 (+2 Spacing). Cloze-deletion conversion (+2 Active recall +2 Encoding) and per-note "why" feedback (+1 Feedback) are larger Phase 3-class follow-ups, deferred. Validator: 810 passed, 0 failed.
