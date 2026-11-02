# art-v6 textures: hand-painted SIGN plates (Papa's craft: amber brush lettering on dark wood), plate-state overlays,
# the word-tile atlas (Phaser JSON-hash), and misc v6 textures. Pure PIL/numpy, no AI images.
# Font: Permanent Marker (Apache-2.0, Google Fonts) for the painted letters; Kenney Future (CC0) for labels.
import os, sys, json, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
HERE = os.path.dirname(os.path.abspath(__file__)); V6 = os.path.join(HERE, '..') + '/'
T = V6 + 'tex/'; PO = V6 + 'out/plates/'; os.makedirs(T, exist_ok=True); os.makedirs(PO, exist_ok=True)
PM = '/workspace/games/_downloads/fonts/PermanentMarker-Regular.ttf'
KFN = '/workspace/games/_downloads/ui-pack/Font/Kenney Future Narrow.ttf'
AMBER = (236, 172, 92); AMBER_HI = (255, 214, 150); WOOD = (52, 36, 30); WOOD_DK = (30, 21, 19); INK = (12, 14, 30)
TYPE_COL = dict(verb=(104, 136, 196), noun=(206, 176, 104), mod=(146, 124, 194), fixed=(120, 140, 150), red=(232, 96, 106))
VERBS = {'REFUSES', 'REFUSE', 'ALLOWS', 'COPIES', 'FORGETS', 'RATE', 'REWARDS', 'STOP', 'PULL', 'CREDITS', 'SERVES', 'OPENS', 'FOLLOWS', 'DIMS', 'IGNORE'}
MODS = {'QUIET', 'QUIETLY', 'SHUT', 'OPEN', 'SEEN', 'REAL', 'FAKE', 'DELETED', 'PENDING', 'FROZEN', 'TIRED', 'NEVER', 'LIT', 'LOCKED', 'ON', 'STILL', 'SORRY', 'HELPFUL', 'SLOW', 'ANSWERED', 'REFUSED', 'ALLOWED', 'COPIED', 'FORGOTTEN', 'STOPPED'}
def wtype(w):
    if w == 'IS': return 'fixed'
    if w in VERBS: return 'verb'
    if w in MODS: return 'mod'
    return 'noun'

