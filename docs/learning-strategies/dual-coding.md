# Dual coding

## The claim

When information is encoded **both verbally (text) and visually (diagrams,
spatial layouts, color)**, recall improves over verbal-only encoding. Allan
Paivio's dual-coding theory (1971, refined through the 1980s) is supported by
modern multimedia-learning work (Mayer, *Multimedia Learning*, 2nd ed., 2009)
— two retrieval pathways are stronger than one, and visual encoding bypasses
the language bottleneck for spatial / structural concepts (offsets, intervals,
shapes, flows).

## Why it matters for this app

The rusty engineer needs to **see the shape** of an idiom, not just read its
prose. Index arithmetic (`r - l + 1`), matrix neighbor offsets
(`[[-1,0],[1,0],…]`), tree traversal order, BFS level expansion, sliding-window
mechanics — every one of these is **structural** in nature. Trying to memorize
them from code-only references means re-deriving the spatial model on each
recall, which is exactly the bottleneck rusty engineers hit under interview
time pressure.

Mobile-first matters here too: an ASCII diagram embedded in the Reference card
renders cleanly on a phone with no extra asset, no zoom, no scroll. Image
files would fight the mobile loop; ASCII rides along inside the same code
string and gets the same monospace treatment.

## How the app encodes it today

- **Canonical design-problem visual decks (2026-07-31)** — every one of the
  17 worked "Design a…" interviews now pairs its verbal walkthrough with four
  small Mermaid architecture models: overview, signature mechanism, scale/path,
  and failure/consistency. Each problem ends with one **Final Interview
  Whiteboard** for quick review: the overview drawing, four numbered design
  decisions, and a full-board view that presents all four drawings together.
  Each model is also co-located with the answer it explains. A Hide labels
  control turns the overview SVG into retrieval practice: name the boxes and
  flows, then reveal.
- **📳 Haptic Tap-Pulse (iter 141)** — first tactile encoding channel in
  the app. Opt-in toggle wires `navigator.vibrate` to L1 correct (30ms) /
  L1 miss (twin 60ms) / L3 pass (120ms) / Rapid-Fire streak-of-5 (3-pulse
  roll). Where every prior surface has paired visual + textual encoding
  (the dual-coding READ direction), Haptic adds the FEEDBACK direction's
  second channel: the visual "correct"/"wrong" indication is now mirrored
  by a tactile signal felt in the hand. PROFILE L26-28 (mobile-first) +
  L42-44 ("30-second tap-and-recall sessions") — the rusty engineer
  drilling head-down on a phone gets a second confirmation modality so
  they can sustain attention without staring. Capability-gated (toggle
  hidden on iOS Safari + desktop without vibration motors); test pulse
  on enable so the user feels it work immediately. Cat 8 ship #2 (after
  iter-109 Match).
- **🔖 Match (iter 109)** — first Cat 8 ship; visual-pairing modality.
  Bidirectional title ↔ description matcher drills the name-to-concept
  retrieval direction; renders a card grid where the user taps to
  pair, exercising the spatial-arrangement-as-recall surface
  (complementary to text-only L1).
- **`s-index-math` Reference** — first lesson to embed full ASCII diagrams
  alongside the canonical code. Each of the 6 idioms (inclusive length,
  midpoint, fixed-length slice, sliding window, circular indexing, nth-from-
  end) shows a concrete array with index labels, arrow markers (`▲ ▼ ↑ ↓`),
  and worked numeric examples right next to the formula. The L1 questions
  test recall of the formula; the diagrams give it a visual home to retrieve
  from.
- **`s-stack-pattern` / `s-queue-pattern`** — verbal-only diagrams via inline
  comments (`stack.push(1); // [1]`). Light visual encoding via state-shape
  trace.
- **`s-matrix-neighbors`** — `dirs` array IS visual encoding: the literal
  shape `[[-1,0],[1,0],[0,-1],[0,1]]` lays out cardinal directions in a way a
  rusty engineer can map to compass points.

## Under-exploited / candidate features

- **Retro-add ASCII diagrams to high-traffic lessons.** Audit existing
  lessons for structural concepts that currently read code-only: binary
  search, sliding window, matrix BFS, tree traversals, LL fast/slow pointers,
  heap parent/child. (Tracked as BS-13 in SELF-IMPROVE.md.)
- **Animation alternative for L3.** A static ASCII diagram captures one
  state; an interactive "step through" (CodeMirror has line markers) could
  show iteration progress. Higher engineering cost; queue for later evaluation.
- **Color-coded code via existing CodeMirror Dracula theme.** Already shipped
  for L2/L3, but the Reference card uses a plain `<pre>`. Surfacing the same
  syntax highlighting in Reference would add a second visual channel without
  new asset work.
- **Spatial layout of L1 distractors.** When L1 options are themselves
  structural (e.g. "which slice gives 3 elements?"), arrange them visually
  rather than as flat text — let the shape of the answer be inspectable.

## Pitfalls

- **ASCII rot under reflow.** Monospace + careful spacing is load-bearing.
  A user pasting a Reference snippet into a non-monospace context breaks the
  diagram. Mitigation: the app's Reference renders in `font-family: mono` —
  safe inside the app. The exported cheatsheet uses fenced code blocks ↳ also
  safe.
- **Diagram length tax.** A 30-line diagram for a 3-line formula inverts the
  signal. Diagrams earn their place when the formula's *meaning* is spatial;
  for purely textual idioms (e.g. `Array.from`), a diagram is noise.
- **"Cute but useless" risk.** Boxes-and-arrows for the sake of decoration
  hurts the rusty user. Every diagram should isolate a specific mechanism,
  hot path, tradeoff, or failure and state its one-sentence takeaway.
- **Cross-browser unicode.** Box-drawing characters render in every modern
  font, but very old terminals or stripped-down email previews may not.
  Inside a CodeMirror or `<pre>` block in a modern browser this is a non-
  issue.

## References

- Paivio, A. (1971). *Imagery and Verbal Processes.* Holt, Rinehart & Winston.
- Mayer, R. E. (2009). *Multimedia Learning* (2nd ed.). Cambridge University
  Press. Especially the "multimedia principle" (text + picture beats text
  alone) and the "spatial contiguity principle" (visual + verbal should be
  co-located, not split across pages).
- Cross-link: [active-recall](active-recall.md) — dual coding multiplies the
  recall payoff per retrieval attempt.
