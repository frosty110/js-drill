---
name: eval-learning-tool
description: Score one learning tool (drill / train / reflect / practice surface) against a 7-dimension learning-science rubric and produce a KEEP / IMPROVE / REMOVE verdict with a specific salvage-or-removal path. Anchored in active recall, encoding strength, spacing, interleaving, feedback quality, transfer-context match, and closed-loop signal use. One-shot per tool (`/eval-learning-tool <tool-id>`) or full batch (`/eval-learning-tool --all`). After triage, the same skill executes the salvage or removal path on a tool via `/eval-learning-tool --execute-improve <id>` or `--execute-remove <id>`. Sibling to /refine-rubric — refine-rubric scores UX fit; this rubric scores whether the tool actually moves the needle on long-term retention.
---

# eval-learning-tool

The metric — and the action loop — for "is this learning tool actually teaching?" Anchored in peer-reviewed learning science, not feature-inventory feeling.

## North star

[PROFILE.md](../../PROFILE.md) says WHO. This rubric says WHETHER a tool actually moves the needle on long-term retention + transfer to the interview-coding context for that WHO. Engagement, completion, "feels productive" — none of those are this rubric. Memory consolidation and transfer are.

If a tool engages well but doesn't consolidate memory, it's *engagement theater*. Removing it reduces the ADHD-fit cost of menu clutter without measurable learning loss.

## Four modes

| Invocation | What it does |
|---|---|
| `/eval-learning-tool <tool-id>` | Score one tool. Writes its audit detail + upserts its row in TRIAGE.md. Read-only on the app. |
| `/eval-learning-tool --all` | Batch over the registry. **First snapshots the prior TRIAGE.md + audits/ to `docs/tool-evaluations/archives/<YYYY-MM-DD-HHMMSS>/`** so the baseline survives the overwrite. Then writes all per-tool audits + the master TRIAGE.md. Read-only on the app. |
| `/eval-learning-tool --execute-improve <tool-id>` | Reads the tool's audit, executes the salvage path edits, runs validator + probes, commits, marks TRIAGE row `actioned-YYYY-MM-DD`. |
| `/eval-learning-tool --execute-remove <tool-id>` | Reads the tool's audit, deletes the named files/entries + migrates state, runs validator, commits, marks TRIAGE row `actioned-YYYY-MM-DD`. |

Scoring and execution are **separate calls**. Scoring is read-only analysis; execution is the implementation pass. You scan TRIAGE.md to decide which executions to invoke.

Do NOT invoke for code that isn't a user-facing learning tool (validator scripts, render plumbing, sync code — wrong instrument).

## Input

Either:
- One `tool-id` from `docs/tool-evaluations/tools.md`, OR
- `--all` for batch scoring.

If a tool is missing from the registry, add a row first per the "How to add a tool" section.

## The 7 dimensions

Each dimension is anchored in a peer-reviewed learning-science principle. A score of 0 means the principle is *actively violated*; 3 means *fully engaged*. Total /21.

### 1. Active recall (0–3) — Roediger & Karpicke 2006

> Retrieval practice produces ~50% stronger long-term retention than re-reading. The act of retrieving IS the learning event.

| Score | Behavior |
|---|---|
| 3 | Tool REQUIRES retrieval before any answer is shown. User must produce or pick before reveal. |
| 2 | Retrieval is the default but answer can be revealed with one tap. |
| 1 | Some retrieval moments but mostly reading/recognition. |
| 0 | Pure re-reading or passive viewing. No forced retrieval moment. |

### 2. Encoding strength (0–3) — Bjork's "desirable difficulty"

> Stronger encoding requires more cognitive effort at retrieval. Production > Cued recall > Recognition > Familiarity.

| Score | Encoding mode |
|---|---|
| 3 | Free production from a problem cue (e.g., type the canonical from scratch given only the prompt). |
| 2 | Cued recall — typed fill-in with sentence/code context. |
| 1 | Recognition with multiple choice (pick from N options). |
| 0 | Familiarity-only (view a list, no choice made). |

