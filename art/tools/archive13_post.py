"""GB-5 Flooded Archive (archive13): build the room's plate, code view, ambient loops and cast sprites.
 - plate: the art-v7 archive_H_bleed render, de-cluttered (duck, boots, side table, drawer, bench, shelf, towel,
   wall lamp, the red box), graded darker/colder, the pool replaced by one still black-teal sheet (no ripple rings),
   a high window slit with its cold parallelogram on the water, and Dez's desk-lamp spill baked warm. Three lights:
   window (cold, baked), Dez's desk lamp (warm, baked), the Keeper's lamp (moving, drawn by the game).
 - fg overlays (winch, exit, bridge frames) re-graded to match.
 - amb loops: a drip (a falling bead and a short flat glint where it lands, no ring) and a slow water sheen.
 - cast: archive13.py renders (art/render/archive13) copied at 2x (the game shows them at 0.5) with the Keeper's
   stilts fading under the waterline, plus meta -> game/src/archive13art.ts
usage: python3 archive13_post.py"""
import json, os, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageEnhance
H = os.path.dirname(os.path.abspath(__file__)) + '/../'; G = H + '../game/'; A = G + 'public/assets/'
RD = H + 'render/archive13/'; DST = A + 'archive13/'; os.makedirs(DST, exist_ok=True)
W, HH = 1280, 720

