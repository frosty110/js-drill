# Self-Improve Directive

> Read alongside [PROFILE.md](PROFILE.md). Every change must trace back to
> making that user more effective. This file evolves — the loop updates the
> Current focus, Hypotheses, and Avoid sections after each iteration.

## Current focus (this iteration)
- **Primary lens:** *Close the loss-side of the SR gradient.* Iterations 1
  and 2 fixed the win-side of spaced-repetition for mobile: L2 on a due
  lesson now holds the bucket, L3 still advances. But the loss-side is
  still no-op — a failed L2/L3 on a due review just leaves the interval
  where it was, so a user who's clearly forgotten a pattern still gets
  the same long interval next time. Anki/SM-2 pulls the interval shorter
  on failure; this app doesn't.
- **Hypothesis to test:** Demoting the SR bucket (or resetting to bucket 0)
  on a failed L2/L3 attempt against a due lesson makes the schedule
  responsive to actual recall strength rather than a one-way ratchet.
  Open question — what counts as "failed enough" to demote? An L3 timeout?
  Reveal-then-pass? N misses before pass? Worth a small ambiguity-pass
  before coding.
- **Out of scope this iteration:** Mock Interview mode (desktop-only by
  design), adding new lessons, redesigning the three-track taxonomy,
  changing the L1→L2→L3 *core* structure. New strategy docs are in scope
  only if the feature embodies one not yet documented.

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

### 2026-05-23 — iter 2 — L2 holds the SR bucket on due lessons
`scheduleReview` now accepts `{ advance }`; `markPassed` calls it with
`advance: false` when L2 passes on a due lesson, holding the interval
bucket but resetting `dueAt` by the current interval. L3 still advances.
This closes the loop iter 1 opened: mobile users can drill due reviews on
L2 and have them actually leave the due list, but the 1d → 30d ladder is
still gated on L3 — so they can't inflate intervals from a phone without
proving free recall. Embodied **desirable difficulty** at the SR layer
(grading the win by test rigor) and updated spaced-repetition.md +
desirable-difficulty.md to match. Validator 327/0; new durable probe at
`tools/cdp/sr-l2-holds-bucket.js` confirms: interval held at 1d, dueAt
+1d, review badge clears. **Learning:** the natural next question
surfaced cleanly — the loss-side is still no-op. A failed L2/L3 on a due
review should pull the interval *shorter*, not just leave it. That's
iter 3.

### 2026-05-23 — iter 1 — Device-calibrated Review CTA
Cold-surveyed the entry flow. Top friction for an 80%-mobile rusty engineer
was that the 🕒 Review button — the primary spaced-repetition CTA — forced
L3 regardless of device, dropping phone users into a blank CodeMirror editor
on a phone keyboard (direct PROFILE.md violation). Changed the click handler
to route to L2 on `(pointer: coarse)` devices, L3 otherwise — one ternary,
no schema change. Embodied **desirable difficulty**: keep the recall demand
high, strip the mechanical friction that doesn't load cognitive effort.
Created `docs/learning-strategies/desirable-difficulty.md`, cross-referenced
from active-recall. Validator 327/0; inline mobile CDP probe confirmed
landing on L2 with coarse pointer emulated. **Learning:** the diagnosis
quickly surfaced a second, deeper issue — L2 doesn't advance SR — which the
fix doesn't close. That's iteration 2's lens.

## Hypotheses parking lot

- **"Recall-without-prompt" mode** — show only the lesson title and ask the
  user to produce the canonical. Strips prompt scaffolding. Mentioned in
  active-recall.md candidates.
- **Welcome banner says "76 lessons"** but the app now ships 143. Tiny
  copy-fix candidate; not urgent enough to bump higher-leverage work.
- **Lesson L1/L2 density audit** — PROFILE.md says ≥3 L1 + ≥2 L2 per lesson.
  No data on current distribution. Could be a future content-quality lens.
- **L2-hold visibility.** A user who passes L2 on a due lesson today sees no
  explicit confirmation that the SR clock pushed forward (just the standard
  "✓ L2 passed."). A small "Next review: in 1d" affordance after pass would
  turn an invisible reward into a visible commitment device — same parking-
  lot idea as the spaced-repetition.md "interval surfacing" candidate.
- **Bucket promotion gate.** Today L3 advances by 1 bucket no matter how
  long the user took. If an L3 takes 5x the personal-best time, maybe the
  bucket holds instead of advances. Same desirable-difficulty gradient but
  applied to the win-side rigor signal.

## Avoid (learned dead-ends)

*(none yet — populate as iterations rule things out)*
