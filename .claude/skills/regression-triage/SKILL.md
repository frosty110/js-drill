---
name: regression-triage
description: Work out whether a failing test, probe or build is caused by your change, by a stale or wrong environment, or by a flaky assertion — before you start "fixing" it. Use this the moment a check goes red and you are not certain why, especially when a browser probe fails, when a suite that passed earlier now doesn't, when you are tempted to say "that's probably pre-existing" or "that's just flaky", and before running any A/B comparison against a base commit. Also use it when a probe fails with numbers that look plausible, since that is exactly when a wrong diagnosis is cheapest to reach and most expensive to act on.
---

# regression-triage

A red check has three common causes, and they need opposite responses:

| Cause | Response |
|---|---|
| **Your change** | fix the code |
| **Wrong or stale environment** | fix the setup, then re-measure — the result so far is meaningless |
| **A genuinely flaky assertion** | make it deterministic (do **not** just re-run) |

Guessing wrong is expensive in both directions. Call a real regression "flake"
and you ship it. Call a flake "my regression" and you rewrite working code, or —
worse — you "fix" the symptom by loosening the assertion that was doing its job.

Work the order below. Each step is cheap and rules out a whole cause.

## 1. Prove attribution with git before theorizing

Before forming any theory about *why*, establish whether your change could
possibly be responsible. The failing behaviour is computed from some set of
files. Did you touch them?

```bash
git diff --stat <base>..HEAD -- <area>/    # committed
git status --short <area>/                 # uncommitted
```

Empty output is a hard answer, and it takes ten seconds.

> A probe asserted that the first 12 cards of a shuffled session contained at
> least one multiple-choice card. It failed right after a branch that had
> touched the page's `<script>` tags. Plausible story: the change broke card
> rendering. `git diff --stat` over `js/sd/` and `data/system-design/` came back
> **empty** — both byte-identical to the base commit. Card type distribution is
> computed entirely from those. Whatever this was, it was not that change, and
> the investigation could turn to what it actually was.

Do this first because every later step costs minutes and this one costs seconds.

## 2. Confirm you are testing what you think you are testing

A green or red result against the wrong tree is not a result. This is the most
under-suspected cause, because everything *looks* like it is working.

The reliable trick: **look for a fingerprint of your own change in the failure
output.** You know what you changed — if the evidence contradicts it, the
environment is stale.

> A probe was re-run in isolation to reproduce a failure. It failed the same
> way. But its network-error list named `cdn.jsdelivr.net` requests — URLs that
> had been *removed from the page* in the branch under test. That was only
> possible if the static server was still serving a different working tree
> (a base-commit worktree from an earlier experiment, still bound to the port).
> Two "reproductions" had been measured against the wrong code.

Cheap confirmations before trusting any run:

```bash
curl -sS http://127.0.0.1:8765/index.html | grep -c "<thing you just added>"
git worktree list          # a stray worktree can hold a port
```

And beware the inverse: a **base-commit comparison can be invalid**. Checking
out the base to A/B a probe produced "0 cards" — not because the base was
broken, but because the base predates vendoring and this environment blocks the
CDNs it depended on. That is not signal. If the base can't run at all, say so
and reason from step 1 instead.

## 3. Decide flake vs. regression with arithmetic

If the assertion depends on randomness, compute roughly how often it should
fail. Do not eyeball it.

> The failing assertion was "the first 12 cards include ≥1 multiple-choice",
> over a pool the data showed to be 255 open vs 73 MC questions — 78% open.
> The session builder is `shuffle(pool).slice(0, 20)` with a plain Fisher-Yates
> over `Math.random()`. So P(no MC in 12 draws) ≈ 0.78¹² ≈ **4%**. Not a
> regression: an assertion with a 1-in-25 failure rate that nobody had noticed
> because the probe had only ever been run occasionally.

To do this you need the data, not an impression of it — count the actual
population before estimating. Two minutes with `node -e` beats an argument.

Also **read the check's own comments before diagnosing it.** That probe already
documented the identical failure signature (`open=12, mc=0`) from a different
cause, and carried a fix for it. Half the diagnosis was written down inside the
file that was failing.

## 4. Fix a flake with determinism, not tolerance

Once something is confirmed flaky, there are three tempting non-fixes:

- re-run until green — hides it and wastes everyone's time later
- loosen the assertion — deletes the coverage it was providing
- add a retry — same as re-running, with ceremony

Prefer removing the nondeterminism. For a shuffle, seed it:

```js
await s.eval(`(() => {
  let seed = 0x2F6E2B1;
  Math.random = function () {              // mulberry32
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})()`);
```

The assertion keeps its full strength, and a future failure means the app
changed rather than the dice did. Say that in a comment at the seed site, so the
next reader knows why it's there.

Shared mutable state is the same problem wearing a different hat: browser probes
share a Chrome profile, so a probe that grades content leaves `localStorage`
behind for the next one. Reset the store at the start of a probe that depends on
it, and note which state you're clearing.

## 5. Watch for self-matching process patterns

Two separate incidents in one session, both from the same mistake — a `pgrep` or
`pkill` pattern that matches **the shell running it**, because the pattern
appears in that command's own command line:

```bash
pkill -f "sd-mixed-context"                     # kills its own shell
until ! pgrep -f "check-all.js --probes"; do …  # waits on itself, forever
```

The second is nastier: it never returns, so it reads as "the suite is still
running" long after the suite finished. Symptoms — a waiter that never fires, a
command that dies with an odd exit code, a background job stuck at 0 bytes.

Safer forms:

```bash
pgrep -f "[c]heck-all.js --probes"                    # bracket breaks self-match
ps -eo pid= -o args= | grep -F 'pattern' | grep -v grep
kill -9 <explicit PID>                                 # best when you know it
```

When a long-running job seems stuck, check whether it is genuinely stuck or you
are watching it with a broken watcher. Read the log file directly.

## 6. Report the finding, not a reassurance

However it resolves, say which of the three causes it was and what the evidence
was. "Probably pre-existing" is not a diagnosis; it is a way of not doing one.

Good shapes:

- *"Not my change — `js/sd/` and `data/system-design/` are byte-identical to
  base; the assertion is ~4% flaky by construction. Seeded the shuffle."*
- *"Pre-existing rot: 0 of 70 assertions pass, the selectors it looks for were
  renamed. Archived it and corrected the doc that claimed it was coverage."*
- *"Mine. The vendored path wasn't precached because the gate only matched
  `js|css|ds`."*

If a check fails and you can't attribute it, that is itself a finding worth
surfacing — do not fold it into a summary as though it were resolved.

## When triage says "pre-existing rot"

A failing check that predates you is not automatically yours to fix, but it is
yours to make **visible**. Leaving it red and unmentioned is how a suite decays
into noise.

The usual right move is to separate what runs from what doesn't, correct any
doc that claims coverage that isn't there, and record the measured numbers so
the next person doesn't repeat the investigation. See
[`add-a-gate`](../add-a-gate/SKILL.md) for closing the class properly.

## Checklist

- [ ] `git diff --stat <base>..HEAD -- <area>` run **before** theorizing?
- [ ] Verified the server/tree/port under test is the one you think?
- [ ] Looked for a fingerprint of your own change in the failure output?
- [ ] If randomness is involved, computed the failure probability from real
      counts?
- [ ] Read the failing check's own comments and history?
- [ ] Flake fixed by determinism rather than retry or loosened assertion?
- [ ] Any `pgrep`/`pkill` pattern checked for self-matching?
- [ ] Conclusion states which of the three causes it was, with evidence?
