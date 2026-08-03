# Shareable, crawlable URLs

Every drillable surface has a stable URL that resolves to a **plain HTML page an
AI agent can actually fetch**, and that URL can carry the user's per-question
result set in a compact `?s=` code. Paste one link into a chat window and the
model has both the topic and exactly what you missed — enough to run a targeted
tutoring conversation without you describing anything.

No backend, no share records, no cache, no sign-in. The link is built at click
time from live state, and everything needed to decode it is printed on the page
it points at.

---

## The URLs

| Surface | Share URL | Live app |
|---|---|---|
| Coding lesson | `p/two-sum/?s=AbbCdAbC.Yn.n` | `index.html#/two-sum/L1` |
| All lessons | `p/` | `index.html#/m/browse` |
| System-design unit | `sd/design-problems/p01/?s=YppnY-YnYY` | `system-design.html#/design-problems/p01` |
| System-design topic | `sd/ddia/` | `system-design.html#/ddia` |
| System-design index | `sd/` | `system-design.html#/` |

A system-design unit page also carries a **Diagrams** section: every committed
study sheet as a real `<img>` (so a fetcher gets the picture, not a reference to
one) plus each authored diagram's source. The `#drill-data` index lists them
under `sheets[]` and `diagrams[]`, each sheet with a direct `url` and the
`appUrl` that opens it full-screen in the app. Before this the page carried the
questions but no visual at all, so an agent could read the rubric and then
truthfully report it could not see a diagram.

Every URL ends in a **trailing slash**. Each surface is written to disk as
`<dir>/index.html`, so the slash form is the file's real address and GitHub
Pages serves it in one hop. The slashless form only 301-redirects there —
fetchers that don't follow redirects fail outright, and some drop the `?s=`
across the hop, silently losing the result set. Links shared before this
became the default still parse, so nothing already sent out breaks.

Deep anchors work on every page — `p/two-sum/?s=AbbCdAbC.Yn.n#q3` opens on
question 3. A whole session across lessons fits one URL:

```
p/?s=two-sum:AbbC.Y.n,lru-cache:AAbD.Y.Y
```

The two URL families never collide: the SPA owns the hash, the static pages own
the path. A hash fragment is never sent to a server, which is exactly why the
app's own `#/two-sum/L1` routes can't be crawled and these can.

---

## The code

One character per question, **positional against authored order**. Authored
order never changes (adding a question appends), so position N in the code is
question N on the page. No ids, no lookup table.

| Character | Meaning |
|---|---|
| `A B C D` | multiple choice — picked this option, **correct** |
| `a b c d` | multiple choice — picked this option, **wrong** |
| `Y` | open / typed / fill-in — got it |
| `p` | open — partial credit (system-design self-grade) |
| `n` | open / typed / fill-in — missed |
| `-` | not attempted |

**Case carries correctness: uppercase = credit, lowercase = no credit.**

That is the design's one real idea. `AbbCdAbC` doesn't just say *that* questions
2, 3 and 5 were missed — it says **which distractor pulled you each time**,
which is usually the more diagnostic fact. "You picked the O(n²) option twice"
is a different tutoring conversation from "you missed two questions."

Letters run `A`–`H` (8 options max, well above the 4 anything in the corpus
uses). The ceiling keeps the MC range clear of `Y` / `p` / `n`, so **every
character is self-describing** — a decoder never needs to know whether a
question was multiple choice or self-graded. That is what lets an agent decode
a code from the legend alone.

### Grammar

```
code     := segment ( "." segment )*
session  := entry ( "," entry )*
entry    := id ":" code
```

- **Coding lessons** always emit **exactly three** segments — `L1.L2.L3` — even
  when one is empty. A lesson with no L2 encodes as `AbC..Y`. Fixed arity is
  what keeps level parsing positional.
- **System-design units** emit **one** segment: a flat question list.

The letter is always the **authored** option index. The app reshuffles both
question order and option order every session, so display position is
meaningless the moment the URL leaves the page.

There is no version prefix, no checksum and no compression. The code is meant to
be read by a human at a glance and by an agent with no library; bytes spent on
machine ceremony cost exactly that. Forward compatibility comes from the
character table being append-only, and unknown characters decoding to a defined
`unknown` kind rather than throwing.

---

## Why an agent can read it with zero JavaScript

`?s=` can't be decoded client-side for a crawler, and GitHub Pages can't decode
it server-side. It doesn't need to be decoded at all:

1. The **page** carries the questions in fixed order, the answer key, and the
   legend above printed verbatim.
2. The **URL** carries the code — and the agent was handed the URL.
3. Zipping the two is trivial.

Each generated page also embeds a `<script type="application/json"
id="drill-data">` index — the ordered question list with correct answers and
letters — so an agent can align a code without parsing HTML at all.

`js/share-page.js` decodes `?s=` for human visitors (marks the picked option
inline, renders a results table). It is pure progressive enhancement: the page
is complete without it.

### Staleness

