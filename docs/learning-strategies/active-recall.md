# Active Recall

## The claim
Memory is strengthened far more by *retrieving* information than by *re-reading*
it. The effort of pulling a fact or pattern out of your head — even when you
fail — creates stronger and more durable encoding than passive review.
"Looking at the canonical solution again" feels productive but is one of the
weakest forms of study.

## Why it matters for this app
Our user knows what the patterns *are*. Re-reading "Two Sum" doesn't help
them — they read it ten times in their career already. What they need is to be
*forced to produce it* without reference, repeatedly, with friction calibrated
to their current recall strength. Active recall is the entire point of the
app's existence.

## How the app encodes it today

- **The L1 → L2 → L3 ladder** is an active-recall ramp:
  - L1 forces choice between similar concepts (recognition recall).
  - L2 forces production of specific tokens (cued recall, low-cost).
  - L3 forces full production from a blank editor (free recall, high-cost).
- **Mock Interview mode** strips all hints and forces L3-style recall under
  time pressure — the cleanest active-recall surface in the app.
- **Reveal tracking** — if the user reveals the answer, the lesson is marked
  with a different dot variant. Revealing isn't active recall; the app refuses
  to lie about it.
- **No "show solution then quiz"** pattern — Reference is a separate tab the
  user must explicitly leave to drill.
- **L3 "Critical lines" pre-fill (iter 41)** turns the L3 blank-editor
  into a targeted retrieval drill. The 🎯 button (visible only on
  lessons that have authored `L3.criticalLines`) pre-fills the canonical
  scaffold with the 1-2 load-bearing lines replaced by `/* ___ FILL ___ */`
  markers — the user types just the algorithm's *insight* (the partition
  step, the complement check, the sorted-key fingerprint), not the
  boilerplate. Bridges the L2 (many tiny token blanks) ↔ L3 (fully
  blank) gap with a new recall shape: identify-the-insight-AND-produce-
  it. Authored per-lesson by an editor who marks which lines are
  load-bearing; that authoring decision is itself a learning signal
  (the user sees: "this line is the insight"). Hint tier — does NOT
  demote SR. Three lessons authored as MVP iter 41 (two-sum,
  valid-parentheses, p-anagrams); follow-up iters expand the set.
  See `iter-artifacts/ideas-by-category.md § Drilling Surfaces`.
- **Walkthrough Quiz mode (iter 36)** turns the previously-passive
  Walkthrough scrub into an active-recall surface. The 🔮 Quiz button
  picks a midpoint step K, shows steps 1..K, then asks "what's the next
  step?" with 4 MC option cards drawn from adjacent trace states
  (no-advance, skip-one, regression, final/initial). Zero new content —
  reuses every trace generator already authored across 99 Patterns +
  Applied lessons. Mobile-native (2-column option grid, tap to answer,
  Prev/Next disabled while quiz holds K). First active-recall surface
  on the Walkthrough tab; closes the "passive observation" gap the
  scrub interface introduced. See
  `iter-artifacts/ideas-by-category.md § Drilling Surfaces`
  ("What comes next?" parking-lot entry).
- **Reference-Card Flash mode (iter 35)** turns the previously-passive
  Reference tab into an active-recall surface without requiring typing.
  Toggling 🃏 Flash hides 1–3 randomly-chosen "good" tokens (length ≥3,
  alphanumeric) behind tap-to-reveal blur spans. The user mentally fills
  the blank before tapping to confirm — pure self-graded retrieval. Fills
  the read+recall-no-input cell between Reference-read and L2-type that
  the L1/L2/L3 ladder didn't cover. Mobile-native (tap-only, no keyboard).
  See `iter-artifacts/roadmap.md` iter-31 entry #5 and
  `iter-artifacts/ideas-by-category.md § Drilling Surfaces`.
- **Review CTA routes to a recall surface calibrated to the device** — touch
  devices land on L2 (cued recall), keyboard devices on L3 (free recall).
  Keeps the recall demand high while removing the typing-mechanics friction
  that would otherwise drown out the recall signal on a phone. See
  [[desirable-difficulty]] for the device-calibration rationale.
- **Density floor enforced at build time.** Active recall is stronger when
  the user retrieves the same concept across *varied* prompts, not the same
  prompt repeatedly. PROFILE.md sets a floor (≥3 L1 questions, ≥2 L2
  exercises per lesson) so each lesson can support multiple recall reps
  without exhausting the bank. `tools/validate-data.js` warns on lessons
  below the floor and can be flipped to fail-hard with `--strict-density`
  once the existing backlog of under-built lessons (currently 97 of 143
  on L2; was 102 before iter 7) is cleared.
- **Authoring template for the second L2 exercise.** When backfilling an
  under-built lesson, exercise #2 should not echo exercise #1. The core
  rule: **different input** + **blank different load-bearing tokens**
  than #1. Same canonical, different cuing surfaces → two retrieval reps
  per lesson that reinforce different bits of the same idea.

  Track-specific adaptations (validated iters 7–8):
  - **Pattern lessons** (algorithm canonicals): swap the array/string
    input so the expected output changes; blank loop bounds, iteration
    keywords (`of` vs `in`), early-return values, comparators — not
    the data-structure or method names that #1 already covered.
  - **Syntax lessons** (language-feature drills, shorter canonicals):
    smaller surface area, so "different input" usually means
    "different *use* of the feature" — method call instead of binary
    expression in `${}`; descending iterator instead of ascending;
    different range in async iteration. Blank a different syntactic
    role (object-field name vs symbol name; `Promise.resolve` vs
    `await`).
  - **Applied lessons** (closure-heavy implementation problems):
    more state to blank than pattern or syntax. #2 can target the
    closure surfaces #1 left intact — args capture, state-reset on
    fire, spread call, the conditional that gates the side effect.

  Track-syntax milestone: all syntax lessons (44/44) now meet the ≥2
  L2 floor as of iter 8. Remaining backlog: 74 pattern + 19 applied.

## Under-exploited / candidate features

- **Reverse L1.** Show code, ask "what does this do?" Currently L1 mostly goes
  prompt → concept. The reverse direction (code → meaning) is cheap to add
  and forces different recall.
- **Fill-in-the-blank with the blank in the middle of an identifier**
  (e.g., `Array.fr__()`) for very high-frequency syntax — extremely fast
  recall reps on phone.
- **Quick-recall mode**: 10 random L1s from due lessons, no navigation, no
  reading — pure retrieval session. Ideal for 90-second mobile windows.
- **"Predict the output"** before running L3 — adds a generation step before
  the typing step.
- **Recall-without-prompt**: show the lesson title only, ask "write the
  canonical pattern" — strips the prompt scaffolding that makes recall easier
  than a real interview.

## Pitfalls

- **Recognition feels like recall.** Multiple choice (L1) is the weakest form
  of active recall because the options leak information. Don't over-weight L1
  in mastery scoring — it should be a warm-up, not the test.
- **Hint creep.** Adding too many hints to L2/L3 turns them into guided reading.
  Hints should be visible only on user request, and using them should be tracked.
- **Premature reveal.** UI that makes "show answer" too easy to hit will be
  hit. Friction on reveal is a feature, not a bug.

## References

- Roediger & Karpicke, "Test-Enhanced Learning" (2006)
- *Make It Stick*, Brown / Roediger / McDaniel
