# Metacognition

## The claim

Metacognition is **knowing what you know** — the second-order signal that sits
above any specific learning act. Learners who accurately monitor their own
mastery, time-on-task, and weak areas allocate study effort more efficiently
than those who can't, *even when the underlying recall ability is the same*
(Dunlosky & Metcalfe, 2009). The wedge is calibration: a learner who FEELS they
know X but actually doesn't will under-study X; one who FEELS they're slow at Y
but actually isn't will over-study Y. Surfacing accurate self-models closes
both gaps.

## Why it matters for this app

The rusty engineer in [PROFILE.md](../../PROFILE.md) has a finite study budget
spread across 29 sections × 3 tracks × 154 lessons. They cannot drill
everything to mastery every day. The question they need to ask before each
session is not "what should I do?" but "where am I weakest right now and how
am I allocating my time?" Without those signals, they default to grinding the
sections that feel comfortable and avoiding the ones that don't — the
opposite of what's optimal.

Metacognitive surfaces are also resistant to the common anti-pattern of
gamification creep. A *time-spent* tile or a *mastery-half-life* tile shows
the user their own data without comparison to peers or arbitrary thresholds
(PROFILE L75) — it's read-only awareness, not a score to chase.

## How the app encodes it today

All surfaces live in the **Stats modal** (`#stats-btn` opens it). Each one is
a different metacognitive lens on the same `localStorage` state:

- **🧭 Track Balance Compass** (iter 66) — % mastered per track + nudge naming
  the least-covered track. Closes "am I lopsided?"
- **⏳ Time-Invested Section Ledger** (iter 155) — minutes spent per section
  inferred from event-pair gaps, sorted desc, top 8. Closes "where is my
  effort actually going?" *Orthogonal axis to Track Balance — % mastered vs
  time invested.*
- **📈 Mastery Half-Life** (iter 106) — median gap between L3-passes per
  lesson; buckets into Sticky / Normal / Slippery. Closes "is mastery
  holding?"
- **📊 Section Retention** (iter 105) — 14-day pass/miss density per section.
  Closes "where am I leaking the most?"
- **⏱ Calibration** (iter 131) — top-5 mechanics with the biggest gap between
  estimated and actual time-to-solve. Closes "am I underestimating any
  patterns?"
- **🎯 Self-Rescue Rate** (iter 101) — fraction of L3-passes completed with
  zero hints. Closes "am I getting better unaided, or leaning on scaffolds?"
- **🏷 Mistake Tagging Postmortem** (iter 58) — top-5 miss categories across
  all lessons. Closes "what kind of mistakes do I keep making?"
- **📅 Streak Map** (iter 62) — 60-day calendar density heatmap. Closes "what
  does my actual study cadence look like?" *(Deliberately not a streak
  counter — see Pitfalls.)*
- **🎰 / 🔎 / 🔮 / 🪲 lifetime accuracies** — per-drill-mode hit rates.
  Closes "which retrieval surfaces am I actually getting right?"

## Under-exploited / candidate features

- A **Mock Replay Reel** trend that surfaces miscalibration between predicted
  and actual mock-interview time (similar to ⏱ Calibration but on the L3
  mock surface) — partially shipped iter 61 as the slope-direction badge.
- A **What I'm Avoiding** tile: surfaces sections with zero events in the
  last 14 days when the user's overall activity is high (selective avoidance
  is a metacognitive blind spot — you don't notice what you don't touch).
- A **Confidence-vs-Correctness chart**: ask the user to rate confidence
  before submitting an L1 / L2 / L3, then plot calibration over time.
  Highest-leverage metacognitive feedback in the literature; not yet
  attempted (would require a per-attempt confidence prompt).

## Pitfalls

- **Gamification creep.** Metacognitive surfaces become anti-learning when
  they're presented as scores to maximize. The 📅 Streak Map deliberately
  omits a streak counter and uses a heatmap instead — the same data, but
  the *frame* is "look at your rhythm," not "extend your streak." Apply the
  same discipline to any new tile: the user should walk away thinking "I
  should drill Trees more," not "I scored 87% this week."
- **Comparison to others.** Showing peer benchmarks short-circuits the
  metacognitive loop — the user starts optimizing for the benchmark instead
  of for their own gaps. PROFILE L75 codifies this: own-data only, no global
  comparisons.
- **Over-surfacing.** Too many tiles → analysis paralysis. The Stats modal
  is already dense; new metacognitive surfaces should justify their slot
  against the bar of "which existing question does this answer better, or
  which load-bearing question is currently un-answered?"

## References

- Dunlosky, J. & Metcalfe, J. (2009). *Metacognition.* SAGE Publications.
- Bjork, R. A. & Bjork, E. L. (1992). *A new theory of disuse and an old
  theory of stimulus fluctuation.* (On why feeling-of-knowing diverges
  from actual recall.)
