# art-v6 P3 finisher: ending stills (clean, no text: UI direction B composites its own floor text from extra.tiles),
# trimmed transparent prop renders + a contact sheet.
import os, glob, json, shutil
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import numpy as np
V6 = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..') + '/'; RP = V6 + 'render/p3/'; O = V6 + 'out/p3/'
os.makedirs(O + 'props', exist_ok=True); os.makedirs(O + 'endings', exist_ok=True)
def vignette(im, amt=0.3):
    w, h = im.size; yy, xx = np.mgrid[0:h, 0:w].astype(np.float32); r = np.sqrt(((xx-w/2)/(w/2))**2 + ((yy-h/2)/(h/2))**2)
    a = np.asarray(im.convert('RGB')).astype(np.float32); k = 1 - amt*np.clip(r - 0.5, 0, 1)[..., None]
    return Image.fromarray(np.clip(a*k + (1-k)*np.array((4, 10, 16)), 0, 255).astype(np.uint8))
for e in ('RE_signed', 'RE_unsent', 'RE_ooo', 'RE_dawn'):
    c = RP + e + '_clean.png'
    if os.path.exists(c): vignette(Image.open(c)).save(O + 'endings/%s_clean.png' % e.replace('RE_', 'ending_'))
    if os.path.exists(RP + e + '_actors.json'): shutil.copy(RP + e + '_actors.json', O + 'endings/%s_positions.json' % e.replace('RE_', 'ending_'))
props = sorted(glob.glob(RP + 'Rprop_*.png')); props = [p for p in props if '_mist' not in p and '_index' not in p]
cells = []
for p in props:
    im = Image.open(p).convert('RGBA'); bb = im.getbbox(); im = im.crop(bb); nm = os.path.basename(p).replace('Rprop_', 'prop_'); im.save(O + 'props/' + nm); cells.append((nm, im))
S = 300; sheet = Image.new('RGB', (S*4, S*2), (18, 28, 38)); d = ImageDraw.Draw(sheet)
for i, (nm, im) in enumerate(cells):
    t = im.copy(); t.thumbnail((S-20, S-40)); x, y = (i % 4)*S, (i//4)*S; sheet.paste(t, (x + (S - t.width)//2, y + 8), t); d.text((x + 10, y + S - 22), nm[:-4], fill=(170, 220, 228))
sheet.save(O + 'props_contact.png'); print('p3 finish', len(cells), 'props')
