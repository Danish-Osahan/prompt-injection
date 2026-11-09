#!/usr/bin/env python3
"""Compose mock-steal/v2 window→door beat from Blender Noor + prop sheets + office plate.
Outputs: beat.mp4, beat.gif, compare.mp4, stills, closeups. Code-drawn only as glue (glow/shake).
"""
import os, json, math, subprocess, shutil
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont, ImageChops
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'mock-steal/v2')
STILLS = os.path.join(OUT, 'stills')
FRAMES = os.path.join(OUT, '_frames')
NOOR = os.path.join(ROOT, 'art/render/steal_noor')
PROPS = os.path.join(ROOT, 'art/render/steal_props')
ASSETS = os.path.join(ROOT, 'game/public/assets')
V1_MP4 = os.path.join(ROOT, 'mock-steal/flow.mp4')

W, H = 1280, 720
TOP, BOT = 48, 94  # clarity letterbox
FPS = 24
DUR = 8.2  # seconds
NFRAMES = int(DUR * FPS)

os.makedirs(STILLS, exist_ok=True)
os.makedirs(FRAMES, exist_ok=True)

def load(path):
    im = Image.open(path).convert('RGBA')
    return im

def lerp(a, b, u): return a + (b - a) * u
def ease(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)
def seg(t, a, b):
    if b <= a: return 0.0
    return max(0.0, min(1.0, (t - a) / (b - a)))

# ---------- assets ----------
office = load(os.path.join(ASSETS, 'rooms/office.jpg')).convert('RGBA')
# door deltas (jpg lift frames) — already cropped-ish; paste at (112,62) like v1
doors = [load(os.path.join(ASSETS, f'office11/door/lift_{i:02d}.jpg')).convert('RGBA') for i in range(10)]
# also full RGBA door plates if useful for light spill
door_full = []
for i in range(10):
    p = os.path.join(ROOT, f'art/render/rooms11/o11_door_{i:02d}.png')
    door_full.append(load(p) if os.path.exists(p) else None)

# rain amb (window area already in plate space)
rain_amb = []
for i in range(12):
    p = os.path.join(ROOT, f'art/render/rooms/R7_office_amb_rain_{i:02d}.png')
    if os.path.exists(p): rain_amb.append(load(p))

# spritesheets
def sheet_frames(png, js, prefix, dir_, n):
    im = load(png); meta = json.load(open(js))['frames']
    out = []
    for i in range(n):
        key = f'{prefix}_{dir_}_{i:02d}'
        if key not in meta:
            # try alternate
            key = next(k for k in meta if k.startswith(f'{prefix}_{dir_}_'))
        fr = meta[key]['frame']
        out.append(im.crop((fr['x'], fr['y'], fr['x']+fr['w'], fr['y']+fr['h'])))
    return out

idle_E = sheet_frames(f'{ASSETS}/sprites/noor_idle.png', f'{ASSETS}/sprites/noor_idle.json', 'noor_idle', 'E', 6)
idle_N = sheet_frames(f'{ASSETS}/sprites/noor_idle.png', f'{ASSETS}/sprites/noor_idle.json', 'noor_idle', 'N', 6)
walk_E = sheet_frames(f'{ASSETS}/sprites/noor_walk.png', f'{ASSETS}/sprites/noor_walk.json', 'noor_walk', 'E', 8)
walk_W = sheet_frames(f'{ASSETS}/sprites/noor_walk.png', f'{ASSETS}/sprites/noor_walk.json', 'noor_walk', 'W', 8)
walk_N = sheet_frames(f'{ASSETS}/sprites/noor_walk.png', f'{ASSETS}/sprites/noor_walk.json', 'noor_walk', 'N', 8)

