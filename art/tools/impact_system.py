"""Reusable impact preset system — light / heavy / big tiers.
See docs/design/impact-spec.md.

Used by compose_steal_v9 and future combat/throw composers.
No thin stroke stacks. No translucent grey HUD boxes.
"""
from __future__ import annotations
import math
from dataclasses import dataclass
from typing import Tuple, Optional
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageChops, ImageEnhance
import numpy as np

Color = Tuple[int, int, int, int]

@dataclass(frozen=True)
class ImpactTier:
    name: str
    impact_frames: int          # 1..3 stylised high-contrast frames
    hitstop_frames: int         # at 24fps
    punch_zoom: float           # peak zoom multiplier
    shake_amp: float            # px at 1x
    spark_scale: float          # relative to character torso width (~64px)
    debris_count: int
    dust_strength: float
    silhouette: bool            # B/W or invert silhouette frames
    invert: bool

LIGHT = ImpactTier('light', impact_frames=1, hitstop_frames=3, punch_zoom=1.15,
                   shake_amp=3.0, spark_scale=0.55, debris_count=4,
                   dust_strength=0.35, silhouette=False, invert=True)
HEAVY = ImpactTier('heavy', impact_frames=3, hitstop_frames=8, punch_zoom=2.5,
                   shake_amp=7.5, spark_scale=1.0, debris_count=10,
                   dust_strength=0.85, silhouette=True, invert=True)
BIG = ImpactTier('big', impact_frames=3, hitstop_frames=14, punch_zoom=2.85,
                 shake_amp=11.0, spark_scale=1.35, debris_count=16,
                 dust_strength=1.0, silhouette=True, invert=True)

TIERS = {'light': LIGHT, 'heavy': HEAVY, 'big': BIG}

def get_tier(name: str) -> ImpactTier:
    return TIERS[name]


# ---------- Hit spark (thick tapered spikes — filled, never hairlines) ----------
def hit_spark(canvas: Image.Image, cx: float, cy: float, u: float, tier: ImpactTier,
              direction: Tuple[float, float] = (1.0, 0.0), torso_w: float = 64.0):
    """Bold directional hit-spark star. u=0 peak, u=1 gone."""
    if u >= 1.0:
        return
    ov = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    strength = 1.0 - u
    base = torso_w * tier.spark_scale
    dx, dy = direction
    L = math.hypot(dx, dy) or 1.0
    dx, dy = dx / L, dy / L
    px, py = -dy, dx
    # primary long spike along hit direction + opposite
    spikes = []
    n = 8 if tier.name != 'light' else 6
    for i in range(n):
        ang = (i / n) * math.pi * 2
        # bias length toward hit direction
        bias = 0.55 + 0.45 * max(0, math.cos(ang) * dx + math.sin(ang) * dy)
        length = base * (0.55 + 0.9 * bias) * (0.85 + 0.3 * strength)
        width = max(4.0, base * 0.14 * bias) * strength
        sx = cx + math.cos(ang) * length
        sy = cy + math.sin(ang) * length * 0.75  # slight perspective squash
        # tapered triangle (filled)
        bx = cx - math.cos(ang) * width * 0.15
        by = cy - math.sin(ang) * width * 0.15
        ox, oy = -math.sin(ang) * width, math.cos(ang) * width * 0.75
        spikes.append([(bx + ox, by + oy), (sx, sy), (bx - ox, by - oy)])
    aa = int(255 * strength)
    for poly in spikes:
        d.polygon(poly, fill=(255, 250, 240, aa))
    # hot core
    r = base * 0.22 * strength
    d.ellipse([cx - r, cy - r * 0.85, cx + r, cy + r * 0.85],
              fill=(255, 255, 255, aa))
    # secondary warm rim
    r2 = r * 1.6
    d.ellipse([cx - r2, cy - r2 * 0.85, cx + r2, cy + r2 * 0.85],
              outline=(255, 210, 160, int(180 * strength)), width=max(2, int(3 * strength)))
    # soft bloom
    bloom = ov.filter(ImageFilter.GaussianBlur(1.2 + 1.5 * strength))
    canvas.alpha_composite(bloom)
    canvas.alpha_composite(ov)


