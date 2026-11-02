"""art-v12: 2x close-up previews of Noor's new attacks. For each animation: a contact sheet PNG (rows S, E, N, W; every frame with its
duration, events, smear and hit-stop marked) and a looping GIF at real timing (hit-stop included), S/E/N/W side by side.
usage: python3 closeups12.py [SHEETDIR] [OUTDIR]   (defaults: ../out/sprites12 -> ../../mock-attack/closeups)"""
import os, sys, json
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '../out/sprites12')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, '../../mock-attack/closeups'); os.makedirs(OUT, exist_ok=True)
FONT = os.path.join(HERE, '../../game/public/assets/fonts/IBMPlexMono-Medium.ttf')
f14, f18 = ImageFont.truetype(FONT, 14), ImageFont.truetype(FONT, 18)
T = json.load(open(os.path.join(SRC, 'noor_attacks12.json')))['anims']
ROWS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']; SHOW = ['S', 'E', 'N', 'W']
CX0, CY0, CW, CH = 26, 22, 140, 162; Z = 2      # crop of the 192 cell (feet at 96,160), shown at 2x
SETS = {'combo': ['combo1', 'combo2', 'combo3'], 'peel': ['peel'], 'throw': ['throw'], 'beam': ['charge_in', 'charge_hold', 'charge_hold', 'release']}
sheets = {an: Image.open(os.path.join(SRC, 'noor_%s.png' % an)).convert('RGBA') for an in T}
def cell(an, dn, k):
    r = ROWS.index(dn); im = sheets[an].crop((k*192 + CX0, r*192 + CY0, k*192 + CX0 + CW, r*192 + CY0 + CH))
    return im.resize((CW*Z, CH*Z), Image.NEAREST)
def bg(w, h):
    im = Image.new('RGBA', (w, h), (16, 24, 32, 255)); d = ImageDraw.Draw(im)
    for y in range(0, h, 32): d.line([0, y, w, y], fill=(22, 32, 42))
    for x in range(0, w, 32): d.line([x, 0, x, h], fill=(22, 32, 42))
    return im
def tags(an, k):
    t = T[an]; s = []
    if str(k) in map(str, t['events']): s.append(t['events'][str(k)].upper() if str(k) in t['events'] else t['events'][k].upper())
    if k in t['smear']: s.append('SMEAR')
    hs = t['hitstop_ms'].get(str(k), t['hitstop_ms'].get(k)) if t['hitstop_ms'] else None
    if hs: s.append('+%dms STOP' % hs)
    return s
for name, lst in SETS.items():
    seq = [(an, k) for an in lst for k in range(T[an]['frames'])]
    # ---- contact sheet (unique frames only: charge_hold once) ----
    uniq = []; [uniq.append(x) for x in seq if x not in uniq]
    cols = min(len(uniq), 11); rws = (len(uniq) + cols - 1)//cols
    W = cols*CW*Z; Hh = 40 + rws*len(SHOW)*(CH*Z) + rws*34
    sheet = bg(W, Hh); d = ImageDraw.Draw(sheet)
    d.text((10, 10), 'NOOR %s  (art-v12, 2x, rows %s)  frame / ms / events' % (' > '.join(lst).upper(), ' '.join(SHOW)), font=f18, fill=(240, 200, 150))
    for i, (an, k) in enumerate(uniq):
        bx = (i % cols)*CW*Z; by0 = 40 + (i//cols)*(len(SHOW)*CH*Z + 34)
        d.text((bx + 6, by0 + 4), '%s %d  %dms' % (an, k, T[an]['dur_ms'][k]), font=f14, fill=(200, 230, 235))
        tg = tags(an, k)
        if tg: d.text((bx + 6, by0 + 18), ' '.join(tg), font=f14, fill=(255, 140, 120) if any('HIT' in x or 'RELEASE' in x or 'PEEL' in x or 'PINCH' in x for x in tg) else (150, 220, 160))
        for j, dn in enumerate(SHOW):
            sheet.alpha_composite(cell(an, dn, k), (bx, by0 + 34 + j*CH*Z))
            if i % cols == 0: d.text((bx + 4, by0 + 34 + j*CH*Z + 4), dn, font=f14, fill=(120, 200, 210))
    sheet.convert('RGB').save(os.path.join(OUT, 'noor_%s_contact.png' % name), optimize=True)
    # ---- GIF at real timing (hit-stop added to the contact frame), S/E/N/W side by side ----
    frames, durs = [], []
    for an, k in seq:
        im = bg(len(SHOW)*CW*Z, CH*Z + 40); d = ImageDraw.Draw(im)
        for j, dn in enumerate(SHOW):
            im.alpha_composite(cell(an, dn, k), (j*CW*Z, 40)); d.text((j*CW*Z + 6, 44), dn, font=f14, fill=(120, 200, 210))
        tg = tags(an, k)
        d.text((10, 10), 'NOOR %s  f%d  %s' % (an.upper(), k, ' '.join(tg)), font=f18, fill=(255, 140, 120) if tg else (240, 200, 150))
        hs = T[an]['hitstop_ms'].get(str(k), 0) if T[an]['hitstop_ms'] else 0
        frames.append(im.convert('RGB')); durs.append(T[an]['dur_ms'][k] + (hs or 0))
    durs[-1] += 500   # pause before the loop restarts
    pal = frames[len(frames)//2].quantize(200, method=Image.Quantize.MEDIANCUT)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
    q[0].save(os.path.join(OUT, 'noor_%s_2x.gif' % name), save_all=True, append_images=q[1:], duration=durs, loop=0, optimize=True)
    print('closeup', name, len(seq), 'frames', sum(durs), 'ms')
