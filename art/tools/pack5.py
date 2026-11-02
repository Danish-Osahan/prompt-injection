# art-v5: pack rendered frames (2x) into sprite sheets (PNG + Phaser JSON-hash atlas) + GIF previews.
# Same format as v4: 192 px cells, rows = directions, cols = frames, foot pivot (96,160), names <char>_<anim>_<DIR>_<NN>.
# v5 bakes the in-sprite treatment that the mocks also get: gentle emissive glow + a 1 px soft indigo outline
# (so sprites match the mocks in-engine with no shader), hurt flash + death fade for enemies.
# usage: python3 pack5.py [noor] [autocomplete ...]   (default: everything found in ../render/sprites)
import os, sys, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from anim_table import anims_for, DIRS_FOR, SHADOW, ATTACK_TELL, HIT_FRAME, EXTRA_TELL
SRC = os.path.join(HERE, '../render/sprites'); OUT = os.path.join(HERE, '../out/sprites'); os.makedirs(OUT, exist_ok=True)
FRAME = int(os.environ.get('PACK_FRAME', 192)); PIVOT = (FRAME//2, FRAME - 32*FRAME//192*1 if FRAME == 192 else FRAME - 48)
KFN = '/workspace/games/_downloads/ui-pack/Font/Kenney Future Narrow.ttf'
OUTLINE_RGB = (12, 14, 30); OUTLINE_A = 0.80     # keep in sync with post5.py (mocks) and README shader notes

def down(im, size):
    a = np.asarray(im.convert('RGBA')).astype(np.float32)/255
    rgb = a[..., :3]*a[..., 3:4]
    ch = [np.asarray(Image.fromarray(rgb[..., i]).resize(size, Image.LANCZOS)) for i in range(3)] + [np.asarray(Image.fromarray(a[..., 3]).resize(size, Image.LANCZOS))]
    r = np.stack(ch, -1); al = np.clip(r[..., 3:4], 0, 1)
    return np.concatenate([np.clip(r[..., :3], 0, None), al], -1)   # premultiplied float RGBA

def gblur(x, r):
    """separable gaussian on a float32 2-D array (Pillow cannot blur mode 'F')"""
    k = np.arange(-int(3*r), int(3*r)+1, dtype=np.float32); k = np.exp(-k*k/(2*r*r)); k /= k.sum()
    y = np.apply_along_axis(lambda v: np.convolve(v, k, mode='same'), 0, x.astype(np.float32))
    return np.apply_along_axis(lambda v: np.convolve(v, k, mode='same'), 1, y)
def maxf(x, n=3): return np.asarray(Image.fromarray((x*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(n))).astype(np.float32)/255

def treat(p, flash=0.0, fade=1.0, glow=(0.86, 0.40, 3)):
    """p: premultiplied RGBA float. glow -> outline -> flash -> fade. Returns premultiplied."""
    al = p[..., 3:4]; col = np.where(al > 1e-4, p[..., :3]/np.maximum(al, 1e-4), 0)
    thr, amt, rad = glow
    lum = col.max(2)*al[..., 0]; m = np.clip((lum-thr)/(1-thr), 0, 1)
    gl = np.stack([gblur(col[..., i]*m, rad) for i in range(3)] + [gblur(m, rad)], -1)*amt
    rgb = p[..., :3] + gl[..., :3]; a = np.clip(al + gl[..., 3:4]*0.6, 0, 1)
    # 1 px outline (dilated alpha minus alpha), composited UNDER the sprite
    hard = np.clip(al[..., 0]*1.6, 0, 1); ring = np.clip(maxf(hard) - hard, 0, 1)[..., None]*OUTLINE_A
    ring = ring*(1-a)
    rgb = rgb + np.array(OUTLINE_RGB, np.float32)/255*ring; a = a + ring
    if flash:   # hurt flash (premultiplied mix toward white on the body only)
        rgb = rgb*(1-flash) + a*flash
    return np.concatenate([rgb*fade, a*fade], -1)

def to_img(p):
    al = p[..., 3:4]; col = np.where(al > 1e-4, p[..., :3]/np.maximum(al, 1e-4), 0)
    return Image.fromarray((np.clip(np.concatenate([col, al], -1), 0, 1)*255).astype(np.uint8), 'RGBA')

def shadow(name, fade=1.0):
    hw, hh, alpha = SHADOW[name]; s = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0)); d = ImageDraw.Draw(s)
    cx, cy = PIVOT; d.ellipse([cx-hw, cy-hh, cx+hw, cy+hh], fill=(6, 8, 20, int(alpha*fade)))
    return s.filter(ImageFilter.GaussianBlur(5))

