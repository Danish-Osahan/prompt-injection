#!/usr/bin/env python3
"""Compose mock-steal/v9: heavy impact overhaul.
Chunky Blender break passes + soft-shaded wind + silhouette impact frames
via impact_system (HEAVY tier). No thin stroke stacks, no grey HUD boxes."""
import os, math, json, subprocess, random, re
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'mock-steal/v9')
STILLS = os.path.join(OUT, 'stills')
FRAMES = os.path.join(OUT, '_frames')
NOOR = os.path.join(ROOT, 'art/render/steal_noor_v8')
COMP_D = os.path.join(ROOT, 'art/render/steal_v4/comp')
COMP_W = os.path.join(ROOT, 'art/render/steal_v3/comp')
ASSETS = os.path.join(ROOT, 'game/public/assets')
V8_MP4 = os.path.join(ROOT, 'mock-steal/v8/beat.mp4')
BREAK = os.path.join(ROOT, 'art/render/steal_break_v9')

W, H = 1280, 720
TOP, BOT = 48, 94
FPS = 24
DUR = 11.5
NFRAMES = int(DUR * FPS)
os.makedirs(STILLS, exist_ok=True); os.makedirs(FRAMES, exist_ok=True)
rng = random.Random(11)

import sys
sys.path.insert(0, os.path.dirname(__file__))
from impact_system import (
    HEAVY, get_tier, hit_spark, make_impact_frame, impact_frame_sequence,
    soft_wind_blob, soft_wind_flight, soft_wind_wrap,
    floor_dust_burst, glowing_sparks, punch_cam, directional_shake,
    contact_shadow,
)
TIER = HEAVY  # door lock break uses heavy tier

def load(p): return Image.open(p).convert('RGBA')
def lerp(a,b,u): return a+(b-a)*u
def ease(u):
    u=max(0.,min(1.,u)); return u*u*(3-2*u)
def ease_in_out(u):
    u=max(0.,min(1.,u)); return 3*u*u - 2*u*u*u
def ease_out(u):
    u=max(0.,min(1.,u)); return 1-(1-u)*(1-u)
def seg(t,a,b):
    return 0. if b<=a else max(0.,min(1.,(t-a)/(b-a)))
def clamp(v,a,b): return max(a,min(b,v))

office = load(os.path.join(ASSETS,'rooms/office.jpg')).convert('RGBA')
# Lift frames are 196x296 sprites pasted at O11_DOOR (112,62) — NOT full-plate crops
lift = [load(os.path.join(ASSETS,f'office11/door/lift_{i:02d}.jpg')) for i in range(10)]
DOOR_XY = (112, 62)
rain_amb=[]
for i in range(12):
    p=os.path.join(ROOT,f'art/render/rooms/R7_office_amb_rain_{i:02d}.png')
    if os.path.exists(p): rain_amb.append(load(p))

def sheet_frames(png, js, prefix, dir_, n):
    im=load(png); meta=json.load(open(js))['frames']; out=[]
    for i in range(n):
        key=f'{prefix}_{dir_}_{i:02d}'
        if key not in meta:
            key=next(k for k in meta if k.startswith(f'{prefix}_{dir_}_'))
        fr=meta[key]['frame']
        out.append(im.crop((fr['x'],fr['y'],fr['x']+fr['w'],fr['y']+fr['h'])))
    return out

idle_S = sheet_frames(f'{ASSETS}/sprites/noor_idle.png', f'{ASSETS}/sprites/noor_idle.json','noor_idle','S',6)
idle_E = sheet_frames(f'{ASSETS}/sprites/noor_idle.png', f'{ASSETS}/sprites/noor_idle.json','noor_idle','E',6)
walk_E = sheet_frames(f'{ASSETS}/sprites/noor_walk.png', f'{ASSETS}/sprites/noor_walk.json','noor_walk','E',8)
walk_W = sheet_frames(f'{ASSETS}/sprites/noor_walk.png', f'{ASSETS}/sprites/noor_walk.json','noor_walk','W',8)
walk_S = sheet_frames(f'{ASSETS}/sprites/noor_walk.png', f'{ASSETS}/sprites/noor_walk.json','noor_walk','S',8)
walk_N = sheet_frames(f'{ASSETS}/sprites/noor_walk.png', f'{ASSETS}/sprites/noor_walk.json','noor_walk','N',8)

def load_seq(prefix, n, dirs=('S',)):
    out=[]
    for i in range(n):
        for d in dirs:
            p=f'{NOOR}/{prefix}_{d}_{i:02d}.png'
            if os.path.exists(p): out.append(load(p)); break
        else:
            raise FileNotFoundError(f'missing {prefix} {i} in {dirs}')
    return out

pull_S = carry_S = hurl_thr = None

door_hang = [Image.open(f'{COMP_D}/door_hang_full_{i:02d}.jpg').convert('RGBA') for i in range(4)]
door_snap = [Image.open(f'{COMP_D}/door_snap_full_{i:02d}.jpg').convert('RGBA') for i in range(12)]
win_fr = [Image.open(f'{COMP_W}/win_full_{i:02d}.jpg').convert('RGBA') for i in range(8)]

# v9 Blender break + soft wind passes
break_taut = [load(f'{BREAK}/taut_{i:02d}.png') for i in range(4)]
break_snap = [load(f'{BREAK}/snap_{i:02d}.png') for i in range(20)]
break_settle = [load(f'{BREAK}/settle_{i:02d}.png') for i in range(4)]
wind_soft = [load(f'{BREAK}/wind_soft_{i:02d}.png') for i in range(12)]
door_flex = [load(f'{BREAK}/door_flex_{i:02d}.png') for i in range(6)]


FONT=None
for fp in [f'{ASSETS}/fonts/IBMPlexMono-Medium.ttf']:
    if os.path.exists(fp): FONT=fp; break
def font(sz):
    return ImageFont.truetype(FONT, sz) if FONT else ImageFont.load_default()

