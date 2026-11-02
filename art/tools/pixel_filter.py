# art-v6 P3: variant (b) pixel filter for flashbacks / glitch moments (spec from the story bible):
#   same render at 640x360 -> locked 24-colour palette with dither -> 1 px ink outline -> nearest upscale x2.
# The v6 lock palette CALM24 is built once from the calm v6 mocks (median cut) so flashbacks keep the teal/indigo + lamp-warm look;
# the old neon PAL24 (palette_h.py) is still available with --neon. Writes out/p3/pixel_<name>.png and out/p3/pixel_palette_calm24.png.
# usage: python3 pixel_filter.py [--neon] in.png [in2.png ...]
import sys, os, glob, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); V6 = os.path.join(HERE, '..') + '/'; OUT = V6 + 'out/p3/'; os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, HERE); from palette_h import PAL24
INK = (12, 14, 30)
def calm24():
    pj = OUT + 'calm24.json'
    if os.path.exists(pj): return [tuple(c) for c in json.load(open(pj))]
    fs = sorted(glob.glob(V6 + 'out/H6_R*_1280x720.png'))
    strip = Image.new('RGB', (320, 180*len(fs)))
    for i, f in enumerate(fs): strip.paste(Image.open(f).convert('RGB').resize((320, 180)), (0, 180*i))
    q = strip.quantize(15, method=Image.Quantize.MEDIANCUT); pal = q.getpalette()[:45]
    cols = [tuple(pal[i:i+3]) for i in range(0, 45, 3)] + [INK, (240, 232, 214), (206, 150, 62), (255, 206, 120), (176, 112, 82), (120, 76, 30), (110, 210, 226), (232, 96, 106), (150, 128, 226)]   # 15 sampled + 9 locked character/accent colours
    json.dump(cols, open(pj, 'w')); return cols
def palimg(cols):
    p = Image.new('P', (1, 1)); flat = [c for t in cols for c in t]; p.putpalette(flat + flat[:3]*(256 - len(cols))); return p
def pixelate(im, cols):
    sm = im.convert('RGB').resize((640, 360), Image.LANCZOS)
    q = sm.quantize(palette=palimg(cols), dither=Image.Dither.FLOYDSTEINBERG).convert('RGB')
    a = np.asarray(q).astype(np.int16); lum = a.mean(2)
    # 1 px ink outline where a bright shape meets dark ground (edge of luminance steps)
    edge = (np.abs(np.diff(lum, axis=0, prepend=lum[:1])) > 60) | (np.abs(np.diff(lum, axis=1, prepend=lum[:, :1])) > 60)
    dark = lum < np.roll(lum, 1, 0)
    o = a.copy(); o[edge & dark] = INK
    return Image.fromarray(o.astype(np.uint8)).resize((1280, 720), Image.NEAREST)
if __name__ == '__main__':
    args = sys.argv[1:]; neon = '--neon' in args; args = [a for a in args if a != '--neon']
    cols = PAL24 if neon else calm24()
    sw = Image.new('RGB', (24*40, 60), INK); d = ImageDraw.Draw(sw)
    for i, c in enumerate(cols): d.rectangle([i*40 + 2, 2, i*40 + 38, 58], fill=c)
    sw.save(OUT + ('pixel_palette_neon24.png' if neon else 'pixel_palette_calm24.png'))
    for f in args:
        nm = os.path.basename(f).replace('H6_', '').replace('_1280x720', '')
        pixelate(Image.open(f), cols).save(OUT + 'pixel_' + nm); print('pixel', nm)
