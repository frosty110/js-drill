# /drill-refine — Iter 3 (refine) — `mechanics`

**Surface:** `mechanics` (🧩 Mechanics modal — List + Track×Tag views)
**Stalest by git:** tied with `mock-interview` at 2026-05-27 09:57:21 (refactor commit, no UX touch since). Tie-broken by PROFILE.md anti-pattern (mock-interview = desktop-only-by-nature, don't mobilify) and surface leverage (Mechanics IS the diagnostic-aware transfer-gap radar).
**Screenshots:** `/tmp/jsdrill-refine-03/{01,02}-mechanics-{mobile,desktop}-before-{list,matrix}.png`
**Probe:** `tools/cdp/refine-mechanics.js`

## Vision (first-principles)
The Mechanics modal is the rusty engineer's "transfer gap radar" — where they see "I know this idiom in Patterns but haven't applied it to Syntax yet." The best version opens directly to whichever view has the most actionable signal: when transfer gaps exist, Matrix view (with ⚠ rows surfaced first + color-coded mastery) IS the diagnostic-aware payload. When no gaps exist (brand-new user), List view is the right default. Open Mechanics → instantly see your transfer gap, no toggle hunt needed.

## Rubric score
| Dim | Before |
|---|---|
| Autopilot | 2/3 |
| Decisions | 2/3 |
| Phone-fit | 2/3 |
| Time-respect | 2/3 |
| Diagnostic-aware | 1/3 |
| Progress-visible | 2/3 |
| ADHD-fit | 2/3 |
| **Total** | **13/21** |

## Empirical evidence

- Engaged-user seed (~50% syntax, ~30% patterns, ~20% applied mastered): Matrix view reveals **5 transfer gaps** (mechanics mastered in one track but not another), prominently displayed in an ⚠ banner + 5 amber-bordered rows surfaced first.
- Current default opens to **List** view (sorted by lesson count desc within category), so the 5 ⚠ gaps are invisible until the user notices the small "List / Track × Tag" pill toggle and taps Track × Tag.
- On mobile, the toggle pills are subtle (border-only outline for inactive state).

## Proposal

**Target dimension:** Diagnostic-aware (1/3 → 3/3)
**Change:** In `openMechanicsModal()` (js/app/13-mechanics-modal.js:37-50), after `ensureMechanicIndex()` resolves, check whether any transfer gaps exist (via a new helper `_hasTransferGaps()` that filters `_mechanicsTrackMatrix()` by `row.transferGap`). If ≥1 gap exists, set `_mechanicsView = 'matrix'` so the modal opens directly into the diagnostic-aware Matrix view. Otherwise default stays `'list'` (preserves new-user / no-progress experience).
**Closest step toward Step 2.5 vision because:** It makes the default action the diagnostic-aware action — the user lands on the ⚠ transfer-gap rows the moment they open the surface, instead of needing to toggle to find them.
**Why for user:** PROFILE.md:67-68 ("Use recent diagnostic signal to bias the pick"); PROFILE.md:53-54 ("Default actions matter more than option exhaustiveness — pick something reasonable, let them override"); PROFILE.md:71-72 ("Show progress + scores at a glance — without the user having to navigate to find them").
**Mockup:**

Before (default open):
```
┌─────────────────────────────┐
│ 🧩 Mechanics            ×   │
│ Code idioms tagged across…  │
│ [● List] [○ Track×Tag]      │ ← toggle (subtle)
│ ITERATION                   │
│ Array transform chain  2/5  │
│ Greedy single-pass scan 1/4 │
│ Sort then sweep        0/3  │
│ Text scan / tokenize   0/3  │
│ …                           │
│ ↓ scroll (39 mechanics)     │
└─────────────────────────────┘
(User must notice the toggle, tap, to find their 5 transfer gaps)
```

After (default open, with ≥1 transfer gap):
```
┌─────────────────────────────┐
│ 🧩 Mechanics · Track × Tag  │
│ Mastered/total per (mech,…) │
│ [○ List] [● Track×Tag]      │ ← Matrix is active
│ ⚠ 5 transfer gaps — listed   │
│   first                      │
│            SYNTAX PATTERN APP│
│ ⚠ Array-as-stack  1/1 3/5 0/3│
│ ⚠ Set for dedup   1/1 4/5 0/3│
│ ⚠ Array-as-queue  1/1 2/5 0/1│
│ ⚠ Frequency map   1/1 3/4 0/1│
│ ⚠ Array transform 1/1 1/3 0/1│
│ Closure capturing 1/3 0/2 2/4│
│ …                           │
└─────────────────────────────┘
(User immediately sees diagnostic; one tap on a cell → drill that lesson)

No-progress user (no transfer gaps possible — every cell is "—"):
→ stays on List view as today.
```

**Files touched:** `js/app/13-mechanics-modal.js` only (one new helper + one conditional inside openMechanicsModal).
**Test:** `tools/cdp/refine-mechanics.js` extended to assert:
  - After clicking 🧩 Mechanics with engaged-user seed: header text contains "Track × Tag", matrix view-toggle button has active style, ⚠ transfer-gap banner is present in body.
  - After clicking List toggle: header text reverts to "🧩 Mechanics", list view-toggle has active style.
  - With no-progress seed: default opens to List view (header text = "🧩 Mechanics").
**Rubric projection:** 13/21 → 16/21
  - Diagnostic-aware 1 → 3 (default is the diagnostic-aware view when gaps exist)
  - Time-respect 2 → 3 (one tap to see transfer gaps instead of three)
  - Autopilot 2 → 3 (the default action surfaces the most actionable signal)

## Contrarian verdict

GREEN-LIGHT: "Defaulting to Matrix view only when transfer gaps exist surfaces the diagnostic signal without adding decisions, removes no affordance (toggle remains one tap away), and aligns with 'use recent diagnostic signal to bias the pick' / 'Default actions matter more than option exhaustiveness.'"
