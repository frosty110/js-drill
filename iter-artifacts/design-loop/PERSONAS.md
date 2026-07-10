# Personas & Contexts

Derived from `PROFILE.md` (the source of truth). If this file and `PROFILE.md`
ever disagree, `PROFILE.md` wins. Personas exist to make design decisions
concrete: when unsure, ask "what would *this person, in this moment* need?"

---

## PRIMARY PERSONA — "The Rusty Returner"

**One line:** an experienced engineer whose concepts are intact but whose
syntax, pattern recall, and interview cadence have gone rusty — prepping to
interview again, mostly from a phone, in minutes-long bursts.

**Profile**
- Wrote code professionally; went to management / a different domain / a break.
- **Knows the concepts** (hash map, BFS, closures) — needs zero fundamentals pedagogy.
- **Forgets the exact syntax** (`Array.from`, `flatMap`, `Object.entries`, arg order, generators, iterator protocol) and can't produce a canonical pattern from a blank editor in 5 minutes anymore.
- **Out of interview shape** — the read→approach→code→test→reason cadence under time pressure.

**Cognitive style (load-bearing)**
- **ADHD** — limited working memory for parallel choices. Menus-of-menus are costly. A 1-button "Begin" beats a 5-option card.
- **Low overwhelm tolerance** — presenting 6 options and asking them to choose is friction, not flexibility. Sensible defaults > exhaustive options.
- **Time-boxed** — sessions are minutes (one bus ride, one queue). Every surface, including dashboards, must pay off in <5 minutes.

**Mental model: "Pick a plan, go on autopilot."** Once subscribed to a plan, the app should surface **one** next action (lesson or drill — the app decides), bias it with recent diagnostic signal, show progress at a glance, and otherwise get out of the way.

**What they need:** fast syntax re-memorization · pattern fluency · interview-format conditioning · spaced reinforcement · learning-science-backed memorization tooling.

**Design implications**
- Default posture is **"press one thing → you're drilling."** Any surface that adds a decision *before* drilling must justify itself loudly.
- Optimize the **tap-based L1** and **short-typing L2** loops; treat **L3 (blank editor)** as the at-desk tier — never the main mobile surface.
- Progress/score is **ambient** (streak, today-vs-yesterday, diagnostic-gap chip on the surface they already opened), not a place they must navigate to.

---

## SITUATIONAL PERSONAS (same person, different moment — design for all)

### S1 · The Commuter (the ~80% case)
On transit / in line / on the couch. One hand, thumb-driven, glanceable, interruptible. **Highest-throughput = L1 tap + L2 short-type in 30-second cycles.** Sessions can end abruptly (stop arrives) — never lose their place; resume instantly.
→ *Design for: thumb-zone actions, big targets, one-glance state, instant resume, no long reading gates.*

### S2 · The At-Desk Deep-Diver
At a keyboard, a longer block, focused. Willing to do L3 blank-editor reps and mock interviews. Wants density and keyboard control (palette, shortcuts).
→ *Design for: the desktop-adaptive layout, L3/mock as first-class here, keyboard-complete flows.*

### S3 · The Interview-Eve Crammer
Interview in days. High-anxiety, high-intent. Wants a curated cram path, the crux of each pattern, and a confidence read on readiness — fast.
→ *Design for: a clear cram/plan surface, "key ideas" crux views, readiness signals; no busywork.*

### S4 · The Eyes-Free Slice (proposed, not yet ratified — see PROFILE amendments)
Walking / gym / dishes — phone present, screen not viable. Listen-and-acknowledge (TTS + single tap). L1 Q/A is the natural unit. *Do not build against this until the PROFILE amendment is ratified; note it so the nav model can accommodate it later.*

---

## ANTI-PERSONA (explicitly NOT who we serve)
- The **beginner** learning CS fundamentals from scratch ("what is a hash map").
- The **reader** who wants verbose pedagogical prose over canonical code + terse notes.
- The **completionist** who wants every option exposed at once.
Designing for these degrades the experience for the Rusty Returner. Don't.

## The one-question test
For any screen or control, ask: *"Does this get the Rusty Returner, on a phone,
with 20 free minutes, drilling the right thing faster and with less thinking?"*
If not, it's decoration or friction — cut or demote it.
