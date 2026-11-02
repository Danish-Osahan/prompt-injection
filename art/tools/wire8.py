"""art-v8 code-vision Noor: a line-art pass over every Noor sheet (same frames, same JSON -> animation stays in sync).
Silhouette contour (bright) + interior edges from a luminance Sobel (teal) + sparse scanlines inside the body, on transparent.
usage: python3 wire8.py  (reads game/public/assets/sprites/noor_*.png, writes ../out/sprites/wire/ and the game copies)"""
import os, json, shutil, glob
import numpy as np
from PIL import Image, ImageFilter
H = os.path.dirname(os.path.abspath(__file__)); G = H + '/../../game/public/assets/sprites/'; O = H + '/../out/sprites/wire/'
os.makedirs(O, exist_ok=True)
TEAL = np.array([120, 228, 232], np.float32); BRIGHT = np.array([214, 252, 252], np.float32); DEEP = np.array([10, 52, 60], np.float32)
def mf(a, n, mode='max'):
    im = Image.fromarray((a*255).astype(np.uint8)); im = im.filter(ImageFilter.MaxFilter(n) if mode == 'max' else ImageFilter.MinFilter(n))
    return np.asarray(im).astype(np.float32)/255
for png in sorted(glob.glob(G + 'noor_*.png')):
    if png.endswith('_wire.png'): continue
    nm = os.path.basename(png)[:-4]; im = np.asarray(Image.open(png).convert('RGBA')).astype(np.float32)/255
    a = (im[..., 3] > 0.45).astype(np.float32)
    contour = np.clip(a - mf(a, 3, 'min'), 0, 1)                      # 1-2 px inside the silhouette edge
    lum = (im[..., :3]*np.array([0.3, 0.59, 0.11])).sum(2)*a
    L = Image.fromarray((lum*255).astype(np.uint8)); gx = np.asarray(L.filter(ImageFilter.Kernel((3, 3), [-1, 0, 1, -2, 0, 2, -1, 0, 1], 1))).astype(np.float32)
    gy = np.asarray(L.filter(ImageFilter.Kernel((3, 3), [-1, -2, -1, 0, 0, 0, 1, 2, 1], 1))).astype(np.float32); g = np.hypot(gx, gy)/255
    inner = np.clip((g - 0.10)*5, 0, 1)*mf(a, 5, 'min')                # interior edges (face, cardigan folds, hair mass), not the rim
    scan = np.zeros_like(a); scan[::4] = 1; scan *= mf(a, 3, 'min')*0.22
    rgb = DEEP[None, None]*1.0; out = np.zeros(im.shape, np.float32)
    col = DEEP*(1 - inner[..., None]) + TEAL*inner[..., None]
    col = col*(1 - contour[..., None]) + BRIGHT*contour[..., None]
    alpha = np.clip(a*0.16 + scan + inner*0.95 + contour, 0, 1)
    out[..., :3] = col/255; out[..., 3] = alpha
    Image.fromarray((out*255).astype(np.uint8), 'RGBA').save(O + nm + '_wire.png', optimize=True)
    j = json.load(open(G + nm + '.json')); j['meta']['image'] = nm + '_wire.png'; j['meta']['note'] = 'art-v8 code-vision line-art pass of ' + nm + '.png (wire8.py); identical frames'
    json.dump(j, open(O + nm + '_wire.json', 'w'))
    shutil.copy(O + nm + '_wire.png', G); shutil.copy(O + nm + '_wire.json', G)
    print('wire', nm)
