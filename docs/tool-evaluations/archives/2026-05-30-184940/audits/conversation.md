# Conversation interview-narration — Learning-effectiveness audit

**Total: 7/21**
**Verdict: REMOVE (as standalone retrieval surface) — IMPROVE-or-cut band**
**Anchor file:** `js/app/11-tabs-ref-conv-walk.js:49`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 1/3 | `js/app/11-tabs-ref-conv-walk.js:111-119` — every section is a `<details>` collapsed by default; tap-to-expand is one-tap reveal with no retrieval gate. Title + prompt are visible (lines 113-115) — user reads the prompt, then taps to see the "say/why" answer without producing anything. Categorically recognition/familiarity, not recall. The new cyan banner at `:126-134` and 🎬 Drill recall route button at `:140-146, 155-157` advertises the sibling drill but does not change the in-tab read posture. |
| Encoding strength | 1/3 | `js/app/11-tabs-ref-conv-walk.js:78-106` — body is pre-authored prose ("What I'd say", "Why this matters"). User reads, doesn't produce. Closest to recognition; sections occasionally include `examples` with traces (lines 84-100) but those are also read-only. |
| Spacing | 0/3 | No `state.reviews` integration. The Conversation tab itself writes nothing to SR — the new "🎬 Drill recall →" route at `:140-146` opens a sibling `startConvDrillSession()` that DOES write counters (`state.convDrill`), but that's a separate tool. The tab as a surface still has zero SR-touching write paths. |
| Interleaving | 0/3 | Bound to one lesson (`renderConversation(body, content)` at line 49 takes single lesson content). No cross-lesson session in-tab. The routed drill IS interleaved across lessons, but again — sibling surface, not this tab. |
| Feedback quality | 0/3 | No right/wrong concept — purely expository. There's no "answer to be wrong about" so the dimension is structurally absent. |
| Transfer-context match | 2/3 | `js/app/11-tabs-ref-conv-walk.js:111-119` — sections are *interview-shaped* ("Clarify", "Approach", "Code", "Complexity", etc. per `docs/conversation-walkthrough.md`) and the say/why split mirrors the verbalize-while-coding cadence PROFILE.md targets. Closest match of any surface to "what would you say in an interview." But it's a *reading* of the interview rather than a simulation. |
| Closed-loop signal use | 3/3 | `js/app/11-tabs-ref-conv-walk.js:126-134, 140-146, 155-157` — the new cyan drill-route banner explicitly funnels the user from "I read this" → `startConvDrillSession()` which persists `state.convDrill` counters AND can flag `state.weakness` on classifier miss. The tab is now structurally the front-door to a real retrieval drill rather than a terminal read. Crediting the tab full 3/3 because the route is wired AND the destination drill writes the full signal triad (attempts/correct/weakness). |

## Strengths
- **Best-in-app transfer-context match** — `js/app/11-tabs-ref-conv-walk.js:78-106` "What I'd say" / "Why this matters" split is the only surface modeling interview verbalization.
- **Wired as the front-door to convDrill, not a terminal read** (`js/app/11-tabs-ref-conv-walk.js:126-134, 155-157`) — Phase 0 salvage explicitly demoted the tab to preview-with-route. The drilling user who lands on Conversation now has a one-tap path into the cross-lesson section-classifier quiz that DOES persist signal.
- **Listen mode** (`js/app/11-tabs-ref-conv-walk.js:124, 147-149`) extends usage to the eyes-free phone-time slice PROFILE.md amendment C names.

## Weaknesses
- **Pure read surface in-tab** — `js/app/11-tabs-ref-conv-walk.js:111-117` — every section is a one-tap expand. No prompt-and-recall before reveal; tap is just disclosure. The drill route lifts Closed-loop but not Active recall — the IN-TAB act remains reading.
- **Zero state writes from the in-tab act itself.** Banner click writes via the sibling drill; expand/collapse writes nothing. A user who reads but never taps the route gets zero signal.
- **Not interleaved in-tab.** Single-lesson surface; the routed drill is the only interleaved path, and the tab itself violates Rohrer & Taylor mixing.

## Salvage path (if IMPROVE)

The Phase 0 route-to-drill salvage already shipped (`:126-134, 155-157`) — that lift is in the 7/21 score. Further single-edit options to push toward 10/21 KEEP-band:

1. **Per-section "predict before reveal" gate** — `js/app/11-tabs-ref-conv-walk.js:111-119` add a thin "What would you say here?" textarea OR "Tap when you've thought of an answer" intent button before the `<details>` opens. Counter persisted to `state.convRead.{lessonId}.{sectionIdx}`. Lifts Active recall +1 (1→2), Encoding strength +1 (1→2).
2. **Read → schedule for review** — on first read of all sections in a lesson, seed `state.reviews[lessonId]` if absent (1d interval). Lifts Spacing +1 (0→1).
3. **Mark-confidence after reveal** — 3-button "knew it / partial / blank" under each expanded section, write to `state.weakness[lessonId]` on blank. Lifts Feedback +1 (0→1, the self-rating IS signal).

**Projected after salvage:** 10-11/21 — bottom of KEEP, salvageable. Borderline. If salvage doesn't move it ≥4 pts, the rubric verdict reverts to REMOVE (tab demoted to settings-toggle off-by-default); however the conv **content** stays load-bearing for `convDrill` and audio regardless of tab status.

## Removal path (if REMOVE)
Conv tab content is reused by `convDrill` (`js/app/01-state-content.js:222`, `js/app/05-drills-recognize-trace.js`) and the audio Listen mode — removing the *tab* would not remove the *content*. If the rubric forces removal: hide the tab behind a settings toggle (default off), keep `data/*.json` `conversation` blocks intact, keep `convDrill` and audio as the primary surfaces consuming the content. Drilling-user-visible loss: the desk-tier "read the interview script" surface; but interleaved drill still drives the content.

## Action log
- 2026-05-30 Scored at 6/21 by `/eval-learning-tool --all`.
- 2026-05-30 Phase 0 salvage decision applied — tab demoted to preview-with-route. New prominent cyan banner at top of Conversation tab (`js/app/11-tabs-ref-conv-walk.js:123-131`) reads "Reading is the prep" + "🎬 Drill recall →" button. Tap routes to `startConvDrillSession()` (cross-lesson section-classifier quiz over `conversation.sections[]` that already persists counters). The 6 sections still render below the banner as the reading surface — but the surface is now framed as preview, not the recall destination. Closed-loop signal lifts from "borrowed from convDrill content" to "user routes here, then drills". Projected 6→8 (Closed-loop 2→3 via the explicit route; Active recall stays 1 because in-tab is still tap-to-reveal — true lift comes from the routed convDrill session, not from this tab). Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 7/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/). Closed-loop lift confirmed (2→3). Active recall stays 1 — in-tab act is still tap-to-reveal; route lifts Closed-loop not Active recall. Verdict still IMPROVE-or-cut band: tab is now a viable front-door to convDrill, but the standalone learning value remains marginal.
