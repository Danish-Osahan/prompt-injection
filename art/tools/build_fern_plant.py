#!/usr/bin/env python3
"""Fern = the office's potted plant, made of sticky notes, with a face in the leaves.
Built from existing office_fg_plant.png + sticky_gm.png. No AI art."""
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageEnhance
from pathlib import Path
import math

ROOT = Path('/workspace/repos/prompt-injection')
PLANT = Image.open(ROOT / 'game/public/assets/rooms/fg/office_fg_plant.png').convert('RGBA')
STICKY = Image.open(ROOT / 'art/tex/sticky_gm.png').convert('RGBA')
# sticky_gm is RGB pink card; punch a slightly rounded rect if no alpha
if STICKY.mode != 'RGBA' or STICKY.split()[-1].getextrema() == (255, 255):
    bg = STICKY.convert('RGB').getpixel((0, 0))
    # treat near-bg as transparent? the card is full-bleed pink. keep full, we'll scale.
    s = STICKY.convert('RGBA')
else:
    s = STICKY
STICKY = s

# cell large enough for a 110-120px on-screen plant plus a little headroom
CELL_W, CELL_H = 140, 200
FRAMES = 4
# scale plant so total character (pot+leaves) is ~150px tall in the cell (displays at 0.7-0.8 → 105-120px)
target_h = 152
scale = target_h / PLANT.size[1]
pw, ph = int(PLANT.size[0] * scale), int(PLANT.size[1] * scale)
PLANT_S = PLANT.resize((pw, ph), Image.Resampling.LANCZOS)
print('plant scaled', PLANT.size, '->', PLANT_S.size, 'scale', scale)

def punch_sticky(size, rot):
    """Scale the good-morning sticky, keep the writing, rotate."""
    src = STICKY.resize(size, Image.Resampling.LANCZOS)
    # the source is a full pink square; that's fine as a note
    im = Image.new('RGBA', (size[0] + 8, size[1] + 8), (0, 0, 0, 0))
    # slight shadow
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((6, 6, 6 + size[0], 6 + size[1]), fill=(40, 20, 40, 80))
    im = Image.alpha_composite(im, sh)
    im.paste(src, (4, 4), src)
    return im.rotate(rot, resample=Image.Resampling.BICUBIC, expand=True)

def face_on_leaf(blink, ox):
    """A pale leaf with a face — same language as the plant, not a sticker circle."""
    w, h = 26, 32
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    leaf = [(13, 1), (24, 10), (24, 24), (13, 30), (2, 24), (2, 10)]
    d.polygon(leaf, fill=(160, 208, 200, 235), outline=(64, 112, 106, 255))
    # midrib
    d.line((13, 4, 13, 28), fill=(110, 170, 162, 180), width=1)
    if blink:
        d.line((7, 16, 11, 16), fill=(20, 32, 36, 255), width=2)
        d.line((15, 16, 19, 16), fill=(20, 32, 36, 255), width=2)
    else:
        d.ellipse((7, 13, 12, 19), fill=(18, 28, 34, 255))
        d.ellipse((15, 13, 20, 19), fill=(18, 28, 34, 255))
        d.point((8, 14), fill=(200, 250, 255, 255))
        d.point((16, 14), fill=(200, 250, 255, 255))
    d.arc((9, 18, 17, 24), 20, 160, fill=(50, 80, 78, 255), width=1)
    if ox:
        im = im.rotate(ox, resample=Image.Resampling.BICUBIC, expand=True)
    return im

def frame(i):
    canvas = Image.new('RGBA', (CELL_W, CELL_H), (0, 0, 0, 0))
    sway = math.sin(i / FRAMES * math.pi * 2)
    # plant sits on the bottom, centered
    px = (CELL_W - pw) // 2 + int(sway * 1)
    py = CELL_H - ph - 6 + int(abs(sway) * 0)  # pot stays planted
    # slight leaf sway by rotating a copy around the pot rim
    plant = PLANT_S.rotate(sway * 2.2, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=(0, 0, 0, 0),
                           center=(pw / 2, ph * 0.82))
    canvas.paste(plant, (px, py), plant)

    # stickies: two in the foliage, one on the pot
    # foliage mid
    s1 = punch_sticky((22, 22), -22 + sway * 4)
    s2 = punch_sticky((20, 20), 18 - sway * 3)
    s3 = punch_sticky((18, 16), 8)
    # positions relative to plant
    def blit(st, x, y):
        nonlocal canvas
        layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
        layer.paste(st, (int(x), int(y)), st)
        canvas = Image.alpha_composite(canvas, layer)

    blit(s1, px + pw * 0.02, py + ph * 0.30 + sway * 1.5)
    blit(s2, px + pw * 0.50, py + ph * 0.36 - sway * 1.2)
    # front face of the pot (lower third of the sprite)
    blit(s3, px + pw * 0.34, py + ph * 0.68)

    # face in the upper-middle of the leaf cluster
    fc = face_on_leaf(blink=(i == 2), ox=sway * 2)
    blit(fc, px + pw * 0.26 + sway * 1, py + ph * 0.18 + abs(sway) * 0.4)
    return canvas

sheet = Image.new('RGBA', (CELL_W * FRAMES, CELL_H), (0, 0, 0, 0))
for i in range(FRAMES):
    fr = frame(i)
    sheet.paste(fr, (i * CELL_W, 0), fr)
    fr.save(f'/tmp/fern_plant_f{i}.png')
    bb = fr.split()[-1].getbbox()
    print(f'frame {i} bbox', bb, 'h', bb[3]-bb[1] if bb else 0)

sheet.save('/tmp/fern_plant_sheet.png')
sheet.resize((sheet.size[0] * 2, sheet.size[1] * 2), Image.Resampling.NEAREST).save('/tmp/fern_plant_sheet_x2.png')
# close crop of frame 0 at 3x for review
f0 = frame(0)
bb = f0.split()[-1].getbbox()
f0.crop(bb).resize(((bb[2]-bb[0])*3, (bb[3]-bb[1])*3), Image.Resampling.NEAREST).save('/tmp/fern_plant_close.png')
print('done', sheet.size)
