# Archived probes

These 160 scripts are **historical**. They are not run by anything, they are not
gated, and most of them assert against a UI that has since moved. Treat them as
a record of what was verified at the time, not as a test suite.

## Why they were moved here

`tools/cdp/` had grown to 186 `.js` files while `check-all.js --probes` ran 15
of them. Nothing in the directory distinguished the two groups, so both a human
and an agent reading `tools/cdp/` saw a 186-file test suite that was really a
15-file test suite plus a museum. That mattered in three ways:

- A stale probe that no longer reflects the app is worse than no probe, because
  someone eventually runs it, watches it fail, and has to work out whether the
  failure is real.
- The unregistered ones silently rot. Nothing tells you when one stops matching
  the product, because nothing runs it.
- It made the real suite hard to find, which is the same reason the durable
  probes are now the only `.js` files left directly in `tools/cdp/`.

Most of these were written for a single iteration of the self-improve loop —
verify the thing that just shipped, then move on. That was the right thing to
write. Keeping it on the shelf next to the durable suite was not.

## What lives where now

| Location | Meaning |
|---|---|
| `tools/cdp/*.js` | Durable — either registered in `PROBE_SUITE` in `tools/check-all.js`, or an explicitly allowlisted manual tool |
| `tools/cdp/archive/*.js` | Historical, unrun, may not pass |

`tools/check-probe-registry.js` enforces that split: a new file added directly
to `tools/cdp/` must be registered or allowlisted, so this directory cannot
quietly refill.

## Running one anyway

They still work as far as they ever did — their `require('./lib')` was rewritten
to `require('../lib')` when they moved, so the shared harness still resolves:

```bash
node tools/cdp/archive/<name>.js http://127.0.0.1:8765/
```

If you find one that is still genuinely useful, the fix is to bring it back:
move it up to `tools/cdp/`, confirm it passes against the current app, and add
it to `PROBE_SUITE`. A probe that is worth keeping is worth running.
