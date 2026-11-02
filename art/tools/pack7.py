"""art-v7: pack Noor's dash + 3-hit TYPE combo sheets with pack5 (same 192 px format, rows S..SW, pivot 96,160).
Dash burst frames keep a light packing-time smear; since art-v7b the bun, flyaways, pencil and face locks also trail on their own pivots (noor7.py).
Adds hit_frame / tell meta per hit."""
import os, sys, json, shutil
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import pack5, anim_table
A7 = {'dash': (8, 24), 'type1': (6, 22), 'type2': (6, 22), 'type3': (8, 20)}
HIT = {'type1': 2, 'type2': 2, 'type3': 3}
TELL = {'dash': 'frames 0-1 anticipation (crouch + lean), 2-5 burst (low, stretched, arms back, smear), 6-7 skid recovery; i-frames are game-side',
        'type1': 'JAB: frame 0-1 wind back (caret blade drawn to the hip), 2 jab lands (hit), 3-5 follow-through + settle',
        'type2': 'SIDE SLASH: frame 0-1 torso twists away, blade low, 2 slash across (hit), 3-5 follow-through twist + settle',
        'type3': 'OVERHEAD SLAM: frames 0-2 both arms rise overhead (tell, longest), 3 slam down (hit), 4-7 heavy follow-through + recover'}
DV = {'S': (0, 1), 'SE': (.7, .7), 'E': (1, 0), 'NE': (.7, -.7), 'N': (0, -1), 'NW': (-.7, -.7), 'W': (-1, 0), 'SW': (-.7, .7)}
src = os.path.join(HERE, '../render/sprites'); sm = os.path.join(HERE, '../render/sprites_pack'); os.makedirs(sm, exist_ok=True)
for fn in os.listdir(src):
    im = Image.open(os.path.join(src, fn)).convert('RGBA')
    an, dn, k = fn[:-4].rsplit('_', 2)
    if an == 'dash' and int(k) in (2, 3, 4, 5):
        dx, dy = DV[dn]; base = Image.new('RGBA', im.size, (0, 0, 0, 0)); a = np.asarray(im).astype(np.float32)
        for dist, al in ((44, 0.10), (24, 0.22)):  # lighter since art-v7b: the hair now trails for real (bun/strand pivots in noor7.py)        # source px (384) -> 22/12 px in the 192 sheet
            g = a.copy(); g[..., :3] = g[..., :3]*0.35 + np.array([120, 228, 232])*0.65; g[..., 3] *= al
            base.alpha_composite(Image.fromarray(g.astype(np.uint8)), (int(-dx*dist), int(-dy*dist*0.6)))
        base.alpha_composite(im); im = base
    im.save(os.path.join(sm, fn))
pack5.SRC = sm; pack5.OUT = os.path.join(HERE, '../out/sprites'); os.makedirs(pack5.OUT, exist_ok=True)
pack5.anims_for = lambda name: A7
pack5.EXTRA_TELL = dict(getattr(pack5, 'EXTRA_TELL', {}), **TELL)
pack5.pack('noor')
for an in A7:
    p = os.path.join(pack5.OUT, 'noor_%s.json' % an); d = json.load(open(p))
    if an in HIT: d['meta']['hit_frame'] = HIT[an]
    d['meta']['tell'] = TELL[an]; d['meta']['loop'] = False
    json.dump(d, open(p, 'w'), indent=1)
print('pack7 done')
