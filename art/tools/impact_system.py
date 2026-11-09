"""Reusable impact preset system — light / heavy / big tiers.
See docs/design/impact-spec.md.

v10: clean alpha-mask silhouettes (no luminance threshold noise),
asymmetric directional hit-sparks (no clip-art 8-point stars).
"""
from __future__ import annotations
import math
from dataclasses import dataclass
from typing import Tuple, Optional, List
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageChops
import numpy as np

Color = Tuple[int, int, int, int]

@dataclass(frozen=True)
class ImpactTier:
    name: str
    impact_frames: int          # silhouette frames at 24fps
    color_return_frames: int    # 1 frame burst-with-colour
    hitstop_frames: int         # total special freeze (sil + color return)
    punch_zoom: float
    shake_amp: float
    spark_scale: float
    debris_count: int
    dust_strength: float
    silhouette: bool
    invert: bool

LIGHT = ImpactTier('light', impact_frames=1, color_return_frames=1, hitstop_frames=2,
                   punch_zoom=1.15, shake_amp=3.0, spark_scale=0.55, debris_count=4,
                   dust_strength=0.35, silhouette=False, invert=True)
HEAVY = ImpactTier('heavy', impact_frames=2, color_return_frames=1, hitstop_frames=3,
                   punch_zoom=2.5, shake_amp=7.5, spark_scale=0.95, debris_count=10,
                   dust_strength=0.85, silhouette=True, invert=False)
BIG = ImpactTier('big', impact_frames=2, color_return_frames=1, hitstop_frames=4,
                 punch_zoom=2.85, shake_amp=11.0, spark_scale=1.2, debris_count=16,
                 dust_strength=1.0, silhouette=True, invert=False)

TIERS = {'light': LIGHT, 'heavy': HEAVY, 'big': BIG}

def get_tier(name: str) -> ImpactTier:
    return TIERS[name]


# ---------- Asymmetric directional hit spark ----------
def hit_spark(canvas: Image.Image, cx: float, cy: float, u: float, tier: ImpactTier,
              direction: Tuple[float, float] = (1.0, 0.0), torso_w: float = 64.0,
              phase: float = 0.0):
    """Asymmetric directional burst: 3–5 uneven thick tapered spikes + hot core +
    secondary slivers. Rotates / scales in slightly over its life. u=0 peak, u=1 gone.
    NO symmetric 8-point clip-art star. NO orange ring."""
    if u >= 1.0:
        return
    ov = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    strength = 1.0 - u
    # scale-in: early frames slightly smaller then expand
    grow = 0.82 + 0.18 * min(1.0, (1.0 - u) + phase * 0.5)
    base = torso_w * tier.spark_scale * grow
    dx, dy = direction
    L = math.hypot(dx, dy) or 1.0
    dx, dy = dx / L, dy / L
    # slight rotation over life
    rot = math.atan2(dy, dx) + (phase * 0.35 - u * 0.2)
    # 3–5 uneven primary spikes biased along throw direction
    n = 4 if tier.name == 'light' else 5
    # uneven lengths / angles clustered around forward + a couple back/side
    specs = [
        (0.00, 1.00, 0.22),   # main forward
        (0.38, 0.72, 0.16),
        (-0.32, 0.78, 0.15),
        (2.85, 0.55, 0.12),   # back
        (1.55, 0.42, 0.10),   # side
    ][:n]
    aa = int(255 * strength)
    for ang_off, length_mul, width_mul in specs:
        ang = rot + ang_off
        length = base * length_mul * (0.9 + 0.2 * strength)
        width = max(5.0, base * width_mul) * strength
        sx = cx + math.cos(ang) * length
        sy = cy + math.sin(ang) * length * 0.78
        bx = cx - math.cos(ang) * width * 0.2
        by = cy - math.sin(ang) * width * 0.2
        ox = -math.sin(ang) * width
        oy = math.cos(ang) * width * 0.78
        d.polygon([(bx + ox, by + oy), (sx, sy), (bx - ox, by - oy)],
                  fill=(255, 252, 245, aa))
    # secondary thin-ish slivers (still filled, not hairlines)
    for i, ang_off in enumerate((0.7, -0.85, 2.2)):
        ang = rot + ang_off
        length = base * (0.28 + 0.08 * i) * strength
        width = max(2.5, base * 0.05) * strength
        sx = cx + math.cos(ang) * length
        sy = cy + math.sin(ang) * length * 0.78
        ox = -math.sin(ang) * width
        oy = math.cos(ang) * width * 0.78
        d.polygon([(cx + ox, cy + oy), (sx, sy), (cx - ox, cy - oy)],
                  fill=(255, 248, 235, int(aa * 0.75)))
    # hot core (no ring)
    r = base * 0.18 * strength
    d.ellipse([cx - r, cy - r * 0.85, cx + r, cy + r * 0.85],
              fill=(255, 255, 255, aa))
    # soft bloom only
    bloom = ov.filter(ImageFilter.GaussianBlur(1.0 + 1.2 * strength))
    canvas.alpha_composite(bloom)
    canvas.alpha_composite(ov)


