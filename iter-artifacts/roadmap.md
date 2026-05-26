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

## Meta-finding (iter 120 vision — fourteenth vision iter; iter-116 queue fully drained, Cat 1 + §9C push HEEDS subagent blind-spots warning)

**Fourteenth vision iter (after 26/31/48/55/59/64/82/90/95/100/103/112/116).** iter-116 roadmap queue fully shipped across iter 117/118/119 (Clarify-First + Hot-Seat + Time-to-Solve Calibration). Step 1B fires vision. Steering per iter-119: Cat 1 Drilling Surfaces (active list empty 28+ iters since iter-92), Cat 8 Modalities (only 1 ship at iter 109), Cat 9 §9C Adaptation/transfer (0 ships ever).

**ONE constraint-aware subagent** with explicit Cat 1 + Cat 8 + §9C steering. Returned 5 proposals AND a sharp blind-spots audit. **Critical blind-spots flag (item 4):** subagent self-noted that "§9C bias may itself be overcorrecting — three §9C proposals; shipping 3 in a row repeats iter-112's framing-error pattern. One §9C ship + measurement before stacking more." **Orchestrator HEEDED this** — promoted 2 (not the typical 3) and held 3 of 5 with explicit conditions.

**Promoted 2 (heedfully constrained per subagent's own warning):**
1. 🎬 **Reference Cinema** (Cat 1 — first Cat 1 surface enhancement since iter 92). Reference tab gains a "▶ Cinema" toggle: code starts blurred; tap reveals lines one at a time. Pure-tap retrieval-direction (read+predict-then-verify) distinct from Flash mode (token cloze) or Walkthrough Quiz (next-state pick). Near-zero per-lesson authoring — uses existing `reference.code` + optional `reference.notes` annotations. Subagent flagged "trivial lines feel empty" risk; orchestrator mitigation: v1 ships simple tap-to-advance (no auto-advance, no compress-trivial heuristic) — let users surface the friction before authoring per-lesson cinema.beats.
2. 🧪 **What-If Output Predictor** (Cat 1 + §9C hybrid). Per-lesson tap card: shown the (already-memorized) canonical + a fresh input → user picks output from 4 options (1 correct + 3 plausible off-by-one/edge wrongs). 30-sec soft timer. Misses route to weakness. Inverts the L1/L2/L3 ladder (given code, predict output for a NEW input). Subagent flagged "distractor authoring is hard"; orchestrator mitigation: v1 derives distractors from existing L1 wrong-options + bucket-shift on runCode output (off-by-one in numeric outputs / swap order in array outputs) — postpones the per-pattern distractor library to v2.

**Held with explicit re-promote conditions:**
- 🎚 **Constraint Shift** (§9C — third §9C proposal) — HELD heeding subagent's "§9C may overcorrect" blind-spot. Re-promote condition: iter-117/118 §9A surfaces (Clarify + Hot-Seat) demonstrate measurable engagement after 4-iter soak window. If §9A toggles see <10% adoption, §9C is likely low-leverage by extension and Constraint Shift stays held longer.
- 🔀 **Variant Generator** (§9C) — HELD on authoring fuzziness (subagent-flagged "blank may not be load-bearing for transfer"). Re-promote condition: Constraint Shift ships AND establishes a per-pattern-family rubric that Variant Generator can reuse.
- 🎧 **Eyes-Free Audio** (Cat 8) — HELD on PROFILE Amendment C blocker (4th time held — iter-26 + iter-95 + iter-112 + iter-120). Subagent re-flagged "audio assumes eyes-free time" — Amendment C instrumentation should ship as a small probe BEFORE the full audio build. Re-promote condition unchanged: Amendment C ratified + Page Visibility instrumentation confirms non-trivial eyes-free session population.

**Meta-learning (iter 120):** **fresh-eyes subagent self-flagged its own steering bias** — a higher-order blind-spots audit than the previous 3 instances (which caught load-bearing assumptions about shipped infrastructure). This is the **4th validation** of the blind-spots-audit pattern (iter-112 BS-10 + iter-115 sync sub-blob + iter-116 §9A content corpus + iter-120 §9C-bias-self-flag). The pattern is now load-bearing: **vision-iter subagent prompt should explicitly ask for a self-audit of its OWN biases, not just the orchestrator's blind-spots ledger.** Worth folding into SKILL.md vision-mode template.

Also: **promoting 2 instead of 3** is a new vision-iter shape — first time. Honest read of fresh-eyes warning > rote 3-promote convention. Worth recording: when subagent blind-spots audit explicitly flags overcorrection in N proposals, promote ≤(N-2) from that category.

§ Next nominates 🎬 Reference Cinema ship for iter 121.

---

### 2026-05-26 iter 120 — 🎬 Reference Cinema

**Status:** SHIPPED iter 121. Reference tab gained a 🎬 Cinema toggle next to 🃏 Flash. `_renderCinema(codeEl, code)` splits `reference.code` into one `<button class="cine-line">` per line, applies `filter: blur(5px)` via CSS, and tap toggles `.cine-revealed` to remove the filter. Empty lines render as a non-breaking space so blur has content. Shared `restoreCanonical()` helper makes Flash + Cinema mutually exclusive — flipping one resets the other so the two presentation modes never race over `codeEl.innerHTML`. Bypasses CodeMirror by design — `colorizeInto()` reapplies syntax highlighting on the OFF transition. ~57 LOC JS + 33 LOC CSS, schema-additive zero (no state field, no `__v` bump). Durable mobile probe `tools/cdp/cinema.js` **25/25 PASS** at iPhone viewport across 7 phases including mutual-reset in BOTH directions. Validator 698/0. **First Cat 1 Drilling Surfaces enhancement since iter 92 Flash mode** (29-iter drought broken). v2 candidates left for later: (1) per-lesson `cinema.beats` annotations that compress trivial lines (`}`, blanks, comment-only) into a single tap-target; (2) auto-advance mode for "lecture playback" feel; (3) per-line reveal-time stat to surface which lines a user repeatedly needs to peek at. Letting users surface the friction before authoring v2 is the iter-120 mitigation that informed the v1 scope.

**Value claim:** Cat 1 Drilling Surfaces has been quiet for 20+ iters; the Reference tab specifically hasn't been enhanced since Flash mode (iter 35). PROFILE.md L13-15 ("concepts intact, syntax/pattern degraded") means a rusty engineer doesn't need to *read* the canonical — they need to *predict* it line-by-line, then verify. Reference Cinema is the retrieval-direction the existing surfaces don't cover: read+predict-then-verify (distinct from Flash mode's token cloze + Walkthrough Quiz's next-state pick).
**Mechanic:** Reference tab gains a "▶ Cinema" toggle. When ON, canonical starts fully blurred; each tap reveals one line (with its inline note if present). Mobile-native, zero typing.
**Success criterion:** ≥25% of Reference-tab sessions toggle Cinema within 30 days of ship; lessons revisited via Cinema correlate with lower next-SR-interval miss rate.
**Estimated scope:** single-iter ship (~120 LOC JS + ~30 CSS + schema-additive in-memory state). Reuses Flash-mode infrastructure (already blurs Reference content).
**Data dependency:** none — uses existing `reference.code` line-split.
**PROFILE.md amendment proposed?** No.
**Implementation risk (subagent-flagged):** trivial lines (`}`, blank lines, comment-only) feel empty on tap-reveal. **Orchestrator mitigation:** v1 ships simple tap-to-advance (no auto-advance, no compress-trivial); let users surface the friction before authoring per-lesson `cinema.beats` annotations in v2.
**Why this is a "new bucket" not "better cell":** distinct retrieval direction from Flash (token cloze) and Walkthrough Quiz (next-state pick). Read+predict-then-verify is the *interview-prep* angle — match how the rusty engineer mentally previews each line as they read.
**Subagent source:** iter-120 vision iter — ranked #2 by subagent; orchestrator promoted as #1 (highest leverage given Cat 1's 20+ iter quietness + lowest authoring cost of all 5 proposals).

---

### 2026-05-26 iter 120 — 🧪 What-If Output Predictor

**Status:** QUEUED.

**Value claim:** Inverts the L1/L2/L3 ladder — given the canonical (memorized), predict the output for a *new* input. Targets the "trace mentally under interview pressure" skill (PROFILE L22-24) which no current surface drills as pure prediction (Crystal Ball iter 77 is read-code → predict, but uses canonical's OWN inputs; What-If uses NEW inputs).
**Mechanic:** Per-lesson tap card: shown canonical + a fresh input → user picks output from 4 options (1 correct + 3 plausible off-by-one/edge wrongs). 30-sec soft timer. Misses route to weakness.
**Success criterion:** Among lessons where users complete ≥3 What-If cards, repeat-miss rate on the canonical's L3 drops by ≥20% vs baseline (proves mental-trace transfers back to recall).
**Estimated scope:** single-iter ship (~160 LOC JS + ~35 CSS + new `state.whatif = {attempts, correct, sessions, lastRunAt}`).
**Data dependency:** existing `L3.canonical` (executable via runCode) + existing `L1.questions[].options` (for distractor mining).
**PROFILE.md amendment proposed?** No.
**Implementation risk (subagent-flagged):** plausible distractor generation is hard — naive random outputs don't teach edge-case sensitivity. **Orchestrator mitigation:** v1 derives distractors from (a) existing L1 wrong-options text + (b) algorithmic shift on runCode actual output (off-by-one for numerics; swap-order for arrays; toggle-edge-case for booleans). Postpones per-pattern distractor library to v2.
**Why this is a "new bucket" not "better cell":** Cat 1 + §9C hybrid. Crystal Ball predicts canonical-own-input output; What-If predicts NEW-input output — different cognitive operation (trace transfer vs trace recall). Pairs with iter-77 Crystal Ball to cover both directions.
**Subagent source:** iter-120 vision iter — ranked #4 by subagent (flagged "distractor authoring hard"); orchestrator promoted as #2 with the distractor-derivation mitigation — strong Cat 1 + §9C hybrid value at acceptable cost.

---

### 2026-05-26 iter 120 — HELD: 🎚 Constraint Shift (§9C overcorrection concern)

**Status:** HELD — heeds the subagent's "§9C bias may overcorrect" blind-spots audit (item 4 of 4 in iter-120 vision-iter blind-spots flag).

**Value claim:** Drills the interviewer follow-up "what if N is huge / streaming / k changes?" via mid-drill tap-cards.
**Mechanic:** After passing L1 on any patterns/applied lesson, tap-card stack: "Original assumed X. Now Y. Which line/data-structure changes?" 3-4 MC options. ~per-lesson authoring OR mechanic-tag-derived (Hot-Seat iter-118 precedent).
**Why held:** subagent self-flagged that 3 §9C proposals risk repeating iter-112's framing-error pattern. iter-117/118 §9A ships (Clarify-First + Hot-Seat) need a 4-iter soak window before validating that §9C is genuinely high-leverage; if §9A toggles see <10% adoption, §9C is likely low-leverage by extension.
**Re-promote condition:** iter-117/118 §9A surfaces demonstrate measurable engagement after 4-iter soak. OR a coverage/audit iter explicitly grounds the §9C value claim.

---

### 2026-05-26 iter 120 — HELD: 🔀 Variant Generator (§9C — authoring fuzziness)

**Status:** HELD — authoring contract is fuzzier than fill-in.

**Value claim:** Forces user to *produce* a related-but-different problem from a canonical (highest-fidelity transfer test).
**Mechanic:** Reference tab L2-style fill with strategic blanks tied to problem variation (input shape, return type, edge-case constraint) — not implementation.
**Why held:** subagent-flagged risk that the blank may not be load-bearing for pattern transfer; needs a per-pattern-family rubric. Re-promote condition: Constraint Shift ships AND establishes the per-pattern rubric that Variant Generator can reuse.

---

### 2026-05-26 iter 120 — HELD: 🎧 Eyes-Free Audio Drill (4th time held)

**Status:** HELD — same blocker as iter-26 + iter-95 + iter-112 + iter-120 (4-instance).

**Value claim:** Unlocks the unaddressed slice of 80%-phone time (commute walking, gym, dishes — eyes-free cognitive bandwidth).
**Mechanic:** TTS-driven L1 stream; user taps to advance/answer or uses Web Speech voice-in (degraded MVP = single-tap-cycle through options + tap-and-hold confirm).
**Why held:** PROFILE Amendment C (Commute Audio Mode) unratified; subagent + 3 prior vision iters all flagged the same dependency. Subagent additionally flagged Amendment C should ship as Page Visibility instrumentation FIRST (1-day probe) to confirm eyes-free time exists.
**Re-promote condition:** Amendment C ratified + Page Visibility instrumentation pilot ships AND confirms non-trivial eyes-free session population. Pattern: 4-time held = strong candidate for a frame iter to either ratify Amendment C OR formally retire the entry.

---

## Meta-finding (iter 116 vision — thirteenth vision iter; iter-112 queue fully drained, Cat 3/9§9A push)

**Thirteenth vision iter (after 26/31/48/55/59/64/82/90/95/100/103/112).** iter-112 roadmap queue fully shipped across iter 113/114/115 (Offline Pack + Sync Onboarding + JS Traps MVP) at the fastest 3-iter cadence yet. Step 1B fires vision per iter-115's nomination — § Next explicitly steered toward Cat 3 Mechanics (last touched iter 58 via 🏷 Mistake Tagging; SR mechanics work-stream stale ≥50 iters) and Cat 9 §9A In-the-room behaviors (last touched iter 81 via 🛡 Edge case chips; §9A has ZERO ships ever despite §9B having 4).

**Single constraint-aware subagent** (cost-conservative iter-100/103/108/112 precedent). Prompt steered toward Cat 3 + Cat 9 §9A. Also added a **blind-spots audit instruction** per the iter-112 pattern (vision iter doubles as a "what's already built that we're treating as blocked?" mechanism) — explicitly asked subagent to flag any assumption that looks load-bearing for its proposals.

**Subagent returned 5 proposals; orchestrator added pre-decided mitigations to top-3 implementation-risk concerns** (subagent flagged risks per the iter-95 instruction):
- 🎤 **Clarify-First Ritual** (subagent rank #1) — subagent flagged "too-formulaic distractors." Orchestrator mitigation: build correct options from lesson-specific `conversation.sections[0]` "Clarify" content (99 lessons authored); distractors from small curated bank of ~12 generic clarifiers — avoids the all-formulaic feel by injecting plausible-but-wrong-for-this-lesson options.
- 🔥 **Hot-Seat Follow-Up** (subagent rank #2) — subagent flagged "needs lesson-specific follow-ups." Orchestrator mitigation: build a small `data/hotseat-followups.json` registry (~10-15 mechanic-tag → follow-up mappings, e.g., `hash map` → "now make it O(1) space"; `sliding window` → "now input streams — one pass only"); per-lesson follow-ups resolved by `lesson.mechanics[]` lookup. **Single-iter ship feasible** because mechanic-tag mining (vs per-lesson authoring) keeps content cost bounded.
- ⏱ **Time-to-Solve Calibration** (subagent rank #3) — subagent flagged "skip-rate >50% kills the signal." Orchestrator mitigation: make estimate OPTIONAL with a no-shame "skip" affordance; treat skip-rate as a separate engagement signal (Stats tile shows "calibration engagement: X%") so even high-skip data has value.

**Promoted top 3 (Cat 3 + Cat 9 §9A push validated — 2 §9A first-ships + 1 Cat 3 ship):**
1. 🎤 **Clarify-First Ritual** — pre-L3 tap-gate chip drill mining Conv Sec.1 "Clarify" content. **First Cat 9 §9A ship ever.** ~140 LOC + tiny `data/clarify-distractor-bank.json` (~12 generic clarifiers). Mobile-tap-only.
2. 🔥 **Hot-Seat Follow-Up** — post-L3-pass tap-card with mechanic-tag-derived follow-up. **Second Cat 9 §9A ship.** ~120 LOC + `data/hotseat-followups.json` (~10-15 mappings). Mobile-tap-only.
3. ⏱ **Time-to-Solve Calibration** — pre-L3 4-button estimate + Brier-style scoring per mechanic + Stats tile. **First Cat 3 SR-mechanics ship since iter 58.** ~150 LOC + schema-additive `state.timeCalibration = {[mechanic]: {predictions: [], errors: []}}`. Mobile-tap-only.

**Held with explicit re-promote conditions:**
- 🗣 **Approach-First Sketch** (subagent rank #4) — HELD on data-quality concern. Subagent correctly flagged that walkthrough trace labels weren't authored as standalone-orderable. Re-promote condition: audit ≥40 lessons confirming trace labels are distinct + orderable (e.g., not all "update result"); if audit fails, scope reduces to a curated subset.
- 🎲 **Mixed-Section Mock Gauntlet** (subagent rank #5) — HELD on PROFILE-violation. Subagent self-flagged "desktop-only" (L3 typing under timer is desk-tier per PROFILE §34-36). Re-promote condition: a mobile-variant design (e.g., L1-instead-of-L3 gauntlet) that respects 80%-phone.

**Meta-learning (iter 116):** the **Cat 3 + Cat 9 §9A push worked** — every promoted entry landed in the steered categories (2 §9A + 1 Cat 3). Validates the iter-112 finding that "explicit category steering breaks the recombination-gradient attractor" — second use of the pattern. Also: **subagent blind-spots audit surfaced 2 useful findings** beyond the proposals: (a) `js/sync.js` per-field merge supports arbitrary new sub-blobs (so all 3 promoted state schemas are sync-additive with zero infra blocker), (b) the existing conversation + walkthrough corpus is rich enough for §9A drills without per-lesson authoring — the "§9A needs content" framing is wrong if the proposals mine existing fields. **Pattern is now load-bearing: vision-iter blind-spots audit caught 3 useful findings across iter-112 + iter-116 (BS-10 framing error; sync sub-blob additivity; §9A content-blocker misframing).**

§ Next nominates 🎤 Clarify-First Ritual ship for iter 117+ (first §9A ship ever).

---

### 2026-05-26 iter 116 — 🎤 Clarify-First Ritual

**Status:** SHIPPED iter 117. Opt-in toggle (sidebar 🎤 Clarify button, default OFF; sky-200 hover when ON) gates Patterns/Applied L3 visits behind a chip-card BEFORE the editor unlocks. `_clarifyExtractBullets(say)` regex-extracts bullet questions from `conversation.sections[0].say` (verified format consistency: 99 of 99 lessons have ≥2 extractable bullets). `_clarifyBuildCard()` shuffles 2-3 correct picks + 2-3 distractors from new `data/clarify-distractor-bank.json` (~15 generic-sounding lesson-irrelevant clarifiers). `_renderClarifyRitual()` replaces the L3 body with the card; correct tap → green ✓ + counter; wrong tap → red ✗ + `state.clarify.attempts++` (signal, not blocker). When all correct chips are tapped → `state.clarify.completed++` + `_clarifySessionCompleted.add(lessonId)` + 700ms-delayed `renderLesson()` to unlock the editor. Skip button bypasses + marks session-completed. **Bypassed during Mock Interview** (no scaffolding by design; mirrors iter-81 Edge case chips bypass). Toggle handler clears `_clarifySessionCompleted` so flipping ON immediately gates the current lesson. Schema-additive `state.clarifyRitualOn` boolean + `state.clarify = {attempts, correct, completed, sessions, lastRunAt}` — no `__v` bump. ~155 LOC JS + ~85 CSS + 15-entry JSON bank.

Mobile probe `tools/cdp/clarify-ritual.js` **16/16 PASS** at iPhone viewport — button present, defaults OFF, toggle flips flag, ritual renders 6 chips (3 correct + 3 wrong) on L3 visit, editor NOT rendered while ritual active, wrong tap increments attempts + red marker + no completion, all-correct taps → completed=1 + correct≥2 + editor unlocks + ritual gone, re-nav to same lesson L3 within session shows editor (not ritual — completion sticks), toggle OFF skips ritual on fresh lesson. Validator 698/0.

**First Cat 9 §9A In-the-room behaviors ship ever** (34-iter drought broken; §9B has 4 ships from iter 73/76/79/81, §9A had 0). The retrieval direction is genuinely new — every prior surface drills the ANSWER (code production, recognition, recall); this drills the QUESTIONS-BEFORE-CODING cadence which is the #1 senior-vs-junior grading axis. Pairs orthogonally with the queued 🔥 Hot-Seat Follow-Up (iter-116 #2) to cover both ENDS of the interview interaction.

**Implementation-risk mitigation pre-decided in iter-116 roadmap entry worked end-to-end:** lesson-specific clarifiers + generic distractor bank avoided the "too-formulaic distractors" concern. Probe confirms each card mixes lesson-aware correct picks with generic plausible wrongs.

**Value claim:** PROFILE.md §22-24 ("out of practice with the cadence of read prompt → talk through approach"). The rusty engineer jumps to code without the 3-question clarifying ritual that signals seniority — the #1 senior-vs-junior grading axis in coding interviews. **First Cat 9 §9A ship ever** (34 iters since last Cat 9 ship; §9B has 4 ships, §9A has zero).
**Mechanic:** Before any Patterns/Applied L3, show the prompt + 4-6 tap-chips of candidate clarifying questions. Correct options mined from the lesson's `conversation.sections[0]` "Clarify" content (99 lessons have this); distractors from a small `data/clarify-distractor-bank.json` of ~12 generic clarifiers ("can the input be empty?", "are duplicates allowed?", "is the input sorted?", etc.). User must tap the 2-3 valid ones before the L3 editor unlocks. Opt-in via Mock Interview toggle initially (avoid forcing all L3 users into the ritual until calibrated).
**Success criterion:** Median time-to-first-edit on L3 increases by 20-40s while L3 pass-rate holds steady — users front-load thinking instead of stalling mid-code. Secondarily: clarifier-tap-correctness improves session-over-session.
**Estimated scope:** single-iter ship (~140 LOC JS + ~30 CSS + ~12 generic-distractor entries in new JSON registry).
**Data dependency:** `conversation.sections[0]` already authored for 99 Patterns/Applied lessons (per CLAUDE.md). For lessons without conversation (55 Syntax lessons), gate is hidden or uses Reference notes as fallback.
**PROFILE.md amendment proposed?** No.
**Implementation risk (subagent-flagged, orchestrator-mitigated):** too-formulaic distractors → ritual becomes rote. **Mitigation pre-decided:** use lesson-specific clarifiers as CORRECT options; distractors from small curated bank — every card mixes lesson-aware correct picks with generic plausible wrongs, which forces actual reading not pattern-matching.
**Why this is a "new bucket" not "better cell":** every prior surface drills the *answer* (code production, recognition, recall). This drills the *interview ritual* — what to SAY before coding. Different cognitive operation entirely.
**Subagent source:** iter-116 vision iter — ranked #1 by leverage-per-effort; first Cat 9 §9A ship ever.

---

### 2026-05-26 iter 116 — 🔥 Hot-Seat Follow-Up

**Status:** SHIPPED iter 118. Opt-in sidebar 🔥 Hot-Seat toggle (default OFF; rose-200 when ON). Hook in `markPassed()` for L3 passes calls `_maybeShowHotseat(lessonId)`. New `data/hotseat-followups.json` registry with `byMechanic` map (~20 entries covering top-frequency mechanics) + `default` fallback. `_hotseatBuildCard()` resolves the first matching `lesson.mechanics[].id` to the correct follow-up; picks 3 distractors from OTHER mechanics' follow-ups (interviewer-shaped but clearly wrong for THIS problem). `_showHotseatModal()` renders centered scrim overlay with 4 options + Skip (✕/scrim-click/Esc). Wrong tap → red marker + `state.hotseat.attempts++` (signal not blocker); correct → green marker + `state.hotseat.correct++` + resolved feedback + Continue button. Bypassed during Mock Interview. Schema-additive `state.hotseatOn` + `state.hotseat = {attempts, correct, sessions, lastRunAt}` — no `__v` bump. ~150 LOC JS + ~85 CSS + 20-entry JSON registry.

**Coverage check before shipping** (per iter-117 verify-before-ship pattern): 88/99 Patterns+Applied lessons have `mechanics[]` tags. Top tags (array-as-stack, linked-list-walk, tree-recursion, dp-tabulation, freq-map, two-pointer, sliding-window, backtrack-template, etc.) all covered in the registry. The 11 untagged lessons fall through to the `default` follow-up. Validates iter-116 fresh-eyes finding that mechanic-tag lookup obviates per-lesson authoring.

Probe `tools/cdp/hotseat-followup.js` **16/16 PASS** at iPhone viewport — button defaults OFF, toggle flips, two-sum mechanics precondition, modal renders 4 options + header + skip after L3 pass, exactly 1 correct + 3 wrong distractors, wrong-tap red + attempts++ + no resolve, correct-tap green + resolved + Continue + correct++, Continue closes modal, toggle OFF skips modal on subsequent L3 pass. Validator 698/0.

**Second Cat 9 §9A ship** (after iter-117 Clarify-First). Pairs orthogonally to cover both ENDS of interview interaction: clarify-before-coding (iter 117) + iterate-on-correct-answer (iter 118). Cat 9 §9A now has 2 ships in 2 iters after a 34-iter drought. **First post-L3-pass overlay surface** — every prior post-pass UX was inline (next-CTA row, mock toast). Establishes the modal-overlay pattern for celebration-or-reflection moments.

**Value claim:** PROFILE.md §22 ("interviewer asks a follow-up after you finish"). Rusty engineers freeze when "now make it O(1) space" lands after a working solution — the L3 ladder ends at first-pass, but real interviews don't. **Second Cat 9 §9A ship**, paired with Clarify-First Ritual to cover both ENDS of the interview interaction (clarify → code → follow-up).
**Mechanic:** After any L3 pass, surface a tap-card with one of 3-4 follow-ups resolved via the lesson's `mechanics[]` tags. Follow-ups live in a new `data/hotseat-followups.json` registry (~10-15 mechanic-tag → follow-up mappings: `hash map` → "now make it O(1) space"; `sliding window` → "now input streams, one pass only"; `binary search` → "now find leftmost/rightmost"; etc.). User picks the right new approach name (tap, not type) within 30s. Misses route to `state.weakness` per existing pattern.
**Success criterion:** ≥40% of L3 passes get a follow-up tap attempted within the same session; users who engage with follow-ups show faster repeat-mock-interview times than non-engagers.
**Estimated scope:** single-iter ship (~120 LOC JS + ~25 CSS + new JSON registry with ~10-15 mechanic-tagged entries). Schema-additive `state.hotseat = {attempts, correct, sessions, lastRunAt}`.
**Data dependency:** `lesson.mechanics[]` tag (already present on most Patterns lessons per the Mechanics modal infrastructure). New JSON registry is small + hand-authored.
**PROFILE.md amendment proposed?** No.
**Implementation risk (subagent-flagged, orchestrator-mitigated):** generic follow-ups feel hollow. **Mitigation pre-decided:** mechanic-tag-based resolution (vs per-lesson authoring) keeps content cost bounded while still being lesson-relevant — every lesson tagged `hash map` gets the O(1)-space prompt because it's load-bearing for THAT class of solution. Per-lesson overrides supported via optional `lesson.hotseat[]` field for high-traffic lessons.
**Why this is a "new bucket" not "better cell":** existing surfaces all end at "got the right answer." This is the first surface that asks "now what?" — the iterate-on-correct-answer beat that mid-interview pressure depends on.
**Subagent source:** iter-116 vision iter — ranked #2; second §9A ship; pairs orthogonally with Clarify-First Ritual.

---

### 2026-05-26 iter 116 — ⏱ Time-to-Solve Calibration

**Status:** SHIPPED iter 119 (v1 MVP; Stats tile DEFERRED to v2). **iter-116 queue FULLY DRAINED** (3 of 3 SHIPPED across iter 117/118/119). Opt-in sidebar ⏱ Calibrate toggle (default OFF, amber-200 when ON). When ON + Patterns/Applied + not Mock + not yet estimated/skipped for this lesson this session → inline strip injected at TOP of L3 wrap with 4 bucket buttons (<2 / 2-5 / 5-10 / 10+ min) + Skip. Bucket tap → strip removed + `_calibrationActive[lessonId] = {bucket, startedAt}` + `state.timeCalibration.meta.estimates++`. On L3 pass with active estimate → compute actualSec + errorSec (vs bucket midpoint: 90/210/450/900s) + append `{bucket, actualSec, errorSec, at}` to `state.timeCalibration.byMechanic[id].predictions[]` for each `lesson.mechanics[].id` (cap 50 per mechanic). Skip → `meta.skips++` + strip dismissed for session. Schema-additive `state.calibrateOn` + `state.timeCalibration = {byMechanic: {}, meta: {estimates, skips, passes}}` — no `__v` bump. ~125 LOC JS + ~30 CSS. Probe `tools/cdp/time-calibration.js` **17/17 PASS** at iPhone viewport. Validator 698/0.

**First Cat 3 SR-mechanics ship since iter 58** (61-iter Cat 3 drought broken). Mechanic-tag substrate captured this iter sets up the **v2 Stats tile** (deferred): show top-5 most-miscalibrated mechanics by median errorSec, auto-hidden until ≥5 data points per mechanic. v2 also a candidate spot for soak-window-driven decisions (e.g., what `errorSec` threshold reads as "miscalibrated"). v2 is a follow-on tooling ship, ~50 LOC.

**Bypassed during Mock Interview** + mechanic-tag check skips Syntax-track lessons (no scaffolding by design; respects PROFILE 80%-phone non-disruption). Skip-rate tracked SEPARATELY from estimates so a noisy skip pattern doesn't pollute the calibration signal — matches the iter-116 entry's pre-decided mitigation.

**Value claim:** PROFILE.md §65 ("hit L3 within target time") is currently a stated success criterion with no calibration surface — users don't know if their 6-minute Two Sum is fast, average, or panic territory. **First Cat 3 SR-mechanics ship since iter 58 🏷 Mistake Tagging.**
**Mechanic:** Before every L3, user taps a 4-button estimate ("<2 / 2-5 / 5-10 / 10+ min"). After L3 pass, compute estimate-vs-actual delta and store Brier-score-style calibration per `lesson.mechanics[]` tag. Stats modal shows over/under-confidence per mechanic ("you systematically underestimate `sliding window` by 4 min — that's the interview blowup risk"). Estimate is OPTIONAL with a no-shame "skip" affordance; skip-rate is itself a signal tracked separately as "calibration engagement %".
**Success criterion:** Median absolute estimation error drops from session 1 to session 10 by ≥30% for users who engage; Stats tile surfaces ≥3 mechanics where the user is systematically miscalibrated by week 2.
**Estimated scope:** single-iter ship (~150 LOC JS + ~35 CSS). Schema-additive `state.timeCalibration = { [mechanic]: { predictions: [{estimateBucket, actualMs}], errors: [absError] } }`.
**Data dependency:** `lesson.mechanics[]` tag (existing) + L3 timer (already captured via mockHistory schema). No new authoring.
**PROFILE.md amendment proposed?** No.
**Implementation risk (subagent-flagged, orchestrator-mitigated):** mobile skip-rate >50% → noisy signal → vanity stats. **Mitigation pre-decided:** estimate is OPTIONAL not gated; skip-rate is a tracked signal not a failure mode; Stats tile auto-hides until ≥5 data points per mechanic so vanity metrics aren't shown prematurely.
**Why this is a "new bucket" not "better cell":** existing Cat 3 Mechanics surfaces (Mistake Tagging, Mechanics × Track Matrix, Mechanic-Bridge) all measure *what* the user knows; this measures *how well-calibrated* their self-assessment is — a meta-cognitive layer that's load-bearing for interview-readiness (over-confidence is the most dangerous failure mode for the rusty engineer).
**Subagent source:** iter-116 vision iter — ranked #3; first Cat 3 ship since iter 58.

---

### 2026-05-26 iter 116 — HELD: 🗣 Approach-First Sketch (walkthrough-trace data-quality blocker)

**Status:** HELD — needs walkthrough-trace label audit before scoping.

**Value claim:** Drills PROFILE §22 "talk through approach before coding" — the #1 interview-grading axis that the silent L3 editor actively trains against. Pairs orthogonally with Clarify-First Ritual (clarify → plan → code).
**Mechanic:** Tap-only "plan card" gate before L3 unlocks: user orders 4-6 shuffled approach-step chips mined from the lesson's `walkthrough.trace` line-labels.
**Why held:** subagent correctly flagged that walkthrough trace labels weren't authored to be standalone-orderable. Many lessons may have ambiguous labels ("update result") or trivially-orderable sequences. **Re-promote condition:** audit ≥40 lessons confirming trace labels are distinct + orderable; if audit fails, scope reduces to a curated subset (~20 lessons with clear trace-label sequences) for v1.

---

### 2026-05-26 iter 116 — HELD: 🎲 Mixed-Section Mock Gauntlet (PROFILE 80%-phone violation)

**Status:** HELD — desktop-only violates PROFILE.md 80%-phone profile.

**Value claim:** Real interviews don't tell you the section; current Mock Interview surface labels the section, so the user knows the family before they read. A mixed-section gauntlet would drill cold-start pattern recognition under timer.
**Mechanic:** 3-problem timed session pulling random L3 prompts across Patterns sections with no section label; user taps section-name (Recognize-style) then solves under timer.
**Why held:** subagent self-flagged that L3 typing under timer is desktop-only (PROFILE §34-36). This feature would serve the 20% desk-tier slice while excluding the dominant 80% mobile user. **Re-promote condition:** a mobile-variant design (e.g., L1-instead-of-L3 gauntlet, or "Recognize-then-tap-canonical-shape" rather than "Recognize-then-type") that respects the mobile-first constraint.

---

## Meta-finding (iter 112 vision — twelfth vision iter; iter-103 queue + 3 shortlist ships drained, Cat 4/6 push)

**Twelfth vision iter (after 26/31/48/55/59/64/82/90/95/100/103).** iter-103 roadmap queue fully shipped across iter 104/106/107 (Command Palette + Mastery Half-Life + Session Heatstrip), then 3 consecutive shortlist consumptions from `ideas-by-category.md` (iter-108 🍀 Lucky + iter-109 🔖 Match + iter-111 🌈 Sections). 4 product ships in 4 iters with no roadmap refill — Step 1B fires vision per iter-109's emergent rule (3+ consecutive shortlist ships + remaining-shortlist-all-heavy-OR-stale-category → vision).

**Single constraint-aware subagent** (cost-conservative iter-100/103/108 precedent). Prompt explicitly steered toward **Cat 4 Content / Cat 6 Persistence** per iter-111's "Cat 7 mined out — 4 ships in 12 iters" meta-finding. Cat 7 had been the recombination-gradient default since iter-101; this vision iter forces the loop into territory it has been avoiding (Cat 4 needs per-lesson authoring; Cat 6 needs cross-device infrastructure).

**Subagent returned 5 proposals; orchestrator cross-check surfaced 1 over-cost claim:**
- 📵 **Offline Drill Pack** (subagent rank #1) — subagent flagged CDN-vendoring as risk-of-being-half-measure. Orchestrator agrees but **rescopes**: ship lessons + manifest + app-shell offline-cache as v1 (single iter), document CDN-vendoring as v2 follow-on. Don't let "true offline guarantee" perfectionism block the dominant-use-case win.
- ☁️ **Sync Onboarding** (subagent rank #2) — **subagent re-discovered that `js/sync.js` already exists and is auto-injected as a top-right chip** (verified by orchestrator: `js/sync.js` is 500+ lines of production Supabase sync; `supabase/migrations/001_user_progress.sql` exists; CLAUDE.md documents the contract). This is NOT a "build sync" entry; it's a "promote the existing chip via discoverability UX" entry. Cost drops from multi-iter scaffold to single-iter ship. Subagent's email-OTP friction risk is mitigated by ONLY surfacing the hint when the user has demonstrated commitment (first L3 pass on desktop), NOT auto-prompting during drilling.
- 🪤 **JS Traps content section** (subagent rank #3) — Cat 4 Content. Subagent estimated 12 lessons × full L1/L2/L3 + conversation/walkthrough. Orchestrator rescopes: **v1 ships 1-3 sample lessons** to validate the format (the 30+ existing s-* syntax lessons cover some of this; risk of overlap is real). Decision to scale to 12 deferred until the 3-sample MVP lands.
- 🗣 **Eyes-Free Audio L1** (subagent rank #4) — BLOCKED on PROFILE Amendment C (Commute Audio Mode); subagent correctly identified the dependency. HELD with re-promote condition.
- 📤 **Resume Snippet Export** (subagent rank #5) — gamification risk per PROFILE L75 (subagent self-flagged); orchestrator agrees and additionally notes the surface area drifts toward "streak-bragging." HELD with explicit anti-gamification mitigation as re-promote condition.

**Promoted top 3 (Cat 4/6 push validated — 2 of 3 land in Persistence, 1 in Content):**
1. 📵 **Offline Drill Pack** — service-worker pre-cache `data/manifest.json` + 143 lesson JSONs + app shell (CSS/JS). v1 accepts CDN-from-cache (Tailwind, CodeMirror reload-from-cache after first online visit); v2 vendors CDN assets for true offline guarantee. Single-iter ship. **Mobile leverage = enormous** per PROFILE 80%-phone (subway / plane / spotty LTE moments).
2. ☁️ **Sync Onboarding Promotion** — promote the EXISTING `js/sync.js` chip via a one-time hint banner shown after the user's first L3 pass on a *desktop user-agent* (signal of commitment + signal the user has been drilling cross-device). Banner copy: "Your phone progress and laptop progress are separate today. Tap Sync to merge them." Defer the email-OTP modal until the user explicitly taps. ~50 LOC ship. **First Cat 6 surface improvement since iter 88 AI Coach Export.**
3. 🪤 **JS Traps section (v1: 3-lesson sample MVP)** — new section "JS Traps" with 3 hand-curated lessons covering canonical phone-tappable traps (e.g., `Array(3).fill([])` shared-reference; `typeof null === 'object'`; `parseInt` radix surprise). Pure L1+L2+L3 ladder (no conversation/walkthrough at MVP — Patterns-style narrative is overkill for atomic traps). Validates the format before scaling to 12. **First Cat 4 content ship since iter 22.**

**Held with explicit re-promote conditions:**
- 🗣 **Eyes-Free Audio L1** (subagent held) — BLOCKED on PROFILE Amendment C ratification (Commute Audio Mode) + Page Visibility instrumentation. Re-promote condition: a frame iter ratifies Amendment C and a small instrumentation pilot confirms walk/commute sessions are actually eyes-free (subagent's "screen-on-in-pocket" risk).
- 📤 **Resume Snippet Export** (orchestrator-held on gamification) — re-promote condition: a concrete anti-gamification mitigation pre-decided (e.g., share URL renders mastered-lesson LIST not streak/mock counts; recruiter-paragraph text emphasizes specific patterns drilled not days-in-a-row). Pattern matches iter-103 Heatstrip's pre-decided-mitigation gate.

**Meta-learning (iter 112):** the **Cat 4/6 push worked** — subagent honored steering (2 Persistence + 1 Content + 1 Modalities + 1 Persistence-adjacent). Surfaced 1 important meta-discovery: **the loop's "blind spots ledger" didn't track that `js/sync.js` was already shipped**, so iter-95's BS-10 Cross-device sync entry incorrectly carried "BLOCKED — Frame-iter prereq" framing for many iters when the infrastructure was actually live. Worth a SELF-IMPROVE.md correction: BS-10 should be "INFRA SHIPPED iter ~88 (sync.js); UX PROMOTION pending" not "BLOCKED." Subagent fresh-eyes caught this where iteration-history-primed orchestrator did not. Validates the iter-55 fresh-eyes-priming meta-finding.

§ Next nominates 📵 Offline Drill Pack ship for iter 113+.

---

### 2026-05-26 iter 112 — 📵 Offline Drill Pack

**Status:** SHIPPED iter 113. New `service-worker.js` at repo root pre-caches the app shell (`./`, `index.html`, `app.js`, `app.css`, `tokens.css`, `js/storage.js`, `js/sync.js`, `js/supabase-config.js`, `js/supabase-client.js`, `js/core/util.js`, `js/core/runner.js`, `data/manifest.json`) on `install`. Then fetches manifest and chunked-precaches every full-status lesson JSON (151 lessons in this build) via 20-at-a-time `cache.addAll` to avoid request-storm. `activate` deletes stale `CACHE_VERSION` keys + claims open clients. `fetch` is cache-first for same-origin GET (return cached → on miss, fetch + cache + return → on network fail with no cache, return 503). Cross-origin requests (CDN: Tailwind, CodeMirror, Supabase) bypass to network — picked up by browser HTTP cache after first online visit per the pre-decided v1 scope. New page-side `pollOfflinePackStats()` postMessages the active SW via a transferred MessageChannel port; SW replies with `{lessonCount, totalCount, version}`. Sidebar chip `📦 Offline (N)` (cyan-200 hover, hidden until count > 0) shows the cached lesson count; persisted to `state.offlinePack` so cold-start paints without a SW round-trip. Initial-install polling at load + 3s + 8s catches the populated state without busy-waiting. Schema-additive — no `__v` bump. ~115 LOC SW + ~50 LOC page glue + 1 LOC CSS (hidden class reuse).

Probe `tools/cdp/offline-pack.js` **9/9 PASS** at iPhone viewport — SW installs + controls page within 30s, cache populated with 163 entries (151 lessons + 5 shell + auxiliaries), 151 lesson JSONs precached, cached lesson (two-sum) serves correctly via fetch from the page, chip element present + visible + shows "151" + state.offlinePack.lessonCount=151 persisted across reload. Validator 687/0.

**Known v1 limitations** (documented for v2 follow-on): (a) CDN dependencies (Tailwind, CodeMirror v5, Supabase JS v2) are NOT precached — first visit must be online for them to land in browser HTTP cache; subsequent offline visits will succeed as long as the browser hasn't evicted them. (b) `file://` skips registration entirely (SW requires http(s) origin); local dev via `python3 -m http.server` works because `localhost` is exempt from the HTTPS requirement.

**Value claim:** PROFILE.md L26-28 (20 free minutes, friction near zero) + L42 (phone-tier dominance). Today a subway-tunnel or spotty-LTE moment breaks lesson lazy-load and the user loses their 20-min window. Offline-cache the corpus once on first visit; never block on network again.
**Mechanic:** Service worker pre-caches `data/manifest.json` + all 143 lesson JSONs + `app.js` / `app.css` / `index.html` / `tokens.css` on first visit. Subsequent visits hydrate from cache. A "Pack downloaded ✓" chip in the sidebar confirms offline-readiness. CDN deps (Tailwind, CodeMirror) cached via browser HTTP cache after first online visit; v2 vendors them for true offline guarantee.
**Success criterion:** Sessions started in `navigator.onLine === false` complete at ≥70% the rate of online sessions, measured via a new `state.history` event with `online: false` flag on session-start.
**Estimated scope:** single-iter ship (~120 LOC service worker + 20 LOC chip UI + ~30 LOC CSS). Adds `service-worker.js` + a `<script>` registration in `index.html`. Schema-additive `state.offlinePack = { lastCachedAt, lessonCount }`.
**Data dependency:** none — all 143 lesson JSONs already exist as static files; pure manifest-walk + cache.addAll.
**PROFILE.md amendment proposed?** No (PROFILE already names mobile/transit as the dominant use case).
**Implementation risk (subagent-flagged):** CDN deps (Tailwind, CodeMirror) make true offline a half-measure without vendoring; **orchestrator mitigation pre-decided** — ship v1 with browser-HTTP-cache for CDNs (works after first online visit), document v2 vendoring as a follow-on iter.
**Why this is a "new bucket" not "better cell":** every prior surface assumed network-available. Offline-pack is the first surface that fundamentally changes the *substrate* of every other surface — they all keep working without network. Compounds with every existing feature.
**Subagent source:** iter-112 vision iter — ranked #1 by leverage-per-effort; aligns with iter-93 Promotion shortlist #4 (PWA install) but with sharper scope.

---

### 2026-05-26 iter 112 — ☁️ Sync Onboarding Promotion

**Status:** SHIPPED iter 114. New `_maybeShowSyncHint()` + `_showSyncHintBanner()` in app.js, hooked into `markPassed()` on L3 passes. Gating: state.syncHintShown false AND `_isDesktopPointer()` true (fine pointer + ≥768px viewport) AND `#sync-chip` mounted (js/sync.js loaded) AND chip not already signed-in. Banner is a fixed bottom-center surface with sky/cyan accent (distinct from existing toast variants); title "Drilling on multiple devices?" + sub "Your phone progress and laptop progress are separate today. Tap Sync to merge them across devices." + two actions (Tap Sync / Dismiss). Either action sets state.syncHintShown=true (persistent across reloads/sessions). Tap Sync additionally invokes the existing #sync-chip click handler → opens the existing sync-modal — zero duplicate auth code. Schema-additive `state.syncHintShown` boolean — no `__v` bump. Mobile-emulated viewport correctly skips the banner per `_isDesktopPointer()` check (coarse pointer = false). ~75 LOC JS + ~55 CSS.

Probe `tools/cdp/sync-onboarding.js` **12/12 PASS** at desktop viewport (1280×800) — clean state has no banner, #sync-chip mounted (confirms js/sync.js loaded), banner appears after first L3 pass, has slide-in class + Tap Sync + Dismiss buttons, Dismiss removes banner + sets flag, banner does NOT reappear on subsequent L3 pass (one-time invariant), reset-then-Tap-Sync path re-shows banner and Tap Sync invokes #sync-chip click → #sync-modal.is-open. Validator 687/0.

**Loop-discipline impact:** the iter-112 vision-iter fresh-eyes finding (BS-10 framing wrong for 17 iters) led directly to this 75-LOC ship that retroactively unlocks the cross-device value of `js/sync.js` for the dominant 80%-phone user. The "blind spots ledger correction" was load-bearing for the next ship target.

**Value claim:** `js/sync.js` is fully built but hidden behind a small top-right chip the user doesn't notice. The rusty engineer who taps L1/L2 on transit then sits down at a laptop expecting their progress to follow them today starts cold (separate localStorage stores per browser/device). Closes that expectation gap by making the existing sync infrastructure DISCOVERABLE at exactly the moment commitment is highest.
**Mechanic:** After the user's first L3 pass on a *desktop user-agent* (signal of commitment + cross-device drilling), show a one-time hint banner with copy "Your phone progress and laptop progress are separate today. Tap Sync to merge them." Banner has Dismiss + Tap-Sync buttons. Banner dismissal stored in `state.syncHintShown = true`. Tap-Sync triggers the existing top-right chip's sign-in modal (no new auth code needed).
**Success criterion:** % of weekly active users with ≥1 lesson touched on both a mobile and desktop user-agent within a 7-day window rises above 25% (matches subagent's metric).
**Estimated scope:** single-iter ship (~50 LOC banner UI + handler + state field). Reuses 100% of existing `js/sync.js` infrastructure.
**Data dependency:** `navigator.userAgent` for desktop detection + `state.history` L3-pass events for first-pass detection. Both already in place.
**PROFILE.md amendment proposed?** No.
**Implementation risk (subagent-flagged, orchestrator-mitigated):** email-OTP friction during a drill session violates PROFILE.md "friction near zero." **Mitigation pre-decided:** the banner ONLY surfaces post-L3-pass (commitment moment, not mid-drill); the email-OTP modal opens ONLY on explicit tap; banner has a clear Dismiss; `syncHintShown` flag prevents re-prompting on subsequent L3 passes.
**Why this is a "new bucket" not "better cell":** every prior persistence surface (localStorage, Backup/Restore, AI Coach Export) operates within a single browser. Sync-onboarding promotes the existing multi-device substrate that's been silently shipped. Different category of leverage — closes a *cross-device* gap, not a single-device feature.
**Subagent source:** iter-112 vision iter — ranked #2; subagent fresh-eyes caught that `js/sync.js` already exists (orchestrator verified — file is 500+ lines of production Supabase sync). This entry is a *promotion* not a *build*.

---

### 2026-05-26 iter 112 — 🪤 JS Traps section (v1: 3-lesson sample MVP)

**Status:** SHIPPED iter 115. **iter-112 vision queue FULLY DRAINED** (3 of 3 SHIPPED: Offline Pack iter 113 + Sync Onboarding iter 114 + JS Traps MVP iter 115). New section "JS Traps" (slug `js-traps`, track `syntax`) with 3 lessons authored via 3 parallel sub-agents:

- **t-tdz** — Temporal Dead Zone (`let`/`const` TDZ vs `var` hoisting). 4 L1 questions + 2 L2 exercises + L3 canonical. Reference.code uses `var` to contrast hoisting behavior — added to validator's `BANNED_SYNTAX_EXEMPTIONS` (same pattern as `s-variables`/`s-loops`/`s-closures`).
- **t-floating-precision** — `0.1 + 0.2 !== 0.3` IEEE 754 trap. 5 L1 questions + 3 L2 exercises + L3 canonical (epsilon-comparison helper). No `var` anywhere; no validator exemption needed.
- **t-delete-array-holes** — `delete arr[i]` leaves holes; `length` stays the same; iteration methods skip holes inconsistently. 4 L1 questions + 3 L2 exercises + L3 canonical (`removeAt(arr, i)` using `splice`). Algorithm-shape canonical with explicit `for(i)` vs `forEach` contrast.

**Curation pass:** orchestrator pre-checked the manifest for overlap before authoring — initial picks (Array.fill shared-ref / typeof null / parseInt radix) were rejected because `s-arr-create` mentions Array(n).fill([]) trap in notes/L1, `s-this` touches `typeof null`, and `s-number-parse` covers parseInt radix surprise comprehensively. Pivoted to TDZ + floating + delete-holes which have zero existing dedicated coverage. **Validates the "curation pass first" mitigation pre-decided in the iter-112 roadmap entry.**

**Parallel sub-agent workflow:** First agent (t-tdz) authored + added the new section to manifest.json + added validator exemption. Subsequent 2 agents (parallel) authored their JSON files only — orchestrator patched manifest with their entries after. Pattern: **first-in-section agent does manifest + validator setup; follow-on agents are pure authoring.** Worth folding into the author-lesson skill scaffolding when multiple lessons go into a new section.

Validator 698/0 (was 687/0 → +11 = 3 lessons × ~3-4 exercises each). Mobile probe `tools/cdp/js-traps-section.js` **10/10 PASS** (section header in sidebar, all 3 lessons status=full + track=syntax + section="JS Traps", select-lesson loads content + exposes L1/L2/L3 tabs, all 3 lessons have ≥3 L1 questions per PROFILE floor).

**Scale decision:** v1 MVP locked in. Decision to scale to ~12 lessons (full BS-03 + JS gotcha trap bag closure) deferred until soak window — let users drill these 3 and surface "what's missing" before committing to 9 more.

**Value claim:** Senior FE / full-stack interviews regularly ask "what does this print?" trap questions (`Array(3).fill([])` shared-reference, `typeof null === 'object'`, `parseInt` radix surprise, `[] == false` but `[] !== false`, `0.1 + 0.2 !== 0.3`, `Object.keys` ordering on numeric keys, `delete arr[0]` leaves holes, hoisting/TDZ edge cases). The 28 existing sections cover algorithms/DS deeply but have minimal coverage of these JS-specific traps. The rusty engineer who hasn't written vanilla JS in 5 years is most likely to fail on these — they're the prerequisite for confident L3 typing.
**Mechanic:** New "JS Traps" section with 3 sample lessons (`a-traps-fill-shared-ref`, `a-traps-typeof-null`, `a-traps-parseint-radix` or similar). Each lesson: pure L1+L2+L3 ladder (no conversation/walkthrough at MVP — atomic traps don't need narrative). L1 asks "what does this print?" with 4 plausible distractors; L2 fills the trap-aware fix; L3 reproduces the bug-then-fix pattern.
**Success criterion:** After 14 days of being live, the new section's average L1-pass rate on first attempt is 40-70% — calibrated to be neither trivial nor unreachable. Below 40% → distractors are too plausible; above 70% → traps are too well-known.
**Estimated scope:** single-iter ship for the 3-lesson MVP (~30 min per lesson via `author-lesson` skill = ~90 min total + validator + manifest update). Multi-iter ship for the full ~12-lesson section (3 follow-on iters, ~3 lessons per iter). Format-validation MVP first; scale decision deferred.
**Data dependency:** none — pure new content authoring.
**PROFILE.md amendment proposed?** No.
**Implementation risk (subagent-flagged):** overlap with existing `s-event-loop`, `s-this`, `s-coercion`, `s-hoisting`, `s-prototype` syntax lessons creating duplicate-feeling drills. **Orchestrator mitigation:** v1 deliberately picks 3 traps that have NO existing lesson (verify via manifest grep before authoring); curation pass before MVP defines the "no overlap" list; subagent's authoring instruction includes "do not duplicate existing s-* lesson scope."
**Why this is a "new bucket" not "better cell":** every existing section covers a DATA STRUCTURE or PATTERN; this is the first section about LANGUAGE-LEVEL TRAPS that don't fit any algorithmic category. Different lesson shape: bug-then-fix rather than concept-then-canonical. First Cat 4 content ship since iter 22 (s-index-math).
**Subagent source:** iter-112 vision iter — ranked #3; closes BS-03 "JS-specific gaps" parking-lot entry in `ideas-by-category.md § Content`.

---

### 2026-05-26 iter 112 — HELD: 🗣 Eyes-Free Audio L1 (PROFILE Amendment C blocker)

**Status:** HELD — needs PROFILE Amendment C (Commute Audio Mode) ratification + Page Visibility instrumentation pilot.

**Value claim:** Walking/driving/gym/dishes phone time is currently unaddressed — all surfaces require visual attention. AirPods-in eyes-out moments could unlock significant additional drill time for the rusty engineer.
**Mechanic:** New 🎧 Audio sidebar mode reads L1 question + 4 options via Web Speech API TTS; accepts a single big-tap answer (or Bluetooth media-button click); advances on success/failure with a 2-sec audio cue and spoken explain; runs interleaved L1s from due+weak lessons.
**Why held:** PROFILE.md draft Amendment C (Commute Audio Mode) is unratified — the assumption that "transit phone time is actually eyes-free" hasn't been validated. Subagent correctly flagged the "screen-on-in-pocket" risk: many transit/walking phone moments are actually screen-on-but-not-actively-attending, which is a different design target than truly eyes-free.
**Re-promote condition:** (a) a frame iter ratifies PROFILE Amendment C with concrete evidence (user-report, micro-poll, or self-instrumentation), AND (b) a Page Visibility instrumentation pilot (~30 LOC, ship-able independently) confirms a non-trivial population of "visibilitystate: hidden + still-active" sessions.

---

### 2026-05-26 iter 112 — HELD: 📤 Resume Snippet Export (gamification risk)

**Status:** HELD — needs concrete anti-gamification mitigation pre-decided.

**Value claim:** A rusty engineer prepping for interviews needs to articulate "I drilled 73 patterns including DP, graphs, two-pointers" in cover letters / recruiter calls / Blind posts. Today the only export is a JSON backup or a markdown cheatsheet — neither is a shareable artifact.
**Mechanic:** New 📤 Share modal generates a recruiter-ready paragraph + a public read-only progress URL (sync-backed) showing mastered sections / mock-best / drill-time totals — copy-button mobile-first; the URL renders a sanitized static page with no PII.
**Why held:** PROFILE.md L75 anti-gamification ("Gamification that obscures actual progress against interview readiness") — both the subagent and orchestrator flagged this. Share artifacts drift toward streak-bragging unless explicitly designed against that pattern.
**Re-promote condition:** a concrete pre-decided mitigation list — e.g., (a) share URL shows mastered-LESSON-list not streak/mock counts; (b) recruiter-paragraph emphasizes specific patterns drilled (e.g., "binary search variants, sliding window, BFS/DFS templates") not days-in-a-row; (c) no leaderboard / no public comparison; (d) URL is opt-in per-export, not always-live. Matches the iter-103 Heatstrip pre-decided-mitigation gate.

---

## Meta-finding (iter 103 vision — tenth vision iter; iter-100 queue fully drained, Cat 5/7 push)

**Tenth vision iter (after 26/31/48/55/59/64/82/90/95/100).** Iter-100 queue (Hint-Cost iter 101 + Notes Locate iter 102) fully shipped in 2 iters. Iter 103 fires vision per SKILL.md Step 1B with explicit Cat 5 UI/UX + Cat 7 Metacognition steering per iter-100's "the recombine-existing-corpus gradient is mining out" meta-finding.

**Single constraint-aware subagent** (cost-conservative precedent). Per the iter-95 "name 1 implementation risk per proposal" instruction, subagent self-flagged 4/5 risks pre-orchestrator review. **Orchestrator cross-check rejected 1 additional:**
- 🧮 **Concept-Tag Drill-Through** (subagent rank #3) — orchestrator-rejected on **schema blocker**: subagent assumed `state.misses[]` captures per-question `questionIdx`, but per iter-58 schema it's per-lesson grain only (`{lessonId: [{at, level, tag}]}`). **SAME BLOCKER as iter-95 Calibrated L1** — both require extending `state.misses` to capture questionIdx. HELD with explicit re-promote condition.

**Promoted top 3 (subagent's 1+2 + orchestrator-elevated 3):**
1. 🗺 **Sidebar Command Palette (Cmd-K)** — closes the **33-button sidebar discoverability decay** that the recent ship-spree caused. UI/UX gradient. First surface that REORGANIZES across existing buttons (orthogonal-not-additive). ~120 LOC. New lightweight `state.commandUsage` counter additive to existing handlers.
2. 📈 **Mastery Half-Life** — per-lesson longitudinal SR signal. Cluster lessons by avg interval-before-regression (Sticky / Normal / Slippery). Closes a PROFILE.md L67 success criterion (mastered lessons stay mastered) that's currently unmeasured at lesson grain. Derivation from `state.history` L3-pass timestamps; ~140 LOC.
3. ⏱ **Session Heatstrip** — 4px strip at sidebar top showing last 30 min of activity per-minute (color = event grain). Subagent self-held over "needs evidence of mobile-session-length problem"; orchestrator-promoted with mitigation pre-decided (informational-density framing, not progress-thermometer — explicit anti-gamification per PROFILE L75). Rendering pass over state.history tail; ~110 LOC.

**Held with explicit re-promote conditions:**
- 🔖 **Pin-Top Recent Lessons** (subagent held) — conditional on 🗺 Command Palette shipping first; if palette's recency-rank solves the "re-find recent lesson" job, Recent Lessons is redundant. Re-promote condition: post-palette feedback shows recent-lesson re-find still ranks as a top friction.
- 🧮 **Concept-Tag Drill-Through** (orchestrator-held on schema) — same blocker as iter-95 Calibrated L1. Re-promote condition: a frame iter ratifies schema extension to add `questionIdx` to `state.misses[]` entries. Both Calibrated L1 and this entry would unblock together.

**Meta-learning (iter 103):** subagent self-flagging caught 4/5 risks; orchestrator caught 1 additional (the schema blocker subagent missed). Combined yield: 1 of 5 ORCHESTRATOR-rejected, 1 of 5 PROMOTED over subagent's hold, 3/5 promoted clean (subagent #1, #2 + orchestrator-elevated #3). **The Cat 5/7 push worked** — every proposal landed in those categories per the explicit prompt steering. Validates iter-100's meta-finding that the recall-direction gradient was mining out; UI/UX + Metacognition gradients have fresh space. **Also surfaced:** the schema-extension dependency (Calibrated L1 + Concept-Tag Drill both blocked on the same schema field) is now a 2-entry pattern — worth a small frame iter to ratify the schema bump when a 3rd entry blocks on it.

§ Next nominates 🗺 Sidebar Command Palette ship for iter 104+ (post-`/clear` STRONGLY recommended — 8 ships past empirical cap this session).

---

### 2026-05-25 iter 103 — 🗺 Sidebar Command Palette (Cmd-K)

**Status:** SHIPPED iter 104. Top-right 🔍 trigger (visible all viewports) + **Cmd-K / Ctrl-K** keyboard shortcut (modifier-required so bare `k` lesson-nav preserved). Overlay: centered card on semi-opaque scrim with search input + kind-tagged result list + footer (↑/↓/Enter/Esc hints). Results union 3 kinds: **mode** (33 sidebar buttons via synthetic .click() to existing handlers), **lesson** (152 full lessons via selectLesson), **section** (28 sections, jumps to first lesson in section). Fuzzy matcher: substring + use-count blend; matches BOTH label AND id (so `two-sum` style searches work); normalizes `[\s\-_.·:]+` → space for hyphen-agnostic search. **Empty-query default interleaves kinds** (12 modes + 8 lessons + 4 sections, sorted by recent-use) so the user sees a representative mix not 24 mode-rows; on type, score-based ranking applies. Schema-additive `state.commandUsage = { [id]: count }` increments on every select. ~205 LOC JS + ~75 CSS. Mobile probe 5/5 PASS after orchestrator-fix-on-first-run (initial run caught (a) kind-monoculture in empty-query default, (b) hyphen-vs-space search mismatch; both fixed in-iter; re-run all PASS). **First REORGANIZE-not-ADD ship in the loop's history** — every prior surface added more buttons; this provides a meta-navigation layer over them. Closes a self-caused decay: the recent ship-spree multiplied sidebar buttons 4-5x.

**Value claim:** PROFILE.md L26-28 ("20 free minutes, drilling friction near zero") + L42 (sustained typing deprioritized vs tap-and-recall). The 33-button sidebar that the recent ship-spree produced has linearly degraded discoverability — the rusty engineer can't recall which mode they wanted without scrolling/scanning. Mean keystrokes-to-mode-launch has crept up; this is the first iter the loop has noticed it.
**Mechanic:** Press `k` keyboard shortcut (or tap a new top-bar 🔍 icon for mobile) → overlay listing all 33 modes + 152 lesson titles + 28 sections. Fuzzy match on input; results ranked by recent-use frequency from a new `state.commandUsage` counter incremented in each existing sidebar handler (one-line hook each). Type 2-3 letters → enter to launch. Esc closes.
**Success criterion:** Mean keystrokes from "want to start Recognize" drops from 4+ scrolls to ≤3 keystrokes; >40% of mode launches go through the palette within 1 week of live.
**Estimated scope:** single-iter ship (~120 LOC JS + ~30 CSS). Schema-additive `state.commandUsage = { [id]: count }`. Mobile-friendly via top-bar 🔍 affordance.
**Data dependency:** none — manifest + sidebar handlers already exist; `state.commandUsage` is one-line additive.
**PROFILE.md amendment proposed?** No.
**Implementation risk (subagent-flagged):** mobile keyboard summoning conflicts with the existing `/` search and `?` help shortcuts — keybinding collision needs careful conditional (allow `k` only when no input has focus; mobile users tap the icon instead).
**Why this is a "new bucket" not "better cell":** every shipped sidebar item ADDED a button. This is the first surface that REORGANIZES across them — orthogonal to "yet another button." Closes a meta-decay the loop's own shipping pattern caused.
**Subagent source:** iter-103 vision iter — top by leverage-per-effort (highest impact-per-LOC; addresses the most visible UX drift this month).

---

### 2026-05-25 iter 103 — 📈 Mastery Half-Life

**Status:** SHIPPED iter 106. New Stats-modal tile clustering each lesson with ≥2 L3-passes into Sticky (median gap >14d) / Normal (3-14d) / Slippery (<3d) by `state.history` median-pass-gap. Tap-routed top-5 slippery list deep-links to lesson Reference tab. Auto-hides on empty state (no lesson with ≥2 L3-passes). Helper `_masteryHalfLife(slipperyTopN=5)` walks events per lesson, sorts pass times, computes median gap from gap array, buckets each lesson, and returns `{ sticky, normal, slippery, slipperyList[{lessonId, medianGapMs, passCount}] }`. CSS adds `.half-life-buckets` 3-col grid + `.half-life-row` with min 36px tap height per PROFILE 80%-phone. Zero new state field. ~80 LOC JS + ~35 CSS. Probe `tools/cdp/mastery-half-life.js` 5/5 PASS. Validator 687/0. Closes the PROFILE.md L67 "Mastered lessons stay mastered" success-criterion measurement gap at *lesson grain* — the first surface naming WHICH lessons slip vs which stick (Decay Radar = right-now risk; Resurrect = overdue; Half-Life = personality across cycles — three time horizons, three drilling decisions).

**Value claim:** PROFILE.md L67 ("Mastered lessons stay mastered across SR intervals") is currently unmeasured at lesson grain. User has no surface telling them WHICH lessons slip vs which stick — only that some come back due. Closes a stated success criterion measurement gap.
**Mechanic:** New Stats tile "Sticky vs Slippery." For each lesson with ≥2 L3-pass events in `state.history`, compute median gap between consecutive passes (= cycle interval before re-drilling). Cluster into 3 buckets: Sticky (gap >14d), Normal (3-14d), Slippery (<3d). Tile shows aggregate counts + tap-routed top-5 slippery lessons list.
**Success criterion:** ≥30% of users who open the tile route to a slippery lesson within 2 weeks; longitudinal slippery-list median half-life trends UP month-over-month.
**Estimated scope:** single-iter ship (~140 LOC JS + ~25 CSS). Pure derivation over `state.history` — zero new state field. Reuses Stats-tile pattern from iter-84/85/101.
**Data dependency:** `state.history[lessonId]` L3-pass events with timestamps (iter-32 schema). Lessons with <2 L3-pass events get skipped from the bucket — graceful empty-state for new users ("drill more L3 passes to unlock this view").
**PROFILE.md amendment proposed?** No.
**Implementation risk (subagent-flagged):** users with <2 cycles get empty tile — needs graceful "drill more to unlock" copy that doesn't feel gamified or paywalled.
**Why this is a "new bucket" not "better cell":** Decay Radar shows "at risk RIGHT NOW." Resurrect Queue shows "overdue." Half-Life shows the lesson's PERSONALITY across cycles — a longitudinal time-scale signal neither captures. Different time horizon = different cognitive operation.
**Subagent source:** iter-103 vision iter — second by leverage-per-effort (directly serves a PROFILE.md success criterion; pure derivation = no risk; mobile-friendly Stats-tile pattern).

---

### 2026-05-25 iter 103 — ⏱ Session Heatstrip (sidebar header)

**Status:** SHIPPED iter 107. **iter-103 queue fully drained (3 of 3 SHIPPED).** Thin 4px strip at sidebar top renders `state.history` events as a 30-cell minute-grain timeline (oldest left → now right). Desaturated palette per L75 anti-gamification mitigation (deep slate idle / muted reds for L1-miss / muted greens for L1-pass / muted ambers for L2-pass / muted blues for L3-pass). Dominant-event priority within a cell: L3-pass > L2-pass > L1-pass > L1-miss — richer signal wins so a minute with both an L1-pass and an L3-pass renders blue. Tap (wrap-padded for mobile hit-area) opens a facts-only "This session" modal showing minutes-active, lessons-touched, passes-recorded, optional miss-count. Session boundary defined as the most recent contiguous block of events with no >10-minute idle gap — strip refreshes via `appendHistory()` hook on every state-changing user action plus a 60-sec interval tick so the strip ages out without user action. Auto-hides when no events from last 30 min exist. New helpers `_heatstripCells(lookbackMinutes=30)` + `_heatstripSessionSummary()`. ~120 LOC JS + ~30 CSS. Probe `tools/cdp/session-heatstrip.js` 5/5 PASS at iPhone viewport including priority-wins-within-cell verification, 10-min-gap session isolation, and modal facts. Validator 687/0. **First "always-on" sidebar surface** — every other modal/tile in this loop is opt-in via a sidebar button or Stats tile; the Heatstrip is the first surface that's *present* whenever the user is drilling, providing inline metacognitive visibility into THIS session's depth without requiring a deliberate "open the Stats modal" action.

**Value claim:** PROFILE.md L69 (20-min mobile bursts) — the rusty engineer has no inline visibility into THIS session's depth, only post-hoc Stats. Builds metacognitive ownership of momentum: "I've been drilling 12 min, 7 lessons touched, 3 passes — keep going one more minute?"
**Mechanic:** Thin (4px) strip across the very top of the sidebar showing the current session as a horizontal timeline of last 30 min. Each minute is a cell colored by activity grain (green=L1 pass, amber=L2 pass, blue=L3 pass, red=miss, gray=idle). Tap → modal with "this session: X min active, Y lessons touched, Z passes." Resets on >10-min idle gap (new session).
**Success criterion:** Bounce-rate (session length <2 min) drops 15% measurably via session-length distribution shift in `state.history` event-timestamps.
**Estimated scope:** single-iter ship (~110 LOC JS + ~25 CSS). Rendering pass over `state.history` tail — no new capture.
**Data dependency:** `state.history` events already exist with timestamps (iter-32 schema). 30-min lookback is computed at render time.
**PROFILE.md amendment proposed?** No.
**Implementation risk (orchestrator-validated, subagent-flagged):** could read as gamification (PROFILE.md L75 anti-pattern) if colored like an XP bar. **Mitigation pre-decided:** stay informational-density (event-grain colors, not progress thermometer); use desaturated palette; copy framing is "what just happened" not "how close to goal." Tap modal shows facts, not scores.
**Why this is a "new bucket" not "better cell":** Streak Map is 60-DAY scale. Mock Replay Reel is per-lesson. Heatstrip is THIS-SESSION minute-grain — answers "should I keep going?" right now. Time-scale none of the shipped Metacognition surfaces cover.
**Subagent source:** iter-103 vision iter — subagent self-held over evidence-of-problem concern; orchestrator-elevated with the gamification mitigation pre-decided.

---

### 2026-05-25 iter 103 — HELD: 🔖 Pin-Top Recent Lessons (Command-Palette-dependency)

**Status:** HELD — conditional on 🗺 Sidebar Command Palette (iter-103 #1) shipping first.

**Value claim:** Sidebar has 152 lessons across 28 collapsed sections. Re-finding the lesson drilled 5 min ago is ~3 expand-clicks on mobile.
**Mechanic:** A "Recent" pseudo-section pinned ABOVE all real sections, showing last 5 distinct lessons accessed via extended `state.recentLessonIds: string[5]` ring buffer.
**Why held:** if Command Palette ships with recent-use ranking, the "re-find recent lesson" job is mostly solved (palette top-ranks recent lessons). Re-promote condition: post-palette feedback shows recent-lesson re-find still ranks as a top friction (e.g., users still scroll the sidebar to re-find a 5-min-ago lesson after the palette has been live for 2+ weeks).

---

### 2026-05-25 iter 103 — HELD: 🧮 Concept-Tag Drill-Through (schema blocker — SAME as iter-95 Calibrated L1)

**Status:** HELD — needs schema extension; same blocker as iter-95 Calibrated L1.

**Value claim:** Closes the Mistake Tagging "capture-but-no-action" loop — re-drill ONLY the L1 questions previously mistagged with a chosen label.
**Mechanic:** Stats "Top miss patterns" tile tag rows become tappable → opens 10-question session pulling only the specific `L1.questions[i]` items the user mistagged with that label.
**Why blocked:** subagent assumed `state.misses[]` captures per-question `questionIdx`, but per iter-58 schema it's per-lesson grain only (`{lessonId: [{at, level, tag}]}`). **Same blocker as iter-95 Calibrated L1.** Both proposals require extending `state.misses[]` entries to include `questionIdx` (and possibly `wrongOption` for fully-replaying the mistake).
**Re-promote condition:** a frame iter ratifies schema extension `state.misses[lessonId][i] = { at, level, tag, questionIdx, wrongOption? }`. Both Calibrated L1 AND Concept-Tag Drill-Through would unblock together. **Worth a small frame iter when a 3rd proposal also blocks on this schema field** — pattern is now load-bearing.

---

## Meta-finding (iter 100 vision — ninth vision iter; iter-95 queue fully drained)

**Ninth vision iter (after 26/31/48/55/59/64/82/90/95).** Iter-95 queue (Notes Cloze iter 97 + Mechanic Constellation iter 98 + Reverse-Walkthrough iter 99) fully shipped in 3 iters — matching the iter-90 queue's drain speed (Conv Drill → Trace-Hop → Mechanic-Bridge). Iter 100 fires vision per SKILL.md Step 1B ("shipping is genuinely blocked when Step 1A surfaces nothing").

**Single constraint-aware subagent** (iter-82/iter-90/iter-95 cost-conservative precedent). Subagent returned 5 proposals, each naming a previously-untapped data dimension or recall direction. **Subagent self-flagged 2 with implementation risks** (iter-95 meta-learning applied — the explicit "name 1 risk per proposal" instruction in the prompt caught both pre-orchestrator-validation).

**Orchestrator feasibility cross-check rejected 1 more:**
- 🔗 **Mechanic Chain** (subagent rank #3 promoted) — FAILS feasibility: scan found only 2/99 Patterns/Applied lessons have ≥3 mechanics tagged (65 have 1, 21 have 2). Multi-select set-recall is degenerate at this corpus density. **HOLD with re-promote condition: per-lesson mechanics-tag expansion (audit-iter target — bring average from current ~1.3 mechanics/lesson to ≥3).**

**Promoted top 2** (down from 3 because of #5's feasibility miss):
1. 🎯 **Hint-Cost Ladder Stats** (subagent rank #1) — closes the iter-37 deferred "hints-used-per-attempt instrumentation" follow-up. Data substrate ALREADY EXISTS (`state.history` captures `hint-tier-*` + `critical-lines-used` events per iter-32 schema). Per-lesson trend pill is already shipped; missing piece is a global Stats-modal "Self-rescue rate" tile + per-attempt L3 ribbon. **Cleanest single-iter ship — lowest implementation risk.**
2. 📐 **Notes→Lesson Reverse Lookup** (subagent rank #2) — given a `reference.notes[]` string, pick which lesson it's from (4 MC distractors weighted by section adjacency). Clean reverse direction over the notes corpus — Gotcha tests subjective recognition ("knew it / didn't"); Notes Cloze tests intra-note keyword recall; Notes→Lesson tests **objective cross-corpus localization** ("which lesson does this gotcha belong to?"). Distinct cognitive operation.

**Held with explicit re-promote conditions:**
- 🪞 **Distractor Cross-Tap** (subagent rank #2 by their own ranking) — HOLD until a build-time index confirms ≥40 cross-lesson distractor collisions in the L1 corpus. Re-promote: 30-line probe script reports collision count ≥40.
- 🧪 **Edge-Case Authorship** (subagent rank #4) — HOLD until a fuzzy-match prototype shows ≥70% true-positive rate on 20 seeded responses; PROFILE amendment B-adjacent (user-as-edge-case-author framing).
- 🔗 **Mechanic Chain** (subagent rank #3, orchestrator-held) — HOLD until per-lesson mechanics-tag expansion brings ≥40 lessons to ≥3 mechanics. Re-promote: feasibility re-scan shows ≥40% of Patterns/Applied lessons with ≥3 mechanics.

**Meta-learning (iter 100):** the iter-95 instruction "subagent names 1 implementation risk per proposal" worked — subagent flagged 2/5 risks (Cross-Tap collision count + Edge-Case fuzzy match). Orchestrator caught 1 additional (Mechanic Chain feasibility) via empirical scan. **Combined yield: 3/5 ideas blocked at vision-iter time, 2/5 promoted clean — much better than iter-95's 3/5 promoted (with 2 of those orchestrator-caught later).** Worth keeping the explicit-risk instruction in future vision-iter prompts. Also: the easy "recombine existing corpus" gradient is genuinely mining out — Cat 1/3/9 surfaces have multiplied 4-5x this month; the next iter's vision iter may need to push into Cat 5 UI/UX or Cat 7 Metacognition territory instead.

§ Next nominates 🎯 Hint-Cost Ladder Stats ship for iter 101+ (post-`/clear` strongly recommended given 6-ship session length).

---

### 2026-05-25 iter 100 — Hint-Cost Ladder Stats

**Status:** SHIPPED iter 101. Stats-modal "🎯 Self-rescue rate" tile aggregates zero-hint L3 passes / total L3 passes across ALL lessons via new `_selfRescueRateGlobal()` helper walking `state.history`. Tile color-toned (≥70% green / ≥40% amber / else orange); auto-hides when no L3-pass history; "since you started L3 drilling" subtext frames partial-data caveat. L3 trend chip extended with **per-attempt cost ribbon** showing recent 5 attempts as chips (0 hints = green ✓ / 1-2 = amber number / 3+ = orange "3+"). New helper `_perAttemptHintCounts(lessonId, lookback)` returns per-attempt buckets via the same event-walking pattern as existing `_countHintAttempts`. **Pure read-only over already-captured state — no new state field, no `__v` bump, no probe-time data seeding required for the substrate itself; data was captured since iter 32 schema bump.** ~95 LOC JS + ~30 CSS. Mobile probe `tools/cdp/hint-cost.js` 5/5 PASS. desirable-difficulty.md updated. **Closes iter-37 deferred metric** (45 iters in parking lot). First surface measuring quality-of-pass (not pass/fail) — previous metacognition surfaces measured outcome OR membership.

**Value claim:** PROFILE.md §What they need ("mock interview personal-bests trend down… friction near zero") + §State they're in (the rusty engineer can pass L3 but doesn't track *whether* they leaned on hints; without this measurement, "I passed" and "I crawled through with 3 hints" look identical in the dot color). Quality-of-pass is a real signal currently invisible to the user.
**Mechanic:** Stats modal gets a new "Self-rescue rate" tile aggregating passes-with-zero-hints / total-passes across all lessons (uses existing `state.history` `hint-tier-*` + `critical-lines-used` event filter). L3 trend chip extends to a per-attempt cost ribbon: 0 hints used = green ✓, 1-2 hints = amber chip, 3+ hints = red chip. Both surfaces consume the already-captured event stream (iter-32 schema).
**Success criterion:** Among users with ≥5 L3 passes, "Self-rescue rate" tile renders a non-zero percentage; after 1 week, user can name ≥3 lessons they passed-with-hints (the ribbon makes this visible per-attempt where it wasn't before).
**Estimated scope:** single-iter ship (~120 LOC JS + ~25 CSS). Most logic is read-only over existing `state.history` — no schema migration, no `__v` bump. Stats-tile pattern mirrors iter-84/85 Recognize/Gotcha/Claim/Crystal/Bug-Hunt tiles.
**Data dependency:** existing `state.history[lessonId]` event log (iter-32 schema, `__v: 6` since iter 32 onward). Hint-tier events are already captured per the iter-37 ship.
**PROFILE.md amendment proposed?** No.
**Implementation risk (subagent + orchestrator-flagged):** pre-feature passes have no signal — the first 1-2 weeks of stats are partially-noisy because users may have passed lessons cleanly long before hint-tier-events were captured. Mitigation: render the tile with "since you started tracking" sub-text + only count L3 passes that have a coincident timestamp in `state.reviews` (proxy for "post-instrumentation pass").
**Why this is a "new bucket" not "better cell":** every shipped surface (Reveal Replay, At Risk, Resurrect, Streak Map) measures *outcome* (passed/missed/overdue/active). None measures *process cost*. Hint-Cost is a new grain — quality-of-pass, not pass/fail. Closes the iter-37 deferred metric AND adds a measurement-gap-closing tile to the Stats modal.
**Subagent source:** iter-100 vision iter — top by leverage-per-effort (lowest LOC, lowest risk, closes a deferred follow-up, data substrate already exists).

---

### 2026-05-25 iter 100 — Notes→Lesson Reverse Lookup

**Status:** SHIPPED iter 102. 🗂 Locate sidebar pill (stone-300 hover — neutral paper/folder semantic) → 10-card mobile session. Each card shows ONE `reference.notes[i]` string (≥30 chars uniqueness proxy per iter-100 mitigation) + 4 lesson-title MC buttons with section sublabel (1 correct + 3 distractors via same-section-preferred pattern from iter-97 Notes Cloze). Tap reveals correct lesson title (bold) + section + drill CTA + Next. Misses route to `state.weakness`. New helpers: `_notesLocateBuildCard` (same-section distractor pattern), `_notesLocateBuildDeck` (80-lesson preload, eligible-note flatten ≥30 chars, Fisher-Yates, slice 10), `startNotesLocateSession`. Schema-additive `state.notesLocate`. ~210 LOC JS + ~75 CSS. Mobile probe 5/5 PASS. **Third recall direction over `reference.notes[]`** completes the corpus triple-mining: Gotcha (iter 83) = whole-note yes/no; Notes Cloze (iter 97) = intra-note keyword cloze; Notes Locate (iter 102) = note → which lesson localization. iter-100 vision queue FULLY DRAINED with this ship.

**Value claim:** PROFILE.md §State they're in ("forget exact method names, argument order, the small ceremonies") + interview-format reality: "I remember a gotcha about negative-zero, where was that?" is the actual interview-mid-problem retrieval pattern. Currently unsupported — Gotcha tests subjective "knew it / didn't"; Notes Cloze tests intra-note keyword recall; nothing tests **objective lesson identification from a note**.
**Mechanic:** New sidebar surface (📐 Trace or different emoji — 📐 taken by Claim; try 🗂 Locate or 🔖). Pick a random `reference.notes[]` string from any lesson, show it as the card prompt, render 4 lesson-title MC buttons (1 correct + 3 distractors weighted by section adjacency). 10 cards per session. Tap to reveal lesson + drill CTA. Misses route to `state.weakness`. Pre-filter pool by note-uniqueness score to avoid generic notes that "could match anything."
**Success criterion:** Every passed card opens a fast-jump to that lesson's Reference tab; after 3 sessions user reports they remember at least 2 gotchas they'd forgotten were attached to specific lessons (the cross-corpus localization is the unique contribution).
**Estimated scope:** single-iter ship (~110 LOC JS + ~20 CSS). Reuses Gotcha card stack + Recognize shell base.
**Data dependency:** `reference.notes[]` exists on 143/143 full lessons. Schema-additive `state.notesLocate = {attempts, correct, sessions, lastRunAt}`. No `__v` bump.
**PROFILE.md amendment proposed?** No.
**Implementation risk (subagent-flagged):** generic notes ("watch for off-by-one", "remember to handle null") could plausibly match multiple lessons — multi-correct cards would be ambiguous. **Mitigation:** precompute a uniqueness score per note (e.g., token-overlap distance from other notes); filter to top-quartile-unique notes. If the unique pool is <30 notes, fall back to including all notes but explicitly mark "this note could fit multiple lessons" in the reveal.
**Why this is a "new bucket" not "better cell":** Gotcha = recognition (whole-note yes/no); Notes Cloze = intra-note keyword cloze with MC distractors; Notes→Lesson Lookup = **cross-corpus localization** (note → which lesson). Three distinct cognitive operations over the same `reference.notes[]` field. The corpus is now triple-mined for recall directions.
**Subagent source:** iter-100 vision iter — second by leverage-per-effort (clean reverse direction, no schema risk, fully feasible).

---

### 2026-05-25 iter 100 — HELD: 🪞 Distractor Cross-Tap (needs build-time collision count ≥40)

**Status:** HELD — needs a pre-ship collision-count probe.

**Value claim:** Drills the near-miss discrimination skill — given the right answer to an L1, pick the distractor that's "dangerously close" (= another lesson's correct answer, or a real-world common confusion). Tests the rusty engineer's actual failure mode: confusing two near-equivalent calls.
**Mechanic:** Sidebar 🪞 button → 8-card session. Each card shows an L1 question + its CORRECT answer marked + asks "which of these distractors is most dangerously close to ALSO being right?". Tap reveals cross-lesson collision context (or curated "common confusion" annotation if collision detected at build time).
**Data dimension:** `L1.questions[].options[]` × cross-lesson — currently each lesson's options exist only inside its own MC; no surface joins them across lessons. Cross-lesson collisions are latent in the corpus.
**Why held:** ship gates on build-time index confirming ≥40 cross-lesson distractor collisions. If <40, the surface degenerates into "show me a regular L1 again" with no novel signal. **Re-promote condition:** 30-line probe script reports collision count ≥40 (fuzzy-match `options[].toLowerCase().trim()` across all lessons → identify pairs where lesson-A's distractor equals lesson-B's correct answer).

---

### 2026-05-25 iter 100 — HELD: 🧪 Edge-Case Authorship (needs fuzzy-matcher pilot)

**Status:** HELD — needs fuzzy-match pilot + PROFILE-amendment-adjacent framing.

**Value claim:** Tests whether the user can GENERATE edge-case inputs unprompted (vs the existing 🛡 edge-case chips which display the answer). Pre-submit L3 micro-step asks "type one edge case that would break a naive solution" before Run.
**Why held:** free-text matching is fuzzy — "empty" vs "empty array" vs "[]" all mean the same thing but match heuristics struggle. **Re-promote condition:** prototype fuzzy-matcher on 20 seeded responses shows ≥70% true-positive + ≤15% false-positive. Also PROFILE amendment B-adjacent (user-as-edge-case-author framing) — strict PROFILE compliance not blocking but would benefit from frame iter to ratify.

---

### 2026-05-25 iter 100 — HELD: 🔗 Mechanic Chain (data sparsity)

**Status:** HELD — corpus too sparse for multi-select set-recall.

**Value claim:** Given a canonical, multi-select which mechanics it uses (lesson → mechanic SET direction, complementing iter-98 🪐 Constellation's mechanic → lesson SET direction).
**Why held:** empirical feasibility scan (orchestrator iter-100) found only 2/99 Patterns/Applied lessons have ≥3 mechanics tagged (65 have 1, 21 have 2). Multi-select set-recall is degenerate when sets are 1-2 elements. The unique cognitive claim ("set recall, not single pick") evaporates at this corpus density. **Re-promote condition:** per-lesson mechanics-tag expansion (audit-iter target) brings ≥40 lessons to ≥3 mechanics. Reasonable scope: ~30-50 lessons × 1-2 additional tags = manageable content iter.

---

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

**Status:** SHIPPED iter 98. 🪐 Constellation sidebar pill (indigo-200 hover) → 10-card mobile session. Each card shows ONE mechanic name + blurb + 6 lesson titles (3 tagged with mechanic + 3 not, same-section preference for plausibility); user taps 3 they think are tagged. Per-tap immediate-feedback (mirrors iter-93/97): correct → green ✓; wrong → red ✗ + state.weakness[lessonId]++. After 3 picks, reveal phase marks unpicked tagged lessons with ⊙ + Next CTA. New helpers: `_constellationBuildCard` (filters to mechanics with ≥3 full-status tagged lessons), `_constellationBuildDeck` (lazy-loads MECHANIC_INDEX via iter-94 `ensureMechanicIndex()`), `startConstellationSession`. Schema-additive `state.mechConstellation = { attempts, correct, sessions, lastRunAt }` (per-tap increments — 10 cards × 3 picks = up to 30 attempts per session). ~290 LOC JS + ~70 CSS (over the original ~130 LOC estimate — multi-select state-tracking + ⊙ marker UI added complexity). Mobile probe 5/5 PASS — card with "Frequency map" mechanic showed correct distractor mix (3 tagged + 3 not), 3 taps committed with 2-correct/1-wrong/1-missed shape, Next reset counter to 0/3. **First surface drilling `mechanics[]` as a recall TARGET** — Bridge/Matrix/Mechanics-modal all USE mechanics as input (filter/route/group); Constellation tests "given a mechanic, which lessons use it" as the recall task itself.

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

**Status:** SHIPPED iter 99. ⏪ Reverse-Walk sidebar pill (orange-200 hover — distinct from Warmup orange-300) → 8-card mobile session. Each card shows the FINAL `{state, returns}` of one walkthrough example + 3 input options (all 3 examples from the SAME lesson, shuffled); user taps which input produced this final state. **Spec adapted from iter-95 vision:** empirical feasibility scan (iter-99) found ALL 99 Patterns/Applied lessons have EXACTLY 3 walkthrough examples (not "many <4" as the iter-95 entry assumed). Adapted to 3-option MC from same-lesson examples — cleaner pure-cognitive-operation design with no cross-lesson shape-mismatch concerns. Baseline guess rate 33% but discriminating between same-algorithm examples requires actual trace-execution mental simulation. New helpers: `_reverseWalkBuildCard` (runs trace on all 3 examples, picks one as correct, builds shuffled 3-option array), `_reverseWalkBuildDeck`, `_reverseWalkRenderFinalState`, `startReverseWalkSession`. Schema-additive `state.reverseWalk = { attempts, correct, sessions, lastRunAt }`. ~230 LOC JS + 90 CSS (orange accent for "final-state" semantic). Mobile probe `tools/cdp/reverse-walk.js` 5/5 PASS. **Complements Walkthrough (forward stepper) and Trace-Hop (mid-state recall) — closes the third corner of the same-trace cognitive direction triangle.** iter-95 roadmap queue FULLY DRAINED.

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
