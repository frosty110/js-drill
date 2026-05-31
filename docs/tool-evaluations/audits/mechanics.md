# Mechanics matrix — Learning-effectiveness audit (reflection-kind)

**Total: 6/6** (reflection-kind: only Closed-loop + Transfer-context scored)
**Verdict: KEEP**
**Anchor file:** `js/app/13-mechanics-modal.js:37`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | N/A | (reflection tool — does not teach via retrieval) |
| Encoding strength | N/A | (reflection tool) |
| Spacing | N/A | (reflection tool) |
| Interleaving | N/A | (reflection tool) |
| Feedback quality | N/A | (reflection tool) |
| Transfer-context match | 3/3 | Mechanics list categorizes by mechanic + ranks within category by *in-progress first → untouched → complete* (`13-mechanics-modal.js:192-215`) — directly answers "what idiom am I half-fluent on?" Matrix view (`:244-282`) sorts transfer-gap rows first (`:276-277`) — rows where user mastered an idiom in one track but not another. The matrix-default-on-transfer-gaps logic (`:48-60`) routes the user straight to the actionable rows on open. PROFILE.md `pattern-fluency` need is named in `:241-243`. |
| Closed-loop signal use | 3/3 | Composes 3+ signals: `lessonOverallStatus` (`:16, 260`), `isDueForReview` (`:23, 351`), `state.weakness` (`:24, 352`), per-track manifest (`:255-256`). Detail-view lesson rows sorted by review priority (`:20-34`) — due first, then weak, then in-progress, then untouched, mastered last. Tap-routes to lesson via `selectLesson(id)` on `:167-173`; matrix cells tap-route to mechanic detail filtered to track (`:131-141`); reference-tab mechanic chips reverse-route into here (`openMechanicsDetail` `:79-100`); 🧠 Bridge (`04-progress-sr.js:545`+) consumes the same transfer-gap signal as a 1-tap routing surface. |

## Strengths
- Diagnostic-aware default view: opens Matrix when transfer gaps exist, else List (`13-mechanics-modal.js:49-60`) — answers PROFILE.md "Default actions matter more than option exhaustiveness."
- Transfer-gap detection (`:265-271`) is a unique signal no other reflection tool surfaces — mastered-in-syntax-but-not-patterns is the exact rust-engineer pattern-fluency gap. The matrix is also the upstream signal for the 🧠 Bridge routing surface, so this reflection tool *feeds* a routing tool — non-duplicative coupling.
- Within-category state-priority tiering (`:202-215`) addresses ADHD "single-focus surface" — in-progress mechanics float to top, so the user doesn't scan for "the one with a non-zero, non-100% percent."

## Weaknesses
- Matrix doesn't surface miss-tag overlap (`state.misses`) — a mechanic where the user repeatedly tags "off-by-one" misses isn't differentiated from one with clean misses.
- Detail view sort uses `lessonOverallStatus` but not SR `dueAt` magnitude — a lesson due 30 days ago ranks same as one due tomorrow (Resurrect Queue logic at `04-progress-sr.js:522` could be borrowed for ordering).
- No "you've never touched this mechanic but it's in this week's path" nudge — Mechanics doesn't intersect with `state.starterPath` or `cram` path progress.

## Action log
- 2026-05-30 Scored 6/6 by `/eval-learning-tool --all`.
- 2026-05-30 Re-scored at 6/6 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
