#!/usr/bin/env python3
"""Compose mock-steal/v3 window→door beat.
In-scene Blender door chains + window blinds (feathered onto clarity plate).
Thin translucent gust FX (code glue). Readable pull_side (S) + hurl (SW).
"""
import os, json, math, subprocess, shutil
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'mock-steal/v3')
STILLS = os.path.join(OUT, 'stills')
FRAMES = os.path.join(OUT, '_frames')
NOOR = os.path.join(ROOT, 'art/render/steal_noor_v3')
COMP = os.path.join(ROOT, 'art/render/steal_v3/comp')
ASSETS = os.path.join(ROOT, 'game/public/assets')
V2_MP4 = os.path.join(ROOT, 'mock-steal/v2/beat.mp4')

W, H = 1280, 720
TOP, BOT = 48, 94
FPS = 24
DUR = 9.0  # slightly longer for hit-stop
NFRAMES = int(DUR * FPS)

os.makedirs(STILLS, exist_ok=True)
os.makedirs(FRAMES, exist_ok=True)

def load(p): return Image.open(p).convert('RGBA')
def lerp(a,b,u): return a+(b-a)*u
def ease(u):
    u=max(0.,min(1.,u)); return u*u*(3-2*u)
def seg(t,a,b):
    return 0. if b<=a else max(0.,min(1.,(t-a)/(b-a)))

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
walk_S = sheet_frames(f'{ASSETS}/sprites/noor_walk.png', f'{ASSETS}/sprites/noor_walk.json','noor_walk','S',8)

pull_S = [load(f'{NOOR}/pull_side_S_{i:02d}.png') for i in range(10)]
pull_SE = [load(f'{NOOR}/pull_side_SE_{i:02d}.png') for i in range(10)]
hurl_SW = [load(f'{NOOR}/hurl_SW_{i:02d}.png') for i in range(10)]
hurl_W = [load(f'{NOOR}/hurl_W_{i:02d}.png') for i in range(10)]

# in-scene composites (full plates)
door_hang = [Image.open(f'{COMP}/door_hang_full_{i:02d}.jpg').convert('RGBA') for i in range(4)]
door_snap = [Image.open(f'{COMP}/door_snap_full_{i:02d}.jpg').convert('RGBA') for i in range(12)]
win_fr = [Image.open(f'{COMP}/win_full_{i:02d}.jpg').convert('RGBA') for i in range(8)]

FONT=None
for fp in [f'{ASSETS}/fonts/IBMPlexMono-Medium.ttf']:
    if os.path.exists(fp): FONT=fp; break
def font(sz):
    return ImageFont.truetype(FONT, sz) if FONT else ImageFont.load_default()

DOOR=(168,155); WIN=(960,130)
P_START=(420,480); P_WIN=(900,310); P_DOOR=(235,265)
NS=0.78

def paste_rgb_region(dst, src_full, box):
    """Replace dst region with src_full region (both RGBA)."""
    x0,y0,x1,y1=box
    region=src_full.crop((x0,y0,x1,y1))
    dst.paste(region,(x0,y0))

def draw_noor(canvas, sprite, x, y, scale=NS):
    if sprite.width>=300:
        sc = scale * (192/384)
    else:
        sc = scale
    w=max(1,int(sprite.width*sc)); h=max(1,int(sprite.height*sc))
    im=sprite.resize((w,h), Image.LANCZOS)
    foot=0.90
    px=int(x-w/2); py=int(y-h*foot)
    sh=Image.new('RGBA', canvas.size,(0,0,0,0))
    d=ImageDraw.Draw(sh); d.ellipse([x-20,y-4,x+20,y+5], fill=(0,0,0,65))
    canvas.alpha_composite(sh)
    canvas.alpha_composite(im,(px,py))
    return px,py,w,h

def hand_pos(nx,ny,dir_='S'):
    if dir_ in ('S','SE'): return (nx+14, ny-62)
    if dir_=='SW': return (nx-10, ny-58)
    if dir_=='W': return (nx-18, ny-55)
    if dir_=='E': return (nx+20, ny-52)
    return (nx, ny-55)

