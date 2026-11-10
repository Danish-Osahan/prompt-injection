// Prompt Injection, Phase 1 "After Hours" - session 1 playable build.
// One scene; rooms are built into a throwaway object list and torn down on transition (no loading screens).
import Phaser from 'phaser';
import tokens from './tokens.json';
import { Controls, type Frame } from './controls';
import { Plate } from './plate';
import { WordUI, BAR_Y } from './words';
import { ROOMS, type Rect, type RoomDef } from './rooms';
import { DraftFight, DRAFT } from './boss';
import { sfx } from './sfx';
import { ROOMART, type AmbLayer } from './roomart';
import { LINGER, LINES } from './linger';
import { Office9, ViewMap } from './office9';
import { Clarity, DOOR_DEF } from './clarity';
import { CombatGreybox } from './combat/greybox';
import { ImpactLab } from './impact/ImpactLab';
import { bindSfxScene } from './sfx';
import type { PlateDef } from './plate';
import { type RoomId, type Save, loadSave, writeSave, wipeSave, freshSave, setEphemeralSave, recomputeGrowth, fernStage, logSwap, topWord } from './save';

const C = tokens.color;
const hex = (s: string) => parseInt(s.slice(1), 16);
const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const MAX_HP = 4;
const WALK = 230, DASH_SPEED = 900, DASH_T = 0.18, DASH_CD = 1.0;
const READ_R = 90, FOCUS_R = 120;
const HOLD_T = 0.22, CHARGE_T = 0.5, AIM_R = 150, BEAM_R = 560;
const inR = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

