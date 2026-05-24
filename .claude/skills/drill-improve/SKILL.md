---
name: drill-improve
description: Run one iteration of the self-improvement loop for the JS drill app. First selects an iteration *mode* (ship | audit | coverage | frame | research | vision) — the loop is structured to surface new feature ideas via vision mode + a mandatory adversarial subagent in ship mode, not just refine existing surfaces. Use with /loop for recurring runs (e.g. `/loop 15m /drill-improve`) or standalone for a single iteration.
---

# drill-improve

You are running one iteration of the self-improvement loop for the JS drill app.

The loop runs in one of **six modes**. The 6th mode (`vision`) + a mandatory
adversarial subagent in ship mode were added iter 24 in response to iter 23's
meta-review finding: across 22 prior iterations the loop had produced **zero
new feature surfaces** — every "big feature" predated iter 1 or was human-
shipped in parallel. The architecture was structurally biased toward additive
UX work. The fix is to (a) periodically generate a menu of ambitious features
via vision mode, and (b) confront every ship target with an adversary that
proposes what the loop would never reach on its own.

Each iteration also produces a handoff that nominates the *mode* of the next
iteration, not just sharpens the focus within the current one.

## Step 1 — Select a mode (do this FIRST, before reading code or content)

Read ONLY these to make the decision:
- `SELF-IMPROVE.md` §§ Next iteration, Mode ledger, Current focus
- The last 10 entries in `SELF-IMPROVE.md` § Iteration log — titles only
- `iter-artifacts/roadmap.md` (if it exists) — top unconsumed entries

Do NOT load `PROFILE.md`, `docs/`, or the codebase yet. That priming biases you
toward the existing surface.

The six modes:

| Mode | When to pick it |
|---|---|
| **vision** | The loop needs a menu of big features to ship from. Produces ranked entries in `iter-artifacts/roadmap.md`. Signal: 5+ iters since last vision iter, OR `roadmap.md` has no unconsumed entries, OR a frame iter just finished and ship targets feel uninspired. |
| **ship** | A scoped, atomically-commitable improvement is queued, OR a roadmap entry is ready to consume across 1–3 iters. Signal: § Next iteration nominates `ship`, OR user reported friction, OR a non-ship iter produced an artifact ready to consume, OR `roadmap.md` has an unconsumed top entry. |
| **audit** | A feature surface, code path, or data invariant hasn't been reviewed in 5+ iterations. Signal: iteration log shows repeated work in one area (means *other* areas are drifting unobserved). |
| **coverage** | The question is **"what user need has no current surface?"** Signal: validator passes but no one has counted *missing categories of feature* (not just missing cells in existing buckets) in N iters; user surfaced a topical gap. |
| **frame** | The question is "is the question right?" — PROFILE.md assumptions, the L1→L2→L3 ladder shape, the loop's own architecture, the storage model. Signal: prior iters sharpened without resolving an underlying problem; user-reported frustration that doesn't map to any existing surface. |
| **research** | Pull an external reference and diff against the repo. Signal: a coverage/vision iter produced a gap list and we need authoritative sourcing before acting. |

**Selection procedure:**
1. If § Next iteration nominates a mode, default to it *unless* its veto condition is met.
2. If 5+ iters have passed since the last `vision` iter, the next iter MUST be `vision` (replaces the old "multiple of 10 → forced frame" rule — vision is the new periodic-reframe forcing function).
3. If resuming from PAUSED state, you MUST pick `coverage` or `audit` (never `ship`) — shipping ran dry; coming back via shipping reproduces the failure.
4. Otherwise pick the mode whose signal best matches current evidence. Justify in one sentence at the top of your end-of-iteration report.

