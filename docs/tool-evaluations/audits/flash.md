# Flash mode (cloze blur-tap on canonical) — Learning-effectiveness audit

**Total: 7/21**
**Verdict: IMPROVE-or-cut**
**Anchor file:** `js/core/util.js:195`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 2/3 | `js/core/util.js:195-237` — 1-3 random alphanumeric tokens (≥3 chars, non-comment) are wrapped `.flash-blur` spans (line 220-225); user must mentally produce the token before tapping reveal (line 226-230). Genuine retrieval direction. Default behavior: tap = reveal (line 227); no production gate (typing) — so it's "covert recall + one-tap confirm" rather than enforced production. |
| Encoding strength | 1/3 | `js/core/util.js:226-227` — `reveal = () => span.classList.add('revealed')`. No typed input; no answer comparison. User self-grades whether their mental fill was right. That's cued recall (the surrounding code is the cue) but verification is unverified-by-system → familiarity-shaded recall. |
| Spacing | 0/3 | `grep state\.` in `js/core/util.js`: zero hits. `js/app/11-tabs-ref-conv-walk.js:676-682` flash-toggle handler reads no state, writes no state. No SR integration, no lastRunAt, no counter in `state` schema (`js/app/01-state-content.js`). |
| Interleaving | 0/3 | `js/app/11-tabs-ref-conv-walk.js:681` — `renderFlash(codeEl, ref.code)` — bound to the current lesson's `reference.code`. Single-lesson surface. No cross-lesson Flash stream. |
| Feedback quality | 0/3 | `js/core/util.js:226` — reveal is plain `classList.add('revealed')`. The user sees the answer; no "why this token vs the synonym you might have guessed" explanation. No miss/hit distinction — system doesn't know if user mentally got it right. 0/3. |
| Transfer-context match | 1/3 | `js/core/util.js:201-217` — token selection is by length + alphanumeric + non-comment, weighted random. Some hits will be load-bearing (e.g. method name `flatMap`), some will be unimportant (variable name `result`, parameter `i`). Cue is "code with random hole" — not interview-shaped, more like vocab cloze. The mobile-fit gesture (tap reveal) matches PROFILE.md phone-fit but the *cue* (code surrounded by code) is sentence-shaped cloze, not interview problem cue. |
| Closed-loop signal use | 0/3 | `js/app/11-tabs-ref-conv-walk.js:676-682` — flash-toggle calls `renderFlash` and does nothing else. No `saveProgress`, no counter, no `state.weakness` write. `js/core/util.js:226-230` reveal handler updates DOM only. Completely ephemeral. |

## Strengths
- Genuine recall direction novelty — `js/core/util.js:195-237` Flash is one of the few surfaces drilling the *read-and-recall-no-input* direction the L1/L2/L3 ladder doesn't cover. Per CLAUDE.md "iter 35" note this is what motivated the feature.
- Mobile-fit gesture — tap-to-reveal (`js/core/util.js:227`) matches PROFILE.md "L1/L2 are the high-throughput mobile surfaces". Flash is one-tap-per-token.
- Lightweight implementation — `~40 LOC` (`js/core/util.js:195-237`) for a real retrieval surface.

## Weaknesses
- Random token selection — `js/core/util.js:205-216` picks by length + alphanumeric + non-comment. No targeting of load-bearing tokens (method names, gotcha keywords, idiom-signaling identifiers). User may be drilling `result` and `i` half the time.
- Zero closed-loop. `js/app/11-tabs-ref-conv-walk.js:676-682` + `js/core/util.js:226` — no signal. The user reveals a token and the system has no idea whether they got it right, and no record they ran Flash at all. Categorically worse than `notesDrill` (`js/app/01-state-content.js:224`) which DOES persist counters for an analogous cloze surface.
- No spacing/interleaving — single-lesson, per-render randomization. Drilling Flash on the same lesson 3x in a row → 3 different random token sets, but the *same lesson* — pure massed practice.

## Salvage path (if IMPROVE)
Ordered by leverage. Each edit names file:line + dim it lifts.
1. **Token weighting on `mechanics`** — `js/core/util.js:205-216` prefer tokens that match the lesson's `mechanics` list (idiom keywords like `flatMap`, `reduce`, `WeakMap`) over generic identifiers. Lesson `mechanics` already exists in content schema; pass it into `renderFlash`. Lifts Transfer-context match +1.
2. **Persist a hit/miss self-rate** — `js/core/util.js:226-230` after reveal show a 2-button "knew it / blanked" chip; write to `state.flash.{lessonId} = { attempts, blanks, lastRunAt }` and flag `state.weakness[lessonId]` on 2+ blanks per session. Lifts Closed-loop +2, Feedback +1.
3. **Schedule Flash via SR** — on session start, surface Flash on lessons in `state.reviews` with `dueAt <= now` (like the existing 3-Card Warmup pattern). Lifts Spacing +1.
4. **Cross-lesson Flash stream sidebar entry** — analogous to Rapid-Fire L1, mix 10 tokens across 10 random lessons. Lifts Interleaving +2.

**Projected after salvage:** 14/21 — KEEP, salvageable tier. The 4-pt+ minimum is hit by edits 2+4 alone.

## Removal path (if REMOVE)
Not warranted at 7/21 *if salvage is attempted* — but edit-1 alone won't lift it past 10. If salvage is skipped: `js/core/util.js:195-237` is removable (40 LOC), and the only callsite is `js/app/11-tabs-ref-conv-walk.js:681`. Remove the 🃏 Flash button (`js/app/11-tabs-ref-conv-walk.js:592`), the toggle handler (lines 676-682), and the restore call paths (lines 664-669, 689, 704). No user state to migrate — Flash never persisted any. CSS class `.flash-blur` in `app.css` can be removed. Confirmation: deleting this does NOT reduce a measurable learning outcome — `notesDrill` (`js/app/01-state-content.js:224`) covers the cloze-recall direction with proper signal use. Flash is a strictly-weaker cousin without closed loop.

## Action log
- 2026-05-30 Scored at 7/21 by `/eval-learning-tool --all`.
