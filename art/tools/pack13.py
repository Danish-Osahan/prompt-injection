"""Pack noor12.py shield + windup frames (192 px, feet pivot 96,160, outline + glow baked).
usage: SRC13=/tmp/noor13final OUT13=/tmp/noor13pack python3 pack13.py
Does not write to art/out or art/render. Copy the png+json into game/public/assets/sprites12 yourself.
"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import pack5
SRC = os.environ.get('SRC13'); OUT = os.environ.get('OUT13')
if not SRC or not OUT:
    raise SystemExit('set SRC13 and OUT13 (clean dirs; do not use art/out or art/render/sprites12)')
DUR = {'shield': [80, 140], 'windup': [70, 90, 60]}
TELL = {
 'shield': 'SHIELD-EYES: 0 raise, 1 hold (lean back, forearm across the eyes). No CHEAT yaw so the front view reads as a bar across the face. Hold the last frame.',
 'windup': 'THROW WIND-UP: 0 coil, 1 arm drawn back with a glowing hand, 2 release flick. 220ms total. Dust ring and extra hand light are drawn game-side. N/S use CHEAT yaw so the arm reads.',
}
meta12 = json.load(open(os.path.join(SRC, 'meta12.json')))
A12 = {an: (len(DUR[an]), round(1000*len(DUR[an])/sum(DUR[an]))) for an in DUR}
for an in A12: assert meta12[an]['frames'] == len(DUR[an]), an
pack5.SRC = SRC; pack5.OUT = OUT; os.makedirs(OUT, exist_ok=True)
pack5.anims_for = lambda name: A12
pack5.EXTRA_TELL = dict(getattr(pack5, 'EXTRA_TELL', {}), **TELL)
pack5.pack('noor')
for an in DUR:
    m = meta12[an]
    p = os.path.join(OUT, 'noor_%s.json' % an)
    d = json.load(open(p))
    d['meta'].update({'app': 'prompt-injection art-v13 pack13.py', 'loop': False, 'dur_ms': DUR[an],
                      'events': {int(k): v for k, v in m['events'].items()}, 'smear': m['smear'],
                      'step_px': m['step_px'], 'tell': TELL[an], 'hand': m['hand']})
    json.dump(d, open(p, 'w'), indent=1)
print('pack13 done', OUT)