DOOR=(168,155); DOOR_CHAIN=(205,158); WIN=(960,130)
P_START=(500,520); P_WIN=(900,310); P_DOOR=(235,280)
NS=0.78
WIN_BOX=(740,55,1180,220)
DOOR_BOX=(100,50,320,370)
DESK_PAPERS = [(820,340),(845,355),(870,335),(800,360)]

# --- collision footprints from office11art.ts ---
def load_polys():
    ts=open(os.path.join(ROOT,'game/src/office11art.ts')).read()
    m=re.search(r'O11_PROPS: O11Prop\[\] = (\[.*?\]);', ts, re.S)
    props=json.loads(m.group(1))
    return [(p['name'], p['poly']) for p in props]

POLYS = load_polys()

def point_in_poly(x, y, poly):
    # ray cast
    n=len(poly); inside=False
    j=n-1
    for i in range(n):
        xi,yi=poly[i]; xj,yj=poly[j]
        if ((yi>y)!=(yj>y)) and (x < (xj-xi)*(y-yi)/((yj-yi) or 1e-9)+xi):
            inside=not inside
        j=i
    return inside

def blocked(x, y, pad=14):
    """Foot circle vs furniture polys (expanded)."""
    for name, poly in POLYS:
        # expand poly AABB quick reject
        xs=[p[0] for p in poly]; ys=[p[1] for p in poly]
        if x<min(xs)-pad or x>max(xs)+pad or y<min(ys)-pad or y>max(ys)+pad:
            continue
        # check center + 4 offsets
        for dx,dy in ((0,0),(pad,0),(-pad,0),(0,pad),(0,-pad),(pad*0.7,pad*0.7)):
            if point_in_poly(x+dx, y+dy, poly):
                return name
    return None

# Hand-authored waypoints that clear furniture (verified)
# start → window (east then north, south of kabir desk)
PATH_TO_WIN = [(500,520),(600,500),(720,455),(840,380),(900,310)]
# window → door (south clear of kabir, west through open floor, north to door south of podW)
PATH_TO_DOOR = [(900,310),(860,400),(760,480),(620,520),(480,520),(320,480),(260,360),(235,280)]

def path_pos(waypoints, u):
    """u in [0,1] along polyline."""
    if u<=0: return list(waypoints[0])
    if u>=1: return list(waypoints[-1])
    # cumulative lengths
    lens=[0.0]
    for i in range(1,len(waypoints)):
        a,b=waypoints[i-1],waypoints[i]
        lens.append(lens[-1]+math.hypot(b[0]-a[0], b[1]-a[1]))
    total=lens[-1] or 1
    d=u*total
    for i in range(1,len(lens)):
        if d<=lens[i]:
            seg_u=(d-lens[i-1])/max(1e-6, lens[i]-lens[i-1])
            a,b=waypoints[i-1],waypoints[i]
            return [lerp(a[0],b[0],seg_u), lerp(a[1],b[1],seg_u)]
    return list(waypoints[-1])

def facing_along(waypoints, u):
    p0=path_pos(waypoints, max(0,u-0.02)); p1=path_pos(waypoints, min(1,u+0.02))
    dx,dy=p1[0]-p0[0], p1[1]-p0[1]
    ang=math.atan2(dy,dx)  # 0=E, +y down so S is +
    # map to NESW-ish
    deg=math.degrees(ang)  # 0 E, 90 S, ±180 W, -90 N
    if -45<=deg<45: return 'E', walk_E
    if 45<=deg<135: return 'S', walk_S
    if deg>=135 or deg<-135: return 'W', walk_W
    return 'N', walk_N

def paste_rgb_region(dst, src_full, box):
    x0,y0,x1,y1=box
    dst.paste(src_full.crop((x0,y0,x1,y1)), (x0,y0))

def blend_sprites(a, b, u):
    if u<=0: return a
    if u>=1: return b
    if a.size!=b.size:
        b=b.resize(a.size, Image.LANCZOS)
    return Image.blend(a, b, u)

def sample_anim(frames, u):
    if not frames: return None
    if len(frames)==1: return frames[0]
    x=clamp(u,0,0.99999)*(len(frames)-1)
    i=int(x); f=x-i
    return blend_sprites(frames[i], frames[min(i+1,len(frames)-1)], ease(f))

def draw_noor(canvas, sprite, x, y, scale=NS, alpha=1.0):
    sc = scale*(192/384) if sprite.width>=300 else scale
    w=max(1,int(sprite.width*sc)); h=max(1,int(sprite.height*sc))
    im=sprite.resize((w,h), Image.LANCZOS)
    if alpha<0.999:
        a=im.split()[3].point(lambda v: int(v*alpha))
        im.putalpha(a)
    px=int(x-w/2); py=int(y-h*0.90)
    sh=Image.new('RGBA', canvas.size,(0,0,0,0))
    d=ImageDraw.Draw(sh); d.ellipse([x-20,y-4,x+20,y+5], fill=(0,0,0,int(65*alpha)))
    canvas.alpha_composite(sh); canvas.alpha_composite(im,(px,py))

def hand_pos(nx, ny, phase='carry', dir_='S'):
    if phase=='pull':
        return (nx+24, ny-72) if dir_ in ('S','SE') else (nx-6, ny-68)
    if phase=='throw':
        # throwing hand toward door (left); readable from 3/4
        if dir_ in ('SW','W'): return (nx-26, ny-68)
        if dir_=='S': return (nx-20, ny-70)
        return (nx-18, ny-66)
    return (nx+16, ny-60) if dir_ in ('S','SE') else (nx-12, ny-58)

# ---------- curling WIND STREAKS (no rings, no atom dots) ----------
def _bezier(p0,p1,p2,p3,n=14):
    out=[]
    for i in range(n+1):
        t=i/n; u=1-t
        x=u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0]
        y=u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]
        out.append((x,y))
    return out

