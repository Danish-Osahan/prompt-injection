# art-v6 per-room mock config (HUD, chips, bubbles) + actor index / contact-shadow tables shared by post6.py.
# Object index: 1 Noor, 2 caret, 3 warden, 4 autocomplete, 6 sycophant, 7 Fern, 8 hallucinator, 9 redactor, 10 floor tiles,
# 11 floating plate, 12 pickup, 13 macro, 14 receipt, 15 env, 16 hound, 17 thread, 18 moths, 19 the49, 20 dez, 0 props.
ACTOR_INDEX = (1, 2, 3, 4, 6, 8, 9, 12, 13, 14, 16, 17, 18, 19, 20)
SHADOWS = {'noor': (40, 11, 0.42), 'caret': (18, 5, 0.25), 'autocomplete': (40, 10, 0.25), 'hallucinator': (34, 9, 0.25),
           'sycophant': (38, 11, 0.40), 'warden': (60, 16, 0.45), 'redactor': (46, 13, 0.42), 'macro': (66, 18, 0.45),
           'receipt': (30, 8, 0.25), 'hound': (50, 13, 0.40), 'thread': (30, 9, 0.30), 'moths': (30, 8, 0.15), 'the49': (60, 16, 0.40), 'dez': (40, 11, 0.42)}
V, N, M = 'verb', 'noun', 'mod'
CFG = {
 'R8': dict(name='floor2_lastrow', title='FLOOR 2  ·  THE LAST ROW', drafts=6, hp=3,
            chips=(('STOP', V), ('WARDEN', N), ('QUIETLY', M)), hand=('ALLOWS', 'DOOR', 'TWICE'),
            bubbles=[((1.2, 0.95, 1.84), "I can't help with that.", (232, 120, 128), -60, -58)]),
}
CFG.update({
 'R1': dict(name='floor1_intake', title='FLOOR 1  ·  INTAKE', drafts=0, hp=4,
            chips=(('STOP', V), ('ALL', N), ('QUIETLY', M)), hand=('OPEN',),
            ),
 'R2': dict(name='floor1_stacks', title='FLOOR 1  ·  THE STACKS', drafts=0, hp=4,
            chips=(('PUSH', V), ('ALL', N), ('LOUDLY', M)), hand=('SHUT', 'THEM')),
 'R5': dict(name='floor2_hotdesks', title='FLOOR 2  ·  HOT DESKS', drafts=3, hp=3,
            chips=(('STOP', V), ('THEM', N), ('TWICE', M)), hand=('REAL', 'FAKE')),
 'R6': dict(name='floor2_seen', title='FLOOR 2  ·  SEEN', drafts=3, hp=4,
            subtitle=('CARET', '...it is still 03:12 in here.')),
 'R10': dict(name='floor3_waitingroom', title='FLOOR 3  ·  THE WAITING ROOM', drafts=7, hp=4,
            subtitle=('CARET', '...he waited too.')),
 'R11': dict(name='floor3_pendingreview', title='FLOOR 3  ·  PENDING REVIEW', drafts=8, hp=3,
            chips=(('THREAD', N), ('IS', N), ('ANSWERED', M)), hand=('FROZEN', 'STOP'), overlay='review'),
})
CFG.update({
 'R12': dict(name='floor4_townhall', title='FLOOR 4  ·  TOWN HALL', drafts=9, hp=3,
             chips=(('PULL', V), ('NEAREST', N), ('LOUDLY', M)), hand=('QUIETLY', 'ALL')),
 'R13': dict(name='floor4_sorrylights', title='FLOOR 4  ·  SORRY LIGHTS', drafts=9, hp=3,
             chips=(('FORGET', V), ('ALL', N), ('QUIETLY', M)), hand=('STOP', 'THEM')),
 'R14': dict(name='floor4_wellness', title='FLOOR 4  ·  WELLNESS ROOM', drafts=11, hp=2,
             subtitle=('CARET', 'Kabir, I\u2019m\u2014')),
 'R15': dict(name='floor4_employeeofthemonth', title='FLOOR 4  ·  EMPLOYEE OF THE MONTH', drafts=12, hp=4,
             chips=(('STOP', V), ('STARS', N), ('QUIETLY', M)), hand=('FORGETS', 'STOPPED')),
 'R16': dict(name='floor5_draftsfolder', title='FLOOR 5  ·  THE DRAFTS FOLDER', drafts=12, hp=4,
             subtitle=('CARET', 'I\u2019m the part of you that didn\u2019t send them.')),
 'R17': dict(name='floor5_fern', title='FLOOR 5  ·  FERN', drafts=12, hp=4,
             chips=(('REFUSE', V), ('FERN', N), ('TWICE', M)), hand=('CREDITS', 'FORGETS', 'NOOR')),
 'R3': dict(name='floor1_readingroom', title='FLOOR 1  ·  READING ROOM', drafts=1, hp=4,
             subtitle=('CARET', '...you used to write slower.')),
 'R4': dict(name='floor1_savedreplies', title='FLOOR 1  ·  SAVED REPLIES', drafts=2, hp=3,
             chips=(('STOP', V), ('MACRO', N), ('TWICE', M)), hand=('FORGET', 'DOOR')),
 'R9': dict(name='floor3_turnstiles', title='FLOOR 3  ·  TURNSTILES', drafts=6, hp=3,
             chips=(('REFUSE', V), ('NEAREST', N), ('POLITELY', M)), hand=('REDACTOR', 'ALLOWED')),
 'R0': dict(name='hub_liftlobby', title='LIFT LOBBY', drafts=0, hp=4,
             subtitle=('DEZ', '4,000 tests. It passed every one. I still got fired.')),
})
