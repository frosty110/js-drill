# Feature Roadmap

> Populated by `vision`-mode iterations of the drill-improve loop (see
> `.claude/skills/drill-improve/SKILL.md` § Step 2D). Consumed by
> `ship`-mode iterations via the `[product/feature-scaffold]` →
> `[product/feature-wire]` → `[product/feature-ship]` multi-iter pattern.
>
> Established iter 24 (frame mode) as part of the BS-14 restructure.
> First entries seeded iter 26 (vision mode).

---

## Entry format

```
### {YYYY-MM-DD} iter {N} — {short name}

**Status:** queued | scaffolded | wired | shipped | superseded | abandoned

**Value claim** (one sentence): {what user need this addresses; cite PROFILE.md if relevant}
**Mechanic** (one sentence): {how the feature would work in concrete terms}
**Success criterion** (one falsifiable sentence): {what would be measurably different about the user's drilling}
**Estimated scope:** {single-iter ship | 2-iter scaffold+ship | 3-iter scaffold+wire+ship}
**PROFILE.md amendment proposed?** {yes/no — if yes, the amendment is drafted (commented out) in PROFILE.md awaiting a frame iter}
**Adversary's note** (if previously contested): {what the adversarial subagent said}
```

---

## Meta-finding (iter 64 vision — premise-validation pattern reproduced for 5th time)

**Sixth vision iter (after 26/31/48/55/59).** Second vision iter to use the iter-55 shipped-surfaces-inventory mitigation; second iter to use the iter-59 "name the previously-untapped data dimension" criterion in subagent B's prompt. Both patterns produced clean outputs again — **0% duplicate-proposal rate** across both subagents.

**Subagent A (pure-fresh-eyes) returned 5 ambitious / content-authoring-heavy proposals:**
1. Whiteboard Mode (voice transcript + rubric tagging) — voice-recognition class, BLOCKED territory.
2. Variant Generator (3-5 parametric L3 variants per lesson) — content-authoring at per-lesson grain.
3. Live Cohort Race (Supabase leaderboard) — backend + PROFILE L75 anti-gamification concern.
4. Spec-to-Code L0 tier (function signature + invariants + edge case fields) — content-authoring per lesson.
5. Personal Cheatsheet Builder (pin + reorder + PDF) — partially recombination but mostly UX over redundant-with-existing-cheatsheet.

**Subagent B (constraint-aware) returned 5 ship-feasible proposals, each naming the data dimension:**
1. Section Speedrun (section as a timed unit). PROMOTED.
2. Mechanic Drilldown (in-context lateral transfer from Reference tab — verified by grep that Reference has no mechanic chips today). HELD — clean candidate for next vision iter or direct-promotion.
3. Resurrect Queue (decay magnitude on temporal axis). PROMOTED (top by impact — closes a real PROFILE measurement gap).
4. Streak-Risk Tile (prospective time on history axis — "you're about to break your streak"). HELD with concern — the framing brushes PROFILE L75 anti-gamification ("can't recover from broken streak" trap); needs careful design or might not ship at all.
5. Track Balance Compass (allocation balance across track axis). PROMOTED.

**Promoted top 3 by impact:** Resurrect Queue → Section Speedrun → Track Balance Compass. All single-iter ships in ≤140 LOC; pure data recombination; no PROFILE amendments; no per-lesson authoring; no new state schema. § Next iteration nominates Resurrect Queue ship.

**Held for follow-up:**
- **Mechanic Drilldown** — verified differentiated (Reference tab has no inline mechanic chips today), candidate for direct-promotion in a future ship iter (iter-59 Mechanics Heatmap precedent — direct-promote saves vision-iter subagent budget).
- **Streak-Risk Tile** — anti-gamification framing risk. Either ship with very careful copy ("1 lesson would land an event today" not "you're about to break your streak") or skip entirely.

**Subagent A's proposals retained for future amendment-iter / content-authoring iters:**
- Whiteboard Mode → re-attempt after PROFILE Amendment C ratifies (currently audio-class blocked, 5x).
- Variant Generator → requires per-lesson content authoring; could be one large content-authoring iter or a per-lesson opt-in field.
- Live Cohort Race → BLOCKED by PROFILE L75 anti-gamification + requires Supabase backend (user has shipped sync infra out-of-band; race surface would build on it).
- Spec-to-Code L0 → requires per-lesson contract authoring; framed as an "L0 tier" of the ladder which would need PROFILE update.
- Personal Cheatsheet Builder (pinning + reorder) — partially constraint-feasible if scoped to just `state.pinned[]` + reorder, dropping PDF export.

---

## Meta-finding (iter 59 vision — shipped-surfaces inventory worked)

**The iter-55 mitigation landed cleanly.** Iter 55 surfaced a 60-80% duplicate-proposal rate caused by the fresh-eyes prompt forbidding reads of SELF-IMPROVE / iteration log / app.js. Mitigation = add a `## Already-shipped surfaces (do not repropose)` inventory to the subagent prompt (sidebar buttons + per-lesson tab surfaces + Stats tiles + BLOCKED entries). Iter 59 was the first vision iter to use the mitigation.

**Result:** subagent A (pure-fresh-eyes) and B (constraint-aware) BOTH proposed ZERO duplicates of shipped surfaces — a clean drop from 60-80% → ~0% across both subagents. The inventory cost ~25 lines of prompt budget per subagent and saved every subagent slot for novel proposals.

**Asymmetric subagent pattern reproduced (fifth time after iters 26/31/48/55):** A went ambitious (audio rehearsal with SpeechRecognition, peer-paired WebRTC, content-authoring-heavy proposals) and B stayed strictly inside the constraint regime. A produced 5 high-engineering-cost ideas with PROFILE Amendment dependencies; B produced 5 single-iter-ship pure-data-recombination ideas. The two subagents do NOT converge on the same proposals under this regime — the constraint preamble is doing the work. **A's value is now in the "what would the loop never reach" function:** Talk-Track Recorder + Friend-Mode + Idiom Glossary + Live Variant-Generator are all worth their own future vision iters under different constraint regimes (e.g., after PROFILE Amendment ratification, or after a content-authoring iter).

**Subagent B's framing tool — "what previously-untapped dimension of existing data does this surface?":** All 5 B proposals named their dimension explicitly (calendar density, track×tag transfer, within-lesson temporal, risk intersection, forward projection). This is a sharper "new bucket" test than the original constraint preamble's "prefer recombination over modality" framing. Worth folding into future vision-iter prompts.

**4th promotion candidate not taken this iter:** B#2 Mechanics Heatmap (Track × Tag Matrix) — joins `lesson.mechanics[]` (73% coverage across 151 lessons, 38 unique tags per iter-59 corpus scan) × `lesson.track` × `state.progress`. Would surface transfer gaps like "mastered sliding-window in syntax, failed it in patterns." Held back from top-3 only because the existing Mechanics modal partially serves the lesson-grouping use case; the Heatmap's matrix view is differentiated but lower-priority than the 3 promoted entries. Re-promote in a future vision iter if the top-3 ship cleanly.

**5th promotion candidate not taken this iter:** B#5 Section Velocity Pacer (forward-projection ETA chip per section) — the "forward-projection" dimension is novel and B made a clean case, but ETA predictions need ≥14 days of `lastPassedAt` history to be non-noisy, which means the surface stays empty for new users. Lower priority than the 3 promoted entries which all work from day 1.

---

## Meta-finding (iter 55 vision — fresh-eyes priming ceiling)

