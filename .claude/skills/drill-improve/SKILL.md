---
name: drill-improve
description: Run one iteration of the self-improvement loop for the JS drill app. The job is to SHIP a product enhancement that makes the rusty engineer in PROFILE.md more effective. Self-improvement (audit, vision, frame, research) is a secondary toolkit, used only when shipping is genuinely blocked. Every iter starts with a Step-0 health check on the loop itself — if the last 6 iters shipped ≤2 product changes, force a ship iter and skip ceremony. Step 1 MUST scan `iter-artifacts/ideas-by-category.md` for stale categories before defaulting to vision mode; that file is the catalog of where the loop should be shipping. The improvement loop's own metric is learner-impact velocity, not pivot rate or vision-floor compliance. Use with /loop for recurring runs (e.g. `/loop 15m /drill-improve`) or standalone for a single iteration.
---

# drill-improve

You are running one iteration of the self-improvement loop for the JS drill app.

**The primary job is to ship product.** Every iteration should leave the
drilling user with something better than they had before — a new lesson, a new
feature, a fixed bug, a sharper UX. The loop's *secondary* job is to keep
itself honest (audit quality, surface gaps, reframe assumptions). Meta-modes
exist to unblock shipping, not to substitute for it.

The 6 modes:

| Mode | Output | When |
|---|---|---|
| **ship** *(default)* | Code change, content, or roadmap entry consumed | A shippable enhancement is queued OR you can name one in 60 seconds |
| **vision** | New entries in `iter-artifacts/roadmap.md` | `roadmap.md` is empty OR every queued entry is blocked OR ≥8 iters since last vision |
| **audit** | Artifact under `iter-artifacts/iter-N-<topic>.md` | A specific surface hasn't been reviewed in 8+ iters AND user reported friction OR repeated pivots flag systemic doubt |
| **coverage** | Gap list artifact | The question is "what user need has no current surface?" AND a vision iter just produced candidates needing grounding |
| **research** | External-reference summary | A coverage/vision iter produced a gap list that needs authoritative sourcing before acting |
| **frame** | Edits to PROFILE.md, SELF-IMPROVE.md, docs/, or this SKILL.md | An assumption baked into the codebase is demonstrably wrong AND blocks the next 2+ ship iters |

## Step 0 — Is the loop itself healthy? (15 seconds, every iter)

Before picking a mode, scan the last 6 iters in `SELF-IMPROVE-LEDGER.md § Mode ledger`. Ask one question: **Is the loop shipping product, or shipping process?**

Count: how many of the last 6 iters produced a `[product/*]` commit the drilling user can notice? If the answer is ≤2, the loop is over-indexed on meta-work — process, audits, framework changes, roadmap entries, vision iters — instead of doing what's best for the learner. Treat this as a hard signal.

Other over-correction symptoms (any one fires the same response):
- Adversary pivot rate ≥60% across the last 5 ship iters (the loop is debating ship targets, not shipping them).
- Last 3 iters were any combination of vision/audit/frame/research (zero ships).
- A frame iter ≤10 iters ago added a process rule (floor, mandatory step, ceremony) that ≥2 subsequent iters have skipped or worked around with documented tradeoffs.
- The user has said anything resembling "this is too much process" or "just ship."

**Response when any symptom fires:** This iter is `ship`, no exceptions. Pick the cheapest, highest-confidence enhancement that helps the drilling user — a lesson fix, a UX polish, a small content add, a bug squash. Skip the adversary (Step 2.5). Use the remaining context to either (a) actually ship it, or (b) write a `frame` iter that *removes* a process rule the loop has been working around. Do NOT add more process to fix process-induced slowness.

This step exists because the loop has historically failed to catch its own over-correction:
- **Iter 1–23:** loop drifted into "ship UX refinements only, never new features" (BS-14). Took an external fresh-eyes subagent to notice.
- **Iter 24–34:** over-corrected with vision floor + mandatory adversary + frame-rate limit. Pivot rate hit 80%, meta-iters consumed 4/11 slots, iter 34 explicitly skipped the mandatory adversary as too heavy. Took the user to notice.

The Step-0 check is the loop's own immune response — running it every iter (15 seconds) is cheap; missing the pattern again is not.

## Step 1 — Pick a mode (60 seconds)

If Step 0 fired, mode is `ship` (or `frame` to remove a rule). Skip the rest of Step 1.

Otherwise read ONLY: `SELF-IMPROVE.md § Next iteration` + the last 5 entries in § Iteration log.

### Step 1A — Find the ship target (REQUIRED order; do not skip steps)