# ---------- Clean alpha-mask silhouette ----------
def _harden_alpha(mask: Image.Image, thresh: int = 40, preserve_holes: bool = True) -> Image.Image:
    """Crisp binary mask from soft alpha — no speckle.
    preserve_holes=True (default) keeps chain-link openings; only drops dust pixels.
    """
    arr = np.array(mask.convert('L'))
    bin_ = (arr >= thresh).astype(np.uint8) * 255
    im = Image.fromarray(bin_, mode='L')
    if preserve_holes:
        # light open only (remove isolated speckles) — do NOT close (would fill link holes)
        im = im.filter(ImageFilter.MinFilter(3))
        im = im.filter(ImageFilter.MaxFilter(3))
    else:
        # solid shapes (door/body): open then close for crisp outline
        im = im.filter(ImageFilter.MinFilter(3))
        im = im.filter(ImageFilter.MaxFilter(3))
        im = im.filter(ImageFilter.MaxFilter(3))
        im = im.filter(ImageFilter.MinFilter(3))
    a = np.array(im)
    a = np.where(a >= 128, 255, 0).astype(np.uint8)
    return Image.fromarray(a, mode='L')


def make_clean_silhouette_frame(
    size: Tuple[int, int],
    cx: int, cy: int,
    masks: List,  # (img, origin) or (img, origin, rgba_color)
    *,
    burst_radius: int = 140,
    mode: str = 'black_on_burst',
    bg_dim: Optional[Image.Image] = None,
    bg_dim_alpha: float = 0.18,
) -> Image.Image:
    """Build impact frame from clean actor masks only.

    masks: (RGBA-or-L, origin) or (RGBA-or-L, origin, solid_rgba).
    Default silhouette colour is flat black; pass a light colour for the
    chain/lock so it reads against the door.
    """
    w, h = size
    out = Image.new('RGBA', (w, h), (4, 6, 10, 255))
    burst = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(burst)
    for rr, col in (
        (burst_radius * 2.6, (255, 236, 210, 255)),
        (burst_radius * 1.9, (255, 248, 235, 255)),
        (burst_radius * 1.2, (255, 255, 255, 255)),
    ):
        bd.ellipse([cx - rr, cy - int(rr * 0.82), cx + rr, cy + int(rr * 0.82)], fill=col)
    burst = burst.filter(ImageFilter.GaussianBlur(8))
    out.alpha_composite(burst)

    if bg_dim is not None and bg_dim_alpha > 0:
        dim = bg_dim.convert('L').point(lambda v: int(40 + v * 0.08))
        dim_rgba = Image.merge('RGBA', (dim, dim, dim,
            Image.new('L', (w, h), int(255 * bg_dim_alpha))))
        dim_rgba = dim_rgba.filter(ImageFilter.GaussianBlur(12))
        out.alpha_composite(dim_rgba)

    default_col = (8, 10, 14, 255) if mode == 'black_on_burst' else (250, 248, 242, 255)
    for item in masks:
        if len(item) == 3:
            mask_im, origin, sil_color = item
        else:
            mask_im, origin = item
            sil_color = default_col
        if mask_im.mode == 'RGBA':
            m = mask_im.split()[-1]
        else:
            m = mask_im.convert('L')
        m = _harden_alpha(m, thresh=36)
        if m.getbbox() is None:
            continue
        solid = Image.new('RGBA', mask_im.size, sil_color)
        out.paste(solid, origin, m)
    return out


def make_impact_frame_from_masks(
    size: Tuple[int, int],
    cx: int, cy: int,
    masks: List[Tuple[Image.Image, Tuple[int, int]]],
    tier: ImpactTier,
    *,
    burst_u: float = 0.0,
    direction: Tuple[float, float] = (-1.0, 0.05),
    phase: float = 0.0,
    bg_dim: Optional[Image.Image] = None,
) -> Image.Image:
    """Public API: clean-mask silhouette + asymmetric spark."""
    out = make_clean_silhouette_frame(
        size, cx, cy, masks,
        burst_radius=int(120 + 30 * (1 - burst_u)),
        mode='black_on_burst',
        bg_dim=bg_dim,
        bg_dim_alpha=0.12 if tier.name != 'light' else 0.0,
    )
    hit_spark(out, cx, cy, burst_u * 0.25, tier, direction=direction,
              torso_w=64, phase=phase)
    return out


# Keep a deprecated shim so old callers don't crash — routes to empty masks warning
def make_impact_frame(scene_rgba: Image.Image, cx: int, cy: int, radius: int,
                      tier: ImpactTier, burst_u: float = 0.0) -> Image.Image:
    """DEPRECATED luminance path — do not use. Prefer make_impact_frame_from_masks."""
    # Safe fallback: just burst + spark, no noisy threshold
    w, h = scene_rgba.size
    out = make_clean_silhouette_frame((w, h), cx, cy, [], burst_radius=radius,
                                      mode='black_on_burst')
    hit_spark(out, cx, cy, burst_u * 0.3, tier, direction=(-1, 0.05), torso_w=64)
    return out


