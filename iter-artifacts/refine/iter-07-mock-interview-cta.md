# Refine iter 7 — mock-interview (forward CTA)

**Surface:** Mock Interview shell — post-win L3 feedback area (`js/app/12c-l3.js` `run()` `wasMock` branch).
**Primary file:** `js/app/12c-l3.js` (clean) + `js/app/09-stats-cheatsheet-mock.js` (clean — exposes `startRandomMockInterview`).
**Picker rationale:** Git-staleness — `09-stats-cheatsheet-mock.js` is the oldest non-WIP primary file at 2026-05-27 09:57. Iter 4 refined this surface but via SIBLING `12c-l3.js`; primary file unchanged. Continuing a backlog item from iter 4 (the forward CTA queued there).

## Step 2 — Empirical observations (`/tmp/jsdrill-refine-07/`)

Re-used `tools/cdp/refine-mock-interview.js` probe to capture the post-mock win state. As of iter 4, the win line correctly shows the delta-vs-PB tier message. **After the win, the user gets the message + SR badge + nothing else.** To do another mock — the only way to actually drive the "personal-bests trend down over weeks" success criterion in PROFILE.md — the user must:
1. Navigate via the sidebar to the 🎯 Mock Interview button OR a different lesson, OR
2. Stay on the current lesson and re-mock it (no path for this from the win screen).

That's a 2+ click traversal back to the sidebar, breaking the desktop drilling flow when the user wanted to keep going.

**Caption:**
- (a) Eye lands on the green ✓ Solved line in the L3 action bar after the run.
- (b) Competes for tap/attention: NOTHING — the win screen has no forward CTA; the user's next move is unclear.
- (c) Hidden: the obvious "do another one while I'm warmed up" action. The 🎯 Mock Interview sidebar button is 200+px away in the left rail.

## Step 2.5 — Vision

> If the mock-interview post-win moment were the BEST it could be for the
> PROFILE.md user (desktop-only by mandate, autopilot-intent), it would
> feel like the "next set" button on a fitness app: solve, see the time
> + delta-vs-PB, then ONE tap to start the next mock — auto-picked by the
> diagnostic+SR-weighted selector (queued to backlog) so each mock is
> the right next pattern. The user enters a "mock streak" loop where the
> friction between mocks is near-zero, and the personal-bests-trend-down
> success metric becomes statistically inevitable rather than aspirational.

The smallest visible step toward this vision THIS iter: **add a `🎯 Mock another` button inline on the win-screen feedback line.** Selection stays random for now (smart-pick is a separate, larger refinement queued to backlog from iter 4). The button calls existing `startRandomMockInterview()` — no new state, no new persistence.

## Step 3 — Rubric (post-iter-4)

| Dim | Score | Evidence |
|---|---|---|
| Autopilot | 2/3 | One-button entry from sidebar. Once in, no in-session continuity loop (next mock = back to sidebar). |
| Decisions | 2/3 | Zero pre-drill decisions (good). Zero post-win forward affordances either — user must invent a next-action. |
| Phone-fit | N/A | PROFILE 43 — desktop-only. Score as 3. |
| Time-respect | 1/3 | Random selection over 79 lessons of vastly different complexity (unchanged from iter 4). |
| Diagnostic-aware | 0/3 | Picker ignores weakness, SR-due, diagnostic gaps (unchanged from iter 4). |
| Progress-visible | 3/3 | iter 4 fix — win line + chips + slope + trend reel all visible. Excellent. |
| ADHD-fit | 3/3 | iter 4 fix — single-focus surface, verbal payoff restored. |

**Total: 14/21** (iter-4 ending score). Target dimension: **Autopilot** (lifting the post-win continuity loop pushes 2→3 and shows the path toward the smart-select vision).

## Step 4 — Proposal

**Target dimension:** Autopilot.

**Change:** In `js/app/12c-l3.js` `run()` wasMock branch (~line 587-590), append a `<button data-action="mock-again" class="secondary">🎯 Mock another</button>` to the live feedback element, and wire its click handler to call `startRandomMockInterview()`. The button is subordinate to the green ✓ Solved message — it doesn't interrupt the win-moment, just offers the next set.

