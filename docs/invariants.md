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

## 3. Every local asset of every routed page is precached

**Rule — a script or stylesheet added to `index.html` OR `system-design.html`
must also be added to `APP_SHELL` in `service-worker.js`, and `CACHE_VERSION`
bumped.**

The offline pack precaches a hand-maintained list. Miss an entry and the app
works perfectly online and breaks only for offline users — a population no local
test covers. This bit the share codec on the day it landed.

It has a second failure mode that is worse, because it hits users who are
*online*. The fetch handler adds any successful same-origin GET to the cache, so
a page outside `APP_SHELL` still gets cached — it just never gets refreshed by
an install. Under the old cache-first-for-everything strategy that froze it for
the entire life of the `CACHE_VERSION` string, which is bumped by hand.
`system-design.html` sat outside the list for its whole life and did exactly
that: returning users kept a copy from several releases back — no nav rail, no
bottom bar, no header — while `index.html`, which IS in the list, looked
current. Two halves of one product, different vintages, same phone, same
deploy. Code (`.html`/`.js`/`.css` and any navigation) is network-first now, so
a stale shell can no longer outlive a deploy; the drill payload stays
cache-first, which is what the offline pack is for.

**Gate** — `tools/check-sw-shell.js` asserts parity in both directions, for
every routed page: each page is itself precached, every local `js/`/`css/`/`ds/`
asset it references is precached, and every precached path exists. Add a page
to its `PAGES` list when the app can navigate to it.

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

## 9. One icon vocabulary

**Rule — every glyph in the UI comes from `ds/icons.js`. No emoji in chrome, no
text glyph standing in for an icon, no inline `<svg>` anywhere else.**

The failures are quiet ones. A typo'd icon name makes `dsIcon()` return `''` —
an icon that silently isn't there. A launchable mode with no `DS_MODE_ICONS` row
renders the label's first LETTER in a row of icons. Neither throws.

**Gate** — `tools/check-icons.js`, five checks, flat zero, no escape hatch. It
shipped as a ratchet against 492 legacy glyphs; that backlog is cleared, so the
budget and `--accept` are gone. Full rules in
[`iconography.md`](iconography.md).

---

## 10. One runner grades lesson content

**Rule — the code the app runs a drill with and the code the validator certifies
an `expectedOutput` with must be the same code.**

Invariant 6 says lesson content must be executable. This is the other half: it
must be executable *the same way in both places*. If the validator and the app
disagree about how a `Map` prints, whether `console.error` is prefixed, how many
macrotasks are drained, or whether the body is strict, then the validator
green-lights an `expectedOutput` the app then grades as WRONG — and the user
types the canonical perfectly and is told they failed.

