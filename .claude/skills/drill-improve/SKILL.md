---
name: drill-improve
description: Run one iteration of the self-improvement loop for the JS drill app. First selects an iteration *mode* (ship | audit | coverage | frame | research) — the loop is structured to resist auto-defaulting to "ship feature" and to periodically question its own framing via fresh-eyes subagents and external research. Use with /loop for recurring runs (e.g. `/loop 15m /drill-improve`) or standalone for a single iteration.
---

# drill-improve

You are running one iteration of the self-improvement loop for the JS drill app.

The loop runs in one of **five modes**. The default is NOT `ship`. The loop's
historical failure mode (iters 1–17) was auto-defaulting to "polish what
exists" — the mode system exists to prevent that. Each iteration also produces
a handoff that nominates the *mode* of the next iteration, not just sharpens
the focus within the current one.

## Step 1 — Select a mode (do this FIRST, before reading code or content)

Read ONLY these to make the decision:
- `SELF-IMPROVE.md` §§ Next iteration, Mode ledger, Current focus
- The last 10 entries in `SELF-IMPROVE.md` § Iteration log — titles only

Do NOT load `PROFILE.md`, `docs/`, or the codebase yet. That priming biases
you toward the existing surface.

The five modes:

| Mode | When to pick it |
|---|---|
| **ship** | A scoped, atomically-commitable improvement is queued. Signal: previous iter nominated `ship`, OR user reported a specific friction this week, OR a non-ship iteration produced an artifact (gap report, research summary) ready to consume. |
| **audit** | A feature surface, code path, or data invariant hasn't been reviewed in 5+ iterations. Signal: iteration log shows repeated work in one area (means *other* areas are drifting unobserved). |
| **coverage** | The question is "what's *missing*?" — lessons, surfaces, or principles that should exist but don't. Signal: validator passes but no one has counted lessons against an external rubric in N iters; user surfaced a topical gap. |
| **frame** | The question is "is the question right?" — PROFILE.md assumptions, the L1→L2→L3 ladder shape, the starter-path concept itself, the storage model. Signal: prior iters sharpened without resolving an underlying problem; user-reported frustration that doesn't map to any existing surface. |
| **research** | Pull an external reference (interview-prep canon, MDN topic tree, learning-science paper) and diff against the repo. Signal: a coverage iter produced a gap list and we need authoritative sourcing before acting. |

**Selection procedure:**
1. If § Next iteration nominates a mode, default to it *unless* its veto condition is met.
2. If no nomination, scan the last 10 log titles. **If 3+ consecutive `ship` iters appear, you MUST pick non-ship.**
3. If iteration count is a multiple of 10, you MUST pick `frame` (the "loop, critique thyself" forcing function).
4. If resuming from PAUSED state, you MUST pick `coverage` or `audit` (never `ship`) — shipping ran dry; coming back via shipping reproduces the failure.
5. Otherwise pick the mode whose signal best matches current evidence. Justify in one sentence at the top of your end-of-iteration report.

**Hard guardrails:**
- ≥3 of any rolling 6 iterations must be `ship`. Reflection without execution is the meta-loop's failure mode.
- ≤1 `frame` per 10 iterations. Reframes are real but rare; over-running them means you're avoiding execution.
- Subagent budget: max 3 fresh-eyes subagents per iteration.
- Research budget: 15 minutes + one external source per iter (see Step 2C).
- **Artifact-to-ship deadline:** every gap report or research summary a non-ship mode produces must be acted on (fully or partially) within 3 iterations, OR moved to Parking lot with explicit "deferred because X."

## Step 1.5 — Challenge the focus (mandatory; 60 seconds, write answers in your end-of-iteration report)

Before opening any code or content:
1. **What has the loop NOT touched in the last 10 iterations?** Scan log titles. Name three areas that haven't appeared.
2. **What does PROFILE.md assume that might no longer be true?** Pick one assumption and name evidence that would invalidate it.
3. **If a new contributor opened this repo today, what would they ask "why is this so small/missing/weird?" about?** (Curriculum coverage, missing topics, sparse sections, empty surfaces.)
4. **Is the current direction the *highest-leverage* question, or just the *next* question in the current frame?**

If answers 1–3 surface something that outranks your Step-1 mode selection, switch modes and re-justify.

## Step 2 — Diagnose (mode-specific)

### Step 2A — `ship` mode
Load `PROFILE.md`, the relevant slice of `SELF-IMPROVE.md` (Current focus, Constraints, Avoid, Parking lot), and the `docs/learning-strategies/` index. Then investigate the surface area:
- Read targeted slices of `app.js` / `app.css` / `index.html`
- Sample lesson JSONs
- Run `tools/cdp/<probe>.js` for UX-affecting focus areas
- Run `node tools/validate-data.js` to baseline
- Grep for the feature surface

Do not pattern-match on the focus statement. Look at the code/UX, then form a judgment.

### Step 2B — `audit` / `coverage` / `frame` modes — fresh-eyes subagents

Do NOT diagnose yourself first. Spawn 1–3 parallel `general-purpose` subagents (budget cap: 3). Each gets `PROFILE.md` + the code/data they need, but **must NOT read `SELF-IMPROVE.md`, the iteration log, `docs-archive/`, or this `SKILL.md`** — that priming is the bias source.

Prompt scaffold:

> You are a fresh reviewer of this repo. Read ONLY: `PROFILE.md`, `README.md`, `data/manifest.json`, and N random lesson files across N random sections. Do NOT read `SELF-IMPROVE.md`, the iteration log, `docs-archive/`, or `.claude/skills/drill-improve/`. Answer for {mode-specific question}. Cite specific section/lesson counts. Output a ranked list of 5 findings, each with the evidence that surfaced it.

