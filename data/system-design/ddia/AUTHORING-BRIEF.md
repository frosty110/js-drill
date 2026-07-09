# DDIA MC Authoring Brief

You are authoring **multiple-choice memorization questions** for a study tool covering
Martin Kleppmann's *Designing Data-Intensive Applications* (DDIA). This is a **conceptual
recall** tool — there is NO code execution. Questions test whether the reader has
internalized the book's load-bearing ideas, definitions, tradeoffs, and mechanisms.

## File to produce

One JSON file per chapter at `data/system-design/ddia/chNN.json` (zero-padded, e.g. `ch03.json`).

## Exact schema

```jsonc
{
  "id": "ch03",                       // "ch" + zero-padded chapter number
  "chapter": 3,                       // integer
  "part": "Part I: Foundations of Data Systems",   // see part names below
  "title": "Storage and Retrieval",   // official chapter title
  "summary": "1–2 sentence framing of what the chapter is about.",
  "keyTakeaways": [                   // 4–7 crisp one-liners — the things to remember
    "Log-structured storage (LSM-trees) turns random writes into sequential appends.",
    "..."
  ],
  "questions": [
    {
      "q": "Question stem — a single clear question ending in '?'",
      "options": ["option A", "option B", "option C", "option D"],  // EXACTLY 4
      "answer": 2,                    // 0-based index of the correct option
      "explain": "1–2 sentences: why the answer is right AND ideally why the tempting distractor is wrong."
    }
  ]
}
```

## Volume

- **12–14 questions per chapter.**
- `keyTakeaways`: 4–7 entries.

## Part names (use verbatim)

- Ch 1–4  → `"Part I: Foundations of Data Systems"`
- Ch 5–9  → `"Part II: Distributed Data"`
- Ch 10–12 → `"Part III: Derived Data"`

## Question-quality bar (STRICT — this is what makes it a good memorization tool)

1. **Test load-bearing ideas**, not trivia. Good targets: definitions of core terms,
   the tradeoff a technique makes, the failure mode it addresses, when to pick A over B,
   the mechanism behind a guarantee. Avoid author-name/page-number trivia.
2. **Exactly 4 options.** One unambiguously correct.
3. **Distractors must be plausible and specific** — a knowledgeable-but-fuzzy reader
   should be tempted. Draw distractors from *adjacent real concepts in the book*
   (e.g. for an LSM-tree question, use B-tree properties as distractors). NEVER use:
   - tautology/filler options ("It depends", "None of the above", "All of the above")
   - obvious nonsense or joke options
   - invented terminology or fake systems
   - restatements of the correct answer
4. **Vary the correct-answer index** across the chapter (don't make it always 0 or 2).
5. **`explain` is mandatory** and should teach — state the reason, and when useful,
   name why the runner-up distractor is wrong. Keep it to 1–2 sentences.
6. **Precision matters.** DDIA has exact facts (e.g. "read repair" vs "anti-entropy",
   "LSM-tree write amplification vs B-tree", "linearizability = recency guarantee on a
   single object", "serializability = transactions behave as if serial"). Get them right.
   Do not conflate linearizability (single-object recency) with serializability
   (multi-object transaction isolation). Do not conflate 2PC (atomic commit) with
   consensus/Paxos/Raft (though the chapter notes their relationship).
7. Write `q`, options, and `explain` as plain strings. Inline code/terms can be wrapped
   in backticks (the renderer styles `` `code` ``). Use `\n` only if genuinely needed.

## Style

- Concise, exam-like stems. Prefer "Which statement about X is correct?" or
  "What problem does Y primarily solve?" or "In DDIA's terms, X means…".
- Interview-relevant framing where natural (this reader is prepping for system-design
  interviews), but the source of truth is the book's content.

## Before you finish

- Validate your JSON parses (no trailing commas, escaped quotes/backslashes).
- Re-read each question: is the keyed answer actually correct per DDIA? Is exactly one
  option defensible? Are the 3 distractors plausible but wrong?
- Report the file paths you wrote and the question count per chapter.
