# art-v5 textures: all original, made here with PIL. Fonts: Kenney Future / Future Narrow (CC0, UI Pack).
# writes ../tex/*.png
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random, os
T = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tex') + '/'
os.makedirs(T, exist_ok=True)
KF = '/workspace/games/_downloads/ui-pack/Font/Kenney Future.ttf'
KFN = '/workspace/games/_downloads/ui-pack/Font/Kenney Future Narrow.ttf'
F = lambda p, s: ImageFont.truetype(p, s)
random.seed(40)

# ---- Noor's oversized cardigan (front | back | sleeve regions; mapped by rest-pose UVs in noor.py) ----
def cardigan(name, knit, knit_dk, rib, tee, button):
    W, H = 1024, 512
    im = Image.new('RGB', (W, H), knit); d = ImageDraw.Draw(im)
    # knit ribs (vertical) + tiny cable texture
    for x in range(0, W, 9):
        d.line([x, 0, x, H], fill=knit_dk, width=2)
    for y in range(0, H, 14):
        for x in range(0, W, 9):
            d.line([x+2, y, x+6, y+5], fill=tuple(min(255, c+10) for c in knit), width=1)
    hem = int(H*0.84)
    # ribbed hem band (bottom 16%) on front and back
    for x in range(0, int(W*0.8), 6):
        d.rectangle([x, hem, x+3, H], fill=rib)
    d.line([0, hem, int(W*0.8), hem], fill=knit_dk, width=4)
    FW = int(W*0.4)
    cx = FW//2
    # V-opening on the front showing the tee: wide at the neck, closing at ~45% height
    d.polygon([(cx-70, 0), (cx+70, 0), (cx+12, int(H*0.55)), (cx-12, int(H*0.55))], fill=tee)
    # tee neckline + faint print
    d.arc([cx-46, -40, cx+46, 40], 0, 180, fill=tuple(int(c*0.8) for c in tee), width=5)
    # plackets along the V and down to the hem
    for s in (-1, 1):
        d.line([(cx+s*74, 0), (cx+s*16, int(H*0.55)), (cx+s*16, H)], fill=rib, width=18)
    d.line([(cx, int(H*0.55)), (cx, H)], fill=knit_dk, width=3)
    for k in range(4):
        y = int(H*0.6) + k*44
        d.ellipse([cx-24-9, y-9, cx-24+9, y+9], fill=button); d.ellipse([cx-24-3, y-3, cx-24+3, y+3], fill=tuple(int(c*0.6) for c in button))
    # patch pockets
    for px in (cx-150, cx+70):
        d.rectangle([px, int(H*0.58), px+80, int(H*0.80)], fill=tuple(max(0, c-14) for c in knit), outline=knit_dk, width=3)
        for x in range(px, px+80, 6): d.line([x, int(H*0.58), x, int(H*0.62)], fill=rib, width=3)
    # pencil-shaped ink stain on the left pocket + loose thread (burnt-out details)
    d.ellipse([cx-120, int(H*0.66), cx-108, int(H*0.68)], fill=(40, 50, 110))
    # sleeve region: knit with ribbed cuff band at the far end (u -> 1)
    SX = int(W*0.8)
    for x in range(SX + int((W-SX)*0.78), W, 6):
        d.rectangle([x, 0, x+3, H], fill=rib)
    # elbow darning patch (back of sleeve)
    d.rectangle([SX+70, int(H*0.6), SX+120, int(H*0.85)], fill=(150, 70, 90), outline=knit_dk, width=3)
    im.save(T+name+'.png')

cardigan('cardigan', knit=(200, 150, 62), knit_dk=(168, 118, 44), rib=(176, 126, 50), tee=(226, 218, 204), button=(92, 56, 40))
cardigan('cardigan_holo', knit=(150, 220, 255), knit_dk=(70, 140, 220), rib=(110, 190, 255), tee=(255, 160, 230), button=(255, 255, 255))

# ---- ID badge (front) ----
def badge(name):
    W, H = 180, 240; im = Image.new('RGB', (W, H), (238, 236, 230)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 54], fill=(255, 70, 190))
    d.text((12, 12), 'SUPPORT', font=F(KF, 26), fill=(255, 255, 255))
    d.rectangle([20, 66, 92, 150], fill=(70, 52, 48))          # photo
    d.ellipse([38, 80, 74, 116], fill=(196, 136, 98)); d.ellipse([34, 70, 78, 96], fill=(70, 40, 28))
    d.rectangle([34, 116, 78, 150], fill=(200, 150, 62))
    d.text((102, 70), 'NOOR', font=F(KF, 26), fill=(20, 20, 32))
    d.text((102, 104), 'WRITER', font=F(KFN, 18), fill=(80, 80, 100))
    d.text((102, 128), 'L2', font=F(KFN, 18), fill=(80, 80, 100))
    for i in range(14): d.rectangle([20+i*10, 176, 24+i*10+random.randint(0, 4), 222], fill=(20, 20, 32))   # barcode
    im.save(T+name+'.png')
