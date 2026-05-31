# Learning-tools improvement campaign — handoff

> **For the AI agent picking this up in a new chat:** you are continuing the work begun by `/eval-learning-tool --all` (commits `7372ab8` + `6a52e03`, 2026-05-30). The triage identified 8 IMPROVE-verdict tools + 10 KEEP-but-salvageable tools across the JS Drill app's learning surfaces. Your job is to execute the salvage paths in order of leverage, marking checkboxes done as you ship each commit.
>
> **Read these three files first**, in order:
> 1. `docs/tool-evaluations/TRIAGE.md` — the master verdict table with scores
> 2. `.claude/skills/eval-learning-tool/SKILL.md` — the rubric + workflow
> 3. `PROFILE.md` — the user model (LAW; never edit)
>
> **The audit-detail files at `docs/tool-evaluations/audits/<tool-id>.md` are the salvage source-of-truth** — each one names file:line edits + the projected score lift. Read the relevant audit before touching any source code.

## Quick-start

1. Pick the first unchecked item in **Phase 1** below (or whatever phase you're in).
2. Read its linked audit file.
3. Read the named source files. Verify the salvage path is still applicable (no drift since 2026-05-30 — note that the audit may reference file:line that's shifted).
4. Apply the edits, one tool per commit.
5. Validate + commit + push + mark checkbox `- [x]`.

## Per-item workflow (every checked item below)

1. **Read** `docs/tool-evaluations/audits/<tool-id>.md` — has the file:line salvage path + projected score lift.
2. **Read** the source files. Confirm the salvage path matches current code (re-grep if line numbers shifted).
3. **Apply** the edits.
4. **Validate**: `node tools/validate-data.js` — must show `X passed, 0 failed`.
5. **Probe (if exists)**: re-run any matching CDP probe under `tools/cdp/refine-<surface>.js` or `tools/cdp/<tool>-*.js`.
6. **Commit atomically** per `CLAUDE.md § Commit message convention`:

   ```
   [product/<category>] eval-learning-tool: execute salvage path for <tool-id>

   ## Product impact
   <user-facing change in PROFILE.md terms; name the rubric dim(s) that moved>

   ## Engineering
   <files touched, by-edit summary>

   ## Verification
   node tools/validate-data.js: X passed, 0 failed
   <probe output if any>

   ## Audit reference
   docs/tool-evaluations/audits/<tool-id>.md (projected: <old>/21 → <new>/21)

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

7. **Push**.
8. **Mark checkbox done below**: `- [x]` and append `→ commit <short-hash>`.
9. **Update TRIAGE.md row** for this tool: action status → `actioned-<YYYY-MM-DD>`.
10. **Append a line to the audit's `## Action log`**: date + commit hash + actual edit summary.

## Halt rules

- **Validator fails:** roll back the edit, mark `- [!] <reason>`, halt and surface to user.
- **Salvage path drifted significantly** (named lines moved by >50 lines or refactored): do NOT guess. Re-score that tool via `/eval-learning-tool <tool-id>` to refresh the audit, then proceed.
- **User said "stop" or "decline" in chat:** mark `- [-] declined-by-user` and skip.
- **Coverage budget tight:** after each tier, ask the user whether to continue or pause.

## Re-score gates

After every tier, run `/eval-learning-tool --all` to verify the projected lifts were real. Compare the new TRIAGE.md to the old; if a tool didn't actually move, the salvage path didn't deliver — investigate.

## Real SR-write functions (reference)

The audits sometimes use a generic name like `recordReview` when describing the salvage. The ACTUAL functions in this codebase are below — use these exact signatures. Anything else is phantom.

| Helper | Signature | Lives at | When to call |
|---|---|---|---|
| `markPassed` | `markPassed(lessonId, level)` where `level ∈ {'L1','L2','L3'}` | `js/app/09-stats-cheatsheet-mock.js:764` | The high-level entry point L1/L2/L3 wins call. Internally appends history + cascades to `scheduleReview`. Use this when a drill genuinely represents an L-level pass. |
| `scheduleReview` | `scheduleReview(lessonId, { advance = true } = {})` | `js/app/04-progress-sr.js:431` | The SR primitive. `advance: true` rolls the bucket to the next interval (1d → 7d → 30d). `advance: false` is the L2-style **hold-but-reset-dueAt** — keeps the SR cycle moving without claiming the user free-recalled. **Drill family salvages should use `{ advance: false }`** — drills are recognition-tier, shallower than L2, so the bucket should not advance. |
| `appendHistory` | `appendHistory(lessonId, event)` where `event` is a string like `'L1-pass'`, `'L1-miss'`, `'notes-to-code-pass'`, `'walkthrough-quiz-pass'` | `js/app/04-progress-sr.js` (search the file for the export) | History feed read by Pace-Bar, sparkline, Stats. Schema-additive — new event strings are silently accepted by all readers (they branch on known strings or ignore unknowns). |
| `recordWrong` | `recordWrong(lessonId)` | `js/app/04-progress-sr.js:764` | Increments `state.weakness[lessonId]`. The miss-side counterpart for closed-loop signal. Surfaces in At-Risk, Weak Spots, Today's Plan, Rapid-Fire weak-spot diagnostic. |
| `recordMiss` | `recordMiss(lessonId, level, tagId)` | `js/app/04-progress-sr.js:787` | Writes `state.misses[lessonId]` for the iter-58 mistake-tagging chip-strip. Used by L1's chip strip. |
| `clearWeakness` | `clearWeakness(lessonId)` | `js/app/04-progress-sr.js` | Decrements weakness counter on a clean pass (so a single win doesn't reset a long-standing weakness, but a steady-state of wins erodes it). |
| `markRevealed` | `markRevealed(lessonId, level)` | `js/app/04-progress-sr.js` | Flags `state.revealed[lessonId][level] = true`. Drives At-Risk dot variant, Reveal Replay queue, ringed-green dot demotion on clean-pass invariant. |

**Drill-win SR semantics (decision baked into Phase 2 audits, 2026-05-30):** drill wins call `scheduleReview(id, { advance: false })`, NOT `markPassed` (which would falsely claim an L-tier pass). Rationale: drills are 4-MC recognition tier, shallower than L2's typed cued-recall (which already uses hold-but-reset). Drill wins should keep the SR cycle moving without overstating recognition-vs-recall confidence. If you ship a free-text-first drill variant later (Phase 6), THAT variant could promote to `markPassed(id, 'L2')` — but the recognition mode stays hold-but-reset.

---

## Phase 0 — User decisions (do BEFORE any execution)

These two tools scored sub-10 (strict ladder → REMOVE band), but agents argued viable salvage. **Ask the user before touching them.**

- [x] **flash** (7/21) — DECISION (2026-05-30): **(a) salvage** → self-rate + SR + mechanics-weighted tokens → projected 14/21. Added to Phase 3.
  - 📄 `audits/flash.md`
- [x] **conversation** (6/21) — DECISION (2026-05-30): **(a) salvage via convDrill route** (preview-with-route to sibling drill). Added to Phase 3.
  - 📄 `audits/conversation.md`

---

## Phase 1 — One-edit wins (start here)

Highest-impact-per-edit ratio. Each is a single ~3-line change with a meaningful rubric lift. Low risk, fast confidence-build.

- [x] **reference** — In the L3 grader for Notes→Code mode, call `markPassed(id, 'L3')` on green pass so the SR scheduler picks up the win (+4: Spacing 1→3, Closed-loop 2→3) — 📄 `audits/reference.md` → commit `473ad7c`

**After Phase 1 ships:** re-run `/eval-learning-tool reference` to verify the lift.

---

## Phase 2 — Drill-family Spacing fixes (high cumulative leverage)

**Common theme:** none of the 8 drill tools currently feed the SR scheduler well — but the audits propose **three different patterns**, not one shared fix. Group A reads from SR (`state.reviews`/`state.weakness`) to bias card selection. Group B writes to SR on win. Group C invents per-card SR state. Each tool's audit names its own approach — read the linked audit before editing.

**Group A — SR-weighted READ (bias card pick from existing signals):** +1 Spacing each. Lowest-risk, smallest-edit.

- [x] **notes-drill** — replace Fisher-Yates with SR-weighted pull biased toward `state.weakness` lessons or overdue `state.reviews[lessonId]` at `js/app/05-drills-recognize-trace.js:832-835` (+1 Spacing) — 📄 `audits/notes-drill.md` → commit `69ba011`
- [x] **recognize** — SR-weighted shuffle (mirrors Reverse pattern at `:585`) at `js/app/05-drills-recognize-trace.js:9-21` (+1 Spacing); **also** feed `state.weakness[card.lessonId]++` + `appendHistory(... 'L1-miss')` on miss at `:62-71` (+1 Closed-loop) — 📄 `audits/recognize.md` → commit `02fb7dd`
- [x] **trace** — SR-weighted shuffle at `js/app/05-drills-recognize-trace.js:551-572` (+1 Spacing) — 📄 `audits/trace.md` → commit `047278a`
- [x] **reverse** — SR-weighted shuffle at `js/app/07-drills-swap-speedrun.js:489-510` (+1 Spacing); audit also bundles Interleaving +1 (include `applied` track) and Feedback +1 — see audit for the full +3 — 📄 `audits/reverse.md` → commit `d1c27bc`

**Group B — SR WRITE on win (`scheduleReview(id, { advance: false })`):** +2 Spacing each. Uses L2's hold-but-reset-dueAt semantics — drills are recognition-tier, shallower than L2 cued-recall, so the SR cycle keeps moving but the bucket doesn't falsely advance. See "Real SR-write functions" reference section below for the function signatures.

- [x] **predict** — `scheduleReview(card.lessonId, { advance: false })` on `wasCorrect` at `js/app/07-drills-swap-speedrun.js:405` (+2 Spacing); audit also proposes typed-output mode (+2 Encoding) and per-option explain (+1 Feedback) — 📄 `audits/predict.md` → commit `99ff288`
- [x] **claim** — same SR-write pattern at `js/app/07-drills-swap-speedrun.js:238` (+2 Spacing); audit also proposes algorithmic distractors (+2 Interleaving) — 📄 `audits/claim.md` → commit `f466c37`
- [x] **gotcha** — same SR-write pattern at `js/app/05-drills-recognize-trace.js:257` (+2 Spacing); audit also proposes cloze-deletion on the note (+2 Active recall +2 Encoding) and a 1-line "why" from source lesson (+1 Feedback) — full path lifts +6 — 📄 `audits/gotcha.md` → commit `0c518ea`

**Group C — Custom per-pair SR (new schema):** +3 Spacing. Multi-edit; treat as its own mini-phase.

- [x] **swap-bench** — extend `state.swapBench` shape to track per-pair `{ dueAt, interval }` (`js/app/01-state-content.js:221`); on win double interval (1d→2d→4d), on miss reset to 1d; build deck preferring overdue pairs in `_swapBuildDeck` at `js/app/07-drills-swap-speedrun.js:12`. Lifts Spacing 0→3 (+3) — 📄 `audits/swap-bench.md` → commit `33a69be`

**Cumulative Spacing lift across drill family (Group A + B + C):** ≈4×1 + 3×2 + 1×3 = **+13 Spacing points** across 8 tools. Plus the Closed-loop / Encoding / Interleaving / Feedback side-edits bundled into each audit (read each audit for the full +N projection per tool).

**After Phase 2 ships:** re-run `/eval-learning-tool --all` to verify per-tool lifts.

---

## Phase 3 — Single-tool high-leverage IMPROVEs

Multi-edit but each tool has a clear path to ship-quality band.

- [x] **walkthrough** — extend `state.walkthrough[lessonId] = { quizAttempts, quizCorrect, bugAttempts, bugCorrect, lastRunAt }` at `js/app/11-tabs-ref-conv-walk.js:424-438, 548-563`; on miss also flag `state.weakness[lessonId]`; default-open `🔮 Quiz` after first full scrub (+6: 11→17) — 📄 `audits/walkthrough.md` → commit `a01b0a8`
- [x] **rapid-fire-l1** — SR+weakness-weighted deck (currently uniform Fisher-Yates) + post-streak free-recall reveal window (+3: 16→19) — 📄 `audits/rapid-fire-l1.md` → commit `5c44495` (SR-weight edit shipped; free-recall variant deferred)
- [x] **warmup-3card** — `appendHistory('L1-pass')` on win + typed-recall variant for next-on-plan card (+2: 15→17) — 📄 `audits/warmup-3card.md` → commit `61e3d94` (history+decay shipped; typed-recall variant deferred)
- [x] **l2** — attempt-count weakness signal (so "struggled-but-eventually-passed" middle case is visible) + per-blank tiered reveal — 📄 `audits/l2.md` → awaiting commit (attempt-count + struggle-pass weakness shipped; per-blank tiered reveal deferred)
- [ ] **l1** — carry-over weak-spot question per session — 📄 `audits/l1.md`
- [ ] **flash** (Phase 0 salvage decision) — self-rate after reveal + persist `state.flash.{lessonId} = { attempts, blanks, lastRunAt }` + mechanics-weighted token selection + SR-scheduled surfacing. Projected 7→14 (+7) — 📄 `audits/flash.md`
- [ ] **conversation** (Phase 0 salvage decision) — demote tab to preview-with-route surface that links each section header into `convDrill` (which already mines `conversation.sections[]` and writes counters). Keeps the tab visible but the recall happens in the drill — 📄 `audits/conversation.md`

**After Phase 3 ships:** re-run `/eval-learning-tool --all`. Phase 3 + Phase 1+2 together should move the median tool score by 3-5 points.

---

## Phase 4 — Reflection-tier IMPROVEs

Reflection tools surface signal; these two don't *route* on tap and lose leverage.

- [ ] **streak-map** — capture per-day missed lessonIds + add "Drill the 3 you missed Mar 14" routing button (3→6) — 📄 `audits/streak-map.md`
- [ ] **mistake-tagging** — tap-route Stats aggregator pills (currently zero click-route) + add tag-grain Today's Plan slot (4→6) — 📄 `audits/mistake-tagging.md`

**After Phase 4 ships:** re-run `/eval-learning-tool streak-map mistake-tagging`.

---

## Phase 5 — Feedback-quality polish (smaller bang-per-buck)

Defer if scope is tight. Each is +1 Feedback dim per tool. Skip during a focused improvement campaign unless the user explicitly asks.

- [ ] **l1** — per-option `whyWrong` field on `L1.questions[*].options` (authoring-heavy across 166 lessons; consider lesson-audit-style batch)
- [ ] **l2** — per-blank tiered reveal (1st reveal = type hint, 2nd = letter count, 3rd = answer)
- [ ] **notes-drill** — post-miss callout of why the correct word is correct (pull from note context)
- [ ] **reverse** — corrective feedback paragraph on miss (vs current minimal `✓`/`✗`)

---

## Phase 6 — Recognition-tier ceiling lift (architectural)

**Speculative.** Every drill except `mock-interview` and `l3` is recognition-tier (capped at Encoding 1/3). Adding a free-text-first / MC-fallback affordance across the drill family would lift Encoding +1 on each. This is a cross-cutting architectural change — flag for user before committing.

- [ ] **decision** — Should drill family ship a free-text-first input layer? Affects notes-drill, recognize, trace, reverse, predict, claim, gotcha, swap-bench. **Ask user first.**

---

## Final re-score

- [ ] **`/eval-learning-tool --all`** — final batch run; compare to baseline TRIAGE; archive both for delta analysis.

---

## Status legend

- `- [ ]` not-started
- `- [~]` in-progress (also write `<your-agent-id>`)
- `- [x]` completed (append `→ commit <short-hash>`)
- `- [!]` failed (append `<reason>`; halt and surface to user)
- `- [-]` declined-by-user (won't be done)

## Effort estimate

Rough sizing per phase (assuming familiarity with the codebase):

| Phase | Items | Est. commits | Est. focused time |
|---|---|---|---|
| 0 — decisions | 2 | 0 (just user input) | 5 min |
| 1 — one-edit wins | 1 | 1 | 30 min |
| 2 — drill family SR | 8 | 8 | 3-4 hours |
| 3 — single-tool high-leverage | 5 | 5-8 (some multi-commit) | 3-5 hours |
| 4 — reflection tier | 2 | 2 | 1-2 hours |
| 5 — feedback polish | 4 | 4 + lesson-audit batch | 4-6 hours |
| 6 — recognition-tier lift | 1 decision + 8 implementations | 1-9 | 4-8 hours if approved |
| **Total (P0-P4)** | **18** | **~16** | **~8-12 hours** |

## Tools NOT in this campaign (no action needed)

For reference — these scored ≥18/21 (retrieval) or 5-6/6 (reflection) and need NO improvement work:

L3 (20/21), Mock Interview (19/21), Stats (6/6), Mechanics (6/6), At Risk (6/6), Resurrect (6/6), Reveal Replay (6/6), Repair (6/6), Mock Replay Reel (5/6), Today's Plan (6/6).

If you want to refine their **UX** (not their learning effectiveness), that's `/drill-refine`'s job — not this campaign.

## Cross-ref

- Triage: `docs/tool-evaluations/TRIAGE.md`
- Audit detail per tool: `docs/tool-evaluations/audits/<id>.md`
- Skill spec: `.claude/skills/eval-learning-tool/SKILL.md`
- User model (LAW): `PROFILE.md`
- Project conventions: `CLAUDE.md`
- Original audit commits: `7372ab8` (scaffolding) + `6a52e03` (28 audits + TRIAGE)
- This plan: `docs/tool-evaluations/IMPROVEMENT-PLAN.md`
