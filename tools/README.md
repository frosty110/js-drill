# tools/

Project tooling. Nothing here ships to the user — these are dev-time helpers
for validation, browser-driven QA, and historical migrations.

## Live tools

| File | Purpose |
|---|---|
| `validate-data.js` | Runs every L2 fill + L3 canonical from `data/<slug>/*.json`, diffs the manifest against the on-disk layout, and fails on drift. Run before every commit that touches lesson content. |
| `cdp/check.js` | Quick single-page probe — drives Chrome at `:9222`, captures console/network errors and a screenshot. |
| `cdp/deep-check.js` | Multi-step navigation probe — tab switching + lesson click + screenshots at each step. Catches the most regressions. |
| `cdp/mobile-l3.js` | iPhone-viewport probe specifically for the L3 editor — verifies `lineWrapping` and the sticky action bar. |

### Running

```bash
# Validate content
node tools/validate-data.js

# Start Chrome on its own profile so it doesn't touch your main browser:
open -na "Google Chrome" --args \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug-jsdrill

# Serve locally (file:// won't work because of the fetch calls):
python3 -m http.server 8765

# Then probe (defaults to /tmp/jsdrill-shots/<phase>/):
node tools/cdp/deep-check.js  http://127.0.0.1:8765/
node tools/cdp/mobile-l3.js   http://127.0.0.1:8765/
```

## Historical / one-shot

| File | What it was used for |
|---|---|
| `migrations/extract.js` | One-shot script that pulled the original inline `CURRICULUM` + `CONTENT` blocks out of `index.html` and wrote `data/<slug>/<id>.json` + `data/manifest.json`. Won't be re-run; kept as reference. |
| `migrations/refactor.js` | One-shot script that surgically rewrote `index.html` to remove the inline data and wire up the async loader. Won't be re-run; kept as reference. |

See also `docs-archive/old-scripts/` for pre-refactor helpers that targeted the
old `patterns-batch-1.json` schema (now removed).
