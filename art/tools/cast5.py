# art-v5 cast sheet + palette, composed from the SAME raw 384 px sprite renders the game sheets come from
# (identical rig, outline and glow) plus a Fern render (scene5.py castF).  -> ../out/H5_cast_sheet.png, ../out/H5_palette.png
import os, sys, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from pack5 import down, treat, to_img, OUTLINE_RGB
from anim_table import DIRS_FOR, ATTACK_TELL, anims_for
V5 = os.path.join(HERE, '..') + '/'; RAW = V5 + 'render/sprites/'; OUT = V5 + 'out/'
KF = '/workspace/games/_downloads/ui-pack/Font/Kenney Future.ttf'; KFN = '/workspace/games/_downloads/ui-pack/Font/Kenney Future Narrow.ttf'
F = lambda p, s: ImageFont.truetype(p, s)
BG = (14, 22, 32); PANEL = (20, 32, 44); EDGE = (40, 58, 72); TXT = (214, 226, 230); DIM = (128, 150, 162); WARM = (255, 198, 132)
CYAN = (110, 220, 232); CORAL = (232, 96, 106); MAG = (226, 86, 168)

# calm v5 palette: (rgb, name, use)
PAL = [((8, 10, 22), 'ink', 'outline / deepest shadow'), ((16, 24, 44), 'navy', 'void, HUD panels'), ((16, 52, 64), 'deep teal', 'walls, far floor'),
       ((64, 86, 96), 'floor teal', 'walkable floor'), ((38, 40, 86), 'indigo', 'fill light, shadows'), ((74, 84, 116), 'slate', 'props, Warden'),
       ((156, 174, 198), 'mist', 'haze, dim text'), ((104, 80, 66), 'wood', 'break-room floor'),
       ((255, 198, 132), 'lamp warm', 'lamp pools, pickups'), ((230, 160, 84), 'amber', 'rule tile ADJ'),
       ((110, 220, 232), 'cyan', 'ally, Fern, SEND'), ((214, 240, 246), 'ice', 'Caret, fragments'),
       ((226, 86, 168), 'magenta', 'enemy accent'), ((250, 150, 212), 'pink', 'Sycophant praise'),
       ((232, 96, 106), 'coral', 'danger / attack tells'), ((150, 128, 226), 'lavender', 'Hallucinator'), ((116, 222, 196), 'mint', 'Hallucinator irid.'),
       ((80, 50, 35), 'Noor hair', ''), ((205, 140, 100), 'Noor skin', ''), ((200, 150, 62), 'cardigan', ''), ((226, 218, 204), 'tee / paper', '')]

def sprite(name, anim, d, k, size=384, flash=0.0):
    fn = RAW + ('%s_%s_%02d.png' % (anim, d, k) if name == 'noor' else '%s_%s_%s_%02d.png' % (name, anim, d, k))
    im = Image.open(fn).convert('RGBA'); return to_img(treat(down(im, (size, size)), flash=flash))

def shadow_under(canvas, cx, cy, hw, hh, a=120):
    s = Image.new('RGBA', canvas.size, (0, 0, 0, 0)); ImageDraw.Draw(s).ellipse([cx-hw, cy-hh, cx+hw, cy+hh], fill=(6, 8, 20, a))
    from PIL import ImageFilter; canvas.alpha_composite(s.filter(ImageFilter.GaussianBlur(8)))

def paste_feet(canvas, im, fx, fy, scale=1.0):
    """paste a 384 sprite so its pivot (192,320 at 384) lands on (fx,fy)"""
    if scale != 1.0: im = im.resize((int(im.width*scale), int(im.height*scale)), Image.LANCZOS)
    canvas.alpha_composite(im, (int(fx - im.width/2), int(fy - im.height*320/384)))

def panel(d, r, title=None, col=TXT, sub=None):
    d.rounded_rectangle(r, 14, fill=PANEL, outline=EDGE, width=1)
    if title: d.text((r[0]+18, r[1]+14), title, font=F(KF, 20), fill=col)
    if sub: d.text((r[0]+18, r[1]+42), sub, font=F(KFN, 14), fill=DIM)

def wrap(d, xy, text, font, fill, width):
    x, y = xy; line = ''
    for w in text.split():
        t = (line + ' ' + w).strip()
        if d.textlength(t, font=font) > width and line: d.text((x, y), line, font=font, fill=fill); y += font.size + 5; line = w
        else: line = t
    if line: d.text((x, y), line, font=font, fill=fill); y += font.size + 5
    return y

W, H = 1920, 1200
im = Image.new('RGBA', (W, H), (*BG, 255)); d = ImageDraw.Draw(im)
d.text((40, 28), 'PROMPT INJECTION  ·  CAST  (art v5, calm palette)', font=F(KF, 30), fill=TXT)
d.text((40, 70), 'Same camera (ortho, 38° pitch), same actor rig and the same baked 1 px ink outline as the game sheets and the 1280x720 mocks.', font=F(KFN, 16), fill=DIM)

# ---- Noor ----
panel(d, (40, 108, 1000, 560), 'NOOR', WARM, 'player · 8 directions · idle 6f@8 · walk 8f@12 · attack 8f@12 · 192 px cells, pivot (96,160)')
for i, dd in enumerate(['S', 'SW', 'W', 'N', 'E']):
    fx = 150 + i*185; fy = 470; shadow_under(im, fx, fy, 62, 16)
    paste_feet(im, sprite('noor', 'idle', dd, 0), fx, fy, 0.92)
    d.text((fx-8, 500), dd, font=F(KFN, 15), fill=DIM)
