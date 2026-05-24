# Self-Improve Directive

> Read alongside [PROFILE.md](PROFILE.md). Every change must trace back to
> making that user more effective. This file evolves — the loop updates
> § Next iteration, § Mode ledger, § Blind spots ledger, § Last-touched
> index, § External references, § Current focus, § Iteration log, and
> the parking lots after each pass.

## Next iteration
- **Suggested mode:** ship
- **Signal pointing there:** iter 19 (frame) produced [iter-artifacts/iter-19-gap-list.md](iter-artifacts/iter-19-gap-list.md). Iter 20 shipped **Cluster 1 Tier 1** (6 boilerplate-as-syntax lessons). **Cluster 1 Tier 2** is the natural next ship — 7 more lessons completing the cluster: `s-matrix-bounds`, `s-dfs-recursive-template`, `s-dfs-iter-template`, `s-ll-node-shape`, `s-binsearch-template`, `s-union-find`, `s-grid-init`. Same parallel-author pattern (3 agents × 2-3 lessons) should work cleanly now that the template is proven.
- **Veto condition:** skip ship if (a) user redirects to Cluster 4 (Modern Syntax, 5 lessons) or Cluster 5 (Hash/Set ergonomics, 3 lessons) — both feasible alternative ship targets, (b) rolling-6-window already has 3 ships at iter 21 (would force audit/coverage; current count: iters 18=audit, 19=frame, 20=ship → only 1 ship in last 3, so iter 21 ship is well within quota), or (c) user surfaces a higher-priority friction during real drilling.

