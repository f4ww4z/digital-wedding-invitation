#!/usr/bin/env python3
"""Generate the original demo artwork (SVG) shipped in apps/web/public/demo.
Pure-vector botanical compositions; no third-party assets."""
import math, random, sys, pathlib

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'apps/web/public/demo')
OUT.mkdir(parents=True, exist_ok=True)

def petal(length, width):
    return (f"M0 0 C {-width} {-length*0.35}, {-width*0.8} {-length}, 0 {-length} "
            f"C {width*0.8} {-length}, {width} {-length*0.35}, 0 0 Z")

def bloom(x, y, r, outer, mid, heart, rot, gid):
    s = r / 50
    g = [f'<g transform="translate({x:.1f} {y:.1f}) rotate({rot}) scale({s:.3f})">',
         f'<defs><radialGradient id="o{gid}" cx="0" cy="0" r="50" gradientUnits="userSpaceOnUse"><stop offset=".25" stop-color="{mid}"/><stop offset="1" stop-color="{outer}"/></radialGradient>',
         f'<radialGradient id="m{gid}" cx="0" cy="0" r="34" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{heart}"/><stop offset="1" stop-color="{mid}"/></radialGradient></defs>']
    for n, ln, wd, fill, off in ((7, 46, 24, f'url(#o{gid})', 0), (6, 34, 19, f'url(#m{gid})', 26), (5, 22, 13, f'url(#m{gid})', 8)):
        for i in range(n):
            g.append(f'<path d="{petal(ln, wd)}" fill="{fill}" opacity=".95" transform="rotate({360/n*i+off:.1f})"/>')
    g.append(f'<path d="M-9 2 C -10 -8, 4 -12, 8 -4 C 11 3, 2 9, -3 6" fill="none" stroke="{heart}" stroke-width="2.2" stroke-linecap="round" opacity=".8"/></g>')
    return ''.join(g)

def leaf(x, y, length, rot, fill):
    s = length / 80
    return (f'<g transform="translate({x:.1f} {y:.1f}) rotate({rot}) scale({s:.3f})">'
            f'<path d="M0 0 C -18 -20, -16 -58, 0 -78 C 16 -58, 18 -20, 0 0 Z" fill="{fill}" opacity=".92"/>'
            f'<path d="M0 -2 L0 -72" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/></g>')

PALETTES = {
    'rose':  ('#f3d6da', '#dda4ad', '#a85a6a'),
    'blush': ('#fbeef0', '#f0cdd3', '#d99aa5'),
    'cream': ('#fffdf8', '#f6eadf', '#d9b48f'),
    'mauve': ('#e6dcec', '#c9b6d6', '#7d6590'),
}
SAGE = ['#7a9883', '#5f7d68', '#b5c9ba', '#93ab99']

def composition(w, h, bg1, bg2, seed, monogram=None, arch=False):
    rnd = random.Random(seed)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">',
             f'<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/></linearGradient>',
             '<radialGradient id="glow" cx=".5" cy=".38" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>',
             f'<rect width="{w}" height="{h}" fill="url(#bg)"/><rect width="{w}" height="{h}" fill="url(#glow)"/>']
    if arch:
        r = w * 0.36
        parts.append(f'<path d="M{w/2-r} {h*0.86} V{h*0.42} A{r} {r} 0 0 1 {w/2+r} {h*0.42} V{h*0.86} Z" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2"/>')
    gid = 0
    # foliage first, then blooms along the bottom and one corner
    for _ in range(14):
        x = rnd.choice([rnd.uniform(-20, w*0.35), rnd.uniform(w*0.65, w+20)])
        y = rnd.uniform(h*0.6, h+20)
        parts.append(leaf(x, y, rnd.uniform(60, 120), rnd.uniform(-70, 70), rnd.choice(SAGE)))
    for _ in range(4):
        parts.append(leaf(rnd.uniform(0, w), rnd.uniform(-10, h*0.15), rnd.uniform(50, 90), rnd.uniform(120, 240), rnd.choice(SAGE)))
    blooms = [(rnd.uniform(-10, w*0.3), rnd.uniform(h*0.78, h), 1.0), (rnd.uniform(w*0.7, w+10), rnd.uniform(h*0.8, h), 0.9),
              (rnd.uniform(w*0.3, w*0.7), h+rnd.uniform(-10, 20), 0.8), (rnd.uniform(-20, w*0.2), rnd.uniform(-20, h*0.1), 0.7),
              (rnd.uniform(w*0.8, w+20), rnd.uniform(-20, h*0.12), 0.55)]
    for x, y, k in blooms:
        tone = rnd.choice(list(PALETTES))
        gid += 1
        parts.append(bloom(x, y, w*0.17*k, *PALETTES[tone], rnd.uniform(0, 360), f'{seed}{gid}'))
    for _ in range(18):
        parts.append(f'<circle cx="{rnd.uniform(0,w):.1f}" cy="{rnd.uniform(h*0.5,h):.1f}" r="{rnd.uniform(1.5,3.2):.1f}" fill="#fff" opacity=".9"/>')
    if monogram:
        parts.append(f'<text x="{w/2}" y="{h*0.53}" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-style="italic" font-size="{w*0.38:.0f}" fill="#fff" fill-opacity=".92">{monogram}</text>')
    parts.append('</svg>')
    return '\n'.join(parts)

(OUT / 'bride.svg').write_text(composition(560, 760, '#f6dfe3', '#e9c6cd', 11, 'A', arch=True))
(OUT / 'groom.svg').write_text(composition(560, 760, '#dfe8e1', '#c6d6ca', 23, 'R', arch=True))
(OUT / 'gallery-1.svg').write_text(composition(600, 800, '#f3f5ef', '#dfe8e1', 31))
(OUT / 'gallery-2.svg').write_text(composition(600, 600, '#fbeef0', '#f0d9dd', 42))
(OUT / 'gallery-3.svg').write_text(composition(600, 760, '#ece6f1', '#dcd0e6', 53, arch=True))
(OUT / 'gallery-4.svg').write_text(composition(600, 640, '#fff8ef', '#f3e6d6', 64))
(OUT / 'og.svg').write_text(composition(1200, 630, '#f6dfe3', '#dfe8e1', 77, 'A &amp; R'))
print('wrote', sorted(p.name for p in OUT.iterdir()))
