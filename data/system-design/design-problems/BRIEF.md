# Canonical Design-Problem Authoring Brief

You are authoring **worked system-design interview problems** as ordered,
active-recall walkthroughs. Each problem is ONE unit file. The learner drills it
as a sequence of "explain & apply" prompts (say your answer out loud → reveal
model answer + rubric → self-grade) interleaved with a few multiple-choice checks
on the crux decisions. This is for a STAFF / SENIOR STAFF candidate.

READ FIRST: `/home/user/js-drill/data/system-design/OPEN-QUESTION-BRIEF.md`
(open-question schema) and one existing MC file like
`/home/user/js-drill/data/system-design/ddia/ch03.json`.

## File schema — `data/system-design/design-problems/pNN.json`

```jsonc
{
  "id": "p01",
  "num": 1,
  "part": "<verbatim part name — see per-problem assignment>",
  "title": "Design a URL Shortener",
  "summary": "1–2 sentences: what the system is and the signature challenge.",
  "keyTakeaways": [               // 4–7 crux decisions a strong candidate lands
    "Encode an auto-increment ID in base62 for short, collision-free codes.",
    "..."
  ],
  "brief": {                      // REQUIRED — the whiteboard state (see below)
    "functional": ["3–5 bullets: what you're building, plus explicit out-of-scope"],
    "scale": ["3–6 bullets: the givens, the headline derived numbers, the dominant constraint"],
    "gate": [0, 1]                // question indices whose OWN answer is the brief
  },
  "questions": [ /* ORDERED walkthrough — see arc below */ ]
}
```

## `brief` — the context an interleaved session can't rebuild

Most prompts in the arc below never name their own system ("Estimate the scale…",
"Sketch the high-level architecture…") because they were authored to be read in
order, after Q1 scoped the problem. A mixed or due session shuffles across units
and can serve any one of them cold, where they're unanswerable.

`brief` is what a real interviewer states up front: the scoped functional
requirements and the scale constants. The drill shows it as a collapsed
"Requirements & scale" disclosure under the stem — retrieval first, numbers on
one tap — and the static share page prints it in full.

- Write it from Q1's `points` and Q2's `answer`; it is a restatement of what the
  arc already establishes, not new content.
- Keep bullets one line each. This is read on a phone.
- `gate` lists the question indices where the brief would BE the answer — the
  scope and estimate steps, so `[0, 1]` for every problem authored to this arc.
  There it's hidden until the reveal, then shown beside the model answer.
  Indices are positional, which the append-only content rule keeps stable.

## The ordered arc (author questions IN THIS ORDER — the drill plays them in sequence)

Author **8–11 questions per problem**, mostly `type:"open"` phases with **2–3
`type:"mc"`** crux checks mixed in at the natural decision points:

1. **open — Requirements & scope**: functional requirements (core features/APIs) +
   non-functional (scale, latency, consistency/availability, read:write ratio).
   The `points` rubric should list what a strong candidate clarifies.
2. **open — Capacity estimation**: worked back-of-envelope — DAU → QPS (read & write,
   peak), storage/yr, bandwidth. Put real illustrative numbers in the `answer`.
3. **open — API design**: the core endpoints/signatures.
4. **open — High-level architecture + data model**: components (LB, app tier, cache,
   DB, queue, blob store as relevant) + the key schema/table(s).
5. **mc — crux decision #1**: the signature choice for THIS problem (see hints),
   4 options, one right, teaching `explain`.
6. **open — Deep dive #1**: the hard part unique to this problem (the reason it's
   a classic). This is the most important question in the set.
7. **mc or open — Deep dive #2 / bottleneck**: a second hard sub-problem.
8. **open — Scale, failure modes & tradeoffs (staff+ signal)**: what breaks at scale,
   hot spots, multi-region, consistency tradeoffs, alternative designs, and how you'd
   evolve it. This is where senior-staff judgment shows.

You may add 1–2 extra deep-dive questions for richer problems (cap ~11).

## Quality bar

- **Correct and specific.** Use real techniques and real numbers. Distractors on MC
  come from adjacent real designs (e.g. "UUID" vs "base62 of auto-increment ID" vs
  "hash + collision retry" vs "MD5 truncated"). No filler options.
- **`points`** = a checkable rubric (3–6 bullets) — what the spoken answer must hit.
- **`answer`** = a tight model answer a strong candidate would actually say (2–5
  sentences; estimation answers may be a touch longer to show the math).
- Vary MC correct-answer indices across a problem. Exactly 4 unique options each.
- Valid JSON (escape quotes/backslashes; `\n` for newlines; inline code in `backticks`).

Before finishing: verify each file parses, then report file paths + per-file
(open/MC) counts.
