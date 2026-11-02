# art-v5 CALM compositing for the room mocks. usage: python3 post5.py room2|room1|room3 [RENDER_DIR]
# v5 removes v4's dust motes, code particles, foreground bokeh, light shafts, magenta far band, chromatic fringe,
# glowing UI panels and minimap. What stays: gentle depth haze, gentle bloom, soft vignette, light grain.
# Hierarchy: background is calmed (lower contrast + saturation), actors keep their sprite-rig look and get the
# SAME 1 px soft outline + blob contact shadow that pack5.py bakes into the sprite sheets.
# It also runs an overlap QA: word tiles vs props, UI/bubbles vs actors and tiles (prints and fails loudly).
import sys, glob, os, math, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from post import bloom, vignette
from pack5 import OUTLINE_RGB, OUTLINE_A
V5 = os.path.join(HERE, '..') + '/'
KF = '/workspace/games/_downloads/ui-pack/Font/Kenney Future.ttf'; KFN = '/workspace/games/_downloads/ui-pack/Font/Kenney Future Narrow.ttf'
def F(p, s): return ImageFont.truetype(p, s)
MODE = sys.argv[1] if len(sys.argv) > 1 else 'room2'; RD = sys.argv[2] if len(sys.argv) > 2 else V5+'render/v5/'
NAME = {'room1': 'floor1_archive', 'room2': 'floor2_openplan', 'room3': 'floor2_breakroom_explore'}[MODE]
ACTOR_IDX = (1, 2, 3, 4, 6, 8, 9, 12); TILE_IDX = (10, 11)
SH = {'noor': (40, 11, 0.42), 'caret': (18, 5, 0.25), 'autocomplete': (40, 10, 0.25), 'hallucinator': (34, 9, 0.25),
      'sycophant': (38, 11, 0.40), 'warden': (60, 16, 0.45), 'redactor': (46, 13, 0.42)}

img = Image.open(RD+MODE+'.png').convert('RGB'); W, H = img.size
lt = lambda pat: max(glob.glob(pat), key=os.path.getmtime)
mist = np.asarray(Image.open(lt(RD+MODE+'_mist_*.png'))).astype(np.float32); mist /= max(mist.max(), 1)
idx = np.asarray(Image.open(lt(RD+MODE+'_index_*.png'))).astype(np.float32); idx = np.round(idx/(65535.0 if idx.max() > 255 else 255.0)*255).astype(np.int32)
side = json.load(open(RD+MODE+'_actors.json')); CT = side['cam_target']

def proj(p, tgt=(CT[0], CT[1], 0.5), ortho=8.4, pitch=38, yaw=-30):
    t = math.radians(90-pitch); yw = math.radians(-yaw)
    Rx = np.array([[1, 0, 0], [0, math.cos(t), -math.sin(t)], [0, math.sin(t), math.cos(t)]])
    Rz = np.array([[math.cos(yw), -math.sin(yw), 0], [math.sin(yw), math.cos(yw), 0], [0, 0, 1]])
    Rm = Rz @ Rx; right = Rm @ np.array([1, 0, 0]); up = Rm @ np.array([0, 1, 0]); d = np.array(p, float) - np.array(tgt)
    return (W/2 + d.dot(right)/ortho*W, H/2 - d.dot(up)/ortho*W)
