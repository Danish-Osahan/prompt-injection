# art-v6: Noor v5 vs v6 direction comparison + calm attack strip -> out/H6_noor_views.png
from PIL import Image, ImageDraw, ImageFont
V5 = '/workspace/games/prompt-injection/art-v5/out/sprites/'; V6 = '/workspace/games/prompt-injection/art-v6/out/sprites/'
KFN = '/workspace/games/_downloads/ui-pack/Font/Kenney Future Narrow.ttf'; f = ImageFont.truetype(KFN, 16)
D = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']; c = Image.new('RGBA', (192*8 + 80, 192*3 + 90), (18, 28, 38, 255)); d = ImageDraw.Draw(c)
d.text((12, 8), 'NOOR  ·  V5 (TOP) VS V6 (MIDDLE): HAIR UP, SKIN AT TEMPLES AND NAPE, EARS, GLASSES ARMS, THINNER LOCKS  ·  BOTTOM: V6 CALM ATTACK (S ROW)', font=f, fill=(240, 200, 150))
for r, (src, an, col) in enumerate(((V5, 'walk', 2), (V6, 'walk', 2))):
    im = Image.open(src+'noor_%s.png' % an)
    for i, dn in enumerate(D):
        c.alpha_composite(im.crop((col*192, i*192, col*192+192, i*192+192)), (80 + i*192, 36 + r*192))
        if r == 0: d.text((80 + i*192 + 86, 36 + 192*2 + 2), dn, font=f, fill=(170, 220, 228))
    d.text((12, 36 + r*192 + 90), ('V5', 'V6')[r], font=f, fill=(170, 220, 228))
im = Image.open(V6+'noor_attack.png')
for k in range(8): c.alpha_composite(im.crop((k*192, 0, k*192+192, 192)), (80 + k*192, 36 + 2*192 + 24))
d.text((12, 36 + 2*192 + 110), 'ATTACK', font=f, fill=(170, 220, 228))
c.convert('RGB').save('/workspace/games/prompt-injection/art-v6/out/H6_noor_views.png'); print('ok')
