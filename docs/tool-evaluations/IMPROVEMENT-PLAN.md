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

---

## Phase 0 — User decisions (do BEFORE any execution)

These two tools scored sub-10 (strict ladder → REMOVE band), but agents argued viable salvage. **Ask the user before touching them.**

- [ ] **flash** (7/21) — DECIDE one of:
  - (a) salvage → self-rate + SR + mechanics-weighted tokens → projected 14/21
  - (b) remove (Notes Drill covers cloze-MC; flash is strictly weaker cousin per audit)
  - (c) demote to "preview" surface that routes to Notes Drill
  - 📄 `audits/flash.md`
- [ ] **conversation** (6/21) — DECIDE one of:
  - (a) salvage by routing through sibling `convDrill` (already reuses `conversation.sections[]`)
  - (b) demote tab to "preview" surface that routes to `convDrill`
  - (c) remove the tab entirely (content survives in drill registry)
  - 📄 `audits/conversation.md`

If user says "salvage", move the item to the appropriate tier below and proceed.
If user says "remove" or "decline", mark `- [-] declined-by-user` and continue.

---

## Phase 1 — One-edit wins (start here)

Highest-impact-per-edit ratio. Each is a single ~3-line change with a meaningful rubric lift. Low risk, fast confidence-build.

- [ ] **reference** — In the L3 grader for Notes→Code mode, call `markPassed(id, 'L3')` on green pass so the SR scheduler picks up the win (+4: Spacing 1→3, Closed-loop 2→3) — 📄 `audits/reference.md`

**After Phase 1 ships:** re-run `/eval-learning-tool reference` to verify the lift.

---

## Phase 2 — Drill-family cross-cutting (huge cumulative leverage)

**Pattern: SR write on win.** None of the 8 drill tools call `recordReview(lessonId)` on a correct pick — wins don't strengthen the SR cache. Add the shared pattern to each. One commit per tool keeps each diff reviewable.

Some tools also have a *second* edit bundled — apply both in the same commit when noted.

- [ ] **notes-drill** — `recordReview` on win (+2 Spacing) — 📄 `audits/notes-drill.md`
- [ ] **recognize** — `recordReview` on win + `state.weakness` on miss (+3 total) — 📄 `audits/recognize.md`
- [ ] **trace** — `recordReview` on win (+2 Spacing) — 📄 `audits/trace.md`
- [ ] **reverse** — `recordReview` on win (+2 Spacing) — 📄 `audits/reverse.md`
- [ ] **predict** — `recordReview` on win + optional typed-output mode behind toggle (+4 total) — 📄 `audits/predict.md`
- [ ] **claim** — `recordReview` on win + algorithmic distractors (replace hand-curated registry seeding) (+5 total) — 📄 `audits/claim.md`
- [ ] **gotcha** — `recordReview` on win + cloze-deletion on the note text (replace honor-system "knew it") (+6 total) — 📄 `audits/gotcha.md`
- [ ] **swap-bench** — per-pair `recordReview` on win + corpus expansion path (+5 total) — 📄 `audits/swap-bench.md`

**After Phase 2 ships:** re-run `/eval-learning-tool --all` to verify the +16 cumulative Spacing lift across the drill family.

---

## Phase 3 — Single-tool high-leverage IMPROVEs

Multi-edit but each tool has a clear path to ship-quality band.

- [ ] **walkthrough** — persist Quiz / 🪲 Bug submode outcomes to `state.weakness` + history (+6: 11→17) — 📄 `audits/walkthrough.md`
- [ ] **rapid-fire-l1** — SR+weakness-weighted deck (currently uniform Fisher-Yates) + post-streak free-recall reveal window (+3: 16→19) — 📄 `audits/rapid-fire-l1.md`
- [ ] **warmup-3card** — `appendHistory('L1-pass')` on win + typed-recall variant for next-on-plan card (+2: 15→17) — 📄 `audits/warmup-3card.md`
- [ ] **l2** — attempt-count weakness signal (so "struggled-but-eventually-passed" middle case is visible) + per-blank tiered reveal — 📄 `audits/l2.md`
- [ ] **l1** — carry-over weak-spot question per session — 📄 `audits/l1.md`

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
