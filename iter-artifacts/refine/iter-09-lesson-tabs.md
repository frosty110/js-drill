# Refine iter 9 — lesson-tabs

**Surface:** Lesson tab strip (Conv / Walk / Ref / L1 / L2 / L3) — `renderLesson()` tabs setup in `js/app/10-render-sidebar-lesson.js:612-661`.
**Primary file:** `js/app/10-render-sidebar-lesson.js` (HAS user WIP — 5-line `lesson-prompt` block added at line 586 inside `renderLesson()`, in a totally different region from the tab strip at line 648-660).
**Picker rationale:** Within the registry's never-directly-refined surfaces, lesson-tabs has the clearest mobile-fit problem AND user WIP is in a different function — safe via git-apply-cached (iter-5 proven technique).

## Step 2 — Empirical observations (`/tmp/jsdrill-refine-09/`)

Probe `tools/cdp/refine-lesson-tabs.js` captured `two-sum` (Patterns lesson, 6 tabs: Conv / Walk / Ref / L1 / L2 / L3) at desktop (1280×800) + mobile (390×844).

**Desktop:** All 6 tabs fit comfortably across the strip — no clipping.

**Mobile (the 80% case per PROFILE.md line 27):** Strip shows `1. Conversation | 2. Walkthrough | 3. Refere…` — Reference is truncated at the right edge, and tabs 4-6 (L1 — Concept / L2 — Fill-in / L3 — Drill) are **completely off-screen** to the right. Strip has `overflow-x:auto` so it IS scrollable, but:

1. **No fade gradient / no chevron / no scroll indicator** — nothing tells the mobile user that 3 more tabs exist beyond the visible edge.
2. **No auto-scroll-active-tab-into-view** — when `state.currentTab` is L3 (e.g., resumed from URL, keyboard nav, or `selectTab('L3')`), the strip stays scrolled at position 0; the active L3 tab is invisible. The user is on the L3 drill but the tab marker is off-screen.

**Caption:**
- (a) Eye lands on `1. Conversation` (active tab on Patterns lessons by default).
- (b) Competes for attention: nothing on the strip itself — but the lesson body below dominates.
- (c) Hidden: tabs 4-6 (L1/L2/L3) — the high-throughput mobile drilling tiers PROFILE explicitly names as the mobile target. The user can't see they exist without horizontal scroll exploration.

## Step 2.5 — Vision

> If the mobile tab strip were the BEST it could be for the PROFILE.md user
> (80% phone, ADHD, autopilot), it would feel like a calm carousel where
> the active tab is ALWAYS visible — landing on L3 from a URL or keyboard
> shortcut would auto-center that tab in the strip, and a subtle right-edge
> fade gradient would indicate "more tabs available, swipe →" so the ADHD
> user knows the strip is incomplete without having to discover the scroll
> by accident. Long-press on the strip would maybe even show all six tabs
> as a vertical popover (future backlog). The TINY first step: don't leave
> the user on a tab they can't see.

The smallest visible step toward this vision THIS iter: **auto-scroll the active tab into the center of the strip after renderLesson() builds it.** Pure additive code, no markup change, no new state, no new persistence. The fade gradient is queued as a CSS-side companion (would touch one of the WIP CSS files — defer).

## Step 3 — Rubric

| Dim | Score | Evidence |
|---|---|---|
| Autopilot | 2/3 | URL/state resume works; but landing on an off-screen tab gives no visual orientation. |
| Decisions | 2/3 | 6 tabs is borderline-high for ADHD users but reasonable for Patterns/Applied. |
| Phone-fit | 1/3 | Strip has `overflow-x:auto` (line 617) but tabs 4-6 invisible on 390px viewport with NO indicator; PROFILE line 27 (80% phone). |
| Time-respect | 3/3 | No time signal needed on a tab strip. |
| Diagnostic-aware | 2/3 | ✓ checkmark on passed levels surfaces progress per-tab. |
| Progress-visible | 2/3 | Active-tab indicator + ✓ marks; but on mobile the active marker can be off-screen. |
| ADHD-fit | 1/3 | When the user can't see they're on the active tab (off-screen), it's disorienting. |

**Total: 13/21.** Target dimension: **Phone-fit** (lifts ADHD-fit + Autopilot secondarily).

## Step 4 — Proposal

**Target dimension:** Phone-fit (lifts ADHD-fit + Autopilot).

**Change:** In `js/app/10-render-sidebar-lesson.js` `renderLesson()` (after the tab-strip append at line 661), use `requestAnimationFrame` to compute `tabs.scrollLeft` so the `.tab-btn.active` is centered in the strip's visible window (clamped to `[0, scrollWidth - clientWidth]`). Fires every render — handles URL resume, keyboard nav, programmatic `selectTab`, and lesson nav.

