# The URL contract

**Rule — if a user can look at it, it has a URL. If it has a URL, fetching that
URL with no JavaScript returns it.**

Both halves are load-bearing, and the app has broken each of them separately.

## Why this is a rule and not a preference

A URL in this project has three consumers, and only one of them runs JavaScript:

1. **AI agents.** The user's workflow is to paste the URL they are looking at
   into an assistant and ask about it. The assistant fetches it. If the fetch
   returns a shell, the user gets a confidently wrong answer about a page the
   agent never saw.
2. **The user's own copy-paste.** "What I'm looking at" includes *which* unit,
   *which* question, *which* diagram is open, and where they are scrolled to.
   If that state isn't in the URL, it cannot be sent to anyone — not an AI, not
   a colleague, not their own other device.
3. **Search engines.** Crawlers index paths and render inconsistently. Content
   reachable only after a hash-route resolves is content that does not rank.

All three fail the same way, for the same reason, and are fixed by the same
contract.

## The diagnosis this came from

`system-design.html#/design-problems/p03` returned a page saying `Loading…`.

The tempting explanation is "the site is rendered on the fly, so a fetch gets
the template instead of the content." **That is not what happened, and believing
it sends you to the wrong fix.** This site is statically hosted on GitHub Pages,
and fully pre-rendered pages for all 58 units already existed at `sd/…`.

What actually failed was addressing, in two distinct ways:

**1. State in the fragment.** Per RFC 3986 a fragment is stripped by the client
and **never transmitted**. So the server, a crawler, `curl`, and an AI fetcher
all receive byte-identical responses for every `#/…` route. This has nothing to
do with templating — a server-rendered app with hash routes fails identically,
because the server is never told which unit was asked for. It is a URL *design*
defect, and no amount of rendering machinery fixes it.

**2. State in nothing at all.** Which infographic is open, which question is
expanded, the scroll position — these lived only in JavaScript variables. There
was no URL that denoted them, so requirement (2) above wasn't broken, it was
*impossible*. Pre-rendering cannot fix this either; the app has to write the
state into the URL before anything can carry it. The open-sheet half of this is
now done (`#/…/graphic/<id>`); see the table below for what still isn't.

And compounding both: the pre-rendered pages that did exist dropped every
diagram and every image on the floor. The unit JSON carried four mermaid
diagrams and three PNGs; the generated page carried none of them. Nothing was
red, because nothing was looking.

## The contract

**Path is identity. Query is view state. Fragment is position.**

| Part | Carries | Example | Must survive a no-JS fetch |
|---|---|---|---|
| Path | *which thing* | `sd/design-problems/p06/` | ✅ the whole point |
| Query | view state a fetcher can act on | `?s=YpYBYnCY`, `?sheet=overview` | ✅ |
| Fragment | position within that document | `#q4`, `#diagram-socket-routing` | ⚠️ client-only by design |

The fragment is legitimate for *position inside a document the server already
returned* — `#q4` on a page that contains Q4 is fine, because the bytes arrived
and the anchor just scrolls. It is illegitimate as *identity*: `#/design-problems/p06`
asks the server for something it cannot hear.

Four obligations follow:

1. **Every place the app can put the user is a row in `js/routes.js`.** Not
   every *page* — every *place*. A route the registry doesn't name is a place
   with no address, and that is how `mixed`, `due`, `plan` and `tag` came to be
   live routes with no share link, no sitemap entry and no fetchable page.
2. **Every row declares a disposition** (below), which decides what a fetcher
   gets.
3. **The app's router consumes the registry** rather than re-describing it.
   `system-design.html`'s `parseRoute()` is now an adapter over
   `DrillRoutes.parseAppHash()`; it maps `{kind, params}` onto the `{view, …}`
   shape the render functions speak, and defines no routes of its own.
4. **The app writes its state into the URL as the user moves**, and gives them a
   way to get it back out (see *Copying* below).

## Disposition: what a route means

Not every route denotes content, and pretending otherwise would mean generating
pages that lie. Each row declares which it is:

| | `content` | `action` |
|---|---|---|
| Denotes | a thing that exists independently of the reader | a personal, stateful session |
| Examples | lesson, unit, sheet, plan, tag list | `#/ddia/mixed`, `#/ddia/due`, `#/m/dashboard` |
| Static page | yes, its own | none — declares a `fallback` |
| In the sitemap | yes | no |

`#/ddia/due` renders from the reader's own Leitner state; there is no fixed
content behind it, so a static twin would be fiction. It still has to be in the
registry, and it still has to resolve — `resolveForFetch()` hands back its
declared fallback, so *"no page for this"* never becomes *"nowhere to go."*
**`action` is a declaration, not an exemption.**

## The address of every surface

| What the user is looking at | App URL | Static twin |
|---|---|---|
| Topic list | `system-design.html#/` | `sd/` |
| A topic | `#/ddia` | `sd/ddia/` |
| A unit | `#/design-problems/p06` | `sd/design-problems/p06/` |
| **A study sheet, full screen** | `#/design-problems/p06/graphic/presence-and-websockets` | `sd/design-problems/p06/presence-and-websockets/` |
| **A study plan** | `#/design-problems/plan/night-before` | `sd/design-problems/plan/night-before/` |
| **A tag list** | `#/design-problems/tag/mechanism/caching` | `sd/design-problems/tag/mechanism/caching/` |
| A due/mixed session | `#/design-problems/mixed` | *(action → the topic page)* |
| A question on a unit page | — | `sd/design-problems/p06/#q4` |
| A diagram on a unit page | — | `sd/design-problems/p06/#diagram-socket-routing` |
| A coding lesson | `index.html#/two-sum` | `p/two-sum/` |
| A level within a lesson | `index.html#/two-sum/L2` | `p/two-sum/#L2` |
| A launchable mode | `index.html#/m/dashboard` | *(action → `p/`)* |

