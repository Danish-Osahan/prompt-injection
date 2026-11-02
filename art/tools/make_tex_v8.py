"""art-v8 textures for the 'linger' layer (original, made here; JetBrains Mono / IBM Plex Mono are OFL).
usage: python3 make_tex_v8.py   -> ../tex/*.png"""
import os, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter
H = os.path.dirname(os.path.abspath(__file__)); TX = H + '/../tex/'; FD = H + '/../../game/public/assets/fonts/'
os.makedirs(TX, exist_ok=True)
def F(sz, w=700, plex=False):
    f = ImageFont.truetype(FD + ('IBMPlexMono-Medium.ttf' if plex else 'JetBrainsMono[wght].ttf'), sz)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
PAPER = (226, 220, 204); INK = (40, 44, 60)
# wall calendar stuck on August (one date circled)
im = Image.new('RGB', (256, 320), (214, 208, 196)); d = ImageDraw.Draw(im)
d.rectangle([0, 0, 255, 70], fill=(150, 64, 58)); d.text((128, 36), 'AUGUST', font=F(40), fill=(240, 230, 220), anchor='mm')
for r in range(5):
    for c in range(7):
        x, y = 18 + c*33, 92 + r*44; d.rectangle([x, y, x + 28, y + 36], outline=(150, 146, 138))
        n = r*7 + c - 2
        if 1 <= n <= 31: d.text((x + 4, y + 2), str(n), font=F(13, 500), fill=(90, 88, 84))
d.ellipse([18 + 4*33 - 4, 92 + 2*44 - 4, 18 + 4*33 + 32, 92 + 2*44 + 40], outline=(180, 40, 40), width=3)
im.save(TX + 'calendar_aug.png')
# phone lock screen: 37 unread
im = Image.new('RGB', (128, 256), (8, 14, 22)); d = ImageDraw.Draw(im)
d.text((64, 60), '11:48', font=F(30, 400), fill=(200, 220, 235), anchor='mm')
d.rounded_rectangle([14, 120, 114, 170], 10, fill=(30, 48, 66)); d.text((64, 145), '37 unread', font=F(16, 600), fill=(230, 240, 245), anchor='mm')
d.rounded_rectangle([14, 178, 114, 206], 8, fill=(22, 36, 50)); d.text((64, 192), 'papa', font=F(13, 500), fill=(170, 190, 205), anchor='mm')
im.save(TX + 'phone_37.png')
# sticky note: CALL + a crossed-out name
im = Image.new('RGB', (128, 128), (240, 214, 96)); d = ImageDraw.Draw(im)
d.text((64, 38), 'call', font=F(30, 500, True), fill=INK, anchor='mm'); d.text((64, 82), 'kabir', font=F(26, 500, True), fill=INK, anchor='mm')
d.line([18, 84, 110, 78], fill=(30, 34, 50), width=5); d.line([20, 76, 108, 88], fill=(30, 34, 50), width=4)
im.save(TX + 'sticky_call.png')
# Fern's sticky stack: good morning
im = Image.new('RGB', (128, 128), (236, 170, 214)); d = ImageDraw.Draw(im)
d.text((64, 46), 'good', font=F(28, 500, True), fill=(70, 30, 70), anchor='mm'); d.text((64, 84), 'morning', font=F(24, 500, True), fill=(70, 30, 70), anchor='mm')
im.save(TX + 'sticky_gm.png')
# lost line: a torn paper strip with a handwriting scribble (not legible at game scale, on purpose)
im = Image.new('RGBA', (256, 64), (0, 0, 0, 0)); d = ImageDraw.Draw(im); rnd = random.Random(3)
pts = [(0, 8)] + [(x, 4 + rnd.randint(0, 6)) for x in range(16, 256, 16)] + [(255, 58)] + [(x, 54 + rnd.randint(0, 8)) for x in range(240, 0, -16)]
d.polygon(pts, fill=(236, 228, 208, 255))
x = 18
while x < 230:
    w = rnd.randint(10, 28); d.arc([x, 22, x + w, 42], 200, 340, fill=(46, 52, 84, 255), width=3); x += w + rnd.randint(4, 9)
im.save(TX + 'lostline.png')
# memo (archive toy)
im = Image.new('RGB', (128, 160), PAPER); d = ImageDraw.Draw(im)
d.text((12, 12), 'MEMO', font=F(20), fill=INK)
for k in range(8): d.line([12, 46 + k*13, 116 - (k % 3)*14, 46 + k*13], fill=(120, 120, 130), width=3)
im.save(TX + 'memo.png')
# Kabir's screensaver: a slow fern leaf drifting across a dark screen (12 frames, ping-free loop)
def leaf(d, cx, cy, s, col):
    d.line([cx, cy + 30*s, cx, cy - 30*s], fill=col, width=max(1, int(3*s)))
    for k in range(6):
        y = cy - 24*s + k*10*s; L = (16 - k*1.6)*s
        d.line([cx, y, cx - L, y - 8*s], fill=col, width=max(1, int(3*s))); d.line([cx, y, cx + L, y - 8*s], fill=col, width=max(1, int(3*s)))
for k in range(12):
    im = Image.new('RGB', (256, 160), (6, 12, 20)); d = ImageDraw.Draw(im)
    t = k/12; cx = 128 + 70*math.sin(t*2*math.pi); cy = 80 + 26*math.sin(t*4*math.pi)
    g = Image.new('RGB', (256, 160), (0, 0, 0)); gd = ImageDraw.Draw(g); leaf(gd, cx, cy, 1.2, (60, 160, 120)); g = g.filter(ImageFilter.GaussianBlur(5))
    im = Image.fromarray(__import__('numpy').clip(__import__('numpy').asarray(im).astype(int) + __import__('numpy').asarray(g), 0, 255).astype('uint8')); d = ImageDraw.Draw(im)
    leaf(d, cx, cy, 1.2, (122, 208, 138)); d.text((128, 148), 'ferngate', font=F(11, 500), fill=(40, 70, 70), anchor='mm')
    im.save(TX + 'saver_%02d.png' % k)
# message room chat wall: a slow light band breathing down the glass (8 frames)
import numpy as np
for k in range(8):
    y = np.linspace(0, 1, 128)[:, None]; c = (k/8)
    band = np.exp(-((y - c)**2)/0.004) + np.exp(-((y - c + 1)**2)/0.004)
    a = 0.08 + 0.9*band; a = np.repeat(a, 256, 1)
    rgb = np.stack([a*40, a*120, a*140], 2); Image.fromarray(np.clip(rgb, 0, 255).astype('uint8')).save(TX + 'chatglow_%02d.png' % k)
print('tex v8 done')
# hub clock face without hands (the hands are real meshes now, animated as an ambient loop)
im = Image.new('RGB', (256, 256), (20, 26, 38)); d = ImageDraw.Draw(im)
d.ellipse([8, 8, 248, 248], fill=(56, 64, 80)); d.ellipse([20, 20, 236, 236], fill=(204, 214, 214))
for k in range(12):
    a = k*math.pi/6; r0, r1 = (88, 106) if k % 3 else (80, 106)
    d.line([128 + math.sin(a)*r0, 128 - math.cos(a)*r0, 128 + math.sin(a)*r1, 128 - math.cos(a)*r1], fill=(28, 34, 48), width=6 if k % 3 == 0 else 4)
d.ellipse([120, 120, 136, 136], fill=(240, 110, 110))
im = im.transpose(Image.FLIP_LEFT_RIGHT); im.save(TX + 'clock_blank.png')
print('clock blank done')
