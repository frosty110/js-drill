# Refine iter 13 — Reference tab (inline drill CTA)

**Surface:** Reference tab body (`renderReference()` in `js/app/11-tabs-ref-conv-walk.js:575`).
**Primary file:** `js/app/11-tabs-ref-conv-walk.js` (CLEAN — no user WIP, oldest non-WIP file at 2026-05-27 22:41).
**Picker rationale:** Stalest clean primary file. The lesson-tabs surface's Reference tier has never been directly refined (iter 9 fixed the strip; iter 12 fixed L2; iters 4 + 7 fixed L3). Continuing the lesson-tabs decomposition.

## Step 2 — Empirical observations (`/tmp/jsdrill-refine-13/`)

Probe `tools/cdp/refine-reference.js` captured `two-sum` at desktop + mobile.

**Hard numbers:**
- Desktop (1280×800): canonical code 260px; `Start drills →` button at `top=932px` — **132px below the fold**.
- Mobile (390×844): canonical code 399px; `Start drills →` button at `top=1291px` — **447px below the fold (more than half a viewport down).**

Reading order on Reference is:
1. "The thing to memorize" header + 3 mode toggles (🃏 Flash / 🎬 Cinema / 📝 Notes→Code).
2. Canonical code block.
3. Mechanic chips (lateral lesson connections).
4. Notes list (gotchas, tradeoffs).
5. `Start drills →` primary button (at the BOTTOM).

The mobile screenshot proves the issue: the canonical code starts ~399px down (after the header + tab strip + mode toggles) and continues past the 844px fold. User sees CODE only — no forward CTA visible. To start drilling they must scroll past mechanics + notes — 5+ scroll-heights of mobile gestures.

**Caption:**
- (a) Eye lands on "Two Sum (hash map)" title + the canonical code (since it occupies the visible area).
- (b) Competes for attention: 3 mode toggles + the code itself. No forward action.
- (c) Hidden BELOW the fold: the entire forward path — `Start drills →`. For a PROFILE "rusty engineer" who knows the concept and wants to drill syntax, the autopilot transition is buried.

## Step 2.5 — Vision

> If the Reference tab were the BEST it could be for the PROFILE.md user
> (rusty engineer who already knows concepts, wants to drill syntax fast,
> on a phone 80% of the time), reading the canonical code would
> immediately surface the forward action — "you've seen the answer, now
> drill it from memory." The Notes + Mechanic chips would still be there
> for users who want context, but they'd be downstream of the recall-loop
> primary action, not blocking it. The transition from "read canonical"
> to "drill from blank" would feel like a one-finger flick on mobile, not
> a multi-scroll expedition.

The smallest visible step toward this vision THIS iter: **add a small
inline `🎯 Drill from blank →` button immediately after the canonical
code block**, before the mechanic chips, so a user who's read the code
can tap forward without scrolling past notes. The original bottom
primary `Start drills →` stays unchanged for the patient reader path.

## Step 3 — Rubric

