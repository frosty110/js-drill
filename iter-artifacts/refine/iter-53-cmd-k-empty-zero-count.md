# iter 53 — refine — cmd-k-palette (suppress zero-count modes in empty-default)

**Date:** 2026-05-30
**Surface:** cmd-k-palette
**Picker signal:** Mock-interview still strictly stalest by primary file, but picking it 3rd of 5 iters is intentional clustering (49 mock, 50 mock, 51 pivot, 52 pivot, 53 mock would be 3 of 5). Pivoted to next-stalest after another iteration of anti-clustering: cmd-k-palette (2026-05-29 23:23, 22 commits in 90d, last refined iter 34 → 19 iters of refinement-staleness).
**Step 0 verdict:** Cleared (trailing 6-window 47/48/49/50/51/52 = 2 bails ≤ threshold). 5th ship in this session — approaching the historical 6-ship-per-session ceiling; targeting a shallow cut to manage context.

## Before screenshots

- `/tmp/jsdrill-refine-53/01-palette-mobile-empty-before.png` (390×844, palette open, no query)
- `/tmp/jsdrill-refine-53/01-palette-mobile-q-before.png` (390×844, palette with query "two")
- `/tmp/jsdrill-refine-53/01-palette-desktop-empty-before.png` (1280×800)

### Mobile empty-state caption

(a) **Eye lands on:** the input placeholder "Search modes, lessons, sections…" then a long stack of MODE rows.
(b) **Competes for attention:** 12 MODE rows visible above the fold for a fresh-progress user, of which **7 carry "(0)" or " 0" suffixes** (Repair 0, Review (0), Weak Spots (0), Reveal Replay (0), At Risk (0), Resurrect (0), Bridge (0)) — non-actionable for the autopilot user, but still tappable noise.
(c) **Hidden / below the fold:** lessons + sections (the palette caps at 12 modes / 8 lessons / 4 sections in empty-default; user must scroll to see lesson/section quick-jumps).

## Vision

The empty-default palette is a curated *Quick Launch* — only modes the user can act on RIGHT NOW. Zero-count modes are still discoverable via typing (`reveal` finds "Reveal Replay (0)" — useful for navigation-by-name) but don't clutter the just-opened state. The palette behaves like a smart-default Spotlight: show me what I can do *now*, not every mode that exists.

## Rubric score

**Total: 15/21**
**Suggested refine target:** Diagnostic-aware (1/3 → 2/3) — the empty palette currently shows the same 12 modes regardless of the user's state.

| Dim | Score | Evidence |
|---|---|---|
| Autopilot | 2/3 | Palette gives one input field + sorted results — one obvious next action (type or tap). |
| Decisions | 2/3 | 12 visible modes is many decisions for autopilot user; iter-34 already de-cluttered the footer. |
| Phone-fit | 2/3 | Palette fits 390×844 cleanly; iter-34 made the footer touch-aware. |
| Time-respect | 3/3 | Open + type a few chars + tap a result is well under 30s. |
| Diagnostic-aware | **1/3** | Same 12 modes shown to every user; doesn't read state.weakness / state.reviews / state.revealed to filter. |
| Progress-visible | 2/3 | "(0)" suffixes ARE a progress signal but in a navigation surface — wrong place. |
| ADHD-fit | 2/3 | 7 of 12 visible rows aren't actionable; competing yellow MODE badges add visual weight. |

## Proposal

**Target dimension:** Diagnostic-aware (1/3 → 2/3) + ADHD-fit (2/3 → 2/3 directional, 7 fewer noise rows)
**Change:** In `js/app/14-init-core.js` empty-query branch (line 130), filter modes whose label ends with `(0)` or ` 0` before sorting + slicing. One-line predicate: `const isZeroCountMode = item => /\(0\)$|\s0$/.test(item.label);`. Applied ONLY to the empty-query default — the typed-query branch (line 138) is unchanged, so every mode stays discoverable by name.
**Closest step toward Step 2.5 vision because:** the palette becomes a "what can I do right now?" surface instead of a "here are all modes" surface — exactly the Spotlight-style smart default the vision names.
**Why for user:** PROFILE.md "Use recent diagnostic signal to bias the pick" (Study intent) + "Limited working memory for parallel decisions" (Cognitive style — ADHD).
**Mockup (mobile empty palette, fresh-progress user):**

```
BEFORE                            AFTER
─────────────────────             ─────────────────────
Search modes, lessons, sections…  Search modes, lessons, sections…
MODE Plan: Starter Plan ▾         MODE Plan: Starter Plan ▾
MODE 🧭 Plan View                 MODE 🧭 Plan View
MODE 👁 Hide Mastered             MODE 👁 Hide Mastered
MODE 🛠 Repair 0           ← cut  MODE 📅 Streak
MODE 🕒 Review (0)         ← cut  MODE 🎲 Shuffle
MODE ⚠️ Weak Spots (0)     ← cut  LESSON Two Sum (hash map)
MODE 🃏 Reveal Replay (0)  ← cut  LESSON Contains Duplicate
MODE 📡 At Risk (0)        ← cut  …                   ← lessons surface higher
MODE 💀 Resurrect (0)      ← cut
MODE 🧠 Bridge (0)         ← cut
MODE 📅 Streak
MODE 🎲 Shuffle
…lessons below fold…
```

**Files touched:** `js/app/14-init-core.js` (line 130 only).
**Test:** Re-run `tools/cdp/refine-cmd-k-palette.js`. Add assertion: in mobile empty-state, no palette row's label matches `/\(0\)$/`. Existing iter-34 footer assertions still pass.
**Rubric projection:** 15/21 → 16/21 (Diagnostic-aware 1→2; ADHD-fit 7 fewer noise rows in empty default).

## Contrarian verdict

**GREEN-LIGHT:** *"Hiding zero-count modes in the empty-query default reduces decisions for the ADHD user, preserves discovery via typed query, keeps counts visible in the sidebar, and removes no affordance the user could act on right now."*