def _taper_stroke(d, pts, rgba, width0):
    """Draw stroke that tapers to thin tip — open curve, not a loop."""
    if len(pts)<2: return
    n=len(pts)
    for i in range(n-1):
        u=i/(n-1)
        # thick at root, thin at tip
        w=max(1, width0*(1.0-u*0.92))
        aa=int(rgba[3]*(1.0-u*0.55))
        d.line([pts[i], pts[i+1]], fill=(rgba[0],rgba[1],rgba[2],aa), width=max(1,int(round(w))))


def paste_break_pass(canvas, frame, cx, cy, size=210, alpha=1.0):
    """Composite a transparent Blender break/wind pass centered on (cx,cy)."""
    if frame is None or alpha <= 0:
        return
    fr = frame.copy()
    # trim transparent margins for tighter scale
    a = fr.split()[-1]
    bbox = a.getbbox()
    if not bbox:
        return
    fr = fr.crop(bbox)
    # scale so longest side == size
    w, h = fr.size
    s = size / max(w, h)
    nw, nh = max(1, int(w * s)), max(1, int(h * s))
    fr = fr.resize((nw, nh), Image.LANCZOS)
    if alpha < 0.999:
        r, g, b, aa = fr.split()
        aa = aa.point(lambda v: int(v * alpha))
        fr = Image.merge('RGBA', (r, g, b, aa))
    canvas.alpha_composite(fr, (int(cx - nw / 2), int(cy - nh / 2)))


def wind_streaks(canvas, hx, hy, t, strength=1.0, mode='wrap', scale=1.0):
    """SOFT shaded wind only — never thin stroke stacks."""
    if strength <= 0:
        return
    if mode in ('wrap', 'pull'):
        soft_wind_wrap(canvas, hx, hy, t, scale=28 * scale, alpha=0.75 * strength)
        # optional Blender soft wind plate near hand
        if wind_soft:
            fi = int(t * 8) % len(wind_soft)
            paste_break_pass(canvas, wind_soft[fi], hx + 10, hy - 8, size=int(70 * scale), alpha=0.55 * strength)
    else:
        soft_wind_blob(canvas, hx, hy, 22 * scale, direction=(1, 0), alpha=0.6 * strength)


def wind_flight(canvas, u, frm, to, t, scale=1.0):
    """Soft-shaded gust mass along shallow arc. Returns tip."""
    if u <= 0:
        return frm
    tip = soft_wind_flight(canvas, u, frm, to, scale=42 * scale)
    # layer Blender soft wind sprite at tip for volume
    if wind_soft:
        fi = min(len(wind_soft) - 1, int(u * (len(wind_soft) - 1)))
        paste_break_pass(canvas, wind_soft[fi], tip[0], tip[1],
                         size=int(90 * scale * (1.05 - 0.2 * u)), alpha=0.85)
    return tip


def throw_smear(canvas, hx, hy, tx, ty, u):
    """Soft smear mass along throw — filled blobs, not hairlines."""
    if u <= 0:
        return
    for i in range(5):
        t = i / 4
        x = hx + (tx - hx) * t * 0.35
        y = hy + (ty - hy) * t * 0.35
        soft_wind_blob(canvas, x, y, 18 * (1 - t * 0.4) * u,
                       direction=(tx - hx, ty - hy), alpha=0.4 * u * (1 - t))


def paste_chain_break(canvas, phase_u, wt):
    """Taut → snap → settle using Blender passes. phase_u 0 at contact, 1 settled."""
    if phase_u < 0.08:
        # taut whip
        fi = min(3, int(phase_u / 0.08 * 3))
        paste_break_pass(canvas, break_taut[fi], DOOR_CHAIN[0], DOOR_CHAIN[1] + 8, size=195, alpha=1.0)
    elif phase_u < 0.85:
        u = (phase_u - 0.08) / 0.77
        fi = min(len(break_snap) - 1, int(u * (len(break_snap) - 1)))
        # pieces spread — slightly larger
        paste_break_pass(canvas, break_snap[fi], DOOR_CHAIN[0], DOOR_CHAIN[1] + 30,
                         size=int(210 + 70 * u), alpha=1.0)
    else:
        fi = min(3, int((phase_u - 0.85) / 0.15 * 3))
        paste_break_pass(canvas, break_settle[fi], DOOR_CHAIN[0], DOOR_CHAIN[1] + 50,
                         size=240, alpha=1.0)



def paste_bare_door(canvas):
    """Office plate door region WITHOUT the steal_v4 baked chain/lock icons."""
    canvas.paste(office.crop(DOOR_BOX), (DOOR_BOX[0], DOOR_BOX[1]))

def paste_door_flex(canvas, u):
    """Door dent/recoil — NO plate overlay (plate read as grey HUD box).
    Recoil is sold via paste_lift nudge + dust; flex renders kept for future."""
    return