def gust(canvas, hx, hy, t, strength=1.0, mode='wrap'):
    """Thin translucent wind: faint streaks + tiny droplets. NOT a solid sash."""
    if strength<=0: return
    overlay=Image.new('RGBA', canvas.size,(0,0,0,0))
    d=ImageDraw.Draw(overlay)
    rng = np.random.RandomState(int(t*30)%97 + 11)
    if mode=='wrap':
        # loose curl around forearm — few arcs, low alpha
        for i in range(5):
            a0 = t*2.2 + i*0.9
            rr = 10 + i*3
            aa = int(28 * strength * (1 - i*0.12))
            # arc as polyline
            pts=[]
            for k in range(7):
                ang = a0 + k*0.35
                pts.append((hx + math.cos(ang)*rr*(0.7+0.15*math.sin(t+i)),
                            hy + math.sin(ang)*rr*0.55 - 2))
            if len(pts)>=2:
                d.line(pts, fill=(170,210,230,aa), width=1)
        # tiny droplets
        for i in range(6):
            ang = t*3 + i*1.1
            r = 8+i*2.5
            x=hx+math.cos(ang)*r; y=hy+math.sin(ang)*r*0.5
            d.ellipse([x-1.2,y-1.8,x+1.2,y+1.8], fill=(160,200,220, int(40*strength)))
    elif mode=='pull':
        # streaks curling from window toward hand
        wx,wy = WIN[0]-20, WIN[1]+40
        for i in range(8):
            u = (i/7.0)*0.85 + 0.1*math.sin(t*4+i)
            x=lerp(wx, hx, u)+math.sin(t*3+i)*4
            y=lerp(wy, hy, u)+math.cos(t*2+i)*3
            x2=x+(hx-wx)*0.06; y2=y+(hy-wy)*0.06
            aa=int(22*strength*(1-u*0.5))
            d.line([(x,y),(x2,y2)], fill=(175,215,235,aa), width=1)
            if i%2==0:
                d.ellipse([x-1,y-1.5,x+1,y+1.5], fill=(180,220,240,int(35*strength)))
    elif mode=='fly':
        # streaky gust trail along bezier — not a ribbon body
        pass  # drawn by caller with points
    canvas.alpha_composite(overlay)

def gust_flight(canvas, u, frm, to, t):
    if u<=0 or u>=1: return
    e=ease(u)
    cx=(frm[0]+to[0])/2; cy=min(frm[1],to[1])-55
    def bez(tt):
        x=(1-tt)*(1-tt)*frm[0]+2*(1-tt)*tt*cx+tt*tt*to[0]
        y=(1-tt)*(1-tt)*frm[1]+2*(1-tt)*tt*cy+tt*tt*to[1]
        return x,y
    overlay=Image.new('RGBA',canvas.size,(0,0,0,0))
    d=ImageDraw.Draw(overlay)
    # many faint short streaks along path
    for k in range(14):
        v=e - k*0.04
        if v<=0: continue
        x,y=bez(v)
        ang = -0.6 + k*0.05
        length=8+3*math.sin(t*5+k)
        x2=x+math.cos(ang)*length; y2=y+math.sin(ang)*length*0.7
        aa=int(32*(1-k/14)*(1-u*0.3))
        d.line([(x,y),(x2,y2)], fill=(175,215,235,aa), width=1)
        if k%3==0:
            d.ellipse([x-1.2,y-1.6,x+1.2,y+1.6], fill=(170,210,230,int(aa*1.1)))
    # soft tip glow (tiny)
    tip=bez(e)
    d.ellipse([tip[0]-5,tip[1]-4,tip[0]+5,tip[1]+4], fill=(180,220,240, int(25*(1-u))))
    canvas.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(0.6)))

def apply_cam(img, zoom, focus):
    if zoom<=1.001: return img
    cw,ch=W/zoom,H/zoom
    fx,fy=focus
    left=max(0,min(W-cw, fx-cw/2)); top=max(0,min(H-ch, fy-ch/2))
    return img.crop((int(left),int(top),int(left+cw),int(top+ch))).resize((W,H), Image.LANCZOS)

