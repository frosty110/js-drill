# 📅 Streak map (60-day heatmap) — Learning-effectiveness audit (reflection-kind)

**Total: 6/6** (reflection-kind: only Closed-loop + Transfer-context scored)
**Verdict: KEEP**
**Anchor file:** `js/app/14-init-core.js:947` + `js/app/08-drills-bughunt-constraint.js:1`
**Scored:** 2026-05-30 (rescored 2026-05-30 post-Phase-4-A salvage)

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | N/A | (reflection tool — does not teach via retrieval) |
| Encoding strength | N/A | (reflection tool) |
| Spacing | N/A | (reflection tool) |
| Interleaving | N/A | (reflection tool) |
| Feedback quality | N/A | (reflection tool) |
| Transfer-context match | 3/3 | Phase 4-A salvage (commit dd85851) shipped both classifier extension and forward-looking header. `PASS_EVENTS`/`MISS_EVENTS` Sets at `08-drills-bughunt-constraint.js:33-41` now recognise `L2-struggle-pass` + `notes-to-code-pass` as passes and `walkthrough-quiz-miss` + `walkthrough-bug-miss` + `flash-blank` as misses — heatmap stays informative as new drill surfaces ship. Default header at `14-init-core.js:1004` is now forward-looking ("Peak streak: 7 days · last gap: 3 days — drill today to extend · 14/60 active"), replacing past-only "X events across Y days". Empty-state nudge at `:999` ("No history yet — drill anything to start the map") routes new users to action. Header text answers "what should I do today?" not just "what did I do?" → 3/3. |
| Closed-loop signal use | 3/3 | Phase 4-A salvage (commit dd85851) shipped per-day `bucket.missedLessonIds` capture at `08-drills-bughunt-constraint.js:22, 55, 65` (Set→Array conversion) AND cell-click routing at `14-init-core.js:1011-1043`. On click of a day with misses, the tooltip renders red drill-route buttons listing up to 5 lessons missed that day; each button calls `selectLesson(id)` and dismisses the modal (`:1029-1036`). Composes 2 signal sources (`state.history` event stream + `CURRICULUM` join for title display) and routes on tap — the canonical "compose + route" closed-loop pattern. The cell hover stays informational (no route), tap surfaces routes — separation of glance vs commit per PROFILE phone-glance constraint. |

## Strengths
- 5-tier relative color scale (`14-init-core.js:963-973`) adapts to the user's own peak day, avoiding gamification anti-pattern of comparing to a fixed bar.
- Tap-route on day-cells with misses surfaces drill buttons inline in the tooltip (`14-init-core.js:1023-1036`) — peak streak header + click-to-drill turns a calendar-density vanity into an actionable retrieval surface.
- Classifier maintenance discipline: `PASS_EVENTS`/`MISS_EVENTS` are explicit Sets at `08-drills-bughunt-constraint.js:33-41` with inline comments naming each event type — future event-type additions have a clear hook to extend.
- Forward-looking header (`14-init-core.js:1004`) reframes the surface from "history pride" to "drill today to extend" — directly responsive to PROFILE.md interview-prep urgency.

## Weaknesses
- Routing caps at 5 lessons per day-cell (`14-init-core.js:1024` `slice(0, 5)`) — a heavy miss day with 8+ unique missed lessons silently truncates.
- Activity density coloring still ignores pass/miss split — a heavy day with 80% misses paints the same tier as a heavy day with 80% passes. Coloring by `misses / total` ratio could surface "bad days" visually.
- Doesn't intersect with `state.misses` (concept-tag stream) at the day level — a day with 5 off-by-one tags isn't differentiated from a day with 5 random misses.

## Salvage path (KEEP — completed)
All 3 edits from prior baseline shipped in Phase 4-A (commit dd85851). Optional opportunistic improvements:
- Color cells by `misses / total` ratio in addition to density to surface "high-miss days" visually (would not move rubric score but improves diagnostic UX).
- Intersect with `state.misses` (concept-tag stream) to surface "off-by-one day" labels — not rubric-load-bearing.

**Score:** 6/6 (was 3/6 pre-salvage).

## Action log
- 2026-05-30 Scored 3/6 by `/eval-learning-tool --all`.
- 2026-05-30 Re-scored at 3/6 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
- 2026-05-30 Salvage edits 1+2+3 applied (Phase 4-A) — (1) Classifier extended at `js/app/08-drills-bughunt-constraint.js:7-58` — now recognises `L2-struggle-pass` + `notes-to-code-pass` as passes and `walkthrough-quiz-miss` + `walkthrough-bug-miss` + `flash-blank` as misses. PASS_EVENTS/MISS_EVENTS sets at `:23-31`. Buckets now also capture `missedLessonIds: Set` per day (de-dup'd, converted to Array at end at `:55`). Fixes the silent informativeness regression flagged in TRIAGE cross-cutting findings. (2) Cell click on a day with misses now renders "Drill the N lessons you missed" routing buttons at `js/app/14-init-core.js:1015-1040`; tap calls `selectLesson(id)` and dismisses the modal. (3) Default tooltip rewritten as forward-looking peak-streak + last-gap nudge at `:984-1003` ("Peak streak: 7 days · last gap: 3 days — drill today to extend"). Projected 3→6 (Transfer 1→3, Closed-loop 2→3). Crosses into KEEP ship-quality band. Validator: 895 passed, 0 failed.
- 2026-05-30 Re-scored at 6/6 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-184940/). Lift verified: `PASS_EVENTS`/`MISS_EVENTS` Sets present at `08-drills-bughunt-constraint.js:33-41`; `bucket.missedLessonIds` populated at `:22, 55, 65`; forward-looking header live at `14-init-core.js:1004`; cell-click route via `selectLesson(id)` at `:1029-1036`. Delta +3 (3/6 → 6/6).