def erase(b, r, pad=30, blur=8):
    x0, y0, x1, y1 = r; ring = b.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad)).convert('RGB')
    px = sorted(ring.getdata(), key=lambda c: sum(c)); col = px[len(px) // 2]
    m = Image.new('L', (W, HH), 0); ImageDraw.Draw(m).rectangle(r, fill=255); m = m.filter(ImageFilter.GaussianBlur(blur))
    return Image.composite(Image.new('RGBA', (W, HH), col + (255,)), b.convert('RGBA'), m)

def light(base, poly, color, alpha, blur):
    m = Image.new('L', (W, HH), 0); ImageDraw.Draw(m).polygon(poly, fill=int(255 * alpha)); m = m.filter(ImageFilter.GaussianBlur(blur))
    add = ImageChops.multiply(Image.new('RGB', (W, HH), color), Image.merge('RGB', (m, m, m)))
    return ImageChops.add(base.convert('RGB'), add).convert('RGBA')

def grade(im, warm=False):
    """the room grade: darker, colder (same for plate and overlays). warm=True is the relit room after the trade."""
    rgb = im.convert('RGB'); a = im.split()[-1] if im.mode == 'RGBA' else None
    rgb = ImageEnhance.Brightness(rgb).enhance(0.70 if warm else 0.56)
    rgb = ImageChops.multiply(rgb, Image.new('RGB', rgb.size, (236, 228, 214) if warm else (200, 230, 240)))
    if a is None: return rgb.convert('RGBA')
    out = rgb.convert('RGBA'); out.putalpha(a); return out

POOL = (446, 182, 836, 682)
def plate(warm=False):
    b = Image.open(A + 'rooms/archive_H_bleed.jpg').convert('RGBA')
    # clutter out (1280x720 coords): wall lamp disc, cabinet-top box + trinket, side table, boots, white panel/towel,
    # floor drawer, bench, shelf, the old floor light spot
    for r in [(238, 100, 292, 146), (160, 172, 204, 202), (166, 108, 182, 123), (936, 164, 1014, 226), (870, 224, 930, 280),
              (1160, 300, 1202, 356), (70, 606, 130, 674), (890, 650, 1010, 686), (1143, 566, 1207, 682), (296, 626, 362, 692)]:
        b = erase(b, (r[0] - 10, r[1] - 10, r[2] + 10, r[3] + 10), pad=24, blur=5)
    b = grade(b, warm)
    # the pool: one flat black-teal sheet, a hair lighter toward the window; faint horizontal sheen streaks only
    pw, ph = POOL[2] - POOL[0], POOL[3] - POOL[1]
    g = Image.new('RGBA', (pw, ph)); gd = ImageDraw.Draw(g)
    for yy in range(ph):
        t = yy / ph; gd.line((0, yy, pw, yy), fill=(int(6 + 3 * t), int(15 + 5 * t), int(20 + 5 * t), 255))
    for i, (yy, x0, x1, a) in enumerate([(64, 60, 250, 46), (151, 150, 330, 34), (262, 40, 190, 40), (318, 210, 360, 28), (430, 90, 280, 36)]):
        gd.line((x0, yy, x1, yy), fill=(30, 52, 60, a))
    b.alpha_composite(g, (POOL[0], POOL[1]))
    # pool lips: thin dark stone edge + a cold hairline (straight lines only)
    d = ImageDraw.Draw(b)
    for x in (POOL[0] - 4, POOL[2]):
        d.rectangle((x, POOL[1], x + 3, POOL[3]), fill=(8, 12, 16, 255)); d.line((x + (3 if x > 600 else 0), POOL[1], x + (3 if x > 600 else 0), POOL[3]), fill=(40, 62, 70, 255))
    # light 1: the high window slit on the back wall (cold) and its long parallelogram on the water
    d.rectangle((566, 66, 714, 72), fill=(84, 120, 132, 255)); d.rectangle((566, 73, 714, 75), fill=(24, 36, 44, 255))
    b = light(b, [(566, 182), (714, 182), (792, 560), (632, 560)], (54, 90, 104), 0.14 if warm else 0.24, 26)
    # light 2: Dez's shaded desk lamp (warm, low): a trapezoid on the floor around his desk
    b = light(b, [(262, 318), (402, 318), (430, 448), (236, 456)], (150, 108, 60), 0.46 if warm else 0.32, 24)
    b = light(b, [(322, 276), (390, 276), (398, 318), (314, 322)], (150, 108, 60), 0.22, 12)
    # light 4 (GB-5b): the floor lamp by the exit, a low warm pool on the right-hand floor so the far side is not empty
    b = light(b, [(1090, 372), (1236, 372), (1250, 470), (1070, 474)], (130, 94, 52), 0.40 if warm else 0.30, 22)
    b = light(b, [(1118, 330), (1190, 330), (1204, 376), (1104, 378)], (140, 100, 54), 0.18, 12)
    if warm:   # the Keeper's lamp set down on the water at its feet, and the strip lights over the left floor come on warm
        b = light(b, [(560, 560), (760, 560), (800, 690), (520, 690)], (150, 100, 52), 0.34, 30)
        b = light(b, [(588, 596), (748, 596), (770, 660), (566, 660)], (176, 120, 64), 0.22, 14)
        b = light(b, [(70, 260), (440, 260), (460, 640), (60, 640)], (92, 66, 36), 0.22, 40)
    return b.convert('RGB')

def codeview(g):
    a = np.asarray(g).astype(np.float32) / 255; lum = a.mean(2)
    e = np.asarray(g.convert('L').filter(ImageFilter.FIND_EDGES)).astype(np.float32) / 255
    cy = np.array([0x78, 0xE4, 0xE8], np.float32) / 255
    o = lum[..., None] * np.array([0.10, 0.28, 0.32]) + np.clip(e * 3.2, 0, 1)[..., None] * cy * 0.55
    o[::3] *= 0.78
    return Image.fromarray((np.clip(o, 0, 1) * 255).astype(np.uint8))

def drip_strip():
    # 16 frames, 40x64: a bead falls from the pipe mouth, lands, a short flat glint spreads and fades. No ring.
    n, w, h = 16, 40, 64; s = Image.new('RGBA', (w * n, h))
    for k in range(n):
        f = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(f)
        if k < 7:
            y = 4 + int((k / 6) ** 2 * 46); d.rectangle((19, y, 20, y + 3), fill=(150, 196, 206, 230))
            if k > 2: d.line((19, y - 6, 19, y - 1), fill=(110, 150, 160, 70))
        else:
            t = (k - 7) / (n - 8); half = int(4 + 14 * t); a = int(170 * (1 - t))
            d.line((20 - half, 54, 20 + half, 54), fill=(120, 170, 182, a)); d.line((20 - half // 2, 56, 20 + half // 2, 56), fill=(80, 120, 130, a // 2))
        s.alpha_composite(f, (k * w, 0))
    return s, dict(w=w, h=h, frames=n)

def sheen_strip():
    # 12 frames, 300x150: three faint horizontal glints that slide a few px and breathe (still water)
    n, w, h = 12, 300, 150; s = Image.new('RGBA', (w * n, h))
    rows = [(20, 30, 150), (70, 90, 220), (122, 40, 120)]
    for k in range(n):
        f = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(f); ph = k / n * 2 * np.pi
        for i, (y, x, L) in enumerate(rows):
            a = int(34 + 26 * np.sin(ph + i * 2.1)); dx = int(6 * np.sin(ph + i))
            d.line((x + dx, y, x + dx + L, y), fill=(120, 168, 180, max(0, a)))
        s.alpha_composite(f, (k * w, 0))
    return s, dict(w=w, h=h, frames=n)

def cast():
    meta = {}
    for n in ['dez_asleep', 'dez_awake', 'dez_portrait', 'keeper_awake', 'keeper_asleep', 'keeper_lantern']:
        im = Image.open(RD + n + '.png').convert('RGBA')
        m = json.load(open(RD + n + '.json')) if os.path.exists(RD + n + '.json') else {}
        if n.startswith('keeper_') and n != 'keeper_lantern':
            # stilts go under the waterline: the last 46 px (2x) above the foot fade to 25%
            a = np.asarray(im).astype(np.float32); fy = int(m['foot'][1] * 2)
            for yy in range(max(0, fy - 46), a.shape[0]):
                k = 1 - 0.75 * min(1, (yy - (fy - 46)) / 46.0); a[yy, :, 3] *= k
                a[yy, :, :3] = a[yy, :, :3] * (0.6 + 0.4 * k) + np.array([6, 16, 20]) * (1 - (0.6 + 0.4 * k))
            im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
        im.save(DST + n + '.png', optimize=True)
        meta[n] = dict(m, w=im.width // 2, h=im.height // 2)
    return meta

# placements of the right-half props: (name, base point on the floor in 1x room px, depth baseY)
PROPS = {'a13_shelf': [(924, 214), (994, 214)], 'a13_lamp': [(1164, 346)], 'a13_boxes': [(1134, 596)]}
def props():
    out = {}
    for n, spots in PROPS.items():
        im = Image.open(RD + n + '.png').convert('RGBA'); m = json.load(open(RD + n + '.json'))
        bb = im.getchannel('A').point(lambda v: 255 if v > 18 else 0).getbbox(); im = im.crop(bb)
        im = im.resize((max(1, round(im.width / 2)), max(1, round(im.height / 2))), Image.LANCZOS)
        fx, fy = m['foot'][0] - bb[0] / 2, m['foot'][1] - bb[1] / 2
        if n == 'a13_lamp':   # the lamp keeps its glow; only the stand is dimmed
            rgb = ImageEnhance.Brightness(im.convert('RGB')).enhance(0.85); a = im.getchannel('A'); im = rgb.convert('RGBA'); im.putalpha(a)
        else: im = grade(im)
        im.save(A + 'rooms/fg/%s.png' % n, optimize=True)
        out[n] = [dict(x=round(bx - fx), y=round(by - fy), baseY=by) for bx, by in spots]
    return out

if __name__ == '__main__':
    p = plate(); p.save(A + 'rooms/archive13_bleed.jpg', quality=90); plate(True).save(A + 'rooms/archive13_warm.jpg', quality=90); codeview(p).save(A + 'rooms/archive13_code.jpg', quality=88)
    for n in ['archive_winch', 'archive_exit'] + ['bridge_%02d' % k for k in range(8)]:
        grade(Image.open(A + 'rooms/fg/%s.png' % n).convert('RGBA')).save(A + 'rooms/fg/a13_%s.png' % n.replace('archive_', ''), optimize=True)
    ds, dm = drip_strip(); ds.save(A + 'rooms/amb/archive13_drip.png', optimize=True)
    ss, sm = sheen_strip(); ss.save(A + 'rooms/amb/archive13_sheen.png', optimize=True)
    grade(Image.open(A + 'rooms/amb/archive_H_line.png').convert('RGBA')).save(A + 'rooms/amb/archive13_line.png', optimize=True)
    meta = cast()
    print('PROPS', json.dumps(props()))
    ts = ('// generated by art/tools/archive13_post.py from art/render/archive13 (archive13.py renders). 1x px; images are 2x.\n'
          'export const A13 = ' + json.dumps(meta) + ' as const;\n'
          'export const A13_DRIP = ' + json.dumps(dm) + ';\nexport const A13_SHEEN = ' + json.dumps(sm) + ';\n')
    open(G + 'src/archive13art.ts', 'w').write(ts); print('archive13_post ok', list(meta))
