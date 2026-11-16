#!/usr/bin/env python3
"""Crisp vector-style Fern: a potted fern character with fronds, eyes and a mouth.
No AI images. Four idle frames. Scanlines are baked inside the silhouette only.
"""
from __future__ import annotations
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'game/public/assets/sprites'
W, H = 160, 220  # per frame
FRAMES = 4
PIVOT = (0.50, 0.93)  # pot base
CYAN = (120, 228, 232, 255)
INK = (8, 28, 32, 255)
LEAF = (46, 140, 118, 255)
LEAF_LIT = (92, 210, 176, 255)
LEAF_DARK = (24, 86, 74, 255)
POT = (126, 96, 78, 255)
POT_LIT = (168, 132, 104, 255)
POT_DARK = (86, 62, 50, 255)
SOIL = (42, 32, 28, 255)
STICKY_A = (232, 186, 214, 255)
STICKY_B = (214, 206, 150, 255)


def new(w=W, h=H):
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def rot(px, py, ang, ox, oy):
    c, s = math.cos(ang), math.sin(ang)
    x, y = px - ox, py - oy
    return (ox + x * c - y * s, oy + x * s + y * c)


def frond(draw: ImageDraw.ImageDraw, ox, oy, ang, length, width, phase=0.0, back=False):
    """A curved midrib with packed opposite leaflets — a fern frond, not a cactus."""
    lit = LEAF_DARK if back else LEAF_LIT
    mid = LEAF if not back else (30, 100, 84, 255)
    # curved midrib (quadratic)
    pts = []
    curve = 0.22 * length * (1 if ang >= 0 else -1)
    for i in range(14):
        t = i / 13
        # ease along the angle, with a side bow
        bow = math.sin(t * math.pi) * curve * 0.35
        x = ox + math.sin(ang) * length * t + math.cos(ang) * bow
        y = oy - math.cos(ang) * length * t + math.sin(ang) * bow
        pts.append((x, y))
    draw.line(pts, fill=mid, width=max(2, int(width * 0.28)))
    # opposite leaflets along the rib, tapering to the tip
    n = 11
    for i in range(1, n):
        t = i / n
        x, y = pts[int(t * (len(pts) - 1))]
        # local tangent
        i1 = min(len(pts) - 1, int(t * (len(pts) - 1)) + 1)
        i0 = max(0, i1 - 1)
        tx, ty = pts[i1][0] - pts[i0][0], pts[i1][1] - pts[i0][1]
        mag = math.hypot(tx, ty) or 1
        nx, ny = -ty / mag, tx / mag
        spread = (1 - t * 0.82) * width
        for side, col in ((-1, mid), (1, lit)):
            lx = x + nx * spread * side
            ly = y + ny * spread * side
            # lance leaflet: base on the rib, tip out, slight taper
            bx, by = nx * 1.6 * side, ny * 1.6 * side
            p1 = (x - tx / mag * 2 + bx * 0.2, y - ty / mag * 2 + by * 0.2)
            p2 = (x + tx / mag * 2 - bx * 0.2, y + ty / mag * 2 - by * 0.2)
            draw.polygon([p1, (lx, ly), p2], fill=col)
    # tip
    tx, ty = pts[-1]
    draw.polygon([
        (tx, ty),
        (tx + math.sin(ang) * 6, ty - math.cos(ang) * 6),
        (tx + math.cos(ang) * 2, ty + math.sin(ang) * 2),
    ], fill=lit)


def pot(draw: ImageDraw.ImageDraw, cx, top, bot, top_w, bot_w):
    # body
    draw.polygon([
        (cx - top_w, top + 10),
        (cx + top_w, top + 10),
        (cx + bot_w, bot),
        (cx - bot_w, bot),
    ], fill=POT)
    # right shadow
    draw.polygon([
        (cx + top_w * 0.25, top + 10),
        (cx + top_w, top + 10),
        (cx + bot_w, bot),
        (cx + bot_w * 0.2, bot),
    ], fill=POT_DARK)
    # rim
    draw.ellipse((cx - top_w - 2, top, cx + top_w + 2, top + 18), fill=POT_LIT)
    draw.ellipse((cx - top_w + 3, top + 6, cx + top_w - 3, top + 18), fill=SOIL)
    # lip highlight
    draw.arc((cx - top_w - 2, top, cx + top_w + 2, top + 18), 200, 340, fill=CYAN, width=2)


def sticky(draw: ImageDraw.ImageDraw, x, y, w, h, col, rot_deg=0):
    # small square note, drawn as a polygon slightly rotated
    a = math.radians(rot_deg)
    corners = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    pts = [rot(px, py, a, 0, 0) for px, py in corners]
    pts = [(x + p[0], y + p[1]) for p in pts]
    draw.polygon(pts, fill=col)
    # fold
    fx, fy = pts[1]
    draw.polygon([pts[1], (pts[1][0] - 4, pts[1][1] + 1), (pts[1][0] - 1, pts[1][1] + 4)], fill=tuple(max(0, c - 30) if i < 3 else c for i, c in enumerate(col)))