# ---------- Silhouette / invert impact frame ----------
def make_impact_frame(scene_rgba: Image.Image, cx: int, cy: int, radius: int,
                      tier: ImpactTier, burst_u: float = 0.0) -> Image.Image:
    """1 stylised high-contrast impact frame from a scene snapshot.
    Silhouette actors against a bright burst, or invert punch.
    """
    im = scene_rgba.convert('RGBA')
    w, h = im.size
    # bright radial burst backdrop
    burst = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(burst)
    # layered filled discs (not rings)
    for i, (rr, col) in enumerate([
        (radius * 2.4, (255, 252, 245, 255)),
        (radius * 1.7, (255, 230, 190, 255)),
        (radius * 1.1, (255, 255, 255, 255)),
    ]):
        bd.ellipse([cx - rr, cy - rr * 0.8, cx + rr, cy + rr * 0.8], fill=col)
    burst = burst.filter(ImageFilter.GaussianBlur(6))

    if tier.silhouette:
        # luminance → hard silhouette
        gray = im.convert('L')
        # threshold mid
        arr = np.array(gray)
        sil = np.where(arr < 90, 0, 255).astype(np.uint8)
        sil_im = Image.fromarray(sil, mode='L').convert('RGBA')
        # paint black silhouette onto burst
        black = Image.new('RGBA', (w, h), (8, 10, 14, 255))
        # use sil as mask: dark areas of scene become silhouette
        mask = Image.fromarray(255 - sil, mode='L')
        out = burst.copy()
        out.paste(black, (0, 0), mask.filter(ImageFilter.GaussianBlur(0.5)))
    elif tier.invert:
        # invert punch in a soft circular region
        inv = ImageOps.invert(im.convert('RGB')).convert('RGBA')
        out = im.copy()
        mask = Image.new('L', (w, h), 0)
        ImageDraw.Draw(mask).ellipse(
            [cx - radius, cy - int(radius * 0.8), cx + radius, cy + int(radius * 0.8)],
            fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(10))
        out = Image.composite(inv, out, mask)
        out = Image.alpha_composite(out, burst.split()[-1].point(lambda a: int(a * 0.35)).convert('L') and burst)
        # simpler composite:
        out = Image.composite(
            Image.blend(out, burst, 0.45),
            im,
            mask)
    else:
        out = Image.alpha_composite(im, burst)

    # always stamp a hit spark on top
    hit_spark(out, cx, cy, burst_u * 0.3, tier, direction=(1, 0.05), torso_w=64)
    return out


def impact_frame_sequence(scene_rgba: Image.Image, cx: int, cy: int,
                          tier: ImpactTier) -> list:
    """Return tier.impact_frames stylised frames (peak → slightly decayed)."""
    frames = []
    for i in range(tier.impact_frames):
        u = i / max(1, tier.impact_frames)
        rad = int(110 + 40 * (1 - u) * (1.2 if tier.name == 'big' else 1.0))
        frames.append(make_impact_frame(scene_rgba, cx, cy, rad, tier, burst_u=u))
    return frames


