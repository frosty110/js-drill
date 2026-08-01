# Lesson infographic authoring

The System Design drill has one downloadable 1600×2000 PNG quick-review sheet
for every lesson in Building Blocks, DDIA, and Canonical Design Problems.

## Content sources

- Building Blocks and DDIA use `infographic-specs.json`. Each entry has a core
  idea, a 3–5 node mental-model flow, labels for every connection, four study
  cards, and one explicit trade-off.
- Canonical Design Problems reuse the lesson's authored overview Mermaid graph,
  diagram takeaways, and key takeaways. That keeps the final interview sheet in
  sync with the drill rather than maintaining a second architecture description.

Run `npm run generate:infographics` after changing either source. Generated PNGs
live below `assets/system-design/infographics/<topic>/<lesson>.png` and are
committed so GitHub Pages and downloads do not need a runtime renderer.

## Study-design rules

1. Lead with one mental model a learner can redraw from memory.
2. Keep labels concrete and short; put nuance in the four study cards.
3. Cover mechanism, choice, failure behavior, and operational consequence.
4. End with a real tension, not a slogan. State what improves and what it costs.
5. Never render technical prose with a generative image model. All production
   text must remain reviewable, searchable source data.

`drill-infographic` in `js/infographic-viewer.js` is the reusable UI. A lesson
page only supplies `src`, `title`, `alt`, and `download-name`; the component owns
preview, full-screen presentation, fit/100%/zoom controls, pointer panning,
touch pinch, keyboard close, focus restoration, and direct PNG download.

Run `npm test` before committing. Validation rejects missing, stale, mis-sized,
or unregistered PNGs and malformed lesson specs.
