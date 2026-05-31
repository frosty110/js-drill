# ⌚ Mock Replay Reel — Learning-effectiveness audit (reflection-kind)

**Total: 5/6** (reflection-kind: only Closed-loop + Transfer-context scored)
**Verdict: KEEP**
**Anchor file:** `js/app/12c-l3.js:113`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | N/A | (reflection tool) |
| Encoding strength | N/A | (reflection tool) |
| Spacing | N/A | (reflection tool) |
| Interleaving | N/A | (reflection tool) |
| Feedback quality | N/A | (reflection tool) |
| Transfer-context match | 2/3 | `js/app/12c-l3.js:126-136` — slope arrow + "X faster vs first" / "Y slower vs first" directly answers PROFILE Success criterion line 101 ("Mock interview personal-bests trend down over weeks") inline above the editor on the lesson the user is about to drill. But it does not *route* — the user is already on the lesson by virtue of being on the L3 tab; the reel is diagnostic only. Per-cell tap reveals attempt index + delta-vs-best (`js/app/12c-l3.js:280-308`), useful but doesn't suggest a next action. |
| Closed-loop signal use | 3/3 | `js/app/12c-l3.js:113` reads `state.mockHistory[lesson.id]`; `js/app/12c-l3.js:117` cross-references `state.bestTimes[id]` to star the PB cell. `js/app/12c-l3.js:126-136` computes first-vs-last slope, color-tones (green/amber/slate) by direction, classifies into improving / holding / regressing. Three signals composed per render (`history`, `bestMs`, `slope`). Hides cleanly when `history.length < 2` (no trend to show — line 114). |

## Strengths
- First surface that makes the personal-best trend a *direction*, not just a number — closes the PB-trend measurement gap inline (`js/app/12c-l3.js:108-112` design comment).
- Per-cell tap discloses attempt index + delta + %-from-best on demand, without crowding the resting badge (`js/app/12c-l3.js:280-308`).
- Color/arrow encoding is at-a-glance peripheral (slate-holding / green-faster / amber-slower) — PROFILE phone-glance compatible.

## Weaknesses
- No routing. Reel diagnoses regression on this lesson but does not surface "regression on lesson X" globally — the user has to be on the lesson already to see it (`js/app/12c-l3.js:113` scope is `lesson.id`).
- "First vs last" comparison ignores middle attempts — a U-shape (got better, then regressed) reads the same as flat (`js/app/12c-l3.js:128-129`).

## Salvage path (if IMPROVE) — optional, current score is KEEP
1. **Aggregate regression badge in sidebar** — add a "📉 Regressing mock times" pill at `js/app/09-stats-cheatsheet-mock.js` near the resurrect/at-risk badges that lists lessons whose last-3 mock attempts trend up vs prior-3 — would lift Transfer-context from 2 → 3 by adding cross-lesson routing.

**Projected after salvage:** 6/6.

## Action log
- 2026-05-30 Scored at 5/6 by `/eval-learning-tool --all`.
- 2026-05-30 Re-scored at 5/6 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