pull_N = [load(f'{NOOR}/pull_N_{i:02d}.png') for i in range(10)]
hurl_N = [load(f'{NOOR}/hurl_N_{i:02d}.png') for i in range(10)]
# E dirs for walk-facing moments
pull_E = [load(f'{NOOR}/pull_E_{i:02d}.png') for i in range(10)]
hurl_E = [load(f'{NOOR}/hurl_E_{i:02d}.png') for i in range(10)]

chain_hang = [load(f'{PROPS}/chain_hang_{i:02d}.png') for i in range(4)]
chain_snap = [load(f'{PROPS}/chain_snap_{i:02d}.png') for i in range(10)]
pad_fall = [load(f'{PROPS}/pad_fall_{i:02d}.png') for i in range(6)]
ribbon_wrap = [load(f'{PROPS}/ribbon_wrap_{i:02d}.png') for i in range(8)]
ribbon_fly = [load(f'{PROPS}/ribbon_fly_{i:02d}.png') for i in range(12)]
curt_blow = [load(f'{PROPS}/curt_blow_{i:02d}.png') for i in range(6)]
curt_drop = [load(f'{PROPS}/curt_drop_{i:02d}.png') for i in range(6)]
rain_sheet = [load(f'{PROPS}/rain_{i:02d}.png') for i in range(6)]

