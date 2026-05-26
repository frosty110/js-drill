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

- **🧩 Mechanic Drilldown (iter 72).** Inline mechanic chips on the
  Reference tab — every lesson with one or more `content.mechanics` ids
  now renders a fuchsia-bordered chip row directly below the canonical
  code (e.g. on `two-sum`: `🧩 idioms used: Hash complement lookup`).
  Tap a chip → the Mechanics modal opens directly to that mechanic's
  detail view, listing every other lesson where the same idiom appears
  (with progress dots + due / weak markers per row). Lateral-transfer in
  context: the user lands on `two-sum`, sees that `hash-complement` is
  the load-bearing idiom, and can jump from "I just read the canonical
  here" to "let me drill this idiom on a Hash-track lesson and on a
  Heap-track lesson and on an Applied lesson" without leaving the
  recall flow. The Mechanics modal already existed; what this ships is
  the surface that pulls the cross-cutting view INTO the lesson the
  user is already in.
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
- **🧩 Mechanics × Track matrix (iter 63).** The Mechanics modal gained a
  List ↔ Matrix view toggle. Matrix mode renders the existing
  `lesson.mechanics[]` tag set as rows × the three tracks (Syntax / Pattern
  / Applied) as columns, with mastered/total per cell. Transfer-gap rows
  (mechanic mastered in one track but unmastered in another) float to the
  top with a ⚠ marker. The existing List view answers "which mechanics
  have I drilled at all?" — the Matrix answers "where does my fluency
  BREAK as the surface form changes from syntax-style to pattern-style
  problems?" — the load-bearing transfer question for interview-format
  readiness. Closes iter-59 vision iter's held candidate B#2 (track × tag
  transfer axis).
- **⏱ Big-O Speed Drill (iter 75).** A filtered Rapid-Fire — 12 L1 questions
  drawn ONLY from the complexity-question subset across all patterns +
  Algorithms lessons (matches q-text against `/complex|O\(|big.?o|amortized|asymptotic/i`).
  Closes the iter-27 audit theme #4 ("complexity-question fatigue distributes
  across normal lessons") by concentrating those questions into a trainable
  surface where the user drills complexity-reasoning in isolation. Reuses the
  full Rapid-Fire shell (letter chips, 7-sec timer, streak, shared lifetime
  stats in `state.rapidFire`) via a new `_runRapidFireWithDeck(deck, opts)`
  helper extracted from `startRapidFireSession` — same modality with a
  different deck filter is the cleanest §9C/§9B-adjacent ship pattern.
  Misses route to `state.weakness` like normal Rapid-Fire so the focused
  practice still feeds the SR rotation.
- **🥊 Pattern-Family Gauntlet (iter 125).** Sidebar 🥊 button → section
  picker → chained L1 session running EVERY L1 question across EVERY full
  lesson in the chosen section. The interleaving is *within-family*, not
  cross-family: 40 cards over the 10 Basics lessons, served in lesson order
  but L1-question-shuffled within each lesson's bank. The discrimination it
  trains is the one Speedrun's 1-Q-per-lesson can't — under interview
  pressure, you don't get "first question only" on each pattern; you have
  to produce *every* L1-graspable fact about the family. Cousin to Speedrun
  (lime, 1 Q/lesson, stopwatch — speed-first) and Rapid-Fire (yellow, fully
  cross-corpus shuffle — discrimination-first); Gauntlet (indigo) is the
  narrower-than-Rapid wider-than-Speedrun cell on the interleaving axis.
  Closes iter-124 vision iter roadmap #1 — first Cat 2 Paths & Sessions
  Active ship since iter 45 path-aware SR queue (78+ iters stale). Misses
  → `state.weakness` like every other L1 surface; correct →
  `appendHistory('L1-pass')`. No timer (PROFILE rusty-engineer consolidation,
  not speed under pressure) and `state.gauntlet.bySection[slug]` retains
  last `correct/total` per section as a coverage signal — *not* a best time
  — so re-runs surface improvement without gamifying the rhythm.
- **⚡ Rapid-Fire L1 stream** (iter 54) is the explicit interleaving surface
  on the highest-throughput mobile modality. 20 L1 questions sampled across
  every full lesson in every track + every section, shuffled by
  Fisher-Yates, served with a 7-sec soft timer. There is no "block" — each
  card's section is unrelated to the previous one's. Misses route into the
  existing `state.weakness` tracker so the rapid stream feeds back into the
  user's normal SR + weak-spot rotation; the session summary surfaces the
  three slowest lessons as a per-session weak-spot diagnostic. Closes the
  gap that previously made interleaving available only via Today's Plan
  (curated 3-way mix) and Mock Interview (single-lesson) — Rapid is the
  first **continuous** interleaved stream.

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
- **Interleaving fails when the surface forms are too similar across
  interleaved items.** Spaced-rep + Mock Interview both surface lessons
  from across the curriculum out of order — but if every linked-list L2
  blanks the literal token `next`, the rusty engineer pattern-matches
  `next…next…next` across the whole section under interleaving and
  *never has to discriminate*. The retrieval shape collapses to "type the
  word that comes after the dot." Caught iter 27 (lesson audit theme #1:
  five of seven LL lessons had this pattern), fixed iter 28 by varying
  the load-bearing blank tokens across the LL section so no two
  consecutive interleaved LL drills resolve to the same token. The
  general principle: **the interleaving signal lives in the variation
  *between* items, not just in their out-of-order delivery** — if items
  share an answer-token across the section, interleaving stops surfacing
  the discrimination it's supposed to train.

## References

- Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems
  improves learning. *Instructional Science*.
- Birnbaum, M. S., Kornell, N., Bjork, E. L., & Bjork, R. A. (2013).
  Why interleaving enhances inductive learning: The roles of discrimination
  and retrieval. *Memory & Cognition*.
- Bjork, R. A. (1994). Memory and metamemory considerations in the training
  of human beings. (Origin of "desirable difficulties" — overlaps with
  [desirable-difficulty.md](desirable-difficulty.md).)
