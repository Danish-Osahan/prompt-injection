#!/usr/bin/env python3
"""Compose mock-steal/v5: keyframed Noor take/throw + living open gust.
NO radial floor rings / spider-web speed lines. Local object impacts only.
Keeps v4 door lock + v3 blinds plates."""
import os, json, math, subprocess, shutil, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance, ImageChops
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'mock-steal/v5')
STILLS = os.path.join(OUT, 'stills')
FRAMES = os.path.join(OUT, '_frames')
NOOR = os.path.join(ROOT, 'art/render/steal_noor_v5')
COMP_D = os.path.join(ROOT, 'art/render/steal_v4/comp')
COMP_W = os.path.join(ROOT, 'art/render/steal_v3/comp')
ASSETS = os.path.join(ROOT, 'game/public/assets')
V4_MP4 = os.path.join(ROOT, 'mock-steal/v4/beat.mp4')

W, H = 1280, 720
TOP, BOT = 48, 94
FPS = 24
DUR = 10.0
NFRAMES = int(DUR * FPS)
os.makedirs(STILLS, exist_ok=True); os.makedirs(FRAMES, exist_ok=True)
rng = random.Random(5)

def load(p): return Image.open(p).convert('RGBA')
def lerp(a,b,u): return a+(b-a)*u
def ease(u):
    u=max(0.,min(1.,u)); return u*u*(3-2*u)
def ease_in(u):
    u=max(0.,min(1.,u)); return u*u
def ease_out(u):
    u=max(0.,min(1.,u)); return 1-(1-u)*(1-u)
def seg(t,a,b):
    return 0. if b<=a else max(0.,min(1.,(t-a)/(b-a)))
def clamp(v,a,b): return max(a,min(b,v))

office = load(os.path.join(ASSETS,'rooms/office.jpg')).convert('RGBA')
doors = [load(os.path.join(ASSETS,f'office11/door/lift_{i:02d}.jpg')).convert('RGBA') for i in range(10)]
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

def load_seq(prefix, n, dirs=('S',)):
    out=[]
    for i in range(n):
        for d in dirs:
            p=f'{NOOR}/{prefix}_{d}_{i:02d}.png'
            if os.path.exists(p): out.append(load(p)); break
        else:
            raise FileNotFoundError(f'missing {prefix} frame {i}')
    return out

# filled after render check
pull_S = carry_S = hurl_SW = None

door_hang = [Image.open(f'{COMP_D}/door_hang_full_{i:02d}.jpg').convert('RGBA') for i in range(4)]
door_snap = [Image.open(f'{COMP_D}/door_snap_full_{i:02d}.jpg').convert('RGBA') for i in range(12)]
win_fr = [Image.open(f'{COMP_W}/win_full_{i:02d}.jpg').convert('RGBA') for i in range(8)]

FONT=None
for fp in [f'{ASSETS}/fonts/IBMPlexMono-Medium.ttf']:
    if os.path.exists(fp): FONT=fp; break
def font(sz):
    return ImageFont.truetype(FONT, sz) if FONT else ImageFont.load_default()

DOOR=(168,155); WIN=(960,130)
P_START=(420,480); P_WIN=(900,310); P_DOOR=(235,265)
NS=0.78
WIN_BOX=(740,55,1180,220)
DOOR_BOX=(100,50,320,370)
LOCK_BOX=(155,95,255,210)
WIN_FLASH=(820,70,1120,200)

def paste_rgb_region(dst, src_full, box):
    x0,y0,x1,y1=box
    dst.paste(src_full.crop((x0,y0,x1,y1)), (x0,y0))

def draw_noor(canvas, sprite, x, y, scale=NS):
    sc = scale*(192/384) if sprite.width>=300 else scale
    w=max(1,int(sprite.width*sc)); h=max(1,int(sprite.height*sc))
    im=sprite.resize((w,h), Image.LANCZOS)
    px=int(x-w/2); py=int(y-h*0.90)
    sh=Image.new('RGBA', canvas.size,(0,0,0,0))
    d=ImageDraw.Draw(sh); d.ellipse([x-20,y-4,x+20,y+5], fill=(0,0,0,65))
    canvas.alpha_composite(sh); canvas.alpha_composite(im,(px,py))

