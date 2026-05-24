---
name: browser-test
description: Drive a headless Chrome via the DevTools port (:9222) to validate UI/UX changes in the JS drill app. Use whenever a code change affects the rendered DOM, layout, or click flow — especially mobile-affecting changes (the 80% case per PROFILE.md). The skill bootstraps server + Chrome, writes a short scenario script using tools/cdp/lib.js, runs it, and reports pass/fail with screenshots. Use proactively after any app.js, app.css, or index.html edit.
---

# browser-test

You're driving a real browser to verify that a JS drill app change actually
works as intended — not just that the validator passes, not just that the
code looks right. Screenshots + DOM probes catch regressions that unit
validation can't (sticky bars that overlap, modals that don't dismiss,
buttons that route to the wrong tab, CSS that breaks at mobile widths).

## When to use this

**Use proactively when:**
- A change touches `app.js`, `app.css`, or `index.html`
- A change affects what the user sees, taps, or types
- An iteration's verification step says "mobile probe required" (almost
  always — see PROFILE.md)

**Skip when:**
- Change is content-only (lesson JSON edits, manifest updates) —
  `node tools/validate-data.js` is sufficient
- Change is doc-only (markdown, comments)
- Change is in `tools/` (these don't run in the browser)

## The pattern: arrange → act → assert + snap

Every scenario script is the same three-step shape. Don't reinvent the
plumbing — `tools/cdp/lib.js` handles the CDP machinery so the scenario
script stays short and intent-revealing.

```js
const { ensureServer, ensureChrome, connect } = require('./lib');

(async () => {
  await ensureServer({ port: 8765 });
  await ensureChrome();
  const s = await connect({
    url: 'http://localhost:8765/',
    mobile: true,                      // iPhone 13 viewport + coarse pointer
    outDir: '/tmp/jsdrill-probe-<name>'
  });

  // ARRANGE — seed localStorage for whatever state you need to test
  await s.evalAwait(`(async () => { /* fetch manifest, set state, … */ })()`);
  await s.reload();

  // ACT — drive the UI
  await s.snap('before');
  await s.click('#some-button');
  await s.sleep(500);                  // give the app a tick to render
  await s.snap('after');

  // ASSERT — DOM probes, not screenshot diffs
  const tab = await s.eval(`document.querySelector('.tab-btn.active')?.textContent`);
  s.assert(/L2/.test(tab), `expected L2 active, got ${JSON.stringify(tab)}`);

  // REPORT
  const { failed, errors, networkErrors } = s.report();
  await s.close();
  process.exit(failed + errors + networkErrors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
```

A working end-to-end example lives at `tools/cdp/template.js`. Copy it,
rename, edit the arrange/act/assert blocks for your scenario.

## How to run

```bash
# One-shot:
node tools/cdp/<your-probe>.js

# Or with a custom URL / output dir:
node tools/cdp/<your-probe>.js http://localhost:8765/ /tmp/probe-out
```

The lib will auto-start a python http.server on :8765 (from the repo root)
and a headless Chrome on :9222 if either isn't already running. Both stay
running between probes — no need to bounce them.

## Verifying the result

Three signals matter; check all of them:

1. **Assertion log** — `Probe report: N passed, M failed`. Every claim your
   change makes about the UI should show up as a `s.assert(...)`. Anonymous
   "it works" doesn't count.
2. **Console / network errors** — if the lib reports any (favicon.ico 404 is
   filtered as noise; anything else is real), investigate before declaring
   the probe passed. A green assertion against a broken page is worse than
   no probe.
3. **Screenshots** — open the files written to `outDir` with the `Read`
   tool (`Read('/tmp/.../03-after.png')`). The image renders inline. Look
   for the *visual* claim of your change — e.g., "sticky action bar is at
   the bottom of the viewport," "modal is centered," "L2 tab is highlighted."
   DOM assertions catch wrong tabs; screenshots catch wrong layouts.

If screenshots disagree with assertions, trust the screenshots — the DOM
might be in the right *state* while the rendered output is wrong (CSS
ordering, transform layers, sticky positioning).

## Mobile-first by default

`connect({ mobile: true })` does three things:

- Sets the viewport to iPhone 13 mini (390×844, DPR 2)
- Enables touch emulation
- Forces `(pointer: coarse)` and `(any-pointer: coarse)` media queries

That's the right calibration for verifying changes against PROFILE.md's
80%-phone target. If a change is desktop-specific (Mock Interview, keyboard
shortcuts), explicitly set `mobile: false` and pass a `viewport` instead.

When a change affects both modalities, run **two probes** — one mobile,
one desktop — and put their `outDir`s side by side.

## Seeding state

The app reads from `localStorage` on init. Most non-trivial scenarios need
seeded state (e.g., "a due review exists," "user has progress," "welcome
banner is dismissed"). The recipe:

```js
await s.evalAwait(`(async () => {
  const m = await fetch('./data/manifest.json').then(r => r.json());
  const sample = m.sections.flatMap(s => s.lessons).find(l => l.status === 'full');
  const data = {
    __v: 4,
    welcomed: true,
    progress: { [sample.id]: { L1: 'passed', L2: 'passed', L3: 'passed' } },
    reviews: { [sample.id]: {
      lastPassedAt: Date.now() - 2*86400000,
      interval: 86400000,
      dueAt: Date.now() - 86400000,
    }},
  };
  localStorage.setItem('jsdrill.progress.v1', JSON.stringify(data));
})()`);
await s.reload();
```

Use `s.evalAwait` (not `s.eval`) when the IIFE returns a promise — the
helper passes `awaitPromise: true` so the result is the resolved value, not
the unresolved promise.

For canonical state shapes, grep `app.js` for `state.progress`,
`state.reviews`, etc. Schema version is `__v: 4`; the loader is
backwards-compatible to v1.

## Reporting back

After running the probe, summarize for the user in 3–5 lines:
- What scenario the probe ran
- Assertion result (e.g., "2/2 passed")
- Anything notable in the screenshots (call out the screenshot path and
  what it shows)
- Any console / network errors that weren't fatal but might be worth
  noting

Do not paste raw probe output — it's long and the user has the file paths
to check themselves. Be specific about what the screenshot proves.

## Cleanup

The headless Chrome stays running across probes by design. If you launched
it and you're sure no other probe needs it:

```bash
pkill -f "chrome-debug-jsdrill"
```

But normally, just leave it. The next probe will reuse it. The
`--user-data-dir=/tmp/chrome-debug-jsdrill` flag means it's isolated from
the user's real browser profile, so it's not stealing tabs or cookies.

## Common assertions cookbook

```js
// Active tab name
const tab = await s.eval(`document.querySelector('.tab-btn.active')?.textContent`);
s.assert(/L2|Fill/.test(tab), `Expected L2 tab, got ${JSON.stringify(tab)}`);

// Element exists and is visible
const visible = await s.eval(`(() => {
  const el = document.querySelector('#review-btn');
  if (!el) return false;
  if (el.classList.contains('hidden')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
})()`);
s.assert(visible, 'review-btn should be visible');

// Sticky positioning (e.g., action bar pinned to bottom of viewport)
const sticky = await s.eval(`(() => {
  const bar = document.querySelector('.l3-actions');
  if (!bar) return null;
  const r = bar.getBoundingClientRect();
  return { bottom: r.bottom, vh: innerHeight, pinned: r.bottom >= innerHeight - 8 };
})()`);
s.assert(sticky?.pinned, `L3 sticky bar should be at viewport bottom (got ${JSON.stringify(sticky)})`);

// Modal opened
await s.click('#today-btn');
await s.sleep(200);
const modalShown = await s.eval(`getComputedStyle(document.getElementById('today-modal')).display !== 'none'`);
s.assert(modalShown, "Today's plan modal should open");

// No horizontal scroll on mobile (no overflow bug)
const overflow = await s.eval(`document.documentElement.scrollWidth > window.innerWidth`);
s.assert(!overflow, 'No horizontal overflow at mobile width');
```

## Troubleshooting

**"Chrome devtools did not come up"** — give it longer. macOS `open -na`
can take 10–15s on a cold launch. The lib's default timeout is 15s; bump
to `ensureChrome({ timeoutMs: 25000 })` if needed. If it still fails:
`lsof -nP -iTCP:9222` to see what's holding the port; `pkill -f
"chrome-debug-jsdrill"` to clear any stuck instance and retry.

**"eval threw: …"** — your CDP expression hit an uncaught exception in
the page. Wrap the expression in a `try { … } catch (e) { return e.message }`
to surface what went wrong without crashing the probe.

**Screenshot looks empty / blank** — bump `waitForLoadMs` in the `connect`
call (default 2200ms). The manifest fetch + lesson lazy-load can race the
first snap. Or use `await s.waitFor('document.querySelector(".lesson-link")', { timeoutMs: 5000 })`
to wait for a specific element before snapping.

**Probe passes but the page looks wrong in the screenshot** — DOM
assertions saw what the assertion looked for, but the visual rendering is
broken. Add a tighter assertion that checks computed styles or bounding
rects, not just text content.

**Probe uses `127.0.0.1` and fails** — don't. Chrome 148+ restricts
devtools to `localhost` only. The lib enforces this; if you wrote a probe
that uses `127.0.0.1` directly, migrate it to use `lib.js`.