# ---------- Soft shaded wind (painterly mass — no stroke stacks) ----------
def soft_wind_blob(canvas: Image.Image, cx: float, cy: float, scale: float,
                   direction: Tuple[float, float] = (1, 0), alpha: float = 0.9):
    """Paint a soft shaded tapered wind mass with highlight + shadow."""
    if scale <= 0 or alpha <= 0:
        return
    ov = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    dx, dy = direction
    L = math.hypot(dx, dy) or 1
    dx, dy = dx / L, dy / L
    px, py = -dy, dx
    # 3 large soft shaded masses (highlight + shadow) — NOT a stack of thin ovals
    n = 3
    for i in range(n):
        t = i / max(1, n - 1)
        along = (t - 0.35) * scale * 1.6
        x = cx + dx * along
        y = cy + dy * along * 0.65
        rw = scale * (0.55 + 0.35 * math.sin(t * math.pi)) * (0.85 + 0.2 * alpha)
        rh = rw * 0.62
        layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        aa = int(120 * alpha * (0.55 + 0.45 * math.sin(max(0.2, t) * math.pi)))
        # cool shadow mass
        ld.ellipse([x - rw + px * 5, y - rh + py * 3, x + rw + px * 5, y + rh + py * 3],
                   fill=(35, 60, 100, int(aa * 0.5)))
        # body
        ld.ellipse([x - rw, y - rh, x + rw, y + rh],
                   fill=(130, 195, 230, aa))
        # specular highlight lobe
        ld.ellipse([x - rw * 0.5 - px * 3, y - rh * 0.55 - py * 3,
                    x + rw * 0.25 - px * 3, y + rh * 0.15 - py * 3],
                   fill=(235, 250, 255, int(aa * 0.9)))
        layer = layer.filter(ImageFilter.GaussianBlur(2.8 + 1.2 * (1 - t)))
        ov.alpha_composite(layer)
    # bright core near tip
    tip_x = cx + dx * scale * 0.85
    tip_y = cy + dy * scale * 0.6
    core = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    cd = ImageDraw.Draw(core)
    r = scale * 0.18
    cd.ellipse([tip_x - r, tip_y - r * 0.7, tip_x + r, tip_y + r * 0.7],
               fill=(240, 252, 255, int(200 * alpha)))
    core = core.filter(ImageFilter.GaussianBlur(2.5))
    ov.alpha_composite(core)
    canvas.alpha_composite(ov)


def soft_wind_flight(canvas: Image.Image, u: float, frm: Tuple[float, float],
                     to: Tuple[float, float], scale: float = 48.0):
    """Animate soft wind mass along a shallow Bez from frm→to. u 0..1."""
    if u <= 0:
        return frm
    e = u * u * (3 - 2 * u)  # smoothstep-ish; caller may ease
    mx = (frm[0] + to[0]) / 2
    my = (frm[1] + to[1]) / 2 + 16  # shallow downward bow
    tip = ((1 - e) * (1 - e) * frm[0] + 2 * (1 - e) * e * mx + e * e * to[0],
           (1 - e) * (1 - e) * frm[1] + 2 * (1 - e) * e * my + e * e * to[1])
    dx, dy = to[0] - frm[0], to[1] - frm[1]
    # mass shrinks slightly near impact
    sc = scale * (1.05 - 0.25 * e)
    soft_wind_blob(canvas, tip[0], tip[1], sc, direction=(dx, dy),
                   alpha=0.95 - 0.25 * e)
    return tip


def soft_wind_wrap(canvas: Image.Image, hx: float, hy: float, t: float,
                   scale: float = 36.0, alpha: float = 0.85):
    """Soft wrap around hand — overlapping blobs, not stroke helix."""
    for i in range(5):
        ang = t * 3.5 + i * 1.1
        r = scale * (0.35 + 0.15 * math.sin(t * 2 + i))
        x = hx + math.cos(ang) * r
        y = hy + math.sin(ang) * r * 0.6 - 4
        soft_wind_blob(canvas, x, y, scale * 0.45, direction=(math.cos(ang + 1), math.sin(ang)),
                       alpha=alpha * (0.7 + 0.3 * math.sin(i + t)))


