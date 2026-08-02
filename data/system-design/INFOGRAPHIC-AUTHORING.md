# Lesson infographic authoring

The System Design drill supports an ordered set of downloadable PNG study
graphics per lesson. Every Building Blocks, DDIA, and Canonical Design Problems
lesson now has a multi-sheet set. Architecture, write, read, failure, and
consistency mechanisms are split whenever they need independent reading space.

## Content sources

- `infographic-plan.json` records the target count and distinct study job for
  every Building Blocks, DDIA, and Canonical Design Problems lesson. It prevents
  later additions from being squeezed into an already-dense overview.
- Authored multi-image sets live in `infographic-sets.json`. Each sheet defines
  its purpose, prose description, numbered flow, numbers, priorities, trade-offs,
  dimensions, and stable ID before an image is created.
- Building Blocks and DDIA source material also lives in
  `infographic-specs.json`. Each entry selects a
  registered `visualType` and supplies a core idea, a 3–5 node mental-model
  flow, labels for every connection, four source notes, and one explicit
  trade-off. The source notes feed callouts inside the illustration; they are
  not rendered as a repeated card grid.
- Canonical Design Problems reuse the lesson's authored overview Mermaid graph,
  diagram takeaways, and key takeaways. That keeps the final interview sheet in
  sync with the drill rather than maintaining a second architecture description.

All PNGs live at
`assets/system-design/infographics/<topic>/<lesson>/<graphic>.png` and are
committed so GitHub Pages and downloads do not need a runtime renderer.

`npm run author:infographic-sets` rebuilds pending sheet copy from reviewed
lesson material while preserving every registered static artwork set.
`npm run generate:infographic-sets` renders pending `diagram-v1` sheets with the
chalkboard architecture renderer. It is an idempotent no-op when all artwork is
reviewed. `npm run generate:infographics` remains a compatibility command for a
future unregistered legacy lesson.

The renderer supports `--preview`, `--key=<topic/lesson>`, `--id=<graphic>`,
`--offset`, and `--limit`. Use `--rerender-v2` only to intentionally refresh
already-reviewed deterministic artwork. It uses the licensed Caveat typeface in
`tools/fonts/` plus Inkscape and ImageMagick.

High-detail one-off artwork uses `tools/print-infographic-image-prompts.js` to
produce the content-specific image prompt and
`tools/install-generated-infographics.js` to normalize, register, and lock the
accepted PNG. The DDIA replication topology artwork is the visual style
reference. Generated images still have to pass the same visual and technical
review as deterministic artwork.

## Author text before pixels

1. Choose the sheet count and IDs in `infographic-plan.json`.
2. Author every sheet in `infographic-sets.json`: explain what it teaches, trace
   the numbered flow, state operating numbers, rank priorities, and name real
   trade-offs.
3. Review the text as the technical source of truth.
4. Create a portrait raster infographic that corresponds to that description.
5. Register its exact width and height, visually inspect it, and run validation.

## Decide how many graphics the lesson needs

Do not target a fixed count. Target one independently readable mental model per
sheet. Most lessons need 2–5 graphics:

1. Start with a system map when component ownership and boundaries matter.
2. Give the dominant write/create path its own sheet when it has more than one
   durable side effect, asynchronous hop, or consistency boundary.
3. Give the dominant read/query path its own sheet when cache hit/miss,
   fan-out, ranking, aggregation, or fallback behavior matters.
4. Add a failure/recovery sheet when retries, leases, expiry, compensation,
   repair, failover, or reconciliation cannot remain legible in the happy path.
5. Add a comparison sheet when the interview decision is between genuinely
   different architectures, not merely configuration values.

Split a graphic when labels become smaller than the component names, arrows
cross repeatedly, normal and failure paths are hard to distinguish, or the
reader must zoom before understanding the primary flow. Do not split when two
views differ only by a minor implementation detail.

Examples:

- URL Shortener: system map; `POST /shorten`; `GET /{code}` with cache hit and
  miss branches.
- Rate Limiting: system map; token-bucket state transition; distributed
  enforcement, quota coordination, and failure behavior.
- DDIA Replication: topology comparison; single-leader flow; multi-leader
  conflicts; leaderless quorum/read-repair flow.

