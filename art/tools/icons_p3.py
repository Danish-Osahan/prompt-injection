# art-v6 P3: name-chip icons for every enemy (cut from the packed idle sheets, so they match in-game exactly) and
# icons for the 12 unlock words (painted amber glyph on a dark wooden disc, Papa's sign craft; word-type colour ring).
# Writes out/p3/icons/*.png + atlases out/p3/icons_enemies.png/.json and out/p3/icons_words.png/.json (Phaser JSON-hash).
import os, sys, json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
exec(open(os.path.join(HERE, 'make_tex_v6.py')).read().split("if __name__ == '__main__':")[0])
SP = V6 + 'out/sprites/'; IO = V6 + 'out/p3/icons/'; os.makedirs(IO, exist_ok=True); S = 128
ENEMIES = [('autocomplete', 'AUTOCOMPLETE', (110, 220, 232)), ('redactor', 'REDACTOR', (232, 96, 106)), ('hallucinator', 'HALLUCINATOR', (150, 128, 226)),
           ('receipt', 'RECEIPT', (116, 222, 196)), ('hound', 'HOUND', (232, 96, 106)), ('sycophant', 'SYCOPHANT', (250, 150, 212)),
           ('warden', 'WARDEN', (232, 96, 106)), ('moths', 'MOTHS', (255, 198, 132)), ('macro', 'MACRO', (230, 160, 84)),
           ('thread_head', 'THREAD', (232, 96, 106)), ('the49', 'STARS', (214, 176, 96)), ('fern', 'FERN', (110, 220, 232))]
def first_cell(name):
    for an in ('idle', 'stagger'):
        p = SP + '%s_%s.png' % (name, an)
        if not os.path.exists(p): p = V6 + '../art-v5/out/sprites/%s_%s.png' % (name, an)
        if os.path.exists(p):
            im = Image.open(p).convert('RGBA'); c = 192 if name != 'fern' else 384; return im.crop((0, 0, c, c))
def chip_bg(ring):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([4, 4, S-5, S-5], fill=(18, 26, 38, 255), outline=ring + (255,), width=4)
    d.ellipse([10, 10, S-11, S-11], outline=(40, 52, 66, 255), width=1); return im
def enemy_icon(name, label, ring):
    cell = first_cell(name); cell = cell.crop((112, 120, 272, 350)) if name == 'fern' else cell; bb = cell.getbbox(); spr = cell.crop(bb)
    k = min(84/spr.width, 84/spr.height); spr = spr.resize((max(1, int(spr.width*k)), max(1, int(spr.height*k))), Image.LANCZOS)
    im = chip_bg(ring); im.alpha_composite(spr, ((S - spr.width)//2, (S - spr.height)//2 + 2))
    mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).ellipse([6, 6, S-7, S-7], fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0)); out.paste(im, (0, 0), mask)
    d = ImageDraw.Draw(out); d.ellipse([4, 4, S-5, S-5], outline=ring + (255,), width=4); return out
WORDS = [('SLOWLY', 'mod'), ('KEEP', 'verb'), ('HONESTLY', 'mod'), ('REAL', 'mod'), ('ANSWER', 'verb'), ('GENTLY', 'mod'),
         ('EVERYONE', 'noun'), ('WAIT', 'verb'), ('KIND', 'mod'), ('NO', 'red'), ('HOME', 'noun'), ('TIRED', 'mod')]
