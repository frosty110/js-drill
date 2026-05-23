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
  under-built lesson, exercise #2 should not echo exercise #1. The template
  that emerged in iter 7 (5 lessons backfilled): use **different input** so
  muscle memory can't shortcut a memorized output, and **blank different
  load-bearing tokens** than #1. If #1 blanks the data structure +
  primary method names (e.g., `Map`, `has`, `set`), #2 blanks loop bounds,
  iteration keywords (`of` vs `in`), early-return values, or comparison
  operators. Same canonical, different cuing surfaces → two retrieval reps
  per lesson that reinforce different bits of the same pattern.

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
