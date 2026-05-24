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

<!--
PROPOSED AMENDMENTS (drafted iter 26 vision mode; awaiting a frame iter to ratify or reject).
Format: each amendment is paired with the roadmap entry that would require it.
These are drafts only — the loop must not act on them as if they are PROFILE.md.

== Amendment A — "Pattern selection is a distinct skill from pattern implementation" ==
Paired with roadmap entry: Pattern Recognition Speed Drill (iter 26 #1)
Current PROFILE.md text (§ State they're in):
  "Pattern recall degraded. They know 'sliding window exists' but can't produce
  a canonical implementation from a blank editor in 5 minutes anymore."
Proposed amendment splits this into two sub-bullets:
  - Pattern *recognition* degraded — given a problem prompt, can't quickly name
    which pattern fits ("which family is this? two-pointers? sliding window?
    hash + complement?"). This is the *diagnosis* step of an interview, which
    the current L1→L2→L3 ladder never drills (every drill begins with the
    pattern already named in the lesson title).
  - Pattern *implementation* degraded — even with the pattern correctly named,
    can't produce a canonical implementation from a blank editor in 5 minutes.
    This is what the existing L3 tier already drills.
Why this matters: separating these makes "Recognize" a first-class need rather
than a refinement of L3, and unblocks new surfaces that target recognition
specifically (timed pattern-name picks, mixed-topic interleaving).

== Amendment B — "Metacognitive ownership of one's own gaps is a distinct need" ==
Paired with roadmap entry: Error Post-Mortem with Miss Classification (iter 26 #2)
Current PROFILE.md text (§ What they need from this app) lists 5 needs:
  syntax re-memorization, pattern fluency, interview-format conditioning,
  spaced reinforcement, memorization tooling.
Proposed amendment adds a 6th:
  6. Metacognitive ownership of gaps. The rusty engineer benefits from
     *naming* their own recurring mistake types (off-by-one, method-name
     confusion, semantics traps, etc.) — not just re-drilling lessons in
     which they happened to miss. Surfaces that let the user classify and
     own their own misconceptions, then resurface lessons via those
     concept-level tags rather than just lesson-level weak flags, are a
     distinct class of need from "spaced reinforcement" (which the weak-spot
     tracker partially serves at the lesson grain).
Why this matters: today's weak-spot tracker operates at the lesson unit. A
concept-level user-mistakes model is a genuinely new mode of self-knowledge
the rusty engineer can't currently build inside the app.

== Amendment C — "~80% phone may include non-visual phone time" ==
Paired with roadmap entry: Commute Audio Mode (iter 26 #3)
Current PROFILE.md text (§ Usage context) implies *visual-attention* phone
time exclusively — every modality bullet (L1 tap, L2 type, L3 type) requires
looking at a screen and hitting a target.
Proposed amendment adds a fourth modality:
  - **Audio (eyes-free, hands-free)** is the unaddressed slice of "~80%
    phone" — walking, transit, gym, dishes, driving. The phone is with the
    user but the screen isn't viable. Listen-and-acknowledge cycles (TTS +
    big single-tap or Bluetooth-click input) are the highest-throughput
    modality for this slice. L1 question/answer pairs are the natural unit
    (short enough to hold in working memory between hearing and acknowledging).
    L2/L3 are NOT viable in audio modality without voice recognition (deferred).
  - Implication for features: audio-out is the MVP; voice-in is a separate
    later effort with much higher engineering cost (Web Speech accuracy, grammar
    tuning, error handling). Don't bundle.
Why this matters: today the loop optimizes the visual-attention surface as if
it covers all 80%-phone time, which structurally excludes a large block of
the user's actual cognitive availability.

== Adversarial counterpoint (own these too) ==
A frame-iter ratifying the above should also weigh:
  - Are recognition and implementation actually separate skills, or does
    recognition get carried for free as implementation lessons accumulate?
    Evidence to gather: do users with high L3-pass rates on a section have
    proportionally high recognition speed, or is there a measurable lag?
    (Recognize-mode itself provides this evidence post-ship.)
  - Is "naming your gaps" actually different from "having spaced rep
    resurface lessons you missed"? Evidence to gather: do users who use
    miss-classification ≥10 times outperform users who don't on repeat-miss
    rate, controlling for total drill time?
  - Does ~80% phone time actually include large blocks of eyes-free time,
    or is the 80% mostly visual transit time (subway looking at screen)?
    Evidence to gather: pre-ship the Page Visibility instrumentation alone
    to measure screen-off intervals during sessions before building audio UI.
-->

