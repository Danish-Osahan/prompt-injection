// Prompt Injection, Phase 1 "After Hours" - session 1 playable build.
// One scene; rooms are built into a throwaway object list and torn down on transition (no loading screens).
import Phaser from 'phaser';
import tokens from './tokens.json';
import { Controls, type Frame } from './controls';
import { Plate } from './plate';
import { WordUI, BAR_Y } from './words';
import { ROOMS, type Rect, type RoomDef } from './rooms';
import { DraftFight, DRAFT } from './boss';
import { sfx, bindSfxScene, setSfxVolume, getMasterVolume, getAudioContext, meterRms } from './sfx';
import { installAudioUnlock, setAmbience, setAmbienceDuck, updateAmbience, getAmbienceId, getAmbienceDucked, getAmbienceErrors, unlockAudio } from './ambience';
import { voiceBlip, freezeBedActive } from './voice';
import { bindMusicScene, playMusic, setMusicVolume } from './music';
import { ROOMART, type AmbLayer } from './roomart';
import { LINGER, LINES } from './linger';
import { Office9, ViewMap } from './office9';
import { Clarity, DOOR_DEF } from './clarity';
import { CombatGreybox } from './combat/greybox';
import { ImpactLab } from './impact/ImpactLab'
import { OfficeExplore } from './officeExplore';
import type { TitleStartData } from './title';
import { IntroCutscene, OPENING_EXCHANGE } from './intro';
import { Dialogue, type SayWho } from './dialogue';
import { GlassRain } from './rain';
import { showRoomCard, showEndScreen, backToTitle, flushPlay } from './flow';
import { loadSettings } from './settings';
import { StealPlay, STEAL_ROOMS } from './impact/StealPlay';
import { InteractChip, placeChip, splitHint } from './ui/InteractChip';
import { RIFT, LANE, LAMP, RiftWord, RiftSpan, HubLamp, drawRiftDetail, startRiftDebris } from './hubRift';
import { launchAnimatedBolt, playChargeHold, playThrowAttack, tickWindupFx } from './impact/qualityShot';
import type { PlateDef } from './plate';
import { type RoomId, type Save, loadSave, writeSave, wipeSave, freshSave, setEphemeralSave, recomputeGrowth, fernStage, logSwap, topWord } from './save';

const C = tokens.color;
const hex = (s: string) => parseInt(s.slice(1), 16);
const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const MAX_HP = 4;
const WALK = 230, DASH_SPEED = 900, DASH_T = 0.24, DASH_CD = 1.0;  // 216px dash; hub void is 148px
const HUB_NY = 248, HUB_FACE = 28, HUB_VOID_H = 128, HUB_SY = 404;  // 128px of visible dark drop under a 28px flat face
const HUB_PIT = { x: 80, y: 252, w: 1120, h: 148 };  // 252–400
const READ_R = 90, FOCUS_R = 120;
const HOLD_T = 0.22, AIM_R = 150, BEAM_R = 560;
const inR = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
/** Non-circular attack telegraph: corner ticks of a box, never a circle/ring/disc. */
const tellBox = (g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, col: number, a: number) => {
  g.lineStyle(2.2, col, a);
  const sx = r * 0.72, sy = r * 0.55;
  for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const px = x + dx * sx, py = y + dy * sy;
    g.lineBetween(px, py, px - dx * 14, py);
    g.lineBetween(px, py, px, py - dy * 10);
  }
};
/** Etched takeable word under the corridor clock, same family as the hub VOID / FLOOR stencils. */
class ClockWord {
  t: Phaser.GameObjects.Text; sh: Phaser.GameObjects.Text; word = 'STILL'; cueT = 0;
  constructor(private s: GameScene, public x: number, public y: number) {
    const st = { fontFamily: 'JetBrains Mono', fontSize: '16px', fontStyle: 'bold', color: '#bfe9ee' };
    this.sh = s.add.text(x + 1, y + 2, 'STILL', { ...st, color: '#02060a' }).setOrigin(0.5).setDepth(y - 1).setAlpha(0.9);
    this.t = s.add.text(x, y, 'STILL', st).setOrigin(0.5).setDepth(y);
    this.t.setLetterSpacing(4); this.sh.setLetterSpacing(4);
    this.t.name = 'corridor-clock-word'; s.objs.push(this.sh, this.t);
  }
  set(w: string) {
    this.word = w;
    this.t.setText(w); this.sh.setText(w);
    this.t.setColor(w === 'STILL' ? '#bfe9ee' : '#c4a56a');
  }
  cue() { this.cueT = 3.2; }
  update() {
    const tt = this.s.t;
    const base = this.word === 'STILL' ? 0.78 + 0.16 * Math.sin(tt * 2.1) : 0.7;
    const cue = this.cueT > 0 ? 0.2 + 0.2 * Math.sin(tt * 8) : 0;
    if (this.cueT > 0) this.cueT -= 1 / 60;
    this.t.setAlpha(Math.min(1, base + cue));
    this.t.x = this.x + (this.cueT > 0 && Math.sin(tt * 19) > 0.96 ? 1 : 0);
  }
}

/** Inner rect of the hub north-wall glass, inside the bezel. */
const HUB_GLASS: Rect = { x: 226, y: 50, w: 178, h: 90 };

/** Scale and foot position so head+shoulders fit the pane, then texture-crop to the glass. */
function layoutHubCopy(inGlass: boolean, delayedX: number, flipX: boolean) {
  const g = HUB_GLASS, pad = 4, ox = 96, oy = 160;
  const body = { w: 116, h: 100, y: 50 };
  const sc = Math.min((g.w - pad * 2) / body.w, (g.h - pad * 2) / body.h);
  const half = (body.w / 2) * sc;
  // Sit her in the left of the pane so the baked lamp disc (≈331, 63) stays off her head.
  const maxX = Math.min(g.x + g.w - pad - half, 274);
  const rx = inGlass
    ? Phaser.Math.Clamp(delayedX, g.x + pad + half, maxX)
    : Math.min(g.x + pad + half + 8, maxX);
  const fy = (g.y + g.h / 2) + (oy - (body.y + body.h / 2)) * sc;
  const toTx = (wx: number) => flipX ? ox - (wx - rx) / sc : ox + (wx - rx) / sc;
  const toTy = (wy: number) => oy + (wy - fy) / sc;
  const txs = [toTx(g.x), toTx(g.x + g.w)];
  const tys = [toTy(g.y), toTy(g.y + g.h)];
  const cx0 = Phaser.Math.Clamp(Math.min(...txs), 0, 192);
  const cx1 = Phaser.Math.Clamp(Math.max(...txs), 0, 192);
  const cy0 = Phaser.Math.Clamp(Math.min(...tys), 0, 192);
  const cy1 = Phaser.Math.Clamp(Math.max(...tys), 0, 192);
  const toWx = (tx: number) => flipX ? rx - (tx - ox) * sc : rx + (tx - ox) * sc;
  const toWy = (ty: number) => fy - oy * sc + ty * sc;
  const wxs = [toWx(cx0), toWx(cx1)];
  const wys = [toWy(cy0), toWy(cy1)];
  const bounds: Rect = {
    x: Math.min(...wxs), y: Math.min(...wys),
    w: Math.abs(wxs[1] - wxs[0]), h: Math.abs(wys[1] - wys[0]),
  };
  return { sc, rx, fy, crop: { x: cx0, y: cy0, w: cx1 - cx0, h: cy1 - cy0 }, bounds };
}

type EKind = 'dummy' | 'scribble' | 'note' | 'draft' | 'redline' | 'stapler';
export interface Enemy {
  kind: EKind; x: number; y: number; hp: number; maxHp: number; g: Phaser.GameObjects.Container; body: Phaser.GameObjects.Graphics;
  state: string; t: number; kx: number; ky: number; tx: number; ty: number; hx: number; hy: number; dead: boolean; hitBy: number; phase: number;
  practice?: boolean;   // art-v11: the office's stuffed practice dummy (takes hits forever, never fights back)
  wet?: boolean;        // archive Scribbles melted by WET from the cooler
  swipeN?: number;      // paper dummy: first swipe is the slow tutorial tell
  dodgeN?: number;
  flash?: Phaser.GameObjects.Graphics; pinT?: number; rootG?: Phaser.GameObjects.Graphics;
}
interface Prompt { id: string; kb: string; touch: string; text: Phaser.GameObjects.Text; chip?: InteractChip; done: () => boolean }

/** Things that hide their words until the Caret goes in (Level 1: the corridor guard). */
const GUARDED = ['c_dummy'];

export class GameScene extends Phaser.Scene {
  save!: Save;
  ctl!: Controls;
  room!: RoomDef;
  objs: Phaser.GameObjects.GameObject[] = [];
  plates: Plate[] = [];
  enemies: Enemy[] = [];
  noor!: Phaser.GameObjects.Sprite;
  shadow!: Phaser.GameObjects.Ellipse;
  caret!: Phaser.GameObjects.Sprite;
  caretMode: 'hidden' | 'trapped' | 'jumping' | 'follow' | 'travel' | 'sent' = 'hidden';
  caretOwned = false;
  caretSentAt = 0;
  /** Plate the Caret is parked in, holding its line open for the next word (the Caret's job). */
  caretWriting?: string;
  private guardLine: string | null = null;
  private caretBox?: Phaser.GameObjects.Graphics;
  private caretMark?: Phaser.GameObjects.Graphics;
  private hubNorthOcclude: Record<string, Phaser.GameObjects.Image> = {};
  private caretSendOnce = false;
  private caretKeyF?: Phaser.Input.Keyboard.Key;
  x = 0; y = 0; dir = 'S'; hp = MAX_HP;
  dashT = 0; dashCd = 0; dashVec = { x: 0, y: 1 }; iframes = 0; sinceDash = 9; didDash = false; didAttack = false; hintThrowArmed = false;
  combo = 0; comboT = 0; swingT = 0; hitStopT = 0; trailT = 0; bsT = 0; bsHit = new Set<Enemy>();
  hand: { word: string; from: string } | null = null;
  dyn: Record<string, Rect | null> = {};
  extraWalk: Record<string, Rect | null> = {};
  hazards: Rect[] = [];
  riftWord?: RiftWord; riftSpan?: RiftSpan; hubLamp?: HubLamp; caretChip?: InteractChip; caretHoldT = 0;
  clockWord?: ClockWord; dummyDodges = 0;
  busy = false; composer: { words: string[]; i: number; ui: Phaser.GameObjects.Container } | null = null;
  dying = false; deathAt = 0; lastRespawnMs = -1; undoShown = 0;
  stuck = 0; hintOn = false; hintObj: Phaser.GameObjects.Container | null = null; hintUsed = false; hintPulseT = 0;
  gapPan: 'pending' | 'playing' | 'done' | null = null;
  private gapPanProxy: { y: number; z: number } | null = null;
  private gapPanToken = 0;
  private chasmParallax: { g: Phaser.GameObjects.Graphics; k: number }[] = [];
  prompts: Prompt[] = [];
  paused = false; pauseUi: Phaser.GameObjects.Container | null = null;
  debugOn = false; debugText!: Phaser.GameObjects.Text;
  hud!: { path: Phaser.GameObjects.Text; title: Phaser.GameObjects.Text; caret: Phaser.GameObjects.Rectangle; hp: Phaser.GameObjects.Image[]; hpLabel: Phaser.GameObjects.Text; meta: Phaser.GameObjects.Text; menu: Phaser.GameObjects.Text; hand: Phaser.GameObjects.Container; handText: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text; fern: Phaser.GameObjects.Container; fernText: Phaser.GameObjects.Text; skip: Phaser.GameObjects.Text; linesHud: Phaser.GameObjects.Text };
  linePrompt: InteractChip | null = null;
  lineToast?: Phaser.GameObjects.Container;
  hudHidden = false;
  darkness: Phaser.GameObjects.Image | null = null;
  flags = { span: false, lit: false, drained: false, bridge: false, still: false, dry: false, apart: false };
  roomVis: Record<string, Phaser.GameObjects.GameObject> = {};
  art = false; bg: Record<string, Phaser.GameObjects.Image> = {};
  subQueue: { who: string; line: string; ms: number }[] = []; subBusy = false;
  moved = 0; t = 0; transitioning = false;
  fight: DraftFight | null = null; timeScale = 1; rewriteT = 0; rewriteN = 0; stored: string | null = null; rootUsed = false;
  birth: { playing: boolean; t: number; g: Phaser.GameObjects.Container } | null = null;
  holdT = 0; selecting = false; selectLen = 0; selectCd = 0; selectG: Phaser.GameObjects.Graphics | null = null; selectN = 0; selectHits = 0;
  dashStartAt = -9; perfectN = 0; pasteN = 0; rootN = 0; skipHold = 0; cutscene: { id: string; skip: () => void } | null = null; slowVeil: Phaser.GameObjects.Rectangle | null = null;
  seenEver: string[] = [];
  words!: WordUI; fgImgs: Record<string, Phaser.GameObjects.Image> = {};
  litMask: Phaser.Textures.CanvasTexture | null = null; litImg: Phaser.GameObjects.Image | null = null;
  // art-v8: letterbox (world camera framed above the caption bar) + a full-screen UI camera
  uiCam!: Phaser.Cameras.Scene2D.Camera; frameZoom = 1; followZoom = 1.75; followCam = false; stopT = 0; handT = 0;
  edgePad?: Phaser.GameObjects.Rectangle; edgePad2?: Phaser.GameObjects.Rectangle;
  // art-v8 linger layer
  amb: { def: AmbLayer; spr: Phaser.GameObjects.Sprite; dir: number; speed: number; t: number; ox: number; oy: number }[] = [];
  idleT = 0; idleSaid = false; copyWarm = 0; copySeen = 0; copyGlintT = 0; copyWasVis = false; letterRead = false; toyFx: Record<string, Phaser.GameObjects.GameObject> = {};
  hubFern?: Phaser.GameObjects.Sprite; hubFernGlow?: Phaser.GameObjects.Image; copyGlint?: Phaser.GameObjects.Graphics;
  refl: Phaser.GameObjects.Sprite | null = null; hubCopyBounds: Rect | null = null; hist: { t: number; x: number; y: number; key: string; frame: string }[] = [];
  motes: { x: number; y: number; vx: number; vy: number; a: number; ph: number }[] = []; motesG: Phaser.GameObjects.Graphics | null = null; moteRect: Rect | null = null; moteCol = 0xf6e6c8;
  hairT = 0;
  // art-v9 office test level: perspective view mapping (see office9.ts)
  inspectOff = false; vs = new WeakSet<object>(); vm: ViewMap | null = null; office: Office9 | null = null; pivot = new WeakMap<object, { x: number; y: number }>();
  vsaved: [Phaser.GameObjects.GameObject & { x: number; y: number; scaleX: number; scaleY: number }, number, number, number, number][] = [];
  bridgeK = 0; bridgeImg: Phaser.GameObjects.Image | null = null; bridgeTw: Phaser.Tweens.Tween | null = null;

  // art-v11 clarity office + the new attack input (tap = combo, hold/release = typed beam)
  clar: Clarity | null = null; debugCollision = false; hudBlur: Phaser.GameObjects.Image | null = null;
  atkPending = false; atkHeldT = 0; chargeG: Phaser.GameObjects.Graphics | null = null; aimG: Phaser.GameObjects.Graphics | null = null; beamN = 0; beamHits = 0; comboHits = 0;
  combat: CombatGreybox | null = null; combatHoldBeam = 0.85;
  impactLab: ImpactLab | null = null;
  explore: OfficeExplore | null = null;
  stealPlay: StealPlay | null = null;
  /** ?impact=1 — isolated in-memory lab; never touches localStorage. */
  labMode = false;
  swapMode = false;
  fromTitle = false;
  startMode: 'new' | 'continue' | '' = '';
  introPending = false;
  introCardDone = false;
  introCardPending = false;
  intro: IntroCutscene | null = null;
  dialogue: Dialogue | null = null;
  glassRain: GlassRain | null = null;
  playAcc = 0;
  roomCard?: Phaser.GameObjects.Container;
  endScreen?: Phaser.GameObjects.Container;
  endLinesText?: string;
  ending = false;
  endTimer?: Phaser.Time.TimerEvent;
  buildStamp = '';
  init(data?: TitleStartData) {
    this.fromTitle = !!data?.fromTitle;
    this.startMode = data?.mode ?? '';
  }

  stealOn() { return !!(this.impactLab?.on || this.stealPlay?.on); }
  constructor() { super('game'); }

  create() {
    const q = new URLSearchParams(location.search);
    this.labMode = q.has('impact');
    this.swapMode = q.has('swap') || q.has('v9');
    const _st = loadSettings(); setSfxVolume(_st.sfx); setMusicVolume(_st.music);
    this.introPending = this.startMode === 'new' && !this.labMode && !this.swapMode && !q.has('combat') && !q.has('skipIntro');

    // Impact Lab: fresh isolated in-memory save. Do NOT wipe or write the player's localStorage.
    if (this.labMode) {
      setEphemeralSave(true);
      this.save = freshSave();
      this.save.room = 'office';
      // Open floor near the rain window (not the coffee counter / old checkpoints)
      this.save.checkpoint = { room: 'office', x: 880, y: 400, plate: null };
    } else {
      // ?new=1 is for lab / playtest URLs that boot straight into a fresh game.
      // Title Continue must not honor it — the page URL still has ?new=1 from New Game.
      if (q.has('new') && this.startMode !== 'continue') wipeSave();
      this.save = loadSave();
    }
    try { this.seenEver = this.labMode ? [] : JSON.parse(localStorage.getItem('pi.seenEver') ?? '[]'); } catch { this.seenEver = []; }
    recomputeGrowth(this.save);
    this.ctl = new Controls(this);
    this.ctl.onKindChange = () => this.refreshPrompts();
    this.caretKeyF = this.input.keyboard?.addKey('F');
    bindSfxScene(this); installAudioUnlock(); unlockAudio();
    bindMusicScene(this);
    this.makeTextures();
    this.buildHud();
    // Debug overlay ONLY from ?debug in the URL (no keyboard toggle, nothing persisted)
    this.debugOn = q.has('debug') && q.get('debug') !== 'collision';
    this.debugCollision = q.get('debug') === 'collision';
    this.buildStamp = (typeof __PI_BUILD__ !== 'undefined' ? __PI_BUILD__ : 'dev');
    this.input.keyboard!.addCapture('W,A,S,D,SPACE,UP,DOWN,LEFT,RIGHT');
    this.setupCameras();
    this.buildRoom(this.save.room, true);
    if (this.labMode) this.setupStaticCamera();
    else this.setupStaticCamera();
    this.intro = new IntroCutscene(this);
    this.dialogue = new Dialogue(this);
    if (this.intro.shouldPlay()) this.intro.start();
    if (q.has('test')) this.installHooks();
  }

  /**
   * Legacy contain framing (kept for non-lab callers). Prefer setupFollowCamera for full-browser play.
   */
  fitRoomCamera(top = 0, bottom = BAR_Y) {
    // Full-viewport cover — no letterbox pillars. Zoom so height fills the band.
    const bandH = Math.max(1, bottom - top);
    const z = Math.max(bandH / 720, 1280 / 1280);
    this.frameZoom = z;
    this.cameras.main.setViewport(0, 0, 1280, 720).setZoom(1).centerOn(640, 360);
  }

  /** Full-browser follow cam: Scale.ENVELOP fills the browser (no letterbox); cam tracks Noor at closer zoom. */
  setupFollowCamera(zoom = 1.75) {
    this.followCam = true;
    this.followZoom = zoom;
    this.frameZoom = zoom;
    const cam = this.cameras.main;
    // Logical game stays 1280×720 (ENVELOP fills the browser without letterbox).
    cam.setViewport(0, 0, 1280, 720);
    cam.setZoom(zoom);
    cam.setBounds(0, 0, 1280, 720);
    if (this.noor) {
      cam.startFollow(this.noor, true, 0.14, 0.14);
      cam.setDeadzone(120, 80);
    } else {
      cam.centerOn(640, 360);
    }
    if (this.uiCam) {
      this.uiCam.setViewport(0, 0, 1280, 720);
      this.uiCam.setZoom(1);
      this.uiCam.setScroll(0, 0);
    }
    this.ensureEdgePads();
  }

  /** Normal play: full 1280×720 plate, no follow. ENVELOP still fills the browser (no letterbox bars). */
  setupStaticCamera() {
    this.followCam = false;
    this.followZoom = 1;
    this.frameZoom = 1;
    const cam = this.cameras.main;
    try { cam.stopFollow(); } catch { /* */ }
    cam.setViewport(0, 0, 1280, 720).setZoom(1).setBounds(0, 0, 1280, 720).centerOn(640, 360);
    if (this.uiCam) this.uiCam.setViewport(0, 0, 1280, 720).setZoom(1).setScroll(0, 0);
    this.ensureEdgePads();
  }

    updateFollowCamera() {
    if (!this.followCam) return;
    const cam = this.cameras.main;
    // Keep zoom stable after punch-in eases back
    if (Math.abs(cam.zoom - this.followZoom) < 0.03) {
      try { cam.setZoom(this.followZoom); } catch { /* */ }
    }
  }

  /** Soft wall/floor pads so the area outside the 1280×720 plate is never a black void. */
  ensureEdgePads() {
    if (this.edgePad) return;
    // Oversized backdrop behind the room (matches office dark walls)
    this.edgePad = this.add.rectangle(640, 360, 2400, 1600, 0x0a1018, 1).setDepth(-10000);
    this.edgePad2 = this.add.rectangle(640, 780, 2400, 400, 0x060a10, 1).setDepth(-9999); // floor extension
    this.objs.push(this.edgePad, this.edgePad2);
  }

  /** True while Noor's feet are over the hub void (not yet on either slab). */
  private overHubVoid() {
    return this.room?.id === 'hub' && this.y > HUB_NY && this.y < HUB_SY && !this.onHubSpan(this.x, this.y);
  }
  /** On the FLOOR span across the rift (only after the swap). */
  onHubSpan(x: number, y: number) {
    return this.room?.id === 'hub' && this.flags.span && x >= LANE.x0 + 4 && x <= LANE.x1 - 4 && y > HUB_NY - 6 && y < HUB_SY + 6;
  }
  /** Mid-dash over the hub void: sit behind the far lip until the feet land on the north slab. */
  private noorSortDepth() {
    return this.overHubVoid() ? -940 : this.y;
  }
  /** North-wall overlay hides a mid-dash body that would otherwise sit in the door. */
  private syncPitCrop() {
    if (!this.noor) return;
    this.noor.isCropped = false; this.noor.setCrop();
    try { this.noor.clearMask(); } catch { /* */ }
  }


  /** Code-drawn chasm between the north and south hub floors. Collision matches HUB_PIT (~y 252–400). */
  drawHubChasm() {
    const X0 = 80, X1 = 1200, W = 1120, NY = HUB_NY, SY = HUB_SY, FACE = HUB_FACE;
    const FOOT = NY + FACE;
    const vpX = 640, vpY = FOOT + HUB_VOID_H * 0.55;
    this.chasmParallax = [];
    const quad = (g: Phaser.GameObjects.Graphics, a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) => {
      g.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
      g.fillTriangle(a.x, a.y, c.x, c.y, d.x, d.y);
    };

    // Cover the painted mid-band with a real drop. Notch a few px into the
    // inner wall faces, but do not punch square blocks out past the side walls.
    const WL = 68, WR = 1212, VW = WR - WL;
    const pit = this.add.graphics().setDepth(-972); pit.name = 'hub-chasm'; this.objs.push(pit);
    pit.fillStyle(0x000000, 1).fillRect(WL, NY - 2, VW, (SY + 18) - (NY - 2));
    // Blend the notch into the wall (shadowed recess, not a hard square).
    pit.fillStyle(0x070b10, 1).fillRect(WL - 2, NY + 6, 6, SY - NY - 10);
    pit.fillStyle(0x070b10, 1).fillRect(WR - 4, NY + 6, 6, SY - NY - 10);

    // Tall empty shaft: receding inner walls, fading to black. Not a thin line, not an oval mouth.
    const layers = 8;
    const bot = { x0: vpX - 70, x1: vpX + 70, y: vpY + 20 };
    for (let i = 0; i < layers; i++) {
      const t0 = i / layers, t1 = (i + 1) / layers;
      const edge = (t: number) => ({
        l: WL + t * (bot.x0 - WL),
        r: WR - t * (WR - bot.x1),
        top: FOOT + t * (bot.y - 16 - FOOT),
        bot: SY - t * (SY - (bot.y + 16)),
      });
      const a = edge(t0), b = edge(t1);
      const shade = Math.max(0, Math.round(8 * (1 - t1)));
      pit.fillStyle((shade << 16) | (shade << 8) | (shade + 1), 1);
      quad(pit, { x: a.l, y: a.top }, { x: a.r, y: a.top }, { x: b.r, y: b.top }, { x: b.l, y: b.top });
      const wall = Math.max(0, Math.round(5 * (1 - t1)));
      pit.fillStyle((wall << 16) | (wall << 8) | (wall + 1), 1);
      quad(pit, { x: a.l, y: a.top }, { x: b.l, y: b.top }, { x: b.l, y: b.bot }, { x: a.l, y: a.bot });
      quad(pit, { x: a.r, y: a.top }, { x: a.r, y: a.bot }, { x: b.r, y: b.bot }, { x: b.r, y: b.top });
    }
    pit.fillStyle(0x000000, 1);
    quad(pit, { x: bot.x0, y: bot.y - 8 }, { x: bot.x1, y: bot.y - 8 }, { x: vpX + 24, y: bot.y + 18 }, { x: vpX - 24, y: bot.y + 18 });
    // Fade the mid-void to black so it reads empty, not filled.
    for (let i = 0; i < 6; i++) {
      pit.fillStyle(0x000000, 0.18 + i * 0.1);
      pit.fillRect(80, FOOT + 20 + i * 14, 1120, 18);
    }
    pit.fillStyle(0x000000, 1).fillRect(80, FOOT + 96, 1120, SY - (FOOT + 96));

    const slot = this.add.graphics().setDepth(-968); slot.name = 'hub-chasm-far'; this.objs.push(slot);
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      const l = WL + 2 + t * (bot.x0 - (WL + 2)), r = WR - 2 - t * ((WR - 2) - bot.x1);
      const top = FOOT + t * (bot.y - 16 - FOOT), botY = SY - t * (SY - (bot.y + 16));
      slot.lineStyle(1, 0x12181e, 0.18 * (1 - t * 0.4));
      slot.lineBetween(l, top, l, botY);
      slot.lineBetween(r, top, r, botY);
    }
    this.chasmParallax.push({ g: slot, k: 0.12 });

    // Raised north deck + FLAT slab edge (office-floor / concrete, not a cylinder).
    const cliff = this.add.graphics().setDepth(120); cliff.name = 'hub-chasm-mid'; this.objs.push(cliff);
    const DECK = 206;
    cliff.fillStyle(0x16344c, 1).fillRect(X0, DECK, W, NY - DECK);
    cliff.lineStyle(1, 0x2a5a78, 0.5);
    for (let i = -14; i <= 14; i++) {
      const x = vpX + i * 88;
      cliff.lineBetween(x, DECK, x, NY);
    }
    cliff.lineStyle(1, 0x2a5a78, 0.3);
    for (let y = DECK + 8; y < NY - 4; y += 14) cliff.lineBetween(X0, y, X1, y);
    // Floor that STOPS: a recessed dark seam, no light pipe/duct line.
    cliff.fillStyle(0x152838, 1).fillRect(X0, NY - 8, W, 8);
    cliff.fillStyle(0x0a141c, 0.85).fillRect(X0, NY - 1, W, 2);
    this.scuffLip(cliff, X0, X1, NY - 2);

    // Flat front face: horizontal strata / expansion joints, no rounded wrap lighting.
    // art-v12: with the Blender chasm loaded, the render's own lit slab edge is the face (no code bands, no cables).
    const rendered = this.textures.exists('hub_rift');
    const bands = rendered ? [] : [0x3a5464, 0x2e4454, 0x243848, 0x1c303e, 0x162830];
    for (let i = 0; i < bands.length; i++) {
      const y = NY + (FACE * i) / bands.length;
      const h = Math.ceil(FACE / bands.length) + 1;
      cliff.fillStyle(bands[i], 1).fillRect(X0, y, W, h);
      cliff.fillStyle(0x0a1218, 0.35).fillRect(X0, y + h - 1, W, 1);
    }
    // Vertical expansion joints (flat slab, not fluting that can read as a pipe).
    for (let x = X0 + 40; x < X1 && !rendered; x += 160) {
      cliff.fillStyle(0x0c141c, 0.45).fillRect(x, NY + 1, 2, FACE - 2);
    }
    // Hard shadow under the face, then the void.
    if (!rendered) { cliff.fillStyle(0x000000, 0.7).fillRect(X0, FOOT - 3, W, 5); cliff.fillStyle(0x000000, 1).fillRect(X0, FOOT, W, 8); }

    // Side returns: short notches into the inner wall, blended, not square cutouts.
    cliff.fillStyle(0x05080c, 1).fillRect(WL, NY, X0 - WL + 2, SY - NY + 4);
    cliff.fillStyle(0x05080c, 1).fillRect(X1 - 2, NY, WR - X1 + 2, SY - NY + 4);
    if (!rendered) { cliff.fillStyle(0x1a303c, 1).fillRect(X0, NY, 8, FACE); cliff.fillStyle(0x1a303c, 1).fillRect(X1 - 8, NY, 8, FACE); }

