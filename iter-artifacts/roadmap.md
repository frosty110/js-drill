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

**Status:** queued

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

**Status:** queued

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
