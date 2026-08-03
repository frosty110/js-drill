# CLAUDE.md — Project Context

> **Read also: [MIGRATION-NOTES.md](MIGRATION-NOTES.md)** for the 2026-05 refactor
> that split lesson content out of `index.html` and added mobile + syntax-highlight
> work. The "How a lesson is structured" section below reflects the *new* layout.

## Current state (snapshot — refreshed 2026-05-27, app.js split)

- **171 fully-authored lessons** (`status: 'full'`), 0 stubs
- **938 verified L2+L3+walkthrough checks** (all pass via `node tools/validate-data.js`)
- **Lessons may be JavaScript or TypeScript.** A lesson body opts in with `"lang": "ts"`;
  absent the field it's JS. Types are ERASED before execution (the browser lazy-loads the
  TypeScript compiler in `js/core/runner.js`; the validator uses Node's built-in
  `module.stripTypeScriptTypes`). Neither type-checks — the drill grades on output. Only
  erasable syntax is permitted, so `enum` and parameter properties are banned in favour of
  string-literal unions. See [`docs/canonical-style.md`](docs/canonical-style.md) § TypeScript lessons.
- `index.html` is markup only (~430 lines); `app.css` (~3,955 lines) loads via `<link>`
- **`app.js` (13.3k lines) was split into 15 ordered slices `js/app/01..15-*.js`** that
  share global scope and load in order (see § File layout). They are plain
  `<script src>` files (NOT ES modules) — the split is byte-identical to the old
  monolith, done to make each file small enough for an AI/human to read whole.
  Regenerate with `tools/split-app.py`; verify with `tools/cdp/appsplit-smoke.js`.
- Lesson content lives in `data/<section-slug>/<lesson-id>.json`
- `data/manifest.json` is the sidebar index — loaded on boot, lessons lazy-load on click
- Three tracks across 29 sections:
  - **Syntax (44)**: Basics · Arrays · Hash Structures · Modern Syntax · Iterators & Generators · JS Toolbox · Algorithms · Classes · Async · Advanced JS · JS Traps
  - **Patterns (90)**: Arrays & Hashing · Two Pointers · Sliding Window · Stack · Binary Search · Linked List · Trees · Tries · Heap · Graphs · Greedy · Dynamic Programming · Backtracking · Intervals · Matrix · Bit Manipulation · System Design
  - **Applied (37)**: Applied Problems — implementation problems (decks, games, hash maps, throttle/debounce, undo-redo, CSV roll-ups, rules engines, fetch-and-reshape, etc.)

## Standing constraints (read before changing content or adding assets)

**[docs/invariants.md](docs/invariants.md) is the rules doc.** Seven constraints
whose failure mode is invisible — the app stays green and the meaning quietly
becomes wrong. Every one has a gate:

```bash
node tools/check-all.js          # verify every gate
node tools/check-all.js --fix    # regenerate generated output, then verify
node tools/check-all.js --probes # gates, then the durable browser probes (opt-in, needs Chrome, minutes)
git config core.hooksPath .githooks   # once per clone: run them pre-commit
```

The three that bite most often:

1. **Never reorder or delete a question or an option.** Share codes are
   positional — character N is question N, the letter is the option's authored
   index — so a swap silently repoints every URL already shared for that lesson.
   Appending and rewording in place are both safe. Gated by
   `tools/check-content-order.js` against `data/content-order.lock.json`;
   `--accept` re-baselines when a break is genuinely intended.
2. **Regenerate `p/`, `sd/`, `sitemap.xml` after any content change** — the
   output is committed and GitHub Pages serves it from the repo, so stale pages
   ship silently.
3. **Every place the app can put the user is a row in `js/routes.js`**, and the
   app's router consumes that registry rather than restating it. The three
   consumers of our URLs (AI agents the user pastes a link into, their own
   copy-paste, and crawlers) don't run our JS, and a hash fragment never reaches
   the server — so path = identity, query = view state, fragment = position, and
   each row declares `content` (has a static page) or `action` (a personal
   session; declares a fallback). Full contract in
   [docs/url-contract.md](docs/url-contract.md); gated by
   `tools/check-url-contract.js`, which reconciles registry ⇄ router.

CI runs the same command on every push (`.github/workflows/checks.yml`).

## What this project is

A **JavaScript syntax + interview-pattern memorization web app**. No build step —
open `index.html` in a browser (or serve `python3 -m http.server`). Uses Tailwind
CSS and CodeMirror via CDN. Progress persists in `localStorage` under
`jsdrill.progress.v1` (current schema `__v: 5`, load accepts v2/3/4/5; see § State
persistence). Live on GitHub Pages: https://frosty110.github.io/js-drill/

## Features shipped (so future iterations don't re-add them)

