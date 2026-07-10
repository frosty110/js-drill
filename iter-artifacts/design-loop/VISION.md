# Vision — North Star (immutable once ratified)

## The app in one sentence
A **world-class, mobile-first memory gym** where a rusty engineer opens the app
and is instantly, effortlessly drilling the *right* rep — syntax, patterns, or
system design — with a surface so calm and intentional it feels like the
best-crafted apps they use every day.

## The bar
5-star. The caliber of **Linear, Things, Oura, Duolingo** — not in imitation,
but in *craft*: restraint, hierarchy, motion with meaning, zero clutter, every
pixel intentional. If a senior product designer wouldn't call a screen
world-class, it isn't done.

## What "great" feels like here
- **Open → drilling in one tap.** No menu gauntlet, no "what should I do?" The
  app already decided; the user can override, but rarely needs to.
- **Calm, not busy.** One clear focus per screen. The ~60 modes are *available*
  but never *shouting*. Progressive disclosure everywhere.
- **Ambient progress.** Streak, today's delta, readiness — felt without
  navigating to find them.
- **Delight that rewards the rep** — a satisfying grade animation, a streak tick
  — never gamification noise that obscures real readiness.
- **Thumb-first.** Primary actions live where a thumb rests on a 6" phone.

## The transformation (from → to)
| From (today) | To (vision) |
|---|---|
| Topbar of 4 dropdowns + ~60 scattered mode buttons | A small, thumb-first nav model + one contextual practice launcher + command palette for the long tail |
| Settings smeared across standalone buttons | One grouped Settings surface |
| Dashboard / Stats / Streak / At-Risk / Resurrect as separate places | One coherent Progress surface |
| Per-page hand-rolled CSS, ~21 hardcoded colors, duplicated components | One design system: `tokens.css` + `components.css`, used by all pages |
| "Here are all your options" | "Here's your next rep" |

## Design language (hold the line)
- **Restraint over decoration.** Whitespace, hierarchy, and typography do the work. One accent, used with intent.
- **Motion communicates** — 150–250ms, spring easing, purposeful (state change, spatial continuity), and it honors `prefers-reduced-motion`. Never decorative.
- **Consistency is non-negotiable** — every button, card, option, sheet comes from `components.css`. Nothing bespoke per screen.
- **Every state is designed** — empty, loading, error, first-run, offline. No browser defaults.
- **Content-first** — the code, the question, the diagram are the hero; chrome recedes.
- **Accessible by construction** — 44px targets, focus order, contrast, reduced motion, semantic structure.

## Non-negotiable constraints (design freely inside these)
- **No build step.** Vanilla JS + CDN + `data/`-driven. `tokens.css`/`components.css` are the single style sources. `js/storage.js` is the storage layer (schema changes → `__v` bump + migration; never lose progress).
- **Preserve capability, not layout.** Every capability the user relies on stays reachable via the new IA + `#/m/<mode>` routes + the palette. Redundant entry points may merge; dead modes may retire (logged in `DECISIONS.md`).
- **`PROFILE.md` is law.** Every decision serves the Rusty Returner on a phone.

## Definition of done (the loop may stop)
All roadmap phases shipped · `refine-rubric` materially up on all 7 dimensions vs the P0 baseline · every capability preserved · all pages on one design system · a first-time *and* a returning user each have an obviously 5-star path · validators green · no regressions · the `shots/` changelog shows the transformation. When no remaining slice raises the bar, **declare done** — don't manufacture busywork.