    // Cables hang in the void (behind a mid-dash Noor).
    const cableG = this.add.graphics().setDepth(-944).setVisible(!rendered); cableG.name = 'hub-chasm-cables'; this.objs.push(cableG);
    const cables = [
      { x: 132, drop: 110, bow: 10 }, { x: 268, drop: 128, bow: -9 },
      { x: 404, drop: 100, bow: 8 }, { x: 812, drop: 122, bow: 12 },
      { x: 948, drop: 108, bow: -10 }, { x: 1096, drop: 96, bow: 6 },
    ];
    for (const c of cables) {
      const y2 = Math.min(SY - 8, NY + c.drop);
      const x1 = c.x + c.bow, y1 = NY + (y2 - NY) * 0.4;
      const x2 = vpX * 0.12 + c.x * 0.88;
      cableG.lineStyle(2, 0x101418, 0.95);
      cableG.beginPath(); cableG.moveTo(c.x, NY + 2); cableG.lineTo(x1, y1); cableG.lineTo(x2, y2); cableG.strokePath();
    }

    const lips = this.add.graphics().setDepth(-936); lips.name = 'hub-chasm-lips'; this.objs.push(lips);
    if (!rendered) {
      lips.fillStyle(0x000000, 0.85).fillRect(X0, SY - 8, W, 5);
      lips.fillStyle(0x1a2834, 1).fillRect(X0, SY - 5, W, 5);
      lips.fillStyle(0x4a6878, 1).fillRect(X0, SY - 2, W, 3);
      lips.fillStyle(0xc8dce0, 0.55).fillRect(X0, SY - 2, W, 1.2);
      this.scuffLip(lips, X0, X1, SY - 1);
    }
    lips.fillStyle(0x05080c, 1).fillRect(WL, SY - 8, X0 - WL + 2, 14);
    lips.fillStyle(0x05080c, 1).fillRect(X1 - 2, SY - 8, WR - X1 + 2, 14);

