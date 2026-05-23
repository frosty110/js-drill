# Self-Improve Directive

> Read alongside [PROFILE.md](PROFILE.md). Every change must trace back to
> making that user more effective. This file evolves — the loop updates the
> Current focus, Hypotheses, and Avoid sections after each iteration.

## Current focus (this iteration)
- **Primary lens:** *Cold survey.* This is the first iteration. Diagnose the
  app from the perspective of a rusty engineer opening it for a 20-minute drill
  session. Identify the top 3 friction points between "open app" and "productive
  drilling." Pick the single highest-leverage one to fix this iteration.
- **Hypothesis to test:** TBD — set after the survey.
- **Out of scope this iteration:** adding new lessons (143 is sufficient for
  now), redesigning the three-track taxonomy, changing the L1→L2→L3 core loop
  structure.

## Constraints (stable across iterations)
- **Phone-first.** ~80% of usage is mobile (see PROFILE.md). Improvements that
  only help desktop are lower priority unless they enable something the mobile
  user benefits from indirectly. Touch targets, tap-based interactions, and
  L1/L2 surface area are the high-leverage zones.
- **L1/L2 density matters.** When auditing lessons, flag any with fewer than
  3 L1 questions or 2 L2 exercises — the mobile drill loop runs out of fuel
  too quickly otherwise.
- **Strategy-doc reciprocity.** When building a memorization tool or feature,
  also add or update the relevant doc in `docs/learning-strategies/` explaining
  the learning-science principle it embodies. If the strategy isn't documented
  yet, document it. The app and the strategy docs evolve together.
- No build step. No new deps. Vanilla JS + Tailwind / CodeMirror via CDN only.
- `node tools/validate-data.js` must show **0 failures** after every change.
- Atomic commits — one improvement per commit, clear message.
- Don't edit lesson content unless the directive explicitly makes lessons the
  focus this iteration.
- Preserve backwards-compatible `localStorage` schema (`jsdrill.progress.v1`).
- Mobile responsiveness must not regress — verify with
  `tools/cdp/mobile-l3.js` when touching UI.

## Iteration log (newest first, keep last 10)
*empty — first run pending*

## Hypotheses parking lot
*empty — populate during the cold survey*

## Avoid (learned dead-ends)
*empty — populate as we learn what doesn't move the needle*