def tiny_dust(canvas, cx, cy, u, t, n=8):
    if u<=0: return
    ov=Image.new('RGBA', canvas.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    for i in range(n):
        ang=-0.5+i*(math.pi/n)+0.15*math.sin(i+t)
        dist=5+u*18+i
        x=cx+math.cos(ang)*dist*0.85
        y=cy+math.sin(ang)*dist*0.3 - u*7
        aa=int(80*(1-u)*(1-i/n)); r=1.1+0.5*math.sin(t+i)
        d.ellipse([x-r,y-r*0.7,x+r,y+r*0.7], fill=(210,225,235,aa))
    canvas.alpha_composite(ov)

def living_window(canvas, t, approach, open_amt=1.0):
    if open_amt<=0.02: return
    sway = 0.5+0.5*math.sin(t*3.2)
    wi_a = int(sway*2.99) % 4
    wi_b = (wi_a+1)%4
    a=win_fr[wi_a].crop(WIN_BOX); b=win_fr[wi_b].crop(WIN_BOX)
    blended=Image.blend(a,b, ease(sway*2%1))
    canvas.paste(blended, (WIN_BOX[0], WIN_BOX[1]))
    pulse=0.55+0.45*math.sin(t*2.4)
    pulse *= (0.35+0.65*approach)*open_amt
    if pulse > 0.05:
        glow=Image.new('RGBA', canvas.size,(0,0,0,0)); gd=ImageDraw.Draw(glow)
        cx, cy = WIN[0]+10, WIN[1]+55
        for k, mul in ((90, 0.2), (55, 0.32), (28, 0.48)):
            gd.ellipse([cx-k, cy-k*0.45, cx+k, cy+k*0.45], fill=(140,190,230,int(65*pulse*mul)))
        canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(4)))
    ov=Image.new('RGBA', canvas.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    for i in range(16):
        x0=WIN[0]-40+(i*17+t*40)%280
        y0=WIN[1]+20+(i*11)%70
        aa=int((50+40*approach)*open_amt*(0.6+0.4*math.sin(t*6+i)))
        d.line([(x0,y0),(x0-8*approach-4, y0+10+6*approach)], fill=(190,220,245,aa), width=1)
    for i in range(5):
        u=((t*0.28+i*0.18)%1.0)
        x=lerp(WIN[0]+30, P_WIN[0]-20, u)+math.sin(t*1.8+i)*14
        y=lerp(WIN[1]+85, P_WIN[1]-5, u)+math.sin(t*2.4+i)*8
        aa=int(110*open_amt*(1-u*0.55)*(0.35+0.65*approach))
        if i%2==0:
            d.ellipse([x-3,y-1.5,x+3,y+1.5], fill=(160,185,145,aa))
        else:
            d.polygon([(x,y-2),(x+4,y),(x,y+2),(x-3,y)], fill=(225,228,232,aa))
    for i,(px,py) in enumerate(DESK_PAPERS):
        flap=math.sin(t*8+i*1.7)*2.5*approach*open_amt
        aa=int(120*open_amt*(0.5+0.5*approach))
        d.polygon([(px,py+flap),(px+12,py+flap*0.4),(px+11,py+5),(px+1,py+5)], fill=(230,232,236,aa))
    canvas.alpha_composite(ov)
    wind_streaks(canvas, WIN[0]+10, WIN[1]+55, t, strength=(0.35+0.65*approach)*open_amt, mode='shimmer', scale=1.0+0.3*approach)

def door_rattle(canvas, t, intense=0.0):
    # No door_hang paste (would reintroduce baked outline chain). Soft dust only.
    if intense > 0.2:
        tiny_dust(canvas, DOOR_CHAIN[0], DOOR_CHAIN[1] + 10, intense * 0.4, t, n=5)

def paste_lift(canvas, frame_i):
    """Correct: full 196x296 sprite at O11_DOOR origin, with soft interior depth."""
    fi=int(clamp(frame_i, 0, 9))
    spr = lift[fi].copy()
    if fi >= 3:
        # subtle back-wall gradient + top light strip (in-sprite, no pasted plate)
        a = np.array(spr.convert('RGB'), dtype=np.float32)
        h,w = a.shape[:2]
        yy = np.linspace(0,1,h)[:,None]
        xx = np.linspace(0,1,w)[None,:]
        # darken toward sides/top (shaft depth), keep center warmer
        depth = 1.0 - 0.22*np.clip((yy-0.15)*1.1,0,1) - 0.12*((xx-0.5)**2)*4
        depth = np.clip(depth, 0.7, 1.0)
        a *= depth[...,None]
        # thin warm light strip near top of opening
        strip = np.exp(-((yy-0.12)*14)**2) * 28
        a[...,0] = np.clip(a[...,0] + strip*1.1, 0, 255)
        a[...,1] = np.clip(a[...,1] + strip*0.85, 0, 255)
        a[...,2] = np.clip(a[...,2] + strip*0.45, 0, 255)
        spr = Image.fromarray(a.astype(np.uint8)).convert('RGBA')
    canvas.paste(spr, DOOR_XY)

def soft_door_spill(canvas, open_u):
    """Warm spill from the opening only — very soft, low alpha, no hard cone."""
    if open_u<=0.02: return
    ov=Image.new('RGBA', canvas.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    cx, cy = DOOR_XY[0]+98, DOOR_XY[1]+255
    aa0=int(42*open_u)
    for k, mul, dy in ((70, 0.3, 38), (45, 0.45, 28), (25, 0.55, 16)):
        d.ellipse([cx-k, cy, cx+k, cy+dy], fill=(255,225,180, int(aa0*mul)))
    canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(18)))


def apply_cam(img, zoom, focus, shake=(0,0)):
    return punch_cam(img if img.mode=='RGBA' else img.convert('RGBA'), zoom, focus, shake)

