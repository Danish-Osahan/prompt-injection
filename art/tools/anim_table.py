# art-v5 animation table shared by enemies.py (Blender), enemy_sprites.py and pack5.py (plain Python).
ANIMS = {'idle': (6, 8), 'move': (6, 10), 'attack': (8, 12), 'hurt': (3, 12), 'death': (6, 10)}   # frames, fps
CARET_ANIMS = {'idle': (6, 8), 'move': (6, 12), 'assist': (8, 12), 'hurt': (3, 12)}            # Caret is an ALLY (story bible)
NOOR_ANIMS = {'idle': (6, 8), 'walk': (8, 12), 'attack': (8, 12)}
DIRS8 = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']
DIRS4 = ['S', 'E', 'N', 'W']
DIRS_FOR = {'noor': DIRS8, 'autocomplete': ['S'], 'hallucinator': ['S'], 'caret': ['S'], 'sycophant': DIRS8, 'warden': DIRS8, 'redactor': DIRS4}
SHADOW = {'noor': (40, 11, 130), 'autocomplete': (40, 10, 80), 'hallucinator': (34, 9, 80), 'caret': (18, 5, 70),
          'sycophant': (38, 11, 130), 'warden': (60, 16, 150), 'redactor': (46, 13, 140)}   # blob half-w, half-h, alpha
ATTACK_TELL = {'autocomplete': 'frames 0-3: keys snap into the word ASSUME and brighten; 4-5 lunge; 6-7 recover',
               'sycophant': 'frames 0-3: leans back, screen flares, gloves rise; 4-6 praise burst flies forward',
               'warden': 'frames 0-3: both fists overhead, X-face + shield brighten; 4 slam; 5-6 floor shockwave',
               'redactor': 'frames 0-3: marker arm lifts, red stripe + visor flare; 4-6 black bar sweeps forward',
               'hallucinator': 'frames 0-3: eyes flare, body inflates, citation cards spread; 4-6 spits a fake EXIT door',
               'caret': '(ally) assist: frames 0-3 hop + underline draws out; 3-7 soft teal ping ring'}
def anims_for(name):
    return NOOR_ANIMS if name == 'noor' else (CARET_ANIMS if name == 'caret' else ANIMS)

# ---------------- art-v6 additions ----------------
DIRS_FOR.update({'macro': DIRS4, 'receipt': ['S'], 'hound': DIRS4, 'thread_seg': DIRS8, 'thread_head': DIRS8, 'thread_tail': DIRS8,
                 'draft': ['S'], 'moths': ['S'], 'the49': ['S'], 'star49': ['S'], 'dez': DIRS4, 'fern': ['S']})
SHADOW.update({'macro': (66, 18, 150), 'receipt': (30, 8, 90), 'hound': (50, 13, 130), 'thread_seg': (30, 9, 90), 'thread_head': (36, 10, 110),
               'thread_tail': (22, 7, 80), 'draft': (20, 6, 60), 'moths': (30, 8, 40), 'the49': (60, 16, 120), 'star49': (16, 5, 50), 'dez': (40, 11, 130), 'fern': (50, 14, 60)})
ATTACK_TELL.update({
    'macro': 'frames 0-3: stamp head lifts high, ink pad glows amber; 4 stamp lands (hit) + template square; 5-7 recover',
    'receipt': 'frames 0-3: both ticks tilt toward Noor, lantern narrows + brightens; 4 thin read-beam (hit); 5-7 fade',
    'hound': 'frames 0-3: dial flashes the last second, ears flatten, crouch; 4-5 bite lunge (hit 5); 6-7 recover',
    'thread_seg': 'quote: frames 0-3 segment glows (replays an earlier enemy accent); 4 pulse (hit); 5-7 fade',
    'thread_head': 'frames 0-3: wax-seal eye glows, flap opens; 4 lunge (hit); 5-7 recover',
    'thread_tail': 'frames 0-3: flap lifts; 4 flick (hit); 5-7 settle',
    'moths': 'frames 0-3: wings fold back, apology glyphs brighten; 4-5 dive (hit 5); 6-7 flutter back',
    'the49': 'frames 0-3: frame tilts, the 4.9 numerals flare gold; 4 rating beam (hit); 5-7 cool down',
    'star49': 'frames 0-3: star spins up and brightens; 4 drops (hit); 5-7 bounce back'})
HIT_FRAME = {'warden': 4, 'redactor': 5, 'sycophant': 5, 'autocomplete': 5, 'hallucinator': 5, 'macro': 4, 'receipt': 4, 'hound': 5,
             'thread_seg': 4, 'thread_head': 4, 'thread_tail': 4, 'moths': 5, 'the49': 4, 'star49': 4}
EXTRA_TELL = {'summon': 'binder flips open f0-2, three keycaps fly out f3-6 (spawn on f5), closes f7',
              'breach': 'sits f0-1, howls f2-5: coral ring expands (hit/area on f3); call one Autocomplete swarm on f5',
              'split': 'quote-line snaps with a small coral spark (f1-2); segment jolts and settles',
              'landed': 'loop: moth rests on a lantern, wings slowly open and close'}
ANIMS_EXTRA = {'warden': {'move': (8, 12)}, 'redactor': {'move': (8, 12)}, 'sycophant': {'move': (8, 12)}, 'hallucinator': {'move': (8, 12)}, 'autocomplete': {'move': (8, 12)}, 'macro': {'summon': (8, 12)}, 'hound': {'breach': (6, 10)}, 'thread_seg': {'split': (6, 12)}, 'moths': {'landed': (6, 6)}}
DRAFT_ANIMS = {'idle': (8, 8)}
DEZ_ANIMS = {'idle': (6, 6)}
NEVER_ANIMS = {'idle': (4, 6), 'hurt': (3, 12), 'death': (6, 12)}
STARX_ANIMS = {'idle': (6, 8), 'hurt': (3, 12), 'death': (6, 10)}
DIRS_FOR.update({'star49x': ['S'], 'never': ['S']}); SHADOW.update({'star49x': (16, 5, 50), 'never': (24, 6, 40)})
HIT_FRAME.update({'star49x': 4})
EXTRA_TELL.update({'never_break': 'NEVER tile: hurt = ice crack appears; death = six shards scatter (strike it during Fern\'s 2 s sag)'})
FERN_ANIMS = {'stagger': (6, 10), 'seated': (4, 4)}
EXTRA_TELL.update({'stagger': 'Fern stagger: windows drift apart, glow cone flickers (f1, f3), settles by f5', 'seated': 'phase 3: seated at the table in Kabir\'s chair, slow breathing loop'})
def anims_for(name):
    if name == 'fern': return FERN_ANIMS
    if name == 'noor': return NOOR_ANIMS
    if name == 'caret': return CARET_ANIMS
    if name == 'draft': return DRAFT_ANIMS
    if name == 'dez': return DEZ_ANIMS
    if name == 'never': return NEVER_ANIMS
    if name == 'star49x': return STARX_ANIMS
    d = dict(ANIMS); d.update(ANIMS_EXTRA.get(name, {})); return d
