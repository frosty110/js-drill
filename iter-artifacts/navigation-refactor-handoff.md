# Navigation Refactor — Handoff Plan for Deferred Items

> The 9-phase Problems⇄Reference refactor shipped & browser-verified on `main`
> (2026-05-27). Three sub-items were deliberately scoped down to ship the whole
> safely. This is the pickup plan for them. Each is **additive** — nothing is
> broken; these are enhancements on a working base.
>
> See also: `navigation-refactor-goals.md` (why), `-design.md` (what),
> `-phasing.md` (the 9 phases).

## ⚠️ Codebase note (read first)

`app.js` / `app.css` were split into slices on 2026-05-27 (AI-legibility refactor).
The Phase A–I code carried over. Symbol map for the deferred work:

| Symbol / area | New file |
|---|---|
| `renderSidebar`, lesson rows, repair-icon injection | `js/app/10-render-sidebar-lesson.js` |
| `TOPBAR_MENU_TAXONOMY`, `renderTopbarMenuContents`, grouped-menu render | `js/app/15-init-features-boot.js` |
| `buildRepairIndex`, `_refreshSessionChrome`, stats/streak/mock | `js/app/09-stats-cheatsheet-mock.js` |
| `renderCramHome`, `renderPlanHomeLessons`, path helpers | `js/app/03-paths-cram.js` |
| Sections-grid, constellation | `js/app/06-drills-constellation-grid.js` |
| Mechanics modal | `js/app/13-mechanics-modal.js` |
| Drill start fns | `js/app/05-…`, `07-…`, `08-…` |
| Surface toggle / nav links / CSS | toggle JS in `10`; CSS in `css/05-shell-chrome.css` |

`grep -rn "<symbol>" js/app/` to confirm before editing — slices may be renumbered.

## Verification harness (same for all items)

```bash
python3 -m http.server 8765            # if not already up
# headless Chrome on :9222 (binds localhost/[::1]); the probe lib auto-attaches
node tools/cdp/<probe>.js http://127.0.0.1:8765/
node tools/validate-data.js            # must stay 734/0
```
**Gotcha:** Chrome aggressively caches `js/*.js`. Every probe MUST do
`Network.setCacheDisabled` + a `Page.reload({ignoreCache:true})` after navigate
(copy the boilerplate from `tools/cdp/surface-toggle.js`) or you'll test stale code.

---

## DI-1 — Blended drill-family sessions

**Goal:** tapping a Drill *family* (not a variant) launches a session; a "Surprise
me" picks a random member; true interleave mixes members card-by-card.

**Shipped now:** `TOPBAR_MENU_TAXONOMY.drills` has 5 `groups`; the menu renders
group sub-headers + member buttons; clicking a member synth-clicks its `*-btn`
→ that single drill launches full-bleed (Phase H). Every variant reachable in ≤2 clicks.

**Missing:** a family-level launch + a "pick one / surprise me" affordance.

**Recommended approach (ship the cheap 80% first):**
1. **Variant sheet + Surprise-me** (≈0.5 day, low risk): give each family row a
   `▶` that opens a small sheet listing the family's members + a "🎲 Surprise me"
   that synth-clicks a random member's `*-btn`. Edit `renderTopbarMenuContents`'s
   grouped branch (`js/app/15-…`) to add the family-level button; reuse the
   existing `data-btn-id` synth-click dispatch.
2. **True interleave** (≈2–3 days, separate refactor — do NOT bundle): mixing one
   card from drill A, next from drill B, requires a *uniform single-card
   interface* (`{renderCard, grade, deck}`) that the ~17 drills don't expose
   today — each owns a full `start*Session` loop. Extract that interface first,
   then a `runBlendedFamily(memberDecks)` shuffler. Track as its own epic.

**Verify:** probe — tap a family `▶`, assert a sheet with the members + Surprise-me;
Surprise-me triggers `body.in-session` (full-bleed). Handle drills whose data
isn't preloaded (they `alert()` — Surprise-me should prefer a data-ready member or
swallow the alert).

**Risk:** drill data-readiness (some need lessons loaded first). Low overall.

