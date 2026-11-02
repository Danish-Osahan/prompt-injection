// art-v8 "linger" layer (2 Nov 2026): the optional content that rewards standing still in a room.
// Per room: story objects (kind 'look', caption + code line, some captions lie), one word-swap TOY pair (swaps only with each
// other, harmless), one LOST LINE (collectible, journal "unsent.txt"), a stand-still narrator line (first visit / revisit),
// and an inspect-all unlock (an extra code line + a narrator remark). Nothing here is on the main path.
// Lines are in docs/story/phase-1-levels.md, "Linger layer".
import type { PlateDef } from './plate';
import type { RoomId } from './save';

export interface Linger {
  plates: PlateDef[];
  idle: [string, string];                       // stand still ~6 s: first visit, revisit
  all: { say: string; code: string; val: string; sx: number; sy: number };   // after every story object is read
  toy: string;                                  // narrator line when the toy pair is swapped (first time)
  toyBack: string;                              // ... and when it is swapped back
  pairs?: Record<string, [string, string]>;     // art-v9: extra toy pairs (pair id -> [played, back])
}
const look = (id: string, sx: number, sy: number, x: number, y: number, cap: string, code: string, val: string, extra: Partial<PlateDef> = {}): PlateDef =>
  ({ id, words: [id.split('_')[1].toUpperCase()], slot: -1, x, y, sx, sy, kind: 'look', cap, code, val, ...extra });
const toy = (id: string, words: string[], sx: number, sy: number, x: number, y: number, cap: string, code: string, extra: Partial<PlateDef> = {}): PlateDef =>
  ({ id, words, slot: 2, x, y, sx, sy, kind: 'rule', toy: true, cap, code, ...extra });
const line = (id: string, sx: number, sy: number, x: number, y: number, text: string, extra: Partial<PlateDef> = {}): PlateDef =>
  ({ id, words: ['LINE'], slot: -1, x, y, sx, sy, kind: 'line', line: text, cap: 'A torn strip of paper, in your handwriting.', code: 'unsent.line', val: '"recovered"', ...extra });

export const LINES: { id: string; room: RoomId; text: string }[] = [
  { id: 'o_line', room: 'office', text: "Kabir. I'm sorry I made it about the claim." },
  { id: 'h_line', room: 'hub', text: "Papa asks about you like you're the weather." },
  { id: 'c_line', room: 'corridor', text: 'I still leave the hallway light on. Habit.' },
  { id: 'a_line', room: 'archive', text: 'I filed everything except the part where I miss you.' },
  { id: 'r_line', room: 'arena', text: 'I wrote this nine times. This is the honest one.' },
  { id: 'm_line', room: 'message', text: "Come home for Diwali. I'll make the bad chai." },
];
const L = (id: string) => LINES.find(l => l.id === id)!.text;

