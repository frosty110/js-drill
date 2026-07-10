# Design Principles & Quality Bar

The operating rules that turn the vision into consistent decisions. When two
principles conflict, the one closer to `PROFILE.md` wins.

## The 8 principles

1. **One focus per screen.** A surface asks for one thing. Secondary actions are
   tucked (overflow, sheet, palette). ADHD working memory is the budget.
2. **Default over choose.** Pick a sensible next action for the user; let them
   override. A decision required *before* drilling must justify itself loudly.
3. **Thumb-first, phone-first.** Design the 390px view *first*; desktop adapts.
   Primary actions in the thumb zone; ≥44px targets; no horizontal scroll ever.
4. **Ambient feedback.** Progress, streak, readiness, and diagnostic gaps are
   visible where the user already is — never a place they must navigate to.
5. **Progressive disclosure.** Power is available, not exposed. The ~60 modes
   live behind a launcher + palette; depth reveals on intent.
6. **One system, no exceptions.** Every visual element comes from `tokens.css` +
   `components.css`. No hardcoded colors, no per-screen bespoke components.
7. **Motion with meaning.** Animate to explain change and preserve spatial
   continuity (150–250ms, spring). Honor `prefers-reduced-motion`. Never decorate.
8. **Respect the minute.** Every surface pays off in <5 minutes; sessions resume
   instantly; nothing is lost when a session ends abruptly.

## Quality bar (what "5-star" means concretely)
- **Spacing:** an 8pt system (4/8/12/16/24/32…). Rhythm is visible.
- **Type:** a small, deliberate scale; strong hierarchy; generous line-height for reading code.
- **Color:** one accent; status colors reserved for status; large calm neutral fields.
- **Elevation:** a defined, minimal set (flat → card → sheet → modal). No random shadows.
- **States:** first-run, empty, loading (skeletons, not spinners where possible), error, offline — all designed.
- **Microinteraction:** grade/streak/mastery moments feel satisfying and quiet.
- **Craft check:** would this pass in Linear/Things/Oura? If not, iterate.

## Do / Don't
| Do | Don't |
|---|---|
| Surface ONE next rep | Present 6 options and ask them to pick |
| Big thumb-zone primary button | Tiny top-corner actions on mobile |
| Tuck the long tail behind a launcher/palette | A topbar of dropdowns exposing 60 modes |
| Ambient streak/delta chip | A separate screen to "go check progress" |
| Skeleton + instant resume | Spinner + lost scroll position |
| `var(--token)` / component class | `#0b1220` / a one-off style block |
| Retire a dead mode (logged) | Silently drop a capability someone uses |

## Rubric mapping (score every touched surface — see `refine-rubric`)
| Dimension | This design targets it by… |
|---|---|
| **Autopilot** | one-tap next rep; app decides modality |
| **Decisions** | defaults + progressive disclosure; fewer visible choices |
| **Phone-fit** | 390px-first, thumb zone, 44px, no h-scroll |
| **Time-respect** | <5-min payoff, instant resume, no reading gates |
| **Diagnostic-aware** | recent diagnostic biases the next pick + visible gap chip |
| **Progress-visible** | ambient streak/delta/readiness on the opened surface |
| **ADHD-fit** | one focus, calm fields, quiet delight, no menu mazes |

A slice is only "done" when it *raises* the score on the dimension(s) it targets,
verified with before/after screenshots — not merely "doesn't regress."
