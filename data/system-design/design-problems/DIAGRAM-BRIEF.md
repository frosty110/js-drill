# Diagram Authoring Brief (Mermaid)

You are adding diagrams to canonical system-design problems. Diagrams are authored as
**Mermaid text** (rendered to SVG in the browser) so they're diffable and theme-matched.

For each problem you produce TWO Mermaid diagrams:
1. **Architecture** — a `flowchart` (component view: client → LB → services → stores/queues).
2. **Request flow** — a `sequenceDiagram` of the core write path and/or read path.

## Output — write to a temp file per problem

Write `data/system-design/design-problems/_diagrams/pNN.json` containing ONLY:

```json
{
  "arch": "flowchart LR\n  ...",
  "flow": "sequenceDiagram\n  ...",
  "flowIdx": 3
}
```

- `arch`  — the architecture flowchart Mermaid source (as a JSON string; use `\n` for newlines).
- `flow`  — the request-flow sequenceDiagram Mermaid source.
- `flowIdx` — the 0-based index, in that problem's `questions[]` array, of the **high-level
  architecture** question (the open question that asks to describe the architecture / data
  model). Read the file to find it. The flow diagram will be shown when that question is revealed.

## Mermaid rules (MUST render without error — keep it simple)

- Start with `flowchart LR` (or `TD`) / `sequenceDiagram`.
- **Keep it small: ≤ 8 nodes** for the flowchart (mobile legibility). Focus on the load-bearing
  components; don't diagram every detail.
- **Quote any node label that contains spaces or punctuation**: `A["App / API tier"]`. Use
  `<br/>` for a line break inside a quoted label. Do NOT put unquoted `()`, `[]`, `:`, `/`, `,`
  inside labels — either quote the whole label or omit the punctuation.
- Node shapes: `[box]`, `([rounded])`, `[(database cylinder)]`, `[[queue/subroutine]]`, `{decision}`.
- Edge with label: `A -->|"cache hit"| B`  (quote labels with punctuation). Dotted: `A -.->|async| B`.
- Sequence: `participant C as Client` then `C->>API: POST /shorten`, `API-->>C: 200 shortUrl`,
  `API->>DB: INSERT ...`. Keep to the essential 4–8 messages; show the interesting path
  (e.g., cache miss → DB, or the write path that assigns an ID).
- Do NOT use Mermaid features beyond flowchart + sequenceDiagram. No click handlers, no styling
  directives, no `subgraph` unless essential.

## Content

The diagram must reflect THIS problem's real architecture (read the file's `summary`,
`keyTakeaways`, and questions). Examples:
- URL shortener: Client → LB → App → (Redis cache, KV store, Key-Gen Service); flow = read path
  (cache hit/miss → DB) or write path (allocate code → store).
- Ride-sharing: Rider/Driver apps → Gateway → (Location service + in-memory geo index, Matching
  service, Trip service + DB); flow = driver location update + rider request → match.
- Payments: Client → API (idempotency key) → Ledger service (double-entry DB) → external gateway;
  flow = auth → capture with idempotency.

Verify your `_diagrams/pNN.json` is valid JSON. Report the files you wrote.
