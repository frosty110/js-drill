# Self-Improve Directive

> Read alongside [PROFILE.md](PROFILE.md). Every change must trace back to
> making that user more effective. This file evolves — the loop updates
> § Next iteration, § Mode ledger, § Blind spots ledger, § Last-touched
> index, § External references, § Current focus, § Iteration log, and
> the parking lots after each pass.

## Next iteration
- **Suggested mode:** ship — Tier 1 bottom-quartile rewrites surfaced by iter-27 audit (`linked-list/p-remove-nth` L2 rewrite + `applied-problems/a-minesweeper` L2 expansion). Atomically commitable single-iter ship; 2 lessons.
- **Signal pointing there:** Iter 27 audit produced `iter-artifacts/lesson-audit-2026-05-24.md` covering all 150 lessons with l1l2 rubric. Two new bottom-quartile lessons surfaced (both mean 1.75): `linked-list/p-remove-nth` (all 4 L2 blanks are literal `next` — pattern-matchable) and `applied-problems/a-minesweeper` (single trivial `"X"` blank for a flood-fill lesson). Per the audit's own next-iter-plan and the iter-25 adversary's "no measurement-only artifacts without committed next-iter plan" constraint, iter 28 ships the Tier 1 fixes. Both rewrites are mechanical given the audit's specified rewrite directions; high-confidence atomic ship. **Adversary fires per SKILL.md Step 2A** (first ship-iter consuming audit output → first real adversary test under new architecture; BS-14 pivot-rate criterion starts ticking).
- **Veto condition:** skip Tier 1 ship if (a) user wants iter 28 to consume roadmap entry #1 instead (Pattern Recognition Speed Drill — also single-iter scope; validates vision-iter-26 thread); (b) user prefers iter 28 to start the section-wide L2 under-build remediation pass (theme 6 from audit: 33 patterns + 17 applied lessons ship with only 1 L2 — bigger leverage but multi-iter); (c) user wants iter 28 to be the L1 absurd-distractor cleanup pass (theme 7: ~25 questions across all sections — mechanical, single-iter, lifts global L1 mean ~0.05-0.08).

## Current focus
- **Status: ACTIVE** — loop architecture restructured iter 24 per BS-14 / iter-23 meta-review. New architecture (vision mode + adversarial subagent + vision floor) needs validation in the next 5-6 iters. Pedagogical quality lens (BS-08) still has queued work in iter-23 L1/L2 audit.
- **Primary lens (active until iter 30 or BS-14 fully closes):** Validate the new loop architecture. (1) First vision iter populates `iter-artifacts/roadmap.md` with big-feature candidates the loop would never have surfaced under the old architecture. (2) First ship iter under the new architecture must exercise the mandatory adversarial subagent — does it pivot, or rebut and ship the originally-queued target? Pivot rate ≥30% over the first 6 ship iters is the success criterion for the restructure.
- **Parallel thread (BS-08):** Tier 1 L1/L2 rewrites (5 bottom-quartile lessons from `iter-artifacts/iter-23-l1-l2-audit.md`) still queued. Likely consumed by iter 25 or 26.
- **Follow-up noted iter 20 (still open):** the 6 iter-20 Algorithms lessons + iter-22 `s-index-math` are in the manifest + sidebar but NOT in `STARTER_PATH`. Decide whether/where to insert. Not blocking.

## Mode ledger
*(append-only; enforces the "no 3 consecutive ships" + "≥3 ships per rolling 6" rules mechanically)*