## Current focus
- **Status: ACTIVE** — syllabus completeness lens, Cluster 1 of the iter-19 gap list. Tier 1 shipped iter 20 (149 lessons, +19 exercises). Tier 2 queued for iter 21.
- **Primary lens (active until iter 25 or BS-02 fully closes):** Syllabus completeness — keep closing the Syntax/Algorithms boilerplate gap, then re-evaluate against Clusters 3/4/5 (JS-specific + Modern + Hash idioms) before the cross-source Cluster 2 work.
- **Follow-up noted iter 20:** the 6 new lessons are in the manifest + sidebar but NOT in `STARTER_PATH`. Decide in a future iter whether/where to insert them in the recommended sequence (probably grouped after `s-queue-pattern` since that's the closest topical neighbor). Not blocking — lessons are reachable via browse mode.

## Mode ledger
*(append-only; enforces the "no 3 consecutive ships" + "≥3 ships per rolling 6" rules mechanically)*

| Iter | Mode | One-line outcome |
|---|---|---|
| 1–17 | ship | See § Iteration log + git history `262380c..2d6325d` |
| 18 | audit | Wind-down audit; 12 probes regression-green, validator 336/0, loop paused |
| 19 | frame | Redesigned SKILL.md (mode rotation + fresh-eyes subagent + research lens + nominate-next-mode), restructured SELF-IMPROVE.md (Next iteration, Mode ledger, Blind spots ledger, Last-touched index, External references), spawned 3 fresh-eyes subagents producing `iter-artifacts/iter-19-gap-list.md` |
| 20 | ship | Cluster 1 Tier 1: 6 boilerplate-as-syntax lessons in Algorithms section via 3 parallel author agents (s-matrix-neighbors, s-bfs-template, s-tree-traversals, s-heap-ops, s-ll-traversal, s-ll-fast-slow). Validator 336→355 (+19 exercises, 0 fail). New durable probe `algorithms-section-expansion.js` (29/29). Regressions clean on welcome-banner-dynamic + sidebar-path-order. New helper `tools/validate-files.js` for in-isolation lesson validation |

## Blind spots ledger
*(things the loop has historically not questioned; promote to Current focus or Parking lot when actioned)*

- **[BS-01] Syllabus completeness vs. external rubrics** — never benchmarked against canonical lists. Iter 19 measured: NeetCode 150 ~52% covered, Blind 75 ~80%, LC Top Interview 150 ~37%. *Seeded iter 19; iter 20 ship consumes the Cluster 2 portion of the gap list.*
- **[BS-02] Boilerplate-as-syntax gap** — algorithmic scaffolding buried inside Patterns lessons; never extracted as standalone Syntax lessons. *Partially closed iter 20: Tier 1 shipped (matrix-neighbors, bfs-template, tree-traversals, ll-traversal, ll-fast-slow, heap-ops). Tier 2 remaining for iter 21: matrix-bounds, dfs-recursive-template, dfs-iter-template, ll-node-shape, binsearch-template, union-find, grid-init.*
- **[BS-03] JS-specific concepts under-covered** — `structuredClone`, `AbortController`, `Promise.race/any/allSettled`, microtask vs macrotask ordering quizzes, hoisting/TDZ, `==` coercion, `WeakMap`/`WeakRef`. *Seeded iter 19; queue for coverage iter ~22.*
- **[BS-04] Frontend utility lessons missing** — DOM traversal, event delegation, `classNames()`, retry-with-backoff, promise concurrency pool, AbortController-cancellable promise, deep equality. *Seeded iter 19; queue for coverage iter (Applied track expansion).*
- **[BS-05] Modern syntax gaps** — rest params, computed/shorthand keys, logical assignment (`||=`, `??=`, `&&=`), ES2022+ array variants (`findLast`, `toSorted`, `toReversed`). *Seeded iter 19; queue for ship iter ~22.*
- **[BS-06] L1→L2→L3 ladder treated as axiomatic** — no iter has questioned whether the ladder shape fits all topic types (system design likely needs a different shape; quick conceptual quizzes might want L1-only). *Seeded iter 19; revisit in a future frame iter (~iter 30).*
- **[BS-07] PROFILE.md assumption decay** — "80% phone" was written at project start and never re-validated. Could be more/less phone now after months of actual use. *Seeded iter 19; revisit in a future frame iter (~iter 30) when usage data is available.*
- **[BS-08] Content quality vs. content validity** — validator passes ≠ lessons are well-authored. No probe samples "is this explanation good? Are L1 distractors plausible? Is canonical idiomatic?" *Seeded iter 19; queue for audit iter.*
- **[BS-09] Tooling debt in `tools/cdp/`** — 12+ probes accumulated; never audited for staleness, DRY violations, or coverage. Schema `__v` not bumped despite `mockHistory` field added iter 13. `_iter16-survey.js` left untracked across iters 16–19. *Seeded iter 19; queue for audit iter.*
- **[BS-10] Storage backend (localStorage-only)** — cross-device sync would be a strong win for the 80%-phone profile if scoped tight (anonymous-first, opt-in login). User flagged iter 19 discussion; deferred for now to ship the syllabus work first. *Seeded iter 19; queue for a future frame iter to decide scope before any code.*
- **[BS-11] "I passed but nothing saved" UX gap** — user-reported 2026-05-23 after iter 20. Investigation via CDP probes confirmed localStorage save/load works correctly on both localhost and the live Pages URL. Actual cause: pass conditions are strict — L1 requires ALL questions correct in one session (any wrong click locks that question; user must hit Retry), L2 requires every exercise's every blank correct, L3 requires exact output match. Navigation state (lastLessonId, lastTab, sidebarTrack, welcomed) saves on nav so the user sees "something" persisted, but `progress` stays empty until a full pass fires `markPassed()`. The single feedback message "Some answers were off — hit Retry to start over" is the only signal, and it's easy to miss when individual questions show "✓ Correct" mid-session. *Candidate product/ux fixes: (a) persistent per-session score chip ("2/3 correct — Retry for full pass"); (b) post-attempt summary surface; (c) loosen strict-pass to ≥N% with a note that the SR bucket still requires full mastery; (d) different copy on the "✓ Correct" per-question feedback to make clear it's per-question, not the lesson pass. Queue for iter 21+ as a [product/ux] candidate — discuss with user before implementing since (c) touches the SR mechanism's core assumption.*

## Last-touched index
*(forces audit-mode selection to be data-driven; bumped at Step 6 of every iteration)*

| Area | Iter last touched |
|---|---|
| Skill / SELF-IMPROVE structure | 19 |
| Algorithms section (boilerplate-as-syntax expansion) | 20 |
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

### 2026-05-23 — iter 14 — Audit found Applied-track UI drift; fixed
The meta-audit scoped for iter 14 immediately surfaced three places
where `lesson.track === 'syntax' ? X : 'patterns-default'` excluded
the applied track: (1) the lesson header pill labeled applied lessons
as "Pattern"; (2) the Today's plan modal label did the same; (3) the
stats modal had `masteredPatterns/totalPatterns` and
`masteredSyntax/totalSyntax` but NO applied row — 20 applied lessons of
progress effectively invisible in the user's progress dashboard. Added
a `TRACK_PILLS` module-scope lookup (`{ syntax, patterns, applied } →
{ cls, label }`) as the single source of truth for track display
metadata; both surfaces now read from it. Added `.pill-applied`
amber CSS class so the third track has its own visual identity (was
previously borrowing the purple Pattern pill). Restructured the stats
modal to a 2-then-3 column grid so all three tracks show as peers.
Validator 336/0; new probe `tools/cdp/applied-track-visibility.js`
(6/6) asserts the header pill on a-debounce reads "Applied" and
`[data-track-stat]` panels for all three tracks render. All 8 prior
probes still pass. **Learning:** the meta-audit lens was load-bearing
— each individual drift point would have been easy to miss in isolation,
but reading recent commits together while looking for the same pattern
made the cluster obvious.

### 2026-05-23 — iter 13 — Mock Interview trend chip (last-5 attempts)
PROFILE.md success criterion #3 is "Mock interview personal-bests trend
down over weeks." A trend can't be seen from a single best-time pill —
only the sequence shows whether the user is improving, plateaued, or
regressing. Added `state.mockHistory: { lessonId: [ms, ms, ...] }`
capped at MOCK_HISTORY_MAX=5 entries (every successful mock pushes; old
ones evict FIFO). Persisted alongside `bestTimes`. On the L3 surface,
when history has ≥2 entries, a muted chip renders the times oldest→
newest (`0:42 · 0:38 · ★0:32 · 0:34 · 0:29`) with the PB cell starred.
Schema is forward-compatible — added field, no `__v` bump. Validator
336/0; new probe `tools/cdp/mock-history-trend.js` (7/7) covers D
(single attempt → no chip), A (3 attempts → chip with 3 cells), B (PB
cell starred), C (history capped at 5 after 6 attempts). All 7 prior
probes still pass. **Learning:** post-iter-12-crash-fix, mock-related
iterations get cheap traction — the surface was broken so long that
several small wins are still on the table without invention.

### 2026-05-23 — iter 12 — Mock Interview was crashing (null-deref) — fixed
Desktop survey discovered Mock Interview was completely broken: clicking
the Mock button filled the lesson shell with "Could not load lesson:
Cannot read properties of null (reading 'addEventListener')". Root
cause: `renderL3` unconditionally wired the `[data-action="hint"]`
button at line 1657, but the hint button is omitted from the markup
when `isMock`. The adjacent diff and reveal buttons were properly
null-guarded; hint was the one that slipped through. PROFILE.md success
criterion #3 ("Mock interview personal-bests trend down") was literally
untestable while this bug existed — and prior iterations missed it
because no probe ever started a mock. Fix: match the diff/reveal guard
pattern with a single `if (hintBtn) { ... }` wrapper. Bonus tooling
fix: `tools/cdp/lib.js` reload() now passes `ignoreCache: true` —
without this, the local server's no-cache-headers + Chrome's heuristic
caching meant probes were testing stale app.js between runs. Validator
336/0; new durable probe `tools/cdp/mock-interview-loads.js` (9/9)
covers start (no crash, banner + end-mock + drill editor present,
hint button absent), pass (bestTimes recorded, mock cleared), and
cleanup (hint button reappears after end). All 6 prior probes still
pass. **Learning:** the loop's value-add over the user is finding
bugs in features the user might not exercise often. A "least-touched"
lens (which PROFILE.md success criterion hasn't been improved?) is a
good way to surface those.

### 2026-05-23 — iter 11 — Sidebar lessons sort by STARTER_PATH index in path mode
The iter 10 parking-lot audit handed iter 11 a concrete ship-now: in
path mode, the sidebar's intra-section order tracks the manifest, not
the path, so HASH STRUCTURES read "22, 20, 21" because Map & Set,
Object literals, keys/values/entries appeared in that manifest order
while their global path steps were 22, 20, 21. Added one sort:
`lessons.sort((a,b) => STARTER_PATH.indexOf(a.id) - STARTER_PATH.indexOf(b.id))`
when path mode is on; sections naturally appear in the order of their
first path step too (because `[...new Set(...)]` preserves first-
occurrence order). Non-path mode unchanged. Also added two test
affordances (`data-lesson-id` on lesson-links, `class="lesson-label"`
on the label span) so future probes can target sidebar entries cleanly.
Validator 336/0; new probe `tools/cdp/sidebar-path-order.js` (6/6)
confirms monotonic top-to-bottom step ordering AND the specific HASH
STRUCTURES case (s-obj-basics → s-obj-iter → map-set) AND that non-path
mode shows no step prefixes. All 5 prior probes still pass.
**Learning:** test affordances are cheap to add (1-line per element)
and pay back across iterations — the probe was easy to write once
selectors were stable.

*(iters 1–10 trimmed to keep the log at 10 entries — see git history:
`1903c4e` iter 1; `c02b928` iter 2; `5e18e9a` iter 3; `0c3e61d` iter 4;
`4eaa3c6` iter 5; `d2877d7` iter 6; `8465816` iter 7; `dc41586` iter 8;
`b65df72` iter 9; `7728e0c` iter 10 welcome banner refresh + parking-lot
curation — dynamic count + 3-track pitch.)*

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
