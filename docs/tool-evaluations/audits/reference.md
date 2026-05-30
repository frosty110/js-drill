# Reference reading — Learning-effectiveness audit

**Total: 14/21**
**Verdict: KEEP, salvageable**
**Anchor file:** `js/app/11-tabs-ref-conv-walk.js:585`
**Scored:** 2026-05-30

## Score

| Dim | Score | Evidence (file:line) |
|---|---|---|
| Active recall | 2/3 | `11-tabs-ref-conv-walk.js:585-657` — the BASE Reference render is passive: canonical code + notes list rendered for reading (Roediger-Karpicke "re-reading" baseline = lowest retention). BUT three opt-in retrieval modes are docked on the tab: 🃏 Flash (`11-...js:676-683`, token-cloze blur-tap), 🎬 Cinema (`11-...js:688-695`, line-by-line blurred reveal), and 📝 Notes→Code (`11-...js:703-710, 763-816`, hide canonical → CodeMirror editor graded by L3 runner). The retrieval modes are present but not the default; user must tap a button to enter recall. That's 2/3 — retrieval is one tap away, not enforced. |
| Encoding strength | 2/3 | `11-...js:763-816` — Notes→Code mode forces free production from notes as the only prompt; grading uses `runCode` against `content.L3.expectedOutput` (byte-for-byte same surface as L3 itself, `11-...js:802-807`). That's 3/3 production retrieval IF the user enters it. Flash mode (`11-...js:681`) is recognition-with-cloze (1/3). Default reading mode is familiarity (0/3). Average across the three modes weighted by likely usage = 2/3. The high-encoding mode exists but is opt-in. |
| Spacing | 1/3 | `11-...js:585-725` — no path from the base Reference render writes to `state.reviews` or appends history. Notes→Code (`11-...js:793-815`) grades but does NOT call `markPassed('L3')` — a successful Notes→Code recall is invisible to the SR scheduler. Mechanic chips (`11-...js:842-847`) and the Start Drills CTA (`11-...js:713-715`) bridge to other tools that DO feed SR, but Reference's own surfaces are SR-blind. The base tab is just where the user happens to reveal a flag indirectly via `markRevealed` from elsewhere. Earns 1/3 because related state (revealed flags, mechanics coverage) is queried for the chip render, not 0/3 nothing. |
| Interleaving | 1/3 | `11-...js:585` — one lesson's reference at a time. Mechanic chips (`11-...js:842-847`) ARE a lateral-transfer affordance (tap → open Mechanics modal showing every lesson where the idiom appears), but that's a router into another tool, not interleaved practice inside Reference. |
| Feedback quality | 2/3 | `11-...js:802-815` — Notes→Code grades with explicit ✓/✗ + shows actual-vs-expected output truncated to 80 chars; runtime errors include the message. Cinema/Flash mode give no feedback because the user is self-verifying (which is fine for retrieval-practice mode but not corrective). Base reading mode has no feedback at all. The graded surface is the only one with feedback, and that feedback is "did your output match" — no per-line WHY (the diff lives over in L3 at `12c-l3.js:459-491`). |
| Transfer-context match | 2/3 | `11-...js:585-657` — Reference IS the "see canonical code + notes" study direction the rusty engineer per PROFILE.md:14-25 needs. The 📝 Notes→Code mode (`11-...js:763-816`) CTA explicitly names it: "Hide canonical, type it from the notes below" — closes the "see concept (notes-only), recall code" cell the L1→L2→L3 ladder structurally misses (L2 has template+blanks given, L3 has problem prompt only). Cinema mode drills read+predict-then-verify. These are not interview-shaped (no problem-statement cue, no expected output until you reveal) but they ARE legitimate retrieval directions. |
| Closed-loop signal use | 2/3 | `11-...js:763-816` — Notes→Code grades but does not write `state.weakness` on miss or `markPassed` on win. `11-...js:842-847` Mechanic chip clicks open the Mechanics modal — pure navigation, no signal write. The Reference tab does query `content.mechanics` (input) but rarely writes signals (output). Tab-visit itself isn't tracked. The base "I read this" act is invisible to every downstream surface. 1/3 default + opt-in mode that grades but doesn't persist = 2/3. |

