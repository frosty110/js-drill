# System Design — Expansion, Taxonomy & Navigation Proposal

**Status:** proposal · **Date:** 2026-08-02 · **Scope:** `data/system-design/`, `system-design.html`, `tools/validate-system-design.js`

---

## 1. The problem

The 17 canonical design problems are a faithful rendering of the 2020–2022 interview
canon (Alex Xu Vol. 1 / Grokking). They are well-built — ordered arc, 8–11 questions,
four architecture diagrams, multi-sheet infographics. But the list has three
structural gaps and one navigational one:

| Gap | Evidence |
|---|---|
| **A — no streaming/analytics problem exists** | DDIA ch10/ch11 drill batch + stream theory; no worked problem ever makes the learner *apply* it. Ad-click-aggregation is currently a top-frequency Meta/Google question. |
| **B — products are designed, primitives mostly aren't** | 15 of 17 are products. Only cache + rate limiter are "build the box." Kafka / job scheduler / KV store / webhook delivery are routine at Amazon, Google, Uber, Stripe. |
| **C — zero AI/ML infrastructure** | The category that didn't exist in the old canon and is now standard at Meta, Google, and every AI-adjacent company: inference serving, RAG, vector search, feature stores. |
| **D — the list has no index** | 17 items in 3 coarse parts, no tags, no difficulty, no company signal, no way to answer "I have 45 minutes" or "what else uses consistent hashing?" At 32 items this becomes the dominant usability problem. |

Gaps A–C are content. **Gap D is the one that decides whether the content is usable** —
and it gets worse, not better, as we add problems. This proposal therefore ships
navigation *first* and content second.

---

## 2. The target list — 32 problems, 7 mechanism families

The organizing axis changes from **product surface** ("feeds", "realtime") to
**transferable mechanism**. A staff engineer doesn't store "News Feed" and "Photo
Sharing" as separate facts — they store *fanout-on-write vs. fanout-on-read* and
instantiate it. Grouping by mechanism makes that explicit, and it means every part
boundary teaches something.

Existing problems keep their ids. New ones append.

### Part 1 — Read-Heavy Systems & Search (6)

| id | Title | Mechanisms | Diff | Status |
|---|---|---|---|---|
| `p01` | URL Shortener | `id-generation` `caching` `sharding` | easy | ✅ |
| `p14` | Typeahead / Autocomplete | `search-index` `caching` `sharding` | medium | ✅ |
| `p02` | News Feed | `fanout` `caching` `ranking` | medium | ✅ |
| `p03` | Photo-Sharing Service | `fanout` `blob-storage` `cdn` | medium | ✅ |
| `p05` | Web Crawler | `work-queue` `dedup` `backpressure` | medium | ✅ |
| `p25` | **Search Engine (Inverted Index & Ranking)** | `search-index` `sharding` `ranking` | hard | 🆕 |

### Part 2 — Realtime & Push (5)

| id | Title | Mechanisms | Diff | Status |
|---|---|---|---|---|
| `p06` | Chat System | `websockets` `presence` `ordering` | medium | ✅ |
| `p07` | Notification System | `fanout` `work-queue` `idempotency` | medium | ✅ |
| `p11` | Leaderboard | `sorted-index` `caching` `sharding` | easy | ✅ |
| `p10` | Collaborative Document Editor | `crdt-ot` `websockets` `ordering` | hard | ✅ |
| `p27` | **Live Streaming** | `websockets` `fanout` `cdn` `backpressure` | hard | 🆕 |

### Part 3 — Streaming & Analytics (3) 🆕 *family*

| id | Title | Mechanisms | Diff | Status |
|---|---|---|---|---|
| `p19` | **Distributed Message Queue (Kafka)** | `log-storage` `partitioning` `consumer-groups` `backpressure` | hard | 🆕 |
| `p18` | **Ad Click Aggregator** | `stream-processing` `windowing` `exactly-once` `hot-keys` | hard | 🆕 |
| `p26` | **Observability Platform (Metrics · Logs · Traces)** | `stream-processing` `time-series` `cardinality` `sampling` | hard | 🆕 |