def glyph(d, w, c, cx=64, cy=56):
    L = 6
    if w == 'SLOWLY':
        pts = [(cx + (3 + t*0.9)*math.cos(t*0.5), cy + (3 + t*0.9)*math.sin(t*0.5)) for t in range(0, 34)]; d.line(pts, fill=c, width=L, joint='curve')
    elif w == 'KEEP':
        d.rounded_rectangle([cx-20, cy-4, cx+20, cy+24], 5, fill=c); d.arc([cx-14, cy-26, cx+14, cy+6], 180, 360, fill=c, width=L); d.ellipse([cx-4, cy+4, cx+4, cy+12], fill=WOOD_DK)
    elif w == 'HONESTLY':
        d.ellipse([cx-26, cy-14, cx+26, cy+14], outline=c, width=L); d.ellipse([cx-8, cy-8, cx+8, cy+8], fill=c)
    elif w == 'REAL':
        d.rectangle([cx-14, cy-24, cx+14, cy+16], outline=c, width=L); d.ellipse([cx-24, cy+14, cx+24, cy+26], fill=tuple(int(v*0.6) for v in c))
    elif w == 'ANSWER':
        d.rounded_rectangle([cx-26, cy-20, cx+26, cy+12], 8, outline=c, width=L); d.polygon([(cx-12, cy+10), (cx-18, cy+24), (cx-2, cy+10)], fill=c)
        d.line([(cx-11, cy-4), (cx-3, cy+4), (cx+12, cy-11)], fill=c, width=L)
    elif w == 'GENTLY':
        d.ellipse([cx-10, cy-26, cx+10, cy+18], outline=c, width=L); d.line([(cx, cy-20), (cx, cy+28)], fill=c, width=4)
    elif w == 'EVERYONE':
        for dx in (-20, 0, 20): d.ellipse([cx+dx-7, cy-18, cx+dx+7, cy-4], fill=c); d.pieslice([cx+dx-11, cy-2, cx+dx+11, cy+22], 180, 360, fill=c)
    elif w == 'WAIT':
        d.polygon([(cx-16, cy-24), (cx+16, cy-24), (cx, cy)], outline=c, width=L); d.polygon([(cx-16, cy+24), (cx+16, cy+24), (cx, cy)], fill=c)
    elif w == 'KIND':
        d.pieslice([cx-24, cy-20, cx+2, cy+6], 135, 360, fill=c); d.pieslice([cx-2, cy-20, cx+24, cy+6], 180, 45, fill=c); d.polygon([(cx-22, cy-2), (cx+22, cy-2), (cx, cy+24)], fill=c)
    elif w == 'NO':
        d.ellipse([cx-24, cy-24, cx+24, cy+24], outline=c, width=L+1); d.line([(cx-16, cy+16), (cx+16, cy-16)], fill=c, width=L+1)
    elif w == 'HOME':
        d.polygon([(cx-26, cy-2), (cx, cy-26), (cx+26, cy-2)], fill=c); d.rectangle([cx-18, cy-2, cx+18, cy+24], outline=c, width=L); d.rectangle([cx-5, cy+8, cx+5, cy+24], fill=c)
    elif w == 'TIRED':
        d.ellipse([cx-24, cy-24, cx+24, cy+24], fill=c); d.ellipse([cx-12, cy-30, cx+30, cy+18], fill=WOOD_DK)
        d.text((cx+8, cy-30), 'z', font=ImageFont.truetype(PM, 22), fill=c)
def word_icon(w, t):
    wd = Image.fromarray(wood(S, S, seed=len(w)*5).astype(np.uint8)).convert('RGBA')
    mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).ellipse([4, 4, S-5, S-5], fill=255)
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); im.paste(wd, (0, 0), mask); d = ImageDraw.Draw(im)
    d.ellipse([4, 4, S-5, S-5], outline=TYPE_COL[t] + (255,), width=5)
    g = Image.new('RGBA', (S, S), (0, 0, 0, 0)); glyph(ImageDraw.Draw(g), w, AMBER + (255,))
    sh = g.split()[3].filter(ImageFilter.GaussianBlur(2)); im.paste((10, 6, 6, 255), (2, 3), Image.eval(sh, lambda v: int(v*0.6))); im.alpha_composite(g)
    f = ImageFont.truetype(KFN, 15 if len(w) > 6 else 18); tw = f.getlength(w); d.text(((S - tw)/2, S - 34), w, font=f, fill=AMBER_HI)
    return im
