# Self-Improve Directive

> Read alongside [PROFILE.md](PROFILE.md). Every change must trace back to
> making that user more effective. This file evolves — the loop updates the
> Current focus, Hypotheses, and Avoid sections after each iteration.

## Current focus (this iteration)
- **Primary lens:** *Make the spaced-repetition loop actually work for the
  80%-mobile user.* Iteration 1 routed the 🕒 Review CTA to L2 on touch
  devices so mobile users can *attempt* their due reviews without bouncing
  on a phone-keyboard L3 editor. But L2 doesn't advance the SR interval —
  only L3 does. So mobile users now have a usable review surface that
  doesn't actually unstick their due list. The interval ladder is desk-only
  by accident.
- **Hypothesis to test:** Making L2 pass on a due lesson advance the SR
  interval (perhaps with a smaller step than L3 — e.g., advance one bucket
  instead of two, or cap at a max interval lower than L3's 30d cap) closes
  the loop for mobile users without throwing out the difficulty signal that
  L3 provides. The Anki-style "review grade" (1-4 confidence) parking-lot
  item is a more ambitious version of the same idea.
- **Out of scope this iteration:** Mock Interview mode (desktop-only by
  design — PROFILE.md), adding new lessons, redesigning the three-track
  taxonomy, changing the L1→L2→L3 *core* structure. New strategy docs are in
  scope only if the iteration's feature embodies one not yet documented.

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
  `tools/cdp/mobile-l3.js` when touching UI. (Note: the shared probe currently
  fails on Chrome 148 because it uses `127.0.0.1` while Chrome restricts
  devtools to `localhost`. Either patch the probe or write an inline one —
  see iteration 1 log.)

## Iteration log (newest first, keep last 10)

### 2026-05-23 — iter 1 — Device-calibrated Review CTA
Cold-surveyed the entry flow. Top friction for an 80%-mobile rusty engineer
was that the 🕒 Review button — the primary spaced-repetition CTA — forced
L3 regardless of device, dropping phone users into a blank CodeMirror editor
on a phone keyboard (direct PROFILE.md violation). Changed the click handler
to route to L2 on `(pointer: coarse)` devices, L3 otherwise — one ternary,
no schema change. Embodied **desirable difficulty**: keep the recall demand
high, strip the mechanical friction that doesn't load cognitive effort.
Created `docs/learning-strategies/desirable-difficulty.md`, cross-referenced
from active-recall. Validator 327/0; inline mobile CDP probe confirmed
landing on L2 with coarse pointer emulated. **Learning:** the diagnosis
quickly surfaced a second, deeper issue — L2 doesn't advance SR — which the
fix doesn't close. That's iteration 2's lens.

## Hypotheses parking lot

- **L2 should advance SR on due lessons** (iteration 2 candidate — see Current
  focus). Today only L3 advances. Touch users now have a usable Review CTA
  but no interval reward. Cap the L2-advanced step shorter than L3's to
  preserve a difficulty gradient.
- **"Recall-without-prompt" mode** — show only the lesson title and ask the
  user to produce the canonical. Strips prompt scaffolding. Mentioned in
  active-recall.md candidates.
- **Failure pulls the interval shorter** — today SR is monotonic; a missed
  L2/L3 on a due lesson should reschedule it sooner, not just leave the
  interval where it was. Closer to true Anki/SM-2 semantics.
- **Welcome banner says "76 lessons"** but the app now ships 143. Tiny
  copy-fix candidate; not urgent enough to bump higher-leverage work.
- **`tools/cdp/mobile-l3.js` is broken on Chrome 148** — it uses `127.0.0.1`
  but Chrome 148 only exposes devtools on `localhost`. Tooling tax for every
  future UI iteration. Patch when convenient.
- **Lesson L1/L2 density audit** — PROFILE.md says ≥3 L1 + ≥2 L2 per lesson.
  No data on current distribution. Could be a future content-quality lens.

## Avoid (learned dead-ends)

*(none yet — populate as iterations rule things out)*