> Merged what could have been two problems (metrics; log search + tracing) into one
> observability platform — they share ~70% of their architecture, and a near-duplicate
> unit is worse than a single deep one.

### Part 4 — Infrastructure Primitives (5)

| id | Title | Mechanisms | Diff | Status |
|---|---|---|---|---|
| `p08` | Distributed Rate Limiter | `rate-limiting` `consistent-hashing` `caching` | medium | ✅ |
| `p12` | Distributed Cache | `consistent-hashing` `eviction` `caching` | medium | ✅ |
| `p20` | **Distributed Job Scheduler** | `leader-election` `work-queue` `idempotency` `at-least-once` | hard | 🆕 |
| `p21` | **Distributed Key-Value Store** | `quorum-replication` `consistent-hashing` `anti-entropy` `vector-clocks` | hard | 🆕 |
| `p29` | **Webhook / Event Delivery** | `at-least-once` `idempotency` `backpressure` `retry-policy` | medium | 🆕 |

### Part 5 — Geo, Media & Recommendation (4)

| id | Title | Mechanisms | Diff | Status |
|---|---|---|---|---|
| `p09` | Ride-Sharing Service | `geo-index` `matching` `websockets` | hard | ✅ |
| `p24` | **Proximity Service (Nearby Places)** | `geo-index` `caching` `sharding` | medium | 🆕 |
| `p04` | Video Streaming Service | `blob-storage` `cdn` `transcoding` | medium | ✅ |
| `p28` | **Short-Form Video Feed** | `ranking` `cdn` `transcoding` `feature-serving` | hard | 🆕 |

### Part 6 — Transactions, Storage & Commerce (5)

| id | Title | Mechanisms | Diff | Status |
|---|---|---|---|---|
| `p13` | File Sync / Object Storage | `blob-storage` `chunking` `dedup` `metadata-store` | medium | ✅ |
| `p32` | **Auth, SSO & Session Service** | `token-issuance` `revocation` `caching` | medium | 🆕 |
| `p16` | Ticket Booking System | `reservation` `contention` `idempotency` | hard | ✅ |
| `p15` | Payment System | `idempotency` `exactly-once` `saga` `reconciliation` | hard | ✅ |
| `p17` | Prescription Drug Marketplace | `saga` `reservation` `compliance` | hard | ✅ |

### Part 7 — AI & ML Infrastructure (4) 🆕 *family*

| id | Title | Mechanisms | Diff | Status |
|---|---|---|---|---|
| `p23` | **RAG / Semantic Search** | `vector-search` `chunking` `ranking` `freshness` | medium | 🆕 |
| `p22` | **LLM Inference & Serving Platform** | `gpu-scheduling` `batching` `kv-cache` `slo-queueing` | hard | 🆕 |
| `p30` | **Feature Store & Real-Time ML Serving** | `feature-serving` `stream-processing` `point-in-time` | hard | 🆕 |
| `p31` | **Content Moderation Pipeline** | `stream-processing` `human-in-loop` `ranking` `work-queue` | medium | 🆕 |

**Totals:** 17 existing + 15 new = **32 problems**, 7 families, ~300 new questions.

---

## 3. Stable ids, floating display order

Regrouping must **not** renumber the existing 17. Renaming `p09` → `p17` would break
saved SR keys (`design-problems/p09/3`), infographic plan/set keys, PNG directory
paths, and every shared deep link.

**Rule: `id` is permanent; display position comes from `parts[]`.**

`renderTopicHome` already iterates `m.parts` and looks up by id — display order is
*already* part-driven. The only visible artifact is the `ch-num` badge, which renders
`ch.num` and would read `1, 14, 2, 3, 5, 25`.

Fix — one contained change in `loadTopicChapters`:

```js
// Flatten parts in authored order; assign 1..N for display only.
manifest.parts.flatMap(p => p.chapters).forEach((cid, i) => {
  CH[t][cid].displayNum = i + 1;      // what the badge shows
});                                    // ch.num stays the authored/stable field
```

