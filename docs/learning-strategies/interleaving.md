# Interleaving

## The claim

Practicing related skills in mixed order (A, B, C, A, B, C…) produces better
long-term retention and transfer than blocked practice (A, A, A, B, B, B, C, C, C),
even though blocked practice feels easier in the moment. The mechanism: when a
solver faces problem N+1, they don't *already know* which idiom to reach for —
that retrieval step is exactly the skill an interview will test. Interleaved
practice forces it; blocked practice optimizes it away.

Rohrer & Taylor (2007), Birnbaum et al. (2013), and the broader cognitive-load
literature converge on this: when you can't predict which tool the next problem
needs, you have to *discriminate*, not just execute.

## Why it matters for this app

The target user is a rusty engineer re-memorizing JS syntax + interview
patterns ([PROFILE.md](../../PROFILE.md)). The failure mode at an interview
isn't "I forgot how a hash map works." It's:

> "I see an array problem. I have eight idioms in my head. Which one fits?"

Blocked practice — drilling Two Sum five times in a row — feels productive
but trains the wrong retrieval shape. The interview asks "given this prompt,
pick the right pattern," not "execute Two Sum again."

The app's section/lesson navigation tends toward blocked practice (you sit
in "Trees" for a while, then "Graphs"). Interleaving has to be deliberately
surfaced as a competing access pattern.

## How the app encodes it today

- **Today's plan** mixes a due review + the next path step + a weak spot
  in one session ([app.js dailyPlan](../../app.js)). Three different
  retrieval cues, not three repetitions of one.
- **Mock interview** picks a random pattern lesson with no warning —
  the user has to discriminate from a cold start, exactly the
  interleaving requirement.
- **Mechanics modal** (this iteration) groups lessons by *idiom shared
  across topics*, not by topic. Opening the "Frequency map" mechanic
  surfaces Top K Frequent (Heap), Group Anagrams (Hash), Valid Anagram
  (Hash), and Word Break (DP) side by side — the same retrieval shape
  pulled from four different "topics" the user wouldn't navigate together
  via the sidebar. The mechanic name is the cue; the lessons are the
  varied surface forms.
- **Spaced repetition** by definition interleaves — when reviews come due
  they don't arrive grouped by section.

## Under-exploited / candidate features

- **Mechanic-driven mock mode.** Pick a mechanic, then randomly serve L2 or
  L3 from a tagged lesson the user hasn't drilled this week. Doubles down
  on interleaving + spaced repetition simultaneously.
- **"Surprise me" jump from a mechanic detail view.** One-tap "drill a
  random lesson from this mechanic" — keeps the mechanic cue but
  randomizes the surface form.
- **Cross-mechanic interleaved session.** Today's plan currently mixes
  *priorities* (due / weak / path). A complementary "mix 5 mechanics"
  session would mix *idioms*, ensuring no two consecutive lessons share a
  primary mechanic tag.
- **Mechanic-aware shuffle.** The existing 🎲 Shuffle picks a random
  mastered lesson uniformly. A weighted variant could prefer lessons
  whose mechanic the user hasn't touched recently — interleaving across
  time, not just within a session.

## Pitfalls

- **Interleaving without active recall is just confusion.** If the user
  sees lesson A, then B, then C as *passive reading*, they get the worst
  of both worlds — no fluency in any one, no retrieval practice. The
  Mechanics modal works because tapping a lesson lands you on the
  L1/L2/L3 ladder, not a reference card.
- **Don't interleave the very first encounter.** When a concept is brand
  new, blocked practice is correct — the user needs enough exposure to
  build any mental model at all. Interleaving pays off on *consolidation*,
  not introduction. Starter Path stays blocked-by-section by design.
- **Over-interleaving causes thrash.** A session that bounces across 10
  unrelated lessons feels productive but leaves nothing actually drilled.
  Cap an interleaved session at a small number (Today's plan is currently
  capped at ~6 items for this reason).
- **The "feels harder" trap.** Interleaving genuinely feels worse in the
  moment — users may rate blocked practice as more effective because they
  conflate fluency-of-execution with learning. Don't let UI metrics
  optimize for "user feels productive" if the choice would push toward
  blocking.

## References

- Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems
  improves learning. *Instructional Science*.
- Birnbaum, M. S., Kornell, N., Bjork, E. L., & Bjork, R. A. (2013).
  Why interleaving enhances inductive learning: The roles of discrimination
  and retrieval. *Memory & Cognition*.
- Bjork, R. A. (1994). Memory and metamemory considerations in the training
  of human beings. (Origin of "desirable difficulties" — overlaps with
  [desirable-difficulty.md](desirable-difficulty.md).)