### 3. Spacing (0–3) — Cepeda et al. 2008 spacing-effect meta-analysis

> Distributed practice produces 2–3× stronger retention than massed practice at the same total time.

| Score | Behavior |
|---|---|
| 3 | Tool integrates with the SR scheduler. Failed items resurface at expanding intervals. |
| 2 | Tool tracks per-item performance and re-weights selection, but no interval logic. |
| 1 | Tool tracks history but doesn't use it to schedule. |
| 0 | Random or block-fixed sampling. No spacing logic. |

### 4. Interleaving (0–3) — Rohrer & Taylor 2007

> Mixed-topic practice produces stronger transfer than blocked practice, even though it FEELS harder during practice.

| Score | Behavior |
|---|---|
| 3 | Cards/prompts span multiple lessons, sections, or concepts within one session. |
| 2 | Mixes some topics but skews to one. |
| 1 | Single-lesson focus with occasional cross-references. |
| 0 | Blocked: all cards from one concept/lesson at a time. |

### 5. Feedback quality (0–3) — Hattie & Timperley 2007

> Corrective feedback that explains the WHY of an error produces ~2× stronger correction than right/wrong feedback alone.

| Score | Behavior |
|---|---|
| 3 | On a miss: per-item explanation of why the correct answer is correct AND why the user's pick was wrong. |
| 2 | On a miss: correct answer + one-line explanation. |
| 1 | On a miss: correct answer shown, no explanation. |
| 0 | Right/wrong only. No corrective signal. |

### 6. Transfer-context match (0–3) — Tulving & Thomson encoding specificity

> Retrieval is strongest when the practice context matches the eventual retrieval context.

The eventual retrieval context for this user (per PROFILE.md) is: **a coding interview problem statement, no notes, time pressure, a blank editor**. Practice that uses interview-shaped cues transfers better than practice that uses textbook-shaped cues.

| Score | Behavior |
|---|---|
| 3 | Cue is interview-shaped: problem statement + blank editor + (optional) timer. Retrieval is from problem-state. |
| 2 | Cue includes problem context + scaffold (partial code, hints). |
| 1 | Cue is sentence-shaped (cloze fill, vocabulary recall). |
| 0 | Cue is unrelated to the retrieval context (recognize an emoji, sort a word list, etc.). |

### 7. Closed-loop signal use (0–3)

> Does the tool's outcome FEED BACK INTO the user's diagnostic-aware autopilot loop (`state.weakness`, SR `state.reviews`, miss tags, mechanics-coverage matrix)?

| Score | Behavior |
|---|---|
| 3 | Wins AND misses update SR + weakness + mechanic-coverage signals; future autopilot picks bias toward the gap exposed. |
| 2 | Misses update weakness/SR but wins are not strengthened. |
| 1 | Outcome persisted locally but doesn't feed the broader autopilot. |
| 0 | Outcome is ephemeral (session-only counter, no persistence). |

## Output artifacts (all durable, in `docs/tool-evaluations/`)

### `TRIAGE.md` — the master decision document

Updated after every score (single or batch). The human-facing decision surface.

```markdown
# Learning-tools triage

Last full audit: <YYYY-MM-DD>
Tools scored: N / total in registry

## Triage

| Tool | Score | Verdict | Salvage/Removal one-liner | Action status | Audit |
|---|---|---|---|---|---|
| Notes Drill | 11/21 | IMPROVE | Add per-item explanation on miss; score blank-word + distractor quality | not-actioned | [→](audits/notes-drill.md) |
| L3 Drill | 19/21 | KEEP | Ship-quality | n/a | [→](audits/l3.md) |
| Reverse | 7/21 | REMOVE | Engagement theater; cut and reclaim menu slot | not-actioned | [→](audits/reverse.md) |

## Summary

- **KEEP (≥18):** N tools — ship-quality, no action needed.
- **IMPROVE (10–17):** N tools — salvage paths queued.
- **REMOVE (<10):** N tools — removal paths queued.

## Action sequence (ordered by leverage)

1. Highest-leverage IMPROVE first (largest expected score lift per edit).
2. REMOVEs second (low risk, immediate decision-decluttering win).
3. Re-score IMPROVE tools after their salvage paths execute.
```

