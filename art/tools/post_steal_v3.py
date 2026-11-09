"""Feather-blend STEALV3 in-scene border renders onto the clarity office plate."""
import os, glob
import numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
RD = ROOT + '/art/render/steal_v3/'
OUT = ROOT + '/art/render/steal_v3/comp/'
os.makedirs(OUT, exist_ok=True)
plate = np.asarray(Image.open(ROOT + '/game/public/assets/rooms/office.jpg').convert('RGB')).astype(np.float32)

def feather_mask(h, w, m):
    yy, xx = np.mgrid[0:h, 0:w]
    fe = np.clip(np.minimum.reduce([xx, w-1-xx, yy, h-1-yy]) / float(m), 0, 1)
    return (fe * fe * (3 - 2 * fe))[..., None]

def save_series(pattern, prefix, box, m=16):
    bx0, by0, bx1, by1 = box
    for k, f in enumerate(sorted(glob.glob(RD + pattern))):
        fr = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
        region, base = fr[by0:by1, bx0:bx1], plate[by0:by1, bx0:bx1]
        fe = feather_mask(by1 - by0, bx1 - bx0, m)
        out = base * (1 - fe) + region * fe
        Image.fromarray(out.astype(np.uint8)).save(f'{OUT}{prefix}_{k:02d}.png')
        full = plate.copy(); full[by0:by1, bx0:bx1] = out
        Image.fromarray(full.astype(np.uint8)).save(f'{OUT}{prefix}_full_{k:02d}.jpg', quality=93)
        print(prefix, k)

save_series('door_hang_*.png', 'door_hang', (100, 50, 320, 370))
save_series('door_snap_*.png', 'door_snap', (100, 50, 320, 370))
save_series('win_*.png', 'win', (740, 55, 1180, 220), 14)
print('post_steal_v3 ok')
