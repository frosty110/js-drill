# Navigation audit — post-P5 IA seams (2026-07-10)

**Scope.** Audit-only pass over the redesigned navigation (design-loop P0–P5 shipped; P6 Settings
and P8 page-unification NOT shipped). Every finding below was verified against the live app via
CDP at **390×844 (mobile, coarse pointer)** and **1280×800 (desktop)** on branch
`claude/ddia-learning-tool-peiw5t`. Probes: `tools/cdp/audit-nav-matrix.js`,
`tools/cdp/audit-nav-deeplink.js`, `tools/cdp/audit-nav-pages.js`, `tools/cdp/audit-nav-flows.js`
(all new, re-runnable). Screenshots: `iter-artifacts/audits/nav-shots/`.
Raw JSON: session scratchpad `audit/{matrix,deeplink-mobile,deeplink-desktop,pages,flows}.json`.

Seeded state for all runs: returning user with mastered/due/weak/revealed/resurrect signals all
non-zero, so no count-gated surface was empty-hidden by accident. First-run section used empty
`localStorage`.

---

## Executive summary

The new IA (Today / Browse / Practice / Progress bottom-bar ↔ rail) is structurally sound: all
four destinations work on both viewports, the reachability contract (visible home ∪ palette ∪
`#/m/` route) holds for **58 of 64 modes**, empty states degrade without NaN/undefined artifacts,
and every modal closes on Escape. The seams are exactly where the un-shipped phases predict —
plus two genuine breakages the redesign didn't cause but the deep-link/palette channels now
*expose*:

1. **Bug-Hunt can hard-freeze the tab** (sync infinite loop while mutation-hunting). Reproduced
   2/2 on cold boot `#/m/bug-hunt` at both viewports; the frozen tab never recovers.
2. **diagnostic.html is unreachable for any returning user** — its only in-app link renders in
   the one-time welcome modal. PROFILE.md makes diagnostic signal the autopilot's steering input;
   today the steering input has no door.
3. **Three drills (Reverse, Predict, Match) dead-end into a blocking native `alert()`** on any
   fresh session, from every channel (launcher random-pick, palette, deep link) — the alert even
   instructs the user to go warm the cache by hand ("Click around a few patterns first").
4. **system-design.html has no visible entry point on mobile** (palette-only), and the palette
   itself is a typing surface — the 80%-phone user effectively can't discover it.
5. The **limbo topbar chrome** works but double-books desktop search (4 affordances), anchors
   Settings 1,199 px away from its rail trigger, and keeps emoji chrome (D07 violation) in the
   surviving settings dropdown; the fixed **Sync chip collides with session chrome** on mobile.

Positive findings worth keeping: mock-C Today home is excellent on both viewports; Browse's
in-page filters + `/`-key routing behave exactly as designed; the `[data-lesson-loading]`
boot-clobber guard held for every shell-page deep link (`#/m/today-home|browse|dashboard|at-risk|
stats|streak-map` all land correctly on cold boot); all 8 tested overlays close on Escape;
first-run boots coherently (welcome modal with diagnostic link over a lesson, nav visible).

---

## P1 — capability unreachable / broken flow

### P1-1 · Bug-Hunt (and its "Judge a code change" launcher family) can freeze the tab

**Evidence.** Cold boot `#/m/bug-hunt` froze the page 2/2 (mobile + desktop sweeps; watchdog
tripped, and a follow-up raw CDP `Runtime.evaluate 1+1` against the frozen tab timed out —
the renderer main thread is spinning). During the mobile sweep the frozen tab's pegged core also
caused *collateral* watchdog trips on later modes (mutate, constraint-shift, hotseat, today,
cram-review, rapid-fire) — all of those passed cleanly on the uncontended desktop sweep, so the
single reproducible freeze is Bug-Hunt. The failure is probabilistic per run (random lesson ×
mutator × site), which matches the "intermittent CDP probe hangs" already recorded in
`js/app/08-drills-bughunt-constraint.js:294-305`.

**Root cause.** `_bugHuntFindBreakingMutation` (`js/app/08-drills-bughunt-constraint.js:121-165`)
executes mutated canonicals via `runCode` (`js/core/runner.js`), which wraps code in a
**synchronous** `new Function` — un-interruptible from the page. iter-143 removed 3 mutators
(`++→--`, `--→++`, `&&→||`) but `SAFE_MUTATORS` (`:306`) still includes the 4 boundary flips +
2 equality flips; flipping `while (lo < hi)` → `lo <= hi` in a binary-search/two-pointer
canonical (of which the patterns track has many) yields a loop whose pointers stop moving —
a sync infinite loop. Mutate-and-Predict shares the machinery (`_mutateBuildDeck`, `:379`), so it
carries the same latent risk even though it didn't freeze in this audit's desktop run.

