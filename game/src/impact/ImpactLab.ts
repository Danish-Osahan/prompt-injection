// Dead-lift beat (?impact): peel SPARK from flickering desk lamp → F-zap into dead call panel → lift opens.
// Panel sits on the wall beside the lift doors (baked plate, never kitchen/printer). Old word system off.
import Phaser from 'phaser';
import type { GameScene } from '../game';
import { O11_DOOR } from '../office11art';
import { ImpactFX } from './ImpactFX';
import { OnboardLure } from './OnboardLure';
import { sfx } from '../sfx';

/**
 * Call panel ON the lift — right door leaf / jamb (local ~148,108 → world ~260,170).
 * Clearly attached to the doors. Kitchen FG starts ~299; printer/plantW ~81 — stay clear of both.
 */
const PANEL = { x: O11_DOOR.x + 128, y: O11_DOOR.y + 118 }; // ≈ (240, 180) on right door leaf, clear of kitchen
/** Readable desk lamp ON the west pod desk (desk_podW ~115,273), a few steps from the lift. */
const LAMP = { x: 152, y: 288 };
/** Midpoint used to frame Noor + lift together. */
const LIFT_FOCUS = { x: O11_DOOR.x + 98, y: O11_DOOR.y + 160 };

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
  private panelSpr?: Phaser.GameObjects.Image;
  private floorInd?: Phaser.GameObjects.Image;
  private heldOrb?: Phaser.GameObjects.Sprite;
  private bolt?: Phaser.GameObjects.Sprite;
  private boltBeam?: Phaser.GameObjects.Graphics;
  private cover?: Phaser.Physics.Matter.Image;
  private buzzT = 0;
  private lampOn = true;
  private darkGap?: Phaser.GameObjects.Rectangle;
  private framing = false; // scripted cam during throw/open

  constructor(private s: GameScene) {
    this.fx = new ImpactFX(s);
  }

  start() {
    if (this.on) return;
    this.on = true;
    this.stealMode = true;

    const door = this.s.plateById('o_door');
    if (door && door.slotWord !== 'SHUT') {
      door.setSlotWord('SHUT');
      this.s.save.plates[door.def.id] = 'SHUT';
      this.s.evaluate(true);
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
    // Slightly wider follow so lamp + lift share the frame when near
    this.s.setupFollowCamera?.(1.85);
    this.s.x = LAMP.x + 36; this.s.y = LAMP.y + 50; this.s.dir = 'NW';
    this.s.unstick();

    window.setTimeout(() => {
      try {
        this.s.subQueue.push({ who: 'fern', line: "That lamp's been angry all morning. The lift's dead — maybe it wants the spark.", ms: 3200 });
        if (!this.s.subBusy) this.s.nextSub();
      } catch { /* */ }
    }, 600);
  }

  stop() {
    this.on = false;
    this.stealMode = false;
    this.framing = false;
    this.lure?.destroy(); this.lure = undefined;
    this.hint?.destroy(); this.hint = undefined;
    this.clearCarryFx();
    this.lampSpr?.destroy(); this.panelSpr?.destroy();
    this.floorInd?.destroy(); this.darkGap?.destroy();
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
    // Dark gap between shut lift leaves
    this.darkGap = this.s.add.rectangle(O11_DOOR.x + 98, O11_DOOR.y + 148, 5, 210, 0x020408, 0.9)
      .setDepth(O11_DOOR.y + 1);
    this.s.objs.push(this.darkGap);

    // Call panel — small vertical plate ON the wall beside the lift (baked plate spot), above kitchen FG
    const ptex = this.s.textures.exists('fx_lift_panel_dead') ? 'fx_lift_panel_dead' : 'fx_spark_core';
    this.panelSpr = this.s.add.image(PANEL.x, PANEL.y, ptex)
      .setDepth(250).setScale(1.6).setOrigin(0.5, 0.5);
    this.s.objs.push(this.panelSpr);

    if (this.s.textures.exists('fx_lift_floor_ind_off')) {
      this.floorInd = this.s.add.image(PANEL.x, PANEL.y - 28, 'fx_lift_floor_ind_off')
        .setDepth(241).setScale(1.0);
      this.s.objs.push(this.floorInd);
    }

    // Desk lamp — arm + shade ON desk_podW, depth above the desk (baseY 346)
    const ltex = this.s.textures.exists('fx_lamp_on') ? 'fx_lamp_on' : 'fx_spark_core';
    this.lampSpr = this.s.add.image(LAMP.x, LAMP.y, ltex)
      .setDepth(360).setScale(2.15).setOrigin(0.5, 0.92);
    this.s.objs.push(this.lampSpr);
  }

  private setupLure() {
    this.lure = new OnboardLure(this.s, LAMP, PANEL, {
      nearR: 140,
      sourceGlowSize: { w: 44, h: 56 },
      targetGlowSize: { w: 30, h: 44 },
    });
    this.lure.sourceAct = (t) => {
      if (!this.lampOn || !this.lampSpr) return;
      const flick = Math.sin(t * 17) * Math.sin(t * 3.1);
      const on = flick > -0.5;
      if (this.s.textures.exists(on ? 'fx_lamp_on' : 'fx_lamp_off')) {
        this.lampSpr.setTexture(on ? 'fx_lamp_on' : 'fx_lamp_off');
      }
      this.lampSpr.setAlpha(on ? 1 : 0.75);
      this.buzzT += 1 / 60;
      if (this.buzzT > 0.4 && Math.random() < 0.06) {
        this.buzzT = 0;
        this.popSpark(LAMP.x + 2, LAMP.y - 58);
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

  /** Ease camera to frame Noor + lift together (used for throw / door open). */
  frameLift(holdMs = 0, zoom = 1.55) {
    this.framing = true;
    const cam = this.s.cameras.main;
    try { cam.stopFollow(); } catch { /* */ }
    const tx = (this.s.x + LIFT_FOCUS.x) / 2;
    const ty = (this.s.y + LIFT_FOCUS.y) / 2 - 20;
    this.s.tweens.add({
      targets: cam, zoom,
      scrollX: tx - cam.width / (2 * zoom),
      scrollY: ty - cam.height / (2 * zoom),
      duration: 280, ease: 'Sine.easeInOut',
    });
    // Also nudge via centerOn after tween for safety
    window.setTimeout(() => {
      try { cam.setZoom(zoom); cam.centerOn(tx, ty); } catch { /* */ }
    }, 300);
    if (holdMs > 0) {
      window.setTimeout(() => { /* keep framed */ }, holdMs);
    }
  }

  /** Hold on the lift doors specifically (opening beat). */
  frameDoors(zoom = 2.05) {
    this.framing = true;
    const cam = this.s.cameras.main;
    try { cam.stopFollow(); } catch { /* */ }
    const tx = LIFT_FOCUS.x, ty = LIFT_FOCUS.y;
    this.s.tweens.add({
      targets: cam, zoom,
      duration: 350, ease: 'Sine.easeInOut',
      onUpdate: () => { try { cam.centerOn(tx, ty); } catch { /* */ } },
      onComplete: () => { try { cam.setZoom(zoom); cam.centerOn(tx, ty); } catch { /* */ } },
    });
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
    if (Phaser.Input.Keyboard.JustDown(this.keyI!)) {
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
      const dx = tx - this.bolt.x, dy = ty - this.bolt.y;
      const dist = Math.hypot(dx, dy);
      // Readable mid-flight (~0.45s travel) so stills can catch the bolt
      const sp = 260 * dt;
      const h = this.handOff();
      const hx = this.s.x + h.x, hy = this.s.y + h.y;
      if (dist < sp + 14) {
        this.bolt.x = tx; this.bolt.y = ty;
        this.drawBoltBeam(hx, hy, tx, ty);
        this.onPanelHit();
      } else {
        this.bolt.x += (dx / dist) * sp;
        this.bolt.y += (dy / dist) * sp;
        const fi = Math.floor(this.s.t * 24) % 4;
        if (this.s.textures.exists('fx_lightning_' + fi)) this.bolt.setTexture('fx_lightning_' + fi);
        this.bolt.setAngle(Phaser.Math.RadToDeg(Math.atan2(dy, dx)));
        // Stretch tip sprite a bit along flight
        this.bolt.setScale(2.8, 2.2);
        this.drawBoltBeam(hx, hy, this.bolt.x, this.bolt.y);
      }
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
    this.popSpark(LAMP.x, LAMP.y - 58);

    const h = this.handOff();
    const key = this.s.textures.exists('fx_spark_orb_0') ? 'fx_spark_orb_0' : 'fx_spark_core';
    this.heldOrb = this.s.add.sprite(this.s.x + h.x, this.s.y + h.y, key)
      .setDepth(7100).setScale(1.5).setBlendMode(Phaser.BlendModes.ADD);
    this.s.objs.push(this.heldOrb);
    try {
      this.s.noor.setTint(0xc8e8ff);
      window.setTimeout(() => { try { this.s.noor.clearTint(); } catch { /* */ } }, 450);
    } catch { /* */ }
  }

  throwBolt() {
    this.carrying = false;
    this.s.hand = null;
    this.heldOrb?.destroy(); this.heldOrb = undefined;

    // Face the panel / lift and frame both
    this.s.dir = this.s.x > PANEL.x ? 'NW' : 'W';
    this.frameLift(0, 1.6);

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
      .setDepth(7200).setScale(2.8).setBlendMode(Phaser.BlendModes.ADD);
    this.s.objs.push(this.bolt);
    this.boltBeam?.destroy();
    this.boltBeam = this.s.add.graphics().setDepth(7190);
    this.s.objs.push(this.boltBeam);
    this.flying = true;
    this.drawBoltBeam(this.s.x + h.x, this.s.y + h.y, this.s.x + h.x, this.s.y + h.y);
  }

  /** Thick branching bolt stroke from hand to tip (hand → panel). */
  private drawBoltBeam(x0: number, y0: number, x1: number, y1: number) {
    const g = this.boltBeam;
    if (!g) return;
    g.clear();
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist, ny = dx / dist;
    const segs = Math.max(4, Math.floor(dist / 18));
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const jag = (i === 0 || i === segs) ? 0 : Math.sin(t * 17 + this.s.t * 40) * 10 + Math.sin(t * 31) * 6;
      pts.push({ x: x0 + dx * t + nx * jag, y: y0 + dy * t + ny * jag });
    }
    // glow layers
    for (const [w, col, a] of [[14, 0x2880ff, 0.25], [8, 0x70d0ff, 0.55], [4, 0xe8ffff, 0.95], [2, 0xffffff, 1]] as const) {
      g.lineStyle(w, col, a);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.strokePath();
    }
    // short branches
    for (let i = 2; i < pts.length - 1; i += 2) {
      const p = pts[i];
      const bx = p.x + nx * 14 * (i % 4 === 0 ? 1 : -1);
      const by = p.y + ny * 14 * (i % 4 === 0 ? 1 : -1);
      g.lineStyle(3, 0xb8f0ff, 0.85);
      g.lineBetween(p.x, p.y, bx, by);
      g.lineStyle(1.5, 0xffffff, 1);
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
      if (this.panelSpr && this.s.textures.exists('fx_lift_panel_live')) {
        this.panelSpr.setTexture('fx_lift_panel_live');
      }
      if (this.floorInd && this.s.textures.exists('fx_lift_floor_ind_on')) {
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

    // Hold camera on the doors as they open
    this.frameDoors(2.1);

    const door = this.s.clar?.door;
    if (door) {
      this.s.tweens.add({ targets: door, x: door.x - 2, duration: 40, yoyo: true, repeat: 5 });
    }
    const p = this.s.plateById('o_door');
    if (p && p.slotWord !== 'OPEN') {
      window.setTimeout(() => {
        p.setSlotWord('OPEN');
        this.s.save.plates[p.def.id] = 'OPEN';
        this.s.evaluate(false);
        if (this.s.clar) {
          this.s.clar.doorWant = 1;
          this.s.clar.doorK = Math.max(this.s.clar.doorK, 0.2);
          this.s.clar.drawDoor();
        }
        sfx('impact_hum');
        // Lab: step the door open over ~0.9s so half/full stills are readable
        let k = this.s.clar?.doorK ?? 0.2;
        const step = () => {
          if (!this.s.clar) return;
          k = Math.min(1, k + 0.12);
          this.s.clar.doorK = k;
          this.s.clar.doorWant = 1;
          this.s.clar.drawDoor();
          this.frameDoors(2.15);
          if (k < 1) window.setTimeout(step, 90);
        };
        window.setTimeout(step, 100);
      }, 180);
    }
  }

  get lampAlive() { return this.lampOn; }
  get panelPos() { return { ...PANEL }; }
  get lampPos() { return { ...LAMP }; }
  get liftFocus() { return { ...LIFT_FOCUS }; }
  get panelSprite() { return this.panelSpr; }
  get lampSprite() { return this.lampSpr; }
  get boltSprite() { return this.bolt; }
}
