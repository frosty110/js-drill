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

- **💀 Resurrect Queue (iter 65).** Lessons whose `now - dueAt > 2 * interval`
  (overdue past one full bucket) get a dedicated sidebar pill `💀 Resurrect (N)`
  separate from the standard 🕒 Review badge. Closes a measurement gap on the
  "mastered stays mastered" success criterion: the Review badge knows
  due-or-not but never differentiated "due tomorrow" from "due 60 days ago,"
  so long-overdue lessons silently regressed without a dedicated re-entry
  ramp. Tap → routes to the most-overdue lesson at L2 (touch) or L3 (fine-
  pointer), matching the existing Review-button device-calibration. Auto-
  hides when N=0. Closes iter-64 roadmap #1 (constraint-aware B#3 — decay
  magnitude on the SR temporal axis).
- **📅 Streak Map (iter 62).** 60-day calendar density heatmap built from
  `state.history` events bucketed by day. Sidebar button opens a 9-column
  grid of 60 day-cells (oldest top-left → today bottom-right); cell color
  depth scales to the day's event count relative to the user's peak day in
  the window (5-tier gradient, no absolute thresholds). Hover or tap shows
  date + pass/miss breakdown. Carefully avoids PROFILE.md L75 gamification
  anti-pattern: NO streak counts, NO shame chips, NO "longest streak"
  vanity metric — just the calendar shape. The intuition: spaced repetition
  works only when the user actually returns to drill on the day reviews
  are due; visualizing the pattern of return surfaces *whether the SR
  schedule is being honored* without the "broke my streak, can't recover"
  trap that gamified streak counters reproduce. The ladder tells WHEN
  reviews come due; At Risk tells WHICH due lessons are also wobbly;
  Streak Map tells WHETHER the user is showing up on the days SR depends
  on. Closes iter-59 roadmap entry #3 (constraint-aware B#1 — calendar
  density dimension).
- **📡 At Risk decay radar (iter 60).** Joins three previously-independent
  signals — `state.weakness` (lesson-grain L1-miss count),
  `state.reviews[id].dueAt` (SR schedule), and `state.revealed[id]`
  (mastered-with-reveal integrity flag) — into a single ranked surface that
  answers "what should I drill RIGHT NOW?" Sidebar button (📡, auto-hides
  when the union of weakness ∪ revealed is empty) opens a modal listing up
  to 7 lessons sorted by urgency: due-now lessons first, then by smallest
  `dueAt - now` diff, then by weakness count descending, then by
  revealed-flag presence. Each row shows lesson title + due chip ("DUE NOW"
  red, "in Nd" amber, "no SR" grey) + miss-count badge + reveal marker;
  tap routes to the lesson and closes the modal. The SR ladder (above)
  tells the user WHEN lessons come due; At Risk tells the user WHICH due
  lessons are also wobbly — the intersection is the highest-leverage drill
  of the day. Closes iter-59 roadmap entry #1 (constraint-aware subagent
  B#4 — "risk intersection" dimension).
- **1d → 3d → 7d → 14d → 30d interval ladder.** L3 pass on a mastered
  lesson advances one bucket; L3 pass at the top bucket holds at 30d.
- **Section retention block (iter 47).** Stats modal now aggregates the
  per-lesson sparkline events (iter 32-33) into a per-section 14-day
  view, sorted with weakest-retention (highest miss-ratio) first so the
  user lands directly on "what needs attention." Each row shows the
  section name + a compact 14-bar sparkline (1 bar per day, height =
  total events that day, color = green all-pass / amber mixed / red
  only-miss / dark empty) + a `Npass · Nmiss` count toned by miss-ratio
  (green 0%, amber 0-30%, red ≥30%). Sections with zero activity in
  window are excluded — keeps the view focused on actually-drilled
  material. First per-section temporal surface; complements iter-40's
  section progress bar (which shows mastery breadth, not retention).
- **Hint-frequency trend tracking (iter 46).** Hint-button clicks and
  🎯 critical-lines clicks now write `hint-tier-N` / `critical-lines-used`
  events into `state.history` alongside the existing L1/L2/L3-pass and
  L1-miss events. A windowed-attempt counter (`_countHintAttempts`)
  derives "hints used on N of last K attempts" and surfaces it as a
  colored pill near the L3 hint stack (green = 0/N independent, amber =
  N/N still leaning, mid = in between). The pill is hidden until the
  lesson has any hint history, so unhinted-from-scratch lessons stay
  quiet. **The retention signal is the trend over SR intervals** — a
  lesson at 14d that needed 3/3 hints when at 1d and now needs 0/3 is
  the PROFILE line 65/66 mastery curve made visible. Closes iter-43
  SR walkthrough gap #3 + retroactively reactivates the iter-37
  Parking-lotted hints-used metric (both wanted the same
  `state.history` schema extension).
