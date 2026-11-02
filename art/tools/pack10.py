"""art-v10: pack Noor's full-body sheets (noor10.py renders at the office9 30deg camera, long legs, baked contact shadow)
with pack5 (192 px frames, pivot 96,160). Walk: 12 frames, fps calibrated to WALK speed (stride ~79 px per cycle at 1x)."""
import os, sys, json, shutil
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import pack5
SRC = os.path.join(HERE, '../render/sprites10'); SM = os.path.join(HERE, '../render/sprites10_pack'); os.makedirs(SM, exist_ok=True)
G = os.path.join(HERE, '../../game/public/assets/sprites/')
DV = {'S': (0, 1), 'SE': (.7, .7), 'E': (1, 0), 'NE': (.7, -.7), 'N': (0, -1), 'NW': (-.7, -.7), 'W': (-1, 0), 'SW': (-.7, .7)}
for fn in os.listdir(SRC):
    im = Image.open(os.path.join(SRC, fn)).convert('RGBA'); an, dn, k = fn[:-4].rsplit('_', 2)
    if an == 'dash' and int(k) in (2, 3, 4, 5):
        dx, dy = DV[dn]; base = Image.new('RGBA', im.size); a = np.asarray(im).astype(np.float32)
        for dist, al in ((44, 0.10), (24, 0.22)):
            g = a.copy(); g[..., :3] = g[..., :3]*0.35 + np.array([120, 228, 232])*0.65; g[..., 3] *= al
            base.alpha_composite(Image.fromarray(g.astype(np.uint8)), (int(-dx*dist), int(-dy*dist*0.6)))
        base.alpha_composite(im); im = base
    im.save(os.path.join(SM, fn))
pack5.SRC = SM; pack5.OUT = os.path.join(HERE, '../out/sprites10'); os.makedirs(pack5.OUT, exist_ok=True)
pack5.shadow = lambda name, fd=1.0: Image.new('RGBA', (pack5.FRAME, pack5.FRAME))   # contact shadow is rendered now
HIT = {'type1': 2, 'type2': 2, 'type3': 3}
GROUPS = [({'idle': (8, 8), 'walk': (12, 30), 'dash': (8, 30), 'type1': (6, 24), 'type2': (6, 24), 'type3': (8, 22), 'lookL': (1, 1), 'lookR': (1, 1), 'surprise': (5, 14)},
           ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']), ({'phone': (6, 4), 'shadow': (6, 5)}, ['S', 'SE', 'SW'])]
for A, dirs in GROUPS:
    pack5.DIRS_FOR['noor'] = dirs; pack5.anims_for = lambda name, A=A: A; pack5.pack('noor')
    for an in A:
        p = os.path.join(pack5.OUT, 'noor_%s.json' % an); d = json.load(open(p))
        d['meta']['loop'] = an in ('idle', 'walk'); d['meta']['app'] = 'prompt-injection art-v10 pack10.py'
        if an in HIT: d['meta']['hit_frame'] = HIT[an]
        json.dump(d, open(p, 'w'), indent=1)
        for ext in ('png', 'json'): shutil.copy(os.path.join(pack5.OUT, 'noor_%s.%s' % (an, ext)), G)
# noor_attack (legacy single-swing sheet) -> alias of type1 so every attack is the same full-body rig
for ext in ('png',): shutil.copy(os.path.join(pack5.OUT, 'noor_type1.png'), G + 'noor_attack.png')
d = json.load(open(os.path.join(pack5.OUT, 'noor_type1.json'))); txt = json.dumps(d).replace('noor_type1', 'noor_attack'); open(G + 'noor_attack.json', 'w').write(txt)
print('pack10 done')
