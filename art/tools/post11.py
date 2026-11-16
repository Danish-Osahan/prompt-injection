"""art-v11 clarity post for the office (reads ../render/rooms11 from office11.py):
 - grade a fresh R7_office_clean.png into office.jpg + office_code.jpg and rebuild office_bleed.jpg
 - depth-sort overlays cut from the GAME's full-bleed office plate with the per-prop index pass
 - plant masks stay tight (no blur/halo) so edges match the plate
 - collision footprints + overlay base y -> game/src/office11art.ts
 - lift door frames: graded delta over the game plate (frame 0 == the plate)
 - practice dummy sprite (graded alpha pass)
usage: python3 post11.py"""
import json, os, glob
import numpy as np
from PIL import Image, ImageFilter
H = os.path.dirname(os.path.abspath(__file__)) + '/../'; RD = H + 'render/rooms11/'; G = H + '../game/'; DST = G + 'public/assets/office11/'; OUT = H + 'out/office11/'
ROOMS = G + 'public/assets/rooms/'
for d in (DST + 'fg', DST + 'door', OUT + 'fg', OUT + 'door'): os.makedirs(d, exist_ok=True)
def grade(a):   # = post7.grade (the room plate grade)
    a = a.astype(np.float32)/255; h, w = a.shape[:2]
    lum = a.mean(2); br = np.clip((lum - 0.62)/0.38, 0, 1)[..., None]*a
    bl = np.asarray(Image.fromarray((br*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(w/90))).astype(np.float32)/255
    a = a + bl*0.55
    yy, xx = np.mgrid[0:h, 0:w]; d = np.sqrt(((xx - w/2)/(w/2))**2 + ((yy - h/2)/(h/2))**2); a *= (1 - 0.28*np.clip(d - 0.55, 0, 1)[..., None])
    a = 0.5 + (a - 0.5)*1.04
    return np.clip(a, 0, 1)*255
def codeview(g):
    a = g.astype(np.float32)/255; lum = a.mean(2)
    e = np.asarray(Image.fromarray(g.astype(np.uint8)).convert('L').filter(ImageFilter.FIND_EDGES)).astype(np.float32)/255
    cy = np.array([0x78, 0xE4, 0xE8], np.float32)/255
    o = lum[..., None]*np.array([0.10, 0.28, 0.32]) + np.clip(e*3.2, 0, 1)[..., None]*cy*0.55
    o[::3] *= 0.78
    return (np.clip(o, 0, 1)*255).astype(np.uint8)
def find_frame(im):
    gray = im.mean(2); h, w = gray.shape
    corners = np.concatenate([gray[:10, :10].ravel(), gray[:10, -10:].ravel(), gray[-10:, :10].ravel(), gray[-10:, -10:].ravel()])
    bg = float(np.median(corners))
    def row_is_frame(y):
        r = gray[y].astype(np.float32)
        return (np.abs(r - bg) < 9).mean() > 0.90 and r.std() < 9
    def col_is_frame(x):
        c = gray[:, x].astype(np.float32)
        return (np.abs(c - bg) < 9).mean() > 0.90 and c.std() < 9
    t = 0
    while t < h // 3 and row_is_frame(t): t += 1
    b = h - 1
    while b > (2 * h) // 3 and row_is_frame(b): b -= 1
    l = 0
    while l < w // 3 and col_is_frame(l): l += 1
    r = w - 1
    while r > (2 * w) // 3 and col_is_frame(r): r -= 1
    if b >= h - 8:
        for y in range(h - 1, (2 * h) // 3, -1):
            if gray[y].mean() < 16: b = y - 1
            else: break
    return t, b, l, r, bg
def _fill_edge(out, y0, y1, x0, x1, color, toward='out', fade=0.18, rng=None):
    if y1 <= y0 or x1 <= x0: return
    yy, xx = np.mgrid[y0:y1, x0:x1]
    if toward == 'up': t = (y1 - 1 - yy) / max(1, y1 - y0)
    elif toward == 'down': t = (yy - y0) / max(1, y1 - y0)
    elif toward == 'left': t = (x1 - 1 - xx) / max(1, x1 - x0)
    else: t = (xx - x0) / max(1, x1 - x0)
    col = color * (1 - fade * t[..., None])
    grain = rng.normal(0, 1.2, col.shape).astype(np.float32)
    out[y0:y1, x0:x1] = np.clip(col + grain, 0, 255)
def extend_letterbox(im, t, b, l, r):
    out = im.copy().astype(np.float32); h, w = im.shape[:2]; band = 6; rng = np.random.default_rng(7)
    def med(sample):
        pix = sample.reshape(-1, 3).astype(np.float32)
        return np.median(pix, axis=0) if len(pix) >= 4 else np.array([16, 14, 12], np.float32)
    if t > 0: _fill_edge(out, 0, t, l, r + 1, med(im[t:t + band, l:r + 1]), 'up', rng=rng)
    if b < h - 1: _fill_edge(out, b + 1, h, l, r + 1, med(im[max(0, b - band + 1):b + 1, l:r + 1]), 'down', rng=rng)
    if l > 0: _fill_edge(out, t, b + 1, 0, l, med(im[t:b + 1, l:l + band]), 'left', rng=rng)
    if r < w - 1: _fill_edge(out, t, b + 1, r + 1, w, med(im[t:b + 1, max(0, r - band + 1):r + 1]), 'right', rng=rng)
    if t > 0 and l > 0: _fill_edge(out, 0, t, 0, l, med(im[t:t + band, l:l + band]), 'up', rng=rng)
    if t > 0 and r < w - 1: _fill_edge(out, 0, t, r + 1, w, med(im[t:t + band, max(0, r - band + 1):r + 1]), 'up', rng=rng)
    if b < h - 1 and l > 0: _fill_edge(out, b + 1, h, 0, l, med(im[max(0, b - band + 1):b + 1, l:l + band]), 'down', rng=rng)
    if b < h - 1 and r < w - 1: _fill_edge(out, b + 1, h, r + 1, w, med(im[max(0, b - band + 1):b + 1, max(0, r - band + 1):r + 1]), 'down', rng=rng)
    seam = np.zeros((h, w), np.uint8)
    if t > 0: seam[max(0, t - 3):t + 3, :] = 255
    if b < h - 1: seam[b - 2:min(h, b + 4), :] = 255
    if l > 0: seam[:, max(0, l - 3):l + 3] = 255
    if r < w - 1: seam[:, r - 2:min(w, r + 4)] = 255
    if seam.max():
        blur = np.asarray(Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))).astype(np.float32)
        out = np.where(seam[..., None] == 255, blur, out)
    return np.clip(out, 0, 255).astype(np.uint8)