def blur(m, r): return np.asarray(Image.fromarray((np.clip(m, 0, 1)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32)/255
def dilate(m, n): return np.asarray(Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(n))) > 127

a = np.asarray(img).astype(np.float32)/255
actor = np.isin(idx, ACTOR_IDX); am = actor.astype(np.float32); bgm = (1 - am)[..., None]
# 1) calm the background: lower contrast + saturation, lift blacks towards deep teal
lum = a.mean(2, keepdims=True); m0 = float(lum[~actor].mean())
b = m0 + (a - m0)*0.86; g = b.mean(2, keepdims=True); b = g + (b - g)*0.88; b = b*0.95 + np.array([0.020, 0.034, 0.044])
a = a*(1-bgm) + b*bgm
# 2) gentle depth haze (deep teal-indigo), background only
ref = float(mist[idx == 1].mean()) if (idx == 1).any() else 0.5
f = np.clip((mist - ref)*1.3 + 0.04, 0, 0.20)[..., None]*bgm
a = a*(1-f) + np.array([0.06, 0.10, 0.14])*f
# 3) contact blob shadows under actors (same blob the sprites bake)
shm = Image.new('L', (W, H), 0); ds = ImageDraw.Draw(shm)
for ac in side['actors']:
    if ac['name'] not in SH: continue
    hw, hh, al = SH[ac['name']]; x, y = proj((ac['x'], ac['y'], 0))
    ds.ellipse([x-hw, y-hh, x+hw, y+hh], fill=int(255*al))
shm = np.asarray(shm.filter(ImageFilter.GaussianBlur(5))).astype(np.float32)[..., None]/255*bgm
a = a*(1-shm) + np.array([6, 8, 20])/255*shm
# 4) separation: very soft darkening of the set right around actors (no coloured halos)
near = np.clip(blur(am, 9)*1.6, 0, 1)*(1-am)
a = a*(1 - 0.16*near[..., None])
# 5) actors: a touch more saturation (they pop, the set recedes)
g = a.mean(2, keepdims=True); a = np.where(actor[..., None], g + (a-g)*1.06, a)
im = Image.fromarray((np.clip(a, 0, 1)*255).astype(np.uint8))
# 6) gentle bloom
im = bloom(im, thr=0.80, radius=10, amt=0.20)
a = np.asarray(im).astype(np.float32)/255
# 7) the SAME 1 px soft outline the sprite sheets bake (Fern = hologram, no outline)
hard = actor
ring = (dilate(hard.astype(np.float32), 3) & ~hard).astype(np.float32)
ring = np.clip(blur(ring, 0.5)*1.2, 0, 1)*OUTLINE_A*(~hard)
a = a*(1-ring[..., None]) + np.array(OUTLINE_RGB)/255*ring[..., None]
im = Image.fromarray((np.clip(a, 0, 1)*255).astype(np.uint8))
im = vignette(im, 0.32, (4, 10, 16))
arr = np.asarray(im).astype(np.float32) + np.random.default_rng(1).normal(0, 1.1, (H, W))[..., None]
im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

# ---------------- minimal, quiet HUD ----------------
UI_RECTS = []
def hud(im):
    ui = ImageDraw.Draw(im, 'RGBA'); f16 = F(KFN, 16); f14 = F(KFN, 14); f18 = F(KF, 17); f13 = F(KFN, 13)
    TXT = (196, 216, 222, 230); DIM = (120, 146, 156, 200); WARM = (240, 196, 128, 255)
    title = {'room1': 'FLOOR 1  ·  THE ARCHIVE', 'room2': 'FLOOR 2  ·  OPEN PLAN', 'room3': 'FLOOR 2  ·  BREAK ROOM'}[MODE]
    ui.text((30, 24), title, font=f16, fill=TXT); UI_RECTS.append((24, 18, max(196, 30 + ui.textlength(title, font=f16) + 6), 66))
    for i in range(4):   # Noor's resolve (HP): 3 of 4
        x0 = 31 + i*17; ui.rounded_rectangle([x0, 52, x0+11, 61], 3, fill=WARM if i < 3 else (54, 70, 80, 220))
    ui.text((112, 49), 'DRAFTS 3/7', font=f13, fill=DIM)
    if MODE == 'room3':   # exploration: no sentence bar, just a soft Caret subtitle
        t1, t2 = 'CARET', '...you started this sentence in 2021.'
        w = ui.textlength(t1, font=f14) + 14 + ui.textlength(t2, font=f16); x = (W - w)/2; y = H - 52
        ui.rounded_rectangle([x-18, y-10, x+w+18, y+26], 12, fill=(8, 16, 22, 150))
        ui.text((x, y), t1, font=f14, fill=(150, 220, 228, 230)); ui.text((x + ui.textlength(t1, font=f14) + 14, y-2), t2, font=f16, fill=TXT)
        UI_RECTS.append((x-18, y-10, x+w+18, y+26)); return im
    chips = {'room2': (('STOP', (104, 136, 196)), ('ALL', (206, 176, 104)), ('QUIETLY', (146, 124, 194))),
             'room1': (('FORGET', (104, 136, 196)), ('THAT', (206, 176, 104)), ('DRAFT', (146, 124, 194)))}[MODE]
    hand = {'room2': ('PULL', 'THEM', 'TWICE'), 'room1': ('EVERY', 'KEEP', 'ONCE')}[MODE]
    ws = [ui.textlength(t, font=f18) + 26 for t, _ in chips]; hw_ = [ui.textlength(t, font=f13) + 16 for t in hand]
    send = ui.textlength('SEND', font=f18) + 28
    inner = sum(ws) + 8*(len(ws)-1) + 14 + send + 26 + sum(hw_) + 6*(len(hw_)-1)
    x0 = (W - inner)/2 - 16; y0 = H - 66; x1 = x0 + inner + 32; y1 = H - 20
    ui.rounded_rectangle([x0, y0, x1, y1], 14, fill=(8, 16, 22, 165), outline=(70, 100, 110, 120), width=1); UI_RECTS.append((x0, y0, x1, y1))
    x = x0 + 16
    for (t, c), w in zip(chips, ws):
        ui.rounded_rectangle([x, y0+9, x+w, y1-9], 9, fill=(*c, 235)); ui.text((x+13, y0+13), t, font=f18, fill=(12, 16, 26)); x += w + 8
    x += 6
    ui.rounded_rectangle([x, y0+9, x+send, y1-9], 9, outline=(120, 206, 214, 230), width=2); ui.text((x+14, y0+13), 'SEND', font=f18, fill=(150, 226, 232)); x += send + 14
    ui.line([x, y0+12, x, y1-12], fill=(70, 100, 110, 140), width=1); x += 12
    for t, w in zip(hand, hw_):
        ui.rounded_rectangle([x, y0+13, x+w, y1-13], 7, fill=(40, 56, 66, 220)); ui.text((x+8, y0+16), t, font=f13, fill=(186, 204, 212)); x += w + 6
    return im

def bubble(im, anchor, t, edge, dx, dy):
    ui = ImageDraw.Draw(im, 'RGBA'); f = F(KFN, 15); tw = ui.textlength(t, font=f); ax, ay = anchor
    x, y = int(ax + dx), int(ay + dy); x = max(12, min(W - tw - 36, x))
    r = (x, y, x+tw+24, y+32)
    ui.rounded_rectangle(r, 10, fill=(8, 16, 22, 200), outline=(*edge, 170), width=1)
    tx = min(max(ax, x+16), x+tw+8); ui.polygon([(tx-6, y+32), (tx+6, y+32), (ax, ay)], fill=(8, 16, 22, 200))
    ui.text((x+12, y+7), t, font=f, fill=(214, 226, 230)); UI_RECTS.append(r); return r

im = hud(im)
if MODE == 'room2':
    bubble(im, proj((1.15, 2.15, 1.62)), "I can't help with that.", (232, 120, 128), dx=-110, dy=-46)
elif MODE == 'room1':
    bubble(im, proj((1.75, 2.85, 1.65)), 'Every draft you deleted is still here.', (130, 210, 226), dx=-430, dy=-96)

# ---------------- overlap QA ----------------
probs = []
tiles = np.isin(idx, TILE_IDX)
props = (idx == 0) & (mist < 0.999)            # set dressing (env/floor/walls are index 15)
if tiles.any():
    near_t = dilate(tiles.astype(np.float32), 9)   # 4 px clearance
    n = int((near_t & props).sum()); probs.append(('tiles touching props (px)', n))
    n2 = int((near_t & actor).sum()); probs.append(('tiles touching actors (px)', n2))
fern = (idx == 7)
for (x0, y0, x1, y1) in UI_RECTS:
    sub = (slice(max(0, int(y0)-4), min(H, int(y1)+4)), slice(max(0, int(x0)-4), min(W, int(x1)+4)))
    probs.append(('UI rect %d,%d over actors (px)' % (x0, y0), int(actor[sub].sum())))
    probs.append(('UI rect %d,%d over tiles (px)' % (x0, y0), int(tiles[sub].sum())))
    probs.append(('UI rect %d,%d over Fern (px)' % (x0, y0), int(fern[sub].sum())))
for i, r in enumerate(UI_RECTS):
    for r2 in UI_RECTS[i+1:]:
        if not (r[2] < r2[0] or r2[2] < r[0] or r[3] < r2[1] or r2[3] < r[1]): probs.append(('UI rects overlap', 1))
bad = [p for p in probs if p[1] > 0]
print('QA', MODE, 'OK' if not bad else 'PROBLEMS', bad)
os.makedirs(V5+'out', exist_ok=True)
im.save(V5+'out/H5_%s_1280x720.png' % NAME); print('saved', NAME)
json.dump(dict(checks=probs), open(RD+MODE+'_qa.json', 'w'), indent=1)