def atlas(items, out, note):
    n = len(items); cols = 6; rows = (n + cols - 1)//cols; sheet = Image.new('RGBA', (cols*S, rows*S), (0, 0, 0, 0)); fr = {}
    for i, (nm, im) in enumerate(items):
        x, y = (i % cols)*S, (i//cols)*S; sheet.alpha_composite(im, (x, y)); im.save(IO + nm + '.png')
        fr[nm] = {'frame': {'x': x, 'y': y, 'w': S, 'h': S}, 'rotated': False, 'trimmed': False, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': S, 'h': S}, 'sourceSize': {'w': S, 'h': S}}
    sheet.save(V6 + 'out/p3/' + out + '.png', optimize=True)
    json.dump({'frames': fr, 'meta': {'app': 'prompt-injection art-v6 icons_p3.py', 'image': out + '.png', 'format': 'RGBA8888', 'size': {'w': sheet.width, 'h': sheet.height}, 'scale': '1', 'note': note}}, open(V6 + 'out/p3/' + out + '.json', 'w'), indent=1)
    bg = Image.new('RGBA', sheet.size, (22, 32, 44, 255)); bg.alpha_composite(sheet); bg.convert('RGB').save(V6 + 'out/p3/' + out + '_preview.png')
if __name__ == '__main__':
    atlas([('icon_enemy_' + l.lower(), enemy_icon(n, l, r)) for n, l, r in ENEMIES], 'icons_enemies',
          'name-chip icons (128 px): cut from each idle sheet (fern: stagger f0), ring = enemy accent. Earned by striking during a tell.')
    atlas([('icon_word_' + w.lower(), word_icon(w, t)) for w, t in WORDS], 'icons_words',
          '12 unlock-word icons (128 px): painted amber glyph on a wooden disc; ring = word type (verb blue, noun gold, modifier/state violet, NO red).')
    print('icons ok')

# ---- v6 UI direction B "Terminal Poetry": monospace glowing text on dark glass (replaces the painted-wood style above) ----
MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
TCOL = dict(verb=(120, 170, 255), noun=(255, 206, 120), mod=(190, 160, 255), red=(255, 110, 120))
def glow_layer(lay, r=4, amt=1.6):
    g = lay.filter(ImageFilter.GaussianBlur(r)); out = Image.new('RGBA', lay.size, (0, 0, 0, 0))
    a = g.split()[3].point(lambda v: min(255, int(v*amt))); g.putalpha(a); out.alpha_composite(g); out.alpha_composite(lay); return out
def term_bg(col):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([3, 3, S-4, S-4], 10, fill=(8, 14, 22, 235), outline=tuple(int(c*0.55) for c in col) + (255,), width=2)
    for y in range(8, S-8, 4): d.line([(8, y), (S-9, y)], fill=(14, 22, 32, 255))     # faint scanlines
    return im
def word_icon_t(w, t):
    col = TCOL[t]; im = term_bg(col); lay = Image.new('RGBA', (S, S), (0, 0, 0, 0)); dl = ImageDraw.Draw(lay)
    glyph(dl, w, col + (255,), cy=50)
    f = ImageFont.truetype(MONO, 15 if len(w) > 6 else 17); txt = w + '_'; tw = f.getlength(txt); dl.text(((S - tw)/2, S - 32), txt, font=f, fill=col + (255,))
    im.alpha_composite(glow_layer(lay)); return im
def enemy_icon_t(name, label, ring):
    cell = first_cell(name); cell = cell.crop((112, 120, 272, 350)) if name == 'fern' else cell; spr = cell.crop(cell.getbbox())
    k = min(80/spr.width, 74/spr.height); spr = spr.resize((max(1, int(spr.width*k)), max(1, int(spr.height*k))), Image.LANCZOS)
    im = term_bg(ring); im.alpha_composite(spr, ((S - spr.width)//2, 10 + (78 - spr.height)//2))
    lay = Image.new('RGBA', (S, S), (0, 0, 0, 0)); f = ImageFont.truetype(MONO, 12 if len(label) > 9 else 14); tw = f.getlength(label)
    ImageDraw.Draw(lay).text(((S - tw)/2, S - 26), label, font=f, fill=ring + (255,)); im.alpha_composite(glow_layer(lay, 3)); return im
if __name__ == '__main__':
    import glob; WOOD_DK = (8, 14, 22)
    for f_ in glob.glob(IO + '*.png'): os.remove(f_)
    atlas([('icon_enemy_' + l.lower(), enemy_icon_t(n, l, r)) for n, l, r in ENEMIES], 'icons_enemies',
          'UI direction B (Terminal Poetry): name-chip icons 128 px, sprite cut from each idle sheet on dark glass, mono label (DejaVu Sans Mono) in the enemy accent.')
    atlas([('icon_word_' + w.lower(), word_icon_t(w, t)) for w, t in WORDS], 'icons_words',
          'UI direction B (Terminal Poetry): 12 unlock-word icons 128 px, glowing line glyph + mono WORD_ ; colour = word type (verb blue, noun amber, modifier/state violet, NO red).')
    print('terminal icons ok')
