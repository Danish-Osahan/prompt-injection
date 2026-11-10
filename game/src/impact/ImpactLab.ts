// Dead-lift beat (?impact): peel SPARK from flickering desk lamp → F-zap into dead call panel → lift opens.
// Panel sits on the wall beside the lift doors (baked plate, never kitchen/printer). Old word system off.
import Phaser from 'phaser';
import type { GameScene } from '../game';
import { O11_DOOR } from '../office11art';
import { ImpactFX } from './ImpactFX';
import { OnboardLure } from './OnboardLure';
import { sfx } from '../sfx';
import { writeSave } from '../save';

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
const LAMP = { x: 178, y: 291 };
const LAMP_SPRITE = { x: 150, y: 256 };
const LAMP_SCALE = 1;
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
  private peelT = 0;
  private peelNeed = 0.5;
  private lampSpr?: Phaser.GameObjects.Image;
  private liftCab?: Phaser.GameObjects.Image;
  private panelSpr?: Phaser.GameObjects.Image;
  private floorInd?: Phaser.GameObjects.Image;
  private heldOrb?: Phaser.GameObjects.Sprite;
  private bolt?: Phaser.GameObjects.Sprite;
  private boltT = 0;
  private boltBeam?: Phaser.GameObjects.Graphics;
  private cover?: Phaser.Physics.Matter.Image;
  private buzzT = 0;
  private lampOn = true;
  private darkGap?: Phaser.GameObjects.Rectangle;
  private framing = false; // scripted cam during throw/open
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

  start() {
    if (this.on) return;
    this.on = true;
    this.stealMode = true;

    const alreadyOpen = this.s.plateById('o_door')?.slotWord === 'OPEN';
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
    else if (!this.s.introPending) {
      window.setTimeout(() => {
        try {
          this.s.say('fern', "That lamp's been buzzing since you sat down. The lift is dead.", 2800);
        } catch { /* */ }
      }, 600);
    }
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
      .setDepth(360).setScale(LAMP_SCALE).setOrigin(0, 0);
    this.s.objs.push(this.lampSpr);
  }

  private setupLure() {
    this.lure = new OnboardLure(this.s, LAMP, PANEL, {
      nearR: 110,
      sourceGlowSize: { w: 22, h: 28 },
      targetGlowSize: { w: 16, h: 22 },
    });
    this.lure.sourceAct = (t) => {
      if (!this.lampOn || !this.lampSpr) return;
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

  update(dt: number) {
    if (!this.keyI) this.keyI = this.s.input.keyboard?.addKey('I');
    // I toggles the isolated lab only under ?impact — never strip the lift mid-play.
    if (this.s.labMode && Phaser.Input.Keyboard.JustDown(this.keyI!)) {
      if (!this.on) this.start();
      else this.stop();
    }
    if (!this.on) return;

    this.suppressWordUi(true);
    this.impactFrame = !!this.fx.silActive;
    this.lure?.update(dt);
    if (!this.framing) this.s.updateFollowCamera?.();

    const f = this.s.ctl.read();
    const nearLamp = Math.hypot(this.s.x - LAMP.x, this.s.y - LAMP.y) < 130;

    if (nearLamp && f.interactHeld && !this.carrying && !this.flying && !this.done && this.lampOn) {
      this.peelT += dt;
      try { this.s.noor.play(`noor_type1_${this.s.dir}`, true); } catch { /* */ }
      if (this.peelT >= this.peelNeed) {
        this.peelT = 0;
        this.takeSpark();
      }
    } else if (!this.carrying) {
      this.peelT = Math.max(0, this.peelT - dt * 2);
    }

    if (this.carrying && this.heldOrb) {
      const h = this.handOff();
      this.heldOrb.setPosition(this.s.x + h.x, this.s.y + h.y);
      const fi = Math.floor(this.s.t * 10) % 4;
      if (this.s.textures.exists('fx_spark_orb_' + fi)) this.heldOrb.setTexture('fx_spark_orb_' + fi);
    }

    if (this.carrying && this.keyF && Phaser.Input.Keyboard.JustDown(this.keyF) && !this.flying) {
      this.throwBolt();
    }

    if (this.flying && this.bolt) {
      const tx = PANEL.x, ty = PANEL.y;
      const h = this.handOff();
      const hx = this.s.x + h.x, hy = this.s.y + h.y;
      // Always advance along hand→panel (not tip wander) so the vector aims at the panel
      const dx = tx - hx, dy = ty - hy;
      const full = Math.hypot(dx, dy) || 1;
      // ~150ms travel
      this.boltT = (this.boltT ?? 0) + dt;
      const u = Math.min(1, this.boltT / 0.15);
      this.bolt.x = hx + dx * u;
      this.bolt.y = hy + dy * u;
      const fi = Math.floor(this.s.t * 28) % 4;
      if (this.s.textures.exists('fx_lightning_' + fi)) this.bolt.setTexture('fx_lightning_' + fi);
      this.bolt.setAngle(Phaser.Math.RadToDeg(Math.atan2(dy, dx)));
      this.bolt.setScale(1.3, 1.0);
      this.drawBoltBeam(hx, hy, this.bolt.x, this.bolt.y);
      if (u >= 1) {
        this.bolt.x = tx; this.bolt.y = ty;
        this.drawBoltBeam(hx, hy, tx, ty);
        this.onPanelHit();
      }
    }

    // Normal office: walk into the open cab to leave for the hub. Lab stays put.
    if (this.done && !this.s.labMode && !this.s.transitioning) {
      const x = this.s.x, y = this.s.y;
      if (x > 155 && x < 255 && y > 150 && y < 180) this.s.goRoom('hub');
    }
  }

  private handOff() {
    const d = this.s.dir;
    if (d.includes('W')) return { x: -22, y: -52 };
    if (d.includes('E')) return { x: 22, y: -52 };
    return { x: -16, y: -56 };
  }

  takeSpark() {
    this.carrying = true;
    this.lampOn = false;
    this.s.hand = null;
    this.lure?.setCarrying(true);
    sfx('swap');

    if (this.lampSpr && this.s.textures.exists('fx_lamp_off')) {
      this.lampSpr.setTexture('fx_lamp_off').setAlpha(1);
    }
    this.popSpark(LAMP.x, LAMP.y - 22);

    const h = this.handOff();
    const key = this.s.textures.exists('fx_spark_orb_0') ? 'fx_spark_orb_0' : 'fx_spark_core';
    this.heldOrb = this.s.add.sprite(this.s.x + h.x, this.s.y + h.y, key)
      .setDepth(7100).setScale(1.5).setBlendMode(Phaser.BlendModes.ADD);
    this.s.objs.push(this.heldOrb);
    try {
      this.s.noor.setTint(0xc8e8ff);
      window.setTimeout(() => { try { this.s.noor.clearTint(); } catch { /* */ } }, 450);
    } catch { /* */ }
    try { this.s.say('noor', 'What— what is this?', 1800); } catch { /* */ }
  }

  throwBolt() {
    this.carrying = false;
    this.s.hand = null;
    this.heldOrb?.destroy(); this.heldOrb = undefined;
    this.boltT = 0;

    // Face the panel / lift and frame hand + panel together
    this.s.dir = this.s.x > PANEL.x ? 'NW' : 'W';
    this.frameHandPanel();

    try { this.s.noor.play(`noor_type2_${this.s.dir}`, true); } catch { /* */ }
    window.setTimeout(() => {
      try { this.s.noor.play(`noor_throw_${this.s.dir}`, true); } catch {
        try { this.s.noor.play(`noor_type3_${this.s.dir}`, true); } catch { /* */ }
      }
    }, 90);

    sfx('impact_whoosh');
    const h = this.handOff();
    const key = this.s.textures.exists('fx_lightning_0') ? 'fx_lightning_0' : 'fx_spark_core';
    this.bolt = this.s.add.sprite(this.s.x + h.x, this.s.y + h.y, key)
      .setDepth(7200).setScale(1.4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.85);
    this.s.objs.push(this.bolt);
    this.boltBeam?.destroy();
    this.boltBeam = this.s.add.graphics().setDepth(7190);
    this.s.objs.push(this.boltBeam);
    this.flying = true;
    this.drawBoltBeam(this.s.x + h.x, this.s.y + h.y, this.s.x + h.x, this.s.y + h.y);
  }

  /** Frame camera on hand↔panel midpoint so the bolt path is readable. */
  frameHandPanel(_zoom = 1) {
    this.holdStaticCam();
  }

  /** Thick jagged bolt hand→tip; overall vector always aims at the panel (small branches only). */
  private drawBoltBeam(x0: number, y0: number, x1: number, y1: number) {
    const g = this.boltBeam;
    if (!g) return;
    g.clear();
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist, ny = dx / dist;
    const segs = Math.max(5, Math.floor(dist / 16));
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      // Small jagged offset perpendicular to hand→panel (≤4px) — never leaves the corridor
      const jag = (i === 0 || i === segs) ? 0 : Math.sin(t * 21 + this.s.t * 55) * 3.5 + Math.sin(t * 47) * 1.5;
      pts.push({ x: x0 + dx * t + nx * jag, y: y0 + dy * t + ny * jag });
    }
    for (const [w, col, a] of [[8, 0x2880ff, 0.35], [5, 0x70d0ff, 0.7], [2.5, 0xe8ffff, 1], [1.2, 0xffffff, 1]] as const) {
      g.lineStyle(w, col, a);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.strokePath();
    }
    // Short side branches (do not redefine the main vector)
    for (let i = 2; i < pts.length - 1; i += 3) {
      const p = pts[i];
      const side = (i % 2 === 0 ? 1 : -1);
      const bx = p.x + nx * 8 * side;
      const by = p.y + ny * 8 * side;
      g.lineStyle(2.5, 0xb8f0ff, 0.8);
      g.lineBetween(p.x, p.y, bx, by);
      g.lineStyle(1.2, 0xffffff, 1);
      g.lineBetween(p.x, p.y, bx, by);
    }
  }

  private clearCarryFx() {
    this.heldOrb?.destroy(); this.heldOrb = undefined;
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
    if (bolt) sils.push(bolt);

    this.impactFrame = true;
    this.fx.fire({
      tier: 'big', x: PANEL.x, y: PANEL.y, dir,
      attacker: this.s.noor,
      target: this.panelSpr,
      silhouettes: sils,
      onHitStopEnd: () => { this.impactFrame = false; },
    });
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
      try { this.s.cameras.main.flash(160, 40, 90, 60); } catch { /* */ }
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
    this.done = true;
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
        sfx('impact_hum');
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
