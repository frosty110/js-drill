#!/usr/bin/env python3
"""Extract system-design.html's inline application script into js/sd/ slices.

Why: the file was 2341 lines of which only ~94 were markup — 405 lines of
inline CSS and 1858 lines of application JavaScript (router, Leitner SR, drills,
component catalog, study plans, infographics) with no module boundary anywhere.
Measured over the last 120 product commits it was touched in 22 of 43, more than
any other file in the repo, so every change to it meant loading ~36k tokens of
unrelated concerns to edit one of them.

The split is along the file's OWN section banners — the seams the author already
drew — not at arbitrary line counts. That is the lesson from the 2026-05 app.js
split, whose one bad slice (14-init-core.js, 24 unrelated concerns) is the one
that was cut by size instead of by seam.

Like js/app/*.js these are plain <script src> files sharing global scope, in
order. The concatenation is asserted byte-identical to the block they replaced,
so this is provably a move, not a rewrite.

The extraction itself is ONE-SHOT — once the block is gone there is no original
left to diff against, exactly like tools/split-app.py before it. What survives
is `--check`, which guards the invariant that outlives the move: these slices
share global scope and must execute in the declared order, so the <script> tags
in the page have to match SEAMS exactly. Reordering them is the one edit that
breaks the page while looking harmless in review.

Usage:  python3 tools/split-system-design.py            # the one-shot extraction
        python3 tools/split-system-design.py --check    # load order still correct
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / 'system-design.html'
OUT = ROOT / 'js' / 'sd'

# (first line of the slice, filename) — 1-based, inclusive; each slice runs to
# the line before the next one starts. Named for the concern, never the order.
SEAMS = [
    (505, '01-state-data.js'),          # header, state, Leitner SR, loaders, catalog graph
    (639, '02-diagrams.js'),            # mermaid decks + diagram rendering
    (789, '03-tags.js'),                # faceted tags over the design problems
    (833, '04-plans.js'),               # study plans + the active-plan cursor
    (1005, '05-topic-landing.js'),      # the topics index
    (1039, '06-topic-home.js'),         # one topic's chapter list
    (1271, '07-unit-detail.js'),        # a unit's key ideas + drill modes
    (1358, '08-component-catalog.js'),  # the building blocks, inverted
    (1503, '09-session.js'),            # session setup + queue
    (1653, '10-question-render.js'),    # MC + open question rendering and grading
    (1844, '11-share.js'),              # share codes for a unit's result set
    (1998, '12-summary.js'),            # end-of-session summary
    (2041, '13-stats.js'),              # the stats modal
    (2091, '14-keyboard.js'),           # keyboard shortcuts
    (2113, '15-routing-shell.js'),      # router, app-shell adapter, boot tail
]


def find_block(lines):
    """The inline <script> that holds the app (not the tiny head shims)."""
    start = end = None
    for i, line in enumerate(lines, 1):
        if start is None and i > 400 and re.match(r'\s*<script>\s*$', line):
            start = i
        elif start and end is None and '</script>' in line:
            end = i
    if not start or not end:
        sys.exit('could not locate the inline application <script> block')
    return start, end


def check_order():
    """The slices are in the page, in SEAMS order, and every one of them exists."""
    page = PAGE.read_text()
    want = [name for _, name in SEAMS]
    got = re.findall(r'<script src="js/sd/([^"]+)"></script>', page)
    if got != want:
        sys.exit(f'js/sd script tags are not in split order.\n  want: {want}\n  got:  {got}')
    missing = [n for n in want if not (OUT / n).exists()]
    if missing:
        sys.exit(f'declared but missing on disk: {", ".join(missing)}')
    stray = sorted(p.name for p in OUT.iterdir() if p.name not in want)
    if stray:
        sys.exit(f'js/sd holds slices the page never loads: {", ".join(stray)}')
    print(f'✓ {len(want)} js/sd slices load in declared order')


def main():
    if '--check' in sys.argv:
        check_order()
        return

    lines = PAGE.read_text().split('\n')
    start, end = find_block(lines)

    body = lines[start:end - 1]          # between the tags, exclusive
    base = start + 1                     # 1-based line number of body[0]

    slices = []
    for idx, (first, name) in enumerate(SEAMS):
        last = SEAMS[idx + 1][0] - 1 if idx + 1 < len(SEAMS) else end - 1
        slices.append((name, '\n'.join(body[first - base:last - base + 1])))

    joined = '\n'.join(text for _, text in slices)
    original = '\n'.join(body)
    if joined != original:
        sys.exit('REFUSING: the concatenated slices are not byte-identical to the block')

    # Round-trip discipline: write `text` plus ONE terminating newline, and
    # read it back by stripping exactly that one. Anything looser (rstrip) eats
    # a slice's trailing blank lines, which is how the first run of this script
    # silently lost 13 of them while still reporting a byte-identical split —
    # the assertion above ran on the in-memory text, not on what hit disk.
    def write(name, text):
        (OUT / name).write_text(text + '\n')

    def read(name):
        raw = (OUT / name).read_text()
        return raw[:-1] if raw.endswith('\n') else raw

    OUT.mkdir(parents=True, exist_ok=True)
    for name, text in slices:
        write(name, text)
        print(f'  {name:26s} {len(text.split(chr(10))):5d} lines')

    rebuilt = '\n'.join(read(name) for name, _ in slices)
    if rebuilt != original:
        sys.exit('REFUSING: what was written to disk does not reproduce the block')

    tags = '\n'.join(f'<script src="js/sd/{name}"></script>' for name, _ in slices)
    new = lines[:start - 1] + [
        '<!-- The application. Extracted from this file by',
        '     tools/split-system-design.py into ordered slices that share global',
        '     scope — the same shape as js/app/*.js, and cut along this code\'s own',
        '     section banners rather than by line count. Load order matters. -->',
        tags,
    ] + lines[end:]
    PAGE.write_text('\n'.join(new))
    print(f'✓ {len(body)} lines moved out of system-design.html')


if __name__ == '__main__':
    main()
