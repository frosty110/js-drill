# System Design Reading List

A curated corpus of **38 primary-source posts** for authoring system-design content.
Every URL was fetched and verified (2026-08-05). Listicles, course landing pages, and
Medium reposts are deliberately excluded except where noted — the point is engineers
describing decisions they actually made, with the numbers.

Each entry carries a **→ lands in** tag naming the app surface it can feed, so this file
is a work queue, not just a bookmark dump.

**Tag legend** — `ddia/chNN` · `design-problems/pNN` · `components/catalog` ·
`interview-method/sNN` · `NEW` (no home yet)

---

## A. Foundations — the operational patterns (11)

The Amazon Builders' Library is the single densest free source on *why* distributed
systems fail in production. Each article is one pattern, written by a principal engineer,
with the failure mode that motivated it. Most of the app's `ddia/ch08` material is theory;
these are the practice.

| # | Post | What it actually teaches | → lands in |
|---|---|---|---|
| 1 | [Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) | Why every remote call needs *both* connection and request timeouts; capped exponential backoff; why jitter is non-optional (retry storms synchronize without it). | `ddia/ch08` |
| 2 | [Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) | The precondition that makes retry safe at all. Pairs with #22/#23. | `ddia/ch12`, `components` |
| 3 | [Using load shedding to avoid overload](https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/) | Rejecting work as a *reliability* feature — the counterintuitive move that keeps goodput up when a queue is already underwater. | `NEW` |
| 4 | [Workload isolation using shuffle sharding](https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding/) | Blast-radius math: hash each customer to a small random subset of queues so one abuser can't take down everyone. | `components/catalog` |
| 5 | [Avoiding insurmountable queue backlogs](https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/) | What happens when drain rate < arrival rate and the backlog can never clear. The queue chapter the app doesn't have. | `NEW` |
| 6 | [Caching challenges and strategies](https://aws.amazon.com/builders-library/caching-challenges-and-strategies/) | Modality/coherence choices, and why a cache changes your failure profile (cold-start stampede, bimodal behavior). | `components/catalog` |
| 7 | [Static stability using Availability Zones](https://aws.amazon.com/builders-library/static-stability-using-availability-zones/) | Pre-provision so the *recovery path* doesn't depend on the thing that just broke. The best single argument against "just autoscale". | `NEW` |
| 8 | [Reliability, constant work, and a good cup of coffee](https://aws.amazon.com/builders-library/reliability-and-constant-work/) | Constant-work designs that behave identically under normal and failure load — no scaling cliff at the worst moment. | `NEW` |
| 9 | [Challenges with distributed systems](https://aws.amazon.com/builders-library/challenges-with-distributed-systems/) | The taxonomy (offline / soft real-time / hard real-time) and why the third is brutally hard. Good `ch08` companion. | `ddia/ch08` |
| 10 | [Implementing health checks](https://aws.amazon.com/builders-library/implementing-health-checks/) | Liveness vs dependency vs deep health checks, and how a naive deep check cascades a whole fleet out of service. | `components/catalog` |
| 11 | [Leader election in distributed systems](https://aws.amazon.com/builders-library/leader-election-in-distributed-systems/) | Practical framing of what `ch09` teaches formally — fencing tokens, lease expiry, the two-leaders window. | `ddia/ch09` |

**Also worth standing subscriptions**, not single posts:
[Marc Brooker's blog](https://brooker.co.za/blog/) (AWS principal; the sharpest writing on
consistency, retries, and queueing theory anywhere),
[Werner Vogels — All Things Distributed](https://www.allthingsdistributed.com/),
[Martin Fowler — Patterns of Distributed Systems](https://martinfowler.com/articles/patterns-of-distributed-systems/)
(a genuinely catalogued pattern language — write-ahead log, quorum, lease, HLC, generation clock),
and [microservices.io patterns](https://microservices.io/patterns/index.html) (saga, outbox,
API composition — the durable-workflow vocabulary DDIA 2e adds).

---

## B. Real architecture case studies (13)

These are the ones with numbers in them. Each is a decision under a constraint, which is
what the `design-problems` track drills.

| # | Post | What it actually teaches | → lands in |
|---|---|---|---|
| 12 | [Discord — How Discord stores trillions of messages](https://discord.com/blog/how-discord-stores-trillions-of-messages) | Cassandra → ScyllaDB migration at 177 nodes. GC pauses as the root cause of tail latency; shard-per-core; a Rust "data services" layer doing **request coalescing** to collapse hot-partition fan-in. The best single case study on hot partitions. | `ddia/ch06`, `design-problems` |
| 13 | [Notion — Building and scaling Notion's data lake](https://www.notion.com/blog/building-and-scaling-notions-data-lake) | 32→96 Postgres shards, then Debezium CDC → Kafka → Spark/Hudi because the warehouse couldn't keep up with an update-heavy block graph. Data doubles every 6–12 months. | `ddia/ch11`, `NEW` |
| 14 | [Figma — How Figma's databases team lived to tell the scale](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/) | 100× growth. Vertical partitioning by table group *first*, horizontal sharding later — the sequencing lesson most sharding posts skip. | `ddia/ch06` |
| 15 | [Figma — DBProxy, Figma's horizontal sharding proxy](https://www.figma.com/blog/dbproxy-figmas-horizontal-sharding-proxy/) | Query routing across shard keys (user/file/org) without rewriting the app. Concrete answer to "how does the app find the right shard?". | `ddia/ch06` |
| 16 | [Uber — Real-time exactly-once ad event processing](https://www.uber.com/en-US/blog/real-time-exactly-once-ad-event-processing/) | Kafka + Flink + Pinot + Hive. Two-phase commit, `read_committed`, per-record UUIDs as **idempotency keys**, Pinot upsert for dedup. Exactly-once made concrete on a billing path. | `ddia/ch11`, `ch12` |
| 17 | [Netflix — Edge authentication & token-agnostic identity propagation](https://netflixtechblog.com/edge-authentication-and-token-agnostic-identity-propagation-514e47e0b602) | Terminate auth at the edge, propagate an internal identity object. The pattern behind every "how does auth work in microservices" question. | `design-problems`, `components` |
| 18 | [Netflix — Timestone priority queueing](https://netflixtechblog.com/timestone-netflixs-high-throughput-low-latency-priority-queueing-system-with-built-in-support-1abf249ba95f) | Redis+Lua for atomic ops; priority queues with non-parallelizable workloads. A queue design that isn't just "use SQS". | `components/catalog` |
| 19 | [Netflix — Data Mesh: a data movement and processing platform](https://netflixtechblog.com/data-mesh-a-data-movement-and-processing-platform-netflix-1288bcab2873) | CDC-driven managed pipelines — DDIA ch11/ch12's "derive everything from the log" as a real platform. | `ddia/ch12` |
| 20 | [Netflix — Scaling the API with GraphQL Federation](https://netflixtechblog.com/how-netflix-scales-its-api-with-graphql-federation-part-1-ae3557c187e2) | Federated graph over independently-owned services. **Directly fills the GraphQL gap** — today GraphQL appears in the app only as a wrong answer in `ddia/ch02`. | `ddia/ch02`, `NEW` |
| 21 | [Netflix — TimeSeries data abstraction layer](https://netflixtechblog.com/introducing-netflix-timeseries-data-abstraction-layer-31552f6326f8) | An abstraction over storage engines with per-namespace tuning — the "one API, many engines" idea DDIA 2e leans into. | `ddia/ch03` |
| 22 | [Stripe — Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency) | The canonical idempotency-key post. Store the status code + body of the first request under the key and replay it. | `design-problems`, `components` |
| 23 | [brandur — Implementing Stripe-like idempotency keys in Postgres](https://brandur.org/idempotency-keys) | The same idea at schema-and-transaction level: atomic phases, recovery points, what to do when the process dies mid-flight. Rare: an actual implementation, not a diagram. | `design-problems` |
| 24 | [Cloudflare — Workflows GA: production-ready durable execution](https://blog.cloudflare.com/workflows-ga-production-ready-durable-execution/) | Durable execution as a primitive — persist state per step, resume after failure. The **workflows** half of DDIA 2e's derived-state chapter. | `NEW`, `components/catalog` |

---

## C. AI system design — infrastructure (7)

| # | Post | What it actually teaches | → lands in |
|---|---|---|---|
| 25 | [System Design Handbook — AI System Design](https://www.systemdesignhandbook.com/guides/ai-system-design/) | *(the one you sent)* Decent taxonomy: data pipeline → feature store → training → registry → inference, plus semantic caching, drift detection, offline-vs-online split. Names orchestrator-worker, ReAct, ToT/GoT and short/long-term memory. **Caveat: it's a course landing page** — the taxonomy is a good skeleton, but every item below teaches it deeper. | `NEW` |
| 26 | [vLLM — Inside vLLM: anatomy of a high-throughput inference system](https://blog.vllm.ai/2025/09/05/anatomy-of-vllm.html) | The best free explanation of LLM serving. PagedAttention (KV cache in non-contiguous blocks, waste 60–80% → <4%), continuous batching, chunked prefill, prefix caching. Inference is **memory-bandwidth bound, not compute bound** — the single most load-bearing fact in AI capacity planning. | `NEW` |
| 27 | [Anyscale — Continuous batching for LLM inference](https://www.anyscale.com/blog/continuous-batching-llm-inference) | Why static batching wastes a GPU (you wait for the longest sequence). Measured 23× throughput. The clearest before/after on the idea. | `NEW` |
| 28 | [Spotify — Introducing Voyager, our nearest-neighbor search library](https://engineering.atspotify.com/2023/10/introducing-voyager-spotifys-new-nearest-neighbor-search-library) | ANN in production at a company that isn't a vector-DB vendor. In-memory index → stateless K8s deployment; the recall/latency/memory triangle stated honestly. | `NEW`, `components/catalog` |
| 29 | [Vespa — Semantic search with multi-vector HNSW indexing](https://blog.vespa.ai/semantic-search-with-multi-vector-indexing/) | HNSW mechanics (hierarchical graph, O(log n) vs O(n) brute force) and multi-vector-per-document, which is what real chunked-document retrieval needs. | `NEW` |
| 30 | [eugeneyan — Patterns for building LLM-based systems & products](https://eugeneyan.com/writing/llm-patterns/) | Seven patterns: **evals, RAG, fine-tuning, caching, guardrails, defensive UX, collect user feedback.** The best single map of the LLM-product design space. | `NEW` |
| 31 | [Hamel Husain — LLM evals FAQ](https://hamel.dev/blog/posts/evals-faq/) | Evals as the actual bottleneck. Error analysis before metrics; why generic eval dashboards don't work; LLM-as-judge alignment. The antidote to vibes-based AI engineering. | `NEW` |

Standing sources: [eugeneyan/applied-ml](https://github.com/eugeneyan/applied-ml) and
[applyingml.com/papers](https://applyingml.com/papers/) — hundreds of company ML-in-production
write-ups, indexed by problem type.

---

## D. Agentic design patterns for decision making (7)

This is the section you flagged. The handbook page (#25) names three patterns; these
name the full ladder **and the selection rule**, which is the part that matters.

| # | Post | What it actually teaches | → lands in |
|---|---|---|---|
| 32 | [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | **The canonical taxonomy.** Five *workflows* (prompt chaining · routing · parallelization {sectioning, voting} · orchestrator-workers · evaluator-optimizer) vs one *agent* (tool loop on environmental feedback). The decision rule: **workflow when you can predict the number of steps; agent when you can't hardcode the path.** Start with the simplest thing that works. | `NEW` |
| 33 | [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) | Orchestrator-worker in production, with the economics stated plainly: agents ≈ **4× chat tokens, multi-agent ≈ 15×**, and token usage alone explains ~80% of task-success variance. Delegation needs objective + output format + tool guidance + task boundaries or subagents duplicate work. Scaling rules embedded in the prompt. Parallelism cut research time up to 90%. | `NEW` |
| 34 | [Anthropic — Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | Context as a **finite attention budget** (n² token relationships → recall degrades with length). Four techniques: compaction, structured note-taking (external memory), sub-agent context isolation, just-in-time retrieval via lightweight identifiers. | `NEW` |
| 35 | [Anthropic — Writing effective tools for AI agents](https://www.anthropic.com/engineering/writing-tools-for-agents) | Tool design *is* interface design for a non-deterministic caller: minimize overlap, return token-efficient results, make ambiguity impossible. Bad tools burn context through failed exploration. | `NEW` |
| 36 | [OpenAI — A practical guide to building agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf) *(PDF)* | 32 pages. Model/tools/instructions decomposition; **start single-agent, escalate to multi-agent only when complexity demands**; the two orchestration shapes — **manager** (central orchestrator delegates) vs **decentralized handoff** (agents transfer control peer-to-peer). Plus guardrail layering. | `NEW` |
| 37 | [Chip Huyen — Agents](https://huyenchip.com/2025/01/07/agents.html) | The most rigorous single treatment. Tools in three classes (knowledge augmentation / capability extension / **write actions** — the risk boundary). **Decouple plan generation from execution**: generate → validate by heuristic or judge → execute only approved plans. Failure taxonomy: planning / tool / efficiency. | `NEW` |
| 38 | [Phil Schmid — Zero to One: learning agentic patterns](https://www.philschmid.de/agentic-pattern) | Compact pattern-by-pattern reference with the workflow/agent line drawn the same way, framed as *what decision does each pattern make*. Good as the drill-authoring skeleton. | `NEW` |

**Secondary but useful:**
[Dapr Agents — agentic patterns](https://docs.dapr.io/developing-ai/dapr-agents/dapr-agents-patterns/)
(same patterns as runtime primitives — durable, restartable agent workflows),
[LangChain — What is a cognitive architecture?](https://www.langchain.com/blog/what-is-a-cognitive-architecture)
(the autonomy ladder: hardcoded chain → LLM router → state machine → fully autonomous),
[LangChain — Introducing ambient agents](https://blog.langchain.com/introducing-ambient-agents/)
(agents triggered by events rather than chat, with human-in-the-loop `interrupt` as a
first-class decision point), and
[Agentic RAG: a survey](https://arxiv.org/abs/2501.09136) (academic, but a thorough
taxonomy of retrieval-as-a-decision).

### The decision rule, synthesized

The sources agree on an escalation ladder. Each rung costs more tokens, latency, and
failure surface than the one below, so **the rule is: take the lowest rung that works.**

1. **Single call + tools** — the task resolves in one shot.
2. **Prompt chaining** — fixed, predictable sequence of steps.
3. **Routing** — input classified to one of N specialized handlers.
4. **Parallelization** — independent subtasks (sectioning), or same task N times for confidence (voting).
5. **Reflection / evaluator-optimizer** — output quality is checkable against *externally verifiable* criteria. Without objective criteria this just burns tokens.
6. **Planning / ReAct** — multi-step dependencies that can't be pre-specified. **Always with an explicit iteration cap.**
7. **Orchestrator-workers / multi-agent** — genuinely separable roles that exceed one context window. Pay 15× tokens knowingly.

Cross-cutting, from #33/#34/#37: delegation must specify objective + output format +
tool guidance + boundaries; context is a budget to be spent, not a bucket to be filled;
and plan generation should be **decoupled from execution** so a plan can be validated
before anything with a side effect runs.

---

## Where this corpus maps against current app gaps

Cross-referenced with the DDIA 2e gap audit (2026-08-05):

| Gap | Covered by |
|---|---|
| Vector DBs / embeddings / ANN | #28, #29 |
| RAG / LLM workloads | #30, #31 |
| Durable workflows | #24, #23, plus microservices.io saga/outbox |
| GraphQL | #20 |
| Materialized views / derived state | #19, #16 |
| Cloud-native / storage-compute split | #13, #21 |
| Scaling economics | #26, #27, #33 (token economics is the new cost model) |
| Privacy / societal impact | **still uncovered** — no strong primary-source post found |

The last row is a real hole. The best material there is regulatory and academic rather
than engineering-blog, so it may need to be authored from the DDIA 2e chapter directly
rather than sourced.
