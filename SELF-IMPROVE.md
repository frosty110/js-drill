# Self-Improve Directive

> Read alongside [PROFILE.md](PROFILE.md). Every change must trace back to
> making that user more effective. This file evolves — the loop updates the
> Current focus, Hypotheses, and Avoid sections after each iteration.

## Current focus (this iteration)
- **Primary lens:** *Audit the iteration-log + parking-lot for what
  the loop hasn't picked up.* Iter 9 validated the "stress survey"
  approach (drive the app under realistic-but-unhappy state) and
  shipped two findings as one improvement. That same survey
  technique should now be run more deliberately against the
  iteration history — the parking lot has entries that have aged
  out (e.g., the "76 lessons" welcome banner — flagged since
  iter 1, still not done; the `bucket promotion gate` from iter
  3; the `recall-without-prompt` candidate; the sidebar starter-
  path ordering). What's still there because it's actually
  high-leverage, vs. what's there because nobody picked it up?
- **Hypothesis to test:** Doing one parking-lot sweep — categorize
  each item as (ship-now, deprioritize, or already-done-implicitly)
  — sharpens the loop's queue and forces the next iteration to
  pick from a curated list, not a stale FIFO. Then pick the top
  ship-now item and ship it. The discipline is to AVOID adding
  new items this iteration (read-only on the diagnostic side);
  net entries should DECREASE.
- **Out of scope this iteration:** further content authoring, Mock
  Interview mode, taxonomy changes, L1→L2→L3 core structure,
  further SR-gradient tuning, adding new parking-lot items.

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
- Mobile responsiveness must not regress — invoke the `browser-test` skill
  (or copy `tools/cdp/template.js`) to drive a headless Chrome at iPhone
  viewport + coarse pointer when touching UI. The shared lib at
  `tools/cdp/lib.js` bootstraps server + Chrome and keeps scenario scripts
  short.

## Iteration log (newest first, keep last 10)

### 2026-05-23 — iter 9 — Weak-spot visibility (button count + plan ordering)
Stress-surveyed under realistic-but-unhappy state (40 mastered, 15
overdue reviews, 5 reveals, 3 weakness misses). Two findings, both
about weak-spot legibility: (1) the `⚠️ Weak` sidebar button had no
count while `🕒 Review (15)` did — inconsistent affordance; (2) the
`dailyPlan` added the path BEFORE the weak entry, so a lesson that's
both weak and on-path got labeled `next on path` instead of the more
actionable `weak spot`. Fixed both: added a count span (parallel to
review-btn); reordered dailyPlan so weak precedes path so dedup
promotes the weak label. Validator 336/0; new probe
`weak-spot-visibility.js` confirms 3 scenarios (count, hidden, weak-on-
path labeling). **Learning:** stress-surveying under a seeded
unhappy-path state surfaces UX inconsistencies that happy-path probes
miss — worth keeping in the technique toolbox.

### 2026-05-23 — iter 8 — 2nd L2 for 3 syntax + 1 applied; template generalizes
Audited under-built syntax lessons — only 3 were under-built
(s-template, s-iter-custom, s-async-iter), so hit all three plus
a-debounce as an applied data point. Validated that the iter 7
template generalizes to non-pattern lessons with track-specific
adaptations: syntax = "different *use* of the feature" rather than
different input data; applied = blank closure surfaces (args capture,
state reset, spread) that the canonical leaves untouched in #1.
Validator 336/0 (+4); density 97 → 93. **Syntax track is now fully
built** at ≥2 L2 (44/44 lessons). Remaining backlog: 74 pattern + 19
applied. **Learning:** three iterations grinding the same backlog
thread is enough — the template is validated, the user can pace the
remaining 93 lessons themselves. Iter 9 should re-survey for
something the loop is uniquely positioned to find.

### 2026-05-23 — iter 7 — Author 2nd L2 exercise for 5 pattern lessons
Audited `two-sum`, `valid-palindrome`, `valid-parentheses`,
`p-contains-dup`, `best-time-stock` and derived an authoring template:
exercise #2 uses **different input** (so memorized output doesn't
transfer) and **blanks different load-bearing tokens** than #1 (loop
bounds, iteration keywords, early-return values, comparators — not the
data-structure/method names that #1 already covered). Two recall reps
per lesson with different cuing surfaces, reinforcing distinct bits of
the same canonical. Validator 332/0 (+5 from the new exercises);
density warning dropped 102 → 97. Authoring template now documented in
active-recall.md so iter 8+ can apply it without re-deriving.
**Learning:** the template generalized cleanly across all 5 pattern
lessons sampled — the "varied retrieval" framing maps directly to
"blank a different subset of the canonical." Iter 8 needs to validate
on syntax lessons (different shape than pattern lessons).

### 2026-05-23 — iter 6 — Validator warns on L2/L1 density floor
The iter 5 survey found 102/143 lessons (71%) below the PROFILE.md L2
density floor (≥2 exercises), but no surface flagged it — the gap was
silently drifting. Extended `tools/validate-data.js` to compute density
per lesson during its existing read pass and print a warning section
after the pass/fail summary; added `--strict-density` flag to flip it
into a hard failure for future CI / pre-commit once the backlog is
cleared. Default behavior unchanged (exit 0 on warnings) so the loop
keeps moving while the structural enforcement is now in place. Touched
`active-recall.md` to document the "density floor supports varied
recall reps" rationale. Validator default exit 0, --strict-density exit
1 — both verified. **Learning:** the structural-warning move is much
cheaper than mass-authoring and creates the right kind of pressure —
contributors see the count every time they run the validator.

