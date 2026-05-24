# Iter 23 — Loop Meta-Review
*Fresh-eyes critique of the drill-improve loop's architecture. For human review before any frame-mode iteration acts on it.*

> Produced by iter 23 audit-mode pass via 1 fresh-eyes subagent.
> Agent had access to PROFILE.md, the current SKILL.md, git log,
> iter-19-gap-list.md, README.md, CLAUDE.md. **Did NOT read
> SELF-IMPROVE.md** — explicitly to avoid the loop's self-narrative
> rationalizing its own trajectory.
>
> Triggered by the human's concern:
> *"I'm wondering if it was getting stuck building the same things
> instead of a fresh new feature enhancement build. The thought was
> that it builds a feature, and then it extracts the learnings to
> make itself better. There's probably a better path out there."*

---

## Part 1 — Is the user's intuition correct? Yes. Quantified.

**Iter-labeled commits (loop output) — 4 total:** iter 19 (frame: redesigned loop), iter 20 (ship: 6 algorithms-boilerplate lessons), iter 21 (ship: tab-switch state cache fix), iter 22 (ship: 1 lesson + 1 strategy doc). Iters 1–17 are *unprefixed* commits between `262380c Add self-improve loop framework` and `831fc32 Wind down self-improve loop after iter 17` — recoverable by date.

**Per-iteration classification (best reconstruction from commit bodies):**

| Category | Loop iterations producing it | Examples |
|---|---|---|
| (a) New feature surface | **0** | — |
| (b) Content addition | 2 (iter 20, iter 22) | 6 algorithms lessons; 1 index-math lesson |
| (c) UX refinement of existing surface | ~10 (iter 1–17) | Review CTA routing, mastered-CTA priority, mock trend chip, sidebar sort, weak-spot count, banner copy, next-CTA injection |
| (d) Bug fix | 2 (iter 12, iter 21) | Mock interview null-deref; tab-switch state wipe |
| (e) Tooling/infra | 2 | CDP helper lib; `validate-files.js` |
| (f) Meta (framework, audits, pauses) | 3+ | Loop redesign; audit-only; wind-down |

**Big features — who shipped them?**

- **Mock interview, Starter Path, SR mechanic, 3-track binder, mobile L2 bottom sheet, Applied track wiring, the original 62-lesson seed** — all *before* `262380c Add self-improve loop framework`. **Human, pre-loop.**
- **Mechanics modal** (`9525dcf`, the only genuinely new surface in the loop era) — **HUMAN**. Smoking gun in commit `162397f`'s own body: *"The in-flight mechanics feature... is deliberately NOT included. That work is separate and **presumably user-authored**."* The loop tagged along by writing the strategy doc and probe, but did not conceive or build the feature.
- **Line-above comments on 99 canonicals** (`15600ea`) and **canonical-style guide** (`66a13d8`) — unlabeled, no iter marker, parallel-sub-agent shape suggests human-orchestrated.
- **Commit-message convention** (`e2f64d5`) — human ask.

**Net finding: the loop has shipped zero new feature surfaces and zero big ideas across all iterations.** Every "feature" the project is known for either predates iter 1 or was authored by the human in parallel. The loop's actual output is: refining CTAs, adding density warnings to the validator, routing one button to a different tab, sorting the sidebar, and adding content into buckets the human already created.

---

## Part 2 — Why the loop is stuck. The architecture *enforces* the bias.

The current SKILL.md is a brilliant document for *avoiding the wrong kind of stuck*. It is a recipe for **a different wrong kind of stuck**.

**Concrete biases baked into the design:**

1. **Ship-quota floor is asymmetric.** `≥3 of any rolling 6 iterations must be ship`. There is no corresponding floor on `frame` or `coverage`. Combined with `≤1 frame per 10`, the loop's *legal* equilibrium is 5 ship + 1 frame. The system is structurally biased toward additive execution.

2. **"Atomically commitable" is a feature-killer.** *"ship: must be atomically commitable; no half-features."* Real new surfaces (mechanics modal: 237 lines of app.js + new modal + tagging 111 lessons + new probe + strategy doc) cannot fit one iteration. So the loop *cannot ship them by construction* — only the human can, by working outside the iter framing.

3. **The "next mode" handoff is a self-fulfilling prophecy.** Each iter nominates the next mode. Reading iter 13, 14, 15, 16, 17: every "lens" follows the *immediately preceding finding* ("audit the L1/L2 end-state CTAs for similar hide-behind-drawer moments"). This is gradient descent in a tiny region. Iter 19's reframe was the ONE break — and it was triggered by *the human winding down the loop after iter 17*, not by the loop's own dissatisfaction.

