# Full product audit — layouts, content, flows, objective fit (2026-08-02)

**Scope.** Audit-only pass over the whole product: the main app (`index.html` + 24 `js/app/*.js`
slices), the two standalone pages (`system-design.html`, `diagnostic.html`), the generated
crawlable pages (`p/`, `sd/`), and the authored lesson corpus (171 lessons / 893 L1 questions /
252 L2 exercises). Nothing was changed except this document and its screenshots.

**Method.** Every UI claim below was measured against the live app over CDP at
**390×844 (mobile, coarse pointer)** and **1280×900 (desktop)**, on branch
`claude/full-product-audit-9bpr8r` at `b004330`. Content claims come from a full sweep of
`data/**/*.json` against `data/manifest.json`. Both first-run (`localStorage` cleared) and
seeded mid-journey state (9 mastered / 3 partial / 5 due / 2 weak / 1 reveal-flagged / 25 days of
history) were exercised, because most surfaces are count-gated and read as empty otherwise.

Probe scripts: session scratchpad `audit-0{1..16}-*.js`.
Screenshots: [`product-audit-shots/`](product-audit-shots/).

**Baseline health.** `node tools/check-all.js` → **8/8 gates pass**. `node tools/validate-data.js`
→ 938 checks pass. No console errors, no failed requests, and **no horizontal overflow at 390px**
on any surface visited. The app is in good mechanical health; every finding below is a
product/design gap, not a broken build.

---

## Executive summary

The core ladder (Reference → L1 → L2 → L3), the drill catalogue (all 27 modes launch and render
correctly from a cold session — the 2026-07-10 audit's dead-drill and Bug-Hunt-freeze defects are
**fixed**), the ds Settings sheet, the seeded Progress page, and the generated share pages are all
genuinely good. The product's problems are not in its parts; they are in **how many parts now
overlap**, and in **content depth that stopped scaling with content breadth**.

Six things stand out:

1. **A review session doesn't own its screen.** Inside a scoped review, the lesson still renders
   its "go somewhere else" CTA row — *Review N due* / *Next lesson* / *Shuffle* — plus prev/next
   arrows, alongside the session HUD's own Skip/Exit. Six competing exits, and the CTA's count
   contradicts the HUD's ("Review 1 due" next to "1/1"). Mock Interview got exactly this fix in
   iters 24/27/29; review sessions never did.
2. **The diagnostic is a write-only sink.** `PROFILE.md` makes recent diagnostic signal the
   autopilot's steering input. `loadDiagnostic()` has **zero readers** in `js/app/*` — its only
   caller is `js/sync.js`, which uploads the blob. What the code labels "diagnostic signal" in
   `_pickMockLessonId` is in-app weakness + SR due data. A shipped 43-question page steers nothing.
3. **Half of the L1 corpus can't teach on a miss.** 473 of 893 L1 questions (53%) ship with no
   `explain`; **59 lessons have none at all**. On the app's designated highest-throughput mobile
   surface, a wrong tap on those questions yields "✗ Not quite." and the correct option highlighted
   — no reason, ever.
4. **The L2 floor documented in `CLAUDE.md` is missed on 91 of 171 lessons**, concentrated exactly
   where the phone user lives: 73 of 90 Patterns lessons have a single L2 exercise, and 13 sections
   are at 100% single-L2 (Linked List, Graphs, DP, Binary Search, Heap, Tries, Backtracking,
   Intervals, Matrix, Bit Manipulation, …).
5. **Two front doors and three "what now?" surfaces.** Home and Today-home render the same
   greeting, the same clock, the same streak chip and the same hero for the same lesson; the nav
   marks Today as *Home* — the repo's own `tools/cdp/ds-page-frame.js` **fails on exactly this**
   today, on both viewports. Separately, "Today's Plan" opens a *page* from Home's More list and a
   *modal* from the Practice launcher.
