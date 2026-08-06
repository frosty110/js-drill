---
name: add-a-gate
description: Close a class of failure that leaves every visible signal green while the meaning quietly goes wrong — duplicated logic kept in sync by a comment, generated output that can go stale, a registry nothing reconciles, docs naming files that moved, an asset nobody budgeted. Use this whenever you catch yourself writing "remember to…", "must stay in sync", "don't forget to regenerate", or "this should always match", and whenever you are about to add a check to tools/check-all.js or a probe to PROBE_SUITE. Also use it when a bug turns out to have been shipped and invisible for a long time, because that is the signature of a missing gate rather than a missing test.
---

# add-a-gate

Ordinary bugs announce themselves — a broken layout, a thrown error, a red test.
This project keeps getting bitten by a different class: **changes where every
visible signal stays green and the meaning quietly becomes wrong.** A reordered
question still renders. A missing precache entry still boots. A validator that
drifted from the app still prints `1034 passed`.

[`docs/invariants.md`](../../../docs/invariants.md) is the catalogue of those
rules; `tools/check-all.js` is where they run. This skill is how you add one.

## The ladder — try each rung before the next

1. **Make it impossible.** A registry with one row per surface beats a
   convention about naming paths. A single implementation beats two that agree.
2. **Make it fail loudly.** A check whose message says what broke, what it
   costs, and what to do instead.
3. **Only then document it.** And point the doc at the gate.

A rule that lives only in prose is a rule with a decay rate. If you are writing
the prose because you can't see how to check it, say so explicitly in the doc —
"this is unguarded" is useful; silence reads as "this is handled."

## Rung 1 first: prefer deleting the duplicate to gating it

When two things must agree, the instinct is to write a check that they agree.
Usually the better fix is that there should not be two.

> **What this cost, once.** `js/core/runner.js` graded drills in the browser
> while three Node tools graded the same content with their own copies, each
> asking the others to stay in sync via a comment. Measured, 9 of 10 probe cases
> diverged — Map printed as `{}` in one and `Map(1) { a => 1 }` in the other,
> `console.error` lost its prefix, one ran sloppy-mode and one strict. Every one
> of those green-lights an `expectedOutput` the app then grades as WRONG, so a
> user types the canonical perfectly and is told they failed. One lesson had
> shipped broken exactly that way.
>
> The fix was not a gate on four copies. It was deleting three of them.

So: before writing the check, ask whether the thing being checked should exist.
A comment reading *"behavior MUST stay in sync"* is an unfiled bug report, not a
design.

When you genuinely can't unify — two engines, two languages — isolate the one
legitimate difference and inject it (`DrillRunner.setTypeEraser()`), so the
shared path stays shared and the divergence has exactly one address.

## Write the gate expecting it to find something

Writing the gate *is* the investigation. Do not write it, watch it pass, and
move on satisfied — that usually means it isn't checking what you think.

In the session that produced this skill, 8 gates were added and **3 found live
bugs on their first run**: the runner drift above, two files bypassing
`DrillStorage` (one skipping version validation, one silently breaking backup
restore by never firing the sync event), and a stale `app.css` row in the
file-layout table.

If your new gate passes immediately, spend a minute breaking something on
purpose to confirm it goes red. A gate that cannot fail is decoration.

## Gate in two directions

A durable gate usually needs both halves:

| Direction | Asks | Example |
|---|---|---|
| **Structural** | can the bad shape come back? | no tool may define its own `formatArg`/`runCode`; all must require `tools/lib/runner-node.js` |
| **Behavioural** | is the meaning still what we think? | `Map` formats as `Map(2) { a => 1, b => 2 }`; the drain is 8 macrotasks; the body is strict |

The structural half stops the regression. The behavioural half makes a
deliberate change *visible* — if someone edits how a `Set` prints, they have to
edit the pin too, and that is the moment to notice every authored
`expectedOutput` containing a Set just became wrong.

## Ask what your gate cannot see

This is the step people skip, and it is where gates fail silently in turn.

> `tools/check-sw-shell.js` enforces "every local asset of every routed page is
> precached." It matched assets with a hardcoded `(?:js|css|ds)/`. When CDN
> dependencies were vendored into a new `vendor/` directory, every one of those
> files was invisible to it — pages loaded them, the precache omitted them, and
> the gate stayed green. The exact bug it exists to prevent, at a new address.

