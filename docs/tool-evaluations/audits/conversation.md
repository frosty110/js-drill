# Conversation interview-narration — Learning-effectiveness audit

**Total: 6/21**
**Verdict: IMPROVE-or-cut**
**Anchor file:** `js/app/11-tabs-ref-conv-walk.js:49`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 1/3 | `js/app/11-tabs-ref-conv-walk.js:111-119` — every section is a `<details>` collapsed by default; tap-to-expand is one-tap reveal with no retrieval gate. Title + prompt are visible (lines 113-115) — user reads the prompt, then taps to see the "say/why" answer without producing anything. Categorically recognition/familiarity, not recall. |
| Encoding strength | 1/3 | `js/app/11-tabs-ref-conv-walk.js:78-106` — body is pre-authored prose ("What I'd say", "Why this matters"). User reads, doesn't produce. Closest to recognition; sections occasionally include `examples` with traces (lines 84-100) but those are also read-only. |
| Spacing | 0/3 | No `state.reviews` integration. Grep of `js/app/11-tabs-ref-conv-walk.js` for `state.` returns only `state.adhdMode` and `state.currentLessonId` — no SR scheduling, no `lastRunAt`, nothing in `state` schema (`js/app/01-state-content.js`) tracks per-section conversation visits. |
| Interleaving | 0/3 | Bound to one lesson (`renderConversation(body, content)` at line 49 takes single lesson content). No cross-lesson session, no shuffle. |
| Feedback quality | 0/3 | No right/wrong concept — purely expository. There's no "answer to be wrong about" so the dimension is structurally absent. |
| Transfer-context match | 2/3 | `js/app/11-tabs-ref-conv-walk.js:111-119` — sections are *interview-shaped* ("Clarify", "Approach", "Code", "Complexity", etc. per `docs/conversation-walkthrough.md`) and the say/why split mirrors the verbalize-while-coding cadence PROFILE.md targets. Closest match of any surface to "what would you say in an interview." But it's a *reading* of the interview rather than a simulation. |
| Closed-loop signal use | 2/3 | No write path on Conversation read alone. BUT a sibling tool (`convDrill`, `js/app/01-state-content.js:222`) drills the section-classifier over `conversation.sections[]` and writes counters — meaning the Conversation content powers a separate retrieval drill. Crediting the tab partly because its content has downstream signal use, not for the read itself. |

## Strengths
- Best-in-app transfer-context match — `js/app/11-tabs-ref-conv-walk.js:78-106` "What I'd say" / "Why this matters" split is the only surface modeling interview verbalization.
- Content is reused by an actual retrieval drill — `js/app/01-state-content.js:222` `convDrill` mines the same `conversation.sections[]` for an active-recall quiz. The content investment pays off there.
- Listen mode (`js/app/11-tabs-ref-conv-walk.js:124,138-140`) extends usage to the eyes-free phone-time slice PROFILE.md amendment C names.

## Weaknesses
- Pure read surface. `js/app/11-tabs-ref-conv-walk.js:111-117` — every section is a one-tap expand. No prompt-and-recall before reveal; tap is just disclosure.
- Zero state writes. `grep state\.` in slice 11 finds only `state.adhdMode` reads; no progress on conversation read feeds `state.reviews` / `state.weakness` / mechanics.
- Not interleaved. Single-lesson surface accessed only via the per-lesson Conversation tab — violates Rohrer & Taylor mixing.

## Salvage path (if IMPROVE)
Ordered by leverage. Each edit names file:line + dim it lifts.
1. **Per-section "predict before reveal" gate** — `js/app/11-tabs-ref-conv-walk.js:111-119` add a thin "What would you say here?" textarea OR "Tap when you've thought of an answer" intent button before the `<details>` opens. Counter persisted to `state.convRead.{lessonId}.{sectionIdx}`. Lifts Active recall +1, Encoding strength +1.
2. **Read → schedule for review** — on first read of all sections in a lesson, seed `state.reviews[lessonId]` if absent (1d interval). Lifts Spacing +1.
3. **Cross-lesson "Interview Reel" session** — sidebar entry that shuffles 5-10 sections from random Patterns/Applied lessons (e.g. all "Clarify" sections in a row, then all "Complexity"). Lifts Interleaving +2.
4. **Mark-confidence after reveal** — 3-button "knew it / partial / blank" under each expanded section, write to `state.weakness[lessonId]` on blank. Lifts Closed-loop +1, Feedback +1 (the self-rating is itself signal).

**Projected after salvage:** 13/21 — still IMPROVE tier, but enough to justify keeping. If salvage doesn't move it ≥4 pts, the rubric verdict reverts to REMOVE; however the conv content itself is load-bearing for `convDrill`, so the **content** stays even if the **tab** is demoted.

## Removal path (if REMOVE)
Conv tab content is reused by `convDrill` (`js/app/01-state-content.js:222`, `js/app/05-drills-recognize-trace.js`) and the audio Listen mode — removing the *tab* would not remove the *content*. If the rubric forces removal: hide the tab behind a settings toggle (default off), keep `data/*.json` `conversation` blocks intact, keep `convDrill` and audio as the primary surfaces consuming the content. Drilling-user-visible loss: the desk-tier "read the interview script" surface; but interleaved drill still drives the content.

## Action log
- 2026-05-30 Scored at 6/21 by `/eval-learning-tool --all`.
