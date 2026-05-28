# /drill-refine — Iter 2 (refine) — `reflect-dashboard`

**Surface:** `reflect-dashboard` (Stats modal triggered by 📊 Stats button)
**Stalest by git:** tied at 2026-05-27 09:57 (same refactor commit) with `mock-interview` and `mechanics`; tie-broken by PROFILE.md anti-pattern note (mock = desktop-only, don't mobilify) and surface leverage (Reflect IS the "progress at a glance" surface per PROFILE.md:71-73).
**Screenshots:** `/tmp/jsdrill-refine-02/{01,02}-reflect-{mobile,desktop}-before-{top,bottom}.png`
**Probe:** `tools/cdp/refine-reflect-dashboard.js`

## Vision (first-principles)
The Reflect Stats modal is the rusty engineer's "where am I?" surface. For PROFILE.md's mobile-80%, ADHD, time-limited user, the best version fits inside the viewport — no off-screen tiles, scroll happens INSIDE the modal so the headline (Track Balance + Mastered) is the first thing the eye lands on. Drill-mode lifetime tiles collapse into a compact group instead of stacking 5 nearly-identical 86px rows. Open Reflect → instantly see the headline → scroll only if you want detail.

## Rubric score
| Dim | Before |
|---|---|
| Autopilot | 2/3 |
| Decisions | 1/3 |
| Phone-fit | 1/3 |
| Time-respect | 2/3 |
| Diagnostic-aware | 1/3 |
| Progress-visible | 1/3 |
| ADHD-fit | 1/3 |
| **Total** | **9/21** |

## Empirical evidence

- Mobile (iPhone 13 mini emulation, viewport 844px tall): stats-body scrollHeight = 1624px. Modal centers at `top:50% transform:translate(-50%, -50%)` with NO max-height — modal extends from ~-388px to ~+1236px, clipping tile [0] (Track Balance) above the viewport.
- Desktop (1280×800): stats-body = 1466px in 800px viewport → modal extends ~333px past bottom of viewport.
- Probe survey reports 14 tiles with no internal scroll affordance.

## Proposal

**Target dimension:** Phone-fit (1/3 → 3/3)
**Change:** Edit the inline style on `#stats-modal`'s inner card in `index.html:125` to add `max-height: 90vh; display: flex; flex-direction: column;` and on `#stats-body` (line 130) add `overflow-y: auto; flex: 1; min-height: 0; padding-right: 4px;`. The modal card now fits within 90% of the viewport on any device; vertical scrolling happens INSIDE the modal body, so the header ("Progress" + ×) and the first tile (Track Balance compass) are always at the top of what the user sees.
**Closest step toward Step 2.5 vision because:** It makes the headline tile (Track Balance) the first thing the eye lands on instead of being clipped above the viewport — the precondition for any further "progress at a glance" refinement.
**Why for user:** PROFILE.md:71-73 ("Show progress + scores at a glance — without the user having to navigate to find them"); PROFILE.md:30-44 (mobile-80% — the 844px iPhone 13 mini viewport is the design center); PROFILE.md:48-49 (ADHD — visual hierarchy matters and a clipped-headline forces the user to figure out the layout instead of reading data).
**Mockup:**

Before (mobile 390×844, modal opens):
```
┌────────────────────┐
│ (clipped — tile 0   │   ← above viewport
│   Track Balance)    │   (modal extends past
│ (clipped — tile 1   │    viewport top)
│   Mastered/InProg)  │
├════════════════════┤   ← viewport top
│ × Progress         │   ← modal header (visible)
│ Syntax/Pat/App     │   ← tile [2]
│ Due/Weak/Mock      │   ← tile [3]
│ Recognize 33/47    │   ← tile [4]
│ Gotcha    14/22    │   ← tile [5]
│ Claim     11/18    │   ← tile [6]
│ Predict    5/9     │   ← tile [7]
│ Bug-Hunt   9/14    │   ← tile [8]
├════════════════════┤   ← viewport bottom
│ (clipped — tiles 9- │   ← below viewport
│   13: Self-rescue,  │
│   Section retention,│
│   Calibration, Mock,│
│   Streak)           │
└────────────────────┘
```

After:
```
┌════════════════════┐   ← viewport top
│ × Progress         │   ← header pinned
├────────────────────┤
│ 🧭 Track Balance   │   ← tile [0] NOW visible
│   Syntax 24/44 ▓▓░ │
│   Pattern 27/90 ▓░░│
│   Applied  6/32 ░░░│
│   Least: Applied   │
├────────────────────┤
│ Mastered 57/166    │
│ In Progress 12     │
├────────────────────┤
│ Syntax/Pat/Applied │  (scroll body to see more)
│   …                │
│ ↓ scroll for more  │
├════════════════════┤   ← viewport bottom
│ (rest scrolls inside│
│  the modal, not off  │
│  the viewport)       │
└────────────────────┘
```

**Files touched:** `index.html` only (2 inline-style edits totaling ~80 chars).
**Test:** `tools/cdp/refine-reflect-dashboard.js` extended to assert:
  - modal card boundingRect.top >= 0 AND boundingRect.bottom <= window.innerHeight (on both mobile + desktop)
  - `#stats-body` has computed `overflow-y: auto` and a finite `max-height` upstream constraint
  - first tile in viewport when modal opens IS the Track Balance widget (text matches `/Track Balance/i`)
**Rubric projection:** 9/21 → 13/21
  - Phone-fit 1 → 3 (modal fits the viewport on both mobile and desktop)
  - Progress-visible 1 → 2 (headline tile now visible at modal open)
  - Diagnostic-aware 1 → 2 (Track Balance "Least covered" nudge now reaches the user on mobile)

## Contrarian verdict

GREEN-LIGHT: "Constraining modal height with internal scroll preserves every tile/CTA while making the Track Balance headline + Mastered counters visible on open, which IMPROVES phone-fit and progress-visibility without adding decisions, removing affordances, or gating drilling."
