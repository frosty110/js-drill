# Refine iter 6 — plan-picker-modal

**Surface:** Plan Picker modal (`openPathModal()` in `js/app/03-paths-cram.js:973`).
**Primary file:** `js/app/03-paths-cram.js` (clean, no WIP).
**Picker rationale:** Git-staleness — 03-paths-cram.js latest = 2026-05-27 22:56 (yesterday), among non-WIP non-just-refined surfaces. PROFILE-critical: it's where first-time users land via the welcome flow.

## Step 2 — Empirical observations (`/tmp/jsdrill-refine-06/`)

Probe `tools/cdp/refine-plan-picker.js` captured both modes (`welcome:true` and `welcome:false` = "switch") at desktop (1280×800) + mobile (390×844).

**Desktop welcome:** Heading "👋 Welcome to JS Drill" + subtitle. Three path cards: Starter Plan / 4-Day Interview Cram / Eve Legal Interview Prep. Each card has a header row (icon+name LEFT, "Pick →" tag RIGHT) and a blurb below. Below the cards: "🩺 Or start with a 43-question diagnostic →" cyan link + "Browse on my own (no path)" gray button. **No card carries a default-recommended visual hint** — all three cards look equally weighted to a first-time eye.

**Desktop switch:** Same 3 cards but the current path (Starter, in seed) gets an emerald border + "● Current" tag, others get "Switch →". Clear active state.

**Mobile welcome:** Modal centered. Three cards stacked. "Pick →" tag readable but right-edge cramped on the longer-named "Eve Legal Interview Prep" card. Footer link + browse-on-own visible.

**Mobile switch:** "Switch →" tag visible but the "● Current" tag on Starter (when name + icon are present) compresses badly because the flex header row runs out of room.

**Caption (per `/browser-test`):**
- (a) Eye lands on heading "Welcome to JS Drill" + the FIRST card's name (no hierarchy beyond order).
- (b) Competes for tap/attention: 3 path cards + 2 footer links = **5 mutually-exclusive choices** on first impression.
- (c) Hidden: which path is the recommended starting point for an unsure first-time user. The cards are visually equal-weighted.

## Step 2.5 — Vision

> If the plan-picker were the BEST it could be for the PROFILE.md user (ADHD,
> low-overwhelm-tolerance, autopilot-intent), the FIRST card on welcome would
> carry a small "⭐ RECOMMENDED · most users start here" banner with a brighter
> emerald accent — so a first-time user with limited working memory can land,
> see the obvious default, and tap once to begin without comparing three
> blurbs. Each card would also carry a small "~N min/day · M lessons" badge to
> respect limited study time (deferred to backlog). The diagnostic link below
> would become "Not sure? Take a 5-min diagnostic first" so it carries a
> clearer "this is the alternative path for the undecided" intent. The
> Browse-on-own escape stays as the third tier — barely visible.

The smallest visible step toward this vision THIS iter: **add a "⭐ Recommended"
pill + brighter accent border to the Starter Plan card when the modal opens in
welcome mode.** The per-card time/lesson badges and the diagnostic-link
re-copy are bigger surgeries — queued to backlog.

## Step 3 — Rubric

