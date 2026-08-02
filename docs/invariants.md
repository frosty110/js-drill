# Invariants

Standing constraints for this project — the rules that, if broken, produce
failures you **cannot see by looking at the app**. Each one has a gate that
enforces it, an escape hatch for when breaking it is genuinely intended, and a
note on what actually goes wrong.

Everything here is machine-checked. `node tools/check-all.js` runs the lot.

```bash
node tools/check-all.js          # verify (pre-commit / CI)
node tools/check-all.js --fix    # regenerate what is generated, then verify
```

Enable the pre-commit hook once per clone:

```bash
git config core.hooksPath .githooks
```

CI runs the same command on every push (`.github/workflows/checks.yml`), so the
hook is convenience and CI is the actual gate.

---

## The general shape

Ordinary bugs announce themselves — a broken layout, a thrown error, a red
test. The rules below all guard a different class: **changes where every visible
signal stays green and the meaning quietly becomes wrong.** A reordered question
still renders. A missing precache entry still boots. That is why they need
mechanical gates rather than review attention.

---

## 1. Authored order is frozen

**Rule — never reorder or remove a question or an option. Appending is safe;
rewording in place is safe.**

Share codes are positional (see [`share-urls.md`](share-urls.md)): character N
of `?s=AbbCdAbC.Yn.n` is question N, and the letter is the option's **authored
index**. Position *is* identity. There are no question ids to fall back on.

So swapping two questions — or reordering options to "put the strongest
distractor last" — silently repoints every URL already shared for that lesson.
Nothing looks broken. The page renders, the code decodes, and an AI is told with
full confidence that the user missed a question they never saw.

| Change | Allowed | Why |
|---|---|---|
| Append a question or option at the end | ✅ | Existing positions keep their meaning |
| Reword a question or option in place | ✅ | Identity is positional, not textual |
| Swap / reorder | ❌ | Every existing code repoints |
| Delete | ❌ | Codes past that position overrun the content |
| More than 8 options | ❌ | Beyond the `A`–`H` alphabet; a pick encodes as `-` |

**Gate** — `tools/check-content-order.js` keeps a fingerprint of every question
and option, in order, in `data/content-order.lock.json`. It distinguishes a
reorder from an edit and fails only on the former. Its comparison has its own
tests (`tools/test-content-order.js`), because a gate that quietly stops
detecting is indistinguishable from a green build.

**Escape hatch** — when the break is intended and the invalidated codes are
acceptable:

```bash
node tools/check-content-order.js --accept
```

That re-baselines the lock and prints what it costs. Use it for a genuine
content correction, never to quiet the gate.

**Known limit** — a swap that *also* rewords both items reads as two edits.
Text edits are indistinguishable from swap-plus-edit by content alone; closing
it would require stable authored ids on every question, a schema change this
project hasn't needed. The accidental case — reordering without rewording — is
caught.

---

## 2. Generated output is committed

**Rule — regenerate and commit `p/`, `sd/`, `sitemap.xml`, `robots.txt` after
any content change.**

GitHub Pages serves the static share pages straight from the repo. They are
build output that lives in version control, so stale output ships silently: the
app shows a new question, the crawlable page an agent fetches still shows the
old one.

**Gate** — `node tools/build-share-pages.js --check` fails when the committed
output differs from what the current content would produce. CI additionally
fails if a gate regenerated something the author forgot to stage.

**Fix** — `node tools/build-share-pages.js` (or `check-all.js --fix`).

---

## 3. Every local asset is precached

**Rule — a script or stylesheet added to `index.html` must also be added to
`APP_SHELL` in `service-worker.js`, and `CACHE_VERSION` bumped.**

The offline pack precaches a hand-maintained list. Miss an entry and the app
works perfectly online and breaks only for offline users — a population no local
test covers. This bit the share codec on the day it landed.

**Gate** — `tools/check-sw-shell.js` asserts parity in both directions: every
local `js/`/`css/`/`ds/` asset `index.html` references is precached, and every
precached path exists.

---

## 4. Every persisted field has a sync policy

**Rule — a new field in `saveProgress()` must be registered in one of the three
key registries in `js/sync.js`.**

Without a policy a field rides the carry-over base and gets silently dropped on
every sync — the class of bug that once wiped `state.history` and with it the
consistency map.

The three registries encode the decision, not just the plumbing:

| Registry | Meaning |
|---|---|
| `EXPLICIT_MERGE_KEYS` | Has a named merge block — union, newest-wins, per-field |
| `ADDITIVE_STAT_KEYS` | Lifetime counters — MAX-merged so they're idempotent |
| `PREFER_LOCAL_KEYS` | Device state that deliberately never converges |

**Gate** — `tools/check-sync-coverage.js` parity-checks every `saveProgress` key
against the union of the three.

When you add a merge rule, update `js/sync.js`'s header docs and
`tools/cdp/sync-merge.js` (unit tests per rule) alongside it.

---

## 5. One source of truth per concern

**Rule — don't re-declare what already has an owner.**

| Concern | Owner | Never |
|---|---|---|
| Share-code character table | `js/sharecode.js` | Duplicate the alphabet anywhere |
| Addressable surfaces / URLs | `js/routes.js` | Hand-concatenate a share path |
| Design tokens | `ds/tokens.css` | Hard-code hex; re-declare in a page `:root` |
| UI primitives | `ds/components.css` | Rebuild a button/sheet/card locally |
| Icons | `ds/icons.js` | Inline a one-off `<svg>` |
| localStorage I/O | `js/storage.js` | Call `localStorage` directly |

This one is reviewer-enforced, not mechanical — the failure mode is drift, which
took the iter-35 incident to make anyone care. Load the
`.claude/skills/ui-consistency/` skill before building UI; it is the enforceable
short form.

---

## 6. Lesson content is executable

**Rule — every `L2` template filled with its answers, and every `L3.canonical`,
must produce its declared `expectedOutput` exactly.**

The drill grades on output. A canonical that doesn't run is a lesson that can
never be passed.

**Gate** — `tools/validate-data.js` executes all of it under the same runner
semantics the browser uses, plus manifest/disk parity, the banned-syntax list,
walkthrough traces, and the PROFILE density floor (≥3 L1, ≥2 L2).
`tools/validate-system-design.js` covers the system-design corpus.

---

## Adding an invariant

If you find yourself writing "remember to…" in a doc, that is a rule without a
gate, and it will be forgotten. Prefer this order:

1. **Make it impossible** — a registry with one row per surface beats a
   convention about naming paths.
2. **Make it fail loudly** — a check with a message that says what broke, what
   it costs, and what to do instead.
3. **Only then document it** — and point the doc at the gate.

To add a gate: write the check as a standalone `tools/check-*.js` that exits
non-zero with an actionable message, add a row to `GATES` in
`tools/check-all.js`, and add a section here. The hook and CI pick it up with no
further change.
