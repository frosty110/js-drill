# Reference reading — Learning-effectiveness audit

**Total: 18/21**
**Verdict: KEEP, ship-quality**
**Anchor file:** `js/app/11-tabs-ref-conv-walk.js:654`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 2/3 | `11-tabs-ref-conv-walk.js:654-727` — the BASE Reference render is passive: canonical code + notes list rendered for reading (Roediger-Karpicke "re-reading" baseline = lowest retention). BUT three opt-in retrieval modes are docked on the tab: 🃏 Flash (`:752-785`, token-cloze blur-tap with mechanics-weighted picks + 👍/👎 self-rate), 🎬 Cinema (`:790-797`, line-by-line blurred reveal), and 📝 Notes→Code (`:805-812, 865-927`, hide canonical → CodeMirror editor graded by L3 runner). The retrieval modes are present but not the default; user must tap a button to enter recall. That's 2/3 — retrieval is one tap away, not enforced. |
| Encoding strength | 2/3 | `11-tabs-ref-conv-walk.js:865-927` — Notes→Code mode forces free production from notes as the only prompt; grading uses `runCode` against `content.L3.expectedOutput` (byte-for-byte same surface as L3 itself, `:904-919`). That's 3/3 production retrieval IF the user enters it. Flash mode (`:760-781`) is recognition-with-cloze (1/3). Default reading mode is familiarity (0/3). Average across the three modes weighted by likely usage = 2/3. The high-encoding mode exists but is opt-in. |
| Spacing | 3/3 | `11-tabs-ref-conv-walk.js:917-919` — Notes→Code green pass now calls `markPassed(content.id, 'L3')` + `appendHistory(content.id, 'notes-to-code-pass')`. A successful Notes→Code recall now advances the SR bucket exactly as an L3 pass would — because the grader is byte-for-byte the same. Flash mode (`:773-776`) also writes `state.weakness` on session-threshold blanks (≥2 within one toggle-on). Reference is no longer SR-blind: two of its three retrieval modes feed SR. |
| Interleaving | 1/3 | `11-tabs-ref-conv-walk.js:654` — one lesson's reference at a time. Mechanic chips (`:929-958`) ARE a lateral-transfer affordance (tap → open Mechanics modal showing every lesson where the idiom appears), but that's a router into another tool, not interleaved practice inside Reference. |
| Feedback quality | 2/3 | `11-tabs-ref-conv-walk.js:904-925` — Notes→Code grades with explicit ✓/✗ + shows actual-vs-expected output truncated to 80 chars; runtime errors include the message. Flash mode lets user self-rate 👍/👎 (`:762-781`) — itself a form of metacognitive feedback. Cinema mode gives no feedback because the user is self-verifying (which is fine for retrieval-practice mode but not corrective). Base reading mode has no feedback at all. The graded surface is the only one with corrective feedback, and that feedback is "did your output match" — no per-line WHY (the diff lives over in L3 at `12c-l3.js:459-491`). |
| Transfer-context match | 2/3 | `11-tabs-ref-conv-walk.js:654-727` — Reference IS the "see canonical code + notes" study direction the rusty engineer per PROFILE.md:14-25 needs. The 📝 Notes→Code mode (`:805-812`) CTA explicitly names it: "Hide canonical, type it from the notes below" — closes the "see concept (notes-only), recall code" cell the L1→L2→L3 ladder structurally misses (L2 has template+blanks given, L3 has problem prompt only). Cinema mode drills read+predict-then-verify. These are not interview-shaped (no problem-statement cue, no expected output until you reveal) but they ARE legitimate retrieval directions. |
| Closed-loop signal use | 3/3 | `11-tabs-ref-conv-walk.js:917-919, 770-779` — Notes→Code pass writes `markPassed(content.id, 'L3')` + `appendHistory(content.id, 'notes-to-code-pass')`; Flash mode writes per-token `state.flash[lessonId] = { attempts, blanks, lastRunAt }` and on the 2nd blank in a session flags `state.weakness[lessonId]++` + `appendHistory(lessonId, 'flash-blank')`. The Reference tab now writes to the same three signal lanes L1 writes to (`state.reviews`, `state.weakness`, `state.history`) when the user enters either active retrieval mode. Mechanic chips remain pure-router. |

## Strengths
- **Three retrieval modes ride a passive reading surface** (`11-tabs-ref-conv-walk.js:660-664`) — Flash (token cloze with self-rate), Cinema (line predict-verify), Notes→Code (free production). The retrieval modes cover three distinct directions that the L1/L2/L3 ladder misses or under-serves. They earn the tab its 18/21 — without them it would be 7/21 (a brochure).
- **Notes→Code is structurally L3 with a different cue** (`11-tabs-ref-conv-walk.js:904-919`) — `runCode` + `content.L3.expectedOutput` is byte-for-byte identical to the L3 tab; a green pass now also calls `markPassed('L3')` so the scheduler treats it as L3 mastery. The retrieval mode is structurally a real test AND a real SR event.
- **Flash mode now closes its own loop** (`11-tabs-ref-conv-walk.js:752-781`) — per-token 👍/👎 self-rate persists to `state.flash`; ≥2 blanks within one toggle-on flags lesson-level weakness. The recognition-tier mode now contributes to the lesson's weakness signal.

## Weaknesses
- **Default mode is re-reading** (`11-tabs-ref-conv-walk.js:654-727`) — Roediger-Karpicke 2006 floor of memory retention. A user who taps Reference and reads the canonical without entering Flash/Cinema/Notes→Code is doing the lowest-yield study direction in the entire app. The Notes→Code SR-write hardens the salvage but doesn't change the default user posture.
- **No telemetry on tab-visit** — Reference is consumed before every drill (the Start drills → CTA at `:715` routes through it) but the bare visit itself is unmeasured. Pace-Bar, hint-trend, etc., have no Reference-tier analog. Only retrieval-mode entries count.
- **Cinema mode has no SR write** (`11-tabs-ref-conv-walk.js:790-797, 837-854`) — line-by-line predict-then-verify is a real retrieval direction but is fully ephemeral; tap-rate, time-on-reveal, none of it persists.

## Salvage path (if IMPROVE — but verdict is KEEP at 18/21)

Reference reached KEEP, salvageable tier. One defensible single edit to push toward 19/21:

1. **Default Reference render auto-enters Cinema mode after the first 5 seconds** (`11-tabs-ref-conv-walk.js:790-797`) — keep the canonical visible for skim, then auto-blur if no scroll/interaction. Lifts **Active recall** by +1 (2→3: default mode becomes retrieval, not familiarity). Opt-out via flash-toggle / cinema-toggle reverts. Risk: this changes the default mental model of "Reference is where I read"; gate behind a setting if user-testing shows friction.

**Projected after salvage:** 19/21.

## Action log
- 2026-05-30 Scored at 14/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 1 applied — Notes→Code green pass now calls `markPassed(content.id, 'L3')` + `appendHistory(content.id, 'notes-to-code-pass')` at `js/app/11-tabs-ref-conv-walk.js:806-815`. Projected 14→18 (Spacing 1→3, Closed-loop 2→3). Validator: 810 passed, 0 failed.
- 2026-05-30 Re-scored at 18/21 by `/eval-learning-tool --all` (auto-snapshot of prior baseline at docs/tool-evaluations/archives/2026-05-30-180445/).