**Action status values:**
- `not-actioned` — verdict reached, no action taken yet
- `in-progress` — currently being acted on (set when `--execute-*` begins)
- `actioned-YYYY-MM-DD` — salvage or removal path executed and committed
- `declined-by-user` — user reviewed and explicitly chose NOT to act
- `n/a` — verdict was KEEP, no action needed

### `audits/<tool-id>.md` — per-tool detail

One file per tool. The full 7-dim score with file:line evidence + the specific salvage path (file:line edits) OR removal path (delete steps + state migration).

```markdown
# <tool-name> — Learning-effectiveness audit

**Total: N/21**
**Verdict: KEEP / IMPROVE / REMOVE**
**Anchor file:** <primary-file:line>
**Scored:** <YYYY-MM-DD>

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | X/3 | … |
| Encoding strength | X/3 | … |
| Spacing | X/3 | … |
| Interleaving | X/3 | … |
| Feedback quality | X/3 | … |
| Transfer-context match | X/3 | … |
| Closed-loop signal use | X/3 | … |

## Strengths
- 1–3 bullets, cited.

## Weaknesses
- 1–3 bullets, cited.

## Salvage path (if IMPROVE)
Ordered by leverage. Each edit names file:line and the rubric dim it lifts. Each edit must move ≥1 dim by ≥1 point or be removed from the path.

1. **[Edit 1]** — `<file:line>` — lifts <dim> by +<n>
2. **[Edit 2]** — `<file:line>` — lifts <dim> by +<n>

**Projected after salvage:** <new-score>/21.

## Removal path (if REMOVE)
- **Files to delete:** `<paths>`
- **Lines/sections to remove:** `<file:lines>`
- **Menu/launcher entries to remove:** `<button-ids / cmd-k labels>`
- **User state to migrate or drop:** `<state.xyz keys + plan>`
- **Confirmation:** deleting this does NOT reduce a learning outcome the rubric can measure (cite the dim a duplicate tool already covers if applicable).

## Action log
- <YYYY-MM-DD> Scored at N/21 by `/eval-learning-tool`.
- <YYYY-MM-DD> Salvage path executed — commit `<hash>`. Re-score next batch.
```

### `tools.md` — the registry

Catalog of what exists to be scored. Verdicts do NOT live here — they live in TRIAGE.md.

## Verdict ladder

Different tool kinds get different ladders because they're trying to do different things. Score against the right one — don't grade a study/reference artifact as if it should be a recall surface.

### Retrieval-kind tools (/21, full 7-dim rubric)

- **≥18/21 → KEEP, ship-quality.** This tool earns its menu slot. UX refinement goes through /drill-refine.
- **14–17/21 → KEEP, salvageable.** One or two specific upgrades would bring it to ship-quality. Salvage path lists them.
- **10–13/21 → IMPROVE-or-cut.** Marginal. Salvage path must move the score ≥4 points to be worth doing; otherwise REMOVE.
- **<10/21 → REMOVE.** Engagement theater. Cutting reduces ADHD-fit cost (PROFILE.md decision overload) with no measurable learning loss.

### Reflection-kind tools (/6, only Closed-loop + Transfer-context scored)

- **5–6/6 → KEEP, ship-quality.** Signal is actionable and surfaces well.
- **3–4/6 → IMPROVE.** Composes signal but doesn't route, OR routes without composing.
- **0–2/6 → REMOVE.** Duplicates another reflection tool or surfaces no actionable signal.

### Prep-kind tools (/6, only Transfer-context + Closed-loop scored)

**The rubric's recall dimensions don't apply to prep surfaces by design.** Prep tools are study/reference/exemplar artifacts — worked examples, model interview dialogue, canonical reading, audio commentary — where the value is *contextual modeling*, not retrieval. The user reads them to internalize the *shape* of expert performance before going to the recall surface. Grading a prep tool by Active-recall / Encoding / Spacing is the rubric's blind spot — those dimensions are N/A by design, not a failure to engage them.

