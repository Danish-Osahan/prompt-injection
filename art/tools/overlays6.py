# art-v6 post overlays (exec'd inside post6.py: uses im, proj, side, UI_RECTS, W, H). OVERLAY[name](im) -> im
from PIL import Image as _I
def _review(im):
    """floor 3 Review: the pending ring (60 % filled) from the plate atlas, centred on the plate, drawn flat-ish"""
    sys.path.insert(0, HERE); import make_tex_v6 as mt
    x, y, z = side['extra'].get('review_plate', [0, 0, 0]); cx, cy = proj((x, y, z))
    r = mt.review_ring(0.62, 300).resize((300, 150), _I.LANCZOS)
    im = im.convert('RGBA'); im.alpha_composite(r, (int(cx - 150), int(cy - 75))); return im.convert('RGB')
OVERLAY = {'review': _review}
