# State Ledger

The single source of "where are we." **Read at the start of every iteration;
update at the end.** Keep it short — it's a control surface, not a diary.

---

## Current status
- **Phase:** P1 · Navigation shell — mobile bar shipped; palette + parity audit remain (desktop rail deferred to P4 by design)
- **Overall progress:** 1 / 11 phases complete, P1 ~half
- **Decided:** nav = **adaptive rail ↔ bottom bar** (D01); theming = **dark-first, light-ready** (D02); visual = **Ink & Amber / minimal** (D03); isolated **`ds/` layer** (D04); inventory pass = **zero capability retirements, chrome-only replacement** (D05).
- **Last slice shipped:** **P4a Browse page** — search (all-track) + 3 track segments (syncs sidebarTrack+surface) + section accordion w/ mastery bars + lesson rows (dots, due/weak chips); drawer power-filters one tap deep; `/` retargets visible search; SW v20. Probe 32/32; contrarian PASS (3 fixes adopted).
- **Next slice (recommended):** **P4b · Desktop rail** — flip ≥768px to the ds rail (Today/Browse/Practice/Progress + palette/settings), retire the permanent sidebar + topbar dropdown menus on desktop (Browse page + launcher sheet already work there), unify breakpoints. This completes the D01 adaptive nav and gives desktop the new home. Alternatives: P5 Progress redesign; drawer-filter migration into Browse.
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
- 2026-07-10 · iter 7 · P4a · Browse page (search/segments/accordion/rows; drawer filters 1 tap deep; 32/32; contrarian PASS + 3 fixes) · Phone-fit ↑ · Decisions ↑ (J5 ≤2 taps) · shots/05-p4a-browse/
- 2026-07-10 · iter 6 · D07 icons (user-directed) · ds/icons.js stroke set replaces emoji in nav/launcher/topbar/home; no-emoji probe gate · craft bar ↑ (Linear-tier chrome) · shots/04-p3-launcher/ (refreshed)
- 2026-07-10 · iter 5 · P3 · Practice launcher bottom sheet (taxonomy-derived, 4 groups, 26/26 probe; contrarian PASS) · Decisions ↑ (grouped disclosure at the thumb) · ADHD-fit ↑ (no more top-menu eye-jump) · shots/04-p3-launcher/
- 2026-07-10 · iter 4 · P2 · Today home (hero next-rep + streak grace + stat tiles + THEN; mock-C-faithful; contrarian BLOCK fixed) · Autopilot ↑↑ (J1 = 1 tap) · Progress-visible ↑ (ambient tiles/streak) · shots/03-p2-home/
- 2026-07-10 · iter 3 · D06 retheme · global Ink & Amber sweep (~1,190 lines + Tailwind remap + contrast fixes; user-directed acceleration) · whole family visually transformed · shots/02-retheme/
- 2026-07-10 · iter 2 · P1 · mobile bottom nav (4 tabs, ds/ layer, L3-immersive, dock-lift; contrarian BLOCK on dock fixed) · Phone-fit ↑ (thumb bar vs corner icons) · Decisions ↑ (4 labeled destinations vs 3 unlabeled icons + hamburger) · shots/01-p1-nav/
- 2026-07-10 · iter 1 · P0 · before-shots (35) + INVENTORY verdicts (D05) + sandbox CDN-vendor probe infra · baseline captured · shots/00-before/
- 2026-07-10 · iter 0 · P0 · ds/tokens.css + ds/components.css v1 + gallery; D01–D04 locked · n/a · —