6. **The URL stops telling the truth ~300 ms after boot.** `_updateHash()` writes the current
   lesson's hash whenever a lesson is loaded, regardless of what is actually on screen. Land on
   `#/m/browse` and the address bar becomes `#/p-top-k-frequent/reference` while Browse is
   displayed; reloading then lands on the lesson. The cmd+click-a-mode-into-a-new-tab feature
   survives exactly one paint.

Ranked backlog is at the end.

---

## Surface scorecard

| Surface | Layout | Content | Flow | Objective met? |
|---|---|---|---|---|
| Home (`#/m/home`) | good | good | good | **Yes** — one hero, three tracks, scoped review. Best surface in the app. |
| Today home (`#/m/today-home`) | good | good | — | **No** — duplicates Home's hero; nav calls it Home |
| Browse | good | good | good | **Yes** (but two track pickers on mobile — see F6) |
| Practice launcher | ok | **truncated** | good | Partly — every subtitle clips on mobile |
| Progress | good (seeded) | good | good | **Yes** with data; empty state is all-zeros chrome |
| Lesson (Ref/L1/L2/L3) | **below-fold** | see § content | good | Partly — drill starts at y≈800 of 844 |
| Conversation / Walkthrough | good | good | good | Yes — but off-screen in the tab strip when you land on L1+ |
| Scoped review session | **conflicted** | — | **broken focus** | **No** — F1 |
| Drill modes (27) | good | good | good | **Yes** — all launch cold; prior audit's defects fixed |
| System Design | ok | strong | ok | Partly — "202 due" on first run; back-link occluded |
| Diagnostic | ok | good | dead-end | **No** — results steer nothing; copy addresses a person |
| `p/` + `sd/` share pages | good | good | good | **Yes** — the cleanest thing in the repo |

---

## Findings

### Severity 1 — a shipped feature's stated objective is not met

#### F1. Review sessions render six competing ways to leave the session
*Evidence:* [`07-review-session-mobile.png`](product-audit-shots/07-review-session-mobile.png),
[`08-review-l2-fold-mobile.png`](product-audit-shots/08-review-l2-fold-mobile.png).
`#/m/review/all` with seeded state shows the HUD (`Everything due 1/1` · Skip · ✕) *and* the
lesson's own CTA row: **`🕒 Review 1 due →`**, **`Next: Contains Duplicate`**, **`Shuffle`**, plus
the header's ◀ ▶ arrows. The HUD says the queue is 1/1; the button says 1 due; on the 4-item run
the HUD said `1/4` while the button said `Review 3 due`.

*Why it matters:* `js/app/23-review.js` exists to make a queue workable to the end. Three of those
affordances silently abandon the queue (`selectLesson` is not the review advance path), and the
contradictory counts make the user distrust both. `PROFILE.md` § Cognitive style is explicit that a
surface presenting several simultaneous options is friction. The codebase already knows this
pattern — `renderLesson` suppresses `nextCta`, the tab strip and the arrows when
`state.mock.active && state.mock.lessonId === lesson.id`.

*Fix:* extend that same suppression to an active review session (one condition alongside the mock
check in `js/app/10-render-sidebar-lesson.js` around the `nextCta` / arrows blocks).

#### F2. The diagnostic steers nothing — the autopilot's stated input is unwired
*Evidence:* `grep -rn "loadDiagnostic" js/` returns exactly two sites: the definition in
`js/storage.js` and `js/sync.js:419` (upload). No surface in `js/app/*` reads
`jsdrill.diagnostic.v1`. `_pickMockLessonId` (`js/app/09-stats-cheatsheet-mock.js:739`) cites
"PROFILE.md line 66-69" in its comment but weights the pool from `dueReviewIds()` and
`state.weakness` only.