def hand_pos(nx,ny,dir_='S', phase='carry'):
    # exaggerated for game scale readability
    if phase=='pull':
        return (nx+22, ny-70) if dir_ in ('S','SE') else (nx-8, ny-66)
    if phase=='throw':
        return (nx-6, ny-62) if dir_=='SW' else (nx+18, ny-58)
    # carry: quality around forearm
    if dir_ in ('S','SE'): return (nx+16, ny-58)
    if dir_=='SW': return (nx-12, ny-56)
    return (nx+10, ny-56)

# ---------- living OPEN quality (anime curling strokes) ----------
def _stroke(d, pts, rgba, width):
    if len(pts)<2: return
    d.line(pts, fill=rgba, width=max(1,int(width)))
    # soft core
    if width>=2.5:
        core=(rgba[0],rgba[1],rgba[2], max(8, rgba[3]//3))
        d.line(pts, fill=core, width=max(1,int(width*0.45)))

def _bezier(p0,p1,p2,p3,n=12):
    out=[]
    for i in range(n+1):
        t=i/n; u=1-t
        x=u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0]
        y=u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]
        out.append((x,y))
    return out

def open_gust(canvas, hx, hy, t, strength=1.0, mode='wrap'):
    """Curling wind strokes + rain droplets. Never a flat sash or radial ring."""
    if strength<=0: return
    ov=Image.new('RGBA', canvas.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    s=strength
    if mode=='shimmer':
        # gentle breathing shimmer on takeable window
        for i in range(5):
            a=t*1.4+i*1.1
            rr=18+i*7+3*math.sin(t*2+i)
            aa=int(28*s*(0.55+0.45*math.sin(t*2.2+i)))
            pts=_bezier((hx+math.cos(a)*rr, hy+math.sin(a)*rr*0.45),
                        (hx+math.cos(a+0.6)*rr*1.1, hy+math.sin(a+0.6)*rr*0.5-6),
                        (hx+math.cos(a+1.4)*rr*0.9, hy+math.sin(a+1.4)*rr*0.4+4),
                        (hx+math.cos(a+2.0)*rr*0.7, hy+math.sin(a+2.0)*rr*0.35), n=8)
            _stroke(d, pts, (190,230,255,aa), 1.5+i*0.3)
        canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(0.6)))
        return
    if mode=='pull':
        wx,wy=WIN[0]-20, WIN[1]+40
        for i in range(14):
            u=i/13.0
            wob=math.sin(t*5.5+i*0.9)*10
            p0=(wx+wob*0.3, wy+math.cos(t*3+i)*6)
            p3=(hx+math.sin(t*2+i)*4, hy+math.cos(t*2.5+i)*3)
            mid=((p0[0]+p3[0])/2+math.sin(t*4+i)*18, (p0[1]+p3[1])/2-20-u*8)
            c1=(lerp(p0[0],mid[0],0.4), lerp(p0[1],mid[1],0.5)-8)
            c2=(lerp(mid[0],p3[0],0.4)+8, lerp(mid[1],p3[1],0.5))
            pts=_bezier(p0,c1,c2,p3,n=14)
            aa=int((100+30*math.sin(t*3+i))*s*(1-u*0.2))
            w=2.2+1.8*math.sin(t*2+i*0.5)+u*1.2
            _stroke(d, pts, (210,240,255,clamp(aa,0,200)), w+0.6)
            # droplets along stroke
            if i%2==0:
                x,y=pts[len(pts)//2]
                d.ellipse([x-2,y-3,x+2,y+3], fill=(220,245,255,int(90*s)))
        canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(0.35)))
        return
    if mode=='wrap':
        # orbit + breathe around hand/forearm
        for i in range(9):
            a0=t*2.6+i*(math.pi*2/9)
            rr=10+i*2.4+2.5*math.sin(t*2.1+i)
            # elliptical orbit tilted
            p0=(hx+math.cos(a0)*rr, hy+math.sin(a0)*rr*0.55)
            p1=(hx+math.cos(a0+0.5)*(rr+6), hy+math.sin(a0+0.5)*(rr*0.55)-5)
            p2=(hx+math.cos(a0+1.2)*(rr+2), hy+math.sin(a0+1.2)*(rr*0.55)+6)
            p3=(hx+math.cos(a0+1.8)*rr*0.85, hy+math.sin(a0+1.8)*rr*0.5)
            pts=_bezier(p0,p1,p2,p3,n=10)
            aa=int((95+35*math.sin(t*3+i))*s)
            _stroke(d, pts, (205,238,255,clamp(aa,0,190)), 2.2+1.6*math.sin(t+i)+i*0.2)
        for i in range(14):
            ang=t*3.2+i*0.85; r=8+i*1.7+math.sin(t*4+i)*2
            x=hx+math.cos(ang)*r; y=hy+math.sin(ang)*r*0.55+math.sin(t*5+i)*1.5
            d.ellipse([x-2.0,y-2.8,x+2.0,y+2.8], fill=(225,245,255,int(110*s)))
            if i%3==0:
                d.line([(x,y),(x,y+4+2*math.sin(t+i))], fill=(200,230,255,int(50*s)), width=1)
        canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(0.4)))
        return
    if mode=='flight':
        pass  # handled by open_flight

