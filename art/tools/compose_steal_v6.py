#!/usr/bin/env python3
"""Compose mock-steal/v6: living window lure, smooth blended Noor, no blur boxes, no quality text."""
import os, math, json, subprocess, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops, ImageEnhance
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'mock-steal/v6')
STILLS = os.path.join(OUT, 'stills')
FRAMES = os.path.join(OUT, '_frames')
NOOR = os.path.join(ROOT, 'art/render/steal_noor_v6')
COMP_D = os.path.join(ROOT, 'art/render/steal_v4/comp')
COMP_W = os.path.join(ROOT, 'art/render/steal_v3/comp')
ASSETS = os.path.join(ROOT, 'game/public/assets')
V5_MP4 = os.path.join(ROOT, 'mock-steal/v5/beat.mp4')

W, H = 1280, 720
TOP, BOT = 48, 94
FPS = 24
DUR = 11.0
NFRAMES = int(DUR * FPS)
os.makedirs(STILLS, exist_ok=True); os.makedirs(FRAMES, exist_ok=True)
rng = random.Random(7)

def load(p): return Image.open(p).convert('RGBA')
def lerp(a,b,u): return a+(b-a)*u
def ease(u):
    u=max(0.,min(1.,u)); return u*u*(3-2*u)
def ease_in_out(u):
    u=max(0.,min(1.,u))
    return 3*u*u - 2*u*u*u
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
            raise FileNotFoundError(f'missing {prefix} {i}')
    return out

pull_S = carry_S = hurl_SW = None
# hand meta
HAND = {}
def load_hands():
    global HAND
    mp=f'{NOOR}/meta12.json'
    if os.path.exists(mp):
        HAND=json.load(open(mp))

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
# desk near window for paper flutter
DESK_PAPERS = [(820,340),(845,355),(870,335),(800,360)]

def paste_rgb_region(dst, src_full, box):
    x0,y0,x1,y1=box
    dst.paste(src_full.crop((x0,y0,x1,y1)), (x0,y0))

def blend_sprites(a, b, u):
    """Crossfade two RGBA sprites same size."""
    if u<=0: return a
    if u>=1: return b
    if a.size!=b.size:
        b=b.resize(a.size, Image.LANCZOS)
    return Image.blend(a, b, u)

def sample_anim(frames, u):
    """u in [0,1] across animation; blend between neighbors."""
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
    return (px,py,w,h)

def hand_from_meta(anim, dir_, fi, nx, ny, fallback):
    """Project stored hand px (in 192 frame) to screen."""
    try:
        hands = HAND[anim]['hand'][dir_]
        hx192, hy192 = hands[int(clamp(fi,0,len(hands)-1))]
        # sprite drawn with foot at (nx,ny), frame is 384 rendered then scaled
        sc = NS*(192/384)
        # hand coords in 1x frame space (192): foot ~ FOOT_Y
        # approximate: center of sprite at nx, top at ny-h*0.9
        # use fallback offset refined by meta delta from center
        cx, cy = 96, 96
        return (nx + (hx192 - cx)*sc*2.0, ny - (192-hy192)*sc*0.9 - 20)
    except Exception:
        return fallback

def hand_pos(nx, ny, phase='carry', dir_='S'):
    if phase=='pull':
        return (nx+24, ny-72) if dir_ in ('S','SE') else (nx-6, ny-68)
    if phase=='throw':
        return (nx-8, ny-64) if dir_=='SW' else (nx+20, ny-60)
    return (nx+18, ny-60) if dir_ in ('S','SE') else (nx-14, ny-58)

# ---------- gust (2-3x Noor ≈ 120-150px) ----------
def _bezier(p0,p1,p2,p3,n=12):
    out=[]
    for i in range(n+1):
        t=i/n; u=1-t
        x=u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0]
        y=u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]
        out.append((x,y))
    return out