- **5–6/6 → KEEP, ship-quality.** Models the target context well (Transfer 2-3/3) AND routes to a sibling recall surface (Closed-loop 2-3/3).
- **3–4/6 → KEEP, with route.** Strong contextual model but doesn't route — sibling recall surface exists but isn't linked, OR routes weakly. Ship the routing edit.
- **1–2/6 → IMPROVE.** Contextual model is weak — surface doesn't actually look/feel like the target context. Salvage by reshaping the cue, OR REMOVE if the sibling recall surface already covers the modeling.
- **0/6 → REMOVE.** Neither models the context nor routes. Pure decoration.

**Routing exception:** A prep surface that links to its sibling recall drill (e.g. Conversation tab → convDrill button) earns the full Closed-loop 3/3 even though the prep tool itself writes no signal. Closed-loop is judged by "does the user's encounter with this surface FEED FORWARD to a recall act" — for prep tools, the route IS the closed loop. The sibling drill must persist counters (state.weakness, state.reviews, lifetime stats, etc.) for the credit to land.

## Workflow — score one tool (`/eval-learning-tool <tool-id>`)

1. Read the tool's primary file(s) from `docs/tool-evaluations/tools.md`.
2. Read PROFILE.md for transfer-context anchoring.
3. Score each of the 7 dimensions with cited file:line evidence.
4. Apply the verdict ladder.
5. Write `docs/tool-evaluations/audits/<tool-id>.md`.
6. Upsert (insert-or-update) the tool's row in `docs/tool-evaluations/TRIAGE.md`. Update the date headers and counts.

## Workflow — batch score (`/eval-learning-tool --all`)