**Closest step toward Step 2.5 vision because:** The vision wants the active tab to always be visible without the user discovering the scroll. The minimum-surgery step is the auto-center — the fade gradient (CSS side) is a separate complementary change deferred until WIP CSS files clear.

**Why for user:** PROFILE.md line 27 ("~80% of study time is on a phone"); PROFILE.md line 48-50 (ADHD low-overwhelm — being on a tab you can't see is disorienting); PROFILE.md line 76-78 (autopilot — visual orientation is required for "press one thing → you're drilling" to feel intentional).

**Mockup (mobile, 390px, lesson 'two-sum' with `currentTab='L3'`):**

```
BEFORE (active L3 tab off-screen):

  ┌─ tab strip ────────────────────────────────────────┐
  │ 1. Conversation │ 2. Walkthrough │ 3. Refere…      │  ← scroll=0
  └────────────────────────────────────────────────────┘
                     ^^^ active L3 tab is at scrollLeft=380+ (off-screen)

AFTER (strip auto-scrolls to center the active tab):

  ┌─ tab strip ────────────────────────────────────────┐
  │   2. Walk… │ 3. Reference │ 4. L1 │ ★5. L2 │ 6. L3 │  ← scroll=180
  └────────────────────────────────────────────────────┘
                                ★ active tab centered (or as close as the
                                  strip ends allow via clamping)
```

For currentTab='reference' (default), the strip stays at scroll=0 since reference is already visible.

**Files touched:** `js/app/10-render-sidebar-lesson.js` only — single hunk added immediately after `shell.appendChild(tabs)` at line 661. User's WIP at line 586 is inside `renderLesson()` BUT in a separate region (header above the tab strip), so git-apply-cached can isolate my hunk.

**Test:** `tools/cdp/refine-lesson-tabs.js` — when the active tab would otherwise be off-screen on a 390px viewport, assert (a) the active tab's `rect.left ≥ strip.left` AND (b) `rect.right ≤ strip.right`. Currently fails when active=L3; should pass after the fix.

**Rubric projection:** 13/21 → 15/21 (Phone-fit 1→2 = +1; ADHD-fit 1→2 = +1).

## Step 5 — Contrarian verdict

**GREEN-LIGHT:** "Auto-scrolling the active tab into view on mobile directly serves the 80%-phone profile by making a clipped affordance visible without adding decisions, removing affordances, or gating drilling — it strengthens phone-fit with zero new friction."

## Step 7 — Implementation + verification

**Change shipped:** `js/app/10-render-sidebar-lesson.js` `renderLesson()` — after `shell.appendChild(tabs)` at line 661, added a `requestAnimationFrame` callback that centers `.tab-btn.active` in the strip's scroll window. No-op on desktop where strip isn't scrollable.

**Validator:** `node tools/validate-data.js` → 803 passed, 0 failed.

**Probe:** `node tools/cdp/refine-lesson-tabs.js /tmp/jsdrill-refine-09-after` → **5/5 assertions pass**:
- `[mobile L3] active tab exists`
- `[mobile L3] active tab is the L3 — Drill tab (got "6.L3 — Drill")`
- `[mobile L3] active L3 tab is fully visible (auto-scrolled into strip's window)`
- `[mobile L1] active tab is L1`
- `[mobile L1] active L1 tab is fully visible after auto-scroll`

**Empirical proof of the fix:** When `currentTab='L3'`, the BEFORE state had tabs 1-3 visible (Conv / Walk / Refere…) and L3 at left=638px (off-screen). AFTER: tabs 1-4 at NEGATIVE coords (scrolled OFF the left), and tab 6 L3 fully visible at the right edge of the visible strip.

**Visual diff:** screenshots `/tmp/jsdrill-refine-09/*` (before) vs `/tmp/jsdrill-refine-09-after/*` (after).

**Rubric:** 13/21 → 15/21 (Phone-fit 1→2 = +1; ADHD-fit 1→2 = +1).

**Git note:** Primary file had user WIP (5-line `lesson-prompt` block at line 586 inside `renderLesson()`); my hunk at line 660 is in a different region of the same function. Resolved via `git apply --cached --recount` of a filtered patch — user's WIP preserved untouched in the working tree.

## Queued to backlog

- Right-edge fade gradient on the tab strip when scrollWidth > clientWidth — visual hint that more tabs exist beyond the visible edge. (Needs CSS edit; deferred while CSS files have user WIP.)
- Long-press the strip to popover all tabs as a vertical list — for ADHD users who want full overview at a glance.
- Tab strip sticks to top of viewport on scroll so it stays accessible during long lesson body reads.