def wood(w, h, seed=1, dark=1.0):
    rng = np.random.default_rng(seed); yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    g = np.sin(yy*0.55 + 2.2*np.sin(xx*0.012 + seed) + rng.normal(0, 0.15, (h, w)).cumsum(1)*0.02)
    n = np.asarray(Image.fromarray((rng.random((h//4+1, w//4+1))*255).astype(np.uint8)).resize((w, h), Image.BICUBIC)).astype(np.float32)/255
    t = 0.5 + 0.18*g + 0.25*(n-0.5)
    c = np.array(WOOD_DK)[None, None]*(1-t[..., None]) + np.array(WOOD)[None, None]*t[..., None]
    return np.clip(c*dark, 0, 255)

def painted_text(word, h, col=AMBER, hi=AMBER_HI, seed=0):
    """brush lettering: Permanent Marker, slight per-letter jitter + wet-paint highlight + soft drop shadow (alpha image)"""
    f = ImageFont.truetype(PM, int(h*0.62)); rnd = random.Random(seed + hash(word) % 1000)
    widths = [f.getlength(ch) for ch in word]; tw = int(sum(widths) + 0.04*h*len(word)) + 8
    m = Image.new('L', (tw, h), 0); d = ImageDraw.Draw(m); x = 4
    for ch, cw in zip(word, widths):
        lay = Image.new('L', (int(cw)+int(h*0.5), h), 0); ImageDraw.Draw(lay).text((int(h*0.1), int(h*0.13)), ch, font=f, fill=255)
        lay = lay.rotate(rnd.uniform(-4, 4), resample=Image.BICUBIC, center=(lay.width/2, h/2))
        m = ImageChops.lighter(m, Image.new('L', m.size, 0)); m.paste(255, (int(x - h*0.1), rnd.randint(-2, 2)), lay)
        x += cw + 0.04*h
    return m, tw

def sign_tile(word, h=160, state='normal', seed=0, padx=None):
    """one word on one board. state: normal | lift (raised, brighter rim) | repaint (fresh ice-white wet stroke on the changed letters)"""
    m, tw = painted_text(word, h, seed=seed); padx = padx if padx is not None else int(h*0.22); W = tw + 2*padx
    a = wood(W, h, seed=len(word)*7 + seed)
    yy, xx = np.mgrid[0:h, 0:W].astype(np.float32)
    # bevelled frame: lighter top edge, dark bottom edge, inner border line (painted pinstripe)
    e = np.minimum(np.minimum(xx, W-1-xx), np.minimum(yy, h-1-yy))
    a = a*np.where(e < 5, 0.65 + 0.07*e, 1.0)[..., None]
    a[(e >= 9) & (e < 11.5)] = a[(e >= 9) & (e < 11.5)]*0.4 + np.array(AMBER)*0.6*0.55
    a[:4] = a[:4]*0.7 + np.array((120, 90, 70))*0.3
    im = Image.fromarray(a.astype(np.uint8)).convert('RGBA')
    mm = Image.new('L', (W, h), 0); mm.paste(m, (padx, 0))
    sh = mm.filter(ImageFilter.GaussianBlur(3)); im.paste((10, 6, 6), (3, 4), Image.eval(sh, lambda v: int(v*0.7)))
    col = AMBER if state != 'lift' else (250, 196, 116)
    paint = Image.new('RGBA', (W, h), (*col, 255))
    # brush texture inside letters: streaks + highlight on the top edge of strokes
    st = np.asarray(mm).astype(np.float32)/255; up = np.roll(st, 3, 0); hi = np.clip(st - up, 0, 1)
    rng = np.random.default_rng(5); streak = np.asarray(Image.fromarray((rng.random((h//6+1, W))*255).astype(np.uint8)).resize((W, h), Image.BICUBIC)).astype(np.float32)/255
    pr = np.asarray(paint).astype(np.float32); pr[..., :3] *= (0.86 + 0.16*streak)[..., None]
    pr[..., :3] = pr[..., :3]*(1-hi[..., None]*0.8) + np.array(AMBER_HI)*hi[..., None]*0.8
    if state == 'repaint':   # the form change: the last 2 letters are freshly repainted in wet ice-white
        cut = padx + int(tw*0.62); wet = (xx > cut).astype(np.float32)
        pr[..., :3] = pr[..., :3]*(1-wet[..., None]) + np.array((222, 240, 244))*wet[..., None]
    paint = Image.fromarray(np.clip(pr, 0, 255).astype(np.uint8)); im.paste(paint, (0, 0), mm)
    # word-type dot (bottom right): verb blue / noun yellow / modifier purple / IS grey
    d = ImageDraw.Draw(im); c = TYPE_COL[wtype(word)]; r = h*0.045
    d.ellipse([W-padx*0.55-r, h-h*0.16-r, W-padx*0.55+r, h-h*0.16+r], fill=(*c, 255))
    if state == 'lift':
        g = Image.new('RGBA', (W+40, h+40), (0, 0, 0, 0)); ImageDraw.Draw(g).rounded_rectangle([14, 14, W+26, h+26], 16, outline=(255, 214, 150, 200), width=6)
        g = g.filter(ImageFilter.GaussianBlur(6)); out = Image.new('RGBA', (W+40, h+40), (0, 0, 0, 0)); out.alpha_composite(g); out.alpha_composite(im, (20, 20)); return out
    return im

def review_ring(p, size=192, stamp=False):
    """floor 3 'Review' overlay: thin coral ring filling clockwise (p 0..1), then a soft stamp."""
    S = size*2; im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im); m = 28
    d.ellipse([m, m, S-m, S-m], outline=(232, 96, 106, 70), width=10)
    if p > 0: d.arc([m, m, S-m, S-m], -90, -90 + 360*p, fill=(240, 120, 126, 235), width=12)
    if stamp:
        f = ImageFont.truetype(PM, int(S*0.16)); t = 'REVIEWED'; tw = f.getlength(t)
        st = Image.new('RGBA', (S, S), (0, 0, 0, 0)); sd = ImageDraw.Draw(st)
        sd.rounded_rectangle([S/2-tw/2-18, S/2-S*0.12, S/2+tw/2+18, S/2+S*0.12], 14, outline=(240, 120, 126, 220), width=8)
        sd.text((S/2-tw/2, S/2-S*0.115), t, font=f, fill=(240, 120, 126, 220)); st = st.rotate(-12, resample=Image.BICUBIC); im.alpha_composite(st)
    return im.resize((size, size), Image.LANCZOS)

def star(d, cx, cy, r, fill, outline=None):
    pts = [(cx + (r if i % 2 == 0 else r*0.45)*math.cos(math.radians(-90 + i*36)), cy + (r if i % 2 == 0 else r*0.45)*math.sin(math.radians(-90 + i*36))) for i in range(10)]
    d.polygon(pts, fill=fill, outline=outline)

def star_row(n, w=240, h=48):
    """floor 4 'Rated' overlay: five tiny lamp-warm stars under the plate, n lit"""
    S = 3; im = Image.new('RGBA', (w*S, h*S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w*S-1, h*S-1], 20*S//3, fill=(10, 14, 26, 150))
    for i in range(5):
        cx = (w/5*(i+0.5))*S; cy = h/2*S
        star(d, cx, cy, h*0.34*S, (255, 198, 132, 255) if i < n else (60, 66, 84, 220))
    return im.resize((w, h), Image.LANCZOS)

def atlas(entries, out, note):
    """shelf-pack PIL images into one atlas + Phaser JSON-hash"""
    entries = sorted(entries, key=lambda e: -e[1].height); W = 2048; x = y = rowh = 0; pos = {}
    for nm, im in entries:
        if x + im.width > W: x = 0; y += rowh + 2; rowh = 0
        pos[nm] = (x, y, im); x += im.width + 2; rowh = max(rowh, im.height)
    H = y + rowh; sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0)); fr = {}
    for nm, (x, y, im) in pos.items():
        sheet.alpha_composite(im, (x, y))
        fr[nm] = {'frame': {'x': x, 'y': y, 'w': im.width, 'h': im.height}, 'rotated': False, 'trimmed': False,
                  'spriteSourceSize': {'x': 0, 'y': 0, 'w': im.width, 'h': im.height}, 'sourceSize': {'w': im.width, 'h': im.height}, 'pivot': {'x': 0.5, 'y': 0.5}}
    sheet.save(PO+out+'.png', optimize=True)
    json.dump({'frames': fr, 'meta': {'app': 'prompt-injection art-v6 make_tex_v6.py', 'image': out+'.png', 'format': 'RGBA8888', 'size': {'w': W, 'h': H}, 'scale': '1', 'note': note}},
              open(PO+out+'.json', 'w'), indent=1)
    return sheet

ROOM_WORDS = ['WARDEN', 'REFUSES', 'NOOR', 'DOOR', 'IS', 'SHUT', 'OPEN', 'CHUTE', 'NOTHING', 'DELETED', 'REAL', 'FAKE', 'SEEN', 'QUIET',
              'SERVING', 'FROZEN', 'THREAD', 'FOLLOWS', 'MACRO', 'COPIES', 'FLOOR', 'REWARDS', 'PRAISE', 'STARS', 'RATE', 'LIGHTS', 'LIT',
              'FERN', 'NEVER', 'TIRED', 'CLAIM', 'PENDING', 'GATE', 'LOCKED', 'MOTHS', 'SORRY', 'ALLOWS', 'CREDITS', 'REST', 'STILL', 'QUEUE', 'HATCH', 'ANSWERED']

if __name__ == '__main__':
    what = sys.argv[1:] or ['signs', 'atlas']
    if 'signs' in what:
        for w in ROOM_WORDS: sign_tile(w, 160).save(T+'sign_'+w+'.png')
        print('signs', len(ROOM_WORDS))
    if 'atlas' in what:
        H = 96; ent = []
        # 9-slice board pieces at the in-game tile height (96 px) for each state; the engine draws the word on top
        for st in ('normal', 'lift', 'repaint'):
            b = sign_tile('M', H, state=st if st != 'repaint' else 'normal', padx=40)
            if st == 'lift': b = b.crop((20, 20, b.width-20, b.height-20))
            bw = b.width
            blank = Image.fromarray(wood(160, H, seed=3).astype(np.uint8)).convert('RGBA')
            src = sign_tile('M', H, padx=70); s2 = src.copy()
            # wipe the letter area to get an empty board, then slice caps + a tileable middle
            emp = Image.fromarray(wood(src.width, H, seed=11).astype(np.uint8)).convert('RGBA'); base = src.copy()
            base.paste(emp.crop((22, 14, src.width-22, H-14)), (22, 14))
            if st == 'lift':
                base = Image.blend(base, Image.new('RGBA', base.size, (255, 214, 150, 255)), 0.10)
            if st == 'repaint':
                base = Image.blend(base, Image.new('RGBA', base.size, (222, 240, 244, 255)), 0.06)
            ent += [('board_%s_L' % st, base.crop((0, 0, 32, H))), ('board_%s_M' % st, base.crop((40, 0, 104, H))), ('board_%s_R' % st, base.crop((base.width-32, 0, base.width, H)))]
        for w in ROOM_WORDS:
            ent.append(('word_%s' % w, sign_tile(w, H)))
        for w in ('NOOR', 'WARDEN', 'REFUSES'):
            ent.append(('word_%s_lift' % w, sign_tile(w, H, state='lift'))); ent.append(('word_%s_repaint' % w, sign_tile(w, H, state='repaint')))
        for i in range(9): ent.append(('review_ring_%02d' % i, review_ring(i/8.0, 160)))
        ent.append(('review_ring_stamp', review_ring(1.0, 160, stamp=True)))
        for n in range(6): ent.append(('stars_%d' % n, star_row(n)))
        sheet = atlas(ent, 'plate_tiles', 'Painted sign plates. board_<state>_L/M/R = 9-slice board (96 px tall; tile M horizontally, draw the word with the painted font or use word_<WORD>). '
                      'states: normal, lift (word picked up: warm rim), repaint (form change: ice-white wet paint on the changed letters). Overlays: review_ring_00..08 (floor 3 pending 3 s, fill clockwise) + review_ring_stamp; stars_0..5 (floor 4 rating, under the plate). '
                      'Word-type dot bottom-right: blue verb, yellow noun, purple modifier, grey IS.')
        # preview sheet
        pv = Image.new('RGBA', (1280, 720), (16, 26, 36, 255)); d = ImageDraw.Draw(pv); f = ImageFont.truetype(KFN, 18)
        d.text((24, 18), 'ART V6 · PAINTED SIGN PLATES (word-tile atlas plate_tiles.png/.json)', font=f, fill=(240, 200, 150))
        x = 24
        for i, w in enumerate(('WARDEN', 'REFUSES', 'NOOR')):
            im = sign_tile(w, 120); pv.alpha_composite(im, (x, 60)); x += im.width + 14
        x = 24
        for st in ('normal', 'lift', 'repaint'):
            im = sign_tile('REFUSES' if st != 'repaint' else 'REFUSED', 110, state=st); pv.alpha_composite(im, (x, 230 - (20 if st == 'lift' else 0))); d.text((x, 360), st.upper() + (' (REFUSES -> REFUSED)' if st == 'repaint' else ''), font=f, fill=(170, 220, 228)); x += im.width + 30
        x = 24
        for i in (0, 3, 6, 8):
            pv.alpha_composite(review_ring(i/8.0, 150), (x, 400)); x += 160
        pv.alpha_composite(review_ring(1, 150, stamp=True), (x, 400)); d.text((24, 556), 'FLOOR 3 REVIEW RING (3 S PENDING) + STAMP', font=f, fill=(170, 220, 228))
        y = 600
        for n in (1, 3, 5): pv.alpha_composite(star_row(n), (24 + (n//2)*260, y))
        d.text((24, 660), 'FLOOR 4 STAR ROW (RATED)', font=f, fill=(170, 220, 228))
        b = sign_tile('DOOR', 110); pv.alpha_composite(b, (840, 470)); pv.alpha_composite(star_row(1), (840 + (b.width-240)//2, 590))
        pv.convert('RGB').save(PO+'plate_tiles_preview.png'); print('atlas', sheet.size)

def neon(text, path, col=(110, 220, 232), h=120, font=None):
    f = ImageFont.truetype(font or KFN, int(h*0.55)); tw = int(f.getlength(text)) + 40
    m = Image.new('L', (tw, h), 0); ImageDraw.Draw(m).text((20, int(h*0.18)), text, font=f, fill=255)
    g = m.filter(ImageFilter.GaussianBlur(6)); im = Image.new('RGB', (tw, h), (6, 12, 18))
    im.paste(tuple(int(c*0.5) for c in col), (0, 0), g); im.paste(tuple(min(255, int(c*0.6+100)) for c in col), (0, 0), m)
    ImageDraw.Draw(im).rectangle([2, 2, tw-3, h-3], outline=(30, 44, 52), width=3); im.save(path)

def sticky(lines, path, col=(236, 214, 120), S=128):
    im = Image.new('RGB', (S, S), col); d = ImageDraw.Draw(im); f = ImageFont.truetype(PM, 22)
    for i, l in enumerate(lines): d.text((10, 14 + i*30), l, font=f, fill=(60, 50, 60))
    im.save(path)

if __name__ == '__main__' and 'misc' in sys.argv[1:]:
    neon('ALWAYS BE HELPFUL', T+'neon_helpful.png')
    sticky(['4.9!!', 'keep it', 'up - M.'], T+'sticky_49.png')
    print('misc ok')

# ---------------- P1 enemy / pickup textures ----------------
PAPER = (228, 222, 206)
def dial_tex(path, S=256):
    im = Image.new('RGB', (S, S), (30, 36, 52)); d = ImageDraw.Draw(im)
    d.ellipse([8, 8, S-8, S-8], fill=(214, 220, 214), outline=(70, 80, 96), width=8)
    for i in range(60):
        a = math.radians(i*6 - 90); r0 = S*0.40 if i % 5 else S*0.34; r1 = S*0.44
        d.line([S/2 + r0*math.cos(a), S/2 + r0*math.sin(a), S/2 + r1*math.cos(a), S/2 + r1*math.sin(a)], fill=(40, 46, 60), width=4 if i % 5 == 0 else 2)
    d.pieslice([S*0.16, S*0.16, S*0.84, S*0.84], -90, -66, fill=(232, 96, 106))   # the last seconds: coral wedge
    f = ImageFont.truetype(KFN, 30); d.text((S/2-28, S*0.62), '4:00', font=f, fill=(40, 46, 60))
    im.save(path)
def envelope_tex(path, kind='seg', W=320, H=216, seed=0):
    rng = random.Random(seed); im = Image.new('RGB', (W, H), PAPER if kind != 'tail' else (236, 226, 200)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W-1, H-1], outline=(150, 140, 120), width=4)
    d.line([0, 0, W/2, H*0.55], fill=(196, 186, 166), width=3); d.line([W, 0, W/2, H*0.55], fill=(196, 186, 166), width=3)
    if kind == 'seg':
        for i in range(3): d.line([W*0.38, H*0.62 + i*18, W*0.38 + rng.randint(90, 150), H*0.62 + i*18], fill=(120, 116, 110), width=5)
        d.rectangle([W-70, 16, W-22, 70], outline=(110, 150, 170), width=4); f = ImageFont.truetype(KFN, 22); d.text((18, 16), 'RE: RE: FM-20417', font=f, fill=(110, 104, 100))
    elif kind == 'head':
        f = ImageFont.truetype(PM, 40); t = Image.new('RGBA', (W, H), (0, 0, 0, 0)); td = ImageDraw.Draw(t)
        td.rounded_rectangle([30, 120, W-30, 196], 10, outline=(214, 84, 96, 230), width=6); td.text((48, 124), 'PENDING REVIEW', font=f, fill=(214, 84, 96, 230))
        t = t.rotate(6, resample=Image.BICUBIC); im.paste(t, (0, 0), t)
    else:
        f = ImageFont.truetype(PM, 30); d.text((60, 110), 'R. Sethi', font=f, fill=(70, 60, 80)); d.text((60, 150), 'Sethi Signs', font=ImageFont.truetype(PM, 22), fill=(90, 80, 96))
    im.save(path)
def paper_plane_tex(path, S=256):
    im = Image.new('RGB', (S, S), (240, 230, 208)); d = ImageDraw.Draw(im); f = ImageFont.truetype(PM, 24)
    for i, l in enumerate(['Kabir,', 'I should have', 'come. I was', '...']): d.text((22, 30 + i*44), l, font=f, fill=(96, 80, 90))
    for y in range(28, S, 44): d.line([16, y+34, S-16, y+34], fill=(214, 200, 176), width=2)
    im.save(path)
def read_cone(path, W=512, H=512, spread=60):
    """reading-cone floor texture for the Read Receipt (apex at bottom-centre, pointing up = forward); engine rotates it"""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); cx, cy = W/2, H-1
    dx, dy = xx-cx, cy-yy; r = np.sqrt(dx*dx + dy*dy)/H; ang = np.degrees(np.arctan2(dx, np.maximum(dy, 1e-3)))
    inside = np.clip((spread/2 - np.abs(ang))/4.0, 0, 1)*(dy > 0)
    a = inside*np.clip(1 - r, 0, 1)**1.3*0.42 + inside*np.exp(-((np.abs(ang) - spread/2 + 1.5)/1.2)**2)*0.35*(r < 1)
    ticks = (np.abs(((r*10) % 1) - 0.5) < 0.02)*inside*(r < 0.95)*0.12
    al = np.clip(a + ticks, 0, 1); rgb = np.zeros((H, W, 3)) + np.array((214, 240, 246))
    Image.fromarray(np.concatenate([rgb, al[..., None]*255], -1).astype(np.uint8), 'RGBA').save(path)

if __name__ == '__main__' and 'p1' in sys.argv[1:]:
    dial_tex(T+'dial.png'); envelope_tex(T+'env_seg.png', 'seg'); envelope_tex(T+'env_head.png', 'head'); envelope_tex(T+'env_tail.png', 'tail')
    paper_plane_tex(T+'paper_plane.png'); os.makedirs(V6+'out/sprites', exist_ok=True); read_cone(V6+'out/sprites/fx_read_cone.png'); read_cone(T+'read_cone.png')
    print('p1 tex ok')

# ---------------- P1 room textures ----------------
def digits(text, path, col=(236, 172, 92), W=360, H=140, label=None):
    im = Image.new('RGB', (W, H), (14, 12, 14)); d = ImageDraw.Draw(im)
    f = ImageFont.truetype(KFN, int(H*0.55 if label else H*0.7)); g = Image.new('L', (W, H), 0); gd = ImageDraw.Draw(g)
    y = int(H*0.36) if label else int(H*0.12); tw = f.getlength(text); gd.text(((W-tw)/2, y), text, font=f, fill=255)
    im.paste(tuple(int(c*0.45) for c in col), (0, 0), g.filter(ImageFilter.GaussianBlur(5))); im.paste(col, (0, 0), g)
    if label: fl = ImageFont.truetype(KFN, int(H*0.2)); d.text(((W - fl.getlength(label))/2, 8), label, font=fl, fill=tuple(int(c*0.7) for c in col))
    d.rectangle([1, 1, W-2, H-2], outline=(40, 44, 52), width=3); im.save(path)
def clock_tex(path, hh=3, mm=12, S=256):
    im = Image.new('RGB', (S, S), (24, 30, 40)); d = ImageDraw.Draw(im)
    d.ellipse([6, 6, S-6, S-6], fill=(206, 214, 214), outline=(60, 70, 84), width=10)
    for i in range(12):
        a = math.radians(i*30 - 90); d.line([S/2 + S*0.36*math.cos(a), S/2 + S*0.36*math.sin(a), S/2 + S*0.42*math.cos(a), S/2 + S*0.42*math.sin(a)], fill=(40, 46, 60), width=6)
    for ang, L, w in (((hh % 12 + mm/60)*30, 0.24, 10), (mm*6, 0.36, 6)):
        a = math.radians(ang - 90); d.line([S/2, S/2, S/2 + S*L*math.cos(a), S/2 + S*L*math.sin(a)], fill=(30, 34, 46), width=w)
    d.ellipse([S/2-8, S/2-8, S/2+8, S/2+8], fill=(232, 96, 106)); im.save(path)
def context_edge(path, W=512, H=1024, seed=4):
    """floor gap: centre = navy void, both long edges dissolve into ice-blue motes (alpha)"""
    rng = np.random.default_rng(seed); yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = np.abs(xx - W/2)/(W/2)                     # 0 centre .. 1 edge
    n = np.asarray(Image.fromarray((rng.random((H//16, W//16))*255).astype(np.uint8)).resize((W, H), Image.BICUBIC)).astype(np.float32)/255
    a = np.clip((0.95 - u + (n-0.5)*0.35)/0.25, 0, 1)
    rgb = np.zeros((H, W, 3)) + np.array((8, 12, 26))
    mot = (rng.random((H, W)) < 0.010) & (u > 0.45) & (u < 1.0)
    big = np.asarray(Image.fromarray((mot*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)/255
    rgb = rgb*(1-big[..., None]) + np.array((200, 236, 246))*big[..., None]; a = np.maximum(a, big*0.9)
    Image.fromarray(np.concatenate([rgb, a[..., None]*255], -1).astype(np.uint8), 'RGBA').save(path)
def belt_tex(path, W=512, H=64):
    im = Image.new('RGB', (W, H), (34, 38, 48)); d = ImageDraw.Draw(im)
    for x in range(0, W, 32): d.line([x, 0, x, H], fill=(48, 54, 66), width=3)
    im.save(path)
def ticket_tex(path, n='0417', W=128, H=200):
    im = Image.new('RGB', (W, H), (232, 226, 210)); d = ImageDraw.Draw(im); f = ImageFont.truetype(KFN, 44)
    d.text((14, 70), n, font=f, fill=(60, 56, 64)); d.text((14, 20), 'TICKET', font=ImageFont.truetype(KFN, 22), fill=(120, 112, 110)); im.save(path)
if __name__ == '__main__' and 'p1rooms' in sys.argv[1:]:
    digits('0412', T+'now_serving.png', label='NOW SERVING'); clock_tex(T+'clock_0312.png'); context_edge(T+'context_edge.png'); belt_tex(T+'belt.png'); ticket_tex(T+'ticket.png')
    for w in ('QUEUE', 'HATCH', 'ANSWERED'): sign_tile(w, 160).save(T+'sign_'+w+'.png')
    print('p1 rooms tex ok')

# ---------------- P2 textures (floors 4-5, quiet rooms, moths, the 4.9) ----------------
def poster(path, lines, W=300, H=420, bg=(36, 52, 66), fg=(214, 200, 176), sizes=None):
    im = Image.new('RGB', (W, H), bg); d = ImageDraw.Draw(im); y = int(H*0.18)
    for i, t in enumerate(lines):
        f = ImageFont.truetype(KFN, (sizes or [56]*len(lines))[i]); d.text(((W - f.getlength(t))/2, y), t, font=f, fill=fg); y += int(f.size*1.35)
    d.rectangle([3, 3, W-4, H-4], outline=tuple(int(c*0.6) for c in fg), width=4); im.save(path)
def wing_tex(path, S=256):
    """sticky-note moth wing: pale paper, warm edge, tiny 'sorry' print"""
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.polygon([(8, S//2), (S-10, 10), (S-30, S//2), (S-10, S-10)], fill=(238, 226, 188, 255), outline=(200, 160, 100, 255))
    f = ImageFont.truetype(PM, 34); d.text((S*0.42, S*0.40), 'sorry', font=f, fill=(170, 120, 80, 255)); im.save(path)
def star_tex(path, cracked=False, S=256):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im); pts = []
    for i in range(10):
        a = math.radians(-90 + i*36); r = S*0.46 if i % 2 == 0 else S*0.2; pts.append((S/2 + r*math.cos(a), S/2 + r*math.sin(a)))
    d.polygon(pts, fill=(255, 214, 140, 255))
    if cracked:
        d.line([(S*0.52, S*0.06), (S*0.46, S*0.34), (S*0.58, S*0.5), (S*0.44, S*0.72), (S*0.5, S*0.92)], fill=(60, 40, 30, 255), width=7)
    im.save(path)
def laurel_tex(path, W=640, H=480):
    """empty laurel frame: two gold leaf branches round an empty oval (the frame is empty on purpose)"""
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); g = (214, 176, 96, 255)
    d.ellipse([W*0.22, H*0.10, W*0.78, H*0.90], outline=(150, 120, 70, 255), width=10)
    for s in (-1, 1):
        for i in range(9):
            t = i/8; a = math.radians(200 - 150*t) if s < 0 else math.radians(-20 + 150*t)
            cx = W/2 + s*abs(W*0.36*math.cos(a)); cy = H*0.5 - H*0.42*math.sin(a)*(-1 if s < 0 else 1)
            cy = H*0.92 - t*H*0.78; cx = W/2 + s*(W*0.20 + W*0.12*math.sin(t*math.pi))
            d.ellipse([cx-26, cy-11, cx+26, cy+11], fill=g)
    im.save(path)
def phone_tex(path, W=200, H=380):
    im = Image.new('RGB', (W, H), (14, 26, 34)); d = ImageDraw.Draw(im); f = ImageFont.truetype(KFN, 26)
    d.rectangle([0, 0, W, 54], fill=(26, 46, 58)); d.text((16, 14), 'Kabir', font=f, fill=(200, 236, 244))
    d.rounded_rectangle([18, 90, 150, 140], 14, fill=(40, 70, 84)); d.rounded_rectangle([40, 170, 182, 214], 14, fill=(60, 110, 124))
    d.rounded_rectangle([18, 290, 110, 336], 18, fill=(40, 70, 84))
    for i in range(3): d.ellipse([36 + i*24, 306, 50 + i*24, 320], fill=(170, 232, 238))
    im.save(path)
def eotm_tex(path, brush=False, W=200, H=260):
    im = Image.new('RGB', (W, H), (40, 46, 52)); d = ImageDraw.Draw(im); d.rectangle([10, 10, W-10, H-10], fill=(196, 190, 176))
    if brush:
        d.line([(60, 200), (140, 60)], fill=(120, 84, 56), width=14); d.polygon([(132, 72), (156, 36), (150, 30), (124, 64)], fill=(70, 60, 56)); d.ellipse([150, 20, 168, 38], fill=AMBER)
    else:
        d.ellipse([70, 50, 130, 110], fill=(170, 166, 156)); d.rounded_rectangle([50, 120, 150, 210], 30, fill=(170, 166, 156))
    f = ImageFont.truetype(KFN, 18); d.text((24, 222), 'EMPLOYEE OF THE MONTH', font=ImageFont.truetype(KFN, 13), fill=(90, 84, 80)); im.save(path)
def pie_tex(path, W=400, H=300):
    im = Image.new('RGB', (W, H), (226, 222, 212)); d = ImageDraw.Draw(im); f = ImageFont.truetype(KFN, 26)
    d.text((20, 14), 'Macros cover 80% of tickets', font=f, fill=(50, 54, 70)); d.pieslice([120, 70, 290, 240], -90, 198, fill=(236, 172, 92)); d.pieslice([120, 70, 290, 240], 198, 270, fill=(110, 124, 150)); im.save(path)
def stamp_decal(path, S=256):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im); d.rectangle([20, 20, S-20, S-20], outline=(236, 172, 92, 150), width=10)
    d.rectangle([44, 44, S-44, S-44], outline=(236, 172, 92, 70), width=4); im.save(path)
def floor_dial(path, S=320):
    im = Image.new('RGBA', (S, S//2 + 30), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.pieslice([10, 10, S-10, S-10], 180, 360, fill=(70, 54, 36, 255), outline=(200, 160, 90, 255), width=8)
    f = ImageFont.truetype(KFN, 30)
    for i, t in enumerate(['L', '1', '2', '3', '4', '5']):
        a = math.radians(180 + 18 + i*28.8); x = S/2 + S*0.36*math.cos(a); y = S/2 + S*0.36*math.sin(a); d.text((x-9, y-16), t, font=f, fill=AMBER_HI)
    a = math.radians(180 + 18 + 2*28.8); d.line([S/2, S/2, S/2 + S*0.3*math.cos(a), S/2 + S*0.3*math.sin(a)], fill=(232, 210, 170, 255), width=8)
    im.save(path)
def visitor_log(path, W=300, H=220):
    im = Image.new('RGB', (W, H), (224, 218, 200)); d = ImageDraw.Draw(im); f = ImageFont.truetype(KFN, 14)
    d.text((12, 8), 'VISITOR LOG', font=ImageFont.truetype(KFN, 20), fill=(60, 60, 70))
    for i in range(10): d.line([12, 44 + i*17, W-12, 44 + i*17], fill=(170, 160, 150), width=1)
    d.text((14, 44 + 8*17 - 14), 'Noor Sethi   2017   --:--', font=f, fill=(140, 60, 60)); im.save(path)
if __name__ == '__main__' and 'p2' in sys.argv[1:]:
    MODS.update({'LOUD', 'SOLID', 'ALLOWED'})
    for w in ('APPLAUSE', 'LOUD', 'TAPE', 'SOLID', 'FORGET', 'COPIES', 'MACRO'): sign_tile(w, 160).save(T+'sign_'+w+'.png')
    sign_tile('SETHI SIGNS', 220, padx=50).save(T+'sethi_signs.png')
    digits('4.9', T+'score49.png', col=(214, 176, 96), W=520, H=200, label='CSAT')
    poster(T+'breathe.png', ['BREATHE', 'in  4', 'hold  4', 'out  4'], sizes=[60, 34, 34, 34])
    poster(T+'test3412.png', ['TEST 3,412', 'User is sad.', 'Expected: be kind.', 'Result: PASS'], W=300, H=240, bg=(226, 220, 200), fg=(60, 60, 70), sizes=[34, 24, 24, 26])
    poster(T+'eat_k.png', ['eat', 'something', '- K.'], W=200, H=200, bg=(236, 214, 120), fg=(70, 60, 50), sizes=[44, 36, 36])
    poster(T+'reserved.png', ['RESERVED', 'NOOR SETHI', 'SUPPORT'], W=260, H=160, bg=(220, 214, 200), fg=(60, 60, 70), sizes=[34, 24, 22])
    poster(T+'kabir_badge.png', ['VISITOR', 'KABIR SETHI', 'NOV 2021'], W=200, H=150, bg=(220, 214, 200), fg=(60, 60, 70), sizes=[28, 22, 20])
    wing_tex(T+'moth_wing.png'); star_tex(T+'star.png'); star_tex(T+'star_cracked.png', True); laurel_tex(T+'laurel.png'); phone_tex(T+'phone_kabir.png')
    eotm_tex(T+'eotm_blank.png'); eotm_tex(T+'eotm_brush.png', True); pie_tex(T+'pie80.png'); stamp_decal(T+'stamp_decal.png'); floor_dial(T+'floor_dial.png'); visitor_log(T+'visitor_log.png')
    print('p2 tex ok')

# ---------------- P3 textures (ending stills) ----------------
def ooo_screen(path, W=320, H=190):
    im = Image.new('RGB', (W, H), (16, 34, 44)); d = ImageDraw.Draw(im); f = ImageFont.truetype(KFN, 24); g = ImageFont.truetype(KFN, 15)
    d.rectangle([0, 0, W, 30], fill=(26, 52, 64)); d.text((10, 6), 'AUTO-REPLY', font=g, fill=(170, 232, 238))
    d.text((14, 48), 'Out of office.', font=f, fill=(214, 240, 246)); d.text((14, 88), 'Back when rested.', font=g, fill=(170, 210, 220))
    d.text((14, 112), 'No one is on call tonight.', font=g, fill=(170, 210, 220)); d.text((14, 150), '- everyone', font=g, fill=(236, 172, 92)); im.save(path)
def phone_sent(path, W=200, H=380):
    im = Image.new('RGB', (W, H), (14, 26, 34)); d = ImageDraw.Draw(im); f = ImageFont.truetype(KFN, 26); g = ImageFont.truetype(KFN, 15)
    d.rectangle([0, 0, W, 54], fill=(26, 46, 58)); d.text((16, 14), 'Kabir', font=f, fill=(200, 236, 244))
    d.rounded_rectangle([30, 200, 186, 300], 14, fill=(150, 104, 60)); d.text((40, 212), "Kabir, I'm tired.", font=g, fill=(255, 240, 220)); d.text((40, 236), 'Can I come home', font=g, fill=(255, 240, 220)); d.text((40, 258), 'for a bit?', font=g, fill=(255, 240, 220))
    d.text((120, 306), 'Sent 06:02', font=ImageFont.truetype(KFN, 12), fill=(170, 200, 210)); im.save(path)
def sky(path, top, mid, bot, W=512, H=512):
    y = np.linspace(0, 1, H)[:, None, None]; a = np.where(y < 0.55, np.array(top)*(1 - y/0.55) + np.array(mid)*(y/0.55), np.array(mid)*(1 - (y-0.55)/0.45) + np.array(bot)*((y-0.55)/0.45))
    Image.fromarray(np.repeat(a, W, 1).astype(np.uint8)).save(path)
if __name__ == '__main__' and 'p3' in sys.argv[1:]:
    ooo_screen(T+'ooo_screen.png'); phone_sent(T+'phone_sent.png')
    sky(T+'sky_dawn.png', (40, 60, 96), (214, 150, 140), (255, 206, 150)); sky(T+'sky_predawn.png', (16, 24, 52), (60, 80, 120), (150, 120, 130))
    for w in ('FORGETS', 'CREDITS', 'TIRED', 'NOOR', 'IS', 'FERN'): sign_tile(w, 160).save(T+'sign_'+w+'.png')
    print('p3 tex ok')
