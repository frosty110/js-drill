# The Component Catalog

> The Building Blocks topic, inverted. Instead of "here is a system, here are
> its parts", it is "here is a part — what does it cost, when do you reach for
> it, and which of the 32 canonical problems actually use it, doing what?"

The catalog and the canonical design problems are **two directions through one
graph**. This doc is the contract for that graph: what it is for, how it is
shaped, what an edge means, and what the gates enforce.

---

## Why this exists

Before it, the app taught system design from two ends and left the middle out:

| Surface | Teaches | Direction |
|---|---|---|
| **Canonical Design Problems** | how a whole system is assembled | problem → parts |
| **Building Blocks** (7 area units) | facts about components | component → trivia |

Neither trains the skill an interview actually tests: you are handed
requirements you have not seen and must **retrieve the right component fast,
defend it against its near neighbour, and say what it costs you**.

The `mechanism` facet in `data/system-design/tags.json` already named 32
components and tagged every design problem with the 2–4 it leans on — but the
vocabulary existed only as a *filter over problems*. Tapping "Caching" on a
problem took you to a list of **other problems**. There was no component node in
the graph at all. The catalog adds that node, and makes the edge traversable in
both directions.

## Goals

| # | Goal | Satisfied when |
|---|---|---|
| **G1** | **Selection** — map a requirement signal to the component that answers it | `reachFor` / `avoid` are stated as *signals in a prompt*, not properties of the component |
| **G2** | **Defense** — state the price of the choice unprompted | every component carries `costs` and `failureModes`, and `alternatives` names the sibling you must rule out |
| **G3** | **Transfer** — recognise the same component doing the same job across unlike problems | every edge is annotated with what the component is *doing there*, and both endpoints render it |
| **G4** | **Legibility** — see what the catalog contains and what you own of it | categories, per-component edge counts, and the usage-frequency ordering are visible without drilling in |

### Non-goals

- **Not a reference wiki.** Prose is the answer key, not the page. PROFILE.md
  bans verbose pedagogical prose and gating practice behind reading; a component
  page that must be *read* before it can be *used* has failed.
- **Not fundamentals teaching.** The user knows what a cache is.
- **Not a second home for the design-problem walkthroughs.** The catalog points
  at them; it never restates them.

---

## The graph

```
   catalog.json                    mechanism-map.json                manifest.json
   ┌───────────────┐               ┌──────────────────┐              ┌──────────────┐
   │  component    │──mechanism──▶ │  edges[compId]   │ ──problem──▶ │ design       │
   │  "caching"    │               │   { p01: "…",    │              │ problem p01  │
   │  category:    │               │     p02: "…" }   │ ◀────────────│ tags:        │
   │   caching-…   │               └──────────────────┘   annotated  │  mechanism[] │
   └───────────────┘                                                 └──────────────┘
```

Three files, three jobs, no duplication:

- **`data/system-design/components/catalog.json`** — the component nodes and the
  categories that group them.
- **`data/system-design/mechanism-map.json`** — the **edges**, each carrying the
  one thing that makes the graph worth traversing (below).
- **`data/system-design/design-problems/manifest.json`** — unchanged. Its
  `tags.mechanism` stays exactly what it was: the coarse facet the filter and the
  share-page builder consume.

**The edge annotations deliberately live in their own file** rather than inline
on `tags.mechanism`. Those are string ids read by the faceted filter, the tag
routes and the static-page generator; turning them into objects would disturb
three working consumers to save one file.

## What an edge means

An edge is not "problem P uses component C". It is **"in problem P, component C
is doing _this specific job_"**.

That distinction is the whole value. Caching appears in 11 problems, and it is
not the same idea eleven times:

```
caching → p01  "Hot short-code → long-URL lookups: read-mostly and effectively
                immutable, so there is no invalidation story to get wrong."
caching → p02  "The per-user timeline of post IDs in Redis, hydrated to full
                post bodies on read — the cache IS the precomputed feed."
```

Same tag. Completely different job. Without the annotation a component page is a
list of 11 problem names and teaches nothing — a link farm. With it, the page
becomes the component *worked backwards*, which is the entire point of the
surface.

### One string, two directions

An annotation is written once and rendered at **both** endpoints:

- On the component page → `News Feed — the per-user timeline of post IDs…`
- On the problem page → `Caching — the per-user timeline of post IDs…`