def hud(canvas, cap, hint):
    d=ImageDraw.Draw(canvas)
    d.rectangle([0,0,W,TOP], fill=(4,8,12,255))
    d.rectangle([0,H-BOT,W,H], fill=(4,8,12,255))
    if hint:
        f=font(13); bb=d.textbbox((0,0),hint,font=f); tw=bb[2]-bb[0]
        d.text(((W-tw)//2, H-22), hint, font=f, fill=(180,200,210,140))
    if cap:
        f=font(22); bb=d.textbbox((0,0),cap,font=f); tw=bb[2]-bb[0]; th=bb[3]-bb[1]
        pad=14; x0=(W-tw)//2-pad; y0=H-BOT+30
        d.rounded_rectangle([x0,y0,x0+tw+pad*2,y0+th+12], radius=8, fill=(4,12,18,185))
        d.text((x0+pad,y0+6), cap, font=f, fill=(232,238,242,255))

def frame_at(t):
    # Timeline (~9s) with hit-stop on snap
    # 0.0-1.5 establish (chained door + open blinds/rain)
    # 1.5-2.7 walk to window
    # 2.7-4.6 pull_side (S) + gust + window slam
    # 4.6-5.6 walk to door
    # 5.6-6.5 throw (SW)
    # 6.5-6.7 HIT-STOP (~0.2s) on first snap
    # 6.7-8.0 chains fall + padlock + door opens
    # 8.0-9.0 hold
    doorK=0.0; win_open=1.0; burst=0.0
    n=list(P_START); ndir='E'; sprite=idle_E[0]
    carry=False; pull_u=0.0; throw_u=0.0
    zoom=1.0; focus=(640,360); cap=''; hint='E take   ·   F throw   ·   J attack'
    shake=0.0; hang_i=0; snap_i=-1; win_i=0

    # remap time through hit-stop: freeze world clock during stop
    # hit-stop window in output time: 6.55-6.75
    HIT0, HIT1 = 6.55, 6.75
    if t < HIT0:
        wt = t
    elif t < HIT1:
        wt = HIT0  # freeze
        shake = 0.4
    else:
        wt = HIT0 + (t - HIT1)  # resume (shortened remaining)
        # stretch remaining so we still end near DUR content
        # remaining content originally 9-6.55=2.45 mapped into 9-6.75=2.25
        rem_out = DUR - HIT1
        rem_world = DUR - HIT0 - 0.15
        wt = HIT0 + (t - HIT1) * (rem_world / rem_out)

    if wt < 1.5:
        n=list(P_START); ndir='E'; sprite=idle_E[int(wt*2)%len(idle_E)]
        cap='The door is locked.' if wt<1.1 else ''
        hang_i=int(wt*3)%4; win_i=int(wt*4)%4; win_open=1.0
        focus=(DOOR[0]+180, 300)
    elif wt < 2.7:
        u=ease(seg(wt,1.5,2.65))
        n=[lerp(P_START[0],P_WIN[0],u), lerp(P_START[1],P_WIN[1],u)]
        ndir='E'; sprite=walk_E[int(wt*12)%8]
        hang_i=int(wt*3)%4; win_i=int(wt*5)%4; win_open=1.0
        focus=(n[0], n[1]-40)
    elif wt < 4.6:
        n=list(P_WIN); ndir='S'
        pull_u=seg(wt,2.75,4.25)
        # emphasize claw/rip frames
        # favor rip frames 4-6 where face+arms read (CHEAT0 S)
        if pull_u<0.2: fi=int(pull_u/0.2*3)          # 0-2 plant/reach
        elif pull_u<0.55: fi=3+int((pull_u-0.2)/0.35*3)  # 3-5 claw/rip (HOLD longer)
        else: fi=6+int((pull_u-0.55)/0.45*3)         # 6-9 recover
        fi=max(0,min(9,fi))
        sprite=pull_S[fi]
        win_open=1.0-ease(seg(wt,3.5,4.35))
        # map open→win frame index
        win_i = int((1.0-win_open)*7.99) if pull_u>0.4 else int(wt*5)%4
        hang_i=int(wt*3)%4
        carry = pull_u>0.42
        zoom=1.0+0.22*ease(seg(wt,2.9,3.7))*(1-0.3*seg(wt,4.2,4.6))
        focus=(P_WIN[0]-30, P_WIN[1]-50)
        if 3.45<wt<3.85: shake=seg(wt,3.45,3.85)*(1-seg(wt,3.7,3.85))
        cap='The open comes free.' if 0.35<pull_u<0.9 else ''
    elif wt < 5.55:
        u=ease(seg(wt,4.6,5.5))
        n=[lerp(P_WIN[0],P_DOOR[0],u), lerp(P_WIN[1],P_DOOR[1],u)]
        ndir='W'; sprite=walk_W[int(wt*12)%8]
        win_open=0.0; win_i=7; carry=True; hang_i=int(wt*3)%4
        focus=(n[0],n[1]-40); zoom=1.04
    elif wt < 6.55:
        n=list(P_DOOR); ndir='SW'
        throw_u=seg(wt,5.6,6.45)
        if throw_u<0.25: fi=int(throw_u/0.25*3)
        elif throw_u<0.55: fi=3+int((throw_u-0.25)/0.3*3)
        else: fi=6+int((throw_u-0.55)/0.45*3)
        fi=max(0,min(9,fi))
        sprite=hurl_SW[fi]
        carry=throw_u<0.5; win_open=0; win_i=7; hang_i=0
        zoom=1.0+0.18*ease(seg(wt,5.65,6.2))
        focus=(DOOR[0]+50, DOOR[1]+40)
        cap='The door takes the open.' if throw_u>0.55 else ''
        # start snap just at end
        if throw_u>0.85:
            burst=seg(wt,6.4,6.55); snap_i=min(2,int(burst*3))
    elif wt < 8.0:
        n=list(P_DOOR); ndir='SW'; sprite=hurl_SW[min(9,7+int(seg(wt,6.55,7.2)*2))]
        if wt>7.3: sprite=idle_S[0]; ndir='S'
        win_open=0; win_i=7; carry=False
        burst=seg(wt,6.55,7.6)
        # snap frames over longer window for readability
        snap_i=min(11, int(burst*11.99))
        doorK=ease(seg(wt,7.15,7.95))  # door opens after padlock drops
        zoom=1.0+0.34*ease(seg(wt,6.55,6.9))*(1-0.35*seg(wt,7.5,8.0))
        focus=(DOOR[0]+20, DOOR[1]+50)
        shake = 0.55*seg(wt,6.55,6.85)*(1-seg(wt,6.75,6.95))
        cap='The door takes the open.' if wt<7.3 else ''
    else:
        n=list(P_DOOR); ndir='S'; sprite=idle_S[int(wt*2)%len(idle_S)]
        doorK=1.0; win_open=0; win_i=7; snap_i=11; burst=1.0
        focus=(DOOR[0]+25, DOOR[1]+45); zoom=1.08; cap=''

    # --- draw ---
    sx = int(math.sin(shake*40)*4*shake) if shake else 0
    sy = int(math.cos(shake*28)*3*shake) if shake else 0

    # base plate: chained door hang OR snap OR open door
    if snap_i >= 0 and doorK < 0.85:
        base = door_snap[snap_i].copy()
    elif doorK < 0.05:
        base = door_hang[hang_i % 4].copy()
    else:
        base = office.copy()

    # window region from in-scene blinds
    paste_rgb_region(base, win_fr[min(7,win_i)], (740,55,1180,220))

    # rain amb only while open
    if win_open > 0.15 and rain_amb:
        rain=rain_amb[int(wt*10)%len(rain_amb)].copy()
        a=rain.split()[-1].point(lambda p: int(p*win_open*0.85))
        rain.putalpha(a)
        base.alpha_composite(rain)

    # lift door open frames
    if doorK > 0.02:
        dk=int(round(min(1,doorK)*9))
        dim=doors[dk]
        if dim.width<400:
            base.paste(dim.convert('RGBA'), (112+sx, 62+sy))
        # if mid-snap, keep snap plate under then overlay opening
        if snap_i>=0 and doorK<0.5:
            # blend: show snap with slight door open light
            pass

    # shake offset via paste
    if sx or sy:
        shaken=Image.new('RGBA',(W,H),(4,8,12,255))
        shaken.alpha_composite(base,(sx,sy))
        base=shaken

    # gust FX
    hx,hy = hand_pos(n[0],n[1],ndir)
    if 2.85 < wt < 4.4:
        gust(base, hx, hy, wt, strength=min(0.75, pull_u*1.0), mode='pull')
    if carry and throw_u < 0.45:
        gust(base, hx, hy, wt, strength=0.55, mode='wrap')
    if 5.7 < wt < 6.55:
        gust_flight(base, seg(wt,5.75,6.5), (hx,hy), (DOOR[0], DOOR[1]+8), wt)

    draw_noor(base, sprite, n[0], n[1])

    # small impact flash at door on snap start
    if 6.55 <= wt <= 6.9:
        ov=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(ov)
        a=int(70*(1-seg(wt,6.55,6.9)))
        d.ellipse([DOOR[0]-40,DOOR[1]-30,DOOR[0]+40,DOOR[1]+45], fill=(210,220,235,a))
        base.alpha_composite(ov.filter(ImageFilter.GaussianBlur(10)))

    framed=apply_cam(base, zoom, focus)
    hud(framed, cap, hint)
    if t<0.25:
        framed.alpha_composite(Image.new('RGBA',(W,H),(4,8,12,int(255*(1-t/0.25)))))
    if t>DUR-0.4:
        framed.alpha_composite(Image.new('RGBA',(W,H),(4,8,12,int(255*seg(t,DUR-0.4,DUR)))))
    return framed.convert('RGB'), dict(wt=wt, pull_u=pull_u, throw_u=throw_u, snap_i=snap_i, n=n, doorK=doorK)

print('compositing', NFRAMES, 'frames')
still_t={
    '01-establish-chained-door': 0.8,
    '02-window-blinds-open': 1.3,
    '03-pull-three-quarter': 3.65,
    '04-window-slam': 4.2,
    '05-throw-gust': 6.15,
    '06-chain-snap': 6.85,
}
stills={}; close={}
for i in range(NFRAMES):
    t=i/FPS
    im, meta = frame_at(t)
    im.save(f'{FRAMES}/f_{i:04d}.png')
    for name,ts in still_t.items():
        if abs(t-ts)<0.5/FPS and name not in stills:
            stills[name]=im.copy()
    if abs(t-3.65)<0.5/FPS: close['pull']= (im.copy(), meta)
    if abs(t-6.15)<0.5/FPS: close['throw']= (im.copy(), meta)
    if abs(t-6.85)<0.5/FPS: close['snap']= (im.copy(), meta)
    if i%24==0: print(' ',i)

for name,im in stills.items():
    im.save(f'{STILLS}/{name}.png'); print('still',name)

def closeup(im, cx, cy, half=140):
    x0=max(0,cx-half); y0=max(0,cy-half); x1=min(W,cx+half); y1=min(H,cy+half)
    c=im.crop((x0,y0,x1,y1))
    return c.resize((c.width*2,c.height*2), Image.NEAREST)

if 'pull' in close:
    closeup(close['pull'][0], P_WIN[0], P_WIN[1]-40, 150).save(f'{STILLS}/close-pull-2x.png')
if 'throw' in close:
    closeup(close['throw'][0], P_DOOR[0], P_DOOR[1]-30, 150).save(f'{STILLS}/close-throw-2x.png')
if 'snap' in close:
    closeup(close['snap'][0], DOOR[0]+10, DOOR[1]+20, 130).save(f'{STILLS}/close-snap-2x.png')

# also save raw pose 2x for pull judgment
pose=load(f'{NOOR}/pull_side_S_05.png')
big=pose.resize((pose.width*2,pose.height*2), Image.NEAREST)
card=Image.new('RGBA',(big.width+40,big.height+70),(8,12,18,255))
card.alpha_composite(big,(20,20))
d=ImageDraw.Draw(card); d.text((20,big.height+28),'pull_side S (brace/claw)',font=font(18),fill=(200,220,230,220))
card.convert('RGB').save(f'{STILLS}/close-pull-pose-2x.png')

subprocess.check_call(['ffmpeg','-y','-framerate',str(FPS),'-i',f'{FRAMES}/f_%04d.png',
    '-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart', f'{OUT}/beat.mp4'],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
subprocess.check_call(['ffmpeg','-y','-i',f'{OUT}/beat.mp4','-vf','fps=12,scale=640:-1:flags=lanczos','-loop','0',f'{OUT}/beat.gif'],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
if os.path.exists(V2_MP4):
    subprocess.check_call(['ffmpeg','-y','-t',str(DUR),'-i',V2_MP4,'-t',str(DUR),'-i',f'{OUT}/beat.mp4',
        '-filter_complex',
        f'[0:v]scale=640:360,setsar=1,fps={FPS},drawtext=text=v2:x=12:y=12:fontsize=18:fontcolor=white@0.85[left];'
        f'[1:v]scale=640:360,setsar=1,fps={FPS},drawtext=text=v3:x=12:y=12:fontsize=18:fontcolor=white@0.85[right];'
        f'[left][right]hstack=inputs=2[v]','-map','[v]','-c:v','libx264','-pix_fmt','yuv420p','-crf','20',f'{OUT}/compare.mp4'],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
shutil.rmtree(FRAMES)
print('DONE v3')
