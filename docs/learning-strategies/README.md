# Learning Strategies

> Learning-science principles the app should encode. The app and these docs
> coevolve — when a feature exploits a principle, the principle gets documented
> here; when a principle is documented, it becomes a candidate for a feature.

## Why this folder exists

The target user ([../../PROFILE.md](../../PROFILE.md)) is a rusty engineer
re-memorizing JS syntax and interview patterns, mostly on a phone. "Re-
memorizing" is not a vague goal — there is decades of cognitive-science research
on what actually moves information from "I read it" to "I can produce it
under pressure." This folder is where we collect the principles we're betting
on, and how the app encodes them.

## How the loop uses this

The self-improve loop ([../../SELF-IMPROVE.md](../../SELF-IMPROVE.md)) reads
these docs alongside PROFILE.md when deciding what to build next. A good
candidate for the next iteration is usually:

- A strategy here that the app **doesn't yet exploit**, or
- A strategy here the app exploits **weakly** (e.g., spaced repetition exists
  but the surfacing UX is buried), or
- A user-visible friction that maps to a known principle we should formalize.

When the loop ships a feature, it must also update or add the relevant strategy
doc — the *why* of the feature, in learning-science terms, not just the *what*.

## Doc format

Each strategy lives in its own file. Suggested structure:

```markdown
# {{Strategy name}}

## The claim
One-paragraph summary of the learning-science finding. Plain language.

## Why it matters for this app
How the principle maps to a rusty engineer re-memorizing syntax and patterns
on a phone.

## How the app encodes it today
Bullet list of current features that embody this principle. Reference specific
code paths or UI elements where useful.

## Under-exploited / candidate features
Bullet list of ways the app *could* encode this principle more strongly —
the menu the loop picks from.

## Pitfalls
What goes wrong when you apply this principle naively (e.g., spaced repetition
without active recall is just re-reading on a schedule).

## References (optional)
Books, papers, or articles. Keep terse — we're not writing a literature review.
```

## Current strategies

- [Active recall](active-recall.md) — the L1→L2→L3 ladder
- [Spaced repetition](spaced-repetition.md) — the 1d→30d intervals
- [Desirable difficulty](desirable-difficulty.md) — calibrating friction to device + recall stage
- [Interleaving](interleaving.md) — mixing idioms across topics (Mechanics modal, Today's plan, Mock)
- [Dual coding](dual-coding.md) — ASCII diagrams alongside code (seeded by `s-index-math`)
- [Metacognition](metacognition.md) — Stats-modal self-awareness surfaces (Track Balance, Time Invested, Mastery Half-Life, Calibration, etc.)

## Strategies to add when relevant
*(parking lot — the loop should pick from here when a feature is a fit)*

- Elaboration (the "why" of L1 explanations)
- Chunking (canonical-snippet sizing)
- Generation effect (producing > recognizing)
- Testing effect (the act of being tested cements memory)
