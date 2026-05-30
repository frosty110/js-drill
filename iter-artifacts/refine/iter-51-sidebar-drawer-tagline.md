# iter 51 — refine — sidebar-drawer-mobile (drop brand tagline)

**Date:** 2026-05-30
**Surface:** sidebar-drawer-mobile
**Picker signal:** Pivoted from mock-interview (iters 49 + 50 already on mock; picking it 3-in-a-row would hit the clustering anti-pattern). Next-stalest after mock: sidebar-drawer-mobile (max-latest 2026-05-29 22:58, 72 commits in 90d) — wins tie with topbar (77 commits in 90d) on the 90d-commit-count tie-break.
**Step 0 verdict:** Cleared (trailing 6-window 45/46/47/48/49/50 = 2 bails + 4 ships, well under threshold). Strategic-pivot signal fired separately (2-in-a-row clustering check), forcing a non-mock surface this iter.

## Before screenshots

- `/tmp/jsdrill-refine-51/01-drawer-mobile-closed-before.png` (390×844, drawer closed)
- `/tmp/jsdrill-refine-51/01-drawer-mobile-open-before.png` (390×844, drawer open)
- `/tmp/jsdrill-refine-51/01-drawer-desktop-open-before.png` (1280×800)

### Mobile (drawer-open) caption

(a) **Eye lands on:** "JS Drill v1" header + "Memorize JavaScript syntax & canonical patterns." tagline — brand text occupies the top ~80px of the drawer.
(b) **Competes for attention:** Plan dropdown, Filters row (🧭 Plan View · 👁 Hide Mastered · 🛠 Repair), Search input, 🏷 Filter chevron, path-track-chip row (All 123 / Syntax 41 / Patterns 82 / Applied 0), section header (ALGORITHMS 0/3 with progress bar) — that's **~390px of chrome before the first lesson list item** on an 844px viewport (~46% of the visible drawer).
(c) **Hidden / below the fold:** lessons beyond the third item in the first section. The user has to scroll to find lessons #4+ even in the section they just navigated to.

## Vision

If the mobile sidebar drawer were the BEST it could be for the user in PROFILE.md, opening the drawer would put your CURRENT next lesson within the first 200px of the viewport. Every text element above the lesson list would either drive an action (Plan / Filter / Search), report meaningful progress, or be a section header. Pure brand text, taglines, and any text the user has read 100 times before would be cut. The drawer is a *utility*, not an onboarding surface — onboarding lives in the plan-picker-modal.

## Rubric score

**Total: 13/21**
**Suggested refine target:** Phone-fit (1/3) — every saved pixel above the lesson list pulls more lessons above the fold. ADHD-fit (1/3) is also lifted directionally (one fewer competing text line).

| Dim | Score | Evidence |
|---|---|---|
| Autopilot | 2/3 | Plan dropdown is the primary CTA; Filters row + path-track-chip row are visible secondary affordances. |
| Decisions | 3/3 | For autopilot user: 1 decision (pick a lesson). Plan/Filter/etc. are optional. |
| Phone-fit | **1/3** | ~390px of header chrome before the first lesson list item on 844px viewport (mobile screenshot). |
| Time-respect | 2/3 | Drawer opens fast; navigating to next lesson still requires scrolling past chrome. |
| Diagnostic-aware | 1/3 | Section progress bars + Repair count visible; no prominent "due today" or "next up" callout above the lesson list. |
| Progress-visible | 3/3 | "0 / 166 lessons mastered" header + per-section progress bars + Repair count all visible. |
| ADHD-fit | **1/3** | Many parallel surfaces compete: brand block, plan, filters row, search, faceted filter, path-track chips, section header. |

## Proposal

**Target dimension:** Phone-fit (1/3 → 2/3, directional) + ADHD-fit (1/3 → 2/3, directional)
**Change:** Drop the brand tagline `<p class="text-xs text-slate-400 mt-1">Memorize JavaScript syntax & canonical patterns.</p>` at `index.html:338`. The drawer is a utility for existing users — they don't need a tagline explaining what the app does (onboarding lives in the plan-picker-modal).
**Closest step toward Step 2.5 vision because:** the cleanest single cut of pure-chrome text above the lesson list — saves ~20-25px without changing any affordance or signal.
**Why for user:** PROFILE.md "~80% of study time is on a phone" (Usage context) + "Limited working memory for parallel decisions; benefits from single-focus surfaces" (Cognitive style — ADHD). The tagline is brand-marketing text in a navigation surface; existing users have read it hundreds of times.
**Mockup (mobile drawer header):**

```
BEFORE                                    AFTER
─────────────────────────                 ─────────────────────────
JS Drill                  v1              JS Drill                  v1
Memorize JavaScript syntax     ← cut
& canonical patterns.
0 / 166 lessons mastered  0%              0 / 166 lessons mastered  0%
[━━━━━━━━━━━━━━━━━━━━━]                   [━━━━━━━━━━━━━━━━━━━━━]
[Plan: Starter Plan ▾]                    [Plan: Starter Plan ▾]
Filters: 🧭 Plan View 👁 Hide …          Filters: 🧭 Plan View 👁 Hide …
[Search lessons…]                         [Search lessons…]
🏷 Filter ▸                               🏷 Filter ▸
All 123  Syntax 41  Patterns 82 …         All 123  Syntax 41  Patterns 82 …
ALGORITHMS 0/3                            ALGORITHMS 0/3       ← ~20px higher
17. Sort with comparator                  17. Sort with comparator
…                                         …
```

**Files touched:** `index.html` (line 338 only).
**Test:** Re-run `tools/cdp/refine-sidebar-drawer.js` with `SNAP_TAG=after`. Assert `document.body.textContent` does NOT contain "Memorize JavaScript syntax". Visual diff should show the lesson list shifted up by ~20-25px.
**Rubric projection:** 13/21 → 13/21 (directional: Phone-fit ~22px tighter; ADHD-fit one fewer competing line — neither crosses a whole-point band).

## Contrarian verdict

**GREEN-LIGHT:** *"The tagline is brand-marketing prose, not an affordance — removing it cuts ~20-25px of header chrome and pulls more lessons above the fold on mobile, directly serving the phone-80% / autopilot user without removing any navigation, progress, or diagnostic signal."*