---

## DI-2 — Reflect single-surface dashboard

**Goal:** fold the 4 progress modals (Stats / Streak-map / Sections / Mechanics)
into ONE full-bleed surface with sticky chip-nav (scroll-to-anchor); export +
ai-coach as a footer action bar.

**Shipped now:** the Reflect menu (Phase I) groups them (Progress / Export /
Reference) and each item still opens its **own modal**. Junk-drawer solved; 4
separate modals remain.

**Approach (≈1–1.5 days):**
1. Locate the 4 openers (`grep -rn "function openStats\|streak-map\|sections-grid\|openMechanics" js/app/`) — Stats/Streak in `09`, Sections in `06`, Mechanics in `13`.
2. Refactor each to expose a `renderXInto(containerEl)` that builds the inner
   content (extract from the modal-show logic). Keep the old `openX()` as a thin
   wrapper (`renderXInto(modalBody); showModal()`) so existing callers don't break.
3. New `renderReflectDashboard()`: one full-bleed surface (reuse the Phase-H
   `body.in-session` host or a dedicated overlay) with sticky chips
   `[Stats][Streak][Sections][Mechanics]` → scroll-to-anchor, 4 `<section>`s each
   filled by `renderXInto`, + a footer with 📋 Export / 🤖 AI-Coach.
4. Point the Reflect "Progress" group at the dashboard (single entry) instead of 4 items.

**Verify:** probe — open dashboard; assert 1 surface, 4 chip-nav anchors, all 4
sections render non-empty, chip click scrolls, no console errors. Facts-only
(streak = calendar density, NOT a 🔥 counter — anti-gamification guardrail).

**Risk:** Mechanics is the hardest (list↔matrix toggle + detail drill-in). Do it
last; default to **list view on mobile** (matrix overflows). Medium.

---

## DI-3 — Implicit Path View + "All Lessons" plan

**Goal:** the sidebar always shows the active plan's lessons in order (no 🧭 Plan
View toggle); switch to a new **All Lessons** plan to browse everything.

**Shipped now:** 🧭 Plan View chip still present (toggles `state.starterPath`).
Plans: `starter`, `cram`, `eve-legal` — no "all".

**Approach (≈1 day incl. migration):**
1. **Add the escape hatch first** — append to `data/paths.json`:
   `{ "id":"all", "label":"All Lessons", "icon":"🗂", "kind":"lessons",
   "blurb":"Every lesson, unordered.", "lessons":[] }`. Empty `lessons` already
   means "no path filter" (verify in `getPathLessonOrder` / `subscribedPathHasLessons`,
   `js/app/03-…`). Validator must stay green (cram-sync check ignores non-cram).
2. **Make filtering implicit:** default `state.starterPath = true`; on load, force
   it true (migration branch) so the sidebar always scopes to the subscribed plan.
   The All-Lessons plan (empty lessons) yields the unfiltered view.
3. **Remove the chip:** delete `#path-btn` from the filter row (`index.html`) + its
   handler + the `pathBtn` paint block in `renderSidebar` (`js/app/10-…`).
4. **Reconcile with the surface model:** the `path-track` sub-chips (Syntax /
   Patterns / Applied within a path) now overlap the Phase-C Problems⇄Reference
   surface (which already scopes Syntax vs Patterns+Applied). Likely remove the
   sub-chips too — decide during pickup.

**Verify:** probe — Starter plan shows only its lesson set (count == plan order
length); switch to All Lessons → full curriculum; no `#path-btn` in DOM; legacy
`starterPath:false` save still lands filtered after migration.

**Risk:** core sidebar-filtering + a save migration + surface-model overlap.
Highest of the three — sequence it last and lean on the probe + a legacy-save test.

---

## Suggested order

**DI-1 sheet** (quick win) → **DI-2 dashboard** (contained, high polish) →
**DI-3** (riskiest, touches core filtering + migration). True drill interleave
(DI-1 part 2) is a separate epic, schedule independently.

Each lands as its own validated, ships-green commit. Don't bundle DI-3's migration
with anything else.
