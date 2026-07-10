#!/usr/bin/env python3
"""
retheme-ink-amber.py — global palette migration to "Ink & Amber" (design-loop
decision D06, 2026-07-10).

Maps the legacy palette (Tailwind slate neutrals + the blue/cyan/indigo/violet/
fuchsia/pink accent sprawl) onto the ds/tokens.css roles:
  · slate neutrals   → ink neutrals (surface/line/text ramps)
  · every cool accent → the single amber accent family
  · status hues (green/emerald good · red/rose bad · amber/orange warn) KEPT
  · Dracula code-block palette KEPT (code stays Dracula on ink)

This is a VALUE sweep, not a refactor: hardcoded hexes and rgba() tints are
rewritten in place across the legacy CSS/HTML/JS. Token purity still arrives
with the structural rebuilds (P2+). Tailwind utility classes are remapped
separately via `tailwind.config` in index.html (Play CDN).

Idempotent: running twice is a no-op (all target values map to themselves).
Usage: python3 tools/retheme-ink-amber.py [--dry-run]
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

FILES = (
    [ROOT / f for f in [
        'index.html', 'tokens.css', 'diagnostic.html', 'system-design.html',
        'js/sync.js',
    ]] +
    sorted((ROOT / 'css').glob('0[1-5]*.css')) +
    sorted((ROOT / 'js' / 'app').glob('*.js'))
)

HEX_MAP = {
    # ── slate neutrals → ink (ds/tokens.css roles) ──────────────────────────
    '#020617': '#0a0b0d',  # deepest wells (inputs, code containers) → code-bg
    '#0b1020': '#0e0f12',  # custom darks → bg
    '#0b1220': '#0e0f12',
    '#0f172a': '#17181c',  # slate-900 panels → surface
    '#1e293b': '#262930',  # slate-800 borders/raised → line
    '#334155': '#363a43',  # slate-700 → line-strong
    '#475569': '#4a4f58',  # slate-600
    '#64748b': '#6b7079',  # slate-500 → text-mute
    '#94a3b8': '#9aa0aa',  # slate-400 → text-dim
    '#cbd5e1': '#c4c9cf',  # slate-300 soft body
    '#e2e8f0': '#eef0f2',  # slate-200 → text
    '#f1f5f9': '#eef0f2',  # slate-100 → text
    '#f8fafc': '#ffffff',  # slate-50 titles → text-strong
    # ── blue / sky → amber ──────────────────────────────────────────────────
    '#1d4ed8': '#c78f15', '#2563eb': '#e0a41e', '#3b82f6': '#f5b62b',
    '#60a5fa': '#ffce5a', '#93c5fd': '#ffce5a', '#bfdbfe': '#ffedc2',
    '#0ea5e9': '#f5b62b', '#38bdf8': '#f5b62b', '#7dd3fc': '#ffce5a',
    '#0284c7': '#e0a41e',
    # ── cyan → amber ────────────────────────────────────────────────────────
    '#06b6d4': '#f5b62b', '#22d3ee': '#f5b62b', '#67e8f9': '#ffce5a',
    '#a5f3fc': '#ffdd8a', '#cffafe': '#ffedc2', '#0891b2': '#e0a41e',
    # ── indigo → amber ──────────────────────────────────────────────────────
    '#4f46e5': '#e0a41e', '#6366f1': '#f5b62b', '#818cf8': '#ffce5a',
    '#a5b4fc': '#ffce5a', '#c7d2fe': '#ffdd8a', '#e0e7ff': '#ffedc2',
    # ── violet / purple → amber ─────────────────────────────────────────────
    '#7c3aed': '#e0a41e', '#8b5cf6': '#f5b62b', '#a78bfa': '#ffce5a',
    '#c4b5fd': '#ffdd8a', '#ddd6fe': '#ffedc2', '#9333ea': '#e0a41e',
    '#a855f7': '#f5b62b', '#c084fc': '#ffce5a', '#d8b4fe': '#ffdd8a',
    # ── fuchsia / pink (decorative accents; rose = status stays) ────────────
    '#c026d3': '#e0a41e', '#d946ef': '#f5b62b', '#e879f9': '#ffce5a',
    '#f0abfc': '#ffce5a', '#f5d0fe': '#ffdd8a',
    '#db2777': '#e0a41e', '#ec4899': '#f5b62b', '#f472b6': '#ffce5a',
    '#f9a8d4': '#ffdd8a', '#fbcfe8': '#ffedc2',
    # ── teal / lime / light-pink tints (decorative, not status) → amber ─────
    '#0d9488': '#e0a41e', '#14b8a6': '#f5b62b', '#2dd4bf': '#f5b62b',
    '#5eead4': '#ffce5a', '#99f6e4': '#ffdd8a', '#ccfbf1': '#ffedc2',
    '#84cc16': '#f5b62b', '#a3e635': '#ffce5a', '#bef264': '#ffdd8a',
    '#ecfccb': '#ffedc2', '#e0f2fe': '#ffedc2', '#fce7f3': '#ffedc2',
    '#fdf2f8': '#fff8e6',
    # ── stray dark blues/grays (custom one-offs) → ink ──────────────────────
    '#111827': '#17181c', '#0b1226': '#0e0f12', '#060912': '#0a0b0d',
    '#101728': '#17181c', '#0d1424': '#101115', '#111a2e': '#17181c',
    # ── deep blues (selected/active fills) → dark amber ─────────────────────
    '#1e3a8a': '#4a3d13', '#1e40af': '#4a3d13', '#172554': '#2a2410',
    '#0c4a6e': '#4a3d13', '#155e75': '#4a3d13', '#3730a3': '#4a3d13',
    # ── unify existing ambers onto the ds accent values ─────────────────────
    '#fbbf24': '#f5b62b', '#fcd34d': '#ffce5a',
}

# rgba(R, G, B, a) tints of the cool accents → amber tints (alpha preserved).
RGB_MAP = {
    '59,130,246': '245,182,43', '37,99,235': '245,182,43',
    '56,189,248': '245,182,43', '14,165,233': '245,182,43',
    '6,182,212': '245,182,43', '34,211,238': '245,182,43',
    '103,232,249': '255,206,90',
    '99,102,241': '245,182,43', '129,140,248': '255,206,90',
    '165,180,252': '255,206,90',
    '139,92,246': '245,182,43', '167,139,250': '255,206,90',
    '196,181,253': '255,221,138',
    '217,70,239': '245,182,43', '232,121,249': '255,206,90',
    '240,171,252': '255,206,90',
    '236,72,153': '245,182,43', '244,114,182': '255,206,90',
    '251,191,36': '245,182,43',
    # second wave (census 2): cool tints that survived round 1
    '96,165,250': '255,206,90', '147,197,253': '255,206,90',
    '125,211,252': '255,206,90', '192,132,252': '255,206,90',
    '168,85,247': '245,182,43', '20,184,166': '245,182,43',
    '94,234,212': '255,206,90', '190,242,100': '255,221,138',
    '250,204,21': '245,182,43',
    # neutrals that appear as rgba() tints
    '30,41,59': '38,41,48', '15,23,42': '23,24,28',
    '148,163,184': '154,160,170', '2,6,23': '10,11,13',
    '51,65,85': '54,58,67', '203,213,225': '196,201,207',
}

def retheme(text: str) -> str:
    def hex_sub(m):
        return HEX_MAP.get(m.group(0).lower(), m.group(0))
    text = re.sub(r'#[0-9a-fA-F]{6}\b', hex_sub, text)
    for src, dst in RGB_MAP.items():
        r, g, b = src.split(',')
        pat = re.compile(r'rgba?\(\s*%s\s*,\s*%s\s*,\s*%s\s*' % (r, g, b))
        text = pat.sub(lambda m, d=dst: m.group(0).split('(')[0] + '(' + d, text)
    return text

def main():
    dry = '--dry-run' in sys.argv
    total = 0
    for f in FILES:
        if not f.exists():
            continue
        before = f.read_text()
        after = retheme(before)
        n = sum(1 for a, b in zip(before.split('\n'), after.split('\n')) if a != b)
        if n:
            total += n
            print(f'{f.relative_to(ROOT)}: {n} lines rethemed')
            if not dry:
                f.write_text(after)
    print(f'{"DRY RUN — " if dry else ""}{total} lines total')

if __name__ == '__main__':
    main()