Record the decision and stable IDs in `infographic-plan.json` before producing
artwork. The image count is an information-architecture choice, not an output of
the renderer.

## Required content contract

Every infographic must answer these questions without relying on the lesson
page around it:

- What user or upstream actor starts the flow?
- Which boundary authenticates, routes, limits, or coordinates the request?
- Which services own the decision and the durable state?
- Where are caches, databases, indexes, queues, logs, workers, regions, and
  external systems involved?
- Which arrows are synchronous request/response, asynchronous events,
  replication, control/metadata, or failure/retry paths?
- What happens on the important branch: cache miss, duplicate, timeout,
  conflict, partition, stale read, overload, or partial completion?
- Which numbers constrain the design: peak read/write QPS, payload size,
  retention, cardinality, TTL, p99 latency, replication factor, quorum,
  fan-out, RPO/RTO, or error budget?
- What should the interview candidate optimize first, and what becomes worse
  because of that choice?

The bottom or side decision strip must contain concise priorities,
optimizations, and trade-offs. It must not repeat the architecture description
in paragraph form.

## Choose the visual archetype

| Interview job | Preferred drawing | Required visual evidence |
|---|---|---|
| Establish the system | Component topology | Clients, boundary, services, state, async/external systems, primary and feedback paths |
| Explain a read or write | Sequence/data path | Actors or components, ordered arrows, branches, acknowledgements, durable commit point |
| Compare approaches | Side-by-side topologies | Same workload entering each option, different coordination/state path, decision guide |
| Explain correctness | State/transaction sequence | Invariant, commit boundary, concurrency or ordering point, rejected/anomalous path |
| Explain failure | Normal path plus recovery loop | Failure injection point, retry/backoff, isolation or compensation, repaired outcome |
| Explain scale | Partition/replication topology | Routing key, shards/partitions, replicas/regions, hot spot or rebalance path |
| Explain one mechanism | Focused mechanism | Concrete state transition or data structure, input/output, feedback path |

Avoid a generic vertical timeline unless time itself is the mechanism. Avoid
using the same topology simply because two lessons have the same number of
steps.

## Visual grammar

The renderer provides hand-drawn clients, services, databases, queues, caches,
policy shields, workers, partitions, lifelines, failure loops, numbered arrows,
and chalk typography. The artwork selects among topology, sequence, comparison,
recovery, partition/replication, correctness, and focused-mechanism layouts.
Numbers sit beside the node or link they constrain; priorities and trade-offs
remain subordinate. The reusable composition belongs to the app's image viewer,
not to a dashboard/card treatment inside the PNG.

The technical source remains searchable and reviewable in
`infographic-sets.json`. A reviewed image removes `renderer` and records an
`artwork` value so future authoring and render passes cannot silently overwrite
it.

Canonical Design Problems use a family of annotated final-whiteboard graphics:
an overview establishes the component map, then focused request or failure flows
get separate sheets when their branches would otherwise become tiny.

### Chalkboard aesthetic

- Use a near-black, subtly textured background with ample contrast.
- Use hand-lettered white/chalk typography for the title and major labels.
- Draw recognizable outlined system components; do not substitute rounded UI
  cards for services, databases, caches, queues, or clients.
- Use solid arrows for the primary synchronous path and dashed arrows for
  replication, asynchronous events, invalidation, retry, or feedback.
- Keep the system drawing dominant. Target roughly 60–75% architecture, with
  the remaining space reserved for labels, numbers, and decision notes.
- Use 2–5 purposeful visual regions. Regions should represent different flows,
  states, or alternatives—not a dashboard grid.
- Keep major component labels short and exact. Longer explanation belongs beside
  the relevant link or in the decision strip.
- Preserve the complete title. Reduce its size or use three lines instead of
  clipping or replacing words with an ellipsis.

### Color semantics

- White: title, neutral labels, and invariant statements.
- Amber: primary request or write path.
- Green: read path, success, healthy result, or recovery completion.
- Cyan: data movement, replication, storage, or secondary fetch.
- Purple: asynchronous events, alternative topology, coordination, or retry.
- Coral: failures, conflicts, overload, rejection, or warnings only.