So an annotation must be phrased as a **predicate about the job**, never as a
sentence that only reads correctly from one end. Write *"the per-user timeline of
post IDs, hydrated on read"*, not *"News Feed uses caching for its timeline"* —
the latter is nonsense when rendered on the News Feed page.

**Style rules for an annotation**
- 1–2 sentences, ≤ 220 characters. It is scanned in a list, not read.
- Name the *concrete artefact* — what is stored, keyed by what, where.
- Prefer the tension over the fact: `"…so a stale read is invisible, which is
  why the TTL can be minutes"` beats `"…caches user data"`.
- No "This problem uses…" preambles. Start with the noun.

### Getting back out

An edge is only half a traversal if you cannot return along it. The breadcrumb
structurally cannot do this: it paints **containment** (System Design ›
Building Blocks › Catalog › Cache), and the problem that sent you to a
component is nowhere on that trail. So a component opened from a unit renders a
**return row** above its title naming that unit, and following an *Instead,
consider* alternative carries the origin with it — you are still weighing
blocks against the same problem.

The origin is held **in memory**, not in the URL. It is a fact about this
visit, so a reload or a pasted link correctly shows no row rather than
inventing a journey the reader never took; reaching the catalog clears it,
because browsing components is not reading a problem. It does survive
back/forward within a session — `applyRoute` has no argument to pass, and
losing the way out on Back is the failure the row exists to fix.

Probed by `tools/cdp/sd-component-return.js`, which navigates by **clicking**
rather than by setting `location.hash` — see the note in that file.

---

## Schemas

### `catalog.json`

```jsonc
{
  "categories": [
    {
      "id": "caching-delivery",          // slug, stable, URL-safe
      "title": "Caching & Delivery",
      "blurb": "One line: what question this category answers."
    }
  ],
  "components": [
    {
      "id": "caching",                   // slug, stable — this is the URL
      "category": "caching-delivery",    // must exist in categories[]
      "title": "Cache",
      "mechanism": "caching",            // OPTIONAL — the tags.json mechanism id
                                         // this component IS. Present ⇒ the edge
                                         // coverage gate applies (see Gates).
      "what": "One sentence. The mental model, not the definition.",
      "reachFor": ["Signal in the prompt that says YES", "…"],   // ≥2
      "avoid":    ["Signal that says NO / the anti-pattern", "…"], // ≥1
      "costs":    ["What you pay to have it", "…"],               // ≥1
      "failureModes": ["How it breaks at scale", "…"],            // ≥1
      "alternatives": [
        { "id": "cdn", "note": "One line: what decides between them." }
      ],
      "drill": { "topic": "components", "unit": "c02" }  // OPTIONAL — existing
                                                         // question set to drill
    }
  ]
}
```

`reachFor` and `avoid` are the G1 surface, and they are the fields most easily
written wrong. They describe **signals in a problem statement**, not properties
of the component. `"Read-heavy, 100:1, tolerates 60s staleness"` is a signal.
`"Improves read performance"` is a property, and it is useless — it does not
help anyone decide anything.

### `mechanism-map.json`

```jsonc
{
  "edges": {
    "<componentId>": {
      "<problemUnitId>": "What the component is doing in that problem."
    }
  }
}
```

Keyed by **component id**, not mechanism id. Most components are a mechanism
1:1, but a component without a registered mechanism can still carry edges — the
facet is a coarse index of each problem's 2–4 *headline* mechanisms, while the
catalog is free to be finer-grained.

### When an edge exists

**An edge exists when the component is a DECISION in that problem** — something
a candidate has to choose and defend — not merely something present in the
architecture.

This is the rule that keeps the graph worth reading. A load balancer appears in
all 32 designs; it is a *decision* in about four (the ones where long-lived
connections break the stateless assumption). Authoring an edge everywhere the
component technically appears would rebuild the link farm the annotations exist
to prevent, just with more words in it.

Current shape: **262 edges over all 66 components**, 5–12 per problem, ~7 on average.
No orphans: every component names at least one problem it does work in, and the
probe asserts that so regressing is visible rather than only noted.

### How the tagging is surfaced

The distinction below is the catalog's only real taxonomy, so it has to be
visible without opening anything:

