# Refine iter 5 — today-plan

**Surface:** Today's Plan modal (Starter Plan `kind:'lessons'` mode — `openToday()` in `js/app/14-init-core.js:1337+`).
**Primary file:** `js/app/03-paths-cram.js` (registry side) + `js/app/14-init-core.js` (the modal renderer — the actual surface).
**Picker rationale:** Git-staleness — `03-paths-cram.js` latest touch is 2026-05-27 22:56 (yesterday), tied with `plan-picker-modal`. Today-plan chosen because PROFILE.md line 59-78 explicitly names it as the user's "autopilot" surface — highest profile-alignment.
**PROFILE constraint:** 80% phone — mobile-fit is load-bearing here. ADHD low-overwhelm-tolerance matters.

## Step 2 — Empirical observations (`/tmp/jsdrill-refine-05/`)

Probe `tools/cdp/refine-today-plan.js` captured the modal at desktop (1280×800) + mobile (375×667), in two states: cold-start (no progress) and mid-flight (4 due + 1 weak + 2 next = 6 items).

**Desktop mid-flight:** 6 stacked button-items each ~60px tall. Each row: track pill (PATTERN/SYNTAX) + lesson title on left, why-tag ("review due" cyan / "weak spot" orange / "next on plan" blue) on right via `flex; justify-content:space-between`. Visually busy but readable.

**Mobile mid-flight:** The same `flex justify-between` layout doesn't fit. Long titles ("Two Sum (hash map)", "Group Anagrams") wrap to multiple lines. The right-side why-tags get CLIPPED off the visible modal width — "review due" becomes "rev" or invisible. The user cannot see WHY each item is on the list on a phone.

**Mobile cold-start:** Modal is positioned where it should be (centered) but each item's title pushes the why-tag off-screen → user sees `SYNTAX | Variables & types | next o` (cut off). PROFILE-critical breakage on the autopilot surface.

**Caption (per `/browser-test`):**
- (a) Eye lands on heading "Today's session" + the first item's track pill.
- (b) Competes: 6 equal-weight items + 3 differently-colored labels + the sub-line copy — no single primary anchor.
- (c) Hidden on mobile: the why-tag of every item. Hidden universally: per-item time estimate; today's completion progress.

## Step 2.5 — Vision

> If Today's Plan were the BEST it could be for the PROFILE.md user, it would
> open with ONE recommended next action presented as the primary surface — "🎯
> Start: Group Anagrams (weak spot · ~5 min)" — with the remaining items listed
> below as `or pick another ▾`. Mobile-first stacked layout: track + title on
> one line, why-tag + time on another, never side-clipped. A small "Today: X/N
> done" counter at the top would make the session feel like a workout you're
> progressing through, not a forever-list. Diagnostic signal would weight the
> order so the most-overdue or freshest-miss surfaces first — the autopilot
> picks the order, not just the contents.

The smallest visible step toward this vision THIS iter: **fix the mobile-clipping by stacking each item vertically (title row + tag row).** The smart-ordering, primary CTA, time-estimates, and today-progress counter are bigger surgeries — queued to backlog.

## Step 3 — Rubric

| Dim | Score | Evidence |
|---|---|---|
| Autopilot | 1/3 | 6-item list with no primary CTA. PROFILE 76-78 wants "press one thing → drilling." |
| Decisions | 1/3 | 6 equal-weight buttons with 3 color-coded tags; user has to pick. |
| Phone-fit | 0/3 | Why-tag clipped on mobile; long titles wrap awkwardly. Modal unreadable on 375px viewport (see `04-midflight-mobile.png`). PROFILE line 27. |
| Time-respect | 1/3 | No per-item time estimates; can't pick the right item for the available 5-min window. |
| Diagnostic-aware | 2/3 | Uses SR-due + weakness + path. Doesn't weight by overdue-age or freshest-miss. |
| Progress-visible | 1/3 | Generic sub-line ("Curated from your due reviews, starter path, and weak spots"). No today-completed counter. |
| ADHD-fit | 1/3 | 6 items + 3 colors + sub-line + heading = busy. Not single-focus. |

**Total: 7/21.** Target dimension: **Phone-fit** (0/3 → fix the visible breakage). ADHD-fit lifts as a secondary effect (calmer stacked layout).

## Step 4 — Proposal

**Target dimension:** Phone-fit (lifts ADHD-fit secondarily).

**Change:** In `js/app/14-init-core.js` `openToday()` button template (~lines 1349-1352), replace the single-row `flex justify-between` (title left, tag right) with a vertical stack — track-pill + title on row 1, small why-tag badge on row 2. Universal change (mobile + desktop both benefit). Use color-tinted background on the why-badge so it stays scannable.

**Closest step toward Step 2.5 vision because:** The vision wants per-item info readable at a glance on mobile. A stacked layout is the minimum-surgery fix that makes the why-tag visible on phone without changing any other behavior.