*Why it matters:* `PROFILE.md` § "Study intent — autopilot" point 2 is specific — *"if the last one
showed complexity-pricing weak …, today's autopilot weights complexity-heavy lessons + the 🧮 Big-O
drill higher."* The 43 questions are asked, stored, synced to Supabase, and exported for grading;
the app never consumes them. This is the single largest gap between the documented product and the
built one.

*Fix (smallest useful step):* have Home's hero and `_pickMockLessonId` read the most recent
diagnostic's per-section scores and add a weight term; surface one "diagnostic gap" chip on Home so
the user can see the signal is live. If the intent has genuinely changed, amend `PROFILE.md` —
right now the doc and the code disagree.

#### F3. 53% of L1 questions give no explanation on a miss
*Evidence:* full corpus sweep — **473 of 893** L1 questions have no non-empty `explain`;
**59 lessons have zero explains across every question**. `js/app/12a-l1.js:390` renders
`✓ Correct.` / `✗ Not quite.` and appends `q.explain` only `if (q.explain)`. The correct option
does get a `.correct` class, so the user learns *which*, never *why*.

Worst whole-section rates: Backtracking 16/16 (100%), Bit Manipulation 20/20 (100%), Advanced JS
12/12 (100%), Matrix 11/12 (92%), Modern Syntax 11/12 (92%), Classes 7/8 (88%), Async 10/12 (83%).
Best: JS Traps 0/13 (0%), Algorithms 12/61 (20%), JS Toolbox 5/24 (21%) — so the house style
clearly exists; it just wasn't applied uniformly.

*Why it matters:* L1 is the surface `PROFILE.md` designates as the mobile workhorse, and the miss
is the moment where elaboration converts a wrong answer into an encoded one.
`docs/l1-distractor-quality.md` governs the *options*; nothing governs the feedback.

*Fix:* add an `explain` coverage gate to `tools/validate-data.js` (warn now, fail later), then
backfill worst-first. This is bulk authoring work, well-suited to the existing sub-agent workflow.

#### F4. 91 of 171 lessons miss the documented ≥2 L2 floor
*Evidence:* L2 exercise counts across the corpus are `{1: 91, 2: 75, 3: 5}`. By track:
Patterns **73/90**, Applied **18/37**, Syntax **0/44**. Thirteen sections are at 100% single-L2:
Binary Search, Linked List, Tries, Heap, Graphs, Greedy, Dynamic Programming, Backtracking,
Intervals, Matrix, Bit Manipulation, System Design, and Trees is 8/9.

*Why it matters:* `CLAUDE.md` § "Who this is for" states the floor as a rule
(*"every lesson should ship with ≥3 L1 questions and ≥2 L2 exercises so the mobile user has enough
surface area"*). L1 clears its floor everywhere (min 4). L2 — the only *typing* rung that works on a
phone — misses it on 53% of lessons, and the misses are concentrated in the Patterns track the user
is actually preparing on. One L2 per lesson means a single exposure, then the rung is exhausted.

*Fix:* same shape as F3 — gate it, then backfill Patterns first.

---

### Severity 2 — real friction, or an objective only partly met

#### F5. Home and Today-home are the same page twice
*Evidence:* [`01-home-mobile.png`](product-audit-shots/01-home-mobile.png) vs
[`06-today-home-mobile.png`](product-audit-shots/06-today-home-mobile.png) — same `Sun · 7:37 PM`,
same `Good evening`, same streak chip, same hero lesson, same `Start →`. The differences are the
kicker label (`START · NEXT ON PLAN` vs `NEXT UP · PICKED FOR YOU`), a due/weak/today stat row, and
Home's track cards vs Today's "THEN" queue. `js/app/16-ds-nav.js:104-106` maps both `.home-page`
and `.today-home-page` to nav key `home`, so Today highlights *Home*.

`node tools/cdp/ds-page-frame.js` **fails on this today**, on both viewports:
`FAIL — mobile390/today: aria-current="today" (got home)` (32/33 assertions pass).

*Fix:* decide which page is the front door and fold the other's unique parts into it (Today's
stat row and "THEN" queue are the pieces Home lacks), or give Today its own nav rung and honest
`aria-current`. Leaving both is the costly option.

