"""Fail if a still has the office diorama void (near-black 2,10,21) along the canvas edges.
Skips a top HUD band (hp / esc / menu). The west wall is dark navy, not the void colour.
"""
import sys
from pathlib import Path
from PIL import Image
import numpy as np

path = Path(sys.argv[1])
im = np.array(Image.open(path).convert('RGB'))
h, w, _ = im.shape
VOID = np.array([2, 10, 21], dtype=np.int16)
HUD = 36  # skip top HUD strip

def void_frac(pix, tol=18):
    d = np.abs(pix.astype(np.int16) - VOID).sum(-1)
    return float((d <= tol).mean())

strips = {
    'left': im[HUD:, :3],
    'right': im[HUD:, -3:],
    'top': im[HUD:HUD+3, :],   # first rows under the HUD
    'bottom': im[-3:, :],
}
bad = []
for name, pix in strips.items():
    f = void_frac(pix)
    med = float(np.median(pix.reshape(-1, 3).mean(1)))
    print(f'  edge {name}: void-frac={f:.4f} median-lum={med:.1f}')
    if f > 0.02:
        bad.append(f'{name} void-frac {f:.3f}')
    # also catch a near-black letterbox that isn't exact void (lum < 16)
    lum = pix.reshape(-1, 3).mean(1)
    if float((lum < 16).mean()) > 0.15:
        bad.append(f'{name} near-black band {(lum<16).mean():.3f} (median lum {med:.1f})')

if bad:
    print('FAIL', path, '; '.join(bad))
    sys.exit(1)
print('OK', path.name)