def hud(canvas, hint):
    d=ImageDraw.Draw(canvas)
    d.rectangle([0,0,W,TOP], fill=(4,8,12,255))
    d.rectangle([0,H-BOT,W,H], fill=(4,8,12,255))
    if hint:
        f=font(13); bb=d.textbbox((0,0),hint,font=f); tw=bb[2]-bb[0]
        d.text(((W-tw)//2,H-22), hint, font=f, fill=(180,200,210,140))

def frame_at(t):
    """
    Continuous timeline (NO hard hit-stop freeze that pops into carry):
    0-2.3 walk to window along collision-safe path + lure
    2.3-2.7 reach blend
    2.7-4.5 pull + slam + 2x cam (soft slow-mo, not freeze)
    4.5-5.0 crossfade rip→carry with sub-motion
    5.0-6.4 carry walk to door along safe path
    6.4-7.8 throw (3/4 cheat sheets) + 2x cam
    7.8-9.5 snap + lift open (correct paste) + soft spill
    9.5-11.5 settle
    """
    # Soft slow-mo around rip (compress time slightly, never hard freeze)
    def map_time(tt):
        # brief ease through rip window instead of freeze
        if 4.05 <= tt <= 4.35:
            # slow: 0.3s real → 0.12s world
            local=(tt-4.05)/0.3
            return 4.05 + local*0.12, 'window_slow'
        # Heavy impact freeze: wall time when world hit lands (wt≈7.50 → tt≈7.68)
        # Must run before the generic >4.35 debt return or it is dead code.
        if 7.68 <= tt <= 8.05:
            return 7.50, 'door_impact'  # freeze world at chain hit
        if tt > 8.05:
            return tt - 0.18 - 0.37, None  # debt: window slow + impact freeze
        if tt > 4.35:
            return tt - 0.18, None  # account for slow-mo debt
        return tt, None

    wt, impact = map_time(t)
    base = office.copy()

    # Noor path positions
    if wt < 2.3:
        u=ease(seg(wt,0.15,2.25)); n=path_pos(PATH_TO_WIN, u)
    elif wt < 4.55:
        n=list(P_WIN)
    elif wt < 6.4:
        u=ease(seg(wt,5.0,6.3)); n=path_pos(PATH_TO_DOOR, u)
    else:
        n=list(P_DOOR)

    # safety nudge if somehow blocked
    hit=blocked(n[0], n[1], pad=12)
    if hit:
        for ang in range(0,360,30):
            nx=n[0]+18*math.cos(math.radians(ang)); ny=n[1]+18*math.sin(math.radians(ang))
            if not blocked(nx,ny,pad=12):
                n=[nx,ny]; break

    approach = clamp(1.0 - math.hypot(n[0]-P_WIN[0], n[1]-P_WIN[1])/420.0, 0, 1)
    win_open = 1.0 - ease(seg(wt, 3.9, 4.25))

    if rain_amb and win_open>0.05:
        ri=rain_amb[int(wt*10)%len(rain_amb)].copy()
        ri.putalpha(ri.split()[-1].point(lambda a: int(a*win_open*0.65)))
        base.alpha_composite(ri)

    # WINDOW
    if win_open > 0.08:
        lure = max(0.55, approach, seg(wt,0.0,1.8)*0.85)
        living_window(base, wt, approach=lure, open_amt=win_open)
    else:
        u=seg(wt,3.75,4.25)
        xf=4+u*3.99; i0=int(xf); f=xf-i0
        a=win_fr[min(7,i0)].crop(WIN_BOX); b=win_fr[min(7,i0+1)].crop(WIN_BOX)
        base.paste(Image.blend(a,b,ease(f)), (WIN_BOX[0], WIN_BOX[1]))
        if 0.15<u<0.9:
            tiny_dust(base, WIN[0]+10, WIN[1]+60, (u-0.15)/0.6, wt, n=8)

    # DOOR / LIFT — bare plate + Blender chunky chain (no baked outline icons)
    door_open_u=0.0
    break_u=0.0
    impact_flash_u=0.0
    door_recoil=0.0
    if wt < 7.40:
        paste_bare_door(base)
        paste_chain_break(base, 0.02 + 0.05 * seg(wt, 6.9, 7.40), wt)
        door_rattle(base, wt, intense=0.15 + 0.35 * seg(wt, 6.9, 7.40))
    elif impact == 'door_impact' or (7.40 <= wt <= 7.55):
        paste_bare_door(base)
        paste_chain_break(base, 0.07, wt)
        impact_flash_u = 1.0 if impact == 'door_impact' else seg(wt, 7.40, 7.55)
    elif wt < 8.55:
        paste_bare_door(base)
        break_u = ease_out(seg(wt, 7.50, 8.55))
        paste_chain_break(base, max(0.12, break_u), wt)
        door_recoil = math.sin(seg(wt, 7.55, 8.05) * math.pi) * (1 - seg(wt, 7.90, 8.20))
        impact_flash_u = max(0, 1 - seg(wt, 7.50, 7.78))
        door_open_u = ease_out(seg(wt, 8.15, 9.4))
    else:
        paste_bare_door(base)
        break_u = 1.0
        paste_chain_break(base, 1.0, wt)
        door_open_u = ease_out(seg(wt, 8.15, 9.4))


    if door_open_u > 0.02 or door_recoil > 0.02:
        di = min(6, int(max(door_open_u, 0.01) * 6.5))
        # recoil jolt: nudge door a few px before/as it opens
        if door_recoil > 0.02 and door_open_u < 0.25:
            # physical recoil: nudge lift sprite, no HUD rectangle
            paste_lift(base, 0)
            paste_door_flex(base, door_recoil)
        elif door_open_u > 0.02:
            paste_lift(base, di)
        if door_open_u > 0.02:
            soft_door_spill(base, door_open_u)
            if door_open_u < 0.45:
                tiny_dust(base, DOOR[0] + 10, DOOR[1] + 40, door_open_u * 2, wt, n=10)

    # --- Noor ---
    sprite=idle_E[0]; phase='walk'; zoom=1.0; focus=(W/2,H/2); shake=(0,0)
    hint=''; throw_u=0; gust_scale=1.2
    hx=hy=0; ndir='E'

    if wt < 2.3:
        u=ease(seg(wt,0.15,2.25))
        n=path_pos(PATH_TO_WIN, u)
        ndir, wsheet = facing_along(PATH_TO_WIN, u)
        wf=(wt*10)%8
        sprite=blend_sprites(wsheet[int(wf)%8], wsheet[(int(wf)+1)%8], wf%1)
        phase='walk'
        zoom=1.0+0.06*approach
        focus=(lerp(n[0],WIN[0],0.35), lerp(n[1],WIN[1],0.35))
    elif wt < 2.7:
        bu=ease(seg(wt,2.3,2.7))
        n=list(P_WIN); ndir='S'; phase='reach'
        draw_noor(base, walk_E[0], n[0], n[1], alpha=1-bu)
        sprite=pull_S[0]
        hx,hy=hand_pos(*n,'pull','S')
        wind_streaks(base, hx, hy, wt, 0.25+0.4*bu, 'pull', gust_scale)
        hint='E take'
        zoom=1.0+0.15*bu; focus=(P_WIN[0]-20, P_WIN[1]+10)
    elif wt < 4.55:
        n=list(P_WIN); ndir='S'; phase='pull'
        u=seg(wt,2.7,4.4)
        if u<0.28: uu=u/0.28*0.33
        elif u<0.48: uu=0.33+(u-0.28)/0.2*0.17
        elif u<0.68: uu=0.5+(u-0.48)/0.2*0.17
        elif u<0.85: uu=0.67+(u-0.68)/0.17*0.17
        else: uu=0.84+(u-0.85)/0.15*0.16
        sprite=sample_anim(pull_S, clamp(uu,0,1))
        fi=uu*(len(pull_S)-1)
        hx,hy=hand_pos(*n,'pull','S')
        if 12<=fi<=16: n[0]+=4; n[1]-=1
        if fi<18:
            wind_streaks(base, hx, hy, wt, 0.55+0.4*seg(wt,2.7,3.9), 'pull', gust_scale)
        else:
            wind_streaks(base, hx, hy, wt, 0.95, 'wrap', gust_scale)
        zoom=lerp(1.15, 2.0, ease(seg(wt,3.7,4.25)))
        focus=(P_WIN[0]-30, P_WIN[1]+20)
        if fi>=17:
            shake=(rng.uniform(-1.2,1.2)*seg(wt,4.0,4.3), rng.uniform(-0.8,0.8)*seg(wt,4.0,4.3))
            tiny_dust(base, WIN[0], WIN[1]+55, seg(wt,4.0,4.3), wt, n=7)
        hint='E take'
    elif wt < 5.45:
        # CONTINUOUS rip→carry: hold rip with sub-motion, crossfade into carry
        n=list(P_WIN); ndir='S'; phase='bridge'
        bu=ease_in_out(seg(wt,4.55,5.45))
        # sub-motion on rip hold: slight sway via carry breath on pull last frame
        rip = pull_S[-1]
        car = sample_anim(carry_S, (wt*0.9)%1.0)
        sprite=blend_sprites(rip, car, bu)
        hx,hy=hand_pos(*n,'carry','S')
        # gust keeps breathing (sub-motion during "freeze" feel)
        wind_streaks(base, hx, hy, wt, 0.95, 'wrap', gust_scale)
        zoom=lerp(2.0, 1.7, bu)
        focus=(n[0], n[1]-40)
        hint='F throw'
    elif wt < 6.4:
        u=ease(seg(wt,5.45,6.3))
        n=path_pos(PATH_TO_DOOR, u)
        ndir, _ = facing_along(PATH_TO_DOOR, u)
        # prefer S/SE carry sheets for readable arms while moving
        phase='carry'
        sprite=sample_anim(carry_S, (wt*0.9)%1.0)
        # blend walk facing briefly under
        hx,hy=hand_pos(n[0],n[1],'carry','S')
        wind_streaks(base, hx, hy, wt, 0.95, 'wrap', gust_scale)
        zoom=lerp(1.7, 1.05, ease_in_out(seg(wt,5.45,6.2)))
        focus=(n[0], n[1]-40)
        hint='F throw'
    elif wt < 7.85:
        n=list(P_DOOR); phase='throw'
        u=seg(wt,6.4,7.50)
        # Face door (left): prefer SW sheet (3/4 cheat), fall back S
        ndir='SW'
        target = DOOR_CHAIN  # chain / handles
        if u<0.38:
            # anticipation: windup + gust wraps hand/arm
            sprite=sample_anim(hurl_thr, (u/0.38)*0.40)
            hx,hy=hand_pos(*n,'throw','SW')
            wind_streaks(base, hx, hy, wt, 0.95, 'wrap', gust_scale)
            zoom=lerp(1.05, 1.85, ease_in_out(u/0.38))
            focus=((n[0]+target[0])/2, (n[1]+target[1])/2)
            hint='F throw'
        else:
            fu=(u-0.38)/0.62
            # release at ~frame 12/26 ≈ 0.46 of sheet; hold then follow-through
            anim_u=0.42 + fu*0.55
            sprite=sample_anim(hurl_thr, anim_u)
            throw_u=ease_out(fu)  # fast travel after release
            hx,hy=hand_pos(*n,'throw','SW')
            if impact == 'door_impact':
                throw_u = 1.0
                # Gust has ARRIVED — no residual wind mass (avoids oval stack on lock)
                tip = target
            elif throw_u >= 0.98:
                tip = target
            else:
                tip = wind_flight(base, throw_u, (hx,hy), target, wt, scale=gust_scale*1.25)
                if fu<0.35:
                    throw_smear(base, hx, hy, target[0], target[1], 1-fu/0.35)
            zoom=lerp(1.85, 2.0, min(1,fu*2))
            focus=(lerp(n[0], target[0], 0.55), lerp(n[1], target[1], 0.55))
            if throw_u>0.75:
                shake=(rng.uniform(-1.2,1.2)*(throw_u-0.75), rng.uniform(-0.8,0.8)*(throw_u-0.75))
                tiny_dust(base, target[0], target[1], (throw_u-0.75)/0.25, wt, n=10)
            hint=''
    else:
        n=list(P_DOOR); ndir='S'; phase='recover'
        ru=seg(wt,7.85,9.2)
        sprite=sample_anim(hurl_thr, clamp(0.8+ru*0.2,0,1))
        if wt>9.0:
            sprite=blend_sprites(hurl_thr[-1], idle_S[int(wt*5)%6], ease(seg(wt,9.0,10.0)))
        zoom=lerp(2.0, 1.0, ease(seg(wt,7.9,9.5)))
        focus=(DOOR[0]+20, DOOR[1]+50) if wt<9.0 else (n[0], n[1]-30)
        hint=''

    # HEAVY-tier impact (impact_system): spark + punch-zoom + dust — no stroke stacks / grey boxes
    if impact == 'door_impact' or impact_flash_u > 0.05:
        fu = 1.0 if impact == 'door_impact' else impact_flash_u
        if fu > 0.45:
            hit_spark(base, DOOR_CHAIN[0], DOOR_CHAIN[1], 1.0 - fu,
                      TIER, direction=(-0.9, 0.05), torso_w=64)
        if fu > 0.25:
            glowing_sparks(base, DOOR_CHAIN[0], DOOR_CHAIN[1], max(0.05, 1.0 - fu),
                           direction=(-0.85, 0.1), n=TIER.debris_count, seed=wt)
        floor_dust_burst(base, DOOR_CHAIN[0], DOOR[1] + 160, max(0.05, 1.0 - fu),
                         direction=(-0.25, 0.05), strength=TIER.dust_strength)
        zoom = max(zoom, TIER.punch_zoom * (0.88 + 0.12 * fu))
        focus = (DOOR_CHAIN[0], DOOR_CHAIN[1] + 8)
        shake = directional_shake(TIER.shake_amp * max(fu, 0.7), (-1.0, 0.05), wt * 10)

    draw_noor(base, sprite, n[0], n[1])

    # gust in front while carrying / bridge
    if phase in ('carry','bridge') or (phase=='pull' and wt>4.2):
        hx,hy=hand_pos(n[0],n[1],'carry','S')
        wind_streaks(base, hx, hy, wt, 0.85 if phase!='pull' else 0.55, 'wrap', gust_scale)
    if phase=='throw' and throw_u<=0 and wt<6.9:
        hx,hy=hand_pos(n[0],n[1],'throw','SW')
        wind_streaks(base, hx, hy, wt, 0.75, 'wrap', gust_scale)

    # Silhouette / invert impact frames during hit-stop (2-3 frames)
    # Cycle by WALL time t across the freeze window so each freeze frame differs.
    if impact == 'door_impact':
        # freeze wall window ~7.68..8.05
        sub_u = seg(t, 7.68, 8.05)
        sub = min(TIER.impact_frames - 1, int(sub_u * TIER.impact_frames))
        base = make_impact_frame(base, int(DOOR_CHAIN[0]), int(DOOR_CHAIN[1]),
                                 radius=130 + 25 * (TIER.impact_frames - 1 - sub),
                                 tier=TIER, burst_u=sub_u)
        paste_chain_break(base, 0.05 + 0.04 * sub, wt)
        hit_spark(base, DOOR_CHAIN[0], DOOR_CHAIN[1], 0.08 * sub, TIER,
                  direction=(-0.9, 0.05), torso_w=70)
        # punch holds at tier zoom; shake keeps ticking with wall time
        shake = directional_shake(TIER.shake_amp, (-1.0, 0.05), t * 14)
        zoom = TIER.punch_zoom
        focus = (DOOR_CHAIN[0], DOOR_CHAIN[1] + 8)

    framed=apply_cam(base, zoom, focus, shake)
    out=Image.new('RGBA',(W,H),(4,8,12,255))
    out.alpha_composite(framed if framed.mode=='RGBA' else framed.convert('RGBA'))
    hud(out, hint)
    clip=blocked(n[0], n[1], pad=10)
    return out.convert('RGB'), dict(wt=wt, impact=impact, n=n, phase=phase, zoom=zoom, hint=hint, clip=clip)

def closeup(im, cx, cy, r=140):
    x0=clamp(int(cx-r),0,W-1); y0=clamp(int(cy-r),0,H-1)
    x1=clamp(int(cx+r),0,W); y1=clamp(int(cy+r),0,H)
    crop=im.crop((x0,y0,x1,y1))
    return crop.resize((crop.width*2, crop.height*2), Image.LANCZOS)

def main():
    global pull_S, carry_S, hurl_thr
    # pull/carry 24/12 from v7 folder (copied from v6); hurl may be 26
    pull_S=load_seq('pull_side',24,('S','SE'))
    carry_S=load_seq('carry',12,('S',))
    # detect hurl frame count
    n_hurl=0
    for i in range(40):
        if any(os.path.exists(f'{NOOR}/hurl_{d}_{i:02d}.png') for d in ('SE','S','SW')):
            n_hurl=i+1
        else:
            break
    hurl_thr=load_seq('hurl', n_hurl, ('SW','S','SE'))
    print('loaded', len(pull_S), len(carry_S), len(hurl_thr), 'hurl dirs prefer SW')

    # verify path clear
    for label, path in (('to_win', PATH_TO_WIN), ('to_door', PATH_TO_DOOR)):
        for u in np.linspace(0,1,40):
            x,y=path_pos(path, float(u))
            hit=blocked(x,y,pad=12)
            if hit:
                print('WARN path', label, 'hits', hit, 'at', x,y, 'u', u)

    still_at={
        '01-lure': 1.4,
        '02-pull': 3.3,
        '03-rip-bridge': 4.7,
        '04-carry': 5.6,
        '05-throw': 6.95,
        '06-impact': 7.80,
        '07-snap': 8.35,
        '08-door-open': 9.4,
        '09-settle': 10.6,
        '10-impact-1x': 7.80,  # game-scale still (same time, full frame)
    }
    clip_hits=[]; text_hits=[]; ring_flags=[]
    for i in range(NFRAMES):
        t=i/FPS
        im, meta = frame_at(t)
        im.save(f'{FRAMES}/f_{i:04d}.png')
        if meta.get('clip'):
            clip_hits.append((i, meta['clip'], meta['n']))
        if meta.get('hint') and any(w in meta['hint'].upper() for w in ('OPEN','WET','PAPER')):
            text_hits.append((i, meta['hint']))
        for name,ts in still_at.items():
            if abs(t-ts)<0.5/FPS:
                im.save(f'{STILLS}/{name}.png' if not name.endswith('.png') else f'{STILLS}/{name}')
        if i%24==0:
            print(f'  {i}/{NFRAMES} wt={meta["wt"]:.2f} {meta["phase"]} zoom={meta["zoom"]:.2f} clip={meta["clip"]}')

    # unzoomed close-ups
    real_cam = apply_cam
    globals()['apply_cam'] = lambda img, zoom, focus, shake=(0,0): real_cam(img, 1.0, focus, (0,0))
    for ts, name, center in [
        (5.6, 'close-gust-2x.png', None),
        (7.05, 'close-throw-2x.png', None),
        (9.2, 'close-door-2x.png', (DOOR[0]+20, DOOR[1]+40)),
    ]:
        im, meta = frame_at(ts)
        if center is None:
            cx,cy=int(meta['n'][0]), int(meta['n'][1]-45)
        else:
            cx,cy=center
        closeup(im, cx, cy, 150).save(f'{STILLS}/{name}')
        print('close', name, meta['phase'])
    globals()['apply_cam']=real_cam

    mp4=f'{OUT}/beat.mp4'
    subprocess.check_call(['ffmpeg','-y','-framerate',str(FPS),'-i',f'{FRAMES}/f_%04d.png',
        '-c:v','libx264','-pix_fmt','yuv420p','-crf','17', mp4],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.check_call(['ffmpeg','-y','-i',mp4,'-vf','fps=12,scale=640:-1:flags=lanczos','-loop','0', f'{OUT}/beat.gif'],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(V8_MP4):
        subprocess.check_call([
            'ffmpeg','-y','-i',V8_MP4,'-i',mp4,
            '-filter_complex',
            "[0:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1,drawtext=text='v8':x=16:y=16:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.5[a];"
            "[1:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1,drawtext=text='v9':x=16:y=16:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.5[b];"
            '[a][b]hstack=inputs=2',
            '-c:v','libx264','-pix_fmt','yuv420p','-crf','20', f'{OUT}/compare.mp4'
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    # Throw-path distance QA: gust tip must approach DOOR_CHAIN every flight frame
    path_bad=[]; tips=[]
    # Re-sim flight tips without full render
    # Approximate: find frames in throw flight window
    for i in range(NFRAMES):
        tt=i/FPS
        # mirror map_time roughly for throw window — use wall time 6.4-7.7
        if not (6.55 <= tt <= 7.75):
            continue
        u=seg(tt,6.4,7.50)
        if u<0.38: continue
        fu=(u-0.38)/0.62
        throw_u=ease_out(fu)
        # hand approx at P_DOOR throw
        hx,hy = hand_pos(P_DOOR[0], P_DOOR[1], 'throw', 'SW')
        # tip along same bez as wind_flight
        frm=(hx,hy); to=DOOR_CHAIN
        e=ease_out(min(1.0,throw_u))
        mx=(frm[0]+to[0])/2; my=(frm[1]+to[1])/2+18
        tip=((1-e)*(1-e)*frm[0]+2*(1-e)*e*mx+e*e*to[0],
             (1-e)*(1-e)*frm[1]+2*(1-e)*e*my+e*e*to[1])
        dist=math.hypot(tip[0]-to[0], tip[1]-to[1])
        tips.append((i,tt,throw_u,dist,tip))
    for a,b in zip(tips, tips[1:]):
        if b[3] > a[3] + 0.8:  # distance grew
            path_bad.append((a,b))
    print('throw_path tips', len(tips), 'bad_increase', len(path_bad))
    if path_bad[:3]:
        print('  examples', path_bad[:3])

    # Throw-path strip still: 5 frames from release→impact
    if tips:
        idxs=[tips[0][0], tips[len(tips)//4][0], tips[len(tips)//2][0], tips[3*len(tips)//4][0], tips[-1][0]]
        tiles=[]
        for j,fi in enumerate(idxs):
            im=Image.open(f'{FRAMES}/f_{fi:04d}.png').convert('RGB')
            # crop around flight corridor
            x0,y0=80,80; x1,y1=520,420
            tiles.append(im.crop((x0,y0,x1,y1)).resize((220,170), Image.LANCZOS))
        strip=Image.new('RGB',(220*len(tiles)+8*(len(tiles)-1),170),(8,12,16))
        for j,tile in enumerate(tiles):
            strip.paste(tile,(j*(220+8),0))
        strip.save(f'{STILLS}/throw-path-strip.png')
        print('wrote throw-path-strip', idxs)

    # Break close-up sequence (2x): taut → flash → snap → flying links → padlock bounce
    break_times = [7.70, 7.78, 7.88, 8.05, 8.25, 8.50, 8.80, 9.15]  # antic/contact/impact×2/snap/fly/bounce/settle
    # force unzoomed for clear lock read
    real_cam2 = apply_cam
    globals()['apply_cam'] = lambda img, zoom, focus, shake=(0, 0): real_cam2(img, 1.15, (DOOR_CHAIN[0], DOOR_CHAIN[1] + 20), (0, 0))
    tiles = []
    for j, ts in enumerate(break_times):
        im, meta = frame_at(ts)
        cu = closeup(im, DOOR_CHAIN[0], DOOR_CHAIN[1] + 25, 120)
        cu.save(f'{STILLS}/impact-{j+1:02d}-2x.png')
        tiles.append(cu.resize((180, 180), Image.LANCZOS))
        print('impact close', j, meta.get('impact'), meta.get('phase'))
    globals()['apply_cam'] = real_cam2
    stripb = Image.new('RGB', (180 * len(tiles) + 6 * (len(tiles) - 1), 180), (8, 12, 16))
    for j, tile in enumerate(tiles):
        stripb.paste(tile, (j * (180 + 6), 0))
    stripb.save(f'{STILLS}/impact-sequence-strip.png')
    print('wrote impact-sequence-strip')

    print('clip_hits', clip_hits[:10], 'total', len(clip_hits))
    print('text_hits', text_hits)
    print('DONE', mp4)

if __name__=='__main__':
    main()
