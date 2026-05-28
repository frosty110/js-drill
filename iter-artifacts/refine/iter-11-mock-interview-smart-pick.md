# Refine iter 11 — mock-interview (smart selection)

**Surface:** `startRandomMockInterview()` in `js/app/09-stats-cheatsheet-mock.js:669`.
**Primary file:** `js/app/09-stats-cheatsheet-mock.js` (CLEAN — no user WIP).
**Picker rationale:** This file is still the oldest non-WIP primary file (2026-05-27 09:57). Mock-interview was refined iters 4 + 7 via the SIBLING `12c-l3.js`; the actual SELECTION logic in this primary file has never been touched. Continuing iter-4's backlog with the highest-leverage queued item: smart selection.

## Step 2 — Empirical observations

Reading `startRandomMockInterview()` (lines 669-677): `Math.random()` over `patternLessons.filter(status==='full')`. **Selection is uniform random across all 79 patterns lessons.** No reference to `state.weakness`, `state.reviews`, `dueReviewIds()`, or any diagnostic signal. Two-sum and Trapping Rain Water — patterns at the opposite ends of the difficulty spectrum — have identical 1/79 selection probability regardless of user's actual gap state.

This is the highest-leverage gap in the entire mock-interview surface:
- Iter 4 fixed the post-win UX (win line + delta).
- Iter 7 added the "Mock another" forward CTA.
- BUT every mock — and every "Mock another" tap — picks a completely random pattern that ignores what the user actually needs work on.

The screenshots from iter-7 (`/tmp/jsdrill-refine-07-after/`) prove this empirically: clicking "Mock another" landed on `p-reverse-bits` (a complexity-heavy pattern) for a user who had ZERO patterns mastered yet. The picker ignored that the user might benefit from a simpler entry-level pattern first.

**Caption:**
- (a) Eye lands on the new mock-banner ("🎯 Mock interview in progress · 0:00 elapsed"). No selection signal visible.
- (b) Competes for attention: nothing — the picker is invisible to the user.
- (c) Hidden: the user's own gap state. dailyPlan() already surfaces weakness + SR-due in the Today's Plan modal; the mock picker should use the same diagnostic signal but doesn't.

## Step 2.5 — Vision

> If mock-interview were the BEST it could be for PROFILE.md's user (rusty
> engineer, autopilot-intent, diagnostic-aware), each tap of "🎯 Mock
> Interview" or "🎯 Mock another" would feel like the app reaching into
> the user's actual gap inventory — surfacing a pattern that's overdue for
> review, or one they recently missed at the L1 concept tier, before
> defaulting to a random pattern they've already mastered cleanly. The
> picker would still preserve variety (interleaving is a documented
> learning-science principle), so the user doesn't get stuck on the same
> "weak" pattern forever — but the WEIGHTING would lean toward their
> active gaps. Long-term metric: personal-bests trend down faster because
> each session is more likely to be on a lesson where the user has
> actionable room to improve.

The smallest visible step toward this vision THIS iter: **replace `Math.random` over the flat pool with a weighted pool — BOTH weak+due=×5, weak-or-due=×3, neither=×1.** Variety preserved (other patterns still in pool); bias toward gaps added. No new state. No new UI. No new persistence.

## Step 3 — Rubric (post-iter-7)

| Dim | Score | Evidence |
|---|---|---|
| Autopilot | 3/3 | iter 7 added "Mock another" CTA. |
| Decisions | 2/3 | Zero pre-drill / zero forward decisions. |
| Phone-fit | 3/3 | N/A per PROFILE line 43 (desktop-only). |
| Time-respect | 1/3 | Random selection across complexity-disparate lessons (Two Sum vs Trapping Rain Water are 1/79 each). |
| Diagnostic-aware | 0/3 | `startRandomMockInterview` line 675: `patternLessons[Math.floor(Math.random() * patternLessons.length)]`. ZERO reference to weakness, SR, diagnostic. |
| Progress-visible | 3/3 | iter 4 — win line + chips. |
| ADHD-fit | 3/3 | iter 4 — single-focus surface, verbal payoff. |

**Total: 15/21.** Target dimension: **Diagnostic-aware** (0/3, highest leverage). Smart selection takes it to 3/3 = +3.

## Step 4 — Proposal

**Target dimension:** Diagnostic-aware.

**Change:** In `js/app/09-stats-cheatsheet-mock.js`, refactor `startRandomMockInterview` to call a new `_pickMockLessonId()` helper that builds a weighted pool from `CURRICULUM` patterns:
- Lessons in BOTH `state.weakness` AND `dueReviewIds()` (with track='patterns'): **weight 5**
- Lessons in either (weak or due, not both): **weight 3**
- All other patterns: **weight 1**

Then pick uniformly from the weighted pool — same flat-random shape, just over a tilted pool. Variety preserved.