4. **Fresh-eyes subagents are gated to non-ship modes only** (Step 2B). Subagents could plant new branches, but the ship mode that produces most iterations is forbidden from spawning them. Even when iter 19's subagents *did* run, they produced **a syllabus gap list** (more lessons in existing buckets), not feature ideas. Why? Because the prompt scaffold asks them about *coverage of the current frame*, not about *what would the user wish existed that the app has no surface for*.

5. **The reflect-and-improve loop is real but it improves the directive's *focus*, not its *direction*.** Iter 16 → 17 → 18 sequence: "audit the CTAs" → "audit shows convergence, wind down." The loop *correctly diagnosed convergence* and then *paused itself*. That is healthy. But "iterate the loop while it's still drilling into a tiny region" is exactly the failure mode the user is naming.

6. **There is no mechanism for the loop to propose a feature the human hasn't already named.** Iter 19's gap-list: 100% of items are "missing lessons" (more cells in existing buckets). Zero items are "missing mechanic the app could do." The frame mode can only re-arrange the lens, not invent a new lens.

---

## Part 3 — Alternative loop architectures

### A. Vision-first loop (small change)
**Diff from current:** Every 5th iteration is `vision` mode: the loop drafts 5–10 *hypothetical big features* (one-paragraph specs, no code), ranks them against PROFILE.md, and the top 2 enter a `roadmap.md`. Subsequent `ship` modes consume FROM the roadmap, not from drift. Big features get **multi-iter shipping budgets** (3 iters for a "big" entry, allowed to commit partial scaffolding).
**Would produce:** Mechanics-modal-class features that the loop currently cannot conceive of.
**Risks:** Roadmap entries become wishful list; "partial scaffolding" weakens the validator contract.
**Effort:** Medium.

### B. Hypothesis-driven loop (medium change)
**Diff from current:** Every iteration starts with a falsifiable claim about the user. ("Rusty engineers abandon L3 on mobile within 90s." "Starter Path step pill is invisible to users.") Iteration's job is to *evidence or refute*. Ships follow from evidence. Replaces "ship floor" with an "evidence floor": ≥3 of 6 iters must produce evidence.
**Would produce:** Features grounded in actual friction, not in the loop's own taste.
**Risks:** Without real user telemetry, hypotheses are imagined; loop becomes verbose research mill.
**Effort:** Medium-large — restructures Step 3 around claims, requires lightweight in-app instrumentation.

### C. Adversarial divergence (small-medium change)
**Diff from current:** Each iteration spawns a *mandatory* fresh-eyes subagent whose ONLY job is: *"The loop's current trajectory is wrong. Make the strongest case against the focus statement in SELF-IMPROVE.md and propose a feature the loop would never reach."* The iter must either commit to the adversarial proposal OR write a 3-sentence rebuttal in the commit body. Forces explicit confrontation each iter rather than rare reframes.
**Would produce:** Continuous pressure toward divergence; ideas the loop has filtered out get re-surfaced.
**Risks:** Subagent budget cost; "rebuttal" becomes rubber-stamp; loop slows.
**Effort:** Small.

### D. User-journey simulation (medium change)
**Diff from current:** Every 4th iteration is `simulate` mode: load PROFILE.md, simulate a session at hour 0 / day 7 / day 30. Write the imagined transcript to `iter-artifacts/simulation-N.md`. Identify the highest-friction moment that no current surface addresses. Build from that. Critical: the simulation must surface things the user can't ask for because they don't know they want them.
**Would produce:** Onboarding flow, day-7 abandonment-recovery, day-30 mastery-celebration — categories the current loop never touches.
**Risks:** Simulations are creative writing, not data; can drift into self-flattery.
**Effort:** Medium.

### E. Feature-genealogy tracking (medium change)
**Diff from current:** Maintain a `FEATURE-TREE.md` — every shipped feature is a node; new ships must declare (a) extends node X, (b) **plants new root with justification**, or (c) prunes node Y. Hard rule: ≥1 new root per 8 iters, or the loop is rejected. Surfaces stagnation visually — a tree that only grows leaves on one branch is obvious.
**Would produce:** Continuous pressure to plant new branches; root-planting becomes normalized.
**Risks:** Bureaucracy; "plant new root" gets satisfied by trivial novelty.
**Effort:** Medium.

---

## Part 4 — Recommendation: Hybrid of A + C

**Ship a hybrid of A (Vision-first) + C (Adversarial divergence). Skip D and E; B is good but premature without telemetry.**