| Where | What it shows |
|---|---|
| Catalog card | a `signature` mark on every component backed by a registered mechanism |
| Catalog head | a role filter — All / Signature / Supporting, with live counts, persisted in `progress.catalogRole` |
| Component page | a chip row: category · signature (deep-linking to that mechanism's problem list) or supporting · usage count |
| Problem page | signature components sorted first and marked, supporting ones behind them |
| Static pages | the same marks, so a fetcher sees the taxonomy too |

Categories are already headings, so the filter deliberately does NOT restate
them — it exposes the one axis a heading cannot.

### Signature vs. supporting

A problem's `tags.mechanism` names its 2–4 **signature** components — the ones an
interviewer actually probes. The edge file names all ~6 it leans on. Both are
worth showing, so both endpoints sort the signature ones first and mark them,
rather than hiding the rest or flattening the distinction.

**The facet is deliberately NOT grown to match the catalog.** `tags.json`'s
`mechanism` values are the *filter* index, and a filter panel with 60 chips is
unusable on a phone — which is where 80% of study happens (PROFILE.md). This is
why the problem→component list is derived from the **edge file** rather than
from the tags: reading it from the facet would have hidden two thirds of each
parts list behind a filter-sizing decision that has nothing to do with it.

---

## Gates

Enforced by `tools/validate-system-design.js` (which `node tools/check-all.js`
runs). Each exists because its failure mode is silent.

| # | Gate | Silent failure it prevents |
|---|---|---|
| 1 | Every `component.category` resolves to a declared category | Component vanishes from the catalog — it renders nowhere and nothing errors |
| 2 | Component and category ids are unique and URL-safe | Two components collide on one URL; the second is unreachable |
| 3 | Every `component.mechanism` is registered in `tags.json` | A chip deep-links to a facet value that matches nothing — an empty list, no error |
| 4 | Every edge's problem id exists in the design-problems manifest | A dead link on the component page |
| 5 | **Coverage** — for a component with `mechanism: X`, every problem tagged `X` has an annotation | The link farm: problems silently listed with no job description, which is the exact failure this surface exists to avoid |
| 6 | Every `alternatives[].id` resolves to a real component | Dead sibling link |
| 7 | Annotation length ≤ 220 chars, non-empty | A paragraph in a scan list; layout breaks quietly on mobile |

Gate 5 is the load-bearing one. It means **you cannot tag a design problem with a
mechanism and forget to say what it is doing there** — the drift that would
hollow the catalog out over time is impossible rather than merely discouraged.

Extra annotations *beyond* the tagged set are allowed: a component can
legitimately appear in a problem that does not carry it as a headline facet.

---

## Adding to the catalog

**A new component**
1. Append to `components[]` in `catalog.json`. Pick an existing `category`.
2. If it corresponds to a `mechanism` value in `tags.json`, set `mechanism` —
   and be ready to author an edge for every problem already tagged with it
   (gate 5 will tell you exactly which).
3. Fill `reachFor` / `avoid` as **prompt signals** (see above).
4. `node tools/validate-system-design.js`
5. `node tools/build-share-pages.js` — the static page is committed output.

**A new edge** (you tagged a problem with a mechanism)
1. Add the annotation under `edges[<componentId>][<problemId>]`.
2. Phrase it as a predicate about the job — it renders at both ends.
3. Validate + rebuild share pages as above.

**A new category** — append to `categories[]`. Order in the file is display
order. Categories are a grouping *of the component set*; a category earns its
place because components fall into it, not because the name sounds tidy.

---

## URLs

Two surfaces, registered in `js/routes.js` like every other addressable place
(see [url-contract.md](url-contract.md)):

| Surface | App hash | Static page |
|---|---|---|
| `sdComponentIndex` | `system-design.html#/components/catalog` | `sd/components/catalog/` |
| `sdComponent` | `system-design.html#/components/c/<id>` | `sd/components/c/<id>/` |

**Both endpoints of every edge are fetchable.** A component page lists its
problems and each design problem's page lists its components, in the static
output as well as in the app. A one-way graph over HTTP would satisfy invariant
7 for each page individually while making the traversal itself app-only.

Both are `content` disposition — a component page means the same thing to
everyone who opens it, so it is crawlable, shareable and quotable, and the
static twin carries the full component body plus both directions of the graph.

The `c/` segment is a reserved discriminator: without it a component id and a
unit id (`c01`) share a URL shape, and `#/components/c01` would be ambiguous.
`catalog` and `c` are therefore added to `SD_RESERVED` in `js/routes.js`.
