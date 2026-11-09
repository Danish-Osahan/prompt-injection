#!/usr/bin/env python3
"""Compose mock-steal/v4: tidy door-scale lock + brighter gust + anime impact frames."""
import os, json, math, subprocess, shutil
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps, ImageEnhance, ImageChops
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'mock-steal/v4')
STILLS = os.path.join(OUT, 'stills')
FRAMES = os.path.join(OUT, '_frames')
NOOR = os.path.join(ROOT, 'art/render/steal_noor_v3')
COMP = os.path.join(ROOT, 'art/render/steal_v4/comp')
WIN_COMP = os.path.join(ROOT, 'art/render/steal_v3/comp')
ASSETS = os.path.join(ROOT, 'game/public/assets')
V3_MP4 = os.path.join(ROOT, 'mock-steal/v3/beat.mp4')

W, H = 1280, 720
TOP, BOT = 48, 94
FPS = 24
DUR = 9.2
NFRAMES = int(DUR * FPS)
os.makedirs(STILLS, exist_ok=True); os.makedirs(FRAMES, exist_ok=True)

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

pull_S = [load(f'{NOOR}/pull_side_S_{i:02d}.png') for i in range(10)]
hurl_SW = [load(f'{NOOR}/hurl_SW_{i:02d}.png') for i in range(10)]

door_hang = [Image.open(f'{COMP}/door_hang_full_{i:02d}.jpg').convert('RGBA') for i in range(4)]
door_snap = [Image.open(f'{COMP}/door_snap_full_{i:02d}.jpg').convert('RGBA') for i in range(12)]
win_fr = [Image.open(f'{WIN_COMP}/win_full_{i:02d}.jpg').convert('RGBA') for i in range(8)]

FONT=None
for fp in [f'{ASSETS}/fonts/IBMPlexMono-Medium.ttf']:
    if os.path.exists(fp): FONT=fp; break
def font(sz):
    return ImageFont.truetype(FONT, sz) if FONT else ImageFont.load_default()

DOOR=(168,155); WIN=(960,130)
P_START=(420,480); P_WIN=(900,310); P_DOOR=(235,265)
NS=0.78

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

def hand_pos(nx,ny,dir_='S'):
    if dir_ in ('S','SE'): return (nx+14, ny-62)
    if dir_=='SW': return (nx-10, ny-58)
    if dir_=='W': return (nx-18, ny-55)
    if dir_=='E': return (nx+20, ny-52)
    return (nx, ny-55)