def face(draw: ImageDraw.ImageDraw, cx, cy, blink=False):
    # A small leaf-shaped face plate so the features stay readable at 110px.
    draw.ellipse((cx - 26, cy - 16, cx + 26, cy + 28), fill=(70, 180, 150, 230))
    draw.ellipse((cx - 22, cy - 12, cx + 22, cy + 24), fill=(110, 220, 190, 240))
    for sx in (-12, 12):
        ex, ey = cx + sx, cy
        if blink:
            draw.line((ex - 6, ey, ex + 6, ey + 1), fill=INK, width=3)
            draw.line((ex - 6, ey + 1, ex + 6, ey + 2), fill=CYAN, width=2)
            continue
        draw.ellipse((ex - 8, ey - 7, ex + 8, ey + 8), fill=(240, 255, 255, 255))
        draw.ellipse((ex - 6, ey - 5, ex + 6, ey + 6), fill=CYAN)
        draw.ellipse((ex - 2, ey - 1, ex + 3, ey + 4), fill=INK)
        draw.ellipse((ex - 4, ey - 4, ex - 1, ey - 1), fill=(255, 255, 255, 255))
    # mouth
    draw.arc((cx - 8, cy + 8, cx + 8, cy + 20), 15, 165, fill=INK, width=3)
    draw.arc((cx - 7, cy + 10, cx + 7, cy + 18), 20, 160, fill=CYAN, width=2)


def outline(im: Image.Image, color=CYAN, r=2) -> Image.Image:
    a = im.split()[-1]
    ring = a.filter(ImageFilter.MaxFilter(r * 2 + 1))
    base = Image.new('RGBA', im.size, (0, 0, 0, 0))
    solid = Image.new('RGBA', im.size, color)
    base.paste(solid, (0, 0), ring)
    base.alpha_composite(im)
    return base


def scanlines(im: Image.Image, period=4) -> Image.Image:
    px = im.load()
    w, h = im.size
    for y in range(0, h, period):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            px[x, y] = (int(r * 0.82), int(g * 0.86), int(b * 0.88), a)
    return im


def frame(i: int) -> Image.Image:
    im = new()
    d = ImageDraw.Draw(im)
    phase = i * 0.7
    sway = math.sin(phase) * 0.07
    bob = math.sin(phase) * 1.4
    cx, pot_top, pot_bot = 80, 152 + bob * 0.15, 206
    crown = (cx, pot_top + 4)

    # back fronds first — wide arch so the silhouette is a fern, not a column
    back = [
        (-1.15, 86, 22), (-0.7, 96, 24), (0.7, 96, 24), (1.15, 86, 22),
        (-1.45, 64, 16), (1.45, 66, 16),
    ]
    for ang0, length, width in back:
        frond(d, crown[0], crown[1], ang0 + sway * 0.5, length, width, phase, back=True)

    pot(d, cx, pot_top, pot_bot, 28, 22)
    sticky(d, cx - 16, pot_top + 28, 16, 16, STICKY_A, -12)
    sticky(d, cx + 15, pot_top + 36, 14, 14, STICKY_B, 10)

    # mid / front fronds, leaving a gap at the face
    front = [
        (-0.45, 100, 24), (0.45, 100, 24),
        (-0.9, 88, 22), (0.9, 90, 22),
        (0.0, 78, 18),
        (-1.25, 70, 16), (1.25, 70, 16),
    ]
    for ang0, length, width in front:
        frond(d, crown[0], crown[1] - 2, ang0 + sway, length, width, phase, back=False)

    face(d, cx, 96 + bob, blink=(i == 2))
    im = outline(im, CYAN, 2)
    im = scanlines(im, 4)
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.new('RGBA', (W * FRAMES, H), (0, 0, 0, 0))
    frames = []
    for i in range(FRAMES):
        f = frame(i)
        sheet.paste(f, (i * W, 0), f)
        frames.append(f)
        f.save(f'/tmp/fern_v2_f{i}.png')
    dest = OUT / 'fern_plant.png'
    sheet.save(dest)
    # 110px tall preview (display size)
    bbox_h = 206 - 18  # pot base to typical top
    scale = 110 / 188
    prev = frames[0].resize((int(W * scale), int(H * scale)), Image.Resampling.LANCZOS)
    prev.save('/tmp/fern_v2_110.png')
    sheet.resize((sheet.width * 2, sheet.height * 2), Image.Resampling.NEAREST).save('/tmp/fern_v2_sheet_2x.png')
    meta = {
        'frames': {
            f'fern_plant_S_{i:02d}': {
                'frame': {'x': i * W, 'y': 0, 'w': W, 'h': H},
                'rotated': False, 'trimmed': False,
                'spriteSourceSize': {'x': 0, 'y': 0, 'w': W, 'h': H},
                'sourceSize': {'w': W, 'h': H},
                'pivot': {'x': PIVOT[0], 'y': PIVOT[1]},
            } for i in range(FRAMES)
        },
        'meta': {
            'app': 'build_fern_plant.py', 'version': '2.0',
            'image': 'fern_plant.png', 'format': 'RGBA8888',
            'size': {'w': W * FRAMES, 'h': H}, 'scale': '1',
            'fps': 5, 'anim': 'fern_plant_S',
        },
    }
    (OUT / 'fern_plant.json').write_text(json.dumps(meta, indent=2))
    print('wrote', dest, dest.stat().st_size, 'bbox scale', round(scale, 3))


if __name__ == '__main__':
    main()
