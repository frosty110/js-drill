# State Ledger

The single source of "where are we." **Read at the start of every iteration;
update at the end.** Keep it short — it's a control surface, not a diary.

---

## Current status
- **Phase:** P0 · Foundation & alignment
- **Overall progress:** 0 / 11 phases complete
- **Decided:** nav = **adaptive rail ↔ bottom bar** (D01); theming = **dark-first, light-ready** (D02); visual = **Ink & Amber / minimal** (D03); isolated **`ds/` layer** (D04).
- **Last slice shipped:** P0 design-system foundation — `ds/tokens.css` + `ds/components.css` v1 + `ds/gallery.html` (verified: adaptive nav mobile↔desktop, light flip, 0 console errors).
- **Next slice:** P1 → build the **navigation shell** (Today/Browse/Practice/Progress) on the ds/ layer, OR finish P0 (before-screenshots + INVENTORY verdicts). Recommend nav shell next — it's the spine everything hangs on.
- **Blocked on:** nothing.

## Open decisions
- (none — all resolved; see `DECISIONS.md`)

## Learnings (append tight bullets as you go)
- (none yet)

## Guardrail reminders
- Every iteration: independently green (`node tools/validate-data.js`), browser-tested @390px + desktop, committed per convention.
- Preserve capability; log any retirement in `DECISIONS.md`.
- Update `ROADMAP.md` statuses when a slice lands; drop a before/after pair in `shots/`.

---

### Iteration log (newest first — one line each)
<!-- YYYY-MM-DD · iter N · phase · slice shipped · rubric delta · shots ref -->
- (loop has not run yet)