- **Path-aware review queue (iter 45).** When the Starter Path is on
  AND scoped to a single track (Syntax / Patterns / Applied — see iter
  39's per-track paths), the Review queue (`dueReviewIds()`) filters to
  in-scope lessons only. Off-scope due lessons are still tracked in
  localStorage; flipping back to track='all' or toggling path off
  re-surfaces them. The Review badge reflects scope ("1 due in syntax
  path, 4 more in other tracks — switch path scope to see") so off-
  scope work isn't silently hidden. Closes the iter-43 SR walkthrough
  gap #2: per-track paths previously filtered the sidebar list but not
  the review queue, so a user on the Patterns-only path could still
  get a Syntax-lesson review surfacing.
- **L2 pass on a due lesson HOLDS the bucket but resets `dueAt`.** Mobile
  users can keep their due list moving from a phone (L3 is high-friction
  there — see [[desirable-difficulty]]) without inflating intervals they
  haven't proven free-recall on. Practical effect: a 1d-bucket lesson that
  goes overdue, then gets an L2 pass, drops out of the due list for another
  1 day — but to reach 3d, the user still has to nail L3. The difficulty
  gradient is preserved; the loop isn't desk-only.
- **Reveal on a due lesson DEMOTES the bucket by one step.** Clicking
  "Reveal answers" on L2 or L3 while the lesson is due means the user
  couldn't produce it from memory — the canonical "I failed this recall"
  signal. The bucket drops one step (floored at 1d), and `dueAt` resets to
  `now + new_interval`. Reveals on a not-due lesson (voluntary early
  review) are no-ops on the schedule. Symmetric counterpart to the
  L3-advance / L2-hold gradient: easier test holds, harder test extends,
  reveal demotes.
- **The SR consequence is surfaced in pass/reveal feedback.** After
  passing L2 or L3 on a lesson with a reviews entry, the success line
  appends "Next review in Nd." After revealing on a due lesson, the
  feedback line appends "Interval shortened — next review in Nd." Mobile
  users don't hover for tooltips; the inline status text is the universal
  surface for SR feedback. Turns invisible scheduling into a felt loop.
- **Adjacent: Starter Path orientation surfaces.** The `🧭 Step N of M`
  pill in the lesson header (iter 5) plus the sidebar sort by
  STARTER_PATH index in path mode (iter 11) apply the same "make
  invisible state visible" principle to the linear curriculum. The pill
  gives instant orientation in the main view; the sidebar sort makes
  step numbers read monotonically top-to-bottom (instead of e.g.
  "22, 20, 21" because intra-section order tracks the manifest, not the
  path). Not SR proper, but the same commitment-device lever.
- **Adjacent: Mock Interview trend chip.** On the L3 surface for a
  lesson with ≥2 past mock attempts, the trend chip
  (`0:42 · 0:38 · ★0:32 · 0:34 · 0:29`) renders the rolling
  last-5 attempt times with the PB marked. Same "make invisible state
  visible" lever, this time applied to PROFILE.md success criterion #3
  ("Mock interview personal-bests trend down over weeks"). A trend can't
  trend if you only see the best.
- **Due-lessons surfacing** in Today's plan — the curated daily session pulls
  from `dueLessons` first. Additionally, when the user is on a mastered
  lesson and due reviews exist, the lesson-header CTA promotes "🕒 Review
  N due →" to primary (demoting "Next lesson" to secondary) so the
  highest-priority next action lives in the main viewport, not behind the
  sidebar drawer.
- **Weak-spot tracker** resurfaces lessons where L1 was missed, even outside
  the normal SR cadence. The `⚠️ Weak (N)` sidebar button shows the count of
  lessons with outstanding misses (parallel to `🕒 Review (N)`); the Today's
  plan queues the top weak-spot **before** the next-on-path entries so an
  active misconception is more actionable than a new lesson — if a lesson
  is both weak and on the path, the dedup labels it `weak spot`, not
  `next on path`.
- **Mastered-with-reveal dot variant** — a softer "mastered" state that
  schedules slightly tighter SR intervals than a clean mastery.
- **Per-lesson event history (`state.history`, iter-32 scaffold)** — every
  L1 pass / L1 miss / L2 pass / L3 pass is timestamped and stored per-lesson
  (capped at 50 events ≈ 6 weeks). Until now the app remembered *current
  state* per lesson but discarded *history* on every save — meaning PROFILE
  success criterion line 66 ("mastered lessons stay mastered across SR
  intervals 1d → 30d") was un-instrumented from the user's perspective.
  The sparkline render that consumes this data is flag-gated behind
  `window.__sparklineEnabled` until iter-33 ship iter; the data layer is
  collecting from iter-32 forward so iter-33's first real render has at
  least one iter's worth of events for early adopters to see a pattern.

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
- **Interval surfacing on the sidebar dot tooltip.** The pass/reveal
  inline feedback shipped above gives action-time legibility; an
  always-on tooltip ("Next review in 2d") on the mastery dot would give
  ambient legibility too. Desktop-mostly affordance (mobile doesn't
  hover), so lower priority than the inline feedback was.

## Pitfalls

- **SR without active recall is just re-reading on a schedule.** Reviewing
  the Reference tab doesn't count as a successful review for SR purposes —
  only an L2 or L3 completion does. Make sure scheduling never advances on
  passive re-exposure. (L2 holds the bucket; L3 advances it — see above.)
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
