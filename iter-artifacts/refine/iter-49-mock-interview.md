# iter 49 — refine — mock-interview

**Date:** 2026-05-30
**Surface:** mock-interview
**Picker signal:** Git-staleness — tied with lesson-tabs at 2026-05-29 18:39 (app.js-split sweep); mock-interview wins the tie-break on fewest 90d commits (3 vs 10).
**Step 0 verdict:** Cleared. Trailing 6-window (43/44/45/46/47/48) = 3 bails ≤ threshold 4 — fresh session, full ceremony.

## Before screenshots

- `/tmp/jsdrill-refine-49/01-mock-active-mobile-before.png` (390×844)
- `/tmp/jsdrill-refine-49/01-mock-active-desktop-before.png` (1280×800)

### Mobile caption

(a) **Eye lands on:** large "Two Sum (hash map)" lesson title + description sentence — journey-context the iter-24/27/29/32 mock-minimization series didn't touch.
(b) **Competes for attention:** rose mock banner, instruction copy *"Blank editor. Type the canonical solution from memory, then Run. Pass when output matches."*, 💎 Best/slope/trend pills, mock-history-trend cells, PROMPT box.
(c) **Hidden / below the fold:** the **CodeMirror editor itself**. Visible viewport ends inside the PROMPT box; the user can't see their typing surface during an active mock without scrolling. Bottom-sticky Run + Clear bar covers the next ~70px from below.

## Vision

If the mock-interview surface were the BEST it could be for the user in PROFILE.md, on iPhone-13-mini (390×844) the EDITOR + PROMPT + Run button would all be visible without scrolling once the timer starts. Above the editor: the rose banner with timer (the only authoritative time-source) + the compact badges row (💎 Best · slope · history pills) as journey context. The lesson title fades to the small `Pattern · Arrays & Hashing` breadcrumb (already done iter-32). Tutorial copy explaining the L3 flow disappears — once the mock is timed, every word above the editor is friction.

## Rubric score

**Total: 15/21**
**Suggested refine target:** Phone-fit (1/3 — lowest non-3, highest leverage given PROFILE.md's ~80% phone weight).

| Dim | Score | Evidence |
|---|---|---|
| Autopilot | 2/3 | One sticky `Run (R↵)` CTA; `End interview` is the lone secondary affordance. Clean. |
| Decisions | 3/3 | 0 decisions during active mock — type → Run. |
| Phone-fit | **1/3** | Mobile BEFORE: CodeMirror editor below the 844px fold (offsetTop measured ≥ viewport height). User must scroll to type. PROFILE.md "~80% on phone" pulls hard here. |
| Time-respect | 2/3 | Surface loads fast, but time-to-first-keystroke on mobile includes the scroll-to-find-editor step. Not <30s. |
| Diagnostic-aware | 2/3 | Smart-selection (iter 11) biases weak+due; slope-direction badge (iter 61) reads mockHistory. Not actively diagnosing during the active mock. |
| Progress-visible | 3/3 | 💎 Best + slope + mock-history pills all above the prompt. Excellent. |
| ADHD-fit | 2/3 | Iters 24/27/29/32 cut most competing surfaces; tension remaining: the instruction sentence is redundant with the rose banner's "MOCK INTERVIEW IN PROGRESS · X elapsed · hints disabled" framing. |

## Proposal

**Target dimension:** Phone-fit (1/3 → 2/3)
**Change:** Wrap the L3 instructional `<span>` at `js/app/12c-l3.js:151` ("Blank editor. Type the canonical solution from memory, then Run. Pass when output matches.") in `${isMock ? '' : '...'}`. Badges row (`${bestBadge}${slopeBadge}${trendBadge}`) preserved unchanged — those are journey context, not chrome.
**Closest step toward Step 2.5 vision because:** removing one tutorial sentence pulls the editor ~36–50px closer to the fold on mobile — the same broken-context-removal pattern iters 24/27/29/32 used. Five-iter trajectory toward the minimal-active-mock-surface vision.
**Why for user:** PROFILE.md "~80% of study time is on a phone" (Usage context, load-bearing) + "Limited working memory for parallel decisions" (Cognitive style — ADHD). The instruction reiterates what the rose banner already framed.
**Mockup (mobile, current viewport line @ 844):**

```
BEFORE                                    AFTER
─────────────────────────────             ─────────────────────────────
[Pattern · Arrays & Hashing]              [Pattern · Arrays & Hashing]
Two Sum (hash map)                        Two Sum (hash map)
Find indices of two values…               Find indices of two values…

╔═════════════════════════╗               ╔═════════════════════════╗
║ MOCK INTERVIEW IN…      ║               ║ MOCK INTERVIEW IN…      ║
║ 0:00 elapsed · hints    ║               ║ 0:00 elapsed · hints    ║
║ [End interview]         ║               ║ [End interview]         ║
╚═════════════════════════╝               ╚═════════════════════════╝

Blank editor. Type the canonical          💎 Best 1:35  ↓ 1:25 faster
solution from memory, then Run.           3:00  2:20  1:50  +1:35
Pass when output matches.
                                          ┌─[ PROMPT ]──────────────┐
💎 Best 1:35  ↓ 1:25 faster               │ Write twoSum(nums,…     │
3:00  2:20  1:50  +1:35                   │ Expected: ...           │
                                          └─────────────────────────┘
┌─[ PROMPT ]──────────────┐               ┌─[ CodeMirror editor ]──┐ ← VISIBLE
│ Write twoSum(nums,…     │               │ (cursor here)           │
│ Expected: ...           │               │                         │
└─────────────────────────┘               │                         │
─── 844px fold ───────────────             └─────────────────────────┘
[CodeMirror editor]            ↓ off-fold ─── 844px fold ─────────────
[Run] [Clear]                              [Run] [Clear]
```

**Files touched:** `js/app/12c-l3.js` (line 150–153 only).
**Test:** Re-run `tools/cdp/refine-mock-active.js` with `SNAP_TAG=after OUT_DIR=/tmp/jsdrill-refine-49`. Assertions:
- `#lesson-shell` does NOT contain text "Blank editor" during active mock
- mobile `editorTop` drops by ≥30px vs BEFORE
- All existing iter-24/27/29/32 invariants still pass (no regressions to the broken-context-removal series)

**Rubric projection:** 15/21 → 16/21 (Phone-fit 1→2: editor lands within ~30px of fold instead of below it).

## Contrarian verdict

**GREEN-LIGHT:** *"Suppressing redundant tutorial copy during an active mock pulls the editor closer to the fold on mobile, directly serving '~80% study time is on a phone' and the autopilot 'press one thing → you're drilling' posture — it removes nothing the mocker relies on (banner, timer, badges, prompt, editor, Run, End all intact) and the sentence still appears for non-mock users."*
