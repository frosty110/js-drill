# Shipped by Category

> **Companion to [`ideas-by-category.md`](ideas-by-category.md).** When an idea ships, its detailed entry migrates here so the candidate catalog stays candidate-only.
>
> This file is the **"what got built in each surface"** record — useful for "we already have N recognition drills, here they are; what's the gap?" lookups. For shipping status / dates, this file is authoritative; for in-flight queue, see `roadmap.md`.
>
> Established **iter 92** by a cleanup pass that pulled ~25 SHIPPED entries out of `ideas-by-category.md` to restore it to a candidates-only doc.

---

## 1. Drilling Surfaces

- **Reference-Card Flash Mode** *(iter 35)* — 🃏 cloze-deletion blur-tap on canonical tokens; tap to reveal. Fills the "read+recall-no-input" recall direction the L1/L2/L3 ladder didn't cover.
- **Walkthrough Quiz / "What comes next?" trace-sequence drill** *(iter 36)* — 🔮 Quiz button on Walkthrough tab. Picks midpoint step K, shows 1..K, asks "what's next?" with 4 MC option cards from adjacent trace states (no-advance, skip-one, regression, final/initial). Mobile probe `tools/cdp/walkthrough-quiz.js`. First parking-lot idea graduated directly to ship from this catalog without a roadmap.md intermediate step.
- **L3 hint ladder (interview-realistic)** *(iter 37)* — 3-tier graduated reveal (Approach → Skeleton → First step). Tier 1 uses authored `L3.hints[0]`; tier 2/3 fall back to regex-derived function signature + first canonical line when not authored. Each tap stacks below the previous (cumulative trail, not rotating message). Hint tiers do NOT demote SR; only the explicit Reveal canonical does. Clear resets the ladder. Mobile probe `tools/cdp/l3-hint-ladder.js`. Hints-used-per-attempt instrumentation deferred.
- **"What's missing?" critical-line fill** *(iter 41 MVP, iter 42 expansion to 11 lessons)* — 🎯 button on L3 tab; pre-fills editor with canonical scaffold and replaces lines marked `L3.criticalLines: [int]` with `/* ___ FILL LINE N ___ */` markers. User types just the 1-2 load-bearing lines (the algorithm's *insight*). Same Run handler validates. Hint tier — no SR demote. **11 lessons authored** across two-sum, valid-parentheses, p-anagrams, p-merge-intervals, p-min-window, valid-palindrome, p-bfs, p-islands, binary-search, p-permutations, p-num-provinces. Validator bounds-checks `criticalLines` + asserts non-empty + non-comment lines. Mobile probe `tools/cdp/critical-lines.js`.
- **L1 Rapid-Fire stream (cross-lesson MCQ)** *(iter 54)* — ⚡ Rapid sidebar button → 20-question Fisher-Yates-shuffled session across all tracks; 7-sec soft timer; streak counter; slowest-3-lessons weak-spot diagnostic; miss → `state.weakness`. Cross-lesson interleaving on the highest-throughput mobile surface.
- **🔮 Crystal Ball mental-execution drill** *(iter 77)* — sidebar button → 5-card session showing real patterns canonicals (≤30 lines for mobile) syntax-highlighted via Dracula runMode + 4 output options. Distractor pool prefers SAME-OUTPUT-TYPE strings drawn from other lessons' `L3.expectedOutput` (array→array, number→number, etc.) — avoids the type-mismatch giveaway. Misses → `state.weakness`. Schema-additive `state.crystal`. ~190 LOC JS + 25 CSS. **First surface that drills mental simulation** (read code → predict output WITHOUT running).
- **🪲 Trace-bug mode** *(iter 78)* — third interaction mode on Walkthrough tab (alongside stepper + 🔮 Quiz). Runs the lesson's trace, mutates ONE state-field value at ONE random step (`_bugMutateValue`: numbers ±1, booleans flipped, strings/arrays first-two-swap), renders all steps as tappable rows. Tap reveals the actual buggy step + a one-line explanation. Zero per-lesson authoring — every walkthrough-bearing lesson (99/99 Patterns+Applied) inherits the surface. Skips lessons with <3 state keys.
- **🎬 Conversation Drill (interview-arc 6-phase classifier)** *(iter 91)* — sidebar Conv button → 10-card mobile session showing one `.say` paragraph per card with section title hidden; user picks which of 6 phases (Restate/Brute/Spot/Trace/Edges/Complexity) it is. Tap reveals actual title + source lesson + drill CTA; misses → `state.weakness`. First surface to test the 6-section interview-arc skill that the OOB-2026-05-24 rollout authored across 99 Patterns/Applied lessons. The 495-card `.say` corpus had never been read as a recall target before — recruiters grade the arc, not just the code.
- **🧬 Trace-Hop (positional state recall)** *(iter 93)* — sidebar button → 8-card mobile session over `walkthrough.trace` yields. Each card shows 3 consecutive trace frames (K-1, K, K+1) with the middle frame's state BLANKED + 4 state options. Distractors sampled from OTHER frames of the SAME trace excluding K-1/K+1 (which are visible — would be trivially-wrong giveaways). First surface drilling positional state recall — the mental model the rusty engineer needs to write canonical from scratch. Distinct from 🪲 Bug-Hunt's anomaly-detection direction. Schema-additive `state.traceHop`. ~245 LOC JS + 85 CSS. Mobile probe `tools/cdp/trace-hop.js` (5 assertions).
- **📝 Notes Cloze Tap-Drill (note-keyword cloze)** *(iter 97)* — sidebar 📝 Notes → 12-card mobile session. Each card shows ONE `reference.notes[i]` string with one keyword blanked via heuristic (last eligible token: ≥4 chars + not in 50-stop-word filter + has at least one letter) + 4 MC options (correct + 3 unique distractors from notes in OTHER lessons, preferring same section). Third recall direction over `reference.notes[]` after 🎰 Gotcha (whole-note yes/no recognition) and 🃏 Flash (code-token cloze). Schema-additive `state.notesDrill`. ~235 LOC JS + 70 CSS. Mobile probe `tools/cdp/notes-cloze.js` (5 assertions; orchestrator-tightened strip regex after first probe surfaced trailing-punctuation cosmetic issue).
- **⏪ Reverse-Walkthrough (backward direction over walkthrough trace)** *(iter 99)* — sidebar ⏪ Reverse-Walk → 8-card mobile session. Each card shows the FINAL `{state, returns}` of one walkthrough example + 3 input options (all 3 examples from the SAME lesson, shuffled); user taps which input produced this final state. **Adapted spec** from iter-95 roadmap entry — empirical feasibility scan found ALL 99 Patterns/Applied lessons have EXACTLY 3 walkthrough examples (not "many <4" as iter-95 assumed), so 3-option MC from same-lesson examples is the cleanest pure-cognitive-operation design. Baseline guess rate 33% but discriminating between same-algorithm examples requires actual trace-execution mental simulation. Complements Walkthrough (forward stepper) and Trace-Hop (mid-state recall) by drilling the **end-state → input** direction over the same trace data. Schema-additive `state.reverseWalk`. ~230 LOC JS + 90 CSS. Mobile probe `tools/cdp/reverse-walk.js` (5 assertions).

---

## 2. Paths & Sessions

- **🔎 Recognize mode** *(iter 49)* — diagnose-the-pattern speed drill. Shows random patterns-track `L3.prompt` + 4 SECTION-name buttons; tap matching family. 10-card session with lifetime stats in Stats modal. **Sidestepped both BLOCKED dependencies** of the iter-26 Pattern Recognition Speed Drill (PROFILE Amendment A, BS-15 `problem` field) by using SECTION-name distractors instead of pattern-name distractors.
- **L1 Rapid-Fire stream** *(iter 54)* — also bridges into Sessions surface; see Cat 1 for full detail.
- **🌅 3-Card Warmup** *(iter 57)* — mobile micro-session over Today's Plan's curated 3-way mix (due + path + weak); 3-card stack with tap-to-grade + slide-off animation; bypasses Today's Plan's nav-into-lesson flow by shipping the L1 interaction shell directly inside each card.
- **Per-track Starter Paths** *(iter 39)* — 4-chip track picker (All / Syntax / Patterns / Applied) above the sidebar lesson list when Starter Path is on. Picks filter existing curated `STARTER_PATH` by `lesson.track` — no new authoring; relative order within each track preserved. Header pill shows "🧭 Step N of M (Syntax)" when scoped. `state.starterPathTrack` added (default `'all'` for legacy). Mobile probe `tools/cdp/per-track-starter-path.js` (7 assertions).

---

## 3. Mechanics

- **🏷 Mistake Tagging Postmortem** *(iter 58)* — opt-in chip strip below L1 miss explain text with 6 fixed tags (off-by-one / wrong method / edge case / semantics / misread / syntax). Tap saves to `state.misses[lessonId][]`. Stats modal "Top miss patterns" tile aggregates top-5 across all lessons (hidden when empty). **First concept-grain miss-tracking surface** — sidestepped BLOCKED Error Post-Mortem (Amendment B) via "opt-in user-authored tagging as a USER affordance" framing.
- **🧩 Mechanics × Track matrix view** *(iter 63)* — Mechanics modal gained List ↔ Matrix toggle. Matrix renders mechanic × 3-track grid with mastered/total per cell. Transfer-gap rows (mastered in one track, unmastered in another) float to top with ⚠ marker. Tap cell → detail view filtered to mechanic.
- **🧠 Mechanic-Bridge (cross-track transfer routing)** *(iter 94)* — sidebar 🧠 Bridge pill auto-shows when a `mechanics[]` tag is mastered in one track but unmastered in another. `_bridgeCandidates()` walks `MECHANIC_INDEX × state.progress × manifest.track`: for each mechanic, buckets lessons into mastered-per-track + unmastered-per-track first-hits; emits ONE candidate per mechanic where a cross-track pair exists. Tap routes to target lesson's L1 + 2.2-sec fuchsia toast prefacing source lesson + mechanic label. Lazy-loads MECHANIC_INDEX via existing `ensureMechanicIndex()`. Closes the iter-63 Mechanics × Track Matrix's "diagnostic-but-not-actionable" gap on PROFILE §What they need #2 (pattern fluency / produce without thinking). ~85 LOC JS + 3 CSS. Mobile probe `tools/cdp/mechanic-bridge.js` (5 assertions).
- **🪐 Mechanic Constellation (multi-select mechanics recall)** *(iter 98)* — sidebar 🪐 Constellation pill → 10-card mobile session. Each card shows ONE mechanic name + blurb + 6 lesson titles (3 tagged with mechanic + 3 not, same-section preference for plausibility); user taps 3 they think are tagged. Per-tap immediate-feedback (matches iter-93/97 pattern): correct → green ✓; wrong → red ✗ + state.weakness[lessonId]++. After 3 picks, reveal phase marks unpicked tagged lessons with ⊙ + Next CTA. **First surface drilling `mechanics[]` as a recall TARGET** — Bridge/Matrix/modal all USE mechanics as input (filter/route/group); Constellation tests "given a mechanic, which lessons use it" as the recall task itself. Schema-additive `state.mechConstellation`. ~290 LOC JS + 70 CSS. Mobile probe `tools/cdp/mechanic-constellation.js` (5 assertions).

---

## 5. UI/UX Experience

- **Lesson-history sparkline** *(iter 33; mobile probe iter 34)* — first per-lesson temporal surface. Established Metacognition category.
- **URL deep-linking** *(iter 38)* — Hash format `#/<lesson-id>/<tab>` (e.g. `#/two-sum/L1`). `history.replaceState` updates URL on lesson/tab change so URLs stay shareable without polluting history; `hashchange` listener handles back/forward and pasted URLs. Invalid lesson IDs fall back gracefully. Cross-device URL sharing closes part of the BS-10 sync gap for read-only navigation. Mobile probe `tools/cdp/url-deep-link.js` (5 assertions).

---

## 6. Persistence & Sync

- **🤖 AI Coach Export (BYOK bridge)** *(iter 88)* — sidebar 🤖 button builds a Markdown blob of weak-spots + revealed + overdue lessons (capped 12 lessons / ~8KB to leave LLM context room); each row includes flags (missed L1 N×, revealed L2, Nd overdue), most-missed L1 question + correct answer + explain, and canonical truncated to 25 lines in fenced ```js block. Pure clipboard via existing `copyTextToClipboard()` (no API integration, no creds). Emerald-accented toast confirms with char count + paste-into-Claude/ChatGPT instructions; fallback toast for clipboard-blocked contexts. Empty-state fallback for users with no weak spots. ~115 LOC JS + ~14 LOC CSS. **Unlocks the AI-coach idea (deferred iter 26)** without the BYOK-creds onboarding friction; user already has their LLM session open.

---

## 7. Metacognition & Visibility

- **🃏 Reveal Replay** *(iter 56)* — sidebar button + clean-pass invariant. Routes user to lessons mastered-with-reveal; passing the revealed level without re-revealing clears the flag and demotes the ringed-green dot to plain green. 2.2-sec fuchsia toast confirms.
- **🏷 Mistake Tagging Postmortem** *(iter 58)* — see Cat 3.
- **📡 Weak-Spot Decay Radar** *(iter 60)* — sidebar button + modal joining `state.weakness ∪ state.revealed` (with `state.reviews[id].dueAt` enrichment) into a ranked list (due-now first → ascending dueAt → descending weakness → revealed-flag). First surface that joins three previously-independent state signals. Auto-hides when union empty.
- **⌚ Mock Replay Reel** *(iter 61)* — slope-direction badge + tappable cells on the existing L3 trend chip. "↓ X faster vs first" / "→ holding" / "↑ Y slower vs first" via first-vs-last comparison. Per-cell tap reveals attempt index + time + delta-vs-best.
- **📅 Streak Map** *(iter 62)* — 60-day calendar density heatmap built from `state.history`. Sidebar button → 9×7 grid; 5-tier color gradient scaled to user's peak day; hover/tap shows date + pass/miss breakdown. Carefully avoids gamification anti-pattern (no streak counts).
- **💀 Resurrect Queue** *(iter 65)* — sidebar pill for mastered lessons past 2× their SR interval. Differentiates "due tomorrow" from "due 60 days ago." Tap routes to most-overdue at L2 (touch) or L3 (fine-pointer). Closes the "mastered stays mastered" measurement gap on long-overdue lessons.
- **🧭 Track Balance Compass** *(iter 66)* — 3-bar widget at top of Stats modal showing % mastered per track + 1-line nudge naming least-covered. Surfaces lopsided allocation (over-grinding one track while neglecting another).
- **Section-level progress bar in sidebar** *(iter 40)* — each section header shows a thin 40px × 4px emerald-fill bar + monospace "N/M" count badge. Counts reflect the user's CURRENT view (respects path-mode + search + hide-mastered filters), so the bar is contextual. Mobile probe `tools/cdp/section-progress-bar.js` (4 assertions).
- **🎯 Hint-Cost Ladder Stats** *(iter 101)* — Stats-modal "Self-rescue rate" tile aggregates zero-hint L3 passes / total L3 passes across all lessons via new `_selfRescueRateGlobal()` walking `state.history` (iter-32 schema captures `hint-tier-*` + `critical-lines-used` events). L3 trend chip extended with per-attempt cost ribbon: 5 chips showing recent attempts (0 hints = green ✓ / 1-2 = amber number / 3+ = orange "3+"). **Pure read-only over already-captured state** — no new field, no `__v` bump. **Closes the iter-37 deferred "hints-used-per-attempt" metric** (45 iters in parking lot). First surface measuring **quality-of-pass** (not pass/fail). Mobile probe `tools/cdp/hint-cost.js` (5 assertions including aggregator shape verification on seeded `state.history` + ribbon color-mix verification).

---

## 9. Interview Conditioning

### §9B Code evaluation skills

- **🪲 Bug-Hunt mode** *(iter 73)* — sidebar button → session loads a deck of 5 patterns canonicals, each with ONE auto-mutated operator at a runCode-verified breaking position (10 mutators: `<`↔`<=`, `>`↔`>=`, `++`↔`--`, `===`↔`!==`, `&&`↔`||`). Code rendered with line numbers + per-line tap targets; tap the buggy line to grade. Misses → `state.weakness`. Schema-additive `state.bugHunt`. ~190 LOC JS + 55 CSS. **First §9B surface ever shipped** — closed the 37-iter cross-cutting gap from iter-36. The auto-mutator approach realizes the entry's "rule-based mutator" alternative without per-lesson authoring.
- **🎯 Reverse problem-identification** *(iter 76)* — sidebar button → 6-card session showing input/output trace from a real canonical (extracted via `console.log(...)` regex from last invocation line) + 4 prompt distractors (3 random patterns lessons + correct). Function names masked via splitter that preserves string-literal contents. Lifetime stats reuse `state.recognize` (combined diagnostic-direction modality across Recognize and Reverse). ~190 LOC JS + 25 CSS.
- **📐 "Smell test" complexity-claim drill** *(iter 79)* — sidebar button → 5-card session reading from `data/complexity-claims.json` (10 curated high-traffic patterns). Each card shows canonical + a randomly-chosen claim (50/50 actual vs distractor) + 2-tap correct/wrong; reveal shows actual + a one-line note. Misses → `state.weakness`. Schema-additive `state.claim`. ~160 LOC JS + 35 CSS. **Expandable** by appending JSON registry entries — no code change needed.
- **🛡 Edge case pre-enumeration drill** *(iter 81 MVP)* — 6 fixed toggle chips (empty / single element / duplicates / max size / negative / no solution) above the L3 editor on every L3 tab; tap-toggles a "considered" state per chip. Hidden during Mock Interview (no-scaffolding by design). Pure UX nudge — no scoring, no per-lesson curation. **Future graduation candidate:** ship `data/edge-cases.json` mapping each lesson + reveal comparison after L3 pass.

---

## Cross-category surfaces (not from a single bucket)

- **🔀 Swap-Bench** *(iter 86, expanded iter 87)* — pairwise idiom-equivalence drill. Sidebar 🔀 button → 6-card session reading curated `data/idiom-pairs.json` (18 entries as of iter 87, expandable by appending); each card stacks two JS snippets vertically (mobile-first; ≤8 lines per snippet) and asks "Same behavior?". Covers canonical JS confusions: map-vs-for-mutates, for-of-vs-for-in, slice-vs-splice, `||`-vs-`??`, Array.fill shared-reference trap, Map-vs-object key types, parseInt-vs-Number, sort-vs-toSorted, `==` vs `===`, async/await vs .then chain, etc. **First surface drilling RELATIONAL retrieval** ("are these two equivalent?") rather than categorical pick-one. Schema-additive `state.swapBench`.

---

## Demoted (decisions, not candidates)

These ideas were considered and explicitly demoted; recorded here so future iters don't re-propose them without new evidence.

- **Code-reading speed drill** *(demoted iter 38)* — user feedback: code-writing is the priority for the rusty engineer; reading-speed drills don't address the primary deficit.
- **Pure-flashcard pattern mode** *(demoted iter 38)* — same reason (code-writing > code-reading; abstract cards don't drill production).

---

## Maintenance

- When an entry in `ideas-by-category.md` ships, move its detailed text here and replace the original (if any) with a one-line link to this file.
- Keep entries terse: 1-3 sentences of mechanism + LOC / probe / schema-field references if relevant.
- Demoted entries get a one-line note here so future iters don't re-propose them.
- Order within each category is roughly chronological by ship iter. Cross-category surfaces (where a ship spans multiple buckets) go in their own section at the bottom rather than duplicating across buckets.
