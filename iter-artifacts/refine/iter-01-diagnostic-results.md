# /drill-refine — Iter 1 (refine) — `diagnostic-results`

**Surface:** `diagnostic-results` (results page on `diagnostic.html`)
**Stalest by git:** last touched 2026-05-26 23:53 (≥10h older than next-oldest at picker time)
**Screenshots:** `/tmp/jsdrill-refine-01/01-diagnostic-results-{mobile,desktop}-before.png`
**Probe:** `tools/cdp/refine-diagnostic-results.js`

## Vision (first-principles)
The diagnostic results page is the one moment the user has voluntarily produced 32+ minutes of concept-level signal. The best version of this surface honors that investment by closing the autopilot loop: name the weakest section in plain English, offer ONE primary CTA that routes the user directly into a high-throughput mobile drilling surface, and demote the JSON export to the "or, for later" path. 43 questions in → one tap to drilling out.

## Rubric score
| Dim | Before |
|---|---|
| Autopilot | 0/3 |
| Decisions | 1/3 |
| Phone-fit | 2/3 |
| Time-respect | 1/3 |
| Diagnostic-aware | 1/3 |
| Progress-visible | 2/3 |
| ADHD-fit | 1/3 |
| **Total** | **8/21** |

## Proposal

**Target dimension:** Autopilot (0/3 → 2/3)
**Change:** Add a primary CTA at the TOP of the results card — "🎯 Drill weakest: <Section> →" — that names the lowest-MC% section in its label, sets `sidebarTrack=patterns` + `lastTab=L1` in main-app storage via DrillStorage's existing `setMain*` bridge, and navigates to `index.html`. Existing Export/Copy/Restart CTAs stay in place, demoted from primary by visual hierarchy (the new button is large, accent-colored, above the table; the JSON CTAs sit below it as before but lose their visual lead).
**Closest step toward Step 2.5 vision because:** It converts dead air into the one-tap-to-drilling autopilot the vision describes, without touching main-app code (storage bridge is sufficient).
**Why for user:** PROFILE.md:78 — "default posture is press one thing → you're drilling"; PROFILE.md:64-73 (autopilot intent — use diagnostic signal); PROFILE.md:30-44 (L1 is the highest-throughput mobile surface).
**Mockup:**

Before (results card top):
```
┌────────────────────────────────────┐
│ Done — export and send to me       │
│ Auto-scored MC results …           │
│ [section table]                    │
│ Time: 32m 36s …                    │
│                                    │
│ [⬇ Export JSON] [📋 Copy] [Restart]│
│                                    │
│ Send the JSON to me to grade…      │
└────────────────────────────────────┘
```

After:
```
┌────────────────────────────────────┐
│ Done — 39/43 answered, 32m 36s     │
│                                    │
│ ╔════════════════════════════════╗ │
│ ║ 🎯 Drill weakest: Trace (50%)→ ║ │   ← new big primary CTA
│ ╚════════════════════════════════╝ │
│                                    │
│ [section table]                    │
│ … (rest of page unchanged)         │
│                                    │
│ [⬇ Export JSON] [📋 Copy] [Restart]│
└────────────────────────────────────┘
```

**Files touched:** `diagnostic.html` only (the inline `renderDone()` function and a small handoff helper).
**Test:** `tools/cdp/refine-diagnostic-results.js` extended with:
  - assert primary CTA exists with id `#drill-weakest-btn`
  - assert it names the weakest section in its label text
  - simulate-click: assert it stamps `sidebarTrack=patterns` and `lastTab=L1` into `jsdrill.progress.v1` AND navigates to `index.html`

**Rubric projection:** 8/21 → 13/21
  - Autopilot 0 → 2 (clear default exists; tap → drilling, no human in loop)
  - Time-respect 1 → 2 (no waiting for grader as the user's next action)
  - Diagnostic-aware 1 → 2 (the signal now feeds an action, not just a display)

## Contrarian verdict

GREEN-LIGHT: "Adds a single primary 'press one thing → you're drilling' CTA that fulfills PROFILE.md:76-78's autopilot rule without removing any existing affordance (Export/Copy/Restart/help-text/← Drill all preserved), adding a decision (it's the new default, not a choice), or breaking the mobile-first tap surface."
