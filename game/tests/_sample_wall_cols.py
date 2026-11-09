from PIL import Image
import numpy as np, json, sys
im = np.array(Image.open(sys.argv[1]).convert("RGB"))
H, W = im.shape[:2]
pts = json.loads(sys.argv[2])
out = {}
for key, p in pts.items():
  x = int(round(p["x"])); y = int(round(p["y"]))
  x = max(1, min(W - 2, x)); y = max(25, min(H - 25, y))
  strip = im[y - 25 : y + 25, x]  # (50, 3)
  lum = strip.mean(axis=1)  # per-row luminance
  out[key] = {
    "x": x, "y": y, "rgb": [int(v) for v in im[y, x]],
    "lum": float(lum.mean()), "lumStd": float(lum.std()),
  }
print(json.dumps(out))
