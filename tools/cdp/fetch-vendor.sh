#!/usr/bin/env bash
# fetch-vendor.sh — download local copies of the CDN assets the app's pages load,
# for use by the CDP probes in sandboxed environments where the CDN domains
# (cdn.tailwindcss.com, cdnjs.cloudflare.com, cdn.jsdelivr.net) are blocked by
# network policy but registry.npmjs.org is allowed.
#
# Output: tools/cdp/vendor/ (gitignored). lib.js's connect({ vendorCdn: true })
# serves these bytes for the matching CDN URLs via CDP Fetch interception.
#
# Usage: bash tools/cdp/fetch-vendor.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p vendor
cd vendor

fetch_tgz() { # <name> <npm-spec>
  local dir="$1" spec="$2"
  if [ -d "$dir" ]; then echo "✓ $dir (cached)"; return; fi
  # npm view can print one line per matching version for range specs (e.g. @2) —
  # take the last (highest) match.
  local url; url=$(npm view "$spec" dist.tarball | tr -d "'\"" | grep -o 'https://[^ ]*\.tgz' | tail -1)
  echo "↓ $spec"
  mkdir -p "$dir"
  curl -sSL "$url" | tar xz -C "$dir" --strip-components=1
}

fetch_tgz codemirror   codemirror@5.65.16
fetch_tgz tailwind     tailwindcss-cdn@3.4.10   # npm mirror of the v3 Play CDN script
fetch_tgz supabase     @supabase/supabase-js@2
fetch_tgz mermaid      mermaid@11
fetch_tgz typescript   typescript@5.6.3         # lazy-loaded by js/core/runner.js for lang:"ts" lessons

echo "Done. vendor/ contents:"
ls -d codemirror tailwind supabase mermaid typescript