Mode-specific question:
- **audit:** "What in this repo is drifting, stale, under-maintained, or violating its own invariants that a regular reviewer would flag?"
- **coverage:** "What's missing from the curriculum for the user described in PROFILE.md? What would you expect to find that you don't?"
- **frame:** "What assumption baked into the codebase or content might no longer fit the user described in PROFILE.md? What evidence would invalidate it?"

Integrate findings. If subagents disagree, that disagreement is itself the finding worth investigating.

### Step 2C — `coverage` / `research` modes — external rubric check

Use `WebSearch` / `WebFetch` to pull ONE external reference relevant to the gap: e.g., NeetCode 150 categories, Blind 75 distribution, MDN's JS modules topic tree, top-N most-asked JS interview questions of the current year, a learning-science paper. Extract the *list/structure* (not opinions). Diff against `data/manifest.json` or the relevant artifact.

**Constraints:**
- Research informs *what* to add, not *how* to teach — pedagogy stays grounded in `docs/learning-strategies/`.
- Cap at 15 minutes + one external source per iteration.
- Log the source in `SELF-IMPROVE.md § External references consulted` so the loop doesn't re-pull it.

## Step 3 — Pick one change (or one artifact)

State in 2–3 sentences *before editing or writing*:
1. What you're doing (code change, OR artifact like a gap report or curriculum proposal)
2. Which `PROFILE.md` need, under-exploited strategy, or `SELF-IMPROVE.md § Blind spots ledger` entry it serves
3. How you'll verify it worked

Bias toward changes that strengthen mobile L1/L2 surface area (the 80%-phone user lives there) and that exploit an under-used principle from `docs/learning-strategies/`.

**Atomic-commit rule by mode:**
- **ship:** must be atomically commitable; no half-features. Lesson batches of 1–6 atomic lessons count as one ship.
- **audit / coverage / research:** may produce an *artifact* (file under `iter-artifacts/iter-N-<topic>.md`) instead of code — gap report, curriculum proposal, research summary. Artifacts are first-class commits; the next `ship` iter consumes them.
- **frame:** produces edits to `PROFILE.md`, `SELF-IMPROVE.md` (Current focus, Blind spots ledger, etc.), `docs/learning-strategies/`, or this `SKILL.md`. Code changes are out of scope.

**Avoid:**
- Anything in `SELF-IMPROVE.md § Avoid` (re-read; entries are re-audited every 5 iters).
- For `ship` mode only: sweeping refactors disguised as improvements.

## Step 4 — Implement + verify

- Edit code / write artifact.
- Run `node tools/validate-data.js` — **must show 0 failures regardless of mode**. Audit reports against a broken validator are worse than useless.
- If `ship` mode and UX-affecting, run the relevant CDP probe. **Mobile probe is mandatory for any UI change** (80% mobile profile means desktop-only verification is insufficient).
- Commit atomically. Message must name the **mode**, the **change**, and the **principle** (or external reference).
- **Push to remote after every successful iteration commit.** Run `git push` (no force) immediately after the commit lands. This deploys to GitHub Pages (~30–90s to refresh) so the user can validate between iterations. If `git push` fails (auth, conflict, hook rejection), surface the error and stop — do NOT retry with `--force` and do NOT skip the hook.

If anything fails, do not commit. Roll back, log what blocked the iteration, and stop — the loop continues to the next interval with a clean tree.

## Step 5 — Strategy doc reciprocity (ship mode only)

If the change embodies a learning-science principle:
- If a doc for it exists in `docs/learning-strategies/`, update its "How the app encodes it today" section.
- If no doc exists, create one using the format in `docs/learning-strategies/README.md`.
- Feature and strategy doc ship together — same iteration, ideally same commit.

## Step 6 — Reflect + nominate next mode

Update `SELF-IMPROVE.md`:

- **Iteration log** — prepend a dated entry: **mode**, what you investigated, what you changed (or what artifact you produced), what you learned about `PROFILE.md` fit (~4 sentences). Trim log to last 10 entries.
- **Mode ledger** — append `| iter N | mode | one-line outcome |`.
- **Last-touched index** — bump the row for any area touched (`area | iter`).
- **Blind spots ledger** — add anything subagents or research surfaced that this iter did NOT act on. Note which iteration it should be promoted to Current focus by.
- **Parking lot** — if any entry has been there 5+ iters without progress, an audit-mode iteration must ship-or-explain it. Date-stamp curation.
- **Avoid** — append any dead-ends discovered (with why).
- **External references** (if research mode) — log source URL + what was extracted.
- **Next iteration** — replace with a fresh handoff block:
  - **Suggested mode:** ship | audit | coverage | frame | research
  - **Signal pointing there:** one sentence with the concrete evidence
  - **Veto condition:** "skip this mode if {X}"

Step 6's point: iteration N+1 starts from a better question *and* a better mode than iteration N. If the directive isn't reframing periodically, the loop isn't learning — it's just polishing.

## End-of-iteration output (~7 lines)

- **Mode** this iteration ran in (and why it was selected)
- **Challenge-the-focus** answers (4 short lines, one per question; OK if they fit on one line each)
- **What you changed or produced** (one sentence)
- **Verification result** (validator + CDP if relevant)
- **§ Next iteration** is now set to (mode + signal)
- **Any blockers or unknowns** that need human input before the next run
