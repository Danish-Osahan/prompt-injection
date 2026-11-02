"""art-v9: pack Noor's reaction sheets (noor9.py renders) with pack5: lookL/lookR/surprise (8 dirs), phone/shadow (S, SE, SW)."""
import os, sys, json, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import pack5
pack5.SRC = os.path.join(HERE, '../render/sprites9'); pack5.OUT = os.path.join(HERE, '../out/sprites'); os.makedirs(pack5.OUT, exist_ok=True)
G = os.path.join(HERE, '../../game/public/assets/sprites/')
TELL = {'lookL': 'head turned left (her left) toward a nearby object', 'lookR': 'head turned right toward a nearby object',
        'surprise': 'small jolt after a word swap: lean back, arms twitch, settle', 'phone': 'idle: lifts her phone, reads it (head down, tiny tilts)',
        'shadow': 'idle: looks down and over her shoulder, where her shadow should be'}
GROUPS = [([('lookL', 1, 1), ('lookR', 1, 1), ('surprise', 5, 14)], ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']), ([('phone', 6, 6), ('shadow', 6, 5)], ['S', 'SE', 'SW'])]
for group, dirs in GROUPS:
    pack5.DIRS_FOR['noor'] = dirs
    pack5.anims_for = lambda name, g=group: {a: (n, f) for a, n, f in g}
    pack5.EXTRA_TELL = dict(getattr(pack5, 'EXTRA_TELL', {}), **TELL)
    pack5.pack('noor')
    for a, n, f in group:
        p = os.path.join(pack5.OUT, 'noor_%s.json' % a); d = json.load(open(p)); d['meta']['loop'] = False; json.dump(d, open(p, 'w'), indent=1)
        for ext in ('png', 'json'): shutil.copy(os.path.join(pack5.OUT, 'noor_%s.%s' % (a, ext)), G)
print('pack9 done')