**PROFILE impact.** "Friction between 'I have 20 free minutes' and 'I'm drilling' is near zero"
(§ Success criteria) — a frozen tab is the maximal violation, and on iOS Safari it takes the
whole app (and unsaved session state) with it. The launcher's *Judge a code change* row picks
Bug-Hunt at random (1-in-5), so an ordinary Practice-sheet tap can hit this.

**Fix spec (implementation-ready).**
1. Add `runCodeBudgeted(code, {maxMs=400})` beside `runCode` in `js/core/runner.js`: before
   `new Function`, source-transform the code by injecting an iteration guard into every loop
   head — replace `while (` / `for (` / `do {` bodies with a shared counter check:
   `if (++__iterGuard > 2e6) throw new Error('iteration budget exceeded');`
   (declare `let __iterGuard = 0;` at the top of the wrapped body). A regex-level transform is
   acceptable here because the inputs are the app's own canonicals + single-operator mutants,
   not arbitrary user code; L2/L3 user-code paths keep using plain `runCode` unchanged.
2. Switch the two deck builders (`_bugHuntFindBreakingMutation:140`, `_mutateClassifyMutation`)
   to `runCodeBudgeted`; treat a budget-throw as "breaking mutation found" for Bug-Hunt (it IS
   a behavior change) but cap per-lesson hunt time so deck build stays <1 s.
3. Add a regression probe: `tools/cdp/bug-hunt.js` gains a loop that cold-boots `#/m/bug-hunt`
   10× and asserts the page stays responsive (the audit's watchdog pattern in
   `tools/cdp/audit-nav-deeplink.js` shows how; `tools/cdp/lib.js` now auto-dismisses native
   dialogs and records them in `session.dialogs`).

### P1-2 · diagnostic.html has zero entry points after first run

**Evidence.** `grep` + palette index dump: the only in-app link is the welcome-modal footer
(`js/app/03-paths-cram.js:1033`), rendered exclusively when `openPathModal({welcome:true})`
fires for a zero-progress user (`js/app/10-render-sidebar-lesson.js:561-562`). The palette index
(`_paletteBuildIndex`, `js/app/14-init-core.js:59-121`) contains a hand-added System Design entry
(`:74-80`) but nothing for diagnostic; it's absent from the launcher taxonomy
(`js/app/15-init-features-boot.js:529-577`), the topbar, and the `#/m/` namespace (it's a separate
page, not a `-btn`). Verified live at both viewports: no channel reaches it once `welcomed=true`.
The page itself is healthy and has a working return link ("← Drill", `diagnostic.html:109`) —
see P3-5 for its tap size.

**PROFILE impact.** § Study intent #2: *"Use recent diagnostic signal to bias the pick."* The
diagnostic is the profile's named source of concept-level gap signal, and INVENTORY.md verdicts
it KEEP. A returning user who wants to re-baseline (the natural cadence: every few weeks) has no
door — the capability exists but is unreachable, which is the definition of a reachability-
contract breach.

**Fix spec (pre-P8, no unification).**
1. Palette entry: in `_paletteBuildIndex` next to the System Design entry (14-init-core.js:74),
   push `{ id: 'link:diagnostic', label: 'Diagnostic (43 questions)', kind: 'mode',
   hint: 'Baseline your gaps — feeds the autopilot pick', action: () => location.href = 'diagnostic.html' }`.
2. Launcher row: in `TOPBAR_MENU_TAXONOMY.practice.items` (15-init-features-boot.js:533) append an
   object item `{ icon: 'clipboard-list', label: 'Diagnostic', desc: '43-question baseline — retake every few weeks', action: 'href', href: 'diagnostic.html' }`
   and teach `rowHtml`/`onRowTap` (18-practice-launcher.js:50-106) one new `action: 'href'` shape
   (3 lines). This puts it in the Practice sheet's *Sessions* group on both viewports.
3. Both are additive; P8 later replaces them with the real unified surface.

### P1-3 · Reverse / Predict / Match dead-end into a blocking alert on any fresh session

**Evidence.** Deep-link sweeps: `#/m/reverse`, `#/m/crystal`, `#/m/match` produced
`alert: "<Drill> needs more loaded … lessons. Click around a few … first, then try again."`
then **no surface** — on BOTH viewports, deterministically (recognize alerted on the mobile run
only — intermittent). Recorded by the new dialog capture in `tools/cdp/lib.js`. The same
functions back the palette rows and the launcher's *Name the pattern* / *Run it in your head*
random-pick rows, and a fresh session has the same near-empty `CONTENT` cache as a cold boot —
so on the user's first tap of the day, those channels dead-end identically (Reverse and Match
are 1-in-4 picks in their families).

