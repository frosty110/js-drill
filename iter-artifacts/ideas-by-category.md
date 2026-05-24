# Ideas by Category

> **Browsable, category-indexed view of product enhancement ideas for the JS drill app.**
> Companion to [`roadmap.md`](roadmap.md) — that file is chronological (by vision-iter date) and tracks in-flight status (queued/scaffolded/wired/shipped). This file is **by product category** and is for browsing "where could I ship next?" without re-reading every vision iter's output.
>
> **Two-view model:** an idea may appear here AND in roadmap.md. The roadmap is the operational queue (what's shipping, what's blocked). This file is the catalog (what exists in each product surface, what's a candidate, what's stale).

---

## Design rule: low-dependency active reviews

Each category declares a **Review trigger** — a one-line rule telling the loop when the category is overdue for attention. The rule references rows in [`SELF-IMPROVE.md § Last-touched index`](../SELF-IMPROVE.md), which agents already bump on every iter as part of Step 7 reflection. **This file does NOT carry its own timestamps** — that would create a coordinated-update dependency (every iter touching a category would need to remember to update two files, and forgetting one creates silent drift).

The convention:
- This file declares categories + rules + entries.
- `SELF-IMPROVE.md § Last-touched index` is the ground-truth for freshness.
- `roadmap.md` is the ground-truth for in-flight status.
- Anything derivable from those two should NOT be duplicated here.

**How `/drill-improve` consumes this:** Step 1 of the skill (when no obvious queued ship target exists) scans this file for categories whose Review trigger has fired. The triggered category becomes the ship-search scope. See SKILL.md Step 1.

---

## Categories

### 1. Drilling Surfaces
*The core L1 → L2 → L3 → Reference ladder + the per-lesson tab surfaces (Walkthrough, Conversation).*

**Review trigger:** If `SELF-IMPROVE.md § Last-touched index` rows `L1 / L2 / L3 render state cache`, `Drilling surfaces (L1/L2/L3)`, or any per-tab row have not been bumped in 10+ iters, this category is stale.

