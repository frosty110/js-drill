# Desirable Difficulty

## The claim
Robert Bjork's "desirable difficulty" finding: learning is *enhanced* by
friction that makes retrieval feel harder in the moment but produces stronger,
more durable encoding. Easy retrieval (re-reading, recognizing) feels good and
predicts almost nothing about long-term retention; harder retrieval (free
recall, spacing, interleaving) feels bad and predicts retention strongly.

The key qualifier is **desirable**. Friction that targets cognitive effort —
the work of pulling a fact from memory — is desirable. Friction that comes
from poor tool design — an editor that fights the user's keyboard, a UI that
requires three taps before drilling can start — is *undesirable*. Undesirable
friction taxes the same attention budget but doesn't produce learning. It just
produces bounce.

## Why it matters for this app
The target user studies ~80% on a phone. A phone-keyboard CodeMirror session
is *all friction*, but very little of it is the recall friction we actually
want to apply. The user types `cosnt` instead of `const`, fights autocorrect,
loses the cursor inside a long line, and the cognitive load goes into the
typing mechanics rather than the pattern recall. The session ends in
frustration, not learning.

We should be deliberate about which kind of friction each surface applies:

| Surface | Cognitive friction (desirable) | Mechanical friction (undesirable on mobile) |
|---|---|---|
| L1 (MC) | Choosing between confusable options | Trivial — tap-based |
| L2 (fill) | Producing the exact token from memory | Low — short, tab-completed typing |
| L3 (blank editor) | Producing the full canonical pattern | **High on mobile** — sustained typing on a phone keyboard |
| Mock interview | Full recall under time pressure | High — but acceptable, it's a desktop-only surface |

For the same user at a desk, L3 is the right friction — it forces full
generation. For the same user on a phone, L3 mixes recall friction with
typing friction, and the user can't tell which one is failing. L2 isolates
recall friction with much less typing.

## How the app encodes it today

- **The L1 → L2 → L3 ladder** is itself a desirable-difficulty ramp — each
  step strips a layer of scaffolding (options → blanks → blank editor).
- **Review CTA tab routing is device-calibrated.** The 🕒 Review button in
  the sidebar opens the most-overdue lesson on **L2** when the device matches
  `(pointer: coarse)` and **L3** otherwise. Same SR loop, different friction
  surface — the friction the user feels is recall difficulty, not typing
  difficulty. (See `app.js`, search for `Review-Due button`.)
- **L3 editor uses `inputStyle: 'contenteditable'` on touch devices** —
  removes iOS Safari's hidden-cursor / autocorrect class of mechanical
  friction so the typing burden is at least clean.
- **Line wrapping in the L3 editor** — removes horizontal-scroll friction
  that has nothing to do with recall.
- **SR advancement is graded by difficulty (both sides).** L3 pass on a due
  lesson advances the interval bucket (1d → 3d → 7d → 14d → 30d). L2 pass
  HOLDS the bucket but resets `dueAt`. Reveal on a due lesson DEMOTES the
  bucket by one step (floored at 1d). The schedule responds to actual
  recall strength rather than ratcheting in one direction. Cross-references
  [[spaced-repetition]].

## Under-exploited / candidate features

- **Recall-without-prompt mode** — show the lesson title only, expect the
  user to produce L3 canonical. Strips the prompt scaffolding that makes
  recall easier than a real interview. Cross-references [[active-recall]].
- **L3 timeout-as-failure.** Today the only "failure" signal that demotes
  is an explicit reveal. A user who silently abandons a due L3 (closes the
  tab, switches lessons, lets the page sit) keeps their interval. A
  threshold like "L3 opened on a due lesson, no pass within N minutes"
  could broaden the loss-side signal — but needs care so it doesn't fire
  on legitimate context switches.
- **"Predict the output" gate before L3 run.** Forces a generation step
  before the typing step; isolates "did I understand?" from "did I type it
  right?"

## Pitfalls

- **All-friction-is-equal fallacy.** "Make it harder" is not the principle.
  The principle is *desirable* difficulty — friction that loads cognitive
  effort onto recall. Adding gratuitous typing or hiding the interface
  doesn't help.
- **Modality-blind defaults.** A single default tab / surface for all devices
  is the classic anti-pattern — it picks a friction calibration that's
  wrong for at least one user population. Always ask: does this friction
  make sense at the device my user is on right now?
- **Friction without feedback.** Hard practice only works if the user knows
  they passed or failed cleanly. A frustrated mobile typist who doesn't
  know whether their answer was conceptually wrong or just mistyped learns
  nothing.

## References

- Bjork, "Memory and metamemory considerations in the training of human
  beings" (1994) — original framing of desirable difficulties
- Soderstrom & Bjork, "Learning vs. Performance" (2015) — the gap between
  in-session ease and durable retention
