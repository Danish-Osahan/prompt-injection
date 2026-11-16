// Dead-lift beat (?impact): peel SPARK from flickering desk lamp → F-zap into dead call panel → lift opens.
// Panel sits on the wall beside the lift doors (baked plate, never kitchen/printer). Old word system off.
import Phaser from 'phaser';
import type { GameScene } from '../game';
import { O11_DOOR } from '../office11art';
import { ImpactFX } from './ImpactFX';
import { OnboardLure } from './OnboardLure';
import { sfx } from '../sfx';
import { writeSave } from '../save';
import { showControlsHint, focusGameCanvas } from '../flow';
import type { Frame } from '../controls';
import { launchAnimatedBolt, playThrowAttack } from './qualityShot';

/**
 * v15j layered lift + banker desk lamp, rendered in Blender 4.2.9 LTS at the office plate
 * camera (ortho 8.4, pitch 38, yaw -30). Geometry matches assets/fx/lift_layers/meta.json.
 * Lift sits IN the baked back-wall recess. Camera is static zoom 1. Office uses office_bleed.jpg.
 */
/** Baked recess measured from office.jpg: doors x≈149–260, y≈81–200. */
const LIFT_OPEN = { x: 150, y: 81, w: 110, h: 119 }; // bottom = 200
/** Cropped Blender frame layer (includes a 3D sill that sits on the floor). */
const LIFT_FRAME_OUTER = { x: 140, y: 72, w: 130, h: 141 }; // bottom 213
const LIFT_LEAF_W = 59;
const LEAF_L0 = { x: 148, y: 79 };
const LEAF_R0 = { x: 203, y: 79 };
const WALL_COVER_ORIG = { x: 143, y: 74 };
const WALL_FLOOR_Y = 202;
/** Call panel (Blender layer at 265,151, 22×31) — center, hand height, right of the frame. */
const PANEL = { x: 276, y: 167 };
const PANEL_SPRITE = { x: 265, y: 151 };
/** Desk lamp interact / spark point. Sprite is placed at LAMP_SPRITE with origin 0,0. */
const LAMP = { x: 180, y: 300 };
const LAMP_SPRITE = { x: 154, y: 270 };
const LAMP_SCALE = 0.92;
const SEAM_POS = { x: 202, y: 81 };
const SPILL_POS = { x: 140, y: 202 };
const IND_OFF_POS = { x: 193, y: 69 };
const IND_ON_POS = { x: 190, y: 64 };
const LIFT_FOCUS = { x: LIFT_OPEN.x + LIFT_OPEN.w / 2, y: LIFT_OPEN.y + LIFT_OPEN.h / 2 };
/** Opening + frame bounds in world space (for capture asserts). */
export const LIFT_OPEN_BOUNDS = {
  left: LIFT_OPEN.x,
  right: LIFT_OPEN.x + LIFT_OPEN.w,
  top: LIFT_OPEN.y,
  bottom: LIFT_OPEN.y + LIFT_OPEN.h,
  frameLeft: LIFT_FRAME_OUTER.x,
  frameRight: LIFT_FRAME_OUTER.x + LIFT_FRAME_OUTER.w,
  frameTop: LIFT_FRAME_OUTER.y,
  frameBottom: LIFT_FRAME_OUTER.y + LIFT_FRAME_OUTER.h,
  wallFloorY: WALL_FLOOR_Y,
};

export class ImpactLab {
  on = false;
  stealMode = false;
  lampReady = false;
  fx!: ImpactFX;
  lure?: OnboardLure;
  carrying = false;
  flying = false;
  done = false;
  /** Exposed for capture scripts — true while silhouette impact frames are up. */
  impactFrame = false;
  hint?: Phaser.GameObjects.Text;
  private keyF?: Phaser.Input.Keyboard.Key;
  private keyI?: Phaser.Input.Keyboard.Key;
  peelT = 0;
  private peelNeed = 0.5;
  private wasHolding = false;
  private holdKind: 'panel' | 'lamp' | null = null;
  private lampHinted = false;
  private panelTried = false;
  private lampSpr?: Phaser.GameObjects.Image;
  private liftCab?: Phaser.GameObjects.Image;
  private panelSpr?: Phaser.GameObjects.Image;
  private floorInd?: Phaser.GameObjects.Image;
  private heldOrb?: Phaser.GameObjects.Container;
  private bolt?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Ellipse;
  private boltT = 0;
  private boltBeam?: Phaser.GameObjects.Graphics;
  private cover?: Phaser.Physics.Matter.Image;
  private buzzT = 0;
  private lampOn = true;
  private darkGap?: Phaser.GameObjects.Rectangle;
  private framing = false; // scripted cam during throw/open
  private draining = false;
  private throwQueued = false;
  private drainT = 0;
  private drainShook = false;
  private drainG?: Phaser.GameObjects.Graphics;
  private drainVeil?: Phaser.GameObjects.Ellipse;
  private drainBloom?: Phaser.GameObjects.Ellipse;
  private leafL?: Phaser.GameObjects.Image;
  private leafR?: Phaser.GameObjects.Image;
  private liftFrame?: Phaser.GameObjects.Image;
  private liftRecess?: Phaser.GameObjects.Image;
  private liftDoorK = 0; // 0 shut … 1 open (layered leaves)
  private wallPatch?: Phaser.GameObjects.Rectangle;
  private wallCover?: Phaser.GameObjects.Image;
  private liftSeam?: Phaser.GameObjects.Image;
  private liftSpill?: Phaser.GameObjects.Image;
  private openingMaskGfx?: Phaser.GameObjects.Graphics;
  private openingMask?: Phaser.Display.Masks.GeometryMask;
  private leafAnimToken = 0;

  constructor(private s: GameScene) {
    this.fx = new ImpactFX(s);
  }

  state() {
    return {
      on: this.on, lampReady: this.lampReady, carrying: this.carrying, draining: this.draining,
      flying: this.flying, done: this.done, peelT: this.peelT, holdKind: this.holdKind,
    };
  }