#### F6. Three surfaces answer "what should I do now?"
Home's hero, the Today-home page (`today-home-btn`), and the Today's Plan **modal** (`today-btn`,
`openTodaysPlan`). The Practice launcher's *Today's Plan* row fires `today-btn` (the modal —
`js/app/15-init-features-boot.js:533`) while Home's More list fires `today-home-btn` (the page —
`js/app/22-home.js:421`). Same label, same concept, two different UIs depending on where you tapped.

#### F7. On mobile, every lesson opens with the drill below the fold
*Evidence:* measured on a 390×844 viewport, first tappable L1 option at **y ≈ 800** (patterns),
**773** (syntax/applied); tab strip top at 503–530. Above it sit the track pill, section name,
share/prev/next row, `<h2>` title, description, and the full PROBLEM card. Inside a review session
the CTA row (F1) pushes it further — the L2 instructions were clipped by the bottom nav.

*Why it matters:* the target user drills in 30-second bursts on a phone. Today every single lesson
open costs a scroll before the primary interaction is reachable.

*Fix:* collapse the header on the drill tabs (L1/L2/L3) the way `renderLesson` already suppresses
the PROBLEM card on L3 — title + pill only, description and prompt behind a disclosure.

#### F8. Retired mobile chrome still navigates — and lies
*Evidence:* `css/06-ds-nav.css:113` retires `.surface-toggle` at ≥768px only; the comment says it
*"STAYS on mobile lessons as the inline track-context switcher until P7 revisits lesson chrome."*
In practice it renders on **every** mobile screen, not just lessons — Home, Browse, Progress —
where it shows a stale selection (Home displayed `Reference` as selected). Measured: tapping
`Problems` while on Browse changes `#lesson-shell` from `browse-page` to the lesson root (`mb-6`),
i.e. **it throws the user out of Browse into a lesson**.

Browse also carries its own `Syntax | Patterns | Applied` segmented control, so a mobile Browse
screen shows two different track pickers, disagreeing, 450 px apart
([`02-browse-mobile.png`](product-audit-shots/02-browse-mobile.png)).

*Fix:* scope it to the lesson page (the documented intent) or finish P7.

#### F9. The first-run plan picker intercepts shared links, and ✕ doesn't dismiss it durably
*Evidence:* [`09-welcome-modal-on-deeplink.png`](product-audit-shots/09-welcome-modal-on-deeplink.png).
`renderLesson` auto-opens the path modal for any user with `!state.welcomed && progress == {}`
(`js/app/10-render-sidebar-lesson.js:619`), so a first-time visitor arriving on a shared
`#/two-sum/L1` gets a five-option plan chooser instead of the lesson. Only *Pick* and *Browse on my
own* set `welcomed`; `#path-close` (`js/app/14-init-core.js:2269`) just hides the modal, so the
flag stays false.

*Why it matters:* the share-URL work (2026-08-02) exists so a link resolves to the drill, and
`PROFILE.md` demands that any pre-drill decision be justified loudly. Five choices is the most
expensive possible first screen for this user.

*Fix:* skip the auto-open when the boot hash names a lesson (offer the picker afterward as a
dismissible row), and set `welcomed` on ✕.

#### F10. The URL stops matching the screen ~300 ms after boot
*Evidence:* booting `#/m/browse` and sampling every 300 ms: at 300 ms the page is `browse-page`
and the hash is already `#/p-top-k-frequent/reference` — and stays that way. Same after clicking
Browse or Progress from a lesson (`#/two-sum/conversation` retained). Home and scoped review are
the exceptions: they `replaceState` their own route (`js/app/22-home.js:572`,
`js/app/23-review.js:106`). Root cause: `_updateHash()` (`js/app/10-render-sidebar-lesson.js:512`)
writes the lesson hash whenever `state.currentLessonId` is set, with no notion of which surface is
rendered.

