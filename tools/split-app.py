#!/usr/bin/env python3
"""
split-app.py — Split the app.js monolith into ordered, read-whole-able slices.

WHY: app.js is ~13.3k lines / ~190k tokens. The AI can never read it whole, so
it slice-reads it 500+ times (see tools/analyze-tool-stats.py). Splitting it into
~15 files small enough to read whole kills that read-churn tax.

HOW (the safety contract): the slices are plain <script src> files that keep
sharing GLOBAL scope (NOT ES modules) and are loaded in order by index.html. Each
cut is at a top-level statement boundary, so:

  * INVARIANT 1 — concatenating the slices in load order is BYTE-IDENTICAL to the
    original app.js. Same global scope, same definition order ⇒ provably identical
    runtime behavior. This script asserts it.
  * INVARIANT 2 — each slice is a complete run of top-level statements, so it
    parses on its own (verified separately with `node --check`).

No import/export rewiring, no behavior change — just a reversible cut. Re-run is
idempotent. To undo: `git checkout -- app.js index.html && rm -rf js/app`.
"""
import os
import sys

SRC = "app.js"
OUTDIR = "js/app"

# (start_line_1based, filename). Each slice runs [start, next_start). Final slice
# runs to EOF. Every start line was verified to begin a top-level statement
# (a `function`/`async function` declaration or a `//` section banner).
CUTS = [
    (1,     "01-state-content.js"),            # core imports, content loader, mechanics registry, state
    (202,   "02-util-metrics.js"),             # cache, shuffle, history, haptic, heatstrip, hint/rescue/mastery metrics
    (590,   "03-paths-cram.js"),               # paths registry, cram home/refs/review, sidebar curation, path modal
    (1444,  "04-progress-sr.js"),              # progress load/save, spaced-rep, weakness, sparkline
    (2286,  "05-drills-recognize-trace.js"),   # recognize, big-o, gotcha, conv-drill, trace-hop, notes-drill
    (3246,  "06-drills-constellation-grid.js"),# constellation, reverse-walk, whatif, notes-locate, match, section-grid
    (4358,  "07-drills-swap-speedrun.js"),     # swap, claim, crystal, reverse, rapid-fire, warmup, speedrun, gauntlet
    (5754,  "08-drills-bughunt-constraint.js"),# streak-map, bug-hunt, mutate, phone-screen, constraint-shift
    (6728,  "09-stats-cheatsheet-mock.js"),    # retention/calibration tiles, cheatsheet, mock, markPassed, nav helpers
    (7777,  "10-render-sidebar-lesson.js"),    # sidebar render + main lesson render
    (8375,  "11-tabs-ref-conv-walk.js"),       # reference / conversation / walkthrough tabs
    (9127,  "12-levels.js"),                   # L1 / L2 (+mobile) / L3
    (10576, "13-mechanics-modal.js"),          # mechanics modal
    (10900, "14-init-core.js"),                # the async init() boot function
    (12545, "15-init-features-boot.js"),       # offline/sync/clarify/hotseat/calibration/topbar + boot tail
]

TOPLEVEL_PREFIXES = ("function ", "async function ", "//", "/*", "const ", "let ", "class ")


def main():
    if not os.path.exists(SRC):
        sys.exit(f"missing {SRC} (already split? `git checkout -- app.js` to restore)")
    with open(SRC, encoding="utf-8") as fh:
        original = fh.read()
    lines = original.splitlines(keepends=True)
    n = len(lines)

    # Validate every cut lands on a top-level statement boundary.
    for start, name in CUTS:
        ln = lines[start - 1] if start - 1 < n else ""
        if not ln.startswith(TOPLEVEL_PREFIXES):
            sys.exit(f"UNSAFE cut at line {start} ({name!r}): not a top-level boundary:\n  {ln!r}")

    os.makedirs(OUTDIR, exist_ok=True)
    bounds = [c[0] for c in CUTS] + [n + 1]
    written = []
    concat = []
    for i, (start, name) in enumerate(CUTS):
        end = bounds[i + 1]                       # exclusive, 1-based
        chunk = "".join(lines[start - 1:end - 1])
        path = os.path.join(OUTDIR, name)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(chunk)
        written.append((path, end - start))
        concat.append(chunk)

    # INVARIANT 1: byte-identical reconstruction.
    if "".join(concat) != original:
        sys.exit("FATAL: slices do NOT concatenate back to the original. Aborting.")

    print(f"✓ split {SRC} ({n} lines) into {len(written)} slices in {OUTDIR}/")
    print("✓ INVARIANT verified: concat(slices) is byte-identical to original\n")
    for path, count in written:
        print(f"  {count:>5}  {path}")
    print(f"  {sum(c for _, c in written):>5}  TOTAL")
    print("\nNext: load these in order in index.html (replacing app.js), then")
    print("`node --check` each, validate-data.js, and a browser smoke test.")


if __name__ == "__main__":
    main()