# font
FONT = None
for fp in [f'{ASSETS}/fonts/IBMPlexMono-Medium.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
    if os.path.exists(fp):
        FONT = fp; break

def font(size):
    if FONT: return ImageFont.truetype(FONT, size)
    return ImageFont.load_default()

# world positions (plate space 1280x720)
DOOR = (168, 155)
WIN = (960, 130)
P_START = (420, 480)
P_WIN = (880, 285)
P_DOOR = (230, 260)
NS = 0.78  # noor draw scale for 192 sheets → ~50px tall character body

def paste(dst, src, xy, scale=1.0, alpha=1.0, center=True):
    if src is None or alpha <= 0: return
    im = src
    if scale != 1.0:
        w = max(1, int(im.width * scale)); h = max(1, int(im.height * scale))
        im = im.resize((w, h), Image.LANCZOS)
    if alpha < 1.0:
        a = im.split()[-1].point(lambda p: int(p * alpha))
        im = im.copy(); im.putalpha(a)
    x, y = xy
    if center:
        x -= im.width // 2; y -= im.height // 2
    dst.alpha_composite(im, (int(x), int(y)))

def content_crop(im, pad=2):
    bb = im.getbbox()
    if not bb: return im
    x0,y0,x1,y1 = bb
    return im.crop((max(0,x0-pad), max(0,y0-pad), min(im.width,x1+pad), min(im.height,y1+pad)))

def glow_layer(im, radius=6, boost=1.4):
    """Soft glow glue from an RGBA sprite."""
    if im.getbbox() is None: return im
    g = im.filter(ImageFilter.GaussianBlur(radius))
    # boost alpha
    r,gch,b,a = g.split()
    a = a.point(lambda p: min(255, int(p * boost)))
    g = Image.merge('RGBA', (r,gch,b,a))
    return g

def shake_offset(u, amp=4):
    if u <= 0: return (0, 0)
    return (int(math.sin(u * 47.3) * amp * u), int(math.cos(u * 31.1) * amp * 0.7 * u))

def draw_noor(canvas, sprite, x, y, scale=NS):
    # sprite is 192 or 384; foot near bottom
    # for 384 noor12 frames, foot ~ y=372 of 384 → scale so height ~ 192*NS
    if sprite.width >= 300:
        # noor12 frames are 384; match on-screen size of 192*NS walk sheets
        sc = scale * (192 / 384)
    else:
        sc = scale
    w = int(sprite.width * sc); h = int(sprite.height * sc)
    im = sprite.resize((w, h), Image.LANCZOS)
    # foot pivot: for 192 sheets foot at ~160/192; for 384 at ~350/384
    foot_frac = 0.90
    px = int(x - w / 2); py = int(y - h * foot_frac)
    # contact shadow
    sh = Image.new('RGBA', canvas.size, (0,0,0,0))
    d = ImageDraw.Draw(sh)
    d.ellipse([x-22, y-5, x+22, y+6], fill=(0,0,0,70))
    canvas.alpha_composite(sh)
    canvas.alpha_composite(im, (px, py))
    return (px, py, w, h)

def hand_pos(n_x, n_y, dir_='N'):
    # approx hand in plate space
    if dir_ == 'N': return (n_x + 6, n_y - 58)
    if dir_ == 'E': return (n_x + 22, n_y - 50)
    if dir_ == 'W': return (n_x - 22, n_y - 50)
    return (n_x, n_y - 55)

def draw_chains(canvas, t, burst=0.0, door_open=0.0):
    if door_open > 0.55 and burst > 0.85: return
    if door_open > 0.85: return
    cx, cy = DOOR
    if burst <= 0:
        fr = chain_hang[int(t * 6) % 4]
        c = content_crop(fr)
        paste(canvas, c, (cx, cy + 8), scale=2.05, alpha=0.98)
        # small red lock-light glue on padlock
        d = ImageDraw.Draw(canvas)
        for r, a in ((7, 55), (4, 120), (2, 200)):
            d.ellipse([cx-r, cy+20-r, cx+r, cy+20+r], fill=(255, 48, 36, a))
    else:
        idx = min(9, int(burst * 9.99))
        fr = chain_snap[idx]
        c = content_crop(fr)
        paste(canvas, c, (cx + burst*12, cy + burst*30), scale=2.05, alpha=max(0.0, 1 - burst*0.5))
        if burst > 0.2:
            pi = min(5, int((burst-0.2)/0.8 * 5.99))
            pf = content_crop(pad_fall[pi])
            paste(canvas, pf, (cx + 20 + burst*55, cy + 35 + burst*110), scale=1.8, alpha=max(0.0, 1-burst*0.25))

def draw_window(canvas, open_u, t):
    # open_u 1=open rainy, 0=shut
    x0, y0, w, h = 780, 78, 380, 110
    if open_u > 0.05:
        # rain amb overlay (existing Blender rain into window)
        if rain_amb:
            ri = rain_amb[int(t * 10) % len(rain_amb)]
            # only composite rain region with open alpha
            rain = ri.copy()
            a = rain.split()[-1].point(lambda p: int(p * open_u))
            rain.putalpha(a)
            canvas.alpha_composite(rain, (0, 0))
        # rendered rain streaks sheet over window
        rs = content_crop(rain_sheet[int(t * 8) % 6])
        paste(canvas, rs, (x0 + w*0.55, y0 + h*0.45), scale=2.4, alpha=0.75*open_u)
        # curtains blowing
        cb = content_crop(curt_blow[int(t * 7) % 6])
        paste(canvas, cb, (x0 + 40, y0 + h*0.55), scale=1.5, alpha=0.9*open_u)
        paste(canvas, cb.transpose(Image.FLIP_LEFT_RIGHT), (x0 + w - 40, y0 + h*0.55), scale=1.5, alpha=0.85*open_u)
        # wet tint glue
        overlay = Image.new('RGBA', canvas.size, (0,0,0,0))
        d = ImageDraw.Draw(overlay)
        d.rectangle([x0, y0, x0+w, y0+h], fill=(110, 180, 210, int(28*open_u)))
        canvas.alpha_composite(overlay)
    else:
        # shut: dark glass + hanging curtains
        overlay = Image.new('RGBA', canvas.size, (0,0,0,0))
        d = ImageDraw.Draw(overlay)
        d.rectangle([x0, y0, x0+w, y0+h], fill=(8, 14, 20, 55))
        canvas.alpha_composite(overlay)
        cd = content_crop(curt_drop[min(5, int((1-open_u)*5))])
        paste(canvas, cd, (x0 + 40, y0 + h*0.5), scale=1.4, alpha=0.85)
        paste(canvas, cd.transpose(Image.FLIP_LEFT_RIGHT), (x0 + w - 40, y0 + h*0.5), scale=1.4, alpha=0.8)

def draw_ribbon_wrap(canvas, hx, hy, t, strength=1.0):
    if strength <= 0: return
    fr = ribbon_wrap[int(t * 10) % 8]
    c = content_crop(fr)
    sc = 1.7 * (0.85 + 0.3*strength)
    ox, oy = hx + 4, hy + 2
    g = glow_layer(c.resize((max(1,int(c.width*sc)), max(1,int(c.height*sc))), Image.LANCZOS), radius=7, boost=1.5)
    paste(canvas, g, (ox, oy), scale=1.0, alpha=0.5*strength, center=True)
    paste(canvas, c, (ox, oy), scale=sc, alpha=0.95*strength)

def draw_ribbon_flight(canvas, u, t, frm, to):
    if u <= 0 or u >= 1: return
    e = ease(u)
    # bezier control
    cx = (frm[0]+to[0])/2; cy = min(frm[1], to[1]) - 70
    def bez(t):
        x = (1-t)*(1-t)*frm[0] + 2*(1-t)*t*cx + t*t*to[0]
        y = (1-t)*(1-t)*frm[1] + 2*(1-t)*t*cy + t*t*to[1]
        return x, y
    tip = bez(e)
    # stamp sash along trail
    for k in range(8):
        v = e - k * 0.035
        if v <= 0: continue
        p = bez(v)
        fr = ribbon_wrap[int((t*8 + k) % 8)]
        c = content_crop(fr)
        sc = 1.35 * (1 - k*0.06) * (0.7 + 0.3*(1-u))
        ang = -25 + k*3
        # rotate
        cw = int(c.width * sc); ch = int(c.height * sc)
        rr = c.resize((cw, ch), Image.LANCZOS).rotate(ang, expand=True, resample=Image.BICUBIC)
        paste(canvas, glow_layer(rr, 5, 1.3), p, scale=1.0, alpha=0.35*(1-k/8), center=True)
        paste(canvas, rr, p, scale=1.0, alpha=0.85*(1-k/8)*(1-u*0.2), center=True)
    # tip fly frame
    fi = min(11, int(u * 11.99))
    fly = content_crop(ribbon_fly[fi])
    paste(canvas, glow_layer(fly.resize((int(fly.width*2.8), int(fly.height*2.8)), Image.LANCZOS), 6, 1.5),
          tip, scale=1.0, alpha=0.5, center=True)
    paste(canvas, fly, tip, scale=2.8, alpha=0.9)

def draw_hud(canvas, cap, hint):
    d = ImageDraw.Draw(canvas)
    # letterbox
    d.rectangle([0, 0, W, TOP], fill=(4, 8, 12, 255))
    d.rectangle([0, H-BOT, W, H], fill=(4, 8, 12, 255))
    if hint:
        f = font(13)
        # measure
        bbox = d.textbbox((0,0), hint, font=f)
        tw = bbox[2]-bbox[0]
        d.text(((W-tw)//2, H-22), hint, font=f, fill=(180, 200, 210, 140))
    if cap:
        f = font(22)
        bbox = d.textbbox((0,0), cap, font=f)
        tw = bbox[2]-bbox[0]; th = bbox[3]-bbox[1]
        pad = 14
        x0 = (W - tw)//2 - pad; y0 = H - BOT + 30
        d.rounded_rectangle([x0, y0, x0+tw+pad*2, y0+th+12], radius=8, fill=(4, 12, 18, 185))
        d.text((x0+pad, y0+6), cap, font=f, fill=(232, 238, 242, 255))

def apply_camera(img, zoom, focus):
    """Push-in: zoom >=1 around focus (plate coords), then letterbox stays."""
    if zoom <= 1.001:
        return img
    # crop around focus
    cw, ch = W / zoom, H / zoom
    fx, fy = focus
    left = max(0, min(W - cw, fx - cw/2))
    top = max(0, min(H - ch, fy - ch/2))
    crop = img.crop((int(left), int(top), int(left+cw), int(top+ch)))
    return crop.resize((W, H), Image.LANCZOS)

def frame_at(t):
    # timeline (window→door only, ~8.2s)
    # 0.0-1.4 establish
    # 1.4-2.6 walk to window
    # 2.6-4.6 PULL + slam (slow-mo mid)
    # 4.6-5.5 turn / carry to door
    # 5.5-7.5 THROW + chains snap + door open (slow-mo)
    # 7.5-8.2 hold
    canvas = Image.new('RGBA', (W, H), (4, 8, 12, 255))
    plate = office.copy()

    doorK = 0.0
    winOpen = 1.0
    burst = 0.0
    n = list(P_START); ndir = 'E'
    sprite = idle_E[0]
    carry = False
    pull_u = 0.0; throw_u = 0.0
    zoom = 1.0; focus = (640, 360)
    cap = ''; hint = 'E take   ·   F throw   ·   J attack'
    shake = 0.0

    if t < 1.4:
        n = list(P_START); ndir='E'; sprite = idle_E[int(t*2)%len(idle_E)]
        cap = 'The door is locked.' if t < 1.0 else ''
        focus = (DOOR[0]+200, 280); zoom = 1.0 + 0.02*math.sin(t)
    elif t < 2.6:
        u = ease(seg(t, 1.4, 2.55))
        n = [lerp(P_START[0], P_WIN[0], u), lerp(P_START[1], P_WIN[1], u)]
        ndir='E'; sprite = walk_E[int(t*12)%8]
        focus = (n[0], n[1]-40)
    elif t < 4.6:
        # PULL at window — slow-mo around rip
        n = list(P_WIN); ndir='N'
        pull_u = seg(t, 2.65, 4.2)
        # slow-mo: spend more time on frames 4-6
        if pull_u < 0.35:
            fi = int(pull_u/0.35 * 4)
        elif pull_u < 0.7:
            fi = 4 + int((pull_u-0.35)/0.35 * 3)  # 4..6 rip
        else:
            fi = 7 + int((pull_u-0.7)/0.3 * 2)
        fi = max(0, min(9, fi))
        sprite = pull_N[fi]
        winOpen = 1.0 - ease(seg(t, 3.35, 4.15))
        carry = pull_u > 0.4
        # camera push-in + slow-mo feel
        zoom = 1.0 + 0.28 * ease(seg(t, 2.8, 3.6)) * (1 - 0.35*seg(t, 4.0, 4.6))
        focus = (WIN[0]-40, WIN[1]+80)
        if 3.3 < t < 3.9: shake = seg(t, 3.3, 3.9) * (1-seg(t, 3.7, 3.9))
        cap = 'The open comes free.' if 0.35 < pull_u < 0.9 else ''
    elif t < 5.5:
        u = ease(seg(t, 4.6, 5.45))
        n = [lerp(P_WIN[0], P_DOOR[0], u), lerp(P_WIN[1], P_DOOR[1], u)]
        ndir='W'; sprite = walk_W[int(t*12)%8]
        winOpen = 0.0; carry = True
        focus = (n[0], n[1]-40); zoom = 1.05 - 0.05*u
    elif t < 7.5:
        n = list(P_DOOR); ndir='N'
        throw_u = seg(t, 5.55, 6.7)
        # slow-mo on release frames 3-5
        if throw_u < 0.25:
            fi = int(throw_u/0.25 * 3)
        elif throw_u < 0.55:
            fi = 3 + int((throw_u-0.25)/0.3 * 3)
        else:
            fi = 6 + int((throw_u-0.55)/0.45 * 3)
        fi = max(0, min(9, fi))
        sprite = hurl_N[fi]
        carry = throw_u < 0.55
        winOpen = 0.0
        burst = seg(t, 6.35, 7.2)
        doorK = ease(seg(t, 6.55, 7.45))
        zoom = 1.0 + 0.32 * ease(seg(t, 5.6, 6.3)) * (1 - 0.4*seg(t, 7.0, 7.5))
        focus = (DOOR[0]+40, DOOR[1]+60)
        if 6.35 < t < 6.9: shake = seg(t, 6.35, 6.9) * (1-seg(t, 6.7, 6.9))
        cap = 'The door takes the open.' if throw_u > 0.5 else ''
    else:
        n = list(P_DOOR); ndir='N'; sprite = idle_N[int(t*2)%len(idle_N)]
        doorK = 1.0; winOpen = 0.0; carry = False; burst = 1.0
        focus = (DOOR[0]+30, DOOR[1]+40); zoom = 1.06
        cap = ''

    # camera shake on plate
    sx, sy = shake_offset(shake, amp=5)
    base = Image.new('RGBA', (W, H), (4,8,12,255))
    base.alpha_composite(plate, (sx, sy))

    # door frames
    dk = int(round(max(0, min(1, doorK)) * 9))
    door_im = doors[dk]
    # lift frames are small jpgs — v1 pastes at 112,62
    # check size
    # lift jpgs are opaque plate-deltas for the door crop — replace, don't blend
    if door_im.width < 400:
        base.paste(door_im.convert('RGBA'), (112 + sx, 62 + sy))
    else:
        base.paste(door_im.convert('RGBA'), (sx, sy))

    draw_window(base, winOpen, t)
    draw_chains(base, t, burst=burst, door_open=doorK)

    # shimmer near window when about to take
    if 2.3 < t < 3.2 and winOpen > 0.5:
        overlay = Image.new('RGBA', (W,H), (0,0,0,0))
        d = ImageDraw.Draw(overlay)
        a = int(40 + 30*math.sin(t*6))
        d.ellipse([WIN[0]-70, WIN[1]-10, WIN[0]+70, WIN[1]+70], outline=(180, 238, 240, a), width=2)
        base.alpha_composite(overlay)

    # ribbon flight during throw
    hx, hy = hand_pos(n[0], n[1], ndir)
    if 5.7 < t < 6.7:
        draw_ribbon_flight(base, seg(t, 5.75, 6.55), t, (hx, hy), (DOOR[0], DOOR[1]+10))

    # Noor
    draw_noor(base, sprite, n[0] + sx*0.3, n[1] + sy*0.3)

    # ribbon wrap on forearm while carrying / during pull
    if carry or (2.9 < t < 4.5):
        strength = 1.0
        if pull_u > 0: strength = min(1.0, max(0.3, (pull_u - 0.25) / 0.5))
        if throw_u > 0: strength = max(0.0, 1.0 - throw_u * 1.4)
        hx, hy = hand_pos(n[0], n[1], ndir)
        if strength > 0.05:
            draw_ribbon_wrap(base, hx, hy - 2, t, strength)

    # impact glow at door when chains burst
    if burst > 0.05:
        overlay = Image.new('RGBA', (W,H), (0,0,0,0))
        d = ImageDraw.Draw(overlay)
        a = int(90 * (1 - burst) * min(1, burst*3))
        d.ellipse([DOOR[0]-50, DOOR[1]-40, DOOR[0]+50, DOOR[1]+50], fill=(200, 220, 255, a))
        base.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(12)))

    # camera push-in
    framed = apply_camera(base, zoom, focus)

    # HUD on top (not affected by zoom much — redraw after)
    # Actually HUD should stay fixed; re-letterbox
    draw_hud(framed, cap, hint)

    # fade in/out
    if t < 0.25:
        a = int(255 * (1 - t/0.25))
        framed.alpha_composite(Image.new('RGBA', (W,H), (4,8,12,a)))
    if t > DUR - 0.45:
        a = int(255 * seg(t, DUR-0.45, DUR))
        framed.alpha_composite(Image.new('RGBA', (W,H), (4,8,12,a)))

    return framed.convert('RGB')

# ---------- render all frames ----------
print('compositing', NFRAMES, 'frames…')
still_times = {
    '01-establish-chained-door': 0.7,
    '02-window-open-rain': 1.15,
    '03-pull-brace-claw': 3.50,
    '04-window-slam-ribbon': 4.10,
    '05-throw-follow-through': 6.05,
    '06-chains-snap-door-open': 7.55,
}
still_imgs = {}
close_pull = None; close_throw = None

for i in range(NFRAMES):
    t = i / FPS
    im = frame_at(t)
    im.save(f'{FRAMES}/f_{i:04d}.png')
    for name, ts in still_times.items():
        if abs(t - ts) < 0.5/FPS and name not in still_imgs:
            still_imgs[name] = im.copy()
    # close-ups of pull / throw poses
    if abs(t - 3.50) < 0.5/FPS and close_pull is None:
        close_pull = im.copy()
    if abs(t - 6.05) < 0.5/FPS and close_throw is None:
        close_throw = im.copy()
    if i % 24 == 0: print(f'  {i}/{NFRAMES}')

for name, im in still_imgs.items():
    im.save(f'{STILLS}/{name}.png')
    print('still', name)

# 2x close-ups: crop around Noor at pull/throw
def closeup(im, cx, cy, half=160):
    x0=max(0,cx-half); y0=max(0,cy-half); x1=min(W,cx+half); y1=min(H,cy+half)
    crop=im.crop((x0,y0,x1,y1))
    return crop.resize((crop.width*2, crop.height*2), Image.NEAREST)

if close_pull:
    closeup(close_pull, P_WIN[0], P_WIN[1]-40, 150).save(f'{STILLS}/close-pull-2x.png')
if close_throw:
    closeup(close_throw, P_DOOR[0], P_DOOR[1]-30, 150).save(f'{STILLS}/close-throw-2x.png')

# encode beat.mp4
beat_mp4 = f'{OUT}/beat.mp4'
subprocess.check_call([
    'ffmpeg', '-y', '-framerate', str(FPS), '-i', f'{FRAMES}/f_%04d.png',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart',
    beat_mp4
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print('wrote', beat_mp4)

# gif (scaled)
beat_gif = f'{OUT}/beat.gif'
subprocess.check_call([
    'ffmpeg', '-y', '-i', beat_mp4, '-vf', 'fps=12,scale=640:-1:flags=lanczos',
    '-loop', '0', beat_gif
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print('wrote', beat_gif)

# compare v1 vs v2 side by side (trim/pad to same length)
compare = f'{OUT}/compare.mp4'
if os.path.exists(V1_MP4):
    # take first 8.2s of v1, stack with v2
    subprocess.check_call([
        'ffmpeg', '-y',
        '-t', str(DUR), '-i', V1_MP4,
        '-t', str(DUR), '-i', beat_mp4,
        '-filter_complex',
        f'[0:v]scale=640:360,setsar=1,fps={FPS},drawtext=text=v1\\ code-drawn:x=12:y=12:fontsize=18:fontcolor=white@0.8[left];'
        f'[1:v]scale=640:360,setsar=1,fps={FPS},drawtext=text=v2\\ blender:x=12:y=12:fontsize=18:fontcolor=white@0.8[right];'
        f'[left][right]hstack=inputs=2[v]',
        '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', compare
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print('wrote', compare)
else:
    print('no v1 mp4, skip compare')

# cleanup frames to save space? keep a few; remove bulk
# keep frames dir for debugging but it's large — remove
shutil.rmtree(FRAMES)
print('DONE compose')
