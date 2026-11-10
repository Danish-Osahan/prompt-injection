#!/usr/bin/env python3
"""Full-bleed plates: fill the uniform letterbox with the median color of the
painted edge (same idea as office_bleed). Arena keeps its circle; only the
near-black void is covered with a dark floor tone. corridor_dark is lifted
just enough to be readable."""
import cv2
import numpy as np
from pathlib import Path

ROOT = Path('/workspace/repos/prompt-injection/game/public/assets/rooms')
PRE = Path('/tmp/plate_preview')
PRE.mkdir(exist_ok=True)

def find_frame(im):
    gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    corners = np.concatenate([
        gray[:10, :10].ravel(), gray[:10, -10:].ravel(),
        gray[-10:, :10].ravel(), gray[-10:, -10:].ravel(),
    ])
    bg = float(np.median(corners))

    def row_is_frame(y):
        r = gray[y].astype(np.float32)
        return (np.abs(r - bg) < 9).mean() > 0.90 and r.std() < 9

    def col_is_frame(x):
        c = gray[:, x].astype(np.float32)
        return (np.abs(c - bg) < 9).mean() > 0.90 and c.std() < 9

    t = 0
    while t < h // 3 and row_is_frame(t):
        t += 1
    b = h - 1
    while b > (2 * h) // 3 and row_is_frame(b):
        b -= 1
    l = 0
    while l < w // 3 and col_is_frame(l):
        l += 1
    r = w - 1
    while r > (2 * w) // 3 and col_is_frame(r):
        r -= 1
    # Dark skirting that has a little structure still counts as a letterbox.
    if b >= h - 8:
        for y in range(h - 1, (2 * h) // 3, -1):
            if gray[y].mean() < 16:
                b = y - 1
            else:
                break
    return t, b, l, r, bg

def median_color(sample):
    pix = sample.reshape(-1, 3).astype(np.float32)
    if len(pix) < 4:
        return np.array([16, 14, 12], dtype=np.float32)
    return np.median(pix, axis=0)

def fill_edge(out, y0, y1, x0, x1, color, toward='out', fade=0.18):
    if y1 <= y0 or x1 <= x0:
        return
    h, w = out.shape[:2]
    yy, xx = np.mgrid[y0:y1, x0:x1]
    region = out[y0:y1, x0:x1].astype(np.float32)
    # 0 at the content edge, 1 at the canvas edge.
    if toward == 'up':
        t = (y1 - 1 - yy) / max(1, y1 - y0)
    elif toward == 'down':
        t = (yy - y0) / max(1, y1 - y0)
    elif toward == 'left':
        t = (x1 - 1 - xx) / max(1, x1 - x0)
    else:
        t = (xx - x0) / max(1, x1 - x0)
    col = color * (1 - fade * t[..., None])
    # Tiny grain so a big fill doesn't look like a flat paste.
    rng = np.random.default_rng(7)
    grain = rng.normal(0, 1.2, region.shape).astype(np.float32)
    out[y0:y1, x0:x1] = np.clip(col + grain, 0, 255)

def extend_letterbox(im, t, b, l, r):
    out = im.copy()
    h, w = im.shape[:2]
    band = 6
    if t > 0:
        fill_edge(out, 0, t, l, r + 1, median_color(im[t:t + band, l:r + 1]), 'up')
    if b < h - 1:
        fill_edge(out, b + 1, h, l, r + 1, median_color(im[max(0, b - band + 1):b + 1, l:r + 1]), 'down')
    if l > 0:
        fill_edge(out, t, b + 1, 0, l, median_color(im[t:b + 1, l:l + band]), 'left')
    if r < w - 1:
        fill_edge(out, t, b + 1, r + 1, w, median_color(im[t:b + 1, max(0, r - band + 1):r + 1]), 'right')
    # corners
    if t > 0 and l > 0:
        fill_edge(out, 0, t, 0, l, median_color(im[t:t + band, l:l + band]), 'up')
    if t > 0 and r < w - 1:
        fill_edge(out, 0, t, r + 1, w, median_color(im[t:t + band, max(0, r - band + 1):r + 1]), 'up')
    if b < h - 1 and l > 0:
        fill_edge(out, b + 1, h, 0, l, median_color(im[max(0, b - band + 1):b + 1, l:l + band]), 'down')
    if b < h - 1 and r < w - 1:
        fill_edge(out, b + 1, h, r + 1, w, median_color(im[max(0, b - band + 1):b + 1, max(0, r - band + 1):r + 1]), 'down')
    # Soft seam
    seam = np.zeros((h, w), np.uint8)
    if t > 0: seam[max(0, t - 3):t + 3, :] = 255
    if b < h - 1: seam[b - 2:min(h, b + 4), :] = 255
    if l > 0: seam[:, max(0, l - 3):l + 3] = 255
    if r < w - 1: seam[:, r - 2:min(w, r + 4)] = 255
    if seam.max():
        blur = cv2.GaussianBlur(out, (0, 0), 1.1)
        out = np.where(seam[..., None] == 255, blur, out)
    return out

def cover_void(im, max_gray=10):
    gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    void = gray <= max_gray
    if not void.any():
        return im
    content = gray > max_gray + 2
    fill = np.array([22, 18, 14], dtype=np.float32)
    if content.any():
        vals = gray[content]
        cut = np.percentile(vals, 12)
        sample = im[content & (gray <= cut + 6)]
        if len(sample) > 30:
            fill = np.median(sample.reshape(-1, 3), axis=0).astype(np.float32)
    out = im.astype(np.float32)
    m = cv2.GaussianBlur(void.astype(np.float32), (0, 0), 2.4)
    m = np.clip(m * 1.15, 0, 1)
    out = out * (1 - m[..., None]) + fill * m[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)

def lift_corridor(im):
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    L = lab[:, :, 0] / 255.0
    # Milder than the last pass — still a dark corridor, just readable.
    lab[:, :, 0] = np.clip(np.power(L, 0.82) * 1.10 + 0.025, 0, 1) * 255.0
    lab[:, :, 1] = 128 + (lab[:, :, 1] - 128) * 1.06
    lab[:, :, 2] = 128 + (lab[:, :, 2] - 128) * 1.06
    return cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)

