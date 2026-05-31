# Stats dashboard — Learning-effectiveness audit (reflection-kind)

**Total: 6/6** (reflection-kind: only Closed-loop + Transfer-context scored)
**Verdict: KEEP**
**Anchor file:** `js/app/14-init-core.js:1426`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | N/A | (reflection tool — does not teach via retrieval) |
| Encoding strength | N/A | (reflection tool) |
| Spacing | N/A | (reflection tool) |
| Interleaving | N/A | (reflection tool) |
| Feedback quality | N/A | (reflection tool) |
| Transfer-context match | 3/3 | `14-init-core.js:1447-1473` Track Balance Compass names the least-covered track explicitly; `14-init-core.js:1612-1650` 📈 Mastery Half-Life tile names top-5 *slippery* lessons with tap-to-drill rows (interview-prep specific — "what's slipping"); `14-init-core.js:1570-1594` 🎯 Self-rescue rate is the only quality-of-pass interview-readiness signal (zero-hint L3 passes); `14-init-core.js:1595-1611` 🏷 Top miss patterns surfaces concept-level (off-by-one, semantics) interview pitfalls. Every diagnostic chip answers "what to drill next." |
| Closed-loop signal use | 3/3 | Composes ≥8 signal sources (`progress`, `weakness`, `reviews/dueAt`, `mockHistory/bestTimes`, `recognize/gotcha/claim/crystal/bugHunt` lifetime stats, `state.history` via `_selfRescueRateGlobal` + `_masteryHalfLife`, `state.misses`, `calibration`, per-track tallies, mechanic-coverage via `_renderSectionRetentionBlock`); routes on tap to drills — Recognize `:1675`, Gotcha `:1680`, Claim `:1684`, Crystal `:1689`, Bug-Hunt `:1693`, and per-lesson "open-slippery" `:1701-1707` jumps to the slipping lesson. |

## Strengths
- Multi-source signal aggregation with tap-routing — the only reflection surface that composes lifetime-drill stats, SR signal, miss tags, and self-rescue rate in one view (`14-init-core.js:1476-1672`).
- Diagnostic-aware tiles render conditionally (hidden when `attempts === 0` / `total === 0`) so the surface stays quiet for new users and grows with usage — respects PROFILE.md low-overwhelm constraint (`14-init-core.js:1515, 1526, 1559, 1577, 1599, 1620`).
- 📈 Mastery Half-Life slippery list `14-init-core.js:1636-1645` is a direct "what is decaying despite SR" diagnostic — closes the gap PROFILE.md success criterion #2 ("Mastered lessons stay mastered") names.

## Weaknesses
- The 60-day Streak Map data (`state.history` activity density) is NOT inlined as a Stats tile — currently siloed in its own modal, so the dashboard misses one composability win.
- Personal-bests list `:1659-1671` is sortable by time only; no diagnostic chip showing trend (improving / regressing) — vanity-leaning.
- Dashboard length on mobile is long; many tiles share the same "tap → drill" pattern but ordering isn't priority-ranked across tile types (e.g., Slippery list could outrank Recognize when slippery > 5).

## Action log
- 2026-05-30 Scored 6/6 by `/eval-learning-tool --all`.
- 2026-05-30 Re-scored at 6/6 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
