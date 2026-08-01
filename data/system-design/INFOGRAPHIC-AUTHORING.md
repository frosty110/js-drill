# Lesson infographic authoring

The System Design drill has one downloadable 1600×2000 PNG quick-review sheet
for every lesson in Building Blocks, DDIA, and Canonical Design Problems.

## Content sources

- Building Blocks and DDIA use `infographic-specs.json`. Each entry selects a
  registered `visualType` and supplies a core idea, a 3–5 node mental-model
  flow, labels for every connection, four source notes, and one explicit
  trade-off. The source notes feed callouts inside the illustration; they are
  not rendered as a repeated card grid.
- Canonical Design Problems reuse the lesson's authored overview Mermaid graph,
  diagram takeaways, and key takeaways. That keeps the final interview sheet in
  sync with the drill rather than maintaining a second architecture description.

Run `npm run generate:infographics` after changing either source. Generated PNGs
live below `assets/system-design/infographics/<topic>/<lesson>.png` and are
committed so GitHub Pages and downloads do not need a runtime renderer.

## Visual grammar

The generator provides reusable primitives for entities, arrows, callouts,
section labels, page typography, and export. Lesson-specific scene functions
compose those primitives into one of the registered visual types. New lessons
should reuse the primitives while adding the composition their mechanism needs.

Canonical Design Problems use a different family: a large final-whiteboard
architecture occupies most of the page, with a concise invariant above it and
four interview checkpoints below it.

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
7. Never render technical prose with a generative image model. All production
   text must remain reviewable, searchable source data.

`drill-infographic` in `js/infographic-viewer.js` is the reusable UI. A lesson
page only supplies `src`, `title`, `alt`, and `download-name`; the component owns
preview, full-screen presentation, fit/100%/zoom controls, pointer panning,
touch pinch, keyboard close, focus restoration, and direct PNG download.

Run `npm test` before committing. Validation rejects missing, stale, mis-sized,
or unregistered PNGs and malformed lesson specs.