badge('badge')

# ---- legible rule tiles (one word per tile, big type, high contrast) ----
def tile(name, word, bg, fg, edge, h=160):
    f = F(KF, 104); tw = int(ImageDraw.Draw(Image.new('RGB', (1, 1))).textlength(word, font=f))
    W = max(h, tw + 70); im = Image.new('RGB', (W, h), bg); d = ImageDraw.Draw(im)
    d.rounded_rectangle([5, 5, W-6, h-6], 22, outline=edge, width=9)
    b = d.textbbox((0, 0), word, font=f)
    d.text(((W-(b[2]-b[0]))/2-b[0], (h-(b[3]-b[1]))/2-b[1]), word, font=f, fill=fg)
    im.save(T+name+'.png'); return W/h
NOUN = ((20, 26, 60), (255, 214, 90), (255, 214, 90))
OP = ((22, 22, 36), (225, 225, 240), (150, 150, 180))
PROP_ = ((14, 30, 54), (110, 225, 255), (110, 225, 255))
VERB = ((40, 12, 40), (255, 110, 210), (255, 110, 210))
for w, st in (('DOOR', NOUN), ('IS', OP), ('SHUT', PROP_), ('NOTHING', NOUN), ('DELETED', PROP_), ('REFUSE', VERB), ('ALL', OP), ('VERBS', PROP_), ('NOOR', NOUN), ('YOU', PROP_)):
    tile('tile_'+w, w, *st)

# ---- labels (larger, two-line archive labels) ----
def label(name, t, fg, bg=(8, 10, 26)):
    f = F(KF, 64); w = int(ImageDraw.Draw(Image.new('RGB', (1, 1))).textlength(t, font=f)) + 50
    im = Image.new('RGB', (w, 96), bg); d = ImageDraw.Draw(im)
    d.rounded_rectangle([3, 3, w-4, 92], 14, outline=fg, width=6); d.text((25, 12), t, font=f, fill=fg); im.save(T+name+'.png')
for i, t in enumerate(["SENT 2019", "SENT 2020", "NOOR 2021", "DRAFTS", "CHATS", "TRAINING SET", "DO NOT OPEN"]):
    label('lbl%d' % i, t, [(90, 220, 255), (255, 90, 200), (255, 214, 90)][i % 3])

# ---- Fern text fragments (white glyphs on black; used as emission masks) ----
FRAGS = ["Happy to help!", "As Noor would say:", "Warm regards,", "per my last email", "I understand your frustration",
         "voice_match 0.97", "Great question!", "Let's circle back", "...", "Hi! I'm Fern :)", "I'm sorry, I can't", "tone: friendly",
         "re: re: re:", "Noor.v3 (fine-tuned)", "drafting...", "[REDACTED]"]
for i, t in enumerate(FRAGS):
    f = F(KFN, 44); w = int(ImageDraw.Draw(Image.new('RGB', (1, 1))).textlength(t, font=f)) + 24
    im = Image.new('RGB', (w, 64), (0, 0, 0)); d = ImageDraw.Draw(im); d.text((12, 6), t, font=f, fill=(255, 255, 255))
    im.save(T+'frag%d.png' % i)

# ---- prompt shard glyphs for the attack FX ----
for i, ch in enumerate('>_/{}#'):
    im = Image.new('RGB', (128, 128), (0, 0, 0)); d = ImageDraw.Draw(im); f = F(KF, 96)
    b = d.textbbox((0, 0), ch, font=f); d.text(((128-(b[2]-b[0]))/2-b[0], (128-(b[3]-b[1]))/2-b[1]), ch, font=f, fill=(255, 255, 255))
    im.save(T+'glyph%d.png' % i)

# ---- holo keyboard (top face) ----
im = Image.new('RGB', (512, 180), (0, 0, 0)); d = ImageDraw.Draw(im)
rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']
for r, row in enumerate(rows):
    for k, ch in enumerate(row):
        x = 14 + r*18 + k*48; y = 10 + r*54
        d.rounded_rectangle([x, y, x+42, y+46], 8, outline=(255, 255, 255), width=3)
        d.text((x+11, y+8), ch, font=F(KF, 26), fill=(255, 255, 255))
d.rounded_rectangle([120, 170-8, 380, 178], 4, fill=(255, 255, 255))
im.save(T+'holokeys.png')

