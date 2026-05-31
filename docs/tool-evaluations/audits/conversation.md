# Conversation interview-narration — Learning-effectiveness audit (prep-kind)

**Total: 5/6** (prep-kind: only Transfer-context + Closed-loop scored — recall dims N/A by design)
**Verdict: KEEP, ship-quality**
**Anchor file:** `js/app/11-tabs-ref-conv-walk.js:49`
**Scored:** 2026-05-30 (reclassified prep-kind 2026-05-30 post-rubric-update)

## Why prep-kind, not retrieval-kind

The Conversation tab models what a candidate would *say* across the 6 interview phases (Clarify / Approach / Code / Complexity / Edge cases / Wrap-up). It's a worked-example surface — the value is letting the user internalize the *shape* of expert interview performance before going to the recall drill. Retrieval happens in the sibling `convDrill` (which the tab now explicitly routes to via the cyan banner), not in-tab.

Grading this as `retrieval` (the prior classification) caps it at 7/21 with 0s on Spacing / Interleaving / Feedback by structure — the rubric's blind spot for prep surfaces. The reclassification to `prep` scores it on the dimensions that actually matter for a study artifact: does it model the target context, and does it route to a real recall drill.

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | N/A | (prep-kind — user reads/studies; recall happens in sibling convDrill) |
| Encoding strength | N/A | (prep-kind) |
| Spacing | N/A | (prep-kind) |
| Interleaving | N/A | (prep-kind) |
| Feedback quality | N/A | (prep-kind — purely expository, no right/wrong) |
| Transfer-context match | 2/3 | `js/app/11-tabs-ref-conv-walk.js:111-119` — sections are *interview-shaped* ("Clarify", "Approach", "Code", "Complexity", etc. per `docs/conversation-walkthrough.md`) and the say/why split mirrors the verbalize-while-coding cadence PROFILE.md targets. **Best in-app model of interview verbalization.** Capped at 2/3 because it's a *reading* of the interview rather than a *simulation* — 3/3 would require the user to produce verbalization, which is the convDrill's job. |
| Closed-loop signal use | 3/3 | `js/app/11-tabs-ref-conv-walk.js:126-134, 150-157` — the cyan drill-route banner funnels the user from "I read this" → `startConvDrillSession()` which persists `state.convDrill` counters AND can flag `state.weakness` on classifier miss. **For prep-kind, the route IS the closed loop** — the surface has no signal of its own to write, but the user's encounter with it feeds forward into a real recall act on the sibling drill. Full 3/3. |

## Strengths
- **Best-in-app transfer-context match** — `js/app/11-tabs-ref-conv-walk.js:78-106` "What I'd say" / "Why this matters" split is the only surface modeling interview verbalization.
- **Wired as the front-door to convDrill, not a terminal read** (`js/app/11-tabs-ref-conv-walk.js:126-134, 155-157`) — Phase 0 salvage explicitly demoted the tab to preview-with-route. The drilling user who lands on Conversation now has a one-tap path into the cross-lesson section-classifier quiz that DOES persist signal.
- **Listen mode** (`js/app/11-tabs-ref-conv-walk.js:124, 147-149`) extends usage to the eyes-free phone-time slice PROFILE.md amendment C names.

## Weaknesses
- **Transfer-context capped at 2/3** — the surface is a *reading* of the interview rather than a *simulation*. Real interview verbalization happens under time pressure with no script visible. The Conversation tab is the prep surface that models what to say; the convDrill is the surface where the user actually produces it. Lifting Transfer to 3/3 would require the prep surface to also force production, which would collapse it back into being a retrieval surface (i.e. duplicate convDrill).
- **Standalone learning loss if convDrill is broken or unloaded** — the tab is honest about being prep, not retrieval; if the user never taps the route, the value is bounded at "they read a model script." This is the same tradeoff every textbook has — readers who never do the exercises learn less.

## Salvage path (if IMPROVE)

Tool is at 5/6 ship-quality under the prep-kind rubric — no salvage needed. Remaining ceiling is Transfer 2/3 → 3/3 which would require turning the surface into a simulation (production-based), at which point it would be a `retrieval` tool not `prep` (and would duplicate convDrill). The prep-kind 2/3 is the structural ceiling.

If you wanted to add in-tab signal that doesn't change the surface kind:
- **Mark-confidence after reveal (optional polish)** — 3-button "knew it / partial / blank" chip under each expanded section, write to `state.weakness[lessonId]` on blank. Wouldn't change the rubric score (Closed-loop is already 3/3 via the route), but would add a finer-grain self-rating signal for users who use Conversation as their primary study surface without always tapping through to convDrill.

## Removal path (NOT recommended)
Prior to the prep-kind reclassification, this audit suggested REMOVE-as-standalone. Under the corrected rubric, the tab is **KEEP, ship-quality** — it models the target context well and routes to a real recall drill. The "scrap" recommendation was an artifact of grading a prep surface by retrieval dimensions. Don't remove.

If a future re-evaluation does call for removal: the content is reused by `convDrill` (`js/app/01-state-content.js:222`, `js/app/05-drills-recognize-trace.js`) and the audio Listen mode, so the tab could be hidden behind a settings toggle (default off) with no content loss. Drilling-user-visible loss: the desk-tier "read the interview script" surface; interleaved drill still drives the content. But the prep-kind score doesn't warrant this.

## Action log
- 2026-05-30 Scored at 6/21 by `/eval-learning-tool --all`.
- 2026-05-30 Phase 0 salvage decision applied — tab demoted to preview-with-route. New prominent cyan banner at top of Conversation tab (`js/app/11-tabs-ref-conv-walk.js:123-131`) reads "Reading is the prep" + "🎬 Drill recall →" button. Tap routes to `startConvDrillSession()` (cross-lesson section-classifier quiz over `conversation.sections[]` that already persists counters). The 6 sections still render below the banner as the reading surface — but the surface is now framed as preview, not the recall destination. Closed-loop signal lifts from "borrowed from convDrill content" to "user routes here, then drills". Projected 6→8 (Closed-loop 2→3 via the explicit route; Active recall stays 1 because in-tab is still tap-to-reveal — true lift comes from the routed convDrill session, not from this tab). Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 7/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/). Closed-loop lift confirmed (2→3). Active recall stays 1 — in-tab act is still tap-to-reveal; route lifts Closed-loop not Active recall. Verdict still IMPROVE-or-cut band: tab is now a viable front-door to convDrill, but the standalone learning value remains marginal.
- 2026-05-30 **Reclassified `retrieval` → `prep`** per rubric update (SKILL.md verdict-ladder section now distinguishes prep-kind tools where recall dims are N/A by design and the value is contextual modeling + routing to a sibling recall drill). The 7/21 retrieval-kind score was a rubric blind spot — grading a prep surface by Active-recall/Encoding/Spacing/Interleaving/Feedback produces zeros on dimensions that aren't trying to be engaged. Under the prep-kind ladder: Transfer 2/3 + Closed-loop 3/3 = **5/6 KEEP, ship-quality.** Tool is now correctly scored as a study surface that models the interview context AND routes to the recall drill. No code change; the rubric was wrong, not the tool.
- 2026-05-30 Re-scored at 7/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-184940/). No source changes since prior rescore. Banner at `:126-134`, route handler at `:150-157`, sections `<details>` block at `:111-119` all verified in current source. Verdict unchanged.