def _stroke(d, pts, rgba, width):
    if len(pts)<2: return
    d.line(pts, fill=rgba, width=max(1,int(width)))
    if width>=2.5:
        d.line(pts, fill=(rgba[0],rgba[1],rgba[2], max(8,rgba[3]//3)), width=max(1,int(width*0.4)))

def open_gust(canvas, hx, hy, t, strength=1.0, mode='wrap', scale=1.0):
    if strength<=0: return
    ov=Image.new('RGBA', canvas.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    s=strength; sc=scale
    if mode=='shimmer':
        for i in range(6):
            a=t*1.6+i*1.05
            rr=(22+i*9+4*math.sin(t*2.2+i))*sc
            aa=int((22+18*math.sin(t*2.5+i))*s)
            pts=_bezier((hx+math.cos(a)*rr, hy+math.sin(a)*rr*0.4),
                        (hx+math.cos(a+0.7)*rr*1.15, hy+math.sin(a+0.7)*rr*0.45-8*sc),
                        (hx+math.cos(a+1.5)*rr*0.95, hy+math.sin(a+1.5)*rr*0.38+5*sc),
                        (hx+math.cos(a+2.1)*rr*0.7, hy+math.sin(a+2.1)*rr*0.32), n=8)
            _stroke(d, pts, (185,228,255,clamp(aa,0,90)), 1.4+i*0.25)
        canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(0.5))); return
    if mode=='pull':
        wx,wy=WIN[0]-15, WIN[1]+42
        for i in range(16):
            u=i/15.0
            wob=math.sin(t*5.5+i)*12*sc
            p0=(wx+wob*0.3, wy+math.cos(t*3+i)*7)
            p3=(hx+math.sin(t*2+i)*5, hy+math.cos(t*2.5+i)*4)
            mid=((p0[0]+p3[0])/2+math.sin(t*4+i)*22*sc, (p0[1]+p3[1])/2-28*sc-u*10)
            c1=(lerp(p0[0],mid[0],0.4), lerp(p0[1],mid[1],0.5)-10*sc)
            c2=(lerp(mid[0],p3[0],0.4)+10, lerp(mid[1],p3[1],0.5))
            pts=_bezier(p0,c1,c2,p3,n=16)
            aa=int((110+30*math.sin(t*3+i))*s*(1-u*0.15))
            _stroke(d, pts, (210,240,255,clamp(aa,0,210)), (2.8+2.2*math.sin(t+i)+u)*sc)
            if i%2==0:
                x,y=pts[len(pts)//2]
                d.ellipse([x-2.5*sc,y-3.5*sc,x+2.5*sc,y+3.5*sc], fill=(225,245,255,int(100*s)))
        canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(0.3))); return
    if mode=='wrap':
        # 2-3x Noor but FOREARM wrap (raised, figure-8 / curl) — not floor rings
        hy2 = hy - 8*sc
        for i in range(11):
            a0=t*2.6+i*(math.pi*2/11)
            rr=(32+i*5.0+6*math.sin(t*2+i))*sc
            # vertical bias so strokes sit around hand/forearm
            p0=(hx+math.cos(a0)*rr, hy2+math.sin(a0)*rr*0.35 - 6*sc)
            p1=(hx+math.cos(a0+0.6)*(rr+16*sc), hy2+math.sin(a0+0.6)*rr*0.3 - 18*sc)
            p2=(hx+math.cos(a0+1.3)*(rr+6*sc), hy2+math.sin(a0+1.3)*rr*0.4 + 4*sc)
            p3=(hx+math.cos(a0+2.0)*rr*0.8, hy2+math.sin(a0+2.0)*rr*0.3)
            pts=_bezier(p0,p1,p2,p3,n=12)
            aa=int((95+40*math.sin(t*3+i))*s)
            _stroke(d, pts, (205,238,255,clamp(aa,0,210)), (2.8+2.0*math.sin(t+i))*sc)
        for i in range(16):
            ang=t*3.2+i*0.75; r=(16+i*3.5)*sc
            x=hx+math.cos(ang)*r; y=hy2+math.sin(ang)*r*0.32+math.sin(t*5+i)*2
            d.ellipse([x-2.4*sc,y-3.2*sc,x+2.4*sc,y+3.2*sc], fill=(225,245,255,int(125*s)))
            if i%3==0:
                d.line([(x,y),(x-1,y+6*sc)], fill=(200,230,255,int(55*s)), width=1)
        canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(0.3))); return

