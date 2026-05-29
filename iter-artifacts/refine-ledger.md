# Refine — Iteration Ledger

One row per iteration of `/drill-refine`. Updated by the skill at the end of
Step 6 (shipped) or Step 5 (halted by contrarian).

| Iter | Surface | Change | Rubric (before → after) | Outcome |
|---|---|---|---|---|

## Outcome codes

- `shipped` — change committed, validator + CDP probe green
- `halted` — contrarian blocked; finding kept in artifact; surface NOT re-audited until backlog clears
- `bailed` — Step 0 health check forced abort (e.g., same surface 3× in a row)

## Reading this ledger

Step 0 of the skill scans the last 6 rows. Watch for:
- ≥4 `halted` in last 6 → contrarian is over-strict (will loosen this iter)
- ≥3 same surface in a row → force a different surface this iter

## Cross-ref

- The skill: `.claude/skills/drill-refine/SKILL.md`
- The surfaces: `iter-artifacts/refine-surfaces.md`
- The backlog of queued refinements (one-per-iter throttle overflow): `iter-artifacts/refine-backlog.md` (created on first append)
- The user model: `PROFILE.md` (load-bearing — re-read every iter)
| 1 | diagnostic-results | Add primary "🎯 Drill weakest: <section>" CTA — diagnostic→drilling autopilot bridge | 8/21 → 13/21 (proj.) | shipped |
| 2 | reflect-dashboard | Constrain Stats modal to max-height:90vh + internal overflow-y — Track Balance no longer clipped off-viewport | 9/21 → 13/21 (proj.) | shipped |
| 3 | mechanics | Default to Matrix view when transfer gaps exist — diagnostic-aware view first | 13/21 → 16/21 (proj.) | shipped |
| 4 | mock-interview | Restore + enrich post-mock win line (prior-best delta) — fixes latent detached-feedback bug | 11/21 → 14/21 (proj.) | shipped |
| 5 | today-plan | Stack title + why-tag vertically — fixes mobile clipping of "review due"/"weak spot"/"next on plan" on 80%-phone surface | 7/21 → 11/21 (proj.) | shipped |
| 6 | plan-picker-modal | Add ⭐ RECOMMENDED badge + emerald accent on Starter Plan card in welcome mode — gives first-time ADHD users an obvious default | 8/21 → 11/21 (proj.) | shipped |
| 7 | mock-interview | Inline "🎯 Mock another" CTA on post-win feedback — lowers repeat-mock friction, directly serves "PBs trend down over weeks" metric | 14/21 → 15/21 (proj.) | shipped |
| 8 | — | No clean target: every registry surface either refined this session OR blocked by user's in-flight Font Scale feature WIP (~8 files). Re-refining would cluster; touching WIP files risks collision. Wait for next /loop fire with cleared WIP. | — | bailed |
| 9 | lesson-tabs | Auto-scroll active tab into view in renderLesson tab strip — mobile 6-tab strip no longer leaves users on a tab whose marker is off-screen | 13/21 → 15/21 (proj.) | shipped |
| 10 | today-plan | Primary "🎯 Start: <plan[0]>" autopilot CTA at top of Today modal — one tap = drilling the smartest pick; 6-card list remains as override | 11/21 → 15/21 (proj.) | shipped |
| 11 | mock-interview | Smart selection — replace Math.random with weighted pool (BOTH weak+due ×5, either ×3, baseline ×1); biases toward gaps while preserving interleaving | 15/21 → 18/21 (proj.) | shipped |
| 12 | L2 fill-in | Auto-scroll next un-passed exercise to viewport top after a Check pass — mobile drilling becomes tap-tap-tap instead of tap-pause-scroll-tap | 15/21 → 18/21 (proj.) | shipped |
| 13 | Reference tab | Inline "🎯 Drill from blank →" CTA right after canonical code — desktop fully above fold; mobile 307px closer (full mobile fix queued: sticky CTA / header compaction) | 13/21 → 16/21 (proj.) | shipped |
| 14 | — | Diminishing returns: 12 product ships across 7/11 registry surfaces this session; 4 remaining surfaces WIP-blocked; queued backlog items now smaller-than-typical iter wins. Bailing rather than shipping process. Next /loop should re-survey after user WIP clears. | — | bailed |
| 15 | — | User shipped iOS-PWA fix (baf359b) but the 8-file Font Scale WIP is still in-flight. Same surface inventory as iter 14 — no new clean targets. Bailing rather than re-litigate iter-14's reasoning. Ledger now at 2-of-last-6 bailed (Step-0 trigger is ≥4); a 3rd bail next iter would still not trigger, but if user WIP persists into iter 17, consider whether the /loop cadence is too tight for active dev. | — | bailed |
| 16 | — | Step-2 bail: context budget at 78% (>75% threshold per skill contract). Session shipped a5fd781 (🔠 Font Scale feature completion + mobile rem-conversion bug fix) as user-named follow-on; that work consumed the iter's budget. Next /loop should re-survey with fresh context. | — | bailed |
| 17 | — | Step-2 bail again: context still over 75% (only ledger/commit work added since iter 16). 3rd bail in last 6 (still under the ≥4 Step-0 trigger). If iter 18 also bails (which it will if /loop fires in this same conversation), Step 0 will trigger "ship cheapest viable" — but that contradicts Step 2's context-budget rule; recommend pausing /loop until next session with fresh conversation context. | — | bailed |
| 18 | — | Step 0 triggered (4 bails in last 6: iters 14-17) AND Step 2 still triggered (context 80%). The rules contradict — Step 0 says "force-ship cheapest viable," Step 2 says "bail." Resolution: Step 0 was designed for process-induced bails (over-strict contrarian etc.); these bails are context-induced — forcing a ship now would either fail or consume the remaining context on a low-quality refinement. Cancelled the /loop cron (d9df31ae) so iter 19+ doesn't fire in this exhausted conversation. User can re-run /loop in a fresh session for more iters. | — | bailed (loop cancelled) |
| 19 | topbar | Show ACTIVE surface-toggle label on mobile (`.surface-seg.active .surface-seg-label{display:inline}`). Inactive stays icon-only — fits the 150px budget the prior 2026-05-28 author rejected. Step 0 fired (5/6 bailed in fresh session); skipped Step 2.5 vision; cheapest viable on stalest no-WIP surface. | 9/21 → 11/21 (proj.) | shipped |
| 20 | diagnostic-results | Mark the breakdown table's weakest row with class="weakest-row" + fuchsia left-border accent (matches the "🎯 Drill weakest" CTA's pick). Reduces the ADHD/phone user's scan-and-find-lowest task — table now visually corroborates the CTA. Step 0 still fired (5/6 bailed); skipped Step 2.5 vision again. | 17/21 → 19/21 (proj.) | shipped |
| 21 | reflect-dashboard (Mechanics list) | Promote category headers (ITERATION / POINTERS & WINDOWS / etc.) from 10.5px muted-grey to 12px lavender + 2px left-border + larger margin-top. The 39 mechanic rows now read as grouped sections instead of an undifferentiated wall — ADHD scan-by-category instead of row-by-row. Step 0 still fired (4/6 bailed); skipped Step 2.5 vision. | 13/21 → 15/21 (proj.) | shipped |
| 22 | today-plan | Inventory row ("N DUE · N WEAK · N ON PATH") between the green START CTA and the OR-PICK-ANOTHER divider in the Today modal. Converts the 6-card list from "unknown queue" to "named bundle" — user sees session scope at a glance without counting cards. Renders only when ≥2 buckets active. Step 0 CLEARED (3/6 bailed); ran full ceremony with Step 2.5 vision restored. | 15/21 → 17/21 (proj.) | shipped |
| 23 | plan-picker-modal | Split each plan card's blurb on first sentence boundary; render lead in brighter #cbd5e1 + font-weight 500, tail in muted #94a3b8. Lead carries the actual differentiator ("Linear recommended order…" / "Interview in 4 days." / "12 applied problems…"); ADHD user scans 3 distinct lead lines instead of parsing 3 paragraphs. Step 0 cleared; full ceremony. | 11/21 → 13/21 (proj.) | shipped |
| 24 | mock-interview | Suppress the "Next lesson / Shuffle review" `[data-cta-row]` while a mock is active on this lesson. Removes the contradictory abandonment CTA above a timed-interview banner. Mobile editor moves 72px closer to fold; desktop editor now above-fold. Step 0 cleared; full ceremony with Step 2.5 vision (mock as own minimal surface). | 13/21 → 15/21 (proj.) | shipped |
| 25 | reflect-dashboard (Stats modal) | Append "· N%" to the headline MASTERED tile in the Stats modal so the user no longer has to mentally compute the overall percentage that every other surface (sidebar header, Track Balance compass) already shows. Step 0 cleared; full ceremony with Step 2.5 vision (one primary metric leads the modal). | 13/21 → 14/21 (proj.) | shipped |
| 26 | lesson-tabs (L3 drill) | Suppress the lesson-shell `.lesson-prompt` PROBLEM box on the L3 tab (the L3 body has its own PROMPT box with expected-output cue covering the same content). Mobile editor moves 198px closer to fold (1160 → 962); desktop editor moves 105px closer (702 → 597). Other tabs unaffected. Step 0 cleared; full ceremony. | 13/21 → 15/21 (proj.) | shipped |
| 27 | mock-interview | Suppress the tab strip during an active mock — the surface is L3-locked by the timer's framing but the 6 tappable tabs LOOK like nav and break mock state if used. Removes ~50px above the rose banner + eliminates the broken-state interaction. Mobile editor 1199 → 929; desktop 749 → 578. Step 0 cleared; full ceremony continuing the iter-24 minimal-interview-surface vision. | 15/21 → 17/21 (proj.) | shipped |
| 28 | lesson-tabs (Reference) | Promote the Reference tab's Notes section header from tiny-grey-uppercase to 12px lavender + 2px left-border + appended count ("NOTES · 3") — matches iter-21's mechanics-list pattern. Makes the gotchas (the rusty engineer's highest-value refresh-cues) findable as a clear section with scope preview. Step 0 cleared; full ceremony; file-clustering avoidance picked 11-tabs-ref-conv-walk.js over another 10-render-sidebar-lesson.js touch. | 15/21 → 17/21 (proj.) | shipped |
| 29 | mock-interview | Suppress the prev/next-lesson arrow buttons (◀ ▶) in the title row during an active mock — third broken-affordance flavor (after iter-24 next-CTA, iter-27 tab strip). Tapping them mid-mock called selectLesson() which silently broke state (banner stayed, but timer ticked against wrong content). j/k keyboard shortcuts unchanged. Required optional-chaining the existing addEventListener calls. Step 0 cleared; full ceremony continuing the 3-iter mock-minimal-surface trajectory. | 16/21 → 17/21 (proj.) | shipped |