Color must carry the same meaning within a sheet. Never use coral merely to
decorate a healthy component.

### Numbers and trade-offs

Attach each number to the node or link it constrains. For example, place a cache
TTL beside the cache, `R + W > N` beside the replica set, `p99 < 100 ms` beside
the request path, and events/day beside the queue or log. Detached metric cards
are not a substitute for operating assumptions.

Trade-offs must name both sides:

- "Fan-out on write lowers feed-read latency but amplifies writes and makes
  celebrity accounts expensive."
- "A shared global limiter is accurate but adds coordination latency and a
  larger failure domain."
- "Longer TTLs reduce origin load but increase staleness and purge risk."

"Use caching," "scale horizontally," and "high availability" are priorities or
tactics, not trade-offs by themselves.

## Artwork production workflows

### Deterministic chalkboard renderer

Use this when the registered flow can be expressed cleanly with the supported
topology, sequence, comparison, failure, scale, correctness, or mechanism
archetype.

```sh
npm run generate:infographic-sets -- --preview --key=ddia/ch08 --id=partial-failure-model
npm run generate:infographic-sets -- --limit=4
```

Preview before registering a batch. `--rerender-v2` intentionally replaces
reviewed v2 artwork and should not be used as a routine build flag.

### High-detail generated artwork

Use this when the subject needs a denser, custom composition than the renderer
can express. Generate one distinct asset per prompt. Use
`assets/system-design/infographics/ddia/ch05/topologies.png` as the clean style
reference, not a browser or phone screenshot.

The prompt must include:

1. Exact title and lesson context.
2. The visual archetype and required components.
3. Primary, alternate, asynchronous, and failure paths.
4. Numbers attached to their constraints.
5. Priorities, optimizations, and decision-driving trade-offs.
6. The chalkboard color semantics above.
7. Explicit negatives: no browser chrome, app UI, dashboard, UI card grid,
   generic timeline, prose-heavy slide, photorealism, gradients, 3D, or
   watermark.

`tools/print-infographic-image-prompts.js` assembles this contract from the
registry. Inspect the prompt before generating; correct weak source text rather
than hoping the image step will infer missing architecture. Install an accepted
image with `tools/install-generated-infographics.js`, which normalizes the PNG,
records dimensions, removes `renderer`, and adds reviewed `artwork` metadata.

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

## Acceptance checklist

Review at original resolution and as a small phone-width preview. An infographic
is accepted only when all of the following are true:

- The title and every major component label are spelled correctly and uncut.
- The drawing can be classified immediately as a topology, sequence,
  comparison, state mechanism, recovery loop, or partition/replication map.
- Clients, services, data stores, caches, queues/events, workers, regions, and
  external dependencies appear when they matter to the lesson.
- Arrow direction and line style match the technical flow.
- Read, write, async, replication, failure, retry, and recovery colors are
  semantically consistent.
- The happy path and the important failure or alternate branch are both clear.
- At least one operating number is attached to the component it constrains.
- Priorities and trade-offs help an interview candidate make a decision rather
  than restating the diagram.
- No content resembles browser chrome, an app screenshot, a dashboard, a UI
  component gallery, or a stack of metric cards.
- Text remains readable in the full-screen viewer at 100% and the user can pan
  the image without labels colliding.
- The downloaded file is a valid PNG with its exact registered dimensions.

For batch work, create contact sheets by lesson family to catch repetition,
clipping, inconsistent colors, accidental low-density pages, and a wrong visual
archetype. Then spot-check the densest and longest-title images at original
resolution.

`drill-infographic-set` renders the authored explanation, numbered trace,
numbers, priorities, trade-offs, and every graphic in study order.
`drill-infographic` owns each preview and direct PNG download. Both reuse one
full-screen workspace with fit/100%/zoom controls, pointer panning, touch pinch,
keyboard close, and focus restoration.

Before committing, decode every PNG with ImageMagick, run
`node tools/validate-system-design.js`, run `npm test`, and run
`git diff --check`. Validation rejects missing, stale, mis-sized, or
unregistered PNGs, plan/set count drift, and incomplete authored study data.