def open_flight(canvas, u, frm, to, t, scale=1.0):
    if u<=0 or u>=1: return
    e=ease(u); sc=scale
    cx=(frm[0]+to[0])/2; cy=min(frm[1],to[1])-80*sc
    def bez(tt):
        return ((1-tt)*(1-tt)*frm[0]+2*(1-tt)*tt*cx+tt*tt*to[0],
                (1-tt)*(1-tt)*frm[1]+2*(1-tt)*tt*cy+tt*tt*to[1])
    ov=Image.new('RGBA',canvas.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    for k in range(20):
        v=e-k*0.026
        if v<=0: continue
        x,y=bez(v)
        tang=bez(min(1,v+0.04)); ang=math.atan2(tang[1]-y, tang[0]-x)
        twist=math.sin(t*8+k*0.7)*16*sc*(1-k/20)
        nx,ny=-math.sin(ang), math.cos(ang)
        p0=(x+nx*twist, y+ny*twist*0.7)
        p3=(x-nx*twist*0.5+math.cos(ang)*18*sc, y-ny*twist*0.35+math.sin(ang)*12*sc)
        pts=_bezier(p0,(p0[0]+math.cos(ang+0.5)*10,p0[1]+math.sin(ang+0.5)*8),
                    (p3[0]-math.cos(ang)*8,p3[1]-math.sin(ang)*5),p3,n=8)
        aa=int(130*(1-k/20)*(1-u*0.1))
        _stroke(d, pts, (205,238,255,aa), (3.2-k*0.06)*sc)
        if k%2==0:
            d.ellipse([x-2.8*sc,y-3.2*sc,x+2.8*sc,y+3.2*sc], fill=(230,248,255,int(aa*1.1)))
    tip=bez(e)
    d.ellipse([tip[0]-8*sc,tip[1]-6*sc,tip[0]+8*sc,tip[1]+6*sc], fill=(220,245,255,int(100*(1-u*0.25))))
    canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(0.3)))

