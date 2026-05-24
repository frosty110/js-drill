---
name: lesson-audit
description: Score every lesson's L1 (concept MC) and L2 (fill-in) quality against a load-bearing rubric. Produces a per-lesson report with delta vs prior audit, bottom-quartile flagged, ranked rewrite candidates. Plan-first-then-check-priors discipline; one parallel subagent per section group. Established iter 25 to make iter-23's one-off audit reproducible. Invoke via /lesson-audit with optional flags.
---

# lesson-audit

You are running a content-quality audit of the JS drill app's lessons. The audit
produces a report at `iter-artifacts/lesson-audit-YYYY-MM-DD.md` and updates the
state file at `iter-artifacts/.lesson-audit-state.json` for delta computation
on future runs.

**The audit produces an artifact, not changes.** A committed next-iter plan to
act on the findings is the difference between this skill being useful (closes
BS-08 over time) and being noise (measurement without consequence — see
adversary's iter-25 finding). After writing the artifact, you MUST nominate
in SELF-IMPROVE.md § Next iteration what consumes the audit output and by
when (artifact-to-ship deadline: 5 iters per drill-improve SKILL.md).

## Flags (parsed from skill args)

- `--scope=<all|syntax|patterns|applied|<section-slug>>` — default `all` (149 lessons)
- `--changed-only` — score only lessons modified since last audit + previously bottom-quartile lessons
- `--rubric=<l1l2|distractor-plausibility|l3-quality>` — default `l1l2`; alternate rubrics are pluggable in §§ Rubric library
- `--max-agents=<N>` — default `10` (capped at 12 to keep coordination overhead manageable)
- `--dry-run` — print the audit plan + scope but don't spawn subagents or write the artifact

## Step 1 — Plan the audit (do this FIRST, BEFORE loading prior outputs)

This step is intentionally pre-prior. The orchestrator forms its own opinion
about what to audit before being anchored by what prior runs concluded. Write
the plan in your end-of-skill report.

Decide:
1. **Scope** — from `--scope` flag; default `all`. Resolve to a list of lesson IDs by reading `data/manifest.json` (only the manifest, not individual lesson JSONs yet).
2. **Rubric** — from `--rubric` flag; default `l1l2`. Load the rubric text from §§ Rubric library below.
3. **Section grouping for parallelism** — algorithmic, aiming for `--max-agents` total subagents:
   - One subagent per section if the section has ≥8 lessons
   - Group adjacent small sections (≤7 lessons) until grouped count is 8–15 lessons
   - Split sections >20 lessons across multiple subagents (rare: only Applied Problems at 20)
4. **Output paths** — `iter-artifacts/lesson-audit-{YYYY-MM-DD}.md` (timestamped) and update `iter-artifacts/.lesson-audit-state.json` (persistent).

Do NOT read `iter-artifacts/lesson-audit-*.md` files yet. Do NOT read `SELF-IMPROVE.md`. Do NOT read individual lesson JSONs yet (that's the subagent's job).

## Step 2 — Review prior outputs (NOW load priors, AFTER you've formed your plan)

Load:
- The most recent `iter-artifacts/lesson-audit-*.md` (sort by filename date desc, take first)
- `iter-artifacts/.lesson-audit-state.json` (if it exists)
- `git log --oneline data/` since the last audit date (to detect lessons modified since)

Refine the plan:
- **Scope reconciliation:** does your planned scope cover anything not previously audited? Or skip anything that's been recently audited?
- **`--changed-only` semantics:** if the flag is set, narrow the scope to lessons either (a) modified since last audit per git log, OR (b) flagged bottom-quartile in the most recent prior audit (verify rewrite landed).
- **Delta intent:** the subagents will compute delta vs prior scores; pass each subagent the prior scores for *their assigned lessons* in their prompt so the delta column populates.

Write the refined plan to your end-of-skill report alongside the original (pre-prior) plan, so the user can see how much your judgment shifted.

## Step 3 — Spawn N parallel subagents

Spawn `general-purpose` agents in parallel, one per section group. Each gets:
- The rubric text from §§ Rubric library (verbatim)
- The list of lesson JSON paths it owns
- The prior scores for those lessons (from `iter-artifacts/.lesson-audit-state.json`, if any)
- Fresh-eyes constraint: must NOT read `SELF-IMPROVE.md`, the iteration log, `docs-archive/`, `.claude/skills/lesson-audit/`, or any other `iter-artifacts/lesson-audit-*.md` (avoid prompt-leak + cross-contamination from sibling subagents' priors).

Subagent prompt template:

> You are a fresh-eyes pedagogical reviewer scoring N JS-drill-app lesson JSON files against a rubric. Output a structured markdown report.
>
> **Read in this order:**
> 1. `/Users/blaisealbuquerque/Projects/coding-practice-app/PROFILE.md` — the target user (rusty experienced engineer, ~80% phone study). L1 should test load-bearing recall and gotchas, not "what does a variable do." L2 should isolate the canonical idiom's load-bearing tokens, not trivial identifiers.
> 2. The N lesson JSONs assigned to you (paths listed below).
>
> **DO NOT read:** `SELF-IMPROVE.md`, the iteration log, `docs-archive/`, `.claude/skills/lesson-audit/`, or other `iter-artifacts/lesson-audit-*.md` files. Your scoring must be uncontaminated.
>
> **Rubric (embed verbatim from §§ Rubric library — orchestrator pastes here)**
>
> **Lessons assigned to you (paths + prior scores if any):**
> {orchestrator pastes the per-lesson path + prior L1/L2 mean if known}
>
> **Output format per lesson:**
> ```
> ### <slug>/<id> — "<title>" (<L1count> L1, <L2count> L2)
> **L1 scores:** [3, 2, 1, 3] → mean 2.25
> - Q1 "<terse paraphrase>": 3 — <why>
> - Q2 ...
> **L2 scores:** [3, 2] → mean 2.50
> - Ex1 "<paraphrase>": 3 — <why>
> - Ex2 ...
> **Lesson mean: 2.38**
> **Delta vs prior:** [+0.13 from 2.25 | unchanged | -0.50 from 2.88 — investigate | newly scored]
> **[BOTTOM-QUARTILE FLAG]** if mean < 1.80
> **Notable rewrite candidates:** <one line per item, or "none — solid lesson">
> ```
>
> After all lessons, write a section-level aggregate:
> - Section name
> - Mean L1 across questions
> - Mean L2 across exercises
> - Bottom-quartile lessons (list slugs)
> - 2-3 themes you noticed for THIS section
> - Top 2 rewrite candidates from THIS section
>
> Be concise — ~10-15 lines per lesson, ~15 lines for aggregate. Don't grade-inflate. The point is to find lessons that aren't teaching, not to celebrate the syllabus.

## Step 4 — Synthesize the report

Concatenate the per-subagent outputs into `iter-artifacts/lesson-audit-YYYY-MM-DD.md` with:

1. **Header** — date, scope, rubric used, agents spawned, prior-audit reference (if any)
2. **Combined ranking** — all lessons sorted by `Lesson mean` ascending. Columns: lesson, L1 mean, L2 mean, lesson mean, delta vs prior, flag.
3. **Per-section sections** — the subagent outputs verbatim, grouped by section.
4. **Cross-cutting themes** — orchestrator-written, 4-7 bullets distilling the per-section themes. What's the dominant failure mode? What's the strongest cluster? What's regressed?
5. **Highest-leverage rewrites (combined)** — orchestrator-written, top 5-10 across all sections, ranked. Each gets: lesson, primary issue, rewrite direction.
6. **Delta summary** — count of lessons {improved | regressed | unchanged | newly-scored} since last audit.
7. **Next-iter plan** — explicit nomination of what consumes the audit output and by when. **Mandatory** — adversarial-subagent finding from iter 25 stands: do not ship a measurement-only artifact without a committed plan.

## Step 5 — Update state file

`iter-artifacts/.lesson-audit-state.json`:

```json
{
  "lastAuditDate": "YYYY-MM-DD",
  "lastAuditArtifact": "iter-artifacts/lesson-audit-YYYY-MM-DD.md",
  "rubricUsed": "l1l2",
  "lessons": {
    "<lesson-id>": {
      "lastScored": "YYYY-MM-DD",
      "L1mean": <float>,
      "L2mean": <float>,
      "lessonMean": <float>,
      "bottomQuartile": <bool>,
      "lastModified": "YYYY-MM-DD",
      "scoreHistory": [{"date": "YYYY-MM-DD", "L1": <float>, "L2": <float>}, ...]
    }
  }
}
```

Preserve `scoreHistory` from prior runs; append new entries. Don't truncate (history is small — 2 floats per audit per lesson).

## Step 6 — Optionally update SELF-IMPROVE.md

If invoked outside the drill-improve loop (standalone `/lesson-audit`), this step is optional. If invoked from a drill-improve audit-mode iteration, the orchestrator running drill-improve handles SELF-IMPROVE.md updates.

When updating:
- BS-08: append the latest run's bottom-quartile count + artifact link
- § Next iteration: reflect the explicit "what consumes this artifact" plan from Step 4 item 7

## End-of-skill output (~10 lines)

- **Scope** — what was audited (lessons count, sections)
- **Agents spawned** — N agents and their groupings
- **Plan delta** — did the prior-output review change your plan? In what way?
- **Aggregate scores** — L1 mean, L2 mean, lesson mean across the run
- **Bottom-quartile flagged** — count + list
- **Delta vs prior audit** — {improved, regressed, unchanged, newly-scored} counts
- **Highest-leverage rewrite** — the #1 candidate from the combined ranking
- **Next-iter plan** — what consumes this artifact and by when (artifact-to-ship deadline)

---

## §§ Rubric library

### Rubric `l1l2` (default — validated iter 23)

For each lesson, score every L1 question and every L2 exercise on a 1-3 scale.

**L1 question score (1-3):**
- **3 (strong)** — Tests load-bearing concept, common gotcha, or "you'd hit this bug in interviews" point. ALL FOUR distractors plausibly wrong (no throwaway absurd option). CANNOT be passed by Reference skim alone — requires actually understanding the semantics.
- **2 (mid)** — Tests something real but either (a) one distractor obviously absurd, OR (b) borderline passable by Reference pattern-match.
- **1 (weak)** — Either (a) rephrases a Reference sentence directly, OR (b) has weak/duplicate distractors, OR (c) tests trivia rather than the lesson's load-bearing concept, OR (d) explain text gives away the answer pattern.

**L2 exercise score (1-3):**
- **3 (strong)** — Blanks isolate LOAD-BEARING tokens of the canonical idiom. Template exercises the canonical SHAPE, not arbitrary code that happens to use it. Hint provides direction without giving the literal answer.
- **2 (mid)** — Blanks meaningful but either (a) hint too direct, (b) template trivial/short, OR (c) tests variable names not load-bearing tokens.
- **1 (weak)** — Either (a) blank is a trivial identifier, (b) hint is literal hand-off, (c) tests typing not memory, OR (d) duplicates another L2 exercise.

**Lesson aggregate:**
- L1 mean = avg of L1 question scores (decimal, 1.0-3.0)
- L2 mean = avg of L2 exercise scores
- Lesson mean = (L1 mean + L2 mean) / 2
- **Bottom-quartile flag** if Lesson mean < 1.80

### Rubric `distractor-plausibility` (placeholder — author when needed)

Focused pass scoring only L1 distractor quality. Detects "throwaway distractor" anti-pattern. Not yet authored.

### Rubric `l3-quality` (placeholder — author when needed)

Score L3 challenge quality: canonical idiomaticity, prompt clarity, hint usefulness, expected-output edge cases. Not yet authored.

---

## Notes

- This skill is `[engineering/tooling]` when invoked as part of a drill-improve iteration. The audit artifact is `[engineering/meta]`.
- Successive runs build on the state file. **Do not delete `iter-artifacts/.lesson-audit-state.json`** — it's the delta-computation source of truth.
- If a lesson exists in the state file but is no longer in the manifest, mark it as `removed` in state (don't delete) so historical scores remain queryable.
- The plan-first-then-priors discipline is non-negotiable. If you find yourself reading `iter-artifacts/lesson-audit-*.md` before completing Step 1, restart.