Default mode is `ship`. To find what to ship, walk this list **in order** and stop at the first source that surfaces a clear target. Do NOT fall through to `vision` until all three have been checked.

1. **`SELF-IMPROVE.md § Next iteration`** — if the previous iter nominated a target, that's the default unless a veto condition fires.
2. **`iter-artifacts/roadmap.md`** — read the file. Check the "Queued" section for unblocked entries (skip any marked BLOCKED). If a queued entry is shippable in this iter, that's the target.
3. **`iter-artifacts/ideas-by-category.md`** — **read the file in full.** This is the browsable catalog of where the loop should be shipping, organized by product surface (Drilling Surfaces, Paths & Sessions, Mechanics, Content, UI/UX, Persistence, Metacognition, Modalities). For each category:
   - Check its **Review trigger** against the named rows in `SELF-IMPROVE-LEDGER.md § Last-touched index`.
   - If the trigger fires (rows are stale by the declared iter-count), that category is a candidate.
   - Within a triggered category, pick the highest-leverage idea — prefer Active ideas over Parking-lot ideas, and prefer mobile-L1/L2 surfaces over desktop-only ones (PROFILE.md 80%-phone).
   - **Name both the category and the specific idea** in your end-of-iter report and in the commit body's `## Product impact` section. This is how `ideas-by-category.md` stays accountable — every ship that came from it leaves a trace.

If multiple categories trigger, pick the one whose triggered rows are closest to PROFILE.md's load-bearing claims. If no category triggers (everything's fresh), that's an honest signal the existing roadmap has been worked through — fall through to `vision`.

### Step 1A.5 — Prioritize candidates by argmax(impact), tiebreak argmin(cost)

Multiple sources will often surface multiple candidates. Pick by **user impact first, cost second** (user-directed framing as of iter 37 — supersedes the older "cheapest+highest-confidence" framing for normal iters).

**Impact heuristic** — answer in one sentence: "What would the drilling user FEEL the difference of?" Higher impact:
- Fixes a user-reported friction (BS-11 class) OR a moment the rusty engineer hits a wall (PROFILE line 21 stuck-ness, line 31 mobile L1/L2 throughput).
- Unlocks a recall direction the L1→L2→L3 ladder doesn't cover (read+recall-no-input, concrete→abstract recognition, mental simulation).
- Closes a measurement gap on a stated PROFILE.md success criterion (line 65–69).

Lower impact:
- Pure UX polish (sidebar reorder, copy tweak, color change) — visible but doesn't change the recall loop.
- Tooling / probes / artifacts — invisible to the drilling user.
- Adding cells in existing buckets (one more lesson, one more L1 question) — the additive-bias trap.

**Cost** is the tiebreaker, not the primary signal. A medium-cost high-impact ship beats a cheap low-impact ship. Cost includes implementation LOC, per-lesson authoring effort, schema migration risk, and conflict risk with other in-flight work.

**The Step 0 exception:** if Step 0 fires (loop is over-indexed on meta-work), the framing flips back to "cheapest + highest-confidence" — the goal there is to restore shipping velocity, not maximize per-ship impact. Step 0's response is explicitly "pick the cheapest, highest-confidence enhancement."

### Step 1B — Mode switches (signal-based)

Stay in `ship` unless one of these fires:
- **Shipping is genuinely blocked** — Step 1A walked all three sources and surfaced nothing. → `vision`.
- **The loop is spinning** — ≥3 consecutive ship adversary-pivots OR the last 2 ships were pivots away from the originally-nominated target. → `vision` to refresh the roadmap, OR `audit` to ground the next ship in measured pain.
- **A specific assumption is blocking the next ship** — e.g. a PROFILE.md amendment needs ratification before a queued roadmap entry can land. → `frame`.
- **Resuming from PAUSED** — never resume into `ship`. Pick `audit` or `coverage`.

**No hard cadence floors.** Vision/evidence/frame are tools, not quotas. The
old "≥1 vision per 6" rule (iter 24) was useful for breaking the additive-bias
streak (BS-14); that's now broken — iter-31/32/33 shipped a real new feature
surface from a vision-iter entry. Going forward, vision fires when Step 1A
walked all three sources and surfaced nothing — never on a schedule.

One sentence in your end-of-iter report: "Mode = X because Y. Ship target sourced from {§ Next iteration | roadmap.md entry NAME | ideas-by-category.md § CATEGORY → IDEA}."

## Step 2 — Challenge the focus (30 seconds, no subagent)

