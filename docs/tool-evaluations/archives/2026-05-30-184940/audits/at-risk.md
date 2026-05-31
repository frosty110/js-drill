# 📡 At Risk decay radar — Learning-effectiveness audit (reflection-kind)

**Total: 6/6** (reflection-kind: only Closed-loop + Transfer-context scored)
**Verdict: KEEP**
**Anchor file:** `js/app/04-progress-sr.js:741` + `js/app/14-init-core.js:877`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | N/A | (reflection tool — does not teach via retrieval) |
| Encoding strength | N/A | (reflection tool) |
| Spacing | N/A | (reflection tool) |
| Interleaving | N/A | (reflection tool) |
| Feedback quality | N/A | (reflection tool) |
| Transfer-context match | 3/3 | `04-progress-sr.js:741-788` is purpose-built to answer "what's about to slip?" Sort policy (`:778-786`) puts due-now first, then soonest-due, then highest-weakness, then revealed-flag-presence — exact interview-prep priority. Urgency-shape inventory above cards (`14-init-core.js:888-902`) shows distribution upfront ("2 DUE NOW · 1 SOON · 1 NO-SR") so the autopilot user sees the shape immediately. The per-row badges (DUE NOW pill, weakness ⚠ count, revealed-flag 🃏) (`14-init-core.js:903-914`) compose three diagnostic signals into one decision per row. |
| Closed-loop signal use | 3/3 | Composes 3 previously-independent signals — `state.weakness`, `state.reviews[id].dueAt`, `state.revealed[id]` (`04-progress-sr.js:747-754, 759-764`). Comment at `:734-737` explicitly names the gap closed ("Today the user must mentally cross-reference Review badge + Weak Spots button + Reveal Replay"). Routes on tap to `selectLesson(id)` `14-init-core.js:927-932`. Excludes due-only lessons by design (`04-progress-sr.js:744-746`) — the existing Review badge covers those, At Risk = "wobbly + about to slip + cheated last time" intersection only. |

## Strengths
- Synthesizes 3 independent signals into one ranked list with action-routing — the canonical "compose + rank + route" reflection pattern (`04-progress-sr.js:741-788`).
- Inventory chip distribution above the rows (`14-init-core.js:888-902`) gives the ADHD/phone user the shape of their risk in one glance — answers "is this manageable today?"
- Empty-state celebration (`14-init-core.js:885-886`) — "All clear — no wobbly or revealed lessons! 🎉" — closes the loop on the rare clean state without nagging.

## Weaknesses
- Cap at 7 rows (`_atRiskRows(7)` `14-init-core.js:883`) silently truncates — a user with 15 wobbly lessons sees no "+8 more" indicator.
- Doesn't intersect with `state.misses` (concept-level miss tags) — a lesson with 5 off-by-one tags doesn't rank above one with no tags.
- No per-row "drill at L1 vs L2 vs L3" routing hint — tap dumps to default tab; the user has to decide level themselves (Resurrect Queue at `14-init-core.js:467-475` already differentiates touch vs fine-pointer level routing; At Risk could borrow this).

## Action log
- 2026-05-30 Scored 6/6 by `/eval-learning-tool --all`.
- 2026-05-30 Re-scored at 6/6 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
