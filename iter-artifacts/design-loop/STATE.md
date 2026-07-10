# State Ledger

The single source of "where are we." **Read at the start of every iteration;
update at the end.** Keep it short — it's a control surface, not a diary.

---

## Current status
- **Phase:** P1 nav shell **structurally complete** (bar + rail = D01 done); P4 Browse at part 2 of 3; next battleground = P5 Progress / P1 palette restyle / P4 part 3
- **Overall progress:** 2 / 11 phases complete (P0, P1-nav), P2–P4 each ~⅔
- **Decided:** nav = **adaptive rail ↔ bottom bar** (D01); theming = **dark-first, light-ready** (D02); visual = **Ink & Amber / minimal** (D03); isolated **`ds/` layer** (D04); inventory pass = **zero capability retirements, chrome-only replacement** (D05); **desktop rail replaces sidebar+dropdowns, sidebar → drawer everywhere** (D08).
- **Last slice shipped:** **P4b Desktop rail** — ≥768px shows the ds rail (4 destinations + Search ⌘K/Settings foot) under the topbar; topbar dropdowns + Dashboard link retired; permanent sidebar → off-canvas drawer (Browse "All filters" opens it; power filters intact); breakpoints unified at 768; `/` falls back to palette when drawer closed; System Design added to palette (was unreachable on mobile); 2 desktop-topbar leak fixes (mobile-only icons, phantom cram chip); SW v21. Probes: p4b-rail 35/35 (1280+820+390), p1-nav-smoke 33/33, validator 920/920, zero console errors.
- **Next slice (recommended):** **P5 · Progress redesign** — the rail's Progress destination renders the legacy-styled Dashboard; rebuild it as ONE coherent ds surface (daily → activity → mastery, absorbing At-Risk/Resurrect entry points). Alternatives: P1 palette restyle onto ds (rail Search now spotlights it); P4 part 3 (migrate drawer filters into Browse, kill the drawer).
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
- Probes sharing one Chrome share one ORIGIN: a later `connect()` inherits the localStorage + lastTab the previous section saved (a desktop run ending on L3 made the next mobile boot hide the nav). Every probe section must seed its own state + strip the hash + reload.
- `offsetParent === null` does NOT detect the off-canvas drawer (it's transformed, not display:none) — gate on `body.classList.contains('sidebar-open')` instead.
- Global rules in css/06-ds-nav.css can silently out-cascade equal-specificity `display:none` rules in 05-shell-chrome (same 0,1,0, later file wins) — the D07 `.topbar-icon` centering rule un-hid the mobile-only topbar icons on desktop for 2 iters. When adding a global rule over legacy chrome classes, grep for `display: none` on the same class.
- P4b deferred (for P6): rail Settings synth-clicks #topbar-settings so the settings dropdown opens anchored top-right (spatially disconnected from the rail foot); topbar 🔍/?/⚙ icon strip is now redundant with the rail foot — P6's Settings surface should resolve both. Drawer box-shadow is a hardcoded rgba mirroring legacy 02-sidebar (drawer dies/restyles in P4 part 3). Reference-tab toggles (Flash/Cinema/Notes→Code) still carry emoji — converts with P7 per D07 rollout.

## Guardrail reminders
- Every iteration: independently green (`node tools/validate-data.js`), browser-tested @390px + desktop, committed per convention.
- Preserve capability; log any retirement in `DECISIONS.md`.
- Update `ROADMAP.md` statuses when a slice lands; drop a before/after pair in `shots/`.

---

### Iteration log (newest first — one line each)
<!-- YYYY-MM-DD · iter N · phase · slice shipped · rubric delta · shots ref -->
- 2026-07-10 · iter 8 · P4b · Desktop rail (≥768 rail + Search/Settings foot; dropdowns+Dashboard link retired; sidebar→drawer; 768 unified; `/`→palette fallback; System Design→palette; 35/35 + 33/33; self-review, 2 topbar-leak fixes) · Decisions ↑↑ (desktop: 4 calm destinations vs 6-menu topbar) · ADHD-fit ↑ (S2 at-desk) · shots/06-p4b-rail/
- 2026-07-10 · iter 6 · D07 icons (user-directed) · ds/icons.js stroke set replaces emoji in nav/launcher/topbar/home; no-emoji probe gate · craft bar ↑ (Linear-tier chrome) · shots/04-p3-launcher/ (refreshed)
- 2026-07-10 · iter 5 · P3 · Practice launcher bottom sheet (taxonomy-derived, 4 groups, 26/26 probe; contrarian PASS) · Decisions ↑ (grouped disclosure at the thumb) · ADHD-fit ↑ (no more top-menu eye-jump) · shots/04-p3-launcher/
- 2026-07-10 · iter 4 · P2 · Today home (hero next-rep + streak grace + stat tiles + THEN; mock-C-faithful; contrarian BLOCK fixed) · Autopilot ↑↑ (J1 = 1 tap) · Progress-visible ↑ (ambient tiles/streak) · shots/03-p2-home/
- 2026-07-10 · iter 3 · D06 retheme · global Ink & Amber sweep (~1,190 lines + Tailwind remap + contrast fixes; user-directed acceleration) · whole family visually transformed · shots/02-retheme/
- 2026-07-10 · iter 2 · P1 · mobile bottom nav (4 tabs, ds/ layer, L3-immersive, dock-lift; contrarian BLOCK on dock fixed) · Phone-fit ↑ (thumb bar vs corner icons) · Decisions ↑ (4 labeled destinations vs 3 unlabeled icons + hamburger) · shots/01-p1-nav/
- 2026-07-10 · iter 1 · P0 · before-shots (35) + INVENTORY verdicts (D05) + sandbox CDN-vendor probe infra · baseline captured · shots/00-before/
- 2026-07-10 · iter 0 · P0 · ds/tokens.css + ds/components.css v1 + gallery; D01–D04 locked · n/a · —