| Dim | Score | Evidence |
|---|---|---|
| Autopilot | 1/3 | 3 cards + 2 footer links = 5-way decision on first impression. No visual default. PROFILE 76-78. |
| Decisions | 1/3 | 5 mutually-exclusive choices. PROFILE 53-54: "Default actions matter more than option exhaustiveness." |
| Phone-fit | 1/3 | Tags slightly clipped on long-named paths on mobile (less severe than iter-5's today-plan, but present). |
| Time-respect | 1/3 | No per-card time signal; blurbs are paragraph-form, hard to scan in 5-min mobile window. |
| Diagnostic-aware | 1/3 | Diagnostic link demoted below cards. No "if unsure" framing. |
| Progress-visible | 2/3 | Switch mode shows "● Current" clearly; welcome has no progress (correct for first-time). |
| ADHD-fit | 1/3 | 5 choices + paragraph blurbs + no visual leader. |

**Total: 8/21.** Target dimension: **Autopilot** (lifting it also lifts Decisions + ADHD-fit in one move).

## Step 4 — Proposal

**Target dimension:** Autopilot (lifts Decisions + ADHD-fit secondarily).

**Change:** In `js/app/03-paths-cram.js` `openPathModal()` cards loop (~lines 996-1003), when `welcome === true` AND `p.id === 'starter'`, prepend a small "⭐ RECOMMENDED" banner inside the card body AND give the card a brighter emerald border + tint. Welcome mode only — existing-user switch mode unchanged (they already have a "● Current" badge).

**Closest step toward Step 2.5 vision because:** The vision wants first-time users to see ONE obvious default. The minimum-surgery step is a visual hint on the existing default card without changing the card order or removing any option.

**Why for user:** PROFILE.md line 53-54 ("Default actions matter more than option exhaustiveness — pick something reasonable, let them override"); PROFILE.md line 76-78 (autopilot — "press one thing → drilling"); PROFILE.md line 48-50 (ADHD "single-focus surfaces, not menus-of-menus").

**Mockup:**

```
BEFORE (welcome, ALL 3 cards visually equal):

  ┌─ 👋 Welcome to JS Drill ─────────────────────────┐
  │ 166 lessons... Pick a plan that fits your        │
  │ situation — you can switch any time.             │
  │                                                  │
  │ ┌─ Starter Plan ──────────────────── Pick → ┐    │
  │ │ Linear recommended order through the full │    │
  │ │ JS Drill curriculum. SR keeps it alive.   │    │
  │ └───────────────────────────────────────────┘    │
  │ ┌─ 4-Day Interview Cram ───────────── Pick → ┐    │
  │ │ Interview in 4 days. Day-by-day...        │    │
  │ └───────────────────────────────────────────┘    │
  │ ┌─ Eve Legal Interview Prep ────────── Pick → ┐    │
  │ │ 12 applied problems...                    │    │
  │ └───────────────────────────────────────────┘    │
  │ 🩺 Or start with a 43-question diagnostic →     │
  │ Browse on my own (no path)                      │
  └─────────────────────────────────────────────────┘

AFTER (welcome, Starter is clearly the default):

  ┌─ 👋 Welcome to JS Drill ─────────────────────────┐
  │ 166 lessons... Pick a plan that fits your        │
  │ situation — you can switch any time.             │
  │                                                  │
  │ ┏━ ⭐ RECOMMENDED — most users start here ━━━━┓  │  ← emerald border + tint
  │ ┃  Starter Plan                       Pick → ┃  │
  │ ┃  Linear recommended order through the full ┃  │
  │ ┃  JS Drill curriculum. SR keeps it alive.   ┃  │
  │ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
  │ ┌─ 4-Day Interview Cram ───────────── Pick → ┐  │
  │ │ Interview in 4 days...                    │  │
  │ └───────────────────────────────────────────┘  │
  │ ┌─ Eve Legal Interview Prep ────────── Pick → ┐  │
  │ │ 12 applied problems...                    │  │
  │ └───────────────────────────────────────────┘  │
  │ 🩺 Or start with a 43-question diagnostic →     │
  │ Browse on my own (no path)                      │
  └─────────────────────────────────────────────────┘
```

**Files touched:** `js/app/03-paths-cram.js` (one cards-loop template).

**Test:** `tools/cdp/refine-plan-picker.js` welcome-mode mobile + desktop — assert (a) the `data-path-id="starter"` card has a `[data-recommended]` element with non-empty text, and (b) the other two cards do NOT, and (c) in switch mode no card has the badge.

**Rubric projection:** 8/21 → 11/21 (Autopilot 1→2 = +1, Decisions 1→2 = +1, ADHD-fit 1→2 = +1).

## Step 5 — Contrarian verdict

**GREEN-LIGHT:** "Adds one visual default hint to an existing card without removing options, decisions, or affordances — directly serves the ADHD 'default actions matter more than option exhaustiveness' line (§ Cognitive style) and reduces the 5-choice compare-all friction on the mobile welcome surface."

## Step 7 — Implementation + verification

**Change shipped:** `js/app/03-paths-cram.js` `openPathModal()` cards loop — when `welcome===true` AND `p.id==='starter'`, prepend a `[data-recommended]` emerald pill ("⭐ Recommended — most users start here") inside the card AND apply an emerald border + subtle tint. Existing-user switch mode unchanged (the `● Current` badge still marks the active path).

**Validator:** `node tools/validate-data.js` → 803 passed, 0 failed.

**Probe:** `node tools/cdp/refine-plan-picker.js /tmp/jsdrill-refine-06-after` → 10/10 assertions pass:
- `[mobile welcome] starter card present`
- `[mobile welcome] starter has [data-recommended] badge`
- `[mobile welcome] badge text says "Recommended"`
- `[mobile welcome] non-starter "prep-4day" has NO [data-recommended] badge`
- `[mobile welcome] non-starter "eve-legal" has NO [data-recommended] badge`
- `[mobile switch] no card carries recommended badge (got 0)`
- 3× `[mobile] card "..." tag "..." stays inside modal`
- `[desktop] modal shows all 3 paths`

**Visual diff:**
- BEFORE `/tmp/jsdrill-refine-06/`: 3 equally-weighted cards on welcome — no default hint.
- AFTER `/tmp/jsdrill-refine-06-after/`: Starter Plan card carries the green RECOMMENDED pill + emerald border + tint; other 2 cards unchanged; switch mode unchanged (no badge anywhere).

**Rubric:** 8/21 → 11/21 (Autopilot 1→2 = +1, Decisions 1→2 = +1, ADHD-fit 1→2 = +1).

## Queued to backlog

- Per-card time-commitment badge: `~5 min/day · 166 lessons` chip below the blurb (PROFILE limited-study-time line).
- Diagnostic link re-copy: "Not sure? Take a 5-min diagnostic first" framing (currently generic "Or start with a 43-question diagnostic →").
- Stack welcome-mode card header on narrow mobile (similar to iter-5 today-plan fix) if tag clipping becomes severe for very long path names.

