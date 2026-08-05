#!/usr/bin/env python3
"""Split js/app/14-init-core.js into sub-slices along its own section banners.

Why this file and not another: the 2026-05 app.js refactor cut a 13.3k-line
monolith into 15 slices by SIZE, and 14-init-core.js is the residue — everything
that didn't obviously belong elsewhere. Its own banners name 24 unrelated
concerns (command palette, bootstrap, 25 drill launchers, settings toggles, PWA
install, a RETIRED drawer, At-Risk, Streak Map, an audio player, Heatstrip,
Stats, Dashboard, Today's Plan, path switcher, Mechanics, Help, backup/restore,
cheatsheet, boot tail) across 2,502 lines. Editing any one of them means loading
~40k tokens of the other 23.

The `12a/12b/12c` naming is the repo's existing convention for sub-slicing an
app slice without renumbering the rest.

Safe by construction: the file contains ZERO top-level executed statements —
only declarations — and init() is called from slice 15, after every slice has
loaded. So this is a pure textual move; the concatenation is asserted
byte-identical.

Usage:  python3 tools/split-init-core.py            # the one-shot extraction
        python3 tools/split-init-core.py --check    # load order still correct
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'js' / 'app' / '14-init-core.js'
OUT = ROOT / 'js' / 'app'
PAGE = ROOT / 'index.html'
SW = ROOT / 'service-worker.js'

# (first line, filename) — 1-based inclusive, each runs to the line before the
# next. Grouped by what the code is FOR, following the file's own banners.
SEAMS = [
    (1, '14a-init-palette.js'),        # init() orchestrator + command-palette state
    (246, '14b-bootstrap-launchers.js'),  # bootstrap, drill launchers, nav helper, sidebar actions
    (591, '14c-settings-input.js'),    # settings toggles, PWA install, search + keyboard, palette wiring, retired drawer
    (973, '14d-risk-streak.js'),       # At-Risk radar, Streak Map
    (1226, '14e-audio.js'),            # two-voice audio episodes
    (1574, '14f-stats-dashboard.js'),  # Heatstrip, Stats body, Dashboard
    (2055, '14g-plan-modals.js'),      # Today's Plan, path switcher, Mechanics, Help, backup/restore, cheatsheet, boot tail
]

TAG = '  <script src="js/app/{}" defer></script>'
OLD_TAG = '  <script src="js/app/14-init-core.js" defer></script>'
OLD_SW = "  './js/app/14-init-core.js',"


def check_order():
    page = PAGE.read_text()
    want = [name for _, name in SEAMS]
    got = re.findall(r"<script src=\"js/app/(14[a-z]-[^\"]+)\"[^>]*></script>", page)
    if got != want:
        sys.exit(f'14* script tags are not in split order.\n  want: {want}\n  got:  {got}')
    missing = [n for n in want if not (OUT / n).exists()]
    if missing:
        sys.exit(f'declared but missing on disk: {", ".join(missing)}')
    sw = SW.read_text()
    uncached = [n for n in want if f"./js/app/{n}" not in sw]
    if uncached:
        sys.exit(f'not precached in service-worker.js (offline users only): {", ".join(uncached)}')
    print(f'✓ {len(want)} 14* slices load in declared order and are precached')


def main():
    if '--check' in sys.argv:
        check_order()
        return

    lines = SRC.read_text().split('\n')
    slices = []
    for idx, (first, name) in enumerate(SEAMS):
        last = SEAMS[idx + 1][0] - 1 if idx + 1 < len(SEAMS) else len(lines)
        slices.append((name, '\n'.join(lines[first - 1:last])))

    original = '\n'.join(lines)
    if '\n'.join(t for _, t in slices) != original:
        sys.exit('REFUSING: the concatenated slices are not byte-identical')

    for name, text in slices:
        (OUT / name).write_text(text + '\n')
        print(f'  {name:28s} {len(text.split(chr(10))):5d} lines')

    def read(name):
        raw = (OUT / name).read_text()
        return raw[:-1] if raw.endswith('\n') else raw

    if '\n'.join(read(n) for n, _ in slices) != original:
        sys.exit('REFUSING: what was written to disk does not reproduce the file')

    SRC.unlink()
    PAGE.write_text(PAGE.read_text().replace(
        OLD_TAG, '\n'.join(TAG.format(n) for n, _ in slices), 1))
    SW.write_text(SW.read_text().replace(
        OLD_SW, '\n'.join(f"  './js/app/{n}'," for n, _ in slices), 1))
    print(f'✓ {len(lines)} lines split into {len(slices)} slices')


if __name__ == '__main__':
    main()