The sheet route is the pattern for anything added later. A full-screen study
sheet is the longest-dwell surface in the app — the user sits on it, zooms it,
and is exactly the person who then says "explain this to me." So the viewer
announces what it is showing (`drill-infographic-open` / `-close` carrying a
`sheetId`), and `system-design.html` turns that into a route with
`replaceState` — not `pushState`, because browsing inside a unit should not fill
the back button with viewer toggles. The viewer itself stays route-ignorant: it
is shared UI, and the page that mounts it decides what its state means for the
address bar.

## Copying

Routing state into the URL is only half a feature. The app is installed as a
PWA (`display: standalone`) and read on a phone ~80% of the time — **for most of
its use there is no address bar at all.** A URL the user cannot reach is a URL
they cannot paste, so every long-dwell surface needs an explicit affordance:

- the unit screen has **Share** (`#share-unit`), which emits the static URL
  carrying the reader's `?s=` result set;
- the sheet viewer has **Link**, which copies the sheet's own static page.

Both copy the *static* URL, never the app hash, because the recipient is usually
an AI that has to be able to fetch it.

## Gate

`node tools/check-url-contract.js`, wired into `node tools/check-all.js`.

It asserts, currently across ~900 checks:

1. every `content` surface in `js/routes.js` resolves to a real file on disk —
   units, sheets, plans, tag lists;
2. every hash-routed app page (`index.html` and `system-design.html`) carries an
   agent bridge that cites a path that exists, **and** something that blanks it
   on boot so a real user never sees it;
3. `sitemap.xml` lists every unit page;
4. a unit whose data has diagrams or registered sheets **renders** them;
5. **the registry and the app's router describe the same routes** — every
   surface round-trips `params → appHash → parseAppHash → params` and
   `params → path → parseSharePath → params`; every `action` declares a
   `fallback` that is a real `content` surface; and every entry in
   `system-design.html`'s `ROUTE_VIEW` table names a surface that exists.

Check 5 is the reconciliation one and the reason the rest hold. Checks 1–4 all
compare the registry to *disk*; only 5 compares it to the *app*, which is where
the drift actually happened — four live routes that no surface named, with every
gate green.

Two failure modes worth knowing, because both were verified by causing them:
routing to a `kind` the registry lacks fails check 5's table scan, and changing
`appHash` without changing `appParams` fails the round-trip with *"its own app
hash parses to nothing."*

Check 4 is deliberately asserted against rendered elements (`id="diagram-…"`,
`<img …>`) rather than substrings. Its first version searched the whole file and
passed happily with the visible page stripped bare, because the embedded
`drill-data` JSON contained the same strings — a gate that had quietly stopped
detecting. **If you change any of these, break a page on purpose and confirm it
goes red.**

## SEO

The static pages are the indexable product; the shells are not. So:

- each page carries `canonical`, `og:`, and **JSON-LD** — a unit and a lesson
  declare `LearningResource` with their questions as `Question`/`acceptedAnswer`,
  a sheet declares `ImageObject` with its dimensions;
- `sitemap.xml` uses the **image sitemap extension**, so the 183 study sheets are
  discoverable as images rather than only via `<img>` parsing;
- both app shells carry `rel="canonical"` to their static index. Without it the
  crawlable text at `system-design.html` is the agent bridge — accurate for a
  fetcher, a poor search snippet.

## What is still unbuilt

**Position inside a drill.** The system-design drill shows one question at a
time, and that position is not in the URL — `#/…/q/3` doesn't exist. Adding it
means deciding what a shared "question 3" link should do to the recipient's
spaced-repetition schedule, which is a product question rather than a routing
one, so it is deliberately left open. The static unit page anchors every
question (`#q4`), so the shareable form exists; only the in-app position is
missing.

**Anchors from inside the app.** The static pages anchor every question, diagram
and sheet, but the app neither writes those anchors nor offers a per-question
copy — so an anchor only helps a reader who is already on the static page.

**Thin sheet pages.** The 183 sheet pages carry an image, the unit summary and
sibling links. They would be substantially better with the sheet's own authored
context, which is blocked by the content defect below.

**The `family` facet is not addressable.** Its values are derived from part
*display names* ("AI & ML Infrastructure"), not ids, so they can't be a path —
and the app's own route sanitiser strips spaces and ampersands, so the two
spellings could never agree. The generator skips them and says so; the in-app
filter is unaffected. Giving families real ids in `tags.json` is what would make
them addressable, which is a content change. The gate now rejects any non-URL-safe
generated path, so this can't ship silently again.

**Known content defect, not a routing one.** The prose baked into the generated
PNGs — and rendered in the app's study-set cards as `purpose` / `description` —
comes from the auto-derived fields in `infographic-sets.json` and reads as
truncated filler ("Presence is extremely high-churn and low stakes, so the
standard approach…"). The URLs now point at those sheets precisely, which makes
the copy more visible, not less. Fixing it is a content pass over
`infographic-sets.json` plus a re-render.

## Authoring note

`data/system-design/infographic-sets.json` has auto-derived `description` /
`purpose` / `summary` prose that is garbled and **must never be rendered**. Only
its structural fields (`id`, `title`, `kind`, dimensions) are safe. The authored
voice is the `takeaway` on each diagram and the unit's own copy.