Before opening code, write a one-line answer to each:
1. **What ships this iter?** Name the concrete user-facing change or artifact in one sentence.
2. **Whose need does it serve?** Cite PROFILE.md line or `SELF-IMPROVE.md § Blind spots ledger` entry.
3. **What would make me wrong?** Name one reason this might not be the right ship — and decide on the spot whether it's load-bearing.

If answer 3 is load-bearing, escalate to Step 2.5. Otherwise proceed to Step 3.

## Step 2.5 — Escalated adversary check (ONLY when answer 3 is load-bearing OR the ship is a multi-iter scaffold)

Multi-iter feature scaffolds (`[product/feature-scaffold]`) are the high-cost decisions — once the schema bumps and the flag goes in, pivoting is expensive. For these, OR when your own challenge in Step 2 surfaced a real doubt, spawn ONE adversarial subagent:

> You are an adversarial reviewer of the drill-improve loop's current ship target. Read `PROFILE.md` and the ship target the orchestrator is about to commit to (described inline in this prompt). Make the strongest case it's wrong. Cite specific PROFILE.md lines or audit findings. Propose 1–2 alternatives the loop would never reach via gradient-descent. Do NOT read `SELF-IMPROVE.md` or this `SKILL.md`. Budget: 5 minutes; 30 lines max.

Integrate findings. Commit body must either pivot (one sentence saying which and why) or rebut (one sentence why the original outranks). No 3-sentence rebut ceremony — one sentence is enough.

For ordinary single-iter ships (lesson batches, content fixes, UX polish, sub-100-LOC tooling), **skip the adversary subagent.** The 60-second challenge in Step 2 is the check.

## Step 3 — Diagnose (mode-specific, brief)

### ship
Load `PROFILE.md`, the relevant slice of `SELF-IMPROVE.md` (Current focus, Constraints, Avoid), `docs/learning-strategies/` index, and the roadmap entry if consuming one. Read the relevant `js/app/NN-*.js` slice(s) (app.js was split into 15 read-whole-able slices — grep to find the right one) / `app.css` / `index.html`. Run `node tools/validate-data.js` to baseline. Don't read more than you need.

**Empirical scan FIRST when reusing infrastructure** (9-time-validated, iter 99/122/140/141/142/144/145/147/155). Before designing the change, grep for the actual call sites + state-binding shape of any X you plan to reuse — not just X's existence. "Mock uses setInterval(250ms) updating #mock-timer" vs "Mock has a timer" is the difference between 5min reuse and 30min rewrite (iter-147 pattern). For state-across-renders reuse, also check lifecycle: where it's set / when it's reset / what re-renders trigger reset — capturing `sessionStartMs` outside `renderCard` is what kept the iter-147 timer ticking across card transitions. Output of the scan: file:line references + closest pattern-mirror function name. This is the load-bearing piece if the ship has to bail (see Step 5 bail contract).

### audit / coverage / frame
Spawn 1–3 parallel `general-purpose` subagents (budget cap: 3). Each reads `PROFILE.md` + only the code/data they need; they **must NOT read `SELF-IMPROVE.md`, the iteration log, `docs-archive/`, or this SKILL.md** — that priming is the bias source.

Prompt scaffold:

> You are a fresh reviewer of this repo. Read ONLY: `PROFILE.md`, `README.md`, `data/manifest.json`, and N random lesson files. Do NOT read `SELF-IMPROVE.md`, the iteration log, `docs-archive/`, or `.claude/skills/drill-improve/`. Answer for {mode-specific question}. Cite specifics. Output a ranked list of 5 findings.

Mode-specific question:
- **audit:** "What in this repo is drifting, stale, or violating its own invariants?"
- **coverage:** "What user need exists that no current surface addresses?"
- **frame:** "What assumption baked into the codebase might no longer fit the user in PROFILE.md? What evidence would invalidate it?"

### research
Use `WebSearch` / `WebFetch` to pull ONE external reference. Extract the structure (not opinions). Diff against `data/manifest.json` or the relevant artifact. Cap: 15 minutes + one external source. Log the source in `SELF-IMPROVE.md § External references consulted`.

### vision
Spawn 1–2 fresh-eyes subagents: *"You are a product designer looking at the JS drill app for the first time. Read PROFILE.md, README.md, and `data/manifest.json` (titles only). Do NOT read SELF-IMPROVE.md, the iteration log, or `.claude/skills/`. Propose 5 hypothetical big features the app does NOT yet have that would materially improve the rusty-engineer experience. For each: one-sentence value claim, one-sentence mechanic, one-sentence falsifiable success criterion. Rank by leverage-per-effort. Prefer 'new bucket' ideas over 'better cell' ideas. Prefer recombining existing lesson data into new mobile-first surfaces (iter-31 meta-finding) over features requiring per-lesson authoring or PROFILE-amendment dependencies."*