# ---------- Floor dust burst (directional sheet — NOT radial rings) ----------
def floor_dust_burst(canvas: Image.Image, cx: float, cy: float, u: float,
                     direction: Tuple[float, float] = (1, 0), strength: float = 0.8):
    if u <= 0 or u >= 1.2 or strength <= 0:
        return
    ov = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    dx, dy = direction
    L = math.hypot(dx, dy) or 1
    dx, dy = dx / L, dy / L
    px, py = -dy, dx
    # elongated dust cloud along floor in hit direction
    for i in range(10):
        along = (i - 2) * 14 * (0.5 + u)
        side = ((i % 5) - 2) * 7 * (1 - u * 0.4)
        x = cx + dx * along + px * side
        y = cy + 18 + dy * along * 0.3 + abs(side) * 0.15  # hug floor
        rw = 10 + i * 2.5 + 20 * u
        rh = 3.5 + (i % 3)
        aa = int(110 * strength * (1 - u) * (1 - abs(i - 4) / 8))
        if aa <= 0:
            continue
        d.ellipse([x - rw, y - rh, x + rw, y + rh],
                  fill=(180, 190, 200, aa))
    ov = ov.filter(ImageFilter.GaussianBlur(1.2))
    canvas.alpha_composite(ov)


# ---------- Glowing sparks with motion blur ----------
def glowing_sparks(canvas: Image.Image, cx: float, cy: float, u: float,
                   direction: Tuple[float, float] = (1, 0), n: int = 10, seed: float = 0.0):
    if u <= 0 or u >= 1:
        return
    ov = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    dx, dy = direction
    L = math.hypot(dx, dy) or 1
    dx, dy = dx / L, dy / L
    for i in range(n):
        rng = math.sin(seed * 12.3 + i * 7.1) * 0.5 + 0.5
        ang_jit = (rng - 0.5) * 1.2
        c, s = math.cos(ang_jit), math.sin(ang_jit)
        fx, fy = dx * c - dy * s, dx * s + dy * c
        dist = (20 + i * 9 + rng * 30) * (0.3 + u)
        x = cx + fx * dist
        y = cy + fy * dist * 0.7 + 40 * u * u  # gravity
        # motion blur as short thick streak (filled capsule), not a 1px line
        bl = 6 + 10 * (1 - u)
        x0, y0 = x - fx * bl, y - fy * bl
        aa = int(220 * (1 - u))
        # thick stroke via ellipse chain
        for k in range(4):
            tt = k / 3
            xx = x0 + (x - x0) * tt
            yy = y0 + (y - y0) * tt
            rr = 2.5 + 1.5 * (1 - tt)
            d.ellipse([xx - rr, yy - rr, xx + rr, yy + rr],
                      fill=(255, 220, 150, aa))
        d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(255, 255, 240, aa))
    canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(0.6)))


# ---------- Camera punch + directional shake ----------
def punch_cam(img: Image.Image, zoom: float, focus: Tuple[float, float],
              shake: Tuple[float, float] = (0, 0)) -> Image.Image:
    w, h = img.size
    im = img
    if zoom > 1.001:
        cw, ch = w / zoom, h / zoom
        fx, fy = focus
        left = max(0, min(w - cw, fx - cw / 2))
        top = max(0, min(h - ch, fy - ch / 2))
        im = im.crop((int(left), int(top), int(left + cw), int(top + ch))).resize((w, h), Image.LANCZOS)
    if shake != (0, 0):
        blank = Image.new('RGBA', (w, h), (4, 8, 12, 255))
        blank.alpha_composite(im if im.mode == 'RGBA' else im.convert('RGBA'),
                              (int(shake[0]), int(shake[1])))
        im = blank
    return im


def directional_shake(amp: float, direction: Tuple[float, float], phase: float) -> Tuple[float, float]:
    """Decaying shake along hit vector + small perpendicular chatter."""
    dx, dy = direction
    L = math.hypot(dx, dy) or 1
    dx, dy = dx / L, dy / L
    px, py = -dy, dx
    decay = math.exp(-phase * 3.5)
    along = math.sin(phase * 55) * amp * decay
    perp = math.sin(phase * 73 + 1.2) * amp * 0.35 * decay
    return (dx * along + px * perp, dy * along + py * perp)


# ---------- Contact shadow under a piece (screen-space) ----------
def contact_shadow(canvas: Image.Image, x: float, y: float, rw: float = 14, rh: float = 5,
                   alpha: int = 70):
    ov = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).ellipse([x - rw, y - rh, x + rw, y + rh], fill=(0, 0, 0, alpha))
    canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(2)))
