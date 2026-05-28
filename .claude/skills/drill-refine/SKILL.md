---
name: drill-refine
description: Run one iteration of the REFINEMENT loop for the JS drill app. Per iter — pick the STALEST existing surface (objective signal — least-recently-touched in git), capture EMPIRICAL evidence via /browser-test screenshots at mobile + desktop, do a FIRST-PRINCIPLES vision pass ("if this were the best it could be for the user in PROFILE.md, what would it look like?"), score against the rubric (via /refine-rubric), propose ONE concrete refinement toward the vision, spawn a contrarian sub-agent that ONLY blocks if the change would HURT the target user, then ship (validate + after-screenshot + atomic commit + push) if green-lit. Use with /loop for recurring runs — e.g. `/loop 30m /drill-refine`. Sibling to /drill-improve (which ships NEW features) — this loop only POLISHES existing surfaces.
---

# drill-refine

You are running one iteration of the **refinement loop**. The job is to make ONE existing surface of the JS drill app *demonstrably better for the user in [`PROFILE.md`](../../PROFILE.md)*, this iter.

## Prior art — re-read these before iterating

- [`/drill-improve`](../drill-improve/SKILL.md) — sibling loop. **Its Step 0 immune system applies here too.** The lessons from BS-14 (iter 1–23 UX-only drift), iter 24–34 process-rule accretion, the pivot-rate signal, and the "don't add process to fix process-induced slowness" rule are not re-litigated below; read them there. This skill INHERITS that immune system, just specialized for refinement.
- [`/browser-test`](../browser-test/SKILL.md) — the Chrome-debugger discipline. Step 2 of this skill calls it. **Don't reinvent CDP plumbing.** `tools/cdp/lib.js` handles the WS connect + screenshot + DOM eval — your scenario script stays short and intent-revealing (arrange → act → assert + snap).
- [`/refine-rubric`](../refine-rubric/SKILL.md) — the metric. Documented as its own agentic command so it's invokable standalone and impossible to drift from PROFILE.md silently. Step 3 invokes it.
- [`PROFILE.md`](../../PROFILE.md) — the law. Re-read at the start of every iter. The rubric and the vision step are both grounded here; if PROFILE.md changed since the last iter, the rubric must be updated *before* this iter's score is meaningful.

## What this loop is NOT

- **Not a feature loop.** New features (lessons, modes, mechanics) → `/drill-improve`. If your Step 2.5 vision implies a surface that doesn't exist yet, file the vision in `iter-artifacts/refine-backlog.md` and re-pick a surface that does.
- **Not a refactor loop.** No-behavior-change cleanups → `[engineering/refactor]` commit, not here.
- **Not a bug-fix loop.** Bugs that block a feature → `[product/fix]` directly. This loop targets *working* surfaces that are *suboptimal*.

## Per-iteration algorithm

### Step 0 — Loop health (15 sec) — CARRIED FROM `/drill-improve`

Scan the last 6 rows in `iter-artifacts/refine-ledger.md`. Fire one of these only if the signal matches:

| Signal | Response |
|---|---|
| ≥4 of last 6 BLOCKED by contrarian | Contrarian over-tuned. This iter: loosen the contrarian (only block on REMOVED affordances + INCREASED decisions, not "could be better"). Log in the artifact. |
| ≥3 in a row touched the same surface | Refinement-debt clustering. Force a different surface this iter — pick the next-stalest. |
| ≥4 in last 6 produced no commit (all halted/bailed) | The loop is shipping process, not product. This iter: cheapest viable refinement on the stalest surface, skip the vision step (Step 2.5), ship. |
| User said "this is too much process" / "just ship" anywhere | Drop ceremony this iter. Single-step: pick stalest, propose smallest visible improvement, ship. Re-engage full ceremony next iter only if user signal hasn't recurred. |
| None of the above | Proceed normally. |

