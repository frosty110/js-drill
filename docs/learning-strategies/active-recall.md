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

- **📐 Smell-Test Complexity-Claim (iter 79).** Loads a small curated
  map (`data/complexity-claims.json`) of `{lessonId: {actual,
  distractor, note}}` for high-traffic patterns. Each card shows the
  canonical + a randomly-chosen complexity claim (50/50 actual vs
  distractor); user 2-taps "✓ Correct" or "✗ Wrong"; reveal shows the
  actual complexity + a one-sentence note. Trains the interview reflex
  "does the stated complexity match the code?" — interviewers grade
  this heavily ("walk me through your time complexity"; "can you do
  better than O(n²)?") but no other surface drills it as a *claim-vs-
  reality* decision. Starts at 10 curated lessons; expandable via
  appending to the JSON registry.
- **🪲 Walkthrough Bug-Hunt (iter 78).** A third mode on the per-lesson
  Walkthrough tab (alongside the existing prev/next stepper and 🔮 Quiz).
  Tap 🪲 Bug → the lesson's trace runs in full, ONE step gets one of its
  state-field values mutated (numbers ±1, booleans flipped, strings/arrays
  with first-two-elements swapped), and all steps render as a scrollable
  list of tap targets. User picks the corrupted row; reveal explains
  what was mutated (e.g. "Step 4 · `i` was `2`, shown as `3` (num±1)").
  Inverts the existing trace generators from "watch the correct execution"
  → "spot the corruption" — the debug-direction the L1/L2/L3 ladder
  never drills. Zero new content authoring: every Patterns/Applied lesson
  with a walkthrough (99/99 per OOB-2026-05-24) inherits the surface for
  free. Skips lessons where no state field is mutable.
- **🔮 Predict-the-Output (iter 77).** Crystal Ball mental-execution
  drill. Show a real patterns canonical + 4 output options (1 correct
  + 3 same-type distractors drawn from other lessons' L3
  `expectedOutput` strings); user reads the code and predicts what it
  prints — WITHOUT running it. First surface that trains mental
  simulation, the foundational interview reflex the L1/L2/L3 ladder
  never drills (the ladder is all *produce code*; this is *execute
  code in your head*). Distractor pool prefers same-output-type (array
  → array, number → number) to avoid type-mismatch giveaways. Skips
  canonicals >30 lines for mobile readability. Misses route to
  `state.weakness`. From `ideas-by-category.md § 1 Drilling Surfaces
  → Crystal Ball mental-execution drill`.
- **🎯 Reverse Problem-ID (iter 76).** Inverse of 🔎 Recognize:
  Recognize shows a problem prompt → user picks the matching section
  (problem→pattern direction); Reverse shows an input/output trace from
  a real canonical → user picks the matching problem from 4 prompts
  (output→problem direction). Function names are masked in both the
  invocation and the candidate prompts (`twoSum(...)` → `f(...)`) so
  the user must reason about the *behavior* shown, not pattern-match a
  name. Forward-from-output reasoning — a common interview unblock
  pattern when a candidate is stuck on a problem but knows what shape
  of output is expected. Reuses the Recognize shell + lifetime stats
  (`state.recognize`) — same diagnostic-direction modality, different
  cue. First §9B surface that uses the L3 expectedOutput as the
  primary stimulus instead of the prompt.
- **The L1 → L2 → L3 ladder** is an active-recall ramp:
  - L1 forces choice between similar concepts (recognition recall).
  - L2 forces production of specific tokens (cued recall, low-cost).
  - L3 forces full production from a blank editor (free recall, high-cost).
- **Mock Interview mode** strips all hints and forces L3-style recall under
  time pressure — the cleanest active-recall surface in the app.
- **Reveal tracking** — if the user reveals the answer, the lesson is marked
  with a different dot variant. Revealing isn't active recall; the app refuses
  to lie about it.
- **🏷 Mistake Tagging Postmortem (iter 58)** asks the user to *name* the
  category of a miss the moment it happens: an opt-in chip strip under the
  L1 explain text offers 6 tags ("off-by-one / wrong method / edge case /
  semantics / misread / syntax") + a dismiss X. Tapping a chip stores the
  tag in `state.misses[lessonId][]` and aggregates into a "Top miss
  patterns" tile in Stats. This sits at the edge of active recall and
  elaboration: forcing concept-level NAMING of one's own mistake encodes
  the gap with a richer mental tag than the binary lesson-grain weak-spot
  tracker can. A future docs-iter should author `metacognition.md` and
  `elaboration.md` to give this surface its proper home — flagged in
  SELF-IMPROVE.md § Blind spots ledger.
- **🌅 3-Card Warmup (iter 57)** ships the L1 interaction shell directly inside
  a 3-card mobile micro-session over the existing Today's Plan curated 3-way
  mix (due + path + weak). Today's Plan picks the WHAT in a modal of 3 rows;
  Warmup ships the L1 question itself inside each card so the user goes from
  idle to answering in ~3 taps vs Today's Plan's ~6+ nav-into-lesson flow.
  Tap-to-grade slides the active card off-screen (right=correct, left=wrong);
  next card slides up from the visual stack. The closer the entry surface is
  to the actual recall act, the more recall reps the rusty engineer
  accumulates per session of free phone time. PROFILE L69 (friction near
  zero) targets exactly this gap; the recall principle stays intact because
  the user still produces the answer (recognition recall on L1's MC shape),
  just with one less nav-frame between intention and retrieval.
- **🃏 Reveal Replay (iter 56)** closes the integrity loop on reveal-tracking.
  Until iter 56 the ringed-green "mastered-with-reveal" dot was a passive
  scarlet letter — the app knew the user had peeked, but offered no path
  back to honest mastery without manual hunting. Reveal Replay surfaces a
  sidebar button (🃏 + count) when `state.revealed` is non-empty and routes
  the user to the next revealed lesson at the level they revealed. A
  `markPassed` invariant then fires the clean-pass clear: if the user
  passes a previously-revealed level **without re-clicking reveal in the
  current attempt** (tracked by an in-memory `_revealedInCurrentAttempt`
  map that resets in `selectLesson`), the revealed flag is deleted and the
  dot demotes from ringed-green to plain green. A 2.2-second toast confirms
  the demotion. The invariant works generally — clean passes also clear
  flags when the user finds revealed lessons via normal navigation; the
  button is just the surface that guides the queue. This is active recall
  enforced as an integrity invariant rather than just a measurement.
- **No "show solution then quiz"** pattern — Reference is a separate tab the
  user must explicitly leave to drill.
- **Pattern Recognition Speed Drill (iter 49)** turns RECOGNITION — the
  concrete→abstract direction — into its own drill surface. Every other
  drill tier (L1/L2/L3/Mock/Walkthrough/Flash) is implementation- or
  recall-direction; they start with the pattern already named in the
  lesson title. Recognize inverts that: shows a problem prompt (no
  title, no section badge) and asks the user to tap WHICH section
  family it belongs to. 10 cards per session, drawn randomly from the
  79 patterns-track `L3.prompt` strings; distractors come from the
  17-section patterns pool (cross-cutting buckets, not per-lesson
  function-name leaks). The drill is metacognitive recall — it asks
  the user to retrieve their mental TAXONOMY of patterns rather than
  the implementation of any single one. Closes the iter-26 BLOCKED
  Pattern Recognition entry via the iter-48 section-name-distractor
  reframe. Lifetime stats live in `state.recognize = {attempts, correct}`.
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