type EKind = 'dummy' | 'scribble' | 'note' | 'draft' | 'redline' | 'stapler';
export interface Enemy {
  kind: EKind; x: number; y: number; hp: number; maxHp: number; g: Phaser.GameObjects.Container; body: Phaser.GameObjects.Graphics;
  state: string; t: number; kx: number; ky: number; tx: number; ty: number; hx: number; hy: number; dead: boolean; hitBy: number; phase: number;
  practice?: boolean;   // art-v11: the office's stuffed practice dummy (takes hits forever, never fights back)
  flash?: Phaser.GameObjects.Graphics; pinT?: number; rootG?: Phaser.GameObjects.Graphics;
}
interface Prompt { id: string; kb: string; touch: string; text: Phaser.GameObjects.Text; done: () => boolean }

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
  x = 0; y = 0; dir = 'S'; hp = MAX_HP;
  dashT = 0; dashCd = 0; dashVec = { x: 0, y: 1 }; iframes = 0; sinceDash = 9;
  combo = 0; comboT = 0; swingT = 0; hitStopT = 0; trailT = 0; bsT = 0; bsHit = new Set<Enemy>();
  hand: { word: string; from: string } | null = null;
  dyn: Record<string, Rect | null> = {};
  extraWalk: Record<string, Rect | null> = {};
  hazards: Rect[] = [];
  busy = false; composer: { words: string[]; i: number; ui: Phaser.GameObjects.Container } | null = null;
  dying = false; deathAt = 0; lastRespawnMs = -1; undoShown = 0;
  stuck = 0; hintOn = false; hintObj: Phaser.GameObjects.Container | null = null; hintUsed = false;
  prompts: Prompt[] = [];
  paused = false; pauseUi: Phaser.GameObjects.Container | null = null;
  debugOn = false; debugText!: Phaser.GameObjects.Text;
  hud!: { path: Phaser.GameObjects.Text; title: Phaser.GameObjects.Text; caret: Phaser.GameObjects.Rectangle; hp: Phaser.GameObjects.Image[]; meta: Phaser.GameObjects.Text; menu: Phaser.GameObjects.Text; hand: Phaser.GameObjects.Container; handText: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text; fern: Phaser.GameObjects.Container; fernText: Phaser.GameObjects.Text; skip: Phaser.GameObjects.Text };
  darkness: Phaser.GameObjects.Image | null = null;
  flags = { door: false, lit: false, drained: false, bridge: false, quick: false, dry: false, apart: false };
  roomVis: Record<string, Phaser.GameObjects.GameObject> = {};
  art = false; bg: Record<string, Phaser.GameObjects.Image> = {};
  subQueue: { who: string; line: string; ms: number }[] = []; subBusy = false;
  moved = 0; t = 0; transitioning = false;
  fight: DraftFight | null = null; timeScale = 1; rewriteT = 0; rewriteN = 0; stored: string | null = null; rootUsed = false;
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
  idleT = 0; idleSaid = false; toyFx: Record<string, Phaser.GameObjects.GameObject> = {};
  refl: Phaser.GameObjects.Sprite | null = null; hist: { t: number; x: number; y: number; key: string; frame: string }[] = [];
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
  /** ?impact=1 — isolated in-memory lab; never touches localStorage. */
  labMode = false;
  buildStamp = '';
  constructor() { super('game'); }

  create() {
    const q = new URLSearchParams(location.search);
    this.labMode = q.has('impact');
    // Impact Lab: fresh isolated in-memory save. Do NOT wipe or write the player's localStorage.
    if (this.labMode) {
      setEphemeralSave(true);
      this.save = freshSave();
      this.save.room = 'office';
      // Open floor near the rain window (not the coffee counter / old checkpoints)
      this.save.checkpoint = { room: 'office', x: 880, y: 400, plate: null };
    } else {
      if (q.has('new')) wipeSave();
      this.save = loadSave();
    }
    try { this.seenEver = this.labMode ? [] : JSON.parse(localStorage.getItem('pi.seenEver') ?? '[]'); } catch { this.seenEver = []; }
    recomputeGrowth(this.save);
    this.ctl = new Controls(this);
    this.ctl.onKindChange = () => this.refreshPrompts();
    bindSfxScene(this);
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
    this.add.text(30, 76, 'hp', f(12)).setColor(C.dim).setScrollFactor(0).setDepth(D);
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
    const sub = this.add.text(640, BAR_Y - 80, '', { fontFamily: 'IBM Plex Mono', fontSize: '17px', fontStyle: '500', color: C.inkBright, align: 'center', backgroundColor: 'rgba(4,12,18,0.72)', padding: { x: 12, y: 6 } }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2).setVisible(false);
    // Fern speaks via a sticky-note popup
    const fern = this.add.container(1080, 120).setScrollFactor(0).setDepth(D + 3).setVisible(false);
    const card = this.add.rectangle(0, 0, 300, 78, 0x2a1830, 0.94).setStrokeStyle(2, hex(C.fern), 1);
    const fl = this.add.text(-138, -30, 'fern', { fontFamily: 'JetBrains Mono', fontSize: '12px', fontStyle: 'bold', color: C.fern });
    const fernText = this.add.text(-138, -12, '', { fontFamily: 'IBM Plex Mono', fontSize: '15px', fontStyle: '500', color: '#F6E6F4', wordWrap: { width: 276 } });
    fern.add([card, fl, fernText]);
    this.debugText = this.add.text(1250, 60, '', { fontFamily: 'IBM Plex Mono', fontSize: '12px', color: C.ok, align: 'right', backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 6, y: 4 } }).setOrigin(1, 0).setScrollFactor(0).setDepth(D + 10);
    const skip = this.add.text(1250, 300, '', { fontFamily: 'JetBrains Mono', fontSize: '12px', color: C.dim }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(D + 4).setVisible(false);
    this.hud = { path, title, caret, hp, meta, menu, hand, handText, sub, fern, fernText, skip };
    void blur; void scrim; scrim.setVisible(false);
    this.words = new WordUI(this);
  }

  updateHud() {
    const h = this.hud;
    h.path.setText(this.room.path); h.title.setText(this.room.title); for (const o of [h.path, h.title, h.meta]) o.setVisible(!this.clar); this.hudBlur?.setVisible(!this.clar);
    h.caret.setX(32 + h.title.width + 4).setVisible(!this.clar && Math.floor(this.t * 1000 / tokens.motion.caretBlinkMs) % 2 === 0);
    h.hp.forEach((im, i) => im.setTexture(i < this.hp ? 'hp_on' : 'hp_off'));
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
  say(who: 'noor' | 'ai' | 'fern' | 'papa' | 'floor', line: string, ms = 2200) { if (this.clar && !this.cutscene && !this.composer && !this.busy && !(this.impactLab?.stealMode)) { this.clar.say((who === 'fern' ? 'fern  ' : who === 'noor' ? 'noor  ' : '') + line, ms); return; } this.subQueue.push({ who, line, ms }); if (!this.subBusy) this.nextSub(); }
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
    this.amb = []; this.toyFx = {}; this.refl = null; this.hist = []; this.motes = []; this.motesG = null; this.moteRect = null; this.idleT = 0; this.idleSaid = false;
    this.impactLab?.stop(); this.impactLab = null; this.office = null; this.clar = null; this.vm = null; this.vsaved.length = 0; this.atkPending = false; this.chargeG = null; this.aimG = null;
    { if (this.labMode) this.setupStaticCamera(); else this.setupStaticCamera(); }
    this.darkness = null; this.litImg = null; this.bridgeImg = null; this.bridgeTw = null; this.fgImgs = {}; this.hintObj = null; this.hintOn = false; this.stuck = 0; this.hintUsed = false; this.subQueue = []; this.subBusy = false;
    this.hud.sub.setVisible(false); this.hud.fern.setVisible(false); this.composer = null; this.busy = false; this.hand = null;
    this.fight = null; this.rootUsed = false; this.stored = null; this.rewriteT = 0; this.timeScale = 1; this.selecting = false; this.selectG = null; this.cutscene = null; this.slowVeil = null;
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
    this.caret = this.add.sprite(0, 0, 'caret_idle').setScale(0.45).setOrigin(0.5, 0.83).play('caret_idle_S').setVisible(this.save.seen.includes('caret')); this.objs.push(this.caret);
    const cp = this.save.checkpoint;
    const spawn = fromLoad && cp.room === id ? cp : r.spawn;
    this.x = spawn.x; this.y = spawn.y; this.unstick(); this.hp = MAX_HP; this.dashCd = 0; this.dashT = 0; this.iframes = 0; this.moved = 0;
    this.caret.setPosition(this.x - 40, this.y - 40);
    if (!fromLoad || cp.room !== id) { this.save.checkpoint = { room: id, x: r.spawn.x, y: r.spawn.y, plate: null }; }
    this.save.room = id; writeSave(this.save);
    this.words.quiet = !!this.clar;
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
    if (id === 'office' && this.clar) this.impactLab?.start();
    this.cameras.main.fadeIn(220, 4, 8, 12);
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
      if (!this.clar) this.addPrompt('move', 160, 520, 'WASD TO WALK', 'DRAG TO WALK', () => this.moved > 80);
      if (!this.clar) this.addPrompt('read', 232, 700, 'E TO READ', 'TAP READ', () => s.lore.length > 0, () => Math.hypot(this.x - 232, this.y - 640) < 220);
    }
    if (id === 'hub') {
      const fern = this.add.sprite(1005, 545, 'fern_seated').setOrigin(0.5, 0.83).setScale(0.75).play('fern_seated_S').setDepth(560); this.objs.push(fern);
      const glow = this.add.image(1005, 560, 'pool').setTint(hex(C.fern)).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(-800); this.objs.push(glow);
      // the gap: floor is gone between the door wall and the exit
      const gap = this.add.graphics().setDepth(-950).setVisible(!this.art); this.objs.push(gap);
      gap.fillStyle(0x010204, 1).fillRect(80, 250, 1120, 72);
      for (let i = 0; i < 18; i++) gap.lineStyle(1, 0x78e4e8, 0.06 + i * 0.004).lineBetween(80 + i * 64, 250, 80 + i * 64 + 20, 322);
      gap.lineStyle(2, 0x78e4e8, 0.4).lineBetween(80, 250, 1200, 250).lineBetween(80, 322, 1200, 322);
      this.hazards.push({ x: 80, y: 254, w: 1120, h: 64 });
      if (this.art) {   // art-v9 fix: light falls up the shaft so the gap reads as depth, not a black band
        const sh = this.add.graphics().setDepth(-940).setBlendMode(Phaser.BlendModes.ADD); this.objs.push(sh);
        for (let i = 0; i < 12; i++) { const t = i / 11; sh.fillStyle(0x2a6f7a, 0.05 + 0.09 * t).fillRect(80, 250 + 6 * i, 1120, 72 - 6 * i); }
        for (let i = 0; i < 9; i++) sh.fillStyle(0x78e4e8, 0.07).fillRect(140 + i * 120, 252, 34, 68);
        sh.lineStyle(2, 0x78e4e8, 0.35).lineBetween(80, 321, 1200, 321);
        this.tweens.add({ targets: sh, alpha: { from: 0.85, to: 1 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      if (this.art && this.fgImgs.door_panel) this.roomVis.doorPanel = this.fgImgs.door_panel;
      else { const door = this.add.rectangle(600, 400, 80, 34, hex(C.coral), 0.8).setOrigin(0).setDepth(434.5); this.objs.push(door); this.roomVis.door = door; }
      this.addPrompt('dash', 640, 342, 'SPACE TO DASH', 'TAP DASH', () => this.y < 240, () => this.y < 400);
      this.addPrompt('swap', 640, 535, 'E AT THE DOOR  ·  OR CLICK SHUT IN THE CAPTION', 'TAP SHUT IN THE CAPTION', () => this.flags.door, () => !!this.hand);
      this.addPrompt('p_tap', 0, 0, 'CLICK THE BOXED WORD IN THE CAPTION', 'TAP THE BOXED WORD IN THE CAPTION', () => !!this.hand || s.tutorials.includes('tapchip') || this.flags.door, () => Math.hypot(this.x - 300, this.y - 560) < 200);
      if (!s.seen.includes('sc3')) {
        s.seen.push('sc3'); writeSave(s);
        this.startCutscene('sc3', 0, () => {}, () => { this.subQueue = []; this.nextSub(); });
        this.time.delayedCall(500, () => {
          this.say('noor', 'Where am I?', 1600); this.say('fern', 'Inside everything you all ever typed.', 2400);
          this.say('noor', 'Why are things moving?', 1700); this.say('fern', 'Say something enough, and it listens.', 2400);
          this.say('noor', 'And you?', 1200); this.say('fern', 'You talked to me. Every morning.', 2300);
          this.say('fern', "You came back. They said you wouldn't.", 2400); this.say('noor', 'Came back from where?', 1700);
          this.say('fern', 'Look. The door.', 2400);
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
      this.addPrompt('p_hold', 0, 0, 'HOLD E TO SEE THE CODE', 'HOLD READ TO SEE THE CODE', () => s.tutorials.includes('holdread'), () => !this.flags.lit && this.moved > 40);
      this.dyn.alcove = { x: 1190, y: 330, w: 30, h: 160 };
      this.spawnEnemy('dummy', 1110, 500);
      this.addPrompt('attack', 1090, 640, 'CLICK OR J TO TYPE', 'TAP TYPE', () => this.enemies.some(e => e.kind === 'dummy' && e.hp < e.maxHp) || s.defeated.includes('dummy'), () => this.flags.quick);
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
    }
    if (id === 'arena') {
      if (!this.art) { const lamp = this.add.image(640, 420, 'pool').setScale(3.2, 2.2).setTint(0xf6c684).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(-800); this.objs.push(lamp); }
      this.dyn.arenaDoor = s.defeated.includes('draft') ? null : { x: 590, y: 150, w: 100, h: 20 };
      this.slowVeil = this.add.rectangle(640, 360, 1280, 720, hex(C.cyan), 0.07).setScrollFactor(0).setDepth(3900).setVisible(false); this.objs.push(this.slowVeil);
      if (!s.defeated.includes('draft')) {
        this.save.checkpoint = { room: 'arena', x: this.room.spawn.x, y: this.room.spawn.y, plate: null };
        this.fight = new DraftFight(this);
        this.startCutscene('sc4', 1500, () => { this.say('fern', "No shadow. It's a copy. Fight.", 2400); }, () => { if (this.fight) { this.fight.real.g.setAlpha(1); this.fight.real.t = 0; } });
        this.addPrompt('rewrite', 0, 0, 'E AT "PAPER IS WEAK": SLOW-MO REWRITE', 'READ "PAPER IS WEAK": SLOW-MO REWRITE', () => this.rewriteN > 0, () => Math.hypot(this.x - 450, this.y - 330) < 200);
        this.addPrompt('select', 0, 0, 'HOLD J, RELEASE: TYPED BEAM', 'HOLD TYPE, RELEASE: BEAM', () => this.selectN > 0, () => !!this.fight && this.fight.real.state !== 'intro');
        this.addPrompt('root', 0, 0, 'R: FERN ROOT (ONCE PER FIGHT)', 'ROOT: PIN IT (ONCE PER FIGHT)', () => this.rootN > 0, () => !!this.fight && this.fight.split);
      } else { this.plateById('r_guard')?.setVisibleState(false); this.plateById('r_weak')?.setVisibleState(false); }
    }
    if (id === 'message') {
      const wall = this.add.container(640, 60).setDepth(-850).setVisible(!this.art); this.objs.push(wall);
      const shard = this.add.text(640, 520, 'FILED: \u2588\u2588/\u2588\u2588', { fontFamily: 'JetBrains Mono', fontSize: '18px', fontStyle: 'bold', color: C.lamp }).setOrigin(0.5).setDepth(2000).setAlpha(0); this.objs.push(shard);
      const lines: [string, string, number][] = [['papa', 'Beta, did the claim go through?', 0], ['ai', `Still processing, don't worry. It's ${topWord(this.save)}.`, 1], ['papa', 'Okay. Eat properly. Love you.', 0], ['ai', 'Love you too, Papa.', 1]];
      let finished = false;
      const finish = () => {
        if (finished) return; finished = true; this.cutscene = null;
        this.plateById('m_stairs')?.setVisibleState(true);
        this.floorText(560, 340, 'PHASE 1 COMPLETE', C.ok, 34, 0);
        this.save.phaseComplete = true; if (!this.save.seen.includes('sc5')) this.save.seen.push('sc5'); this.markSeen('sc5'); writeSave(this.save);
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
  }

  // ---------- tutorial floor prompts ----------
  addPrompt(id: string, x: number, y: number, kb: string, touch: string, done: () => boolean, when: () => boolean = () => true) {
    if (this.save.tutorials.includes(id)) return;
    void x; void y;
    const text = this.add.text(0, 0, '', { fontFamily: 'JetBrains Mono', fontSize: '14px', fontStyle: 'bold', color: C.cyan, backgroundColor: 'rgba(4,12,18,0.8)', padding: { x: 8, y: 4 } }).setOrigin(0.5, 0).setDepth(4100).setAlpha(0); this.objs.push(text);
    const p: Prompt & { when: () => boolean } = { id, kb, touch, text, done, when };
    this.prompts.push(p); this.refreshPrompts();
  }
  refreshPrompts() { for (const p of this.prompts) p.text.setText(this.ctl.last === 'touch' ? p.touch : p.kb); }
  updatePrompts() {
    let shown = false; // one HUD hint at a time, above Noor
    for (const p of [...this.prompts] as (Prompt & { when: () => boolean })[]) {
      if (p.done()) {
        this.save.tutorials.push(p.id); writeSave(this.save); this.prompts.splice(this.prompts.indexOf(p), 1);
        this.tweens.add({ targets: p.text, alpha: 0, duration: 400, onComplete: () => p.text.destroy() });
      } else { const show = p.when() && !this.busy && !shown; if (show) shown = true; p.text.setPosition(Math.round(this.x), Math.round(this.y + 46 > 680 ? this.y - 190 : this.y + 46)).setAlpha(show ? 0.9 * (1 - this.words.codeA) : 0); }
    }
  }

  // ---------- enemies ----------
  spawnEnemy(kind: EKind, x: number, y: number, phase = 0) {
    const g = this.add.container(x, y); const body = this.add.graphics(); g.add(body);
    const sh = kind === 'draft' ? null : this.add.ellipse(0, 0, kind === 'note' ? 16 : 40, 10, 0, 0.4); if (sh) g.addAt(sh, 0);
    const hp = { dummy: 6, scribble: 3, note: 1, draft: DRAFT.hp, redline: 5, stapler: 6 }[kind];
    if (kind === 'dummy') { body.fillStyle(0xd8d0bc, 1).fillRect(-16, -62, 32, 48).fillCircle(0, -72, 13); body.fillStyle(0x8a826e, 1).fillRect(-3, -14, 6, 14); body.lineStyle(2, 0x5a5444, 1).lineBetween(-10, -50, 10, -50).lineBetween(-10, -40, 8, -40); }
    if (kind === 'scribble') { body.lineStyle(4, 0x0c0e1e, 1); body.beginPath(); for (let i = 0; i <= 24; i++) { const a = i * 0.9, r = 14 + (i % 3) * 6; const px = Math.cos(a) * r, py = -22 + Math.sin(a) * r * 0.7; if (i) body.lineTo(px, py); else body.moveTo(px, py); } body.strokePath(); body.lineStyle(1.5, 0x78e4e8, 0.7).strokeCircle(-6, -26, 3).strokeCircle(6, -26, 3); }
    if (kind === 'note') { body.fillStyle(0xf2dc6a, 1).fillRect(-9, -28, 18, 18); body.fillStyle(0xd8c050, 1).fillRect(-9, -14, 18, 4); }
    if (kind === 'draft') {
      const sp = this.add.sprite(0, 0, 'noor_idle').setOrigin(96 / 192, 160 / 192).play('noor_idle_S').setTint(0x9aa0a8).setAlpha(0.85); g.add(sp);
      body.lineStyle(1, 0xe6e6e6, 0.4); for (let i = 0; i < 8; i++) body.strokeRect(-30 + Math.random() * 50, -110 + Math.random() * 100, 10, 8);
    }
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
      sfx('hit'); const fl = this.add.ellipse(e.x, e.y - 60, 70, 100, 0xffffff, 0.7).setDepth(e.y + 2).setBlendMode(Phaser.BlendModes.ADD); this.objs.push(fl);
      this.tweens.add({ targets: fl, alpha: 0, scale: 1.2, duration: 130, onComplete: () => fl.destroy() });
      this.tweens.killTweensOf(e.g); e.g.setRotation(0); const sgn = Math.sign(kx || 1);
      this.tweens.add({ targets: e.g, rotation: { from: 0.16 * sgn * Math.min(2, dmg), to: 0 }, duration: 520, ease: 'Elastic.easeOut' });
      return;
    }
    if (e.kind === 'dummy' && !this.flags.quick) { if (!this.roomVis.dummyMsg) { this.roomVis.dummyMsg = this.floorText(e.x, e.y - 110, "IT ISN'T AWAKE.", C.dim, 16, 1600); this.time.delayedCall(1800, () => delete this.roomVis.dummyMsg); } return; }
    if (e.kind === 'draft' && this.fight) dmg = this.fight.modify(e, dmg);
    if (e.kind === 'scribble' && this.flags.dry) { dmg *= 2; this.floorText(e.x, e.y - 70, 'CRACK x2', C.ok, 13, 500); }
    if (dmg <= 0) { this.tweens.add({ targets: e.g, alpha: 0.6, duration: 50, yoyo: true }); return; }
    sfx('hit');
    e.hp -= dmg; if (e.kind !== 'draft' && e.kind !== 'dummy') { e.kx += kx; e.ky += ky; }
    if (e.state === 'lunge' || e.state === 'dive' || e.state === 'windup') { e.state = 'stun'; e.t = 0.5; }
    // hit flash: a white pop over the enemy + a squash punch (readable at 640x360)
    const fl = this.add.ellipse(e.x, e.y - 34, 74, 86, 0xffffff, 0.75).setDepth(e.y + 2).setBlendMode(Phaser.BlendModes.ADD); this.objs.push(fl);
    this.tweens.add({ targets: fl, alpha: 0, scale: 1.25, duration: 130, onComplete: () => fl.destroy() });
    this.tweens.add({ targets: e.g, scaleX: 1.14, scaleY: 0.88, duration: 55, yoyo: true, ease: 'Quad.easeOut' });
    if (mark) { const m = this.add.text(e.x + 14, e.y - 50, '|', { fontFamily: 'JetBrains Mono', fontSize: '30px', fontStyle: 'bold', color: C.cyan }).setOrigin(0.5).setDepth(3200); this.objs.push(m); this.tweens.add({ targets: m, alpha: 0, duration: 265, yoyo: true, repeat: 2, onComplete: () => m.destroy() }); }
    if (e.hp <= 0) {
      e.dead = true; this.combat?.onKill(e, 'combo'); this.save.defeated.push(e.kind === 'note' ? 'note' + e.phase : e.kind);
      this.tweens.killTweensOf(e.g); this.tweens.add({ targets: e.g, scaleX: 0.2, scaleY: 0.1, alpha: 0, duration: 380, onComplete: () => e.g.setVisible(false) });
      e.flash?.clear();
      if (e.kind === 'dummy') { this.dyn.alcove = null; this.roomVis.alcove_door?.destroy(); this.say('fern', 'Good. Swaps wake things up.', 2200); }
      if (e.kind === 'draft') { this.time.delayedCall(2400, () => { this.plateById('r_line')?.setVisibleState(!this.save.lines.includes('r_line')); this.ambState(); }); this.dyn.arenaDoor = null; this.floorText(e.x, e.y - 120, 'I TRIED SO HARD.', C.inkBright, 22, 3200); this.say('noor', '...So did I.', 2200); }
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
        if (!this.flags.quick) { e.state = 'idle'; e.g.setRotation(0); }
        else {
          if (e.state === 'idle' && e.t <= 0) { e.state = 'windup'; e.t = 0.8; }
          if (e.state === 'windup') { fl.fillStyle(hex(C.coral), 0.15 + 0.3 * (1 - e.t / 0.8)).fillCircle(e.x, e.y, 95); fl.lineStyle(2, hex(C.coral), 0.8).strokeCircle(e.x, e.y, 95); e.g.setRotation(-0.3 * (1 - e.t / 0.8)); if (e.t <= 0) { e.state = 'swipe'; e.t = 0.25; if (d < 95) this.hurtNoor('swipe'); } }
          else if (e.state === 'swipe') { e.g.setRotation(0.5); if (e.t <= 0) { e.state = 'recover'; e.t = 0.9; } }
          else if (e.state === 'recover' || e.state === 'stun') { e.g.setRotation(0); if (e.t <= 0) { e.state = 'idle'; e.t = 1.4; } }
        }
        e.x = e.hx + Phaser.Math.Clamp(e.x - e.hx, -30, 30); e.y = e.hy + Phaser.Math.Clamp(e.y - e.hy, -30, 30);
      }
      if (e.kind === 'scribble') {
        e.body.setAlpha(this.flags.dry ? 0.65 : 1);
        const fast = e.hp <= e.maxHp / 2 ? 1.4 : 1; const aware = d < 420 && this.x > 820;
        if (e.state === 'idle') { e.g.setScale(1, 1 + 0.05 * Math.sin(this.t * 6)); if (aware) { if (d > 170) { e.x += dx / d * 70 * fast * dt; e.y += dy / d * 70 * fast * dt; } else if (e.t <= 0) { e.state = 'windup'; e.t = 0.6 / fast; } } }
        else if (e.state === 'windup') { e.g.setScale(1.25, 0.6); fl.fillStyle(hex(C.coral), 0.25).fillEllipse(e.x, e.y, 60, 20); if (e.t <= 0) { e.state = 'lunge'; e.t = 0.32; e.tx = dx / d; e.ty = dy / d; } }
        else if (e.state === 'lunge') { e.g.setScale(0.8, 1.2); e.x += e.tx * 560 * fast * dt; e.y += e.ty * 560 * fast * dt; if (d < 32) { this.hurtNoor('lunge'); e.state = 'recover'; e.t = 0.6; } else if (e.t <= 0) { e.state = 'stuck'; e.t = 1.0; } }
        else if (e.state === 'stuck') { e.g.setScale(1.1, 0.9); fl.lineStyle(1, hex(C.cyan), 0.5).strokeCircle(e.x, e.y - 20, 26); if (e.t <= 0) { e.state = 'idle'; e.t = 0.5; } }
        else { e.g.setScale(1); if (e.t <= 0) { e.state = 'idle'; e.t = 0.6; } }
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
        if (this.room.id === 'arena' && this.fight && !this.hand && this.plateById('r_weak')?.slotWord === 'WEAK') { this.hand = { word: 'WEAK', from: 'r_weak' }; this.floorText(this.x, this.y - 150, 'FRAGMENT: WEAK', C.ok, 13, 900); }
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
    this.dying = true; this.deathAt = performance.now(); this.save.deaths++;
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
    if (this.impactLab?.stealMode || this.impactLab?.on) return false;
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
  markTut(id: string) { if (!this.save.tutorials.includes(id)) { this.save.tutorials.push(id); writeSave(this.save); } }
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
      f.door = w('h_door') === 'OPEN';
      this.dyn.door = f.door ? null : { x: 600, y: 400, w: 80, h: 34 };
      const door = this.roomVis.door as Phaser.GameObjects.Rectangle;
      const panel = this.roomVis.doorPanel as Phaser.GameObjects.Image;
      if (panel) { this.tweens.killTweensOf(panel); if (initial) panel.setAlpha(f.door ? 0 : 1); else { this.tweens.add({ targets: panel, alpha: f.door ? 0 : 1, scaleY: f.door ? 0.96 : 1, duration: 380, ease: 'Quad.easeIn' }); } }
      // art-v8: the coral door light and its floor reflection belong to the SHUT plate; OPEN crossfades to a plate rendered without them
      if (this.bg.shut && this.bg.open) { const want = f.door ? 'open' : 'shut'; for (const [k, im] of Object.entries(this.bg)) { this.tweens.killTweensOf(im); if (initial) im.setAlpha(k === want ? 1 : 0); else this.tweens.add({ targets: im, alpha: k === want ? 1 : 0, duration: 420 }); im.setDepth(k === want ? -999.5 : -1000); } }
      if (door) { if (initial) door.setAlpha(f.door ? 0.1 : 0.8).setFillStyle(f.door ? hex(C.cyan) : hex(C.coral), 0.8); else this.tweens.add({ targets: door, alpha: f.door ? 0.1 : 0.8, duration: 400 }); door.setFillStyle(f.door ? hex(C.cyan) : hex(C.coral)); }
      if (f.door && !was.door && !initial && !s.seen.includes('caret')) {
        s.seen.push('caret');
        this.plateById('h_exit')?.pulse(C.cyan);
        this.say('fern', 'Only the owner of the words leaves.', 2400); this.say('noor', "They're my words.", 1600); this.say('fern', 'Not here. Not anymore.', 2200);
        this.time.delayedCall(4200, () => { this.caret.setVisible(true).setAlpha(0); this.tweens.add({ targets: this.caret, alpha: 1, duration: 500 }); this.say('fern', "It'll help. It likes you.", 2200); });
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
      if (f.lit && !was.lit && !initial) this.say('fern', 'Left you a note. Down there.', 2000);
      f.quick = w('c_dummy') === 'QUICK';
      if (f.quick) help('dummy');
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
    const solved = id === 'hub' ? f.door : id === 'corridor' ? f.lit : id === 'archive' ? f.bridge : false;
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
      this.refl = this.add.sprite(0, 0, 'noor_idle').setOrigin(96 / 192, 160 / 192).setScale(0.55, 0.5).setTint(0x9ad8f0).setAlpha(0.42).setDepth(-997).setVisible(false); this.objs.push(this.refl);
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
      const toBucket = w('c_moth') === 'DRIP';
      for (const a of A('moth')) { this.tweens.killTweensOf(a.spr); this.tweens.add({ targets: a.spr, x: a.ox + (toBucket ? 364 : 0), y: a.oy + (toBucket ? 70 : 0), duration: initial ? 0 : 1600, ease: 'Sine.easeInOut' }); }
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
  collectLine(p: Plate) {
    const s = this.save; const L = LINES.find(l => l.id === p.def.id);
    if (!L || s.lines.includes(L.id)) return;
    s.lines.push(L.id); writeSave(s); sfx('paste');
    this.words.showLore(p, L.text);
    const a = this.amb.find(x => x.def.name === 'line');
    if (a) this.tweens.add({ targets: a.spr, alpha: 0, y: a.spr.y - 14, duration: 900, onComplete: () => { p.setVisibleState(false); this.ambState(); } }); else p.setVisibleState(false);
    const card = this.add.text(640, 590, `unsent.txt  +1   ${s.lines.length}/${LINES.length}`, { fontFamily: 'JetBrains Mono', fontSize: '14px', fontStyle: 'bold', color: C.lamp, backgroundColor: 'rgba(4,12,18,0.85)', padding: { x: 10, y: 4 } }).setOrigin(0.5).setScrollFactor(0).setDepth(4300).setAlpha(0);
    this.objs.push(card); this.tweens.add({ targets: card, alpha: 1, y: 576, duration: 260, yoyo: true, hold: 1800, onComplete: () => card.destroy() });
    if (s.lines.length === LINES.length) this.time.delayedCall(2600, () => this.say('fern', "That's all of it. You could send it now.", 2600));
  }
  /** per frame: ambient frame stepping, the stand-still narrator line, the hub mirror, dust motes */
  updateLinger(dt: number, active: boolean) {
    for (const a of this.amb) {
      if (a.def.frames <= 1 || !a.spr.visible) continue;
      a.t += dt * a.speed; const n = a.def.frames; let k = Math.floor(a.t * a.def.fps) % n; if (a.dir < 0) k = n - 1 - k;
      if (Number(a.spr.frame.name) !== k) a.spr.setFrame(k);
    }
    if (this.memoDrift()) { /* drifting memo handled inside */ }
    // stand still ~6 s: the narrator notices (once per room visit)
    const calm = !this.busy && !this.cutscene && (!this.fight || this.fight.won);
    if (active || !calm || this.dying || this.composer || this.subBusy) this.idleT = 0; else this.idleT += dt;
    if (this.idleT > 6 && !this.idleSaid && !this.clar) {
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
      const key = ahead ? this.noor.texture.key : h.key; const near = this.y < 300;
      this.refl.setVisible(near);
      if (near && this.textures.get(key).has(fr)) {
        this.refl.setTexture(key, fr); const fy = 140 - Math.max(0, (this.y - 150)) * 0.18;
        this.refl.setPosition(rx, fy);
        // crop to the glass (222..404 x 42..140): frame px = (world - origin) / scale
        const sx = 0.55, sy = 0.5, x0 = rx - 96 * sx, y0 = fy - 160 * sy;
        const cx0 = Phaser.Math.Clamp((222 - x0) / sx, 0, 192), cx1 = Phaser.Math.Clamp((404 - x0) / sx, 0, 192), cy0 = Phaser.Math.Clamp((42 - y0) / sy, 0, 192), cy1 = Phaser.Math.Clamp((140 - y0) / sy, 0, 192);
        if (cx1 - cx0 < 2 || cy1 - cy0 < 2) this.refl.setVisible(false); else this.refl.setCrop(cx0, cy0, cx1 - cx0, cy1 - cy0);
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
    this.hairT -= dt; if (this.hairT > 0) return; this.hairT = 0.032;
    const e = this.add.sprite(this.x, this.y, this.noor.texture.key, this.noor.frame.name).setOrigin(96 / 192, 160 / 192).setDepth(this.y - 1.5)
      .setCrop(38, 48, 116, 62).setTint(0xffb27a).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD); this.objs.push(e);
    this.tweens.add({ targets: e, alpha: 0, x: e.x - this.dashVec.x * 18, y: e.y - this.dashVec.y * 10 - 2, scaleX: 1.06, duration: 230, ease: 'Quad.easeOut', onComplete: () => e.destroy() });
  }

  // ---------- Fern hint ----------
  hintTarget(): string | null {
    const f = this.flags, h = this.hand;
    if (this.room.id === 'hub' && !f.door) return h ? 'h_door' : 'h_lamp';
    if (this.room.id === 'corridor' && !f.lit) return h ? 'c_light' : 'c_switch';
    if (this.room.id === 'corridor' && !f.quick) return h ? 'c_dummy' : 'c_clock';
    if (this.room.id === 'archive' && !f.drained) return h ? 'a_water' : 'a_drawer';
    if (this.room.id === 'archive' && !f.bridge) return h ? 'a_bridge' : 'a_stairs';
    return null;
  }
  updateHint(dt: number) {
    if (this.impactLab?.on) { if (this.hintObj) { this.hintObj.destroy(); this.hintObj = null; } this.hintOn = false; return; }
    const target = this.hintTarget();
    if (!target || this.busy) { if (this.hintObj) { this.hintObj.destroy(); this.hintObj = null; } this.hintOn = false; return; }
    this.stuck += dt;
    const st = fernStage(this.save.fernGrowth);
    if (this.stuck >= st.hintS) {
      const p = this.plateById(target)!;
      if (!this.hintObj || this.hintObj.name !== target) {
        this.hintObj?.destroy();
        const c = this.add.container(p.def.sx, p.def.sy - 52).setDepth(3600); c.name = target;
        const leaf = this.add.graphics(); leaf.fillStyle(0x7ad08a, 1).fillEllipse(0, 0, 18, 34); leaf.lineStyle(2, hex(C.fern), 1).lineBetween(0, -14, 0, 18).strokeTriangle(-8, 22, 8, 22, 0, 34);
        c.add(leaf);
        if (st.name === 'Bloom') c.add(this.add.text(16, -8, p.slotWord ?? '', { fontFamily: 'JetBrains Mono', fontSize: '14px', fontStyle: 'bold', color: C.fern }));
        this.hintObj = c; this.objs.push(c);
        if (!this.hintOn) this.say('fern', st.name === 'Bloom' ? `Try ${p.slotWord}.` : 'Psst. That one.', 1800);
      }
      this.hintObj.setY(p.def.sy - 52 + Math.sin(this.t * 4) * 6);
      this.hintOn = true; this.hintUsed = true;
    } else if (this.hintObj) { this.hintObj.destroy(); this.hintObj = null; this.hintOn = false; }
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
  /** aim bracket on the auto-aim target (combo range; the beam's longer range while charging) + the charge ring */
  drawAim() {
    const g = this.aimG, cg = this.chargeG; if (!g || !cg) return; g.clear(); cg.clear();
    const holdAim = this.combat ? this.combat.tune.holdBeam : HOLD_T;
    const beamR = this.combat ? this.combat.tune.beamRange : BEAM_R;
    const charging = this.atkPending && this.atkHeldT > holdAim;
    const e = this.aimTarget(charging ? beamR : AIM_R);
    if (e && !this.busy) {
      const b = (e.kind === 'note' ? 26 : 44) + 3 * Math.sin(this.t * 6), cy = e.y - (e.kind === 'note' ? 20 : e.practice ? 70 : 46), h = b * (e.practice ? 1.25 : 0.8), L = 12;
      g.lineStyle(2, hex(C.cyan), charging ? 1 : 0.75);
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const x = e.x + sx * b, y = cy + sy * h; g.lineBetween(x, y, x - sx * L, y).lineBetween(x, y, x, y - sy * L); }
      g.setDepth(e.y + 5);
    }
    if (charging) {
      const u = Math.min(1, (this.atkHeldT - holdAim) / (this.combat ? holdAim : CHARGE_T)), r = 40;
      cg.lineStyle(3, hex(C.cyan), 0.25).strokeCircle(this.x, this.y - 64, r);
      cg.lineStyle(4, hex(u >= 1 ? C.inkBright : C.cyan), 1); cg.beginPath(); cg.arc(this.x, this.y - 64, r, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2); cg.strokePath();
      cg.setDepth(this.y + 4);
    }
  }
  /** HOLD then RELEASE: the typed beam. Auto-aims at the nearest enemy in range; hits everything along the line. */
  fireBeam(charge: number) {
    if (this.combat) { this.combat.fireBeam(); return; }
    const tgt = this.aimTarget(BEAM_R); let v = this.dirVec();
    if (tgt) { const dx = tgt.x - this.x, dy = tgt.y - this.y, l = Math.hypot(dx, dy) || 1; v = { x: dx / l, y: dy / l }; this.dir = DIRS[(Math.round(Math.atan2(v.y, v.x) / (Math.PI / 4)) + 8) % 8]; }
    const L = tgt ? Math.min(BEAM_R, Math.hypot(tgt.x - this.x, tgt.y - this.y) + 50) : 360, x0 = this.x, y0 = this.y;
    const hit = this.enemies.filter(e => { if (e.dead) return false; const t = Phaser.Math.Clamp(((e.x - x0) * v.x + (e.y - y0) * v.y) / L, 0, 1); return Math.hypot(e.x - (x0 + v.x * L * t), e.y - (y0 + v.y * L * t)) < 40; });
    this.selectN++; this.beamN++; this.selectHits += hit.length; this.beamHits += hit.length;
    const dmg = 1 + charge + 0.5 * Math.max(0, hit.length - 1);
    this.noor.play(`noor_type3_${this.dir}`, true); this.swingT = 0.3; sfx('paste');
    for (const e of hit) this.hurtEnemy(e, dmg, v.x * 220, v.y * 220, true);
    if (hit.length) { this.hitStopT = 0.06; this.noor.anims.pause(); this.cameras.main.shake(110, 0.005); if (this.clar && hit.some(e => e.practice)) { this.markTut('o11beam'); this.clar.beamHits++; } }
    if (!this.save.tutorials.includes('select')) { this.save.tutorials.push('select'); }
    // the visual: a stream of typed glyphs racing out, then deleting back
    const str = 'rephrase(this) '.repeat(4), step = 15, n = Math.max(4, Math.floor(L / step)), ox = x0 + v.x * 20, oy = y0 - 52 + v.y * 14;
    const rot = Math.atan2(v.y, v.x), flip = Math.abs(rot) > Math.PI / 2 ? rot + Math.PI : rot;
    const glow = this.add.graphics().setDepth(y0 + 3).setBlendMode(Phaser.BlendModes.ADD); this.objs.push(glow);
    glow.lineStyle(28, hex(C.cyan), 0.14 + 0.1 * charge).lineBetween(ox, oy, ox + v.x * L, oy + v.y * L).lineStyle(2, hex(C.inkBright), 0.6).lineBetween(ox, oy, ox + v.x * L, oy + v.y * L);
    const ch: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < n; i++) { const t = this.glyph(ox + v.x * step * (i + 0.5), oy + v.y * step * (i + 0.5) + Math.sin(i * 0.9) * 3, str[i % str.length], i > n - 4 && hit.length ? C.lamp : C.cyan, 19, y0 + 4).setRotation(flip).setAlpha(0); ch.push(t); this.tweens.add({ targets: t, alpha: 1, delay: i * 6, duration: 40 }); }
    this.time.delayedCall(n * 6 + 160, () => { ch.forEach((t, i) => this.tweens.add({ targets: t, alpha: 0, y: t.y - 6, delay: (n - i) * 5, duration: 90, onComplete: () => t.destroy() })); this.tweens.add({ targets: glow, alpha: 0, duration: 260, delay: 80, onComplete: () => glow.destroy() }); });
    if (tgt) this.fragments(tgt.x, tgt.y - 50, 'rephrase', hit.length ? C.lamp : C.cyan, 8);
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
    if (this.transitioning) return; this.transitioning = true;
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
    T(120, 570, LINES.map((l, i) => this.save.lines.includes(l.id) ? `  ${i + 1}  ${l.text}` : `  ${i + 1}  ${'\u2591'.repeat(18)}`).join('\n'), 13, C.ink, 400, 'IBM Plex Mono');
    T(820, 680, '"Beta, eat properly."', 13, C.faint, 400, 'IBM Plex Mono');
    this.pauseUi = c;
  }

  setReduceMotion(on: boolean) { this.save.settings = { ...(this.save.settings ?? {}), reduceMotion: on }; writeSave(this.save); }
  // ---------- main loop ----------
  update(_t: number, dms: number) {
    const dt = Math.min(dms / 1000, 0.05);
    const f: Frame = this.ctl.read();
    if (f.pause && this.clar?.modal) { this.clar.closeAll(); f.pause = false; }
    if (f.pause && !this.dying) this.togglePause();
    if (this.paused) return;
    this.t += dt;
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
    if (this.clar?.modal && f.interact && !(this.impactLab?.stealMode || this.impactLab?.on)) { this.clar.interact(); f.interact = false; }
    const control = !this.busy && !this.dying && !this.transitioning && !this.clar?.modal;
    let mx = control ? f.mx : 0, my = control ? f.my : 0;
    if (control && f.dash && this.dashCd <= 0 && this.dashT <= 0) {
      const v = Math.hypot(mx, my) > 0.1 ? { x: mx, y: my } : this.dirVec();
      const l = Math.hypot(v.x, v.y) || 1; this.dashVec = { x: v.x / l, y: v.y / l };
      this.dashT = DASH_T; this.dashCd = DASH_CD; this.iframes = Math.max(this.iframes, DASH_T + 0.06);
      this.dir = DIRS[(Math.round(Math.atan2(this.dashVec.y, this.dashVec.x) / (Math.PI / 4)) + 8) % 8];
      this.noor.play(`noor_dash_${this.dir}`, true); this.dashKick(); this.trailT = 0;
    }
    if (control && f.dash && this.dashT === DASH_T) { this.dashStartAt = this.t; sfx('dash'); }
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
      if (control && f.attackHeld) { this.atkHeldT += dt; this.selecting = this.atkHeldT > holdT; }
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
    if (!this.dying && this.dashT <= 0 && this.hazards.some(h => inR(h, this.x, this.y))) {
      this.tweens.add({ targets: this.noor, scaleX: 0.3, scaleY: 0.3, alpha: 0, duration: 200 }); this.die();
    }
    // facing + animation
    if (Math.hypot(mx, my) > 0.1 && this.swingT <= 0) this.dir = DIRS[(Math.round(Math.atan2(my, mx) / (Math.PI / 4)) + 8) % 8];
    const moving = Math.hypot(this.x - ox, this.y - oy) > 0.5;
    const cur = this.noor.anims.currentAnim?.key ?? '';
    const held = /^noor_(attack|dash|type|combo|peel|throw|release|charge)/.test(cur) || (Math.hypot(mx, my) < 0.1 && /^noor_(phone|shadow|surprise|look)/.test(cur));   // art-v9 reactions hold while still
    if (!held || !this.noor.anims.isPlaying) {
      let want = `noor_${moving && this.dashT <= 0 && !held ? 'walk' : 'idle'}_${this.dir}`;
      const fi = this.noor.anims.currentFrame?.index ?? 1, nf = this.noor.anims.currentAnim?.frames.length ?? 1;
      // art-v10: stopping finishes the step to the next planted-feet frame (0 or n/2) instead of popping to idle mid-stride
      if (!moving && cur.startsWith('noor_walk_') && !held) {
        this.stopT += dt; const planted = fi === 1 || fi === 1 + Math.floor(nf / 2);
        if (!planted && this.stopT < 0.22) want = cur;
      } else this.stopT = 0;
      if (cur !== want && !(held && /look/.test(cur))) {
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
    this.noor.setPosition(this.x, this.y).setDepth(this.y).setAlpha(this.dying ? this.noor.alpha : this.iframes > 0 && this.dashT <= 0 ? 0.6 + 0.4 * Math.sin(this.t * 40) : 1);
    this.shadow.setPosition(this.x, this.y + 2).setDepth(this.y - 2);
    if (this.caret.visible) { this.caret.x += (this.x - 46 - this.caret.x) * Math.min(1, dt * 6); this.caret.y += (this.y - 56 - this.caret.y) * Math.min(1, dt * 6); this.caret.setDepth(this.y + 1); }
    this.darkness?.setPosition(this.x, this.y - 30);

    if (control && f.interact && !this.composer && !(this.impactLab?.stealMode || this.impactLab?.on)) this.interact();
    this.words.update(dt, (this.impactLab?.stealMode || this.impactLab?.on) ? false : f.interactHeld);
    this.drawLitMask();
    this.updateLinger(dt, Math.hypot(this.x - ox, this.y - oy) > 0.5 || Math.hypot(mx, my) > 0.1 || f.interactHeld);
    this.clar?.update(dt, moving || Math.hypot(mx, my) > 0.1);
    this.combat?.update(dt);
    this.impactLab?.update(dt);
    if (this.office) {
      this.office.update(dt, moving || Math.hypot(mx, my) > 0.1, mx, my, control && f.interact);
      if (this.words.codeA > 0.5 && this.words.codeLines.some(l => l.plate.def.id === 'o_monitor')) this.office.claim(false);
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
    this.combo = this.comboT > 0 ? (this.combo % 3) + 1 : 1;
    const hit = this.combo; this.comboT = 0.5; this.swingT = hit === 3 ? 0.30 : 0.2;
    // art-v11: auto-aim at the nearest enemy in range (turn to it, small step in if it is just out of reach)
    const tg = this.aimTarget(AIM_R); let v = this.dirVec();
    if (tg) { const dx = tg.x - this.x, dy = tg.y - this.y, l = Math.hypot(dx, dy) || 1; v = { x: dx / l, y: dy / l }; this.dir = DIRS[(Math.round(Math.atan2(v.y, v.x) / (Math.PI / 4)) + 8) % 8]; if (l > 74) this.slide(v.x * Math.min(26, l - 70), v.y * Math.min(26, l - 70)); }
    if (this.combat?.usingSheets) this.noor.play(`noor_combo${hit}_${this.dir}`, true);
    else this.noor.play(`noor_type${hit}_${this.dir}`, true);
    const a0 = Math.atan2(v.y, v.x), ox = this.x, oy = this.y;
    // damage lands on the sheet's hit_frame (type1/2 frame 2 @24 fps, type3 frame 3 @22 fps); anticipation frames read first
    const at = hit === 3 ? 120 : 70;
    this.time.delayedCall(at, () => {
      const struck: Enemy[] = [];
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy);
        let da = Math.abs(Math.atan2(dy, dx) - a0); if (da > Math.PI) da = 2 * Math.PI - da;
        if (d < 92 && (da < 1.3 || d < 30)) { struck.push(e); this.hurtEnemy(e, hit === 3 ? 2 : 1, v.x * 140, v.y * 140, hit === 3); }
      }
      if (struck.some(e => e.practice) && this.clar) { this.clar.comboHits++; this.comboHits++; if (hit === 3) this.markTut('o11combo'); }
      if (struck.length) {
        this.combat?.onComboHit(hit);
        const d = struck.find(e => e.practice) ?? struck[0];
        if (d.practice && this.impactLab) {
          // ImpactFX owns freeze / spark / tint (light) or silhouette (heavy on 3rd)
          const spr = d.g.list.find(o => (o as Phaser.GameObjects.Image).texture) as Phaser.GameObjects.Image | undefined;
          this.impactLab.onDummyHit(d.x, d.y - 40, hit, spr);
        } else {
          const stops = this.combat?.tune.hitStop ?? [0.05, 0.06, 0.09];
          this.hitStopT = stops[hit - 1] ?? 0.05; this.noor.anims.pause();
          this.cameras.main.shake(hit === 3 ? 110 : 70, hit === 3 ? 0.006 : 0.003);
        }
      }
      if (hit === 1) this.fxJab(v, struck.length > 0);
      else if (hit === 2) this.fxSlash(a0, struck.length > 0);
      else this.fxTypedLine(v, struck, ox, oy);
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
  /** hit 1, the jab: a sharp caret stab (^ turned toward the target) that flashes out and snaps back, glyph sparks at the tip */
  fxJab(v: { x: number; y: number }, hit: boolean) {
    const ox = this.x + v.x * 14, oy = this.y - 34 + v.y * 8, L = 104, a = Math.atan2(v.y * 0.75, v.x), ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const g = this.add.graphics().setDepth(this.y + 3).setBlendMode(Phaser.BlendModes.ADD); this.objs.push(g);
    const draw = (k: number, col: number, w: number) => {
      const tx = ox + ux * L * k, ty = oy + uy * L * k;
      g.fillStyle(col, 0.95).fillTriangle(ox + nx * w, oy + ny * w, ox - nx * w, oy - ny * w, tx, ty);
      // the caret's two arms at the tip: ^ shape
      g.lineStyle(4, 0xe6fcfc, 1).beginPath(); g.moveTo(tx - ux * 20 + nx * 13, ty - uy * 20 + ny * 13); g.lineTo(tx, ty); g.lineTo(tx - ux * 20 - nx * 13, ty - uy * 20 - ny * 13); g.strokePath();
    };
    const o = { k: 0 };
    this.tweens.add({ targets: o, k: 1, duration: 55, ease: 'Quad.easeOut', onUpdate: () => { g.clear(); draw(o.k, hex(hit ? C.lamp : C.cyan), 9); g.lineStyle(2, 0xffffff, 0.9).lineBetween(ox, oy, ox + ux * L * o.k, oy + uy * L * o.k); },
      onComplete: () => this.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() }) });
    const tip = { x: ox + ux * L, y: oy + uy * L };
    const ring = this.add.circle(tip.x, tip.y, 6, 0xe6fcfc, 0.9).setDepth(this.y + 4).setBlendMode(Phaser.BlendModes.ADD); this.objs.push(ring);
    this.tweens.add({ targets: ring, scale: hit ? 4.2 : 2.6, alpha: 0, duration: 170, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    const sp = hit ? '^*;:.,' : '^.';
    for (let i = 0; i < (hit ? 9 : 4); i++) {
      const t = this.glyph(tip.x, tip.y, sp[i % sp.length], i % 3 === 0 ? C.inkBright : hit ? C.lamp : C.cyan, 14 + (i % 3) * 4, this.y + 4);
      const aa = a + (Math.random() - 0.5) * 1.9, r = 30 + Math.random() * 44;
      this.tweens.add({ targets: t, x: tip.x + Math.cos(aa) * r, y: tip.y + Math.sin(aa) * r * 0.8, angle: (Math.random() - 0.5) * 300, alpha: 0, duration: 260 + Math.random() * 140, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
    }
  }
  /** hit 2, the side slash: a bright arc ribbon sweeps the swing, with the word's characters streaming along it */
  fxSlash(a0: number, hit: boolean) {
    const word = 'backspace'; const n = word.length; const ccw = this.dir.length === 1 ? 1 : -1;
    const cx = this.x, cy = this.y - 32, R0 = 44, R1 = 82, span = 2.3, sx = 1, sy = 0.72;
    const g = this.add.graphics().setDepth(this.y + 3).setBlendMode(Phaser.BlendModes.ADD); this.objs.push(g);
    const col = hex(hit ? C.lamp : C.cyan);
    const ribbon = (k: number) => {
      g.clear(); const steps = 18, end = -span / 2 + span * k, start = Math.max(-span / 2, end - 1.5);
      for (let i = 0; i < steps; i++) {
        const t0 = start + (end - start) * i / steps, t1 = start + (end - start) * (i + 1) / steps, f = (i + 1) / steps;
        const A = a0 + ccw * t0, B = a0 + ccw * t1, rr0 = R0 + (R1 - R0) * 0.5 * (1 - f), w = 0.25 + 0.75 * f;
        const p = (ang: number, r: number) => [cx + Math.cos(ang) * r * sx, cy + Math.sin(ang) * r * sy] as const;
        const [x1, y1] = p(A, rr0), [x2, y2] = p(A, R1), [x3, y3] = p(B, R1), [x4, y4] = p(B, rr0);
        g.fillStyle(col, 0.55 * w).fillTriangle(x1, y1, x2, y2, x3, y3).fillTriangle(x1, y1, x3, y3, x4, y4);
      }
      const [ex, ey] = [cx + Math.cos(a0 + ccw * end) * R1 * sx, cy + Math.sin(a0 + ccw * end) * R1 * sy];
      g.lineStyle(3, 0xffffff, 0.95).beginPath(); g.arc(cx, cy, R1, a0 + ccw * start, a0 + ccw * end, ccw < 0); g.strokePath();
      g.fillStyle(0xffffff, 1).fillCircle(ex, ey, 4);
    };
    g.setScale(1, 1);
    const o = { k: 0 };
    this.tweens.add({ targets: o, k: 1, duration: 110, ease: 'Sine.easeOut', onUpdate: () => ribbon(o.k), onComplete: () => this.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() }) });
    for (let i = 0; i < n; i++) {
      const t = this.glyph(cx, cy, word[i], i === n - 1 ? C.inkBright : hit ? C.lamp : C.cyan, 19, this.y + 4).setAlpha(0);
      const p = { u: -span / 2 - 0.3 };
      this.tweens.add({ targets: p, u: span / 2 - (n - 1 - i) * 0.16, delay: i * 9, duration: 150, ease: 'Sine.easeOut',
        onUpdate: () => { const ang = a0 + ccw * p.u, r = (R0 + R1) / 2 + 6; t.setPosition(cx + Math.cos(ang) * r * sx, cy + Math.sin(ang) * r * sy).setRotation(ang + Math.PI / 2).setAlpha(1); },
        onComplete: () => this.tweens.add({ targets: t, alpha: 0, y: t.y - 8, duration: 160, onComplete: () => t.destroy() }) });
    }
    if (hit) this.fragments(this.x + Math.cos(a0) * 70, this.y - 32 + Math.sin(a0) * 46, 'ksp', C.lamp, 7);
  }
  /** hit 3, the slam: a line of typed characters writes out fast with a blinking caret head and a scanline glow,
   *  then deletes itself backwards from the tip, spitting letter fragments (amber when it connects). */
  fxTypedLine(v: { x: number; y: number }, struck: Enemy[], ox: number, oy: number) {
    const words = ['rewrite();', 'undo_all;', 'git push', 'delete();', 'ctrl+z;;']; const str = words[(Math.random() * words.length) | 0];
    const L = 124, n = str.length, step = L / n, a = Math.atan2(v.y * 0.72, v.x), ux = Math.cos(a), uy = Math.sin(a);
    const x0 = ox + ux * 22, y0 = oy - 30 + uy * 16; const dep = oy + 3;
    const glow = this.add.graphics().setDepth(dep - 0.5).setBlendMode(Phaser.BlendModes.ADD); this.objs.push(glow);
    const caret = this.add.rectangle(x0, y0, 10, 24, hex(C.inkBright), 1).setRotation(a).setDepth(dep + 0.5); this.objs.push(caret);
    const chars: Phaser.GameObjects.Text[] = []; const amber = struck.length > 0;
    const drawGlow = (len: number, col: number) => {
      glow.clear(); const nx = -uy, ny = ux;
      glow.lineStyle(26, col, 0.16).lineBetween(x0, y0, x0 + ux * len, y0 + uy * len);
      for (let k = -2; k <= 2; k++) glow.lineStyle(1, col, 0.22).lineBetween(x0 + nx * k * 4, y0 + ny * k * 4, x0 + ux * len + nx * k * 4, y0 + uy * len + ny * k * 4);
    };
    let i = 0;
    const write = this.time.addEvent({ delay: 9, repeat: n - 1, callback: () => {
      const t = this.glyph(x0 + ux * step * (i + 0.5), y0 + uy * step * (i + 0.5), str[i], C.cyan, 20, dep).setRotation(Math.abs(a) > Math.PI / 2 ? a + Math.PI : a);
      chars.push(t); i++; caret.setPosition(x0 + ux * step * i, y0 + uy * step * i); drawGlow(step * i, hex(C.cyan));
      caret.setAlpha(i % 2 ? 1 : 0.35);
      if (i === n) impact();
    } });
    const impact = () => {
      const tx = x0 + ux * L, ty = y0 + uy * L;
      if (amber) { caret.setFillStyle(hex(C.lamp)); chars.slice(-3).forEach(c => c.setColor(C.lamp)); drawGlow(L, hex(C.lamp)); }
      this.fragments(tx, ty, str.replace(/[^a-z]/g, '') || 'xyz', amber ? C.lamp : C.cyan, amber ? 8 : 5);
      // delete backwards from the tip
      let k = chars.length;
      this.time.addEvent({ delay: 14, repeat: chars.length, callback: () => {
        k--; if (k >= 0) { const c = chars[k]; this.tweens.add({ targets: c, alpha: 0, y: c.y - 6, duration: 90, onComplete: () => c.destroy() }); caret.setPosition(x0 + ux * step * k, y0 + uy * step * k); drawGlow(step * Math.max(0, k), amber ? hex(C.lamp) : hex(C.cyan)); }
        if (k <= 0) { caret.destroy(); glow.destroy(); }
      } });
    };
    void write;
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
    const t = this.glyph(this.x - this.dashVec.x * 14 + (Math.random() - 0.5) * 8, this.y - 26 - Math.random() * 30, ch, Math.random() < 0.25 ? C.inkBright : C.cyan, 18 + ((Math.random() * 8) | 0), this.y - 1);
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
      state: this.paused ? 'paused' : this.busy ? 'cutscene' : 'play', room: this.room.id, player: { x: this.x, y: this.y }, hp: this.hp,
      dashCd: this.dashCd, dashing: this.dashT > 0, iframes: this.iframes, dying: this.dying, undoShown: this.undoShown, lastRespawnMs: this.lastRespawnMs,
      caption: this.words.segs.map(q => q.full).join(''), heading: this.words.heading.text, chips: this.words.chipPositions(), handChip: { x: this.hud.hand.x, y: this.hud.hand.y },
      codeView: this.words.codeA > 0.5, codeLines: this.words.codeLines.map(l => l.objs.map(t => t.text).join('')), noorLine: this.words.codeA > 0.5 ? this.words.noorLine?.text : null, lens: this.words.lensA > 0.5 && !!this.words.secret, secretText: (this.words.secretText?.alpha ?? 0) > 0.5 ? this.words.secretText!.text : null, secrets: this.words.secretsFound(),
      hand: this.hand, flags: { ...this.flags },
      cam: { x: this.cameras.main.x, y: this.cameras.main.y, w: this.cameras.main.width, h: this.cameras.main.height, zoom: this.cameras.main.zoom, bottom: Math.min(this.cameras.main.y + this.cameras.main.height, this.vm ? 9999 : this.toScreen(640, 720).y), barY: BAR_Y },
      office9: this.office ? this.office.state() : null, clar: this.clar ? this.clar.state() : null, combat: this.combat ? this.combat.state() : null, beamN: this.beamN, beamHits: this.beamHits, attackPending: this.atkPending, sub: this.hud.sub.visible ? this.hud.sub.text : '', captionRows: this.words.rowInfo(),
      amb: this.amb.map(a => ({ name: a.def.name, w: a.def.w, h: a.def.h, state: a.def.state, visible: a.spr.visible, frame: Number(a.spr.frame.name), frames: a.def.frames, dir: a.dir })),
      looks: this.plates.filter(p => p.def.kind === 'look' || p.def.toy).map(p => p.def.id), lineIds: this.plates.filter(p => p.def.kind === 'line').map(p => ({ id: p.def.id, visible: p.visible })),
      ghostTex: this.words.ghost?.texture.key ?? null, idleT: this.idleT, refl: this.refl ? { visible: this.refl.visible, x: this.refl.x } : null,
      corridorBars: this.children.list.some(o => o.name === 'pathbars'), plates: Object.fromEntries(this.plates.map(p => [p.def.id, { words: p.words.join(' '), visible: p.visible, focused: p.focused }])),
      enemies: this.enemies.map(e => ({ kind: e.kind, x: e.x, y: e.y, hp: e.hp, dead: e.dead, state: e.state })),
      prompts: this.prompts.filter(p => p.text.alpha > 0.1).map(p => p.text.text), inputKind: this.ctl.last,
      hintOn: this.hintOn, stuck: this.stuck, timeScale: this.timeScale, stored: this.stored, perfectN: this.perfectN, pasteN: this.pasteN, selectN: this.selectN, selectHits: this.selectHits, rootN: this.rootN, rootUsed: this.rootUsed, rewriteN: this.rewriteN, cutscene: this.cutscene?.id ?? null,
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
      readAll: () => { this.inspectOff = true; setTimeout(() => { this.inspectOff = false; }, 0); for (const p of this.plates) if (p.visible && (p.def.kind === 'look' || p.def.kind === 'lore' || p.def.toy) && !(p.def.id === 'o_monitor')) { this.read(p); if (this.hand) { this.plateById(this.hand.from)?.setOpts({ selected: false }); this.hand = null; } } return this.save.tutorials.includes('all:' + this.room.id); },
      idle: (s: number) => { this.idleT = s; },
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
      damageAll: () => { for (const e of this.enemies) if (!e.dead) { if (e.kind === 'dummy' && !this.flags.quick) continue; this.hurtEnemy(e, 99, 0, 0); } },
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
    };
  }
}
