# Refine iter 10 — today-plan (primary CTA)

**Surface:** Today's Plan modal (`openToday()` in `js/app/14-init-core.js:1337+`).
**Primary file:** `js/app/14-init-core.js` (HAS user WIP — Font Scale toggle in `initSettingsToggles` at line 633; Today modal renderer at line 1340 is a DIFFERENT function, no conflict; git-apply-cached pattern).
**Picker rationale:** Continuing iter-5's queued backlog item "Primary 🎯 Start CTA at top." Iter 5 fixed mobile clipping (Phone-fit 0→3); this iter targets the much-bigger Autopilot gap (1/3) on the SURFACE PROFILE.md explicitly names as the user's "autopilot."

## Step 2 — Empirical observations (re-use iter-5 AFTER state as iter-10 BEFORE)

The current state of the Today's Plan modal (post-iter-5) is captured at `/tmp/jsdrill-refine-05-after/02-04-midflight-mobile.png` and the desktop equivalent. Each item renders as a stacked card: track-pill + title on row 1, color-tinted why-tag pill on row 2. Six items in the mid-flight scenario: 3 review-due, 1 weak spot, 2 next-on-plan. **All six cards are visually equal-weighted — the ADHD user must read every card to decide which to tap.**

**Caption:**
- (a) Eye lands on the modal heading "Today's session" + the first card's track-pill.
- (b) Competes for tap/attention: 6 equal-weight cards. No primary CTA. No visual hierarchy among items.
- (c) Hidden: the autopilot intent. PROFILE.md line 76-78 says "press one thing → you're drilling" but the modal currently asks "compare 6, then press one."

## Step 2.5 — Vision

> If Today's Plan were the BEST it could be for the PROFILE.md user
> (autopilot-intent, ADHD, limited study time), tapping the 📅 Today's
> Plan button would land on a single primary CTA at the top — "🎯 Start:
> <smartest pick right now> (<why>)" — sized like a real button, with
> the remaining items below as `or pick another ▾`. One tap = drilling.
> The user skips the "compare 6 blurbs" cognitive overhead and trusts the
> app's pick (which is already a curated mix of SR-due + weak + path, per
> dailyPlan()). For the unsure user, the secondary list is right there to
> override. This is the most direct embodiment of PROFILE's autopilot
> principle on the surface PROFILE literally names as the autopilot.

The smallest visible step toward this vision THIS iter: **insert a primary
CTA above the 6-card list** pointing at `plan[0]` (the most-overdue review,
or the weak spot, or the next-on-plan — whatever dailyPlan ranks first).
The list below stays untouched. No selection logic change. No new state.

## Step 3 — Rubric (post-iter-5)

| Dim | Score | Evidence |
|---|---|---|
| Autopilot | 1/3 | 6-card list with NO primary CTA; user picks one of 6. PROFILE 76-78. |
| Decisions | 1/3 | 6 equal-weight buttons. ADHD load. |
| Phone-fit | 3/3 | iter-5 fix — stacked cards, no tag clipping on 390px. |
| Time-respect | 1/3 | No per-item time signal. (iter-5 backlog item, still queued.) |
| Diagnostic-aware | 2/3 | dailyPlan uses SR-due + weakness + path. Doesn't expose ranking rationale beyond color-coded tag. |
| Progress-visible | 1/3 | Generic sub-line ("Curated from your due reviews…"). No "Today: X/N done" counter. |
| ADHD-fit | 2/3 | Calmer than pre-iter-5 (stacked badges) but still 6 items + 3 colors + no visual leader. |

**Total: 11/21** (matches iter-5 projection). Target dimension: **Autopilot** (lifts Decisions + ADHD-fit secondarily).

## Step 4 — Proposal

**Target dimension:** Autopilot (lifts Decisions + ADHD-fit).

**Change:** In `js/app/14-init-core.js` `openToday()` (~line 1340), when `plan.length > 0`, prepend a primary `🎯 Start: <plan[0].title>` button above the existing 6-card list, plus a faint "Or pick another" divider between the CTA and the list. The primary button calls `selectLesson(plan[0].id)` and closes the modal — same flow as a list item click, just elevated.

**Closest step toward Step 2.5 vision because:** The vision wants ONE primary tap to start the smartest pick. The minimum-surgery step is the visual elevation — uses existing `dailyPlan()` ranking, existing `selectLesson()` handler, existing modal-close path. Zero new state.

**Why for user:** PROFILE.md line 76-78 ("If it adds a decision the user has to make BEFORE they can start drilling, justify it loudly. The default posture is 'press one thing → you're drilling.'"); PROFILE.md line 48-50 (ADHD "single-focus surfaces, not menus-of-menus"); PROFILE.md line 53-54 ("Default actions matter more than option exhaustiveness").

**Mockup (mobile, mid-flight with 6 items):**

