// Phase 1 room data, in the order of docs/story/phase-1-levels.md.
import type { PlateDef } from './plate';
import type { RoomId } from './save';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Prop { x: number; y: number; w: number; h: number; color: number; top?: number; label?: string; glow?: number; solid?: boolean }
export interface RoomDef {
  id: RoomId; title: string; path: string; heading: string;
  floor: { base: number; line: number; tile: number; round?: { x: number; y: number; r: number } };
  walk: Rect[]; walls: Rect[]; props: Prop[]; plates: PlateDef[];
  spawn: { x: number; y: number };
  exit?: { rect: Rect; to: RoomId };
}
const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export const ROOMS: Record<RoomId, RoomDef> = {
  office: {
    id: 'office', title: 'the_real_office', path: '~/floor-2/open-plan/ 11:48 PM', heading: 'INT. OPEN-PLAN OFFICE, FLOOR 2 \u2014 11:48 PM',
    floor: { base: 0x161d24, line: 0x1f2a33, tile: 64 },
    walk: [R(70, 200, 1140, 480)], walls: [],
    props: [
      { x: 70, y: 70, w: 1140, h: 130, color: 0x0d1319, top: 0x121a22 },                  // back wall
      { x: 760, y: 82, w: 400, h: 100, color: 0x1a2a3a, glow: 0x4a6a8a, label: 'rain' },   // rainy window
      { x: 330, y: 380, w: 130, h: 60, color: 0x2c3a44, top: 0x3a4a56, solid: true },       // Dez's desk (glows)
      { x: 350, y: 362, w: 50, h: 20, color: 0x6fd0e0, glow: 0x6fd0e0 },
      { x: 620, y: 260, w: 130, h: 60, color: 0x2c3a44, top: 0x3a4a56, solid: true },       // Kabir's desk (glows)
      { x: 640, y: 242, w: 50, h: 20, color: 0x8ab0e0, glow: 0x8ab0e0 },
      { x: 920, y: 450, w: 140, h: 64, color: 0x34383c, top: 0x44484c, solid: true },       // Noor's desk, dust grey
      { x: 175, y: 555, w: 120, h: 55, color: 0x2c3a44, top: 0x3a4a56, solid: true },       // a coworker's desk (the mug)
      { x: 112, y: 300, w: 106, h: 50, color: 0x2c3a44, solid: true },                     // empty desk pod (west)
      { x: 1087, y: 320, w: 106, h: 50, color: 0x2c3a44, solid: true },                    // empty desk pod (east)
      { x: 950, y: 432, w: 56, h: 22, color: 0x1a1c1e },                                    // dead monitor
      { x: 220, y: 560, w: 26, h: 26, color: 0x6a4a34, top: 0x8a6448 },                     // coffee
      { x: 556, y: 596, w: 88, h: 44, color: 0x2c3a44, solid: true },                      // meeting nook (art-v7b)
    ],
    plates: [
      { id: 'o_coffee', words: ['COFFEE'], slot: -1, x: 232, y: 640, sx: 232, sy: 552, kind: 'lore', text: 'COLD SINCE AUGUST.', cap: "Someone's mug, still waiting. Cold since August.", code: 'mug.temp', val: 'COLD' },
      { id: 'o_dez', words: ['DEZ\u2019S', 'DESK'], slot: -1, x: 395, y: 470, sx: 380, sy: 400, kind: 'lore', text: 'DEZ: BACK MONDAY :)', cap: "Dez's desk, chair pushed in. Back Monday, it promises.", code: 'dez.back', val: 'MONDAY' },
      { id: 'o_kabir', words: ['KABIR\u2019S', 'NOTE'], slot: -1, x: 685, y: 350, sx: 680, sy: 262, kind: 'lore', note: true, text: 'MISS YOU AROUND HERE.', cap: "A note on Kabir's screen. Miss you around here.", code: 'kabir.note', val: '"miss you"' },
      { id: 'o_monitor', words: ['MONITOR'], slot: -1, x: 990, y: 548, sx: 978, sy: 452, kind: 'lore', text: 'CLAIM #4471: PLEASE REPHRASE.', redact: 'DENIED', cap: 'Your monitor, still awake. Your claim was {}.', code: 'claim.status' },
    ],
    spawn: { x: 110, y: 470 },
  },
  hub: {
    id: 'hub', title: 'mirror_office', path: '~/hub/', heading: 'INT. MIRROR OFFICE \u2014 NIGHT, PROBABLY',
    floor: { base: 0x0c1626, line: 0x16304a, tile: 64 },
    walk: [R(80, 150, 1120, 530)],
    walls: [R(80, 400, 520, 34), R(680, 400, 520, 34)],
    props: [
      { x: 590, y: 366, w: 100, h: 34, color: 0x1c3450, label: 'doorframe' },
      { x: 300, y: 322, w: 8, h: 44, color: 0x5a7080, top: 0x78e4e8 },                      // rail post beside the gap
      { x: 300, y: 322, w: 120, h: 4, color: 0x5a7080 },
      { x: 80, y: 40, w: 1120, h: 110, color: 0x081020, top: 0x0c1830 },
      { x: 580, y: 60, w: 120, h: 92, color: 0x10243a, glow: 0x78e4e8, label: 'exit' },
      { x: 80, y: 400, w: 520, h: 34, color: 0x13233a, top: 0x1c3450 },
      { x: 680, y: 400, w: 520, h: 34, color: 0x13233a, top: 0x1c3450 },
      { x: 930, y: 530, w: 150, h: 60, color: 0x1a2c44, top: 0x28405e, solid: true },       // Fern's desk
      { x: 240, y: 470, w: 40, h: 40, color: 0x3a3020, glow: 0xf6c684 },                     // the lamp
    ],
    plates: [
      { id: 'h_lamp', words: ['LAMP', 'IS', 'OPEN'], slot: 2, x: 300, y: 560, sx: 256, sy: 556, kind: 'rule', cap: 'A small lamp keeps watch. It is {}.', code: 'lamp.state' },
      { id: 'h_door', words: ['DOOR', 'IS', 'SHUT'], slot: 2, x: 640, y: 480, sx: 640, sy: 362, kind: 'rule', cap: 'The door is {}. It would rather you stayed.', code: 'door.state' },
      { id: 'h_gap', words: ['GAP', 'IS', 'WIDE'], slot: -1, x: 430, y: 365, sx: 360, sy: 292, kind: 'fixed', cap: 'The floor gives up here. The gap is WIDE.', code: 'gap.width', val: 'WIDE' },
      { id: 'h_fern', words: ['FERN'], slot: -1, x: 1005, y: 640, sx: 1005, sy: 470, kind: 'secret', code: 'fern.awake', val: 'true', cap: 'Fern, at her desk. She was always here first.', text: 'SHE NEVER SLEPT. SHE WAS WAITING FOR GOOD MORNING.' },
      { id: 'h_exit', words: ['EXIT', 'IS', 'NOOR\u2019S'], slot: -1, x: 640, y: 185, sx: 640, sy: 96, kind: 'fixed', cap: "A door that knows your name. EXIT is NOOR'S.", code: 'exit.owner', val: 'NOOR' },
    ],
    spawn: { x: 640, y: 630 },
    exit: { rect: R(580, 150, 120, 14), to: 'corridor' },
  },
  corridor: {
    id: 'corridor', title: 'dark_corridor', path: '~/hub/corridor/', heading: 'INT. CORRIDOR \u2014 NO LIGHTS',
    floor: { base: 0x0a1018, line: 0x121c28, tile: 48 },
    walk: [R(60, 330, 960, 140), R(140, 230, 130, 100), R(1000, 220, 220, 400)],
    walls: [],
    props: [
      { x: 60, y: 296, w: 80, h: 34, color: 0x0e1622, top: 0x141e2c },                       // corridor wall
      { x: 270, y: 296, w: 730, h: 34, color: 0x0e1622, top: 0x141e2c },
      { x: 355, y: 270, w: 10, h: 30, color: 0x3a4450 },                                     // lamp fixture arm
      { x: 340, y: 262, w: 40, h: 12, color: 0x4a4030, top: 0xf6c684 },                      // ceiling lamp
      { x: 190, y: 196, w: 30, h: 22, color: 0x2a3440, top: 0x3a4a58 },                      // switch housing
      { x: 1092, y: 147, w: 36, h: 36, color: 0x1a2430, top: 0x2a3440, label: 'clock' },
      { x: 1190, y: 360, w: 30, h: 120, color: 0x1c2a3c, top: 0x2a3c52, label: 'alcove_door' },
    ],
    plates: [
      { id: 'c_light', words: ['LIGHT', 'IS', 'OFF'], slot: 2, x: 360, y: 430, sx: 360, sy: 312, kind: 'rule', cap: 'A lamp nobody remembers fitting. The light is {}.', code: 'light.state' },
      { id: 'c_switch', words: ['SWITCH', 'IS', 'ON'], slot: 2, x: 205, y: 270, sx: 205, sy: 226, kind: 'rule', cap: 'A switch, painted over twice. It is {}.', code: 'switch.state' },
      { id: 'c_note', words: ['FERN\u2019S', 'NOTE'], slot: -1, x: 860, y: 365, sx: 860, sy: 298, kind: 'lore', note: true, hidden: true, text: 'YOU ALWAYS SAID GOOD MORNING.', cap: "Fern's handwriting, taped low. You always said good morning.", code: 'fern.note', val: '"good morning"' },
      { id: 'c_wall', words: ['WALL'], slot: -1, x: 540, y: 400, sx: 540, sy: 290, kind: 'secret', code: 'wall.solid', val: 'TRUE', cap: 'A wall where a door should be. Painted in.', text: 'SOMEONE WROTE THIS WALL IN. NOT YOU.' },
      { id: 'c_dummy', words: ['DUMMY', 'IS', 'STILL'], slot: 2, x: 1090, y: 585, sx: 1110, sy: 450, kind: 'rule', cap: 'A paper dummy, patient as furniture. It is {}.', code: 'dummy.state' },
      { id: 'c_clock', words: ['CLOCK', 'IS', 'QUICK'], slot: 2, x: 1110, y: 255, sx: 1110, sy: 202, kind: 'rule', cap: 'The clock runs ahead of everyone. It is {}.', code: 'clock.speed' },
    ],
    spawn: { x: 110, y: 400 },
    exit: { rect: R(1205, 360, 15, 120), to: 'archive' },
  },
  archive: {
    id: 'archive', title: 'flooded_archive', path: '~/hub/archive/', heading: 'INT. FLOODED ARCHIVE \u2014 LATER',
    floor: { base: 0x0e1820, line: 0x182833, tile: 56 },
    walk: [R(60, 180, 380, 500), R(840, 180, 380, 500)],
    walls: [],
    props: [
      { x: 256, y: 60, w: 14, h: 120, color: 0x3a4c58, top: 0x5a7080 },                      // water pipe + gauge
      { x: 246, y: 104, w: 34, h: 26, color: 0x2a3a44, top: 0x9ad8f0 },
      { x: 420, y: 330, w: 16, h: 52, color: 0x4a3a2a, top: 0x6a5440 },          // bridge winch post
      { x: 520, y: 170, w: 80, h: 14, color: 0x18242e },                                     // stairwell wall bracket
      { x: 962, y: 176, w: 26, h: 30, color: 0x0c0e1e, top: 0x3a4a6a },                      // ink bottle
      { x: 1176, y: 260, w: 14, h: 70, color: 0x4a4038, top: 0xe6e0d0 },                     // towel rack
      { x: 900, y: 650, w: 100, h: 26, color: 0x5a4430, top: 0x7a6040 },                     // corkboard
      { x: 1150, y: 600, w: 50, h: 70, color: 0x26343e, top: 0x34444e },                     // book shelf
      { x: 60, y: 60, w: 1160, h: 120, color: 0x0a121a, top: 0x101c26 },
      { x: 80, y: 120, w: 60, h: 90, color: 0x26343e, top: 0x34444e, solid: true },  // filing cabinets
      { x: 150, y: 120, w: 60, h: 90, color: 0x26343e, top: 0x34444e, solid: true },
      { x: 70, y: 610, w: 60, h: 60, color: 0x2a3a44, top: 0x3a4c58, solid: true, label: 'drawer' },
      { x: 1100, y: 120, w: 60, h: 90, color: 0x26343e, top: 0x34444e, solid: true },
    ],
    plates: [
      { id: 'a_water', words: ['WATER', 'IS', 'HIGH'], slot: 2, x: 240, y: 260, sx: 268, sy: 150, kind: 'rule', cap: 'The pipe sweats into the dark. The water is {}.', code: 'water.level' },
      { id: 'a_bridge', words: ['BRIDGE', 'IS', 'UP'], slot: 2, x: 310, y: 470, sx: 430, sy: 360, kind: 'rule', cap: 'A plank bridge, folded like an argument. It is {}.', code: 'bridge.state' },
      { id: 'a_drawer', words: ['DRAWER', 'IS', 'LOW'], slot: 2, x: 210, y: 610, sx: 100, sy: 594, kind: 'rule', cap: 'A drawer of old intake forms. It is {}.', code: 'drawer.height' },
      { id: 'a_ink', words: ['INK', 'IS', 'WET'], slot: 2, x: 975, y: 240, sx: 975, sy: 160, kind: 'rule', cap: 'An ink bottle, uncorked for years. It is still {}.', code: 'ink.state' },
      { id: 'a_towel', words: ['TOWEL', 'IS', 'DRY'], slot: 2, x: 1140, y: 300, sx: 1140, sy: 248, kind: 'rule', cap: 'A towel on a rack. Somehow, it is {}.', code: 'towel.state' },
      { id: 'a_notes', words: ['NOTES', 'STICK', 'TOGETHER'], slot: 2, x: 950, y: 610, sx: 950, sy: 640, kind: 'rule', cap: 'Sticky notes in a clump. They stick {}.', code: 'notes.stick' },
      { id: 'a_books', words: ['BOOKS', 'SIT', 'APART'], slot: 2, x: 1150, y: 560, sx: 1170, sy: 560, kind: 'rule', cap: 'Books on a shelf, not speaking. They sit {}.', code: 'books.sit' },
      { id: 'a_stairs', words: ['STAIRS', 'GO', 'DOWN'], slot: 2, x: 495, y: 600, sx: 560, sy: 220, kind: 'rule', hidden: true, cap: 'Stairs, drowned until now. They go {}.', code: 'stairs.dir' },
    ],
    spawn: { x: 100, y: 420 },
    exit: { rect: R(1205, 380, 15, 90), to: 'arena' },
  },
  arena: {
    id: 'arena', title: 'draft_arena', path: '~/floor-1/r1/', heading: 'INT. FLOOR 1, ROOM 1 \u2014 THE DRAFT',
    floor: { base: 0x0a0e14, line: 0x141c26, tile: 64, round: { x: 640, y: 420, r: 300 } },
    walk: [R(380, 150, 520, 540)], walls: [],
    props: [
      { x: 590, y: 70, w: 100, h: 82, color: 0x10243a, glow: 0x78e4e8, label: 'exit' },
      { x: 392, y: 230, w: 22, h: 80, color: 0x2a3440, top: 0x3a4a58, solid: true },        // arena-edge pillar (WEAK source)
      { x: 300, y: 170, w: 70, h: 40, color: 0x1a2028, top: 0xd8d0bc },                      // crumpled-paper bin
    ],
    plates: [
      { id: 'r_guard', words: ['THE', 'DRAFT', 'IS', 'STRONG'], slot: 3, x: 640, y: 340, sx: 640, sy: 200, kind: 'rule', cap: 'The Draft circles, sure of itself. It is {}.', code: 'draft.guard' },
      { id: 'r_weak', words: ['PAPER', 'IS', 'WEAK'], slot: 2, x: 450, y: 330, sx: 403, sy: 222, kind: 'rule', cap: 'A paper pillar, patched with tape. Paper is {}.', code: 'paper.state' },
    ],
    spawn: { x: 640, y: 660 },
    exit: { rect: R(590, 150, 100, 14), to: 'message' },
  },
  message: {
    id: 'message', title: 'message_room', path: '~/floor-1/messages/', heading: 'INT. MESSAGE ROOM \u2014 STILL NIGHT',
    floor: { base: 0x0c1218, line: 0x161f28, tile: 48 },
    walk: [R(360, 260, 560, 400)], walls: [],
    props: [
      { x: 860, y: 240, w: 60, h: 40, color: 0x141e28, top: 0x1c2a36 },
      { x: 360, y: 60, w: 560, h: 200, color: 0x081018, top: 0x0c1620, label: 'chatwall' },
      { x: 860, y: 280, w: 60, h: 120, color: 0x141e28, top: 0x1c2a36, label: 'stairs' },
    ],
    plates: [{ id: 'm_stairs', words: ['FLOOR', '1:', 'DOWN'], slot: -1, x: 800, y: 430, sx: 890, sy: 222, kind: 'fixed', hidden: true, cap: 'The stairwell hums. Floor 1 goes DOWN.', code: 'stairs.floor1', val: 'DOWN' }],
    spawn: { x: 640, y: 620 },
  },
};
