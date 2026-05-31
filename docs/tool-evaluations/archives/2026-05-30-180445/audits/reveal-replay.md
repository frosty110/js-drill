# 🃏 Reveal Replay — Learning-effectiveness audit (reflection-kind)

**Total: 6/6** (reflection-kind: only Closed-loop + Transfer-context scored)
**Verdict: KEEP**
**Anchor file:** `js/app/04-progress-sr.js:674`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | N/A | (reflection tool) |
| Encoding strength | N/A | (reflection tool) |
| Spacing | N/A | (reflection tool) |
| Interleaving | N/A | (reflection tool) |
| Feedback quality | N/A | (reflection tool) |
| Transfer-context match | 3/3 | `js/app/14-init-core.js:490-501` — tap routes to the first queued reveal item with its specific level (L2 or L3) preserved (`tab: next.level`), so the user lands on the exact recall surface where they previously cheated. Drops the per-attempt reveal-tracker on entry (line 499) so the clean-pass invariant can fire — directly enables "demote ringed-green dot back to plain green" on a fresh pass (per `js/app/09-stats-cheatsheet-mock.js:767`). |
| Closed-loop signal use | 3/3 | `js/app/04-progress-sr.js:674-686` — walks `state.revealed[lessonId][level]` for both L2 and L3, joins with CURRICULUM existence/status, and sorts L2 before L3 (cued-recall easier to clean first) then by section order. `js/app/09-stats-cheatsheet-mock.js:858-864` auto-hides badge when queue is empty. Integrity-of-mastery signal is unique to this surface — no other tool reads `state.revealed` as routing data. |

## Strengths
- Routes to the *level* where the reveal happened, not just the lesson — surgical retrieval-context match (`js/app/14-init-core.js:500`).
- Closes its own loop: passing the level cleanly auto-clears the revealed flag and demotes the dot, so the queue depletes naturally without manual user action (`js/app/09-stats-cheatsheet-mock.js:767`-ff).
- L2-before-L3 ordering matches retrieval-strength research (easier cued-recall first) — `js/app/04-progress-sr.js:670-673`.

## Weaknesses
- Minor: queue ordering by `CURRICULUM` section order rather than by recency-of-reveal means a stale reveal in section 1 sits ahead of a fresh reveal in section 20 — not wrong per se, but doesn't surface "what just bit you."

## Action log
- 2026-05-30 Scored at 6/6 by `/eval-learning-tool --all`.