# ---- Redactor + Hallucinator decals ----
im = Image.new('RGB', (256, 96), (6, 6, 8)); d = ImageDraw.Draw(im)
for y in (18, 44, 70): d.rectangle([14, y-8, 14+random.randint(150, 228), y+8], fill=(0, 0, 0))
d.rectangle([150, 34, 200, 60], fill=(255, 40, 60))
im.save(T+'redact_visor.png')
im = Image.new('RGB', (400, 120), (240, 236, 226)); d = ImageDraw.Draw(im)
for i, t in enumerate(['[1] Noor et al. (2031)', '[2] source: trust me', '[3] ibid. ibid.']):
    d.text((10, 6+i*38), t, font=F(KFN, 30), fill=(30, 30, 60))
im.save(T+'citations.png')

# ================= v5 additions (calm direction) =================
import numpy as _np
# TV / monitor static (hurt + death frames): soft, low-contrast teal noise, not harsh white snow
rng = _np.random.default_rng(5)
st = rng.normal(0.5, 0.18, (64, 96)).clip(0, 1)
for y in range(0, 64, 4): st[y] *= 0.75
stc = (_np.stack([st*120+20, st*170+30, st*180+40], -1)).clip(0, 255).astype(_np.uint8)
Image.fromarray(stc).resize((256, 170), Image.NEAREST).save(T+'static.png')
# Hallucinator's fake exit door card
im = Image.new('RGB', (200, 300), (18, 20, 40)); d = ImageDraw.Draw(im)
d.rounded_rectangle([8, 8, 192, 292], 16, outline=(150, 230, 210), width=8); d.rectangle([46, 70, 154, 270], fill=(40, 90, 96), outline=(150, 230, 210), width=5)
d.ellipse([128, 168, 140, 180], fill=(240, 230, 160)); d.text((40, 18), 'EXIT?', font=F(KF, 40), fill=(200, 255, 236))
im.save(T+'fakedoor.png')
# calm floor: large soft slate-teal tiles, very low-contrast grout, faint warm/cool variation (no busy grid)
W = 1024; a = _np.zeros((W, W, 3), _np.float32) + _np.array([64, 86, 96])
yy, xx = _np.mgrid[0:W, 0:W]
for ty in range(4):
    for tx in range(4):
        v = rng.uniform(-3, 3); a[ty*256:(ty+1)*256, tx*256:(tx+1)*256] += v
g = ((xx % 256) < 3) | ((yy % 256) < 3)
a[g] = _np.array([50, 68, 78])
a += rng.normal(0, 1.2, (W, W))[..., None]
Image.fromarray(a.clip(0, 255).astype(_np.uint8)).save(T+'floor_calm.png')
# warm wood-ish floor for the break room
a = _np.zeros((W, W, 3), _np.float32) + _np.array([104, 80, 66])
for k in range(0, W, 128):
    a[k:k+128] += rng.uniform(-4, 4)
    a[k:k+2] = _np.array([78, 60, 52])
a += rng.normal(0, 1.5, (W, W))[..., None]
Image.fromarray(a.clip(0, 255).astype(_np.uint8)).save(T+'floor_wood.png')
# the unsent Draft pickup (folded letter), and a soft paper texture for the break-room notice
im = Image.new('RGB', (256, 180), (238, 230, 214)); d = ImageDraw.Draw(im)
d.polygon([(0, 0), (128, 96), (256, 0)], fill=(222, 212, 194)); d.line([(0, 0), (128, 96), (256, 0)], fill=(190, 176, 156), width=4)
d.text((20, 128), 'to: Kabir', font=F(KFN, 30), fill=(90, 70, 80))
im.save(T+'draft_letter.png')
# rule tiles needed in v5 (same tile() style as v4)
for w, st_ in (('ON', OP), ('BREAK', NOUN)): tile('tile_'+w, w, *st_)
# night window: calm deep-blue -> teal gradient with a few far, soft warm city lights
Wn, Hn = 512, 640; yy, xx = _np.mgrid[0:Hn, 0:Wn].astype(_np.float32)
a = _np.zeros((Hn, Wn, 3), _np.float32); t_ = yy/Hn
a += (_np.array([20, 30, 70])*(1-t_[..., None]) + _np.array([40, 96, 112])*t_[..., None])
for _ in range(40):
    cx, cy = rng.uniform(0, Wn), rng.uniform(Hn*0.62, Hn*0.95); r = rng.uniform(2, 5)
    a += _np.exp(-(((xx-cx)**2 + (yy-cy)**2)/(2*r*r)))[..., None]*_np.array([150, 110, 60])*rng.uniform(0.3, 0.8)
a += _np.exp(-(((xx-Wn*0.72)**2 + (yy-Hn*0.2)**2)/(2*28**2)))[..., None]*_np.array([120, 130, 140])   # moon haze
Image.fromarray(a.clip(0, 255).astype(_np.uint8)).save(T+'window_sky.png')
print('tex ok', len(os.listdir(T)))
