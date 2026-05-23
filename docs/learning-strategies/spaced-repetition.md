# Spaced Repetition

## The claim
Memory decays on a predictable curve. Reviewing material right before you'd
forget it — and stretching the interval further each time you successfully
recall — produces dramatically more durable retention per minute spent than
massed practice (cramming). The "sweet spot" review moment is when retrieval
is just on the edge of failure.

## Why it matters for this app
Our user has a finite study budget (the phone moments between other life
events) and a non-trivial surface area (143 lessons across syntax, patterns,
and applied). Without spaced repetition, they'd re-drill the easy stuff and
let the hard stuff slip — the worst possible allocation. SR routes them
specifically toward lessons their memory is currently weakest on.

## How the app encodes it today

- **1d → 3d → 7d → 14d → 30d interval ladder** keyed off successful L3
  completion (see `app.js`).
- **Due-lessons surfacing** in Today's plan — the curated daily session pulls
  from `dueLessons` first.
- **Weak-spot tracker** resurfaces lessons where L1 was missed, even outside
  the normal SR cadence.
- **Mastered-with-reveal dot variant** — a softer "mastered" state that
  schedules slightly tighter SR intervals than a clean mastery.

## Under-exploited / candidate features

- **Grade your recall (1-4).** Anki-style self-grading after L3 — currently
  pass/fail. A 4-button confidence rating would give the SR scheduler much
  better signal and is mobile-friendly (tap targets).
- **Forgetting-curve visualization** in stats — show the user *which* lessons
  are about to slip out of memory. Motivating + accurate.
- **SR for L1 and L2 separately**, not just lesson-level. A user might have
  L1 mastery on a pattern but L3 weakness, or vice versa.
- **"Drill due now" deep link** from a notification or homescreen widget —
  removes the friction between "I have 90 seconds" and "I'm reviewing the
  thing that's about to slip."
- **Interval surfacing on the lesson card** — "next review in 2d" — turns SR
  from invisible scheduling into a visible commitment device.

## Pitfalls

- **SR without active recall is just re-reading on a schedule.** Reviewing
  the Reference tab doesn't count as a successful review for SR purposes —
  only an L2/L3 completion does. Make sure scheduling never advances on
  passive re-exposure.
- **Optimal-interval tuning is per-user.** Don't over-engineer a single
  global curve. Let the user's recall-grade signal pull intervals shorter
  or longer.
- **Mass-due-list panic.** If the user skips a few days, the due list
  explodes and they bounce off. Cap "today's plan" at a manageable count
  even when more is technically due.
- **SR fights novelty.** A user who only ever sees due lessons never expands
  their surface area. Today's plan correctly mixes due + path + weak — don't
  break that ratio without thinking.

## References

- Ebbinghaus, *Memory* (1885) — the original forgetting curve
- Cepeda et al., "Distributed Practice in Verbal Recall Tasks" (2006)
- The SuperMemo / Anki interval algorithms (SM-2 family)
