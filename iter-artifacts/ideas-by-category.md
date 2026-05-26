# Ideas by Category

> **Candidates-only catalog of product enhancement ideas for the JS drill app, indexed by surface.**
> Companion to [`roadmap.md`](roadmap.md) (chronological + in-flight status) and [`shipped-by-category.md`](shipped-by-category.md) (the "what got built" record). This file is for browsing "where could I ship next?" without re-reading every vision iter's output.
>
> **Three-view model:**
> - This file = **candidates** (what to consider next, by surface).
> - `roadmap.md` = **in-flight queue** (what's scaffolded/wired/shipped, chronologically).
> - `shipped-by-category.md` = **history** (what got built in each surface, with mechanics + LOC + probe references).
>
> An idea exists in exactly one of these at a time. When it ships, its detailed text migrates from here to `shipped-by-category.md`. The candidate-doc stays lean.

---

## Design rule: low-dependency active reviews

Each category declares a **Review trigger** — a one-line rule telling the loop when the category is overdue for attention. The rule references rows in [`SELF-IMPROVE.md § Last-touched index`](../SELF-IMPROVE.md), which agents already bump on every iter as part of Step 7 reflection. **This file does NOT carry its own timestamps** — that would create a coordinated-update dependency (every iter touching a category would need to remember to update two files, and forgetting one creates silent drift).

The convention:
- This file declares categories + rules + entries.
- `SELF-IMPROVE.md § Last-touched index` is the ground-truth for freshness.
- `roadmap.md` is the ground-truth for in-flight status.
- `shipped-by-category.md` is the ground-truth for "what got built where".
- Anything derivable from those should NOT be duplicated here.

**How `/drill-improve` consumes this:** Step 1 of the skill (when no obvious queued ship target exists) scans this file for categories whose Review trigger has fired. The triggered category becomes the ship-search scope. See SKILL.md Step 1.

---

## Categories

### 1. Drilling Surfaces
*The core L1 → L2 → L3 → Reference ladder + the per-lesson tab surfaces (Walkthrough, Conversation).*

**Review trigger:** If `SELF-IMPROVE.md § Last-touched index` rows `L1 / L2 / L3 render state cache`, `Drilling surfaces (L1/L2/L3)`, or any per-tab row have not been bumped in 10+ iters, this category is stale.

**Active ideas:** *(none currently active — vision iter should promote from parking-lot)*

**Parking-lot ideas:**
- L1 "explain why each distractor is wrong" reveal — currently L1 explanations are tied to the correct answer only.
- L2 hint progression (show first letter, then partial token) instead of binary blank/answer.
- L3 starter scaffold toggle — show function signature + return type, not just blank editor. *(Complementary to shipped L3 hint ladder: scaffold is the always-on baseline reveal; the ladder is the on-demand incremental layer above it.)*
- Conversation tab "branch" — let the user pick which of the 6 sections to read, not strict linear.
- **Code-from-bullet-points** — Reference tab toggle hides `reference.code` and shows only `reference.notes` as bullets; user types canonical from notes in an editor. Fills the missing cell between L2 (template + blanks given) and L3 (only problem prompt given) — "see concept, recall code" direction.
- **Two-direction L2** — template with NO blanks; user must IDENTIFY (tap) which token is most load-bearing. Forces understand-before-type rather than guess-and-fill; reuses existing L2 templates with no new content.
- **Solution-shape library (per-pattern meta-Reference)** — a "Shapes" sub-tab on each pattern lesson surfaces the 3-6 *variants* of that pattern (e.g., Sliding Window: fixed-size, variable-shrink, longest, shortest, atMostK, exactly-K; DP: memo top-down, tab bottom-up, 1D space-opt). Each shape is a 5-line skeleton with one-sentence "use when..." Bridges Reference into a *meta-Reference* mirroring how interviewers think.

**Cross-cutting concerns:**
- Audit theme #3 ("Why dummy head?" Q recurs 4× across LL) — see BS-08 in SELF-IMPROVE.md.
- L2 under-build (50 lessons violate ≥2 floor) — see BS-08.
- **[iter 38] Code-writing prioritized over code-reading.** Reading-direction entries (Code-reading speed drill, Pure-flashcard pattern mode) demoted; *writing*-direction surfaces remain the priority. Mental-execution-of-writing (Crystal Ball, shipped iter 77) is retained as a complement, not a substitute.

**Shipped from this category:** Reference-Card Flash Mode (iter 35) · Walkthrough Quiz (iter 36) · L3 hint ladder (iter 37) · Critical-line fill (iter 41/42) · L1 Rapid-Fire (iter 54) · Crystal Ball (iter 77) · Trace-bug (iter 78) · Conversation Drill (iter 91) · Trace-Hop (iter 93) · Notes Cloze Tap-Drill (iter 97) · Reverse-Walkthrough (iter 99) · Notes Locate (iter 102) → see [`shipped-by-category.md` § 1](shipped-by-category.md#1-drilling-surfaces).

---

### 2. Paths & Sessions
*The curated/timed entry points: Starter Path, Today's Plan, Mock Interview, Weak-Spot resurfacing.*

**Review trigger:** If `Mock interview`, `Mock interview probe`, `Sidebar (path-order sort)`, `Weak-spot visibility`, or `Welcome banner` rows have not been bumped in 12+ iters, this category is stale.

**Active ideas:**
- **Pattern Recognition Speed Drill** — see [`roadmap.md` iter-26 entry #1](roadmap.md). **BLOCKED** (depends on PROFILE Amendment A + BS-15 `problem` field). The original concrete→abstract pattern-naming drill. iter-49 🔎 Recognize sidestepped this via SECTION-name distractors; the pure pattern-name version remains blocked.
- **Commute Audio Mode** — see [`roadmap.md` iter-26 entry #3](roadmap.md). **BLOCKED** (Amendment C + Page Visibility instrumentation).

**Parking-lot ideas:**
- **Path-progress visualization in lesson header** — "Step 17 of 60" → a tiny progress bar showing visited/passed/upcoming steps. Today the user sees "Step N of M" pill but no visual sense of where they are in the path.
- **"Where am I?" in path** — when on a non-path lesson, show a small "← Back to path step N" affordance to return to the path sequence.
- **Path-step prompts** — between path steps, show "Why this next?" rationale so the user understands the path's intent.
- **Branchable paths** — Starter Path forks at decision points (e.g., "Comfortable with arrays? Skip ahead to hash maps. Need more practice? Stay here.").
- Mock interview "topic-aware" mode — pull from a single section instead of full random pool.
- Today's Plan size-tunable (15-min vs 30-min vs 60-min slices).
- Mock-interview replay — view your code from a past mock side-by-side with the canonical.
- "Resume yesterday's session" — surface partial-completion across days.
- Insert the 6 iter-20 Algorithms lessons + iter-22 `s-index-math` into Starter Path.
- **Cold open daily** — first app load of the day surfaces a random L3 problem with a timer, no warmup; trains "interview opens cold" reality. *(Paired with **60s daily warm-up sprint** below as a 2-friction choice — cold-open is desk-tier interview-realism, warm-up is mobile-tier habit-formation.)*
- **Two-pass speed drill** — same lesson, three timed rounds (5 min → 3 min → 2 min); track time-to-correct degradation. Specifically trains performance under decreasing pressure.
- **Pattern-fusion mock** — small hand-curated table of "pattern A + pattern B" pairs (e.g., sliding-window + monotonic-deque; hash + binary-search) maps to existing lessons; a fusion mock requires both. Real interviews chain 2 patterns; no surface drills the chain.
- **Daily 1-pattern-deep ritual** — opt-in: for today's chosen pattern, complete ALL surfaces (Reference → L1 → L2 → L3 → Conversation → Walkthrough) before any other lesson unlocks. Depth-first day vs. interleaved breadth.
- **60-second daily warm-up sprint** — first-load-of-the-day pure L1 sprint (8-12 questions across mastered lessons in 60s, tap-only). Gym-friendly, phone-friendly. Distinct from Cold open daily (which lands on L3); this is the *low-friction* anti-cold-open.
- **1-minute panic recovery drill (mock variant)** — within mock interview, when 1 min remains and L3 isn't passing, app forces a 2-tap decision: (a) "submit partial + leave a comment explaining what's missing" or (b) "try one more thing — 60s on the clock". Trains decision-under-pressure.
- **Time-budget allocator on mock** — before mock starts, user pre-allocates the 45-min budget across phases (e.g., 5 clarify / 10 approach / 25 code / 5 test). App tracks adherence and surfaces "you overspent on approach by 8 min" post-mock. Trains time-discipline.
- **Auto-difficulty selector ("too easy / right / too hard")** — 3-tap rating after each lesson pass; next surfaced lesson is one tier in that direction. Adaptive difficulty without a rating system; closes the "what next?" decision-fatigue gap.
- **Pre-interview week ramp planner** — user enters a target date ("interview on 2026-06-04"); app generates a calendar-aware ramp plan from today to target: easy lessons first 3 days, mock interviews in last 3 days, weak-spot focus mid-ramp, complete rest day before. Date-aware variant of Today's Plan; ships independently of any cloud sync.
- **Productive-failure mode** — invert the L3-after-Reference default: a toggle that LOCKS the Reference tab and forces L3 attempt first; only after a fail (or "I give up") does Reference unlock. Engages the *generation effect* (research-validated: forced-attempt-before-instruction improves long-term retention).
- **Mock-interview "kickoff ritual"** — before mock starts, scripted 30s phases: "take 3 breaths" (timer) → "read the problem twice" (Reference visible 20s) → "type your approach" (text box) → "begin coding" (editor unlocks). Trains the *opening-30-seconds discipline*.
- **Daily problem (Wordle-style, no leaderboards)** — one shared problem per day, derived deterministically from `Math.floor(Date.now() / 86400000) % lessonCount` (every user gets the same lesson on the same calendar day, no server). User attempts; on pass, sees "1,247 days drilled by everyone today" *only as a coincidence count* — no leaderboard, no streak comparisons, no usernames. Bridges the community/shared-experience gap (zero existing — every prior surface is solo-mode) and external-rhythm habit formation. Threads PROFILE.md's anti-gamification warning by omitting competitive elements.

**Cross-cutting concerns:**
- Weak-spot tracker originally operated only at lesson grain (not concept grain) — see [`roadmap.md` iter-26 entry #2 (Error Post-Mortem)](roadmap.md). **Partially closed iter 58** by 🏷 Mistake Tagging Postmortem (concept-grain user-tagged misses).

**Shipped from this category:** Per-track Starter Paths (iter 39) · 🔎 Recognize (iter 49) · L1 Rapid-Fire (iter 54) · 🌅 3-Card Warmup (iter 57) · 🍀 Lucky roulette (iter 108) · 🥊 Pattern-Family Gauntlet (iter 125, **first Active-list refill since iter 45 path-aware SR queue — 80-iter drought broken**) → see [`shipped-by-category.md` § 2](shipped-by-category.md#2-paths--sessions).

---

### 3. Mechanics (under-the-hood reinforcement)
*Spaced repetition, reveal-tracking dot variants, personal-bests, mechanics-modal, pass-condition logic.*

**Review trigger:** If `Spaced repetition`, `L3 surface / CTA injection`, `Mechanics modal`, or `Validator (density warning)` rows have not been bumped in 12+ iters, this category is stale.

**Active ideas:**
- **Error Post-Mortem with Miss Classification** — see [`roadmap.md` iter-26 entry #2](roadmap.md). **BLOCKED** (Amendment B). Note: partial close via 🏷 Mistake Tagging (iter 58, see Cat 7); full classifier version still blocked.
- **BS-11 "I passed but nothing saved" UX gap** — see SELF-IMPROVE.md BS-11. Strict pass conditions are correct but invisible; candidates: persistent per-session score chip, post-attempt summary, loosen-strict toggle.

**Parking-lot ideas:**
- SR-bucket "snooze" — let the user push a due lesson 1 day forward without demoting.
- SR-interval expansion past 30d (60d, 90d) for over-mastered lessons.
- Demote-on-second-miss within a session (currently demote-on-reveal only).
- Personal-best per-level (separate L1 best, L2 best, L3 best — not just overall mock).
- "Spend points on a hint" — earn from clean passes, spend on reveal-without-demote.
- **Cognitive-load self-rating → SR calibration** — after L3 pass, single-tap 3-point ("trivial / earned / struggled") multiplies the next SR interval (easy stretches, hard contracts). Ebbinghaus-style desirable-difficulty calibration without a complicated model — one multiplier on the existing 1d → 30d ladder.
- **Time-to-solve prediction calibration** — pre-attempt, user predicts "N minutes"; app tracks predicted-vs-actual delta. Trains the rusty engineer's "how long will this take me" estimate — a load-bearing interview skill.
- **Anki-style rating on L1 miss** — instead of demoting straight to "weakness", offer "almost / no clue / careless" classifier on the miss; tune the resurfacing schedule per response. Light metacognitive signal without the BLOCKED Error Post-Mortem schema bump.
- **Algorithmic mnemonics layer** — optional per-lesson mnemonic field rendered as a small banner on Reference (e.g., for sliding window: "SLIDE — Shrink-from-left when invariant breaks; Insert at right; Done when right==N; Extend by widening"). User-toggleable; mnemonic itself becomes an L1 question in SR rotation (recall-the-mnemonic).

**Avoid (learned dead-ends):** Bucket promotion gated on personal-best time; L3 timeout-as-failure. See SELF-IMPROVE.md § Avoid.

**Shipped from this category:** 🏷 Mistake Tagging Postmortem (iter 58, primary listing in Cat 7) · 🧩 Mechanics × Track matrix view (iter 63) · 🧠 Mechanic-Bridge (iter 94) · 🪐 Mechanic Constellation (iter 98) · ⏱ Time-to-Solve Calibration v1 MVP (iter 119, first Cat 3 SR-mechanics ship since iter 58 — 61-iter drought broken; v2 Stats tile deferred) → see [`shipped-by-category.md` § 3](shipped-by-category.md#3-mechanics).

---

### 4. Content (lessons, syllabus coverage, quality)
*The 143 lessons themselves — new lessons, rewrites, audits, syllabus gaps.*

**Review trigger:** If `L1/L2 quality across full curriculum` row has not been bumped in 8+ iters, OR if any specific section row (`Algorithms section`, `Linked List section`, etc.) is the highest-iter-touched, OR if the BS-08 watchlist hasn't been re-audited in 6+ iters, this category is stale.

**Active ideas (cross-cutting audit themes from iter-27):**
- **🪤 JS Traps section v2 — scale from 3 to ~12 lessons** — iter-115 MVP (3 lessons: t-tdz, t-floating-precision, t-delete-array-holes) shipped and validated. v2 expands to the full BS-03 + gotcha-bag scope (~9 more lessons covering `Array(3).fill([])` shared-ref, `JSON.stringify` undefined/function-drop, `this`-binding-loss-on-method-extract, hoisting/TDZ deepening, `for...in` on arrays, `Object.keys` ordering on numeric keys, mutation of frozen-shallow objects, `==` NaN quirks, structuredClone vs JSON-clone). Wait for soak window on v1 to surface gaps before committing scale. Pivot original MVP picks rejected during iter-115 curation pass: `Array(3).fill([])` is covered in `s-arr-create` notes; `typeof null` is touched by `s-this`; `parseInt` radix is in `s-number-parse` — pick fresh angles.
- Audit theme #2: L2 under-build is systemic (33 of 79 patterns + 17 of 20 applied have only 1 L2 — violates PROFILE.md ≥2 floor). Multi-iter sweep candidate.
- Audit theme #7: ~20 remaining absurd-distractor L1 questions (iter 29 closed 5 of ~25). Mobile-leverage cleanup; theme #7 part 2.
- BS-13 retro-add visual diagrams to high-traffic lessons (binary-search, p-bfs, p-min-window, p-islands, p-merge-two-sorted, p-reverse-list, p-min-heap, s-iter-protocol).

**Parking-lot ideas — new lessons / coverage gaps:**
- **BS-03 JS-specific gaps:** `structuredClone`, `AbortController`, `Promise.race/any/allSettled`, microtask vs macrotask ordering, hoisting/TDZ, `==` coercion, `WeakMap`/`WeakRef`.
- **BS-04 frontend utility lessons:** DOM traversal, event delegation, `classNames()`, retry-with-backoff, promise concurrency pool, AbortController-cancellable promise, deep equality.
- **BS-05 modern syntax gaps:** rest params, computed/shorthand keys, logical assignment (`||=`, `??=`, `&&=`), ES2022+ array variants (`findLast`, `toSorted`, `toReversed`).
- **BS-02 Tier 2 boilerplate-as-syntax:** matrix-bounds, dfs-recursive-template, dfs-iter-template, ll-node-shape, binsearch-template, union-find, grid-init.
- **JS gotcha trap bag (its own section)** — a concentrated ~30-50 lesson set of canonical JS traps that interviewers love: `typeof null === 'object'`, `[] == false` but `[] !== false`, `Array(3).fill([])` shared-reference, `parseInt` radix surprise, NaN comparisons, hoisting/TDZ, `this` binding loss, `for...in` on arrays, `Object.keys` ordering, `JSON.stringify` losing functions/undefined/Symbols, `+` operator type coercion, `delete` on arrays leaving holes, integer overflow in bitwise ops, mutation of frozen-shallow objects. Pure L1 (tap, mobile-native); each trap as its own atomic lesson. Compounds with BS-03 but is the *trap*-flavored angle.
- **System-design micro-drills (new "System Design Concepts" section)** — full SD is out of scope (BS-06), but the *conceptual nuggets* are MC-shaped and interview-essential: token-bucket vs leaky-bucket vs sliding-window rate limiting; push vs pull feeds; sharding strategies; cache eviction (LRU vs LFU vs ARC); consistent hashing; CAP triangle; idempotency keys; eventual vs strong consistency; pub/sub vs queue; CDN cache headers; deduplication via Bloom filter. ~20-30 lessons, pure Reference + L1.
- **Interview "stamp" subroutines drill** — a concentrated lesson set on the 5-15 line "stamps" every interview eventually pulls: binary-search variants (lower bound, upper bound, leftmost-true, peak), two-pointer setups (same-direction, opposite-direction, slow-fast), dummy-head LL boilerplate, sliding-window expand/shrink, monotonic stack push/pop, iterative tree traversals, Dijkstra-template, union-find compress-and-rank, Bloom filter set/has, reservoir sample. Each as a standalone "stamp" lesson with the bare-bones reusable code.
- **Algorithmic vocabulary lessons** — short L1-only lessons on interview-domain vocabulary: amortized, monotonic, idempotent, memoization, tabulation, in-place, online vs offline algorithm, NP-complete vs NP-hard, invariant, predicate, deterministic, monomorphic, hot path, cache line, big-Theta vs big-O. Trains the *language* of interview discussion.
- **Code-review interview prep section** — a new lesson type entirely: `review/<id>.json` lessons present a PR-style code change (diff + description) plus 3 MC distractors for "what's the most important thing to comment on?". Trains the increasingly common interview format where Big Tech asks engineers to review code.

**Cross-cutting concerns:**
- BS-15 `problem` field — Patterns/Applied lessons need interview-style problem statement field; `description` is currently technique-flavored.
- BS-16 Conversation voice quality at scale — 99 lessons rolled out via subagents; structural-validation-only, no human-read quality audit. Soak window before next surface adds.

**Shipped from this category:** 🪤 JS Traps section v1 MVP (iter 115, 3 lessons: t-tdz + t-floating-precision + t-delete-array-holes — first Cat 4 ship since iter 22; closes part of BS-03 JS-specific gaps) → see [`shipped-by-category.md` § 4](shipped-by-category.md#4-content).

---

### 5. UI/UX Experience
*Mobile responsiveness, sidebar, sticky action bar, syntax highlighting, search, keyboard nav, drawer.*

**Review trigger:** If `Sidebar (path-order sort)`, `Welcome banner`, `Applied-track surfaces (pills, stats panel)`, `L3 surface / CTA injection`, OR any mobile-probe row have not been bumped in 12+ iters, this category is stale.

**Active ideas:** *(none currently active — vision iter should promote from parking-lot)*

**Parking-lot ideas:**
- Per-lesson "estimated time" chip in the sidebar (5-min / 10-min / 30-min).
- Dark/light mode toggle (currently single theme).
- "Filter sidebar by track + section + status" — currently hide-mastered is the only filter.
- Keyboard nav for L1 (number keys = A/B/C/D) — currently only sidebar nav.
- Search result preview (show matching Reference line, not just title).
- Pinned lessons row at sidebar top.
- Tab-row mobile gesture (swipe between Reference/L1/L2/L3 instead of tap).
- **PWA install + offline drilling** — `manifest.json` + service-worker pre-cache of `data/*.json` + app shell lets the rusty engineer drill in subway tunnels and on planes. Massive mobile-leverage given the PROFILE 80%-phone usage; one-time engineering for permanent reach. Push API is the natural follow-on. **Partially shipped:** iter 113 Offline Drill Pack landed the SW pre-cache half (`service-worker.js` + sidebar chip + state.offlinePack); remaining scope is the PWA `manifest.json` web-app metadata + install-prompt UX trigger.
- ~~**L3 "calculator-style" keyboard chips**~~ → SHIPPED iter 123 (🎹 L3 keyboard chips).

**Cross-cutting concerns:**
- Mobile probe is mandatory for any UI change (PROFILE.md 80%-phone). See SKILL.md Step 5.

**Shipped from this category:** Lesson-history sparkline (iter 33) · URL deep-linking (iter 38) · 🗺 Sidebar Command Palette (iter 104) → see [`shipped-by-category.md` § 5](shipped-by-category.md#5-uiux-experience).

---

### 6. Persistence & Sync
*localStorage schema, backup/restore, session resume, multi-tab sync, cross-device.*

**Review trigger:** If `State persistence (schema __v)`, `Storage backend`, OR `Per-lesson event tracking` rows have not been bumped in 15+ iters, this category is stale. (Persistence is intentionally low-churn — schema bumps are expensive — so the trigger is longer.)

**Active ideas:**
- **📦 Offline Drill Pack v2** — vendor CDN dependencies (Tailwind via local build, CodeMirror v5 self-hosted) so the app works fully offline on the FIRST visit, not just return visits. Follow-on to iter-113 SW pack which assumes CDN is in browser HTTP cache. Lower leverage than v1 but closes the cold-start-offline edge case.

**Parking-lot ideas:**
- Auto-export progress JSON to clipboard on demand (currently manual file download).
- Conflict resolution if multi-tab sync detects divergence.
- IndexedDB migration path (when localStorage hits 5MB — distant).
- "Reset just this section" instead of full progress wipe.
- Cloud backup via gist URL (deferred from iter-26 vision subagent A entry #5).
- **📤 Resume Snippet Export** — recruiter-ready paragraph + public read-only progress URL. HELD on gamification risk per PROFILE L75; re-promote condition: concrete anti-gamification mitigation pre-decided (no streak/mock counts; mastered-LESSON-list emphasis). See [`roadmap.md` iter-112 HELD](roadmap.md).

**Cross-cutting concerns:**
- Current schema `__v: 6` (bumped iter 32 for `history` field). Load accepts 2-6 for legacy users.

**Shipped from this category:** 🤖 AI Coach Export (iter 88) · ☁️ Cross-device sync infrastructure (iter ~88 via `js/sync.js`) · 📦 Offline Drill Pack v1 (iter 113) · ☁️ Sync Onboarding banner (iter 114, completes the sync UX surface) → see [`shipped-by-category.md` § 6](shipped-by-category.md#6-persistence--sync).

---

### 7. Metacognition & Visibility
*Surfaces that show the user their own progress patterns — sparkline, history, stats dashboard, mistake tracking.*

**Review trigger:** If `Lesson-history sparkline`, `Per-lesson event tracking`, OR `Audit theme tracking` rows have not been bumped in 10+ iters, this category is stale.

**Active ideas:**
- **Error Post-Mortem with Miss Classification** — see [`roadmap.md` iter-26 entry #2](roadmap.md). **BLOCKED** (Amendment B). Concept-grain weak-spot tracker; full classifier version blocked. Partial close shipped iter 58 as 🏷 Mistake Tagging.

**Parking-lot ideas:**
- **Mastery progression graph** — over time, # of mastered lessons trending up; per-week / per-month. Closes PROFILE.md success criterion line 66 ("mastered lessons stay mastered") with a temporal view at the curriculum-grain (vs sparkline's lesson-grain).
- **"Time invested" panel** — total drill time, time per section, time per track. Many users want to feel the accumulation; the current dashboard shows counts but not effort.
- **Weak-spot dashboard** — surface all lessons in the weak-spot tracker as a single view with "drill this now" affordances. (Note: partially addressed by 📡 Weak-Spot Decay Radar iter 60; this would be the deeper dashboard view.)
- **Per-section "where are my gaps?" view** — show which lessons in a section are bottom-quartile / un-attempted / due-soon. Helps target the next session.
- Section-level retention sparkline (aggregate across all lessons in a section).
- "You re-missed this question 3 times in 14 days" callout — concrete pattern, no classifier needed.
- Time-to-pass distribution per lesson (rolling avg of mock-interview attempts).
- Cheatsheet of "your weakest 10 idioms" auto-generated from miss history.
- Heatmap of drilling activity per day (GitHub-contribution style). *(Note: distinct from shipped Streak Map (iter 62) which is calendar density; this is contribution-style.)*
- **"Your weakest verb" surface** — auto-aggregated keyword tally from miss history ("you've missed `splice` 6× across 4 lessons" / "you've missed `>>>` 3× in bit-manipulation"). No classifier needed — keyword match against L1 question text + canonical tokens.
- **Post-mock self-evaluation journal** — after each mock interview, optional 30s text capture: "what would the interviewer comment on?". Stored as a flat reviewable list, exportable.
- **Section-mastery progress arc** — sparkline at the section header (not lesson header) showing aggregate L1 + L2 pass rate week-over-week. Surfaces "you're plateauing in DP" without per-lesson drill-down.
- **Skill-tree visualization** — RPG-style node graph of patterns showing prerequisites and "boss" lessons. Visual at-a-glance "where am I in this universe?" — pure motivation surface. Could be a one-time canvas render from a static prerequisite-edges table (~100 edges across 79 patterns lessons).
- **Post-interview gap log** — after a real-world interview, a "log it" surface: 30-second freeform capture of what came up + optional pattern tags. App routes future drilling toward flagged patterns (boosts SR priority + adds to weak-spots) and surfaces the journal for re-review. Closes the *real-world feedback loop* the app currently has zero connection to.
- **"Confidence gap" calibration chart** — for each lesson, plot the user's predicted confidence (single 1-5 tap before drilling) vs. actual pass/fail. Surfaces calibration drift: "you say 5/5 on hash maps but pass only 60% of the time" — the rusty engineer's most dangerous failure mode is over-confidence on patterns they last touched 6 years ago.

**Cross-cutting concerns:**
- Sparkline (iter 33) established this category. Per-lesson temporal data is now load-bearing for Streak Map, Decay Radar, Mock Replay Reel.

**Shipped from this category:** Section-level progress bar (iter 40) · Reveal Replay (iter 56) · 🏷 Mistake Tagging (iter 58) · 📡 Decay Radar (iter 60) · ⌚ Mock Replay Reel (iter 61) · 📅 Streak Map (iter 62) · 💀 Resurrect Queue (iter 65) · 🧭 Track Balance Compass (iter 66) · 🎯 Hint-Cost Ladder Stats (iter 101) · 📈 Mastery Half-Life (iter 106) · ⏱ Session Heatstrip (iter 107) · 🌈 Sections heatmap (iter 111, spatial axis) → see [`shipped-by-category.md` § 7](shipped-by-category.md#7-metacognition--visibility).

---

### 8. Modalities
*The form of interaction itself — visual diagrams, audio, voice, recognition-vs-recall direction.*

**Review trigger:** If `docs/learning-strategies/dual-coding.md`, OR any new-modality surface, has not had work in 12+ iters, this category is stale.

**Active ideas:**
- **Commute Audio Mode** — see [`roadmap.md` iter-26 entry #3](roadmap.md). **BLOCKED** (Amendment C + instrumentation prereq).
- **Pattern Recognition Speed Drill** — see [`roadmap.md` iter-26 entry #1](roadmap.md). **BLOCKED** (Amendment A + BS-15).
- **BS-13 visual encoding retro-add** — see Content category for the lesson list.

**Parking-lot ideas:**
- Sound feedback on L1 correct/wrong (subtle, off by default).
- Haptic feedback on mobile L2 blank correct (vibrate API).
- "Read aloud the canonical" Play button on Reference (subset of Audio Mode, ships without Amendment C — but adversary should check).
- Voice-in for L2 fills (Web Speech) — v2 of Audio Mode.
- **Audio mini-explainers per high-leverage lesson** — 30-60s TTS clip on Reference tab explaining *why this canonical over alternatives* (e.g., "we use a Set not Map here because we never need values"). Ships independently of BLOCKED Audio Mode: TTS only, no input loop, no Page Visibility, no Amendment C. Curate top-20 high-traffic lessons first.
- **Touch-sketch approach pad** — mobile-only canvas (Pointer Events) where user sketches boxes-and-arrows of their data-structure approach before L3 starts; saved per-lesson, reviewable. Trains the "draw it first" interview habit currently impossible on phone.
- **Vocabulary spaced-rep** — short MC drills on interview-specific vocabulary (amortized, monotonic, dynamic, memoization, idempotent, monomorphic). Currently absent entirely from the curriculum; trains the *language* of interview discussion.

**Shipped from this category:** 🔖 Match (iter 109, first Cat 8 ship — establishes the modality) → see [`shipped-by-category.md` § 8](shipped-by-category.md#8-modalities).

---

### 9. Interview Conditioning
*Surfaces specifically targeting the **interview format itself** — clarifying-question ritual, pressure handling, follow-up responsiveness, bug-finding, in-place adaptation under shifted constraints, communication rhythm. The L1→L2→L3 ladder drills the *answer*; this category drills the *interview*.*

**Why this is a distinct category:** Mock Interview (Category 2) is the closest existing surface but only adds a timer + no-hints — it doesn't drill the *behaviors* graded in real interviews (clarifying questions, follow-up handling, edge-case enumeration, bug-finding, complexity-on-the-spot, narrating-while-coding). Category established iter 35.

**Review trigger:** If `Mock interview`, `Mock interview probe` rows have not been bumped in 12+ iters AND no parking-lot idea from here has been promoted to `roadmap.md` in 8+ iters, this category is stale. *(Bootstrap closed — iter 73 Bug-Hunt was the first §9B ship from this category.)*

**Active ideas:** *(none currently active — vision iter should promote from §9A or §9C parking-lot)*

**Parking-lot ideas** *(grouped into 3 sub-themes — § 9A In-the-room behaviors, § 9B Code evaluation skills, § 9C Adaptation/transfer/mastery):*

**§ 9A — In-the-room behaviors** *(what to DO mid-interview; communication mechanics)*
- **Hot-seat interviewer challenges** — mid-mock-interview, app injects a curated follow-up ("what if N is 1 trillion?", "can you do this in O(1) space?", "what if input is nearly sorted?", "what if duplicates?"); user types/says a one-sentence answer within 15s. Trains the *follow-up beat* every real coding interview has. Distractor pool is small + hand-curated (~30 generic probes), reusable across all lessons.
- **Pre-flight clarifying-questions checklist** — before mock (or L3 with a toggle), modal prompts: input constraints? null/empty? duplicates? in-place vs new? sorted? bounded ints? negative numbers? overflow? Forces the "ask clarifying questions first" ritual interviewers grade on.
- **Approach-first sketch (30s lock)** — between problem reveal and first keystroke, editor is locked while user types (or voice-records) a one-sentence approach. Then editor unlocks. Stored. Surfaces "you said sliding window but coded brute force" mismatches.
- **Whiteboard mode toggle** — strips syntax highlighting on L3, hides the run button until "I'm ready" click, suppresses autocomplete and error-line highlighting. Closer to a Google Doc / actual whiteboard. ~30 LOC ship.
- **Pair-programming pacing sim** — toggle mode where the editor auto-types lines 2-3 of the canonical, you type lines 4-5, app types 6-7, etc. Trains the conversational *rhythm* of pair interviews.
- **Narrate-and-review (Web Audio)** — optional audio capture via Web Audio API, in-browser only, no upload. **Two trigger shapes** worth considering as a 2-option ship: (a) *during* L3 — passive recording, transcript via Web Speech on pass for self-review of narration density/clarity, trains *talk-while-typing*; (b) *after* L3 pass — explicit 60s prompt "explain this to an interviewer", self-grade against the Conversation tab, trains *verbalize-under-pressure*. The mid-coding shape is harder to ship; the after-pass shape is a clean MVP.
- **"I'm stuck" interviewer-hint simulator** — during L3, an "I'm stuck" button opens a small modal that prompts user to *articulate* their stuckness in one sentence ("I don't see how to avoid O(n²)"); only after typing does the app surface a staged hint (matching how real interviewers respond — they give targeted hints, not full reveals). Tracks how often + what categories of stuckness recur. Trains the load-bearing skill of *articulating where you're stuck*.
- **Interview behavioral anti-pattern library** — distinct from "trap recognition" (technical traps): curated list of behavioral don'ts every interview coach warns about — premature optimization without stating tradeoffs, silently catching/ignoring errors, defensive boilerplate without explanation, jumping to code without restating the problem, using "obviously" / "trivially" without proof, refusing to talk through brute-force first. Each as an MC drill: "what's wrong with this candidate's move?". Trains the *meta-behaviors* graded silently.
- **STAR-format technical story generator** — after mastering a lesson, app generates a 60-word *Situation/Task/Action/Result* template seeded with the lesson's domain ("Situation: you had a stream of N events and needed to deduplicate in real time. Task: build a fixed-memory dedup. Action: Bloom filter with hash count tuned to FP rate. Result: O(1) per check, 1% FP at 8 bits/elem."). User edits to add their personal anecdote. Stored as a flat "Tech-story bank" — solves the rusty engineer's "I can't think of an example" panic in behavioral rounds. Bridges coding prep to behavioral prep.

**§ 9B — Code evaluation skills** *(read / debug / verify — the skills opposite to L1/L2/L3's "write" direction)*
- **Trap-recognition drill** — present problem prompt + a tempting-but-wrong approach side-by-side (e.g., "sort first then sliding window" for a problem where sort breaks O(n); "hash map for ordering" when stable order matters). 2-tap: "actually correct" / "trap — real approach is...". Forces recognition of fool's-gold patterns experienced engineers see in interviews.
- **Edge-case "what did this miss?"** — show problem + canonical → MC of "which edge case did this canonical NOT handle?" (answer pool includes "none — handles all"). Some canonicals genuinely have an unhandled edge case the user should spot. Trains edge-case enumeration.
- **"Where's your bug?" debugging drill** — when L3 fails, instead of jumping straight to "edit my code", app surfaces a "bisect" mode: shows your code line-numbered + the runner output + the expected output; user must *tap the line* they think is wrong BEFORE editing is unlocked. Stored as "your debugging accuracy" — a measurable interview-relevant skill (today the user just blindly edits until pass; interviewers grade *narrated localization*).
- **PR-style review drill** — a code review surface (cross-link Category 4): given a diff + description, user picks "approve / request changes / one important question" + types/selects the one most-important comment. Trains the systematic code-review skill that 1:1 mirrors how senior interviews open at Big Tech.
- **Anti-templating "what would break?"** — present canonical + a near-identical problem variant; MC: "which line of this canonical breaks under the variant?" Trains *why-this-works* understanding, not just template recall.
- **In-app diff with Socratic prompt on L3 fail** — when L3 fails, instead of a flat "expected vs got", surface the diff at the FIRST differing character + a one-line Socratic question keyed to common failure shapes: index-off-by-one diff → "what's your loop's stop condition?"; wrong final element → "did your last step handle the boundary?"; type mismatch → "what does this expression evaluate to when input is empty?". Trains diagnostic instinct under pressure.
- **Live debugging-methodology drill** — present a failing test scenario; MC the *strategy* (not the fix): "print at every loop iteration / bisect with smaller input / manual trace on paper / add invariant assertion / single-step through the canonical first / read the error message more carefully". Trains the methodology-of-debugging that distinguishes a senior engineer's response from a junior's flail-and-edit pattern.

**§ 9C — Adaptation, transfer & mastery** *(variation drills, follow-up extensions, transfer of skill beyond the lesson title)*
- **Constraint-shift adaptation drill** — take an existing lesson; app surfaces a variant with one constraint changed ("now solve in-place", "now input is a stream — single iteration only", "now no extra space", "now solve recursively / iteratively"); user must adapt or recognize the canonical still applies. Trains the "follow-up extension" beat. Constraint pool is small (~6 variants per shape).
- **Big-O speed drill** — pure L1 stream restricted to complexity questions across all 79 patterns lessons. Existing data; every canonical's complexity is already authored. Concentrates the iter-27 "complexity-question fatigue" theme into a *trainable skill*. Mobile-native (tap only).
- **Inverse complexity exploration** — flip the complexity drill: given a target complexity (e.g., "O(n log n)"), user picks which 3 algorithm shapes hit it from 8 distractors (merge sort, sort + linear scan, binary search × n times, heap-based selection, naive matrix multiplication, etc.). Trains the *backward-from-complexity* thinking interviewers probe with "can you do better than O(n²)?".
- **Test-cases-first toggle on L3** — when enabled, L3 unlocks the code editor only AFTER the user types ≥3 example test cases (input → expected output pairs). Trains TDD-in-interview mindset.
- **Boss interview (section graduation)** — when user passes all L1 + L2 in a section, surface a 25-min combined-timer mock pulling 3 patterns from that section, mixed/interleaved, no hints. Interview-format reward at section mastery; trains transfer within a section.
- **Re-derive without Reference** — periodically, even on a lesson with passing SR-bucket, surface a "re-derive — no Reference visible" prompt: user must produce L3 from L3.prompt alone with the Reference tab locked. Trains transfer from recognition (Reference visible) to recall (truly blank). **Two trigger shapes:** (a) *manual toggle* — opt-in per session; (b) *automatic at the 30d SR ceiling* — when a lesson hits the longest SR interval, force re-derive instead of just resurfacing; pass extends to 60d+, fail demotes sharply.
- **Adversarial-example trainer** — per pattern lesson, a curated *worst-case input* card: the specific input that breaks the obvious approach (for two-sum: `[3,3], target=6` → identical-element trap; for binary search: `[1,1,1,...,2,1,1,1]` → no monotonic invariant; for sliding window: `[a,a,a,a,...]` → window never shrinks). User drills: "given this input, does the canonical work?" → reveals why. Trains the highest-leverage interview reflex: "what input would break my solution?".

**Cross-cutting concerns:**
- Several § 9A entries (hot-seat, clarifying questions, kickoff ritual) would slot cleanly into Mock Interview as toggles rather than standalone modes — design coherence question for the first vision iter that picks from this category.
- The hot-seat, clarifying questions, and Narrate-and-review entries collectively span audio/text/visual modalities — natural progression: text MVPs first, audio variants once audio infra exists (cross-link Category 8).
- **[iter 36 → resolved iter 73-81]** § 9B "code-reading vs code-writing" direction balance — was tracked here as an unmet gap; **closed** by 🪲 Bug-Hunt (73), 🎯 Reverse (76), 📐 Smell test (79), 🛡 Edge-case chips (81). The category now ships in both directions.
- **[iter 38]** Interview-life integration gap — the catalog and the app today treat interview prep as a *solo, decontextualized activity*. Pre-interview ramp (Cat 2), post-interview gap log (Cat 7), STAR generator (§ 9A), "I'm stuck" simulator (§ 9A), mock-kickoff ritual (Cat 2) collectively introduce *event-embedded* prep. Track whether the loop ships any of these in the next 6 iters; persistent zero would indicate the app is structurally biased toward perpetual-prep over scheduled-prep.

**Shipped from this category:** 🪲 Bug-Hunt (iter 73) · 🎯 Reverse problem-identification (iter 76) · 📐 Smell test complexity-claim (iter 79) · 🛡 Edge case pre-enumeration (iter 81) · 🎤 Clarify-First Ritual (iter 117, **first §9A ship ever** — 34-iter drought broken) · 🔥 Hot-Seat Follow-Up (iter 118, second §9A ship — pairs with Clarify-First to cover both ENDS of interview interaction) → see [`shipped-by-category.md` § 9](shipped-by-category.md#9-interview-conditioning).

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
5. **Don't keep shipped ideas here.** When an idea ships, move its detail to `shipped-by-category.md` and leave at most a one-line summary in the category's "Shipped from this category" footer.

## How `/drill-improve` Step 1 uses this file

When the next ship target isn't obvious from `SELF-IMPROVE.md § Next iteration`:
1. Scan each category's Review trigger.
2. Cross-reference the named rows in `SELF-IMPROVE.md § Last-touched index`.
3. If a category's trigger fires (rows are stale), that category becomes the ship-search scope — pick the highest-leverage parking-lot or active idea from it.
4. If multiple categories trigger, prefer the one whose triggered rows are closest to PROFILE.md's load-bearing claims (mobile L1/L2 > everything else).
5. If no category triggers, fall through to the existing Step 1 mode-selection (likely vision).

The trigger check is bounded: 9 categories × ~3 rows each = ~27 freshness lookups, all derivable from one file. No per-idea state, no coordination overhead.

---

## Promotion shortlist (iter 93, refreshed by iter-92 cleanup)

> **Purpose:** name the top candidates for promotion to `roadmap.md` so a vision iter can pick without re-reading the full catalog. This is a *recommendation surface*, NOT a promotion (vision iter does the actual roadmap.md write with full value-claim/mechanic/success-criterion framing).
>
> **Selection criteria (in priority order):**
> 1. **Mobile-native** (PROFILE 80%-phone) — tap-shaped or short-token surface.
> 2. **No new content authoring** — uses existing 143-lesson × 327-exercise corpus.
> 3. **No BLOCKED dependency** — no PROFILE amendment, no schema migration > `__v: 6`, no instrumentation prereq.
> 4. **Single-iter ship OR 2-iter scaffold+ship** — not a multi-iter epic.
> 5. **Closes a measurable interview gap** OR **fills a category with stale active-list** (Cat 1, Cat 5, Cat 9 all have empty active lists post-iter-92).

**Shortlist (highest leverage first):**

1. **L3 "calculator-style" keyboard chips** *(Cat 5)* — → SHIPPED iter 123 as 🎹 L3 keyboard chips (see [`shipped-by-category.md` § 5](shipped-by-category.md#5-uiux-experience) for ship details). First Cat 5 ship since iter 104 Command Palette; first explicit Review-trigger-driven shortlist consumption.
2. **Code-from-bullet-points** *(Cat 1)* — Reference tab toggle hides canonical, shows `reference.notes` as bullets; user types canonical. Fills the documented L2-to-L3 cell gap ("see concept, recall code"). Cat 1 active list is empty; this restores it. **Currently CATEGORY-SATURATED** — iter-121 Cinema + iter-122 What-If are 2 fresh Cat 1 ships; promote after 4-iter Cat 1 soak.
3. **Whiteboard mode toggle** *(Cat 9 §9A)* — ~30 LOC; strip syntax highlighting + autocomplete + run-button on L3. Trains the realistic-interview surface where tooling is absent. First §9A ship — Cat 9's §9B-only ship history is unbalanced. **Note: iter 117 Clarify-First + iter 118 Hot-Seat are now the first §9A ships — this entry's "first §9A ship" claim is stale; reframe as third §9A ship if promoted.**
4. **PWA install + offline drilling** *(Cat 5)* — `manifest.json` + service-worker pre-cache. Permanent mobile-reach unlock (subway, plane). Single-iter ship + a follow-on Push API iter. **Note: iter 113 Offline Drill Pack already shipped the SW pre-cache half of this entry; remaining scope is the PWA `manifest.json` + install-prompt UX. Smaller than originally framed.**

*(Shortlist consumed: iter-93 #1 → 🍀 Lucky roulette SHIPPED iter 108; iter-93 #5 (Algorithm matcher) → 🔖 Match SHIPPED iter 109; iter-93 #2 (Pattern-family heatmap) → 🌈 Sections SHIPPED iter 111; iter-93 #1 above (L3 keyboard chips) → 🎹 L3 keyboard chips SHIPPED iter 123. 4 of 7 original shortlist items consumed in 15 iters; remaining 3 have category-saturation OR scope-reduction blockers (Code-from-bullet Cat 1 saturated; Whiteboard claim stale; PWA partly already shipped). Vision iter is the right next-step before another shortlist consumption.)*

**Deferred to a second pass (strong but heavier scope OR awaits earlier ship):**
- **Audio mini-explainers per high-leverage lesson** *(Cat 8)* — TTS-only, no input loop; ships independently of BLOCKED Audio Mode. 2-iter (top-20 lessons curation + ship).
- **STAR-format technical story generator** *(Cat 9 §9A)* — bridges to behavioral prep; single-iter but novel surface, bench until §9A is unlocked by #5.
- **Cognitive-load self-rating → SR calibration** *(Cat 3)* — 3-point tap after L3 pass multiplies next SR interval. Schema-additive; ships single-iter but interacts with SR mechanics that deserve a frame iter first.
- **Pre-interview week ramp planner** *(Cat 2)* — date-aware Today's Plan variant. High leverage for users with scheduled interviews but UI/UX is non-trivial (calendar surface, ramp generation rules).

**Category-balance note for the vision iter:** post-iter-92, three categories have empty Active lists (Cat 1, Cat 5, Cat 9) and three have BLOCKED-only Active lists (Cat 2, Cat 3, Cat 7). The shortlist deliberately spreads across Cat 1, 2, 5, 7, 8, 9 — preferring spread over depth to refill the active surfaces. Promote 2-3 of these before re-curating.

---

## Catalog discipline log

This catalog has a deliberate growth-and-prune lifecycle. The discipline logs below preserve the historical trail of how the catalog was tended.

**Iter 35-38 (growth phase):** ~140 parking-lot entries collected across 9 categories from `deep thought` brainstorm cron. The Promotion shortlist mechanism was introduced iter 37 to surface high-leverage candidates without re-reading the catalog.

**Iter 39-41 (consolidation):** entry adds dropped to ~1-3 per iter; iter-41 reorganized Cat 9 into §9A/§9B/§9C sub-themes (28 entries → 26 after one merge). Cap of ~150 parking-lot entries declared.

**Iter 42-44 (no-action):** brainstorm loop produced 0 adds × 3 iters. The loop self-recognized it had converged on the catalog's natural ceiling for that brainstorm prompt.

**Iter 45 (self-stop):** brainstorm cron stopped unilaterally via `CronDelete 96752a5d` per the iter-8 commitment. User can re-create with a directed prompt (consolidate, audit, promote) or `/loop 30m do some deep thought ...` to resume.

**Iter 92 (graduation cleanup — this pass):** ~25 SHIPPED entries migrated out of this file to new sibling [`shipped-by-category.md`](shipped-by-category.md). Two DEMOTED entries (Code-reading speed drill, Pure-flashcard pattern mode) also moved. Each category gained a one-line "Shipped from this category" footer pointing to the sibling file. Stale cross-cutting flags retired (iter-36 §9B-tracking flag closed by 4 iter-73→81 ships). Promotion shortlist refreshed from iter-37 (~55 iters stale) to iter-93 candidates, deliberately spread across categories with empty Active lists. Catalog now ~95 candidate entries (was ~145). The "candidates-only" invariant is restored.

**What WOULD restart productive brainstorming:** a vision iter shipping from this catalog and surfacing new gaps in the process; a real user-interview surfacing a need not on the catalog; a shift in PROFILE.md; a frame iter ratifying one of the BLOCKED PROFILE amendments (which would unblock the 3 iter-26 entries and reshape the catalog's center of gravity).