This step exists because the loop will eventually try to evolve into process; the immune response is run-it-every-iter cheap, miss-it-once expensive (per drill-improve's iter 24–34 history).

### Step 1 — Pick a surface (60 sec, OBJECTIVE signal)

Picker priority — stop at the first match:

1. **User-named** — the user's most recent message named a surface ("the tabs feel broken", "today plan is overwhelming"). That's the target.
2. **Diagnostic-aligned** — recent diagnostic results (in this conversation or `data/diagnostic-results-*.json`) flagged a gap a surface SHOULD address but doesn't. Example: complexity-pricing weak → Reflect's Mechanics view should surface complexity tricks but doesn't → audit Mechanics this iter.
3. **Git-staleness (default)** — for each entry in `iter-artifacts/refine-surfaces.md`, run:
   ```bash
   git log -1 --format=%ci -- <primary-file>
   ```
   Pick the surface whose **latest touch is oldest**. Tie-break on **fewest commits in last 90 days** (`git log --since=90.days.ago --oneline -- <file> | wc -l`).

The "oldest code is the last touched" intuition is real: surfaces nobody has revisited recently are also the ones nobody has scrutinized for user fit recently. They're the highest-yield refinement targets by default.

Do NOT mark the surface as "in progress" anywhere yet — Step 5 can halt this iter and we don't want a half-update.

### Step 2 — Empirical capture (5 min, MANDATORY — no theorizing without screenshots)

You are not allowed to score a surface from source code alone. Per `/browser-test`'s discipline: see what the user sees, then judge.

1. **Boot** the app with a representative seed state. Default seed: Starter plan, no progress, mobile (375×667). Cram users get a second pass with `subscribedPathId: 'prep-4day'`.
2. **Navigate** to the surface (via URL, click chain, or `localStorage` seed — whichever is shortest).
3. **Screenshot** at mobile (375×667) AND desktop (1280×800). Save to `/tmp/jsdrill-refine-NN/<surface>-{mobile,desktop}-before.png`.
4. **Caption** each screenshot — 3 lines: (a) where the eye lands first, (b) what competes for tap/attention, (c) what's hidden that the user might need.

Use `tools/cdp/lib.js` for plumbing. A new probe under `tools/cdp/refine-<surface>.js` is fine but not required if existing probes suffice.

**Bail-at-Step-2 contract:** if Chrome/server won't boot or context budget is already ≥75% used before you've captured screenshots, **bail cleanly** — write a one-line carry-forward into `iter-artifacts/refine-ledger.md` (outcome: `bailed`) naming the surface + the blocker, and stop. Don't ship a refinement you couldn't see.

### Step 2.5 — First-principles vision (3 min, CREATIVE step)

**Before** scoring the existing surface, answer this question in 3–5 sentences:

> "If this surface were the BEST it could be for the user in PROFILE.md (mobile-80%, ADHD, autopilot, time-limited, diagnostic-aware), what would it look like? Don't constrain yourself by what currently ships."

This is the divergent / creative step. The rubric in Step 3 is the convergent / evaluative step. Both matter, and they must happen in this order — score-first anchors you to the existing surface; vision-first frees you to see the gap.

Write the vision verbatim into the iter artifact under `## Vision`. It will appear in the commit body to make the trajectory legible.

(Skip ONLY if Step 0 fired the "all halted/bailed" or "just ship" signal.)

### Step 3 — Score against the rubric — INVOKE `/refine-rubric`

Either:
- Invoke `/refine-rubric <surface>` and paste the output into the iter artifact, OR
- Apply the rubric inline (see [`refine-rubric` SKILL.md](../refine-rubric/SKILL.md)) — the dimensions are: **Autopilot · Decisions · Phone-fit · Time-respect · Diagnostic-aware · Progress-visible · ADHD-fit**, each 0–3, total /21.

The result must include per-dimension evidence (file:line OR screenshot frame description) and a **suggested target dimension** — the lowest non-3 with the highest leverage. That dimension drives Step 4.

### Step 4 — Propose ONE change toward the vision

Append to the iter artifact:

```markdown
## Proposal

**Target dimension:** <from Step 3>
**Change:** ≤2 sentences. What gets edited (file:line or behavioral).
**Closest step toward Step 2.5 vision because:** 1 sentence tying it to the vision.
**Why for user:** which PROFILE.md line(s) this lifts.
**Mockup (UI changes):** ASCII before/after side-by-side. For behavioral changes, one-paragraph state-machine description.
**Files touched:** specific paths.
**Test:** the CDP probe / assertion that confirms it works.
**Rubric projection:** TOTAL_BEFORE/21 → TOTAL_AFTER/21 (which dim moved + by how much).
```

**ONE change per iter.** If you see 3 frictions, ship the highest-leverage; queue the rest in `iter-artifacts/refine-backlog.md`. Concentration > breadth. This is the same atomic-commit discipline as `/drill-improve` Step 5.

### Step 5 — Contrarian review (spawn sub-agent)

Spawn a `general-purpose` Agent with this exact prompt structure. Do **not** let it read the iter artifact or this SKILL.md — fresh eyes (drill-improve's adversary discipline).

```
You are the USER ADVOCATE for the rusty engineer in PROFILE.md (phone-80%,
ADHD, low-overwhelm-tolerance, autopilot-intent, limited study time). You
are reviewing a refinement proposal.

YOUR ONLY JOB: would this change HURT this user?

"Hurt" means one of, narrowly:
  (a) REMOVES an affordance the user actually relies on
  (b) INCREASES decisions when they have ADHD
  (c) BREAKS mobile-first when 80% of usage is mobile
  (d) ADDS setup before drilling (violates autopilot intent)
  (e) HIDES progress they need to see
  (f) REPLACES a diagnostic-aware behavior with a static one

Default verdict: GREEN-LIGHT. Only BLOCK if (a)-(f) clearly applies, citing
the specific PROFILE.md line being violated AND the rubric dimension that
would drop.

DO NOT raise concerns about: code quality, edge cases, future flexibility,
"could be better", aesthetic taste, technical debt, accessibility (unless a
hard breakage), or hypothetical users not in PROFILE.md. Those aren't your
beat. Only user harm.

DO NOT read: this SKILL.md, the iter artifact, refine-ledger.md, or
drill-improve's SKILL.md. You need fresh eyes — the orchestrator's framing
is exactly what you're checking.

READ: /Users/blaisealbuquerque/Projects/coding-practice-app/PROFILE.md
SEE: <paste BEFORE screenshot descriptions from Step 2 + the proposal text from Step 4 inline>

Output exactly one of:
  GREEN-LIGHT: <one-sentence reason this doesn't harm the user>
  BLOCKED: <(a)|(b)|(c)|(d)|(e)|(f)> — <specific PROFILE.md quote> — <one-sentence harm description>

Budget: 5 minutes, 30 lines max.
```

Append the verdict to the iter artifact under `## Contrarian verdict`.

### Step 6 — Decision gate

- **GREEN-LIGHT** → proceed to Step 7.
- **BLOCKED** → **HALT.** Do NOT implement. Update the artifact with `### Halted` at top: date, block reason, the contrarian's verbatim quote. Surface clearly in the final report. The surface's git-staleness clock is NOT reset (we didn't refine it — it's still as stale as before).

### Step 7 — Implement, verify, ship

1. **Edit the files.** Just the proposed change. No scope creep.
2. **Validate data:** `node tools/validate-data.js` — must show `X passed, 0 failed`. If this fails, the change broke something orthogonal — roll back, log in the artifact, halt.
3. **Re-run `/browser-test`** with the same scenario as Step 2. Screenshot the AFTER state at mobile + desktop. Save to `<...>-{mobile,desktop}-after.png`. Diff against BEFORE — at minimum visually inspect both side-by-side; note any unexpected regression.
4. **CDP probe assertion** from Step 4 must pass. If new, save as `tools/cdp/refine-<surface>.js`.
5. **Commit atomically** per `CLAUDE.md § Commit message convention`:
   ```
   [product/ux] iter N (refine): <surface> — <one-line change>

   ## Product impact
   <The user-facing change, in PROFILE.md terms — which rubric dimension(s) it lifts and the quoted user-model line it serves.>

   ## Vision
   <The 1-line vision from Step 2.5 that this change steps toward.>

   ## Engineering
   <Files touched, behavioral changes.>

   ## Verification
   node tools/validate-data.js: X passed, 0 failed
   node tools/cdp/refine-<slug>.js: <invariants> pass
   Screenshots: /tmp/jsdrill-refine-NN/<surface>-*-{before,after}.png

   ## Contrarian
   GREEN-LIGHT: <quoted reason>
   ```
6. **Push to remote** (`git push`). Per drill-improve's convention. If push fails — surface the error and stop. **Do NOT** retry with `--force`, do NOT skip hooks.
7. **Append the ledger row** to `iter-artifacts/refine-ledger.md`:
   ```
   | N | <surface> | <one-line change> | <before>/21 → <after>/21 | shipped |
   ```

### Step 8 — Strategy-doc reciprocity (when applicable)

If the refinement embodies a learning-science principle (active recall, interleaving, retrieval practice, dual coding, elaboration, spacing, varied practice, …):

- Update the existing `docs/learning-strategies/<principle>.md` "How the app encodes it today" section to reflect the refined surface, OR
- Create a new doc if none exists.

Skip if the refinement is purely interaction polish with no learning-science angle.

This is drill-improve's Step 6 — same idea here. Surface and principle ship together.

### Step 9 — Report (terse)

One short report at the end:

- Iter N · surface · before→after rubric · commit hash · contrarian verdict · screenshots dir.
- If anything queued to backlog, name it.
- If Step 0 fired any signal, name it.

## Surfaces this loop is allowed to audit

`iter-artifacts/refine-surfaces.md` is the registry. To audit something not on the list, add a row first in a separate commit — don't refine ad-hoc.

The "last audited" column is **deprecated** in favor of git-staleness (Step 1 #3). The column may persist for visual orientation but is not the picker signal.

## Anti-patterns (will refuse to ship)

- ❌ Auditing a surface that doesn't exist yet → `/drill-improve` instead.
- ❌ Proposing >1 change per iter → decision overload for the reviewer (you).
- ❌ Contrarian raising "what if" / "could be better" / "edge cases" → not user-harm; ignore that verdict and re-prompt.
- ❌ Refactor disguised as refinement (no behavior delta) → wrong commit tag.
- ❌ Adding a new top-level menu / modal / mode → out of scope; queue to backlog.
- ❌ Skipping Step 2 (screenshots) "because it's obvious" → you don't know what's obvious until you see it. Take the screenshot.
- ❌ Skipping Step 2.5 (vision) on a non-halt iter → score-first anchors to the existing surface. Vision-first frees you to see the gap. Don't lose the creative step to "save time."
- ❌ Editing PROFILE.md inside this iter → that's a `frame`-style move. Do it separately so the rubric and vision are stable inputs, not moving targets.

## Sibling loops

- `/drill-improve` — ships **new** features. Use when the gap is "this user need has no surface."
- `/drill-refine` *(this one)* — **refines** existing surfaces. Use when the surface exists but is suboptimal.
- `/refine-rubric` — score one surface against the metric. Standalone or as Step 3 here.
- `/browser-test` — Chrome-debugger discipline. Step 2 + Step 7 invoke this.
- `/lesson-audit` — orthogonal (content quality of L1/L2 inside lessons).
- `/code-review` — review the current diff. Manually invoked, not part of this loop.