**Why this hybrid:**
- A solves the *idea-supply* problem: the loop has no menu of big features to ship from, so it ships from drift. A roadmap built every 5th iter gives ship mode something ambitious to consume.
- C solves the *conviction* problem: even with a roadmap, the loop will rationalize toward the smaller, safer item every time without an adversary forcing the argument.
- A alone is a wishlist generator. C alone is a contrarian without a menu. Together they create a system where every iter has both a vision to ship toward and a critic forcing a defense.

**Concrete SKILL.md edits to make (for a future frame iter to apply):**

1. Add a 6th mode: **`vision`**. Required every 5 iterations (not 10). Output: append 3 ranked feature ideas to a new `iter-artifacts/roadmap.md`. Each entry: one-sentence value claim, one-sentence mechanic, one-sentence falsifiable success criterion.
2. Relax atomicity for "roadmap-tagged" ships: allow a single feature to span up to 3 iters with `[product/feature-scaffold]`, `[product/feature-wire]`, `[product/feature-ship]` tags. Validator must pass each iter; user-facing flag-gates the partial feature.
3. Make adversarial subagent **mandatory in every ship iter**. Budget: 1 subagent, ~5 min. Prompt: *"Argue the loop's current ship target is wrong and propose what should ship instead. Cite specific PROFILE.md lines."* Commit body must either pivot or rebut in ≥3 sentences.
4. **Remove the ship-quota floor.** Replace with: *"≥1 of any 6 iters must be `vision`; ≥1 must produce evidence (audit/probe finding); the remaining 4 are free."* This breaks the structural bias toward shipping small things.
5. Iter 19's gap-list bias: change the fresh-eyes prompt from *"what's missing from the curriculum?"* to **"what user need exists that no current surface addresses?"** — the difference between "more cells in existing buckets" and "new buckets."

---

## Unexamined assumptions the current loop has been carrying

- **"More lessons = more value."** The 22-iter record says the loop reflexively adds content. PROFILE.md never says "needs more lessons." It says needs syntax re-memorization, pattern fluency, interview conditioning, spaced reinforcement. Lessons are one delivery vector. The loop has confused "the vector we have" with "the only vector."
- **"The validator passing means the iter was good."** Every iter ends with "355 passed, 0 failed." This is necessary, not sufficient. It says the content didn't regress. It says *nothing* about whether the iter was the best use of an hour.
- **"Additive is safe, disruptive is risky."** The user has shipped the disruptive work (mechanics modal, 99-canonical comment pass, validator banned-syntax) themselves *during the same week* the loop has been running. The user is **demonstrating by action** that they value disruptive work. The loop's caution is misaligned with the user's actual behavior.
- **"The fresh-eyes subagent will surface divergence."** It hasn't. Iter 19's two subagents produced a tighter spec of the curriculum the human had already built. Subagents inherit the framing of their prompt; the prompt asks coverage questions and gets coverage answers.
- **"PROFILE.md is stable ground truth."** PROFILE.md was written by the human and is itself a hypothesis. The loop treats it as scripture. Iter 19's frame mode redesigned the LOOP, not PROFILE.md. A `vision` mode that occasionally drafts *amendments to PROFILE.md* would be healthier.
- **"Wind-down at convergence is the right answer."** Iter 17→18 paused because "the marginal find is narrower each pass." That's a true diagnosis with the wrong response. The right response is to *change the question*, not stop asking. Pause is a confession that the loop's question is exhausted, not that the project is.

---

## Next steps (for the human to decide)

The current SKILL.md `≤1 frame per 10` rule means iter 24 cannot be a frame iter without violating quota (last frame was iter 19, only 4 iters ago). Options:

1. **Defer to iter 29 (next legal frame slot).** Keep current architecture for 5 more iters, then act on this artifact. Risk: the loop ships 5 more small additive iters in the interim, validating the very concern the user raised.
2. **Override the quota for cause** — make iter 24 a frame iter explicitly to act on this artifact. SKILL.md says "≤1 frame per 10" but the human can authorize an exception when the loop's own meta-review has identified a structural issue.
3. **Inline the adversarial subagent now without a frame iter.** Adding a mandatory adversarial subagent doesn't require SKILL.md changes — it can be done ad-hoc starting iter 24. Vision mode can wait until iter 29.
4. **Park the recommendation.** This artifact stays on disk; act later when user feels the architecture friction directly rather than reading about it.

Recommendation: **option 2 + 3 hybrid.** Override quota for iter 24 = frame mode acting on this artifact. Add the adversarial subagent. Defer full vision-mode rollout to iter 29 so the change is incremental and observable.