**The shipped-feature blindness problem.** Iter 55 spawned 2 vision subagents (A pure-fresh-eyes, B constraint-aware) per the iter-31/iter-48 successful pattern. **Both subagents independently reproposed Pattern Recognition Speed Drill** (A#1 + B#4) — a feature SHIPPED iter 49 as 🔎 Recognize. Subagent A additionally reproposed: Audio Mode (already iter-26 BLOCKED), Concept-tag Mistake Ledger (already iter-48 #3 queued), and Mechanics Map progress view (already in shipped Mechanics modal as "mastered/total badge"). Net: 4 of 5 A-proposals and 2 of 5 B-proposals were duplicates of already-shipped or already-queued features.

**Root cause:** the fresh-eyes prompt template instructs "read PROFILE.md + README.md + manifest.json (titles only); do NOT read SELF-IMPROVE.md / iteration log / .claude/skills/" to avoid priming bias. But it also forbids reading `index.html` / `app.js`, so subagents can't see which UI surfaces already exist. README.md mentions some features but not all (no Recognize mention; no Mechanics modal mention by name).

**Mitigation for future vision iters:** the subagent prompt should include a `## Already-shipped surfaces (do not repropose)` section listing the sidebar control-row buttons + main-viewport modes by emoji + one-line description. This costs ~15 lines of prompt budget and eliminates the 60-80% duplicate-proposal waste rate. Do NOT include the SELF-IMPROVE.md history — that's still bias. Just the user-visible inventory.

**Independent confirmation value:** the duplicates aren't pure waste — they confirm shipped features were independently designable from PROFILE.md + manifest titles, which validates the design fits the rusty-engineer profile. The Recognize convergence (A#1 + B#4) is the second time two independent fresh-eyes hit it (iter-26 + iter-48 also had A+B convergence on Pattern Recognition). High signal-to-noise that Recognize is genuinely load-bearing, which the user-driven iter 51 Stats lifetime-tile follow-up reinforces.

---

## Meta-finding (iter 31 vision)

**The 3-pivot streak diagnosis.** Iters 28, 29, 30 all PIVOTED per adversary — pivot-rate 3/4 = 75%. The cross-iter pattern (surfaced independently by iter-31 vision subagent B): **the loop is over-indexing on "ambitious new modality" features when the shippable gradient is "recombine existing 143-lesson × 3-level × 327-exercise data into one new mobile-first surface per iter."**

Each iter-26 roadmap entry trips this:
- **Entry #1 (Pattern Recognition Speed Drill)** — requires per-lesson `problem` field authoring OR sanitization regex that the iter-30 adversary verified can't survive 44/79 = 56% function-name leak rate. Also depends on un-ratified PROFILE Amendment A. **BLOCKED until BS-15 ships (per-lesson `problem` field) AND PROFILE Amendment A ratifies via frame iter.**
- **Entry #2 (Error Post-Mortem with Miss Classification)** — depends on un-ratified PROFILE Amendment B (metacognitive ownership as a need). **BLOCKED until Amendment B ratifies.**
- **Entry #3 (Commute Audio Mode)** — depends on un-ratified PROFILE Amendment C (eyes-free phone time). Roadmap entry's own adversarial counterpoint says "pre-ship Page Visibility instrumentation alone to measure screen-off intervals before building audio UI" — that's a non-ship-iter prerequisite. **BLOCKED until Amendment C ratifies AND instrumentation ships.**

So all 3 iter-26 entries are governance-blocked. They are NOT abandoned — they remain queued, but require a frame iter to ratify their PROFILE amendments before they can be the next ship target. The frame-rate ceiling (≤2 per rolling 10) currently blocks a frame iter via SKILL.md guardrails; user override would be needed.

**iter-31 entries below** are deliberately constructed to NOT have these dependencies: no per-lesson authoring, no PROFILE amendment, no instrumentation prerequisite. They consume the existing data corpus into a new mobile-first surface. The pivot rate going forward should drop sharply if these entries are well-designed.

---

## Queued

## Meta-finding (iter 95 vision — eighth vision iter; iter-90 queue fully drained)

**Eighth vision iter (after 26/31/48/55/59/64/82/90).** Iter-90 vision queue (Conv Drill iter 91 + Trace-Hop iter 93 + Mechanic-Bridge iter 94) fully shipped this week — the FASTEST queue-to-drain rate in loop history. Iter 95 fires vision to refresh the queue per SKILL.md Step 1B ("shipping is genuinely blocked when Step 1A surfaces nothing").

**Single constraint-aware subagent (iter-82/iter-90 cost-conservative precedent).** Returned 5 proposals each naming a previously-untapped data dimension explicitly per the iter-59 framing.

**Promoted top 3 by impact + feasibility (orchestrator adjusted subagent's ranking):**
1. 📝 **Notes Cloze Tap-Drill** (subagent #1) — exploits `reference.notes[]` text strings as cloze sources (currently display-only). Different from 🎰 Gotcha (whole-note yes/no recognition) and 🃏 Flash (code-token cloze). Cloze-with-distractors is a third recall direction over the same field.
2. 🧠 **Mechanic Constellation** (subagent #4, orchestrator-boosted) — uses `mechanics[]` tags as the *primary axis* of a recall task ("name 3 lessons that use the visited-set mechanic"). Currently mechanics are display-only across Mechanics modal / Matrix view / Bridge routing. None TESTS the user at the mechanic grain.
3. ⏪ **Reverse-Walkthrough** (subagent #5, orchestrator-boosted) — given final `{state, returns}` of a walkthrough trace, pick which of 4 inputs produced it. Same-lesson examples used as distractor pool (feasibility caveat: needs ≥4 examples per lesson — many have 2-3; ship will need a per-lesson eligibility filter). Novel end-state → input direction.

**Held (NOT promoted) with documented reasons:**
- 🎚 **Calibrated L1 Stream** (subagent #1 by their ranking) — **BLOCKED on schema**: needs per-question miss-rate granularity, but `state.misses[]` is per-lesson grain (iter-58 schema). Would need either (a) schema bump to track per-question misses, OR (b) on-miss instrumentation in L1 render path that writes `{lessonId, questionIdx}`. Re-promote after a frame iter ratifies the schema change.
- 🔮 **Output-Predict L2** (subagent #3) — **distractor-quality concern**: L2.exercises[].template strings across sibling lessons look structurally identical (fill-in skeletons), so distinguishing real from distractor templates degenerates to "guess which one has the right blank shape" — not a useful recall signal. Could ship if distractors are drawn from FAR-AWAY sections (different sections + different mechanics), but the pool may shrink too much.

**Meta-learning (iter 95):** the subagent's leverage-per-effort ranking is a useful starting heuristic but not authoritative — orchestrator's feasibility cross-check caught 2 of 5 proposals with implementation blockers (schema dependency + distractor degeneracy) that the prompt didn't surface. Future vision-iter prompts could include an explicit "feasibility self-check" instruction asking the subagent to name 1 implementation risk per proposal. § Next nominates 📝 Notes Cloze Tap-Drill ship for iter 96+ (post-`/clear`).

---

### 2026-05-25 iter 95 — Notes Cloze Tap-Drill

**Status:** SHIPPED iter 97. 📝 Notes sidebar pill (yellow-200 hover — paper/parchment color) → 12-card mobile session. Each card shows ONE `reference.notes[i]` string with one keyword blanked via heuristic (last eligible token: ≥4 chars + not in 50-stop-word filter + at least one letter) + 4 MC options (correct + 3 unique distractors from notes in OTHER lessons, preferring same section). Tap locks all 4, marks correct green + picked-wrong red, reveals full note with picked keyword highlighted + lesson + section + "Drill this lesson →" + Next card. Misses route to `state.weakness`. New helpers: `_notesStripPunct`, `_notesIsEligibleWord`, `_notesPickBlank` (reverse-walk token strategy), `_notesCollectDistractors` (same-section-first pool with fallback), `_notesDrillBuildDeck`, `startNotesDrillSession`. Schema-additive `state.notesDrill = { attempts, correct, sessions, lastRunAt }`. ~235 LOC JS + ~70 CSS. Mobile probe 5/5 PASS first try; orchestrator caught cosmetic "reduce)." trailing-punct distractor on initial run and tightened the strip regex (`[^a-zA-Z0-9_.\-]+$` → `[^a-zA-Z0-9_]+$`); re-run probe confirmed clean distractors [matrix/exactly/direction/height]. **Third recall direction over `reference.notes[]`** — iter-83 🎰 Gotcha tests whole-note recognition; iter-35 🃏 Flash tests code-token cloze; Notes Cloze tests note-keyword cloze with MC distractors. **Implementation-risk pre-decision worked:** the iter-95 roadmap entry pre-flagged the keyword-blanking heuristic + mitigation ("simple heuristic: last-token-≥4-chars + not in stop-words; refine with usage data"); ship implemented exactly that strategy and landed clean. Vision-iter entries that pre-decide implementation strategy de-risk the subsequent ship.

**Value claim:** PROFILE.md §State they're in ("forget exact method names, argument order, the small ceremonies") + §What they need ("recall under pressure"). The `reference.notes[]` field carries the load-bearing gotchas — what interviewers actually probe — but currently they're only visible passively when Reference tab is open. The rusty engineer rarely re-opens Reference once a lesson is amber. Gotcha (iter 83) tests recognition of whole notes; Flash (iter 35) tests cloze on code tokens; none tests cloze-with-distractors on the notes themselves.
**Mechanic:** New 📝 sidebar drill. Pulls a random `reference.notes[i]` from any mastered/amber lesson. Picks one keyword to blank (heuristic: ≥4 chars, not a stop-word, ideally appears in `reference.code` for cross-validation that it's load-bearing). Shows the note with `___` in place of the keyword. Renders 4 tap options: the real keyword + 3 distractors sampled from same-section notes. 12-card session. Misses route to `state.weakness`.
**Success criterion:** Gotcha miss rate drops measurably for users who run Notes Tap-Drill 3+ times (notes content moves from passive reading to active recall). Lifetime hit rate trends up week-over-week.
**Estimated scope:** single-iter ship (~110 LOC JS + ~25 CSS). Reuses Gotcha card stack + Recognize shell base.
**Data dependency:** none — `reference.notes[]` exists on 143/143 full lessons (typical 2-5 notes per lesson). Schema-additive `state.notesDrill = {attempts, correct, sessions, lastRunAt}`.
**PROFILE.md amendment proposed?** No.
**Implementation risk (orchestrator-flagged):** keyword-blanking heuristic is fiddly — some notes are 1 short sentence with no clear cloze target; others are multi-clause and benefit from blanking the LAST distinctive word. Ship MVP with a simple heuristic (last-token-≥4-chars + not in stop-words); refine with usage data.
**Why this is a "new bucket" not "better cell":** uses **`reference.notes[]` as the *prompt source* with MC distractors**, not as display content. Gotcha = recognition; Flash = code cloze; Notes Tap-Drill = note cloze with distractors. Three distinct recall directions over three distinct fields.
**Subagent source:** iter-95 vision iter — top by leverage-per-effort + clean data dimension; smallest scope risk among the 3 promoted.

---

### 2026-05-25 iter 95 — Mechanic Constellation Quiz

**Status:** queued (vision iter 95 — second promoted entry; converts `mechanics[]` from display-only to recall target)

**Value claim:** PROFILE.md §What they need #2 ("pattern fluency… produce them without thinking"). The Mechanics modal (iter 63) + Mechanics × Track Matrix (iter 63) + 🧠 Bridge (iter 94) all use `mechanics[]` as a *display/routing* axis. None TESTS whether the user can name which lessons use a given mechanic — and that's the actual interview-transfer skill ("oh, this is just a visited-set problem"). Active retrieval at the mechanic grain.
**Mechanic:** New sidebar 🧠 (different from Bridge's 🧠 — pick a different emoji like 🪐 Constellation or 🎯 Identify) → 10-card session. Each card shows ONE mechanic name (e.g., "monotonic stack") + 6 lesson titles. 3 titles are actually tagged with that mechanic (from MECHANIC_INDEX); 3 are NOT (sampled from same-section/track for plausibility). User multi-selects the 3 correct titles. Reveal shows actual mechanic tag list per title + drill CTA to any of them. Misses route to `state.weakness` on every wrong-tap.
**Success criterion:** Per-mechanic identification accuracy predicts cross-track transfer (Bridge ship-through rate); users who run Constellation 5+ times show measurably higher Bridge engagement (= they recognize bridging opportunities before the loop surfaces them).
**Estimated scope:** single-iter ship (~130 LOC JS + ~25 CSS). Uses MECHANIC_INDEX from iter-63; lazy-loads via existing `ensureMechanicIndex()` path (iter-94 precedent).
**Data dependency:** none — MECHANIC_INDEX populated on first call; 73% mechanics-field coverage per iter-63. Schema-additive `state.mechConstellation = {attempts, correct, sessions, lastRunAt}`.
**PROFILE.md amendment proposed?** No.
**Implementation risk:** mechanics with very few tagged lessons (<4) won't yield a 3-correct quiz card; filter to mechanics with ≥3 tagged lessons + skip otherwise. Per iter-63 inventory there are ~30 such mechanics.
**Why this is a "new bucket" not "better cell":** **first surface drilling mechanics as a recall TARGET** (vs Bridge/Matrix/modal which all USE mechanics as input). Multi-select tap is also a recall mode L1's single-correct MC doesn't cover.
**Subagent source:** iter-95 vision iter — second by impact (cleanest data substrate, no per-lesson authoring, novel multi-select mode).

---

### 2026-05-25 iter 95 — Reverse-Walkthrough (end-state → input)

**Status:** queued (vision iter 95 — third promoted entry; backward direction over walkthrough trace data)

**Value claim:** PROFILE.md §State they're in ("can't produce canonical from blank in 5 min"). Walkthrough plays forward (input → state evolution); Trace-Hop tests mid-state recall. The third direction — given the *final* state, what was the input? — exercises backward state-machine reasoning. Interview-relevant move: "if this code RAN and produced this state, what input did it process?"
**Mechanic:** New sidebar ⏪ button → 8-card session. Each card pulls a random Patterns/Applied lesson with ≥4 `walkthrough.examples[]`. Runs trace on each example; shows ONLY the final `{state, returns}` of one example. Renders 4 candidate input shapes (the real input + 3 from sibling examples in THE SAME LESSON, so input shapes are compatible — avoids type-mismatch giveaways). Tap which input produced this final state. Reveal shows trace context + lesson + drill CTA. Misses route to `state.weakness`.
**Success criterion:** Per-lesson Reverse-Walkthrough accuracy correlates with L3 first-attempt pass rate on long-untouched mastered lessons (measuring whether backward-state reasoning predicts canonical-recall fidelity).
**Estimated scope:** single-iter ship (~150 LOC JS + ~30 CSS). Reuses `_compileWalkthrough` cache (iter-78/iter-93 precedent) + Gotcha card stack.
**Data dependency:** lessons with ≥4 examples. **Feasibility caveat:** many lessons have only 2-3 examples; ship will need an eligibility filter that drops lessons with <4 examples from the pool. Schema-additive `state.reverseWalk = {attempts, correct, sessions, lastRunAt}`.
**PROFILE.md amendment proposed?** No.
**Implementation risk (orchestrator-flagged):** eligibility-filter shrinks the pool. If <8 lessons have ≥4 examples, the deck-build will fail and the surface degrades to alert("not enough lessons"). Mitigation: relax to ≥3 examples + sample 3 from the SAME lesson (instead of 4 from 4 candidates); accept some same-lesson distractor pressure as the design constraint.
**Why this is a "new bucket" not "better cell":** Walkthrough/Trace-Hop test forward-direction state recall; this tests **backward direction** (end-state → input) — same trace data, opposite cognitive operation. None of the existing 9 walkthrough-pivoting surfaces drill this.
**Subagent source:** iter-95 vision iter — third by impact (most novel cognitive direction, feasibility caveat noted, smallest scope risk among walkthrough-pivots).

---

### 2026-05-25 iter 95 — HELD: 🎚 Calibrated L1 Stream (BLOCKED on schema)

**Status:** HELD — needs a schema-bump frame iter before it can ship.

**Value claim:** Rapid-Fire treats all L1 questions as equal-weight; calibrating by per-question empirical miss-rate would 2x signal density per session by surfacing the user's actually-hardest items first.
**Mechanic:** For each `{lessonId, questionIdx}`, derive a difficulty score from historical misses + reveal-flag + weakness count. Stream items in user's hardest quartile as 2-tap MC cards; missed items boost.
**Why blocked:** `state.misses[lessonId]` (iter-58 schema) is per-lesson grain — it tracks WHICH lesson the user missed L1 on, but not WHICH question within the lesson. Calibration needs per-question grain. **Frame-iter prerequisite:** decide between (a) schema bump to add `questionIdx` to misses, OR (b) new `state.itemHistory: { [lessonId-questionIdx]: { misses, lastMissAt } }` field. Once ratified, ship is ~120 LOC.

---

### 2026-05-25 iter 95 — HELD: 🔮 Output-Predict L2 (distractor degeneracy)

**Status:** HELD — distractor-quality concern; may not ship as-is.

**Value claim:** Show `L2.exercises[].expectedOutput`; pick which of 4 candidate `template` strings produced it. Tests output→code-shape reasoning (the missing third corner of code/output/problem triangle).
**Why held:** L2.exercises[].template strings across sibling lessons look structurally identical (fill-in skeletons with `___` markers in similar positions). Distinguishing the real template from 3 distractors degenerates to "spot the right blank shape" — not a useful recall signal. Could ship if distractors are drawn from FAR-AWAY sections (different track + different mechanics), but the pool may shrink to <4 candidates per card.
**Re-promote condition:** if a future iter audits L2 templates and finds enough structural diversity in a curated cross-section pool. Until then, hold.

---

### 2026-05-25 iter 90 — Conversation Drill (interview-arc section classifier)

**Status:** SHIPPED iter 91. 🎬 Conv sidebar button → 10-card mobile session. Each card shows ONE `conversation.sections[i].say` paragraph (~100-700 chars) with the section title HIDDEN; user taps which of 6 fixed interview phases it is (🎯 Restate / 🧱 Brute force / 💡 Spot pattern / 🔍 Trace / ⚠️ Edge cases / 📏 Complexity). Tap locks all 6 options, colors the actual phase green + picked-wrong red, reveals actual `sectionTitle` + lesson title + section + "Drill this lesson →" deep-link + "Next card" CTA. Misses route to `state.weakness` via existing path. New helpers: `_convDrillPhaseIdx` (regex `/^\s*([1-6])\b/` over section.title), `_convDrillBuildDeck` (preloads 40 random Patterns/Applied lessons, flattens sections with `say ≥ 100 chars`, Fisher-Yates, slices 10), `startConvDrillSession`. Schema-additive `state.convDrill = { attempts, correct, sessions, lastRunAt }`. ~155 LOC JS + ~45 LOC CSS (fuchsia accent — distinguishes from Gotcha pink, Swap indigo, Crystal purple). Mobile probe `tools/cdp/conversation-drill.js` 5/5 PASS. **No adversary** — Step 2 mitigation on "6 fixed numbered titles → trivially solvable" verified by probe finding ~750-char paragraphs that require interview-phase reading (numbers are stripped/hidden). **First surface to test the 6-section interview-arc skill** that 99 OOB-2026-05-24 lessons authored — confirms the iter-90 vision iter's "largest authored corpus the app has never tested" thesis.

**Value claim:** PROFILE.md §What they need #3 ("interview-format conditioning… cadence of read prompt → talk through approach"); the existing Conversation tab on 99 Patterns/Applied lessons is read-only — the 6-section interview arc (Restate / Brute-force / Spot-pattern / Trace / Edges / Complexity, varies by lesson shape) is genuinely a load-bearing skill (recruiters grade the arc, not just the code) but no current surface tests it.
**Mechanic:** Sidebar 🎬 button → 10-card mobile stream. Each card shows ONE `conversation.sections[i].say` paragraph with the section title HIDDEN; user taps which of the 6 fixed interview-phase types it is. Reveal shows actual title + source lesson + "Drill this lesson →" deep-link CTA. Misses route to `state.weakness` via existing path.
**Success criterion:** Among users with ≥5 Conversation Drill sessions, mock-interview personal-best times trend down measurably; lifetime hit rate on "which interview phase is this?" trends up week-over-week.
**Estimated scope:** single-iter ship (~150 LOC JS + ~30 CSS). Reuses Rapid-Fire shell with content drawn from `conversation.sections[]` instead of `L1.questions[]`.
**Data dependency:** none — every full Patterns/Applied lesson with a `conversation` block (99/99 per OOB-2026-05-24) has 3-6 `.sections[]` each with `.title` + `.say`. Schema-additive `state.convDrill = {attempts, correct, sessions, lastRunAt}`.
**PROFILE.md amendment proposed?** No.
**Why this is a "new bucket" not "better cell":** Uses the **6-section interview-title axis as a classification target** — today the section titles are decoration in a static accordion; nothing has ever quizzed the *structural arc* of an interview answer as its own skill. Distinct from 🔎 Recognize (uses L3 prompts → section names from the 28-section sidebar curriculum) and the Conversation tab itself (reveal-only read).
**Subagent source:** iter-90 vision iter — top by leverage-per-effort; largest under-exploited authored corpus.

---

### 2026-05-25 iter 90 — Trace-Hop (pick-the-next-state mobile micro-quiz)

**Status:** SHIPPED iter 93. 🧬 Trace-Hop sidebar button (green accent, not 🎯 — that's taken by Reverse + Mock) → 8-card mobile session. Each card shows 3 CONSECUTIVE trace frames (K-1, K, K+1) with the MIDDLE frame's `state` panel BLANKED (`?  ?  ?`); user taps which of 4 state-objects fits there. Distractors sampled from OTHER frames of THE SAME TRACE excluding K-1 and K+1 (which are visible — would be trivially-wrong giveaways), so the user reasons about positional state recall, not type-matching. Reveal shows ✓/✗ + correct letter + lesson title + section + "Drill this lesson →" deep-link + Next card. Misses route to `state.weakness` via existing path. New helpers: `_traceHopStepKey`, `_traceHopBuildCard` (compiles via `_compileWalkthrough` + picks example with ≥5 steps + picks K with non-empty state + builds shuffled 4-option array), `_traceHopBuildDeck` (iterates shuffled Patterns/Applied candidates, accumulates 8 cards), `_traceHopFormatState`, `startTraceHopSession`. Schema-additive `state.traceHop = { attempts, correct, sessions, lastRunAt }`. ~245 LOC JS + ~85 LOC CSS. Mobile probe `tools/cdp/trace-hop.js` 5/5 PASS. **First surface drilling positional state recall** — distinct from 🪲 Walkthrough Bug-Hunt's anomaly-detection direction. **Zero per-lesson authoring** — every walkthrough-bearing lesson (99/99) inherits the surface for free.

**Value claim:** PROFILE.md §State they're in ("can't produce canonical from blank in 5 min") + §Usage context (L1 tap is highest-throughput on mobile). The Walkthrough tab is desktop-friendly scrubbing — read-only mental simulation; this surface inverts it into a discrete-state recall test. Mid-execution state ("after line 7, what's the locals snapshot?") is the exact mental model the rusty engineer needs to *write* the code from scratch.
**Mechanic:** Sidebar 🎯 (or different emoji — 🎯 is taken by Reverse and Mock; use 🧬 or 🔬) → 8-card session. Each card shows 3 consecutive state-snapshots from a random walkthrough trace with the *middle* frame's `state` panel blanked; user taps which of 4 state-objects fits (3 distractors auto-sampled from other frames of the same trace — so the user reasons about *which* step belongs here, not just type-matching). Reveal shows the trace context + lesson.
**Success criterion:** Per-lesson Trace-Hop accuracy predicts L3-pass on first attempt (correlation ≥ 0.5 within 30 days); users with ≥3 sessions show measurably higher L3 pass rate on unseen Patterns lessons.
**Estimated scope:** single-iter ship (~180 LOC JS + ~30 CSS). Trace generators already compile at runtime (since iter 33+ walkthrough infrastructure); collect 3 consecutive yields + shuffle distractors from same trace.
**Data dependency:** none — `walkthrough.trace` exists on 99 Patterns/Applied lessons (per OOB-2026-05-24). Schema-additive `state.traceHop`.
**PROFILE.md amendment proposed?** No.
**Why this is a "new bucket" not "better cell":** Uses **walkthrough trace yields as a discrete-state corpus** — the only existing surface that touches mid-execution state is the visual stepper (read-only). Distinct from 🪲 Walkthrough Bug-Hunt (which mutates a state value and asks "which row is corrupted") — Trace-Hop asks "given the line that just ran, which locals snapshot is correct?" — a different cognitive operation (positional recall vs. anomaly detection).
**Subagent source:** iter-90 vision iter — second by leverage-per-effort; activates trace corpus that's never been read for recall.

---

### 2026-05-25 iter 90 — Mechanic-Bridge (cross-track transfer routing)

**Status:** SHIPPED iter 94. 🧠 Bridge sidebar pill (fuchsia, mechanic-family color) auto-hides when no transfer gaps exist; appears with count once `MECHANIC_INDEX` builds. `_bridgeCandidates()` walks `MECHANIC_INDEX × state.progress × manifest.track`: for each mechanic, buckets lessons into mastered-per-track + unmastered-per-track first-hits, emits ONE candidate per mechanic where a cross-track pair exists. Tap routes to the first candidate's target lesson at L1 + fires a 2.2-sec fuchsia toast ("🧠 You know **<mechLabel>** from **<sourceLessonTitle>** — try it here.") via `_showBridgeToast` reusing the iter-56 reveal-toast styling family. Lazy-loads `MECHANIC_INDEX` via existing `ensureMechanicIndex()` on first updateReviewBadge call. ~85 LOC JS + ~3 LOC CSS. Mobile probe `tools/cdp/mechanic-bridge.js` 5/5 PASS. **iter-90 vision queue FULLY DRAINED** with this ship — Conv Drill iter 91 + Trace-Hop iter 93 + Mechanic-Bridge iter 94 all SHIPPED in the same week. Closes the iter-63 Mechanics × Track Matrix's "diagnostic-but-not-actionable" gap on a load-bearing PROFILE need (pattern fluency / produce without thinking).

**Value claim:** PROFILE.md §What they need #2 ("pattern fluency… so they produce them without thinking"). The existing 🧩 Mechanics × Track Matrix view (iter 63) *shows* transfer gaps (mechanic mastered in track A, unmastered in track B) but never *closes* them — the user sees the ⚠ marker and… does nothing. This surface converts the diagnostic into a routing action.
**Mechanic:** New sidebar pill 🧠 Bridge → picks a `mechanics[]` tag the user has mastered in one track but unmastered in another (e.g., "array-as-queue" mastered in `syntax/s-queue-pattern` but unmastered on `patterns/p-bfs`); routes user to the unmastered lesson's L1 with a 1-line "you know this from <other lesson> — try it here" preface above the question. Auto-hides when no transfer gaps exist.
**Success criterion:** Time-to-master a lesson reached via Bridge is shorter than the same lesson reached cold (measured: timestamp of first-open → green dot). Within 30 days, ≥3 cross-track mastery transfers from Bridge sessions.
**Estimated scope:** single-iter ship (~120 LOC JS + ~20 CSS). One query joining `MECHANIC_INDEX × state.progress × manifest.track`.
**Data dependency:** none — `mechanics[]` array already exists on lessons (73% coverage as of iter 63), `state.progress` already populated. Pure derivation; no new state.
**PROFILE.md amendment proposed?** No.
**Why this is a "new bucket" not "better cell":** Uses **mechanic-track intersection as a routing signal**, not a stats display. 🧭 Track Balance Compass (iter 66) operates at track-grain percentages; 🧩 Mechanics × Track Matrix (iter 63) is a diagnostic view that requires the user to navigate manually; Bridge is the only surface that converts the matrix finding into a 1-tap action. Closes the "diagnostic-but-not-actionable" gap on a load-bearing PROFILE need.
**Subagent source:** iter-90 vision iter — third by leverage-per-effort; cheapest of the top 3 + smallest scope risk.

---

### 2026-05-25 iter 82 — Gotcha Roulette (notes-only recall stream)

**Status:** SHIPPED iter 83. 🎰 Gotcha sidebar button → 8-card session showing one `reference.notes[i]` string per card with source lesson title hidden (rendered as `<Section> · ???`); 2-tap "✓ Knew it" / "✗ Didn't"; reveal shows lesson title + section + "Drill this lesson →" deep-link CTA + "Next card" button. Misses route to `state.weakness` via existing path. New helpers `_gotchaBuildDeck()` (flatten all `reference.notes[]` ≥20 chars across loaded lessons, Fisher-Yates shuffle, slice 8) + `startGotchaSession()`. Schema-additive `state.gotcha = {attempts, correct, sessions, lastRunAt}`. ~140 LOC JS + 40 CSS (pink accent). Mobile probe `tools/cdp/gotcha-roulette.js` 4/4 PASS. **Scope adjustment from spec**: used 2-button tap instead of swipe gesture (per Step 2 mitigation — same UX intent, more testable + cross-browser safer). **First surface to read `reference.notes[]` as a corpus** — confirms the iter-82 subagent's data-dimension thesis.

**Value claim:** PROFILE.md § State they're in — "forget exact method names, argument order, the small ceremonies" + line 31 mobile L1/L2 throughput. The rusty engineer half-remembers traps (`splice` mutates, `==` coerces, `for-in` on arrays is wrong) but the existing surfaces all bury those one-liners inside the full lesson. A standalone stream over `reference.notes[]` strings lets the user surface and drill the traps without the navigation cost of opening each lesson — gym-friendly, phone-friendly.
**Mechanic:** Sidebar pill `🎰 Gotcha` opens a card stack like 3-Card Warmup. Each card shows ONE `reference.notes[i]` string with the source lesson title blurred. Tap reveals the lesson + a "drill this" CTA that deep-links to L1 of the source. Swipe-left = "knew it", swipe-right = "didn't" → writes to `state.weakness[lessonId]` on right-swipe.
**Success criterion:** ≥40% of Gotcha Roulette right-swipes convert to an L1 attempt on the source lesson within the same session (tracked via `state.history` event sequence on the deep-linked lesson).
**Estimated scope:** single-iter ship (~120 LOC JS + ~30 LOC CSS; flatten all `reference.notes[]` once on first session start, card stack, swipe handler, weakness write — reuses 3-Card Warmup primitives + Reveal Replay's tap-to-route pattern).
**Data dependency:** none — every full lesson has 2-5 `notes[]` strings = ~400+ free cards across the 143-lesson corpus. No per-lesson authoring.
**PROFILE.md amendment proposed?** No.
**Why this is a "new bucket" not "better cell":** Standalone `reference.notes[]` strings as the atomic recall unit — every existing surface treats notes as ornamentation around code, never as the drilled artifact itself. The notes corpus has been on-disk since project start and read by ~zero surfaces.
**Subagent source:** iter-82 vision iter (single fresh-eyes subagent, constraint-aware preamble) — top of 3 proposals by leverage-per-effort.

---

### 2026-05-25 iter 82 — Distractor Mine (interleaved L1 from your own miss-options)

**Status:** queued (vision iter 82 — second promoted entry; needs richer miss-history first)

**Value claim:** PROFILE.md § What they need — "memorization tooling beyond L1→L2→L3 … elaboration" + the BS-08 audit's recurring-miss-types finding. The rusty engineer drills *the exact wrong answers their brain reaches for*, not the right ones they already know. Today miss-options are ephemera (shown once, never re-surfaced); this surface treats them as the primary corpus.
**Mechanic:** Sidebar pill opens a 15-card stream where each card is an L1 question reconstructed from `content.L1.questions[i]` but the correct option is replaced with a *distractor that the user previously selected on a different lesson* (option text matched by token overlap across `questions[].options[]`); user must spot that none of the four are correct and tap "none" — or if a real correct option survives, tap it.
**Success criterion:** Users who run Distractor Mine ≥3 sessions cut their repeat-L1-miss rate (same lesson, same question index, missed twice within 14 days in `state.history`) by ≥25% vs. baseline.
**Estimated scope:** 2-iter scaffold+ship — iter 1: extend miss-tracking to record `{lessonId, questionIdx, pickedOptionText}` per L1 miss (needs schema field); iter 2: stream builder + UI.
**Data dependency:** Today's `state.weakness[id]` is just a counter; need a NEW field `state.missLog[]` tracking which OPTION was picked per miss. Schema-additive scaffold required first.
**PROFILE.md amendment proposed?** No.
**Why this is a "new bucket" not "better cell":** Cross-lesson `questions[].options[]` text similarity — no existing surface treats wrong-option strings as a first-class corpus.
**Subagent source:** iter-82 vision iter — second proposal.

---

### 2026-05-25 iter 82 — Idiom Swap-Bench (side-by-side recombination drill)

**Status:** SHIPPED iter 86 (MVP at 12 pairs, expandable). 🔀 Swap sidebar button → 6-card session reading new `data/idiom-pairs.json` registry. Each card stacks two JS snippets VERTICALLY (mobile-first per PROFILE 80%-phone — the original "side-by-side" framing was honest-rescoped at ship time since two side-by-side code blocks don't fit on a 390px-wide iPhone SE viewport; stacked + a centered "↕ same behavior? ↕" divider is the mobile-native layout). Tap "Same behavior" / "Different behavior" grades against `pair.sameBehavior`; reveal shows verdict + curated `explain` + optional "Drill source lesson →" deep-link when `sourceLessonId` set. Misses route to `state.weakness[sourceLessonId]` via existing path. Schema-additive `state.swapBench = {attempts, correct, sessions, lastRunAt}`; no `__v` bump. The 12 MVP pairs cover canonical JS confusions: map-vs-for-mutates, filter-vs-reduce-accumulator, for-of-vs-for-in (on arrays), spread-vs-concat, Object.keys-vs-for-in, Array.fill shared-reference trap, ternary-vs-`??`, `||`-vs-`??` (the x=0 case), slice-vs-splice, Set-dedupe-vs-filter-indexOf, shallow-spread-vs-Object.assign, while-vs-tail-recursion. ~160 LOC JS + ~43 LOC CSS (indigo accent — first surface to use indigo). Mobile probe `tools/cdp/swap-bench.js` 5/5 PASS — button render, 2 stacked snippets + 2 options + divider + title, .swap-pair flex-direction=column AND fits viewport (338px ≤ 390px), tap-grade locks options + reveals verdict+explain+next button, state.swapBench.attempts incremented. Validator 687/0. active-recall.md updated. **No adversary** — Step 2 surfaced mobile-readability concern; self-rebutted with snippet-length constraint in data file (≤8 lines/snippet, verified by probe's actual viewport measurement). **The ~30-pair "curated idiom map" data dependency was downscoped to 12 at ship time** as MVP, following the iter-79 Claim precedent (shipped at 10 entries, iter-80 expanded to 25 by appending). Expandable without code changes. **First surface that drills RELATIONAL retrieval** (are these two equivalent?) rather than CATEGORICAL retrieval (pick which one).

**Value claim:** Forces the engineer to recognize that "the loop body is the same, the container choice is what changes" — collapses three syntax lessons into one transferable mental model. Closes the gap between syntax-track lessons and pattern-track usage of the same idiom.
**Mechanic:** Sidebar button picks a random `reference.code` from one Patterns lesson and shows it side-by-side with the SAME logic re-expressed using a *different* idiom auto-extracted from a Syntax lesson's `reference.code` in `Algorithms`/`Arrays` (e.g. `for-of` ↔ `.reduce`, `Map` ↔ plain object, `while` queue ↔ recursion); two-button tap: "same behavior" / "different behavior", then reveal.
**Success criterion:** Users who complete ≥10 Swap-Bench cards show a ≥15-point lift in L1 pass rate on the `Modern Syntax` + `JS Toolbox` sections in their next 7 days (per `state.progress[].L1`).
**Estimated scope:** single-iter ship if the idiom-pair table is hand-curated up front (~30 pairs, one-time authoring). ~250 LOC JS for the picker + side-by-side renderer + tap-grade.
**Data dependency:** New `data/idiom-pairs.json` curated map (~30 entries: `{a: 'for-of', b: '.reduce', same: true, snippet_a, snippet_b}`). Existing canonicals provide the source material.
**PROFILE.md amendment proposed?** No.
**Why this is a "new bucket" not "better cell":** Pairwise comparison of two lessons' `reference.code` strings — every existing surface drills one lesson at a time. Cross-lesson code-shape comparison is a new dimension.
**Subagent source:** iter-82 vision iter — third proposal.

---

### 2026-05-25 iter 64 — Resurrect Queue (staleness gradient on the SR axis)

**Status:** SHIPPED iter 65. 💀 Resurrect (N) sidebar pill listing mastered lessons where `now - dueAt > 2 * interval`. Tap routes to most-overdue at L2 (touch) or L3 (fine-pointer). Auto-hides when N=0. ~40 LOC JS via `resurrectIds()` helper + updateReviewBadge integration. 4-assertion mobile probe. spaced-repetition.md updated.

**Value claim:** PROFILE.md success criterion — "Mastered lessons stay mastered across SR intervals (1d → 30d)." The existing 🕒 Review badge treats "due tomorrow" and "due 60 days ago" the same; long-overdue lessons silently rot. No surface differentiates by staleness magnitude. The rusty engineer's biggest fear is silent regression.
**Mechanic:** New sidebar pill `💀 Resurrect (N)` showing lessons where `now - dueAt > 2 * interval` (overdue by more than one full bucket interval). Tap → jump straight to L1 of the most-overdue. Sort: most-overdue first.
**Success criterion:** Within 21 days of ship, ≥60% of "resurrected" lessons re-enter clean-pass state (vs. baseline regression rate measured pre-ship).
**Estimated scope:** single-iter ship (~60-80 LOC JS + 0 dedicated CSS).
**Data dependency:** none — pure derivation from `state.reviews[id].{dueAt, interval}` (both already populated since iter 32+). No new fields.
**PROFILE.md amendment proposed?** No — directly closes the "mastered stays mastered" success-criterion measurement gap.
**Why this is a "new bucket" not "better cell":** Surfaces *decay magnitude on the temporal axis* — a dimension of `reviews` that's been stored but never read. The Review badge knows due-or-not; this surface knows *how* overdue.
**Subagent source:** iter-64 B#3 (constraint-aware).

---

### 2026-05-25 iter 64 — Section Speedrun (section as a timed unit)

**Status:** SHIPPED iter 71. 🏁 Speedrun sidebar button → picker (sections with ≥3 full lessons in manifest order, ★ PB chip when set) → tap section → continuous stopwatch + first-L1-of-every-lesson stream → summary with delta-vs-PB. Per-section best saved to schema-additive `state.speedrun.bests[<sectionSlug>]` (no `__v` bump; namespace separate from `state.bestTimes` so Stats modal's avg-mock reducer is unaffected). Misses route to `state.weakness` via existing path. New helpers `_speedrunSectionsGrouped()` (derives section structure from CURRICULUM since `loadManifest` flattens), `_speedrunPickableSections()`, `_speedrunBuildDeck()`, `_formatSpeedrunMs()`. ~165 LOC JS + ~75 LOC CSS (lime accent — distinguishes from Rapid yellow / Recognize amber / Warmup orange). Mobile probe `tools/cdp/section-speedrun.js` (8 assertions, all PASS: button render, 25-row picker, ≥3-lesson gate enforced, stopwatch ticks across 800ms, deck-walk to summary, state.speedrun.bests.basics = 15247ms saved, PB chip "★ 15.2s" on picker re-entry). desirable-difficulty.md updated. **No adversary** — Step 2 challenge raised tiny-section worry (classes/tries/system-design = 1-2 lessons); mitigated by SPEEDRUN_MIN_LESSONS=3 gate which trimmed the 28-section list to 25 eligible.

**Value claim:** PROFILE.md §Usage context — Mock Interview is desktop-only ("don't try to mobilify it"). The rusty engineer has no *mobile* timed-pressure surface, so timed conditioning never compounds in the 80%-phone slice. PROFILE pattern-fluency line — recruiters probe at the section grain ("walk me through hashing"), not single-lesson grain.
**Mechanic:** Pick a section chip from the sidebar header → modal opens a stopwatch + section-scoped L1 stream (every full lesson's first L1 in section order). Time stamps on completion; per-section best time saved as new key in existing `bestTimes` scalar store (`speedrun:<sectionSlug>` namespace).
**Success criterion:** ≥30% of weekly active users start ≥1 Section Speedrun within 14 days of ship; median completion time on a section improves between first and third attempt.
**Estimated scope:** single-iter ship (~100-140 LOC JS + ~40 LOC CSS; reuses Rapid-Fire / Warmup session-shell pattern with section-filtered deck).
**Data dependency:** none — manifest sections + `lesson.L1.questions` per lesson + `state.bestTimes` (existing scalar store, new key namespace `speedrun:*`). No schema migration.
**PROFILE.md amendment proposed?** No — sits inside PROFILE.md need #3 (interview-format proficiency) + the 80%-phone success criterion.
**Why this is a "new bucket" not "better cell":** First surface that stopwatches a *section as a unit* — the grain recruiters actually probe. Mock Interview times one lesson; sparkline tracks one lesson over days; Speedrun times one whole topic right now.
**Subagent source:** iter-64 B#1 (constraint-aware).

---

### 2026-05-25 iter 64 — Track Balance Compass (allocation visibility across the track axis)

**Status:** SHIPPED iter 66. 🧭 Track Balance widget rendered in Stats modal above the existing tile grid; 3 bars (Syntax cyan / Pattern violet / Applied pink) showing % mastered + per-track count + 1-line "Least covered: X" nudge. Pure tally over `progress × manifest.track`. ~55 LOC inline-style widget. 4-assertion mobile probe.

**Value claim:** PROFILE.md §What they need spans 3 tracks (syntax, patterns, applied). The rusty engineer over-grinds whichever track they touched first and discovers the imbalance at the worst moment (an interview). No surface answers "am I drilling the right mix?" The existing per-section progress bar (iter 40) tells per-section breadth but not cross-track allocation.
**Mechanic:** A compact 3-bar widget on the Stats modal header showing % mastered per track + a one-line nudge ("Patterns: 18/79 — least covered"). Tap a bar → sidebar filters to that track's lowest-passing section.
**Success criterion:** Track-mastery variance (stddev of % mastered across the 3 tracks) decreases by ≥20% across active users over 30 days post-ship vs. the 30 days prior.
**Estimated scope:** single-iter ship (~50-80 LOC JS + ~20 LOC CSS for the bar widget).
**Data dependency:** none — `state.progress[lessonId]` + `lesson.track` from manifest. Pure tally; zero new state.
**PROFILE.md amendment proposed?** No.
**Why this is a "new bucket" not "better cell":** First surface that joins `progress × track` to surface lopsided allocation. Stats today reports overall counts and per-section retention; nobody has ever asked "is your investment lopsided across tracks?"
**Subagent source:** iter-64 B#5 (constraint-aware).

---

### 2026-05-24 iter 59 — Weak-Spot Decay Radar (intersection of weakness + due + reveal)

**Status:** SHIPPED iter 60. 📡 At Risk sidebar button + modal joining `state.weakness ∪ state.revealed` (with `state.reviews[id].dueAt` enrichment per row) into a single ranked surface. `_atRiskRows(limit=7)` helper sorts: due-now first → ascending daysTilDue → descending weakness count → revealed-flag presence. Modal mirrors Today's Plan structure with a 2-line row card (title + due-chip, section + miss-badge + 🃏 reveal-marker). Auto-hides when union is empty. Esc-handler list extended to include at-risk-modal. ~110 LOC JS + modal HTML. spaced-repetition.md updated — At Risk framed as the join surface above the SR ladder ("ladder tells WHEN, At Risk tells WHICH due lessons are also wobbly"). Mobile probe `tools/cdp/at-risk-radar.js` (10 assertions including sort-order verification + drain-hides-button). **No adversary pivot** — Step 2 self-challenge mitigated by union-not-intersection framing already in this roadmap entry.

**Value claim:** PROFILE.md success criterion line ("Mastered lessons stay mastered across SR intervals 1d→30d") + the daily-decision-fatigue gap. Today the user must mentally cross-reference Review badge (due lessons), Weak Spots button (lessons with L1 misses), and Reveal Replay (lessons mastered-with-reveal) to figure out the *highest-leverage* drill of the day. Those three signals exist independently but are never joined — and the union of "wobbly + about to slip + cheated last time" is the actual top-priority list. The forward-facing version of "what should I drill right now."
**Mechanic:** A new sidebar pill `📡 At Risk` opens a vertical list (mobile-native, ≤7 rows) sorted by `dueAt - now` ascending, filtered to lessons that are in `state.weakness` OR have `state.revealed[id]` set. Each row: title + days-til-due chip + miss-count badge + reveal-flag indicator. Tap → jump to lesson.
**Success criterion:** Within 14 days for users with ≥1 At Risk row, first-try L1 pass rate on lessons opened via At Risk exceeds first-try pass rate on lessons opened via Weak Spots alone by ≥10pp (controlling for difficulty via the iter-23 lesson-audit score).
**Estimated scope:** single-iter ship (~80-120 LOC JS + ~30 LOC CSS).
**Data dependency:** none — `state.weakness`, `state.reviews`, `state.revealed` all populated since iters 9 / 32 / earlier.
**PROFILE.md amendment proposed?** No — sits inside need #4 (spaced reinforcement) + need #5 (memorization tooling).
**Why this is a "new bucket" not "better cell":** First surface that INTERSECTS three independent signals. The bucket = "highest-priority drill list of the day" — until now the user had to be the join engine.
**Subagent source:** iter-59 B#4 (constraint-aware). A did not propose this — A went ambitious (audio, voice, content authoring). The constraint preamble surfaced an obvious intersection nobody had named.

---

### 2026-05-24 iter 59 — Mock Replay Reel (within-lesson temporal trajectory)

**Status:** SHIPPED iter 61 (with honest-scope adjustment). The entry's "activates dead data" framing turned out to be overoptimistic — the existing chrono trend chip at app.js:3919-3927 already surfaced `state.mockHistory[lesson.id]` as text cells (`5:00 · 4:30 · ★4:00 · 4:10`). Verified by 60-sec code read during Step 2 self-challenge. **Re-scoped ship**: augment the existing chip rather than replace it. Added: (1) slope-direction badge alongside the chip computing first-vs-last with 5% threshold ("↓ 50s faster vs first" / "→ holding" / "↑ 12s slower vs first"); (2) per-cell tap-targets inside the chip preserving the inline visual; (3) 3-field detail tile below header (attempt index + time + delta-vs-best%); (4) toggle off via re-tap. ~60 LOC JS + ~40 LOC CSS. Mobile probe `tools/cdp/mock-replay-reel.js` (9 assertions including toggle behavior + ≤1-attempt threshold preserved). desirable-difficulty.md updated. **Closes PROFILE measurement gap** on "personal-bests trend down" — the chip showed the data, this ship makes the trend legible at a glance.

**Value claim:** PROFILE.md success criterion line on "Mock interview personal-bests trend down over weeks" — but today the app only shows the floor (best time), not the trajectory. The user can't see whether their times are improving, plateauing, or regressing on any given lesson. The data IS already collected (`state.mockHistory[id]` stores up to 5 attempt times) but the only consumer is `Math.min()` for the personal-best display. The temporal-within-lesson dimension is data-on-disk that the UI throws away.
**Mechanic:** On the per-lesson sparkline area (above the tabs), add a `⌚ Reel` toggle that renders 5 dots oldest→newest, labeled with ms each. Tap a dot → tile pops up showing delta vs best ("3rd attempt: 4:12, +18s from best") plus a trend arrow (↓ improving / → flat / ↑ regressing) based on linear-fit across the 5 points.
**Success criterion:** For lessons with ≥3 mock attempts, ≥50% of users who see the Reel show a monotonically-decreasing slope within 30 days; mock-start rate on Reel-visible lessons exceeds baseline by ≥15%.
**Estimated scope:** single-iter ship (~80 LOC JS + ~25 LOC CSS).
**Data dependency:** none — `mockHistory[id]=[ms,...]` cap-5 already written (see app.js state schema). Zero new fields.
**PROFILE.md amendment proposed?** No — directly maps to the existing PROFILE success criterion about mock-best trends.
**Why this is a "new bucket" not "better cell":** Activates already-stored throwaway data. The within-lesson temporal dimension (5 attempts over time on a SINGLE lesson) is orthogonal to both the existing per-lesson sparkline (which shows L1/L2/L3 pass events across days, not mock times) and the Stats personal-bests list (which shows the floor across all lessons). New axis.
**Subagent source:** iter-59 B#3 (constraint-aware). The "data already on disk; UI throws it away" framing is the unlock.

---

### 2026-05-24 iter 59 — Streak Map (60-day calendar density heatmap)

**Status:** SHIPPED iter 62. 📅 Streak sidebar button (always visible — no auto-hide; new users see an empty grid with "No history yet" message) opens modal with a 9-column × 7-row grid of 60 day-cells (oldest top-left → today bottom-right). 5-tier color gradient scaled to the user's peak day in window (no absolute thresholds). Hover/tap shows date + pass/miss breakdown; default tooltip shows total events and active-days count; 5-swatch legend. Carefully avoids PROFILE.md L75 gamification anti-pattern — no streak counts, no shame chips, just calendar shape. **Honest premise adjustment at ship time:** roadmap entry said data source was `state.reviews[id].lastPassedAt` but that's a single timestamp per mastered lesson (too sparse). Re-scoped to use `state.history` (open event log since iter 32, cap 50 events per lesson). ~110 LOC JS + 10-assertion mobile probe + spaced-repetition.md updated. **Closes iter-59 roadmap fully** — #1 SHIPPED iter 60, #2 SHIPPED iter 61, #3 SHIPPED iter 62.

**Value claim:** PROFILE.md "Friction between '20 free minutes' and 'I'm drilling' is near zero" + the variable-reward / habit-formation principle. Today the app has no surface showing the *calendar shape* of the user's practice — only the forward-facing SR queue and the per-lesson 30-day sparkline. A GitHub-style 60-day heatmap activates the streak-visibility loop that drives daily return rates in Duolingo / GitHub / Wordle without copying their gamification anti-patterns (PROFILE.md L75).
**Mechanic:** A new sidebar pill `📅 Streak` opens a 60-cell grid (10×6) colored by # of pass events (L1/L2/L3) that day. Tap a cell → filter sidebar to lessons touched that day. Toggle off to clear filter. No streak counts shown above the cells (avoids the "broke my streak, can't recover" anti-pattern); just the density pattern.
**Success criterion:** Within 14 days of exposure, ≥30% of users open the Streak modal ≥1 time per session; 7-day median consecutive-day rate increases vs the prior 14-day baseline (computed from `reviews[].lastPassedAt` history).
**Estimated scope:** single-iter ship (~100-150 LOC JS + ~50 LOC CSS).
**Data dependency:** none — derived from `state.reviews[id].lastPassedAt` (already a timestamp) bucketed by `toDateString()`. Optionally enriched by `state.history` events (iter-32 schema) for finer-grained density.
**PROFILE.md amendment proposed?** No — sits inside need #4 + the near-zero-friction success criterion.
**Why this is a "new bucket" not "better cell":** The app's existing temporal surfaces all look at the past in one direction (per-lesson sparkline) or the future (SR due dates). The backward calendar shape is a new view — the *pattern* of practice across time rather than the events themselves.
**Subagent source:** iter-59 B#1 (constraint-aware). The "habit visualization without gamification" framing is what threads the PROFILE.md anti-pattern needle.

---

### 2026-05-24 iter 55 — Distractor Drill ("Spot the lie" — wrong-options-as-corpus)

**Status:** BLOCKED iter 56 — adversary's data-feasibility catch on the mechanic-corpus FIT (separate from iter-54's quantity catch). Empirical scan of 808 L1 questions: 25% are code-shaped (sufficient quantity), but the "tap the one correct somewhere in corpus" criterion is indeterminate without question stems — `Math.max(nums)` and `Math.max(...nums)` are BOTH correct in different lessons, so the user would have no way to disambiguate. Filtering distractors to fake-only (e.g., `Math.maxOf`, `nums.max`) requires a hand-curated `realJsApi.json` allowlist — that's a content-authoring ship, not the auto-recombination this entry proposed. PROFILE.md L75 ("gamification that obscures actual progress") + L37-40 (≥3 L1 floor implying distractors are scaffolding-not-primary-content) reinforce the BLOCK. **Reattempt requires** the hand-curated allowlist + a UI reframe to "spot the fake method name" (which is a different value claim than the original recombination angle). Pivoted to iter-55 #2 Reveal Replay (shipped iter 56). Mark this entry BLOCKED until a future vision iter finds a non-context-free framing or a content-authoring ship lands the allowlist.

**Value claim:** PROFILE.md § State they're in — "syntax degraded … forget exact method names, argument order, the small ceremonies." The app's ~800 carefully-authored L1 *wrong* options are themselves a hand-curated catalog of "plausible JS syntax that almost looks right." They are currently rendered exactly once per lesson then never recombined; the rusty engineer never trains the inverse skill of *spotting* the syntactic look-alike.
**Mechanic:** A new mobile-native session — show 4 plausibly-looking code snippets / options drawn from L1 distractor pools across lessons in the active track; user taps the *one that is actually a correct answer somewhere in the corpus*. Or the inverse: present 4 options, tap the one that is NEVER a correct answer (the trap). 60-sec session with 10-15 cards; score = correct taps; misses route the source lesson into `state.weakness`.
**Success criterion:** Within 14 days for users with ≥3 sessions, median L1 first-attempt accuracy on the lessons whose distractors appeared in their Distractor sessions rises measurably vs. their non-distractor-lesson baseline.
**Estimated scope:** single-iter ship (~150 LOC JS + ~50 LOC CSS; mirrors Rapid-Fire's session shell from iter 54).
**Data dependency:** none — recombines existing `L1.questions[i].options[]` + `L1.questions[i].answer` across all 143 lessons. New helper builds two indices (correct-answer set + distractor set, both grouped by track); deck draws 3 distractors + 1 known-correct (or 4 distractors with no known-correct = trap card). Schema-additive `state.distractor = {attempts, correct}`.
**PROFILE.md amendment proposed?** No — sits inside need #1 (syntax re-memorization).
**Why this is a "new bucket" not "better cell":** First surface that uses the **distractor pool** as the primary input. Every existing L1 surface treats wrong options as ephemera; this surface treats them as the *content*. Pure interleaving on a dimension no other surface uses.
**Cross-subagent source:** B#3 only (subagent A did not propose this — constraint-aware preamble unlocked it by forcing "what existing data dimension is wasted?"). Independent confirmation that under the iter-31 meta-finding constraint, this is a "recombine existing 143-lesson corpus into a new mobile-first surface" candidate.

---

### 2026-05-24 iter 55 — Reveal Replay (clear the integrity-flagged mastery)

**Status:** SHIPPED iter 56. 🃏 sidebar button + count (hidden when `state.revealed` is empty); tap routes to next revealed lesson at the revealed level (L2 before L3). `markPassed` clean-pass invariant: passing a previously-revealed level without re-clicking reveal in the current attempt clears the flag and demotes the ringed-green dot to plain green; 2.2-sec fuchsia toast confirms. Tracked via in-memory `_revealedInCurrentAttempt` map that resets in `selectLesson`; the invariant works generally — clean passes also fire from normal navigation. ~110 LOC JS + ~30 LOC CSS. Mobile probe `tools/cdp/reveal-replay.js` (10 assertions across 5 phases). Active-recall doc updated. **Adversary pivot from Distractor Drill (iter-55 #1):** empirical 25%-code-shaped scan was sufficient quantity but the "Spot the lie" mechanic requires context-free option-classification while corpus is question-with-answer-choices — `Math.max(nums)` vs `Math.max(...nums)` are BOTH correct in different lessons, making the game indeterminate. Distractor Drill marked BLOCKED with reattempt-requires-hand-curated-realJsApi-allowlist note.

**Value claim:** PROFILE.md success-criteria line ("friction between '20 free minutes' and 'I'm drilling' is near zero") combined with PROFILE.md § State they're in (the rusty engineer wants to know which lessons they *actually* know vs. faked). The existing `revealed[lessonId][level]` map and ringed-green dot variant know exactly which lessons the user faked, but there is no path that takes the user from "I cheated" back to "I really know it" without manual hunting. The data exists; the verb doesn't.
**Mechanic:** A top-of-sidebar banner appears when `Object.keys(state.revealed).length > 0`: "N lessons mastered-with-reveal — drill them clean." Tap → ordered queue routes user only through the L-level they revealed on (e.g., L2 if they hit Reveal on L2); passing without re-reveal clears the flag and demotes the dot from ringed-green to plain green.
**Success criterion:** Among users with ≥3 revealed entries, ≥50% clear at least one reveal flag in week 1 of shipping (delta on `Object.keys(state.revealed).length`).
**Estimated scope:** single-iter ship (~80 LOC JS + ~25 LOC CSS; banner + ordered queue + clear-flag-on-clean-pass hook into existing render path).
**Data dependency:** none — uses `revealed`, `progress`, `currentLessonId` localStorage entries. All already populated.
**PROFILE.md amendment proposed?** No — sits inside PROFILE.md success criterion line about retention-integrity ("mastered stays mastered").
**Why this is a "new bucket" not "better cell":** First surface that surfaces the *integrity-of-mastery* dimension. Today the ringed-green dot is a passive scarlet letter; Reveal Replay makes it actionable. The verb side of a noun that already existed.
**Cross-subagent source:** B#5 only. Subagent A did not propose this — surfacing the existing `revealed` map required knowing what state fields already exist, which the constraint-aware preamble made the agent investigate.

---

### 2026-05-24 iter 55 — 3-Card Warmup swipe-stack (mobile micro-session UI)

**Status:** SHIPPED iter 57. 🌅 Warmup sidebar button → 3-card stack in main viewport. Each card renders an L1 question DIRECTLY (section + lesson tag + question + A/B/C/D options) so the user goes from idle to answering in ~3 taps vs Today's Plan's ~6+ nav flow. Tap-to-grade slides the active card off-screen (right=correct, left=wrong); next card slides up from the visual stack (ghost cards visible underneath). Auto-advance; summary with CTAs into Rapid-Fire / Today's Plan / Done. Schema-additive `state.warmup = {sessions, completions, lastRunAt}` — no `__v` bump. Misses route to `state.weakness` via the same in-lesson L1-miss path. PWA-install scope from A#4's original proposal NOT included (deferred per the constraint-aware reduction; clean entry-point UX shipped first). ~170 LOC JS + ~85 LOC CSS. Mobile probe `tools/cdp/three-card-warmup.js` (10 assertions). Active-recall doc updated. **No adversary pivot** — first clean ship in 3 iters (iters 54 + 56 both pivoted). iter-55 roadmap fully drained: #1 BLOCKED, #2 SHIPPED iter 56, #3 SHIPPED iter 57.

**Value claim:** PROFILE.md "~80% phone" + the success-criterion line on near-zero entry friction. Today's Plan already serves the right *content* (1 due + 1 path + 1 weak) but requires multi-tap navigation into each lesson. A 3-tap surface beats a 6-tap surface on every commute; this is purely an entry-point compression for the existing query.
**Mechanic:** A new "⚡ 3-Card Warmup" button in the sidebar control row (next to ⚡ Rapid). Tap → full-screen swipe-card stack: card 1 = next due L1, card 2 = next-on-path L1, card 3 = top-weak L1. Swipe-right to mark answered (auto-grades the L1 pick), swipe-left to skip; 60-90 sec total; finishes with a CTA into normal lesson view.
**Success criterion:** Among users who tap the button ≥1 time, the median sessions-per-active-day metric rises from current baseline by ≥30% over 14 days (measurable as count of `lastTab` reassignments per active day in localStorage).
**Estimated scope:** single-iter ship (~150 LOC JS + ~70 LOC CSS for swipe-card animation via CSS transform + Pointer Events).
**Data dependency:** none — recombines existing `dueReviewIds()`, `starterPathNextId()`, `topWeakLessonId()` helpers into a 3-card array. Per-card L1 question pulled from already-loaded CONTENT cache. No new schema.
**PROFILE.md amendment proposed?** No — sits inside PROFILE.md success-criteria.
**Why this is a "new bucket" not "better cell":** First mobile micro-session UI (swipe-card stack); every existing surface is click-into-lesson + scroll. The bucket = sub-2-minute thumb-only entry shape. The PWA-install scope from A#4's proposal is explicitly NOT in this entry — that's a separate ship that can land later without blocking this one.
**Cross-subagent source:** A#4 only (re-scoped). A's full proposal included PWA install + home-screen icon; the constraint-aware reduction is to ship the SWIPE-CARD-SURFACE alone (data recombination), defer PWA-install + Media Session API to a future entry (those are new-modality, depend on browser-API testing matrix, and would over-fit a single iter).

---

### 2026-05-24 iter 48 — Pattern Recognition Speed Drill (UNBLOCKED reframe)

**Status:** SHIPPED iter 49 (MVP). 🔎 Recognize button in sidebar; 10-card session in main viewport; tap to grade + auto-advance + session summary with median time + lifetime stats. Schema-additive `state.recognize = {attempts, correct}`. Deferred: mobile probe (~80 LOC follow-up).

**Value claim:** PROFILE.md L20-21 — "they know sliding window exists but can't produce a canonical implementation in 5 minutes." The unspoken prior is *picking* the right pattern family from a raw prompt; today every drill begins with the pattern already named in the lesson title, so the diagnosis step is never practiced.
**Mechanic:** Mobile-first tap surface — shows the existing `L3.prompt` (no title, no section badge) and 4 SECTION-NAME buttons (e.g. "Sliding Window / Two Pointers / Hash & Complement / Stack"); user taps the matching family; 5-second target per card, ~20-card sessions, streak counter.
**Success criterion:** Within 14 days for users with ≥3 sessions, median time-to-correct-family drops measurably AND users with >5 sessions have higher first-attempt L3 pass rates on unseen lessons.
**Estimated scope:** single-iter ship.
**Data dependency:** none — uses existing 79 `L3.prompt` strings × 28 section-name labels. No per-lesson authoring.
**PROFILE.md amendment proposed?** No — this reframe sidesteps iter-26 Amendment A (which split pattern-recall vs pattern-implementation). B's reframe uses SECTION NAMES as the distractor pool, not a per-lesson recognition mode, so it doesn't require splitting the concept in PROFILE.md.
**Why this is a "new bucket" not "better cell":** First surface that drills DIAGNOSIS not implementation — a different cognitive skill, orthogonal to the L1→L2→L3 ladder.
**Cross-subagent convergence:** Both iter-48 vision subagents independently surfaced this (A#1 + B#1). B's section-name-button mechanic is the unlock — it avoids the iter-30 adversary's data-contamination concern (function names leaking the answer) because section-name buttons are 28 cross-cutting buckets, not per-lesson distractors.
**Supersedes:** iter-26 entry #1 (BLOCKED). The iter-48 reframe is structurally different — section-name distractor pool vs per-lesson; not data-contaminated; no PROFILE amendment dependency. Mark iter-26 entry as SUPERSEDED.

---

### 2026-05-24 iter 48 — Confusion Pairs Drill (binary discrimination)

**Status:** BLOCKED iter 54 — data-shape mismatch surfaced by iter-54 adversary. Empirical scan of 808 L1 questions across 151 lessons found only **3% (30) of option sets are method-name-like** (`slice`/`splice`-pairs as imagined by the entry). **62% (509) are English-phrase explanations** ("Plain-string replace swaps only the first match" / "All of them"); **4% (36) are value literals** (`"World"`, `-1`, `true`). The roadmap entry's auto-mine-from-L1.options mechanic doesn't fit the actual corpus shape — L1 options are *answers to a specific question*, not *peers in a confusion pool*. Even `s-nullish` (the lesson explicitly about `??` vs `||`) encodes the operators inside L2.blanks, not L1.options. **Reattempt requires either**: (a) a hand-curated `data/confusion-pairs.json` seed file (different ship — content authoring at cross-lesson grain), (b) mining from `L2.blanks[*].answer` deduplication (gives ~150 bare method names with no semantic pairing — noise without a confusion graph), or (c) reframing the surface as "near-neighbor disambiguation within a single lesson's L1 options" (only 3% of L1 qns; tiny pool). Best path forward is (a) but it's a different ship entirely; mark BLOCKED until that re-scoping happens.

**Value claim:** PROFILE.md L16-19 — rusty engineers forget "exact method names, argument order, the small ceremonies." The error mode isn't absence of memory; it's *confusion between two near-neighbors* (`slice` vs `splice`, `map` vs `forEach`, `??` vs `||`, `for-of` vs `for-in`).
**Mechanic:** Auto-mine pairs of L1 `answer`↔`option` distractors that recur across lessons; present a single code snippet with two buttons labeled A/B; user taps in <2 seconds; tracks per-pair accuracy + reaction time. Algorithmically derived from existing L1 corpus — no authoring.
**Success criterion:** Users who complete ≥1 confusion-pair session have ≥25% lower L1 miss rate on the involved methods over the next 7 days.
**Estimated scope:** 2-iter scaffold+ship — iter 1: pair-mining algorithm + state schema for pair-accuracy stats; iter 2: drill UI + entry point.
**Data dependency:** none — derived from existing `L1.questions[i].options[]` arrays across all 143 lessons.
**PROFILE.md amendment proposed?** No — sits inside need #1 (syntax re-memorization).
**Why this is a "new bucket" not "better cell":** Adds DISCRIMINATION as a third retrieval mode (vs free-recall L3, cued-recall L2, recognition L1). Binary tap is the fastest mobile interaction shape possible — <2 sec per item beats L1's 4-option throughput.
**Subagent source:** B#3.

---

### 2026-05-24 iter 48 — Mistake Tagging Postmortem (lightweight, schema-additive)

**Status:** SHIPPED iter 58. 🏷 chip strip rendered below L1 explain text after a wrong-option tap; 6 fixed tags (off-by-one / wrong method / edge case / semantics / misread / syntax) + dismiss X. Tap → save to `state.misses[lessonId][]` + confirm-then-fade. Dismiss → fade without saving. New "Top miss patterns" tile in Stats modal aggregates top-5 tags with counts (hidden when empty so non-taggers see a quiet Stats). Schema-additive — `state.misses` bounded at 50 entries per lesson; no `__v` bump. PROFILE Amendment B governance dependency from iter-26 entry #2 successfully sidestepped via iter-48's "opt-in user-authored tagging as a USER affordance" reframe — the PROFILE never has to claim metacognitive ownership is a need; the surface just exists and benefits users who use it. ~120 LOC JS + ~80 LOC CSS + 8-assertion mobile probe + active-recall doc updated. **Closes iter-48 roadmap fully** — and as the final unshipped vision-iter entry across all 4 vision iters (26/31/48/55), this is the last queued entry in roadmap.md. Next iter must be vision or the queue is empty.

**Value claim:** PROFILE.md L57-62 — "memorization tooling beyond L1→L2→L3 … elaboration." Today the weak-spot tracker resurfaces *lessons* the user missed, but the actual recurring failure pattern is *concept-level* — "I always confuse `slice` vs `splice`," "I always forget the second arg to `reduce`." Lesson-grain tracking can't see these patterns.
**Mechanic:** After any L1/L2 miss OR at end of a 5+ item session, show a 1-screen "What tripped you?" with ~8 tag chips (off-by-one, wrong method name, forgot edge case, confused-with-other-lesson, semantics trap, etc.) + free-text "other". Stored as opt-in `state.misses[lessonId][]` (schema-additive). Aggregated into a new sidebar facet "Your top miss types" + an opt-in Today's Plan slice.
**Success criterion:** Users who tag ≥10 misses in 30 days show ≥20% lower repeat-miss rate on tagged concepts vs their untagged baseline.
**Estimated scope:** 2-iter scaffold+ship — iter 1: tag chip UI + miss-event hook + schema; iter 2: aggregation view + Today's Plan integration.
**Data dependency:** none for the tagging surface; new opt-in `state.misses` field (schema-additive, no migration).
**PROFILE.md amendment proposed?** No — the iter-48 reframe of iter-26 entry #2 (Error Post-Mortem) avoids the PROFILE Amendment B requirement by framing the surface as opt-in user-authored tagging (a USER affordance), not as a re-stated mental model of the app. The PROFILE never needs to claim "metacognitive ownership is a need" — the surface just exists and benefits users who use it.
**Why this is a "new bucket" not "better cell":** First user-authored metacognitive layer; the app currently has zero surface for the user to NAME their own gaps.
**Cross-subagent convergence:** A#3 + B#5. B's "schema-additive + opt-in" framing is what unblocks it from the iter-26 Amendment B governance issue.
**Supersedes:** iter-26 entry #2 (BLOCKED). Same constraint-aware reframing pattern as the Pattern Recognition entry above.

---

### 2026-05-24 iter 31 — L1 Rapid-Fire Drill (cross-lesson MCQ stream)

**Status:** SHIPPED iter 54. ⚡ Rapid sidebar button → 20-question cross-lesson interleaved session in main viewport; 7-sec soft timer; A/B/C/D letter chips; streak counter; miss flips `state.weakness`; summary surfaces %, best streak, median time, throughput/min, and slowest-3-lessons as per-session weak-spot diagnostic. Schema-additive `state.rapidFire = {attempts, correct, bestStreak, lastRunAt}` — no `__v` bump. ~160 LOC JS + ~75 LOC CSS. Mobile probe `tools/cdp/rapid-fire.js`. interleaving.md updated. **Adversary pivot:** original iter-54 nomination was Confusion Pairs (iter-48 #2); 808-L1-question empirical scan found only 3% are method-name-like options — auto-mine mechanic didn't fit corpus. Adversary recommended L1 Rapid-Fire as the data-feasible replacement. Closes iter-31 roadmap (entry #5 Flash shipped iter 35; entry #6 sparkline shipped iter 33+34).

**Value claim:** PROFILE.md line 30-31 says verbatim "L1 (multiple choice) is the smoothest interaction on mobile — tap-based, no keyboard. Highest throughput for the mobile user." Today L1 is locked inside a lesson; the mobile user can't get a pure tap-stream across many lessons. This is the largest under-exploited surface in the app's most-load-bearing modality, with ZERO new content authoring needed.
**Mechanic:** A "⚡ Rapid" button in the sidebar control row shuffles L1 questions from across all mastered + watchlist lessons into a continuous tap-stream with a 7-second-per-question soft timer. Scores throughput (correct/min). Surfaces the slowest-to-answer lessons as a weak-spot variant. Encodes interleaving (`docs/learning-strategies/interleaving.md`) on the highest-throughput mobile surface.
**Success criterion:** Within 1 week, median session length on mobile rises measurably vs. baseline AND ≥30% of total L1 attempts in week-1 come from Rapid sessions (instrumented as a counter in localStorage; no telemetry needed).
**Estimated scope:** single-iter ship.
**Data dependency:** none — uses existing `L1.questions` across all 143 lessons; no per-lesson authoring; uses existing `weakness` field for resurfacing.
**PROFILE.md amendment proposed?** No — directly grounded in PROFILE.md line 31's existing claim that L1 is the highest-throughput mobile surface. No amendment needed.
**Why this is a "new bucket" not "better cell":** Every existing L1 interaction is single-lesson-scoped; Rapid is the first cross-lesson interleaved stream — directly encoding the interleaving strategy doc on the load-bearing mobile modality.
**Adversary pre-emption (iter-31 vision subagent's own):** Adversary may cite audit theme #5 ("identifier-as-blank") and #4 ("complexity-question fatigue") arguing fix L1 quality before adding L1 volume. Rebut: those are L2 / distractor-quality fixes (iter 29 partial close, iter 30 watchlist close); Rapid is a *new surface for the same data* that the audit confirmed is at 2.63 mean (above-watchlist). The slowest-to-answer telemetry surfaces *exactly* the theme-7 absurd-distractor questions — Rapid is a self-pointing diagnostic for the next audit pass.

---

### 2026-05-24 iter 31 — Reference-Card Flash Mode (cloze-deletion on the canonical)

**Status:** shipped iter 35 (single-iter MVP — `renderFlash()` in app.js, `.flash-blur` CSS, toggle on Reference tab, mobile probe `tools/cdp/reference-flash.js`)

**Value claim:** PROFILE.md line 47 says "Fast loops of 'see canonical → recall → type from blank'" — but the Reference tab today is READ-ONLY; the user sees the canonical but never recalls from it on mobile. The gap between Reference (read) and L2 (typed blanks) is the largest learning-loop drop, and there's no eyes-on-thumb-only recall step in between. This fills the unaddressed cell in the modality matrix: read+tap-reveal recall.
**Mechanic:** On the Reference tab, a "🃏 Flash" toggle hides 1-3 randomly-chosen tokens from `reference.code` behind tap-to-reveal blurs. User mentally fills them, then taps to reveal. No typing, no validation, pure self-graded retrieval. A counter shows "you've flashed this card N times" feeding a new dot-variant or just session-stats. Active-recall principle on a previously-passive surface.
**Success criterion:** Within 1 week, on lessons where user uses Flash ≥3 times before attempting L2, first-try L2 pass rate (already tracked in `progress`) rises measurably vs. baseline lessons (compare `progress[lessonId].L2 === 'passed'` rate for flashed-vs-not lessons in localStorage).
**Estimated scope:** single-iter ship for MVP; 2-iter if adding Leitner-style miss-requeue + cross-lesson flash session.
**Data dependency:** none for MVP — tokenizes `reference.code` at runtime using the existing CodeMirror tokenizer (already loaded for runMode). If MVP token-selection quality is low, future iter can add an optional `reference.flashHints: [tokenIndices]` field — but NOT required for ship.
**PROFILE.md amendment proposed?** No — sits cleanly inside PROFILE.md need #1 (syntax re-memorization) and #5 (memorization tooling exploiting active recall — cites `docs/learning-strategies/active-recall.md`).
**Why this is a "new bucket" not "better cell":** Reference is currently a passive read surface. Flash makes it the first *active-recall* surface that requires zero typing — the unaddressed cell in the modality matrix (read+typed exists as L2; read+tap exists as L1; *read+recall-no-input* does not exist).
**Cross-subagent convergence:** Both iter-31 vision subagents (A's "Spaced-Rep Cloze Cards" as standalone mode, B's "Reference-Card Flash Mode" as on-existing-tab toggle) independently surfaced this. B's on-tab framing is cleaner for v1 — surfaces in the user's existing Reference flow; A's standalone-mode framing is the natural v2 once Leitner queue is added.

---

### 2026-05-24 iter 31 — Lesson-history sparkline (per-lesson temporal retention signal)

**Status:** SHIPPED iter 33 (scaffold) + iter 34 (mobile probe). Status row was never updated when the iter completed — caught and fixed by iter 59 vision-iter Step 1A roadmap audit. Implementation: 30-day per-lesson sparkline above the tabs, fed by `state.history = {lessonId: [{at, event}]}` schema field added in iter 32 (`__v: 6` bump). Events emitted on L1/L2/L3 pass + L1-miss. Tick colors: emerald (pass), rose (L1-miss), sky (L3-pass), dark (empty). Mobile probe `tools/cdp/sparkline-renders.js` (4 assertions). `window.__sparklineEnabled = true` confirmed in app.js line 793.

**Value claim:** PROFILE.md success criterion line 66 says verbatim "Mastered lessons stay mastered across SR intervals (1d → 30d)" — but the app currently has NO per-lesson view of how the user has been doing over time. Just a current-state dot. The rusty engineer can't see "I keep re-failing L1 on this lesson every 14 days" — which is the exact signal needed to decide whether SR is working for them. Closes the measurement gap on PROFILE.md's stated success criterion.
**Mechanic:** In each lesson's header (above the tabs), a tiny 30-day sparkline shows passes/misses per day for that lesson: green tick per L1 pass, red tick per L1 miss, blue tick per L3 pass. Built from a new lightweight `history: { lessonId: [{at, event}] }` localStorage field appended on every level-pass/miss. First per-lesson temporal view in the app.
**Success criterion:** Within 1 week, at least one lesson develops a visible "re-miss" pattern (≥2 misses on the sparkline across the week) that the user then explicitly drills (clicks into and passes), demonstrable by inspecting `history` + `progress` timestamps in localStorage.
**Estimated scope:** 2-iter scaffold+ship — iter 1: schema bump `__v: 6` + history-append hook in existing save sites + flag-gated sparkline render; iter 2: sparkline polish, mobile probe, flag removal.
**Data dependency:** none — purely instrumental; no per-lesson authoring; reads from new `history` field populated going-forward (empty initial state is fine — sparkline shows "no history yet, start drilling").
**PROFILE.md amendment proposed?** No — sits inside PROFILE.md need #4 ("spaced reinforcement") and success criterion line 66 (retention across SR intervals).
**Why this is a "new bucket" not "better cell":** First per-lesson temporal view; today the app remembers *current* state per lesson but DISCARDS *history* on every save. Schema-level reframe of what the app tracks.
**Note on schema-bump coordination:** `__v: 6` was reserved iter 26 for Error Post-Mortem (roadmap entry #2). If both ship, they share the `__v: 6` migration; the `history` field added here and the `misses` field reserved for Post-Mortem are independent — both can land in the same schema slot, documented in the migration branch.

---

### 2026-05-23 iter 26 — Pattern Recognition Speed Drill

**Status:** SUPERSEDED iter 48 by the constraint-aware reframe above (section-name distractor pool sidesteps both the data-contamination AND PROFILE-amendment blockers; both vision subagents converged on this mechanic independently). See the iter-48 Pattern Recognition Speed Drill entry at top of queue.

**Value claim:** PROFILE.md names "pattern recall degraded" — knowing sliding-window *exists* but not reaching for it unprompted — yet the entire L1→L2→L3 ladder operates on `recall given a topic`, never on `recognition given a stimulus`, which is the operation a real interview opens with.
**Mechanic:** A new top-level mode "Recognize" flashes a problem prompt (drawn from existing 79 pattern lessons' `description` + `L3.prompt` text — already authored data) and asks the user to tap one of 4 pattern-name distractors within ~5 seconds; the distractor pool is the section taxonomy (Trees lessons' distractors are 3 other Trees patterns + 1 cross-section), so authoring overhead is near-zero. Tracks accuracy and time-to-tap per pattern; surfaces "your slowest patterns" as a Today's Plan slice.
**Success criterion:** Within 1 week of shipping, the median time-to-correct-pattern-tap for the user's full attempted pool drops below 3 seconds, and mock-interview start-to-first-keystroke latency (instrument new) drops measurably for patterns the user has Recognize-drilled ≥3 times vs. a baseline pattern they haven't.
**Estimated scope:** single-iter ship (all data exists; UI is one new tab + a timer + a 4-button row; no schema migration; no new content authoring; mobile-native because it's tap-only).
**PROFILE.md amendment proposed?** Yes — PROFILE.md currently bundles "pattern recall" as one degraded skill, but Recognize-mode treats pattern-selection (the diagnosis step) as a *distinct* skill from pattern-implementation (the typing step). Amendment drafted in PROFILE.md awaiting a frame iter.
**Why this is a "new bucket" not "better cell":** Every existing surface moves abstract→concrete (read canonical, then reproduce). This is the only one that moves concrete→abstract — which is the actual interview direction.
**Cross-subagent convergence:** Both vision-iter subagents (A's "Inverse Drill" as L0 tab, B's "Pattern Recognition Speed Drill" as new mode) independently surfaced this gap. B's standalone-mode framing is cleaner than A's per-lesson L0 tab because it leverages the cross-pattern distractor pool that only a standalone mode unlocks.

---

### 2026-05-23 iter 26 — Error Post-Mortem with Miss Classification

**Status:** SUPERSEDED iter 48 by the constraint-aware reframe above (Mistake Tagging Postmortem framed as opt-in user-authored tagging sidesteps the PROFILE Amendment B governance dependency). See the iter-48 Mistake Tagging Postmortem entry at top of queue.

**Value claim:** The weak-spot tracker resurfaces L1 misses but never closes the metacognitive loop — the rusty engineer keeps re-missing the same conceptual trap (`splice` vs `slice`, off-by-one bounds, `==` coercion edge) across different lessons without ever *naming* the pattern in their own misses. Closes BS-08's outstanding "watchlist-tier visibility" question by giving the user a personalized concept-level model of their own mistakes.
**Mechanic:** After any L1 miss or failed L3 run, a lightweight post-mortem card appears with a 2-tap classifier ("forgot syntax / off-by-one / wrong method name / misread prompt / semantics confusion") + a "Pin to journal" affordance with an optional 1-line note ("ohhh — `splice` returns REMOVED items, not the new array"). Classifier tallies feed a new sidebar facet ("Your top miss type: off-by-one — 6 lessons drill this") and an opt-in personalized Today's Plan slice. Journal is a flat list, exportable as markdown.
**Success criterion:** Within 1 week of shipping, repeat-miss rate on the same L1 question across SR intervals drops by ≥25% for users who classify ≥10 misses, AND ≥40% of pinned journal entries get viewed at least once after being pinned (i.e., the journal is consulted, not just written).
**Estimated scope:** 2-iter scaffold+ship — iter 1: classifier UI + miss-event hook + localStorage schema bump (`__v: 6`, `misses: { lessonId: [{at, type, level, note?}] }`); iter 2: sidebar facet + Today's Plan integration + journal export. UI lives in existing render functions, no new tab needed.
**PROFILE.md amendment proposed?** Yes — PROFILE.md's "what they need from this app" lists 5 needs but doesn't include *metacognitive ownership of one's own gaps*; current strategy emphasis is on recall, not on naming and owning misconceptions. Amendment drafted in PROFILE.md awaiting a frame iter.
**Why this is a "new bucket" not "better cell":** The existing weak-spot tracker operates at the *lesson* unit (which lessons miss); this operates at the *concept-across-lessons* unit (which mistake-types recur). The app currently has zero concept-level model of the user.
**Cross-subagent convergence:** Both subagents independently surfaced this as a top-2 entry (A's "Mistake Post-Mortem & Concept-Attribution Journal" at #2, B's "Error Post-Mortem" at #2). A's larger concept-tagging-across-143-lessons version is a v2 candidate after the lighter classifier ships.

---

### 2026-05-23 iter 26 — Commute Audio Mode (eyes-free drilling)

**Status:** BLOCKED (iter 31 meta-finding — depends on un-ratified PROFILE Amendment C + Page Visibility instrumentation prerequisite)

**Value claim:** PROFILE.md's "~80% phone" assumption silently constrains usage to *visual-attention* phone time. But the rusty engineer's phone is also with them walking, driving, doing dishes, in the gym — large blocks of cognitive bandwidth currently unreachable because every existing surface requires looking at a screen and tapping a target. This is the largest under-served chunk of the profile's own usage context.
**Mechanic:** A "Play" button on any lesson queues TTS that reads `reference.notes` aloud, then poses each L1 question aloud with a 4-second pause for mental answer, then TTS reveals the correct option with a 1-sentence rationale. User input is a single big "Heard it / Next" button (or a Bluetooth headphone click via Media Session API). Wake Lock keeps the screen on for the (small) cases where the screen IS visible. No voice recognition required for MVP — pure listen-and-acknowledge. Future iter: optional Web Speech voice-in for L2-style fills.
**Success criterion:** Within 1 week of shipping, ≥20% of all L1 attempts come from sessions where the Page Visibility API reports screen-off for >60 seconds between taps (instrumentable as session telemetry), AND median session length on mobile rises measurably vs. pre-ship baseline.
**Estimated scope:** 3-iter scaffold+wire+ship — iter 1: TTS queue + lesson-to-audio-script transformer + flag-gated Play button on Reference tab; iter 2: L1 audio question loop + Media Session API wiring + Wake Lock; iter 3: bluetooth headphone gesture handling + queue persistence (resume mid-lesson) + mobile probe at iPhone viewport + flag removal.
**PROFILE.md amendment proposed?** Yes — adds a *fourth* usage-context category alongside L1/L2/L3 thumb-tap modality: "eyes-free hands-free audio drilling for walking/transit/gym/dishes." This is the first explicit acknowledgment that ~80%-phone may include non-visual phone time. Amendment drafted in PROFILE.md awaiting a frame iter.
**Why this is a "new bucket" not "better cell":** Every existing surface assumes visual attention + a tap target. This is the first feature where the *modality itself* changes — audio in/out, lock screen as a first-class surface.
**Cross-subagent convergence:** Both subagents independently ranked this #1 (A's "Commute Audio Mode," B's "Voice Recall"). A's listen-only MVP is the cleaner scaffold; B's voice-in is the v2 path after MVP validates audio-out demand.

---

## In-flight (scaffolded or wired)

*(none yet)*

## Shipped

*(none yet)*

## Superseded / abandoned

*(none yet — entries move here when a later vision iter explicitly retires them, with a one-sentence reason)*

---

## Vision-iter subagent outputs (full)

*(retained for traceability; later vision iters can supersede entries above without losing the original framing)*

### iter 26 — subagent A's 5-proposal output (top 3 promoted above)

1. **Commute Audio Mode** — promoted to roadmap entry #3
2. **Mistake Post-Mortem & Concept-Attribution Journal** — promoted to roadmap entry #2
3. **AI Interview Coach** (explain-your-code after L3) — *not promoted iter 26; held for next vision iter.* Why held: requires bring-your-own-key LLM (no backend) which adds onboarding friction; cleaner to ship Recognize + Post-Mortem first and validate the metacognitive thread before adding a conversational surface that depends on user-provided LLM creds.
4. **Inverse Drill** (L0 tab before Reference) — superseded by entry #1 (Pattern Recognition Speed Drill) which is the standalone-mode variant of the same idea, with broader distractor pool.
5. **Daily Push + Cross-Device Sync (gist-backed)** — *not promoted iter 26; held for a future frame iter.* Why held: cross-device sync (BS-10) was flagged needing a frame-iter scope decision before any code; entry #2's localStorage schema bump (`__v: 6`) should land first to avoid migrating an evolving schema across devices.

### iter 26 — subagent B's 5-proposal output (top 3 promoted above)

1. **Voice Recall (Talk-Through Mode)** — partially folded into roadmap entry #3 (Commute Audio Mode MVP is listen-only; voice-in is the v2 path).
2. **Error Post-Mortem** — folded into roadmap entry #2 (B's lighter 2-iter version is the scaffold; A's concept-attribution is the v2).
3. **Pattern Recognition Speed Drill** — promoted to roadmap entry #1.
4. **Side-by-Side Diff Compare** — *not promoted iter 26; held for next vision iter.* Why held: existing diff view (CLAUDE.md § Features shipped) is binary; B's semantic-diff requires `docs/canonical-style.md` to be machine-parseable per-idiom, which is a research-iter dependency.
5. **Offline-First PWA with Wake Lock + Media Session** — *partially folded into entry #3* (Media Session + Wake Lock are part of Commute Audio Mode's scaffold). Standalone PWA-install + service-worker pre-cache held for a future ship iter; not a blocker for Audio Mode.
