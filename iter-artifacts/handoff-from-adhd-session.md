# Handoff — uncommitted work after the ADHD-mode session (2026-05-27)

This session landed three commits on `main`:

```
3f2e555 [product/content] sharpen L1 distractor quality across 124 lessons   ← your own commit
855670a [product/content] Conversation + Walkthrough for the final 23 problems — 122/122 coverage
8f4b353 [product/feature] ADHD reading mode — bionic + marker + spacing on Conversation, settings toggle
```

It deliberately left **3 in-flight workstreams** uncommitted in the working tree
because they predate the session and belong to your own threads. Picking them
up doesn't require any context from the ADHD work — but the order matters and
there are two gotchas where my commits already shipped half-features.

```
M  PROFILE.md
M  css/02-sidebar.css
M  iter-artifacts/navigation-refactor-design.md
M  js/app/03-paths-cram.js                ← shared by workstreams A + B
?? .claude/skills/drill-refine/
?? .claude/skills/refine-rubric/
?? iter-artifacts/refine-ledger.md
?? iter-artifacts/refine-surfaces.md
?? tools/cdp/glossary-quiz.js
?? tools/cdp/topbar-curation-activities.js
```

---

## ⚠️ Gotchas from the ADHD session — half-shipped features

Two features already have their **state-side plumbing** committed in
`8f4b353` (the ADHD commit). That happened because the linter wrote those
hunks alongside the ADHD additions and they couldn't be cleanly separated
without `git add -p`. **Don't re-add them when you commit the renderers** —
the JSON state field and load/save lines are already at HEAD:

| Feature             | Already at HEAD (commit 8f4b353)                                                      | Still dirty                                                  |
| ------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Glossary-quiz       | `state.glossaryQuiz` default in `01-state-content.js` + load/save in `04-progress-sr.js` | Renderer in `js/app/03-paths-cram.js`, probe `tools/cdp/glossary-quiz.js` |
| Sidebar curation    | Comment refactor in `_topbarItemFromButton` (`15-init-features-boot.js`) describing the 3 hide channels and naming `applySidebarCuration` + `.sidebar-curation-hidden` | `applySidebarCuration` function in `03-paths-cram.js`, `.sidebar-curation-hidden` CSS in `02-sidebar.css`, probe `tools/cdp/topbar-curation-activities.js`, plus `iter-artifacts/navigation-refactor-design.md` |

Neither half-ship breaks runtime today — both are just **forward-looking
references** in code/comments. The features become whole when you commit
the dirty halves below.

---

## Workstream A — 🧠 Glossary-quiz feature

**What it does** (read from the dirty diff in `03-paths-cram.js:432-560`):
MC quiz over cram glossary terms. 10 cards/session, mixed direction
(half term→def, half def→term), 3 distractors drawn from same field of
other glossary entries, resumable session shown as a "Resume quiz" CTA at
the top of the browse list.

**Files to commit:**
- `js/app/03-paths-cram.js` (renderer hunk: ~427-560 — `wireGlossaryQuizCta`,
  `buildGlossaryQuizQueue`, `renderGlossaryQuizSession`, `GLOSSARY_QUIZ_LEN`,
  helpers)
- `tools/cdp/glossary-quiz.js` (durable probe)

**Watch-outs:**
- This file is **shared with Workstream B** (curation). The renderer hunks
  are around lines 427-560; the curation hunks are around lines 890-1030.
  You can either:
  1. Commit `03-paths-cram.js` once with both A + B together (simpler), OR
  2. Use `git add -p` to split into two atomic commits (cleaner history).
- State plumbing already at HEAD — don't re-declare `state.glossaryQuiz`.

**Suggested commit message:**
```
[product/feature] 🧠 Glossary-quiz — MC drill over cram glossary terms

## Product impact
The cram-plan glossary modal gains a "Quiz me" CTA → 10-card MC session
over the glossary terms (mixed term↔def direction), with resumable mid-
session state. Closes the read-only-glossary gap...
```

---

## Workstream B — 🧭 Plan-based sidebar curation

**What it does** (read `iter-artifacts/navigation-refactor-design.md` diff +
`03-paths-cram.js:890-1030`): a curated plan can list an allowlist of
sidebar buttons (`sidebarButtons[]` on the path entry); buttons outside
the allowlist get `.sidebar-curation-hidden` to disappear from the
sidebar but stay accessible in the topbar Drill/Train/Reflect menus and
the ⌘K palette. The split honors a principle stated in the comment:
*activities are modality (how you recall), not corpus (which lessons
matter) — plans should narrow lessons, not gate recall directions.*

**Files to commit:**
- `js/app/03-paths-cram.js` (curation hunk: ~890-1030 — `applySidebarCuration`
  function + the comment block describing the 3 hide channels)
- `css/02-sidebar.css` (the `.sidebar-curation-hidden { display: none; }`
  rule + its explanatory comment, lines ~332-347)
- `iter-artifacts/navigation-refactor-design.md` (design-doc updates)
- `tools/cdp/topbar-curation-activities.js` (durable probe verifying
  curation-hidden buttons stay reachable via topbar)

**Watch-outs:**
- The comment in `15-init-features-boot.js` (already at HEAD) names
  `applySidebarCuration` and `.sidebar-curation-hidden` — those names must
  match exactly when you commit this workstream.
- Check that something INVOKES `applySidebarCuration()` on the right
  trigger points (path switch, sidebar render, plan view change). The
  current diff shows `applySidebarCuration()` called at line ~1030 of
  `03-paths-cram.js`; verify it's wired into `renderSidebar` and the
  plan-switch handler too.