**Why for user:** PROFILE.md line 27 ("~80% of study time is on a phone"); PROFILE.md line 76-78 (autopilot — but the user can't autopilot through items whose labels they can't read).

**Mockup:**

```
BEFORE (mobile, 375px viewport — what users actually see):

  ┌─ Today's session ─────────────────────────────────┐
  │ PATTERN  Contains Duplicate            rev▌       │  ← "review due" clipped
  │ PATTERN  Valid Anagram                 rev▌       │
  │ PATTERN  Two Sum (hash                 rev▌       │  ← title wraps
  │          map)                                     │
  │ PATTERN  Group Anagrams                wea▌       │  ← "weak spot" clipped
  │ SYNTAX   Variables & types             nex▌       │  ← "next on plan" clipped
  │ SYNTAX   Numbers & Math                nex▌       │
  └───────────────────────────────────────────────────┘

AFTER (mobile, 375px — stacked, nothing clipped):

  ┌─ Today's session ─────────────────────────────────┐
  │ PATTERN  Contains Duplicate                       │
  │   ◔ review due                                    │
  │ ─────────────────────────────────────             │
  │ PATTERN  Valid Anagram                            │
  │   ◔ review due                                    │
  │ ─────────────────────────────────────             │
  │ PATTERN  Two Sum (hash map)                       │
  │   ◔ review due                                    │
  │ ─────────────────────────────────────             │
  │ PATTERN  Group Anagrams                           │
  │   ◐ weak spot                                     │
  │ ─────────────────────────────────────             │
  │ SYNTAX   Variables & types                        │
  │   ◯ next on plan                                  │
  │ ─────────────────────────────────────             │
  │ SYNTAX   Numbers & Math                           │
  │   ◯ next on plan                                  │
  └───────────────────────────────────────────────────┘

  DESKTOP (1280px) — same stacked layout, just narrower per item ratio.
```

**Files touched:** `js/app/14-init-core.js` (one template literal in `openToday()`).

**Test:** `tools/cdp/refine-today-plan.js` — at mobile viewport (375), assert every why-tag's full text is present in the DOM AND has `offsetWidth + offsetLeft <= modal-right-edge` (not clipped). Currently fails by visual inspection; after fix should pass programmatically.

**Rubric projection:** 7/21 → 11/21 (Phone-fit 0→3 = +3; ADHD-fit 1→2 = +1).

## Step 5 — Contrarian verdict

**GREEN-LIGHT:** "Stacking title above the why-tag preserves the same 6 items, same order, same one-tap-to-drill autopilot (no added decisions), and restores the clipped why-tag — which is the diagnostic-aware signal ('review due'/'weak spot'/'next on plan') the user needs to see on the 80%-phone surface; it fixes a mobile-first breakage rather than introducing one."

## Step 7 — Implementation + verification

**Change shipped:** `js/app/14-init-core.js` `openToday()` button template — flex-direction changed from row (`justify-content:space-between`) to column (`align-items:stretch; gap:6px`). The why-tag becomes a small color-tinted pill badge below the title row instead of a clipped sibling on the right. New `data-why-tag` attribute hooks the probe's clipping assertion.

**Validator:** `node tools/validate-data.js` → 803 passed, 0 failed.

**Probe:** `node tools/cdp/refine-today-plan.js /tmp/jsdrill-refine-05-after` — captures the modal at desktop (1280×800) + mobile (390×844), then asserts on mobile that each `[data-why-tag]` rect.right ≤ modal-body rect.right + 1.

**Visual diff (BEFORE → AFTER, both at midflight-mobile 390×844):**
- `BEFORE` (`/tmp/jsdrill-refine-05/02-04-midflight-mobile.png`): items show `PATTERN | Contains Duplicate | rev▌` etc — right column clipped, why-tag truncated.
- `AFTER`  (`/tmp/jsdrill-refine-05-after/02-04-midflight-mobile.png`): items show two rows — title + colored badge (`review due` cyan, `weak spot` amber, `next on plan` blue) fully visible.

**Rubric:** 7/21 → 11/21 (Phone-fit 0→3 = +3; ADHD-fit 1→2 = +1).

**Git note:** Primary file `js/app/14-init-core.js` had concurrent user WIP (Font Scale toggle at line 633+, in `initSettingsToggles`). Resolved by applying ONLY the today-plan hunk to the index via `git apply --cached --recount` of a filtered patch — the user's font-scale WIP remained in the working tree untouched.

## Queued to backlog (out of scope for this iter)

- **Primary CTA at top** — `🎯 Start: <first item> (~N min)` button, with the rest as `or pick another ▾`. PROFILE 76-78 "press one thing → drilling."
- **Per-item time estimate** — `~4 min` chip below the badge from `state.bestTimes[id]` median.
- **Today completed counter** — `Today: 2/6 done` header that persists across modal opens.
- **Smart re-ordering within plan** — sort due-reviews by overdue-age, weak by recency of miss.