**Root cause.** Deck builders require lesson *bodies* (walkthrough traces for Reverse,
descriptions for Match) but the pre-load loop breaks on a raw content-count heuristic — e.g.
`startReverseSession` (`js/app/07-drills-swap-speedrun.js:630-646`) stops at
`Object.keys(CONTENT).length >= 18` regardless of whether the loaded 18 satisfy the deck
predicate; `_reverseBuildDeck` then finds <3 usable cards → native `alert()` → return. Same
pattern at `js/app/05-drills-recognize-trace.js:27-41` (Recognize) and the Match starter.
31 `alert()` call sites exist across `js/app/*.js` (grep), most of this "deck too small" class.

**PROFILE impact.** Anti-pattern list: *"Anything that gates practice behind reading"* — this
gates practice behind **manual cache-warming**, and the ADHD/autopilot posture ("press one thing
→ you're drilling") gets a modal error instead of a rep. On iOS, `alert()` also blocks the whole
page.

**Fix spec.**
1. Make pre-load **predicate-targeted**: each deck-starved drill passes its own eligibility test
   to a shared helper `await _preloadUntil(lessons, predicate, {want: 8, cap: 30})` that loads
   until `want` lessons *satisfying the predicate* exist (not until raw CONTENT count hits N).
   For Reverse the predicate is `c => c?.walkthrough && c?.L3?.expectedOutput`; for Match
   `c => c?.description`; for Recognize `c => c?.L3?.prompt`.
2. Replace the deck-too-small `alert()` (all "needs more loaded lessons" sites in
   `js/app/05|06|07|08-*.js`) with an in-shell empty state — same shape Bug-Hunt already uses at
   `08-drills-bughunt-constraint.js:205-208` (message + Back button into `renderLesson()`).
   Native alert() stays banned from launch paths.
3. Regression probe: extend `tools/cdp/audit-nav-deeplink.js` runs into CI habit — assert
   `session.dialogs.length === 0` across the sweep.

---

## P2 — friction

### P2-1 · System Design is invisible on the phone (palette-only)

**Evidence.** Matrix run: `topbar.systemDesignLink` visible=false @390 (the link lives inside
`.topbar-menus`, display:none ≤767px — `css/05-shell-chrome.css:449`), true @1280. Only other
channel: palette entry (`js/app/14-init-core.js:74-80`), which requires opening 🔍 and *typing*.
No launcher row, no rail slot (acknowledged in `css/06-ds-nav.css:89-92`), no `#/m/` slug.
INVENTORY.md: KEEP, "nav entry point stays".

**PROFILE impact.** 80% phone. A whole drill family (DDIA, design problems — the user's stated
system-design prep) is undiscoverable on the device they use most; D08 even calls the palette
entry a "net capability gain" for mobile, but a type-to-find affordance is not discovery.

**Fix spec (pre-P8).** Add a *System Design* row to the Practice launcher's
"Review & reference" group — in `18-practice-launcher.js` GROUPS render, append to the
`insights` entries an object item `{ icon: 'book-open', label: 'System Design',
desc: 'DDIA · building blocks · 16 design problems', action: 'href', href: 'system-design.html' }`
(reuses the `action:'href'` shape from P1-2 fix #2). One row, both viewports, dies cleanly in P8.

### P2-2 · Settings: rail trigger and its panel are 1,199 px apart; surviving dropdown is legacy chrome

**Evidence.** `flows.json desktopSettings`: rail button at (12,732), panel opens at (996,47) —
measured 1,199 px diagonal (shot `flows/desktop/01-settings-spatial-disconnect.png`). The rail
item synth-clicks `#topbar-settings` (`js/app/16-ds-nav.js:49-51`); the dropdown anchors to the
topbar (`js/app/15-init-features-boot.js:770-782`). On mobile it opens full-bleed under the
topbar (matrix `settingsMenu.rect`: left 0, width 390 — shot
`matrix/mobile390/02-mobile390-settings-dropdown.png`) with **emoji row icons** (🎤🔥⏱⏲📳🖍 —
D07 violation) and **no close affordance** (`flows.settingsDropdown.hasVisibleCloseAffordance:
false`; closes only via tap-outside or Esc, and phones have no Esc). It also renders *over* the
lesson rather than as a surface, and the fixed Sync chip overlaps its top edge.

**PROFILE impact.** ADHD single-focus: the eye is at the rail foot; the response appears at the
opposite screen corner. Already logged as the P4b deferral — this audit adds the measured
magnitude, the mobile no-close-affordance gap, and the emoji violation as concrete P6 acceptance
criteria.

**Fix spec.** This IS design-loop P6 (STATE.md "Next slice"); don't patch piecemeal. P6
acceptance criteria from this audit: (a) rail/bar Settings opens a ds surface adjacent to its
trigger (sheet on mobile, rail-anchored panel or page on desktop); (b) stroke icons only;
(c) visible ≥44px close affordance; (d) absorb the topbar 🔍/?/⚙ strip (see P2-6); (e) the
`#/m/` story for toggles per P2-5.

### P2-3 · Bridge (transfer-gap insight) has no visible home

**Evidence.** Matrix: `bridge-btn` appears in no launcher group, no Progress row (grep
`js/app/20-progress.js` — zero hits), no Browse control; palette + `#/m/bridge` only (deep link
works: routes to the gap lesson at L1 with toast — verified in sweep, `lesson=map-set`).
INVENTORY says MERGE→Progress; STATE.md P5-deferred admits "give it a Fix-first row in a later
slice." With the sidebar retired (D10), the old count-pill is gone, so the mode lost its last
glanceable channel.

**PROFILE impact.** § What they need #5 (memorization tooling — transfer/interleaving); the
mechanics-transfer insight can no longer *interrupt* the user with an opportunity, which was its
entire job.

**Fix spec.** Add a Bridge action row to Progress "Fix first" behind the existing pattern:
in `_progAttentionHtml` (`js/app/20-progress.js:157-212`) append, when
`_bridgeCandidates().length > 0`, a `data-prog-action="bridge"` row ("Bridge N transfer gaps —
you know this mechanic in another track"); wire it in the existing `data-prog-action` dispatcher
(`:492-494`, add `bridge: 'bridge-btn'` to the target map). ~15 lines, same synthetic-click
contract as Resurrect/Reveal.

### P2-4 · The 16 family drills can't be *chosen* — launcher offers only a random pick

**Evidence.** Matrix launcher dump: 14 direct rows; recognize/reverse/constellation/match,
crystal/whatif/trace-hop/reverse-walk, bug-hunt/mutate/claim/constraint-shift/swap,
notes-drill/notes-locate/gotcha exist **only** inside `action:'shuffle'` rows
(`js/app/15-init-features-boot.js:544-549`) — tapping "Name the pattern" launches a random
family member. Deterministic launch of a specific drill requires the palette (typing) or a
memorized `#/m/` URL. Progress's per-drill "Drill" buttons (`20-progress.js:264-277`) only render
after the family has non-zero lifetime attempts — no discovery channel.

**PROFILE impact.** Mixed: the 2026-05-29 IA trim was a deliberate ADHD de-clutter (5 family
rows instead of 17). But "limited working memory" cuts both ways — a user who *knows* they want
Swap-Bench now types into a palette on a phone keyboard. Friction, not absence (palette works),
hence P2 not P1.

**Fix spec.** Keep the family rows as the primary tap (random pick is good interleaving); add a
small `▾` disclosure chevron per family row in the launcher that expands the member list inline
(reuse `.ds-row` at reduced height; members resolve via the same `data-btn-id` contract). Zero
new state; `TOPBAR_MENU_TAXONOMY` already carries `ids[]` per family.

### P2-5 · `#/m/` toggle routes mutate state invisibly; `#/m/install` throws; `#/m/reset` opens a bare confirm

**Evidence.** Deep-link sweeps: `#/m/hide-mastered|path|repair-filter|clarify-ritual|hotseat|
calibrate|pace-bar|haptic|adhd-mode|font-size` cold-boot into the resumed lesson with **no
visible response** — but the toggle *did* flip (they're settings mutations; a bookmarked/
history-recalled URL silently changes behavior every visit). `#/m/install` logs
`NotAllowedError: prompt() … must be called with a user gesture` (boot dispatch isn't a gesture).
`#/m/reset` fires the native confirm dialog straight off boot (captured in `session.dialogs`,
both viewports) — a drive-by URL can present a data-destruction dialog as the first paint.

**PROFILE impact.** Deep links exist for cmd+click/new-tab workflows (CLAUDE.md Dashboard
section); silent state flips violate "progress + scores at a glance" trust, and reset-on-boot is
a footgun.

**Fix spec.** Classify mode routes in `_dispatchModeRoute` (`js/app/10-render-sidebar-lesson.js:
447-452`): keep a small `MODE_ROUTE_SURFACE = { 'hide-mastered': 'browse', path: 'browse',
'repair-filter': 'browse', 'clarify-ritual': 'settings', … , install: 'settings', reset:
'settings' }` map; for those slugs open the owning surface (Browse with its filter panel open /
the Settings surface once P6 lands, `#topbar-settings` dropdown until then) **instead of**
synth-clicking the toggle. Non-toggle slugs keep today's behavior. This also gives `#/m/install`
a gesture-capable home instead of a console error.

### P2-6 · Desktop offers four search affordances; topbar redundancy with the rail

**Evidence.** `flows.desktopSearchAffordances`: topbar 🔍 (`#palette-trigger`) + rail "Search ⌘K"
+ `/` + Cmd-K all open the same palette; the rail-foot Settings duplicates topbar ⚙, and topbar
"Plan" (`goToPlanHome`, `js/app/03-paths-cram.js:303`) opens a legacy-styled Plan home that
overlaps Today home + Today's-Plan modal (three "what's my plan" surfaces, two visual languages —
shot `matrix/desktop1280/02-…png` shows the legacy dropdown against ds chrome). The
Problems⇄Reference toggle now only steers Browse-segment sync + swaps the current lesson
(`flows.surfaceToggle`: click flipped surface AND navigated two-sum → s-variables) — its
drawer-era main job is gone (STATE.md P4c-deferred #4 predicted this).

**PROFILE impact.** Decisions-budget: persistent chrome should cap at ~4 destinations (D01);
today's desktop header re-adds 6 controls, two of them duplicating the rail 40 px away.

**Fix spec (P6 scope, enumerated).** (a) Drop topbar 🔍 and ⚙ at ≥768px once P6's Settings
surface exists (rail already carries both); keep ? or fold help into Settings. (b) Mobile keeps
the 🔍/?/⚙ strip until the bar/sheet grows equivalents. (c) Decide Plan-button's fate against
Today home (recommendation: "Plan" becomes a Today-home section link, the legacy Plan home page
retires with it). (d) Problems⇄Reference: fold into Browse's segments (already exist) and drop
from the topbar at ≥768px; on mobile it's the only track-context switcher on a lesson, so it
stays until P7 revisits lesson chrome.

### P2-7 · Fixed Sync chip collides with session chrome

**Evidence.** Live measurement: in a Rapid-Fire session @390 the chip rect (321,52,61×26)
**intersects** the ✕ Exit button rect (315,30,49×27) and overlays the session progress bar
(shot `flows/mobile/03-rapid-fire-session.png`); it also overlaps the settings dropdown's top
edge (shot `matrix/mobile390/02-…png`) and the diagnostic page's header text ("Int…" truncated
behind it — shot `pages/mobile390/01-diagnostic-top.png`). `js/sync.js` mounts it
`position:fixed` top-right unconditionally.

**Fix spec.** In `js/sync.js`, hide the chip while `body.in-session` or `state.mock.active`
(one CSS rule: `body.in-session .sync-chip { display: none; }` + class hook), and give
`diagnostic.html`'s sticky header a right-padding equal to the chip width. Long-term (P6):
sync status moves into Settings per INVENTORY, chip becomes ambient-only.

---

## P3 — polish

- **P3-1 · Palette has no entries for the four nav destinations.** Typing "browse", "today",
  "practice" or "progress" into ⌘K finds nothing (only "Dashboard" aliases Progress) — the
  index scans `aside button[id]` (`14-init-core.js:82`) and the shell buttons are outside the
  aside with empty labels. Fix: push 4 static entries beside the Dashboard one.
- **P3-2 · Palette lists context-dead modes.** `cram-cheat/glossary/behavior/shapes/review`
  index even under a non-cram plan (they open, but content is plan-scoped), `offline-pack (0)`
  and Install index while hidden. `_paletteBuildIndex` should skip
  `style.display==='none'`/`.hidden` buttons the way `_topbarItemFromButton`
  (`15-init-features-boot.js:623-626`) already does — minus the curation-hidden exemption.
- **P3-3 · `j`/`k` on shell pages silently teleports into a lesson.** On Today home pressing `j`
  swapped to the next lesson (flows.todayKeyboard: `stillToday:false`) — surprising exit,
  no data loss. Gate lesson-nav keys on "a lesson is rendered" in `initSearchAndKeyboard`
  (`14-init-core.js:822-827`).
- **P3-4 · Session exits are small and Esc-dead.** Drill sessions' "✕ Exit" measures 49×27
  (<44px, `flows.sessionDrill.exitSize`) and Escape does not exit a session (by design for
  modals only, `14-init-core.js:806-819`). Bottom nav remains visible as a second exit ✓. Fix:
  min-height 44px on `.recognize-exit`-class buttons; optionally add sessions to the Esc chain.
- **P3-5 · Legacy modal close buttons are 13×22 px** on mobile (today/mechanics/cheatsheet/
  audio/path/help — `flows.mobileModals[*].closeW/H`); diagnostic.html's "← Drill" return link
  is 42×20 (`pages.json`). All work but are sub-target-size; P7/P8 restyle should enforce
  ≥44px (`--ds-tap`).
- **P3-6 · First-run boots onto a lesson behind the welcome modal**, not Today home
  (`flows.firstRun.surface: lesson:s-variables`; boot resolves first full lesson,
  `14-init-core.js:281-284`). Coherent but off-message for the P2 Today-home-as-landing model;
  consider `openTodayHome()` as the no-resume default post-welcome.
- **P3-7 · Progress "Drill accuracy" rows are usage-gated** (`20-progress.js:264-267` filters
  `attempts > 0`), so Progress never *introduces* a drill. Fine per PROFILE (facts only), noted
  so P6/P7 don't mistake it for a reachability hole.
- **P3-8 · Empty states verified healthy** (not a finding — evidence for the record):
  zero-history Today shows "Start a streak" + 2 starter reps; Browse renders all sections;
  Progress zeros cleanly; no NaN/undefined text found (flows.firstRun_*, shots
  `flows/firstrun/0*.png`).

---

## Cross-page round trips (task 2 summary)

| | Entry @390 | Entry @1280 | Return path | App nav on page |
|---|---|---|---|---|
| system-design.html | palette only (**P2-1**) | topbar link + palette | "JS Drill ↗" 80×44 ✓ (`system-design.html:229`) | none (own header only) |
| diagnostic.html | welcome modal only (**P1-2**) | welcome modal only | "← Drill" 42×20 (small, P3-5; `diagnostic.html:109`) | none; Sync chip overlaps header (P2-7) |

Neither page carries the bottom bar/rail — a phone user who arrives is one small header-link tap
from home, which is survivable; the real losses are the *inbound* doors (P1-2, P2-1). The
proposed pre-P8 fixes (palette + launcher `action:'href'` rows + the two return links already
present) close the loop without preempting P8's unification.

---

## Appendix A — mode × channel × viewport reachability matrix

Legend: *Visible surface* = a tappable affordance on Today home / Browse / Practice launcher /
Progress / remaining topbar / settings dropdown (palette excluded). *Launcher(random-in-family)*
= reachable only as a random pick inside a family row. `#/m/` column = observed surface after a
cold boot with that hash. "no-visible-surface (lesson:X)" = the route ran (navigation modes DID
navigate — see lesson id; toggle modes flipped state) but painted no surface. Seeded returning-
user state; cram-* rows appear in the launcher's Reference group only under a cram plan
(`applySidebarCuration`, `js/app/03-paths-cram.js` — by design, verdict MERGE→Browse).

Mobile-sweep `WATCHDOG` rows for mutate / constraint-shift / hotseat / today / cram-review /
rapid-fire are collateral of the P1-1 frozen tab pegging the CPU (all six passed on the desktop
sweep); `bug-hunt`'s watchdog is the genuine 2/2 freeze.

| Mode | Visible surface @390 | Visible surface @1280 | Palette | `#/m/` cold boot @390 | `#/m/` cold boot @1280 |
|---|---|---|---|---|---|
| `adhd-mode` | Settings menu | Settings menu | yes | no-visible-surface (toggle flips) | no-visible-surface (toggle flips) |
| `ai-coach` | Launcher | Launcher | yes | no-visible-surface (clipboard export) | no-visible-surface (clipboard export) |
| `at-risk` | Progress page (nav) | Progress page (nav) | yes | page:progress ✓ | page:progress ✓ |
| `audio` | Launcher | Launcher | yes | modal:audio ✓ | modal:audio ✓ |
| `backup` | Settings menu | Settings menu | yes | no-visible-surface (download fires) | no-visible-surface (download fires) |
| `big-o` | Launcher | Launcher | yes | session ✓ | session ✓ |
| `bridge` | — **(P2-3)** | — **(P2-3)** | yes | navigates to gap lesson ✓ | navigates to gap lesson ✓ |
| `browse` | Nav bar/rail | Nav bar/rail | NO (P3-1) | page:browse ✓ | page:browse ✓ |
| `bug-hunt` | Launcher(random-in-family) | Launcher(random-in-family) | yes | **FREEZE (P1-1)** | **FREEZE (P1-1)** |
| `calibrate` | Settings menu | Settings menu | yes | no-visible-surface (toggle flips) | no-visible-surface (toggle flips) |
| `claim` | Launcher(random-in-family) | Launcher(random-in-family) | yes | session ✓ | session ✓ |
| `clarify-ritual` | Settings menu | Settings menu | yes | no-visible-surface (toggle flips) | no-visible-surface (toggle flips) |
| `constellation` | Launcher(random-in-family) | Launcher(random-in-family) | yes | session ✓ | session ✓ |
| `constraint-shift` | Launcher(random-in-family) | Launcher(random-in-family) | yes | collateral watchdog (see note) | session ✓ |
| `conv-drill` | Launcher | Launcher | yes | session ✓ | session ✓ |
| `cram-behavior` | — (cram plans only) | — (cram plans only) | yes (P3-2) | modal:cram-ref | modal:cram-ref |
| `cram-cheat` | — (cram plans only) | — (cram plans only) | yes (P3-2) | modal:cram-ref | modal:cram-ref |
| `cram-glossary` | — (cram plans only) | — (cram plans only) | yes (P3-2) | modal:cram-ref | modal:cram-ref |
| `cram-review` | — (cram plans only) | — (cram plans only) | yes (P3-2) | collateral watchdog (see note) | modal:cram-ref ✓ |
| `cram-shapes` | — (cram plans only) | — (cram plans only) | yes (P3-2) | modal:cram-ref | modal:cram-ref |
| `crystal` | Launcher(random-in-family) | Launcher(random-in-family) | yes | **ALERT dead-end (P1-3)** | **ALERT dead-end (P1-3)** |
| `dashboard` | Nav bar/rail (Progress) | Nav bar/rail (Progress) | yes | page:progress ✓ | page:progress ✓ |
| `export` (Cheatsheet) | Launcher | Launcher | yes | modal:cheatsheet ✓ | modal:cheatsheet ✓ |
| `font-size` | Settings menu | Settings menu | yes | no-visible-surface (toggle flips) | no-visible-surface (toggle flips) |
| `gauntlet` | Launcher | Launcher | yes | session ✓ | session ✓ |
| `gotcha` | Launcher(random-in-family) | Launcher(random-in-family) | yes | session ✓ | session ✓ |
| `haptic` | Settings menu | Settings menu | yes | no-visible-surface (toggle flips) | no-visible-surface (toggle flips) |
| `hide-mastered` | Browse filters | Browse filters | yes | no-visible-surface (toggle flips, P2-5) | no-visible-surface (toggle flips, P2-5) |
| `hotseat` | Settings menu | Settings menu | yes | collateral watchdog (see note) | no-visible-surface (toggle flips) |
| `install` | Settings menu | Settings menu | yes | **console error (P2-5)** | **console error (P2-5)** |
| `lucky` | — (pick-smart fallback only) | — (pick-smart fallback only) | yes | navigates to random lesson ✓ | navigates to random lesson ✓ |
| `match` | Launcher(random-in-family) | Launcher(random-in-family) | yes | **ALERT dead-end (P1-3)** | **ALERT dead-end (P1-3)** |
| `mechanics` | Launcher | Launcher | yes | modal:mechanics ✓ | modal:mechanics ✓ |
| `mock` | Launcher; Today (empty state) | Launcher; Today (empty state) | yes | mock starts ✓ | mock starts ✓ |
| `mutate` | Launcher(random-in-family) | Launcher(random-in-family) | yes | collateral watchdog (see note) | session ✓ |
| `notes-drill` | Launcher(random-in-family) | Launcher(random-in-family) | yes | session ✓ | session ✓ |
| `notes-locate` | Launcher(random-in-family) | Launcher(random-in-family) | yes | session ✓ | session ✓ |
| `offline-pack` | Settings menu (count-gated) | Settings menu (count-gated) | yes (P3-2) | no-visible-surface | no-visible-surface |
| `pace-bar` | Settings menu | Settings menu | yes | no-visible-surface (toggle flips) | no-visible-surface (toggle flips) |
| `path` (Plan view) | Browse filters | Browse filters | yes | no-visible-surface (toggle flips, P2-5) | no-visible-surface (toggle flips, P2-5) |
| `phone-screen` | Launcher | Launcher | yes | session ✓ | session ✓ |
| `practice-launcher` | Nav bar/rail | Nav bar/rail | NO (P3-1) | launcher opens ✓ | launcher opens ✓ |
| `rapid-fire` | Launcher | Launcher | yes | collateral watchdog (see note) | session ✓ |
| `recognize` | Launcher(random-in-family) | Launcher(random-in-family) | yes | ALERT dead-end (intermittent, P1-3) | session ✓ |
| `repair-filter` | Browse filters (Needs work) | Browse filters (Needs work) | yes | no-visible-surface (toggle flips, P2-5) | no-visible-surface (toggle flips, P2-5) |
| `reset` | Settings menu | Settings menu | yes | **bare confirm on boot (P2-5)** | **bare confirm on boot (P2-5)** |
| `restore` | Settings menu | Settings menu | yes | no-visible-surface (file picker) | no-visible-surface (file picker) |
| `resurrect` | Progress · Fix first | Progress · Fix first | yes | navigates to overdue lesson ✓ | navigates to overdue lesson ✓ |
| `reveal-replay` | Progress · Fix first | Progress · Fix first | yes | navigates to revealed lesson ✓ | navigates to revealed lesson ✓ |
| `reverse` | Launcher(random-in-family) | Launcher(random-in-family) | yes | **ALERT dead-end (P1-3)** | **ALERT dead-end (P1-3)** |
| `reverse-walk` | Launcher(random-in-family) | Launcher(random-in-family) | yes | session ✓ | session ✓ |
| `review` | — (Today hero covers due; lesson CTA) | — (same) | yes | navigates to due lesson @L2 ✓ | navigates to due lesson ✓ |
| `sections-grid` | Launcher | Launcher | yes | session (heatmap) ✓ | session ✓ |
| `shuffle` | — (lesson CTA + `s` key) | — (same) | yes | navigates ✓ | navigates ✓ |
| `speedrun` | Launcher | Launcher | yes | session (picker) ✓ | session ✓ |
| `stats` | Progress page (nav) | Progress page (nav) | yes | page:progress ✓ | page:progress ✓ |
| `streak-map` | Progress page (nav) | Progress page (nav) | yes | page:progress ✓ | page:progress ✓ |
| `swap` | Launcher(random-in-family) | Launcher(random-in-family) | yes | session ✓ | session ✓ |
| `today` (Plan modal) | Launcher | Launcher | yes | collateral watchdog (see note) | modal:today ✓ |
| `today-home` | Nav bar/rail | Nav bar/rail | NO (P3-1) | page:today-home ✓ | page:today-home ✓ |
| `trace-hop` | Launcher(random-in-family) | Launcher(random-in-family) | yes | session ✓ | session ✓ |
| `warmup` | Launcher | Launcher | yes | session ✓ | session ✓ |
| `weak` | — (Progress Fix-first rows cover weak lessons) | — (same) | yes | navigates to weak lesson ✓ | navigates ✓ |

**Reading of the matrix.** No mode is reachable by *zero* channels on either viewport — the D05
contract technically holds. The palette carries all 62 mode buttons (plus Dashboard + System
Design; 260 total entries with lessons + sections). The holes are qualitative: P1-1/P1-3 break
three channels' *outcomes*; `bridge` (P2-3) and the phone-side System Design (P2-1) and
diagnostic (P1-2) are the discoverability gaps; the 10 toggle-type `#/m/` routes are silent
mutators (P2-5).

## Appendix B — probe inventory & re-run instructions

```bash
# one-time per container
bash tools/cdp/fetch-vendor.sh && npm install --no-save ws
/opt/pw-browsers/chromium --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug-jsdrill --headless=new --no-sandbox &
python3 -m http.server 8765 &

node tools/cdp/audit-nav-matrix.js   <out.json> <shotsDir>   # channels per viewport
node tools/cdp/audit-nav-deeplink.js mobile  <out.json> [skipCsv]  # 64 cold boots
node tools/cdp/audit-nav-deeplink.js desktop <out.json>
node tools/cdp/audit-nav-pages.js    <out.json> <shotsDir>   # system-design/diagnostic
node tools/cdp/audit-nav-flows.js    <out.json> <shotsDir>   # escapes/keyboard/first-run/z-order
```

Infra note added during this audit: `tools/cdp/lib.js` now auto-dismisses native JS dialogs
(`Page.javascriptDialogOpening` → cancel) and records them on `session.dialogs` — without this,
any probe that trips an app `alert()` hangs forever (bit this audit three times). The deep-link
probe also demonstrates the watchdog + fresh-tab recovery pattern needed to survive P1-1's
freeze, and writes results incrementally.

Screenshots referenced throughout: `iter-artifacts/audits/nav-shots/{matrix,pages,flows}/…`.
