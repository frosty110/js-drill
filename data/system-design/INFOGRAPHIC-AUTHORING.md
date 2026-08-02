# Lesson infographic authoring

The System Design drill supports an ordered set of downloadable PNG study
graphics per lesson. Simple lessons may keep one overview; complex lessons split
architecture, write, read, failure, and consistency mechanisms so each graphic
has enough room to teach its flow.

## Content sources

- `infographic-plan.json` records the target count and distinct study job for
  every Building Blocks, DDIA, and Canonical Design Problems lesson. It prevents
  later additions from being squeezed into an already-dense overview.
- Authored multi-image pilots live in `infographic-sets.json`. Each sheet defines
  its purpose, prose description, numbered flow, numbers, priorities, trade-offs,
  dimensions, and stable ID before an image is created.
- Legacy single-image Building Blocks and DDIA lessons use
  `infographic-specs.json`. Each entry selects a
  registered `visualType` and supplies a core idea, a 3–5 node mental-model
  flow, labels for every connection, four source notes, and one explicit
  trade-off. The source notes feed callouts inside the illustration; they are
  not rendered as a repeated card grid.
- Legacy Canonical Design Problems reuse the lesson's authored overview Mermaid graph,
  diagram takeaways, and key takeaways. That keeps the final interview sheet in
  sync with the drill rather than maintaining a second architecture description.

Legacy generated PNGs live at
`assets/system-design/infographics/<topic>/<lesson>.png`. Multi-image sets live
at `assets/system-design/infographics/<topic>/<lesson>/<graphic>.png`. Both are
committed so GitHub Pages and downloads do not need a runtime renderer.

`npm run generate:infographics` regenerates only legacy single-image lessons.
It skips and preserves lessons registered in `infographic-sets.json`.

## Author text before pixels

1. Choose the sheet count and IDs in `infographic-plan.json`.
2. Author every sheet in `infographic-sets.json`: explain what it teaches, trace
   the numbered flow, state operating numbers, rank priorities, and name real
   trade-offs.
3. Review the text as the technical source of truth.
4. Create a portrait raster infographic that corresponds to that description.
5. Register its exact width and height, visually inspect it, and run validation.

## Visual grammar

The generator provides reusable primitives for entities, arrows, callouts,
section labels, page typography, and export. Lesson-specific scene functions
compose those primitives into one of the registered visual types. New lessons
should reuse the primitives while adding the composition their mechanism needs.

Canonical Design Problems use a family of annotated final-whiteboard graphics:
an overview establishes the component map, then focused request or failure flows
get separate sheets when their branches would otherwise become tiny.

## Study-design rules

1. Lead with one mental model a learner can redraw from memory.
2. Make the mechanism visible: motion, topology, layering, timing, or state
   should be understood before reading the callouts.
3. Keep labels concrete and short. Aim for roughly 70% visual, 20% labels, and
   10% explanatory prose.
4. Cover mechanism, choice, failure behavior, and operational consequence.
5. End with a real tension, not a slogan. State what improves and what it costs.
6. Reject anything that reads like an app screenshot, dashboard, slide full of
   cards, or prose pasted onto a dark rectangle.
7. Keep all technical prose reviewable and searchable in
   `infographic-sets.json`, even when the corresponding static raster uses a
   hand-drawn generated treatment.

`drill-infographic-set` renders the authored explanation, numbered trace,
numbers, priorities, trade-offs, and every graphic in study order.
`drill-infographic` owns each preview and direct PNG download. Both reuse one
full-screen workspace with fit/100%/zoom controls, pointer panning, touch pinch,
keyboard close, and focus restoration.

Run `npm test` before committing. Validation rejects missing, stale, mis-sized,
or unregistered PNGs, plan/set count drift, and incomplete authored study data.