So after writing the gate, ask: *what would slip past this?* Then make the
unknown case fail rather than pass. That gate now takes a directory **list** and
separately fails on any local asset directory missing from the list, so the next
new directory announces itself instead of hiding.

Default to failing closed. An unrecognised input should be an error, not a skip.

## Keep it low-noise or it will be ignored

A first draft of the documented-paths gate flagged **1207** "paths" — including
`do/while`, `passed/total`, and `[product/fix]`. That gate is worthless: nobody
reads 1207 lines, and the habit it teaches is to skip the output.

Narrowing it to two unambiguous forms — markdown link targets, and the
file-layout table's first column — took it to **3 findings, all real**.

Rules of thumb:

- Check things that are unambiguous by construction. A markdown link either
  resolves or it doesn't; a "path-shaped string in prose" is a judgement call.
- Prefer a narrow gate that always means something to a broad one that mostly
  doesn't. You can widen later.
- If you need heuristics to decide whether a hit is real, the gate is aimed
  wrong — find the structural form of the same question.

## Respect the constraint CI actually has

`.github/workflows/checks.yml` runs `node tools/check-all.js` with **no
`npm install`**. That is load-bearing, not incidental.

Split accordingly: **generating** may need dependencies, **verifying** may not.
`tools/build-tailwind-subset.js` needs tailwindcss; `tools/check-tailwind-subset.js`
re-derives the used set with plain Node and compares against the committed CSS.

Then prove it rather than assuming — move `node_modules` aside and run the full
gate suite:

```bash
mv node_modules /tmp/nm && node tools/check-all.js; mv /tmp/nm node_modules
```

Same logic for the browser: if a check needs a rendered DOM it is a **probe**,
not a gate. Probes go in `tools/cdp/` and register in `PROBE_SUITE`; they are
opt-in via `--probes` and must never enter the default path.

## Don't make the historical record lie to satisfy a gate

`iter-artifacts/`, `docs-archive/` and `docs/**/archives/` are append-only
records of what was true at a point in time. A path in one of them that no
longer resolves is not a bug — it is the record being accurate about the past.

The same applies inside a living doc: `check-doc-paths.js` exempts fenced code
blocks, because CLAUDE.md quotes a historical commit body verbatim and
"fixing" a path inside a quote would falsify it.

When a gate collides with a record, exempt the record and say why in the gate.

## Write the failure message for the person who hits it

They are mid-task and did not read your gate. Give them three things: what
broke, what it costs, and what to do instead.

```
✗ tools/verify-lesson.js defines a runCode of its own — it must grade through
      tools/lib/runner-node.js instead. A second implementation is exactly
      how the last drift shipped a lesson that was broken in the browser.
```

The "what it costs" clause is what stops someone from silently adding an
exemption. Name the real consequence, not the rule.

## Name the escape hatch

Every invariant should say how to break it legitimately, because sooner or later
someone must. An unnamed escape hatch becomes an ad-hoc one.

| Invariant | Hatch |
|---|---|
| authored order is frozen | `check-content-order.js --accept` re-baselines |
| boot path has a budget | raise the number **in the same commit that spends it** |
| one runner grades content | none — the type-eraser injection is the only seam |
| every probe is registered | `MANUAL` allowlist, each entry carrying a reason |

"Raise the budget in the same commit that spends it" is the useful shape: not a
prohibition, a requirement that the diff record the decision.

## Checklist

- [ ] Could rung 1 apply — can the duplicate be **deleted** rather than checked?
- [ ] Does it fail on a deliberately broken input?
- [ ] Structural half (the shape can't come back) **and** behavioural half (the
      meaning is pinned)?
- [ ] What can it not see? Does the unknown case fail rather than skip?
- [ ] Every finding real? (If it fires 100+ times, aim it differently.)
- [ ] Runs with no `node_modules` — verified, not assumed?
- [ ] Exempts append-only records, and says why?
- [ ] Message names the cost, not just the rule?
- [ ] Escape hatch named?
- [ ] Registered in `GATES` (or `PROBE_SUITE` if it needs a browser)?
- [ ] Section added to [`docs/invariants.md`](../../../docs/invariants.md),
      numbered, with its gate and hatch?
- [ ] Counts derived from data at run time, never hardcoded — a check that goes
      red when someone *adds content* teaches people to ignore it.
