# iter 52 — refine — diagnostic-results (drop redundant Time/Answered/Skipped recap)

**Date:** 2026-05-30
**Surface:** diagnostic-results
**Picker signal:** Mock-interview is still git-stalest (2026-05-29 18:39) but picking it 3rd of 4 iters would be intentional clustering (49 mock, 50 mock, 51 pivot, 52 mock = 3 of 4). Pivoted to next-stalest: diagnostic-results (2026-05-29 23:08, 8 commits in 90d, last refined iter 41 → 11 iters of refinement-staleness).
**Step 0 verdict:** Cleared (trailing 6-window 46/47/48/49/50/51 = 3 bails ≤ threshold 4). Anti-clustering pivot is intentional, not a Step-0 trigger.

## Before screenshots

- `/tmp/jsdrill-refine-52/01-diagnostic-results-mobile-before.png` (390×844)
- `/tmp/jsdrill-refine-52/01-diagnostic-results-desktop-before.png` (1280×800)

### Mobile caption

(a) **Eye lands on:** primary CTA `🎯 Drill weakest: Trace (50%) →` (iter-20). Already action-driving.
(b) **Competes for attention:** heading `Done — 39/43 answered, 32m 36s`, explainer `Opens the main app with the Patterns track ready to drill.`, table caption, 5-column auto-scored MC table (squeezed: SECTION / MC / SHORT / SKIPPED / MC %), then bottom recap **`Time: 32m 36s total. Answered: 39/43. Skipped: 1.`** ← THE TARGET, then JSON buttons row + bottom prose.
(c) **Hidden / below the fold:** the JSON export buttons + bottom JSON-handoff prose (user has to scroll past the redundant recap).

## Vision

If the diagnostic results page were the BEST it could be for the user in PROFILE.md, the page would lead with ONE actionable callout (Drill weakest), followed by the per-section breakdown table, then the JSON export controls + prose. No data restated twice. Every line either drives an action, surfaces a per-section insight, or supports the JSON workflow.

## Rubric score (post-iter-41 baseline)

**Total: 19/21**
**Suggested refine target:** ADHD-fit (2/3) — one fewer line of restated data; Phone-fit also lifts ~30-40px directionally.

| Dim | Score | Evidence |
|---|---|---|
| Autopilot | 3/3 | One 🎯 Drill weakest CTA above the fold (iter-20). |
| Decisions | 3/3 | For autopilot user: 1 decision (tap the CTA). |
| Phone-fit | 2/3 | Table fits 390px with column squeeze; CTA visible above fold; bottom prose + JSON buttons require scroll. |
| Time-respect | 3/3 | CTA visible <30s. |
| Diagnostic-aware | 3/3 | The whole surface is the diagnostic output. |
| Progress-visible | 3/3 | Heading shows totals; per-section table shows per-area scores. |
| ADHD-fit | **2/3** | Heading "Done — 39/43 answered, 32m 36s" + bottom `Time: 32m 36s total. Answered: 39/43.` restate identical data; both compete for the eye when the table is the load-bearing artifact. |

## Proposal

**Target dimension:** ADHD-fit (2/3 → 2/3 directional) + Phone-fit (2/3 → 2/3 directional, ~30-40px gained)
**Change:** Delete the entire `<p><strong>Time:</strong> ... <strong>Answered:</strong> ... <strong>Skipped:</strong> ...</p>` paragraph at `diagnostic.html:792-794`. Both **Time** and **Answered** values are already in the heading at line 775 verbatim; **Skipped** total is derivable from per-section "skipped" cells already in the table above.
**Closest step toward Step 2.5 vision because:** ONE line of data shown twice is exactly the "no data restated twice" rule the vision targets; same iter-41 explainer-redundancy pattern, one surface up.
**Why for user:** PROFILE.md "Limited working memory for parallel decisions; benefits from single-focus surfaces" (Cognitive style — ADHD). Restated data is noise once the eye has parsed the heading.
**Mockup (mobile):**

```
BEFORE                                AFTER
──────────────────────                ──────────────────────
Done — 39/43 answered, 32m 36s        Done — 39/43 answered, 32m 36s
[🎯 Drill weakest: Trace (50%) →]     [🎯 Drill weakest: Trace (50%) →]
Opens the main app …                  Opens the main app …
Auto-scored MC results …              Auto-scored MC results …
┌─────────────────────────┐           ┌─────────────────────────┐
│ Pattern Recognition 75% │           │ Pattern Recognition 75% │
│ Complexity          67% │           │ Complexity          67% │
│ Trade-offs          67% │           │ Trade-offs          67% │
│ Edge Cases          80% │           │ Edge Cases          80% │
│ Trace               50% │←weakest   │ Trace               50% │←weakest
│ Insight             67% │           │ Insight             67% │
└─────────────────────────┘           └─────────────────────────┘
Time: 32m 36s total. Answered:  ← cut [⬇ Export JSON] [📋 Copy …]
39/43. Skipped: 1.                    Send the JSON to me…
[⬇ Export JSON] [📋 Copy …]
Send the JSON to me…
```

**Files touched:** `diagnostic.html` (lines 792-794 only).
**Test:** Re-run `tools/cdp/refine-diagnostic-results.js`. Add assertion: `document.body.textContent` does NOT match `/Time:.*total/i.test(...) && /Answered:.*43/.test(...)` in the lower half of the page (i.e., no recap paragraph). All iter-41 invariants preserved (post-CTA hint, weakest-row accent, JSON button presence).
**Rubric projection:** 19/21 → 19/21 (directional: ADHD-fit one fewer restatement; Phone-fit ~30-40px tighter).

## Contrarian verdict

**GREEN-LIGHT:** *"Removing a redundant summary paragraph (heading already shows time + answered; per-row skipped cells already visible) reduces visual noise and pulls the JSON-export CTA closer to the fold on mobile — no affordance, decision, mobile-target, autopilot step, progress signal, or diagnostic behavior is removed."*