**Closest step toward Step 2.5 vision because:** The vision wants a fitness-app "next set" loop. The minimum-surgery step is the button — even with random selection (smart-pick is queued), the friction-to-repeat-mock drops from "navigate to sidebar" to "one tap right here."

**Why for user:** PROFILE.md success criterion "Mock interview personal-bests trend down over weeks" — trends require REPEAT mocks; lowering repeat-friction is the most direct path to the metric.

**Mockup:**

```
BEFORE (iter-4 ending state):

  ┌─ action bar ────────────────────────────────────────┐
  │ [Run (⌘↵)]  [Clear]                                 │
  │ ✓ Solved in 0:42 (1 try) — new personal best (was   │
  │   2:00, 1:18 faster)  ·  Next review in 1d.         │
  └─────────────────────────────────────────────────────┘
                                       ^^^ END — no next action

AFTER:

  ┌─ action bar ────────────────────────────────────────┐
  │ [Run (⌘↵)]  [Clear]                                 │
  │ ✓ Solved in 0:42 (1 try) — new personal best (was   │
  │   2:00, 1:18 faster)  ·  Next review in 1d.         │
  │   [🎯 Mock another]                                  │
  └─────────────────────────────────────────────────────┘
                                       ^^^ one tap → next mock
```

**Files touched:** `js/app/12c-l3.js` only (extends the iter-4 wasMock branch).

**Test:** `tools/cdp/refine-mock-interview.js` — add assertions after the existing 8: (a) `[data-action="mock-again"]` exists in `.feedback` after the win, (b) clicking it triggers `state.mock.active === true` on a (possibly different) lesson, (c) clicking it does NOT throw.

**Rubric projection:** 14/21 → 15/21 (Autopilot 2→3 = +1).

## Step 5 — Contrarian verdict

**GREEN-LIGHT:** "Adds a single optional inline button on a desktop-only surface that calls existing logic — no decisions added (one default action), no mobile impact (PROFILE line 43: 'Mock interview is desktop-only by nature — that's fine'), no affordance removed, and it directly serves the success criterion 'Mock interview personal-bests trend down over weeks' by reducing friction to repeat."

## Step 7 — Implementation + verification

**Change shipped:** `js/app/12c-l3.js` `run()` wasMock branch — appended `<button data-action="mock-again" class="secondary">🎯 Mock another</button>` to the live feedback element, wired its click handler to call existing `startRandomMockInterview()`. No new state, no new persistence, no removed affordances.

**Validator:** `node tools/validate-data.js` → 803 passed, 0 failed.

**Probe:** `node tools/cdp/refine-mock-interview.js /tmp/jsdrill-refine-07-after` → **10/10 assertions pass**:
- 3 win-tier text assertions (carried from iter 4)
- 5 prior-best content assertions (carried from iter 4)
- `[mock-again] CTA button present in feedback after a mock win`
- `[mock-again] clicking the CTA started a new mock (lessonId=p-reverse-bits)` — proves the click actually drives a new mock on a different random pattern lesson

**Visual diff:**
- BEFORE `/tmp/jsdrill-refine-07/`: win line ends at "Next review in 1d." with no forward action.
- AFTER `/tmp/jsdrill-refine-07-after/`: win line ends with inline `🎯 Mock another` secondary button; clicking it transitions to a new mock-in-progress shell on a different patterns lesson (screenshot `05-04-after-mock-again-click.png` shows the reverseBits mock loaded).

**Rubric:** 14/21 → 15/21 (Autopilot 2→3 = +1).

## Queued to backlog (carried forward + unchanged)

- Smart selection — replace Math.random with weighted SR-due + weakness + diagnostic-gaps.
- Pre-flight beat — 3-sec "you're about to drill X" preview gate.
- `endMockInterview()` re-render architecture cleanup (in-place chip update vs full body re-render).