*Consequences:* reloading a mode route lands on a lesson; copying the URL from Browse/Progress
shares a lesson; the documented cmd+click-into-a-new-tab behaviour is destroyed on the first
`_updateHash()` after it succeeds.

*Fix:* give `_updateHash()` a guard — only write the lesson hash when the lesson is the rendered
surface; have Browse/Progress/Practice `replaceState` their own `#/m/<mode>` like Home does.

#### F11. System Design greets a new user with "202 due"
*Evidence:* [`10-system-design-mobile.png`](product-audit-shots/10-system-design-mobile.png) —
first run shows `0/202` + **`202 due`**, `0/107` + `107 due`, `0/103` + `103 due`. Never-seen is
being counted as overdue. Also on that screenshot: the fixed **Sync chip overlaps the `JS Drill ↗`
back link**, the only route back to the app (the 2026-07-10 audit flagged the same collision;
it persists here), and the page title truncates to `System Design…`.

#### F12. Unknown lesson ids resolve silently
A hashchange to `#/does-not-exist/L1` leaves the previous lesson rendered while the URL keeps the
bad id; booting on one silently falls back to `lastLessonId` and rewrites the URL. For a product
whose links are meant to be handed to other people and to AI agents, a dead link should say so.

---

### Severity 3 — polish and hygiene

| # | Finding | Evidence |
|---|---|---|
| F13 | Stale hardcoded counts in shipped copy: **"all 154 lessons"** (actual 171) and **"16 design problems"** (actual 32) | `index.html:356`; `js/app/15-init-features-boot.js:544` |
| F14 | Practice launcher subtitles all clip on mobile — *"Smart-pick: if you have due reviews /…"* — so the rows aren't differentiable | [`03-practice-launcher-mobile.png`](product-audit-shots/03-practice-launcher-mobile.png) |
| F15 | Progress first-run renders four zero tiles, an empty bar chart and an empty 60-day grid, with no next action | [`04-progress-empty-mobile.png`](product-audit-shots/04-progress-empty-mobile.png) |
| F16 | The lesson page is outside the ds page frame: **0 `<h1>`** (title is `<h2>`), no `.ds-page`, root class `mb-6`. `ds-page-frame.js`'s `PAGES` list doesn't cover it | measured; `js/app/10-render-sidebar-lesson.js:669` |
| F17 | Company facet ships 8 chips that all read `0` — registry populated, lessons untagged (0/171) | `data/tags.json`; `js/app/19-browse.js:164` |
| F18 | 150/171 lessons have no `reference.approach`/`complexity`; only **11 of 90** Patterns lessons render a complexity chip, in an interview-prep app | corpus sweep |
| F19 | Durable CDP probes aren't in `check-all.js` or CI, and **2 are red**: `ds-page-frame` (F5) and `home-nav` (`System Design card totals … got "0/704"` — stale expectation after content growth) | probe runs |
| F20 | `diagnostic.html` still addresses a human coach: *"Paste/share that with me to grade"* | [`11-diagnostic-mobile.png`](product-audit-shots/11-diagnostic-mobile.png) |
| F21 | `a-eve-double-booking` and `a-eve-largest-files` have neither `conversation` nor `walkthrough`, against `CLAUDE.md`'s "99/99" claim | corpus sweep |
| F22 | Two of six lesson tabs sit off-screen after the strip auto-centres the active tab, with no scroll affordance — Conversation and Walkthrough are invisible when you land on L1+ | measured: strip overflows 358px; tabs 1–2 at `left: -248 / -121` |
| F23 | Numeric tab prefixes (`1.` … `6.`) advertise keyboard shortcuts that don't exist on the 80% surface, and cost width where it's scarcest | measured |
| F24 | Boot isn't defensive about the persisted blob: a `history` value of the wrong shape throws an uncaught `TypeError` inside `init()` (`_heatstripCells`) and leaves the app half-initialised. Only reachable via a corrupted/foreign blob, but `loadProgress` shape-checks nothing | reproduced with a malformed seed |
| F25 | Doc drift: `CLAUDE.md` describes the Problems surface as one merged Patterns+Applied list with a Type facet; Browse ships three track segments (Syntax/Patterns/Applied) | `CLAUDE.md` § Features shipped vs `js/app/19-browse.js` |

