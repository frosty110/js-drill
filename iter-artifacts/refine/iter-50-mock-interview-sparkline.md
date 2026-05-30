# iter 50 — refine — mock-interview (sparkline during active mock)

**Date:** 2026-05-30
**Surface:** mock-interview
**Picker signal:** Git-staleness — mock-interview's registry primary file (`js/app/09-stats-cheatsheet-mock.js`) at 2026-05-29 18:39:58 is still oldest. Iter 49's edit landed in `js/app/12c-l3.js` (registered under lesson-tabs), so mock-interview's clock didn't reset.
**Step 0 verdict:** Cleared. Trailing 6-window (44/45/46/47/48/49) = 3 bails ≤ threshold 4. Iter 49 already touched mock — this is 2-in-a-row (under the ≥3 clustering trigger), continuing iter 49's broken-context-removal trajectory.

## Before screenshots

- `/tmp/jsdrill-refine-50/01-mock-active-mobile-before.png` (390×844)
- `/tmp/jsdrill-refine-50/01-mock-active-desktop-before.png` (1280×800)

### Mobile caption

(a) **Eye lands on:** "Two Sum (hash map)" — large lesson title + description (unchanged from iter 49).
(b) **Competes for attention:** rose mock banner, **"no history yet" sparkline empty-state line** (small grey italic between description and banner), 💎 Best/slope/trend pills, mock-history cells, PROMPT box.
(c) **Hidden / below the sticky Run-bar:** editor is at `editorTop=809/844` (gained from iter 49) but the sticky Run/Clear bar covers the bottom ~70px, so the editor itself still isn't usable-visible without scrolling.

## Vision

(Carry-forward from iter 49) If the mock-interview surface were the BEST it could be for the user in PROFILE.md, on iPhone-13-mini (390×844) the EDITOR + PROMPT + Run button would all be visible without scrolling once the timer starts. Above the editor: rose banner with timer (the only authoritative time-source) + compact badges row. The lesson title fades to the small breadcrumb. Tutorial copy and journey-context fragments that don't drive the next keystroke disappear — once the mock is timed, every line above the editor is friction.

## Rubric score (post-iter-49 baseline)

**Total: 16/21**
**Suggested refine target:** Phone-fit (2/3) — every saved pixel above the editor moves closer to the editor-above-sticky-bar ideal. ADHD-fit (2/3) is also lifted as a side-effect: one fewer competing line in the mock chrome.

| Dim | Score | Evidence |
|---|---|---|
| Autopilot | 2/3 | One sticky `Run (R↵)` CTA; `End interview` lone secondary. |
| Decisions | 3/3 | 0 decisions during active mock. |
| Phone-fit | **2/3** | Iter 49 lifted PROMPT above the fold; editor still 35px below the sticky-bar visible area (editorTop=809, viewport=844, sticky bar covers bottom ~70px). |
| Time-respect | 2/3 | Time-to-first-keystroke still includes a small scroll to reach the editor. |
| Diagnostic-aware | 2/3 | Smart-selection + slope-direction badge; not actively diagnosing during the active mock. |
| Progress-visible | 3/3 | 💎 Best + slope + mock-history pills all visible. |
| ADHD-fit | 2/3 | Iters 24/27/29/32/49 cut a lot; the sparkline empty-state line is one more redundant signal above the rose banner. |

## Proposal

**Target dimension:** Phone-fit (2/3 → projected 2/3, marginal pixel gain) + ADHD-fit (2/3 → 2/3, one fewer competing line). Net rubric: 16/21 → 16/21 with directional improvement on two dimensions, ~14px gained.
**Change:** Wrap the sparkline slot at `js/app/10-render-sidebar-lesson.js:619` in `${isMock ? '' : '...'}`. The `<div data-sparkline-slot>` shows L1/L2/L3 event history for this lesson — backward-looking journey-context that doesn't drive the next keystroke during a timed mock.
**Closest step toward Step 2.5 vision because:** sixth application of the iter-24/27/29/32/49 broken-context-removal pattern — every redundant line above the editor pushed the editor closer to the sticky-bar visible zone.
**Why for user:** PROFILE.md "Limited working memory for parallel decisions; benefits from single-focus surfaces" (Cognitive style — ADHD). The empty-state "no history yet" in particular is pure noise; the populated state (colored ticks) is backward-looking, not action-driving during a TIMED mock.
**Mockup (mobile):**

```
BEFORE                             AFTER
──────────────────────             ──────────────────────
[Pattern · Arrays & Hashing]      [Pattern · Arrays & Hashing]
Two Sum (hash map)                 Two Sum (hash map)
Find indices of two values…        Find indices of two values…
no history yet           ← cut
╔════════════════════╗             ╔════════════════════╗
║ MOCK INTERVIEW IN… ║             ║ MOCK INTERVIEW IN… ║
║ 0:00 · hints       ║             ║ 0:00 · hints       ║
║ [End interview]    ║             ║ [End interview]    ║
╚════════════════════╝             ╚════════════════════╝

💎 Best 1:35  ↓ faster             💎 Best 1:35  ↓ faster
3:00  2:20  1:50  +1:35            3:00  2:20  1:50  +1:35

┌─ PROMPT ──────────┐               ┌─ PROMPT ──────────┐
│ Write twoSum…     │               │ Write twoSum…     │
│ Expected: [0,1]   │               │ Expected: [0,1]   │
└───────────────────┘               └───────────────────┘
                                    ↑ all content shifts up ~14px
[Run] [Clear]                      [Run] [Clear]
```

**Files touched:** `js/app/10-render-sidebar-lesson.js` (line 619 only).
**Test:** Re-run `tools/cdp/refine-mock-active.js` with `SNAP_TAG=after`. Add assertion: `document.querySelector('[data-sparkline-slot]')` is `null` during active mock. All iter-24/27/29/32/49 invariants still pass.
**Rubric projection:** 16/21 → 16/21 (directional: Phone-fit ~14px gain inside the same band; ADHD-fit one fewer line — neither crosses a whole-point boundary, but the trajectory is consistent).

## Contrarian verdict

**GREEN-LIGHT:** *"Suppressing a backward-looking sparkline strip during an active mock interview saves ~14px above the editor on mobile, reduces decision-irrelevant noise in a timed/focus state, and removes no affordance the user relies on mid-mock (mock history badges, timer, prompt, banner, and end-mock all remain)."*

## Verification

- `node tools/validate-data.js`: 810 passed, 0 failed.
- `node tools/cdp/refine-mock-active.js`: 18/18 assertions PASS (9 mobile + 9 desktop).
- **Mobile measurements:** bannerTop 300 → 267 (-33px); editorTop 809 → **776** (-33px) — editor now essentially flush with the sticky Run-bar top.
- **Desktop measurements:** bannerTop 231 → 199 (-32px); editorTop 547 → 515 (-32px).
- Implementation gotcha caught during impl: `isMock` is not in scope in `10-render-sidebar-lesson.js`; used the direct `(state.mock.active && state.mock.lessonId === lesson.id)` check matching the surrounding suppressions at lines 586/596/598.