export const LINGER: Record<RoomId, Linger> = {
  office: {
    plates: [
      // art-v9: the phone and the photo are a second toy pair (the photo lies DOWN, the phone lies UP; trade them)
      toy('o_phone', ['PHONE', 'LIES', 'UP'], 165, 318, 165, 380, 'Your phone lies face {} on a desk that isn\u2019t yours. #N unread.', 'phone.side', { pair: 'flip' }),
      look('o_calendar', 300, 116, 300, 228, 'A calendar stuck on August. Nobody\u2019s fault, it says.', 'calendar.fault', 'NOOR'),
      look('o_sticky', 680, 114, 680, 228, 'A sticky note on the whiteboard: CALL, and a name scratched out hard.', 'note.name', 'null'),
      look('o_printer', 120, 228, 126, 272, 'The printer jammed on page one. Page one was the apology.', 'printer.job', '"sorry.pdf"'),
      toy('o_photo', ['PHOTO', 'LIES', 'DOWN'], 262, 578, 318, 592, 'A photo by the mug, lying face {}. Easier for everyone.', 'photo.side', { pair: 'flip' }),
      toy('o_rain', ['RAIN', 'FEELS', 'SAD'], 960, 130, 900, 232, 'Rain on the glass, taking its time. It feels {}.', 'rain.mood'),
      toy('o_lamp', ['LAMP', 'FEELS', 'HAPPY'], 1185, 440, 1150, 500, 'A floor lamp nobody switches off. It feels {}.', 'lamp.mood'),
      line('o_line', 1108, 600, 1096, 624, L('o_line')),
    ],
    idle: ['You stand still. The office does too. It\u2019s had practice.', 'The rain hasn\u2019t moved on either.'],
    all: { say: 'You\u2019ve read the whole room. One thing is missing, and it\u2019s you.', code: 'office.missing', val: '"noor"', sx: 640, sy: 150 },
    toy: 'The rain cheers up. The lamp takes it personally.', toyBack: 'Everyone goes back to how they were. It\u2019s easier.',
    pairs: { flip: ['The photo looks up. The phone finally stops looking at you.', 'Face down again. It was easier.'] },
  },
  hub: {
    plates: [
      toy('h_mirror', ['MIRROR', 'RUNS', 'FORWARD'], 313, 92, 313, 200, 'A mirror that copies you a beat late. It runs {}.', 'mirror.dir'),
      toy('h_clock', ['CLOCK', 'RUNS', 'BACKWARD'], 960, 82, 960, 200, 'The clock disagrees with the mirror. It runs {}.', 'clock.dir'),
      look('h_coat', 1150, 200, 1120, 232, 'The coat rack from upstairs, one floor too far. It holds nothing, carefully.', 'rack.holds', 'null'),
      look('h_notes', 985, 535, 900, 566, 'A stack of sticky notes on Fern\u2019s desk. Every one says good morning.', 'fern.notes', '214',
        { cap2: 'The sticky stack on Fern\u2019s desk is one note taller.', val2: '215' }),
      look('h_plant', 100, 640, 150, 650, 'The office plant, but greener. Somebody here remembers to water it.', 'plant.thirsty', 'FALSE'),
      line('h_line', 332, 222, 340, 236, L('h_line')),
    ],
    idle: ['Stand still long enough and the room starts copying you. It\u2019s flattering. It isn\u2019t.', 'The clock has lost another hour. It looks relieved.'],
    all: { say: 'Everything here is a reflection. Some of it is running late.', code: 'mirror.lag', val: '0.4s', sx: 313, sy: 60 },
    toy: 'The mirror gets ahead of you. The clock finally goes somewhere.', toyBack: 'The mirror falls back in line. Late, as usual.',
  },
  corridor: {
    plates: [
      toy('c_moth', ['MOTH', 'WANTS', 'LAMP'], 360, 250, 430, 350, 'A moth keeps the lamp company. It wants the {}.', 'moth.wants'),
      toy('c_bucket', ['BUCKET', 'WANTS', 'DRIP'], 724, 330, 724, 362, 'A bucket under a slow leak. It wants the {}.', 'bucket.wants'),
      look('c_umbrella', 486, 312, 486, 362, 'An umbrella, bone dry, in a corridor with no weather.', 'umbrella.wet', 'FALSE'),
      look('c_tape', 834, 425, 834, 446, 'Tape on the floor where a desk used to be. It left in a hurry.', 'desk.owner', '"kabir"'),
      look('c_drip', 724, 300, 690, 400, 'Something upstairs is leaking, one patient drop at a time.', 'leak.source', '"floor 3"'),
      line('c_line', 236, 256, 248, 300, L('c_line')),
    ],
    idle: ['In the dark you can hear the building think. Mostly about you.', 'The moth has moved an inch to the left. It calls this progress.'],
    all: { say: 'You touched everything in a dark corridor. Brave, or just lonely.', code: 'corridor.length', val: '"longer than yesterday"', sx: 640, sy: 290 },
    toy: 'The moth goes to the bucket. The bucket looks up at the lamp. Nothing drips upward.', toyBack: 'The moth remembers the lamp. The bucket stops hoping.',
  },
  archive: {
    plates: [
      look('a_radio', 180, 182, 180, 240, 'A radio tuned between two stations. It can\u2019t commit either.', 'radio.station', 'BETWEEN'),
      toy('a_duck', ['DUCK', 'STAYS', 'AFLOAT'], 560, 460, 420, 440, 'A rubber duck, on duty. It stays {}.', 'duck.state'),
      toy('a_memo', ['MEMO', 'STAYS', 'SUNK'], 620, 556, 420, 566, 'A memo under the water, still legible. It stays {}.', 'memo.state'),
      look('a_boots', 900, 250, 900, 292, 'Wellies by the wall, lined up neat. Somebody planned for this.', 'boots.owner', '"dez"'),
      look('a_leak', 700, 120, 860, 220, 'A pipe over the pit, keeping time with drips.', 'pipe.fixed', 'FALSE'),
      line('a_line', 330, 640, 330, 616, L('a_line')),
    ],
    idle: ['Water keeps the only honest record in here. Every step, a ripple.', 'The duck has drifted. It doesn\u2019t explain itself.'],
    all: { say: 'Nothing in here was ever thrown away. That was the problem.', code: 'archive.deleted', val: '0', sx: 640, sy: 200 },
    toy: 'The duck goes down with dignity. The memo comes up for air.', toyBack: 'The duck bobs back up, unbothered. The memo sinks, relieved.',
  },
  arena: {
    plates: [
      look('r_bin', 335, 195, 400, 232, 'A bin of crumpled drafts. Nine of them, all yours.', 'drafts.binned', '9',
        { cap2: 'The bin of drafts. Ten now. You don\u2019t remember the tenth.', val2: '10' }),
      look('r_chair', 868, 610, 840, 590, 'One chair, facing the ring. Somebody always watches you rehearse.', 'audience.size', '1'),
      look('r_scrap', 520, 600, 520, 624, 'A draft that got as far as one word. Honestly,', 'draft.opening', '"Honestly,"'),
      toy('r_lamp', ['LIGHT', 'RUNS', 'WARM'], 640, 420, 640, 470, 'The one lamp, holding the room together. It runs {}.', 'light.temp'),
      toy('r_rim', ['RIM', 'RUNS', 'COLD'], 900, 420, 884, 420, 'A ring of light around the floor. It runs {}.', 'rim.temp'),
      line('r_line', 640, 262, 640, 282, L('r_line'), { after: 'draft', hidden: true }),
    ],
    idle: ['The arena is quiet the way a page is quiet before you ruin it.', 'The bin has one more draft in it than last time.'],
    all: { say: 'Nine drafts. You only ever sent the first one.', code: 'draft.version', val: '9', sx: 640, sy: 120 },
    toy: 'The room changes its mind about the weather.', toyBack: 'The lamp is warm again. The rim pretends it never wasn\u2019t.',
  },
  message: {
    plates: [
      look('m_bench', 450, 590, 470, 556, 'A bench for waiting. It has been waiting longest.', 'bench.waiting', 'TRUE'),
      look('m_plant', 395, 290, 420, 322, 'A plant that only grows toward the screen.', 'plant.light', 'SCREEN'),
      look('m_lamp', 880, 590, 850, 604, 'A lamp left on for somebody coming home late.', 'lamp.for', '"kabir"'),
      toy('m_kabir', ['KABIR', 'IS', 'AWAY'], 500, 232, 500, 300, 'Kabir\u2019s name in the contact list. He is {}.', 'kabir.status'),
      toy('m_papa', ['PAPA', 'IS', 'TYPING'], 780, 232, 700, 300, 'Papa\u2019s name, three dots beside it. He is {}.', 'papa.status'),
      line('m_line', 548, 646, 548, 630, L('m_line')),
    ],
    idle: ['Nobody types in here. The silence has three dots in it.', 'Papa\u2019s last message is still the last message.'],
    all: { say: 'Somebody read every word in this room. The receipt says so.', code: 'kabir.read', val: 'TRUE', sx: 640, sy: 150 },
    toy: 'Kabir is typing. Kabir has been typing for three years.', toyBack: 'Kabir is away again. Papa picks the dots back up.',
  },
};
