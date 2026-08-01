# Design-Problem Diagram Authoring Brief (Mermaid)

Canonical design problems use **small diagrams-as-code** rendered to SVG in the
browser. Every visual should teach one architectural decision and remain legible
on a 390px phone.

## Required architecture deck

Every `pNN.json` carries exactly four unit-level diagrams in `diagrams[]`:

1. **Overview** — the load-bearing components and stores.
2. **Signature mechanism** — the decision that makes this problem a classic.
3. **Scale or request path** — the hot read/write path or partitioning shape.
4. **Failure / consistency** — the dangerous race, outage, or recovery path.

Each diagram is attached to the most relevant revealed answer with the
zero-based `afterQuestion` index. The unit detail screen also exposes all four as
a swipe-sized visual deck with previous/next and Hide labels / Reveal labels.

```jsonc
{
  "diagrams": [
    {
      "id": "architecture-overview",
      "title": "High-level architecture",
      "kind": "mermaid",
      "role": "overview",
      "takeaway": "The redirect path is cache-first; analytics stays asynchronous.",
      "afterQuestion": 3,
      "code": "flowchart LR\n  ..."
    }
  ]
}
```

Allowed `role` values:

- `overview`
- `request-flow`
- `mechanism`
- `comparison`
- `failure`
- `lifecycle`

Question-level `diagram` remains supported for focused request-flow sequence
diagrams. The renderer is backward compatible with singular unit-level
`diagram`, but all canonical design problems must use the four-item deck.

## Content rules

- One diagram, one sentence. Put that sentence in `takeaway`.
- Prefer 3–7 nodes; use at most 8 unless the overview genuinely needs more.
- Show only components needed to explain the named decision.
- Put the diagram on the answer that explains it; `afterQuestion` must reference
  a valid `questions[]` index.
- Use architecture nouns for nodes and short mechanism phrases for edge labels.
- Do not repeat the full overview four times. Each view should add a different
  mental model.

Examples of signature mechanisms:

- URL shortener: code generation and the cache-first redirect path.
- News feed: hybrid push/pull fan-out.
- Ride sharing: geo partitioning and an atomic driver claim.
- Payments: idempotency, double-entry ledger, and reconciliation.
- Ticket booking: atomic timed holds and waiting-room admission.

## Mermaid rules

- Start with `flowchart LR`, `flowchart TD`, or `sequenceDiagram`.
- Quote node labels containing spaces or punctuation: `A["App / API tier"]`.
- Use simple shapes: `[box]`, `([rounded])`, `[(database)]`, `[[queue]]`,
  `{decision}`.
- Quote descriptive edge labels: `A -->|"cache hit"| B`.
- Keep sequence diagrams to essential participants and 4–8 messages.
- Do not use click handlers, styling directives, `classDef`, initialization
  directives, or large subgraphs.

## Verification

Run:

```bash
node tools/validate-system-design.js
```

The validator checks schema, unique IDs, roles, safe Mermaid syntax, the exact
four-diagram requirement, and valid question placement. Also parse or render all
Mermaid source with Mermaid 11 before shipping.
