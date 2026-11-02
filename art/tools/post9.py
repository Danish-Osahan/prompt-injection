"""art-v9 post for the OFFICE test level (R9_office renders in ../render/rooms9):
grade the parallax layers (back = opaque wall/window plane, mid = floor+props with the wall held out), cut fg/near overlays,
pack ambient strips, cut the swap variants into small overlay crops (per connected change region, per layer), grade the
inspect close-ups (+ their code-vision versions), and write the view data (floor homography, sprite scale, anchors).
Then copies everything into the game and writes game/src/office9art.ts.  usage: python3 post9.py"""
import json, glob, os, shutil
import numpy as np
from PIL import Image, ImageFilter
H = os.path.dirname(os.path.abspath(__file__)) + '/../'; RD = H + 'render/rooms9/'; OUT = H + 'out/office9/'; G = H + '../game/'
DST = G + 'public/assets/office9/'
for d in (OUT, OUT + 'fg', OUT + 'amb', OUT + 'var', OUT + 'close', DST, DST + 'fg', DST + 'amb', DST + 'var', DST + 'close'): os.makedirs(d, exist_ok=True)
def grade(a, vig=0.28, lift=1.0):
    a = a.astype(np.float32)/255; h, w = a.shape[:2]
    lum = a.mean(2); br = np.clip((lum - 0.62)/0.38, 0, 1)[..., None]*a
    bl = np.asarray(Image.fromarray((br*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(w/90))).astype(np.float32)/255
    a = a + bl*0.55
    # art-v9 noir: deeper teal shadows, warm highlights kept, a touch more contrast
    sh = np.clip(1 - lum*2.2, 0, 1)[..., None]; a = a*(1 - 0.10*sh) + np.array([0.0, 0.012, 0.022])*sh
    yy, xx = np.mgrid[0:h, 0:w]; d = np.sqrt(((xx - w/2)/(w/2))**2 + ((yy - h/2)/(h/2))**2); a *= (1 - vig*np.clip(d - 0.55, 0, 1)[..., None])
    a = 0.5 + (a*lift - 0.5)*1.07
    return (np.clip(a, 0, 1)*255).astype(np.uint8)
def codeview(g):
    a = g.astype(np.float32)/255; lum = a.mean(2)
    e = np.asarray(Image.fromarray(g).convert('L').filter(ImageFilter.FIND_EDGES)).astype(np.float32)/255
    cy = np.array([0x78, 0xE4, 0xE8], np.float32)/255
    o = lum[..., None]*np.array([0.10, 0.28, 0.32]) + np.clip(e*3.2, 0, 1)[..., None]*cy*0.55
    o[::3] *= 0.78
    return (np.clip(o, 0, 1)*255).astype(np.uint8)
def rgba(path, **kw):
    im = np.asarray(Image.open(path).convert('RGBA')); return np.dstack([grade(im[..., :3], **kw), im[..., 3]]).astype(np.uint8)
def save(arr, rel, q=88):
    p = OUT + rel; im = Image.fromarray(arr)
    if rel.endswith('.webp'): im.save(p, quality=q, method=6)
    elif rel.endswith('.jpg'): im.convert('RGB').save(p, quality=q)
    else: im.save(p, optimize=True)
    shutil.copy(p, DST + rel); return 'office9/' + rel
meta = json.load(open(RD + 'R9_office_actors.json'))['extra']; V = meta['view']; lay = dict(view=V, fg=[], amb=[], var=[], close={})
clean = np.asarray(Image.open(RD + 'R9_office_clean.png').convert('RGB')); gc = grade(clean)
lay['full'] = save(gc, 'office9_full.jpg'); lay['code'] = save(codeview(gc), 'office9_code.jpg')
back = grade(np.asarray(Image.open(RD + 'R9_office_L_back.png').convert('RGB'))); lay['back'] = save(back, 'office9_back.jpg', 90)
mid = rgba(RD + 'R9_office_L_mid.png'); lay['mid'] = save(mid, 'office9_mid.webp', 90)
# fg overlays (desk groups depth-sorted against Noor by base y) and the near layer (always over Noor, parallax)
for f in meta.get('fg', []):
    fp = RD + 'R9_office_fg_' + f['name'] + '.png'
    if not os.path.exists(fp): continue
    a = rgba(fp); ys, xs = np.nonzero(a[..., 3] > 6)
    if len(xs) < 30: continue
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    lay['fg'].append(dict(name=f['name'], file=save(a[y0:y1, x0:x1], 'fg/%s.png' % f['name']), x=int(x0) - V['off'][0], y=int(y0) - V['off'][1], baseY=f['base_y']))
for am in meta.get('amb', []):
    fr = [RD + 'R9_office_amb_%s_%02d.png' % (am['name'], k) for k in range(am['frames'])]
    if not all(os.path.exists(f) for f in fr): continue
    ims = [rgba(f) for f in fr]; al = np.max([i[..., 3] for i in ims], 0); ys, xs = np.nonzero(al > 4)
    if len(xs) < 10: continue
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1; w, h = x1 - x0, y1 - y0
    strip = np.zeros((h, w*len(ims), 4), np.uint8)
    for k, im in enumerate(ims): strip[:, k*w:(k + 1)*w] = im[y0:y1, x0:x1]
    lay['amb'].append(dict(name=am['name'], file=save(strip, 'amb/%s.png' % am['name']), x=int(x0) - V['off'][0], y=int(y0) - V['off'][1], w=int(w), h=int(h), frames=am['frames'], fps=am['fps'], baseY=am['base_y']))
# swap variants: per layer, per connected change region -> small RGBA crops over the base layer
def regions(a, b, alpha=None):
    """connected change regions (no scipy: label on an 8px grid, then exact masks inside each box)"""
    d = np.abs(a.astype(np.int32) - b.astype(np.int32)).sum(2) > 18
    if alpha is not None: d &= alpha > 8
    m = np.asarray(Image.fromarray((d*255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(13))) > 0
    h, w = m.shape; S = 8; gh, gw = (h + S - 1)//S, (w + S - 1)//S
    g = np.zeros((gh, gw), bool)
    for y in range(gh):
        for x in range(gw): g[y, x] = m[y*S:(y + 1)*S, x*S:(x + 1)*S].any()
    seen = np.zeros_like(g); out = []
    for y in range(gh):
        for x in range(gw):
            if not g[y, x] or seen[y, x]: continue
            st = [(y, x)]; seen[y, x] = True; cells = []
            while st:
                cy, cx = st.pop(); cells.append((cy, cx))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < gh and 0 <= nx < gw and g[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; st.append((ny, nx))
            ys = [c[0] for c in cells]; xs = [c[1] for c in cells]
            sl = (slice(min(ys)*S, min(h, (max(ys) + 1)*S)), slice(min(xs)*S, min(w, (max(xs) + 1)*S)))
            mm = np.zeros_like(m); mm[sl] = m[sl]
            if mm.sum() >= 120: out.append((sl, mm))
    return out
mid_rgb = mid[..., :3]
for v in ('toys', 'flip', 'claim'):
    for L in ('back', 'mid'):
        fp = RD + 'R9_office_V_%s_%s.png' % (v, L)
        if not os.path.exists(fp): continue
        if L == 'back': va = grade(np.asarray(Image.open(fp).convert('RGB'))); base = back; al = None
        else: va4 = rgba(fp); va = va4[..., :3]; base = mid_rgb; al = va4[..., 3]
        for k, (sl, m) in enumerate(regions(va, base, al)):
            soft = np.asarray(Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))).astype(np.float32)
            if al is not None: soft = soft*(al/255.0)
            crop = np.dstack([va, soft.astype(np.uint8)])[sl]
            lay['var'].append(dict(v=v, layer=L, file=save(crop, 'var/%s_%s_%d.png' % (v, L, k)), x=int(sl[1].start) - V['off'][0], y=int(sl[0].start) - V['off'][1], w=int(crop.shape[1]), h=int(crop.shape[0])))
# inspect close-ups: moodier grade (heavier vignette, lower lift) + code-vision version
for fp in sorted(glob.glob(RD + 'R9_close_*.png')):
    nm = os.path.basename(fp)[9:-4]; g = grade(np.asarray(Image.open(fp).convert('RGB')), vig=0.75, lift=0.88)
    lay['close'][nm] = dict(img=save(g, 'close/%s.jpg' % nm, 90), code=save(codeview(g), 'close/%s_code.jpg' % nm, 85))
json.dump(lay, open(OUT + 'layout9.json', 'w'), indent=1)
open(G + 'src/office9art.ts', 'w').write('// generated by art/tools/post9.py from art/out/office9/layout9.json (art-v9 office: perspective layers, variants, close-ups)\n'
    'export interface View9 { H: number[][]; Hinv: number[][]; scale: number[]; anchors: Record<string, number[]>; window: number[][]; size: number[]; off: number[]; elev: number; lens: number; [k: string]: unknown }\n'
    'export interface Office9 { view: View9; full: string; code: string; back: string; mid: string;\n'
    '  fg: { name: string; file: string; x: number; y: number; baseY: number }[];\n'
    '  amb: { name: string; file: string; x: number; y: number; w: number; h: number; frames: number; fps: number; baseY: number }[];\n'
    '  var: { v: string; layer: string; file: string; x: number; y: number; w: number; h: number }[];\n'
    '  close: Record<string, { img: string; code: string }> }\n'
    'export const OFFICE9: Office9 = ' + json.dumps({k: lay[k] for k in ('view', 'full', 'code', 'back', 'mid', 'fg', 'amb', 'var', 'close')}, indent=1) + ';\n')
print('post9 ok: fg %d amb %d var %d close %d' % (len(lay['fg']), len(lay['amb']), len(lay['var']), len(lay['close'])))