---

## What's working — don't regress it

- **All 27 drill modes launch and render correctly from a cold session** (verified cold vs warm:
  Rapid-Fire, Bug-Hunt, Recognize, Big-O, Gauntlet, Match, Predict, Swap-Bench). The 2026-07-10
  audit's Bug-Hunt tab-freeze and the three `alert()` dead-ends are **gone**.
- **Zero horizontal overflow at 390px** on every surface visited, and zero console errors or failed
  requests during normal use.
- **The generated share pages are the strongest artifact in the repo.** `p/two-sum/?s=AbC` renders
  complete without JavaScript, decodes the code, prints a per-question results table, and correctly
  refuses to score a row whose code predates a content edit ("code out of date") instead of
  inventing a verdict. 172 lesson pages, 58 SD units, 235 sitemap URLs.
- **Progress with real data** reads well: today's four tiles, a truthful pace line, 7-day chips, the
  solved/miss bar chart and the 60-day map ([`05-progress-seeded-mobile.png`](product-audit-shots/05-progress-seeded-mobile.png)).
- **The ds Settings sheet** is the cleanest surface in the app — grouped, labelled, sized right.
- **Home's scope model** (Continue = forward, ⟲ Review = repair, rendered only where work exists)
  is the right idea and the right shape.
- **System Design content depth** — 32 design problems, 7 mechanism families, study plans, 123
  committed infographics; `sd-plans` (59 assertions) and `sd-tags-nav` (39) are green.

---

## Content audit — per section

`L2<2` counts lessons below the documented floor. `no-explain` is L1 questions lacking `explain`.

| Section | Track | Lessons | L2<2 | no-explain |
|---|---|---|---|---|
| Basics | syntax | 10 | 0 | 23/40 (58%) |
| Arrays | syntax | 6 | 0 | 15/24 (63%) |
| Hash Structures | syntax | 3 | 0 | 9/12 (75%) |
| Modern Syntax | syntax | 3 | 0 | 11/12 (92%) |
| Iterators & Generators | syntax | 5 | 0 | 12/20 (60%) |
| JS Toolbox | syntax | 6 | 0 | 5/24 (21%) |
| Classes | syntax | 2 | 0 | 7/8 (88%) |
| Async | syntax | 3 | 0 | 10/12 (83%) |
| Advanced JS | syntax | 3 | 0 | 12/12 (100%) |
| JS Traps | syntax | 3 | 0 | 0/13 (0%) |
| Algorithms | patterns | 11 | 0 | 12/61 (20%) |
| Arrays & Hashing | patterns | 6 | 4 | 19/48 (40%) |
| Two Pointers | patterns | 4 | 3 | 13/34 (38%) |
| Sliding Window | patterns | 4 | 3 | 16/35 (46%) |
| Stack | patterns | 4 | 3 | 15/32 (47%) |
| Binary Search | patterns | 4 | 4 | 16/31 (52%) |
| Linked List | patterns | 7 | 7 | 25/43 (58%) |
| Trees | patterns | 9 | 8 | 29/67 (43%) |
| Tries | patterns | 2 | 2 | 6/8 (75%) |
| Heap | patterns | 4 | 4 | 15/26 (58%) |
| Graphs | patterns | 7 | 7 | 24/40 (60%) |
| Greedy | patterns | 3 | 3 | 9/17 (53%) |
| Dynamic Programming | patterns | 9 | 9 | 31/44 (70%) |
| Backtracking | patterns | 4 | 4 | 16/16 (100%) |
| Intervals | patterns | 3 | 3 | 10/26 (38%) |
| Matrix | patterns | 3 | 3 | 11/12 (92%) |
| Bit Manipulation | patterns | 5 | 5 | 20/20 (100%) |
| System Design | patterns | 1 | 1 | 4/4 (100%) |
| Applied Problems | applied | 37 | 18 | 78/152 (51%) |