| Iter | Mode | One-line outcome |
|---|---|---|
| 1–17 | ship | See § Iteration log + git history `262380c..2d6325d` |
| 18 | audit | Wind-down audit; 12 probes regression-green, validator 336/0, loop paused |
| 19 | frame | Redesigned SKILL.md (mode rotation + fresh-eyes subagent + research lens + nominate-next-mode), restructured SELF-IMPROVE.md (Next iteration, Mode ledger, Blind spots ledger, Last-touched index, External references), spawned 3 fresh-eyes subagents producing `iter-artifacts/iter-19-gap-list.md` |
| 20 | ship | Cluster 1 Tier 1: 6 boilerplate-as-syntax lessons in Algorithms section via 3 parallel author agents (s-matrix-neighbors, s-bfs-template, s-tree-traversals, s-heap-ops, s-ll-traversal, s-ll-fast-slow). Validator 336→355 (+19 exercises, 0 fail). New durable probe `algorithms-section-expansion.js` (29/29). Regressions clean on welcome-banner-dynamic + sidebar-path-order. New helper `tools/validate-files.js` for in-isolation lesson validation |
| 21 | ship | [product/fix] tab-switch state cache (BS-12 close): user-redirect from queued Tier 2 to fix in-flight friction — switching to Reference mid-attempt was wiping L1 picks / L2 fills / L3 typing. Added `inProgressCache` keyed on lessonId, cleared in selectLesson. L1 replays locked-state visuals; L2 desktop+mobile restore input values via input listeners + shared array refs; L3 syncs cm.on('change'). New durable probe `tab-switch-preserves-state.js` (10/10). Regressions clean on sr-l2-holds-bucket, sr-reveal-demotes-bucket, mock-interview-loads, cta-injects-on-l3-pass |
| 22 | ship | [product/content] [engineering/docs] `s-index-math` lesson + dual-coding strategy doc: user-redirect — "I find r-l+1 indexing challenging" was unmet by any single existing lesson. New Syntax/Algorithms lesson covers 6 idioms (inclusive interval length, midpoint, fixed-length slice, sliding window, circular indexing, nth-from-end) with full ASCII diagrams embedded in Reference per user's visual-learner request. First lesson to systematically use dual coding — new `docs/learning-strategies/dual-coding.md` documents the principle and points to BS-13 for retro-adding diagrams to other high-traffic lessons. Validator 355→359 (+4 exercises, 0 fail). algorithms-section-expansion probe extended (now 33/33) |
| 23 | audit | [engineering/meta] User-requested L1/L2 quality audit + loop meta-review. Spawned 3 parallel fresh-eyes subagents (none read SELF-IMPROVE.md): A scored 27 syntax lessons (Basics+Arrays+Hash+Modern+Iterators), B scored 24 (JS Toolbox+Algorithms+Classes+Async+Advanced JS), C critiqued the loop architecture itself. Findings: 51 lessons mean 2.49/3.00; 5 bottom-quartile flagged for rewrite (`s-promises` 1.38, four lessons tied at 1.75); 6 more on watchlist. Loop meta-review (Agent C) found loop has produced ZERO new feature surfaces across all iterations — every "big feature" predates iter 1 or was human-shipped in parallel. Architecturally biased toward additive UX. Two artifacts: `iter-23-l1-l2-audit.md`, `iter-23-loop-meta-review.md`. Opens BS-14 (loop additive-bias). Closes BS-08 (audit done; fixes queued for iter 24+). |
| 24 | frame | [engineering/meta] User-authorized quota override to act on iter-23 loop meta-review immediately rather than defer to iter 29. SKILL.md restructured per Part 4 recommendation: (1) added 6th mode `vision` for periodic big-feature roadmap generation; (2) added mandatory adversarial subagent step to ship mode (every ship target must be confronted with an adversary proposing alternatives, then commit body must pivot or rebut in ≥3 sentences); (3) replaced ship-quota floor (`≥3 ships per 6`) with vision floor (`≥1 vision per 6`) + evidence floor (`≥1 evidence-producing per 6`); (4) removed `3+ consecutive ships → forced non-ship` and `multiple of 10 → forced frame` rules (now redundant); (5) reframed coverage prompt from "what's missing from curriculum?" to "what user need has no current surface?"; (6) added multi-iter feature pattern with `[product/feature-scaffold]` → `[product/feature-wire]` → `[product/feature-ship]` subtypes for roadmap entries too big for one iter. New `iter-artifacts/roadmap.md` stub created. CLAUDE.md commit convention updated with the new subtypes. BS-14 marked partially closed; success criterion = adversary pivot rate ≥30% over first 6 ship iters. |
| 25 | ship | [engineering/tooling] First ship under new architecture. User-requested `/lesson-audit` skill at `.claude/skills/lesson-audit/SKILL.md` — makes iter-23's one-off L1/L2 quality audit reproducible. Plan-first-then-check-priors discipline (orchestrator drafts audit plan BEFORE loading prior outputs, refines after). One parallel subagent per section group (algorithmic, 8-12 agents for full 149-lesson project). Embeds the iter-23 rubric verbatim; parameterizable via flags (`--scope`, `--changed-only`, `--rubric`, `--max-agents`). Outputs `iter-artifacts/lesson-audit-{date}.md` + `iter-artifacts/.lesson-audit-state.json` (delta cache). **Mandatory adversary fired (per new SKILL.md Step 2A):** verdict weak-case-against; alternatives = (a) audit+auto-fix in one skill, (b) L1-count backfill deterministic pass. Rebut: user explicitly directed reproducible skill not one-shot, alternatives can land as future flags/iters, audit's `--auto-fix` mode is a natural extension. Adversary's "no measurement-only artifacts" constraint honored in § Next iteration nomination. Skill structurally validated (YAML frontmatter parses, all required sections present, 202 lines) but NOT smoke-tested — first real invocation is the user's `/lesson-audit` call. Validator 359/0. |
| 26 | vision | [engineering/meta] First vision iter ever — satisfies vision floor (≥1 per rolling 6) established iter 24 to enforce BS-14 close. Spawned 2 parallel fresh-eyes product-designer subagents (neither read SELF-IMPROVE.md, iteration log, or .claude/skills/); A primed by general product framing, B primed by "unfair-advantage zones" framing (browser APIs + cognitive surfaces the ladder doesn't cover). **Cross-subagent convergence on 3 buckets:** audio modality (A#1, B#1), miss-classification post-mortem (A#2, B#2), pattern-recognition / inverse direction (A#4, B#3). Promoted as roadmap entries #1 Pattern Recognition Speed Drill (single-iter ship, no schema migration, mobile-native), #2 Error Post-Mortem with Miss Classification (2-iter scaffold+ship, `__v: 6` bump), #3 Commute Audio Mode (3-iter scaffold+wire+ship, listen-only MVP, voice-in deferred). 3 PROFILE.md amendments drafted as HTML comments (commented-out per SKILL.md Step 2D step 3 — frame iter ratifies). 4 sub-proposals NOT promoted but retained in roadmap traceability section (AI Interview Coach, Daily Push+Sync, Side-by-Side Diff, Standalone PWA). § Next iteration nominates audit (run `/lesson-audit`) per iter 25 adversary's measurement-with-plan constraint. |
| 27 | audit | [engineering/meta] First real `/lesson-audit` invocation — validates the iter-25 skill end-to-end. Spawned 12 parallel agents (Basics, Algorithms, Trees, DP, Applied, Arrays+Hash+Modern, Iter+JSToolbox, Classes+Async+Adv, A&H+TwoPtr+Sliding, Stack+BS+LL, Tries+Heap+Graphs, Greedy+Bktk+Intervals+Matrix+Bit+SysDes); none read SELF-IMPROVE.md/iteration log/SKILL.md. Plan-first-then-priors discipline honored (pre-prior plan drafted before loading iter-23 audit; refined plan unchanged). **Aggregate: L1 2.63, L2 2.60, lesson 2.61 across 150 lessons.** Two NEW bottom-quartile lessons (`linked-list/p-remove-nth` 1.75 — all 4 L2 blanks are literal `next`; `applied-problems/a-minesweeper` 1.75 — single trivial `"X"` blank for a flood-fill lesson). 12 watchlist. **Key cross-cutting themes:** (1) linked-list `.next` blanking disease across 5 of 7 LL lessons; (2) L2 under-build is systemic (33 of 79 patterns + 17 of 20 applied have only 1 L2 — violates PROFILE.md ≥2 floor); (3) recurring "Why dummy head?" Q across 4 LL lessons (spaced-rep redundancy); (4) complexity-question fatigue across ~70 patterns lessons (always with one absurd distractor). **Delta vs iter-23:** 13 improved / 3 regressed / 7 unchanged / 126 newly scored — but 3 of the "improved" (`s-promises` +1.00, `s-trycatch` +1.00, `s-class` +0.62) had NO git changes since iter 23, flagged as agent-leniency noise in the artifact's delta-integrity caveat. Real story: zero lessons drifted into bottom-quartile from prior watchlist; the two new bottoms are first-ever-audited (LL + applied). Outputs: `iter-artifacts/lesson-audit-2026-05-24.md` (1700-line report), `iter-artifacts/.lesson-audit-state.json` (baseline for delta on future runs). Validator 362/0. |

## Blind spots ledger
*(things the loop has historically not questioned; promote to Current focus or Parking lot when actioned)*

- **[BS-01] Syllabus completeness vs. external rubrics** — never benchmarked against canonical lists. Iter 19 measured: NeetCode 150 ~52% covered, Blind 75 ~80%, LC Top Interview 150 ~37%. *Seeded iter 19; iter 20 ship consumes the Cluster 2 portion of the gap list.*
- **[BS-02] Boilerplate-as-syntax gap** — algorithmic scaffolding buried inside Patterns lessons; never extracted as standalone Syntax lessons. *Partially closed iter 20: Tier 1 shipped (matrix-neighbors, bfs-template, tree-traversals, ll-traversal, ll-fast-slow, heap-ops). Tier 2 remaining for iter 21: matrix-bounds, dfs-recursive-template, dfs-iter-template, ll-node-shape, binsearch-template, union-find, grid-init.*
- **[BS-03] JS-specific concepts under-covered** — `structuredClone`, `AbortController`, `Promise.race/any/allSettled`, microtask vs macrotask ordering quizzes, hoisting/TDZ, `==` coercion, `WeakMap`/`WeakRef`. *Seeded iter 19; queue for coverage iter ~22.*
- **[BS-04] Frontend utility lessons missing** — DOM traversal, event delegation, `classNames()`, retry-with-backoff, promise concurrency pool, AbortController-cancellable promise, deep equality. *Seeded iter 19; queue for coverage iter (Applied track expansion).*
- **[BS-05] Modern syntax gaps** — rest params, computed/shorthand keys, logical assignment (`||=`, `??=`, `&&=`), ES2022+ array variants (`findLast`, `toSorted`, `toReversed`). *Seeded iter 19; queue for ship iter ~22.*
- **[BS-06] L1→L2→L3 ladder treated as axiomatic** — no iter has questioned whether the ladder shape fits all topic types (system design likely needs a different shape; quick conceptual quizzes might want L1-only). *Seeded iter 19; revisit in a future frame iter (~iter 30).*
- **[BS-07] PROFILE.md assumption decay** — "80% phone" was written at project start and never re-validated. Could be more/less phone now after months of actual use. *Seeded iter 19; revisit in a future frame iter (~iter 30) when usage data is available.*
- **[BS-08] Content quality vs. content validity** — validator passes ≠ lessons are well-authored. *Audited iter 23 (51 syntax only, mean 2.49). **Re-audited iter 27 (all 150 lessons via `/lesson-audit` first real invocation, see `iter-artifacts/lesson-audit-2026-05-24.md`):** L1 mean 2.63, L2 mean 2.60, lesson mean 2.61. **2 new bottom-quartile lessons** surfaced from never-audited tracks: `linked-list/p-remove-nth` 1.75 (all 4 L2 blanks are literal `next`) and `applied-problems/a-minesweeper` 1.75 (single trivial `"X"` blank for flood-fill lesson). 12 watchlist (1.80-2.15). State file `iter-artifacts/.lesson-audit-state.json` created — delta computation available for all 150 lessons on next run. **Iter-23 bottom-quartile lessons all cleared 1.80 line in iter-27 re-score, but 3 of those positive deltas (s-promises +1.00, s-trycatch +1.00, s-class +0.62) had NO git changes — likely agent-leniency artifact, flagged in delta-integrity caveat.** Outstanding cross-cutting themes: (1) linked-list `.next` blanking disease across 5 of 7 LL lessons (highest-leverage section-level rewrite target); (2) L2 under-build is systemic (33 of 79 patterns + 17 of 20 applied have only 1 L2 — violates PROFILE.md ≥2 floor); (3) recurring "Why dummy head?" Q across 4 LL lessons (interleaving redundancy); (4) ~25 L1 questions with absurd-distractor anti-pattern. **BS-08 close criterion (the lessons-are-well-authored question) now has reproducible measurement infrastructure + first re-audit baseline.** Outstanding watchlist threshold question (move to ≥2.00?) still open. Tier 1 rewrites (the 2 new bottoms) nominated for iter 28 ship.*
- **[BS-09] Tooling debt in `tools/cdp/`** — 12+ probes accumulated; never audited for staleness, DRY violations, or coverage. Schema `__v` not bumped despite `mockHistory` field added iter 13. `_iter16-survey.js` left untracked across iters 16–19. *Seeded iter 19; queue for audit iter.*
- **[BS-10] Storage backend (localStorage-only)** — cross-device sync would be a strong win for the 80%-phone profile if scoped tight (anonymous-first, opt-in login). User flagged iter 19 discussion; deferred for now to ship the syllabus work first. *Seeded iter 19; queue for a future frame iter to decide scope before any code.*
- **[BS-11] "I passed but nothing saved" UX gap** — user-reported 2026-05-23 after iter 20. Investigation via CDP probes confirmed localStorage save/load works correctly on both localhost and the live Pages URL. Actual cause: pass conditions are strict — L1 requires ALL questions correct in one session (any wrong click locks that question; user must hit Retry), L2 requires every exercise's every blank correct, L3 requires exact output match. Navigation state (lastLessonId, lastTab, sidebarTrack, welcomed) saves on nav so the user sees "something" persisted, but `progress` stays empty until a full pass fires `markPassed()`. The single feedback message "Some answers were off — hit Retry to start over" is the only signal, and it's easy to miss when individual questions show "✓ Correct" mid-session. *Candidate product/ux fixes: (a) persistent per-session score chip ("2/3 correct — Retry for full pass"); (b) post-attempt summary surface; (c) loosen strict-pass to ≥N% with a note that the SR bucket still requires full mastery; (d) different copy on the "✓ Correct" per-question feedback to make clear it's per-question, not the lesson pass. Queue for iter 22+ as a [product/ux] candidate — discuss with user before implementing since (c) touches the SR mechanism's core assumption.*
- **[BS-12] Tab-switch wipes in-flight work** — user-reported 2026-05-23 mid-iter-21 investigation. Switching from L1/L2/L3 to Reference and back rebuilt the renderX DOM from scratch, losing any clicked L1 answers, typed L2 blanks, or L3 editor code. Root cause: each `renderX` initialized local state fresh (`localState = qs.map(...)`, `exerciseState = exercises.map(...)`, fresh CodeMirror instance) with no persistence layer between renders. *Closed iter 21 by adding `inProgressCache` keyed on `lesson.id`, cleared in `selectLesson` when lesson changes, restored on every renderX. Probe `tab-switch-preserves-state.js` 10/10 verifies all three tiers + cross-lesson cache clear.*
- **[BS-13] Visual encoding under-exploited across existing lessons** — user-surfaced 2026-05-23 during iter 22 (visual-learner request). Most existing lessons rely on code-only references, but structural concepts (indexing, traversal, window-sliding, neighbor offsets, parent/child math, recursion order) memorize faster with ASCII diagrams alongside the formula. `s-index-math` (iter 22) is the proof-of-concept; new `docs/learning-strategies/dual-coding.md` formalizes the principle. *Candidate retro-add targets in priority order: binary-search, p-bfs (tree level-order trick), p-min-window (sliding window animation), p-islands (matrix DFS), p-merge-two-sorted (dummy-head shape), p-reverse-list (pointer hop), p-min-heap (sift-up/sift-down trace), s-iter-protocol (yield flow). Each is a 5-15 line diagram added to the lesson's `reference.code` string — atomically commitable. Queue as a [product/content] audit-and-add ship for iter 23+ once Cluster 1 Tier 2 lands, OR consume in parallel as a separate ship if user flags more friction.*
- **[BS-14] Loop is structurally biased toward additive UX work — has shipped ZERO new feature surfaces** — surfaced iter 23 by fresh-eyes meta-review subagent (see `iter-artifacts/iter-23-loop-meta-review.md`). Across all loop iterations (1-22), the per-iteration classification is: 0 new feature surfaces, 2 content additions, ~10 UX refinements, 2 bug fixes, 2 tooling, 3+ meta. **Partial close iter 24:** SKILL.md restructured per the meta-review's Part 4 recommendation. Added `vision` mode (≥1 per rolling 6 — replaces the old "multiple of 10 → frame" rule as the periodic-reframe trigger). Added mandatory adversarial subagent in every ship iter (must pivot or rebut in ≥3 sentences). Removed the ship-quota floor + the "3 consecutive ships → forced non-ship" rule. Reframed coverage prompt from "what's missing from curriculum?" to "what user need has no current surface?" Added multi-iter feature pattern (`[product/feature-scaffold]`/`feature-wire`/`feature-ship`) so roadmap entries too big for one iter can land. **Vision floor first fired iter 26** — 3 cross-subagent-converged big-feature candidates landed in `iter-artifacts/roadmap.md` (Pattern Recognition Speed Drill, Error Post-Mortem, Commute Audio Mode); all 3 are "new buckets" (not refinements of existing surface). Architecture is now exercising the vision lever as designed; remaining validation is the adversary-pivot-rate criterion below. **Success criterion (validates the close):** adversary pivot rate ≥30% over the first 6 ship iters under the new architecture (iters 25-30ish). If pivot rate stays below 30%, the adversarial step has become a rubber-stamp and the loop is still stuck — escalate to a fresh frame iter. *(Tracking: iter 25 = rebut, iter 26 = vision so no adversary fired; first ship-iter consuming a roadmap entry is the next adversary test.)*

- **[BS-15] Lesson `description` is technique-flavored, not problem-flavored** — *(was previously mis-numbered as a second BS-14; renumbered iter 26.)* user-surfaced 2026-05-23 while evaluating the Conversation tab prototype (`p-longest-sub`). Current `description` for Patterns/Applied lessons reads like solution metadata ("Sliding window with a Set: expand the right edge…") which belongs on Reference. The Conversation tab simulates an interview but never shows the user the actual problem statement first, so "Restate & clarify" asks the user to restate something they were never shown. *Fix: add a new `problem` field (interview-style statement with example + constraints) and render it under the lesson title, visible on every tab. `description` stays as sidebar/search metadata — no churn across the other 142 lessons. L3 prompts can shrink to just the action ("Implement it. Log …") since the problem lives elsewhere. Schema-only addition. Queue as the next [product/content] + [engineering/refactor] ship for the Conversation-tab arc; templatize across the 99 Patterns/Applied lessons after the first 2-3 prove the format.* **Cross-link to roadmap iter 26:** entry #1 Pattern Recognition Speed Drill could consume `description` as the prompt source, which would *exacerbate* this mis-flavoring (if description leaks the technique, Recognize-mode becomes trivial). Resolution order matters: BS-15 should resolve before Recognize-mode ships, OR Recognize-mode should pull from `L3.prompt` instead.

## Last-touched index
*(forces audit-mode selection to be data-driven; bumped at Step 6 of every iteration)*

| Area | Iter last touched |
|---|---|
| Skill / SELF-IMPROVE structure | 19 |
| Algorithms section (boilerplate-as-syntax expansion) | 22 (s-index-math + ASCII diagrams) |
| L1 / L2 / L3 render state cache (BS-12 fix) | 21 |
| Learning-strategies docs (dual-coding) | 22 |
| L1/L2 pedagogical quality audit (BS-08 close) | 23 |
| Loop meta-review (BS-14 open) | 23 |
| SKILL.md restructure (BS-14 partial close) | 24 |
| Roadmap mechanism (`iter-artifacts/roadmap.md`) | 26 (first 3 entries populated by vision subagents) |
| `/lesson-audit` reproducible audit skill | 25 |
| PROFILE.md (commented-out amendment drafts) | 26 (3 amendments awaiting frame iter) |
| Vision-mode subagent template + roadmap promotion criteria | 26 (first invocation) |
| `/lesson-audit` skill (first real invocation) | 27 (12-agent parallel audit, 150 lessons scored) |
| Lesson-audit state file (`iter-artifacts/.lesson-audit-state.json`) | 27 (baseline created — delta computation available for future runs) |
| L1/L2 quality across full curriculum (BS-08 close confirmation) | 27 (2 new bottom-quartile surfaced: `linked-list/p-remove-nth` + `applied-problems/a-minesweeper`) |
| L3 surface / CTA injection | 17 |
| Cheatsheet | 15 |
| Applied-track surfaces (pills, stats panel) | 14 |
| Mock interview (history chip, crash fix) | 13 |
| Mock interview probe | 12 |
| Sidebar (path-order sort) | 11 |
| Welcome banner | 10 |
| Weak-spot visibility | 9 |
| L2 content density (existing lessons) | 8 |
| Validator (density warning) | 5 |
| Spaced repetition (state surfacing, demote-on-reveal, hold-on-L2) | 6 |
| **Matrix / grid syntax** | 20 (matrix-neighbors; bounds + grid-init pending Tier 2) |
| **BFS / DFS / tree traversal syntax** | 20 (bfs-template + tree-traversals; dfs templates pending Tier 2) |
| **Linked list helpers (syntax)** | 20 (ll-traversal + ll-fast-slow; node-shape pending Tier 2) |
| **Heap (syntax)** | 20 (heap-ops) |
| **Async combinators / loops (syntax)** | never |
| **Modern syntax (rest/computed/logical-assign/ES2022 arrays)** | never |
| **Hash/Set idiom syntax (counter, group-by, set ops)** | never |
| **Frontend utility lessons (DOM/event/concurrency)** | never |
| **PROFILE.md assumptions** | 0 (never re-validated) |
| **L1→L2→L3 ladder shape** | 0 (axiomatic) |
| **tools/cdp/* health audit** | never |
| **Storage backend** | never |

## External references consulted
*(appended by research-mode iters so the loop doesn't re-pull the same source)*

- **2026-05-23 iter 19 (coverage subagent):**
  - [NeetCode 150 (crackr.dev)](https://www.crackr.dev/neetcode150)
  - [Blind 75 (neetcode.io)](https://neetcode.io/practice/practice/blind75)
  - [LC Top Interview 150 — ChunhThanhDe mirror](https://github.com/ChunhThanhDe/Leetcode-Top-Interview)
  - [Tech Interview Handbook](https://www.techinterviewhandbook.org/best-practice-questions/)
  - [BFE.dev problem index](https://bigfrontend.dev/problem)
  - [GreatFrontend top JS interview questions](https://github.com/greatfrontend/top-javascript-interview-questions)
  - Findings folded into Blind spots ledger BS-01..BS-05 and `iter-artifacts/iter-19-gap-list.md`.

## Constraints (stable across iterations)
- **Phone-first.** ~80% of usage is mobile (see PROFILE.md). Improvements that
  only help desktop are lower priority unless they enable something the mobile
  user benefits from indirectly. Touch targets, tap-based interactions, and
  L1/L2 surface area are the high-leverage zones.
- **L1/L2 density matters.** When auditing lessons, flag any with fewer than
  3 L1 questions or 2 L2 exercises — the mobile drill loop runs out of fuel
  too quickly otherwise.
- **Strategy-doc reciprocity.** When building a memorization tool or feature,
  also add or update the relevant doc in `docs/learning-strategies/` explaining
  the learning-science principle it embodies. If the strategy isn't documented
  yet, document it. The app and the strategy docs evolve together.
- No build step. No new deps. Vanilla JS + Tailwind / CodeMirror via CDN only.
- `node tools/validate-data.js` must show **0 failures** after every change.
- Atomic commits per `CLAUDE.md § Commit message convention` — one improvement per commit, subject-line tag (`[product/*]` or `[engineering/*]`), mandatory `## Product impact` line for any `[product/*]` commit. Iter+mode marker still goes in the subject summary.
- Don't edit lesson content unless the directive explicitly makes lessons the
  focus this iteration.
- Preserve backwards-compatible `localStorage` schema (`jsdrill.progress.v1`).
- Mobile responsiveness must not regress — invoke the `browser-test` skill
  (or copy `tools/cdp/template.js`) to drive a headless Chrome at iPhone
  viewport + coarse pointer when touching UI. The shared lib at
  `tools/cdp/lib.js` bootstraps server + Chrome and keeps scenario scripts
  short.

## Iteration log (newest first, keep last 10)

### 2026-05-24 — iter 27 — Audit mode: first real `/lesson-audit` invocation across all 150 lessons
First real invocation of the iter-25 `/lesson-audit` skill — validates
the plan-first-then-priors flow + parallel-section-subagent fan-out
end-to-end. Spawned 12 parallel agents (one per section group: Basics,
Algorithms, Trees, DP, Applied — single 20-lesson agent — plus 7 grouped-
small-section agents covering remaining 87 lessons). All 12 agents fresh-
eyes (none read SELF-IMPROVE.md, iteration log, prior audit, or SKILL.md).
Plan-first discipline honored: pre-prior plan drafted from manifest only
(12 agents × ~12 lessons each), then iter-23 prior loaded and per-lesson
prior scores threaded into each agent's prompt for delta computation; no
plan delta required. **Challenge-the-focus answers:** (1) loop hasn't
touched comprehensive curriculum measurement since iter 23 syntax-only
audit; never touched patterns track or applied track for quality. (2)
PROFILE.md "L2 must blank load-bearing tokens not identifiers" is testable
via this rubric — audit confirms it's the dominant L2 failure mode. (3)
New contributor would ask "why is `p-remove-nth`'s L2 four blanks of the
same `next` token? did the L2 system check?" — and the answer is: validator
checks correctness, not pedagogical fitness; the audit IS the missing check.
(4) Yes highest-leverage — `/lesson-audit` going unused for 2 iters after
shipping would have validated iter-25 adversary's "no measurement-only
artifacts without committed plan" criticism. **Aggregate result: L1 2.63,
L2 2.60, lesson 2.61 across 150 lessons.** Two new bottom-quartile
(`linked-list/p-remove-nth` 1.75, `applied-problems/a-minesweeper` 1.75).
12 watchlist. Iter-23 5 bottoms all cleared 1.80 line but 3 of the +1.00
deltas (s-promises, s-trycatch, s-class) had NO git changes — flagged as
agent-leniency noise in artifact's delta-integrity caveat. **Top
cross-cutting findings:** (1) linked-list `.next` blanking disease across
5 of 7 LL lessons; (2) systemic L2 under-build (33+17 lessons with only
1 L2, violates PROFILE.md ≥2 floor); (3) recurring "Why dummy head?" Q
4× across LL; (4) ~25 L1 absurd-distractor questions. Artifacts written:
`iter-artifacts/lesson-audit-2026-05-24.md` (~1700 lines), state file
`iter-artifacts/.lesson-audit-state.json` (per-lesson L1/L2/mean +
scoreHistory for delta computation on future runs). Validator 362/0 (3
extra exercises since iter 26 — unrelated WIP on `p-longest-sub.json`).
**Learning:** the 12-agent parallel fan-out worked cleanly first-shot —
no agent failed, all returned structured reports in the expected format,
cross-agent themes converged independently (multiple agents flagged
"complexity-question fatigue" and "L2 under-build" without prompting).
The plan-first-then-priors discipline cost an extra ~30 seconds (write
pre-prior plan first) and produced no behavior change this time — but
that's by design; the discipline pays off when prior outputs would
otherwise anchor the orchestrator into auditing only what was audited
before. Also notable: my iter-23 priors were partly incomplete (only
24 of 51 syntax lessons had explicit L1/L2 scores published; others
only had aggregate "≥2.25" labels), so the state file is the FIRST time
all 150 lessons have explicit-and-recoverable scores — every future
audit run gets a real delta column instead of "newly scored" for 60%+
of lessons.

### 2026-05-23 — iter 26 — Vision mode: populate roadmap.md with 3 ranked big-feature candidates
First-ever vision iter. Forced by Step 1 procedure rule 2 (vision floor
of ≥1 per rolling 6 — count was 0; rule applies trivially). § Next
iteration also nominated vision as primary. User invocation was
generic (`/loop /drill-improve`) so no veto fired. **Challenge-the-
focus answers:** (1) loop hasn't touched: cross-device sync, PROFILE
re-validation, ladder shape, tools/cdp health audit, modern syntax
gaps, frontend utility lessons, hash/set idioms, async combinators —
and entirely missing CATEGORIES: audio modality, AI-explained
mistakes, adaptive content generation, cross-device coordination,
metacognitive surfaces. (2) PROFILE.md assumes 80%-phone is visual
phone-attention; the user's transit/walking/dishes time is unaddressed
and could be a large under-served slice. (3) New contributor would
ask "why does an interview-prep app for a rusty-but-experienced
engineer have NO surface for talking through code, NO post-mortem on
mistakes, NO recognition-vs-recall mode, and NO audio?" (4) Vision IS
the highest-leverage question — BS-14 close criterion requires
roadmap entries to exist before ship iters can pivot to them; this is
structural-leverage. **Action:** spawned 2 parallel fresh-eyes
product-designer subagents (one primed generally, one primed toward
"unfair-advantage zones" — browser APIs + cognitive surfaces the
ladder doesn't cover). Neither read SELF-IMPROVE.md, iteration log,
or .claude/skills/. **Cross-subagent convergence on 3 buckets:**
audio modality (both #1), miss-classification post-mortem (both #2),
pattern-recognition / inverse direction (A#4, B#3). Promoted as
roadmap entries #1 Pattern Recognition Speed Drill (single-iter
ship), #2 Error Post-Mortem with Miss Classification (2-iter), #3
Commute Audio Mode (3-iter). 3 PROFILE.md amendments drafted as HTML
comments (commented-out per SKILL.md Step 2D step 3). 4 non-promoted
sub-proposals (AI Interview Coach, Daily Push+Sync, Side-by-Side
Diff, Standalone PWA) retained in roadmap traceability section with
explicit "held because X" reasons. Renumbered the duplicate BS-14
(lesson `description` problem) to BS-15 + added cross-link to
roadmap entry #1 (BS-15 should resolve before Recognize-mode ships
to avoid technique leakage). Validator 359/0 (no code touched).
**Learning:** the cross-subagent convergence pattern is a real
signal-amplifier — when two independently-prompted fresh-eyes
agents land on the SAME 3 buckets without communicating, the
selection is much more defensible than a single-agent's top-3. Worth
codifying in SKILL.md if iter 27+ vision iters reproduce this
pattern. Also notable: both subagents converged on buckets that
require PROFILE.md amendments — suggests the loop's existing
profile is genuinely under-spec'd for "new bucket" thinking, which
itself validates the iter-24 restructure (the old architecture
couldn't have surfaced these because the SKILL.md framing made
"propose new modalities" structurally impossible).

### 2026-05-23 — iter 25 — Ship mode: `/lesson-audit` reproducible audit skill
First ship under new iter-24 architecture. User-proposed: make
iter-23's one-off L1/L2 quality audit a reusable slash-command skill,
with plan-first-then-check-priors discipline + one parallel subagent
per vertical tab (section group). **Challenge-the-focus answers:**
(1) loop hadn't touched reproducible-audit tooling; loop also hadn't
exercised vision floor yet (forced for iter 26). (2) PROFILE.md
doesn't comment on tooling, so this is engineering-meta — assumption
test = does the user actually re-run audits or is this build-once-
forget? (3) New contributor would ask "why was iter-23 a one-off
when the rubric is clearly general-purpose?" (4) Highest-leverage
within engineering-meta — converts BS-08 from a sporadic-attention
problem to a callable measurement. **Mandatory adversary fired:**
verdict weak-case-against. Alternatives: (a) audit+auto-fix in same
skill (collapses measure→fix gap), (b) L1-count backfill pass
(deterministic, no subagents needed). **Rebut** (in lieu of pivot):
user explicitly directed reproducible skill not one-shot or auto-
fix; the skill is parameterizable so Alt-(a) lands as a future
`--auto-fix` flag without rebuilding; Alt-(b) is a strict subset of
what the default audit surfaces (the 93 L2-floor lessons already
appear in validate-data.js density warnings + this audit makes them
actionable per-lesson). Adversary's "no measurement-only artifacts"
constraint honored by explicit § Next iteration nomination (iter 27
runs `/lesson-audit`, iter 28 ship consumes findings). Wrote
`.claude/skills/lesson-audit/SKILL.md` (202 lines): plan-first then
review-priors flow, algorithmic section grouping (8-12 agents),
embedded rubric library (default `l1l2` from iter 23; placeholder
slots for `distractor-plausibility` and `l3-quality`), agent prompt
template, state-file schema for delta computation. Validator
unchanged 359/0; no smoke test possible from this session (skill is
available for future sessions; first real invocation is user's
`/lesson-audit` call). **Learning:** the new adversarial-subagent
step worked exactly as designed — it surfaced 2 alternatives the
loop would never have raised, made me write a real rebut rather
than reflexive yes, and produced 2 candidate roadmap entries
(auto-fix mode, backfill pass) for vision iter 26 to consider.

### 2026-05-23 — iter 24 — Frame mode: restructure loop per iter-23 meta-review (BS-14 partial close)
User-authorized override of the `≤1 frame per 10` quota (last frame
was iter 19, only 5 iters ago — too soon) to act on iter-23's
meta-review immediately rather than defer to iter 29. The
meta-review's finding was unambiguous: the loop has produced ZERO
new feature surfaces across 22 iterations because the SKILL.md
itself enforces additive bias. Deferring 5 more iters would have
validated the very concern raised. **Challenge-the-focus answers:**
(1) loop's own architecture hadn't been touched since iter 19 frame
(5 iters); PROFILE.md hasn't been amended ever (literal scripture);
no `vision` or `roadmap` concept ever existed. (2) PROFILE.md assumes
the user wants more lessons / better lessons within the L1→L2→L3
ladder — but the user has been shipping feature-grade work in
parallel (mechanics modal), demonstrating by action that they value
new surfaces, not just more cells. (3) New contributor would ask
"why does this loop's SKILL.md make it impossible to ship a
mechanics-modal-class feature?" (4) Yes highest-leverage —
restructuring the loop is meta-leverage compounding over all
future iters. **Changes shipped:** SKILL.md fully rewritten with 6
modes (added `vision`); mandatory adversarial subagent in ship mode
(must pivot or rebut in ≥3 sentences); replaced ship-quota floor
(`≥3 ships per 6`) with vision floor (`≥1 vision per 6`) + evidence
floor (`≥1 evidence per 6`); removed "3 consecutive ships → forced
non-ship" and "multiple of 10 → forced frame" rules (now redundant);
reframed coverage prompt from "what's missing from curriculum?" to
"what user need has no current surface?"; added multi-iter feature
pattern with `[product/feature-scaffold]` → `[product/feature-wire]`
→ `[product/feature-ship]` subtypes for roadmap entries too big for
one atomic iter. New `iter-artifacts/roadmap.md` stub created.
CLAUDE.md commit convention updated with the new subtypes. BS-14
marked partial close with success criterion = adversary pivot rate
≥30% over first 6 ship iters. Validator unchanged (no code touched).
**Learning:** the meta-loop CAN restructure itself, but only when
external (user) authorization overrides the safety quotas. The
quotas were good for preventing drift, bad for enabling intentional
pivots. The new architecture relies more on adversarial signal and
less on rigid floors.

### 2026-05-23 — iter 23 — Audit mode: L1/L2 quality + loop meta-review
User-requested dual audit. Forced non-ship per "no 3 consecutive
ships" rule (iters 20-22 were all ship). Spawned 3 parallel fresh-
eyes subagents (none read SELF-IMPROVE.md): **Agent A** scored 27
syntax lessons (Basics, Arrays, Hash, Modern, Iterators) on a 1-3
L1+L2 rubric; **Agent B** scored 24 (JS Toolbox, Algorithms,
Classes, Async, Advanced); **Agent C** critiqued the loop
architecture itself. **L1/L2 findings:** 51 lessons mean 2.49 out
of 3.00. 5 bottom-quartile flagged (`async/s-promises` 1.38,
`basics/s-strings` 1.75, `basics/s-template` 1.75,
`hash-structures/s-obj-basics` 1.75, `async/s-trycatch` 1.75); 6
more on watchlist. Dominant failure modes: L2 single-blank hand-off
(hint paraphrases answer), L2 repetition (N identical blanks),
basics-L1 Reference rephrasing, async-L1 missing the load-bearing
gotchas. Iterators+Generators and Algorithms clusters are the model
to copy. **Loop meta-review findings:** loop has shipped ZERO new
feature surfaces across all 22 iterations — every "big feature"
predates iter 1 or was human-shipped. Root cause is structural: ship-
quota floor + atomically-commitable requirement + next-mode gradient-
descent handoff + fresh-eyes prompts asking coverage questions instead
of need questions. Agent C's recommendation: hybrid of vision-mode
every 5 iters + mandatory adversarial subagent each ship iter +
removal of ship-quota floor. Two artifacts written:
`iter-artifacts/iter-23-l1-l2-audit.md` (per-lesson scores, tiered
rewrites) and `iter-artifacts/iter-23-loop-meta-review.md` (critique
+ alternative architectures). Validator unchanged (no code touched);
artifacts only. Opens BS-14 (loop additive-bias). Closes BS-08
(audit done; rewrites queued).
**Learning:** the fresh-eyes pattern works exactly as designed when
prompted to look outside the loop's frame — Agent C produced the
most consequential finding of the iter despite (or because of) being
forbidden to read SELF-IMPROVE.md. The loop's own self-narrative was
the bias source.

### 2026-05-23 — iter 22 — Ship mode: s-index-math + dual-coding strategy doc
User-redirect ship — "I find r-l+1 indexing challenging, is there a
specific lesson?" exposed a gap unmet by any existing single lesson.
Survey: s-arr-index (basic indexing) + binary-search (algorithm-
specific midpoint math) + s-heap-ops (tree-specific parent/child) +
s-matrix-neighbors (grid-specific offsets) collectively touched
fragments, but the linear-interval arithmetic (r-l+1, midpoint,
length-N slice, circular modulo) was never extracted as standalone
syntax. Authored `s-index-math` in Algorithms covering 6 idioms with
worked numeric examples. User followup mid-author: "Can you add ASCII
images for visual learners?" — pivoted the Reference from comment-
style to fully diagrammed (arrows, box-drawing chars, indexed
sample arrays) with each idiom getting its own visual block. Per
SKILL.md strategy-doc reciprocity, this is the first systematic use
of dual coding in a lesson, so created `docs/learning-strategies/
dual-coding.md` (Paivio 1971 + Mayer 2009 grounding) and promoted
dual coding from the parking lot to active strategies in the README.
Added BS-13 to track retro-adding ASCII to other structural lessons
(binary-search, p-bfs, p-min-window, p-islands, p-merge-two-sorted,
p-reverse-list, p-min-heap, s-iter-protocol). Single-author flow
(no subagent — one lesson with bespoke ASCII calligraphy doesn't
parallelize). Validator 355→359 (+4 exercises, 0 fail). Extended
algorithms-section-expansion probe to 33/33. **Learning:** two
back-to-back user-redirect ships (iter 21 BS-12, iter 22 BS-13)
validates the SKILL.md veto clause as load-bearing — the queued
artifact (Tier 2) is patient capital, but real-drilling friction
trumps it every time. The directive should sharpen: when user
ships pile up against artifact ships, lean into the friction signal.

### 2026-05-23 — iter 21 — Ship mode: tab-switch state cache closes BS-12
User-redirect ship — paused queued Cluster 1 Tier 2 to fix user-
reported friction: switching to Reference mid-attempt was wiping L1
picks / L2 fills / L3 typing. Mode-selection passed quota easily
(iters 18=audit, 19=frame, 20=ship → 1 ship in last 3). Challenge-
the-focus answers: (1) render-lifecycle / tab-switch behavior never
audited before; (2) "80% phone" assumption still load-bearing — fix
benefits mobile L1/L2 most where switching to Reference for context
is common; (3) new contributor would have asked "why does Reference
look up wipe my answers — bug or feature?"; (4) yes highest-leverage,
losing user input is worse than the BS-11 strict-pass UX gap.
Implementation: module-scope `inProgressCache` keyed on `lesson.id`,
cleared in `selectLesson` when lesson changes. L1 cache holds
`localState` array (selected/locked per question); on render, replays
correct/incorrect/disabled classes + explain panels for any locked
question + calls `maybePassL1()` so a cached pass surfaces ✓ + next
button. L2 desktop/mobile share the cache slot using a `{passed,
values[]}` shape; desktop wires per-input `input` listeners to write
through, mobile uses getter/setter on `passed` + shared `values` array
reference so existing chip-tap/reveal/check write sites are
auto-cache-mirroring. L3 uses `cm.on('change')` + `cm.setValue` on
render. Mock-interview skips the cache (mock should always start
blank). Validator 355/0; new probe `tab-switch-preserves-state.js`
10/10 covers L1 lock-state survival, L2 mobile chip value survival,
L3 editor text survival, cross-lesson cache clearance. Regressions
clean on sr-l2-holds-bucket, sr-reveal-demotes-bucket,
mock-interview-loads, cta-injects-on-l3-pass. **Learning:** user-
reported friction during real drilling beats the queued artifact —
the SKILL.md veto clause "user surfaces a higher-priority friction"
fired exactly as designed. BS-11 (strict-pass legibility) is less
urgent now that users won't lose answers when looking up Reference
mid-attempt to retry.

### 2026-05-23 — iter 20 — Ship mode: Cluster 1 Tier 1 — 6 boilerplate-as-syntax lessons
First ship using the iter 19 framework. Mode-selected ship because §
Next iteration nominated it with a concrete artifact ready
(`iter-artifacts/iter-19-gap-list.md` Cluster 1 Tier 1), veto
conditions not triggered. **Challenge-the-focus answers:** (1) loop
hadn't touched matrix/BFS/DFS/tree/LL/heap *syntax* lessons (now
addressed), storage backend (deferred), PROFILE assumption validity
(deferred to a future frame iter); (2) "80% phone" still load-bearing
— authoring choices favored short L2 blanks and tight L3 challenges;
(3) new contributor would ask "why does Algorithms have 9 lessons
now?" — the answer is on iter 19's blind-spots ledger; (4) yes,
highest-leverage — closes BS-02 partially. **Authored** via 3
parallel general-purpose agents (2 lessons each, fresh-context per
CLAUDE.md sub-agent workflow): grid theme (matrix-neighbors,
bfs-template), tree/heap theme (tree-traversals, heap-ops), LL theme
(ll-traversal, ll-fast-slow). Each agent self-verified via new
`tools/validate-files.js` helper (validates lesson JSON in isolation,
bypassing the manifest/disk parity check that would block
mid-authoring). Orchestrator integrated manifest, ran full validator
(336 → 355 pass, +19 exercises, 0 fail), shipped new durable probe
`algorithms-section-expansion.js` (29/29: manifest contains all 6,
sidebar renders all 6, s-matrix-neighbors title + tabs + no horizontal
overflow at iPhone viewport, other 5 load without error). Regression
spot-check: welcome-banner-dynamic now reads "149 lessons" (143+6,
dynamic count working), sidebar-path-order unchanged for syntax tab.
**Learning:** the parallel-author + per-agent-validator + orchestrator-
integrates pattern worked first-shot for all 3 agents — no iteration,
no retry. The boilerplate-as-syntax framing carried cleanly across
matrix, tree, heap, and LL themes, suggesting the same template will
work for Tier 2 (DFS variants, binsearch, union-find, etc.).

### 2026-05-23 — iter 19 — Frame mode: redesigned the loop to question itself
User-directed frame iteration after observing the loop had been
auto-defaulting to "ship feature inside the current surface" for 17
iterations — it never asked "is the *syllabus* complete?" Spawned 3
parallel fresh-eyes subagents (none read SELF-IMPROVE.md or the
iteration log): (A) internal syllabus audit, (B) external benchmark
via WebSearch across NeetCode 150 / Blind 75 / LC Top Interview 150 /
BFE.dev / GreatFrontend, (C) meta-review of SKILL.md for cognitive
biases. Agent C identified 3 structural biases — "atomically
commitable" forecloses curriculum work, "set the *next* focus sharper
than what you started with" only allows monotonic narrowing, the
diagnose step is scoped by the prior frame so it can't reframe.
Adopted C's recommendations wholesale: SKILL.md now has 5 modes
(ship | audit | coverage | frame | research) with hard quotas (≥3
ships per 6 iters, ≤1 frame per 10, forced frame every 10), a
"Challenge the focus" preamble, a fresh-eyes subagent step for
non-ship modes, an external-research step for coverage mode, and a
nominate-next-mode handoff replacing the old "sharpen the focus"
step. SELF-IMPROVE.md restructured with § Next iteration / § Mode
ledger / § Blind spots ledger (10 entries seeded) / § Last-touched
index / § External references. A+B findings synthesized into
`iter-artifacts/iter-19-gap-list.md` — 6 clusters covering ~50
candidate lessons, ranked by cross-source signal × profile fit.
Validator 336/0 (no code changes). **Learning:** the loop's worst
failure mode was invisible to itself — each individual iter was
reasonable, but the structural prior toward "polish what exists"
kept it from ever asking "is what exists complete?" The meta-fix is
rate-limiting ships, not banning them.

### 2026-05-23 — iter 18 — Wind-down audit; loop paused
Final stop-and-summarize pass per iter 17's directive — no new
features, content, audits, or refactors. Ran the full wind-down sweep:
`node tools/validate-data.js` 336/0 (143 lessons, 327 L2/L3
exercises); all 12 durable iter probes regression-green, 73/73
assertions across iters 2, 3, 4, 9, 10, 11, 12, 13, 14, 15, 16, 17;
commit history clean — 17 atomic, improvement-named commits since
`262380c`; learning-strategies docs in sync (active-recall, spaced-
repetition, desirable-difficulty); parking lot has 1 item, explicitly
triaged Deprioritized in iter 10. Housekeeping note: `tools/cdp/
_iter16-survey.js` is untracked — `_`-prefix flags it as throwaway
from iter 16's mobile cold-survey; left in place since deletion sits
outside the directive's scope. **Loop paused.** Resume only on fresh
user signal (see Current focus criteria).

*(iter 17 trimmed; see git `2d6325d` — Next-CTA injects on fresh L3 pass, closed the "main-viewport vs. drawer" pattern on both fresh-render and in-place update paths.)*

*(iters 1–17 trimmed to keep the log at 10 entries — see git history:
`1903c4e` iter 1; `c02b928` iter 2; `5e18e9a` iter 3; `0c3e61d` iter 4;
`4eaa3c6` iter 5; `d2877d7` iter 6; `8465816` iter 7; `dc41586` iter 8;
`b65df72` iter 9; `7728e0c` iter 10; `56068c7` iter 11; `31ba22b` iter 12;
`8bc5306` iter 13; `dac973e` iter 14; `29a2556` iter 15 data-layer audit
clean + cheatsheet/README 3-track pitch fix; `e542bd0` iter 16 mastered-CTA
prefers due-reviews on mobile; `2d6325d` iter 17 next-CTA injects on L3 pass.)*

## Hypotheses parking lot
*(re-audited every 5 iters; last curated: iter 10)*

- **"Recall-without-prompt" mode** — show only the lesson title and ask
  the user to produce the canonical. Strips prompt scaffolding.
  Documented in active-recall.md candidates. *Deprioritized iter 10:*
  needs new mode UI + content judgment about which titles are
  recognizable enough. Too big for atomic; no user-evidence of demand.
  Revisit if/when a user reports they want this kind of unprompted
  recall.

## Avoid (learned dead-ends)
*(re-audited every 5 iters; last curated: iter 10)*

- **Bucket promotion gate keyed on personal-best time.** (Was in the
  parking lot through iter 9.) The idea was: L3 holds the bucket
  instead of advancing if the pass took 5x the personal-best time.
  Problem: `state.bestTimes` is only populated during Mock Interview
  mode. Regular L3 passes (the vast majority) have no time baseline
  to compare against. The mechanism would fire for ~1% of L3 attempts —
  not worth the engineering. Revisit only if a per-attempt time
  baseline gets added for non-mock L3.
- **L3 timeout-as-failure.** (Was in the parking lot through iter 9.)
  The idea was: silent abandonment of a due L3 should demote the
  bucket. Problem: distinguishing "user gave up" from "user got
  pulled into a meeting" requires a threshold + state tracking that's
  fragile. High mis-fire risk against a sympathetic user (someone with
  intermittent attention). The Reveal-on-due demote (iter 3) already
  captures the explicit "I can't recall" signal cleanly. Revisit only
  if we get evidence that silent abandonment is a common failure mode.