**Hard guardrails (iter 24 restructure):**
- **Vision floor:** ≥1 of any rolling 6 iterations must be `vision`. Without this the roadmap stagnates and ship mode drifts back into gradient descent on the current surface.
- **Evidence floor:** ≥1 of any rolling 6 iterations must produce evidence (an audit finding, a probe outcome, a research summary, a coverage gap list, or a meta-review). Pure ship-only cadence loses sight of whether what's being shipped matters.
- **Frame rate limit:** ≤2 `frame` iters per rolling 10. Reframes are real but rare; over-running means you're avoiding execution.
- **Subagent budget:** max 3 fresh-eyes subagents per iteration (the mandatory adversarial subagent in ship mode counts toward this).
- **Research budget:** 15 minutes + one external source per iter (see Step 2C).
- **Artifact-to-ship deadline:** every gap report, research summary, or roadmap entry produced by a non-ship mode must be acted on (fully or partially) within 5 iterations, OR moved to Parking lot with explicit "deferred because X."

**What was REMOVED iter 24 (and why):**
- `≥3 ships per rolling 6` floor → enforced shipping things even when nothing genuinely new was queued. This was the structural cause of BS-14 (additive bias).
- `3+ consecutive ships → forced non-ship` rule → made redundant by the vision floor + adversarial subagent (you can't ship 3 in a row without the adversary having had 3 chances to redirect).
- `multiple of 10 → forced frame` rule → vision floor replaces it as the periodic-reframe trigger.

## Step 1.5 — Challenge the focus (mandatory; 60 seconds, write answers in your end-of-iteration report)

Before opening any code or content:
1. **What has the loop NOT touched in the last 10 iterations?** Scan log titles. Name three areas that haven't appeared — and at least one *category of feature* the app doesn't yet have any surface for.
2. **What does PROFILE.md assume that might no longer be true?** Pick one assumption and name evidence that would invalidate it. PROFILE.md is a hypothesis, not scripture — vision mode is the place to propose amendments.
3. **If a new contributor opened this repo today, what would they ask "why is this so small/missing/weird?" about?** Especially: what categories of feature would they expect that aren't here at all?
4. **Is the current direction the *highest-leverage* question, or just the *next* question in the current frame?**

If answers 1–3 surface something that outranks your Step-1 mode selection, switch modes and re-justify.

## Step 2 — Diagnose (mode-specific)

### Step 2A — `ship` mode + MANDATORY adversarial subagent

Load `PROFILE.md`, the relevant slice of `SELF-IMPROVE.md` (Current focus, Constraints, Avoid, Parking lot), the `docs/learning-strategies/` index, and (if consuming) the relevant `roadmap.md` entry. Then investigate the surface:
- Read targeted slices of `app.js` / `app.css` / `index.html`
- Sample lesson JSONs / read the roadmap entry being consumed
- Run `tools/cdp/<probe>.js` for UX-affecting focus areas
- Run `node tools/validate-data.js` to baseline
- Grep for the feature surface

Do not pattern-match on the focus statement. Look at the code/UX, then form a judgment.

**Then spawn ONE mandatory adversarial subagent before committing to the ship target.** This is the iter-24 addition addressing BS-14: every ship iter must have explicit adversarial pressure.

Adversarial subagent prompt:

> You are an adversarial reviewer of the drill-improve loop's current ship target. Read `PROFILE.md` and the ship target the orchestrator is about to commit to (described inline in this prompt). Make the strongest case the loop's current ship target is wrong. Cite specific PROFILE.md lines. Propose 1–2 alternative ship targets the loop would never reach via its normal gradient-descent. Do NOT read `SELF-IMPROVE.md` or this `SKILL.md`. Budget: 5 minutes; output in 30 lines max.

Integrate the adversary's findings. The commit body **MUST** either:
- **Pivot** to the adversary's proposal (write one sentence saying which one and why), OR
- **Rebut** in ≥3 sentences why the original ship target outranks the adversary's proposal.

This is friction by design. If you find yourself reflexively rebutting every time, the loop is still stuck — the next vision-mode iter should question why ship targets feel so insulated.

### Step 2B — `audit` / `coverage` / `frame` modes — fresh-eyes subagents

Do NOT diagnose yourself first. Spawn 1–3 parallel `general-purpose` subagents (budget cap: 3). Each gets `PROFILE.md` + the code/data they need, but **must NOT read `SELF-IMPROVE.md`, the iteration log, `docs-archive/`, or this `SKILL.md`** — that priming is the bias source.

Prompt scaffold:

> You are a fresh reviewer of this repo. Read ONLY: `PROFILE.md`, `README.md`, `data/manifest.json`, and N random lesson files across N random sections. Do NOT read `SELF-IMPROVE.md`, the iteration log, `docs-archive/`, or `.claude/skills/drill-improve/`. Answer for {mode-specific question}. Cite specific section/lesson counts. Output a ranked list of 5 findings, each with the evidence that surfaced it.

Mode-specific question:
- **audit:** "What in this repo is drifting, stale, under-maintained, or violating its own invariants that a regular reviewer would flag?"
- **coverage:** **"What user need exists that no current surface addresses?"** (iter-24 reframe — was previously "what's missing from the curriculum?", which biased toward "more cells in existing buckets"; the new framing surfaces "new buckets entirely.")
- **frame:** "What assumption baked into the codebase or content might no longer fit the user described in PROFILE.md? What evidence would invalidate it? What would a fundamentally different version of this app look like?"

Integrate findings. If subagents disagree, that disagreement is itself the finding worth investigating.

### Step 2C — `coverage` / `research` modes — external rubric check

Use `WebSearch` / `WebFetch` to pull ONE external reference relevant to the gap. Extract the *list/structure* (not opinions). Diff against `data/manifest.json` or the relevant artifact.

**Constraints:**
- Research informs *what* to add, not *how* to teach — pedagogy stays grounded in `docs/learning-strategies/`.
- Cap at 15 minutes + one external source per iteration.
- Log the source in `SELF-IMPROVE.md § External references consulted`.

### Step 2D — `vision` mode — feature roadmap generation

The point of vision mode is to break the loop out of gradient descent within the current surface. Do NOT extend an existing feature. Do NOT add lessons. Produce a *menu of hypothetical big features* the loop would never reach via its normal cadence.

Workflow:
1. Spawn 1–2 fresh-eyes subagents with this prompt: *"You are a product designer looking at the JS drill app for the first time. Read PROFILE.md, README.md, and `data/manifest.json` (titles only — don't read individual lessons). Do NOT read SELF-IMPROVE.md, the iteration log, or `.claude/skills/`. Propose 5 hypothetical big features the app does NOT yet have that would materially improve the rusty-engineer experience. For each: one-sentence value claim, one-sentence mechanic, one-sentence falsifiable success criterion. Rank by leverage-per-effort. Be ambitious — prefer 'new bucket' ideas over 'better cell within existing bucket' ideas."*
2. Integrate the subagent(s) output. Add the top 3 entries to `iter-artifacts/roadmap.md` under a dated section header. If `roadmap.md` doesn't exist yet, create it.
3. Mark any roadmap entry that *contradicts* a current PROFILE.md assumption — vision mode is also when PROFILE.md amendments get drafted (proposed, not enacted; enactment is a later frame iter).
4. End-of-iteration: nominate the top roadmap entry as the next ship iter's target. The "Roadmap-tagged multi-iter feature" pattern in Step 3 governs how it's consumed.

## Step 3 — Pick one change (or one artifact)

State in 2–3 sentences *before editing or writing*:
1. What you're doing (code change, artifact, roadmap entry, or PROFILE.md amendment proposal)
2. Which `PROFILE.md` need, under-exploited strategy, `SELF-IMPROVE.md § Blind spots ledger` entry, or `roadmap.md` entry it serves
3. How you'll verify it worked

Bias toward changes that strengthen mobile L1/L2 surface area (the 80%-phone user lives there) and that exploit an under-used principle from `docs/learning-strategies/`.

**Atomic-commit rule by mode:**
- **ship (default — single-iter):** must be atomically commitable; no half-features. Lesson batches of 1–6 atomic lessons count as one ship.
- **ship (roadmap-tagged — multi-iter):** a single feature from `roadmap.md` may span up to 3 iters using subtypes `[product/feature-scaffold]` (skeleton + flag-gate), `[product/feature-wire]` (state + handlers), `[product/feature-ship]` (UI + verification). Each iter must independently pass validator. The user-facing surface is flag-gated until the final ship iter completes. **This is the only exception to atomic commits.** Update the roadmap entry's status field at the end of each iter so the next one knows where to pick up.
- **audit / coverage / research:** may produce an *artifact* (file under `iter-artifacts/iter-N-<topic>.md`) instead of code. Artifacts are first-class commits.
- **vision:** produces an entry in `iter-artifacts/roadmap.md`. Optionally drafts a PROFILE.md amendment (commented out in the file with explanatory header until a frame iter ratifies it).
- **frame:** produces edits to `PROFILE.md`, `SELF-IMPROVE.md`, `docs/learning-strategies/`, or this `SKILL.md`. Code changes are out of scope.

**Avoid:**
- Anything in `SELF-IMPROVE.md § Avoid` (re-read; entries are re-audited every 5 iters).
- For `ship` mode only: sweeping refactors disguised as improvements.

## Step 4 — Implement + verify

- Edit code / write artifact / write roadmap entry.
- Run `node tools/validate-data.js` — **must show 0 failures regardless of mode**.
- If `ship` mode and UX-affecting, run the relevant CDP probe. **Mobile probe is mandatory for any UI change** (80% mobile profile means desktop-only verification is insufficient).
- Commit atomically. Follow `CLAUDE.md § Commit message convention` — subject-line tag, iter+mode marker inside the summary, and labeled body sections. Any `[product/*]` commit MUST include a `## Product impact` line. New iter-24 multi-iter subtypes: `[product/feature-scaffold]`, `[product/feature-wire]`, `[product/feature-ship]`.
- Mode-to-tag mapping: ship → `product/*` or `engineering/tooling`; audit/coverage/research/vision → `engineering/meta` (their artifacts) or no commit; frame → `engineering/meta` or `engineering/docs`.
- **Push to remote after every successful iteration commit.** Run `git push` (no force). If `git push` fails, surface the error and stop — do NOT retry with `--force` and do NOT skip the hook.

If anything fails, do not commit. Roll back, log what blocked the iteration, and stop.

## Step 5 — Strategy doc reciprocity (ship mode only)

If the change embodies a learning-science principle:
- If a doc for it exists in `docs/learning-strategies/`, update its "How the app encodes it today" section.
- If no doc exists, create one using the format in `docs/learning-strategies/README.md`.
- Feature and strategy doc ship together — same iteration, ideally same commit.

## Step 6 — Reflect + nominate next mode

Update `SELF-IMPROVE.md`:

- **Iteration log** — prepend a dated entry: **mode**, what you investigated, what you changed (or what artifact you produced), **adversary's proposal + your pivot/rebut** (ship mode only), what you learned about `PROFILE.md` fit (~5 sentences). Trim log to last 10 entries.
- **Mode ledger** — append `| iter N | mode | one-line outcome |`.
- **Last-touched index** — bump the row for any area touched.
- **Blind spots ledger** — add anything subagents or research surfaced that this iter did NOT act on.
- **Parking lot** — if any entry has been there 5+ iters without progress, an audit-mode iteration must ship-or-explain it.
- **Avoid** — append any dead-ends discovered.
- **External references** (if research mode) — log source URL + what was extracted.
- **Roadmap** (if vision mode or roadmap-tagged ship) — update `iter-artifacts/roadmap.md` entries' status.
- **Next iteration** — replace with a fresh handoff block:
  - **Suggested mode:** ship | audit | coverage | frame | research | vision
  - **Signal pointing there:** one sentence with the concrete evidence
  - **Veto condition:** "skip this mode if {X}"

Step 6's point: iteration N+1 starts from a better question *and* a better mode than iteration N.

## End-of-iteration output (~8 lines)

- **Mode** this iteration ran in (and why it was selected)
- **Challenge-the-focus** answers (4 short lines)
- **Adversary's proposal + your pivot/rebut** (ship mode only, ~3 sentences)
- **What you changed or produced** (one sentence)
- **Verification result** (validator + CDP if relevant)
- **§ Next iteration** is now set to (mode + signal)
- **Any blockers or unknowns** that need human input before the next run
