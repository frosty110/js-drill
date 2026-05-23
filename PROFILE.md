# Target User Profile

> The user this app serves. Every improvement in the self-improve loop should
> trace back to making this person more effective.

## Who
A software engineer with real prior experience who has gone rusty. Wrote code
professionally in the past but has been away from active hands-on coding —
management track, different domain, career break, or simply hasn't done JS
interview problems in years. Returning to interview prep or sharpening for
hands-on work.

## State they're in
- **Concepts intact.** They know what a hash map is, what BFS does, what a
  closure is. They don't need pedagogy on fundamentals.
- **Syntax degraded.** They forget exact method names (`Array.from`, `flatMap`,
  `Object.entries`), argument order, destructuring patterns, modern ES features
  they never used heavily, and the small ceremonies (`Promise.all`, generators,
  iterator protocol, etc.).
- **Pattern recall degraded.** They know "sliding window exists" but can't
  produce a canonical implementation from a blank editor in 5 minutes anymore.
- **Interview-format proficiency degraded.** Out of practice with the cadence
  of "read prompt → talk through approach → code → test → reason about
  complexity" under time pressure.

## Usage context (load-bearing)
**~80% of study time is on a phone.** Probably riding transit, in line, between
meetings, on the couch. This shapes everything:

- **L1 (multiple choice)** is the smoothest interaction on mobile — tap-based,
  no keyboard. Highest throughput for the mobile user.
- **L2 (fill-in-blanks)** is feasible on mobile — short token typing, autocomplete
  helps, no scrolling around a long block.
- **L3 (blank editor)** is high-friction on mobile — long-form coding on a phone
  keyboard is painful. Treat L3 as the "at-desk" tier; don't pretend it's the
  main mobile surface.
- **Implication for lesson content:** every lesson should have *multiple* L1
  questions (≥3) and *multiple* L2 exercises (≥2) so the mobile user has enough
  surface area to drill without immediately exhausting the lesson. A lesson
  with 1 L1 + 1 L2 is under-built for this profile.
- **Implication for features:** anything requiring sustained typing is
  deprioritized vs. anything that works in 30-second tap-and-recall sessions.
  Mock interview is desktop-only by nature — that's fine, don't try to mobilify
  it. Polish the mobile L1/L2 loop instead.

## What they need from this app
1. **Syntax re-memorization.** Fast loops of "see canonical → recall → type from
   blank" across the JS surface area that comes up in interviews.
2. **Pattern fluency.** Same loop, but for canonical solutions to interview
   patterns (two-sum, sliding window, BFS, DP, backtracking) so they produce
   them without thinking.
3. **Interview-format conditioning.** Mock-interview-style timed drills where
   the pressure shape resembles a real interview (no hints, blank editor,
   expected output to hit).
4. **Spaced reinforcement.** So things they re-learn today don't slip again
   next week.
5. **Memorization tooling.** Beyond the L1→L2→L3 ladder — small affordances
   that exploit known learning-science principles (active recall, interleaving,
   retrieval practice, elaboration, dual coding, etc.). Each tool the app
   ships should embody a documented strategy from
   [docs/learning-strategies/](docs/learning-strategies/), and new strategies
   should be added to that folder as they're identified.

## Success criteria
- Can hit L3 (blank editor → correct output) on any reviewed lesson within
  target time.
- Mastered lessons stay mastered across SR intervals (1d → 30d).
- Mock interview personal-bests trend down over weeks.
- Friction between "I have 20 free minutes" and "I'm drilling" is near zero.

## Anti-patterns (what would be wrong for this user)
- Teaching CS fundamentals from scratch — they don't need "what is a hash map."
- Verbose pedagogical prose — they want canonical code + terse notes.
- Anything that gates practice behind reading.
- Gamification that obscures actual progress against interview readiness.
- New feature surface that competes with the core Reference → L1 → L2 → L3 loop.
- Mobile experience that doesn't support a "drill in line at coffee shop" use case.