### 2026-05-23 — iter 5 — Starter Path step pill + non-SR re-survey
Stepped out of the SR rabbit hole. Cold-surveyed via the browser-test
skill at mobile viewport (9 screenshots) and ran an L1/L2 density audit
across all 143 full lessons. Big finding: **102 lessons (71%) have only
1 L2 exercise** vs. PROFILE.md's ≥2 floor — that's iter 6's lens.
Smaller finding suitable for iter 5: when starter-path mode is on,
the sidebar shows path step numbers per-lesson but they group by
section, so adjacent lessons can show e.g. "22, 20, 21" — confusing
non-sequential ordering. Added a "🧭 Step N of M" pill to the lesson
header that gives the user a stable orientation anchor in the main
viewport (visible on every render, not buried in sidebar). Same
"make-invisible-state-visible" lever the iter 4 SR-feedback line
exploits. Validator 327/0; new probe `tools/cdp/starter-path-step-
pill.js` covers 4 scenarios (off, on, toggle-off, toggle-on) — 7/7.
Iter 2 + iter 3 probes regression-clean. **Learning:** stepping back
to re-survey surfaced a structural content-quality gap (L2 density)
that 4 mechanism-tuning iterations had missed. The lens swap was the
win, not the pill itself.

### 2026-05-23 — iter 4 — Surface SR state in pass/reveal feedback
Added `srBadgeHtml(lessonId, kind)` and wired it into all six pass/reveal
surfaces (desktop+mobile L2 pass, L3 pass, desktop+mobile L2 reveal, L3
reveal). `markRevealed` now returns `{ demoted }` so reveal handlers can
emit "Interval shortened — next review in Nd." only when the SR actually
moved. Also fixed an off-by-one in `formatDueRelative` (floored 0.999d
to "23h" right after `scheduleReview` set dueAt to exactly +1d) by
switching to `Math.round` for the bucket display. Validator 327/0;
extended both regression probes — iter 2 now 7/7 asserts "Next review in
1d", iter 3 now 8/8 asserts demote feedback only when due. **Learning:**
4 iterations in a row pulled on the same thread (SR mechanics →
surfacing). The loop is at risk of over-investing in one principle.
Iter 5 should re-survey rather than dig deeper here.

### 2026-05-23 — iter 3 — Reveal demotes the SR bucket on due lessons
Picked Reveal as the failure signal because it's the cleanest "I can't
recall this" event the app already tracks (state.revealed) and goes
through a centralized `markRevealed` — no new event handlers, no
guessing what counts as "tried hard enough." Added `demoteReview(id)` (1
bucket down, floored at 0); `markRevealed` calls it when the lesson is
due. L3 reveal confirm dialog updated to mention the consequence when
due — transparency. L2 reveal stays silent: it already has the
mastery-dot soft-penalty, and adding a per-exercise confirm would create
friction. Validator 327/0; new probe `tools/cdp/sr-reveal-demotes-bucket.js`
covers 3 scenarios (due-demotes, not-due-no-op, floor) — 6/6 asserts;
iter 2 probe still 6/6. **Learning:** the SR system is now mechanically
right but completely invisible to the user. None of L2-holds /
L3-advances / Reveal-demotes shows up in the UI as feedback. That's iter
4's lens.

### 2026-05-23 — iter 2 — L2 holds the SR bucket on due lessons
`scheduleReview` now accepts `{ advance }`; `markPassed` calls it with
`advance: false` when L2 passes on a due lesson, holding the interval
bucket but resetting `dueAt` by the current interval. L3 still advances.
This closes the loop iter 1 opened: mobile users can drill due reviews on
L2 and have them actually leave the due list, but the 1d → 30d ladder is
still gated on L3 — so they can't inflate intervals from a phone without
proving free recall. Embodied **desirable difficulty** at the SR layer
(grading the win by test rigor) and updated spaced-repetition.md +
desirable-difficulty.md to match. Validator 327/0; new durable probe at
`tools/cdp/sr-l2-holds-bucket.js` confirms: interval held at 1d, dueAt
+1d, review badge clears. **Learning:** the natural next question
surfaced cleanly — the loss-side is still no-op. A failed L2/L3 on a due
review should pull the interval *shorter*, not just leave it. That's
iter 3.

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

- **"Recall-without-prompt" mode** — show only the lesson title and ask the
  user to produce the canonical. Strips prompt scaffolding. Mentioned in
  active-recall.md candidates.
- **Welcome banner says "76 lessons"** but the app now ships 143. Tiny
  copy-fix candidate; rolled past again in iter 5. Cheap enough that it
  can ride along with any iteration that touches the welcome surface.
- **L1/L2 density audit data** (iter 5 finding): 0/143 lessons under-built
  on L1 (good); 102/143 lessons have only 1 L2 exercise. Iter 6 lens.
- **Bucket promotion gate.** Today L3 advances by 1 bucket no matter how
  long the user took. If an L3 takes 5x the personal-best time, maybe the
  bucket holds instead of advances. Same desirable-difficulty gradient but
  applied to the win-side rigor signal.
- **L3 timeout-as-failure.** Reveal is the only loss-side trigger today; a
  silent abandonment (open due L3, walk away, never pass) keeps the
  interval. A threshold (no pass within N minutes of opening a due L3)
  could broaden the loss-side. Needs care so legitimate context switches
  don't fire it. Captured in desirable-difficulty.md candidates.
- **Sidebar starter-path ordering.** When path mode is on, the sidebar
  groups lessons by section (so adjacent path numbers can be 22, 20, 21).
  The iter 5 step pill makes orientation OK in the main view but the
  sidebar itself is still confusing in path mode. Could either (a) sort
  by path index in path mode, or (b) ignore — the pill might be enough.

## Avoid (learned dead-ends)

*(none yet — populate as iterations rule things out)*