Corpus totals: 171 lessons · 893 L1 questions (min 4/lesson — floor met everywhere) · 252 L2
exercises · 125/127 problems carry `conversation` + `walkthrough` · 94 lessons carry alternates ·
21 lessons carry `approach`/`complexity` · 127/171 carry a difficulty tag · **0/171 carry a
company tag**.

---

## Ranked backlog

**Ship first — cheap, and each closes a stated objective**

1. **F1** — suppress the lesson's next/shuffle/review CTA row and prev/next arrows during an active
   review session (mirror the existing mock-active guard). One condition, removes five of six
   competing exits.
2. **F13** — fix the two stale counts. Two-line change.
3. **F9** — don't auto-open the plan picker when the boot hash names a lesson; set `welcomed` on ✕.
4. **F10** — guard `_updateHash()` by rendered surface; give Browse/Progress/Practice their own
   `replaceState`. Restores reload/copy/new-tab semantics for every mode route.
5. **F11** — count never-seen as *new*, not *due*, on the System Design landing; unstick the Sync
   chip from the `JS Drill ↗` back link.

**Next — structural, needs a decision**

6. **F5 + F6** — pick one front door and one "what now?" surface; fold the rest in. Ends a
   duplicated page, a duplicated modal, and the red `ds-page-frame` assertion.
7. **F7 + F22 + F23** — collapse the lesson header on the drill tabs and rework the tab strip so
   the drill is above the fold and all six tabs are discoverable. This is the single biggest
   phone-fit win available.
8. **F2** — wire the diagnostic into the autopilot pick, or amend `PROFILE.md`. Do not leave the
   two disagreeing.
9. **F8** — scope the Problems/Reference toggle to the lesson page, or finish P7.

**Then — bulk content, gate first so it can't regress**

10. **F3** — `explain` coverage gate (warn), then backfill worst-first: Backtracking, Bit
    Manipulation, Advanced JS, Matrix, Modern Syntax, Classes, Async (all ≥83% missing).
11. **F4** — second L2 exercise for the 91 lessons below the floor, Patterns first.
12. **F18** — `approach` + `complexity` on the Patterns track (79 lessons lack it).
13. **F19** — add the durable probes to `check-all.js` (or a CI job) and fix the two red ones.
14. **F15, F14, F17, F20, F21, F25** — empty states, launcher copy, dead facet, coach-voice copy,
    two missing walkthroughs, doc drift.

---

## Notes on method, for the next auditor

Three claims I formed early and had to **withdraw** after measuring properly — worth repeating so
they aren't re-reported:

- *"Deep links land on the wrong tab."* False. Fresh-tab boots on `#/<lesson>/L1|L2|L3` land
  correctly at 0.7 s and stay correct. The transient I first saw came from my probe changing
  `location.hash` on an already-loaded page and then reloading — `selectLesson()` had already
  rewritten the URL to the default tab.
- *"`hashchange` doesn't route / Back is broken."* False. Routing works; my first test used a
  lesson id that doesn't exist (`valid-anagram` — the real id is `p-valid-anagram`), which the
  router correctly ignores (see F12 for the real, smaller issue).
- *"Drill modes are dead on a cold session."* False. They need ~2 s to fetch lesson JSON; I
  sampled at 700 ms. All 27 render correctly cold.

Everything reported above was measured at least twice, and every quantitative claim is reproducible
from the probe scripts and the corpus sweep.