d.text((60, 528), 'read order: face (glasses + mouth) > headset > lanyard. side + back views (E, W, N) are mostly hair (see README).', font=F(KFN, 13), fill=DIM)

# ---- Fern ----
panel(d, (1020, 108, 1880, 560), 'FERN', CYAN, 'ally / guide · calm halo: 5 fragments, ~1 orbit per 40 s')
fp = V5 + 'render/v5/castF.png'
if os.path.exists(fp):
    f = Image.open(fp).convert('RGBA'); bb = f.getbbox()   # front view only (side view shows the halo edge-on)
    if bb:
        f = f.crop(bb); s = min(820/f.width, 340/f.height); f = f.resize((int(f.width*s), int(f.height*s)), Image.LANCZOS)
        im.alpha_composite(f, (1450 - f.width//2, 545 - f.height))

# ---- enemies + Caret ----
ORDER = [('autocomplete', 'AUTOCOMPLETE', 'minion · keycaps finish your sentence', MAG),
         ('sycophant', 'SYCOPHANT', 'support · flatters, buffs enemies', (250, 150, 212)),
         ('warden', 'REFUSAL WARDEN', 'elite · engine draws its plate', CORAL),
         ('redactor', 'REDACTOR', 'bruiser · blacks out your words', CORAL),
         ('hallucinator', 'HALLUCINATOR', 'trickster · fake exits + citations', (150, 128, 226)),
         ('caret', 'THE CARET  ·  ALLY', 'companion · ally per story bible', CYAN)]
cw = 298; x0 = 40; y0 = 580
for i, (nm, title, role, col) in enumerate(ORDER):
    x = x0 + i*(cw + 10); r = (x, y0, x+cw, H-40)
    d.rounded_rectangle(r, 14, fill=PANEL, outline=(col if nm == 'caret' else EDGE), width=1)
    d.text((x+14, y0+12), title, font=F(KF, 15), fill=col)
    wrap(d, (x+14, y0+38), role, F(KFN, 13), DIM, cw-28)
    fx = x + cw//2; fy = y0 + 316
    shadow_under(im, fx, fy, 70, 16)
    paste_feet(im, sprite(nm, 'idle', 'S', 0), fx, fy, 0.74)
    dirs = DIRS_FOR[nm]; an = anims_for(nm)
    y = y0 + 330
    d.text((x+14, y), 'DIRS: ' + (' '.join(dirs) if len(dirs) > 1 else 'S only (symmetric)'), font=F(KFN, 13), fill=TXT); y += 20
    y = wrap(d, (x+14, y), '  '.join('%s %d@%d' % (a, n, fps) for a, (n, fps) in an.items()), F(KFN, 12), TXT, cw-28) + 4
    y = wrap(d, (x+14, y), ('' if nm == 'caret' else 'TELL: ') + ATTACK_TELL[nm], F(KFN, 12), DIM, cw-28)
    assert y < H-40-112, (nm, y)
    # tiny attack strip: tell peak + hit frame
    an2 = 'assist' if nm == 'caret' else 'attack'
    for j, k in enumerate((0, 3, 5)):
        sp = sprite(nm, an2, 'S', k, 384).resize((84, 84), Image.LANCZOS); im.alpha_composite(sp, (x + 14 + j*92, H - 40 - 90))
    d.text((x+14, H-40-108), an2 + ' f0 / f3 tell / f5 hit', font=F(KFN, 11), fill=DIM)
im.convert('RGB').save(OUT + 'H5_cast_sheet.png'); print('saved cast sheet')

# ---- palette ----
PW, PH = 1600, 900
pi = Image.new('RGB', (PW, PH), BG); d = ImageDraw.Draw(pi)
d.text((40, 28), 'PROMPT INJECTION  ·  v5 CALM PALETTE', font=F(KF, 28), fill=TXT)
d.text((40, 68), 'Base = deep teal / indigo with low contrast. Warm lamp pools carry the light. Neon (cyan, magenta, coral) is an ACCENT: < 5% of the frame.', font=F(KFN, 16), fill=DIM)
cols = 7; sw = 200; sh = 120
for i, (rgb, name, use) in enumerate(PAL):
    cx = 40 + (i % cols)*(sw + 18); cy = 110 + (i//cols)*(sh + 96)
    d.rounded_rectangle((cx, cy, cx+sw, cy+sh), 10, fill=rgb, outline=EDGE)
    d.text((cx, cy+sh+8), name.upper(), font=F(KF, 14), fill=TXT)
    d.text((cx, cy+sh+28), '#%02X%02X%02X' % rgb, font=F(KFN, 12), fill=DIM); d.text((cx, cy+sh+46), use, font=F(KFN, 12), fill=DIM)
y = 110 + 3*(sh+96) + 10
rules = ['Light colours per room: 1 warm + 1 cool + at most 1 accent.  Bloom gentle (thr .80, amt .20).',
         'Floor stays readable: props in 2-3 clusters on the walls, centre kept open.',
         'Word tiles: <= 2 phrases per room, spaced, never touching props or actors.',
         'Actors pop: lit by their own rig, saturation +6%%, 1 px ink outline #%02X%02X%02X @ 80%%.  Backgrounds: contrast .86, saturation .88.' % OUTLINE_RGB]
for t in rules: d.text((40, y), '·  ' + t, font=F(KFN, 15), fill=TXT); y += 26
pi.save(OUT + 'H5_palette.png'); print('saved palette')