**Self-audit before promoting** (7-time-validated, iter 112/115/116/120/124/139/146). After the subagent reports, re-prompt with: *"What categories or shapes did you AVOID or BAIL on for this report, and would re-examining them surface a stronger entry than your top 3?"* This catches the loop's own steering bias — examples it has caught: Cat 9 §9C "blocked by per-lesson authoring" framing was actually sidecar-routable (iter 146); Cat 2 over-concentration in the active list (iter 124, again iter 146); §9C-bias self-flag (iter 120). The re-prompt is cheap (~5 min) and has pivoted the promotion order in ≥2 cases — explicit signal to keep it as a default step, not an opt-in.

Integrate. Add the top 3 entries to `iter-artifacts/roadmap.md` under a dated section header. Mark any entry that contradicts current PROFILE.md as needing a frame iter before it can ship. Nominate the top roadmap entry as the next iter's ship target.

## Step 4 — Pick one thing and ship it

State in 2–3 sentences *before editing*:
1. What you're shipping (code change, content, or artifact)
2. Which PROFILE.md need or roadmap entry it serves
3. How you'll verify it worked

**Bias toward changes that strengthen mobile L1/L2** (80%-phone profile) and that exploit an under-used principle from `docs/learning-strategies/`.

**Atomic-commit rule by mode:**
- **ship (single-iter):** atomically commitable. Lesson batches of 1–6 lessons count as one ship.
- **ship (multi-iter roadmap feature):** may span up to 3 iters via `[product/feature-scaffold]` → `[product/feature-wire]` → `[product/feature-ship]`. Each iter independently passes validator. User-facing surface flag-gated until final iter. Update roadmap entry status at each iter end.
- **audit / coverage / research:** produces an artifact under `iter-artifacts/iter-N-<topic>.md`. Artifacts are first-class commits.
- **vision:** produces entries in `iter-artifacts/roadmap.md`. Optionally drafts a PROFILE.md amendment (commented out in the file).
- **frame:** edits to PROFILE.md, SELF-IMPROVE.md, docs/, or this SKILL.md. No code changes.

**Avoid:** anything in `SELF-IMPROVE.md § Avoid`. For ship mode, no sweeping refactors disguised as improvements.

## Step 5 — Implement + verify

- Edit code / write artifact.
- Run `node tools/validate-data.js` — **must show 0 failures regardless of mode**.
- For UI changes, run the relevant CDP probe. **Mobile probe is mandatory for any UI change** (80% mobile profile).
- Commit atomically per `CLAUDE.md § Commit message convention` — subject-line tag, iter+mode marker in summary, labeled body sections. Any `[product/*]` commit MUST include a `## Product impact` line.
- Mode-to-tag mapping: ship → `product/*` or `engineering/tooling`; audit/coverage/research/vision → `engineering/meta`; frame → `engineering/meta` or `engineering/docs`.
- **Push to remote** after every successful iteration commit. If `git push` fails, surface the error and stop — do NOT retry with `--force`, do NOT skip hooks.

If anything fails: don't commit. Roll back. Log what blocked in `SELF-IMPROVE.md`. Stop.

### Bail-at-Step-3 contract (when context budget is low before code edits start)

If you reach Step 4 with the context budget already cliffed (≥75% used) AND no code has been edited yet, **bail the iter cleanly** rather than ship a partial implementation that risks an incomplete commit. Bailing is honest signal; scope-padding is debt.

- **The carry-forward IS the recovery mechanism.** When bailing, the single most-valuable piece of state to preserve in `SELF-IMPROVE.md § Next iteration` is the **localized empirical-scan finding from Step 3** — file:line references + closest pattern-mirror function name. iter-155 landed the iter-149 BAILED ship within 5 minutes of session boot post-/clear by reading the bail note's carry-forward; without it, the empirical scan would have had to re-run from scratch.
- **Pattern-level scope, not per-iter** (iter 153/155 meta-lesson). If iter N-1 bailed at Step 3 AND iter N would be the 3rd consecutive context-constrained alternate ship from the same alternative path, bail iter N too rather than scope-pad. Validated iter 149-155: 5 alternate ships (1 backfill + 3 corpus + 1 doc) before /clear+retry landed the original target. Residual was net-positive (5-entry sidecar bank + 1 backfilled strategy doc), but the discipline gap was real — bail discipline caught iter-153 by signal-detection, not by contract.
- **Recommend /clear in the bail note**, especially after ≥4 iters in one conversation or context budget consistently entering the cliff zone. /clear is the recovery, not a failure mode.

