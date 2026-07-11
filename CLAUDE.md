# CLAUDE.md — Project Context

> **Read also: [MIGRATION-NOTES.md](MIGRATION-NOTES.md)** for the 2026-05 refactor
> that split lesson content out of `index.html` and added mobile + syntax-highlight
> work. The "How a lesson is structured" section below reflects the *new* layout.

## Current state (snapshot — refreshed 2026-05-27, app.js split)

- **166 fully-authored lessons** (`status: 'full'`), 0 stubs
- **734 verified L2+L3 exercises** (all pass via `node tools/validate-data.js`)
- `index.html` is markup only (~430 lines); `app.css` (~3,955 lines) loads via `<link>`
- **`app.js` (13.3k lines) was split into 15 ordered slices `js/app/01..15-*.js`** that
  share global scope and load in order (see § File layout). They are plain
  `<script src>` files (NOT ES modules) — the split is byte-identical to the old
  monolith, done to make each file small enough for an AI/human to read whole.
  Regenerate with `tools/split-app.py`; verify with `tools/cdp/appsplit-smoke.js`.
- Lesson content lives in `data/<section-slug>/<lesson-id>.json`
- `data/manifest.json` is the sidebar index — loaded on boot, lessons lazy-load on click
- Three tracks across 29 sections:
  - **Syntax (55)**: Basics · Arrays · Hash Structures · Modern Syntax · Iterators & Generators · JS Toolbox · Algorithms · Classes · Async · Advanced JS · JS Traps
  - **Patterns (79)**: Arrays & Hashing · Two Pointers · Sliding Window · Stack · Binary Search · Linked List · Trees · Tries · Heap · Graphs · Greedy · Dynamic Programming · Backtracking · Intervals · Matrix · Bit Manipulation · System Design
  - **Applied (20)**: Applied Problems — implementation problems (decks, games, hash maps, throttle/debounce, undo-redo, etc.)

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
- Mobile responsive drawer + sticky L3 action bar
- Multi-tab storage sync
- Search (`/`), keyboard nav (`j`/`k`/`1`-`4`/`c`/`s`/`?`/`Esc`)
- Letter-labeled MC (A/B/C/D)
- Reveal-tracking (mastered-with-reveal dot variant)
- Hide-mastered filter
- First-time welcome banner with Starter Path CTA
- Syntax-highlighted static code blocks (Reference + L2 templates) via CodeMirror runMode
- Line-wrapping in the L3 editor (mobile-friendly, prevents horizontal scroll)
- **Conversation tab** (opt-in, Patterns + Applied only — 99/99 lessons as of OOB-2026-05-24): 6-section interview-narration walkthrough with say/why color split. Simulates "what would you say in an interview" rather than just showing the canonical.
- **Walkthrough tab** (opt-in, Patterns + Applied only — 99/99 lessons as of OOB-2026-05-24): Jupyter-style line-by-line stepper. Pick an example input, scrub through the canonical with current-line highlight and a live state panel. Trace functions are JS generators compiled at runtime via `new Function`; the validator runs every trace on every example and asserts the final `returns` matches the declared `expected` — mechanical regression guardrail.
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
- **🏷 Merged Problems list + faceted tag filter** (2026-05-27) — on the **Problems** surface, Patterns + Applied render as ONE section-grouped list (no per-track sub-tabs; the Type facet recovers the split). A collapsible 🏷 Filter panel at the top of the sidebar offers 4 facets — **Type** + **Topic** (derived from track/section, no authoring), **Difficulty** (easy/med/hard, authored), **Company** (authored, seeded empty for future per-company problem sets). Faceting is AND-across / OR-within, via a `renderSidebar()` predicate (`tagMatch`); registry in `data/tags.json`, authored tags on manifest entries, validator-gated. Schema-additive `state.tagFilter`/`state.tagFilterOpen`. First step of the navigation refactor's Problems⇄Reference model (`iter-artifacts/navigation-refactor-design.md`).
- **📊 Dashboard (unified) + deep-link routes** (2026-05-31) — a new top-nav **Dashboard** entry opens ONE scrollable surface merging **daily progress** (today's solved/missed + due/weak counts + today-vs-yesterday delta), a **gamified Activity view** (🔥 current streak, weekly solved/per-day/first-try chips, a 14-day solved-per-day bar chart with green-solved/amber-miss split, and the 60-day consistency heatmap), and the full **mastery/stats** body. Every number is a real rep (PROFILE.md L72 endorses streak/delta "progress at a glance"; L109 only bars gamification that *obscures* readiness — so all stats derive from `_streakMapBuckets`' pass/miss classifier, no hollow points). The standalone Stats and Streak Map modals are retired into it — their hidden buttons (`stats-btn`/`streak-map-btn`) now route to `openDashboard()`. Rendering is shared via module-level `renderStatsInto`/`renderActivityInto`/`renderDailyInto` in `js/app/14-init-core.js`. **(2026-07-10, design-loop P5:** `openDashboard` now delegates to `openProgress` in `js/app/20-progress.js` — the Dashboard rebuilt as the ds-system **Progress** surface (Today snapshot → Activity charts → Fix first → Mastery → More insights), additionally absorbing the At-Risk list; `#at-risk-btn`/`#/m/at-risk` land there too. The legacy renderers remain in 14-init-core.js as delegation fallback.) Alongside it, **every launchable mode is a deep-link route** `#/m/<mode>` (slug = button id minus `-btn`): topbar menu items render as `<a href="#/m/…">` so **cmd+click / middle-click / right-click → "Open in New Tab"** boots a fresh app instance straight into that surface (`_parseHash`/`_dispatchModeRoute` in `js/app/10-render-sidebar-lesson.js`; boot dispatch via `_pendingBootMode`). Plain left-click still opens in place. No new state.

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
| `js/app/01..15-*.js` | Main app logic (~13.3k lines), split from the old `app.js` monolith into ordered, read-whole-able slices that share global scope. Load order matters; boot/`init()` is in slices 14–15. Named by concern (state-content, util-metrics, paths-cram, progress-sr, drills-*, stats-cheatsheet-mock, render-sidebar-lesson, tabs-ref-conv-walk, levels, mechanics-modal, init-*). |
| `tools/split-app.py` | Regenerates the `js/app/*.js` slices from a monolith; asserts byte-identical concat. Historical/one-shot — kept for reference. |
| `tools/analyze-tool-stats.py` | Mines Claude Code transcripts for per-file AI read/write/churn stats (drove the app.js split). `--json` for machine output. |
| `tools/cdp/appsplit-smoke.js` | Browser smoke test: app boots, all slices load, no exceptions/404s. |
| `SELF-IMPROVE-LEDGER.md` | Append-only history sidecar (Mode ledger + Last-touched index) extracted from `SELF-IMPROVE.md` to keep the active directive small. |
| `diagnostic.html` | 43-question self-diagnostic (standalone page) |
| `system-design.html` | Standalone **System Design** memorization drill (conceptual recall, no code execution). **Multi-topic**: a topic landing → per-topic chapter list → drill. Topics: **DDIA** (12 ch), **The System Design Interview** (framework + estimation, 7 §), **Building Blocks** (components, 7 §), **Canonical Design Problems** (16 worked problems). Two question types: **MC** and **open** ("explain & apply" — reveal model answer + self-grade). A topic manifest can set `ordered:true` (design problems) so its units drill in authored arc order instead of due-first shuffle. Tapping a unit opens a **detail screen** surfacing the authored `keyTakeaways` as a "Key Ideas" panel + a "Drill all" and (where questions carry `crux:true`) a "Crux only" fast-drill of just the signature questions. **Diagrams**: a unit can carry `diagram` (architecture, shown on the detail screen) and any question can carry `diagram` (shown on reveal) — `{kind:'mermaid'|'svg', code, caption}`. Mermaid loads from CDN and degrades gracefully (shows source) if unavailable; render-gated by `tools/cdp`-style harness. Reuses `ds/tokens.css` + `ds/components.css` + `js/storage.js` (design-loop P8 family unification); Leitner SR under `jsdrill.systemdesign.v1`. Linked from the main app topbar. Content in `data/system-design/<topic>/`. |
| `data/system-design/topics.json` | Registry of system-design topics (`id`, `icon`, `title`, `kind`, `blurb`) that the landing page enumerates. Add a topic by appending here + creating its `<id>/` dir. |
| `data/system-design/<topic>/` | Per-topic content — `manifest.json` (`parts[]` + `chapters[]`, with optional `unitLabel`/`unitAbbrev`) + per-unit files (`chNN`/`sNN`/`cNN`.json). Each unit's `questions[]` mixes `type:"mc"` (4 options + `answer` index + `explain`) and `type:"open"` (`prompt` + `points[]` rubric + model `answer`). `ddia/AUTHORING-BRIEF.md` + `OPEN-QUESTION-BRIEF.md` document the schema/quality bar. Gated by `tools/validate-system-design.js`. |
| `tools/validate-system-design.js` | Structural validator across all system-design topics (topics↔manifest↔disk parity, part/chapter coverage, MC 4-unique-options + in-range answer + explain, open prompt/points/answer, MC answer-index variety). |
| `data/paths.json` | Study-path registry. `kind:'lessons'` (Starter Path) drives the curated Today's Plan; `kind:'cram'` (e.g. 4-Day Interview Cram) carries `days[].blocks[].tasks[]` and `startIso` so Today's Plan renders a day-by-day acquisition view in the main app. |
| `ds/tokens.css` | **Single source of truth** for design tokens across the user-facing pages (colors, radii, type). The redesign's `--ds-*` roles PLUS the legacy `--bg`/`--panel`/`--accent`/… aliases (merged in from the retired root `tokens.css`, design-loop P8/D04). See `.claude/skills/ui-consistency/`. |
| `js/storage.js` | **Single source of truth** for localStorage I/O across pages. Exposes `window.DrillStorage`. See `.claude/skills/ui-consistency/`. |
| `js/supabase-config.js` | Supabase project URL + anon key. Anon key is public-by-design; RLS protects data. |
| `js/supabase-client.js` | Initializes `@supabase/supabase-js` v2 client. Exposes `window.SupabaseClient`. No-op if config missing. |
| `js/sync.js` | Optional cross-device sync. Exposes `window.DrillSync` (auth + push/pull/per-field merge) + a fixed top-right Sync chip. Skipped at runtime if sync is unavailable. |
| `supabase/migrations/` | SQL migrations (run via Supabase Dashboard → SQL Editor). |
| `data/manifest.json` | Sidebar index — `{sections: [{name, slug, lessons: [{id,title,track,status,tags?}]}]}`. `tags:{difficulty,company[]}` (authored facets) live here, beside track/status, so the faceted filter works at boot before lesson bodies lazy-load. |
| `data/tags.json` | Faceted-filter registry for the merged Problems list (Patterns+Applied). 4 facets: `source`(Type) + `topic` derived from track/section (no authoring); `difficulty` + `company` authored on manifest entries. Add a company by appending a value here. Validator enforces authored values against this registry. |
| `data/<section-slug>/<lesson-id>.json` | One JSON per lesson — the source of truth for content |
| `MIGRATION-NOTES.md` | Goals, principles, learnings from the multi-file refactor |
| `tools/validate-data.js` | Runs every L2 fill + L3 canonical, diffs manifest vs disk. Run before commits. |
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

The project ships two user-facing HTML pages — `index.html` and
`diagnostic.html`. (Pre-2026-05, a third page `prep.html` housed the 4-day
interview prep dashboard; it was dissolved into the main app as a
`kind:'cram'` study path consumed by Today's Plan.) They share an audience,
a visual language, and a localStorage origin. To prevent drift (which bit us
in iter-35):

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
  sidebarTrack: 'syntax' | 'patterns' | 'applied'     // last-selected track tab
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