def open_flight(canvas, u, frm, to, t):
    """Tight twisting gust + droplet trail. No ring."""
    if u<=0 or u>=1: return
    e=ease(u)
    cx=(frm[0]+to[0])/2; cy=min(frm[1],to[1])-70
    def bez(tt):
        return ((1-tt)*(1-tt)*frm[0]+2*(1-tt)*tt*cx+tt*tt*to[0],
                (1-tt)*(1-tt)*frm[1]+2*(1-tt)*tt*cy+tt*tt*to[1])
    ov=Image.new('RGBA',canvas.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    # twisting ribbon of curved strokes along path
    for k in range(16):
        v=e-k*0.028
        if v<=0: continue
        x,y=bez(v)
        tang=bez(min(1,v+0.04)); ang=math.atan2(tang[1]-y, tang[0]-x)
        twist=math.sin(t*8+k*0.7)*10*(1-k/16)
        nx,ny=-math.sin(ang), math.cos(ang)
        p0=(x+nx*twist, y+ny*twist*0.7)
        p3=(x-nx*twist*0.6+math.cos(ang)*14, y-ny*twist*0.4+math.sin(ang)*10)
        c1=(p0[0]+math.cos(ang+0.4)*8, p0[1]+math.sin(ang+0.4)*6)
        c2=(p3[0]-math.cos(ang)*6, p3[1]-math.sin(ang)*4)
        pts=_bezier(p0,c1,c2,p3,n=8)
        aa=int(120*(1-k/16)*(1-u*0.12))
        _stroke(d, pts, (200,236,255,aa), 2.4-(k*0.08))
        if k%2==0:
            d.ellipse([x-2.2,y-2.8,x+2.2,y+2.8], fill=(225,245,255,int(aa*1.1)))
    tip=bez(e)
    # tip nucleus — small, not a shockwave ring
    d.ellipse([tip[0]-6,tip[1]-5,tip[0]+6,tip[1]+5], fill=(220,245,255,int(90*(1-u*0.3))))
    canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(0.35)))

def local_flash(canvas, box, kind='punch', strength=0.85):
    """Flash only the hit object region — no full-screen spider rings."""
    x0,y0,x1,y1=box
    crop=canvas.crop((x0,y0,x1,y1)).convert('RGB')
    a=np.array(crop, dtype=np.float32)
    if kind=='invert':
        out=(255-a)*0.8 + a*0.2
    elif kind=='white':
        out=a*0.25 + 220
    else:  # punch / silhouette lift
        out=np.clip((a-20)*1.55, 0, 255)
    out=a*(1-strength)+out*strength
    flashed=Image.fromarray(np.clip(out,0,255).astype(np.uint8)).convert('RGBA')
    # soft edge
    mask=Image.new('L', (x1-x0,y1-y0), 0)
    md=ImageDraw.Draw(mask)
    md.rounded_rectangle([2,2,x1-x0-3,y1-y0-3], radius=18, fill=int(255*strength))
    mask=mask.filter(ImageFilter.GaussianBlur(6))
    canvas.paste(flashed, (x0,y0), mask)