JOBS = [
    # src, dst, lift, letterbox, void
    ('hub_shut.jpg', 'hub_shut_bleed.jpg', False, True, False),
    ('hub_open.jpg', 'hub_open_bleed.jpg', False, True, False),
    ('corridor_dark.jpg', 'corridor_dark_bleed.jpg', True, True, False),
    ('corridor_lit.jpg', 'corridor_lit_bleed.jpg', False, True, False),
    ('archive_H.jpg', 'archive_H_bleed.jpg', False, True, False),
    ('archive_L.jpg', 'archive_L_bleed.jpg', False, True, False),
    ('arena.jpg', 'arena_bleed.jpg', False, False, True),
    ('message.jpg', 'message_bleed.jpg', False, True, False),
]

def report(tag, im):
    print(f"  {tag:28} L{im[:, :8].mean():.1f} R{im[:, -8:].mean():.1f} T{im[:8, :].mean():.1f} B{im[-8:, :].mean():.1f}  mean={im.mean():.1f}")

def main():
    for src_name, dst_name, lift, box, void in JOBS:
        src = cv2.imread(str(ROOT / src_name))
        t, b, l, r, bg = find_frame(src)
        print(f"{src_name}: frame T{t} B{src.shape[0]-1-b} L{l} R{src.shape[1]-1-r}  bg={bg:.1f}")
        out = src
        if box:
            out = extend_letterbox(src, t, b, l, r)
        if void:
            out = cover_void(out, max_gray=10)
        if lift:
            out = lift_corridor(out)
        cv2.imwrite(str(ROOT / dst_name), out, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        report('src', src)
        report('dst', out)
        cv2.imwrite(str(PRE / dst_name.replace('.jpg', '_sm.jpg')), cv2.resize(out, (640, 360)))

if __name__ == '__main__':
    main()