def save(arr, rel, mode='RGBA'):
    Image.fromarray(arr.astype(np.uint8), mode).save(OUT + rel, optimize=True); Image.fromarray(arr.astype(np.uint8), mode).save(DST + rel, optimize=True); return 'office11/' + rel

# Prefer the rooms11 beauty pass from this same O11 run; fall back to the older rooms/ plate.
clean_path = RD + 'R7_office_clean.png' if os.path.exists(RD + 'R7_office_clean.png') else H + 'render/rooms/R7_office_clean.png'
raw_full = np.asarray(Image.open(clean_path).convert('RGB')).astype(np.float32)
graded = grade(raw_full).astype(np.uint8)
Image.fromarray(graded).save(ROOMS + 'office.jpg', quality=90)
Image.fromarray(codeview(graded)).save(ROOMS + 'office_code.jpg', quality=88)
ft, fb, fl, fr, _bg = find_frame(graded)
bleed = extend_letterbox(graded, ft, fb, fl, fr)
Image.fromarray(bleed).save(ROOMS + 'office_bleed.jpg', quality=90)
print('graded office plate + bleed', 'frame', ft, fb, fl, fr, 'from', clean_path)
# Reload the JPEGs so fg overlays match the compressed pixels the game displays.
plate = np.asarray(Image.open(ROOMS + 'office_bleed.jpg').convert('RGB'))
meta = json.load(open(RD + 'R7_office_o11.json'))['groups']
idx = np.asarray(Image.open(glob.glob(RD + 'o11_index_*.png')[0])).astype(np.float32); idx = np.round(idx/(65535.0 if idx.max() > 255 else 255.0)*255).astype(np.int32)
NICE = {'k_kitchenCabinet': 'kitchen', 'k_bookcaseClosedWide': 'bookcase', 'k_coatRackStanding': 'coatrack', 'k_sideTableDrawers': 'printer', 'k_desk': 'desk_dez', 'k_chairDesk': 'chair_dez',
        'k_desk.001': 'desk_kabir', 'k_chairDesk.001': 'chair_kabir', 'k_desk.002': 'desk_noor', 'k_cardboardBoxClosed': 'box1', 'k_cardboardBoxOpen': 'box2', 'k_desk.003': 'desk_mug', 'k_chairDesk.002': 'chair_mug',
        'k_desk.004': 'desk_podW', 'k_chairDesk.003': 'chair_podW', 'k_desk.005': 'desk_podE', 'k_chairDesk.004': 'chair_podE', 'k_tableRound': 'table', 'k_chair': 'chair_nookW', 'k_chair.001': 'chair_nookE',
        'k_pottedPlant': 'plantW', 'k_plantSmall2': 'plantE', 'k_trashcan': 'bin', 'k_lampSquareFloor': 'floorlamp', 'k_pottedPlant.001': 'plantFG'}
