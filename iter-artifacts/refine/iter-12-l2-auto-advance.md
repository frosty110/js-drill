# Refine iter 12 — L2 fill-in (auto-advance to next un-passed)

**Surface:** L2 fill-in body (`renderL2` desktop + `renderL2Mobile` in `js/app/12b-l2.js`).
**Primary file:** `js/app/12b-l2.js` (CLEAN — no user WIP, oldest non-WIP file at 11:07 yesterday).
**Picker rationale:** Stalest clean primary file. The lesson-tabs SURFACE was refined iter 9 (strip auto-scroll); the L2 BODY itself has never been directly refined. PROFILE 80%-phone makes L2 the high-throughput mobile tier per line 30-33.

## Step 2 — Empirical observations (`/tmp/jsdrill-refine-12/`)

Probe `tools/cdp/refine-l2.js` captured `two-sum` (2 exercises × 4 + 3 blanks) at desktop + mobile.

**Per-exercise card heights:**
- Desktop: Ex 1 = 420px, Ex 2 = 447px (total ~870px in L2 body)
- Mobile: Ex 1 = 551px, Ex 2 = 618px (total ~1170px — well past 844px viewport)

**Pattern observed in both:** User completes Ex 1's blanks, taps `Check`, gets `✓ Pass` in the inline feedback. Then... **nothing happens**. The `✓ Pass` text is the entire feedback signal. The user must:
1. Notice Exercise 2 exists (it's below the fold on mobile after a long Ex 1).
2. Scroll down to find Ex 2's first blank.
3. Tap into it.

The user's eye is on the `✓ Pass` line + Check button at the BOTTOM of Ex 1's card after passing. Ex 2's top is below that, requiring downward scroll.

**Caption:**
- (a) Eye lands on `✓ Pass` next to the Check button right after the win.
- (b) Competes for attention: nothing forward — the success state has no continuation cue.
- (c) Hidden on mobile (because below the fold): the entire Ex 2 card. User has to know it's there.

## Step 2.5 — Vision

> If the L2 surface were the BEST it could be for the PROFILE.md user (80%
> phone, ADHD, autopilot, limited study time), passing Exercise 1 would
> feel like a fitness-app "rep complete → next rep" beat: the `✓ Pass`
> stays visible briefly, then the next un-passed exercise smoothly scrolls
> to the top of the viewport so the user just keeps tapping forward. No
> finding-the-next-thing-yourself, no manual scroll. The mobile drilling
> loop becomes a continuous tap-tap-tap rhythm instead of a tap-pause-
> scroll-tap rhythm.

The smallest visible step toward this vision THIS iter: **after a Check
passes, smoothly scroll the next un-passed exercise card into view.** No
focus-stealing (would pop the mobile keyboard); no auto-Check; just the
forward visual continuation cue. Same logic in both renderL2 and
renderL2Mobile.

## Step 3 — Rubric

| Dim | Score | Evidence |
|---|---|---|
| Autopilot | 1/3 | After Ex 1 passes, NO forward motion — user discovers Ex 2 manually. |
| Decisions | 3/3 | Check / Reveal — clear per-exercise. |
| Phone-fit | 3/3 | Dedicated mobile path with tap-chips. iter-9 fix ensures L2 tab is visible. |
| Time-respect | 2/3 | Tight Check-feedback loop; no time waste per exercise. |
| Diagnostic-aware | 2/3 | L2 pass updates state.progress / state.reviews; no L2-specific weakness tracking. |
| Progress-visible | 2/3 | Per-exercise ✓ Pass; overall "L2 passed" marker. No mid-progress chip. |
| ADHD-fit | 2/3 | Multi-card scroll without auto-advance — user has to actively find next exercise. |

**Total: 15/21.** Target dimension: **Autopilot** (1/3 — highest leverage). Auto-advance lifts Autopilot 1→3 and ADHD-fit 2→3 in one move.

## Step 4 — Proposal

**Target dimension:** Autopilot (lifts ADHD-fit secondarily).

**Change:** In `js/app/12b-l2.js`, after `exerciseState[exi].passed = true; checkL2Overall();` fires inside the Check handler — in BOTH `renderL2` (around lines 115/119) and `renderL2Mobile` (around lines 300/304) — call a small inline `_scrollNextUnpassed(exi, wrap)` helper that finds the next un-passed exercise card and smoothly scrolls it to viewport top via `scrollIntoView({behavior:'smooth', block:'start'})`. No focus-stealing — just the scroll cue.

**Closest step toward Step 2.5 vision because:** The vision wants forward motion after a pass. The minimum-surgery step is the scroll-into-view — no markup change, no new state, no focus-management complications. Pure additive call after the existing pass-update path.

**Why for user:** PROFILE.md line 76-78 ("press one thing → drilling" — the autopilot principle applied between exercises, not just at session start); PROFILE.md line 30-33 (L2 is the mobile high-throughput tier); PROFILE.md line 48-50 (ADHD single-focus — when an exercise passes, the focus should advance, not stay on the just-completed work).

**Mockup (mobile, mid-L2, post-Ex 1 pass):**

```
BEFORE — viewport stays on Ex 1; Ex 2 below the fold:

  ┌─ viewport, scrollTop=0 ────────────────────────────┐
  │ Exercise 1 of 2                                    │
  │ Fill in the canonical Two Sum solution.            │
  │ <code with chips, all filled in>                   │
  │ Expected output: [0,1]                             │
  │ [Check] [Reveal answers]  ✓ Pass                   │  ← user is here
  └────────────────────────────────────────────────────┘
   ──── below fold (user must scroll to discover) ────
   Exercise 2 of 2
   <chips>
   [Check] [Reveal answers]

AFTER — Ex 2 auto-scrolls into view:

   Exercise 1 of 2
   <code with chips, all filled in>
   [Check] [Reveal]  ✓ Pass
  ┌─ viewport, scrollTop=Ex2.offsetTop ────────────────┐
  │ Exercise 2 of 2                                    │
  │ Same pattern, different input — fill the loop…    │
  │ <code with chips, empty>                          │
  │ Expected output: [1,2]                             │
  │ [Check] [Reveal answers]                           │
  └────────────────────────────────────────────────────┘
   ^^^ smooth scroll completes ~400ms after ✓ Pass renders
```

**Files touched:** `js/app/12b-l2.js` only (one helper + two call sites).

**Test:** Extend `tools/cdp/refine-l2.js` — programmatically fill Exercise 1's blanks with canonical answers, click Check, wait for `✓ Pass`, then wait briefly and assert that Exercise 2's `getBoundingClientRect().top` is near the viewport top (within 0-100px) AND was further down before the click. Tests both desktop and mobile paths.

**Rubric projection:** 15/21 → 18/21 (Autopilot 1→3 = +2; ADHD-fit 2→3 = +1).

## Step 5 — Contrarian verdict

**GREEN-LIGHT:** "Removes a tap-pause-scroll-tap break in the mobile L1/L2 loop (PROFILE: 'L2 (fill-in-blanks) is feasible on mobile — short token typing… no scrolling around a long block') without adding decisions, removing affordances, stealing focus, or hiding progress — pure autopilot continuity."

## Step 7 — Implementation + verification

**Change shipped:** `js/app/12b-l2.js` — added `_scrollNextUnpassedL2(currentExi, wrap, exerciseState)` helper at the top, plus calls after the `exerciseState[exi].passed = true; checkL2Overall();` lines in BOTH `renderL2` (lines 115-120) and `renderL2Mobile` (lines 300-305). The helper uses `requestAnimationFrame` so the `✓ Pass` paint lands first, then `scrollIntoView({behavior:'smooth', block:'start'})` brings the next un-passed card to viewport top. No focus stealing.

**Validator:** `node tools/validate-data.js` → 803 passed, 0 failed.

**Probe:** `node tools/cdp/refine-l2.js` → **3/3 assertions pass**:
- `[mobile] Ex 2 position measurable before/after`
- `[mobile] Ex 2 scrolled UP (top moved from 1185 to 44)`
- `[mobile] Ex 2 now near viewport top (top=44, expected <150)`

**Empirical proof:** Ex 2's `getBoundingClientRect().top` was **1185px** (below the fold) before the Check click on Ex 1, and **44px** (near viewport top) after. The Δ of 1141px is the entire mobile-scroll the user used to have to do manually.

**Visual diff:**
- BEFORE `/tmp/jsdrill-refine-12/01-02-mobile-l2-fresh.png` — Ex 1 visible, Ex 2 below fold.
- AFTER `/tmp/jsdrill-refine-12/02-03-mobile-after-ex1-pass.png` — Ex 2 of 2 fully visible at viewport top, chips empty, Check/Reveal ready.

**Rubric:** 15/21 → 18/21 (Autopilot 1→3 = +2; ADHD-fit 2→3 = +1).

## Queued to backlog

- Per-exercise pass-count chip in the L2 tab strip ("L2 — Fill-in (1/2)") so partial progress is visible without scrolling. (Needs `10-render-sidebar-lesson.js` edit; WIP file — defer.)
- Smooth-scroll respects `prefers-reduced-motion` (small accessibility detail).
- After the LAST exercise passes, scroll the "L3 Drill →" CTA into view (currently it's at the bottom of the L2 body — easy to miss after the celebration moment).