```
BEFORE (post-iter-5):

  ┌─ 📅 Today's session ───────────────────────────────┐
  │ Curated from your due reviews, starter path, and   │
  │ weak spots. Click any item to start.               │
  │ ┌────────────────────────────────────────────────┐ │
  │ │ PATTERN  Contains Duplicate                    │ │
  │ │   ◔ review due                                 │ │
  │ └────────────────────────────────────────────────┘ │
  │ ┌────────────────────────────────────────────────┐ │
  │ │ PATTERN  Valid Anagram                         │ │
  │ │   ◔ review due                                 │ │
  │ └────────────────────────────────────────────────┘ │
  │ … 4 more items …                                   │
  └────────────────────────────────────────────────────┘
   ^^^ 6 items, all equal-weight — user compares to choose

AFTER:

  ┌─ 📅 Today's session ───────────────────────────────┐
  │ Curated from your due reviews, starter path, and   │
  │ weak spots. Click any item to start.               │
  │                                                    │
  │ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │  ← PRIMARY
  │ ┃ 🎯 Start: Contains Duplicate  · review due  ➜ ┃ │     emerald,
  │ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │     prominent
  │                                                    │
  │ ── Or pick another ──                              │  ← subtle divider
  │                                                    │
  │ ┌────────────────────────────────────────────────┐ │
  │ │ PATTERN  Contains Duplicate                    │ │  (same list,
  │ │   ◔ review due                                 │ │   unchanged)
  │ └────────────────────────────────────────────────┘ │
  │ ┌────────────────────────────────────────────────┐ │
  │ │ PATTERN  Valid Anagram                         │ │
  │ │   ◔ review due                                 │ │
  │ └────────────────────────────────────────────────┘ │
  │ … 4 more items …                                   │
  └────────────────────────────────────────────────────┘
   ^^^ ONE primary tap = drilling; list still there for overrides
```

**Files touched:** `js/app/14-init-core.js` (one prepend inside `openToday()`'s else branch).

**Test:** Extend `tools/cdp/refine-today-plan.js` — assert (a) when `plan.length > 0`, a `[data-action="start-first"]` button exists at the top of `#today-body`, (b) its text contains `🎯 Start:` AND the first plan item's lesson title, (c) clicking it triggers `selectLesson(plan[0].id)` (verifiable by `state.currentLessonId` flipping to the first item's id), AND (d) the existing 6-card list is still present below.

**Rubric projection:** 11/21 → 15/21 (Autopilot 1→3 = +2, Decisions 1→2 = +1, ADHD-fit 2→3 = +1).

## Step 5 — Contrarian verdict

**GREEN-LIGHT:** "Adds a single primary tap that embodies the 'press one thing → you're drilling' autopilot rule (PROFILE line 77-78) while preserving the 6-card list as override — REMOVES a decision rather than adding one, doesn't break mobile, and doesn't hide progress."

## Step 7 — Implementation + verification

**Change shipped:** `js/app/14-init-core.js` `openToday()` else branch — when `plan.length > 0`, prepend an emerald primary button `[data-action="start-first"]` pointing at `plan[0]` ("🎯 START · <title> · <why>"), plus a faint "— OR PICK ANOTHER —" divider. Reuses the existing `[data-lesson-id]` click-handler loop so the new button and the 6 list cards all wire from one forEach.

**Validator:** `node tools/validate-data.js` → 803 passed, 0 failed.

**Probe:** `node tools/cdp/refine-today-plan.js /tmp/jsdrill-refine-10-after` → **13/13 assertions pass**:
- 6 iter-10 primary-CTA assertions (desktop): CTA present · text contains `🎯 Start` · CTA's data-lesson-id matches first list card's · 7 total `[data-lesson-id]` elements (CTA + 6 cards) · clicking CTA navigates to `p-contains-dup` · modal closes after click
- 7 iter-5 mobile clipping assertions (regression coverage — still green)

**Visual diff:**
- BEFORE `/tmp/jsdrill-refine-05-after/02-02-midflight-desktop.png`: 6 equal-weight stacked cards, no primary leader.
- AFTER `/tmp/jsdrill-refine-10-after/02-02-midflight-desktop.png`: prominent emerald `🎯 START · Contains Duplicate · review due ➜` at top + "— OR PICK ANOTHER —" divider + the same 6-card list below.

**Rubric:** 11/21 → 15/21 (Autopilot 1→3 = +2, Decisions 1→2 = +1, ADHD-fit 2→3 = +1).

**Git note:** Primary file had user WIP (Font Scale toggle in `initSettingsToggles` at line 633). My hunks are in `initTodaysPlanModal` at lines 1343 + 1376 — different functions, no overlap. Staged via `git apply --cached --recount` of a filtered patch; user's font-scale WIP preserved untouched.

## Queued to backlog (carried from iter 5)

- Per-item time estimate chip below the badge.
- Today completed counter ("Today: X/N done") in the modal heading.
- Smart re-ordering within the plan (overdue-age, recency-of-miss).
- Empty-state primary CTA when plan.length === 0 (e.g., "🎯 Start a Mock Interview" since they're caught up).