def impact_frame_sequence(scene_rgba: Image.Image, cx: int, cy: int,
                          tier: ImpactTier) -> list:
    frames = []
    for i in range(tier.impact_frames):
        u = i / max(1, tier.impact_frames)
        rad = int(110 + 40 * (1 - u))
        frames.append(make_impact_frame(scene_rgba, cx, cy, rad, tier, burst_u=u))
    return frames


# ---------- Soft shaded wind ----------
def soft_wind_blob(canvas: Image.Image, cx: float, cy: float, scale: float,
                   direction: Tuple[float, float] = (1, 0), alpha: float = 0.9):
    if scale <= 0 or alpha <= 0:
        return
    ov = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    dx, dy = direction
    L = math.hypot(dx, dy) or 1
    dx, dy = dx / L, dy / L
    px, py = -dy, dx
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
        ld.ellipse([x - rw + px * 5, y - rh + py * 3, x + rw + px * 5, y + rh + py * 3],
                   fill=(35, 60, 100, int(aa * 0.5)))
        ld.ellipse([x - rw, y - rh, x + rw, y + rh], fill=(130, 195, 230, aa))
        ld.ellipse([x - rw * 0.5 - px * 3, y - rh * 0.55 - py * 3,
                    x + rw * 0.25 - px * 3, y + rh * 0.15 - py * 3],
                   fill=(235, 250, 255, int(aa * 0.9)))
        layer = layer.filter(ImageFilter.GaussianBlur(2.8 + 1.2 * (1 - t)))
        ov.alpha_composite(layer)
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
    if u <= 0:
        return frm
    e = u * u * (3 - 2 * u)
    mx = (frm[0] + to[0]) / 2
    my = (frm[1] + to[1]) / 2 + 16
    tip = ((1 - e) * (1 - e) * frm[0] + 2 * (1 - e) * e * mx + e * e * to[0],
           (1 - e) * (1 - e) * frm[1] + 2 * (1 - e) * e * my + e * e * to[1])
    dx, dy = to[0] - frm[0], to[1] - frm[1]
    sc = scale * (1.05 - 0.25 * e)
    soft_wind_blob(canvas, tip[0], tip[1], sc, direction=(dx, dy), alpha=0.95 - 0.25 * e)
    return tip


def soft_wind_wrap(canvas: Image.Image, hx: float, hy: float, t: float,
                   scale: float = 36.0, alpha: float = 0.85):
    for i in range(5):
        ang = t * 3.5 + i * 1.1
        r = scale * (0.35 + 0.15 * math.sin(t * 2 + i))
        x = hx + math.cos(ang) * r
        y = hy + math.sin(ang) * r * 0.6 - 4
        soft_wind_blob(canvas, x, y, scale * 0.45, direction=(math.cos(ang + 1), math.sin(ang)),
                       alpha=alpha * (0.7 + 0.3 * math.sin(i + t)))


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
    for i in range(10):
        along = (i - 2) * 14 * (0.5 + u)
        side = ((i % 5) - 2) * 7 * (1 - u * 0.4)
        x = cx + dx * along + px * side
        y = cy + 18 + dy * along * 0.3 + abs(side) * 0.15
        rw = 10 + i * 2.5 + 20 * u
        rh = 3.5 + (i % 3)
        aa = int(110 * strength * (1 - u) * (1 - abs(i - 4) / 8))
        if aa <= 0:
            continue
        d.ellipse([x - rw, y - rh, x + rw, y + rh], fill=(180, 190, 200, aa))
    ov = ov.filter(ImageFilter.GaussianBlur(1.2))
    canvas.alpha_composite(ov)


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
        y = cy + fy * dist * 0.7 + 40 * u * u
        bl = 6 + 10 * (1 - u)
        x0, y0 = x - fx * bl, y - fy * bl
        aa = int(220 * (1 - u))
        for k in range(4):
            tt = k / 3
            xx = x0 + (x - x0) * tt
            yy = y0 + (y - y0) * tt
            rr = 2.5 + 1.5 * (1 - tt)
            d.ellipse([xx - rr, yy - rr, xx + rr, yy + rr], fill=(255, 220, 150, aa))
        d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(255, 255, 240, aa))
    canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(0.6)))


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
    dx, dy = direction
    L = math.hypot(dx, dy) or 1
    dx, dy = dx / L, dy / L
    px, py = -dy, dx
    decay = math.exp(-phase * 3.5)
    along = math.sin(phase * 55) * amp * decay
    perp = math.sin(phase * 73 + 1.2) * amp * 0.35 * decay
    return (dx * along + px * perp, dy * along + py * perp)


def contact_shadow(canvas: Image.Image, x: float, y: float, rw: float = 14, rh: float = 5,
                   alpha: int = 70):
    ov = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).ellipse([x - rw, y - rh, x + rw, y + rh], fill=(0, 0, 0, alpha))
    canvas.alpha_composite(ov.filter(ImageFilter.GaussianBlur(2)))
