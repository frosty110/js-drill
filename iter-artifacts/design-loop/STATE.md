# State Ledger

The single source of "where are we." **Read at the start of every iteration;
update at the end.** Keep it short — it's a control surface, not a diary.

---

## Current status
- **Phase:** P1 · Navigation shell — mobile bar shipped; palette + parity audit remain (desktop rail deferred to P4 by design)
- **Overall progress:** 1 / 11 phases complete, P1 ~half
- **Decided:** nav = **adaptive rail ↔ bottom bar** (D01); theming = **dark-first, light-ready** (D02); visual = **Ink & Amber / minimal** (D03); isolated **`ds/` layer** (D04); inventory pass = **zero capability retirements, chrome-only replacement** (D05).
- **Last slice shipped:** P1 slice 1 — **mobile bottom nav** (≤767px): Today/Browse/Practice/Progress on the ds/ layer, wired via synthetic clicks to today-btn/hamburger/topbar-mobile-menu/dashboard-btn; hamburger + mobile 📊/📂 icons hidden (stay in DOM as click targets); L3 hides the bar (Run bar owns bottom); audio dock lifts above it; SW v19 precaches new files. Probe `tools/cdp/p1-nav-smoke.js` 15/15.
- **Next slice (recommended):** **P2 · Today home** — the landing surface with one-tap next rep (due > weak > path). It gives the nav its real default destination + programmatic active state (deferred contrarian note), and it's J1, the highest-value job. Alternative: P1 palette redesign (lower user value; do after home).
- **Blocked on:** nothing.

## Open decisions
- (none — all resolved; see `DECISIONS.md`)

## Learnings (append tight bullets as you go)
- The app's URL hash (`#/<lesson>/<tab>`) survives reloads and WINS over seeded localStorage on boot — probes that seed state must `history.replaceState(null,'',location.pathname)` before reloading, or the previous run's tab leaks in.
- The offline service worker is cache-first with a versioned precache: ANY change to index.html / css / js/app REQUIRES a CACHE_VERSION bump + adding new files to APP_SHELL, or existing users keep the stale shell. lib.js now auto-neutralizes SW in probes (it also defeated Network.setCacheDisabled).
- `#audio-dock` had inline `bottom:0` that silently beat stylesheet rules — inline positional styles on fixed elements are landmines for the redesign; move them into CSS when touched (done for the dock).
- Synthetic-click wiring must `e.stopPropagation()` on the originating event or document-level close-on-outside handlers instantly close what was just opened.
- Contrarian deferred items: drawer z-order above nav (fix in P4), Practice label collision in interim launcher (dies with P3), programmatic `.is-active`/aria-current (wire in P2).
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
- 2026-07-10 · iter 2 · P1 · mobile bottom nav (4 tabs, ds/ layer, L3-immersive, dock-lift; contrarian BLOCK on dock fixed) · Phone-fit ↑ (thumb bar vs corner icons) · Decisions ↑ (4 labeled destinations vs 3 unlabeled icons + hamburger) · shots/01-p1-nav/
- 2026-07-10 · iter 1 · P0 · before-shots (35) + INVENTORY verdicts (D05) + sandbox CDN-vendor probe infra · baseline captured · shots/00-before/
- 2026-07-10 · iter 0 · P0 · ds/tokens.css + ds/components.css v1 + gallery; D01–D04 locked · n/a · —