Positional encoding is only as good as the ordering it points at. If a code
claims credit for an option that is not the page's answer, it predates a content
edit — the page flags those rows **"code out of date"** rather than reporting a
verdict. An old link degrades into a visible warning, never a confident lie.

---

## Architecture

| File | Role |
|---|---|
| `js/sharecode.js` | The codec. `encodeLesson` / `encodeUnit` / `decodeLesson` / `decodeUnit` / `summarize` / `readShareParam`. Pure, no DOM, runs in the browser and under Node. **The character table lives here and nowhere else.** |
| `js/routes.js` | The addressable-surface registry. One row per surface: static path, app hash, path parser, sitemap flag. Adding a crawlable surface is one row. |
| `js/app/24-share.js` | Main app: per-question capture (`state.answers`), code building from live state, the share sheet, the Copy-for-AI payload. |
| `js/share-page.js` | Progressive enhancement on the generated pages. |
| `tools/build-share-pages.js` | Renders the static pages, `sitemap.xml`, `robots.txt`. `--check` fails on stale output. |
| `tools/test-sharecode.js` | 162 unit tests — round-trip identity, degradation, validation, registry round trips. |
| `tools/cdp/share-urls.js` | Browser probe — capture → code → sheet → static page → decode, on both apps. |
| `css/12-ds-share.css` | Share sheet. |
| `css/13-share-page.css` | Static pages. |

### Adding a surface

Add one row to `SURFACES` in `js/routes.js`:

```js
{
  kind: 'sdTopic',
  dir: 'sd',
  arity: 1,
  codeKind: null,                                    // 'lesson' | 'unit' | null
  sitemap: true,
  path:    p => `sd/${encodeURIComponent(p.topic)}`,
  appHash: p => `system-design.html#/${encodeURIComponent(p.topic)}`,
  params:  segs => (segs.length === 1 ? { topic: segs[0] } : null)
}
```

Then emit it from `tools/build-share-pages.js`. Share URLs, backlinks, path
parsing and the sitemap all follow from the row.

---

## State

Share codes are built from `state.answers`, added to `jsdrill.progress.v1`
(schema-additive; no `__v` bump — absent reads as `{}`):

```js
answers: {
  [lessonId]: {
    L1: { picks: [authoredOptIdx | null], at, session },
    L2: { results: [bool | null], at },
    L3: { ok: bool, code: string, at }
  }
}
```

Existing state is **level-grained** (`progress[id].L1 === 'passed'`), which can't
say which option was picked. This is the question-grained record beside it.

- `session` identifies the L1 sitting. The record resets on the first pick of a
  **new** session, not when one is rendered — opening the tab isn't attempting
  it, and lazy reset stops a short retry from inheriting the previous attempt's
  answers in positions it never reached.
- `L3.code` is the user's typed source, capped at 4,000 chars and kept only for
  the 40 most recently drilled lessons. It never enters the URL.
- Sync merges `answers` per lesson per level by newest `at`
  (`mergeLatestAttempt` in `js/sync.js`) — a level's record is one coherent
  sitting, so blending two devices would fabricate an attempt neither made.

System design records `lastOutcome` / `lastPick` on its Leitner boxes
(`jsdrill.systemdesign.v1`) for the same reason: the counters say how *often*
something was missed, never how the *last* attempt went.

---

## Copy for AI

The share sheet offers two actions:

- **Copy link** — the URL. On phones with `navigator.share`, the native sheet.
- **Copy for AI** — the URL plus a framing prompt plus, for coding lessons,
  **the code the user actually typed at L3**.

The URL is the address; the clipboard is the payload. That split is deliberate:
the typed source is the highest-value artifact in the app and far too big for a
URL, but it needs no infrastructure to travel — the user is already pasting.

---

## Privacy

The score code lives only in URLs the user chooses to share. Nothing is stored
server-side, there is no share record to leak or expire, and the code is
meaningless without the page it points at. It is in the query string rather than
the fragment because an agent fetching the URL must be able to see it — a
fragment would never reach it.

The generated pages contain lesson content that is already public in this
repository. They contain no user data.

---

## Maintenance

```bash
node tools/test-sharecode.js         # codec + registry unit tests
node tools/build-share-pages.js      # regenerate (output is committed)
node tools/build-share-pages.js --check   # fail if committed output is stale
node tools/cdp/share-urls.js         # full browser round trip
```

Run the generator after **any** content change — new lesson, edited question,
reordered options. The pages are committed because GitHub Pages serves from the
repo, so stale output ships silently otherwise; `--check` is the guard.

**Never reorder existing questions or options in a lesson JSON.** Appending is
safe, and so is rewording in place. Reordering silently invalidates every share
code ever generated for that lesson — the staleness detector catches
contradictions, but a reorder that happens to stay self-consistent will quietly
point at the wrong question.

This is enforced, not just documented: `tools/check-content-order.js` locks the
authored order of every question and option in
`data/content-order.lock.json`, distinguishes a reorder from an edit, and fails
the commit on the former. `--accept` re-baselines when the break is intended.
See [`invariants.md`](invariants.md) § 1.
