"""art-v9 office textures (original, PIL; lettering in the shipped OFL fonts): the photo's face side, Noor's monitor DENIED screen.
usage: python3 make_tex_v9.py -> ../tex/photo_up.png, monitor_denied.png"""
import os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter
H = os.path.dirname(os.path.abspath(__file__)); TX = H + '/../tex/'; FD = H + '/../../game/public/assets/fonts/'
def F(sz, w=700):
    f = ImageFont.truetype(FD + 'JetBrainsMono[wght].ttf', sz)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
# the photo, face up: a white border, a dusk sky over a flat sea, two small figures (Noor + Kabir) side by side, slightly faded
W, Hh = 280, 200; im = Image.new('RGB', (W, Hh), (236, 230, 216)); d = ImageDraw.Draw(im); b = 14
for y in range(b, Hh - b):
    t = (y - b)/(Hh - 2*b); top = (64, 74, 120); mid = (232, 150, 110); sea = (40, 60, 86)
    c = [int(top[i] + (mid[i] - top[i])*min(1, t/0.62)) for i in range(3)] if t < 0.62 else [int(sea[i]*(1 - (t - 0.62)*0.4)) for i in range(3)]
    d.line([b, y, W - b, y], fill=tuple(c))
d.ellipse([168, 92, 196, 120], fill=(250, 210, 150))
for k, (x, h) in enumerate(((118, 58), (146, 66))):
    yb = int(b + (Hh - 2*b)*0.62) + 18; d.ellipse([x - 7, yb - h - 14, x + 7, yb - h], fill=(26, 24, 32)); d.rounded_rectangle([x - 10, yb - h, x + 10, yb], 5, fill=(26, 24, 32))
d.line([128, int(b + (Hh - 2*b)*0.62) - 30, 136, int(b + (Hh - 2*b)*0.62) - 32], fill=(26, 24, 32), width=4)   # holding hands
im = im.filter(ImageFilter.GaussianBlur(0.6)); im.save(TX + 'photo_up.png')
# Noor's monitor after code vision tells the truth: a red claim screen
im = Image.new('RGB', (320, 190), (18, 6, 8)); d = ImageDraw.Draw(im)
d.text((160, 44), 'CLAIM #4471', font=F(22, 500), fill=(210, 150, 150), anchor='mm')
d.rounded_rectangle([46, 72, 274, 126], 6, outline=(240, 70, 70), width=4); d.text((160, 99), 'DENIED', font=F(36, 800), fill=(255, 92, 92), anchor='mm')
d.text((160, 152), 'please do not reapply', font=F(14, 400), fill=(150, 100, 100), anchor='mm')
im.save(TX + 'monitor_denied.png'); print('tex v9 ok')
# Kabir's sticky on his monitor: MISS YOU AROUND HERE (the o_kabir lore text), in his hurried caps
im = Image.new('RGB', (160, 160), (238, 210, 92)); d = ImageDraw.Draw(im)
for i, t in enumerate(('MISS YOU', 'AROUND', 'HERE.')): d.text((14 + i*3, 26 + i*36), t, font=F(25, 800), fill=(46, 52, 90))
d.text((104, 132), '- K', font=F(16, 600), fill=(46, 52, 90)); im = im.rotate(-3, resample=Image.BICUBIC, fillcolor=(238, 210, 92)); im.save(TX + 'sticky_kabir.png'); print('sticky ok')
