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

### OD1 · Primary navigation model
Options: **(a) bottom tab bar** (thumb-first, mobile-native; recommended for the ~80%-phone user) · (b) adaptive left rail collapsing to bottom bar · (c) hub-and-spoke home with no persistent nav. Needs user sign-off before P1.

### OD2 · Visual direction
The specific mood within the design language — accent hue, type pairing, density, corner/elevation feel. Needs a direction (or a small moodboard of 2–3) signed off before the `components.css` pass.

### OD3 · Light + dark vs dark-only for v1
Current app is dark. Decide whether the redesign ships both themes now or dark-first.

---

## RESOLVED
- (none yet)