## Step 6 — Strategy-doc reciprocity (ship mode only, when applicable)

If the change embodies a learning-science principle:
- Update the existing `docs/learning-strategies/<principle>.md` "How the app encodes it today" section, OR
- Create a new doc if none exists (format in `docs/learning-strategies/README.md`).

Feature and strategy doc ship together. Skip if the change is purely tooling, content, or a fix with no learning-science angle.

## Step 7 — Reflect (terse)

Update `SELF-IMPROVE.md`:

- **Iteration log** — prepend a 3–5 sentence entry: mode, what shipped, one learning. Trim to last 10. Do NOT write multi-paragraph essays.
- **Mode ledger** — append `| iter N | mode | one-line outcome |`.
- **Last-touched index** — bump rows for areas touched. **This is load-bearing for `ideas-by-category.md`'s Review triggers** — those triggers reference these row names, so a missed bump silently breaks the freshness signal for that category. If a row that matches a category in `ideas-by-category.md` doesn't exist yet but the iter shipped into that surface, add the row.
- **Blind spots ledger** — add anything subagents/research surfaced that this iter did NOT act on.
- **Avoid** — append discovered dead-ends.
- **External references** (research mode only) — log source.
- **Roadmap** (vision or roadmap-tagged ship) — update entry status.
- **Next iteration** — one sentence: "Suggested: {mode} — {ship target or signal}." If the answer is "ship the next roadmap entry," say so.

Update `iter-artifacts/ideas-by-category.md` ONLY if:
- A new parking-lot idea surfaced this iter (subagent finding, user-reported friction, audit gap) that doesn't fit any existing entry — add one bullet under the right category.
- A parking-lot idea graduated to a roadmap entry — replace the bullet with a "→ see roadmap" link.
- A new product category emerged that doesn't fit the existing 8 — flag in end-of-iter report; don't add it unilaterally (frame-iter decision).

**Do NOT update timestamps in `ideas-by-category.md`** — there are no timestamps in that file by design (freshness derives from `SELF-IMPROVE-LEDGER.md § Last-touched index`). If you find yourself wanting to add one, you're recreating the coordinated-update bug the file was structured to avoid.

The point of Step 7 is to make iteration N+1's Step 1 a 60-second decision, not to author a process essay.

## End-of-iteration output (~8 lines)

- **Loop health** (1 line: "N of last 6 iters shipped product" — surfaces Step-0 signal even when nothing fired this iter)
- **Mode + reason** (1 line including "Ship target sourced from {§ Next iteration | roadmap.md → ENTRY | ideas-by-category.md § CATEGORY → IDEA}")
- **Category touched** (1 line: which category in `iter-artifacts/ideas-by-category.md` this iter touched, and which `SELF-IMPROVE-LEDGER.md § Last-touched index` row got bumped — makes the Review-trigger plumbing visible)
- **What shipped** (1 line — name the concrete change a drilling user would notice)
- **Verification** (validator + CDP if relevant)
- **Adversary** (only if Step 2.5 fired — 1 line: "pivot to X" or "rebut: Y")
- **Next iter** (1 line, copied from Step 7)
- **Blockers** (only if any)

## What changed from the iter-24 version

- **Ship is the default mode.** Other modes are escape valves triggered by signal, not by quota.
- **No hard floors.** "≥1 vision per 6" and "≥1 evidence per 6" removed — vision fires when shipping runs dry; evidence fires when shipping is grounded in doubt. BS-14 (loop additive bias) is closed; the floor that fixed it is no longer needed.
- **Adversary is opt-in for normal ships.** A 60-second self-challenge replaces the mandatory 5-minute subagent for ordinary work. Full adversary subagent stays for multi-iter scaffolds and when your own challenge surfaces a real doubt.
- **End-of-iter ceremony cut.** Reflection is 3–5 sentences and one next-iter line, not a 4-field nomination block.
- **Step 1.5 "Challenge the focus" folded into Step 2** — same questions, less formal scaffold.

Kept from iter-24:
- Vision mode + roadmap mechanism
- Multi-iter feature subtypes (`[product/feature-scaffold]`/`feature-wire`/`feature-ship`)
- Coverage prompt framing ("what user need has no current surface?")
- Strategy-doc reciprocity
- Mobile probe mandatory for UI changes
- Validator-must-pass invariant
- Push-after-commit discipline
