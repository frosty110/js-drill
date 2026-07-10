# Decision Log (append-only)

Every product-shaping choice — nav model, what retires, a divergence from a
default — gets one entry. This is the anti-drift record: future iterations read
it to avoid relitigating settled calls. Never rewrite history; supersede with a
new entry if a decision changes.

Format:
```
## D<NN> · <short title>  (<date> · iter <N>)
Decision: <what was decided>
Rationale: <why, tied to PROFILE/PERSONAS/PRINCIPLES>
Alternatives considered: <what was rejected and why>
Reversible? <yes/no + how>
```

---

## OPEN (awaiting resolution — do not build past these until decided)

### OD2 · Visual direction  *(pending mockup selection)*
User chose to pick from pixels. Default family is **Calm Focus** (editorial dark,
restraint, one accent). Phase 0 renders **2–3 sample-screen mockups** in distinct
premium moods; user selects one, then it's recorded as resolved and drives the
`tokens.css`/`components.css` pass. Do not lock `components.css` colors/type until
this resolves.

---

## RESOLVED

## D01 · Primary navigation model = adaptive rail ↔ bottom bar  (2026-07-10 · iter 0)
Decision: **Adaptive navigation** — a bottom tab bar on mobile (thumb-first) that
becomes a left rail on desktop. Four destinations: **Today · Browse · Practice ·
Progress**; Settings via a profile/gear; the ~60-mode long tail behind the
Practice launcher + command palette.
Rationale: serves the 80%-phone, ADHD, one-tap-to-drill user (bottom bar =
thumb-native, always-visible orientation, caps persistent chrome at ~4) while
giving desktop a first-class rail. Maps today's 4 dropdowns + 60 modes onto a
coherent, low-overwhelm structure; every job ≤2 taps.
Alternatives considered: pure bottom bar (rejected: weaker desktop); hub-and-spoke
no-nav (rejected: too much round-tripping for the app's breadth — Browse/Progress/
Settings friction).
Reversible? Yes — nav shell is P1; swappable before deeper screens depend on it.

## D02 · Theming = dark-first, light-ready tokens  (2026-07-10 · iter 0)
Decision: Ship one polished **dark** theme for v1; structure `tokens.css`
semantically (surface / on-surface / accent / status roles) so a **light** theme
is an additive flip in P9/P10, not a rewrite.
Rationale: app is already dark, dev audience skews dark-preference, and dual
themes tax every redesign slice. Nail one; keep light cheap to add. The real
light-mode win (outdoor phone legibility) is preserved as a future flip.
Alternatives considered: ship both now (rejected: doubles design/QA, slows the
loop); dark-only forever (rejected: forecloses outdoor legibility).
Reversible? Yes — semantic tokens make light additive.