def tiny_dust(canvas, cx, cy, u, t, n=8):
    """Small soft particles ONLY — never a blur rectangle."""
    if u<=0: return
    ov=Image.new('RGBA', canvas.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    for i in range(n):
        ang=-0.4+i*(math.pi/n)+0.2*math.sin(i+t)
        dist=6+u*22+i*1.5
        x=cx+math.cos(ang)*dist*0.9
        y=cy+math.sin(ang)*dist*0.35 - u*8
        aa=int(90*(1-u)*(1-i/n))
        r=1.2+0.6*math.sin(t+i)
        d.ellipse([x-r,y-r*0.8,x+r,y+r*0.8], fill=(210,225,235,aa))
    canvas.alpha_composite(ov)

def living_window(canvas, t, approach, open_amt=1.0):
    """Window acts alive: sway blinds via frame, rain in, scraps, pulse, desk flutter.
    approach 0..1 as Noor nears."""
    if open_amt<=0.02: return
    # blinds sway: blend open frames 0-3
    sway = 0.5+0.5*math.sin(t*3.2)
    clack = 0.5+0.5*math.sin(t*7.1)  # faster clack
    wi_a = int(sway*2.99) % 4
    wi_b = (wi_a+1)%4
    # paste blended window region
    a=win_fr[wi_a].crop(WIN_BOX); b=win_fr[wi_b].crop(WIN_BOX)
    blended=Image.blend(a,b, ease(sway*2%1))
    # paste blinds first (no flat rectangular color wash)
    canvas.paste(blended, (WIN_BOX[0], WIN_BOX[1]))
    # cool light = soft ELLIPSE glow near glass, never a full-box wash
    pulse=0.55+0.45*math.sin(t*2.4)
    pulse *= (0.35+0.65*approach)*open_amt
    if pulse > 0.05:
        glow=Image.new('RGBA', canvas.size, (0,0,0,0)); gd=ImageDraw.Draw(glow)
        cx, cy = WIN[0]+10, WIN[1]+55
        for k, mul in ((90, 0.22), (55, 0.35), (28, 0.5)):
            aa=int(70*pulse*mul)
            gd.ellipse([cx-k, cy-k*0.45, cx+k, cy+k*0.45], fill=(140,190,230,aa))
        canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(4)))

    ov=Image.new('RGBA', canvas.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    # rain streaks blowing inward
    for i in range(18):
        x0=WIN[0]-40+ (i*17 + t*40)%280
        y0=WIN[1]+20+ (i*11)%70
        length=10+8*approach
        aa=int((50+40*approach)*open_amt*(0.6+0.4*math.sin(t*6+i)))
        d.line([(x0,y0),(x0-8*approach-4, y0+length)], fill=(190,220,245,aa), width=1)
        if i%3==0:
            d.ellipse([x0-1.5,y0-1.5,x0+1.5,y0+1.5], fill=(220,240,255,aa+20))
    # leaves / paper scraps drifting off sill toward Noor (small, soft)
    for i in range(5):
        u=((t*0.28+i*0.18)%1.0)
        x=lerp(WIN[0]+30, P_WIN[0]-20, u)+math.sin(t*1.8+i)*14
        y=lerp(WIN[1]+85, P_WIN[1]-5, u)+math.sin(t*2.4+i)*8
        aa=int(110*open_amt*(1-u*0.55)*(0.35+0.65*approach))
        if i%2==0:
            d.ellipse([x-3,y-1.5,x+3,y+1.5], fill=(160,185,145,aa))  # soft leaf
            d.ellipse([x-2,y-1,x+2,y+1], fill=(190,210,170,aa//2))
        else:
            # thin paper diamond, not a chunky square
            d.polygon([(x,y-2),(x+4,y),(x,y+2),(x-3,y)], fill=(225,228,232,aa))
    # desk papers flutter near window
    for i,(px,py) in enumerate(DESK_PAPERS):
        flap=math.sin(t*8+i*1.7)*2.5*approach*open_amt
        aa=int(120*open_amt*(0.5+0.5*approach))
        d.polygon([(px,py+flap),(px+12,py+flap*0.4),(px+11,py+5),(px+1,py+5)], fill=(230,232,236,aa))
    canvas.alpha_composite(ov)

    # stronger shimmer as approach
    open_gust(canvas, WIN[0]+10, WIN[1]+55, t, strength=(0.35+0.65*approach)*open_amt, mode='shimmer', scale=1.0+0.4*approach)

def door_rattle(canvas, t, intense=0.0):
    """Soft occasional chain rattle via hang frames + nudge."""
    # base hang cycle
    hi = int(t*2.5 + (3 if (int(t*0.7)%5==0) else 0)) % 4
    # occasional stronger: pick hang with offset
    paste_rgb_region(canvas, door_hang[hi], DOOR_BOX)
    if intense>0 or (int(t*3)%11==0):
        ov=Image.new('RGBA', canvas.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
        # tiny vibration marks near lock — NOT a big flash
        cx,cy=DOOR[0]+15, DOOR[1]+25
        for i in range(3):
            d.line([(cx-6+i*4, cy-2),(cx-4+i*4, cy+2)], fill=(200,210,220, int(40+30*intense)), width=1)
        canvas.alpha_composite(ov)

def apply_cam(img, zoom, focus, shake=(0,0)):
    im=img
    if zoom>1.001:
        cw,ch=W/zoom,H/zoom; fx,fy=focus
        left=max(0,min(W-cw,fx-cw/2)); top=max(0,min(H-ch,fy-ch/2))
        im=im.crop((int(left),int(top),int(left+cw),int(top+ch))).resize((W,H), Image.LANCZOS)
    if shake!=(0,0):
        blank=Image.new('RGBA',(W,H),(4,8,12,255))
        blank.alpha_composite(im if im.mode=='RGBA' else im.convert('RGBA'), (int(shake[0]), int(shake[1])))
        im=blank
    return im

def hud(canvas, hint):
    d=ImageDraw.Draw(canvas)
    d.rectangle([0,0,W,TOP], fill=(4,8,12,255))
    d.rectangle([0,H-BOT,W,H], fill=(4,8,12,255))
    if hint:
        f=font(13); bb=d.textbbox((0,0),hint,font=f); tw=bb[2]-bb[0]
        d.text(((W-tw)//2,H-22), hint, font=f, fill=(180,200,210,140))

def frame_at(t):
    """
    ~11s smooth timeline:
    0-2.2 walk in + living window lure (door rattles)
    2.2-2.6 blend walk→reach
    2.6-4.4 pull (24f) + window slam + 2x cam
    4.4-6.0 carry walk to door (gust on hand)
    6.0-7.4 throw + 2x cam
    7.4-9.2 snap + door open
    9.2-11 settle
    """
    HIT_W0, HIT_W1 = 4.18, 4.32
    HIT_D0, HIT_D1 = 7.18, 7.32

    def map_time(tt):
        if tt < HIT_W0: return tt, None
        if tt < HIT_W1: return HIT_W0, 'window'
        if tt < HIT_D0: return HIT_W0 + (tt - HIT_W1), None
        if tt < HIT_D1: return HIT_W0 + (HIT_D0 - HIT_W1), 'door'
        return HIT_W0 + (HIT_D0 - HIT_W1) + (tt - HIT_D1), None

    wt, impact = map_time(t)
    base = office.copy()

    # approach factor for lure
    dist_u = 1.0 - clamp(math.hypot(P_WIN[0]-P_START[0], P_WIN[1]-P_START[1]), 1, 999)
    # compute Noor pos early for approach
    if wt < 2.2:
        walk_u=ease(seg(wt,0.2,2.15))
        npos=[lerp(P_START[0],P_WIN[0],walk_u), lerp(P_START[1],P_WIN[1],walk_u)]
    elif wt < 4.4:
        npos=list(P_WIN)
    elif wt < 6.0:
        cu=ease(seg(wt,4.4,5.9)); npos=[lerp(P_WIN[0],P_DOOR[0],cu), lerp(P_WIN[1],P_DOOR[1],cu)]
    else:
        npos=list(P_DOOR)

    approach = clamp(1.0 - math.hypot(npos[0]-P_WIN[0], npos[1]-P_WIN[1])/420.0, 0, 1)
    win_open = 1.0 - ease(seg(wt, 3.85, 4.2))

    # rain ambient while open
    if rain_amb and win_open>0.05:
        ri=rain_amb[int(wt*10)%len(rain_amb)].copy()
        ri.putalpha(ri.split()[-1].point(lambda a: int(a*win_open*0.65)))
        base.alpha_composite(ri)

    # --- WINDOW ---
    if win_open > 0.08:
        # always inviting from beat start; approach strengthens shimmer / scraps
        lure = max(0.55, approach, seg(wt,0.0,1.8)*0.85)
        living_window(base, wt, approach=lure, open_amt=win_open)
    else:
        # slam shut: advance through slam frames smoothly
        u=seg(wt,3.7,4.2)
        # frames 4-7 slam
        xf=4+u*3.99
        i0=int(xf); f=xf-i0
        a=win_fr[min(7,i0)].crop(WIN_BOX); b=win_fr[min(7,i0+1)].crop(WIN_BOX)
        base.paste(Image.blend(a,b,ease(f)), (WIN_BOX[0], WIN_BOX[1]))
        if u>0.2 and u<0.95:
            # tiny dust only at blinds — NO blur box
            tiny_dust(base, WIN[0]+10, WIN[1]+60, (u-0.2)/0.6, wt, n=10)

    # --- DOOR ---
    door_open_u=0.0
    if wt < 6.9:
        door_rattle(base, wt, intense=0.35*seg(wt,6.5,6.9))
    elif wt < 8.6:
        u=seg(wt,6.9,8.4)
        # strain then snap — chunkier: linger early, accelerate mid
        if u<0.18:
            snap_i=0; door_rattle(base, wt, intense=0.8); # still rattling
            # overlay first snap frame lightly
            paste_rgb_region(base, door_snap[0], DOOR_BOX)
        else:
            su=ease_in_out((u-0.18)/0.82)
            snap_i=min(11, int(su*11))
            # blend consecutive snap frames
            a=door_snap[snap_i]; b=door_snap[min(11,snap_i+1)]
            # paste blended region
            ca=a.crop(DOOR_BOX); cb=b.crop(DOOR_BOX)
            base.paste(Image.blend(ca,cb, su*11-snap_i), (DOOR_BOX[0], DOOR_BOX[1]))
        door_open_u=ease_out(seg(wt,7.5,9.0))
    else:
        paste_rgb_region(base, door_snap[11], DOOR_BOX)
        door_open_u=ease_out(seg(wt,7.5,9.0))

    if door_open_u>0.02:
        di=min(9, int(door_open_u*9.8))
        paste_rgb_region(base, doors[di], (110,90,290,340))
        spill=Image.new('RGBA', base.size,(0,0,0,0)); sd=ImageDraw.Draw(spill)
        sd.polygon([(155,300),(220,300),(300,430),(80,430)], fill=(255,230,180,int(85*door_open_u)))
        base.alpha_composite(spill.filter(ImageFilter.GaussianBlur(10)))
        if door_open_u<0.5:
            tiny_dust(base, DOOR[0]+10, DOOR[1]+30, door_open_u*2, wt, n=12)

    # --- Noor + gust ---
    n=list(npos); ndir='E'; sprite=idle_E[0]; phase='walk'
    hx=hy=0; zoom=1.0; focus=(W/2,H/2); shake=(0,0)
    hint=''; throw_u=0
    gust_scale=1.15  # → ~2-3x Noor with wrap radii

    if wt < 2.2:
        walk_u=ease(seg(wt,0.2,2.15))
        n=[lerp(P_START[0],P_WIN[0],walk_u), lerp(P_START[1],P_WIN[1],walk_u)]
        # blend walk frames smoothly
        wf= (wt*10) % 8
        sprite=blend_sprites(walk_E[int(wf)%8], walk_E[(int(wf)+1)%8], wf%1)
        ndir='E'; phase='walk'; hint=''
        zoom=1.0+0.06*approach
        focus=(lerp(n[0],WIN[0],0.35), lerp(n[1],WIN[1],0.35))
    elif wt < 2.6:
        # blend walk → pull reach
        bu=ease(seg(wt,2.2,2.6))
        n=list(P_WIN)
        wspr=walk_E[0]; pspr=pull_S[0]
        # size-match via draw separately with alphas
        sprite=pspr; ndir='S'; phase='reach'
        # draw walk fading under
        draw_noor(base, wspr, n[0], n[1], alpha=1-bu)
        sprite=pspr
        hx,hy=hand_pos(*n,'pull','S')
        open_gust(base, hx, hy, wt, 0.25+0.35*bu, 'pull', scale=gust_scale)
        hint='E take'
        zoom=1.0+0.15*bu; focus=(P_WIN[0]-20, P_WIN[1]+10)
    elif wt < 4.4:
        n=list(P_WIN); ndir='S'; phase='pull'
        # map to 24 frames with ease, linger dig+tug
        u=seg(wt,2.6,4.15)
        # nonlinear remapping
        if u<0.28: uu=u/0.28*0.33          # frames 0-8 dig
        elif u<0.48: uu=0.33+(u-0.28)/0.2*0.17  # resist 8-12
        elif u<0.68: uu=0.5+(u-0.48)/0.2*0.17   # tug 12-16
        elif u<0.85: uu=0.67+(u-0.68)/0.17*0.17 # rip 16-20
        else: uu=0.84+(u-0.85)/0.15*0.16        # settle
        sprite=sample_anim(pull_S, clamp(uu,0,1))
        fi=uu*(len(pull_S)-1)
        hx,hy=hand_from_meta('pull_side','S',fi,n[0],n[1], hand_pos(*n,'pull','S'))
        if 12 <= fi <= 16:
            n[0]+=4; n[1]-=1
        if fi < 17:
            open_gust(base, hx, hy, wt, 0.55+0.4*seg(wt,2.6,3.8), 'pull', scale=gust_scale)
        else:
            open_gust(base, hx, hy, wt, 0.95, 'wrap', scale=gust_scale)
        # camera push to ~2x on take
        zoom=lerp(1.15, 2.0, ease(seg(wt,3.6,4.15)))
        if wt>4.15: zoom=2.0
        focus=(P_WIN[0]-30, P_WIN[1]+20)
        if fi>=17:
            shake=(rng.uniform(-1.5,1.5)*seg(wt,3.9,4.2), rng.uniform(-1,1)*seg(wt,3.9,4.2))
            tiny_dust(base, WIN[0], WIN[1]+55, seg(wt,3.95,4.25), wt, n=8)
        hint='E take'
    elif wt < 6.0:
        cu=ease(seg(wt,4.4,5.9))
        n=[lerp(P_WIN[0],P_DOOR[0],cu), lerp(P_WIN[1],P_DOOR[1],cu)]
        ndir='SW' if cu>0.4 else 'S'; phase='carry'
        # carry loop smooth + blend out of pull settle
        sprite=sample_anim(carry_S, (wt*0.9)%1.0)
        blend_in=ease(seg(wt,4.4,4.75))
        if blend_in<1:
            sprite=blend_sprites(pull_S[-1], sprite, blend_in)
        hx,hy=hand_pos(n[0],n[1],'carry','S')
        open_gust(base, hx, hy, wt, 0.95, 'wrap', scale=gust_scale)
        # ease camera back out from 2x (longer, softer)
        zoom=lerp(2.0, 1.05, ease_in_out(seg(wt,4.4,5.6)))
        focus=(n[0], n[1]-40)
        hint='F throw'
    elif wt < 7.4:
        n=list(P_DOOR); ndir='SW'; phase='throw'
        u=seg(wt,6.0,7.25)
        if u<0.45:
            sprite=sample_anim(hurl_SW, (u/0.45)*0.45)
            hx,hy=hand_pos(*n,'throw','SW')
            open_gust(base, hx, hy, wt, 0.9, 'wrap', scale=gust_scale)
            zoom=lerp(1.05, 2.0, ease_in_out(u/0.45))
            focus=(DOOR[0]+15, DOOR[1]+15)
            hint='F throw'
            # pre-flight wisp
            if u>0.35:
                open_flight(base, (u-0.35)/0.2*0.15, (hx,hy), (DOOR[0]+15, DOOR[1]+28), wt, scale=gust_scale)
        else:
            fu=(u-0.45)/0.55
            sprite=sample_anim(hurl_SW, 0.45+fu*0.55)
            throw_u=ease(fu)
            hx,hy=hand_pos(*n,'throw','SW')
            open_flight(base, throw_u, (hx,hy), (DOOR[0]+15, DOOR[1]+28), wt, scale=gust_scale*1.1)
            zoom=2.0
            focus=(DOOR[0]+10, DOOR[1]+20)
            if throw_u>0.7:
                shake=(rng.uniform(-2,2)*(throw_u-0.7), rng.uniform(-1.5,1.5)*(throw_u-0.7))
                tiny_dust(base, DOOR[0]+10, DOOR[1]+25, (throw_u-0.7)/0.3, wt, n=12)
            hint=''
    else:
        n=list(P_DOOR); ndir='SW'; phase='recover'
        ru=seg(wt,7.4,9.0)
        sprite=sample_anim(hurl_SW, clamp(0.75+ru*0.25,0,1))
        if wt>8.5:
            sprite=blend_sprites(hurl_SW[-1], idle_S[int(wt*5)%6], ease(seg(wt,8.5,9.5)))
            ndir='S'
        zoom=lerp(2.0, 1.0, ease(seg(wt,7.5,9.2)))
        focus=(DOOR[0]+20, DOOR[1]+40) if wt<8.5 else (n[0], n[1]-30)
        if impact=='door' or (7.15<=wt<=7.6):
            tiny_dust(base, DOOR[0]+10, DOOR[1]+25, 0.6, wt, n=14)
            shake=(rng.uniform(-1.2,1.2), rng.uniform(-0.8,0.8))
        hint=''

    # NO window/door blur-box flashes — ever
    draw_noor(base, sprite, n[0], n[1])

    # re-layer wrap gust in front of Noor while carrying
    if phase=='carry' or (phase=='pull' and wt>4.0):
        hx,hy=hand_pos(n[0],n[1],'carry','S')
        open_gust(base, hx, hy, wt, 0.85 if phase=='carry' else 0.6, 'wrap', scale=gust_scale)
    if phase=='throw' and throw_u<=0 and wt<6.5:
        hx,hy=hand_pos(n[0],n[1],'throw','SW')
        open_gust(base, hx, hy, wt, 0.75, 'wrap', scale=gust_scale)

    framed=apply_cam(base, zoom, focus, shake)
    out=Image.new('RGBA',(W,H),(4,8,12,255))
    out.alpha_composite(framed if framed.mode=='RGBA' else framed.convert('RGBA'))
    hud(out, hint)
    return out.convert('RGB'), dict(wt=wt, impact=impact, n=n, phase=phase, zoom=zoom, hint=hint)

def closeup(im, cx, cy, r=140):
    x0=clamp(int(cx-r),0,W-1); y0=clamp(int(cy-r),0,H-1)
    x1=clamp(int(cx+r),0,W); y1=clamp(int(cy+r),0,H)
    crop=im.crop((x0,y0,x1,y1))
    return crop.resize((crop.width*2, crop.height*2), Image.LANCZOS)

def main():
    global pull_S, carry_S, hurl_SW
    pull_S=load_seq('pull_side',24,('S','SE'))
    carry_S=load_seq('carry',12,('S',))
    hurl_SW=load_seq('hurl',24,('SW','S'))
    load_hands()
    print('loaded', len(pull_S), len(carry_S), len(hurl_SW))

    still_at={
        '01-lure': 1.4,
        '02-approach': 2.1,
        '03-pull': 3.2,
        '04-rip': 4.1,
        '05-carry': 5.1,
        '06-throw': 6.7,
        '07-snap': 7.6,
        '08-open': 9.0,
    }
    # force no-zoom for closeups later
    paths=[]
    text_hits=[]
    blur_flags=[]
    for i in range(NFRAMES):
        t=i/FPS
        im, meta = frame_at(t)
        fp=f'{FRAMES}/f_{i:04d}.png'; im.save(fp); paths.append(fp)
        # QA: no quality words
        # (hud only has hint — check hint)
        if meta.get('hint') and any(w in meta['hint'].upper() for w in ('OPEN','WET','PAPER','WEAK')):
            text_hits.append((i, meta['hint']))
        for name,ts in still_at.items():
            if abs(t-ts)<0.5/FPS:
                im.save(f'{STILLS}/{name}.png')
        if i%24==0:
            print(f'  {i}/{NFRAMES} wt={meta["wt"]:.2f} phase={meta["phase"]} zoom={meta["zoom"]:.2f}')

    # unzoomed close-ups
    real_cam = apply_cam
    def nozoom(img, zoom, focus, shake=(0,0)):
        return real_cam(img, 1.0, focus, (0,0))
    globals()['apply_cam']=nozoom
    # rebind frame_at's apply_cam — it's global lookup, OK
    for ts, name, center in [
        (1.4, 'close-lure-2x.png', (WIN[0], WIN[1]+40)),
        (3.2, 'close-pull-2x.png', None),
        (5.1, 'close-carry-2x.png', None),
        (6.7, 'close-throw-2x.png', None),
    ]:
        im, meta = frame_at(ts)
        if center is None:
            cx,cy=int(meta['n'][0]), int(meta['n'][1]-40)
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
    if os.path.exists(V5_MP4):
        subprocess.check_call([
            'ffmpeg','-y','-i',V5_MP4,'-i',mp4,
            '-filter_complex',
            "[0:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1,drawtext=text='v5':x=16:y=16:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.5[a];"
            "[1:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1,drawtext=text='v6':x=16:y=16:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.5[b];"
            '[a][b]hstack=inputs=2',
            '-c:v','libx264','-pix_fmt','yuv420p','-crf','20', f'{OUT}/compare.mp4'
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print('text_hits', text_hits)
    print('DONE', mp4)

if __name__=='__main__':
    main()
