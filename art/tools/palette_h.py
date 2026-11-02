# Locked 24-colour palette for the hybrid direction (C geometry + A neon-noir light).
from PIL import Image, ImageDraw, ImageFont
PAL24 = [
    # night ramp: ink -> indigo -> lavender (8)
    (5, 4, 14), (10, 10, 28), (16, 18, 44), (26, 28, 62), (40, 42, 86), (62, 64, 118), (96, 100, 156), (150, 158, 206),
    # magenta neon (4)
    (58, 16, 58), (120, 30, 104), (214, 58, 168), (255, 140, 220),
    # cyan neon (4)
    (14, 52, 84), (24, 120, 170), (70, 210, 255), (190, 245, 255),
    # warm: Noor's mustard + skin + warm dark (6)
    (54, 32, 44), (120, 76, 30), (206, 150, 62), (255, 214, 110), (176, 112, 82), (232, 170, 130),
    # alarm red + paper white (2)
    (226, 40, 70), (240, 244, 255),
]
assert len(PAL24) == 24
NAMES = ['ink','night','navy','indigo','dusk','slate','haze','lavender','plum','berry','magenta','pink',
         'deep teal','teal','cyan','ice','umber','ochre','mustard','gold','skin','skin light','alarm','paper']
_P = Image.new('P', (1, 1)); _flat = [c for t in PAL24 for c in t]; _P.putpalette(_flat + list(_flat[:3])*(256-24))
def quant_locked(im):
    return im.convert('RGB').quantize(palette=_P, dither=Image.Dither.NONE).convert('RGB')
def strip(path, font):
    cols, cw, sh, pad = 8, 156, 70, 16; W = cols*cw + pad*2; rows = 3
    im = Image.new('RGB', (W, pad*2 + 40 + rows*(sh+52)), (5, 4, 14)); d = ImageDraw.Draw(im)
    f = ImageFont.truetype(font, 14); ft = ImageFont.truetype(font, 20)
    d.text((pad, pad), 'PROMPT INJECTION - HYBRID LOCKED PALETTE (24)', font=ft, fill=(150, 235, 255))
    for i, c in enumerate(PAL24):
        r, k = divmod(i, cols); x = pad + k*cw; y = pad + 40 + r*(sh+52)
        d.rectangle([x, y, x+cw-8, y+sh], fill=c, outline=(40, 42, 86))
        d.text((x, y+sh+5), '#%02X%02X%02X' % c, font=f, fill=(200, 205, 230))
        d.text((x, y+sh+21), NAMES[i].upper(), font=f, fill=(130, 136, 186))
    im.save(path)
if __name__ == '__main__':
    strip('/workspace/games/prompt-injection/art-v3-hybrid/out/H_palette24.png', '/workspace/games/_downloads/ui-pack/Font/Kenney Future Narrow.ttf')
    print('ok')

import numpy as np
_PA = np.array(PAL24, dtype=np.float32)
_B4 = (np.array([[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]], dtype=np.float32)+0.5)/16 - 0.5
def quant_rm(im, mask_dither=None, amp=14.0, sat_boost=None):
    """nearest PAL24 colour by 'redmean' distance (hue-preserving); optional ordered dither where mask_dither"""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    if sat_boost is not None:
        m, k = sat_boost; g = a.mean(2, keepdims=True); a = np.where(m[..., None], g + (a-g)*k, a)
    if mask_dither is not None:
        h, w = a.shape[:2]; t = np.tile(_B4, (h//4+1, w//4+1))[:h, :w]
        a = a + (t*amp*mask_dither)[..., None]
    a = np.clip(a, 0, 255)
    r = (a[..., None, 0] + _PA[None, None, :, 0])/2
    d = (2+r/256)*(a[..., None, 0]-_PA[:, 0])**2 + 4*(a[..., None, 1]-_PA[:, 1])**2 + (2+(255-r)/256)*(a[..., None, 2]-_PA[:, 2])**2
    return Image.fromarray(_PA[d.argmin(-1)].astype(np.uint8))
