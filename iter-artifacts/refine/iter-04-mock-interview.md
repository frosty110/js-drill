# Refine iter 4 — mock-interview

**Surface:** Mock Interview shell (`startMockInterview` → in-mock L3 → end-of-mock).
**Primary file(s):** `js/app/09-stats-cheatsheet-mock.js` (state + start/end), `js/app/12c-l3.js` (in-mock body + win feedback).
**Picker rationale:** Git-staleness — `09-stats-cheatsheet-mock.js` was the oldest-touched (2026-05-27 09:57) of the non-WIP files; the file also backs `reflect-dashboard` (refined iter 2), but the `mock-interview` portion hadn't been refined.
**PROFILE constraint:** Desktop-only — line 43 explicitly forbids mobilifying this surface. **Phone-fit dimension is N/A.**

## Step 2 — Empirical observations (screenshots `/tmp/jsdrill-refine-04/`)

Drove the mock end-to-end via CDP probe `tools/cdp/refine-mock-interview.js` in three scenarios on a 1440×900 desktop viewport: first-pass (no prior best), new-PB (prior best 10:00 → beat it), off-best (prior best 0:00:001 → can't beat it).

**What I expected to see:** A green feedback line below the editor saying e.g. `✓ Solved in 0:02 (1 try) — new personal best!`, which is what the code in `js/app/12c-l3.js:572` appears to produce.

**What I actually saw (3/3 scenarios):**
- The mock-timer banner disappears (mock ended).
- The L3 body fully re-renders: edge-case chips reappear, L3 keyboard chips reappear, blank editor.
- The `⏱ Best`, slope (`↓ 9:59 faster vs first`), and trend reel chips in the L3 header DO update with the new data — these are the only silent acknowledgments the user gets.
- **The `✓ Solved in X — new personal best!` feedback line is empty.** Probe assertion `feedback contains "Solved in"` fails 3/3.

**Why:** `endMockInterview()` (line 666 of `09-stats-cheatsheet-mock.js`) calls `renderLesson()` which fully re-renders the L3 body. The `feedback` closure in `12c-l3.js:573` references the OLD (now detached) `.feedback` div. The `feedback.innerHTML = '✓ Solved in…'` write at line 572 lands on a node not in the DOM. The user never sees the win acknowledgment.

This is a latent bug, not just a refinement opportunity. The feedback line was never actually visible to mock users.

**Caption — eye/competition/hidden per `/browser-test` discipline:**
- (a) Eye lands first: page title + editor area, then the header chips when the user notices them update.
- (b) Competes for tap/attention: the SyncHint banner that triggers on first L3 pass (iter 114) shows up at the bottom of the L3 body — drowning out any post-game signal.
- (c) Hidden: the "you just got a personal best" emotional payoff is structurally absent; the delta vs prior PB, never shown at all.

## Step 2.5 — First-principles vision

> If mock-interview were the BEST it could be for the user in PROFILE.md, the win
> screen would feel like a fitness-app workout summary: the moment your code
> matches the expected output, you see your time, your old best, the gap closed
> (or fallen behind), and one forward CTA — "Mock another?" — that auto-picks
> the next-most-useful pattern (weighted by SR-due + weakness + diagnostic
> gaps), not Math.random over 79 lessons of vastly different complexity. The
> personal-best curve in `state.mockHistory` is the only success metric
> PROFILE.md actually names for this surface ("personal-bests trend down over
> weeks") — every UX beat should make that curve felt at the moment the user
> earns a point on it.

The smallest visible step toward this vision: **fix the latent bug AND give
the win line meaning** — surface the priorBest, the delta, and the
no-prior-pass tier in the feedback message. The trend chip in the header
becomes a confirming detail, not the only signal.

The smart-selection rewrite (random → weighted by SR/weakness/diagnostic) is
out of scope for this iter — queued to backlog. So is the "Mock another?"
forward CTA.

## Step 3 — Rubric score (7-dim, /refine-rubric inline)

| Dim | Score | Evidence |
|---|---|---|
| Autopilot | 2/3 | `mock-btn` is one-click → mock starts; but the pick is uniform random across 79 patterns (ignores autopilot's "decides for you with diagnostic signal" intent). `js/app/14-init-core.js:401`. |
| Decisions | 2/3 | Zero decisions before drilling (good); zero forward CTAs at end (could offer "Mock another?"); no easy escape from a too-hard pick except End interview. |
| Phone-fit | N/A | PROFILE.md line 43 explicitly desktop-only. Score as 3 (not applicable rather than bonus). |
| Time-respect | 1/3 | Random picks across 79 lessons of vastly different complexity. User with 5 minutes can land on a 12-minute problem with no preview. No estimated-time signal. |
| Diagnostic-aware | 0/3 | Picker ignores `state.weakness`, `state.reviews` (SR due), `state.bestTimes`, recent diagnostic results. `startRandomMockInterview()` at `js/app/09-stats-cheatsheet-mock.js:669`. |
| Progress-visible | 1/3 | The header `⏱ Best` / slope / trend reel chips DO update on mock end (data is there). But the win moment itself is silent — feedback line is empty due to detached-node bug. Personal-best delta is never shown. |
| ADHD-fit | 2/3 | Single-focus surface (banner + editor + timer); scaffolding suppressed. Good. But the "what just happened" emotional beat is missing — feedback line empty, SyncHint banner competes for the win moment. |

**Total: 11/21.** Suggested target dimension: **Progress-visible** (1/3 today; high leverage from the win-line fix). ADHD-fit also lifts (2→3) since the win moment regains a verbal payoff.

## Step 4 — Proposal

**Target dimension:** Progress-visible (also lifts ADHD-fit).

**Change:** In `js/app/12c-l3.js` `run()`, capture `priorBest` BEFORE calling `endMockInterview()`, then re-acquire the `.feedback` element AFTER the re-render and write an enriched message — first-pass tier (no priorBest), new-PB tier (delta + prior), matched tier, off-best tier (delta + prior).

**Closest step toward Step 2.5 vision because:** The vision wants the win moment to carry the trend felt-ness of the fitness-app summary. The smallest visible step is giving the win line itself the delta-vs-PB data — without it, the trend chip is the only signal and it lives 200px from where the user's eye is at click-time.

**Why for user:** PROFILE.md line 71-73 ("Show progress + scores at a glance — without the user having to navigate to find them"); PROFILE.md success criterion "Mock interview personal-bests trend down over weeks" — the delta-vs-PB is the trend-felt micro-summary that signal needs to be felt, not just measured.

**Mockup:**

```
BEFORE (latent bug — feedback line is empty after re-render):

  ┌─ L3 header ─────────────────────────────────────────┐
  │ Blank editor. Type the canonical…   ⏱ Best 0:42  ↓ 1:18 faster · 02:00·01:42·00:42  │
  └─────────────────────────────────────────────────────┘
  …
  ┌─ action bar ────────────────────────────────────────┐
  │ [Run (⌘↵)]  [Clear]                                 │   ← feedback area is EMPTY
  └─────────────────────────────────────────────────────┘

AFTER (feedback restored + carries the trend):

  ┌─ action bar ────────────────────────────────────────┐
  │ [Run (⌘↵)]  [Clear]                                 │
  │ ✓ Solved in 0:42 (1 try) — new personal best (was   │
  │   2:00, 1:18 faster)  ·  SR: advanced to 7d         │
  └─────────────────────────────────────────────────────┘

  Other tiers:
  • first-pass:  "✓ Solved in 0:42 (1 try) — first mock pass for this lesson"
  • matched:     "✓ Solved in 0:42 (1 try) — matched your best (0:42)"
  • off-best:    "✓ Solved in 1:18 (3 tries) — 0:36 off your best (0:42)"
```

**Files touched:** `js/app/12c-l3.js` (run() handler, ~10 lines added in the `wasMock` branch).

**Test:** `tools/cdp/refine-mock-interview.js` — three scenarios, three assertions: first-pass feedback contains "first mock pass"; new-PB feedback contains "new personal best" AND "faster"; off-best feedback contains "off your best". Currently 0/3 pass; after the fix 3/3 should pass.

**Rubric projection:** 11/21 → 14/21 (Progress-visible 1→3 = +2; ADHD-fit 2→3 = +1).

## Step 5 — Contrarian verdict

**GREEN-LIGHT:** "Restores a previously-invisible post-pass acknowledgment with concrete progress data (time, tries, delta-vs-best) directly on the L3 surface — no new decisions, no new setup, no mobile impact (mock is desktop-only per PROFILE line 43), and it strengthens 'show progress + scores at a glance' (intent #3)."

## Step 7 — Implementation + verification

**Change shipped:** `js/app/12c-l3.js` `wasMock` branch — capture `priorBest` before `endMockInterview()` overwrites `state.bestTimes`; after the re-render, re-acquire `.feedback` via `document.querySelector('#lesson-shell .feedback')`; render the tier-specific message.

**Validator:** `node tools/validate-data.js` → 803 passed, 0 failed.

**Probe:** `node tools/cdp/refine-mock-interview.js` → 8/8 assertions pass.
- `[first-pass]` feedback shows: `✓ Solved in 0:00 (first try) — first mock pass for this lesson`
- `[new-PB]` feedback shows: `✓ Solved in 0:00 (first try) — new personal best (was 10:00, 9:59 faster)`
- `[off-best]` feedback shows: `✓ Solved in 0:00 (first try) — 0:00 off your best (0:00)`

**Screenshots:** `/tmp/jsdrill-refine-04/*-before.png` (BEFORE — feedback empty, header chips only) vs `/tmp/jsdrill-refine-04-after/*-win.png` (AFTER — green feedback line below action bar carries the delta + prior best, header chips reinforce the same signal).

**Rubric:** 11/21 → 14/21 (Progress-visible 1→3 = +2; ADHD-fit 2→3 = +1, since the win moment regains its verbal payoff).

## Queued to backlog (out of scope for this iter)

- Smart selection — replace `Math.random` over 79 Patterns with weighting by `state.weakness ∪ SR-due ∪ diagnostic-gaps` (PROFILE line 66-69).
- Forward CTA — "Mock another?" button after the win, prefilled with the smart-pick.
- Pre-flight beat — 3-second "you're about to drill X (est. Y min) · Start | Pick another" gate.
- Re-render architecture — `endMockInterview()` should not full-re-render the L3 body; an in-place chip-only update is the cleaner fix (the workaround in this iter re-acquires `.feedback` post-render).

