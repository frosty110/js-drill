# Learning tools — registry for /eval-learning-tool

The catalog of EXISTING tools `/eval-learning-tool` is allowed to audit. Add a row to
register a tool; `/eval-learning-tool --all` walks every row in batch.

Picker rule: there is no automatic picker — invoke `/eval-learning-tool <id>` directly
for one tool, or `/eval-learning-tool --all` for the batch.

## Tools

| ID | Name | Kind | Surface | Primary file(s) | Entry point |
|---|---|---|---|---|---|
| `l1` | L1 — Concept MC | retrieval | practice | `js/app/12a-l1.js` (verify in audit) | per-lesson L1 tab |
| `l2` | L2 — Fill-in typed | retrieval | practice | `js/app/12b-l2.js` | per-lesson L2 tab |
| `l3` | L3 — Blank-editor drill | retrieval | practice | `js/app/12c-l3.js` | per-lesson L3 tab |
| `reference` | Reference reading | retrieval | practice | `js/app/11-tabs-ref-conv-walk.js` | per-lesson Reference tab |
| `conversation` | Conversation interview-narration | prep | study | `js/app/11-tabs-ref-conv-walk.js` | per-lesson Conversation tab (Patterns/Applied) |
| `walkthrough` | Walkthrough — line-by-line stepper | retrieval | practice | `js/app/11-tabs-ref-conv-walk.js` | per-lesson Walkthrough tab (Patterns/Applied) |
| `flash` | 🃏 Flash mode — cloze blur-tap on canonical | retrieval | practice | (verify file in audit) | Reference tab → Flash button |
| `notes-drill` | 📝 Notes Drill — fill-blank MC over notes | retrieval | drill | `js/app/05-drills-recognize-trace.js:801` | cmd-k "Notes" / Drills menu |
| `recognize` | 🔎 Recognize — diagnose-the-pattern | retrieval | drill | `js/app/05-drills-recognize-trace.js` | cmd-k "Recognize" |
| `trace` | Trace — predict code execution | retrieval | drill | `js/app/05-drills-recognize-trace.js` | (verify entry in audit) |
| `reverse` | 🎯 Reverse | retrieval | drill | (verify file in audit) | cmd-k "Reverse" |
| `predict` | 🔮 Predict | retrieval | drill | (verify file in audit) | cmd-k "Predict" |
| `claim` | 📐 Claim | retrieval | drill | (verify file in audit) | cmd-k "Claim" |
| `gotcha` | 🏛 Gotcha | retrieval | drill | (verify file in audit) | cmd-k "Gotcha" |
| `swap-bench` | 🔀 Swap-Bench — pairwise idiom equivalence | retrieval | drill | (verify file in audit) | sidebar 🔀 button |
| `mock-interview` | 🎯 Mock Interview — random pattern + L3 + timer | retrieval | train | `js/app/09-stats-cheatsheet-mock.js` + `js/app/12c-l3.js` | sidebar/topbar Mock button |
| `rapid-fire-l1` | ⚡ Rapid-Fire L1 — interleaved L1 stream | retrieval | train | (verify file in audit) | sidebar/cmd-k |
| `warmup-3card` | 🌅 3-Card Warmup | retrieval | train | (verify file in audit) | sidebar / Today's Plan |
| `stats` | Stats dashboard | reflection | reflect | `js/app/09-stats-cheatsheet-mock.js` | Stats modal |
| `streak-map` | 📅 Streak map (60-day heatmap) | reflection | reflect | (verify file in audit) | sidebar Streak button |
| `mechanics` | Mechanics matrix | reflection | reflect | `js/app/13-mechanics-modal.js` | Mechanics modal |
| `at-risk` | 📡 At Risk decay radar | reflection | reflect | `js/app/10-render-sidebar-lesson.js` + `js/app/04-progress-sr.js` | sidebar At Risk pill |
| `resurrect` | 💀 Resurrect Queue (overdue mastered) | reflection | reflect | (verify file in audit) | sidebar Resurrect pill |
| `reveal-replay` | 🃏 Reveal Replay | reflection | reflect | (verify file in audit) | sidebar Reveal Replay button |
| `mock-replay-reel` | ⌚ Mock Replay Reel — slope trend + cells | reflection | reflect | `js/app/12c-l3.js` | inline on L3 (mock-history badges) |
| `repair` | 🛠 Repair filter | reflection | reflect | `js/app/10-render-sidebar-lesson.js` | sidebar Repair pill |
| `mistake-tagging` | 🏷 Mistake-Tagging postmortem | reflection | reflect | (verify file in audit) | L1 miss → chip strip |
| `today-plan` | Today's Plan | reflection | reflect | `js/app/03-paths-cram.js` | Today's Plan modal |

## How `/eval-learning-tool` consumes this

- Per-tool score: `/eval-learning-tool <id>` reads the row, reads the primary file(s), applies the 7-dim rubric, writes `docs/tool-evaluations/audits/<id>.md`, and upserts the row in `docs/tool-evaluations/TRIAGE.md`.
- Batch score: `/eval-learning-tool --all` walks every row, parallelizes via sub-agents at ~4 tools per agent, writes all audits + the master `docs/tool-evaluations/TRIAGE.md`.
- Salvage execution: `/eval-learning-tool --execute-improve <id>` reads the audit's salvage path, applies the edits, commits, marks the triage row `actioned-YYYY-MM-DD`.
- Removal execution: `/eval-learning-tool --execute-remove <id>` reads the audit's removal path, deletes files + state, commits, marks the triage row `actioned-YYYY-MM-DD`.

## How to add a tool

Append a row above. Fields:
- **id** — kebab-case, unique. Becomes the audit filename.
- **Name** — display name as the user sees it (include emoji if present in UI).
- **Kind** — `retrieval` (full 7-dim rubric /21) | `reflection` (Closed-loop + Transfer-context only /6) | `prep` (Transfer + Closed-loop only /6 — study/exemplar surfaces where contextual modeling IS the value; recall dims N/A by design) | reject `navigation` (not a learning tool).
- **Surface** — `drill` | `train` | `reflect` | `practice` | `study` (per user's mental model).
- **Primary file(s)** — load-bearing source location(s). Use `(verify file in audit)` if unknown; the audit will resolve.
- **Entry point** — how the user invokes (cmd-k label / button id / tab name).

## Cross-ref

- The skill: `.claude/skills/eval-learning-tool/SKILL.md`
- The master triage (decisions): `docs/tool-evaluations/TRIAGE.md`
- Per-tool audit details: `docs/tool-evaluations/audits/<id>.md`
- The user model (LAW): [`PROFILE.md`](../../PROFILE.md)
- Sibling rubric (UX-fit, not learning): `.claude/skills/refine-rubric/SKILL.md`