**Suggested commit message:**
```
[product/feature] 🧭 Plan-scoped sidebar curation — narrow corpus, keep modality

## Product impact
A curated plan's sidebar now shows only the buttons relevant to that
plan's focus, while the same activities stay one tap away in the topbar
menus and ⌘K palette. Cleaner sidebar without sacrificing recall-direction
coverage...
```

---

## Workstream C — 🔄 /drill-refine loop scaffolding

The `/drill-refine` and `/refine-rubric` skills are **already loaded and
listed** in the available-skills system reminder (you've been using them).
What's uncommitted is just the skill definitions on disk + the iter ledger
+ the surfaces backlog that the loop reads/writes.

**Files to commit (all untracked):**
- `.claude/skills/drill-refine/` (whole directory)
- `.claude/skills/refine-rubric/` (whole directory)
- `iter-artifacts/refine-ledger.md` (loop run history, append-only)
- `iter-artifacts/refine-surfaces.md` (catalog of surfaces to score/refine)

**Dependency:** the `/drill-refine` skill cites PROFILE.md as "the law" and
`refine-rubric` as its measurable interpretation, so commit Workstream D
in the same commit (or just before).

**Suggested commit message:**
```
[engineering/meta] /drill-refine + /refine-rubric — refinement loop

Sibling to /drill-improve. Per iter: pick stalest existing surface,
empirical screenshots, first-principles vision pass, rubric score (7
dimensions anchored in PROFILE.md), one concrete refinement, contrarian
sub-agent green-light, ship.
```

---

## Workstream D — 📖 PROFILE.md addendum

Two new sections (~34 lines): **Cognitive style (load-bearing)** and
**Study intent — autopilot**. These are the load-bearing premises the
`/drill-refine` rubric scores against ("ADHD-fit", "Autopilot", etc.).

**Files to commit:**
- `PROFILE.md`

**Order:** commit BEFORE or WITH Workstream C since the refine skills
reference these sections.

**Suggested commit message:**
```
[engineering/docs] PROFILE.md — cognitive style + autopilot intent

Adds the two load-bearing premises that anchor the refine-rubric
dimensions: the ADHD cognitive-style constraints and the "autopilot"
study-intent model.
```

---

## Suggested commit sequence

```bash
# 1. Foundation — premises the rest cite.
git add PROFILE.md
git commit -m "[engineering/docs] PROFILE.md — cognitive style + autopilot intent"

# 2. The refine loop scaffolding.
git add .claude/skills/drill-refine/ .claude/skills/refine-rubric/ \
        iter-artifacts/refine-ledger.md iter-artifacts/refine-surfaces.md
git commit -m "[engineering/meta] /drill-refine + /refine-rubric — refinement loop"

# 3. Glossary-quiz + curation. If splitting cleanly:
git add -p js/app/03-paths-cram.js   # stage only the glossary-quiz hunks (~427-560)
git add tools/cdp/glossary-quiz.js
git commit -m "[product/feature] 🧠 Glossary-quiz — MC drill over cram glossary terms"

git add -p js/app/03-paths-cram.js   # stage the curation hunks (~890-1030)
git add css/02-sidebar.css iter-artifacts/navigation-refactor-design.md \
        tools/cdp/topbar-curation-activities.js
git commit -m "[product/feature] 🧭 Plan-scoped sidebar curation"

# OR simpler: one bundled commit if you don't want the split
git add js/app/03-paths-cram.js css/02-sidebar.css \
        iter-artifacts/navigation-refactor-design.md \
        tools/cdp/glossary-quiz.js tools/cdp/topbar-curation-activities.js
git commit -m "[product/feature] 🧠 Glossary-quiz + 🧭 Plan-scoped sidebar curation"
```

---

## Verification after each commit

Same gates as always — keep them green at every step:

```bash
node tools/validate-data.js             # expect 803 passed, 0 failed
node tools/cdp/appsplit-smoke.js        # expect ✅ PASS — boots, no exceptions

# Feature-specific:
node tools/cdp/glossary-quiz.js           # for Workstream A
node tools/cdp/topbar-curation-activities.js   # for Workstream B
```

---

## Reference — what's at HEAD already (for context when reviewing the diffs)

From this session:
- ADHD Mode toggle (🖍 in Settings) — fully shipped + verified
- Conversation + Walkthrough coverage 122/122 — every Patterns + Applied lesson

From your concurrent work that landed in `3f2e555`:
- L1 distractor sharpening across 124 lessons

The audit script that proves 122/122 coverage (re-run anytime):

```bash
node -e "
const fs=require('fs'),path=require('path');
const m=JSON.parse(fs.readFileSync('data/manifest.json','utf8'));
const slug=n=>n.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-\$/g,'');
let both=0,total=0,miss=[];
for(const s of m.sections)for(const l of s.lessons){
  if(l.track!=='patterns'&&l.track!=='applied')continue;
  total++;
  const j=JSON.parse(fs.readFileSync(path.join('data',slug(s.name),l.id+'.json'),'utf8'));
  const hasC=j.conversation&&j.conversation.sections&&j.conversation.sections.length>=3;
  const hasW=j.walkthrough&&j.walkthrough.trace;
  if(hasC&&hasW)both++;else miss.push(l.id);
}
console.log('Coverage:',both,'/',total,'— missing:',miss.length?miss.join(', '):'none');
"
```
