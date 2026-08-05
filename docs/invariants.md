# Invariants

Standing constraints for this project — the rules that, if broken, produce
failures you **cannot see by looking at the app**. Each one has a gate that
enforces it, an escape hatch for when breaking it is genuinely intended, and a
note on what actually goes wrong.

Everything here is machine-checked. `node tools/check-all.js` runs the lot.

```bash
node tools/check-all.js          # verify (pre-commit / CI)
node tools/check-all.js --fix    # regenerate what is generated, then verify
node tools/check-all.js --probes # …and then drive the durable browser probes
```

The first two forms need nothing but node, and that is load-bearing: the
pre-commit hook and CI run exactly `node tools/check-all.js`, so it has to stay
fast and browser-free. **Do not add a browser step to either.**

`--probes` is the opt-in third form (audit F19). It runs the same gates, then
each durable CDP probe in `PROBE_SUITE` in turn — boot smoke, page frame, home +
review nav, share URLs, the two system-design suites, sync merge — and prints a
pass/fail line per probe. It needs Chrome on `:9222` (the probes start Chrome and
the static server themselves) and takes a few minutes. **Run it before shipping
anything user-facing**, and after any change to navigation, the page frame, the
share pages or the system-design corpus. Before F19 nothing ran these at all, and
two sat red unnoticed — one of them for a content *addition* that a hardcoded
expectation hadn't kept up with.

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

**Partial gate, read the fine print** — the executability half is fatal, the
density floor is only a *warning* by default. `--strict-density` turns it into a
non-zero exit, and it isn't on because the existing backlog would fail every
build: 91 of 171 lessons sit below the ≥2 L2 floor as of 2026-08-02 (audit F4).
Until that is cleared, "the validator is green" does **not** mean the density
floor holds.

---

## 7. Every addressable thing is fetchable

**Rule — if a user can look at it, it has a URL; if it has a URL, fetching that
URL with no JavaScript returns it.**

Three consumers read our URLs and only one runs JavaScript: AI agents the user
pastes a link into, the user's own copy-paste to a colleague or another device,
and search crawlers. A hash fragment is **never sent to the server** (RFC 3986),
so `system-design.html#/design-problems/p03` and the bare shell are the same
bytes — every hash route returns `Loading…` to all three.

This is a URL *design* constraint, not a rendering one. It is unaffected by
whether pages are templated, pre-built or client-rendered, which is why it needs
its own rule: the obvious diagnosis ("we render on the fly") points at the wrong
fix.

Path is identity, query is view state, fragment is position within a document
the server already returned. Full contract, including the parts still unbuilt:
[`url-contract.md`](url-contract.md).

Every route declares a **disposition**: `content` (denotes something that exists
independently of the reader — gets a static page) or `action` (a personal,
stateful session like "what's due for me" — no page, but declares a `fallback`
so it still resolves). `action` is a declaration, not an exemption.

**Gate** — `tools/check-url-contract.js`. Four checks compare the registry to
disk: content surfaces resolve to files, both app pages carry an agent bridge
that cites a real path and is blanked on boot, the sitemap is complete, and a
unit with diagrams or sheets actually renders them. The fifth **reconciles the
registry with the app's router** — round-tripping `appHash ⇄ appParams` and
`path ⇄ params` for every surface, checking each `action`'s fallback is real
content, and asserting `system-design.html`'s `ROUTE_VIEW` names only registered
surfaces.

That fifth check is the one that matters. The first four were all green while
`mixed`, `due`, `plan` and `tag` were live app routes no surface named — because
nothing compared the two hand-written sources of routing truth. The app's router
now *consumes* the registry (`DrillRoutes.parseAppHash`) rather than restating
it.

Assert against rendered elements, never a whole-file substring search, or a
check will pass on a page stripped bare (one did). The gate also rejects any
generated path that is not URL-safe — derived tag values were briefly producing
paths with spaces and ampersands that the app's own sanitiser would have
stripped, so the two spellings could never have agreed.

If you touch these, break something on purpose and confirm it goes red.