## Strengths
- **Three retrieval modes ride a passive reading surface** (`11-...js:676-710`) — Flash (token cloze), Cinema (line predict-verify), Notes→Code (free production). The retrieval modes cover three distinct directions that the L1/L2/L3 ladder misses or under-serves. They earn the tab its 14/21 — without them it would be 7/21 (a brochure).
- **Notes→Code reuses L3's grader** (`11-...js:802-807`) — `runCode` + `content.L3.expectedOutput` is byte-for-byte identical to the L3 tab. The retrieval mode is structurally a real test, not a UI fake.
- **Mechanic chips are the only lateral-transfer affordance in the lesson view** (`11-...js:835-848`) — tap an idiom → see every lesson where it appears across tracks. Closes a gap the per-lesson recall loop can't.

## Weaknesses
- **Default mode is re-reading** (`11-...js:585-657`) — Roediger-Karpicke 2006 floor of memory retention. A user who taps Reference and reads the canonical without entering Flash/Cinema/Notes→Code is doing the lowest-yield study direction in the entire app.
- **Retrieval modes are SR-invisible** (`11-...js:763-816`) — a Notes→Code green pass earns no SR advance, no `markPassed`, no history event. The scheduler can't differentiate the user who drilled L3-grade Notes→Code from the user who only skimmed the canonical.
- **No telemetry on tab-visit** — Reference is consumed before every drill (the Start drills → CTA at `11-...js:646` routes through it) but the visit itself is unmeasured. Pace-Bar, hint-trend, etc., have no Reference-tier analog.

## Salvage path (if IMPROVE)
Ordered by leverage.

1. **Notes→Code green pass writes `markPassed(lesson.id, 'L3')`** — `11-...js:805-808` — when the runner output matches `expected`, also call `markPassed(lesson.id, 'L3')` and `appendHistory(lesson.id, 'notes-to-code-pass')`. Lifts **Spacing** by +2 (1→3: a Notes→Code recall now advances the SR bucket like L3 does, because it IS L3 with a different cue). Lifts **Closed-loop signal use** by +1 (2→3). Cheap and structurally correct — the grader is already byte-identical to L3's. **NOTE**: this projection assumes one edit moves two dims; if the rubric requires one-dim-per-edit, treat as two edits using the same code change.
2. **Default Reference render auto-enters Cinema mode after the first 5 seconds** (`11-...js:685-695`) — keep the canonical visible for skim, then auto-blur if no scroll/interaction. Lifts **Active recall** by +1 (2→3: default mode becomes retrieval, not familiarity). Opt-out via flash-toggle / cinema-toggle reverts. (Risk: this changes the default mental model of "Reference is where I read"; gate behind a setting if user-testing shows friction.)
3. **Append `reference-visit` to history with mode tag** (`11-...js:649`) — track `{mode: 'read'|'flash'|'cinema'|'notes-to-code', durationMs}`. Lifts **Closed-loop signal use** by +1 (alongside edit 1; allows Pace-Bar-style "you've read this 4 times without retrieving" diagnostic).

**Projected after salvage:** 19/21 if edit 1+2 land; 20/21 if all three.

## Action log
- 2026-05-30 Scored at 14/21 by `/eval-learning-tool --all`.
- 2026-05-30 Salvage edit 1 applied — Notes→Code green pass now calls `markPassed(content.id, 'L3')` + `appendHistory(content.id, 'notes-to-code-pass')` at `js/app/11-tabs-ref-conv-walk.js:806-815`. Projected 14→18 (Spacing 1→3, Closed-loop 2→3). Validator: 810 passed, 0 failed.
