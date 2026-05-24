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

## Queued

### 2026-05-23 iter 26 — Pattern Recognition Speed Drill

**Status:** queued

**Value claim:** PROFILE.md names "pattern recall degraded" — knowing sliding-window *exists* but not reaching for it unprompted — yet the entire L1→L2→L3 ladder operates on `recall given a topic`, never on `recognition given a stimulus`, which is the operation a real interview opens with.
**Mechanic:** A new top-level mode "Recognize" flashes a problem prompt (drawn from existing 79 pattern lessons' `description` + `L3.prompt` text — already authored data) and asks the user to tap one of 4 pattern-name distractors within ~5 seconds; the distractor pool is the section taxonomy (Trees lessons' distractors are 3 other Trees patterns + 1 cross-section), so authoring overhead is near-zero. Tracks accuracy and time-to-tap per pattern; surfaces "your slowest patterns" as a Today's Plan slice.
**Success criterion:** Within 1 week of shipping, the median time-to-correct-pattern-tap for the user's full attempted pool drops below 3 seconds, and mock-interview start-to-first-keystroke latency (instrument new) drops measurably for patterns the user has Recognize-drilled ≥3 times vs. a baseline pattern they haven't.
**Estimated scope:** single-iter ship (all data exists; UI is one new tab + a timer + a 4-button row; no schema migration; no new content authoring; mobile-native because it's tap-only).
**PROFILE.md amendment proposed?** Yes — PROFILE.md currently bundles "pattern recall" as one degraded skill, but Recognize-mode treats pattern-selection (the diagnosis step) as a *distinct* skill from pattern-implementation (the typing step). Amendment drafted in PROFILE.md awaiting a frame iter.
**Why this is a "new bucket" not "better cell":** Every existing surface moves abstract→concrete (read canonical, then reproduce). This is the only one that moves concrete→abstract — which is the actual interview direction.
**Cross-subagent convergence:** Both vision-iter subagents (A's "Inverse Drill" as L0 tab, B's "Pattern Recognition Speed Drill" as new mode) independently surfaced this gap. B's standalone-mode framing is cleaner than A's per-lesson L0 tab because it leverages the cross-pattern distractor pool that only a standalone mode unlocks.

---

### 2026-05-23 iter 26 — Error Post-Mortem with Miss Classification

**Status:** queued

**Value claim:** The weak-spot tracker resurfaces L1 misses but never closes the metacognitive loop — the rusty engineer keeps re-missing the same conceptual trap (`splice` vs `slice`, off-by-one bounds, `==` coercion edge) across different lessons without ever *naming* the pattern in their own misses. Closes BS-08's outstanding "watchlist-tier visibility" question by giving the user a personalized concept-level model of their own mistakes.
**Mechanic:** After any L1 miss or failed L3 run, a lightweight post-mortem card appears with a 2-tap classifier ("forgot syntax / off-by-one / wrong method name / misread prompt / semantics confusion") + a "Pin to journal" affordance with an optional 1-line note ("ohhh — `splice` returns REMOVED items, not the new array"). Classifier tallies feed a new sidebar facet ("Your top miss type: off-by-one — 6 lessons drill this") and an opt-in personalized Today's Plan slice. Journal is a flat list, exportable as markdown.
**Success criterion:** Within 1 week of shipping, repeat-miss rate on the same L1 question across SR intervals drops by ≥25% for users who classify ≥10 misses, AND ≥40% of pinned journal entries get viewed at least once after being pinned (i.e., the journal is consulted, not just written).
**Estimated scope:** 2-iter scaffold+ship — iter 1: classifier UI + miss-event hook + localStorage schema bump (`__v: 6`, `misses: { lessonId: [{at, type, level, note?}] }`); iter 2: sidebar facet + Today's Plan integration + journal export. UI lives in existing render functions, no new tab needed.
**PROFILE.md amendment proposed?** Yes — PROFILE.md's "what they need from this app" lists 5 needs but doesn't include *metacognitive ownership of one's own gaps*; current strategy emphasis is on recall, not on naming and owning misconceptions. Amendment drafted in PROFILE.md awaiting a frame iter.
**Why this is a "new bucket" not "better cell":** The existing weak-spot tracker operates at the *lesson* unit (which lessons miss); this operates at the *concept-across-lessons* unit (which mistake-types recur). The app currently has zero concept-level model of the user.
**Cross-subagent convergence:** Both subagents independently surfaced this as a top-2 entry (A's "Mistake Post-Mortem & Concept-Attribution Journal" at #2, B's "Error Post-Mortem" at #2). A's larger concept-tagging-across-143-lessons version is a v2 candidate after the lighter classifier ships.

---

### 2026-05-23 iter 26 — Commute Audio Mode (eyes-free drilling)

**Status:** queued

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