def local_debris(canvas, cx, cy, u, t, kind='window'):
    if u<=0 or u>=1: return
    ov=Image.new('RGBA', canvas.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    n=14 if kind=='door' else 10
    for i in range(n):
        ang=-0.2+i*(math.pi*1.1/n)+0.15*math.sin(i)
        dist=(8+u*38+i*2)*(0.7+0.3*math.sin(t+i))
        x=cx+math.cos(ang)*dist
        y=cy+math.sin(ang)*dist*0.55 - u*12
        aa=int(140*(1-u)*(1-i/n))
        if kind=='door':
            # chain/link chips
            d.rectangle([x-2,y-1.5,x+3,y+1.5], fill=(160,168,180,aa))
        else:
            # mist / dust puffs
            d.ellipse([x-3,y-2,x+3,y+2], fill=(210,225,235,aa))
            d.ellipse([x-5,y-3,x+5,y+3], fill=(190,210,220,aa//2))
    canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(0.5)))

def apply_cam(img, zoom, focus, shake=(0,0)):
    im=img
    if zoom>1.001:
        cw,ch=W/zoom,H/zoom; fx,fy=focus
        left=max(0,min(W-cw,fx-cw/2)); top=max(0,min(H-ch,fy-ch/2))
        im=im.crop((int(left),int(top),int(left+cw),int(top+ch))).resize((W,H), Image.LANCZOS)
    if shake!=(0,0):
        blank=Image.new('RGBA', (W,H), (4,8,12,255))
        blank.alpha_composite(im, (int(shake[0]), int(shake[1])))
        im=blank
    return im

def hud(canvas, cap, hint):
    d=ImageDraw.Draw(canvas)
    d.rectangle([0,0,W,TOP], fill=(4,8,12,255))
    d.rectangle([0,H-BOT,W,H], fill=(4,8,12,255))
    if hint:
        f=font(13); bb=d.textbbox((0,0),hint,font=f); tw=bb[2]-bb[0]
        d.text(((W-tw)//2,H-22), hint, font=f, fill=(180,200,210,140))
    if cap:
        f=font(22); bb=d.textbbox((0,0),cap,font=f); tw=bb[2]-bb[0]; th=bb[3]-bb[1]
        pad=14; x0=(W-tw)//2-pad; y0=H-BOT+30
        d.rounded_rectangle([x0,y0,x0+tw+pad*2,y0+th+12], radius=8, fill=(4,12,18,185))
        d.text((x0+pad,y0+6), cap, font=f, fill=(232,238,242,255))

def frame_at(t):
    """
    Timeline (~10s):
    0.0-1.6 walk to window
    1.6-2.0 antic reach
    2.0-3.6 pull (dig, resist, tug, rip) + window slam
    3.6-3.85 window hit-stop (~5 frames)
    3.85-5.4 carry idle + walk toward door
    5.4-6.4 throw windup + flight
    6.4-6.65 door hit-stop
    6.65-8.4 snap + door open
    8.4-10 settle
    """
    # hit-stop mapping
    HIT_W0, HIT_W1 = 3.58, 3.80
    HIT_D0, HIT_D1 = 6.55, 6.78

    def map_time(t):
        if t < HIT_W0: return t, None
        if t < HIT_W1: return HIT_W0, 'window'
        if t < HIT_D0: return HIT_W0 + (t - HIT_W1), None
        if t < HIT_D1: return HIT_W0 + (HIT_D0 - HIT_W1), 'door'
        return HIT_W0 + (HIT_D0 - HIT_W1) + (t - HIT_D1), None

    wt, impact = map_time(t)

    base = office.copy()
    # rain ambient while window open
    win_open = 1.0 - ease(seg(wt, 3.15, 3.55))
    if rain_amb and win_open > 0.05:
        ri = rain_amb[int(wt*8) % len(rain_amb)].copy()
        ri.putalpha(ri.split()[-1].point(lambda a: int(a*win_open*0.7)))
        base.alpha_composite(ri)

    # window plate
    if wt < 2.9:
        wi = int(wt*2) % 4  # open loop frames 0-3
        paste_rgb_region(base, win_fr[wi], WIN_BOX)
    elif wt < 3.55:
        # slam sequence frames 4-7
        u = seg(wt, 2.9, 3.55)
        wi = 4 + int(u * 3.99)
        paste_rgb_region(base, win_fr[min(7,wi)], WIN_BOX)
    else:
        paste_rgb_region(base, win_fr[7], WIN_BOX)

    # door plate
    snap_i = 0
    door_open_u = 0.0
    if wt < 6.2:
        hi = int(wt*3) % 4
        # strain: amplify hang sway near throw arrival
        paste_rgb_region(base, door_hang[hi], DOOR_BOX)
    elif wt < 7.6:
        u = seg(wt, 6.2, 7.5)
        # hold early frames for strain/rattle then snap
        if u < 0.12:
            snap_i = 0
        else:
            snap_i = min(11, int(((u-0.12)/0.88)*11))
        paste_rgb_region(base, door_snap[snap_i], DOOR_BOX)
        door_open_u = ease_out(seg(wt, 6.9, 8.2))
    else:
        paste_rgb_region(base, door_snap[11], DOOR_BOX)
        door_open_u = ease_out(seg(wt, 6.9, 8.2))

    if door_open_u > 0.02:
        di = min(9, int(door_open_u * 9.5))
        # eased overshoot: go to 9 then settle
        if 0.85 < door_open_u < 0.95:
            di = 9
        paste_rgb_region(base, doors[di], (110, 90, 290, 340))
        # light spill on floor
        spill=Image.new('RGBA', base.size, (0,0,0,0))
        sd=ImageDraw.Draw(spill)
        aa=int(70*door_open_u)
        sd.polygon([(155,300),(210,300),(280,420),(90,420)], fill=(255,230,180,aa))
        base.alpha_composite(spill.filter(ImageFilter.GaussianBlur(8)))

    # shimmer on window before take
    if 0.8 < wt < 2.05:
        open_gust(base, WIN[0]+10, WIN[1]+50, wt, strength=0.55+0.25*math.sin(wt*3), mode='shimmer')

    # --- Noor state machine ---
    n=list(P_START); ndir='E'; sprite=idle_E[0]; phase='walk'
    hx=hy=0; gust_mode=None; gust_s=0; throw_u=0; throw_from=None; throw_to=None
    zoom=1.0; focus=(W/2,H/2); shake=(0,0)
    cap=''; hint='E take · F throw'
    local_imp=None; local_u=0; debris_u=0; debris_kind='window'

    if wt < 1.55:
        u=ease(seg(wt,0.15,1.55))
        n=[lerp(P_START[0],P_WIN[0],u), lerp(P_START[1],P_WIN[1],u)]
        sprite=walk_E[int(wt*10)%8]; ndir='E'; hint='walk to the window'
    elif wt < 2.05:
        n=list(P_WIN); ndir='S'
        # anticipation frames 0-1 of pull
        fi=min(1, int(seg(wt,1.55,2.05)*2))
        sprite=pull_S[fi]; phase='pull'
        hx,hy=hand_pos(*n, ndir, 'pull')
        open_gust(base, WIN[0]-10, WIN[1]+45, wt, 0.4, 'pull')
        open_gust(base, hx, hy, wt, 0.25, 'wrap')
        cap='…habit.'; hint='E — take OPEN'
        zoom=lerp(1.0,1.08,seg(wt,1.7,2.05)); focus=(P_WIN[0], P_WIN[1]-20)
    elif wt < 3.58:
        n=list(P_WIN); ndir='S'; phase='pull'
        # pull frames 2-15 mapped across dig/resist/tug/rip/settle
        u=seg(wt,2.05,3.55)
        # non-linear: linger on dig + tug
        if u<0.18: fi=2+int((u/0.18)*2)          # dig 2-3
        elif u<0.38: fi=4+int(((u-0.18)/0.2)*2)   # resist 4-5
        elif u<0.55: fi=6+int(((u-0.38)/0.17)*2)  # tug 6-7
        elif u<0.72: fi=8+int(((u-0.55)/0.17)*2)  # rip 8-9
        else: fi=10+int(((u-0.72)/0.28)*5)         # settle 10-15
        fi=clamp(fi,0,len(pull_S)-1)
        sprite=pull_S[fi]
        hx,hy=hand_pos(*n, ndir, 'pull')
        # body tug: nudge position forward during tug
        if 6<=fi<=7:
            n[0]+=6; n[1]-=2
        if fi<=7:
            open_gust(base, hx, hy, wt, 0.55+0.35*seg(wt,2.0,3.2), 'pull')
        else:
            open_gust(base, hx, hy, wt, 0.9, 'wrap')
        if fi>=8:
            cap='OPEN'
            zoom=lerp(1.08,1.16,seg(wt,3.15,3.5)); focus=(P_WIN[0]-30,P_WIN[1]+10)
            shake=(rng.uniform(-2,2)*seg(wt,3.2,3.5), rng.uniform(-1,1)*seg(wt,3.2,3.5))
            local_u=seg(wt,3.2,3.55); debris_u=seg(wt,3.25,3.7); debris_kind='window'
        hint='E — take OPEN'
    elif wt < 5.35:
        # carry + walk to door
        u=ease(seg(wt,3.85,5.2))
        n=[lerp(P_WIN[0], P_DOOR[0], u), lerp(P_WIN[1], P_DOOR[1], u)]
        ndir='SW' if u>0.35 else 'S'
        sprite=carry_S[int(wt*7)%len(carry_S)]
        phase='carry'
        hx,hy=hand_pos(*n, 'S', 'carry')
        open_gust(base, hx, hy, wt, 0.85, 'wrap')
        cap='OPEN'; hint='F — throw'
        zoom=lerp(1.1,1.0,seg(wt,3.85,4.4)); focus=(n[0],n[1]-40)
    elif wt < 6.55:
        n=list(P_DOOR); ndir='SW'; phase='throw'
        u=seg(wt,5.35,6.5)
        if u<0.45:
            fi=min(4, int((u/0.45)*5))  # windup 0-4
            sprite=hurl_SW[fi]
            hx,hy=hand_pos(*n, 'SW', 'throw')
            open_gust(base, hx, hy, wt, 0.8, 'wrap')
            zoom=lerp(1.0,1.12,u/0.45); focus=(DOOR[0]+20, DOOR[1]+10)
            cap='OPEN'; hint='F — throw'
        else:
            fu=(u-0.45)/0.55
            fi=5+min(8, int(fu*9))
            sprite=hurl_SW[min(len(hurl_SW)-1, fi)]
            throw_u=ease(fu)
            hx,hy=hand_pos(*n, 'SW', 'throw')
            throw_from=(hx,hy); throw_to=(DOOR[0]+15, DOOR[1]+25)
            open_flight(base, throw_u, throw_from, throw_to, wt)
            if throw_u>0.75:
                local_u=(throw_u-0.75)/0.25; debris_u=local_u; debris_kind='door'
                shake=(rng.uniform(-3,3)*local_u, rng.uniform(-2,2)*local_u)
            zoom=1.14; focus=(DOOR[0]+10, DOOR[1]+20)
            cap=''; hint=''
    else:
        n=list(P_DOOR); ndir='SW'
        # recovery frames
        fi=min(len(hurl_SW)-1, 10+int(seg(wt,6.55,8.0)*3))
        sprite=hurl_SW[fi]
        phase='recover'
        if wt < 7.2:
            local_u=max(0, 1-seg(wt,6.55,7.1))
            debris_u=seg(wt,6.55,7.3)*(1-seg(wt,7.0,7.5))
            debris_kind='door'
            shake=(rng.uniform(-2,2)*local_u*0.6, rng.uniform(-1,1)*local_u*0.6)
            zoom=lerp(1.14,1.05,seg(wt,6.8,7.8)); focus=(DOOR[0]+10,DOOR[1]+30)
        else:
            zoom=lerp(1.05,1.0,seg(wt,7.8,9.0)); focus=(n[0],n[1]-30)
            sprite=idle_S[int(wt*5)%6]; ndir='S'
        cap=''; hint=''

    # local impact on OBJECTS only (before Noor, so she isn't washed out)
    if impact=='window' or (local_u>0 and debris_kind=='window' and wt<4.2):
        strength=0.85 if impact=='window' else 0.5*local_u
        kind='invert' if (impact=='window' and (t*FPS)%3<1.2) else 'punch'
        local_flash(base, WIN_FLASH, kind=kind, strength=strength)
        local_debris(base, P_WIN[0]-30, P_WIN[1]+20, max(local_u, 0.5 if impact else 0), wt, 'window')
    if impact=='door' or (local_u>0 and debris_kind=='door'):
        strength=0.88 if impact=='door' else 0.45*local_u
        kind='white' if (impact=='door' and (t*FPS)%3<1) else 'punch'
        local_flash(base, LOCK_BOX, kind=kind, strength=strength)
        local_debris(base, DOOR[0]+10, DOOR[1]+20, max(local_u, 0.5 if impact else 0), wt, 'door')

    draw_noor(base, sprite, n[0], n[1])

    # re-draw wrap on top of Noor when carrying so strokes read in front
    if phase in ('carry',) or (phase=='pull' and wt>3.2 and wt<3.58):
        hx,hy=hand_pos(n[0],n[1],'S','carry')
        open_gust(base, hx, hy, wt, 0.75 if phase=='carry' else 0.55, 'wrap')
    if phase=='throw' and throw_u<=0:
        hx,hy=hand_pos(n[0],n[1],'SW','throw')
        open_gust(base, hx, hy, wt, 0.7, 'wrap')

    framed=apply_cam(base, zoom, focus, shake)
    out_rgba=Image.new('RGBA',(W,H),(4,8,12,255))
    out_rgba.alpha_composite(framed if framed.mode=='RGBA' else framed.convert('RGBA'))
    hud(out_rgba, cap, hint)
    return out_rgba.convert('RGB'), dict(wt=wt, impact=impact, n=n, phase=phase)

def closeup(im, cx, cy, r=130):
    x0=clamp(int(cx-r),0,W-1); y0=clamp(int(cy-r),0,H-1)
    x1=clamp(int(cx+r),0,W); y1=clamp(int(cy+r),0,H)
    crop=im.crop((x0,y0,x1,y1))
    return crop.resize((crop.width*2, crop.height*2), Image.LANCZOS)

def main():
    global pull_S, carry_S, hurl_SW
    pull_S = load_seq('pull_side', 16, ('S','SE'))
    carry_S = load_seq('carry', 6, ('S',))
    hurl_SW = load_seq('hurl', 14, ('SW','S'))
    print('loaded', len(pull_S), len(carry_S), len(hurl_SW), 'noor frames')

    still_at = {
        '01-establish': 0.6,
        '02-anticipation': 1.85,
        '03-tug': 2.85,
        '04-rip-window': 3.45,
        '05-carry': 4.5,
        '06-throw-windup': 5.7,
        '07-door-hit': 6.6,
        '08-door-open': 8.0,
    }
    close_grab = {}
    paths=[]
    for i in range(NFRAMES):
        t=i/FPS
        im, meta = frame_at(t)
        fp=f'{FRAMES}/f_{i:04d}.png'
        im.save(fp); paths.append(fp)
        for name, ts in still_at.items():
            if abs(t-ts)<0.5/FPS:
                im.save(f'{STILLS}/{name}.png')
        # close-up grabs
        if abs(t-2.55)<0.5/FPS: close_grab['pull']=im.copy()
        if abs(t-4.5)<0.5/FPS: close_grab['carry']=im.copy()
        if abs(t-6.15)<0.5/FPS: close_grab['throw']=im.copy()
        if abs(t-7.05)<0.5/FPS: close_grab['snap']=im.copy()
        if i%24==0: print(f'  frame {i}/{NFRAMES} wt={meta["wt"]:.2f} {meta["phase"]}')

    if 'pull' in close_grab:
        closeup(close_grab['pull'], P_WIN[0]-40, P_WIN[1]+80, 150).save(f'{STILLS}/close-pull-2x.png')
    if 'carry' in close_grab:
        closeup(close_grab['carry'], 560, 300, 120).save(f'{STILLS}/close-carry-2x.png')
    if 'throw' in close_grab:
        closeup(close_grab['throw'], P_DOOR[0]+30, P_DOOR[1]+50, 150).save(f'{STILLS}/close-throw-2x.png')
    if 'snap' in close_grab:
        closeup(close_grab['snap'], DOOR[0]+20, DOOR[1]+40, 130).save(f'{STILLS}/close-door-snap-2x.png')

    mp4=f'{OUT}/beat.mp4'
    subprocess.check_call([
        'ffmpeg','-y','-framerate',str(FPS),'-i',f'{FRAMES}/f_%04d.png',
        '-c:v','libx264','-pix_fmt','yuv420p','-crf','18', mp4
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    # gif
    subprocess.check_call([
        'ffmpeg','-y','-i',mp4,'-vf','fps=12,scale=640:-1:flags=lanczos','-loop','0', f'{OUT}/beat.gif'
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    # compare v4 vs v5
    if os.path.exists(V4_MP4):
        subprocess.check_call([
            'ffmpeg','-y','-i',V4_MP4,'-i',mp4,
            '-filter_complex','[0:v]scale=640:360,setsar=1,pad=1280:720:0:180:black,drawtext=text=v4:x=20:y=200:fontsize=28:fontcolor=white[left];'
            '[1:v]scale=640:360,setsar=1,pad=1280:720:640:180:black,drawtext=text=v5:x=660:y=200:fontsize=28:fontcolor=white[right];'
            '[left][right]overlay=0:0',
            '-c:v','libx264','-pix_fmt','yuv420p','-crf','20', f'{OUT}/compare.mp4'
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print('DONE', mp4)

if __name__=='__main__':
    main()