def gust(canvas, hx, hy, t, strength=1.0, mode='wrap'):
    if strength<=0: return
    ov=Image.new('RGBA', canvas.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    if mode=='wrap':
        for i in range(8):
            a0=t*2.8+i*0.8; rr=12+i*3.2; aa=int(70*strength*(1-i*0.09))
            pts=[(hx+math.cos(a0+k*0.4)*rr*(0.75+0.18*math.sin(t*1.5+i)),
                  hy+math.sin(a0+k*0.4)*rr*0.55-3) for k in range(8)]
            d.line(pts, fill=(200,235,255,aa), width=2)
            d.line(pts, fill=(255,255,255,max(12,aa//3)), width=1)
        for i in range(12):
            ang=t*3.5+i*0.9; r=10+i*2.1
            x=hx+math.cos(ang)*r; y=hy+math.sin(ang)*r*0.55
            d.ellipse([x-1.8,y-2.4,x+1.8,y+2.4], fill=(210,240,255,int(85*strength)))
    elif mode=='pull':
        wx,wy=WIN[0]-30, WIN[1]+35
        for i in range(14):
            u=(i/13.0)*0.9+0.08*math.sin(t*5+i)
            x=lerp(wx,hx,u)+math.sin(t*4+i)*5
            y=lerp(wy,hy,u)+math.cos(t*3+i)*4
            x2=x+(hx-wx)*0.08; y2=y+(hy-wy)*0.08
            aa=int(60*strength*(1-u*0.35))
            d.line([(x,y),(x2,y2)], fill=(195,230,255,aa), width=2)
            d.ellipse([x-1.7,y-2.2,x+1.7,y+2.2], fill=(220,245,255,int(75*strength*(1-u*0.3))))
    canvas.alpha_composite(ov)

def gust_flight(canvas, u, frm, to, t):
    if u<=0 or u>=1: return
    e=ease(u); cx=(frm[0]+to[0])/2; cy=min(frm[1],to[1])-55
    def bez(tt):
        return ((1-tt)*(1-tt)*frm[0]+2*(1-tt)*tt*cx+tt*tt*to[0],
                (1-tt)*(1-tt)*frm[1]+2*(1-tt)*tt*cy+tt*tt*to[1])
    ov=Image.new('RGBA',canvas.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    for k in range(20):
        v=e-k*0.032
        if v<=0: continue
        x,y=bez(v); ang=-0.7+k*0.04; length=14+4*math.sin(t*6+k)
        aa=int(70*(1-k/20)*(1-u*0.2))
        d.line([(x,y),(x+math.cos(ang)*length,y+math.sin(ang)*length*0.7)], fill=(200,235,255,aa), width=2)
        if k%2==0: d.ellipse([x-2,y-2.4,x+2,y+2.4], fill=(220,245,255,int(aa*1.2)))
    tip=bez(e)
    d.ellipse([tip[0]-8,tip[1]-6,tip[0]+8,tip[1]+6], fill=(210,240,255,int(70*(1-u*0.4))))
    canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(0.4)))

def impact_flash(img, kind='invert', strength=1.0):
    a=np.array(img.convert('RGB'), dtype=np.float32)
    if kind=='invert':
        out=(255-a)*0.88 + a*0.12
    elif kind=='white':
        out=a*0.2 + 230
    else:
        out=np.clip((a-30)*1.6, 0, 255)
    out=a*(1-strength)+out*strength
    return Image.fromarray(np.clip(out,0,255).astype(np.uint8))

def impact_fx(canvas, cx, cy, u, t):
    if u<=0 or u>=1: return
    ov=Image.new('RGBA', canvas.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    r=20+u*100; aa=int(160*(1-u))
    d.ellipse([cx-r,cy-r*0.72,cx+r,cy+r*0.72], outline=(245,250,255,aa), width=3)
    d.ellipse([cx-r*0.65,cy-r*0.5,cx+r*0.65,cy+r*0.5], outline=(180,220,255,aa//2), width=2)
    for i in range(18):
        ang=i*(math.pi*2/18)+0.1
        r0=14+u*18; r1=36+u*120
        d.line([(cx+math.cos(ang)*r0, cy+math.sin(ang)*r0*0.72),
                (cx+math.cos(ang)*r1, cy+math.sin(ang)*r1*0.72)],
               fill=(235,245,255,int(110*(1-u))), width=2)
    d.ellipse([cx-7,cy-6,cx+7,cy+6], fill=(255,255,255,int(180*(1-u*0.6))))
    canvas.alpha_composite(ov)

def apply_cam(img, zoom, focus):
    if zoom<=1.001: return img
    cw,ch=W/zoom,H/zoom; fx,fy=focus
    left=max(0,min(W-cw,fx-cw/2)); top=max(0,min(H-ch,fy-ch/2))
    return img.crop((int(left),int(top),int(left+cw),int(top+ch))).resize((W,H), Image.LANCZOS)

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
    """Timeline with anticipation + impact frames at window rip and door hit."""
    # World beats (before impact freezes):
    # 0-1.5 establish
    # 1.5-2.7 walk window
    # 2.7-3.4 pull antic
    # 3.4-3.55 IMPACT window (flash+fx) — output freeze ~0.18s
    # 3.55-4.5 slam settle + carry
    # 4.5-5.5 walk door
    # 5.5-6.35 throw antic
    # 6.35-6.55 IMPACT door
    # 6.55-8.0 snap + open
    # 8.0-9.2 hold

    # Map output time through two hit-stops
    HIT_W0, HIT_W1 = 3.42, 3.60   # window impact freeze
    HIT_D0, HIT_D1 = 6.40, 6.62   # door impact freeze

    def map_time(t):
        # freeze world clock during hit-stops
        if t < HIT_W0: return t, None
        if t < HIT_W1: return HIT_W0, 'window'
        # shift after window hit
        t2 = HIT_W0 + (t - HIT_W1)
        # door hit in shifted time corresponds to original ~6.40
        # After window: output duration of freeze = HIT_W1-HIT_W0
        # Door freeze starts at HIT_D0 in output
        if t < HIT_D0:
            # world time = HIT_W0 + (t - HIT_W1)
            return HIT_W0 + (t - HIT_W1), None
        if t < HIT_D1:
            return HIT_W0 + (HIT_D0 - HIT_W1), 'door'  # freeze at door impact world time
        # after door freeze
        return HIT_W0 + (HIT_D0 - HIT_W1) + (t - HIT_D1), None

    wt, impact = map_time(t)

    doorK=0.0; win_open=1.0
    n=list(P_START); ndir='E'; sprite=idle_E[0]
    carry=False; pull_u=0.0; throw_u=0.0
    zoom=1.0; focus=(640,360); cap=''; hint='E take   ·   F throw   ·   J attack'
    shake=0.0; hang_i=0; snap_i=-1; win_i=0
    impact_u=0.0; impact_center=DOOR

    if wt < 1.5:
        n=list(P_START); ndir='E'; sprite=idle_E[int(wt*2)%len(idle_E)]
        cap='The door is locked.' if wt<1.1 else ''
        hang_i=int(wt*3)%4; win_i=int(wt*4)%4; win_open=1.0
        focus=(DOOR[0]+180,300)
    elif wt < 2.7:
        u=ease(seg(wt,1.5,2.65))
        n=[lerp(P_START[0],P_WIN[0],u), lerp(P_START[1],P_WIN[1],u)]
        ndir='E'; sprite=walk_E[int(wt*12)%8]
        hang_i=int(wt*3)%4; win_i=int(wt*5)%4; win_open=1.0
        focus=(n[0],n[1]-40)
    elif wt < 3.42:
        # pull anticipation → claw
        n=list(P_WIN); ndir='S'
        pull_u=seg(wt,2.75,3.42)
        fi=min(4, int(pull_u*5))
        sprite=pull_S[fi]
        hang_i=int(wt*3)%4; win_i=int(wt*5)%4; win_open=1.0
        zoom=1.0+0.12*ease(pull_u)
        focus=(P_WIN[0]-20, P_WIN[1]-40)
        # anticipation crouch feel: slight zoom pulse
        if wt>3.2: shake=0.15
        cap=''
    elif wt < 3.55:
        # IMPACT window moment (world frozen at rip)
        n=list(P_WIN); ndir='S'; sprite=pull_S[5]; pull_u=1.0
        win_open=0.35; win_i=4; hang_i=0; carry=True
        zoom=1.28; focus=(P_WIN[0]-10, P_WIN[1]-30)
        impact_u=0.35; impact_center=(P_WIN[0]-40, P_WIN[1]+20)
        shake=0.7; cap='The open comes free.'
    elif wt < 4.55:
        n=list(P_WIN); ndir='S'
        pull_u=1.0
        fi=min(9, 5+int(seg(wt,3.55,4.4)*4))
        sprite=pull_S[fi]
        win_open=1.0-ease(seg(wt,3.55,4.2))
        win_i=int((1-win_open)*7.99)
        hang_i=0; carry=True
        zoom=1.18-0.12*seg(wt,3.55,4.5)
        focus=(P_WIN[0]-20, P_WIN[1]-40)
        impact_u=seg(wt,3.55,3.85)*(1-seg(wt,3.7,3.95))
        impact_center=(P_WIN[0]-40, P_WIN[1]+20)
        if wt<3.75: shake=0.45
        cap='The open comes free.' if wt<4.2 else ''
    elif wt < 5.5:
        u=ease(seg(wt,4.55,5.45))
        n=[lerp(P_WIN[0],P_DOOR[0],u), lerp(P_WIN[1],P_DOOR[1],u)]
        ndir='W'; sprite=walk_W[int(wt*12)%8]
        win_open=0; win_i=7; carry=True; hang_i=int(wt*3)%4
        focus=(n[0],n[1]-40); zoom=1.04
    elif wt < 6.40:
        n=list(P_DOOR); ndir='SW'
        throw_u=seg(wt,5.55,6.40)
        if throw_u<0.3: fi=int(throw_u/0.3*3)
        elif throw_u<0.7: fi=3+int((throw_u-0.3)/0.4*3)
        else: fi=6+int((throw_u-0.7)/0.3*3)
        sprite=hurl_SW[max(0,min(9,fi))]
        carry=throw_u<0.55; win_open=0; win_i=7; hang_i=0
        zoom=1.0+0.2*ease(throw_u)
        focus=(DOOR[0]+40, DOOR[1]+40)
        if throw_u>0.85: shake=0.2
        cap='The door takes the open.' if throw_u>0.6 else ''
    elif wt < 6.55:
        # DOOR IMPACT
        n=list(P_DOOR); ndir='SW'; sprite=hurl_SW[5]; throw_u=1.0
        win_open=0; win_i=7; carry=False; snap_i=1
        zoom=1.35; focus=(DOOR[0]+10, DOOR[1]+40)
        impact_u=0.4; impact_center=(DOOR[0], DOOR[1]+10)
        shake=0.85; cap='The door takes the open.'
    elif wt < 8.1:
        n=list(P_DOOR); ndir='SW'
        sprite=hurl_SW[min(9,6+int(seg(wt,6.55,7.3)*3))]
        if wt>7.4: sprite=idle_S[0]; ndir='S'
        win_open=0; win_i=7; carry=False
        burst=seg(wt,6.55,7.7)
        snap_i=min(11, int(burst*11.99))
        doorK=ease(seg(wt,7.2,8.05))
        zoom=1.25-0.15*seg(wt,6.55,8.0)
        focus=(DOOR[0]+15, DOOR[1]+45)
        impact_u=seg(wt,6.55,6.9)*(1-seg(wt,6.75,7.0))
        impact_center=(DOOR[0], DOOR[1]+10)
        if wt<6.85: shake=0.5
        cap='The door takes the open.' if wt<7.4 else ''
    else:
        n=list(P_DOOR); ndir='S'; sprite=idle_S[int(wt*2)%len(idle_S)]
        doorK=1.0; win_open=0; win_i=7; snap_i=11
        focus=(DOOR[0]+25, DOOR[1]+45); zoom=1.08; cap=''

    # --- draw ---
    sx=int(math.sin(shake*42)*5*shake) if shake else 0
    sy=int(math.cos(shake*30)*4*shake) if shake else 0

    if snap_i>=0 and doorK<0.85:
        base=door_snap[snap_i].copy()
    elif doorK<0.05:
        base=door_hang[hang_i%4].copy()
    else:
        base=office.copy()

    paste_rgb_region(base, win_fr[min(7,win_i)], (740,55,1180,220))
    if win_open>0.15 and rain_amb:
        rain=rain_amb[int(wt*10)%len(rain_amb)].copy()
        a=rain.split()[-1].point(lambda p: int(p*win_open*0.85))
        rain.putalpha(a); base.alpha_composite(rain)

    if doorK>0.02:
        dk=int(round(min(1,doorK)*9))
        dim=doors[dk]
        if dim.width<400:
            base.paste(dim.convert('RGBA'), (112+sx, 62+sy))

    if sx or sy:
        shaken=Image.new('RGBA',(W,H),(4,8,12,255))
        shaken.alpha_composite(base,(sx,sy)); base=shaken

    hx,hy=hand_pos(n[0],n[1],ndir)
    if 2.85<wt<3.55:
        gust(base, hx, hy, wt, strength=min(1.0, max(0.4, pull_u*1.4)), mode='pull')
    if carry and throw_u<0.5:
        gust(base, hx, hy, wt, strength=0.95, mode='wrap')
    if 5.7<wt<6.45:
        gust_flight(base, seg(wt,5.75,6.4), (hx,hy), (DOOR[0], DOOR[1]+8), wt)

    draw_noor(base, sprite, n[0], n[1])

    if impact_u>0:
        impact_fx(base, impact_center[0], impact_center[1], impact_u, wt)

    framed=apply_cam(base, zoom, focus)

    # stark impact FLASH frames (1-3 frames at peak)
    if impact=='window':
        # cycle invert / punch / white across freeze
        phase=(t-HIT_W0)/(HIT_W1-HIT_W0)
        kind='invert' if phase<0.4 else ('punch' if phase<0.75 else 'white')
        framed=impact_flash(framed, kind=kind, strength=0.92 if phase<0.85 else 0.55)
        # redraw fx on flash
        tmp=framed.convert('RGBA')
        impact_fx(tmp, *apply_focus_pt(impact_center, zoom, focus), max(0.2, 1-phase), wt)
        framed=tmp.convert('RGB')
    elif impact=='door':
        phase=(t-HIT_D0)/(HIT_D1-HIT_D0)
        kind='punch' if phase<0.35 else ('invert' if phase<0.7 else 'white')
        framed=impact_flash(framed, kind=kind, strength=0.95 if phase<0.8 else 0.5)
        tmp=framed.convert('RGBA')
        impact_fx(tmp, *apply_focus_pt(impact_center, zoom, focus), max(0.2, 1-phase), wt)
        framed=tmp.convert('RGB')

    hud(framed.convert('RGBA') if framed.mode=='RGB' else framed, cap, hint)
    # ensure RGB
    if framed.mode!='RGB':
        # hud may have been on RGBA copy
        pass
    out=framed.convert('RGB') if hasattr(framed,'convert') else framed
    # re-hud properly
    out_rgba=out.convert('RGBA')
    hud(out_rgba, cap, hint)
    if t<0.25:
        out_rgba.alpha_composite(Image.new('RGBA',(W,H),(4,8,12,int(255*(1-t/0.25)))))
    if t>DUR-0.4:
        out_rgba.alpha_composite(Image.new('RGBA',(W,H),(4,8,12,int(255*seg(t,DUR-0.4,DUR)))))
    return out_rgba.convert('RGB'), dict(wt=wt, impact=impact, n=n, snap_i=snap_i)

def apply_focus_pt(pt, zoom, focus):
    """Approximate where a plate point lands after camera push (for fx on flashed frames)."""
    if zoom<=1.001: return pt
    cw,ch=W/zoom,H/zoom; fx,fy=focus
    left=max(0,min(W-cw,fx-cw/2)); top=max(0,min(H-ch,fy-ch/2))
    return ((pt[0]-left)*zoom, (pt[1]-top)*zoom)

print('compositing', NFRAMES)
still_t={
    '01-establish-lock': 0.8,
    '02-pull-gust': 3.25,
    '03-impact-window': 3.48,
    '04-throw-gust': 6.15,
    '05-impact-door': 6.48,
    '06-chain-snap-open': 7.5,
}
stills={}; close={}
for i in range(NFRAMES):
    t=i/FPS
    im, meta = frame_at(t)
    im.save(f'{FRAMES}/f_{i:04d}.png')
    for name,ts in still_t.items():
        if abs(t-ts)<0.5/FPS and name not in stills:
            stills[name]=im.copy()
    if abs(t-3.48)<0.5/FPS: close['impact_win']=im.copy()
    if abs(t-6.48)<0.5/FPS: close['impact_door']=im.copy()
    if abs(t-0.8)<0.5/FPS: close['lock']=im.copy()
    if i%24==0: print(' ',i)

for name,im in stills.items():
    im.save(f'{STILLS}/{name}.png'); print('still',name)

def closeup(im, cx, cy, half=130):
    x0=max(0,cx-half); y0=max(0,cy-half); x1=min(W,cx+half); y1=min(H,cy+half)
    c=im.crop((x0,y0,x1,y1))
    return c.resize((c.width*2,c.height*2), Image.NEAREST)

if 'lock' in close:
    closeup(close['lock'], DOOR[0]+20, DOOR[1]+10, 90).save(f'{STILLS}/close-lock-2x.png')
if 'impact_win' in close:
    closeup(close['impact_win'], P_WIN[0]-20, P_WIN[1]-20, 140).save(f'{STILLS}/close-impact-window-2x.png')
if 'impact_door' in close:
    closeup(close['impact_door'], DOOR[0]+10, DOOR[1]+20, 130).save(f'{STILLS}/close-impact-door-2x.png')

subprocess.check_call(['ffmpeg','-y','-framerate',str(FPS),'-i',f'{FRAMES}/f_%04d.png',
    '-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart', f'{OUT}/beat.mp4'],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
subprocess.check_call(['ffmpeg','-y','-i',f'{OUT}/beat.mp4','-vf','fps=12,scale=640:-1:flags=lanczos','-loop','0',f'{OUT}/beat.gif'],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
if os.path.exists(V3_MP4):
    subprocess.check_call(['ffmpeg','-y','-t',str(DUR),'-i',V3_MP4,'-t',str(DUR),'-i',f'{OUT}/beat.mp4',
        '-filter_complex',
        f'[0:v]scale=640:360,setsar=1,fps={FPS},drawtext=text=v3:x=12:y=12:fontsize=18:fontcolor=white@0.85[left];'
        f'[1:v]scale=640:360,setsar=1,fps={FPS},drawtext=text=v4:x=12:y=12:fontsize=18:fontcolor=white@0.85[right];'
        f'[left][right]hstack=inputs=2[v]','-map','[v]','-c:v','libx264','-pix_fmt','yuv420p','-crf','20',
        f'{OUT}/compare.mp4'],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
shutil.rmtree(FRAMES)
print('DONE v4')