  start() {
    if (this.on) return;
    this.on = true;
    this.stealMode = true;

    const alreadyOpen = this.s.plateById('o_door')?.slotWord === 'OPEN';
    this.lampReady = !!this.s.labMode || alreadyOpen;
    if (!alreadyOpen) {
      const door = this.s.plateById('o_door');
      if (door && door.slotWord !== 'SHUT') {
        door.setSlotWord('SHUT');
        this.s.save.plates[door.def.id] = 'SHUT';
        this.s.evaluate(true);
      }
    }

    this.suppressWordUi(true);
    this.hideKitchen(true);
    this.spawnProps();
    this.setupLure();

    const debug = new URLSearchParams(location.search).has('debug');
    if (debug) {
      this.hint = this.s.add.text(640, 40, 'DEAD LIFT  ·  hold E at lamp  ·  F panel', {
        fontFamily: 'IBM Plex Mono', fontSize: '13px', color: '#7ec8e3',
        backgroundColor: 'rgba(4,10,16,0.65)', padding: { x: 8, y: 4 },
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setScrollFactor(0).setDepth(9500);
      this.s.objs.push(this.hint);
    }

    this.keyF = this.s.input.keyboard?.addKey('F');
    // Whole office visible and crisp — no follow punch-in.
    this.s.setupStaticCamera?.();
    // ?impact lab still drops Noor by the lamp; normal play keeps the room spawn / checkpoint.
    if (this.s.labMode) {
      this.s.x = LAMP.x + 36; this.s.y = LAMP.y + 48; this.s.dir = 'NW';
      this.s.unstick();
    }

    if (alreadyOpen) this.restoreOpen();
    else this.greetWhenReady();
  }

  private greeted = false;
  private greetWhenReady() {
    if (this.greeted || !this.on) return;
    if (this.s.introPending || this.s.intro?.playing || this.s.roomCard || this.s.introCardPending) {
      this.s.time.delayedCall(300, () => this.greetWhenReady());
      return;
    }
    this.greeted = true;
    // Meeting already happened in the hook (or was skipped). Ease into play
    // with the controls hint only — no second monologue, no jump-cut to silence.
    try { focusGameCanvas(this.s); } catch { /* */ }
    showControlsHint(this.s);
  }

    /** Resume a solved office: doors already OPEN from the save. */
  private restoreOpen() {
    this.done = true;
    this.lampOn = false;
    this.carrying = false;
    this.lure?.destroy(); this.lure = undefined;
    if (this.lampSpr && this.s.textures.exists('fx_lamp_off')) this.lampSpr.setTexture('fx_lamp_off').setAlpha(1);
    this.applyLiftDoorK(1);
    if (this.s.clar) {
      this.s.clar.doorWant = 1;
      this.s.clar.doorK = 1;
      if (this.s.clar.door) this.s.clar.door.setVisible(false);
    }
    this.s.extraWalk.lift = { x: 155, y: 150, w: 100, h: 60 };
  }

  stop() {
    this.on = false;
    this.stealMode = false;
    this.framing = false;
    this.lure?.destroy(); this.lure = undefined;
    this.hint?.destroy(); this.hint = undefined;
    this.clearCarryFx();
    this.lampSpr?.destroy(); this.panelSpr?.destroy();
    try { this.leafL?.setCrop(); } catch { /* */ }
    try { this.leafR?.setCrop(); } catch { /* */ }
    this.openingMask = undefined;
    this.openingMaskGfx?.destroy(); this.openingMaskGfx = undefined;
    this.liftCab?.destroy(); this.liftCab = undefined;
    this.leafL?.destroy(); this.leafL = undefined;
    this.leafR?.destroy(); this.leafR = undefined;
    this.liftFrame?.destroy(); this.liftFrame = undefined;
    this.liftRecess?.destroy(); this.liftRecess = undefined;
    this.wallPatch?.destroy(); this.wallPatch = undefined;
    this.wallCover?.destroy(); this.wallCover = undefined;
    this.liftSeam?.destroy(); this.liftSeam = undefined;
    this.liftSpill?.destroy(); this.liftSpill = undefined;
    this.floorInd?.destroy(); this.darkGap?.destroy();
    if (this.s.clar?.door) this.s.clar.door.setVisible(true);
    this.cover?.destroy();
    this.suppressWordUi(false);
    this.hideKitchen(false);
  }

  private kitchenIm?: Phaser.GameObjects.Image;
  private hideKitchen(on: boolean) {
    if (!this.kitchenIm) {
      for (const o of this.s.objs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const im = o as any;
        if (im?.texture?.key === 'o11fg_kitchen') { this.kitchenIm = im; break; }
      }
    }
    if (this.kitchenIm) this.kitchenIm.setAlpha(on ? 0 : 1);
  }

  suppressWordUi(on: boolean) {
    const s = this.s;
    if (s.clar?.objective) s.clar.objective.setVisible(false);
    if (s.clar) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = s.clar as any;
      if (c.capMsg) c.capMsg = null;
      if (c.modal) { try { c.modal.destroy(); } catch { /* */ } c.modal = null; }
    }
    try {
      s.hud.hand.setVisible(!on);
      s.words.chipG.setVisible(false);
      s.words.heading.setVisible(false);
      s.words.pil.setVisible(false);
      if (on) {
        s.hand = null;
        s.words.codeOn = false;
        s.words.codeA = 0;
        s.words.held = 0;
        s.words.clearCode?.();
      }
    } catch { /* */ }
  }

  private spawnProps() {
    // Depth at the wall-floor line so plant/printer/desks (baseY 229+) draw in front.
    const depth = WALL_FLOOR_Y; // 202; above baked plate (-999)

    // Hide baked JPG door frames — we composite layered sprites instead
    if (this.s.clar?.door) {
      this.s.clar.door.setVisible(false);
      this.s.clar.doorK = 0;
      this.s.clar.doorWant = 0;
    }

    // Tight wall cover over the baked recess only (plate-sampled, feathered).
    if (this.s.textures.exists('lift_wall_cover')) {
      const wc = this.s.add.image(WALL_COVER_ORIG.x, WALL_COVER_ORIG.y, 'lift_wall_cover')
        .setOrigin(0, 0).setDepth(depth - 6);
      this.s.objs.push(wc);
      this.wallPatch = undefined;
      this.wallCover = wc;
    } else {
      this.wallPatch = this.s.add.rectangle(
        LIFT_FRAME_OUTER.x + LIFT_FRAME_OUTER.w / 2,
        LIFT_FRAME_OUTER.y + LIFT_FRAME_OUTER.h / 2,
        LIFT_FRAME_OUTER.w, LIFT_FRAME_OUTER.h, 0x161c22, 1,
      ).setDepth(depth - 6);
      this.s.objs.push(this.wallPatch);
    }

    // (a) recess
    if (this.s.textures.exists('lift_recess')) {
      this.liftRecess = this.s.add.image(LIFT_OPEN.x, LIFT_OPEN.y, 'lift_recess')
        .setOrigin(0, 0).setDepth(depth - 4);
      this.s.objs.push(this.liftRecess);
    }

    // Phaser 4 WebGL: GeometryMask is Canvas-only (no-op here). Clip leaves with
    // setCrop so pocket slides never draw outside the steel opening.

    // (d) cab behind leaves
    if (this.s.textures.exists('lift_cab')) {
      this.liftCab = this.s.add.image(147, 82, 'lift_cab')
        .setOrigin(0, 0).setDepth(depth - 3).setAlpha(1);
      this.s.objs.push(this.liftCab);
    }

    // (c) door leaves — closed over cab; cropped to opening so slides vanish into pockets
    if (this.s.textures.exists('lift_leaf_l')) {
      this.leafL = this.s.add.image(LEAF_L0.x, LEAF_L0.y, 'lift_leaf_l')
        .setOrigin(0, 0).setDepth(depth - 1);
      this.s.objs.push(this.leafL);
    }
    if (this.s.textures.exists('lift_leaf_r')) {
      this.leafR = this.s.add.image(LEAF_R0.x, LEAF_R0.y, 'lift_leaf_r')
        .setOrigin(0, 0).setDepth(depth - 1);
      this.s.objs.push(this.leafR);
    }
    if (this.s.textures.exists('lift_seam')) {
      this.liftSeam = this.s.add.image(SEAM_POS.x, SEAM_POS.y, 'lift_seam')
        .setOrigin(0, 0).setDepth(depth - 0.5);
      this.s.objs.push(this.liftSeam);
    }
    this.clipLeavesToOpening();

    // (b) steel frame UNMASKED on top of leaf edges
    if (this.s.textures.exists('lift_frame')) {
      this.liftFrame = this.s.add.image(LIFT_FRAME_OUTER.x, LIFT_FRAME_OUTER.y, 'lift_frame')
        .setOrigin(0, 0).setDepth(depth);
      this.s.objs.push(this.liftFrame);
    }

    // Floor indicator just above the lintel
    const indTex = this.s.textures.exists('lift_ind_off') ? 'lift_ind_off' : 'fx_lift_floor_ind_off';
    if (this.s.textures.exists('lift_ind_off') || this.s.textures.exists(indTex)) {
      this.floorInd = this.s.add.image(IND_OFF_POS.x, IND_OFF_POS.y, this.s.textures.exists('lift_ind_off') ? 'lift_ind_off' : indTex)
        .setDepth(depth + 1).setOrigin(0, 0);
      this.s.objs.push(this.floorInd);
    }

    // (e) call panel ON THE WALL immediately right of the frame
    const ptex = this.s.textures.exists('lift_panel_dead') ? 'lift_panel_dead'
      : (this.s.textures.exists('fx_lift_panel_dead') ? 'fx_lift_panel_dead' : 'fx_spark_core');
    this.panelSpr = this.s.add.image(PANEL_SPRITE.x, PANEL_SPRITE.y, ptex)
      .setDepth(depth + 2).setScale(1).setOrigin(0, 0);
    this.s.objs.push(this.panelSpr);

    // Warm light spilling onto the office floor when the doors open
    if (this.s.textures.exists('lift_spill')) {
      this.liftSpill = this.s.add.image(SPILL_POS.x, SPILL_POS.y, 'lift_spill')
        .setOrigin(0, 0).setDepth(depth + 3).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      this.s.objs.push(this.liftSpill);
    }

    this.liftDoorK = 0;

    // Banker / anglepoise desk lamp ON desk_podW top face (depth above desk baseY 346)
    const ltex = this.s.textures.exists('lift_lamp_on') ? 'lift_lamp_on'
      : (this.s.textures.exists('fx_lamp_on') ? 'fx_lamp_on' : 'fx_spark_core');
    this.lampSpr = this.s.add.image(LAMP_SPRITE.x, LAMP_SPRITE.y, ltex)
      .setDepth(400).setScale(LAMP_SCALE).setOrigin(0, 0).setAlpha(1);
    this.s.objs.push(this.lampSpr);
  }

  private setupLure() {
    const src = this.lampReady ? LAMP : PANEL;
    this.lure = new OnboardLure(this.s, src, PANEL, {
      nearR: 110,
      sourceGlowSize: { w: 22, h: 28 },
      targetGlowSize: { w: 16, h: 22 },
    });
    this.lure.sourceAct = (t) => {
      if (!this.lampOn || !this.lampSpr) return;
      if (!this.lampReady) {
        // Stay fully visible on the desk; only the flicker/sparks wait for the panel.
        this.lampSpr.setAlpha(1);
        return;
      }
      const flick = Math.sin(t * 17) * Math.sin(t * 3.1);
      const on = flick > -0.5;
      const onK = this.s.textures.exists('lift_lamp_on') ? (on ? 'lift_lamp_on' : 'lift_lamp_off')
        : (on ? 'fx_lamp_on' : 'fx_lamp_off');
      if (this.s.textures.exists(onK)) this.lampSpr.setTexture(onK);
      this.lampSpr.setAlpha(on ? 1 : 0.75);
      this.buzzT += 1 / 60;
      if (this.buzzT > 0.4 && Math.random() < 0.06) {
        this.buzzT = 0;
        this.popSpark(LAMP.x, LAMP.y - 22);
        try { sfx('impact_whoosh'); } catch { /* */ }
      }
    };
  }

  private popSpark(x: number, y: number) {
    if (!this.s.textures.exists('fx_spark_pop')) return;
    const sp = this.s.add.image(x, y, 'fx_spark_pop').setDepth(y + 12).setScale(0.9)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.s.tweens.add({
      targets: sp, alpha: 0, scale: 1.7, y: y - 18, duration: 240,
      onComplete: () => sp.destroy(),
    });
  }

  /** Keep the whole office in frame (zoom 1). Punch-in was unreadable on a laptop. */
  private holdStaticCam() {
    this.framing = false;
    this.s.setupStaticCamera?.();
  }

  /** Ease camera to frame Noor + lift together (used for throw / door open). */
  frameLift(_holdMs = 0, _zoom = 1) {
    this.holdStaticCam();
  }

  /** Hold on the lift doors specifically (opening beat). */
  frameDoors(_zoom = 1) {
    this.holdStaticCam();
  }

  onDummyHit(
    x: number, y: number,
    hit = 1,
    target?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  ) {
    if (!this.s.clar?.dummy && !this.on) return;
    const tier = hit >= 3 ? 'heavy' : 'light';
    this.fx.fire({
      tier, x, y, dir: { x: x - this.s.x, y: y - this.s.y },
      attacker: this.s.noor, target, silhouettes: target ? [target] : [],
    });
  }

  /** Last controls frame, set by GameScene.update so we don't call read() twice. */
  frame: Frame | null = null;

  update(dt: number, frame?: Frame | null) {
    if (frame !== undefined) this.frame = frame;
    if (!this.keyI) this.keyI = this.s.input.keyboard?.addKey('I');
    // I toggles the isolated lab only under ?impact — never strip the lift mid-play.
    if (this.s.labMode && Phaser.Input.Keyboard.JustDown(this.keyI!)) {
      if (!this.on) this.start();
      else this.stop();
    }
    if (!this.on) return;

    this.suppressWordUi(true);
    this.impactFrame = !!this.fx.silActive;
    this.lure?.setVerb(this.lampReady ? 'take' : 'try');
    this.lure?.update(dt);
    if (!this.framing) this.s.updateFollowCamera?.();

    // Use the frame already read by GameScene.update — a second read() would
    // clear edge presses. interactHeld still comes from k.E.isDown.
    const f = this.frame;
    const nearLamp = Math.hypot(this.s.x - LAMP.x, this.s.y - LAMP.y) < 130;
    const nearPanel = Math.hypot(this.s.x - PANEL.x, this.s.y - PANEL.y) < 130;
    const held = !!(f && f.interactHeld) && !this.carrying && !this.flying && !this.done && !this.draining;
    const claimed = !!this.s.explore?.claimingE() || !!this.s.nearLostLine();
    const atPanel = nearPanel && !this.lampReady && !claimed;
    const atLamp = nearLamp && this.lampReady && this.lampOn && !claimed;
    const kind: 'panel' | 'lamp' | null = held && atPanel ? 'panel' : held && atLamp ? 'lamp' : null;

    if (kind && !this.wasHolding) {
      // Immediate tap response: the dead panel fizzles and unlocks the lamp.
      if (kind === 'panel') this.tryPanel();
    }
    if (kind === 'lamp') {
      this.peelT += dt;
      try { this.s.noor.play(`noor_type1_${this.s.dir}`, true); } catch { /* */ }
      this.lure?.setVerb(this.lampReady ? 'take' : 'try');
      this.lure?.setHold(this.peelT / this.peelNeed);
      if (this.peelT >= this.peelNeed) {
        this.peelT = 0;
        this.lure?.setHold(0);
        this.takeSpark();
      }
    } else if (kind === 'panel') {
      this.peelT = 0;
      this.lure?.setHold(0);
    } else if (!this.carrying) {
      if (this.wasHolding && this.holdKind === 'lamp' && this.peelT > 0.04 && this.peelT < this.peelNeed && !this.lampHinted) {
        this.lampHinted = true;
        try { this.s.say('fern', 'Hold E. Peel the spark from the lamp.', 2200); } catch { /* */ }
      }
      this.peelT = Math.max(0, this.peelT - dt * 2);
      this.lure?.setHold(this.lampReady && this.peelT > 0.01 ? this.peelT / this.peelNeed : 0);
    }
    this.wasHolding = !!kind;
    this.holdKind = kind;

    if (this.draining) {
      this.drainT += dt;
      this.tickDrain();
      if (this.drainT >= ImpactLab.SPARK_DRAIN) this.finishDrain();
    }

    if (this.carrying && this.heldOrb) {
      const h = this.handOff();
      const hx = this.s.x + h.x, hy = this.s.y + h.y;
      this.heldOrb.setPosition(hx, hy).setDepth(this.s.y + 28);
      const pulse = 1 + Math.sin(this.s.t * 5.2) * 0.08;
      this.heldOrb.setScale(pulse);
      this.tickHeldCrackle(dt, hx, hy);
    }

    if (this.carrying && this.keyF && Phaser.Input.Keyboard.JustDown(this.keyF) && !this.flying) {
      this.throwBolt();
    }

    // Bolt travel + impact are driven by launchAnimatedBolt (see throwBolt).

    // Normal office: walk into the open cab to leave for the hub. Lab stays put.
    if (this.done && !this.s.labMode && !this.s.transitioning) {
      const x = this.s.x, y = this.s.y;
      if (x > 155 && x < 255 && y > 150 && y < 180) this.s.goRoom('hub');
    }
  }

  /** Seconds for the lamp-peel stream. Keep in the 0.6–0.9s window. */
  static readonly SPARK_DRAIN = 0.82;

  /** Palm on the reaching side, mid-torso — never over the head. */
  private handOff() {
    const d = this.s.dir || 'S';
    let vx = 0, vy = 0;
    if (d.includes('E')) vx += 1;
    if (d.includes('W')) vx -= 1;
    if (d.includes('S')) vy += 1;
    if (d.includes('N')) vy -= 1;
    const l = Math.hypot(vx, vy) || 1;
    vx /= l; vy /= l;
    // Lateral from the torso, kept low. In this camera the head occupies the
    // upper facing side, so a "toward the lamp" offset would sit on her face.
    const side = vx >= 0 ? 1 : -1;
    return { x: side * 30 + vx * 4, y: -16 + Math.max(-2, vy * 6) };
  }

  private faceLamp() {
    const ang = Math.atan2(LAMP.y - this.s.y, LAMP.x - this.s.x);
    const dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] as const;
    this.s.dir = dirs[(Math.round(ang / (Math.PI / 4)) + 8) % 8];
  }