    this.drawSouthLedgeFloor(X0, X1, SY, 500);
    const rd = drawRiftDetail(this);
    for (const fl of rd.fogLayers) this.chasmParallax.push(fl);
    startRiftDebris(this);
    this.startPitPapers();
    this.startChasmMotes(X0, X1, NY, SY, vpX, vpY);
    // Overlay the painted north wall/door/glass so a mid-dash Noor (depth -940) is hidden
    // behind the far slab until her feet land. Cropped to the lip so her legs stay visible in the void.
    this.hubNorthOcclude = {};
    for (const [st, im] of Object.entries(this.bg)) {
      if (!im?.texture) continue;
      const ov = this.add.image(0, 0, im.texture.key).setOrigin(0).setDepth(200);
      ov.setCrop(0, 0, 1280, NY);
      ov.setAlpha(im.alpha);
      ov.name = 'hub-north-occlude-' + st;
      this.objs.push(ov);
      this.hubNorthOcclude[st] = ov;
    }
  }

  private updateChasmParallax() {
    if (!this.chasmParallax.length) return;
    const cam = this.cameras.main;
    const dx = (cam.midPoint.x - 640);
    const dy = (cam.midPoint.y - 360);
    for (const L of this.chasmParallax) L.g.setPosition(dx * L.k, dy * L.k);
  }

  private startChasmMotes(x0: number, x1: number, ny: number, sy: number, vpX: number, vpY: number) {
    const g = this.add.graphics().setDepth(-948); g.name = 'hub-chasm-motes'; this.objs.push(g);
    type M = { x: number; y: number; vx: number; vy: number; a: number; s: number };
    const motes: M[] = [];
    const spawn = (): M => {
      const fromN = Math.random() < 0.55;
      return {
        x: x0 + 30 + Math.random() * (x1 - x0 - 60),
        y: fromN ? ny + 8 + Math.random() * 12 : sy - 10 - Math.random() * 16,
        vx: (vpX - 640) * 0.002 + (Math.random() - 0.5) * 8,
        vy: fromN ? 8 + Math.random() * 14 : -(6 + Math.random() * 12),
        a: 0.25 + Math.random() * 0.4,
        s: 1.2 + Math.random() * 1.6,
      };
    };
    for (let i = 0; i < 14; i++) motes.push(spawn());
    const tick = () => {
      if (!g.active) return;
      g.clear();
      for (const m of motes) {
        m.x += m.vx * 0.016;
        m.y += m.vy * 0.016;
        m.x += (vpX - m.x) * 0.004;
        m.y += (vpY - m.y) * 0.006;
        m.a -= 0.0035;
        m.s = Math.max(0.3, m.s - 0.004);
        if (m.a <= 0.02 || Math.abs(m.y - vpY) < 6) {
          const n = spawn(); m.x = n.x; m.y = n.y; m.vx = n.vx; m.vy = n.vy; m.a = n.a; m.s = n.s;
        }
        g.fillStyle(0xd8e8ec, m.a);
        g.fillRect(m.x, m.y, m.s, m.s);
      }
      this.time.delayedCall(32, tick);
    };
    tick();
  }

  /** Irregular worn nicks along a lip — painted-room metal, not tape. */
  private scuffLip(g: Phaser.GameObjects.Graphics, x0: number, x1: number, y: number) {
    for (let x = x0 + 10; x < x1; x += 28 + ((x * 13) % 11)) {
      const w = 3 + ((x * 7) % 5);
      g.fillStyle(0x121820, 0.55).fillRect(x, y - 1, w, 2);
      if ((x * 5) % 3 === 0) g.fillStyle(0x5a6a78, 0.25).fillRect(x + 1, y - 1, 1.5, 1);
    }
  }

  /** The dark band under the south lip is walkable floor, not a wall. Tiles meet the painted south floor at y≈436. */
  private drawSouthLedgeFloor(x0: number, x1: number, y0: number, y1: number) {
    const floor = this.add.graphics().setDepth(-920); floor.name = 'hub-south-ledge'; this.objs.push(floor);
    const W = x1 - x0;
    // Solid over the old partition band (404..444), then feather alpha cleanly to 0 by y=496 so no seam shows at y=500.
    const solidEnd = y0 + 40;
    floor.fillStyle(0x0b1a2c, 1).fillRect(x0, y0, W, solidEnd - y0);
    const fadeSteps = 14;
    for (let i = 0; i < fadeSteps; i++) {
      const ya = solidEnd + (y1 - solidEnd) * i / fadeSteps;
      const yb = solidEnd + (y1 - solidEnd) * (i + 1) / fadeSteps;
      const a = Math.pow(1 - (i + 0.5) / fadeSteps, 1.5);
      floor.fillStyle(0x091829, a).fillRect(x0, ya, W, yb - ya + 0.6);
    }
    // Diamond tile grid, fading toward the painted south floor so lines blend seamlessly.
    const vpX = 640, vpY = 40;
    const gridEnd = y0 + 56;
    floor.lineStyle(1, 0x1a4a66, 0.48);
    for (let i = -14; i <= 14; i++) {
      const x = vpX + i * 96;
      floor.lineBetween(x, y0, vpX + (x - vpX) * ((gridEnd - vpY) / (y0 - vpY)), gridEnd);
    }
    floor.lineStyle(1, 0x1a4a66, 0.26);
    for (let i = -14; i <= 14; i++) {
      const x = vpX + i * 96 + 48;
      floor.lineBetween(x, gridEnd, vpX + (x - vpX) * ((y0 - 40 - vpY) / (gridEnd - vpY)), y0);
    }
    for (let y = y0 + 8; y < gridEnd; y += 26) {
      const k = 1 - (y - y0) / (gridEnd - y0);
      floor.lineStyle(1, 0x1c4860, 0.38 * k);
      floor.lineBetween(x0, y, x1, y);
    }
    floor.fillStyle(0x000000, 0.18).fillRect(x0, y0, 160, solidEnd - y0);
    floor.fillStyle(0x000000, 0.18).fillRect(x1 - 160, y0, 160, solidEnd - y0);
  }

  private startPitPapers() {
    const spots = [{ x: 210, y: 300 }, { x: 390, y: 316 }, { x: 860, y: 308 }];
    const vpX = 640, vpY = 360;
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      const paper = this.add.graphics().setDepth(-950).setPosition(s.x, s.y);
      paper.name = 'hub-pit-paper';
      const draw = (a: number) => {
        paper.clear();
        paper.fillStyle(0x5a6c7a, a * 0.52);
        paper.fillRoundedRect(-6, -4, 12, 8, 1);
        paper.lineStyle(1, 0x7b92a2, a * 0.45);
        paper.strokeRoundedRect(-6, -4, 12, 8, 1);
        paper.lineStyle(1, 0x354450, a * 0.3);
        paper.lineBetween(-4, -2, 4, -2);
        paper.lineBetween(-3, 1, 3, 1);
      };
      draw(0.55);
      this.objs.push(paper);
      const delay = i * 400;
      const loop = () => {
        if (!paper.active) return;
        paper.setPosition(s.x, s.y).setScale(1).setAlpha(1).setRotation(0);
        draw(0.6);
        this.tweens.add({
          targets: paper,
          x: s.x + (vpX - s.x) * 0.75,
          y: vpY + 14,
          scale: 0.1,
          rotation: (i % 2 === 0 ? 1.2 : -1.0),
          alpha: 0.03,
          duration: 3400 + i * 400,
          delay,
          ease: 'Sine.in',
          onComplete: () => { if (paper.active) { paper.setAlpha(0); this.time.delayedCall(200, loop); } },
        });
      };
      this.time.delayedCall(200 + i * 500, loop);
    }
  }

  maybeGapReveal() {
    if (this.room?.id !== 'hub') return;
    if (this.gapPan !== 'pending') return;
    if (this.busy || this.dying || this.transitioning || this.dialogue?.busy || this.lineToast) return;
    this.playGapReveal();
  }

  /** First-arrival look into the chasm, then a sheet of paper falls in, then the camera returns. */
  playGapReveal(force = false) {
    if (this.room?.id !== 'hub') return;
    if (!force && this.gapPan === 'playing') return;
    if (!force && this.gapPan === 'done' && this.save.seen.includes('gap_pan')) return;
    this.skipGapReveal(false);
    const token = ++this.gapPanToken;
    this.gapPan = 'playing';
    this.busy = true;
    const cam = this.cameras.main;
    const reduce = !!this.save.settings?.reduceMotion;
    if (reduce) {
      this.spawnFallingPaper();
      this.time.delayedCall(900, () => { if (this.gapPanToken === token) this.endGapReveal(); });
      return;
    }
    // At zoom 1 the plate fills the camera, so it cannot scroll. Hold a closer
    // frame on Noor, pan north to the gap at that zoom, then ease back to the plate.
    const proxy = { y: cam.midPoint.y || 360, z: cam.zoom || 1 };
    this.gapPanProxy = proxy;
    const look = () => {
      try { cam.setZoom(proxy.z); cam.centerOn(640, proxy.y); } catch { /* */ }
    };
    const Z = 1.55, startY = 540, gapY = 336;
    this.tweens.add({
      targets: proxy, y: startY, z: Z, duration: 450, ease: 'Sine.easeInOut',
      onUpdate: () => { if (this.gapPanToken === token) look(); },
      onComplete: () => {
        if (this.gapPanToken !== token) return;
        this.tweens.add({
          targets: proxy, y: gapY, duration: 1400, ease: 'Sine.easeInOut',
          onUpdate: () => { if (this.gapPanToken === token) look(); },
          onComplete: () => {
            if (this.gapPanToken !== token) return;
            this.spawnFallingPaper();
            this.time.delayedCall(800, () => {
              if (this.gapPanToken !== token) return;
              this.tweens.add({
                targets: proxy, y: 360, z: 1, duration: 1100, ease: 'Sine.easeInOut',
                onUpdate: () => { if (this.gapPanToken === token) look(); },
                onComplete: () => { if (this.gapPanToken === token) this.endGapReveal(); },
              });
            });
          },
        });
      },
    });
  }

  skipGapReveal(restoreCam = true) {
    this.gapPanToken += 1;
    if (this.gapPanProxy) { try { this.tweens.killTweensOf(this.gapPanProxy); } catch { /* */ } this.gapPanProxy = null; }
    if (this.gapPan === 'playing' || this.gapPan === 'pending') this.endGapReveal(restoreCam);
  }

  private endGapReveal(restoreCam = true) {
    if (this.gapPanProxy) { try { this.tweens.killTweensOf(this.gapPanProxy); } catch { /* */ } this.gapPanProxy = null; }
    if (restoreCam) { try { this.cameras.main.setZoom(1); this.cameras.main.centerOn(640, 360); } catch { /* */ } }
    this.gapPan = 'done';
    if (this.room?.id === 'hub') this.busy = false;
    if (!this.save.seen.includes('gap_pan')) {
      this.save.seen.push('gap_pan');
      try { writeSave(this.save); } catch { /* */ }
    }
  }

  private spawnFallingPaper() {
    const paper = this.add.graphics().setDepth(-945).setPosition(700, 316);
    paper.name = 'hub-fall-paper';
    paper.fillStyle(0xf3ead4, 0.95);
    paper.fillRoundedRect(-9, -6, 18, 13, 1);
    paper.lineStyle(1, 0xc4b496, 0.9);
    paper.strokeRoundedRect(-9, -6, 18, 13, 1);
    paper.lineStyle(1, 0x8a7a62, 0.4);
    paper.lineBetween(-5, -2, 5, -2);
    paper.lineBetween(-4, 1, 4, 1);
    paper.lineBetween(-3, 4, 2, 4);
    this.objs.push(paper);
    this.tweens.add({
      targets: paper,
      x: 640,
      y: 300,
      scale: 0.16,
      rotation: 1.35,
      alpha: 0,
      duration: 2000,
      ease: 'Sine.in',
      onComplete: () => { try { paper.destroy(); } catch { /* */ } },
    });
  }

  setupCameras() {
    this.cameras.main.setViewport(0, 0, 1280, 720).setZoom(1).centerOn(640, 360);
    this.frameZoom = 1;
    this.ensureEdgePads();
    const cam = this.cameras.main;
    this.uiCam = this.cameras.add(0, 0, 1280, 720, false, 'ui');
    const sort = () => {
      const m = cam.id, u = this.uiCam.id;
      for (const o of this.children.list as (Phaser.GameObjects.GameObject & { scrollFactorX?: number; cameraFilter: number })[]) o.cameraFilter = o.scrollFactorX === 0 ? m : u;
    };
    this.events.on('prerender', sort); sort();
    this.events.on('prerender', () => this.viewApply());
    this.events.on('render', () => this.viewRestore());
    // Follow cam is armed after Noor exists (buildRoom / ImpactLab.start)
  }
  /** art-v9: draw logical-space objects through the office floor homography (positions + per-depth scale), then restore */
  viewApply() {
    const vm = this.vm; this.vsaved.length = 0; if (!vm) return;
    this.office?.parallax();
    for (const o of this.children.list as (Phaser.GameObjects.GameObject & { x: number; y: number; scaleX: number; scaleY: number; scrollFactorX: number; visible: boolean })[]) {
      if (o.scrollFactorX === 0 || !o.visible || this.vs.has(o) || o.x === undefined) continue;
      this.vsaved.push([o, o.x, o.y, o.scaleX, o.scaleY]);
      if (o.type === 'Graphics') {   // drawn in absolute logical coords: local affine around a pivot (Noor, unless set)
        const pv = this.pivot.get(o) ?? { x: this.x, y: this.y }; const m = vm.P(pv.x, pv.y), k = vm.s(pv.x, pv.y);
        o.x = m.x + (o.x - pv.x) * k; o.y = m.y + (o.y - pv.y) * k; o.scaleX *= k; o.scaleY *= k;
      } else { const m = vm.P(o.x, o.y), k = vm.s(o.x, o.y); o.x = m.x; o.y = m.y; o.scaleX *= k; o.scaleY *= k; }
    }
  }
  viewRestore() { for (const [o, x, y, sx, sy] of this.vsaved) { o.x = x; o.y = y; o.scaleX = sx; o.scaleY = sy; } this.vsaved.length = 0; }
  /** screen/world (view) point -> logical floor point (identity outside the art-v9 office) */
  toLogical(x: number, y: number) { return this.vm ? this.vm.L(x, y) : { x, y }; }
  use9() { return new URLSearchParams(location.search).has('v9') && this.textures.exists('o9_mid'); }   // art-v11: the lower office9 angle is EXPERIMENTAL (?v9); the old-angle office is the default
  toWorld(x: number, y: number) { const p = this.cameras.main.getWorldPoint(x, y); return { x: p.x, y: p.y }; }
  toScreen(x: number, y: number) { const c = this.cameras.main; return { x: c.x + (x - c.worldView.x) * c.zoom, y: c.y + (y - c.worldView.y) * c.zoom }; }

  // ---------- textures made in code (no image assets needed) ----------
  makeTextures() {
    const radial = (key: string, size: number, stops: [number, string][]) => {
      if (this.textures.exists(key)) return;
      const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d')!;
      const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      for (const [o, c] of stops) gr.addColorStop(o, c);
      g.fillStyle = gr; g.fillRect(0, 0, size, size); this.textures.addCanvas(key, cv);
    };
    radial('pool', 256, [[0, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]);
    if (!this.textures.exists('dark')) {
      const W = 2700, H = 1600; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d')!;
      const gr = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 190);
      gr.addColorStop(0, 'rgba(2,4,8,0)'); gr.addColorStop(1, 'rgba(2,4,8,0.96)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H); this.textures.addCanvas('dark', cv);
    }
  }

  // ---------- HUD ----------
  buildHud() {
    const D = 4000, f = (s: number, w = 500, fam = 'JetBrains Mono') => ({ fontFamily: fam, fontSize: `${s}px`, fontStyle: w >= 700 ? 'bold' : 'normal', color: C.ink });
    const blur = this.hudBlur = this.add.image(150, 70, 'pool').setScale(2.4, 1.2).setTint(0x000000).setAlpha(0.9).setScrollFactor(0).setDepth(D - 1);
    const path = this.add.text(30, 30, '', f(12)).setColor(C.dim).setScrollFactor(0).setDepth(D);
    const title = this.add.text(30, 46, '', f(18, 700)).setColor(C.inkBright).setScrollFactor(0).setDepth(D);
    const caret = this.add.rectangle(0, 50, 10, 19, hex(C.cyan)).setOrigin(0, 0).setScrollFactor(0).setDepth(D);
    const hp: Phaser.GameObjects.Image[] = [];
    const hpLabel = this.add.text(30, 76, 'hp', f(12)).setColor(C.dim).setScrollFactor(0).setDepth(D);
    for (let i = 0; i < MAX_HP; i++) hp.push(this.add.image(58 + i * 15, 84, 'hp_on').setScrollFactor(0).setDepth(D));
    const meta = this.add.text(30, 96, '', f(12, 400, 'IBM Plex Mono')).setColor(C.dim).setScrollFactor(0).setDepth(D);
    const menu = this.add.text(1250, 30, 'esc  menu', f(12)).setColor(C.dim).setOrigin(1, 0).setScrollFactor(0).setDepth(D).setInteractive({ useHandCursor: true });
    menu.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev.stopPropagation(); this.ctl.trigger('pause'); });
    const scrim = this.add.rectangle(640, 720, 1280, 140, 0x040a10, 0.5).setOrigin(0.5, 1).setScrollFactor(0).setDepth(D - 2);
    // hand (word fragment) chip: drag onto a plate to swap
    const hand = this.add.container(640, BAR_Y - 32).setScrollFactor(0).setDepth(D + 160).setVisible(false);
    const hb = this.add.rectangle(0, 0, 120, 34, hex(C.cyan), 1).setStrokeStyle(2, 0xe6fcfc, 0.9);
    const handText = this.add.text(0, 0, '', { fontFamily: 'JetBrains Mono', fontSize: '20px', fontStyle: 'bold', color: '#04121a' }).setOrigin(0.5);
    const hl = this.add.text(-70, 0, '>', f(20, 700)).setOrigin(1, 0.5).setColor(C.cyan);
    hand.add([hb, handText, hl]); hand.setSize(120, 34); hand.setInteractive({ draggable: true, useHandCursor: true });
    hand.on('dragstart', (p: Phaser.Input.Pointer) => { this.ctl.uiPointer = p.id; });
    hand.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => { hand.setPosition(dx, dy); });
    hand.on('dragend', (p: Phaser.Input.Pointer) => { this.ctl.uiPointer = null; this.words.dropAt(p.x, p.y); hand.setPosition(640, BAR_Y - 32); });
    const sub = this.add.text(640, 688, '', { fontFamily: 'IBM Plex Mono', fontSize: '17px', fontStyle: '500', color: C.inkBright, align: 'center', backgroundColor: 'rgba(4,12,18,0.72)', padding: { x: 12, y: 6 } }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2).setVisible(false);
    // Fern speaks via a sticky-note popup
    const fern = this.add.container(1080, 120).setScrollFactor(0).setDepth(D + 3).setVisible(false);
    const card = this.add.rectangle(0, 0, 300, 78, 0x2a1830, 0.94).setStrokeStyle(2, hex(C.fern), 1);
    const fl = this.add.text(-138, -30, 'fern', { fontFamily: 'JetBrains Mono', fontSize: '12px', fontStyle: 'bold', color: C.fern });
    const fernText = this.add.text(-138, -12, '', { fontFamily: 'IBM Plex Mono', fontSize: '15px', fontStyle: '500', color: '#F6E6F4', wordWrap: { width: 276 } });
    fern.add([card, fl, fernText]);
    this.debugText = this.add.text(1250, 60, '', { fontFamily: 'IBM Plex Mono', fontSize: '12px', color: C.ok, align: 'right', backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 6, y: 4 } }).setOrigin(1, 0).setScrollFactor(0).setDepth(D + 10);
    const skip = this.add.text(1250, 300, '', { fontFamily: 'JetBrains Mono', fontSize: '12px', color: C.dim }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(D + 4).setVisible(false);
    const linesHud = this.add.text(1250, 52, '', f(13, 500, 'IBM Plex Mono')).setColor(C.lamp).setOrigin(1, 0).setScrollFactor(0).setDepth(D);
    this.linePrompt = new InteractChip(this, 4000);
    this.linePrompt.hide();
    this.hud = { path, title, caret, hp, hpLabel, meta, menu, hand, handText, sub, fern, fernText, skip, linesHud };

    void blur; void scrim; scrim.setVisible(false);
    this.words = new WordUI(this);
  }

  setHudVisible(on: boolean) {
    this.hudHidden = !on;
    const h = this.hud;
    if (!h) return;
    if (!on) {
      for (const o of [h.path, h.title, h.caret, h.hpLabel, h.meta, h.menu, h.hand, h.sub, h.fern, h.skip, h.linesHud, this.hudBlur]) o?.setVisible(false);
      this.linePrompt?.hide();
      h.hp.forEach(im => im.setVisible(false));
      // The word-system caption bar stays visible until words.update runs, but intro returns early.
      try { this.words?.bar?.setVisible(false); this.words?.heading?.setVisible(false); this.words?.pil?.setVisible(false); this.words?.chipG?.setVisible(false); } catch { /* */ }
    } else {
      this.updateHud();
    }
  }

  updateHud() {
    const h = this.hud;
    h.path.setText(this.room.path); h.title.setText(this.room.title);
    if (this.hudHidden) {
      for (const o of [h.path, h.title, h.caret, h.hpLabel, h.meta, h.menu, h.sub, h.fern, h.skip, h.linesHud, this.hudBlur]) o?.setVisible(false);
      this.linePrompt?.hide();
      h.hp.forEach(im => im.setVisible(false));
      return;
    }
    const showPath = !this.clar && this.swapMode; // steal / default play uses a fading room card instead of ~/hub/
    for (const o of [h.path, h.title, h.meta]) o.setVisible(showPath); this.hudBlur?.setVisible(showPath);
    h.caret.setX(32 + h.title.width + 4).setVisible(showPath && Math.floor(this.t * 1000 / tokens.motion.caretBlinkMs) % 2 === 0);
    h.hp.forEach((im, i) => im.setTexture(i < this.hp ? 'hp_on' : 'hp_off').setVisible(true));
    h.hpLabel.setVisible(true);
    h.menu.setVisible(true);
    h.linesHud.setVisible(true).setText(`lines  ${this.save.lines.length}/${LINES.length}`);
    const st = fernStage(this.save.fernGrowth);
    h.meta.setText(`fern ${this.save.fernGrowth}/10 ${st.name.toLowerCase()}   dash ${this.dashCd > 0 ? '…' : 'ready'}${this.fight ? `   root ${this.rootUsed ? 'used' : 'ready'}` : ''}${this.stored ? `   cut [${this.stored}]` : ''}${this.save.lines.length ? `   unsent ${this.save.lines.length}/${LINES.length}` : ''}`);
    if (this.hand) { h.handText.setText(this.hand.word); const w = Math.max(80, h.handText.width + 28); (h.hand.list[0] as Phaser.GameObjects.Rectangle).setSize(w, 34); (h.hand.list[0] as Phaser.GameObjects.Rectangle).setOrigin(0.5); (h.hand.list[2] as Phaser.GameObjects.Text).setX(-w / 2 - 8); h.hand.setSize(w, 34); }
    h.hand.setVisible(!!this.hand && !this.busy);
    this.debugText.setVisible(this.debugOn);
    if (this.debugOn) {
      const s = this.save;
      this.debugText.setText([
        `[debug]  build ${this.buildStamp}  room ${this.room.id}   input ${this.ctl.last}`,
        `fernGrowth ${s.fernGrowth}/10  stage ${st.name}  hint@${st.hintS}s  root ${st.rootS}s`,
        `lore ${s.lore.length}/5 [${s.lore.join(',')}]`, `helped ${s.helped.length}/3 [${s.helped.join(',')}]  wilted [${s.wilted.join(',')}]`,
        `wordLog ${s.wordLog.map(w => `${w.word}x${w.count}`).join(' ') || '-'}  (top: ${topWord(s)})`,
        `swaps ${s.swapLog.length}  deaths ${s.deaths}`,
        `checkpoint ${s.checkpoint.room} ${Math.round(s.checkpoint.x)},${Math.round(s.checkpoint.y)} ${s.checkpoint.plate ?? ''}`,
        `stuck ${this.stuck.toFixed(1)}s  hint ${this.hintOn}`,
      ].join('\n'));
    }
  }

  // ---------- dialogue ----------
  say(who: SayWho, line: string, ms = 2200, opts?: { box?: boolean; onStart?: () => void }) { this.dialogue?.enqueue(who, line, ms, opts); }
  nextSub() {
    const n = this.subQueue.shift(); const h = this.hud;
    if (!n) { this.subBusy = false; h.sub.setVisible(false); h.fern.setVisible(false); return; }
    this.subBusy = true;
    if (n.who === 'fern') { h.sub.setVisible(false); h.fernText.setText(n.line); h.fern.setVisible(true).setAlpha(0).setY(140); this.tweens.add({ targets: h.fern, alpha: 1, y: 120, duration: 200 }); }
    else {
      h.fern.setVisible(false);
      const col = n.who === 'ai' ? C.fern : n.who === 'papa' ? '#F6E6C8' : n.who === 'floor' ? C.ink : C.inkBright;
      const name = n.who === 'ai' ? 'AI  ' : n.who === 'papa' ? 'PAPA  ' : n.who === 'floor' ? '' : 'noor  ';
      h.sub.setText(name + n.line).setColor(col).setVisible(true);
      // global (art-v11): one line, shrinks to fit, never wraps off-screen
      let z = 17; h.sub.setFontSize(z); while (h.sub.width > 1220 && z > 13) { z--; h.sub.setFontSize(z); }
    }
    this.time.delayedCall(n.ms, () => this.nextSub());
  }
  floorText(x: number, y: number, s: string, color = C.ink, size = 22, life = 2600) {
    const t = this.add.text(x, y, s, { fontFamily: 'JetBrains Mono', fontSize: `${size}px`, fontStyle: 'bold', color, backgroundColor: 'rgba(4,12,18,0.6)', padding: { x: 10, y: 5 } }).setOrigin(0.5).setDepth(3500).setAlpha(0);
    t.setShadow(0, 0, color, 9, true, true);
    this.objs.push(t);
    this.tweens.add({ targets: t, alpha: 1, duration: 200 });
    if (life > 0) this.time.delayedCall(life, () => this.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() }));
    return t;
  }

  // ---------- rooms ----------
  clearRoom() {
    this.tweens.killAll(); this.time.removeAllEvents();
    for (const p of this.plates) p.destroy();
    for (const o of this.objs) o.destroy();
    for (const e of this.enemies) e.g.destroy();
    this.objs = []; this.plates = []; this.enemies = []; this.prompts = []; this.dyn = {}; this.extraWalk = {}; this.hazards = []; this.roomVis = {};
    this.glassRain?.destroy(); this.glassRain = null;
    this.amb = []; this.toyFx = {}; this.refl = null; this.hubCopyBounds = null; this.clockWord = undefined; this.dummyDodges = 0; this.hist = []; this.motes = []; this.motesG = null; this.moteRect = null; this.idleT = 0; this.idleSaid = false; this.copyWarm = 0; this.copySeen = 0; this.copyGlintT = 0; this.copyWasVis = false; this.hubFern = undefined; this.hubFernGlow = undefined; this.copyGlint = undefined;
    this.impactLab?.stop(); this.impactLab = null; this.explore?.destroy(); this.explore = null; this.stealPlay?.stop(); this.stealPlay = null; this.office = null; this.clar = null; this.vm = null; this.vsaved.length = 0; this.atkPending = false; this.chargeG = null; this.aimG = null;
    { if (this.labMode) this.setupStaticCamera(); else this.setupStaticCamera(); }
    this.darkness = null; this.litImg = null; this.bridgeImg = null; this.bridgeTw = null; this.fgImgs = {}; this.hintObj = null; this.hintOn = false; this.stuck = 0; this.hintUsed = false; this.subQueue = []; this.subBusy = false;
    this.caretBox = undefined; this.caretMode = 'hidden'; this.riftWord = undefined; this.riftSpan = undefined; this.hubLamp = undefined; this.caretChip = undefined; this.caretHoldT = 0;
    this.chasmParallax = [];
    this.dialogue?.clear(); this.hud.sub.setVisible(false); this.hud.fern.setVisible(false); this.composer = null; this.busy = false; this.hand = null;
    this.endTimer?.remove(false); this.endTimer = undefined;
    this.endScreen?.destroy(); this.endScreen = undefined; this.endLinesText = undefined; this.ending = false;
    this.roomCard?.destroy(); this.roomCard = undefined;
    this.fight = null; this.rootUsed = false; this.stored = null; this.rewriteT = 0; this.timeScale = 1; this.selecting = false; this.selectG = null; this.cutscene = null; this.slowVeil = null;
    this.birth = null;
  }

  buildRoom(id: RoomId, fromLoad = false) {
    this.clearRoom();
    const r = this.room = ROOMS[id];
    const art = ROOMART[id]; this.art = !!art; this.bg = {};
    const v9 = id === 'office' && this.use9(); const clar = id === 'office' && !v9;   // art-v11: the clarity office is the default
    if (v9) { /* layers are built by Office9 once the plates exist */ }
    else if (art) {
      // rendered clean plate(s) (art-v7) + foreground overlays depth-sorted by their screen base y
      const bk = this.add.rectangle(0, 0, 1280, 720, 0x04080c).setOrigin(0).setDepth(-1001); this.objs.push(bk);
      Object.keys(art.images).forEach((st, i) => { const im = this.add.image(0, 0, `bg_${id}_${st}`).setOrigin(0).setDepth(-1000 + i * 0.01).setAlpha(i === 0 ? 1 : 0); this.objs.push(im); this.bg[st] = im; });
      this.fgImgs = {};
      for (const l of clar ? [] : art.fg) { const im = this.add.image(l.x, l.y, l.key).setOrigin(0).setDepth(l.baseY); this.objs.push(im); this.fgImgs[l.name] = im; }
      if (art.bridge) { this.bridgeImg = this.add.image(art.bridge.x, art.bridge.y, 'bridge_0').setOrigin(0).setDepth(379); this.objs.push(this.bridgeImg); }
    } else this.drawFloor(r);
    for (const p of r.props) this.drawProp(p);
    const sv = this.save; sv.visits[id] = (sv.visits[id] ?? 0) + 1;
    const lg = LINGER[id];
    const unlock: PlateDef = { id: id + '_all', words: ['ALL'], slot: -1, x: lg.all.sx, y: lg.all.sy, sx: lg.all.sx, sy: lg.all.sy, kind: 'unlock', code: lg.all.code, val: lg.all.val, hidden: true };
    for (const d of [...r.plates, ...lg.plates, unlock, ...(clar ? [DOOR_DEF] : [])]) {
      const words = [...d.words]; if (d.slot >= 0 && this.save.plates[d.id]) words[d.slot] = this.save.plates[d.id];
      const p = new Plate(this, d, words); p.alt = sv.visits[id] > 1; this.plates.push(p);
      if (d.kind === 'line' && (sv.lines.includes(d.id) || (d.after === 'draft' && !sv.defeated.includes('draft')))) p.setVisibleState(false);
      else if (d.kind === 'line') p.setVisibleState(true);
      if (d.kind === 'unlock') p.setVisibleState(sv.tutorials.includes('all:' + id));
    }
    if (id === 'office' && clar) { this.clar = new Clarity(this); Plate.vars.N = String(sv.unread ?? 37); }
    else if (id === 'office') { this.office = new Office9(this, !v9); Plate.vars.N = String(sv.unread ?? 37); }   // legacy (default) = old-angle plate + directing camera + close-up shots
    if (art) this.buildAmbient(id);
    this.words.resetRoom();
    // Noor
    this.shadow = this.add.ellipse(0, 0, 40, 12, 0x000000, 0.22); this.objs.push(this.shadow);   // art-v10: soft AO only (the contact shadow is rendered into the sprite)
    this.noor = this.add.sprite(0, 0, 'noor_idle').setOrigin(96 / 192, 160 / 192); this.objs.push(this.noor);
    this.noor.play('noor_idle_S');
    this.noor.on('animationcomplete', (a: Phaser.Animations.Animation) => { if (/^noor_(attack|dash|type|combo|peel|throw|release|charge_in)/.test(a.key)) this.noor.play(`noor_idle_${this.dir}`); });
    this.caret = this.add.sprite(0, 0, 'caret_idle').setScale(0.45).setOrigin(0.5, 0.83).play('caret_idle_S').setVisible(false); this.objs.push(this.caret);
    // One Caret on screen: the sprite is only a position/visibility anchor, the I-beam mark is what you see.
    (this.caret as unknown as { willRender: () => boolean }).willRender = () => false;
    const cp = this.save.checkpoint;
    const spawn = fromLoad && cp.room === id ? cp : r.spawn;
    this.x = spawn.x; this.y = spawn.y; this.unstick(); this.hp = MAX_HP; this.dashCd = 0; this.dashT = 0; this.iframes = 0; this.moved = 0;
    this.caret.setPosition(this.x - 46, this.y - 56);
    this.setupCaretForRoom(id);
    if (!fromLoad || cp.room !== id) { this.save.checkpoint = { room: id, x: r.spawn.x, y: r.spawn.y, plate: null }; }
    this.save.room = id; writeSave(this.save);
    this.words.quiet = !!this.clar || ((STEAL_ROOMS.includes(id) || id === 'message') && !this.swapMode);
    if (this.words.quiet) {
      this.words.bar.setVisible(false);
      this.words.heading.setVisible(false);
      this.words.pil.setVisible(false);
      this.words.chipG.setVisible(false);
    }
    this.setupRoom(id);
    this.clar?.start();
    // combat greybox: office only, behind ?combat=1
    this.combat?.destroy(); this.combat = null;
    if (id === 'office' && this.clar && new URLSearchParams(location.search).has('combat')) {
      this.combat = new CombatGreybox(this, new URLSearchParams(location.search).get('tune') === '1');
      this.combatHoldBeam = this.combat.tune.holdBeam;
    }
    // Dead-lift beat is normal R0 play (zoom 1, full-bleed). ?impact still starts the isolated lab.
    if (id === 'office' && this.clar) {
      this.impactLab?.stop();
      this.impactLab = new ImpactLab(this);
    }
    this.chargeG = this.add.graphics().setDepth(3400); this.aimG = this.add.graphics().setDepth(3390); this.objs.push(this.chargeG, this.aimG);
    this.evaluate(true);
    if (id === 'office' && this.clar && !this.swapMode && !new URLSearchParams(location.search).has('combat')) this.impactLab?.start();
    if (id === 'office' && !this.swapMode) { this.explore?.destroy(); this.explore = new OfficeExplore(this); }
    if (STEAL_ROOMS.includes(id) && !this.swapMode) { this.stealPlay = new StealPlay(this); this.stealPlay.start(); }
    if (!this.introPending) this.cameras.main.fadeIn(220, 4, 8, 12);
    else { try { this.cameras.main.setAlpha(1); } catch { /* */ } this.cameras.main.fadeOut(0, 4, 8, 12); }
    if (!this.introPending && !this.intro?.playing && !this.swapMode) showRoomCard(this, id);
    playMusic(id === 'arena' ? 'tense' : 'none', 1.2);
    setAmbience(id, 1.25);
  }

  drawFloor(r: RoomDef) {
    const g = this.add.graphics().setDepth(-1000); this.objs.push(g);
    g.fillStyle(0x04080c, 1).fillRect(0, 0, 1280, 720);
    const areas = [...r.walk];
    if (r.floor.round) {
      const o = r.floor.round; g.fillStyle(r.floor.base, 1).fillCircle(o.x, o.y, o.r);
      g.lineStyle(2, 0x78e4e8, 0.35).strokeCircle(o.x, o.y, o.r);
      g.lineStyle(1, r.floor.line, 1); for (let x = o.x - o.r; x <= o.x + o.r; x += r.floor.tile) { const dy = Math.sqrt(Math.max(0, o.r * o.r - (x - o.x) ** 2)); g.lineBetween(x, o.y - dy, x, o.y + dy); }
      for (let y = o.y - o.r; y <= o.y + o.r; y += r.floor.tile) { const dx = Math.sqrt(Math.max(0, o.r * o.r - (y - o.y) ** 2)); g.lineBetween(o.x - dx, y, o.x + dx, y); }
    } else for (const a of areas) {
      g.fillStyle(r.floor.base, 1).fillRect(a.x, a.y, a.w, a.h);
      g.lineStyle(1, r.floor.line, 1);
      for (let x = a.x; x <= a.x + a.w; x += r.floor.tile) g.lineBetween(x, a.y, x, a.y + a.h);
      for (let y = a.y; y <= a.y + a.h; y += r.floor.tile) g.lineBetween(a.x, y, a.x + a.w, y);
      g.lineStyle(2, 0x0a1a24, 1).strokeRect(a.x, a.y, a.w, a.h);
    }
  }
  drawProp(p: { x: number; y: number; w: number; h: number; color: number; top?: number; label?: string; glow?: number; solid?: boolean }) {
    if (this.art && p.label !== 'alcove_door') { if (p.solid) this.dyn['prop' + p.x + '_' + p.y] = { x: p.x, y: p.y + 10, w: p.w, h: p.h - 10 }; return; }   // the render draws it; keep the collider
    const g = this.add.graphics().setDepth(p.solid ? p.y + p.h : p.y < 200 ? -900 : p.y - 50); this.objs.push(g);
    if (p.glow) { const pool = this.add.image(p.x + p.w / 2, p.y + p.h, 'pool').setScale(Math.max(p.w, 90) / 110).setTint(p.glow).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(-800); this.objs.push(pool); }
    g.fillStyle(p.color, 1).fillRect(p.x, p.y, p.w, p.h);
    if (p.top) g.fillStyle(p.top, 1).fillRect(p.x, p.y, p.w, Math.min(14, p.h / 3));
    if (p.label === 'rain') { for (let i = 0; i < 40; i++) { const rx = p.x + Math.random() * p.w, ry = p.y + Math.random() * p.h; g.lineStyle(1, 0x8ab0d0, 0.35).lineBetween(rx, ry, rx - 3, ry + 10); } }
    if (p.solid) this.dyn['prop' + p.x + '_' + p.y] = { x: p.x, y: p.y + 10, w: p.w, h: p.h - 10 };
    if (p.label) this.roomVis[p.label] = g;
  }

  setupRoom(id: RoomId) {
    const s = this.save;
    if (id === 'office') {
      if (!this.art) { const lamp = this.add.image(990, 520, 'pool').setScale(1.6).setTint(0xf6c684).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(-800); this.objs.push(lamp); }
      // global fix: the 11:48 card no longer sits over the room; in the art-v9 office it is folded into the establishing shot
      if (this.clar) { /* clarity: the heading shows once, no camera move, no floor prompts */ }
      else if (this.office) this.office.cam.establish(s.seen.includes('sc1') ? 'FLOOR 2  \u00b7  STILL 11:48 PM' : '11:48 PM');
      else if (!s.seen.includes('sc1')) { this.floorText(640, 140, '11:48 PM', C.inkBright, 30, 1300); }
    }
    if (id === 'hub') {
      const fern = this.add.sprite(1005, 518, 'fern_plant').setOrigin(0.5, 0.93).setScale(0.38).play('fern_plant_S').setDepth(595); this.objs.push(fern);
      this.hubFern = fern;
      const glow = this.add.image(1005, 548, 'pool').setTint(hex(C.fern)).setAlpha(0.28).setBlendMode(Phaser.BlendModes.ADD).setDepth(-800).setScale(0.7); this.objs.push(glow);
      this.hubFernGlow = glow;
      // Two detached platforms with a real chasm between them (collision matches the pit).
      this.drawHubChasm();
      this.hazards.push({ ...HUB_PIT });
      this.gapPan = s.seen.includes('gap_pan') ? 'done' : 'pending';
      // The painted mid-room partition is a full-width metal bar — hide it so the chasm can read as a drop.
      try { this.fgImgs.partition?.setVisible(false); } catch { /* */ }
      // No door: the rift itself is the puzzle. The far slab is a raised face you can't reach
      // except across the FLOOR span, so dashing anywhere else just drops you.
      try { this.fgImgs.door_panel?.setVisible(false); this.fgImgs.lamp?.setVisible(false); } catch { /* */ }
      this.riftWord = new RiftWord(this);
      this.riftSpan = new RiftSpan(this);
      this.hubLamp = new HubLamp(this);
      this.caretChip = new InteractChip(this, 9003);
      this.objs.push(this.caretChip.root);
      this.dyn.riftL = { x: RIFT.x0, y: RIFT.ny, w: LANE.x0 - RIFT.x0, h: 36 };
      this.dyn.riftR = { x: LANE.x1, y: RIFT.ny, w: RIFT.x1 - LANE.x1, h: 36 };
      this.dyn.riftLane = { x: LANE.x0, y: RIFT.ny, w: LANE.x1 - LANE.x0, h: 36 };
      // steal path: no word-swap / caption prompts (lure shows E / F)
      if (!s.seen.includes('sc3')) {
        s.seen.push('sc3'); writeSave(s);
        this.startCutscene('sc3', 0, () => {}, () => { this.subQueue = []; this.nextSub(); });
        this.time.delayedCall(500, () => {
          this.say('noor', 'Where am I?', 1600); this.say('fern', 'Inside everything you all ever typed.', 2400);
          this.say('noor', 'Why are things moving?', 1700); this.say('fern', 'Say something enough, and it listens.', 2400);
          this.say('noor', 'And you?', 1200); this.say('fern', 'You talked to me. Every morning.', 2300);
          this.say('fern', "You came back. They said you wouldn't.", 2400); this.say('noor', 'Came back from where?', 1700);
          this.say('fern', 'Look at the edge. Even the gap is only a word.', 2600);
        });
      }
    }
    if (id === 'corridor') {
      const lamp = this.art ? this.bg.lit : this.add.image(360, 400, 'pool').setScale(3, 1.6).setTint(0xf6c684).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(-800); if (!this.art) this.objs.push(lamp); this.roomVis.lamp = lamp;
      // art-v8: the old code-drawn cyan floor bars are gone; the lit plate's rendered light pools show the way
      if (this.art && this.bg.lit) {   // dark plate below; the lit plate shows only through a soft light mask around Noor and her caret
        if (!this.textures.exists('litmask')) this.litMask = this.textures.createCanvas('litmask', 1280, 720); else this.litMask = this.textures.get('litmask') as Phaser.Textures.CanvasTexture;
        this.litImg = this.add.image(0, 0, 'litmask').setOrigin(0).setDepth(-999); this.objs.push(this.litImg);
      } else { this.darkness = this.add.image(this.x, this.y, 'dark').setDepth(2500); this.objs.push(this.darkness); }
      this.dyn.dark = { x: 600, y: 330, w: 24, h: 140 };
      // steal path: no READ / code-vision prompt
      this.dyn.alcove = { x: 1190, y: 330, w: 30, h: 160 };
      this.spawnEnemy('dummy', 1160, 446);
      this.dummyDodges = 0;
      this.clockWord = new ClockWord(this, 1128, 200);
      this.clockWord.set(this.plateById('c_clock')?.slotWord ?? 'STILL');
      if (s.defeated.includes('dummy')) { this.dyn.alcove = null; this.roomVis.alcove_door?.destroy(); }
    }
    if (id === 'archive') {
      const pit = this.add.graphics().setDepth(-950).setVisible(!this.art); this.objs.push(pit);
      pit.fillStyle(0x020406, 1).fillRect(440, 180, 400, 500);
      pit.lineStyle(1, 0x182833, 1); for (let y = 200; y < 680; y += 40) pit.lineBetween(440, y, 840, y);
      const water = this.add.rectangle(440, 180, 400, 500, 0x1a4a6a, 0.92).setOrigin(0).setDepth(620).setVisible(!this.art); this.objs.push(water); this.roomVis.water = water;
      const glint = this.add.graphics().setDepth(621).setVisible(!this.art); this.objs.push(glint); this.roomVis.glint = glint;
      for (let i = 0; i < 30; i++) glint.lineStyle(1, 0x9ad8f0, 0.25).lineBetween(450 + Math.random() * 360, 190 + Math.random() * 480, 470 + Math.random() * 360, 190 + Math.random() * 480);
      const bridge = this.add.graphics().setDepth(379).setVisible(!this.art); this.objs.push(bridge); this.roomVis.bridge = bridge;
      if (!s.defeated.includes('scribble')) this.spawnEnemy('scribble', 1000, 300);
      for (let i = 0; i < 4; i++) if (!s.defeated.includes('note' + i)) this.spawnEnemy('note', 1040, 560, i);
      this.drawWaterCooler(860, 236);
    }
    if (id === 'arena') {
      if (!this.art) { const lamp = this.add.image(640, 420, 'pool').setScale(3.2, 2.2).setTint(0xf6c684).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(-800); this.objs.push(lamp); }
      this.dyn.arenaDoor = s.defeated.includes('draft') ? null : { x: 590, y: 150, w: 100, h: 20 };
      this.slowVeil = this.add.rectangle(640, 360, 1280, 720, hex(C.cyan), 0.07).setScrollFactor(0).setDepth(3900).setVisible(false); this.objs.push(this.slowVeil);
      if (!s.defeated.includes('draft')) {
        this.save.checkpoint = { room: 'arena', x: this.room.spawn.x, y: this.room.spawn.y, plate: null };
        this.fight = new DraftFight(this);
        this.startCutscene('sc4', 2200, () => { this.say('fern', 'Every claim reply you rewrote and never sent.', 2800); }, () => { if (this.fight) { this.fight.real.g.setAlpha(1); this.fight.real.t = 0; } });
        if (this.swapMode) {
          this.addPrompt('rewrite', 0, 0, 'HOLD E AT THE PILLAR, F AT THE DRAFT', 'HOLD E AT THE PILLAR, F AT THE DRAFT', () => this.rewriteN > 0, () => Math.hypot(this.x - 450, this.y - 330) < 200);
          this.addPrompt('select', 0, 0, 'HOLD J, RELEASE: TYPED BEAM', 'HOLD TYPE, RELEASE: BEAM', () => this.selectN > 0, () => !!this.fight && this.fight.real.state !== 'intro');
          this.addPrompt('root', 0, 0, 'R: FERN ROOT (ONCE PER FIGHT)', 'ROOT: PIN IT (ONCE PER FIGHT)', () => this.rootN > 0, () => !!this.fight && this.fight.split);
        }
      } else { this.plateById('r_guard')?.setVisibleState(false); this.plateById('r_weak')?.setVisibleState(false); }
    }
    if (id === 'office') { this.glassRain?.destroy(); this.glassRain = new GlassRain(this); }
    if (id === 'message') {
      const wall = this.add.container(640, 60).setDepth(-850).setVisible(!this.art); this.objs.push(wall);
      const shard = this.add.text(640, 520, 'FILED: \u2588\u2588/\u2588\u2588', { fontFamily: 'JetBrains Mono', fontSize: '18px', fontStyle: 'bold', color: C.lamp }).setOrigin(0.5).setDepth(2000).setAlpha(0); this.objs.push(shard);
      const lines: [string, string, number][] = [['papa', 'Beta, did the claim go through?', 0], ['ai', `Still processing, don't worry. It's ${topWord(this.save)}.`, 1], ['papa', 'Okay. Eat properly. Love you.', 0], ['ai', 'Love you too, Papa.', 1]];
      let finished = false;
      const finish = () => {
        if (finished) return; finished = true; this.cutscene = null;
        this.plateById('m_stairs')?.setVisibleState(true);
        this.save.phaseComplete = true; if (!this.save.seen.includes('sc5')) this.save.seen.push('sc5'); this.markSeen('sc5'); writeSave(this.save);
        this.endTimer?.remove(false); this.endTimer = this.time.delayedCall(1200, () => showEndScreen(this));
      };
      this.startCutscene('sc5', 0, () => {}, () => { this.subQueue = []; this.nextSub(); lines.forEach(([who, l, side], i) => { const b = this.add.text(side ? 880 : 400, 90 + i * 40, l, { fontFamily: 'IBM Plex Mono', fontSize: '16px', fontStyle: '500', color: who === 'ai' ? C.fern : '#F6E6C8', backgroundColor: 'rgba(10,16,24,0.9)', padding: { x: 10, y: 5 } }).setOrigin(side ? 1 : 0, 0).setDepth(-840); this.objs.push(b); }); this.time.removeAllEvents(); finish(); });
      const run = () => {
        this.tweens.add({ targets: shard, alpha: 1, y: 470, duration: 900 });
        lines.forEach(([who, l, side], i) => this.time.delayedCall(1400 + i * 1600, () => {
          const b = this.add.text(side ? 880 : 400, 90 + i * 40, l, { fontFamily: 'IBM Plex Mono', fontSize: '16px', fontStyle: '500', color: who === 'ai' ? C.fern : '#F6E6C8', backgroundColor: 'rgba(10,16,24,0.9)', padding: { x: 10, y: 5 } }).setOrigin(side ? 1 : 0, 0).setDepth(-840).setAlpha(0);
          this.objs.push(b); this.tweens.add({ targets: b, alpha: 1, duration: 120 }); // AI: instant, silent
        }));
        this.time.delayedCall(1400 + 4 * 1600, () => {
          this.say('noor', "That isn't me.", 1800); this.say('noor', 'Stop talking to him.', 1800);
          this.say('fern', "Then go down. It's split the claim five ways.", 2600);
        });
        this.time.delayedCall(1400 + 4 * 1600 + 6400, finish);
      };
      run();
    }
    InteractChip.taughtTake = this.save.tutorials.includes('take');
    this.installContextHints();
  }

  // ---------- tutorial floor prompts ----------
  addPrompt(id: string, x: number, y: number, kb: string, touch: string, done: () => boolean, when: () => boolean = () => true) {
    if (this.save.tutorials.includes(id) || this.prompts.some(p => p.id === id)) return;
    void x; void y;
    // `text` stays as the hint's state (tests read it); the key-cap chip is what renders.
    const text = this.add.text(0, 0, '', { fontFamily: 'IBM Plex Mono', fontSize: '13px', color: C.inkBright }).setOrigin(0.5, 0).setDepth(4100).setAlpha(0).setVisible(false); this.objs.push(text);
    const chip = new InteractChip(this, 4100, true); chip.root.setScrollFactor(1); this.objs.push(chip.root);
    const p: Prompt & { when: () => boolean } = { id, kb, touch, text, chip, done, when };
    this.prompts.push(p); this.refreshPrompts();
  }
  refreshPrompts() { for (const p of this.prompts) p.text.setText(this.ctl.last === 'touch' ? p.touch : p.kb); }
  updatePrompts() {
    let shown = false; // one HUD hint at a time, near Noor
    for (const p of [...this.prompts] as (Prompt & { when: () => boolean })[]) {
      if (p.done()) {
        this.save.tutorials.push(p.id); writeSave(this.save); this.prompts.splice(this.prompts.indexOf(p), 1);
        const ch = p.chip; this.tweens.add({ targets: [p.text, ch?.root].filter(Boolean), alpha: 0, duration: 400, onComplete: () => { p.text.destroy(); ch?.destroy(); } });
      } else {
        const show = p.when() && !this.busy && !this.dialogue?.busy && !shown;
        if (show) shown = true;
        const hx = Phaser.Math.Clamp(Math.round(this.x), 110, 1170);
        const hy = Math.round(this.y + 46 > 660 ? this.y - 96 : this.y + 46);
        const a = show ? 0.9 * (1 - this.words.codeA) : 0;
        p.text.setPosition(hx, Phaser.Math.Clamp(hy, 40, 680)).setAlpha(a);
        if (p.chip) { if (a > 0.05) { const h = splitHint(p.text.text); p.chip.show(hx, Phaser.Math.Clamp(hy, 40, 680) + 10, h.verb, 0, h.key); p.chip.root.setAlpha(a); } else p.chip.hide(); }
      }
    }
  }
  /** Progressive, one-at-a-time control hints. Move at start; the rest only when first needed. */
  installContextHints() {
    if (this.room?.id === 'office') {
      this.addPrompt('move', 0, 0, 'WASD  move', 'drag  to move', () => this.moved > 80);
    }
    this.addPrompt('throw', 0, 0, 'F  throw', 'TAP  throw', () => this.hintThrowDone(), () => this.holdingQuality());
    this.addPrompt('caretSend', 0, 0, 'F  write into it', 'TAP  write into it',
      () => this.caretSendOnce || this.save.tutorials.includes('caretSend'),
      () => this.caretOwned && this.caretMode === 'follow' && !!this.caretSendTarget());
    this.addPrompt('attack', 0, 0, 'J  attack', 'TAP  attack',
      () => this.didAttack,
      () => this.enemies.some(e => !e.dead && (e.kind !== 'dummy' || this.flags.still)));
    this.addPrompt('dash', 0, 0, 'SPACE  dash', 'TAP  dash',
      () => this.didDash,
      () => this.enemies.some(e => !e.dead));
    this.addPrompt('letter', 0, 0, 'E  read', 'TAP  read',
      () => this.letterRead,
      () => !!this.explore?.printerFired && !this.letterRead && this.nearPrintedLetter());
    this.addPrompt('interact', 0, 0, 'E  look', 'TAP  look', () => this.hintInteractDone(), () => this.nearHintInteract() && !this.nearPrintedLetter());
  }
  nearHintInteract() {
    // World chips (E take / E look / E read) already own these spots — don't stack a HUD twin.
    if (this.nearLostLine()) return false;
    try { if (this.explore?.nearInteract?.()) return false; } catch { /* */ }
    try { if (this.clar?.near) return true; } catch { /* */ }
    const lab = this.impactLab;
    if (lab && !lab.done) {
      if (!lab.lampReady && Math.hypot(this.x - lab.panelPos.x, this.y - lab.panelPos.y) < 130) return true;
      if (lab.lampReady && lab.lampAlive && !lab.carrying && Math.hypot(this.x - lab.lampPos.x, this.y - lab.lampPos.y) < 130) return true;
    }
    return false;
  }
  hintInteractDone() {
    const looked = this.explore ? this.explore.state().looked.length : 0;
    return this.save.looked.length > 0 || this.save.lines.length > 0 || this.save.lore.length > 0 || looked > 0
      || !!(this.impactLab && (this.impactLab.lampReady || this.impactLab.done));
  }
  holdingQuality() {
    return !!(this.explore?.carrying || this.hand || this.stealPlay?.held
      || (this.impactLab && this.impactLab.carrying));
  }
  hintThrowDone() {
    if (this.holdingQuality()) this.hintThrowArmed = true;
    return this.hintThrowArmed && !this.holdingQuality();
  }

  // ---------- enemies (complaints given bodies: paper and ink, never an employee) ----------
  /** Corridor sentinel: a tailor's form cut from a blank claim template. Its head is an empty
   *  [NAME] field; when it wakes, the field fills in with hers. Paper and ink, never a person. */
  drawPaperDummy(body: Phaser.GameObjects.Graphics, fig?: Phaser.GameObjects.Container) {
    const P = (pts: number[][]) => body.fillPoints(pts.map(p => ({ x: p[0], y: p[1] })) as unknown as Phaser.Math.Vector2[], true);
    // weighted iron base + stand
    body.fillStyle(0x15181c, 1); P([[-22, 2], [22, 2], [16, -5], [-16, -5]]);
    body.fillStyle(0x3a4048, 1).fillRect(-16, -5, 32, 1.5);
    body.fillStyle(0x2a2e34, 1).fillRect(-2, -46, 4, 41);
    // torso: back sheet slightly offset (misregistered), then the front sheet
    const torso = [[-27, -118], [27, -118], [23, -98], [15, -76], [19, -50], [-19, -50], [-15, -76], [-23, -98]];
    body.fillStyle(0x8f8878, 1); P(torso.map(([x, y]) => [x + 4, y + 3]));
    body.fillStyle(0xe6dfcd, 1); P(torso);
    body.fillStyle(0xcfc6b0, 1); P([[8, -118], [27, -118], [23, -98], [15, -76], [19, -50], [10, -50], [7, -76], [12, -98]]);
    // template lines: label stubs + blank rules, like an unfilled form
    body.lineStyle(1, 0x6a6252, 0.6);
    for (const [y, w] of [[-108, 30], [-100, 26], [-92, 18], [-84, 14], [-70, 16], [-62, 20], [-56, 24]] as [number, number][]) body.lineBetween(-w / 2, y, w / 2, y);
    body.fillStyle(0x3a342a, 0.75);
    for (const [y, w] of [[-110, 6], [-102, 9], [-94, 5], [-72, 7]] as [number, number][]) body.fillRect(-w / 2 - 8, y - 1, w, 2);
    // redaction bars and one torn, slipped strip (a glitch in the print)
    body.fillStyle(0x0c0d10, 0.95).fillRect(-12, -89, 22, 4).fillRect(-6, -66, 14, 3);
    body.fillStyle(0xf1ebdc, 1).fillRect(-21 + 5, -81, 38, 4);
    body.fillStyle(0x6a6252, 0.5).fillRect(-21 + 5, -77, 38, 1);
    // staples at the shoulders, ink bleeding from them
    body.fillStyle(0x9aa2a8, 1).fillRect(-22, -116, 6, 1.5).fillRect(16, -116, 6, 1.5);
    body.fillStyle(0x1a1c22, 0.5).fillRect(-20, -114, 1.2, 7).fillRect(19, -114, 1.2, 5);
    // neck
    body.fillStyle(0x2a2e34, 1).fillRect(-1.5, -128, 3, 10);
    if (!fig) return;
    // head: an empty form field. Nothing else on it.
    const head = this.add.container(0, -128);
    const hg = this.add.graphics();
    hg.fillStyle(0x6e685a, 1).fillRect(-21, -24, 44, 25);
    hg.fillStyle(0xf2ecdc, 1).fillRect(-23, -26, 44, 24);
    hg.lineStyle(1, 0x5a5446, 0.9).strokeRect(-23, -26, 44, 24);
    hg.fillStyle(0x3a342a, 0.8).fillRect(-19, -7, 36, 1);
    const lab = this.add.text(-1, -15, '[NAME]', { fontFamily: 'IBM Plex Mono', fontSize: '10px', fontStyle: '700', color: '#7a6a58' }).setOrigin(0.5);
    const flash = this.add.rectangle(0, -60, 60, 140, 0xffffff, 0).setOrigin(0.5);
    head.add([hg, lab]);
    fig.add([head, flash]);
    fig.setData('head', head); fig.setData('label', lab); fig.setData('flash', flash);
  }
  /** art-v12: the Blender-rendered Sentinel (tailor's form of blank claim sheets, iron stand, blank ID-card head).
   *  The game prints the name on the card: NOOR in red while it guards, greyed once it is STILL. */
  drawSentinel(fig: Phaser.GameObjects.Container) {
    const S = 0.45;
    const img = this.add.image(0, 0, 'sentinel').setOrigin(83 / 165, 418 / 467).setScale(S);
    const head = this.add.container(0, -380 * S);
    const lab = this.add.text(0, 1, 'NOOR', { fontFamily: 'IBM Plex Mono', fontSize: '12px', fontStyle: '700', color: '#b8342c' }).setOrigin(0.5);
    head.add(lab);
    const flash = this.add.rectangle(0, -95, 64, 190, 0xffffff, 0).setOrigin(0.5);
    // its line, printed on a strip across the chest: hidden until the Caret opens it
    const strip = this.add.container(-24, -108).setVisible(false);
    const sbg = this.add.rectangle(0, 0, 10, 18, 0xe6dfcd, 1).setStrokeStyle(1, 0x5a5446, 0.95);
    const stx = this.add.text(0, 0, '', { fontFamily: 'JetBrains Mono', fontSize: '13px', fontStyle: 'bold', color: '#1a1c22' }).setOrigin(0.5);
    stx.setLetterSpacing(1);
    strip.add([sbg, stx]);
    fig.add([img, head, strip, flash]);
    fig.setData('head', head); fig.setData('label', lab); fig.setData('flash', flash); fig.setData('strip', strip); fig.setData('stripText', stx); fig.setData('stripBg', sbg);
  }
  /** Print (or type out) the guard's line on its chest strip; returns the strip's right end in world space. */
  setGuardLine(text: string | null, type = false) {
    const e = this.enemies.find(n => n.kind === 'dummy'); const fig = e?.g.getData('fig') as Phaser.GameObjects.Container | undefined;
    const strip = fig?.getData('strip') as Phaser.GameObjects.Container | undefined; if (!strip) return;
    const stx = fig!.getData('stripText') as Phaser.GameObjects.Text, sbg = fig!.getData('stripBg') as Phaser.GameObjects.Rectangle;
    this.guardLine = text;
    if (!text) { strip.setVisible(false); return; }
    strip.setVisible(true);
    const fit = (s: string) => { stx.setText(s); sbg.setSize(Math.max(10, stx.width + 24), 18); sbg.setOrigin(0.5); };
    this.tweens.killTweensOf(stx);
    if (!type) { fit(text); return; }
    fit(text); const full = text; const o = { n: 0 };
    this.tweens.add({ targets: o, n: full.length, duration: 520, onUpdate: () => stx.setText(full.slice(0, Math.round(o.n))), onComplete: () => stx.setText(full) });
  }
  guardLineEnd() {
    const e = this.enemies.find(n => n.kind === 'dummy' && !n.dead); const fig = e?.g.getData('fig') as Phaser.GameObjects.Container | undefined;
    const strip = fig?.getData('strip') as Phaser.GameObjects.Container | undefined;
    const sbg = fig?.getData('stripBg') as Phaser.GameObjects.Rectangle | undefined;
    const ox = strip ? strip.x : 0;
    return e ? { x: e.x + ox + (sbg ? sbg.width / 2 : 44) + 16, y: e.y - 108 } : null;
  }
  /** A short smear-dash: afterimages of the sentinel (no circles) then a snap to (nx, ny). */
  dummyDash(e: Enemy, nx: number, ny: number, dur = 0.08) {
    const img = e.g.getData('fig') as Phaser.GameObjects.Container | undefined;
    const src = this.textures.exists('sentinel') ? 'sentinel' : null;
    for (let i = 0; i < 3; i++) {
      const gx = e.x + (nx - e.x) * (i / 5), gy = e.y + (ny - e.y) * (i / 5);
      const ghost = src
        ? this.add.image(gx, gy, src).setOrigin(83 / 165, 418 / 467).setScale(0.45).setAlpha(0.46 - i * 0.1).setTint(0xb8d4e4).setDepth((e.y) - 2)
        : this.add.rectangle(gx, gy - 70, 36, 120, 0xb8d4e4, 0.22).setDepth(e.y - 2);
      this.objs.push(ghost);
      this.tweens.add({ targets: ghost, alpha: 0, x: gx - (nx - e.x) * 0.2, duration: 280 + i * 70, onComplete: () => ghost.destroy() });
    }
    const tox = e.hx + Phaser.Math.Clamp(nx - e.hx, -64, 36);
    const toy = e.hy + Phaser.Math.Clamp(ny - e.hy, -28, 36);
    this.tweens.add({ targets: e, x: tox, y: toy, duration: Math.max(50, dur * 1000), ease: 'Cubic.easeOut' });
    if (img) { this.tweens.killTweensOf(img); img.setX(0); this.tweens.add({ targets: img, x: { from: (e.x - tox) * 0.4, to: 0 }, duration: 120, ease: 'Cubic.easeOut' }); }
  }
  /** The empty field fills with her name when the sentinel wakes; empties again if it sleeps. */
  setDummyAwake(e: Enemy, on: boolean) {
    const fig = e.g.getData('fig') as Phaser.GameObjects.Container | undefined;
    const lab = fig?.getData('label') as Phaser.GameObjects.Text | undefined;
    if (!lab) return;
    lab.setText('NOOR').setColor(on ? '#b8342c' : '#6a6458');
  }
  drawScribble(body: Phaser.GameObjects.Graphics) {
    body.lineStyle(4, 0x0c0e1e, 1);
    body.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = i * 0.9, r = 14 + (i % 3) * 6;
      const px = Math.cos(a) * r, py = -22 + Math.sin(a) * r * 0.7;
      if (i) body.lineTo(px, py); else body.moveTo(px, py);
    }
    body.strokePath();
    body.lineStyle(1.5, 0x78e4e8, 0.7).strokeCircle(-6, -26, 3).strokeCircle(6, -26, 3);
    // Tiny ink teeth — complaints that grew an edge, not a face.
    body.fillStyle(0x0c0e1e, 1);
    for (const x of [-7, 0, 7]) { body.fillTriangle(x - 3, -8, x + 3, -8, x, -1); }
  }
  drawDraft(g: Phaser.GameObjects.Container, body: Phaser.GameObjects.Graphics) {
    // A fanned stack of unsent claim replies — not a person, not a copy of Noor.
    body.fillStyle(0xe8e2d4, 0.96).fillRoundedRect(-28, -100, 40, 88, 2);
    body.fillStyle(0xefe6d2, 0.96).fillRoundedRect(-10, -106, 42, 92, 2);
    body.fillStyle(0xf7f1e4, 0.98).fillRoundedRect(-6, -102, 40, 90, 2);
    body.lineStyle(1, 0xc8c0b0, 0.9).strokeRoundedRect(-6, -102, 40, 90, 2);
    body.lineStyle(1, 0xb8b0a0, 0.55);
    for (let i = 0; i < 6; i++) body.lineBetween(0, -86 + i * 10, 26, -86 + i * 10);
    const lab = this.add.text(14, -108, 'RE: CLAIM', { fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#5a5040' }).setOrigin(0.5, 0);
    const num = this.add.text(14, -96, '#4471', { fontFamily: 'IBM Plex Mono', fontSize: '11px', fontStyle: 'bold', color: '#3a3428' }).setOrigin(0.5, 0);
    g.add([lab, num]);
  }
  /** Defeated complaints uncrumple and drift away as loose paper. */
  paperDrift(e: Enemy) {
    this.tweens.killTweensOf(e.g);
    this.tweens.add({ targets: e.g, alpha: 0, duration: 180, onComplete: () => e.g.setVisible(false) });
    try { sfx('paper'); } catch { /* */ }
    const n = e.kind === 'draft' ? 10 : e.kind === 'note' ? 4 : 7;
    const col = e.kind === 'note' ? 0xf2dc6a : e.kind === 'scribble' ? 0xe8eef2 : 0xf4efe0;
    for (let i = 0; i < n; i++) {
      const w = 10 + Math.random() * 10, h = 12 + Math.random() * 12;
      const slip = this.add.rectangle(e.x + (Math.random() - 0.5) * 18, e.y - 20 + (Math.random() - 0.5) * 16, w, h, col, 0.96)
        .setStrokeStyle(1, 0xc8c0a8, 0.7).setDepth(e.y + 8).setScale(0.35).setAngle((Math.random() - 0.5) * 50);
      this.objs.push(slip);
      this.tweens.add({
        targets: slip,
        alpha: { from: 1, to: 0 },
        y: slip.y - 50 - Math.random() * 50,
        x: slip.x + (Math.random() - 0.5) * 80,
        angle: slip.angle + (Math.random() - 0.5) * 140,
        scaleX: 1, scaleY: 1,
        delay: i * 40,
        duration: 900 + Math.random() * 400,
        ease: 'Sine.easeOut',
        onComplete: () => slip.destroy(),
      });
    }
  }
  /** Corridor lamp-on: sticky notes crumple into a toothy Scribble, then drift away. */
  playScribbleBirth(x: number, y: number) {
    if (this.birth?.playing || this.save.seen.includes('birth')) return;
    this.save.seen.push('birth'); writeSave(this.save);
    const g = this.add.container(x, y).setDepth(y + 10);
    this.objs.push(g);
    this.birth = { playing: true, t: 0, g };
    const notes: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 8; i++) {
      const n = this.add.rectangle((i % 4) * 16 - 24, -20 - Math.floor(i / 4) * 18, 16, 16, 0xf2dc6a).setStrokeStyle(1, 0xd8c050).setAngle((Math.random() - 0.5) * 24);
      g.add(n); notes.push(n);
    }
    try { sfx('paper'); } catch { /* */ }
    this.tweens.add({
      targets: notes, x: 0, y: -18, angle: 0, duration: 640, ease: 'Quad.easeIn',
      onComplete: () => {
        notes.forEach(n => n.setVisible(false));
        const body = this.add.graphics();
        this.drawScribble(body);
        g.add(body);
        try { sfx('tell'); } catch { /* */ }
        this.time.delayedCall(900, () => {
          this.paperDrift({ kind: 'scribble', x: g.x, y: g.y, hp: 0, maxHp: 0, g, body, state: 'idle', t: 0, kx: 0, ky: 0, tx: 0, ty: 0, hx: 0, hy: 0, dead: true, hitBy: -1, phase: 0 } as Enemy);
          this.time.delayedCall(800, () => { if (this.birth) this.birth.playing = false; });
        });
      },
    });
  }
  drawWaterCooler(x: number, y: number) {
    const g = this.add.graphics().setDepth(y);
    g.fillStyle(0x3a4650, 1).fillRoundedRect(x - 16, y - 52, 32, 52, 3);
    g.fillStyle(0x9ad8f0, 0.7).fillRoundedRect(x - 10, y - 44, 20, 22, 2);
    g.fillStyle(0xd8d0c0, 1).fillRect(x - 6, y - 18, 12, 10);
    g.fillStyle(0xc8d8e0, 0.85).fillTriangle(x - 5, y - 8, x + 5, y - 8, x, y + 4);
    g.lineStyle(1, 0x1a242c, 0.6).strokeRoundedRect(x - 16, y - 52, 32, 52, 3);
    this.objs.push(g);
  }
  spawnEnemy(kind: EKind, x: number, y: number, phase = 0) {

    const g = this.add.container(x, y); const body = this.add.graphics(); g.add(body);
    const sh: Phaser.GameObjects.Shape | null = kind === 'draft' ? null : kind === 'dummy' ? this.add.rectangle(2, 2, 50, 6, 0, 0.45) : this.add.ellipse(0, 0, kind === 'note' ? 16 : 40, 10, 0, 0.4); if (sh) g.addAt(sh, 0);
    const hp = { dummy: 6, scribble: 3, note: 1, draft: DRAFT.hp, redline: 5, stapler: 6 }[kind];
    if (kind === 'dummy') {
      const fig = this.add.container(0, 0); g.remove(body); fig.add(body); g.add(fig); g.setData('fig', fig);
      if (this.textures.exists('sentinel')) this.drawSentinel(fig); else { fig.setScale(1.2); this.drawPaperDummy(body, fig); }
    }
    if (kind === 'scribble') this.drawScribble(body);
    if (kind === 'note') { body.fillStyle(0xf2dc6a, 1).fillRect(-9, -28, 18, 18); body.fillStyle(0xd8c050, 1).fillRect(-9, -14, 18, 4); body.lineStyle(1, 0x6a5a28, 0.45).lineBetween(-6, -22, 5, -22).lineBetween(-6, -17, 3, -17); }
    if (kind === 'draft') this.drawDraft(g, body);
    const flash = this.add.graphics().setDepth(-600); this.objs.push(flash);
    const e: Enemy = { kind, x, y, hp, maxHp: hp, g, body, state: 'idle', t: Math.random() + phase * 0.6, kx: 0, ky: 0, tx: x, ty: y, hx: x, hy: y, dead: false, hitBy: -1, phase, flash };
    this.enemies.push(e);
    return e;
  }
  hurtEnemy(e: Enemy, dmg: number, kx: number, ky: number, mark = false) {
    if (e.dead) return;
    if (this.combat) {
      const mod = this.combat.onHurt(e, dmg, kx, ky);
      if (mod) { if (mod.blocked || mod.dmg <= 0) { if (mod.blocked) return; dmg = mod.dmg; if (dmg <= 0) return; } else dmg = mod.dmg; }
    }
    if (e.practice) {   // the office's stuffed practice dummy: flash, wobble, count; never breaks
      sfx('hit'); this.time.delayedCall(130, () => { try { } catch { /* */ } });
      this.tweens.killTweensOf(e.g); e.g.setRotation(0); const sgn = Math.sign(kx || 1);
      this.tweens.add({ targets: e.g, rotation: { from: 0.16 * sgn * Math.min(2, dmg), to: 0 }, duration: 520, ease: 'Elastic.easeOut' });
      return;
    }
    if (e.kind === 'dummy' && !this.flags.still) {   // QUICK: untouchable — it darts out of the blow with a smear
      const sgn = Math.sign(kx || (e.x - this.x) || 1) || 1;
      this.dummyDash(e, e.x + sgn * 54, e.y - 8, 0.07);
      e.dodgeN = (e.dodgeN ?? 0) + 1; this.dummyDodges++;
      sfx('hit');
      if (!this.save.seen.includes('guardDodge')) {
        this.save.seen.push('guardDodge');
        this.say('fern', "It's quicker than you. Hitting it won't work.", 2600, { box: true });
        if (this.plateById('c_dummy')?.visible) this.say('fern', 'Take STILL from the clock.', 2200, { box: true });
        else this.say('fern', 'Send your cursor in first.', 2000, { box: true });
      }
      return;
    }
    if (e.kind === 'draft' && this.fight) dmg = this.fight.modify(e, dmg);
    if (e.kind === 'scribble' && this.flags.dry) { dmg *= 2; this.floorText(e.x, e.y - 70, 'CRACK x2', C.ok, 13, 500); }
    if (e.kind === 'scribble' && e.wet) { dmg *= 1.5; this.floorText(e.x, e.y - 86, 'MELT', C.cyan, 13, 500); }
    if (dmg <= 0) { this.tweens.add({ targets: e.g, alpha: 0.6, duration: 50, yoyo: true }); return; }
    sfx('hit');
    e.hp -= dmg; if (e.kind !== 'draft' && e.kind !== 'dummy') { e.kx += kx; e.ky += ky; }
    if (e.state === 'lunge' || e.state === 'dive' || e.state === 'windup') { e.state = 'stun'; e.t = 0.5; }
    // hit flash: a white pop over the enemy + a squash punch (readable at 640x360) this.time.delayedCall(130, () => { try { if (e.g) } catch { /* */ } });
    const fig = e.kind === 'dummy' ? e.g.getData('fig') as Phaser.GameObjects.Container | undefined : undefined;
    if (fig) {
      // stagger: the form rocks back on its stand, the print slips sideways, the paper flares white
      const sgn = Math.sign(kx || (e.x - this.x) || 1);
      this.tweens.killTweensOf(fig); fig.setRotation(0).setX(0);
      this.tweens.add({ targets: fig, rotation: { from: 0.22 * sgn, to: 0 }, duration: 560, ease: 'Elastic.easeOut' });
      this.tweens.add({ targets: fig, x: { from: 7 * sgn, to: 0 }, duration: 160, ease: 'Back.easeOut' });
      const fl = fig.getData('flash') as Phaser.GameObjects.Rectangle | undefined;
      if (fl) { this.tweens.killTweensOf(fl); fl.setFillStyle(0xffffff, 1).setAlpha(0.55); this.tweens.add({ targets: fl, alpha: 0, duration: 140 }); }
    } else this.tweens.add({ targets: e.g, scaleX: 1.14, scaleY: 0.88, duration: 55, yoyo: true, ease: 'Quad.easeOut' });
    if (mark) { /* the Caret itself is already parked on the foe — no second cursor glyph */ }
    if (e.hp <= 0) {
      e.dead = true; this.combat?.onKill(e, 'combo'); this.save.defeated.push(e.kind === 'note' ? 'note' + e.phase : e.kind);
      this.tweens.killTweensOf(e.g); e.flash?.clear();
      this.paperDrift(e);
      if (e.kind === 'dummy') { this.dyn.alcove = null; this.roomVis.alcove_door?.destroy(); this.say('fern', 'It tore. The exit is open.', 2400, { box: true }); }
      if (e.kind === 'draft') { this.time.delayedCall(2400, () => { this.plateById('r_line')?.setVisibleState(!this.save.lines.includes('r_line')); this.ambState(); }); this.dyn.arenaDoor = null; this.say('noor', '...So did I.', 2200); }
      writeSave(this.save);
    }
  }
  updateEnemies(dt: number) {
    const groupDive = !this.flags.apart; let diving = this.enemies.some(n => n.kind === 'note' && !n.dead && (n.state === 'windup' || n.state === 'dive'));
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.pinT && e.pinT > 0) {
        e.pinT -= dt; if (!e.rootG) { e.rootG = this.add.graphics(); this.objs.push(e.rootG); }
        e.rootG.clear().lineStyle(3, 0x7ad08a, 0.9); for (let i = 0; i < 6; i++) { const a = i * 1.05; e.rootG.lineBetween(e.x + Math.cos(a) * 34, e.y + Math.sin(a) * 14, e.x + Math.cos(a) * 8, e.y - 30 - (i % 3) * 14); }
        if (e.pinT <= 0) e.rootG.clear(); else { e.flash?.clear(); e.g.setPosition(e.x, e.y); continue; }
      }
      e.t -= dt; e.x += e.kx * dt; e.y += e.ky * dt; e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt);
      const dx = this.x - e.x, dy = this.y - e.y, d = Math.hypot(dx, dy) || 1;
      const fl = e.flash!; fl.clear();
      if (e.practice) { e.g.setPosition(e.x, e.y).setDepth(e.y); continue; }
      if (this.combat && (e as Enemy & { gb?: string }).gb) { continue; }  // CombatGreybox owns AI
      if (e.kind === 'dummy') {
        const fig = e.g.getData('fig') as Phaser.GameObjects.Container | undefined, head = fig?.getData('head') as Phaser.GameObjects.Container | undefined;
        if (this.flags.still) {
          if (head) head.setRotation(-0.22);
          e.state = 'idle'; e.g.setRotation(0);
          e.x += (e.hx - e.x) * Math.min(1, dt * 8); e.y += (e.hy - e.y) * Math.min(1, dt * 8);
        } else {
          if (head) head.setRotation(Math.sin(this.t * 22 + e.phase) > 0.88 ? 0.22 : 0.05 * Math.sin(this.t * 9));
          const close = d < 230;
          if (e.state === 'idle' && e.t <= 0) {
            if (close) { e.state = 'windup'; e.t = (e.swipeN ?? 0) === 0 ? 0.95 : 0.20; e.g.setRotation(-0.18); }
            else {
              const dir = (Math.sin(this.t * 7 + e.phase) >= 0 ? 1 : -1);
              this.dummyDash(e, e.hx + dir * (20 + Math.random() * 22), e.hy + (Math.random() - 0.5) * 10, 0.06);
              e.t = 0.28 + Math.random() * 0.22;
            }
          }
          if (e.state === 'windup') {
            e.g.setRotation(-0.28 * (1 - e.t / 0.95));
            if (e.t <= 0) {
              e.state = 'lunge'; e.t = 0.14; e.swipeN = (e.swipeN ?? 0) + 1;
              e.tx = dx / d; e.ty = dy / d;
              this.dummyDash(e, e.x + e.tx * 70, e.y + e.ty * 46, 0.12);
            }
          } else if (e.state === 'lunge') {
            e.g.setRotation(0.35);
            if (d < 58) this.hurtNoor('shove');
            if (e.t <= 0) { e.state = 'recover'; e.t = 0.22; }
          } else if (e.state === 'recover' || e.state === 'stun') {
            e.g.setRotation(0);
            e.x += (e.hx - e.x) * Math.min(1, dt * 10); e.y += (e.hy - e.y) * Math.min(1, dt * 10);
            if (e.t <= 0) { e.state = 'idle'; e.t = close ? 0.35 : 0.45; e.x = e.hx; e.y = e.hy; }
          }
          e.x = e.hx + Phaser.Math.Clamp(e.x - e.hx, -64, 36);
          e.y = e.hy + Phaser.Math.Clamp(e.y - e.hy, -28, 36);
        }
      }
      if (e.kind === 'scribble') {
        e.body.setAlpha(e.wet ? 0.55 : this.flags.dry ? 0.65 : 1);
        if (e.wet) e.g.setScale(1.08, 0.78 + 0.04 * Math.sin(this.t * 5));
        const fast = e.wet ? 0.7 : e.hp <= e.maxHp / 2 ? 1.4 : 1; const aware = d < 420 && this.x > 820;
        if (e.state === 'idle') { e.g.setScale(1, 1 + 0.05 * Math.sin(this.t * 6)); if (aware) { if (d > 170) { e.x += dx / d * 70 * fast * dt; e.y += dy / d * 70 * fast * dt; } else if (e.t <= 0) { e.state = 'windup'; e.t = 0.6 / fast; } } }
        else if (e.state === 'windup') { e.g.setScale(1.25, 0.6); tellBox(fl, e.x, e.y - 10, 48, hex(C.coral), 0.8); if (e.t <= 0) { e.state = 'lunge'; e.t = 0.32; e.tx = dx / d; e.ty = dy / d; } }
        else if (e.state === 'lunge') { e.g.setScale(0.8, 1.2); e.x += e.tx * 560 * fast * dt; e.y += e.ty * 560 * fast * dt; if (d < 32) { this.hurtNoor('lunge'); e.state = 'recover'; e.t = 0.6; } else if (e.t <= 0) { e.state = 'stuck'; e.t = 1.0; } }
        else if (e.state === 'stuck') { e.g.setScale(1.1, 0.9); fl.lineStyle(1.4, hex(C.cyan), 0.7); fl.lineBetween(e.x - 16, e.y - 28, e.x - 6, e.y - 28); fl.lineBetween(e.x + 6, e.y - 28, e.x + 16, e.y - 28); if (e.t <= 0) { e.state = 'idle'; e.t = 0.5; } }
        else { e.g.setScale(1); if (e.t <= 0) { e.state = 'idle'; e.t = 0.6; } }
        if (e.wet) e.g.setScale(1.08, 0.78 + 0.04 * Math.sin(this.t * 5));
        e.x = Phaser.Math.Clamp(e.x, 860, 1200); e.y = Phaser.Math.Clamp(e.y, 200, 670);
      }
      if (e.kind === 'note') {
        const aware = d < 320 && this.x > 820;
        if (e.state === 'idle') {
          const a = this.t * 2 + e.phase * Math.PI / 2; e.x += ((e.hx + Math.cos(a) * 50) - e.x) * Math.min(1, dt * 4); e.y += ((e.hy + Math.sin(a) * 30) - e.y) * Math.min(1, dt * 4);
          e.body.setY(-8 + Math.sin(this.t * 14 + e.phase) * 3);
          if (aware && e.t <= 0) {
            if (groupDive) { for (const n of this.enemies) if (n.kind === 'note' && !n.dead && n.state === 'idle') { n.state = 'windup'; n.t = 0.45; } }
            else if (!diving) { e.state = 'windup'; e.t = 0.45; diving = true; }
            else e.t = 0.3;
          }
        } else if (e.state === 'windup') { e.body.setX(Math.sin(this.t * 60) * 2); if (e.t <= 0) { e.state = 'dive'; e.t = 0.35; e.tx = dx / d; e.ty = dy / d; e.body.setX(0); } }
        else if (e.state === 'dive') { e.x += e.tx * 480 * dt; e.y += e.ty * 480 * dt; e.body.setY(0); if (d < 24) { this.hurtNoor('dive'); e.state = 'grounded'; e.t = 0.9; } else if (e.t <= 0) { e.state = 'grounded'; e.t = 0.9; } }
        else if (e.state === 'grounded' || e.state === 'stun') { e.body.setY(4); if (e.t <= 0) { e.state = 'idle'; e.t = 2.2 + e.phase * 0.7; } }
        e.x = Phaser.Math.Clamp(e.x, 860, 1200); e.y = Phaser.Math.Clamp(e.y, 200, 670);
      }
      if (e.kind === 'draft') this.fight?.think(e, dt);
      e.g.setPosition(e.x, e.y).setDepth(e.y);
    }
  }

  // ---------- Noor ----------
  canStand(x: number, y: number) {
    const walk = [...this.room.walk, ...Object.values(this.extraWalk).filter(Boolean) as Rect[]];
    if (!walk.some(r => inR(r, x, y))) return false;
    if (this.room.walls.some(r => inR(r, x, y))) return false;
    if (this.clar) { if (this.clar.blocked(x, y)) return false; return !Object.entries(this.dyn).some(([k, r]) => r && !k.startsWith('prop') && inR(r, x, y)); }   // real footprints replace the old prop boxes
    if (Object.values(this.dyn).some(r => r && inR(r, x, y))) return false;
    return true;
  }
  /** returns true if the hit landed. A hit absorbed by the first 0.2 s of a dash is a PERFECT dodge: CUT stores it. */
  hurtNoor(src = 'hit'): boolean {
    if (this.dying || this.busy) return false;
    if (this.iframes > 0) {
      if (this.dashT > 0 && this.t - this.dashStartAt < 0.2 && !this.stored) {
        this.stored = src; this.perfectN++; sfx('swap'); this.floorText(this.x, this.y - 120, `CUT: ${src.toUpperCase()}`, C.cyan, 14, 800);
        if (this.room.id === 'arena' && this.fight && !this.stealPlay?.on && !this.hand && this.plateById('r_weak')?.slotWord === 'WEAK') { this.hand = { word: 'WEAK', from: 'r_weak' }; this.floorText(this.x, this.y - 150, 'FRAGMENT: WEAK', C.ok, 13, 900); }
        if (!this.save.tutorials.includes('cutpaste')) { this.save.tutorials.push('cutpaste'); this.say('floor', this.ctl.last === 'touch' ? 'perfect dodge. TAP TYPE to PASTE it back.' : 'perfect dodge. J / CLICK to PASTE it back.', 2200); }
      }
      return false;
    }
    sfx('hurt');
    this.hp--; this.iframes = 0.8; this.cameras.main.shake(120, 0.004);
    this.noor.setTint(0xff9a8a); this.time.delayedCall(140, () => this.noor.clearTint());
    if (this.hp <= 0) this.die();
    return true;
  }
  die() {
    if (this.dying) return;
    this.dying = true; this.deathAt = performance.now(); this.save.deaths++; this.stealPlay?.snapHeld();
    if (this.fight && !this.fight.won) { if (this.fight.real.hp <= DRAFT.bar) this.save.draftLastBarDeath = true; this.save.checkpoint = { room: 'arena', x: this.room.spawn.x, y: this.room.spawn.y, plate: null }; }
    this.cameras.main.shake(160, 0.01);
    const parts = [hex(C.cyan), hex(C.fern), 0xffffff].map((c, i) => {
      const t = this.add.text(640 + (i - 1) * 6, 330, 'UNDO', { fontFamily: 'JetBrains Mono', fontSize: '84px', fontStyle: 'bold', color: '#' + c.toString(16).padStart(6, '0') }).setOrigin(0.5).setScrollFactor(0).setDepth(6000).setAlpha(i === 2 ? 1 : 0.6);
      return t;
    });
    const glitch = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.55).setScrollFactor(0).setDepth(5990);
    this.undoShown++;
    this.time.delayedCall(330, () => {
      const cp = this.save.checkpoint;
      const p = cp.room === this.room.id ? cp : this.room.spawn;
      this.x = p.x; this.y = p.y; this.hp = MAX_HP; this.iframes = 0.6; this.dashT = 0; this.noor.setScale(1).setAlpha(1);
      if (this.fight && !this.fight.won) { this.fight.reset(); this.rootUsed = false; this.stored = null; this.hand = null; }
      for (const e of this.enemies) if (!e.dead && e.kind !== 'draft') { e.state = 'idle'; e.t = 1.2; e.x = e.hx; e.y = e.hy; }
    });
    this.time.delayedCall(620, () => { parts.forEach(p => p.destroy()); glitch.destroy(); this.dying = false; this.lastRespawnMs = performance.now() - this.deathAt; writeSave(this.save); });
  }

  setCheckpoint(p: Plate) {
    this.save.checkpoint = { room: this.room.id, x: this.x, y: this.y, plate: p.def.id };
    this.hp = MAX_HP; p.pulse(); writeSave(this.save);
  }
  plateById(id: string) { return this.plates.find(p => p.def.id === id); }
  nearestPlate(r: number) {
    let best: Plate | null = null, bd = r;
    for (const p of this.plates) { if (!p.visible || p.def.kind === 'secret' || p.def.kind === 'unlock') continue; const d = Math.hypot(p.def.x - this.x, p.def.y - this.y); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  interact() {
    if (this.stealOn()) return false;
    if (this.clar) return this.clar.interact();
    const p = this.nearestPlate(READ_R); if (!p) return false;
    if (this.hand && p.def.slot >= 0 && p.def.id !== this.hand.from) return this.swap(this.hand.from, p.def.id);
    return this.read(p);
  }
  read(p: Plate) {
    const s = this.save; this.stuck = 0;
    if (!this.inspectOff) this.office?.inspect(p.def.id);
    if (p.def.kind === 'look') { this.words.showLore(p, p.def.text ?? ''); this.noteLooked(p); p.pulse(C.lamp); return true; }
    if (p.def.kind === 'line') { this.collectLine(p); return true; }
    if (p.def.toy) this.noteLooked(p);
    if (p.def.kind === 'lore') {
      this.noteLooked(p);
      this.words.showLore(p, p.def.text ?? '');
      if (!s.lore.includes(p.def.id)) { s.lore.push(p.def.id); recomputeGrowth(s); }
      this.setCheckpoint(p);
      if (p.def.id === 'o_monitor' && !s.seen.includes('sc1')) this.openComposer();
      return true;
    }
    this.setCheckpoint(p);
    if (p.def.slot < 0) return true;   // fixed: the caption already says it
    // pick up the swappable word as a fragment (one held at a time)
    for (const q of this.plates) if (q.opts.selected) q.setOpts({ ...q.opts, selected: false });
    this.hand = { word: p.slotWord!, from: p.def.id }; this.handT = 0;
    p.setOpts({ ...p.opts, selected: true });
    if (this.inCombat()) { this.rewriteT = 2.0; this.rewriteN++; }
    return true;
  }
  swap(fromId: string, toId: string) {
    const A = this.plateById(fromId), B = this.plateById(toId);
    if (!A || !B || A === B || A.def.slot < 0 || B.def.slot < 0 || !A.visible || !B.visible) return false;
    if (!!A.def.toy !== !!B.def.toy || (A.def.toy && (A.def.pair ?? '') !== (B.def.pair ?? ''))) { this.floorText(this.x, this.y - 130, A.def.toy || B.def.toy ? 'THAT WORD ONLY PLAYS HERE' : 'NO', C.dim, 13, 900); return false; }
    const wa = A.slotWord!, wb = B.slotWord!;
    A.setOpts({ ...A.opts, selected: false });
    B.setSlotWord(wa); A.setSlotWord(wb);
    this.save.plates[A.def.id] = wb; this.save.plates[B.def.id] = wa;
    const n = logSwap(this.save, { placed: wa, removed: wb, room: this.room.id, plate: B.def.id, t: Date.now() });
    this.hand = null; this.stuck = 0; this.rewriteT = 0; sfx('swap');
    if (this.room.id !== 'arena' && !B.def.toy) this.setCheckpoint(B); else B.pulse();
    if (B.def.toy) { const lg = LINGER[this.room.id]; const played = B.words[2] !== B.def.words[2]; const tl = B.def.pair && lg.pairs?.[B.def.pair] ? lg.pairs[B.def.pair] : [lg.toy, lg.toyBack]; this.say('floor', played ? tl[0] : tl[1], 2800); if (played && !this.save.toys.includes(this.room.id)) this.save.toys.push(this.room.id); }
    this.cameras.main.flash(90, 120, 228, 232);
    if (n === 3) this.say('fern', 'You keep saying that.', 2200);
    this.evaluate(false);
    writeSave(this.save);
    return true;
  }
  markTut(id: string) { if (id === 'take') InteractChip.taughtTake = true; if (!this.save.tutorials.includes(id)) { this.save.tutorials.push(id); writeSave(this.save); } }
  sfxSwap() { sfx('swap'); }
  /** world drop: the object under the pointer (its highlight anchor or its reach point) */
  dropHand(wx: number, wy: number): boolean {
    if (!this.hand) return false;
    const lp = this.toLogical(wx, wy);   // (wx, wy) = view/world point: plate anchors live there; reach points are logical
    let best: Plate | null = null, bd = 110;
    for (const p of this.plates) {
      if (!p.visible || p.def.slot < 0 || p.def.id === this.hand.from) continue;
      if (Math.hypot(p.def.x - this.x, p.def.y - this.y) > 420) continue;
      const d = p.bounds(28).contains(wx, wy) ? 0 : Math.min(Math.hypot(p.container.x - wx, p.container.y - wy), Math.hypot(p.def.x - lp.x, p.def.y - lp.y));
      if (d < bd) { bd = d; best = p; }
    }
    return best ? this.swap(this.hand.from, best.def.id) : false;
  }

  /** Apply plate rules to the room. Every swap can be undone by swapping back, so no soft-locks. */
  evaluate(initial: boolean) {
    const w = (id: string) => this.plateById(id)?.slotWord;
    const s = this.save, f = this.flags; const help = (k: string) => { if (!s.helped.includes(k)) { s.helped.push(k); recomputeGrowth(s); } };
    const id = this.room.id; const was = { ...f };
    if (id === 'hub') {
      f.span = w('h_rift') === 'FLOOR';
      this.dyn.riftLane = f.span ? null : { x: LANE.x0, y: RIFT.ny, w: LANE.x1 - LANE.x0, h: 36 };
      this.riftWord?.set(w('h_rift') ?? 'VOID');
      this.riftSpan?.set(f.span, initial);
      this.hubLamp?.setFloor(w('h_lamp') === 'FLOOR');
      // the painted SHUT plate carried the old door light; the room always uses the open plate now
      if (this.bg.shut && this.bg.open) for (const [k, im] of Object.entries(this.bg)) { im.setAlpha(k === 'open' ? 1 : 0).setDepth(k === 'open' ? -999.5 : -1000); const ov = this.hubNorthOcclude[k]; if (ov) ov.setAlpha(k === 'open' ? 1 : 0); }
      if (f.span && !was.span && !initial) {
        this.cameras.main.shake(120, 0.002);
        this.say('fern', 'Only the owner of the words leaves.', 2400);
        this.say('noor', "They're my words.", 1600);
        this.say('fern', 'Not here. Not anymore.', 2200);
      }
    }
    if (id === 'office' && this.clar) this.clar.setDoor(w('o_door') === 'OPEN', initial);
    if (id === 'corridor') {
      f.lit = w('c_light') === 'ON';
      this.dyn.dark = f.lit ? null : { x: 600, y: 330, w: 24, h: 140 };
      this.plateById('c_note')?.setVisibleState(f.lit);
      const dur = initial ? 0 : 600;
      if (this.darkness) this.tweens.add({ targets: this.darkness, alpha: f.lit ? 0 : 1, duration: dur });
      this.tweens.add({ targets: [this.roomVis.lamp], alpha: f.lit ? (this.art ? 1 : 0.8) : 0, duration: dur });
      if (f.lit) help('lamp');
      if (f.lit && !was.lit && !initial) {
        this.playScribbleBirth(560, 400);
        this.say('fern', 'Complaints. People typed so many, they grew teeth.', 2800, { box: true });
        this.time.delayedCall(3000, () => this.say('fern', 'I left you a note on the wall.', 2000, { box: true }));
      }
      f.still = w('c_dummy') === 'STILL';
      this.clockWord?.set(w('c_clock') ?? 'STILL');
      if (f.still) help('dummy');
      if (this.save.seen.includes('guardOpen')) this.plateById('c_dummy')?.setVisibleState(true);
      { const gp = this.plateById('c_dummy'); const gl = gp?.visible ? gp.words.join(' ') : null; if (initial || gl !== this.guardLine) this.setGuardLine(gl); }
      { const dd = this.enemies.find(e => e.kind === 'dummy'); if (dd) this.setDummyAwake(dd, !f.still); }
      if (f.still && !was.still && !initial) {
        const d = this.enemies.find(e => e.kind === 'dummy' && !e.dead);
        if (d) { d.state = 'idle'; d.t = 0.5; this.setDummyAwake(d, false); }
        this.caretWriting = undefined; if (this.caretMode === 'sent') { this.caretSentAt = this.t - 3.4; }
        this.say('fern', "It's STILL now. Still paper tears.", 2400, { box: true });
        this.say('fern', 'J to strike.', 1600, { box: true });
      }
    }
    if (id === 'archive') {
      f.drained = ['LOW', 'DOWN'].includes(w('a_water') ?? '');
      f.bridge = w('a_bridge') === 'DOWN';
      const dur = initial ? 0 : 900;
      this.tweens.add({ targets: [this.roomVis.water, this.roomVis.glint], alpha: f.drained ? 0.12 : 0.92, duration: dur });
      const st = this.plateById('a_stairs');
      if (st) { st.setVisibleState(f.drained); if (!f.drained && this.hand?.from === 'a_stairs') this.hand = null; }
      this.extraWalk.bridge = f.bridge ? { x: 430, y: 385, w: 420, h: 70 } : null;
      const b = this.roomVis.bridge as Phaser.GameObjects.Graphics;
      if (this.art && this.bridgeImg) this.animBridge(f.bridge, initial);
      if (this.art) { const want = f.drained ? 'L' : 'H'; for (const [k, im] of Object.entries(this.bg)) { this.tweens.killTweensOf(im); if (initial) im.setAlpha(k === want ? 1 : 0); else this.tweens.add({ targets: im, alpha: k === want ? 1 : 0, duration: 700 }); im.setDepth(k === want ? -999.5 : -1000); } }
      if (b) { b.clear(); if (f.bridge) { b.fillStyle(0x3a2e22, 1).fillRect(440, 385, 400, 70); b.lineStyle(1, 0x5a4a36, 1); for (let x = 440; x < 840; x += 25) b.lineBetween(x, 385, x, 455); } else { b.fillStyle(0x3a2e22, 1).fillRect(440, 300, 18, 160); b.fillStyle(0x5a4a36, 1).fillRect(440, 300, 18, 8); } }
      if (f.drained) help('water');
      if (f.drained && !was.drained && !initial) this.say('floor', 'the water drains. something was under it.', 2200);
    }
    if (id === 'archive') { f.dry = w('a_ink') === 'DRY'; f.apart = w('a_notes') === 'APART'; }
    if (id === 'arena' && this.fight) this.fight.setGuardWord(w('r_guard') ?? 'STRONG');
    this.toyEffects(initial);
    this.ambState();
    // wilt: solving a room after Fern's hint showed
    const solved = id === 'hub' ? f.span : id === 'corridor' ? f.lit : id === 'archive' ? f.bridge : false;
    if (solved && this.hintUsed && !s.wilted.includes(id)) { s.wilted.push(id); recomputeGrowth(s); }
    if (solved && this.hintObj) { this.hintObj.destroy(); this.hintObj = null; this.hintOn = false; }
    if (!initial) writeSave(s);
  }

  /** the archive bridge lowers (or folds back up) through its rendered frames, with a thud + dust at the end */
  animBridge(down: boolean, initial: boolean) {
    const n = ROOMART.archive?.bridge?.frames.length ?? 1, im = this.bridgeImg!; const to = down ? n - 1 : 0;
    this.bridgeTw?.stop();
    if (initial) { this.bridgeK = to; im.setTexture(`bridge_${to}`); return; }
    const o = { k: this.bridgeK };
    this.bridgeTw = this.tweens.add({ targets: o, k: to, duration: 160 * Math.abs(to - this.bridgeK) + 1, ease: down ? 'Quad.easeIn' : 'Sine.easeInOut',
      onUpdate: () => { const k = Math.round(o.k); if (k !== this.bridgeK) { this.bridgeK = k; im.setTexture(`bridge_${k}`); } },
      onComplete: () => { if (!down) return; this.cameras.main.shake(140, 0.004); sfx('hit');
        for (let i = 0; i < 10; i++) { const d = this.add.ellipse(800 + Math.random() * 60, 420 + Math.random() * 30, 22, 10, 0xb8c8cc, 0.45).setDepth(470); this.objs.push(d); this.tweens.add({ targets: d, x: d.x + (Math.random() - 0.3) * 70, y: d.y - 20 - Math.random() * 20, scaleX: 2.4, scaleY: 1.8, alpha: 0, duration: 600, onComplete: () => d.destroy() }); } } });
  }
  /** dark corridor light mask: the lit plate drawn only inside a soft, slightly flickering pool around Noor (and the caret) */
  drawLitMask() {
    if (!this.litMask || !this.litImg || !this.bg.lit) return;
    const lit = this.flags.lit; this.litImg.setVisible(!lit && this.bg.lit.alpha < 0.99); if (lit) return;
    const ctx = this.litMask.getContext(); const src = this.bg.lit.texture.getSourceImage() as HTMLImageElement;
    ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, 1280, 720); { const bx = Math.max(0, this.x - 240), by = Math.max(0, this.y - 270), bw = Math.min(1280 - bx, 480), bh = Math.min(720 - by, 480); ctx.drawImage(src, bx, by, bw, bh, bx, by, bw, bh); }
    ctx.globalCompositeOperation = 'destination-in';
    const fl = 1 + 0.03 * Math.sin(this.t * 13) + 0.02 * Math.sin(this.t * 31);
    const pools: [number, number, number, number][] = [[this.x, this.y - 30, 165 * fl, 0.95]];
    if (this.caret.visible) pools.push([this.caret.x, this.caret.y - 10, 90 * fl, 0.6]);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    const g = ctx.createRadialGradient(pools[0][0], pools[0][1], 10, pools[0][0], pools[0][1], pools[0][2]);
    g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(0.55, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
    ctx.globalCompositeOperation = 'source-over';
    if (pools[1]) { const [cx, cy, r, a] = pools[1]; const g2 = ctx.createRadialGradient(cx, cy, 4, cx, cy, r); g2.addColorStop(0, `rgba(120,228,232,${0.18 * a})`); g2.addColorStop(1, 'rgba(120,228,232,0)'); ctx.fillStyle = g2; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); }
    this.litMask.refresh();
  }

  // ---------- art-v8 linger layer: ambient loops, toys, idle lines, inspect-all, lost lines ----------
  /** rendered ambient loops (Blender frames, one strip per loop) + a few code particles where light catches dust */
  buildAmbient(id: RoomId) {
    for (const d of this.office && !this.office.legacy ? [] : ROOMART[id]?.amb ?? []) {
      if (id === 'office' && d.name === 'rain') continue; // replaced by GlassRain
      if (!this.textures.exists(d.key)) continue;
      const spr = this.add.sprite(d.x, d.y, d.key, 0).setOrigin(0).setDepth(d.baseY < 0 ? -998 : d.baseY); this.objs.push(spr);
      this.amb.push({ def: d, spr, dir: 1, speed: 1, t: Math.random() * 10, ox: d.x, oy: d.y });
    }
    const M: Partial<Record<RoomId, [Rect, number, number]>> = { office: [{ x: 760, y: 210, w: 420, h: 230 }, 16, 0xcfe0f0], corridor: [{ x: 300, y: 300, w: 140, h: 150 }, 10, 0xf6e6c8], message: [{ x: 780, y: 470, w: 200, h: 170 }, 12, 0xf6e6c8], arena: [{ x: 520, y: 260, w: 240, h: 300 }, 14, 0xf6e6c8] };
    const m = M[id];
    if (m) {
      this.moteRect = m[0]; this.moteCol = m[2]; this.motesG = this.add.graphics().setDepth(1900).setBlendMode(Phaser.BlendModes.ADD); this.objs.push(this.motesG);
      this.pivot.set(this.motesG, { x: m[0].x + m[0].w / 2, y: m[0].y + m[0].h / 2 });
      for (let i = 0; i < m[1]; i++) this.motes.push({ x: m[0].x + Math.random() * m[0].w, y: m[0].y + Math.random() * m[0].h, vx: (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 5, a: 0.15 + Math.random() * 0.25, ph: Math.random() * 6 });
    }
    if (id === 'hub') {   // the mirror copies Noor a beat late (or, with the toy, a beat early)
      this.refl = this.add.sprite(0, 0, 'noor_idle').setOrigin(96 / 192, 160 / 192).setScale(1).setTint(0xd0e4ec).setAlpha(0.88).setRotation(0).setDepth(201).setVisible(false);
      const maskG = this.add.graphics().setScrollFactor(1).setVisible(false).setDepth(-10000);
      maskG.fillStyle(0xffffff, 1).fillRect(HUB_GLASS.x, HUB_GLASS.y, HUB_GLASS.w, HUB_GLASS.h);
      this.refl.setMask(maskG.createGeometryMask());
      this.objs.push(this.refl, maskG);
    }
    const lampAt: Partial<Record<RoomId, [number, number, number, number]>> = { office: [1185, 470, 0xf6c684, 0.26], arena: [640, 420, 0x78e4e8, 0] };
    const la = lampAt[id];
    if (la) { const pool = this.add.image(la[0], la[1], 'pool').setScale(id === 'arena' ? 3.2 : 1.1, id === 'arena' ? 2.2 : 0.7).setTint(la[2]).setAlpha(la[3]).setBlendMode(Phaser.BlendModes.ADD).setDepth(-990); this.objs.push(pool); this.toyFx.pool = pool; }
    if (id === 'message') {
      const t = this.add.text(500, 196, '', { fontFamily: 'IBM Plex Mono', fontSize: '15px', fontStyle: '500', color: '#B4EEF0', backgroundColor: 'rgba(10,16,24,0.9)', padding: { x: 10, y: 5 } }).setOrigin(0.5).setDepth(-830).setAlpha(0); this.objs.push(t); this.toyFx.typing = t;
    }
  }
  /** which ambient loops show for the current plate state (corridor dark/lit, archive H/L), collected lines, toy states */
  ambState() {
    const st = this.room.id === 'corridor' ? (this.flags.lit ? 'lit' : 'dark') : this.room.id === 'archive' ? (this.flags.drained ? 'L' : 'H') : null;
    const has = (n: string, s: string) => this.amb.some(a => a.def.name === n && a.def.state === s);
    for (const a of this.amb) {
      let vis = st ? a.def.state === st || (!has(a.def.name, st) && a.def.state === this.amb.find(b => b.def.name === a.def.name)!.def.state) : true;
      if (a.def.name === 'line') { const p = this.plates.find(q => q.def.kind === 'line'); vis = vis && !!p && p.visible; }
      if (a.def.name === 'memo') vis = vis && this.plateById('a_memo')?.slotWord === 'AFLOAT';
      if (a.def.name === 'duck' && this.plateById('a_duck')?.slotWord !== 'AFLOAT' && !this.tweens.isTweening(a.spr)) vis = false;
      a.spr.setVisible(vis);
    }
  }
  toyEffects(initial: boolean) {
    const id = this.room.id, w = (pid: string) => this.plateById(pid)?.slotWord; const A = (n: string) => this.amb.filter(a => a.def.name === n);
    const dur = initial ? 0 : 700;
    if (id === 'office') {
      const happyRain = w('o_rain') === 'HAPPY'; for (const a of A('rain')) { a.speed = happyRain ? 0.5 : 1; a.spr.setTint(happyRain ? 0xffe6b8 : 0xffffff); }
      const pool = this.toyFx.pool as Phaser.GameObjects.Image; if (pool) this.tweens.add({ targets: pool, alpha: w('o_lamp') === 'SAD' ? 0.05 : 0.26, duration: dur });
      if (this.office) { this.office.toys(initial); if (initial && this.save.seen.includes('claim9')) this.office.claim(true); }
    }
    if (id === 'hub') { for (const a of A('clock')) { const fwd = w('h_clock') === 'FORWARD'; a.dir = fwd ? -1 : 1; a.speed = fwd ? 3 : 1; } }
    if (id === 'corridor') {
      const toExit = w('c_moth') === 'OUT';
      for (const a of A('moth')) { this.tweens.killTweensOf(a.spr); this.tweens.add({ targets: a.spr, x: a.ox + (toExit ? 800 : 0), y: a.oy + (toExit ? -80 : 0), duration: initial ? 0 : 2200, ease: 'Sine.easeInOut' }); }
    }
    if (id === 'archive') {
      const sunk = w('a_duck') !== 'AFLOAT';
      for (const a of A('duck')) { this.tweens.killTweensOf(a.spr); if (initial) a.spr.setY(a.oy + (sunk ? 16 : 0)).setAlpha(sunk ? 0 : 1); else { a.spr.setVisible(true); this.tweens.add({ targets: a.spr, y: a.oy + (sunk ? 16 : 0), alpha: sunk ? 0 : 1, duration: 1400, ease: 'Quad.easeIn', onComplete: () => this.ambState() }); if (sunk) this.bubbles(a.spr.x + a.def.w / 2, a.oy + a.def.h * 0.7); } }
      for (const a of A('memo')) { if (!initial && w('a_memo') === 'AFLOAT') { a.spr.setAlpha(0).setY(a.oy + 10); this.tweens.add({ targets: a.spr, alpha: 1, y: a.oy, duration: 1600 }); this.bubbles(a.spr.x + a.def.w / 2, a.oy + a.def.h / 2); } }
    }
    if (id === 'arena') {
      const coldLamp = w('r_lamp') === 'COLD', warmRim = w('r_rim') === 'WARM';
      const pool = this.toyFx.pool as Phaser.GameObjects.Image; if (pool) this.tweens.add({ targets: pool, alpha: coldLamp ? 0.22 : 0, duration: dur });
      for (const a of A('rim')) a.spr.setTint(warmRim ? 0xffc890 : 0xffffff);
    }
    if (id === 'message') {
      const t = this.toyFx.typing as Phaser.GameObjects.Text; const typing = w('m_kabir') === 'TYPING';
      if (t) this.tweens.add({ targets: t, alpha: typing ? 1 : 0, duration: dur });
    }
  }
  bubbles(x: number, y: number) {
    for (let i = 0; i < 7; i++) { const b = this.add.circle(x + (Math.random() - 0.5) * 30, y, 2 + Math.random() * 3, 0xbfe8f4, 0.6).setDepth(700); this.objs.push(b); this.tweens.add({ targets: b, y: y - 20 - Math.random() * 20, alpha: 0, delay: i * 120, duration: 700, onComplete: () => b.destroy() }); }
  }
  /** a story object was read: log it; when every one in the room is read, the room's extra code line unlocks */
  noteLooked(p: Plate) {
    const s = this.save; if (!s.looked.includes(p.def.id)) s.looked.push(p.def.id);
    const id = this.room.id, need = this.plates.filter(q => (q.def.kind === 'look' || q.def.kind === 'lore' || q.def.toy) && q.def.id !== 'o_monitor' && !q.def.hidden);
    if (!s.tutorials.includes('all:' + id) && need.every(q => s.looked.includes(q.def.id))) {
      s.tutorials.push('all:' + id); this.plateById(id + '_all')?.setVisibleState(true);
      this.time.delayedCall(900, () => this.say('floor', LINGER[id].all.say, 3200)); sfx('swap');
    }
    writeSave(s);
  }
  nearLostLine() {
    let best: Plate | null = null, bd = READ_R;
    for (const p of this.plates) {
      if (!p.visible || p.def.kind !== 'line') continue;
      const d = Math.hypot(p.def.x - this.x, p.def.y - this.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  releaseHeldPose(playIdle = true) {
    const n = this.noor;
    if (!n) return;
    n.setData('chargeReact', false);
    n.setData('poseLock', false);
    if (!playIdle) return;
    const cur = n.anims.currentAnim?.key ?? '';
    if (/shield|surprise|look|phone|shadow/.test(cur)) {
      try { n.play(`noor_idle_${this.dir}`, true); } catch { /* */ }
    }
  }
  /** Wrap text so a short last word does not sit alone on its own line. */
  balanceCardText(text: string, font: string, size: number, width: number) {
    const probe = this.add.text(-2000, -2000, '', { fontFamily: font, fontSize: `${size}px` }).setVisible(false);
    const measure = (s: string) => { probe.setText(s); return probe.width; };
    const wrap = (w: number, src: string) => {
      const parts = src.split(/(\s+)/);
      const lines: string[] = [];
      let row = '';
      for (const part of parts) {
        if (!part) continue;
        const trial = row + part;
        if (row.trim() && measure(trial) > w && part.trim()) {
          lines.push(row.replace(/\s+$/, ''));
          row = part.replace(/^\s+/, '');
        } else row = trial;
      }
      if (row) lines.push(row.replace(/\s+$/, ''));
      return lines;
    };
    const lastN = (ls: string[]) => (ls[ls.length - 1] || '').trim().split(/\s+/).filter(Boolean).length;
    const lastShort = (ls: string[]) => {
      const wds = (ls[ls.length - 1] || '').trim().split(/\s+/).filter(Boolean);
      return wds.length === 1 && wds[0].replace(/[^\w]/g, '').length <= 14;
    };
    const out: string[] = [];
    for (const para of text.split('\n')) {
      if (!para) { out.push(''); continue; }
      let lines = wrap(width, para);
      if (lines.length >= 2 && lastShort(lines)) {
        for (let dw = 6; dw <= 140; dw += 6) {
          const t2 = wrap(width - dw, para);
          if (t2.length >= 2 && lastN(t2) >= 2) { lines = t2; break; }
        }
        if (lastShort(lines)) {
          const prev = (lines[lines.length - 2] || '').trim().split(/\s+/);
          if (prev.length >= 2) {
            const moved = prev.pop() as string;
            lines[lines.length - 2] = prev.join(' ');
            lines[lines.length - 1] = `${moved} ${lines[lines.length - 1]}`;
          }
        }
      }
      out.push(lines.join('\n'));
    }
    probe.destroy();
    return out.join('\n');
  }
  setDeskFernVisible(on: boolean) {
    if (this.hubFern) this.hubFern.setVisible(on).setAlpha(on ? 1 : 0);
    if (this.hubFernGlow) this.hubFernGlow.setVisible(on).setAlpha(on ? 0.28 : 0);
  }
  worldFernCount() {
    let n = 0;
    if (this.hubFern?.visible && (this.hubFern.alpha ?? 0) > 0.15) n++;
    const h = this.dialogue?.holo;
    if (h && h.visible && (h.alpha ?? 0) > 0.15) n++;
    return n;
  }
  /** Shoulder follow point for a claimed caret. */
  private caretHome() { return { x: this.x - 46, y: this.y - 56 }; }
  private slitPos() { return this.riftWord ? this.riftWord.end() : { x: 676, y: 420 }; }
  /** Noor is close enough to the trapped Caret that E (hold) takes it. */
  caretClaimable() { if (this.caretMode !== 'trapped') return false; const p = this.slitPos(); return Math.hypot(this.x - p.x, this.y - (p.y + 40)) < 110; }
  /** Crisp I-beam (dark outline + cyan), sized to read on a cream clipboard. */
  private drawCaretMark() {
    if (!this.caretMark || !this.caretMark.active || !this.caretMark.scene) {
      this.caretMark = this.add.graphics();
      this.objs.push(this.caretMark);
    }
    const g = this.caretMark; g.clear();
    if (!this.caret || !this.caret.visible || this.caretMode === 'hidden') { g.setVisible(false); return; }
    const parked = this.caretMode === 'sent' || this.caretMode === 'travel' || this.caretMode === 'trapped';
    if (!parked && this.caretMode !== 'follow' && this.caretMode !== 'jumping') { g.setVisible(false); return; }
    // Parked cursor pulses but never vanishes — it has to read on cream paper.
    if (this.caretMode === 'sent') g.setAlpha(0.88 + 0.12 * Math.max(0, Math.sin(this.t * 8)));
    else if (this.caret.alpha <= 0.2) { g.setVisible(false); return; }
    else g.setAlpha(1);
    const x = this.caret.x, y = this.caret.y - (this.caretMode === 'follow' || this.caretMode === 'jumping' ? 8 : 14);
    g.setVisible(true).setDepth(6200);
    const big = this.caretMode === 'sent' || this.caretMode === 'travel';
    const trapped = this.caretMode === 'trapped';
    const bw = big ? 10 : trapped ? 5 : 6, bh = big ? 32 : trapped ? 16 : 20, cap = big ? 16 : trapped ? 9 : 8, o = big ? 3 : 2;
    g.fillStyle(0x000000, 1);
    g.fillRect(x - bw / 2 - o, y - bh / 2 - o, bw + o * 2, bh + o * 2);
    g.fillRect(x - cap / 2 - o, y - bh / 2 - o, cap + o * 2, 6 + o);
    g.fillRect(x - cap / 2 - o, y + bh / 2 - 6 - o, cap + o * 2, 6 + o);
    g.fillStyle(0x1afff0, 1);
    g.fillRect(x - bw / 2, y - bh / 2, bw, bh);
    g.fillRect(x - cap / 2, y - bh / 2, cap, 5);
    g.fillRect(x - cap / 2, y + bh / 2 - 5, cap, 5);
    // Hot core so it stays electric under corridor darkness.
    if (big) {
      g.fillStyle(0xe8ffff, 1);
      g.fillRect(x - Math.max(2, bw / 2 - 2), y - bh / 2 + 2, Math.max(3, bw - 4), bh - 4);
    }
  }

  setupCaretForRoom(id: string) {
    this.caretBox?.destroy(); this.caretBox = undefined;
    if (id === 'corridor' && !this.save.seen.includes('caret')) this.save.seen.push('caret');   // the Caret always leaves the hub with her
    const owned = this.save.seen.includes('caret');
    this.caretOwned = owned;
    if (id === 'hub' && !owned) { this.placeTrappedCaret(); return; }
    if (owned) {
      const h = this.caretHome();
      this.caret.setVisible(true).setAlpha(1).setScale(0.45).setPosition(h.x, h.y);
      this.caretMode = 'follow';
    } else {
      this.caret.setVisible(false);
      this.caretMode = 'hidden';
    }
  }

  /** The Caret is trapped in a text-box slit in the SHUT door until Noor gets close. */
  placeTrappedCaret() {
    const p = this.slitPos();
    this.caret.setVisible(true).setAlpha(1).setScale(0.3).setPosition(p.x, p.y + 14).setDepth(255);
    this.caretMode = 'trapped';
    this.caretOwned = false;
    this.caretHoldT = 0;
  }

  revealCaret() { this.claimCaret(); }

  /** Caret recognises Noor, jumps to her hand, and Fern names it. */
  claimCaret(force = false) {
    if (!this.caret) return;
    if (this.caretOwned && this.caretMode !== 'trapped' && !force) return;
    if (this.caretMode === 'jumping' && !force) return;
    const s = this.save;
    if (!s.seen.includes('caret')) { s.seen.push('caret'); try { writeSave(s); } catch { /* */ } }
    this.caretMode = 'jumping';
    this.caretOwned = true;
    this.caret.setVisible(true);
    if (this.caretBox) {
      const box = this.caretBox; this.caretBox = undefined;
      this.tweens.add({ targets: box, alpha: 0, duration: 280, onComplete: () => { try { box.destroy(); } catch { /* */ } } });
    }
    const h = this.caretHome();
    const start = { x: this.caret.x, y: this.caret.y };
    const mid = { x: (start.x + h.x) / 2, y: Math.min(start.y, h.y) - 40 };
    this.tweens.killTweensOf(this.caret);
    this.tweens.add({
      targets: this.caret, x: mid.x, y: mid.y, scale: 0.42, duration: 220, ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.caret, x: h.x, y: h.y, scale: 0.45, duration: 280, ease: 'Back.easeOut',
          onComplete: () => {
            this.caretMode = 'follow';
            this.say('fern', "That's your cursor. They took your words, not that.", 2600, { box: true });
            this.say('fern', 'Some things hide their words. Send it in, and you can write there.', 3000, { box: true });
          },
        });
      },
    });
  }

  /** The Caret's one job: it goes into a thing that hides its words and opens its line for writing.
   *  Level 1 has one such thing, the corridor guard (c_dummy, hidden until the Caret opens it). */
  caretSendTarget(any = false): { x: number; y: number; plate?: Plate; enemy?: Enemy } | null {
    if (!this.caretOwned || this.room?.id !== 'corridor') return null;
    const p = this.plateById('c_dummy'); const e = this.enemies.find(n => n.kind === 'dummy' && !n.dead);
    if (!p || !e || p.visible) return null;
    if (!any && Math.hypot(e.x - this.x, e.y - this.y) > 460) return null;
    return { x: e.x + 40, y: e.y - 96, plate: p, enemy: e };
  }

  /** F: the Caret flies into the guard, and the guard's hidden line types itself out under it. */
  sendCaret(to?: { x: number; y: number; plate?: Plate; enemy?: Enemy } | null) {
    if (!this.caretOwned || this.caretMode === 'trapped') return false;
    const tgt = to ?? this.caretSendTarget();
    if (!tgt || !tgt.plate || !GUARDED.includes(tgt.plate.def.id) || tgt.plate.visible) return false;   // nothing else hides its words
    this.guideCaretTo(tgt.x, tgt.y, () => {
      this.caretSendOnce = true;
      if (!this.save.tutorials.includes('caretSend')) this.save.tutorials.push('caretSend');
      this.caretMode = 'sent'; this.caretSentAt = this.t;
      this.openGuardedLine(tgt.plate!);
    });
    return true;
  }

  openGuardedLine(p: Plate) {
    this.caretWriting = p.def.id;
    if (!this.save.seen.includes('guardOpen')) this.save.seen.push('guardOpen');
    p.setVisibleState(true); this.setGuardLine(p.words.join(' '), true);
    sfx('swap'); this.cameras.main.shake(120, 0.003);
    const e = this.enemies.find(n => n.kind === 'dummy' && !n.dead);
    const fig = e?.g.getData('fig') as Phaser.GameObjects.Container | undefined; const fl = fig?.getData('flash') as Phaser.GameObjects.Rectangle | undefined;
    if (fl) { this.tweens.killTweensOf(fl); fl.setFillStyle(0x1afff0, 1).setAlpha(0.35); this.tweens.add({ targets: fl, alpha: 0, duration: 420 }); }
    if (!this.save.seen.includes('guardOpenSaid')) {
      this.save.seen.push('guardOpenSaid');
      this.say('noor', "My cursor's in it. I can see its line.", 2400, { box: true });
      this.say('fern', 'GUARD IS QUICK. The clock has STILL.', 2600, { box: true });
      this.say('fern', 'Hold E on the clock. Then F to throw STILL at it.', 2800, { box: true });
      this.clockWord?.cue();
    }
    try { writeSave(this.save); } catch { /* */ }
    this.evaluate(false);
  }

  /** Visibly move the Caret to a point, then run onArrive. */
  guideCaretTo(x: number, y: number, onArrive?: () => void) {
    if (!this.caret) return;
    this.tweens.killTweensOf(this.caret);
    this.caret.setAlpha(1).setVisible(true);
    this.caretMode = 'travel';
    const d = Math.hypot(x - this.caret.x, y - this.caret.y);
    const dur = Math.max(160, Math.min(360, d * 0.7));
    this.tweens.add({
      targets: this.caret, x, y, duration: dur, ease: 'Cubic.easeOut',
      onUpdate: () => this.caret.setDepth(3600),
      onComplete: () => { onArrive?.(); },
    });
  }

  /** Where a typed bolt should land: the Caret, sent to the target first. */
  caretBoltDest(fallback: { x: number; y: number }) {
    return fallback;   // bolts never touch the Caret: its only job is writing into guarded things
  }


  updateCaret(dt: number, held = false, control = false) {
    if (!this.caret) return;
    if (this.caretMode === 'trapped') {
      const p = this.slitPos();
      this.caret.setPosition(p.x, p.y + 14).setDepth(255);
      this.caret.setAlpha(0.25 + 0.75 * (Math.sin(this.t * 8) > 0 ? 1 : 0));
      const can = this.caretClaimable() && control && !this.busy && !this.dialogue?.busy && !this.dying && !this.transitioning && !this.holdingQuality();
      if (can && held) this.caretHoldT += dt; else this.caretHoldT = Math.max(0, this.caretHoldT - dt * 2);
      if (this.caretChip) { if (can || this.caretHoldT > 0.01) this.caretChip.show(p.x + 34, p.y - 14, 'take', this.caretHoldT / 0.4, 'E'); else this.caretChip.hide(); }
      if (this.caretHoldT >= 0.4) { this.caretHoldT = 0; this.caretChip?.hide(); this.markTut('take'); this.claimCaret(); }
      this.drawCaretMark();
      return;
    }
    if (this.caretMode === 'jumping' || this.caretMode === 'travel') {
      this.caret.setVisible(true).setDepth(this.caretMode === 'travel' ? 3600 : this.caret.y + 8);
      this.drawCaretMark();
      return;
    }
    if (!this.caret.visible) { this.drawCaretMark(); return; }
    if (this.caretMode === 'sent') {
      // Hide the pale sprite; the code-drawn I-beam is the parked cursor.
      this.caret.setDepth(3600).setAlpha(0);
      if (this.caretWriting) {   // parked in the guard's line, blinking where the next word goes
        const p = this.plateById(this.caretWriting); const e = this.enemies.find(n => n.kind === 'dummy' && !n.dead);
        if (!p || !e || this.flags.still) this.caretWriting = undefined;
        else { const q = this.guardLineEnd(); if (q) this.caret.setPosition(q.x, q.y + 8); this.caretSentAt = this.t; }
      }
      if (this.t - this.caretSentAt > 4) { this.caret.setAlpha(1); this.caretMode = 'follow'; }
      this.drawCaretMark();
      return;
    }
    if (this.caretMode === 'follow') {
      if (this.overHubVoid()) {
        this.caret.setVisible(false);
        this.drawCaretMark();
        return;
      }
      this.caret.setVisible(true).setAlpha(1);
      const h = this.caretHome();
      this.caret.x += (h.x - this.caret.x) * Math.min(1, dt * 6);
      this.caret.y += (h.y - this.caret.y) * Math.min(1, dt * 6);
      this.caret.setDepth(this.y + 1);
    }
    this.drawCaretMark();
  }
  nearPrintedLetter() {
    return !!this.explore?.printerFired && !!this.explore?.letter && Math.hypot(this.x - 168, this.y - 255) < 90;
  }
  showLetterCard() {
    if (this.lineToast) this.dismissLineToast(true);
    this.letterRead = true;
    if (!this.save.tutorials.includes('letter')) { this.save.tutorials.push('letter'); writeSave(this.save); }
    const text = 'CLAIM #4471\nSTATUS:  DENIED\n\nI UNDERSTAND. I\u2019LL HANDLE IT.\n\nCLAIM DENIED.\n\nLEAVE IT TO ME, NOOR.\n\n\u2014 Claims Desk';
    const body = this.add.text(0, 4, this.balanceCardText(text, 'IBM Plex Mono', 16, 420), {
      fontFamily: 'IBM Plex Mono', fontSize: '16px', color: '#2c261c',
      align: 'left', lineSpacing: 5,
    }).setOrigin(0.5, 0.5);
    const W = 500, H = Math.max(280, body.height + 72);
    const card = this.add.container(640, 356).setScrollFactor(0).setDepth(4300).setAlpha(0).setScale(0.97);
    const paper = this.add.graphics();
    paper.fillStyle(0x0a1218, 0.28);
    paper.fillRoundedRect(-W / 2 + 5, -H / 2 + 7, W, H, 5);
    paper.fillStyle(0xf3ead4, 0.98);
    paper.fillRoundedRect(-W / 2, -H / 2, W, H, 5);
    paper.lineStyle(1.25, 0xc4b496, 0.95);
    paper.strokeRoundedRect(-W / 2, -H / 2, W, H, 5);
    paper.fillStyle(0xe8dcc4, 1);
    paper.fillRect(-W / 2 + 1, -H / 2 + 1, W - 2, 9);
    paper.fillStyle(0xf3ead4, 1);
    paper.fillTriangle(-W / 2 + 36, -H / 2 - 1, -W / 2 + 52, -H / 2 - 1, -W / 2 + 44, -H / 2 + 8);
    paper.fillTriangle(W / 2 - 70, -H / 2 - 1, W / 2 - 52, -H / 2 - 1, W / 2 - 61, -H / 2 + 7);
    const hint = this.add.text(0, H / 2 - 14, 'E  close', {
      fontFamily: 'JetBrains Mono', fontSize: '13px', color: '#4f4638',
    }).setOrigin(0.5, 1);
    card.add([paper, body, hint]);
    this.lineToast = card;
    this.objs.push(card);
    this.tweens.add({ targets: card, alpha: 1, y: 340, scaleX: 1, scaleY: 1, duration: 280, ease: 'Cubic.easeOut' });
  }
  tryCollectNearLine() {
    const p = this.nearLostLine();
    if (!p) return false;
    this.collectLine(p);
    return true;
  }
  collectLine(p: Plate) {
    const s = this.save; const L = LINES.find(l => l.id === p.def.id);
    if (!L || s.lines.includes(L.id)) return;
    s.lines.push(L.id); writeSave(s); sfx('paste');
    if (p.scrap) this.tweens.add({ targets: p.scrap, alpha: 0, y: (p.scrap.y) - 18, duration: 520 });
    const a = this.amb.find(x => x.def.name === 'line');
    if (a) this.tweens.add({ targets: a.spr, alpha: 0, y: a.spr.y - 14, duration: 900, onComplete: () => { p.setVisibleState(false); this.ambState(); } }); else p.setVisibleState(false);
    this.showLineToast(L.text, s.lines.length);
    this.hud?.linesHud?.setText(`lines  ${s.lines.length}/${LINES.length}`);
    this.linePrompt?.hide();
    if (s.lines.length === LINES.length) this.time.delayedCall(2600, () => this.say('fern', "That's all of it. You could send it now.", 2600));
  }
  showLineToast(text: string, n: number) {
    this.dismissLineToast(true);
    const hold = Math.max(4000, text.length * 60);
    const balanced = this.balanceCardText(`“${text}”`, 'IBM Plex Mono', 18, 460);
    const quote = this.add.text(0, 0, balanced, {
      fontFamily: 'IBM Plex Mono', fontSize: '18px', color: '#2c261c',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);
    const qh = Math.min(220, quote.height);
    const W = 500, H = Math.max(132, qh + 62);
    quote.setY(2);
    const card = this.add.container(640, 356).setScrollFactor(0).setDepth(4300).setAlpha(0).setScale(0.97);
    const paper = this.add.graphics();
    paper.fillStyle(0x0a1218, 0.28);
    paper.fillRoundedRect(-W / 2 + 5, -H / 2 + 7, W, H, 5);
    paper.fillStyle(0xf3ead4, 0.98);
    paper.fillRoundedRect(-W / 2, -H / 2, W, H, 5);
    paper.lineStyle(1.25, 0xc4b496, 0.95);
    paper.strokeRoundedRect(-W / 2, -H / 2, W, H, 5);
    paper.fillStyle(0xe8dcc4, 1);
    paper.fillRect(-W / 2 + 1, -H / 2 + 1, W - 2, 9);
    // slight torn nick on the top edge
    paper.fillStyle(0x0a1218, 0);
    paper.fillStyle(0x0d1820, 0);
    paper.fillStyle(0x1a2430, 1);
    // punch a couple of tiny bites out of the top to suggest a torn edge (paper color over shadow)
    paper.fillStyle(0xf3ead4, 1);
    paper.fillTriangle(-W / 2 + 36, -H / 2 - 1, -W / 2 + 52, -H / 2 - 1, -W / 2 + 44, -H / 2 + 8);
    paper.fillTriangle(W / 2 - 70, -H / 2 - 1, W / 2 - 52, -H / 2 - 1, W / 2 - 61, -H / 2 + 7);
    const count = this.add.text(W / 2 - 14, -H / 2 + 12, `${n}/${LINES.length}`, {
      fontFamily: 'IBM Plex Mono', fontSize: '11px', color: '#8a7a62',
    }).setOrigin(1, 0);
    const hint = this.add.text(0, H / 2 - 14, 'E  close', {
      fontFamily: 'JetBrains Mono', fontSize: '13px', color: '#4f4638',
    }).setOrigin(0.5, 1);
    card.add([paper, quote, count, hint]);
    this.lineToast = card;
    this.objs.push(card);
    this.tweens.add({ targets: card, alpha: 1, y: 340, scaleX: 1, scaleY: 1, duration: 280, ease: 'Cubic.easeOut' });
    this.time.delayedCall(hold, () => { if (this.lineToast === card) this.dismissLineToast(); });
  }
  dismissLineToast(instant = false): boolean {
    const card = this.lineToast;
    if (!card) return false;
    this.lineToast = undefined;
    try { this.tweens.killTweensOf(card); } catch { /* */ }
    if (instant) { try { card.destroy(); } catch { /* */ } return true; }
    this.tweens.add({ targets: card, alpha: 0, y: card.y + 8, duration: 200, onComplete: () => { try { card.destroy(); } catch { /* */ } } });
    return true;
  }
  /** per frame: ambient frame stepping, the stand-still narrator line, the hub mirror, dust motes */
  updateLinger(dt: number, active: boolean) {
    for (const p of this.plates) {
      if (p.def.kind !== 'line' || !p.scrap || !p.visible) continue;
      p.scrap.setAlpha(0.72 + 0.28 * Math.sin(this.t * 3.1));
    }
    const aimingCaret = this.caretOwned && (this.caretMode === 'sent' || this.caretMode === 'travel' || this.atkPending || this.swingT > 0 || this.selecting);
    const near = this.hudHidden || this.busy || this.paused || this.lineToast || aimingCaret ? null : this.nearLostLine();
    if (this.linePrompt) {
      if (near) {
        const c = placeChip(near.def.sx, near.def.sy, this.x, this.y, 28, 8);
        this.linePrompt.show(c.x, c.y, 'take', 0, 'E');
      } else this.linePrompt.hide();
    }
    for (const a of this.amb) {
      if (a.def.frames <= 1 || !a.spr.visible) continue;
      a.t += dt * a.speed; const n = a.def.frames; let k = Math.floor(a.t * a.def.fps) % n; if (a.dir < 0) k = n - 1 - k;
      if (Number(a.spr.frame.name) !== k) a.spr.setFrame(k);
    }
    if (this.memoDrift()) { /* drifting memo handled inside */ }
    // stand still: in the hub, a delayed glass copy appears, then Fern speaks
    // only after the player has actually seen it. Other rooms keep the once-per-visit
    // narrator line (credited as THE ROOM).
    const calm = !this.busy && !this.cutscene && (!this.fight || this.fight.won);
    if (active || !calm || this.dying || this.composer || this.subBusy) {
      this.idleT = 0;
      if (this.room.id === 'hub' && !this.idleSaid) this.copyWarm = Math.max(0, this.copyWarm - dt * 1.4);
    } else {
      this.idleT += dt;
      if (this.room.id === 'hub') this.copyWarm = Math.min(5, this.copyWarm + dt);
    }
    const nearGlass = this.room.id === 'hub' && this.y < 320;
    const seenCopy = this.copySeen >= 1 && (this.copyWarm > 2.0 || nearGlass);
    if (this.room.id === 'hub' && !this.idleSaid && !this.clar && seenCopy && calm && !this.dialogue?.busy) {
      this.idleSaid = true;
      const v = this.save.visits[this.room.id] ?? 1;
      const tag = `${this.room.id}:${v}`;
      if (!this.save.idle.includes(tag)) { this.save.idle.push(tag); writeSave(this.save); }
      this.say('fern', v > 1 ? LINGER.hub.idle[1] : LINGER.hub.idle[0], 3400, { box: true });
    } else if (this.room.id !== 'hub' && this.idleT > 6 && !this.idleSaid && !this.clar) {
      this.idleSaid = true; const lg = LINGER[this.room.id], v = this.save.visits[this.room.id] ?? 1;
      this.say('floor', v > 1 ? lg.idle[1] : lg.idle[0], 3400);
      const tag = `${this.room.id}:${v}`; if (!this.save.idle.includes(tag)) { this.save.idle.push(tag); writeSave(this.save); }
    }
    // hub mirror: a delayed (or, after the toy, early) copy of Noor, cropped to the glass
    if (this.refl) {
      this.hist.push({ t: this.t, x: this.x, y: this.y, key: this.noor.texture.key, frame: this.noor.frame.name }); while (this.hist.length > 2 && this.hist[0].t < this.t - 0.6) this.hist.shift();
      const ahead = this.plateById('h_mirror')?.slotWord === 'BACKWARD';
      let h = this.hist[0]; for (const q of this.hist) if (q.t <= this.t - 0.4) h = q;
      let rx = h.x; if (ahead) { const o = this.hist[0]; rx = this.x + (this.x - o.x) * 0.7; }
      const flip: Record<string, string> = { S: 'N', N: 'S', SE: 'NE', NE: 'SE', SW: 'NW', NW: 'SW', E: 'E', W: 'W' };
      const fr = (ahead ? this.noor.frame.name : h.frame).replace(/_(S|SE|E|NE|N|NW|W|SW)_/, (_m, d) => `_${flip[d]}_`);
      const key = ahead ? this.noor.texture.key : h.key;
      const inGlass = this.y < 300;
      const showCopy = inGlass || this.copyWarm > 1.4;
      this.refl.setVisible(false);
      this.hubCopyBounds = null;
      if (showCopy && this.textures.get(key).has(fr)) {
        this.refl.setTexture(key, fr);
        this.refl.setRotation(0);
        this.refl.setFlipX(true);  // north-wall mirror
        const lay = layoutHubCopy(inGlass, inGlass ? rx : HUB_GLASS.x + HUB_GLASS.w / 2, true);
        this.refl.setScale(lay.sc, lay.sc);
        this.refl.setPosition(lay.rx, lay.fy);
        this.refl.setTint(0xd0e4ec);
        if (lay.crop.w >= 2 && lay.crop.h >= 2) {
          this.refl.setCrop(lay.crop.x, lay.crop.y, lay.crop.w, lay.crop.h);
          this.hubCopyBounds = lay.bounds;
          this.refl.setVisible(true);
        }
        const glow = this.copyGlintT > 0 ? 0.06 * (this.copyGlintT / 0.55) : 0;
        const a = (inGlass ? 0.88 : 0.86 + 0.08 * Math.min(1, Math.max(0, (this.copyWarm - 1.4) / 0.8))) + glow;
        this.refl.setAlpha(Math.min(0.96, a));
      }
      const vis = !!this.refl.visible && (this.refl.alpha ?? 0) > 0.4;
      if (vis) this.copySeen += dt;
      else if (!inGlass && this.copyWarm <= 0) this.copySeen = 0;
      if (vis && !this.copyWasVis) this.copyGlintT = 0.55;
      this.copyWasVis = vis;
      if (!this.copyGlint) {
        const g = this.add.graphics().setDepth(202);
        try { g.setBlendMode(Phaser.BlendModes.ADD); } catch { /* */ }
        this.copyGlint = g; this.objs.push(g);
      }
      const g = this.copyGlint;
      if (g) {
        g.clear();
        if (this.copyGlintT > 0) {
          this.copyGlintT = Math.max(0, this.copyGlintT - dt);
          const k = this.copyGlintT / 0.55;
          g.fillStyle(0xb8f0f4, 0.22 * k);
          g.fillRect(HUB_GLASS.x, HUB_GLASS.y, HUB_GLASS.w, HUB_GLASS.h);
          g.fillStyle(0xffffff, 0.14 * k);
          g.fillRect(HUB_GLASS.x, HUB_GLASS.y, HUB_GLASS.w, 8 + (HUB_GLASS.h - 12) * (1 - k));
        }
      }
    }
    if (this.motesG && this.moteRect) {
      const g = this.motesG, R = this.moteRect; g.clear();
      const on = this.room.id !== 'corridor' || this.flags.lit;
      if (on) for (const m of this.motes) {
        m.x += (m.vx + Math.sin(this.t * 0.7 + m.ph) * 4) * dt; m.y += m.vy * dt;
        if (m.y < R.y) { m.y = R.y + R.h; m.x = R.x + Math.random() * R.w; } if (m.x < R.x) m.x += R.w; if (m.x > R.x + R.w) m.x -= R.w;
        const edge = Math.min(1, (m.y - R.y) / 30, (R.y + R.h - m.y) / 30);
        g.fillStyle(this.moteCol, m.a * edge * (0.6 + 0.4 * Math.sin(this.t * 2 + m.ph))).fillCircle(m.x, m.y, 1.6);
      }
    }
  }
  memoDrift() { const a = this.amb.find(x => x.def.name === 'memo'); if (a && a.spr.visible && !this.tweens.isTweening(a.spr)) { a.spr.setX(a.ox + Math.sin(this.t * 0.4) * 8); a.spr.setY(a.oy + Math.sin(this.t * 0.9) * 2); } return !!a; }
  /** dash hair trail (art-v8): warm echoes of the hair + bun region of the current dash frame, left along the path.
   *  Readable at 640x360 (each echo ~60x30 game px) but short-lived (220 ms) so it stays tasteful. */
  hairEcho(dt: number) {
    if (this.overHubVoid()) return;
    this.hairT -= dt; if (this.hairT > 0) return; this.hairT = 0.032;
    const e = this.add.sprite(this.x, this.y, this.noor.texture.key, this.noor.frame.name).setOrigin(96 / 192, 160 / 192).setDepth(this.y - 1.5)
      .setCrop(38, 48, 116, 62).setTint(0xffb27a).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD); this.objs.push(e);
    this.tweens.add({ targets: e, alpha: 0, x: e.x - this.dashVec.x * 18, y: e.y - this.dashVec.y * 10 - 2, scaleX: 1.06, duration: 230, ease: 'Quad.easeOut', onComplete: () => e.destroy() });
  }

  // ---------- Fern hint ----------
  hintTarget(): string | null {
    const f = this.flags, h = this.hand;
    if (this.room.id === 'hub' && !f.span) return h ? 'h_rift' : 'h_lamp';
    if (this.room.id === 'corridor' && !f.lit) return h ? 'c_light' : 'c_switch';
    if (this.room.id === 'corridor' && !f.still) return !this.plateById('c_dummy')?.visible ? 'c_dummy' : h ? 'c_dummy' : 'c_clock';
    if (this.room.id === 'archive' && !f.drained) return h ? 'a_water' : 'a_drawer';
    if (this.room.id === 'archive' && !f.bridge) return h ? 'a_bridge' : 'a_stairs';
    return null;
  }
  clearHint(resetOn = true) {
    if (this.hintObj) { try { this.tweens.killTweensOf(this.hintObj.list ?? []); } catch { /* */ } try { this.hintObj.destroy(); } catch { /* */ } this.hintObj = null; }
    if (resetOn) this.hintOn = false;
  }
  updateHint(dt: number) {
    if (this.impactLab?.on) { this.clearHint(); return; }
    const target = this.hintTarget();
    if (!target || this.busy) { this.clearHint(); return; }
    this.stuck += dt;
    const st = fernStage(this.save.fernGrowth);
    if (this.stuck >= st.hintS) {
      const p = this.plateById(target);
      if (!p) return;
      if (!this.hintObj || this.hintObj.name !== target) {
        this.clearHint(false);
        p.pulse(C.fern);
        // Floor pool under the plate — no floating pin.
        const c = this.add.container(p.def.sx, p.def.sy + 8).setDepth(p.def.sy - 6);
        c.name = target;
        const glow = this.add.graphics();
        glow.fillStyle(0x7ad08a, 0.28).fillRect(-22, -6, 44, 12);
        try { glow.setBlendMode(Phaser.BlendModes.ADD); } catch { /* */ }
        c.add(glow);
        this.tweens.add({ targets: glow, alpha: { from: 0.14, to: 0.4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        if (st.name === 'Bloom' && p.slotWord) {
          c.add(this.add.text(0, 16, p.slotWord, { fontFamily: 'JetBrains Mono', fontSize: '12px', fontStyle: 'bold', color: C.fern }).setOrigin(0.5, 0).setAlpha(0.88));
        }
        this.hintObj = c; this.objs.push(c);
        this.hintPulseT = 0;
        if (!this.hintOn) this.say('fern', st.name === 'Bloom' ? `Try ${p.slotWord}.` : 'Psst. That one.', 1800);
      }
      this.hintPulseT += dt;
      if (this.hintPulseT > 2.4) { this.hintPulseT = 0; p.pulse(C.fern); }
      this.hintOn = true; this.hintUsed = true;
    } else if (this.hintOn || this.hintObj) this.clearHint();
  }

  // ---------- office composer + SC2 ----------
  openComposer() {
    // Steal office path: no typist / SC2 word-hook. Exit is the open lift.
    if (this.impactLab?.on) return;
    this.busy = true;
    this.startCutscene('sc1', 0, () => {}, () => { this.markSeen('sc1'); if (!this.save.seen.includes('sc1')) this.save.seen.push('sc1'); this.goRoom('hub'); });
    this.say('noor', 'Rephrase. Again.', 1600); this.say('noor', 'Fine. Honest version.', 1600);
    this.time.delayedCall(3300, () => {
      const ui = this.add.container(640, 640).setScrollFactor(0).setDepth(4500); this.objs.push(ui);
      const words = ['MY', 'FATHER', 'LOST', 'EVERYTHING.', 'PAY.'];
      ui.add(this.add.rectangle(0, 0, 900, 110, 0x040a10, 0.9).setStrokeStyle(1, hex(C.faint)));
      this.composer = { words, i: 0, ui };
      this.drawComposer();
    });
  }
  drawComposer() {
    const c = this.composer!; const ui = c.ui;
    ui.list.slice(1).forEach(o => o.destroy());
    let x = -420;
    ui.add(this.add.text(x, -28, '>', { fontFamily: 'JetBrains Mono', fontSize: '20px', fontStyle: 'bold', color: C.cyan }).setOrigin(0, 0.5)); x += 24;
    c.words.forEach((w, i) => {
      const typed = i < c.i, next = i === c.i;
      const t = this.add.text(x, -28, w, { fontFamily: 'JetBrains Mono', fontSize: '20px', fontStyle: 'bold', color: typed ? C.inkBright : next ? '#04121a' : C.faint, backgroundColor: next ? C.cyan : undefined, padding: { x: 4, y: 2 } }).setOrigin(0, 0.5);
      if (next) this.tweens.add({ targets: t, alpha: 0.6, duration: 300, yoyo: true, repeat: -1 });
      ui.add(t); x += t.width + 12;
    });
    const hint = this.ctl.last === 'touch' ? 'tap TYPE for each glowing key' : 'press J / click / E for each glowing key';
    ui.add(this.add.text(-420, 18, c.i < c.words.length ? hint : '\u2713 sent \u00b7 CLAIM #4471', { fontFamily: 'IBM Plex Mono', fontSize: '13px', color: c.i < c.words.length ? C.dim : C.ok }));
  }
  typeKey() {
    const c = this.composer; if (!c || c.i >= c.words.length) return;
    c.i++; this.drawComposer();
    if (c.i >= c.words.length) { if (!this.save.tutorials.includes('type')) this.save.tutorials.push('type'); this.hook(); }
  }
  hook() {
    const s = this.save; s.seen.push('sc1'); this.markSeen('sc1'); writeSave(s);
    const dim = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0).setDepth(2400); this.objs.push(dim);
    this.time.delayedCall(800, () => { this.composer?.ui.destroy(); this.tweens.add({ targets: dim, fillAlpha: 0.55, duration: 600 }); });
    this.time.delayedCall(1500, () => { this.say('ai', "I UNDERSTAND. I'LL HANDLE IT.", 1500); this.say('floor', '', 700); this.say('ai', 'LEAVE IT TO ME, NOOR.', 1600); this.say('noor', "...That's my voice.", 1800); });
    this.time.delayedCall(7200, () => {
      for (let i = 0; i < 14; i++) {
        const t = this.add.text(990, 520, '> ' + ['rephrase', 'handle_it', 'claim_4471', 'noor.voice', 'pay()', 'leave_it_to_me'][i % 6], { fontFamily: 'JetBrains Mono', fontSize: '14px', color: C.fern }).setDepth(2450).setAlpha(0.9);
        this.objs.push(t); this.tweens.add({ targets: t, x: 80 + Math.random() * 1100, y: 220 + Math.random() * 460, alpha: 0.3, duration: 900 + i * 40 });
      }
      this.cameras.main.shake(900, 0.008);
    });
    this.time.delayedCall(8300, () => { this.floorText(this.x, this.y + 30, 'FLOOR IS GONE.', C.inkBright, 22, 0); });
    this.time.delayedCall(9000, () => {
      this.cameras.main.flash(250, 255, 255, 255);
      this.tweens.add({ targets: [this.noor, this.shadow], scaleX: 0.2, scaleY: 0.2, alpha: 0, y: '+=60', duration: 500 });
    });
    this.time.delayedCall(9700, () => this.goRoom('hub'));
  }

  startCutscene(id: string, busyMs: number, start: () => void, skip: () => void) {
    this.cutscene = { id, skip: () => { this.busy = false; skip(); } };
    if (busyMs > 0) { this.busy = true; this.time.delayedCall(busyMs, () => { if (this.cutscene?.id === id) { this.busy = false; this.cutscene = null; this.markSeen(id); } }); }
    else this.time.delayedCall(16000, () => { if (this.cutscene?.id === id) { this.cutscene = null; this.markSeen(id); } });
    start();
  }
  markSeen(id: string) { if (!this.seenEver.includes(id)) { this.seenEver.push(id); try { localStorage.setItem('pi.seenEver', JSON.stringify(this.seenEver)); } catch { /* */ } } }
  inCombat() { return (this.room.id === 'arena' && !!this.fight && !this.fight.won) || (this.room.id === 'archive' && this.x > 820 && this.enemies.some(e => !e.dead)); }
  /** nearest live enemy within r (the Draft's fake copy counts: it is a valid target) */
  aimTarget(r: number) {
    let best: Enemy | null = null, bd = r;
    for (const e of this.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - this.x, e.y - this.y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  /** If Noor is embedded in a footprint (bad checkpoint / knock-in), push her to the nearest free cell so WASD can work again. */
  unstick() {
    if (this.canStand(this.x, this.y)) return false;
    for (let r = 4; r <= 96; r += 4) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const nx = this.x + Math.cos(a) * r, ny = this.y + Math.sin(a) * r;
        if (this.canStand(nx, ny)) { this.x = nx; this.y = ny; return true; }
      }
    }
    // last resort: room spawn
    const sp = this.room.spawn;
    if (this.canStand(sp.x, sp.y)) { this.x = sp.x; this.y = sp.y; return true; }
    return false;
  }
  /** move with smooth sliding: full step, else each axis, else along the blocking edge (rotated probes), so corners never stick */
  slide(dx: number, dy: number) {
    if (!dx && !dy) return;
    if (this.canStand(this.x + dx, this.y + dy)) { this.x += dx; this.y += dy; return; }
    const L = Math.hypot(dx, dy);
    if (dx && this.canStand(this.x + dx, this.y)) { this.x += dx; if (dy && this.canStand(this.x, this.y + dy * 0.3)) this.y += dy * 0.3; return; }
    if (dy && this.canStand(this.x, this.y + dy)) { this.y += dy; if (dx && this.canStand(this.x + dx * 0.3, this.y)) this.x += dx * 0.3; return; }
    for (const a of [0.5, -0.5, 1.0, -1.0, 1.35, -1.35]) {
      const c = Math.cos(a), sn = Math.sin(a), k = Math.max(0.35, Math.cos(a)); const ux = (dx * c - dy * sn) / L * L * k, uy = (dx * sn + dy * c) / L * L * k;
      if (this.canStand(this.x + ux, this.y + uy)) { this.x += ux; this.y += uy; return; }
    }
  }
  /** Once the Caret is owned, the blinking I-beam is the aim mark. No brackets, crosshair, or rings. */
  drawAim() {
    const g = this.aimG, cg = this.chargeG; if (!g || !cg) return; g.clear(); cg.clear();
    const holdAim = this.combat ? this.combat.tune.holdBeam : HOLD_T;
    const beamR = this.combat ? this.combat.tune.beamRange : BEAM_R;
    const charging = this.atkPending && this.atkHeldT > holdAim;
    if (this.caretOwned) { void charging; void beamR; void cg; return; }
    const e = this.aimTarget(charging ? beamR : AIM_R);
    if (e && !this.busy) {
      const b = (e.kind === 'note' ? 26 : 44) + 3 * Math.sin(this.t * 6), cy = e.y - (e.kind === 'note' ? 20 : e.practice ? 70 : 46), h = b * (e.practice ? 1.25 : 0.8), L = 12;
      g.lineStyle(2, hex(C.cyan), charging ? 1 : 0.75);
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const x = e.x + sx * b, y = cy + sy * h; g.lineBetween(x, y, x - sx * L, y).lineBetween(x, y, x, y - sy * L); }
      g.setDepth(e.y + 5);
    }
    void charging; void cg;
  }
  /** HOLD then RELEASE: the typed beam. Auto-aims at the nearest enemy in range; hits everything along the line. */
  fireBeam(charge: number) {
    if (this.combat) { this.combat.fireBeam(); return; }
    const tgt = this.aimTarget(BEAM_R); let v = this.dirVec();
    if (tgt) { const dx = tgt.x - this.x, dy = tgt.y - this.y, l = Math.hypot(dx, dy) || 1; v = { x: dx / l, y: dy / l }; this.dir = DIRS[(Math.round(Math.atan2(v.y, v.x) / (Math.PI / 4)) + 8) % 8]; }
    const L = tgt ? Math.min(BEAM_R, Math.hypot(tgt.x - this.x, tgt.y - this.y) + 50) : 360, x0 = this.x, y0 = this.y;
    const ox = x0 + v.x * 20, oy = y0 - 52 + v.y * 14;
    const rawTip = tgt ? { x: tgt.x, y: tgt.y - 28 } : { x: ox + v.x * L, y: oy + v.y * L };
    const tip = this.caretBoltDest(rawTip);
    const hit = this.enemies.filter(e => { if (e.dead) return false; const t = Phaser.Math.Clamp(((e.x - x0) * v.x + (e.y - y0) * v.y) / L, 0, 1); return Math.hypot(e.x - (x0 + v.x * L * t), e.y - (y0 + v.y * L * t)) < 40; });
    this.selectN++; this.beamN++; this.selectHits += hit.length; this.beamHits += hit.length;
    const dmg = 1 + charge + 0.5 * Math.max(0, hit.length - 1);
    // Damage is immediate (playtests count beamN on release). The visual winds up, then a bolt travels.
    this.swingT = 0.38; sfx('paste');
    for (const e of hit) this.hurtEnemy(e, dmg, v.x * 220, v.y * 220, true);
    if (hit.length && this.clar && hit.some(e => e.practice)) { this.markTut('o11beam'); this.clar.beamHits++; }
    if (!this.save.tutorials.includes('select')) { this.save.tutorials.push('select'); }
    playThrowAttack(this, () => {
      launchAnimatedBolt(this, { x: ox, y: oy }, tip, () => {
        if (tgt) this.fragments(tgt.x, tgt.y - 50, 'rephrase', hit.length ? C.lamp : C.cyan, 8);
      }, 240);
    }, true);
    void charge;
  }
  paste() {
    const src = this.stored!; this.stored = null; this.pasteN++; sfx('paste');
    const tgt = this.enemies.filter(e => !e.dead && e !== this.fight?.fake).sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))[0];
    const b = this.add.text(this.x, this.y - 40, `^V ${src.toUpperCase()}`, { fontFamily: 'JetBrains Mono', fontSize: '15px', fontStyle: 'bold', color: '#04121a', backgroundColor: C.cyan, padding: { x: 6, y: 3 } }).setOrigin(0.5).setDepth(3300); this.objs.push(b);
    if (!tgt) { this.tweens.add({ targets: b, alpha: 0, duration: 400 }); return; }
    this.tweens.add({ targets: b, x: tgt.x, y: tgt.y - 40, duration: 180, onComplete: () => { b.destroy(); if (this.fight && tgt === this.fight.real && this.fight.guarded) { tgt.hp -= 3; if (tgt.hp <= 0) { tgt.hp = 1; this.hurtEnemy(tgt, 4, 0, 0); } else if (!this.fight.split && tgt.hp <= DRAFT.hp / 2) this.fight.doSplit(); } else this.hurtEnemy(tgt, 3, 0, 0); } });
  }
  fernRoot() {
    if (this.rootUsed) { this.floorText(this.x, this.y - 120, 'ROOT USED', C.faint, 12, 500); return; }
    const tgt = this.enemies.filter(e => !e.dead && Math.hypot(e.x - this.x, e.y - this.y) < 300).sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))[0];
    if (!tgt) return;
    const st = fernStage(this.save.fernGrowth);
    tgt.pinT = st.rootS; this.rootUsed = this.room.id === 'arena'; this.rootN++; sfx('root');
    this.floorText(tgt.x, tgt.y - 140, `ROOTED ${st.rootS}s`, '#7ad08a', 14, 900);
  }
  goRoom(to: RoomId) {
    if (this.transitioning) return; this.stealPlay?.leaveRoom(); this.transitioning = true;
    flushPlay(this); writeSave(this.save);
    this.cameras.main.fadeOut(180, 4, 8, 12);
    this.cameras.main.once('camerafadeoutcomplete', () => { this.transitioning = false; this.buildRoom(to); });
  }

  // ---------- pause ----------
  togglePause() {
    this.paused = !this.paused;
    if (!this.paused) { this.pauseUi?.destroy(); this.pauseUi = null; this.tweens.resumeAll(); this.time.paused = false; return; }
    this.tweens.pauseAll(); this.time.paused = true;
    if (!this.save.tutorials.includes('pause')) { this.save.tutorials.push('pause'); writeSave(this.save); }
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(7000);
    c.add(this.add.rectangle(640, 360, 1280, 720, 0x04080c, 0.86).setInteractive());
    const T = (x: number, y: number, s: string, size: number, col: string, w = 500, fam = 'JetBrains Mono') => { const t = this.add.text(x, y, s, { fontFamily: fam, fontSize: `${size}px`, fontStyle: w >= 700 ? 'bold' : 'normal', color: col, lineSpacing: 6 }); c.add(t); return t; };
    T(120, 90, '~/paused', 14, C.dim); T(120, 112, this.room.title, 26, C.inkBright, 700);
    const resume = T(120, 180, '  resume', 18, C.inkBright, 700); resume.setBackgroundColor('rgba(120,228,232,0.18)').setInteractive({ useHandCursor: true }).on('pointerdown', () => this.togglePause());
    const wipe = T(120, 214, '  new game (wipe save)', 18, C.dim).setInteractive({ useHandCursor: true }); wipe.on('pointerdown', () => { wipeSave(); this.save = freshSave(); this.togglePause(); this.buildRoom('office'); });
    const rm = !!this.save.settings?.reduceMotion;
    const rmT = T(620, 180, `  reduce motion   ${rm ? 'ON' : 'OFF'}`, 18, rm ? C.inkBright : C.dim, 700).setInteractive({ useHandCursor: true });
    rmT.on('pointerdown', () => { this.setReduceMotion(!this.save.settings?.reduceMotion); this.togglePause(); this.togglePause(); });
    T(620, 206, '  camera holds still: no drift, push-ins or glitch', 12, C.faint, 400, 'IBM Plex Mono');
    T(120, 270, 'controls', 14, C.cyan, 700);
    T(120, 296, ['keyboard / mouse', '  move      WASD / arrows', '  dash      SPACE / SHIFT / K', '  read      E  (pick up a word)', '  swap      E at another plate,', '            or drag the word chip', '  type      J / left click (3-hit combo)', '  backspace attack during a dash', '  select    hold J / mouse (drag aim)', '  paste     J after a perfect dodge', '  rewrite   E a sign in combat: slow-mo', '  root      R (once per fight)', '  skip      hold X (seen cutscenes)', '  menu      ESC / P', '  debug     ?debug in URL'].join('\n'), 15, C.ink, 400, 'IBM Plex Mono');
    T(620, 296, ['touch', '  move      drag on the left half', '  dash      DASH button', '  read      READ button', '  swap      drag the word chip onto', '            a plate (or READ at it)', '  type      TYPE button', '  backspace TYPE during a dash', '  select    hold TYPE', '  paste     TYPE after a perfect dodge', '  rewrite   READ a sign in combat', '  root      ROOT button', '  skip      hold top-right', '  menu      tap "esc menu"'].join('\n'), 15, C.ink, 400, 'IBM Plex Mono');
    // art-v8 journal: the lost lines, in the order of the floor
    T(120, 548, `unsent.txt  ${this.save.lines.length}/${LINES.length}`, 14, C.lamp, 700);
    T(120, 570, LINES.map((l, i) => this.save.lines.includes(l.id) ? `  ${i + 1}  ${l.text}` : `  ${i + 1}  ${'\u2591'.repeat(18)}`).join('\n'), 13, C.ink, 400, 'IBM Plex Mono').setWordWrapWidth(980);
    T(820, 680, '"Beta, eat properly."', 13, C.faint, 400, 'IBM Plex Mono');
    this.pauseUi = c;
  }

  setReduceMotion(on: boolean) { this.save.settings = { ...(this.save.settings ?? {}), reduceMotion: on }; writeSave(this.save); }
  // ---------- main loop ----------
  update(_t: number, dms: number) {
    const dt = Math.min(dms / 1000, 0.05);
    const f: Frame = this.ctl.read();
    if (this.cutscene?.id === 'end') {
      if (f.pause || f.attack) { f.pause = false; backToTitle(this); }
      return;
    }
    if (this.intro?.playing && this.intro.handleInput(f, Math.min(dms / 1000, 0.05))) {
      f.pause = false;
      this.t += dt;
      this.noor?.setPosition(this.x, this.y).setDepth(this.y + 24);
      try { this.shadow?.setPosition(this.x, this.y + 8).setDepth(this.y - 1); } catch { /* */ }
      this.dialogue?.update(dt);
      this.glassRain?.update(Math.min(dms / 1000, 0.05));
      return;
    }
    if (f.pause && this.clar?.modal) { this.clar.closeAll(); f.pause = false; }
    // Esc skips a running cutscene (intro included). During play it still opens the menu.
    if (f.pause && this.cutscene && this.cutscene.id !== 'end' && !this.dying) {
      this.cutscene.skip();
      f.pause = false;
    }
    if (f.pause && !this.dying) this.togglePause();
    if (this.paused) return;
    if (!this.labMode) {
      this.playAcc += dms;
      if (this.playAcc > 8000) { flushPlay(this); writeSave(this.save); }
    }
    this.t += dt;
    this.dialogue?.update(dt);
    this.maybeGapReveal();
    this.updateChasmParallax();
    this.glassRain?.update(dt);
    this.dashCd = Math.max(0, this.dashCd - dt); this.iframes = Math.max(0, this.iframes - dt); this.comboT -= dt; this.swingT -= dt; this.sinceDash += dt;

    // cutscene skip: hold X (or hold the top-right of the screen) after the first viewing
    if (this.cutscene && this.seenEver.includes(this.cutscene.id)) {
      this.skipHold = f.skipHeld ? this.skipHold + dt : 0;
      this.hud.skip.setVisible(true).setText(this.ctl.last === 'touch' ? `hold here to skip ${'>'.repeat(Math.ceil(this.skipHold / 0.15))}` : `hold X to skip ${'>'.repeat(Math.ceil(this.skipHold / 0.15))}`);
      if (this.skipHold >= 0.6) { const c = this.cutscene; this.cutscene = null; this.skipHold = 0; c.skip(); }
    } else this.hud.skip.setVisible(false);
    // REWRITE bullet time: ~2 s real time while a word is held in combat
    if (this.rewriteT > 0) { this.rewriteT -= dt; if (!this.hand) this.rewriteT = 0; }
    // art-v10: a picked-up word does not linger: it drops back when Noor walks away from it or after a while unused
    if (this.hand && !this.inCombat() && this.room.id !== 'arena') {
      this.handT += dt; const src = this.plateById(this.hand.from);
      if (this.handT > 12 || (src && Math.hypot(src.def.sx - this.x, src.def.sy - this.y) > 420)) { src?.setOpts({ ...src.opts, selected: false }); this.hand = null; }
    } else this.handT = 0;
    this.timeScale = this.rewriteT > 0 || (this.words.codeOn && this.inCombat()) ? 0.25 : 1;
    this.slowVeil?.setVisible(this.timeScale < 1);
    let edt = dt * this.timeScale;
    if (this.hitStopT > 0) { this.hitStopT -= dt; edt = 0; if (this.hitStopT <= 0) this.noor.anims.resume(); }
    this.selectCd -= dt;
    if (this.composer && (f.attack || f.interact)) this.typeKey();
    if (this.clar?.modal && f.interact && !this.stealOn()) { this.clar.interact(); f.interact = false; }
    // E / READ advances dialogue (and closes a letter card) even during cutscenes.
    // Consume the press so it cannot also inspect, steal, or take a word underneath.
    if (f.interact && !this.composer && !this.clar?.modal) {
      if (this.dialogue?.busy) { this.dialogue.advance(); f.interact = false; }
      else if (this.lineToast) { this.dismissLineToast(); f.interact = false; }
    }
    const control = !this.busy && !this.dying && !this.transitioning && !this.clar?.modal;
    let mx = control ? f.mx : 0, my = control ? f.my : 0;
    if (control && f.dash && this.dashCd <= 0 && this.dashT <= 0) {
      const v = Math.hypot(mx, my) > 0.1 ? { x: mx, y: my } : this.dirVec();
      const l = Math.hypot(v.x, v.y) || 1; this.dashVec = { x: v.x / l, y: v.y / l };
      this.dashT = DASH_T; this.dashCd = DASH_CD; this.iframes = Math.max(this.iframes, DASH_T + 0.06);
      this.dir = DIRS[(Math.round(Math.atan2(this.dashVec.y, this.dashVec.x) / (Math.PI / 4)) + 8) % 8];
      this.noor.play(`noor_dash_${this.dir}`, true); this.dashKick(); this.trailT = 0;
    }
    if (control && f.dash && this.dashT === DASH_T) { this.dashStartAt = this.t; this.didDash = true; sfx('dash'); }
    // art-v11 attack input (global): TAP = the 3-hit combo, HOLD then RELEASE = the typed beam. Both auto-aim.
    // combat greybox: longer hold for short-range beam; attack while carrying a word = throw.
    const holdT = this.combat ? this.combat.tune.holdBeam : HOLD_T;
    if (control && f.attack) {
      if (this.stored) this.paste();
      else if (this.dashT > 0 || this.sinceDash < 0.15) this.backspace();
      else if (this.combat?.preferThrow()) { this.combat.tryThrow(); }
      else { this.atkPending = true; this.atkHeldT = 0; }
    }
    if (this.atkPending) {
      if (control && f.attackHeld) {
        this.atkHeldT += dt; this.selecting = this.atkHeldT > holdT;
        if (this.selecting) playChargeHold(this);
      }
      else {
        if (control && this.atkHeldT <= holdT) this.typeAttack();
        else if (control && this.atkHeldT >= holdT) this.fireBeam(Math.min(1, (this.atkHeldT - holdT) / Math.max(0.01, holdT)));
        this.atkPending = false; this.atkHeldT = 0; this.selecting = false;
      }
    }
    if (control && f.root) this.fernRoot();
    this.drawAim();
    let vx = mx * WALK, vy = my * WALK;
    if (this.swingT > 0 || this.selecting) { vx *= 0.35; vy *= 0.35; }
    if (this.dashT > 0) { this.dashTrail(dt); this.hairEcho(dt); this.dashT -= dt; vx = this.dashVec.x * DASH_SPEED; vy = this.dashVec.y * DASH_SPEED; if (this.dashT <= 0) this.sinceDash = 0; }
    if (this.bsT > 0) { this.bsT -= dt; for (const e of this.enemies) if (!e.dead && !this.bsHit.has(e) && Math.hypot(e.x - this.x, e.y - this.y) < 70) { this.bsHit.add(e); const a = Math.atan2(e.y - this.y, e.x - this.x); this.hurtEnemy(e, 1, Math.cos(a) * 520, Math.sin(a) * 520); } }
    if (!this.dying) this.unstick();
    const ox = this.x, oy = this.y;
    if (!this.dying) {
      this.slide(vx * dt, vy * dt);
    }
    this.moved += Math.hypot(this.x - ox, this.y - oy);
    if (!this.dying && this.dashT <= 0 && !this.onHubSpan(this.x, this.y) && this.hazards.some(h => inR(h, this.x, this.y))) {
      this.tweens.add({ targets: this.noor, scaleX: 0.3, scaleY: 0.3, alpha: 0, duration: 200 }); this.die();
    }
    // facing + animation
    if (Math.hypot(mx, my) > 0.1 && this.swingT <= 0) this.dir = DIRS[(Math.round(Math.atan2(my, mx) / (Math.PI / 4)) + 8) % 8];
    const moving = Math.hypot(this.x - ox, this.y - oy) > 0.5;
    setAmbienceDuck(!!this.dialogue?.busy || !!this.busy || !!this.cutscene || this.paused);
    updateAmbience({ room: this.room?.id, x: this.x, y: this.y, moving, dt });
    const steering = Math.hypot(mx, my) > 0.1;
    const cur = this.noor.anims.currentAnim?.key ?? '';
    const winding = !!this.noor.getData('windOn');
    // Combat loops hold only while they are still playing. Reaction poses
    // (shield / surprise / look) hold while still AND locked; movement always wins.
    // Wind-up keeps its last frame only while the throw wind-up is actually on.
    const combatHold = /^noor_(attack|dash|type|combo|peel|throw|release|charge)/.test(cur) && this.noor.anims.isPlaying;
    const windHold = winding && /windup/.test(cur) && !steering;
    const reactKey = /^noor_(phone|shadow|surprise|look|shield)/.test(cur);
    const locked = !!this.noor.getData('poseLock') || !!this.noor.getData('chargeReact');
    const reactHold = reactKey && !steering && (locked || this.noor.anims.isPlaying);
    const held = combatHold || windHold || reactHold;
    if (steering && reactKey) this.releaseHeldPose(false);
    if (!held) {
      let want = `noor_${(moving || steering) && this.dashT <= 0 ? 'walk' : 'idle'}_${this.dir}`;
      const fi = this.noor.anims.currentFrame?.index ?? 1, nf = this.noor.anims.currentAnim?.frames.length ?? 1;
      // art-v10: stopping finishes the step to the next planted-feet frame (0 or n/2) instead of popping to idle mid-stride
      if (!moving && !steering && cur.startsWith('noor_walk_') && !held) {
        this.stopT += dt; const planted = fi === 1 || fi === 1 + Math.floor(nf / 2);
        if (!planted && this.stopT < 0.22) want = cur;
      } else this.stopT = 0;
      if (cur !== want) {
        // a change of facing mid-walk keeps the stride phase (no restart, no foot pop)
        if (cur.startsWith('noor_walk_') && want.startsWith('noor_walk_')) this.noor.play({ key: want, startFrame: fi - 1 }, false);
        else this.noor.play(want, true);
      }
      // feet stay planted: the cycle rate follows the actual ground speed (stride calibrated in pack10.py)
      if (want.startsWith('noor_walk_')) { const sp = Math.hypot(this.x - ox, this.y - oy) / Math.max(dt, 1e-3); this.noor.anims.timeScale = moving ? Phaser.Math.Clamp(sp / WALK, 0.3, 1.3) : 0.8; }
      else this.noor.anims.timeScale = 1;
    }
    const breathe = !this.dying && (this.noor.anims.currentAnim?.key ?? '').startsWith('noor_idle_') && !this.tweens.isTweening(this.noor);
    if (breathe) { const b = Math.sin(this.t * 2.1); this.noor.setScale(1 - 0.004 * b, 1 + 0.013 * b); } else if (!this.dying && !this.tweens.isTweening(this.noor) && this.noor.scaleY !== 1) this.noor.setScale(1);
    this.syncPitCrop(); this.noor.setPosition(this.x, this.y).setDepth(this.noorSortDepth()).setAlpha(this.dying ? this.noor.alpha : this.iframes > 0 && this.dashT <= 0 ? 0.6 + 0.4 * Math.sin(this.t * 40) : 1);
    tickWindupFx(this);
    this.shadow.setPosition(this.x, this.y + 2).setDepth(this.y - 2);
    this.updateCaret(dt, !!f.interactHeld, !!control);
    this.riftWord?.update(); this.hubLamp?.update(); this.clockWord?.update();
    // Only consume F when the Caret is owned AND a send target is in range.
    // JustDown is per-Key and shared with ImpactLab / StealPlay / OfficeExplore,
    // so calling it earlier used to swallow the Level 1 spark throw.
    if (this.caretKeyF && this.caretOwned && !this.hand && !this.stealPlay?.held
        && !this.impactLab?.carrying && !this.explore?.carrying && !this.composer && control) {
      const sendTo = this.caretSendTarget();
      if (sendTo && Phaser.Input.Keyboard.JustDown(this.caretKeyF)) this.sendCaret(sendTo);
    }
    // First sight of the guard: the Caret's job, said once, in one line each, by a named speaker.
    if (this.room?.id === 'corridor' && control && this.x > 840 && !this.save.seen.includes('guardIntro') && this.caretSendTarget()) {
      this.save.seen.push('guardIntro');
      this.say('fern', 'That guard blocks the exit. It hides its words.', 2600, { box: true });
      this.say('fern', 'Press F. Send your cursor in.', 2200, { box: true });
    }
    this.darkness?.setPosition(this.x, this.y - 30);

    if (control && f.interact && !this.composer) {
      if (this.dismissLineToast()) { /* reading-time toast or letter card ate E */ }
      else if (this.nearPrintedLetter()) this.showLetterCard();
      else if (this.tryCollectNearLine()) { /* lost-line E wins over lookables and the lamp */ }
      else if (this.stealOn()) this.explore?.tryTap();
      else this.interact();
    }
    this.words.update(dt, this.stealOn() ? false : f.interactHeld);
    this.drawLitMask();
    this.updateLinger(dt, Math.hypot(this.x - ox, this.y - oy) > 0.5 || Math.hypot(mx, my) > 0.1 || f.interactHeld);
    this.clar?.update(dt, moving || Math.hypot(mx, my) > 0.1);
    this.combat?.update(dt);
    this.impactLab?.update(dt, f);
    this.explore?.update(dt, f);
    this.stealPlay?.update(dt);
    if (this.office) {
      this.office.update(dt, moving || Math.hypot(mx, my) > 0.1, mx, my, control && f.interact);
      if (this.words.codeA > 0.5 && this.words.codeLines.some(l => l.plate.def.id === 'o_monitor')) this.office.claim(false);
    }
    if (this.birth?.playing) this.birth.t += dt;
    if (this.room.id === 'archive' && this.x > 820 && !this.save.seen.includes('wetHint') && this.enemies.some(e => e.kind === 'scribble' && !e.dead) && !this.busy) {
      this.save.seen.push('wetHint'); writeSave(this.save);
      this.say('fern', 'The cooler. Wet paper forgets how to hold a shape.', 2800);
    }
    this.updateEnemies(edt);

    this.fight?.update(dt, edt);
    if (this.room.exit && control && inR(this.room.exit.rect, this.x, this.y)) this.goRoom(this.room.exit.to);
    this.updateHint(dt);
    this.updatePrompts();
    this.updateHud();
  }
  dirVec() { const i = DIRS.indexOf(this.dir); const a = i * Math.PI / 4; return { x: Math.cos(a), y: Math.sin(a) }; }

  typeAttack() {
    if (this.swingT > 0) return;
    if (this.enemies.some(e => !e.dead && (e.kind !== 'dummy' || this.flags.still))) this.didAttack = true;
    this.combo = this.comboT > 0 ? (this.combo % 3) + 1 : 1;
    const hit = this.combo; this.comboT = 0.55; this.swingT = hit === 3 ? 0.32 : 0.22;
    // art-v11: auto-aim at the nearest enemy in range (turn to it, small step in if it is just out of reach)
    const tg = this.aimTarget(AIM_R); let v = this.dirVec();
    if (tg) { const dx = tg.x - this.x, dy = tg.y - this.y, l = Math.hypot(dx, dy) || 1; v = { x: dx / l, y: dy / l }; this.dir = DIRS[(Math.round(Math.atan2(v.y, v.x) / (Math.PI / 4)) + 8) % 8]; if (l > 74) this.slide(v.x * Math.min(26, l - 70), v.y * Math.min(26, l - 70)); }
    // Short forward lunge + squash/stretch pose per hit (heavier on the cleave).
    const lunge = hit === 3 ? 22 : 11;
    this.slide(v.x * lunge, v.y * lunge);
    const sx0 = this.noor.scaleX, sy0 = this.noor.scaleY;
    try {
      this.noor.setScale(sx0 * (hit === 3 ? 1.05 : 1.02), sy0 * (hit === 3 ? 1.12 : 0.92));
      this.tweens.add({ targets: this.noor, scaleX: sx0, scaleY: sy0, duration: hit === 3 ? 150 : 90, ease: 'Quad.easeOut' });
    } catch { /* */ }
    if (this.combat?.usingSheets) this.noor.play(`noor_combo${hit}_${this.dir}`, true);
    else this.noor.play(`noor_type${hit}_${this.dir}`, true);
    try { sfx('impact_whoosh', hit === 3 ? 0.95 : 0.75); } catch { /* */ }
    const a0 = Math.atan2(v.y, v.x);
    // Arcs start immediately so mid-swing is visible; damage + sparks land on contact later.
    if (hit === 1) this.fxCleave(a0, { smear: true });
    else if (hit === 2) this.fxCleave(a0, { reverse: true });
    else this.fxCleave(a0, { heavy: true, glyphs: true });
    const at = hit === 3 ? 90 : 55;
    this.time.delayedCall(at, () => {
      const struck: Enemy[] = [];
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy);
        let da = Math.abs(Math.atan2(dy, dx) - a0); if (da > Math.PI) da = 2 * Math.PI - da;
        if (d < 92 && (da < 1.3 || d < 30)) { struck.push(e); this.hurtEnemy(e, hit === 3 ? 2 : 1, v.x * 140, v.y * 140, hit === 3); }
      }
      if (struck.some(e => e.practice) && this.clar) { this.clar.comboHits++; this.comboHits++; if (hit === 3) this.markTut('o11combo'); }
      if (!struck.length) return;
      // Sparks and hit-stop only on contact. Light hits: no zoom, no full-screen flash (ImpactFX light tier).
      this.combat?.onComboHit(hit);
      const d = struck.find(e => e.practice) ?? struck[0];
      if (this.impactLab) {
        const spr = d.g.list.find(o => (o as Phaser.GameObjects.Image).texture) as Phaser.GameObjects.Image | undefined;
        this.impactLab.onDummyHit(d.x, d.y - 40, hit, spr);
      } else {
        const stops = this.combat?.tune.hitStop ?? [0.05, 0.06, 0.09];
        this.hitStopT = stops[hit - 1] ?? 0.05; this.noor.anims.pause();
        // Light hits: a tiny shake only. No zoom, no flash.
        this.cameras.main.shake(hit === 3 ? 110 : 40, hit === 3 ? 0.006 : 0.0015);
      }
    });
  }
  /** glyph text helper (JetBrains Mono) */
  glyph(x: number, y: number, ch: string, col: string, size = 18, depth = this.y + 3) {
    const t = this.add.text(x, y, ch, { fontFamily: 'JetBrains Mono', fontSize: `${size}px`, fontStyle: 'bold', color: col }).setOrigin(0.5).setDepth(depth); this.objs.push(t); return t;
  }
  fragments(x: number, y: number, chars: string, col: string, n = 6) {
    for (let i = 0; i < n; i++) {
      const t = this.glyph(x, y, chars[i % chars.length], col, 12 + (i % 3) * 3); const a = Math.random() * Math.PI * 2, r = 26 + Math.random() * 30;
      this.tweens.add({ targets: t, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.7 - 8, angle: (Math.random() - 0.5) * 220, alpha: 0, duration: 300 + Math.random() * 120, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
    }
  }
  /** Three-hit melee crescent. Tips taper, bright leading edge, ~120ms fade. No arrow, no straight beam. */
  fxCleave(a0: number, opts: { reverse?: boolean; heavy?: boolean; smear?: boolean; glyphs?: boolean }) {
    const heavy = !!opts.heavy;
    const back = !!opts.reverse;
    const nx = -Math.sin(a0), ny = Math.cos(a0);
    let ccw: number, aBase: number, span: number, R0: number, R1: number, midW: number, sx: number, sy: number, cx: number, cy: number;
    if (heavy) {
      // Overhead cleave: high pivot, wide downward sweep, thick blade, short lunge already applied.
      ccw = 1; aBase = a0 - 0.2; span = 3.15; R0 = 22; R1 = 132; midW = 22;
      sx = 1; sy = 0.92;
      cx = this.x + Math.cos(a0) * 10; cy = this.y - 54;
    } else if (back) {
      // Reverse / backhand: mirrored crescent on the opposite side of the body.
      ccw = -1; aBase = a0 + 0.55; span = 2.35; R0 = 38; R1 = 100; midW = 13;
      sx = 1; sy = 0.74;
      cx = this.x + nx * 16; cy = this.y - 30;
    } else {
      // Forehand: quick crescent out in front, with a smear trail.
      ccw = 1; aBase = a0 - 0.35; span = 2.2; R0 = 40; R1 = 98; midW = 13;
      sx = 1; sy = 0.70;
      cx = this.x - nx * 14; cy = this.y - 36;
    }
    const midR = (R0 + R1) / 2;
    const g = this.add.graphics().setDepth(this.y + 6).setBlendMode(Phaser.BlendModes.ADD);
    this.objs.push(g);
    const smear = opts.smear ? this.add.graphics().setDepth(this.y + 5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55) : null;
    if (smear) this.objs.push(smear);

    const pt = (ang: number, r: number) => [cx + Math.cos(ang) * r * sx, cy + Math.sin(ang) * r * sy] as const;
    const taper = (u: number) => Math.sin(Math.PI * Math.max(0.02, Math.min(0.98, u)));

    const ribbon = (gfx: Phaser.GameObjects.Graphics, k: number, alpha: number) => {
      gfx.clear();
      const start = -span / 2;
      const end = start + span * Math.max(0.02, Math.min(1, k));
      const steps = heavy ? 26 : 18;
      for (let i = 0; i < steps; i++) {
        const u0 = i / steps, u1 = (i + 1) / steps;
        const t0 = start + (end - start) * u0;
        const t1 = start + (end - start) * u1;
        const w0 = midW * taper((t0 - start) / span), w1 = midW * taper((t1 - start) / span);
        const A = aBase + ccw * t0, B = aBase + ccw * t1;
        const [ia, iay] = pt(A, midR - w0 * 0.5);
        const [oa, oay] = pt(A, midR + w0 * 0.5);
        const [ib, iby] = pt(B, midR - w1 * 0.5);
        const [ob, oby] = pt(B, midR + w1 * 0.5);
        // Soft body, then a tighter brighter core so the blade reads on a dark floor.
        gfx.fillStyle(heavy ? 0xb8fff8 : 0x6ef0e8, 0.55 * alpha).fillTriangle(ia, iay, oa, oay, ob, oby).fillTriangle(ia, iay, ob, oby, ib, iby);
        const [cia, ciay] = pt(A, midR - w0 * 0.18);
        const [coa, coay] = pt(A, midR + w0 * 0.18);
        const [cib, ciby] = pt(B, midR - w1 * 0.18);
        const [cob, coby] = pt(B, midR + w1 * 0.18);
        gfx.fillStyle(0xe8fffc, 0.4 * alpha).fillTriangle(cia, ciay, coa, coay, cob, coby).fillTriangle(cia, ciay, cob, coby, cib, ciby);
      }
      gfx.lineStyle(heavy ? 5 : 2.6, 0xffffff, 0.98 * alpha);
      gfx.beginPath();
      const segs = 24;
      for (let i = 0; i <= segs; i++) {
        const t = start + (end - start) * i / segs;
        const w = midW * taper((t - start) / span);
        const [x, y] = pt(aBase + ccw * t, midR + w * 0.5);
        if (i === 0) gfx.moveTo(x, y); else gfx.lineTo(x, y);
      }
      gfx.strokePath();
      const wEnd = midW * taper(Math.min(0.98, k));
      const [ex, ey] = pt(aBase + ccw * end, midR + wEnd * 0.5);
      gfx.fillStyle(0xffffff, 0.9 * alpha).fillCircle(ex, ey, heavy ? 4.5 : 2.6);
    };

    const o = { k: 0 };
    const sweepMs = heavy ? 110 : 75;
    this.tweens.add({
      targets: o, k: 1, duration: sweepMs, ease: heavy ? 'Quad.easeOut' : 'Sine.easeOut',
      onUpdate: () => {
        ribbon(g, o.k, 1);
        if (smear) ribbon(smear, Math.max(0.02, o.k - 0.28), 0.55);
      },
      onComplete: () => {
        const fadeTargets = smear ? [g, smear] : [g];
        this.tweens.add({ targets: fadeTargets, alpha: 0, duration: 120, onComplete: () => { g.destroy(); smear?.destroy(); } });
      },
    });

    // Finisher only: a short glyph burst along the arc, not a laser / typed beam.
    if (opts.glyphs) {
      const burst = '};>#/';
      for (let i = 0; i < 5; i++) {
        const u = 0.28 + i * 0.13;
        const t = -span / 2 + span * u;
        const [x, y] = pt(aBase + ccw * t, midR);
        const ch = this.glyph(x, y, burst[i % burst.length], '#e8fcfc', heavy ? 16 : 13, this.y + 7).setAlpha(0);
        this.tweens.add({
          targets: ch, alpha: { from: 0, to: 0.95 }, delay: 24 + i * 16, duration: 50,
          onComplete: () => this.tweens.add({ targets: ch, alpha: 0, y: ch.y - 10, duration: 140, onComplete: () => ch.destroy() }),
        });
      }
    }
  }
    /** dash start: a puff of dust + a few paper scraps kicked back from the feet */
  dashKick() {
    const bx = this.x - this.dashVec.x * 10, by = this.y;
    for (let i = 0; i < 5; i++) {
      const d = this.add.ellipse(bx + (Math.random() - 0.5) * 18, by + (Math.random() - 0.5) * 6, 22, 10, 0xb8c8cc, 0.5).setDepth(this.y - 1); this.objs.push(d);
      this.tweens.add({ targets: d, x: d.x - this.dashVec.x * (20 + Math.random() * 26), y: d.y - this.dashVec.y * 12 - 4, scaleX: 2.2, scaleY: 1.6, alpha: 0, duration: 360, onComplete: () => d.destroy() });
    }
    for (let i = 0; i < 4; i++) {
      const p = this.add.rectangle(bx, by - 4, 10, 7, 0xe8e4da, 1).setDepth(this.y + 1).setAngle(Math.random() * 90); this.objs.push(p);
      const a = Math.atan2(-this.dashVec.y, -this.dashVec.x) + (Math.random() - 0.5) * 1.6, r = 30 + Math.random() * 34;
      this.tweens.add({ targets: p, x: bx + Math.cos(a) * r, y: by - 14 - Math.random() * 18 + Math.sin(a) * r * 0.5, angle: p.angle + 260, alpha: 0, duration: 480, ease: 'Quad.easeOut', onComplete: () => p.destroy() });
    }
  }
  /** keystroke trail: teal caret / text glyphs left behind along the dash path, fading (not a ghost copy) */
  dashTrail(dt: number) {
    this.trailT -= dt; if (this.trailT > 0) return; this.trailT = 0.022;
    const G = '|_>;{}/*#'; const ch = Math.random() < 0.35 ? '|' : G[(Math.random() * G.length) | 0];
    const over = this.overHubVoid();
    const gy = over ? Math.max(HUB_NY + 10, this.y - 8) : this.y - 26 - Math.random() * 30;
    const t = this.glyph(this.x - this.dashVec.x * 14 + (Math.random() - 0.5) * 8, gy, ch, Math.random() < 0.25 ? C.inkBright : C.cyan, 18 + ((Math.random() * 8) | 0), over ? -940 : this.y - 1);
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, y: t.y - 6, duration: 380, onComplete: () => t.destroy() });
  }
  backspace() {
    if (this.bsT > 0) return;
    this.bsT = 0.22; this.bsHit.clear(); this.dashT = Math.max(this.dashT, 0.08);
    const fx = this.add.graphics().setDepth(this.y + 2); this.objs.push(fx);
    fx.lineStyle(6, hex(C.coral), 0.8).lineBetween(this.x - this.dashVec.x * 60, this.y - 30 - this.dashVec.y * 60, this.x + this.dashVec.x * 100, this.y - 30 + this.dashVec.y * 100);
    this.tweens.add({ targets: fx, alpha: 0, duration: 220, onComplete: () => fx.destroy() });
  }

  // ---------- test hooks (only with ?test) ----------
  getTestState() {
    return {
      screen: 'game', state: this.paused ? 'paused' : this.busy ? 'cutscene' : 'play', room: this.room.id, player: { x: this.x, y: this.y }, hp: this.hp, talking: !!this.dialogue?.busy,
      dialogueProg: this.dialogue ? this.dialogue.progress() : null,
      dialogueBoxes: this.dialogue?.boxCount() ?? 0,
      gapPan: this.gapPan, ambience: getAmbienceId(), ambDuck: getAmbienceDucked(), ambErrors: getAmbienceErrors(), camMid: { x: this.cameras.main.midPoint.x, y: this.cameras.main.midPoint.y, scrollY: this.cameras.main.scrollY, zoom: this.cameras.main.zoom },
      introMail: !!this.intro?.mailOpen?.(),
      introCursor: this.intro?.cursorState?.() ?? null,
      caretChip: this.caretChip ? { visible: this.caretChip.isShown(), key: this.caretChip.currentKey(), verb: this.caretChip.currentVerb() } : null,
      caret: { mode: this.caretMode, owned: this.caretOwned, x: this.caret?.x ?? 0, y: this.caret?.y ?? 0, visible: !!this.caret?.visible, writing: this.caretWriting ?? null },
      dashCd: this.dashCd, dashing: this.dashT > 0, iframes: this.iframes, dying: this.dying, undoShown: this.undoShown, lastRespawnMs: this.lastRespawnMs,
      caption: this.words.segs.map(q => q.full).join(''), heading: this.words.heading.text, chips: this.words.chipPositions(), handChip: { x: this.hud.hand.x, y: this.hud.hand.y },
      codeView: this.words.codeA > 0.5, codeLines: this.words.codeLines.map(l => l.objs.map(t => t.text).join('')), noorLine: this.words.codeA > 0.5 ? this.words.noorLine?.text : null, lens: this.words.lensA > 0.5 && !!this.words.secret, secretText: (this.words.secretText?.alpha ?? 0) > 0.5 ? this.words.secretText!.text : null, secrets: this.words.secretsFound(),
      hand: this.hand, flags: { ...this.flags }, steal: this.stealPlay ? this.stealPlay.state() : null, lureChip: this.stealPlay?.lure?.chipState() ?? null, liftDone: !!this.impactLab?.done, doorOpen: !!this.clar?.doorOpen, lab: this.impactLab ? this.impactLab.state() : null, explore: this.explore ? this.explore.state() : null,
      cam: { x: this.cameras.main.x, y: this.cameras.main.y, w: this.cameras.main.width, h: this.cameras.main.height, zoom: this.cameras.main.zoom, bottom: Math.min(this.cameras.main.y + this.cameras.main.height, this.vm ? 9999 : this.toScreen(640, 720).y), barY: BAR_Y },
      office9: this.office ? this.office.state() : null, clar: this.clar ? this.clar.state() : null, combat: this.combat ? this.combat.state() : null, beamN: this.beamN, beamHits: this.beamHits, attackPending: this.atkPending, sub: this.hud.sub.visible ? this.hud.sub.text : '', captionRows: this.words.rowInfo(),
      amb: this.amb.map(a => ({ name: a.def.name, w: a.def.w, h: a.def.h, state: a.def.state, visible: a.spr.visible, frame: Number(a.spr.frame.name), frames: a.def.frames, dir: a.dir })),
      glassRain: this.glassRain ? { on: true, drops: this.glassRain.drops.length, paused: this.glassRain.paused, flash: this.glassRain.flash } : null,

      looks: this.plates.filter(p => p.def.kind === 'look' || p.def.toy).map(p => p.def.id), lineIds: this.plates.filter(p => p.def.kind === 'line').map(p => ({ id: p.def.id, visible: p.visible })), linesHud: this.hud?.linesHud?.visible ? this.hud.linesHud.text : '',
      ghostTex: this.words.ghost?.texture.key ?? null, idleT: this.idleT, copyWarm: this.copyWarm, copySeen: this.copySeen, idleSaid: this.idleSaid, fernCount: this.worldFernCount(), dialogueBox: this.dialogue?.boxBounds?.() ?? null, refl: this.refl ? (() => {
        const b = this.hubCopyBounds, g = HUB_GLASS, slop = 1.5;
        const inside = !!(b && b.x >= g.x - slop && b.y >= g.y - slop && b.x + b.w <= g.x + g.w + slop && b.y + b.h <= g.y + g.h + slop);
        return { visible: this.refl.visible, x: this.refl.x, y: this.refl.y, a: this.refl.alpha, sx: this.refl.scaleX, sy: this.refl.scaleY, rot: this.refl.rotation, flipX: this.refl.flipX, bounds: b, pane: g, inside };
      })() : null,
      corridorBars: this.children.list.some(o => o.name === 'pathbars'), plates: Object.fromEntries(this.plates.map(p => [p.def.id, { words: p.words.join(' '), visible: p.visible, focused: p.focused }])),
      enemies: this.enemies.map(e => ({ kind: e.kind, x: e.x, y: e.y, hp: e.hp, dead: e.dead, state: e.state, wet: !!e.wet, swipeN: e.swipeN ?? 0, dodgeN: e.dodgeN ?? 0 })),
      dummyDodges: this.dummyDodges, clockWord: this.clockWord?.word ?? null,
      birth: this.birth ? { playing: this.birth.playing, t: this.birth.t } : null,
      prompts: this.prompts.filter(p => p.text.alpha > 0.1).map(p => p.text.text), inputKind: this.ctl.last,
      intro: !!this.intro?.playing, introBeat: this.intro?.beat ?? null, endScreen: !!this.endScreen, endLines: this.endLinesText ?? null, playMs: (this.save.playMs ?? 0) + (this.playAcc || 0), roomCard: (this.roomCard?.list?.find(o => typeof (o as Phaser.GameObjects.Text).text === 'string') as Phaser.GameObjects.Text | undefined)?.text ?? null, hintOn: this.hintOn, stuck: this.stuck, timeScale: this.timeScale, stored: this.stored, perfectN: this.perfectN, pasteN: this.pasteN, selectN: this.selectN, selectHits: this.selectHits, rootN: this.rootN, rootUsed: this.rootUsed, rewriteN: this.rewriteN, cutscene: this.cutscene?.id ?? null,
      boss: this.fight ? { hp: this.fight.real.hp, state: this.fight.real.state, guarded: this.fight.guarded, guardT: this.fight.guardT, split: this.fight.split, fake: !!this.fight.fake, won: this.fight.won, punishCount: this.fight.punishCount, lastTell: this.fight.lastTell, tellCount: this.fight.tellCount, sign: this.plateById('r_guard')?.words.join(' '), signX: this.plateById('r_guard')?.container.x, x: this.fight.real.x, y: this.fight.real.y, pinT: this.fight.real.pinT ?? 0, balls: this.fight.balls.length, ring: !!this.fight.ring } : null, composer: this.composer ? this.composer.i : -1, paused: this.paused, save: JSON.parse(JSON.stringify(this.save)),
    };
  }
  installHooks() {
    (window as unknown as { __pi: unknown }).__pi = {
      state: () => this.getTestState(),
      teleport: (x: number, y: number) => { this.x = x; this.y = y; },
      canStand: (x: number, y: number) => this.canStand(x, y),
      interact: () => this.interact(),
      read: (id: string) => { const p = this.plateById(id); if (!p || !p.visible) return false; this.x = p.def.x; this.y = p.def.y - 20; return this.read(p); },
      swap: (from: string, to: string) => { const a = this.plateById(from); if (!a || !a.visible) return false; this.inspectOff = true; this.read(a); this.inspectOff = false; return this.swap(from, to); },
      goto: (r: RoomId) => this.goRoom(r),
      steal: (op?: string, id?: string) => {
        const sp = this.stealPlay; if (!sp) return false;
        if (op === 'take') return sp.take(id);
        if (op === 'throw') return sp.throwAt(id);
        if (op === 'undo') return sp.undo();
        return sp.state();
      },
      openLift: () => { if (this.impactLab?.on && !this.impactLab.done) { if (!this.impactLab.lampReady) this.impactLab.unlockLamp(); this.impactLab.takeSpark(); this.impactLab.throwBolt(); return true; } return !!this.impactLab?.done; },
      skipIntro: () => {
        if (this.intro && !this.intro.released) { if (!this.intro.finished) this.intro.skip(); return true; }
        return !this.intro?.playing;
      },
      openingExchange: () => {
        this.dialogue?.clear();
        for (const [who, line, ms, box] of OPENING_EXCHANGE) this.say(who, line, ms, { box });
        return this.dialogue?.progress() ?? null;
      },
      clearDialogue: () => { this.dialogue?.clear(); return true; },
      endScreen: () => { showEndScreen(this); return true; },
      toMenu: () => { backToTitle(this); return true; },

      readAll: () => { this.inspectOff = true; setTimeout(() => { this.inspectOff = false; }, 0); for (const p of this.plates) if (p.visible && (p.def.kind === 'look' || p.def.kind === 'lore' || p.def.toy) && !(p.def.id === 'o_monitor')) { this.read(p); if (this.hand) { this.plateById(this.hand.from)?.setOpts({ selected: false }); this.hand = null; } } return this.save.tutorials.includes('all:' + this.room.id); },
      idle: (s: number) => { this.idleT = s; },
      glowWords: (line: string) => this.dialogue?.glowWords(line) ?? [],
      advanceDialogue: () => { this.dialogue?.advance(); return this.dialogue?.progress() ?? null; },
      skipGapPan: () => { this.skipGapReveal(); return this.gapPan; },
      setAmbience: (id: string) => { setAmbience(id as Parameters<typeof setAmbience>[0], 0.2); return getAmbienceId(); },
      unlockAudio: () => unlockAudio(),

      playGapPan: () => { this.playGapReveal(true); return this.gapPan; },
      forceMailHold: () => this.intro?.forceHold?.() ?? false,
      forceDraftCursor: () => this.intro?.forceCursor?.() ?? false,
      sendCaret: (id?: string) => {
        if (id === 'dummy' || id === 'guard') return this.sendCaret(this.caretSendTarget(true));
        if (id) {
          const p = this.plateById(id);
          if (p) return this.sendCaret({ x: p.def.sx, y: p.def.sy, plate: p });
        }
        return this.sendCaret();
      },
      claimCaret: () => { this.claimCaret(true); return this.caretMode; },
      trapCaret: () => { this.placeTrappedCaret(); return this.caretMode; },
      fireBeam: (c?: number) => { this.fireBeam(c ?? 1); return this.beamN; },
      clar: (k: string, a?: string) => { const c = this.clar; if (!c) return false; if (k === 'tap') return c.openPicker(a ?? 'o_door'); if (k === 'pick') return c.choose(); if (k === 'close') { c.closeAll(); return true; } if (k === 'card') { const p = this.plateById(a ?? ''); return p ? c.openCard(p) : false; } if (k === 'blocked') { const [x, y] = (a ?? '0,0').split(',').map(Number); return c.blocked(x, y); } return false; },
      noorAnim: () => ({ key: this.noor.anims.currentAnim?.key ?? '', frame: this.noor.frame.name, sy: this.noor.scaleY }),
      reduceMotion: (on: boolean) => this.setReduceMotion(on),
      o9: (k: string, v?: number) => { const o = this.office; if (!o) return false; if (k === 'unread') o.tickUnread(); if (k === 'glitch') o.glitch(); if (k === 'draft') o.draftGlimpse(); if (k === 'idle') o.idle9 = v ?? 4.5; if (k === 'closeCard') o.closeCard(); if (k === 'roomT') o.roomT = v ?? 0; return true; },
      capForce: (id: string | null, text = '') => { this.words.force = id ? { id, text } : null; this.words.key = ''; return true; },
      captions: () => this.plates.filter(p => p.def.kind !== 'unlock').flatMap(p => { const c = p.caption(true); return [c.pre + c.word + c.post, p.def.cap2 ?? '', p.def.text ?? '', p.def.line ?? ''].filter(Boolean).map(t => ({ id: p.def.id, t })); }),
      setStuck: (s: number) => { this.stuck = s; },
      hurt: () => { this.iframes = 0; this.hurtNoor(); },
      kill: () => this.die(),
      bossHp: (hp: number) => { if (this.fight) this.fight.real.hp = hp; },
      bossAttack: (k: string) => { const e = this.fight?.real; if (!e) return; e.state = 'idle'; e.t = 0; this.fight!.attackN = k === 'ring' ? 2 : 0; if (k === 'toss') { e.x = this.x; e.y = this.y - 260; } if (k === 'swipe') { e.x = this.x; e.y = this.y - 120; } },
      bossFreeze: (on: boolean) => { const e = this.fight?.real; if (e) { e.state = on ? 'recover' : 'idle'; e.t = on ? 9999 : 0.5; } },
      reguard: () => { if (this.fight) { this.fight.guardT = 0.001; } },
      invuln: (s: number) => { this.iframes = s; },
      perfectDodge: (src: string) => { this.iframes = 0.3; this.dashT = 0.15; this.dashStartAt = this.t; return this.hurtNoor(src); },
      press: (a: 'root') => this.ctl.trigger(a),
      damageAll: () => { for (const e of this.enemies) if (!e.dead) { if (e.kind === 'dummy' && !this.flags.still) continue; this.hurtEnemy(e, 99, 0, 0); } },
      combat: (k: string, a?: string, b?: string) => {
        const c = this.combat; if (!c) return false;
        if (k === 'ink') { c.ink = Number(a); return c.ink; }
        if (k === 'give') { c.carried.push((a as 'PAPER' | 'WET' | 'SLOW' | 'GLASS') ?? 'PAPER'); return c.carried; }
        if (k === 'clear') { c.carried = []; c.armed = null; return true; }
        if (k === 'arm') { c.armCarry(Number(a ?? 0)); return c.armed; }
        if (k === 'peel') return c.tryPeel();
        if (k === 'throw') return c.tryThrow();
        if (k === 'beam') return c.fireBeam();
        if (k === 'apply') {
          const e = this.enemies.find(en => !en.dead && ((en as { gb?: string }).gb === a || (a === 'dummy' && en.practice)));
          if (!e) return false; c.applyWord(e as never, (b as 'PAPER' | 'WET' | 'SLOW' | 'GLASS') ?? 'PAPER'); return true;
        }
        if (k === 'spawn') { c.spawnGB(a as 'scribble' | 'redline' | 'stapler', Number(b?.split(',')[0] ?? 700), Number(b?.split(',')[1] ?? 400)); return true; }
        return c.state();
      },
      audioPeek: () => {
        const a = getAudioContext();
        return {
          state: a?.state ?? 'none',
          master: getMasterVolume(),
          rms: meterRms(),
          freeze: freezeBedActive(),
        };
      },
      voiceBlip: (who: 'noor' | 'fern' = 'noor', n = 6) => {
        for (let i = 0; i < n; i++) voiceBlip(who, i);
        return true;
      },
    };
  }
}