**Active ideas:**
- **Reference-Card Flash Mode (cloze-deletion on canonical)** — see [`roadmap.md` iter-31 entry #2](roadmap.md). Queued. Fills the "read+recall-no-input" cell in the modality matrix (between Reference-read and L2-type).
- **L1 Rapid-Fire Drill (cross-lesson MCQ stream)** — see [`roadmap.md` iter-31 entry #1](roadmap.md). Queued. Cross-lesson interleaving on the highest-throughput mobile surface.

**Parking-lot ideas** *(not yet promoted to roadmap.md; lighter weight)*:
- L1 "explain why each distractor is wrong" reveal — currently L1 explanations are tied to the correct answer only.
- L2 hint progression (show first letter, then partial token) instead of binary blank/answer.
- L3 starter scaffold toggle — show function signature + return type, not just blank editor.
- Conversation tab "branch" — let the user pick which of the 6 sections to read, not strict linear.
- **L3 hint ladder (interview-realistic)** — graduated tap-to-reveal: tier-1 names the data structure, tier-2 reveals loop skeleton, tier-3 reveals first canonical line; tracks hints-used per attempt as a metric trending down over SR intervals. Distinct from "starter scaffold" (one-time) — this is incremental, mirrors how interviewers gradually unblock.
- **Trace-bug mode** — Walkthrough toggle that subtly alters one trace step (off-by-one bound, wrong index update); user must pick the wrong step. Inverts existing trace generators from "watch correct" → "find the wrong one"; zero new content authoring.
- **Code-from-bullet-points** — Reference tab toggle hides `reference.code` and shows only `reference.notes` as bullets; user types canonical from notes in an editor. Fills the missing cell between L2 (template + blanks given) and L3 (only problem prompt given) — "see concept, recall code" direction.
- **Two-direction L2** — template with NO blanks; user must IDENTIFY (tap) which token is most load-bearing. Forces understand-before-type rather than guess-and-fill; reuses existing L2 templates with no new content.

**Cross-cutting concerns:**
- Audit theme #3 ("Why dummy head?" Q recurs 4× across LL) — see BS-08 in SELF-IMPROVE.md.
- L2 under-build (50 lessons violate ≥2 floor) — see BS-08.

---

### 2. Paths & Sessions
*The curated/timed entry points: Starter Path, Today's Plan, Mock Interview, Weak-Spot resurfacing.*

**Review trigger:** If `Mock interview`, `Mock interview probe`, `Sidebar (path-order sort)`, `Weak-spot visibility`, or `Welcome banner` rows have not been bumped in 12+ iters, this category is stale.

**Active ideas:**
- **Pattern Recognition Speed Drill** — see [`roadmap.md` iter-26 entry #1](roadmap.md). BLOCKED (depends on PROFILE Amendment A + BS-15 `problem` field). Concrete→abstract pattern-naming drill — the only surface that runs in interview-direction.
- **Commute Audio Mode** — see [`roadmap.md` iter-26 entry #3](roadmap.md). BLOCKED (Amendment C + Page Visibility instrumentation).

**Parking-lot ideas:**
- Mock interview "topic-aware" mode — pull from a single section instead of full random pool.
- Today's Plan size-tunable (15-min vs 30-min vs 60-min slices).
- Starter Path branching — separate Syntax / Patterns / Applied path heads instead of one linear sequence.
- Mock-interview replay — view your code from a past mock side-by-side with the canonical.
- "Resume yesterday's session" — surface partial-completion across days.
- Insert the 6 iter-20 Algorithms lessons + iter-22 `s-index-math` into Starter Path (currently noted as iter-20 follow-up in `SELF-IMPROVE.md § Current focus`).
- **Cold open daily** — first app load of the day surfaces a random L3 problem with a timer, no warmup; trains "interview opens cold" reality. Could later integrate with PWA Push.
- **Two-pass speed drill** — same lesson, three timed rounds (5 min → 3 min → 2 min); track time-to-correct degradation. Specifically trains performance under decreasing pressure — the interview-prep shape.
- **Pattern-fusion mock** — small hand-curated table of "pattern A + pattern B" pairs (e.g., sliding-window + monotonic-deque; hash + binary-search) maps to existing lessons; a fusion mock requires both. Real interviews chain 2 patterns; no surface drills the chain.
- **Daily 1-pattern-deep ritual** — opt-in: for today's chosen pattern, complete ALL surfaces (Reference → L1 → L2 → L3 → Conversation → Walkthrough) before any other lesson unlocks. Depth-first day vs. interleaved breadth; for transit blocks ≥20 min.

**Cross-cutting concerns:**
- Weak-spot tracker operates only at lesson grain (not concept grain) — see [`roadmap.md` iter-26 entry #2 (Error Post-Mortem)](roadmap.md).

---

### 3. Mechanics (under-the-hood reinforcement)
*Spaced repetition, reveal-tracking dot variants, personal-bests, mechanics-modal, pass-condition logic.*

**Review trigger:** If `Spaced repetition`, `L3 surface / CTA injection`, `Mechanics modal`, or `Validator (density warning)` rows have not been bumped in 12+ iters, this category is stale.

**Active ideas:**
- **Error Post-Mortem with Miss Classification** — see [`roadmap.md` iter-26 entry #2](roadmap.md). BLOCKED (Amendment B).
- **BS-11 "I passed but nothing saved" UX gap** — see SELF-IMPROVE.md BS-11. Strict pass conditions are correct but invisible; candidates: persistent per-session score chip, post-attempt summary, loosen-strict toggle.

**Parking-lot ideas:**
- SR-bucket "snooze" — let the user push a due lesson 1 day forward without demoting.
- SR-interval expansion past 30d (60d, 90d) for over-mastered lessons.
- Demote-on-second-miss within a session (currently demote-on-reveal only).
- Personal-best per-level (separate L1 best, L2 best, L3 best — not just overall mock).
- "Spend points on a hint" — earn from clean passes, spend on reveal-without-demote.
- **Cognitive-load self-rating → SR calibration** — after L3 pass, single-tap 3-point ("trivial / earned / struggled") multiplies the next SR interval (easy stretches, hard contracts). Ebbinghaus-style desirable-difficulty calibration without a complicated model — one multiplier on the existing 1d → 30d ladder.
- **Time-to-solve prediction calibration** — pre-attempt, user predicts "N minutes"; app tracks predicted-vs-actual delta. Trains the rusty engineer's "how long will this take me" estimate — a load-bearing interview skill (blow the estimate → panic mid-coding).
- **Anki-style rating on L1 miss** — instead of demoting straight to "weakness", offer "almost / no clue / careless" classifier on the miss; tune the resurfacing schedule per response. Light metacognitive signal without the BLOCKED Error Post-Mortem schema bump.

**Avoid (learned dead-ends):** Bucket promotion gated on personal-best time; L3 timeout-as-failure. See SELF-IMPROVE.md § Avoid.

---

### 4. Content (lessons, syllabus coverage, quality)
*The 143 lessons themselves — new lessons, rewrites, audits, syllabus gaps.*

**Review trigger:** If `L1/L2 quality across full curriculum` row has not been bumped in 8+ iters, OR if any specific section row (`Algorithms section`, `Linked List section`, etc.) is the highest-iter-touched, OR if the BS-08 watchlist hasn't been re-audited in 6+ iters, this category is stale.

**Active ideas (cross-cutting audit themes from iter-27):**
- Audit theme #2: L2 under-build is systemic (33 of 79 patterns + 17 of 20 applied have only 1 L2 — violates PROFILE.md ≥2 floor). Multi-iter sweep candidate.
- Audit theme #7: ~20 remaining absurd-distractor L1 questions (iter 29 closed 5 of ~25). Mobile-leverage cleanup; theme #7 part 2.
- BS-13 retro-add visual diagrams to high-traffic lessons (binary-search, p-bfs, p-min-window, p-islands, p-merge-two-sorted, p-reverse-list, p-min-heap, s-iter-protocol).

**Parking-lot ideas — new lessons / coverage gaps:**
- **BS-03 JS-specific gaps:** `structuredClone`, `AbortController`, `Promise.race/any/allSettled`, microtask vs macrotask ordering, hoisting/TDZ, `==` coercion, `WeakMap`/`WeakRef`.
- **BS-04 frontend utility lessons:** DOM traversal, event delegation, `classNames()`, retry-with-backoff, promise concurrency pool, AbortController-cancellable promise, deep equality.
- **BS-05 modern syntax gaps:** rest params, computed/shorthand keys, logical assignment (`||=`, `??=`, `&&=`), ES2022+ array variants (`findLast`, `toSorted`, `toReversed`).
- **BS-02 Tier 2 boilerplate-as-syntax:** matrix-bounds, dfs-recursive-template, dfs-iter-template, ll-node-shape, binsearch-template, union-find, grid-init.

**Cross-cutting concerns:**
- BS-15 `problem` field — Patterns/Applied lessons need interview-style problem statement field; `description` is currently technique-flavored.
- BS-16 Conversation voice quality at scale — 99 lessons rolled out via subagents; structural-validation-only, no human-read quality audit. Soak window before next surface adds.

---

### 5. UI/UX Experience
*Mobile responsiveness, sidebar, sticky action bar, syntax highlighting, search, keyboard nav, drawer.*

**Review trigger:** If `Sidebar (path-order sort)`, `Welcome banner`, `Applied-track surfaces (pills, stats panel)`, `L3 surface / CTA injection`, OR any mobile-probe row have not been bumped in 12+ iters, this category is stale.

**Active ideas:**
- **Lesson-history sparkline** — see [`roadmap.md` iter-31 entry #6](roadmap.md). SHIPPED iter 33; mobile probe added iter 34.

**Parking-lot ideas:**
- Per-lesson "estimated time" chip in the sidebar (5-min / 10-min / 30-min).
- Section-level progress bar in sidebar (3 of 9 mastered).
- Dark/light mode toggle (currently single theme).
- "Filter sidebar by track + section + status" — currently hide-mastered is the only filter.
- Keyboard nav for L1 (number keys = A/B/C/D) — currently only sidebar nav.
- Search result preview (show matching Reference line, not just title).
- Pinned lessons row at sidebar top.
- "Last 5 lessons drilled" recents.
- Tab-row mobile gesture (swipe between Reference/L1/L2/L3 instead of tap).

**Cross-cutting concerns:**
- Mobile probe is mandatory for any UI change (PROFILE.md 80%-phone). See SKILL.md Step 5.

---

### 6. Persistence & Sync
*localStorage schema, backup/restore, session resume, multi-tab sync, cross-device.*

**Review trigger:** If `State persistence (schema __v)`, `Storage backend`, OR `Per-lesson event tracking` rows have not been bumped in 15+ iters, this category is stale. (Persistence is intentionally low-churn — schema bumps are expensive — so the trigger is longer.)

**Active ideas:**
- **BS-10 Cross-device sync** — anonymous-first, opt-in login. Frame-iter prereq to scope before any code. Strong win for 80%-phone profile.

**Parking-lot ideas:**
- Auto-export progress JSON to clipboard on demand (currently manual file download).
- Conflict resolution if multi-tab sync detects divergence.
- IndexedDB migration path (when localStorage hits 5MB — distant).
- "Reset just this section" instead of full progress wipe.
- Cloud backup via gist URL (deferred from iter-26 vision subagent A entry #5).

**Cross-cutting concerns:**
- Current schema `__v: 6` (bumped iter 32 for `history` field). Load accepts 2-6 for legacy users.

---

### 7. Metacognition & Visibility
*Surfaces that show the user their own progress patterns — sparkline, history, stats dashboard, mistake tracking.*

**Review trigger:** If `Lesson-history sparkline`, `Per-lesson event tracking`, OR `Audit theme tracking` rows have not been bumped in 10+ iters, this category is stale. (New category as of iter 32 — sparkline is the first surface in it.)

**Active ideas:**
- **Error Post-Mortem with Miss Classification** — see [`roadmap.md` iter-26 entry #2](roadmap.md). BLOCKED (Amendment B). The concept-grain weak-spot tracker.

**Parking-lot ideas:**
- Section-level retention sparkline (aggregate across all lessons in a section).
- "You re-missed this question 3 times in 14 days" callout — concrete pattern, no classifier needed.
- Time-to-pass distribution per lesson (rolling avg of mock-interview attempts).
- Cheatsheet of "your weakest 10 idioms" auto-generated from miss history.
- Heatmap of drilling activity per day (GitHub-contribution style).
- **Pattern-family heatmap** — small per-section grid on the home/sidebar surface, color-coded by mastery rate; tap a red cell → drill that section's weakest lesson. Visual one-tap answer to "where do I need to study tonight?". Distinct from drilling-activity heatmap (which is volume); this is *mastery*.
- **"Your weakest verb" surface** — auto-aggregated keyword tally from miss history ("you've missed `splice` 6× across 4 lessons" / "you've missed `>>>` 3× in bit-manipulation"). No classifier needed — keyword match against L1 question text + canonical tokens. Lighter than the BLOCKED Error Post-Mortem entry, same metacognitive spirit.
- **Post-mock self-evaluation journal** — after each mock interview, optional 30s text capture: "what would the interviewer comment on?". Stored as a flat reviewable list, exportable. Trains self-evaluation without classifier infrastructure.
- **Section-mastery progress arc** — sparkline at the section header (not lesson header) showing aggregate L1 + L2 pass rate week-over-week. Surfaces "you're plateauing in DP" without per-lesson drill-down.

**Cross-cutting concerns:**
- Sparkline shipped iter 33 — first per-lesson temporal surface. Establishes the category.

---

### 8. Modalities
*The form of interaction itself — visual diagrams, audio, voice, recognition-vs-recall direction.*

**Review trigger:** If `docs/learning-strategies/dual-coding.md`, OR any new-modality surface (sparkline counts as "temporal modality"), has not had work in 12+ iters, this category is stale.

**Active ideas:**
- **Commute Audio Mode** — see [`roadmap.md` iter-26 entry #3](roadmap.md). BLOCKED (Amendment C + instrumentation prereq).
- **Pattern Recognition Speed Drill** — see [`roadmap.md` iter-26 entry #1](roadmap.md). BLOCKED (Amendment A + BS-15).
- **BS-13 visual encoding retro-add** — see Content category for the lesson list.

**Parking-lot ideas:**
- Sound feedback on L1 correct/wrong (subtle, off by default).
- Haptic feedback on mobile L2 blank correct (vibrate API).
- "Read aloud the canonical" Play button on Reference (subset of Audio Mode, ships without Amendment C — but adversary should check).
- Voice-in for L2 fills (Web Speech) — v2 of Audio Mode.
- **Audio mini-explainers per high-leverage lesson** — 30-60s TTS clip on Reference tab explaining *why this canonical over alternatives* (e.g., "we use a Set not Map here because we never need values"). Ships independently of BLOCKED Audio Mode: TTS only, no input loop, no Page Visibility, no Amendment C. Curate top-20 high-traffic lessons first.
- **Touch-sketch approach pad** — mobile-only canvas (Pointer Events) where user sketches boxes-and-arrows of their data-structure approach before L3 starts; saved per-lesson, reviewable. Trains the "draw it first" interview habit currently impossible on phone.
- **Vocabulary spaced-rep** — short MC drills on interview-specific vocabulary (amortized, monotonic, dynamic, memoization, idempotent, monomorphic). Currently absent entirely from the curriculum; trains the *language* of interview discussion that lets you talk through a problem fluently.

---

### 9. Interview Conditioning
*Surfaces specifically targeting the **interview format itself** — clarifying-question ritual, pressure handling, follow-up responsiveness, bug-finding, in-place adaptation under shifted constraints, communication rhythm. The L1→L2→L3 ladder drills the *answer*; this category drills the *interview*.*

**Why this is a distinct category:** Mock Interview (Category 2) is the closest existing surface but only adds a timer + no-hints — it doesn't drill the *behaviors* graded in real interviews (clarifying questions, follow-up handling, edge-case enumeration, bug-finding, complexity-on-the-spot, narrating-while-coding). Pieces are scattered across Sessions and Metacognition today. Category established iter 35 from a deep-thought brainstorm focused on "what passes a coding interview that the current 8 categories don't drill?".

**Review trigger:** If `Mock interview`, `Mock interview probe` rows in `SELF-IMPROVE.md § Last-touched index` have not been bumped in 12+ iters AND no parking-lot idea from here has been promoted to `roadmap.md` in 8+ iters, this category is stale. (New category bootstrap — first promotion to roadmap closes the bootstrap.)

**Active ideas:** *(none yet — category bootstrapped iter 35; first promotion to `roadmap.md` via a vision iter closes the bootstrap.)*

**Parking-lot ideas:**
- **Hot-seat interviewer challenges** — mid-mock-interview, app injects a curated follow-up ("what if N is 1 trillion?", "can you do this in O(1) space?", "what if input is nearly sorted?", "what if duplicates?"); user types/says a one-sentence answer within 15s. Trains the *follow-up beat* every real coding interview has and no existing surface drills. Distractor pool is small + hand-curated (~30 generic probes), reusable across all lessons.
- **Pre-flight clarifying-questions checklist** — before mock (or L3 with a toggle), modal prompts: input constraints? null/empty? duplicates? in-place vs new? sorted? bounded ints? negative numbers? overflow? Forces the "ask clarifying questions first" ritual interviewers grade on but the app never drills.
- **Approach-first sketch (30s lock)** — between problem reveal and first keystroke, editor is locked while user types (or voice-records) a one-sentence approach. Then editor unlocks. Stored. Surfaces "you said sliding window but coded brute force" mismatches and trains "approach-first, code-second" interview ritual.
- **Whiteboard mode toggle** — strips syntax highlighting on L3, hides the run button until "I'm ready" click, suppresses autocomplete and error-line highlighting. Closer to a Google Doc / actual whiteboard. ~30 LOC ship; trains the realistic-interview surface where you can't lean on tooling.
- **Code bug-hunt mode** — present a `reference.code` variant with one deliberately-injected bug (off-by-one, slice-vs-splice, missing base case, wrong operator, mutated-while-iterating); user picks the offending line. Trains code-review — high-leverage in pair-programming and "review this PR" interviews. Bugs via small per-lesson curation OR a rule-based mutator (swap `<` ↔ `<=`, `i++` ↔ `++i`, etc.).
- **Constraint-shift adaptation drill** — take an existing lesson; app surfaces a variant with one constraint changed ("now solve in-place", "now input is a stream — single iteration only", "now no extra space", "now solve recursively / iteratively"); user must adapt or recognize the canonical still applies. Trains the "follow-up extension" beat. Constraint pool is small (~6 variants per shape).
- **Trap-recognition drill** — present problem prompt + a tempting-but-wrong approach side-by-side (e.g., "sort first then sliding window" for a problem where sort breaks O(n); "hash map for ordering" when stable order matters). 2-tap: "actually correct" / "trap — real approach is...". Forces recognition of fool's-gold patterns experienced engineers see in interviews.
- **Big-O speed drill** — pure L1 stream restricted to complexity questions across all 79 patterns lessons. Existing data; every canonical's complexity is already authored. Concentrates the iter-27 "complexity-question fatigue" theme (#4) into a *trainable skill* rather than diluting it across normal lessons. Mobile-native (tap only).
- **Edge-case "what did this miss?"** — show problem + canonical → MC of "which edge case did this canonical NOT handle?" (answer pool includes "none — handles all"). Some canonicals genuinely have an unhandled edge case the user should spot. Trains edge-case enumeration — common interview signal: "did you consider...?"
- **Reverse problem-identification** — given only `L3.expectedOutput` (or a sample I/O trace) + 4 MC pattern-name distractors, user picks "what problem does this likely solve?". Trains forward-from-output reasoning — a common interview unblock pattern. Uses existing data; complementary to the BLOCKED Recognize-mode (which goes problem→pattern; this goes output→problem).
- **Boss interview (section graduation)** — when user passes all L1 + L2 in a section, surface a 25-min combined-timer mock pulling 3 patterns from that section, mixed/interleaved, no hints. Interview-format reward at section mastery; trains transfer within a section.
- **"Narrate your solution" recorder** — after L3 pass, optional 60s audio capture (Web Audio API): "explain this to an interviewer". Self-grade against the Conversation tab. Pure phone-friendly, eyes-on-thumb output modality; trains the verbalize-under-pressure skill the app currently has no surface for.
- **Pair-programming pacing sim** — toggle mode where the editor auto-types lines 2-3 of the canonical, you type lines 4-5, app types 6-7, etc. Trains the conversational *rhythm* of pair interviews where the interviewer occasionally steps in.

**Cross-cutting concerns:**
- Several entries here would slot cleanly into Mock Interview as toggles rather than standalone modes — design coherence question for the first vision iter that picks from this category.
- The "hot-seat", "clarifying questions", and "narrate your solution" entries collectively span audio/text/visual modalities — natural progression: text MVPs first, audio variants once audio infra exists (cross-link Category 8).

---

## Categories not represented here
*(deliberate — not product surfaces, kept in their existing homes)*

- **Tooling & infrastructure** — `tools/cdp/*`, validator, CDP probes. Tracked in `tools/README.md` and SELF-IMPROVE.md BS-09. Not a learner-facing surface.
- **Loop architecture / SKILL.md / self-improve framework** — tracked in SELF-IMPROVE.md BS-14, BS-17. Meta, not product.
- **Documentation / docs/learning-strategies** — tracked alongside the principles they encode; each strategy doc has its own "How the app encodes it today" section.

If a future idea is purely tooling or purely meta, it belongs in SELF-IMPROVE.md, not here.

---

## How to add an idea to this file

1. **Pick a category.** If the idea doesn't fit any of the 9, the category list is wrong — open it as a question in your end-of-iter report.
2. **Inline or roadmap?** If the idea is shippable in 1-3 iters AND has a falsifiable success criterion, promote it to `roadmap.md` (vision-iter mechanism). Otherwise it's a parking-lot entry — one bullet, one sentence.
3. **No timestamps.** Freshness is derived from `SELF-IMPROVE.md § Last-touched index`. Do not add `last-reviewed:` fields.
4. **Cross-link.** If the idea has a roadmap entry, link to it. If it's grounded in a SELF-IMPROVE blind spot, mention the BS-XX number.
5. **Don't move shipped ideas here.** They go to `roadmap.md § Shipped` (or stay in git history). This file is candidates only.

## How `/drill-improve` Step 1 uses this file

When the next ship target isn't obvious from `SELF-IMPROVE.md § Next iteration`:
1. Scan each category's Review trigger.
2. Cross-reference the named rows in `SELF-IMPROVE.md § Last-touched index`.
3. If a category's trigger fires (rows are stale), that category becomes the ship-search scope — pick the highest-leverage parking-lot or active idea from it.
4. If multiple categories trigger, prefer the one whose triggered rows are closest to PROFILE.md's load-bearing claims (mobile L1/L2 > everything else).
5. If no category triggers, fall through to the existing Step 1 mode-selection (likely vision).

The trigger check is bounded: 9 categories × ~3 rows each = ~27 freshness lookups, all derivable from one file. No per-idea state, no coordination overhead.