This was broken for a long time and nothing could see it, because the two
implementations were only ever compared to themselves. There were **four**:
`js/core/runner.js` plus private copies in `validate-data.js`, `verify-lesson.js`
and `validate-files.js`, each asking the others to stay in sync via a comment.
Measured, 9 of 10 probe cases diverged, and one shipped lesson (`s-strings`
L2#0) asked the user to complete an assignment that throws under the app's
strict-mode wrapper while the sloppy-mode validator passed it.

**Gate** — `tools/test-runner-parity.js`, in two directions. Structurally, no
tool in `tools/` may define its own `formatArg`/`runCode`/`outputsMatch`; they
must grade through `tools/lib/runner-node.js`, which loads the app's real
runner. Behaviourally, every observable an `expectedOutput` can depend on is
pinned as an explicit expectation, so changing one forces you to notice that
every authored output containing it just became wrong.

**Escape hatch** — none. The engines may differ in exactly one place, TypeScript
type erasure, and that is injected via `DrillRunner.setTypeEraser()` rather than
forked.

---

## 11. Nothing on the boot path comes from someone else's server

**Rule — the three user-facing pages load no third-party origin, and everything
they do load is precached.**

The pages used to pull Tailwind, CodeMirror, Supabase and Mermaid from cdnjs and
jsdelivr. Four separate failures, only one of them performance:

- **Offline was a lie.** The service worker bypasses cross-origin requests, so
  none of it could be precached. An offline cold start rendered an unstyled page
  with no code editor — the L3 drill simply absent. This file's own header
  promised the fix ("v2 will vendor the CDN assets") for as long as the offline
  pack existed.
- **No integrity.** Not one of the ten CDN tags carried an `integrity`
  attribute.
- **No pin.** `@supabase/supabase-js@2` is a range; the code executing in a
  user's browser could change with no commit here.
- **Tailwind's CDN script is the compiler**, not a stylesheet — it shipped
  ~400 KB to every visitor to re-derive the same 119 utility classes on every
  load, on the phone that is ~80% of study time.

**Gate** — `tools/vendor-deps.js --check` verifies a SHA-256 per file against
`vendor/lockfile.json`, rejects anything in `vendor/` it did not put there, and
fails if any page names a CDN again. `tools/check-tailwind-subset.js`
re-derives the used utility set with an independent scanner and fails on
anything used but not built, plus asserts preflight survived (`css/01-base.css`
has no reset of its own). `tools/check-sw-shell.js` requires it all to be
precached — and now takes a directory LIST and fails on any local asset
directory missing from it, because it previously hardcoded `(?:js|css|ds)/` and
was blind to `vendor/` entirely.

**Escape hatch** — one, documented in `tools/vendor-deps.js`: the TypeScript
compiler stays a pinned lazy fetch. It is 8.9 MB and serves the 3 lessons that
declare `"lang":"ts"`, so vendoring it would grow the repo by more than every
other dependency combined for a path that never runs at boot.

---

## 12. A probe that isn't run isn't coverage

**Rule — every `.js` directly in `tools/cdp/` is registered in `PROBE_SUITE` or
explicitly allowlisted as a manual tool, and the docs may not describe coverage
that doesn't run.**

`tools/cdp/` held 186 files while `--probes` ran 15. Nothing on disk
distinguished them, so both a human and an agent reading the directory saw a
186-file test suite that was a 15-file suite plus a museum. The unregistered
ones rot silently — when the 6 that the docs described as durable were finally
measured, 4 had rotted (one scoring 0 of 70) and 2 were fine and had simply
never been wired up.

**Gate** — `tools/check-probe-registry.js`. Historical probes live in
`tools/cdp/archive/`.

**Escape hatch** — `MANUAL` in that file, for hand-driven tools that print
output for a human rather than asserting. Each entry carries a reason.

---

## 13. The docs may not name files that don't exist

**Rule — every markdown link target and every file-layout-table path in the
living docs resolves.**

CLAUDE.md is loaded into every session by every agent, and its file-layout table
is the map everyone navigates by. It documented `app.css` (~3,955 lines), a file
that had been split into `css/` months earlier; it kept a row for
`js/app/25-breadcrumb.js` two rows below the line saying it had been absorbed;
and it stated `__v: 5` in four places while the code writes 6. The document had
accumulated eight self-corrections in its own prose — "audit F17", "had been
wrong", "is not what ships", "measure, don't quote" — which is what a doc looks
like when it has learned not to trust itself.

Prose about behaviour genuinely cannot be gated. Prose that names a **file**
can.

**Gate** — `tools/check-doc-paths.js`. Deliberately narrow: an earlier version
flagged 1207 "paths" including `do/while` and `[product/fix]`, and a gate that
cries wolf is one people learn to skip.

**Escape hatch** — fenced code blocks are exempt (they hold transcripts and
quoted historical commit messages, where a stale path is part of the record),
as are `iter-artifacts/`, `docs-archive/` and `docs/**/archives/`.

---

## 14. The boot path has a budget

**Rule — each page declares a ceiling for the bytes it makes a phone fetch
before the app is usable, and staying under it is checked.**

PROFILE.md's one load-bearing fact is that ~80% of study happens on a phone.
Nothing measured what a phone actually downloads, so the boot path could only
grow: every slice, stylesheet and library was individually reasonable and
collectively unbudgeted. It had gone badly wrong — the pages were fetching the
Tailwind *compiler* (~400 KB) to generate the same 119 classes in every
visitor's browser, and `system-design.html` pulled 3.5 MB of Mermaid in a
`<script defer>` on every visit, for the many visits that never open a diagram.
Fixing those took `system-design.html` from 4073 KB to 593 KB.

**Gate** — `tools/check-boot-weight.js` (`--report` prints the per-file
breakdown). Uncompressed same-origin bytes the page loads eagerly; pages are
served gzipped so the wire cost is roughly a third, and the ratio is stable
enough that budgeting the raw number is the simpler honest measure.

**Escape hatch** — raise the budget, in the same commit that spends it. The
number is set with headroom; the point is to make a large regression a
conversation rather than an accident, and to keep the diff honest about who
chose to spend it.

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