**Closest step toward Step 2.5 vision because:** The vision wants the picker to reach into the user's gap inventory. The minimum-surgery step is the weighted pool — no new state, no schema change, just a different formula at the same point in code.

**Why for user:** PROFILE.md line 66-69 ("Use recent diagnostic signal to bias the pick. The diagnostic (`diagnostic.html` results) reveals concept-level gaps — … today's autopilot weights complexity-heavy lessons + the 🧮 Big-O drill higher"); PROFILE.md success criterion "Mock interview personal-bests trend down over weeks" — trends accelerate when mocks land on actionable gaps.

**Mockup (behavioral, not visual):**

```
BEFORE:
  patternLessons = filter(CURRICULUM, full && patterns)
  pick = patternLessons[Math.random() * length]    // uniform 1/79

AFTER:
  patternLessons = filter(CURRICULUM, full && patterns)
  dueSet  = new Set(dueReviewIds().filter(track==='patterns'))
  weakSet = new Set(Object.keys(state.weakness).filter(track==='patterns'))
  pool = []
  for each lesson in patternLessons:
    if (weak AND due)  pool.push(lesson × 5)
    elif (weak OR due) pool.push(lesson × 3)
    else               pool.push(lesson × 1)
  pick = pool[Math.random() * pool.length]
```

For a user with 1 weak-only pattern + 1 due-only pattern in 79 total:
- Pool size = 79 (baseline) + 2×2 (extra weight on weak & due) = 83 entries
- BOTH lesson: 0 entries (none are both)
- weak lesson appears 3 times → P(pick) = 3/83 ≈ 3.6%
- due lesson appears 3 times → P(pick) = 3/83 ≈ 3.6%
- baseline lesson appears 1 time → P(pick) = 1/83 ≈ 1.2%

3x baseline for active gaps. Interleaving preserved.

**Files touched:** `js/app/09-stats-cheatsheet-mock.js` (lines ~669-677 — refactor `startRandomMockInterview` + add `_pickMockLessonId` helper).

**Test:** new probe `tools/cdp/refine-mock-smart-pick.js` — seeds state with 1 weak pattern + 1 due pattern + 1 BOTH-weak-and-due pattern, calls `_pickMockLessonId()` 300 times, tallies. Asserts: (a) BOTH lesson picked more often than weak-only, (b) weak-only picked more often than baseline, (c) due-only picked more often than baseline, (d) all baseline patterns still appear (variety preserved — no monopoly).

**Rubric projection:** 15/21 → 18/21 (Diagnostic-aware 0→3 = +3).

## Step 5 — Contrarian verdict

**GREEN-LIGHT:** "Same single-tap entry, no new decisions/UI/setup, mobile-irrelevant (mock is desktop-only per line 43), and it directly serves the autopilot 'use recent diagnostic signal to bias the pick' rule (lines 67-70) without removing the 85% baseline variety the user relies on."

## Step 7 — Implementation + verification

**Change shipped:** `js/app/09-stats-cheatsheet-mock.js` — refactored `startRandomMockInterview()` to call a new `_pickMockLessonId()` helper that builds a weighted pool of Patterns lessons:
- Lessons in BOTH `state.weakness` AND `dueReviewIds()` (track=patterns): **weight 5**
- Lessons in either alone: **weight 3**
- All other patterns: **weight 1**

Pool drawn uniformly. No state change, no UI, no setup gate.

**Validator:** `node tools/validate-data.js` → 803 passed, 0 failed.

**Probe:** `node tools/cdp/refine-mock-smart-pick.js` → **10/10 assertions pass**.

Empirical distribution over 300 trials (seed: 1 weak + 1 due + 1 BOTH):

| Lesson | Tier | Picks | Expected ratio |
|---|---|---|---|
| `p-contains-dup` | BOTH (weight 5) | 11 | highest |
| `p-valid-anagram` | DUE (weight 3) | 8 | mid |
| `p-anagrams` | WEAK (weight 3) | 4 | mid |
| `two-sum` | baseline (weight 1) | 3 | low |

Distinct lessons picked = 87 across 300 trials → variety preserved (no monopoly). Baseline still appears.

**Rubric:** 15/21 → 18/21 (Diagnostic-aware 0→3 = +3).

## Queued to backlog (carried)

- Pre-flight beat ("you're about to drill X (est. Y min) · Start | Pick another"); contrarian risk on autopilot principle.
- `endMockInterview()` re-render architecture cleanup (in-place chip update vs full body re-render).
- Time-estimate signal per pattern lesson (Time-respect 1/3 unaddressed by this iter).
- Surface the "why this pick?" rationale to the user (post-mock or pre-mock) — e.g., "You picked Contains Duplicate (review due 1d ago + L1 miss)" so the diagnostic-awareness becomes felt, not just operational.