  private makeWarmOrb(x: number, y: number) {
    const c = this.s.add.container(x, y).setDepth(this.s.y + 28);
    const bloom = this.s.add.ellipse(0, 0, 30, 30, 0xff8a32, 0.32).setBlendMode(Phaser.BlendModes.ADD);
    const mid = this.s.add.ellipse(0, 0, 16, 16, 0xffc878, 0.55).setBlendMode(Phaser.BlendModes.ADD);
    const core = this.s.add.ellipse(0, 0, 7, 7, 0xfff4c8, 0.95).setBlendMode(Phaser.BlendModes.ADD);
    c.add([bloom, mid, core]);
    this.s.objs.push(c, bloom, mid, core);
    return c;
  }

  private crackleG?: Phaser.GameObjects.Graphics;
  private crackleT = 0;
  private streamParts: { t: number; delay: number; speed: number; wob: number; spr: Phaser.GameObjects.Arc }[] = [];

  private tickHeldCrackle(dt: number, x: number, y: number) {
    this.crackleT -= dt;
    if (this.crackleT > 0 && this.crackleG) return;
    this.crackleT = 0.28 + Math.random() * 0.35;
    if (!this.crackleG) {
      this.crackleG = this.s.add.graphics().setDepth(this.s.y + 30).setBlendMode(Phaser.BlendModes.ADD);
      this.s.objs.push(this.crackleG);
    }
    const g = this.crackleG;
    g.clear().setPosition(0, 0).setDepth(this.s.y + 30);
    const n = 1 + (Math.random() * 2) | 0;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 10;
      g.lineStyle(1.2, 0xffd090, 0.7);
      g.beginPath();
      g.moveTo(x, y);
      const mx = x + Math.cos(a) * r * 0.5 + (Math.random() - 0.5) * 4;
      const my = y + Math.sin(a) * r * 0.5 + (Math.random() - 0.5) * 4;
      g.lineTo(mx, my);
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      g.strokePath();
    }
    this.s.tweens.add({ targets: g, alpha: { from: 1, to: 0 }, duration: 120, onComplete: () => { if (this.crackleG === g) g.clear(); } });
  }

  /** Tap or hold at the dead call panel: she tries it, it fizzles, the lamp unlocks. */
  tryPanel() {
    if (this.lampReady || this.done) return;
    this.fizzlePanel();
    this.unlockLamp();
  }

  private fizzlePanel() {
    const x = PANEL.x, y = PANEL.y - 8;
    const g = this.s.add.graphics().setDepth(y + 12).setBlendMode(Phaser.BlendModes.ADD);
    this.s.objs.push(g);
    g.fillStyle(0x7ad4d8, 0.85).fillCircle(x, y, 5);
    g.lineStyle(2, 0xe8fcfc, 0.85);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.25;
      const r = 10 + Math.random() * 10;
      g.lineBetween(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75);
    }
    this.s.tweens.add({ targets: g, alpha: 0, duration: 320, onComplete: () => g.destroy() });
    if (this.panelSpr) {
      const a = this.panelSpr.alpha;
      this.s.tweens.add({
        targets: this.panelSpr, alpha: 0.2, duration: 50, yoyo: true, repeat: 3,
        onComplete: () => this.panelSpr?.setAlpha(a),
      });
    }
    try { sfx('ui'); } catch { /* */ }
    try { sfx('impact_snap'); } catch { /* */ }
    if (!this.panelTried) {
      this.panelTried = true;
      try { this.s.say('noor', "It's dead.", 1400, { box: false }); } catch { /* */ }
    }
  }

  unlockLamp() {
    if (this.lampReady) return;
    this.lampReady = true;
    if (this.lure) this.lure.source = { x: LAMP.x, y: LAMP.y, radius: 130 };
    this.lure?.setHold(0);
    try { sfx('tell'); } catch { /* */ }
    try { this.s.say('fern', "The lamp. That's the only thing still drawing power.", 2800); } catch { /* */ }
  }

  takeSpark() {
    if (!this.lampReady || !this.lampOn || this.draining || this.carrying) return;
    this.draining = true;
    this.throwQueued = false;
    this.drainT = 0;
    this.drainShook = false;
    this.s.hand = null;
    try { sfx('crackle'); } catch { /* */ }
    try { sfx('impact_hum'); } catch { /* */ }

    this.faceLamp();
    try { this.s.noor.play(`noor_type2_${this.s.dir}`, true); } catch { /* */ }

    const veil = this.s.add.ellipse(LAMP.x, LAMP.y, 280, 200, 0x03070c, 0).setDepth(LAMP.y + 4);
    this.drainVeil = veil;
    this.s.objs.push(veil);
    this.s.tweens.add({ targets: veil, alpha: 0.62, duration: 420, ease: 'Sine.easeIn' });

    if (this.lure) this.lure.hidden = true;

    const streamDepth = Math.max(LAMP.y, this.s.y) + 36;
    this.drainG = this.s.add.graphics().setDepth(streamDepth).setBlendMode(Phaser.BlendModes.ADD);
    this.s.objs.push(this.drainG);

    // Warm orb stays hidden until the stream condenses at the palm — never a white star.
    const h = this.handOff();
    this.heldOrb = this.makeWarmOrb(this.s.x + h.x, this.s.y + h.y);
    this.heldOrb.setAlpha(0).setScale(0.3);

    this.streamParts.forEach(p => { try { p.spr.destroy(); } catch { /* */ } });
    this.streamParts = [];
    for (let i = 0; i < 18; i++) {
      const spr = this.s.add.circle(LAMP.x, LAMP.y - 22, 1.8 + Math.random() * 2.2, i % 3 === 0 ? 0xfff3c8 : 0xffb060, 0)
        .setDepth(Math.max(LAMP.y, this.s.y) + 38).setBlendMode(Phaser.BlendModes.ADD);
      this.s.objs.push(spr);
      this.streamParts.push({ t: 0, delay: 0.04 + i * 0.028, speed: 0.9 + Math.random() * 0.35, wob: (Math.random() - 0.5) * 10, spr });
    }
  }

  private streamCurve() {
    const h = this.handOff();
    const p0 = { x: LAMP.x, y: LAMP.y - 22 };
    const p2 = { x: this.s.x + h.x, y: this.s.y + h.y };
    const dx = p2.x - p0.x, dy = p2.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    // Bow the ribbon up and aside so it clearly leaves the shade and curves into the palm.
    const p1 = { x: (p0.x + p2.x) / 2 + nx * 34, y: (p0.y + p2.y) / 2 + ny * 16 - 28 };
    return { p0, p1, p2 };
  }

  private bez(p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, t: number) {
    const u = 1 - t;
    return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
  }

  private tickDrain() {
    const t = this.drainT;
    const dur = ImpactLab.SPARK_DRAIN;
    const h = this.handOff();
    const hx = this.s.x + h.x, hy = this.s.y + h.y;
    const { p0, p1, p2 } = this.streamCurve();

    // Lamp flickers, then the shade goes dark as the light is pulled out.
    if (this.lampSpr && t < 0.36) {
      const on = (Math.sin(t * 70) * Math.sin(t * 15)) > 0.15;
      const onK = this.s.textures.exists('lift_lamp_on') ? (on ? 'lift_lamp_on' : 'lift_lamp_off')
        : (on ? 'fx_lamp_on' : 'fx_lamp_off');
      if (this.s.textures.exists(onK)) this.lampSpr.setTexture(onK);
      this.lampSpr.setAlpha(on ? 1 : 0.4);
    } else if (this.lampSpr) {
      const k = this.s.textures.exists('lift_lamp_off') ? 'lift_lamp_off' : 'fx_lamp_off';
      if (this.s.textures.exists(k)) this.lampSpr.setTexture(k);
      this.lampSpr.setAlpha(Math.max(0.2, 0.65 - (t - 0.36) * 0.9));
    }

    const travel = Math.max(0, Math.min(1, t / (dur - 0.10)));
    const ease = 1 - Math.pow(1 - travel, 1.6);
    this.drainG?.setDepth(Math.max(LAMP.y, this.s.y) + 36);
    this.drawDrainStream(p0, p1, p2, ease);

    for (const p of this.streamParts) {
      const u = (t - p.delay) * p.speed / (dur * 0.75);
      if (u <= 0) { p.spr.setAlpha(0); continue; }
      if (u >= 1) {
        p.spr.setAlpha(Math.max(0, 1 - (u - 1) * 4));
        p.spr.setPosition(p2.x, p2.y);
        continue;
      }
      const pt = this.bez(p0, p1, p2, u);
      p.spr.setPosition(pt.x + Math.sin(t * 14 + p.wob) * 2, pt.y + p.wob * (1 - u) * 0.3);
      p.spr.setAlpha(0.55 + 0.45 * Math.sin(u * Math.PI));
      p.spr.setScale(1.1 - u * 0.3);
    }

    // Condense at the palm in the last third — a small warm orb, not a star.
    const condense = Math.max(0, (t - dur * 0.52) / (dur * 0.48));
    if (this.heldOrb) {
      this.heldOrb.setPosition(hx, hy).setDepth(this.s.y + 28);
      this.heldOrb.setAlpha(Math.min(1, condense * 1.4));
      this.heldOrb.setScale(0.35 + Math.min(1, condense) * 0.65);
    }

    try { this.s.noor.play(`noor_type2_${this.s.dir}`, true); } catch { /* */ }

    if (!this.drainShook && t >= dur * 0.7) {
      this.drainShook = true;
      try { this.s.cameras.main.shake(60, 0.0025); } catch { /* */ }
      try { sfx('crackle', 0.8); } catch { /* */ }
      try { sfx('steal'); } catch { /* */ }
    }
  }

  private drawDrainStream(
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    u: number,
  ) {
    const g = this.drainG;
    if (!g) return;
    g.clear();
    if (u <= 0.01) return;
    const steps = 22;
    // Warm ribbon along the bezier, tapering toward the palm.
    for (let pass = 0; pass < 2; pass++) {
      const col = pass === 0 ? 0xff9a3a : 0xffe0a0;
      const midW = pass === 0 ? 10 : 4.5;
      for (let i = 0; i < steps; i++) {
        const t0 = (i / steps) * u, t1 = ((i + 1) / steps) * u;
        const a = this.bez(p0, p1, p2, t0), b = this.bez(p0, p1, p2, t1);
        const fade = 0.7 * (1 - t0 * 0.35);
        const w0 = midW * (1 - t0 * 0.65), w1 = midW * (1 - t1 * 0.65);
        const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l, ny = dx / l;
        g.fillStyle(col, fade);
        g.fillTriangle(a.x + nx * w0, a.y + ny * w0, a.x - nx * w0, a.y - ny * w0, b.x + nx * w1, b.y + ny * w1);
        g.fillTriangle(a.x - nx * w0, a.y - ny * w0, b.x + nx * w1, b.y + ny * w1, b.x - nx * w1, b.y - ny * w1);
      }
    }
    // A brighter leading edge along the current tip.
    const tip = this.bez(p0, p1, p2, u);
    g.fillStyle(0xfff3c8, 0.85).fillCircle(tip.x, tip.y, 3.2);
    g.fillStyle(0xff9a3a, 0.35).fillCircle(p0.x, p0.y, 5);
  }

  private finishDrain() {
    if (!this.draining) return;
    this.draining = false;
    this.lampOn = false;
    this.carrying = true;
    if (this.lure) this.lure.hidden = false;
    this.lure?.setCarrying(true);
    if (this.lampSpr) {
      const k = this.s.textures.exists('lift_lamp_off') ? 'lift_lamp_off' : 'fx_lamp_off';
      if (this.s.textures.exists(k)) this.lampSpr.setTexture(k);
      this.lampSpr.setAlpha(1);
    }
    if (this.drainVeil) {
      const v = this.drainVeil;
      this.s.tweens.add({ targets: v, alpha: 0.28, duration: 360 });
    }
    if (this.drainG) { try { this.drainG.destroy(); } catch { /* */ } this.drainG = undefined; }
    for (const p of this.streamParts) { try { p.spr.destroy(); } catch { /* */ } }
    this.streamParts = [];
    const h = this.handOff();
    if (this.heldOrb) this.heldOrb.setPosition(this.s.x + h.x, this.s.y + h.y).setScale(1).setAlpha(1).setDepth(this.s.y + 28);
    try { this.s.say('noor', 'What— what is this?', 1800); } catch { /* */ }
    if (this.throwQueued) {
      this.throwQueued = false;
      this.throwBolt();
    }
  }

  throwBolt() {
    if (this.draining) { this.throwQueued = true; return; }
    this.carrying = false;
    this.s.hand = null;
    this.heldOrb?.destroy(); this.heldOrb = undefined;
    if (this.drainBloom) { try { this.s.tweens.killTweensOf(this.drainBloom); this.drainBloom.destroy(); } catch { /* */ } this.drainBloom = undefined; }
    this.boltT = 0;

    // Face the panel so the throw pose aims at the target.
    const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
    const ang = Math.atan2(PANEL.y - this.s.y, PANEL.x - this.s.x);
    this.s.dir = DIRS[(Math.round(ang / (Math.PI / 4)) + 8) % 8];
    this.frameHandPanel();

    sfx('throw');
    if (this.lure) this.lure.hidden = true;
    this.flying = true;
    this.boltT = 0;
    playThrowAttack(this.s, () => {
      const h = this.handOff();
      const from = { x: this.s.x + h.x, y: this.s.y + h.y };
      const to = { x: PANEL.x, y: PANEL.y };
      launchAnimatedBolt(this.s, from, to, () => this.onPanelHit(), 240);
    }, false);
  }

  /** Frame camera on hand↔panel midpoint so the bolt path is readable. */
  frameHandPanel(_zoom = 1) {
    this.holdStaticCam();
  }

  private clearCarryFx() {
    this.heldOrb?.destroy(); this.heldOrb = undefined;
    if (this.drainBloom) { try { this.s.tweens.killTweensOf(this.drainBloom); this.drainBloom.destroy(); } catch { /* */ } this.drainBloom = undefined; }
    this.drainG?.destroy(); this.drainG = undefined;
    this.drainVeil?.destroy(); this.drainVeil = undefined;
    this.crackleG?.destroy(); this.crackleG = undefined;
    for (const p of this.streamParts) { try { p.spr.destroy(); } catch { /* */ } }
    this.streamParts = [];
    this.bolt?.destroy(); this.bolt = undefined;
    this.boltBeam?.destroy(); this.boltBeam = undefined;
  }

  private onPanelHit() {
    this.flying = false;
    this.lure?.setCarrying(false);
    const bolt = this.bolt;
    this.bolt = undefined;

    const dir = { x: PANEL.x - this.s.x, y: PANEL.y - this.s.y };
    const sils: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Image)[] = [];
    if (this.panelSpr) sils.push(this.panelSpr);
    if (this.lure) this.lure.hidden = true;

    this.impactFrame = false;
    void dir; void sils;
    // Failsafe clear impactFrame flag
    window.setTimeout(() => { this.impactFrame = false; }, 450);

    window.setTimeout(() => {
      try { bolt?.destroy(); } catch { /* */ }
      try { this.boltBeam?.destroy(); this.boltBeam = undefined; } catch { /* */ }
    }, 160);

    window.setTimeout(() => {
      if (this.panelSpr && this.s.textures.exists('fx_lift_panel_cracked')) {
        this.panelSpr.setTexture('fx_lift_panel_cracked');
      }
      this.popSpark(PANEL.x, PANEL.y - 8);
      this.popSpark(PANEL.x + 6, PANEL.y + 8);
      sfx('impact_snap');
      this.popCover();
    }, 130);

    window.setTimeout(() => {
      if (this.panelSpr && this.s.textures.exists('lift_panel_live')) {
        this.panelSpr.setTexture('lift_panel_live');
      } else if (this.panelSpr && this.s.textures.exists('fx_lift_panel_live')) {
        this.panelSpr.setTexture('fx_lift_panel_live');
      }
      if (this.floorInd && this.s.textures.exists('lift_ind_on')) {
        this.floorInd.setTexture('lift_ind_on');
      } else if (this.floorInd && this.s.textures.exists('fx_lift_floor_ind_on')) {
        this.floorInd.setTexture('fx_lift_floor_ind_on');
      }
      try { this.s.cameras.main.flash(70, 30, 70, 50); } catch { /* */ }
      sfx('impact_hum');
      this.openLift();
    }, 300);
  }

  private popCover() {
    if (!this.s.matter || !this.s.textures.exists('fx_lift_panel_cover')) return;
    try {
      this.cover = this.s.matter.add.image(PANEL.x, PANEL.y - 6, 'fx_lift_panel_cover', undefined, {
        shape: { type: 'rectangle', width: 18, height: 22 },
        friction: 0.5, restitution: 0.45, density: 0.004,
      });
      this.cover.setDepth(PANEL.y + 8).setScale(1.05);
      this.cover.setVelocity(90, -260);
      this.cover.setAngularVelocity(0.22);
      this.s.objs.push(this.cover);
      window.setTimeout(() => { try { this.cover?.setVelocity(30, 160); } catch { /* */ } }, 220);
    } catch { /* */ }
  }

  private openLift() {
    if (this.done) return;
    this.lure?.destroy(); this.lure = undefined;
    this.darkGap?.destroy(); this.darkGap = undefined;

    this.frameDoors(1);

    // Shudder the leaves, then slide them into the frame sides
    const leafL0 = this.leafL?.x ?? 0;
    const leafR0 = this.leafR?.x ?? 0;
    if (this.leafL) {
      this.s.tweens.add({
        targets: this.leafL, x: leafL0 - 3, duration: 40, yoyo: true, repeat: 4,
      });
    }
    if (this.leafR) {
      this.s.tweens.add({
        targets: this.leafR, x: leafR0 + 3, duration: 40, yoyo: true, repeat: 4,
      });
    }

    const p = this.s.plateById('o_door');
    if (p && p.slotWord !== 'OPEN') {
      window.setTimeout(() => {
        p.setSlotWord('OPEN');
        this.s.save.plates[p.def.id] = 'OPEN';
        this.s.evaluate(false);
        // Keep baked door hidden; walkable lift still comes from evaluate/setDoor
        if (this.s.clar) {
          this.s.clar.doorWant = 1;
          this.s.clar.doorK = 1;
          if (this.s.clar.door) this.s.clar.door.setVisible(false);
        }
        this.s.extraWalk.lift = { x: 155, y: 150, w: 100, h: 60 };
        try { writeSave(this.s.save); } catch { /* */ }
        sfx('lift');
        this.animateLeavesOpen();
        this.speakDiscovery();
      }, 220);
    } else {
      this.animateLeavesOpen();
      this.speakDiscovery();
    }
  }

  /** Protected discovery lines (power-rewrite §7), moved from the window teach to the lamp. */
  private speakDiscovery() {
    if (this.s.save.seen.includes('sc_steal')) return;
    this.s.save.seen.push('sc_steal');
    try { writeSave(this.s.save); } catch { /* */ }
    window.setTimeout(() => {
      try {
        this.s.say('fern', "You're not supposed to be able to do that.", 2400);
        this.s.say('fern', "Things keep their words. People don't peel them.", 2400);
        this.s.say('noor', 'Then what am I?', 1600);
        this.s.say('fern', 'For now, go through.', 2000);
      } catch { /* */ }
    }, 400);
  }

  /** Slide leaves sideways over ~0.9s with a slight residual shudder. */
  private animateLeavesOpen() {
    const token = ++this.leafAnimToken;
    const steps = 10;
    let i = 0;
    const tick = () => {
      if (token !== this.leafAnimToken) return; // aborted by applyLiftDoorK / stop
      i += 1;
      const k = Math.min(1, i / steps);
      this.liftDoorK = k;
      const slide = k * (LIFT_LEAF_W - 4);
      const shudder = (i < 3) ? ((i % 2) * 2 - 1) : 0;
      if (this.leafL) {
        this.leafL.x = LEAF_L0.x - slide + shudder;
      }
      if (this.leafR) {
        this.leafR.x = LEAF_R0.x + slide - shudder;
      }
      this.clipLeavesToOpening();
      this.syncOpenFx(k);
      if (k < 1) window.setTimeout(tick, 90);
      else this.done = true;
    };
    tick();
  }

    /**
   * Crop each leaf to the intersection with the steel opening.
   * Phaser keeps crop UVs in texture space, so remaining pixels stay world-aligned
   * (pocket parts simply don't draw). WebGL-safe replacement for GeometryMask.
   */

  private syncOpenFx(k: number) {
    this.liftSeam?.setVisible(k < 0.08);
    if (this.liftSpill) this.liftSpill.setAlpha(Math.max(0, (k - 0.12) / 0.88) * 0.9);
    if (this.floorInd && this.s.textures.exists(k > 0.2 ? 'lift_ind_on' : 'lift_ind_off')) {
      const on = k > 0.2;
      this.floorInd.setTexture(on ? 'lift_ind_on' : 'lift_ind_off');
      this.floorInd.setPosition(on ? IND_ON_POS.x : IND_OFF_POS.x, on ? IND_ON_POS.y : IND_OFF_POS.y);
    }
    if (this.panelSpr && this.s.textures.exists(k > 0.05 ? 'lift_panel_live' : 'lift_panel_dead')) {
      // panel goes live on bolt hit (already swapped); keep
    }
  }

  private clipLeavesToOpening() {
    const openL = LIFT_OPEN.x;
    const openR = openL + LIFT_OPEN.w;
    const leafH = (this.leafL?.height || this.leafR?.height || LIFT_OPEN.h);
    const clip = (leaf: Phaser.GameObjects.Image | undefined) => {
      if (!leaf) return;
      const lx = leaf.x;
      const lw = LIFT_LEAF_W;
      const overlapL = Math.max(lx, openL);
      const overlapR = Math.min(lx + lw, openR);
      if (overlapR <= overlapL + 0.5) {
        leaf.setVisible(false);
        return;
      }
      leaf.setVisible(true);
      leaf.setCrop(overlapL - lx, 0, overlapR - overlapL, leafH);
    };
    clip(this.leafL);
    clip(this.leafR);
  }

  /** Capture/test helper: set door open amount 0..1 and crop leaves into pockets. */
  applyLiftDoorK(k: number) {
    this.leafAnimToken += 1; // abort in-flight open animation / cam tweens from it
    const kk = Math.min(1, Math.max(0, k));
    this.liftDoorK = kk;
    const slide = kk * (LIFT_LEAF_W - 4);
    if (this.leafL) this.leafL.x = LEAF_L0.x - slide;
    if (this.leafR) this.leafR.x = LEAF_R0.x + slide;
    this.clipLeavesToOpening();
    this.syncOpenFx(kk);
    if (kk >= 1) this.done = true;
  }

    get lampAlive() { return this.lampOn; }
  get panelPos() { return { ...PANEL }; }
  get lampPos() { return { ...LAMP }; }
  get liftFocus() { return { ...LIFT_FOCUS }; }
  get panelSprite() { return this.panelSpr; }
  get liftDoorOpenK() { return this.liftDoorK; }
  set liftDoorOpenK(v: number) { this.liftDoorK = v; }
  get leafLeft() { return this.leafL; }
  get leafRight() { return this.leafR; }
  get liftFrameBounds() {
    return {
      ...LIFT_OPEN_BOUNDS,
      panel: { ...PANEL },
      lamp: { ...LAMP, scale: LAMP_SCALE, originY: 0.92 },
      desk: { x: 115, y: 273, w: 100, h: 74, topH: 32 },
      doorOrigin: { x: O11_DOOR.x, y: O11_DOOR.y },
    };
  }
  get lampSprite() { return this.lampSpr; }
  get boltSprite() { return this.bolt; }
}
