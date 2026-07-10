# Open ("Explain & Apply") Question Schema

Open questions test **generation, not recognition** — the learner reads the prompt,
says/writes their answer out loud (interview realism), then reveals a model answer +
key points and self-grades. This is the recognition→generation jump that MC can't test.

## Object schema (one entry in an `openQuestions` array, or a `type:"open"` item)

```jsonc
{
  "type": "open",
  "prompt": "An interview-style ask: 'Explain X', 'When would you pick A over B, and why?', 'Walk through how Y handles failure Z.' 1–2 sentences.",
  "points": [
    "3–6 bullet KEY POINTS the answer must hit — this is the self-grading rubric.",
    "Each a specific, checkable claim (not vague).",
    "Ordered as you'd build the answer."
  ],
  "answer": "A tight 2–4 sentence model answer that ties the key points into how a strong candidate would actually say it out loud."
}
```

## Quality bar

- **Prompt** must require *applying* a concept, not reciting a definition. Prefer
  "why / when / how / what breaks if…" over "what is…". Interview-flavored.
- **points** are the grading rubric — specific and checkable. A learner should be
  able to tick each one against what they said.
- **answer** models a real spoken interview answer: crisp, tradeoff-aware, no fluff.
- Precision matters (same DDIA precision rules as the MC brief — don't conflate
  linearizability/serializability, 2PC/consensus, etc.).
- No code execution. Plain strings; inline terms in `backticks`.
