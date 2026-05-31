# Flash mode (cloze blur-tap on canonical) — Learning-effectiveness audit

**Total: 11/21**
**Verdict: IMPROVE-or-cut**
**Anchor file:** `js/core/util.js:205`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 2/3 | `js/core/util.js:254-263` — 1-3 candidate tokens are wrapped `.flash-blur` spans; user must mentally produce the token before tapping reveal (`:265-289`). Default behavior: tap = reveal (`:266`); no production gate (typing). Still "covert recall + one-tap confirm" rather than enforced production, so unchanged from prior at 2/3. |
| Encoding strength | 1/3 | `js/core/util.js:265-289` — reveal is plain `classList.add('revealed')` + an optional 👍/👎 self-rate chip pair. No typed input; user self-grades. Recognition-shaded covert recall remains 1/3 — the chip captures the user's intent but does not gate retrieval. |
| Spacing | 0/3 | `js/app/04-progress-sr.js:153` loads `state.flash`, `:406` persists it. But `lastRunAt` is recorded for diagnostic purposes only; nothing in `js/app/11-tabs-ref-conv-walk.js:752-785` consults `state.reviews` to schedule Flash, and there is no SR-overdue surfacing of Flash on session start. Per-tool counter exists; SR scheduling does not. |
| Interleaving | 0/3 | `js/app/11-tabs-ref-conv-walk.js:760` — `renderFlash(codeEl, ref.code, …)` — bound to the current lesson's `reference.code`. Single-lesson surface. No cross-lesson Flash stream. |
| Feedback quality | 1/3 | `js/core/util.js:267-283` — on reveal a 👍/👎 chip pair appears. The chip captures self-grade but does not surface a per-token explanation ("you blanked `flatMap` because it returns a 2-arg callback whose result is flattened …"). The reveal IS the answer; no "why this token vs the synonym you might have guessed" prose. Lifts to 1 from prior 0 because the system now distinguishes hit-vs-miss intent. |
| Transfer-context match | 2/3 | `js/core/util.js:222-247` — when `opts.mechanics` is provided, candidate tokens whose `.text` matches a mechanic id/label rank first (matched bucket shuffled, then others). The Reference-tab call site (`js/app/11-tabs-ref-conv-walk.js:761`) passes `content.mechanics`. So a lesson with `mechanics: ['flatMap']` blurs `flatMap` preferentially over generic identifiers like `result` or `i` — token targeting now aligns with the load-bearing idiom. Cue still surrounded by code (sentence-shaped cloze, not interview-blank-editor cue), so still capped at 2/3. |
| Closed-loop signal use | 2/3 | `js/app/11-tabs-ref-conv-walk.js:762-781` — the `onRate` callback writes `state.flash[lessonId] = { attempts, blanks, lastRunAt }` on every tap. On the SECOND blank within a single Flash session, the handler bumps `state.weakness[lessonId]` and `appendHistory(... 'flash-blank')` (`:773-776`). Schema-additive `state.flash` loaded at `js/app/04-progress-sr.js:153` and persisted at `:406`. Wins (👍) increment `attempts` but don't strengthen SR — so misses do feed the autopilot but wins don't. 2/3 (was 0/3). |

## Strengths
- Mechanics-weighted token selection (`js/core/util.js:222-247`) is genuinely new — the cloze now blurs the lesson's load-bearing idiom (e.g. `flatMap`, `WeakMap`) preferentially over filler identifiers, so the user drills what gave the lesson its identity rather than `result`/`i`.
- Per-token self-rate chip persists to `state.flash[lessonId]` (`js/app/11-tabs-ref-conv-walk.js:762-781`) + flags `state.weakness` on the 2nd blank of a session (`:773-776`). First closed loop the surface has ever had — the autopilot now knows when Flash fired and how often the user blanked.
- Mobile-fit gesture preserved — tap-to-reveal (`js/core/util.js:285`) and the chip pair sit inline next to the revealed token, no menu, no modal.

## Weaknesses
- Encoding ceiling is structural at 1/3 — self-graded reveal can't catch users who guessed wrong but said "I knew it." Lifting Encoding past 1 requires a typed-input variant, which isn't built.
- No SR scheduling (`js/app/11-tabs-ref-conv-walk.js:752-785`) — Flash never resurfaces on its own; it's always user-initiated from the Reference tab. `state.flash.lastRunAt` is recorded but never read for session-start surfacing.
- No cross-lesson Flash stream — single-lesson per render. Three Flash runs on the same lesson = three different token sets but pure massed practice on that lesson.
- Wins-don't-strengthen-SR — `state.flash[id].attempts` increments on 👍, but no `scheduleReview` call. Compare Predict (`js/app/07-drills-swap-speedrun.js:463-465`) which fires `scheduleReview(id, { advance: false })` on win when due+mastered.

## Salvage path (if IMPROVE)
Ordered by leverage. Each edit names file:line + dim it lifts.
1. **Schedule Flash on session start via SR** — surface a Flash chip on lessons in `state.reviews` with `dueAt <= now` (like the existing 3-Card Warmup pattern in `js/app/06-drills-warmup-card.js`). Lifts Spacing by +1.
2. **Cross-lesson Flash stream sidebar entry** — analogous to Rapid-Fire L1; mix 10 tokens across 10 random lessons in one session. New entry point + new build/render path. Lifts Interleaving by +2.
3. **Per-token "why" tooltip from `reference.notes`** — `js/core/util.js:265-289` — when reveal fires, if the blurred token also appears in any `reference.notes[]` string, surface the matching note line under the chip pair. Lifts Feedback by +1.

**Projected after salvage:** 15/21 — KEEP, salvageable tier. Edits 1+2 alone lift 11→14.

## Removal path (if REMOVE)
Not warranted at 11/21 — the surface now feeds the autopilot. If REMOVE were ever attempted: `js/core/util.js:205-295` is removable (~90 LOC), only callsite is `js/app/11-tabs-ref-conv-walk.js:760`. Remove the 🃏 Flash button (`:730`), the toggle handler (lines 752-785), and the restore call paths. Migrate `state.flash` by dropping the field (no other reader). CSS classes `.flash-blur`, `.flash-rate-chips`, `.flash-rate` removable. Confirmation: deleting this WOULD now reduce a measurable learning outcome — `state.flash` blanks are the only signal capturing the read-and-recall-no-input recall direction. Keep.

## Action log
- 2026-05-30 Scored at 7/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edits 1+2 applied per user Phase 0 decision. (1) Mechanics-weighted token selection in `js/core/util.js:195-298` — `renderFlash` now accepts `opts.mechanics`; candidate tokens matching a mechanic id/label rank first, others fall back to uniform shuffle. (2) Per-token self-rate via `opts.onRate` callback; on reveal, a 👍/👎 chip pair appears next to the revealed token; user tap fires `onRate('knew' | 'blanked')`. Reference tab call site at `js/app/11-tabs-ref-conv-walk.js:725-768` wires both: passes `content.mechanics`, persists `state.flash[lessonId] = { attempts, blanks, lastRunAt }` on every rate; session-local blank counter flags `state.weakness[lessonId]` once on the 2nd blank. Schema-additive `state.flash = {}` in slice 01 + loader/saver in slice 04. Chip styles in `css/01-base.css:144-167`. Projected 7→11 (Transfer 1→2, Closed-loop 0→2, Feedback 0→1). SR-scheduled surfacing (+1 Spacing) and cross-lesson Flash stream (+2 Interleaving) deferred — bigger surface additions. Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 11/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
