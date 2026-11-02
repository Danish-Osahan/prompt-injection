# Post-process Blender renders into style-specific mock screenshots (PIL + numpy).
import sys, glob, random, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
A2 = '/workspace/games/prompt-injection/art-v2/'
PIX = None  # v3: Pixelify removed (CC0-only); H scripts use Kenney Future
KF = '/workspace/games/_downloads/ui-pack/Font/Kenney Future.ttf'
KFN = '/workspace/games/_downloads/ui-pack/Font/Kenney Future Narrow.ttf'
def F(p, s): return ImageFont.truetype(p, s)

def load(style, mode='room'):
    d = A2+'render/'+style+'/'
    img = Image.open(d+mode+'.png').convert('RGBA')
    lt = lambda pat: max(glob.glob(pat), key=os.path.getmtime)
    mist = Image.open(lt(d+mode+'_mist_*.png')); idx = Image.open(lt(d+mode+'_index_*.png'))
    mist = np.asarray(mist).astype(np.float32); mist = mist/mist.max() if mist.max() > 0 else mist
    idx = np.asarray(idx).astype(np.float32); idx = np.round(idx/ (65535.0 if idx.max() > 255 else 255.0) * 255).astype(np.int32)
    return img, mist, idx

def bloom(im, thr=0.72, radius=8, amt=0.8):
    a = np.asarray(im.convert('RGB')).astype(np.float32)/255
    lum = a.max(2, keepdims=True); m = np.clip((lum-thr)/(1-thr), 0, 1)
    b = Image.fromarray((a*m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    b2 = Image.fromarray((a*m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius*3))
    out = a + amt*(np.asarray(b).astype(np.float32)/255) + amt*0.6*(np.asarray(b2).astype(np.float32)/255)
    return Image.fromarray((np.clip(out, 0, 1)*255).astype(np.uint8))

def grade(im, lift=(0,0,0), gain=(1,1,1), sat=1.0, contrast=1.0):
    a = np.asarray(im.convert('RGB')).astype(np.float32)/255
    g = a.mean(2, keepdims=True); a = g + (a-g)*sat
    a = (a-0.5)*contrast+0.5
    a = a*np.array(gain) + np.array(lift)
    return Image.fromarray((np.clip(a, 0, 1)*255).astype(np.uint8))

def vignette(im, strength=0.45, color=(0,0,0)):
    w, h = im.size; y, x = np.mgrid[0:h, 0:w]
    r = np.sqrt(((x-w/2)/(w/2))**2 + ((y-h/2)/(h/2))**2)/1.414
    v = np.clip((r-0.35)/0.65, 0, 1)**1.6*strength
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    a = a*(1-v[..., None]) + np.array(color)*v[..., None]
    return Image.fromarray(a.astype(np.uint8))

def outline(im, mask, col, inner=None):
    a = np.asarray(im.convert('RGB')).copy(); m = mask.astype(bool)
    dil = m.copy()
    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
        dil |= np.roll(np.roll(m, dy, 0), dx, 1)
    edge = dil & ~m
    a[edge] = col
    return Image.fromarray(a)

def depth_lines(im, mist, idx, col_mul=0.45, thr=0.012):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    dx = np.abs(np.diff(mist, axis=1, append=mist[:, -1:])); dy = np.abs(np.diff(mist, axis=0, append=mist[-1:, :]))
    e = ((dx > thr) | (dy > thr)) & (idx == 0)
    ie = (np.diff(idx, axis=1, append=idx[:, -1:]) != 0) | (np.diff(idx, axis=0, append=idx[-1:, :]) != 0)
    e = e | ie
    a[e] *= col_mul
    return Image.fromarray(a.astype(np.uint8))

def quant(im, n, dither=False, pal_from=None):
    q = (pal_from or im).convert('RGB').quantize(n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = im.convert('RGB').quantize(palette=q, dither=Image.Dither.FLOYDSTEINBERG if dither else Image.Dither.NONE)
    pal = out.getpalette()[:n*3]
    return out.convert('RGB'), [tuple(pal[i:i+3]) for i in range(0, len(pal), 3)]

def text1(d, xy, t, f, fill, shadow=None):
    # crisp (non anti-aliased) text for pixel UIs
    d.fontmode = '1'
    if shadow: d.text((xy[0]+1, xy[1]+1), t, font=f, fill=shadow)
    d.text(xy, t, font=f, fill=fill)

def chip(d, x, y, t, f, bg, fg, pad=(4,2), r=2, edge=None):
    w = d.textlength(t, font=f); bb = d.textbbox((0,0), t, font=f)
    hgt = bb[3]-bb[1]
    d.rounded_rectangle([x, y, x+w+pad[0]*2, y+hgt+pad[1]*2+2], r, fill=bg, outline=edge)
    d.text((x+pad[0], y+pad[1]-bb[1]+1), t, font=f, fill=fg)
    return x+w+pad[0]*2

def save(im, name):
    os.makedirs(A2+'out', exist_ok=True); im.save(A2+'out/'+name); print('saved', name, im.size)
