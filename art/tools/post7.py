"""art-v7 post: grade each clean room plate, cut foreground overlays from the object-index pass, write per-room layout JSON
(walk/collision/exits/sign+actor anchors from the game layout + fg layers with base y), and run overlap QA.
usage: python3 post7.py   (reads ../render/rooms, writes ../out/rooms/*)"""
import json, glob, os, sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
H7 = os.path.dirname(os.path.abspath(__file__)) + '/../'; RD = H7 + 'render/rooms/'; OUT = H7 + 'out/rooms/'
os.makedirs(OUT + 'fg', exist_ok=True); os.makedirs(OUT + 'qa', exist_ok=True)
GAME = json.load(open(H7 + 'render/rooms_game.json'))
VARS = {'office': [''], 'hub': [''], 'corridor': ['dark', 'lit'], 'archive': ['H', 'L'], 'arena': [''], 'message': ['']}
GID = {'office': 'office', 'hub': 'hub', 'corridor': 'corridor', 'archive': 'archive', 'arena': 'arena', 'message': 'message'}
def grade(a):
    a = a.astype(np.float32)/255; h, w = a.shape[:2]
    lum = a.mean(2); br = np.clip((lum - 0.62)/0.38, 0, 1)[..., None]*a
    bl = np.asarray(Image.fromarray((br*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(w/90))).astype(np.float32)/255
    a = a + bl*0.55
    yy, xx = np.mgrid[0:h, 0:w]; d = np.sqrt(((xx - w/2)/(w/2))**2 + ((yy - h/2)/(h/2))**2); a *= (1 - 0.28*np.clip(d - 0.55, 0, 1)[..., None])
    a = 0.5 + (a - 0.5)*1.04
    return (np.clip(a, 0, 1)*255).astype(np.uint8)
def codeview(g):
    # hold-READ code vision: the same plate as dim teal luminance + cyan edges + every-3rd-row scanlines
    a = g.astype(np.float32)/255; lum = a.mean(2)
    e = np.asarray(Image.fromarray(g).convert('L').filter(ImageFilter.FIND_EDGES)).astype(np.float32)/255
    cy = np.array([0x78, 0xE4, 0xE8], np.float32)/255
    o = lum[..., None]*np.array([0.10, 0.28, 0.32]) + np.clip(e*3.2, 0, 1)[..., None]*cy*0.55
    o[::3] *= 0.78
    return (np.clip(o, 0, 1)*255).astype(np.uint8)
def rgba_graded(path):
    im = np.asarray(Image.open(path).convert('RGBA')); a = im[..., 3:4].astype(np.float32)/255
    # Cycles film_transparent output is premultiplied-looking at the rim; un-premultiply lightly before grading
    rgb = im[..., :3]; g = grade(rgb)
    return np.dstack([g, im[..., 3]]).astype(np.uint8)
report = []; layouts = {}
for room, states in VARS.items():
    lay = dict(GAME[GID[room]]); lay['images'] = {}; lay['fg'] = []
    for st in states:
        key = 'R7_' + room + ('_' + st if st else ''); name = room + ('_' + st if st else '')
        img = np.asarray(Image.open(RD + key + '_clean.png').convert('RGB')); g = grade(img)
        Image.fromarray(g).save(OUT + name + '.jpg', quality=90); lay['images'][st or 'base'] = 'rooms/' + name + '.jpg'
        Image.fromarray(codeview(g)).save(OUT + name + '_code.jpg', quality=88); lay.setdefault('code', {})[st or 'base'] = 'rooms/' + name + '_code.jpg'
        idx = np.asarray(Image.open(sorted(glob.glob(RD + key + 'C_index_*.png'))[-1])).astype(np.float32); idx = np.round(idx/(65535.0 if idx.max() > 255 else 255.0)*255).astype(np.int32)
        meta = json.load(open(RD + key + '_actors.json'))['extra'].get('fg', [])
        if st not in ('', states[0]): continue   # fg overlays come from the first state (identical props)
        for f in meta:
            fp = RD + key + '_fg_' + f['name'] + '.png'
            if os.path.exists(fp):          # anti-aliased layer from its own alpha pass (FGPASS)
                rgba = rgba_graded(fp); ys, xs = np.nonzero(rgba[..., 3] > 6)
                if len(xs) < 30: report.append('WARN %s fg %s empty alpha pass' % (key, f['name'])); continue
                x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
                fn = 'rooms/fg/%s_%s.png' % (room, f['name']); Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA').save(OUT + 'fg/%s_%s.png' % (room, f['name']))
                lay['fg'].append(dict(file=fn, x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0), baseY=f['base_y'], name=f['name'])); continue
            m = idx == f['idx']
            if m.sum() < 30: report.append('WARN %s fg %s has only %d px' % (key, f['name'], m.sum())); continue
            m = np.asarray(Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.7)))
            ys, xs = np.nonzero(m > 8); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            rgba = np.dstack([g, m]).astype(np.uint8)[y0:y1, x0:x1]
            fn = 'rooms/fg/%s_%s.png' % (room, f['name']); Image.fromarray(rgba, 'RGBA').save(OUT + 'fg/%s_%s.png' % (room, f['name']))
            lay['fg'].append(dict(file=fn, x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0), baseY=f['base_y'], name=f['name']))
    if room == 'archive':                   # bridge lowering frames (00 = up ... N-1 = down), one shared crop box
        fr = sorted(glob.glob(RD + 'R7_bridge_*.png')); ims = [rgba_graded(f) for f in fr]
        al = np.max([i[..., 3] for i in ims], 0); ys, xs = np.nonzero(al > 6); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        lay['bridge'] = dict(x=int(x0), y=int(y0), frames=[])
        for k, im in enumerate(ims):
            Image.fromarray(im[y0:y1, x0:x1], 'RGBA').save(OUT + 'fg/bridge_%02d.png' % k); lay['bridge']['frames'].append('rooms/fg/bridge_%02d.png' % k)
    layouts[room] = lay
    # ---------- QA ----------
    ref = np.asarray(Image.open(OUT + room + ('_' + states[-1] if states[-1] else '') + '.jpg').convert('RGB')).astype(np.int32)
    qa = Image.fromarray(ref.astype(np.uint8)).convert('RGBA'); dr = ImageDraw.Draw(qa, 'RGBA')
    for w_ in lay.get('walk', []): dr.rectangle([w_['x'], w_['y'], w_['x'] + w_['w'], w_['y'] + w_['h']], outline=(80, 255, 120, 200))
    for s_ in lay.get('walls', []): dr.rectangle([s_['x'], s_['y'], s_['x'] + s_['w'], s_['y'] + s_['h']], outline=(255, 80, 80, 220))
    boxes = []
    for p in GAME[GID[room]].get('plates', []):
        sx, sy = p.get('sx', p['x']), p.get('sy', p['y']); txt = ' '.join(p.get('words', [])) or 'X IS Y'
        w = 26 + 13*len(txt); h = 34; b = (sx - w/2, sy - h/2, sx + w/2, sy + h/2); boxes.append((p['id'], b))
        dr.rectangle(b, outline=(255, 200, 60, 255), width=2)
        # mounted? the pixel under the sign centre must not be void (very dark background)
        if not (0 <= sx < 1280 and 0 <= sy < 720): report.append('FAIL %s sign %s off-screen' % (room, p['id'])); continue
        if ref[int(sy), int(sx)].sum() < 40: report.append('WARN %s sign %s sits over void/very dark (%s)' % (room, p['id'], ref[int(sy), int(sx)].tolist()))
        if b[1] < 56: report.append('WARN %s sign %s under the HUD bar' % (room, p['id']))
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a, b = boxes[i][1], boxes[j][1]
            if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]: report.append('FAIL %s signs overlap: %s / %s' % (room, boxes[i][0], boxes[j][0]))
    for f in lay['fg']:
        dr.rectangle([f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']], outline=(120, 200, 255, 160)); dr.line([f['x'], f['baseY'], f['x'] + f['w'], f['baseY']], fill=(120, 200, 255, 255), width=2)
    qa.convert('RGB').save(OUT + 'qa/%s_qa.png' % room)
json.dump(layouts, open(OUT + 'layout7.json', 'w'), indent=1)
print('\n'.join(report) or 'QA clean'); print('rooms', list(layouts))
