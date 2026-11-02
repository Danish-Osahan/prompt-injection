# art-v6: pack the calm prompt-shard projectile (8 frames, 96 px, 1 row) -> out/sprites/fx_prompt_shard.png/.json/.gif
import os, sys, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from pack5 import down, treat, to_img, shared_palette
SRC = HERE+'/../render/sprites/'; OUT = HERE+'/../out/sprites/'; F = 96
sheet = Image.new('RGBA', (F*8, F)); fr = {}; gif = []
for k in range(8):
    im = to_img(treat(down(Image.open(SRC+'shard_%02d.png' % k), (F, F)))); sheet.alpha_composite(im, (k*F, 0))
    fr['fx_prompt_shard_%02d' % k] = {'frame': {'x': k*F, 'y': 0, 'w': F, 'h': F}, 'rotated': False, 'trimmed': False, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': F, 'h': F}, 'sourceSize': {'w': F, 'h': F}, 'pivot': {'x': 0.5, 'y': 0.5}}
    bg = Image.new('RGBA', (F, F), (18, 28, 38, 255)); bg.alpha_composite(im); gif.append(bg.convert('RGB'))
sheet.save(OUT+'fx_prompt_shard.png')
json.dump({'frames': fr, 'meta': {'app': 'art-v6 pack_fx6.py', 'image': 'fx_prompt_shard.png', 'size': {'w': F*8, 'h': F}, 'scale': '1', 'fps': 12, 'loop': True,
           'animations': {'fx_prompt_shard': list(fr)}, 'note': 'v6 calm projectile: warm amber keycap with >_ glyph (was magenta in v4). Direction-agnostic spin; pivot = centre.'}}, open(OUT+'fx_prompt_shard.json', 'w'), indent=1)
g = shared_palette(gif, 96); g[0].save(OUT+'fx_prompt_shard_preview.gif', save_all=True, append_images=g[1:], duration=83, loop=0)
print('fx ok')