**Adding a surface** — add a row to `SURFACES` in `js/routes.js`, generate its
page in `tools/build-share-pages.js`, and the gate picks it up with no further
change. If the app can put the user somewhere the registry doesn't name, that
place has no URL and the contract is already broken.

---

## 8. Every graph edge says what it is for

**Rule — a component tagged onto a design problem must carry an annotation
saying what that component is *doing* in that problem.**

The component catalog and the canonical design problems are two directions
through one graph. `tags.mechanism` supplies the edges; `mechanism-map.json`
supplies the meaning. Both endpoints render the same annotation.

Without it the surface still works, and that is the danger. A component page
would list eleven problem names, a problem page would list four component names,
every link would resolve, nothing would be red — and the page would teach
nothing, because "News Feed uses caching" is not a fact anyone needs. What they
need is *"the per-user timeline of post IDs, hydrated on read"*, which is a
different job from caching in the URL shortener despite the identical tag.

The annotation is written once and rendered at both ends, so it must be a
**predicate about the job**, never a sentence that only parses from one side.
"…the per-user timeline of post IDs" reads correctly on both pages; "News Feed
uses caching for its timeline" is nonsense on the News Feed page.

**Gate** — `validateCatalog()` in `tools/validate-system-design.js`. Seven
checks; the load-bearing one is **coverage**: for every component declaring a
`mechanism`, every design problem already tagged with that mechanism must have
an annotation. Tagging a problem and forgetting the annotation is a build
failure rather than a page that quietly degrades into a link farm. The rest
guard the things that also fail silently — a category that doesn't exist (the
component renders nowhere), a mechanism not in `tags.json` (the chip deep-links
to an empty list), a dangling `alternatives` id, a "this problem uses…"
preamble, and an annotation over 220 characters.

Extra annotations beyond the tagged set are expected, not merely allowed. The
facet indexes each problem's 2–4 *headline* mechanisms and stays that size on
purpose — it is the filter index, and a 60-chip panel is unusable on a phone.
The catalog is finer: 253 edges over 65 components, ~7 per problem. So the
problem→component list is derived from the **edge file**, and the tagged ones
are marked *signature* rather than being the only ones shown.

A component with **no** edges is reported, not failed: that failure is visible
on the page ("not yet mapped to a canonical design problem"), and invariants are
for the ones you cannot see.

**Escape hatch** — none needed. Removing the mechanism tag removes the
requirement, which is the honest way to say "this isn't really used here."

Full contract: [`component-catalog.md`](component-catalog.md).

---

## Open debt: four design problems ship without artwork

Not an invariant. A record of one being suspended, so it does not become
archaeology.

`p33`–`p36` (the financial-crime set) carry `"pending": true` in
`infographic-plan.json`. Their text is authored and gated like everything else;
their hand-drawn sheets do not exist.

That flag is an escape hatch `validateSheets()` has always carried and which
**nothing had ever used**. The comment above it says why: a missing sheet was
meant to fail hard, so the red gate *was* the artwork to-do list. Four uses of
it means the gate is green while four problems have no sheets, and the to-do
list it replaced no longer exists.

So the debt is recorded here instead. `node tools/validate-system-design.js`
reports it on its OK line (`4 pending artwork`), which is the only other place
it is visible.

**To clear it** — draw the four sheets at 1440×2280, add them to
`infographic-sets.json`, and delete the four `"pending": true` lines. Deleting
them without the artwork restores the red gate, which is the intended state.

**Do not reach for this flag again** without deciding, deliberately, that the
red gate is no longer the to-do list. Its value came entirely from being unused;
a second batch of pending entries turns the count into a number nobody reads.

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

If the check can only be made in a browser, it is a probe, not a gate: put it in
`tools/cdp/`, make it exit non-zero on a failed assertion, and add a row to
`PROBE_SUITE` in `tools/check-all.js` so `--probes` picks it up. Derive every
expected count from the data at run time rather than hardcoding it — a probe that
goes red when someone *adds content* teaches people to ignore it.
