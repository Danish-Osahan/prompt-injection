"""art-v12: pack Noor's NEW attack set (noor12.py frames) into 192 px sheets with pack5 (same format as the game's 38 deg sheets:
rows S,SE,E,NE,N,NW,W,SW, cols = frames, feet pivot 96,160, outline + glow baked). Every sheet is <= 4096 px wide (max 11 cols = 2112 px).
Also writes noor_attacks12.json: per-frame durations (ms), hit / release / pinch / peel events, hit-stop, smear frames,
root-motion step (px along facing, 1x sheet px), chain window, and the right-paw position per frame per direction (for attaching words / beam origin).
usage: python3 pack12.py   (reads ../render/sprites12, writes ../out/sprites12 and copies to ../../mock-attack/assets)"""
import os, sys, json, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import pack5
SRC = os.environ.get('SRC12', os.path.join(HERE, '../render/sprites12')); OUT = os.environ.get('OUT12', os.path.join(HERE, '../out/sprites12')); MOCK = os.environ.get('MOCK12', os.path.join(HERE, '../../mock-attack/assets'))
# frame durations in ms (variable timing: slow anticipation, 1-2 frame snaps, held contact, eased recovery)
DUR = {
 'combo1': [55, 70, 33, 42, 60, 70, 80],
 'combo2': [55, 85, 33, 33, 42, 60, 70, 80],
 'combo3': [60, 120, 33, 33, 33, 50, 80, 70, 70, 80, 90],
 'peel': [70, 80, 60, 70, 110, 80, 50, 70, 80, 100],
 'throw': [60, 80, 130, 33, 50, 60, 80, 70, 80, 100],
 'charge_in': [60, 70, 80, 90],
 'charge_hold': [90]*6,
 'release': [70, 50, 60, 80, 80, 90, 100],
}
HITSTOP = {'combo1': {3: 70}, 'combo2': {4: 85}, 'combo3': {5: 130}, 'throw': {}, 'release': {1: 60}}   # extra hold on the contact frame, ms
CHAIN = {'combo1': 4, 'combo2': 5}   # earliest frame the next combo hit may start (input buffered before that)
TELL = {
 'combo1': 'JAB: 0-1 wind-up (paw drawn back to the hip, torso coils), 2 smear, 3 HIT (snap, step), 4 hold, 5-6 recovery; hair/hem keep swinging',
 'combo2': 'CROSS-BODY SWIPE: 0-1 wind-up (arm out wide, torso twists away), 2-3 smear, 4 HIT (arm across, step), 5 hold, 6-7 recovery',
 'combo3': 'SPINNING FINISHER: 0-1 coil (crouch, counter-turn), 2-4 smear spin (360 deg), 5 HIT back-fist out of the spin (step), 6 hold, 7-10 recovery',
 'peel': 'REACH AND PEEL: 0-1 notice + draw back, 2-3 reach, 4 PINCH (fingers close), 5 tug, 6 PEEL (pull back), 7-9 word held at the chest',
 'throw': 'WORD THROW: 0-2 wind-up over the shoulder (2 = held top), 3 smear, 4 RELEASE (wrist flick), 5-6 follow-through, 7-9 recovery',
 'charge_in': 'BEAM CHARGE IN: hand starts to glow, she plants and leans back; then loop charge_hold',
 'charge_hold': 'BEAM CHARGE HOLD (loop): leans back, paw glow pulses',
 'release': 'BEAM RELEASE: 0 brace (crouch, lean in), 1 RELEASE (glow peak), 2-3 recoil (lean back, step back), 4-6 recover',
}
meta12 = json.load(open(os.path.join(SRC, 'meta12.json')))
A12 = {an: (len(DUR[an]), round(1000*len(DUR[an])/sum(DUR[an]))) for an in DUR}
for an in A12: assert meta12[an]['frames'] == len(DUR[an]), an
pack5.SRC = SRC; pack5.OUT = OUT; os.makedirs(OUT, exist_ok=True)
pack5.anims_for = lambda name: A12
pack5.EXTRA_TELL = dict(getattr(pack5, 'EXTRA_TELL', {}), **TELL)
pack5.pack('noor')
ALL = {'note': 'Noor attack set art-v12 (preview, not wired into game/src). Sheets: noor_<anim>.png/.json, rows = facing, cols = frames. '
               'Play each frame for dur_ms[k]; on a hit frame add hitstop_ms[k] (freeze Noor AND the target). step_px = cumulative root motion along the facing '
               '(1x sheet px; the mock multiplies by the 0.78 sprite scale). hand = right paw (x, y) in the 192 px cell per frame per direction.',
       'anims': {}}
for an in DUR:
    m = meta12[an]
    rec = {'frames': len(DUR[an]), 'dur_ms': DUR[an], 'total_ms': sum(DUR[an]) + sum(HITSTOP.get(an, {}).values()), 'loop': m['loop'],
           'events': {int(k): v for k, v in m['events'].items()}, 'hitstop_ms': HITSTOP.get(an, {}), 'smear': m['smear'], 'step_px': m['step_px'],
           'tell': TELL[an], 'hand': m['hand']}
    if an in CHAIN: rec['chain_from'] = CHAIN[an]
    ALL['anims'][an] = rec
    p = os.path.join(OUT, 'noor_%s.json' % an); d = json.load(open(p))
    d['meta'].update({'app': 'prompt-injection art-v12 pack12.py', 'loop': m['loop'], 'dur_ms': DUR[an], 'events': rec['events'], 'hitstop_ms': rec['hitstop_ms'],
                      'smear': m['smear'], 'step_px': m['step_px']})
    json.dump(d, open(p, 'w'), indent=1)
json.dump(ALL, open(os.path.join(OUT, 'noor_attacks12.json'), 'w'), indent=1)
os.makedirs(MOCK, exist_ok=True)
for fn in os.listdir(OUT):
    if fn.endswith('.png') or fn.endswith('.json'): shutil.copy(os.path.join(OUT, fn), MOCK)
from PIL import Image
for fn in os.listdir(OUT):
    if fn.endswith('.png'): w, h = Image.open(os.path.join(OUT, fn)).size; assert w <= 4096 and h <= 4096, fn
print('pack12 done')
