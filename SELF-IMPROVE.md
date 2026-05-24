# Self-Improve Directive

> Read alongside [PROFILE.md](PROFILE.md). Every change must trace back to
> making that user more effective. This file evolves — the loop updates the
> Current focus, Hypotheses, and Avoid sections after each iteration.

## Current focus (this iteration)
- **Status: PAUSED** since iter 18 (2026-05-23). The loop shipped 17
  improvement iterations + 1 wind-down audit. Marginal value per
  iteration was trending down — each new finding was narrower than the
  last. Stop now, let the user drill against what's been built, and
  resume only with fresh signal from real usage.
- **Re-engagement criteria** (any one of these resumes the loop):
  1. User reports a specific friction during a real drill session
     ("X is still painful on mobile", "Y doesn't surface when I expect
     it", "Z feature crashes when…").
  2. User reports a PROFILE.md success criterion isn't moving (mock
     PBs flat over weeks, mastered lessons slipping past SR, friction
     between "20 free minutes" and "drilling" feels non-zero).
  3. User wants to attack a parking-lot item or revive an Avoid entry
     with new evidence.
  4. User asks the loop to expand into a new area (content, pedagogy,
     infra) not currently scoped.
- **When resuming:** replace this block with a fresh Primary lens +
  Hypothesis to test, drawn from whatever the user surfaces. Don't
  invent a focus — wait for signal.

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
- Atomic commits — one improvement per commit, clear message.
- Don't edit lesson content unless the directive explicitly makes lessons the
  focus this iteration.
- Preserve backwards-compatible `localStorage` schema (`jsdrill.progress.v1`).
- Mobile responsiveness must not regress — invoke the `browser-test` skill
  (or copy `tools/cdp/template.js`) to drive a headless Chrome at iPhone
  viewport + coarse pointer when touching UI. The shared lib at
  `tools/cdp/lib.js` bootstraps server + Chrome and keeps scenario scripts
  short.

## Iteration log (newest first, keep last 10)

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

### 2026-05-23 — iter 10 — Welcome banner refresh + parking-lot curation
The "76 lessons" banner staleness has been flagged since iter 1 but no
iteration touched the welcome surface, so it kept rolling forward.
Iter 10 audited the parking lot directly: shipped #2 (banner: dynamic
count + three-track pitch — now reads "143 lessons across syntax,
interview patterns, and applied problems"), marked #3 done implicitly
(removed), moved #4 (bucket-promotion gate) and #5 (L3-timeout-as-
failure) to **Avoid** with reasoning — both had clear leverage-vs-risk
problems, leaving them in the lot was holding the loop hostage to
items the analysis already disqualifies. Parking lot net: 6 → 2
entries (sidebar ordering + recall-without-prompt). Validator 336/0;
new probe `tools/cdp/welcome-banner-dynamic.js` asserts 6 facts about
the banner (dynamic count, no hardcoded "76", three tracks mentioned).
**Learning:** the parking lot drifts into a passive backlog without
periodic curation — explicit "Avoid" + "deprioritized" tags force the
loop to either ship an item or admit why not.

### 2026-05-23 — iter 9 — Weak-spot visibility (button count + plan ordering)
Stress-surveyed under realistic-but-unhappy state (40 mastered, 15
overdue reviews, 5 reveals, 3 weakness misses). Two findings, both
about weak-spot legibility: (1) the `⚠️ Weak` sidebar button had no
count while `🕒 Review (15)` did — inconsistent affordance; (2) the
`dailyPlan` added the path BEFORE the weak entry, so a lesson that's
both weak and on-path got labeled `next on path` instead of the more
actionable `weak spot`. Fixed both: added a count span (parallel to
review-btn); reordered dailyPlan so weak precedes path so dedup
promotes the weak label. Validator 336/0; new probe
`weak-spot-visibility.js` confirms 3 scenarios (count, hidden, weak-on-
path labeling). **Learning:** stress-surveying under a seeded
unhappy-path state surfaces UX inconsistencies that happy-path probes
miss — worth keeping in the technique toolbox.

*(iters 1–8 trimmed to keep the log at 10 entries — see git history:
`1903c4e` iter 1; `c02b928` iter 2; `5e18e9a` iter 3; `0c3e61d` iter 4;
`4eaa3c6` iter 5; `d2877d7` iter 6; `8465816` iter 7; `dc41586` iter 8
2nd L2 for 3 syntax + 1 applied, syntax track fully built at ≥2 L2.)*

## Hypotheses parking lot
*(curated iter 10; sidebar-ordering shipped iter 11)*

- **"Recall-without-prompt" mode** — show only the lesson title and ask
  the user to produce the canonical. Strips prompt scaffolding.
  Documented in active-recall.md candidates. *Deprioritized iter 10:*
  needs new mode UI + content judgment about which titles are
  recognizable enough. Too big for atomic; no user-evidence of demand.
  Revisit if/when a user reports they want this kind of unprompted
  recall.

## Avoid (learned dead-ends)

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