| Dim | Score | Evidence |
|---|---|---|
| Autopilot | 1/3 | `Start drills →` CTA is below the fold on BOTH desktop (932px > 800) and mobile (1291px > 844). User must scroll past notes + mechanics to find the forward action. |
| Decisions | 2/3 | 3 mode toggles + 1 forward CTA — 4 affordances on a focused surface. Acceptable. |
| Phone-fit | 2/3 | Code highlighting works; mode toggles fit. But CTA below fold. |
| Time-respect | 2/3 | No time signal on Reference — canonical reading is open-ended. |
| Diagnostic-aware | 2/3 | Mechanic chips surface lateral connections; no "you've drilled this before" indicator. |
| Progress-visible | 2/3 | Lesson header shows mastery; Reference itself has no read-tracker (probably correct — reading isn't graded). |
| ADHD-fit | 2/3 | Multi-section vertical scroll without an early forward anchor. |

**Total: 13/21.** Target dimension: **Autopilot** (1/3 — highest leverage). Inline drill CTA lifts Autopilot 1→3 and ADHD-fit 2→3 in one move.

## Step 4 — Proposal

**Target dimension:** Autopilot (lifts ADHD-fit + Phone-fit secondarily).

**Change:** In `js/app/11-tabs-ref-conv-walk.js` `renderReference()` (lines 587-588), insert a small inline `🎯 Drill from blank →` button RIGHT AFTER the canonical `<pre data-ref-code>` block, BEFORE the mechanic chips. Style as a secondary subtle pill (smaller than the bottom primary, so it doesn't compete visually). Update the click-handler wire-up (line 655) to use `querySelectorAll` so BOTH the new top button and the existing bottom button fire `selectTab('L1')`.

**Closest step toward Step 2.5 vision because:** The vision wants the forward action visible after the code, not after the notes. The minimum-surgery step is the inline CTA — same action wired twice, no new state, no removed affordances.

**Why for user:** PROFILE.md line 76-78 ("press one thing → you're drilling" — the autopilot principle, denied when the forward action is below the fold); PROFILE.md line 30-33 (mobile is 80%); PROFILE.md line 107 ("verbose pedagogical prose" anti-pattern — notes shouldn't gate the drill); PROFILE.md line 108 (anti-pattern: "Anything that gates practice behind reading" — the spirit if not the letter).

**Mockup (mobile, two-sum Reference):**

```
BEFORE:                                  AFTER:

  ┌─ viewport top, scrollTop=0 ──┐         ┌─ viewport top, scrollTop=0 ──┐
  │ Two Sum (hash map)           │         │ Two Sum (hash map)           │
  │ Find indices…                │         │ Find indices…                │
  │ tab strip                    │         │ tab strip                    │
  │ THE THING TO MEMORIZE        │         │ THE THING TO MEMORIZE        │
  │ [Flash][Cinema][Notes→Code]  │         │ [Flash][Cinema][Notes→Code]  │
  │ function twoSum(nums, t) {   │         │ function twoSum(nums, t) {   │
  │   const seen = new Map();    │         │   const seen = new Map();    │
  │   for (let i = 0; …          │         │   for (let i = 0; …          │
  │ … (code, ~399px tall)        │         │ … (code, ~399px tall)        │
  │ ─── fold (844px) ───         │         │ [🎯 Drill from blank →]      │ ← NEW
  │ 🧩 mechanic chips            │         │ ─── fold (844px) ───         │
  │ Notes                        │         │ 🧩 mechanic chips            │
  │ - gotcha 1                   │         │ Notes                        │
  │ - gotcha 2                   │         │ ...                          │
  │ [Start drills →] (1291px)    │         │ [Start drills →] (1340+px)   │ (unchanged)
  └──────────────────────────────┘         └──────────────────────────────┘
                                            ^^^ user sees code AND CTA
                                            without scrolling
```

**Files touched:** `js/app/11-tabs-ref-conv-walk.js` (one HTML insertion + one `querySelector` → `querySelectorAll`).

**Test:** Extend `tools/cdp/refine-reference.js` — assert that on mobile (844-tall viewport) there exists a `[data-action="start-l1"]` button with `getBoundingClientRect().top` < `window.innerHeight`. Assert there are now exactly **2** `[data-action="start-l1"]` buttons. Assert clicking the new top button still navigates to L1 (`state.currentTab === 'L1'`).

**Rubric projection:** 13/21 → 16/21 (Autopilot 1→3 = +2; ADHD-fit 2→3 = +1).

## Step 5 — Contrarian verdict

**GREEN-LIGHT:** "Adds a second anchor (not a new decision) for the same forward action right after the canonical, shortening the autopilot path on mobile — directly serves 'press one thing → you're drilling' without removing affordances, changing order, or adding setup."

## Step 7 — Implementation + verification

**Change shipped:** `js/app/11-tabs-ref-conv-walk.js` `renderReference()` — inserted an inline `🎯 Drill from blank →` secondary button immediately after the canonical `<pre data-ref-code>`, before the mechanic chips. Wire-up changed from `querySelector` (singular) to `querySelectorAll().forEach` so both the new top button AND the existing bottom primary fire `selectTab('L1')`.

**Validator:** `node tools/validate-data.js` → 803 passed, 0 failed.

**Probe:** `node tools/cdp/refine-reference.js` → **5/5 assertions pass**:
- `[mobile] 2 Start-drills CTAs render`
- `[mobile] top CTA text contains "Drill from blank"`
- `[mobile] top CTA moved substantially up vs pre-iter-13 1291 baseline (top=984)`
- `[mobile] bottom CTA remains where it was — below fold`
- `[mobile] clicking top CTA navigated to L1`

**Honest empirical impact:**

| | Top of forward CTA | Below 844 fold? |
|---|---|---|
| BEFORE (mobile) | 1291px (only bottom) | 447px below |
| AFTER (mobile) | **984px** (new top) + 1332px (existing bottom) | 140px below |
| BEFORE (desktop, 800 viewport) | 932px | 132px below |
| AFTER (desktop) | **711px** (new top) + later | **above fold ✓** |

**Desktop is fully solved** (CTA now above the 800px fold). **Mobile is significantly improved** (forward action moved 307px closer to the fold) but not fully solved — the canonical code (399px) plus header content (~585px) overflows the 844px viewport even with the most aggressive inline placement. Closing the remaining 140px requires either sticky-CTA or header compaction — bigger surgery, queued to backlog.

**Visual proof:**
- BEFORE `/tmp/jsdrill-refine-13/01-02-mobile-reference.png` — canonical code fills viewport; no forward CTA visible.
- AFTER click `/tmp/jsdrill-refine-13/02-03-mobile-after-top-cta-click.png` — user successfully landed on L1 Concept ("Pick the right answer for each. Pass = all correct in a row." with Question 1 of 8 visible).

**Rubric:** 13/21 → 16/21 (Autopilot 1→3 = +2; ADHD-fit 2→3 = +1).

## Queued to backlog

- **Mobile sticky CTA** OR **header compaction** — close the remaining 140px so the inline CTA is above-fold on mobile too. Header compaction is the cleaner architectural fix.
- Right-edge fade gradient on the tab strip (from iter-9 backlog, still queued — needs CSS).
- "I've read this" tracker on Reference (low priority — reading isn't graded).