- Spaced repetition (1d → 30d intervals)
- Mock interview mode + personal-best times per lesson
- Starter Path (linear recommended sequence, 60+ steps)
- Weak-spot tracker (resurfaces L1 misses)
- Today's plan (curated session: due + path + weak)
- Stats dashboard
- Diff view (compare L3 to canonical)
- Cheatsheet markdown export
- Progress JSON backup/restore
- Session resume (currentLessonId + tab persisted)
- Sticky L3 action bar (the off-canvas mobile drawer that used to sit beside it was retired in design-loop P4 part 3 — `#hamburger` now opens the Browse page; see `initMobileDrawer` in `js/app/14-init-core.js`)
- Multi-tab storage sync
- Search (`/` — focuses Browse's search field when Browse is open, otherwise opens the ⌘K command palette), keyboard nav (`j`/`k` or ↑/↓ = prev/next lesson · `1`-`9` = Nth tab in render order, so up to 6 on Patterns/Applied · `s` = shuffle review · `?` = help · `Esc` = close)
- Letter-labeled MC (A/B/C/D)
- Reveal-tracking (mastered-with-reveal dot variant)
- Hide-mastered filter
- First-time welcome banner with Starter Path CTA
- Syntax-highlighted static code blocks (Reference + L2 templates) via CodeMirror runMode
- Line-wrapping in the L3 editor (mobile-friendly, prevents horizontal scroll)
- **Conversation tab** (opt-in, Patterns + Applied only — **125 of 127 problems lessons carried it at the 2026-08-02 audit**, the gap being `a-eve-double-booking` and `a-eve-largest-files` (audit F21; the earlier "99/99" here had been wrong for a year of content growth). Don't quote a coverage number from this file — measure it: sweep `data/**/*.json` for a `conversation` key over the patterns+applied entries in `data/manifest.json`): 6-section interview-narration walkthrough with say/why color split. Simulates "what would you say in an interview" rather than just showing the canonical.
- **Walkthrough tab** (opt-in, Patterns + Applied only — same coverage and the same two gaps as Conversation above; measure, don't quote): Jupyter-style line-by-line stepper. Pick an example input, scrub through the canonical with current-line highlight and a live state panel. Trace functions are JS generators compiled at runtime via `new Function`; the validator runs every trace on every example and asserts the final `returns` matches the declared `expected` — mechanical regression guardrail.
- **🃏 Flash mode** on Reference tab (iter 35) — cloze-deletion blur-tap on canonical tokens; tap to reveal. The read+recall-no-input recall direction the L1/L2/L3 ladder didn't cover.
- **🔎 Recognize mode** (iter 49) — diagnose-the-pattern speed drill. Shows a random patterns-track `L3.prompt` + 4 SECTION-name buttons; tap the matching family. 10-card session with lifetime stats in Stats modal.
- **⚡ Rapid-Fire L1 stream** (iter 54) — cross-lesson interleaved L1 tap-stream. 20 questions Fisher-Yates-shuffled across all tracks; 7-sec soft timer; streak counter; slowest-3-lessons weak-spot diagnostic; miss → state.weakness.
- **🃏 Reveal Replay** (iter 56) — sidebar button + clean-pass invariant. Routes user to lessons mastered-with-reveal; passing the revealed level without re-revealing clears the flag and demotes the ringed-green dot to plain green. 2.2-sec fuchsia toast confirms.
- **🌅 3-Card Warmup** (iter 57) — mobile micro-session over Today's Plan (due+path+weak). 3-card stack with tap-grade + slide-off animation; bypasses Today's Plan's nav-into-lesson flow by shipping the L1 interaction shell directly inside each card.
- **🏷 Mistake Tagging Postmortem** (iter 58) — opt-in chip strip below L1 miss explain text with 6 tags (off-by-one / wrong method / edge case / semantics / misread / syntax). Tap saves to `state.misses`; Stats modal "Top miss patterns" tile aggregates top-5 across all lessons. First concept-grain miss tracking.
- **📡 At Risk decay radar** (iter 60) — sidebar pill + modal joining `state.weakness ∪ state.revealed` (with `dueAt` enrichment) into a ranked list (due-now first → ascending dueAt → descending weakness → revealed-flag). First surface that intersects three previously-independent state signals.
- **⌚ Mock Replay Reel** (iter 61) — slope-direction badge + tappable cells on the existing L3 trend chip. "↓ X faster vs first" / "→ holding" / "↑ Y slower vs first" via first-vs-last comparison. Per-cell tap reveals attempt index + time + delta-vs-best.
- **📅 Streak Map** (iter 62) — 60-day calendar density heatmap built from `state.history` events. Sidebar button → 9×7 grid; 5-tier color gradient scaled to user's peak day; hover/tap shows date + pass/miss breakdown. Carefully avoids gamification anti-pattern (no streak counts).
- **🧩 Mechanics × Track matrix view** (iter 63) — Mechanics modal gained List ↔ Matrix toggle. Matrix renders mechanic × 3-track grid with mastered/total per cell. Transfer-gap rows (mastered in one track, unmastered in another) float to top with ⚠ marker.
- **💀 Resurrect Queue** (iter 65) — sidebar pill for mastered lessons past 2× their SR interval. Differentiates "due tomorrow" from "due 60 days ago." Tap routes to most-overdue at L2 (touch) or L3 (fine-pointer). Closes the "mastered stays mastered" measurement gap on long-overdue lessons.
- **🧭 Track Balance Compass** (iter 66) — 3-bar widget at top of Stats modal showing % mastered per track + 1-line nudge naming least-covered. Surfaces lopsided allocation (over-grinding one track while neglecting another).
- **🔀 Swap-Bench** (iter 86, expanded iter 87) — pairwise idiom-equivalence drill. Sidebar 🔀 button → 6-card session reading curated `data/idiom-pairs.json` (18 entries as of iter 87, expandable by appending); each card stacks two JS snippets vertically (mobile-first; ≤8 lines per snippet) and asks "Same behavior?". Covers canonical JS confusions: map-vs-for-mutates, for-of-vs-for-in (on arrays), slice-vs-splice, `||`-vs-`??`, Array.fill shared-reference trap, Map-vs-object key types, parseInt-vs-Number, sort-vs-toSorted, `==` vs `===`, async/await vs .then chain, JSON-deep-clone vs shallow-spread, etc. **First surface drilling RELATIONAL retrieval** ("are these two equivalent?") rather than categorical pick-one. Schema-additive `state.swapBench`.
- **🏷 Faceted tag filter over the problems corpus** (2026-05-27; **relocated by design-loop P4 part 3 — read the second paragraph, the first is history**) — 4 facets: **Type** + **Topic** (derived from track/section, no authoring), **Difficulty** (easy/med/hard, authored), **Company** (authored; the registry ships values but **no lesson carries one** — 0/171 at 2026-08-02, audit F17). Faceting is AND-across / OR-within via the `tagMatch` predicate; registry in `data/tags.json`, authored tags on manifest entries, validator-gated. Schema-additive `state.tagFilter`/`state.tagFilterOpen`.
  **Where it actually lives now:** the sidebar drawer this shipped in was retired (D10) and the facets moved into the **Browse** page's collapsible Filter panel, applied by `_browsePool()` in `js/app/19-browse.js` — *not* by `renderSidebar()`. Browse lists lessons under **three track segments (Syntax · Patterns · Applied)**; the 2026-05-27 "Patterns + Applied merge into ONE list, the Type facet recovers the split" model **is not what ships** (audit F25 — this entry claimed it for months after Browse replaced it). Facets still apply to problems-track lessons only; Syntax is never tag-filtered.
- **📊 Dashboard (unified) + deep-link routes** (2026-05-31) — a new top-nav **Dashboard** entry opens ONE scrollable surface merging **daily progress** (today's solved/missed + due/weak counts + today-vs-yesterday delta), a **gamified Activity view** (🔥 current streak, weekly solved/per-day/first-try chips, a 14-day solved-per-day bar chart with green-solved/amber-miss split, and the 60-day consistency heatmap), and the full **mastery/stats** body. Every number is a real rep (PROFILE.md L72 endorses streak/delta "progress at a glance"; L109 only bars gamification that *obscures* readiness — so all stats derive from `_streakMapBuckets`' pass/miss classifier, no hollow points). The standalone Stats and Streak Map modals are retired into it — their hidden buttons (`stats-btn`/`streak-map-btn`) now route to `openDashboard()`. Rendering is shared via module-level `renderStatsInto`/`renderActivityInto`/`renderDailyInto` in `js/app/14-init-core.js`. **(2026-07-10, design-loop P5:** `openDashboard` now delegates to `openProgress` in `js/app/20-progress.js` — the Dashboard rebuilt as the ds-system **Progress** surface (Today snapshot → Activity charts → Fix first → Mastery → More insights), additionally absorbing the At-Risk list; `#at-risk-btn`/`#/m/at-risk` land there too. The legacy renderers remain in 14-init-core.js as delegation fallback.) Alongside it, **every launchable mode is a deep-link route** `#/m/<mode>` (slug = button id minus `-btn`): topbar menu items render as `<a href="#/m/…">` so **cmd+click / middle-click / right-click → "Open in New Tab"** boots a fresh app instance straight into that surface (`_parseHash`/`_dispatchModeRoute` in `js/app/10-render-sidebar-lesson.js`; boot dispatch via `_pendingBootMode`). Plain left-click still opens in place. No new state.
- **🔗 Shareable, crawlable URLs + score codes** (2026-08-02) — every drillable surface now has a stable URL that resolves to a **plain HTML page an AI agent can fetch**, optionally carrying the user's per-question result set. The app is client-rendered behind hash routes, and a fragment never reaches a server, so an agent handed an app URL got an empty shell; `tools/build-share-pages.js` renders the fetchable form — `p/<lesson>/` × 171 and `sd/<topic>/<unit>/` × 58, complete without JavaScript, questions numbered with `#qN` anchors, answer key included, plus a `#drill-data` JSON index. A share link appends `?s=` — one character per question in authored order, **case carrying correctness** (`AbbCdAbC.Yn.n`), so it records *which distractor pulled you*, not merely that you missed. The URL can't be decoded server-side on Pages and doesn't need to be: the page prints the legend, the agent holds the URL, zipping the two is trivial. Built on demand from live state — no share records, no cache, no sign-in, nothing stored server-side. **Copy for AI** adds the code the user actually typed at L3 (too big for a URL, free via the clipboard). Needed a new question-grained record, `state.answers` (schema-additive), because `progress[id].L1='passed'` can't say which option was picked; system design gained `lastOutcome`/`lastPick` on its Leitner boxes for the same reason. Codec in `js/sharecode.js`, surface registry in `js/routes.js`, spec in [`docs/share-urls.md`](docs/share-urls.md). **Never reorder questions or options in a lesson JSON** — appending is safe, reordering invalidates every code ever generated for it.
- **🏠 Home + scoped review** (2026-08-01) — the root URL finally has a front door. `/` used to resume `lastLessonId` (or, for a first-time visitor, drop them inside Basics lesson 1), so the app had no map; now a bare URL boots to **Home** (`js/app/22-home.js`, `#/m/home`) and the resumed lesson is offered as the CONTINUE hero instead of being the screen. Any explicit hash — a shared `#/two-sum/L1`, a `#/m/<mode>` route — still wins. Home shows every drillable surface at three altitudes: the global Continue, three **track cards** (Coding · Syntax · System Design) with mastery meter + due count, and each track expanding into its **subcategories** (29 sections, 4 SD topics) — every row carrying the same two affordances. The two affordances mean exactly one thing each: **Continue** = forward progress (first non-mastered lesson in authored order, at its first unpassed level; a fully-mastered scope's becomes *Refresh*), **⟲ Review** = that scope's repair queue. The ⟲ renders only where there's work. **Scoped review sessions** (`js/app/23-review.js`, `#/m/review/<slug>`) are the new half: `dueReviewIds()` was global-only, so "what's rotting in Trees?" was unanswerable and there was no way to work a queue to the end. A session reuses L1/L2/L3 as-is — SR scheduling, weakness clearing and reveal-flag clearing stay in one place — and owns only the queue, a HUD strip (label · n/N · Skip · Exit) and the advance rule. System Design joins the model via new hash routes on its page plus per-chapter `questions` counts in the topic manifests. Schema-additive `state.homeOpen`.


The app's job is to drill JS syntax and canonical interview-pattern solutions through three escalating recall tests per lesson (plus two opt-in narrative surfaces on Patterns/Applied lessons):

- **Conversation** *(Patterns/Applied only — opt-in)* — 6 collapsible sections of interview narration. Tap a section to expand.
- **Walkthrough** *(Patterns/Applied only — opt-in)* — interactive line-by-line stepper. Pick example, scrub with prev/next, watch state evolve.
- **Reference** — read the canonical code + notes (the thing to memorize)
- **L1 Concept** — multiple-choice on the load-bearing ideas
- **L2 Fill-in** — partial code with blanks to type
- **L3 Drill** — blank CodeMirror editor, type from memory, runner compares output

There are also **Mock Interview mode** (random pattern + timer, no hints) and a **Starter Path** (linear recommended order).

**Tab order**: Patterns/Applied lessons render up to 6 tabs (Conversation → Walkthrough → Reference → L1 → L2 → L3, horizontally scrollable on mobile). Syntax lessons render 4 tabs (Reference → L1 → L2 → L3). Conversation and Walkthrough are independent — a lesson can have both, either, or neither.

**Authoring Conversation / Walkthrough**: see [`docs/conversation-walkthrough.md`](docs/conversation-walkthrough.md) for the full schema, engine internals, per-shape pattern library, and maintenance playbook. Use the `author-conversation` and `author-walkthrough` skills to author for new lessons.

## Who this is for + how it learns

The target user is described in [PROFILE.md](PROFILE.md) — a rusty-but-experienced
software engineer who studies **on a phone ~80% of the time**. That single fact
shifts the design center of gravity:

- L1 (tap) and L2 (short-token typing) are the high-throughput surfaces.
- L3 is the "at-desk" tier; don't optimize the mobile loop around it.
- Every lesson should ship with ≥3 L1 questions and ≥2 L2 exercises so the
  mobile user has enough surface area per lesson.

The app is also an evolving **memorization tool**. The learning-science
principles it encodes — active recall, spaced repetition, interleaving,
retrieval practice, elaboration, etc. — live in
[docs/learning-strategies/](docs/learning-strategies/). When you add a feature
that exploits a learning principle, also add or update its strategy doc.
When you're choosing what to build next, scan the strategy docs for under-
exploited principles. The two coevolve.

The self-improve loop reads [PROFILE.md](PROFILE.md) and
[SELF-IMPROVE.md](SELF-IMPROVE.md) on each iteration and updates the directive
based on what it learned — that's how the app keeps converging on the profile.

## File layout

| File / Dir | Role |
|---|---|
| `index.html` | Main drill app markup — ~430 lines; loads the 15 `js/app/*.js` slices in order |
| `app.css` | Main app styles — ~3,955 lines |
| `js/app/22-home.js` | **Home — the app's front door.** `openHome()` renders the CONTINUE hero, three track cards (Coding = patterns+applied · Syntax · System Design) each with mastery meter + due count + Continue/scoped-Review, expandable into their subcategories (29 sections · 4 SD topics), plus a More list (Today's plan · Practice · Progress · Diagnostic). Also holds the **scope model** (`homeScopeLessons/Stats/ContinueTarget/RepairIds`, scope = `{kind:'area'\|'section', key}`) that Home and the review sessions share, and the read-only System Design rollup (`_sdTopicStats` over `jsdrill.systemdesign.v1` boxes × manifest `questions` counts). Route `#/m/home`. |
| `js/app/23-review.js` | **Scoped review sessions.** `startScopedReview(slug)` builds the scope's repair queue (overdue → due → weak → reveal-flagged, via `buildRepairIndex()`), drops the user into rep 1 at the right level (L2 on touch / L3 on fine pointer for mastered lessons; first unpassed level otherwise), and mounts a HUD strip between the topbar and the stage. Advances on a qualifying pass via the `_reviewOnLevelPass` hook in `markLevelPassed`. Session state is in-memory only. Routes `#/m/review/<scope-slug>` (e.g. `#/m/review/trees`, `#/m/review/all`). |
| `css/11-ds-home.css` | Home page + review-HUD styles (ds primitives only). |
| `tools/cdp/home-nav.js` | Durable probe for the whole navigation flow — boot policy, track cards, subcategory expansion, Continue-vs-Review semantics, scoped review + HUD geometry, deep links, System Design routes. 32 assertions per viewport (mobile + desktop) plus 7 on the system-design page — the probe prints its own `passed/total`, so read that rather than quoting a number here (the "59" that stood here was stale). |
| `js/app/01..15-*.js` | Main app logic (~13.3k lines), split from the old `app.js` monolith into ordered, read-whole-able slices that share global scope. Load order matters; boot/`init()` is in slices 14–15. Named by concern (state-content, util-metrics, paths-cram, progress-sr, drills-*, stats-cheatsheet-mock, render-sidebar-lesson, tabs-ref-conv-walk, levels, mechanics-modal, init-*). |
| `tools/split-app.py` | Regenerates the `js/app/*.js` slices from a monolith; asserts byte-identical concat. Historical/one-shot — kept for reference. |
| `tools/analyze-tool-stats.py` | Mines Claude Code transcripts for per-file AI read/write/churn stats (drove the app.js split). `--json` for machine output. |
| `tools/cdp/appsplit-smoke.js` | Browser smoke test: app boots, all slices load, no exceptions/404s. |
| `SELF-IMPROVE-LEDGER.md` | Append-only history sidecar (Mode ledger + Last-touched index) extracted from `SELF-IMPROVE.md` to keep the active directive small. |
| `diagnostic.html` | 43-question self-diagnostic (standalone page) |
| `system-design.html` | Standalone **System Design** memorization drill (conceptual recall, no code execution). **Multi-topic**: a topic landing → per-topic chapter list → drill. Topics: **DDIA** (12 ch), **The System Design Interview** (framework + estimation, 7 §), **Building Blocks** (components, 7 §), **Canonical Design Problems** (32 worked problems). Two question types: **MC** and **open** ("explain & apply" — reveal model answer + self-grade). A topic manifest can set `ordered:true` (design problems) so its units drill in authored arc order instead of due-first shuffle. Tapping a unit opens a **detail screen** surfacing the authored `keyTakeaways`, followed by a visual study set and drill controls. `data/system-design/infographic-plan.json` plans distinct graphics per lesson; `infographic-sets.json` authors each sheet's description, numbered flow, numbers, priorities, and trade-offs before pixels. All 51 eligible lessons use multi-image sets (183 registered sheets; 123 PNGs committed and 60 awaiting artwork). `drill-infographic-set` renders the ordered lesson set; `drill-infographic` and one shared workspace provide full-screen Fit/100%/zoom/pan/pinch/download. **Diagrams**: content may use legacy singular `diagram` or a `diagrams[]` visual deck. Each deck item is `{id,title,kind,role,takeaway,afterQuestion,code}`. `afterQuestion` attaches each focused visual to the relevant revealed answer. Every canonical design problem deck contains four architecture diagrams (overview, signature mechanism, scale/path, failure/consistency); focused question-level `diagram` request flows remain supported. Mermaid loads from CDN and degrades gracefully. Reuses `ds/tokens.css` + `ds/components.css` + `js/storage.js`; Leitner SR under `jsdrill.systemdesign.v1`. Design problems are grouped into **7 transferable-mechanism families** with a faceted **Filter** panel (see `data/system-design/tags.json`); chapter ids are permanent while display order comes from `parts[]` via `displayNum`. The topic hero reports **unit** mastery ("N of 32 problems") with the question count as a labeled sub-line. A **study-plan strip** below the hero offers time-budgeted routes through the problems (see `data/system-design/plans.json`) in two labeled rows — authored budgets, then the tag-derived company loops. Deep-linkable: `#/<topic>`, `#/<topic>/<unit>`, `#/<topic>/mixed`, `#/<topic>/tag/<facet>/<value>`, and `#/<topic>/plan/<planId>` (company plans are the two-segment `plan/company/<name>`). |
| `assets/system-design/infographics/` | 123 committed static PNG infographics plus 60 registered sheets for `p18`–`p32` awaiting artwork, grouped by `<topic>/<lesson>/<graphic>.png`. Each lesson has 2–5 focused portrait sheets so complex read, write, failure, and consistency paths are not compressed into one image. |
| `tools/build-system-design-infographic-sets.js` | Rebuilds pending study copy from reviewed lesson takeaways, diagram captions, explanations, and interview rubrics while preserving every registered static artwork set. |
| `tools/generate-system-design-infographic-sets.js` | Renders pending sheets as hand-lettered chalkboard architecture PNGs using topology-specific maps, sequences, comparisons, recovery loops, and partition diagrams; requires Inkscape + ImageMagick and the licensed Caveat font in `tools/fonts/`. Reviewed sheets are locked with `artwork` metadata. |
| `tools/print-infographic-image-prompts.js` / `tools/install-generated-infographics.js` | Build content-specific prompts for high-detail generated artwork, then normalize accepted PNGs and register their exact dimensions without exposing them to deterministic regeneration. |
| `tools/generate-system-design-infographics.js` | Compatibility renderer for an unregistered legacy single-image lesson; all current eligible lessons are registered multi-image sets. |
| `data/system-design/topics.json` | Registry of system-design topics (`id`, `icon`, `title`, `kind`, `blurb`) that the landing page enumerates. Add a topic by appending here + creating its `<id>/` dir. |
| `data/system-design/<topic>/` | Per-topic content — `manifest.json` (`parts[]` + `chapters[]`, with optional `unitLabel`/`unitAbbrev`) + per-unit files (`chNN`/`sNN`/`cNN`.json). Each unit's `questions[]` mixes `type:"mc"` (4 options + `answer` index + `explain`) and `type:"open"` (`prompt` + `points[]` rubric + model `answer`). `ddia/AUTHORING-BRIEF.md` + `OPEN-QUESTION-BRIEF.md` document the schema/quality bar. Gated by `tools/validate-system-design.js`. |
| `data/system-design/tags.json` | **Faceted tag registry for Canonical Design Problems** — the system-design sibling of `data/tags.json`. 5 facets: `mechanism` + `difficulty` + `company` (AUTHORED on manifest chapter entries under `tags`, so filtering works before any unit file is fetched) and `family` + `length` (DERIVED from the part name and the `questions` count — no authoring). AND-across / OR-within, same as the main app's Problems filter. Registry-closed: the validator rejects an authored value that isn't listed here, which is what stops near-synonyms accumulating. `mechanism` is the cross-family transfer index — every problem carries 2–4, and a chip on the unit-detail screen deep-links to `#/design-problems/tag/mechanism/<value>` ("what else solves it this way?"). |
| `data/system-design/plans.json` | **Study plans for Canonical Design Problems** — ordered subsets with a declared time budget, the answer to "I have 45 minutes, what do I drill?". Mirrors `data/paths.json` rather than inventing a parallel concept. A plan is a ROUTE through units, never a copy: progress is keyed by UNIT id and derived from Leitner state, so switching or abandoning a plan can never reset mastery, and only the cursor (`activePlan {id,index,startedAt}`, schema-additive) is persisted. `units:"*"` = every unit in `parts[]` curriculum order; `mode:"crux"` runs only each unit's `crux:true` questions. **Company plans are not authored here** — they are generated from the `company` tag via `companyPlans.minUnits`, so tagging one more problem grows every relevant loop for free. Gated by `validatePlans()` in `tools/validate-system-design.js`. |
| `tools/validate-system-design.js` | Structural validator across all system-design topics (topics↔manifest↔disk parity, part coverage **exactly once**, authored tags against `tags.json`, study plans against real unit ids (and crux plans against units that actually have crux questions), question/diagram/spec schema, complete 36-lesson infographic plan, authored set schema/count/order, and exact registered PNG paths/dimensions). A plan entry may set `"pending": true` to skip-and-count its PNG check — shipped but deliberately unused, since a missing sheet is meant to fail hard. |
| `tools/cdp/sd-graphic-route.js` | Durable probe for the study-sheet route — opening a PNG moves the URL to `#/<topic>/<unit>/graphic/<sheetId>`, the hash names the image actually on screen, closing restores the unit URL, a pasted deep link opens that exact sheet, and an unknown sheet id degrades to the unit. 11 assertions. |
| `tools/cdp/sd-plans.js` | Durable probe for the study plans — strip layout (budgets row + company row), generated company sets honouring `minUnits`, `"*"` resolving in curriculum order, HUD label · n/N, crux as a strict subset, Skip/Resume/Exit, cursor surviving a reload, the null tombstone on drop, progress staying derived (abandoning a plan can't reset mastery), plan + two-segment company deep links, unknown-plan degradation, `appliesTo` scoping, mobile+desktop geometry. 59 assertions. |
| `tools/cdp/sd-tags-nav.js` | Durable probe for the design-problems taxonomy + faceted filter — 7 mechanism families, unit-level hero rollup, contiguous `displayNum` over non-sequential ids, chip rows, AND/OR filter semantics, empty state, tag deep links, other-topic isolation, mobile+desktop overflow. 39 assertions. |
| `data/paths.json` | Study-path registry. `kind:'lessons'` (Starter Path) drives the curated Today's Plan; `kind:'cram'` (e.g. 4-Day Interview Cram) carries `days[].blocks[].tasks[]` and `startIso` so Today's Plan renders a day-by-day acquisition view in the main app. |
| `ds/tokens.css` | **Single source of truth** for design tokens across the user-facing pages (colors, radii, type). The redesign's `--ds-*` roles PLUS the legacy `--bg`/`--panel`/`--accent`/… aliases (merged in from the retired root `tokens.css`, design-loop P8/D04). See `.claude/skills/ui-consistency/`. |
| `ds/components.css` | **Single source of truth** for reusable UI primitives — page frame (`.ds-page`/`__head`/`.ds-section`), button, card, chip, row, stat, field, MC option, switch, segmented, progress, sheet/scrim, adaptive nav, empty state, skeleton. Built only from `ds/tokens.css`; contains no app selectors (D04). |
| `ds/icons.js` | The stroke line-icon set — `dsIcon(name, px)` + `DS_MODE_ICONS`. Emoji is banned from chrome (D07); add new glyphs here, never inline a one-off `<svg>`. |
| `ds/gallery.html` | Visual catalog of every primitive in both themes. Open it before building anything new. |
| `docs/ui-ux-guide.md` | **The UI/UX law** — ten rules, page frame, navigation + launcher contract, state/empty/error patterns, feedback hierarchy, number/chart rules, motion, z-layer ladder, a11y floor, checklists, measured legacy debt. Enforced via `.claude/skills/ui-consistency/`. |
| `tools/cdp/ds-page-frame.js` | Durable probe: page-frame + nav invariants across Today/Browse/Progress at 390px and 1280px (one `<h1>`, shared column, `.ds-section`, no h-scroll, ≥44px nav, truthful `aria-current`). Append a row to `PAGES` when you add a destination. |
| `js/sharecode.js` | **The share-code codec** — per-question result set ⇄ compact URL-safe string. One character per question in AUTHORED order; case carries correctness (`A`=picked option 0 and right, `a`=picked option 0 and wrong, `Y`/`p`/`n`=self-graded, `-`=unattempted). Every character is self-describing, so a decoder needs no schema. Runs in the browser and under Node. **The character table lives here and nowhere else.** See [`docs/share-urls.md`](docs/share-urls.md). |
| `js/routes.js` | **The addressable-surface registry** — one row per PLACE the app can put the user, each declaring `content` or `action`. `parseAppHash()` inverts `appHash()`, so `system-design.html`'s router is an adapter over this table rather than a second parser. Governed by [`docs/url-contract.md`](docs/url-contract.md), invariant 7 — one row per surface (static share path, live-app hash, path parser, sitemap flag). Share URLs, backlinks, parsing and `sitemap.xml` all derive from it, so adding a crawlable surface is a one-line change. |
| `js/share-page.js` | Progressive enhancement on the generated static pages: decodes `?s=`, marks the picked option inline, renders a results table, and flags rows whose code contradicts the current content ("code out of date") instead of reporting a false verdict. |
| `tools/build-share-pages.js` | Renders the crawlable pages — `p/<lesson>/` (171), `sd/<topic>/<unit>/` (58), `sd/<topic>/<unit>/<sheet>/` (183 study sheets — the JS-free twin of the app's `#/…/graphic/<id>` route), indexes, `sitemap.xml`, `robots.txt`. Also maintains the **agent bridge** inside `index.html` and `system-design.html` between `<!-- agent-bridge:start/end -->` markers — the no-JS fallback telling a fetcher how to turn a `#/…` route into a path. Output is **committed** (Pages serves from the repo); `--check` fails when it's stale. Run after any content change. |
| `p/`, `sd/`, `sitemap.xml`, `robots.txt` | **Generated — do not hand-edit.** The static, no-JavaScript form of every lesson and system-design unit. This is what an AI agent or a crawler actually fetches. |
| `js/storage.js` | **Single source of truth** for localStorage I/O across pages. Exposes `window.DrillStorage`. See `.claude/skills/ui-consistency/`. |
| `js/supabase-config.js` | Supabase project URL + anon key. Anon key is public-by-design; RLS protects data. |
| `js/supabase-client.js` | Initializes `@supabase/supabase-js` v2 client. Exposes `window.SupabaseClient`. No-op if config missing. |
| `js/sync.js` | Optional cross-device sync. Exposes `window.DrillSync` (auth + push/pull/per-field merge) + a fixed top-right Sync chip. Skipped at runtime if sync is unavailable. |
| `supabase/migrations/` | SQL migrations (run via Supabase Dashboard → SQL Editor). |
| `data/manifest.json` | Sidebar index — `{sections: [{name, slug, lessons: [{id,title,track,status,tags?}]}]}`. `tags:{difficulty,company[]}` (authored facets) live here, beside track/status, so the faceted filter works at boot before lesson bodies lazy-load. |
| `data/tags.json` | Faceted-filter registry for the merged Problems list (Patterns+Applied). 4 facets: `source`(Type) + `topic` derived from track/section (no authoring); `difficulty` + `company` authored on manifest entries. Add a company by appending a value here. Validator enforces authored values against this registry. |
| `data/<section-slug>/<lesson-id>.json` | One JSON per lesson — the source of truth for content |
| `MIGRATION-NOTES.md` | Goals, principles, learnings from the multi-file refactor |
| `js/core/runner.js` | Sandboxed code runner (`window.DrillRunner`). Erases TypeScript types for `lang:"ts"` lessons by lazy-loading the TS compiler on first use, then executes via `new Function`. Mirror semantics in `tools/validate-data.js`. |
| `docs/invariants.md` | **The rules doc** — the six standing constraints whose failure mode is invisible (positional share codes, committed generated output, offline precache parity, sync key coverage, single-source-of-truth ownership, executable lesson content). Each names its gate and its escape hatch. |
| `tools/check-all.js` | Runs every gate in one command; `--fix` regenerates first. What `.githooks/pre-commit` and `.github/workflows/checks.yml` both run — that default must stay browser-free. `--probes` adds the durable CDP suite (`PROBE_SUITE`) with a pass/fail line per probe; opt-in, needs Chrome on `:9222`, takes minutes. Run it before shipping anything user-facing. |
| `tools/check-content-order.js` | Locks authored question/option order into `data/content-order.lock.json` — fails on reorder/removal, allows append and in-place rewording, `--accept` re-baselines. Also gates the ≤8-option share-alphabet ceiling. |
| `tools/check-sw-shell.js` | Asserts `service-worker.js`'s `APP_SHELL` covers every local asset `index.html` loads (and vice versa). A gap breaks offline users only. |
| `tools/validate-data.js` | Runs every L2 fill + L3 canonical, diffs manifest vs disk, gates banned syntax and walkthrough trace line ranges. Erases TS types via Node's built-in stripper. Run before commits. |
| `tools/cdp/check.js` | Probes a deployed URL via Chrome's :9222 port (basic) |
| `tools/cdp/deep-check.js` | Multi-tab + multi-lesson navigation probe with screenshots |
| `tools/cdp/mobile-l3.js` | iPhone-viewport probe for the L3 editor + sticky action bar |
| `tools/migrations/extract.js` | Historical one-shot — pulled CONTENT out of `index.html` |
| `tools/migrations/refactor.js` | Historical one-shot — surgically refactored `index.html` |
| `tools/README.md` | Tool inventory + run instructions |
| `README.md` | User-facing intro |
| `PROFILE.md` | Target user profile — drives every product decision |
| `SELF-IMPROVE.md` | Self-improve loop directive — evolves with each iteration |
| `docs/canonical-style.md` | **Authoring style guide** — which idiom (`for` vs `.map`/`.reduce` vs …) belongs in `reference.code` / `L3.canonical` for each problem shape. Read before writing a new lesson canonical. |
| `docs/l1-distractor-quality.md` | **L1 wrong-answer guide** — rubric for strong vs weak multiple-choice distractors, with before/after exemplars. Read before authoring or rewriting any `L1.questions[*].options`. |
| `docs/learning-strategies/` | Learning-science principles the app should encode. Co-evolves with features. |
| `docs-archive/` | Older `claude.md`, `AGENTIC_*.md`, `ARCHITECTURE.md`, plus `old-scripts/` (broken pre-refactor helpers) — historical only |

## Shared UI + storage contract (the user-facing pages)

> **The full UI/UX law is [`docs/ui-ux-guide.md`](docs/ui-ux-guide.md)** —
> the ten rules, the page frame (`.ds-page`), the navigation + launcher
> contract, state/empty/error patterns, the z-layer ladder, the a11y floor,
> the review checklists, and the measured legacy debt. Its enforceable short
> form is the `.claude/skills/ui-consistency/` skill; **load that skill before
> building any UI.** The section below is the storage/asset half of the same
> contract.

The project ships three user-facing HTML pages — `index.html`,
`system-design.html`, and `diagnostic.html`. (Pre-2026-05, a fourth page
`prep.html` housed the 4-day interview prep dashboard; it was dissolved into
the main app as a `kind:'cram'` study path consumed by Today's Plan.) They
share an audience, a visual language, and a localStorage origin. To prevent
drift (which bit us in iter-35):

- **Page layout** → `.ds-page` / `.ds-page__head` / `.ds-section` from
  `ds/components.css`. Every full-page destination uses the same frame — one
  `<h1>`, one column width (`--ds-page-w`), labeled sections. Verified by
  `node tools/cdp/ds-page-frame.js`.
- **Colors / radii / type** → `ds/tokens.css` (root `tokens.css` was merged in
  and deleted, P8/D04). Prefer the `--ds-*` roles; the legacy `--bg`/`--panel`/
  `--accent`/… names still resolve (aliases). Don't redeclare tokens in a page's
  `:root`. Don't hard-code hex in component styles. Add new tokens here.
  Reusable component primitives (buttons, cards, MC options, sheets, switches)
  → `ds/components.css`.
- **localStorage I/O** → `js/storage.js`, exposed as `window.DrillStorage`.
  Don't call `localStorage.getItem/setItem` directly. Use `loadAppProgress`,
  `loadDiagnostic`, the bridge helpers (`isLessonFullyDone`,
  `setMainLastLessonId`), etc. `loadPrepState`/`savePrepState` are retained
  for historical `jsdrill.prep.v1` blobs but no live page writes them anymore.
- **Static code blocks** → CodeMirror `runMode` (Dracula theme). Same scripts
  as `index.html` head.
- **Cross-device sync** → `js/sync.js`, exposed as `window.DrillSync`. Optional
  layer that mirrors all four localStorage blobs (`jsdrill.progress.v1`,
  `jsdrill.prep.v1`, `jsdrill.diagnostic.v1`, `jsdrill.systemdesign.v1`) to
  Supabase when the user signs in (email OTP). One Postgres row per user holding
  `{ progress, prep, diagnostic, systemdesign }` (plus an optional `resetAt`
  authoritative-write marker) as JSONB. Every page that already includes
  `js/storage.js` should also include
  the four sync scripts in this order: `@supabase/supabase-js` (CDN) →
  `js/supabase-config.js` → `js/supabase-client.js` → `js/sync.js`. The script
  auto-mounts a fixed top-right "Sync" chip. App behavior is unchanged when the
  user is signed out or `SUPABASE_CONFIG` is empty — sync is purely additive.
  Per-blob, per-field merge policies live in the header comment of `js/sync.js`
  (set-additive fields union per-id; lifetime counters merge MAX for idempotence;
  device-state scalars prefer local). When
  you add a new sub-blob or change a merge rule, update both `js/sync.js`'s
  header docs and `tools/cdp/sync-merge.js` (unit tests for every rule), and a
  new `saveProgress` field must be registered in one of `js/sync.js`'s three
  key registries — `node tools/check-sync-coverage.js` enforces the parity.

Before authoring a new page or adding a feature that touches state or styles,
**run the `.claude/skills/ui-consistency/` skill** — it documents the
contract, the "don't reinvent" checklist, and the iter-35 incident that made
this enforcement necessary.

## How a lesson is structured (post-refactor)

Each lesson is a standalone JSON file at `data/<section-slug>/<id>.json`:

```jsonc
{
  "id": "two-sum",
  "title": "Two Sum (hash map)",
  "section": "Arrays & Hashing",
  "track": "patterns",           // or "syntax"
  "status": "full",              // or "stub"
  "lang": "ts",                  // OPTIONAL — omit for JavaScript (the default).
                                 // "ts" means every code string below is TypeScript;
                                 // types are erased before running. Erasable syntax only
                                 // (no enum / parameter properties) — see canonical-style.md.
  "description": "One sentence describing the lesson.",
  "reference": {
    "approach": "Hash map (one-pass complement lookup)",   // OPTIONAL — short name of the canonical approach. When present, renders as a primary header row above the code block, mirroring the alternate-summary layout (label + complexity chip).
    "complexity": "O(n) / O(n)",                           // OPTIONAL — same "O(time) / O(space)" format as alternates. Renders in a yellow chip with a "time / space" legend above the values.
    "code": "// canonical code as a string\n...",
    "notes": ["Gotcha 1", "Gotcha 2"],
    "alternates": [                  // OPTIONAL — see § Alternate solutions below
      {
        "label": "Min-heap (k-way merge)",
        "when": "If your language ships a heap (Python heapq, Java PriorityQueue)…",
        "complexity": "O(N log k) / O(k)",
        "code": "// full runnable snippet ending in console.log(...) matching L3.expectedOutput",
        "notes": ["…", "…"]
      }
    ]
  },
  "L1": { "questions": [
    { "q": "Question?", "options": ["a","b","c","d"], "answer": 1, "explain": "optional" }
  ]},
  "L2": { "exercises": [
    { "prompt": "...", "template": "// JS with ___ where blanks go\nconsole.log(x);",
      "blanks": [{ "answer": "word", "hint": "optional" }],
      "expectedOutput": "exact console output" }
  ]},
  "L3": {
    "prompt": "One-sentence challenge",
    "expectedOutput": "exact output",
    "canonical": "// full working solution",
    "hints": ["hint 1", "hint 2"]
  }
}
```

Also add the lesson to `data/manifest.json` under the right section (id, title,
track, status). Section slug is `lowercase + & → 'and' + non-alnum → '-'`.

A lesson is **authored** (`status: "full"`) only when:
1. The `L2.exercises[*].template` filled with each `blanks[*].answer` produces the `expectedOutput` exactly.
2. The `L3.canonical` produces the `L3.expectedOutput` exactly.
3. The `reference.code`, every `L2.exercises[*].template`, and `L3.canonical` use idioms matching the problem shape per [`docs/canonical-style.md`](docs/canonical-style.md) — the validator enforces the banned-syntax list (`do/while`, `with`, `var`, labeled break, comma operator, `void`); idiom-shape choices are reviewer-enforced.
4. Every `L1.questions[*].options` wrong answer passes [`docs/l1-distractor-quality.md`](docs/l1-distractor-quality.md) — no tautology distractors ("Style", "Performance"), no obvious nonsense ("Required by JavaScript"), no invented APIs, no restatement of the answer. Reviewer-enforced.

**For Patterns/Applied lessons with `conversation` and/or `walkthrough` blocks**, additional validator gates fire:
4. Conversation: `sections.length >= 3`, every section has a `title` and at least one body field (`say` | `why` | `reveal` | `examples`). Voice quality is reviewer-enforced.
5. Walkthrough: `trace` (stored as array of source lines) must compile via `new Function`; must run on every example without throwing; if `expected` is declared on an example, the final `state.returns` must match (string-compare). See [`docs/conversation-walkthrough.md`](docs/conversation-walkthrough.md) for the full schema, input-shape patterns (multi-arg, class-based, linked-list, tree, async), and per-shape pattern library.

**For lessons with `reference.alternates`** (optional):
6. Each alternate must have `label` + `code`; `when`, `complexity`, `notes` are optional but recommended.
7. The validator runs each alternate via `runCode` and asserts its output matches `L3.expectedOutput` — alternates solve the same problem with a different idiom, so the contract is identical to L3.
8. Banned-syntax scan extends to `alternates[*].code`.

### When to add an alternate

Add a `reference.alternates` entry only when **the conversation tab already names a second pattern as a real interview choice** (e.g. min-heap vs pairwise divide-and-conquer for merge-k-lists; recursive vs iterative for reverse-linked-list; bucket sort vs heap for top-k-frequent). The rule: an alternate must be something the user would write as their primary interview answer in a different setting, *not* a worse-version-shown-pedagogically (brute force solutions belong in the conversation prose, not in alternates).

Schema notes:
- `complexity` renders as a one-line chip badge. Use the shorthand `"O(Time) / O(Space)"` (e.g. `"O(N log k) / O(k)"`). Keep it under ~25 chars so it fits without truncating the label on desktop.
- `when` is a 1-2 sentence prose context — when would a candidate pick this over the primary canonical. This is where language-ergonomics or input-shape signals belong (e.g. "If your language ships a heap…", "Streaming input or `k << N`…").
- `notes` are 3 short bullets, each a specific insight the user wants at the moment they're scanning the alternate (not a restatement of the prose `when`).

The alternate's `code` must end with a `console.log(...)` matching `L3.expectedOutput` — the validator runs it like L3.canonical.

## Adding a new lesson — the workflow

1. Pick the section slug (e.g., `arrays-and-hashing`). Create
   `data/<slug>/<lesson-id>.json` with `"status": "stub"`.
2. Author the body. Use `\n` in JSON strings for newlines.
3. Add an entry under the right section in `data/manifest.json` with `"status": "stub"`.
4. Verify:
   ```bash
   node tools/validate-data.js
   ```
   This runs every L2 fill + L3 canonical against the same runner semantics the
   app uses, and flags any manifest/disk drift. Must show `184 passed, 0 failed`
   (or whatever the new total is — it scales with lessons).
5. Flip both the file's `"status"` and the manifest entry's `"status"` to `"full"`.
5b. Regenerate the crawlable share page for it:
   ```bash
   node tools/build-share-pages.js
   ```
   The `p/<lesson-id>/index.html` output is committed — Pages serves it from the
   repo, so a new lesson has no shareable/crawlable page until this runs.
   **Append questions and options, never reorder existing ones**: share codes
   are positional against authored order (see [`docs/share-urls.md`](docs/share-urls.md)).
6. Open `index.html` in a browser (via `python3 -m http.server 8765`) — the lesson
   appears with its status dot.

## Runner semantics — critical for `expectedOutput`

`runCode(code)` runs the string via `new Function('console', code)` with a fake
console. It is **async** and awaits any returned promise plus one macrotask, so
`(async () => { ... })()` IIFEs work. (Same semantics in `validate-data.js`.)

Argument formatting:
- strings → as-is
- numbers / booleans → `String(x)`
- null → `"null"`, undefined → `"undefined"`
- objects / arrays → `JSON.stringify(x)`

Output joining:
- Multiple args in one `console.log(a, b)` → joined by a single space (`"1 2"`)
- Multiple `console.log` calls → joined by newline

So `console.log([1, 2])` produces `"[1,2]"`, and `console.log("hi")` produces `"hi"` (no quotes).

## Common authoring pitfalls

- **JSON strings: escape backslashes and quotes**. Newlines are `\n`. Tabs are `\t`.
  Tab character in templates expands per `tab-size: 2` CSS.
- **HTML entities (`&lt;`, `&gt;`, `&amp;`) are not auto-decoded** in code. Write
  `<`, `>`, `&&` literally inside JSON strings (the JSON parser keeps them as-is).
- **`___` is the blank marker** in `L2.exercises[*].template`. The runner uses
  split-and-rejoin so a user-typed `___` can't misroute, but don't put literal
  `___` inside templates outside of blanks.
- **Async code**: use `Promise.resolve(value).then(...)` or `(async () => { ... })()` patterns.
  Real `setTimeout` delays may exceed the runner's single-macrotask drain.
- **Don't edit `CONTENT` / `CURRICULUM` inline in `index.html` anymore** — those
  globals are now populated from `data/`. Edit the JSON files instead.

## State persistence

All user state lives in a single `localStorage` entry under key
`jsdrill.progress.v1`. There is no server, no cookies, no IndexedDB.

### Scope (important — surprises users)

`localStorage` is **per-origin, per-browser, per-device**:
- Drilling on your laptop in Chrome and on your phone in Safari → **two
  entirely separate progress stores**. Nothing syncs between them.
- Same browser, different origins (`file://`, `http://localhost:8765`,
  `https://frosty110.github.io`) → also separate stores.
- Incognito / private windows → ephemeral; cleared when the last private
  tab closes.
- "Clear site data" / "Clear history" in browser settings → wipes the entry.

Cross-device sync is a known want (BS-10 in `SELF-IMPROVE.md`). Until
that ships, the laptop and phone are independent drill journeys.

### Schema

Current save version is `__v: 5`. The load handler accepts `__v` 2, 3, 4,
or 5 — older shapes are backfilled (e.g. v<4 lessons with `L1+L2+L3=passed`
get seeded with the first SR interval so spaced-rep works for legacy
users). The save (`saveProgress` in `js/app/04-progress-sr.js`) writes:

```js
{
  __v: 5,
  progress: { [lessonId]: { L1?: 'passed', L2?: 'passed', L3?: 'passed' } },
  bestTimes: { [lessonId]: ms },                      // mock-interview best time
  mockHistory: { [lessonId]: [ms, ms, …] },           // last 5 mock attempts
  revealed: { [lessonId]: { [level]: true } },        // reveal-tracking dot variant
  lastLessonId, lastTab,                              // session resume
  starterPath: bool,                                  // path-mode toggle
  welcomed: bool,                                     // first-time banner dismissed
  hideMastered: bool,                                 // sidebar filter
  reviews: { [lessonId]: { lastPassedAt, interval, dueAt } },  // SR schedule
  weakness: { [lessonId]: bool },                     // L1-miss tracker
  sidebarTrack: 'syntax' | 'patterns' | 'applied',    // last-selected track tab
  homeOpen: { [areaKey]: bool }                       // Home: which track cards are expanded
}
```

Add-a-field is forward-compatible (load reads missing keys as undefined →
defaults). A schema *removal* or *rename* requires bumping `__v` and
adding a migration branch.

### When saves fire

`saveProgress()` is called after every meaningful state change — 24+ call
sites across the `js/app/*.js` slices. Examples: L1 answer click, L2 fill submit, L3 pass,
reveal click, lesson nav, tab change, modal toggles, starter-path toggle,
hide-mastered toggle, mock-interview start/end, progress restore.

You should never need to call it explicitly from new code — the existing
write paths already cover the actions a user takes. If a *new* state
field is added, mirror it in both `loadProgress` and `saveProgress`.

### Debugging a "data isn't persisting" report

Run this in the browser DevTools console on the same origin the user is
on, before and after the suspect action:

```js
JSON.parse(localStorage.getItem('jsdrill.progress.v1'))
```

If the value changes between the before/after, persistence is fine —
the bug is in the read/render path (e.g. UI not refreshing from state).
If the value does NOT change, save isn't firing — grep for the action's
handler across `js/app/*.js` and check whether it calls `saveProgress()`.

Common false-alarm causes a user might report:
- **Different origin between sessions** — they tested on
  `http://127.0.0.1:8765` once and `http://localhost:8765` next time;
  those are separate `localStorage` stores even though the file is the same.
- **Private/incognito mode** — clears on tab close.
- **Browser site-data cleanup** — Safari ITP, "Delete cookies on close",
  privacy extensions.
- **Different device** — see § Scope above.
- **Hard refresh expectation** — refresh does NOT reset localStorage; if
  they think it should, they're confusing it with sessionStorage. Reload
  preserves data.

## Local dev + deploy

```bash
# Serve locally — file:// won't work because of the fetch() calls.
python3 -m http.server 8765
# Open http://127.0.0.1:8765/

# Validate all exercises + manifest/disk parity
node tools/validate-data.js

# Regenerate the crawlable share pages — REQUIRED after any content change,
# because the output is committed and GitHub Pages serves it from the repo.
node tools/build-share-pages.js
node tools/build-share-pages.js --check   # fails if the committed output is stale
node tools/test-sharecode.js              # share-code codec + route registry

# Offline-pack parity — run after adding ANY script or stylesheet to index.html.
# A missing APP_SHELL entry breaks only offline users, so it never shows locally.
node tools/check-sw-shell.js

# The durable browser probes as a suite, with a pass/fail line per probe.
# Run before shipping anything user-facing; takes minutes and needs Chrome.
node tools/check-all.js --probes

# Drive Chrome at :9222 (start with: open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-jsdrill)
node tools/cdp/deep-check.js http://127.0.0.1:8765/ /tmp/shots
node tools/cdp/mobile-l3.js  http://127.0.0.1:8765/ /tmp/shots
```

Deployment is GitHub Pages off `main` — just push to deploy. Pages refresh takes
~30–90 seconds; poll for the new content (e.g., grep for a unique string from
the new commit) before running the CDP probe against the live URL.

## Commit message convention

Every commit subject is prefixed with a category tag so `git log` is searchable
by impact type. The killer use case:

```bash
git log --grep="^\[product" --oneline -20    # recent user-facing improvements
```

### Subject format

```
[<category>] <one-line summary>
```

For commits that genuinely span categories, list the *primary* tag first:

```
[<primary>] [<secondary>] <summary>
```

For loop-driven iterations, the iter+mode marker goes inside the summary so
the meta-loop's framing stays intact:

```
[<category>] iter N (mode): <summary>
```

### Categories

**Product — anything a drilling user can notice.** Tag this when the change
affects what the user sees, reads, or interacts with on the live URL.
- `[product/feature]` — net-new functionality (a new mode, a new tracker, a new surface). Use when "the app does something it didn't do before."
- `[product/content]` — new lessons, new L1 questions, new L2 exercises, new sections, or substantive expansion of an existing lesson's surface. Use when "there's more to drill than before."
- `[product/ux]` — refinement to an existing feature: copy changes, CTA reordering, sidebar sort, banner refresh, layout tweaks. Use when "an existing feature got better but the feature set didn't grow."
- `[product/fix]` — bug fix the user would notice (crash, broken interaction, wrong content shown, mobile overflow). Use when "something the user could have hit is now fixed."

**Multi-iter feature subtypes** (added iter 24 to support `roadmap.md`-driven
big features that don't fit one atomic iter — see `.claude/skills/drill-improve/SKILL.md`
Step 3): a single roadmap entry may span up to 3 iters using these in sequence:
- `[product/feature-scaffold]` — skeleton + flag-gate; user-facing surface hidden behind a feature flag.
- `[product/feature-wire]` — state, handlers, persistence; still flag-gated.
- `[product/feature-ship]` — UI complete, flag removed, mobile probe green; the feature lands for users.

Each iter in the sequence must independently pass the validator and `## Product
impact` describes the *intended* user-facing change (consistent across the 3
commits) plus what specifically landed in *this* iter.

**Engineering — internal, no direct user impact.** Tag this when the change is
invisible to the drilling user.
- `[engineering/tooling]` — validator, CDP probes/helpers, `tools/` scripts, `.gitignore`, build helpers. Use when "the way we build, verify, or deploy changed."
- `[engineering/meta]` — loop framework (`.claude/skills/`, `SELF-IMPROVE.md`), `iter-artifacts/`, planning docs that drive future iterations. Use when "the way we plan or evaluate the next iteration changed."
- `[engineering/refactor]` — code reorganization with no behavior change, file moves, dead-code removal, type/lint cleanup. Use when "the code is the same, just cleaner."
- `[engineering/docs]` — `README.md`, `CLAUDE.md`, `PROFILE.md`, `docs/learning-strategies/`, in-code comments. Use when "the project's documented understanding changed."

### Body format

For any `[product/*]` commit, the body **MUST** include:

```
## Product impact
<one-sentence user-facing description — what the drilling user notices and why it helps>
```

That single line is the durable record. It's what `git log --pretty` queries
will surface to answer "what shipped that helps users?"

Other labeled sections, use as relevant:

```
## Engineering
<implementation notes — files, technical approach, tradeoffs>

## Verification
<validator output, CDP probe results, manual test notes>
```

For loop iterations, keep the iter-and-mode + Challenge-the-focus + Learning
framing already established by the drill-improve skill — those live inside
or alongside the labeled sections, not replacing them.

### Multi-category example

```
[product/content] [engineering/tooling] iter 20 (ship): 6 boilerplate-as-syntax lessons + isolation validator

## Product impact
Algorithms section grew from 3 to 9 lessons — the boilerplate (matrix
dirs, BFS queue, DFS template, tree traversal shapes, LL walk, heap
math) the rusty engineer reaches for BEFORE the algorithm is now
drillable as standalone syntax instead of being buried inside Patterns
solutions.

## Engineering
Added tools/validate-files.js for in-isolation lesson validation. New
durable probe tools/cdp/algorithms-section-expansion.js.

## Verification
node tools/validate-data.js: 336 → 355 (+19 exercises, 0 fail)
node tools/cdp/algorithms-section-expansion.js: 29/29
```

### Common queries

```bash
# Recently shipped user-facing improvements (overview)
git log --grep="^\[product" --oneline -20

# New content added this month
git log --grep="^\[product/content" --since="1 month ago" --oneline

# Recent bug fixes the user would have noticed
git log --grep="^\[product/fix" --since="1 month ago" --oneline

# Full "Product impact" descriptions for the last 10 user-facing commits
git log --grep="^\[product" -10 --pretty=format:"%h %s%n%n%b%n---%n"

# Internal changes (no direct user impact)
git log --grep="^\[engineering" --oneline -20

# Loop iterations that actually shipped product (vs framework changes)
git log --grep="^\[product" --grep="iter " --all-match --oneline
```

### When to skip the convention

- **Merge commits** — auto-generated, leave them alone.
- **Pre-convention history** — no retroactive rewrite. The convention applies
  going forward; earlier commits are still readable via `--since`/`--until` +
  topical grep.

## Sub-agent workflow

When asked to author multiple lessons at once, spawn parallel `general-purpose`
Agent calls — one per batch of 4-5 lessons. Each agent:
1. Reads `CLAUDE.md` + [`docs/canonical-style.md`](docs/canonical-style.md) + [`docs/l1-distractor-quality.md`](docs/l1-distractor-quality.md) + a sample `data/<slug>/<sample>.json` for the schema
2. **Decides the problem shape (collection-transform vs algorithm) before writing the canonical** — per `docs/canonical-style.md`. The `description` field should name the shape and the idiom choice.
3. Authors lesson JSON files into the right section folder
4. **Verifies via `node tools/validate-data.js`** (which also enforces the banned-syntax list) before reporting back
5. Reports lesson IDs added and the validator output

The orchestrator integrates output, updates `data/manifest.json` for each new
lesson, flips statuses, and runs `node tools/validate-data.js` again to
confirm all exercises still pass.

## Loop mode

`/loop 10m <prompt>` schedules a recurring autonomous build. Each iteration:
- Spawns multiple parallel content agents
- Optionally spawns a review agent for code-quality findings
- Integrates outputs, fixes critical bugs, verifies via `node tools/validate-data.js`

Track progress via `TaskCreate` / `TaskUpdate`. Verify every iteration with the
full validator before declaring iteration complete.