# Soft MaxFilter+blur fringes plants (and thin props) against the plate. Plants use the raw index;
# everything else keeps a 1px dilate and no blur so AA is covered without a halo.
TIGHT = {'plantW', 'plantE', 'plantFG'}
props = []
for g in meta:
    nm = NICE.get(g['name'], g['name'].replace('k_', '').replace('.', '_')); m = (idx == g['idx'])
    poly = [[round(x), round(y)] for x, y in g['poly']]
    e = dict(name=nm, poly=poly, baseY=round(g['baseY']))
    if m.sum() > 30:
        hard = (m*255).astype(np.uint8)
        if nm in TIGHT:
            mm = hard
        else:
            mm = np.asarray(Image.fromarray(hard).filter(ImageFilter.MaxFilter(3)))
        ys, xs = np.nonzero(mm > 8); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        e.update(fg=save(np.dstack([plate, mm])[y0:y1, x0:x1], 'fg/%s.png' % nm), x=int(x0), y=int(y0))
    props.append(e)
# chair_noor is a runtime-only extra (reuses chair_dez art) — keep it across regenerations.
if not any(p.get('name') == 'chair_noor' for p in props):
    i = next((k for k, p in enumerate(props) if p.get('name') == 'desk_noor'), len(props) - 1) + 1
    props.insert(i, dict(name='chair_noor', poly=[[979, 541], [989, 516], [1031, 523], [1021, 548]], baseY=548, fg='office11/fg/chair_dez.png', x=966, y=475))
# lift door: frame k = plate + grade(raw with frame k) - grade(raw with frame 0), in the render border box
raw = raw_full
bx0, by0, bx1, by1 = 112, 62, 308, 358
frs = sorted(glob.glob(RD + 'o11_door_*.png')); base = None; door = []
for k, f in enumerate(frs):
    a = raw.copy(); a[by0:by1, bx0:bx1] = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)[by0:by1, bx0:bx1]
    gr = grade(a)[by0:by1, bx0:bx1]
    if base is None: base = gr
    hh, ww = gr.shape[:2]; yy, xx = np.mgrid[0:hh, 0:ww]
    fe = np.clip(np.minimum.reduce([xx, ww - 1 - xx, yy, hh - 1 - yy]) / 34.0, 0, 1); fe = (fe*fe*(3 - 2*fe))[..., None]   # feather: no hard box edge on the light spill
    out = np.clip(plate[by0:by1, bx0:bx1].astype(np.float32) + (gr - base)*fe, 0, 255)
    door.append(save(out, 'door/lift_%02d.jpg' % k, 'RGB'))
# dummy
d = np.asarray(Image.open(RD + 'o11_dummy.png').convert('RGBA')).astype(np.float32); al = d[..., 3:4]/255
rgb = grade(np.where(al > 0, d[..., :3]/np.maximum(al, 1e-3), 0))
ys, xs = np.nonzero(d[..., 3] > 6); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
dj = json.load(open(RD + 'R7_office_o11_dummy.json'))['dummy']
dum = save(np.dstack([rgb, d[..., 3]])[y0:y1, x0:x1], 'dummy.png')
ts = ('// generated by art/tools/post11.py (art-v11 clarity office: footprints, depth overlays, lift frames, practice dummy; renders by office11.py)\n'
      'export interface O11Prop { name: string; poly: number[][]; baseY: number; fg?: string; x?: number; y?: number }\n'
      'export const O11_PROPS: O11Prop[] = ' + json.dumps(props) + ';\n'
      'export const O11_DOOR = ' + json.dumps(dict(x=bx0, y=by0, frames=door)) + ';\n'
      'export const O11_DUMMY = ' + json.dumps(dict(img=dum, x=dj['x'], y=dj['y'], ox=int(dj['x'] - x0), oy=int(dj['y'] - y0))) + ';\n')
open(G + 'src/office11art.ts', 'w').write(ts); print('post11 ok', len(props), 'props', len(door), 'door frames')