def backdrop(w, h):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    a = np.zeros((h, w, 3), np.float32) + np.array([18, 28, 38])
    a += np.exp(-(((xx-w*0.35)/(w*0.6))**2 + ((yy-h*0.6)/(h*0.7))**2))[..., None]*np.array([10, 18, 20])
    im = Image.fromarray(a.astype(np.uint8)); d = ImageDraw.Draw(im)
    for x in range(0, w, 48): d.line([x, 0, x, h], fill=(24, 36, 46))
    for y in range(0, h, 48): d.line([0, y, w, y], fill=(24, 36, 46))
    return im.convert('RGBA')

def shared_palette(frames, colours=160):
    """one palette for the whole GIF (lets the encoder store only changed pixels between frames -> ~5x smaller)"""
    w, h = frames[0].size; strip = Image.new('RGB', (w, h*min(len(frames), 6)))
    for i, f in enumerate(frames[::max(1, len(frames)//6)][:6]): strip.paste(f, (0, i*h))
    pal = strip.quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    return [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]

FLASH = {0: 0.45, 1: 0.15}
DEATH_FADE = [1.0, 1.0, 0.92, 0.72, 0.45, 0.18]

def pack(name):
    anims = anims_for(name); dirs = DIRS_FOR[name]; tiles = {}
    for an, (n, fps) in anims.items():
        sheet = Image.new('RGBA', (FRAME*n, FRAME*len(dirs)), (0, 0, 0, 0)); fr = {}
        for r, dn in enumerate(dirs):
            for k in range(n):
                fn = ('%s_%s_%02d.png' % (an, dn, k)) if name == 'noor' else ('%s_%s_%s_%02d.png' % (name, an, dn, k))
                p = down(Image.open(os.path.join(SRC, fn)), (FRAME, FRAME))
                fl = FLASH.get(k, 0.0) if an == 'hurt' else 0.0
                fd = DEATH_FADE[k] if an == 'death' else 1.0
                im = to_img(treat(p, flash=fl, fade=fd))
                out = shadow(name, fd); out.alpha_composite(im); tiles[(an, dn, k)] = out
                sheet.alpha_composite(out, (k*FRAME, r*FRAME))
                nm = '%s_%s_%s_%02d' % (name, an, dn, k)
                fr[nm] = {'frame': {'x': k*FRAME, 'y': r*FRAME, 'w': FRAME, 'h': FRAME}, 'rotated': False, 'trimmed': False,
                          'spriteSourceSize': {'x': 0, 'y': 0, 'w': FRAME, 'h': FRAME}, 'sourceSize': {'w': FRAME, 'h': FRAME},
                          'pivot': {'x': PIVOT[0]/FRAME, 'y': PIVOT[1]/FRAME}}
        png = '%s_%s.png' % (name, an)
        sheet.save(os.path.join(OUT, png), optimize=True)
        meta = {'app': 'prompt-injection art-v6 pack5.py', 'version': '1.0', 'image': png, 'format': 'RGBA8888', 'size': {'w': sheet.width, 'h': sheet.height},
                'scale': '1', 'frameSize': FRAME, 'pivot_px': list(PIVOT), 'fps': fps, 'rows': dirs, 'cols': n,
                'loop': an in ('idle', 'walk', 'move', 'landed', 'seated'),
                'note': 'rows = facing direction (screen space, S = towards camera), cols = frame index; pivot = feet. Rendered 1:1 with the 1280x720 mocks. '
                        'Outline + glow are baked (no shader needed).',
                'animations': {'%s_%s_%s' % (name, an, dn): ['%s_%s_%s_%02d' % (name, an, dn, k) for k in range(n)] for dn in dirs}}
        if len(dirs) == 4: meta['direction_map'] = {'SE': 'S', 'SW': 'S', 'NE': 'N', 'NW': 'N', 'note': 'or pick E/W by sign of dx when |dx| > |dy|'}
        if len(dirs) == 1: meta['direction_map'] = 'single row: use for every facing (symmetric / always faces the camera)'
        if an in ('attack', 'assist'): meta['tell'] = ATTACK_TELL.get(name, '')
        if an == 'attack' and name != 'noor': meta['hit_frame'] = HIT_FRAME.get(name)
        if an in EXTRA_TELL: meta['tell'] = EXTRA_TELL[an]
        json.dump({'frames': fr, 'meta': meta}, open(os.path.join(OUT, '%s_%s.json' % (name, an)), 'w'), indent=1)
        print('packed', name, an, sheet.size)
    lab = ImageFont.truetype(KFN, 14)
    if name == 'noor':   # one GIF per anim, 4x2 directions (as v4)
        for an, (n, fps) in anims.items():
            gif = []
            for k in range(n):
                bg = backdrop(FRAME*4, FRAME*2 + 24); d = ImageDraw.Draw(bg)
                for i, dn in enumerate(dirs):
                    x, y = (i % 4)*FRAME, (i // 4)*FRAME + 24; bg.alpha_composite(tiles[(an, dn, k)], (x, y)); d.text((x+8, y+4), dn, font=lab, fill=(170, 220, 228))
                d.text((8, 4), 'NOOR  %s  %d FRAMES @ %d FPS  (192 PX, FEET PIVOT 96,160)' % (an.upper(), n, fps), font=lab, fill=(240, 200, 150))
                gif.append(bg.convert('RGB'))
            gif = shared_palette(gif)
            dur = [int(1000/fps)]*n
            if an == 'attack': dur[-1] = 300
            gif[0].save(os.path.join(OUT, 'noor_%s_preview.gif' % an), save_all=True, append_images=gif[1:], duration=dur, loop=0, disposal=1, optimize=True)
    else:   # one GIF per character: rows = directions, cols = animations, each cell at its own fps
        dirs = [dd for dd in dirs if dd in ('S', 'E')]   # preview shows S + E only (N/W rows are in the sheets) to keep GIFs small
        names = list(anims.keys()); W = FRAME*len(names); Hh = FRAME*len(dirs) + 24; TICK = 1/12.0; NT = 24
        gif = []
        for t in range(NT):
            bg = backdrop(W, Hh); d = ImageDraw.Draw(bg)
            for c, an in enumerate(names):
                n, fps = anims[an]; k = int(t*TICK*fps)
                k = min(k, n-1) if an == 'death' else k % n
                for r, dn in enumerate(dirs):
                    bg.alpha_composite(tiles[(an, dn, k)], (c*FRAME, r*FRAME + 24))
                    if c == 0: d.text((6, r*FRAME + 28), dn, font=lab, fill=(170, 220, 228))
                d.text((c*FRAME + 8, 4), '%s %d@%d' % (an.upper(), n, fps), font=lab, fill=(240, 200, 150))
            gif.append(bg.convert('RGB'))
        gif = shared_palette(gif)
        gif[0].save(os.path.join(OUT, '%s_preview.gif' % name), save_all=True, append_images=gif[1:], duration=int(TICK*1000), loop=0, disposal=1, optimize=True)
    print('gif', name)

if __name__ == '__main__':
    todo = sys.argv[1:] or ['noor', 'autocomplete', 'sycophant', 'warden', 'redactor', 'hallucinator', 'caret']
    for nm in todo: pack(nm)