1. **Snapshot the previous run BEFORE anything else.** If `docs/tool-evaluations/TRIAGE.md` already exists OR `docs/tool-evaluations/audits/` contains files:
   - Generate timestamp `TS=$(date +%Y-%m-%d-%H%M%S)` (includes HH:MM:SS so multiple runs per day don't collide).
   - `mkdir -p docs/tool-evaluations/archives/$TS/audits`
   - `cp docs/tool-evaluations/TRIAGE.md docs/tool-evaluations/archives/$TS/TRIAGE.md` (if it exists).
   - `cp docs/tool-evaluations/audits/*.md docs/tool-evaluations/archives/$TS/audits/` (if any exist).
   - Write `docs/tool-evaluations/archives/$TS/README.md` with the snapshot timestamp, current `git rev-parse --short HEAD`, and a one-line reason ("Pre-rescore baseline" by default; user can pass a custom reason via positional arg like `/eval-learning-tool --all "after Phase 4 ships"`).
   - This preserves the *before* picture so the new run's lifts can be diff'd against it. Audits keep their `## Action log` history in the live files too (upsert preserves it), but the snapshot captures the full TRIAGE state which is otherwise overwritten in place.
2. Walk every entry in `docs/tool-evaluations/tools.md`.
3. Parallelize via sub-agents (~4 tools per general-purpose agent, capped at 5 concurrent agents).
4. Each sub-agent writes its audit files independently.
5. After all sub-agents complete, write the master `docs/tool-evaluations/TRIAGE.md`:
   - One row per tool, sorted by score ascending (worst first, drives the next-moves list).
   - Summary section (counts per verdict band).
   - Action sequence (ordered by leverage).
6. After TRIAGE.md is written, append a one-line summary to the archive README at `docs/tool-evaluations/archives/$TS/README.md` noting the post-run delta if comparing to the snapshot is straightforward (e.g. tools that moved bands). Skip if it's the first-ever run with no snapshot.

### Archive layout

```
docs/tool-evaluations/
├── TRIAGE.md                  ← live, always reflects latest run
├── audits/                    ← live, upsert'd per run; Action logs accumulate
└── archives/
    ├── 2026-05-30-143052/     ← snapshot at start of one --all run
    │   ├── README.md
    │   ├── TRIAGE.md
    │   └── audits/...
    ├── 2026-05-30-175954/     ← second run same day (timestamp disambiguates)
    │   └── ...
    └── 2026-06-02-091500/
        └── ...
```

Folder-per-run keeps each rescore's full output bundled together; the timestamp is sortable and never collides even at multiple-runs-per-day cadence.

## Workflow — execute salvage (`/eval-learning-tool --execute-improve <tool-id>`)

1. Read `docs/tool-evaluations/audits/<tool-id>.md`. Verdict must be IMPROVE.
2. Set the TRIAGE row's action status to `in-progress`.
3. Read the named files and confirm the salvage path is still applicable (no drift since scoring).
4. Apply each edit in the salvage path, in order.
5. Run `node tools/validate-data.js` — must show `X passed, 0 failed`. If it fails, roll back, set status back to `not-actioned`, log in audit Action log, halt.
6. If the tool has an associated CDP probe under `tools/cdp/`, re-run it.
7. Commit atomically per CLAUDE.md commit convention:

   ```
   [product/<category>] eval-learning-tool: execute salvage path for <tool-id>

   ## Product impact
   <user-facing change, naming which rubric dim(s) moved and by how much>

   ## Engineering
   <files touched, by-edit summary>

   ## Verification
   <validator + probe output>

   ## Audit reference
   docs/tool-evaluations/audits/<tool-id>.md (projected: <old>/21 → <new>/21)
   ```

8. Push.
9. Update the tool's TRIAGE.md status to `actioned-YYYY-MM-DD`.
10. Append a line to the audit's Action log with date + commit hash.

## Workflow — execute removal (`/eval-learning-tool --execute-remove <tool-id>`)

1. Read `docs/tool-evaluations/audits/<tool-id>.md`. Verdict must be REMOVE.
2. Set the TRIAGE row's action status to `in-progress`.
3. Read the named files and confirm the removal path is still applicable (no drift).
4. Confirm any persistent user state named in the removal path can be safely dropped or migrated. If migration is needed, do it first.
5. Delete the named files/sections; remove menu/launcher entries.
6. Run `node tools/validate-data.js` — must show `X passed, 0 failed`.
7. Run the smoke test `node tools/cdp/appsplit-smoke.js` — must pass.
8. Commit atomically:

   ```
   [product/fix] eval-learning-tool: remove <tool-id> per learning-effectiveness audit

   ## Product impact
   <user-facing change: one fewer menu entry, decision-overload reduced>

   ## Engineering
   <files deleted, lines removed, state cleanup>

   ## Verification
   <validator + smoke-test output>

   ## Audit reference
   docs/tool-evaluations/audits/<tool-id>.md (scored <N>/21, removal path executed)
   ```

9. Push.
10. Remove the tool's row from `docs/tool-evaluations/tools.md` (the tool no longer exists to be scored).
11. Update the tool's TRIAGE.md status to `actioned-YYYY-MM-DD` (keep the row for history).
12. Append a line to the audit's Action log with date + commit hash.

## Acting from natural language (no flag required)

You can skip the `--execute-*` flag and ask in natural language:

> "Execute the salvage paths for all IMPROVE-verdict tools in TRIAGE.md that aren't yet actioned."
> "Remove the tools marked REMOVE per the triage."
> "Execute the highest-leverage IMPROVE."

The skill reads TRIAGE.md, filters by verdict + action status, opens each audit, executes per the salvage / removal workflow above, updates statuses, and commits per tool. One commit per tool keeps the diff reviewable.

## How to add a tool

Append a row to `docs/tool-evaluations/tools.md`:

```
| <id> | <Name> | <kind: retrieval / reflection / prep / navigation> | <surface: drill / train / reflect / practice / study> | <primary-file(s)> | <entry-point: cmd-k label / button id / tab name> |
```

**Pick the kind by what the user is asked to DO on the surface, not what the artifact contains:**

- **`retrieval`** — user must produce or pick before any reveal. Scored by the full 7-dim rubric /21. Examples: L1, L2, L3, Mock, all drill-family surfaces.
- **`reflection`** — surface composes signal sources and routes the user to action (no retrieval gate on the reflection surface itself). Scored on Closed-loop + Transfer-context only, others N/A, total /6. Examples: Stats, Mechanics, At Risk, Resurrect, Streak Map, Today's Plan.
- **`prep`** — user reads / studies / listens to a worked example or exemplar; the value is *modeling the target context*, not producing recall. Scored on Transfer-context + Closed-loop only, others N/A, total /6. **The recall dimensions are N/A by design** — grading a prep surface as if it should retrieve is the rubric's blind spot to avoid. Examples: Conversation tab (model interview dialogue), audio Listen mode (eyes-free study). A prep surface that routes to a sibling recall drill (e.g. Conversation → convDrill button) earns full Closed-loop credit even though it writes no signal of its own — the route IS the closed loop.
- **`navigation`** — Plan picker, Search, hamburger menu, etc. NOT learning tools — reject if added.

**Hybrid surfaces — pick the kind by the DEFAULT mode**, not the available modes. Reference and Walkthrough both have study (canonical reading / step-scrubbing) as their default but also ship retrieval modes (Notes→Code, 🔮 Quiz, 🪲 Bug) — they're scored as `retrieval` because (a) the retrieval modes carry the score and (b) post-Phase-3 the retrieval modes are auto-defaulted on second entry (Walkthrough) or have parity affordances (Reference). Conversation is `prep` because there's no retrieval mode in-tab — every section is one-tap-to-reveal — and the recall happens in the sibling convDrill, not here.

## Anti-patterns (skill refuses)

- ❌ Scoring without reading the implementation. Source-truth required for every dimension.
- ❌ Scoring a tool that doesn't exist yet (that's a build → /drill-improve).
- ❌ Scoring engagement as a proxy for learning. Engagement is necessary, not sufficient.
- ❌ **Scoring a `prep`-kind surface by retrieval dimensions** — the rubric's blind spot. Prep tools are study/reference/exemplar artifacts where contextual modeling IS the value; grading them as if they should retrieve produces a fake-low score and recommends scrapping things that have a legitimate role. If the surface has no retrieval gate by design and is paired with a sibling recall drill, classify it as `prep` and score on Transfer + Closed-loop only.
- ❌ Editing PROFILE.md inside this scoring run. PROFILE.md is a stable input.
- ❌ A salvage path that doesn't move ≥1 rubric dim by ≥1 point. That's a UX iter — route to /drill-refine.
- ❌ Executing `--execute-improve` or `--execute-remove` without re-confirming the audit's salvage/removal path against current source. The path may have drifted since scoring.
- ❌ Removing a tool while user state still references it. Migrate or confirm safe drop first.

## Sibling skills

- `/refine-rubric` — orthogonal: scores UX fit (Autopilot · Decisions · Phone-fit · Time-respect · Diagnostic-aware · Progress-visible · ADHD-fit). A tool can score 21/21 on UX and 5/21 here, or vice versa.
- `/drill-refine` — refines an existing tool's UX. Use AFTER `/eval-learning-tool` decides KEEP-or-IMPROVE if the lift is UX-only.
- `/drill-improve` — ships new learning tools. Use to fill a learning-science gap this rubric reveals.
- `/lesson-audit` — orthogonal: scores L1/L2 content quality WITHIN a lesson (per-lesson distractors, etc.), not the meta-tools that USE that content.

## When to update this rubric

- A new learning-science finding lands that contradicts a dimension's threshold → update with citation.
- PROFILE.md changes the retrieval context (e.g., target shifts from coding-interview to system-design) → update dimension 6 (Transfer-context match) verbatim.
- A dimension hasn't moved across 10+ audits → either it's well-served (consider raising the bar) or asking the wrong question (consider replacing). Log the call in TRIAGE.md.
