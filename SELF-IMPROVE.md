# Self-Improve Directive

> Read alongside [PROFILE.md](PROFILE.md). Every change must trace back to
> making that user more effective. This file evolves — the loop updates
> § Next iteration, § Mode ledger, § Blind spots ledger, § Last-touched
> index, § External references, § Current focus, § Iteration log, and
> the parking lots after each pass.

## Next iteration
- **Suggested mode:** vision OR ship (see options)
- **Signal pointing there:** Iter 24 just restructured the loop architecture (added vision mode, mandatory adversarial subagent in ship, removed ship-quota floor — see iter-23 meta-review). The new SKILL.md says vision floor = ≥1 vision iter per rolling 6. Last vision iter never happened (vision mode is iter 24's invention), so iter 25 is a natural first vision iter to populate `iter-artifacts/roadmap.md` with the first 3 big-feature candidates. Alternative: iter 25 ship to consume the still-queued iter-23 L1/L2 Tier 1 rewrites (5 bottom-quartile lessons) — adversarial subagent now mandatory will test the new mechanism in practice.
- **Veto condition:** skip vision if (a) user wants to validate the new adversarial-subagent mechanism on a real ship iter first, (b) user wants to ship the long-queued L1/L2 Tier 1 rewrites or Cluster 1 Tier 2 before letting vision generate new candidates, or (c) user surfaces another in-flight friction.

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

## Blind spots ledger
*(things the loop has historically not questioned; promote to Current focus or Parking lot when actioned)*

- **[BS-01] Syllabus completeness vs. external rubrics** — never benchmarked against canonical lists. Iter 19 measured: NeetCode 150 ~52% covered, Blind 75 ~80%, LC Top Interview 150 ~37%. *Seeded iter 19; iter 20 ship consumes the Cluster 2 portion of the gap list.*
- **[BS-02] Boilerplate-as-syntax gap** — algorithmic scaffolding buried inside Patterns lessons; never extracted as standalone Syntax lessons. *Partially closed iter 20: Tier 1 shipped (matrix-neighbors, bfs-template, tree-traversals, ll-traversal, ll-fast-slow, heap-ops). Tier 2 remaining for iter 21: matrix-bounds, dfs-recursive-template, dfs-iter-template, ll-node-shape, binsearch-template, union-find, grid-init.*
- **[BS-03] JS-specific concepts under-covered** — `structuredClone`, `AbortController`, `Promise.race/any/allSettled`, microtask vs macrotask ordering quizzes, hoisting/TDZ, `==` coercion, `WeakMap`/`WeakRef`. *Seeded iter 19; queue for coverage iter ~22.*
- **[BS-04] Frontend utility lessons missing** — DOM traversal, event delegation, `classNames()`, retry-with-backoff, promise concurrency pool, AbortController-cancellable promise, deep equality. *Seeded iter 19; queue for coverage iter (Applied track expansion).*
- **[BS-05] Modern syntax gaps** — rest params, computed/shorthand keys, logical assignment (`||=`, `??=`, `&&=`), ES2022+ array variants (`findLast`, `toSorted`, `toReversed`). *Seeded iter 19; queue for ship iter ~22.*
- **[BS-06] L1→L2→L3 ladder treated as axiomatic** — no iter has questioned whether the ladder shape fits all topic types (system design likely needs a different shape; quick conceptual quizzes might want L1-only). *Seeded iter 19; revisit in a future frame iter (~iter 30).*
- **[BS-07] PROFILE.md assumption decay** — "80% phone" was written at project start and never re-validated. Could be more/less phone now after months of actual use. *Seeded iter 19; revisit in a future frame iter (~iter 30) when usage data is available.*
- **[BS-08] Content quality vs. content validity** — validator passes ≠ lessons are well-authored. *Audited iter 23 (see `iter-artifacts/iter-23-l1-l2-audit.md`): 51 syntax lessons scored, mean 2.49/3.00. 5 bottom-quartile lessons identified for L1+L2 rewrite (`async/s-promises` 1.38, `basics/s-strings` 1.75, `basics/s-template` 1.75, `hash-structures/s-obj-basics` 1.75, `async/s-trycatch` 1.75). 6 more on watchlist. Audit closed; rewrites queued for iter 24+ Tier 1 ship. Outstanding question: should the threshold move to ≥2.00 to catch the watchlist tier?*
- **[BS-09] Tooling debt in `tools/cdp/`** — 12+ probes accumulated; never audited for staleness, DRY violations, or coverage. Schema `__v` not bumped despite `mockHistory` field added iter 13. `_iter16-survey.js` left untracked across iters 16–19. *Seeded iter 19; queue for audit iter.*
- **[BS-10] Storage backend (localStorage-only)** — cross-device sync would be a strong win for the 80%-phone profile if scoped tight (anonymous-first, opt-in login). User flagged iter 19 discussion; deferred for now to ship the syllabus work first. *Seeded iter 19; queue for a future frame iter to decide scope before any code.*
- **[BS-11] "I passed but nothing saved" UX gap** — user-reported 2026-05-23 after iter 20. Investigation via CDP probes confirmed localStorage save/load works correctly on both localhost and the live Pages URL. Actual cause: pass conditions are strict — L1 requires ALL questions correct in one session (any wrong click locks that question; user must hit Retry), L2 requires every exercise's every blank correct, L3 requires exact output match. Navigation state (lastLessonId, lastTab, sidebarTrack, welcomed) saves on nav so the user sees "something" persisted, but `progress` stays empty until a full pass fires `markPassed()`. The single feedback message "Some answers were off — hit Retry to start over" is the only signal, and it's easy to miss when individual questions show "✓ Correct" mid-session. *Candidate product/ux fixes: (a) persistent per-session score chip ("2/3 correct — Retry for full pass"); (b) post-attempt summary surface; (c) loosen strict-pass to ≥N% with a note that the SR bucket still requires full mastery; (d) different copy on the "✓ Correct" per-question feedback to make clear it's per-question, not the lesson pass. Queue for iter 22+ as a [product/ux] candidate — discuss with user before implementing since (c) touches the SR mechanism's core assumption.*
- **[BS-12] Tab-switch wipes in-flight work** — user-reported 2026-05-23 mid-iter-21 investigation. Switching from L1/L2/L3 to Reference and back rebuilt the renderX DOM from scratch, losing any clicked L1 answers, typed L2 blanks, or L3 editor code. Root cause: each `renderX` initialized local state fresh (`localState = qs.map(...)`, `exerciseState = exercises.map(...)`, fresh CodeMirror instance) with no persistence layer between renders. *Closed iter 21 by adding `inProgressCache` keyed on `lesson.id`, cleared in `selectLesson` when lesson changes, restored on every renderX. Probe `tab-switch-preserves-state.js` 10/10 verifies all three tiers + cross-lesson cache clear.*
- **[BS-13] Visual encoding under-exploited across existing lessons** — user-surfaced 2026-05-23 during iter 22 (visual-learner request). Most existing lessons rely on code-only references, but structural concepts (indexing, traversal, window-sliding, neighbor offsets, parent/child math, recursion order) memorize faster with ASCII diagrams alongside the formula. `s-index-math` (iter 22) is the proof-of-concept; new `docs/learning-strategies/dual-coding.md` formalizes the principle. *Candidate retro-add targets in priority order: binary-search, p-bfs (tree level-order trick), p-min-window (sliding window animation), p-islands (matrix DFS), p-merge-two-sorted (dummy-head shape), p-reverse-list (pointer hop), p-min-heap (sift-up/sift-down trace), s-iter-protocol (yield flow). Each is a 5-15 line diagram added to the lesson's `reference.code` string — atomically commitable. Queue as a [product/content] audit-and-add ship for iter 23+ once Cluster 1 Tier 2 lands, OR consume in parallel as a separate ship if user flags more friction.*
- **[BS-14] Loop is structurally biased toward additive UX work — has shipped ZERO new feature surfaces** — surfaced iter 23 by fresh-eyes meta-review subagent (see `iter-artifacts/iter-23-loop-meta-review.md`). Across all loop iterations (1-22), the per-iteration classification is: 0 new feature surfaces, 2 content additions, ~10 UX refinements, 2 bug fixes, 2 tooling, 3+ meta. **Partial close iter 24:** SKILL.md restructured per the meta-review's Part 4 recommendation. Added `vision` mode (≥1 per rolling 6 — replaces the old "multiple of 10 → frame" rule as the periodic-reframe trigger). Added mandatory adversarial subagent in every ship iter (must pivot or rebut in ≥3 sentences). Removed the ship-quota floor + the "3 consecutive ships → forced non-ship" rule. Reframed coverage prompt from "what's missing from curriculum?" to "what user need has no current surface?" Added multi-iter feature pattern (`[product/feature-scaffold]`/`feature-wire`/`feature-ship`) so roadmap entries too big for one iter can land. **Success criterion (validates the close):** adversary pivot rate ≥30% over the first 6 ship iters under the new architecture (iters 25-30ish). If pivot rate stays below 30%, the adversarial step has become a rubber-stamp and the loop is still stuck — escalate to a fresh frame iter.
- **[BS-14] Lesson `description` is technique-flavored, not problem-flavored** — user-surfaced 2026-05-23 while evaluating the Conversation tab prototype (`p-longest-sub`). Current `description` for Patterns/Applied lessons reads like solution metadata ("Sliding window with a Set: expand the right edge…") which belongs on Reference. The Conversation tab simulates an interview but never shows the user the actual problem statement first, so "Restate & clarify" asks the user to restate something they were never shown. *Fix: add a new `problem` field (interview-style statement with example + constraints) and render it under the lesson title, visible on every tab. `description` stays as sidebar/search metadata — no churn across the other 142 lessons. L3 prompts can shrink to just the action ("Implement it. Log …") since the problem lives elsewhere. Schema-only addition. Queue as the next [product/content] + [engineering/refactor] ship for the Conversation-tab arc; templatize across the 99 Patterns/Applied lessons after the first 2-3 prove the format.*

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
| Roadmap mechanism (`iter-artifacts/roadmap.md`) | 24 |
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

### 2026-05-23 — iter 17 — Next-CTA injects on fresh L3 pass
Iter 16 added the "Review N due → / Next lesson →" CTA in the header
on mastered lessons, but only on a fresh `renderLesson()`. Audit
revealed the same "hidden behind drawer" problem on the FIRST L3
pass: `markPassed` → `updateLessonHeaderInPlace` was adding the
Mastered pill but NOT the CTA row, so the user passed L3, saw the
success message, and had no inline next action until they navigated.
Extended `updateLessonHeaderInPlace` to inject the same CTA row (with
the same review-priority logic from iter 16) when transitioning to
mastered. Marked both CTA rows with `[data-cta-row]` for dedup +
testability. Validator 336/0; new probe
`tools/cdp/cta-injects-on-l3-pass.js` (4/4) confirms no CTA before
pass, row present after pass with correct primary label, mastered
pill preserved. Iter 16 probe still passes 5/5. **Learning:** the
"main-viewport vs. drawer" pattern is now closed across both the
fresh-render path AND the in-place update path. After 17 iterations,
the marginal find is narrower each pass — time to stop and let the
user actually use the app.

### 2026-05-23 — iter 16 — Mastered-lesson CTA prefers due reviews
Fresh cold-survey at mobile viewport, mid-journey state (15 mastered,
4 overdue reviews). The lesson header on a mastered lesson primary-
CTA'd "Next lesson: Numbers & Math →" while the user had 4 reviews
waiting — retention beats new content per dailyPlan's own ordering,
but the UI pointed at new content. The sidebar Review badge surfaces
the right action but is invisible on mobile until the drawer opens.
Fix: when on a mastered lesson AND `dueReviewIds().length > 0`,
promote "🕒 Review N due →" to primary (delegating to the same
sidebar click handler so the device-calibrated L2/L3 routing stays
consistent) and demote "Next lesson" to secondary. No due reviews →
original behavior unchanged. Validator 336/0; new probe
`tools/cdp/mastered-cta-prefers-review.js` (5/5). Recent probes
regression-clean. **Learning:** "main-viewport vs. drawer" is a
consistent friction theme on mobile — likely more instances exist.

### 2026-05-23 — iter 15 — Data-layer audit: clean; fix adjacent stale prose
Audited every selection function (`dueReviewIds`, `topWeakLessonId`,
`dailyPlan`, `starterPathNextId`, `nextLessonId`, `prevLessonId`,
`pickShuffleReview`) for the same third-track exclusion pattern iter 14
found in the UI. **Result: 0 drift.** All seven are either track-
agnostic where appropriate or track-exclusive by design (path / mock-
random-pick are intentionally syntax+patterns-only per the explicit
"Applied Problems are OUTSIDE the linear path" comment). The data
layer is genuinely converged.

Found one adjacent drift while surveying: `generateCheatsheet` header
line emitted "*syntax fundamentals and canonical interview patterns*"
— same stale-prose pattern as the iter-10 welcome banner, missing
the Applied Problems track. Body iteration was already correct (all
three Track A/B/C sections render). README tagline had the same issue.
Both fixed with one-line edits — same template as iter 10. Validator
336/0; new probe `tools/cdp/cheatsheet-track-pitch.js` (6/6) asserts
the header pitch mentions all three tracks AND the body still emits
Track A/B/C sections. All 9 prior probes still pass (61 assertions
total). **Learning:** two focused audits in a row closed the third-
track theme cleanly. The loop should now widen its lens — there's no
more obvious drift to chase here.

*(iters 1–14 trimmed to keep the log at 10 entries — see git history:
`1903c4e` iter 1; `c02b928` iter 2; `5e18e9a` iter 3; `0c3e61d` iter 4;
`4eaa3c6` iter 5; `d2877d7` iter 6; `8465816` iter 7; `dc41586` iter 8;
`b65df72` iter 9; `7728e0c` iter 10; `56068c7` iter 11; `31ba22b` iter 12;
`8bc5306` iter 13; `dac973e` iter 14 Applied-track UI drift fix +
TRACK_PILLS lookup + .pill-applied amber class + stats modal 3-col grid.)*

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