`chNum(c)` becomes `c.displayNum ?? c.num ?? c.chapter`. Every other topic is
unaffected (no `displayNum` → falls through to today's behavior).

---

## 4. Tags — `data/system-design/tags.json`

Mirrors `data/tags.json` (the main app's Problems facets) so the family shares one
mental model. Authored values live on **manifest chapter entries**, so the topic home
can filter before any unit file is fetched — the same reason the main app puts tags
on manifest entries.

```jsonc
// data/system-design/tags.json
{
  "schema": 1,
  "appliesTo": ["design-problems"],
  "facets": [
    { "id": "family", "label": "Family", "derived": "part",
      "note": "The part name. Derived — no authoring." },

    { "id": "mechanism", "label": "Mechanism", "authored": true, "multi": true,
      "note": "The transferable skill. THE cross-family index — a problem carries 2–4.",
      "values": [
        {"id":"fanout","label":"Fan-out"}, {"id":"caching","label":"Caching"},
        {"id":"sharding","label":"Sharding"}, {"id":"consistent-hashing","label":"Consistent hashing"},
        {"id":"quorum-replication","label":"Quorum replication"}, {"id":"stream-processing","label":"Stream processing"},
        {"id":"windowing","label":"Windowing"}, {"id":"exactly-once","label":"Exactly-once"},
        {"id":"at-least-once","label":"At-least-once"}, {"id":"idempotency","label":"Idempotency"},
        {"id":"work-queue","label":"Work queue"}, {"id":"backpressure","label":"Backpressure"},
        {"id":"leader-election","label":"Leader election"}, {"id":"geo-index","label":"Geo index"},
        {"id":"search-index","label":"Inverted index"}, {"id":"vector-search","label":"Vector search"},
        {"id":"blob-storage","label":"Blob storage"}, {"id":"cdn","label":"CDN"},
        {"id":"websockets","label":"Persistent connections"}, {"id":"crdt-ot","label":"CRDT / OT"},
        {"id":"ranking","label":"Ranking"}, {"id":"saga","label":"Saga"},
        {"id":"gpu-scheduling","label":"GPU scheduling"}, {"id":"feature-serving","label":"Feature serving"}
        /* …full set enumerated at implementation time */
      ]},

    { "id": "difficulty", "label": "Difficulty", "authored": true, "single": true,
      "values": [{"id":"easy","label":"Warm-up"},{"id":"medium","label":"Core"},{"id":"hard","label":"Deep"}] },

    { "id": "company", "label": "Asked at", "authored": true, "multi": true,
      "note": "Extends data/tags.json's registry with AI-era and infra-heavy shops.",
      "values": ["google","meta","amazon","microsoft","apple","netflix","uber","stripe",
                 "openai","anthropic","airbnb","linkedin","tiktok","doordash","databricks","coinbase"] },

    { "id": "length", "label": "Length", "derived": "questions",
      "note": "Derived from the manifest questions count. ≤8 short · 9–10 medium · ≥11 long.",
      "values": [{"id":"short","label":"~8 min"},{"id":"medium","label":"~12 min"},{"id":"long","label":"~15 min"}] }
  ]
}
```

Manifest entries gain a `tags` block, exactly like main-app lessons:

```jsonc
{ "id": "p18", "num": 18, "title": "Design an Ad Click Aggregator", "questions": 10,
  "tags": { "difficulty": "hard",
            "mechanism": ["stream-processing","windowing","exactly-once","hot-keys"],
            "company": ["meta","google","tiktok"] } }
```

Filter semantics are the main app's: **AND across facets, OR within a facet**, via a
`tagMatch` predicate — same function shape as `renderSidebar()`'s.

---

## 5. Study plans — `data/system-design/plans.json`

This is the answer to "iterate through based on time crunch." Precedent is
`data/paths.json` (`kind:'lessons'` / `kind:'cram'`); plans reuse that idea rather
than inventing a parallel one.

```jsonc
{
  "__v": 1,
  "_comment": "Ordered subsets of design-problems with a declared time budget. Progress is keyed by unit id, NOT by plan — switching plans never resets mastery.",
  "plans": [
    { "id": "night-before", "icon": "bolt", "title": "Night Before",
      "budget": "~60 min", "mode": "crux",
      "blurb": "Six highest-frequency problems, crux questions only. The panic pass.",
      "units": ["p01","p02","p06","p08","p18","p21"] },

    { "id": "one-week", "icon": "target", "title": "One Week Core",
      "budget": "~4 hrs", "mode": "all",
      "blurb": "One problem per mechanism family. Broadest coverage per hour spent.",
      "units": ["p01","p02","p06","p18","p19","p12","p21","p09","p04","p15","p13","p23","p22","p25"] },

    { "id": "ai-sprint", "icon": "sparkle", "title": "AI Infra Sprint",
      "budget": "~90 min", "mode": "all",
      "blurb": "The category the classic canon predates. For AI-company loops.",
      "units": ["p23","p22","p30","p31"] },

    { "id": "primitives", "icon": "cube", "title": "Build the Box",
      "budget": "~2.5 hrs", "mode": "all",
      "blurb": "Design the infrastructure itself, not a product on top of it.",
      "units": ["p08","p12","p19","p20","p21","p29"] },

    { "id": "full-canon", "icon": "library", "title": "The Full Canon",
      "budget": "~12 hrs", "mode": "all",
      "blurb": "All 32 in curriculum order.",
      "units": "*" }
  ]
}
```

**Company plans are generated, not authored.** Any company with ≥4 tagged problems
renders an implicit plan ("Meta loop · 9 problems · ~2 hrs") built from the `company`
facet. Tagging one problem grows every relevant company set for free — that's the
payoff for surfacing company tags at all.

---

## 6. Navigation & UX

Constraints: mobile is 80% of use (PROFILE.md); `ds/components.css` primitives only;
`dsIcon()` not emoji in new chrome (D07); one `<h1>` per page; ≥44px tap targets.

### 6.1 Topic home (`#/design-problems`) — three zones

```
┌─────────────────────────────────┐
│ ‹ All topics                    │
│ Canonical Design Problems       │  ← hero: ring (question %), unit count, due
│ ◔ 34%   11 of 32 problems       │
│         148/295 questions       │
│         4 problems due          │
│ [ Continue: Ad Click Aggr. ]    │  ← resume (existing, relabelled)
├─────────────────────────────────┤
│ PICK A TIME BUDGET              │  ← NEW · horizontal scroll, .ds-card
│ ⚡Night Before  🎯One Week  ...  │     each: title · budget · ▓▓░ 2/6
├─────────────────────────────────┤
│ 🏷 Filter            (2 active) │  ← NEW · collapsible, .ds-section
│  Mechanism · Difficulty ·       │     AND across / OR within
│  Asked at · Length              │
├─────────────────────────────────┤
│ ── Streaming & Analytics ───    │  ← existing part-head, now 7 of them
│  9  Distributed Message Queue   │
│     ▓▓▓░░ 4/9  ·  Deep · Kafka  │  ← NEW tag row (max 3 chips on mobile)
│ 10  Ad Click Aggregator    2 due│
└─────────────────────────────────┘
```

- **Plan strip** collapses to a single active-plan row once a plan is running
  ("One Week Core · 6/14 · Resume →"), so it costs one line, not a carousel.
- **Filter active** → parts collapse into one flat ranked list with a count header and
  a Clear button, identical to the main app's merged Problems list under an active
  facet. Same code shape, same muscle memory.
- **Empty state** → `.ds-empty` with the narrowest offending facet named
  ("No Deep problems asked at Netflix — clear *Asked at*?").

### 6.2 Chapter card

Adds one meta line under the progress bar: **difficulty chip · top-2 mechanism chips ·
company count**. Mobile caps at 3 chips + "+2"; desktop shows all. Chips are
`.ds-chip`, tappable, and applying one filters in place.

### 6.3 Unit detail

Under **Key Ideas**, a new **Mechanisms** row of tappable chips. Tapping
`consistent-hashing` routes to `#/design-problems/tag/mechanism/consistent-hashing` —
the cross-family transfer surface, and the single highest-value thing tags buy us:
*"show me every problem that solves this the same way."*

### 6.4 Plan runner

Reuses the scoped-review pattern from `js/app/23-review.js` rather than inventing a
session shell — a HUD strip between topbar and stage:

```
One Week Core   ·   3/14   ·   Skip   ·   Exit
```

Advance on unit completion; `mode:"crux"` runs each unit's crux-only subset (the
`drill-crux` path already exists).

**Persistence (revised — review finding).** An earlier draft kept *all* plan
state in memory. That cannot hold: the plan must survive a refresh, and the main
app's Home lives on a different page entirely (§ 6.6), so an in-memory-only plan
is invisible the moment the user leaves `system-design.html`. Worse, SR entries
are keyed by unit and shared across overlapping plans, so nothing in the existing
store can say *which* plan was active.

Split it:

```jsonc
// persisted, schema-additive on jsdrill.systemdesign.v1
"activePlan": { "id": "one-week", "index": 6, "startedAt": 1754... }
```

Persist the plan id, the cursor, and the start time — enough to resume and to
render "One Week Core · 6/14" from a cold load on either page. The transient
question queue stays in memory and is rebuilt from `plans.json` + the cursor,
so nothing derived is stored twice. Completion is still *derived* from unit SR
state rather than tracked separately — progress belongs to the unit, not the
plan, which is what keeps switching plans from ever resetting mastery.

### 6.5 Routes

Extends `parseRoute`/`applyRoute`; every screen keeps publishing via `replaceState`.

| Route | Screen |
|---|---|
| `#/design-problems` | topic home *(existing)* |
| `#/design-problems/p18` | unit detail *(existing)* |
| `#/design-problems/mixed` | due-first review *(existing)* |
| `#/design-problems/plan/one-week` | **new** — run a plan |
| `#/design-problems/plan/company/meta` | **new** — generated company set |
| `#/design-problems/tag/mechanism/exactly-once` | **new** — filtered list, shareable |

### 6.6 Main-app Home

`_sdTopicStats` rolls up from manifest `questions` counts. That grain is correct
for the meter and for the due count, and Home already labels it honestly
("design cards", not "problems") — so no change is forced there. When a plan is
active, the System Design track card additionally shows **plan progress** —
"One Week Core · 6/14" is a more actionable number than "11/32" mid-plan — which
is what § 6.4's persisted `activePlan` exists to make readable across pages.

### 6.7 Unit mastery must be defined (review finding — SHIPPED)

The mockup above said "11 of 32", but `topicStats()` sums `chapterItems()`, i.e.
**questions**. On the live 21-problem topic the hero read *"0 of 193 mastered"* —
a number with no stated noun that looks like a problem count and isn't. Nothing in
the codebase defined unit mastery at all.

Fixed in `system-design.html`:

- `topicUnitStats(t)` — a unit is mastered when **every** one of its questions is,
  which is the same rule the chapter card's ✓ badge already applied. Reusing it
  means the hero and the card can never disagree.
- `unitNoun(t, n)` reads the manifest's own `unitLabel`, so design problems say
  "problems", DDIA says "chapters", and the other topics say "sections".
- The hero now leads with the unit count, keeps the question count as a labeled
  sub-line, and puts the unit noun on the due count too. The ring stays on the
  question percentage — it is the finer grain and gives honest partial credit,
  where a unit-grain ring would read 0% until a whole problem was finished.

Locked by `tools/cdp/sd-tags-nav.js` (4 assertions), which asserts the pattern
rather than the totals so it survives new content.

---

## 7. Validator changes (`tools/validate-system-design.js`)

1. `data/system-design/tags.json` parses; every facet has `id` + `label`.
2. Every `design-problems` manifest entry carries `tags` with **exactly one**
   `difficulty` and **≥2** `mechanism` values, all present in the registry.
3. `company` values validate against the registry (empty array allowed).
4. `parts[].chapters[]` covers every chapter **exactly once**. Line 202 already
   catches a chapter assigned to *no* part; it does not catch one listed in *two*,
   which would render the card twice. Re-parting 32 units by hand makes that a live
   risk, so add the duplicate check.
5. `displayNum` is contiguous `1..N` with no duplicates.
6. `plans.json`: every referenced unit exists; `mode ∈ {all, crux}`; `mode:"crux"`
   plans only reference units that actually have `crux:true` questions; `budget` present.
7. Existing infographic gates extend to the new units unchanged — **except** that a
   plan entry may carry `"pending": true`, which skips that unit's PNG file check and
   counts it instead of failing:

   ```jsonc
   "design-problems/p18": { "count": 4, "pending": true, "graphics": [...] }
   ```

   Reported in the summary line — `System Design validation OK — 32 units, 4 pending
   artwork, 0 errors` — so pending art is visible, never silent. ~10 lines.

   **The flag ships but is deliberately unused (owner decision, 2026-08-02).** The
   repo owner wants a missing PNG to be a hard failure, so the red validator *is*
   the artwork to-do list. The mechanism stays available if that call is ever
   reversed. What this makes mandatory instead is that **every other error class
   stays at zero** — a red gate is only a usable to-do list if nothing else is
   hiding inside it. `tools/list-pending-infographics.js` exists for exactly that
   reason: it separates "missing artwork" from "actually broken".

---

## 8. Phasing

Five phases, each independently shippable.

**Revised ordering (review finding).** The original plan put P2 (plans) before the
content phases, while `plans.json` referenced `p18`–`p31` — units that would not
exist yet. Validator rule 6 requires every referenced unit to exist, so P2 could
not have been both "independently shippable" and green as written. Rather than add
a placeholder mechanism for units that are only weeks away, **content now lands
before plans**: P2 moves after the content phases and composes plans only from
units that exist. Executed order is therefore **P1 → P3 → P4 → P5 → P2**.

That also avoids authoring `plans.json` twice — a plan set built over 17 problems
would have needed rewriting the moment 15 more arrived.

The one caveat this ordering accepts: from P3 onward the validator is red on
artwork (§ 7 rule 7), so "leaves the validator green" holds for every gate except
`system design`. Every other gate stays green in every phase.

| Phase | Deliverable | New content? | Gate |
|---|---|---|---|
| **P1 — Taxonomy & tags** ✅ | Re-part the existing 17 into 5 families; `displayNum`; author tags on all 17; `tags.json`; filter panel; chip rows; tag routes; validator rules 1–5; unit-level rollup (§ 6.7) | none | ✅ all gates green · `sd-tags-nav.js` 39/39 |
| **P3 — Tier 1A content** ✅ | `p18` Ad Click Aggregator · `p19` Message Queue · `p21` Key-Value Store · `p22` LLM Inference — adds the *Streaming & Analytics* and *AI & ML Infrastructure* families | 4 problems | 7 of 8 gates green; `system design` red on 16 pending sheets |
| **P4 — Tier 1B content** | `p23` RAG · `p20` Job Scheduler · `p24` Proximity · `p25` Search Engine | 4 problems | ″ |
| **P5 — Tier 2 content** | `p26` Observability · `p27` Live Streaming · `p28` Short-Form Video · `p29` Webhooks · `p30` Feature Store · `p31` Moderation · `p32` Auth/SSO | 7 problems | ″ |
| **P2 — Plans** *(moved last)* | `plans.json`; plan strip; plan runner + persisted `activePlan` (§ 6.4); plan routes; generated company sets; validator rule 6 | none | new `tools/cdp/sd-plans.js` |

**P1 shipped real value with zero authoring** — the 17 existing problems became
searchable by mechanism, difficulty and company, and the shelf finally teaches
something. It stands on its own if the content phases stall.

P2 moving last is the direct consequence of the sequencing finding above: plans are
cheap to author once, expensive to author twice, and cannot reference units that do
not exist.

P3 is deliberately one problem per weak/new family: it proves the authored arc *and*
the infographic pipeline on genuinely unfamiliar material before committing to eleven
more.

---

## 9. Cost, verified findings & risks

### 9.1 Verified after first draft — two corrections

**The rendering pipeline is not a blocker.** Inkscape 1.2.2 and ImageMagick 6.9.12
install cleanly in the container, and a full regen of every registered set produced
**0 of 88 PNGs changed** — the pipeline is byte-reproducible here. `renderSvg()` is
one generic 194-line template driven entirely by the authored JSON, so a new problem
needs **zero generator code**. (The install is not persistent — the container is
ephemeral — so it should be scripted before it matters.)

**But `diagram-v1` does not reach the quality bar.** The hand-authored `p01/overview`
sheet renders a real topology: components, a four-style path legend (create / redirect
/ event / cache-miss) traced through the diagram, numbered callouts pinned to the
wires, and a priorities → optimizations / trade-offs / failure-focus footer.
`diagram-v1` renders a **vertical card list** — four decorative, interchangeable icons
on a dashed snake, then flow / numbers / priorities / trade-off cards. No components,
no request paths, no arrows between services. It teaches a list; the pilot teaches a
system.

**And the compiler-authored source behind the 61 generated sheets carries real
defects.** From `design-problems/p02/overview` — currently live:

```jsonc
"priorities": ["Fan-out-on-read (pull) assembles the feed",   // truncated fragment
               "A Twitter/Facebook-style home feed that",      // truncated fragment
               "Non-functional"]                               // a label, not a priority
"tradeoffs[1]": "A Twitter/Facebook-style home feed that shows each user a merged,
                 ranked stream…"                               // the lesson summary
"numbers":     Demand = "peak QPS", Data = "items/day × bytes" // placeholders
```

This is the exact failure `INFOGRAPHIC-AUTHORING.md` documents — "step titles were the
detail text truncated mid-sentence", "flow titles duplicated the paragraph beside
them" — and for which DDIA and Building Blocks were **reverted** to single sheets.
Design Problems has the same defect and shipped. **61 sheets are live with it.**

**Decision (2026-08-02): artwork for the 15 new problems is hand-drawn PNG, produced
out-of-band, matching the `p01` grammar.** They register with `renderer` omitted, so
`generate:infographic-sets` preserves them — already a first-class path, 10 sheets work
that way today. `diagram-v1` is not used for new problems.

The only hard contract the art must meet is the validator's: each sheet lands at
`assets/system-design/infographics/design-problems/<pNN>/<graphic-id>.png` at **exactly**
the width×height registered in `infographic-sets.json`, with ids and order matching
`infographic-plan.json`. Everything else — sheet count, composition, what each sheet
teaches — is authored as text first (§ "Author text before pixels") and handed over as
the brief.

*(Remediating the 61 defective sheets is out of scope here and needs its own decision:
regenerate from hand-fixed source, convert to hand-authored, or defer.)*

### 9.2 Cost

**Per new problem:** ~20–30 KB JSON (8–11 questions on the authored arc,
`keyTakeaways`, 4 architecture diagrams) + `infographic-plan.json` entry +
`infographic-sets.json` set of 3–5 sheets + rendered PNGs at exact dimensions.
15 problems ≈ **400 KB of authored content and ~55 new PNGs**.

**Risks:**

- **Artwork throughput, not tooling.** Rendering is solved (§9.1); *authoring ~55
  sheets to the `p01` bar* is the real constraint. The `pending` flag (§7 rule 7)
  decouples it from content so neither blocks the other.
- **Re-parting churn.** P1 rewrites `parts[]` and touches all 17 manifest entries. Ids
  and files are untouched, so SR progress, deep links and infographic keys are safe —
  but it should land as one atomic commit with the `displayNum` change.
- **Mechanism vocabulary drift.** 24+ mechanism values invites near-synonyms
  (`work-queue` vs `task-queue`). The registry is closed and validator-enforced;
  adding a value is a deliberate append.
- **Emoji in chrome.** `system-design.html` currently uses emoji CTAs (`⚡ Mixed
  review`) — pre-existing D07 debt. New chrome uses `dsIcon()`; converting the legacy
  CTAs is optional cleanup, not part of this proposal.

**Open question for the user:** P5's seven are genuinely Tier 2 — real but lower
frequency. If effort is constrained, stopping after P4 yields 25 problems with all
three content gaps closed, and P5 becomes opportunistic.

---

## 10. Recommendation

Ship **P1 first**, on its own. It is the highest ratio of learner value to authoring
effort in the whole proposal, it de-risks everything after it, and it makes the case
for the content phases visible — an empty "Streaming & Analytics" family with a `0/3`
bar is a far better argument for authoring `p18` than a paragraph in a doc.
