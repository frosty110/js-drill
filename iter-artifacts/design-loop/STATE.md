# State Ledger

The single source of "where are we." **Read at the start of every iteration;
update at the end.** Keep it short — it's a control surface, not a diary.

---

## Current status
- **Phase:** P0 · Foundation & alignment — **COMPLETE** (except broader icon set, tracked in P0 last bullet; non-gating)
- **Overall progress:** 1 / 11 phases complete
- **Decided:** nav = **adaptive rail ↔ bottom bar** (D01); theming = **dark-first, light-ready** (D02); visual = **Ink & Amber / minimal** (D03); isolated **`ds/` layer** (D04); inventory pass = **zero capability retirements, chrome-only replacement** (D05).
- **Last slice shipped:** P0 close-out — 35 before-screenshots @390px + desktop (`shots/00-before/{mobile,desktop}/`) via new reusable `tools/cdp/before-shots.js`; full INVENTORY.md verdict pass (D05). Also: `tools/cdp/fetch-vendor.sh` + lib.js CDP interception so browser probes render fully-styled in sandboxed envs where CDN domains are blocked (vendored npm mirrors, gitignored).
- **Next slice:** P1 → build the **navigation shell** (Today/Browse/Practice/Progress adaptive nav on the ds/ layer) — the spine everything hangs on. Then palette redesign, then route/keyboard parity audit.
- **Blocked on:** nothing.

## Open decisions
- (none — all resolved; see `DECISIONS.md`)

## Learnings (append tight bullets as you go)
- This environment blocks CDN domains (cdn.tailwindcss.com/cdnjs/jsdelivr → proxy 403) but allows registry.npmjs.org. Fix shipped: `bash tools/cdp/fetch-vendor.sh` once per container, then lib.js auto-serves vendored bytes via CDP Fetch interception. Without it, screenshots render UNSTYLED — do not trust probe shots if vendor/ is missing.
- `tools/cdp/lib.js ensureChrome` uses macOS `open -na`; on Linux start Chromium manually: `/opt/pw-browsers/chromium --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-jsdrill --headless=new --no-sandbox` (lib then detects it as already-up).
- `npm install --no-save ws` needed once per container for the probes.
- `before-shots.js` takes an outRoot argv — reuse it for the P10 after-sweep (`node tools/cdp/before-shots.js iter-artifacts/design-loop/shots/99-after`).

## Guardrail reminders
- Every iteration: independently green (`node tools/validate-data.js`), browser-tested @390px + desktop, committed per convention.
- Preserve capability; log any retirement in `DECISIONS.md`.
- Update `ROADMAP.md` statuses when a slice lands; drop a before/after pair in `shots/`.

---

### Iteration log (newest first — one line each)
<!-- YYYY-MM-DD · iter N · phase · slice shipped · rubric delta · shots ref -->
- 2026-07-10 · iter 1 · P0 · before-shots (35) + INVENTORY verdicts (D05) + sandbox CDN-vendor probe infra · baseline captured · shots/00-before/
- 2026-07-10 · iter 0 · P0 · ds/tokens.css + ds/components.css v1 + gallery; D01–D04 locked · n/a · —
