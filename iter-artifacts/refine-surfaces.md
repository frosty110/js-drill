# Refine — Surface Inventory

The catalog of EXISTING surfaces `/drill-refine` is allowed to audit.

**Picker signal is git-staleness, computed at run-time by the skill — not a
hand-maintained column.** The "Last shipped refine" column below is updated
*by* `/drill-refine` after a `shipped` outcome (Step 7), purely for human
orientation. The skill's surface-picker does NOT read it.

## Surfaces

| ID | Surface | Primary file(s) | Last shipped refine |
|---|---|---|---|
| `topbar` | Topbar (Drill / Train / Reflect dropdowns, surface toggle, Plan link) | `index.html` (lines 64–110), `js/app/15-init-features-boot.js` | — |
| `sidebar-problems` | Sidebar — Problems list, filter chips, plan header | `js/app/10-render-sidebar-lesson.js`, `css/02-sidebar.css` | — |
| `lesson-tabs` | Lesson tabs (Ref / Conv / Walk / L1 / L2 / L3) — horizontal-scroll on mobile | `js/app/11-tabs-ref-conv-walk.js`, `js/app/12b-l2.js`, `js/app/12c-l3.js` | — |
| `today-plan` | Today's Plan card — **the user's stated "autopilot" surface** | `js/app/03-paths-cram.js`, Today modal in `index.html` | — |
| `mock-interview` | Mock Interview shell (Session shell + Study-L3 body) | `js/app/09-stats-cheatsheet-mock.js` | — |
| `reflect-dashboard` | Reflect dashboard (Stats · Streak Map · Sections Grid · Mechanics) | `js/app/09-stats-cheatsheet-mock.js`, `js/app/13-mechanics-modal.js` | — |
| `sidebar-drawer-mobile` | Sidebar drawer (mobile) — hamburger entry path | `index.html` (hamburger), sidebar JS | — |
| `plan-picker-modal` | Plan picker modal — first-time user lands here | `js/app/03-paths-cram.js` (`openPathModal`) | — |
| `cmd-k-palette` | ⌘K / 🔍 command palette | `js/app/14-init-core.js` (palette init), `css/02-sidebar.css` (.palette-*) | — |
| `repair-at-risk` | Repair filter + At Risk pill (inline status icons + sidebar pill) | `js/app/10-render-sidebar-lesson.js`, `js/app/04-progress-sr.js` | — |
| `diagnostic-results` | Diagnostic results page — output of the 43-question assessment | `diagnostic.html` | — |

## How the skill computes staleness (at run-time)

```bash
# For each row above, the latest commit touching ANY primary file:
for f in <primary-file(s)>; do
  git log -1 --format=%ci -- "$f"
done | sort | tail -1
```

Pick the surface whose latest-touch is **oldest**. Tie-break on fewest commits
in last 90 days:

```bash
for f in <primary-files>; do
  git log --since=90.days.ago --oneline -- "$f"
done | wc -l
```

**Why this signal:** code untouched for weeks/months is the same code that hasn't
been scrutinized for user-fit recently. The "oldest = last touched" intuition
correlates with "most decayed UX" because the team's attention is the dominant
maintenance signal in a single-developer codebase.

## How to add a surface

1. Append a row with a unique `ID` (snake-kebab-case).
2. Set "Last shipped refine" to `—`.
3. If the surface composes multiple files, list the load-bearing ones only.

To audit a surface NOT on this list, add the row in a separate commit first.
`/drill-refine` will refuse to audit ad-hoc surfaces.

## Out of scope for this loop

Route to `/drill-improve` instead (these would be feature-adds, not refinements):

- New drill modes / new lesson tracks
- New top-level menus or modals
- New persistence layers
- Cross-device sync changes
- New mechanic categories

## Cross-ref

- The skill: `.claude/skills/drill-refine/SKILL.md`
- The rubric: `.claude/skills/refine-rubric/SKILL.md`
- The ledger: `iter-artifacts/refine-ledger.md`
- The backlog (created on first overflow): `iter-artifacts/refine-backlog.md`
- The user model (LAW): `PROFILE.md`
